import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  clearMapSchema,
  clearPassages,
  depthPassages,
  groundKey,
  isClipSegment,
  mediaSubjectsSchema,
  mediaTracksSchema,
  nearPassages,
  OBJECT_CARD,
  objectKey,
  objectPassages,
  objectsWithinBudget,
  PHOTO_OBJECT_MAX,
  photoKey,
  readPassages,
  shotReadingSchema,
  subjectPassages,
  wantsClear,
  wantsDepth,
  wantsNear,
  wantsObjects,
  type ClearMap,
  type ClearPassage,
  type EditPlan,
  type MediaSubjects,
  type ObjectPassage,
  type ShotReading,
  type SubjectPassage,
} from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costMeta } from "@/lib/cost-scope";
import { timeLeft } from "@/lib/step-clock";
import { depthVideosOnGpu, GPU_START_MS, gpuCostEur, gpuReady, objectsOnGpu, subjectsOnGpu } from "./gpu";
import { cutoutCostEur, subjectsInSandbox } from "./sandbox";

// Her subject cut out at every image of the passages a composition draws it on (Subject), made in the cut-out
// sandbox just before the render (apps/render/matte.py) and kept beside the clip in Storage
// ({studio}/subjects/{media}-{passage}.webm, or .png when nothing moves; listed in media_assets.subjects and
// removed with the clip by the retention): the next version of the Reel finds them made. Never fails a render:
// a passage without its cut-out simply has the composition's text in front of her.

type Plan = Pick<EditPlan, "segments" | "layers"> & { subtitles?: boolean; captions?: EditPlan["captions"]; finish?: EditPlan["finish"] };

/** Seconds of the sandbox's work a second of moving video takes, at most (a fast walk: about a minute on its 8 CPUs). */
const WORK_PER_SECOND = 60;
/** The same for a person the tracker followed, cut out by her own model at every image (about 7 s locally on 4 CPUs). */
const PERSON_WORK_PER_SECOND = 10;
/** What the step keeps for the render after the cut-outs (a Reel renders at 4 to 7 s a second of video). */
const RENDER_MARGIN_MS = 330_000;
/** A passage whose cut-out failed is tried again after this long. */
const RETRY_MS = 6 * 3600_000;

/** Where a passage's cut-out is kept. */
export const subjectPath = (studioId: string, mediaId: string, key: string, still: boolean) =>
  `${studioId}/subjects/${mediaId}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}.${still ? "png" : "webm"}`;

/**
 * Keeps a passage's outline at each image beside its cut-out ({path}.contour.json), for a line along its edge
 * (Outline); its path, or nothing when there is none or it could not be kept (the line is then simply not drawn).
 */
async function keepContour(studioId: string, mediaId: string, key: string, contours: (number[] | null)[] | undefined): Promise<string | undefined> {
  if (!contours?.some(Boolean)) return undefined;
  const path = `${subjectPath(studioId, mediaId, key, false).replace(/\.webm$/, "")}.contour.json`;
  const saved = await supabaseAdmin().storage.from("media").upload(path, JSON.stringify(contours), { contentType: "application/json", upsert: true });
  if (saved.error) {
    console.warn("subject outline not kept", key, saved.error.message);
    return undefined;
  }
  return path;
}

/** The passages to cut out for this plan, with their clips' rows (her own steadied video plays: an unsteadied original is left out). */
async function planned(studioId: string, plan: Plan, anticipate = false) {
  const ids = [...new Set(plan.segments.flatMap((s) => (isClipSegment(s) ? [s.clip_id] : [])))];
  if (!ids.length) return { passages: [] as SubjectPassage[], rows: new Map<string, Row>(), isVideo: () => false };
  const { data } = await supabaseAdmin().from("media_assets").select("id, kind, storage_path, subjects, tracks").eq("studio_id", studioId).in("id", ids);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  // Her videos held as filmed (steady off): their cut-outs, read on the steadied copy, would not fall on them. Her photos still have theirs.
  const isVideo = (id: string) => plan.finish?.steady !== "off" && rows.get(id)?.kind === "video";
  return { passages: subjectPassages(plan, isVideo, anticipate), rows, isVideo };
}

type Row = { id: string; kind: string; storage_path: string | null; subjects: unknown; tracks: unknown };

/**
 * Merges each clip's new passages into its cut-outs (media_assets.subjects), one statement a clip
 * (merge_media_subjects): her cut-out, an object followed and its depth are made at the same time on the same clip,
 * and a whole record written back by one erased what another had just kept (the cup of the Text Brush test).
 */
