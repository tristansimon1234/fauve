import { z } from "zod";
import { adjustSchema, clipBlurSchema, photoEditSchema } from "./retouch.ts";
import { listFields, savedLookSchema, textLookSchema } from "./text-look.ts";

// Mirrors the Postgres enums in supabase/migrations.
export const postStatusSchema = z.enum([
  "planned",
  "content_requested",
  "media_received",
  "draft",
  "validated",
  "scheduled",
  "published",
  "measured",
  "skipped",
  "failed",
]);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const postKindSchema = z.enum(["reel", "post", "carousel", "story"]);

/** A Reel's cover, in the grid and on Instagram: a frame of the video (seconds) or a photo of the library. */
export const postCoverSchema = z.union([z.object({ at: z.number().min(0).max(180) }), z.object({ media_id: z.string().uuid() })]);
export type PostCover = z.infer<typeof postCoverSchema>;

/** The frame shown when none was chosen: past the first animation's empty start, on the hook. */
export const DEFAULT_COVER_SECONDS = 1.2;
export type PostKind = z.infer<typeof postKindSchema>;

export const platformSchema = z.enum(["instagram", "tiktok"]);
export type Platform = z.infer<typeof platformSchema>;

/** Fixed reaction vocabulary: 👍 received, 🔥 great content, ✅ published. */
/** Fauve's reactions: 👍 reçu, 🔥 super contenu, ✅ publié by default; the others when the moment (or the manager) asks for it. */
export const reactionSchema = z.enum(["👍", "🔥", "✅", "😊", "❤️", "😂", "🙏", "🎉", "👀"]);

/** Buttons and cards under one of Fauve's messages (reply_with). */
export const replyExtrasSchema = z.object({
  options: z.array(z.string().trim().min(1).max(24)).min(2).max(6).optional(),
  posts: z.array(z.uuid()).max(4).optional(),
  grid: z.boolean().optional(),
  /** A drop zone for photos or videos under the message (app only). */
  upload: z.enum(["video", "photo", "any"]).optional(),
  /** A picker of the studio's library under the message (app only): she ticks files, they come back as media_id. */
  pick_media: z.enum(["video", "photo", "any"]).optional(),
  /** The card of an onboarding step under the message (app only). */
  step_card: z.enum(["website", "style", "rhythm", "connect", "first_post"]).optional(),
  /** A quote to show as a card with a « Lancer » button (set by quote_montage, not by the model). */
  quote: z.uuid().optional(),
});
export type ReplyExtras = z.infer<typeof replyExtrasSchema>;
export type Reaction = z.infer<typeof reactionSchema>;

// ---------------------------------------------------------------------------
// Edit plan: Claude decides, the render worker executes.
// ---------------------------------------------------------------------------

export const editPlanSegmentSchema = z.object({
  clip_id: z.string().min(1),
  in: z.number().min(0),
  out: z.number().positive(),
  zoom: z.enum(["none", "light"]).default("none"),
  /** Light and colour of the clip (retouch). */
  adjust: adjustSchema.optional(),
  /** Zones blurred over the clip (faces, plates…), tracked in time. */
  blur: clipBlurSchema.optional(),
  /** A photo in a Reel: its retouch and blurred zones (as on a carousel slide). */
  photo: photoEditSchema.optional(),
});

/** Full motion-design screen (animated typography in the studio's colours, no video). */
export const sceneSchema = z.object({
  kind: z.enum(["title", "list", "quote", "number"]),
  title: z.string().min(1).max(60).describe("title : le titre ; list : l'intitulé ; quote : la citation ; number : le chiffre ou l'offre, ex. « -50 % », « 3 places »"),
  kicker: z.string().max(40).optional().describe("Petit texte au-dessus (title, number) ou auteur de la citation (quote)"),
  items: z.array(z.string().min(1).max(40)).max(5).optional().describe("Lignes de la liste (list), ex. « Lun 18h · Atelier »"),
  background: z.enum(["accent", "ink", "cream"]).describe("accent : couleur du studio ; ink : sombre ; cream : clair"),
});
export type Scene = z.infer<typeof sceneSchema>;

