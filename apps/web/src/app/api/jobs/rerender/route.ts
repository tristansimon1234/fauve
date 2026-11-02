import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { cronAuthorized } from "@/lib/cron-auth";
import { renderAndDeliver } from "@/lib/render/deliver";
import { renderPost } from "@/lib/render/render-post";
import { finishJob, keepAlive } from "@/lib/studio-jobs";

// A video made again from the chat (lib/rerender.ts): rendered with what changed (its music, its voice, its texts),
// then delivered where she asked; its job says it is alive every minute and ends failed if the render fails.
export const maxDuration = 800;

const bodySchema = z.object({
  jobId: z.uuid(),
  studioId: z.uuid(),
  postId: z.uuid(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  conversationId: z.uuid().optional(),
  freshMusic: z.boolean().optional(),
  silent: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const job = bodySchema.safeParse(await request.json().catch(() => null));
  if (!job.success) return Response.json({ error: job.error.message }, { status: 400 });
  const { jobId, silent, ...target } = job.data;
  after(async () => {
    const stop = keepAlive(jobId, job.data);
    try {
      // From her page: the new video only, the page shows it; from the chat: delivered where she asked.
      if (silent) {
        await renderPost(target.studioId, target.postId, { freshMusic: target.freshMusic });
        revalidatePath(`/publications/${target.postId}`);
        await finishJob(jobId);
        return;
      }
      const delivered = await renderAndDeliver(target);
      await finishJob(jobId, delivered === null);
    } catch (error) {
      console.error("rerender failed", target.postId, error);
      await finishJob(jobId, true);
    } finally {
      stop();
    }
  });
  return Response.json({ ok: true });
}
