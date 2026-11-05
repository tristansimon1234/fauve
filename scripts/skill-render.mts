// Renders a montage skill locally, as the engine would play it (no API, no sandbox): its composition checked by the
// scene check (apps/render/smoke.mjs) and the whole Reel rendered by Remotion. To write and look at a skill before it
// joins the library (packages/agent/src/skill-library.ts).
//
//   cd apps/render && npx remotion bundle src/index.ts --out-dir build        (once, and after a change in apps/render/src)
//   node scripts/skill-render.mts --skill decode --clips a.mp4,b.mp4,c.mp4 \
//     [--module packages/agent/src/skills/<key>.ts]   (a skill not in the library yet: its module, exporting it)
//     --words '{"surtitre":"un samedi dans","titre":"le marais"}' [--end '{"title":"…","subtitle":"…"}'] \
//     [--shots 10] [--bpm 90] [--settings '{"cases":"6x8"}'] [--fonts "Open Sans,Inter"] [--name "Café des Arts"] [--accent "#b5543a"] [--out reel.mp4] [--no-render]
//     [--named '{"lumieres":"shop sign"}'] [--objects '{"1":{"src":"sign.webm","result":"result.json","id":"sign"}}']
//     [--cast '[[0,15.4],[0,16.6],[1,1]]']
//     [--dressed] [--no-finish]
//     [--subjects '{"0":{"src":"her.png","result":"result.json","id":"her"}}']
//
// Its model's finish is laid as production lays it (dressSkillPlan, as designSkill does): the model's look over the
// whole Reel without what its code does itself (MontageSkill.finish), its lettering (its pairing, over --fonts), and its
// light on each shot (the signature's grade); --dressed plays it as a model Edith picked, dressed in her charter (the
// --fonts set it), --no-finish shows it bare.
// --bpm plays it at another tempo than its own (a longer Reel, a music's tempo), as skillFit would.
// --cast casts her files by hand as the filler would follow its slots (each shot: its file's place in --clips and where
// it starts, s), for a skill whose shots want the same video in a row (« Recette cosy »: a step's next gesture); it
// sets the number of shots.
// --named names its objects as the filler would (its « @slot » in its code); --objects lays the cut-outs the card made of
// them (apps/render/track_objects.py, run with OBJECTS_CPU=1), by shot: its file (webm, or png for one read on a still, left out when its code only
// reads where it is) and its reading in that run's printed result (its boxes, outline and pieces), on that shot's
// passage of the plan; a list for several objects on one shot, each with its `name` (else the shot's objects in order).
// --subjects lays her own cut-out on a shot, as the engine gets it for Subject and SubjectBox: on a photo, a PNG the
// photo's size and its box (a photo's cut-out, sceneCutouts), on a video, a WebM of the passage and its boxes image by
// image (media_assets.subjects); made locally by track_objects.py on her (« woman », with `photo` for a photo).
// The shots its code sets a text in the clear area of (ClearBox) are read here as the engine reads them
// (apps/render/clear_area.py, by PYTHON: a Python with OpenCV and numpy, `python3` by default); without it, the fallback.
// Clips are local files (videos or photos); her videos are prepared exactly as the render workshop prepares them
// (packages/agent/src/prepare.ts: 2560 px at most, 30 images a second, a key image every second, her sound kept, an HDR
// video tone-mapped, the file as it came when ffmpeg cannot read it), each one once per file and recipe (named after its
// path, size, date and the recipe: another file at the same place, or a new recipe, is prepared anew) into the bundle's
// public folder, in jobs/prepared, shared by every skill. A Reel slow or stalled in the workshop is slow or stalled here
// too. The browser is Playwright's Chromium (CHROME, default /opt/pw-browsers/…), whose fonts load through the machine's
// own certificates.
//
// A skill timed on her voice (its `voice`): her talking video is the first clip, its words given as Scribe times them
// (--talk: a JSON file or text, { "words": [{ "w", "start", "end" }], "pauses": [{ "start", "end" }], "fillers": [...] },
// seconds of that clip), and what its filler chose in them as the filler writes it (--said: { "hook": { from, to, text },
// "ideas": [{ from, to, key, text, font, items: [{ word, text, font }] }] }, word numbers). Her other clips are her other
// angles of the same take: --takes '{"f1": 1.25}' gives each one's offset (s: its time = the first's + offset), or
// --takes sync measures them on their sound as the sandbox does (ffmpeg decodes them, takeOffset correlates them). Her
// sound is kept in the render, and the engine's subtitles of what she says are drawn. Her other clips that are not her
// takes (her photos, her videos of what she names) are what a skill that lays her images on what she says casts (--said:
// an idea's « files » and a name's « file », by their ids f1, f2…), and --said's « name » marks her business's name.
// --tracks '{"0": "her-tracks.json"}' gives a clip's tracks (track.py's file: her face, hands and body at every image),
// as the render gets them for track(frame) and for framing her face.
// What its code reads on her shots besides their clear areas (LightUnder, VanishingPoint, SkylineAt: shot_read.py, by
// PYTHON) is read here too, on her own files, as the engine reads it (never a ground: Skyline draws nothing here).
//
// An effect of the bank (packages/agent/src/pieces.ts, piece-library.ts) is rendered the same way, laid over a span of a
// plain montage of her clips, as the editor lays it: --piece <key> [--module packages/agent/src/pieces/<key>.ts]
// --span 0,4.2 (seconds of the Reel) [--cast '[[0,1.5,2.4],[1,0,0.6]]' (each shot: its file's place in --clips, where it
// starts, how long it lasts; else each clip a shot of --each seconds, 1.2 by default)] [--bpm 100] --words '{…}' (its
// slots) --named '{…}' (its objects) [--settings '{…}']; its check is the layer's, as the engine runs it on an animation.
// An effect that lays her photos takes them by --photos f2,f3 (their ids, in --clips' order, f0 the first file); one timed
// on what she says takes her words in its first clip by --talk (as Scribe times them, seconds of that clip): its code gets
// them as `spoken`, and the engine's subtitles show under it.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildReelProps, readsSpoken } from "../packages/agent/src/motion.ts";
import { HOUSE_MODELS, houseStyle } from "../packages/agent/src/house-models.ts";
import { HDR_MARKS, HDR_TAGS, HDR_TO_SDR, PREPARED_CODEC, preparedFilter } from "../packages/agent/src/prepare.ts";
import { MONTAGE_SKILLS } from "../packages/agent/src/skill-library.ts";
import { EFFECT_PIECES } from "../packages/agent/src/piece-library.ts";
import { pieceTestPlan, type EffectPiece } from "../packages/agent/src/pieces.ts";
import { isClipSegment } from "../packages/agent/src/schemas.ts";
import { followedFrom, signatureOf } from "../packages/agent/src/steal.ts";
import { clearPassages, layerObjects, objectKey, objectPassages, readPassages, shotReadingSchema, subjectKey, subjectShots, type ClearMap, type ShotReading } from "../packages/agent/src/subject.ts";
import { tracksFileSchema, type TracksByClip } from "../packages/agent/src/tracking.ts";
import {
  dressSkillPlan,
  readSaid,
  skillLongest,
  skillPlan,
  skillShotCount,
  skillTalk,
  type MontageSkill,
  type SkillFile,
  type SkillFill,
  type SkillFillAnswer,
  type SkillTalk,
} from "../packages/agent/src/skills.ts";
import { pcmSamples, sameTake, TAKE_MAX_SECONDS, TAKE_RATE, takeOffset, wordsOffset } from "../packages/agent/src/takes.ts";

