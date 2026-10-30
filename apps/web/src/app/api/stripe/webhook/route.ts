import { studioOfCustomer, syncFromCheckout, syncSubscription } from "@/lib/billing/access";
import { verifiedEvent } from "@/lib/billing/stripe-webhook";
import { addPackCredits } from "@/lib/credits";
import { env } from "@/lib/env";
import { tellTeamOnce } from "@/lib/reply-cap";

// Stripe's events (the endpoint set in Stripe › Developers › Webhooks, signing secret in
// STRIPE_WEBHOOK_SECRET): what happened to her payment even when she never comes back to the app.
// A credit pack paid then the tab closed got no credits; a renewal, a failed payment or a
// cancellation in the portal waited for the next 6-hourly read. Each event reads the subscription
// again from Stripe (store in access.ts), so an event out of order or sent twice changes nothing.
// Disputes, refunds and fraud warnings: the team is told.

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);
const RISK_EVENTS: Record<string, string> = {
  "charge.dispute.created": "Un paiement est contesté",
  "charge.refunded": "Un paiement a été remboursé",
  "radar.early_fraud_warning.created": "Alerte de fraude sur un paiement",
};

const text = (v: unknown) => (typeof v === "string" ? v : null);
const idOf = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? text((v as { id: unknown }).id) : null);

export async function POST(request: Request) {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const event = verifiedEvent(await request.text(), request.headers.get("stripe-signature"), secret);
  if (!event) return new Response("Bad signature", { status: 400 });
  const object = event.data.object;

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const studioId = text(object.client_reference_id);
      const sessionId = text(object.id);
      if (studioId && sessionId) {
        const metadata = (object.metadata ?? {}) as Record<string, string>;
        if (object.mode === "payment" && metadata.kind === "credit_pack" && object.payment_status === "paid") {
          // Once per session: her return page adds the same row (credit_ledger_stripe_session_once).
          await addPackCredits(studioId, sessionId, Number(metadata.credits) || 0);
        } else if (object.mode === "subscription") {
          await syncFromCheckout(studioId, sessionId);
        }
      }
    } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const customer = idOf(object.customer);
      const studioId = customer ? await studioOfCustomer(customer) : null;
      if (studioId) await syncSubscription(studioId, { latest: true });
    } else if (RISK_EVENTS[event.type]) {
      const customer = idOf(object.customer);
      const studioId = customer ? await studioOfCustomer(customer) : null;
      const amount = typeof object.amount === "number" ? ` (${(object.amount / 100).toFixed(2).replace(".", ",")} €)` : "";
      await tellTeamOnce(
        `stripe_${event.type}_${idOf(object.id) ?? event.id}`,
        `${RISK_EVENTS[event.type]}${amount}${studioId ? `, studio ${studioId}` : ""}. À voir dans Stripe : ${event.type}, ${idOf(object.id) ?? event.id}.`,
      );
    }
  } catch (error) {
    // Stripe sends it again later (an error here, not a refusal of the event).
    console.error("stripe webhook failed", event.type, event.id, error);
    return new Response("Retry later", { status: 500 });
  }
  return new Response("ok");
}
