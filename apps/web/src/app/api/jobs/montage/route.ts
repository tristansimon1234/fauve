import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import {
  alternativeBrief,
  EFFORTS,
  effortSchema,
  effortVersions,
  editPlanSchema,
  fixBrief,
  MAX_FREE_SCENES,
  montageIssueSchema,
  MAX_MONTAGE_FILES,
  motionTemplateSchema,
  reelFormatSchema,
  variantPlan,
} from "@fauve/agent";
import { reviewMontage } from "@/lib/agent/critic";
import { designEdit } from "@/lib/agent/editor";
import { voiceOverIfWanted } from "@/lib/voice-over";
import { chargeQuote, montageCost, setQuoteStage } from "@/lib/credits";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { deliverMontage, notifyFailure, renderAndDeliver } from "@/lib/render/deliver";
import { renderPost } from "@/lib/render/render-post";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { finishJob } from "@/lib/studio-jobs";

// Montage pipeline, one step per invocation (each with its own time budget).
// Rapide (and older quotes): design → render, delivered at once.
// Soigné and Max, a fixed chain of specialists: the editor (Opus) writes the
// plan and the motion designer the free scenes (design; Max adds a second take,
// alternative) → each version is rendered (render) → the critic watches key
// frames, keeps the best version and lets it go or asks for corrections
// (review) → the editor corrects it (fix) → render → review again, as many
// rounds as the level allows. The best rendered version is always kept, so a
// correction that fails never loses the montage.
// Vercel Pro with Fluid compute: up to 800 s; each step stays well under it, the rest is headroom.
export const maxDuration = 800;

const versionSchema = z.object({
  planId: z.uuid(),
  renderId: z.uuid().optional(),
  rationale: z.string().max(600).optional(),
  /** Made from the critic's corrections (charged as a correction once rendered)… */
  fix: z.boolean().optional(),
  /** …and what those corrections change, told to the manager if this version is kept. */
  summary: z.string().max(300).optional(),
});
type Version = z.infer<typeof versionSchema>;