const { values } = parseArgs({
  options: {
    skill: { type: "string" },
    module: { type: "string" },
    clips: { type: "string" },
    words: { type: "string", default: "{}" },
    end: { type: "string" },
    shots: { type: "string" },
    bpm: { type: "string" },
    settings: { type: "string" },
    named: { type: "string" },
    objects: { type: "string" },
    cast: { type: "string" },
    subjects: { type: "string" },
    fonts: { type: "string", default: "" },
    name: { type: "string", default: "Studio Test" },
    accent: { type: "string" },
    out: { type: "string" },
    "no-render": { type: "boolean", default: false },
    dressed: { type: "boolean", default: false },
    "no-finish": { type: "boolean", default: false },
    talk: { type: "string" },
    said: { type: "string" },
    takes: { type: "string" },
    tracks: { type: "string" },
    piece: { type: "string" },
    span: { type: "string" },
    each: { type: "string" },
    photos: { type: "string" },
  },
});
/** A JSON option given as text or as the path of a file. */
const json = <T,>(value: string | undefined): T | undefined => (value === undefined ? undefined : (JSON.parse(existsSync(value) ? readFileSync(value, "utf8") : value) as T));
// A skill of the library, or one being written (its module exports it, under any name); or an effect of the bank (--piece).
const exported = values.module ? (Object.values(await import(resolve(values.module))) as unknown[]).filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object") : [];
const piece = values.piece ? ((exported.find((x) => "lays" in x && "code" in x) as EffectPiece | undefined) ?? EFFECT_PIECES[values.piece]) : undefined;
if (values.piece && !piece) throw new Error(`--piece: one of ${Object.keys(EFFECT_PIECES).join(", ")}, or --module <its file>`);
const loaded = piece ? undefined : (exported.find((x) => "timeline" in x && "shots" in x && !("lays" in x)) as MontageSkill | undefined);
const skill = piece ? (undefined as unknown as MontageSkill) : (loaded ?? MONTAGE_SKILLS[values.skill ?? ""]);
if (!skill && !piece) throw new Error(`--skill: one of ${Object.keys(MONTAGE_SKILLS).join(", ")}, or --module <its file>`);
const key = piece?.key ?? skill.key;
const model = HOUSE_MODELS.find((m) => m.key === key);
const ROOT = resolve(import.meta.dirname, "..");
const RENDER = `${ROOT}/apps/render`;
if (!existsSync(`${RENDER}/build`)) throw new Error("apps/render/build is missing: bundle it first (see the top of this file)");
const CHROME = process.env.CHROME ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const job = piece ? `piece-${key}` : `skill-${key}`;
const media = `${RENDER}/build/public/jobs/${job}`;
mkdirSync(media, { recursive: true });

