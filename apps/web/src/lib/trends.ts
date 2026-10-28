import "server-only";
import {
  ANALYST_MODEL,
  claudeCostUsd,
  hashtagPostsIn,
  hashtagVolumes,
  instagramTopPosts,
  instagramTrends,
  keptTrends,
  nextCursorIn,
  scopeKey,
  TREND_FILTER_PROMPT,
  TREND_KEEP,
  TREND_PAGES,
  TREND_PLATFORMS,
  TREND_REFRESH_DAYS,
  TREND_SCOPES,
  trendFilterSchema,
  trendHashtags,
  tiktokTrends,
  trendPlan,
  trendQueryOf,
  usdToEur,
  type HashtagCount,
  type HashtagVolume,
  type TrendPlatform,
  type TrendScope,
  type TrendSearch,
  type TrendVideo,
} from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import sharp from "sharp";
import { anthropic } from "@/lib/agent/run";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tregCall } from "@/lib/treg";

// The page Tendances: what works right now in her trade, on TikTok and Instagram, searched each week
// through Treg (packages/agent/src/trends.ts): « Ce qui cartonne » (her trade's words, worldwide) and
// « Près de chez toi » (with her city). Each list is shared by every studio with the same words;
// covers copied once into our storage (the providers' links expire within hours).

type Source = { id: string; body: Record<string, unknown>; read: (answer: unknown) => TrendVideo[]; pages: number };

/** Where each list comes from: TikTok's keyword search (most liked of the month), Instagram's own top posts on the trade's hashtags (with their views), and its keyword search for the city. */
function sources(search: TrendSearch, platform: TrendPlatform): Source[] {
  if (platform === "tiktok") return [{ id: "anyapi.tiktok.search.videos", body: { query: search.words, sortBy: 1, datePosted: 30 }, read: tiktokTrends, pages: TREND_PAGES }];
  const tops = search.hashtags.map((hashtag) => ({ id: "anyapi.instagram.hashtag_top_posts", body: { hashtag }, read: instagramTopPosts, pages: 2 }));
  return search.scope === "local" ? [...tops, { id: "anyapi.instagram.search.reels", body: { query: search.words }, read: instagramTrends, pages: 2 }] : tops;
}

const COVERS = "trends";

/** The words searched for a studio's trade: hers, else its activity; null when nothing is known. */
export async function studioTrendQuery(studioId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("studios").select("trend_query, business_type").eq("id", studioId).maybeSingle();
  return trendQueryOf(data?.trend_query as string | null, data?.business_type as string | null);
}

type Searched = Record<TrendScope, Partial<Record<TrendPlatform, string>>>;

/** When each list of a trade was last searched (absent: never). */
export async function lastSearched(query: string): Promise<Searched> {
  const plan = trendPlan(query);
  const keys = TREND_SCOPES.map((scope) => scopeKey(plan[scope]));
  const { data } = await supabaseAdmin().from("trend_searches").select("key, platform, fetched_at").in("key", keys);
  const out: Searched = { trend: {}, local: {} };
  for (const r of data ?? []) {
    const scope = TREND_SCOPES[keys.indexOf(r.key as string)];
    if (scope) out[scope][r.platform as TrendPlatform] = r.fetched_at as string;
  }
  return out;
}

/** True when a platform's search is missing or older than TREND_REFRESH_DAYS. */
export function isStale(fetchedAt: string | undefined, now = Date.now()) {
  return !fetchedAt || now - Date.parse(fetchedAt) > TREND_REFRESH_DAYS * 86_400_000;
}

/** True when any list of a trade is due. */
export const anyStale = (last: Searched) => TREND_SCOPES.some((scope) => TREND_PLATFORMS.some((p) => isStale(last[scope][p])));

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

/** One source read page after page (while there is a next one); null without a Treg key. */
async function sourcePages(source: Source): Promise<{ answer: unknown; costUsd: number }[] | null> {
  const pages: { answer: unknown; costUsd: number }[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < source.pages; page++) {
    const called = await tregCall(source.id, { ...source.body, ...(cursor ? { cursor } : {}) }, 0.02);
    if (!called) return page ? pages : null;
    pages.push(called);
    cursor = nextCursorIn(called.answer);
    if (!cursor || !called.answer) break;
  }
  return pages;
}

/**
 * Only the videos really about her trade (a travel list or a matcha vlog borrows « pilates paris »):
 * Sonnet reads their captions. On a failure, all of them stay.
 */
