import "server-only";
import { geminiCostUsd, usdToEur } from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** The usage block of a Gemini response (usageMetadata). */
export type GeminiUsage = Record<string, number | undefined> | undefined;

/**
 * Logs one Gemini call in cost_events, priced from the price list in pricing.ts
 * (GEMINI_INPUT_USD_PER_MTOK / GEMINI_OUTPUT_USD_PER_MTOK override it when both are set).
 */
export async function logGeminiCost(params: { studioId: string; kind: string; model: string; usage: GeminiUsage; meta?: Record<string, unknown> }) {
  const { usage } = params;
  const input = (usage?.promptTokenCount ?? 0) + (usage?.toolUsePromptTokenCount ?? 0);
  const output = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  const inPrice = env("GEMINI_INPUT_USD_PER_MTOK");
  const outPrice = env("GEMINI_OUTPUT_USD_PER_MTOK");
  const usd =
    inPrice !== undefined && outPrice !== undefined ? (input * inPrice + output * outPrice) / 1e6 : geminiCostUsd(params.model, { input, output });
  const { error } = await supabaseAdmin()
    .from("cost_events")
    .insert({
      studio_id: params.studioId,
      kind: params.kind,
      provider: "google",
      units: input + output,
      cost_eur: usd === null ? 0 : usdToEur(usd, env("USD_TO_EUR")),
      meta: { model: params.model, usage, cost_usd: usd, priced: usd !== null, ...params.meta },
    });
  if (error) console.error("cost_events insert failed", error.message);
}
