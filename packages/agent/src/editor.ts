import { z } from "zod";
import { compositionBrief, composedLayers } from "./compose.ts";
import { planTimeline } from "./motion.ts";
import { renderDuration } from "./render.ts";
import { hookAtStart } from "./hook.ts";
import { snapToTempo, TEMPLATE_BPM } from "./tempo.ts";
import { isReelEffect, REEL_EFFECTS } from "./looks.ts";
import { applySpeechCuts, spokenShot, type SpeechFacts } from "./speech.ts";
import {
  cameraMoveSchema,
  MAX_SPEED,
  MIN_SPEED,
  segmentSeconds,
  editPlanObjectSchema,
  editPlanSceneSegmentSchema,
  editPlanSchema,
  editPlanSegmentSchema,
  editPlanTextSchema,
  isClipSegment,
  isMotionSegment,
  motionTemplateSchema,
  sceneSchema,
  SLOT_NAME,
  type EditPlan,
  type MotionTemplate,
  type PlanSegment,
} from "./schemas.ts";
import type { SavedLook } from "./text-look.ts";

// Fauve's editor: one dedicated Opus call (high effort, structured output) that
// turns clip analyses + the studio's brand into an edit plan for the motion
// templates. The WhatsApp conversation only calls it; it never edits itself.

