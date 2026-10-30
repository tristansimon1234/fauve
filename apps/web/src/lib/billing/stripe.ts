import "server-only";
import { CREDIT_PACK, PLANS, type PlanId } from "@fauve/agent";
import { env } from "@/lib/env";

// Stripe over its REST API (form-encoded), no SDK: products and prices found by
// lookup key (created on first use), Checkout in subscription mode (no trial: one
// of the 3 offers, Découverte at €9 the smallest), a switch to the offer above when
// her credits run out, a credit pack paid once (Checkout in payment mode), the customer
// portal to change or cancel. Her subscription is read back from Stripe (lib/billing/access.ts),
// at once when Stripe tells us something changed (webhook, app/api/stripe/webhook/route.ts).

const API = "https://api.stripe.com/v1";
/**
 * Every call on this API version, whatever the account's default (« fixe », Tristan). Checked
 * against its changelog for the calls below (October 2026): periods on subscription items (read by
 * paidPeriod), flexible billing mode by default, no payment_method_types on Checkout (never sent).
 * The webhook endpoint is created on the same version.
 */
export const STRIPE_API_VERSION = "2026-10-28.endive";

export const billingEnabled = () => Boolean(env("STRIPE_SECRET_KEY"));

interface Params {
  [key: string]: string | number | boolean | undefined | Params | (string | Params)[];
}

