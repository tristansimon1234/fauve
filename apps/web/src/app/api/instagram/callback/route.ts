import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { connectWithCode, InstagramError, subscribeToMessages } from "@/lib/social/instagram";
import { FAUVE_ACCOUNT_STATE, readOAuthState } from "@/lib/social/oauth-state";
import { sendText } from "@/lib/whatsapp/client";

// Instagram redirects here after the manager authorised Fauve. The studio comes
// from the signed state, not from a session: this page often opens in another
// browser than the one that started the flow.
function back(request: NextRequest, path: string, error?: string) {
  const url = new URL(path, request.url);
  if (error) url.searchParams.set("erreur", error);
  return NextResponse.redirect(url);
}

/** Fauve's own account: kept apart from the studios, and subscribed to its DMs. */
async function connectFauveAccount(account: Awaited<ReturnType<typeof connectWithCode>>) {
  const { error } = await supabaseAdmin().from("platform_accounts").upsert({
    key: "fauve_instagram",
    ig_user_id: account.userId,
    username: account.username,
    access_token: account.accessToken,
    expires_at: account.expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const subscribed = await subscribeToMessages(account.accessToken).then(
    () => true,
    (e: unknown) => (console.error("DM webhook subscription failed", e instanceof InstagramError ? e.body : e), false),
  );
  return Response.json({ connected: `@${account.username}`, messagesWebhook: subscribed });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(request, "/connect", "refus");
  const state = readOAuthState(params.get("state"));
  if (!state) return back(request, "/connect", "lien-expire");
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
  if (state.studioId === FAUVE_ACCOUNT_STATE) return connectFauveAccount(account);

  const db = supabaseAdmin();
  const memberRow = await db
    .from("members")
    .select("studio_id, phone_e164")
    .eq("id", state.memberId)
    .eq("studio_id", state.studioId)
    .maybeSingle();
  if (!memberRow.data) return back(request, "/connect", "lien-expire");
  const member = memberRow.data as { studio_id: string; phone_e164: string | null };

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
  // Getting started: Instagram done, the first publication comes next.
  if (studio.data?.onboarding_step === "connect") {
    await db.from("studios").update({ onboarding_step: "first_post" }).eq("id", member.studio_id);
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
