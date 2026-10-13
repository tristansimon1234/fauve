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
  toolSpecs,
  usdToEur,
  type TokenUsage,
  type ToolHandlers,
  type ReplyExtras,
  type ToolName,
} from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createToolHandlers, type ToolContext } from "./tools";

let client: Anthropic | undefined;
export function anthropic() {
  client ??= new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  return client;
}

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
  studio: { name: string | null; businessType: string | null; timezone: string; onboardingStep: string; firstName: string | null; instagram: string | null };
};

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

const FALLBACK_REPLY = "Je n’ai pas réussi à traiter ta demande, je regarde ça et je reviens vers toi.";

/** Cache breakpoint on the last history message, so the next turn starts from a cached prefix. */
function withCacheBreakpoint(history: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  const last = history.at(-1);
  if (!last || typeof last.content !== "string") return history;
  return [
    ...history.slice(0, -1),
    { ...last, content: [{ type: "text", text: last.content, cache_control: { type: "ephemeral" } }] },
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

  const runner = anthropic().beta.messages.toolRunner({
    model: CHAT_MODEL,
    max_tokens: 16000,
    max_iterations: 8,
    output_config: { effort: CHAT_EFFORT },
    // On a policy refusal the API retries on the fallback model it picks (not offered on Haiku).
    ...(supportsServerFallback(CHAT_MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    // Stable prefix first (tools, system prompt, history), cached; the volatile
    // studio context (date, step) goes last as a system message so it never
    // invalidates the cached history.
    system: [{ type: "text", text: FAUVE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    // Each step of the tool loop re-reads everything before it from the cache.
    cache_control: { type: "ephemeral" },
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
        }),
      },
    ],
  });

  let usage: TokenUsage = { input_tokens: 0, output_tokens: 0 };
  let last: Anthropic.Beta.BetaMessage | undefined;
  for await (const message of runner) {
    usage = addUsage(usage, message.usage);
    last = message;
  }

  await logClaudeCost(input.studioId, usage, "conversation", CHAT_MODEL);

  if (!last || last.stop_reason === "refusal") {
    return { reply: FALLBACK_REPLY, reactions: input.reactions, extras: {}, notes: input.notes, usage, afterReply: input.afterReply };
  }
  const reply = last.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
  return { reply: reply || null, reactions: input.reactions, extras: reply ? input.extras : {}, notes: input.notes, usage, afterReply: input.afterReply };
}

export async function logClaudeCost(studioId: string, usage: TokenUsage, purpose = "conversation", model = CLAUDE_MODEL) {
  const usd = claudeCostUsd(model, usage);
  const { error } = await supabaseAdmin()
    .from("cost_events")
    .insert({
      studio_id: studioId,
      kind: "llm",
      provider: "anthropic",
      units: usage.input_tokens + usage.output_tokens,
      cost_eur: usdToEur(usd, env("USD_TO_EUR")),
      meta: { model, purpose, usage, cost_usd: usd },
    });
  if (error) console.error("cost_events insert failed", error.message);
}
