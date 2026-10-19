import "server-only";
import { createHash } from "node:crypto";
import { toFile } from "@anthropic-ai/sdk";
import {
  ANALYST_MODEL,
  brandProfileSchema,
  CLAUDE_MODEL,
  clipAnalysisSchema,
  EFFECT_ROUTER_PROMPT,
  effectRouteSchema,
  effectsBudgetCents,
  EFFECTS_MAX_ITERATIONS,
  EFFECTS_SYSTEM,
  effectsMessage,
  effectsRubric,
  effectsTask,
  followedLine,
  isBaked,
  mp4Duration,
  readMemory,
  signatureLines,
  usdToEur,
  voiceTranscriptSchema,
  type EditPlan,
  type EffectRoute,
  type EffectsTaskInput,
} from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { env } from "@/lib/env";
import { TRACK_MODELS } from "@/lib/render/sandbox";
import { postStyle } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The effects agent (packages/agent/src/effects.ts): one Opus agent with a Linux container
// of its own (Managed Agents) makes a Reel whose effect holds to what moves in her video.
// Her files go to Anthropic's container for the session (the same provider already reads
// their frames for the review) and leave the Files API, with the session, once its video
// is kept. The environment and the agent are made once and found again by their name.

const NAME = "simone-effects";
const MANAGED_AGENTS = "managed-agents-2026-04-01";
const MEDIA = "media";

/**
 * The container: ffmpeg and the libraries MediaPipe links, MediaPipe, OpenCV and Pillow, and
 * Google Fonts for the lettering; nothing else on the network. The Python packages are not
 * pinned: the container's own Python decides their versions (pins made for our tracker's
 * Python 3.13 failed there: « pip could not install numpy==2.5.4 »).
 */
const CONFIG = {
  type: "cloud" as const,
  networking: { type: "limited" as const, allow_package_managers: true, allowed_hosts: ["fonts.googleapis.com", "fonts.gstatic.com"] },
  packages: {
    apt: ["ffmpeg", "libegl1", "libgles2", "libgl1", "fonts-dejavu-core"],
    pip: ["mediapipe", "opencv-python-headless", "pillow"],
  },
};

const extension = (mime: string | null, kind: string) =>
  ({ "video/quicktime": "mov", "video/mp4": "mp4", "video/webm": "webm", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/mp4": "m4a" })[
    (mime ?? "").split(";")[0]!.trim()
  ] ?? (kind === "image" ? "jpg" : kind === "audio" ? "mp3" : "mp4");

/**
 * Who makes her Reel: the effects agent when her request draws on what moves in her video,
 * else the chain. Sonnet reads her request; nothing is asked without a video, and a failed
 * reading leaves the Reel to the chain.
 */
export async function routeEffect(studioId: string, request: string | undefined, files: { videos: number; photos: number }): Promise<EffectRoute> {
  const chain = { agent: false, effect: "", why: "" };
  if (!request?.trim() || !files.videos) return chain;
  try {
    const response = await anthropic().beta.messages.parse({
      model: ANALYST_MODEL,
      max_tokens: 400,
      output_config: { effort: "low", format: outputFormat(effectRouteSchema) },
      system: EFFECT_ROUTER_PROMPT,
      messages: [{ role: "user", content: JSON.stringify({ demande: request.slice(0, 3000), videos: files.videos, photos: files.photos }) }],
    });
    await logClaudeCost(studioId, response.usage, "effect_route", ANALYST_MODEL);
    return response.parsed_output ?? chain;
  } catch (error) {
    console.warn("effects: route not decided, the chain makes it", error);
    return chain;
  }
}

/**
 * Who makes a montage: a correction of a Reel the effects agent drew goes back to it (the chain cannot
 * correct a video drawn image by image), a new Reel goes to it when her request holds an effect on what
 * moves in her video (routeEffect; never when EFFECTS_AGENT is off); the chain makes everything else.
 * Decided once, when the montage starts (her reply says how long it takes), and kept on the job.
 */
export async function effectRoute(studioId: string, input: { postId: string; correction: boolean; brief?: string | null; mediaIds?: string[] }): Promise<"agent" | "chain"> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("kind, edit_plan_id, media_ids").eq("id", input.postId).eq("studio_id", studioId).maybeSingle();
  if (post?.kind !== "reel") return "chain";
  if (input.correction) {
    const current = post.edit_plan_id ? (await db.from("edit_plans").select("plan").eq("id", post.edit_plan_id as string).maybeSingle()).data : null;
    return isBaked(current?.plan as EditPlan | null) ? "agent" : "chain";
  }
  if (!env("EFFECTS_AGENT")) return "chain";
  const ids = input.mediaIds?.length ? input.mediaIds : ((post.media_ids as string[] | null) ?? []);
  const { data: media } = ids.length ? await db.from("media_assets").select("kind").eq("studio_id", studioId).in("id", ids) : { data: [] };
  const videos = (media ?? []).filter((m) => m.kind === "video").length;
  const route = await routeEffect(studioId, input.brief ?? undefined, { videos, photos: (media ?? []).length - videos });
  if (route.agent) console.log("montage: effects agent", input.postId, route.effect, "—", route.why);
  return route.agent ? "agent" : "chain";
}

