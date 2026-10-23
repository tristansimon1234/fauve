import "server-only";
import { APIError, Sandbox } from "@vercel/sandbox";
import {
  bassLevelsFilter,
  BEAT_STEP,
  GROOVE_STEP,
  MIX_CEILING,
  mixFilter,
  mixGains,
  parseSceneCuts,
  pauseFilter,
  quietPauses,
  REEL_FPS,
  RENDER_FONTS,
  SANDBOX_REGION,
  sandboxCostUsd,
  speechGain,
  speechLevelsFilter,
  usdToEur,
  type ComposeEnd,
  type ComposeShot,
  type ComposeText,
  type ReelProps,
  type ReelUnder,
  type ScenePhoto,
  type MotionTemplate,
  type TrackPiece,
} from "@fauve/agent";
import { env } from "@/lib/env";
import { REMOTION_SOURCE_FILES, REMOTION_SOURCE_HASH } from "./remotion-source.generated";

// The render worker: a persistent Vercel Sandbox (Firecracker microVM) holding a
// static ffmpeg build and the fonts. Nothing heavy runs in the Vercel function
// itself; it only sends the job (clip URLs + plan) and collects the MP4. It runs in
// Paris (SANDBOX_REGION), like the functions and the database: the first one,
// "fauve-render", was left in the default region (Virginia).

const NAME = "fauve-render-paris";
/** vCPUs of the render sandbox (2 GB of memory each). */
const VCPUS = 4;
/** A session stops at its deadline, even in the middle of a render: each job starts with this much time left. */
const JOB_MS = 6 * 60_000;
const ROOT = "/vercel/sandbox/fauve";
// Static ffmpeg 7 (johnvansickle build): libx264 + libass, no drawtext.
const FFMPEG_URL = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64.gz";

