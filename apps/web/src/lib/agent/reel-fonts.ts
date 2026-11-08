import "server-only";
import { z } from "zod";
import {
  brandProfileSchema,
  clipAnalysisSchema,
  editPlanSchema,
  motionTemplateSchema,
  photoDetectionSchema,
  planMediaIds,
  resolveReelBrand,
  withReelFonts,
  type ClipAnalysis,
  type EditPlan,
  type FontChange,
  type MediaFacts,
  type ReelFontPair,
} from "@fauve/agent";
import { insertPlanVersion } from "@/lib/edit-plans";
import { googleFont, usableFonts } from "@/lib/fonts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkComposition } from "./skill-design";

// A Reel's fonts or text colour changed without making it again (packages/agent/src/reel-fonts.ts; docs/marque.md,
// « Police et couleurs d'un Reel changées sans le refaire »): Tristan's « Met ma police please » had launched a paid
// correction, the editor and the motion designer again (0,77 €, 6 credits), for « le reste du Reel ne bouge pas ». Here:
// the plan's fonts set (or her charter's), its texts on them, a composition's families and text colour changed in its
// code by code, its composition checked by the scene check (never written again), a new version saved; the caller makes
// the video again (free, no credit).

export type ReelFontsOutcome =
  | { ok: true; same: boolean; fonts: ReelFontPair; colorMissed: boolean; rewritten: boolean }
  | { ok: false; error: string };

const photoReadSchema = z.object({ width: z.number(), height: z.number(), detection: photoDetectionSchema });

/** What the scene check reads of her files (their readings as kept, nothing read again: no call). */
async function factsOf(studioId: string, plan: EditPlan): Promise<MediaFacts> {
  const db = supabaseAdmin();
  const ids = planMediaIds(plan);
  if (!ids.length) return { clips: {}, photos: {}, tracks: {} };
  const [assets, analyses] = await Promise.all([
    db.from("media_assets").select("id, kind, regions").eq("studio_id", studioId).in("id", ids),
    db.from("clip_analyses").select("media_id, analysis").in("media_id", ids).order("created_at", { ascending: false }),
  ]);
  const clips: Record<string, ClipAnalysis> = {};
  for (const row of analyses.data ?? []) {
    if (clips[row.media_id as string]) continue;
    const parsed = clipAnalysisSchema.safeParse(row.analysis);
    if (parsed.success) clips[row.media_id as string] = parsed.data;
  }
  const photos: MediaFacts["photos"] = {};
  for (const a of assets.data ?? []) {
    const read = a.kind === "image" ? photoReadSchema.safeParse(a.regions) : null;
    if (read?.success) photos[a.id as string] = read.data;
  }
  return { clips, photos, tracks: {} };
}

/**
 * Her Reel in other fonts or another text colour, as a new version of its plan (the post points to it): `same` when it
 * already shows them (nothing saved). An error she can be told when it cannot be done this way (a font Google Fonts does
 * not serve, an effect drawn image by image, a composition whose texts no longer hold in the frame with that font).
 */
