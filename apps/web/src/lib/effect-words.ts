import "server-only";
import { editEffectWords, editPlanSchema, effectWords, type EffectWord } from "@fauve/agent";
import { queueJob } from "@/lib/jobs";
import { finishJob, runningJobs, startJob } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her words on a Reel the effects agent drew (Tristan: « quand il y a un effet on peut pas modifier le
// message nous même ? »): the agent leaves its kit (its render script and what it measured) and the
// texts it draws (words.json); she changes them herself, on the page or by asking Simone, and a short
// session draws the effect again with them, free, without designing anything again
// (/api/jobs/effect-words). A Reel without a kit (made before, or the agent left none) keeps the old
// way: her texts change by asking Simone, a correction of the effect.

const MEDIA = "media";

/** An effect's kit, kept by the video it made: the retention removes it with that video. */
export const kitPath = (studioId: string, mediaId: string) => `${studioId}/effects/${mediaId}.tar.gz`;

/** Keeps an effect's kit by its video: its path, or null when it could not be kept (her texts then change by asking Simone). */
export async function keepKit(studioId: string, mediaId: string, tar: Buffer): Promise<string | null> {
  const path = kitPath(studioId, mediaId);
  const { error } = await supabaseAdmin().storage.from(MEDIA).upload(path, tar, { contentType: "application/gzip", upsert: true });
  if (error) {
    console.warn("effects: kit not kept", mediaId, error.message);
    return null;
  }
  return path;
}

/** The same kit for the video drawn again with her words: each video keeps its own (removed with it). */
export async function copyKit(studioId: string, from: string, mediaId: string): Promise<string | null> {
  const path = kitPath(studioId, mediaId);
  const { error } = await supabaseAdmin().storage.from(MEDIA).copy(from, path);
  if (error) {
    console.warn("effects: kit not copied", mediaId, error.message);
    return null;
  }
  return path;
}

/** Where the words were changed: the page (it shows the new video by itself) or the chat (Simone delivers it). */
export type EffectWordsTarget = { conversationId?: string; waId?: string; replyTo?: string; tell?: boolean };

/**
 * Her new words on the post's effect: checked against its kit's texts, then drawn again in the
 * background. What to tell her when they cannot be. Her access is checked by who asks (the page,
 * Simone's tools): a lab studio has none.
 */
export async function startEffectWords(
  studioId: string,
  postId: string,
  changes: { id: string; text: string }[],
  target: EffectWordsTarget = {},
): Promise<{ ok: true; words: EffectWord[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("edit_plan_id, status").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post?.edit_plan_id) return { ok: false, error: "Ce Reel n’a pas encore de vidéo." };
  if (post.status === "published" || post.status === "measured") return { ok: false, error: "Ce Reel est déjà en ligne : ses mots ne changent plus." };
  const { data: row } = await db.from("edit_plans").select("plan").eq("id", post.edit_plan_id as string).maybeSingle();
  const plan = editPlanSchema.safeParse(row?.plan);
  const current = plan.success ? effectWords(plan.data) : [];
  if (!current.length) return { ok: false, error: "Les mots de cet effet ne se changent pas ici : dis à Simone ce que tu veux changer." };
  if ((await runningJobs(studioId, { postId })).length) return { ok: false, error: "Simone travaille déjà sur ce Reel : réessaie quand c’est prêt." };
  const words = editEffectWords(current, changes);
  if ("error" in words) return { ok: false, error: words.error };
  const jobId = await startJob({ studioId, postId, kind: "effect_words", stage: "render" });
  try {
    await queueJob("effect-words", { jobId, studioId, postId, planId: post.edit_plan_id, words, step: "start", ...target });
  } catch (error) {
    await finishJob(jobId, true);
    throw error;
  }
  return { ok: true, words };
}
