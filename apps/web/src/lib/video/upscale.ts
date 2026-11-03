import "server-only";
import { needsUpscale, UPSCALE_MAX_SECONDS, UPSCALE_MAX_WORK, upscaleWork } from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { GPU_START_MS, gpuCostEur, gpuReady, upscaleOnGpu } from "@/lib/render/gpu";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her photos and videos too small for a Reel (a video WhatsApp shrank to 480p, a small photo from a website), enlarged
// once as soon as they arrive, on the rented card (apps/render/upscale.py, Real-ESRGAN): the larger copy takes the
// file's place (storage_path), so the reading, the tracking, the renders and the previews all use it, and the original
// is kept (original_path), gone with the media at retention. Never fails the arrival: without the card, or when it
// fails, the file stays as sent.

/** Where a photo's or a video's larger copy is kept. */
export const upscaledPath = (studioId: string, mediaId: string, ext: "mp4" | "jpg") => `${studioId}/upscaled/${mediaId}.${ext}`;

/** On the card: Real-ESRGAN loaded (1 s) and the file fetched, then a photo (6 s in production) or a video (upscaleWork). */
const LOAD_MS = 30_000;
const PHOTO_MS = 15_000;

/**
 * Enlarges the photo or the video when its short side is under 720 px (and over 200; a video of 90 s at most, and
 * of 2 min of the card at most): its larger copy then takes its place. The new storage path, or null when it is left
 * as it is.
 */
export async function upscaleIfSmall(
  asset: { id: string; studio_id: string; storage_path: string; original_path?: string | null },
  kind: "video" | "image",
  size: { width: number; height: number } | null,
  duration?: number,
): Promise<{ storage_path: string; original_path: string } | null> {
  if (!gpuReady() || !size || !needsUpscale(size.width, size.height)) return null;
  const work = kind === "video" ? upscaleWork(size.width, size.height, duration ?? 30) : 0;
  if (kind === "video" && ((duration ?? 0) > UPSCALE_MAX_SECONDS || work > UPSCALE_MAX_WORK)) return null;
  const db = supabaseAdmin();
  const path = upscaledPath(asset.studio_id, asset.id, kind === "video" ? "mp4" : "jpg");
  try {
    const [source, upload] = await Promise.all([
      db.storage.from("media").createSignedUrl(asset.storage_path, 3600),
      db.storage.from("media").createSignedUploadUrl(path, { upsert: true }),
    ]);
    if (!source.data?.signedUrl || !upload.data?.signedUrl) throw new Error("links refused");
    const deadline = GPU_START_MS + LOAD_MS + (kind === "video" ? Math.max(15_000, 1.5 * work * 1000) : PHOTO_MS);
    const { results, seconds, gpu } = await upscaleOnGpu(
      [{ key: asset.id, url: source.data.signedUrl, kind, upload: kind === "video" ? { mp4: upload.data.signedUrl } : { jpg: upload.data.signedUrl } }],
      deadline,
    );
    // The card's time, billed whether or not it made the copy (none when no card was allotted).
    if (seconds > 0)
      await db.from("cost_events").insert({
        studio_id: asset.studio_id,
        kind: "upscale",
        provider: "modal",
        units: Math.round(seconds),
        cost_eur: gpuCostEur(seconds, gpu),
        meta: costMeta({ media_id: asset.id, media: kind, from: [size.width, size.height], gpu, ...(duration ? { duration } : {}) }),
      });
    const result = results[asset.id];
    if (!result || result instanceof Error) throw result ?? new Error("nothing made");
    const original = asset.original_path ?? asset.storage_path;
    const swapped = await db
      .from("media_assets")
      .update({
        storage_path: path,
        original_path: original,
        mime_type: kind === "video" ? "video/mp4" : "image/jpeg",
        width: result.w,
        height: result.h,
        upscaled: { from: result.from[0] ? result.from : [size.width, size.height], to: [result.w, result.h], model: "realesr-general-x4v3", at: new Date().toISOString() },
      })
      .eq("id", asset.id)
      .eq("studio_id", asset.studio_id);
    if (swapped.error) throw new Error(swapped.error.message);
    return { storage_path: path, original_path: original };
  } catch (error) {
    console.warn("not enlarged, the file stays as sent", asset.id, error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
  }
}
