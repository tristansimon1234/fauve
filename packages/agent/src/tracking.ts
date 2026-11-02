import { z } from "zod";
import { isClipSegment, isMotionSegment, type CameraMove, type ClipAnalysis, type EditPlan } from "./schemas.ts";
import type { ReelSegment } from "./motion.ts";

// What moves in her videos: hands (21 points each, fingertips included), faces and bodies,
// image by image, read once per clip by apps/render/track.py in the cut-out sandbox. Here it is
// cut to the passages a Reel plays under its animations (the render places it exactly as it
// draws the footage, apps/render/src/track.ts, and an animation reads it with `track(frame)`),
// and summed up for the motion designer. Nothing here names a gesture or an effect: it says
// where things are, an animation decides what to do with it.

/** Images per second of the tracks: the Reel's, the grid the render plays the clips on. */
const TRACK_FPS = 30;

/** A clip's tracks, as track.py writes them: per image, hands h, faces f, bodies b, in thousandths of the picture (body visibility in hundredths). */
export const tracksFileSchema = z.object({
  v: z.number().optional(),
  fps: z.number().positive(),
  w: z.number().positive(),
  h: z.number().positive(),
  from: z.number().int().min(0),
  n: z.number().int().min(0),
  frames: z.array(
    z.object({
      h: z.array(z.array(z.number())).optional(),
      f: z.array(z.array(z.number())).optional(),
      b: z.array(z.array(z.number())).optional(),
    }),
  ),
});
export type TracksFile = z.infer<typeof tracksFileSchema>;

/** The tracks of a passage, as the render reads them (mirror of apps/render/src/track.ts). */
export type FootageTracks = { fps: number; from: number; aspect: number; frames: TracksFile["frames"] };
/**
 * How a passage is drawn: its real shape (it covers the frame), its subject kept in the crop
 * (framed with the shape the Reel was given, `framingAspect`), straightened, its camera move,
 * its punch (mirror).
 */
export type FootageLook = {
  aspect: number;
  framingAspect?: number;
  focus?: { x: number; y: number };
  /** The faces seen in the passage (shares of the picture): a box narrower than the shot keeps them whole (faceFocus). */
  face?: FaceZone;
  straighten?: number;
  move?: CameraMove;
  accent?: "punch" | "wipe";
};
/**
 * A piece of footage under an animation: its shot starts at scene frame `at` and lasts `length`
 * frames, the clip's image `startFrom` at `at`, played at `speed`, drawn with `look` (mirror).
 * `clip`: its media id, for the designer's summary (the render does not read it).
 */
export type TrackPiece = { at: number; length: number; startFrom: number; speed?: number; look: FootageLook; tracks: FootageTracks; clip?: string };
/** What was tracked in a shot a composition lays, and how it is drawn. */
export type ShotTrack = Omit<TrackPiece, "at" | "length">;

/** Where the faces of a passage are, in shares of the picture, with room for the hair and the chin. */
export type FaceZone = { x: number; y: number; w: number; h: number };

/** The tracker's face box is tight: the hair above it, the chin below it, a little on its sides (shares of the face's size). */
const FACE_ROOM = { above: 0.45, below: 0.25, sides: 0.2 };

/** Every face tracked in a clip over [from, from + seconds] (its seconds), as one zone; null when none was. */
export function faceZone(file: TracksFile, from: number, seconds: number): FaceZone | null {
  const first = Math.max(0, Math.floor(from * file.fps) - file.from);
  const end = Math.min(file.frames.length, Math.ceil((from + seconds) * file.fps) - file.from);
  let zone: { x0: number; y0: number; x1: number; y1: number } | null = null;
  for (let k = first; k < end; k++) {
    for (const [id, x, y, w, h] of file.frames[k]?.f ?? []) {
      if (id === undefined || x === undefined || y === undefined || !w || !h) continue;
      const box = { x0: x - w * FACE_ROOM.sides, y0: y - h * FACE_ROOM.above, x1: x + w * (1 + FACE_ROOM.sides), y1: y + h * (1 + FACE_ROOM.below) };
      zone = zone ? { x0: Math.min(zone.x0, box.x0), y0: Math.min(zone.y0, box.y0), x1: Math.max(zone.x1, box.x1), y1: Math.max(zone.y1, box.y1) } : box;
    }
  }
  if (!zone) return null;
  const share = (v: number) => Math.round(Math.min(1000, Math.max(0, v))) / 1000;
  const x = share(zone.x0);
  const y = share(zone.y0);
  return { x, y, w: share(zone.x1) - x, h: share(zone.y1) - y };
}

