import { Easing, interpolate } from "remotion";
import type { Theme } from "./theme";
import type { CameraMove } from "./types";

// What moves in her footage, where an animation sees it. track.py read every image of her
// clips (hands with their 21 points, faces, bodies); here a scene asks « where is it at my
// frame » and gets the answer in pixels of the Reel, as the Reel draws the footage: framed on
// its subject, straightened, with its camera move and its signature punch. The same geometry
// draws the footage (Reel.tsx), so a word laid on a fingertip stays on it. Nothing here knows
// what an animation does with it.

/** What track.py read in a passage of a clip (mirror of FootageTracks in packages/agent/src/tracking.ts). */
export type FootageTracks = {
  /** Images per second (the Reel's). */
  fps: number;
  /** The clip's image (at fps) of frames[0]. */
  from: number;
  /** The tracked picture's width / height. */
  aspect: number;
  /**
   * One entry per image, in thousandths of the picture: hands h [id, x0, y0 … x20, y20], faces
   * f [id, x, y, w, h, then 6 points x, y], bodies b [id, x0, y0, v0 … x32, y32, v32] (v: how
   * visible, in hundredths). An id stays from one image to the next.
   */
  frames: { h?: number[][]; f?: number[][]; b?: number[][] }[];
};

/**
 * How a passage is drawn, as the Reel draws it: its real shape (covering the frame), its subject
 * kept in the crop (framed with the shape the Reel was given, `framingAspect`), straightened,
 * its camera move, its punch.
 */
export type FootageLook = {
  aspect: number;
  framingAspect?: number;
  focus?: { x: number; y: number };
  straighten?: number;
  move?: CameraMove;
  accent?: "punch" | "wipe";
};

/**
 * A piece of footage under an animation: its shot starts at scene frame `at` and lasts
 * `length` frames (its camera move runs over that span), the clip's image `startFrom` at `at`,
 * played at `speed`, drawn with `look`, with what was tracked in it (mirror of TrackPiece).
 */
export type TrackPiece = { at: number; length: number; startFrom: number; speed?: number; look: FootageLook; tracks: FootageTracks };

export const HAND_POINTS = [
  "wrist",
  "thumb_cmc",
  "thumb_mcp",
  "thumb_ip",
  "thumb_tip",
  "index_mcp",
  "index_pip",
  "index_dip",
  "index_tip",
  "middle_mcp",
  "middle_pip",
  "middle_dip",
  "middle_tip",
  "ring_mcp",
  "ring_pip",
  "ring_dip",
  "ring_tip",
  "pinky_mcp",
  "pinky_pip",
  "pinky_dip",
  "pinky_tip",
] as const;
export const FACE_POINTS = ["right_eye", "left_eye", "nose", "mouth", "right_ear", "left_ear"] as const;
export const BODY_POINTS = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;

export type Point = { x: number; y: number };
/** A hand: its id (kept from one image to the next), the centre of its palm, its size (px, about wrist to fingertips), its 21 points. */
export type SeenHand = { id: number; x: number; y: number; size: number; points: Record<(typeof HAND_POINTS)[number], Point> };
/** A face: its id, the centre and size of its box, its eyes, nose, mouth and ears. */
export type SeenFace = { id: number; x: number; y: number; width: number; height: number; points: Record<(typeof FACE_POINTS)[number], Point> };
/** A body: its id, its centre (between the shoulders, else the nose), its 33 points, each one seen or not (hidden, out of the picture). */
export type SeenBody = { id: number; x: number; y: number; points: Record<(typeof BODY_POINTS)[number], Point & { visible: boolean }> };
export type Seen = { hands: SeenHand[]; faces: SeenFace[]; bodies: SeenBody[] };
/** In a composition: the shot (index in `shots`) and the box it was laid in with Footage (px). */
export type TrackBox = { shot: number; left: number; top: number; width: number; height: number };
export type TrackFn = (frame: number, box?: TrackBox) => Seen;

export const NOTHING_SEEN: Seen = Object.freeze({ hands: [], faces: [], bodies: [] }) as Seen;
export const trackNothing: TrackFn = () => NOTHING_SEEN;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Where to anchor a wider clip in the vertical crop so its subject (focus, shares of the
 * picture) stays in view: object-position, in percent (that share of the overflow on the left / top).
 */
export function framingPercent(focus: { x: number; y: number } | undefined, aspect: number | undefined, frameAspect: number): [number, number] | undefined {
  if (!focus || !aspect) return undefined;
  const at = (f: number, ratio: number) => {
    // The picture is `ratio` times the frame along this side: the subject at the centre when the edges allow.
    if (ratio <= 1.001) return 50;
    return Math.round(Math.min(100, Math.max(0, ((f * ratio - 0.5) / (ratio - 1)) * 100)));
  };
  return [at(focus.x, aspect / frameAspect), at(focus.y, frameAspect / aspect)];
}

