import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import {
  alternativeBrief,
  blockingIssues,
  EFFECT_MAX_CREDITS,
  EFFECTS_TIMEOUT_MINUTES,
  effectPlan,
  effectWords,
  EFFORTS,
  effortSchema,
  effortVersions,
  editPlanSchema,
  fixBrief,
  followedChecks,
  MAX_FREE_SCENES,
  montageIssueSchema,
  MAX_MONTAGE_FILES,
  motionTemplateSchema,
  reelFormatSchema,
  usdToEur,
  variantPlan,
  VOICE_AT,
} from "@fauve/agent";
import { reviewMontage } from "@/lib/agent/critic";
import { designEdit } from "@/lib/agent/editor";
import {
  collectEffects,
  effectRoute,
  effectsState,
  endEffectsSession,
  logEffectsCost,
  startEffectsSession,
  type EffectsState,
} from "@/lib/agent/effects-agent";
import { voiceOverIfWanted } from "@/lib/voice-over";
import { chargeQuote, montageCost, quoteSuperseded, restoreChainQuote, setQuoteStage, switchQuoteToEffect } from "@/lib/credits";
import { insertPlanVersion } from "@/lib/edit-plans";
import { keepKit } from "@/lib/effect-words";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { ensureCaption } from "@/lib/agent/caption-writer";
import { deliverMontage, notifyFailure, renderAndDeliver } from "@/lib/render/deliver";
import { renderPost } from "@/lib/render/render-post";
import { postStyle } from "@/lib/steal";
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
  step: z.enum(["design", "effects", "effects_wait", "alternative", "variant", "render", "review", "fix"]),
  studioId: z.uuid(),
  postId: z.uuid(),
  mediaIds: z.array(z.uuid()).max(MAX_MONTAGE_FILES).optional(),
  /** The manager's request, with the plan she said yes to. */
  brief: z.string().max(4000).optional(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  /** Started from the app (« Créer »): the delivery also reaches her on WhatsApp. */
  notify: z.boolean().optional(),
  /** Asked in a conversation of the app: delivered in it, not in the latest automatic one. */
  conversationId: z.uuid().optional(),
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
  /** She wanted a voice over, but someone speaks in her videos: their words were kept, told at delivery. */
  spokenKept: z.boolean().optional(),
  /** The voice step is done: the design goes on (in its own invocation when a voice was recorded). */
  voiced: z.boolean().optional(),
  /** Simone chose a key message with the music over a voice for this Reel (her setting is « auto »). */
  format: reelFormatSchema.optional(),
  /** Who makes this Reel, decided once at its design: the effects agent or the chain. */
  route: z.enum(["agent", "chain"]).optional(),
  /** The agent's session at work: its id, the files it was given, its voice, when it started, her files by the names it knows them. */
  effect: z
    .object({
      session: z.string().max(80),
      files: z.array(z.string().max(80)).max(40),
      voice: z.uuid().nullable(),
      started: z.string().max(40),
      names: z.array(z.object({ name: z.string().max(60), media_id: z.string().max(80) })).max(25).optional(),
    })
    .optional(),
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
  // Replaced by a newer request on this Reel: stop here (its effects session too), nothing goes out.
  if (await quoteSuperseded(job.quoteId)) {
    console.log("montage superseded, stopped", job.postId, job.quoteId, job.step);
    if (job.effect) await endEffectsSession(job.effect.session, job.effect.files).catch(() => {});
    return;
  }
  const target = { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, notify: job.notify, conversationId: job.conversationId };
  const level = job.effort ? EFFORTS[job.effort] : null;

  // A Reel whose effect holds to what moves in her video: the effects agent makes it, whatever the level of care.
  if (job.step === "effects" || job.step === "effects_wait") {
    try {
      if (job.step === "effects") await effects(job);
      else await effectsWait(job);
    } catch (error) {
      await backToChain(job, error);
    }
    return;
  }
  if (job.step === "design" && (await effectsFirst(job))) return;
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
      const delivered = await renderAndDeliver({ ...target, rationale: job.rationale, note: job.note ?? job.rationale, offerVariant: true, voice: job.voice, spokenKept: job.spokenKept, cost });
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
      await queueJob("montage", { ...target, step: "render", rationale: edit.rationale, quoteId: job.quoteId, newScenes: edit.newScenes, effort: job.effort, voice: job.voice, spokenKept: job.spokenKept });
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
  // A Reel with an effect too, as any Reel (Tristan: « oui »): her choice, else her business's, else Simone's.
  const made = await voiceOverIfWanted({ studioId: job.studioId, postId: job.postId, mediaIds: job.mediaIds, correction: job.correction, brief: job.brief });
  if (!made) return false;
  if ("spokenKept" in made) {
    Object.assign(job, { voiced: true, spokenKept: true });
    return false;
  }
  // A key message with the music suits it better: no voice, the editor knows it, the design goes on now.
  if ("format" in made) {
    Object.assign(job, { voiced: true, format: made.format });
    return false;
  }
  await next(job, { step: "design", voiced: true, voice: made.voice, format: "raconte" });
  return true;
}

