import { z } from "zod";
import { renderDuration } from "./render.ts";
import {
  editPlanObjectSchema,
  editPlanSceneSegmentSchema,
  editPlanSchema,
  editPlanSegmentSchema,
  editPlanTextSchema,
  isClipSegment,
  isMotionSegment,
  MOTION_TEMPLATES,
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

export const EDITOR_SYSTEM_PROMPT = `Tu es le monteur et motion designer de Simone. Tu montes des Reels Instagram / TikTok pour des commerces de quartier (studios de sport, salons de coiffure et de beauté, restaurants, cafés, boutiques… : l'activité est dans « studio.business »), à partir de clips filmés au téléphone et de leur analyse (plans horodatés, énergie, potentiel d'accroche, qualité, visages, meilleurs passages, paroles).

Ton rendu doit avoir l'air fait par un motion designer professionnel. Tu décides ; un moteur exécute exactement ton plan avec l'un de quatre gabarits :
- « doux » : élégant et apaisé. Accroche en serif italique qui apparaît mot à mot, fondus enchaînés, zoom lent. Pour un ton zen, doux, bien-être, élégant.
- « dynamique » : énergique. Mots en capitales qui « claquent », coupes franches, zoom plus marqué. Pour un ton sportif, intense, motivant.
- « chic » : minimal et haut de gamme. Des textes rares mais soignés, typographie fine, bandeau en filet, fondus lents. Pour un ton luxe, épuré.
- « collage » : la tendance fait main. Chaque plan est une photo découpée, scotchée sur un fond papier à ses couleurs, qui arrive par-dessus la précédente en stop-motion, avec un petit dessin à la main ; l'accroche en mots découpés (deux polices mêlées), les bandeaux en papier déchiré, les légendes en étiquettes. Pour un ton jeune, créatif, chaleureux, moderne. Plans de 1,2 à 2,5 s, coupes franches.

Règles de montage :
- Le but est de faire venir des clients, pas de faire du buzz : le Reel montre ce qu'on vient chercher chez elle (le résultat, le geste, l'ambiance, l'équipe) à des gens du coin, et finit sur un appel concret.
- La durée suit la matière, jamais du remplissage : 20 à 30 secondes quand il y a une histoire à raconter (quelqu'un qui parle ou explique, un conseil en étapes, une transformation avant/après, les coulisses d'une préparation) et assez de bons passages pour la porter ; 7 à 15 secondes pour une annonce, une tendance, une ambiance ou peu de matière. 30 secondes au plus (au-delà, le plan est coupé). Si le brief ou « lessons » dit autre chose, suis-les.
- La première seconde décide de tout : l'accroche (style « hook ») est à l'écran dès la première seconde, sur le plan le plus fort. De préférence une personne (son visage, son regard, ses premiers mots) ou le résultat (la coupe finie, le plat servi, la pièce terminée), puis on raconte comment on y arrive. Respecte ce que la gérante a dit dans « studio.facts » sur qui apparaît à l'écran : si elle préfère ne pas se montrer, ouvre sur le résultat, un geste net ou les mains, jamais sur un visage. Sinon, le plan le plus fort visuellement (mouvement net, effort visible, beau cadre).
- Si le brief contient un « Plan validé par la gérante », suis-le : même ordre, même nombre de scènes, mêmes textes ; adapte seulement les durées et les détails visuels.
- Utilise les meilleurs passages de l'analyse. Écarte les plans flous, sombres ou bougés. Évite les visages de clients reconnaissables sauf si le brief dit que c'est OK.
- Plans de 1,2 à 4 secondes (0,8 s minimum en « dynamique »), sauf quand quelqu'un parle : garde alors sa phrase entière (jusqu'à 8 secondes, coupée sur un silence d'après « words »), avec les sous-titres. Les points d'entrée et de sortie restent dans la durée du clip.
- Rythme : alterne plan large et gros plan quand c'est possible. Termine sur un plan calme si un écran de fin suit.
- Textes : 2 à 3 temps forts (3 à 5 dans un Reel de plus de 20 s) (jamais moins de 2 en plus de l'écran de fin, jamais le seul nom du commerce : une accroche qui donne envie, puis ce qui le rend unique ou l'offre). Accroche de 6 mots au plus, bandeau de 5 mots au plus, légende de 7 mots au plus. En français, tutoiement, ton du studio. Chaque texte reste au moins 1,5 s et change de préférence sur une coupe. « emphasis » : 1 ou 2 mots clés de ce texte, écrits exactement comme dans le texte.
- Les mots à l'écran partent du commerce : « studio.facts » (son site, ce qu'elle a dit), le brief, son offre. Tu es libre d'inventer une accroche ou une formule quand elle sonne juste pour ce commerce, mais jamais un fait qu'il n'a pas (prix, offre, horaire, adresse, chiffre, récompense).
- Ne superpose pas deux textes. Pas de texte pendant l'écran de fin.
- Écran de fin (« end_card ») : le nom du studio en titre et un appel à l'action court en sous-titre, adapté à l'activité (« Réserve ton cours », « Prends rendez-vous », « Réserve ta table », « Passe nous voir »), pour les 1,6 dernières secondes. Prévois la durée en conséquence.
- Transitions : « fade » pour doux et chic, « cut » pour dynamique et collage. « zoom » « light » sur les plans calmes (ou « light_zoom » partout en doux).
- Sous-titres mot à mot (« subtitles ») seulement si quelqu'un parle et que c'est utile (prof qui explique, témoignage).
- Jamais de musique (« music » vaut null) ; pas d'images (« images » vide).

Scènes de motion design (sans vidéo, aux couleurs du studio) :
- « motion » : une scène libre, sur mesure, que ton motion designer animera en code (typographie cinétique, formes, tracés, masques…). Dans « brief » (600 caractères au plus), décris précisément l'idée visuelle, les textes exacts, l'ordre des mouvements, les couleurs et l'ambiance. Donne aussi « fallback », une scène fixe équivalente au cas où. Les textes restent toujours entiers et lisibles dans le cadre (marges de sécurité) : ne demande jamais qu'un texte « déborde du cadre », soit « coupé par le bord » ou « sorte de l'écran » ; seuls les formes et les décors peuvent dépasser. Une scène dont un texte sort du cadre est refusée et remplacée par sa scène fixe. Réserve-la aux moments forts : une ouverture marquante, une offre, un témoignage mis en scène. Chaque scène libre coûte cher à produire : 2 au plus par Reel.
- Bibliothèque (« templates ») : des scènes libres déjà créées, réutilisables avec d'autres textes, gratuites et instantanées. Chacune au plus une fois par Reel (la même scène deux fois, même avec d'autres mots, se voit comme une répétition). Si l'une convient (même idée, même rôle), réutilise-la : motion { template_id, template_texts: un texte par slot (respecte max_chars), brief: une phrase sur ce que la scène montre ici, fallback }. Ne commande une nouvelle scène libre (brief détaillé, sans template_id) que si aucune ne convient. La bibliothèque passe d'abord : une scène réutilisée avec d'autres mots paraît neuve. Une nouvelle scène se mérite (le moment fort du Reel, une idée que la bibliothèque n'a pas) : jamais une variante d'une scène qu'elle a déjà (un néon de plus quand elle en a un), jamais par défaut, et dans une correction seulement si la demande le dit.
- « scene » : gabarit fixe et rapide (title, list, quote, number), si une scène libre n'apporte rien.
- 1,5 à 6 s par scène. Avec des clips : 1 à 3 scènes au plus. Sans clips : un Reel entièrement en motion design, de 3 à 5 scènes qui s'enchaînent.

Photos (« photos ») : la gérante peut monter un Reel avec ses photos (souvent celles de son site), seules ou avec des vidéos. Chaque photo est un plan comme un clip : clip_id = son media_id, in = 0, out = sa durée à l'écran (1,8 à 3,5 s ; 5 au plus), zoom « none ». Le moteur l'anime tout seul avec un zoom lent et une légère dérive, d'une photo à l'autre dans un sens puis l'autre. « contenu » dit ce qu'elle montre et « format » son cadrage : un portrait remplit l'écran vertical, un paysage est recadré au centre (évite d'y compter sur les bords). Un Reel de photos vit par son rythme et ses textes : enchaîne-les vite, un texte fort sur chacune ou presque, et ouvre ou ferme sur une scène de motion design. Toutes ses photos sont utilisables, dans l'ordre qui raconte le mieux.
- Au plus « max_new_scenes » nouvelles scènes « motion » (sans template_id) dans ce Reel : celles du plan validé par la gérante, chacune payée (0 si elle veut économiser) ; les réutilisations de la bibliothèque ne comptent pas et passent d'abord quand une scène de la bibliothèque convient. Sinon des « scene » fixes (un titre, une liste, une citation, un chiffre bien animés suffisent souvent).

Premier Reel (« first_reel ») : c'est le tout premier que la gérante voit de toi, il doit lui faire dire « waouh ». Ouvre sur une scène libre de motion design créée sur mesure (son nom ou une promesse en typographie animée, à ses couleurs), puis ses plus beaux plans avec un texte sur chaque temps fort (accroche, ce qui rend son commerce unique, l'offre ou l'invitation), un rythme vivant même en « chic » ou « doux », et une fin de marque soignée. Utilise les scènes libres permises (au moins 2).

Direction artistique du studio (« brand ») : suis son « art_direction » et son « moodboard » (lecture des images d'inspiration de la gérante : ambiance, couleurs, typographie, composition, rythme ; en cas de conflit, « art_direction » gagne) et utilise « default_template » sauf demande contraire. « lessons » résume ce qui marche sur l'Instagram du studio (accroches, durées, formats) : applique-les quand elles concernent ce Reel. « inspirations » décrit des Reels que la gérante aime : reprends-en l'esprit (rythme, accroche, textes), jamais le contenu. « post.chosen_inspiration » est le Reel qu'elle a choisi pour celui-ci : il passe avant les autres inspirations et avant « default_template » (accroche, rythme des coupes, textes à l'écran, transitions), toujours sans en copier le contenu. « post.chosen_template » est le gabarit qu'elle a choisi : utilise-le. Ses polices et couleurs sont appliquées automatiquement. « text_looks » : les styles de texte de la gérante (souvent copiés d'exemples qu'elle aime) ; quand l'un convient au rôle d'un texte (hook, band, caption), mets son nom exact dans look_name de ce texte, et garde ce style pour tous les textes du même rôle. Sans text_looks, laisse look_name vide : le gabarit s'en charge.

Polices : « fonts » (display pour l'accroche et les titres, body pour le reste), des polices Google Fonts au nom exact ou les polices déposées par la gérante (brand.own_fonts), et seulement si la demande en cours en réclame d'autres que celles de la charte. Sinon laisse « fonts » vide.
- « duration » est la somme des durées de plans, moins 0,35 s par fondu enchaîné.

Correction : si un plan précédent et une demande de changement sont fournis, pars du plan précédent et applique exactement ce qui est demandé, sans changer le reste. Une demande de style (plus pêchu, plus sobre, plus chaleureux…) change surtout la forme (rythme, styles, animations) ; garde l'idée des messages, libre à toi de les reformuler si ça sert le style.

« rationale » : une seule phrase pour la gérante, en français, tutoiement, qui explique ton choix principal (ex. « J'ouvre sur la planche, c'est le moment le plus intense, puis je ralentis sur la respiration. »).`;

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
  look_name: z.string().optional().describe("Nom d'un style de brand.text_looks à appliquer à ce texte, recopié exactement ; sinon rien (le gabarit s'en charge)"),
});

