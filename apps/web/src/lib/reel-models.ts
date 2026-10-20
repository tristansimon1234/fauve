import "server-only";
import { randomUUID } from "node:crypto";
import { editPlanSchema, planOutline, stolenStyleLines, stolenStyleSchema } from "@fauve/agent";
import { queueJob } from "@/lib/jobs";
import { MODEL_SOURCE, READING_MS } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her own Reels as models (Tristan : « ça serait bien de pouvoir enregistrer des modèles pour
// le user aussi ? »): on « Ta publication », « Garder comme modèle » keeps a Reel of hers she
// likes; on the Créer screen, « Comme mon Reel … » makes a new one the same way with her new
// images (posts.inspiration_id). A model is an inspiration (source « model », external_id = the
// post): its video copied and read once like a Reel to copy (« Steal »: the job in quiet mode,
// nothing said in the chat), its plan's structure kept with its reading (planOutline). Never one
// shot: it stays until she removes it.

/** Where a Reel kept as a model is: being read, kept (what a new Reel takes from it), or not readable. */
export type ModelState = { state: "reading" } | { state: "kept"; name: string; lines: string[] } | { state: "missed" };

/** A model to make a new Reel from, for the Créer screen. */
export type ReelModel = { id: string; title: string; name: string; lines: string[] };

async function latest(studioId: string, postId: string) {
  const { data } = await supabaseAdmin()
    .from("inspirations")
    .select("id, style, analysis, storage_path, created_at")
    .eq("studio_id", studioId)
    .eq("source", MODEL_SOURCE)
    .eq("external_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function stateOf(row: { style: unknown; analysis: unknown; created_at: unknown }): ModelState {
  const style = stolenStyleSchema.safeParse(row.style);
  if (style.success) return { state: "kept", name: style.data.look.name, lines: stolenStyleLines(style.data) };
  const missed = Boolean((row.style as { miss?: unknown } | null)?.miss);
  return !missed && !row.analysis && Date.now() - Date.parse(row.created_at as string) < READING_MS ? { state: "reading" } : { state: "missed" };
}

/** This Reel as a model, when it is one. */
export async function modelState(studioId: string, postId: string): Promise<ModelState | null> {
  const row = await latest(studioId, postId);
  return row ? stateOf(row) : null;
}

/**
 * Keeps one of her Reels as a model: its video copied for its reading, its plan's structure
 * kept with it, then read in the background. Already kept, it stays; one that could not be
 * read is read again.
 */
export async function keepAsModel(studioId: string, postId: string): Promise<ModelState | { error: string }> {
  const db = supabaseAdmin();
  const known = await latest(studioId, postId);
  if (known) {
    const state = stateOf(known);
    if (state.state !== "missed") return state;
    await db.from("inspirations").delete().eq("id", known.id).eq("studio_id", studioId);
    if (known.storage_path) await db.storage.from("media").remove([known.storage_path as string]).catch(() => {});
  }
  const { data: post } = await db.from("posts").select("kind, title, render_id, edit_plan_id").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post || post.kind !== "reel" || !post.render_id) return { error: "Ce Reel n’a pas encore sa vidéo." };
  const [{ data: render }, { data: plan }] = await Promise.all([
    db.from("renders").select("storage_path, status").eq("id", post.render_id).maybeSingle(),
    post.edit_plan_id ? db.from("edit_plans").select("plan").eq("id", post.edit_plan_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!render?.storage_path || render.status !== "done") return { error: "Ce Reel n’a pas encore sa vidéo." };
  // Its video is read like a Reel to copy; the copy goes once read, the Reel keeps its own.
  const path = `${studioId}/inspirations/model-${Date.now()}-${randomUUID().slice(0, 8)}.mp4`;
  const copied = await db.storage.from("media").copy(render.storage_path as string, path);
  if (copied.error) return { error: "Je n’arrive pas à garder ce Reel pour l’instant. Réessaie dans un instant." };
  const parsed = editPlanSchema.safeParse(plan?.plan);
  const { data: row, error } = await db
    .from("inspirations")
    .insert({
      studio_id: studioId,
      source: MODEL_SOURCE,
      kind: "reel",
      external_id: postId,
      title: ((post.title as string | null) ?? "").trim().slice(0, 80) || "Ton Reel",
      storage_path: path,
      style: parsed.success ? { outline: planOutline(parsed.data) } : null,
    })
    .select("id")
    .single();
  if (error || !row) {
    await db.storage.from("media").remove([path]).catch(() => {});
    return { error: "Je n’arrive pas à garder ce Reel pour l’instant. Réessaie dans un instant." };
  }
  try {
    await queueJob("steal", { studioId, inspirationId: row.id, quiet: true });
  } catch (e) {
    console.warn("model: reading not queued", e);
    await db.from("inspirations").update({ style: { miss: "unreadable" } }).eq("id", row.id);
    return { state: "missed" };
  }
  return { state: "reading" };
}

/** No longer a model: the Reels already made like it keep what they took. */
export async function forgetModel(studioId: string, postId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db.from("inspirations").delete().eq("studio_id", studioId).eq("source", MODEL_SOURCE).eq("external_id", postId).select("storage_path");
  const paths = (data ?? []).flatMap((r) => (r.storage_path ? [r.storage_path as string] : []));
  if (paths.length) await db.storage.from("media").remove(paths).catch(() => {});
}

/** Her Reels kept as models and read, the latest first: what a new Reel can be made like. */
export async function studioModels(studioId: string, limit = 8): Promise<ReelModel[]> {
  const { data } = await supabaseAdmin()
    .from("inspirations")
    .select("id, title, style")
    .eq("studio_id", studioId)
    .eq("source", MODEL_SOURCE)
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  return (data ?? [])
    .flatMap((row) => {
      const style = stolenStyleSchema.safeParse(row.style);
      return style.success ? [{ id: row.id as string, title: (row.title as string | null) || "Ton Reel", name: style.data.look.name, lines: stolenStyleLines(style.data) }] : [];
    })
    .slice(0, limit);
}
