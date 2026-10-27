import { NextResponse, type NextRequest } from "next/server";
import { consumeOAuthState } from "@/lib/social/oauth-state";
import { exchangeTikTokCode, TikTokError, tiktokUser } from "@/lib/social/tiktok";
import { linkTikTokAccount } from "@/lib/social/tiktok-account";

// TikTok redirects here after the manager authorised Edith. The studio comes
// from the signed state, not from a session (the page may open in another browser).
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
  try {
    const tokens = await exchangeTikTokCode(code);
    // The username needs user.info.profile; without it, the display name.
    const user = await tiktokUser(tokens.accessToken).catch(() => ({ username: undefined, display_name: undefined }));
    const failed = await linkTikTokAccount(state, tokens, user);
    return back(request, "/connect", failed ?? undefined);
  } catch (error) {
    console.error("tiktok connect failed", error instanceof TikTokError ? error.body : error);
    return back(request, "/connect", "tiktok");
  }
}
