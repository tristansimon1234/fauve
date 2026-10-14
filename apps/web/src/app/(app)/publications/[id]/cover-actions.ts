"use server";

import { postCoverSchema, type PostCover } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudioContext } from "@/lib/studio";

/** Sets a Reel's cover (a frame of its video or one of the studio's photos); null leaves it to Brigitte. */
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
  const { data, error } = await db
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
  const { db, member } = await getStudioContext();
  if (!member) return { ok: false };
  const { data, error } = await db
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

/** « Je publie moi-même » : at its time she gets the Reel and its caption on WhatsApp, to add Instagram's music herself. */
export async function setPublishByHand(postId: string, byHand: boolean): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(postId).success) return { ok: false };
  const { db, member } = await getStudioContext();
  if (!member) return { ok: false };
  const { data, error } = await db
    .from("posts")
    .update({ publish_by_hand: Boolean(byHand), handoff_at: null, handoff_via: null })
    .eq("id", postId)
    .eq("studio_id", member.studio.id)
    .eq("kind", "reel")
    .not("status", "in", "(published,measured)")
    .select("id");
  if (error || !data.length) return { ok: false };
  revalidatePath(`/publications/${postId}`);
  return { ok: true };
}
