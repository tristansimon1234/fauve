import { z } from "zod";
import { captionStyle, isClipSegment, type EditPlan } from "./schemas.ts";

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

/** The calls of its functions (`SubjectBox(shots[2], f, box, "the cup")`): the shot, and the object's name when one is given last. */
const CALLS = /\bSubject(?:Box|Outline)\(\s*([^,)]*)(?:,[^;]*?)?(?:,\s*["'`]([^"'`]+)["'`])?\s*\)/g;
const OBJECT_PROP = /\bobject\s*[:=]\s*\{?\s*["'`]([^"'`]+)["'`]/;
const SHOT_PROP = /\bshot\s*[:=]\s*\{?\s*((?:shots\s*\[\s*)?\d+)/;

/**
 * A composition's code that draws her subject (the person, or what stands in front: what its cut-out keeps): any use
 * of Subject, SubjectBox, SubjectOutline or Outline that does not name an object (with one, it is that object, not
 * her). Counted on every mention, so a tool used another way (aliased, in a list) still has her cut out.
 */
export function drawsSubject(js: string | undefined): boolean {
  if (!js) return false;
  const mentions = js.match(/\b(?:Subject|SubjectBox|SubjectOutline|Outline)\b/g)?.length ?? 0;
  const forObjects = toolProps(js).filter((props) => OBJECT_PROP.test(props)).length + [...js.matchAll(CALLS)].filter((m) => m[2]).length;
  return mentions > forObjects;
}

/** An object's name as kept: lower case, its spaces single (« The coffee cup » and « the coffee cup » are one). */
export const objectName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);

/** The name of an object's passage: the passage's, then the object's. */
export const objectKey = (clipId: string, from: number, to: number, name: string) => `${subjectKey(clipId, from, to)}#${objectName(name)}`;

/**
 * The objects a composition's code follows (a cup she lifts, a product she shows, a ball): by shot (its index in
 * shots, written as a number or shots[n]) and name, from Subject or Outline given `object` (compiled or as JSX), and
 * SubjectBox or SubjectOutline given a name last. A shot written as a variable is not read.
 */
export function objectsDrawn(js: string | undefined): { shot: number; name: string }[] {
  if (!js) return [];
  const found = new Map<string, { shot: number; name: string }>();
  const add = (shot: string | undefined, name: string | undefined) => {
    const n = /^(?:shots\s*\[\s*)?(\d+)\s*\]?$/.exec((shot ?? "").trim());
    const named = name ? objectName(name) : "";
    if (n && named) found.set(`${n[1]}#${named}`, { shot: Number(n[1]), name: named });
  };
  for (const props of toolProps(js)) add(SHOT_PROP.exec(props)?.[1], OBJECT_PROP.exec(props)?.[1]);
  for (const m of js.matchAll(CALLS)) add(m[1], m[2]);
  return [...found.values()];
}

/**
 * A plan that draws her cut out: an animation that uses Subject (a composition, or one laid over the montage: a word
 * behind her as she walks on a shot played full frame), a composition about to be written (anticipate), or what is said
 * written around her (its strong words behind her).
 */
export const wantsSubjects = (plan: Pick<EditPlan, "layers"> & { subtitles?: boolean; captions?: EditPlan["captions"]; finish?: EditPlan["finish"] }, anticipate = false) =>
  (plan.layers ?? []).some((l) => (l.compose && anticipate) || drawsSubject(l.motion?.js)) || Boolean(plan.subtitles && captionStyle(plan) === "kinetic");

/** What asks for her cut out before any code is written: her background replaced, a word behind her, her silhouette. */
export const CUT_OUT_WORDS = /\bfond\b|d[ée]tour|derri[eè]re (moi|elle|lui|la personne)|silhouette|d[ée]coup[ée]e?\b|background|behind (me|her|him)|cut.?out/i;

/** A passage to cut out: its clip, its seconds, its name. */
export type SubjectPassage = { clip_id: string; from: number; to: number; key: string };

/**
 * The passages a Reel needs cut out: the video shots of a plan whose composition draws Subject, played at their own
 * pace (a speed or a ramp changes which images show), the first ones up to SUBJECT_MAX_SECONDS in all. Photos are
 * left out: their subject is the photo's cut-out (Cutout).
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

/** The most objects followed for one Reel, and the most seconds of video they take (each one is read on its whole passage). */
export const OBJECT_MAX = 4;
export const OBJECT_MAX_SECONDS = 20;

/** A plan whose animations follow an object (Subject, SubjectBox, SubjectOutline or Outline given its name): a composition, or one laid over the montage. */
export const wantsObjects = (plan: Pick<EditPlan, "layers">) => (plan.layers ?? []).some((l) => objectsDrawn(l.motion?.js).length > 0);

/** An object to follow through a passage of her video: the passage, and the object's name. */
export type ObjectPassage = SubjectPassage & { name: string };

/**
 * The objects a Reel's compositions follow, each through the passage of the shot its code names: her shot n is the
 * plan's n-th shot (video or photo, as the composition's shots list them), a video at its own pace only (a speed or a
 * ramp changes which images show); OBJECT_MAX at most, OBJECT_MAX_SECONDS in all.
 */
export function objectPassages(plan: Pick<EditPlan, "segments" | "layers">, isVideo: (clipId: string) => boolean): ObjectPassage[] {
  const shots = plan.segments.filter(isClipSegment);
  const out: ObjectPassage[] = [];
  let seconds = 0;
  for (const layer of plan.layers ?? []) {
    for (const { shot, name } of objectsDrawn(layer.motion?.js)) {
      const s = shots[shot];
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
