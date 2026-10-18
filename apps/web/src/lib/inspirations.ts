import "server-only";
import { stealStyle } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readInspiration } from "@/lib/video/inspiration";

// Inspirations: Reels the manager likes, shared on Instagram or added in the app
// (a video or a screenshot). Gemini reads each once; the file itself is not kept
// (it is someone else's content). A post can follow one (posts.inspiration_id).

export type InspirationItem = {
  id: string;
  title: string;
  /** Gemini's reading, first sentence. */
  summary: string | null;
  /** Added in the app and still being watched. */
  reading: boolean;
  source: string;
};

const firstSentence = (text: string) => (text.match(/^.+?[.!?](\s|$)/)?.[0] ?? text).trim().slice(0, 160);

export async function listInspirations(studioId: string, limit = 8): Promise<InspirationItem[]> {
  const { data } = await supabaseAdmin()
    .from("inspirations")
    .select("id, title, analysis, storage_path, source, created_at")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((i) => ({
    id: i.id as string,
    title: (i.title as string | null)?.trim() || "Reel partagé",
    summary: i.analysis ? firstSentence(i.analysis as string) : null,
    reading: !i.analysis && Boolean(i.storage_path),
    source: i.source as string,
  }));
}

/**
 * Watches an inspiration added in the app (once): Gemini's reading is kept, the
 * file is deleted either way. Safe to call twice (the second finds it read).
 */
export async function ensureInspirationRead(studioId: string, id: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db.from("inspirations").select("analysis, storage_path, kind").eq("id", id).eq("studio_id", studioId).maybeSingle();
  if (!data) return null;
  if (data.analysis || !data.storage_path) return (data.analysis as string | null) ?? null;
  // A video: its style measured and read (« Steal »), which her Reels can then follow.
  if (data.kind === "video") {
    const stolen = await stealStyle(studioId, { inspirationId: id }).catch((e: unknown) => (console.warn("inspiration: style not read", e), null));
    if (stolen?.ok) return stolen.lines.join(" ");
  }
  const path = data.storage_path as string;
  const signed = await db.storage.from("media").createSignedUrl(path, 600);
  const analysis = signed.data ? await readInspiration(studioId, signed.data.signedUrl).catch((e) => (console.error("inspiration reading failed", e), null)) : null;
  await db.from("inspirations").update({ analysis, storage_path: null }).eq("id", id).eq("studio_id", studioId);
  await db.storage.from("media").remove([path]);
  return analysis;
}