export async function mergeSubjects(studioId: string, updates: Map<string, MediaSubjects>): Promise<void> {
  const db = supabaseAdmin();
  await Promise.all(
    [...updates].map(async ([id, patch]) => {
      const { error } = await db.rpc("merge_media_subjects", { p_media: id, p_studio: studioId, p_patch: patch });
      if (error) console.warn("cut-outs not kept", id, error.message);
    }),
  );
}

const kept = (row: Row | undefined): MediaSubjects => mediaSubjectsSchema.safeParse(row?.subjects ?? {}).data ?? {};

/**
 * On the card: its model loaded and its clip fetched (5 s and 1 s measured), then a second of video (its 30 images
 * read, 12.3 s, and their edge made, 2.3 s, on an A10G in half precision). The card gets its start, this, and twice
 * the work, never the whole step: when it fails, the cut-out sandbox still has time for the passages.
 */
const GPU_LOAD_MS = 30_000;
const GPU_WORK_PER_SECOND = 16;

/**
 * Cuts out the passages this plan's compositions draw her on and that have no cut-out yet, as many as the step has
 * time for before its render (the rest render without: the text in front of her, and are made for the next version).
 * On the rented card first (the full portrait model at every image, lib/render/gpu.ts) when it is set up; what it
 * could not do goes to the cut-out sandbox, as before.
 */
export async function ensureSubjects(studioId: string, postId: string, plan: Plan, options: { anticipate?: boolean } = {}): Promise<void> {
  const { passages, rows } = await planned(studioId, plan, options.anticipate);
  const missing = passages.filter((p) => {
    const k = kept(rows.get(p.clip_id))[p.key];
    return !k || ("failed_at" in k && Date.now() - Date.parse(k.failed_at) > RETRY_MS);
  });
  if (!missing.length) return;
  // Outside a step (no deadline known), as if a step of Vercel's 800 s had just begun.
  const budgetNow = () => {
    const left = timeLeft();
    return (Number.isFinite(left) ? left : 800_000) - RENDER_MARGIN_MS;
  };
  const updates = new Map<string, MediaSubjects>();
  const record = (p: SubjectPassage, value: MediaSubjects[string]) => {
    const next = updates.get(p.clip_id) ?? {};
    next[p.key] = value;
    updates.set(p.clip_id, next);
  };
  let pending = missing;
  if (gpuReady()) {
    const budget = budgetNow() - GPU_START_MS - GPU_LOAD_MS;
    let room = budget;
    const chosen = missing.filter((p) => {
      const need = (p.to - p.from) * GPU_WORK_PER_SECOND * 1000;
      if (need > room) return false;
      room -= need;
      return true;
    });
    const work = budget - room;
    const deadline = Math.min(budgetNow(), GPU_START_MS + GPU_LOAD_MS + 2 * work);
    const done = chosen.length ? await cutOnGpu(studioId, postId, chosen, rows, record, deadline).catch((error: unknown) => {
      console.warn("subject cut-outs on the card unavailable, the sandbox takes them", error instanceof Error ? error.message.slice(0, 300) : error);
      return new Set<string>();
    }) : new Set<string>();
    pending = missing.filter((p) => !done.has(p.key));
  }
  if (pending.length) await cutInSandbox(studioId, postId, pending, rows, record, budgetNow());
  await mergeSubjects(studioId, updates);
}

type Record_ = (p: SubjectPassage, value: MediaSubjects[string]) => void;

