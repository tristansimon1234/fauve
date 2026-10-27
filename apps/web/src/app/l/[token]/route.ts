import type { NextRequest } from "next/server";
import { linkPage, consumeLoginLink } from "@/lib/auth/link-route";

// Edith's short sign-in links on WhatsApp (lib/auth/login-link.ts): where they point is kept
// with the token, so the link stays short. See lib/auth/link-route.ts.

export function GET(request: NextRequest) {
  return linkPage(request.nextUrl.pathname);
}

export async function POST(request: NextRequest, ctx: RouteContext<"/l/[token]">) {
  const { token } = await ctx.params;
  return consumeLoginLink(request, token);
}
