import { z } from "zod";

// What works right now in her trade (Tristan: « une page tendance, où tu vois des vidéos qui
// fonctionnent »): each week, TikTok and Instagram are searched with the words of her trade through
// Treg (AnyAPI's keyword searches, about $0.001 a call), and the videos that people watched the most
// are kept with their numbers. Read loosely: the shapes are the provider's and may change.

export const TREND_PLATFORMS = ["tiktok", "instagram"] as const;
export type TrendPlatform = (typeof TREND_PLATFORMS)[number];

/** Searched again after this many days (a cron each week, or her page when it is older). */
export const TREND_REFRESH_DAYS = 6;
/** Videos kept per search, the most watched first. */
export const TREND_KEEP = 12;
/** Older than this, a video is a classic, not a trend: kept only when too few recent ones are left. */
export const TREND_MAX_AGE_DAYS = 120;

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
function listIn(answer: unknown, key: "videos" | "reels"): unknown[] {
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

/** How much a video caught on: its views, else its likes as if one view in twenty liked. */
export const reach = (v: Pick<TrendVideo, "views" | "likes">) => v.views ?? (v.likes ?? 0) * 20;

/**
 * The ones worth showing: no duplicate, the recent ones (under TREND_MAX_AGE_DAYS) first when there
 * are enough of them, the most watched first, TREND_KEEP at most.
 */
export function keptTrends(videos: TrendVideo[], now = new Date()): TrendVideo[] {
  const unique = [...new Map(videos.map((v) => [`${v.platform}:${v.external_id}`, v])).values()];
  const ranked = unique.sort((a, b) => reach(b) - reach(a));
  const limit = now.getTime() - TREND_MAX_AGE_DAYS * 86_400_000;
  const recent = ranked.filter((v) => v.posted_at && Date.parse(v.posted_at) >= limit);
  const pool = recent.length >= Math.min(6, ranked.length) ? recent : ranked;
  // Hers is a French audience: the French ones first, the rest of the world after them.
  const french = pool.filter(isFrench);
  return [...french, ...pool.filter((v) => !isFrench(v))].slice(0, TREND_KEEP);
}

const FRENCH_WORDS = new Set(
  "le la les des une un du et est pour avec chez dans sur qui que pas plus tu ton ta tes vous nous je on ce cette c'est j'ai trop très mon ma mes au aux".split(" "),
);

/**
 * Posted in French: TikTok says France (or Belgium, Switzerland…), else its caption reads as French
 * (three of its common words, or two with French accents). A caption of hashtags alone says nothing.
 */
export function isFrench(v: Pick<TrendVideo, "caption" | "region">): boolean {
  if (v.region && /^(FR|BE|CH|LU|MC|CA)$/i.test(v.region)) return true;
  const words = v.caption.toLowerCase().replace(/#\S+|@\S+/g, " ").split(/[^a-zà-ÿ']+/).filter(Boolean);
  const common = words.filter((w) => FRENCH_WORDS.has(w)).length;
  const accents = /[éèêàùçœ]/i.test(v.caption);
  return common >= 3 || (common >= 2 && accents);
}

/**
 * The searches for a trade: its words, and the same with « paris » for French videos (a word like
 * « restaurant » finds the whole world), unless they already name a place.
 */
export function trendSearches(query: string): string[] {
  return /\b(paris|lyon|marseille|france|bordeaux|lille|nantes|toulouse|nice)\b/i.test(query) ? [query] : [query, `${query} paris`];
}

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
