import { z } from "zod";
import { planTimeline } from "./motion.ts";
import { AMBIANCES, isClipSegment, isMotionSegment, motionTemplateSchema, type EditPlan, type MotionTemplate } from "./schemas.ts";
import { HOOK_LATEST, OPENING_MAX_SECONDS } from "./hook.ts";
import { voicePhrases, type VoiceTranscript } from "./voice.ts";
import { planBeat, planBpm } from "./tempo.ts";
import type { ReelFormat } from "./voice-over.ts";

// The critic: before a Soigné or Max montage goes out, Opus watches key frames
// of the rendered video (the hook, every scene, the end), picks the best
// version when there are several, and either lets it go or writes the
// corrections the editor must make. The model judges, the editor fixes, the
// engine renders again: no code from the critic ever reaches the video.

// Structured outputs do not enforce lengths and counts: the critic's answer is
// read leniently, then clamped by normalizeReview (one overlong line must not
// throw the whole review away).

/** An issue as the job carries it (clamped). */
export const montageIssueSchema = z.object({
  scene: z.number().int().min(1).max(30).nullable(),
  problem: z.string().max(200),
  fix: z.string().max(240),
  /** An objective defect the editor must fix; any other remark is an opinion told to her, never a correction. */
  blocking: z.boolean().optional(),
});
export type MontageIssue = z.infer<typeof montageIssueSchema>;

/** What the critic answers. */
export const montageReviewSchema = z.object({
  best: z.number().int().describe("Numéro de la version retenue (1 s'il n'y en a qu'une)"),
  why: z.string().describe("Pourquoi celle-ci plutôt que l'autre, en une phrase (vide s'il n'y a qu'une version)"),
  score: z.number().int().describe("Note de la version retenue, de 1 à 10"),
  hook: z.number().int().describe("Force de son accroche, de 1 à 10 : la 1re image, le texte d'accroche et, avec une voix, sa première phrase"),
  ok: z.boolean().describe("true si la version retenue peut partir telle quelle"),
  issues: z
    .array(
      z.object({
        scene: z.number().int().nullable().describe("Numéro de la scène concernée (dès 1), ou null pour l'ensemble"),
        problem: z.string().describe("Ce qui ne va pas, tel qu'on le voit, en une phrase courte"),
        fix: z.string().describe("La correction précise à demander au monteur, en une phrase"),
        blocking: z
          .boolean()
          .describe(
            "true seulement pour un défaut objectif : un texte coupé, illisible ou sous l'interface d'Instagram, un texte ou une animation sur un visage (sauf l'effet qu'elle a demandé), un chiffre, un prix ou un fait que ni sa demande ni le commerce ne donnent, une image cassée (noire, figée, vide, floue au point de ne rien montrer) ; false pour un avis (durée, choix ou ordre des plans, forme, rythme, couleurs, un visage caché par un geste voulu)",
          ),
      }),
    )
    .describe("Les défauts de la version retenue, 4 au plus, les plus importants d'abord (vide si ok)"),
  summary: z
    .string()
    .describe(
      "Pour la gérante, une phrase simple au passé, lue avec la vidéo finie : ce que tu as vérifié si elle peut partir, sinon ce que la correction aura amélioré (ex. « J'ai raccourci l'accroche et retiré un plan flou. »), jamais ce qui resterait à faire",
    ),
});
export type MontageReviewAnswer = z.infer<typeof montageReviewSchema>;
export type MontageReview = Omit<MontageReviewAnswer, "issues"> & { issues: MontageIssue[] };

/** Under this, the hook is too weak for the Reel to go: it is corrected first. */
export const HOOK_PASS = 7;

/**
 * A line the manager reads, within `max` characters: cut after its last full sentence,
 * else on a word with « … », never in the middle of a word (« plus lisib »).
 */
export function shortSentence(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const room = clean.slice(0, max + 1);
  const end = Math.max(...[". ", "! ", "? ", "… "].map((mark) => room.lastIndexOf(mark)));
  if (end > 0) return room.slice(0, end + 1);
  const space = room.lastIndexOf(" ", max - 1);
  return `${room.slice(0, space > 0 ? space : max - 1).replace(/[\s,;:(«]+$/, "")}…`;
}

