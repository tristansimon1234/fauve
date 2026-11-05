import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { CARD_CUTOUT_MODEL, CUTOUT_MODEL, contourOfAlpha, currentCutout, cutEdges, cutoutSchema, sceneWorthy, stickerWorthy, type Cutout, type ReelInputs, type ScenePhoto } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cutoutCostEur, cutoutsInSandbox } from "./sandbox";
import { GPU_START_MS, gpuCostEur, gpuReady, photosOnGpu } from "./gpu";
import { costMeta } from "@/lib/cost-scope";
import { timeLeft } from "@/lib/step-clock";

// Cut-outs: the subject of a photo cut out once (an open model, never redrawn): on the rented card with the full
// model when it is set up (lib/render/gpu.ts, about a second a photo), else in the cut-out sandbox with the lite one
// (10 to 30 s a photo), kept on the photo (media_assets.cutout) with its image in Storage.
// In a collage, a clean one is laid on the Reel as a sticker, the others stay prints;
// in any Reel, an animation can compose with her photos and their cut-outs.

/** The most photos cut out in one go (each takes 10 to 30 s in the sandbox). */
const MAX_PHOTOS = 10;
/** On the card: its model loaded (5 s) and then a photo (fetched, read, its edge and its WebP made, sent), with room. */
const CARD_LOAD_MS = 30_000;
const CARD_PHOTO_MS = 6_000;

/** Where a photo's cut-out is kept (the retention removes it with its photo). */
export const cutoutPath = (studioId: string, mediaId: string, ext: "webp" | "png") => `${studioId}/cutouts/${mediaId}.${ext}`;

/**
 * Cuts out the subject of the photos that have none yet (or one from an older model): on the card first, the
 * photos it could not do in the cut-out sandbox. Never fails a render: a photo without its cut-out stays a print.
 */
export async function ensureCutouts(studioId: string, mediaIds: string[]): Promise<void> {
  if (!mediaIds.length) return;
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, storage_path, kind, cutout").eq("studio_id", studioId).in("id", mediaIds);
  // Ten at most, in the order asked (the photos an animation draws her on first), never the database's: « Voici mon
  // travail » had ten of its twenty works cut out at its first bench, and not the photo of her it draws.
  const rank = new Map<string, number>();
  mediaIds.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, i);
  });
  const missing = (assets ?? [])
    .filter((a) => a.kind === "image" && !currentCutout(cutoutSchema.safeParse(a.cutout).data?.model))
    .sort((a, b) => (rank.get(a.id as string) ?? 0) - (rank.get(b.id as string) ?? 0))
    .slice(0, MAX_PHOTOS);
  if (!missing.length) return;
  const signed = await db.storage.from("media").createSignedUrls(missing.map((a) => a.storage_path as string), 3600);
  let photos = missing.flatMap((a, i) => (signed.data?.[i]?.signedUrl ? [{ id: a.id as string, url: signed.data[i]!.signedUrl }] : []));
  if (!photos.length) return;
  if (gpuReady()) {
    const done = await cutOnCard(studioId, photos).catch((error: unknown) => {
      console.warn("photo cut-outs on the card unavailable, the sandbox takes them", error instanceof Error ? error.message.slice(0, 300) : error);
      return new Set<string>();
    });
    photos = photos.filter((p) => !done.has(p.id));
    if (!photos.length) return;
  }
  try {
    const { results, seconds } = await cutoutsInSandbox(`cutout-${randomUUID()}`, photos);
    for (const p of photos) {
      const result = results[p.id];
      if (!result || result instanceof Error) {
        console.warn("cut-out failed", p.id, result instanceof Error ? result.message : "no result");
        continue;
      }
      const path = cutoutPath(studioId, p.id, result.type === "image/webp" ? "webp" : "png");
      const uploaded = await db.storage.from("media").upload(path, result.image, { contentType: result.type, upsert: true });
      if (uploaded.error) {
        console.warn("cut-out not kept", p.id, uploaded.error.message);
        continue;
      }
      const cutout: Cutout = { path, ...result.reading, sticker: stickerWorthy(result.reading), model: CUTOUT_MODEL, at: new Date().toISOString() };
      await db.from("media_assets").update({ cutout }).eq("id", p.id).eq("studio_id", studioId);
    }
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "cutout",
      provider: "vercel_sandbox",
      units: Math.round(seconds),
      cost_eur: cutoutCostEur(seconds),
      meta: costMeta({ photos: photos.length, model: CUTOUT_MODEL }),
    });
  } catch (error) {
    console.warn("cut-outs unavailable, the photos stay prints", error instanceof Error ? error.message.slice(0, 300) : error);
  }
}

