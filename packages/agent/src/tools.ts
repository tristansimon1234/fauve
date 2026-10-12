import { z } from "zod";
import {
  brandProfileSchema,
  editPlanSchema,
  platformSchema,
  postKindSchema,
  postStatusSchema,
  reactionSchema,
} from "./schemas.ts";

// Tool contracts shared by every runtime (webhook, web chat, jobs).
// Implementations live next to the database code in apps/web.

const isoDateTime = z.string().describe("Date et heure ISO 8601 avec fuseau, ex. 2026-10-15T18:00:00+02:00");

export const toolSpecs = {
  get_studio_context: {
    description:
      "Lit le contexte du studio : nom, étape d'onboarding, rythme, plateformes, comptes connectés, profil de style. À appeler au début d'une conversation si tu ne l'as pas déjà.",
    input: z.object({}),
  },
  update_onboarding: {
    description:
      "Enregistre une information d'onboarding (nom du studio, prénom de la gérante, site web, lien de réservation, rythme de publication, plateformes) et fait avancer l'étape.",
    input: z.object({
      studio_name: z.string().min(1).max(80).optional(),
      first_name: z.string().min(1).max(40).optional(),
      posts_per_week: z.number().int().min(0).max(21).optional(),
      stories_per_week: z.number().int().min(0).max(50).optional(),
      platforms: z.array(platformSchema).min(1).optional(),
      website_url: z.url().optional().describe("Site web du studio"),
      booking_url: z.url().optional().describe("Lien de réservation (bsport, Momoyoga…), utilisé dans la bio et les stories"),
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
    }),
  },
  request_content: {
    description:
      "Ajoute un élément à la liste « À filmer » et passe la publication liée en « content_requested ».",
    input: z.object({
      post_id: z.string().uuid().optional(),
      label: z.string().min(1).max(120).describe("Quoi filmer, ex. « Les mains sur la barre, en gros plan »"),
      hint: z.string().max(160).optional().describe("Angle, lumière, durée"),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  },
  analyze_clips: {
    description:
      "Regarde les vidéos reçues (analyse Gemini) : plans horodatés, sujet, énergie, potentiel d'accroche, qualité, visages, meilleurs passages, paroles. À appeler avant tout plan de montage, avec les media_id indiqués dans la conversation. Peut prendre jusqu'à une minute par vidéo.",
    input: z.object({ media_ids: z.array(z.string().uuid()).min(1).max(10) }),
  },
  montage: {
    description:
      "Lance le montage complet d'une publication, en tâche de fond : ton monteur regarde les clips, choisit le gabarit (doux, dynamique, chic), écrit les textes, crée des scènes de motion design sur mesure si utile, puis la vidéo est rendue et envoyée automatiquement à la gérante avec la légende (2 à 4 minutes). Sans media_ids et sans plan précédent, il fait une vidéo entièrement en motion design (planning, offre, annonce…). Pour une correction (« plus doux », « enlève le texte », « change la police », « plus de motion design »), rappelle montage avec la demande dans brief : il part du montage précédent.",
    input: z.object({
      post_id: z.string().uuid(),
      media_ids: z.array(z.string().uuid()).max(10).optional().describe("Clips à monter (media_id). Facultatif pour une correction ou une vidéo 100 % motion design."),
      brief: z.string().max(600).optional().describe("Intention ou correction, avec les textes exacts si besoin. Ex. « ouverture en motion design avec RENTRÉE en grand », « police Montserrat », « visages OK »"),
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
  schedule_post: {
    description:
      "Programme une publication validée sur Instagram, à son horaire (scheduled_at) ou à l'horaire donné ; si l'horaire est passé ou absent, elle part tout de suite. Nécessite une vidéo montée (render) et un compte Instagram connecté (sinon envoie le lien get_connect_link). Ne programme jamais sans l'accord explicite de la gérante.",
    input: z.object({ post_id: z.string().uuid(), scheduled_at: isoDateTime.optional() }),
  },
  get_instagram_activity: {
    description:
      "Lit le compte Instagram connecté du studio : derniers posts (y compris ceux publiés sans Fauve) avec likes, nombre de commentaires, statistiques (vues, portée, enregistrements, partages) et les commentaires récents avec leurs réponses. Sert à analyser ce qui marche, repérer les questions sans réponse et préparer des réponses ou le bilan.",
    input: z.object({
      media_limit: z.number().int().min(1).max(20).default(8),
      comments_per_post: z.number().int().min(0).max(30).default(15),
    }),
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
  react_to_message: {
    description:
      "Réagit au dernier message de la gérante avec un emoji. Seulement pour les accusés de réception simples : 👍 reçu, 🔥 super contenu, ✅ publié. Jamais à la place d'une réponse à une question.",
    input: z.object({ emoji: reactionSchema }),
  },
} as const;

export type ToolName = keyof typeof toolSpecs;
export type ToolInput<N extends ToolName> = z.infer<(typeof toolSpecs)[N]["input"]>;
export type ToolHandlers = { [N in ToolName]: (input: ToolInput<N>) => Promise<string> };
