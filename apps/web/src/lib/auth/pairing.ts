import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Starting (or signing in) on a computer, like WhatsApp Web: the screen shows a
// QR code that opens WhatsApp with a short code already written; the message the
// manager sends proves her number, and the screen opens her session. No SMS and
// no Meta template: the message comes from her. The screen holds a secret
// (cookie), so only the browser that asked can use the session. She confirms
// with a button on WhatsApp first: a message written for her by someone else
// (a wa.me link with their code) would otherwise open her account on their screen.

/** No 0/O, 1/I/L: read and typed without doubt. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TTL_MS = 15 * 60_000;
export const PAIR_COOKIE = "fauve_pair";

/** The message the screen writes for her (« Bonjour Edith ! Code : K7P2QX »), and nothing else. */
const PAIRING_TEXT = /^\s*bonjour\s+(?:edith|fauve)\s*!?\s*code\s*[:：]?\s*([A-HJ-KM-NP-Z2-9]{6})\s*$/i;

/** Her answers to « Un ordinateur veut ouvrir ton compte » (WhatsApp reply buttons, 20 characters at most). */
export const PAIRING_YES = "Oui, c’est mon écran";
export const PAIRING_NO = "Ce n’est pas moi";

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

/** A message with a waiting code: the number that sent it is attached, still to confirm. The code if it was one. */
export async function claimPairing(text: string | null | undefined, phoneE164: string): Promise<string | null> {
  const code = text?.match(PAIRING_TEXT)?.[1]?.toUpperCase();
  if (!code) return null;
  const { data } = await supabaseAdmin()
    .from("pairing_requests")
    .update({ phone_e164: phoneE164, claimed_at: new Date().toISOString() })
    .eq("code", code)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  return data?.length ? code : null;
}

/**
 * Her answer to the confirmation: « Oui » lets the screen open her session, « Ce n’est pas moi »
 * closes the request. Null when the message is neither, or no request of hers is waiting.
 */
export async function answerPairing(text: string | null | undefined, phoneE164: string): Promise<"confirmed" | "refused" | null> {
  const answer = text?.trim();
  if (answer !== PAIRING_YES && answer !== PAIRING_NO) return null;
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin()
    .from("pairing_requests")
    .update(answer === PAIRING_YES ? { confirmed_at: now } : { expires_at: now })
    .eq("phone_e164", phoneE164)
    .is("confirmed_at", null)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("id");
  if (!data?.length) return null;
  return answer === PAIRING_YES ? "confirmed" : "refused";
}

function parseCookie(cookie: string | undefined): { id: string; secret: string } | null {
  const [id, secret] = cookie?.split(".") ?? [];
  return id && secret && /^[0-9a-f-]{36}$/.test(id) ? { id, secret } : null;
}

export type PairingState = "waiting" | "confirming" | "ready" | "expired";

/** Where the browser's request is: waiting for the message, for her « Oui » on WhatsApp, ready to sign in, or gone. */
export async function pairingState(cookie: string | undefined): Promise<PairingState> {
  const parsed = parseCookie(cookie);
  if (!parsed) return "expired";
  const { data } = await supabaseAdmin()
    .from("pairing_requests")
    .select("secret_hash, phone_e164, confirmed_at, used_at, expires_at")
    .eq("id", parsed.id)
    .maybeSingle();
  if (!data || data.secret_hash !== hash(parsed.secret) || data.used_at) return "expired";
  if (new Date(data.expires_at as string) <= new Date()) return "expired";
  if (data.confirmed_at) return "ready";
  return data.phone_e164 ? "confirming" : "waiting";
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
    .not("confirmed_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .select("phone_e164")
    .maybeSingle();
  return (data?.phone_e164 as string | null) ?? null;
}