/** Stripe's form encoding: a[b][0][c]=… */
function encode(params: Params, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => (typeof item === "object" ? encode(item, `${name}[${i}]`, out) : out.append(`${name}[]`, String(item))));
    } else if (typeof value === "object") {
      encode(value, name, out);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

export class StripeError extends Error {}

export async function stripe<T>(method: "GET" | "POST" | "DELETE", path: string, params: Params = {}): Promise<T> {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new StripeError("Stripe is not configured");
  const body = encode(params);
  const url = method === "GET" && body.size ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe ${res.status}`);
  return json;
}

const lookupKey = (plan: PlanId) => `simone_${plan}_monthly`;

type StripePrice = { id: string; unit_amount: number | null; product: string; livemode?: boolean };

const prices = new Map<PlanId, StripePrice>();

/**
 * The monthly price of an offer, created in Stripe the first time it is needed. When the offer's
 * price changed, a new price on its product takes the lookup key: new subscriptions pay the new
 * amount, the ones already running keep theirs.
 */
export async function offerPrice(plan: PlanId): Promise<StripePrice> {
  const known = prices.get(plan);
  if (known) return known;
  const found = await stripe<{ data: StripePrice[] }>("GET", "/prices", { "lookup_keys[]": lookupKey(plan), active: true });
  const old = found.data[0];
  const price =
    old?.unit_amount === PLANS[plan].priceEur * 100
      ? old
      : await stripe<StripePrice>("POST", "/prices", {
          product: old?.product ?? (await stripe<{ id: string }>("POST", "/products", { name: `Edith ${PLANS[plan].label}` })).id,
          currency: "eur",
          unit_amount: PLANS[plan].priceEur * 100,
          recurring: { interval: "month" },
          lookup_key: lookupKey(plan),
          transfer_lookup_key: old ? true : undefined,
          tax_behavior: "inclusive",
        });
  prices.set(plan, price);
  return price;
}

export const priceFor = async (plan: PlanId) => (await offerPrice(plan)).id;

/** The offer a Stripe price stands for: its current price, or an older one of the same product (before its price changed). */
export async function planOfPrice(priceId: string | undefined): Promise<PlanId | null> {
  if (!priceId) return null;
  const plans = Object.keys(PLANS) as PlanId[];
  for (const plan of plans) if ((await offerPrice(plan)).id === priceId) return plan;
  const { product } = await stripe<StripePrice>("GET", `/prices/${encodeURIComponent(priceId)}`);
  for (const plan of plans) if ((await offerPrice(plan)).product === product) return plan;
  return null;
}

export async function createCustomer(studio: { id: string; name: string | null; phone: string | null }): Promise<string> {
  const customer = await stripe<{ id: string }>("POST", "/customers", {
    name: studio.name ?? undefined,
    phone: studio.phone ?? undefined,
    metadata: { studio_id: studio.id },
  });
  return customer.id;
}

/**
 * A professional's invoice in France names her business and its address (and its VAT number when it
 * has one): Checkout asks for them and keeps them on her Stripe customer, for every invoice after.
 */
const B2B_DETAILS = {
  billing_address_collection: "required",
  tax_id_collection: { enabled: true },
  customer_update: { name: "auto", address: "auto" },
} satisfies Params;

/** Checkout for an offer, the card always asked. */
export async function checkoutSession(input: { customer: string; plan: PlanId; studioId: string; successUrl: string; cancelUrl: string }): Promise<string> {
  const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    customer: input.customer,
    client_reference_id: input.studioId,
    line_items: [{ price: await priceFor(input.plan), quantity: 1 }],
    subscription_data: { metadata: { studio_id: input.studioId } },
    payment_method_collection: "always",
    ...B2B_DETAILS,
    locale: "fr",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  return session.url;
}

export type StripeSubscription = {
  id: string;
  status: string;
  trial_end: number | null;
  /** Before API 2025-03-31 the period is on the subscription, since then on each item. */
  current_period_start?: number;
  current_period_end?: number;
  items: { data: { id: string; price: { id: string }; current_period_start?: number; current_period_end?: number }[] };
};

/** The paid period her credits belong to: its start (the key of its top-up) and its end (her renewal). */
export function paidPeriod(subscription: StripeSubscription): { key: string; endsAt: string } | null {
  const item = subscription.items.data[0];
  const start = item?.current_period_start ?? subscription.current_period_start;
  const end = item?.current_period_end ?? subscription.current_period_end;
  if (!start || !end) return null;
  return { key: `period:${new Date(start * 1000).toISOString()}`, endsAt: new Date(end * 1000).toISOString() };
}

/** Checkout for a credit pack, paid once; its credits are added on her return (packSession). */
export async function packCheckout(input: { customer: string; studioId: string; successUrl: string; cancelUrl: string }): Promise<string> {
  const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "payment",
    customer: input.customer,
    client_reference_id: input.studioId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: CREDIT_PACK.priceEur * 100,
          tax_behavior: "inclusive",
          product_data: { name: `Edith : ${CREDIT_PACK.label} (${CREDIT_PACK.credits} crédits)` },
        },
      },
    ],
    metadata: { studio_id: input.studioId, kind: "credit_pack", credits: CREDIT_PACK.credits },
    invoice_creation: { enabled: true },
    ...B2B_DETAILS,
    locale: "fr",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  return session.url;
}

/** A credit pack's Checkout session: whose it is, whether it is paid, and its credits. */
export async function packSession(sessionId: string): Promise<{ studioId: string | null; paid: boolean; credits: number }> {
  const session = await stripe<{ client_reference_id: string | null; payment_status: string; mode: string; metadata: Record<string, string> | null }>(
    "GET",
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
  );
  const pack = session.mode === "payment" && session.metadata?.kind === "credit_pack";
  return { studioId: session.client_reference_id, paid: pack && session.payment_status === "paid", credits: pack ? Number(session.metadata?.credits) || 0 : 0 };
}

/**
 * Her subscription moved to another offer at once: the difference for the rest of the period is
 * invoiced now (prorated) and must be paid for the change to hold; her credits follow (store in access.ts).
 */
export async function switchPlan(subscriptionId: string, plan: PlanId): Promise<StripeSubscription> {
  const current = await getSubscription(subscriptionId);
  const item = current.items.data[0];
  if (!item) throw new StripeError("subscription without item");
  return stripe<StripeSubscription>("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    items: [{ id: item.id, price: await priceFor(plan) }],
    proration_behavior: "always_invoice",
    payment_behavior: "error_if_incomplete",
  });
}

export async function sessionSubscription(sessionId: string): Promise<{ customer: string; subscription: StripeSubscription | null; studioId: string | null }> {
  const session = await stripe<{ customer: string; client_reference_id: string | null; subscription: StripeSubscription | string | null }>(
    "GET",
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { "expand[]": "subscription" },
  );
  const subscription = typeof session.subscription === "object" ? session.subscription : null;
  return { customer: session.customer, subscription, studioId: session.client_reference_id };
}

export async function getSubscription(id: string): Promise<StripeSubscription> {
  return stripe<StripeSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`);
}

/** Her latest subscription, when we lost track of its id. */
export async function latestSubscription(customer: string): Promise<StripeSubscription | null> {
  const list = await stripe<{ data: StripeSubscription[] }>("GET", "/subscriptions", { customer, status: "all", limit: 1 });
  return list.data[0] ?? null;
}

/** Stops a subscription at once (her account deleted): nothing more is charged. */
export async function cancelSubscription(id: string): Promise<void> {
  await stripe("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
}

export async function portalSession(customer: string, returnUrl: string): Promise<string> {
  const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", { customer, return_url: returnUrl, locale: "fr" });
  return session.url;
}
