import "server-only";
import { APIError, Sandbox } from "@vercel/sandbox";
import { MIX_CEILING, mixFilter, mixGains, pauseFilter, REEL_FPS, RENDER_FONTS, SANDBOX_REGION, sandboxCostUsd, speechGain, usdToEur, type ReelProps, type ReelUnder } from "@fauve/agent";
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
    await sandbox.extendTimeout(JOB_MS - Math.max(0, left)).catch((error: unknown) => console.warn("render sandbox: timeout not extended", error));
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
  if (name === NAME) throw new Error(`${NAME} is the render sandbox in service`);
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
  const segments = props.segments.map((segment) => {
    if (segment.type === "clip" || segment.type === "image") return { ...segment, src: local(segment.src, segment.type === "clip") };
    return segment.under ? { ...segment, under: under(segment.under) } : segment;
  });
  if (!work.length) return props;
  await bash(sandbox, 'mkdir -p "$1"', [`${REMOTION}/build/public/jobs/${id}`]);
  await Promise.all(work);
  return { ...props, segments };
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
  const sandbox = await withTimeLeft(await remotionSandbox());
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

/** Bash function `loud <file>`: the integrated loudness (LUFS, EBU R128) of a file's sound, empty when it has none. */
const LOUD = `loud() { ${ROOT}/ffmpeg -hide_banner -nostats -i "$1" -vn -af ebur128 -f null - 2>&1 | sed -n '/Summary:/,$p' | awk '/ I:/{print $2; exit}'; }`;

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
      `cd "$1" && ${LOUD} && d=$(${ROOT}/ffmpeg -i in.mp4 2>&1 | sed -n 's/.*Duration: \\([0-9:.]*\\).*/\\1/p' | awk -F: '{print $1*3600+$2*60+$3}'); echo "duration=$d speech=$(loud in.mp4) music=$(loud music.mp3)"`,
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
): Promise<{ mp3: Buffer; lufs: number | null; paused: boolean }> {
  const sandbox = await jobSandbox();
  const dir = `${ROOT}/jobs/${id}-level`;
  try {
    await bash(sandbox, 'rm -rf "$1" && mkdir -p "$1"', [dir]);
    await sandbox.writeFiles([{ path: `${dir}/in.mp3`, content: mp3 }]);
    const lufs = printed(await (await bash(sandbox, `cd "$1" && ${LOUD} && echo "speech=$(loud in.mp3)"`, [dir])).stdout(), "speech");
    const gain = speechGain(lufs);
    const level = gain !== null && Math.abs(gain) >= 0.5 ? `volume=${gain}dB,alimiter=limit=${MIX_CEILING}:level=false` : null;
    if (!level && !pauses.length) return { mp3, lufs, paused: false };
    // A breath opened between two sentences read in one go, then the level.
    const filter = pauses.length ? ["-filter_complex", pauseFilter(pauses, level), "-map", "[out]"] : ["-af", level!];
    await bash(sandbox, `cd "$1" && ${ROOT}/ffmpeg -loglevel error -y -i in.mp3 "$2" "$3" ${pauses.length ? '"$4" "$5"' : ""} -c:a libmp3lame -b:a 160k out.mp3`, [dir, ...filter]);
    const out = await sandbox.readFileToBuffer({ path: `${dir}/out.mp3` });
    if (!out?.length) throw new Error("leveling produced no file");
    return { mp3: out, lufs, paused: pauses.length > 0 };
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
