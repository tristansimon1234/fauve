import { z } from "zod";
import { editorOutputSchema } from "./editor.ts";
import { motionSceneOutputSchema } from "./motion-scene.ts";
import { sheetSpan } from "./house-sheets.ts";

// One director for a composed Reel (Tristan: « on a vraiment besoin d'un réalisateur et d'un monteur ? », « il voit
// aussi images par images ? »): a new Reel that follows a model (one of Edith's, or a Reel she sends to copy) is cut
// and composed by one mind, which sees what it remakes and what it is made with: the original frame by frame (its
// sheets) and her files (a sheet of ten frames per video, each photo). It writes the plan and the composition's code
// in one answer, the code is checked like any animation's (and fixed by the motion designer when it fails), then it
// looks at its Reel as it renders, each image next to the original at the same point, and fixes everything: the
// cuts, the texts, the code. Gemini still reads every clip (its words, its faces, its gestures); the editor's other
// Reels (a voice, a correction, no model) are made as before.

export const DIRECTOR_PROMPT = `You are also this Reel's director: nobody cuts or composes it after you. Its form comes from the Reel it remakes (brand.reel_a_recopier: the Reel she sent to copy, or the model of Edith's it is made in), and you make the whole of it in one answer: the plan (her passages, their order and length, the texts, the tempo, the form) and, when it is composed (form composition: her shots laid otherwise than one after the other full frame), the code of that composition, written with the motion design kit below (it is the composition a motion designer would write: same contract, same checks).

What you see, before the JSON
- The original: sheets of ten frames each, in order (left to right, then top to bottom), each with its span in seconds. Watch it frame by frame: what is on screen at each moment, where each element sits and how big, how it comes in and leaves, how long each thing holds, where the cuts fall, how the type is drawn. That is what you remake, moment by moment, with her images and her words. Its reading (reel_a_recopier) puts words on it; the frames are the truth.
- Her files: one sheet of ten frames per video over its whole length (its media_id and its length on it), and each photo (its media_id). Choose her passages from what you see as much as from the clips' reading: for each moment of the original, the frame of hers that plays the same part (the same kind of shot, the same energy, a face where it has one, the product where it shows one).

Faithful as reel_a_recopier.origine says: the same moments in the same order, the same layout, the same type (its size, weight, case and place), the same pace and about the same length, unless her request changes it; a model dressed in her charter takes her fonts and colours and keeps the rest of the model.

The composition (composition, only for form composition; null otherwise)
- One component, as the kit says, that lays the shots of YOUR plan in your order (shots[i], each with from and durationInFrames in frames: the engine settles each cut on the beat and around words, and may split a shot where someone pauses, so always read the timing and the number of shots from shots, never seconds you wrote), draws each text of your plan during its moment (reelTexts) and the end, and everything else on screen: the ground, the frames, the type.
- Write it for the plan of this same answer. composition.name: its name in a few French words (she sees it); composition.notes: its idea in one sentence; photos and fonts as the kit says.
- It is checked before the Reel is made (each text whole, readable, long enough, off faces, inside the safe zone); one that fails goes to a motion designer with the reason, so write it to pass.`;

/** The turn where the director looks at its Reel as it renders, next to the original. */
export const DIRECTOR_LOOK_NOTE = `Your Reel as it renders now: each image shows your version on the left and the original at the same point on the right, with the instant. Look at it the way a director looks at a cut before delivering it, as the person who scrolls, on a phone, then as the person who made the original. Does the first image stop the thumb as the original's does? Is each moment of the original there, in its order, with the same layout and the same weight of type? Is every word readable at a glance (its size, its contrast with what is under it), whole, where the original puts it? Does the idea carry every second, or is there a stretch where nothing of it happens? Is a passage of hers wrong for its moment (a shot that does not play the part, too long, too short, off the beat)? Is anything cut, crowded, too small or too slow?
Fix everything that is wrong, the cuts and the passages included: answer the whole plan and the whole composition again, with keep false. When nothing needs fixing, answer keep true (your plan and code are then kept as they are). These are stills: a word half drawn just after it starts is coming in, not a fault; a title meant to pass behind her that shows in front of her had its cut-out not ready yet.`;

/** The composition the director writes with its plan: the motion designer's answer for it, without slots or sounds. */
export const directorCompositionSchema = motionSceneOutputSchema.pick({ code: true, notes: true, name: true, photos: true, fonts: true, subtitle_y: true });

/** The director's answer: the editor's plan and rationale, its composition when the Reel is composed, and after a look whether it keeps its Reel. */
export const directorOutputSchema = editorOutputSchema.extend({
  composition: directorCompositionSchema.nullable().optional(),
  keep: z.boolean().optional().describe("After a look at your Reel only: true when nothing needs fixing (plan and composition are then kept as they were)"),
});
export type DirectorOutput = z.infer<typeof directorOutputSchema>;

/**
 * The instant of the original matching an instant of her Reel: the same point of it, scaled to its length when the two
 * differ by more than a tenth (a 12 s remake of a 22 s model), else the same second.
 */
export function originalInstant(t: number, reelDuration: number, originalDuration: number): number {
  if (!(originalDuration > 0) || !(reelDuration > 0)) return Math.max(0, t);
  const ratio = originalDuration / reelDuration;
  const at = Math.abs(ratio - 1) > 0.1 ? t * ratio : t;
  return Math.min(Math.max(0, at), originalDuration);
}

/** The sheet and its frame (five by two, left to right then top to bottom) nearest an instant of the original. */
export function sheetCell(sheets: { from: number; to: number }[], t: number): { sheet: number; col: number; row: number } | null {
  if (!sheets.length) return null;
  const end = sheets.at(-1)!.to;
  const step = sheetSpan(end) / 10;
  const index = Math.max(0, sheets.findIndex((s, i) => t < s.to || i === sheets.length - 1));
  const sheet = sheets[index]!;
  // The frames a sheet holds: ten, fewer on the last one (it ends with the original).
  const frames = Math.max(1, Math.min(10, Math.ceil((sheet.to - sheet.from) / step - 1e-6)));
  const k = Math.min(frames - 1, Math.max(0, Math.round((t - sheet.from) / step)));
  return { sheet: index, col: k % 5, row: Math.floor(k / 5) };
}

/** A director's plan with nothing to show: the same answer, its look said kept. */
export const keptLook = (answer: DirectorOutput | null | undefined): boolean => Boolean(answer?.keep);
