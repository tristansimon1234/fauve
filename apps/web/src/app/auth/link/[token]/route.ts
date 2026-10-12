import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { openSessionForPhone } from "@/lib/auth/server-login";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Opaque one-time links sent by Mila on WhatsApp (15 min, single use):
// opening one signs the manager in on that device.
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
    .select("phone_e164")
    .maybeSingle();

  if (!data) return NextResponse.redirect(new URL("/connexion?lien=expire", request.url));

  const ok = await openSessionForPhone(data.phone_e164);
  if (!ok) {
    const fallback = new URL("/connexion", request.url);
    fallback.searchParams.set("next", safeNext);
    return NextResponse.redirect(fallback);
  }
  return NextResponse.redirect(new URL(safeNext, request.url));
}