// Her files: each video prepared once as the workshop prepares it (NORMALIZE in apps/web/src/lib/render/sandbox.ts), a
// photo copied as it is, measured with ffprobe.
const PHOTO = /\.(jpe?g|png|webp)$/i;
const probe = (path: string) => {
  const [w, h, d] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0:s=,", path], { encoding: "utf8" })
    .split(/[\n,]/)
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
  return { width: w ?? 1080, height: h ?? 1920, seconds: d ?? 0 };
};
const prepared = `${RENDER}/build/public/jobs/prepared`;
mkdirSync(prepared, { recursive: true });
const RECIPE = JSON.stringify([preparedFilter(), PREPARED_CODEC, HDR_TO_SDR, HDR_TAGS]);
/** As NORMALIZE: an HDR video tone-mapped (else as it is, if that fails), the file as it came when ffmpeg cannot read it. */
function prepare(source: string, target: string) {
  const info = spawnSync("ffmpeg", ["-hide_banner", "-i", source], { encoding: "utf8" }).stderr ?? "";
  const encode = (hdr: boolean) =>
    spawnSync(
      "ffmpeg",
      ["-v", "error", "-y", "-i", source, "-map", "0:v:0", "-map", "0:a:0?", "-vf", `${hdr ? `${HDR_TO_SDR},` : ""}${preparedFilter()}`, ...PREPARED_CODEC, ...(hdr ? HDR_TAGS : []), target],
      { stdio: ["ignore", "inherit", "inherit"] },
    ).status === 0;
  if ((new RegExp(HDR_MARKS).test(info) && encode(true)) || encode(false)) return;
  copyFileSync(source, target);
}
const files: (SkillFile & { src: string; aspect: number; path: string })[] = (values.clips ?? "").split(",").filter(Boolean).map((path, i) => {
  const source = resolve(path);
  const photo = PHOTO.test(source);
  const id = `f${i}`;
  const { size, mtimeMs } = statSync(source);
  // Her sound always kept, as the workshop keeps it (a skill on her voice plays it: the Reel is what she says).
  const stamp = createHash("sha1").update(`${source}:${size}:${mtimeMs}${photo ? "" : `:${RECIPE}`}`).digest("hex").slice(0, 16);
  const name = `${stamp}${photo ? extname(source) : ".mp4"}`;
  const target = `${prepared}/${name}`;
  if (!existsSync(target)) {
    // Written aside, then moved in place: another run preparing the same file never reads half of it.
    const aside = `${prepared}/${stamp}.${process.pid}.part${photo ? extname(source) : ".mp4"}`;
    if (photo) copyFileSync(source, aside);
    else prepare(source, aside);
    renameSync(aside, target);
  }
  const p = probe(source);
  return { id, photo, seconds: photo ? 0 : Math.max(0, p.seconds), shows: basename(source), src: `/public/jobs/prepared/${name}`, aspect: p.width / Math.max(1, p.height), path: source };
});
if (!files.length) throw new Error("--clips: at least one file");

