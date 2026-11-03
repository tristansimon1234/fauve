import "server-only";
import { randomUUID } from "node:crypto";
import { modalCostUsd, usdToEur } from "@fauve/agent";
import { ModalClient, type Sandbox } from "modal";
import { env } from "@/lib/env";
import { REMOTION_SOURCE_FILES } from "./remotion-source.generated";
import { HDR_TO_SDR } from "./sandbox";

// Her video cut out at every image on a graphics card rented by the second (Modal, Tristan: « rétro-engineer ça pour
// avoir un truc bien », on poof.bg): a Modal sandbox with an L4 is created for the job and ended after it, its image
// built once by Modal (Debian, ffmpeg, onnxruntime-gpu with its CUDA libraries from pip, BiRefNet-portrait checked
// by its digest), and apps/render/portrait.py run in it with matte.py's finish. The web app only needs the two Modal
// variables: nothing is deployed to Modal by hand. Without them, or when the card fails, the cut-out sandbox does it.
//
// Nothing waits on the card past its time. Modal's SDK waits up to 21 minutes for a card to be free: the first test
// in production waited past Vercel's 800 s without a word (its image, built in 70 s, was ready). So the card must be
// up within GPU_START_MS and done by the deadline it is given, or it is ended and the run reports why; a card allotted
// after we gave up ends itself after a minute without work (idleTimeoutMs). Each step is written to the logs with its
// time (« gpu … »), the script's own progress lines included, so a slow run shows where its time goes.

/** The model (rembg's ONNX export of BiRefNet-portrait, MIT) and its digest: the image refuses any other file. */
const MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-portrait-epoch_150.onnx";
const MODEL_SHA256 = "1ba1c8ff5a7bbfadc8d8d13fb11d7be793f91f23d9d466549e37a854f6668f99";

/** The card's machine: Debian with Python 3.12, its packages pinned (onnxruntime-gpu 1.26 is the last one for CUDA 12). */
const BASE_IMAGE = "python:3.12-slim-bookworm";
const IMAGE_COMMANDS = [
  "RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*",
  "RUN pip install --no-cache-dir 'onnxruntime-gpu[cuda,cudnn]==1.26.0' 'numpy==1.26.4' 'opencv-python-headless==4.10.0.84'",
  `RUN mkdir -p /models && curl -fsSL -o /models/portrait.onnx ${MODEL_URL} && echo '${MODEL_SHA256}  /models/portrait.onnx' | sha256sum -c -`,
];
const APP = "fauve";
/** Its size: an L4, and the CPUs and memory for the edge made at full size and the clip's images (an 8 s passage is 1.5 GB). */
const GPU = "L4";
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

/** What `seconds` of the card's sandbox cost, in euros (logged in cost_events). */
export const gpuCostEur = (seconds: number) => usdToEur(modalCostUsd(seconds, CORES, MEMORY_GIB), env("USD_TO_EUR"));

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

/**
 * Cuts out each passage at every image on the card (one sandbox for all of them, the model loaded once).
 * `deadlineMs`: the time it may take in all, its start included. Never throws: a passage that was not cut out has
 * its reason as an Error. `seconds`: the time the card ran (what Modal bills), 0 when none was allotted.
 */
