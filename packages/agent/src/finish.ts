import { avoidPhotoText, boxFrom2d, headZone, photoBoxInFrame, photoEditFrom, reelSubtitleRow, SUBTITLE_ROW, type Adjust, type Box, type PhotoDetection, type PhotoEdit } from "./retouch.ts";
import { planTimeline } from "./motion.ts";
import { isClipSegment, isMotionSegment, RAMP_EASE, segmentSeconds, type CameraMove, type ClipAnalysis, type ClipSegment, type EditPlan, type PlanSegment } from "./schemas.ts";
import { handMoves, type TracksByClip, type TracksFile } from "./tracking.ts";

// The finishing touches a professional editor gives every cut, decided by the engine from
// what Gemini read in her photos and videos (never left to chance, never written by the
// model): each clip's light and colour corrected when it needs it and straightened when it
// leans, the vertical crop framed on its subject, a slow camera move on a shot that was
// filmed still, her footage under every animation, and texts kept off faces and off the
// lettering already in a picture.

export type PhotoFacts = { width: number; height: number; detection: PhotoDetection };
export type MediaFacts = {
  /** Video analyses by media_id. */
  clips: Record<string, ClipAnalysis>;
  /** Photo readings by media_id. */
  photos: Record<string, PhotoFacts>;
  /** What was tracked in her videos, by media_id: where the faces really are, image by image. */
  tracks?: TracksByClip;
};

/** The tracker's face box is tight: a text keeps off the hair above it, the chin below it and a little on its sides (shares of the face's size). */
const FACE_PAD = { above: 0.35, below: 0.2, sides: 0.15 };
/** The most a shot is zoomed in a Reel (a punch, a slow push): a zone spreads out about the centre. */
const SHOT_ZOOM = 1.12;
/** How finely a tracked passage is weighed for the texts over it (seconds of the clip). */
const FACE_WINDOW = 0.5;

/**
 * Where the faces tracked in a clip are over [from, from + seconds] of it, in shares of the
 * picture (the rows of a picture filmed upright or wider are the vertical frame's): one zone
 * per face, padded, widened by a zoom the shot may get. Null when no face was tracked there.
 */
export function trackedFaces(file: TracksFile, from: number, seconds: number): Box[] | null {
  const first = Math.max(0, Math.floor(from * file.fps) - file.from);
  const end = Math.min(file.frames.length, Math.ceil((from + seconds) * file.fps) - file.from);
  const faces = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();
  for (let k = first; k < end; k++) {
    for (const [id, x, y, w, h] of file.frames[k]?.f ?? []) {
      if (id === undefined || x === undefined || y === undefined || !w || !h) continue;
      const box = { x0: (x - w * FACE_PAD.sides) / 1000, y0: (y - h * FACE_PAD.above) / 1000, x1: (x + w * (1 + FACE_PAD.sides)) / 1000, y1: (y + h * (1 + FACE_PAD.below)) / 1000 };
      const seen = faces.get(id);
      faces.set(id, seen ? { x0: Math.min(seen.x0, box.x0), y0: Math.min(seen.y0, box.y0), x1: Math.max(seen.x1, box.x1), y1: Math.max(seen.y1, box.y1) } : box);
    }
  }
  if (!faces.size) return null;
  const zoomed = (v: number) => 0.5 + (v - 0.5) * SHOT_ZOOM;
  const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
  return [...faces.values()].map((b) => {
    const left = clamp(Math.min(b.x0, zoomed(b.x0)));
    const top = clamp(Math.min(b.y0, zoomed(b.y0)));
    return { x: left, y: top, w: clamp(Math.max(b.x1, zoomed(b.x1))) - left, h: clamp(Math.max(b.y1, zoomed(b.y1))) - top };
  });
}

type Shot = ClipAnalysis["shots"][number];

