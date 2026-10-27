// The two offers, VAT included. Each has its price and its monthly credits, sized so that a
// month keeps the margin once VAT, Stripe's fees, the chat and WhatsApp are paid (margin.ts): a credit is
// worth about the same in both. Quality over quantity: the credits pay for each Reel to be made
// with care at the rhythm of the offer, not for more posts. A studio not subscribed yet counts as Pro (its onboarding).

export const PLANS = {
  /** The way in (Tristan: « 9 euros », « 3 réels », « il faut laisser à 9 »): 3 Reels made with care a month, at €9 every month. */
  decouverte: { label: "Découverte", priceEur: 9, credits: 36, postsPerWeek: 0.75 },
  essentiel: { label: "Essentiel", priceEur: 19, credits: 44, postsPerWeek: 1 },
  pro: { label: "Pro", priceEur: 49, credits: 110, postsPerWeek: 3 },
} as const;

/** The offers from the smallest: a studio with no credits left is offered the next one up. */
export const PLAN_ORDER = ["decouverte", "essentiel", "pro"] as const;

export type PlanId = keyof typeof PLANS;

/**
 * About what a Reel made with care costs: its montage (7.6 credits on average since montages are
 * charged on what they cost, 6 to 9, from 22 to 25 October) and one correction (4.7 on average),
 * to say what a month of credits holds. Photos with their texts cost nothing.
 */
export const CARED_REEL_CREDITS = 12;

/** Reels made with care that a month of the offer pays for. */
export const reelsPerMonth = (plan: PlanId) => Math.floor(PLANS[plan].credits / CARED_REEL_CREDITS);

/** « 3 Reels soignés par mois », « 1 publication soignée par semaine », « 3 publications soignées par semaine ». */
export function weeklyPosts(plan: PlanId): string {
  const n = PLANS[plan].postsPerWeek;
  if (n < 1) return `${reelsPerMonth(plan)} Reels soignés par mois`;
  return n > 1 ? `${n} publications soignées par semaine` : `${n} publication soignée par semaine`;
}

/** The offer of a studio from `studios.plan` (none yet, or anything unknown: Pro, the onboarding's). */
export function planOf(value: unknown): PlanId {
  return value === "essentiel" || value === "decouverte" ? value : "pro";
}

/** The offer above hers, to suggest when her credits run out; none above Pro. */
export function nextPlan(plan: PlanId): PlanId | null {
  return PLAN_ORDER[PLAN_ORDER.indexOf(plan) + 1] ?? null;
}

/**
 * More credits before her renewal, whatever her offer (Pro included): about one more Reel made with care,
 * paid once by card (Stripe Checkout in payment mode). Left over at her renewal, they carry over once.
 */
export const CREDIT_PACK = { label: "1 Reel de plus", credits: CARED_REEL_CREDITS, priceEur: 5 } as const;

/** « 1 Reel de plus : 12 crédits pour 5 € » */
export const packLine = () => `${CREDIT_PACK.label} : ${CREDIT_PACK.credits} crédits pour ${CREDIT_PACK.priceEur} €`;

/** « 3 abonnements au choix, dès 9 € par mois » */
export const offersLine = () => `${PLAN_ORDER.length} abonnements au choix, dès ${PLANS[PLAN_ORDER[0]].priceEur} € par mois`;