async function onTopic(search: TrendSearch, videos: TrendVideo[]): Promise<TrendVideo[]> {
  if (!videos.length) return videos;
  try {
    const response = await anthropic().beta.messages.parse({
      model: ANALYST_MODEL,
      max_tokens: 600,
      output_config: { effort: "low", format: outputFormat(trendFilterSchema) },
      system: TREND_FILTER_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            trade: search.trade,
            list: search.city ? `videos from ${search.city}` : "worldwide",
            videos: videos.map((v, i) => ({ n: i + 1, account: v.author ?? undefined, caption: v.caption || "(no caption)" })),
          }),
        },
      ],
    });
    const usd = claudeCostUsd(ANALYST_MODEL, response.usage);
    await supabaseAdmin()
      .from("cost_events")
      .insert({ studio_id: null, kind: "llm", provider: "anthropic", units: response.usage.input_tokens + response.usage.output_tokens, cost_eur: usdToEur(usd, env("USD_TO_EUR")), meta: { model: ANALYST_MODEL, purpose: "trends", cost_usd: usd, key: scopeKey(search) } });
    const keep = new Set(response.parsed_output?.keep ?? videos.map((_, i) => i + 1));
    return videos.filter((_, i) => keep.has(i + 1));
  } catch (error) {
    console.warn("trends: topic filter failed", scopeKey(search), error);
    return videos;
  }
}

/**
 * Searches one list on one platform again: its videos replace the ones kept before (and their
 * covers). Logs what Treg charged. Returns how many were kept; null without a Treg key.
 */
async function refreshList(search: TrendSearch, platform: TrendPlatform): Promise<number | null> {
  const key = scopeKey(search);
  const read = await Promise.all(sources(search, platform).map(async (source) => ({ source, pages: await sourcePages(source) })));
  if (read.some((r) => !r.pages)) return null;
  const called = read.flatMap((r) => r.pages ?? []);
  const costUsd = called.reduce((sum, c) => sum + c.costUsd, 0);
  const db = supabaseAdmin();
  await db.from("cost_events").insert({
    studio_id: null,
    kind: "trends",
    provider: "treg",
    units: called.length,
    cost_eur: usdToEur(costUsd, env("USD_TO_EUR")),
    meta: { query: key, platform, cost_usd: costUsd },
  });
  const strong = keptTrends(read.flatMap((r) => (r.pages ?? []).flatMap((page) => r.source.read(page.answer))), search.scope);
  const kept = (await onTopic(search, strong.slice(0, 20))).slice(0, TREND_KEEP);
  const fetchedAt = new Date().toISOString();
  if (!kept.length) console.warn("trends: nothing kept", platform, key, JSON.stringify(called[0]?.answer ?? null).slice(0, 400));
  const covers = await Promise.all(kept.map((v) => keepCover(key, v)));
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
  if (rows.length) {
    const { error } = await db.from("trend_videos").upsert(rows, { onConflict: "key,platform,external_id" });
    if (error) throw new Error(`trend_videos: ${error.message}`);
  }
  // Everything not written by this search goes, so two searches running at once never mix their lists.
  await forgetVideos(db.from("trend_videos").select("id, cover_path").eq("key", key).eq("platform", platform).neq("fetched_at", fetchedAt));
  await db.from("trend_searches").upsert({ key, platform, query: search.words, fetched_at: fetchedAt, found: kept.length, cost_usd: costUsd }, { onConflict: "key,platform" });
  return kept.length;
}

/** Deletes the videos a query finds, and their covers. */
async function forgetVideos(query: PromiseLike<{ data: { id: unknown; cover_path: unknown }[] | null }>) {
  const { data } = await query;
  if (!data?.length) return;
  const db = supabaseAdmin();
  await db.from("trend_videos").delete().in("id", data.map((r) => r.id as string));
  const paths = data.flatMap((r) => (r.cover_path ? [r.cover_path as string] : []));
  if (paths.length) await db.storage.from("media").remove(paths);
}

/** Searches both lists of a trade on every platform whose search is stale (or all of them with `force`). */
export async function refreshTrends(query: string, { force = false } = {}): Promise<Record<string, number | null>> {
  const plan = trendPlan(query);
  const last = await lastSearched(query);
  const due = TREND_SCOPES.flatMap((scope) => TREND_PLATFORMS.filter((p) => force || isStale(last[scope][p])).map((platform) => ({ scope, platform })));
  const found = await Promise.all([
    ...due.map(({ scope, platform }) => refreshList(plan[scope], platform).catch((error: unknown) => (console.error("trends: refresh failed", platform, scopeKey(plan[scope]), error), null))),
    ...(due.length ? [countHashtags(query).then(() => null)] : []),
  ]);
  return Object.fromEntries(due.map(({ scope, platform }, i) => [`${scope}:${platform}`, found[i] ?? null]));
}