/** The passages cut out on the rented card, each sent straight to its place in Storage; the keys it made. */
async function cutOnGpu(studioId: string, postId: string, chosen: SubjectPassage[], rows: Map<string, Row>, record: Record_, deadlineMs: number): Promise<Set<string>> {
  const db = supabaseAdmin();
  const clips = [...new Set(chosen.map((p) => p.clip_id))];
  const clipPaths = clips.map((id) => rows.get(id)?.storage_path ?? "");
  const signed = (await db.storage.from("media").createSignedUrls(clipPaths.filter(Boolean), 3600)).data ?? [];
  const jobs = (
    await Promise.all(
      chosen.map(async (p) => {
        const url = signed.find((s) => s.path === clipPaths[clips.indexOf(p.clip_id)])?.signedUrl;
        const [webm, png] = await Promise.all(
          [false, true].map((still) => db.storage.from("media").createSignedUploadUrl(subjectPath(studioId, p.clip_id, p.key, still), { upsert: true })),
        );
        return url && webm?.data?.signedUrl && png?.data?.signedUrl ? [{ key: p.key, url, from: p.from, to: p.to, upload: { webm: webm.data.signedUrl, png: png.data.signedUrl } }] : [];
      }),
    )
  ).flat();
  if (!jobs.length) return new Set();
  const { results, seconds, gpu } = await subjectsOnGpu(jobs, deadlineMs);
  const at = new Date().toISOString();
  const done = new Set<string>();
  for (const p of chosen) {
    const result = results[p.key];
    if (!result || result instanceof Error) {
      if (result) console.warn("subject cut-out on the card failed", p.key, result.message);
      continue;
    }
    done.add(p.key);
    const contour = await keepContour(studioId, p.clip_id, p.key, result.contours);
    record(p, {
      path: subjectPath(studioId, p.clip_id, p.key, result.still),
      still: result.still,
      at,
      frames: result.frames,
      keys: result.keys,
      people: result.people,
      ...(result.top !== undefined ? { top: result.top } : {}),
      ...(result.boxes?.length ? { boxes: result.boxes } : {}),
      ...(contour ? { contour } : {}),
    });
  }
  // The card's time, billed whether or not it cut out (none when no card was allotted).
  if (seconds > 0)
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "matting",
      provider: "modal",
      units: Math.round(seconds),
      cost_eur: gpuCostEur(seconds, gpu),
      meta: costMeta({ post_id: postId, passages: jobs.length, done: done.size, gpu, seconds_of_video: Math.round(chosen.reduce((n, p) => n + p.to - p.from, 0) * 10) / 10 }),
    });
  return done;
}

/** The passages cut out in the cut-out sandbox (the photo model on key images, or the person model at every image). */
async function cutInSandbox(studioId: string, postId: string, missing: SubjectPassage[], rows: Map<string, Row>, record: Record_, startBudget: number): Promise<void> {
  let budget = startBudget;
  // A clip where the tracker followed someone is cut out by the person's own model, much faster.
  const followed = (id: string) => {
    const t = mediaTracksSchema.safeParse(rows.get(id)?.tracks).data;
    return Boolean(t && "path" in t && t.bodies);
  };
  const chosen = missing.filter((p) => {
    const need = (p.to - p.from) * (followed(p.clip_id) ? PERSON_WORK_PER_SECOND : WORK_PER_SECOND) * 1000;
    if (need > budget) return false;
    budget -= need;
    return true;
  });
  if (!chosen.length) return;
  const db = supabaseAdmin();
  const clips = [...new Set(chosen.map((p) => p.clip_id))];
  const clipPaths = clips.map((id) => rows.get(id)?.storage_path ?? "");
  const trackPaths = clips.map((id) => {
    const t = mediaTracksSchema.safeParse(rows.get(id)?.tracks).data;
    return t && "path" in t && t.bodies && t.path.startsWith(`${studioId}/`) ? t.path : "";
  });
  const signed = (await db.storage.from("media").createSignedUrls([...clipPaths, ...trackPaths].filter(Boolean), 3600)).data ?? [];
  const url = (path: string) => (path ? signed.find((s) => s.path === path)?.signedUrl : undefined);
  const jobs = chosen.flatMap((p) => {
    const i = clips.indexOf(p.clip_id);
    const clip = url(clipPaths[i]!);
    const track = url(trackPaths[i]!);
    return clip ? [{ key: p.key, url: clip, from: p.from, to: p.to, ...(track ? { trackUrl: track } : {}) }] : [];
  });
  if (!jobs.length) return;
  try {
    const { results, seconds } = await subjectsInSandbox(`subject-${randomUUID()}`, jobs);
    const at = new Date().toISOString();
    for (const p of chosen) {
      const result = results[p.key];
      if (!result) continue;
      if (result instanceof Error) {
        console.warn("subject cut-out failed", p.key, result.message);
        record(p, { failed_at: at, error: result.message.slice(0, 200) });
        continue;
      }
      const path = subjectPath(studioId, p.clip_id, p.key, result.still);
      const uploaded = await db.storage.from("media").upload(path, result.file, { contentType: result.still ? "image/png" : "video/webm", upsert: true });
      if (uploaded.error) {
        console.warn("subject cut-out not kept", p.key, uploaded.error.message);
        continue;
      }
      const contour = await keepContour(studioId, p.clip_id, p.key, result.contours);
      record(p, {
        path,
        still: result.still,
        at,
        frames: result.frames,
        keys: result.keys,
        people: result.people,
        ...(result.top !== undefined ? { top: result.top } : {}),
        ...(result.boxes?.length ? { boxes: result.boxes } : {}),
        ...(contour ? { contour } : {}),
      });
    }
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "matting",
      provider: "vercel_sandbox",
      units: Math.round(seconds),
      cost_eur: cutoutCostEur(seconds),
      meta: costMeta({ post_id: postId, passages: jobs.length, seconds_of_video: Math.round(chosen.reduce((n, p) => n + p.to - p.from, 0) * 10) / 10 }),
    });
  } catch (error) {
    console.warn("subject cut-outs unavailable, the texts stay in front", error instanceof Error ? error.message.slice(0, 300) : error);
  }
}

