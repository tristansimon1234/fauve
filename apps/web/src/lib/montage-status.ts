import "server-only";
import { effortSchema, JOB_STALE_MINUTES, montageLate } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Where launched montages are: the step the chain recorded on the quote (design,
// second version, render, review by the critic, correction), else guessed for
// older quotes: started (quote used), plan written (an edit plan newer than the
// launch), delivered (quote charged). A failure reopens the quote, so it no
// longer shows here.

export type MontageStatus = {
  postId: string;
  title: string;
  step: "en file" | "montage" | "effet" | "2e version" | "rendu" | "relecture" | "correction" | "livré";
  minutes: number;
  /**
   * It has most likely died: its step's pulse has been silent too long (the watchdog had its turn), or,
   * for a montage launched before the pulse, no news for too long. Never a long step that still runs:
   * a design takes up to 13 minutes, and Edith offered to start one again while it ran.
   */
  late: boolean;
};

const RECENT_MS = 3 * 3600_000;

/** Montages stopped these 3 hours (replaced by a newer request, or at her word): nothing delivered nor charged. */
export async function stoppedMontages(studioId: string, postId?: string): Promise<{ postId: string; title: string; minutes: number }[]> {
  let query = supabaseAdmin()
    .from("credit_quotes")
    .select("post_id, stage_at, posts(title)")
    .eq("studio_id", studioId)
    .eq("stage", "superseded")
    .gt("used_at", new Date(Date.now() - RECENT_MS).toISOString())
    .order("stage_at", { ascending: false })
    .limit(5);
  if (postId) query = query.eq("post_id", postId);
  const { data } = await query;
  return (data ?? []).map((q) => {
    const post = q.posts as { title?: string | null } | { title?: string | null }[] | null;
    return {
      postId: q.post_id as string,
      title: (Array.isArray(post) ? post[0]?.title : post?.title) ?? "Publication",
      minutes: q.stage_at ? Math.round((Date.now() - Date.parse(q.stage_at as string)) / 60_000) : 0,
    };
  });
}

/**
 * A Reel she has not seen yet: no video of it delivered and no montage of it under way. Its next montage is a new
 * Reel, which waits for her go and takes only the files given for it, even when a stopped montage left a plan
 * (Edith's launch Reel was started again on its own, with twenty old photos, on a post whose montage had been stopped).
 */
export async function unseenReel(studioId: string, postId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const [plans, running] = await Promise.all([
    db.from("edit_plans").select("id").eq("post_id", postId),
    db
      .from("credit_quotes")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("post_id", postId)
      .not("used_at", "is", null)
      .is("charged_at", null)
      .gt("used_at", new Date(Date.now() - RECENT_MS).toISOString())
      .or("stage.is.null,stage.not.in.(delivered,superseded)"),
  ]);
  if (running.count) return false;
  const ids = (plans.data ?? []).map((p) => p.id as string);
  if (!ids.length) return true;
  const { count } = await db.from("renders").select("id", { count: "exact", head: true }).in("edit_plan_id", ids).eq("status", "done");
  return !count;
}

export async function montageStatus(studioId: string, postId?: string): Promise<MontageStatus[]> {
  const db = supabaseAdmin();
  let query = db
    .from("credit_quotes")
    .select("id, post_id, used_at, charged_at, effort, stage, stage_at, posts(title)")
    .eq("studio_id", studioId)
    .not("used_at", "is", null)
    // A montage replaced by a newer request on its Reel has stopped: only the one that replaced it is told.
    .or("stage.is.null,stage.neq.superseded")
    .gt("used_at", new Date(Date.now() - RECENT_MS).toISOString())
    .order("used_at", { ascending: false })
    .limit(10);
  if (postId) query = query.eq("post_id", postId);
  const { data: quotes } = await query;
  if (!quotes?.length) return [];

  const postIds = [...new Set(quotes.map((q) => q.post_id as string))];
  const [{ data: plans }, { data: jobs }] = await Promise.all([
    db.from("edit_plans").select("post_id, created_at").in("post_id", postIds),
    db.from("studio_jobs").select("id, updated_at, finished_at, failed, pulsed:resume->>step").in("id", quotes.map((q) => q.id as string)),
  ]);
  const silent = (updatedAt: string) => Date.now() - new Date(updatedAt).getTime() > JOB_STALE_MINUTES * 60_000;
  return quotes.map((q) => {
    const job = (jobs ?? []).find((j) => j.id === q.id);
    const startedAt = new Date(q.used_at as string).getTime();
    const planned = (plans ?? []).some((p) => p.post_id === q.post_id && new Date(p.created_at as string).getTime() > startedAt);
    const post = q.posts as { title?: string | null } | { title?: string | null }[] | null;
    const minutes = Math.round((Date.now() - startedAt) / 60_000);
    const stages = { waiting: "en file", design: "montage", effects: "effet", alternative: "2e version", render: "rendu", review: "relecture", fix: "correction", delivered: "livré" } as const;
    const recorded = stages[q.stage as keyof typeof stages] as MontageStatus["step"] | undefined;
    const step = q.charged_at ? "livré" : (recorded ?? (planned ? "rendu" : "montage"));
    const effort = effortSchema.catch("rapide").parse(q.effort ?? "rapide");
    return {
      postId: q.post_id as string,
      title: (Array.isArray(post) ? post[0]?.title : post?.title) ?? "Publication",
      step,
      minutes,
      late:
        step !== "livré" &&
        step !== "en file" &&
        (job?.pulsed
          ? Boolean(job.failed) || (!job.finished_at && silent(job.updated_at as string))
          : montageLate({ startedAt, stageAt: q.stage_at ? new Date(q.stage_at as string).getTime() : null, effort, now: Date.now() })),
    };
  });
}
