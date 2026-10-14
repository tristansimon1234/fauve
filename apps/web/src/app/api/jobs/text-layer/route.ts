import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { CREDIT_PRICES, layerDesignOutputSchema } from "@fauve/agent";
import { designRound, layerFor, type LayerDraft } from "@/lib/agent/text-designer";
import { chargeCredits } from "@/lib/credits";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { notifyFailure, renderSlidesAndDeliver } from "@/lib/render/deliver";
import { finishJob, jobAlive, setJobStage } from "@/lib/studio-jobs";
import { applyLayers, saveLayer } from "@/lib/text-layers";

// A new text layer, one step per invocation (each gets its own time budget):
//   design: one round of the text designer (design or fix, checks, test render, critic),
//           chained until it passes or MAX_ROUNDS is reached;
//   render: the photos are rendered with the layer and the link goes to the manager,
//           then the credits are charged.
export const maxDuration = 300;

const bodySchema = z.object({
  step: z.enum(["design", "render"]),
  studioId: z.uuid(),
  postId: z.uuid(),
  request: z.string().min(1).max(4000),
  exampleMediaId: z.uuid().optional(),
  photos: z.array(z.number().int().min(1).max(10)).max(10).optional(),
  round: z.number().int().min(0).max(5).default(0),
  draft: layerDesignOutputSchema.optional(),
  feedback: z.string().max(4000).optional(),
  name: z.string().max(80).optional(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  /** The studio_jobs row that follows this work. */
  jobId: z.uuid().optional(),
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
    // A newer request replaced this one (or it was given up): nothing more to do.
    if (job.jobId && !(await jobAlive(job.jobId))) return;
    if (job.step === "render") {
      await setJobStage(job.jobId, "render");
      const delivered = await renderSlidesAndDeliver(target);
      await finishJob(job.jobId, !delivered);
      // Charged only once the photos are out.
      if (delivered) await chargeCredits(job.studioId, CREDIT_PRICES.textLayer, "text_layer", `Calque de texte « ${job.name ?? ""} »`, { post_id: job.postId });
      return;
    }
    try {
      await setJobStage(job.jobId, job.round === 0 ? "design" : "fix");
      const input = { studioId: job.studioId, postId: job.postId, request: job.request, exampleMediaId: job.exampleMediaId, photos: job.photos };
      const previous = job.draft && job.feedback ? { draft: job.draft as LayerDraft, feedback: job.feedback } : undefined;
      const result = await designRound(input, job.round, previous, (stage) => setJobStage(job.jobId, stage));
      if (result.status === "retry") {
        await queueJob("text-layer", { ...job, round: job.round + 1, draft: result.draft ?? job.draft, feedback: result.feedback });
        return;
      }
      if (result.status === "failed") throw new Error(result.error);
      const { draft, js } = result;
      const templateId = await saveLayer(job.studioId, {
        name: draft.name,
        description: `${draft.notes} — ${job.request}`,
        slots: draft.slots,
        code: draft.code,
        js,
        fonts: draft.fonts,
      });
      const layers = new Map(
        draft.slides.flatMap((s) => {
          const layer = layerFor(draft, js, s.photo, templateId ?? undefined);
          return layer ? [[s.photo, layer] as const] : [];
        }),
      );
      await applyLayers(job.studioId, job.postId, layers);
      await queueJob("text-layer", { ...job, step: "render", name: draft.name, draft: undefined, feedback: undefined });
    } catch (error) {
      console.error("text layer design failed", job.postId, error);
      await finishJob(job.jobId, true);
      await notifyFailure(target, "Je n’ai pas réussi à dessiner ce texte cette fois. Aucun crédit n’a été débité. Tu veux que je réessaie, ou que je pose un texte plus simple ?", error);
    }
  });
  return Response.json({ queued: job.step, round: job.round }, { status: 202 });
}