/** A tilted picture rotated straight, enlarged just enough that no corner shows. */
export function straightening(degrees: number | undefined, frameAspect: number): { degrees: number; scale: number } | undefined {
  if (!degrees) return undefined;
  const a = (Math.abs(degrees) * Math.PI) / 180;
  const scale = Math.max(Math.cos(a) + Math.sin(a) / frameAspect, Math.cos(a) + Math.sin(a) * frameAspect);
  return { degrees, scale: Number(scale.toFixed(4)) };
}

/**
 * The camera's move over a shot at one of its frames, like an editor adds it to a still shot:
 * a slow push-in or pull-out, a slow pan (enlarged a little, it slides by a few percent of the
 * width), or a tighter crop held (a jump cut on the beat). `shift`: in percent of the width.
 */
export function cameraMotion(move: CameraMove, frame: number, durationInFrames: number, theme: Theme): { scale: number; shift?: number } | undefined {
  const p = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const z = theme.zoomTo - 1;
  if (move === "in") return { scale: 1 + z * p };
  if (move === "out") return { scale: 1 + z - z * p };
  if (move === "left" || move === "right") {
    const way = move === "left" ? 1 : -1;
    return { scale: 1.02 + z, shift: way * (2.6 * p - 1.3) };
  }
  if (move === "punch") return { scale: theme.punch };
  return undefined;
}

