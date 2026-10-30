import { after } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { nudgeIfQuiet } from "@/lib/nudge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendDueReports } from "@/lib/weekly-report";

// Each morning (pg_cron): a short reminder to the studios with nothing out for
// a while (lib/nudge.ts), at most one a week each; and the Sunday reports that
// waited three days for a message from her (lib/weekly-report.ts).
export const maxDuration = 300;

const PAGE = 500;

async function run() {
  // Page by page: a query returns 1 000 rows at most, and the studios past them were never reminded.
  const studios: { id: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin().from("studios").select("id").in("onboarding_step", ["connect", "done"]).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    studios.push(...((data ?? []) as { id: string }[]));
    if ((data ?? []).length < PAGE) break;
  }
  let sent = 0;
  for (const studio of studios) {
    try {
      if (await nudgeIfQuiet(studio.id as string)) sent++;
    } catch (error) {
      console.error("nudge failed", studio.id, error);
    }
  }
  console.log("nudges sent", sent);
  console.log("weekly reports sent late", await sendDueReports().catch((error) => void console.error("weekly reports due failed", error)));
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  after(() => run().catch((error) => console.error("nudges failed", error)));
  return Response.json({ queued: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
