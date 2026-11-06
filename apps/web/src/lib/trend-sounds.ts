import "server-only";
import {
  chartSongs,
  instagramSounds,
  linkExpiry,
  sameSound,
  soundList,
  soundReelLink,
  soundReels,
  soundWords,
  SOUND_SEARCHES_PER_DAY,
  SOUND_TOOLS,
  usdToEur,
  type InstagramSound,
} from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { instagramVideo, tregCall } from "@/lib/treg";

// The trending sounds (packages/agent/src/trend-sounds.ts; docs/son.md, « Sons tendance »): TikTok's two charts each
// Monday (with the trends' cron, or when its page finds the list older than 6 days), each new song found once among
// Instagram's music; a sound she searches by name; and a few Reels that use a sound, read when someone listens to it
// or picks it (their video links last about a day and a half). The same for every studio (table trend_sounds).

const MAX_COST_USD = 0.01;
/** The list is searched again when it is older than this. */
export const SOUND_REFRESH_DAYS = 6;
/** New songs of the charts searched on Instagram at once. */
const AT_ONCE = 5;

export type TrendSound = {
  id: string;
  audioId: string;
  title: string;
  artist: string | null;
  cover: string | null;
  seconds: number | null;
  explicit: boolean;
  /** house: picked from the Reels Edith's models were written on (« Les sons de nos modèles »); top, viral: TikTok's charts. */
  chart: "house" | "top" | "viral" | null;
  rank: number | null;
  tiktokUsers: number | null;
};

const COLUMNS = "id, audio_id, title, artist, cover_url, seconds, explicit, chart, rank, tiktok_users";

const toSound = (r: Record<string, unknown>): TrendSound => ({
  id: r.id as string,
  audioId: r.audio_id as string,
  title: r.title as string,
  artist: (r.artist as string | null) ?? null,
  cover: (r.cover_url as string | null) ?? null,
  seconds: r.seconds === null || r.seconds === undefined ? null : Number(r.seconds),
  explicit: Boolean(r.explicit),
  chart: (r.chart as "house" | "top" | "viral" | null) ?? null,
  rank: r.rank === null || r.rank === undefined ? null : Number(r.rank),
  tiktokUsers: r.tiktok_users === null || r.tiktok_users === undefined ? null : Number(r.tiktok_users),
});

/** One Treg call, its cost added to the run's. */
async function called(id: string, query: Record<string, string | number>, spent: { usd: number; calls: number }): Promise<unknown> {
  const done = await tregCall(id, query, MAX_COST_USD, "GET").catch(() => null);
  spent.calls += 1;
  spent.usd += done?.costUsd ?? 0;
  return done?.answer ?? null;
}

async function logCost(studioId: string | null, spent: { usd: number; calls: number }, purpose: string, extra: Record<string, unknown> = {}) {
  if (!spent.calls) return;
  await supabaseAdmin()
    .from("cost_events")
    .insert({ studio_id: studioId, kind: "trends", provider: "treg", units: spent.calls, cost_eur: usdToEur(spent.usd, env("USD_TO_EUR")), meta: costMeta({ purpose, cost_usd: spent.usd, calls: spent.calls, ...extra }) });
}

/** This week's sounds, the Top 50's first, and when the list was made. */
export async function trendSounds(): Promise<{ sounds: TrendSound[]; chartedAt: string | null }> {
  const { data } = await supabaseAdmin().from("trend_sounds").select(`${COLUMNS}, charted_at`).not("chart", "is", null).order("chart").order("rank");
  const rows = data ?? [];
  const chartedAt = rows.reduce<string | null>((latest, r) => (r.charted_at && (!latest || (r.charted_at as string) > latest) ? (r.charted_at as string) : latest), null);
  // « top » before « viral » (by name), each in its rank.
  return { sounds: rows.map(toSound), chartedAt };
}

/** The list needs searching again: never made, or older than SOUND_REFRESH_DAYS. */
export function soundsStale(chartedAt: string | null): boolean {
  return !chartedAt || Date.now() - Date.parse(chartedAt) > SOUND_REFRESH_DAYS * 86_400_000;
}

let running: Promise<{ kept: number; searched: number }> | null = null;
/** The last run of this instance: a page that finds the list old does not search it again within 10 minutes. */
let lastRun = 0;
const RETRY_MS = 10 * 60_000;

/**
 * This week's list: TikTok's Top 50 and Viral 50, the 30 songs kept (soundList) found among Instagram's music (a song
 * found once is not searched again: its match_key), the others out of the list. A chart Treg does not answer leaves
 * last week's list. About $0.002 a call, logged once (kind trends, no studio).
 */
