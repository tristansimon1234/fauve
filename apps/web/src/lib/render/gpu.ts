import "server-only";
import { randomUUID } from "node:crypto";
import { modalCostUsd, usdToEur } from "@fauve/agent";
import { ModalClient, type Sandbox } from "modal";
import { env } from "@/lib/env";
import { REMOTION_SOURCE_FILES } from "./remotion-source.generated";
import { HDR_TO_SDR, type CutoutReading } from "./sandbox";

// Her video cut out at every image on a graphics card rented by the second (Modal, Tristan: « rétro-engineer ça pour
// avoir un truc bien », on poof.bg): a Modal sandbox with an A10G is created for the job and ended after it, its image
// built once by Modal (Debian, ffmpeg, onnxruntime-gpu with its CUDA libraries from pip, BiRefNet-portrait checked
// by its digest), and apps/render/portrait.py run in it with matte.py's finish. The web app only needs the two Modal
// variables: nothing is deployed to Modal by hand. Without them, or when the card fails, the cut-out sandbox does it.
//
// Nothing waits on the card past its time. Modal's SDK waits up to 21 minutes for a card to be free: the first test
// in production waited past Vercel's 800 s without a word (its image, built in 70 s, was ready). So the card must be
// up within GPU_START_MS and done by the deadline it is given, or it is ended and the run reports why; a card allotted
// after we gave up ends itself after a minute without work (idleTimeoutMs). Each step is written to the logs with its
// time (« gpu … »), the script's own progress lines included, so a slow run shows where its time goes.
//
// Two jobs run there, each in its own machine: her video cut out at every image (portrait.py, the portrait model)
// and the subject of her photos (photo_cut.py, the general model: a person, a dish, a product), one model per job.

/** The models (rembg's ONNX exports of BiRefNet, MIT) and their digests: the image refuses any other file. */
const MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-portrait-epoch_150.onnx";
const MODEL_SHA256 = "1ba1c8ff5a7bbfadc8d8d13fb11d7be793f91f23d9d466549e37a854f6668f99";
const GENERAL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx";
const GENERAL_SHA256 = "58f621f00f5d756097615970a88a791584600dcf7c45b18a0a6267535a1ebd3c";

/** The card's machine: Debian with Python 3.12, its packages pinned (onnxruntime-gpu 1.26 is the last one for CUDA 12). */
const BASE_IMAGE = "python:3.12-slim-bookworm";
const IMAGE_COMMANDS = [
  "RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*",
  "RUN pip install --no-cache-dir 'onnxruntime-gpu[cuda,cudnn]==1.26.0' 'numpy==1.26.4' 'opencv-python-headless==4.10.0.84'",
  `RUN mkdir -p /models && curl -fsSL -o /models/portrait.onnx ${MODEL_URL} && echo '${MODEL_SHA256}  /models/portrait.onnx' | sha256sum -c -`,
];
/** A model made half precision by onnxruntime's own converter (its input and output kept in 32 bits). */
const half = (from: string, to: string) =>
  `python -c "import onnx; from onnxruntime.transformers.float16 import convert_float_to_float16 as half; onnx.save(half(onnx.load('${from}'), keep_io_types=True), '${to}')"`;
/**
 * The models used, in half precision (their weights and their sums in 16 bits), made once on Modal from the files
 * checked by their digests (a layer each on top of the image, 22 s for the portrait). On 3 s of the fashion shoot,
 * against the full precision: 0.41 s an image instead of 0.52, 54 s of card instead of 73 (0.020 € instead of 0.028),
 * and the same cut-out (0.03 % apart on average, 0.003 % of its pixels off by more than a tenth).
 */