// A fill made by hand, as the filler would: her files in turn, a video's later moments when it comes back; or as cast.
const cast = values.cast ? (JSON.parse(values.cast) as [number, number][]) : null;
const n = piece ? 0 : cast ? cast.length : values.shots ? Math.max(skill.shots[0], Math.min(skillLongest(skill), Number(values.shots))) : skillShotCount(skill, files);
const seen = new Map<string, number>();
const fill: SkillFill = {
  shots: Array.from({ length: n }, (_, i) => {
    if (cast) return { file: files[cast[i]![0]]!.id, at: Math.max(0, cast[i]![1]) };
    const f = files[i % files.length]!;
    const k = seen.get(f.id) ?? 0;
    seen.set(f.id, k + 1);
    return { file: f.id, at: f.photo ? 0 : Math.max(0, (f.seconds * k) / 3) };
  }),
  texts: JSON.parse(values.words ?? "{}"),
  end: values.end ? JSON.parse(values.end) : null,
  ...(values.settings ? { settings: JSON.parse(values.settings) as Record<string, string> } : {}),
  ...(values.named ? { objects: JSON.parse(values.named) as Record<string, string> } : {}),
};
const bpm = values.bpm ? Math.round(Math.min(140, Math.max(60, Number(values.bpm)))) : undefined;
// On her voice: her talk cut as the engine cuts it, her other angles synced on their sound, the filler's choice read.
type Timed = { w: string; start: number; end: number };
const spoken: Record<string, Timed[]> = {};
let talk: SkillTalk | undefined;
if (!piece && skill.voice) {
  const given = json<{ words: Timed[]; pauses?: { start: number; end: number }[]; fillers?: Timed[] }>(values.talk);
  if (!given?.words?.length) throw new Error("--talk: her words in her first clip, as Scribe times them (a skill timed on her voice)");
  const main = files[0]!;
  spoken[main.id] = given.words;
  // Her sound as the sandbox decodes it for a sync (s16le, mono, 8 kHz): her other clips measured against the first.
  const pcm = (path: string) => pcmSamples(execFileSync("ffmpeg", ["-v", "error", "-i", path, "-vn", "-map", "0:a:0", "-ac", "1", "-ar", String(TAKE_RATE), "-t", String(TAKE_MAX_SECONDS), "-f", "s16le", "-"], { maxBuffer: 64 << 20 }));
  const offsets: Record<string, number> =
    values.takes === "sync"
      ? Object.fromEntries(
          files.slice(1).flatMap((f) => {
            if (f.photo) return [];
            const found = takeOffset(pcm(main.path), pcm(f.path), TAKE_RATE);
            console.log(`take ${f.id} (${basename(f.path)}): ${found ? `${found.offset} s, score ${found.score}${sameTake(found) ? "" : " (not the same take)"}` : "no sound"}`);
            return found && sameTake(found) ? [[f.id, found.offset]] : [];
          }),
        )
      : (json<Record<string, number>>(values.takes) ?? {});
  const takes = Object.entries(offsets).flatMap(([id, offset]) => {
    const f = files.find((x) => x.id === id);
    if (!f) return [];
    // Its words: hers, on its own clock (for its subtitles).
    spoken[id] = given.words.map((w) => ({ ...w, start: w.start + offset, end: w.end + offset }));
    return [{ clip: id, offset, seconds: f.seconds }];
  });
  talk = skillTalk({ clip: main.id, seconds: main.seconds, words: given.words, speech: { source: "scribe", cleaned: false, floor: null, fillers: given.fillers ?? [], pauses: given.pauses ?? [] } }, { takes }) ?? undefined;
  if (!talk) throw new Error("--talk: fewer than three words in her first clip");
  // Her images of what she names: her clips that are neither her talking video nor one of its takes.
  const refFiles = files.filter((f) => f.id !== main.id && !takes.some((t) => t.clip === f.id)).map((f) => f.id);
  const said = readSaid(skill.voice, talk, json<SkillFillAnswer["voice"]>(values.said), refFiles);
  if (!said) throw new Error("--said: no idea read in what she says (word numbers in her words, after her « euh » are cut)");
  fill.shots = [];
  fill.said = said;
  if (values.takes && values.takes !== "sync") for (const [id] of Object.entries(offsets)) console.log(`take ${id}: ${offsets[id]} s (given)`);
  console.log(`her talk: ${talk.pieces.length} pieces, ${talk.duration} s, ${talk.words.length} words; words of her other angles roughly ${files.slice(1).map((f) => `${f.id} ${wordsOffset(given.words, spoken[f.id] ?? [])?.offset ?? "—"} s`).join(", ") || "none"}`);
}
// The model followed as production follows it (her inspiration row's style: houseStyle), chosen by her, or by Edith (--dressed).
const followed = model && !piece && !values["no-finish"] ? followedFrom("local", houseStyle(model), false, values.dressed) : undefined;
// An effect of the bank: her clips as a plain montage (cast by hand: [file, start, length], else each one a shot of --each
// seconds), the effect laid over --span as the editor lays it, filled as its filler would (--words, --named, --settings).
const laidShots = piece
  ? cast
    ? (cast as unknown as [number, number, number][]).map(([k, at, seconds]) => ({ file: files[k]!.id, at, seconds, photo: files[k]!.photo }))
    : files.map((f) => ({ file: f.id, at: f.photo ? 0 : Math.max(0, Math.min(f.seconds - Number(values.each ?? 1.2), f.seconds / 3)), seconds: Number(values.each ?? 1.2), photo: f.photo }))
  : [];
