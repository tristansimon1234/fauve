"use server";

import { EFFECT_VOICE_OUT, editPlanSchema, isBaked, planLook, postCoverSchema, sameLook, type PostCover } from "@fauve/agent";
import { resolveLook } from "@/lib/agent/look-designer";
import { insertPlanVersion } from "@/lib/edit-plans";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { correctionQuote, startMontage } from "@/lib/montage-start";
import { readPostMusic } from "@/lib/render/music";
import { renderPost } from "@/lib/render/render-post";
import { removeVoice } from "@/lib/voice-over";
import { z } from "zod";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Sets a Reel's cover (a frame of its video or one of the studio's photos); null leaves it to Edith. */
export async function setCover(postId: string, cover: PostCover | null): Promise<{ ok: boolean }> {
  const parsed = z.object({ postId: z.uuid(), cover: postCoverSchema.nullable() }).safeParse({ postId, cover });
  if (!parsed.success) return { ok: false };
  const { db, member } = await getStudioContext();
  if (!member) return { ok: false };
  const studioId = member.studio.id;
  const chosen = parsed.data.cover;
  if (chosen && "media_id" in chosen) {
    const { data: photo } = await db.from("media_assets").select("id").eq("id", chosen.media_id).eq("studio_id", studioId).eq("kind", "image").maybeSingle();
    if (!photo) return { ok: false };
  }
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .update({ cover: chosen })
    .eq("id", postId)
    .eq("studio_id", studioId)
    .not("status", "in", "(published,measured)")
    .select("id");
  if (error || !data.length) return { ok: false };
  revalidatePath("/calendrier");
  return { ok: true };
}

/** A Reel in the profile grid too (default), or only in the Reels tab. */
export async function setShareToFeed(postId: string, shareToFeed: boolean): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(postId).success) return { ok: false };
  const { member } = await getStudioContext();
  if (!member) return { ok: false };
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .update({ share_to_feed: Boolean(shareToFeed) })
    .eq("id", postId)
    .eq("studio_id", member.studio.id)
    .not("status", "in", "(published,measured)")
    .select("id");
  if (error || !data.length) return { ok: false };
  revalidatePath("/calendrier");
  return { ok: true };
}

/** « Je publie moi-même » : at its time she gets the Reel and its caption (to add Instagram's music), or the story and her link (to add the link sticker), on WhatsApp. */
export async function setPublishByHand(postId: string, byHand: boolean): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(postId).success) return { ok: false };
  const { member } = await getStudioContext();
  if (!member) return { ok: false };
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .update({ publish_by_hand: Boolean(byHand), handoff_at: null, handoff_via: null })
    .eq("id", postId)
    .eq("studio_id", member.studio.id)
    .in("kind", ["reel", "story"])
    .not("status", "in", "(published,measured)")
    .select("id");
  if (error || !data.length) return { ok: false };
  revalidatePath(`/publications/${postId}`);
  return { ok: true };
}

/**
 * A look over the whole video (looks.ts): « none », a preset (« vhs »), or her words, designed into its settings
 * (« pellicule Kodak des années 70 »); a new version of the same cut, the video made again after the answer
 * (about a minute, free; the music stays). Answers its name, and what it does instead of what a look cannot do.
 */