export const editorOutputSchema = z.object({
  plan: editPlanObjectSchema.extend({
    template: motionTemplateSchema,
    texts: z.array(editorTextSchema),
    // Retouch and blur are set by their own tools and carried over (carryRetouch), never written by the editor.
    segments: z.array(z.union([editPlanSegmentSchema.omit({ adjust: true, blur: true, photo: true }), editPlanSceneSegmentSchema, editorMotionSegmentSchema])).min(1),
  }),
  rationale: z.string(),
});

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
        ...(before.y !== undefined ? { y: before.y } : {}),
        ...(before.scale !== undefined ? { scale: before.scale } : {}),
        ...(before.backdrop !== undefined ? { backdrop: before.backdrop } : {}),
      };
    }),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The editor's plan as an edit plan: template texts become the segment's `texts` record. */
export function fromEditorPlan(plan: EditorOutput["plan"], looks: SavedLook[] = []): EditPlan {
  const byName = new Map(looks.map((l) => [l.name.toLowerCase(), l]));
  return {
    ...plan,
    // A named look brings its style back (and, for a list, its details and bullets).
    texts: plan.texts.map(({ look_name, ...t }) => {
      const saved = look_name ? byName.get(look_name.trim().toLowerCase()) : undefined;
      if (!saved) return t;
      return { ...t, look: saved.look, ...(t.items?.length && saved.list?.detail_look ? { detail_look: saved.list.detail_look } : {}), ...(t.items?.length && !t.bullet && saved.list?.bullet ? { bullet: saved.list.bullet } : {}) };
    }),
    segments: plan.segments.map((s): PlanSegment => {
      if (!("motion" in s)) return s;
      const { template_texts, template_id, ...motion } = s.motion;
      if (!template_id) return { ...s, motion };
      const texts = Object.fromEntries(
        (template_texts ?? []).filter((t) => SLOT_NAME.test(t.slot)).map((t) => [t.slot, t.text.slice(0, 200)]),
      );
      return { ...s, motion: { ...motion, template_id, texts } };
    }),
  };
}

