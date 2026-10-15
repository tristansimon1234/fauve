// Per-call cost logging (cost_events). Prices in USD per million tokens,
// from Anthropic's public price list; update when models or prices change.

/** Montage (editor, motion designer): quality first. */
export const CLAUDE_MODEL = "claude-opus-5-5";
/**
 * WhatsApp / web conversation: Sonnet. Haiku misread the calendar and changed posts
 * on its own. Opus was tried too: ~€0.085 a turn against ~€0.03, too much for a
 * 49 € plan (what looked like Sonnet misunderstanding was a lost answer, fixed in
 * runFauve). The creative work (cuts, motion design) runs on Opus.
 */
export const CHAT_MODEL = "claude-sonnet-5-5";
export const CHAT_EFFORT = "medium" as const;
/** Weekly "what works" analysis: a small table of numbers, reasoning matters more than volume. */
export const ANALYST_MODEL = "claude-sonnet-5-5";
/** Watching the rendered montage (key frames against the plan): a checklist, Sonnet sees it as well at half the price. */
export const CRITIC_MODEL = "claude-sonnet-5-5";
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

// Gemini on the paid tier, USD per million tokens (ai.google.dev pricing, October 2026).
// The Flash models are at an introductory price through December 31, 2026, and double
// on January 1, 2027: the date of the call picks the price, so the logs stay right.
type GeminiPrice = { input: number; output: number };
const GEMINI_FLASH_MODELS = new Set(["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"]);
const GEMINI_FLASH_INTRO: GeminiPrice = { input: 0.75, output: 3.75 };
const GEMINI_FLASH: GeminiPrice = { input: 1.5, output: 7.5 };
const GEMINI_FLASH_INTRO_UNTIL = Date.UTC(2027, 0, 1);

/** Price of a Gemini model at a date, or null for a model not in the list (logged unpriced). */
export function geminiPrice(model: string, at = new Date()): GeminiPrice | null {
  if (!GEMINI_FLASH_MODELS.has(model)) return null;
  return at.getTime() < GEMINI_FLASH_INTRO_UNTIL ? GEMINI_FLASH_INTRO : GEMINI_FLASH;
}

/** A Gemini call: input tokens (video, image, text) and output tokens (thinking included). */
export function geminiCostUsd(model: string, tokens: { input: number; output: number }, at = new Date()): number | null {
  const price = geminiPrice(model, at);
  return price ? (tokens.input * price.input + tokens.output * price.output) / 1_000_000 : null;
}

/**
 * Where the render sandbox runs: Paris, next to the functions (cdg1) and to Supabase
 * (eu-west-3), so the clips are worked on in Europe and never cross the Atlantic.
 */
export const SANDBOX_REGION = "cdg1";

// Vercel Sandbox on Pro, USD (vercel.com/docs/sandbox/pricing, October 2026), by region:
// active CPU per hour (only while the CPU works) and provisioned memory per GB-hour
// (2 GB per vCPU, for the whole time the session runs).
const SANDBOX_RATES_USD: Record<string, { cpuHour: number; memoryGbHour: number }> = {
  iad1: { cpuHour: 0.128, memoryGbHour: 0.0212 },
  cdg1: { cpuHour: 0.177, memoryGbHour: 0.0292 },
};

/**
 * What `seconds` of work in the sandbox cost: the memory for that time, and the CPU
 * counted busy on every vCPU (a render keeps them busy; an upper bound). The time a
 * session stays up after its last job, until its timeout, is billed too and not counted here.
 */
export function sandboxCostUsd(seconds: number, vcpus: number, region: string = SANDBOX_REGION): number {
  const rate = SANDBOX_RATES_USD[region] ?? SANDBOX_RATES_USD[SANDBOX_REGION]!;
  return (Math.max(0, seconds) / 3600) * vcpus * (rate.cpuHour + 2 * rate.memoryGbHour);
}

// ElevenLabs on the API (elevenlabs.io/pricing/api, October 2026), USD.
export const ELEVENLABS_MUSIC_USD_PER_MINUTE = 0.15;
export const ELEVENLABS_STT_USD_PER_HOUR = 0.22;

/** A composed track, by its length (priced per minute of music, counted pro rata). */
export function musicCostUsd(seconds: number): number {
  return (Math.max(0, seconds) / 60) * ELEVENLABS_MUSIC_USD_PER_MINUTE;
}

/** A transcribed voice note (Scribe), by its length. */
export function transcriptionCostUsd(seconds: number): number {
  return (Math.max(0, seconds) / 3600) * ELEVENLABS_STT_USD_PER_HOUR;
}