/**
 * The photos cut out on the rented card, each sent straight to its place in Storage and kept on its photo; the ids it
 * made. Its time is never the whole step's: the sandbox keeps time for the photos it did not do.
 */
async function cutOnCard(studioId: string, photos: { id: string; url: string }[]): Promise<Set<string>> {
  const db = supabaseAdmin();
  const jobs = (
    await Promise.all(
      photos.map(async (p) => {
        const [webp, png] = await Promise.all((["webp", "png"] as const).map((ext) => db.storage.from("media").createSignedUploadUrl(cutoutPath(studioId, p.id, ext), { upsert: true })));
        return webp?.data?.signedUrl && png?.data?.signedUrl ? [{ key: p.id, url: p.url, upload: { webp: webp.data.signedUrl, png: png.data.signedUrl } }] : [];
      }),
    )
  ).flat();
  if (!jobs.length) return new Set();
  const left = timeLeft();
  const need = GPU_START_MS + CARD_LOAD_MS + jobs.length * CARD_PHOTO_MS;
  const { results, seconds, gpu } = await photosOnGpu(jobs, Number.isFinite(left) ? Math.max(60_000, Math.min(need, left / 2)) : need);
  const at = new Date().toISOString();
  const done = new Set<string>();
  for (const j of jobs) {
    const result = results[j.key];
    if (!result || result instanceof Error) {
      if (result) console.warn("photo cut-out on the card failed", j.key, result.message);
      continue;
    }
    const cutout: Cutout = { path: cutoutPath(studioId, j.key, result.ext), ...result.reading, sticker: stickerWorthy(result.reading), model: CARD_CUTOUT_MODEL, at };
    const saved = await db.from("media_assets").update({ cutout }).eq("id", j.key).eq("studio_id", studioId);
    if (saved.error) console.warn("photo cut-out not kept", j.key, saved.error.message);
    else done.add(j.key);
  }
  // The card's time, billed whether or not it cut out (none when no card was allotted).
  if (seconds > 0)
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "cutout",
      provider: "modal",
      units: Math.round(seconds),
      cost_eur: gpuCostEur(seconds, gpu),
      meta: costMeta({ photos: jobs.length, done: done.size, model: CARD_CUTOUT_MODEL, gpu }),
    });
  return done;
}

/** The size of the copy of a cut-out's transparency its outline is read on (its long side, px). */
const CONTOUR_SIDE = 320;

/**
 * Reads once the outline of each photo's cut-out (contour.ts: 64 points round its subject, on a small copy of its
 * transparency) and keeps it on the cut-out (media_assets.cutout.contour): a word runs along a photo's subject, a line
 * goes round it, as on a video (SubjectOutline, Outline). Never fails a render: a photo without it has no outline.
 */
