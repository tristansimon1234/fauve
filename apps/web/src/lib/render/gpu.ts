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
export type GpuCut = { still: boolean; frames: number; keys: number; people: boolean; top?: number; boxes?: (number[] | null)[] };
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
 * Runs one of the card's scripts on its jobs in a machine of its own, created for them and ended after. `envFor` is given
 * the seconds left when the script starts (it stops on its own when its pace would not finish in time). Never throws:
 * its readings by job id, or why there are none. `seconds`: the time the card ran (what Modal bills), 0 when none came.
 */
async function onCard(
  script: "portrait.py" | "photo_cut.py",
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
  const files = ["portrait.py", "matte.py", "photo_cut.py"].map((name) => ({ name, text: REMOTION_SOURCE_FILES[name] }));
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
    const base = client.images.fromRegistry(BASE_IMAGE).dockerfileCommands(IMAGE_COMMANDS).dockerfileCommands(FP16_COMMANDS).dockerfileCommands(PHOTO_COMMANDS);
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
  const { readings, seconds } = await onCard("photo_cut.py", jobs, () => ({ PHOTO_MODEL: "/models/general-fp16.onnx", PHOTO_WORK: "/work" }), deadlineMs, options);
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
