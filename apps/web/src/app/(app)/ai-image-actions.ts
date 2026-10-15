"use server";

import { aiImageFormatSchema, MAX_AMBIANCE_IMAGES, PHOTO_IMPROVEMENTS, type AiImageFormat } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { AiImageError, canAffordImages, improvePhoto, makeAmbiance, placeOnPost } from "@/lib/ai-images";
import { renderSlides } from "@/lib/render/slides";
import { getStudioContext } from "@/lib/studio";

// Images by the image model from the app: « Améliorer avec Simone » under a photo
// of the carousel editor (the improved photo takes its place on the post) and
// « Image d'ambiance » in the library. 1 credit an image, charged once it is made.

type Result = { ok: true; count: number } | { ok: false; error: string };

const failure = (error: unknown): Result => {
  if (error instanceof AiImageError) return { ok: false, error: error.message };
  console.error("ai image failed", error);
  return { ok: false, error: "Simone n’a pas réussi cette image. Réessaie dans un instant ; aucun crédit n’a été débité." };
};

/** Improves a photo of a carousel or photo post, one of the quick ones or her own words; it replaces the original on the post. */
export async function improvePostPhoto(postId: string, mediaId: string, change: string): Promise<Result> {
  const parsed = z.object({ postId: z.uuid(), mediaId: z.uuid(), change: z.string().trim().min(3).max(400) }).safeParse({ postId, mediaId, change });
  if (!parsed.success) return { ok: false, error: "Dis en quelques mots ce qu’il faut changer." };
  const { db, member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const { data: post } = await db.from("posts").select("kind, media_ids").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post || !((post.media_ids as string[] | null) ?? []).includes(mediaId)) return { ok: false, error: "Cette photo n’est plus sur la publication." };
  const affordable = await canAffordImages(studioId, 1);
  if (!affordable.ok) return { ok: false, error: `Pas assez de crédits : ${affordable.error}` };
  const quick = PHOTO_IMPROVEMENTS[parsed.data.change as keyof typeof PHOTO_IMPROVEMENTS];
  const format: AiImageFormat = post.kind === "story" ? "9:16" : "4:5";
  try {
    const made = await improvePhoto(studioId, mediaId, quick?.instruction ?? parsed.data.change, format);
    const { render } = await placeOnPost(studioId, postId, [made], mediaId);
    if (render) after(() => renderSlides(studioId, postId).then(() => undefined, (e) => console.error("slides render after ai image failed", e)));
    revalidatePath(`/publications/${postId}`);
    return { ok: true, count: 1 };
  } catch (error) {
    return failure(error);
  }
}

/** Ambiance images for her library (1 to 4), in her colours. */
export async function createAmbianceImages(description: string, format: string, count: number): Promise<Result> {
  const parsed = z
    .object({ description: z.string().trim().min(3).max(400), format: aiImageFormatSchema, count: z.number().int().min(1).max(MAX_AMBIANCE_IMAGES) })
    .safeParse({ description, format, count });
  if (!parsed.success) return { ok: false, error: "Décris en quelques mots l’image que tu veux." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const affordable = await canAffordImages(studioId, parsed.data.count);
  if (!affordable.ok) return { ok: false, error: `Pas assez de crédits : ${affordable.error}` };
  try {
    const made = await makeAmbiance(studioId, parsed.data.description, parsed.data.format, parsed.data.count);
    revalidatePath("/mediatheque");
    return { ok: true, count: made.length };
  } catch (error) {
    return failure(error);
  }
}