const span = (values.span ?? "").split(",").map(Number);
// An effect timed on what she says: her words in its first clip (--talk), heard and subtitled as the engine does.
if (piece?.spoken) {
  const given = json<{ words: Timed[] }>(values.talk);
  if (!given?.words?.length) throw new Error("--talk: her words in her first clip, as Scribe times them (an effect timed on her voice)");
  spoken[files[0]!.id] = given.words;
}
const piecePlan = piece
  ? pieceTestPlan({
      piece,
      shots: laidShots,
      span: [Number.isFinite(span[0]) ? span[0]! : 0, Number.isFinite(span[1]) ? span[1]! : laidShots.reduce((t, s) => t + s.seconds, 0)],
      fill: { texts: fill.texts, objects: fill.objects ?? {}, settings: fill.settings ?? {}, ...(values.photos ? { photos: values.photos.split(",").map((x) => x.trim()).filter(Boolean) } : {}) },
      bpm: bpm ?? 100,
    })
  : null;
const plan = piecePlan
  ? { ...piecePlan, ...(piece?.spoken ? { subtitles: true } : {}) }
  : dressSkillPlan(skillPlan({ skill, name: model?.name ?? skill.key, files, fill, ...(bpm ? { bpm } : {}), ...(talk ? { talk } : {}) }), skill, followed);
