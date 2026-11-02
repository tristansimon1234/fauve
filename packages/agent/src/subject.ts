import { z } from "zod";
import { isClipSegment, type EditPlan } from "./schemas.ts";

// Her subject cut out at every image of a passage of her video (apps/render/matte.py, in the cut-out sandbox), so
// a composition lays a text behind her as she walks, a title behind a hill, or her alone on a colour or on paper
// (Subject in the animations' scope). Only for the passages a composition asks it of (its code uses Subject), and
// within a budget: a moving subject costs up to a minute of the sandbox's work a second of video, a still one a single image.

/** The most seconds of video cut out for one Reel. */
export const SUBJECT_MAX_SECONDS = 12;

/** The name of a passage's cut-out: its clip and its seconds, to the hundredth (the same passage keeps it from one version to the next). */
export const subjectKey = (clipId: string, from: number, to: number) => `${clipId}@${from.toFixed(2)}-${to.toFixed(2)}`;

/** A composition's code that draws her subject. */
export const drawsSubject = (js: string | undefined) => Boolean(js && /\bSubject\b/.test(js));

/** A passage to cut out: its clip, its seconds, its name. */
export type SubjectPassage = { clip_id: string; from: number; to: number; key: string };

/**
 * The passages a Reel needs cut out: the video shots of a plan whose composition draws Subject, played at their own
 * pace (a speed or a ramp changes which images show), the first ones up to SUBJECT_MAX_SECONDS in all. Photos are
 * left out: their subject is the photo's cut-out (Cutout).
 */
export function subjectPassages(
  plan: Pick<EditPlan, "segments" | "layers">,
  isVideo: (clipId: string) => boolean,
): SubjectPassage[] {
  if (!(plan.layers ?? []).some((l) => l.compose && drawsSubject(l.motion?.js))) return [];
  const out: SubjectPassage[] = [];
  let seconds = 0;
  for (const s of plan.segments) {
    if (!isClipSegment(s) || !isVideo(s.clip_id) || s.ramp || (s.speed && Math.abs(s.speed - 1) > 0.01)) continue;
    const length = Math.max(0, s.out - s.in);
    if (!length || seconds + length > SUBJECT_MAX_SECONDS) continue;
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
    z.object({ path: z.string(), still: z.boolean(), at: z.string(), frames: z.number().optional(), keys: z.number().optional(), people: z.boolean().optional() }),
    z.object({ failed_at: z.string(), error: z.string() }),
  ]),
);
export type MediaSubjects = z.infer<typeof mediaSubjectsSchema>;

/** The files of a video's cut-outs (the retention removes them with it). */
export function subjectFiles(subjects: unknown): string[] {
  const parsed = mediaSubjectsSchema.safeParse(subjects ?? {});
  return parsed.success ? Object.values(parsed.data).flatMap((s) => ("path" in s ? [s.path] : [])) : [];
}
