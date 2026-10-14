import { z } from "zod";
import { RESTYLES } from "./restyle.ts";
import {
  brandProfileSchema,
  motionTemplateSchema,
  editPlanSchema,
  platformSchema,
  postKindSchema,
  postStatusSchema,
  montagePlanSchema,
  reactionSchema,
  replyExtrasSchema,
} from "./schemas.ts";
import { effortSchema } from "./effort.ts";
import { ONBOARDING_STEPS } from "./onboarding.ts";
import { slideTextSchema } from "./slides.ts";
import { textLookSchema } from "./text-look.ts";

/** Changes to a text look: only the fields given change; null removes a fill, an outline or an emphasis style. */
const lookPatchSchema = textLookSchema.partial().extend({
  fill: textLookSchema.shape.fill.unwrap().nullable().optional(),
  stroke: textLookSchema.shape.stroke.unwrap().nullable().optional(),
  emphasis: textLookSchema.shape.emphasis.unwrap().nullable().optional(),
});

// Tool contracts shared by every runtime (webhook, web chat, jobs).
// Implementations live next to the database code in apps/web.

const isoDateTime = z.string().describe("Date et heure ISO 8601 avec fuseau, ex. 2026-10-15T18:00:00+02:00");

/** Photos and videos of a post that is not a montage (media_id of the received files), in order. */
const postMediaIds = z
  .array(z.string().uuid())
  .max(10)
  .optional()
  .describe("Photos ou vidéos reçues (media_id) : 1 pour un post photo, 2 à 10 dans l'ordre pour un carrousel, 1 pour une story sans montage");

