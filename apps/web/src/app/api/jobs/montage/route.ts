import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { designEdit } from "@/lib/agent/editor";
import { chargeQuote } from "@/lib/credits";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { notifyFailure, renderAndDeliver } from "@/lib/render/deliver";

// Montage pipeline in two invocations, each with its own time budget:
//   design: the editor (Opus) writes the plan and the motion designer the free scenes;
//   render: Remotion renders it in the sandbox and the video goes to the manager.
export const maxDuration = 300;

const bodySchema = z.object({
  step: z.enum(["design", "render"]),
  studioId: z.uuid(),
  postId: z.uuid(),
  mediaIds: z.array(z.uuid()).max(10).optional(),
  brief: z.string().max(600).optional(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  rationale: z.string().max(400).optional(),
  /** Credits: the accepted quote, the new scenes it allows, and (render step) the new scenes made. */
  quoteId: z.uuid().optional(),
  maxNewScenes: z.number().int().min(0).max(2).optional(),
  newScenes: z.number().int().min(0).max(10).optional(),
  title: z.string().max(200).optional(),
});

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid job" }, { status: 400 });
  const job = parsed.data;
  const target = { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo };

  after(async () => {
    if (job.step === "render") {
      const delivered = await renderAndDeliver({ ...target, rationale: job.rationale });
      // Charged only once the video is out, for the scenes really made (never above the quote).
      if (delivered && job.quoteId) await chargeQuote(job.quoteId, job.newScenes ?? 0, delivered.title);
      return;
    }
    try {
      const edit = await designEdit({
        studioId: job.studioId,
        postId: job.postId,
        mediaIds: job.mediaIds,
        brief: job.brief,
        maxNewScenes: job.maxNewScenes,
      });
      await queueJob("montage", { ...target, step: "render", rationale: edit.rationale, quoteId: job.quoteId, newScenes: edit.newScenes });
    } catch (error) {
      console.error("montage design failed", job.postId, error);
      const message = error instanceof Error ? error.message : String(error);
      await notifyFailure(target, `Je n’ai pas réussi à préparer le montage (${message}). Tu veux que je réessaie ?`, error);
    }
  });
  return Response.json({ queued: job.step }, { status: 202 });
}
