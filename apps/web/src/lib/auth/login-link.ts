import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TTL_MS = 15 * 60_000;

/**
 * A one-time link Fauve sends on WhatsApp (15 min, tied to the number): it
 * signs the manager in and opens `next`. Expired, it goes through the login
 * page and still lands on `next`.
 */
export async function createLoginLink(phoneE164: string, next: string, purpose = "login"): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const db = supabaseAdmin();
  const { data: member } = await db.from("members").select("user_id").eq("phone_e164", phoneE164).limit(1).maybeSingle();
  const { error } = await db.from("login_tokens").insert({
    user_id: (member?.user_id as string | null) ?? null,
    phone_e164: phoneE164,
    token_hash: createHash("sha256").update(token).digest("hex"),
    purpose,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  });
  if (error) throw new Error(`login_tokens: ${error.message}`);
  return `${env("APP_URL")}/auth/link/${token}?next=${encodeURIComponent(next)}`;
}
