import "server-only";
import { editPlanSchema, isClipSegment, sceneTimes, timeline, type EditPlan } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sceneSpriteInSandbox } from "./sandbox";

// The strip of scenes under a Reel (« Ta publication » and its editor): one small image
// per scene of a render, side by side in a single JPEG next to the video, kept on the
// render row. Never in the way: without it, the scenes show as plain tiles.

/** Made right after a render, from its signed video. */
export async function makeSceneSprite(p: { studioId: string; renderId: string; videoUrl: string; plan: Pick<EditPlan, "segments"> }): Promise<string | null> {
  const times = sceneTimes(p.plan);
  if (times.length < 2) return null;
  const jpeg = await sceneSpriteInSandbox(p.renderId, p.videoUrl, times);
  if (!jpeg) return null;
  const db = supabaseAdmin();
  const path = `${p.studioId}/renders/${p.renderId}.scenes.jpg`;
  const upload = await db.storage.from("media").upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (upload.error) throw new Error(`scenes strip: ${upload.error.message}`);
  await db.from("renders").update({ scenes_path: path }).eq("id", p.renderId);
  return path;
}

/** Asked once per render on this server, so a page seen often does not ask again. */
const asked = new Set<string>();

/**
 * For a render made before the strips existed: made in the background when its page is
 * seen. Only when the video follows its plan's timeline (a render by the ffmpeg engine
 * drops the animations: its scenes would not line up).
 */
export async function ensureSceneSprite(studioId: string, renderId: string): Promise<void> {
  if (asked.has(renderId)) return;
  asked.add(renderId);
  const db = supabaseAdmin();
  const { data } = await db.from("renders").select("status, storage_path, scenes_path, edit_plan_id, duration_ms").eq("id", renderId).eq("studio_id", studioId).maybeSingle();
  if (!data || data.status !== "done" || !data.storage_path || data.scenes_path || !data.edit_plan_id) return;
  const plan = editPlanSchema.safeParse((await db.from("edit_plans").select("plan").eq("id", data.edit_plan_id).maybeSingle()).data?.plan);
  if (!plan.success) return;
  const end = timeline(plan.data).at(-1)?.end ?? 0;
  const aligned = plan.data.segments.every(isClipSegment) || Math.abs((data.duration_ms ?? 0) / 1000 - end) < 0.5;
  if (!aligned) return;
  const signed = await db.storage.from("media").createSignedUrl(data.storage_path as string, 600);
  if (!signed.data?.signedUrl) return;
  await makeSceneSprite({ studioId, renderId, videoUrl: signed.data.signedUrl, plan: plan.data }).catch((error: unknown) => console.warn("scenes strip failed", renderId, error));
}