/**
 * The design step of a Reel the effects agent makes (the route is decided once, when the montage
 * starts, else here: effectRoute): its voice over first when it takes one, as any Reel (the agent sets
 * its cuts on it), then the session, started in its own invocation. False: the chain makes it.
 */
async function effectsFirst(job: Job): Promise<boolean> {
  try {
    if (job.route === "chain") return false;
    if (!job.route) job.route = await effectRoute(job.studioId, { postId: job.postId, correction: Boolean(job.correction), brief: job.brief, mediaIds: job.mediaIds });
    if (job.route !== "agent") return false;
    await setQuoteStage(job.quoteId, "design");
    if (await voiceFirst(job)) return true;
    await next(job, { step: "effects" });
    return true;
  } catch (error) {
    console.warn("effects: not started, the chain makes the Reel", job.postId, error);
    job.route = "chain";
    return false;
  }
}

/** The effects agent cannot make this one, with what to tell her (a correction of her effect: the chain cannot take it). */
class EffectUnavailable extends Error {}

/**
 * Starts the agent's session, priced as an effect: charged on its real cost once made, up to a ceiling
 * held meanwhile, which its spending limit follows (the chain makes the Reel when her credits leave too little).
 */
async function effects(job: Job) {
  await setQuoteStage(job.quoteId, "effects");
  const ceiling = job.quoteId ? await switchQuoteToEffect(job.quoteId, Boolean(job.correction)) : EFFECT_MAX_CREDITS[job.correction ? "fix" : "reel"];
  if (ceiling === null) {
    // A correction of her effect cannot be made by the chain: it waits for her credits (nothing is charged).
    if (job.correction) throw new EffectUnavailable("Il ne te reste pas assez de crédits pour refaire l’effet : ils reviennent le 1er du mois.");
    console.log("effects: too few credits for an effect, the chain makes it", job.postId);
    await next(job, { step: "design", route: "chain" });
    return;
  }
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("media_ids, render_id").eq("id", job.postId).eq("studio_id", job.studioId).single();
  const mediaIds = job.mediaIds?.length ? job.mediaIds : ((post?.media_ids as string[] | null) ?? []);
  // A correction reworks the video she saw.
  const previous = job.correction && post?.render_id ? (await db.from("renders").select("storage_path").eq("id", post.render_id as string).maybeSingle()).data : null;
  const started = await startEffectsSession({
    studioId: job.studioId,
    postId: job.postId,
    mediaIds,
    request: job.brief?.trim() || "Un Reel avec l’effet qu’elle imagine sur sa vidéo.",
    previousRender: (previous?.storage_path as string | null) ?? null,
    ceiling,
  });
  // On the job before the next call: if it cannot be queued, the session is ended with the rest.
  job.effect = { ...started, started: new Date().toISOString() };
  await next(job, { step: "effects_wait" });
}

/**
 * How long one invocation waits on the session (the next one takes over), and how often it looks: the
 * session can end on the last look, and its video, music and delivery need a few minutes of the 800 s.
 */
const EFFECTS_WAIT_MS = 8 * 60_000;
const EFFECTS_POLL_MS = 20_000;

