// The light and the colour of each shot of a Reel, read in the render workshop on her files as they were prepared for
// the render, just before it (packages/agent/src/shot-tone.ts: the engine brings every shot to the same light from it).
// No model: ffmpeg gives a few small images of the passage, cropped as the Reel shows it, and this reads their pixels.
//
//   FFMPEG=/path/to/ffmpeg node tone_read.mjs jobs.json
//   jobs.json: [{ "id": "3", "file": "/…/m0.mp4", "from": 1.2, "to": 3.4, "crop": [x, y, w, h], "still": false }]
//   prints one JSON line: { "<id>": { "mean", "low", "high", "burnt", "rgb" } | null }
//
// mean: its mean light (Rec. 709 luma of its sRGB values, 0 black to 1 white, as LightUnder reads it); low and high: the
// mean of its darkest and of its brightest tenth; burnt: the share of it burnt white; rgb: the mean colour of its parts
// that should be neutral (what is not too dark, not burnt, not strongly coloured, and the brightest fifth of it: a
// white shirt, a lit wall; the cast both agree on), its colour cast, null when too little of the picture is (a field of flowers, a red wall): no cast is guessed from colours on purpose.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The side of the small images read (the passage's crop squeezed into it: the statistics do not care for its shape). */
export const TONE_SIZE = 64;
/** Images read over a passage (one for a photo). */
export const TONE_FRAMES = 6;
/** Under this share of neutral parts, no colour cast is read. */
const NEUTRAL_SHARE = 0.04;

/** The brightest share of the neutral parts that reads the cast. */
const WHITE_SHARE = 0.2;

const round = (v) => Math.round(v * 1000) / 1000;
const lumaAt = (rgb, i) => 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];

/** The tone of a few images, from their pixels (RGB, 8 bits each, one after the other). */
export function toneOfPixels(rgb) {
  const n = Math.floor(rgb.length / 3);
  if (!n) return null;
  const luma = new Float32Array(n);
  let sum = 0;
  let burnt = 0;
  // The parts that could be neutral, by their light: the brightest of them read the cast (a white shirt, a lit wall),
  // a coloured backdrop or a tinted wall weighing less than they would in an average of everything grey-ish.
  const neutral = [];
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3] / 255;
    const g = rgb[i * 3 + 1] / 255;
    const b = rgb[i * 3 + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = y;
    sum += y;
    if (y > 0.97) burnt++;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // A surface that should be neutral: lit, not burnt, not strongly coloured (a warm cast leaves a white wall at about 0.3).
    if (y >= 0.12 && y <= 0.92 && max > 0 && (max - min) / max < 0.45) neutral.push(i);
  }
  luma.sort();
  const tenth = Math.max(1, Math.floor(n / 10));
  let low = 0;
  let high = 0;
  for (let i = 0; i < tenth; i++) {
    low += luma[i];
    high += luma[n - 1 - i];
  }
  // Two readings of the cast must agree: all the parts that could be neutral (a grey-world average) and the brightest
  // fifth of them (a white shirt, a lit wall). A pastel object alone (yellow trousers, a mint backdrop) pulls only one of
  // them: per channel, the reading nearer neutral is kept, nothing when they disagree on its sense.
  let rgbMean = null;
  if (neutral.length >= NEUTRAL_SHARE * n) {
    const meanOf = (list) => {
      let nr = 0;
      let ng = 0;
      let nb = 0;
      for (const i of list) {
        nr += rgb[i * 3];
        ng += rgb[i * 3 + 1];
        nb += rgb[i * 3 + 2];
      }
      return [nr / list.length / 255, ng / list.length / 255, nb / list.length / 255];
    };
    const all = meanOf(neutral);
    neutral.sort((a, b) => lumaAt(rgb, b) - lumaAt(rgb, a));
    const white = meanOf(neutral.slice(0, Math.max(1, Math.round(neutral.length * WHITE_SHARE))));
    const agreed = (c) => {
      const a = Math.log(Math.max(1e-3, all[c]) / Math.max(1e-3, all[1]));
      const w = Math.log(Math.max(1e-3, white[c]) / Math.max(1e-3, white[1]));
      return Math.sign(a) === Math.sign(w) ? Math.sign(a) * Math.min(Math.abs(a), Math.abs(w)) : 0;
    };
    const g = white[1];
    rgbMean = [round(Math.min(1, g * Math.exp(agreed(0)))), round(g), round(Math.min(1, g * Math.exp(agreed(2))))];
  }
  return {
    mean: round(sum / n),
    low: round(low / tenth),
    high: round(high / tenth),
    burnt: round(burnt / n),
    rgb: rgbMean,
  };
}

const num = (v, d = 3) => Number(v).toFixed(d);

/** The ffmpeg arguments that give the small images of a passage, cropped as the Reel shows it. */
export function toneArgs(job) {
  const [x, y, w, h] = job.crop ?? [0, 0, 1, 1];
  const crop = `crop=iw*${num(w, 4)}:ih*${num(h, 4)}:iw*${num(x, 4)}:ih*${num(y, 4)}`;
  if (job.still) return ["-v", "error", "-i", job.file, "-vf", `${crop},scale=${TONE_SIZE}:${TONE_SIZE}:flags=area,format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "-"];
  const seconds = Math.max(0.1, job.to - job.from);
  const rate = Math.min(30, TONE_FRAMES / seconds);
  return [
    "-v", "error",
    "-ss", num(Math.max(0, job.from)),
    "-t", num(seconds),
    "-i", job.file,
    "-an",
    "-vf", `fps=${num(rate, 4)},${crop},scale=${TONE_SIZE}:${TONE_SIZE}:flags=area,format=rgb24`,
    "-frames:v", String(TONE_FRAMES),
    "-f", "rawvideo", "-",
  ];
}

function readJob(job, ffmpeg) {
  return new Promise((resolve) => {
    const child = spawn(ffmpeg, toneArgs(job), { stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];
    child.stdout.on("data", (c) => chunks.push(c));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      const pixels = Buffer.concat(chunks);
      resolve(code === 0 && pixels.length >= TONE_SIZE * TONE_SIZE * 3 ? toneOfPixels(pixels) : null);
    });
  });
}

/** Every job's tone (null when its file could not be read), three at a time. */
export async function readTones(jobs, ffmpeg = process.env.FFMPEG ?? "ffmpeg") {
  const out = {};
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      out[job.id] = await readJob(job, ffmpeg).catch(() => null);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
  console.log(JSON.stringify(await readTones(Array.isArray(jobs) ? jobs : [])));
}
