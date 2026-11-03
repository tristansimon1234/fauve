import { z } from "zod";

// Slow motion made smooth on the rented card (apps/render/rife.py, apps/web/src/lib/render/smooth.ts): the passages of
// a clip made at 60 images a second, kept beside it (media_assets.smooth) by passage: the file in Storage
// ({studio}/smooth/…) or why it failed. Removed with the clip.

export const mediaSmoothSchema = z.record(
  z.string(),
  z.union([
    z.object({ path: z.string(), frames: z.number().int().positive(), made: z.number().int().min(0).optional(), at: z.string() }),
    z.object({ failed_at: z.string(), error: z.string() }),
  ]),
);
export type MediaSmooth = z.infer<typeof mediaSmoothSchema>;

/** The files a clip's slow passages keep in Storage (removed with it). */
export function smoothFiles(raw: unknown): string[] {
  const parsed = mediaSmoothSchema.safeParse(raw ?? {});
  return parsed.success ? Object.values(parsed.data).flatMap((r) => ("path" in r ? [r.path] : [])) : [];
}
