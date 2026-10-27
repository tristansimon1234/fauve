import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Starting (or signing in) on a computer, like WhatsApp Web: the screen shows a
// QR code that opens WhatsApp with a short code already written; the message the
// manager sends proves her number, and the screen opens her session. No SMS and
// no Meta template: the message comes from her. The screen holds a secret
// (cookie), so only the browser that asked can use the session.

/** No 0/O, 1/I/L: read and typed without doubt. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TTL_MS = 15 * 60_000;
export const PAIR_COOKIE = "fauve_pair";

/** The code in a WhatsApp message (« Code : K7P2QX »), in any case. */
const CODE_IN_TEXT = /\b(?:code|connexion)\s*[:：]?\s*([A-HJ-KM-NP-Z2-9]{6})\b/i;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export function pairingMessage(code: string): string {
  return `Bonjour Edith ! Code : ${code}`;
}

/** A new request: its code (in the message) and its secret (kept by the browser, `id.secret`). */
export async function createPairing(): Promise<{ code: string; cookie: string }> {
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const secret = randomBytes(24).toString("base64url");
    const { data, error } = await db
      .from("pairing_requests")
      .insert({ code, secret_hash: hash(secret), expires_at: new Date(Date.now() + TTL_MS).toISOString() })
      .select("id")
      .single();
    if (!error) return { code, cookie: `${data.id}.${secret}` };
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("pairing: no free code");
}

/** A message with a waiting code: the number that sent it is attached. True if it was one. */
export async function claimPairing(text: string | null | undefined, phoneE164: string): Promise<boolean> {
  const code = text?.match(CODE_IN_TEXT)?.[1]?.toUpperCase();
  if (!code) return false;
  const { data } = await supabaseAdmin()
    .from("pairing_requests")
    .update({ phone_e164: phoneE164, claimed_at: new Date().toISOString() })
    .eq("code", code)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  return Boolean(data?.length);
}

function parseCookie(cookie: string | undefined): { id: string; secret: string } | null {
  const [id, secret] = cookie?.split(".") ?? [];
  return id && secret && /^[0-9a-f-]{36}$/.test(id) ? { id, secret } : null;
}

/** Where the browser's request is: waiting for the message, ready to sign in, or gone. */
export async function pairingState(cookie: string | undefined): Promise<"waiting" | "ready" | "expired"> {
  const parsed = parseCookie(cookie);
  if (!parsed) return "expired";
  const { data } = await supabaseAdmin().from("pairing_requests").select("secret_hash, phone_e164, used_at, expires_at").eq("id", parsed.id).maybeSingle();
  if (!data || data.secret_hash !== hash(parsed.secret) || data.used_at) return "expired";
  if (data.phone_e164) return "ready";
  return new Date(data.expires_at as string) > new Date() ? "waiting" : "expired";
}

/** Uses the request once: the number to sign in, or null. */
export async function consumePairing(cookie: string | undefined): Promise<string | null> {
  const parsed = parseCookie(cookie);
  if (!parsed) return null;
  const { data } = await supabaseAdmin()
    .from("pairing_requests")
    .update({ used_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .eq("secret_hash", hash(parsed.secret))
    .is("used_at", null)
    .not("phone_e164", "is", null)
    .select("phone_e164")
    .maybeSingle();
  return (data?.phone_e164 as string | null) ?? null;
}
