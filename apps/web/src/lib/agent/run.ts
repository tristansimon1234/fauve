import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  addUsage,
  CHAT_EFFORT,
  CHAT_MODEL,
  supportsServerFallback,
  CLAUDE_MODEL,
  claudeCostUsd,
  FAUVE_SYSTEM_PROMPT,
  studioContextPrompt,
  type StudioContextForPrompt,
  toolSpecs,
  usdToEur,
  TOOL_STATUS,
  type Effort,
  type TikTokContext,
  type TokenUsage,
  type ToolHandlers,
  type ReplyExtras,
  type ToolName,
  type ReactionMood,
  endsTurn,
  keptPlan,
  proposalSchema,
} from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createToolHandlers, type ToolContext } from "./tools";
import { costMeta } from "@/lib/cost-scope";

let client: Anthropic | undefined;
export function anthropic() {
  client ??= new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  return client;
}

/**
 * Cached prompts are kept an hour: she often answers Simone 5 to 60 minutes later, and the montages come minutes
 * apart; kept 5 minutes, the cache had expired and the whole prefix was written again (60 % of the chat's cost,
 * three editor calls in four). An hour's write costs 2x input instead of 1.25x; a read, almost nothing.
 */
export const CACHE_AN_HOUR = { type: "ephemeral", ttl: "1h" } as const;

/**
 * The end of a chat request (the studio context, written fresh each turn, and the steps of the tool loop) is read
 * again only by the next step, seconds later: never by the next turn, whose history holds the stored messages. Kept
 * 5 minutes, it is written at 1.25x input instead of the hour's 2x. It comes after the hour-long markers, as the API asks.
 */
const CACHE_THIS_TURN = { type: "ephemeral" } as const;

function buildTools(handlers: ToolHandlers) {
  return (Object.keys(toolSpecs) as ToolName[]).map((name) => {
    const spec = toolSpecs[name];
    return betaZodTool({
      name,
      description: spec.description,
      inputSchema: spec.input,
      // Each handler is typed against its own schema; the map erases that link.
      run: (input) => (handlers[name] as (i: unknown) => Promise<string>)(input),
    });
  });
}

export type RunFauveInput = ToolContext & {
  history: Anthropic.Beta.BetaMessageParam[];
  studio: {
    name: string | null;
    businessType: string | null;
    timezone: string;
    onboardingStep: string;
    firstName: string | null;
    instagram: string | null;
    tiktok?: TikTokContext;
    channel?: "whatsapp" | "web" | "instagram";
    /** Default level of care for montages (Réglages). */
    montageEffort?: Effort;
    /** What Fauve knows about the business (site, tone, memory). */
    known?: { website: string | null; booking: string | null; tone: string | null; fonts?: string | null; memory: string[] };
    work?: string[];
    routine?: string[];
    voice?: StudioContextForPrompt["voice"];
    copying?: StudioContextForPrompt["copying"];
    models?: StudioContextForPrompt["models"];
  };
  /** Live: what Fauve is doing, and her words as she writes them (the app's chat). */
  onEvent?: (event: ChatEvent) => void;
};

/** A live event of a turn: a line for a tool she calls, or a piece of her text (`step`: the loop step it belongs to). */
export type ChatEvent =
  | { type: "status"; label: string }
  | { type: "text"; step: number; delta: string }
  /** Simone's instant reaction to the manager's message (Jev): her face, and an emoji on the message. */
  | { type: "mood"; mood: ReactionMood; emoji: string | null };

export type RunFauveResult = {
  reply: string | null;
  reactions: string[];
  /** Buttons and cards under the reply (reply_with). */
  extras: ReplyExtras;
  /** Ids made this turn, stored with the reply for the next turns (see ToolContext.notes). */
  notes: string[];
  usage: TokenUsage;
  /** Work started by tools that must run once the reply is sent (e.g. render then send a video). */
  afterReply: (() => Promise<void>)[];
};

const FALLBACK_REPLY = "Je n’ai pas réussi à traiter ta demande. Tu peux me la redire autrement ?";

