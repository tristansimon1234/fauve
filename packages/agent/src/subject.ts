import { z } from "zod";
import { captionStyle, isClipSegment, segmentSeconds, type EditPlan } from "./schemas.ts";

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
 * The passages a Reel needs cut out: the video shots of a plan whose composition draws Subject, played at their own
 * pace (a speed or a ramp changes which images show), the first ones up to SUBJECT_MAX_SECONDS in all. Photos are
 * left out: their subject is the photo's own cut-out, made once (subjectPhotoIds), which Subject draws on them too.
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
  const out: SubjectPassage[] = [];
  let seconds = 0;
  for (const s of plan.segments) {
    if (!composed && seconds >= budget) break;
    if (!isClipSegment(s) || !isVideo(s.clip_id) || s.ramp || (s.speed && Math.abs(s.speed - 1) > 0.01)) continue;
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

/** The most objects followed for one Reel, and the most seconds of video they take (each one is read on its whole passage). */
export const OBJECT_MAX = 4;
export const OBJECT_MAX_SECONDS = 20;

/** A plan whose animations follow an object (Subject, SubjectBox, SubjectOutline or Outline given its name): a composition, or one laid over the montage. */
export const wantsObjects = (plan: Pick<EditPlan, "layers">) => (plan.layers ?? []).some((l) => objectsDrawn(l.motion?.js).length > 0);

/** An object to follow through a passage of her video, or to find on one of her photos (`photo`: one image, from 0 to 0): the passage, and the object's name. */
export type ObjectPassage = SubjectPassage & { name: string; photo?: true };

/** The most photos an object is looked for on in one Reel (one image each: a second of the card's time or so). */
export const PHOTO_OBJECT_MAX = 6;

/** The name of a photo's cut-outs among its own (media_assets.subjects): the photo is one image, from 0 to 0. */
export const photoKey = (mediaId: string) => subjectKey(mediaId, 0, 0);

/**
 * The objects a Reel's compositions follow, each through the passage of the shot its code names: her shot n is the
 * plan's n-th shot (video or photo, as the composition's shots list them), a video at its own pace only (a speed or a
 * ramp changes which images show); OBJECT_MAX at most, OBJECT_MAX_SECONDS in all.
 */
export function objectPassages(plan: Pick<EditPlan, "segments" | "layers">, isVideo: (clipId: string) => boolean): ObjectPassage[] {
  const shots = plan.segments.filter(isClipSegment);
  // When each shot is on screen (seconds; a fade's overlap, a few tenths, left aside): a shot written as a variable is any shot under the animation.
  let at = 0;
  const spans = plan.segments.flatMap((s) => {
    const from = at;
    at += segmentSeconds(s);
    return isClipSegment(s) ? [{ from, to: at }] : [];
  });
  const out: ObjectPassage[] = [];
  let seconds = 0;
  let photos = 0;
  for (const layer of plan.layers ?? []) {
    const under = shots.flatMap((_, i) => (spans[i]!.to > layer.from + 0.05 && spans[i]!.from < layer.to - 0.05 ? [i] : []));
    for (const { shot, name } of objectsDrawn(layer.motion?.js).flatMap((o) => (o.shot === ANY_SHOT ? under.map((i) => ({ shot: i, name: o.name })) : [o]))) {
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
    }),
    z.object({ failed_at: z.string(), error: z.string() }),
  ]),
);
export type MediaSubjects = z.infer<typeof mediaSubjectsSchema>;

/** The files of a video's cut-outs (the retention removes them with it). */
export function subjectFiles(subjects: unknown): string[] {
  const parsed = mediaSubjectsSchema.safeParse(subjects ?? {});
  return parsed.success ? Object.values(parsed.data).flatMap((s) => ("path" in s ? [s.path, ...(s.contour ? [s.contour] : [])] : [])) : [];
}