/**
 * Where to centre a shot in a box of `frameAspect` (shares of the picture, as `focus`) so that the
 * faces of `face` stay whole: the subject's centre as it is when they already are, else moved just
 * enough, the top of the heads first when they cannot all fit. A shot of someone laid in a wide box
 * (half of a split screen) was framed on the middle of their body: their head was cut at the nose.
 * Mirror of apps/render/src/track.ts.
 */
export function faceFocus(focus: { x: number; y: number } | undefined, face: FaceZone | undefined, aspect: number | undefined, frameAspect: number): { x: number; y: number } | undefined {
  if (!face || !aspect) return focus;
  const keep = (centre: number, start: number, size: number, shown: number) => {
    if (shown >= 1) return centre;
    let top = centre - shown / 2;
    if (start < top) top = start - 0.02;
    if (start + size > top + shown) top = Math.min(start - 0.02, start + size - shown);
    return Math.round((top + shown / 2) * 1000) / 1000;
  };
  const centre = focus ?? { x: face.x + face.w / 2, y: face.y + face.h / 2 };
  return { x: keep(centre.x, face.x, face.w, frameAspect / aspect), y: keep(centre.y, face.y, face.h, aspect / frameAspect) };
}

/** A clip's tracks by media id. */
export type TracksByClip = Record<string, TracksFile>;

/** The models that read the tracks, and how we read them: a clip read otherwise is read again (r2: a body's head is a face only when it faces the camera). */
export const TRACK_MODEL = "mediapipe-1.1.1-r2";

/** What is kept on a video (media_assets.tracks): its tracks file in Storage and what was found, or why it failed. */
export const mediaTracksSchema = z.union([
  z.object({
    path: z.string(),
    frames: z.number().int().min(0),
    hands: z.number().int().min(0),
    faces: z.number().int().min(0),
    bodies: z.number().int().min(0),
    model: z.string(),
    at: z.string(),
  }),
  z.object({ failed_at: z.string(), error: z.string().optional(), model: z.string() }),
]);
export type MediaTracks = z.infer<typeof mediaTracksSchema>;

/**
 * Whether a clip is worth following: someone is in it (a face, a gesture Gemini noted, hands
 * at work). A plate, a shop window or a product alone has nothing to follow.
 */
export function trackWorthy(analysis: Pick<ClipAnalysis, "shots" | "actions">): boolean {
  if (analysis.actions?.length) return true;
  return analysis.shots.some((s) => s.faces_visible || /\b(mains?|personnes?|gens|client|cliente|clients|équipe|groupe|élèves?)\b/i.test(s.subject));
}

/** The clips an animation of the plan plays over: under its scenes, and every shot when animations run over the montage. */
export function clipsUnderAnimations(plan: Pick<EditPlan, "segments" | "layers">): string[] {
  const under = plan.segments.flatMap((s) => (isMotionSegment(s) && s.over ? [s.over.clip_id] : []));
  const shots = plan.layers?.length ? plan.segments.flatMap((s) => (isClipSegment(s) ? [s.clip_id] : [])) : [];
  return [...new Set([...under, ...shots])];
}

/** The passage [from, to) of a clip's tracks (its images at the tracks' rate); none when nothing is seen in it. */
export function sliceTracks(file: TracksFile, from: number, to: number): FootageTracks | null {
  const start = Math.max(file.from, Math.floor(from));
  const end = Math.min(file.from + file.frames.length, Math.ceil(to));
  if (end <= start) return null;
  const frames = file.frames.slice(start - file.from, end - file.from);
  if (!frames.some((f) => f.h?.length || f.f?.length || f.b?.length)) return null;
  return { fps: file.fps, from: start, aspect: file.w / file.h, frames };
}

type ClipShot = Extract<ReelSegment, { type: "clip" }>;

