// Renders a montage skill locally, as the engine would play it (no API, no sandbox): its composition checked by the
// scene check (apps/render/smoke.mjs) and the whole Reel rendered by Remotion. To write and look at a skill before it
// joins the library (packages/agent/src/skill-library.ts).
//
//   cd apps/render && npx remotion bundle src/index.ts --out-dir build        (once, and after a change in apps/render/src)
//   node scripts/skill-render.mts --skill decode --clips a.mp4,b.mp4,c.mp4 \
//     [--module packages/agent/src/skills/<key>.ts]   (a skill not in the library yet: its module, exporting it)
//     --words '{"surtitre":"un samedi dans","titre":"le marais"}' [--end '{"title":"…","subtitle":"…"}'] \
//     [--shots 10] [--bpm 90] [--fonts "Open Sans,Inter"] [--name "Café des Arts"] [--out reel.mp4] [--no-render]
//
// --bpm plays it at another tempo than its own (a longer Reel, a music's tempo), as skillFit would.
// Clips are local files (videos or photos); they are normalized at 30 images a second into the bundle's public folder,
// once per file (named after its path, size and date: another file at the same place in the list is normalized anew),
// as the render workshop does. The browser is Playwright's Chromium (CHROME, default /opt/pw-browsers/…), whose fonts
// load through the machine's own certificates.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildReelProps } from "../packages/agent/src/motion.ts";
import { HOUSE_MODELS } from "../packages/agent/src/house-models.ts";
import { MONTAGE_SKILLS } from "../packages/agent/src/skill-library.ts";
import { skillLongest, skillPlan, skillShotCount, type MontageSkill, type SkillFile, type SkillFill } from "../packages/agent/src/skills.ts";

const { values } = parseArgs({
  options: {
    skill: { type: "string" },
    module: { type: "string" },
    clips: { type: "string" },
    words: { type: "string", default: "{}" },
    end: { type: "string" },
    shots: { type: "string" },
    bpm: { type: "string" },
    fonts: { type: "string", default: "" },
    name: { type: "string", default: "Studio Test" },
    out: { type: "string" },
    "no-render": { type: "boolean", default: false },
  },
});
// A skill of the library, or one being written (its module exports it, under any name).
const loaded = values.module ? (Object.values(await import(resolve(values.module))) as MontageSkill[]).find((x) => x && typeof x === "object" && "timeline" in x) : undefined;
const skill = loaded ?? MONTAGE_SKILLS[values.skill ?? ""];
if (!skill) throw new Error(`--skill: one of ${Object.keys(MONTAGE_SKILLS).join(", ")}, or --module <its file>`);
const model = HOUSE_MODELS.find((m) => m.key === skill.key);
const ROOT = resolve(import.meta.dirname, "..");
const RENDER = `${ROOT}/apps/render`;
if (!existsSync(`${RENDER}/build`)) throw new Error("apps/render/build is missing: bundle it first (see the top of this file)");
const CHROME = process.env.CHROME ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const job = `skill-${skill.key}`;
const media = `${RENDER}/build/public/jobs/${job}`;
mkdirSync(media, { recursive: true });

// Her files: each normalized once (30 i/s, its last image held 2 s, like NORMALIZE), measured with ffprobe.
const PHOTO = /\.(jpe?g|png|webp)$/i;
const probe = (path: string) => {
  const [w, h, d] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0:s=,", path], { encoding: "utf8" })
    .split(/[\n,]/)
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
  return { width: w ?? 1080, height: h ?? 1920, seconds: d ?? 0 };
};
const files: (SkillFile & { src: string; aspect: number })[] = (values.clips ?? "").split(",").filter(Boolean).map((path, i) => {
  const source = resolve(path);
  const photo = PHOTO.test(source);
  const id = `f${i}`;
  const { size, mtimeMs } = statSync(source);
  const stamp = createHash("sha1").update(`${source}:${size}:${mtimeMs}`).digest("hex").slice(0, 10);
  const target = `${media}/${id}-${stamp}${photo ? extname(source) : ".mp4"}`;
  if (!existsSync(target)) {
    if (photo) execFileSync("cp", [source, target]);
    else
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", source, "-an", "-vf", "scale='if(gt(iw,ih),min(iw,2560),-2)':'if(gt(iw,ih),-2,min(ih,2560))',fps=30,tpad=stop_mode=clone:stop_duration=2,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart", target]);
  }
  const p = probe(source);
  return { id, photo, seconds: photo ? 0 : Math.max(0, p.seconds), shows: basename(source), src: `/public/jobs/${job}/${basename(target)}`, aspect: p.width / Math.max(1, p.height) };
});
if (!files.length) throw new Error("--clips: at least one file");

