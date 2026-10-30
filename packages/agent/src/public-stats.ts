import { captionMatch } from "./caption-match.ts";
import type { Platform } from "./schemas.ts";

// Her public numbers without connecting her accounts (Tristan: « nombre d'abonnés / vue / j'aime
// c'est suffisant »): her @ on Instagram and TikTok is enough to read, once a day through Treg,
// her follower count and the views, likes and comments of each Reel she posted herself (the
// share button). Each one is linked to its post by its caption, as for a Reel published by hand.
// Never what only the account's owner sees (profile visits, link taps, reach).

const HANDLE = { instagram: /^[a-z0-9._]{1,30}$/, tiktok: /^[a-z0-9._]{2,24}$/ } as const;

/** Her @ as each app writes it (lower case, no @), from « @lune.pilates », its profile link or a bare name; null when it cannot be one. */
export function cleanHandle(platform: Platform, raw: string | null | undefined): string | null {
  let text = (raw ?? "").trim();
  const link = text.match(platform === "instagram" ? /instagram\.com\/([^/?#\s]+)/i : /tiktok\.com\/@([^/?#\s]+)/i);
  if (link) text = link[1]!;
  text = text.replace(/^@+/, "").toLowerCase();
  if (platform === "instagram" && ["p", "reel", "reels", "explore", "stories"].includes(text)) return null;
  return HANDLE[platform].test(text) ? text : null;
}

/** One of her public videos: its numbers, its caption and when it went up. */
export type PublicVideo = { id: string; caption: string; at: number; url: string | null; views: number | null; likes: number | null; comments: number | null; saves: number | null };

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const record = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** The data of a Treg answer ({ output: { found, data } }); null when the account is not found. */
function dataOf(answer: unknown): Record<string, unknown> | null {
  const output = record(record(answer).output);
  if (output.found === false) return null;
  const data = record(output.data);
  return Object.keys(data).length ? data : null;
}

/** Her follower count (and, on TikTok, all the likes her videos got) from the profile tool; null when not found or private. */
export function readPublicProfile(answer: unknown): { followers: number; likes: number | null; private: boolean } | null {
  const data = dataOf(answer);
  const followers = count(data?.followers);
  if (!data || followers === null) return null;
  return { followers, likes: count(data.likes), private: data.private === true };
}

/**
 * Her videos from the reels / videos tool, newest first. A Reel made with someone else
 * (a collaboration) is listed on both accounts: only those posted from her @ are kept.
 */
export function readPublicVideos(platform: Platform, answer: unknown, handle: string): PublicVideo[] {
  const data = dataOf(answer);
  const list = (platform === "instagram" ? data?.reels : data?.videos) as unknown;
  if (!Array.isArray(list)) return [];
  return list
    .map(record)
    .filter((v) => typeof v.username !== "string" || v.username.toLowerCase() === handle)
    .flatMap((v): PublicVideo[] => {
      const id = typeof v.id === "string" || typeof v.id === "number" ? String(v.id) : null;
      const created = count(v.createdUtc);
      if (!id || created === null) return [];
      const shortcode = typeof v.shortcode === "string" ? v.shortcode : null;
      const url = platform === "instagram" ? (shortcode ? `https://www.instagram.com/reel/${shortcode}/` : null) : typeof v.url === "string" ? v.url : null;
      return [{ id, caption: typeof v.caption === "string" ? v.caption : "", at: created * 1000, url, views: count(v.views), likes: count(v.likes), comments: count(v.comments), saves: count(v.saves) }];
    })
    .sort((a, b) => b.at - a.at);
}

/** Enough of our caption must be in hers: her account has Reels Edith never made. */
export const PUBLIC_MATCH = 0.5;

/** A video found online before the post was made is not it (a little earlier: clocks, the app's page). */
const EARLIEST_BEFORE_POST_MS = 2 * 3600_000;

/**
 * Each post waiting to be found online gets the video whose caption matches it best, posted after
 * the post was made, never one already linked; the oldest post chooses first.
 */
export function matchPublicVideos(
  posts: { id: string; caption: string | null; createdAt: number }[],
  videos: PublicVideo[],
  taken: Set<string>,
): { postId: string; video: PublicVideo }[] {
  const used = new Set(taken);
  const found: { postId: string; video: PublicVideo }[] = [];
  for (const post of [...posts].sort((a, b) => a.createdAt - b.createdAt)) {
    const best = videos
      .filter((v) => !used.has(v.id) && v.at >= post.createdAt - EARLIEST_BEFORE_POST_MS)
      .map((v) => ({ v, score: captionMatch(post.caption, v.caption) }))
      .filter((c) => c.score >= PUBLIC_MATCH)
      .sort((a, b) => b.score - a.score || a.v.at - b.v.at)[0];
    if (!best) continue;
    used.add(best.v.id);
    found.push({ postId: post.id, video: best.v });
  }
  return found;
}
