import { z } from "zod";

// What works right now in her trade (Tristan: « une page tendance, où tu vois des vidéos qui
// fonctionnent », then « les tendances sont pas folles »): each week, two lists through Treg
// (AnyAPI, about $0.001 a call). « Ce qui cartonne »: her trade's broad words, worldwide (the
// formats that work, the ones worth copying), TikTok's most liked of the month and Instagram's own
// top posts on the trade's hashtags, with their real views. « Près de chez toi »: the same words
// with her city. Strict thresholds (five strong videos rather than twelve at a thousand views),
// then a quick read of their captions keeps only those really about her trade. Read loosely:
// the shapes are the provider's and may change.

export const TREND_PLATFORMS = ["tiktok", "instagram"] as const;
export type TrendPlatform = (typeof TREND_PLATFORMS)[number];

/** « trend »: what works in her trade, everywhere; « local »: what is posted in her city. */
export const TREND_SCOPES = ["trend", "local"] as const;
export type TrendScope = (typeof TREND_SCOPES)[number];

/** Searched again after this many days (a cron each week, or her page when it is older). */
export const TREND_REFRESH_DAYS = 6;
/** Videos kept per list and platform, the most watched first. */
export const TREND_KEEP = 8;
/** Older than this, a video is a classic, not a trend: never kept. */
export const TREND_MAX_AGE_DAYS = 120;
/** Fewer views than this is not shown, even when the list stays short. */
export const TREND_MIN_VIEWS: Record<TrendScope, Record<TrendPlatform, number>> = {
  trend: { tiktok: 100_000, instagram: 50_000 },
  local: { tiktok: 5_000, instagram: 5_000 },
};

export type TrendVideo = {
  platform: TrendPlatform;
  external_id: string;
  url: string;
  caption: string;
  author: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  sound: string | null;
  duration: number | null;
  posted_at: string | null;
  /** The cover's link at the provider (short-lived): copied to our storage when kept. */
  cover: string | null;
  /** Where TikTok says it was posted (« FR »), when it says. */
  region?: string | null;
};

const count = z.preprocess((v) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v), z.number().nonnegative().finite()).nullable().catch(null);
const text = z.string().nullable().catch(null);
const link = z.string().regex(/^https:\/\/\S+$/).nullable().catch(null);

const tiktokRow = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  url: link,
  caption: text,
  views: count,
  likes: count,
  comments: count,
  shares: count,
  author: text,
  image: link,
  createdUtc: count,
  durationSeconds: count,
  soundTitle: text,
  soundAuthor: text,
  region: text.optional(),
});

const instagramRow = z.object({
  shortcode: z.string().regex(/^[\w-]+$/),
  url: link,
  caption: text,
  views: count,
  likes: count,
  comments: count,
  username: text,
  thumbnail: link,
  createdUtc: count,
  durationSeconds: count,
  audioTitle: text.optional(),
});

