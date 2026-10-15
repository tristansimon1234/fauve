import "server-only";
import { assertCanCreate } from "@/lib/billing/access";
import { CREDIT_PRICES, jobStepLabel } from "@fauve/agent";
import { creditBalance } from "@/lib/credits";
import { queueJob } from "@/lib/jobs";
import { finishJob, runningJobs, startJob } from "@/lib/studio-jobs";

// Starting the component designer, from the chat (Fauve's tools) or the app (the
// bank): never twice for the same thing, never without the credits.

export type ElementsStart = {
  studioId: string;
  mode: "create" | "edit";
  elementId?: string;
  postId?: string;
  request: string;
  exampleMediaId?: string;
  examplePath?: string;
  photos?: number[];
  origin: "chat" | "app";
  waId?: string;
  replyTo?: string;
};

export type ElementsStarted =
  | { status: "started"; jobId: string; credits: number }
  | { status: "already_running"; stage: string; minutes: number }
  | { status: "error"; error: string };

export async function startElements(start: ElementsStart): Promise<ElementsStarted> {
  await assertCanCreate(start.studioId);
  const credits = start.mode === "edit" ? CREDIT_PRICES.elementEdit : CREDIT_PRICES.textLayer;
  // The same component, or the same post, already being worked on: never a second time (it would be charged twice).
  const [running] =
    start.mode === "edit" && start.elementId
      ? await runningJobs(start.studioId, { templateId: start.elementId, kind: "elements" })
      : start.postId
        ? await runningJobs(start.studioId, { postId: start.postId, kind: "elements" })
        : [];
  if (running) {
    return { status: "already_running", stage: jobStepLabel(running.kind, running.stage), minutes: Math.round((Date.now() - new Date(running.startedAt).getTime()) / 60_000) };
  }
  const balance = await creditBalance(start.studioId);
  if (balance < credits) return { status: "error", error: `Il faut ${credits} crédit${credits > 1 ? "s" : ""}, il en reste ${balance}.` };
  let jobId: string | undefined;
  try {
    jobId = await startJob({ studioId: start.studioId, postId: start.postId ?? null, templateId: start.elementId ?? null, kind: "elements", stage: "design" });
    await queueJob("elements", { ...start, jobId, step: "design", round: 0 });
    return { status: "started", jobId, credits };
  } catch (error) {
    await finishJob(jobId, true);
    return { status: "error", error: error instanceof Error ? error.message : "Le dessin n’a pas pu démarrer" };
  }
}
