"use server";

import { assertTransition, editPlanSchema, isClipSegment, postStatusSchema, slidesPlanSchema, type PostStatus } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { DeleteResult } from "@/components/delete-button";
import { scheduleValidated } from "@/lib/posts";
import { renderPost } from "@/lib/render/render-post";
import { renderSlides, saveSlides } from "@/lib/render/slides";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
 * "validated", then schedules it on Instagram when the studio is connected and
 * the video is rendered (published by the worker at scheduled_at, or now).
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
  if (patch.status !== "validated") return { status: "ok", message: "Légende enregistrée." };
  const scheduled = await scheduleValidated(member.studio.id, post.id);
  return {
    status: "ok",
    message:
      scheduled === "now"
        ? "C’est validé : Fauve le publie sur Instagram maintenant."
        : scheduled
          ? `C’est validé : Fauve le publie sur Instagram le ${scheduled}.`
          : "C’est validé. Connecte Instagram (Réglages) pour que Fauve le publie.",
  };
}

/**
 * Deletes a post from Fauve, with its montage plans, renders (and their video
 * files) and quotes. A post already on Instagram stays there.
 */
export async function deletePost(postId: string): Promise<DeleteResult> {
  if (!z.uuid().safeParse(postId).success) return { ok: false, error: "Publication introuvable." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const db = supabaseAdmin();

  const { data: post } = await db.from("posts").select("id, status, publish_started_at").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post) return { ok: false, error: "Publication introuvable." };
  if (post.status === "scheduled" && post.publish_started_at) {
    return { ok: false, error: "Elle est en train de partir sur Instagram : réessaie dans une minute." };
  }

  // The renders go with their plans (cascade); their files must be removed by hand.
  const { data: plans } = await db.from("edit_plans").select("id").eq("post_id", postId);
  const planIds = (plans ?? []).map((p) => p.id as string);
  const { data: renders } = planIds.length ? await db.from("renders").select("storage_path").in("edit_plan_id", planIds) : { data: [] };
  const files = (renders ?? []).map((r) => r.storage_path as string | null).filter((p): p is string => Boolean(p?.startsWith(`${studioId}/`)));

  const { error } = await db.from("posts").delete().eq("id", postId).eq("studio_id", studioId);
  if (error) {
    console.warn("deletePost failed", error.message);
    return { ok: false, error: "La suppression n’a pas abouti. Réessaie dans un instant." };
  }
  if (files.length) await db.storage.from("media").remove(files).catch(() => {});

  revalidatePath("/publications");
  revalidatePath("/calendrier");
  revalidatePath("/grille");
  revalidatePath("/fauve");
  return { ok: true };
}

export type SavePlanResult = { ok: true; version: number } | { ok: false; error: string };

/**
 * Saves a montage edited by hand (scene editor) as a new version of its plan,
 * then renders it in the background. Free: no AI involved. Animation code
 * cannot be changed here, only reused from this post's versions.
 */
export async function saveEditPlan(postId: string, input: unknown): Promise<SavePlanResult> {
  if (!z.uuid().safeParse(postId).success) return { ok: false, error: "Publication introuvable." };
  const parsed = editPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ce montage n’est pas valide : vérifie les durées et les textes." };
  const plan = parsed.data;

  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const db = supabaseAdmin();

  const { data: post } = await db.from("posts").select("id, status").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post) return { ok: false, error: "Publication introuvable." };
  if (LOCKED.includes(postStatusSchema.parse(post.status))) return { ok: false, error: "Cette publication est déjà en ligne." };

  // Clips: the studio's own media only.
  const clipIds = [...new Set(plan.segments.filter(isClipSegment).map((s) => s.clip_id))];
  if (clipIds.length) {
    const { data } = await db.from("media_assets").select("id").eq("studio_id", studioId).in("id", clipIds);
    if ((data?.length ?? 0) !== clipIds.length) return { ok: false, error: "Une des vidéos n’est plus dans ta médiathèque." };
  }
  // Animations: code already made for this post (by Fauve), never new code from the browser.
  const { data: versions } = await db.from("edit_plans").select("version, plan").eq("post_id", postId);
  const knownCode = new Set(
    (versions ?? []).flatMap((v) =>
      ((v.plan as { segments?: { motion?: { js?: string } }[] } | null)?.segments ?? []).flatMap((s) => (s.motion?.js ? [s.motion.js] : [])),
    ),
  );
  const unknown = plan.segments.some((s) => "motion" in s && s.motion.js && !knownCode.has(s.motion.js));
  if (unknown) return { ok: false, error: "Une animation a été modifiée d’une façon que l’éditeur ne permet pas." };

  const version = Math.max(0, ...(versions ?? []).map((v) => v.version as number)) + 1;
  const { data: row, error } = await db.from("edit_plans").insert({ studio_id: studioId, post_id: postId, version, plan }).select("id").single();
  if (error) {
    console.warn("saveEditPlan failed", error.message);
    return { ok: false, error: "L’enregistrement a échoué. Réessaie dans un instant." };
  }
  await db.from("posts").update({ edit_plan_id: row.id }).eq("id", postId);
  // The final video follows in about a minute; the editor already shows it live.
  after(() =>
    renderPost(studioId, postId).then(
      () => revalidatePath(`/publications/${postId}`),
      (e) => console.error("saveEditPlan: render failed", postId, e),
    ),
  );
  revalidatePath(`/publications/${postId}`);
  return { ok: true, version };
}

/**
 * Text over the photos (carousel or photo post), set by hand: saved, then the
 * images are rendered in the background (about a minute), free.
 */
export async function saveSlidesPlan(postId: string, input: unknown): Promise<SavePlanResult> {
  if (!z.uuid().safeParse(postId).success) return { ok: false, error: "Publication introuvable." };
  const parsed = slidesPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Un des textes n’est pas valide : vérifie qu’il n’est pas vide." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const { data: post } = await supabaseAdmin().from("posts").select("id, status").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post) return { ok: false, error: "Publication introuvable." };
  if (LOCKED.includes(postStatusSchema.parse(post.status))) return { ok: false, error: "Cette publication est déjà en ligne." };
  try {
    await saveSlides(studioId, postId, parsed.data);
  } catch (error) {
    console.warn("saveSlidesPlan failed", error);
    return { ok: false, error: "L’enregistrement a échoué. Réessaie dans un instant." };
  }
  after(() =>
    renderSlides(studioId, postId).then(
      () => revalidatePath(`/publications/${postId}`),
      (e) => console.error("saveSlidesPlan: render failed", postId, e),
    ),
  );
  revalidatePath(`/publications/${postId}`);
  return { ok: true, version: 0 };
}
