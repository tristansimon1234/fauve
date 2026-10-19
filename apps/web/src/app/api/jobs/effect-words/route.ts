import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { EFFECT_WORDS_MAX, editPlanSchema, effectPlan, effectWordSchema, usdToEur } from "@fauve/agent";
import { collectEffects, correctedKit, effectsState, endEffectsSession, logEffectsCost, replayError, startReplaySession, type EffectsState } from "@/lib/agent/effects-agent";
import { insertPlanVersion } from "@/lib/edit-plans";
import { copyKit, keepKit } from "@/lib/effect-words";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { deliverMontage, notifyFailure } from "@/lib/render/deliver";
import { renderPost } from "@/lib/render/render-post";
import { finishJob, setJobStage } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her new words on an effect (lib/effect-words.ts): a short session in the effects environment runs the
// agent's own render script with them (start), is waited for (wait, as long as it takes, one look every
// 20 s), then its video becomes the Reel's new version with the same kit, Simone's music goes on it,
// and the page shows it (in the chat, Simone delivers it). Free for her: its cost is logged.
export const maxDuration = 800;

const bodySchema = z.object({
  jobId: z.uuid(),
  studioId: z.uuid(),
  postId: z.uuid(),
  /** The version her words change (its kit, its files). */
  planId: z.uuid(),
  words: z.array(effectWordSchema).min(1).max(EFFECT_WORDS_MAX),
  step: z.enum(["start", "wait"]),
  /** The replay at work, once started. */
  effect: z
    .object({
      session: z.string().max(80),
      files: z.array(z.string().max(80)).max(40),
      started: z.string().max(40),
    })
    .optional(),
  conversationId: z.uuid().optional(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  /** Asked in the chat: Simone delivers the new video there (the page shows it by itself). */
  tell: z.boolean().optional(),
});
type Job = z.infer<typeof bodySchema>;

/** How long one invocation waits on the replay (the next one takes over), how often it looks, and the most it is given. */
const WAIT_MS = 8 * 60_000;
const POLL_MS = 20_000;
const TIMEOUT_MINUTES = 25;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function next(job: Job, patch: Partial<Job>) {
  await queueJob("effect-words", { ...job, ...patch });
}

async function start(job: Job) {
  const db = supabaseAdmin();
  const { data } = await db.from("edit_plans").select("plan").eq("id", job.planId).eq("post_id", job.postId).single();
  const plan = editPlanSchema.parse(data?.plan);
  const started = await startReplaySession({ studioId: job.studioId, postId: job.postId, plan, words: job.words });
  // On the job before the next call: if it cannot be queued, the session is ended with the rest.
  job.effect = { session: started.session, files: started.files, started: new Date().toISOString() };
  await next(job, { step: "wait" });
}

async function wait(job: Job) {
  const effect = job.effect;
  if (!effect) throw new Error("effect words: no session to wait on");
  const until = Date.now() + WAIT_MS;
  let misses = 0;
  let freshAt = 0;
  for (;;) {
    let state: EffectsState | null = null;
    try {
      state = await effectsState(effect.session);
      misses = 0;
    } catch (error) {
      if (++misses >= 5) throw error;
      console.warn("effect words: session not read, trying again", job.postId, error);
    }
    if (state?.stopped) return done(job, effect, state);
    if (Date.now() - new Date(effect.started).getTime() > TIMEOUT_MINUTES * 60_000) throw new Error("effect words: the session took too long");
    // A job without news for a while is taken for dead: the step is kept fresh.
    if (Date.now() - freshAt > 2 * 60_000) {
      await setJobStage(job.jobId, "render");
      freshAt = Date.now();
    }
    if (Date.now() > until) return next(job, { step: "wait" });
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/** Its video with her words becomes the Reel's new version: the same kit (or the one it corrected), Simone's music on it. */
async function done(job: Job, effect: NonNullable<Job["effect"]>, state: EffectsState) {
  const db = supabaseAdmin();
  const out = await collectEffects(effect.session, effect.files);
  await logEffectsCost(job.studioId, job.postId, effect.session, state, "effects_replay");
  if (!out) throw new Error(`effect words: no video (${(await replayError(effect.session, effect.files)) ?? state.stop ?? "stopped"})`);
  const { data } = await db.from("edit_plans").select("plan").eq("id", job.planId).eq("post_id", job.postId).single();
  const before = editPlanSchema.parse(data?.plan);
  if (!before.baked?.kit) throw new Error("effect words: the version lost its kit");
  const path = `${job.studioId}/ai/effect-${job.postId}-${Date.now()}.mp4`;
  const upload = await db.storage.from("media").upload(path, out.mp4, { contentType: "video/mp4", upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const asset = await db
    .from("media_assets")
    .insert({
      studio_id: job.studioId,
      storage_path: path,
      kind: "video",
      // Simone's montage, not one of her videos: left out of her library, the pickers and the clip sort.
      source: "render",
      mime_type: "video/mp4",
      size_bytes: out.mp4.length,
      duration: out.seconds,
      ai: { mode: "effect", session: effect.session, words: true },
      consent_ok: true,
    })
    .select("id")
    .single();
  if (asset.error) throw new Error(asset.error.message);
  const mediaId = asset.data.id as string;
  // The kit it corrected to run, else the same one: kept by this video, removed with it.
  const fixed = await correctedKit(effect.session, effect.files).catch(() => null);
  const kit = fixed ? await keepKit(job.studioId, mediaId, fixed) : await copyKit(job.studioId, before.baked.kit, mediaId);
  const plan = effectPlan({
    mediaId,
    seconds: out.seconds,
    session: before.baked.session,
    ...(before.voice ? { voice: before.voice } : {}),
    kit: kit ? { path: kit, words: job.words, files: before.baked.files ?? [] } : null,
  });
  const row = await insertPlanVersion(job.studioId, job.postId, plan);
  const rendered = await renderPost(job.studioId, job.postId, { editPlanId: row.id });
  await endEffectsSession(effect.session, effect.files);
  await finishJob(job.jobId);
  if (job.tell) {
    await deliverMontage(
      { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, conversationId: job.conversationId, rationale: "J’ai posé tes nouveaux mots sur l’effet.", offerVariant: false },
      rendered,
    );
  }
  const cost = state.costUsd === null ? null : usdToEur(state.costUsd, env("USD_TO_EUR"));
  console.log("effect words: drawn again", job.postId, cost === null ? "" : `${cost.toFixed(2)} €`);
}

async function run(job: Job) {
  try {
    if (job.step === "start") await start(job);
    else await wait(job);
  } catch (error) {
    console.error("effect words failed", job.postId, error);
    if (job.effect) await endEffectsSession(job.effect.session, job.effect.files).catch(() => {});
    await finishJob(job.jobId, true);
    await notifyFailure(
      { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, conversationId: job.conversationId },
      "Je n’ai pas réussi à poser tes nouveaux mots sur l’effet : ta vidéo reste telle quelle. Dis-moi ce que tu veux changer et je refais l’effet avec.",
      error,
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid job" }, { status: 400 });
  const job = parsed.data;
  after(() => run(job));
  return Response.json({ queued: "effect-words", step: job.step }, { status: 202 });
}
