import { z } from "zod";
import { HOUSE_MODELS, houseModel } from "./house-models.ts";
import { filterWords, reelLink, type StolenStyle } from "./steal.ts";

// The Reels that may become one of Edith's models (chantier 3, its first part; Tristan: « un user donne un exemple de
// reel qu'elle voudrait, edith dit qu'il est pertinent d'en faire un modèle », « moi dans tous les cas je fais une
// veille de mon côté »). A Reel a business sends Edith by its link to copy is read for her copy as always (« Steal »,
// steal.ts); once everything she sees is done, one short judgement of that reading says whether its montage is a form
// any business could remake with its own footage (an effect, a layout, a rhythm, a text treatment, a transition: what
// a model of Edits or CapCut is), not content, and how close the nearest of Edith's models comes. A link Tristan
// proposes on /admin is read the same way and judged the same. One row per Reel however often it is sent: its public
// link, its reading, the judgement and a count of the requests, never who sent it. Tristan keeps or drops it on /admin;
// for now Claude Code writes the fiche and the model of one he keeps (docs/modeles.md, « La chaîne des modèles »).

export const CANDIDATE_SOURCES = ["steal", "admin"] as const;
/** First sent by a business to copy (steal), or proposed by Tristan (admin). */
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];
export const CANDIDATE_STATUSES = ["new", "kept", "dropped", "drafted"] as const;
/** new: for Tristan to look at; kept: « En faire un modèle »; dropped: by him or by the judgement; drafted: its model is written. */
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];
export const CANDIDATE_VERDICTS = ["new_form", "known", "content", "weak", "unreadable"] as const;
export type CandidateVerdict = (typeof CANDIDATE_VERDICTS)[number];
export type CandidatePlatform = "instagram" | "tiktok" | "youtube";

/** A form from this score is worth a model. */
export const SCOUT_PASS = 6;
/** From this closeness, a model already does its form. */
export const SCOUT_KNOWN_AT = 8;
/** What judging the Reels businesses send may cost in a day, all together: past it, a new Reel is not judged (a request is still counted). */
export const SCOUT_DAILY_EUR = 1;
/** The most one judgement is expected to cost (about a cent: a short reading, the models' names and pitches, a short answer). */
export const SCOUT_JUDGE_EUR = 0.02;

/** Whether one more judgement fits in the day: what was spent today, plus what it may cost. */
export const scoutAllows = (spentTodayEur: number, capEur = SCOUT_DAILY_EUR, nextEur = SCOUT_JUDGE_EUR) => spentTodayEur + nextEur <= capEur;

/** A text cut between two characters (never inside an emoji), at a word when it can be, its spaces collapsed. */
function cut(text: string | null | undefined, max: number): string {
  const chars = Array.from((text ?? "").replace(/\s+/g, " ").trim());
  if (chars.length <= max) return chars.join("");
  const head = chars.slice(0, max - 1).join("");
  const space = head.lastIndexOf(" ");
  return `${(space > head.length * 0.6 ? head.slice(0, space) : head).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * The key a Reel is known by, however its link was written (« instagram:DfLqTq6CgLL » for /reel/, /reels/, /p/, /tv/ or
 * an account's path; « tiktok:<id> »; « youtube:<id> »), its case kept (Instagram's codes have one); a short link
 * (vm.tiktok.com/…) is known by itself. Null when the text holds no link of a Reel.
 */
export function candidateKey(text: string): string | null {
  const found = reelLink(text);
  if (!found) return null;
  const { url, platform } = found;
  const id =
    platform === "instagram"
      ? /instagram\.com\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]+)/i.exec(url)?.[1]
      : platform === "tiktok"
        ? /tiktok\.com\/(?:.*\/)?(?:video|v|photo)\/(\d+)/i.exec(url)?.[1]
        : (/youtube\.com\/shorts\/([\w-]+)/i.exec(url) ?? /youtu\.be\/([\w-]+)/i.exec(url))?.[1];
  if (id) return `${platform}:${id}`;
  const [host = "", ...path] = url.replace(/^https?:\/\//i, "").split("/");
  return `${platform}:${[host.toLowerCase(), ...path].join("/").replace(/\/+$/, "")}`;
}

/** A link Tristan proposes on /admin: an Instagram Reel or a TikTok (the reading cannot open YouTube); null otherwise. */
export function proposedReel(text: string): { key: string; link: string; platform: "instagram" | "tiktok" } | null {
  const found = reelLink(text.trim());
  const key = candidateKey(text.trim());
  if (!found || !key || found.platform === "youtube") return null;
  return { key, link: found.url, platform: found.platform };
}

/** The network's own player for a Reel (Instagram's embed, TikTok's player, YouTube's): nothing kept, the real video. Null for a short link. */
export function reelEmbed(key: string): string | null {
  const [platform, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (!id || id.includes("/")) return null;
  if (platform === "instagram") return `https://www.instagram.com/reel/${encodeURIComponent(id)}/embed/`;
  if (platform === "tiktok") return `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?loop=1&rel=0&description=0`;
  if (platform === "youtube") return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  return null;
}

