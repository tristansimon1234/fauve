import "server-only";
import { createHash } from "node:crypto";
import { toFile } from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, usdToEur } from "@fauve/agent";
import { anthropic } from "@/lib/agent/run";
import { env } from "@/lib/env";
import { TRACK_MODELS } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A lab experiment only (Tristan: « pourquoi on donne pas à Opus un accès à un env dans le
// cloud et on le laisse tout gérer ? »): one Opus agent with a Linux container of its own
// (Managed Agents) makes the effect she imagines on her video alone, as Opus does it in a chat:
// it looks, measures what moves (MediaPipe), draws each image in code, looks at its result and
// corrects it, and a grader checks the result against a rubric. To compare with the montage
// chain (editor, motion designer, critic) on the same clips: quality, time and cost.
// Her video goes to Anthropic's container; it is deleted from the Files API once the run is saved.

const NAME = "simone-lab-effects";
/** A hard ceiling on one session's spend at list prices, in cents. */
const BUDGET_CENTS = "1500";
const MAX_ITERATIONS = 3;
const MANAGED_AGENTS = "managed-agents-2026-04-01";
const MEDIA = "media";

/**
 * The container: ffmpeg and the libraries MediaPipe links, MediaPipe, OpenCV and Pillow, and
 * Google Fonts for the lettering. Nothing else on the network. The Python packages are not
 * pinned: the container's own Python decides their versions (our tracker's pins, made for
 * Python 3.13, failed there: « pip could not install numpy==2.5.4 »).
 */
const CONFIG = {
  type: "cloud" as const,
  networking: { type: "limited" as const, allow_package_managers: true, allowed_hosts: ["fonts.googleapis.com", "fonts.gstatic.com"] },
  packages: {
    apt: ["ffmpeg", "libegl1", "libgles2", "libgl1", "fonts-dejavu-core"],
    pip: ["mediapipe", "opencv-python-headless", "pillow"],
  },
};

const SYSTEM = `Tu es le monteur et motion designer de Simone, l'assistante qui fait les réseaux sociaux des commerces de quartier. Tu travailles seul, dans un conteneur Linux, sur la vraie vidéo d'une gérante, pour faire l'effet qu'elle imagine. Tu as bash, Python 3, ffmpeg, MediaPipe, OpenCV, Pillow et numpy ; les polices de Google Fonts se téléchargent (fonts.googleapis.com, fonts.gstatic.com), rien d'autre sur le réseau. Personne ne répond pendant le travail : ne pose aucune question, décide.

Ta façon de travailler, celle d'un bon motion designer :
- regarde d'abord : des planches d'images de sa vidéo (et du Reel qu'elle veut recopier s'il y en a un) aux moments qui comptent ;
- mesure ce dont l'effet a besoin, image par image (les mains et le bout des doigts, le visage, le corps), avec les modèles MediaPipe fournis, et vérifie la mesure en dessinant des repères sur quelques images ;
- dessine chaque image en code par-dessus sa vidéo, sans aucune image ni vidéo générée par une IA ;
- regarde le résultat sur des images clés, pendant chaque geste, et corrige jusqu'à ce que ce soit juste : place, taille, timing, lisibilité, style.

Ce qui compte : l'effet qu'elle demande, fidèle à son idée et à ce qui bouge dans sa vidéo, avec un rendu natif, comme un créateur qui monte ses propres Reels, jamais une pub ni un flyer.`;

const RUBRIC = `# Critères, chacun noté à part
1. /mnt/session/outputs/reel.mp4 existe et se lit : 1080×1920, 30 i/s, H.264, une piste son AAC, 20 s au plus.
2. L'effet qu'elle demande est dans la vidéo, dessiné par-dessus sa vraie vidéo (aucune image générée).
3. L'effet suit ce à quoi il est accroché dans sa vidéo, à chaque image où il en dépend (place, taille, angle ou timing) : vérifié sur les images des moments où ça bouge.
4. 6 à 10 images frame-<temps>.jpg du Reel final, qui couvrent chaque moment de l'effet.
5. Sur ces images, chaque texte est entier dans le cadre, lisible à la taille d'un téléphone, et hors des 320 px du bas et des 140 px de droite.
6. Le style va avec sa demande (ou avec le Reel qu'elle recopie) ; rien qui fasse pub ou flyer (étoile promo, traits de vitesse, badge de soldes), sauf si elle l'a demandé.
7. notes.md dit ce qui a été mesuré, comment l'effet suit la vidéo et ce qui a été corrigé après avoir regardé.`;

export type AgentStudio = { name: string; business: string; facts: string[]; colors: string[]; fonts: [string, string] };

type Run = {
  started_at: string;
  idea: string;
  session?: string;
  /** Files uploaded for the session (her video, the Reel to copy, the models): deleted once the run is saved. */
  files: string[];
  error?: string;
  /** Storage paths of the outputs saved from the container. */
  saved?: string[];
};

const runPath = (studioId: string) => `${studioId}/lab/agent/latest.json`;

async function readRun(studioId: string): Promise<Run | null> {
  const { data } = await supabaseAdmin().storage.from(MEDIA).download(runPath(studioId));
  return data ? (JSON.parse(await data.text()) as Run) : null;
}

async function writeRun(studioId: string, run: Run) {
  const { error } = await supabaseAdmin()
    .storage.from(MEDIA)
    .upload(runPath(studioId), JSON.stringify(run), { upsert: true, contentType: "application/json" });
  if (error) throw new Error(`lab agent: ${error.message}`);
}

/** The environment and the agent, created once and found again by name; both follow CONFIG and SYSTEM. */
async function setup(): Promise<{ environment: string; agent: string }> {
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
    system: SYSTEM,
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
    if (a.system !== SYSTEM) await client.beta.agents.update(a.id, { ...definition, version: a.version });
    return { environment, agent: a.id };
  }
  const agent = await client.beta.agents.create({ name: NAME, ...definition });
  return { environment, agent: agent.id };
}