export async function restyleReelFonts(studioId: string, postId: string, change: FontChange): Promise<ReelFontsOutcome> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("edit_plan_id").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post?.edit_plan_id) return { ok: false, error: "Ce Reel n'est pas encore monté : sa police se choisit au montage." };
  const row = await db.from("edit_plans").select("plan").eq("id", post.edit_plan_id as string).maybeSingle();
  const parsed = editPlanSchema.safeParse(row.data?.plan);
  if (!parsed.success) return { ok: false, error: "Le plan de ce Reel est illisible." };
  const plan = parsed.data;
  if (plan.baked) return { ok: false, error: "Ce Reel est un effet dessiné image par image : ses mots se changent (effect_words), sa police ou sa couleur en refaisant l'effet (correction)." };
  const [brand, studio] = await Promise.all([
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("studios").select("name").eq("id", studioId).maybeSingle(),
  ]);
  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.profile ?? {});
  const template = motionTemplateSchema.catch("libre").parse(plan.template);
  const own = (profile.custom_fonts ?? []).map((f) => f.family);
  const { fonts: usable } = await usableFonts(profile.fonts, own, template, profile.font_twins).catch(() => ({ fonts: profile.fonts }));
  const now = resolveReelBrand(plan, template, { name: "", fonts: usable });
  const charter = resolveReelBrand({}, template, { name: "", fonts: usable });
  const shown = { display: now.displayFont, body: now.bodyFont };
  // A family she names: served by Google Fonts (by the name it serves it under), or one of her own uploaded fonts.
  const served = async (family: string | undefined): Promise<string | undefined | null> => {
    if (!family?.trim()) return undefined;
    const ownFont = own.find((f) => f.toLowerCase() === family.trim().toLowerCase());
    return ownFont ?? (await googleFont(family.trim()).catch(() => null));
  };
  const [display, body] = await Promise.all([served(change.display), served(change.body)]);
  if (display === null || body === null) return { ok: false, error: `Police introuvable sur Google Fonts : « ${display === null ? change.display : change.body} ». Demande-lui le nom exact, ou propose une police proche.` };
  const target = change.charter ? { display: charter.displayFont, body: charter.bodyFont } : { display: display ?? shown.display, body: body ?? shown.body };
  const asked: FontChange = { ...change, ...(display ? { display } : {}), ...(body ? { body } : {}) };
  const result = withReelFonts(plan, asked, shown, target);
  // Already so (her fonts asked on a Reel in her fonts): nothing saved, nothing made again.
  if (!result.changed || JSON.stringify(result.plan) === JSON.stringify(plan)) return { ok: true, same: true, fonts: target, colorMissed: result.colorMissed, rewritten: false };
  const next = result.plan;
  // Its Reel-wide composition (a skill's or the motion designer's) checked with its new fonts and code, never written
  // again: a font wider than the one it was drawn in can push a text out of the frame.
  const composed = next.layers?.findIndex((l) => l.compose && l.motion.code) ?? -1;
  if (composed >= 0) {
    const facts = await factsOf(studioId, next);
    const checked = await checkComposition(studioId, next, facts, profile, (studio.data?.name as string | null) ?? "", "composition").catch((error: unknown) => ({
      error: `le contrôle n'a pas pu tourner : ${error instanceof Error ? error.message : String(error)}`.slice(0, 300),
    }));
    if ("error" in checked) {
      console.warn("reel fonts: the composition refused with these fonts, nothing changed", postId, target, checked.error.slice(0, 300));
      return {
        ok: false,
        error: `Avec cette police, l'animation de ce Reel ne tient plus (${checked.error.slice(0, 160)}). Rien n'a changé et rien n'est débité : propose une police plus étroite, ou une correction (montage) qui redessine l'animation.`,
      };
    }
    const layer = next.layers![composed]!;
    const motion = { ...layer.motion, js: checked.js };
    if (checked.fonts.length) motion.fonts = checked.fonts;
    else delete motion.fonts;
    // Where its words are drawn (a veil under them) follows the new letters.
    next.layers = next.layers!.map((l, i) => (i === composed ? { ...layer, motion, ...(checked.ink?.length ? { ink: checked.ink } : {}) } : l));
  }
  const saved = await insertPlanVersion(studioId, postId, next);
  const { error } = await db.from("posts").update({ edit_plan_id: saved.id }).eq("id", postId).eq("studio_id", studioId);
  if (error) throw new Error(error.message);
  console.log("reel fonts: changed without a new montage", postId, `${shown.display} + ${shown.body} → ${target.display} + ${target.body}`, change.color ?? "", result.rewritten.length ? "(composition code changed)" : "");
  return { ok: true, same: false, fonts: target, colorMissed: result.colorMissed, rewritten: result.rewritten.length > 0 };
}