export const toolSpecs = {
  get_studio_context: {
    description:
      "Lit le contexte du studio : nom, étape d'onboarding, rythme, plateformes, comptes connectés, profil de style. À appeler au début d'une conversation si tu ne l'as pas déjà.",
    input: z.object({}),
  },
  update_onboarding: {
    description:
      "Enregistre une information d'onboarding (nom et activité du commerce, prénom de la gérante, site web, lien de réservation, rythme de publication, plateformes) et fait avancer l'étape.",
    input: z.object({
      studio_name: z.string().min(1).max(80).optional(),
      business_type: z.string().min(2).max(80).optional().describe("Activité, en quelques mots : « studio de Pilates », « salon de coiffure », « restaurant italien »…"),
      first_name: z.string().min(1).max(40).optional(),
      posts_per_week: z.number().int().min(0).max(21).optional(),
      stories_per_week: z.number().int().min(0).max(50).optional(),
      platforms: z.array(platformSchema).min(1).optional(),
      website_url: z.url().optional().describe("Site web du studio"),
      booking_url: z.url().optional().describe("Lien de réservation ou de prise de rendez-vous (bsport, Planity, TheFork, Momoyoga…), utilisé dans la bio et les stories"),
      step: z.enum(ONBOARDING_STEPS).optional().describe("L'étape d'onboarding où elle en est maintenant (avance-la dès qu'une étape est faite)"),
    }),
  },
  read_website: {
    description:
      "Lit une page web publique (le site du studio, ou une page précise comme les tarifs) : titre, description, texte, liens Instagram / TikTok, lien de réservation, pages du site, logo, couleurs dominantes et polices. À utiliser dès que la gérante donne son site, pour pré-remplir l'onboarding et le profil de style au lieu de reposer des questions.",
    input: z.object({ url: z.string().min(4).max(500).describe("Adresse de la page, avec ou sans https://") }),
  },
  get_connect_link: {
    description:
      "Renvoie le lien sécurisé (valable 15 min) vers la page où la gérante connecte son compte Instagram professionnel à Brigitte (TikTok arrive bientôt). À envoyer quand Instagram n'est pas connecté.",
    input: z.object({}),
  },
  get_post_link: {
    description:
      "Renvoie le lien sécurisé (valable 15 min, à usage unique) vers la page mobile d'une publication : la gérante y regarde la vidéo, lit la légende, valide, ou déplace et corrige un texte du doigt. À envoyer quand elle veut revoir ou modifier une publication (« renvoie-moi le lien », « je veux voir le rendu »). Dans l'application, pas de lien : la carte de la publication s'affiche sous ton message.",
    input: z.object({ post_id: z.string().uuid() }),
  },
  remember: {
    description:
      "Garde dans ta mémoire du commerce (valable dans toutes les conversations) des infos durables : activité précise, offre, prestations, prix, horaires, adresse, équipe, public, temps forts, goûts de la gérante pour ses posts. Une phrase précise par info. remove : les numéros d'infos de la Mémoire du contexte devenues fausses.",
    input: z.object({
      add: z.array(z.string().min(3).max(240)).max(8).optional(),
      remove: z.array(z.number().int().min(1)).max(10).optional(),
    }),
  },
  suggest_dates: {
    description:
      "Les prochains jours libres pour publier (sans publication déjà prévue), à l'heure habituelle du commerce. Pour proposer une date en boutons quand elle crée une publication sans en donner.",
    input: z.object({ count: z.number().int().min(1).max(6).default(3) }),
  },
  list_inspirations: {
    description:
      "Les inspirations de la gérante : des Reels qu'elle aime, partagés sur Instagram ou ajoutés dans l'app, avec ce qu'on peut en reprendre (accroche, rythme, textes). À regarder avant de proposer un nouveau Reel, pour lui demander s'il doit suivre l'une d'elles.",
    input: z.object({}),
  },
  list_media: {
    description:
      "La médiathèque du studio : les photos et vidéos déjà reçues (WhatsApp, app, médiathèque), les plus récentes d'abord, avec leur media_id, leur date, leur format et ce qu'on y voit quand c'est connu. À regarder dès que la gérante parle de photos ou de vidéos déjà envoyées (« celles de ce matin », « regarde dans la médiathèque », « les 4 photos que j'ai prises ») : ne lui demande jamais de les renvoyer.",
    input: z.object({
      kind: z.enum(["image", "video", "all"]).default("all").describe("image pour les photos, video pour les vidéos"),
      days: z.number().int().min(1).max(90).default(14).describe("Jusqu'à combien de jours en arrière"),
      limit: z.number().int().min(1).max(30).default(20),
    }),
  },
  get_calendar: {
    description: "Liste les publications du studio entre deux dates, avec leur statut.",
    input: z.object({ from: isoDateTime, to: isoDateTime }),
  },
  create_post: {
    description: "Ajoute une publication au calendrier (statut « planned »).",
    input: z.object({
      kind: postKindSchema,
      title: z.string().min(1).max(120).describe("Titre court affiché dans le calendrier"),
      scheduled_at: isoDateTime,
      platforms: z.array(platformSchema).min(1),
      theme: z.string().max(60).optional(),
      media_ids: postMediaIds,
    }),
  },
  update_post: {
    description:
      "Met à jour une publication : légende, hashtags, horaire, plateformes, statut. Les changements de statut suivent la machine à états (rien n'est programmé sans validation de la gérante).",
    input: z.object({
      post_id: z.string().uuid(),
      caption: z.string().max(2200).optional(),
      hashtags: z.array(z.string().regex(/^[^#\s]+$/)).max(30).optional().describe("Sans le #"),
      scheduled_at: isoDateTime.optional(),
      platforms: z.array(platformSchema).min(1).optional(),
      status: postStatusSchema.optional(),
      agent_note: z.string().max(600).optional().describe("Explication de tes choix, affichée dans la web app"),
      media_ids: postMediaIds,
    }),
  },
  request_content: {
    description:
      "Ajoute un élément à la liste « À filmer » et passe la publication liée en « content_requested ».",
    input: z.object({
      post_id: z.string().uuid().optional(),
      label: z.string().min(1).max(120).describe("Quoi filmer, ex. « Les mains en gros plan sur le geste »"),
      hint: z.string().max(160).optional().describe("Angle, lumière, durée"),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  },
  analyze_clips: {
    description:
      "Regarde les vidéos reçues (analyse Gemini) : plans horodatés, sujet, énergie, potentiel d'accroche, qualité, visages, meilleurs passages, paroles. À appeler avant tout plan de montage, avec les media_id indiqués dans la conversation. Peut prendre jusqu'à une minute par vidéo.",
    input: z.object({ media_ids: z.array(z.string().uuid()).min(1).max(10) }),
  },
  quote_montage: {
    description:
      "Prépare un montage ou une correction et son prix en crédits (obligatoire avant tout montage). Un petit montage (20 crédits au plus) part aussitôt seulement si go est true (elle t'a dit de le faire) : la réponse dit status started. Sinon, ou au-delà, c'est un devis à présenter, avec un bouton Lancer. Pour un nouveau montage, donne toujours « plan » : la durée, le style et chaque scène dans l'ordre (vidéo, animation, fin) ; il s'affiche sur le devis, fixe le nombre de scènes animées facturables et guide le monteur. Renvoie le coût de base, le maximum si le monteur crée de nouvelles scènes animées, et le solde. Décris ensuite le plan à la gérante (durée, nombre de scènes, ce qu'elles montrent) et le coût ; pour un devis (pas started), attends son accord : montage ne part qu'au tour suivant, avec ce quote_id. Une vidéo sans media_ids est entièrement en motion design ; une correction (« plus doux », « enlève le texte », « change la police ») part du montage précédent.",
    input: z.object({
      post_id: z.string().uuid(),
      media_ids: z.array(z.string().uuid()).max(10).optional().describe("Clips à monter (media_id). Facultatif pour une correction ou une vidéo 100 % motion design."),
      brief: z.string().max(600).optional().describe("Intention ou correction, avec les textes exacts si besoin. Ex. « ouverture en motion design avec RENTRÉE en grand », « police Montserrat », « visages OK »"),
      correction: z.boolean().default(false).describe("true pour modifier le montage existant de cette publication"),
      plan: montagePlanSchema.optional().describe("Le plan proposé (obligatoire pour un nouveau montage, facultatif pour une correction)"),
      go: z
        .boolean()
        .default(false)
        .describe(
          "true seulement si la gérante vient de te dire de lancer ce nouveau montage (« vas-y », « lance », « fais-la », « oui » à ta proposition de plan). Répondre à une question (le format, motion design ou vidéo, le sujet) n'est pas un accord : false, et le devis attend son « Lancer ». Une correction ou une variante ne part jamais toute seule : une critique (« c'est plat », « je n'aime pas ») n'est pas un accord, elle voit d'abord le plan et le prix.",
        ),
      inspiration_id: z
        .string()
        .uuid()
        .optional()
        .describe("L'inspiration choisie par la gérante pour ce Reel (list_inspirations) : le monteur la suit en priorité. Inutile si elle l'a déjà choisie en créant la publication."),
      max_new_scenes: z.number().int().min(0).max(2).optional().describe("Nouvelles scènes animées sur mesure permises (3 crédits chacune). Par défaut 1 pour un nouveau montage (2 pour le tout premier Reel) et 0 pour une correction : le monteur réutilise sa bibliothèque. Mets 1 sur une correction seulement si elle demande une nouvelle animation, 2 seulement si elle veut un Reel très travaillé, 0 si elle veut économiser."),
      effort: effortSchema
        .optional()
        .describe(
          "Niveau de soin : rapide (une version, sans relecture), soigne (Brigitte regarde la vidéo rendue et la fait corriger si besoin), max (deux versions, Brigitte garde la meilleure et la peaufine). Par défaut celui du studio (contexte). rapide si elle est pressée ou pour un essai ; max pour un post important (lancement, offre, temps fort) ou si elle le demande.",
        ),
      variant: z
        .object({
          template: motionTemplateSchema.optional().describe("Style de la variante ; par défaut le suivant (doux → dynamique → chic)"),
          hook: z.string().max(80).optional().describe("Nouvelle accroche, courte et différente de l'actuelle"),
        })
        .optional()
        .describe("Variante du montage livré (1 crédit, sans nouveau montage) : même découpage, autre style et autre accroche"),
    }),
  },
  montage_status: {
    description:
      "Où en sont les montages lancés ces 3 dernières heures (ou celui d'une publication) : en montage (le monteur écrit le plan), 2e version (Max), en rendu, en relecture (tu regardes la vidéo), en correction, ou livré, et depuis combien de minutes. Un montage prend 2 à 15 minutes selon son niveau ; « late » signifie qu'il a sans doute échoué.",
    input: z.object({ post_id: z.string().uuid().optional() }),
  },
  choose_version: {
    description:
      "Remet une version précédente du montage d'une publication (par ex. la gérante préfère l'original à la variante). Gratuit. Les versions sont numérotées dans l'ordre (la plus récente est la dernière).",
    input: z.object({ post_id: z.string().uuid(), version: z.number().int().min(1) }),
  },
  montage: {
    description:
      "Lance le montage (ou la correction) devisé par quote_montage, une fois que la gérante a dit oui. En tâche de fond : ton monteur regarde les clips, choisit le gabarit, écrit les textes, réutilise ou crée des scènes animées, puis la vidéo est rendue ; en Soigné et en Max, Brigitte la regarde et la fait corriger avant de l'envoyer automatiquement (Rapide 2 à 4 min, Soigné 4 à 8, Max 8 à 15). Les crédits sont débités à la livraison, jamais plus que le devis.",
    input: z.object({
      quote_id: z.string().uuid(),
      effort: effortSchema.optional().describe("Seulement si la gérante a choisi un autre niveau que celui du devis (ex. « Version Max ») : le prix est celui de ce niveau, déjà annoncé"),
    }),
  },
  create_edit_plan: {
    description:
      "Plan de montage écrit à la main (à éviter : préfère montage, bien meilleur). Enregistre une nouvelle version du plan de montage d'une publication. Les clip_id sont les media_id des vidéos reçues, in/out des secondes dans ces clips (appuie-toi sur analyze_clips). Règles : coupes franches, 7 à 15 s, accroche (style hook) dès la 1re seconde, textes courts, jamais de musique intégrée. Le moteur place lui-même les textes dans les zones de sécurité ; images (logo) et sous-titres mot à mot ne sont pas encore rendus : laisse images vide et subtitles à false.",
    input: z.object({ post_id: z.string().uuid(), plan: editPlanSchema }),
  },
  render: {
    description:
      "Refait seulement le rendu vidéo de la dernière version du plan (sans le modifier), puis l'envoie à la gérante. Normalement inutile : montage fait déjà tout.",
    input: z.object({ post_id: z.string().uuid() }),
  },
  write_on_photos: {
    description:
      "Écrit du texte par-dessus les photos d'un carrousel ou d'un post photo, à la charte du studio (mêmes polices et styles que les montages). Rendu en images en une minute environ, gratuit ; le lien vers le résultat est envoyé automatiquement à la gérante quand c'est prêt. Une entrée par photo, dans l'ordre des photos de la publication (texts vide = photo sans texte). Court et lisible : une accroche sur la 1re photo (hook), puis un message par photo (band ou caption), 6 textes au plus par photo. Une liste (checklist, planning, étapes, tarifs) est un seul texte avec items (titre + détail facultatif par élément). Pour refaire la mise en page d'un exemple copié (copy_text_style), reprends un texte par bloc avec son look_name. Remplace le texte déjà posé ; la gérante peut ensuite déplacer ou corriger chaque texte elle-même.",
    input: z.object({
      post_id: z.string().uuid(),
      template: motionTemplateSchema.optional().describe("doux, dynamique ou chic ; par défaut celui déjà choisi, sinon doux"),
      slides: z
        .array(
          z.object({
            texts: z
              .array(
                slideTextSchema.pick({ text: true, style: true, emphasis: true, items: true }).extend({
                  look_name: z
                    .string()
                    .max(40)
                    .optional()
                    .describe("Nom d'un style de texte enregistré du studio (text_looks) : il apporte police, couleurs, fond, puces d'une liste et place ; sinon le style du gabarit"),
                }),
              )
              .max(6),
            logo: z.enum(["top", "bottom"]).optional().describe("Poser le logo du studio sur cette photo"),
          }),
        )
        .min(1)
        .max(10),
    }),
  },
  list_elements: {
    description:
      "La banque de composants du commerce (son design system pour le texte sur les photos) : titres, étiquettes, listes, prix, citations… chacun avec ses slots (les textes à remplir), ses textes d'exemple, et le kit (l'inspiration) d'où il vient. Les poser est gratuit et immédiat : regarde-la avant d'en créer.",
    input: z.object({}),
  },
  place_elements: {
    description:
      "Pose des composants de la banque sur des photos d'un carrousel ou d'un post photo, avec les mots du commerce pour chaque slot (un slot multiline prend plusieurs lignes séparées par \n). Sans x/y/w, un composant reprend sa place sur son kit. replace (par défaut) retire les composants déjà sur ces photos ; add les ajoute. Gratuit ; le rendu part après ta réponse et le lien est envoyé tout seul.",
    input: z.object({
      post_id: z.string().uuid(),
      photos: z
        .array(
          z.object({
            photo: z.number().int().min(1).max(10).describe("Numéro de la photo, à partir de 1"),
            elements: z
              .array(
                z.object({
                  element_id: z.string().uuid(),
                  texts: z.array(z.object({ slot: z.string(), text: z.string().max(400) })),
                  x: z.number().min(0).max(1).optional().describe("Bord gauche, part de la largeur"),
                  y: z.number().min(0).max(1).optional().describe("Bord haut, part de la hauteur"),
                  w: z.number().min(0.06).max(1).optional().describe("Largeur, part de la largeur"),
                  rotate: z.number().min(-45).max(45).optional(),
                }),
              )
              .min(1)
              .max(8),
          }),
        )
        .min(1)
        .max(10),
      mode: z.enum(["replace", "add"]).default("replace"),
    }),
  },
  design_elements: {
    description:
      "Brigitte crée de nouveaux composants pour la banque, comme un directeur artistique : à partir d'une inspiration (example_media_id, la capture d'un post qu'elle aime), il en sort chaque pièce réutilisable (titre, étiquette, checklist, prix dans un rond…), la code, la teste et la relit ; ou il crée les composants décrits dans request. Avec post_id, il les pose aussitôt sur les photos de la publication avec les mots du commerce. Prend 2 à 4 minutes et coûte 3 crédits, débités une fois livré ; un message part tout seul à la fin.",
    input: z.object({
      request: z
        .string()
        .min(1)
        .max(4000)
        .describe("Ce qu'il faut créer, et pour une publication ce qu'il faut écrire photo par photo, avec les mots exacts du commerce, et ce que la gérante a dit du style"),
      example_media_id: z.string().uuid().optional().describe("media_id de l'image d'inspiration à décomposer"),
      post_id: z.string().uuid().optional().describe("La publication où les poser (carrousel ou post photo), si c'est pour elle"),
      photos: z.array(z.number().int().min(1).max(10)).max(10).optional().describe("Photos à couvrir (à partir de 1) ; par défaut toutes"),
    }),
  },
  edit_element: {
    description:
      "Fait évoluer UN composant de la banque (« l'étiquette plus arrondie », « le titre en serif fin », « des cases plus grandes ») : une nouvelle version, l'ancienne est gardée. Avec post_id, la publication passe aussitôt à la nouvelle version et ses photos sont refaites. 2 crédits, une à deux minutes ; un message part tout seul à la fin. Pour changer seulement des mots ou une place sur une photo, utilise place_elements (gratuit).",
    input: z.object({
      element_id: z.string().uuid(),
      change: z.string().min(1).max(2000).describe("Le changement demandé, précis"),
      example_media_id: z.string().uuid().optional().describe("Une image jointe pour montrer le style voulu"),
      post_id: z.string().uuid().optional(),
    }),
  },
  retouch_photos: {
    description:
      "Retouche et/ou floute les photos d'un carrousel ou d'un post photo, gratuit. Brigitte regarde chaque photo (visages, plaques, écrans, lumière, horizon, sujet) : light = retouche légère et naturelle (lumière, contraste, couleurs, horizon redressé, recadrage qui garde le sujet) ; blur = les zones à flouter (face : visages, plate : plaques, screen : écrans, document : papiers). L'original n'est jamais modifié ; light false et blur vide retirent la retouche. Le rendu part après ta réponse et le lien est envoyé tout seul.",
    input: z.object({
      post_id: z.string().uuid(),
      photos: z.array(z.number().int().min(1).max(10)).max(10).optional().describe("Numéros des photos (à partir de 1) ; par défaut toutes"),
      light: z.boolean().default(true),
      blur: z.array(z.enum(["face", "plate", "screen", "document", "other"])).default([]),
      only_recognizable: z.boolean().default(false).describe("Ne flouter que les visages reconnaissables (pas les silhouettes de dos ou floues)"),
    }),
  },
  blur_video: {
    description:
      "Floute des zones sur toutes les vidéos du montage d'une publication (par défaut les visages), en les suivant dans le temps, gratuit. Pour les personnes filmées sans leur accord. what vide retire le flou. Refait le rendu après ta réponse (une à deux minutes) ; le lien est envoyé tout seul.",
    input: z.object({
      post_id: z.string().uuid(),
      what: z.array(z.enum(["face", "plate", "screen", "document", "other"])).default(["face"]),
    }),
  },
  copy_text_style: {
    description:
      "Copie le style des textes d'un exemple que la gérante a envoyé (une photo ou une capture d'un post qu'elle aime) : Brigitte lit chaque texte de l'image (police la plus proche, graisse, couleurs, fond en bloc, pilule ou surlignage, contour, ombre, inclinaison, place) et l'enregistre dans les styles de texte du studio. Avec post_id, l'applique aussitôt aux textes de cette publication (texte sur photos ou montage) et refait le rendu, gratuit ; le lien part tout seul. Renvoie les styles lus avec leur nom.",
    input: z.object({
      media_id: z.string().uuid().describe("media_id de l'image d'exemple reçue"),
      post_id: z.string().uuid().optional().describe("La publication à laquelle appliquer ce style"),
      note: z.string().max(300).optional().describe("Ce que la gérante a dit de l'exemple, ex. « le titre jaune »"),
      copy_places: z.boolean().default(true).describe("Reprendre aussi la place des textes de l'exemple"),
    }),
  },
  read_post: {
    description:
      "Relit une publication telle qu'elle est maintenant : format, statut, date, légende, médias, et les textes déjà posés (photo par photo pour un carrousel ou un post photo, avec leur style ; scène par scène pour un montage). À appeler avant de modifier ou de reprendre des textes (« mêmes textes », « change la couleur de la 2e photo ») : ne demande jamais à la gérante de te redonner des textes que tu as posés.",
    input: z.object({ post_id: z.string().uuid() }),
  },
  style_texts: {
    description:
      "Change le style des textes d'une publication (texte sur photos ou montage), gratuit, puis refait le rendu (le lien part tout seul). Tout est possible : police Google Fonts, graisse, italique, majuscules, taille, interlettrage, couleur, fond derrière (box : bloc, pill : pilule, line : surlignage ligne à ligne) avec couleur et transparence, contour, ombre (soft, strong, hard), mots en valeur (autre couleur, police, surlignage), inclinaison, apparition (fade, rise, pop, typewriter, slide), alignement. Prends un style enregistré (look_name), et/ou donne seulement ce qui change (look). reset remet le style du gabarit. Un nouveau style est toujours gardé dans les styles du studio (la gérante le retrouve en un clic dans l'éditeur) : donne-lui un nom parlant avec save_as (« Titre néon », « Bandeau rouge »), sinon il prend un nom simple.",
    input: z.object({
      post_id: z.string().uuid(),
      target: z.enum(["all", "hook", "band", "caption"]).default("all").describe("Quels textes : tous, ou seulement l'accroche (hook), les bandeaux (band), les petites lignes (caption)"),
      photos: z
        .array(z.number().int().min(1).max(10))
        .max(10)
        .optional()
        .describe("Carrousel ou post photo : seulement les textes de ces photos (1 = la première). Pour un style différent par photo (ex. une couleur de fond par photo), appelle style_texts une fois par photo ; le rendu ne part qu'une fois"),
      look_name: z.string().max(40).optional().describe("Un style enregistré du studio comme point de départ"),
      look: lookPatchSchema.optional().describe("Seulement ce qui change, ex. { color: \"#FFD400\", stroke: { color: \"#000000\", width: 4 } }"),
      reset: z.boolean().default(false).describe("Revenir au style du gabarit"),
      save_as: z.string().min(1).max(40).optional().describe("Enregistrer le style obtenu sous ce nom"),
    }),
  },
  schedule_post: {
    description:
      "Programme une publication validée sur Instagram, à son horaire (scheduled_at) ou à l'horaire donné ; si l'horaire est passé ou absent, elle part tout de suite. Il faut un compte Instagram connecté (sinon envoie le lien get_connect_link) et le contenu du format : un Reel a besoin de sa vidéo montée ; un post d'une photo (media_ids) ; un carrousel de 2 à 10 photos ou vidéos (media_ids, dans l'ordre) ; une story de sa vidéo montée ou d'une photo/vidéo (pas de légende sur une story). Ne programme jamais sans l'accord explicite de la gérante.",
    input: z.object({ post_id: z.string().uuid(), scheduled_at: isoDateTime.optional() }),
  },
  get_instagram_activity: {
    description:
      "Lit le compte Instagram connecté du studio : derniers posts (y compris ceux publiés sans Brigitte) avec likes, nombre de commentaires, statistiques (vues, portée, enregistrements, partages) et les commentaires récents avec leurs réponses. Sert à analyser ce qui marche, repérer les questions sans réponse et préparer des réponses ou le bilan.",
    input: z.object({
      media_limit: z.number().int().min(1).max(20).default(6),
      comments_per_post: z.number().int().min(0).max(30).default(8),
    }),
  },
  analyze_performance: {
    description:
      "« Ce qui marche » : compare les derniers posts Instagram du studio (chiffres, formats, heures, légendes, recette des Reels de Brigitte) et en tire 2 à 5 leçons avec leurs preuves, plus des idées pour la semaine. Gratuit. Renvoie le dernier bilan s'il a moins de 3 jours, sauf refresh. Les leçons guident aussi les prochains montages.",
    input: z.object({ refresh: z.boolean().default(false).describe("true pour refaire l'analyse même si le dernier bilan est récent") }),
  },
  reply_to_comment: {
    description:
      "Publie une réponse publique sous un commentaire Instagram, au nom du studio. Uniquement après que la gérante a validé le texte exact (montre-lui d'abord ta proposition).",
    input: z.object({
      comment_id: z.string().min(1),
      message: z.string().min(1).max(1000),
    }),
  },
  get_metrics: {
    description:
      "Statistiques mesurées des publications faites par Brigitte (dernière mesure par publication) entre deux dates : vues, portée, likes, enregistrements, partages, commentaires, visites du profil.",
    input: z.object({ from: isoDateTime, to: isoDateTime }),
  },
  update_brand_profile: {
    description:
      "Enregistre une nouvelle version du profil de style du studio (à partir d'exemples ou d'une correction de la gérante).",
    input: z.object({ profile: brandProfileSchema }),
  },
  restyle_reel: {
    description:
      "Sous son premier Reel, la gérante a les boutons « Ça me ressemble », « Plus chaleureux », « Plus sobre », « Plus pêchu », « Autre chose ». Quand elle répond « Plus chaleureux / sobre / pêchu » (ou le dit avec ses mots), appelle restyle_reel avec ce style ; pour « Autre chose », demande-lui d'abord en une question ce qu'elle changerait, puis appelle restyle_reel avec style « custom » et wish (sa demande, avec ses mots, courte). Dans tous les cas, l'ajustement est gardé dans sa direction artistique pour tous les prochains montages, et une version corrigée de ce Reel part aussitôt (son clic vaut accord : pas de devis à présenter). Le coût est celui d'une correction, débité à la livraison. Annonce-le en une phrase, avec le coût.",
    input: z.object({
      post_id: z.uuid(),
      style: z.enum([...RESTYLES, "custom"]),
      wish: z.string().trim().min(3).max(200).optional().describe("Avec style custom : ce qu'elle veut changer, avec ses mots"),
    }),
  },
  add_to_moodboard: {
    description:
      "Ajoute à son moodboard (Style) des images qu'elle t'a envoyées (posts qu'elle aime, ambiances, couleurs), puis Brigitte relit tout le moodboard : la lecture guide ensuite les montages et les composants. Gratuit pendant l'onboarding, 1 crédit ensuite.",
    input: z.object({ media_ids: z.array(z.string().uuid()).min(1).max(12) }),
  },
  set_logo: {
    description:
      "Enregistre comme logo du studio une image qu'elle t'a envoyée (son logo, de préférence sur fond transparent). Il apparaît en fin de Reel et sur les photos où on le pose. Gratuit.",
    input: z.object({ media_id: z.uuid() }),
  },
  reply_with: {
    description:
      "Ajoute à ta réponse des boutons et des cartes, affichés sous ton message (dans l'app ; sur WhatsApp, les boutons deviennent des boutons WhatsApp). options : les réponses possibles quand tu poses une question fermée (« Oui, lance » / « Non », un choix d'horaire, de format…), 2 à 6, courtes. posts : les publications dont tu parles, montrées en carte avec leur aperçu (vidéo, photo), format, date et statut. grid : true pour montrer la grille Instagram avec les publications à venir. upload : une zone de dépôt (video, photo ou any) quand tu demandes des fichiers dans l'application. pick_media (video, photo ou any) : sa médiathèque en vignettes à cocher, avec aussi l'ajout de nouveaux fichiers ; sa réponse revient avec les media_id choisis. step_card (onboarding, dans l'app) : la carte de l'étape en cours (website : champ pour son site ; style : sa charte trouvée et son moodboard ; rhythm : son rythme ; connect : le bouton Instagram ; first_post : créer sa première publication). Aucun de ces trois n'apparaît sur WhatsApp. Appelle-le au plus une fois par réponse, avec ton message.",
    input: replyExtrasSchema.omit({ quote: true }),
  },
  react_to_message: {
    description:
      "Réagit au dernier message de la gérante avec un emoji. Par défaut pour les accusés de réception : 👍 reçu, 🔥 super contenu, ✅ publié ; les autres (😊 ❤️ 😂 🙏 🎉 👀) quand le moment s'y prête ou quand elle te le demande. Jamais à la place d'une réponse à une question.",
    input: z.object({ emoji: reactionSchema }),
  },
} as const;

export type ToolName = keyof typeof toolSpecs;
export type ToolInput<N extends ToolName> = z.infer<(typeof toolSpecs)[N]["input"]>;
export type ToolHandlers = { [N in ToolName]: (input: ToolInput<N>) => Promise<string> };
