import { isClipSegment, type CameraMove, type EditPlan } from "./schemas.ts";

// A moving photo in relief (Prequel's 3D photo, CapCut's 3D zoom), the engine's way: when a photo of
// a Reel moves (its one slow push, a pan over a wide photo: photoMoves) and its subject cuts out
// cleanly (sceneWorthy, the cut-out a collage or an animation uses), the subject moves a little more
// than the room behind it (apps/render/src/Depth.tsx). Nothing is invented: the subject only grows over
// its own place. A photo with blurred faces stays flat (its cut-out would show them).

/** The moves a photo plays in relief: a slow push in or out, a slow pan. */
export const DEPTH_MOVES: CameraMove[] = ["in", "out", "left", "right"];

/** The photos of a plan that move (and are not blurred): their subject is cut out before the render, to play them in relief. */
export function depthPhotoIds(plan: Pick<EditPlan, "segments"> & { template?: EditPlan["template"] }): string[] {
  if (plan.template === "collage") return [];
  return [
    ...new Set(plan.segments.flatMap((s) => (isClipSegment(s) && s.photo && !s.photo.blur?.length && s.move && DEPTH_MOVES.includes(s.move) ? [s.clip_id] : []))),
  ];
}
