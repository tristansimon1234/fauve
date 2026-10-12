import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { RENDER_FONTS } from "@fauve/agent";

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
        bash(sandbox, 'curl -fsSL --retry 2 -o "$1/$2" "$3"', [dir, file, url]),
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