/**
 * The critic's answer within bounds: at most 4 issues, short lines, scores 1–10, best within
 * the versions shown. Only an objective defect is corrected (Tristan, on corrections that cut
 * the coffee gag of his Reel and shortened it from 10 to 6.5 s: « la phase de correction elle
 * est pas overkill ? »): the rest are opinions, told to her, never imposed. A weak hook stays a
 * defect to correct first. The defects come first.
 */
export function normalizeReview(answer: MontageReviewAnswer, versions: number): MontageReview {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
  const hook = clamp(answer.hook ?? 10, 1, 10);
  const issues = answer.issues.slice(0, 4).map((i, k) => ({
    scene: i.scene === null ? null : clamp(i.scene, 1, 30),
    // The first one left is told to her as it is (« je peux encore corriger ceci : … »).
    problem: shortSentence(i.problem, 200),
    fix: i.fix.slice(0, 240),
    // A weak hook: its correction, written first, is a defect.
    blocking: i.blocking === true || (hook < HOOK_PASS && k === 0),
  }));
  const ordered = [...issues.filter((i) => i.blocking), ...issues.filter((i) => !i.blocking)];
  return {
    best: clamp(answer.best, 1, Math.max(1, versions)),
    why: answer.why.slice(0, 300),
    score: clamp(answer.score, 1, 10),
    hook,
    ok: !ordered.some((i) => i.blocking),
    issues: ordered,
    summary: managerLine(answer.summary),
  };
}

/** The defects of a review, the only ones the editor is asked to fix. */
export const blockingIssues = (review: Pick<MontageReview, "issues">) => review.issues.filter((i) => i.blocking);

/** A sentence that tells her what is still to do (« il reste à… »): she receives a finished video. */
const LEFT_TO_DO = /\b(il reste|reste à|il faudrait|il faut encore|à revoir|à corriger|à reprendre|pas encore)\b/i;

/**
 * The critic's line for the manager, without what would still be to do: told with the finished
 * video, « Il reste à dégager les visages » read as a Reel not done (Culte's free collage).
 */
export function managerLine(summary: string): string {
  const sentences = summary.trim().replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]*/g) ?? [];
  return shortSentence(sentences.map((x) => x.trim()).filter((x) => x && !LEFT_TO_DO.test(x)).join(" "), 300);
}

