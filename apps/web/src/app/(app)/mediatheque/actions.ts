"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DeleteResult } from "@/components/delete-button";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Deletes a photo or video: the file, its analysis, and its place in the posts that used it. */
export async function deleteMedia(mediaId: string): Promise<DeleteResult> {
  if (!z.uuid().safeParse(mediaId).success) return { ok: false, error: "Fichier introuvable." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const db = supabaseAdmin();

  const { data: asset } = await db.from("media_assets").select("id, storage_path, original_path").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  if (!asset) return { ok: false, error: "Fichier introuvable." };

  // posts.media_ids is a plain array (no foreign key): take the media out by hand.
  const { data: posts } = await db.from("posts").select("id, media_ids").eq("studio_id", studioId).contains("media_ids", [mediaId]);
  for (const post of posts ?? []) {
    const ids = ((post.media_ids as string[] | null) ?? []).filter((id) => id !== mediaId);
    await db.from("posts").update({ media_ids: ids }).eq("id", post.id);
  }

  const { error } = await db.from("media_assets").delete().eq("id", mediaId).eq("studio_id", studioId);
  if (error) {
    console.warn("deleteMedia failed", error.message);
    return { ok: false, error: "La suppression n’a pas abouti. Réessaie dans un instant." };
  }
  const paths = [asset.storage_path as string, asset.original_path as string | null].filter((p): p is string => Boolean(p?.startsWith(`${studioId}/`)));
  if (paths.length) await db.storage.from("media").remove(paths).catch(() => {});

  revalidatePath("/mediatheque");
  return { ok: true };
}
