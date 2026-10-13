import { NextResponse, type NextRequest } from "next/server";
import { currentMember } from "@/lib/social/current-member";
import { authorizeUrl, FAUVE_ACCOUNT_SCOPES } from "@/lib/social/instagram";
import { createOAuthState, FAUVE_ACCOUNT_STATE } from "@/lib/social/oauth-state";
import { isValidTestKey } from "@/lib/test-studio";

// Starts the Instagram connection for the signed-in manager's studio.
// Admin: ?fauve=1&cle=… connects Fauve's own account (the one managers write to).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("fauve") === "1") {
    if (!isValidTestKey(params.get("cle"))) return new Response("Forbidden", { status: 403 });
    return NextResponse.redirect(authorizeUrl(createOAuthState(FAUVE_ACCOUNT_STATE, FAUVE_ACCOUNT_STATE), FAUVE_ACCOUNT_SCOPES));
  }
  const member = await currentMember();
  if (!member) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("next", "/connect");
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(authorizeUrl(createOAuthState(member.studio_id, member.id)));
}
