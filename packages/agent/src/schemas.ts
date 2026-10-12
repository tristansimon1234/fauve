import { z } from "zod";

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
export type PostKind = z.infer<typeof postKindSchema>;

export const platformSchema = z.enum(["instagram", "tiktok"]);
export type Platform = z.infer<typeof platformSchema>;

/** Fixed reaction vocabulary: 👍 received, 🔥 great content, ✅ published. */
export const reactionSchema = z.enum(["👍", "🔥", "✅"]);
export type Reaction = z.infer<typeof reactionSchema>;

// ---------------------------------------------------------------------------
// Edit plan: Claude decides, the render worker executes.
// ---------------------------------------------------------------------------

export const editPlanSegmentSchema = z.object({
  clip_id: z.string().min(1),
  in: z.number().min(0),
  out: z.number().positive(),
  zoom: z.enum(["none", "light"]).default("none"),
});

export const editPlanTextSchema = z.object({
  text: z.string().min(1).max(120),
  from: z.number().min(0),
  to: z.number().positive(),
  style: z.enum(["hook", "band", "caption"]),
  /** Words of `text` to stress (accent colour / weight), at most three. */
  emphasis: z.array(z.string().min(1)).max(3).optional(),
});

/** Motion templates rendered by Remotion (apps/render); any other template uses the ffmpeg engine. */
export const MOTION_TEMPLATES = ["doux", "dynamique", "chic"] as const;
export const motionTemplateSchema = z.enum(MOTION_TEMPLATES);
export type MotionTemplate = z.infer<typeof motionTemplateSchema>;

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
  segments: z.array(editPlanSegmentSchema).min(1),
  texts: z.array(editPlanTextSchema),
  images: z.array(editPlanImageSchema),
  transitions: z.enum(["cut", "fade", "light_zoom"]),
  subtitles: z.boolean(),
  music: z.null(),
  /** Closing card over the last ~1.6 s: studio name or logo, plus a call to action. */
  end_card: z.object({ title: z.string().min(1).max(40), subtitle: z.string().max(60).optional() }).optional(),
});

export const editPlanSchema = editPlanObjectSchema.superRefine((plan, ctx) => {
  plan.segments.forEach((s, i) => {
    if (s.out <= s.in) {
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

// ---------------------------------------------------------------------------
// Clip analysis returned by the video model (Gemini).
// ---------------------------------------------------------------------------

const seconds = z.number().min(0).describe("Secondes depuis le début du clip, ex. 3.5");

export const clipAnalysisSchema = z.object({
  duration: z.number().positive().describe("Durée totale du clip en secondes"),
  orientation: z.enum(["portrait", "landscape", "square"]),
  summary: z.string().describe("Ce qu'on voit, en une ou deux phrases"),
  setting: z.string().describe("Lieu et matériel : studio, reformer, tapis, barre, extérieur…"),
  lighting: z.enum(["good", "ok", "poor"]),
  shots: z
    .array(
      z.object({
        start: seconds,
        end: seconds,
        description: z.string().describe("Ce qui se passe dans ce plan"),
        subject: z.string().describe("Sujet principal : groupe, prof, élève, mains, pieds, machine, détail…"),
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
  issues: z.array(z.string()).describe("Problèmes à signaler : flou, contre-jour, visage d'élève reconnaissable, logo d'une marque…"),
});
export type ClipAnalysis = z.infer<typeof clipAnalysisSchema>;

// ---------------------------------------------------------------------------
// Brand profile (versioned in brand_profiles.profile).
// ---------------------------------------------------------------------------

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
  fonts: z.array(z.string().max(60)).max(3).optional().describe("Polices de la charte, la principale en premier"),
  logo_url: z.url().optional(),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
});
export type BrandProfile = z.infer<typeof brandProfileSchema>;