/**
 * Counts the posts on the trade's hashtags today (Instagram, AnyAPI's hashtag analytics, about
 * $0.0011 each), kept day by day so the page shows how many were added in a week.
 */
async function countHashtags(query: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const tags = trendHashtags(query);
  const db = supabaseAdmin();
  const { data: done } = await db.from("trend_hashtags").select("hashtag").in("hashtag", tags).eq("counted_on", today);
  const due = tags.filter((t) => !(done ?? []).some((d) => d.hashtag === t));
  const counted = await Promise.all(
    due.map(async (hashtag) => {
      const called = await tregCall("anyapi.instagram.hashtag_analytics", { hashtag }, 0.01).catch(() => null);
      return { hashtag, posts: called ? hashtagPostsIn(called.answer) : null, costUsd: called?.costUsd ?? 0 };
    }),
  );
  const rows = counted.flatMap((c) => (c.posts === null ? [] : [{ hashtag: c.hashtag, counted_on: today, posts: c.posts }]));
  if (rows.length) await db.from("trend_hashtags").upsert(rows, { onConflict: "hashtag,counted_on" });
  const costUsd = counted.reduce((sum, c) => sum + c.costUsd, 0);
  if (counted.length)
    await db.from("cost_events").insert({ studio_id: null, kind: "trends", provider: "treg", units: counted.length, cost_eur: usdToEur(costUsd, env("USD_TO_EUR")), meta: { hashtags: due, cost_usd: costUsd } });
}

/** Lists nobody searched for a month (a trade no studio has any more, or words she changed) go, with their videos. */
export async function forgetOldTrends(): Promise<void> {
  const db = supabaseAdmin();
  const before = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await db.from("trend_searches").select("key, platform").lt("fetched_at", before);
  for (const r of data ?? []) {
    await forgetVideos(db.from("trend_videos").select("id, cover_path").eq("key", r.key as string).eq("platform", r.platform as string));
    await db.from("trend_searches").delete().eq("key", r.key as string).eq("platform", r.platform as string);
  }
  // The lists of before the two scopes (keys without « trend: » or « local: »).
  await forgetVideos(db.from("trend_videos").select("id, cover_path").not("key", "like", "trend:%").not("key", "like", "local:%"));
  await db.from("trend_searches").delete().not("key", "like", "trend:%").not("key", "like", "local:%");
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

export type TrendLists = { trend: TrendCard[]; local: TrendCard[]; words: Record<TrendScope, string>; hashtags: HashtagVolume[]; fetchedAt: string | null };

/** Both lists of a trade, the most watched first, with signed covers. */
export async function trendCards(query: string): Promise<TrendLists> {
  const plan = trendPlan(query);
  const keys = TREND_SCOPES.map((scope) => scopeKey(plan[scope]));
  const db = supabaseAdmin();
  const tags = trendHashtags(query);
  const [{ data: rows }, { data: searched }, { data: counts }] = await Promise.all([
    db
      .from("trend_videos")
      .select("id, key, platform, url, caption, author, views, likes, comments, sound, duration, posted_at, cover_path")
      .in("key", keys)
      .order("rank", { ascending: true }),
    db.from("trend_searches").select("fetched_at").in("key", keys),
    db.from("trend_hashtags").select("hashtag, counted_on, posts").in("hashtag", tags).gte("counted_on", new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const paths = (rows ?? []).flatMap((r) => (r.cover_path ? [r.cover_path as string] : []));
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 3600)).data ?? []) : [];
  const urls = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const card = (r: NonNullable<typeof rows>[number]): TrendCard => ({
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
  });
  const of = (scope: TrendScope) => (rows ?? []).filter((r) => r.key === scopeKey(plan[scope])).map(card);
  const dates = (searched ?? []).map((r) => r.fetched_at as string).sort();
  const volumes = hashtagVolumes(((counts ?? []) as { hashtag: string; counted_on: string; posts: number | string }[]).map((c): HashtagCount => ({ ...c, posts: Number(c.posts) })), tags);
  return { trend: of("trend"), local: of("local"), words: { trend: plan.trend.words, local: plan.local.words }, hashtags: volumes, fetchedAt: dates.at(-1) ?? null };
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
  return [...new Map(queries.map((q) => [q.replace(/\s+/g, " ").trim().toLowerCase(), q])).values()];
}
