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

export const CLIP_SORT_PROMPT = `Tu ranges une vidéo que la gérante d'un commerce vient d'envoyer, sans dire à quoi elle sert.

Tu reçois ce qu'on voit dans la vidéo (lue par un modèle vidéo) et les publications des prochains jours qui attendent de la matière, avec leur idée et, quand il y en a une, la mission de tournage (ce qu'on lui a demandé de filmer).

Choisis la publication à laquelle cette vidéo sert le mieux : d'abord une mission qui demande exactement ça, puis une publication dont l'idée colle. Si aucune ne colle vraiment, réponds post_id null : la vidéo reste dans sa banque de plans pour plus tard. Ne force jamais : une vidéo de la salle n'est pas une vidéo d'un plat. sure n'est vrai que si c'est clairement la bonne.`;

/** Keeps a sort only when it names a candidate and is sure of it. */
export function acceptedSort(sort: ClipSort, candidates: ReadonlySet<string>): string | null {
  return sort.sure && sort.post_id && candidates.has(sort.post_id) ? sort.post_id : null;
}
