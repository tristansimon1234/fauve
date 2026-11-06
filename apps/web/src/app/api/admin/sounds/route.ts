import { usdToEur } from "@fauve/agent";
import { cronAuthorized } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tregCall } from "@/lib/treg";
import { refreshTrendSounds } from "@/lib/trend-sounds";

// The bench of the trending sounds (Tristan: « une bibliothèque de sons tendances », as Mojo or Muse do: the video
// comes out silent, the sound is added in Instagram). One run (CRON_SECRET, from the database by net.http_post):
// TikTok's music charts (Top 50, scene 0, and the second chart, scene 1), each of the first songs searched among
// Instagram's music, then the Reels that use the first ones found, their answers trimmed so their shapes can be read
// before the weekly list is built. About two cents a run, logged in cost_events (kind trends, no studio).
export const maxDuration = 120;

const CHART = "tikhub.x.tiktok-app-v3-fetch-music-chart-list";
const SEARCH = "tikhub.x.instagram-v2-search-music";
const REELS = "scrapecreators.x.v1-instagram-audio-reels";
const MAX_COST_USD = 0.01;

type Json = unknown;

/** The value trimmed for reading: two items of a list, 40 keys, strings cut at 200 characters, five levels deep. */
function trimmed(value: Json, depth = 0): Json {
  if (typeof value === "string") return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (Array.isArray(value)) return depth >= 5 ? `[${value.length} items]` : [...value.slice(0, 2).map((v) => trimmed(v, depth + 1)), ...(value.length > 2 ? [`… ${value.length} items`] : [])];
  if (value && typeof value === "object") {
    if (depth >= 5) return "{…}";
    const entries = Object.entries(value as Record<string, Json>);
    return Object.fromEntries([...entries.slice(0, 40).map(([k, v]) => [k, trimmed(v, depth + 1)]), ...(entries.length > 40 ? [["…", `${entries.length} keys`]] : [])]);
  }
  return value;
}

/** The first list found under one of these keys, at any depth. */
function listUnder(value: Json, keys: string[], depth = 0): Json[] {
  if (!value || typeof value !== "object" || depth > 6) return [];
  for (const [k, v] of Object.entries(value as Record<string, Json>)) {
    if (keys.includes(k) && Array.isArray(v)) return v;
  }
  for (const v of Object.values(value as Record<string, Json>)) {
    const found = listUnder(v, keys, depth + 1);
    if (found.length) return found;
  }
  return [];
}

