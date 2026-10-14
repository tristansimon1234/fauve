import { NextResponse, type NextRequest } from "next/server";
import { currentMember } from "@/lib/social/current-member";
import { facebookAuthorizeUrl } from "@/lib/social/instagram";
import { createOAuthState } from "@/lib/social/oauth-state";

// Starts the Instagram connection through Facebook Login (Instagram API with
// Facebook Login: everything the Instagram connection does, plus its music).
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("next", "/connect");
    return NextResponse.redirect(login);
  }
  // Not set up in the Meta app yet: the Instagram connection (without the music).
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET || !process.env.FACEBOOK_LOGIN_CONFIG_ID) {
    return NextResponse.redirect(new URL("/api/instagram/connect", request.url));
  }
  return NextResponse.redirect(facebookAuthorizeUrl(createOAuthState(member.studio_id, member.id)));
}
