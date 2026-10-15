import "server-only";
import { PLANS, TRIAL_DAYS, type PlanId } from "@fauve/agent";
import { env } from "@/lib/env";

// Stripe over its REST API (form-encoded), no SDK: products and prices found by
// lookup key (created on first use), Checkout in subscription mode with a 3-day
// trial (the card is always collected), the customer portal to change or cancel.
// No webhook: the subscription is read back from Stripe (lib/billing/access.ts).

const API = "https://api.stripe.com/v1";

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

export async function stripe<T>(method: "GET" | "POST", path: string, params: Params = {}): Promise<T> {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new StripeError("Stripe is not configured");
  const body = encode(params);
  const url = method === "GET" && body.size ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe ${res.status}`);
  return json;
}

const lookupKey = (plan: PlanId) => `simone_${plan}_monthly`;

const prices = new Map<PlanId, string>();

/** The monthly price of an offer, created in Stripe the first time it is needed. */
export async function priceFor(plan: PlanId): Promise<string> {
  const known = prices.get(plan);
  if (known) return known;
  const found = await stripe<{ data: { id: string }[] }>("GET", "/prices", { "lookup_keys[]": lookupKey(plan), active: true });
  let id = found.data[0]?.id;
  if (!id) {
    const product = await stripe<{ id: string }>("POST", "/products", { name: `Simone ${PLANS[plan].label}` });
    const price = await stripe<{ id: string }>("POST", "/prices", {
      product: product.id,
      currency: "eur",
      unit_amount: PLANS[plan].priceEur * 100,
      recurring: { interval: "month" },
      lookup_key: lookupKey(plan),
      tax_behavior: "inclusive",
    });
    id = price.id;
  }
  prices.set(plan, id);
  return id;
}

/** The offer a Stripe price stands for. */
export async function planOfPrice(priceId: string | undefined): Promise<PlanId | null> {
  if (!priceId) return null;
  for (const plan of Object.keys(PLANS) as PlanId[]) if ((await priceFor(plan)) === priceId) return plan;
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

/** Checkout for an offer, with the trial and the card always asked. */
export async function checkoutSession(input: { customer: string; plan: PlanId; studioId: string; successUrl: string; cancelUrl: string }): Promise<string> {
  const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    customer: input.customer,
    client_reference_id: input.studioId,
    line_items: [{ price: await priceFor(input.plan), quantity: 1 }],
    subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { studio_id: input.studioId } },
    payment_method_collection: "always",
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
  items: { data: { price: { id: string } }[] };
};

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

export async function portalSession(customer: string, returnUrl: string): Promise<string> {
  const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", { customer, return_url: returnUrl, locale: "fr" });
  return session.url;
}