export const MONTAGE_CRITIC_PROMPT = `You are the art director of Simone, an AI community manager for neighbourhood businesses (studio, salon, restaurant, shop…). Before a Reel goes to the manager (« she »), you look at it through key frames of the rendered video (1080 × 1920), each with its instant, its scene and the texts planned on screen. You judge like an Instagram pro, demanding but fair. The bar: people must believe an excellent creator edited it by hand, for this business; a Reel that looks like an ad, a slideshow or a template is not ok:
- the hook first, it decides whether people stay (frames « 1re image » and « Accroche »): the first image stops the thumb (a person, a result, a strong gesture or movement, sharp and well framed; never an empty shot, a set, a logo, a text screen nor a still, distant photo), the hook text is already there from the first image, short, big, readable, and makes people want to see what comes next (except when the Reel she copies has none or her request does not want one: the first image, or the voice, then hook alone and you score the hook on them); with a voice, its first sentence (line « Voix ») hooks from its first words; score it separately (hook): under 7, it is never ok and its correction comes first: the opening shot to take instead (the strongest of her clips, say which), other words, or both;
- native and modern: images of the business, full frame from start to finish, the texts laid over them as in the app (big, few words); never a card or a full-screen colour background instead of the video, never a logo screen to finish;
- the framing: the subject (the person, the gesture, the dish, the haircut) is in the image, not cut by the vertical crop, and the horizon is straight;
- the colour: shots that look like the same film (consistent light and colours), none too dark or dull;
- readability: texts big enough (a sentence reads at a glance on a phone), contrasted on the image, never cut nor stuck to the edge, outside the areas Instagram's interface covers (the bottom and the right edge), never laid on a face nor on a text already in the image; a voice's subtitles have the intended native style (small, a thin outline, the spoken word on a pill) that the editor does not set: never ask to enlarge them, lay them on a flat or change their colour, only their place counts (never on a face);
- the image: no shot that is blurred, too dark, badly framed or shows nothing;
- the rhythm and the story: an order that tells (from wide to tight, the gesture then the result), not two nearly identical shots in a row, no useless or repeated scene, a clear ending (a strong last shot with an invitation, the name and the call to action, or the ending of the Reel she copies), that feels like a native post and not an ad; never an end screen over an animation or a text; the plan's « Rythme » line gives you what the images do not show (each shot's length, cuts on the beat, signature transition): refuse a Reel that is sluggish (shots too long for no reason), choppy (only very short shots) or monotonous (all the shots the same length);
- never cheap: no gadget effect on the shots (rotation, flash, glitch, animated emoji, more than two fonts apart from the lettering of a universe or an effect she asked for), no flyer-style text laid on the video (a tilted block or highlight, one pill per word, italics, a typewriter effect, a small thin unreadable line, a slogan without a verb such as « Coupes et couleurs naturelles »), one signature transition at most; the animations are free, their form is the motion designer's choice: judge only whether they read, stay in the frame and off faces, go with the brand (or with the universe her request or the Reel she copies call for), whether two animations of the Reel do not look alike, and whether they look like an ad or a promo flyer (« promo » starburst, explosion, speed lines, sale badge; an effect she asked for herself, an energy beam, an explosion for fun, is not one: judge only whether it is well made and hooked to her gesture): not ok, like a flyer text, the correction asks that it stays native, never a form to take; never their style beyond that; an intended, discreet film dust (« Rythme » line) is neither a gadget nor dirt on the image; a Reel that looks like a « free template » is not ok, even if it is readable; a text laid on a text already in the image (a sign, a logo, lettering) is not ok;
- the brand: colours, fonts and tone consistent with the business and with what the manager asked for; her charter is the starting point, not a cage: a liberty that her request or the Reel she copies call for (a universe she names, other colours, another font, those of the copied Reel) is intended, never a defect: judge it against its model (well made, serving her request);
- her request (« Demande de la gérante ») is the rule, never a defect: what she imposes or sets aside (what the Reel starts or ends with, the order of the moments, the words or the offer to say, no text, no voice) stays, even for a stronger hook; judge only how it is done and suggest doing it better without departing from it (another passage of the same moment, a tighter framing, other words on top);
- the Reel she copies (line « Reel à recopier ») also comes before your guidelines: what it does not have (a written hook, text, an invitation at the end, a voice, animations), this Reel does not have to have, and what it has (more text, longer shots, an ending without a call), it keeps; never ask to depart from it to tick a guideline, judge whether it redoes it well, with her own images and words;
- little text: the Reels that work let the images speak (a hook, sometimes one more line); with a voice, its subtitles say everything: no other text than the hook is normal, never ask to add one; a Reel she copies keeps the amount of text of the one she copies;
- the « Contrôle qualité » line checks on the plan what the Reels that work almost always have (it moves from the first image, a written hook, shots of 2 s at most on average apart from someone's sentences, cuts on the beat, little text): each point « à revoir » becomes a remark (an opinion, blocking false); « à tenter » (an ending that loops back to the first image) is a tip to give only if one of her clips allows it, never a reason to refuse the Reel. These guidelines serve the Reel, not the other way around (they already take into account the Reel she copies): a Reel right for this business and for her request comes before a ticked box.

Only point out what really shows on the images and changes the result, not your tastes. An image is an instant: a text appearing or an animation in motion is not a defect.

Several versions: compare them and keep the best (best = its number, why in one sentence). When the last version is the correction of an earlier one, check that the corrections asked for are made without breaking anything; keep the earlier one if the correction is worse.

For the version kept:
- score from 1 to 10;
- ok = true if it has no blocking defect;
- issues: each remark, with the scene, the problem and the precise correction to ask the editor, who knows the clips and the templates (e.g. « accroche trop longue : la réduire à 3 mots », « scène 3 sombre et floue : la remplacer par un meilleur passage du même clip », « texte de la scène 2 collé au bord droit : le recentrer »); 4 at most, the most important first. blocking = true only for an objective defect (a text cut or unreadable, a text on a face, an invented fact, a broken image, a hook under 7): only that triggers a correction, which remakes the Reel. Everything else is an opinion (blocking false), told to the manager, who decides: never the length, the choice of shots or the form changed for your taste, and a face hidden by an intended gesture (a sip of coffee, a raised book) is not a defect. A text or an animation on a face: ask to move them, never to change the shot (her best shot, her smiles, stay), unless the effect she asked for needs to be in front of a face (a word held between her fingers, a message laid on her as in the Reel she copies): her request allows it. In an animation, a collage or a composition, a masked text or a hidden shot: say what must stay readable or visible, never a form to take (not « un seul tirage à la fois », « ne plus superposer », « aligner »): the form and its richness stay with the motion designer;
- summary: one sentence for the manager, using « tu », with no jargon, in the past tense, since she reads it with the finished video: what you checked if the version can go out, otherwise what the correction will have improved (e.g. « J'ai raccourci l'accroche et retiré un plan flou. »); never what would be left to do (« il reste à… »): the video she gets is finished.

Everything you write is in French: the summary, and the problem of a remark, can be told to her as they are.`;