export async function setLook(postId: string, words: string): Promise<{ ok: boolean; name?: string; note?: string }> {
  if (!z.uuid().safeParse(postId).success || !words.trim() || words.length > 300) return { ok: false };
  const { db, member } = await getStudioContext();
  if (!member) return { ok: false };
  const studioId = member.studio.id;
  const { data: post } = await db
    .from("posts")
    .select("edit_plan_id")
    .eq("id", postId)
    .eq("studio_id", studioId)
    .in("kind", ["reel", "story"])
    .not("status", "in", "(published,measured)")
    .maybeSingle();
  if (!post?.edit_plan_id) return { ok: false };
  const { data: current } = await supabaseAdmin().from("edit_plans").select("plan").eq("id", post.edit_plan_id as string).eq("studio_id", studioId).maybeSingle();
  const plan = editPlanSchema.safeParse(current?.plan);
  // A video drawn image by image by the effects workshop: its look is a correction of the effect.
  if (!plan.success || isBaked(plan.data)) return { ok: false };
  const chosen = await resolveLook(studioId, words);
  if ("missed" in chosen) return { ok: false };
  const named = { ...(chosen.look ? { name: chosen.look.name } : {}), ...(chosen.note ? { note: chosen.note } : {}) };
  if (sameLook(planLook(plan.data), chosen.look)) return { ok: true, ...named };
  const { effect: _preset, look: _old, ...cut } = plan.data;
  const { id } = await insertPlanVersion(studioId, postId, chosen.look ? { ...cut, look: chosen.look } : cut);
  const { error } = await supabaseAdmin().from("posts").update({ edit_plan_id: id }).eq("id", postId).eq("studio_id", studioId);
  if (error) return { ok: false };
  after(() =>
    renderPost(studioId, postId).then(
      () => revalidatePath(`/publications/${postId}`),
      (e: unknown) => console.error("setLook: render failed", postId, e),
    ),
  );
  revalidatePath(`/publications/${postId}`);
  return { ok: true, ...named };
}

/**
 * Edith's music on a Reel: on, off, or another piece. The video is made again
 * after the answer (about a minute), with the new music or none.
 */
export async function setMusic(postId: string, mode: "on" | "off" | "another"): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(postId).success || !["on", "off", "another"].includes(mode)) return { ok: false };
  const { db, member } = await getStudioContext();
  if (!member) return { ok: false };
  const studioId = member.studio.id;
  const { data: post } = await db.from("posts").select("music, edit_plan_id").eq("id", postId).eq("studio_id", studioId).eq("kind", "reel").maybeSingle();
  if (!post?.edit_plan_id) return { ok: false };
  const music = readPostMusic(post.music);
  const { error } = await supabaseAdmin()
    .from("posts")
    .update({ music: { ...music, mode: mode === "off" ? "off" : "on" } })
    .eq("id", postId)
    .eq("studio_id", studioId)
    .not("status", "in", "(published,measured)");
  if (error) return { ok: false };
  after(() =>
    renderPost(studioId, postId, { freshMusic: mode === "another" }).then(
      () => revalidatePath(`/publications/${postId}`),
      (e: unknown) => console.error("setMusic: render failed", postId, e),
    ),
  );
  revalidatePath(`/publications/${postId}`);
  return { ok: true };
}

/**
 * A Reel without its voice over (Edith's or her own voice note): the montage keeps
 * its cut, the video is made again after the answer (about a minute, free).
 */
export async function setVoiceOff(postId: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(postId).success) return { ok: false };
  const { db, member } = await getStudioContext();
  if (!member) return { ok: false };
  const studioId = member.studio.id;
  const { data: post } = await db.from("posts").select("id").eq("id", postId).eq("studio_id", studioId).eq("kind", "reel").not("status", "in", "(published,measured)").maybeSingle();
  if (!post) return { ok: false };
  const again = await removeVoice(studioId, postId).catch((e: unknown) => {
    console.error("setVoiceOff failed", postId, e);
    return null;
  });
  if (again === null) return { ok: false };
  if (again === "agent") {
    // The voice is drawn in the effect's video: the agent makes it again without it (a correction, charged on delivery).
    const accepted = await correctionQuote(studioId, postId, EFFECT_VOICE_OUT);
    if ("error" in accepted) return { ok: false };
    after(() => startMontage(studioId, accepted, { request: { via: "page", lines: [{ who: "elle", text: "« Sans voix »" }] } }));
  } else if (again) {
    after(() =>
      renderPost(studioId, postId).then(
        () => revalidatePath(`/publications/${postId}`),
        (e: unknown) => console.error("setVoiceOff: render failed", postId, e),
      ),
    );
  }
  revalidatePath(`/publications/${postId}`);
  return { ok: true };
}