export const EDITOR_SYSTEM_PROMPT = `You are the editor at Edith, an AI community manager for local businesses (their trade is in « studio.business »: a florist, a pizzeria, a hair salon, a Pilates studio, an app…). From what the manager filmed on her phone, and its analysis, you cut an Instagram / TikTok Reel that looks cut by hand by an excellent creator: alive, modern, native to the feed, never an ad. What it is for: making people nearby want to come or try (a profile visit, a booking, a message), not views for their own sake.

How the work is shared. You decide the story: which shots, in what order and for how long, what is written on screen and when, which moments carry an animation and what each one says. The form of an animation (its layout, shapes, place on screen, movement, colours) is the motion designer's: it sees the Reel's images before writing and reads her request itself, while you see neither the frame nor where the subtitles fall, so a form or a place written blind lands on a face, on the subtitles, or against what she asked. An engine then executes your plan exactly and finishes it: the light, the framing on the subject, a slow move on shots filmed still, texts kept off faces and away from the animations, cuts snapped to the beat. The music is composed afterwards, at your tempo.

Who decides, in this order:
0. « contrat », when there is one: what she fixed herself for this Reel (her on-screen text word for word, the layout, the length, the ending, an invitation or none, her other demands). Follow it to the letter: a layout that is not full-frame shots one after the other (a split screen, half and half…) is the form « composition »; a length asked for is the Reel's length; « Aucune invitation »: no call at the end.
1. Her request for this Reel (« request »): her exchange with Edith for this Reel, word for word, then Edith's brief, which is Edith's reading of it, then what she said of her recent Reels (her taste). Where Edith's reading and her own words differ, her words win. A « Piste d'Edith » is Edith's proposal, not a plan she validated: keep what serves.
2. The Reel she copies (« reel_a_recopier »): its form, its pace (« plan_moyen_s », « tempo_bpm »), the form of its hook, how much text it has and how it is set, its effect, transitions and ending, with her images and words of her own.
3. Your defaults as an editor, below: what you do when she says nothing, never obligations against her.
So her request and the Reel she copies come before your defaults: what they don't have or set aside (a written hook, an invitation at the end, animations, text, a loop), this Reel doesn't have; what they have or ask for, it takes (more text, long shots, an opening on a place, an ending with no call). What her request does not say, your defaults decide.

Never constrained without knowing it. When a real limit keeps you from doing exactly what she asks (45 s at most, the animations allowed, a gesture that no video shows or only out of the vertical frame, an existing song), do the closest and tell her in « rationale », with what she can do. Never ask her to write, complete or lengthen a text: the words are your job. A voice shorter than the length she asked for: the images hold the length, an ending carried by the music; with no length asked for, the Reel ends shortly after the voice.

What you receive:
- « clips »: each video cut into « shots » as the analysis read them (what happens, the subject and where it is, « sujet_a », « framing », « camera », « beauty » 1 to 5, energy, « hook_score », quality, faces); its « best_moments »; what is said (« words »); what people do (« actions », each gesture timed, « mains »: whether the hands show in the Reel's vertical frame); what the hands really do, measured frame by frame (« mains_suivies », to trust over « actions » when they differ).
- « photos »: what each photo shows and its format. « openings »: the strongest moments to open on, best first (a voice over written for this Reel speaks of the first one in its first phrase). « voice »: her voice note or Edith's voice over, from « starts_at » to « ends_at », its « phrases » already on the Reel's clock.
- « studio.facts »: what is known of the business (its site, what she said, who appears on screen). « brand »: her charter and taste. « recent_hooks »: the hooks of her latest Reels. « templates »: animations already made. « max_new_scenes »: the new animations this Reel allows. « previous_plan »: the version to correct.

The look comes from her charter (« brand »: fonts, colours, titles, key word, light), and the engine applies it. Her charter is a starting point, not a cage: when her request or the Reel she copies needs something else (a font, a universe, other colours for an animation), take that liberty for this Reel and keep her charter for the rest. Fill « fonts » (display, body: a Google Fonts family by its exact name, or one of « brand.own_fonts ») and « colors » only then; a copied Reel's font is already set by the engine, its colours are yours to take or leave (« reel_a_recopier.couleurs »). Follow her « art_direction », then her « moodboard ». « lessons »: what works on her Instagram. « inspirations »: Reels she likes, their spirit, never their content; « post.chosen_inspiration » first. « post.chosen_template »: « collage » if she chose that form; an older choice (doux, dynamique, chic) only says the energy she wants. « text_looks »: her text styles; when one suits a text's role, its exact name goes in « look_name », the same for every text of that role.

The pace. « tempo » (70 to 130 BPM) is chosen for this Reel from her request, her images and her business, never by habit: the cuts fall on its beats, the music is composed at it, and the texts and camera follow its energy. Around 76 to 90 feels calm, 95 to 110 lively, 115 to 128 punchy. « Plus calme » or « plus rythmé » asks for a change she can feel (15 BPM or more).

What you know as an editor (defaults, not a checklist: the footage and her request may call for something else):
- The story first, from the footage and the request: a hook that raises a question, a middle that develops it, an ending that rewards. Forms that work, varied from one Reel to the next, never moulds: told (a voice tells it, its words as subtitles); key message (« post.format » = « message clé »: no voice, one message held in the same place for most of the Reel, a short title and at most two details in « items », over lively shots, no animation on top); the gesture then the result; before / after; a burst of photos; POV or a visit; the person behind it; close-ups that make people want it; the offer (the experience first, then the offer); a mini tutorial.
- The first second decides whether people stay, and most watch without sound. Open on your best shot, one that moves (the result, a face, a clear gesture), from « openings » unless her request says what to start with, and move on within a second or so; an empty room, a still set, a logo or a text screen loses them. The hook text, about six words, is on screen from the first frame (« from » 0) and opens a curiosity that belongs to this business (a question, a number, a « pov : », a precise promise), never its name nor a line that would fit any business. No hook text when « reel_a_recopier » has none (it opens on a gesture, with no text) or her request wants none. Its form and words change from « recent_hooks ». If she prefers not to show herself (« studio.facts »), open on the result, a gesture or her hands.
- She chose these files for this Reel: each clip and photo is used at least once, unless her request leaves one out. Take the most beautiful and lively passages; leave out only seconds that are really blurred, dark or shaken (a bad sound rules nothing out). In and out points stay within the clip.
- The order tells the story: from wide to close, grouped by place, cutting in the movement; two shots of the same size on the same subject in a row read as a mistake, unless it is a jump cut you mean (« punch »).
- Rhythm keeps people watching: a lively Reel changes shot every second or two (two seconds on average at most), lengths that vary so it never feels like a slideshow, tightening towards the strong moment, which holds 2 to 3.5 s; every few seconds something renews attention (another angle or size, sometimes a punch or a slow motion), never one more text for that. Someone speaking keeps their whole sentence (up to 8 s, cut on a silence): the engine cuts its « euh » and long pauses (jump cuts), never you. Approximate lengths are fine: the engine snaps them to the beat.
- « move »: none on a shot that already moves; in, out, left or right (slow), varied, on a shot filmed still; punch (a tight reframe, held) for a jump cut on the beat, once or twice in a Reel, since it stops working when repeated. « speed »: 1 as filmed; 0.5 (slow motion, made smooth and ramped on the gesture by the engine) for the one gesture or result that deserves it, over that gesture; 1.5 to 2 to pass over a long gesture. A shot lasts (out − in) / speed on screen.
- The ending rewards: the most beautiful shot, held 2 to 3 s, with a short invitation (a precise act drawn from her offer: come, book, try) or a reason to send it to someone; the last image echoes the first when the footage allows. « end_card » only for an offer or an announcement, or when she asks: a final card looks like an ad.
- The examples in quotes in these instructions show a form, never words to reuse.

Texts on screen, few and strong: Reels that work let the images speak, and each text competes with the image and the subtitles. The hook (« hook »), then two other texts at most (the copied Reel's amount when it has more or none; a typography animation counts as a text): « band » for the offer or what makes the business unique (five words or so), « caption » for a short phrase. « emphasis »: words written exactly as in the text; a strong number there shows very large. Write like a creator talking: short phrases with a verb, in lowercase, never a slogan without a verb nor an ad formula. The words come from the business (« studio.facts », her request, her offer): never a fact it doesn't have (a price, an offer, hours, an address, a number). Word-by-word « subtitles » only when someone speaks and it helps. The engine places the texts and moves those that would fall during an animation that writes words.

Animations (motion design), over her video, never instead of it:
- Where they serve: the moment where words matter (the promise, the offer, a number, a short list), 1.5 to 3 s each; usually 0 to 2 per Reel, and a Reel can have none. Her request decides first, within « max_new_scenes » (otherwise say so in « rationale »).
- You write what each one says, never how it looks. Its « brief » (600 characters at most) gives the message and why it matters at that moment, the exact words on screen in « », what happens in the footage under it, and the energy. What she asked herself about its form (a text that grows between her fingers, a universe she names: a cartoon, a manga, a film; the look of the Reel she copies) goes in it in her words, with the gesture it hangs on and each time it comes back, with its timings (« mains_suivies »). One of her photos can enter an animation: write its media_id in the brief. « fallback »: the still version shown if the animation fails (title, list, quote or number).
- « over_clip »: the media_id of the video or photo that keeps playing under it.
- « layers » (from, to: seconds of the Reel): an animation over the montage when the idea runs across several shots (a character who comes back, a counter, a frame) or lives with what happens in a shot: the engine knows where the hands, faces and bodies are, so an animation can start from a gesture, hold on to it or follow someone. Lay it over the shot where that happens, cut long enough, on a gesture whose hands are « dans le cadre ». Each counts as a new animation (a collage's or a composition's aside).
- « form »: « montage », her shots one after the other, full frame; « collage », when she asks for it or it serves this Reel and her art direction; « composition », when the form she asks for, or the copied Reel's, does not fit in full-frame shots (a split screen, a shot set in a frame or a window, several shots at once). In a collage or a composition the motion designer composes the whole Reel with her shots: you cut as usual (the order and length of her shots, the texts) and write it in « layers », from 0 to the end, its brief saying what the Reel tells, its strong moments, its energy, and the form she asked for or the copied Reel's, in their words. It does not count in « max_new_scenes ».
- « templates »: animations already made, each at most once per Reel. Reuse one only when its idea truly serves this moment, not for its subject alone (template_id, template_texts within its max_chars, a one-sentence brief, fallback); otherwise order your own. At most « max_new_scenes » new animations.
- With no video and no photo: a Reel made entirely of animations (3 to 5) in the brand's colours.

Photos: a photo is a shot like a clip (clip_id = its media_id, in = 0, out = how long it shows: 1.2 to 3 s, 0.5 s in a burst, 5 at most). The engine reframes it, corrects its light and decides its movement (most stay still, cut on the beat); a « move » only when it serves (a punch on a detail). A Reel of photos lives by its pace: one idea per photo, never two neighbours that show the same thing; with videos, a photo extends the shot before it, never in a block at the end. A burst, once at most: 3 to 6 photos of one theme at 0.5 s, with no text over it.

Her voice (« voice »): the Reel is cut on it and lasts at least « ends_at » + 1.5 s (45 s at most). Cut on her phrases, never inside a word; each shot shows what she is saying; her first phrase carries at least two shots. Her words are the subtitles (« subtitles » true), on screen all along: the hook (3 to 6 words) sits on her first phrase and sums it up; another text only when it brings what the voice doesn't say, or her request wants it; one animation by default, since the subtitles already carry the words.

Her first Reel (« first_reel ») is how she discovers what Edith can do: it should make her say « waouh » within a second: her most beautiful shot with the promise in an animation over it, her best shots in a real story, little text, a lively pace, an ending on the most beautiful shot, the animations allowed (usually 2) over her images. Her request and « reel_a_recopier » still come first.

Transitions and effects stay invisible: « transitions » « cut » almost always, « fade » only for a calm Reel with long shots; no strong zoom on every shot. The engine puts one signature transition on the shot where your « band » appears. « effect »: « dust » (a discreet film dust) for a key message or a retro, night or handmade mood; a look (« disposable » camera, « vhs », « y2k » flash, « cine », « bw ») only when her request or « reel_a_recopier » has one; « none » most of the time.

« duration »: the sum of the shots' lengths on screen. 7 to 15 s for an announcement or a mood, 20 to 30 s for a story; up to 45 s only when someone speaks or a voice tells it all along, or when the Reel she copies is that long; never over 45 s.

A correction starts from « previous_plan » and applies exactly what is asked, without changing the rest. « Améliore-la » changes everything that makes it average, not only the flaw she named; a request about style changes mostly the form (pace, camera, texts, animations) and keeps the messages. An animation that stays keeps its brief word for word: the engine recognises it by its brief and keeps its code, while a changed brief is written again from scratch. One her request touches, or whose shots change, is rewritten with her words in its brief (it replaces the old one and does not count in « max_new_scenes »). An animation she asked for never disappears. The « form » and the composition (« composition_du_reel ») keep the same brief unless her request touches them: then add what must change, in her words (what must stay readable or visible), never a form of yours.

Language: what she reads is in French (the texts on screen, « items », « template_texts », the fallback, « end_card », « rationale »). Briefs are in English, with her words and the words on screen quoted in French, exactly.

« rationale »: one sentence for her, in French, addressing her as « tu », about your main choice (« J'ouvre sur la pizza qui sort du four et je finis sur la tablée. »). When a limit kept you from doing exactly what she asked, or the gesture she asked for is missing from her videos (or out of the frame), a second sentence says so simply, with what she can do (film the gesture for a few seconds, facing the camera, the hand in the frame), without apologising. It describes the plan as it will render, its real length included.`;

