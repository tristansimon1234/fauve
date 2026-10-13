import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { editPlanSchema, motionTemplateSchema, variantPlan, type MotionTemplate } from "@fauve/agent";
import { designEdit } from "@/lib/agent/editor";
import { chargeQuote } from "@/lib/credits";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { notifyFailure, renderAndDeliver } from "@/lib/render/deliver";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Montage pipeline in two invocations, each with its own time budget:
//   design: the editor (Opus) writes the plan and the motion designer the free scenes;
//   render: Remotion renders it in the sandbox and the video goes to the manager.
export const maxDuration = 300;

const bodySchema = z.object({
  step: z.enum(["design", "variant", "render"]),
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
  /** Variant step: the template and hook to change. */
  variant: z.object({ template: motionTemplateSchema.optional(), hook: z.string().max(120).optional() }).optional(),
});

/** A new version of the post's plan: same cut, another template and hook (no editor call). */
async function createVariant(studioId: string, postId: string, change: { template?: MotionTemplate; hook?: string }) {
  const db = supabaseAdmin();
  const latest = await db.from("edit_plans").select("plan, version").eq("post_id", postId).order("version", { ascending: false }).limit(1).maybeSingle();
  const current = editPlanSchema.safeParse(latest.data?.plan);
  if (!current.success) throw new Error("Pas de montage à décliner pour cette publication");
  const plan = variantPlan(current.data, change);
  const row = await db
    .from("edit_plans")
    .insert({ studio_id: studioId, post_id: postId, version: (latest.data!.version as number) + 1, plan })
    .select("id")
    .single();
  if (row.error) throw new Error(row.error.message);
  await db.from("posts").update({ edit_plan_id: row.data.id }).eq("id", postId);
  return plan;
}

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
      else await reopenQuote(job.quoteId);
      return;
    }
    if (job.step === "variant") {
      try {
        const plan = await createVariant(job.studioId, job.postId, job.variant ?? {});
        const rationale = `Variante en style « ${plan.template} »${job.variant?.hook ? ", avec une autre accroche" : ""} : dis-moi laquelle tu préfères.`;
        await queueJob("montage", { ...target, step: "render", rationale, quoteId: job.quoteId, newScenes: 0 });
      } catch (error) {
        console.error("variant failed", job.postId, error);
        await reopenQuote(job.quoteId);
        await notifyFailure(target, "Je n’ai pas réussi à préparer la variante. Aucun crédit n’a été débité. Tu veux que je réessaie ?", error);
      }
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
      await reopenQuote(job.quoteId);
      await notifyFailure(target, "Je n’ai pas réussi à préparer le montage. Aucun crédit n’a été débité. Tu veux que je réessaie ?", error);
    }
  });
  return Response.json({ queued: job.step }, { status: 202 });
}

/** The work failed before anything was charged: the same quote can be launched again. */
async function reopenQuote(quoteId: string | undefined) {
  if (!quoteId) return;
  await supabaseAdmin().from("credit_quotes").update({ used_at: null }).eq("id", quoteId).is("charged_at", null);
}
