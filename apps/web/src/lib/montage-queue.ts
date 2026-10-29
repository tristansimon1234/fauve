import "server-only";
import { JOB_STALE_MINUTES, MONTAGES_AT_ONCE, ourStudio, queueMinutes } from "@fauve/agent";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { finishJob } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The second brake for a rush (packages/agent/src/brakes.ts): one machine renders every studio's
// Reels, and past a few at once they kill each other (out of memory, steps past their 800 s). So
// montages run a few at a time, every studio together (MONTAGES_AT_ONCE); the next one waits its
// turn (its job and its quote at « waiting », its first step kept in studio_jobs.resume) and starts
// as soon as one ends (end of each montage step, and the publish cron every 5 minutes). The team's
// and lab studios never wait, but count. A waiting montage is « en file » for Edith and its screens,
// with when it should be ready (queueMinutes).

const slots = () => env("MONTAGES_AT_ONCE") ?? MONTAGES_AT_ONCE;
const fresh = () => new Date(Date.now() - JOB_STALE_MINUTES * 60_000).toISOString();

/** Montages running now (heard from recently), every studio together. */
async function running(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("studio_jobs")
    .select("id", { count: "exact", head: true })
    .eq("kind", "montage")
    .is("finished_at", null)
    .neq("stage", "waiting")
    .gte("updated_at", fresh());
  return count ?? 0;
}

/**
 * Before a montage starts (startMontage): « start » when there is room (the caller starts it), or it
 * is now in the queue with what starts it (`job`, the body of its first step): « waiting », or
 * « started » when a slot freed meanwhile and the queue started it. Our own studios never wait.
 */
export async function takeTurn(studioId: string, quoteId: string, postId: string | null, job: Record<string, unknown>): Promise<"start" | "waiting" | "started"> {
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("team, website_url").eq("id", studioId).maybeSingle();
  if (!studio || ourStudio(studio)) return "start";
  const [busy, waiting] = await Promise.all([
    running(),
    db.from("studio_jobs").select("id", { count: "exact", head: true }).eq("kind", "montage").eq("stage", "waiting").is("finished_at", null),
  ]);
  // Room, and nobody waiting before it: it starts now.
  const now = new Date().toISOString();
  if (busy < slots() && !(waiting.count ?? 0)) {
    // Counted as running from now, before its first step records itself: a burst of launches sees it.
    await db.from("studio_jobs").upsert({ id: quoteId, studio_id: studioId, post_id: postId, kind: "montage", stage: "design", started_at: now, updated_at: now, finished_at: null, failed: false });
    return "start";
  }
  const { error } = await db
    .from("studio_jobs")
    .upsert({ id: quoteId, studio_id: studioId, post_id: postId, kind: "montage", stage: "waiting", started_at: now, updated_at: now, finished_at: null, failed: false, resume: job });
  if (error) {
    console.warn("montage queue: not kept, started now", quoteId, error.message);
    return "start";
  }
  await db.from("credit_quotes").update({ stage: "waiting", stage_at: now }).eq("id", quoteId).or("stage.is.null,stage.neq.superseded");
  // A slot may have freed meanwhile.
  const started = await startWaitingMontages().catch((e: unknown) => {
    console.warn("montage queue: not moved", e);
    return [] as string[];
  });
  return started.includes(quoteId) ? "started" : "waiting";
}

/** Starts the waiting montages there is room for, oldest first, and keeps the others alive. */
export async function startWaitingMontages(): Promise<string[]> {
  const db = supabaseAdmin();
  const room = slots() - (await running());
  const started: string[] = [];
  if (room > 0) {
    const { data: next } = await db
      .from("studio_jobs")
      .select("id, resume")
      .eq("kind", "montage")
      .eq("stage", "waiting")
      .is("finished_at", null)
      .order("started_at")
      .limit(room);
    for (const row of next ?? []) {
      const id = row.id as string;
      const { data: quote } = await db.from("credit_quotes").select("stage").eq("id", id).maybeSingle();
      // Replaced by a newer request while it waited: nothing to start.
      if (!quote || quote.stage === "superseded") {
        await finishJob(id);
        continue;
      }
      // Claimed by one caller only; it counts as running from now (its first step records its stage).
      const { data: claimed } = await db
        .from("studio_jobs")
        .update({ stage: "design", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("stage", "waiting")
        .is("finished_at", null)
        .select("id");
      if (!claimed?.length) continue;
      try {
        await queueJob("montage", row.resume as Record<string, unknown>);
        started.push(id);
      } catch (error) {
        console.error("montage queue: start refused, back in the queue", id, error);
        await db.from("studio_jobs").update({ stage: "waiting" }).eq("id", id).is("finished_at", null);
      }
    }
  }
  // The others stay alive while they wait (a job silent for JOB_STALE_MINUTES reads as dead).
  await db.from("studio_jobs").update({ updated_at: new Date().toISOString() }).eq("kind", "montage").eq("stage", "waiting").is("finished_at", null);
  return started;
}

/** A waiting montage: in how many minutes it should be ready (null: it is not waiting). */
export async function queueWait(quoteId: string): Promise<number | null> {
  const db = supabaseAdmin();
  const { data: job } = await db.from("studio_jobs").select("stage, started_at, finished_at").eq("id", quoteId).maybeSingle();
  if (!job || job.stage !== "waiting" || job.finished_at) return null;
  const { count: before } = await db
    .from("studio_jobs")
    .select("id", { count: "exact", head: true })
    .eq("kind", "montage")
    .eq("stage", "waiting")
    .is("finished_at", null)
    .lt("started_at", job.started_at as string);
  return queueMinutes((before ?? 0) + 1, slots());
}