/** The list in Treg's answer ({ output: { data: { videos | reels } } }), wherever it sits. */
function listIn(answer: unknown, key: "videos" | "reels" | "posts" | "items"): unknown[] {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): unknown[] | null => {
    if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return null;
    seen.add(v);
    const own = (v as Record<string, unknown>)[key];
    if (Array.isArray(own)) return own;
    for (const child of Object.values(v as Record<string, unknown>)) {
      const found = walk(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(answer, 0) ?? [];
}

const dateOf = (seconds: number | null) => (seconds && seconds > 1_000_000_000 ? new Date(seconds * 1000).toISOString() : null);
const clip = (s: string | null | undefined, max: number) => (s ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The videos of a TikTok keyword search. */
export function tiktokTrends(answer: unknown): TrendVideo[] {
  return listIn(answer, "videos").flatMap((raw) => {
    const r = tiktokRow.safeParse(raw);
    if (!r.success) return [];
    const v = r.data;
    const url = v.url ?? (v.author ? `https://www.tiktok.com/@${v.author}/video/${v.id}` : null);
    if (!url) return [];
    const sound = v.soundTitle && !/^original sound|^son original/i.test(v.soundTitle) ? clip(`${v.soundTitle}${v.soundAuthor ? ` · ${v.soundAuthor}` : ""}`, 120) : null;
    return [
      {
        platform: "tiktok" as const,
        external_id: v.id,
        url,
        caption: clip(v.caption, 300),
        author: v.author,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        sound,
        duration: v.durationSeconds,
        posted_at: dateOf(v.createdUtc),
        cover: v.image,
        region: v.region ?? null,
      },
    ];
  });
}

/** The Reels of an Instagram keyword search. */
export function instagramTrends(answer: unknown): TrendVideo[] {
  return listIn(answer, "reels").flatMap((raw) => {
    const r = instagramRow.safeParse(raw);
    if (!r.success) return [];
    const v = r.data;
    return [
      {
        platform: "instagram" as const,
        external_id: v.shortcode,
        url: v.url ?? `https://www.instagram.com/reel/${v.shortcode}/`,
        caption: clip(v.caption, 300),
        author: v.username,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: null,
        sound: v.audioTitle ? clip(v.audioTitle, 120) : null,
        duration: v.durationSeconds,
        posted_at: dateOf(v.createdUtc),
        cover: v.thumbnail,
      },
    ];
  });
}

const topPostRow = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  shortcode: z.string().regex(/^[\w-]+$/),
  caption: text,
  username: text,
  views: count,
  likes: count,
  comments: count,
  createdUtc: count,
  durationSeconds: count,
  soundTitle: text.optional(),
  soundAuthor: text.optional(),
  media: z.array(z.object({ type: text, url: link }).passthrough()).nullable().catch(null),
});

/** The videos of Instagram's own top posts on a hashtag (AnyAPI: { data: { posts } }), photos left out. */
export function instagramTopPosts(answer: unknown): TrendVideo[] {
  return listIn(answer, "posts").flatMap((raw) => {
    const r = topPostRow.safeParse(raw);
    if (!r.success) return [];
    const v = r.data;
    const first = v.media?.[0];
    const video = first?.type === "video" || (v.views ?? 0) > 0 || (v.durationSeconds ?? 0) > 0;
    if (!video) return [];
    const sound = v.soundTitle && !/^original audio|^son original|^audio original/i.test(v.soundTitle) ? clip(`${v.soundTitle}${v.soundAuthor ? ` · ${v.soundAuthor}` : ""}`, 120) : null;
    return [
      {
        platform: "instagram" as const,
        external_id: v.shortcode,
        url: `https://www.instagram.com/reel/${v.shortcode}/`,
        caption: clip(v.caption, 300),
        author: v.username,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: null,
        sound,
        duration: v.durationSeconds,
        posted_at: dateOf(v.createdUtc),
        cover: first?.url ?? null,
      },
    ];
  });
}

/** How much a video caught on: its views, else its likes as if one view in twenty liked. */
export const reach = (v: Pick<TrendVideo, "views" | "likes">) => v.views ?? (v.likes ?? 0) * 20;

/** Pages read per search (AnyAPI gives 10 to 30 videos a page): a bigger pool, so the top is the real top. */
export const TREND_PAGES = 3;

/**
 * The ones worth showing (Tristan: « j'aimerais les plus vus »): no duplicate, posted in the last
 * TREND_MAX_AGE_DAYS, above the scope's TREND_MIN_VIEWS, the most watched first. Never padded
 * with weak ones: a short list beats videos at a thousand views. A caption in another script
 * (Persian, Amharic…) is not her audience.
 */
export function keptTrends(videos: TrendVideo[], scope: TrendScope, now = new Date()): TrendVideo[] {
  const limit = now.getTime() - TREND_MAX_AGE_DAYS * 86_400_000;
  const unique = [...new Map(videos.map((v) => [`${v.platform}:${v.external_id}`, v])).values()];
  return unique
    .filter((v) => !foreignScript(v.caption))
    .filter((v) => v.posted_at !== null && Date.parse(v.posted_at) >= limit)
    .filter((v) => reach(v) >= TREND_MIN_VIEWS[scope][v.platform])
    .sort((a, b) => reach(b) - reach(a));
}

/** Mostly written in a script other than the Latin one (emoji, digits and hashtags aside). */
export function foreignScript(caption: string): boolean {
  const letters = caption.replace(/#\S+|@\S+/g, "").match(/\p{L}/gu) ?? [];
  if (letters.length < 6) return false;
  const latin = letters.filter((c) => /\p{Script=Latin}/u.test(c)).length;
  return latin / letters.length < 0.5;
}

/** The cursor of the next page in a search's answer (AnyAPI's nextCursor), if any. */
export function nextCursorIn(answer: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): string | null => {
    if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return null;
    seen.add(v);
    const own = (v as Record<string, unknown>).nextCursor;
    if (typeof own === "string" && own) return own;
    for (const child of Object.values(v as Record<string, unknown>)) {
      if (Array.isArray(child)) continue;
      const found = walk(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(answer, 0);
}

const CITIES = /\b(paris|lyon|marseille|bordeaux|lille|nantes|toulouse|nice|strasbourg|montpellier|rennes|grenoble|france)\b/i;
const SMALL_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "à", "a", "en", "au", "aux", "d", "l"]);

/** A word as a hashtag: no accent, no space, no sign (« salon de coiffure » → « salondecoiffure »). */
export const hashtagOf = (words: string) =>
  words
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export type TrendSearch = {
  scope: TrendScope;
  /** What is searched (« pilates », « pilates paris »). */
  words: string;
  /** Her trade alone (« pilates »), and the city of a local list. */
  trade: string;
  city: string | null;
  hashtags: string[];
};

/**
 * The two searches for a trade. « trend »: its words without the city (« pilates paris » →
 * « pilates »), worldwide, and its hashtags (the words joined, and its main word: « salon de
 * coiffure » → #salondecoiffure, #coiffure). « local »: the same words with her city (Paris
 * unless her words name another), and the main word's city hashtag (#coiffureparis).
 */
export function trendPlan(query: string): Record<TrendScope, TrendSearch> {
  const clean = query.replace(/\s+/g, " ").trim().toLowerCase();
  const named = clean.match(CITIES)?.[1];
  const city = !named || named === "france" ? "paris" : named;
  const broad = clean.replace(new RegExp(CITIES.source, "gi"), " ").replace(/\s+(à|a|sur|in)\s*$/, "").replace(/\s+/g, " ").trim() || clean;
  const words = broad.split(" ").filter((w) => !SMALL_WORDS.has(w));
  const main = [...words].sort((a, b) => b.length - a.length)[0] ?? broad;
  const tags = (list: string[]) => [...new Set(list.map(hashtagOf).filter((t) => t.length >= 3))].slice(0, 2);
  return {
    trend: { scope: "trend", words: broad, trade: broad, city: null, hashtags: tags([broad, main]) },
    local: { scope: "local", words: `${broad} ${city}`, trade: broad, city, hashtags: tags([`${main}${city}`]) },
  };
}

/** The hashtags whose number of posts is followed each week: the trade's, then its city's. */
export const trendHashtags = (query: string) => {
  const plan = trendPlan(query);
  return [...new Set([...plan.trend.hashtags, ...plan.local.hashtags])];
};

/** The total number of posts on a hashtag in AnyAPI's answer ({ data: { items: [{ postsCount }] } }). */
export function hashtagPostsIn(answer: unknown): number | null {
  const first = listIn(answer, "items")[0];
  const posts = z.object({ postsCount: count }).safeParse(first);
  return posts.success ? posts.data.postsCount : null;
}

export type HashtagCount = { hashtag: string; counted_on: string; posts: number };
export type HashtagVolume = { hashtag: string; posts: number; gained: number | null; days: number | null };

/**
 * Each hashtag's latest number of posts, and how many were added since a count 5 to 40 days
 * before (the nearest to a week): a hashtag that grows is a subject people post about now.
 */
export function hashtagVolumes(counts: HashtagCount[], order: string[]): HashtagVolume[] {
  return order.flatMap((hashtag) => {
    const mine = counts.filter((c) => c.hashtag === hashtag).sort((a, b) => b.counted_on.localeCompare(a.counted_on));
    const last = mine[0];
    if (!last) return [];
    const daysTo = (c: HashtagCount) => Math.round((Date.parse(last.counted_on) - Date.parse(c.counted_on)) / 86_400_000);
    const earlier = mine.filter((c) => daysTo(c) >= 5 && daysTo(c) <= 40).sort((a, b) => Math.abs(daysTo(a) - 7) - Math.abs(daysTo(b) - 7))[0];
    return [{ hashtag, posts: last.posts, gained: earlier ? last.posts - earlier.posts : null, days: earlier ? daysTo(earlier) : null }];
  });
}

/** The key a list is kept under: its scope and its words. */
export const scopeKey = (search: Pick<TrendSearch, "scope" | "words">) => `${search.scope}:${trendKey(search.words)}`;

export const trendFilterSchema = z.object({
  keep: z.array(z.number().int().min(1).max(60)).max(60).describe("The numbers of the videos to keep"),
});

/** Sonnet's instructions to keep only the videos really about her trade. */
export const TREND_FILTER_PROMPT = `You sort short videos found by a keyword or hashtag search on TikTok and Instagram, for a page that shows a small business what works right now in its trade.

You receive the trade (in French), whether the list is worldwide or for one city, and numbered videos with their caption and account.

Keep a video when it is really about this trade: it shows the activity, the place, the work, a client's experience, a professional of the trade, a tip, a before/after, a behind the scenes: something a business of this trade could make its own version of. For a city list, also keep it only if it is in or about that city.

Leave out a video that only borrows the word or the hashtag: a travel list, a city guide, a meme or a lifestyle vlog where the trade is a passing mention, an app tutorial, a product unrelated to the trade, a giveaway with nothing to see, a news piece. When in doubt with a caption that says little, keep it if the account looks like one of this trade.

Answer with the numbers of the videos to keep.`;

/**
 * The words searched for her trade: what she set, else her activity in a few words (« salon de
 * coiffure »; a long description is cut before its first « qui », « pour », comma or dash), at most 5 words.
 */
export function trendQueryOf(set: string | null | undefined, businessType: string | null | undefined): string | null {
  const own = set?.replace(/\s+/g, " ").trim();
  if (own) return own.slice(0, 60);
  const activity = businessType?.replace(/\s+/g, " ").trim();
  if (!activity) return null;
  const head = activity.split(/\s(?:qui|pour|avec|dont|où)\s|[,;:()–—-]/i)[0]!.trim();
  return head.split(" ").slice(0, 5).join(" ").toLowerCase() || null;
}

/** The key a search is kept under (the same words, whatever their case and spaces). */
export const trendKey = (query: string) => query.replace(/\s+/g, " ").trim().toLowerCase();

/** « 1,2 M », « 48 k », « 950 »: a count the way the apps write it. */
export function shortCount(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",").replace(/,0$/, "")}\u00a0M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",").replace(/,0$/, "")}\u00a0k`;
  return String(Math.round(n));
}
