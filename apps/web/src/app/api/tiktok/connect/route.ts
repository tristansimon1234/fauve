import { NextResponse, type NextRequest } from "next/server";
import { currentMember } from "@/lib/social/current-member";
import { createOAuthState } from "@/lib/social/oauth-state";
import { tiktokAuthorizeUrl, tiktokEnabled } from "@/lib/social/tiktok";

// Starts the TikTok connection for the signed-in manager's studio.
export async function GET(request: NextRequest) {
  if (!tiktokEnabled()) {
    const back = new URL("/connect", request.url);
    back.searchParams.set("erreur", "tiktok-indisponible");
    return NextResponse.redirect(back);
  }
  const member = await currentMember();
  if (!member) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("next", "/connect");
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(tiktokAuthorizeUrl(createOAuthState(member.studio_id, member.id)));
}