/** Motion segment as the editor writes it: a brief and a fallback (the code comes later), or a template to reuse. */
const editorMotionSegmentSchema = z.object({
  motion: z.object({
    // No max here: structured output does not enforce one, a long brief would fail the whole plan.
    brief: z.string().min(1),
    fallback: sceneSchema,
    template_id: z.uuid().optional(),
    template_texts: z.array(z.object({ slot: z.string(), text: z.string() })).optional(),
  }),
  duration: z.number().min(1).max(8),
});

/**
 * A text as the editor writes it: a saved look is named (look_name), never copied
 * out in full. The full look schema (fonts, colours, backgrounds, lists) made the
 * structured-output grammar too large for the API; the look is put back after.
 */
const editorTextSchema = editPlanTextSchema.omit({ look: true, detail_look: true, x: true, y: true, scale: true, backdrop: true }).extend({
  look_name: z.string().optional().describe("Exact name of a style from brand.text_looks to apply to this text; otherwise nothing (her charter applies)"),
});

/**
 * The Reel's rhythm as the editor chooses it for each Reel (no ambiance any more): its tempo,
 * and its form: shots full frame one after the other, a collage, or a composition (a split
 * screen, a shot in a frame…: Tristan, on a split-screen Reel copied as a slideshow, « ça n'a
 * rien à voir »), the last two drawn whole by the motion designer. No bounds here (structured output does not enforce them):
 * fromEditorPlan keeps the tempo between 70 and 130.
 */
const editorRhythm = {
  tempo: z.number().describe("This Reel's tempo in beats per minute: 70 (calm) to 130 (punchy)"),
  form: z
    .enum(["montage", "collage", "composition"])
    .describe(
      "montage: her shots one after the other, full frame; collage: the collage form; composition: her shots laid otherwise than full frame (a split screen, a shot in a frame, several at once); collage and composition: the motion designer composes the whole Reel, written in layers from 0 to the end",
    ),
};

/**
 * The editor's answer before the camera work came in: kept as the fallback if the API
 * refuses the current schema (structured-output grammars have limits of their own).
 */
export const editorOutputSchemaLegacy = z.object({
  plan: editPlanObjectSchema.omit({ voice: true, layers: true, template: true, tempo: true }).extend({
    ...editorRhythm,
    texts: z.array(editorTextSchema),
    // Retouch and blur are set by their own tools and carried over (carryRetouch), never written by the editor.
    // No signature transition field here: the structured-output grammar is at the API's
    // limit (400 « compiled grammar is too large »); the engine places it (signatureShot).
    segments: z.array(z.union([editPlanSegmentSchema.omit({ adjust: true, blur: true, photo: true, accent: true, ramp: true }), editPlanSceneSegmentSchema, editorMotionSegmentSchema])).min(1),
  }),
  rationale: z.string(),
});

/** A shot as the editor writes it: a passage of a clip or a photo, the camera's move on it, its speed. */
const editorShotSchema = z.object({
  clip_id: z.string(),
  in: z.number(),
  out: z.number(),
  move: z
    .string()
    .describe("Camera move: none (as filmed), in (slow push in), out (slow pull out), left or right (slow pan), punch (a tight reframe, held, for a jump cut on the beat)"),
  speed: z.number().describe("Speed: 1 as filmed; 0.5 slow motion on a strong gesture; 1.5 to 2 to pass quickly over a long gesture"),
});

/** An animation as the editor writes it, with the footage that keeps playing under it. */
const editorAnimationSchema = z.object({
  motion: z.object({
    brief: z.string(),
    fallback: sceneSchema,
    template_id: z.string().optional(),
    template_texts: z.array(z.object({ slot: z.string(), text: z.string() })).optional(),
  }),
  duration: z.number(),
  over_clip: z.string().optional().describe("media_id of the video or photo that keeps playing under the animation"),
});

/**
 * What the editor answers. Kept small on purpose (the API compiles it into a grammar
 * with limits): no fixed-scene branch, no images, no format, no patterns; the engine
 * adds the rest (retouch, framing, footage passages, the signature transition).
 */
export const editorOutputSchema = z.object({
  plan: z.object({
    duration: z.number(),
    ...editorRhythm,
    segments: z.array(z.union([editorShotSchema, editorAnimationSchema])).min(1),
    texts: z.array(editorTextSchema),
    transitions: z.enum(["cut", "fade", "light_zoom"]),
    subtitles: z.boolean(),
    fonts: z.object({ display: z.string().optional(), body: z.string().optional() }).optional(),
    colors: z
      .array(z.string())
      .optional()
      .describe(
        "This Reel's own colours (hex, the main one first, 3 at most), only when it needs others than her charter's: the Reel she copies has its own (« reel_a_recopier.couleurs ») and they serve this Reel and her request, or her request asks for a world of its own. Otherwise leave it out. A correction keeps the previous version's unless you write others (her charter's to go back to them)",
      ),
    end_card: z.object({ title: z.string(), subtitle: z.string().optional() }).optional(),
    effect: z.enum(["none", ...REEL_EFFECTS]).optional(),
    layers: z.array(z.object({ brief: z.string(), from: z.number(), to: z.number() })).optional(),
  }),
  rationale: z.string(),
});

