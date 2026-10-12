import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Opaque one-time links sent by Mila on WhatsApp (15 min, single use).
// TODO(auth): open a Supabase session for the member's phone user before redirecting.
export async function GET(request: NextRequest, ctx: RouteContext<"/auth/link/[token]">) {
  const { token } = await ctx.params;
  const next = request.nextUrl.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/mila";

  const { data } = await supabaseAdmin()
    .from("login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();

  if (!data) return NextResponse.redirect(new URL("/?lien=expire", request.url));
  return NextResponse.redirect(new URL(safeNext, request.url));
}
