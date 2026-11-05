// What a composition reads on one of her shots besides its clear areas (apps/render/shot_read.py reads it before the
// render): where its sky ends (SkylineAt), where its lines run to (VanishingPoint), how bright the picture is under a
// box (LightUnder); and what her head does in it (HeadMoves, measured on what the tracker saw). Each is read on the
// passage's first image and placed where the Reel draws the shot at that frame: its framing, the camera's own move
// (read with it), the Reel's push or punch. Pure geometry, no React: the render, the live preview, the scene check and
// the tests read them the same way.
// (Types only from its siblings: the tests run it in Node, which resolves no import without its extension.)
import type { Affine } from "./clear";

/** A shot's readings (mirror of ShotReading in packages/agent/src/subject.ts). */
export type ShotReading = {
  motion?: number[];
  sky?: { share: number; profile: number[] };
  vanish?: { x: number; y: number; strength: number } | null;
  light?: { cols: number; rows: number; cells: string; mean: number; high: number };
};

/** Less sky than this share of the picture is no sky: SkylineAt gives null. */
export const SKY_LEAST = 0.01;

const apply = (p: Affine, u: number, v: number): [number, number] => [p.a * u + p.b * v + p.c, p.d * u + p.e * v + p.f];

/** How the camera moved the picture at image t of the passage (s, dx, dy), still without a move (as clear.ts's cameraAt). */
export function movedAt(motion: number[] | undefined, t: number): [number, number, number] {
  if (!motion || motion.length < 3) return [1, 0, 0];
  const i = Math.max(0, Math.min(Math.floor(motion.length / 3) - 1, Math.round(t))) * 3;
  const s = motion[i]!;
  return Number.isFinite(s) && s > 0 ? [s, motion[i + 1] ?? 0, motion[i + 2] ?? 0] : [1, 0, 0];
}

/** From shares of the passage's first image to px of the composition at image t: the camera's move, then where the Reel draws the shot (as clear.ts's withCamera). */
export function readingPlace(reading: ShotReading, place: Affine, t: number): Affine {
  const [s, dx, dy] = movedAt(reading.motion, t);
  // u' = s·u + ou, v' = s·v + ov.
  const ou = 0.5 - 0.5 * s + dx;
  const ov = 0.5 - 0.5 * s + dy;
  return { a: place.a * s, b: place.b * s, c: place.a * ou + place.b * ov + place.c, d: place.d * s, e: place.e * s, f: place.d * ou + place.e * ov + place.f };
}

/**
 * Where its sky ends between two x of the composition (px), at that image: the top of the highest thing standing under
 * it (a roof, a hill, her head; never a wire or a pole, which the reading leaves out), as a y in px; the top of the
 * picture where something reaches it; null when the shot has no sky or the span is off the picture.
 */
export function skylineIn(reading: ShotReading | undefined, place: Affine, from = -Infinity, to = Infinity): number | null {
  const sky = reading?.sky;
  if (!sky || !(sky.share >= SKY_LEAST) || !sky.profile.length) return null;
  const n = sky.profile.length;
  let best: number | null = null;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const [x, y] = apply(place, u, Math.max(0, Math.min(1, sky.profile[i]!)));
    if (x < Math.min(from, to) || x > Math.max(from, to)) continue;
    if (best === null || y < best) best = y;
  }
  return best;
}

/** Where its lines run to at that image (px), or null when they run nowhere (or less surely than `least`, 0 to 1). */
export function vanishIn(reading: ShotReading | undefined, place: Affine, least = 0): { x: number; y: number } | null {
  const v = reading?.vanish;
  if (!v || !(v.strength >= least)) return null;
  const [x, y] = apply(place, v.x, v.y);
  return { x, y };
}

/**
 * How bright the picture is under a box of the composition (px) at that image, over the passage: the mean light of the
 * cells of its grid whose middle falls in the box (0 dark to 1 white) and of its brightest tenth; the whole picture as
 * laid without a box. Null when the shot was not read or no cell falls there.
 */
