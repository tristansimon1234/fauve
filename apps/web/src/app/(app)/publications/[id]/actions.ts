"use server";

import { bakedReel, insertPlanVersion } from "@/lib/edit-plans";
import {
  assertTransition,
  editPlanSchema,
  planMediaIds,
  postStatusSchema,
  replaySkillAudio,
  slidesPlanSchema,
  slotTextLimit,
  type EditPlan,
  type MusicShape,
  type PostStatus,
  type SfxCue,
} from "@fauve/agent";
import { skillFor } from "@fauve/agent/skills";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { DeleteResult } from "@/components/delete-button";
import { removePost } from "@/lib/delete-post";
import { NOT_SCHEDULED, scheduleValidated } from "@/lib/posts";
import { knownLayerCode, renderSlides, saveSlides } from "@/lib/render/slides";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { queueRerender } from "@/lib/rerender";

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
 * With "with_hashtags", the caption was written over as the page shows it, the
 * post's hashtags in it: it holds the ones she kept, so the list is emptied.
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
    .select("id, status, caption, hashtags")
    .eq("id", parsed.data.postId)
    .eq("studio_id", member.studio.id)
    .maybeSingle();
  if (readError) return { status: "error", message: "Impossible de lire la publication. Réessaie dans un instant." };
  if (!post) return { status: "error", message: "Publication introuvable." };

  const status = postStatusSchema.parse(post.status);
  if (LOCKED.includes(status)) {
    return { status: "error", message: "Cette publication est déjà en ligne : elle ne peut plus être modifiée ici." };
  }

  const patch: { caption?: string | null; hashtags?: string[]; status?: PostStatus } = {};
  if (caption !== (post.caption ?? "")) patch.caption = caption || null;
  // A hashtag she took out of the caption would come back from the list.
  if (formData.get("with_hashtags") === "1" && patch.caption !== undefined && (post.hashtags as string[] | null)?.length) patch.hashtags = [];
  const validating = intent === "validate";
  // Validated earlier (before Instagram was connected), it goes out on « Publier » too.
  if (validating && status !== "validated") {
    try {
      if (status !== "draft") throw new Error(`not a draft: ${status}`);
      assertTransition(status, "validated");
    } catch {
      return { status: "error", message: "Seul un brouillon prêt peut être validé." };
    }
    patch.status = "validated";
  }
  if (!Object.keys(patch).length && !validating) return { status: "ok", message: "Rien à enregistrer." };

  if (Object.keys(patch).length) {
    // Only apply if nobody (Fauve included) changed the status in the meantime.
    const { data: updated, error } = await supabaseAdmin()
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
  }

  revalidatePath(`/publications/${post.id}`);
  revalidatePath("/publications");
  revalidatePath("/calendrier");
  revalidatePath("/fauve");
  if (!validating) return { status: "ok", message: "Légende enregistrée." };
  const scheduled = await scheduleValidated(member.studio.id, post.id);
  return {
    status: "ok",
    message: !scheduled
      ? "C’est validé."
      : "blocked" in scheduled
        ? NOT_SCHEDULED[scheduled.blocked]
        : "C’est parti : Edith le publie maintenant.",
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
  const removed = await removePost(member.studio.id, postId);
  if (!removed.ok) {
    if (removed.reason === "not_found") return { ok: false, error: "Publication introuvable." };
    if (removed.reason === "publishing") return { ok: false, error: "Elle est en train de partir sur Instagram : réessaie dans une minute." };
    return { ok: false, error: "La suppression n’a pas abouti. Réessaie dans un instant." };
  }

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
  // A video the effects agent drew is never changed by hand (nor marked as one from the browser).
  if (plan.baked || (await bakedReel(studioId, postId))) return { ok: false, error: "Ce Reel a un effet dessiné image par image : dis à Edith ce que tu veux changer." };

  // Clips, the footage under animations and the photos they compose with: the studio's own media only.
  const clipIds = planMediaIds(plan);
  if (clipIds.length) {
    const { data } = await db.from("media_assets").select("id").eq("studio_id", studioId).in("id", clipIds);
    if ((data?.length ?? 0) !== clipIds.length) return { ok: false, error: "Une des vidéos n’est plus dans ta médiathèque." };
  }
  // The photos she added on it: her own photos only.
  const overlayIds = [...new Set((plan.overlays ?? []).flatMap((o) => (o.media_id ? [o.media_id] : [])))];
  if (overlayIds.length) {
    const { data } = await db.from("media_assets").select("id").eq("studio_id", studioId).eq("kind", "image").in("id", overlayIds);
    if ((data?.length ?? 0) !== overlayIds.length) return { ok: false, error: "Une des photos ajoutées n’est plus dans ta médiathèque." };
  }
  // Animations (scenes and animations over several shots): code already made for this post (by Fauve), never new code from the browser.
  // The fonts an animation loads, and whether a collage's composition draws the Reel's texts, follow its code, never the browser either.
  const { data: versions } = await db.from("edit_plans").select("id, version, plan").eq("post_id", postId);
  type Coded = { motion?: { js?: string; fonts?: string[]; draws_texts?: boolean; draws_end?: boolean; writes_spoken?: boolean; times_spoken?: boolean; sounds?: SfxCue[] } };
  const knownCode = new Map(
    (versions ?? []).flatMap((v) => {
      const kept = v.plan as { segments?: Coded[]; layers?: Coded[] } | null;
      return [...(kept?.segments ?? []), ...(kept?.layers ?? [])].flatMap((s) => (s.motion?.js ? [[s.motion.js, s.motion] as const] : []));
    }),
  );
  const unknown = [...plan.segments, ...(plan.layers ?? [])].some((s) => "motion" in s && s.motion.js && !knownCode.has(s.motion.js));
  if (unknown) return { ok: false, error: "Une animation a été modifiée d’une façon que l’éditeur ne permet pas." };
  const withKnownFonts = <M extends { js?: string; fonts?: string[]; draws_texts?: boolean; draws_end?: boolean; writes_spoken?: boolean; times_spoken?: boolean; sounds?: SfxCue[] }>(motion: M): M => {
    const known = motion.js ? knownCode.get(motion.js) : undefined;
    const kept = { ...motion };
    delete kept.fonts;
    delete kept.draws_texts;
    delete kept.draws_end;
    delete kept.writes_spoken;
    delete kept.times_spoken;
    delete kept.sounds;
    return {
      ...kept,
      ...(known?.fonts?.length ? { fonts: known.fonts } : {}),
      ...(known?.draws_texts ? { draws_texts: true } : {}),
      ...(known?.draws_end !== undefined ? { draws_end: known.draws_end } : {}),
      // Whether it writes what is said was measured on its code: it follows its code too.
      ...(known?.writes_spoken !== undefined ? { writes_spoken: known.writes_spoken } : {}),
      // A skill timed on her voice reads her words said whatever it writes: set by the engine with its code.
      ...(known?.times_spoken ? { times_spoken: true } : {}),
      // Its sounds follow its code too (each new one is made, and paid, by the server).
      ...(known?.sounds?.length ? { sounds: known.sounds } : {}),
    };
  };
  plan.segments = plan.segments.map((s) => ("motion" in s ? { ...s, motion: withKnownFonts(s.motion) } : s));
  if (plan.layers) plan.layers = plan.layers.map((l) => ({ ...l, motion: withKnownFonts(l.motion) }));
  // The editor's sounds and its music's shape stay those of the version she edits, never the browser's.
  const { data: current } = await db.from("posts").select("edit_plan_id").eq("id", postId).maybeSingle();
  const edited = (versions ?? []).find((v) => v.id === current?.edit_plan_id)?.plan as { sounds?: SfxCue[]; music_shape?: MusicShape; skill?: EditPlan["skill"] } | undefined;
  delete plan.sounds;
  delete plan.music_shape;
  if (edited?.sounds?.length) plan.sounds = edited.sounds;
  if (edited?.music_shape) plan.music_shape = edited.music_shape;
  // A montage skill's follow her words (a key click on each letter of her name as its code types it): computed again on
  // the words she wrote, for the skill of the version she edits, when its cut is the same.
  const skill = skillFor(edited?.skill?.key);
  const replayed = skill && edited?.skill ? replaySkillAudio(skill, { ...plan, skill: edited.skill }) : null;
  if (replayed) {
    const sounds = [...(plan.sounds ?? []).filter((c) => !c.skill), ...(replayed.sounds ?? [])].sort((a, b) => a.at - b.at).slice(0, 40);
    if (sounds.length) plan.sounds = sounds;
    else delete plan.sounds;
    if (replayed.music_shape) plan.music_shape = replayed.music_shape;
    else delete plan.music_shape;
  }

  let row: { id: string; version: number };
  try {
    row = await insertPlanVersion(studioId, postId, plan);
  } catch (error) {
    console.warn("saveEditPlan failed", error);
    return { ok: false, error: "L’enregistrement a échoué. Réessaie dans un instant." };
  }
  const version = row.version;
  await db.from("posts").update({ edit_plan_id: row.id }).eq("id", postId);
  // The final video follows in its own job (a long composition outlasts this request); the editor already shows it live.
  after(() => queueRerender({ studioId, postId, silent: true }));
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
  // A text layer's or a component's code comes from Fauve (this post or the library), never from the browser.
  const layers = parsed.data.slides.flatMap((s) => [...(s.layer ? [s.layer.js] : []), ...(s.elements ?? []).map((e) => e.js)]);
  if (layers.length) {
    const known = await knownLayerCode(studioId, postId);
    if (layers.some((js) => !known.has(js))) return { ok: false, error: "Un calque de texte a été modifié d’une façon que l’éditeur ne permet pas." };
  }
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

/**
 * The words of a composed carousel, changed by hand slot by slot (its layout never comes from the
 * browser): saved, then its slides are rendered again in the background (about a minute), free.
 */
export async function saveCarouselTexts(postId: string, texts: Record<string, string>): Promise<SavePlanResult> {
  if (!z.uuid().safeParse(postId).success) return { ok: false, error: "Publication introuvable." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const { data: post } = await supabaseAdmin().from("posts").select("id, status, slides").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post) return { ok: false, error: "Publication introuvable." };
  if (LOCKED.includes(postStatusSchema.parse(post.status))) return { ok: false, error: "Cette publication est déjà en ligne." };
  const plan = slidesPlanSchema.safeParse(post.slides);
  const design = plan.success ? plan.data.design : undefined;
  if (!plan.success || !design) return { ok: false, error: "Ce carrousel n’a pas de textes à changer ici." };
  const slots = new Map(design.slots.map((s) => [s.name, s]));
  const given = Object.entries(texts);
  if (given.some(([name, text]) => !slots.has(name) || typeof text !== "string")) return { ok: false, error: "Un des textes n’existe pas dans ce carrousel." };
  const tooLong = given.find(([name, text]) => text.length > slotTextLimit(slots.get(name)!));
  if (tooLong) return { ok: false, error: "Un des textes est trop long pour sa place : raccourcis-le, ou demande à Edith de refaire la mise en page." };
  try {
    await saveSlides(studioId, postId, plan.data, { design: { ...design, texts: { ...design.texts, ...Object.fromEntries(given.map(([name, text]) => [name, text.trim()])) } } });
  } catch (error) {
    console.warn("saveCarouselTexts failed", error);
    return { ok: false, error: "L’enregistrement a échoué. Réessaie dans un instant." };
  }
  after(() =>
    renderSlides(studioId, postId).then(
      () => revalidatePath(`/publications/${postId}`),
      (e) => console.error("saveCarouselTexts: render failed", postId, e),
    ),
  );
  revalidatePath(`/publications/${postId}`);
  return { ok: true, version: 0 };
}