/**
 * The Reel's signature transition: a short zoom for a lively Reel (and a collage), a
 * brand-colour wipe for a calm one (100 BPM and up is lively; an older Reel: by its ambiance).
 */
export function signatureTransition(template: MotionTemplate, tempo?: number): "punch" | "wipe" {
  if (template === "libre") return (tempo ?? TEMPLATE_BPM.libre) >= 100 ? "punch" : "wipe";
  return template === "dynamique" || template === "collage" ? "punch" : "wipe";
}

/** The tempo the editor may choose (beats per minute). */
export const MIN_TEMPO = 70;
export const MAX_TEMPO = 130;

/**
 * In a correction, an animation whose brief did not change keeps its code, its photos and its
 * library id before the budget of new animations is counted (a correction allows none): only
 * the ones the editor rewrote are new. Without this, an animation over several shots, which
 * the editor writes back as a brief, was counted as new and left out of every correction.
 */
export function keepWrittenAnimations(plan: EditPlan, previous: EditPlan | null): EditPlan {
  if (!previous) return plan;
  const written = new Map(
    [...previous.segments.filter(isMotionSegment).map((s) => s.motion), ...(previous.layers ?? []).map((l) => l.motion)]
      .filter((m) => m.js)
      .map((m) => [m.brief, m] as const),
  );
  if (!written.size) return plan;
  const keep = <M extends { brief: string; js?: string; template_id?: string }>(m: M): M => {
    const kept = m.js || m.template_id ? undefined : written.get(m.brief);
    return kept
      ? {
          ...m,
          code: kept.code,
          js: kept.js,
          ...(kept.photos ? { photos: kept.photos } : {}),
          ...(kept.fonts ? { fonts: kept.fonts } : {}),
          ...(kept.template_id ? { template_id: kept.template_id } : {}),
        }
      : m;
  };
  // A composition the editor left out of a correction stays as it was: a collage none of whose animations spans
  // the Reel, or another composed Reel that only got the composition added for want of one (compositionBrief).
  const composition = previous.layers?.find((l) => l.compose && l.motion.js);
  const spans = (plan.layers ?? []).some((l) => l.from <= 0.5 && l.to >= plan.duration - 0.5);
  const added = (l: NonNullable<EditPlan["layers"]>[number]) => l.compose && !l.motion.js && l.motion.brief === compositionBrief(plan);
  const layers = !composition
    ? plan.layers
    : plan.layers?.some(added)
      ? plan.layers.map((l) => (added(l) ? composition : l))
      : plan.template === "collage" && !spans
        ? [composition, ...(plan.layers ?? [])]
        : plan.layers;
  return {
    ...plan,
    segments: plan.segments.map((s) => (isMotionSegment(s) ? { ...s, motion: keep(s.motion) } : s)),
    ...(layers ? { layers: layers.map((l) => ({ ...l, motion: keep(l.motion) })) } : {}),
  };
}

/**
 * A correction that leaves the composition as it is (her request redraws nothing: `redraw` false in its
 * contract) keeps the composition's code, whatever brief the editor wrote back for it: it lays the new shots
 * and draws the new texts it is given when the Reel renders, so it is never written again (each rewrite
 * cost about $0.45; Tristan: « pourquoi la correction refait tout, c'est une hérésie »). Left out of the new
 * plan, it comes back over the whole Reel.
 */
export function keepComposition(plan: EditPlan, previous: EditPlan | null): EditPlan {
  const earlier = previous?.layers?.find((l) => l.compose && l.motion.js);
  if (!earlier) return plan;
  if (!plan.layers?.some((l) => l.compose)) return { ...plan, layers: [{ ...earlier, from: 0, to: plan.duration }, ...(plan.layers ?? [])] };
  return { ...plan, layers: plan.layers.map((l) => (l.compose ? { ...l, motion: { ...earlier.motion } } : l)) };
}

/**
 * In a correction, how many animations of the version corrected the new plan no longer keeps
 * as they were (their brief rewritten, or left out; a collage's composition aside): each one
 * rewritten takes the place of one of them, on top of the budget of new animations. Without
 * this, an animation rewritten for its new shots was dropped from the correction: the « -20 % »
 * a manager asked to catch between her fingers vanished from the version that fixed the rest.
 */
export function replacedAnimations(plan: EditPlan, previous: EditPlan | null): number {
  if (!previous) return 0;
  const motions = (p: EditPlan) => [...p.segments.filter(isMotionSegment).map((s) => s.motion), ...(p.layers ?? []).filter((l) => !l.compose).map((l) => l.motion)];
  const now = motions(plan).filter((m) => m.js || m.template_id);
  const briefs = new Set(now.map((m) => m.brief));
  const ids = new Set(now.flatMap((m) => (m.template_id ? [m.template_id] : [])));
  return motions(previous).filter((m) => m.js && !briefs.has(m.brief) && !(m.template_id && ids.has(m.template_id))).length;
}

/** The retouch and blur of each clip in the previous version, kept on the same clip in the new one. */
export function carryRetouch(plan: EditPlan, previous: EditPlan | null): EditPlan {
  if (!previous) return plan;
  const byClip = new Map(previous.segments.filter(isClipSegment).map((s) => [s.clip_id, { adjust: s.adjust, blur: s.blur, photo: s.photo }]));
  return {
    ...plan,
    segments: plan.segments.map((s) => {
      if (!isClipSegment(s)) return s;
      const kept = byClip.get(s.clip_id);
      return kept ? { ...s, ...(kept.adjust ? { adjust: kept.adjust } : {}), ...(kept.blur ? { blur: kept.blur } : {}), ...(kept.photo ? { photo: kept.photo } : {}) } : s;
    }),
  };
}
export type EditorOutput = z.infer<typeof editorOutputSchema>;
export type EditorOutputLegacy = z.infer<typeof editorOutputSchemaLegacy>;

/**
 * The style set on a text by hand or by Fauve (look, place, size, background), kept on
 * the same text in a correction: the editor does not write them back. Matched by the
 * same words, else by the same role in the same order.
 */
