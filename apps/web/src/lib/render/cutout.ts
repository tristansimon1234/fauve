import "server-only";
import { randomUUID } from "node:crypto";
import { CUTOUT_MODEL, cutEdges, cutoutSchema, sceneWorthy, stickerWorthy, type Cutout, type ReelInputs, type ScenePhoto } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cutoutCostEur, cutoutsInSandbox } from "./sandbox";
import { costMeta } from "@/lib/cost-scope";

// Cut-outs: the subject of a photo cut out once in its own sandbox (an open model,
// never redrawn), kept on the photo (media_assets.cutout) with its image in Storage.
// In a collage, a clean one is laid on the Reel as a sticker, the others stay prints;
// in any Reel, an animation can compose with her photos and their cut-outs.

/** The most photos cut out in one go (each takes 10 to 30 s). */
const MAX_PHOTOS = 10;

/** Where a photo's cut-out is kept (the retention removes it with its photo). */
export const cutoutPath = (studioId: string, mediaId: string, ext: "webp" | "png") => `${studioId}/cutouts/${mediaId}.${ext}`;

/**
 * Cuts out the subject of the photos that have none yet (or one from an older model).
 * Never fails a render: a photo without its cut-out stays a print.
 */
export async function ensureCutouts(studioId: string, mediaIds: string[]): Promise<void> {
  if (!mediaIds.length) return;
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, storage_path, kind, cutout").eq("studio_id", studioId).in("id", mediaIds);
  const missing = (assets ?? [])
    .filter((a) => a.kind === "image" && cutoutSchema.safeParse(a.cutout).data?.model !== CUTOUT_MODEL)
    .slice(0, MAX_PHOTOS);
  if (!missing.length) return;
  const signed = await db.storage.from("media").createSignedUrls(missing.map((a) => a.storage_path as string), 3600);
  const photos = missing.flatMap((a, i) => (signed.data?.[i]?.signedUrl ? [{ id: a.id as string, url: signed.data[i]!.signedUrl }] : []));
  if (!photos.length) return;
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
      return src ? [[s.id, { src, box: s.cutout.box, ...(edges.length ? { edges } : {}) }]] : [];
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
