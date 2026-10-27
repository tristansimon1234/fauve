import { offersLine, packLine } from "./plans.ts";

// What a studio may do without paying (Tristan: « tu vas jusqu'au plan et pour le premier il
// faut payer, tu as le choix entre 3 abonnements »). The onboarding goes all the way to the plan
// of her first Reel (her site read, her style, her videos watched, the plan proposed); to make it,
// she picks one of the 3 offers (Découverte at €9, plans.ts). Nothing is made for free. With no
// credits left nothing costly starts, not even watching a video, and the next offer up is proposed.

/** Videos watched (Gemini) before a subscription: enough to propose the plan of her first Reel. */
export const FREE_ANALYSES = 8;

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "unpaid" | "canceled" | "incomplete" | "incomplete_expired" | "paused";

export function isSubscribed(status: string | null | undefined): boolean {
  return status === "trialing" || status === "active";
}

export type AccessInput = {
  subscription: string | null | undefined;
  credits: number;
  /** Videos already watched for her. */
  analyses: number;
};

export type Access = {
  subscribed: boolean;
  /** Make something costly (montage, images, texts on photos, designs…). */
  create: boolean;
  /** Watch one more video. */
  analyze: boolean;
  /** See the finished work in full, download it, publish it. */
  unlock: boolean;
  /** Why not, in her words, when something is refused. */
  reason: "subscribe" | "credits" | null;
};

export function accessOf(input: AccessInput): Access {
  const subscribed = isSubscribed(input.subscription);
  if (subscribed) {
    const credits = input.credits > 0;
    return { subscribed, create: credits, analyze: credits, unlock: true, reason: credits ? null : "credits" };
  }
  // Before paying: up to the plan of her first Reel, nothing made.
  return {
    subscribed,
    create: false,
    analyze: input.analyses < FREE_ANALYSES,
    unlock: false,
    reason: "subscribe",
  };
}

/** What Edith says when something is refused. */
export function accessMessage(reason: Access["reason"]): string {
  return reason === "credits"
    ? `Plus de crédits pour l'instant : rien de nouveau ne peut partir. Propose-lui « ${packLine()} » (paiement unique, ses crédits arrivent aussitôt) ou de passer à l'offre au-dessus (la différence au prorata), tous deux sur la page /abonnement ; sinon ses crédits reviennent au renouvellement de son abonnement. Dis-le-lui simplement, sans rien lancer.`
    : `Pas encore abonnée : tout est prêt jusqu'au plan de son Reel, mais rien n'est fabriqué avant l'abonnement (${offersLine()} : Découverte 3 Reels, Essentiel, Pro ; sans engagement). Dis-le-lui simplement et donne le lien de l'abonnement (page /abonnement), sans rien lancer : dès qu'elle est abonnée, lance le plan qu'elle a validé sans le lui redemander.`;
}