/** How the Reel draws a clip's shot (Reel.tsx: Shot inside Accent): the render frames on the subject only when it knows the clip's shape. */
function clipLook(segment: ClipShot, file: TracksFile): FootageLook {
  const move = segment.move ?? (segment.zoom ? "in" : "none");
  return {
    aspect: file.w / file.h,
    ...(segment.aspect && segment.adjust?.focus ? { framingAspect: segment.aspect, focus: segment.adjust.focus } : {}),
    ...(segment.adjust?.straighten ? { straighten: segment.adjust.straighten } : {}),
    ...(move !== "none" ? { move } : {}),
    ...(segment.accent ? { accent: segment.accent } : {}),
  };
}

/**
 * The footage under the animation of segment `index`, as the Reel plays it (Under: her passage
 * from its first image, a slow push-in over the animation). `segments`: the Reel's, by index of the plan's.
 */
export function sceneTrack(plan: Pick<EditPlan, "segments">, segments: ReelSegment[], index: number, tracks: TracksByClip): TrackPiece[] {
  const s = plan.segments[index];
  const segment = segments[index];
  if (!s || !segment || !isMotionSegment(s) || !s.over || (segment.type !== "motion" && segment.type !== "scene") || segment.under?.type !== "clip") return [];
  const file = tracks[s.over.clip_id];
  if (!file) return [];
  const under = segment.under;
  const sliced = sliceTracks(file, under.startFrom, under.startFrom + segment.durationInFrames + 1);
  if (!sliced) return [];
  return [
    {
      at: 0,
      length: segment.durationInFrames,
      startFrom: under.startFrom,
      look: { aspect: file.w / file.h, ...(under.aspect && under.adjust?.focus ? { framingAspect: under.aspect, focus: under.adjust.focus } : {}), move: "in" },
      tracks: sliced,
      clip: s.over.clip_id,
    },
  ];
}

/** The shots under an animation over the montage (Reel frames from `from`, `length` frames), as the Reel plays them; an animation's own footage too. */
export function layerTrack(plan: Pick<EditPlan, "segments">, segments: ReelSegment[], from: number, length: number, tracks: TracksByClip): TrackPiece[] {
  return segments.flatMap((segment, i): TrackPiece[] => {
    if (segment.startAt >= from + length || segment.startAt + segment.durationInFrames <= from) return [];
    const s = plan.segments[i];
    if (segment.type === "clip" && s && isClipSegment(s)) {
      const file = tracks[s.clip_id];
      if (!file) return [];
      // A ramped shot is its passages at each speed, each a piece of its own.
      const passages = segment.ramp ?? [{ at: 0, length: segment.durationInFrames, startFrom: segment.startFrom, speed: segment.speed ?? 1 }];
      return passages.flatMap((p): TrackPiece[] => {
        const begin = segment.startAt + p.at;
        if (begin >= from + length || begin + p.length <= from) return [];
        const first = Math.max(0, from - begin);
        const last = Math.min(p.length, from + length - begin);
        const sliced = sliceTracks(file, p.startFrom + Math.floor(first * p.speed), p.startFrom + Math.ceil(last * p.speed) + 2);
        if (!sliced) return [];
        return [
          {
            at: begin - from,
            length: p.length,
            startFrom: p.startFrom,
            ...(p.speed !== 1 ? { speed: p.speed } : {}),
            look: clipLook(segment, file),
            tracks: sliced,
            clip: s.clip_id,
          },
        ];
      });
    }
    return sceneTrack(plan, segments, i, tracks).map((p) => ({ ...p, at: segment.startAt - from }));
  });
}

/** What was tracked in shot `index` when a composition lays it (a video only), and how it is drawn there (no punch inside a box). */
export function shotTrack(plan: Pick<EditPlan, "segments">, segments: ReelSegment[], index: number, tracks: TracksByClip): ShotTrack | undefined {
  const s = plan.segments[index];
  const segment = segments[index];
  if (!s || !segment || segment.type !== "clip" || !isClipSegment(s)) return undefined;
  const file = tracks[s.clip_id];
  if (!file) return undefined;
  const sliced = sliceTracks(file, segment.startFrom, segment.startFrom + Math.ceil(segment.durationInFrames * (segment.speed ?? 1)) + 2);
  if (!sliced) return undefined;
  const { accent: _accent, ...look } = clipLook(segment, file);
  return { startFrom: segment.startFrom, ...(segment.speed ? { speed: segment.speed } : {}), look, tracks: sliced, clip: s.clip_id };
}

