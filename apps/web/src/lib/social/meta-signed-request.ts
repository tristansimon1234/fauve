import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env, type EnvKey } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Meta's callbacks when someone removes Edith from their Instagram account or asks for their data to be
// deleted (Business login settings: « Deauthorize callback URL », « Data deletion request URL »). Meta
// posts a `signed_request`: a base64url HMAC-SHA256 signature, a dot, then a base64url JSON payload
// whose user_id is the Instagram account (social_accounts.provider_ref). Signed with the Instagram app
// secret; accounts linked earlier through Facebook Login, with the Meta app secret.

const payloadSchema = z.object({
  algorithm: z.string(),
  user_id: z.union([z.string(), z.number()]).transform(String),
});

const SECRETS: EnvKey[] = ["INSTAGRAM_APP_SECRET", "FACEBOOK_APP_SECRET"];

function secret(key: EnvKey): string | null {
  try {
    return String(env(key));
  } catch {
    return null;
  }
}

/** The Instagram account a request from Meta is about, or null when it is not signed by one of our apps. */
export function signedUserId(signedRequest: FormDataEntryValue | null): string | null {
  if (typeof signedRequest !== "string") return null;
  const [signature, body] = signedRequest.split(".");
  if (!signature || !body) return null;
  const given = Buffer.from(signature, "base64url");
  const signed = SECRETS.some((key) => {
    const value = secret(key);
    if (!value) return false;
    const expected = createHmac("sha256", value).update(body).digest();
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
  if (!signed) return null;
  try {
    const payload = payloadSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    return payload.algorithm.toUpperCase() === "HMAC-SHA256" ? payload.user_id : null;
  } catch {
    return null;
  }
}

/**
 * Forgets the Instagram account everywhere it is linked: its token is deleted (it no longer works
 * anyway) and the account shows as disconnected, so Edith offers to link it again. The studio's posts,
 * photos and videos are the manager's and stay; deleting all of them is a studio deletion.
 */
export async function forgetInstagramAccount(userId: string): Promise<number> {
  const db = supabaseAdmin();
  const accounts = await db.from("social_accounts").select("id").eq("platform", "instagram").eq("provider_ref", userId);
  const ids = (accounts.data ?? []).map((a: { id: string }) => a.id);
  if (ids.length === 0) return 0;
  await db.from("social_credentials").delete().in("social_account_id", ids);
  await db.from("social_accounts").update({ status: "disconnected", handle: null, provider_ref: null }).in("id", ids);
  return ids.length;
}