/** A passage's clear areas, read from their file (nothing when it is missing or unreadable: ClearBox then gives its fallback). */
async function readClear(path: string): Promise<ClearMap | undefined> {
  const { data } = await supabaseAdmin().storage.from("media").download(path);
  if (!data) return undefined;
  try {
    return clearMapSchema.safeParse(JSON.parse(await data.text())).data;
  } catch {
    return undefined;
  }
}

/** A passage's readings (its sky, vanishing point and light: lib/render/readings.ts), read from their file (nothing when it is missing or unreadable). */
async function readShotReading(path: string): Promise<ShotReading | undefined> {
  const { data } = await supabaseAdmin().storage.from("media").download(path);
  if (!data) return undefined;
  try {
    return shotReadingSchema.safeParse(JSON.parse(await data.text())).data;
  } catch {
    return undefined;
  }
}

/** A passage's outline at each image, read from its file (nothing when it is missing or unreadable). */
async function readContour(path: string): Promise<(number[] | null)[] | undefined> {
  const { data } = await supabaseAdmin().storage.from("media").download(path);
  if (!data) return undefined;
  try {
    const parsed: unknown = JSON.parse(await data.text());
    return Array.isArray(parsed) ? (parsed.map((c) => (Array.isArray(c) && c.every((v) => typeof v === "number") ? (c as number[]) : null)) as (number[] | null)[]) : undefined;
  } catch {
    return undefined;
  }
}

/** What the render reads of a passage: its cut-out signed, its boxes, outline and pieces; or its clear areas or its readings (no file to draw). */
type SubjectInput = { src: string; still?: boolean; top?: number; boxes?: (number[] | null)[]; contours?: (number[] | null)[]; parts?: number[]; clear?: ClearMap; reading?: ShotReading };

/**
 * The cut-outs this plan can draw, signed for the render and the live preview (by passage, subjectKey), with their
 * outlines; the clear areas its texts are set in (clearKey); the readings of the shots it reads (readKey: their sky,
 * vanishing point and light), their grounds (groundKey) and the nearness of the shots it rebuilds by depth (nearKey).
 */
export async function subjectInputs(studioId: string, plan: Plan): Promise<Record<string, SubjectInput>> {
  const { passages: herPassages, rows, isVideo } = await planned(studioId, plan);
  // The objects its compositions follow too (a cup, a product, one found on a photo), kept the same way under their own keys, the shots they show in depth and those they set a text in the clear area of.
  const reads = readPassages(plan, isVideo).flatMap((p) => [p, ...(p.kinds.includes("ground") ? [{ ...p, key: groundKey(p.clip_id, p.from, p.to) }] : [])]);
  const passages = [...herPassages, ...objectPassages(plan, isVideo), ...depthPassages(plan, isVideo), ...clearPassages(plan, isVideo), ...nearPassages(plan, isVideo), ...reads];
  const found = passages.flatMap((p) => {
    const k = kept(rows.get(p.clip_id))[p.key];
    return k && "path" in k && k.path.startsWith(`${studioId}/`)
      ? [{ key: p.key, path: k.path, still: k.still, top: k.top, boxes: k.boxes, parts: k.parts, contour: k.contour?.startsWith(`${studioId}/`) ? k.contour : undefined, clear: k.clear === true, read: k.read === true }]
      : [];
  });
  if (!found.length) return {};
  const [signed, contours, clears, readings] = await Promise.all([
    supabaseAdmin().storage.from("media").createSignedUrls(found.map((f) => f.path), 7200).then((r) => r.data ?? []),
    Promise.all(found.map((f) => (f.contour ? readContour(f.contour).catch(() => undefined) : undefined))),
    Promise.all(found.map((f) => (f.clear ? readClear(f.path).catch(() => undefined) : undefined))),
    Promise.all(found.map((f) => (f.read ? readShotReading(f.path).catch(() => undefined) : undefined))),
  ]);
  return Object.fromEntries(
    found.flatMap((f, i): [string, SubjectInput][] => {
      if (f.clear) return clears[i] ? [[f.key, { src: "", clear: clears[i] }]] : [];
      if (f.read) return readings[i] ? [[f.key, { src: "", reading: readings[i] }]] : [];
      const src = signed[i]?.signedUrl;
      if (!src) return [];
      return [
        [
          f.key,
          {
            src,
            ...(f.still ? { still: true } : {}),
            ...(f.top !== undefined ? { top: f.top } : {}),
            ...(f.boxes?.length ? { boxes: f.boxes } : {}),
            ...(f.parts?.length ? { parts: f.parts } : {}),
            ...(contours[i]?.length ? { contours: contours[i] } : {}),
          },
        ],
      ];
    }),
  );
}