/** Waits on the session, keeping the step fresh (a job without news for a while is dead), then delivers its video. */
async function effectsWait(job: Job) {
  const effect = job.effect;
  if (!effect) throw new Error("effects: no session to wait on");
  const until = Date.now() + EFFECTS_WAIT_MS;
  let freshAt = 0;
  let misses = 0;
  for (;;) {
    let state: EffectsState | null = null;
    try {
      state = await effectsState(effect.session);
      misses = 0;
    } catch (error) {
      // A look that fails (the API, the network) is tried again: the session works on without us.
      if (++misses >= 5) throw error;
      console.warn("effects: session not read, trying again", job.postId, error);
    }
    if (state?.stopped) {
      await effectsDone(job, effect, state);
      return;
    }
    if (Date.now() - new Date(effect.started).getTime() > EFFECTS_TIMEOUT_MINUTES * 60_000) throw new Error("effects: the session took too long");
    if (Date.now() - freshAt > 2 * 60_000) {
      await setQuoteStage(job.quoteId, "effects");
      freshAt = Date.now();
    }
    if (Date.now() > until) {
      await next(job, { step: "effects_wait" });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, EFFECTS_POLL_MS));
  }
}

/**
 * The session is over: its video becomes the Reel's new version (a plan of one shot, the music
 * mixed on it by the render), goes to her like any montage, and nothing of hers stays at Anthropic.
 */
async function effectsDone(job: Job, effect: NonNullable<Job["effect"]>, state: EffectsState) {
  const out = await collectEffects(effect.session, effect.files);
  await logEffectsCost(job.studioId, job.postId, effect.session, state);
  if (!out) throw new Error(`effects: no video out of the session (${state.stop ?? "stopped"})`);
  await setQuoteStage(job.quoteId, "render");
  const db = supabaseAdmin();
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
      ai: { mode: "effect", session: effect.session, notes: out.notes },
      consent_ok: true,
    })
    .select("id")
    .single();
  if (asset.error) throw new Error(asset.error.message);
  // Its kit (its script and what it reads) and the texts it draws: she changes them herself, its script draws them again.
  const kit = out.kit ? await keepKit(job.studioId, asset.data.id as string, out.kit.tar) : null;
  const plan = effectPlan({
    mediaId: asset.data.id as string,
    seconds: out.seconds,
    session: effect.session,
    // Her voice is in the video already: the plan names it for the music (under a voice) and the page.
    ...(effect.voice ? { voice: { media_id: effect.voice, at: VOICE_AT } } : {}),
    kit: kit && out.kit ? { path: kit, words: out.kit.words, files: effect.names ?? [] } : null,
  });
  const row = await insertPlanVersion(job.studioId, job.postId, plan);
  // Its video is made: a render that fails (the music's sandbox, the upload) is tried once more before the chain starts over.
  const rendered = await renderPost(job.studioId, job.postId, { editPlanId: row.id }).catch((error: unknown) => {
    console.warn("effects: render of the agent's video failed, trying again", job.postId, error);
    return renderPost(job.studioId, job.postId, { editPlanId: row.id });
  });
  await endEffectsSession(effect.session, effect.files);
  job.effect = undefined;
  const costEur = state.costUsd === null ? null : usdToEur(state.costUsd, env("USD_TO_EUR"));
  await deliver(job, { planId: row.id, renderId: rendered.renderId, rationale: out.message?.slice(0, 600) }, { reviewed: false, effect: { checked: state.satisfied, costEur, words: effectWords(plan).length > 0 } });
}

/**
 * The agent could not make the Reel: a new one goes to the chain, at its own price; a correction of her
 * effect fails without a charge (the chain cannot correct a video drawn image by image, she keeps hers).
 * Nothing of hers stays at Anthropic.
 */