export function refreshTrendSounds({ force = false }: { force?: boolean } = {}): Promise<{ kept: number; searched: number }> {
  if (running) return running;
  if (!force && Date.now() - lastRun < RETRY_MS) return Promise.resolve({ kept: 0, searched: 0 });
  lastRun = Date.now();
  running = refresh().finally(() => {
    running = null;
  });
  return running;
}

async function refresh(): Promise<{ kept: number; searched: number }> {
  const db = supabaseAdmin();
  const spent = { usd: 0, calls: 0 };
  const [top, viral] = await Promise.all([0, 1].map((scene) => called(SOUND_TOOLS.chart, { scene, cursor: 0, count: 50 }, spent).then(chartSongs)));
  if (!top?.length || !viral?.length) {
    await logCost(null, spent, "sounds", { missed: true });
    return { kept: 0, searched: 0 };
  }
  const songs = soundList(top, viral);
  const keyOf = (s: { title: string; artist: string | null }) => `${soundWords(s.title)}|${soundWords(s.artist ?? "")}`;
  const { data: known } = await db.from("trend_sounds").select("audio_id, match_key").in("match_key", songs.map(keyOf));
  const found = new Map((known ?? []).map((r) => [r.match_key as string, r.audio_id as string]));

  // The new ones, a few at a time: each searched by its title and its artist.
  const fresh = songs.filter((s) => !found.has(keyOf(s)));
  for (let i = 0; i < fresh.length; i += AT_ONCE) {
    await Promise.all(
      fresh.slice(i, i + AT_ONCE).map(async (song) => {
        const answer = await called(SOUND_TOOLS.search, { keyword: [song.title, song.artist].filter(Boolean).join(" ") }, spent);
        const sound = sameSound(song, instagramSounds(answer));
        if (!sound) return;
        const { error } = await db.from("trend_sounds").upsert({ ...soundRow(sound), match_key: keyOf(song) }, { onConflict: "audio_id" });
        if (!error) found.set(keyOf(song), sound.audioId);
      }),
    );
  }

  // Last week's out of the list, this week's in it, in their chart's order.
  // The sounds of the models (chart house) stay: only the charts' are made again.
  await db.from("trend_sounds").update({ chart: null, rank: null }).in("chart", ["top", "viral"]);
  const now = new Date().toISOString();
  let kept = 0;
  for (const song of songs) {
    const audioId = found.get(keyOf(song));
    if (!audioId) continue;
    const { error } = await db.from("trend_sounds").update({ chart: song.chart, rank: song.rank, tiktok_users: song.users, charted_at: now }).eq("audio_id", audioId);
    if (!error) kept += 1;
  }
  await logCost(null, spent, "sounds", { kept, searched: fresh.length });
  return { kept, searched: fresh.length };
}

/** What a sound found on Instagram keeps (never its chart: a search does not move it in or out of the list). */
const soundRow = (s: InstagramSound) => ({
  audio_id: s.audioId,
  title: s.title,
  artist: s.artist,
  cover_url: s.cover,
  seconds: s.seconds,
  explicit: s.explicit,
  ...trackOf(s),
  fetched_at: new Date().toISOString(),
});

/** Its whole song to listen to, until its link expires. */
const trackOf = (s: InstagramSound) =>
  s.track ? { track_url: s.track, track_start: s.highlight, track_until: (linkExpiry(s.track) ?? new Date(Date.now() + 12 * 3_600_000)).toISOString() } : {};

/** The searches of a sound this studio made today (UTC). */
async function searchesToday(studioId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin()
    .from("cost_events")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("kind", "trends")
    .eq("meta->>purpose", "sound_search")
    .gte("created_at", since.toISOString());
  return count ?? 0;
}

/** A sound she looks for by its name (a title, an artist): Instagram's first answers, kept to be listened to and picked. */
export async function searchSounds(studioId: string, words: string): Promise<{ ok: true; sounds: TrendSound[] } | { ok: false; error: string }> {
  const query = words.replace(/\s+/g, " ").trim().slice(0, 80);
  if (query.length < 2) return { ok: false, error: "Écris un titre ou un artiste." };
  if ((await searchesToday(studioId)) >= SOUND_SEARCHES_PER_DAY) return { ok: false, error: `Tu as cherché ${SOUND_SEARCHES_PER_DAY} sons aujourd’hui : reprends demain, ou choisis dans la liste.` };
  const spent = { usd: 0, calls: 0 };
  const answer = await called(SOUND_TOOLS.search, { keyword: query }, spent);
  await logCost(studioId, spent, "sound_search", { query });
  if (answer === null) return { ok: false, error: "La recherche n’a pas répondu. Réessaie dans un instant." };
  const found = instagramSounds(answer).slice(0, 8);
  if (!found.length) return { ok: true, sounds: [] };
  const db = supabaseAdmin();
  await db.from("trend_sounds").upsert(found.map(soundRow), { onConflict: "audio_id" });
  const { data } = await db.from("trend_sounds").select(COLUMNS).in("audio_id", found.map((s) => s.audioId));
  const byId = new Map((data ?? []).map((r) => [r.audio_id as string, toSound(r)]));
  return { ok: true, sounds: found.flatMap((s) => byId.get(s.audioId) ?? []) };
}

