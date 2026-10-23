import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { openSessionForPhone } from "@/lib/auth/server-login";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

// Opaque one-time links sent by Simone on WhatsApp (15 min, a day for a
// publication; single use): opening one signs the manager in on that device.
//
// Link previews and scanners fetch the URL seconds after it is sent, before
// anyone taps it. So opening the link (GET) uses nothing up: it shows a tiny
// page whose script sends the form (POST), and only that signs in. Robots read
// pages, they do not run them.

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A path of the app only (never another site). */
export function safePath(next: string | null | undefined): string | null {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

/** The page a link shows before it signs in (GET): it posts itself to `action`. */
export function linkPage(action: string): NextResponse {
  const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Simone</title>
<meta property="og:title" content="Simone">
<meta property="og:description" content="Ouvre le lien pour voir ta publication.">
<style>
  body { margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: #1c1530; color: #fff;
    font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif; }
  main { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px; text-align: center; }
  .orb { width: 56px; height: 56px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffd2c4, #f2694e 45%, #5b3fd9 100%);
    animation: breathe 1.6s ease-in-out infinite; }
  @keyframes breathe { 50% { transform: scale(1.08); } }
  p { margin: 0; color: rgba(255,255,255,.75); font-size: 15px; }
  button { border: 0; border-radius: 999px; background: #5b3fd9; color: #fff; font: inherit; font-weight: 700; font-size: 15px; padding: 14px 26px; }
</style>
</head>
<body>
<main>
  <div class="orb"></div>
  <p>J’ouvre ta page…</p>
  <form method="post" action="${escape(action)}"><button type="submit">Ouvrir</button></form>
</main>
<script>document.forms[0].submit();</script>
</body>
</html>`;
  return new NextResponse(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * Uses the link (POST): signs her in and opens where it points (its own `next`, or the one in
 * the URL of an older link). Used or expired: still signed in, go there; else sign in with a code.
 */
export async function consumeLoginLink(request: NextRequest, token: string, urlNext?: string | null): Promise<NextResponse> {
  // 303: the browser follows with a GET.
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const db = supabaseAdmin();
  const hash = createHash("sha256").update(token).digest("hex");

  const { data } = await db
    .from("login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("phone_e164, next")
    .maybeSingle();

  if (!data) {
    // A second tap, an old message: where it pointed, signed in or after a code.
    const { data: row } = await db.from("login_tokens").select("next").eq("token_hash", hash).maybeSingle();
    const next = safePath(row?.next as string | null) ?? safePath(urlNext) ?? "/fauve";
    const { data: session } = await (await supabaseServer()).auth.getClaims();
    if (session?.claims) return go(next);
    return go(`/connexion?lien=expire&next=${encodeURIComponent(next)}`);
  }

  const next = safePath(data.next as string | null) ?? safePath(urlNext) ?? "/fauve";
  const ok = await openSessionForPhone(data.phone_e164 as string);
  if (!ok) return go(`/connexion?next=${encodeURIComponent(next)}`);
  return go(next);
}
