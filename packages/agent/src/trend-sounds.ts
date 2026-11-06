import { z } from "zod";

// The trending sounds (Tristan: « une bibliothèque de sons tendances », « plutôt 30 sons et des sons à la demande »,
// then « ba ponce muse », « muse est notre poule aux oeufs d'or »): as Mojo or Muse do, her Reel comes out silent, cut
// on the beats of a sound, and she adds it in Instagram with « Utiliser l'audio » on a Reel that uses it. The songs
// are those the team picked, then those @muse.templates puts on its Reels, read each Monday, Instagram's own mark of a
// trending sound first (is_trending_in_clips: the arrow of its audio menu; Instagram opens its trending list to no
// app). Each one plays in the app from Instagram (nothing kept: its rights are Instagram's).

/** Treg's tools (verified November 2026): GET, their parameters in the query. */
export const SOUND_TOOLS = {
  /** handle, max_id: an account's Reels, each whole (its music in clips_metadata). About 12 a page, $0.00188 a call. */
  account: "scrapecreators.x.v1-instagram-user-reels",
  /** keyword: a title, an artist. $0.002 a call. */
  search: "tikhub.x.instagram-v2-search-music",
  /** audio_id: the id of its page. 12 Reels a page, $0.00188 a call. */
  reels: "scrapecreators.x.v1-instagram-audio-reels",
} as const;

/** The account whose songs the list follows, how many of them it keeps, and the pages read each week (a first read goes further). */
export const SOUND_SOURCE = "muse.templates";
export const SOUND_SOURCE_KEPT = 40;
export const SOUND_SOURCE_PAGES = { weekly: 2, first: 8 } as const;
/** The team's own picks are ranked under this; the source's songs from it on (they move each week). */
export const SOURCE_RANK = 100;
/** Searches of a sound by its name a studio makes in a day (each about 0.2 cent), against abuse. */
export const SOUND_SEARCHES_PER_DAY = 20;

const text = z.string().trim().min(1).max(300);
const count = z.coerce.number().int().nonnegative().nullable().catch(null);

/** The first list found under one of these keys, at any depth (providers wrap their answers). */
function listUnder(value: unknown, keys: string[], depth = 0): unknown[] {
  if (!value || typeof value !== "object" || depth > 6) return [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (keys.includes(k) && Array.isArray(v)) return v;
  for (const v of Object.values(value as Record<string, unknown>)) {
    const found = listUnder(v, keys, depth + 1);
    if (found.length) return found;
  }
  return [];
}

export type InstagramSound = {
  audioId: string;
  title: string;
  artist: string | null;
  cover: string | null;
  seconds: number | null;
  explicit: boolean;
  /** The whole song on Instagram's CDN (its link expires: linkExpiry), and where its highlight starts (s): what the page plays. */
  track: string | null;
  highlight: number | null;
};

const searchItem = z.object({
  id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d{5,25}$/)),
  title: text,
  display_artist: text.nullable().optional().catch(null),
  cover_artwork_thumbnail_uri: z.string().url().max(2000).nullable().optional().catch(null),
  cover_artwork_uri: z.string().url().max(2000).nullable().optional().catch(null),
  duration_in_ms: count.optional(),
  is_explicit: z.boolean().optional().catch(false),
  fast_start_progressive_download_url: z.string().url().max(4000).nullable().optional().catch(null),
  progressive_download_url: z.string().url().max(4000).nullable().optional().catch(null),
  highlight_start_times_in_ms: z.array(z.coerce.number().nonnegative()).nullable().optional().catch(null),
});

/** The sounds an Instagram music search found, in its order (the id is its page's: instagram.com/reels/audio/{id}/). */
export function instagramSounds(answer: unknown): InstagramSound[] {
  return listUnder(answer, ["items"]).flatMap((raw) => {
    // A search result may carry its track under « track » or « music ».
    const item = raw && typeof raw === "object" && !("title" in raw) ? ((raw as Record<string, unknown>).track ?? (raw as Record<string, unknown>).music ?? raw) : raw;
    const r = searchItem.safeParse(item);
    if (!r.success) return [];
    const v = r.data;
    return [
      {
        audioId: v.id,
        title: v.title,
        artist: v.display_artist ?? null,
        cover: v.cover_artwork_thumbnail_uri ?? v.cover_artwork_uri ?? null,
        seconds: v.duration_in_ms ? Math.round(v.duration_in_ms / 1000) : null,
        explicit: Boolean(v.is_explicit),
        track: v.fast_start_progressive_download_url ?? v.progressive_download_url ?? null,
        highlight: v.highlight_start_times_in_ms?.[0] !== undefined ? Math.round(v.highlight_start_times_in_ms[0]) / 1000 : null,
      },
    ];
  });
}

export type SoundReel = { code: string; plays: number | null; video: string | null };

const reelItem = z.object({
  code: z.string().regex(/^[\w-]{5,40}$/),
  play_count: count.optional(),
  ig_play_count: count.optional(),
  video_versions: z.array(z.object({ url: z.string().url().max(4000) }).passthrough()).nullable().optional().catch(null),
});