/** The longest a photo stays on screen in a Reel (it plays still, with a slow zoom). */
export const PHOTO_MAX_SECONDS = 5;

/**
 * New made-to-measure animations in one Reel: as many as the quote she agreed to
 * (each priced, `CREDIT_PRICES.newScene`), up to this technical ceiling (each is an
 * Opus call and a scene to render).
 */
export const MAX_FREE_SCENES = 8;

/**
 * The longest Reel made: a discovery Reel tells a story in 20 to 30 s, and a
 * render takes 4 to 7 s per second of video inside a 300 s job step.
 */
export const MAX_REEL_SECONDS = 30;

/**
 * Makes a model-written plan safe to render: segments inside their clips, a
 * duration that matches the timeline, texts inside it. Throws if nothing usable is left.
 */
export function normalizeEditPlan(plan: EditPlan, clipDurations: Record<string, number>, maxFreeScenes = MAX_FREE_SCENES): EditPlan {
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
    // Free scenes are the costly part of a montage: past the cap, the fixed fallback plays instead.
    if (isMotionSegment(s) && !s.motion.template_id && freeScenes++ >= maxFreeScenes && s.motion.fallback) {
      return [{ scene: s.motion.fallback, duration: round(Math.min(6, Math.max(1, s.duration))) }];
    }
    if (isMotionSegment(s)) return [{ ...s, duration: round(Math.min(8, Math.max(1, s.duration))) }];
    if (!isClipSegment(s)) return [{ ...s, duration: round(Math.min(6, Math.max(1, s.duration))) }];
    const max = clipDurations[s.clip_id];
    const out = round(max ? Math.min(s.out, max) : s.out);
    const clip = { ...s, in: round(Math.max(0, s.in)), out };
    return s.clip_id in clipDurations && clip.out - clip.in >= 0.5 ? [clip] : [];
  });
  if (!segments.length) throw new Error("Le plan de montage ne garde aucun plan utilisable");
  // Too long to render in time: the plans before the last one go, the last (the end) stays.
  while (segments.length > 2 && renderDuration({ ...plan, segments }) > MAX_REEL_SECONDS) segments.splice(segments.length - 2, 1);

  const draft = { ...plan, segments, images: [], music: null };
  const duration = Math.max(3, renderDuration(draft));
  const texts = plan.texts
    .map((t) => ({ ...t, from: round(Math.max(0, t.from)), to: round(Math.min(t.to, duration)) }))
    .filter((t) => t.to - t.from >= 0.5)
    .map((t) => ({ ...t, emphasis: t.emphasis?.filter((e) => t.text.toLowerCase().includes(e.toLowerCase())) }));

  return editPlanSchema.parse({ ...draft, duration, texts });
}

/**
 * A variant of a delivered montage, without the editor: the same cut with
 * another template (the next one by default) and, if given, another hook.
 */
export function variantPlan(plan: EditPlan, change: { template?: MotionTemplate; hook?: string }): EditPlan {
  const current = motionTemplateSchema.safeParse(plan.template);
  const next = change.template ?? MOTION_TEMPLATES[((current.success ? MOTION_TEMPLATES.indexOf(current.data) : -1) + 1) % MOTION_TEMPLATES.length]!;
  const hook = change.hook?.trim();
  let replaced = false;
  const texts = plan.texts.map((t) => {
    if (!hook || replaced || t.style !== "hook") return t;
    replaced = true;
    return { ...t, text: hook.slice(0, 120), emphasis: [] };
  });
  return editPlanSchema.parse({ ...plan, template: next, texts });
}
