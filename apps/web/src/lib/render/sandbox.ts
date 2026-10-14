import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { RENDER_FONTS, type ReelProps } from "@fauve/agent";
import { REMOTION_SOURCE_FILES, REMOTION_SOURCE_HASH } from "./remotion-source.generated";

// The render worker: a persistent Vercel Sandbox (Firecracker microVM) holding a
// static ffmpeg build and the fonts. Nothing heavy runs in the Vercel function
// itself; it only sends the job (clip URLs + plan) and collects the MP4.

const NAME = "fauve-render";
const ROOT = "/vercel/sandbox/fauve";
// Static ffmpeg 7 (johnvansickle build): libx264 + libass, no drawtext.
const FFMPEG_URL = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64.gz";

const SETUP = [
  "set -euo pipefail",
  `mkdir -p ${ROOT}/fonts ${ROOT}/jobs`,
  `if [ ! -x ${ROOT}/ffmpeg ]; then curl -fsSL ${FFMPEG_URL} | gunzip > ${ROOT}/ffmpeg.tmp && chmod +x ${ROOT}/ffmpeg.tmp && mv ${ROOT}/ffmpeg.tmp ${ROOT}/ffmpeg; fi`,
  ...Object.entries(RENDER_FONTS).map(
    ([file, url]) => `[ -s ${ROOT}/fonts/${file} ] || curl -fsSL -o ${ROOT}/fonts/${file} '${url}'`,
  ),
].join("\n");

/**
 * Downloads $2 to $1. HTTP/1.1: Supabase Storage's HTTP/2 streams sometimes break
 * mid-file on large videos ("stream was not closed cleanly"); retried on any error.
 */
const FETCH = 'curl -fsSL --http1.1 --retry 4 --retry-all-errors --retry-delay 1 --connect-timeout 15 -o "$1" "$2"';

async function bash(sandbox: Sandbox, script: string, args: string[] = []) {
  const result = await sandbox.runCommand({ cmd: "bash", args: ["-c", script, "bash", ...args] });
  if (result.exitCode !== 0) {
    const output = (await result.output("both").catch(() => "")).slice(-2000);
    throw new Error(`sandbox command failed (${result.exitCode}): ${output}`);
  }
  return result;
}

let ready: Promise<Sandbox> | undefined;

