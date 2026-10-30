import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { socialConnect } from "./connect";
import { accountDay, followerAudience, InstagramError, profile } from "./instagram";
import { instagramAccount } from "./publish";
import { TikTokError, tiktokUser } from "./tiktok";
import { tiktokAccount } from "./tiktok-account";

// The account itself, day by day, for the Résultats page: Instagram insights
// (new followers, unfollows, views, reach, profile visits, link taps), its
// follower count, and TikTok's counters. Filled by the publish cron a few days
// at a time (30 days back on the first runs), the latest days read again once
// Meta has settled them.

const DAY_MS = 86_400_000;
const BACKFILL_DAYS = 30;
const DAYS_PER_RUN = 4;
const STUDIOS_PER_RUN = 6;
const AUDIENCE_EVERY_MS = 7 * DAY_MS;
/** Meta's numbers for a day keep moving for about two days. */
const SETTLED_AFTER_MS = 2 * DAY_MS;

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const dayStart = (day: string) => new Date(`${day}T00:00:00Z`).getTime();

async function captureInstagram(studioId: string): Promise<number> {
  const db = supabaseAdmin();
  const account = await instagramAccount(studioId);
  if (!account) return 0;
  const today = dayStart(isoDay(Date.now()));
  const wanted = Array.from({ length: BACKFILL_DAYS }, (_, i) => isoDay(today - (i + 1) * DAY_MS));
  const { data: known } = await db
    .from("account_daily")
    .select("day, captured_at, reach")
    .eq("studio_id", studioId)
    .eq("platform", "instagram")
    .gte("day", wanted.at(-1)!);
  const byDay = new Map((known ?? []).map((r) => [r.day as string, r]));
  // Missing days first (newest first), then days read before Meta settled them.
  const todo = wanted
    .filter((day) => {
      const row = byDay.get(day);
      if (!row) return true;
      // Nothing from Meta that day (e.g. a metric refused): asked again once a day, not every run.
      if (row.reach === null) return Date.now() - new Date(row.captured_at as string).getTime() > DAY_MS;
      return new Date(row.captured_at as string).getTime() - dayStart(day) < DAY_MS + SETTLED_AFTER_MS && Date.now() - dayStart(day) >= DAY_MS + SETTLED_AFTER_MS;
    })
    .slice(0, DAYS_PER_RUN);
  let done = 0;
  for (const day of todo) {
    const since = dayStart(day) / 1000;
    const values = await accountDay(account.userId, account.accessToken, since, since + 86_400).catch((error) => {
      console.error("account insights failed", studioId, day, error instanceof InstagramError ? error.body : error);
      return null;
    });
    if (!values) break;
    await db.from("account_daily").upsert(
      {
        studio_id: studioId,
        platform: "instagram",
        day,
        reach: values.reach ?? null,
        views: values.views ?? null,
        profile_views: values.profile_views ?? null,
        link_taps: values.website_clicks ?? values.profile_links_taps ?? null,
        interactions: values.total_interactions ?? null,
        accounts_engaged: values.accounts_engaged ?? null,
        new_followers: values.new_followers ?? null,
        unfollows: values.unfollows ?? null,
        captured_at: new Date().toISOString(),
      },
      { onConflict: "studio_id,platform,day" },
    );
    done++;
  }
  // The follower count, once a day, on yesterday's row (the count as the day ends).
  const yesterday = isoDay(today - DAY_MS);
  if (byDay.get(yesterday) === undefined || !(await hasFollowers(studioId, "instagram", yesterday))) {
    const me = await profile(account.userId, account.accessToken).catch(() => null);
    if (typeof me?.followers_count === "number") {
      await db.from("account_daily").upsert({ studio_id: studioId, platform: "instagram", day: yesterday, followers: me.followers_count }, { onConflict: "studio_id,platform,day" });
      done++;
    }
  }
  // Who follows the account, about once a week.
  const { data: audience } = await db
    .from("account_audience")
    .select("captured_on")
    .eq("studio_id", studioId)
    .eq("platform", "instagram")
    .order("captured_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!audience || Date.now() - dayStart(audience.captured_on as string) > AUDIENCE_EVERY_MS) {
    const data = await followerAudience(account.userId, account.accessToken).catch(() => ({}));
    await db.from("account_audience").upsert({ studio_id: studioId, platform: "instagram", captured_on: isoDay(Date.now()), data }, { onConflict: "studio_id,platform,captured_on" });
    done++;
  }
  return done;
}

async function hasFollowers(studioId: string, platform: "instagram" | "tiktok", day: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("account_daily").select("followers").eq("studio_id", studioId).eq("platform", platform).eq("day", day).maybeSingle();
  return typeof data?.followers === "number";
}

/** TikTok gives counters only: followers and likes, kept each day (new followers = the difference). */
async function captureTikTok(studioId: string): Promise<number> {
  const yesterday = isoDay(dayStart(isoDay(Date.now())) - DAY_MS);
  if (await hasFollowers(studioId, "tiktok", yesterday)) return 0;
  const account = await tiktokAccount(studioId).catch(() => null);
  if (!account) return 0;
  try {
    const user = await tiktokUser(account.accessToken);
    if (typeof user.follower_count !== "number") return 0;
    await supabaseAdmin()
      .from("account_daily")
      .upsert({ studio_id: studioId, platform: "tiktok", day: yesterday, followers: user.follower_count, likes_total: user.likes_count ?? null }, { onConflict: "studio_id,platform,day" });
    return 1;
  } catch (error) {
    console.error("tiktok counters failed", studioId, error instanceof TikTokError ? error.body : error);
    return 0;
  }
}

/** Cron entry: a few studios per run, those read longest ago first. */
export async function captureAccountStats(): Promise<number> {
  // Put aside (connect.ts): her numbers come from her @ (public-stats.ts).
  if (!socialConnect()) return 0;
  const db = supabaseAdmin();
  const { data: accounts } = await db.from("social_accounts").select("studio_id, platform").eq("status", "connected");
  if (!accounts?.length) return 0;
  const { data: recent } = await db
    .from("account_daily")
    .select("studio_id, captured_at")
    .gte("captured_at", new Date(Date.now() - DAY_MS).toISOString())
    .order("captured_at", { ascending: false })
    .limit(500);
  const lastSeen = new Map<string, number>();
  for (const r of recent ?? []) if (!lastSeen.has(r.studio_id as string)) lastSeen.set(r.studio_id as string, new Date(r.captured_at as string).getTime());
  const studios = [...new Set(accounts.map((a) => a.studio_id as string))]
    .sort((a, b) => (lastSeen.get(a) ?? 0) - (lastSeen.get(b) ?? 0))
    .slice(0, STUDIOS_PER_RUN);
  let done = 0;
  for (const studioId of studios) {
    const platforms = new Set(accounts.filter((a) => a.studio_id === studioId).map((a) => a.platform as string));
    if (platforms.has("instagram")) done += await captureInstagram(studioId).catch(() => 0);
    if (platforms.has("tiktok")) done += await captureTikTok(studioId).catch(() => 0);
  }
  return done;
}
