// Cut-outs for the collages, run in the render sandbox (never in the web app): the
// subject of each photo cut out pixel-exact by an open model (BiRefNet lite, MIT,
// rembg's ONNX export) on the CPU, never redrawn. The model and onnxruntime-node are
// installed apart from Remotion, in CUTOUT_HOME; ffmpeg (FFMPEG) reads and writes images.
// Usage: node cutout.mjs jobs.json → prints {"<id>": { file, w, h, coverage, parts, box, touches, unsure } | { error }}.
// jobs.json: [{ id, src (a local image), out (the file to write, without extension: a WebP with
// transparency, about 20 times lighter than a PNG, else a PNG) }].
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const HOME = process.env.CUTOUT_HOME;
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const ort = createRequire(`${HOME}/package.json`)("onnxruntime-node");

/** The model's input: a 1024 × 1024 picture. */
const S = 1024;
/** The cut-out's longest side: enough for a sticker on a 1080 × 1920 Reel. */
const MAX_SIDE = 1440;
/** A part of the subject smaller than this share of the largest is a speck, dropped. */
const SPECK = 0.1;
/** How far (px at 1024) the model's soft edge is kept around the subject. */
const EDGE = 6;

function size(file) {
  const m = /, (\d{2,5})x(\d{2,5})/.exec(spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" }).stderr);
  if (!m) throw new Error("image illisible");
  return { w: Number(m[1]), h: Number(m[2]) };
}

/** Connected parts (4 neighbours) of a binary mask: each pixel's part and each part's area. */
function parts(bin) {
  const labels = new Int32Array(S * S).fill(-1);
  const areas = [];
  const stack = new Int32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    if (!bin[i] || labels[i] >= 0) continue;
    const id = areas.length;
    let top = 0;
    let area = 0;
    stack[top++] = i;
    labels[i] = id;
    while (top) {
      const p = stack[--top];
      area++;
      const x = p % S;
      const y = (p / S) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < S - 1 ? p + 1 : -1, y > 0 ? p - S : -1, y < S - 1 ? p + S : -1]) {
        if (q >= 0 && bin[q] && labels[q] < 0) {
          labels[q] = id;
          stack[top++] = q;
        }
      }
    }
    areas.push(area);
  }
  return { labels, areas };
}

async function cut(session, job) {
  const { w, h } = size(job.src);
  const raw = spawnSync(FFMPEG, ["-v", "error", "-i", job.src, "-vf", `scale=${S}:${S}:flags=lanczos`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 64 << 20 }).stdout;
  if (!raw || raw.length !== S * S * 3) throw new Error("image illisible");
  // BiRefNet's normalisation (ImageNet's), on the picture scaled to its brightest pixel, like rembg.
  let max = 1;
  for (const v of raw) if (v > max) max = v;
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const data = new Float32Array(3 * S * S);
  for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) data[c * S * S + i] = (raw[i * 3 + c] / max - mean[c]) / std[c];
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", data, [1, 3, S, S]) }, [session.outputNames[0]]);
  const logits = out[session.outputNames[0]].data;
  const prob = new Float32Array(S * S);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < S * S; i++) {
    const v = 1 / (1 + Math.exp(-logits[i]));
    prob[i] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  for (let i = 0; i < S * S; i++) prob[i] = (prob[i] - lo) / (hi - lo || 1);

  // The subject's parts, specks dropped; the soft edge kept only around what stays.
  const bin = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) bin[i] = prob[i] > 0.5 ? 1 : 0;
  const { labels, areas } = parts(bin);
  const largest = Math.max(0, ...areas);
  const keep = new Set(areas.flatMap((a, id) => (a >= largest * SPECK ? [id] : [])));
  const kept = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) if (labels[i] >= 0 && keep.has(labels[i])) kept[i] = 1;
  const near = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!kept[y * S + x]) continue;
      const inside = x > EDGE && x < S - EDGE && y > EDGE && y < S - EDGE && kept[y * S + x - EDGE] && kept[y * S + x + EDGE] && kept[(y - EDGE) * S + x] && kept[(y + EDGE) * S + x];
      if (inside) {
        near[y * S + x] = 1;
        continue;
      }
      for (let dy = -EDGE; dy <= EDGE; dy++) {
        for (let dx = -EDGE; dx <= EDGE; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < S && yy >= 0 && yy < S) near[yy * S + xx] = 1;
        }
      }
    }
  }
  const mask = Buffer.alloc(S * S);
  let on = 0;
  let unsure = 0;
  let x0 = S;
  let y0 = S;
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < S * S; i++) {
    const v = near[i] ? prob[i] : 0;
    mask[i] = Math.round(v * 255);
    if (v > 0.5) {
      on++;
      const x = i % S;
      const y = (i / S) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (v > 0.1 && v < 0.9) unsure++;
  }
  if (!on) throw new Error("aucun sujet trouvé");
  // How much of each edge of the photo the subject runs into (a bust runs into the bottom).
  const edge = (at) => {
    let n = 0;
    for (let k = 0; k < S; k++) if (mask[at(k)] > 127) n++;
    return Math.round((n / S) * 100) / 100;
  };
  const touches = { top: edge((k) => k), bottom: edge((k) => (S - 1) * S + k), left: edge((k) => k * S), right: edge((k) => k * S + S - 1) };

  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const W = Math.max(2, Math.round((w * scale) / 2) * 2);
  const H = Math.max(2, Math.round((h * scale) / 2) * 2);
  const write = (file, codec) =>
    spawnSync(
      FFMPEG,
      [
        "-v", "error", "-y", "-i", job.src, "-f", "rawvideo", "-pix_fmt", "gray", "-s", `${S}x${S}`, "-i", "pipe:0",
        "-filter_complex", `[0:v]scale=${W}:${H}:flags=lanczos[c];[1:v]scale=${W}:${H}:flags=bicubic[a];[c][a]alphamerge,format=rgba`,
        "-frames:v", "1", ...codec, file,
      ],
      { input: mask, maxBuffer: 16 << 20 },
    );
  let file = `${job.out}.webp`;
  let written = write(file, ["-c:v", "libwebp", "-quality", "90", "-pix_fmt", "yuva420p"]);
  if (written.status !== 0) {
    file = `${job.out}.png`;
    written = write(file, ["-compression_level", "9"]);
  }
  if (written.status !== 0) throw new Error(`image : ${String(written.stderr).slice(0, 200)}`);
  const r = (n) => Math.round(n * 1000) / 1000;
  return {
    file,
    w: W,
    h: H,
    coverage: r(on / (S * S)),
    parts: keep.size,
    box: { x: r(x0 / S), y: r(y0 / S), w: r((x1 - x0 + 1) / S), h: r((y1 - y0 + 1) / S) },
    touches,
    unsure: r(unsure / on),
  };
}

const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const results = {};
const session = await ort.InferenceSession.create(`${HOME}/model.onnx`, { intraOpNumThreads: 4, graphOptimizationLevel: "all" });
for (const job of jobs) {
  try {
    results[job.id] = await cut(session, job);
  } catch (error) {
    results[job.id] = { error: String(error instanceof Error ? error.message : error).slice(0, 300) };
  }
}
console.log(JSON.stringify(results));