export const editPlanSceneSegmentSchema = z.object({
  scene: sceneSchema,
  duration: z.number().min(1).max(6),
});

/** Name of a text slot in a motion template, e.g. "title" or "price". */
export const SLOT_NAME = /^[a-z][a-z0-9_]{0,23}$/;

/** Free motion-design scene: the editor writes the brief, the motion designer (Opus) writes the code. */
export const editPlanMotionSegmentSchema = z.object({
  motion: z.object({
    brief: z.string().min(1).max(4000).describe("Ce que la scène montre et comment elle s'anime, textes exacts compris"),
    /** TSX of `function Scene(props)`, written by the motion designer. */
    code: z.string().max(24000).optional(),
    /** The same, transpiled to plain JS for the renderer. */
    js: z.string().max(40000).optional(),
    /** Fixed scene used if the generated code cannot run. */
    fallback: sceneSchema.optional(),
    /** Scene reused from the motion template library (no motion designer call). */
    template_id: z.uuid().optional(),
    /** Texts for the template's slots (the scene reads them from its `texts` prop). */
    texts: z.record(z.string().regex(SLOT_NAME), z.string().max(200)).optional(),
  }),
  duration: z.number().min(1).max(8),
});

export const editPlanTextSchema = z.object({
  text: z.string().min(1).max(120),
  from: z.number().min(0),
  to: z.number().positive(),
  style: z.enum(["hook", "band", "caption"]),
  /** Words of `text` to stress (accent colour / weight), at most three. */
  emphasis: z.array(z.string().min(1)).max(3).optional(),
  /** Set by hand in the scene editor: where the text sits (top edge, share of the height, inside the safe zone)… */
  y: z.number().min(0.05).max(0.66).optional(),
  /** …its horizontal centre (share of the width; the box narrows to stay in the safe zone)… */
  x: z.number().min(0.3).max(0.7).optional(),
  /** …its size (1 = the style's size)… */
  scale: z.number().min(0.6).max(1.6).optional(),
  /** …and a dark background behind it, to read it on a busy image. */
  backdrop: z.boolean().optional(),
  /** A look of its own (copied from an example, or one of brand.text_looks), instead of the template's style. */
  look: textLookSchema.optional(),
  ...listFields,
});

/** Motion templates rendered by Remotion (apps/render); any other template uses the ffmpeg engine. */
export const MOTION_TEMPLATES = ["doux", "dynamique", "chic", "collage"] as const;
export const motionTemplateSchema = z.enum(MOTION_TEMPLATES);
export type MotionTemplate = z.infer<typeof motionTemplateSchema>;

/** What Fauve proposes before a montage, shown on the quote and followed by the editor. */
export const montagePlanSchema = z.object({
  duration: z.number().min(5).max(60).describe("Durée visée, en secondes"),
  style: motionTemplateSchema.optional().describe("Gabarit visé : doux (élégant), dynamique (qui claque), chic (minimal), collage (fait main, photos découpées, à la mode)"),
  scenes: z
    .array(
      z.object({
        kind: z.enum(["clip", "animation", "end"]).describe("clip : un passage de ses vidéos ; animation : une scène de motion design ; end : l'écran de fin"),
        what: z.string().min(1).max(140).describe("Ce que montre la scène, en une ligne, textes exacts compris"),
      }),
    )
    .min(1)
    .max(10),
});
export type MontagePlan = z.infer<typeof montagePlanSchema>;

/** The plan as the editor reads it, inside its brief. */
export function planBrief(plan: MontagePlan): string {
  const kinds = { clip: "vidéo", animation: "animation", end: "fin" } as const;
  return [
    `Plan validé par la gérante (respecte l'ordre, le nombre de scènes et les textes) : ~${Math.round(plan.duration)} s${plan.style ? `, gabarit ${plan.style}` : ""}.`,
    ...plan.scenes.map((s, i) => `${i + 1}. ${kinds[s.kind]} : ${s.what}`),
  ].join("\n");
}