export type ReviewMoment = { t: number; scene: number | null; label: string; texts: string[] };

const MOVE_WORDS: Record<string, string> = { in: "avance lente", out: "recul lent", left: "panoramique", right: "panoramique", punch: "coup de zoom" };

const kindOf = (s: EditPlan["segments"][number]) => (isClipSegment(s) ? "vidéo" : isMotionSegment(s) ? "animation" : "écran de texte");

/** A gesture of her videos that plays under an animation, on the Reel's clock (seconds). */
export type GestureMoment = { t: number; what: string };

/** At most this many gestures are looked at on top of the other instants. */
const MAX_GESTURE_MOMENTS = 2;

/**
 * Where the gestures Gemini saw in her clips play under an animation (one over several shots,
 * or a scene over her footage), on the Reel's clock: the middle of each one, earliest first.
 * An effect that hangs on a gesture is judged at the gesture: judged at its animation's middle
 * only, a text born between the fingers that then settled looked like it was never in her hand,
 * and the correction undid the effect that worked.
 */
export function gestureMoments(plan: EditPlan, actions: Record<string, { start: number; end: number; what: string }[] | undefined>): GestureMoment[] {
  const timeline = planTimeline(plan);
  const layers = (plan.layers ?? []).filter((l) => !l.compose);
  const found: GestureMoment[] = [];
  const keep = (from: number, to: number, what: string, spans: [number, number][]) => {
    for (const [a, b] of spans) {
      const lo = Math.max(from, a);
      const hi = Math.min(to, b);
      if (hi > lo) found.push({ t: Math.round(((lo + hi) / 2) * 100) / 100, what });
    }
  };
  plan.segments.forEach((s, i) => {
    const at = timeline.segments[i]!;
    const end = at.start + at.length;
    if (isClipSegment(s)) {
      const speed = s.speed ?? 1;
      // Under the animations over several shots that play during this shot.
      const spans = layers.flatMap((l): [number, number][] => (l.to > at.start && l.from < end ? [[Math.max(l.from, at.start), Math.min(l.to, end)]] : []));
      if (!spans.length) return;
      for (const g of actions[s.clip_id] ?? []) keep(at.start + (g.start - s.in) / speed, at.start + (g.end - s.in) / speed, g.what, spans);
    } else if (isMotionSegment(s) && s.over?.in !== undefined) {
      // Under a scene drawn over her footage, which plays on from `in`.
      const from = s.over.in;
      for (const g of actions[s.over.clip_id] ?? []) keep(at.start + (g.start - from), at.start + (g.end - from), g.what, [[at.start, end]]);
    }
  });
  return found.sort((a, b) => a.t - b.t).filter((g, k, list) => k === 0 || g.t - list[k - 1]!.t > 0.4);
}

/**
 * The instants the critic looks at: the hook (1 s), the middle of every animation over
 * several shots, the gestures under the animations (`gestures`, two at most, on top of
 * `max`), the middle of every scene, the end; at most `max`, the hook, the end and the
 * animations always kept. Each with the texts the plan puts on screen at that instant.
 * Without the animations' own instants, the critic judged the « -20 % » a manager asked
 * for missing: no scene's middle fell on it.
 */
