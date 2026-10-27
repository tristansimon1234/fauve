"use server";

import { PLAN_ORDER, planOf, type PlanId } from "@fauve/agent";
import { redirect } from "next/navigation";
import { launchPendingCreation } from "@/app/(app)/create-actions";
import { syncSubscription } from "@/lib/billing/access";
import { billingEnabled, checkoutSession, createCustomer, portalSession, StripeError, switchPlan } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Only a path of this app (no open redirect). */
const safeNext = (next: string) => (/^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : "/fauve");

/** Opens Stripe Checkout for one of the 3 offers, the card asked (no trial). */
export async function startCheckout(plan: PlanId, next: string): Promise<{ error: string } | void> {
  if (!billingEnabled()) return { error: "Le paiement n’est pas encore ouvert." };
  const { member } = await getStudioContext();
  if (!member) return { error: "Reconnecte-toi pour continuer." };
  if (member.role !== "owner") return { error: "Seule la personne qui gère le compte peut s’abonner." };
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("id, name, stripe_customer_id").eq("id", member.studio.id).single();
  if (!studio) return { error: "Studio introuvable." };
  let customer = studio.stripe_customer_id as string | null;
  if (!customer) {
    customer = await createCustomer({ id: studio.id as string, name: studio.name as string | null, phone: member.phone_e164 });
    await db.from("studios").update({ stripe_customer_id: customer }).eq("id", studio.id);
  }
  const back = safeNext(next);
  const base = env("APP_URL");
  const url = await checkoutSession({
    customer,
    plan: planOf(plan),
    studioId: studio.id as string,
    successUrl: `${base}/abonnement/retour?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(back)}`,
    cancelUrl: `${base}/abonnement?next=${encodeURIComponent(back)}`,
  });
  redirect(url);
}

/**
 * Her credits ran out: her subscription moves to an offer above hers at once (the difference for
 * the rest of the month is charged on her card), and the extra credits are there right away.
 */
export async function upgradePlan(plan: PlanId): Promise<{ error: string } | { ok: true }> {
  if (!billingEnabled()) return { error: "Le paiement n’est pas encore ouvert." };
  const { member } = await getStudioContext();
  if (!member) return { error: "Reconnecte-toi pour continuer." };
  if (member.role !== "owner") return { error: "Seule la personne qui gère le compte peut changer d’offre." };
  const { data: studio } = await supabaseAdmin().from("studios").select("plan, stripe_subscription_id").eq("id", member.studio.id).single();
  const id = studio?.stripe_subscription_id as string | null | undefined;
  if (!id) return { error: "Pas encore d’abonnement." };
  const target = planOf(plan);
  if (PLAN_ORDER.indexOf(target) <= PLAN_ORDER.indexOf(planOf(studio?.plan))) return { error: "Choisis une offre au-dessus de la tienne." };
  try {
    await switchPlan(id, target);
  } catch (error) {
    console.warn("upgrade failed", error instanceof StripeError ? error.message : error);
    return { error: "Le paiement n’est pas passé. Vérifie ta carte dans « Gérer mon abonnement », puis réessaie." };
  }
  await syncSubscription(member.studio.id);
  // What she launched from « Créer » with no credits left starts now.
  await launchPendingCreation().catch((error) => console.error("pending creation not launched", error));
  return { ok: true };
}

/** The Stripe portal: change the offer, the card, or stop. */
export async function openPortal(): Promise<{ error: string } | void> {
  const { member } = await getStudioContext();
  if (!member) return { error: "Reconnecte-toi pour continuer." };
  const { data: studio } = await supabaseAdmin().from("studios").select("stripe_customer_id").eq("id", member.studio.id).single();
  const customer = studio?.stripe_customer_id as string | null | undefined;
  if (!customer) return { error: "Pas encore d’abonnement." };
  redirect(await portalSession(customer, `${env("APP_URL")}/reglages`));
}
