import { z } from "zod";
import { coverLayout } from "./retouch.ts";
import { isClipSegment, segmentSeconds, type CameraMove, type EditPlan } from "./schemas.ts";

// A moving photo in relief (Prequel's 3D photo, CapCut's 3D zoom), the engine's way: when a photo of
// a Reel moves (its one slow push, a pan over a wide photo: photoMoves) and its subject cuts out
// cleanly (sceneWorthy, the cut-out a collage or an animation uses), the subject moves a little more
// than the room behind it (apps/render/src/Depth.tsx). Nothing is invented: the subject only grows over
// its own place. A photo with blurred faces stays flat (its cut-out would show them).

/** The moves a photo plays in relief: a slow push in or out, a slow pan. */
export const DEPTH_MOVES: CameraMove[] = ["in", "out", "left", "right"];

/** The photos of a plan that move (and are not blurred): their subject is cut out before the render, to play them in relief. */
export function depthPhotoIds(plan: Pick<EditPlan, "segments"> & { template?: EditPlan["template"]; finish?: EditPlan["finish"] }): string[] {
  if (plan.template === "collage" || plan.finish?.relief === "off") return [];
  return [
    ...new Set(plan.segments.flatMap((s) => (isClipSegment(s) && s.photo && !s.photo.blur?.length && s.move && DEPTH_MOVES.includes(s.move) ? [s.clip_id] : []))),
  ];
}

// ——— Its depth read on the rented card (apps/render/relief.py) —————————————————————————————————————————————
// With the card set up, a moving photo of a Reel no longer moves only its subject: its depth is read once (Depth
// Anything V2 small) and every pixel moves by its own depth over the shot, the nearer the more, written as a video of
// the photo's own frame that the Reel draws in place of the photo, with the same framing, retouch and camera move
// (ReliefPhoto in apps/render/src/Depth.tsx). Made before the render for the shot as the plan has it (its move and
// length, where the frame's centre falls on the photo), kept on the photo by that key: a text changed keeps it, a
// shot made longer makes another.

/** Bumped when relief.py draws differently: the videos made before are made again. */
export const RELIEF_VERSION = 1;
/** The Reel's frame and pace (motion.ts: 1080 × 1920 at REEL_FPS). */
const FRAME = { width: 1080, height: 1920 };
const FPS = 30;
/** How far the room slides each way on a pan (cameraMotion in apps/render/src/track.ts: 1.3 % of the frame's width). */
const PAN_SLIDE = 0.013;

/** A shot of a photo in relief, as relief.py makes it. */
export type ReliefJob = {
  media_id: string;
  /** Its shot's key on the photo (move, length, centre, slide, version). */
  key: string;
  move: "in" | "out" | "left" | "right";
  /** The shot's length in images (the Reel's segment). */
  frames: number;
  /** Where the frame's centre falls on the photo (shares): a push grows about it. */
  origin: { x: number; y: number };
  /** A pan: how far the room slides each way, in shares of the photo's width (signed: left is positive). */
  shift: number;
};

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

/** The relief a photo segment plays, if it plays one: its key and what relief.py needs (`frames`: the segment's length in images). */
export function reliefOf(segment: EditPlan["segments"][number], frames: number): Omit<ReliefJob, "media_id"> | null {
  if (!isClipSegment(segment) || !segment.photo || segment.photo.blur?.length || !segment.move || !DEPTH_MOVES.includes(segment.move)) return null;
  const move = segment.move as ReliefJob["move"];
  const layout = coverLayout(FRAME, segment.photo.source, segment.photo.adjust);
  const origin = { x: round((FRAME.width / 2 - layout.left) / layout.width, 3), y: round((FRAME.height / 2 - layout.top) / layout.height, 3) };
  const way = move === "left" ? 1 : move === "right" ? -1 : 0;
  const shift = round((way * PAN_SLIDE * FRAME.width) / layout.width, 4);
  return { key: `${move}-${frames}-${origin.x}-${origin.y}-${shift}-v${RELIEF_VERSION}`, move, frames, origin, shift };
}

/** The photo shots of a plan to play in relief (depthPhotoIds), each with its key: what the card makes before the render. */
export function reliefJobs(plan: Pick<EditPlan, "segments"> & { template?: EditPlan["template"]; finish?: EditPlan["finish"] }): ReliefJob[] {
  const ids = new Set(depthPhotoIds(plan));
  const seen = new Set<string>();
  return plan.segments.flatMap((s) => {
    if (!isClipSegment(s) || !ids.has(s.clip_id)) return [];
    // The segment's length in images, as the Reel lays it (motion.ts frameLengths).
    const relief = reliefOf(s, Math.max(1, Math.round(segmentSeconds(s) * FPS)));
    const id = relief ? `${s.clip_id}#${relief.key}` : "";
    if (!relief || seen.has(id)) return [];
    seen.add(id);
    return [{ media_id: s.clip_id, ...relief }];
  });
}

/** What is kept on a photo (media_assets.reliefs): by shot key, its video in Storage or why it failed. */
export const mediaReliefsSchema = z.record(
  z.string(),
  z.union([
    z.object({ path: z.string(), frames: z.number().int().positive(), w: z.number().int().positive(), h: z.number().int().positive(), near: z.number().min(0).max(1).optional(), at: z.string() }),
    z.object({ failed_at: z.string(), error: z.string() }),
  ]),
);
export type MediaReliefs = z.infer<typeof mediaReliefsSchema>;

/** The files a photo's reliefs keep in Storage (removed with it). */
export function reliefFiles(raw: unknown): string[] {
  const parsed = mediaReliefsSchema.safeParse(raw ?? {});
  return parsed.success ? Object.values(parsed.data).flatMap((r) => ("path" in r ? [r.path] : [])) : [];
}