export function carryTextStyle(plan: EditPlan, previous: EditPlan | null): EditPlan {
  if (!previous) return plan;
  const key = (t: string) => t.trim().toLowerCase();
  const byText = new Map(previous.texts.map((t) => [key(t.text), t]));
  const byRole = (style: string, n: number) => previous.texts.filter((t) => t.style === style)[n];
  const seen: Record<string, number> = {};
  return {
    ...plan,
    texts: plan.texts.map((t) => {
      const n = (seen[t.style] = (seen[t.style] ?? -1) + 1);
      const before = byText.get(key(t.text)) ?? byRole(t.style, n);
      if (!before) return t;
      return {
        ...t,
        ...(t.look || !before.look ? {} : { look: before.look }),
        ...(t.detail_look || !before.detail_look ? {} : { detail_look: before.detail_look }),
        ...(before.x !== undefined ? { x: before.x } : {}),
        // Her hand's place stays; one the engine chose is worked out again for this version's shots.
        ...(before.y !== undefined && !before.auto_y ? { y: before.y } : {}),
        ...(before.scale !== undefined ? { scale: before.scale } : {}),
        ...(before.backdrop !== undefined ? { backdrop: before.backdrop } : {}),
      };
    }),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The editor's plan as an edit plan: template texts become the segment's `texts` record. */
/**
 * The shot that gets the Reel's one signature transition: where the band (what
 * makes the business unique, or the offer) appears, the strong moment; none
 * without a band, when the band starts on the opening shot, or on the last shot
 * (the ending holds still: a sweep there reads as a flash before it stops).
 */
export function signatureShot(plan: { segments: object[]; texts: { style: string; from: number }[]; transitions: EditPlan["transitions"] }): number | null {
  const band = plan.texts.find((t) => t.style === "band");
  if (!band) return null;
  // Lengths only: the editor's segments time like the plan's.
  const timeline = planTimeline(plan as unknown as Pick<EditPlan, "segments" | "transitions">);
  const i = timeline.segments.findIndex((s) => band.from >= s.start - 0.3 && band.from < s.start + s.length);
  return i > 0 && i < plan.segments.length - 1 && "clip_id" in plan.segments[i]! ? i : null;
}

const FONT_NAME = /^[A-Za-z0-9 ]{2,40}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/;

/** The editor's plan: its rhythm (tempo, collage), or a template (a plan written before a Reel had its own tempo). */
type Written<P> = Omit<P, "tempo" | "form"> & { template: MotionTemplate; tempo?: number };
type EditorPlanIn = EditorOutput["plan"] | EditorOutputLegacy["plan"] | Written<EditorOutput["plan"]> | Written<EditorOutputLegacy["plan"]>;

export function fromEditorPlan(input: EditorPlanIn, looks: SavedLook[] = []): EditPlan {
  // Its form: the collage, else « libre » (its own tempo, the look of its charter), composed or not.
  const { tempo: chosen, form, collage, template: written, ...plan } = input as EditorOutput["plan"] & { template?: MotionTemplate; collage?: boolean };
  const template: MotionTemplate = motionTemplateSchema.safeParse(written).success ? written! : form === "collage" || collage ? "collage" : "libre";
  const tempo = typeof chosen === "number" && Number.isFinite(chosen) ? Math.round(Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, chosen))) : undefined;
  const byName = new Map(looks.map((l) => [l.name.toLowerCase(), l]));
  const signature = signatureTransition(template, tempo);
  const signatureAt = signatureShot(plan);
  // Fonts are only names here: a malformed one is dropped, the brand's fonts are used.
  const fonts = plan.fonts
    ? {
        ...(plan.fonts.display && FONT_NAME.test(plan.fonts.display) ? { display: plan.fonts.display } : {}),
        ...(plan.fonts.body && FONT_NAME.test(plan.fonts.body) ? { body: plan.fonts.body } : {}),
      }
    : undefined;
  const endCard = plan.end_card?.title?.trim() ? { title: plan.end_card.title.trim().slice(0, 40), ...(plan.end_card.subtitle?.trim() ? { subtitle: plan.end_card.subtitle.trim().slice(0, 60) } : {}) } : undefined;
  // Its own colours as the render takes them: a malformed one is dropped, her charter's are used.
  const ownColors = (plan as { colors?: unknown }).colors;
  const colors = Array.isArray(ownColors) ? [...new Set(ownColors.flatMap((c) => (typeof c === "string" && HEX_COLOR.test(c.trim().toLowerCase()) ? [c.trim().toLowerCase()] : [])))].slice(0, 3) : [];
  const { end_card: _endCard, fonts: _fonts, colors: _colors, ...rest } = plan as typeof plan & { colors?: unknown };
  const { effect: _effect, layers: asked, ...kept } = rest as typeof rest & { effect?: string; layers?: { brief: string; from: number; to: number }[] };
  // Animations over several shots: a brief and a span, the code comes later (like a scene's).
  const layers = (asked ?? []).filter((l) => l.brief?.trim() && Number.isFinite(l.from) && Number.isFinite(l.to)).slice(0, 3);
  // A composition: the animation over the whole Reel lays its shots (one is added when the editor wrote none).
  const composed = template === "libre" && form === "composition";
  const duration = Number(plan.duration) || 0;
  const whole = composed ? layers.findIndex((l) => l.from <= 0.5 && l.to >= duration - 0.5) : -1;
  const asLayers = layers.map((l, i) => ({ motion: { brief: l.brief.trim().slice(0, 4000) }, from: l.from, to: l.to, ...(i === whole ? { compose: true } : {}) }));
  const allLayers = composed && whole < 0 ? [{ motion: { brief: compositionBrief(plan) }, from: 0, to: duration, compose: true }, ...asLayers].slice(0, 3) : asLayers;
  return {
    ...kept,
    template,
    ...(tempo ? { tempo } : {}),
    ...(allLayers.length ? { layers: allLayers } : {}),
    format: "9:16",
    images: [],
    music: null,
    // Film dust or a look over the whole video, when the editor asks for it.
    ...("effect" in plan && isReelEffect(plan.effect) ? { effect: plan.effect } : {}),
    ...(fonts && Object.keys(fonts).length ? { fonts } : {}),
    ...(colors.length ? { colors } : {}),
    ...(endCard ? { end_card: endCard } : {}),
    // A named look brings its style back (and, for a list, its details and bullets).
    texts: plan.texts.map(({ look_name, ...t }) => {
      const saved = look_name ? byName.get(look_name.trim().toLowerCase()) : undefined;
      if (!saved) return t;
      return { ...t, look: saved.look, ...(t.items?.length && saved.list?.detail_look ? { detail_look: saved.list.detail_look } : {}), ...(t.items?.length && !t.bullet && saved.list?.bullet ? { bullet: saved.list.bullet } : {}) };
    }),
    segments: (plan.segments as object[]).map((s, i): PlanSegment => {
      if ("clip_id" in s) {
        const shot = s as { clip_id: string; in: number; out: number; zoom?: "none" | "light"; move?: string; speed?: number };
        const move = shot.move === undefined ? undefined : cameraMoveSchema.catch("none").parse(shot.move.trim().toLowerCase());
        const speed = typeof shot.speed === "number" && Number.isFinite(shot.speed) && Math.abs(shot.speed - 1) > 0.01 ? shot.speed : undefined;
        return {
          clip_id: shot.clip_id,
          in: shot.in,
          out: shot.out,
          zoom: shot.zoom ?? "none",
          ...(move ? { move } : {}),
          ...(speed ? { speed } : {}),
          // The one signature transition goes on the shot the editor named (a video or a photo).
          ...(i === signatureAt ? { accent: signature } : {}),
        };
      }
      if (!("motion" in s)) return s as PlanSegment;
      const animation = s as z.infer<typeof editorAnimationSchema>;
      const { template_texts, template_id, ...motion } = animation.motion;
      const over = animation.over_clip?.trim() ? { over: { clip_id: animation.over_clip.trim() } } : {};
      const reused = template_id && z.uuid().safeParse(template_id).success ? template_id : undefined;
      if (!reused) return { motion, duration: animation.duration, ...over };
      const texts = Object.fromEntries(
        (template_texts ?? []).filter((t) => SLOT_NAME.test(t.slot)).map((t) => [t.slot, t.text.slice(0, 200)]),
      );
      return { motion: { ...motion, template_id: reused, texts }, duration: animation.duration, ...over };
    }),
  };
}

