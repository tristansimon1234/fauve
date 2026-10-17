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

/** A clip's tracks by media id. */
export type TracksByClip = Record<string, TracksFile>;

/** The models that read the tracks: a clip read by others is read again. */
export const TRACK_MODEL = "mediapipe-1.1.1";

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
      const speed = segment.speed ?? 1;
      const first = Math.max(0, from - segment.startAt);
      const last = Math.min(segment.durationInFrames, from + length - segment.startAt);
      const sliced = sliceTracks(file, segment.startFrom + Math.floor(first * speed), segment.startFrom + Math.ceil(last * speed) + 2);
      if (!sliced) return [];
      return [
        {
          at: segment.startAt - from,
          length: segment.durationInFrames,
          startFrom: segment.startFrom,
          ...(segment.speed ? { speed: segment.speed } : {}),
          look: clipLook(segment, file),
          tracks: sliced,
          clip: s.clip_id,
        },
      ];
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
  const px = look.focus && framed ? at(look.focus.x, framed / frameAspect) : 0.5;
  const py = look.focus && framed ? at(look.focus.y, frameAspect / framed) : 0.5;
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

const words = (list: [number, number][]) => list.map(([a, b]) => (a === b ? `image ${a}` : `images ${a} à ${b}`)).join(", ");

export type DesignerMoves = {
  gestes?: { de: number; a: number; quoi: string }[];
  mains?: { id: number; vue: string; trajet?: { image: number; paume: [number, number]; pouce: [number, number]; index: [number, number]; taille: number }[] }[];
  visages?: { id: number; vu: string; boites?: { image: number; centre: [number, number]; largeur: number; hauteur: number }[] }[];
  corps?: { id: number; vu: string; reperes?: { image: number; tete: [number, number]; epaules?: [[number, number], [number, number]]; poignets?: [number, number][] }[] }[];
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
  const mains = [...handSpans.entries()].slice(0, 6).map(([id, list]) => ({
    id,
    vue: words(list),
    trajet: !positions ? undefined : fine.flatMap((s) => {
      const row = s.rows.h.find((r) => r[0] === id);
      if (!row) return [];
      const wrist = place(s.piece, row, 1);
      const middle = place(s.piece, row, 1 + 2 * 9);
      const palm = [0, 5, 9, 13, 17].map((p) => place(s.piece, row, 1 + 2 * p));
      return [
        {
          image: s.frame,
          paume: [Math.round(palm.reduce((a, p) => a + p[0], 0) / 5), Math.round(palm.reduce((a, p) => a + p[1], 0) / 5)] as [number, number],
          pouce: place(s.piece, row, 1 + 2 * 4),
          index: place(s.piece, row, 1 + 2 * 8),
          taille: Math.round(2 * Math.hypot(middle[0] - wrist[0], middle[1] - wrist[1])),
        },
      ];
    }),
  }));
  const faceSpans = spans(coarse.flatMap((s) => s.rows.f.map((r) => ({ id: r[0]!, frame: s.frame }))), 15);
  const visages = [...faceSpans.entries()].slice(0, 4).map(([id, list]) => ({
    id,
    vu: words(list),
    boites: !positions ? undefined : coarse.flatMap((s) => {
      const row = s.rows.f.find((r) => r[0] === id);
      if (!row) return [];
      const a = place(s.piece, row, 1);
      const b = shownAt(((row[1] ?? 0) + (row[3] ?? 0)) / 1000, ((row[2] ?? 0) + (row[4] ?? 0)) / 1000, s.piece.look, size.width, size.height);
      return [{ image: s.frame, centre: [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)] as [number, number], largeur: Math.abs(b[0] - a[0]), hauteur: Math.abs(b[1] - a[1]) }];
    }),
  }));
  const bodySpans = spans(coarse.flatMap((s) => s.rows.b.map((r) => ({ id: r[0]!, frame: s.frame }))), 15);
  const corps = [...bodySpans.entries()].slice(0, 3).map(([id, list]) => ({
    id,
    vu: words(list),
    reperes: !positions ? undefined : coarse.flatMap((s) => {
      const row = s.rows.b.find((r) => r[0] === id);
      if (!row) return [];
      const seen = (k: number) => (row[3 + 3 * k] ?? 0) >= 50;
      const point = (k: number) => place(s.piece, row, 1 + 3 * k);
      return [
        {
          image: s.frame,
          tete: point(0),
          ...(seen(11) && seen(12) ? { epaules: [point(11), point(12)] as [[number, number], [number, number]] } : {}),
          ...(seen(15) || seen(16) ? { poignets: [15, 16].filter(seen).map(point) } : {}),
        },
      ];
    }),
  }));
  // The gestures Gemini saw in these passages, on the scene's frames.
  const gestes = pieces.flatMap((p) =>
    (p.clip ? (actions[p.clip] ?? []) : []).flatMap((a) => {
      const de = Math.round(p.at + (a.start * TRACK_FPS - p.startFrom) / (p.speed ?? 1));
      const fin = Math.round(p.at + (a.end * TRACK_FPS - p.startFrom) / (p.speed ?? 1));
      const from = Math.max(de, p.at, 0);
      const to = Math.min(fin, p.at + p.length - 1, length - 1);
      return to >= from ? [{ de: from, a: to, quoi: a.what }] : [];
    }),
  );
  if (!mains.length && !visages.length && !corps.length && !gestes.length) return null;
  return {
    ...(gestes.length ? { gestes } : {}),
    ...(mains.length ? { mains } : {}),
    ...(visages.length ? { visages } : {}),
    ...(corps.length ? { corps } : {}),
  };
}
