"use server";

import { assertTransition, postStatusSchema, type PostStatus } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudioContext } from "@/lib/studio";

export type PostFormState = { status: "idle" } | { status: "ok" | "error"; message: string };

// Instagram's caption limit; TikTok's is larger.
const CAPTION_MAX = 2200;
const LOCKED: readonly PostStatus[] = ["published", "measured"];

const input = z.object({
  postId: z.uuid(),
  intent: z.enum(["save", "validate"]),
  caption: z.string().max(CAPTION_MAX, `La légende dépasse ${CAPTION_MAX} caractères.`),
});

/**
 * Saves the edited caption and, with intent "validate", moves the draft to
 * "validated". Never schedules: publishing is not wired yet.
 */
export async function updatePost(postId: string, _prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const parsed = input.safeParse({
    postId,
    intent: formData.get("intent") ?? "save",
    caption: formData.get("caption") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const { intent } = parsed.data;
  const caption = parsed.data.caption.trim();

  const { db, member } = await getStudioContext();
  if (!member) return { status: "error", message: "Ton numéro n’est relié à aucun studio." };

  const { data: post, error: readError } = await db
    .from("posts")
    .select("id, status, caption")
    .eq("id", parsed.data.postId)
    .eq("studio_id", member.studio.id)
    .maybeSingle();
  if (readError) return { status: "error", message: "Impossible de lire la publication. Réessaie dans un instant." };
  if (!post) return { status: "error", message: "Publication introuvable." };

  const status = postStatusSchema.parse(post.status);
  if (LOCKED.includes(status)) {
    return { status: "error", message: "Cette publication est déjà en ligne : elle ne peut plus être modifiée ici." };
  }

  const patch: { caption?: string | null; status?: PostStatus } = {};
  if (caption !== (post.caption ?? "")) patch.caption = caption || null;
  if (intent === "validate") {
    try {
      if (status !== "draft") throw new Error(`not a draft: ${status}`);
      assertTransition(status, "validated");
    } catch {
      return { status: "error", message: "Seul un brouillon prêt peut être validé." };
    }
    patch.status = "validated";
  }
  if (!Object.keys(patch).length) return { status: "ok", message: "Rien à enregistrer." };

  // Only apply if nobody (Fauve included) changed the status in the meantime.
  const { data: updated, error } = await db
    .from("posts")
    .update(patch)
    .eq("id", post.id)
    .eq("studio_id", member.studio.id)
    .eq("status", status)
    .select("id");
  if (error) {
    console.warn("updatePost failed", error.message);
    return { status: "error", message: "L’enregistrement a échoué. Réessaie dans un instant." };
  }
  if (!updated?.length) {
    return { status: "error", message: "La publication a changé entre-temps. Recharge la page pour voir la dernière version." };
  }

  revalidatePath(`/publications/${post.id}`);
  revalidatePath("/publications");
  revalidatePath("/calendrier");
  revalidatePath("/fauve");
  return {
    status: "ok",
    message: patch.status === "validated" ? "C’est validé." : "Légende enregistrée.",
  };
}
