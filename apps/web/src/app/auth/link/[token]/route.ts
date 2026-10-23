import type { NextRequest } from "next/server";
import { linkPage, safePath, consumeLoginLink } from "@/lib/auth/link-route";

// The links sent before /l/{token}: where they point is in their URL (?next=).

const nextOf = (request: NextRequest) => safePath(request.nextUrl.searchParams.get("next")) ?? "/fauve";

export function GET(request: NextRequest) {
  return linkPage(`${request.nextUrl.pathname}?next=${encodeURIComponent(nextOf(request))}`);
}

export async function POST(request: NextRequest, ctx: RouteContext<"/auth/link/[token]">) {
  const { token } = await ctx.params;
  return consumeLoginLink(request, token, nextOf(request));
}
