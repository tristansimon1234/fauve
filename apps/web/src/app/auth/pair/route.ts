import { NextResponse, type NextRequest } from "next/server";
import { openSessionForPhone } from "@/lib/auth/server-login";
import { consumePairing, PAIR_COOKIE } from "@/lib/auth/pairing";

// The screen's request was answered by a WhatsApp message: open the session on
// this browser (the one holding the secret), then the app.
export async function GET(request: NextRequest) {
  const go = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url), 303);
    res.cookies.delete(PAIR_COOKIE);
    return res;
  };
  const phone = await consumePairing(request.cookies.get(PAIR_COOKIE)?.value);
  if (!phone) return go("/commencer?expire=1");
  const ok = await openSessionForPhone(phone);
  return go(ok ? "/fauve" : "/connexion");
}
