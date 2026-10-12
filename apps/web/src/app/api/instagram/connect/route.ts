import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentMember } from "@/lib/social/current-member";
import { authorizeUrl } from "@/lib/social/instagram";

// Starts the Instagram connection for the signed-in manager's studio.
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("next", "/connect");
    return NextResponse.redirect(login);
  }
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(authorizeUrl(state));
  response.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: 15 * 60,
  });
  return response;
}
