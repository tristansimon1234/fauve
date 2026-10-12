import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentMember } from "@/lib/social/current-member";
import { connectWithCode, InstagramError } from "@/lib/social/instagram";
import { sendText } from "@/lib/whatsapp/client";

// Instagram redirects here after the manager authorised Fauve.
function back(request: NextRequest, path: string, error?: string) {
  const url = new URL(path, request.url);
  if (error) url.searchParams.set("erreur", error);
  const response = NextResponse.redirect(url);
  response.cookies.delete({ name: "ig_oauth_state", path: "/api/instagram" });
  return response;
}

function sameState(a: string | undefined, b: string | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(request, "/connect", "refus");
  if (!sameState(request.cookies.get("ig_oauth_state")?.value, params.get("state"))) {
    return back(request, "/connect", "lien-expire");
  }
  const member = await currentMember();
  if (!member) return back(request, "/connexion");
  const code = params.get("code");
  if (!code) return back(request, "/connect", "refus");

  let account: Awaited<ReturnType<typeof connectWithCode>>;
  try {
    account = await connectWithCode(code);
  } catch (error) {
    console.error("instagram connect failed", error instanceof InstagramError ? error.body : error);
    return back(request, "/connect", "instagram");
  }
  if (account.accountType && !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(account.accountType)) {
    return back(request, "/connect", "compte-perso");
  }

  const db = supabaseAdmin();
  const social = await db
    .from("social_accounts")
    .upsert(
      {
        studio_id: member.studio_id,
        platform: "instagram",
        handle: account.username,
        provider: "instagram",
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
    return back(request, "/connect", "instagram");
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
    return back(request, "/connect", "instagram");
  }

  // Close the loop on WhatsApp (best effort: only works inside the 24 h window).
  const studio = await db.from("studios").select("onboarding_step").eq("id", member.studio_id).single();
  if (studio.data?.onboarding_step === "connect") {
    await db.from("studios").update({ onboarding_step: "done" }).eq("id", member.studio_id);
  }
  if (member.phone_e164) {
    const text = `C’est bon, ton Instagram @${account.username} est connecté ✅ Je peux maintenant publier tes posts dès que tu les valides.`;
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
  return back(request, "/pret");
}