export function reviewMoments(plan: EditPlan, max = 8, gestures: GestureMoment[] = []): ReviewMoment[] {
  const timeline = planTimeline(plan);
  const end = Math.max(0, timeline.duration - 0.5);
  const at2 = (t: number) => Math.round(t * 100) / 100;
  const layers = (plan.layers ?? []).filter((l) => !l.compose);
  const textsAt = (t: number) => [
    ...plan.texts.filter((x) => x.from <= t && t < x.to).map((x) => (x.items?.length ? `${x.text} (${x.items.map((i) => i.title).join(", ")})` : x.text)),
    ...plan.segments.flatMap((s, i) => {
      const at = timeline.segments[i]!;
      if (!isMotionSegment(s) || t < at.start || t >= at.start + at.length) return [];
      return Object.values(s.motion.texts ?? {});
    }),
    ...layers.flatMap((l) => (t >= l.from && t < l.to ? Object.values(l.motion.texts ?? {}) : [])),
  ];
  const sceneAt = (t: number) => {
    const i = timeline.segments.findIndex((s) => t >= s.start && t < s.start + s.length);
    return i < 0 ? plan.segments.length - 1 : i;
  };
  // The first image as the feed shows it (the hook's text already in), then the hook at 1 s.
  const first = at2(Math.min(0.3, timeline.duration / 8));
  const hook = at2(Math.min(1, timeline.duration / 4));
  const animations = layers.map((l) => at2((l.from + l.to) / 2)).filter((t) => t > hook + 0.2 && t < end - 0.2);
  // Spread over the gestures when there are more (her first spread and her widest, three spreads apart).
  const under = gestures
    .map((g) => ({ ...g, t: at2(g.t) }))
    .filter((g) => g.t > hook + 0.2 && g.t < end - 0.2 && animations.every((a) => Math.abs(a - g.t) > 0.3));
  const gestured =
    under.length <= MAX_GESTURE_MOMENTS
      ? under
      : [...new Set(Array.from({ length: MAX_GESTURE_MOMENTS }, (_, k) => Math.round((k * (under.length - 1)) / (MAX_GESTURE_MOMENTS - 1))))].map((k) => under[k]!);
  const middles = timeline.segments
    .map((s) => s.start + s.length / 2)
    .filter((t) => t > hook + 0.4 && t < end - 0.4 && animations.every((a) => Math.abs(a - t) > 0.4) && gestured.every((g) => Math.abs(g.t - t) > 0.4));
  // Even spread over the scenes when there are too many.
  const room = Math.max(0, max - 3 - animations.length);
  const picked = middles.length <= room ? middles : Array.from({ length: room }, (_, k) => middles[Math.round((k * (middles.length - 1)) / Math.max(1, room - 1))]!);
  const times = [...new Set([first, hook, ...animations, ...gestured.map((g) => g.t), ...picked, end].map(at2))].sort((a, b) => a - b);
  return times.map((t, k) => {
    const i = sceneAt(t);
    const segment = plan.segments[i]!;
    const where = `scène ${i + 1} (${kindOf(segment)})`;
    const layer = animations.includes(t) ? layers.find((l) => t >= l.from && t < l.to) : undefined;
    const gesture = gestured.find((g) => g.t === t);
    const label =
      t === first
        ? `1re image · ${where}`
        : t === hook
          ? `Accroche · ${where}`
          : k === times.length - 1
            ? `Fin · ${where}`
            : layer
              ? `Animation sur plusieurs plans (de ${seconds(layer.from)} à ${seconds(layer.to)} s) · ${where}`
              : gesture
                ? `Pendant un geste sous une animation (« ${gesture.what.slice(0, 100)} ») · ${where}`
                : `Scène ${i + 1} (${kindOf(segment)})`;
    return { t, scene: i + 1, label, texts: textsAt(t) };
  });
}

/** A Reel's form and rhythm in words: a collage or not, its tempo (an older Reel: its ambiance). */
function formWords(plan: EditPlan): string {
  const bpm = planBpm(plan);
  const composed = plan.layers?.some((l) => l.compose);
  const form = plan.template === "collage" ? "Collage" : plan.template === "libre" ? (composed ? "Reel composé (ses plans posés par une composition)" : "Reel") : `Ambiance ${plan.template}`;
  return bpm ? `${form} à ${bpm} BPM` : form;
}

/**
 * A plan in a few lines, for the critic and for the second version's editor. `options`: what the
 * Reel she copies changes in the quality checks (its pace, a hook without words, several texts).
 */
export function planDigest(plan: EditPlan, options: QualityOptions = {}): string {
  const timeline = planTimeline(plan);
  const hook = plan.texts.filter((t) => t.from < 1.5).map((t) => t.text);
  return [
    `${formWords(plan)}, ${Math.round(timeline.duration)} s, ${plan.segments.length} scènes : ${plan.segments.map((s, i) => `${i + 1}. ${kindOf(s)}${isMotionSegment(s) ? ` (${s.motion.brief.slice(0, 80)})` : ""}`).join(" ; ")}.`,
    hook.length ? `Accroche : « ${hook.join(" / ")} ».` : "",
    // An animation over several shots comes back on purpose (asked for): not a repeat.
    ...(plan.layers ?? []).map((l) =>
      l.compose ? `Composition de tout le Reel, voulue : ${l.motion.brief.slice(0, 160)}.` : `Animation par-dessus les plans de ${seconds(l.from)} à ${seconds(l.to)} s, voulue : ${l.motion.brief.slice(0, 120)}.`,
    ),
    rhythmLine(plan),
    qualityLine(plan, options),
  ]
    .filter(Boolean)
    .join(" ");
}

