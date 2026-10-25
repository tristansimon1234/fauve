import "server-only";
import { kimiCostUsd, usdToEur } from "@fauve/agent";
import { getVercelOidcToken } from "@vercel/oidc";
import { costMeta } from "@/lib/cost-scope";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Kimi (Moonshot) through Vercel AI Gateway's OpenAI-compatible API, with the project's own OIDC
// token (AI_GATEWAY_API_KEY when set), billed to the team's AI Gateway credits. Only a lab studio's
// motion designer uses it, to compare Kimi with Opus on the same cases.

const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";

export type KimiPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

type Usage = { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
type Chunk = { choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[]; usage?: Usage; error?: { message?: string } };

/**
 * A JSON Schema reduced to its shape for a strict answer: bounds and patterns go (readAnswer repairs
 * them, as for Claude and Gemini), and every property is required, those that were not nullable.
 */
export function strictShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strictShape);
  if (!value || typeof value !== "object") return value;
  const DROP = new Set(["$schema", "pattern", "minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems", "format"]);
  const out = Object.fromEntries(Object.entries(value).filter(([key]) => !DROP.has(key)).map(([key, v]) => [key, strictShape(v)])) as Record<string, unknown>;
  const properties = out.properties as Record<string, Record<string, unknown>> | undefined;
  if (out.type === "object" && properties) {
    const required = new Set((out.required as string[] | undefined) ?? []);
    for (const [key, property] of Object.entries(properties)) {
      if (required.has(key)) continue;
      const type = property.type;
      properties[key] = typeof type === "string" ? { ...property, type: [type, "null"] } : Array.isArray(type) ? property : { anyOf: [property, { type: "null" }] };
    }
    out.required = Object.keys(properties);
    out.additionalProperties = false;
  }
  return out;
}

/** What it answers, read from its stream: the answer's text (JSON) once complete. */
export async function askKimiJson(params: {
  studioId: string;
  model: string;
  system: string;
  content: KimiPart[];
  /** A name for its schema, and the schema itself (as strictShape gives it). */
  name: string;
  schema: unknown;
  maxTokens: number;
  purpose: string;
}): Promise<unknown> {
  const token = env("AI_GATEWAY_API_KEY") ?? (await getVercelOidcToken());
  // Streamed: its thinking runs for minutes, and a silent connection would be dropped.
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `moonshotai/${params.model}`,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.content },
      ],
      response_format: { type: "json_schema", json_schema: { name: params.name, strict: true, schema: params.schema } },
      max_tokens: params.maxTokens,
      reasoning: { effort: "high" },
      stream: true,
      stream_options: { include_usage: true },
    }),
    cache: "no-store",
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`Kimi ${res.status} : ${body?.error?.message ?? "sans détail"}`);
  }
  let text = "";
  let usage: Usage | undefined;
  let finish: string | undefined;
  let pending = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    const lines = pending.split("\n");
    pending = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      const chunk = JSON.parse(data) as Chunk;
      if (chunk.error) throw new Error(`Kimi : ${chunk.error.message ?? "erreur"}`);
      text += chunk.choices?.[0]?.delta?.content ?? "";
      finish = chunk.choices?.[0]?.finish_reason ?? finish;
      if (chunk.usage) usage = chunk.usage;
    }
    if (done) break;
  }
  await logKimiCost(params.studioId, params.model, usage, params.purpose);
  if (!text.trim()) throw new Error(`pas de réponse lisible (${finish ?? "vide"})`);
  return JSON.parse(text);
}

async function logKimiCost(studioId: string, model: string, usage: Usage | undefined, purpose: string) {
  const input = usage?.prompt_tokens ?? 0;
  const output = usage?.completion_tokens ?? 0;
  const usd = kimiCostUsd(model, { input, cachedInput: usage?.prompt_tokens_details?.cached_tokens ?? 0, output });
  const { error } = await supabaseAdmin()
    .from("cost_events")
    .insert({
      studio_id: studioId,
      kind: "llm",
      provider: "moonshot",
      units: input + output,
      cost_eur: usd === null ? 0 : usdToEur(usd, env("USD_TO_EUR")),
      meta: costMeta({ model, purpose, usage, cost_usd: usd, priced: usd !== null, via: "ai-gateway" }),
    });
  if (error) console.error("cost_events insert failed", error.message);
}
