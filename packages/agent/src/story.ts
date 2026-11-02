import { editPlanSchema, type ClipAnalysis, type EditPlan } from "./schemas.ts";
import type { ReelLook } from "./looks.ts";

// A story made in one go (Instories' animated stories, the engine's way): one of her photos or a
// passage of her video, one sentence over it (« 2 places ce soir », « le plat du jour ») and a detail
// under it when she gives one (an hour, a price), in her charter, moving like her Reels (a slow push
// on a photo, in relief when its subject cuts out), with Edith's music. No editor, no motion designer:
// the plan is written here, then finished and rendered like a montage. Cheap and quick, for the
// everyday stories that make people come (and book, with « Avec un lien »).

/** How long a story lasts on screen: a photo's (Instagram shows one 5 s), a video's passage at most. */
export const STORY_PHOTO_SECONDS = 5;
export const STORY_VIDEO_SECONDS = 7;
/** The shortest passage of a video a story keeps. */
const STORY_VIDEO_MIN = 3;
/** Its tempo: lively without rushing (its music is composed at it). */
const STORY_TEMPO = 96;

/** Her words on a story: one sentence, and a detail under it. */
export const STORY_TEXT_MAX = 60;
export const STORY_DETAIL_MAX = 40;

const round = (n: number) => Math.round(n * 100) / 100;

/** Where a video's story starts: its best moment, else its strongest opening shot, else its start; the passage kept inside the clip. */
export function storyPassage(analysis: Pick<ClipAnalysis, "duration" | "best_moments" | "shots">): { in: number; out: number } {
  const length = Math.min(STORY_VIDEO_SECONDS, analysis.duration);
  const opening = [...analysis.shots].sort((a, b) => b.hook_score - a.hook_score)[0];
  const wanted = analysis.best_moments[0]?.start ?? opening?.start ?? 0;
  const start = Math.max(0, Math.min(wanted, analysis.duration - Math.max(STORY_VIDEO_MIN, length)));
  return { in: round(start), out: round(Math.min(analysis.duration, start + length)) };
}

/**
 * The plan of a story express: her photo (or her video's passage) full frame, her sentence on it
 * from the first image (a key message with its detail under it when she gives one), a look when
 * she asks for one. To be normalized and finished like any plan (framing, light, the photo's move).
 */
export function storyPlan(input: { mediaId: string; photo: boolean; analysis?: Pick<ClipAnalysis, "duration" | "best_moments" | "shots">; text: string; detail?: string; look?: ReelLook | null }): EditPlan {
  const passage = input.photo || !input.analysis ? { in: 0, out: STORY_PHOTO_SECONDS } : storyPassage(input.analysis);
  const duration = round(passage.out - passage.in);
  const text = input.text.trim().slice(0, STORY_TEXT_MAX);
  const detail = input.detail?.trim().slice(0, STORY_DETAIL_MAX);
  return editPlanSchema.parse({
    format: "9:16",
    duration,
    template: "libre",
    tempo: STORY_TEMPO,
    segments: [{ clip_id: input.mediaId, in: passage.in, out: passage.out, zoom: "none" }],
    texts: [{ text, from: 0, to: round(duration - 0.2), style: "hook", ...(detail ? { items: [{ title: detail }] } : {}) }],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    ...(input.look ? { look: input.look } : {}),
  });
}
