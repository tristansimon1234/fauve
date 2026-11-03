import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { isClipSegment, mediaSubjectsSchema, mediaTracksSchema, subjectPassages, type EditPlan, type MediaSubjects, type SubjectPassage } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costMeta } from "@/lib/cost-scope";
import { timeLeft } from "@/lib/step-clock";
import { cutoutCostEur, subjectsInSandbox } from "./sandbox";

// Her subject cut out at every image of the passages a composition draws it on (Subject), made in the cut-out
// sandbox just before the render (apps/render/matte.py) and kept beside the clip in Storage
// ({studio}/subjects/{media}-{passage}.webm, or .png when nothing moves; listed in media_assets.subjects and
// removed with the clip by the retention): the next version of the Reel finds them made. Never fails a render:
// a passage without its cut-out simply has the composition's text in front of her.

type Plan = Pick<EditPlan, "segments" | "layers"> & { subtitles?: boolean; captions?: EditPlan["captions"]; finish?: EditPlan["finish"] };

/** Seconds of the sandbox's work a second of moving video takes, at most (a fast walk: about a minute on its 8 CPUs). */
const WORK_PER_SECOND = 60;
/** What the step keeps for the render after the cut-outs (a Reel renders at 4 to 7 s a second of video). */
const RENDER_MARGIN_MS = 330_000;
/** A passage whose cut-out failed is tried again after this long. */
const RETRY_MS = 6 * 3600_000;

/** Where a passage's cut-out is kept. */
export const subjectPath = (studioId: string, mediaId: string, key: string, still: boolean) =>
  `${studioId}/subjects/${mediaId}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}.${still ? "png" : "webm"}`;

/** The passages to cut out for this plan, with their clips' rows (her own steadied video plays: an unsteadied original is left out). */
async function planned(studioId: string, plan: Plan) {
  const ids = [...new Set(plan.segments.flatMap((s) => (isClipSegment(s) ? [s.clip_id] : [])))];
  if (!ids.length || plan.finish?.steady === "off") return { passages: [] as SubjectPassage[], rows: new Map<string, Row>() };
  const { data } = await supabaseAdmin().from("media_assets").select("id, kind, storage_path, subjects, tracks").eq("studio_id", studioId).in("id", ids);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  return { passages: subjectPassages(plan, (id) => rows.get(id)?.kind === "video"), rows };
}

type Row = { id: string; kind: string; storage_path: string | null; subjects: unknown; tracks: unknown };

const kept = (row: Row | undefined): MediaSubjects => mediaSubjectsSchema.safeParse(row?.subjects ?? {}).data ?? {};

/**
 * Cuts out the passages this plan's compositions draw her on and that have no cut-out yet, as many as the step has
 * time for before its render (the rest render without: the text in front of her, and are made for the next version).
 */
export async function ensureSubjects(studioId: string, postId: string, plan: Plan): Promise<void> {
  const { passages, rows } = await planned(studioId, plan);
  const missing = passages.filter((p) => {
    const k = kept(rows.get(p.clip_id))[p.key];
    return !k || ("failed_at" in k && Date.now() - Date.parse(k.failed_at) > RETRY_MS);
  });
  if (!missing.length) return;
  // Outside a step (no deadline known), as if a step of Vercel's 800 s had just begun.
  const left = timeLeft();
  let budget = (Number.isFinite(left) ? left : 800_000) - RENDER_MARGIN_MS;
  const chosen = missing.filter((p) => {
    const need = (p.to - p.from) * WORK_PER_SECOND * 1000;
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
    const updates = new Map<string, MediaSubjects>();
    for (const p of chosen) {
      const result = results[p.key];
      if (!result) continue;
      const next = updates.get(p.clip_id) ?? { ...kept(rows.get(p.clip_id)) };
      if (result instanceof Error) {
        console.warn("subject cut-out failed", p.key, result.message);
        next[p.key] = { failed_at: at, error: result.message.slice(0, 200) };
      } else {
        const path = subjectPath(studioId, p.clip_id, p.key, result.still);
        const uploaded = await db.storage.from("media").upload(path, result.file, { contentType: result.still ? "image/png" : "video/webm", upsert: true });
        if (uploaded.error) {
          console.warn("subject cut-out not kept", p.key, uploaded.error.message);
          continue;
        }
        next[p.key] = { path, still: result.still, at, frames: result.frames, keys: result.keys, people: result.people, ...(result.top !== undefined ? { top: result.top } : {}) };
      }
      updates.set(p.clip_id, next);
    }
    await Promise.all([...updates].map(([id, subjects]) => db.from("media_assets").update({ subjects }).eq("id", id).eq("studio_id", studioId)));
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
export async function subjectInputs(studioId: string, plan: Plan): Promise<Record<string, { src: string; still?: boolean; top?: number }>> {
  const { passages, rows } = await planned(studioId, plan);
  const found = passages.flatMap((p) => {
    const k = kept(rows.get(p.clip_id))[p.key];
    return k && "path" in k && k.path.startsWith(`${studioId}/`) ? [{ key: p.key, path: k.path, still: k.still, top: k.top }] : [];
  });
  if (!found.length) return {};
  const signed = (await supabaseAdmin().storage.from("media").createSignedUrls(found.map((f) => f.path), 7200)).data ?? [];
  return Object.fromEntries(
    found.flatMap((f, i) => (signed[i]?.signedUrl ? [[f.key, { src: signed[i]!.signedUrl, ...(f.still ? { still: true } : {}), ...(f.top !== undefined ? { top: f.top } : {}) }]] : [])),
  );
}
