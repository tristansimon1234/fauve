import { NextResponse, type NextRequest } from "next/server";
import { launchPendingCreation } from "@/app/(app)/create-actions";
import { syncFromCheckout } from "@/lib/billing/access";
import { getStudioContext } from "@/lib/studio";

// Back from Stripe Checkout: her subscription is read and kept, what she launched
// from « Créer » before paying starts, then she lands where she was.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/fauve";
  const next = /^\/(?!\/)[\w\-/?=&%.]*$/.test(nextParam) ? nextParam : "/fauve";
  const { member } = await getStudioContext();
  if (!member) return NextResponse.redirect(new URL(`/connexion?next=${encodeURIComponent(next)}`, request.url));
  if (/^cs_[\w]+$/.test(sessionId)) {
    const subscribed = await syncFromCheckout(member.studio.id, sessionId).catch((error) => (console.error("checkout sync failed", error), false));
    if (subscribed) await launchPendingCreation().catch((error) => console.error("pending creation not launched", error));
  }
  return NextResponse.redirect(new URL(next, request.url));
}
