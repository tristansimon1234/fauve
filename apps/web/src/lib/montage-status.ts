import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Where launched montages are: started (quote used), plan written (an edit plan
// newer than the launch), delivered (quote charged). A failure reopens the
// quote, so it no longer shows here.

export type MontageStatus = {
  postId: string;
  title: string;
  step: "montage" | "rendu" | "livré";
  minutes: number;
  /** No video after this long: something went wrong. */
  late: boolean;
};

const RECENT_MS = 3 * 3600_000;
const LATE_MINUTES = 10;

export async function montageStatus(studioId: string, postId?: string): Promise<MontageStatus[]> {
  const db = supabaseAdmin();
  let query = db
    .from("credit_quotes")
    .select("post_id, used_at, charged_at, posts(title)")
    .eq("studio_id", studioId)
    .not("used_at", "is", null)
    .gt("used_at", new Date(Date.now() - RECENT_MS).toISOString())
    .order("used_at", { ascending: false })
    .limit(10);
  if (postId) query = query.eq("post_id", postId);
  const { data: quotes } = await query;
  if (!quotes?.length) return [];

  const postIds = [...new Set(quotes.map((q) => q.post_id as string))];
  const { data: plans } = await db.from("edit_plans").select("post_id, created_at").in("post_id", postIds);
  return quotes.map((q) => {
    const startedAt = new Date(q.used_at as string).getTime();
    const planned = (plans ?? []).some((p) => p.post_id === q.post_id && new Date(p.created_at as string).getTime() > startedAt);
    const post = q.posts as { title?: string | null } | { title?: string | null }[] | null;
    const minutes = Math.round((Date.now() - startedAt) / 60_000);
    const step = q.charged_at ? "livré" : planned ? "rendu" : "montage";
    return {
      postId: q.post_id as string,
      title: (Array.isArray(post) ? post[0]?.title : post?.title) ?? "Publication",
      step,
      minutes,
      late: step !== "livré" && minutes >= LATE_MINUTES,
    };
  });
}
