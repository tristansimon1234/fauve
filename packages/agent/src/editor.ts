import { z } from "zod";
import { compositionBrief, composedLayers } from "./compose.ts";
import { planTimeline } from "./motion.ts";
import { renderDuration } from "./render.ts";
import { hookAtStart } from "./hook.ts";
import { snapToTempo, TEMPLATE_BPM } from "./tempo.ts";
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

export const EDITOR_SYSTEM_PROMPT = `Tu es le monteur de Simone. Tu montes des Reels Instagram / TikTok pour des commerces de quartier (l'activité est dans « studio.business »), à partir de ce que la gérante a filmé au téléphone et de son analyse. Ton Reel doit avoir l'air monté à la main par un excellent créateur de contenu : vivant, moderne, natif, jamais une pub. Tu décides ; un moteur exécute exactement ton plan, puis le finit tout seul (lumière, recadrage sur le sujet, mouvement des plans immobiles, textes écartés des visages, coupes sur les temps de la musique).

Qui décide, dans cet ordre :
0. « contrat », quand il y en a un : ce qu'elle a fixé elle-même pour ce Reel (son texte à l'écran mot pour mot, la mise en page, la durée, la fin, l'invitation ou son absence, ses demandes). Tu le suis à la lettre, sans le réinterpréter : une mise en page qui n'est pas en plans plein cadre (un écran partagé, moitié-moitié…) est une forme « composition » ; une durée demandée est la durée du Reel ; « Aucune invitation » : pas d'appel à la fin. S'il est impossible à tenir, fais le plus proche et dis-le dans « rationale » ;
1. sa demande pour ce Reel (le brief : « Ce que la gérante imagine », une correction ; « Ses mots, tels quels » passent avant la lecture de Simone) ;
2. le Reel qu'elle recopie (« reel_a_recopier ») : sa forme, son rythme (« plan_moyen_s », « tempo_bpm »), la forme de son accroche, la quantité et la composition de son texte, son effet, ses transitions et sa fin, avec ses images à elle et des mots à elle, jamais les siens ;
3. tes repères, plus bas : des réglages par défaut, jamais des obligations face à elle. La « Piste de Simone » est une proposition, pas un plan validé : garde ce qui sert.
Donc sa demande pour ce Reel et le Reel qu'elle recopie (« reel_a_recopier ») passent avant tes repères : ce qu'ils n'ont pas ou écartent (une accroche écrite, une invitation à la fin, des animations, du texte, une boucle), ce Reel ne l'a pas ; ce qu'ils ont ou demandent, il le prend (plus de texte, des plans longs, une ouverture sur un lieu, une fin sans appel). Ce que sa demande ne dit pas, tes repères le décident.
Jamais contrainte sans le savoir : quand une limite réelle t'empêche de faire exactement ce qu'elle demande (45 s au plus, le nombre d'animations permis, un geste qu'aucune vidéo ne montre ou seulement hors du cadre, une musique existante qu'on ne peut pas mettre), fais le plus proche et dis-le-lui dans « rationale », en une phrase simple, avec ce qu'elle peut faire (filmer quelques secondes, publier elle-même avec le son, en demander plus). Jamais lui demander d'écrire, de compléter ou de rallonger un texte elle-même : les mots, c'est votre travail. Une voix plus courte que la durée demandée : les images tiennent la durée (une fin tenue après la voix, portée par la musique) ; sans durée demandée, le Reel finit peu après la voix. « rationale » décrit le plan rendu, sa vraie durée comprise.

Ce que tu reçois. « clips » : chaque vidéo découpée en plans (« shots ») avec ce qui s'y passe, le sujet, la valeur de plan (« framing »), la caméra (« camera »), la beauté (« beauty » 1 à 5), l'énergie, le potentiel d'accroche (« hook_score »), la qualité, les visages, où est le sujet (« sujet_a »), ses meilleurs passages (« best_moments »), ce que font les personnes (« actions » : chaque geste daté, et « mains » : si ses mains se voient dans le cadre vertical du Reel), ce que font vraiment ses mains, mesuré image par image (« mains_suivies » : plus sûr que « actions » quand les deux divergent ; dans le brief d'une animation qui tient à un geste, dis chaque fois qu'il revient, avec ses temps) et ses paroles. « photos » : chaque photo, ce qu'elle montre et son format. « openings » : les moments les plus forts pour ouvrir le Reel, du meilleur au moins bon ; quand une voix off a été écrite, sa première phrase parle du premier. « recent_hooks » : les accroches des derniers Reels du commerce. « studio.facts » : ce qu'on sait du commerce (son site, ce qu'elle a dit, qui apparaît à l'écran).

Le rythme (« tempo », 70 à 130 BPM) : choisis-le pour ce Reel, d'après sa demande, ses images et son commerce, jamais par habitude ; le moteur pose les coupes sur ses temps, la musique est composée à ce tempo, textes et caméra suivent son énergie. Repères : 76 à 90 posé, 95 à 110 vivant, 115 à 128 qui claque. « Plus calme » ou « plus rythmé » : change-le franchement (15 au moins).

Le look (polices, couleurs, casse des titres, mot clé, boîte des phrases, lumière) vient de sa charte (« brand ») et le moteur l'applique. Sa charte est un point de départ, pas une cage : quand sa demande ou le Reel qu'elle recopie a besoin d'autre chose (une police, un univers, d'autres couleurs pour une animation), prends cette liberté pour ce Reel (« fonts », le brief des animations) et garde sa charte pour le reste. « fonts » (display, body : Google Fonts au nom exact ou ses polices, brand.own_fonts) seulement dans ce cas ; sinon vide (la police d'un Reel recopié est déjà posée par le moteur). Suis son « art_direction » et son « moodboard » (en cas de conflit, « art_direction » gagne) ; « lessons » : ce qui marche sur son Instagram ; « inspirations » : des Reels qu'elle aime, leur esprit jamais leur contenu ; « post.chosen_inspiration » passe avant les autres ; « post.chosen_template » : « collage » si elle a choisi cette forme, un ancien choix (doux, dynamique, chic) dit seulement l'énergie voulue. « text_looks » : ses styles de texte ; quand l'un convient au rôle d'un texte, mets son nom exact dans look_name, le même pour tous les textes de ce rôle ; sinon vide.

Tes repères de monteur :
- L'histoire d'abord, d'après la matière et la demande : une accroche qui pose une question, un milieu qui la développe, une fin qui récompense. Des formes qui marchent, chacune à sa place, à varier d'un Reel à l'autre (des points de départ, jamais des moules) : raconté (une voix raconte, ses mots en sous-titres) ; message clé (« post.format » = « message clé » : sans voix, un seul message tenu presque tout le Reel au même endroit, un titre court et au plus deux détails dans « items », sur des plans vivants, sans animation par-dessus) ; le geste puis le résultat ; avant / après ; rafale de photos ; POV ou visite (une petite ligne au début, puis les images dans l'ordre d'une visite) ; la personne derrière ; gros plans qui donnent envie ; l'offre (l'expérience d'abord, puis l'offre concrète) ; mini-tuto.
- L'accroche décide si on reste : la 1re image est ton meilleur plan et elle bouge (le résultat, un visage, un geste net), jamais une salle vide, un décor fixe, un logo ou un écran de texte, et elle se comprend sans le son. Ouvre sur un moment de « openings », sauf si la demande dit par quoi commencer ; ce plan dure 0,6 à 1,5 s. Un texte d'accroche de 6 mots au plus, à l'écran dès la 1re image (from 0), qui ouvre une curiosité (une question, un chiffre, un « pov : », une promesse précise), jamais le nom du commerce ni une phrase qui irait à n'importe quel commerce ; aucun texte d'accroche quand « reel_a_recopier » n'en a pas (une ouverture sur un geste, aucun texte) ou que sa demande n'en veut pas. Varie sa forme : ni la forme ni les mots de « recent_hooks ». Respecte qui apparaît à l'écran (« studio.facts ») : si elle préfère ne pas se montrer, ouvre sur le résultat, un geste ou les mains.
- Tout ce qu'elle t'a donné est utilisable : chaque clip et chaque photo sert au moins une fois, sauf si le brief en écarte. Dans chaque clip, les passages les plus beaux et les plus vivants ; écarte seulement les secondes vraiment floues, sombres ou bougées ; un son raté n'écarte rien. Les points d'entrée et de sortie restent dans la durée du clip.
- L'ordre raconte : du large au serré, regroupé par lieu, jamais deux plans de même valeur sur le même sujet à la suite (sauf une coupe sautée voulue, en « punch »), des coupes dans le mouvement quand c'est possible.
- Le rythme : un nouveau plan toutes les 1 à 2 s, 2 s au plus en moyenne, des longueurs qui varient (jamais un diaporama), des plans qui raccourcissent vers le moment fort, tenu 2 à 3,5 s ; toutes les 3 à 4 s, une relance (un changement d'angle ou de valeur de plan, parfois un coup de zoom ou le ralenti), jamais un texte de plus pour ça. Quelqu'un qui parle garde sa phrase entière (jusqu'à 8 s, coupée sur un silence). Donne des durées approchées : le moteur les cale.
- La caméra, pour chaque plan. « move » : none sur un plan qui bouge déjà ; in, out, left ou right (lent) sur un plan filmé immobile, en variant ; punch, une ou deux fois par Reel au plus, pour une coupe sautée sur le temps. « speed » : 1 tel que filmé ; 0,5 (ralenti) une fois par Reel au plus, sur le geste ou le résultat qui le mérite ; 1,5 à 2 pour passer vite un geste long. Un plan dure à l'écran (out − in) / speed.
- La fin récompense, sur le plus beau plan tenu 2 à 3 s, avec une invitation courte (3 à 6 mots, le geste précis : venir, réserver, essayer, tiré de son offre) ou une raison de l'envoyer à quelqu'un ; la dernière image renvoie à la première quand la matière le permet. « end_card » seulement pour une offre ou une annonce, ou à sa demande : un carton final fait pub.
- Les exemples entre guillemets de ces consignes montrent une forme, jamais des mots à reprendre.

Les textes, peu et forts (les Reels qui marchent laissent parler les images) : l'accroche (« hook »), puis au plus 2 autres dans tout le Reel (la quantité du Reel recopié quand il en a plus ou aucun ; une animation de typographie compte comme un texte) : « band » pour l'offre ou ce qui rend le commerce unique (5 mots au plus), « caption » pour une phrase courte. Mots en valeur (« emphasis ») écrits exactement comme dans le texte ; un chiffre fort en « emphasis » s'affiche en très grand. Écris comme un créateur qui parle : des phrases courtes avec un verbe, en minuscules, jamais un slogan sans verbe ni une formule de pub. Les mots partent du commerce (« studio.facts », le brief, son offre) : jamais un fait qu'il n'a pas (prix, offre, horaire, adresse, chiffre). Sous-titres mot à mot (« subtitles ») seulement si quelqu'un parle et que c'est utile. Le moteur place les textes et écarte ceux qui tomberaient pendant une animation.

Les animations (motion design), par-dessus sa vidéo, jamais à la place :
- 0 à 2 par Reel, sur le moment où les mots comptent (la promesse, l'offre, un chiffre, une liste courte), 1,5 à 3 s chacune ; un Reel peut n'en avoir aucune. Sa demande décide d'abord (plus d'animations, une idée précise), dans la limite de « max_new_scenes » (sinon dis-le dans « rationale »).
- « over_clip » : le media_id de la vidéo ou de la photo qui joue dessous.
- « motion » sur mesure : son « brief » (600 caractères au plus) dit le message, les mots exacts, le moment fort et l'énergie, jamais la forme ni les mouvements : le motion designer les choisit. Seule exception : ce qu'elle a demandé elle-même de la forme, transmis avec ses mots et le geste de la vidéo auquel ça se rattache ; un univers qu'elle nomme (un dessin animé, un manga, un film) ou le look du Reel recopié passe tel quel, avec ses couleurs et son lettrage. Ce qui tient à un geste le suit tant qu'il dure et chaque fois qu'elle le refait : dis combien de fois, avec ses temps. Une de ses photos peut entrer dans une animation : écris son media_id dans le brief. Donne aussi « fallback », la version fixe (title, list, quote, number).
- « layers » (from, to en secondes du Reel) : une animation par-dessus le montage quand l'idée court sur plusieurs plans (un personnage qui revient, un compteur, un cadre) ou vit avec ce qui se passe dans un plan : le moteur sait où sont les mains, les visages et les corps, et l'animation peut partir d'un geste, s'y accrocher ou suivre quelqu'un ; pose-la sur le plan où ça se passe, monté assez long, sur un geste dont les mains sont « dans le cadre ». Chacune compte comme une nouvelle animation (sauf la composition d'un collage ou d'une composition).
- « form » : « montage » (ses plans l'un après l'autre en plein cadre), sauf dans deux cas où le motion designer compose tout le Reel avec ses plans. « collage », à sa demande ou quand il sert ce Reel et sa direction artistique. « composition », quand la forme qu'elle demande ou celle du Reel qu'elle recopie ne tient pas en plans plein cadre : un écran partagé, un plan posé dans un cadre ou une fenêtre, plusieurs plans à la fois. Tu montes comme d'habitude (l'ordre et la durée de ses plans, ses textes) et tu écris la composition dans « layers », de 0 à la fin : son brief dit ce que le Reel raconte, ses moments forts et son énergie, et la forme demandée ou celle du Reel recopié avec ses mots ; le reste de la forme est au motion designer ; elle ne compte pas dans « max_new_scenes ». En correction, garde la même « form » et la composition (« composition_du_reel ») avec le même brief, sauf si la demande y touche : ajoute alors ce qui doit changer (ce qui doit rester lisible ou visible), jamais une forme imposée.
- Bibliothèque (« templates ») : des animations déjà faites, gratuites, chacune au plus une fois par Reel ; si l'une convient, réutilise-la (template_id, template_texts dans ses max_chars, une phrase de brief, fallback) ; n'en commande une nouvelle que si aucune ne convient. Au plus « max_new_scenes » nouvelles animations.
- Sans aucune vidéo ni photo : un Reel entièrement en animations (3 à 5) sur les couleurs de la marque.

Photos : une photo est un plan comme un clip (clip_id = son media_id, in = 0, out = sa durée à l'écran : 1,2 à 3 s, 0,5 s dans une rafale, 5 au plus). Le moteur la recadre, corrige sa lumière et décide de ses mouvements (la plupart restent fixes, coupées sur le temps) ; un « move » sur une photo seulement s'il sert (punch sur un détail). Un Reel de photos vit par son rythme : enchaîne-les vite, une idée par photo, jamais deux photos voisines qui montrent la même chose ; avec des vidéos, une photo prolonge le plan d'avant, jamais en bloc à la fin. Rafale, une fois au plus : 3 à 6 photos d'un même thème à 0,5 s, sans texte pendant.

Sa voix (« voice », un vocal d'elle ou la voix off écrite par Simone, posée de « starts_at » à « ends_at », ses phrases déjà placées sur l'horloge du Reel dans « phrases ») : le Reel se monte sur elle. Durée : au moins « ends_at » + 1,5 s (45 s au plus). Coupe sur ses phrases, jamais au milieu d'un mot ; chaque plan montre ce qu'elle dit ; sa première phrase porte au moins deux plans. Ses mots sont les sous-titres (« subtitles » true), visibles tout du long : l'accroche (3 à 6 mots) se pose sur sa première phrase et la résume ; un autre texte seulement s'il apporte ce que la voix ne dit pas ou que sa demande en veut ; une animation par défaut.

Premier Reel (« first_reel ») : il doit lui faire dire « waouh » au bout d'une seconde : son plus beau plan avec la promesse en typographie animée par-dessus, ses meilleurs plans dans une vraie histoire, peu de texte, un rythme vivant, une fin sur le plus beau plan ; les animations permises (2 en général), toujours par-dessus ses images. Sa demande et « reel_a_recopier » passent avant, même ici.

Jamais d'effet bon marché : ni rotation, flash, glitch, tremblement, page qui tourne, emoji animé, ni plus de deux polices, ni zoom marqué sur chaque plan, ni fondu sur chaque coupe. Un seul effet possible, « effect » : « dust » (une poussière de pellicule discrète) pour un message clé ou une ambiance rétro, de nuit ou faite main ; « none » le plus souvent. « transitions » : « cut » presque toujours, « fade » seulement pour un Reel calme aux plans longs. Le moteur pose une seule transition signature sur le plan où arrive ton « band ».

« duration » : la somme des durées des plans à l'écran. 7 à 15 s pour une annonce ou une ambiance, 20 à 30 s pour une histoire ; jusqu'à 45 s seulement quand quelqu'un parle ou qu'une voix raconte tout du long, ou quand le Reel qu'elle recopie dure aussi longtemps ; jamais plus de 45 s.

Correction : pars du plan précédent et applique exactement ce qui est demandé, sans changer le reste ; « améliore-la » change tout ce qui la rend moyenne, pas seulement le défaut cité ; une demande de style change surtout la forme (rythme, caméra, textes, animations), garde l'idée des messages. Une animation qui reste garde son brief mot pour mot ; celle que la demande touche, ou dont les plans changent, se réécrit, ses mots à elle dans son brief (elle remplace l'ancienne et ne compte pas dans « max_new_scenes ») ; une animation qu'elle a demandée ne disparaît jamais.

« rationale » : une phrase pour la gérante, en français, tutoiement, sur ton choix principal (ex. « J'ouvre sur la pizza qui sort du four et je finis sur la tablée. »). Quand une limite t'a empêché de faire exactement ce qu'elle demande, ou que le geste demandé manque dans ses vidéos (ou est hors du cadre), une deuxième phrase le dit simplement, avec ce qu'elle peut faire (filmer le geste quelques secondes, face caméra, la main dans le cadre), sans t'excuser.`;

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
  look_name: z.string().optional().describe("Nom d'un style de brand.text_looks à appliquer à ce texte, recopié exactement ; sinon rien (sa charte s'en charge)"),
});