/** The render sandbox, created on first use and resumed afterwards; setup is idempotent. */
export function renderSandbox(): Promise<Sandbox> {
  ready ??= (async () => {
    const sandbox = await Sandbox.getOrCreate({
      name: NAME,
      persistent: true,
      resources: { vcpus: 4 },
      timeout: 15 * 60_000,
    });
    await bash(sandbox, SETUP);
    return sandbox;
  })().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

export type SandboxRenderJob = {
  id: string;
  /** Signed download URL of each clip, keyed by the file name used in the ffmpeg args. */
  clips: Record<string, string>;
  ass: string;
  ffmpegArgs: string[];
};

/** Runs one render and returns the MP4 bytes. */
export async function renderInSandbox(job: SandboxRenderJob): Promise<Buffer> {
  const sandbox = await renderSandbox();
  const dir = `${ROOT}/jobs/${job.id}`;
  try {
    await bash(sandbox, `rm -rf "$1" && mkdir -p "$1" && ln -s ${ROOT}/fonts "$1/fonts"`, [dir]);
    await sandbox.writeFiles([{ path: `${dir}/texts.ass`, content: job.ass }]);
    await Promise.all(
      Object.entries(job.clips).map(([file, url]) =>
        bash(sandbox, FETCH, [`${dir}/${file}`, url]),
      ),
    );
    await bash(sandbox, `cd "$1" && shift && exec ${ROOT}/ffmpeg "$@"`, [dir, ...job.ffmpegArgs]);
    const mp4 = await sandbox.readFileToBuffer({ path: `${dir}/out.mp4` });
    if (!mp4?.length) throw new Error("render produced no file");
    return mp4;
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Remotion templates (apps/render): installed once per source version, bundled
// ahead of time, then each render only loads the bundle with new props.
// ---------------------------------------------------------------------------

const REMOTION = `${ROOT}/remotion`;

// Chrome headless shell dependencies on the Ubuntu image (names differ across releases).
const CHROME_DEPS = [
  "libnss3", "libdbus-1-3", "libatk1.0-0t64", "libatk1.0-0", "libgbm1", "libasound2t64", "libasound2", "libxrandr2",
  "libxkbcommon0", "libxfixes3", "libxcomposite1", "libxdamage1", "libatk-bridge2.0-0t64", "libatk-bridge2.0-0",
  "libpango-1.0-0", "libcairo2", "libcups2t64", "libcups2", "fonts-noto-color-emoji",
];

let remotionReady: Promise<Sandbox> | undefined;

async function prepareRemotion(): Promise<Sandbox> {
  const sandbox = await renderSandbox();
  const current = await sandbox.runCommand({ cmd: "bash", args: ["-c", `cat ${REMOTION}/.hash 2>/dev/null || true`] });
  if ((await current.stdout()).trim() === REMOTION_SOURCE_HASH) return sandbox;

  await bash(
    sandbox,
    `[ -f ${ROOT}/.chrome-deps ] || { sudo apt-get update -qq >/dev/null 2>&1; for p in ${CHROME_DEPS.join(" ")}; do sudo apt-get install -y -qq --no-install-recommends "$p" >/dev/null 2>&1 || true; done; touch ${ROOT}/.chrome-deps; }`,
  );
  await bash(sandbox, `mkdir -p ${REMOTION} && find ${REMOTION} -maxdepth 1 -mindepth 1 ! -name node_modules -exec rm -rf {} +`);
  await sandbox.writeFiles(Object.entries(REMOTION_SOURCE_FILES).map(([path, content]) => ({ path: `${REMOTION}/${path}`, content })));
  await bash(
    sandbox,
    `cd ${REMOTION} && npm ci --no-audit --no-fund --loglevel=error && npx remotion browser ensure >/dev/null && npx remotion bundle src/index.ts --out-dir build --log=error && echo ${REMOTION_SOURCE_HASH} > .hash`,
  );
  return sandbox;
}

/** Installs or updates the Remotion templates in the sandbox (idempotent; slow only the first time). */
export function remotionSandbox(): Promise<Sandbox> {
  remotionReady ??= prepareRemotion().catch((error: unknown) => {
    remotionReady = undefined;
    throw error;
  });
  return remotionReady;
}

/**
 * Copies the Reel's clips and photos into the bundle's public folder before the
 * render, which then reads local files (`/public/jobs/…`, served with the bundle)
 * instead of streaming each video from Storage frame after frame: a slow or broken
 * stream used to time the render out.
 */
async function localMedia(sandbox: Sandbox, id: string, props: ReelProps): Promise<ReelProps> {
  const downloads: Promise<unknown>[] = [];
  const segments = props.segments.map((segment, i) => {
    if ((segment.type !== "clip" && segment.type !== "image") || !/^https?:/.test(segment.src)) return segment;
    const ext = segment.type === "clip" ? "mp4" : (/\.(png|webp|jpe?g)(?:\?|$)/i.exec(segment.src)?.[1]?.toLowerCase() ?? "jpg");
    const file = `jobs/${id}/m${i}.${ext}`;
    downloads.push(bash(sandbox, FETCH, [`${REMOTION}/build/public/${file}`, segment.src]));
    return { ...segment, src: `/public/${file}` };
  });
  if (!downloads.length) return props;
  await bash(sandbox, 'mkdir -p "$1"', [`${REMOTION}/build/public/jobs/${id}`]);
  await Promise.all(downloads);
  return { ...props, segments };
}

/** Renders the Reel composition with the given props and returns the MP4 bytes. */
export async function renderReelInSandbox(job: { id: string; props: ReelProps }): Promise<Buffer> {
  const sandbox = await remotionSandbox();
  const dir = `${ROOT}/jobs/${job.id}`;
  const media = `${REMOTION}/build/public/jobs/${job.id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" "$2" && mkdir -p "$1"', [dir, media]);
    const props = await localMedia(sandbox, job.id, job.props);
    await sandbox.writeFiles([{ path: `${dir}/props.json`, content: JSON.stringify(props) }]);
    await bash(
      sandbox,
      `cd ${REMOTION} && npx remotion render build Reel "$1/out.mp4" --props="$1/props.json" --concurrency=4 --codec=h264 --crf=19 --pixel-format=yuv420p --enforce-audio-track --log=error`,
      [dir],
    );
    const mp4 = await sandbox.readFileToBuffer({ path: `${dir}/out.mp4` });
    if (!mp4?.length) throw new Error("render produced no file");
    return mp4;
  } finally {
    await bash(sandbox, 'rm -rf "$1" "$2"', [dir, media]).catch(() => {});
  }
}

export type SmokeScene = {
  id: string;
  js: string;
  durationInFrames: number;
  /** Slot texts (a reused library scene is checked with its new texts). */
  texts?: Record<string, string>;
};

/**
 * Runs generated motion scenes outside the video: a server render (first, middle,
 * last frame), then a layout check in Chrome with the studio's fonts, which
 * rejects a scene whose text leaves the frame or the safe zone. Returns the error per scene id.
 */
export async function smokeTestScenes(
  scenes: SmokeScene[],
  brand?: Pick<ReelProps["brand"], "name" | "accent" | "accentInk" | "displayFont" | "bodyFont" | "logoUrl" | "logoOnDark">,
): Promise<Record<string, string | null>> {
  if (!scenes.length) return {};
  const sandbox = await remotionSandbox();
  const file = `${ROOT}/jobs/smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  try {
    await sandbox.writeFiles([{ path: file, content: JSON.stringify(scenes.map((s) => ({ ...s, brand }))) }]);
    const result = await sandbox.runCommand({ cmd: "bash", args: ["-c", `cd ${REMOTION} && timeout 150 node smoke.mjs "$1"`, "bash", file] });
    const lastLine = (await result.stdout()).trim().split("\n").at(-1) ?? "";
    try {
      return JSON.parse(lastLine) as Record<string, string | null>;
    } catch {
      const output = (await result.output("both").catch(() => "")).slice(-400);
      return Object.fromEntries(scenes.map((s) => [s.id, `smoke test failed: ${output}`]));
    }
  } finally {
    await bash(sandbox, 'rm -f "$1"', [file]).catch(() => {});
  }
}

/**
 * Carousel slides: one JPEG per job, a still of the Reel composition at `frame`
 * (stills.mjs, one browser for all). Returns the image of each job id, or its error.
 */
export async function renderStillsInSandbox(
  id: string,
  jobs: { id: string; frame: number; props: ReelProps }[],
): Promise<Record<string, Buffer | Error>> {
  if (!jobs.length) return {};
  const sandbox = await remotionSandbox();
  const dir = `${ROOT}/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    const list = jobs.map((j) => ({ id: j.id, frame: j.frame, props: j.props, out: `${dir}/${j.id}.jpg` }));
    await sandbox.writeFiles([{ path: `${dir}/jobs.json`, content: JSON.stringify(list) }]);
    const result = await sandbox.runCommand({ cmd: "bash", args: ["-c", `cd ${REMOTION} && timeout 240 node stills.mjs "$1/jobs.json"`, "bash", dir] });
    const lastLine = (await result.stdout()).trim().split("\n").at(-1) ?? "";
    let errors: Record<string, string | null>;
    try {
      errors = JSON.parse(lastLine) as Record<string, string | null>;
    } catch {
      const output = (await result.output("both").catch(() => "")).slice(-600);
      throw new Error(`stills failed: ${output}`);
    }
    const images: Record<string, Buffer | Error> = {};
    for (const job of list) {
      const error = errors[job.id];
      if (error) {
        images[job.id] = new Error(error);
        continue;
      }
      const jpeg = await sandbox.readFileToBuffer({ path: job.out });
      images[job.id] = jpeg?.length ? jpeg : new Error("still produced no file");
    }
    return images;
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/**
 * Key frames of a rendered video, for the critic: one JPEG (540 px wide) per
 * instant, cut by ffmpeg from the MP4 at `url`. An instant past the end gives no frame.
 */
export async function videoFramesInSandbox(id: string, url: string, times: number[]): Promise<{ t: number; jpeg: Buffer }[]> {
  if (!times.length) return [];
  const sandbox = await renderSandbox();
  const dir = `${ROOT}/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await bash(sandbox, FETCH, [`${dir}/in.mp4`, url]);
    await bash(
      sandbox,
      `cd "$1" && shift && i=0; for t in "$@"; do ${ROOT}/ffmpeg -loglevel error -y -ss "$t" -i in.mp4 -frames:v 1 -vf scale=540:-2 -q:v 4 "f$i.jpg" || true; i=$((i+1)); done`,
      [dir, ...times.map((t) => Math.max(0, t).toFixed(2))],
    );
    const frames: { t: number; jpeg: Buffer }[] = [];
    for (const [i, t] of times.entries()) {
      const jpeg = await sandbox.readFileToBuffer({ path: `${dir}/f${i}.jpg` }).catch(() => null);
      if (jpeg?.length) frames.push({ t, jpeg });
    }
    return frames;
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/**
 * A capture of a public web page as a visitor sees it (1280 × 1600, the top of
 * the page), with the headless Chrome the Remotion templates already installed.
 * The URL was checked to be public before; null when the capture fails.
 */
export async function screenshotInSandbox(id: string, url: string): Promise<Buffer | null> {
  const sandbox = await remotionSandbox();
  const dir = `${ROOT}/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await bash(
      sandbox,
      `chrome=$(find ${REMOTION}/node_modules/.remotion -type f -name chrome-headless-shell 2>/dev/null | head -1)
[ -n "$chrome" ] || { echo "no chrome"; exit 3; }
timeout 60 "$chrome" --headless --no-sandbox --disable-gpu --hide-scrollbars --mute-audio --lang=fr-FR --window-size=1280,1600 --virtual-time-budget=12000 --screenshot="$1/page.png" "$2" >/dev/null 2>&1 || true
[ -s "$1/page.png" ]`,
      [dir, url],
    );
    const png = await sandbox.readFileToBuffer({ path: `${dir}/page.png` });
    return png?.length ? png : null;
  } catch (error) {
    console.warn("site screenshot failed", url, error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}
