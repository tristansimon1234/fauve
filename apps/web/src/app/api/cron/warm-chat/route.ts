import { cronAuthorized } from "@/lib/cron-auth";
import { warmChatCache } from "@/lib/agent/run";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Every few minutes in the day (pg_cron): keeps the start shared by every chat request (Edith's prompt and
// tools) in the cache while she is in use, read again just before its hour runs out (lib/agent/run.ts,
// warmChatCache). Only after a message in the last few hours: a quiet evening costs nothing, and the first
// message after it writes the cache again.
export const maxDuration = 60;

/** Read again this long after the last chat request: its hour is nearly over, not yet gone. */
const WARM_AFTER_MIN = 45;
const WARM_BEFORE_MIN = 58;
/** Kept warm only this long after someone last wrote to Edith. */
const IN_USE_HOURS = 3;

async function lastAt(purposes: string[]): Promise<number | null> {
  const { data } = await supabaseAdmin()
    .from("cost_events")
    .select("created_at")
    .eq("kind", "llm")
    .in("meta->>purpose", purposes)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? new Date(data.created_at as string).getTime() : null;
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const [talked, touched] = await Promise.all([lastAt(["conversation"]), lastAt(["conversation", "cache_warm"])]);
  const now = Date.now();
  const idle = touched === null ? null : (now - touched) / 60_000;
  if (talked === null || now - talked > IN_USE_HOURS * 3_600_000 || idle === null || idle < WARM_AFTER_MIN || idle > WARM_BEFORE_MIN) {
    return Response.json({ warmed: false, idle_minutes: idle === null ? null : Math.round(idle) });
  }
  // Logged on the team's studio: the cache is shared by every business.
  const { data: team } = await supabaseAdmin().from("studios").select("id").eq("team", true).limit(1).maybeSingle();
  if (!team) return Response.json({ warmed: false, reason: "no team studio" });
  try {
    await warmChatCache(team.id as string);
  } catch (error) {
    console.error("chat cache warm failed", error);
    return Response.json({ warmed: false, error: String(error) }, { status: 500 });
  }
  return Response.json({ warmed: true, idle_minutes: Math.round(idle) });
}

export const GET = handle;
export const POST = handle;