/** The first text or number found under one of these keys, at any depth. */
function pick(value: Json, keys: string[], depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 6) return null;
  const record = value as Record<string, Json>;
  for (const k of keys) {
    const v = record[k];
    if ((typeof v === "string" && v) || typeof v === "number") return String(v);
  }
  for (const v of Object.values(record)) {
    const found = pick(v, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const action = new URL(request.url).searchParams.get("action");
  // This week's list made now (lib/trend-sounds.ts), as the Monday cron does: about $0.06 when its 30 sounds are new.
  if (action === "refresh") return Response.json(await refreshTrendSounds({ force: true }));
  // The covers the removed trend videos kept (media/trends/{list}/{video}.webp), deleted once.
  if (action === "drop_trend_covers") return Response.json(await dropTrendCovers());
  // The sounds of the top Reels of a few hashtags (Tristan: « les sons tendances insta […] aesthetic videos editing »).
  if (action === "bench_links") return Response.json(await benchLinks(await request.json().catch(() => ({}))));
  if (action === "bench_tags") return Response.json(await benchTags((new URL(request.url).searchParams.get("tags") ?? "").split(",")));
  if (action !== "bench") return Response.json({ error: "action=bench|refresh" }, { status: 400 });
  let costUsd = 0;
  let calls = 0;
  const call = async (id: string, query: Record<string, string | number>) => {
    const done = await tregCall(id, query, MAX_COST_USD, "GET").catch(() => null);
    calls += 1;
    costUsd += done?.costUsd ?? 0;
    return done?.answer ?? null;
  };

  // 1. The two charts, five songs each.
  const charts = await Promise.all([0, 1].map((scene) => call(CHART, { scene, cursor: 0, count: 5 })));
  const songs = charts.map((answer) =>
    listUnder(answer, ["music_list"]).map((item) => ({
      title: pick(item, ["title"]),
      author: pick(item, ["author", "owner_nickname"]),
      id: pick(item, ["id_str", "mid", "id"]),
      users: pick(item, ["user_count"]),
      trend: pick(item, ["trend"]),
    })),
  );
  // Three of the first chart, two of the second, each once.
  const [top = [], second = []] = songs;
  const chosen = [...top.slice(0, 3), ...second.slice(0, 2)].filter((s, i, all) => s.title && all.findIndex((o) => o.title === s.title) === i);

  // 2. Each one searched among Instagram's music.
  const searched = await Promise.all(
    chosen.map(async (song) => {
      const answer = await call(SEARCH, { keyword: [song.title, song.author].filter(Boolean).join(" ") });
      const items = listUnder(answer, ["items"]);
      return {
        song,
        found: items.slice(0, 3).map((item) => ({
          title: pick(item, ["title", "display_title"]),
          artist: pick(item, ["display_artist", "artist_name", "ig_username"]),
          audio_id: pick(item, ["audio_cluster_id", "audio_asset_id", "id", "pk"]),
        })),
        first: items[0] === undefined ? null : trimmed(items[0]),
        raw: items.length ? undefined : trimmed(answer),
      };
    }),
  );

  // 3. The Reels that use the first three found.
  const used = await Promise.all(
    searched
      .flatMap((s) => (s.found[0]?.audio_id ? [s.found[0].audio_id] : []))
      .slice(0, 3)
      .map(async (audioId) => {
        const answer = await call(REELS, { audio_id: audioId });
        const reels = listUnder(answer, ["reels", "items"]);
        return {
          audio_id: audioId,
          page: `https://www.instagram.com/reels/audio/${audioId}/`,
          reels: reels.length,
          has_more: pick(answer, ["has_more"]),
          total: pick(answer, ["media_count", "reels_count", "total"]),
          examples: reels.slice(0, 3).map((reel) => ({
            code: pick(reel, ["code", "shortcode"]),
            plays: pick(reel, ["play_count", "ig_play_count", "view_count"]),
            video: pick(reel, ["url"]),
          })),
          first: reels[0] === undefined ? trimmed(answer) : trimmed(reels[0]),
        };
      }),
  );

  await supabaseAdmin()
    .from("cost_events")
    .insert({ studio_id: null, kind: "trends", provider: "treg", units: calls, cost_eur: usdToEur(costUsd, env("USD_TO_EUR")), meta: { purpose: "sounds_bench", cost_usd: costUsd, calls } });

  return Response.json({
    cost_usd: costUsd,
    calls,
    charts: songs,
    chart_raw: charts.map((answer) => trimmed(listUnder(answer, ["music_list"])[0] ?? answer)),
    searched,
    used,
  });
}

/** Every file under media/trends/ (one folder per list), removed. */
async function dropTrendCovers(): Promise<{ removed: number }> {
  const bucket = supabaseAdmin().storage.from("media");
  const { data: folders } = await bucket.list("trends", { limit: 1000 });
  let removed = 0;
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`trends/${folder.name}`, { limit: 1000 });
    const paths = (files ?? []).map((f) => `trends/${folder.name}/${f.name}`);
    if (!paths.length) continue;
    const { data } = await bucket.remove(paths);
    removed += data?.length ?? 0;
  }
  return { removed };
}

/** Every scalar under a key that names a sound (sound, audio, music), at any depth: what the provider tells of it. */
function soundFields(value: Json, path = "", depth = 0, out: Record<string, string> = {}): Record<string, string> {
  if (!value || typeof value !== "object" || depth > 6) return out;
  for (const [k, v] of Object.entries(value as Record<string, Json>)) {
    const at = path ? `${path}.${k}` : k;
    if ((typeof v === "string" || typeof v === "number" || typeof v === "boolean") && /sound|audio|music|song|artist/i.test(at)) out[at] = String(v).slice(0, 160);
    else if (v && typeof v === "object" && !Array.isArray(v)) soundFields(v, at, depth + 1, out);
    else if (Array.isArray(v) && v[0] && typeof v[0] === "object" && /sound|audio|music/i.test(k)) soundFields(v[0], `${at}[0]`, depth + 1, out);
  }
  return out;
}

/**
 * The bench of the hashtags' sounds: the top Reels of each hashtag (anyapi.instagram.hashtag_top_posts, one page),
 * their sounds counted (how many top Reels use each one, their views, on which hashtags), and the fields the provider
 * gives of a sound (is its audio id there?). About $0.002 a hashtag, logged (kind trends, purpose sounds_tags_bench).
 */
