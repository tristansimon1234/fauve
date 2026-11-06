import { formatOnly, type ReelContract } from "./contract.ts";
import type { MontageSkill } from "./skills.ts";
import type { FollowedStyle } from "./steal.ts";

// A Reel she sends to copy that one of Edith's models already does is played by that model's skill (Tristan: « il faut
// capitaliser sur ce qu'on sait faire au lieu de réinventer, ça coûte beaucoup plus cher de réinventer à chaque fois »):
// one small filler call and the model's coded composition (0,10 to 0,30 €), instead of the editor and the motion
// designer reinventing it (about 1 €, and less sure). Its nearest model is the judgement of its form the scout makes
// (model-scout.ts), read when its montage is designed (copyNearest in apps/web/src/lib/model-scout.ts); the Reel is
// dressed like her copy, and the filler can still say it does not fit: the chain then makes it, as before.

/** From this closeness of its form (0 to 10), the Reel she sent is played by its nearest model. */
export const COPY_BY_MODEL_AT = 8;

/** The nearest of Edith's models for a Reel she sent to copy (its key), and how close its form is, 0 to 10. */
export type CopyNearest = { key: string; closeness: number };

/**
 * A skill that lays a voice over its Reel (her voice note, Edith's voice, the words she gives it to say: docs/voix.md,
 * « Une voix sur un modèle »; Tristan: « et sur un modèle on peut ajouter une voix off ? »): any of Edith's models but
 * the two timed on her own filmed talk (SkillVoice: « Mot clé en grand », « Face caméra et références »), whose Reel is
 * what she says to the camera, where a voice off makes no sense.
 */
export const laysVoice = (skill: Pick<MontageSkill, "voice"> | null | undefined): boolean => Boolean(skill && !skill.voice);

/**
 * Her request asks for what no montage skill does: a layout of her own (never a format alone, « en vertical plein
 * écran »: its frame, a model's format setting, formatOnly); a voice over her Reel or the words of a voice, unless the
 * skill playing it lays one (`laid`: one of Edith's models she or Edith chose, laysVoice), when the voice is there (her
 * words with no voice recorded for them, its reading failed, stay the chain's, as before). A Reel she sent to copy keeps
 * the chain for a voice.
 */
export function beyondSkills(contract: Pick<ReelContract, "layout" | "voice_text" | "voice_text_rest"> | undefined, voice: boolean, laid = false): boolean {
  if (contract?.layout && !formatOnly(contract.layout)) return true;
  const words = Boolean(contract?.voice_text || contract?.voice_text_rest);
  return laid ? words && !voice : voice || words;
}

/**
 * Whether the Reel she copies may be played by one of Edith's models, before its nearest is looked for: a Reel she sent
 * (never one of Edith's models, which plays its own skill, nor one of hers kept as a model), nothing she asks that no
 * skill does, and for a correction, a version made on a skill (one the chain made is corrected by the chain).
 */
export function mayCopyByModel(input: {
  followed: Pick<FollowedStyle, "house" | "own"> | undefined;
  contract?: Pick<ReelContract, "layout" | "voice_text" | "voice_text_rest">;
  voice: boolean;
  correction: boolean;
  /** The skill the version a correction corrects was made on. */
  previousSkill?: string | null;
}): boolean {
  const { followed } = input;
  if (!followed || followed.house || followed.own) return false;
  if (beyondSkills(input.contract, input.voice)) return false;
  return !input.correction || Boolean(input.previousSkill);
}

/**
 * The skill that plays the Reel she sent: its nearest model's, from COPY_BY_MODEL_AT, one this studio plays (`skillOf`:
 * the model's skill once gated, skillGate) and her files fill, as when Edith picks a model while the Reel is made (she is
 * never asked for more files then); none otherwise.
 */
export function copyByModel<S extends Pick<MontageSkill, "files">>(nearest: CopyNearest | null | undefined, skillOf: (key: string) => S | undefined, files: number): S | undefined {
  if (!nearest || !Number.isFinite(nearest.closeness) || nearest.closeness < COPY_BY_MODEL_AT) return undefined;
  const skill = skillOf(nearest.key);
  return skill && files >= skill.files[0] ? skill : undefined;
}

/**
 * Words wanted in a skill's optional slots: a model Edith picked as the Reel's form gives the form, never the silence
 * (`dressed`); a Reel she sent that a model plays (`copied`) has words when that Reel has some, none when it has none
 * (what it does not have, her Reel does not have), whatever dresses it.
 */
export function skillWordsWanted(skill: Pick<MontageSkill, "texts">, followed: Pick<FollowedStyle, "dressed" | "look">, copied = false): boolean {
  if (!skill.texts.length || skill.texts.some((t) => t.required)) return false;
  return copied ? followed.look.text.amount !== "aucun" : Boolean(followed.dressed);
}

/**
 * The tempo a model plays her copy at when she keeps the sound of the Reel she sent (posts.music, mode « model » without
 * a sound she follows: she adds it in Instagram, the Reel silent): that Reel's measured tempo, its cuts on its beats from
 * the first image, as the chain's are (its first beat is not measured); none without a steady beat, or with a music of
 * Edith's (the model at its own tempo), or with the sound she follows (its own measure).
 */
export function keptSoundTempo(music: { mode?: string; sound?: unknown }, bpm: number | null | undefined): { bpm: number; offset: number } | undefined {
  return music.mode === "model" && !music.sound && bpm ? { bpm, offset: 0 } : undefined;
}

/**
 * What Edith says of it, in the note she writes on the post: one sentence, nothing more (the delivery says none of it),
 * and never the model that played it (Tristan, 6 November: « je préfère ne pas divulguer nos modèles »).
 */
export const COPY_BY_MODEL_WORDS = "J'ai repris sa forme et son rythme, avec tes images et tes mots.";
