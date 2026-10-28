import "server-only";
import {
  instagramTrends,
  keptTrends,
  TREND_PLATFORMS,
  TREND_REFRESH_DAYS,
  tiktokTrends,
  trendKey,
  trendQueryOf,
  usdToEur,
  type TrendPlatform,
  type TrendVideo,
} from "@fauve/agent";
import sharp from "sharp";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tregCall } from "@/lib/treg";

// The page Tendances: what works right now in her trade, on TikTok and Instagram, searched each week
// through Treg with the words of her trade (packages/agent/src/trends.ts). One search per trade, the
// same for every studio of that trade; covers copied once into our storage (the providers' links
// expire within hours).

/** The tool of each platform: AnyAPI's keyword searches (TikTok: most liked of the last month). */
const SEARCH: Record<TrendPlatform, { id: string; body: (q: string) => Record<string, unknown>; read: (answer: unknown) => TrendVideo[] }> = {
  tiktok: { id: "anyapi.tiktok.search.videos", body: (query) => ({ query, sortBy: 1, datePosted: 30 }), read: tiktokTrends },
  instagram: { id: "anyapi.instagram.search.reels", body: (query) => ({ query }), read: instagramTrends },
};

const COVERS = "trends";

/** The words searched for a studio's trade: hers, else its activity; null when nothing is known. */
export async function studioTrendQuery(studioId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("studios").select("trend_query, business_type").eq("id", studioId).maybeSingle();
  return trendQueryOf(data?.trend_query as string | null, data?.business_type as string | null);
}

/** When a trade was last searched on each platform (absent: never). */
export async function lastSearched(query: string): Promise<Partial<Record<TrendPlatform, string>>> {
  const { data } = await supabaseAdmin().from("trend_searches").select("platform, fetched_at").eq("key", trendKey(query));
  return Object.fromEntries((data ?? []).map((r) => [r.platform as TrendPlatform, r.fetched_at as string]));
}

/** True when a platform's search is missing or older than TREND_REFRESH_DAYS. */
export function isStale(fetchedAt: string | undefined, now = Date.now()) {
  return !fetchedAt || now - Date.parse(fetchedAt) > TREND_REFRESH_DAYS * 86_400_000;
}

