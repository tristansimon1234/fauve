import { after } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { nudgeIfQuiet } from "@/lib/nudge";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Each morning (pg_cron): a short reminder to the studios with nothing out for
// a while (lib/nudge.ts), at most one a week each.
export const maxDuration = 300;

async function run() {
  const { data: studios } = await supabaseAdmin().from("studios").select("id").in("onboarding_step", ["connect", "done"]);
  let sent = 0;
  for (const studio of studios ?? []) {
    try {
      if (await nudgeIfQuiet(studio.id as string)) sent++;
    } catch (error) {
      console.error("nudge failed", studio.id, error);
    }
  }
  console.log("nudges sent", sent);
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  after(run);
  return Response.json({ queued: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
