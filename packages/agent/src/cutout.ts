import { z } from "zod";

// Collages: the subject of a photo (a person, a dish, a product) cut out pixel-exact
// in the render sandbox by an open model, never redrawn, then laid on the Reel as a
// sticker with a white scissor edge. A cut-out is kept on its photo
// (media_assets.cutout); only a clean one makes a sticker, the others stay prints.

/** The model the cut-outs come from: a new one cuts every photo again. */
export const CUTOUT_MODEL = "birefnet-lite";

const share = z.number().min(0).max(1);

export const cutoutSchema = z.object({
  /** The image with transparency in Storage ({studio}/cutouts/{media}.webp). */
  path: z.string().min(1),
  w: z.number().positive(),
  h: z.number().positive(),
  /** How much of the photo the subject covers. */
  coverage: share,
  /** How many separate pieces make the subject (two dishes, a person and a dog). */
  parts: z.number().int().min(1),
  /** The subject's box, in shares of the photo. */
  box: z.object({ x: share, y: share, w: share, h: share }),
  /** How much of each edge of the photo the subject runs into. */
  touches: z.object({ top: share, bottom: share, left: share, right: share }),
  /** The share of its edge the model was unsure of (hair, glass, smoke). */
  unsure: z.number().min(0),
  /** Clean enough to be a sticker (stickerWorthy). */
  sticker: z.boolean(),
  model: z.string(),
  at: z.string(),
});
export type Cutout = z.infer<typeof cutoutSchema>;

/**
 * Whether a cut-out makes a sticker: a subject that stands on its own in the photo (not
 * a whole room, not a speck), in one to three pieces, not cut off by the top or the sides
 * (a bust may run into the bottom), with a clean edge. Any other photo stays a print.
 */
export function stickerWorthy(r: Pick<Cutout, "coverage" | "parts" | "touches" | "unsure">): boolean {
  return (
    r.coverage >= 0.03 &&
    r.coverage <= 0.72 &&
    r.parts <= 3 &&
    r.touches.top <= 0.15 &&
    r.touches.left <= 0.2 &&
    r.touches.right <= 0.2 &&
    r.unsure <= 0.15
  );
}