/** The shot of a clip that plays at `t` seconds (the nearest one between shots). */
export function shotAt(analysis: ClipAnalysis, t: number): Shot | undefined {
  const inside = analysis.shots.find((s) => t >= s.start && t <= s.end);
  if (inside) return inside;
  return [...analysis.shots].sort((a, b) => Math.abs((a.start + a.end) / 2 - t) - Math.abs((b.start + b.end) / 2 - t))[0];
}

/** The centre of a shot's subject (shares of the picture), to keep it in the vertical crop. */
export function subjectFocus(box: number[] | undefined): { x: number; y: number } | undefined {
  if (!box || box.length !== 4) return undefined;
  const [ymin, xmin, ymax, xmax] = box.map((v) => Math.min(1000, Math.max(0, v)) / 1000) as [number, number, number, number];
  if (xmax <= xmin || ymax <= ymin) return undefined;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { x: round((xmin + xmax) / 2), y: round((ymin + ymax) / 2) };
}

/** The correction Gemini proposed for a clip, as a retouch (small values only; 0 means nothing to do). */
export function correctionAdjust(analysis: ClipAnalysis): Adjust | undefined {
  const c = analysis.correction;
  if (!c) return undefined;
  const clampTo = (n: number, max: number) => Math.round(Math.min(max, Math.max(-max, n)) * 100) / 100;
  const adjust: Adjust = {
    ...(Math.abs(c.exposure) >= 0.03 ? { exposure: clampTo(c.exposure, 0.5) } : {}),
    ...(Math.abs(c.contrast) >= 0.03 ? { contrast: clampTo(c.contrast, 0.4) } : {}),
    ...(Math.abs(c.saturation) >= 0.03 ? { saturation: clampTo(c.saturation, 0.4) } : {}),
    ...(Math.abs(c.warmth) >= 0.03 ? { warmth: clampTo(c.warmth, 0.4) } : {}),
    // Only a visible tilt is worth the crop straightening costs.
    ...(Math.abs(c.straighten) >= 0.8 ? { straighten: clampTo(c.straighten, 6) } : {}),
  };
  return Object.keys(adjust).length ? adjust : undefined;
}

/** A shot filmed still (on a tripod, or a phone set down): it gets a slow camera move. */
const isStill = (shot: Shot | undefined) => shot?.camera === "static" || (!shot?.camera && (shot?.energy ?? 3) <= 2);

/**
 * Where the footage under an animation comes from when the plan does not say: the clip
 * named (its best passage not shown elsewhere), else the shot before it carried on, else
 * the shot after it, so the picture flows under the words.
 */
function footageUnder(plan: EditPlan, i: number, facts: MediaFacts, clipDurations: Record<string, number>): { clip_id: string; in?: number } | undefined {
  const s = plan.segments[i]!;
  if (!isMotionSegment(s)) return undefined;
  const length = s.duration;
  const shown = plan.segments.filter(isClipSegment).map((x) => ({ clip: x.clip_id, from: x.in, to: x.out }));
  const free = (clip: string, from: number) => shown.every((x) => x.clip !== clip || from >= x.to || from + length <= x.from);
  const fits = (clip: string, from: number) => from >= 0 && from + length <= (clipDurations[clip] ?? Infinity) + 0.01;
  // Only her own footage of this Reel: an unknown id is ignored.
  const named = s.over?.clip_id && (facts.clips[s.over.clip_id] || facts.photos[s.over.clip_id]) ? s.over.clip_id : undefined;
  // The shot before carries on (what comes right after it in its clip), else the shot after starts early.
  const neighbour = (): { clip_id: string; in?: number } | undefined => {
    const before = plan.segments[i - 1];
    if (before && isClipSegment(before)) {
      if (facts.photos[before.clip_id]) return { clip_id: before.clip_id };
      if (fits(before.clip_id, before.out)) return { clip_id: before.clip_id, in: before.out };
    }
    const after = plan.segments[i + 1];
    if (after && isClipSegment(after)) {
      if (facts.photos[after.clip_id]) return { clip_id: after.clip_id };
      const from = Math.round((after.in - length) * 100) / 100;
      if (fits(after.clip_id, from)) return { clip_id: after.clip_id, in: from };
    }
    return undefined;
  };
  if (named) {
    if (s.over?.in !== undefined) return { clip_id: named, in: s.over.in };
    if (facts.photos[named]) return { clip_id: named };
    const analysis = facts.clips[named];
    const options = [...(analysis?.best_moments ?? []).map((m) => m.start), ...(analysis?.shots ?? []).map((x) => x.start), 0];
    const unseen = options.find((t) => fits(named, t) && free(named, t));
    if (unseen !== undefined) return { clip_id: named, in: Math.round(unseen * 100) / 100 };
    // Every passage of it is already in the Reel: a shot seen twice reads as a repeat, a neighbour carries on instead.
    const carried = neighbour();
    if (carried) return carried;
    return { clip_id: named, in: Math.round((options.find((t) => fits(named, t)) ?? 0) * 100) / 100 };
  }
  const carried = neighbour();
  if (carried) return carried;
  // No neighbour to carry on: any video of hers, from its best moment.
  const any = plan.segments.find((x): x is Extract<PlanSegment, { clip_id: string }> => isClipSegment(x) && !facts.photos[x.clip_id]);
  return any ? { clip_id: any.clip_id, in: Math.max(0, Math.min(facts.clips[any.clip_id]?.best_moments[0]?.start ?? 0, (clipDurations[any.clip_id] ?? length) - length)) } : undefined;
}