// ---------------------------------------------------------------------------
// What the hands do, measured: the tracker's points read over time. Gemini's reading of a clip
// can miss a gesture (Tristan spreads his thumb and index three times; it read « un cercle avec
// les doigts, une seule fois »); the points do not. General moves only, never an effect: the
// thumb and index that open and close, a pinch held, a hand that comes toward the camera or
// moves away, a hand that goes up, down or across.
// ---------------------------------------------------------------------------

/** A move of one hand, measured on the tracks, in seconds of the clip. */
export type HandMove = { start: number; end: number; what: string };

/** How open a hand is: the gap between the tips of its thumb and index over its size (twice wrist to middle knuckle); 0 pinched, about 1 spread wide. */
const PINCHED = 0.15;
/** A spread counts from this much more open than the pinch before it (a relaxed hand drifts by less). */
const SPREAD_RISE = 0.12;
/** A hand this much bigger (or smaller) within half a second comes toward the camera (or moves away). */
const APPROACH = 1.4;
/** A palm that crosses this share of the picture within 0.4 s goes up, down or across. */
const SWEEP = 0.22;
/** The most moves told for one clip. */
const MAX_HAND_MOVES = 16;

type HandSample = { frame: number; open: number; size: number; x: number; y: number };

/** The median of the values around each one (`radius` on each side): a blurred image does not make a move. */
function smooth(values: number[], radius = 2): number[] {
  return values.map((_, i) => {
    const window = values.slice(Math.max(0, i - radius), i + radius + 1).sort((a, b) => a - b);
    return window[Math.floor(window.length / 2)]!;
  });
}

/**
 * Each hand's samples by id: openness, size and palm (shares of the picture). A hand found twice
 * (a second id on the same hand, its palm on the other's most of the time they are both seen)
 * is left out: its fingers, fitted again, would tell moves the hand never made.
 */
function handSeries(t: Pick<FootageTracks, "frames" | "aspect">): HandSample[][] {
  const byId = new Map<number, HandSample[]>();
  t.frames.forEach((row, frame) => {
    for (const h of row.h ?? []) {
      const at = (k: number): [number, number] => [((h[1 + 2 * k] ?? 0) / 1000) * t.aspect, (h[2 + 2 * k] ?? 0) / 1000];
      const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const size = 2 * dist(at(0), at(9));
      if (size <= 0) continue;
      const palm = [0, 5, 9, 13, 17].map(at);
      const list = byId.get(h[0]!) ?? [];
      list.push({ frame, open: dist(at(4), at(8)) / size, size, x: palm.reduce((s, p) => s + p[0], 0) / 5 / t.aspect, y: palm.reduce((s, p) => s + p[1], 0) / 5 });
      byId.set(h[0]!, list);
    }
  });
  const hands = [...byId.values()].sort((a, b) => b.length - a.length);
  return hands.filter((hand, k) =>
    hands.slice(0, k).every((longer) => {
      const there = new Map(longer.map((s) => [s.frame, s]));
      const both = hand.filter((s) => there.has(s.frame));
      const close = both.filter((s) => Math.hypot(s.x - there.get(s.frame)!.x, s.y - there.get(s.frame)!.y) < 0.12);
      return both.length < hand.length / 2 || close.length < both.length * 0.6;
    }),
  );
}

/**
 * What each hand does in a clip's tracks (or a passage of them), measured on its points: its thumb
 * and index that spread from a pinch and close again (how wide), a pinch held a while, the hand
 * that comes toward the camera or moves away, that goes up, down or across. In seconds of the
 * clip, in order; one move a hand makes twice in a row is told twice.
 */
