import { z } from "zod";

// Her photos and videos too small for a Reel (a video WhatsApp shrank to 480p, a small photo from a website), enlarged
// once as soon as they arrive, on the rented card (apps/render/upscale.py, Real-ESRGAN): the larger copy takes the
// file's place (storage_path) and the original is kept (original_path), like a steadied video.

/** Below this short side (px) a photo or a video is enlarged: a 1080 × 1920 Reel would show it at 1.5 times its size or more. */
export const UPSCALE_BELOW = 720;
/** Nor a picture smaller than this (an icon, a thumbnail): there is nothing to rebuild. */
export const UPSCALE_FROM = 200;
/** Nor a video longer than this (seconds): a minute and a half of the card at most. */
export const UPSCALE_MAX_SECONDS = 90;

/** Whether a photo or a video of this size is enlarged. */
export function needsUpscale(width: number, height: number): boolean {
  const short = Math.min(width, height);
  return Number.isFinite(short) && short >= UPSCALE_FROM && short < UPSCALE_BELOW;
}

/** What is kept on an enlarged photo or video (media_assets.upscaled). */
export const mediaUpscaledSchema = z.object({ from: z.tuple([z.number(), z.number()]), to: z.tuple([z.number(), z.number()]), model: z.string(), at: z.string() });

/**
 * The size of the first picture track of an MP4 or MOV file (its tkhd box, turned a quarter when its matrix says so),
 * as a player shows it; null when it cannot be read (another container, a truncated file).
 */
export function mp4Size(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number) => String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
  const boxes = function* (start: number, end: number) {
    let at = start;
    while (at + 8 <= end) {
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) return;
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) return;
      yield { kind: type(at), body: at + header, end: at + size };
      at += size;
    }
  };
  for (const moov of boxes(0, bytes.length)) {
    if (moov.kind !== "moov") continue;
    for (const trak of boxes(moov.body, moov.end)) {
      if (trak.kind !== "trak") continue;
      for (const tkhd of boxes(trak.body, trak.end)) {
        if (tkhd.kind !== "tkhd") continue;
        const v1 = bytes[tkhd.body] === 1;
        // version and flags, times, track id, reserved, duration, then 8 reserved, layer, group, volume, reserved.
        const matrix = tkhd.body + 4 + (v1 ? 32 : 20) + 16;
        if (matrix + 44 > tkhd.end) continue;
        const width = view.getUint32(matrix + 36) / 65536;
        const height = view.getUint32(matrix + 40) / 65536;
        if (!width || !height) continue;
        const a = view.getInt32(matrix);
        const b = view.getInt32(matrix + 4);
        const turned = Math.abs(b) > Math.abs(a);
        return turned ? { width: Math.round(height), height: Math.round(width) } : { width: Math.round(width), height: Math.round(height) };
      }
    }
  }
  return null;
}
