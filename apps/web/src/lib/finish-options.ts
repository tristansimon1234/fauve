import "server-only";
import {
  applySpeechCuts,
  asAsked,
  editPlanSchema,
  finishPlan,
  isClipSegment,
  snapToTempo,
  speechFacts,
  spokenShot,
  undoSpeechCuts,
  type EditPlan,
  type ReelFinish,
} from "@fauve/agent";
import { insertPlanVersion } from "@/lib/edit-plans";
import { loadMontageInputs } from "@/lib/render/render-post";
import { loadTracks } from "@/lib/render/tracks";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her finishing touches on a Reel already made (Edith's set_finish), without the editor: a new version
// of the same cut. The sound, the sound of her videos, the relief and the steadying are the render's
// choice; the « euh » cut or not and the ramps change the cut itself, deterministically (the passages
// as the editor wrote them come back, or are cut again), the cuts put back on the beat, the plan finished
// again. Free: no model works on it, only the render.

/** The finishing touches that change the cut (the others only change how it renders). */
const changesCut = (plan: EditPlan, change: ReelFinish) =>
  (change.cuts !== undefined && change.cuts !== (plan.finish?.cuts ?? "auto")) || (change.ramp !== undefined && change.ramp !== (plan.finish?.ramp ?? "auto"));

/** The post's current plan with her finishing touches changed, as a new version (the post points to it). False when nothing changed. */
export async function refinishPost(studioId: string, postId: string, change: ReelFinish): Promise<boolean> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("edit_plan_id").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post?.edit_plan_id) throw new Error("no montage to refinish");
  const { data: row } = await db.from("edit_plans").select("plan").eq("id", post.edit_plan_id as string).eq("studio_id", studioId).maybeSingle();
  const plan = editPlanSchema.parse(row?.plan);
  const finish = { ...plan.finish, ...change };
  if (JSON.stringify(finish) === JSON.stringify(plan.finish ?? {})) return false;
  let next: EditPlan = { ...plan, finish };
  if (changesCut(plan, change)) {
    const inputs = await loadMontageInputs(studioId, next, { postId });
    const durations = Object.fromEntries(Object.entries(inputs.clipDurations).map(([id, d]) => [id, d ?? inputs.facts.clips[id]?.duration ?? 0]));
    const tracks = await loadTracks(studioId, Object.keys(inputs.facts.clips)).catch(() => ({}));
    const facts = { ...inputs.facts, tracks };
    const speech = speechFacts(Object.entries(facts.clips).map(([media_id, analysis]) => ({ media_id, analysis })));
    // Her words as she said them, or cut again (from the passages as written).
    if (change.cuts === "off") next = undoSpeechCuts(next);
    else if (change.cuts === "auto") next = applySpeechCuts(undoSpeechCuts(next), speech, durations);
    // Plain slow motion over what the editor asked; back to « auto », finishPlan ramps it again.
    if (change.ramp === "off") next = { ...next, segments: next.segments.map(asAsked) };
    // The other cuts back on the beat (never between two of someone's words, never inside a ramp), then finished again.
    next = snapToTempo(next, durations, (s) => spokenShot(s, speech) || (isClipSegment(s) && Boolean(s.ramp)));
    next = finishPlan(next, facts, durations);
  }
  const { id } = await insertPlanVersion(studioId, postId, editPlanSchema.parse(next));
  const { error } = await db.from("posts").update({ edit_plan_id: id }).eq("id", postId).eq("studio_id", studioId);
  if (error) throw new Error(error.message);
  return true;
}
