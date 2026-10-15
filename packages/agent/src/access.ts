// What a studio may do without paying. The onboarding goes all the way to her
// first publication (the Reel is made in full); to see it, publish it or make
// anything else, she subscribes (3 days of trial, card asked, Stripe). And with
// no credits left nothing costly starts, not even watching a video.

export const TRIAL_DAYS = 3;
/** Videos watched (Gemini) before a subscription: enough for the first Reel. */
export const FREE_ANALYSES = 8;

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "unpaid" | "canceled" | "incomplete" | "incomplete_expired" | "paused";

export function isSubscribed(status: string | null | undefined): boolean {
  return status === "trialing" || status === "active";
}

export type AccessInput = {
  subscription: string | null | undefined;
  /** Her first publication has been made (a montage or photos with their texts). */
  firstPostMade: boolean;
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
  // Before paying: the onboarding's first publication only.
  const free = !input.firstPostMade;
  return {
    subscribed,
    create: free,
    analyze: free && input.analyses < FREE_ANALYSES,
    unlock: false,
    reason: "subscribe",
  };
}

/** What Simone says when something is refused. */
export function accessMessage(reason: Access["reason"]): string {
  return reason === "credits"
    ? "Plus de crédits ce mois-ci : rien de nouveau ne peut partir. Ils reviennent le 1er du mois ; en attendant, dis-le-lui simplement, sans rien lancer."
    : "Pas encore abonnée : sa première publication est faite, la suite (la voir en entier, la publier, en faire d'autres) se débloque avec l'abonnement, 3 jours d'essai offerts. Dis-le-lui simplement et donne le lien de l'abonnement (page /abonnement), sans rien lancer.";
}