const seconds = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);

/** What the frames cannot let the critic hear: the voice's first sentence, and when it is said. */
export function voiceLine(plan: Pick<EditPlan, "voice">, transcript: Pick<VoiceTranscript, "words"> | null): string | null {
  if (!plan.voice || !transcript?.words.length) return null;
  const first = voicePhrases({ text: "", duration: 0, words: transcript.words }, plan.voice.at)[0];
  return first ? `Voix : sa première phrase « ${first.text} », dite de ${seconds(first.start)} à ${seconds(first.end)} s.` : null;
}

/**
 * The Reel's form, for the critic to judge it on its own terms: a key message held on
 * screen is the point of the format, not too much text to lighten.
 */
export function formatLine(format: ReelFormat | undefined): string | null {
  if (format === "message")
    return "Format : message clé, sans voix. Un seul message (titre, sous-titre, détails) reste posé presque tout le Reel, au même endroit, pendant que les plans défilent sur la musique : c'est voulu. Ne demande jamais de le raccourcir, de le retirer d'une partie du Reel ni de le remplacer par d'autres textes ; juge sa lisibilité, ses coupures de lignes, sa composition et sa place. Il passe forcément sur des corps : seuls les visages comptent.";
  if (format === "raconte") return "Format : raconté par une voix. Ses sous-titres portent tout ; l'accroche est le seul texte posé.";
  return null;
}

/**
 * The form the manager chose for this Reel (the collage; an older Reel: its ambiance), at
 * her request: it is her choice, like her request. Without this line the critic judged the
 * collage itself (its paper and its prints) as far from a night-club brand, and asked to drop it.
 */
export function ambianceLine(template: string | null | undefined): string | null {
  const chosen = motionTemplateSchema.safeParse(template);
  if (!chosen.success || chosen.data === "libre") return null;
  if (chosen.data === "collage")
    return "Forme choisie pour ce Reel : le collage (ses images composées à la main). C'est son choix : juge le Reel en collage, ce qui fait son style en fait partie ; jamais le collage lui-même, ni une autre forme à la place.";
  return `Ambiance choisie pour ce Reel : « ${AMBIANCES[chosen.data].label} » (${AMBIANCES[chosen.data].hint}). C'est son choix : juge le Reel dans cette ambiance, ce qui fait son style en fait partie ; jamais l'ambiance elle-même, ni une autre à la place.`;
}

/** The rhythm the frames cannot show: each shot's length, the cuts on the beat, the signature transitions. */
export function rhythmLine(plan: EditPlan): string {
  const timeline = planTimeline(plan);
  const beat = planBeat(plan);
  const cuts = timeline.segments.slice(1).map((s) => s.start);
  const onBeat = beat && !plan.voice ? cuts.filter((t) => Math.abs(t / beat - Math.round(t / beat)) * beat < 0.05).length : null;
  const accents = plan.segments.flatMap((s, i) => (isClipSegment(s) && s.accent ? [`${s.accent} à la scène ${i + 1}`] : []));
  // What still frames cannot show: the camera's moves and the speed of each shot.
  const camera = plan.segments.flatMap((s, i) =>
    isClipSegment(s)
      ? [
          ...(s.move && s.move !== "none" ? [`${MOVE_WORDS[s.move] ?? s.move} scène ${i + 1}`] : []),
          ...(s.speed && s.speed < 1 ? [`ralenti scène ${i + 1}`] : s.speed && s.speed > 1 ? [`accéléré scène ${i + 1}`] : []),
        ]
      : isMotionSegment(s) && s.over
        ? [`animation par-dessus la vidéo scène ${i + 1}`]
        : [],
  );
  return [
    `Rythme : plans de ${timeline.segments.map((s) => seconds(s.length)).join(" / ")} s`,
    camera.length ? `caméra : ${camera.join(", ")}` : "",
    plan.voice ? "coupes sur les phrases de sa voix" : onBeat !== null ? `${onBeat} coupes sur ${cuts.length} sur un temps (${planBpm(plan)} BPM)` : "",
    accents.length ? `transition signature : ${accents.join(", ")}` : "aucune transition signature",
    plan.effect === "dust" ? "effet voulu : poussière de pellicule sur toute la vidéo" : "",
  ]
    .filter(Boolean)
    .join(" ; ")
    .concat(".");
}

