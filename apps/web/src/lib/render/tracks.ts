import "server-only";
import { randomUUID } from "node:crypto";
import { clipAnalysisSchema, mediaTracksSchema, TRACK_MODEL, tracksFileSchema, trackWorthy, type MediaTracks, type TracksByClip, type TracksFile } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cutoutCostEur, tracksInSandbox } from "./sandbox";
import { costMeta } from "@/lib/cost-scope";

// What moves in her videos (hands, faces, bodies, image by image), read once per clip in the
// cut-out sandbox and kept beside it in Storage ({studio}/tracks/{media}.json, removed with
// the clip by the retention). The animations over a clip follow it (`track` in their code).

/** The most video followed in one go, in seconds (about 2.5 s of work for each, four clips at a time). */
const MAX_SECONDS = 150;
/** A clip whose reading failed is tried again after this long. */
const RETRY_MS = 6 * 3600_000;

/** Where a clip's tracks are kept. */
export const tracksPath = (studioId: string, mediaId: string) => `${studioId}/tracks/${mediaId}.json`;

/**
 * Follows what moves in the videos that have someone in them and no tracks yet (or tracks
 * from older models). Never fails a montage: a clip without tracks is still a clip, its
 * animations just see nothing to follow.
 */
export async function ensureTracks(studioId: string, mediaIds: string[]): Promise<void> {
  if (!mediaIds.length) return;
  const db = supabaseAdmin();
  const [{ data: assets }, { data: analyses }] = await Promise.all([
    db.from("media_assets").select("id, kind, storage_path, duration, tracks").eq("studio_id", studioId).in("id", mediaIds),
    db.from("clip_analyses").select("media_id, analysis").in("media_id", mediaIds).order("created_at", { ascending: false }),
  ]);
  const worthy = new Set(
    (analyses ?? []).flatMap((row) => {
      const analysis = clipAnalysisSchema.safeParse(row.analysis);
      return analysis.success && trackWorthy(analysis.data) ? [row.media_id as string] : [];
    }),
  );
  let budget = MAX_SECONDS;
  const missing = mediaIds.flatMap((id) => {
    const a = (assets ?? []).find((x) => x.id === id);
    if (!a || a.kind !== "video" || !a.storage_path || !worthy.has(id)) return [];
    const kept = mediaTracksSchema.safeParse(a.tracks);
    if (kept.success && kept.data.model === TRACK_MODEL && ("path" in kept.data || Date.now() - Date.parse(kept.data.failed_at) < RETRY_MS)) return [];
    const seconds = Math.min(60, Number(a.duration) || 30);
    if (seconds > budget) return [];
    budget -= seconds;
    return [{ id, path: a.storage_path as string }];
  });
  if (!missing.length) return;
  const signed = await db.storage.from("media").createSignedUrls(missing.map((a) => a.path), 3600);
  const videos = missing.flatMap((a, i) => (signed.data?.[i]?.signedUrl ? [{ id: a.id, url: signed.data[i]!.signedUrl }] : []));
  if (!videos.length) return;
  try {
    const { results, seconds } = await tracksInSandbox(`track-${randomUUID()}`, videos);
    for (const v of videos) {
      const result = results[v.id];
      const at = new Date().toISOString();
      if (!result || result instanceof Error) {
        console.warn("tracking failed", v.id, result instanceof Error ? result.message : "no result");
        const failed: MediaTracks = { failed_at: at, error: result instanceof Error ? result.message.slice(0, 200) : "no result", model: TRACK_MODEL };
        await db.from("media_assets").update({ tracks: failed }).eq("id", v.id).eq("studio_id", studioId);
        continue;
      }
      const path = tracksPath(studioId, v.id);
      const uploaded = await db.storage.from("media").upload(path, result.file, { contentType: "application/json", upsert: true });
      if (uploaded.error) {
        console.warn("tracks not kept", v.id, uploaded.error.message);
        continue;
      }
      const tracks: MediaTracks = { path, frames: result.frames, hands: result.hands, faces: result.faces, bodies: result.bodies, model: TRACK_MODEL, at };
      await db.from("media_assets").update({ tracks }).eq("id", v.id).eq("studio_id", studioId);
    }
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "tracking",
      provider: "vercel_sandbox",
      units: Math.round(seconds),
      cost_eur: cutoutCostEur(seconds),
      meta: costMeta({ videos: videos.length, model: TRACK_MODEL }),
    });
  } catch (error) {
    console.warn("tracking unavailable, the animations see nothing to follow", error instanceof Error ? error.message.slice(0, 300) : error);
  }
}

/** The tracks kept for these clips (those that have some), read from Storage. */
export async function loadTracks(studioId: string, mediaIds: string[]): Promise<TracksByClip> {
  if (!mediaIds.length) return {};
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, tracks").eq("studio_id", studioId).in("id", mediaIds);
  const kept = (assets ?? []).flatMap((a) => {
    const tracks = mediaTracksSchema.safeParse(a.tracks);
    return tracks.success && "path" in tracks.data && tracks.data.path.startsWith(`${studioId}/`) && (tracks.data.hands || tracks.data.faces || tracks.data.bodies)
      ? [{ id: a.id as string, path: tracks.data.path }]
      : [];
  });
  const files = await Promise.all(
    kept.map(async (k): Promise<[string, TracksFile][]> => {
      try {
        const download = await db.storage.from("media").download(k.path);
        if (download.error) return [];
        const parsed = tracksFileSchema.safeParse(JSON.parse(await download.data.text()));
        return parsed.success ? [[k.id, parsed.data]] : [];
      } catch (error) {
        console.warn("tracks not read", k.id, error instanceof Error ? error.message : error);
        return [];
      }
    }),
  );
  return Object.fromEntries(files.flat());
}
