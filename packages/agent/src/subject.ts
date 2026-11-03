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

/** A composition's code that draws her subject. */
export const drawsSubject = (js: string | undefined) => Boolean(js && /\bSubject\b/.test(js));

/** A plan that draws her cut out: a composition that uses Subject, or what is said written around her (its strong words behind her). */
export const wantsSubjects = (plan: Pick<EditPlan, "layers"> & { subtitles?: boolean; captions?: EditPlan["captions"]; finish?: EditPlan["finish"] }, anticipate = false) =>
  (plan.layers ?? []).some((l) => l.compose && (anticipate || drawsSubject(l.motion?.js))) || Boolean(plan.subtitles && captionStyle(plan) === "kinetic");

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
  // Only the opening passages for the captions alone; a composition that draws her (or will: anticipate), as many as the budget holds.
  const composed = (plan.layers ?? []).some((l) => l.compose && (anticipate || drawsSubject(l.motion?.js)));
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
    }),
    z.object({ failed_at: z.string(), error: z.string() }),
  ]),
);
export type MediaSubjects = z.infer<typeof mediaSubjectsSchema>;

/** The files of a video's cut-outs (the retention removes them with it). */
export function subjectFiles(subjects: unknown): string[] {
  const parsed = mediaSubjectsSchema.safeParse(subjects ?? {});
  return parsed.success ? Object.values(parsed.data).flatMap((s) => ("path" in s ? [s.path] : [])) : [];
}