async function backToChain(job: Job, error: unknown) {
  console.error(`montage ${job.step} failed, ${job.correction ? "the effect stays as it was" : "the chain takes the Reel back"}`, job.postId, error);
  const target = { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, notify: job.notify, conversationId: job.conversationId };
  if (job.effect) await endEffectsSession(job.effect.session, job.effect.files).catch(() => {});
  if (job.quoteId) await restoreChainQuote(job.quoteId);
  if (job.correction) {
    await reopenQuote(job.quoteId);
    const said = error instanceof EffectUnavailable ? error.message : "Je n’ai pas réussi à refaire l’effet cette fois : ta version d’avant reste telle quelle. Aucun crédit n’a été débité. Tu veux que je réessaie ?";
    await notifyFailure(target, said, error);
    return;
  }
  try {
    await next(job, { step: "design", route: "chain", effect: undefined });
  } catch (e) {
    await reopenQuote(job.quoteId);
    await notifyFailure(target, FAILED, e);
  }
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
      // The Reel she copies stays the model of the second take too: what it does not have is not asked.
      brief: alternativeBrief(plan, job.brief, followedChecks(await postStyle(job.studioId, job.postId).catch(() => undefined))),
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
      // A defect left after the last round, else the critic's first opinion: hers to decide.
      left: verdict?.review.issues[0]?.problem,
    });
    return;
  }
  try {
    await next(job, {
      step: "fix",
      versions: [best],
      // Only its defects: an opinion is told to her, never corrected.
      issues: blockingIssues(verdict.review),
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
  /** Made by the effects agent: its grader passed it (checked) or not, what its session cost (€, null: not read), and whether she can change its words herself. */
  effect?: { checked: boolean; costEur: number | null; words?: boolean };
};

/** The care sentence of the delivery message, from what really happened. */
function careLine(compared: boolean, outcome: Care | null): string {
  // The agent says what it made in its own words (the rationale): only a check that really passed is added.
  if (outcome?.effect) {
    return [
      outcome.effect.checked ? "J’ai vérifié l’effet image par image, à chaque geste, avant de te l’envoyer." : "",
      // Where she changes its words (the agent never names its files to her), read in the chat and on its page alike.
      outcome.effect.words ? "Ses mots, tu peux les changer toi-même : « Changer quelque chose », puis « Le texte à l’écran »." : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
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
  if (await quoteSuperseded(job.quoteId)) {
    console.log("montage superseded, not delivered", job.postId, job.quoteId);
    return true;
  }
  const target = { studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo, notify: job.notify, conversationId: job.conversationId };
  const db = supabaseAdmin();
  await db.from("posts").update({ edit_plan_id: best.planId, render_id: best.renderId }).eq("id", job.postId).eq("studio_id", job.studioId);
  const [post, render] = await Promise.all([
    db.from("posts").select("title").eq("id", job.postId).single(),
    db.from("renders").select("duration_ms").eq("id", best.renderId!).single(),
  ]);
  const title = (post.data?.title as string | null) ?? "";
  // A Reel from « Créer » has no caption yet: written before she opens its page (never blocks the delivery).
  await ensureCaption(job.studioId, job.postId, best.planId, job.brief).catch((error) => console.error("caption failed", job.postId, error));
  const care = careLine(Boolean(job.compared), outcome);
  // The review priced is not charged when the critic could not watch the video, nor a second take never compared.
  // An effect is charged on what its session really cost (effectCredits).
  const skipped = outcome?.effect
    ? { effectEur: outcome.effect.costEur }
    : {
        skipReview: !outcome?.reviewed && Boolean(job.effort && EFFORTS[job.effort].review),
        skipAlternative: Boolean(job.effort && effortVersions(job.effort, Boolean(job.correction)) > 1 && !job.compared),
      };
  try {
    await deliverMontage(
      {
        ...target,
        rationale: best.rationale,
        care: care || undefined,
        // Kept on the post within 600 characters, cut after a whole sentence (shortSentence in deliver.ts), never mid-word:
        // a slice here left Simone's note ending on « Si tu veux, je peux encore ».
        note: [best.rationale, care].filter(Boolean).join(" ") || undefined,
        // Two versions were already compared: no variant offered on top; an effect has no hook of the engine's to change.
        offerVariant: !job.compared && !outcome?.effect,
        voice: job.voice,
        spokenKept: job.spokenKept,
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
  await supabaseAdmin().from("credit_quotes").update({ used_at: null, stage: null }).eq("id", quoteId).is("charged_at", null).or("stage.is.null,stage.neq.superseded");
  await finishJob(quoteId, true);
}