// ——— Objects she shows (a cup, a product): followed on the card ————————————————————————————————————————

/** On the card: the object found on one image and followed both ways through its passage (SAM 2), then its edge made, a second of video. */
const OBJECT_LOAD_MS = OBJECT_CARD.load * 1000;
const OBJECT_WORK_PER_SECOND = OBJECT_CARD.perSecond;
/** An object found on a photo: one image read, its edge made at full size (a few seconds with its fetch and its send). */
const PHOTO_OBJECT_MS = OBJECT_CARD.photo * 1000;

/**
 * Follows the objects a Reel's compositions name (Subject, SubjectBox, SubjectOutline or Outline given its name)
 * through their passages, on the rented card only (on the sandbox's CPUs it would take minutes a second): each found
 * by its name on one image, followed image by image, cut out like her, kept beside the clip (media_assets.subjects,
 * under `subjectKey#name`). In the same machine, the clear areas of the shots its animations set a text in (ClearBox:
 * clear_area.py, on its CPU; a machine without a card when no object is followed), kept the same way under
 * `subjectKey~clear`. Never fails a render: an object not followed is simply not drawn, a text without its clear area
 * takes its fallback place.
 */
export async function ensureObjects(studioId: string, postId: string, plan: Plan): Promise<void> {
  if (!gpuReady() || (!wantsObjects(plan) && !wantsClear(plan))) return;
  const db = supabaseAdmin();
  const ids = [...new Set(plan.segments.flatMap((s) => (isClipSegment(s) ? [s.clip_id] : [])))];
  const { data } = await db.from("media_assets").select("id, kind, storage_path, subjects, tracks").eq("studio_id", studioId).in("id", ids);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  const due = (p: SubjectPassage & { photo?: true }) => {
    if (p.photo && rows.get(p.clip_id)?.kind !== "image") return false;
    const k = kept(rows.get(p.clip_id))[p.key];
    return !k || ("failed_at" in k && Date.now() - Date.parse(k.failed_at) > RETRY_MS);
  };
  // A video held as filmed (steady off) is read on its steadied copy: not read then. A photo is read on itself.
  const isVideo = (id: string) => plan.finish?.steady !== "off" && rows.get(id)?.kind === "video";
  await followObjects(studioId, postId, objectPassages(plan, isVideo).filter(due), rows, clearPassages(plan, isVideo).filter(due));
}

/**
 * Finds the objects a carousel's code names on her photos (a glass, the bottle she holds: Subject, SubjectBox,
 * SubjectOutline or Outline given its name), on the rented card, and keeps each one on its photo
 * (media_assets.subjects, under `photoKey#name`), where carouselPhotos reads it. Never fails a carousel: an object
 * not found is simply not drawn.
 */
export async function ensurePhotoObjects(studioId: string, postId: string, items: { mediaId: string; name: string }[]): Promise<void> {
  if (!gpuReady() || !items.length) return;
  const { data } = await supabaseAdmin().from("media_assets").select("id, kind, storage_path, subjects, tracks").eq("studio_id", studioId).in("id", [...new Set(items.map((i) => i.mediaId))]);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  const passages: ObjectPassage[] = [];
  for (const { mediaId, name } of items) {
    const key = objectKey(mediaId, 0, 0, name);
    if (rows.get(mediaId)?.kind !== "image" || passages.some((p) => p.key === key) || passages.length >= PHOTO_OBJECT_MAX) continue;
    const k = kept(rows.get(mediaId))[key];
    if (k && !("failed_at" in k && Date.now() - Date.parse(k.failed_at) > RETRY_MS)) continue;
    passages.push({ clip_id: mediaId, from: 0, to: 0, key, name, photo: true });
  }
  await followObjects(studioId, postId, passages, rows);
}