const fonts = (values.fonts || "").split(",").map((f) => f.trim()).filter(Boolean);
console.log(
  followed
    ? `finish: « ${plan.look?.name ?? "none"} »${plan.look ? ` (grain ${plan.look.grain}, vignette ${plan.look.vignette}, contrast ${plan.look.contrast})` : ""}, light ${followed.look.grade}, lettering ${plan.fonts ? `${plan.fonts.display} / ${plan.fonts.body}` : "her charter's"}`
    : "finish: none (--no-finish, or a model not in the catalogue)",
);
// What the engine would cut out and follow before the render (her cut-out by shot, each object on its passage).
const cut = [...subjectShots(plan)];
const followedObjects = objectPassages(plan, (id) => !files.find((f) => f.id === id)?.photo);
if (cut.length || followedObjects.length) console.log(`cut out: shots ${cut.join(", ") || "none"}; objects: ${followedObjects.map((p) => `« ${p.name} » ${p.clip_id} ${p.from}–${p.to} s`).join(", ") || "none"}`);
// The cut-outs of its objects, laid on their shots' passages as the render workshop gets them (by passage and name).
const subjects: Record<string, { src: string; boxes?: (number[] | null)[]; contours?: (number[] | null)[]; parts?: number[]; pieces?: ((number[] | null)[] | null)[]; clear?: ClearMap; reading?: ShotReading }> = {};
type ObjectRun = { src?: string; result: string; id: string; name?: string };
for (const [shot, given] of Object.entries(JSON.parse(values.objects ?? "{}") as Record<string, ObjectRun | ObjectRun[]>)) {
  const segment = plan.segments.filter(isClipSegment)[Number(shot)];
  // Several objects on one shot (a front's windows and its sign): a list, each its object's name, else the shot's k-th.
  (Array.isArray(given) ? given : [given]).forEach((o, k) => {
    // Named as the engine reads it: Subject or Outline given `object`, or SubjectBox, SubjectOutline, SubjectParts given a
    // name, on the shot its code names or its timeline places it on.
    const layer = plan.layers?.[0];
    const name = o.name ?? (layer ? layerObjects(plan, layer).filter((x) => x.shot === Number(shot))[k]?.name : undefined);
    if (!segment || !name) throw new Error(`--objects: no named object on shot ${shot}`);
    const reading = (JSON.parse(readFileSync(resolve(o.result), "utf8")) as Record<string, { boxes?: (number[] | null)[]; contours?: (number[] | null)[]; parts?: number[]; pieces?: ((number[] | null)[] | null)[] }>)[o.id];
    if (!reading) throw new Error(`--objects: no « ${o.id} » in ${o.result}`);
    // Its cut-out, when its code draws it (Subject object): a reading alone serves SubjectBox, SubjectOutline and SubjectParts.
    let src = "";
    if (o.src) {
      const target = `${media}/object-${shot}-${createHash("sha1").update(`${resolve(o.src)}#${name}`).digest("hex").slice(0, 8)}${extname(o.src) || ".webm"}`;
      execFileSync("cp", [resolve(o.src), target]);
      src = `/public/jobs/${job}/${basename(target)}`;
    }
    subjects[objectKey(segment.clip_id, segment.in, segment.out, name)] = { src, ...(reading.boxes ? { boxes: reading.boxes } : {}), ...(reading.contours ? { contours: reading.contours } : {}), ...(reading.parts ? { parts: reading.parts } : {}), ...(reading.pieces ? { pieces: reading.pieces } : {}) };
    console.log(`object « ${name} » on shot ${shot}: ${reading.parts ? reading.parts.length / 4 : 0} pieces`);
  });
}
// Her own cut-out on a shot (Subject without an object): a photo's, laid exactly over it, or a video passage's.
const sceneCutouts: Record<string, { src: string; box: { x: number; y: number; w: number; h: number }; contour?: number[] }> = {};
for (const [shot, o] of Object.entries(JSON.parse(values.subjects ?? "{}") as Record<string, { src: string; result: string; id: string }>)) {
  const segment = plan.segments.filter(isClipSegment)[Number(shot)];
  if (!segment) throw new Error(`--subjects: no shot ${shot}`);
  const reading = (JSON.parse(readFileSync(resolve(o.result), "utf8")) as Record<string, { boxes?: (number[] | null)[]; contours?: (number[] | null)[] }>)[o.id];
  if (!reading?.boxes?.length) throw new Error(`--subjects: no boxes for « ${o.id} » in ${o.result}`);
  const target = `${media}/subject-${shot}-${createHash("sha1").update(resolve(o.src)).digest("hex").slice(0, 8)}${extname(o.src)}`;
  execFileSync("cp", [resolve(o.src), target]);
  const src = `/public/jobs/${job}/${basename(target)}`;
  if (files.find((f) => f.id === segment.clip_id)?.photo) {
    const [x, y, w, h] = reading.boxes.find(Boolean)!;
    sceneCutouts[segment.clip_id] = { src, box: { x: x!, y: y!, w: w!, h: h! }, ...(reading.contours?.[0]?.length ? { contour: reading.contours[0] } : {}) };
  } else {
    subjects[subjectKey(segment.clip_id, segment.in, segment.out)] = { src, boxes: reading.boxes, ...(reading.contours ? { contours: reading.contours } : {}) };
  }
  console.log(`her cut-out on shot ${shot}: ${reading.boxes.length} box${reading.boxes.length > 1 ? "es" : ""}`);
}
// Where its texts are set in her shots (ClearBox): their clear areas read on her own files, as the engine reads them.
const clears = clearPassages(plan, (id) => !files.find((f) => f.id === id)?.photo);
if (clears.length) {
  const jobs = clears.map((p) => ({ id: p.key, src: files.find((f) => f.id === p.clip_id)!.path, from: p.from, to: p.to, ...(p.photo ? { photo: true } : {}) }));
  writeFileSync(`${media}/clear-jobs.json`, JSON.stringify(jobs));
  try {
    const printed = execFileSync(process.env.PYTHON ?? "python3", ["-I", `${RENDER}/clear_area.py`, `${media}/clear-jobs.json`], { encoding: "utf8" });
    const read = JSON.parse(printed.trim().split("\n").at(-1) ?? "{}") as Record<string, { clear?: ClearMap; error?: string }>;
    for (const p of clears) {
      const r = read[p.key];
      if (r?.clear) subjects[p.key] = { src: "", clear: r.clear };
      console.log(`clear areas of ${p.clip_id} (${p.from}–${p.to} s): ${r?.clear ? `${r.clear.cols} × ${r.clear.rows}, ${r.clear.motion ? "the camera moves" : "still"}` : (r?.error ?? "none")}`);
    }
  } catch (error) {
    console.log("clear areas not read (PYTHON: a Python with OpenCV and numpy):", error instanceof Error ? error.message.split("\n")[0] : error);
  }
}
// What else its code reads on her shots (its light, its vanishing point, its skyline): read on her own files as the
// engine reads them, never a ground (a sky matte video).
const reads = readPassages(plan, (id) => !files.find((f) => f.id === id)?.photo).map((p) => ({ ...p, kinds: p.kinds.map((k) => (k === "ground" ? ("sky" as const) : k)) }));
if (reads.length) {
  const jobs = reads.map((p) => ({ id: p.key, src: files.find((f) => f.id === p.clip_id)!.path, from: p.from, to: p.to, read: [...new Set(p.kinds)], ...(p.photo ? { photo: true } : {}) }));
  writeFileSync(`${media}/read-jobs.json`, JSON.stringify(jobs));
  try {
    const printed = execFileSync(process.env.PYTHON ?? "python3", ["-I", `${RENDER}/shot_read.py`, `${media}/read-jobs.json`], { encoding: "utf8" });
    const read = JSON.parse(printed.trim().split("\n").at(-1) ?? "{}") as Record<string, Record<string, unknown>>;
    for (const p of reads) {
      const r = read[p.key];
      const reading = r && !r.error ? shotReadingSchema.safeParse({ motion: r.motion, sky: r.sky, vanish: r.vanish, light: r.light }).data : undefined;
      if (reading) subjects[p.key] = { ...(subjects[p.key] ?? { src: "" }), reading };
      console.log(`readings of ${p.clip_id} (${p.from}–${p.to} s): ${reading ? `${p.kinds.join(", ")}${reading.light ? `, light ${reading.light.mean} (high ${reading.light.high})` : ""}` : String(r?.error ?? "none")}`);
    }
  } catch (error) {
    console.log("shots not read (PYTHON: a Python with OpenCV and numpy):", error instanceof Error ? error.message.split("\n")[0] : error);
  }
}
// Her tracks by clip (track.py's files), as the render gets them.
const tracks: TracksByClip = Object.fromEntries(
  Object.entries(json<Record<string, string>>(values.tracks) ?? {}).flatMap(([k, path]) => {
    const f = files[Number(k)];
    const parsed = f ? tracksFileSchema.safeParse(JSON.parse(readFileSync(resolve(path), "utf8"))) : null;
    if (f && parsed?.success) console.log(`tracks of ${f.id}: ${parsed.data.frames.length} images`);
    return f && parsed?.success ? [[f.id, parsed.data]] : [];
  }),
);
const props = buildReelProps(plan, {
  template: "libre",
  clipUrls: Object.fromEntries(files.map((f) => [f.id, f.src])),
  photoIds: files.filter((f) => f.photo).map((f) => f.id),
  aspects: Object.fromEntries(files.map((f) => [f.id, f.aspect])),
  // A photo's shape, as the render gets it (without it, a composition takes every photo for an upright 3:4).
  photoAspects: Object.fromEntries(files.filter((f) => f.photo).map((f) => [f.id, f.aspect])),
  // Its light on each shot (the model's grade, over her charter's), as the render's theme takes it in production.
  brand: { name: values.name ?? "", ...(fonts.length ? { fonts } : {}), ...(followed ? { signature: signatureOf({ followed }) } : {}), ...(values.accent ? { accent: values.accent } : {}) },
  ...(Object.keys(subjects).length ? { subjects } : {}),
  ...(Object.keys(sceneCutouts).length ? { sceneCutouts } : {}),
  ...(Object.keys(tracks).length ? { tracks } : {}),
  // Her words in each clip (on her voice): her subtitles, and what its code reads of what she says (`spoken`).
  ...(Object.keys(spoken).length ? { words: spoken } : {}),
});
const out = resolve(values.out ?? `${ROOT}/${key}.mp4`);
writeFileSync(`${out}.plan.json`, JSON.stringify(plan, null, 1));
writeFileSync(`${out}.props.json`, JSON.stringify(props));
console.log(
  piece
    ? `effect ${key} v${piece.version}: over ${plan.layers?.[0]?.from}–${plan.layers?.[0]?.to} s of ${plan.segments.length} shots, ${plan.duration} s at ${plan.tempo} BPM, words ${JSON.stringify(fill.texts)}`
    : `${skill.key} v${skill.version}: ${plan.segments.length} shots, ${plan.duration} s at ${plan.tempo ?? skill.bpm} BPM, texts ${plan.texts.map((t) => `« ${t.text} » ${t.from}–${t.to} s${t.font ? ` (${t.font})` : ""}`).join(", ")}`,
);

// The scene check, as the engine runs it on a composition (its marks as its slot texts), or on an effect's layer.
const layer = piece ? props.layers?.[0] : props.layers?.find((l) => l.compose);
if (!layer) throw new Error(piece ? "no layer in the props (its span under a second, or its code not drawn)" : "no composition in the props");
writeFileSync(
  `${out}.scenes.json`,
  JSON.stringify([
    {
      id: piece ? "piece" : "skill",
      js: layer.js,
      durationInFrames: layer.durationInFrames,
      texts: layer.texts,
      brand: props.brand,
      cuts: layer.cuts,
      shots: layer.shots,
      ...(layer.fonts?.length ? { fonts: layer.fonts } : {}),
      ...(layer.reelTexts?.length ? { reelTexts: layer.reelTexts } : {}),
      ...(layer.end ? { end: layer.end } : {}),
      // Its code reads what is said: checked with words said under it, as the engine checks it.
      ...(readsSpoken(layer.js) ? { probeSpoken: true } : {}),
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