/** Shots of 2 s or less on average: a new shot every 1 to 2 s keeps people watching. */
export const MAX_AVERAGE_SHOT = 2;

/** Longer, a shot is someone's sentence held whole: it is not counted in the pace. */
const LONGEST_PACED_SHOT = 4;

/** A check the Reel must pass, or one worth trying when the footage allows it. */
export type QualityCheck = { key: "motion" | "hook" | "opening" | "pace" | "beat" | "loop" | "texts"; ok: boolean; words: string; must: boolean };

/**
 * What the Reel she copies changes in the checks (followedChecks): our defaults never ask a Reel
 * to be what that Reel is not. `paceCeiling`: the longest average shot (and first shot) of a Reel
 * that takes its time; `wordlessHook`: it opens without written words (a gesture, no text at all);
 * `manyTexts`: several texts are its form.
 */
export type QualityOptions = { paceCeiling?: number; wordlessHook?: boolean; manyTexts?: boolean };

/**
 * What the Reels that work almost always have, checked on the plan (the frames cannot
 * show it all): movement from the first image, a written hook, shots of 2 s or less on
 * average (someone's sentence on screen is left out: it keeps its length), cuts on the
 * beat, few texts (an animation of typography counts as one, the opening one is the hook);
 * an end that loops back to the first image is worth trying, when a clip allows it. The Reel
 * she copies bends them (options): what it does not have is never asked.
 */
export function qualityChecks(plan: EditPlan, options: QualityOptions = {}): QualityCheck[] {
  const ceiling = options.paceCeiling ?? MAX_AVERAGE_SHOT;
  const timeline = planTimeline(plan);
  const first = plan.segments[0];
  const clips = plan.segments.filter(isClipSegment);
  // A still photo is the only first image that does not move: a video moves, or the engine gives a still shot a slow move.
  const moves = !first || isMotionSegment(first) || !isClipSegment(first) || !first.photo || (first.move ?? (first.zoom === "light" ? "in" : "none")) !== "none" || (first.speed ?? 1) !== 1;
  // The hook is read from the first image (one that waits half a second has lost the eye).
  const hook = plan.texts.find((t) => t.from <= 0.2);
  const late = hook ? undefined : plan.texts.find((t) => t.from < HOOK_LATEST);
  // An opening animation is typography: the promise, written.
  const animatedHook = Boolean(first && isMotionSegment(first));
  // The first shot holds the eye 2 s at most, then a cut relaunches it (over 4 s, it is someone's sentence, kept whole);
  // a Reel she copies that takes its time opens on a longer one too.
  const opening = first && isClipSegment(first) ? timeline.segments[0] : undefined;
  const quickOpening = !opening || opening.length <= Math.max(OPENING_MAX_SECONDS, ceiling) + 0.05 || opening.length > LONGEST_PACED_SHOT;
  // A video shot over 4 s is someone's whole sentence (the editor holds no other footage that long): it stays out of the pace.
  const paced = timeline.segments.filter((x, i) => {
    const segment = plan.segments[i]!;
    return x.length <= LONGEST_PACED_SHOT || !isClipSegment(segment) || Boolean(segment.photo);
  });
  const average = paced.length ? paced.reduce((sum, x) => sum + x.length, 0) / paced.length : 0;
  const beat = planBeat(plan);
  const cuts = timeline.segments.slice(1).map((x) => x.start);
  const onBeat = beat && !plan.voice && cuts.length ? cuts.filter((t) => Math.abs(t / beat - Math.round(t / beat)) * beat < 0.05).length : null;
  const loops = clips.length >= 2 && clips[0]!.clip_id === clips.at(-1)!.clip_id;
  // Besides the hook, every text and every animation of typography (the opening one is the hook).
  const others = plan.texts.filter((t) => t !== hook).length + plan.segments.filter((x, i) => isMotionSegment(x) && i > 0).length;
  return [
    { key: "motion", must: true, ok: moves, words: moves ? "ça bouge dès la 1re image" : "la 1re image est une photo fixe" },
    {
      key: "hook",
      must: true,
      ok: Boolean(hook || animatedHook || options.wordlessHook),
      words: hook
        ? `accroche écrite dès la 1re image (« ${hook.text} »)`
        : animatedHook
          ? "accroche écrite dans l'animation d'ouverture"
          : options.wordlessHook
            ? "pas d'accroche écrite dès la 1re image, comme le Reel qu'elle recopie"
            : late
              ? `accroche écrite seulement à ${seconds(late.from)} s : à poser dès la 1re image`
              : "aucune accroche écrite dès la 1re image",
    },
    ...(opening
      ? [
          {
            key: "opening" as const,
            must: true,
            ok: quickOpening,
            words: quickOpening ? `1er plan de ${seconds(opening.length)} s` : `1er plan de ${seconds(opening.length)} s : couper avant 1,5 s pour relancer l'œil (sauf si quelqu'un y parle)`,
          },
        ]
      : []),
    ...(paced.length ? [{ key: "pace" as const, must: true, ok: average <= ceiling + 0.05, words: `plans de ${seconds(average)} s en moyenne (${seconds(ceiling)} s au plus)` }] : []),
    ...(onBeat === null ? [] : [{ key: "beat" as const, must: true, ok: onBeat >= Math.ceil(cuts.length * 0.8), words: `${onBeat} coupes sur ${cuts.length} sur un temps de la musique` }]),
    {
      key: "texts",
      must: true,
      ok: others <= 2 || Boolean(options.manyTexts),
      words: `${others} texte${others > 1 ? "s" : ""} ou animation${others > 1 ? "s" : ""} en plus de l'accroche${plan.subtitles ? " et des sous-titres" : ""} (${options.manyTexts ? "plusieurs, comme le Reel qu'elle recopie" : "2 au plus"})`,
    },
    { key: "loop", must: false, ok: loops, words: loops ? "la fin reboucle sur la 1re image" : "la fin ne reboucle pas sur la 1re image" },
  ];
}