/** Where a passage's clear areas are kept (beside its cut-outs, removed with the clip by the retention). */
export const clearPath = (studioId: string, mediaId: string, key: string) => `${studioId}/subjects/${mediaId}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}.clear.json`;

/** A passage's clear areas: its clip or photo fetched (a second or two), then about 0.3 s of the machine's CPU a second of video. */
const CLEAR_LOAD_MS = 20_000;
const CLEAR_WORK_PER_SECOND = 1;

/**
 * The objects of these passages followed (or found on her photos) on the card, and the clear areas of `clears` read in
 * the same machine (without a card when there is no object), kept on their media, the machine's time billed.
 */
async function followObjects(studioId: string, postId: string, asked: ObjectPassage[], rows: Map<string, Row>, clears: ClearPassage[] = []): Promise<void> {
  // The card's cost held to its budget (OBJECT_MAX_EUR, at its price a second): the objects its code names first are followed first.
  const missing = objectsWithinBudget(asked, gpuCostEur(1));
  if (missing.length < asked.length) console.warn("objects left out, over the card's budget", postId, asked.filter((p) => !missing.includes(p)).map((p) => p.key));
  if (!missing.length && !clears.length) return;
  const db = supabaseAdmin();
  const left = timeLeft();
  const budget = (Number.isFinite(left) ? left : 800_000) - RENDER_MARGIN_MS;
  const work =
    missing.reduce((n, p) => n + (p.photo ? PHOTO_OBJECT_MS : (p.to - p.from) * OBJECT_WORK_PER_SECOND * 1000), 0) +
    clears.reduce((n, p) => n + Math.max(1, p.to - p.from) * CLEAR_WORK_PER_SECOND * 1000, 0);
  const deadline = Math.min(budget, GPU_START_MS + (missing.length ? OBJECT_LOAD_MS : CLEAR_LOAD_MS) + 2 * work);
  if (deadline < GPU_START_MS) return;
  const clips = [...new Set([...missing, ...clears].map((p) => p.clip_id))];
  const clipPaths = clips.map((id) => rows.get(id)?.storage_path ?? "");
  const signed = (await db.storage.from("media").createSignedUrls(clipPaths.filter(Boolean), 3600)).data ?? [];
  const clipUrl = (id: string) => signed.find((x) => x.path === clipPaths[clips.indexOf(id)])?.signedUrl;
  const clearJobs = clears.flatMap((p) => {
    const url = clipUrl(p.clip_id);
    return url ? [{ key: p.key, url, from: p.from, to: p.to, ...(p.photo ? { photo: true as const } : {}) }] : [];
  });
  const jobs = (
    await Promise.all(
      missing.map(async (p) => {
        const url = clipUrl(p.clip_id);
        const [webm, png] = await Promise.all(
          [false, true].map((still) => db.storage.from("media").createSignedUploadUrl(subjectPath(studioId, p.clip_id, p.key, still), { upsert: true })),
        );
        return url && webm?.data?.signedUrl && png?.data?.signedUrl
          ? [{ key: p.key, url, from: p.from, to: p.to, name: p.name, ...(p.photo ? { photo: true as const } : {}), upload: { webm: webm.data.signedUrl, png: png.data.signedUrl } }]
          : [];
      }),
    )
  ).flat();
  if (!jobs.length && !clearJobs.length) return;
  const { results, clears: read, seconds, gpu } = await objectsOnGpu(jobs, deadline, {}, clearJobs);
  const at = new Date().toISOString();
  const updates = new Map<string, MediaSubjects>();
  const record = (p: SubjectPassage, value: MediaSubjects[string]) => {
    const next = updates.get(p.clip_id) ?? {};
    next[p.key] = value;
    updates.set(p.clip_id, next);
  };
  // Each passage's clear areas in their file beside its cut-outs (a few kilobytes: its grid and the camera's move).
  let cleared = 0;
  for (const p of clears) {
    const result = read[p.key];
    if (!result) continue;
    if (result instanceof Error) {
      console.warn("clear areas not read", p.key, result.message);
      record(p, { failed_at: at, error: result.message.slice(0, 200) });
      continue;
    }
    const path = clearPath(studioId, p.clip_id, p.key);
    const saved = await db.storage.from("media").upload(path, JSON.stringify(result.clear), { contentType: "application/json", upsert: true });
    if (saved.error) {
      console.warn("clear areas not kept", p.key, saved.error.message);
      continue;
    }
    cleared++;
    record(p, { path, still: result.still, at, frames: result.frames, clear: true });
  }
  let done = 0;
  for (const p of missing) {
    const result = results[p.key];
    if (!result) continue;
    if (result instanceof Error) {
      console.warn("object not followed", p.key, result.message);
      record(p, { failed_at: at, error: result.message.slice(0, 200) });
      continue;
    }
    done++;
    const contour = await keepContour(studioId, p.clip_id, p.key, result.contours);
    record(p, {
      path: subjectPath(studioId, p.clip_id, p.key, result.still),
      still: result.still,
      at,
      frames: result.frames,
      keys: result.keys,
      people: false,
      object: p.name,
      ...(result.top !== undefined ? { top: result.top } : {}),
      ...(result.boxes?.length ? { boxes: result.boxes } : {}),
      ...(result.parts?.length ? { parts: result.parts } : {}),
      ...(contour ? { contour } : {}),
    });
  }
  await mergeSubjects(studioId, updates);
  // The machine's time, billed whether or not it read them (none when no machine came); clear areas alone are their own kind.
  if (seconds > 0)
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: jobs.length ? "matting" : "clear_area",
      provider: "modal",
      units: Math.round(seconds),
      cost_eur: gpuCostEur(seconds, gpu),
      meta: costMeta({
        post_id: postId,
        objects: jobs.length,
        done,
        clears: clearJobs.length,
        cleared,
        gpu: gpu ?? "none",
        photos: missing.filter((p) => p.photo).length,
        seconds_of_video: Math.round([...missing, ...clears].reduce((n, p) => n + p.to - p.from, 0) * 10) / 10,
      }),
    });
}

