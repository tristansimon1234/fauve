import "server-only";
import { gridOf, GRID, type SceneBackdrop } from "@render/contrast";
import sharp from "sharp";
import type { SceneRequest } from "./motion-designer";

// The colours of the picture under an animation, for the scene check (a word lost on it is sent back to the
// motion designer): read on the images of the Reel it saw before being written, a coarse grid of each.

/** A grid of an image of the Reel (a 9:16 frame, any size), as base64. */
async function gridFrom(jpeg: Buffer): Promise<string> {
  // Four pixels a cell each way: the grid takes each cell's median, so the thin strokes of a text do not change it.
  const width = GRID.cols * 4;
  const height = GRID.rows * 4;
  const { data } = await sharp(jpeg).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return Buffer.from(gridOf(new Uint8Array(data), width, height)).toString("base64");
}

/**
 * What the scene check reads under an animation's words, from its first draft's images (`canvas`): a composition's
 * shots, each one's first image (by its index), or the footage under an animation at its own frames. Kept on the
 * request (its fix is checked on the same picture); nothing when it was written blind or when an image is unreadable.
 */
export async function sceneBackdrop(request: SceneRequest): Promise<SceneBackdrop | undefined> {
  if (request.backdrop !== undefined) return request.backdrop ?? undefined;
  const canvas = request.canvas ?? [];
  try {
    if (request.compose) {
      const firsts = new Map<number, Buffer>();
      for (const image of canvas) if (image.shot !== undefined && !firsts.has(image.shot)) firsts.set(image.shot, image.jpeg);
      const shots = Object.fromEntries(await Promise.all([...firsts].map(async ([shot, jpeg]) => [String(shot), await gridFrom(jpeg)] as const)));
      request.backdrop = Object.keys(shots).length ? { shots } : null;
    } else {
      const own = canvas.filter((image): image is typeof image & { frame: number } => image.frame !== undefined);
      const frames = await Promise.all(own.map(async (image) => ({ frame: image.frame, grid: await gridFrom(image.jpeg) })));
      request.backdrop = frames.length ? { frames } : null;
    }
  } catch (error) {
    console.warn("motion: the picture under an animation could not be read", error);
    request.backdrop = null;
  }
  return request.backdrop ?? undefined;
}
