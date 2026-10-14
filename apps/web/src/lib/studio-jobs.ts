import "server-only";
import { JOB_STALE_MINUTES, jobStepLabel, type JobKind } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

// studio_jobs: what Fauve is working on, step by step (the app shows it live,
// Fauve reads it before starting anything).

export type RunningJob = { id: string; postId: string | null; kind: JobKind; stage: string; startedAt: string; updatedAt: string; finishedAt: string | null; failed: boolean };

const fresh = () => new Date(Date.now() - JOB_STALE_MINUTES * 60_000).toISOString();

export async function startJob(job: { id?: string; studioId: string; postId: string | null; kind: JobKind; stage: string }): Promise<string> {
  // Already going (a montage passes « design » again after a retry): only the step changes.
  if (job.id) {
    const { data } = await supabaseAdmin().from("studio_jobs").select("finished_at").eq("id", job.id).maybeSingle();
    if (data && !data.finished_at) {
      await setJobStage(job.id, job.stage);
      return job.id;
    }
  }
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("studio_jobs")
    .upsert({ ...(job.id ? { id: job.id } : {}), studio_id: job.studioId, post_id: job.postId, kind: job.kind, stage: job.stage, started_at: now, updated_at: now, finished_at: null, failed: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setJobStage(id: string | undefined, stage: string): Promise<void> {
  if (!id) return;
  const { error } = await supabaseAdmin().from("studio_jobs").update({ stage, updated_at: new Date().toISOString() }).eq("id", id).is("finished_at", null);
  if (error) console.warn("studio_jobs: stage not recorded", error.message);
}

export async function finishJob(id: string | undefined, failed = false): Promise<void> {
  if (!id) return;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin().from("studio_jobs").update({ finished_at: now, updated_at: now, failed }).eq("id", id);
  if (error) console.warn("studio_jobs: end not recorded", error.message);
}

/** Is this job still going (not finished, and heard from recently)? */
export async function jobAlive(id: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("studio_jobs").select("finished_at, updated_at").eq("id", id).maybeSingle();
  return Boolean(data && !data.finished_at && (data.updated_at as string) >= fresh());
}

const toJob = (r: Record<string, unknown>): RunningJob => ({
  id: r.id as string,
  postId: (r.post_id as string | null) ?? null,
  kind: r.kind as JobKind,
  stage: r.stage as string,
  startedAt: r.started_at as string,
  updatedAt: r.updated_at as string,
  finishedAt: (r.finished_at as string | null) ?? null,
  failed: Boolean(r.failed),
});

/** The work in progress for a studio (optionally one post and kind). */
export async function runningJobs(studioId: string, filter?: { postId?: string; kind?: JobKind }): Promise<RunningJob[]> {
  let q = supabaseAdmin().from("studio_jobs").select("*").eq("studio_id", studioId).is("finished_at", null).gte("updated_at", fresh()).order("started_at", { ascending: false }).limit(10);
  if (filter?.postId) q = q.eq("post_id", filter.postId);
  if (filter?.kind) q = q.eq("kind", filter.kind);
  const { data } = await q;
  return (data ?? []).map(toJob);
}

/** What is running and what just ended (the last few minutes): the progress pill. */
export async function recentJobs(studioId: string): Promise<RunningJob[]> {
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await supabaseAdmin()
    .from("studio_jobs")
    .select("*")
    .eq("studio_id", studioId)
    .or(`finished_at.is.null,finished_at.gte.${since}`)
    .gte("updated_at", fresh())
    .order("started_at", { ascending: false })
    .limit(10);
  return (data ?? []).map(toJob);
}

/** One line per job for Fauve's context: what, which step, for how long. */
export function describeJobs(jobs: (RunningJob & { title?: string })[], now = Date.now()): string[] {
  return jobs.map((j) => {
    const minutes = Math.max(0, Math.round((now - new Date(j.startedAt).getTime()) / 60_000));
    const what = j.kind === "montage" ? "montage vidéo" : "texte sur photo (calque)";
    return `${what}${j.title ? ` pour « ${j.title} »` : ""} : étape ${jobStepLabel(j.kind, j.stage).toLowerCase()}, lancé il y a ${minutes} min${j.postId ? ` (post_id=${j.postId})` : ""}`;
  });
}
