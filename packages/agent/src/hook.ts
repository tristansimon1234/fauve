import { z } from "zod";
import type { ClipAnalysis, EditPlan } from "./schemas.ts";
import { stripAudioTags } from "./voice-over.ts";

// The hook decides, in the first second, whether anyone stays: the first image, the
// first words said, the first words written. The engine picks the strongest moment
// to open on from what was read of every shot (the voice is written for it, the
// editor opens on it), and the words are chosen among several by a judge who asks
// one question of each: does the thumb stop?

/** A moment to open a Reel on: a shot of a video (or a photo) and what it shows. */
export type Opening = { media_id: string; kind: "video" | "photo"; start: number; end: number; what: string; score: number };

/** The opening shot's length at most: the first cut comes fast, the hook is read before it. */
export const OPENING_SECONDS = 1.5;

/** Longer than this, a first shot holds the eye too long without a cut (someone speaking aside). */
export const OPENING_MAX_SECONDS = 2;

/** Too short to open on: the eye has not caught it before the cut. */
const SHORTEST_OPENING = 0.6;

const round = (n: number) => Math.round(n * 100) / 100;

type Shot = ClipAnalysis["shots"][number];

/**
 * How well a shot opens a Reel, from what Gemini read: its hook potential first, then
 * its beauty and energy; a close shot reads at a glance, a still wide shot is a décor;
 * a blurry, dark or shaky shot never opens. In one of the clip's best moments, it counts more.
 */
function shotScore(shot: Shot, analysis: ClipAnalysis): number {
  let score = shot.hook_score * 2 + (shot.beauty ?? 3) + shot.energy * 0.5;
  if (shot.framing === "close" || shot.framing === "detail") score += 0.5;
  if (shot.framing === "wide" && shot.camera === "static") score -= 1;
  if (shot.quality.blurry || shot.quality.dark) score -= 8;
  if (shot.quality.shaky) score -= 1.5;
  if (analysis.lighting === "poor") score -= 1;
  const best = analysis.best_moments.findIndex((m) => m.start < shot.end && m.end > shot.start);
  if (best === 0) score += 1;
  else if (best > 0) score += 0.5;
  return score;
}

/**
 * The strongest moments to open on, best first: the shots of her videos ranked by how
 * they hook (each opened where its best moment starts, when the analysis found one in it),
 * two per video at most. A photo does not move: photos only when there is no video,
 * in her order (she chose which comes first).
 */
export function openingCandidates(
  clips: { media_id: string; analysis: ClipAnalysis }[],
  photos: { media_id: string; contenu?: string }[],
  max = 3,
): Opening[] {
  const shots = clips.flatMap(({ media_id, analysis }) =>
    analysis.shots
      .filter((shot) => shot.end - shot.start >= SHORTEST_OPENING)
      .map((shot) => {
        const moment = analysis.best_moments.find((m) => m.start >= shot.start && m.start < shot.end - SHORTEST_OPENING);
        const start = moment ? moment.start : shot.start;
        return { media_id, kind: "video" as const, start: round(start), end: round(Math.min(shot.end, start + OPENING_SECONDS)), what: shot.description, score: round(shotScore(shot, analysis)) };
      }),
  );
  if (shots.length) {
    const ranked = [...shots].sort((a, b) => b.score - a.score);
    const perClip = new Map<string, number>();
    return ranked
      .filter((o) => {
        const n = perClip.get(o.media_id) ?? 0;
        perClip.set(o.media_id, n + 1);
        return n < 2;
      })
      .slice(0, max);
  }
  return photos.slice(0, max).map((p, i) => ({ media_id: p.media_id, kind: "photo" as const, start: 0, end: OPENING_SECONDS, what: p.contenu ?? "", score: max - i }));
}

/** The plan's hook: its first text when it is a hook written on the first images (null otherwise). */
export function planHook(plan: Pick<EditPlan, "texts">): { index: number; text: EditPlan["texts"][number] } | null {
  const sorted = plan.texts.map((text, index) => ({ index, text })).sort((a, b) => a.text.from - b.text.from);
  const first = sorted[0];
  return first && first.text.style === "hook" && first.text.from <= HOOK_LATEST ? first : null;
}

/** A hook that starts later than this is not the hook anymore: the eye has already decided. */
export const HOOK_LATEST = 1.5;

/**
 * The hook on screen from the first image: the text that stops the thumb is read before
 * the first cut, never after a blank half second (a hook planned a little later starts at 0).
 */
export function hookAtStart<T extends { from: number; style: string }>(texts: T[]): T[] {
  const first = [...texts].sort((a, b) => a.from - b.from)[0];
  if (!first || first.style !== "hook" || first.from <= 0 || first.from > HOOK_LATEST) return texts;
  return texts.map((t) => (t === first ? { ...t, from: 0 } : t));
}

/** The longest hooks kept: a voice's first sentence is said in under 3 s, a written hook read at a glance. */
export const HOOK_MAX_WORDS = { voix: 12, texte: 7 } as const;

