import "server-only";
import { matchPublicVideos, readPublicProfile, readPublicVideos, usdToEur, type Platform, type PublicVideo } from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tregCall } from "@/lib/treg";

// Her public numbers without connecting her accounts (Tristan: « nombre d'abonnés / vue / j'aime
// c'est suffisant »): from her @ (studios.instagram_handle, tiktok_handle), once a day, through
// Treg (about $0.004 a day for Instagram, $0.0024 for TikTok): her follower count on yesterday's
// row of account_daily, as the connected capture does, and the views, likes and comments of the
// Reels she posted herself, each found by its caption (posts published, measured in metrics).
// A platform she connected is read by its own API (account-stats.ts), never twice.

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

const DAY_MS = 86_400_000;
/** Once a day per studio (a little less, so the hour drifts back rather than forward). */
const EVERY_MS = 20 * 3600_000;
const STUDIOS_PER_RUN = 8;
/** Posts made in the last 60 days may still be found online; each one is measured for 30 days. */
const LOOK_BACK_MS = 60 * DAY_MS;
const MEASURE_FOR_MS = 30 * DAY_MS;
/** What one call may cost at most (Treg's catalog, October 2026: $0.002 a call on Instagram, $0.0012 on TikTok). */
const MAX_COST_USD = 0.01;

const TOOLS = {
  instagram: { profile: "anyapi.instagram.profile", videos: "anyapi.instagram.user.reels" },
  tiktok: { profile: "anyapi.tiktok.user.profile", videos: "anyapi.tiktok.user.videos" },
} as const;

type External = { public_id?: string; media_id?: string; post_id?: string; published_at?: string };

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

async function call(studioId: string, platform: Platform, tool: "profile" | "videos", handle: string): Promise<unknown> {
  const done = await tregCall(TOOLS[platform][tool], { handle }, MAX_COST_USD);
  if (!done) return null;
  if (done.costUsd > 0) {
    await supabaseAdmin()
      .from("cost_events")
      .insert({ studio_id: studioId, kind: "public_stats", provider: "treg", units: 1, cost_eur: usdToEur(done.costUsd, env("USD_TO_EUR")), meta: { platform, tool, cost_usd: done.costUsd } });
  }
  return done.answer;
}

async function capturePlatform(studioId: string, platform: Platform, handle: string): Promise<number> {
  const db = supabaseAdmin();
  let done = 0;
  const profile = readPublicProfile(await call(studioId, platform, "profile", handle));
  if (profile) {
    const row: Record<string, unknown> = { studio_id: studioId, platform, day: isoDay(Date.now() - DAY_MS), followers: profile.followers, captured_at: new Date().toISOString() };
    if (platform === "tiktok" && profile.likes !== null) row.likes_total = profile.likes;
    check(await db.from("account_daily").upsert(row, { onConflict: "studio_id,platform,day" }));
    done++;
  }
  // A private account shows nothing of its videos.
  if (profile?.private) return done;

  const { data: posts } = await db
    .from("posts")
    .select("id, kind, status, caption, created_at, external_ids")
    .eq("studio_id", studioId)
    .in("kind", ["reel", "post"])
    .gte("created_at", new Date(Date.now() - LOOK_BACK_MS).toISOString());
  const external = (p: { external_ids: unknown }) => ((p.external_ids as Record<string, External> | null) ?? {})[platform] ?? {};
  const linkedHere = (p: { external_ids: unknown }) => {
    const e = external(p);
    return Boolean(e.public_id ?? e.media_id ?? e.post_id);
  };
  const waiting = (posts ?? []).filter((p) => !linkedHere(p) && (p.caption as string | null)?.trim() && !["skipped", "failed"].includes(p.status as string));
  const measured = (posts ?? []).filter((p) => {
    const e = external(p);
    return e.public_id && e.published_at && Date.now() - new Date(e.published_at).getTime() < MEASURE_FOR_MS;
  });
  // Nothing of ours to find or to measure: no need to read her videos.
  if (!waiting.length && !measured.length) return done;
  const videos = readPublicVideos(platform, await call(studioId, platform, "videos", handle), handle);
  if (!videos.length) return done;
  const byId = new Map(videos.map((v) => [v.id, v]));

  const taken = new Set((posts ?? []).map((p) => external(p).public_id).filter((id): id is string => Boolean(id)));
  const found = matchPublicVideos(
    waiting.map((p) => ({ id: p.id as string, caption: p.caption as string, createdAt: new Date(p.created_at as string).getTime() })),
    videos,
    taken,
  );
  const toMeasure: { postId: string; video: PublicVideo; status: string }[] = measured.flatMap((p) => {
    const video = byId.get(external(p).public_id!);
    return video ? [{ postId: p.id as string, video, status: p.status as string }] : [];
  });
  for (const { postId, video } of found) {
    const post = (posts ?? []).find((p) => p.id === postId)!;
    const publishedAt = new Date(video.at).toISOString();
    const online = ["published", "measured"].includes(post.status as string);
    check(
      await db
        .from("posts")
        .update({
          ...(online ? {} : { status: "published", published_at: publishedAt }),
          external_ids: { ...((post.external_ids as object | null) ?? {}), [platform]: { public_id: video.id, permalink: video.url, published_at: publishedAt, public: true } },
        })
        .eq("id", postId),
    );
    toMeasure.push({ postId, video, status: online ? (post.status as string) : "published" });
    done++;
  }

  for (const { postId, video, status } of toMeasure) {
    const last = await db
      .from("metrics")
      .select("captured_at")
      .eq("post_id", postId)
      .eq("platform", platform)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.data && Date.now() - new Date(last.data.captured_at as string).getTime() < EVERY_MS) continue;
    check(
      await db.from("metrics").insert({ studio_id: studioId, post_id: postId, platform, views: video.views, likes: video.likes, comments: video.comments, saves: video.saves }),
    );
    if (status === "published" && Date.now() - video.at > 2 * DAY_MS) await db.from("posts").update({ status: "measured" }).eq("id", postId);
    done++;
  }
  return done;
}

/** Cron entry: a few studios with an @ per run, those read longest ago first, each once a day. */
export async function capturePublicStats(): Promise<number> {
  const db = supabaseAdmin();
  const { data: studios } = await db
    .from("studios")
    .select("id, instagram_handle, tiktok_handle")
    .or("instagram_handle.not.is.null,tiktok_handle.not.is.null")
    .or(`public_stats_at.is.null,public_stats_at.lt.${new Date(Date.now() - EVERY_MS).toISOString()}`)
    .order("public_stats_at", { ascending: true, nullsFirst: true })
    .limit(STUDIOS_PER_RUN);
  if (!studios?.length) return 0;
  const { data: connected } = await db
    .from("social_accounts")
    .select("studio_id, platform")
    .eq("status", "connected")
    .in(
      "studio_id",
      studios.map((s) => s.id as string),
    );
  let done = 0;
  for (const studio of studios) {
    // Its turn comes back tomorrow, whatever this read gives (a failed read is not retried every 5 min).
    await db.from("studios").update({ public_stats_at: new Date().toISOString() }).eq("id", studio.id);
    const linked = new Set((connected ?? []).filter((c) => c.studio_id === studio.id).map((c) => c.platform as string));
    for (const platform of ["instagram", "tiktok"] as const) {
      const handle = studio[`${platform}_handle`] as string | null;
      if (!handle || linked.has(platform)) continue;
      done += await capturePlatform(studio.id as string, platform, handle).catch((error: unknown) => {
        console.error("public stats failed", studio.id, platform, error);
        return 0;
      });
    }
  }
  return done;
}