const FP16_COMMANDS = [`RUN pip install --no-cache-dir 'onnx==1.17.0' && ${half("/models/portrait.onnx", "/models/portrait-fp16.onnx")}`];
/** The general model for her photos: fetched, checked, made half precision, its full-precision file dropped in the same step. */
const PHOTO_COMMANDS = [
  `RUN curl -fsSL -o /models/general.onnx ${GENERAL_URL} && echo '${GENERAL_SHA256}  /models/general.onnx' | sha256sum -c - && ${half("/models/general.onnx", "/models/general-fp16.onnx")} && rm /models/general.onnx`,
];
/**
 * The PyTorch machine (track_objects.py): torch 2.14.1 for CUDA 12.6 from PyTorch's own index (PyPI's builds need CUDA
 * 13), transformers with its native Grounding DINO and SAM 2 video classes (since 4.56; no code from a model hub), and
 * the two models' safetensors pinned by their revision and checked by their digests: Grounding DINO tiny (Apache 2.0)
 * finds the object by its name, SAM 2.1 tiny (Apache 2.0) follows it. matte.py's finish needs ffmpeg and OpenCV.
 */
const HF = "https://huggingface.co";
const TORCH_MODELS = [
  { dir: "grounding-dino-tiny", repo: "IDEA-Research/grounding-dino-tiny", rev: "a2bb814dd30d776dcf7e30523b00659f4f141c71", sha: "1a2412ef99bd74bcd3c2a246fa1e48581f8889a1300c9051974741314fc042f3", configs: ["config.json", "preprocessor_config.json", "special_tokens_map.json", "tokenizer.json", "tokenizer_config.json", "vocab.txt", "added_tokens.json"] },
  { dir: "sam2.1-hiera-tiny", repo: "facebook/sam2.1-hiera-tiny", rev: "de431c4043854a71d8101e17995dfe596bf101a5", sha: "48c14467e5cf9e51870511feb72c89688e82dd74523142c0538b663e193ac2a7", configs: ["config.json", "preprocessor_config.json", "processor_config.json", "video_preprocessor_config.json"] },
];
const TORCH_COMMANDS = [
  "RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*",
  "RUN pip install --no-cache-dir 'torch==2.14.1+cu126' 'torchvision==0.29.1+cu126' --index-url https://download.pytorch.org/whl/cu126",
  // The versions the script was run with here, on the espresso of a café terrace (found at 0.80, followed through 60 images).
  "RUN pip install --no-cache-dir 'transformers==5.22.1' 'safetensors==0.8.0' 'numpy==2.5.4' 'opencv-python-headless==5.0.0.93' 'pillow==13.0.0'",
  ...TORCH_MODELS.map(
    (m) =>
      `RUN mkdir -p /models/${m.dir} && cd /models/${m.dir} && ` +
      [...m.configs, "model.safetensors"].map((f) => `curl -fsSL -o ${f} ${HF}/${m.repo}/resolve/${m.rev}/${f}`).join(" && ") +
      ` && echo '${m.sha}  model.safetensors' | sha256sum -c -`,
  ),
];
/**
 * The depth model (relief.py), a layer of its own on top of the PyTorch machine (adding it never rebuilt torch): Depth
 * Anything V2 small (Apache 2.0), transformers' own class, its safetensors pinned by their revision and digest.
 */
const DEPTH_MODEL = {
  dir: "depth-anything-v2-small",
  repo: "depth-anything/Depth-Anything-V2-Small-hf",
  rev: "5426e4f0f36572d16453bbda7a8389317b1bef99",
  sha: "3152477ce0d8d6978d76b995120de97cb5b928701fd0f817769f59e249a16b70",
  configs: ["config.json", "preprocessor_config.json"],
};
const DEPTH_COMMANDS = [
  `RUN mkdir -p /models/${DEPTH_MODEL.dir} && cd /models/${DEPTH_MODEL.dir} && ` +
    [...DEPTH_MODEL.configs, "model.safetensors"].map((f) => `curl -fsSL -o ${f} ${HF}/${DEPTH_MODEL.repo}/resolve/${DEPTH_MODEL.rev}/${f}`).join(" && ") +
    ` && echo '${DEPTH_MODEL.sha}  model.safetensors' | sha256sum -c -`,
];
const APP = "fauve";
/**
 * Its size: an A10G (24 GB), and the CPUs and memory for the edge made at full size and the clip's images (an 8 s
 * passage is 1.5 GB). Not an L4, cheaper: none was ever allotted to this account (three tries, 90 s to 13 min), while an
 * A10G came in 1.7 s.
 */