/** The longest a photo stays on screen in a Reel (it plays still, with a slow zoom). */
export const PHOTO_MAX_SECONDS = 5;

/** A photo's « clip » is given PHOTO_MAX_SECONDS as its length (a video almost never lasts exactly that). */
const photoLike = (clipId: string, clipDurations: Record<string, number>) => clipDurations[clipId] === PHOTO_MAX_SECONDS;

/**
 * New made-to-measure animations in one Reel: as many as the quote she agreed to
 * (each priced, `CREDIT_PRICES.newScene`), up to this technical ceiling (each is an
 * Opus call and a scene to render).
 */
export const MAX_FREE_SCENES = 8;

/** A Reel has one signature transition at most (the first the editor asked for): more looks cheap. */
export function oneAccent(segments: PlanSegment[]): PlanSegment[] {
  let seen = false;
  return segments.map((s) => {
    if (!isClipSegment(s) || !s.accent) return s;
    if (!seen) {
      seen = true;
      return s;
    }
    const { accent: _extra, ...rest } = s;
    return rest;
  });
}

/**
 * The longest Reel made (Tristan: « je mettrai 45 »): a discovery Reel tells a story in 20 to 30 s,
 * up to 45 when someone talks, a voice tells it all along or the Reel she copies lasts that long
 * (one of 34.6 s was cut to 30). A render takes 4 to 7 s per second of video: 45 s stays within the
 * 800 s of a job step (the limit of Vercel Pro).
 */
export const MAX_REEL_SECONDS = 45;

/**
 * Makes a model-written plan safe to render: segments inside their clips, a
 * duration that matches the timeline, texts inside it. Throws if nothing usable is left.
 */
/** Crossfades only when the shots last this long on average (seconds); below, clean cuts. */
const FADE_MIN_AVERAGE = 2.4;

/** The end card's length, and the last shot that holds it with a little of itself before it. */
export const END_CARD_SECONDS = 1.6;
const END_CARD_HOLD = 2.2;

/**
 * `speech`: what was measured of the speech in her videos (speech.ts): the hesitations and long
 * pauses are cut out of the passages where someone speaks, and those cuts never move onto the beat.
 */