/**
 * The objects found on her photos (ensurePhotoObjects, or a Reel's), signed for the render and the live preview: by
 * photo, then by name, each one's cut-out (a still image framed like the photo), its box and its outline (shares).
 */
export async function photoObjectInputs(studioId: string, mediaIds: string[]): Promise<Record<string, Record<string, { cutout: string; box: { x: number; y: number; w: number; h: number }; contour?: number[] }>>> {
  if (!mediaIds.length) return {};
  const db = supabaseAdmin();
  const { data } = await db.from("media_assets").select("id, kind, storage_path, subjects, tracks").eq("studio_id", studioId).in("id", [...new Set(mediaIds)]);
  const found = ((data ?? []) as Row[]).flatMap((row) =>
    Object.entries(kept(row)).flatMap(([key, k]) => {
      const prefix = `${photoKey(row.id)}#`;
      if (!key.startsWith(prefix) || !("path" in k) || !k.path.startsWith(`${studioId}/`) || !k.boxes?.[0]) return [];
      return [{ media: row.id, name: key.slice(prefix.length), path: k.path, box: k.boxes[0]!, contour: k.contour?.startsWith(`${studioId}/`) ? k.contour : undefined }];
    }),
  );
  if (!found.length) return {};
  const [signed, contours] = await Promise.all([
    db.storage.from("media").createSignedUrls(found.map((f) => f.path), 7200).then((r) => r.data ?? []),
    Promise.all(found.map((f) => (f.contour ? readContour(f.contour).catch(() => undefined) : undefined))),
  ]);
  const out: Record<string, Record<string, { cutout: string; box: { x: number; y: number; w: number; h: number }; contour?: number[] }>> = {};
  found.forEach((f, i) => {
    const src = signed[i]?.signedUrl;
    if (!src) return;
    const [x, y, w, h] = f.box as [number, number, number, number];
    const contour = contours[i]?.[0] ?? undefined;
    (out[f.media] ??= {})[f.name] = { cutout: src, box: { x, y, w, h }, ...(contour?.length ? { contour } : {}) };
  });
  return out;
}

// ——— Her video's depth at every image (Depth): read on the card ———————————————————————————————————————————————

/** Where a passage's depth is kept (beside its cut-outs, removed with the clip by the retention). */
export const depthPath = (studioId: string, mediaId: string, key: string) => `${studioId}/subjects/${mediaId}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}.mp4`;

/** On the card: the depth model loaded (2 s) and the clip fetched, then a second of video (its 30 images read, about 1 s on an A10G). */
const DEPTH_LOAD_MS = 30_000;
const DEPTH_WORK_PER_SECOND = 3;
/** Its nearness, besides: each image read at the cut-out's size, its edge snapped to the picture, encoded with its transparency (the card's 2 CPUs). */
const NEAR_WORK_PER_SECOND = 8;

