import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  brandProfileSchema,
  CLAUDE_MODEL,
  defaultLook,
  editPlanSchema,
  motionTemplateSchema,
  resolveReelBrand,
  savedLookSchema,
  SLIDE_Y,
  slidesPlanSchema,
  TEXT_EXAMPLE_PROMPT,
  textExampleSchema,
  type SavedLook,
  type TextExample,
  type TextLook,
} from "@fauve/agent";
import { z } from "zod";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { saveSlides } from "@/lib/render/slides";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Text looks: read from an example the manager sends, kept in the studio's
// style (brand_profiles.text_looks), and applied to a post's texts, whether
// they sit on a carousel's photos or in a montage.

const MAX_LOOKS = 12;
type Role = "hook" | "band" | "caption";

/** Fauve's typographer reads the texts of an example image (Opus, vision). */
export async function readTextExample(studioId: string, imageUrl: string, note?: string): Promise<TextExample> {
  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 6000,
    output_config: { effort: "medium", format: betaZodOutputFormat(textExampleSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: TEXT_EXAMPLE_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: note ? `Ce que la gérante en dit : ${note}` : "Décris les textes de cet exemple." },
        ],
      },
    ],
  });
  await logClaudeCost(studioId, response.usage, "text_example");
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Lecture de l'exemple impossible (${response.stop_reason})`);
  return response.parsed_output;
}

async function latestProfile(studioId: string) {
  const { data } = await supabaseAdmin().from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1);
  return brandProfileSchema.partial().catch({}).parse(data?.[0]?.profile ?? {});
}

/** The studio's saved looks, newest first. */
export async function loadTextLooks(studioId: string): Promise<SavedLook[]> {
  const profile = await latestProfile(studioId);
  return z.array(savedLookSchema).catch([]).parse(profile.text_looks ?? []);
}

/** Keeps looks in the studio's style (a new brand profile version): same name = replaced, newest first. */
export async function keepTextLooks(studioId: string, looks: SavedLook[]): Promise<void> {
  if (!looks.length) return;
  await insertProfileVersion(studioId, (current) => {
    const previous = z.array(savedLookSchema).catch([]).parse(current.text_looks ?? []);
    const names = new Set(looks.map((l) => l.name.toLowerCase()));
    return { ...current, text_looks: [...looks, ...previous.filter((l) => !names.has(l.name.toLowerCase()))].slice(0, MAX_LOOKS) };
  });
}

/** Fonts a hand-made look starts from: the studio's, or its template's. */
export async function lookDefaults(studioId: string, template: string | undefined, role: Role): Promise<TextLook> {
  const profile = await latestProfile(studioId);
  const t = motionTemplateSchema.catch(profile.default_template ?? "doux").parse(template);
  const brand = resolveReelBrand({}, t, { name: "", fonts: profile.fonts });
  return defaultLook(role, { display: brand.displayFont, body: brand.bodyFont });
}

/** What to do with one text: a new look, null for the template's style again, undefined to leave it. */
export type LookChange = (text: { style: Role; look?: TextLook }) => { look?: TextLook | null; y?: number; x?: number } | undefined;

export type StyledResult = { kind: "slides" | "montage"; changed: number; template?: string };

/**
 * Applies a change to every text of a post: on a carousel's or photo post's
 * slides, or in its montage (a new edit plan version). The caller renders after.
 */
export async function restyleTexts(studioId: string, postId: string, change: LookChange): Promise<StyledResult> {
  const db = supabaseAdmin();
  const { data: post } = await db
    .from("posts")
    .select("id, kind, status, slides, edit_plan_id")
    .eq("id", postId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!post) throw new Error("Publication introuvable");
  if (post.status === "published" || post.status === "measured") throw new Error("Cette publication est déjà en ligne");

  let changed = 0;
  const apply = <T extends { style: Role; look?: TextLook; y?: number; x?: number }>(text: T, yRange: { min: number; max: number }): T => {
    const next = change(text);
    if (!next) return text;
    changed++;
    const out: T = { ...text };
    if (next.look === null) delete out.look;
    else if (next.look) out.look = next.look;
    if (next.y !== undefined) out.y = Math.min(yRange.max, Math.max(yRange.min, Math.round(next.y * 100) / 100));
    if (next.x !== undefined) out.x = Math.min(0.7, Math.max(0.3, Math.round(next.x * 100) / 100));
    return out;
  };

  const slides = slidesPlanSchema.safeParse(post.slides);
  if ((post.kind === "carousel" || post.kind === "post") && slides.success) {
    const plan = { ...slides.data, slides: slides.data.slides.map((s) => ({ ...s, texts: s.texts.map((t) => apply(t, SLIDE_Y)) })) };
    if (!changed) throw new Error("Il n'y a pas encore de texte sur les photos : écris-le d'abord (write_on_photos)");
    await saveSlides(studioId, postId, plan);
    return { kind: "slides", changed, template: plan.template };
  }

  const base = db.from("edit_plans").select("id, version, plan").eq("post_id", postId);
  const { data: row } = post.edit_plan_id
    ? await base.eq("id", post.edit_plan_id).maybeSingle()
    : await base.order("version", { ascending: false }).limit(1).maybeSingle();
  const plan = editPlanSchema.safeParse(row?.plan);
  if (!plan.success) throw new Error("Cette publication n'a ni texte sur photos ni montage");
  if (!motionTemplateSchema.safeParse(plan.data.template).success) throw new Error("Ce montage ancien ne prend pas les styles de texte : refais-le d'abord");
  const next = { ...plan.data, texts: plan.data.texts.map((t) => apply(t, { min: 0.05, max: 0.66 })) };
  if (!changed) throw new Error("Ce montage n'a pas de texte à styler");

  const { data: versions } = await db.from("edit_plans").select("version").eq("post_id", postId);
  const version = Math.max(0, ...(versions ?? []).map((v) => v.version as number)) + 1;
  const { data: inserted, error } = await db
    .from("edit_plans")
    .insert({ studio_id: studioId, post_id: postId, version, plan: editPlanSchema.parse(next) })
    .select("id")
    .single();
  if (error) throw new Error(`edit_plans: ${error.message}`);
  await db.from("posts").update({ edit_plan_id: inserted.id }).eq("id", postId);
  return { kind: "montage", changed, template: plan.data.template };
}

/** The example's block for a text: the same role, else the first one. */
export function blockFor(example: TextExample, role: Role) {
  return example.blocks.find((b) => b.role === role) ?? example.blocks[0]!;
}