/**
 * How the photos of a Reel move, the way a good creator edits them: most are held still and
 * cut on the beat (a slow zoom on every photo reads as a slideshow); the Reel's one slow push
 * goes to the photo that opens it (it moves from the first image), else to the editor's own
 * choice, else to the photo held longest; a landscape photo too wide for the vertical frame
 * a slow pan that shows more of it; never the same move on two photos in a row. A move the
 * editor chose stays, within the same limits. Returns each photo segment's move, by index.
 */
export function photoMoves(plan: Pick<EditPlan, "segments">, photos: MediaFacts["photos"]): Map<number, CameraMove> {
  const moves = new Map<number, CameraMove>();
  const shown = plan.segments.flatMap((s, i) => (isClipSegment(s) && photos[s.clip_id] ? [{ i, s, seconds: segmentSeconds(s), facts: photos[s.clip_id]! }] : []));
  let pushed = false;
  let pans = 0;
  let last: CameraMove = "none";
  const slow = (m: CameraMove) => m === "in" || m === "out";
  // The one slow push: the opening photo, else the editor's own, else the photo held longest (2 s at least).
  const opening = shown[0]?.i === 0 ? 0 : undefined;
  const chosen = opening ?? shown.find((p) => slow(p.s.move ?? "none"))?.i ?? [...shown].filter((p) => p.seconds >= 2).sort((a, b) => b.seconds - a.seconds)[0]?.i;
  for (const p of shown) {
    const wide = p.facts.width / Math.max(1, p.facts.height) > 1.25;
    let move: CameraMove = p.s.move ?? "none";
    if (slow(move) && (pushed || p.i !== chosen)) move = "none";
    if (move === "none" && p.i === chosen && !pushed) move = "in";
    if (move === "none" && wide && p.seconds >= 1.5 && pans < 2) move = pans % 2 === 0 ? "left" : "right";
    if (move !== "none" && move === last) move = "none";
    if (slow(move)) pushed = true;
    if (move === "left" || move === "right") pans++;
    moves.set(p.i, move);
    last = move;
  }
  return moves;
}

/** A ramp needs this much time on screen as filmed, around its slow passage and its ease (seconds), else the shot stays in plain slow motion. */
const RAMP_MIN_RUN = 0.5;
/** The slow passage around the gesture, in seconds of the clip. */
const RAMP_HOLD = { min: 0.35, max: 0.9 };

