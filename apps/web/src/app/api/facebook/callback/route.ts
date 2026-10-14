import { NextResponse, type NextRequest } from "next/server";
import { connectWithFacebookCode, InstagramError } from "@/lib/social/instagram";
import { linkInstagramAccount } from "@/lib/social/link-instagram";
import { FAUVE_ACCOUNT_STATE, readOAuthState } from "@/lib/social/oauth-state";

// Facebook redirects here once the manager authorised Brigitte and chose her
// Page. The studio comes from the signed state (another browser may finish it).
function back(request: NextRequest, path: string, error?: string) {
  const url = new URL(path, request.url);
  if (error) url.searchParams.set("erreur", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(request, "/connect", "refus");
  const state = readOAuthState(params.get("state"));
  if (!state || state.studioId === FAUVE_ACCOUNT_STATE) return back(request, "/connect", "lien-expire");
  const code = params.get("code");
  if (!code) return back(request, "/connect", "refus");

  let account: Awaited<ReturnType<typeof connectWithFacebookCode>>;
  try {
    account = await connectWithFacebookCode(code);
  } catch (error) {
    console.error("facebook connect failed", error instanceof InstagramError ? error.body : error);
    return back(request, "/connect", "instagram");
  }
  // None of her Pages is linked to a professional Instagram account.
  if (!account) return back(request, "/connect", "sans-page");
  const failed = await linkInstagramAccount(state, account, "facebook");
  return back(request, failed ? "/connect" : "/pret", failed ?? undefined);
}
