import { CREDIT_PRICES } from "./credits.ts";
import { PLANS, type PlanId } from "./plans.ts";

// What a studio costs against what it pays: its plan's price, the share kept as
// margin, and what a credit is worth. Every priced job must cost at most half of
// what its credits are worth (on the plan where a credit is worth least), and a
// studio's whole month (work, chat, everything logged in cost_events) at most half of its plan.

/** Pro's monthly price, in euros. */
export const PLAN_PRICE_EUR = PLANS.pro.priceEur;
/** Share of the price kept, at least: costs stay under the other half. */
export const TARGET_MARGIN = 0.5;
/** What one credit is worth to a studio on a plan: the plan spread over its month's credits. */
export const creditValue = (plan: PlanId) => PLANS[plan].priceEur / PLANS[plan].credits;
/** What one credit is worth at least, whatever the plan: the margin of every job is checked against it. */
export const CREDIT_VALUE_EUR = Math.min(...(Object.keys(PLANS) as PlanId[]).map(creditValue));
/** The most a studio's month may cost (AI, render…) while keeping the margin. */
export const monthlyCostBudget = (plan: PlanId) => PLANS[plan].priceEur * (1 - TARGET_MARGIN);
/** Pro's month budget. */
export const MONTHLY_COST_BUDGET_EUR = monthlyCostBudget("pro");

/**
 * Typical cost of each priced job in euros, measured in cost_events (October 2026 prices:
 * Opus 5.5 for the editor, motion and component designers, Sonnet 5.5 for the critic).
 * Update when a model, an effort or a price changes: the test checks the margin of each.
 */
export const TYPICAL_COST_EUR: Record<keyof typeof CREDIT_PRICES, number> = {
  montage: 0.06, // the editor, effort high
  clip: 0.01, // Gemini Flash watching one clip
  correction: 0.06, // the editor again
  newScene: 0.11, // the motion designer, with its sandbox test
  reusedScene: 0,
  render: 0.06, // Vercel Sandbox in Paris (~€0.01 a minute), and the music composed for the cut (ElevenLabs, ~€0.04 for 20 s)
  moodboard: 0.06, // Opus reading a few images
  variant: 0.02, // a render (same cut: the music is kept)
  textLayer: 0.4, // the component designer (one or two rounds) and its critic
  elementEdit: 0.2, // one round of the component designer on one component
  review: 0.03, // the critic watching key frames
  fixRound: 0.15, // the editor, a render with its new music, the critic again
  alternative: 0.12, // the editor and a render with its music
  image: 0.05, // the image model at 2K (about $0.05), with the photo read in
};

/** Margin of one priced job: 1 − its cost / what its credits are worth (null when it is free). */
export function jobMargin(item: keyof typeof CREDIT_PRICES): number | null {
  const credits = CREDIT_PRICES[item];
  if (!credits) return null;
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
  /** 1 − total / plan price. */
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
    margin: Math.round((1 - total / PLANS[plan].priceEur) * 1000) / 1000,
    budgetLeft: round(monthlyCostBudget(plan) - total),
  };
}
