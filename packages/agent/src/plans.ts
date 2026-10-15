// The two offers. Each has its price and its monthly credits; a credit is worth
// about the same in both (price / credits), so every job keeps its margin on either.
// Quality over quantity: the credits pay for each Reel to be made with care
// (Soigné: watched and corrected, about 15 to 20 credits) at the rhythm of the
// offer, not for more posts. A studio on trial gets Pro.

export const PLANS = {
  essentiel: { label: "Essentiel", priceEur: 29, credits: 110, postsPerWeek: 2 },
  pro: { label: "Pro", priceEur: 49, credits: 220, postsPerWeek: 3 },
} as const;

export type PlanId = keyof typeof PLANS;

/**
 * About what a Reel made with care costs (Soigné: the montage, its clips, an
 * animation made to measure, the review and one correction), to say what a
 * month of credits holds. Carousels and photos with their texts cost nothing.
 */
export const CARED_REEL_CREDITS = 18;

/** Reels made with care that a month of the offer pays for. */
export const reelsPerMonth = (plan: PlanId) => Math.floor(PLANS[plan].credits / CARED_REEL_CREDITS);

/** The offer of a studio from `studios.plan` (trial and anything unknown: Pro). */
export function planOf(value: unknown): PlanId {
  return value === "essentiel" ? "essentiel" : "pro";
}