export async function subjectsOnGpu(passages: GpuPassage[], deadlineMs: number): Promise<{ results: Record<string, GpuCut | Error>; seconds: number }> {
  if (!passages.length) return { results: {}, seconds: 0 };
  const started = Date.now();
  const at = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
  const say = (what: string) => console.log(`gpu ${at()}: ${what}`);
  const failAll = (error: Error) => Object.fromEntries(passages.map((p) => [p.key, error]));
  const portrait = REMOTION_SOURCE_FILES["portrait.py"];
  const matte = REMOTION_SOURCE_FILES["matte.py"];
  if (!portrait || !matte) return { results: failAll(new Error("portrait.py or matte.py is missing from the render source")), seconds: 0 };

  const client = new ModalClient({ tokenId: env("MODAL_TOKEN_ID"), tokenSecret: env("MODAL_TOKEN_SECRET") });
  const deadline = started + deadlineMs;
  const upBy = Math.min(deadline, started + GPU_START_MS);
  // A name of its own, to end the card asked for when it is allotted after we stopped waiting for it.
  const name = `cut-${randomUUID().slice(0, 13)}`;
  let sandbox: Sandbox | undefined;
  let upAt = 0;
  let over = false;

  const work = async (): Promise<Record<string, GpuCut | Error>> => {
    const app = await before(upBy, client.apps.fromName(APP, { createIfMissing: true }), "Modal did not answer");
    const image = await before(upBy, client.images.fromRegistry(BASE_IMAGE).dockerfileCommands(IMAGE_COMMANDS).build(app), `its image was not ready after ${GPU_START_MS / 1000} s`);
    say(`image ready (${image.imageId})`);
    const created = await before(
      upBy,
      client.sandboxes.create(app, image, { gpu: GPU, cpu: CORES, memoryMiB: MEMORY_GIB * 1024, timeoutMs: wholeSeconds(Math.max(60_000, deadline - Date.now() + 30_000)), idleTimeoutMs: IDLE_MS, name }),
      `no ${GPU} card free after ${GPU_START_MS / 1000} s`,
    );
    if (over) {
      await created.terminate().catch(() => undefined);
      throw new Error("the card came after the deadline");
    }
    sandbox = created;
    upAt = Date.now();
    say(`card up (${created.sandboxId})`);
    await created.filesystem.makeDirectory("/work", { createParents: true }).catch(() => undefined);
    await created.filesystem.writeText(portrait, "/work/portrait.py");
    await created.filesystem.writeText(matte, "/work/matte.py");
    const jobs = passages.map((p) => ({ id: p.key, url: p.url, from: p.from, to: p.to, upload: p.upload }));
    await created.filesystem.writeText(JSON.stringify(jobs), "/work/jobs.json");
    const left = deadline - Date.now();
    if (left < 30_000) throw new Error("no time left to cut out");
    const run = await created.exec(["python", "-I", "/work/portrait.py", "/work/jobs.json"], {
      workdir: "/work",
      timeoutMs: wholeSeconds(left),
      // PORTRAIT_SECONDS: the script stops on its own (and says why) when its pace would not finish in time.
      env: { PORTRAIT_MODEL: "/models/portrait.onnx", PORTRAIT_WORK: "/work", PORTRAIT_SECONDS: String(Math.floor(left / 1000) - 10), HDR_FILTER: HDR_TO_SDR },
    });
    const [stdout, stderr, code] = await Promise.all([run.stdout.readText(), echo(run.stderr, (line) => say(line)), run.wait()]);
    say(`script ended (${code})`);
    const lastLine = stdout.trim().split("\n").at(-1) ?? "";
    let readings: Record<string, (GpuCut & { uploaded?: boolean }) | { error: string }>;
    try {
      readings = JSON.parse(lastLine);
    } catch {
      throw new Error(`cut-out on the card failed (${code}): ${stderr.slice(-400)}`);
    }
    const results: Record<string, GpuCut | Error> = {};
    for (const p of passages) {
      const r = readings[p.key];
      results[p.key] =
        !r || "error" in r
          ? new Error(r && "error" in r ? r.error : "nothing cut out")
          : !r.uploaded
            ? new Error("cut-out not sent")
            : { still: r.still, frames: r.frames, keys: r.keys, people: r.people, ...(typeof r.top === "number" ? { top: r.top } : {}), ...(Array.isArray(r.boxes) ? { boxes: r.boxes } : {}) };
    }
    return results;
  };

  try {
    return { results: await before(deadline, work(), `the card was not done after ${Math.round(deadlineMs / 1000)} s`), seconds: upAt ? (Date.now() - upAt) / 1000 : 0 };
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    say(`stopped: ${reason.message.slice(0, 300)}`);
    return { results: failAll(reason), seconds: upAt ? (Date.now() - upAt) / 1000 : 0 };
  } finally {
    over = true;
    if (sandbox) await sandbox.terminate().catch(() => undefined);
    // A card still being allotted when we gave up: ended by its name (or by itself after IDLE_MS without work).
    else await client.sandboxes.fromName(APP, name).then((s) => s.terminate()).catch(() => undefined);
    client.close();
  }
}