/**
 * A shot the editor slowed down, ramped the way creators do it (CapCut's « Velocity »): as filmed
 * up to its gesture, easing into slow motion on it (the gesture Gemini read that the shot covers
 * most, else a hand move measured on the tracks, else its best moment, else its middle), and back.
 * The same time on screen as the slow motion asked for: the passage as filmed comes from the clip
 * around it, never from a passage another shot of the Reel shows. Unchanged when there is no room.
 */
export function speedRamp(s: ClipSegment, analysis: ClipAnalysis | undefined, others: { from: number; to: number }[], clipDuration: number, tracks?: TracksFile): ClipSegment {
  const speed = s.speed ?? 1;
  if (speed >= 0.99 || s.ramp || !analysis) return s;
  const covered = (a: { start: number; end: number }) => Math.max(0, Math.min(a.end, s.out) - Math.max(a.start, s.in));
  const best = (list: { start: number; end: number }[]) => list.filter((a) => covered(a) > 0.1).sort((a, b) => covered(b) - covered(a))[0];
  const measured = tracks ? handMoves({ fps: tracks.fps, from: tracks.from, frames: tracks.frames, aspect: tracks.w / tracks.h }) : [];
  const gesture = best(analysis.actions ?? []) ?? best(measured) ?? best(analysis.best_moments);
  const from = gesture ? Math.max(gesture.start, s.in) : s.in;
  const to = gesture ? Math.min(gesture.end, s.out) : s.out;
  const at = (from + to) / 2;
  const ease = (2 * RAMP_EASE) / ((1 + speed) / 2);
  // The slow passage shortens when it must, to leave the shot its passage as filmed.
  const room = (segmentSeconds(s) - ease - RAMP_MIN_RUN) * speed;
  const hold = Math.min(RAMP_HOLD.max, s.out - s.in, room, Math.max(RAMP_HOLD.min, to - from));
  if (hold < RAMP_HOLD.min) return s;
  const run = segmentSeconds(s) - hold / speed - ease;
  const coreFrom = at - hold / 2 - RAMP_EASE;
  const coreTo = at + hold / 2 + RAMP_EASE;
  if (coreFrom < 0 || coreTo > clipDuration || others.some((o) => o.from < coreTo && o.to > coreFrom)) return s;
  const limitBefore = Math.max(0, ...others.filter((o) => o.to <= coreFrom).map((o) => o.to));
  const limitAfter = Math.min(clipDuration, ...others.filter((o) => o.from >= coreTo).map((o) => o.from));
  let before = Math.min(coreFrom - limitBefore, run * 0.6);
  let after = run - before;
  if (after > limitAfter - coreTo) {
    after = limitAfter - coreTo;
    before = Math.min(coreFrom - limitBefore, run - after);
  }
  if (before + after < run - 0.01) return s;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { ...s, in: round(coreFrom - before), out: round(coreTo + after), ramp: { at: round(at), hold: round(hold), asked: [s.in, s.out] } };
}

/** A ramped shot as the editor wrote it (its slow motion over the passage it asked for): what a correction shows it. */
export function asAsked<S extends PlanSegment>(s: S): S {
  if (!isClipSegment(s) || !s.ramp) return s;
  const { ramp, ...rest } = s;
  return { ...rest, in: ramp.asked[0], out: ramp.asked[1] } as S;
}

