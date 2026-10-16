import "server-only";
import { randomUUID } from "node:crypto";
import { CUTOUT_MODEL, cutoutSchema, stickerWorthy, type Cutout, type ReelInputs } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cutoutsInSandbox, sandboxCostEur } from "./sandbox";

// Collages: the subject of each photo cut out once in the render sandbox (an open
// model, never redrawn), kept on the photo (media_assets.cutout) with its image in
// Storage; a clean one is laid on the Reel as a sticker, the others stay prints.

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
      cost_eur: sandboxCostEur(seconds),
      meta: { photos: photos.length, model: CUTOUT_MODEL },
    });
  } catch (error) {
    console.warn("cut-outs unavailable, the photos stay prints", error instanceof Error ? error.message.slice(0, 300) : error);
  }
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