/** The Reels that use a sound, with their plays and their video's direct link (it expires: linkExpiry). */
export function soundReels(answer: unknown): SoundReel[] {
  return listUnder(answer, ["reels", "items"]).flatMap((raw) => {
    const item = raw && typeof raw === "object" && "media" in raw ? (raw as { media: unknown }).media : raw;
    const r = reelItem.safeParse(item);
    if (!r.success) return [];
    const v = r.data;
    return [{ code: v.code, plays: v.ig_play_count ?? v.play_count ?? null, video: v.video_versions?.[0]?.url ?? null }];
  });
}

/** When a link of Instagram's CDN stops working: its `oe` parameter, a time in hexadecimal seconds. */
export function linkExpiry(url: string): Date | null {
  try {
    const oe = new URL(url).searchParams.get("oe");
    if (!oe || !/^[0-9a-f]{6,12}$/i.test(oe)) return null;
    return new Date(Number.parseInt(oe, 16) * 1000);
  } catch {
    return null;
  }
}

/** The Reel of a code, the link she opens in Instagram (« Utiliser l'audio » under it). */
export const soundReelLink = (code: string) => `https://www.instagram.com/reel/${code}/`;
/** The page of a sound in Instagram. */
export const soundPageLink = (audioId: string) => `https://www.instagram.com/reels/audio/${audioId}/`;

/** A title or a name compared: lower case, no accents, no punctuation, nothing in brackets (« (Sped Up) », « (feat. X) »). */
export function soundWords(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/\bfeat\.?.*$/, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The Instagram sound that is this song: the same title, by the same artist when both are named; else none. */
export function sameSound(song: { title: string; artist: string | null }, found: InstagramSound[]): InstagramSound | null {
  const title = soundWords(song.title);
  if (!title) return null;
  const artist = song.artist ? soundWords(song.artist) : "";
  const named = found.filter((s) => soundWords(s.title) === title);
  if (!artist) return named[0] ?? null;
  // « SIDEPIECE & 95 South » is « SIDEPIECE, 95 South » on Instagram: their first names meet.
  const overlaps = (a: string, b: string) => {
    const [first] = a.split(" ");
    const [other] = b.split(" ");
    return Boolean(first && other && (b.includes(first) || a.includes(other)));
  };
  return named.find((s) => (s.artist ? overlaps(artist, soundWords(s.artist)) : false)) ?? named.find((s) => !s.artist) ?? null;
}


/** « 1,2 M », « 48 k », « 950 »: a count the way the apps write it. */
export function shortCount(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",").replace(/,0$/, "")}\u00a0M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",").replace(/,0$/, "")}\u00a0k`;
  return String(Math.round(n));
}

export type AccountSong = { audioId: string; title: string; artist: string | null; code: string; plays: number | null; trending: boolean };

/** The first object holding this key, at any depth. */
function holding(value: unknown, key: string, depth = 0): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || depth > 7) return null;
  const record = value as Record<string, unknown>;
  if (key in record && record[key] && typeof record[key] === "object") return record;
  for (const v of Object.values(record)) {
    const found = holding(v, key, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * The songs of an account's Reels (ScrapeCreators' user reels): each Reel's licensed song (music_asset_info: its
 * title, its artist, the id of its page), whether Instagram marks it trending, the Reel's code and plays. A sound
 * original to an account (original_sound_info, no song) is left out (Tristan: « sons original a enlever »).
 */
export function accountSongs(answer: unknown): AccountSong[] {
  return listUnder(answer, ["items", "reels"]).flatMap((raw) => {
    const media = raw && typeof raw === "object" && "media" in raw ? (raw as { media: unknown }).media : raw;
    if (!media || typeof media !== "object") return [];
    const code = (media as { code?: unknown }).code;
    const asset = holding(media, "music_asset_info")?.music_asset_info as Record<string, unknown> | undefined;
    const consumption = holding(media, "music_consumption_info")?.music_consumption_info as Record<string, unknown> | undefined;
    const attribution = (media as { clips_music_attribution_info?: Record<string, unknown> }).clips_music_attribution_info;
    if (typeof code !== "string" || !/^[\w-]{5,40}$/.test(code) || !asset) return [];
    const title = typeof asset.title === "string" ? asset.title.trim() : "";
    const id = [asset.audio_cluster_id, attribution?.audio_id, asset.id].map((v) => (v === undefined || v === null ? "" : String(v))).find((v) => /^\d{5,25}$/.test(v));
    if (!title || !id || /^(original audio|son original|audio original)/i.test(title)) return [];
    const plays = Number((media as { play_count?: unknown; ig_play_count?: unknown }).ig_play_count ?? (media as { play_count?: unknown }).play_count);
    return [
      {
        audioId: id,
        title: title.slice(0, 200),
        artist: typeof asset.display_artist === "string" && asset.display_artist.trim() ? asset.display_artist.trim().slice(0, 200) : null,
        code,
        plays: Number.isFinite(plays) ? plays : null,
        trending: consumption?.is_trending_in_clips === true,
      },
    ];
  });
}
