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
