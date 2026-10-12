import { NextResponse, type NextRequest } from "next/server";
import { currentMember } from "@/lib/social/current-member";
import { authorizeUrl } from "@/lib/social/instagram";
import { createOAuthState } from "@/lib/social/oauth-state";

// Starts the Instagram connection for the signed-in manager's studio.
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("next", "/connect");
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(authorizeUrl(createOAuthState(member.studio_id, member.id)));
}