export function finishPlan(plan: EditPlan, facts: MediaFacts, clipDurations: Record<string, number> = {}): EditPlan {
  let still = 0;
  const photoMove = photoMoves(plan, facts.photos);
  // A composed Reel lays its shots itself, at their own pace: no ramp there.
  const composed = Boolean(plan.layers?.some((l) => l.compose));
  const segments = plan.segments.map((s, i): PlanSegment => {
    if (isMotionSegment(s)) {
      const over = footageUnder(plan, i, facts, clipDurations);
      return over ? { ...s, over } : s;
    }
    if (!isClipSegment(s)) return s;
    const photo = facts.photos[s.clip_id];
    if (photo) {
      // A photo: framed on its subject, light corrected (unless retouched by hand already), and moving only when it serves.
      const move = photoMove.get(i) ?? "none";
      return { ...s, move, ...(s.photo ? {} : { photo: photoEditFrom(photo.detection, { width: photo.width, height: photo.height }, { retouch: true, blur: "none" }) }) };
    }
    const analysis = facts.clips[s.clip_id];
    if (!analysis) return s;
    const shot = shotAt(analysis, (s.in + s.out) / 2);
    const focus = subjectFocus(shot?.subject_box);
    // A clip's light and framing are the engine's (no switch sets them by hand): read again for
    // the passage shown, so a correction that picks another passage is framed on its own subject.
    const adjust: Adjust = { ...correctionAdjust(analysis), ...(focus ? { focus } : {}) };
    const filmedStill = isStill(shot) && !s.speed;
    // A shot filmed still gets a slow move, one in two at most (in, then out): a push on every shot gets boring.
    const move: CameraMove | undefined =
      (s.move ?? (s.zoom === "light" ? "in" : "none")) === "none" && filmedStill && segmentSeconds(s) >= 1.5 ? (["in", "none", "out", "none"] as const)[still++ % 4] : s.move;
    const { adjust: _carried, ...rest } = s;
    const finished: ClipSegment = {
      ...rest,
      ...(Object.keys(adjust).length ? { adjust } : {}),
      ...(move ? { move } : {}),
    };
    // A slow motion ramps in and out of its gesture, in the time on screen the editor gave it.
    if (composed || !s.speed || s.speed >= 1) return finished;
    const others = plan.segments.flatMap((x, j) => (j !== i && isClipSegment(x) && x.clip_id === s.clip_id ? [{ from: x.in, to: x.out }] : []));
    return speedRamp(finished, analysis, others, clipDurations[s.clip_id] ?? analysis.duration, facts.tracks?.[s.clip_id]);
  });
  const finished = { ...plan, segments };

  const shots = busyTimeline(finished, facts);
  const placed = segments.map((s, i) => {
    if (isClipSegment(s)) {
      const { subtitle_y: _old, ...rest } = s;
      return rest;
    }
    if (!isMotionSegment(s) || !s.over) return s;
    // The rows the animation leaves seen: its designer composes around them, the render moves it off them.
    const { busy: _old, ...over } = s.over;
    const busy = rowsOf(shots[i]!.boxes);
    return { ...s, over: busy.length ? { ...over, busy } : over };
  });
  // A collage that composes its own shots puts their faces where it likes: its texts keep their usual rows,
  // and its composition keeps faces off them (it is told where they are).
  if (finished.layers?.some((l) => l.compose)) {
    const { subtitle_y: _row, ...rest } = finished;
    return { ...rest, segments: placed, texts: finished.texts.map(({ auto_y, y, ...t }) => (auto_y ? t : { ...t, ...(y !== undefined ? { y } : {}) })) };
  }
  // A voice's subtitles keep one place for the whole Reel, the one faces cover least (they never move from shot to shot),
  // the footage under the animations included: they show over them too. The render then weighs what the animations draw.
  const windows = shots.flatMap((s) => s.windows);
  const row = reelSubtitleRow(windows);
  // They show all along what is said, other texts or not: the Reel's texts keep off their row (two texts one over the other do not read).
  const subtitles: Box[] = plan.subtitles ? [{ x: 0, y: row ?? SUBTITLE_ROW.y, w: 1, h: SUBTITLE_ROW.h }] : [];
  const clear = subtitles.length ? windows.map((w) => ({ ...w, boxes: [...w.boxes, ...subtitles] })) : windows;
  const { subtitle_y: _row, ...rest } = finished;
  return { ...rest, ...(row !== null ? { subtitle_y: row } : {}), segments: placed, texts: avoidPhotoText(finished.texts, clear) };
}

/**
 * What texts must not cover, shot by shot, in the Reel's seconds: lettering and faces in photos,
 * faces in videos; and under each animation, the same in the footage that plays beneath it. A
 * tracked passage is weighed window by window: a text meets the faces of its own moments.
 */