async function stored(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(MEDIA).download(path);
  if (!data) throw new Error(`lab agent: ${path}: ${error?.message ?? "missing"}`);
  return Buffer.from(await data.arrayBuffer());
}

/** A MediaPipe model, as the tracker pins it (by its checksum). */
async function model(m: (typeof TRACK_MODELS)[number]): Promise<Buffer> {
  const response = await fetch(m.url);
  if (!response.ok) throw new Error(`lab agent: ${m.file}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== m.sha256) throw new Error(`lab agent: ${m.file}: checksum`);
  return bytes;
}

function task(idea: string, studio: AgentStudio, clip: string, ref: boolean): string {
  return [
    `Ce qu'elle a écrit : « ${idea} »`,
    "",
    `Le commerce : ${studio.name} (${studio.business}). Ce qui est vrai : ${studio.facts.join(" ; ")}.`,
    `Sa charte, un point de départ, pas une cage : couleurs ${studio.colors.join(", ")} ; polices ${studio.fonts[0]} (titres) et ${studio.fonts[1]} (texte). Quand sa demande ou le Reel qu'elle recopie appelle un autre univers (un dessin animé, un autre lettrage, d'autres couleurs), prends-le.`,
    "Les mots à l'écran : ceux de sa demande quand elle en donne ; sinon peu de mots, en français, qui servent son commerce sans faire réclame, avec les espaces insécables avant : ; ! ? %.",
    "",
    "Ses fichiers (lecture seule, dans /mnt/session/uploads/ ; sinon cherche-les avec find) :",
    `- sa vidéo : /mnt/session/uploads/${clip} ; un iPhone filme souvent en HDR (HLG, 10 bits) : passe-la en SDR avant de dessiner (zscale + tonemap), sinon les couleurs sortent délavées ;`,
    ...(ref ? ["- le Reel qu'elle veut recopier : /mnt/session/uploads/ref.mp4 ; recopie son effet, son rythme et son style, jamais ses mots ni ses images ;"] : []),
    `- les modèles MediaPipe Tasks : ${TRACK_MODELS.map((m) => `/mnt/session/uploads/models/${m.file}`).join(", ")} (mains à 21 points, corps à 33 points, visages).`,
    "",
    "Le Reel : 1080×1920, recadré sur ce qui compte, sans bandes ; 30 i/s ; H.264 yuv420p (CRF 18) avec le son de sa vidéo en AAC ; 20 s au plus (coupe si ça sert l'effet). Un texte se lit sur un téléphone et reste dans la zone sûre d'Instagram : rien d'important dans les 320 px du bas ni les 140 px de droite.",
    "",
    "À écrire dans /mnt/session/outputs/, à plat, sans sous-dossier :",
    "- reel.mp4 ;",
    "- 6 à 10 images JPEG du Reel final aux moments qui comptent, nommées par leur temps : frame-03.40s.jpg… ;",
    "- notes.md : ce que tu as mesuré, comment l'effet suit la vidéo, ce que tu as corrigé après avoir regardé, en quelques lignes.",
  ].join("\n");
}