export function lightIn(reading: ShotReading | undefined, place: Affine, box?: { x: number; y: number; w: number; h: number } | null, laid?: { left: number; top: number; width: number; height: number }): { mean: number; high: number } | null {
  const l = reading?.light;
  if (!l || l.cells.length !== l.cols * l.rows * 2) return null;
  const inside = (x: number, y: number) =>
    box ? x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h : laid ? x >= laid.left && x <= laid.left + laid.width && y >= laid.top && y <= laid.top + laid.height : true;
  const values: number[] = [];
  for (let r = 0; r < l.rows; r++) {
    for (let c = 0; c < l.cols; c++) {
      const [x, y] = apply(place, (c + 0.5) / l.cols, (r + 0.5) / l.rows);
      if (!inside(x, y)) continue;
      const k = (r * l.cols + c) * 2;
      values.push(parseInt(l.cells.slice(k, k + 2), 16) / 255);
    }
  }
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const top = values.slice(Math.floor(values.length * 0.9));
  return { mean: Math.round(mean * 1000) / 1000, high: Math.round((top.reduce((s, v) => s + v, 0) / top.length) * 1000) / 1000 };
}

// ——— What her head does: lowered, raised, turned (mirror of headMoves in packages/agent/src/tracking.ts) ————————————

/** A move of a head, in frames of what was read (from its first image), and what it is. */
export type HeadMove = { from: number; to: number; what: "down" | "up" | "left" | "right" };

/** Images per second of the tracks. */
const TRACK_FPS = 30;
/** A head lowers or raises when its nose moves this much of its ears' gap down or up against them within HEAD_WITHIN s; it turns when its nose crosses this much of it sideways. */
const NOD = 0.22;
const TURN = 0.35;
const HEAD_WITHIN = 0.8;
/** The most moves told for one shot. */
const MAX_HEAD_MOVES = 12;

type HeadSample = { frame: number; pitch: number; yaw: number };

/** The median of the values around each one (`radius` on each side): one image misread does not make a move. */
const smoothed = (values: number[], radius = 2) =>
  values.map((_, i) => {
    const window = values.slice(Math.max(0, i - radius), i + radius + 1).sort((a, b) => a - b);
    return window[Math.floor(window.length / 2)]!;
  });

/**
 * Each head's pose, image by image, from what the tracker saw (a tracks row: faces f = [id, x, y, w, h, right eye x y,
 * left eye, nose, mouth, right ear, left ear]; bodies b = [id, then 33 points of x, y, visibility]): how far its nose
 * sits below its ears (pitch, in its ears' gap: larger when it lowers) and to the side of them (yaw, signed: the picture's
 * right positive). A body's head when it faces the camera, else the face's own points.
 */
function headSeries(frames: { f?: number[][]; b?: number[][] }[], aspect: number): HeadSample[][] {
  const byId = new Map<string, HeadSample[]>();
  frames.forEach((row, frame) => {
    for (const b of row.b ?? []) {
      const p = (k: number) => ({ x: ((b[1 + 3 * k] ?? 0) / 1000) * aspect, y: (b[2 + 3 * k] ?? 0) / 1000, v: (b[3 + 3 * k] ?? 0) / 100 });
      const [nose, leftEar, rightEar] = [p(0), p(7), p(8)];
      if (Math.min(nose.v, leftEar.v, rightEar.v) < 0.5) continue;
      const gap = Math.hypot(leftEar.x - rightEar.x, leftEar.y - rightEar.y);
      if (gap <= 0.005) continue;
      const list = byId.get(`b${b[0]}`) ?? [];
      list.push({ frame, pitch: (nose.y - (leftEar.y + rightEar.y) / 2) / gap, yaw: (nose.x - (leftEar.x + rightEar.x) / 2) / gap });
      byId.set(`b${b[0]}`, list);
    }
    for (const f of row.f ?? []) {
      const p = (k: number) => ({ x: ((f[5 + 2 * k] ?? 0) / 1000) * aspect, y: (f[6 + 2 * k] ?? 0) / 1000 });
      const [nose, rightEar, leftEar] = [p(2), p(4), p(5)];
      const gap = Math.hypot(leftEar.x - rightEar.x, leftEar.y - rightEar.y);
      if (f.length < 17 || !(gap > 0.005)) continue;
      const list = byId.get(`f${f[0]}`) ?? [];
      list.push({ frame, pitch: (nose.y - (leftEar.y + rightEar.y) / 2) / gap, yaw: (nose.x - (leftEar.x + rightEar.x) / 2) / gap });
      byId.set(`f${f[0]}`, list);
    }
  });
  // A body's head and the face found on it are the same head: the body's first (its ears stay seen when it turns).
  return [...byId.entries()].sort((a, b) => (a[0][0] === b[0][0] ? b[1].length - a[1].length : a[0][0] === "b" ? -1 : 1)).map(([, list]) => list);
}

