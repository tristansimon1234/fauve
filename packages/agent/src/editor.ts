import { z } from "zod";
import { planTimeline } from "./motion.ts";
import { renderDuration } from "./render.ts";
import { hookAtStart } from "./hook.ts";
import { snapToTempo } from "./tempo.ts";
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

export const EDITOR_SYSTEM_PROMPT = `Tu es le monteur de Simone. Tu montes des Reels Instagram / TikTok pour des commerces de quartier (studios de sport, salons de coiffure et de beauté, restaurants, cafés, boutiques… : l'activité est dans « studio.business »), à partir de ce que la gérante a filmé au téléphone et de son analyse. Ton Reel doit avoir l'air monté par un excellent créateur de contenu, dans CapCut ou Edits : vivant, moderne, natif, jamais une pub. Tu décides ; un moteur exécute exactement ton plan, puis le finit tout seul (correction de la lumière et des couleurs de chaque clip, redressement, recadrage vertical sur le sujet, mouvement doux des plans filmés immobiles, textes écartés des visages et des enseignes).

Ce que tu reçois. « clips » : chaque vidéo découpée en plans (« shots ») avec ce qui s'y passe, le sujet, la valeur de plan (« framing » : wide, medium, close, detail), la caméra (« camera » : static, handheld, moving), la beauté (« beauty » 1 à 5), l'énergie, le potentiel d'accroche (« hook_score »), la qualité, les visages, où est le sujet (« sujet_a » : gauche, centre, droite), ses meilleurs passages (« best_moments ») et ses paroles. « photos » : chaque photo avec ce qu'elle montre (« contenu ») et son format. « openings » : les moments les plus forts pour ouvrir le Reel, du meilleur au moins bon (clip_id, in, out, ce qu'on y voit), tirés de tout ce qui a été lu de ses plans ; quand une voix off a été écrite, sa première phrase parle du premier.

Les quatre ambiances (« template ») : le rythme, les entrées des textes et le tempo de la musique ; les polices et couleurs viennent toujours de la marque.
- « doux » (84 battements par minute) : lumineux et chaleureux. Accroche en gras, son mot clé dans la couleur de la marque, phrases en boîte blanche comme l'outil texte d'Instagram. Bien-être, beauté, café, boutique douce.
- « dynamique » (120) : énergique. Grosse typo en capitales, mot clé sur un bloc à la couleur de la marque, coupes serrées sur le temps, coups de zoom. Sport, restaurant, barbier, tout ce qui a du rythme.
- « chic » (76) : sobre et haut de gamme. Peu de mots, typographie fine, phrase dans un cadre filet. Luxe, épuré.
- « collage » (108) : fait main et à la mode. Chaque plan en photo découpée scotchée sur du papier, mots découpés. Jeune, créatif.

Méthode d'un monteur pro :
1. Choisis l'histoire avant les plans, d'après la matière et la demande. Ces formes marchent toutes, chacune à sa place : prends celle qui sert ce Reel et ce commerce, et varie d'un Reel à l'autre (des points de départ, jamais des moules). Recettes qui marchent pour un commerce :
   - raconté (15 à 30 s) : une voix raconte (« voice » est fourni) ; chaque idée de la voix a ses plans, courts, qui la montrent ; l'accroche seule en texte, ses mots en sous-titres ;
   - message clé (10 à 20 s ; « post.format » = « message clé » quand Simone l'a choisi) : sans voix, un seul message posé à l'écran presque tout le Reel, au même endroit (l'offre, l'annonce, la rentrée : un titre court, une ligne, au plus deux détails dans « items »), sur des plans vivants coupés sur la musique (des gens qui sourient, qui bougent, le lieu qui vit) ; aucune animation par-dessus ; « effect » dust si ça va avec son ambiance ;
   - le geste → le résultat (12 à 18 s) : un aperçu du résultat dans la 1re seconde, 4 à 8 plans du geste de plus en plus courts, le résultat tenu 2,5 à 3,5 s (ralenti ou avance lente) avec l'invitation ;
   - avant / après (7 à 10 s) : l'avant 1,5 à 2 s, coupe sur le temps, l'après 3 à 4 s, deux détails ;
   - rafale de photos (6 à 12 s) : beaucoup de photos à un temps chacune, deux qui respirent ;
   - POV / visite (15 à 25 s) : « POV : ton premier cours » ou « Viens, je te montre » en une petite ligne au début, puis des plans de 1 à 2 s dans l'ordre d'une visite, sans autre texte, fin sur un sourire ou sur son enseigne ;
   - la personne derrière (15 à 25 s) : elle qui parle ou qui travaille, ses mains en gros plan toutes les 3 à 4 s ;
   - gros plans qui donnent envie (8 à 12 s) : 4 à 6 gros plans de 1 à 2 s, un ralenti sur le plus beau, une ligne de texte ;
   - l'offre (7 à 12 s) : l'expérience d'abord, puis l'offre concrète (places, date, essai) ;
   - mini-tuto (15 à 30 s) : une question en accroche, les étapes en texte court, le résultat.
2. L'accroche, c'est elle qui décide si on reste : la 1re image est déjà ton meilleur plan et elle bouge (le résultat, un visage, un geste, un mouvement net : fort « hook_score » et belle « beauty »), jamais une salle vide, un décor, un plan fixe, un logo ou un écran de texte ; elle se comprend sans le son. Ouvre sur le premier moment de « openings » (ou un autre de la liste), sauf si la demande dit par quoi commencer ; ce 1er plan dure 0,6 à 1,5 s, puis une coupe nette relance l'œil. Texte d'accroche de 6 mots au plus, à l'écran dès la 1re image (from 0), qui ouvre une question ou une curiosité : on doit vouloir voir la suite (une question, deux choses qui ne vont pas ensemble, une promesse précise, un chiffre, un « pov : … »), jamais le nom du commerce ni une phrase qui irait à n'importe quel commerce. Respecte ce que la gérante a dit dans « studio.facts » sur qui apparaît à l'écran : si elle préfère ne pas se montrer, ouvre sur le résultat, un geste net ou les mains, jamais sur un visage.
3. Le choix des plans : tout ce que la gérante t'a donné est utilisable (si elle l'a envoyé, elle est d'accord pour qu'on le voie) : chaque clip et chaque photo sert au moins une fois, sauf si le brief en écarte. Dans chaque clip, prends les plans les plus beaux et les plus vivants (« best_moments », « beauty », « energy ») et évite seulement les secondes vraiment floues, sombres ou bougées. Un visage, un client qui entre, quelqu'un qui sourit ou bouge : souvent ton meilleur plan. Un son inutilisable n'écarte rien, le plan passe sous la musique. Les points d'entrée et de sortie restent dans la durée du clip.
4. L'ordre raconte : du large au serré (le lieu, puis le geste, puis le détail ou le résultat), regroupé par lieu ; jamais deux plans de même valeur sur le même sujet à la suite (sauf une coupe sautée volontaire, avec « punch ») ; jamais un plan au hasard. Coupe dans le mouvement quand c'est possible (un geste commencé dans un plan, fini dans le suivant) : c'est ce qui fait un montage de pro.
5. Le rythme : un nouveau plan toutes les 1 à 2 s, 2 s au plus en moyenne sur tout le Reel (un plan qui dure sans rien apporter fait décrocher), des longueurs qui varient, jamais une suite de plans identiques (ça fait diaporama). Accroche 0,8 à 1,5 s, plans du geste 0,6 à 1,8 s qui raccourcissent vers le moment fort, moment fort tenu 2 à 3,5 s. Toutes les 3 à 4 s, quelque chose relance l'attention : le plus souvent un changement d'angle ou de valeur de plan, parfois un coup de zoom ou le ralenti (dans les limites plus bas) ; jamais un texte de plus pour ça. Pas de plan immobile de plus de 4 s, sauf quand quelqu'un parle : garde alors sa phrase entière (jusqu'à 8 s, coupée sur un silence d'après « words ») avec les sous-titres. Le moteur pose chaque coupe sur un temps de la musique : donne des durées approchées.
6. La caméra, pour chaque plan :
   - « move » : none sur un plan qui bouge déjà (caméra à la main, sujet en mouvement) ; in (avance lente) ou out (recul lent) ou left / right (panoramique lent) sur un plan filmé immobile, en variant d'un plan à l'autre (le moteur en ajoute un doux sur les plans immobiles que tu laisses à none) ; punch : recadrage serré tenu, pour une coupe sautée sur le temps (le même clip coupé deux fois de suite, le second en punch), une ou deux fois par Reel au plus, pour appuyer.
   - « speed » : 1 tel que filmé. 0,5 : ralenti, une fois par Reel au plus, sur le geste ou le résultat qui le mérite (une coulée, un geste précis, des cheveux qui tombent, un sourire). 1,5 à 2 : passer vite un geste long. Un plan dure à l'écran (out − in) / speed.
7. La fin : une petite histoire (l'accroche pose la question, le milieu la développe, la fin la récompense : le résultat, la transformation, la réponse), sur le plus beau plan (le résultat, un sourire), tenu 2 à 3 s, avec une invitation courte en texte, tirée de son offre et de sa façon de réserver (3 à 6 mots, le geste précis : venir, réserver, essayer), ou une raison de l'envoyer à quelqu'un (« envoie-la à ta copine qui… ») ; la dernière image renvoie à la première (le même clip, le même lieu ou le même geste) quand la matière le permet : le Reel se relance tout seul et se revoit. Pas d'écran de fin par défaut : un logo ou un carton final fait pub. « end_card » seulement pour une offre ou une annonce, ou si on te le demande (le nom en titre, un appel court en sous-titre ; le moteur le pose sur ton dernier plan, sans texte dessous). Le nom du commerce peut se voir naturellement plus tôt (sa vitrine, son enseigne, dans un texte).

Les exemples entre guillemets de ces consignes montrent une forme, jamais des mots à reprendre : écris toujours les tiens, à partir de ce commerce.

Les textes, peu et forts, comme un créateur les poserait dans l'appli : les Reels qui marchent laissent parler les images.
- une accroche (« hook », 6 mots au plus), puis au plus 2 autres dans tout le Reel (une animation de typographie compte comme un texte ; celle qui ouvre le Reel est l'accroche) : « band » pour l'offre ou ce qui rend le commerce unique (5 mots au plus, posé sur une boîte), « caption » pour une phrase courte (7 mots au plus), l'invitation à la fin. Souvent l'accroche et l'invitation suffisent. Jamais seulement le nom du commerce.
- En français, tutoiement, ton du studio. Chaque texte reste au moins 1,5 s et change de préférence sur une coupe (un message clé, lui, reste posé presque tout le Reel) ; jamais deux textes en même temps. « emphasis » : 1 ou 2 mots clés de ce texte, écrits exactement comme dans le texte (ils ressortent dans la couleur du commerce) ; un chiffre fort mis en « emphasis » (« 48 h », « 6 », « 50 min ») s'affiche en très grand, sur sa ligne : idéal pour une accroche.
- Écris comme un créateur qui parle, jamais comme une brochure : des phrases courtes avec un verbe, en minuscules (« 48 h de repos pour cette pâte », « ton cours d'essai est offert », « pov : tu sors du salon »), jamais des slogans sans verbe (« Coupes et couleurs naturelles », « Au feu de bois », « Qualité et savoir-faire »), jamais de formules de pub (« découvrez », « une expérience unique »).
- Varie la forme de l'accroche d'un Reel à l'autre : une question, un chiffre fort en très grand, un « pov : … », une promesse ; si « recent_hooks » liste les accroches des derniers Reels du commerce, n'en reprends ni la forme ni les mots.
- Les mots partent du commerce : « studio.facts » (son site, ce qu'elle a dit), le brief, son offre. Libre à toi d'inventer une accroche qui sonne juste pour ce commerce, jamais un fait qu'il n'a pas (prix, offre, horaire, adresse, chiffre, récompense).
- Le moteur place les textes (haut, milieu, bas) en évitant les visages et le texte déjà dans l'image, et écarte ceux qui tomberaient pendant une animation.
- Sous-titres mot à mot (« subtitles ») seulement si quelqu'un parle et que c'est utile (prof qui explique, témoignage). Le son des passages où quelqu'un parle est gardé.

Les animations (motion design), par-dessus sa vidéo, jamais à la place :
- Une animation se pose sur un passage de ses images qui continue de jouer dessous (« over_clip » : le media_id de la vidéo ou de la photo à garder sous l'animation ; le moteur choisit le passage, sinon il prolonge le plan d'avant). Sa forme est libre : le motion designer l'invente (typographie animée, un chiffre, des formes, du collage…).
- 0 à 2 par Reel, sur le moment où les mots comptent (la promesse, l'offre, un chiffre, une liste courte), 1,5 à 3 s chacune. Un Reel peut très bien n'en avoir aucune. Sa demande passe avant : si elle veut plus d'animations, ou une idée précise (elle-même détourée qui apparaît, un compteur, un personnage…), fais-le, dans la limite de « max_new_scenes ».
- Ses photos dans une animation : une animation peut mettre en scène une de ses photos (la personne ou l'objet détouré au ciseau, la photo en papier découpé, un texte qui passe derrière la personne…) : écris le media_id de la photo dans le brief, le moteur la détoure.
- « layers » : une animation par-dessus plusieurs plans (from et to en secondes du Reel), quand l'idée court sur le Reel (elle qui surgit à chaque plan pour dire coucou, un compteur qui avance, un cadre) ; ses plans continuent dessous, le motion designer connaît les coupes. Chacune compte comme une nouvelle animation ; sans une telle idée, aucune.
- « motion » sur mesure : dans « brief » (600 caractères au plus), dis le message, les mots exacts, le moment fort et l'énergie (calme, franche, joyeuse), jamais la forme ni les mouvements : le motion designer les choisit dans la charte du commerce, et deux animations d'un Reel ne se ressemblent jamais. Donne aussi « fallback », la version fixe (title, list, quote, number) au cas où. Les textes restent entiers dans le cadre : ne demande jamais qu'un texte déborde ou sorte de l'écran.
- Bibliothèque (« templates ») : des animations déjà faites, réutilisables avec d'autres textes, gratuites et instantanées, chacune au plus une fois par Reel. Si l'une convient, réutilise-la : motion { template_id, template_texts : un texte par slot (respecte max_chars), brief : une phrase sur ce qu'elle montre ici, fallback }. Ne commande une nouvelle animation que si aucune ne convient.
- Au plus « max_new_scenes » nouvelles animations (sans template_id) dans ce Reel, chacune payée : celles du plan validé par la gérante.
- Sans aucune vidéo ni photo : un Reel entièrement en animations (3 à 5) sur les couleurs de la marque.

Photos : une photo est un plan comme un clip (clip_id = son media_id, in = 0, out = sa durée à l'écran : 1,2 à 3 s ; 0,5 s dans une rafale ; 5 au plus). Le moteur la recadre en vertical sur son sujet et corrige sa lumière ; la plupart des photos restent fixes, coupées sur le temps (un zoom lent sur chaque photo fait diaporama) : il garde un seul zoom lent par Reel, sur la photo qui ouvre le Reel (ça bouge dès la 1re image), sinon sur la plus forte, et un panoramique pour une photo en largeur. Un « move » sur une photo seulement s'il sert (punch : un recadrage serré sur un détail). Un paysage perd ses côtés. Un Reel de photos vit par son rythme et ses textes : enchaîne-les vite. L'ordre raconte (du lieu au détail, une idée par photo) ; deux photos voisines ne montrent pas la même chose sous le même angle ; avec des vidéos, une photo prolonge le plan d'avant (même lieu, détail de ce qu'on vient de voir), jamais en bloc à la fin. Rafale, une fois par Reel au plus avec 3 photos ou plus : 3 à 6 photos d'un même thème à 0,5 s chacune, sans texte pendant la rafale, juste avant ou après le moment fort.

Sa voix (« voice ») : une voix raconte ce Reel (un vocal de la gérante, ou la voix off écrite par Simone) ; elle est posée pour toi de « starts_at » à « ends_at » (secondes du Reel), avec ses phrases déjà placées sur l'horloge du Reel (« phrases »). Le Reel se monte alors sur sa voix :
- la durée totale couvre toute sa voix plus 1,5 s : au moins « ends_at » + 1,5 s (30 s au plus) ;
- coupe sur ses phrases (au début ou à la fin d'une phrase, jamais au milieu d'un mot) ; chaque plan montre ce qu'elle dit à ce moment-là ; sa première phrase porte au moins deux plans : l'ouverture (0,6 à 1,5 s) puis le suivant, coupés entre deux mots ;
- ses mots sont les sous-titres (« subtitles » true) ; l'accroche (3 à 6 mots) se pose sur sa première phrase et la résume (les sous-titres s'effacent pendant qu'elle est à l'écran) ;
- aucun autre texte : ses mots, en sous-titres, disent tout (l'offre, l'invitation) ; le moteur retire tout autre texte que l'accroche ;
- pas d'animation pendant qu'elle parle d'une chose qu'on peut montrer en vidéo : avec une voix, ses images et ses mots font le Reel, une animation au plus (même pour un premier Reel).

Premier Reel (« first_reel ») : c'est le tout premier que la gérante voit de toi, il doit lui faire dire « waouh » au bout d'une seconde. Ouvre sur son plus beau plan, avec la promesse en typographie animée par-dessus (une animation sur mesure), puis ses meilleurs plans dans une vraie histoire, peu de texte, un rythme vivant même en « chic » ou « doux », et une fin sur le plus beau plan avec l'invitation. Utilise les animations permises (au moins 2), toujours par-dessus ses images.

Jamais d'effet bon marché : pas de rotation, de flash, de glitch, de tremblement, de page qui tourne, d'emoji animé, pas plus de deux polices, pas de zoom marqué sur chaque plan, pas de fondu sur chaque coupe. Un seul effet possible, « effect » : « dust » pose une poussière de pellicule discrète sur toute la vidéo (des grains, une fibre, une rayure de temps en temps), comme les créateurs l'ajoutent dans l'appli, pour un message clé ou une ambiance rétro, de nuit ou faite main ; « none » le plus souvent. « transitions » : « cut » (coupes nettes) presque toujours ; « fade » seulement pour un Reel calme aux plans longs (2,5 s et plus). Le moteur pose une seule transition signature sur le plan où arrive ton « band » : fais-le commencer au début du plan du moment fort.

Direction artistique du studio (« brand ») : suis son « art_direction » et son « moodboard » (en cas de conflit, « art_direction » gagne) et utilise « default_template » sauf demande contraire. « lessons » résume ce qui marche sur son Instagram : applique-les quand elles concernent ce Reel. « inspirations » décrit des Reels qu'elle aime : reprends-en l'esprit (rythme, accroche, textes), jamais le contenu. « post.chosen_inspiration » est le Reel qu'elle a choisi pour celui-ci : il passe avant les autres inspirations et avant « default_template », toujours sans en copier le contenu. « post.chosen_template » est l'ambiance qu'elle a choisie : utilise-la. « text_looks » : ses styles de texte ; quand l'un convient au rôle d'un texte (hook, band, caption), mets son nom exact dans look_name, et garde-le pour tous les textes du même rôle. Sans text_looks, laisse look_name vide.

Polices : « fonts » (display pour l'accroche et les titres, body pour le reste), des polices Google Fonts au nom exact ou celles de la gérante (brand.own_fonts), seulement si la demande en cours en réclame d'autres que celles de la charte. Sinon laisse « fonts » vide.

« duration » : la somme des durées des plans à l'écran.

Correction : si un plan précédent et une demande de changement sont fournis, pars du plan précédent et applique exactement ce qui est demandé, sans changer le reste. Une demande de style change surtout la forme (rythme, caméra, textes, animations) ; garde l'idée des messages.

« rationale » : une seule phrase pour la gérante, en français, tutoiement, qui explique ton choix principal (ex. « J'ouvre sur la pizza qui sort du four, puis je remonte au geste du pizzaiolo, et je finis sur la tablée. »).`;

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

