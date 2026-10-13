// Per-call cost logging (cost_events). Prices in USD per million tokens,
// from Anthropic's public price list; update when models or prices change.

/** Montage (editor, motion designer): quality first. */
export const CLAUDE_MODEL = "claude-opus-5-5";
/**
 * WhatsApp / web conversation: Haiku, about 20x cheaper than Sonnet. The creative
 * work (cuts, motion design) runs on Opus; the chat routes requests and writes
 * short messages and captions. Medium effort keeps its tool calls reliable.
 */
export const CHAT_MODEL = "claude-haiku-5-5";
export const CHAT_EFFORT = "medium" as const;
/** Haiku 5.5 rejects server-side fallbacks (400): only send them to models that take them. */
export const supportsServerFallback = (model: string) => !model.startsWith("claude-haiku");

type ModelPrice = { input: number; output: number; cacheRead: number; cacheWrite: number };

const CLAUDE_PRICES_USD: Record<string, ModelPrice> = {
  // Cache writes (5 min TTL) are billed at 1.25x input.
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  // Prompts up to 100K tokens (ours are far below); cache read 0.1x and write 1.25x input.
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

/** Rough conversion used for reporting only; override with USD_TO_EUR. */
export const DEFAULT_USD_TO_EUR = 0.86;

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function claudeCostUsd(model: string, usage: TokenUsage): number {
  const price = CLAUDE_PRICES_USD[model];
  if (!price) return 0;
  const perToken = (perMillion: number) => perMillion / 1_000_000;
  return (
    usage.input_tokens * perToken(price.input) +
    usage.output_tokens * perToken(price.output) +
    (usage.cache_read_input_tokens ?? 0) * perToken(price.cacheRead) +
    (usage.cache_creation_input_tokens ?? 0) * perToken(price.cacheWrite)
  );
}

export function usdToEur(usd: number, rate = DEFAULT_USD_TO_EUR): number {
  return Math.round(usd * rate * 1_000_000) / 1_000_000;
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
  };
}