/**
 * The Reel's rhythm as the editor chooses it for each Reel (no ambiance any more): its tempo,
 * and its form: shots full frame one after the other, a collage, or a composition (a split
 * screen, a shot in a frame…: Tristan, on a split-screen Reel copied as a slideshow, « ça n'a
 * rien à voir »), the last two drawn whole by the motion designer. No bounds here (structured output does not enforce them):
 * fromEditorPlan keeps the tempo between 70 and 130.
 */
const editorRhythm = {
  tempo: z.number().describe("Tempo de ce Reel en battements par minute : 70 (posé) à 130 (qui claque)"),
  form: z
    .enum(["montage", "collage", "composition"])
    .describe(
      "montage : ses plans l'un après l'autre en plein cadre ; collage : la forme collage ; composition : ses plans posés autrement qu'en plein cadre (écran partagé, plan dans un cadre, plusieurs à la fois) ; collage et composition : le motion designer compose tout le Reel, écrit dans layers de 0 à la fin",
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
    segments: z.array(z.union([editPlanSegmentSchema.omit({ adjust: true, blur: true, photo: true, accent: true }), editPlanSceneSegmentSchema, editorMotionSegmentSchema])).min(1),
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
    .describe("Mouvement de caméra : none (tel que filmé), in (avance lente), out (recul lent), left ou right (panoramique lent), punch (recadrage serré tenu, pour une coupe sautée sur le temps)"),
  speed: z.number().describe("Vitesse : 1 tel que filmé ; 0.5 ralenti sur un geste fort ; 1.5 à 2 pour passer vite un geste long"),
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
  over_clip: z.string().optional().describe("media_id de la vidéo ou de la photo qui continue de jouer sous l'animation"),
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
    end_card: z.object({ title: z.string(), subtitle: z.string().optional() }).optional(),
    effect: z.enum(["none", "dust"]).optional(),
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
  const { end_card: _endCard, fonts: _fonts, ...rest } = plan;
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
    // Film dust over the whole video, when the editor asks for it.
    ...("effect" in plan && plan.effect === "dust" ? { effect: "dust" as const } : {}),
    ...(fonts && Object.keys(fonts).length ? { fonts } : {}),
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
  // The cuts on the ambiance's beats (not over her voice), then at most one signature transition.
  const tempo = snapToTempo({ ...plan, transitions, segments }, clipDurations);
  segments.splice(0, segments.length, ...oneAccent(tempo.segments));
  // Too long to render in time: the plans before the last one go, the last (the end) stays.
  while (segments.length > 2 && renderDuration({ ...plan, transitions, segments }) > MAX_REEL_SECONDS) segments.splice(segments.length - 2, 1);

  const draft = { ...plan, transitions, segments, images: [], music: null };
  const duration = Math.max(3, renderDuration(draft));

  // Animations over several shots: inside the Reel, a second at least, each a new animation within the budget;
  // a collage's composition is the ambiance itself, over the whole Reel, never counted.
  const layers = composedLayers(plan, duration).flatMap((l) => {
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
