import { usdToEur } from "@fauve/agent";
import { cronAuthorized } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tregCall } from "@/lib/treg";

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
  if (new URL(request.url).searchParams.get("action") !== "bench") return Response.json({ error: "action=bench" }, { status: 400 });
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