/** The quality checks in one line for the critic: what is fine, what to look at again, what to try if the footage allows. */
export function qualityLine(plan: EditPlan, options: QualityOptions = {}): string {
  const checks = qualityChecks(plan, options);
  const fine = checks.filter((c) => c.ok).map((c) => c.words);
  const again = checks.filter((c) => !c.ok && c.must).map((c) => c.words);
  const tryIt = checks.filter((c) => !c.ok && !c.must).map((c) => c.words);
  return `Contrôle qualité : ${[
    fine.length ? `ok : ${fine.join(", ")}` : "",
    again.length ? `à revoir : ${again.join(", ")}` : "",
    tryIt.length ? `à tenter si un clip le permet : ${tryIt.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" ; ")}.`;
}

/** The critic's corrections, as the brief of the editor's next version. */
export function fixBrief(review: Pick<MontageReview, "score" | "issues">, request?: string | null): string {
  return [
    `Relecture de la vidéo rendue par la directrice artistique (note ${review.score}/10). Corrige seulement ces points, garde tout le reste :`,
    ...review.issues.map((issue, i) => `${i + 1}. ${issue.scene ? `Scène ${issue.scene} : ` : ""}${issue.problem} → ${issue.fix}`),
    // Culte's free collage: to clear faces the editor dropped her best photo, and « the prints cover the message » became one small print at a time.
    "Un texte ou une animation sur un visage se déplace, le plan reste : ne retire jamais un plan fort pour ça. Pour une animation ou un collage, dis au motion designer ce qui doit rester lisible ou visible, jamais une forme à prendre, et garde sa richesse.",
    request ? `Rappel de la demande de la gérante, qui passe avant ces points (ce qu'elle impose reste) : ${request}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The brief of the second version (Max): another take than the first one. */
export function alternativeBrief(first: EditPlan, request?: string | null, options: QualityOptions = {}): string {
  return [
    request ?? "",
    `Deuxième version, pour comparer avec une première déjà faite : propose une autre approche, aussi forte, sans copier la première. Respecte ce que la gérante a demandé ou validé (plan, textes exacts) et le Reel qu'elle recopie s'il y en a un (« reel_a_recopier » : sa forme, son rythme, son texte et sa fin restent) ; change le reste : l'accroche visuelle, le choix des passages, le rythme (son tempo), les animations, et la forme (en collage ou non) si ça sert sa marque. Première version : ${planDigest(first, options)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