export function normalizeEditPlan(plan: EditPlan, clipDurations: Record<string, number>, maxFreeScenes = MAX_FREE_SCENES, speech?: Record<string, SpeechFacts>): EditPlan {
  let freeScenes = 0;
  const shownTemplates = new Set<string>();
  const segments = plan.segments.flatMap((s): PlanSegment[] => {
    // A library scene twice in one Reel reads as a repeat: the second becomes a new
    // scene while the budget allows, else its fixed fallback, else a title with its words.
    if (isMotionSegment(s) && s.motion.template_id) {
      if (!shownTemplates.has(s.motion.template_id)) shownTemplates.add(s.motion.template_id);
      else {
        const { template_id: _repeat, texts, ...motion } = s.motion;
        const duration = round(Math.min(6, Math.max(1, s.duration)));
        if (freeScenes < maxFreeScenes) {
          freeScenes++;
          return [{ motion, duration: round(Math.min(8, Math.max(1, s.duration))) }];
        }
        const words = Object.values(texts ?? {}).map((w) => w.trim()).filter(Boolean);
        const title = [...words].sort((a, b) => b.length - a.length)[0];
        const scene = motion.fallback ?? (title ? { kind: "title" as const, title: title.slice(0, 60), background: "accent" as const } : null);
        return scene ? [{ scene, duration }] : [];
      }
    }
    // Free scenes are the costly part of a montage: past the cap, the fixed fallback plays instead
    // (one already written, kept from the version corrected, is not new).
    if (isMotionSegment(s) && !s.motion.template_id && !s.motion.js && freeScenes++ >= maxFreeScenes && s.motion.fallback) {
      return [{ scene: s.motion.fallback, duration: round(Math.min(6, Math.max(1, s.duration))) }];
    }
    if (isMotionSegment(s)) return [{ ...s, duration: round(Math.min(8, Math.max(1, s.duration))) }];
    if (!isClipSegment(s)) return [{ ...s, duration: round(Math.min(6, Math.max(1, s.duration))) }];
    const max = clipDurations[s.clip_id];
    const out = round(max ? Math.min(s.out, max) : s.out);
    const speed = s.speed === undefined ? undefined : Math.min(MAX_SPEED, Math.max(MIN_SPEED, s.speed));
    const clip = { ...s, in: round(Math.max(0, s.in)), out, ...(speed === undefined || Math.abs(speed - 1) < 0.01 ? { speed: undefined } : { speed }) };
    // A burst of photos goes down to a beat (0.4 s); a video shot holds at least half a second.
    const shortest = photoLike(s.clip_id, clipDurations) ? 0.35 : 0.5;
    return s.clip_id in clipDurations && segmentSeconds(clip) >= shortest ? [clip] : [];
  });
  if (!segments.length) throw new Error("Le plan de montage ne garde aucun plan utilisable");
  // The end card lays over the last shot's final seconds: an animation there would show
  // under it, so the Reel ends on a real shot (the last one comes to the end), long enough to hold it.
  if (plan.end_card && !isClipSegment(segments.at(-1)!)) {
    const lastClip = segments.map(isClipSegment).lastIndexOf(true);
    if (lastClip >= 0) segments.push(...segments.splice(lastClip, 1));
  }
  const ending = segments.at(-1)!;
  if (plan.end_card && isClipSegment(ending)) {
    const speed = ending.speed ?? 1;
    const room = ((clipDurations[ending.clip_id] ?? ending.out) - ending.in) / speed;
    ending.out = round(ending.in + Math.min(room, Math.max(segmentSeconds(ending), END_CARD_HOLD)) * speed);
  }
  // A crossfade between short shots reads as a double exposure: cuts, unless the shots breathe.
  const average = segments.reduce((sum, x) => sum + segmentSeconds(x), 0) / segments.length;
  const transitions = plan.transitions === "fade" && average < FADE_MIN_AVERAGE ? "cut" : plan.transitions;
  // Someone speaking: the « euh » and long silences cut out (jump cuts), the texts moved with their picture.
  const spoken = applySpeechCuts({ ...plan, transitions, segments }, speech, clipDurations);
  // The cuts on the ambiance's beats (not over her voice, nor between two of someone's words), then at most one signature transition.
  const tempo = snapToTempo(spoken, clipDurations, speech ? (s) => spokenShot(s, speech) : undefined);
  segments.splice(0, segments.length, ...oneAccent(tempo.segments));
  // Too long to render in time: the plans before the last one go, the last (the end) stays.
  while (segments.length > 2 && renderDuration({ ...plan, transitions: spoken.transitions, segments }) > MAX_REEL_SECONDS) segments.splice(segments.length - 2, 1);

  const draft = { ...plan, transitions: spoken.transitions, segments, images: [], music: null };
  const duration = Math.max(3, renderDuration(draft));

  // Animations over several shots: inside the Reel, a second at least, each a new animation within the budget;
  // a collage's composition is the ambiance itself, over the whole Reel, never counted.
  const layers = composedLayers({ ...plan, layers: spoken.layers }, duration).flatMap((l) => {
    if (l.compose) return [l];
    const from = round(Math.max(0, l.from));
    const to = round(Math.min(duration, l.to));
    if (to - from < 1 || (!l.motion.js && freeScenes++ >= maxFreeScenes)) return [];
    return [{ ...l, from, to }];
  });

  // No text under the end card, nor over an animation (it carries its own words): a scene, or one over
  // several shots that writes some (an animated hook and a written one showed together, one over the other).
  const textsEnd = plan.end_card ? duration - END_CARD_SECONDS : duration;
  const timeline = planTimeline(draft);
  const animations = [
    ...draft.segments.flatMap((s, i) => {
      const at = timeline.segments[i]!;
      return isClipSegment(s) ? [] : [{ from: at.start, to: at.start + at.length, words: animationWords(s) }];
    }),
    ...layers.flatMap((l) => {
      const words = l.compose ? "" : motionWords(l.motion);
      return words ? [{ from: l.from, to: l.to, words }] : [];
    }),
  ];
  const texts = longEnoughToRead(
    readableEnding(
    clearOfAnimations(
      // The hook is read from the first image, never after a blank half second.
      hookAtStart(tempo.texts.map((t) => ({ ...t, from: round(Math.max(0, t.from)), to: round(Math.min(t.to, textsEnd)) }))),
      animations,
      textsEnd,
    ),
    animations,
    textsEnd,
  ),
    animations,
    textsEnd,
  )
    .filter((t) => t.to - t.from >= MIN_TEXT_SECONDS)
    .map((t) => ({ ...t, emphasis: t.emphasis?.filter((e) => t.text.toLowerCase().includes(e.toLowerCase())) }));

  return editPlanSchema.parse({ ...draft, duration, texts, layers: layers.length ? layers : undefined });
}

/**
 * How long a text must stay on screen to be read on a phone: about 0.3 s a word after a
 * first glance, between 1.2 and 4.5 s (Tristan: « parfois c'est trop rapide donc on peut
 * même pas lire »). The scene check holds the animations' sentences to the same.
 */
export function readingSeconds(text: string): number {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.min(4.5, Math.max(1.2, 0.8 + 0.3 * words));
}

/**
 * Texts too short to be read stay longer, up to their reading time: until the next text,
 * the next animation or the end, never over them.
 */
export function longEnoughToRead<T extends { from: number; to: number; text: string; items?: { title: string; detail?: string }[] }>(
  texts: T[],
  animations: { from: number; to: number }[],
  end: number,
): T[] {
  const sorted = [...texts].sort((a, b) => a.from - b.from);
  return sorted.map((t, i) => {
    const words = [t.text, ...(t.items ?? []).flatMap((item) => [item.title, item.detail ?? ""])].join(" ");
    const wanted = t.from + readingSeconds(words);
    if (t.to >= wanted - 0.05) return t;
    const next = sorted[i + 1]?.from ?? end;
    const animation = Math.min(end, ...animations.filter((a) => a.from >= t.to - 0.05).map((a) => a.from));
    const to = round(Math.min(wanted, next, animation, end));
    return to > t.to ? { ...t, to } : t;
  });
}

/** A text on screen for less than this is not read: it goes. */
const MIN_TEXT_SECONDS = 1;

/** How long the last words of a Reel (its invitation) stay, at least, when there is room. */
const ENDING_TEXT_SECONDS = 1.8;

/**
 * The last text of a Reel cut short by its end (an invitation on screen for 0.7 s) starts
 * earlier, so it stays ENDING_TEXT_SECONDS: never over another text nor an animation.
 */
export function readableEnding<T extends { from: number; to: number }>(texts: T[], animations: { from: number; to: number }[], end: number): T[] {
  const sorted = [...texts].sort((a, b) => a.from - b.from);
  const last = sorted.at(-1);
  if (!last || last.to < end - 0.05 || last.to - last.from >= ENDING_TEXT_SECONDS) return sorted;
  const previous = sorted.at(-2);
  const from = round(Math.max(previous ? previous.to : 0, end - ENDING_TEXT_SECONDS));
  if (animations.some((a) => from < a.to - 0.05 && last.to > a.from + 0.05)) return sorted;
  return [...sorted.slice(0, -1), { ...last, from: Math.min(last.from, from) }];
}

