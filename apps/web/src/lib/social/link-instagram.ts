import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";

// Links a professional Instagram account to a studio once its owner authorised
// Brigitte (Instagram Login or Facebook Login): the account, its token, the end
// of getting started, and a word on WhatsApp.

export type LinkedAccount = { userId: string; username: string; accessToken: string; expiresAt: Date; scopes: string[] };

/** null when linked; else the error code shown on /connect. */
export async function linkInstagramAccount(
  state: { studioId: string; memberId: string },
  account: LinkedAccount,
  provider: "instagram" | "facebook",
): Promise<string | null> {
  const db = supabaseAdmin();
  const memberRow = await db
    .from("members")
    .select("studio_id, phone_e164")
    .eq("id", state.memberId)
    .eq("studio_id", state.studioId)
    .maybeSingle();
  if (!memberRow.data) return "lien-expire";
  const member = memberRow.data as { studio_id: string; phone_e164: string | null };

  const social = await db
    .from("social_accounts")
    .upsert(
      {
        studio_id: member.studio_id,
        platform: "instagram",
        handle: account.username,
        provider,
        provider_ref: account.userId,
        status: "connected",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "studio_id,platform" },
    )
    .select("id")
    .single();
  if (social.error) {
    console.error("social_accounts upsert failed", social.error.message);
    return "instagram";
  }
  const creds = await db.from("social_credentials").upsert({
    social_account_id: social.data.id,
    access_token: account.accessToken,
    expires_at: account.expiresAt.toISOString(),
    scopes: account.scopes,
    updated_at: new Date().toISOString(),
  });
  if (creds.error) {
    console.error("social_credentials upsert failed", creds.error.message);
    return "instagram";
  }

  const studio = await db.from("studios").select("onboarding_step").eq("id", member.studio_id).single();
  // Getting started: Instagram is its last step.
  if (studio.data?.onboarding_step === "connect") {
    await db.from("studios").update({ onboarding_step: "done" }).eq("id", member.studio_id);
  }
  // Close the loop on WhatsApp (best effort: only works inside the 24 h window).
  if (member.phone_e164) {
    const text = `C’est bon, ton Instagram @${account.username} est connecté ✅ Je peux maintenant publier tes posts dès que tu les valides${provider === "facebook" ? ", avec la musique d’Instagram" : ""}.`;
    const id = await sendText(member.phone_e164.slice(1), text).catch(() => undefined);
    if (id) {
      await db.from("whatsapp_messages").insert({
        studio_id: member.studio_id,
        wa_message_id: id,
        direction: "outbound",
        phone_e164: member.phone_e164,
        type: "text",
        body: text,
      });
    }
  }
  return null;
}
