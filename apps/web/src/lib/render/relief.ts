import "server-only";
import { createHash } from "node:crypto";
import { mediaReliefsSchema, reliefJobs, type EditPlan, type MediaReliefs, type ReelInputs, type ReliefJob } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costMeta } from "@/lib/cost-scope";
import { timeLeft } from "@/lib/step-clock";
import { GPU, GPU_START_MS, gpuCostEur, gpuReady, reliefsOnGpu } from "./gpu";

// A moving photo in relief, its depth read on the rented card (apps/render/relief.py): before the render, each photo
// shot that moves gets the video of every pixel moved by its own depth, made for the shot as the plan has it and kept
// on the photo by that shot's key (media_assets.reliefs, the video in {studio}/reliefs/): a text changed or a new
// version with the same shots finds it made, a shot made longer makes another. Never fails a render: a shot without
// its video plays the relief of its subject (a clean cut-out) or the photo with its move.

type Plan = Pick<EditPlan, "segments"> & { template?: EditPlan["template"]; finish?: EditPlan["finish"] };

/** On the card: its depth model loaded (2 s), then a shot (the photo fetched, its depth read, its images drawn and written, sent). */
const RELIEF_LOAD_MS = 30_000;
const RELIEF_SHOT_MS = 20_000;
/** What the step keeps for the render after the reliefs (a Reel renders at 4 to 7 s a second of video). */
const RENDER_MARGIN_MS = 330_000;
/** A shot whose relief failed is tried again after this long. */
const RETRY_MS = 6 * 3600_000;
/** The reliefs kept on a photo (its newest shots): an older one is removed with its video. */
const KEEP = 3;

/** Where a shot's video is kept. */
export const reliefPath = (studioId: string, mediaId: string, key: string) =>
  `${studioId}/reliefs/${mediaId}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}.mp4`;

type Row = { id: string; kind: string; storage_path: string | null; reliefs: unknown };
const kept = (row: Row | undefined): MediaReliefs => mediaReliefsSchema.safeParse(row?.reliefs ?? {}).data ?? {};

async function rowsOf(studioId: string, jobs: ReliefJob[]): Promise<Map<string, Row>> {
  const ids = [...new Set(jobs.map((j) => j.media_id))];
  if (!ids.length) return new Map();
  const { data } = await supabaseAdmin().from("media_assets").select("id, kind, storage_path, reliefs").eq("studio_id", studioId).eq("kind", "image").in("id", ids);
  return new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
}

/**
 * Draws in relief, on the card, the photo shots of a plan that have no video yet (reliefJobs), as many as the step has
 * time for before its render; each kept on its photo with its newest siblings. Only with the card: on the sandbox's
 * CPUs a shot would take minutes.
 */
export async function ensureReliefs(studioId: string, postId: string, plan: Plan): Promise<void> {
  if (!gpuReady()) return;
  const all = reliefJobs(plan);
  if (!all.length) return;
  const db = supabaseAdmin();
  const rows = await rowsOf(studioId, all);
  const missing = all.filter((j) => {
    const row = rows.get(j.media_id);
    if (!row?.storage_path?.startsWith(`${studioId}/`)) return false;
    const k = kept(row)[j.key];
    return !k || ("failed_at" in k && Date.now() - Date.parse(k.failed_at) > RETRY_MS);
  });
  if (!missing.length) return;
  const left = timeLeft();
  const budget = (Number.isFinite(left) ? left : 800_000) - RENDER_MARGIN_MS;
  const deadline = Math.min(budget, GPU_START_MS + RELIEF_LOAD_MS + 2 * missing.length * RELIEF_SHOT_MS);
  if (deadline < GPU_START_MS) return;
  const photos = [...new Set(missing.map((j) => j.media_id))];
  const paths = photos.map((id) => rows.get(id)?.storage_path ?? "");
  const signed = (await db.storage.from("media").createSignedUrls(paths.filter(Boolean), 3600)).data ?? [];
  const shots = (
    await Promise.all(
      missing.map(async (j) => {
        const url = signed.find((x) => x.path === rows.get(j.media_id)?.storage_path)?.signedUrl;
        const upload = await db.storage.from("media").createSignedUploadUrl(reliefPath(studioId, j.media_id, j.key), { upsert: true });
        return url && upload.data?.signedUrl
          ? [{ job: j, shot: { key: `${j.media_id}#${j.key}`, url, move: j.move, frames: j.frames, origin: j.origin, shift: j.shift, upload: { mp4: upload.data.signedUrl } } }]
          : [];
      }),
    )
  ).flat();
  if (!shots.length) return;
  const { results, seconds } = await reliefsOnGpu(
    shots.map((s) => s.shot),
    deadline,
  );
  const at = new Date().toISOString();
  const updates = new Map<string, MediaReliefs>();
  let done = 0;
  for (const { job, shot } of shots) {
    const result = results[shot.key];
    if (!result) continue;
    const next = updates.get(job.media_id) ?? { ...kept(rows.get(job.media_id)) };
    if (result instanceof Error) {
      console.warn("relief not drawn", shot.key, result.message);
      next[job.key] = { failed_at: at, error: result.message.slice(0, 200) };
    } else if (result.frames !== job.frames) {
      next[job.key] = { failed_at: at, error: `${result.frames} images for a shot of ${job.frames}` };
    } else {
      done++;
      next[job.key] = { path: reliefPath(studioId, job.media_id, job.key), frames: result.frames, w: result.w, h: result.h, ...(result.near !== undefined ? { near: result.near } : {}), at };
    }
    updates.set(job.media_id, next);
  }
  await Promise.all(
    [...updates].map(async ([id, reliefs]) => {
      // Its newest shots kept; an older one goes with its video.
      const made = Object.entries(reliefs).filter(([, r]) => "path" in r) as [string, { path: string; at: string }][];
      const old = made.sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at)).slice(KEEP);
      for (const [key] of old) delete reliefs[key];
      if (old.length) await db.storage.from("media").remove(old.map(([, r]) => r.path));
      await db.from("media_assets").update({ reliefs }).eq("id", id).eq("studio_id", studioId);
    }),
  );
  // The card's time, billed whether or not it drew them (none when no card was allotted).
  if (seconds > 0)
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "relief",
      provider: "modal",
      units: Math.round(seconds),
      cost_eur: gpuCostEur(seconds),
      meta: costMeta({ post_id: postId, shots: shots.length, done, gpu: GPU }),
    });
}

/** The reliefs a plan's photo shots play, signed for the render and the live preview (`{media}#{key}` → video and length). */
export async function reliefInputs(studioId: string, plan: Plan): Promise<NonNullable<ReelInputs["reliefs"]>> {
  const jobs = reliefJobs(plan);
  if (!jobs.length) return {};
  const rows = await rowsOf(studioId, jobs);
  const found = jobs.flatMap((j) => {
    const k = kept(rows.get(j.media_id))[j.key];
    return k && "path" in k && k.path.startsWith(`${studioId}/`) && k.frames === j.frames ? [{ id: `${j.media_id}#${j.key}`, path: k.path, frames: k.frames }] : [];
  });
  if (!found.length) return {};
  const signed = (await supabaseAdmin().storage.from("media").createSignedUrls(found.map((f) => f.path), 7200)).data ?? [];
  return Object.fromEntries(
    found.flatMap((f) => {
      const src = signed.find((s) => s.path === f.path)?.signedUrl;
      return src ? [[f.id, { src, frames: f.frames }]] : [];
    }),
  );
}
