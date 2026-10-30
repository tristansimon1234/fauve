import { timingSafeEqual } from "node:crypto";
import { PLAN_ORDER, PLANS } from "@fauve/agent";
import { offerPrice, stripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

// Puts the 3 offers in Stripe's catalogue now rather than at the first Checkout (each one found by
// its lookup key, created if missing, offerPrice), and checks the key can write products and
// prices, and read invoices (« Mes factures »): POST with CRON_SECRET (Authorization: Bearer …), from the base with call_app. Says
// whether Stripe is in live mode; a Stripe error comes back without any key in it.

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const withoutKeys = (message: string) => message.replace(/\b(sk|rk|pk)_(live|test)_[\w*]+/g, "[clé]");

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  try {
    const offers = [];
    for (const plan of PLAN_ORDER) {
      const price = await offerPrice(plan);
      offers.push({ plan, label: PLANS[plan].label, eur: (price.unit_amount ?? 0) / 100, price: price.id, product: price.product, live: price.livemode ?? null });
    }
    const invoices = await stripe("GET", "/invoices", { limit: 1 }).then(
      () => "ok",
      (error: unknown) => withoutKeys(error instanceof Error ? error.message : String(error)),
    );
    return Response.json({ ok: true, offers, invoices });
  } catch (error) {
    return Response.json({ ok: false, error: withoutKeys(error instanceof Error ? error.message : String(error)) }, { status: 502 });
  }
}