/** Copies a cover into our storage as a small WebP; null when it cannot be read (an HEIC cover sharp cannot open). */
async function keepCover(key: string, video: TrendVideo): Promise<string | null> {
  if (!video.cover) return null;
  try {
    const res = await fetch(video.cover, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const webp = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 360, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    const slug = key.replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "trade";
    const path = `${COVERS}/${slug}/${video.platform}-${video.external_id.replace(/[^\w-]/g, "")}.webp`;
    const { error } = await supabaseAdmin().storage.from("media").upload(path, webp, { contentType: "image/webp", upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

/**
 * Searches a trade again on one platform: its videos replace the ones kept before (and their covers).
 * Logs what Treg charged. Returns how many were kept; null without a Treg key.
 */
async function refreshPlatform(query: string, platform: TrendPlatform): Promise<number | null> {
  const key = trendKey(query);
  const search = SEARCH[platform];
  const called = await tregCall(search.id, search.body(query), 0.02);
  if (!called) return null;
  const db = supabaseAdmin();
  await db.from("cost_events").insert({
    studio_id: null,
    kind: "trends",
    provider: "treg",
    units: 1,
    cost_eur: usdToEur(called.costUsd, env("USD_TO_EUR")),
    meta: { query: key, platform, cost_usd: called.costUsd },
  });
  const kept = keptTrends(search.read(called.answer));
  // A failed search keeps last week's videos; it is tried again the next time.
  if (!kept.length) {
    console.warn("trends: nothing found", platform, key);
    return 0;
  }
  const { data: before } = await db.from("trend_videos").select("id, cover_path, external_id").eq("key", key).eq("platform", platform);
  const covers = await Promise.all(kept.map((v) => keepCover(key, v)));
  const fetchedAt = new Date().toISOString();
  const rows = kept.map((v, rank) => ({
    key,
    platform,
    external_id: v.external_id,
    url: v.url,
    caption: v.caption,
    author: v.author,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    sound: v.sound,
    duration: v.duration,
    posted_at: v.posted_at,
    cover_path: covers[rank],
    rank,
    fetched_at: fetchedAt,
  }));
  const { error } = await db.from("trend_videos").upsert(rows, { onConflict: "key,platform,external_id" });
  if (error) throw new Error(`trend_videos: ${error.message}`);
  const keptIds = new Set(kept.map((v) => v.external_id));
  const gone = (before ?? []).filter((r) => !keptIds.has(r.external_id as string));
  if (gone.length) {
    await db.from("trend_videos").delete().in("id", gone.map((r) => r.id as string));
    const paths = gone.flatMap((r) => (r.cover_path ? [r.cover_path as string] : []));
    if (paths.length) await db.storage.from("media").remove(paths);
  }
  await db.from("trend_searches").upsert({ key, platform, query, fetched_at: fetchedAt, found: kept.length, cost_usd: called.costUsd }, { onConflict: "key,platform" });
  return kept.length;
}

/** Searches a trade on every platform whose search is stale (or all of them with `force`). */
export async function refreshTrends(query: string, { force = false } = {}): Promise<Partial<Record<TrendPlatform, number | null>>> {
  const last = await lastSearched(query);
  const due = TREND_PLATFORMS.filter((p) => force || isStale(last[p]));
  const found = await Promise.all(due.map((p) => refreshPlatform(query, p).catch((error: unknown) => (console.error("trends: refresh failed", p, query, error), null))));
  return Object.fromEntries(due.map((p, i) => [p, found[i]]));
}

export type TrendCard = {
  id: string;
  platform: TrendPlatform;
  url: string;
  caption: string;
  author: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  sound: string | null;
  duration: number | null;
  postedAt: string | null;
  cover: string | null;
};

/** The videos kept for a trade, the most watched first on each platform, with signed covers. */
export async function trendCards(query: string): Promise<{ cards: TrendCard[]; fetchedAt: string | null }> {
  const key = trendKey(query);
  const db = supabaseAdmin();
  const [{ data: rows }, last] = await Promise.all([
    db
      .from("trend_videos")
      .select("id, platform, url, caption, author, views, likes, comments, sound, duration, posted_at, cover_path")
      .eq("key", key)
      .order("rank", { ascending: true }),
    lastSearched(query),
  ]);
  const paths = (rows ?? []).flatMap((r) => (r.cover_path ? [r.cover_path as string] : []));
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 3600)).data ?? []) : [];
  const urls = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const cards = (rows ?? []).map((r) => ({
    id: r.id as string,
    platform: r.platform as TrendPlatform,
    url: r.url as string,
    caption: r.caption as string,
    author: r.author as string | null,
    views: r.views === null ? null : Number(r.views),
    likes: r.likes === null ? null : Number(r.likes),
    comments: r.comments === null ? null : Number(r.comments),
    sound: r.sound as string | null,
    duration: r.duration === null ? null : Number(r.duration),
    postedAt: r.posted_at as string | null,
    cover: r.cover_path ? (urls.get(r.cover_path as string) ?? null) : null,
  }));
  const dates = Object.values(last).filter(Boolean) as string[];
  return { cards, fetchedAt: dates.sort().at(-1) ?? null };
}

/** The trades to search each week: those of the real studios (lab studios aside), each once. */
export async function tradesToSearch(): Promise<string[]> {
  const { data } = await supabaseAdmin().from("studios").select("trend_query, business_type, website_url");
  const queries = (data ?? [])
    .filter((s) => !String(s.website_url ?? "").startsWith("lab://"))
    .flatMap((s) => {
      const q = trendQueryOf(s.trend_query as string | null, s.business_type as string | null);
      return q ? [q] : [];
    });
  return [...new Map(queries.map((q) => [trendKey(q), q])).values()];
}
