import { z } from "zod";
import { captionStyle, isClipSegment, segmentSpans, type EditPlan, type MotionDrawn, type PlanLayer } from "./schemas.ts";

// Her subject cut out at every image of a passage of her video (apps/render/matte.py, in the cut-out sandbox), so
// a composition lays a text behind her as she walks, a title behind a hill, or her alone on a colour or on paper
// (Subject in the animations' scope). Only for the passages a composition asks it of (its code uses Subject), and
// within a budget: a moving subject costs up to a minute of the sandbox's work a second of video, a still one a single image.

/**
 * The most seconds of video cut out for one Reel: a whole Reel on another ground (Tristan's reference of a creator on
 * orange for 25 s), started while the animations are written and finished before the render.
 */
export const SUBJECT_MAX_SECONDS = 30;
/**
 * The most seconds cut out so the words said go behind her (kinetic captions, lot 7): its first passages, where the
 * hook is said; the phrases said over the others stay in front. A person is cut out by her own model (matte.py's
 * person mode, about fifteen times faster than the photo model).
 */
export const CAPTION_SUBJECT_SECONDS = 12;

/** The name of a passage's cut-out: its clip and its seconds, to the hundredth (the same passage keeps it from one version to the next). */
export const subjectKey = (clipId: string, from: number, to: number) => `${clipId}@${from.toFixed(2)}-${to.toFixed(2)}`;

/**
 * Each use of the scope's cut-out tools with props in a code: `React.createElement(Subject|Outline, {…})` as kept (the
 * motion designer's TSX compiled by sucrase), `h(…)`, or a JSX tag; its props as written, braces matched.
 */
function toolProps(js: string, tools = "Subject|Outline"): string[] {
  const out: string[] = [];
  for (const m of js.matchAll(new RegExp(`\\b(?:React\\.createElement|h)\\(\\s*(?:${tools})\\s*,\\s*|<(?:${tools})\\b`, "g"))) {
    const jsx = m[0].startsWith("<");
    const from = m.index + m[0].length;
    if (!jsx && js[from] !== "{") continue;
    let depth = 0;
    let to = from;
    for (; to < js.length; to++) {
      const c = js[to];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (!jsx && depth === 0) break;
      } else if (jsx && c === ">" && depth === 0) break;
    }
    out.push(js.slice(from, to + 1));
  }
  return out;
}

/**
 * The calls of its functions (`SubjectBox(shots[2], f, box, "the cup")`), their arguments split at the top level (a
 * nested call stays one argument: `SubjectBox(shots[0], Math.min(frame, 116), laid, "espresso cup")` had been read as
 * a call for her, and she was cut out for nothing): the shot, and the object's name when one is given last.
 */