export function handMoves(t: Pick<FootageTracks, "fps" | "from" | "frames" | "aspect">): HandMove[] {
  const moves: (HandMove & { x: number; y: number })[] = [];
  const time = (frame: number) => Math.round(((t.from + frame) / t.fps) * 10) / 10;
  const near = Math.round(t.fps * 0.67);
  for (const samples of handSeries(t)) {
    if (samples.length < 6) continue;
    const open = smooth(samples.map((s) => s.open));
    const size = smooth(samples.map((s) => s.size));
    const at = (i: number) => samples[i]!;
    const add = (from: number, to: number, what: string) => moves.push({ start: time(at(from).frame), end: time(at(to).frame), what, x: at(to).x, y: at(to).y });
    // Thumb and index that spread from a pinch: a peak well over the pinch just before it (since
    // the last spread: the fall after a wide one is not a new one).
    let last = -1;
    for (let i = 0; i < open.length; i++) {
      const peak = open[i]!;
      const span = (lo: number, hi: number) => open.slice(Math.max(0, lo), Math.max(0, hi));
      if (span(i - 4, i + 5).some((v) => v > peak)) continue;
      if (i > 0 && open[i - 1] === peak) continue;
      const before = span(Math.max(last + 1, i - near), i);
      const after = span(i + 1, i + near + 1);
      const low = before.length ? Math.min(...before) : peak;
      if (low > PINCHED || peak - low < SPREAD_RISE) continue;
      const lowAfter = after.length ? Math.min(...after) : peak;
      const closes = peak - lowAfter >= SPREAD_RISE * 0.8;
      // From where it starts opening to where it is pinched again (or the hand leaves), across the time it stays open.
      let from = i;
      while (from > 0 && from > i - near && open[from - 1]! <= open[from]! && open[from - 1]! > low + 0.02) from--;
      let to = i;
      while (to < open.length - 1 && to < i + near && open[to + 1]! <= open[to]! && open[to + 1]! > lowAfter + 0.02) to++;
      const wide = peak >= 0.6 ? " grand" : peak < 0.3 ? " un peu" : "";
      add(Math.max(0, from - 1), Math.min(open.length - 1, to + (closes ? 1 : 0)), `le pouce et l'index s'écartent${wide}${closes ? " puis se referment" : " et restent ouverts"}`);
      last = i;
    }
    // A pinch held a second or more (something small held between the fingers, an « ok »).
    for (let i = 0; i < open.length; ) {
      if (open[i]! >= PINCHED) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < open.length && open[j + 1]! < PINCHED && at(j + 1).frame - at(j).frame <= 3) j++;
      if (at(j).frame - at(i).frame >= t.fps) add(i, j, "le pouce et l'index restent pincés");
      i = j + 1;
    }
    // Toward the camera or away, up, down or across: within half a second.
    for (let i = 0; i < samples.length; ) {
      let found = false;
      for (let j = i + 1; j < samples.length && at(j).frame - at(i).frame <= Math.round(t.fps * 0.5); j++) {
        const grow = size[j]! / size[i]!;
        const dx = at(j).x - at(i).x;
        const dy = at(j).y - at(i).y;
        const what =
          grow >= APPROACH
            ? "la main avance vers la caméra"
            : grow <= 1 / APPROACH
              ? "la main recule"
              : at(j).frame - at(i).frame <= Math.round(t.fps * 0.4) && Math.hypot(dx, dy) >= SWEEP
                ? Math.abs(dy) >= Math.abs(dx)
                  ? dy < 0
                    ? "la main monte"
                    : "la main descend"
                  : `la main part vers la ${dx > 0 ? "droite" : "gauche"} de l'image`
                : null;
        if (!what) continue;
        add(i, j, what);
        i = j + 1;
        found = true;
        break;
      }
      if (!found) i++;
    }
  }
  // One move seen on two ids of the same hand (a hand found twice) is told once.
  const told = moves
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .filter((m, k, list) => !list.slice(0, k).some((o) => o.what === m.what && o.end >= m.start && Math.hypot(o.x - m.x, o.y - m.y) < 0.2));
  return told.slice(0, MAX_HAND_MOVES).map(({ start, end, what }) => ({ start, end: Math.max(end, Math.round((start + 0.1) * 10) / 10), what }));
}

// ---------------------------------------------------------------------------
// The motion designer's summary: where things are, now and then, and the gestures Gemini saw.
// ---------------------------------------------------------------------------

