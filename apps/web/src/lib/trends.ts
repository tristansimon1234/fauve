import "server-only";
import {
  ANALYST_MODEL,
  beautifulTrends,
  captionHashtags,
  cleanHook,
  cleanTags,
  cleanWhy,
  coverReadSchema,
  claudeCostUsd,
  hashtagPostsIn,
  HOOK_FORM_LABELS,
  hashtagVolumes,
  instagramTopPosts,
  instagramTrends,
  keptTrends,
  nextCursorIn,
  nextTags,
  otherLang,
  scopeKey,
  TREND_COVER_PROMPT,
  TREND_HOOK_PASS,
  TREND_KEEP,
  TREND_LANG_LABELS,
  TREND_PAGES,
  TREND_PLATFORMS,
  TREND_REFRESH_DAYS,
  TREND_SCOPES,
  trendHashtags,
  tiktokTrends,
  trendLangOf,
  trendPlan,
  trendQueryOf,
  usdToEur,
  type CoverRead,
  type HashtagCount,
  type HookForm,
  type LearnedTag,
  type HashtagVolume,
  type TrendLang,
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
// through Treg (packages/agent/src/trends.ts): « Les plus belles », « Ce qui cartonne » (her trade's
// words, everywhere her language is spoken) and her city's. Each list is shared by every studio with
// the same words and language; covers copied once into our storage (the providers' links expire
// within hours).

type Source = { id: string; body: Record<string, unknown>; read: (answer: unknown) => TrendVideo[]; pages: number };

/** Where each list comes from: TikTok's keyword search (most liked of the month), Instagram's own top posts on the trade's hashtags (with their views), and its keyword search for the city. */
function sources(search: TrendSearch, platform: TrendPlatform, extra: string[] = []): Source[] {
  const tiktok = (query: string) => ({ id: "anyapi.tiktok.search.videos", body: { query, sortBy: 1, datePosted: 30 }, read: tiktokTrends, pages: TREND_PAGES });
  // TikTok has no language filter: in French, the trade's words are also searched with « france »
  // (« pilates france »), and the videos posted elsewhere are left out (inTrendLang).
  const national = search.country ? [tiktok(search.country)] : [];
  // The most beautiful are picked from a bigger pool: the « aesthetic » search and the trade's own.
  if (platform === "tiktok") return search.scope === "beau" ? [tiktok(search.words), tiktok(search.trade), ...national, ...extra.slice(0, 1).map((tag) => tiktok(tag))] : [tiktok(search.words), ...national];
  const tops = [...search.hashtags, ...extra].map((hashtag) => ({ id: "anyapi.instagram.hashtag_top_posts", body: { hashtag }, read: instagramTopPosts, pages: 2 }));
  return search.scope === "local" ? [...tops, { id: "anyapi.instagram.search.reels", body: { query: search.words }, read: instagramTrends, pages: 2 }] : tops;
}

const COVERS = "trends";

/** The words searched for a studio's trade (hers, else its activity) and the language of its videos; null when nothing is known. */
export async function studioTrends(studioId: string): Promise<{ query: string; lang: TrendLang } | null> {
  const { data } = await supabaseAdmin().from("studios").select("trend_query, trend_lang, business_type").eq("id", studioId).maybeSingle();
  const query = trendQueryOf(data?.trend_query as string | null, data?.business_type as string | null);
  return query ? { query, lang: trendLangOf(data?.trend_lang) } : null;
}

type Searched = Record<TrendScope, Partial<Record<TrendPlatform, string>>> & { running: boolean };

/** A search marked as running (found = -1) longer than this has died: it can be taken again. */
const RUNNING_MINUTES = 10;
const runningSince = () => new Date(Date.now() - RUNNING_MINUTES * 60_000).toISOString();

/** When each list of a trade was last searched (absent: never, or a search that died), and whether one is running. */
export async function lastSearched(query: string, lang: TrendLang): Promise<Searched> {
  const plan = trendPlan(query, lang);
  const keys = TREND_SCOPES.map((scope) => scopeKey(plan[scope]));
  const { data } = await supabaseAdmin().from("trend_searches").select("key, platform, fetched_at, found").in("key", keys);
  const out: Searched = { trend: {}, beau: {}, local: {}, running: false };
  const dead = runningSince();
  for (const r of data ?? []) {
    const scope = TREND_SCOPES[keys.indexOf(r.key as string)];
    const at = r.fetched_at as string;
    if (Number(r.found) === -1) {
      if (at < dead) continue;
      out.running = true;
    }
    if (scope) out[scope][r.platform as TrendPlatform] = at;
  }
  return out;
}

/**
 * Takes a list to search it, so that the page (refreshed every few seconds while it waits) and the
 * weekly run never search the same list twice at once: the first to mark it running (found = -1) wins.
 */
async function claimList(search: TrendSearch, platform: TrendPlatform): Promise<boolean> {
  const db = supabaseAdmin();
  const key = scopeKey(search);
  const now = new Date().toISOString();
  const { data: added } = await db
    .from("trend_searches")
    .upsert({ key, platform, query: search.words, fetched_at: now, found: -1 }, { onConflict: "key,platform", ignoreDuplicates: true })
    .select("key");
  if (added?.length) return true;
  const stale = new Date(Date.now() - TREND_REFRESH_DAYS * 86_400_000).toISOString();
  const { data: taken } = await db
    .from("trend_searches")
    .update({ fetched_at: now, found: -1 })
    .eq("key", key)
    .eq("platform", platform)
    .or(`fetched_at.lt.${stale},and(found.eq.-1,fetched_at.lt.${runningSince()})`)
    .select("key");
  return Boolean(taken?.length);
}

/** A search that failed is given back, to be tried again at the next visit or run. */
async function releaseList(search: TrendSearch, platform: TrendPlatform): Promise<void> {
  await supabaseAdmin().from("trend_searches").update({ fetched_at: new Date(0).toISOString(), found: 0 }).eq("key", scopeKey(search)).eq("platform", platform);
}

/** The month « 2026-10 » in her timezone, for the free changes of her words. */
export function monthIn(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
}

/** True when a platform's search is missing or older than TREND_REFRESH_DAYS. */
export function isStale(fetchedAt: string | undefined, now = Date.now()) {
  return !fetchedAt || now - Date.parse(fetchedAt) > TREND_REFRESH_DAYS * 86_400_000;
}

/** True when any list of a trade is due. */
export const anyStale = (last: Searched) => TREND_SCOPES.some((scope) => TREND_PLATFORMS.some((p) => isStale(last[scope][p])));

/** An image at a link as a small WebP (360 px wide); null when it cannot be fetched or read. */
async function smallWebp(link: string): Promise<Buffer | null> {
  try {
    const res = await fetch(link, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    return await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 360, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  } catch {
    return null;
  }
}

/** TikTok's public oEmbed gives a video's cover as a JPEG (free, no key). */
async function tiktokThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { thumbnail_url?: unknown };
    return typeof body.thumbnail_url === "string" && body.thumbnail_url.startsWith("https://") ? body.thumbnail_url : null;
  } catch {
    return null;
  }
}

