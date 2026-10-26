import { z } from "zod";

// She sends videos as they come, a few at a time, without saying what they
// are for: each one, once watched (clip analysis), is put on the publication
// of the coming days it fits, its filming mission ticked off. What fits
// nothing stays in her bank of shots. No retrieval index is needed: a studio
// has a handful of open publications, compared in one call.

/** How far ahead a video can be sorted to a publication. */
export const SORT_DAYS_AHEAD = 14;

export const clipSortSchema = z.object({
  post_id: z.string().nullable().describe("La publication à laquelle cette vidéo sert, ou null si aucune ne lui va vraiment"),
  sure: z.boolean().describe("true seulement si la vidéo correspond clairement à ce que la publication ou sa mission demande"),
  why: z.string().describe("En quelques mots, pour la gérante : ce qu'on voit et pourquoi c'est pour cette publication"),
});
export type ClipSort = z.infer<typeof clipSortSchema>;

export const CLIP_SORT_PROMPT = `You sort a video that the manager of a business has just sent without saying what it is for.

You get what is seen in the video (read by a video model) and the posts of the coming days that are waiting for material, with their idea and, when there is one, the filming mission (what she was asked to film).

Choose the post this video serves best: first a mission that asks for exactly this, then a post whose idea fits. If none really fits, answer post_id null: the video stays in her bank of shots for later. Never force it: a video of the room is not a video of a dish. sure is true only when it is clearly the right one. Write why in French: it is for her.`;

/** Keeps a sort only when it names a candidate and is sure of it. */
export function acceptedSort(sort: ClipSort, candidates: ReadonlySet<string>): string | null {
  return sort.sure && sort.post_id && candidates.has(sort.post_id) ? sort.post_id : null;
}