/** Where a point of the picture shows in the frame, about (cover, framed on the subject, straightened; the slow camera moves left aside). */
function shownAt(u: number, v: number, look: FootageLook, width: number, height: number): [number, number] {
  const frameAspect = width / height;
  const wide = look.aspect > frameAspect;
  const w = wide ? height * look.aspect : width;
  const h = wide ? height : width / look.aspect;
  // object-position from the subject, as the render frames it (framingPercent).
  const at = (f: number, ratio: number) => (ratio <= 1.001 ? 0.5 : Math.min(1, Math.max(0, (f * ratio - 0.5) / (ratio - 1))));
  const framed = look.framingAspect;
  const focus = faceFocus(look.focus, look.face, framed, frameAspect);
  const px = focus && framed ? at(focus.x, framed / frameAspect) : 0.5;
  const py = focus && framed ? at(focus.y, frameAspect / framed) : 0.5;
  let x = (width - w) * px + u * w;
  let y = (height - h) * py + v * h;
  if (look.straighten) {
    const a = (look.straighten * Math.PI) / 180;
    const r = Math.abs(a);
    const k = Math.max(Math.cos(r) + Math.sin(r) / frameAspect, Math.cos(r) + Math.sin(r) * frameAspect);
    const dx = x - width / 2;
    const dy = y - height / 2;
    x = width / 2 + k * (dx * Math.cos(a) - dy * Math.sin(a));
    y = height / 2 + k * (dx * Math.sin(a) + dy * Math.cos(a));
  }
  return [Math.round(x), Math.round(y)];
}

type Sample = { frame: number; rows: Required<TracksFile["frames"][number]>; piece: TrackPiece };

/** What was read at each sampled frame of the scene (the nearest tracked image of the piece playing). */
function samples(pieces: TrackPiece[], length: number, step: number): Sample[] {
  const out: Sample[] = [];
  for (let frame = 0; frame < length; frame += step) {
    const piece = [...pieces].reverse().find((p) => frame >= p.at && frame < p.at + p.length);
    if (!piece) continue;
    const k = Math.round(piece.startFrom + (frame - piece.at) * (piece.speed ?? 1)) - piece.tracks.from;
    const row = piece.tracks.frames[k];
    if (!row) continue;
    out.push({ frame, rows: { h: row.h ?? [], f: row.f ?? [], b: row.b ?? [] }, piece });
  }
  return out;
}

/** The spans of frames (from, to) where each id is seen, from the sampled frames. */
function spans(seen: { id: number; frame: number }[], step: number): Map<number, [number, number][]> {
  const byId = new Map<number, [number, number][]>();
  for (const { id, frame } of seen) {
    const list = byId.get(id) ?? [];
    const last = list.at(-1);
    if (last && frame - last[1] <= step) last[1] = frame;
    else list.push([frame, frame]);
    byId.set(id, list);
  }
  return byId;
}

const words = (list: [number, number][]) => list.map(([a, b]) => (a === b ? `frame ${a}` : `frames ${a} to ${b}`)).join(", ");

export type DesignerMoves = {
  gestures?: { from: number; to: number; what: string }[];
  /** What the hands do, measured on their points (handMoves): surer than the gestures read. */
  measured_gestures?: { from: number; to: number; what: string }[];
  hands?: { id: number; seen: string; path?: { frame: number; palm: [number, number]; thumb: [number, number]; index: [number, number]; size: number }[] }[];
  faces?: { id: number; seen: string; boxes?: { frame: number; centre: [number, number]; width: number; height: number }[] }[];
  bodies?: { id: number; seen: string; points?: { frame: number; head: [number, number]; shoulders?: [[number, number], [number, number]]; wrists?: [number, number][] }[] }[];
};

/**
 * For the motion designer: what moves under its animation, now and then, in px of the frame
 * (its code reads the real places at every frame with `track`), and the gestures Gemini saw,
 * on the scene's frames. `positions` false: only when each thing is seen (a composition, which
 * lays the shot in a box of its own). Null when nothing was tracked.
 */