/** The environment and the agent, created once and found again by name; both follow CONFIG and EFFECTS_SYSTEM. */
export async function effectsSetup(): Promise<{ environment: string; agent: string }> {
  const client = anthropic();
  let environment: string | undefined;
  for await (const e of client.beta.environments.list()) {
    if (e.name === NAME && !e.archived_at) environment = e.id;
  }
  // An update only reaches new containers: the sessions already running keep theirs.
  if (environment) await client.beta.environments.update(environment, { config: CONFIG });
  else environment = (await client.beta.environments.create({ name: NAME, config: CONFIG })).id;
  const definition = {
    model: { id: CLAUDE_MODEL, effort: "high" as const },
    system: EFFECTS_SYSTEM,
    // An unattended run in a sandbox with no secret and a closed network: its tools run without asking.
    tools: [
      {
        type: "agent_toolset_20260401" as const,
        default_config: { enabled: true, permission_policy: { type: "always_allow" as const } },
        configs: [
          { name: "web_fetch" as const, enabled: false },
          { name: "web_search" as const, enabled: false },
        ],
      },
    ],
  };
  for await (const a of client.beta.agents.list()) {
    if (a.name !== NAME || a.archived_at) continue;
    if (a.system !== EFFECTS_SYSTEM) await client.beta.agents.update(a.id, { ...definition, version: a.version });
    return { environment, agent: a.id };
  }
  const agent = await client.beta.agents.create({ name: NAME, ...definition });
  return { environment, agent: agent.id };
}

async function stored(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(MEDIA).download(path);
  if (!data) throw new Error(`effects: ${path}: ${error?.message ?? "missing"}`);
  return Buffer.from(await data.arrayBuffer());
}

