import { NextResponse, type NextRequest } from "next/server";
import { connectWithCode, InstagramError } from "@/lib/social/instagram";
import { consumeOAuthState } from "@/lib/social/oauth-state";
import { linkInstagramAccount } from "@/lib/social/link-instagram";

// Instagram redirects here after the manager authorised Fauve. The studio comes
// from the signed state, not from a session: this page often opens in another
// browser than the one that started the flow.
function back(request: NextRequest, path: string, error?: string) {
  const url = new URL(path, request.url);
  if (error) url.searchParams.set("erreur", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(request, "/connect", "refus");
  const state = await consumeOAuthState(params.get("state"));
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

  const failed = await linkInstagramAccount(state, { ...account, scopes: account.scopes }, "instagram");
  return back(request, failed ? "/connect" : "/pret", failed ?? undefined);
}
