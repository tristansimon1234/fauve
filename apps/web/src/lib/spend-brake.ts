import "server-only";
import { FREE_SPEND_EUR_PER_DAY, freeStudio, spendBrakeAlert } from "@fauve/agent";
import { env } from "@/lib/env";
import { teamToday, tellTeamOnce } from "@/lib/reply-cap";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The third brake for a rush (packages/agent/src/brakes.ts): what studios not subscribed cost in a
// day (cost_events, from local midnight; neither the team's nor a lab's), every one together. Past
// FREE_SPEND_EUR_PER_DAY nothing costly starts for them until tomorrow (studioAccess: reason
// « busy »), and the team is told once. Subscribers are never braked. The sum is read once a minute.

const READ_EVERY_MS = 60_000;
let read: { at: number; spent: number } | null = null;

const cap = () => env("FREE_SPEND_EUR_PER_DAY") ?? FREE_SPEND_EUR_PER_DAY;

/** Today's spending of studios not subscribed, in euros (0 on a failed read: never brake on a doubt). */
async function spentToday(): Promise<number> {
  if (read && Date.now() - read.at < READ_EVERY_MS) return read.spent;
  const { data, error } = await supabaseAdmin().rpc("free_spend_since", { since: await teamToday() });
  if (error) {
    console.warn("spend brake: not read", error.message);
    return read?.spent ?? 0;
  }
  read = { at: Date.now(), spent: Number(data ?? 0) };
  return read.spent;
}

/** Nothing costly may start for this studio today: it pays nothing yet, and the day's spending is past its cap. */
export async function spendBraked(studio: { team?: boolean | null; website_url?: string | null; subscription_status?: string | null }): Promise<boolean> {
  if (!freeStudio(studio)) return false;
  const spent = await spentToday();
  if (spent < cap()) return false;
  await tellTeamOnce("spend_brake", spendBrakeAlert(spent, cap())).catch((e: unknown) => console.warn("spend brake alert failed", e));
  return true;
}
