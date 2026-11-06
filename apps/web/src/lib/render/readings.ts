import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  fileKey,
  fileReadingSchema,
  groundKey,
  isClipSegment,
  mediaSubjectsSchema,
  readPassages,
  shotReadingSchema,
  wantsReads,
  type EditPlan,
  type FileReading,
  type FileReadKind,
  type MediaSubjects,
  type ReadPassage,
} from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costMeta } from "@/lib/cost-scope";
import { timeLeft } from "@/lib/step-clock";
import { cutoutCostEur, fileReadsInSandbox, shotReadsInSandbox } from "./sandbox";
import { mergeSubjects } from "./subjects";
import { retryDue } from "./retry";

// What else is read on her media, with no model, on the cut-out sandbox's CPUs, kept beside her cut-outs
// (media_assets.subjects, removed with the media by the retention):
// - for a composition, on the passages its code names (readPassages): its sky as a matte (Skyline: her shot without its
//   sky, a transparent video) and its skyline (SkylineAt), its vanishing point (VanishingPoint), its light (LightUnder),
//   just before the render (shot_read.py), a JSON file per passage (~read) and the ground's video (~ground);
// - for the filler, on her files, when a model that uses them is filled (MontageSkill.reads): her camera's fast moves,
//   the moments her lens is covered, how colourful each file is (video_read.py), kept inline (~file).
// Never fails a render or a fill: what was not read is simply not there (the tools give their fallback).

type Plan = Pick<EditPlan, "segments" | "layers"> & { finish?: EditPlan["finish"] };
type Row = { id: string; kind: string; storage_path: string | null; subjects: unknown };

/** What the step keeps for the render after the readings (a Reel renders at 4 to 7 s a second of video). */
const RENDER_MARGIN_MS = 330_000;
/** The sandbox's work: its start and the files fetched, then a second of video read (its grid, its lines, its light), and a second made into a ground (each image at 1920 px, encoded). */
const READ_LOAD_MS = 25_000;
const READ_WORK_PER_SECOND = 1_500;
const GROUND_WORK_PER_SECOND = 10_000;
/** A file read for the filler: about a third of a second a second of video, its fetch and start besides. */
const FILE_LOAD_MS = 20_000;
const FILE_WORK_PER_SECOND = 500;
/** The most files read for one fill, and the longest wait for them (the filler goes without past it). */
const FILE_MAX = 16;
const FILE_WAIT_MS = 150_000;

const kept = (row: Row | undefined): MediaSubjects => mediaSubjectsSchema.safeParse(row?.subjects ?? {}).data ?? {};
const due = (k: MediaSubjects[string] | undefined) => !k || ("failed_at" in k && retryDue(k));

/** Where a passage's readings and its ground are kept (beside its cut-outs, removed with the clip by the retention). */
const readFile = (studioId: string, mediaId: string, key: string, ext: string) => `${studioId}/subjects/${mediaId}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}.${ext}`;

/**
 * Reads, before the render, what this plan's compositions ask of her shots and was not read yet (or failed a while
 * ago): their readings (sky, vanishing point, light) and, for those their code draws with Skyline, their ground; as many
 * as the step has time for before its render. In the cut-out sandbox, its work billed (cost_events kind shot_reading).
 */
