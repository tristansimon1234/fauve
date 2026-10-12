import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  addUsage,
  CLAUDE_MODEL,
  claudeCostUsd,
  FAUVE_SYSTEM_PROMPT,
  studioContextPrompt,
  toolSpecs,
  usdToEur,
  type TokenUsage,
  type ToolHandlers,
  type ToolName,
} from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createToolHandlers, type ToolContext } from "./tools";

let client: Anthropic | undefined;
function anthropic() {
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
  studio: { name: string | null; timezone: string; onboardingStep: string; firstName: string | null };
};

export type RunFauveResult = { reply: string | null; reactions: string[]; usage: TokenUsage };

const FALLBACK_REPLY = "Je n’ai pas réussi à traiter ta demande, je regarde ça et je reviens vers toi.";

export async function runFauve(input: RunFauveInput): Promise<RunFauveResult> {
  const now = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: input.studio.timezone,
  }).format(new Date());

  const runner = anthropic().beta.messages.toolRunner({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    max_iterations: 12,
    output_config: { effort: "medium" },
    // On a policy refusal the API retries on the fallback model it picks.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: FAUVE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: studioContextPrompt({
          now,
          timezone: input.studio.timezone,
          studioName: input.studio.name,
          firstName: input.studio.firstName,
          onboardingStep: input.studio.onboardingStep,
        }),
      },
    ],
    tools: buildTools(createToolHandlers(input)),
    messages: input.history,
  });

  let usage: TokenUsage = { input_tokens: 0, output_tokens: 0 };
  let last: Anthropic.Beta.BetaMessage | undefined;
  for await (const message of runner) {
    usage = addUsage(usage, message.usage);
    last = message;
  }

  await logClaudeCost(input.studioId, usage);

  if (!last || last.stop_reason === "refusal") {
    return { reply: FALLBACK_REPLY, reactions: input.reactions, usage };
  }
  const reply = last.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
  return { reply: reply || null, reactions: input.reactions, usage };
}

async function logClaudeCost(studioId: string, usage: TokenUsage) {
  const usd = claudeCostUsd(CLAUDE_MODEL, usage);
  const { error } = await supabaseAdmin()
    .from("cost_events")
    .insert({
      studio_id: studioId,
      kind: "llm",
      provider: "anthropic",
      units: usage.input_tokens + usage.output_tokens,
      cost_eur: usdToEur(usd, env("USD_TO_EUR")),
      meta: { model: CLAUDE_MODEL, usage, cost_usd: usd },
    });
  if (error) console.error("cost_events insert failed", error.message);
}