/** The signature « punch » into a shot: a short zoom that settles over its first 8 frames, no bounce. */
export const punchScale = (frame: number) => interpolate(frame, [0, 8], [1.12, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

/** A point moved by a transform about the centre of a width × height box: shifted (share of the width), scaled, rotated. */
function about(p: Point, width: number, height: number, scale: number, degrees = 0, shift = 0): Point {
  const cx = width / 2;
  const cy = height / 2;
  let x = p.x - cx + shift * width;
  let y = p.y - cy;
  if (degrees) {
    const a = (degrees * Math.PI) / 180;
    [x, y] = [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  }
  return { x: cx + x * scale, y: cy + y * scale };
}

/**
 * Where a point of the picture (shares of it) lands in a width × height box at frame `t` of a
 * shot lasting `length` frames: covering the box (object-fit), framed on the subject, then
 * straightened, then the camera's move, then the punch, in the order the Reel nests them.
 */
export function picturePoint(u: number, v: number, look: FootageLook, t: number, length: number, theme: Theme, width: number, height: number): Point {
  const frameAspect = width / height;
  const wide = look.aspect > frameAspect;
  const shownWidth = wide ? height * look.aspect : width;
  const shownHeight = wide ? height : width / look.aspect;
  const [px, py] = framingPercent(look.focus, look.framingAspect, frameAspect) ?? [50, 50];
  let p: Point = { x: ((width - shownWidth) * px) / 100 + u * shownWidth, y: ((height - shownHeight) * py) / 100 + v * shownHeight };
  const straight = straightening(look.straighten, frameAspect);
  if (straight) p = about(p, width, height, straight.scale, straight.degrees);
  const camera = look.move ? cameraMotion(look.move, t, length, theme) : undefined;
  if (camera) p = about(p, width, height, camera.scale, 0, (camera.shift ?? 0) / 100);
  if (look.accent === "punch") p = about(p, width, height, punchScale(t));
  return p;
}

type Rows = { h: number[][]; f: number[][]; b: number[][] };

/** What was read at a clip's image (fractional: between two images, each point on the line between them). */
function rowsAt(tracks: FootageTracks, clipFrame: number): Rows | null {
  const i = clipFrame - tracks.from;
  const last = tracks.frames.length - 1;
  if (last < 0 || i < -0.5 || i > last + 0.5) return null;
  const k0 = Math.max(0, Math.min(last, Math.floor(i)));
  const k1 = Math.min(last, k0 + 1);
  const t = Math.max(0, Math.min(1, i - k0));
  const a = tracks.frames[k0] ?? {};
  const b = tracks.frames[k1] ?? {};
  // Each thing as seen on the nearer image, moved toward where it is on the other one when it is there too.
  const mix = (ra: number[][] = [], rb: number[][] = []) =>
    (t < 0.5 ? ra : rb).map((row) => {
      const other = (t < 0.5 ? rb : ra).find((r) => r[0] === row[0]);
      if (!other) return row;
      const [from, to] = t < 0.5 ? [row, other] : [other, row];
      return from.map((value, j) => (j === 0 ? value : value + ((to[j] ?? value) - value) * t));
    });
  return { h: mix(a.h, b.h), f: mix(a.f, b.f), b: mix(a.b, b.b) };
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const round = (p: Point): Point => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });

/** What was read, placed by `place` (shares of the picture → px). */
function seenOf(rows: Rows, place: (u: number, v: number) => Point): Seen {
  const at = (row: number[], k: number) => round(place((row[k] ?? 0) / 1000, (row[k + 1] ?? 0) / 1000));
  const hands = rows.h.map((row): SeenHand => {
    const points = Object.fromEntries(HAND_POINTS.map((name, k) => [name, at(row, 1 + 2 * k)])) as SeenHand["points"];
    const palm = [points.wrist, points.index_mcp, points.middle_mcp, points.ring_mcp, points.pinky_mcp];
    const centre = { x: palm.reduce((s, p) => s + p.x, 0) / palm.length, y: palm.reduce((s, p) => s + p.y, 0) / palm.length };
    const size = 2 * Math.hypot(points.middle_mcp.x - points.wrist.x, points.middle_mcp.y - points.wrist.y);
    return { id: row[0]!, ...round(centre), size: Math.round(size), points };
  });
  const faces = rows.f.map((row): SeenFace => {
    const topLeft = at(row, 1);
    const bottomRight = round(place(((row[1] ?? 0) + (row[3] ?? 0)) / 1000, ((row[2] ?? 0) + (row[4] ?? 0)) / 1000));
    const points = Object.fromEntries(FACE_POINTS.map((name, k) => [name, at(row, 5 + 2 * k)])) as SeenFace["points"];
    return {
      id: row[0]!,
      ...round(mid(topLeft, bottomRight)),
      width: Math.round(Math.abs(bottomRight.x - topLeft.x)),
      height: Math.round(Math.abs(bottomRight.y - topLeft.y)),
      points,
    };
  });
  const bodies = rows.b.map((row): SeenBody => {
    const points = Object.fromEntries(BODY_POINTS.map((name, k) => [name, { ...at(row, 1 + 3 * k), visible: (row[3 + 3 * k] ?? 0) >= 50 }])) as SeenBody["points"];
    const shoulders = points.left_shoulder.visible && points.right_shoulder.visible ? mid(points.left_shoulder, points.right_shoulder) : points.nose;
    return { id: row[0]!, ...round(shoulders), points };
  });
  return { hands, faces, bodies };
}

/** A shot a composition lays (Footage) with what was tracked in it: its span (frames from the composition's start) and how it is drawn. */
export type TrackedShot = { from: number; durationInFrames: number; track?: Omit<TrackPiece, "at" | "length"> };

/**
 * The `track` a scene is given: what was seen at one of its frames, in px of the frame. Over
 * her footage (an animation over a passage, an animation over several shots), the piece
 * playing at that frame; `shiftY`: how far the render moves the scene down (its own coordinates
 * are before that move). In a composition, the shot named by `box`, placed in that box.
 * Nothing tracked (a photo, a reused scene, no one in the picture): empty lists.
 */
export function footageTrack(
  pieces: TrackPiece[] | undefined,
  theme: Theme,
  size: { width: number; height: number },
  options: { shiftY?: number; shots?: TrackedShot[] } = {},
): TrackFn {
  if (!pieces?.length && !options.shots?.some((s) => s.track)) return trackNothing;
  const memo = new Map<string, Seen>();
  return (frame, box) => {
    if (!Number.isFinite(frame)) return NOTHING_SEEN;
    const key = box ? `${frame}|${box.shot}|${box.left}|${box.top}|${box.width}|${box.height}` : String(frame);
    const known = memo.get(key);
    if (known) return known;
    let seen = NOTHING_SEEN;
    if (box) {
      const shot = options.shots?.[box.shot];
      if (shot?.track && box.width > 0 && box.height > 0) {
        // A shot plays during its moment and holds its nearest image before and after (Footage).
        const t = Math.max(0, Math.min(shot.durationInFrames - 1, frame - shot.from));
        const rows = rowsAt(shot.track.tracks, shot.track.startFrom + t * (shot.track.speed ?? 1));
        // Inside a composition the shot has no signature punch: only its own framing and camera move.
        const look = { ...shot.track.look, accent: undefined };
        if (rows) seen = seenOf(rows, (u, v) => {
          const p = picturePoint(u, v, look, t, shot.durationInFrames, theme, box.width, box.height);
          return { x: p.x + box.left, y: p.y + box.top };
        });
      }
    } else if (pieces?.length) {
      // The piece on top at that frame: the later one while two shots cross-fade.
      const piece = [...pieces].reverse().find((p) => frame >= p.at && frame < p.at + p.length);
      if (piece) {
        const t = frame - piece.at;
        const rows = rowsAt(piece.tracks, piece.startFrom + t * (piece.speed ?? 1));
        const shiftY = options.shiftY ?? 0;
        if (rows) seen = seenOf(rows, (u, v) => {
          const p = picturePoint(u, v, piece.look, t, piece.length, theme, size.width, size.height);
          return { x: p.x, y: p.y - shiftY };
        });
      }
    }
    if (memo.size > 240) memo.clear();
    memo.set(key, seen);
    return seen;
  };
}
