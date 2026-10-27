import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// OAuth "state" that carries the studio itself, signed. On a phone the flow
// starts in WhatsApp's in-app browser (where the manager is signed in) but
// Instagram often hands back to Safari or Chrome, which has no session and no
// cookie: the callback must not depend on either. Each state works once (its
// nonce is kept in oauth_states and burnt by the callback): a consent link that
// went around cannot link another account to the studio afterwards.

const TTL_MS = 15 * 60_000;

type StatePayload = { studioId: string; memberId: string; exp: number; nonce: string };

const sign = (data: string) =>
  createHmac("sha256", `fauve-oauth-state:${env("INSTAGRAM_APP_SECRET")}`).update(data).digest("base64url");

export async function createOAuthState(studioId: string, memberId: string): Promise<string> {
  const payload: StatePayload = { studioId, memberId, exp: Date.now() + TTL_MS, nonce: randomBytes(16).toString("base64url") };
  const db = supabaseAdmin();
  const { error } = await db.from("oauth_states").insert({ nonce: payload.nonce, expires_at: new Date(payload.exp).toISOString() });
  if (error) throw new Error(`oauth_states: ${error.message}`);
  // The day-old ones go: a few rows at most.
  await db.from("oauth_states").delete().lt("expires_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

/** The state's studio and member, once: its nonce is burnt here, and a second use reads as expired. */
export async function consumeOAuthState(state: string | null): Promise<StatePayload | null> {
  const payload = readOAuthState(state);
  if (!payload) return null;
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin()
    .from("oauth_states")
    .update({ used_at: now })
    .eq("nonce", payload.nonce)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("nonce");
  return data?.length ? payload : null;
}

function readOAuthState(state: string | null): StatePayload | null {
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