export async function ensureCutoutContours(studioId: string, mediaIds: string[]): Promise<void> {
  if (!mediaIds.length) return;
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, cutout").eq("studio_id", studioId).in("id", [...new Set(mediaIds)]);
  const todo = (assets ?? []).flatMap((a) => {
    const cutout = cutoutSchema.safeParse(a.cutout);
    return cutout.success && !cutout.data.contour && cutout.data.path.startsWith(`${studioId}/`) ? [{ id: a.id as string, cutout: cutout.data }] : [];
  });
  await Promise.all(
    todo.map(async ({ id, cutout }) => {
      try {
        const file = await db.storage.from("media").download(cutout.path);
        if (file.error || !file.data) return;
        const { data, info } = await sharp(Buffer.from(await file.data.arrayBuffer()))
          .resize({ width: CONTOUR_SIDE, height: CONTOUR_SIDE, fit: "inside" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const alpha = new Uint8Array(info.width * info.height);
        for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * info.channels + info.channels - 1]!;
        const contour = contourOfAlpha(alpha, info.width, info.height);
        if (!contour) return;
        const saved = await db.from("media_assets").update({ cutout: { ...cutout, contour } }).eq("id", id).eq("studio_id", studioId);
        if (saved.error) console.warn("cut-out outline not kept", id, saved.error.message);
      } catch (error) {
        console.warn("cut-out outline unavailable", id, error instanceof Error ? error.message.slice(0, 200) : error);
      }
    }),
  );
}

/** A cut-out an animation can use (sceneWorthy: a clean edge, even cut by the photo's frame), kept for this studio. */
function sceneCutout(studioId: string, raw: unknown): Cutout | null {
  const cutout = cutoutSchema.safeParse(raw);
  return cutout.success && sceneWorthy(cutout.data) && cutout.data.path.startsWith(`${studioId}/`) ? cutout.data : null;
}

/**
 * Her photos as an animation may compose with them, in the order given: what each shows,
 * its link (2 h) and shape, and its cut-out with the subject's box and the edges that cut it.
 */
export async function photoOffers(studioId: string, ids: string[]): Promise<{ id: string; shows: string; photo: ScenePhoto }[]> {
  if (!ids.length) return [];
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, kind, storage_path, regions, cutout").eq("studio_id", studioId).in("id", ids);
  const photos = ids.flatMap((id) => {
    const a = (assets ?? []).find((x) => x.id === id && x.kind === "image" && x.storage_path);
    if (!a) return [];
    const clean = sceneCutout(studioId, a.cutout);
    const read = (a.regions ?? {}) as { width?: number; height?: number; detection?: { notes?: string } };
    // Its shape from its reading, else from its cut-out (framed like the photo).
    const aspect = read.width && read.height ? read.width / read.height : clean ? clean.w / clean.h : 3 / 4;
    return [{ id, path: a.storage_path as string, clean, aspect, shows: read.detection?.notes ?? "" }];
  });
  if (!photos.length) return [];
  const paths = photos.flatMap((p) => [p.path, ...(p.clean ? [p.clean.path] : [])]);
  const signed = (await db.storage.from("media").createSignedUrls(paths, 7200)).data ?? [];
  const url = (path: string) => signed.find((s) => s.path === path)?.signedUrl ?? null;
  return photos.flatMap((p) => {
    const src = url(p.path);
    if (!src) return [];
    const cut = p.clean ? url(p.clean.path) : null;
    const edges = p.clean ? cutEdges(p.clean.touches) : [];
    return [
      {
        id: p.id,
        shows: p.shows,
        photo: { src, aspect: p.aspect, ...(cut && p.clean ? { cutout: cut, subject: p.clean.box, ...(edges.length ? { cutEdges: edges } : {}) } : {}) },
      },
    ];
  });
}

/** The cut-outs the animations of a Reel compose with, signed for the render and the live preview, with the edges that cut them. */
export async function sceneCutoutInputs(studioId: string, photoIds: string[]): Promise<NonNullable<ReelInputs["sceneCutouts"]>> {
  if (!photoIds.length) return {};
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, cutout").eq("studio_id", studioId).in("id", photoIds);
  const usable = (assets ?? []).flatMap((a) => {
    const cutout = sceneCutout(studioId, a.cutout);
    return cutout ? [{ id: a.id as string, cutout }] : [];
  });
  if (!usable.length) return {};
  const signed = await db.storage.from("media").createSignedUrls(usable.map((s) => s.cutout.path), 7200);
  return Object.fromEntries(
    usable.flatMap((s, i) => {
      const src = signed.data?.[i]?.signedUrl;
      const edges = cutEdges(s.cutout.touches);
      return src ? [[s.id, { src, box: s.cutout.box, ...(edges.length ? { edges } : {}), ...(s.cutout.contour?.length ? { contour: s.cutout.contour } : {}) }]] : [];
    }),
  );
}

/** The stickers of a collage: each photo whose cut-out makes one, signed for the render and the live preview. */
export async function stickerInputs(studioId: string, photoIds: string[]): Promise<NonNullable<ReelInputs["cutouts"]>> {
  if (!photoIds.length) return {};
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, cutout").eq("studio_id", studioId).in("id", photoIds);
  const stickers = (assets ?? []).flatMap((a) => {
    const cutout = cutoutSchema.safeParse(a.cutout);
    return cutout.success && cutout.data.sticker && cutout.data.path.startsWith(`${studioId}/`) ? [{ id: a.id as string, cutout: cutout.data }] : [];
  });
  if (!stickers.length) return {};
  const signed = await db.storage.from("media").createSignedUrls(stickers.map((s) => s.cutout.path), 7200);
  return Object.fromEntries(stickers.flatMap((s, i) => (signed.data?.[i]?.signedUrl ? [[s.id, { src: signed.data[i]!.signedUrl, box: s.cutout.box }]] : [])));
}

/**
 * A copied Reel's laid subjects (copy.ts): each photo's cut-out signed, its subject's box and the photo's shape.
 * Any cut-out the copy chose (it took only clean ones), even one the collage's stricter rule would not make a sticker.
 */
export async function copyCutoutInputs(studioId: string, photoIds: string[]): Promise<NonNullable<ReelInputs["copyCutouts"]>> {
  if (!photoIds.length) return {};
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, cutout").eq("studio_id", studioId).in("id", photoIds);
  const cuts = (assets ?? []).flatMap((a) => {
    const cutout = cutoutSchema.safeParse(a.cutout);
    return cutout.success && cutout.data.path.startsWith(`${studioId}/`) ? [{ id: a.id as string, cutout: cutout.data }] : [];
  });
  if (!cuts.length) return {};
  const signed = await db.storage.from("media").createSignedUrls(cuts.map((c) => c.cutout.path), 7200);
  return Object.fromEntries(
    cuts.flatMap((c, i) => (signed.data?.[i]?.signedUrl ? [[c.id, { src: signed.data[i]!.signedUrl, box: c.cutout.box, aspect: c.cutout.w / c.cutout.h }]] : [])),
  );
}

/**
 * The photos she added on her Reel (plan.overlays): each one signed, with its shape, and its subject cut out when the
 * cut-out is clean enough to stand alone (sceneWorthy): drawn by the engine over her Reel, and in the live preview.
 */
export async function overlayPhotoInputs(studioId: string, ids: string[]): Promise<NonNullable<ReelInputs["overlayPhotos"]>> {
  const unique = [...new Set(ids)].slice(0, 16);
  if (!unique.length) return {};
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, kind, storage_path, regions, cutout").eq("studio_id", studioId).eq("kind", "image").in("id", unique);
  const rows = (assets ?? []).filter((a) => typeof a.storage_path === "string" && (a.storage_path as string).startsWith(`${studioId}/`));
  if (!rows.length) return {};
  const cuts = rows.map((a) => {
    const cutout = cutoutSchema.safeParse(a.cutout);
    return cutout.success && cutout.data.path.startsWith(`${studioId}/`) && sceneWorthy(cutout.data) ? cutout.data : null;
  });
  const paths = [...rows.map((a) => a.storage_path as string), ...cuts.flatMap((c) => (c ? [c.path] : []))];
  const signed = (await db.storage.from("media").createSignedUrls(paths, 7200)).data ?? [];
  const url = (path: string) => signed.find((s) => s.path === path)?.signedUrl;
  return Object.fromEntries(
    rows.flatMap((a, i) => {
      const src = url(a.storage_path as string);
      if (!src) return [];
      const read = (a.regions ?? {}) as { width?: number; height?: number };
      const cut = cuts[i];
      const aspect = read.width && read.height ? read.width / read.height : cut ? cut.w / cut.h : 3 / 4;
      const cutSrc = cut ? url(cut.path) : undefined;
      return [[a.id as string, { src, aspect, ...(cut && cutSrc ? { cutout: { src: cutSrc, box: cut.box } } : {}) }]];
    }),
  );
}

