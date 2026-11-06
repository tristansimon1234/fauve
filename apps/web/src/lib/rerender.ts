import "server-only";
import { rerenderDelivers } from "@fauve/agent";
import { queueJob } from "@/lib/jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderAndDeliver, type DeliveryTarget } from "@/lib/render/deliver";
import { renderPost } from "@/lib/render/render-post";
import { finishJob, runningJobs, startJob } from "@/lib/studio-jobs";

// A video made again from the chat (its music, its voice taken out, its text styles, a blur, an unchanged plan):
// its own background job (/api/jobs/rerender, 800 s), followed in studio_jobs like a montage, so Edith sees it under
// « Travaux en cours » and the app's pill shows it. Done inside the chat's 300 s, Tristan's piano was composed and
// mixed, then the function was cut off before the video was kept, and Edith said it was delivered.

/** silent: asked from her page (a button, an edit saved), which shows the new video by itself: no message in the chat. */
export type RerenderTarget = Pick<DeliveryTarget, "studioId" | "postId" | "waId" | "replyTo" | "conversationId" | "freshMusic"> & { silent?: boolean };

/**
 * A re-render delivers only the latest version of the Reel (rerenderDelivers): its own version still the post's, its job
 * not stopped, no montage running on the Reel, no other re-render of it started after this one.
 */
export async function rerenderStillWanted(jobId: string, studioId: string, postId: string, current: boolean): Promise<boolean> {
  if (!current) return false;
  const [mine, running] = await Promise.all([
    supabaseAdmin().from("studio_jobs").select("id, started_at, finished_at").eq("id", jobId).maybeSingle(),
    runningJobs(studioId, { postId }),
  ]);
  return rerenderDelivers({
    current,
    mine: mine.data ? { id: mine.data.id as string, startedAt: mine.data.started_at as string, finished: Boolean(mine.data.finished_at) } : null,
    running: running.map((j) => ({ id: j.id, kind: j.kind, startedAt: j.startedAt })),
  });
}

/** Starts the job; if it cannot be sent, the video is made here as before rather than not at all. */
export async function queueRerender(target: RerenderTarget): Promise<void> {
  let jobId: string | undefined;
  try {
    jobId = await startJob({ studioId: target.studioId, postId: target.postId, kind: "rerender", stage: "render" });
    await queueJob("rerender", { jobId, ...target });
  } catch (error) {
    console.warn("rerender: job not sent, rendering here", target.postId, error);
    const ok = target.silent
      ? await renderPost(target.studioId, target.postId, { freshMusic: target.freshMusic }).then(
          () => true,
          (e: unknown) => (console.error("rerender failed", target.postId, e), false),
        )
      : (await renderAndDeliver(target)) !== null;
    await finishJob(jobId, !ok);
  }
}