export function movesForDesigner(
  pieces: TrackPiece[],
  length: number,
  actions: Record<string, ClipAnalysis["actions"]> = {},
  { size = { width: 1080, height: 1920 }, positions = true }: { size?: { width: number; height: number }; positions?: boolean } = {},
): DesignerMoves | null {
  if (!pieces.length) return null;
  const place = (piece: TrackPiece, row: number[], k: number) => shownAt((row[k] ?? 0) / 1000, (row[k + 1] ?? 0) / 1000, piece.look, size.width, size.height);
  // Hands move fast: every 5th frame; faces and bodies: every 15th.
  const fine = samples(pieces, length, 5);
  const coarse = samples(pieces, length, 15);
  const handSpans = spans(fine.flatMap((s) => s.rows.h.map((r) => ({ id: r[0]!, frame: s.frame }))), 5);
  const hands = [...handSpans.entries()].slice(0, 6).map(([id, list]) => ({
    id,
    seen: words(list),
    path: !positions ? undefined : fine.flatMap((s) => {
      const row = s.rows.h.find((r) => r[0] === id);
      if (!row) return [];
      const wrist = place(s.piece, row, 1);
      const middle = place(s.piece, row, 1 + 2 * 9);
      const palm = [0, 5, 9, 13, 17].map((p) => place(s.piece, row, 1 + 2 * p));
      return [
        {
          frame: s.frame,
          palm: [Math.round(palm.reduce((a, p) => a + p[0], 0) / 5), Math.round(palm.reduce((a, p) => a + p[1], 0) / 5)] as [number, number],
          thumb: place(s.piece, row, 1 + 2 * 4),
          index: place(s.piece, row, 1 + 2 * 8),
          size: Math.round(2 * Math.hypot(middle[0] - wrist[0], middle[1] - wrist[1])),
        },
      ];
    }),
  }));
  const faceSpans = spans(coarse.flatMap((s) => s.rows.f.map((r) => ({ id: r[0]!, frame: s.frame }))), 15);
  const faces = [...faceSpans.entries()].slice(0, 4).map(([id, list]) => ({
    id,
    seen: words(list),
    boxes: !positions ? undefined : coarse.flatMap((s) => {
      const row = s.rows.f.find((r) => r[0] === id);
      if (!row) return [];
      const a = place(s.piece, row, 1);
      const b = shownAt(((row[1] ?? 0) + (row[3] ?? 0)) / 1000, ((row[2] ?? 0) + (row[4] ?? 0)) / 1000, s.piece.look, size.width, size.height);
      return [{ frame: s.frame, centre: [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)] as [number, number], width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]) }];
    }),
  }));
  const bodySpans = spans(coarse.flatMap((s) => s.rows.b.map((r) => ({ id: r[0]!, frame: s.frame }))), 15);
  const bodies = [...bodySpans.entries()].slice(0, 3).map(([id, list]) => ({
    id,
    seen: words(list),
    points: !positions ? undefined : coarse.flatMap((s) => {
      const row = s.rows.b.find((r) => r[0] === id);
      if (!row) return [];
      const seen = (k: number) => (row[3 + 3 * k] ?? 0) >= 50;
      const point = (k: number) => place(s.piece, row, 1 + 3 * k);
      return [
        {
          frame: s.frame,
          head: point(0),
          ...(seen(11) && seen(12) ? { shoulders: [point(11), point(12)] as [[number, number], [number, number]] } : {}),
          ...(seen(15) || seen(16) ? { wrists: [15, 16].filter(seen).map(point) } : {}),
        },
      ];
    }),
  }));
  // A move of the clip (seconds), on the scene's frames, cut to the piece that plays it.
  const onScene = (p: TrackPiece, m: { start: number; end: number; what: string }) => {
    const start = Math.round(p.at + (m.start * TRACK_FPS - p.startFrom) / (p.speed ?? 1));
    const end = Math.round(p.at + (m.end * TRACK_FPS - p.startFrom) / (p.speed ?? 1));
    const from = Math.max(start, p.at, 0);
    const to = Math.min(end, p.at + p.length - 1, length - 1);
    return to >= from ? [{ from, to, what: m.what }] : [];
  };
  // The gestures Gemini saw in these passages, and what the hands do there, measured on their points.
  const gestures = pieces.flatMap((p) => (p.clip ? (actions[p.clip] ?? []) : []).flatMap((a) => onScene(p, a)));
  const measured_gestures = pieces.flatMap((p) => handMoves(p.tracks).flatMap((m) => onScene(p, m)));
  if (!hands.length && !faces.length && !bodies.length && !gestures.length && !measured_gestures.length) return null;
  return {
    ...(gestures.length ? { gestures } : {}),
    ...(measured_gestures.length ? { measured_gestures } : {}),
    ...(hands.length ? { hands } : {}),
    ...(faces.length ? { faces } : {}),
    ...(bodies.length ? { bodies } : {}),
  };
}