export const GPU = "A10G";
const CORES = 2;
const MEMORY_GIB = 8;

/**
 * What the card may take to be up: its image (built by Modal when it changes, 70 s the first time, then found at
 * once), a card allotted and its container started (seconds when one is free).
 */
export const GPU_START_MS = 90_000;
/** A card allotted after we gave up (or left by a run that died) ends itself after this long without work. */
const IDLE_MS = 60_000;
/** The lines of the script's own log copied to Vercel's logs (its progress: a few per passage). */
const LOG_LINES = 80;

/** Whether the card can be used (its two variables are set). */
export const gpuReady = () => Boolean(env("MODAL_TOKEN_ID") && env("MODAL_TOKEN_SECRET"));

/** A passage to cut out: its clip (signed), its seconds, and where its cut-out is sent (signed upload links). */
export type GpuPassage = { key: string; url: string; from: number; to: number; upload: { webm: string; png: string } };
/** A passage cut out on the card (its file already sent to its upload link). */
export type GpuCut = { still: boolean; frames: number; keys: number; people: boolean; top?: number; boxes?: (number[] | null)[]; contours?: (number[] | null)[] };
/** A photo to cut out: its media id, the photo (signed), and where its cut-out is sent (signed upload links, WebP and PNG). */
export type GpuPhoto = { key: string; url: string; upload: { webp: string; png: string } };
/** A photo cut out on the card (its file already sent), with what it is like, as the cut-out sandbox reads it. */
export type GpuPhotoCut = { reading: CutoutReading; ext: "webp" | "png" };

/** What `seconds` of the card's sandbox cost, in euros (logged in cost_events); `gpu`: another card tried, or none. */
export const gpuCostEur = (seconds: number, gpu: string | null = GPU) => usdToEur(modalCostUsd(seconds, CORES, MEMORY_GIB, gpu), env("USD_TO_EUR"));

/** A time limit for Modal, which takes whole seconds only (« timeoutMs must be a multiple of 1000ms »). */
const wholeSeconds = (ms: number) => Math.max(1000, Math.floor(ms / 1000) * 1000);

/** `promise`, or a rejection with `message` once `by` (a time in ms) has passed. */
function before<T>(by: number, promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), Math.max(0, by - Date.now()));
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** Copies a stream's lines to the logs as they come (the first `LOG_LINES`), and gives its last 1 500 characters. */
async function echo(stream: ReadableStream<string>, say: (line: string) => void): Promise<string> {
  const reader = stream.getReader();
  let pending = "";
  let tail = "";
  let lines = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    tail = (tail + value).slice(-1500);
    pending += value;
    const parts = pending.split("\n");
    pending = parts.pop() ?? "";
    for (const line of parts) if (line.trim() && lines++ < LOG_LINES) say(line.trim().slice(0, 300));
  }
  if (pending.trim() && lines < LOG_LINES) say(pending.trim().slice(0, 300));
  return tail;
}

/** For a test from the admin route: another card (« T4 »…) or none (a machine without a card: it shows whether Modal
 * starts a machine at all when no card comes), the model in full precision (fp16 false), a longer start. */
type CardOptions = { gpu?: string | null; fp16?: boolean; startMs?: number };

/**
 * The card's machines, each built once by Modal and kept apart (adding a model to one never rebuilds the other):
 * `cut`, onnxruntime with the cut-out models; `torch`, PyTorch with the models that need it (TORCH_COMMANDS).
 */
type Machine = "cut" | "torch";

/**
 * Runs one of the card's scripts on its jobs in a machine of its own, created for them and ended after. `envFor` is given
 * the seconds left when the script starts (it stops on its own when its pace would not finish in time). Never throws:
 * its readings by job id, or why there are none. `seconds`: the time the card ran (what Modal bills), 0 when none came.
 */
