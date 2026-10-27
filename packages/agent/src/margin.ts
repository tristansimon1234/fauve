import { CREDIT_PRICES } from "./credits.ts";
import { PLANS, type PlanId } from "./plans.ts";

// What a studio costs against what it brings in: its offer's price once VAT and Stripe's fees
// are out, the share kept as margin, and what a credit pays. Every priced job costs at most what
// its credits pay, and each offer's credits are sized so that a whole month (every credit spent,
// the chat and the readings no credit pays) costs at most half of what the offer brings in.

/** Pro's monthly price, in euros, VAT included. */
export const PLAN_PRICE_EUR = PLANS.pro.priceEur;
/** Share of what an offer brings in kept, at least: costs stay under the other half. */
export const TARGET_MARGIN = 0.5;
/**
 * What a credit is worth, the margin included: every job is priced against it. Fixed at what it was
 * worth when credits came in (Pro's 220 credits at €49) so that a job keeps its price in credits when
 * an offer changes: the offers are sized on it, never the other way round.
 */
export const CREDIT_VALUE_EUR = 49 / 220;
/** What one credit pays of a job's real cost, the margin kept. */
export const EUR_PER_CREDIT_SPENT = CREDIT_VALUE_EUR * (1 - TARGET_MARGIN);

/**
 * A metered job's charge (a montage, a correction): what it really cost, in credits that keep the
 * margin, between its floor and its ceiling. Its cost unknown (not logged): the floor.
 */
export function meteredCredits(input: { costEur: number | null; floor: number; ceiling: number }): number {
  const credits = input.costEur === null ? 0 : Math.ceil(Math.max(0, input.costEur) / EUR_PER_CREDIT_SPENT - 1e-9);
  return Math.max(input.floor, Math.min(input.ceiling, credits));
}

/** VAT in the prices shown (France, 20 %): the offers are priced VAT included. */
export const VAT_RATE = 0.2;
/** Stripe's fees on a monthly payment, in euros: a card from the EEA (1.5 % + €0.25) and Billing for the subscription (0.7 %). */
export const stripeFeeEur = (priceEur: number) => priceEur * (0.015 + 0.007) + 0.25;
/** What an offer brings in a month, VAT and Stripe's fees out. */
export const netRevenue = (plan: PlanId) => PLANS[plan].priceEur / (1 + VAT_RATE) - stripeFeeEur(PLANS[plan].priceEur);
/** The most a studio's month may cost (AI, render, chat…) while keeping the margin. */
export const monthlyCostBudget = (plan: PlanId) => netRevenue(plan) * (1 - TARGET_MARGIN);
/** Pro's month budget. */
export const MONTHLY_COST_BUDGET_EUR = monthlyCostBudget("pro");

/**
 * The chat and the readings no credit pays, per publication, in euros: about 6 turns of chat (€0.048 a
 * turn on average, 24 turns measured from 24 to 27 October with the prompt cache kept an hour, its cold
 * starts included) and the readings around it (her files read as they arrive, the caption, the plan
 * proposed in Créer, a Reel to copy). To measure again on real studios (/api/admin/margin).
 */
export const CHAT_EUR_PER_POST = 0.35;
/**
 * WhatsApp, per publication, in euros: about 8 messages from Edith (his answers, a link button sent
 * apart from reply buttons, a reminder outside the 24 hours) at about $0.03 each in France. Since
 * October 2026 Meta bills the answers in the 24 hours beyond 1 000 a month for the whole number,
 * and utility templates, at the utility rate: at a hundred studios almost all of them are billed.
 * Estimated, not measured: to check against Meta's invoice.
 */
export const WHATSAPP_EUR_PER_POST = 0.22;
/** What no credit pays, per publication: the chat, its readings, and WhatsApp. */
export const UNPRICED_EUR_PER_POST = CHAT_EUR_PER_POST + WHATSAPP_EUR_PER_POST;
/** Publications a month at an offer's weekly rhythm. */
export const postsPerMonth = (plan: PlanId) => (PLANS[plan].postsPerWeek * 52) / 12;
/** The most an offer's month costs: every credit spent, and what no credit pays at its rhythm. It stays under its budget. */
export const monthCostCeiling = (plan: PlanId) => PLANS[plan].credits * EUR_PER_CREDIT_SPENT + postsPerMonth(plan) * UNPRICED_EUR_PER_POST;

