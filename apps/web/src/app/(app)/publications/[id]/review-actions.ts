"use server";

import { findVoice, isBaked, readPostVoice, RESTYLE, TRIAL_DAYS, type EditPlan, type ReelInputs, type SavedLook } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { studioAccess } from "@/lib/billing/access";
import { startEffectWords } from "@/lib/effect-words";
import { loadEditorData } from "@/lib/montage-editor-data";
import { correctionQuote, startMontage } from "@/lib/montage-start";
import { forgetModel, keepAsModel, type ModelState } from "@/lib/reel-models";
import { loadTextLooks } from "@/lib/text-looks";
import { removeVoice } from "@/lib/voice-over";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The changes of « Ta publication » that Simone makes (a new version of the Reel, about
// two minutes) or that move it in time. Confirmed on the page, with what she adds in her
// own words if she wants; charged at delivery like any montage; the version before stays,
// one tap away.

export type ReviewResult = { ok: true } | { ok: false; error: string };

const LOCKED = ["published", "measured"];
const UNKNOWN: { ok: false; error: string } = { ok: false, error: "Publication introuvable." };
const ONLINE: { ok: false; error: string } = { ok: false, error: "Ce Reel est déjà en ligne : il ne peut plus changer." };

/** For this Reel only: her style for the next ones is learned elsewhere (« Ça te ressemble ? », Simone). */
const REDO_BRIEFS = {
  shorter:
    "La gérante veut ce Reel plus court. Garde le même sujet, l'accroche et la fin (l'invitation, l'offre) ; retire les plans les moins forts et raccourcis les autres : environ un tiers de moins au total, jamais sous 7 secondes.",
  punchier: RESTYLE.punchier.brief,
} as const;
/** The buttons she taps for them, as her request keeps them. */
const REDO_LABELS: Record<keyof typeof REDO_BRIEFS, string> = { shorter: "Plus court", punchier: "Plus rythmé" };

/** What she adds in her words (« garde le plan du shampoing »), passed with the request. */
const noteOf = (note: string | undefined) => (note ?? "").trim().replace(/\s+/g, " ").slice(0, 300);

async function reel(postId: string) {
  if (!z.uuid().safeParse(postId).success) return null;
  const { member } = await getStudioContext();
  if (!member) return null;
  const { data } = await supabaseAdmin()
    .from("posts")
    .select("id, kind, status, edit_plan_id, voice_media_id, voice_over")
    .eq("id", postId)
    .eq("studio_id", member.studio.id)
    .maybeSingle();
  return data ? { studioId: member.studio.id, post: data } : null;
}

const touched = (postId: string) => {
  revalidatePath(`/publications/${postId}`);
  revalidatePath(`/v/${postId}`);
  revalidatePath("/grille");
  revalidatePath("/calendrier");
};

/** A corrected version of the montage, started at once (her tap is her yes); `said`: what she tapped and wrote, kept with its request. */
async function correct(studioId: string, postId: string, brief: string, said: string): Promise<ReviewResult> {
  const accepted = await correctionQuote(studioId, postId, brief);
  if ("error" in accepted) return { ok: false, error: accepted.error };
  after(() => startMontage(studioId, accepted, { request: { via: "page", lines: [{ who: "elle", text: said }] } }));
  touched(postId);
  return { ok: true };
}

/** Her own words on the texts of an effect: its kit draws the effect again with them, free; the page follows the new version. */
export async function saveEffectWords(postId: string, changes: { id: string; text: string }[]): Promise<ReviewResult> {
  const parsed = z
    .array(z.object({ id: z.string().max(40), text: z.string().max(400) }))
    .min(1)
    .max(12)
    .safeParse(changes);
  if (!parsed.success) return { ok: false, error: "Tes mots n’ont pas pu être lus." };
  const found = await reel(postId);
  if (!found) return UNKNOWN;
  if (LOCKED.includes(found.post.status as string)) return ONLINE;
  // She sees the Reel before she changes it (its page waits for her subscription).
  if (!(await studioAccess(found.studioId)).unlock) return { ok: false, error: `Pour voir ce Reel et changer ses mots, démarre ton essai : ${TRIAL_DAYS} jours offerts.` };
  const started = await startEffectWords(found.studioId, postId, parsed.data);
  if (!started.ok) return started;
  touched(postId);
  return { ok: true };
}

/** « Plus court », « Plus rythmé »: Simone remakes the Reel that way, with her précision if she gave one. */
export async function redoReel(postId: string, kind: keyof typeof REDO_BRIEFS, note?: string): Promise<ReviewResult> {
  if (!Object.hasOwn(REDO_BRIEFS, kind)) return UNKNOWN;
  const found = await reel(postId);
  if (!found) return UNKNOWN;
  if (LOCKED.includes(found.post.status as string)) return ONLINE;
  if (!found.post.edit_plan_id) return { ok: false, error: "Ce Reel n’est pas encore monté." };
  const extra = noteOf(note);
  return correct(found.studioId, postId, extra ? `${REDO_BRIEFS[kind]} Précision de la gérante : ${extra}` : REDO_BRIEFS[kind], `« ${REDO_LABELS[kind]} »${extra ? ` : ${extra}` : ""}`);
}

/** One of Simone's voices on the Reel (what it should say, if she said): kept on the post, then a new version cut on it. */
export async function putVoice(postId: string, voiceId: string, note?: string): Promise<ReviewResult> {
  const voice = findVoice(voiceId);
  if (!voice) return { ok: false, error: "Cette voix n’existe pas." };
  const found = await reel(postId);
  if (!found) return UNKNOWN;
  const { studioId, post } = found;
  if (post.kind !== "reel") return { ok: false, error: "La voix off se met sur un Reel." };
  if (LOCKED.includes(post.status as string)) return ONLINE;
  const db = supabaseAdmin();
  let onReel = post.voice_media_id ? (await db.from("media_assets").select("source").eq("id", post.voice_media_id as string).maybeSingle()).data : null;
  // Her own voice note gives way to the voice she picked here (the next version is cut on it).
  if (onReel && onReel.source !== "ai") {
    await removeVoice(studioId, postId);
    onReel = null;
  }
  const current = readPostVoice(post.voice_over);
  const extra = noteOf(note);
  const wish = extra || current?.wish;
  // Another voice than Simone's one on the Reel (or the same with new words): it is made again, once.
  const { error } = await db
    .from("posts")
    .update({ voice_over: { mode: "on", voice_id: voice.id, ...(wish ? { wish } : {}), ...(onReel ? { remake: true } : {}) } })
    .eq("id", postId)
    .eq("studio_id", studioId);
  if (error) return { ok: false, error: "La voix n’a pas pu être enregistrée. Réessaie." };
  if (!post.edit_plan_id) {
    touched(postId);
    return { ok: true };
  }
  return correct(
    studioId,
    postId,
    `La gérante veut la voix off de ${voice.name} sur ce Reel.${extra ? ` Ce qu'elle veut que la voix dise : ${extra}.` : ""} Garde le même sujet, l'accroche et les plans, et cale le montage sur la voix.`,
    `« Voix off : ${voice.name} »${extra ? ` : ${extra}` : ""}`,
  );
}

export type LiveMontage = { ok: true; plan: EditPlan; inputs: ReelInputs; looks: SavedLook[] } | { ok: false; error: string };

/**
 * What « Modifier » plays live in the browser (the same composition as the render): the
 * montage as saved, its files signed, and the studio's text styles. Loaded when she opens
 * it, so the page itself stays light.
 */
export async function liveMontage(postId: string): Promise<LiveMontage> {
  const found = await reel(postId);
  if (!found) return UNKNOWN;
  if (LOCKED.includes(found.post.status as string)) return ONLINE;
  const db = supabaseAdmin();
  const planId =
    (found.post.edit_plan_id as string | null) ??
    ((await db.from("edit_plans").select("id").eq("post_id", postId).order("version", { ascending: false }).limit(1).maybeSingle()).data?.id as string | undefined) ??
    null;
  if (!planId) return { ok: false, error: "Ce Reel n’a pas encore de montage." };
  const [editor, looks] = await Promise.all([loadEditorData(found.studioId, planId).catch(() => null), loadTextLooks(found.studioId).catch(() => [])]);
  if (!editor) return { ok: false, error: "Ce montage ne se modifie pas ici : demande à Simone." };
  // Its effect and its texts are drawn in the image: only Simone remakes them.
  if (isBaked(editor.plan)) return { ok: false, error: "Ce Reel a un effet dessiné image par image : dis à Simone ce que tu veux changer." };
  return { ok: true, plan: editor.plan, inputs: editor.inputs, looks };
}

/**
 * « Garder comme modèle »: a Reel of hers she likes, to make new ones like it (Créer › Style).
 * Free; its video is read once in the background, a minute or two. Online Reels too: those are the ones that worked.
 */
export async function keepModel(postId: string): Promise<{ ok: true; model: ModelState } | { ok: false; error: string }> {
  const found = await reel(postId);
  if (!found || found.post.kind !== "reel") return UNKNOWN;
  const access = await studioAccess(found.studioId);
  if (!access.subscribed) return { ok: false, error: `Démarre ton essai pour garder tes Reels comme modèles : ${TRIAL_DAYS} jours offerts.` };
  const kept = await keepAsModel(found.studioId, postId);
  if ("error" in kept) return { ok: false, error: kept.error };
  touched(postId);
  return { ok: true, model: kept };
}

/** No longer a model (the Reels already made like it stay as they are). */
export async function dropModel(postId: string): Promise<ReviewResult> {
  const found = await reel(postId);
  if (!found) return UNKNOWN;
  await forgetModel(found.studioId, postId);
  touched(postId);
  revalidatePath("/style");
  return { ok: true };
}

/** « Revenir à l'ancienne »: the version before, with its video, becomes the one that goes out. Free and instant. */
export async function restoreVersion(postId: string, version: number): Promise<ReviewResult> {
  if (!Number.isInteger(version) || version < 1) return UNKNOWN;
  const found = await reel(postId);
  if (!found) return UNKNOWN;
  if (LOCKED.includes(found.post.status as string)) return ONLINE;
  const db = supabaseAdmin();
  const plan = (await db.from("edit_plans").select("id").eq("post_id", postId).eq("version", version).maybeSingle()).data;
  const render = plan
    ? (await db.from("renders").select("id").eq("edit_plan_id", plan.id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle()).data
    : null;
  if (!plan || !render) return { ok: false, error: "Cette version n’a plus sa vidéo." };
  const { error } = await db.from("posts").update({ edit_plan_id: plan.id, render_id: render.id }).eq("id", postId).eq("studio_id", found.studioId);
  if (error) return { ok: false, error: "Le retour en arrière a échoué. Réessaie." };
  touched(postId);
  return { ok: true };
}

const MIN_AHEAD_MS = 2 * 60_000;
const MAX_AHEAD_MS = 180 * 86_400_000;

/** Another day or hour for it to go out (a scheduled post keeps its place in the queue). */
export async function reschedule(postId: string, iso: string): Promise<ReviewResult> {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Cette date n’est pas valide." };
  if (at.getTime() < Date.now() + MIN_AHEAD_MS) return { ok: false, error: "Choisis un moment à venir." };
  if (at.getTime() > Date.now() + MAX_AHEAD_MS) return { ok: false, error: "Choisis une date dans les six prochains mois." };
  const found = await reel(postId);
  if (!found) return UNKNOWN;
  if (LOCKED.includes(found.post.status as string)) return ONLINE;
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .update({ scheduled_at: at.toISOString() })
    .eq("id", postId)
    .eq("studio_id", found.studioId)
    .not("status", "in", "(published,measured)")
    // Not while it is going out.
    .is("publish_started_at", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "La date n’a pas pu changer. Réessaie." };
  touched(postId);
  return { ok: true };
}
