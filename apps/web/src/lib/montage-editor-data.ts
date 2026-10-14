import "server-only";
import { editPlanSchema, isClipSegment, motionTemplateSchema, type ReelInputs } from "@fauve/agent";
import { loadMontageInputs } from "@/lib/render/render-post";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * What the live montage (scene editor, mobile page) needs: the full plan and
 * its inputs. Remotion montages only; null for anything else. `extraMedia`:
 * the post's other files, whose videos can be added as new scenes.
 */
export async function loadEditorData(studioId: string, planId: string, extraMedia: string[] = []) {
  const db = supabaseAdmin();
  const { data } = await db.from("edit_plans").select("plan").eq("id", planId).eq("studio_id", studioId).maybeSingle();
  const plan = editPlanSchema.safeParse(data?.plan);
  if (!plan.success) return null;
  const template = motionTemplateSchema.safeParse(plan.data.template);
  if (!template.success) return null;
  const inPlan = new Set(plan.data.segments.filter(isClipSegment).map((s) => s.clip_id));
  const wanted = extraMedia.filter((id) => !inPlan.has(id));
  const extraVideos = wanted.length
    ? ((await db.from("media_assets").select("id").eq("studio_id", studioId).in("kind", ["video", "image"]).in("id", wanted)).data ?? []).map((m) => m.id as string)
    : [];
  // Signed along with the plan's clips, so a video added by hand plays at once.
  const inputs = await loadMontageInputs(studioId, {
    segments: [...plan.data.segments, ...extraVideos.map((clip_id) => ({ clip_id, in: 0, out: 1, zoom: "none" as const }))],
  });
  return {
    plan: plan.data,
    clipDurations: inputs.clipDurations,
    inputs: {
      template: template.data,
      clipUrls: inputs.clipUrls,
      photoIds: inputs.photoIds,
      words: inputs.words,
      brand: { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts, customFonts: inputs.customFonts },
    } satisfies ReelInputs,
  };
}
