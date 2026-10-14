"use server";

import { JOB_KIND_LABELS, JOB_STEPS, type JobKind } from "@fauve/agent";
import { getStudioContext } from "@/lib/studio";
import { recentJobs } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The progress pill's data: what Fauve is doing, and what she just finished.

export type WorkItem = {
  id: string;
  postId: string | null;
  title: string | null;
  kind: JobKind;
  kindLabel: string;
  steps: string[];
  /** Index of the current step in `steps`. */
  step: number;
  startedAt: string;
  finishedAt: string | null;
  failed: boolean;
};

export async function workNow(): Promise<{ studioId: string; items: WorkItem[] } | null> {
  const { member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const jobs = await recentJobs(studioId);
  const ids = jobs.flatMap((j) => (j.postId ? [j.postId] : []));
  const titles = ids.length ? new Map(((await supabaseAdmin().from("posts").select("id, title").in("id", ids)).data ?? []).map((p) => [p.id as string, p.title as string])) : new Map<string, string>();
  return {
    studioId,
    items: jobs.map((j) => {
      const steps = JOB_STEPS[j.kind];
      return {
        id: j.id,
        postId: j.postId,
        title: j.postId ? (titles.get(j.postId) ?? null) : null,
        kind: j.kind,
        kindLabel: JOB_KIND_LABELS[j.kind],
        steps: steps.map((s) => s.label),
        step: Math.max(0, steps.findIndex((s) => s.stage === j.stage)),
        startedAt: j.startedAt,
        finishedAt: j.finishedAt,
        failed: j.failed,
      };
    }),
  };
}
