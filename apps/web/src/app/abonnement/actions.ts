"use server";

import { planOf, type PlanId } from "@fauve/agent";
import { redirect } from "next/navigation";
import { billingEnabled, checkoutSession, createCustomer, portalSession } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Only a path of this app (no open redirect). */
const safeNext = (next: string) => (/^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : "/fauve");

/** Opens Stripe Checkout for an offer, the card asked: her first subscription starts with its first month at €9. */
export async function startCheckout(plan: PlanId, next: string): Promise<{ error: string } | void> {
  if (!billingEnabled()) return { error: "Le paiement n’est pas encore ouvert." };
  const { member } = await getStudioContext();
  if (!member) return { error: "Reconnecte-toi pour continuer." };
  if (member.role !== "owner") return { error: "Seule la personne qui gère le compte peut s’abonner." };
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("id, name, stripe_customer_id, stripe_subscription_id, starter_until").eq("id", member.studio.id).single();
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
    // Once: never for a studio that had a subscription or its first month already.
    starter: !studio.stripe_subscription_id && !studio.starter_until,
    successUrl: `${base}/abonnement/retour?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(back)}`,
    cancelUrl: `${base}/abonnement?next=${encodeURIComponent(back)}`,
  });
  redirect(url);
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