export async function ensureShotReadings(studioId: string, postId: string, plan: Plan): Promise<void> {
  if (!wantsReads(plan)) return;
  const db = supabaseAdmin();
  const ids = [...new Set(plan.segments.flatMap((s) => (isClipSegment(s) ? [s.clip_id] : [])))];
  const { data } = await db.from("media_assets").select("id, kind, storage_path, subjects").eq("studio_id", studioId).in("id", ids);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  // A video held as filmed (steady off) is read on its steadied copy: not read then. A photo is read on itself.
  const isVideo = (id: string) => plan.finish?.steady !== "off" && rows.get(id)?.kind === "video";
  const missing = readPassages(plan, isVideo).flatMap((p): ReadPassage[] => {
    if (p.photo && rows.get(p.clip_id)?.kind !== "image") return [];
    const have = kept(rows.get(p.clip_id));
    const readDue = due(have[p.key]);
    const groundDue = p.kinds.includes("ground") && due(have[groundKey(p.clip_id, p.from, p.to)]);
    if (!readDue && !groundDue) return [];
    // Its ground made only when it is missing; its readings read again with it (one pass reads both).
    return [{ ...p, kinds: groundDue ? p.kinds : p.kinds.filter((k) => k !== "ground") }];
  });
  if (!missing.length) return;
  const left = timeLeft();
  let budget = (Number.isFinite(left) ? left : 800_000) - RENDER_MARGIN_MS - READ_LOAD_MS;
  const chosen = missing.filter((p) => {
    const seconds = p.first ? 1 : Math.max(1, p.to - p.from);
    const need = seconds * (READ_WORK_PER_SECOND + (p.kinds.includes("ground") ? GROUND_WORK_PER_SECOND : 0));
    if (need > budget) return false;
    budget -= need;
    return true;
  });
  if (!chosen.length) return;
  const clips = [...new Set(chosen.map((p) => p.clip_id))];
  const paths = clips.map((id) => rows.get(id)?.storage_path ?? "");
  const signed = (await db.storage.from("media").createSignedUrls(paths.filter(Boolean), 3600)).data ?? [];
  const url = (id: string) => signed.find((s) => s.path === paths[clips.indexOf(id)])?.signedUrl;
  const jobs = chosen.flatMap((p) => {
    const u = url(p.clip_id);
    // A shot at another pace is read on its first image only (its regions: `first`).
    return u ? [{ key: p.key, url: u, from: p.from, to: p.first ? p.from : p.to, read: p.kinds, ...(p.photo ? { photo: true as const } : {}) }] : [];
  });
  if (!jobs.length) return;
  try {
    const { results, seconds } = await shotReadsInSandbox(`read-${randomUUID()}`, jobs);
    const at = new Date().toISOString();
    const updates = new Map<string, MediaSubjects>();
    const record = (clip: string, key: string, value: MediaSubjects[string]) => updates.set(clip, { ...(updates.get(clip) ?? {}), [key]: value });
    let grounds = 0;
    for (const p of chosen) {
      const result = results[p.key];
      if (!result) continue;
      if (result instanceof Error) {
        console.warn("shot not read", p.key, result.message);
        record(p.clip_id, p.key, { failed_at: at, error: result.message.slice(0, 200) });
        continue;
      }
      const reading = shotReadingSchema.safeParse(result.reading).data;
      if (!reading) continue;
      const path = readFile(studioId, p.clip_id, p.key, "read.json");
      const saved = await db.storage.from("media").upload(path, JSON.stringify(reading), { contentType: "application/json", upsert: true });
      if (saved.error) {
        console.warn("shot readings not kept", p.key, saved.error.message);
        continue;
      }
      record(p.clip_id, p.key, { path, still: result.still, at, frames: result.frames, read: true });
      const key = groundKey(p.clip_id, p.from, p.to);
      // Asked and not made: no sky in this shot (Skyline draws nothing there); not asked again for six hours (retryDue).
      if (!result.ground && p.kinds.includes("ground")) record(p.clip_id, key, { failed_at: at, error: "aucun ciel" });
      if (result.ground) {
        const file = readFile(studioId, p.clip_id, key, result.ground.still ? "png" : "webm");
        const up = await db.storage.from("media").upload(file, result.ground.file, { contentType: result.ground.still ? "image/png" : "video/webm", upsert: true });
        if (up.error) console.warn("ground not kept", key, up.error.message);
        else {
          record(p.clip_id, key, { path: file, still: result.ground.still, at, frames: result.frames, ground: true });
          grounds++;
        }
      }
    }
    await mergeSubjects(studioId, updates);
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "shot_reading",
      provider: "vercel_sandbox",
      units: Math.round(seconds),
      cost_eur: cutoutCostEur(seconds),
      meta: costMeta({ post_id: postId, passages: jobs.length, grounds, seconds_of_video: Math.round(chosen.reduce((n, p) => n + p.to - p.from, 0) * 10) / 10 }),
    });
  } catch (error) {
    console.warn("shots not read, the tools give their fallback", error instanceof Error ? error.message.slice(0, 300) : error);
  }
}