async function onCard(
  script: "portrait.py" | "photo_cut.py" | "track_objects.py" | "relief.py",
  machine: Machine,
  jobs: { id: string }[],
  envFor: (secondsLeft: number) => Record<string, string>,
  deadlineMs: number,
  options: CardOptions,
): Promise<{ readings: Record<string, Record<string, unknown>> | Error; seconds: number }> {
  const gpu = options.gpu === undefined ? GPU : options.gpu;
  const startMs = options.startMs ?? GPU_START_MS;
  const started = Date.now();
  const at = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
  const say = (what: string) => console.log(`gpu ${at()}: ${what}`);
  const files = ["portrait.py", "matte.py", "photo_cut.py", "track_objects.py", "relief.py"].map((name) => ({ name, text: REMOTION_SOURCE_FILES[name] }));
  const missing = files.find((f) => !f.text);
  if (missing) return { readings: new Error(`${missing.name} is missing from the render source`), seconds: 0 };

  const client = new ModalClient({ tokenId: env("MODAL_TOKEN_ID"), tokenSecret: env("MODAL_TOKEN_SECRET") });
  const deadline = started + deadlineMs;
  const upBy = Math.min(deadline, started + startMs);
  // A name of its own, to end the card asked for when it is allotted after we stopped waiting for it.
  const name = `cut-${randomUUID().slice(0, 13)}`;
  let sandbox: Sandbox | undefined;
  let upAt = 0;
  let over = false;

  const work = async (): Promise<Record<string, Record<string, unknown>>> => {
    const app = await before(upBy, client.apps.fromName(APP, { createIfMissing: true }), "Modal did not answer");
    // One image for both jobs: the portrait model (full and half precision) and the general one (half).
    const base =
      machine === "torch"
        ? client.images.fromRegistry(BASE_IMAGE).dockerfileCommands(TORCH_COMMANDS).dockerfileCommands(DEPTH_COMMANDS)
        : client.images.fromRegistry(BASE_IMAGE).dockerfileCommands(IMAGE_COMMANDS).dockerfileCommands(FP16_COMMANDS).dockerfileCommands(PHOTO_COMMANDS);
    const image = await before(upBy, base.build(app), `its image was not ready after ${startMs / 1000} s`);
    say(`image ready (${image.imageId})`);
    const created = await before(
      upBy,
      client.sandboxes.create(app, image, {
        ...(gpu ? { gpu } : {}),
        cpu: CORES,
        memoryMiB: MEMORY_GIB * 1024,
        timeoutMs: wholeSeconds(Math.max(60_000, deadline - Date.now() + 30_000)),
        idleTimeoutMs: IDLE_MS,
        name,
      }),
      gpu ? `no ${gpu} card free after ${startMs / 1000} s` : `no machine started after ${startMs / 1000} s`,
    );
    if (over) {
      await created.terminate().catch(() => undefined);
      throw new Error("the card came after the deadline");
    }
    sandbox = created;
    upAt = Date.now();
    say(`${gpu ?? "machine without a card"} up (${created.sandboxId})`);
    await created.filesystem.makeDirectory("/work", { createParents: true }).catch(() => undefined);
    for (const f of files) await created.filesystem.writeText(f.text!, `/work/${f.name}`);
    await created.filesystem.writeText(JSON.stringify(jobs), "/work/jobs.json");
    const left = deadline - Date.now();
    if (left < 30_000) throw new Error("no time left to cut out");
    const run = await created.exec(["python", "-I", `/work/${script}`, "/work/jobs.json"], { workdir: "/work", timeoutMs: wholeSeconds(left), env: envFor(Math.floor(left / 1000) - 10) });
    const [stdout, stderr, code] = await Promise.all([run.stdout.readText(), echo(run.stderr, (line) => say(line)), run.wait()]);
    say(`script ended (${code})`);
    const lastLine = stdout.trim().split("\n").at(-1) ?? "";
    try {
      return JSON.parse(lastLine) as Record<string, Record<string, unknown>>;
    } catch {
      throw new Error(`the card's script failed (${code}): ${stderr.slice(-400)}`);
    }
  };

  try {
    return { readings: await before(deadline, work(), `the card was not done after ${Math.round(deadlineMs / 1000)} s`), seconds: upAt ? (Date.now() - upAt) / 1000 : 0 };
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    say(`stopped: ${reason.message.slice(0, 300)}`);
    return { readings: reason, seconds: upAt ? (Date.now() - upAt) / 1000 : 0 };
  } finally {
    over = true;
    if (sandbox) await sandbox.terminate().catch(() => undefined);
    // A card still being allotted when we gave up: ended by its name (or by itself after IDLE_MS without work).
    else await client.sandboxes.fromName(APP, name).then((s) => s.terminate()).catch(() => undefined);
    client.close();
  }
}

