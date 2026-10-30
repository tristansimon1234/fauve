import { EFFORTS, type Effort } from "./effort.ts";
import type { PostKind } from "./schemas.ts";
import type { PublishWhen } from "./when.ts";

// « Créer », in one screen: she gives her photos and videos, Edith says what she
// will make of them (the format she advises, the day it goes out) and starts. Then
// what the working screen shows while the Reel is made, and the two answers to
// « Je le publie vendredi à 18 h ? » that need no model turn.

/** What she picked. */
export type Picked = { videos: number; photos: number };

/** A Reel as soon as something moves (and before anything is picked), a carousel for several photos, a photo post for one. */
export function advisedFormat(p: Picked): PostKind {
  if (p.videos > 0 || p.photos === 0) return "reel";
  return p.photos >= 2 ? "carousel" : "post";
}

/** Why Edith advises that format, in a sentence. */
export function formatWhy(p: Picked): string {
  const advised = advisedFormat(p);
  if (advised === "reel") return "Je te conseille un Reel : tes vidéos bougent, et c’est le format qu’Instagram montre le plus.";
  if (advised === "carousel") return "Je te conseille un carrousel : tes photos se suivent comme une petite histoire.";
  return "Avec une seule photo, un post photo suffit. Tu peux aussi en faire une story, ou un Reel qui la fait vivre.";
}

/** Clips and photos in one Reel: a creator's tour often runs on 15 to 20 short clips. */
export const MAX_MONTAGE_FILES = 20;

/** Photos in a carousel: what Instagram's publishing API takes. */
export const MAX_CAROUSEL_PHOTOS = 10;

/** Why a format does not fit these files (null: it does). A Reel takes anything. */
export function formatBlocked(kind: PostKind, p: Picked): string | null {
  const total = p.videos + p.photos;
  if (kind === "carousel") return p.videos ? "Avec des photos seulement" : p.photos < 2 ? "Il faut au moins 2 photos" : p.photos > MAX_CAROUSEL_PHOTOS ? `${MAX_CAROUSEL_PHOTOS} photos au plus` : null;
  if (kind === "post") return p.videos || p.photos !== 1 ? "Une seule photo" : null;
  if (kind === "story") return total !== 1 ? "Une seule photo ou vidéo" : null;
  return null;
}

/** « ta vidéo », « tes 3 vidéos et ta photo ». */
export function mediaPhrase(p: Picked): string {
  const part = (n: number, one: string, many: string) => (n === 1 ? one : n > 1 ? `tes ${n} ${many}` : "");
  return [part(p.videos, "ta vidéo", "vidéos"), part(p.photos, "ta photo", "photos")].filter(Boolean).join(" et ") || "tes fichiers";
}

/** A publication's title from what she imagines, cut at a word (empty when she wrote nothing). */
export function intentionTitle(intention: string): string {
  const text = intention.trim().replace(/\s+/g, " ").slice(0, 300);
  return text.length > 60 ? `${text.slice(0, 60).replace(/\s+\S*$/, "")}…` : text;
}

/** The question the Créer screen asks her, for the format she makes (Tristan: « demande lui juste ce que tu imagines pour ce post / reel, ou une ref »). */
export function imagineQuestion(kind: PostKind): string {
  const what = { reel: "ce Reel", carousel: "ce carrousel", post: "ce post", story: "cette story" }[kind];
  return `Qu’est-ce que tu imagines pour ${what} ?`;
}

/** What she imagines, as the montage reads it, and the voice over written before it. */
export const imaginedBrief = (idea: string): string | undefined => (idea.trim() ? `Ce que la gérante imagine : ${idea.trim()}` : undefined);

export type CreationPhase = "watch" | "edit" | "second" | "render" | "review";

/** How long a Reel made by the effects agent takes, as she reads it. */
export const EFFECT_MINUTES = "10 à 30";

// Measured, not hoped (Tristan: « la production d'un reel est bcp plus longue que ce qui est
// indiqué »): his Rapide composition took 19 min (the motion designer writes ~30 000 tokens
// in 9 min, the render takes 7 min), his corrections 11 to 35 min.
/** A correction of a Reel (« Plus court », « Plus rythmé », a voice): a new montage at the studio's level. */
export const REDO_MINUTES = "10 à 20";
/** Only the video made again (her words, her text sizes, without the voice): checks, render, music. */
export const RERENDER_MINUTES = "3 à 8";