const bodySchema = z.object({
  step: z.enum(["design", "alternative", "variant", "render", "review", "fix"]),
  studioId: z.uuid(),
  postId: z.uuid(),
  mediaIds: z.array(z.uuid()).max(MAX_MONTAGE_FILES).optional(),
  /** The manager's request, with the plan she said yes to. */
  brief: z.string().max(4000).optional(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  /** Started from the app (« Créer »): the delivery also reaches her on WhatsApp. */
  notify: z.boolean().optional(),
  rationale: z.string().max(600).optional(),
  /** What Fauve says about the delivered version, kept on the post (else the rationale). */
  note: z.string().max(600).optional(),
  /** Credits: the accepted quote, the new scenes it allows, and the new scenes made so far. */
  quoteId: z.uuid().optional(),
  maxNewScenes: z.number().int().min(0).max(MAX_FREE_SCENES).optional(),
  newScenes: z.number().int().min(0).max(10).optional(),
  title: z.string().max(200).optional(),
  /** Variant step: the hook to change (an older quote may still name a template: no longer switched). */
  variant: z.object({ template: motionTemplateSchema.optional(), hook: z.string().max(120).optional() }).optional(),
  /** Level of care; absent: one version, no review (older quotes). */
  effort: effortSchema.optional(),
  correction: z.boolean().optional(),
  /** The versions in play: rendered ones carry their render. */
  versions: z.array(versionSchema).max(3).optional(),
  /** Corrections asked so far, and those rendered (charged). */
  round: z.number().int().min(0).max(3).optional(),
  fixes: z.number().int().min(0).max(3).optional(),
  /** The critic's last word: what to correct, its score, its line for the manager. */
  issues: z.array(montageIssueSchema).max(4).optional(),
  score: z.number().int().min(1).max(10).optional(),
  summary: z.string().max(300).optional(),
  /** Two takes were compared by the critic (Max). */
  compared: z.boolean().optional(),
  /** The critic gave a verdict at least once. */
  reviewed: z.boolean().optional(),
  /** The voice Simone recorded over this Reel (its name), told at delivery. */
  voice: z.string().max(40).optional(),
  /** The voice step is done: the design goes on (in its own invocation when a voice was recorded). */
  voiced: z.boolean().optional(),
  /** Simone chose a key message with the music over a voice for this Reel (her setting is « auto »). */
  format: reelFormatSchema.optional(),
});
type Job = z.infer<typeof bodySchema>;

/** A new version of the post's plan: same cut and rhythm, another hook (no editor call). */
async function createVariant(studioId: string, postId: string, change: { hook?: string }) {
  const db = supabaseAdmin();
  const [post, latest] = await Promise.all([
    db.from("posts").select("edit_plan_id").eq("id", postId).eq("studio_id", studioId).single(),
    db.from("edit_plans").select("plan, version").eq("post_id", postId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // The version the manager has (after a review, often not the highest number).
  const base = post.data?.edit_plan_id
    ? (await db.from("edit_plans").select("plan").eq("id", post.data.edit_plan_id as string).maybeSingle()).data
    : latest.data;
  const current = editPlanSchema.safeParse(base?.plan);
  if (!current.success || !latest.data) throw new Error("Pas de montage à décliner pour cette publication");
  const plan = variantPlan(current.data, change);
  const row = await db
    .from("edit_plans")
    .insert({ studio_id: studioId, post_id: postId, version: (latest.data.version as number) + 1, plan })
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
  after(() => run(job));
  return Response.json({ queued: job.step }, { status: 202 });
}

const FAILED = "Je n’ai pas réussi à préparer le montage. Aucun crédit n’a été débité. Tu veux que je réessaie ?";

async function run(job: Job) {
  const target = { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, notify: job.notify };
  const level = job.effort ? EFFORTS[job.effort] : null;
  // Rapide and older quotes: one version, delivered as soon as it is rendered.
  const reviewed = Boolean(level?.review && job.step !== "variant");

  if (job.step === "variant") {
    try {
      await createVariant(job.studioId, job.postId, job.variant ?? {});
      const what = job.variant?.hook ? "Variante avec une autre accroche" : "Variante";
      await queueJob("montage", { ...target, step: "render", rationale: `${what} : dis-moi laquelle tu préfères.`, note: `${what}.`, quoteId: job.quoteId, newScenes: 0 });
    } catch (error) {
      console.error("variant failed", job.postId, error);
      await reopenQuote(job.quoteId);
      await notifyFailure(target, "Je n’ai pas réussi à préparer la variante. Aucun crédit n’a été débité. Tu veux que je réessaie ?", error);
    }
    return;
  }

  if (!reviewed) {
    if (job.step === "render") {
      await setQuoteStage(job.quoteId, "render");
      const cost = job.quoteId ? await montageCost(job.quoteId, job.newScenes ?? 0) : null;
      const delivered = await renderAndDeliver({ ...target, rationale: job.rationale, note: job.note ?? job.rationale, offerVariant: true, voice: job.voice, cost });
      // Charged only once the video is out, for the scenes really made (never above the quote).
      if (delivered && job.quoteId) {
        await setQuoteStage(job.quoteId, "delivered");
        await chargeQuote(job.quoteId, job.newScenes ?? 0, delivered.title);
      } else await reopenQuote(job.quoteId);
      return;
    }
    try {
      await setQuoteStage(job.quoteId, "design");
      if (await voiceFirst(job)) return;
      const edit = await designEdit({ ...designInput(job), effort: level?.editorEffort });
      await queueJob("montage", { ...target, step: "render", rationale: edit.rationale, quoteId: job.quoteId, newScenes: edit.newScenes, effort: job.effort, voice: job.voice });
    } catch (error) {
      console.error("montage design failed", job.postId, error);
      await reopenQuote(job.quoteId);
      await notifyFailure(target, FAILED, error);
    }
    return;
  }

  try {
    if (job.step === "design") await design(job);
    else if (job.step === "alternative") await alternative(job);
    else if (job.step === "render") await render(job);
    else if (job.step === "review") await review(job);
    else if (job.step === "fix") await fix(job);
  } catch (error) {
    console.error(`montage ${job.step} failed`, job.postId, error);
    // A rendered version is never lost: it goes out as it is.
    const kept = (job.versions ?? []).filter((v) => v.renderId);
    // Claims a review only when one was made (the critic's notes are on the job).
    const outcome: Care | null = job.reviewed ? { reviewed: true, left: job.issues?.[0]?.problem } : null;
    if (kept.length && (await deliver(job, kept[kept.length - 1]!, outcome).catch(() => false))) return;
    await reopenQuote(job.quoteId);
    await notifyFailure(target, FAILED, error);
  }
}

const next = (job: Job, patch: Partial<Job>) => queueJob("montage", { ...job, ...patch });

/** What the editor is asked for: the clips, the request with the validated plan, the scenes allowed. */
function designInput(job: Job) {
  return { studioId: job.studioId, postId: job.postId, mediaIds: job.mediaIds, brief: job.brief, maxNewScenes: job.maxNewScenes, format: job.format };
}

/** New animated scenes still allowed by the quote for the next version. */
const scenesLeft = (job: Job) => Math.max(0, (job.maxNewScenes ?? 2) - (job.newScenes ?? 0));

/**
 * Simone's voice over the Reel, before the editor (who cuts on it) when it should
 * have one: recorded once, kept for the corrections and the second take. When a
 * voice was recorded, the design goes on in a new invocation with its own time
 * budget (true); otherwise right away (false).
 */
async function voiceFirst(job: Job): Promise<boolean> {
  if (job.voiced) return false;
  const made = await voiceOverIfWanted({ studioId: job.studioId, postId: job.postId, mediaIds: job.mediaIds, correction: job.correction, brief: job.brief });
  if (!made) return false;
  // A key message with the music suits it better: no voice, the editor knows it, the design goes on now.
  if ("format" in made) {
    Object.assign(job, { voiced: true, format: made.format });
    return false;
  }
  await next(job, { step: "design", voiced: true, voice: made.voice, format: "raconte" });
  return true;
}

async function design(job: Job) {
  await setQuoteStage(job.quoteId, "design");
  if (await voiceFirst(job)) return;
  const edit = await designEdit({ ...designInput(job), effort: EFFORTS[job.effort!].editorEffort });
  const versions: Version[] = [{ planId: edit.editPlanId, rationale: edit.rationale.slice(0, 600) }];
  const two = effortVersions(job.effort!, Boolean(job.correction)) > 1;
  await next(job, { step: two ? "alternative" : "render", versions, newScenes: edit.newScenes, round: 0, fixes: 0 });
}

/** Max: a second take, to compare. If it fails, the first one goes on alone. */
async function alternative(job: Job) {
  await setQuoteStage(job.quoteId, "alternative");
  const versions = [...(job.versions ?? [])];
  let newScenes = job.newScenes ?? 0;
  try {
    const first = await supabaseAdmin().from("edit_plans").select("plan").eq("id", versions[0]!.planId).single();
    const plan = editPlanSchema.parse(first.data?.plan);
    const edit = await designEdit({
      ...designInput(job),
      brief: alternativeBrief(plan, job.brief),
      maxNewScenes: scenesLeft(job),
      effort: EFFORTS[job.effort!].editorEffort,
      fresh: true,
    });
    versions.push({ planId: edit.editPlanId, rationale: edit.rationale.slice(0, 600) });
    newScenes += edit.newScenes;
  } catch (error) {
    console.warn("second version failed, going on with one", job.postId, error);
  }
  await next(job, { step: "render", versions, newScenes });
}

/** Renders one version per invocation; a version that fails to render is dropped. */
async function render(job: Job) {
  await setQuoteStage(job.quoteId, "render");
  let versions = [...(job.versions ?? [])];
  let fixes = job.fixes ?? 0;
  const todo = versions.find((v) => !v.renderId);
  if (todo) {
    try {
      const r = await renderPost(job.studioId, job.postId, { editPlanId: todo.planId });
      versions = versions.map((v) => (v === todo ? { ...v, renderId: r.renderId } : v));
      if (todo.fix) fixes += 1;
    } catch (error) {
      console.error("version render failed", job.postId, todo.planId, error);
      versions = versions.filter((v) => v !== todo);
      // The correction did not render: the version already reviewed goes out.
      if (todo.fix && versions.some((v) => v.renderId)) {
        await deliver({ ...job, versions, fixes, summary: undefined }, versions.find((v) => v.renderId)!, { reviewed: true, left: job.issues?.[0]?.problem });
        return;
      }
    }
  }
  if (!versions.length) throw new Error("Aucune version du montage n'a pu être rendue");
  try {
    await next(job, { step: versions.some((v) => !v.renderId) ? "render" : "review", versions, fixes });
  } catch (error) {
    // The chain cannot go on: the latest rendered version goes out as it is.
    const done = versions.filter((v) => v.renderId);
    if (!done.length) throw error;
    console.warn("montage chain interrupted after a render, delivering", job.postId, error);
    await deliver({ ...job, versions, fixes }, done[done.length - 1]!, job.reviewed ? { reviewed: true } : null);
  }
}

async function review(job: Job) {
  await setQuoteStage(job.quoteId, "review");
  const rendered = (job.versions ?? []).filter((v): v is Version & { renderId: string } => Boolean(v.renderId));
  if (!rendered.length) throw new Error("Rien à relire");
  const round = job.round ?? 0;
  const verdict = await reviewMontage({
    studioId: job.studioId,
    postId: job.postId,
    versions: rendered,
    request: job.brief,
    asked: round > 0 ? job.issues : undefined,
    format: job.format,
  });
  if (verdict) console.log("montage: review", job.postId, `score ${verdict.review.score}, hook ${verdict.review.hook}`, verdict.review.ok ? "ok" : verdict.review.issues.map((i) => i.problem).join(" | "));
  // Without a verdict: the first take on Max (it follows the plan the manager saw), the correction afterwards.
  const best = rendered[verdict?.best ?? (round === 0 ? 0 : rendered.length - 1)]!;
  const compared = job.compared || (Boolean(verdict) && round === 0 && rendered.length > 1);
  const reviewed = job.reviewed || Boolean(verdict);
  // An engine fallback (no animations) is not the editor's to fix: it goes out as it is.
  if (!verdict || verdict.review.ok || !verdict.review.issues.length || verdict.fallback || round >= EFFORTS[job.effort!].fixRounds) {
    // What the manager is told: what the kept correction improved, or what was checked when it can go out
    // as it is; never a fix that was not made, and what is left when the last round still found something.
    const corrected = rendered.find((v) => v.fix);
    await deliver({ ...job, compared, reviewed }, best, {
      reviewed,
      fixed: Boolean(best.fix),
      keptFirst: Boolean(corrected && !best.fix),
      line: best.fix ? best.summary : verdict?.review.ok ? verdict.review.summary : undefined,
      left: verdict && !verdict.review.ok ? verdict.review.issues[0]?.problem : undefined,
    });
    return;
  }
  try {
    await next(job, {
      step: "fix",
      versions: [best],
      issues: verdict.review.issues,
      score: verdict.review.score,
      summary: verdict.review.summary.slice(0, 300),
      compared,
      reviewed,
    });
  } catch (error) {
    console.warn("montage chain interrupted before the correction, delivering", job.postId, error);
    await deliver({ ...job, compared, reviewed }, best, { reviewed, left: verdict.review.issues[0]?.problem });
  }
}

/** The editor corrects the kept version from the critic's notes; the kept version stays in play. */
async function fix(job: Job) {
  await setQuoteStage(job.quoteId, "fix");
  const best = job.versions?.[0];
  if (!best?.renderId) throw new Error("Pas de version à corriger");
  try {
    const edit = await designEdit({
      ...designInput(job),
      brief: fixBrief({ score: job.score ?? 5, issues: job.issues ?? [] }, job.brief),
      fromPlanId: best.planId,
      maxNewScenes: scenesLeft(job),
      effort: EFFORTS[job.effort!].editorEffort,
    });
    await next(job, {
      step: "render",
      versions: [best, { planId: edit.editPlanId, rationale: edit.rationale.slice(0, 600), fix: true, summary: job.summary }],
      newScenes: (job.newScenes ?? 0) + edit.newScenes,
      round: (job.round ?? 0) + 1,
    });
  } catch (error) {
    console.warn("correction failed, the reviewed version goes out", job.postId, error);
    await deliver({ ...job, summary: undefined }, best, { reviewed: true, left: job.issues?.[0]?.problem });
  }
}

/** What the review did, for the delivery message and the charge. */
type Care = {
  /** The critic watched the video. */
  reviewed: boolean;
  /** The kept version is a correction it asked for. */
  fixed?: boolean;
  /** A correction was tried, and the version before it was better. */
  keptFirst?: boolean;
  /** The critic's sentence for the manager, about the version that goes out. */
  line?: string;
  /** What the critic would still correct (the last round allowed found something). */
  left?: string;
};

/** The care sentence of the delivery message, from what really happened. */
function careLine(compared: boolean, outcome: Care | null): string {
  const left = outcome?.left?.trim().replace(/[\s.]+$/, "");
  return [
    compared ? "J’ai préparé deux versions et gardé la meilleure." : "",
    outcome?.reviewed
      ? outcome.fixed
        ? "Avant de te l’envoyer, j’ai regardé la vidéo et fait corriger quelques détails."
        : outcome.keptFirst
          ? "J’ai regardé la vidéo et essayé une correction, mais la version d’avant était meilleure : c’est celle-ci."
          : "J’ai regardé la vidéo avant de te l’envoyer."
      : "",
    outcome?.line?.trim() ?? "",
    left ? `Si tu veux, je peux encore corriger ceci : ${left}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The kept version becomes the post's current one and goes to the manager,
 * with what the review did; the quote is charged for what was really made.
 */
async function deliver(job: Job, best: Version, outcome: Care | null): Promise<boolean> {
  const target = { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, notify: job.notify };
  const db = supabaseAdmin();
  await db.from("posts").update({ edit_plan_id: best.planId, render_id: best.renderId }).eq("id", job.postId).eq("studio_id", job.studioId);
  const [post, render] = await Promise.all([
    db.from("posts").select("title").eq("id", job.postId).single(),
    db.from("renders").select("duration_ms").eq("id", best.renderId!).single(),
  ]);
  const title = (post.data?.title as string | null) ?? "";
  const care = careLine(Boolean(job.compared), outcome);
  // The review priced is not charged when the critic could not watch the video, nor a second take never compared.
  const skipped = {
    skipReview: !outcome?.reviewed && Boolean(job.effort && EFFORTS[job.effort].review),
    skipAlternative: Boolean(job.effort && effortVersions(job.effort, Boolean(job.correction)) > 1 && !job.compared),
  };
  try {
    await deliverMontage(
      {
        ...target,
        rationale: best.rationale,
        care: care || undefined,
        note: [best.rationale, care].filter(Boolean).join(" ").slice(0, 600) || undefined,
        // Two versions were already compared: no variant offered on top.
        offerVariant: !job.compared,
        voice: job.voice,
        cost: job.quoteId ? await montageCost(job.quoteId, job.newScenes ?? 0, job.fixes ?? 0, skipped) : null,
      },
      { title, durationMs: (render.data?.duration_ms as number | null) ?? 0 },
    );
  } catch (error) {
    console.error("montage delivery failed", job.postId, error);
    await reopenQuote(job.quoteId);
    await notifyFailure(target, "Le montage est prêt mais je n’ai pas pu te l’envoyer. Tu le trouves dans l’app, page de la publication. Aucun crédit n’a été débité.", error);
    return true;
  }
  if (job.quoteId) {
    await setQuoteStage(job.quoteId, "delivered");
    await chargeQuote(job.quoteId, job.newScenes ?? 0, title, job.fixes ?? 0, skipped);
  }
  return true;
}

/**
 * The work failed before anything was charged: the same quote can be launched again. Its stage_at
 * stays, so the quote card can say the last try did not work (lib/chat-cards.ts, quoteFailed).
 */
async function reopenQuote(quoteId: string | undefined) {
  if (!quoteId) return;
  await supabaseAdmin().from("credit_quotes").update({ used_at: null, stage: null }).eq("id", quoteId).is("charged_at", null);
  await finishJob(quoteId, true);
}
