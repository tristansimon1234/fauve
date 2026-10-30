import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/public-env";

// Refreshes the Supabase session cookie on every request and keeps the web app
// behind login. Pages still check the user themselves; this is the fast path.
// The app itself is for a computer (Tristan: « l'app ne devrait pas être accessible sur le téléphone,
// mis à part les pages mobiles »): on a phone everything goes through WhatsApp and the pages its
// links open (/v, /depot, /connect, /voix, /abonnement, /merci, /factures). A publication's page
// becomes its phone page; anything else, the page that sends her back to WhatsApp.
const APP_ONLY = ["/fauve", "/calendrier", "/publications", "/grille", "/mediatheque", "/composants", "/resultats", "/tendances", "/style", "/reglages", "/admin"];
/** A phone (not a tablet, not a computer): Chrome's client hint, else its user agent. */
const onPhone = (request: NextRequest) =>
  request.headers.get("sec-ch-ua-mobile") === "?1" || /Mobi|iPhone|iPod|Android.+Mobile|Windows Phone/i.test(request.headers.get("user-agent") ?? "");
const within = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

const PROTECTED = ["/fauve", "/calendrier", "/publications", "/grille", "/mediatheque", "/composants", "/resultats", "/tendances", "/style", "/reglages", "/v", "/depot", "/voix", "/merci", "/factures", "/abonnement"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if ((request.method === "GET" || request.method === "HEAD") && within(path, APP_ONLY) && onPhone(request)) {
    const to = request.nextUrl.clone();
    const post = /^\/publications\/([0-9a-f-]{36})/i.exec(path)?.[1];
    to.pathname = post ? `/v/${post}` : "/sur-whatsapp";
    to.search = "";
    return NextResponse.redirect(to);
  }
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && within(path, PROTECTED)) {
    const login = request.nextUrl.clone();
    login.pathname = "/connexion";
    login.search = "";
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  // The deployment's own addresses (fauve-one.vercel.app, previews) show the same pages as edith-ai.app:
  // search engines index only the real one.
  if (request.nextUrl.hostname.endsWith(".vercel.app")) response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = {
  // Skip static assets and the server-to-server endpoints (Meta, Supabase hooks, Stripe).
  matcher: ["/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|api/whatsapp|api/auth|api/stripe).*)"],
};