/** Where a passage's nearness is kept (her shot with its depth as its transparency, beside its cut-outs). */
export const nearPath = (studioId: string, mediaId: string, key: string) => `${studioId}/subjects/${mediaId}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}.near.webm`;

/**
 * Reads in depth, at every image, the shots a Reel's compositions show with Depth (the grey pass of a computer-vision
 * Reel, a fog or a light by distance) or rebuild by their depth with Near (her shot with its depth as its transparency:
 * a WebM at the cut-out's size), on the rented card only (on the sandbox's CPUs it takes about 2 s an image): kept
 * beside the clip (media_assets.subjects, under `subjectKey~depth` and `subjectKey~near`). Never fails a render: a shot
 * without its depth simply draws nothing there.
 */
export async function ensureDepths(studioId: string, postId: string, plan: Plan): Promise<void> {
  if (!gpuReady() || !(wantsDepth(plan) || wantsNear(plan)) || plan.finish?.steady === "off") return;
  const db = supabaseAdmin();
  const ids = [...new Set(plan.segments.flatMap((s) => (isClipSegment(s) ? [s.clip_id] : [])))];
  const { data } = await db.from("media_assets").select("id, kind, storage_path, subjects, tracks").eq("studio_id", studioId).in("id", ids);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  const isVideo = (id: string) => rows.get(id)?.kind === "video";
  const due = (p: SubjectPassage) => {
    const k = kept(rows.get(p.clip_id))[p.key];
    return !k || ("failed_at" in k && Date.now() - Date.parse(k.failed_at) > RETRY_MS);
  };
  const missing = [...depthPassages(plan, isVideo).map((p) => ({ ...p, near: false })), ...nearPassages(plan, isVideo).map((p) => ({ ...p, near: true }))].filter(due);
  if (!missing.length) return;
  const left = timeLeft();
  const budget = (Number.isFinite(left) ? left : 800_000) - RENDER_MARGIN_MS;
  const work = missing.reduce((n, p) => n + (p.to - p.from) * (p.near ? NEAR_WORK_PER_SECOND : DEPTH_WORK_PER_SECOND) * 1000, 0);
  const deadline = Math.min(budget, GPU_START_MS + DEPTH_LOAD_MS + 2 * work);
  if (deadline < GPU_START_MS) return;
  const clips = [...new Set(missing.map((p) => p.clip_id))];
  const clipPaths = clips.map((id) => rows.get(id)?.storage_path ?? "");
  const signed = (await db.storage.from("media").createSignedUrls(clipPaths.filter(Boolean), 3600)).data ?? [];
  const pathOf = (p: (typeof missing)[number]) => (p.near ? nearPath(studioId, p.clip_id, p.key) : depthPath(studioId, p.clip_id, p.key));
  const jobs = (
    await Promise.all(
      missing.map(async (p) => {
        const url = signed.find((x) => x.path === clipPaths[clips.indexOf(p.clip_id)])?.signedUrl;
        const upload = await db.storage.from("media").createSignedUploadUrl(pathOf(p), { upsert: true });
        return url && upload.data?.signedUrl ? [{ key: p.key, url, from: p.from, to: p.to, upload: p.near ? { webm: upload.data.signedUrl } : { mp4: upload.data.signedUrl } }] : [];
      }),
    )
  ).flat();
  if (!jobs.length) return;
  const { results, seconds, gpu } = await depthVideosOnGpu(jobs, deadline);
  const at = new Date().toISOString();
  const updates = new Map<string, MediaSubjects>();
  let done = 0;
  for (const p of missing) {
    const result = results[p.key];
    if (!result) continue;
    const next = updates.get(p.clip_id) ?? {};
    if (result instanceof Error) {
      console.warn(p.near ? "nearness not read" : "depth not read", p.key, result.message);
      next[p.key] = { failed_at: at, error: result.message.slice(0, 200) };
    } else {
      done++;
      next[p.key] = { path: pathOf(p), still: false, at, frames: result.frames, ...(p.near ? { near: true } : { depth: true }) };
    }
    updates.set(p.clip_id, next);
  }
  await mergeSubjects(studioId, updates);
  // The card's time, billed whether or not it read them (none when no card was allotted).
  if (seconds > 0)
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "depth_video",
      provider: "modal",
      units: Math.round(seconds),
      cost_eur: gpuCostEur(seconds, gpu),
      meta: costMeta({ post_id: postId, passages: jobs.length, near: missing.filter((p) => p.near).length, done, gpu, seconds_of_video: Math.round(missing.reduce((n, p) => n + p.to - p.from, 0) * 10) / 10 }),
    });
}