export const editPlanImageSchema = z.object({
  asset_id: z.string().min(1),
  // Safe zones: never bottom or right edge for text; the logo sits bottom-left or top.
  position: z.enum(["top_left", "top_right", "center", "bottom_left", "bottom_right"]),
  from: z.number().min(0),
  to: z.number().positive(),
});

export const editPlanObjectSchema = z.object({
  format: z.enum(["9:16", "1:1", "4:5"]),
  duration: z.number().min(3).max(90),
  template: z.string().min(1),
  segments: z.array(z.union([editPlanSegmentSchema, editPlanSceneSegmentSchema, editPlanMotionSegmentSchema])).min(1),
  texts: z.array(editPlanTextSchema),
  images: z.array(editPlanImageSchema),
  transitions: z.enum(["cut", "fade", "light_zoom"]),
  subtitles: z.boolean(),
  music: z.null(),
  /** Google Fonts families: display for hooks and titles, body for the rest (default: template or brand fonts). */
  fonts: z
    .object({ display: z.string().regex(/^[A-Za-z0-9 ]{2,40}$/).optional(), body: z.string().regex(/^[A-Za-z0-9 ]{2,40}$/).optional() })
    .optional(),
  /** Closing card over the last ~1.6 s: studio name or logo, plus a call to action. */
  end_card: z.object({ title: z.string().min(1).max(40), subtitle: z.string().max(60).optional() }).optional(),
});

export const editPlanSchema = editPlanObjectSchema.superRefine((plan, ctx) => {
  plan.segments.forEach((s, i) => {
    if ("clip_id" in s && s.out <= s.in) {
      ctx.addIssue({ code: "custom", path: ["segments", i, "out"], message: "out must be after in" });
    }
  });
  for (const [key, items] of [["texts", plan.texts], ["images", plan.images]] as const) {
    items.forEach((t, i) => {
      if (t.to <= t.from || t.to > plan.duration) {
        ctx.addIssue({ code: "custom", path: [key, i, "to"], message: "must end after start and within duration" });
      }
    });
  }
});
export type EditPlan = z.infer<typeof editPlanSchema>;
export type ClipSegment = z.infer<typeof editPlanSegmentSchema>;
export type PlanSegment = EditPlan["segments"][number];

export const isClipSegment = (s: PlanSegment): s is ClipSegment => "clip_id" in s;
export type MotionSegment = z.infer<typeof editPlanMotionSegmentSchema>;
export const isMotionSegment = (s: PlanSegment): s is MotionSegment => "motion" in s;
export const segmentSeconds = (s: PlanSegment) => (isClipSegment(s) ? s.out - s.in : s.duration);

/** The plan with its motion-design scenes removed (what the ffmpeg engine can render). */
export function withoutScenes(plan: EditPlan): EditPlan {
  return { ...plan, segments: plan.segments.filter(isClipSegment) };
}

// ---------------------------------------------------------------------------
// Clip analysis returned by the video model (Gemini).
// ---------------------------------------------------------------------------

const seconds = z.number().min(0).describe("Secondes depuis le début du clip, ex. 3.5");

