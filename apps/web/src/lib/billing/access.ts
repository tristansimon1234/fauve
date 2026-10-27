import "server-only";
import { accessMessage, accessOf, isSubscribed, type Access } from "@fauve/agent";
import { creditBalance } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { billingEnabled, getSubscription, latestSubscription, planOfPrice, sessionSubscription, type StripeSubscription } from "./stripe";

// What a studio may do now (packages/agent/src/access.ts), from its subscription
// (read back from Stripe when it may have changed), its first publication and
// its credits. Without Stripe configured, billing is off and everything is open.

const RESYNC_MS = 6 * 3600_000;

export class AccessError extends Error {
  constructor(readonly access: Access) {
    super(accessMessage(access.reason));
  }
}

/** Writes what Stripe says of her subscription on the studio. */
async function store(studioId: string, customer: string | null, subscription: StripeSubscription | null) {
  const price = subscription?.items.data[0]?.price.id;
  const plan = await planOfPrice(price).catch(() => null);
  await supabaseAdmin()
    .from("studios")
    .update({
      ...(customer ? { stripe_customer_id: customer } : {}),
      stripe_subscription_id: subscription?.id ?? null,
      subscription_status: subscription?.status ?? null,
      trial_ends_at: subscription?.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      subscription_synced_at: new Date().toISOString(),
      ...(plan ? { plan } : {}),
    })
    .eq("id", studioId);
}

/** Her return from Checkout: the subscription it made, kept on her studio. */
export async function syncFromCheckout(studioId: string, sessionId: string): Promise<boolean> {
  const { customer, subscription, studioId: owner } = await sessionSubscription(sessionId);
  if (owner !== studioId) return false;
  await store(studioId, customer, subscription);
  return isSubscribed(subscription?.status);
}

/** Reads her subscription back from Stripe. */
export async function syncSubscription(studioId: string): Promise<void> {
  const { data: studio } = await supabaseAdmin().from("studios").select("stripe_customer_id, stripe_subscription_id").eq("id", studioId).single();
  const customer = studio?.stripe_customer_id as string | null | undefined;
  if (!customer) return;
  const id = studio?.stripe_subscription_id as string | null | undefined;
  const subscription = id ? await getSubscription(id) : await latestSubscription(customer);
  await store(studioId, customer, subscription);
}

export async function studioAccess(studioId: string): Promise<Access> {
  if (!billingEnabled()) return { subscribed: true, create: true, analyze: true, unlock: true, reason: null };
  const db = supabaseAdmin();
  let { data: studio } = await db
    .from("studios")
    .select("stripe_customer_id, subscription_status, trial_ends_at, subscription_synced_at")
    .eq("id", studioId)
    .single();
  // A trial that ended or a payment that failed may have changed since: read Stripe again.
  const stale =
    studio?.stripe_customer_id &&
    (!studio.subscription_synced_at ||
      Date.now() - new Date(studio.subscription_synced_at as string).getTime() > RESYNC_MS ||
      (studio.subscription_status === "trialing" && studio.trial_ends_at && new Date(studio.trial_ends_at as string).getTime() < Date.now()));
  if (stale) {
    await syncSubscription(studioId).catch((error) => console.warn("subscription sync failed", studioId, error));
    ({ data: studio } = await db.from("studios").select("stripe_customer_id, subscription_status, trial_ends_at, subscription_synced_at").eq("id", studioId).single());
  }
  const [credits, { count: made }, { count: analyses }] = await Promise.all([
    creditBalance(studioId),
    db.from("posts").select("id", { count: "exact", head: true }).eq("studio_id", studioId).or("edit_plan_id.not.is.null,slides_render.not.is.null"),
    db.from("clip_analyses").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
  ]);
  return accessOf({ subscription: studio?.subscription_status as string | null, firstPostMade: Boolean(made), credits, analyses: analyses ?? 0 });
}

/** Throws AccessError (its message tells Edith what to say) when nothing costly may start. */
export async function assertCanCreate(studioId: string): Promise<void> {
  const access = await studioAccess(studioId);
  if (!access.create) throw new AccessError(access);
}

/** What Edith knows of the subscription at each turn. */
export async function accessLine(studioId: string): Promise<string | null> {
  if (!billingEnabled()) return null;
  const access = await studioAccess(studioId);
  if (access.subscribed) return access.create ? null : `Abonnement : ${accessMessage("credits")}`;
  return access.create
    ? "Abonnement : pas encore abonnée. Sa première publication est offerte (c'est l'essai de l'onboarding) ; ensuite, la voir en entier et la publier demande l'abonnement (3 jours d'essai offerts, page /abonnement)."
    : `Abonnement : ${accessMessage("subscribe")}`;
}
