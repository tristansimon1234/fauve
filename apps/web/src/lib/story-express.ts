import "server-only";
import {
  finishPlan,
  normalizeEditPlan,
  PHOTO_MAX_SECONDS,
  storyPlan,
  STORY_TEXT_MAX,
  type MediaFacts,
  type ReelLook,
} from "@fauve/agent";
import { insertPlanVersion } from "@/lib/edit-plans";
import { defaultPlatforms } from "@/lib/social/tiktok-account";
import { renderAndDeliver, type DeliveryTarget } from "@/lib/render/deliver";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { photoRegions } from "@/lib/video/regions";

// A story express (story.ts in @fauve/agent): her photo or video and one sentence, made into an animated
// story in her charter without the editor (the plan is written by the code, finished and rendered like a
// montage), then delivered like one. Free: a render and its music, no model writes it.

export class StoryExpressError extends Error {}

/**
 * Makes the story: on the story she named, else a new one (planned at `scheduledAt`, else now); its plan is a
 * new version, then it is rendered and delivered. Throws StoryExpressError with what to tell her.
 */
export async function prepareStoryExpress(params: {
  studioId: string;
  mediaId: string;
  text: string;
  detail?: string;
  look?: ReelLook | null;
  postId?: string;
  scheduledAt?: string;
}): Promise<{ postId: string; title: string }> {
  const db = supabaseAdmin();
  const { data: media } = await db.from("media_assets").select("id, kind").eq("id", params.mediaId).eq("studio_id", params.studioId).maybeSingle();
  if (!media || (media.kind !== "image" && media.kind !== "video")) throw new StoryExpressError("Ce media_id n'est ni une photo ni une vidéo de ce commerce.");
  const photo = media.kind === "image";
  const title = params.text.trim().slice(0, STORY_TEXT_MAX);
  if (!title) throw new StoryExpressError("Il faut la phrase de la story.");

  // What the engine needs to frame it and keep its words off faces: the photo's reading, or the video's analysis.
  const facts: MediaFacts = { clips: {}, photos: {} };
  let analysis: Parameters<typeof storyPlan>[0]["analysis"];
  if (photo) {
    const read = await photoRegions(params.studioId, params.mediaId);
    facts.photos[params.mediaId] = { width: read.width, height: read.height, detection: read.detection };
  } else {
    const analysed = await ensureClipAnalysis(params.studioId, params.mediaId);
    if (!("analysis" in analysed)) throw new StoryExpressError(analysed.status === "locked" ? (analysed.error ?? "Sans crédits, je ne peux pas regarder la vidéo.") : "La vidéo n'est pas encore lue : réessaie dans une minute.");
    analysis = analysed.analysis;
    facts.clips[params.mediaId] = analysed.analysis;
  }

  let postId = params.postId;
  if (postId) {
    const { data: post } = await db.from("posts").select("kind, status").eq("id", postId).eq("studio_id", params.studioId).maybeSingle();
    if (!post || post.kind !== "story") throw new StoryExpressError("Cette publication n'est pas une story.");
    if (["published", "measured"].includes(post.status as string)) throw new StoryExpressError("Cette story est déjà en ligne.");
  } else {
    const { data: created, error } = await db
      .from("posts")
      .insert({
        studio_id: params.studioId,
        kind: "story",
        title,
        status: "media_received",
        media_ids: [params.mediaId],
        platforms: await defaultPlatforms(params.studioId, "story"),
        scheduled_at: params.scheduledAt ?? new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "story not created");
    postId = created.id as string;
  }

  const durations = { [params.mediaId]: photo ? PHOTO_MAX_SECONDS : (analysis?.duration ?? 0) };
  const written = storyPlan({ mediaId: params.mediaId, photo, analysis, text: params.text, detail: params.detail, look: params.look });
  const plan = finishPlan(normalizeEditPlan(written, durations, 0), facts, durations);
  const { id } = await insertPlanVersion(params.studioId, postId, plan);
  const { error } = await db.from("posts").update({ edit_plan_id: id, media_ids: [params.mediaId] }).eq("id", postId).eq("studio_id", params.studioId);
  if (error) throw new Error(error.message);
  return { postId, title };
}

/** Renders a story express prepared above and delivers it (its link on WhatsApp, its card in the app). */
export async function deliverStoryExpress(target: Omit<DeliveryTarget, "offerVariant">): Promise<void> {
  await renderAndDeliver({ ...target, offerVariant: false });
}