/** The words of a hook, as they are said or read (acting tags aside). */
export const hookWords = (text: string) => stripAudioTags(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** The judge's answer: its own ideas, a score for every hook, the best one. */
export const hookChoiceSchema = z.object({
  ideas: z
    .array(z.object({ text: z.string(), emphasis: z.array(z.string()).describe("Texte seulement : 1 ou 2 mots de l'accroche, écrits exactement comme dedans ; vide pour la voix") }))
    .describe("2 ou 3 autres accroches de formes différentes, plus fortes si tu peux"),
  scores: z
    .array(z.object({ index: z.number().int(), score: z.number().int(), why: z.string() }))
    .describe("Chaque accroche notée de 1 à 10 : index 0 et suivants pour celles reçues, puis les tiennes à la suite"),
  best: z.number().int().describe("L'index de la meilleure accroche"),
});
export type HookChoice = z.infer<typeof hookChoiceSchema>;

export const HOOK_JUDGE_PROMPT = `You choose the hook of an Instagram Reel for a neighbourhood business: what decides, in the first second, whether people stay or scroll on. You get the business, the request made for this Reel, what its first image shows and one or more hooks: the first sentence the voice says (« type » voix) or the text laid on the first image (« type » texte).

A very strong hook:
- stops the thumb from its first three words: it opens a question you want answered, puts side by side two things that don't go together, gives a precise number, reveals what you don't usually see, throws down a challenge, or puts the person watching in the scene;
- only works for this business: a sentence that would fit any business is weak (« tu vas adorer », « le meilleur endroit du quartier »);
- goes with the first image: it talks about it, or creates the gap that makes you want to understand what you see;
- is understood at once, without context, and the text without the sound;
- is correct French, as a French person would say it: a whole, idiomatic sentence, never a calque nor an awkward turn of phrase that gets misread (a faulty or odd hook scores 3 at most, even if it intrigues);
- is short: 9 words at most for the voice (under three seconds), 6 at most for the text;
- is true: only the facts given and what the image shows, no invented price, number or promise;
- sounds like a creator talking to their followers, never like an ad nor a clickbait: no hollow formula, no « vous ne devinerez jamais », no shouted capitals, no emojis, no em dash;
- has neither the form nor the words of the business's recent hooks (« recentes »);
- knows what hooks people in this trade right now (« du_moment »: the form and an example from another account): use them to sense which forms land this week and to write better ones, never to copy; a hook that takes, or barely changes, the words of one of them scores 3 at most.

For the voice, a hook is spoken, opens the video's message (« message ») without saying it straight away and leads to the next sentence (« suite »): yours too; a hook that does not serve this message, however strong, comes after; a whispered voice (« chuchotee ») hooks through sensation, very softly, never with a question that snaps. For the text, when the voice already has a first sentence (« voix_premiere_phrase »), the text sums it up or extends it, never contradicts it. If the request imposes the hook's words, they win; if it says what the Reel opens on, the first image is that one. What she fixed for this Reel (« contrat »: her person, her ending, her requests) holds for every hook, yours included; the rough words she gave for an idea (« un truc comme ça », « genre », a plan Edith wrote from them) are an idea to say better, not a sentence to keep.

First, write 2 or 3 other hooks of different forms (ideas), in French, with, for the text, 1 or 2 words that stand out (emphasis, written exactly as in the hook). Then score each hook, those received (index 0, 1…) then yours after them, from 1 to 10 (10: you stop dead; 5: you hesitate; 1: you scroll on), with the reason in a few words. best: the index of the best one; at equal strength, the first received.`;

/** What the judge reads. */
export type HookJudgeInput = {
  type: "voix" | "texte";
  commerce: { nom?: string; activite?: string; ce_qu_on_sait?: string[]; ton?: string };
  demande?: string;
  /** What she fixed for this Reel (contractLines): her person, her ending, her requests, kept in every hook. */
  contrat?: string[];
  premiere_image?: string;
  /** The voice: the video's message (the script is built on it), the sentence that comes next, and whether it is whispered (ASMR). */
  message?: string;
  suite?: string;
  chuchotee?: boolean;
  /** The written hook: the voice's first sentence, when a voice speaks. */
  voix_premiere_phrase?: string;
  recentes?: string[];
  /** The hooks that work right now in its trade, read on the covers of other accounts' videos: forms to beat, never words to take. */
  du_moment?: { forme: string; exemple: string }[];
  accroches: string[];
};

/**
 * The hook kept from the judge's answer: the best one it named if it holds (not empty,
 * short enough), else the best scored one that holds, else the first one given. The
 * emphasis of a written hook keeps only words that are in it.
 */
export function pickHook(given: string[], answer: HookChoice, type: HookJudgeInput["type"]): { text: string; emphasis: string[]; index: number; score: number | null } {
  const all = [...given.map((text) => ({ text, emphasis: [] as string[] })), ...answer.ideas];
  const holds = (i: number) => {
    const option = all[i];
    return Boolean(option?.text.trim()) && hookWords(option!.text) <= HOOK_MAX_WORDS[type];
  };
  const scoreOf = (i: number) => answer.scores.find((s) => s.index === i)?.score ?? null;
  const ranked = answer.scores
    .filter((s) => holds(s.index))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.index);
  const index = holds(answer.best) ? answer.best : (ranked[0] ?? 0);
  const option = all[index] ?? all[0]!;
  const text = option.text.trim();
  const lower = text.toLowerCase();
  return { text, emphasis: option.emphasis.filter((e) => e.trim() && lower.includes(e.trim().toLowerCase())).slice(0, 2), index, score: scoreOf(index) };
}