function subjectCalls(js: string): { shot: string; name?: string }[] {
  const out: { shot: string; name?: string }[] = [];
  for (const m of js.matchAll(/\bSubject(?:Box|Outline|Parts)\(/g)) {
    const args: string[] = [];
    let arg = "";
    let depth = 0;
    let quote: string | null = null;
    for (let i = m.index + m[0].length; i < js.length; i++) {
      const c = js[i]!;
      if (quote) {
        arg += c;
        if (c === "\\") arg += js[++i] ?? "";
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        quote = c;
        arg += c;
        continue;
      }
      if (c === ")" && depth === 0) {
        args.push(arg);
        break;
      }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      if (c === "," && depth === 0) {
        args.push(arg);
        arg = "";
        continue;
      }
      arg += c;
    }
    // The object's name: its last argument written as a string (a carousel's may be followed by its reframing, { zoom }).
    const name = args
      .slice(1)
      .map((a) => /^["'`]([^"'`]+)["'`]$/.exec(a.trim())?.[1])
      .filter(Boolean)
      .pop();
    out.push({ shot: (args[0] ?? "").trim(), ...(name ? { name } : {}) });
  }
  return out;
}
const OBJECT_PROP = /\bobject\s*[:=]\s*\{?\s*["'`]([^"'`]+)["'`]/;
const SHOT_PROP = /\bshot\s*[:=]\s*\{?\s*((?:shots\s*\[\s*)?\d+)/;
/** A shot prop written as a number or shots[n], and nothing after it (`shot: 5 + j` is a variable). */
const SHOT_NUMBER = /\bshot\s*[:=]\s*\{?\s*((?:shots\s*\[\s*)?\d+\s*\]?)\s*(?=[,})]|$)/;

/**
 * A composition's code that draws her subject (the person, or what stands in front: what its cut-out keeps): any use
 * of Subject, SubjectBox, SubjectOutline or Outline that does not name an object (with one, it is that object, not
 * her). Counted on every mention, so a tool used another way (aliased, in a list) still has her cut out.
 */
export function drawsSubject(js: string | undefined): boolean {
  if (!js) return false;
  const mentions = js.match(/\b(?:Subject|SubjectBox|SubjectOutline|SubjectParts|Outline)\b/g)?.length ?? 0;
  const forObjects = toolProps(js).filter((props) => OBJECT_PROP.test(props)).length + subjectCalls(js).filter((c) => c.name).length;
  return mentions > forObjects;
}

/**
 * The shots a composition's code draws her cut out on (her subject, not an object): Subject or Outline without
 * `object`, by their `shot` written as a number or shots[n], and SubjectBox, SubjectOutline or SubjectParts called
 * without a name on shots[n] (or n). A shot written as a variable (`shot: i`, `shots[cur]`, `5 + j`) is ANY_SHOT,
 * every shot under the animation; so is a use read no other way (aliased, in a list) when it is the only one.
 */
export function subjectsDrawn(js: string | undefined): number[] {
  if (!js || !drawsSubject(js)) return [];
  const shots = new Set<number>();
  const add = (shot: string | undefined) => {
    const n = /^(?:shots\s*\[\s*)?(\d+)\s*\]?$/.exec((shot ?? "").trim());
    shots.add(n ? Number(n[1]) : ANY_SHOT);
  };
  for (const props of toolProps(js)) if (!OBJECT_PROP.test(props)) add(SHOT_NUMBER.exec(props)?.[1]);
  for (const c of subjectCalls(js)) if (!c.name) add(c.shot);
  if (!shots.size) shots.add(ANY_SHOT);
  return [...shots].sort((a, b) => a - b);
}

/**
 * What a layer's code draws of her shots as its montage skill declared it (motion.drawn), when it still fits the plan:
 * made for as many shots as the plan has (its code kept over other shots no longer says which: it is read again).
 */
export function declaredDrawn(plan: Pick<EditPlan, "segments">, layer: Pick<PlanLayer, "motion"> | undefined): MotionDrawn | null {
  const drawn = layer?.motion?.drawn;
  return drawn && drawn.shots === plan.segments.filter(isClipSegment).length ? drawn : null;
}

/** When each of her shots is on screen (seconds, as the composition's shots list them: videos and photos), a shot laid beside the others at its own moment. */
function shotSpans(plan: Pick<EditPlan, "segments">): { from: number; to: number }[] {
  const { spans } = segmentSpans(plan.segments);
  return plan.segments.flatMap((s, i) => (isClipSegment(s) ? [{ from: spans[i]!.start, to: spans[i]!.start + spans[i]!.length }] : []));
}

/** Her shots on screen under an animation (their index among her shots), by when they play (a fade's few tenths aside). */
function shotsUnder(spans: { from: number; to: number }[], layer: Pick<PlanLayer, "from" | "to">): number[] {
  return spans.flatMap((s, i) => (s.to > layer.from + 0.05 && s.from < layer.to - 0.05 ? [i] : []));
}

/**
 * The shots of a plan its animations draw her cut out on (their index among her shots): each layer's that draws her,
 * as its montage skill declared them (motion.drawn.subjects, with any shot its code writes as a number), else read in
 * its code (subjectsDrawn: a shot written as a variable, every shot under it).
 */
export function subjectShots(plan: Pick<EditPlan, "segments" | "layers">): Set<number> {
  const spans = shotSpans(plan);
  const out = new Set<number>();
  for (const layer of plan.layers ?? []) {
    const read = subjectsDrawn(layer.motion?.js);
    const declared = declaredDrawn(plan, layer)?.subjects;
    if (!read.length && !declared?.length) continue;
    const shots = declared ? [...declared, ...read.filter((k) => k !== ANY_SHOT)] : read.flatMap((k) => (k === ANY_SHOT ? shotsUnder(spans, layer) : [k]));
    for (const k of shots) if (k >= 0 && k < spans.length) out.add(k);
  }
  return out;
}

/** An object's name as kept: lower case, its spaces single (« The coffee cup » and « the coffee cup » are one). */
export const objectName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);

/** What starts a skill's object name in its code (« @lumieres »), replaced by the name its filler gives for her shot. */
export const SKILL_OBJECT = "@";

/** The name of an object's passage: the passage's, then the object's. */
export const objectKey = (clipId: string, from: number, to: number, name: string) => `${subjectKey(clipId, from, to)}#${objectName(name)}`;

/** A shot written as a variable in an animation's code (shots[i], shotIdx): every shot under the animation is looked at. */
export const ANY_SHOT = -1;

/**
 * The objects a composition's code follows (a cup she lifts, a product she shows, a ball): by shot (its index in
 * shots, written as a number or shots[n]) and name, from Subject or Outline given `object` (compiled or as JSX), and
 * SubjectBox, SubjectOutline or SubjectParts given a name last. A shot written as a variable (the same photo on two
 * shots, switched by the frame) is ANY_SHOT: the object is looked for on every shot under the animation. A skill's
 * name left unfilled (« @lumieres »: nothing in her shot to light up) is no object: its code does without.
 */
export function objectsDrawn(js: string | undefined): { shot: number; name: string }[] {
  if (!js) return [];
  const found = new Map<string, { shot: number; name: string }>();
  const add = (shot: string | undefined, name: string | undefined) => {
    const named = name ? objectName(name) : "";
    if (!named || named.startsWith(SKILL_OBJECT)) return;
    const n = /^(?:shots\s*\[\s*)?(\d+)\s*\]?$/.exec((shot ?? "").trim());
    const at = n ? Number(n[1]) : ANY_SHOT;
    found.set(`${at}#${named}`, { shot: at, name: named });
  };
  for (const props of toolProps(js)) add(SHOT_PROP.exec(props)?.[1], OBJECT_PROP.exec(props)?.[1]);
  for (const c of subjectCalls(js)) add(c.shot, c.name);
  return [...found.values()];
}

/**
 * The objects a carousel's code finds on its photos (a glass, the bottle she holds): by photo (its index in photos,
 * written photos[n]) and name, from Subject or Outline given `photo={photos[n]}` and `object`, and SubjectBox or
 * SubjectOutline called on photos[n] with a name. A photo written as a variable is not read.
 */
export function photoObjectsDrawn(js: string | undefined): { photo: number; name: string }[] {
  if (!js) return [];
  const found = new Map<string, { photo: number; name: string }>();
  const add = (photo: string | undefined, name: string | undefined) => {
    const named = name ? objectName(name) : "";
    if (!named) return;
    // A photo written as a variable (photos[i] in a loop): every photo of the carousel is looked at.
    const n = /^photos\s*\[\s*(\d+)\s*\]$/.exec((photo ?? "").trim());
    const at = n ? Number(n[1]) : ANY_SHOT;
    found.set(`${at}#${named}`, { photo: at, name: named });
  };
  for (const props of toolProps(js)) add(/\bphoto\s*[:=]\s*\{?\s*(photos\s*\[\s*\d+\s*\])/.exec(props)?.[1], OBJECT_PROP.exec(props)?.[1]);
  for (const c of subjectCalls(js)) add(c.shot, c.name);
  return [...found.values()];
}

/** A carousel's code that draws an outline (SubjectOutline, Outline): its photos' cut-outs need theirs read. */
export const drawsOutline = (js: string | undefined) => Boolean(js && /\b(?:SubjectOutline|Outline)\b/.test(js));

/**
 * A plan that draws her cut out: an animation that uses Subject (a composition, or one laid over the montage: a word
 * behind her as she walks on a shot played full frame), a composition about to be written (anticipate), or what is said
 * written around her (its strong words behind her).
 */
export const wantsSubjects = (plan: Pick<EditPlan, "layers"> & { subtitles?: boolean; captions?: EditPlan["captions"]; finish?: EditPlan["finish"] }, anticipate = false) =>
  (plan.layers ?? []).some((l) => (l.compose && anticipate) || drawsSubject(l.motion?.js)) || Boolean(plan.subtitles && captionStyle(plan) === "kinetic");

/** What asks for her cut out before any code is written: her background replaced, a word behind her, her silhouette. */
export const CUT_OUT_WORDS = /\bfond\b|d[ée]tour|derri[eè]re (moi|elle|lui|la personne)|silhouette|d[ée]coup[ée]e?\b|background|behind (me|her|him)|cut.?out/i;

/** What asks for a word around something or behind it (« le mot qui tourne autour du verre », « derrière la tasse »): her photos' cut-outs made before the animations are written. */
export const AROUND_WORDS = /autour d|derri[eè]re (l[ae']|les|son|sa|ses|un|une|ce|cette)|le long d|\baround\b|\bbehind\b|along (its|the) (edge|outline)/i;

/** A passage to cut out: its clip, its seconds, its name. */
export type SubjectPassage = { clip_id: string; from: number; to: number; key: string };

/**
 * The passages a Reel needs cut out: the video shots an animation draws her on (subjectShots: as its montage skill
 * declares them, else read in its code, a shot written as a variable being every shot under it), played at their own
 * pace (a speed or a ramp changes which images show), up to SUBJECT_MAX_SECONDS in all; every shot for a composition
 * about to be written (anticipate), the opening ones for what is said written around her. Photos are left out: their
 * subject is the photo's own cut-out, made once (subjectPhotoIds), which Subject draws on them too.
 */
export function subjectPassages(
  plan: Pick<EditPlan, "segments" | "layers"> & { subtitles?: boolean; captions?: EditPlan["captions"]; finish?: EditPlan["finish"] },
  isVideo: (clipId: string) => boolean,
  anticipate = false,
): SubjectPassage[] {
  if (!wantsSubjects(plan, anticipate)) return [];
  // Only the opening passages for the captions alone; an animation that draws her (or a composition that will: anticipate), as many as the budget holds.
  const composed = (plan.layers ?? []).some((l) => (l.compose && anticipate) || drawsSubject(l.motion?.js));
  const budget = composed ? SUBJECT_MAX_SECONDS : CAPTION_SUBJECT_SECONDS;
  // The shots her cut-out is drawn on (decode's three of its ending, not its 16 passages): unknown before its code is
  // written, and every one when what is said goes behind her too (its phrases fall on any shot).
  const captions = Boolean(plan.subtitles && captionStyle(plan) === "kinetic");
  const drawn = composed && !anticipate && !captions ? subjectShots(plan) : null;
  const out: SubjectPassage[] = [];
  let seconds = 0;
  let shot = -1;
  for (const s of plan.segments) {
    if (isClipSegment(s)) shot++;
    if (!composed && seconds >= budget) break;
    if (!isClipSegment(s) || (drawn && !drawn.has(shot))) continue;
    if (!isVideo(s.clip_id) || s.ramp || (s.speed && Math.abs(s.speed - 1) > 0.01)) continue;
    const length = Math.max(0, s.out - s.in);
    if (!length || seconds + length > budget) continue;
    const key = subjectKey(s.clip_id, s.in, s.out);
    if (out.some((p) => p.key === key)) continue;
    out.push({ clip_id: s.clip_id, from: s.in, to: s.out, key });
    seconds += length;
  }
  return out;
}

/** The most photos of a Reel cut out for its animations' Subject (ensureCutouts does ten at a time). */
export const SUBJECT_PHOTO_MAX = 10;

/**
 * The photos of a Reel whose subject an animation draws (Subject, SubjectBox, SubjectOutline or Outline without an
 * object, on a photo shot as on a video one): each one's own cut-out, made once (lib/render/cutout.ts), with its outline.
 * Every photo shot of the Reel when one of its animations draws her (a shot written as a variable is not read).
 */
export function subjectPhotoIds(plan: Pick<EditPlan, "segments" | "layers">): string[] {
  if (!(plan.layers ?? []).some((l) => drawsSubject(l.motion?.js))) return [];
  return [...new Set(plan.segments.flatMap((s) => (isClipSegment(s) && s.photo ? [s.clip_id] : [])))].slice(0, SUBJECT_PHOTO_MAX);
}

/** The photos of a Reel its animations draw something of (her subject, an object), so the montage plays them flat (no relief): a cut-out laid over them falls exactly on them. */
export function photosDrawnOver(plan: Pick<EditPlan, "segments" | "layers">): string[] {
  return [...new Set([...subjectPhotoIds(plan), ...objectPassages(plan, () => false).flatMap((p) => (p.photo ? [p.clip_id] : []))])];
}

/**
 * The most objects followed for one Reel (a skill lights five things up on five of her shots: « Titre derrière le
 * décor »), and the most seconds of video they take in all: each one is read on its whole passage, about 12 s of the
 * card a second, so the card's time stays under four minutes and its cost under 0,15 € whatever their number
 * (lib/render/subjects.ts holds the cost to that, OBJECT_MAX_EUR, in the order the code names them).
 */
export const OBJECT_MAX = 8;
export const OBJECT_MAX_SECONDS = 20;

/**
 * What objects take on the rented card (track_objects.py, seconds): its models loaded and its clips fetched, then each
 * second of a passage (found on one image, followed both ways by SAM 2, its edge made), or one photo (one image read).
 */
export const OBJECT_CARD = { load: 60, perSecond: 12, photo: 8 } as const;

/**
 * The most a Reel's objects may cost on the card, its load and their work at its price: eight objects at most, their
 * 20 s of video stay around 0,12 € on an A10G; past it (a dearer card, longer passages) the last ones are left out.
 */
export const OBJECT_MAX_EUR = 0.15;

/**
 * The object passages the card's budget holds (OBJECT_MAX_EUR), in the order the code names them: its estimate, the
 * load then each one's work, at `eurPerSecond` (the card's price); the composition does without those left out.
 */
export function objectsWithinBudget<P extends { from: number; to: number; photo?: true }>(passages: P[], eurPerSecond: number): P[] {
  let seconds = passages.length ? OBJECT_CARD.load : 0;
  return passages.filter((p) => {
    const need = p.photo ? OBJECT_CARD.photo : Math.max(0, p.to - p.from) * OBJECT_CARD.perSecond;
    if ((seconds + need) * eurPerSecond > OBJECT_MAX_EUR + 1e-9) return false;
    seconds += need;
    return true;
  });
}

/** A plan whose animations follow an object (Subject, SubjectBox, SubjectOutline or Outline given its name): a composition, or one laid over the montage. */
export const wantsObjects = (plan: Pick<EditPlan, "layers">) => (plan.layers ?? []).some((l) => objectsDrawn(l.motion?.js).length > 0);

/** An object to follow through a passage of her video, or to find on one of her photos (`photo`: one image, from 0 to 0): the passage, and the object's name. */
export type ObjectPassage = SubjectPassage & { name: string; photo?: true };

/** The most photos an object is looked for on in one Reel (one image each: a second of the card's time or so). */
export const PHOTO_OBJECT_MAX = 6;

/** The name of a photo's cut-outs among its own (media_assets.subjects): the photo is one image, from 0 to 0. */
export const photoKey = (mediaId: string) => subjectKey(mediaId, 0, 0);

/**
 * The objects an animation's code follows, by shot: as read in its code (objectsDrawn), a shot it writes as a variable
 * placed where its montage skill declared that object (motion.drawn.objects: her sign on her last shot), else on every
 * shot under it.
 */
export function layerObjects(plan: Pick<EditPlan, "segments" | "layers">, layer: PlanLayer, spans = shotSpans(plan)): { shot: number; name: string }[] {
  const declared = declaredDrawn(plan, layer)?.objects ?? [];
  const out = new Map<string, { shot: number; name: string }>();
  for (const o of objectsDrawn(layer.motion?.js)) {
    const placed = o.shot === ANY_SHOT ? declared.filter((d) => objectName(d.name) === o.name).map((d) => d.shot) : [o.shot];
    const shots = o.shot === ANY_SHOT && !placed.length ? shotsUnder(spans, layer) : placed;
    for (const shot of shots) out.set(`${shot}#${o.name}`, { shot, name: o.name });
  }
  return [...out.values()];
}

/**
 * The objects a Reel's compositions follow, each through the passage of the shot its code names: her shot n is the
 * plan's n-th shot (video or photo, as the composition's shots list them; one its montage skill placed, layerObjects),
 * a video at its own pace only (a speed or a ramp changes which images show); OBJECT_MAX at most, OBJECT_MAX_SECONDS in all.
 */
export function objectPassages(plan: Pick<EditPlan, "segments" | "layers">, isVideo: (clipId: string) => boolean): ObjectPassage[] {
  const shots = plan.segments.filter(isClipSegment);
  // When each shot is on screen (seconds; a fade's overlap, a few tenths, left aside): a shot written as a variable is any shot under the animation.
  const spans = shotSpans(plan);
  const out: ObjectPassage[] = [];
  let seconds = 0;
  let photos = 0;
  for (const layer of plan.layers ?? []) {
    for (const { shot, name } of layerObjects(plan, layer, spans)) {
      const s = shots[shot];
      // A photo: the object found once on it (a glass on a table, the cup she holds), whatever its move.
      if (s?.photo) {
        const key = objectKey(s.clip_id, 0, 0, name);
        if (out.some((p) => p.key === key) || photos >= PHOTO_OBJECT_MAX) continue;
        out.push({ clip_id: s.clip_id, from: 0, to: 0, key, name, photo: true });
        photos++;
        continue;
      }
      if (!s || !isVideo(s.clip_id) || s.ramp || (s.speed && Math.abs(s.speed - 1) > 0.01)) continue;
      const key = objectKey(s.clip_id, s.in, s.out, name);
      const length = Math.max(0, s.out - s.in);
      if (out.some((p) => p.key === key) || out.length >= OBJECT_MAX || !length || seconds + length > OBJECT_MAX_SECONDS) continue;
      out.push({ clip_id: s.clip_id, from: s.in, to: s.out, key, name });
      seconds += length;
    }
  }
  return out;
}

// ——— Her video's depth at every image (Depth in the scope: depth_video.py on the rented card) ———————————————————————

/** The most video shots read in depth for one Reel, and the most seconds of video in all. */
export const DEPTH_MAX = 4;
export const DEPTH_MAX_SECONDS = 20;

/** The name of a passage's depth among a clip's cut-outs: the passage's, then « ~depth » (never an object's « # »). */
export const depthKey = (clipId: string, from: number, to: number) => `${subjectKey(clipId, from, to)}~depth`;

/** The shots a composition's code shows in depth (`<Depth shot={2} … />`, compiled or as JSX; a shot written as a variable is not read). */
export function depthsDrawn(js: string | undefined): number[] {
  if (!js) return [];
  const shots = new Set<number>();
  for (const props of toolProps(js, "Depth")) {
    const n = /^(?:shots\s*\[\s*)?(\d+)/.exec(SHOT_PROP.exec(props)?.[1] ?? "");
    if (n) shots.add(Number(n[1]));
  }
  return [...shots];
}

/** A plan whose animations show a shot's depth (a composition, or one laid over the montage). */
export const wantsDepth = (plan: Pick<EditPlan, "layers">) => (plan.layers ?? []).some((l) => depthsDrawn(l.motion?.js).length > 0);

/**
 * The passages a Reel reads in depth: the shot each composition names (her shot n is the plan's n-th shot, as its
 * shots list them), a video at its own pace only (a speed or a ramp changes which images show); DEPTH_MAX at most,
 * DEPTH_MAX_SECONDS in all.
 */
export function depthPassages(plan: Pick<EditPlan, "segments" | "layers">, isVideo: (clipId: string) => boolean): SubjectPassage[] {
  const shots = plan.segments.filter(isClipSegment);
  const out: SubjectPassage[] = [];
  let seconds = 0;
  for (const layer of plan.layers ?? []) {
    for (const shot of depthsDrawn(layer.motion?.js)) {
      const s = shots[shot];
      if (!s || !isVideo(s.clip_id) || s.ramp || (s.speed && Math.abs(s.speed - 1) > 0.01)) continue;
      const key = depthKey(s.clip_id, s.in, s.out);
      const length = Math.max(0, s.out - s.in);
      if (out.some((p) => p.key === key) || out.length >= DEPTH_MAX || !length || seconds + length > DEPTH_MAX_SECONDS) continue;
      out.push({ clip_id: s.clip_id, from: s.in, to: s.out, key });
      seconds += length;
    }
  }
  return out;
}

// ——— Where a text can be set in her shot (ClearBox in the scope: clear_area.py, in the objects' machine) ——————————

/** The most passages read for their clear areas in one Reel, and the most seconds of video in all (a few milliseconds an image). */
export const CLEAR_MAX = 8;
export const CLEAR_MAX_SECONDS = 60;

/** The name of a passage's clear areas among a clip's cut-outs: the passage's, then « ~clear » (never an object's « # »); a photo's from 0 to 0. */
export const clearKey = (clipId: string, from: number, to: number) => `${subjectKey(clipId, from, to)}~clear`;

/**
 * The shots a composition's code sets a text in the clear area of (`ClearBox(shots[2], frame, laid, { … })`): its first
 * argument, written as a number or shots[n]; a shot written as a variable is ANY_SHOT (every shot under the animation).
 */
export function clearsDrawn(js: string | undefined): number[] {
  if (!js) return [];
  const shots = new Set<number>();
  for (const m of js.matchAll(/\bClearBox\(\s*([^,()]*)/g)) {
    const n = /^(?:shots\s*\[\s*)?(\d+)\s*\]?$/.exec((m[1] ?? "").trim());
    shots.add(n ? Number(n[1]) : ANY_SHOT);
  }
  return [...shots];
}

/** A plan whose animations set a text in the clear area of one of her shots (a composition, or one laid over the montage). */
export const wantsClear = (plan: Pick<EditPlan, "layers">) => (plan.layers ?? []).some((l) => clearsDrawn(l.motion?.js).length > 0);

/** A passage read for its clear areas: its clip and seconds, or one of her photos (`photo`: one image, from 0 to 0). */
export type ClearPassage = SubjectPassage & { photo?: true };

/**
 * The passages a Reel reads for their clear areas: the shot each animation names (her shot n is the plan's n-th shot,
 * video or photo, as its shots list them; a variable, every shot under it), a video at its own pace only (a speed or a
 * ramp changes which images show: ClearBox then gives its fallback); CLEAR_MAX at most, CLEAR_MAX_SECONDS of video.
 */
export function clearPassages(plan: Pick<EditPlan, "segments" | "layers">, isVideo: (clipId: string) => boolean): ClearPassage[] {
  const shots = plan.segments.filter(isClipSegment);
  const spans = shotSpans(plan);
  const out: ClearPassage[] = [];
  let seconds = 0;
  for (const layer of plan.layers ?? []) {
    const under = shots.flatMap((_, i) => (spans[i]!.to > layer.from + 0.05 && spans[i]!.from < layer.to - 0.05 ? [i] : []));
    for (const shot of clearsDrawn(layer.motion?.js).flatMap((n) => (n === ANY_SHOT ? under : [n]))) {
      const s = shots[shot];
      if (!s || out.length >= CLEAR_MAX) continue;
      if (s.photo) {
        const key = clearKey(s.clip_id, 0, 0);
        if (!out.some((p) => p.key === key)) out.push({ clip_id: s.clip_id, from: 0, to: 0, key, photo: true });
        continue;
      }
      if (!isVideo(s.clip_id) || s.ramp || (s.speed && Math.abs(s.speed - 1) > 0.01)) continue;
      const key = clearKey(s.clip_id, s.in, s.out);
      const length = Math.max(0, s.out - s.in);
      if (out.some((p) => p.key === key) || !length || seconds + length > CLEAR_MAX_SECONDS) continue;
      out.push({ clip_id: s.clip_id, from: s.in, to: s.out, key });
      seconds += length;
    }
  }
  return out;
}

// ——— What a composition reads on her shots besides its clear areas (shot_read.py, in the cut-out sandbox) ———————————

/**
 * What can be read on a passage, each for the tool of the scope that asks it: `ground` her shot without its sky at every
 * image (Skyline: a transparent video, like her cut-out), `sky` its skyline only (SkylineAt), `vanish` its vanishing
 * point (VanishingPoint), `light` the light of each cell of its picture (LightUnder).
 */
export type ShotReadKind = "ground" | "sky" | "vanish" | "light";

/** The most passages read for one Reel; the most of them made into a ground, and the most seconds of video they take (each image is read and written). */
export const READ_MAX = 8;
export const GROUND_MAX = 4;
export const GROUND_MAX_SECONDS = 20;

/** The name of a passage's readings among a clip's cut-outs (a JSON file: ShotReading), and of its ground (a video without its sky): never an object's « # ». */
export const readKey = (clipId: string, from: number, to: number) => `${subjectKey(clipId, from, to)}~read`;
export const groundKey = (clipId: string, from: number, to: number) => `${subjectKey(clipId, from, to)}~ground`;

/** The tools of the scope that read a shot, and what each one needs read. */
const READ_TOOLS: [RegExp, ShotReadKind][] = [
  [/\bSkylineAt\(\s*([^,()]*)/g, "sky"],
  [/\bVanishingPoint\(\s*([^,()]*)/g, "vanish"],
  [/\bLightUnder\(\s*([^,()]*)/g, "light"],
];

/**
 * The shots a composition's code reads, and what it reads on each: `<Skyline shot={n} … />` (compiled or as JSX) its
 * ground, SkylineAt(shots[n], …) its skyline, VanishingPoint(shots[n], …) its vanishing point, LightUnder(shots[n], …) its
 * light; a shot written as a variable is ANY_SHOT (every shot under the animation).
 */
export function readsDrawn(js: string | undefined): { shot: number; kinds: ShotReadKind[] }[] {
  if (!js) return [];
  const found = new Map<number, Set<ShotReadKind>>();
  const add = (shot: number, kind: ShotReadKind) => found.set(shot, (found.get(shot) ?? new Set()).add(kind));
  for (const props of toolProps(js, "Skyline")) {
    const n = /^(?:shots\s*\[\s*)?(\d+)/.exec(SHOT_PROP.exec(props)?.[1] ?? "");
    add(n ? Number(n[1]) : ANY_SHOT, "ground");
  }
  for (const [pattern, kind] of READ_TOOLS) {
    for (const m of js.matchAll(pattern)) {
      const n = /^(?:shots\s*\[\s*)?(\d+)\s*\]?$/.exec((m[1] ?? "").trim());
      add(n ? Number(n[1]) : ANY_SHOT, kind);
    }
  }
  return [...found].map(([shot, kinds]) => ({ shot, kinds: [...kinds].sort() }));
}

/** A plan whose animations read one of her shots (its sky, its vanishing point, its light): a composition, or one laid over the montage. */
export const wantsReads = (plan: Pick<EditPlan, "layers">) => (plan.layers ?? []).some((l) => readsDrawn(l.motion?.js).length > 0);

/** A passage to read: its clip and seconds (a photo from 0 to 0), what to read there. */
export type ReadPassage = SubjectPassage & { kinds: ShotReadKind[]; photo?: true };

/**
 * The passages a Reel reads, each with all its compositions ask of it (her shot n is the plan's n-th shot, video or
 * photo, as its shots list them; a variable, every shot under it), a video at its own pace only (a speed or a ramp
 * changes which images show: the tools then give their fallback); READ_MAX at most, and a ground for GROUND_MAX of
 * them and GROUND_MAX_SECONDS of video at most (the others keep their skyline, read on their first image).
 */
export function readPassages(plan: Pick<EditPlan, "segments" | "layers">, isVideo: (clipId: string) => boolean): ReadPassage[] {
  const shots = plan.segments.filter(isClipSegment);
  const spans = shotSpans(plan);
  const out: ReadPassage[] = [];
  let grounds = 0;
  let seconds = 0;
  for (const layer of plan.layers ?? []) {
    const under = shotsUnder(spans, layer);
    for (const { shot, kinds } of readsDrawn(layer.motion?.js).flatMap((r) => (r.shot === ANY_SHOT ? under.map((i) => ({ ...r, shot: i })) : [r]))) {
      const s = shots[shot];
      if (!s) continue;
      const photo = Boolean(s.photo);
      if (!photo && (!isVideo(s.clip_id) || s.ramp || (s.speed && Math.abs(s.speed - 1) > 0.01))) continue;
      const from = photo ? 0 : s.in;
      const to = photo ? 0 : s.out;
      const key = readKey(s.clip_id, from, to);
      const known = out.find((p) => p.key === key);
      if (!known && out.length >= READ_MAX) continue;
      const passage = known ?? { clip_id: s.clip_id, from, to, key, kinds: [], ...(photo ? { photo: true as const } : {}) };
      if (!known) out.push(passage);
      for (const kind of kinds) {
        if (passage.kinds.includes(kind)) continue;
        if (kind === "ground") {
          const length = Math.max(0, to - from);
          // Past its budget, a ground is its skyline only (SkylineAt still reads it; Skyline draws nothing).
          if (grounds >= GROUND_MAX || seconds + length > GROUND_MAX_SECONDS) {
            if (!passage.kinds.includes("sky")) passage.kinds.push("sky");
            continue;
          }
          grounds++;
          seconds += length;
        }
        passage.kinds.push(kind);
      }
      passage.kinds.sort();
    }
  }
  return out;
}

/** A shot's readings (shot_read.py), as their file keeps them and the render reads them. */
export const shotReadingSchema = z.object({
  /** The camera's move (s, dx, dy for each image, flat), when it moves: what is read on the first image follows it. */
  motion: z.array(z.number()).optional(),
  /** Its sky: its share of the picture, and where it ends in each of 64 columns of its first image (shares of the height from the top). */
  sky: z.object({ share: z.number(), profile: z.array(z.number()) }).optional(),
  /** Where its lines run to (shares of its first image, maybe a little outside it), how sure (0 to 1); null when they run nowhere. */
  vanish: z.object({ x: z.number(), y: z.number(), strength: z.number() }).nullable().optional(),
  /** The mean light of each cell of its picture over the passage (two hex digits a cell, rows from the top), its mean and its bright tenth (0 to 1). */
  light: z
    .object({ cols: z.number().int().min(2).max(256), rows: z.number().int().min(2).max(256), cells: z.string().regex(/^[0-9a-f]*$/), mean: z.number(), high: z.number() })
    .refine((l) => l.cells.length === l.cols * l.rows * 2, "cells")
    .optional(),
});
export type ShotReading = z.infer<typeof shotReadingSchema>;

// ——— Her video's depth as a mask (Near in the scope: depth_video.py on the rented card) ——————————————————————————————

/** The name of a passage's nearness among a clip's cut-outs (her shot with its depth as its transparency, a WebM). */
export const nearKey = (clipId: string, from: number, to: number) => `${subjectKey(clipId, from, to)}~near`;

/** The most seconds of video made into a nearness for one Reel (each image at the cut-out's size): its passages count in DEPTH_MAX too. */
export const NEAR_MAX_SECONDS = 12;

/** The shots a composition's code shows by their depth (`<Near shot={2} depth={…} />`, compiled or as JSX; a shot written as a variable is not read). */
export function nearsDrawn(js: string | undefined): number[] {
  if (!js) return [];
  const shots = new Set<number>();
  for (const props of toolProps(js, "Near")) {
    const n = /^(?:shots\s*\[\s*)?(\d+)/.exec(SHOT_PROP.exec(props)?.[1] ?? "");
    if (n) shots.add(Number(n[1]));
  }
  return [...shots];
}

/** A plan whose animations rebuild a shot by its depth (Near). */
export const wantsNear = (plan: Pick<EditPlan, "layers">) => (plan.layers ?? []).some((l) => nearsDrawn(l.motion?.js).length > 0);

/** The passages a Reel makes into a nearness: the shot each animation names with Near, a video at its own pace only; DEPTH_MAX at most, NEAR_MAX_SECONDS in all. */
export function nearPassages(plan: Pick<EditPlan, "segments" | "layers">, isVideo: (clipId: string) => boolean): SubjectPassage[] {
  const shots = plan.segments.filter(isClipSegment);
  const out: SubjectPassage[] = [];
  let seconds = 0;
  for (const layer of plan.layers ?? []) {
    for (const shot of nearsDrawn(layer.motion?.js)) {
      const s = shots[shot];
      if (!s || !isVideo(s.clip_id) || s.ramp || (s.speed && Math.abs(s.speed - 1) > 0.01)) continue;
      const key = nearKey(s.clip_id, s.in, s.out);
      const length = Math.max(0, s.out - s.in);
      if (out.some((p) => p.key === key) || out.length >= DEPTH_MAX || !length || seconds + length > NEAR_MAX_SECONDS) continue;
      out.push({ clip_id: s.clip_id, from: s.in, to: s.out, key });
      seconds += length;
    }
  }
  return out;
}

// ——— What the filler reads on her files (video_read.py, in the cut-out sandbox) ————————————————————————————————————

/** What can be read on a whole file for the filler: its fast camera moves, the moments its lens is covered, its colourfulness. */
export type FileReadKind = "moves" | "covered" | "colour";

/** The name of a file's own readings among its cut-outs (kept inline: a few moments and a number). */
export const fileKey = (mediaId: string) => `${mediaId}~file`;

/** A file's readings (video_read.py): its fast camera moves, the moments its lens is covered, how colourful it is. */
export const fileReadingSchema = z.object({
  seconds: z.number().optional(),
  moves: z
    .array(z.object({ from: z.number(), to: z.number(), kind: z.enum(["whip", "pan", "tilt", "rush", "pull"]), towards: z.enum(["left", "right", "up", "down", "in", "out"]), speed: z.number() }))
    .default([]),
  covered: z
    .array(z.object({ from: z.number(), to: z.number(), peak: z.number(), share: z.number(), colour: z.string().optional(), dark: z.boolean().optional(), enters: z.enum(["left", "right"]).optional() }))
    .default([]),
  colour: z.object({ score: z.number(), words: z.string(), best: z.object({ from: z.number(), to: z.number(), score: z.number() }).optional() }).optional(),
});
export type FileReading = z.infer<typeof fileReadingSchema>;

/**
 * A passage's clear areas (clear_area.py), as its file keeps them and the render reads them: its grid (cols × rows
 * cells, rows from the top: « 2 » the sky, « 1 » calm, « 0 » busy or out of the picture at some image), in its first
 * image's place, and the camera's move (s, dx, dy for each image, flat) when it moves.
 */
export const clearMapSchema = z
  .object({
    cols: z.number().int().min(2).max(256),
    rows: z.number().int().min(2).max(256),
    cells: z.string().regex(/^[012]+$/),
    motion: z.array(z.number()).optional(),
  })
  .refine((m) => m.cells.length === m.cols * m.rows, "cells");
export type ClearMap = z.infer<typeof clearMapSchema>;

/** The cut-outs kept on a video (media_assets.subjects), by passage: its file, or why it failed (tried again later). */
export const mediaSubjectsSchema = z.record(
  z.string(),
  z.union([
    z.object({
      path: z.string(),
      still: z.boolean(),
      at: z.string(),
      frames: z.number().optional(),
      keys: z.number().optional(),
      people: z.boolean().optional(),
      /** The top of the subject (its head) along the passage, as a share of the height: a word behind her goes above it. */
      top: z.number().optional(),
      /** Where the subject is at each image of the passage (shares: left, top, width, height; null when nothing is cut out). */
      boxes: z.array(z.array(z.number()).length(4).nullable()).optional(),
      /** Its outline at each image ({path}.contour.json: 64 points, x y shares, flat), for a line along its edge (Outline). */
      contour: z.string().optional(),
      /** The object followed through the passage (a cup she lifts), when it is one and not her. */
      object: z.string().optional(),
      /**
       * Its pieces (the letters of a sign, each window of « every window »), in reading order, as shares of its box on the
       * image it was found on (x, y, w, h, flat): SubjectParts places them on its box at every image.
       */
      parts: z.array(z.number()).optional(),
      /** Its depth at every image (a grey video, near white), not a cut-out: Depth draws it. */
      depth: z.boolean().optional(),
      /** Its clear areas (a JSON file: ClearMap), not a cut-out: ClearBox reads them. */
      clear: z.boolean().optional(),
      /** Its readings (a JSON file: ShotReading), not a cut-out: SkylineAt, VanishingPoint and LightUnder read them. */
      read: z.boolean().optional(),
      /** Her shot without its sky (a transparent video, or a PNG for a photo): Skyline draws it. */
      ground: z.boolean().optional(),
      /** Her shot with its depth as its transparency (near opaque, a WebM): Near draws it. */
      near: z.boolean().optional(),
    }),
    z.object({ failed_at: z.string(), error: z.string() }),
    /** A file's own readings, kept inline (no file): what the filler reads of it. */
    z.object({ file: fileReadingSchema, at: z.string() }),
  ]),
);
export type MediaSubjects = z.infer<typeof mediaSubjectsSchema>;

/** The files of a video's cut-outs (the retention removes them with it). */
export function subjectFiles(subjects: unknown): string[] {
  const parsed = mediaSubjectsSchema.safeParse(subjects ?? {});
  return parsed.success ? Object.values(parsed.data).flatMap((s) => ("path" in s ? [s.path, ...(s.contour ? [s.contour] : [])] : [])) : [];
}
