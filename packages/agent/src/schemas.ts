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
});

export const editPlanImageSchema = z.object({
  asset_id: z.string().min(1),
  // Safe zones: never bottom or right edge for text; the logo sits bottom-left or top.
  position: z.enum(["top_left", "top_right", "center", "bottom_left", "bottom_right"]),
  from: z.number().min(0),
  to: z.number().positive(),
});

export const editPlanSchema = z
  .object({
    format: z.enum(["9:16", "1:1", "4:5"]),
    duration: z.number().min(3).max(90),
    template: z.string().min(1),
    segments: z.array(editPlanSegmentSchema).min(1),
    texts: z.array(editPlanTextSchema),
    images: z.array(editPlanImageSchema),
    transitions: z.enum(["cut", "fade", "light_zoom"]),
    subtitles: z.boolean(),
    music: z.null(),
  })
  .superRefine((plan, ctx) => {
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

export const clipAnalysisSchema = z.object({
  duration: z.number().positive(),
  shots: z.array(
    z.object({
      start: z.number().min(0),
      end: z.number().positive(),
      description: z.string(),
      quality: z.object({
        blurry: z.boolean(),
        dark: z.boolean(),
        shaky: z.boolean(),
      }),
      faces_visible: z.boolean(),
    }),
  ),
  transcript: z.string().nullable(),
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
