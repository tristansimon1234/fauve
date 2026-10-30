import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe's webhook signature (« Stripe-Signature: t=…,v1=… »), checked without the SDK: an HMAC
// SHA-256 of « t.body » with the endpoint's signing secret, any v1 matching, and a timestamp within
// five minutes so an old event cannot be replayed.

const TOLERANCE_S = 300;

export type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/** The event when the signature holds, null otherwise. */
export function verifiedEvent(body: string, header: string | null, secret: string, now = Date.now()): StripeEvent | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !signatures.length || Math.abs(now / 1000 - t) > TOLERANCE_S) return null;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  const matches = signatures.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) return null;
  try {
    const event = JSON.parse(body) as StripeEvent;
    return typeof event?.type === "string" && event.data?.object ? event : null;
  } catch {
    return null;
  }
}
