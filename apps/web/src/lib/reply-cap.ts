import "server-only";
import { dailyTurnCap, NEW_NUMBERS_ALERT, newNumbersAlert } from "@fauve/agent";
import { localDateOf, startOfLocalDay } from "@/lib/dates";
import { messageOwner } from "@/lib/owner-message";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The day's limits on what anyone can make Simone do (packages/agent/src/reply-cap.ts): her turns
// for a studio, counted on what they cost (one « conversation » line in cost_events per turn,
// whatever the channel), and the team told when more numbers than usual start in a day.

/** Local midnight today in `timeZone`. */
const today = (timeZone: string) => startOfLocalDay(localDateOf(new Date(), timeZone), timeZone).toISOString();

/**
 * Whether Simone answers this studio now: « open », or its day's turns are used up and she says so
 * once (« notice »), then nothing until tomorrow (« silent »).
 */
export async function dayOfTurns(
  studioId: string,
  studio: { team: boolean | null; subscription_status: string | null; timezone: string | null; website_url: string | null },
): Promise<"open" | "notice" | "silent"> {
  const lab = typeof studio.website_url === "string" && studio.website_url.startsWith("lab://");
  const cap = dailyTurnCap({ team: Boolean(studio.team) || lab, subscription: studio.subscription_status });
  if (cap === null) return "open";
  const db = supabaseAdmin();
  const since = today(studio.timezone ?? "Europe/Paris");
  const { count: turns, error } = await db
    .from("cost_events")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("meta->>purpose", "conversation")
    .gte("created_at", since);
  // Never silence her on a failed count.
  if (error || (turns ?? 0) < cap) return "open";
  const { count: told } = await db
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("direction", "outbound")
    .eq("payload->>kind", "daily_cap")
    .gte("created_at", since);
  return told ? "silent" : "notice";
}

/** A new number just started with Simone: past the day's usual count, the team is told once (in its own conversation). */
export async function alertOnNewNumbers(): Promise<void> {
  const db = supabaseAdmin();
  const { data: team } = await db.from("studios").select("id, timezone").eq("team", true).limit(1).maybeSingle();
  const since = today((team?.timezone as string | null) ?? "Europe/Paris");
  const { count } = await db.from("members").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) <= NEW_NUMBERS_ALERT) return;
  if (!team) return void console.error("new numbers alert: no team studio", count);
  const { count: told } = await db
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", team.id)
    .eq("payload->>kind", "new_numbers_alert")
    .gte("created_at", since);
  if (told) return;
  console.warn("new numbers alert", count);
  await messageOwner(team.id as string, { text: newNumbersAlert(count ?? 0), kind: "new_numbers_alert" });
}