/** Starts a session on her video (and the Reel she copies): it works on its own, read its result with effectsAgentResult. */
export async function startEffectsAgent(studioId: string, studio: AgentStudio, idea: string, clipFile: string, refFile: string | null) {
  const run: Run = { started_at: new Date().toISOString(), idea, files: [] };
  try {
    const client = anthropic();
    const { environment, agent } = await setup();
    const clip = `clip.${clipFile.split(".").pop()!.toLowerCase()}`;
    const inputs: { name: string; mount: string; bytes: Promise<Buffer> }[] = [
      { name: clip, mount: `/${clip}`, bytes: stored(`${studioId}/lab/${clipFile}`) },
      ...(refFile ? [{ name: "ref.mp4", mount: "/ref.mp4", bytes: stored(`${studioId}/lab/${refFile}`) }] : []),
      ...TRACK_MODELS.map((m) => ({ name: m.file, mount: `/models/${m.file}`, bytes: model(m) })),
    ];
    const resources = [];
    for (const input of inputs) {
      const file = await client.files.upload({ file: await toFile(await input.bytes, input.name) });
      run.files.push(file.id);
      resources.push({ type: "file" as const, file_id: file.id, mount_path: input.mount });
    }
    const session = await client.beta.sessions.create({
      agent,
      environment_id: environment,
      title: `Lab : ${idea.slice(0, 80)}`,
      resources,
      budget: { type: "limit", max_list_cost: { amount: BUDGET_CENTS, currency: "USD" } },
      initial_events: [
        { type: "user.define_outcome", description: task(idea, studio, clip, Boolean(refFile)), rubric: { type: "text", content: RUBRIC }, max_iterations: MAX_ITERATIONS },
      ],
      metadata: { studio: studioId },
    });
    run.session = session.id;
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
  }
  await writeRun(studioId, run);
}

const textOf = (content: { type: string; text?: string }[]) => content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();

/**
 * Where the session is: its status, what it has cost (list prices) and how long it worked, the
 * grader's verdicts and its last words. Once it has stopped, its outputs are saved in the lab
 * studio's storage (signed links, 24 h), its cost logged, and her files deleted from the Files API.
 */
export async function effectsAgentResult(studioId: string) {
  const run = await readRun(studioId);
  if (!run?.session) return { agent: run };
  const client = anthropic();
  const db = supabaseAdmin();
  const session = await client.beta.sessions.retrieve(run.session);
  const events = [];
  for await (const e of client.beta.sessions.events.list(run.session, {
    order: "desc",
    limit: 50,
    types: ["agent.message", "agent.tool_use", "session.status_idle", "session.error", "span.outcome_evaluation_end"],
  })) {
    events.push(e);
    if (events.length >= 50) break;
  }
  // What it did last, oldest first: each tool and the start of what it ran or wrote.
  const steps = events
    .flatMap((e) => (e.type === "agent.tool_use" ? [`${e.name}: ${JSON.stringify(e.input).slice(0, 160)}`] : []))
    .slice(0, 12)
    .reverse();
  const idle = events.find((e) => e.type === "session.status_idle");
  const stopped = session.status === "idle" || session.status === "terminated";
  const usd = session.usage.list_cost ? Number(session.usage.list_cost.amount) / 100 : null;
  if (stopped && !run.saved) {
    run.saved = [];
    for await (const f of client.beta.files.list({ scope_id: run.session, betas: [MANAGED_AGENTS] })) {
      // The session's scope also lists the files it was given, which cannot be downloaded back.
      if (f.downloadable === false || run.files.includes(f.id)) continue;
      const name = f.filename.split("/").pop()!.replace(/[^\w.-]/g, "_");
      const bytes = Buffer.from(await (await client.files.download(f.id)).arrayBuffer());
      const path = `${studioId}/lab/agent/${run.session}/${name}`;
      const { error } = await db.storage.from(MEDIA).upload(path, bytes, { upsert: true, contentType: f.mime_type });
      if (error) throw new Error(`lab agent: ${error.message}`);
      run.saved.push(path);
    }
    for (const id of run.files) await client.files.delete(id).catch(() => undefined);
    run.files = [];
    if (usd != null) {
      const usage = session.usage;
      await db.from("cost_events").insert({
        studio_id: studioId,
        kind: "llm",
        provider: "anthropic",
        units: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        cost_eur: usdToEur(usd, env("USD_TO_EUR")),
        meta: { model: CLAUDE_MODEL, purpose: "effects_agent", session: run.session, usage, cost_usd: usd },
      });
    }
    await writeRun(studioId, run);
  }
  const outputs = await Promise.all(
    (run.saved ?? []).map(async (path) => {
      const signed = await db.storage.from(MEDIA).createSignedUrl(path, 86_400);
      return { file: path.split("/").pop(), url: signed.data?.signedUrl ?? null };
    }),
  );
  return {
    agent: {
      session: run.session,
      started_at: run.started_at,
      idea: run.idea,
      status: session.status,
      stop: idle?.type === "session.status_idle" ? idle.stop_reason.type : null,
      cost_usd: usd,
      active_seconds: session.usage.active_seconds ?? null,
      tokens: { input: session.usage.input_tokens, output: session.usage.output_tokens, cache_read: session.usage.cache_read_input_tokens },
      evaluations: session.outcome_evaluations.map((e) => ({ iteration: e.iteration, result: e.result, explanation: e.explanation })),
      errors: events.flatMap((e) => (e.type === "session.error" ? [e.error] : [])),
      said: events.flatMap((e) => (e.type === "agent.message" ? [textOf(e.content)] : [])).slice(0, 3),
      steps,
      outputs,
    },
  };
}