/** Cache breakpoint on the last history message, so the next turn starts from a cached prefix. */
function withCacheBreakpoint(history: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  const last = history.at(-1);
  if (!last || typeof last.content !== "string") return history;
  return [
    ...history.slice(0, -1),
    { ...last, content: [{ type: "text", text: last.content, cache_control: CACHE_AN_HOUR }] },
  ];
}

export async function runFauve(input: RunFauveInput): Promise<RunFauveResult> {
  const now = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: input.studio.timezone,
  }).format(new Date());
  const dayName = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: input.studio.timezone });
  // Noon UTC of each coming day keeps the right calendar date in any European zone, DST included.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: input.studio.timezone }).format(new Date()).split("-").map(Number);
  const nextDays = Array.from({ length: 7 }, (_, i) => dayName.format(new Date(Date.UTC(y!, m! - 1, d! + i + 1, 12))));

  const params = {
    model: CHAT_MODEL,
    max_tokens: 16000,
    max_iterations: 8,
    output_config: { effort: CHAT_EFFORT },
    // On a policy refusal the API retries on the fallback model it picks (not offered on Haiku).
    ...(supportsServerFallback(CHAT_MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    // Stable prefix first (tools, system prompt, history), cached; the volatile
    // studio context (date, step) goes last as a system message so it never
    // invalidates the cached history.
    system: [{ type: "text", text: FAUVE_SYSTEM_PROMPT, cache_control: CACHE_AN_HOUR }],
    // Each step of the tool loop re-reads everything before it from the cache.
    cache_control: CACHE_THIS_TURN,
    tools: buildTools(createToolHandlers(input)),
    messages: [
      ...withCacheBreakpoint(input.history),
      {
        role: "system",
        content: studioContextPrompt({
          now,
          nextDays,
          timezone: input.studio.timezone,
          studioName: input.studio.name,
          businessType: input.studio.businessType,
          firstName: input.studio.firstName,
          onboardingStep: input.studio.onboardingStep,
          instagram: input.studio.instagram,
          tiktok: input.studio.tiktok,
          channel: input.studio.channel,
          montageEffort: input.studio.montageEffort,
          known: input.studio.known,
          work: input.studio.work,
          routine: input.studio.routine,
          voice: input.studio.voice,
          copying: input.studio.copying,
          models: input.studio.models,
        }),
      },
    ],
  } satisfies Parameters<ReturnType<typeof anthropic>["beta"]["messages"]["toolRunner"]>[0];

  let usage: TokenUsage = { input_tokens: 0, output_tokens: 0 };
  let last: Anthropic.Beta.BetaMessage | undefined;
  // Everything she wrote, step by step: an answer often starts before a tool call
  // (« D'accord, 19 h ! ») and ends after it; keeping only the last step lost the start.
  const spoken: string[] = [];
  // What the turn cost in calls: each step reads the whole prompt again, so the steps and their tools are logged.
  let steps = 0;
  const called: string[] = [];
  const take = (message: Anthropic.Beta.BetaMessage) => {
    usage = addUsage(usage, message.usage);
    last = message;
    steps++;
    called.push(...message.content.flatMap((b) => (b.type === "tool_use" ? [b.name] : [])));
    const text = textOf(message).trim();
    if (text && spoken.at(-1) !== text) spoken.push(text);
    // The tools of this step run after it: reply_with knows whether its buttons come with any words.
    input.wrote = spoken.length > 0;
  };
  const toolsOf = (message: Anthropic.Beta.BetaMessage) => message.content.filter((b) => b.type === "tool_use").map((b) => b.name);
  // A step that closes her message with its own words (buttons, a reaction) ends the turn: its
  // tools run, and the model is not asked again, which made it write the same answer twice.
  // Buttons or a reaction alone go back to the model: the answer they belong to is still to come.
  // A plan given to reply_with is her message too (it is written under Simone's words); one too
  // short to keep is refused by the tool, and the model is asked again even after a sentence.
  const planIn = (message: Anthropic.Beta.BetaMessage): "none" | "kept" | "refused" => {
    const call = message.content.find((b) => b.type === "tool_use" && b.name === "reply_with");
    const plan = call?.type === "tool_use" ? (call.input as { plan?: unknown } | null)?.plan : undefined;
    if (!plan) return "none";
    return keptPlan(proposalSchema.safeParse(plan).data) ? "kept" : "refused";
  };
  const closes = (message: Anthropic.Beta.BetaMessage) => {
    const plan = planIn(message);
    return plan !== "refused" && endsTurn(toolsOf(message), textOf(message).length > 0 || plan === "kept");
  };
  // A step that stops without a word after tools (« Je regarde tes vidéos… », then nothing) is
  // asked once more: she answers from what the tools returned instead of leaving a promise.
  let usedTools = false;
  let nudged = false;
  const mute = (message: Anthropic.Beta.BetaMessage) => {
    const tools = toolsOf(message);
    if (tools.length) usedTools = true;
    if (nudged || !usedTools || tools.length || textOf(message) || message.stop_reason !== "end_turn") return false;
    nudged = true;
    return true;
  };
  const NUDGE = "[Note du système, pas de la gérante : tu as utilisé des outils mais tu ne lui as pas encore répondu. Réponds-lui maintenant d'après leurs résultats, ou fais tout de suite ce que tu lui as annoncé.]";
  const onEvent = input.onEvent;
  if (onEvent) {
    // Live (the app): her words as she writes them, then a line for each tool she calls, before it runs.
    let step = 0;
    const runner = anthropic().beta.messages.toolRunner({ ...params, stream: true });
    for await (const stream of runner) {
      const current = step++;
      stream.on("text", (delta) => onEvent({ type: "text", step: current, delta }));
      const message = await stream.finalMessage();
      take(message);
      for (const block of message.content) {
        const label = block.type === "tool_use" ? TOOL_STATUS[block.name as ToolName] : null;
        if (label) onEvent({ type: "status", label });
      }
      if (closes(message)) {
        await runner.generateToolResponse();
        break;
      }
      if (mute(message)) runner.pushMessages({ role: "user", content: NUDGE });
    }
  } else {
    const runner = anthropic().beta.messages.toolRunner(params);
    for await (const message of runner) {
      take(message);
      if (closes(message)) {
        await runner.generateToolResponse();
        break;
      }
      if (mute(message)) runner.pushMessages({ role: "user", content: NUDGE });
    }
  }

  await logClaudeCost(input.studioId, usage, "conversation", CHAT_MODEL, { steps, tools: called });

  if (!last || last.stop_reason === "refusal") {
    return { reply: FALLBACK_REPLY, reactions: input.reactions, extras: {}, notes: input.notes, usage, afterReply: input.afterReply };
  }
  const reply = [...spoken, input.plan ?? ""].filter(Boolean).join("\n\n");
  // Never silent: a turn that only reacted keeps its reaction; one that did nothing at all says so.
  const silent = !reply && !input.reactions.length;
  return {
    reply: silent ? (input.afterReply.length ? "C'est parti, je m'en occupe 👍" : SILENT_REPLY) : reply || null,
    reactions: input.reactions,
    extras: reply ? input.extras : {},
    notes: input.notes,
    usage,
    afterReply: input.afterReply,
  };
}

const SILENT_REPLY = "Je suis là 🙂 Dis-moi ce que tu veux qu'on fasse.";

function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

export async function logClaudeCost(studioId: string, usage: TokenUsage, purpose = "conversation", model = CLAUDE_MODEL, extra: Record<string, unknown> = {}) {
  const usd = claudeCostUsd(model, usage);
  const { error } = await supabaseAdmin()
    .from("cost_events")
    .insert({
      studio_id: studioId,
      kind: "llm",
      provider: "anthropic",
      units: usage.input_tokens + usage.output_tokens,
      cost_eur: usdToEur(usd, env("USD_TO_EUR")),
      meta: costMeta({ model, purpose, usage, cost_usd: usd, ...extra }),
    });
  if (error) console.error("cost_events insert failed", error.message);
}
