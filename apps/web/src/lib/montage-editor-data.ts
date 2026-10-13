import "server-only";
import { editPlanSchema, motionTemplateSchema, type ReelInputs } from "@fauve/agent";
import { loadMontageInputs } from "@/lib/render/render-post";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * What the live montage (scene editor, mobile page) needs: the full plan and
 * its inputs. Remotion montages only; null for anything else.
 */
export async function loadEditorData(studioId: string, planId: string) {
  const { data } = await supabaseAdmin().from("edit_plans").select("plan").eq("id", planId).eq("studio_id", studioId).maybeSingle();
  const plan = editPlanSchema.safeParse(data?.plan);
  if (!plan.success) return null;
  const template = motionTemplateSchema.safeParse(plan.data.template);
  if (!template.success) return null;
  const inputs = await loadMontageInputs(studioId, plan.data);
  return {
    plan: plan.data,
    clipDurations: inputs.clipDurations,
    inputs: {
      template: template.data,
      clipUrls: inputs.clipUrls,
      words: inputs.words,
      brand: { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts },
    } satisfies ReelInputs,
  };
}
