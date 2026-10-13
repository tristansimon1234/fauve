import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { openSessionForPhone } from "@/lib/auth/server-login";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

// Opaque one-time links sent by Fauve on WhatsApp (15 min, a day for a
// publication; single use): opening one signs the manager in on that device.

// Link previews (WhatsApp, Facebook…) fetch the URL before anyone taps it: they
// get a plain page and must not use up the link.
// The WhatsApp fetcher's agent is "WhatsApp/2.x"; its in-app browser looks like a normal browser.
const PREVIEW_AGENTS = /^WhatsApp\/|facebookexternalhit|facebot|meta-externalagent|twitterbot|slackbot|telegrambot|discordbot|linkedinbot|skypeuripreview|googlebot|bingbot|embedly/i;

const previewPage = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fauve</title>
<meta property="og:title" content="Fauve"><meta property="og:description" content="Ouvre le lien pour voir ta publication."></head><body></body></html>`;

export async function GET(request: NextRequest, ctx: RouteContext<"/auth/link/[token]">) {
  const { token } = await ctx.params;
  const next = request.nextUrl.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/fauve";
  if (PREVIEW_AGENTS.test(request.headers.get("user-agent") ?? "")) {
    return new NextResponse(previewPage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }

  const { data } = await supabaseAdmin()
    .from("login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("phone_e164")
    .maybeSingle();

  if (!data) {
    // Used or expired (a second tap, an old message): still signed in, go there;
    // otherwise sign in with a code, then go where the link pointed.
    const { data: session } = await (await supabaseServer()).auth.getClaims();
    if (session?.claims) return NextResponse.redirect(new URL(safeNext, request.url));
    const login = new URL("/connexion?lien=expire", request.url);
    login.searchParams.set("next", safeNext);
    return NextResponse.redirect(login);
  }

  const ok = await openSessionForPhone(data.phone_e164);
  if (!ok) {
    const fallback = new URL("/connexion", request.url);
    fallback.searchParams.set("next", safeNext);
    return NextResponse.redirect(fallback);
  }
  return NextResponse.redirect(new URL(safeNext, request.url));
}