/** A job's reading as given, or why it has none (its error, or nothing sent). */
function readingOf(readings: Record<string, Record<string, unknown>> | Error, key: string): Record<string, unknown> | Error {
  if (readings instanceof Error) return readings;
  const r = readings[key];
  if (!r) return new Error("nothing cut out");
  if (typeof r.error === "string") return new Error(r.error);
  return r.uploaded ? r : new Error("cut-out not sent");
}

/**
 * Cuts out each passage at every image on the card (one machine for all of them, the model loaded once).
 * `deadlineMs`: the time it may take in all, its start included. Never throws: a passage that was not cut out has
 * its reason as an Error. `seconds`: the time the card ran (what Modal bills), 0 when none was allotted.
 */
export async function subjectsOnGpu(passages: GpuPassage[], deadlineMs: number, options: CardOptions = {}): Promise<{ results: Record<string, GpuCut | Error>; seconds: number }> {
  if (!passages.length) return { results: {}, seconds: 0 };
  const fp16 = options.fp16 ?? true;
  const jobs = passages.map((p) => ({ id: p.key, url: p.url, from: p.from, to: p.to, upload: p.upload }));
  const { readings, seconds } = await onCard(
    "portrait.py",
    "cut",
    jobs,
    (secondsLeft) => ({ PORTRAIT_MODEL: fp16 ? "/models/portrait-fp16.onnx" : "/models/portrait.onnx", PORTRAIT_WORK: "/work", PORTRAIT_SECONDS: String(secondsLeft), HDR_FILTER: HDR_TO_SDR }),
    deadlineMs,
    options,
  );
  const results: Record<string, GpuCut | Error> = {};
  for (const p of passages) {
    const r = readingOf(readings, p.key);
    results[p.key] =
      r instanceof Error
        ? r
        : {
            still: Boolean(r.still),
            frames: Number(r.frames),
            keys: Number(r.keys),
            people: Boolean(r.people),
            ...(typeof r.top === "number" ? { top: r.top } : {}),
            ...(Array.isArray(r.boxes) ? { boxes: r.boxes as (number[] | null)[] } : {}),
            ...(Array.isArray(r.contours) ? { contours: r.contours as (number[] | null)[] } : {}),
          };
  }
  return { results, seconds };
}

/**
 * Cuts out the subject of each photo on the card (the general model, half precision, loaded once): about a second a
 * photo once the card is up. Never throws, like subjectsOnGpu.
 */
export async function photosOnGpu(photos: GpuPhoto[], deadlineMs: number, options: CardOptions = {}): Promise<{ results: Record<string, GpuPhotoCut | Error>; seconds: number }> {
  if (!photos.length) return { results: {}, seconds: 0 };
  const jobs = photos.map((p) => ({ id: p.key, url: p.url, upload: p.upload }));
  const { readings, seconds } = await onCard("photo_cut.py", "cut", jobs, () => ({ PHOTO_MODEL: "/models/general-fp16.onnx", PHOTO_WORK: "/work" }), deadlineMs, options);
  const results: Record<string, GpuPhotoCut | Error> = {};
  for (const p of photos) {
    const r = readingOf(readings, p.key);
    if (r instanceof Error) {
      results[p.key] = r;
      continue;
    }
    const reading = Object.fromEntries(Object.entries(r).filter(([k]) => k !== "ext" && k !== "uploaded"));
    results[p.key] = { reading: reading as CutoutReading, ext: r.ext === "png" ? "png" : "webp" };
  }
  return { results, seconds };
}

