import "server-only";
import { createHash } from "node:crypto";
import { isClipSegment, mediaSmoothSchema, type EditPlan, type MediaSmooth, type ReelProps } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costMeta } from "@/lib/cost-scope";
import { timeLeft } from "@/lib/step-clock";
import { GPU_START_MS, gpuCostEur, gpuReady, smoothOnGpu } from "./gpu";
import { slowPassages, type SmoothFiles } from "./sandbox";
import { retryDue } from "./retry";

// Slow motion made smooth on the rented card (apps/render/rife.py): the passage a slowed shot plays, at 60 images a
// second, its images in between drawn by RIFE (a video filmed fast keeps its own), made just before the render and
// kept beside the clip (media_assets.smooth, {studio}/smooth/…): the next version of the Reel finds it made. The render
// sandbox made them with ffmpeg's motion interpolation, 29 s of one core a second of clip, so 3 s of a Reel at most;
// the card takes about a second a second. Never fails a render: a passage the card did not make is made as before.

/** Bumped when rife.py makes them differently: the files made before are made again. */
export const SMOOTH_VERSION = 1;
/** On the card: RIFE loaded and a clip fetched, then a second of clip (its images read, drawn in between and written). */
const SMOOTH_LOAD_MS = 30_000;
const SMOOTH_WORK_PER_SECOND = 4_000;
/** What the step keeps for the render after them (a Reel renders at 4 to 7 s a second of video). */
const RENDER_MARGIN_MS = 330_000;
/** The files kept beside a clip (its newest passages): an older one is removed. */
const KEEP = 4;

/** Where a slow passage's file is kept. */
const smoothPath = (studioId: string, mediaId: string, key: string) =>
  `${studioId}/smooth/${mediaId}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}.mp4`;

/** The path in Storage a signed link points to (…/object/sign/media/<path>?token=…), or nothing. */
function storagePath(url: string): string | null {
  try {
    const marker = "/object/sign/media/";
    const { pathname } = new URL(url);
    const at = pathname.indexOf(marker);
    return at >= 0 ? decodeURIComponent(pathname.slice(at + marker.length)) : null;
  } catch {
    return null;
  }
}

type Row = { id: string; smooth: unknown };
const kept = (row: Row | undefined): MediaSmooth => mediaSmoothSchema.safeParse(row?.smooth ?? {}).data ?? {};

/**
 * The slow passages of a Reel made on the card, as many as the step has time for before its render, and those made
 * before: by shot, the file (signed) and the frame it starts at, for the render sandbox (renderReelInSandbox's slowmo).
 */
export async function smoothSlowMotion(studioId: string, postId: string, plan: Pick<EditPlan, "segments">, props: ReelProps): Promise<SmoothFiles> {
  if (!gpuReady()) return {};
  // Each shot's clip (the plan's segment at the same place) and the very file it plays (her steadied or original video).
  const passages = slowPassages(props).flatMap((p) => {
    const segment = plan.segments[p.index];
    const path = storagePath(p.src);
    if (!segment || !isClipSegment(segment) || !path?.startsWith(`${studioId}/`)) return [];
    const key = `${createHash("sha1").update(path).digest("hex").slice(0, 10)}-${p.srcFrom}-${p.seconds.toFixed(2)}-v${SMOOTH_VERSION}`;
    return [{ ...p, media: segment.clip_id, key }];
  });
  if (!passages.length) return {};
  const db = supabaseAdmin();
  const { data } = await db.from("media_assets").select("id, smooth").eq("studio_id", studioId).in("id", [...new Set(passages.map((p) => p.media))]);
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  const missing = passages.filter((p) => {
    const k = kept(rows.get(p.media))[p.key];
    return !k || ("failed_at" in k && retryDue(k));
  });
  const updates = new Map<string, MediaSmooth>();
  if (missing.length) {
    const left = timeLeft();
    const budget = (Number.isFinite(left) ? left : 800_000) - RENDER_MARGIN_MS;
    const work = missing.reduce((n, p) => n + p.seconds * SMOOTH_WORK_PER_SECOND, 0);
    const deadline = Math.min(budget, GPU_START_MS + SMOOTH_LOAD_MS + 2 * work);
    if (deadline >= GPU_START_MS) {
      const jobs = (
        await Promise.all(
          missing.map(async (p) => {
            const upload = await db.storage.from("media").createSignedUploadUrl(smoothPath(studioId, p.media, p.key), { upsert: true });
            return upload.data?.signedUrl ? [{ p, job: { key: `${p.index}`, url: p.src, from: p.srcFrom / 30, seconds: p.seconds, upload: { mp4: upload.data.signedUrl } } }] : [];
          }),
        )
      ).flat();
      const { results, seconds, gpu } = await smoothOnGpu(
        jobs.map((j) => j.job),
        deadline,
      );
      const at = new Date().toISOString();
      let done = 0;
      for (const { p, job } of jobs) {
        const result = results[job.key];
        if (!result) continue;
        const next = updates.get(p.media) ?? { ...kept(rows.get(p.media)) };
        if (result instanceof Error) {
          console.warn("slow motion not made on the card", p.media, result.message);
          next[p.key] = { failed_at: at, error: result.message.slice(0, 200) };
        } else {
          done++;
          next[p.key] = { path: smoothPath(studioId, p.media, p.key), frames: result.frames, made: result.made, at };
        }
        updates.set(p.media, next);
      }
      await Promise.all(
        [...updates].map(async ([id, smooth]) => {
          const made = Object.entries(smooth).filter(([, r]) => "path" in r) as [string, { path: string; at: string }][];
          const old = made.sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at)).slice(KEEP);
          for (const [key] of old) delete smooth[key];
          if (old.length) await db.storage.from("media").remove(old.map(([, r]) => r.path));
          await db.from("media_assets").update({ smooth }).eq("id", id).eq("studio_id", studioId);
        }),
      );
      // The card's time, billed whether or not it made them (none when no card was allotted).
      if (seconds > 0)
        await db.from("cost_events").insert({
          studio_id: studioId,
          kind: "slowmo",
          provider: "modal",
          units: Math.round(seconds),
          cost_eur: gpuCostEur(seconds, gpu),
          meta: costMeta({ post_id: postId, passages: jobs.length, done, gpu, seconds_of_clip: Math.round(missing.reduce((n, p) => n + p.seconds, 0) * 10) / 10 }),
        });
    }
  }
  // Every passage made, now or before: signed for the render.
  const ready = passages.flatMap((p) => {
    const k = (updates.get(p.media) ?? kept(rows.get(p.media)))[p.key];
    return k && "path" in k ? [{ index: p.index, srcFrom: p.srcFrom, path: k.path }] : [];
  });
  if (!ready.length) return {};
  const signed = (await db.storage.from("media").createSignedUrls(ready.map((r) => r.path), 3600)).data ?? [];
  return Object.fromEntries(
    ready.flatMap((r) => {
      const src = signed.find((s) => s.path === r.path)?.signedUrl;
      return src ? [[r.index, { src, srcFrom: r.srcFrom }]] : [];
    }),
  );
}
