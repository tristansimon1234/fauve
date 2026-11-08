// A slow push laid on a whole shot by a composition (Tristan, on the light zooms: « je trouve ça cheap »): its Footage
// that grows (or shrinks) a little, steadily, from one end of the shot to the other. Measured by the scene check on
// the size of each shot's picture at the frames it samples (SceneCheck, FAUVE_PUSH), only when her words ask for no
// camera move. A punch (a jump in size), an opening that settles, a window that grows into a card, or a shot drawn
// small (a print, a panel of a split screen) is not one: only a picture that fills the frame and keeps changing size.

/** The least change of size, over the shot, that is seen as a move (3 %), and the most a slow one makes (a zoom past it is an effect). */
export const PUSH_MIN = 0.03;
export const PUSH_MAX = 0.5;
/** The share of the frame's width a picture fills to be a full-frame shot. */
export const PUSH_FULL = 0.8;
/** The least of the shot a move covers to be « over the whole shot » (its frames sampled from first to last). */
export const PUSH_SPAN = 0.7;
/** A step between two samples above this is a jump (a punch), not a slow move. */
const PUSH_JUMP = 0.06;

export type PushSample = { frame: number; scale: number };

/**
 * The slow move in a shot's samples (its picture's width over the frame's, frame by frame, in order), or null: a size
 * that keeps going the same way (never back, never in a jump) and changes by PUSH_MIN to PUSH_MAX, over PUSH_SPAN of
 * the shot at least (`length`: the shot's frames), the picture filling the frame all along.
 */
export function slowPush(samples: PushSample[], length: number): { from: number; to: number; ratio: number } | null {
  const seen = samples.filter((s) => Number.isFinite(s.scale) && s.scale > 0).sort((a, b) => a.frame - b.frame);
  if (seen.length < 4 || seen.some((s) => s.scale < PUSH_FULL)) return null;
  const first = seen[0]!;
  const last = seen.at(-1)!;
  if (last.frame - first.frame < length * PUSH_SPAN) return null;
  const ratio = last.scale / first.scale;
  if (Math.abs(ratio - 1) < PUSH_MIN || Math.abs(ratio - 1) > PUSH_MAX) return null;
  const way = Math.sign(ratio - 1);
  let moving = 0;
  for (let i = 1; i < seen.length; i++) {
    const step = (seen[i]!.scale - seen[i - 1]!.scale) / seen[i - 1]!.scale;
    // Back the other way, or a jump: not a slow move.
    if (step * way < -0.002 || Math.abs(step) > PUSH_JUMP) return null;
    if (step * way > 0.0005) moving++;
  }
  // It keeps moving: most of its steps change its size.
  if (moving < (seen.length - 1) * 0.7) return null;
  return { from: first.frame, to: last.frame, ratio };
}