/**
 * Typical cost of each priced job in euros, measured in cost_events (23–25 October 2026, the
 * montages since they are metered: Opus 5.5 for the editor, motion and component designers,
 * Sonnet 5.5 for the critic). Update when a model, an effort or a price changes: the tests check
 * the margin of each job at a fixed price, and that a metered one stays under its ceiling.
 */
export const TYPICAL_COST_EUR: Record<keyof typeof CREDIT_PRICES, number> = {
  montage: 0.77, // a new Reel, everything it took: the editor (effort high), its animations, the voice, the hooks' judge, the render and its music
  clip: 0.01, // Gemini Flash watching one clip
  correction: 0.47, // the editor again, the animations it rewrites, the render and its music
  newScene: 0.44, // the motion designer: its code, its sandbox test, its look at the rendered frames and any rewrite
  reusedScene: 0,
  render: 0.1, // Vercel Sandbox in Paris (~€0.05 a render), and the music composed for the cut (ElevenLabs, ~€0.05; kept when the cuts do not move)
  moodboard: 0.06, // Opus reading a few images
  variant: 0.05, // a render (same cut: the music is kept)
  textLayer: 0.4, // the component designer (one or two rounds) and its critic (retired, measured in October)
  elementEdit: 0.2, // one round of the component designer on one component (retired, measured in October)
  carousel: 1.0, // the carousel designer twice (its photos seen, the correction sees its render), the critic, two test renders
  review: 0.03, // the critic watching key frames
  fixRound: 0.26, // the editor, a render with its new music, the critic again
  alternative: 0.23, // the editor and a render with its music
  image: 0.05, // the image model at 2K (about $0.05), with the photo read in
};

/** Jobs charged on what they really cost (meteredCredits keeps their margin): a montage, a correction, and the steps they are made of. */
export const METERED_JOBS: ReadonlySet<keyof typeof CREDIT_PRICES> = new Set(["montage", "clip", "correction", "newScene", "reusedScene", "render", "review", "fixRound", "alternative"]);

/** Margin of one job at a fixed price: 1 − its cost / what its credits are worth (null when it is free or charged on what it really cost). */
export function jobMargin(item: keyof typeof CREDIT_PRICES): number | null {
  const credits = CREDIT_PRICES[item];
  if (!credits || METERED_JOBS.has(item)) return null;
  return 1 - TYPICAL_COST_EUR[item] / (credits * CREDIT_VALUE_EUR);
}

/** cost_events purposes that are the chat itself, not a priced job. */
const CHAT_PURPOSES = new Set(["conversation", "reaction"]);

export type StudioMonth = {
  /** Everything logged this month, in euros. */
  total: number;
  /** The conversation (and Jev's reactions): free for the studio, the largest unpriced cost. */
  chat: number;
  /** Everything else: montages, components, readings, renders. */
  work: number;
  byPurpose: Record<string, number>;
  /** 1 − total / what the plan brings in (VAT and Stripe's fees out). */
  margin: number;
  /** What is left of the month's cost budget before the margin falls under the target. */
  budgetLeft: number;
};

/** A studio's month from its cost_events (purpose and euros), against its plan. */
export function studioMonth(costs: { purpose: string; eur: number }[], plan: PlanId = "pro"): StudioMonth {
  const byPurpose: Record<string, number> = {};
  for (const c of costs) byPurpose[c.purpose] = (byPurpose[c.purpose] ?? 0) + c.eur;
  const total = costs.reduce((sum, c) => sum + c.eur, 0);
  const chat = costs.filter((c) => CHAT_PURPOSES.has(c.purpose)).reduce((sum, c) => sum + c.eur, 0);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    total: round(total),
    chat: round(chat),
    work: round(total - chat),
    byPurpose: Object.fromEntries(Object.entries(byPurpose).map(([k, v]) => [k, round(v)])),
    margin: Math.round((1 - total / netRevenue(plan)) * 1000) / 1000,
    budgetLeft: round(monthlyCostBudget(plan) - total),
  };
}