/** A reading as a candidate keeps it: without the sheets of a business's copy (files in its folder) nor a structure of its own. */
export function candidateReading(style: StolenStyle): StolenStyle {
  const kept = { ...style };
  delete kept.sheets;
  delete kept.outline;
  return kept;
}

/** What the judgement reads of a Reel: its form, layout, hook, texts, effect, moments and measures, in a few lines. */
export function readingDigest(style: StolenStyle) {
  const { look, measures } = style;
  const { text } = look;
  const laid = (look.shots ?? []).filter((s) => s.laid !== "aucun").length;
  return {
    format: look.format,
    layout: look.layout ?? "plein cadre",
    hook: `${look.hook.kind} : ${look.hook.what}`,
    texts: `${text.amount} ; ${text.composition}${text.subtitles ? " ; sous-titres" : ""}`,
    lettering: [text.case === "upper" ? "capitales" : "casse normale", text.weight, text.tracking, text.stress !== "none" ? `mot clé : ${text.stress}` : "", text.band !== "none" ? `fond : ${text.band}` : ""].filter(Boolean).join(", "),
    effect: filterWords(look) || "aucun",
    transitions: look.transitions,
    motion: look.motion,
    camera: look.camera,
    voice: look.voice,
    ...(look.moments?.length ? { moments: look.moments.slice(0, 8).map((m) => `${m.at} s : ${cut(m.what, 160)}`) } : {}),
    ...(laid ? { cut_outs: `${laid} plan${laid > 1 ? "s" : ""} sur ${look.shots!.length} avec un détourage posé par-dessus` } : {}),
    ending: look.ending,
    why: look.why,
    seconds: Math.round(measures.duration * 10) / 10,
    shots: measures.cuts.length + 1,
    ...(measures.bpm ? { bpm: Math.round(measures.bpm) } : {}),
    ...(look.generative ? { generative: look.generative } : {}),
    ...(look.to_film ? { to_film: look.to_film } : {}),
  };
}

/** Edith's models as the judgement compares a Reel with them: their key, name and what they do (about 2,000 tokens). */
export const scoutCatalogue = (): string => JSON.stringify(HOUSE_MODELS.map((m) => ({ key: m.key, name: m.name, does: m.pitch })));

/** What the judgement is given of a Reel: where it comes from and its reading, nothing of who sent it. */
export function scoutJudgeInput(input: { reading: StolenStyle; platform: CandidatePlatform; from: CandidateSource }): string {
  return JSON.stringify({
    from: input.from === "steal" ? "a business sent it to Edith to copy" : "the team proposed it",
    platform: input.platform,
    reel: readingDigest(input.reading),
  });
}

export const SCOUT_JUDGE_PROMPT = `You are the head of formats at Edith, which edits the Instagram Reels of neighbourhood businesses (a salon, a café, a studio, a shop, a restaurant…). Each of Edith's models is a montage form that works on any business's own footage, like a template of Edits or CapCut: an effect, a layout, a rhythm, a text treatment, a transition, a structure (a title that decodes like film credits, words in the four corners of the frame, a mosaic whose tiles never settle…), dressed in each business's own words, fonts and colours.

You get the reading of one short video, watched frame by frame (reel: its format, how its images fill the frame, its hook, its texts and their lettering, its effect, its moments at their times, its transitions, its ending, its measures), and Edith's models (their key, name and what they do). Say whether its form would make a new model:

- form: true only when what makes it work is a montage form another business could remake with its own footage. false for content: someone talking or dancing, a sketch, a product or a place simply shown, a tutorial whose interest is what it teaches, a trending sound over plain shots.
- nearest: the key of the model whose form is closest; closeness, 0 to 10: 10 the same form, 7 to 9 a variant a model could take with a setting or a small change, 4 to 6 one idea in common, 0 to 3 nothing alike.
- what_is_new: in French, at most 160 characters, what in its form no model does, concretely, as a motion designer would say it to remake it; never its content, its words or its brand. Empty when nothing is new.
- name: in French, the name of the model it would be, 2 to 4 words, without a brand (« Titre dans les fenêtres »).
- trades: in French, the 1 to 3 trades whose footage it would make look best (« coiffure », « restaurant », « boutique de vêtements »).
- needs: in French, at most 100 characters, what a business has to film for it.
- score, 1 to 10: 9 or 10 a striking new form that most businesses could film; 6 to 8 a good one; 1 to 5 content, a form a model already does, one too tied to its own subject, or one that needs what a business cannot film (generative AI, a drone, a studio set).
- why: in French, one sentence of at most 100 characters for the team.

What belongs to the original (its logo, its brand's colours and words, a mascot, its sign) is never its form. In your French, make no feminine or masculine agreement for the person who runs a business.`;

