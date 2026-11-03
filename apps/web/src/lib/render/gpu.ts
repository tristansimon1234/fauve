import "server-only";
import { modalCostUsd, usdToEur } from "@fauve/agent";
import { ModalClient } from "modal";
import { env } from "@/lib/env";
import { REMOTION_SOURCE_FILES } from "./remotion-source.generated";
import { HDR_TO_SDR } from "./sandbox";

// Her video cut out at every image on a graphics card rented by the second (Modal, Tristan: « rétro-engineer ça pour
// avoir un truc bien », on poof.bg): a Modal sandbox with an L4 is created for the job and ended after it, its image
// built once by Modal (Debian, ffmpeg, onnxruntime-gpu with its CUDA libraries from pip, BiRefNet-portrait checked
// by its digest), and apps/render/portrait.py run in it with matte.py's finish. The web app only needs the two Modal
// variables: nothing is deployed to Modal by hand. Without them, or when the card fails, the cut-out sandbox does it.

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

/** Whether the card can be used (its two variables are set). */
export const gpuReady = () => Boolean(env("MODAL_TOKEN_ID") && env("MODAL_TOKEN_SECRET"));

/** A passage to cut out: its clip (signed), its seconds, and where its cut-out is sent (signed upload links). */
export type GpuPassage = { key: string; url: string; from: number; to: number; upload: { webm: string; png: string } };
/** A passage cut out on the card (its file already sent to its upload link). */
export type GpuCut = { still: boolean; frames: number; keys: number; people: boolean; top?: number; boxes?: (number[] | null)[] };

/** What `seconds` of the card's sandbox cost, in euros (logged in cost_events). */
export const gpuCostEur = (seconds: number) => usdToEur(modalCostUsd(seconds, CORES, MEMORY_GIB), env("USD_TO_EUR"));

/**
 * Cuts out each passage at every image on the card (one sandbox for all of them, the model loaded once). `deadlineMs`:
 * the time it may take, startup included (the image is built once, later starts take seconds).
 */
export async function subjectsOnGpu(passages: GpuPassage[], deadlineMs: number): Promise<{ results: Record<string, GpuCut | Error>; seconds: number }> {
  if (!passages.length) return { results: {}, seconds: 0 };
  const portrait = REMOTION_SOURCE_FILES["portrait.py"];
  const matte = REMOTION_SOURCE_FILES["matte.py"];
  if (!portrait || !matte) throw new Error("portrait.py or matte.py is missing from the render source");
  const client = new ModalClient({ tokenId: env("MODAL_TOKEN_ID"), tokenSecret: env("MODAL_TOKEN_SECRET") });
  const started = Date.now();
  const app = await client.apps.fromName(APP, { createIfMissing: true });
  const image = client.images.fromRegistry(BASE_IMAGE).dockerfileCommands(IMAGE_COMMANDS);
  const sandbox = await client.sandboxes.create(app, image, { gpu: GPU, cpu: CORES, memoryMiB: MEMORY_GIB * 1024, timeoutMs: Math.max(120_000, deadlineMs) });
  try {
    await sandbox.filesystem.makeDirectory("/work", { createParents: true }).catch(() => undefined);
    await sandbox.filesystem.writeText(portrait, "/work/portrait.py");
    await sandbox.filesystem.writeText(matte, "/work/matte.py");
    const jobs = passages.map((p) => ({ id: p.key, url: p.url, from: p.from, to: p.to, upload: p.upload }));
    await sandbox.filesystem.writeText(JSON.stringify(jobs), "/work/jobs.json");
    const left = Math.max(60_000, deadlineMs - (Date.now() - started));
    const run = await sandbox.exec(["python", "-I", "/work/portrait.py", "/work/jobs.json"], {
      workdir: "/work",
      timeoutMs: left,
      env: { PORTRAIT_MODEL: "/models/portrait.onnx", PORTRAIT_WORK: "/work", HDR_FILTER: HDR_TO_SDR },
    });
    const [stdout, stderr, code] = await Promise.all([run.stdout.readText(), run.stderr.readText(), run.wait()]);
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
    return { results, seconds: (Date.now() - started) / 1000 };
  } finally {
    await sandbox.terminate().catch(() => undefined);
    client.close();
  }
}
