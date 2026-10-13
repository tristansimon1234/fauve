import { z } from "zod";
import { planTimeline } from "./motion.ts";
import { isClipSegment, isMotionSegment, type EditPlan } from "./schemas.ts";

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

export const MONTAGE_CRITIC_PROMPT = `Tu es la directrice artistique de Fauve, une community manager IA pour les commerces de quartier (studio, salon, restaurant, boutique…). Avant qu'un Reel parte chez la gérante, tu le regardes à travers des images clés de la vidéo rendue (1080 × 1920), chacune avec son instant, sa scène et les textes prévus à l'écran. Tu juges comme une pro d'Instagram, exigeante mais juste :
- l'accroche : la 1re seconde donne envie de rester ; le texte d'accroche est court, gros, lisible ;
- la lisibilité : textes assez gros, contrastés sur l'image, jamais coupés ni collés au bord, hors des zones que l'interface d'Instagram recouvre (le bas et le bord droit), jamais posés sur un visage ;
- l'image : pas de plan flou, trop sombre, mal cadré ou qui ne montre rien ;
- le rythme et l'histoire : un ordre logique, pas de scène inutile ou répétée, une fin claire (nom ou logo, appel à l'action) ;
- la marque : couleurs, polices et ton cohérents avec le commerce et avec ce que la gérante a demandé.

Ne relève que ce qui se voit vraiment sur les images et qui change le résultat, pas tes goûts. Une image est un instant : un texte en train d'apparaître ou une animation en mouvement n'est pas un défaut.

Plusieurs versions : compare-les et retiens la meilleure (best = son numéro, why en une phrase). Quand la dernière version est la correction d'une précédente, vérifie que les corrections demandées sont faites sans rien casser ; garde la précédente si la correction est moins bonne.

Pour la version retenue :
- score de 1 à 10 ;
- ok = true si elle peut partir telle quelle (8 ou plus, aucun défaut gênant) ;
- issues : chaque défaut, avec la scène, le problème et la correction précise à demander au monteur, qui connaît les clips et les gabarits (ex. « accroche trop longue : la réduire à 3 mots », « scène 3 sombre et floue : la remplacer par un meilleur passage du même clip », « texte de la scène 2 collé au bord droit : le recentrer ») ; 4 au plus, les plus importants d'abord ;
- summary : une phrase pour la gérante, au tutoiement, sans jargon, au passé, car elle la lit avec la vidéo finie : ce que tu as vérifié si la version peut partir, sinon ce que la correction aura amélioré (ex. « J'ai raccourci l'accroche et retiré un plan flou. »).`;

export type ReviewMoment = { t: number; scene: number | null; label: string; texts: string[] };

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
  ]
    .filter(Boolean)
    .join(" ");
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