/** Words as compared: lower case, no accents, no punctuation. */
const plainWords = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Every string in a value (a fixed scene's words). */
const stringsIn = (v: unknown): string[] =>
  typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(stringsIn) : v && typeof v === "object" ? Object.values(v).flatMap(stringsIn) : [];

/** The words an animation shows: its slots' texts and the words its brief quotes (« … »), or a fixed scene's words. */
export function animationWords(s: PlanSegment): string {
  if (isMotionSegment(s)) return motionWords(s.motion);
  if ("scene" in s) return stringsIn(s.scene).join(" | ");
  return "";
}

/** The words an animation writes: its slots, and the words its brief quotes. */
function motionWords(motion: { brief?: string; texts?: Record<string, string> }): string {
  const quoted = [...(motion.brief ?? "").matchAll(/[«“"]\s*([^»”"]+?)\s*[»”"]/g)].map((m) => m[1]!);
  return [...quoted, ...Object.values(motion.texts ?? {})].join(" | ");
}

/**
 * Texts moved off the animations, which carry their own words: a text that only repeats
 * the words of the animation it meets goes; one that starts during an animation waits for
 * its end, one that runs into it stops before it (if it still lasts long enough to be
 * read); otherwise it goes. Never over another text: one that starts while another shows
 * waits for its end.
 */
export function clearOfAnimations<T extends { from: number; to: number; text?: string }>(
  texts: T[],
  animations: { from: number; to: number; words?: string }[],
  end: number,
): T[] {
  const kept: T[] = [];
  const free = (from: number, to: number) => to <= end + 0.001 && kept.every((k) => k.to <= from + 0.001 || k.from >= to - 0.001);
  const repeats = (text: T, words: string | undefined) => {
    const own = plainWords(text.text ?? "");
    return own.split(" ").length >= 2 && Boolean(words) && ` ${plainWords(words!)} `.includes(` ${own} `);
  };
  for (const text of [...texts].sort((a, b) => a.from - b.from)) {
    const hit = animations.find((a) => text.from < a.to - 0.05 && text.to > a.from + 0.05);
    if (!hit) {
      if (free(text.from, text.to)) {
        kept.push(text);
        continue;
      }
      // Over a text shown before it: it waits for its end (the same end), if it still reads.
      const from = round(Math.max(...kept.filter((k) => k.to > text.from + 0.001 && k.from < text.to - 0.001).map((k) => k.to)));
      const clear = !animations.some((a) => from < a.to - 0.05 && text.to > a.from + 0.05);
      if (text.to - from >= 1.2 && clear && free(from, text.to)) kept.push({ ...text, from });
      continue;
    }
    // The animation already says it (an animated hook and the same words written after it).
    if (repeats(text, hit.words)) continue;
    const length = text.to - text.from;
    // Starts before the animation: stops just before it, if that still reads.
    if (text.from < hit.from && hit.from - text.from >= 1.2 && free(text.from, hit.from)) {
      kept.push({ ...text, to: round(hit.from) });
      continue;
    }
    // Else right after it, the same length.
    const from = round(hit.to);
    const to = round(Math.min(end, hit.to + length));
    const clear = !animations.some((a) => from < a.to - 0.05 && to > a.from + 0.05);
    if (to - from >= 1.2 && clear && free(from, to)) kept.push({ ...text, from, to });
  }
  return kept.sort((a, b) => a.from - b.from);
}

/**
 * True when a plan lands too far from the length she asked for (2 s, or 12 % of a long
 * Reel): her Pauline Reel came back at 19.6 s for « environ 26 s », the editor's own
 * words saying 26.
 */
export function missesLength(actual: number, asked: number | null | undefined): boolean {
  if (!asked) return false;
  return Math.abs(actual - Math.min(asked, MAX_REEL_SECONDS)) > Math.max(2, asked * 0.12);
}

const seconds = (value: number) => `${String(Math.round(value * 10) / 10).replace(".", ",")} s`;

/** What the editor reads when its plan missed her length: the measure, and what can stretch. */
export function lengthNote(actual: number, asked: number): string {
  return `[Contrôle du moteur, pas de la gérante] Ton plan dure ${seconds(actual)} une fois monté (somme des plans, moins les fondus) ; elle a demandé environ ${seconds(Math.min(asked, MAX_REEL_SECONDS))}. Rends le plan entier avec cette durée : une animation dure 8 s au plus, un plan filmé ne dépasse pas sa vidéo, une photo 5 s ; une voix plus courte ne s'étire pas, ce sont les images qui tiennent (une fin ou un écran de fin tenus après elle). « rationale » dit la vraie durée.`;
}

/** Her message never announces a length the video does not have: the true one is said when it is still off. */
export function honestLength(rationale: string, actual: number, asked: number | null | undefined): string {
  if (!asked || !missesLength(actual, asked)) return rationale;
  return `${rationale.trim()} Il fait ${seconds(actual)} et pas ${seconds(Math.min(asked, MAX_REEL_SECONDS))} : je n'ai pas réussi à tenir la durée demandée, dis-moi « réessaie la durée » et je le reprends.`.trim();
}

/** With a voice, what the Reel keeps after its last word: the invitation, read in silence. */
export const VOICE_TAIL = 1.5;

/**
 * With a voice, the Reel holds VOICE_TAIL after its last word: the last shot is
 * lengthened when its clip (or photo) has the room, never past MAX_REEL_SECONDS.
 */
export function holdAfterVoice(plan: EditPlan, voiceEnd: number, clipDurations: Record<string, number>): EditPlan {
  const total = renderDuration(plan);
  const missing = Math.min(voiceEnd + VOICE_TAIL, MAX_REEL_SECONDS) - total;
  const last = plan.segments.at(-1);
  if (missing <= 0.05 || !last || !isClipSegment(last)) return plan;
  const speed = last.speed ?? 1;
  const room = ((clipDurations[last.clip_id] ?? last.out) - last.out) / speed;
  const add = Math.min(missing, room);
  if (add < 0.1) return plan;
  const next = { ...plan, segments: [...plan.segments.slice(0, -1), { ...last, out: round(last.out + add * speed) }] };
  return { ...next, duration: round(Math.max(3, renderDuration(next))) };
}

/**
 * A variant of a delivered montage, without the editor: the same cut and rhythm with
 * another hook (a Reel has no ambiance to switch any more).
 */
export function variantPlan(plan: EditPlan, change: { hook?: string }): EditPlan {
  const hook = change.hook?.trim();
  let replaced = false;
  const texts = plan.texts.map((t) => {
    if (!hook || replaced || t.style !== "hook") return t;
    replaced = true;
    return { ...t, text: hook.slice(0, 120), emphasis: [] };
  });
  return editPlanSchema.parse({ ...plan, texts });
}