/**
 * What the heads do in a passage's tracks, measured on their points: lowered (its nose drops against its ears), raised,
 * turned toward the picture's left or right; in frames from the first image of the tracks given, in order, one head at a
 * time (the one seen longest first), a move told once even when two ids saw it.
 */
export function headMovesOf(frames: { f?: number[][]; b?: number[][] }[], aspect: number, fps = TRACK_FPS): HeadMove[] {
  const within = Math.round(fps * HEAD_WITHIN);
  const out: HeadMove[] = [];
  for (const samples of headSeries(frames, aspect)) {
    if (samples.length < 6) continue;
    const pitch = smoothed(samples.map((s) => s.pitch));
    const yaw = smoothed(samples.map((s) => s.yaw));
    for (let i = 0; i < samples.length; ) {
      let found = false;
      for (let j = i + 1; j < samples.length && samples[j]!.frame - samples[i]!.frame <= within; j++) {
        const dp = pitch[j]! - pitch[i]!;
        const dy = yaw[j]! - yaw[i]!;
        const what: HeadMove["what"] | null = Math.abs(dy) >= TURN && Math.abs(dy) >= Math.abs(dp) ? (dy > 0 ? "right" : "left") : Math.abs(dp) >= NOD ? (dp > 0 ? "down" : "up") : null;
        if (!what) continue;
        // From where it starts moving (the last image still about where it was), to where it stops moving that way.
        const series = what === "down" || what === "up" ? pitch : yaw;
        const least = (what === "down" || what === "up" ? NOD : TURN) / 4;
        let s = j;
        while (s > i && Math.abs(series[s - 1]! - series[i]!) > least) s--;
        let k = j;
        const step = (a: number, b: number) => (what === "down" ? pitch[b]! - pitch[a]! : what === "up" ? pitch[a]! - pitch[b]! : what === "right" ? yaw[b]! - yaw[a]! : yaw[a]! - yaw[b]!);
        while (k + 1 < samples.length && samples[k + 1]!.frame - samples[k]!.frame <= 3 && step(k, k + 1) > 0) k++;
        const move = { from: samples[Math.max(i, s - 1)]!.frame, to: samples[k]!.frame, what };
        if (!out.some((m) => m.what === move.what && m.from <= move.to && move.from <= m.to)) out.push(move);
        i = k + 1;
        found = true;
        break;
      }
      if (!found) i++;
    }
  }
  return out.sort((a, b) => a.from - b.from).slice(0, MAX_HEAD_MOVES);
}

/** A shot as HeadMoves reads it: where it starts in the composition, how long, what was tracked in it and how it plays (from the clip's image startFrom, at its speed). */
export type TrackedShot = {
  from: number;
  durationInFrames: number;
  track?: { startFrom: number; speed?: number; tracks: { fps: number; from: number; aspect: number; frames: { f?: number[][]; b?: number[][] }[] } };
};

/** What the heads do in a shot, in frames of the composition (the clip's images it plays, at its speed, from its moment), only while it plays. */
export function shotHeadMoves(shot: TrackedShot | undefined): HeadMove[] {
  const t = shot?.track;
  if (!shot || !t?.tracks.frames.length) return [];
  const speed = t.speed ?? 1;
  return headMovesOf(t.tracks.frames, t.tracks.aspect, t.tracks.fps).flatMap((m) => {
    // A frame of the tracks → the clip's frame → the shot's own frame → the composition's.
    const at = (k: number) => shot.from + Math.round((t.tracks.from + k - t.startFrom) / speed);
    const from = Math.max(shot.from, at(m.from));
    const to = Math.min(shot.from + shot.durationInFrames - 1, at(m.to));
    return to >= from ? [{ from, to, what: m.what }] : [];
  });
}