/** A MediaPipe model, as the tracker pins it (by its checksum). */
async function model(m: (typeof TRACK_MODELS)[number]): Promise<Buffer> {
  const response = await fetch(m.url);
  if (!response.ok) throw new Error(`effects: ${m.file}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== m.sha256) throw new Error(`effects: ${m.file}: checksum`);
  return bytes;
}

/** A session at work: its id, the files it was given (deleted with it), the voice it was given (her media). */
export type EffectsSession = { session: string; files: string[]; voice: string | null };

/**
 * Starts the agent on her Reel: her files (videos and photos), her voice over when the post
 * has one, the version she saw for a correction, her business, her charter and the Reel she
 * copies; it works on its own (effectsState, then collectEffects).
 */
export async function startEffectsSession(input: {
  studioId: string;
  postId: string;
  mediaIds: string[];
  request: string;
  /** A correction: the video she saw (the post's current render). */
  previousRender?: string | null;
  /** The most she can be charged for it (credits): the session's spending limit follows. */
  ceiling: number;
}): Promise<EffectsSession> {
  const cents = effectsBudgetCents(input.ceiling, usdToEur(1, env("USD_TO_EUR")));
  if (cents < 100) throw new Error("effects: budget too small for an effect");
  const db = supabaseAdmin();
  const client = anthropic();
  const [{ environment, agent }, studio, brand, post, assets] = await Promise.all([
    effectsSetup(),
    db.from("studios").select("name, business_type, memory").eq("id", input.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", input.studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("posts").select("voice_media_id").eq("id", input.postId).eq("studio_id", input.studioId).single(),
    input.mediaIds.length
      ? db.from("media_assets").select("id, kind, storage_path, mime_type, duration").eq("studio_id", input.studioId).in("id", input.mediaIds)
      : Promise.resolve({ data: [] as { id: string; kind: string; storage_path: string; mime_type: string | null; duration: number | null }[] }),
  ]);
  const media = input.mediaIds.flatMap((id) => (assets.data ?? []).filter((a) => a.id === id && (a.kind === "video" || a.kind === "image")));
  if (!media.some((m) => m.kind === "video")) throw new Error("effects: no video to work on");
  const { data: analyses } = await db.from("clip_analyses").select("media_id, analysis").in("media_id", media.map((m) => m.id as string));
  const about = new Map(
    (analyses ?? []).flatMap((a) => {
      const read = clipAnalysisSchema.safeParse(a.analysis);
      return read.success ? [[a.media_id as string, read.data.summary.slice(0, 300)]] : [];
    }),
  );
  const profile = brandProfileSchema.pick({ colors: true, fonts: true, tone: true, signature: true }).partial().catch({}).parse(brand.data?.profile ?? {});
  const followed = await postStyle(input.studioId, input.postId).catch(() => undefined);

  // Her files, named by their order (« video1.mov », « photo2.jpg »), then her voice, the version she saw, the models.
  let videos = 0;
  let photos = 0;
  const uploads: { name: string; mount: string; bytes: () => Promise<Buffer> }[] = [];
  const files: EffectsTaskInput["files"] = media.map((m) => {
    const kind = m.kind === "video" ? "video" : "photo";
    const name = `${kind}${kind === "video" ? ++videos : ++photos}.${extension(m.mime_type as string | null, m.kind as string)}`;
    uploads.push({ name, mount: `/${name}`, bytes: () => stored(m.storage_path as string) });
    return { name, kind, seconds: m.kind === "video" && m.duration !== null ? Number(m.duration) : null, about: about.get(m.id as string) ?? null };
  });
  let voice: EffectsTaskInput["voice"] = null;
  if (post.data?.voice_media_id) {
    const { data: asset } = await db.from("media_assets").select("storage_path, mime_type, transcript").eq("id", post.data.voice_media_id as string).maybeSingle();
    const transcript = voiceTranscriptSchema.safeParse(asset?.transcript);
    if (asset && transcript.success) {
      const name = `voix.${extension(asset.mime_type as string | null, "audio")}`;
      uploads.push({ name, mount: `/${name}`, bytes: () => stored(asset.storage_path as string) });
      uploads.push({ name: "voix.json", mount: "/voix.json", bytes: async () => Buffer.from(JSON.stringify(transcript.data.words)) });
      voice = { name, words: "voix.json", seconds: transcript.data.duration, text: transcript.data.text };
    }
  }
  if (input.previousRender) uploads.push({ name: "avant.mp4", mount: "/avant.mp4", bytes: () => stored(input.previousRender!) });
  for (const m of TRACK_MODELS) uploads.push({ name: m.file, mount: `/models/${m.file}`, bytes: () => model(m) });

  const task = effectsTask({
    request: input.request,
    studio: {
      name: (studio.data?.name as string | null) ?? "",
      business: (studio.data?.business_type as string | null) ?? null,
      facts: readMemory(studio.data?.memory).map((f) => f.fact).slice(0, 12),
      tone: profile.tone ?? null,
    },
    brand: { colors: profile.colors ?? [], fonts: profile.fonts ?? [], signature: signatureLines(profile.signature) },
    files,
    voice,
    copied: followed ? followedLine(followed) : null,
    previous: input.previousRender ? { name: "avant.mp4" } : null,
    models: TRACK_MODELS.map((m) => m.file),
    budgetUsd: cents / 100,
  });

  const uploaded: string[] = [];
  try {
    const resources = [];
    for (const u of uploads) {
      const file = await client.files.upload({ file: await toFile(await u.bytes(), u.name) });
      uploaded.push(file.id);
      resources.push({ type: "file" as const, file_id: file.id, mount_path: u.mount });
    }
    const session = await client.beta.sessions.create({
      agent,
      environment_id: environment,
      title: `Reel ${input.postId}`,
      resources,
      budget: { type: "limit", max_list_cost: { amount: String(cents), currency: "USD" } },
      initial_events: [
        { type: "user.define_outcome", description: task, rubric: { type: "text", content: effectsRubric({ voice: Boolean(voice) }) }, max_iterations: EFFECTS_MAX_ITERATIONS },
      ],
      metadata: { studio: input.studioId, post: input.postId },
    });
    return { session: session.id, files: uploaded, voice: voice ? (post.data!.voice_media_id as string) : null };
  } catch (error) {
    // Nothing of hers stays at Anthropic when the session could not start.
    await Promise.all(uploaded.map((id) => client.files.delete(id).catch(() => undefined)));
    throw error;
  }
}

export type EffectsState = {
  /** The session stopped: its outcome is known (its video, if any, can be collected). */
  stopped: boolean;
  /** Why it went idle (end_turn, budget_reached, retries_exhausted…), when it did. */
  stop: string | null;
  /** The grader was satisfied with the last version. */
  satisfied: boolean;
  costUsd: number | null;
  activeSeconds: number | null;
  usage: Record<string, unknown>;
};

/** Where a session is: stopped or not, the grader's last word, what it has cost so far. */
export async function effectsState(sessionId: string): Promise<EffectsState> {
  const client = anthropic();
  const session = await client.beta.sessions.retrieve(sessionId);
  let stop: string | null = null;
  if (session.status === "idle") {
    for await (const e of client.beta.sessions.events.list(sessionId, { order: "desc", limit: 5, types: ["session.status_idle"] })) {
      if (e.type === "session.status_idle") stop = e.stop_reason.type;
      break;
    }
  }
  const last = session.outcome_evaluations.at(-1);
  return {
    // Waiting on a tool confirmation is not stopped (the agent's tools never ask, but a pause must not end the Reel).
    stopped: session.status === "terminated" || (session.status === "idle" && stop !== "requires_action"),
    stop,
    satisfied: last?.result === "satisfied",
    costUsd: session.usage.list_cost ? Number(session.usage.list_cost.amount) / 100 : null,
    activeSeconds: session.usage.active_seconds ?? null,
    usage: session.usage as unknown as Record<string, unknown>,
  };
}

export type EffectsOutput = { mp4: Buffer; seconds: number; message: string | null; notes: string | null };

/** What the session wrote out: its video (null when there is none or it cannot be read), its words for her, its notes. */
export async function collectEffects(sessionId: string, given: string[]): Promise<EffectsOutput | null> {
  const client = anthropic();
  const out = new Map<string, string>();
  // The index of the session's files lags its end by a few seconds.
  for (let attempt = 0; attempt < 3 && !out.has("reel.mp4"); attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 3000));
    for await (const f of client.beta.files.list({ scope_id: sessionId, betas: [MANAGED_AGENTS] })) {
      // The session's scope also lists the files it was given, which cannot be downloaded back.
      if (f.downloadable === false || given.includes(f.id)) continue;
      out.set(f.filename.split("/").pop()!, f.id);
    }
  }
  const reel = out.get("reel.mp4");
  if (!reel) return null;
  const text = async (name: string) => {
    const id = out.get(name);
    return id ? (await client.files.download(id)).text().catch(() => null) : null;
  };
  const mp4 = Buffer.from(await (await client.files.download(reel)).arrayBuffer());
  const seconds = mp4Duration(mp4);
  if (!seconds) return null;
  return { mp4, seconds, message: effectsMessage(await text("message.txt")), notes: (await text("notes.md"))?.slice(0, 4000) ?? null };
}

/** The session's spend at list prices, logged on the studio once it is over. */
export async function logEffectsCost(studioId: string, postId: string, sessionId: string, state: EffectsState) {
  if (state.costUsd === null) return;
  const usage = state.usage as { input_tokens?: number; output_tokens?: number };
  const { error } = await supabaseAdmin()
    .from("cost_events")
    .insert({
      studio_id: studioId,
      kind: "llm",
      provider: "anthropic",
      units: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
      cost_eur: usdToEur(state.costUsd, env("USD_TO_EUR")),
      meta: { model: CLAUDE_MODEL, purpose: "effects_agent", post_id: postId, session: sessionId, usage: state.usage, active_seconds: state.activeSeconds, cost_usd: state.costUsd },
    });
  if (error) console.error("cost_events insert failed", error.message);
}

/** Her files leave the Files API and the session (its container and history) is deleted: nothing of hers stays. */
export async function endEffectsSession(sessionId: string, files: string[]) {
  const client = anthropic();
  await Promise.all(files.map((id) => client.files.delete(id).catch(() => undefined)));
  // A session still running is stopped first: a deleted session keeps nothing.
  await client.beta.sessions.events.send(sessionId, { events: [{ type: "user.interrupt" }] }).catch(() => undefined);
  await client.beta.sessions.delete(sessionId).catch((error: unknown) => console.warn("effects: session not deleted", sessionId, error));
}