export const clipAnalysisSchema = z.object({
  duration: z.number().positive().describe("Durée totale du clip en secondes"),
  orientation: z.enum(["portrait", "landscape", "square"]),
  summary: z.string().describe("Ce qu'on voit, en une ou deux phrases"),
  setting: z.string().describe("Lieu et matériel : salle, machine, fauteuil, cuisine, comptoir, vitrine, extérieur…"),
  lighting: z.enum(["good", "ok", "poor"]),
  shots: z
    .array(
      z.object({
        start: seconds,
        end: seconds,
        description: z.string().describe("Ce qui se passe dans ce plan"),
        subject: z.string().describe("Sujet principal : groupe, équipe, client, mains, produit, plat, outil, détail…"),
        energy: z.number().int().min(1).max(5).describe("1 = calme, 5 = très dynamique"),
        hook_score: z.number().int().min(1).max(5).describe("Potentiel comme accroche des 2 premières secondes"),
        quality: z.object({ blurry: z.boolean(), dark: z.boolean(), shaky: z.boolean() }),
        faces_visible: z.boolean(),
      }),
    )
    .describe("Plans successifs, sans trou ni chevauchement"),
  best_moments: z
    .array(z.object({ start: seconds, end: seconds, why: z.string() }))
    .max(3)
    .describe("Les meilleurs passages pour un Reel, du meilleur au moins bon"),
  transcript: z.string().describe("Paroles audibles, vide s'il n'y en a pas"),
  words: z
    .array(z.object({ w: z.string(), start: seconds, end: seconds }))
    .max(400)
    .optional()
    .describe("Chaque mot prononcé avec son début et sa fin, pour les sous-titres mot à mot ; vide s'il n'y a pas de voix"),
  issues: z.array(z.string()).describe("Problèmes à signaler : flou, contre-jour, visage reconnaissable d'un client, logo d'une marque…"),
});
export type ClipAnalysis = z.infer<typeof clipAnalysisSchema>;

// ---------------------------------------------------------------------------
// Brand profile (versioned in brand_profiles.profile).
// ---------------------------------------------------------------------------

export const MOODBOARD_MAX_ITEMS = 12;
export const moodboardSchema = z.object({
  items: z
    .array(z.object({ path: z.string().max(300), note: z.string().max(200).optional() }))
    .max(MOODBOARD_MAX_ITEMS),
  /** Fauve's reading of the images: the art direction they imply, in words. */
  reading: z.string().max(2000).optional(),
  palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(6).optional(),
  read_at: z.string().optional(),
});
export type Moodboard = z.infer<typeof moodboardSchema>;

export const brandProfileSchema = z.object({
  tone: z.string().describe("Ton des légendes, ex. « doux, phrases courtes, un peu d'humour »"),
  caption_length: z.enum(["short", "medium", "long"]),
  emojis: z.enum(["none", "few", "many"]),
  hashtags: z.array(z.string()).describe("Hashtags récurrents, sans #"),
  visual_notes: z.string().describe("Couleurs, cadrages, ambiance"),
  colors: z
    .array(z.string().regex(/^#[0-9a-f]{6}$/i))
    .max(6)
    .optional()
    .describe("Couleurs de la charte, la principale en premier (ex. tirées du site web)"),
  fonts: z.array(z.string().max(60)).max(3).optional().describe("Polices de la charte (Google Fonts) : titres d'abord, puis texte"),
  logo_url: z.url().optional(),
  /** The studio's own fonts (files uploaded in Style, private bucket): usable by name like any Google font. */
  custom_fonts: z
    .array(z.object({ family: z.string().regex(/^[A-Za-z0-9 ]{2,40}$/), path: z.string().max(300) }))
    .max(6)
    .optional(),
  /** Logo uploaded in the web app (path in the private media bucket); wins over logo_url. */
  logo_path: z.string().max(300).optional(),
  /** Free-text art direction written by the manager, followed by the editor and the motion designer. */
  art_direction: z
    .string()
    .max(1500)
    .optional()
    .describe("Direction artistique libre : ambiance, couleurs, typographie, rythme, ce qu'on aime et ce qu'on évite"),
  default_template: motionTemplateSchema.optional().describe("Gabarit de montage préféré du studio"),
  /** Inspiration images from the Style page, and Fauve's reading of them (what the montage follows). */
  moodboard: moodboardSchema.optional(),
  /** Text looks the manager keeps (copied from examples she sent, or set by hand). */
  text_looks: z.array(savedLookSchema).max(12).optional(),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
});
export type BrandProfile = z.infer<typeof brandProfileSchema>;
