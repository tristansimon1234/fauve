import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { isClipSegment, mediaSubjectsSchema, mediaTracksSchema, subjectPassages, type EditPlan, type MediaSubjects, type SubjectPassage } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costMeta } from "@/lib/cost-scope";
import { timeLeft } from "@/lib/step-clock";
import { GPU_START_MS, gpuCostEur, gpuReady, subjectsOnGpu } from "./gpu";
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

/** The passages to cut out for this plan, with their clips' rows (her own steadied video plays: an unsteadied original is left out). */
async function planned(studioId: string, plan: Plan, anticipate = false) {
  const ids = [...new Set(plan.segments.flatMap((s) => (isClipSegment(s) ? [s.clip_id] : [])))];
  if (!ids.length || plan.finish?.steady === "off") return { passages: [] as SubjectPassage[], rows: new Map<string, Row>() };
  const { data } = await supabaseAdmin().from("media_assets").select("id, kind, storage_path, subjects, tracks").eq("studio_id", studioId).in("id", ids);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  return { passages: subjectPassages(plan, (id) => rows.get(id)?.kind === "video", anticipate), rows };
}

type Row = { id: string; kind: string; storage_path: string | null; subjects: unknown; tracks: unknown };

const kept = (row: Row | undefined): MediaSubjects => mediaSubjectsSchema.safeParse(row?.subjects ?? {}).data ?? {};

/**
 * On the card: its clip fetched and its model loaded, then a second of video (its 30 images read and their edge
 * made). The card gets its start, this, and as much again, never the whole step: when it fails, the cut-out sandbox
 * still has time for the passages.
 */
const GPU_LOAD_MS = 60_000;
const GPU_WORK_PER_SECOND = 12;

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
    const next = updates.get(p.clip_id) ?? { ...kept(rows.get(p.clip_id)) };
    next[p.key] = value;
    updates.set(p.clip_id, next);
  };
  const db = supabaseAdmin();
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
  await Promise.all([...updates].map(([id, subjects]) => db.from("media_assets").update({ subjects }).eq("id", id).eq("studio_id", studioId)));
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
  const { results, seconds } = await subjectsOnGpu(jobs, deadlineMs);
  const at = new Date().toISOString();
  const done = new Set<string>();
  for (const p of chosen) {
    const result = results[p.key];
    if (!result || result instanceof Error) {
      if (result) console.warn("subject cut-out on the card failed", p.key, result.message);
      continue;
    }
    done.add(p.key);
    record(p, {
      path: subjectPath(studioId, p.clip_id, p.key, result.still),
      still: result.still,
      at,
      frames: result.frames,
      keys: result.keys,
      people: result.people,
      ...(result.top !== undefined ? { top: result.top } : {}),
      ...(result.boxes?.length ? { boxes: result.boxes } : {}),
    });
  }
  // The card's time, billed whether or not it cut out (none when no card was allotted).
  if (seconds > 0)
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "matting",
      provider: "modal",
      units: Math.round(seconds),
      cost_eur: gpuCostEur(seconds),
      meta: costMeta({ post_id: postId, passages: jobs.length, done: done.size, gpu: "L4", seconds_of_video: Math.round(chosen.reduce((n, p) => n + p.to - p.from, 0) * 10) / 10 }),
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
      record(p, {
        path,
        still: result.still,
        at,
        frames: result.frames,
        keys: result.keys,
        people: result.people,
        ...(result.top !== undefined ? { top: result.top } : {}),
        ...(result.boxes?.length ? { boxes: result.boxes } : {}),
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

/** The cut-outs this plan can draw, signed for the render and the live preview (by passage, subjectKey). */
export async function subjectInputs(studioId: string, plan: Plan): Promise<Record<string, { src: string; still?: boolean; top?: number; boxes?: (number[] | null)[] }>> {
  const { passages, rows } = await planned(studioId, plan);
  const found = passages.flatMap((p) => {
    const k = kept(rows.get(p.clip_id))[p.key];
    return k && "path" in k && k.path.startsWith(`${studioId}/`) ? [{ key: p.key, path: k.path, still: k.still, top: k.top, boxes: k.boxes }] : [];
  });
  if (!found.length) return {};
  const signed = (await supabaseAdmin().storage.from("media").createSignedUrls(found.map((f) => f.path), 7200)).data ?? [];
  return Object.fromEntries(
    found.flatMap((f, i) =>
      signed[i]?.signedUrl ? [[f.key, { src: signed[i]!.signedUrl, ...(f.still ? { still: true } : {}), ...(f.top !== undefined ? { top: f.top } : {}), ...(f.boxes?.length ? { boxes: f.boxes } : {}) }]] : [],
    ),
  );
}