/**
 * A cover as a small WebP; null when none can be read. TikTok often gives its covers in HEIC, which
 * sharp cannot open here: its oEmbed JPEG is taken instead (otherwise most TikTok cards had no image,
 * and « Les plus belles » never saw them).
 */
async function coverImage(video: TrendVideo): Promise<Buffer | null> {
  const direct = video.cover ? await smallWebp(video.cover) : null;
  if (direct || video.platform !== "tiktok") return direct;
  const thumbnail = await tiktokThumbnail(video.url);
  return thumbnail ? smallWebp(thumbnail) : null;
}

/** Copies a cover into our storage (the providers' links expire within hours); its path, or null. */
async function keepCover(key: string, video: TrendVideo, image?: Buffer | null): Promise<string | null> {
  const webp = image === undefined ? await coverImage(video) : image;
  if (!webp) return null;
  const slug = key.replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "trade";
  const path = `${COVERS}/${slug}/${video.platform}-${video.external_id.replace(/[^\w-]/g, "")}.webp`;
  const { error } = await supabaseAdmin().storage.from("media").upload(path, webp, { contentType: "image/webp", upsert: true });
  return error ? null : path;
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

type Chosen = { video: TrendVideo; image: Buffer | null; read?: CoverRead };

/**
 * Sonnet looks at the covers (240 px wide, about 140 tokens each): their beauty, whether they are about
 * her trade, the hook written on them and what makes them inspiring (TREND_COVER_PROMPT). « Les plus
 * belles » keeps the truly beautiful ones, the most beautiful first, and stays empty on a failure rather
 * than showing ordinary ones; the other lists keep the ones about her trade, the most watched first, and
 * all of them on a failure.
 */
async function readCovers(search: TrendSearch, videos: TrendVideo[]): Promise<Chosen[]> {
  const fetched = await Promise.all(videos.map(async (video) => ({ video, image: await coverImage(video) })));
  const seen = await Promise.all(
    fetched.flatMap((v) => (v.image ? [v as { video: TrendVideo; image: Buffer }] : [])).map(async (v) => ({ ...v, small: await sharp(v.image).resize({ width: 240 }).webp({ quality: 70 }).toBuffer() })),
  );
  const beau = search.scope === "beau";
  let reads: CoverRead[] | null = null;
  if (seen.length) {
    try {
      const response = await anthropic().beta.messages.parse({
        model: ANALYST_MODEL,
        max_tokens: 3000,
        output_config: { effort: "low", format: outputFormat(coverReadSchema) },
        system: TREND_COVER_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: JSON.stringify({ trade: search.trade, list: search.city ? `videos from ${search.city}` : "her trade everywhere", her_language: search.lang === "all" ? "any" : TREND_LANG_LABELS[search.lang] }) },
              ...seen.flatMap((v, i) => [
                { type: "text" as const, text: JSON.stringify({ n: i + 1, account: v.video.author ?? undefined, caption: Array.from(v.video.caption).slice(0, 160).join("") || "(no caption)" }) },
                { type: "image" as const, source: { type: "base64" as const, media_type: "image/webp" as const, data: v.small.toString("base64") } },
              ]),
            ],
          },
        ],
      });
      const usd = claudeCostUsd(ANALYST_MODEL, response.usage);
      await supabaseAdmin()
        .from("cost_events")
        .insert({ studio_id: null, kind: "llm", provider: "anthropic", units: response.usage.input_tokens + response.usage.output_tokens, cost_eur: usdToEur(usd, env("USD_TO_EUR")), meta: { model: ANALYST_MODEL, purpose: "trends_covers", cost_usd: usd, key: scopeKey(search) } });
      reads = response.parsed_output?.videos ?? null;
    } catch (error) {
      console.warn("trends: cover read failed", scopeKey(search), error);
    }
  }
  const readOf = (i: number) => reads?.find((r) => r.n === i + 1);
  // Its cover is in another language than hers (the caption did not tell): left out.
  const foreign = (i: number) => otherLang(readOf(i), search.lang);
  if (beau) {
    if (!reads) return [];
    const order = beautifulTrends(seen.map((v) => v.video), reads.filter((r) => !foreign(r.n - 1)));
    return order.flatMap((video) => {
      const i = seen.findIndex((v) => v.video === video);
      return i < 0 ? [] : [{ video, image: seen[i]!.image, read: readOf(i) }];
    });
  }
  // The others: about her trade (when Sonnet could tell), in their order (the most watched first).
  return fetched.flatMap((v) => {
    const i = seen.findIndex((s) => s.video === v.video);
    const read = i < 0 ? undefined : readOf(i);
    return (read && !read.on_topic) || (i >= 0 && foreign(i)) ? [] : [{ video: v.video, image: v.image, read }];
  });
}

