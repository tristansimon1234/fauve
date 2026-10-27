// The two offers, VAT included. Each has its price and its monthly credits, sized so that a
// month keeps the margin once VAT, Stripe's fees, the chat and WhatsApp are paid (margin.ts): a credit is
// worth about the same in both. Quality over quantity: the credits pay for each Reel to be made
// with care at the rhythm of the offer, not for more posts. A studio on trial gets Pro.

export const PLANS = {
  essentiel: { label: "Essentiel", priceEur: 19, credits: 44, postsPerWeek: 1 },
  pro: { label: "Pro", priceEur: 49, credits: 110, postsPerWeek: 3 },
} as const;

export type PlanId = keyof typeof PLANS;

/**
 * About what a Reel made with care costs: its montage (7.6 credits on average since montages are
 * charged on what they cost, 6 to 9, from 22 to 25 October) and one correction (4.7 on average),
 * to say what a month of credits holds. Photos with their texts cost nothing.
 */
export const CARED_REEL_CREDITS = 12;

/** Reels made with care that a month of the offer pays for. */
export const reelsPerMonth = (plan: PlanId) => Math.floor(PLANS[plan].credits / CARED_REEL_CREDITS);

/** « 1 publication soignée par semaine », « 3 publications soignées par semaine ». */
export function weeklyPosts(plan: PlanId): string {
  const n = PLANS[plan].postsPerWeek;
  return n > 1 ? `${n} publications soignées par semaine` : `${n} publication soignée par semaine`;
}

/** The offer of a studio from `studios.plan` (trial and anything unknown: Pro). */
export function planOf(value: unknown): PlanId {
  return value === "essentiel" ? "essentiel" : "pro";
}