/**
 * The steps of a Reel in the making, as she reads them, for this level of care. A Reel
 * with an effect (the effects agent makes it, with its own checks): the effect, then the music.
 */
export function creationSteps(effort: Effort, p: Picked, music: boolean, effect = false): { phase: CreationPhase; label: string }[] {
  if (effect) {
    return [
      { phase: "watch", label: `Je regarde ${mediaPhrase(p)}` },
      { phase: "edit", label: "Je fais ton effet image par image et je vérifie chaque geste" },
      { phase: "render", label: music ? "Je pose la musique" : "Je finis la vidéo" },
    ];
  }
  return [
    { phase: "watch" as const, label: `Je regarde ${mediaPhrase(p)}` },
    { phase: "edit" as const, label: p.videos ? "Je garde les plus beaux moments et j’écris les textes" : "Je choisis l’ordre et j’écris les textes" },
    ...(EFFORTS[effort].versions > 1 ? [{ phase: "second" as const, label: "J’essaie une deuxième version" }] : []),
    { phase: "render" as const, label: music ? "Je monte la vidéo et je compose la musique" : "Je monte la vidéo" },
    ...(EFFORTS[effort].review ? [{ phase: "review" as const, label: "Je vérifie tout une dernière fois" }] : []),
  ];
}

/**
 * Where the montage is, from its stage (credit_quotes.stage, null until the job starts)
 * and whether its videos have been watched (the design step watches them first).
 * A correction after the review renders again: the screen never steps back (it keeps the furthest step).
 */
export function creationPhase(stage: string | null, watched: boolean): CreationPhase {
  if (stage === "effects") return "edit";
  if (stage === "alternative") return "second";
  if (stage === "render") return "render";
  if (stage === "review" || stage === "fix") return "review";
  return stage === "design" && watched ? "edit" : "watch";
}

/**
 * « Je le publie maintenant ? » (Tristan : « la programmation sert à rien », « mais les rappels
 * oui »): nothing goes out on its own at a set time; with a good moment ahead, Edith says she
 * will remind her then (« Sinon je te fais signe vendredi à 18 h »).
 */
export function publishQuestion(when: PublishWhen | null, upcoming: boolean): string {
  return when && upcoming ? `Je le publie maintenant ? Sinon je te fais signe ${when.short}, le bon moment pour le poster.` : "Je le publie maintenant ?";
}

/** A reminder is sent at most this long after its moment (the cron missed it, or it was set in the past). */
export const REMINDER_GRACE_HOURS = 36;

const KIND_WORDS: Record<string, string> = { reel: "ton Reel", carousel: "ton carrousel", post: "ta photo", story: "ta story" };

/** The reminder at the moment Edith suggested: the post, then the same question and buttons as a delivery. */
export function reminderMessage(kind: string, title: string, platforms: string[], byHand = false): string {
  const where = platforms.includes("tiktok") ? "sur Instagram et TikTok" : "sur Instagram";
  const name = title.trim() ? ` « ${title.trim().slice(0, 60)} »` : "";
  const what = `C’est le bon moment pour poster ${KIND_WORDS[kind] ?? "ta publication"}${name} ✨`;
  // She posts it herself: one touch on « Partager » on its page, its caption copied before.
  if (byHand) return `${what} Ouvre sa page sur ton téléphone et touche « Partager » : Instagram s’ouvre avec, sa légende déjà copiée.`;
  return `${what} Je le publie maintenant ${where} ?`;
}

/** The buttons under that question, on WhatsApp and in the app. */
export const PUBLISH_OFFER_OPTIONS = ["Oui, publie-le", "Je regarde d’abord"];

/**
 * Her answer to that question, or to the draft_ready template's buttons (« Oui, vas-y »,
 * « Je veux le voir »): only the buttons' own words; anything else goes to Edith.
 */
export function publishOfferAnswer(text: string | null | undefined): "yes" | "look" | null {
  const said = (text ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[\s!.]+$/, "")
    .trim();
  if (said === "oui, publie-le" || said === "oui publie-le" || said === "oui, vas-y" || said === "oui vas-y") return "yes";
  if (said === "je regarde d'abord" || said === "je veux le voir") return "look";
  return null;
}