const SETUP = [
  "set -euo pipefail",
  `mkdir -p ${ROOT}/fonts ${ROOT}/jobs`,
  // The cut-outs moved to their own sandbox (fauve-cutout-paris): the old install goes.
  `rm -rf ${ROOT}/cutout`,
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

/**
 * Downloads the video $2 and writes it to $1 at the Reel's frame rate, its last image held
 * two more seconds. A phone video (variable frame rate, odd timestamps, a picture a little
 * shorter than its sound) could stop Remotion on « No frame found at position »; this one
 * always has a frame where the plan asks. An iPhone's HDR video (HLG or PQ, 10 bits) is
 * tone-mapped to the SDR of a Reel on the way, else its colours come out washed out. If
 * ffmpeg cannot read it, the file as it came.
 */
const NORMALIZE = [
  "set -euo pipefail",
  `${FETCH.replace('"$1"', '"$1.src"')}`,
  `tail="fps=${REEL_FPS},tpad=stop_mode=clone:stop_duration=2,format=yuv420p"`,
  'enc="-c:v libx264 -preset veryfast -crf 16 -c:a aac -b:a 192k -movflags +faststart"',
  `plain() { ${ROOT}/ffmpeg -v error -y -i "$1.src" -map 0:v:0 -map "0:a:0?" -vf "$tail" $enc "$1"; }`,
  `hdr() { ${ROOT}/ffmpeg -v error -y -i "$1.src" -map 0:v:0 -map "0:a:0?" -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,$tail" $enc -color_primaries bt709 -color_trc bt709 -colorspace bt709 "$1"; }`,
  `info=$(${ROOT}/ffmpeg -hide_banner -i "$1.src" 2>&1 || true)`,
  'if grep -qE "arib-std-b67|smpte2084" <<<"$info"; then hdr "$1" || plain "$1" || cp "$1.src" "$1"; else plain "$1" || cp "$1.src" "$1"; fi',
  'rm -f "$1.src"',
].join("\n");

async function bash(sandbox: Sandbox, script: string, args: string[] = []) {
  const result = await sandbox.runCommand({ cmd: "bash", args: ["-c", script, "bash", ...args] });
  if (result.exitCode !== 0) {
    // The cause is often on the first lines (a long stack follows): keep both ends.
    const output = await result.output("both").catch(() => "");
    throw new Error(`sandbox command failed (${result.exitCode}): ${output.length > 2400 ? `${output.slice(0, 1200)} … ${output.slice(-1200)}` : output}`);
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
      region: SANDBOX_REGION,
      resources: { vcpus: VCPUS },
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

/**
 * Gives the running session time for one more job, extending it only by what is missing
 * (a stopped one is resumed by the next command, with its full timeout).
 */
async function withTimeLeft(sandbox: Sandbox): Promise<Sandbox> {
  if (sandbox.status !== "running") return sandbox;
  const left = (sandbox.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) - Date.now();
  if (left < JOB_MS) {
    // At least a minute: the API refuses an extension under a second (a session just short of the job's time).
    await sandbox.extendTimeout(Math.max(60_000, JOB_MS - Math.max(0, left))).catch((error: unknown) => console.warn("render sandbox: timeout not extended", error));
  }
  return sandbox;
}

/** The sandbox for one job (ffmpeg, frames, mixing). */
const jobSandbox = async () => withTimeLeft(await renderSandbox());

/** What `seconds` of work in the render sandbox cost, in euros (logged in cost_events). */
/**
 * Deletes a render sandbox no longer used (an old name or region) with the snapshots
 * only it holds. Never the one in service; "missing" when none has that name.
 */
export async function dropSandbox(name: string): Promise<"deleted" | "missing"> {
  if (name === NAME || name === CUTOUT_NAME) throw new Error(`${name} is a sandbox in service`);
  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.get({ name });
  } catch (error) {
    if (error instanceof APIError && error.response.status === 404) return "missing";
    throw error;
  }
  await sandbox.delete({ deleteOrphanSnapshots: true });
  return "deleted";
}

export function sandboxCostEur(seconds: number): number {
  return usdToEur(sandboxCostUsd(seconds, VCPUS, SANDBOX_REGION), env("USD_TO_EUR"));
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
  const sandbox = await jobSandbox();
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
  const sandbox = await jobSandbox();
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
 * Copies the Reel's clips and photos (and the footage under its animations) into the
 * bundle's public folder before the render, which then reads local files (`/public/jobs/…`,
 * served with the bundle) instead of streaming each video from Storage frame after frame:
 * a slow or broken stream used to time the render out. Each file once, however many shots
 * use it; videos re-encoded so that every frame the plan asks for exists (NORMALIZE).
 */
async function localMedia(sandbox: Sandbox, id: string, props: ReelProps): Promise<ReelProps> {
  const files = new Map<string, string>();
  const work: Promise<unknown>[] = [];
  const local = (src: string, video: boolean): string => {
    if (!/^https?:/.test(src)) return src;
    const known = files.get(src);
    if (known) return known;
    const ext = video ? "mp4" : (/\.(png|webp|jpe?g)(?:\?|$)/i.exec(src)?.[1]?.toLowerCase() ?? "jpg");
    const file = `jobs/${id}/m${files.size}.${ext}`;
    files.set(src, `/public/${file}`);
    work.push(bash(sandbox, video ? NORMALIZE : FETCH, [`${REMOTION}/build/public/${file}`, src]));
    return `/public/${file}`;
  };
  const under = (u: ReelUnder | undefined) => (u ? { ...u, src: local(u.src, u.type === "clip") } : u);
  // The photos an animation composes with, and their cut-outs.
  const photos = (list: ScenePhoto[]) => list.map((p) => ({ ...p, src: local(p.src, false), ...(p.cutout ? { cutout: local(p.cutout, false) } : {}) }));
  const segments = props.segments.map((segment) => {
    if (segment.type === "image" && segment.cutout) return { ...segment, src: local(segment.src, false), cutout: { ...segment.cutout, src: local(segment.cutout.src, false) } };
    if (segment.type === "clip" || segment.type === "image") return { ...segment, src: local(segment.src, segment.type === "clip") };
    const moved = segment.under ? { ...segment, under: under(segment.under) } : segment;
    return moved.type === "motion" && moved.photos ? { ...moved, photos: photos(moved.photos) } : moved;
  });
  const layers = props.layers?.map((l) => (l.photos ? { ...l, photos: photos(l.photos) } : l));
  if (!work.length) return props;
  await bash(sandbox, 'mkdir -p "$1"', [`${REMOTION}/build/public/jobs/${id}`]);
  await Promise.all(work);
  return { ...props, segments, ...(layers ? { layers } : {}) };
}

/** Renders the Reel composition with the given props and returns the MP4 bytes. */
export async function renderReelInSandbox(job: { id: string; props: ReelProps }): Promise<Buffer> {
  const sandbox = await withTimeLeft(await remotionSandbox());
  const dir = `${ROOT}/jobs/${job.id}`;
  const media = `${REMOTION}/build/public/jobs/${job.id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" "$2" && mkdir -p "$1"', [dir, media]);
    const props = await localMedia(sandbox, job.id, job.props);
    await sandbox.writeFiles([{ path: `${dir}/props.json`, content: JSON.stringify(props) }]);
    await bash(
      sandbox,
      `cd ${REMOTION} && npx remotion render build Reel "$1/out.mp4" --props="$1/props.json" --concurrency=4 --codec=h264 --crf=18 --jpeg-quality=95 --pixel-format=yuv420p --enforce-audio-track --log=error`,
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
  /** The photos it composes with (signed links), and for an animation over several shots, its cuts. */
  photos?: ScenePhoto[];
  cuts?: number[];
  /** A collage's composition: the shots it lays (each one a grey card in the check). */
  shots?: ComposeShot[];
  /** What moves in the footage under it, so a text that follows a hand is checked where it goes; with the Reel's rhythm and look (its camera moves). */
  track?: TrackPiece[];
  look?: { template?: MotionTemplate; tempo?: number; signature?: ReelProps["brand"]["signature"] };
  /** The Google Fonts families its code brings besides the brand's two: laid out with them. */
  fonts?: string[];
  /** A collage's composition that draws the whole picture: the Reel's texts (each one checked, written whole at its moment) and its end. */
  reelTexts?: ComposeText[];
  end?: ComposeEnd | null;
};

/**
 * What the scene check found: the error per scene id (null when it passes), and, for a passing
 * scene, its texts that stay on a face of the footage under it or go too quickly to be read
 * (what to change, for the motion designer).
 */
export type SceneChecks = { errors: Record<string, string | null>; faces: Record<string, string> };

/**
 * Runs generated motion scenes outside the video: a server render (first, middle,
 * last frame), then a layout check in Chrome with the studio's fonts, which
 * rejects a scene whose text leaves the frame or the safe zone, and finds the
 * texts that stay on a face it follows.
 */
export async function smokeTestScenes(
  scenes: SmokeScene[],
  brand?: Pick<ReelProps["brand"], "name" | "accent" | "accentInk" | "displayFont" | "bodyFont" | "logoUrl" | "logoOnDark">,
): Promise<SceneChecks> {
  if (!scenes.length) return { errors: {}, faces: {} };
  const sandbox = await withTimeLeft(await remotionSandbox());
  const file = `${ROOT}/jobs/smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  try {
    await sandbox.writeFiles([{ path: file, content: JSON.stringify(scenes.map((s) => ({ ...s, brand }))) }]);
    const result = await sandbox.runCommand({ cmd: "bash", args: ["-c", `cd ${REMOTION} && timeout 150 node smoke.mjs "$1"`, "bash", file] });
    const lastLine = (await result.stdout()).trim().split("\n").at(-1) ?? "";
    try {
      const parsed = JSON.parse(lastLine) as {
        results?: Record<string, string | null>;
        faces?: Record<string, string>;
      } & Record<string, unknown>;
      // A workshop still on the previous checker prints the errors alone.
      if (parsed.results && typeof parsed.results === "object") return { errors: parsed.results, faces: parsed.faces ?? {} };
      return { errors: parsed as Record<string, string | null>, faces: {} };
    } catch {
      const output = (await result.output("both").catch(() => "")).slice(-400);
      return { errors: Object.fromEntries(scenes.map((s) => [s.id, `smoke test failed: ${output}`])), faces: {} };
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
  const sandbox = await withTimeLeft(await remotionSandbox());
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
 * Frames of a Reel before its render, as it will come out (her footage, its texts and subtitles):
 * the motion designer looks at its animations there before they go out. Its media are copied
 * into the sandbox as for a render (the caller leaves out the shots no frame shows), then each
 * frame is a still of the Reel composition, at `scale` of its size. The image of each frame, or its error.
 */
export async function reelFramesInSandbox(id: string, props: ReelProps, frames: number[], scale = 0.5): Promise<Record<number, Buffer | Error>> {
  if (!frames.length) return {};
  const sandbox = await withTimeLeft(await remotionSandbox());
  const dir = `${ROOT}/jobs/${id}`;
  const media = `${REMOTION}/build/public/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" "$2" && mkdir -p "$1"', [dir, media]);
    const local = await localMedia(sandbox, id, props);
    const jobs = frames.map((frame, i) => ({ id: `f${i}`, frame, out: `${dir}/f${i}.jpg`, scale }));
    await sandbox.writeFiles([{ path: `${dir}/frames.json`, content: JSON.stringify({ props: local, jobs }) }]);
    const result = await sandbox.runCommand({ cmd: "bash", args: ["-c", `cd ${REMOTION} && timeout 240 node stills.mjs "$1/frames.json"`, "bash", dir] });
    const lastLine = (await result.stdout()).trim().split("\n").at(-1) ?? "";
    let errors: Record<string, string | null>;
    try {
      errors = JSON.parse(lastLine) as Record<string, string | null>;
    } catch {
      const output = (await result.output("both").catch(() => "")).slice(-600);
      throw new Error(`frames failed: ${output}`);
    }
    const images: Record<number, Buffer | Error> = {};
    for (const job of jobs) {
      const error = errors[job.id];
      if (error) {
        images[job.frame] = new Error(error);
        continue;
      }
      const jpeg = await sandbox.readFileToBuffer({ path: job.out }).catch(() => null);
      images[job.frame] = jpeg?.length ? jpeg : new Error("frame produced no file");
    }
    return images;
  } finally {
    await bash(sandbox, 'rm -rf "$1" "$2"', [dir, media]).catch(() => {});
  }
}

/**
 * Key frames of a rendered video, for the critic: one JPEG (540 px wide) per
 * instant, cut by ffmpeg from the MP4 at `url`. An instant past the end gives no frame.
 */
export async function videoFramesInSandbox(id: string, url: string, times: number[]): Promise<{ t: number; jpeg: Buffer }[]> {
  if (!times.length) return [];
  const sandbox = await jobSandbox();
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

/** One scene's thumbnail in the strip: the Reel at a tenth of its size. */
const TILE = { width: 108, height: 192 };

/**
 * One small image per scene of a rendered Reel (at `times`), side by side in a single
 * JPEG: the strip under the video. A moment past the end takes the image before it.
 */
export async function sceneSpriteInSandbox(id: string, url: string, times: number[]): Promise<Buffer | null> {
  if (times.length < 2) return null;
  const sandbox = await jobSandbox();
  const dir = `${ROOT}/jobs/${id}-scenes`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await bash(sandbox, FETCH, [`${dir}/in.mp4`, url]);
    await bash(
      sandbox,
      [
        'cd "$1" && shift',
        `${ROOT}/ffmpeg -loglevel error -y -f lavfi -i "color=c=black:s=${TILE.width}x${TILE.height}" -frames:v 1 blank.jpg`,
        `i=0; prev=blank.jpg; for t in "$@"; do f=$(printf "f%03d.jpg" "$i"); ${ROOT}/ffmpeg -loglevel error -y -ss "$t" -i in.mp4 -frames:v 1 -vf "scale=${TILE.width}:${TILE.height}" -q:v 4 "$f" || true; [ -s "$f" ] || cp "$prev" "$f"; prev="$f"; i=$((i+1)); done`,
        `${ROOT}/ffmpeg -loglevel error -y -framerate 1 -i f%03d.jpg -vf "tile=$#x1" -frames:v 1 -q:v 5 sprite.jpg`,
      ].join("\n"),
      [dir, ...times.map((t) => Math.max(0, t).toFixed(2))],
    );
    const jpeg = await sandbox.readFileToBuffer({ path: `${dir}/sprite.jpg` }).catch(() => null);
    return jpeg?.length ? jpeg : null;
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/** Bash function `loud <file> [seconds]`: the integrated loudness (LUFS, EBU R128) of a file's sound (of its start), empty when it has none. */
const LOUD = `loud() { ${ROOT}/ffmpeg -hide_banner -nostats \${2:+-t "$2"} -i "$1" -vn -af ebur128 -f null - 2>&1 | sed -n '/Summary:/,$p' | awk '/ I:/{print $2; exit}'; }`;

/**
 * A Reel followed by its own first `tail` seconds, as Instagram loops it, copied
 * as they are: what the composer watches, so the ending it writes falls after the Reel.
 */
export async function loopedReelInSandbox(id: string, mp4: Buffer, duration: number, tail: number): Promise<Buffer> {
  const sandbox = await jobSandbox();
  const dir = `${ROOT}/jobs/${id}-loop`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await sandbox.writeFiles([{ path: `${dir}/in.mp4`, content: mp4 }]);
    await bash(sandbox, `cd "$1" && ${ROOT}/ffmpeg -loglevel error -y -stream_loop 1 -i in.mp4 -t "$2" -c copy looped.mp4`, [dir, (duration + tail).toFixed(2)]);
    const out = await sandbox.readFileToBuffer({ path: `${dir}/looped.mp4` });
    if (!out?.length) throw new Error("loop produced no file");
    return out;
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/**
 * The bass level (dB) of each `step` seconds over the first `seconds` of a piece of music:
 * where its beat holds (grooveGaps, every half second), where its beats land (beatGrid, every 10 ms).
 */
export async function bassLevelsInSandbox(id: string, audio: Uint8Array, seconds: number, step = GROOVE_STEP): Promise<number[]> {
  const sandbox = await jobSandbox();
  const dir = `${ROOT}/jobs/${id}-bass`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await sandbox.writeFiles([{ path: `${dir}/music.mp3`, content: audio }]);
    const run = await bash(
      sandbox,
      `cd "$1" && ${ROOT}/ffmpeg -hide_banner -nostats -t "$2" -i music.mp3 -vn -af "$3" -f null - 2>&1 | grep -o 'RMS_level=[^ ]*' | cut -d= -f2`,
      [dir, seconds.toFixed(2), bassLevelsFilter(step)],
    );
    // Silence prints -inf.
    return (await run.stdout())
      .split(/\s+/)
      .filter(Boolean)
      .map((v) => (Number.isFinite(Number(v)) ? Number(v) : -120));
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/**
 * A piece of music set on a Reel's beat grid (beatGrid): started on its first beat
 * (`offset` s cut off) and its tempo moved by `tempo` (its beat / the grid's, a few
 * percent at most, the pitch kept), so every cut falls on one of its beats.
 */
export async function alignMusicInSandbox(id: string, audio: Uint8Array, offset: number, tempo: number): Promise<Uint8Array> {
  const filters = [
    ...(offset >= 0.015 ? [`atrim=start=${offset.toFixed(3)}`, "asetpts=PTS-STARTPTS"] : []),
    ...(Math.abs(tempo - 1) >= 0.001 ? [`atempo=${tempo.toFixed(4)}`] : []),
  ];
  if (!filters.length) return audio;
  const sandbox = await jobSandbox();
  const dir = `${ROOT}/jobs/${id}-align`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await sandbox.writeFiles([{ path: `${dir}/music.mp3`, content: audio }]);
    await bash(sandbox, `cd "$1" && ${ROOT}/ffmpeg -loglevel error -y -i music.mp3 -vn -af "$2" -c:a libmp3lame -b:a 192k aligned.mp3`, [dir, filters.join(",")]);
    const out = await sandbox.readFileToBuffer({ path: `${dir}/aligned.mp3` });
    if (!out?.length) throw new Error("alignment produced no file");
    return new Uint8Array(out);
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/** A value printed as `name=value` by a sandbox command, null when missing. */
function printed(stdout: string, name: string): number | null {
  const value = Number(new RegExp(`\\b${name}=(-?[0-9.]+)`).exec(stdout)?.[1] ?? Number.NaN);
  return Number.isFinite(value) ? value : null;
}

/**
 * A rendered video with its soundtrack: the picture copied as it is, the music in
 * AAC under the video's own sound, faded out over the last 0.8 s and cut at the
 * end of the video. Both are measured first: what is said (her voice, Simone's,
 * someone in a clip) is brought to the level of a voice, the music lies under it
 * and ducks while it speaks (mixGains: well under a voice over the whole Reel,
 * at its level around a few spoken shots). A video without sound just gets the music.
 */
export async function muxAudioInSandbox(id: string, mp4: Buffer, audio: Uint8Array, options: { voiceOver?: boolean } = {}): Promise<Buffer> {
  const sandbox = await jobSandbox();
  const dir = `${ROOT}/jobs/${id}-mux`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await sandbox.writeFiles([
      { path: `${dir}/in.mp4`, content: mp4 },
      { path: `${dir}/music.mp3`, content: audio },
    ]);
    const probe = await bash(
      sandbox,
      // The music is measured over the Reel only: the composer's ending after it is cut off.
      `cd "$1" && ${LOUD} && d=$(${ROOT}/ffmpeg -i in.mp4 2>&1 | sed -n 's/.*Duration: \\([0-9:.]*\\).*/\\1/p' | awk -F: '{print $1*3600+$2*60+$3}'); echo "duration=$d speech=$(loud in.mp4) music=$(loud music.mp3 "$d")"`,
      [dir],
    );
    const measured = await probe.stdout();
    const gains = mixGains({ speech: printed(measured, "speech"), music: printed(measured, "music") }, Boolean(options.voiceOver));
    console.info("mix", id, measured.trim(), gains);
    await bash(
      sandbox,
      `cd "$1" && ${ROOT}/ffmpeg -loglevel error -y -i in.mp4 -i music.mp3 -filter_complex "$2" -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out.mp4`,
      [dir, mixFilter(gains, printed(measured, "duration") ? printed(measured, "duration")! - 0.8 : null)],
    );
    const out = await sandbox.readFileToBuffer({ path: `${dir}/out.mp4` });
    if (!out?.length) throw new Error("mux produced no file");
    return out;
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/**
 * A voice brought to the level of a voice in a Reel (SPEECH_LUFS, a fixed gain,
 * peaks held under -1 dBFS), as MP3 of the same length: ElevenLabs' voices come
 * out 12 dB apart, and the live preview plays the file as it is. Unchanged when silent.
 */
export async function levelSpeechInSandbox(
  id: string,
  mp3: Buffer,
  pauses: { at: number; add: number }[] = [],
): Promise<{ mp3: Buffer; lufs: number | null; paused: boolean; pauses: { at: number; add: number }[] }> {
  const sandbox = await jobSandbox();
  const dir = `${ROOT}/jobs/${id}-level`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await sandbox.writeFiles([{ path: `${dir}/in.mp3`, content: mp3 }]);
    const lufs = printed(await (await bash(sandbox, `cd "$1" && ${LOUD} && echo "speech=$(loud in.mp3)"`, [dir])).stdout(), "speech");
    // Each breath opened where the voice is really quiet, never in a word (its timing is approximate).
    if (pauses.length) {
      const run = await bash(
        sandbox,
        `cd "$1" && ${ROOT}/ffmpeg -hide_banner -nostats -i in.mp3 -vn -af "$2" -f null - 2>&1 | grep -o 'RMS_level=[^ ]*' | cut -d= -f2`,
        [dir, speechLevelsFilter(BEAT_STEP)],
      );
      const levels = (await run.stdout())
        .split(/\s+/)
        .filter(Boolean)
        .map((v) => (Number.isFinite(Number(v)) ? Number(v) : -120));
      pauses = quietPauses(pauses, levels, BEAT_STEP);
    }
    const gain = speechGain(lufs);
    const level = gain !== null && Math.abs(gain) >= 0.5 ? `volume=${gain}dB,alimiter=limit=${MIX_CEILING}:level=false` : null;
    if (!level && !pauses.length) return { mp3, lufs, paused: false, pauses };
    // A breath opened between two sentences read in one go, then the level.
    const filter = pauses.length ? ["-filter_complex", pauseFilter(pauses, level), "-map", "[out]"] : ["-af", level!];
    await bash(sandbox, `cd "$1" && ${ROOT}/ffmpeg -loglevel error -y -i in.mp3 "$2" "$3" ${pauses.length ? '"$4" "$5"' : ""} -c:a libmp3lame -b:a 160k out.mp3`, [dir, ...filter]);
    const out = await sandbox.readFileToBuffer({ path: `${dir}/out.mp3` });
    if (!out?.length) throw new Error("leveling produced no file");
    return { mp3: out, lufs, paused: pauses.length > 0, pauses };
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/**
 * A voice as a phone records a WhatsApp voice note: OGG Opus, 16 kHz mono, 24 kb/s,
 * band-limited and 8 dB quieter than a voice in a Reel (the lab's stand-in for hers).
 */
export async function voiceNoteInSandbox(id: string, mp3: Buffer): Promise<Buffer> {
  const sandbox = await jobSandbox();
  const dir = `${ROOT}/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await sandbox.writeFiles([{ path: `${dir}/in.mp3`, content: mp3 }]);
    await bash(
      sandbox,
      // libopus as WhatsApp does; ffmpeg's own Opus encoder (48 kHz only) if the build lacks it.
      `cd "$1" && f="highpass=f=90,lowpass=f=7000,volume=-8dB" && { ${ROOT}/ffmpeg -loglevel error -y -i in.mp3 -af "$f" -ac 1 -ar 16000 -c:a libopus -b:a 24k -application voip note.ogg || ${ROOT}/ffmpeg -loglevel error -y -i in.mp3 -af "$f" -ac 1 -ar 48000 -c:a opus -strict -2 -b:a 32k note.ogg; }`,
      [dir],
    );
    const out = await sandbox.readFileToBuffer({ path: `${dir}/note.ogg` });
    if (!out?.length) throw new Error("voice note produced no file");
    return out;
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

/**
 * A business's home page as a visitor sees it, read in the sandbox's headless Chrome
 * (page.mjs): a capture of its top (1280 × 1800), the whole page at half size, and what
 * its styles really are (fonts of its titles and texts, colours of its blocks, texts and
 * buttons). The URL was checked to be public before; null when the page could not be read.
 */
export async function pageInSandbox(id: string, url: string): Promise<{ capture: Buffer; full: Buffer | null; measured: unknown } | null> {
  const sandbox = await withTimeLeft(await remotionSandbox());
  const dir = `${ROOT}/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    const result = await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-c",
        `chrome=$(find ${REMOTION}/node_modules/.remotion -type f -name chrome-headless-shell 2>/dev/null | head -1)
[ -n "$chrome" ] || { echo "no chrome"; exit 3; }
cd ${REMOTION} && BROWSER_EXECUTABLE="$chrome" timeout 75 node page.mjs "$2" "$1"`,
        "bash",
        dir,
        url,
      ],
    });
    if (result.exitCode !== 0) {
      console.warn("site page reading failed", url, result.exitCode, (await result.output("both").catch(() => "")).slice(-400));
      return null;
    }
    const [capture, full, json] = await Promise.all([
      sandbox.readFileToBuffer({ path: `${dir}/page.png` }),
      sandbox.readFileToBuffer({ path: `${dir}/full.jpg` }).catch(() => null),
      sandbox.readFileToBuffer({ path: `${dir}/page.json` }),
    ]);
    if (!capture?.length || !json?.length) return null;
    let measured: unknown = null;
    try {
      measured = JSON.parse(json.toString("utf8"));
    } catch {
      measured = null;
    }
    return { capture, full: full?.length ? full : null, measured };
  } catch (error) {
    console.warn("site page reading failed", url, error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
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
  const sandbox = await withTimeLeft(await remotionSandbox());
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

// ---------------------------------------------------------------------------
// Cut-outs (collages): the subject of a photo cut out pixel-exact by an open model
// (BiRefNet lite, MIT, rembg's ONNX export) on the CPU, with onnxruntime-node. In its
// own persistent sandbox: the model needs about 6.5 GB at its fixed 1024 px input
// (measured), which the 8 GB render sandbox cannot spare (it was killed, exit 137).
// It only runs for a collage's photos, each once, and stops 5 minutes after its last job.
// ---------------------------------------------------------------------------

const CUTOUT_NAME = "fauve-cutout-paris";
/** vCPUs of the cut-out sandbox: 16 GB of memory for the model, and 8 threads. */
const CUTOUT_VCPUS = 8;
const CUTOUT_ROOT = "/vercel/sandbox/cutout";
const CUTOUT_MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx";
const CUTOUT_MODEL_SHA256 = "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333";
const CUTOUT_SETUP = [
  "set -euo pipefail",
  `mkdir -p ${CUTOUT_ROOT}/jobs && cd ${CUTOUT_ROOT}`,
  `if [ ! -x ffmpeg ]; then curl -fsSL ${FFMPEG_URL} | gunzip > ffmpeg.tmp && chmod +x ffmpeg.tmp && mv ffmpeg.tmp ffmpeg; fi`,
  `[ -f package.json ] || echo '{"name":"cutout","private":true}' > package.json`,
  // Its CPU files come with the package: the install script only fetches CUDA ones.
  "[ -d node_modules/onnxruntime-node ] || npm i onnxruntime-node@1.30.0 --ignore-scripts --no-audit --no-fund --loglevel=error",
  `echo "${CUTOUT_MODEL_SHA256}  model.onnx" > model.sha256`,
  "sha256sum -c --status model.sha256 2>/dev/null || { curl -fsSL --retry 3 -o model.tmp '" + CUTOUT_MODEL_URL + "' && mv model.tmp model.onnx && sha256sum -c --status model.sha256; }",
].join("\n");

let cutoutReady: Promise<Sandbox> | undefined;

/** The cut-out sandbox, created on first use and resumed afterwards (slow only the first time; the warm-up installs it ahead). */
export function cutoutSandbox(): Promise<Sandbox> {
  cutoutReady ??= (async () => {
    const sandbox = await Sandbox.getOrCreate({
      name: CUTOUT_NAME,
      persistent: true,
      region: SANDBOX_REGION,
      resources: { vcpus: CUTOUT_VCPUS },
      timeout: 5 * 60_000,
    });
    await bash(sandbox, CUTOUT_SETUP);
    // The script ships with the render source (apps/render/cutout.mjs), written as this deploy has it.
    const script = REMOTION_SOURCE_FILES["cutout.mjs"];
    if (!script) throw new Error("cutout.mjs is missing from the render source");
    await sandbox.writeFiles([{ path: `${CUTOUT_ROOT}/cutout.mjs`, content: script }]);
    return sandbox;
  })().catch((error: unknown) => {
    cutoutReady = undefined;
    throw error;
  });
  return cutoutReady;
}

/** What `seconds` of work in the cut-out sandbox cost, in euros (logged in cost_events). */
export function cutoutCostEur(seconds: number): number {
  return usdToEur(sandboxCostUsd(seconds, CUTOUT_VCPUS, SANDBOX_REGION), env("USD_TO_EUR"));
}

/** What the cut-out of a photo is like (shares of the photo; `touches`: how much of each edge the subject runs into). */
export type CutoutReading = {
  w: number;
  h: number;
  coverage: number;
  parts: number;
  box: { x: number; y: number; w: number; h: number };
  touches: { top: number; bottom: number; left: number; right: number };
  unsure: number;
};

/**
 * Cuts the subject out of each photo (signed URL): its image with transparency (WebP,
 * else PNG) and what it is like, or the error. One model load for all of them; each
 * photo takes 10 to 30 s on the sandbox's CPUs.
 */
export async function cutoutsInSandbox(
  id: string,
  photos: { id: string; url: string }[],
): Promise<{ results: Record<string, { image: Buffer; type: "image/webp" | "image/png"; reading: CutoutReading } | Error>; seconds: number }> {
  if (!photos.length) return { results: {}, seconds: 0 };
  const started = Date.now();
  const sandbox = await withTimeLeft(await cutoutSandbox());
  const dir = `${CUTOUT_ROOT}/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    // A stopped sandbox resumes on that first command: now it can be given the time for the job.
    await withTimeLeft(sandbox);
    await Promise.all(photos.map((p, i) => bash(sandbox, FETCH, [`${dir}/in${i}`, p.url])));
    const jobs = photos.map((p, i) => ({ id: p.id, src: `${dir}/in${i}`, out: `${dir}/out${i}` }));
    await sandbox.writeFiles([{ path: `${dir}/jobs.json`, content: JSON.stringify(jobs) }]);
    const run = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", `cd ${CUTOUT_ROOT} && CUTOUT_HOME=${CUTOUT_ROOT} FFMPEG=${CUTOUT_ROOT}/ffmpeg timeout 600 node cutout.mjs "$1/jobs.json"`, "bash", dir],
    });
    const lastLine = (await run.stdout()).trim().split("\n").at(-1) ?? "";
    let readings: Record<string, (CutoutReading & { file: string }) | { error: string }>;
    try {
      readings = JSON.parse(lastLine);
    } catch {
      // 137: killed, most often for memory.
      const output = (await run.output("both").catch(() => "")).slice(-400);
      throw new Error(`cut-out failed (${run.exitCode}): ${output}`);
    }
    const results: Record<string, { image: Buffer; type: "image/webp" | "image/png"; reading: CutoutReading } | Error> = {};
    for (const p of photos) {
      const r = readings[p.id];
      if (!r || "error" in r) {
        results[p.id] = new Error(r && "error" in r ? r.error : "no cut-out");
        continue;
      }
      const { file, ...reading } = r;
      const image = await sandbox.readFileToBuffer({ path: file }).catch(() => null);
      results[p.id] = image?.length ? { image, type: file.endsWith(".webp") ? "image/webp" : "image/png", reading } : new Error("cut-out file missing");
    }
    return { results, seconds: (Date.now() - started) / 1000 };
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// What moves in her videos: hands (21 points each), faces and bodies, image by image, read
// by open models (MediaPipe Tasks, Apache 2.0) on the CPU, in the cut-out sandbox (its 8
// vCPUs), with Python. Each clip once (apps/render/track.py); the animations over it follow
// what was read. MediaPipe links the EGL and GLES libraries even on the CPU (it never draws
// on a GPU here): their dispatchers, from the system's packages, are enough.
// ---------------------------------------------------------------------------

const TRACK_ROOT = `${CUTOUT_ROOT}/track`;
/** Each model pinned by its checksum. */
export const TRACK_MODELS: { file: string; url: string; sha256: string }[] = [
  {
    file: "hand_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    sha256: "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
  },
  {
    file: "pose_landmarker_full.task",
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    sha256: "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1",
  },
  {
    file: "blaze_face_short_range.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
    sha256: "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f",
  },
];
/** uv, pinned (a single binary, taken from its wheel on PyPI): it brings its own Python, whatever the image has. */
const UV_WHEEL = {
  url: "https://files.pythonhosted.org/packages/e5/83/85a6c63c24905af4924fddb11a499b934913f59a134248367a1ef1a4716f/uv-0.12.23-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
  sha256: "565c6e2874dbeae86c02f3dea97255e878fec672659a73d4930c6b93fcab2fff",
};
/** Installs uv in `bin/uv` of the current directory, once (its wheel checked, the binary taken out of it). */
const UV_INSTALL = `[ -x bin/uv ] || { curl -fsSL --retry 3 -o uv.whl '${UV_WHEEL.url}' && echo "${UV_WHEEL.sha256}  uv.whl" | sha256sum -c --status && { python3 -c 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); sys.stdout.buffer.write(z.read(next(n for n in z.namelist() if n.endswith("/scripts/uv"))))' uv.whl || unzip -p uv.whl '*/scripts/uv'; } > bin/uv.tmp && chmod +x bin/uv.tmp && mv bin/uv.tmp bin/uv && rm uv.whl; }`;
/**
 * The tracker's packages, all of them pinned and installed without dependencies. The vision
 * tasks import OpenCV and matplotlib for drawing helpers they never use here: headless builds.
 */
const TRACK_PACKAGES = [
  "mediapipe==1.1.1", "numpy==2.5.4", "absl-py==2.5.1", "flatbuffers==25.12.19", "certifi==2026.7.22",
  "opencv-python-headless==5.0.0.93", "matplotlib==3.11.2", "contourpy==1.4.0", "cycler==0.12.1", "fonttools==4.67.0",
  "kiwisolver==1.5.1", "packaging==26.3", "pillow==13.0.0", "pyparsing==3.3.3", "python-dateutil==2.9.0.post0", "six==1.17.0",
];
const TRACK_SETUP = [
  "set -euo pipefail",
  `mkdir -p ${TRACK_ROOT}/models ${TRACK_ROOT}/jobs ${TRACK_ROOT}/bin && cd ${TRACK_ROOT}`,
  // The two libraries MediaPipe links, from the image's packages (Ubuntu; dnf on an Amazon Linux image).
  "libs=$(/sbin/ldconfig -p 2>/dev/null || true)",
  'if [[ "$libs" != *"libEGL.so.1 "* || "$libs" != *"libGLESv2.so.2 "* ]]; then if command -v apt-get >/dev/null; then sudo apt-get update -qq && sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends libegl1 libgles2 >/dev/null; else sudo dnf install -y -q libglvnd-egl libglvnd-gles; fi; fi',
  UV_INSTALL,
  `export UV_PYTHON_INSTALL_DIR=${TRACK_ROOT}/python UV_PYTHON_PREFERENCE=only-managed UV_NO_CACHE=1`,
  `py/bin/python -c "import mediapipe, cv2, matplotlib" 2>/dev/null || { rm -rf py && bin/uv venv -q --python 3.13 py && bin/uv pip install -q --python py/bin/python --no-deps ${TRACK_PACKAGES.join(" ")}; }`,
  ...TRACK_MODELS.map(
    (m) =>
      `echo "${m.sha256}  models/${m.file}" | sha256sum -c --status 2>/dev/null || { curl -fsSL --retry 3 -o models/${m.file}.tmp '${m.url}' && mv models/${m.file}.tmp models/${m.file} && echo "${m.sha256}  models/${m.file}" | sha256sum -c --status; }`,
  ),
].join("\n");

let trackReady: Promise<Sandbox> | undefined;

/** The cut-out sandbox with the tracker installed (slow only the first time: the warm-up installs it ahead). */
export function trackSandbox(): Promise<Sandbox> {
  trackReady ??= (async () => {
    const sandbox = await withTimeLeft(await cutoutSandbox());
    await bash(sandbox, TRACK_SETUP);
    // The script ships with the render source (apps/render/track.py), written as this deploy has it.
    const script = REMOTION_SOURCE_FILES["track.py"];
    if (!script) throw new Error("track.py is missing from the render source");
    await sandbox.writeFiles([{ path: `${TRACK_ROOT}/track.py`, content: script }]);
    return sandbox;
  })().catch((error: unknown) => {
    trackReady = undefined;
    throw error;
  });
  return trackReady;
}

/** What the tracker found in a clip: its file (JSON) and how many hands, faces and bodies it followed. */
export type TrackReading = { file: Buffer; frames: number; hands: number; faces: number; bodies: number };

/**
 * Follows what moves in each video (signed URL), up to a minute of each: its tracks file, or
 * the error. Four clips at a time on the sandbox's CPUs, about 2.5 s of work per second of video.
 */
export async function tracksInSandbox(id: string, videos: { id: string; url: string }[]): Promise<{ results: Record<string, TrackReading | Error>; seconds: number }> {
  if (!videos.length) return { results: {}, seconds: 0 };
  const started = Date.now();
  const sandbox = await withTimeLeft(await trackSandbox());
  const dir = `${TRACK_ROOT}/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await withTimeLeft(sandbox);
    await Promise.all(videos.map((v, i) => bash(sandbox, FETCH, [`${dir}/in${i}`, v.url])));
    const jobs = videos.map((v, i) => ({ id: v.id, src: `${dir}/in${i}`, out: `${dir}/out${i}.json` }));
    await sandbox.writeFiles([{ path: `${dir}/jobs.json`, content: JSON.stringify(jobs) }]);
    const run = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", `cd ${TRACK_ROOT} && TRACK_MODELS=${TRACK_ROOT}/models FFMPEG=${CUTOUT_ROOT}/ffmpeg timeout 480 py/bin/python -I track.py "$1/jobs.json"`, "bash", dir],
    });
    const lastLine = (await run.stdout()).trim().split("\n").at(-1) ?? "";
    let readings: Record<string, { file: string; frames: number; hands: number; faces: number; bodies: number } | { error: string }>;
    try {
      readings = JSON.parse(lastLine);
    } catch {
      const output = (await run.output("both").catch(() => "")).slice(-400);
      throw new Error(`tracking failed (${run.exitCode}): ${output}`);
    }
    const results: Record<string, TrackReading | Error> = {};
    for (const v of videos) {
      const r = readings[v.id];
      if (!r || "error" in r) {
        results[v.id] = new Error(r && "error" in r ? r.error : "nothing tracked");
        continue;
      }
      const file = await sandbox.readFileToBuffer({ path: r.file }).catch(() => null);
      results[v.id] = file?.length ? { file, frames: r.frames, hands: r.hands, faces: r.faces, bodies: r.bodies } : new Error("tracks file missing");
    }
    return { results, seconds: (Date.now() - started) / 1000 };
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// « Steal »: a Reel she likes, opened from its link (yt-dlp, for a public Reel, TikTok or
// Short) or fetched as a file (one she sent, one shared with Simone on Instagram), then
// measured: its hard cuts (ffmpeg's scene detection), its loudness and its bass every 10 ms
// (its tempo). A small copy (720 px, 30 fps, its sound) comes back for Gemini; nothing is kept.
// ---------------------------------------------------------------------------

const STEAL = `${ROOT}/steal`;
/** The longest Reel taken, in seconds (Instagram's Reels run up to 3 minutes). */
const STEAL_MAX_SECONDS = 180;
/** yt-dlp pinned (its wheel checked), with the packages its own « pin » extras pin, impersonation included. */
const YT_DLP = {
  file: "yt_dlp-2026.8.19-py3-none-any.whl",
  url: "https://files.pythonhosted.org/packages/69/b2/8cd1613f56eed7ceb64fbd4df3f1c01246bfb098e6f398228bafda22b80b/yt_dlp-2026.8.19-py3-none-any.whl",
  sha256: "1d57897e94c6665a0a6f9bc54b34e584284e32c034ffab3a7df25d8f7b24eedf",
  packages: [
    "certifi==2026.7.22", "brotli==1.2.0", "mutagen==1.48.1", "pycryptodomex==3.23.0", "requests==2.34.2", "urllib3==2.7.0",
    "charset-normalizer==3.5.0", "idna==3.18", "websockets==17.0.1", "yt-dlp-ejs==0.8.0", "curl-cffi==0.16.0", "cffi==2.1.1", "pycparser==3.0",
  ],
};
const STEAL_SETUP = [
  "set -euo pipefail",
  `mkdir -p ${STEAL}/bin && cd ${STEAL}`,
  UV_INSTALL,
  `echo "${YT_DLP.sha256}  ${YT_DLP.file}" | sha256sum -c --status 2>/dev/null || { curl -fsSL --retry 3 -o dl.tmp '${YT_DLP.url}' && mv dl.tmp ${YT_DLP.file} && echo "${YT_DLP.sha256}  ${YT_DLP.file}" | sha256sum -c --status; }`,
  // Its own Python, whatever the image has (as the tracker's).
  `export UV_PYTHON_INSTALL_DIR=${STEAL}/python UV_PYTHON_PREFERENCE=only-managed UV_NO_CACHE=1`,
  `py/bin/python -I -c "import yt_dlp, curl_cffi" 2>/dev/null || { rm -rf py && bin/uv venv -q --python 3.13 py && bin/uv pip install -q --python py/bin/python --no-deps ./${YT_DLP.file} ${YT_DLP.packages.join(" ")}; }`,
].join("\n");

let stealReady: Promise<Sandbox> | undefined;

/** The render sandbox with yt-dlp installed (slow only the first time). */
function stealSandbox(): Promise<Sandbox> {
  stealReady ??= (async () => {
    const sandbox = await jobSandbox();
    await bash(sandbox, STEAL_SETUP);
    return sandbox;
  })().catch((error: unknown) => {
    stealReady = undefined;
    throw error;
  });
  return stealReady;
}

/**
 * One Reel taken and measured in `$1`: from the link `$2` (yt-dlp, its smallest version of
 * 720 px or more, once more as a browser if refused) or the file at `$2` when `$3` is « file ».
 * Exits 10 when it cannot be opened, 11 when it runs over STEAL_MAX_SECONDS, 12 when it is no video.
 */
const STEAL_JOB = [
  "set -uo pipefail",
  'cd "$1"',
  'if [ "$3" = link ]; then',
  `  dl() { timeout "$T" ${STEAL}/py/bin/python -I -m yt_dlp --ignore-config --no-playlist --no-progress --no-mtime --max-filesize 120M --match-filters "duration<=?${STEAL_MAX_SECONDS}" -S "res:720" -f "bv*+ba/b" --merge-output-format mp4 --ffmpeg-location ${ROOT}/ffmpeg --js-runtimes node --fixup never -o "in.%(ext)s" "$@" "$URL" >> fetch.log 2>&1; }`,
  // Within a reply's 5 minutes: 90 s, then 60 s as a browser.
  '  URL="$2"; T=90 dl || T=60 dl --impersonate chrome || true',
  '  f=$(ls in.* 2>/dev/null | grep -vE "\\.(part|ytdl)$" | head -1); [ -n "$f" ] && mv "$f" in.src',
  '  [ -s in.src ] || { grep -qE "does not pass filter|larger than max-filesize" fetch.log && exit 11; exit 10; }',
  "else",
  `  f() { ${FETCH}; }; f in.src "$2" >> fetch.log 2>&1 || exit 10`,
  "fi",
  `info=$(${ROOT}/ffmpeg -hide_banner -i in.src 2>&1 || true)`,
  'grep -q "Video:" <<<"$info" || exit 12',
  `d=$(sed -n 's/.*Duration: \\([0-9:.]*\\).*/\\1/p' <<<"$info" | head -1 | awk -F: '{print $1*3600+$2*60+$3}')`,
  'awk -v d="${d:-0}" \'BEGIN { exit !(d > 0.5) }\' || exit 12',
  `awk -v d="$d" 'BEGIN { exit !(d <= ${STEAL_MAX_SECONDS}) }' || exit 11`,
  `${ROOT}/ffmpeg -loglevel error -y -i in.src -map 0:v:0 -map "0:a:0?" -vf "scale='min(720,iw)':-2,fps=30,format=yuv420p" -c:v libx264 -preset veryfast -crf 26 -c:a aac -b:a 128k -movflags +faststart reel.mp4 || exit 12`,
  "rm -f in.src",
  `${ROOT}/ffmpeg -hide_banner -nostats -i reel.mp4 -an -vf "scale=320:-2,scdet=threshold=12" -f null - 2> cuts.log || true`,
  `${ROOT}/ffmpeg -hide_banner -nostats -i reel.mp4 -vn -af "$4" -f null - 2>&1 | grep -o 'RMS_level=[^ ]*' | cut -d= -f2 > bass.txt || true`,
  LOUD,
  'echo "duration=$d lufs=$(loud reel.mp4)"',
].join("\n");

/** Why a Reel could not be taken: its link or file did not open, it runs over 3 minutes, it is no video. */
export type StealMiss = "unreachable" | "too_long" | "not_video";

/** A Reel taken and measured: its small copy (for Gemini, never kept), its length, cuts, loudness and bass. */
export type StolenReel = { video: Buffer; duration: number; cuts: number[]; lufs: number | null; levels: number[]; seconds: number };

/**
 * Takes a Reel from its link (a public Reel, TikTok or Short) or from a file (a signed URL)
 * and measures it. A miss says why (and what yt-dlp or curl said); any other failure throws.
 */
export async function stealReelInSandbox(id: string, source: { link: string } | { file: string }): Promise<StolenReel | { miss: StealMiss; detail: string }> {
  const started = Date.now();
  const link = "link" in source;
  const sandbox = await withTimeLeft(await (link ? stealSandbox() : renderSandbox()));
  const dir = `${ROOT}/jobs/${id}`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    const run = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", STEAL_JOB, "bash", dir, link ? source.link : source.file, link ? "link" : "file", bassLevelsFilter(BEAT_STEP)],
    });
    if (run.exitCode !== 0) {
      const log = await sandbox.readFileToBuffer({ path: `${dir}/fetch.log` }).catch(() => null);
      const detail = `${(await run.output("both").catch(() => "")).slice(-300)} ${log?.toString("utf8").slice(-600) ?? ""}`.trim();
      const miss = ({ 10: "unreachable", 11: "too_long", 12: "not_video" } as const)[run.exitCode as 10 | 11 | 12];
      if (miss) return { miss, detail };
      throw new Error(`steal failed (${run.exitCode}): ${detail}`);
    }
    const out = await run.stdout();
    const duration = printed(out, "duration") ?? 0;
    const [video, cuts, bass] = await Promise.all([
      sandbox.readFileToBuffer({ path: `${dir}/reel.mp4` }),
      sandbox.readFileToBuffer({ path: `${dir}/cuts.log` }).catch(() => null),
      sandbox.readFileToBuffer({ path: `${dir}/bass.txt` }).catch(() => null),
    ]);
    if (!video?.length) return { miss: "not_video", detail: "no copy" };
    return {
      video,
      duration,
      cuts: parseSceneCuts(cuts?.toString("utf8") ?? "", duration),
      lufs: printed(out, "lufs"),
      // Silence prints -inf.
      levels: (bass?.toString("utf8") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((v) => (Number.isFinite(Number(v)) ? Number(v) : -120)),
      seconds: (Date.now() - started) / 1000,
    };
  } finally {
    await bash(sandbox, 'rm -rf "$1"', [dir]).catch(() => {});
  }
}