/** The hashtags learned for a trade's « Les plus belles » (trend_tags). */
async function learnedTags(key: string): Promise<LearnedTag[]> {
  const { data } = await supabaseAdmin().from("trend_tags").select("hashtag, seen, score").eq("key", key);
  return (data ?? []).map((r) => ({ hashtag: r.hashtag as string, seen: Number(r.seen), score: Number(r.score) }));
}

/**
 * Learns from the most beautiful posts of the week: each hashtag of a post rated 8 or more counts once
 * more, with the beauty above 7 added to its score; the ones that stop coming back fade (×0.7 a week).
 */
async function learnTags(key: string, chosen: Chosen[]): Promise<void> {
  const tags = new Map<string, number>();
  for (const c of chosen) {
    if (!c.read || c.read.beauty < 8) continue;
    for (const tag of captionHashtags(c.video.caption)) tags.set(tag, (tags.get(tag) ?? 0) + (c.read.beauty - 7));
  }
  const before = await learnedTags(key);
  const now = new Date().toISOString();
  const rows = [
    ...before.map((t) => ({ key, hashtag: t.hashtag, seen: t.seen + (tags.has(t.hashtag) ? 1 : 0), score: Math.round((t.score * 0.7 + (tags.get(t.hashtag) ?? 0)) * 100) / 100, updated_at: now })),
    ...[...tags].filter(([tag]) => !before.some((t) => t.hashtag === tag)).map(([hashtag, score]) => ({ key, hashtag, seen: 1, score, updated_at: now })),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
  if (rows.length) await supabaseAdmin().from("trend_tags").upsert(rows, { onConflict: "key,hashtag" });
}

/**
 * Searches one list on one platform again: its videos replace the ones kept before (and their
 * covers). Logs what Treg charged. Returns how many were kept; null without a Treg key.
 */
async function refreshList(search: TrendSearch, platform: TrendPlatform): Promise<number | null> {
  const key = scopeKey(search);
  // « Les plus belles » also searches the hashtags its most beautiful posts brought (nextTags).
  const extra = search.scope === "beau" ? nextTags(await learnedTags(key), search.hashtags) : [];
  const read = await Promise.all(sources(search, platform, extra).map(async (source) => ({ source, pages: await sourcePages(source) })));
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
  const strong = keptTrends(read.flatMap((r) => (r.pages ?? []).flatMap((page) => r.source.read(page.answer))), search.scope, new Date(), search.lang);
  // Every list is read on its covers: the most beautiful chosen there, the others kept when about her trade.
  const looked = await readCovers(search, strong.slice(0, search.scope === "beau" ? 24 : 16));
  if (search.scope === "beau") await learnTags(key, looked).catch((error: unknown) => console.warn("trends: tags not learned", key, error));
  const chosen = looked.slice(0, TREND_KEEP);
  const kept = chosen.map((c) => c.video);
  const fetchedAt = new Date().toISOString();
  if (!kept.length) console.warn("trends: nothing kept", platform, key, JSON.stringify(called[0]?.answer ?? null).slice(0, 400));
  const covers = await Promise.all(chosen.map((c) => keepCover(key, c.video, c.image)));
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
    beauty: chosen[rank]?.read?.beauty ?? null,
    hook: cleanHook(chosen[rank]?.read?.hook) || null,
    hook_form: cleanHook(chosen[rank]?.read?.hook) ? (chosen[rank]?.read?.hook_form ?? null) : null,
    hook_score: cleanHook(chosen[rank]?.read?.hook) ? (chosen[rank]?.read?.hook_score ?? null) : null,
    hook_why: cleanWhy(chosen[rank]?.read) || null,
    lang: chosen[rank]?.read?.lang ?? null,
    tags: cleanTags(chosen[rank]?.read?.tags),
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

/** Searches every list of a trade whose search is stale, each list taken by one search at a time (claimList). */
export async function refreshTrends(query: string, lang: TrendLang): Promise<Record<string, number | null>> {
  const plan = trendPlan(query, lang);
  const last = await lastSearched(query, lang);
  const stale = TREND_SCOPES.flatMap((scope) => TREND_PLATFORMS.filter((p) => isStale(last[scope][p])).map((platform) => ({ scope, platform })));
  const claimed = await Promise.all(stale.map(({ scope, platform }) => claimList(plan[scope], platform)));
  const due = stale.filter((_, i) => claimed[i]);
  const found = await Promise.all([
    ...due.map(async ({ scope, platform }) => {
      const kept = await refreshList(plan[scope], platform).catch((error: unknown) => (console.error("trends: refresh failed", platform, scopeKey(plan[scope]), error), null));
      if (kept === null) await releaseList(plan[scope], platform);
      return kept;
    }),
    ...(due.length ? [countHashtags(query, lang).then(() => null)] : []),
  ]);
  return Object.fromEntries(due.map(({ scope, platform }, i) => [`${scope}:${platform}`, found[i] ?? null]));
}

/**
 * Counts the posts on the trade's hashtags today (Instagram, AnyAPI's hashtag analytics, about
 * $0.0011 each), kept day by day so the page shows how many were added in a week.
 */
async function countHashtags(query: string, lang: TrendLang): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const tags = trendHashtags(query, lang);
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
  // The lists of before the scopes and languages (keys without « trend:xx: », « beau:xx: » or « local:xx: »).
  const current = "^(trend|beau|local):[a-z]+:";
  await forgetVideos(db.from("trend_videos").select("id, cover_path").not("key", "match", current));
  await db.from("trend_searches").delete().not("key", "match", current);
}

export type TrendCard = {
  id: string;
  platform: TrendPlatform;
  /** The video's id on its platform: TikTok's number, Instagram's shortcode (for the player in the app). */
  externalId: string;
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
  /** The words written on its first image when they make a hook that works (TREND_HOOK_PASS), their form and why they work; what makes it inspiring. */
  hook: string | null;
  hookForm: HookForm | null;
  hookScore: number | null;
  hookWhy: string | null;
  tags: string[];
};

export type TrendLists = {
  trend: TrendCard[];
  beau: TrendCard[];
  local: TrendCard[];
  /** The hooks that work right now in her trade (read on the covers), the most watched first. */
  hooks: TrendCard[];
  words: Record<TrendScope, string>;
  hashtags: HashtagVolume[];
  fetchedAt: string | null;
};

/** The lists of a trade in her language, the most watched first, with signed covers. */
export async function trendCards(query: string, lang: TrendLang): Promise<TrendLists> {
  const plan = trendPlan(query, lang);
  const keys = TREND_SCOPES.map((scope) => scopeKey(plan[scope]));
  const db = supabaseAdmin();
  const tags = trendHashtags(query, lang);
  const [{ data: rows }, { data: searched }, { data: counts }] = await Promise.all([
    db
      .from("trend_videos")
      .select("id, key, platform, external_id, url, caption, author, views, likes, comments, sound, duration, posted_at, cover_path, hook, hook_form, hook_score, hook_why, tags")
      .in("key", keys)
      .order("rank", { ascending: true }),
    db.from("trend_searches").select("fetched_at").in("key", keys),
    db.from("trend_hashtags").select("hashtag, counted_on, posts").in("hashtag", tags).gte("counted_on", new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const paths = (rows ?? []).flatMap((r) => (r.cover_path ? [r.cover_path as string] : []));
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 3600)).data ?? []) : [];
  const urls = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  // Only a hook that works is shown as one: a title or a label is not.
  const strong = (r: NonNullable<typeof rows>[number]) => Boolean(r.hook) && Number(r.hook_score ?? 0) >= TREND_HOOK_PASS;
  const card = (r: NonNullable<typeof rows>[number]): TrendCard => ({
    id: r.id as string,
    platform: r.platform as TrendPlatform,
    externalId: r.external_id as string,
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
    hook: strong(r) ? (r.hook as string) : null,
    hookForm: strong(r) ? ((r.hook_form as HookForm | null) ?? null) : null,
    hookScore: strong(r) ? Number(r.hook_score) : null,
    hookWhy: strong(r) ? ((r.hook_why as string | null) || null) : null,
    tags: (r.tags as string[] | null) ?? [],
  });
  const of = (scope: TrendScope) => (rows ?? []).filter((r) => r.key === scopeKey(plan[scope])).map(card);
  const dates = (searched ?? []).map((r) => r.fetched_at as string).sort();
  const volumes = hashtagVolumes(((counts ?? []) as { hashtag: string; counted_on: string; posts: number | string }[]).map((c): HashtagCount => ({ ...c, posts: Number(c.posts) })), tags);
  const all = (rows ?? []).map(card);
  // The strongest first, then the most watched; one per account (a series repeats its hook) and per hook.
  const ranked = all.filter((c) => c.hook).sort((a, b) => (b.hookScore ?? 0) - (a.hookScore ?? 0) || (b.views ?? (b.likes ?? 0) * 20) - (a.views ?? (a.likes ?? 0) * 20));
  const hooks = firstOf(
    firstOf(ranked, (c) => c.author?.toLowerCase() ?? c.id),
    (c) => c.hook!.toLowerCase(),
  ).slice(0, 10);
  return { trend: of("trend"), beau: of("beau"), local: of("local"), hooks, words: { trend: plan.trend.words, beau: plan.beau.words, local: plan.local.words }, hashtags: volumes, fetchedAt: dates.at(-1) ?? null };
}

/** The first of each key, in order. */
function firstOf<T>(list: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * The hooks that work right now in a studio's trade (read on the covers of its lists), for the hook
 * judge: their form and the example, never words to take (HOOK_JUDGE_PROMPT says so). Empty when none.
 */
export async function momentHooks(studioId: string): Promise<{ forme: string; exemple: string }[]> {
  const trends = await studioTrends(studioId).catch(() => null);
  if (!trends) return [];
  const plan = trendPlan(trends.query, trends.lang);
  const { data } = await supabaseAdmin()
    .from("trend_videos")
    .select("hook, hook_form, views")
    .in("key", [scopeKey(plan.trend), scopeKey(plan.beau), scopeKey(plan.local)])
    .not("hook", "is", null)
    .gte("hook_score", TREND_HOOK_PASS)
    .order("hook_score", { ascending: false })
    .order("views", { ascending: false, nullsFirst: false })
    .limit(8);
  return (data ?? []).map((r) => ({ forme: HOOK_FORM_LABELS[(r.hook_form as HookForm | null) ?? "autre"] ?? "Accroche", exemple: r.hook as string }));
}

/** The trades to search each week, with their language: those of the real studios (lab studios aside), each once. */
export async function tradesToSearch(): Promise<{ query: string; lang: TrendLang }[]> {
  const { data } = await supabaseAdmin().from("studios").select("trend_query, trend_lang, business_type, website_url");
  const trades = (data ?? [])
    .filter((s) => !String(s.website_url ?? "").startsWith("lab://"))
    .flatMap((s) => {
      const query = trendQueryOf(s.trend_query as string | null, s.business_type as string | null);
      return query ? [{ query, lang: trendLangOf(s.trend_lang) }] : [];
    });
  return [...new Map(trades.map((t) => [`${t.lang}:${t.query.replace(/\s+/g, " ").trim().toLowerCase()}`, t])).values()];
}