export type SoundExample = { link: string; video: string | null; plays: number | null };

/**
 * A Reel that uses this sound, the most played of a few: its link (she opens it in Instagram for « Utiliser l'audio »,
 * the montage is cut on its beats) and its video's link, which plays its sound in the app from Instagram (valid about
 * a day and a half, read again after). Null when the sound is not known or no Reel uses it.
 */
export async function soundExample(audioId: string, studioId: string | null): Promise<SoundExample | null> {
  if (!/^\d{5,25}$/.test(audioId)) return null;
  const db = supabaseAdmin();
  const { data: row } = await db.from("trend_sounds").select("reels, reels_until, chart").eq("audio_id", audioId).maybeSingle();
  if (!row) return null;
  const kept = Array.isArray(row.reels) ? (row.reels as SoundExample[]) : [];
  const valid = row.reels_until && Date.parse(row.reels_until as string) > Date.now() + 15 * 60_000;
  if (valid && kept[0]?.video) return kept[0];
  // A sound of the models keeps its model's Reel: the one its cuts come from, its video read again when it expired.
  const model = row.chart === "house" ? kept[0] : undefined;
  if (model?.link) {
    const fetched = await instagramVideo(model.link).catch(() => null);
    if (fetched) await logCost(studioId, { usd: fetched.costUsd, calls: 1 }, "sound_reels", { audio_id: audioId, model: true });
    if (!fetched?.video) return model;
    const example = { ...model, video: fetched.video };
    const until = (linkExpiry(fetched.video) ?? new Date(Date.now() + 12 * 3_600_000)).toISOString();
    await db.from("trend_sounds").update({ reels: [example, ...kept.slice(1)], reels_until: until }).eq("audio_id", audioId);
    return example;
  }
  const spent = { usd: 0, calls: 0 };
  const answer = await called(SOUND_TOOLS.reels, { audio_id: audioId }, spent);
  await logCost(studioId, spent, "sound_reels", { audio_id: audioId });
  const reels = soundReels(answer)
    .filter((r) => r.video)
    .sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
    .slice(0, 5)
    .map((r) => ({ link: soundReelLink(r.code), video: r.video, plays: r.plays }));
  if (!reels.length) return kept[0] ?? null;
  const ends = reels.flatMap((r) => (r.video ? [linkExpiry(r.video)?.getTime() ?? 0] : [])).filter(Boolean);
  const until = new Date(ends.length ? Math.min(...ends) : Date.now() + 12 * 3_600_000).toISOString();
  await db.from("trend_sounds").update({ reels, reels_until: until }).eq("audio_id", audioId);
  return reels[0] ?? null;
}

/**
 * What the page plays to listen to a sound (Tristan: « pq l'aperçu est si court ? »): its whole song from its highlight,
 * as Instagram's music search serves it (read again by its title when the link expired, about 0.2 cent, shared by
 * everyone), else the video of a Reel that uses it, from the start (a sound original to one account has no song).
 */
export async function soundListen(audioId: string, studioId: string | null): Promise<{ url: string; start: number } | null> {
  if (!/^\d{5,25}$/.test(audioId)) return null;
  const db = supabaseAdmin();
  const { data: row } = await db.from("trend_sounds").select("title, artist, track_url, track_start, track_until").eq("audio_id", audioId).maybeSingle();
  if (!row) return null;
  if (row.track_url && row.track_until && Date.parse(row.track_until as string) > Date.now() + 15 * 60_000) return { url: row.track_url as string, start: Number(row.track_start ?? 0) };
  const spent = { usd: 0, calls: 0 };
  const answer = await called(SOUND_TOOLS.search, { keyword: [row.title, row.artist].filter(Boolean).join(" ").slice(0, 80) }, spent);
  await logCost(studioId, spent, "sound_track", { audio_id: audioId });
  const found = instagramSounds(answer).filter((s) => s.track);
  const same = found.find((s) => s.audioId === audioId) ?? sameSound({ title: row.title as string, artist: (row.artist as string | null) ?? null }, found);
  if (same?.track) {
    // Its cover with it, for a sound added by hand without one.
    await db.from("trend_sounds").update({ ...trackOf(same), ...(same.cover ? { cover_url: same.cover } : {}) }).eq("audio_id", audioId);
    return { url: same.track!, start: same.highlight ?? 0 };
  }
  const example = await soundExample(audioId, studioId);
  return example?.video ? { url: example.video, start: 0 } : null;
}
