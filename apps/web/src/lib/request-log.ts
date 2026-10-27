import "server-only";
import { requestBrief, requestLogSchema, withEntry, type RequestEntry, type RequestLine } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Her latest Reels whose words are read for her taste. */
const RECENT_REELS = 3;

/** Keeps the exchange of a launch on its post (posts.request_log); a launch without words keeps nothing. */
export async function logLaunch(studioId: string, postId: string, via: RequestEntry["via"], lines: RequestLine[]): Promise<void> {
  if (!lines.length) return;
  const db = supabaseAdmin();
  const { data, error } = await db.from("posts").select("request_log").eq("id", postId).eq("studio_id", studioId).single();
  if (error) throw new Error(error.message);
  const log = withEntry(requestLogSchema.parse(data.request_log ?? []), { at: new Date().toISOString(), via, lines });
  const saved = await db.from("posts").update({ request_log: log }).eq("id", postId).eq("studio_id", studioId);
  if (saved.error) throw new Error(saved.error.message);
}

/**
 * The request every agent of a montage gets: her exchange with Edith for this Reel, word for word, Edith's brief
 * for this launch as her reading of it, and her words on her latest Reels. Edith's brief alone when nothing is kept.
 */
export async function launchBrief(studioId: string, postId: string, brief: string | undefined): Promise<string | undefined> {
  const db = supabaseAdmin();
  const [post, recent] = await Promise.all([
    db.from("posts").select("request_log").eq("id", postId).eq("studio_id", studioId).single(),
    db
      .from("posts")
      .select("title, request_log")
      .eq("studio_id", studioId)
      .neq("id", postId)
      .neq("request_log", "[]")
      .order("created_at", { ascending: false })
      .limit(RECENT_REELS),
  ]);
  if (post.error) throw new Error(post.error.message);
  return requestBrief(
    requestLogSchema.parse(post.data.request_log ?? []),
    brief,
    (recent.data ?? []).map((p) => ({ title: (p.title as string | null) ?? "", log: requestLogSchema.parse(p.request_log ?? []) })),
  );
}
