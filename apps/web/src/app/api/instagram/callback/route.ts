import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { connectWithCode, InstagramError, subscribeToMessages } from "@/lib/social/instagram";
import { FAUVE_ACCOUNT_STATE, readOAuthState } from "@/lib/social/oauth-state";
import { linkInstagramAccount } from "@/lib/social/link-instagram";

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

  const failed = await linkInstagramAccount(state, { ...account, scopes: account.scopes }, "instagram");
  return back(request, failed ? "/connect" : "/pret", failed ?? undefined);
}
