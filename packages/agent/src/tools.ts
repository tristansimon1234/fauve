import { z } from "zod";
import { APP_GUIDE_TOPICS, type AppGuideTopic } from "./app-guide.ts";
import { RESTYLES } from "./restyle.ts";
import {
  brandProfileSchema,
  motionTemplateSchema,
  platformSchema,
  postKindSchema,
  postCoverSchema,
  postStatusSchema,
  montagePlanSchema,
  reactionSchema,
  replyExtrasSchema,
} from "./schemas.ts";
import { MAX_MONTAGE_FILES } from "./creation.ts";
import { effortSchema } from "./effort.ts";
import { brandSignatureSchema } from "./signature.ts";
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
  app_guide: {
    description:
      "Le mode d'emploi de l'application, par sujet : où se trouve chaque chose et comment faire (menus, boutons, étapes), les crédits et les offres. À lire avant de répondre à toute question sur l'app (« où je vois… », « comment je change… », « c'est combien… », « tu peux faire… ? »).",
    input: z.object({ topic: z.enum(APP_GUIDE_TOPICS as [AppGuideTopic, ...AppGuideTopic[]]) }),
  },
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
      "Donne à la gérante la page où elle connecte son compte Instagram professionnel et, si elle veut, son TikTok. À proposer quand un compte n'est pas connecté. Sur WhatsApp, un bouton « Relier mes comptes » s'affiche sous ton message : n'écris aucun lien ; dans l'application, il renvoie le lien à écrire.",
    input: z.object({}),
  },
  get_post_link: {
    description:
      "Donne à la gérante la page mobile d'une publication : elle y regarde la vidéo, lit la légende, valide, ou déplace et corrige un texte du doigt. Quand elle veut revoir ou modifier une publication (« renvoie-moi le lien », « je veux voir le rendu »). Sur WhatsApp, un bouton « Voir la publication » s'affiche sous ton message ; dans l'application, sa carte. N'écris jamais de lien.",
    input: z.object({ post_id: z.string().uuid() }),
  },
  remember: {
    description:
      "Garde dans ta mémoire du commerce (valable dans toutes les conversations et lue par tous ceux qui écrivent ses posts) des infos durables : activité précise, offre, prestations, prix, horaires, adresse, équipe, public, temps forts, goûts de la gérante pour ses posts. Une phrase précise par info. Jamais une demande pour une seule publication (son idée, sa fin, sa démo, son texte) : elle va dans le brief de cette publication, sinon elle reviendrait dans toutes les autres. avoid : ce qu'elle ne veut pas voir ou entendre dans ses posts (une phrase, un mot, un ton, un genre d'image). remove : les numéros d'infos de la Mémoire du contexte devenues fausses ou qu'elle veut oublier.",
    input: z.object({
      add: z.array(z.string().min(3).max(240)).max(8).optional(),
      avoid: z.array(z.string().min(3).max(240)).max(4).optional(),
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
      "Les inspirations de la gérante : des Reels qu'elle aime, partagés sur Instagram ou ajoutés dans l'app, avec ce qu'on peut en reprendre (accroche, rythme, textes). Source « model » : un de ses Reels qu'elle a gardé comme modèle (« Garder comme modèle ») : quand elle veut un Reel « comme celui de … », passe son inspiration_id à montage. À regarder avant de proposer un nouveau Reel, pour lui demander s'il doit suivre l'une d'elles.",
    input: z.object({}),
  },
  steal_style: {
    description:
      "Recopie la DA d'un Reel qu'elle aime pour UN Reel à elle, le prochain (« fais comme ça », « je veux ce style », un lien de Reel, de TikTok ou de Short, ou une vidéo qu'elle t'envoie comme exemple) : rend son inspiration_id tout de suite, puis après ta réponse Simone le regarde (une minute), en mesure le rythme, lit sa forme, ses textes, sa lumière, son mouvement et sa musique, et lui envoie en trois lignes ce que son Reel en reprend. Le Reel qui le recopie : montage avec cet inspiration_id (le monteur attend la lecture) ; ses Reels suivants restent sur sa charte. Jamais ses images, ses mots ni sa musique : ses images restent les siennes, et ses couleurs et ses polices aussi, sauf quand celles du Reel recopié font son style. Un carrousel : demande une capture de la photo qui lui plaît, puis copy_text_style sur la publication.",
    input: z.object({
      link: z.string().url().max(500).optional().describe("Le lien du Reel, du TikTok ou du Short, tel qu'elle l'a envoyé"),
      media_id: z.string().uuid().optional().describe("Une vidéo qu'elle a envoyée comme exemple, le Reel d'un autre compte : elle sort de sa médiathèque une fois regardée, jamais un de ses plans"),
      inspiration_id: z.string().uuid().optional().describe("Une de ses inspirations (list_inspirations)"),
    }),
  },
  list_media: {
    description:
      "La médiathèque du studio : les photos et vidéos déjà reçues (WhatsApp, app, médiathèque), les plus récentes d'abord, avec leur media_id, leur date, leur format et ce qu'on y voit quand c'est connu. À regarder dès que la gérante parle de photos ou de vidéos déjà envoyées (« celles de ce matin », « regarde dans la médiathèque », « les 4 photos que j'ai prises ») : ne lui demande jamais de les renvoyer. Avant de lui demander de filmer pour un Reel, regarde sa banque de plans (bank: true).",
    input: z.object({
      kind: z.enum(["image", "video", "all"]).default("all").describe("image pour les photos, video pour les vidéos"),
      days: z.number().int().min(1).max(90).default(14).describe("Jusqu'à combien de jours en arrière"),
      limit: z.number().int().min(1).max(30).default(20),
      bank: z
        .boolean()
        .default(false)
        .describe("true : seulement sa banque de plans (ses bonnes vidéos gardées jusqu'à 6 mois, nettes et vivantes), sans limite de date"),
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
      platforms: z.array(platformSchema).min(1).optional().describe("Par défaut Instagram, plus TikTok pour un Reel si TikTok est connecté"),
      theme: z.string().max(60).optional(),
      media_ids: postMediaIds,
    }),
  },
  update_post: {
    description:
      "Met à jour une publication : légende, hashtags, horaire, plateformes, statut, vignette. Les changements de statut suivent la machine à états (rien n'est programmé sans validation de la gérante).",
    input: z.object({
      post_id: z.string().uuid(),
      caption: z.string().max(2200).optional(),
      hashtags: z.array(z.string().regex(/^[^#\s]+$/)).max(5).optional().describe("Sans le #, 5 au plus (limite d'Instagram, hashtags de la légende compris)"),
      scheduled_at: isoDateTime.optional(),
      platforms: z.array(platformSchema).min(1).optional().describe("instagram, tiktok (vidéos seulement) ou les deux"),
      status: postStatusSchema.optional(),
      agent_note: z.string().max(600).optional().describe("Explication de tes choix, affichée dans la web app"),
      media_ids: postMediaIds,
      cover: postCoverSchema.nullable().optional().describe("Vignette d'un Reel (grille, Instagram) : { at: secondes } une image de la vidéo, ou { media_id } une photo ; null la laisse par défaut"),
      voice_media_id: z
        .string()
        .uuid()
        .nullable()
        .optional()
        .describe("Reel : le media_id du message vocal de la gérante à poser sur le Reel (sa voix, sous-titres mot à mot, coupes sur ses phrases, musique baissée dessous) ; null retire sa voix. Prend effet au prochain montage ou à la prochaine correction (montage)"),
      publish_by_hand: z.boolean().optional().describe("Reel : true = à l'heure prévue, elle reçoit la vidéo et la légende sur WhatsApp et publie elle-même dans Instagram (pour mettre la musique de son choix). Story : true = elle reçoit la story et son lien de réservation sur WhatsApp et la partage elle-même en story avec le sticker Lien (aucune appli ne peut poser de sticker). Je retrouve ensuite la publication sur son compte"),
    }),
  },
  analyze_clips: {
    description:
      "Regarde les vidéos reçues (analyse Gemini) : plans horodatés, sujet, énergie, potentiel d'accroche, qualité, visages, meilleurs passages, paroles. À appeler avant tout plan de montage, avec les media_id indiqués dans la conversation. Peut prendre jusqu'à une minute par vidéo.",
    input: z.object({ media_ids: z.array(z.string().uuid()).min(1).max(MAX_MONTAGE_FILES) }),
  },
  montage: {
    description:
      "Lance un montage ou une correction, tout de suite, dès qu'elle le demande en disant ce qu'elle imagine (ou avec une ref), ou qu'elle a répondu à ta question (pas de devis : les crédits sont débités à la livraison pour ce qui a vraiment été fait, et le message de livraison dit combien). En tâche de fond : ton monteur regarde les clips, choisit le rythme et la forme, écrit les textes, réutilise ou crée des scènes animées, puis la vidéo est rendue ; en Soigné et en Max, Simone la regarde et la fait corriger avant de l'envoyer (Rapide 5 à 20 min, Soigné 10 à 30, Max 15 à 40 ; le haut de la fourchette pour un Reel en motion design ou en écran partagé). Une vidéo sans media_ids est entièrement en motion design ; une correction (« plus calme », « plus rythmé », « en collage », « enlève le texte », « change la police ») part du montage précédent. Si le solde ne suffit pas, rien ne part : la réponse le dit.",
    input: z.object({
      post_id: z.string().uuid(),
      media_ids: z.array(z.string().uuid()).max(MAX_MONTAGE_FILES).optional().describe("Clips et photos à monter (media_id), 20 au plus. Facultatif pour une correction ou une vidéo 100 % motion design."),
      brief: z.string().max(1500).optional().describe("Intention ou correction, avec tout ce qu'elle a fixé, dans ses mots : son texte exact entre « » (pour la voix ou l'écran, sans le réécrire ; seulement les mots qu'elle a écrits : quand elle n'en écrit que le début et décrit la suite, son début entre « » puis « et la voix continue : … » ; jamais un texte de ta main entre « », décris plutôt ce que la voix doit dire), la personne (« je »), la mise en page, la durée, la voix, la fin, l'invitation ou son absence. Pour une correction, redis aussi ce qu'elle avait fixé avant et qui tient toujours. Ex. « ouverture en motion design avec RENTRÉE en grand », « police Montserrat », « visages OK »"),
      correction: z.boolean().default(false).describe("true pour modifier le montage existant de cette publication"),
      plan: montagePlanSchema.optional().describe("Facultatif : ce qu'elle a demandé de précis (durée, style, scènes, textes exacts des animations) ; sinon le monteur décide"),
      inspiration_id: z
        .string()
        .uuid()
        .optional()
        .describe("Le Reel qu'elle t'a envoyé à recopier pour celui-ci (steal_style, ou la ligne « Reel à recopier » du contexte), ou l'inspiration qu'elle a choisie (list_inspirations) : le monteur le suit en priorité. Inutile si elle l'a déjà choisie en créant la publication."),
      max_new_scenes: z.number().int().min(0).max(8).optional().describe("Nouvelles animations sur mesure permises (3 crédits chacune, débitées seulement si elles sont créées). Par défaut : autant que d'animations dans le plan (au moins 2 pour le tout premier Reel) ; sans plan, 1 pour un nouveau montage et 0 pour une correction. 0 si elle veut économiser (le monteur réutilise sa bibliothèque)."),
      effort: effortSchema
        .optional()
        .describe(
          "Niveau de soin : rapide (une version, sans relecture), soigne (Simone regarde la vidéo rendue et la fait corriger si besoin), max (deux versions, Simone garde la meilleure et la peaufine). Par défaut celui du studio (contexte). rapide si elle est pressée ou pour un essai ; max pour un post important (lancement, offre, temps fort) ou si elle le demande.",
        ),
      variant: z
        .object({
          hook: z.string().min(2).max(80).describe("Nouvelle accroche, courte et différente de l'actuelle"),
        })
        .optional()
        .describe("Variante du montage livré (1 crédit, sans nouveau montage) : même découpage et même rythme, une autre accroche. Pour un autre rythme ou le collage : une correction"),
    }),
  },
  montage_status: {
    description:
      "Où en sont les montages lancés ces 3 dernières heures (ou celui d'une publication) : en montage (le monteur écrit le plan), 2e version (Max), en rendu, en relecture (tu regardes la vidéo), en correction, ou livré, et depuis combien de minutes. Un montage prend 5 à 25 minutes selon son niveau et ce qu'il demande ; tant qu'il n'est pas « late », il tourne. « late » : il s'est arrêté.",
    input: z.object({ post_id: z.string().uuid().optional() }),
  },
  choose_version: {
    description:
      "Remet une version précédente du montage d'une publication (par ex. la gérante préfère l'original à la variante). Gratuit. Les versions sont numérotées dans l'ordre (la plus récente est la dernière).",
    input: z.object({ post_id: z.string().uuid(), version: z.number().int().min(1) }),
  },
  render: {
    description:
      "Refait seulement le rendu vidéo de la dernière version du plan (sans le modifier), puis l'envoie à la gérante. Normalement inutile : montage fait déjà tout.",
    input: z.object({ post_id: z.string().uuid() }),
  },
  design_carousel: {
    description:
      "Compose tout un carrousel, ou un post d'une seule image, comme un graphiste : avec ses photos (media_ids dans l'ordre ; ses sujets détourés quand la découpe est nette), sa charte et ses mots : une couverture qui arrête le pouce, une idée par diapositive, des diapositives de texte, des photos qui passent d'une diapositive à l'autre, un appel concret à la fin. Simone le compose, en fait un rendu d'essai, le relit et le corrige une fois (3 à 6 minutes), puis le lien part tout seul. 9 crédits, débités une fois livré. C'est la façon de faire un carrousel : dès qu'elle en demande un, ou pour ses photos sans demande précise (propose-le en une phrase). Sur un carrousel déjà composé, une demande de changement (« la 3e plus aérée », « une diapo de plus », « change l'ordre », « plus de place aux photos ») est une correction : request dit le changement. fresh : un tout nouveau carrousel à la place. Changer seulement des mots : carousel_texts (gratuit).",
    input: z.object({
      post_id: z.string().uuid(),
      request: z
        .string()
        .min(1)
        .max(2000)
        .describe("Ce qu'elle veut dire et montrer, avec ses mots exacts quand elle en a donné (offre, prix, dates, adresse), et ce qu'elle a dit du style ; pour une correction, le changement demandé"),
      media_ids: z.array(z.string().uuid()).max(10).optional().describe("Ses photos, dans l'ordre ; par défaut celles de la publication"),
      example_media_ids: z
        .array(z.string().uuid())
        .max(4)
        .optional()
        .describe("Un carrousel qu'elle aime (« fais comme ça ») : ses captures, ou la vidéo où elle le fait défiler (enregistrement d'écran) ; Simone suit sa forme, sa typographie et son rythme, jamais ses mots ni ses images"),
      fresh: z.boolean().default(false).describe("true : un nouveau carrousel, pas une correction de celui qu'elle a"),
    }),
  },
  carousel_texts: {
    description:
      "Change des mots d'un carrousel composé (design_carousel), gratuit : slot par slot, avec leurs noms (read_post les montre diapositive par diapositive). La mise en page ne bouge pas ; le rendu part après ta réponse et le lien est envoyé tout seul. Un texte beaucoup plus long que l'ancien rétrécit : pour plus de place, une correction (design_carousel).",
    input: z.object({
      post_id: z.string().uuid(),
      texts: z.array(z.object({ slot: z.string().max(24), text: z.string().max(400) })).min(1).max(40),
    }),
  },
  effect_words: {
    description:
      "Change les mots écrits sur un Reel de l'atelier d'effets, gratuit : texte par texte, avec leurs id (read_post les montre dans mots_de_l_effet, avec leur place et leur longueur maximale). L'effet ne bouge pas : son propre script le redessine avec ces mots (2 à 5 min), puis la vidéo est livrée toute seule. Tout autre changement de l'effet : montage (une correction).",
    input: z.object({
      post_id: z.string().uuid(),
      words: z
        .array(z.object({ id: z.string().max(40), text: z.string().max(400) }))
        .min(1)
        .max(12),
    }),
  },
  write_on_photos: {
    description:
      "Écrit du texte par-dessus les photos d'un carrousel ou d'un post photo, à la charte du studio (mêmes polices et styles que les montages). Rendu en images en une minute environ, gratuit ; le lien vers le résultat est envoyé automatiquement à la gérante quand c'est prêt. Une entrée par photo, dans l'ordre des photos de la publication (texts vide = photo sans texte). Court et lisible : une accroche sur la 1re photo (hook), puis un message par photo (band ou caption), 6 textes au plus par photo. Une liste (checklist, planning, étapes, tarifs) est un seul texte avec items (titre + détail facultatif par élément). Pour refaire la mise en page d'un exemple copié (copy_text_style), reprends un texte par bloc avec son look_name. Remplace le texte déjà posé ; la gérante peut ensuite déplacer ou corriger chaque texte elle-même.",
    input: z.object({
      post_id: z.string().uuid(),
      template: motionTemplateSchema.optional().describe("Style des textes : doux (textes légers), dynamique (gros titres) ou chic (italique élégant) ; par défaut celui déjà choisi, sinon doux"),
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
  retouch_photos: {
    description:
      "Retouche et/ou floute les photos d'un carrousel ou d'un post photo, gratuit. Simone regarde chaque photo (visages, plaques, écrans, lumière, horizon, sujet) : light = retouche légère et naturelle (lumière, contraste, couleurs, horizon redressé, recadrage qui garde le sujet) ; blur = les zones à flouter (face : visages, plate : plaques, screen : écrans, document : papiers). L'original n'est jamais modifié ; light false et blur vide retirent la retouche. Le rendu part après ta réponse et le lien est envoyé tout seul.",
    input: z.object({
      post_id: z.string().uuid(),
      photos: z.array(z.number().int().min(1).max(10)).max(10).optional().describe("Numéros des photos (à partir de 1) ; par défaut toutes"),
      light: z.boolean().default(true),
      blur: z.array(z.enum(["face", "plate", "screen", "document", "other"])).default([]),
      only_recognizable: z.boolean().default(false).describe("Ne flouter que les visages reconnaissables (pas les silhouettes de dos ou floues)"),
    }),
  },
  make_image: {
    description:
      "Images par IA, 1 crédit l'image, faites après ta réponse et envoyées toutes seules. improve : améliore une vraie photo (media_id) sans changer ce qu'elle montre : agrandir au format sans couper, fond plus net, plus lumineuse, retirer un objet (instruction). ambiance : 1 à 4 images d'ambiance génériques (fond, texture, détail, objet, nature morte) pour porter un texte quand elle n'a pas de photo ; jamais son lieu, ses produits, ses réalisations ni des personnes. La nouvelle image va dans sa médiathèque (l'original est gardé) ; avec post_id, elle remplace la photo améliorée ou s'ajoute aux photos.",
    input: z.object({
      mode: z.enum(["improve", "ambiance"]),
      media_id: z.uuid().optional().describe("improve : la photo à améliorer"),
      instruction: z.string().trim().min(3).max(400).describe("improve : ce qu'il faut changer ; ambiance : ce qu'on voit (sujet, matières, lumière)"),
      format: z.enum(["4:5", "1:1", "9:16"]).default("4:5").describe("4:5 carrousel ou post, 9:16 story ou Reel"),
      count: z.number().int().min(1).max(4).default(1).describe("ambiance : combien d'images"),
      post_id: z.uuid().optional(),
    }),
  },
  blur_video: {
    description:
      "Floute des zones sur toutes les vidéos du montage d'une publication (par défaut les visages), en les suivant dans le temps, gratuit. Pour les personnes filmées sans leur accord. what vide retire le flou. Refait le rendu après ta réponse (3 à 8 minutes) ; le lien est envoyé tout seul.",
    input: z.object({
      post_id: z.string().uuid(),
      what: z.array(z.enum(["face", "plate", "screen", "document", "other"])).default(["face"]),
    }),
  },
  copy_text_style: {
    description:
      "Copie le style des textes d'un exemple que la gérante a envoyé (une photo ou une capture d'un post qu'elle aime) : Simone lit chaque texte de l'image (police la plus proche, graisse, couleurs, fond en bloc, pilule ou surlignage, contour, ombre, inclinaison, place) et l'enregistre dans les styles de texte du studio. Avec post_id, l'applique aussitôt aux textes de cette publication (texte sur photos ou montage) et refait le rendu, gratuit ; le lien part tout seul. Renvoie les styles lus avec leur nom.",
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
  set_music: {
    description:
      "Musique d'un Reel, composée par Simone pour ce montage (ElevenLabs, calée sur les images, libre de droits, sans voix) : on (par défaut), off (Reel muet, par ex. pour mettre un son d'Instagram en publiant elle-même), another (une nouvelle musique). Refait la vidéo, gratuit.",
    input: z.object({ post_id: z.string().uuid(), mode: z.enum(["on", "off", "another"]) }),
  },
  set_voice: {
    description:
      "Voix off de Simone sur les Reels (une vraie voix française qui raconte les images, texte écrit par toi, posée avant le montage, la musique passe dessous) : voix Eva, Victoria, Lucie, Koraly (chuchotée, ASMR) pour les femmes, Neto, Antonin, Jules, Mister K (chuchotée, ASMR) pour les hommes ; une voix chuchotée seulement si elle la veut (spa, massage, soin, un moment très calme). Avec post_id, pour ce Reel : mode on (en mettre une), off (sans voix, ni la sienne), redo (refaire le texte, avec wish : ce qu'elle veut qu'on dise) ; voice pour changer de voix. Sans post_id : le réglage du commerce pour ses prochains Reels (use : auto = quand ça raconte quelque chose et que personne ne parle déjà dans ses vidéos, always, never ; voice). Gratuit. off sur un Reel monté refait la vidéo tout de suite ; on, redo et voice valent pour le prochain montage du Reel : sur un Reel déjà monté, propose de le refaire (montage avec correction).",
    input: z.object({
      post_id: z.string().uuid().optional(),
      mode: z.enum(["on", "off", "redo"]).optional(),
      wish: z.string().max(300).optional().describe("redo : ce que la voix doit dire ou comment (« parle de la promo », « plus drôle »)"),
      voice: z.string().max(40).optional().describe("Le prénom d'une voix (Eva, Victoria, Lucie, Koraly, Neto, Antonin, Jules, Mister K)"),
      use: z.enum(["auto", "always", "never"]).optional().describe("Sans post_id : quand mettre une voix sur ses Reels"),
    }),
  },
  schedule_post: {
    description:
      "Publie maintenant une publication validée sur ses plateformes (Instagram, TikTok). Rien ne part tout seul à une heure prévue : l'horaire d'une publication (update_post scheduled_at) est le moment où tu lui fais signe pour la poster (un rappel sur WhatsApp avec « Oui, publie-le »). Il faut chaque compte connecté (sinon envoie le lien get_connect_link) et le contenu du format : un Reel a besoin de sa vidéo montée ; un post d'une photo (media_ids) ; un carrousel de 2 à 10 photos ou vidéos (media_ids, dans l'ordre) ; une story de sa vidéo montée ou d'une photo/vidéo (pas de légende sur une story). Ne publie jamais sans l'accord explicite de la gérante.",
    input: z.object({ post_id: z.string().uuid() }),
  },
  get_instagram_activity: {
    description:
      "Lit le compte Instagram connecté du studio : derniers posts (y compris ceux publiés sans Simone) avec likes, nombre de commentaires, statistiques (vues, portée, enregistrements, partages) et les commentaires récents avec leurs réponses. Sert à analyser ce qui marche, repérer les questions sans réponse et préparer des réponses ou le bilan.",
    input: z.object({
      media_limit: z.number().int().min(1).max(20).default(6),
      comments_per_post: z.number().int().min(0).max(30).default(8),
    }),
  },
  analyze_performance: {
    description:
      "« Ce qui marche » : compare les derniers posts Instagram du studio (chiffres, formats, heures, légendes, recette des Reels de Simone) et en tire 2 à 5 leçons avec leurs preuves, plus des idées pour la semaine. Gratuit. Renvoie le dernier bilan s'il a moins de 3 jours, sauf refresh. Les leçons guident aussi les prochains montages.",
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
      "Statistiques entre deux dates : celles des publications de Simone (dernière mesure par publication : vues, portée, likes, enregistrements, partages, commentaires, visites du profil) et celles du compte, semaine par semaine (nouveaux abonnés, désabonnements, solde, abonnés au total, vues, visites du profil, clics sur le lien ; Instagram et TikTok). À lire dès qu'on parle d'abonnés ou de croissance.",
    input: z.object({ from: isoDateTime, to: isoDateTime }),
  },
  update_brand_profile: {
    description:
      "Change le profil de style du studio (à partir d'exemples ou d'une correction de la gérante) : donne seulement ce qui change, le reste est gardé. « titles » règle ses titres à l'écran, pour tous ses prochains Reels : espacement des lettres (tracking : tight serré, normal, wide aéré), capitales ou non (case), graisse (weight), alignement (align) ; c'est son choix, jamais imposé.",
    input: brandProfileSchema
      .pick({ tone: true, caption_length: true, emojis: true, hashtags: true, visual_notes: true, colors: true, fonts: true, art_direction: true, dos: true, donts: true })
      .partial()
      .extend({ titles: brandSignatureSchema.shape.titles.partial().optional() }),
  },
  restyle_reel: {
    description:
      "Sous son premier Reel, la gérante a les boutons « Ça me ressemble », « Plus rapide », « Moins de texte », « Plus chaleureux », « Autre chose ». Quand elle répond « Plus rapide » (punchier), « Moins de texte » (sober) ou « Plus chaleureux » (warmer), ou le dit avec ses mots, appelle restyle_reel avec ce style ; pour « Autre chose », demande-lui d'abord en une question ce qu'elle changerait, puis appelle restyle_reel avec style « custom » et wish (sa demande, avec ses mots, courte). Dans tous les cas, l'ajustement est gardé dans sa direction artistique pour tous les prochains montages, et une version corrigée de ce Reel part aussitôt (son clic vaut accord : pas de devis à présenter). Le coût est celui d'une correction, débité à la livraison, qui le dit. Annonce en une phrase ce qui part.",
    input: z.object({
      post_id: z.uuid(),
      style: z.enum([...RESTYLES, "custom"]),
      wish: z.string().trim().min(3).max(200).optional().describe("Avec style custom : ce qu'elle veut changer, avec ses mots"),
    }),
  },
  add_to_moodboard: {
    description:
      "Ajoute à son moodboard (Style) des images qu'elle t'a envoyées (posts qu'elle aime, ambiances, couleurs), puis Simone relit tout le moodboard : la lecture guide ensuite les montages et les composants. Gratuit pendant l'onboarding, 1 crédit ensuite.",
    input: z.object({ media_ids: z.array(z.string().uuid()).min(1).max(12) }),
  },
  set_logo: {
    description:
      "Enregistre comme logo du studio une image qu'elle t'a envoyée (son logo, de préférence sur fond transparent). Il apparaît en fin de Reel et sur les photos où on le pose. Gratuit.",
    input: z.object({ media_id: z.uuid() }),
  },
  reply_with: {
    description:
      "Ajoute à ta réponse des boutons et des cartes, affichés sous ton message (dans l'app ; sur WhatsApp, les boutons deviennent des boutons WhatsApp). options : les réponses possibles quand tu poses une question fermée (« Oui, lance » / « Non », un choix d'horaire, de format…), 2 à 6, courtes. posts : les publications dont tu parles, montrées en carte avec leur aperçu (vidéo, photo), format, date et statut. grid : true pour montrer la grille Instagram avec les publications à venir. upload : une zone de dépôt (video, photo ou any) quand tu lui demandes des fichiers ; sur WhatsApp, elle devient son lien de dépôt en pleine qualité, ajouté sous ton message. pick_media (video, photo ou any) : sa médiathèque en vignettes à cocher, avec aussi l'ajout de nouveaux fichiers ; sa réponse revient avec les media_id choisis. step_card (onboarding, dans l'app) : la carte de l'étape en cours (website : champ pour son site ; style : sa charte trouvée et son moodboard ; rhythm : son rythme ; connect : le bouton Instagram ; first_post : créer sa première publication). Ni pick_media ni step_card n'apparaissent sur WhatsApp. Appelle-le au plus une fois par réponse, avec ton message.",
    input: replyExtrasSchema.omit({ quote: true, link: true }),
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