// A fill made by hand, as the filler would: her files in turn, a video's later moments when it comes back.
const n = values.shots ? Math.max(skill.shots[0], Math.min(skillLongest(skill), Number(values.shots))) : skillShotCount(skill, files);
const seen = new Map<string, number>();
const fill: SkillFill = {
  shots: Array.from({ length: n }, (_, i) => {
    const f = files[i % files.length]!;
    const k = seen.get(f.id) ?? 0;
    seen.set(f.id, k + 1);
    return { file: f.id, at: f.photo ? 0 : Math.max(0, (f.seconds * k) / 3) };
  }),
  texts: JSON.parse(values.words ?? "{}"),
  end: values.end ? JSON.parse(values.end) : null,
};
const bpm = values.bpm ? Math.round(Math.min(140, Math.max(60, Number(values.bpm)))) : undefined;
const plan = skillPlan({ skill, name: model?.name ?? skill.key, files, fill, ...(bpm ? { bpm } : {}) });
const fonts = (values.fonts || "").split(",").map((f) => f.trim()).filter(Boolean);
const props = buildReelProps(plan, {
  template: "libre",
  clipUrls: Object.fromEntries(files.map((f) => [f.id, f.src])),
  photoIds: files.filter((f) => f.photo).map((f) => f.id),
  aspects: Object.fromEntries(files.map((f) => [f.id, f.aspect])),
  brand: { name: values.name ?? "", ...(fonts.length ? { fonts } : {}) },
});
const out = resolve(values.out ?? `${ROOT}/${skill.key}.mp4`);
writeFileSync(`${out}.plan.json`, JSON.stringify(plan, null, 1));
writeFileSync(`${out}.props.json`, JSON.stringify(props));
console.log(`${skill.key} v${skill.version}: ${n} shots, ${plan.duration} s at ${plan.tempo ?? skill.bpm} BPM, texts ${plan.texts.map((t) => `« ${t.text} » ${t.from}–${t.to} s`).join(", ")}`);

// The scene check, as the engine runs it on a composition (its marks as its slot texts).
const layer = props.layers?.find((l) => l.compose);
if (!layer) throw new Error("no composition in the props");
writeFileSync(
  `${out}.scenes.json`,
  JSON.stringify([
    {
      id: "skill",
      js: layer.js,
      durationInFrames: layer.durationInFrames,
      texts: layer.texts,
      brand: props.brand,
      cuts: layer.cuts,
      shots: layer.shots,
      ...(layer.fonts?.length ? { fonts: layer.fonts } : {}),
      ...(layer.reelTexts?.length ? { reelTexts: layer.reelTexts } : {}),
      ...(layer.end ? { end: layer.end } : {}),
    },
  ]),
);
// A crash of the check (« Target closed ») still prints what it said before it, and the Reel is rendered anyway.
let check = "";
try {
  check = execFileSync("node", ["smoke.mjs", `${out}.scenes.json`, "./build"], { cwd: RENDER, env: { ...process.env, BROWSER_EXECUTABLE: CHROME }, encoding: "utf8" });
} catch (error) {
  const failed = error as { stdout?: string; stderr?: string; status?: number | null };
  check = failed.stdout ?? "";
  console.log(`scene check crashed (exit ${failed.status ?? "?"}):`, (failed.stderr ?? "").trim().split("\n").slice(-3).join(" | "));
}
const verdict = check.trim().split("\n").at(-1) ?? "";
console.log("scene check:", verdict || "(nothing)");
// A refusal (or no verdict at all) ends the run with code 2, the Reel still rendered: « ok » from a batch meant nothing.
const refused = (() => {
  try {
    const results = (JSON.parse(verdict) as { results?: Record<string, unknown> }).results ?? {};
    return Object.values(results).some((r) => r !== null);
  } catch {
    return true;
  }
})();
if (refused) {
  console.log("SCENE CHECK REFUSED: read its notes above");
  process.exitCode = 2;
}

if (!values["no-render"]) {
  execFileSync(
    "npx",
    ["remotion", "render", "build", "Reel", out, `--props=${out}.props.json`, `--browser-executable=${CHROME}`, "--chrome-mode=chrome-for-testing", `--concurrency=${process.env.CONCURRENCY ?? 4}`, "--codec=h264", "--crf=18", "--log=error"],
    { cwd: RENDER, stdio: "inherit" },
  );
  console.log("rendered:", out);
}
