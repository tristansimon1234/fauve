import { NextResponse, type NextRequest } from "next/server";
import { launchPendingCreation } from "@/app/(app)/create-actions";
import { packSession } from "@/lib/billing/stripe";
import { addPackCredits } from "@/lib/credits";
import { getStudioContext } from "@/lib/studio";

// Back from paying a credit pack: its credits are added once (the session id is unique in the
// ledger), what she launched from « Créer » with no credits left starts, then she lands where she was.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/fauve";
  const next = /^\/(?!\/)[\w\-/?=&%.]*$/.test(nextParam) ? nextParam : "/fauve";
  const { member } = await getStudioContext();
  if (!member) return NextResponse.redirect(new URL(`/connexion?next=${encodeURIComponent(next)}`, request.url));
  if (/^cs_[\w]+$/.test(sessionId)) {
    try {
      const pack = await packSession(sessionId);
      if (pack.paid && pack.credits > 0 && pack.studioId === member.studio.id) {
        await addPackCredits(member.studio.id, sessionId, pack.credits);
        await launchPendingCreation().catch((error) => console.error("pending creation not launched", error));
      }
    } catch (error) {
      console.error("credit pack not added", sessionId, error);
    }
  }
  return NextResponse.redirect(new URL(next, request.url));
}