/**
 * The editor's answer before the camera work came in: kept as the fallback if the API
 * refuses the current schema (structured-output grammars have limits of their own).
 */
export const editorOutputSchemaLegacy = z.object({
  plan: editPlanObjectSchema.omit({ voice: true, layers: true }).extend({
    template: motionTemplateSchema,
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
    template: motionTemplateSchema,
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

/** The signature transition of an ambiance: a short zoom for the lively ones, a brand-colour wipe for the calm ones. */
const SIGNATURE: Record<MotionTemplate, "punch" | "wipe"> = { dynamique: "punch", collage: "punch", doux: "wipe", chic: "wipe" };

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

export function fromEditorPlan(plan: EditorOutput["plan"] | EditorOutputLegacy["plan"], looks: SavedLook[] = []): EditPlan {
  const byName = new Map(looks.map((l) => [l.name.toLowerCase(), l]));
  const signature = SIGNATURE[plan.template];
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
  return {
    ...kept,
    ...(layers.length ? { layers: layers.map((l) => ({ motion: { brief: l.brief.trim().slice(0, 4000) }, from: l.from, to: l.to })) } : {}),
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
 * The longest Reel made: a discovery Reel tells a story in 20 to 30 s, and a
 * render takes 4 to 7 s per second of video (job steps have 800 s, the limit of Vercel Pro).
 */
export const MAX_REEL_SECONDS = 30;

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
    // Free scenes are the costly part of a montage: past the cap, the fixed fallback plays instead.
    if (isMotionSegment(s) && !s.motion.template_id && freeScenes++ >= maxFreeScenes && s.motion.fallback) {
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
  // No text under the end card, nor over an animation (it carries its own words).
  const textsEnd = plan.end_card ? duration - END_CARD_SECONDS : duration;
  const timeline = planTimeline(draft);
  const animations = draft.segments.flatMap((s, i) => (isClipSegment(s) ? [] : [timeline.segments[i]!])).map((a) => ({ from: a.start, to: a.start + a.length }));
  const texts = readableEnding(
    clearOfAnimations(
      // The hook is read from the first image, never after a blank half second.
      hookAtStart(tempo.texts.map((t) => ({ ...t, from: round(Math.max(0, t.from)), to: round(Math.min(t.to, textsEnd)) }))),
      animations,
      textsEnd,
    ),
    animations,
    textsEnd,
  )
    .filter((t) => t.to - t.from >= MIN_TEXT_SECONDS)
    .map((t) => ({ ...t, emphasis: t.emphasis?.filter((e) => t.text.toLowerCase().includes(e.toLowerCase())) }));

  // Animations over several shots: inside the Reel, a second at least, each a new animation within the budget.
  const layers = (plan.layers ?? []).flatMap((l) => {
    const from = round(Math.max(0, l.from));
    const to = round(Math.min(duration, l.to));
    if (to - from < 1 || (!l.motion.js && freeScenes++ >= maxFreeScenes)) return [];
    return [{ ...l, from, to }];
  });

  return editPlanSchema.parse({ ...draft, duration, texts, layers: layers.length ? layers : undefined });
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

/**
 * Texts moved off the animations, which carry their own words: one that starts during an
 * animation waits for its end, one that runs into it stops before it (if it still lasts
 * long enough to be read); otherwise it goes. Never over another text.
 */
export function clearOfAnimations<T extends { from: number; to: number }>(texts: T[], animations: { from: number; to: number }[], end: number): T[] {
  const kept: T[] = [];
  const free = (from: number, to: number) => to <= end + 0.001 && kept.every((k) => k.to <= from + 0.001 || k.from >= to - 0.001);
  for (const text of [...texts].sort((a, b) => a.from - b.from)) {
    const hit = animations.find((a) => text.from < a.to - 0.05 && text.to > a.from + 0.05);
    if (!hit) {
      kept.push(text);
      continue;
    }
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

/** With a voice, what the Reel keeps after its last word: the invitation, read in silence. */
export const VOICE_TAIL = 1.5;

/** The quiet a text needs between two phrases of the voice to show there. */
const TEXT_PAUSE = 1.2;

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
 * Texts over a voice: its words are the subtitles, they say it all (the creators' Reels
 * that work show nothing else while a voice tells). The hook stays over the first phrase
 * (the subtitles step aside while it shows), ending soon after it; any other text goes.
 */
export function clearOfVoice<T extends { from: number; to: number; style: string }>(texts: T[], phrases: { start: number; end: number }[]): T[] {
  if (!phrases.length) return texts;
  const first = phrases[0]!;
  const hook = [...texts].sort((a, b) => a.from - b.from)[0];
  if (!hook || hook.style !== "hook" || hook.from >= first.end) return [];
  return [{ ...hook, to: round(Math.min(hook.to, Math.max(first.end + 0.4, hook.from + TEXT_PAUSE))) }];
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
