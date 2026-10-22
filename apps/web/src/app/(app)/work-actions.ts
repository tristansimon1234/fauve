"use server";

import { effortSchema, JOB_KIND_LABELS, JOB_STEPS, montageJobSteps, type JobKind } from "@fauve/agent";
import { pricedAsEffect } from "@/lib/credits";
import { getStudioContext } from "@/lib/studio";
import { recentJobs } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The progress pill's data: what Fauve is doing, and what she just finished.

export type WorkItem = {
  id: string;
  postId: string | null;
  /** The component made or changed (components work). */
  templateId: string | null;
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
  const templateIds = jobs.flatMap((j) => (j.templateId && !j.postId ? [j.templateId] : []));
  const names = templateIds.length
    ? new Map(((await supabaseAdmin().from("motion_templates").select("id, name, kit_name").in("id", templateIds)).data ?? []).map((t) => [t.id as string, (t.kit_name as string | null) ?? (t.name as string)]))
    : new Map<string, string>();
  // A montage shows only the steps its level runs (its quote has the same id).
  const montageIds = jobs.filter((j) => j.kind === "montage").map((j) => j.id);
  const quotes = montageIds.length
    ? new Map(((await supabaseAdmin().from("credit_quotes").select("id, kind, effort, params").in("id", montageIds)).data ?? []).map((q) => [q.id as string, q]))
    : new Map<string, { kind: unknown; effort: unknown; params: unknown }>();
  return {
    studioId,
    items: jobs.map((j) => {
      const quote = quotes.get(j.id);
      const steps = quote
        ? montageJobSteps({
            effort: effortSchema.nullable().catch(null).parse(quote.effort ?? null),
            kind: quote.kind === "correction" || quote.kind === "variant" ? quote.kind : "montage",
            effect: pricedAsEffect(quote.params) || j.stage === "effects",
          })
        : JOB_STEPS[j.kind];
      return {
        id: j.id,
        postId: j.postId,
        templateId: j.templateId,
        title: j.postId ? (titles.get(j.postId) ?? null) : j.templateId ? (names.get(j.templateId) ?? null) : null,
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
