// Per-call cost logging (cost_events). Prices in USD per million tokens,
// from Anthropic's public price list; update when models or prices change.

export const CLAUDE_MODEL = "claude-opus-5-5";

type ModelPrice = { input: number; output: number; cacheRead: number; cacheWrite: number };

const CLAUDE_PRICES_USD: Record<string, ModelPrice> = {
  // Cache writes (5 min TTL) are billed at 1.25x input.
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
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
