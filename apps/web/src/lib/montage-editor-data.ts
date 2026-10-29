import "server-only";
import { readPostMusic } from "@/lib/render/music";
import { dayIn, editPlanSchema, isClipSegment, motionTemplateSchema, type ReelInputs } from "@fauve/agent";
import { loadMontageInputs } from "@/lib/render/render-post";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * What the live montage (scene editor, mobile page) needs: the full plan and
 * its inputs. Remotion montages only; null for anything else. `extraMedia`:
 * the post's other files, whose videos can be added as new scenes.
 */
export async function loadEditorData(studioId: string, planId: string, extraMedia: string[] = []) {
  const db = supabaseAdmin();
  const { data } = await db.from("edit_plans").select("plan, post_id").eq("id", planId).eq("studio_id", studioId).maybeSingle();
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
    voice: plan.data.voice,
    template: plan.data.template,
    layers: plan.data.layers,
    finish: plan.data.finish,
  }, { postId: data?.post_id as string | undefined });
  // Edith's music plays in the live preview too (the piece kept for this post).
  const { data: post } = data?.post_id ? await db.from("posts").select("music").eq("id", data.post_id).maybeSingle() : { data: null };
  const music = readPostMusic(post?.music);
  const soundtrack =
    music.mode === "on" && music.track ? ((await db.storage.from("media").createSignedUrl(music.track.path, 3600)).data?.signedUrl ?? undefined) : undefined;
  return {
    plan: plan.data,
    clipDurations: inputs.clipDurations,
    inputs: {
      template: template.data,
      clipUrls: inputs.clipUrls,
      photoIds: inputs.photoIds,
      words: inputs.words,
      aspects: inputs.aspects,
      brand: { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, logoOnDark: inputs.logoOnDark, fonts: inputs.fonts, colors: inputs.colors, customFonts: inputs.customFonts, signature: inputs.reelSignature },
      ...(soundtrack ? { soundtrack } : {}),
      ...(inputs.voice ? { voice: inputs.voice } : {}),
      // A collage's stickers and the cut-outs its animations compose with, so the preview shows them as the video does.
      ...(inputs.cutouts ? { cutouts: inputs.cutouts } : {}),
      ...(inputs.sceneCutouts ? { sceneCutouts: inputs.sceneCutouts } : {}),
      // A moving photo in relief, as in the video.
      ...(inputs.depth ? { depth: inputs.depth } : {}),
      today: dayIn(),
      photoAspects: inputs.photoAspects,
      // What moves under its animations, so an animation that follows a hand follows it in the preview too.
      ...(Object.keys(inputs.tracks).length ? { tracks: inputs.tracks } : {}),
    } satisfies ReelInputs,
  };
}
