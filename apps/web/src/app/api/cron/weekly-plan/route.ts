import { after } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { proposeWeek, sendWeekProposal, weekToPlan } from "@/lib/week-plan";

// Sunday evening (pg_cron, after the report): next week's proposal for every
// studio past onboarding, on its posting days. Nothing is added to the
// calendar until she says yes (accept_week).
export const maxDuration = 300;

async function run() {
  const db = supabaseAdmin();
  const { data: studios } = await db.from("studios").select("id, timezone").in("onboarding_step", ["connect", "done"]);
  const results: { studio: string; ok: boolean; error?: string }[] = [];
  for (const studio of studios ?? []) {
    const studioId = studio.id as string;
    try {
      // Already planned for that week (accepted, or proposed by hand): leave it.
      const { monday } = weekToPlan((studio.timezone as string) ?? "Europe/Paris", "next");
      const { data: already } = await db.from("week_plans").select("id").eq("studio_id", studioId).eq("week_start", monday).in("status", ["proposed", "accepted"]).limit(1);
      if (already?.length) continue;
      const proposal = await proposeWeek(studioId, { which: "next" });
      if ("error" in proposal) {
        results.push({ studio: studioId, ok: false, error: proposal.error });
        continue;
      }
      await sendWeekProposal(studioId, proposal.week, proposal.message);
      results.push({ studio: studioId, ok: true });
    } catch (error) {
      console.error("weekly plan failed", studioId, error);
      results.push({ studio: studioId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log("weekly plans", JSON.stringify(results));
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  after(run);
  return Response.json({ queued: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