/** The judgement's answer, within the limits readAnswer brings it to. */
export const scoutJudgeSchema = z.object({
  form: z.boolean().describe("Whether what makes it work is a montage form another business could remake with its own footage; false for content"),
  nearest: z.string().max(40).describe("The key of Edith's model whose form is closest"),
  closeness: z.number().int().min(0).max(10).describe("How close its form is to that model, 0 to 10"),
  what_is_new: z.string().max(200).describe("In French: what in its form no model does, concretely; empty when nothing"),
  name: z.string().max(40).describe("In French: the name of the model it would be, 2 to 4 words, without a brand"),
  trades: z.array(z.string().max(40)).max(3).describe("In French: the 1 to 3 trades it suits best"),
  needs: z.string().max(140).describe("In French: what a business has to film for it"),
  score: z.number().int().min(1).max(10).describe("How good a model it would make, 1 to 10"),
  why: z.string().max(140).describe("In French: one sentence for the team"),
});
export type ScoutJudge = z.infer<typeof scoutJudgeSchema>;

/** The judgement as a candidate keeps it. */
export type ScoutJudgement = {
  verdict: Exclude<CandidateVerdict, "unreadable">;
  nearest: string | null;
  closeness: number | null;
  name: string;
  novelty: string;
  trades: string[];
  needs: string;
  score: number;
  why: string;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[«»"']/g, "").trim().toLowerCase();

/** A model named by its key, or by its name. */
const modelNamed = (said: string) => houseModel(said.trim().toLowerCase()) ?? HOUSE_MODELS.find((m) => fold(m.name) === fold(said));

/** The trades as chips: lowercase, without a full stop, each once, three at most. */
export const cleanTrades = (trades: string[]) =>
  [...new Set(trades.map((t) => cut(t, 40).toLowerCase().replace(/[.;,!]+$/, "").trim()).filter((t) => /\p{L}{2}/u.test(t)))].slice(0, 3);

/**
 * The verdict of the judgement: content when its montage is not a form; known when a model of Edith's comes as close
 * as SCOUT_KNOWN_AT (a nearest the judgement could not name is none); new_form from SCOUT_PASS; weak under it.
 */
export function readScoutJudge(answer: ScoutJudge): ScoutJudgement {
  const nearest = modelNamed(answer.nearest)?.key ?? null;
  const closeness = nearest === null ? null : Math.round(Math.min(10, Math.max(0, answer.closeness)));
  const score = Math.round(Math.min(10, Math.max(1, answer.score)));
  const verdict = !answer.form ? "content" : closeness !== null && closeness >= SCOUT_KNOWN_AT ? "known" : score >= SCOUT_PASS ? "new_form" : "weak";
  return { verdict, nearest, closeness, name: cut(answer.name, 40), novelty: cut(answer.what_is_new, 200), trades: cleanTrades(answer.trades), needs: cut(answer.needs, 140), score, why: cut(answer.why, 140) };
}

/** Where a Reel a business sent goes after its judgement: a new form for Tristan to look at, the others dropped (kept to count the next requests). */
export const statusOfVerdict = (verdict: CandidateVerdict): CandidateStatus => (verdict === "new_form" ? "new" : "dropped");

/** The verdicts as Tristan reads them. */
export const VERDICT_LABELS: Record<CandidateVerdict, string> = {
  new_form: "Nouvelle forme",
  known: "Un modèle le fait déjà",
  content: "Du contenu, pas une forme",
  weak: "Forme trop faible",
  unreadable: "Illisible",
};

/** How often businesses sent it to copy, for Tristan (none: never sent). */
export const requestsWords = (n: number): string | null => (n <= 0 ? null : n === 1 ? "Envoyé une fois à recopier" : `Envoyé ${n} fois à recopier`);
