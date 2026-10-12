import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// OAuth "state" that carries the studio itself, signed. On a phone the flow
// starts in WhatsApp's in-app browser (where the manager is signed in) but
// Instagram often hands back to Safari or Chrome, which has no session and no
// cookie: the callback must not depend on either.

const TTL_MS = 15 * 60_000;

type StatePayload = { studioId: string; memberId: string; exp: number; nonce: string };

const sign = (data: string) =>
  createHmac("sha256", `fauve-oauth-state:${env("INSTAGRAM_APP_SECRET")}`).update(data).digest("base64url");

export function createOAuthState(studioId: string, memberId: string): string {
  const payload: StatePayload = { studioId, memberId, exp: Date.now() + TTL_MS, nonce: randomBytes(9).toString("base64url") };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function readOAuthState(state: string | null): StatePayload | null {
  const [data, mac] = state?.split(".") ?? [];
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as StatePayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