export function busyTimeline(plan: EditPlan, facts: MediaFacts) {
  const timeline = planTimeline(plan);
  return plan.segments.map((s, i) => {
    const at = timeline.segments[i]!;
    const boxes = isClipSegment(s)
      ? busyZones(facts, s.clip_id, s.in, s.out - s.in, s.photo)
      : isMotionSegment(s) && s.over
        ? busyZones(facts, s.over.clip_id, s.over.in ?? 0, s.duration, plan.segments.find((x): x is Extract<PlanSegment, { clip_id: string }> => isClipSegment(x) && x.clip_id === s.over!.clip_id)?.photo)
        : [];
    const windows = isClipSegment(s) ? busyWindows(facts, s.clip_id, s.in, s.out - s.in, at) : null;
    return { start: at.start, length: at.length, boxes, windows: windows ?? [{ start: at.start, length: at.length, boxes }], motion: isMotionSegment(s) };
  });
}

/**
 * A tracked passage window by window, in the Reel's time, with the faces of each: a text is
 * weighed against the faces of its own moments (a face that comes close at the end of a shot
 * does not take the whole shot). Null when no face was tracked in it.
 */
function busyWindows(facts: MediaFacts, mediaId: string, from: number, seconds: number, at: { start: number; length: number }): { start: number; length: number; boxes: Box[] }[] | null {
  const file = facts.photos[mediaId] ? undefined : facts.tracks?.[mediaId];
  if (!file || !trackedFaces(file, from, seconds)) return null;
  const n = Math.max(1, Math.round(seconds / FACE_WINDOW));
  return Array.from({ length: n }, (_, k) => ({
    start: at.start + (k * at.length) / n,
    length: at.length / n,
    boxes: trackedFaces(file, from + (k * seconds) / n, seconds / n) ?? [],
  }));
}

/**
 * The zones of a passage that must stay seen, in shares of the vertical frame: in a photo,
 * its lettering (a sign, a logo on a window) and every face, placed where the crop shows
 * them; in a video, its faces where they were tracked, else the head of the subject of
 * each shot where Gemini saw faces (the top of her box, too rough for a face that comes
 * close: the hook of a boutique Reel sat on her mouth).
 */
function busyZones(facts: MediaFacts, mediaId: string, from: number, seconds: number, edit?: PhotoEdit): Box[] {
  const photo = facts.photos[mediaId];
  if (photo) {
    const framed = edit ?? { source: { width: photo.width, height: photo.height } };
    const zones = [
      ...(photo.detection.text_boxes ?? []).map((b) => boxFrom2d(b, 0.05)),
      // Every face, recognizable or not (sunglasses, a profile): a text on it reads as a mistake.
      ...photo.detection.regions.filter((r) => r.kind === "face").map((r) => boxFrom2d(r.box_2d, 0.1)),
    ];
    return zones.flatMap((b) => photoBoxInFrame(b, framed) ?? []);
  }
  const file = facts.tracks?.[mediaId];
  const tracked = file ? trackedFaces(file, from, seconds) : null;
  if (tracked) return tracked;
  const boxes: Box[] = [];
  for (const shot of facts.clips[mediaId]?.shots ?? []) {
    if (shot.end < from || shot.start > from + seconds) continue;
    const head = shot.faces_visible ? headZone(shot.subject_box) : null;
    if (head) boxes.push(head);
  }
  return boxes;
}

/** The rows of zones worth keeping clear (a tiny word does not count), merged when they touch. */
function rowsOf(boxes: Box[]): { y: number; h: number }[] {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const rows = boxes
    .filter((b) => b.w > 0.12 || b.h > 0.04)
    .map((b) => ({ top: Math.max(0, b.y), bottom: Math.min(1, b.y + b.h) }))
    .sort((a, b) => a.top - b.top);
  const merged: { top: number; bottom: number }[] = [];
  for (const r of rows) {
    const last = merged.at(-1);
    if (last && r.top <= last.bottom + 0.01) last.bottom = Math.max(last.bottom, r.bottom);
    else merged.push({ ...r });
  }
  return merged.slice(0, 8).map((r) => ({ y: round(r.top), h: round(r.bottom - r.top) }));
}