/** A passage where an object is followed: the passage's, and the object's name (as its animation gives it). */
export type GpuObjectPassage = GpuPassage & { name: string };

/**
 * Follows each object through its passage on the card (the PyTorch machine: the detector finds it by its name, SAM 2
 * follows it both ways, matte.py's finish cuts it out with its boxes and outline). Never throws, like subjectsOnGpu.
 */
export async function objectsOnGpu(passages: GpuObjectPassage[], deadlineMs: number, options: CardOptions = {}): Promise<{ results: Record<string, GpuCut | Error>; seconds: number }> {
  if (!passages.length) return { results: {}, seconds: 0 };
  const jobs = passages.map((p) => ({ id: p.key, url: p.url, from: p.from, to: p.to, name: p.name, upload: p.upload }));
  const { readings, seconds } = await onCard(
    "track_objects.py",
    "torch",
    jobs,
    () => ({ DETECTOR_MODEL: "/models/grounding-dino-tiny", TRACKER_MODEL: "/models/sam2.1-hiera-tiny", OBJECTS_WORK: "/work", HDR_FILTER: HDR_TO_SDR }),
    deadlineMs,
    options,
  );
  const results: Record<string, GpuCut | Error> = {};
  for (const p of passages) {
    const r = readingOf(readings, p.key);
    results[p.key] =
      r instanceof Error
        ? r
        : {
            still: Boolean(r.still),
            frames: Number(r.frames),
            keys: Number(r.keys),
            people: false,
            ...(typeof r.top === "number" ? { top: r.top } : {}),
            ...(Array.isArray(r.boxes) ? { boxes: r.boxes as (number[] | null)[] } : {}),
            ...(Array.isArray(r.contours) ? { contours: r.contours as (number[] | null)[] } : {}),
          };
  }
  return { results, seconds };
}

/** A photo shot to draw in relief (relief.py): the photo (signed), the shot as the plan has it, where its video is sent. */
export type GpuRelief = { key: string; url: string; move: "in" | "out" | "left" | "right"; frames: number; origin: { x: number; y: number }; shift: number; upload: { mp4: string } };
/** A shot drawn in relief on the card (its video already sent): its images, its size, how much of the photo is near. */
export type GpuReliefDone = { frames: number; w: number; h: number; near?: number };

/**
 * Draws each photo shot in relief on the card (relief.py, the PyTorch machine: the depth read once, then every image
 * of the shot): a few seconds a shot once the card is up. Never throws, like subjectsOnGpu.
 */
export async function reliefsOnGpu(shots: GpuRelief[], deadlineMs: number, options: CardOptions = {}): Promise<{ results: Record<string, GpuReliefDone | Error>; seconds: number }> {
  if (!shots.length) return { results: {}, seconds: 0 };
  const jobs = shots.map((s) => ({ id: s.key, url: s.url, move: s.move, frames: s.frames, origin: s.origin, shift: s.shift, upload: s.upload }));
  const { readings, seconds } = await onCard("relief.py", "torch", jobs, () => ({ DEPTH_MODEL: `/models/${DEPTH_MODEL.dir}`, RELIEF_WORK: "/work" }), deadlineMs, options);
  const results: Record<string, GpuReliefDone | Error> = {};
  for (const s of shots) {
    const r = readingOf(readings, s.key);
    if (r instanceof Error) {
      results[s.key] = r;
      continue;
    }
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    results[s.key] = r.uploaded && n(r.frames) > 0 ? { frames: n(r.frames), w: n(r.w), h: n(r.h), ...(typeof r.near === "number" ? { near: r.near } : {}) } : new Error("relief not sent");
  }
  return { results, seconds };
}
