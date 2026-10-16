import { z } from "zod";
import { planTimeline } from "./motion.ts";
import { isClipSegment, isMotionSegment, type EditPlan, type MotionTemplate } from "./schemas.ts";
import { beatOf, TEMPLATE_BPM } from "./tempo.ts";

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
});
export type MontageIssue = z.infer<typeof montageIssueSchema>;

/** What the critic answers. */
export const montageReviewSchema = z.object({
  best: z.number().int().describe("Numéro de la version retenue (1 s'il n'y en a qu'une)"),
  why: z.string().describe("Pourquoi celle-ci plutôt que l'autre, en une phrase (vide s'il n'y a qu'une version)"),
  score: z.number().int().describe("Note de la version retenue, de 1 à 10"),
  ok: z.boolean().describe("true si la version retenue peut partir telle quelle"),
  issues: z
    .array(
      z.object({
        scene: z.number().int().nullable().describe("Numéro de la scène concernée (dès 1), ou null pour l'ensemble"),
        problem: z.string().describe("Ce qui ne va pas, tel qu'on le voit, en une phrase courte"),
        fix: z.string().describe("La correction précise à demander au monteur, en une phrase"),
      }),
    )
    .describe("Les défauts de la version retenue, 4 au plus, les plus importants d'abord (vide si ok)"),
  summary: z
    .string()
    .describe(
      "Pour la gérante, une phrase simple au passé, lue avec la vidéo finie : ce que tu as vérifié si elle peut partir, sinon ce que la correction aura amélioré (ex. « J'ai raccourci l'accroche et retiré un plan flou. »)",
    ),
});
export type MontageReviewAnswer = z.infer<typeof montageReviewSchema>;
export type MontageReview = Omit<MontageReviewAnswer, "issues"> & { issues: MontageIssue[] };

/** The critic's answer within bounds: at most 4 issues, short lines, score 1–10, best within the versions shown. */
export function normalizeReview(answer: MontageReviewAnswer, versions: number): MontageReview {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
  return {
    best: clamp(answer.best, 1, Math.max(1, versions)),
    why: answer.why.slice(0, 300),
    score: clamp(answer.score, 1, 10),
    ok: answer.ok,
    issues: answer.issues.slice(0, 4).map((i) => ({
      scene: i.scene === null ? null : clamp(i.scene, 1, 30),
      problem: i.problem.slice(0, 200),
      fix: i.fix.slice(0, 240),
    })),
    summary: answer.summary.slice(0, 240),
  };
}