/** Her files' own readings for the filler (moves, covered moments, colours), those kept, by media id. */
export async function fileReadings(studioId: string, mediaIds: string[]): Promise<Record<string, FileReading>> {
  if (!mediaIds.length) return {};
  const { data } = await supabaseAdmin().from("media_assets").select("id, kind, storage_path, subjects").eq("studio_id", studioId).in("id", [...new Set(mediaIds)]);
  return Object.fromEntries(
    ((data ?? []) as Row[]).flatMap((row) => {
      const k = kept(row)[fileKey(row.id)];
      return k && "file" in k ? [[row.id, k.file] as const] : [];
    }),
  );
}

/**
 * Reads what a model's filler wants of her files (MontageSkill.reads: her camera's fast moves, the moments her lens is
 * covered, her colours) on those not read yet, in the cut-out sandbox, waiting FILE_WAIT_MS at most (the filler goes
 * without past it), its work billed (cost_events kind file_reading); then what is kept for all of them.
 */
export async function ensureFileReadings(studioId: string, postId: string, mediaIds: string[], kinds: FileReadKind[] | undefined): Promise<Record<string, FileReading>> {
  if (!kinds?.length || !mediaIds.length) return fileReadings(studioId, mediaIds);
  const db = supabaseAdmin();
  const { data } = await db.from("media_assets").select("id, kind, storage_path, subjects").eq("studio_id", studioId).in("id", [...new Set(mediaIds)]);
  const rows = ((data ?? []) as Row[]).filter((r) => r.storage_path && (r.kind === "video" || (r.kind === "image" && kinds.includes("colour"))));
  const missing = rows.filter((r) => due(kept(r)[fileKey(r.id)])).slice(0, FILE_MAX);
  if (missing.length) {
    const signed = (await db.storage.from("media").createSignedUrls(missing.map((r) => r.storage_path!), 3600)).data ?? [];
    const files = missing.flatMap((r) => {
      const url = signed.find((s) => s.path === r.storage_path)?.signedUrl;
      return url ? [{ id: r.id, url, ...(r.kind === "image" ? { photo: true } : {}) }] : [];
    });
    const read = fileReadsInSandbox(`file-${randomUUID()}`, files)
      .then(async ({ results, seconds }) => {
        const at = new Date().toISOString();
        const updates = new Map<string, MediaSubjects>();
        for (const f of files) {
          const r = results[f.id];
          if (!r) continue;
          const file = r instanceof Error ? null : fileReadingSchema.safeParse(r).data;
          if (r instanceof Error || !file) console.warn("file not read", f.id, r instanceof Error ? r.message : "unreadable");
          updates.set(f.id, { [fileKey(f.id)]: file ? { file, at } : { failed_at: at, error: r instanceof Error ? r.message.slice(0, 200) : "illisible" } });
        }
        await mergeSubjects(studioId, updates);
        await db.from("cost_events").insert({
          studio_id: studioId,
          kind: "file_reading",
          provider: "vercel_sandbox",
          units: Math.round(seconds),
          cost_eur: cutoutCostEur(seconds),
          meta: costMeta({ post_id: postId, files: files.length, kinds }),
        });
      })
      .catch((error: unknown) => console.warn("files not read, the filler goes without", error instanceof Error ? error.message.slice(0, 300) : error));
    const work = FILE_LOAD_MS + missing.length * 30 * FILE_WORK_PER_SECOND;
    await Promise.race([read, new Promise((resolve) => setTimeout(resolve, Math.min(FILE_WAIT_MS, work * 3)))]);
  }
  return fileReadings(studioId, mediaIds);
}
