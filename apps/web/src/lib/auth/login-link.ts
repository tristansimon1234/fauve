import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TTL_MS = 15 * 60_000;
// A finished montage is often opened hours later: its link lasts a day (still
// single use, and anyone who can read her WhatsApp could get a login code anyway).
// Her upload link (/depot) too: files are often sent later in the day.
const TTL_BY_PURPOSE: Record<string, number> = { open_post: 24 * 3600_000, upload: 24 * 3600_000 };

/**
 * A one-time link Edith sends on WhatsApp (15 min, a day for a publication,
 * tied to the number): it signs the manager in and opens `next`. Expired or
 * used, it opens `next` if she is still signed in, else the login page.
 */
export async function createLoginLink(phoneE164: string, next: string, purpose = "login"): Promise<string> {
  // 16 bytes (128 bits, 22 characters): short in her chat, single use and short-lived.
  const token = randomBytes(16).toString("base64url");
  const db = supabaseAdmin();
  const { data: member } = await db.from("members").select("user_id").eq("phone_e164", phoneE164).limit(1).maybeSingle();
  const { error } = await db.from("login_tokens").insert({
    user_id: (member?.user_id as string | null) ?? null,
    phone_e164: phoneE164,
    token_hash: createHash("sha256").update(token).digest("hex"),
    purpose,
    next,
    expires_at: new Date(Date.now() + (TTL_BY_PURPOSE[purpose] ?? TTL_MS)).toISOString(),
  });
  if (error) throw new Error(`login_tokens: ${error.message}`);
  // Where it points stays with the token (app/l/[token]): no long ?next= in the link.
  return `${env("APP_URL")}/l/${token}`;
}
