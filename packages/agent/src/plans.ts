// The two offers. Each has its price and its monthly credits; a credit is worth
// about the same in both (price / credits), so every job keeps its margin on either.
// A studio on trial gets Pro.

export const PLANS = {
  essentiel: { label: "Essentiel", priceEur: 29, credits: 80, postsPerWeek: 2 },
  pro: { label: "Pro", priceEur: 49, credits: 150, postsPerWeek: 3 },
} as const;

export type PlanId = keyof typeof PLANS;

/** The offer of a studio from `studios.plan` (trial and anything unknown: Pro). */
export function planOf(value: unknown): PlanId {
  return value === "essentiel" ? "essentiel" : "pro";
}
