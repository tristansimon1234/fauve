import { z } from "zod";
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
      step: z.enum(["studio_name", "rhythm", "examples", "connect", "done"]).optional(),
    }),
  },
  read_website: {
    description:
      "Lit une page web publique (le site du studio, ou une page précise comme les tarifs) : titre, description, texte, liens Instagram / TikTok, lien de réservation, pages du site, logo, couleurs dominantes et polices. À utiliser dès que la gérante donne son site, pour pré-remplir l'onboarding et le profil de style au lieu de reposer des questions.",
    input: z.object({ url: z.string().min(4).max(500).describe("Adresse de la page, avec ou sans https://") }),
  },
  get_connect_link: {
    description:
      "Renvoie le lien sécurisé (valable 15 min) vers la page où la gérante connecte son compte Instagram professionnel à Fauve (TikTok arrive bientôt). À envoyer quand Instagram n'est pas connecté.",
    input: z.object({}),
  },
  get_post_link: {
    description:
      "Renvoie le lien sécurisé (valable 15 min, à usage unique) vers la page mobile d'une publication : la gérante y regarde la vidéo, lit la légende, valide, ou déplace et corrige un texte du doigt. À envoyer quand elle veut revoir ou modifier une publication depuis son téléphone (« renvoie-moi le lien », « je veux changer le texte »).",
    input: z.object({ post_id: z.string().uuid() }),
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
      "Prépare un montage ou une correction et son prix en crédits (obligatoire avant tout montage). Un petit montage (15 crédits au plus, le cas courant) part aussitôt, sans attendre d'accord : la réponse dit status started. Au-delà, c'est un devis à présenter. Pour un nouveau montage, donne toujours « plan » : la durée, le style et chaque scène dans l'ordre (vidéo, animation, fin) ; il s'affiche sur le devis, fixe le nombre de scènes animées facturables et guide le monteur. Renvoie le coût de base, le maximum si le monteur crée de nouvelles scènes animées, et le solde. Décris ensuite le plan à la gérante (durée, nombre de scènes, ce qu'elles montrent) et le coût ; pour un devis (pas started), attends son accord : montage ne part qu'au tour suivant, avec ce quote_id. Une vidéo sans media_ids est entièrement en motion design ; une correction (« plus doux », « enlève le texte », « change la police ») part du montage précédent.",
    input: z.object({
      post_id: z.string().uuid(),
      media_ids: z.array(z.string().uuid()).max(10).optional().describe("Clips à monter (media_id). Facultatif pour une correction ou une vidéo 100 % motion design."),
      brief: z.string().max(600).optional().describe("Intention ou correction, avec les textes exacts si besoin. Ex. « ouverture en motion design avec RENTRÉE en grand », « police Montserrat », « visages OK »"),
      correction: z.boolean().default(false).describe("true pour modifier le montage existant de cette publication"),
      plan: montagePlanSchema.optional().describe("Le plan proposé (obligatoire pour un nouveau montage, facultatif pour une correction)"),
      max_new_scenes: z.number().int().min(0).max(2).optional().describe("Nouvelles scènes animées permises (3 crédits chacune). 0 si la gérante veut faire simple ou économiser : le monteur réutilise alors la bibliothèque et les scènes fixes."),
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
      "Où en sont les montages lancés ces 3 dernières heures (ou celui d'une publication) : en montage (le monteur écrit le plan), en rendu, ou livré, et depuis combien de minutes. Un montage prend 2 à 5 minutes ; « late » signifie qu'il a sans doute échoué.",
    input: z.object({ post_id: z.string().uuid().optional() }),
  },
  choose_version: {
    description:
      "Remet une version précédente du montage d'une publication (par ex. la gérante préfère l'original à la variante). Gratuit. Les versions sont numérotées dans l'ordre (la plus récente est la dernière).",
    input: z.object({ post_id: z.string().uuid(), version: z.number().int().min(1) }),
  },
  montage: {
    description:
      "Lance le montage (ou la correction) devisé par quote_montage, une fois que la gérante a dit oui. En tâche de fond : ton monteur regarde les clips, choisit le gabarit, écrit les textes, réutilise ou crée des scènes animées, puis la vidéo est rendue et envoyée automatiquement avec la légende (2 à 4 minutes). Les crédits sont débités à la livraison, jamais plus que le devis.",
    input: z.object({ quote_id: z.string().uuid() }),
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
  list_text_layers: {
    description:
      "La bibliothèque des calques de texte pour les photos (carrousel, post photo) : ceux de Fauve (house) et ceux déjà dessinés pour le studio, avec leurs slots (les textes à remplir). Réutiliser un calque est gratuit et immédiat : regarde-la avant d'en dessiner un nouveau.",
    input: z.object({}),
  },
  apply_text_layer: {
    description:
      "Pose un calque de la bibliothèque sur des photos d'un carrousel ou d'un post photo, avec les textes du commerce pour chaque slot (un slot multiline prend plusieurs lignes séparées par \n). Gratuit ; le rendu part après ta réponse et le lien est envoyé tout seul.",
    input: z.object({
      post_id: z.string().uuid(),
      layer_id: z.string().uuid(),
      photos: z
        .array(z.object({ photo: z.number().int().min(1).max(10).describe("Numéro de la photo, à partir de 1"), texts: z.array(z.object({ slot: z.string(), text: z.string().max(400) })) }))
        .min(1)
        .max(10),
    }),
  },
  design_text_layer: {
    description:
      "Fauve dessine un nouveau calque de texte pour les photos d'un carrousel ou d'un post photo, comme un graphiste : n'importe quelle mise en page (liste, cases, prix dans un rond, flèches, colonnes, tampon, texte en arc…), polices, couleurs, formes. Avec example_media_id, il refait la même chose que l'exemple envoyé par la gérante (une capture d'un post qu'elle aime), avec les mots du commerce. Testé et relu avant envoi ; prend 2 à 4 minutes et coûte 3 crédits, débités une fois les photos livrées ; le lien est envoyé tout seul. Le calque rejoint la bibliothèque et se réutilise ensuite gratuitement.",
    input: z.object({
      post_id: z.string().uuid(),
      request: z
        .string()
        .min(1)
        .max(4000)
        .describe("Ce qu'il faut écrire, photo par photo, avec les mots exacts du commerce (titre, éléments d'une liste, prix…), et ce que la gérante a dit du style"),
      example_media_id: z.string().uuid().optional().describe("media_id de l'image d'exemple à reproduire"),
      photos: z.array(z.number().int().min(1).max(10)).max(10).optional().describe("Photos à couvrir (à partir de 1) ; par défaut toutes"),
    }),
  },
  copy_text_style: {
    description:
      "Copie le style des textes d'un exemple que la gérante a envoyé (une photo ou une capture d'un post qu'elle aime) : Fauve lit chaque texte de l'image (police la plus proche, graisse, couleurs, fond en bloc, pilule ou surlignage, contour, ombre, inclinaison, place) et l'enregistre dans les styles de texte du studio. Avec post_id, l'applique aussitôt aux textes de cette publication (texte sur photos ou montage) et refait le rendu, gratuit ; le lien part tout seul. Renvoie les styles lus avec leur nom.",
    input: z.object({
      media_id: z.string().uuid().describe("media_id de l'image d'exemple reçue"),
      post_id: z.string().uuid().optional().describe("La publication à laquelle appliquer ce style"),
      note: z.string().max(300).optional().describe("Ce que la gérante a dit de l'exemple, ex. « le titre jaune »"),
      copy_places: z.boolean().default(true).describe("Reprendre aussi la place des textes de l'exemple"),
    }),
  },
  style_texts: {
    description:
      "Change le style des textes d'une publication (texte sur photos ou montage), gratuit, puis refait le rendu (le lien part tout seul). Tout est possible : police Google Fonts, graisse, italique, majuscules, taille, interlettrage, couleur, fond derrière (box : bloc, pill : pilule, line : surlignage ligne à ligne) avec couleur et transparence, contour, ombre (soft, strong, hard), mots en valeur (autre couleur, police, surlignage), inclinaison, apparition (fade, rise, pop, typewriter, slide), alignement. Prends un style enregistré (look_name), et/ou donne seulement ce qui change (look). reset remet le style du gabarit. save_as enregistre le résultat dans les styles du studio.",
    input: z.object({
      post_id: z.string().uuid(),
      target: z.enum(["all", "hook", "band", "caption"]).default("all").describe("Quels textes : tous, ou seulement l'accroche (hook), les bandeaux (band), les petites lignes (caption)"),
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
      "Lit le compte Instagram connecté du studio : derniers posts (y compris ceux publiés sans Fauve) avec likes, nombre de commentaires, statistiques (vues, portée, enregistrements, partages) et les commentaires récents avec leurs réponses. Sert à analyser ce qui marche, repérer les questions sans réponse et préparer des réponses ou le bilan.",
    input: z.object({
      media_limit: z.number().int().min(1).max(20).default(6),
      comments_per_post: z.number().int().min(0).max(30).default(8),
    }),
  },
  analyze_performance: {
    description:
      "« Ce qui marche » : compare les derniers posts Instagram du studio (chiffres, formats, heures, légendes, recette des Reels de Fauve) et en tire 2 à 5 leçons avec leurs preuves, plus des idées pour la semaine. Gratuit. Renvoie le dernier bilan s'il a moins de 3 jours, sauf refresh. Les leçons guident aussi les prochains montages.",
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
      "Statistiques mesurées des publications faites par Fauve (dernière mesure par publication) entre deux dates : vues, portée, likes, enregistrements, partages, commentaires, visites du profil.",
    input: z.object({ from: isoDateTime, to: isoDateTime }),
  },
  update_brand_profile: {
    description:
      "Enregistre une nouvelle version du profil de style du studio (à partir d'exemples ou d'une correction de la gérante).",
    input: z.object({ profile: brandProfileSchema }),
  },
  reply_with: {
    description:
      "Ajoute à ta réponse des boutons et des cartes, affichés sous ton message (dans l'app ; sur WhatsApp, les boutons deviennent des boutons WhatsApp). options : les réponses possibles quand tu poses une question fermée (« Oui, lance » / « Non », un choix d'horaire, de format…), 2 à 6, courtes. posts : les publications dont tu parles, montrées en carte avec leur aperçu (vidéo, photo), format, date et statut. grid : true pour montrer la grille Instagram avec les publications à venir. Appelle-le au plus une fois par réponse, avec ton message.",
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
