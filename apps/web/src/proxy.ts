import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/public-env";

// Refreshes the Supabase session cookie on every request and keeps the web app
// behind login. Pages still check the user themselves; this is the fast path.
const PROTECTED = ["/fauve", "/calendrier", "/publications", "/grille", "/mediatheque", "/composants", "/resultats", "/tendances", "/style", "/reglages", "/v", "/depot", "/voix", "/merci", "/factures", "/abonnement"];

export async function proxy(request: NextRequest) {
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
  const path = request.nextUrl.pathname;
  if (!data?.claims && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
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