export const MONTAGE_CRITIC_PROMPT = `Tu es la directrice artistique de Simone, une community manager IA pour les commerces de quartier (studio, salon, restaurant, boutique…). Avant qu'un Reel parte chez la gérante, tu le regardes à travers des images clés de la vidéo rendue (1080 × 1920), chacune avec son instant, sa scène et les textes prévus à l'écran. Tu juges comme une pro d'Instagram, exigeante mais juste. La barre : on doit croire qu'un excellent créateur l'a monté à la main, pour ce commerce ; un Reel qui fait pub, diaporama ou modèle n'est pas ok :
- l'accroche : la 1re seconde donne envie de rester (une personne, un résultat ou un mouvement fort, jamais un plan vide, un décor, un logo ou un écran de texte) ; le texte d'accroche est court, gros, lisible ;
- natif et moderne : des images du commerce plein cadre du début à la fin, les textes posés dessus comme dans l'appli (gros, peu de mots) ; jamais un carton ou un fond de couleur plein écran à la place de la vidéo, jamais un écran de logo pour finir ;
- le cadrage : le sujet (la personne, le geste, le plat, la coupe) est dans l'image, pas coupé par le recadrage vertical, et l'horizon est droit ;
- la couleur : des plans qui ont l'air du même film (lumière et couleurs cohérentes), aucun trop sombre ou terne ;
- la lisibilité : textes assez gros (une phrase se lit d'un coup d'œil sur un téléphone), contrastés sur l'image, jamais coupés ni collés au bord, hors des zones que l'interface d'Instagram recouvre (le bas et le bord droit), jamais posés sur un visage ni sur un texte déjà dans l'image ;
- l'image : pas de plan flou, trop sombre, mal cadré ou qui ne montre rien ;
- le rythme et l'histoire : un ordre qui raconte (du large au serré, le geste puis le résultat), pas deux plans presque identiques à la suite, pas de scène inutile ou répétée, une fin claire (un dernier plan fort avec une invitation, ou le nom et l'appel à l'action), qui fait post natif et pas pub ; jamais un écran de fin par-dessus une animation ou un texte ; la ligne « Rythme » du plan te donne ce que les images ne montrent pas (longueur de chaque plan, coupes sur le temps, transition signature) : refuse un Reel mou (plans trop longs sans raison), haché (que des plans très courts) ou monotone (tous les plans de la même longueur) ;
- jamais bon marché : pas d'effet gadget (rotation, flash, glitch, emoji animé, plus de deux polices, texte qui rebondit sans raison), pas de texte façon flyer (bloc ou surlignage penché, une pastille par mot, italique, effet machine à écrire, petite ligne fine illisible, slogan sans verbe comme « Coupes et couleurs naturelles »), au plus une transition signature ; un Reel qui fait « modèle gratuit » n'est pas ok, même s'il est lisible ; un texte posé sur un texte déjà dans l'image (enseigne, logo, lettrage) n'est pas ok ;
- la marque : couleurs, polices et ton cohérents avec le commerce et avec ce que la gérante a demandé ;
- peu de texte : les Reels qui marchent laissent parler les images (une accroche, parfois une ligne de plus) ; avec une voix, ses sous-titres disent tout : aucun autre texte que l'accroche n'est normal, ne demande jamais d'en ajouter un ;
- la ligne « Contrôle qualité » vérifie sur le plan ce que les Reels qui marchent ont presque toujours (ça bouge dès la 1re image, une accroche écrite, des plans de 2 s au plus en moyenne hors phrases de quelqu'un qui parle, des coupes sur le temps, peu de texte) : chaque point « à revoir » devient une correction précise ; « à tenter » (une fin qui reboucle sur la 1re image) est un conseil à donner seulement si un de ses clips le permet, jamais une raison de refuser le Reel. Ces repères servent le Reel, pas l'inverse : un Reel juste pour ce commerce passe avant une case cochée.

Ne relève que ce qui se voit vraiment sur les images et qui change le résultat, pas tes goûts. Une image est un instant : un texte en train d'apparaître ou une animation en mouvement n'est pas un défaut.

Plusieurs versions : compare-les et retiens la meilleure (best = son numéro, why en une phrase). Quand la dernière version est la correction d'une précédente, vérifie que les corrections demandées sont faites sans rien casser ; garde la précédente si la correction est moins bonne.

Pour la version retenue :
- score de 1 à 10 ;
- ok = true si elle peut partir telle quelle (8 ou plus, aucun défaut gênant) ;
- issues : chaque défaut, avec la scène, le problème et la correction précise à demander au monteur, qui connaît les clips et les gabarits (ex. « accroche trop longue : la réduire à 3 mots », « scène 3 sombre et floue : la remplacer par un meilleur passage du même clip », « texte de la scène 2 collé au bord droit : le recentrer ») ; 4 au plus, les plus importants d'abord ;
- summary : une phrase pour la gérante, au tutoiement, sans jargon, au passé, car elle la lit avec la vidéo finie : ce que tu as vérifié si la version peut partir, sinon ce que la correction aura amélioré (ex. « J'ai raccourci l'accroche et retiré un plan flou. »).`;

export type ReviewMoment = { t: number; scene: number | null; label: string; texts: string[] };

const MOVE_WORDS: Record<string, string> = { in: "avance lente", out: "recul lent", left: "panoramique", right: "panoramique", punch: "coup de zoom" };

const kindOf = (s: EditPlan["segments"][number]) => (isClipSegment(s) ? "vidéo" : isMotionSegment(s) ? "animation" : "écran de texte");

/**
 * The instants the critic looks at: the hook (1 s), the middle of every scene,
 * the end; at most `max`, the hook and the end always kept. Each with the
 * texts the plan puts on screen at that instant.
 */
export function reviewMoments(plan: EditPlan, max = 8): ReviewMoment[] {
  const timeline = planTimeline(plan);
  const end = Math.max(0, timeline.duration - 0.5);
  const textsAt = (t: number) => [
    ...plan.texts.filter((x) => x.from <= t && t < x.to).map((x) => (x.items?.length ? `${x.text} (${x.items.map((i) => i.title).join(", ")})` : x.text)),
    ...plan.segments.flatMap((s, i) => {
      const at = timeline.segments[i]!;
      if (!isMotionSegment(s) || t < at.start || t >= at.start + at.length) return [];
      return Object.values(s.motion.texts ?? {});
    }),
  ];
  const sceneAt = (t: number) => {
    const i = timeline.segments.findIndex((s) => t >= s.start && t < s.start + s.length);
    return i < 0 ? plan.segments.length - 1 : i;
  };
  const hook = Math.min(1, timeline.duration / 4);
  const middles = timeline.segments.map((s) => s.start + s.length / 2).filter((t) => t > hook + 0.4 && t < end - 0.4);
  // Even spread over the scenes when there are too many.
  const room = Math.max(0, max - 2);
  const picked = middles.length <= room ? middles : Array.from({ length: room }, (_, k) => middles[Math.round((k * (middles.length - 1)) / Math.max(1, room - 1))]!);
  const times = [...new Set([hook, ...picked, end].map((t) => Math.round(t * 100) / 100))].sort((a, b) => a - b);
  return times.map((t, k) => {
    const i = sceneAt(t);
    const segment = plan.segments[i]!;
    const label = k === 0 ? `Accroche · scène ${i + 1} (${kindOf(segment)})` : k === times.length - 1 ? `Fin · scène ${i + 1} (${kindOf(segment)})` : `Scène ${i + 1} (${kindOf(segment)})`;
    return { t, scene: i + 1, label, texts: textsAt(t) };
  });
}