/** Where the subject sits across the picture, in the editor's words. */
export function subjectPlace(box: number[] | undefined): "gauche" | "centre" | "droite" | undefined {
  const focus = subjectFocus(box);
  if (!focus) return undefined;
  return focus.x < 0.38 ? "gauche" : focus.x > 0.62 ? "droite" : "centre";
}

/** The Reel's frame (width over height): a picture filmed wider shows only a window of its width. */
const REEL_ASPECT = 9 / 16;

/**
 * How much of a gesture [start, end] of a clip shows a hand inside the Reel's vertical frame,
 * as a share of its images, from the tracks: the window the crop keeps around the shot's
 * subject, a hand counted when its wrist and the tips of its thumb and index are in it. Null
 * when the tracks do not cover the gesture. A boutique's « -20 % » was caught on a raised arm
 * whose hand had left the frame: nothing to catch it with.
 */
export function handsInFrame(file: TracksFile, analysis: ClipAnalysis, start: number, end: number): number | null {
  const first = Math.max(0, Math.floor(start * file.fps) - file.from);
  const last = Math.min(file.frames.length, Math.ceil(end * file.fps) - file.from);
  if (last <= first) return null;
  const visible = Math.min(1, REEL_ASPECT / (file.w / file.h));
  const focus = subjectFocus(shotAt(analysis, (start + end) / 2)?.subject_box)?.x ?? 0.5;
  const left = Math.min(1 - visible, Math.max(0, focus - visible / 2)) * 1000;
  const inside = (x: number | undefined, y: number | undefined) => x !== undefined && y !== undefined && x >= left && x <= left + visible * 1000 && y >= 0 && y <= 1000;
  let seen = 0;
  for (let k = first; k < last; k++) {
    // A hand: [id, x0, y0 … x20, y20]; its wrist (0), thumb tip (4) and index tip (8).
    if ((file.frames[k]?.h ?? []).some((h) => [0, 4, 8].every((p) => inside(h[1 + 2 * p], h[2 + 2 * p])))) seen++;
  }
  return seen / (last - first);
}

/**
 * A clip's analysis as the editor reads it: every shot with what a professional editor
 * weighs (size, camera, beauty, energy, hook, where the subject is), without the raw
 * coordinates and retouch values the engine uses on its own; with its tracks, whether
 * the hands of each gesture show in the vertical frame, and what the hands really do,
 * measured on their points (`mains_suivies`: the gestures read can miss one).
 */
export function editorClip(mediaId: string, analysis: ClipAnalysis, tracks?: TracksFile) {
  // Its measured speech stays the engine's: the editor gives whole sentences, the engine cuts the « euh ».
  const { correction: _correction, words, shots, actions, speech: _speech, ...rest } = analysis;
  const hands = (a: { start: number; end: number }) => {
    const share = tracks ? handsInFrame(tracks, analysis, a.start, a.end) : null;
    return share === null ? {} : { mains: share >= 0.75 ? "dans le cadre" : share >= 0.3 ? "en partie" : "hors du cadre" };
  };
  const measured = tracks ? handMoves({ fps: tracks.fps, from: tracks.from, frames: tracks.frames, aspect: tracks.w / tracks.h }) : [];
  return {
    media_id: mediaId,
    ...rest,
    shots: shots.map(({ subject_box, ...shot }) => ({ ...shot, ...(subjectPlace(subject_box) ? { sujet_a: subjectPlace(subject_box) } : {}) })),
    words: words?.length ? words : undefined,
    actions: actions?.length ? actions.map((a) => ({ ...a, ...hands(a) })) : undefined,
    mains_suivies: measured.length ? measured.map((m) => ({ start: m.start, end: m.end, what: m.what, ...hands(m) })) : undefined,
  };
}
