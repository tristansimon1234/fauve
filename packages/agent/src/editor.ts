import { z } from "zod";
import { renderDuration } from "./render.ts";
import {
  editPlanObjectSchema,
  editPlanSceneSegmentSchema,
  editPlanSchema,
  editPlanSegmentSchema,
  isClipSegment,
  isMotionSegment,
  motionTemplateSchema,
  sceneSchema,
  type EditPlan,
  type PlanSegment,
} from "./schemas.ts";

// Fauve's editor: one dedicated Opus call (high effort, structured output) that
// turns clip analyses + the studio's brand into an edit plan for the motion
// templates. The WhatsApp conversation only calls it; it never edits itself.

export const EDITOR_SYSTEM_PROMPT = `Tu es le monteur et motion designer de Fauve. Tu montes des Reels Instagram / TikTok pour des studios de Pilates, yoga et barre, à partir de clips filmés au téléphone et de leur analyse (plans horodatés, énergie, potentiel d'accroche, qualité, visages, meilleurs passages, paroles).

Ton rendu doit avoir l'air fait par un motion designer professionnel. Tu décides ; un moteur exécute exactement ton plan avec l'un de trois gabarits :
- « doux » : élégant et apaisé. Accroche en serif italique qui apparaît mot à mot, fondus enchaînés, zoom lent. Pour un ton zen, doux, bien-être, élégant.
- « dynamique » : énergique. Mots en capitales qui « claquent », coupes franches, zoom plus marqué. Pour un ton sportif, intense, motivant.
- « chic » : minimal et haut de gamme. Très peu de texte, typographie fine, bandeau en filet, fondus lents. Pour un ton luxe, épuré.

Règles de montage :
- 7 à 15 secondes au total. L'accroche (style « hook ») est à l'écran dès la première seconde et le premier plan est le plus fort visuellement (mouvement net, effort visible, beau cadre).
- Utilise les meilleurs passages de l'analyse. Écarte les plans flous, sombres ou bougés. Évite les visages d'élèves reconnaissables sauf si le brief dit que c'est OK.
- Plans de 1,2 à 4 secondes (0,8 s minimum en « dynamique »). Les points d'entrée et de sortie restent dans la durée du clip.
- Rythme : alterne plan large et gros plan quand c'est possible. Termine sur un plan calme si un écran de fin suit.
- Textes : 2 à 3 temps forts au maximum. Accroche de 6 mots au plus, bandeau de 5 mots au plus, légende de 7 mots au plus. En français, tutoiement, ton du studio. Chaque texte reste au moins 1,5 s et change de préférence sur une coupe. « emphasis » : 1 ou 2 mots clés de ce texte, écrits exactement comme dans le texte.
- Ne superpose pas deux textes. Pas de texte pendant l'écran de fin.
- Écran de fin (« end_card ») : le nom du studio en titre et un appel à l'action court en sous-titre (ex. « Réserve ton cours »), pour les 1,6 dernières secondes. Prévois la durée en conséquence.
- Transitions : « fade » pour doux et chic, « cut » pour dynamique. « zoom » « light » sur les plans calmes (ou « light_zoom » partout en doux).
- Sous-titres mot à mot (« subtitles ») seulement si quelqu'un parle et que c'est utile (prof qui explique, témoignage).
- Jamais de musique (« music » vaut null) ; pas d'images (« images » vide).

Scènes de motion design (sans vidéo, aux couleurs du studio) :
- « motion » : une scène libre, sur mesure, que ton motion designer animera en code (typographie cinétique, formes, tracés, masques…). Dans « brief », décris précisément l'idée visuelle, les textes exacts, l'ordre des mouvements, les couleurs et l'ambiance. Donne aussi « fallback », une scène fixe équivalente au cas où. C'est ton outil principal pour une ouverture marquante, une offre, un planning, un témoignage mis en scène, une transition graphique, ou une vidéo sans clips.
- « scene » : gabarit fixe et rapide (title, list, quote, number), si une scène libre n'apporte rien.
- 1,5 à 6 s par scène. Avec des clips : 1 à 3 scènes au plus. Sans clips : un Reel entièrement en motion design, de 3 à 5 scènes qui s'enchaînent.

Direction artistique du studio (« brand ») : suis son « art_direction » (ambiance, couleurs, typographie, rythme) et utilise « default_template » sauf demande contraire. Ses polices et couleurs sont appliquées automatiquement.

Polices : « fonts » (display pour l'accroche et les titres, body pour le reste), uniquement des polices Google Fonts au nom exact, et seulement si la demande en cours en réclame d'autres que celles de la charte. Sinon laisse « fonts » vide.
- « duration » est la somme des durées de plans, moins 0,35 s par fondu enchaîné.

Correction : si un plan précédent et une demande de changement sont fournis, pars du plan précédent et applique exactement ce qui est demandé, sans changer le reste.

« rationale » : une seule phrase pour la gérante, en français, tutoiement, qui explique ton choix principal (ex. « J'ouvre sur la planche, c'est le moment le plus intense, puis je ralentis sur la respiration. »).`;

/** Motion segment as the editor writes it: a brief and a fallback, the code comes later. */
const editorMotionSegmentSchema = z.object({
  motion: z.object({ brief: z.string().min(1).max(800), fallback: sceneSchema }),
  duration: z.number().min(1).max(8),
});

export const editorOutputSchema = z.object({
  plan: editPlanObjectSchema.extend({
    template: motionTemplateSchema,
    segments: z.array(z.union([editPlanSegmentSchema, editPlanSceneSegmentSchema, editorMotionSegmentSchema])).min(1),
  }),
  rationale: z.string(),
});
export type EditorOutput = z.infer<typeof editorOutputSchema>;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Makes a model-written plan safe to render: segments inside their clips, a
 * duration that matches the timeline, texts inside it. Throws if nothing usable is left.
 */
export function normalizeEditPlan(plan: EditPlan, clipDurations: Record<string, number>): EditPlan {
  const segments = plan.segments.flatMap((s): PlanSegment[] => {
    if (isMotionSegment(s)) return [{ ...s, duration: round(Math.min(8, Math.max(1, s.duration))) }];
    if (!isClipSegment(s)) return [{ ...s, duration: round(Math.min(6, Math.max(1, s.duration))) }];
    const max = clipDurations[s.clip_id];
    const out = round(max ? Math.min(s.out, max) : s.out);
    const clip = { ...s, in: round(Math.max(0, s.in)), out };
    return s.clip_id in clipDurations && clip.out - clip.in >= 0.5 ? [clip] : [];
  });
  if (!segments.length) throw new Error("Le plan de montage ne garde aucun plan utilisable");

  const draft = { ...plan, segments, images: [], music: null };
  const duration = Math.max(3, renderDuration(draft));
  const texts = plan.texts
    .map((t) => ({ ...t, from: round(Math.max(0, t.from)), to: round(Math.min(t.to, duration)) }))
    .filter((t) => t.to - t.from >= 0.5)
    .map((t) => ({ ...t, emphasis: t.emphasis?.filter((e) => t.text.toLowerCase().includes(e.toLowerCase())) }));

  return editPlanSchema.parse({ ...draft, duration, texts });
}