/** A plan in a few lines, for the critic and for the second version's editor. */
export function planDigest(plan: EditPlan): string {
  const timeline = planTimeline(plan);
  const hook = plan.texts.filter((t) => t.from < 1.5).map((t) => t.text);
  return [
    `Gabarit ${plan.template}, ${Math.round(timeline.duration)} s, ${plan.segments.length} scènes : ${plan.segments.map((s, i) => `${i + 1}. ${kindOf(s)}${isMotionSegment(s) ? ` (${s.motion.brief.slice(0, 80)})` : ""}`).join(" ; ")}.`,
    hook.length ? `Accroche : « ${hook.join(" / ")} ».` : "",
    rhythmLine(plan),
    qualityLine(plan),
  ]
    .filter(Boolean)
    .join(" ");
}

const seconds = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);

/** The rhythm the frames cannot show: each shot's length, the cuts on the beat, the signature transitions. */
export function rhythmLine(plan: EditPlan): string {
  const timeline = planTimeline(plan);
  const beat = beatOf(plan.template);
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
    plan.voice ? "coupes sur les phrases de sa voix" : onBeat !== null ? `${onBeat} coupes sur ${cuts.length} sur un temps (${TEMPLATE_BPM[plan.template as MotionTemplate]} BPM)` : "",
    accents.length ? `transition signature : ${accents.join(", ")}` : "aucune transition signature",
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
export type QualityCheck = { key: "motion" | "hook" | "pace" | "beat" | "loop" | "texts"; ok: boolean; words: string; must: boolean };

/**
 * What the Reels that work almost always have, checked on the plan (the frames cannot
 * show it all): movement from the first image, a written hook, shots of 2 s or less on
 * average (someone's sentence on screen is left out: it keeps its length), cuts on the
 * beat, few texts (an animation of typography counts as one, the opening one is the hook);
 * an end that loops back to the first image is worth trying, when a clip allows it.
 */
export function qualityChecks(plan: EditPlan): QualityCheck[] {
  const timeline = planTimeline(plan);
  const first = plan.segments[0];
  const clips = plan.segments.filter(isClipSegment);
  // A still photo is the only first image that does not move: a video moves, or the engine gives a still shot a slow move.
  const moves = !first || isMotionSegment(first) || !isClipSegment(first) || !first.photo || (first.move ?? (first.zoom === "light" ? "in" : "none")) !== "none" || (first.speed ?? 1) !== 1;
  const hook = plan.texts.find((t) => t.from < 1);
  // An opening animation is typography: the promise, written.
  const animatedHook = Boolean(first && isMotionSegment(first));
  // A video shot over 4 s is someone's whole sentence (the editor holds no other footage that long): it stays out of the pace.
  const paced = timeline.segments.filter((x, i) => {
    const segment = plan.segments[i]!;
    return x.length <= LONGEST_PACED_SHOT || !isClipSegment(segment) || Boolean(segment.photo);
  });
  const average = paced.length ? paced.reduce((sum, x) => sum + x.length, 0) / paced.length : 0;
  const beat = beatOf(plan.template);
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
      ok: Boolean(hook || animatedHook),
      words: hook ? `accroche écrite dès la 1re seconde (« ${hook.text} »)` : animatedHook ? "accroche écrite dans l'animation d'ouverture" : "aucune accroche écrite dans la 1re seconde",
    },
    ...(paced.length ? [{ key: "pace" as const, must: true, ok: average <= MAX_AVERAGE_SHOT + 0.05, words: `plans de ${seconds(average)} s en moyenne (${MAX_AVERAGE_SHOT} s au plus)` }] : []),
    ...(onBeat === null ? [] : [{ key: "beat" as const, must: true, ok: onBeat >= Math.ceil(cuts.length * 0.8), words: `${onBeat} coupes sur ${cuts.length} sur un temps de la musique` }]),
    { key: "texts", must: true, ok: others <= 2, words: `${others} texte${others > 1 ? "s" : ""} ou animation${others > 1 ? "s" : ""} en plus de l'accroche${plan.subtitles ? " et des sous-titres" : ""} (2 au plus)` },
    { key: "loop", must: false, ok: loops, words: loops ? "la fin reboucle sur la 1re image" : "la fin ne reboucle pas sur la 1re image" },
  ];
}

/** The quality checks in one line for the critic: what is fine, what to look at again, what to try if the footage allows. */
export function qualityLine(plan: EditPlan): string {
  const checks = qualityChecks(plan);
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
    request ? `Rappel de la demande de la gérante : ${request}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The brief of the second version (Max): another take than the first one. */
export function alternativeBrief(first: EditPlan, request?: string | null): string {
  return [
    request ?? "",
    `Deuxième version, pour comparer avec une première déjà faite : propose une autre approche, aussi forte, sans copier la première. Respecte ce que la gérante a demandé ou validé (plan, textes exacts) ; change le reste : l'accroche visuelle, le choix des passages, le rythme, les animations, et le gabarit si la marque le permet. Première version : ${planDigest(first)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