async function benchTags(asked: string[]) {
  const tags = asked.map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter((t) => /^[\p{L}\p{N}_]{2,40}$/u.test(t)).slice(0, 10);
  let costUsd = 0;
  const read = await Promise.all(
    tags.map(async (hashtag) => {
      const done = await tregCall("anyapi.instagram.hashtag_top_posts", { hashtag }, 0.02).catch(() => null);
      costUsd += done?.costUsd ?? 0;
      return { hashtag, posts: listUnder(done?.answer ?? null, ["posts", "items", "data"]) };
    }),
  );
  const sounds = new Map<string, { title: string; author: string | null; reels: number; views: number; tags: Set<string>; example: string | null; fields: Record<string, string> }>();
  const keys = new Map<string, number>();
  let reels = 0;
  let named = 0;
  for (const { hashtag, posts } of read) {
    for (const post of posts) {
      reels += 1;
      const fields = soundFields(post);
      for (const k of Object.keys(fields)) keys.set(k, (keys.get(k) ?? 0) + 1);
      const last = (k: string) => k.split(".").pop() ?? k;
      const title = fields.soundTitle ?? fields.audioTitle ?? Object.entries(fields).find(([k]) => /title|name/i.test(last(k)) && !/artist|author|owner|user/i.test(last(k)))?.[1];
      if (!title) continue;
      named += 1;
      const author = fields.soundAuthor ?? fields.audioAuthor ?? Object.entries(fields).find(([k]) => /artist|author|owner|username/i.test(last(k)))?.[1] ?? null;
      const key = `${title.toLowerCase()}|${(author ?? "").toLowerCase()}`;
      const views = Number(pick(post, ["views", "play_count", "video_view_count", "playCount"]) ?? 0) || 0;
      const kept = sounds.get(key) ?? { title, author, reels: 0, views: 0, tags: new Set<string>(), example: null, fields };
      kept.reels += 1;
      kept.views += views;
      kept.tags.add(hashtag);
      kept.example ??= pick(post, ["shortcode", "code"]);
      sounds.set(key, kept);
    }
  }
  await supabaseAdmin()
    .from("cost_events")
    .insert({ studio_id: null, kind: "trends", provider: "treg", units: tags.length, cost_eur: usdToEur(costUsd, env("USD_TO_EUR")), meta: { purpose: "sounds_tags_bench", cost_usd: costUsd, tags } });
  return {
    cost_usd: costUsd,
    tags: read.map((r) => ({ hashtag: r.hashtag, reels: r.posts.length })),
    reels,
    named,
    sound_keys: Object.fromEntries([...keys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)),
    ranking: [...sounds.values()]
      .sort((a, b) => b.reels - a.reels || b.views - a.views)
      .slice(0, 60)
      .map((s) => ({ title: s.title, author: s.author, reels: s.reels, views: s.views, tags: [...s.tags], example: s.example, fields: s.fields })),
    sample: trimmed(read.find((r) => r.posts.length)?.posts[0] ?? null),
  };
}

/** A vm.tiktok.com short link opened to the video it leads to (its redirect), else as given. */
async function longTikTok(link: string): Promise<string> {
  if (!/\/\/(vm|vt)\.tiktok\.com\//i.test(link)) return link;
  const res = await fetch(link, { redirect: "manual", signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const to = res?.headers.get("location");
  return to ? to.replace(/[?#].*$/, "") : link;
}

/**
 * The bench of the sounds of Reels Tristan saved (« Documentation des liens », 43 links, 6 November): each one read
 * through Treg (Instagram: anyapi.instagram.post.detail; TikTok: treg.tiktok.video.detail), what it tells of its sound,
 * and the sounds counted. About $0.0015 a Reel, logged (kind trends, purpose sounds_links_bench).
 */
async function benchLinks(body: unknown) {
  const links = (Array.isArray((body as { links?: unknown })?.links) ? ((body as { links: unknown[] }).links as unknown[]) : [])
    .filter((l): l is string => typeof l === "string" && /^https:\/\/(www\.instagram\.com|vm\.tiktok\.com|vt\.tiktok\.com|www\.tiktok\.com)\//.test(l))
    .slice(0, 60);
  let costUsd = 0;
  const read = await Promise.all(
    links.map(async (link) => {
      const tiktok = /tiktok\.com/.test(link);
      const url = tiktok ? await longTikTok(link) : link;
      const done = await tregCall(tiktok ? "treg.tiktok.video.detail" : "anyapi.instagram.post.detail", tiktok ? { post: url } : { url }, 0.02).catch(() => null);
      costUsd += done?.costUsd ?? 0;
      const fields = soundFields(done?.answer ?? null);
      return { link, url, found: Boolean(done?.answer), fields };
    }),
  );
  await supabaseAdmin()
    .from("cost_events")
    .insert({ studio_id: null, kind: "trends", provider: "treg", units: links.length, cost_eur: usdToEur(costUsd, env("USD_TO_EUR")), meta: { purpose: "sounds_links_bench", cost_usd: costUsd } });
  return { cost_usd: costUsd, read: read.length, answered: read.filter((r) => r.found).length, links: read };
}
