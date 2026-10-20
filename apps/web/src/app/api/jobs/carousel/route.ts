import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { carouselOutputSchema, CREDIT_PRICES } from "@fauve/agent";
import { carouselRound, prepareCarousel } from "@/lib/agent/carousel-designer";
import { storeCarousel } from "@/lib/carousels";
import { chargeCredits } from "@/lib/credits";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { deliverCarousel, notifyFailure } from "@/lib/render/deliver";
import { finishJob, jobAlive, setJobStage } from "@/lib/studio-jobs";

// A designed carousel, one round per invocation (each gets its own time budget): the
// designer composes (or corrects), its code is checked and every slide rendered in check
// mode, then the critic looks once; its correction is the next round. A version that
// passes its test render is kept on the post at once (its render is the delivered one),
// so a correction that fails still delivers it. Credits are charged once it is delivered.
// Vercel Pro with Fluid compute: up to 800 s; a round stays well under it.
export const maxDuration = 800;

const bodySchema = z.object({
  studioId: z.uuid(),
  postId: z.uuid(),
  request: z.string().min(1).max(4000),
  mediaIds: z.array(z.uuid()).max(10).optional(),
  /** Composed anew, not a correction of the carousel the post already has. */
  fresh: z.boolean().optional(),
  /** Images of carousels she likes (her media), shown to the designer. */
  examples: z.array(z.uuid()).max(4).optional(),
  round: z.number().int().min(0).max(5).default(0),
  /** Her photos are read and cut out (the first step); then the designer's rounds. */
  prepared: z.boolean().default(false),
  previous: z
    .object({
      output: carouselOutputSchema,
      feedback: z.string().max(6000),
      stills: z.array(z.string().max(300)).max(10).optional(),
      /** This round is the correction the critic asked for. */
      fixed: z.boolean().optional(),
    })
    .optional(),
  /** A version already kept on the post (its slides count): delivered if a later round fails. */
  kept: z.object({ count: z.number().int().min(1).max(10) }).optional(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  conversationId: z.uuid().optional(),
  jobId: z.uuid().optional(),
  /** The lab's carousels are never charged. */
  charge: z.boolean().default(true),
});
type Job = z.infer<typeof bodySchema>;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function delivered(job: Job, count: number, note?: string) {
  const target = { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, conversationId: job.conversationId };
  await deliverCarousel(target, { count, note });
  await finishJob(job.jobId);
  if (job.charge) await chargeCredits(job.studioId, CREDIT_PRICES.carousel, "carousel", "Carrousel composé", { post_id: job.postId });
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid job" }, { status: 400 });
  const job = parsed.data;
  const target = { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, conversationId: job.conversationId };

  after(async () => {
    // A newer request replaced this one (or it was given up): nothing more to do.
    if (job.jobId && !(await jobAlive(job.jobId))) return;
    try {
      await setJobStage(job.jobId, job.previous?.fixed ? "fix" : "design");
      const input = { studioId: job.studioId, postId: job.postId, request: job.request, mediaIds: job.mediaIds, fresh: job.fresh, examples: job.examples };
      if (!job.prepared) {
        await prepareCarousel(input);
        await queueJob("carousel", { ...job, prepared: true });
        return;
      }
      const result = await carouselRound(input, job.round, job.previous, (stage) => setJobStage(job.jobId, stage));
      if (result.status === "retry") {
        // A version that passed its test render is kept now: if the correction fails, it is the one delivered.
        if (result.design && result.stills) await storeCarousel(job.studioId, job.postId, result.design, result.stills);
        // After the critic's look, every later round is its correction (it is not looked at again).
        const fixed = Boolean(result.design) || Boolean(job.previous?.fixed);
        await queueJob("carousel", {
          ...job,
          round: job.round + 1,
          previous: { ...result.previous, ...(fixed ? { fixed: true } : {}) },
          ...(result.design ? { kept: { count: result.design.count } } : {}),
        });
        return;
      }
      if (result.status === "failed") {
        // A correction that did not pass: the version kept before it goes out.
        if (job.kept) return await delivered(job, job.kept.count);
        throw new Error(result.error);
      }
      await storeCarousel(job.studioId, job.postId, result.design, result.stills);
      await delivered(job, result.design.count);
    } catch (error) {
      console.error("carousel job failed", job.postId, error);
      if (job.kept) {
        await delivered(job, job.kept.count).catch((e: unknown) => console.error("carousel delivery failed", e));
        return;
      }
      await finishJob(job.jobId, true);
      await notifyFailure(target, "Je n’ai pas réussi à composer ton carrousel cette fois. Tu veux que je réessaie ?", error);
    }
  });
  return Response.json({ accepted: true }, { status: 202 });
}
