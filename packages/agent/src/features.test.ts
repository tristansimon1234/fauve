import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, screenTime, segmentSeconds, speedPieces, type ClipSegment, type EditPlan } from "./schemas.ts";
import { asAsked, finishPlan, speedRamp } from "./finish.ts";
import { storyPassage, storyPlan } from "./story.ts";
import { buildReelProps, rampFrames } from "./motion.ts";
import {
  applySpeechCuts,
  CLEAN_FLOOR,
  hasSpeech,
  isFiller,
  jumpCut,
  parseAudioStats,
  parseSilences,
  pauseThreshold,
  speechCleanFilter,
  speechCuts,
  splitFillers,
  spokenShot,
  type SpeechFacts,
  undoSpeechCuts,
  wantsIsolation,
} from "./speech.ts";
import { isolationCostUsd } from "./pricing.ts";
import { mp4Size, needsUpscale, UPSCALE_MAX_WORK, upscaleWork } from "./upscale.ts";
import { mixFilter, mixGains } from "./mix.ts";
import { fromEditorPlan, normalizeEditPlan } from "./editor.ts";
import { depthPhotoIds, reliefFiles, reliefJobs, reliefOf, RELIEF_VERSION } from "./depth.ts";
import { dayIn, LOOK_PRESETS, lookChoice, lookFromDesign, lookMatrix, lookStamp, planLook, reelLookSchema, withLook, type LookDesign } from "./looks.ts";
import { clampLook, filmWords, followedFilter, followedForEditor, followedFrom, followedLine, stolenStyleLines, stolenStyleMessage, type StolenLookReading } from "./steal.ts";
import { houseLines, houseModel, houseModelsForEdith } from "./house-models.ts";
import { editorLook } from "./editor.ts";
import { snapToTempo } from "./tempo.ts";

// ---------------------------------------------------------------------------
// Someone speaking: a clean sound, no « euh », no long silences.
// ---------------------------------------------------------------------------

const word = (w: string, start: number, end: number) => ({ w, start, end });

/** « Bonjour, (euh) aujourd'hui je je vous montre … (long pause) … la coupe. » */
const facts: SpeechFacts = {
  words: [
    word("Bonjour,", 0.6, 1.0),
    word("aujourd'hui", 1.6, 2.1),
    word("je", 2.15, 2.25),
    word("je", 2.45, 2.55),
    word("vous", 2.6, 2.8),
    word("montre", 2.85, 3.2),
    word("la", 4.6, 4.7),
    word("coupe.", 4.75, 5.2),
  ],
  speech: {
    source: "scribe",
    cleaned: true,
    floor: -36,
    fillers: [word("euh", 1.1, 1.45)],
    pauses: [
      { start: 0, end: 0.58 },
      { start: 3.22, end: 4.58 },
      { start: 5.22, end: 7 },
    ],
  },
};

const clip = (over: Partial<ClipSegment> = {}): ClipSegment => ({ clip_id: "talk", in: 0, out: 7, zoom: "none", ...over });

test("speech: hesitations are told apart from words, in French and English", () => {
  for (const w of ["euh", "Euh,", "heu", "euhh", "hum", "Hmm…", "mmh", "uh", "um", "erm"]) assert.equal(isFiller(w), true, w);
  for (const w of ["eux", "heure", "humour", "un", "hein", "bah", "ben", "mmmhm-ok", "été"]) assert.equal(isFiller(w), false, w);
  const split = splitFillers([word("euh", 0, 0.2), word("bonjour", 0.3, 0.6), word("hum", 0.7, 0.9)]);
  assert.deepEqual(split.words.map((w) => w.w), ["bonjour"]);
  assert.deepEqual(split.fillers.map((w) => w.w), ["euh", "hum"]);
});

test("speech: someone speaks when a few words are said", () => {
  assert.equal(hasSpeech({ transcript: "", words: [] }), false);
  assert.equal(hasSpeech({ transcript: "Bonjour à tous", words: undefined }), true);
  assert.equal(hasSpeech({ transcript: "", words: [word("a", 0, 1), word("b", 1, 2), word("c", 2, 3)] }), true);
});

test("speech: the denoiser runs only on a noisy recording, its delay taken back", () => {
  assert.deepEqual(speechCleanFilter(null, "/m.rnnn"), { filter: "highpass=f=70", denoised: false });
  assert.equal(speechCleanFilter(CLEAN_FLOOR - 5, "/m.rnnn").denoised, false);
  const moderate = speechCleanFilter(-45, "/m.rnnn");
  assert.equal(moderate.denoised, true);
  assert.match(moderate.filter, /arnndn=m=\/m\.rnnn:mix=0\.7/);
  const noisy = speechCleanFilter(-31, "/m.rnnn");
  assert.match(noisy.filter, /mix=0\.9/);
  assert.match(noisy.filter, /atrim=start=0\.01,asetpts=PTS-STARTPTS,apad=pad_dur=0\.01$/);
});

test("speech: ffmpeg's measures are read", () => {
  const stats = "[Parsed_astats_1 @ 0x1] RMS level dB: -20.975616\n[Parsed_astats_1 @ 0x1] RMS trough dB: -31.057805\n";
  assert.deepEqual(parseAudioStats(stats), { level: -21, floor: -31.1 });
  assert.deepEqual(parseAudioStats("RMS level dB: -22.1\nRMS trough dB: -inf"), { level: -22.1, floor: null });
  // Cleaned of a hair dryer (measured): the pauses under −30; a quiet room: far under the words.
  assert.equal(pauseThreshold(-22.4, -48), -30);
  assert.equal(pauseThreshold(-22, -65), -35);
  assert.equal(pauseThreshold(-22, null), -40);
  assert.equal(pauseThreshold(null, null), -40);
  assert.equal(pauseThreshold(-10, -12), -26);
  const silences = "[silencedetect @ 0x1] silence_start: 0\n[silencedetect @ 0x1] silence_end: 0.58 | silence_duration: 0.58\n[silencedetect @ 0x1] silence_start: 5.2213\n";
  assert.deepEqual(parseSilences(silences, 7), [
    { start: 0, end: 0.58 },
    { start: 5.22, end: 7 },
  ]);
});

test("speech: the cuts take the silence before the first word, the « euh », the false start and the long pause", () => {
  const cuts = speechCuts(facts, 0, 7);
  // Lead silence (to a breath before « Bonjour »), « euh » (with the silence around it), « je » said twice, the pause, the tail.
  assert.deepEqual(cuts, [
    { start: 0, end: 0.46 },
    { start: 1.07, end: 1.48 },
    { start: 2.15, end: 2.45 },
    { start: 3.34, end: 4.46 },
    { start: 5.4, end: 7 },
  ]);
  // The Reel's last shot holds its ending.
  assert.equal(speechCuts(facts, 0, 7, { tail: false }).at(-1)!.end, 4.46);
  // Words timed by Gemini only: only the measured pauses are cut, never a hesitation.
  const approx = speechCuts({ ...facts, speech: { ...facts.speech, source: "gemini" } }, 0, 7);
  assert.equal(approx.some((c) => c.start > 1 && c.end < 1.6), false);
  assert.equal(approx.some((c) => c.start === 2.15), false);
});

test("speech: « très très » said on purpose is not a false start", () => {
  const emphatic: SpeechFacts = { words: [word("c'est", 0, 0.2), word("très", 0.25, 0.45), word("très", 0.5, 0.7), word("bon", 0.75, 1)], speech: { ...facts.speech, fillers: [], pauses: [] } };
  assert.deepEqual(speechCuts(emphatic, 0, 1), []);
});

test("speech: a passage where someone speaks becomes jump cuts, every other piece punched in", () => {
  const pieces = jumpCut(clip({ accent: "punch" }), facts, { clipDuration: 7 });
  assert.deepEqual(
    pieces.map((p) => [p.in, p.out, p.move ?? "none", p.accent ?? null]),
    [
      [0.46, 1.07, "none", "punch"],
      [1.48, 2.15, "punch", null],
      [2.45, 3.34, "none", null],
      [4.46, 5.4, "punch", null],
    ],
  );
  // Never at another speed, nor without words, nor without facts.
  assert.deepEqual(jumpCut(clip({ speed: 0.5 }), facts), [clip({ speed: 0.5 })]);
  assert.deepEqual(jumpCut(clip(), undefined), [clip()]);
  const silent = clip({ in: 5.5, out: 6.8 });
  assert.equal(jumpCut(silent, facts)[0], silent);
});

test("speech: a passage never starts or ends inside a word", () => {
  const clean: SpeechFacts = { ...facts, speech: { ...facts.speech, fillers: [], pauses: [] } };
  // Starts inside « aujourd'hui », ends inside « montre ».
  const [piece] = jumpCut(clip({ in: 1.8, out: 3.0 }), { ...clean, words: clean.words.filter((w) => w.w !== "je") }, { clipDuration: 7 });
  assert.equal(piece!.in, 1.55);
  assert.equal(piece!.out, 3.3);
});

test("speech: the plan is cut, its texts follow their picture, its cuts are not moved to the beat", () => {
  const plan: EditPlan = editPlanSchema.parse({
    format: "9:16",
    duration: 9,
    template: "libre",
    tempo: 100,
    segments: [clip(), { clip_id: "broll", in: 0, out: 2, zoom: "none" }],
    texts: [
      { text: "le hook", from: 0, to: 2, style: "hook" },
      { text: "sur le b-roll", from: 7.2, to: 8.8, style: "caption" },
    ],
    images: [],
    transitions: "fade",
    subtitles: true,
    music: null,
  });
  const cut = applySpeechCuts(plan, { talk: facts }, { talk: 7, broll: 4 });
  assert.equal(cut.transitions, "cut");
  assert.equal(cut.segments.length, 5);
  const talking = cut.segments.slice(0, 4).reduce((sum, s) => sum + segmentSeconds(s), 0);
  assert.ok(Math.abs(talking - (0.61 + 0.67 + 0.89 + 0.94)) < 0.01);
  // The b-roll's caption moved with the b-roll (it started 0.55 s into it: the old crossfade overlapped 0.35 s).
  const caption = cut.texts.find((t) => t.style === "caption")!;
  assert.ok(Math.abs(caption.from - (talking + 0.55)) < 0.06, `caption at ${caption.from}`);
  // Under a voice over the Reel, nothing changes.
  const voiced = { ...plan, voice: { media_id: "v", at: 0.3 } };
  assert.equal(applySpeechCuts(voiced, { talk: facts }, { talk: 7 }), voiced);
  // The spoken pieces keep their length on the beat grid; the b-roll lands back on a beat.
  const snapped = snapToTempo(cut, { talk: 7, broll: 4 }, (s) => spokenShot(s, { talk: facts }));
  snapped.segments.slice(0, 4).forEach((s, i) => assert.equal(segmentSeconds(s), segmentSeconds(cut.segments[i]!)));
  const end = snapped.segments.reduce((sum, s) => sum + segmentSeconds(s), 0);
  const beat = 60 / 100;
  assert.ok(Math.abs(end / beat - Math.round(end / beat)) < 0.06, `ends at ${end}`);
});

test("speech: normalizeEditPlan cuts the hesitations when it knows the speech", () => {
  const plan: EditPlan = editPlanSchema.parse({
    format: "9:16",
    duration: 7,
    template: "libre",
    segments: [clip()],
    texts: [{ text: "le hook", from: 0, to: 2, style: "hook" }],
    images: [],
    transitions: "cut",
    subtitles: true,
    music: null,
  });
  const without = normalizeEditPlan(plan, { talk: 7 });
  assert.equal(without.segments.length, 1);
  const withSpeech = normalizeEditPlan(plan, { talk: 7 }, 8, { talk: facts });
  assert.equal(withSpeech.segments.length, 4);
  // The Reel's last shot keeps its ending after the last word.
  assert.deepEqual(withSpeech.segments.map((s) => ("clip_id" in s ? [s.in, s.out] : null)), [[0.46, 1.07], [1.48, 2.15], [2.45, 3.34], [4.46, 7]]);
  assert.ok(withSpeech.duration < 5);
});

// ---------------------------------------------------------------------------
// Slow motion: smooth, and ramped on the gesture.
// ---------------------------------------------------------------------------

test("ramp: a shot's passages at each speed, its length and when a moment of the clip shows", () => {
  const plain = { in: 2, out: 3, speed: 0.5 };
  assert.deepEqual(speedPieces(plain), [{ from: 2, to: 3, speed: 0.5 }]);
  assert.equal(segmentSeconds({ clip_id: "a", zoom: "none", ...plain }), 2);
  assert.equal(screenTime(plain, 2.5), 1);
  const ramped = { in: 1, out: 4, speed: 0.5, ramp: { at: 2.5, hold: 0.6, asked: [2, 3] as [number, number] } };
  const pieces = speedPieces(ramped);
  assert.deepEqual(
    pieces.map((p) => [Math.round(p.from * 100) / 100, Math.round(p.to * 100) / 100, p.speed]),
    [
      [1, 2.08, 1],
      [2.08, 2.2, 0.75],
      [2.2, 2.8, 0.5],
      [2.8, 2.92, 0.75],
      [2.92, 4, 1],
    ],
  );
  // 1.08 + 0.16 + 1.2 + 0.16 + 1.08
  assert.ok(Math.abs(segmentSeconds({ clip_id: "a", zoom: "none", ...ramped }) - 3.68) < 0.001);
  assert.ok(Math.abs(screenTime(ramped, 2.5) - (1.08 + 0.16 + 0.6)) < 0.001);
  assert.equal(screenTime(ramped, 0), 0);
});

test("ramp: a slow motion ramps on its gesture in the time the editor gave it, never over another shot of the clip", () => {
  const analysis = {
    duration: 10,
    orientation: "portrait" as const,
    summary: "",
    setting: "",
    lighting: "good" as const,
    shots: [],
    best_moments: [],
    transcript: "",
    issues: [],
    actions: [{ start: 4.2, end: 4.8, what: "elle lance la pâte en l'air" }],
  };
  const slow: ClipSegment = { clip_id: "a", in: 4, out: 5, zoom: "none", speed: 0.5 };
  const ramped = speedRamp(slow, analysis, [], 10);
  assert.ok(ramped.ramp);
  assert.equal(ramped.ramp!.at, 4.5);
  // Its gesture lasts 0.6 s; 0.59 leaves the shot half a second as filmed.
  assert.equal(ramped.ramp!.hold, 0.59);
  assert.deepEqual(ramped.ramp!.asked, [4, 5]);
  // The same time on screen (within a frame of rounding).
  assert.ok(Math.abs(segmentSeconds(ramped) - segmentSeconds(slow)) < 0.034, `${segmentSeconds(ramped)}`);
  assert.ok(ramped.in < 4 && ramped.out > 5);
  // As it was asked, for a correction.
  assert.deepEqual(asAsked(ramped), { ...slow });
  // Another shot shows the passage before and after it: no room, plain slow motion.
  assert.equal(speedRamp(slow, analysis, [{ from: 0, to: 4 }, { from: 5, to: 10 }], 10), slow);
  // Too short a slow motion: nothing to ramp.
  const short: ClipSegment = { clip_id: "a", in: 4.2, out: 4.6, zoom: "none", speed: 0.5 };
  assert.equal(speedRamp(short, analysis, [], 10), short);
  // As filmed: nothing to do.
  const normal: ClipSegment = { clip_id: "a", in: 4, out: 5, zoom: "none" };
  assert.equal(speedRamp(normal, analysis, [], 10), normal);
  // A video of several shots: the run-up stays in the shot filmed (here from 3.9 s), never across its cut.
  const shots = [3.9, 6.5].map((end, k) => ({
    start: k ? 3.9 : 0,
    end,
    description: "",
    subject: "",
    energy: 3,
    hook_score: 3,
    quality: { blurry: false, dark: false, shaky: false },
    faces_visible: false,
  }));
  const inShot = speedRamp(slow, { ...analysis, shots }, [], 10);
  assert.ok(inShot.ramp && inShot.in >= 3.9, `starts at ${inShot.in}`);
  assert.ok(Math.abs(segmentSeconds(inShot) - segmentSeconds(slow)) < 0.034);
  // Its gesture on the cut itself: plain slow motion.
  assert.equal(speedRamp({ ...slow, in: 3.6, out: 4.6 }, { ...analysis, shots: [{ ...shots[0]!, end: 4.4 }, { ...shots[1]!, start: 4.4 }] }, [], 10).ramp, undefined);
});

test("ramp: its passages in frames fill the shot exactly", () => {
  const ramped = { in: 1, out: 4, speed: 0.5, ramp: { at: 2.5, hold: 0.6, asked: [2, 3] as [number, number] } };
  const frames = rampFrames(ramped, 110);
  assert.ok(frames);
  assert.equal(frames!.reduce((sum, p) => sum + p.length, 0), 110);
  assert.deepEqual(frames!.map((p) => p.speed), [1, 0.75, 0.5, 0.75, 1]);
  assert.equal(frames![0]!.startFrom, 30);
  // Each passage starts on the image right after the last one shown before it (never the same image twice).
  frames!.slice(1).forEach((p, k) => assert.equal(p.startFrom, Math.round(frames![k]!.startFrom + frames![k]!.length * frames![k]!.speed)));
  // And ends about where the shot ends in the clip.
  const last = frames!.at(-1)!;
  assert.ok(Math.abs(last.startFrom + last.length * last.speed - 4 * 30) <= 1.5);
  assert.equal(rampFrames({ in: 1, out: 2, speed: 0.5 }, 60), undefined);
});

// ---------------------------------------------------------------------------
// Photos in relief, and looks.
// ---------------------------------------------------------------------------

const photoEdit = { source: { width: 1200, height: 1600 } };

test("depth: the photos that move play in relief, never in a collage nor with blurred faces", () => {
  const plan = {
    template: "libre",
    segments: [
      { clip_id: "p1", in: 0, out: 2, zoom: "none" as const, move: "in" as const, photo: photoEdit },
      { clip_id: "p2", in: 0, out: 2, zoom: "none" as const, move: "none" as const, photo: photoEdit },
      { clip_id: "p3", in: 0, out: 2, zoom: "none" as const, move: "left" as const, photo: { ...photoEdit, blur: [{ x: 0.1, y: 0.1, w: 0.1, h: 0.1, kind: "face" as const, shape: "ellipse" as const }] } },
      { clip_id: "v1", in: 0, out: 2, zoom: "none" as const, move: "in" as const },
    ],
  };
  assert.deepEqual(depthPhotoIds(plan), ["p1"]);
  assert.deepEqual(depthPhotoIds({ ...plan, template: "collage" }), []);
});

test("depth and looks: the render gets the cut-out of a moving photo, the effect and the date it prints", () => {
  const plan: EditPlan = editPlanSchema.parse({
    format: "9:16",
    duration: 4,
    template: "libre",
    segments: [
      { clip_id: "p1", in: 0, out: 2, zoom: "none", move: "in", photo: photoEdit },
      { clip_id: "p2", in: 0, out: 2, zoom: "none", move: "none", photo: photoEdit },
    ],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    effect: "disposable",
  });
  const cut = { src: "https://x/p1.webp", box: { x: 0.3, y: 0.2, w: 0.4, h: 0.7 } };
  const props = buildReelProps(plan, {
    template: "libre",
    clipUrls: { p1: "https://x/p1.jpg", p2: "https://x/p2.jpg" },
    photoIds: ["p1", "p2"],
    brand: { name: "Studio" },
    depth: { p1: cut, p2: cut },
    today: "2026-10-29",
  });
  const [first, second] = props.segments;
  assert.equal(first?.type === "image" && first.depth?.src, cut.src);
  assert.equal(second?.type === "image" && second.depth, undefined);
  // A plan made before names a preset: drawn from its settings, its grade as one matrix.
  assert.equal(props.look?.preset, "disposable");
  assert.equal(props.look?.matrix.length, 20);
  assert.equal(props.stamp, "'26 10 29");
});

test("relief: each moving photo shot gets a key of its own, and the Reel plays its video only for that very shot", () => {
  const plan: EditPlan = editPlanSchema.parse({
    format: "9:16",
    duration: 6,
    template: "libre",
    segments: [
      // A portrait photo of the frame's shape, pushed in: the frame's centre is the photo's.
      { clip_id: "p1", in: 0, out: 3, zoom: "none", move: "in", photo: { source: { width: 1080, height: 1920 } } },
      // A wide photo panned left: the room slides 1.3 % of the frame's width, a share of the much wider photo.
      { clip_id: "p2", in: 0, out: 2, zoom: "none", move: "left", photo: { source: { width: 4000, height: 2000 } } },
      { clip_id: "p3", in: 0, out: 1, zoom: "none", move: "none", photo: photoEdit },
    ],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
  });
  const jobs = reliefJobs(plan);
  assert.deepEqual(
    jobs.map((j) => [j.media_id, j.move, j.frames]),
    [
      ["p1", "in", 90],
      ["p2", "left", 60],
    ],
  );
  assert.deepEqual(jobs[0]?.origin, { x: 0.5, y: 0.5 });
  assert.equal(jobs[0]?.shift, 0);
  // The photo 3840 px wide on screen (1920 high): 1.3 % of 1080 is 0.0037 of it, to the right for a pan left.
  assert.equal(jobs[1]?.shift, 0.0037);
  assert.match(jobs[0]!.key, new RegExp(`-v${RELIEF_VERSION}$`));
  // No relief in a collage, with the relief turned off, nor twice for the same shot.
  assert.deepEqual(reliefJobs({ ...plan, template: "collage" }), []);
  assert.deepEqual(reliefJobs({ ...plan, finish: { relief: "off" } }), []);
  assert.equal(reliefJobs({ ...plan, segments: [plan.segments[0]!, plan.segments[0]!] }).length, 1);
  // A longer shot is another shot: its key changes.
  assert.notEqual(reliefOf(plan.segments[0]!, 120)?.key, jobs[0]?.key);

  const video = { src: "https://x/relief.mp4", frames: 90 };
  const inputs = { template: "libre" as const, clipUrls: { p1: "https://x/p1.jpg", p2: "https://x/p2.jpg", p3: "https://x/p3.jpg" }, photoIds: ["p1", "p2", "p3"], brand: { name: "Studio" } };
  const props = buildReelProps(plan, { ...inputs, reliefs: { [`p1#${jobs[0]!.key}`]: video } });
  const [first, second] = props.segments;
  assert.deepEqual(first?.type === "image" && first.relief, video);
  assert.equal(second?.type === "image" && second.relief, undefined);
  // The segment is exactly as long as the video made for it.
  assert.equal(first?.durationInFrames, video.frames);
  // A video made for a shot of another length is never played.
  const stale = buildReelProps(plan, { ...inputs, reliefs: { [`p1#${jobs[0]!.key}`]: { ...video, frames: 80 } } });
  assert.equal(stale.segments[0]?.type === "image" && stale.segments[0].relief, undefined);
});

test("voice isolation: music heard behind her or a loud room isolates her voice, a quiet room is only denoised", () => {
  assert.equal(wantsIsolation(-45, { music_under_speech: true }), true);
  assert.equal(wantsIsolation(-35, {}), true);
  assert.equal(wantsIsolation(-45, {}), false);
  assert.equal(wantsIsolation(null, { music_under_speech: false }), false);
  // $0.12 a minute of her clip.
  assert.equal(Math.round(isolationCostUsd(30) * 1000) / 1000, 0.06);
});

test("upscale: only what a Reel would show too large, and an MP4's size read from its header, turned when it says so", () => {
  assert.equal(needsUpscale(480, 854), true);
  assert.equal(needsUpscale(1080, 1920), false);
  assert.equal(needsUpscale(720, 1280), false);
  assert.equal(needsUpscale(120, 120), false);
  // The card's time, by its picture's size: the production run (5 s of 1280 × 720 in 18.4 s) is under the estimate,
  // a 30 s 480p video from WhatsApp fits, a minute of it does not (it would hold a montage waiting on its reading).
  assert.ok(upscaleWork(1280, 720, 5.04) > 18.4);
  assert.ok(upscaleWork(854, 480, 30) <= UPSCALE_MAX_WORK);
  assert.ok(upscaleWork(854, 480, 60) > UPSCALE_MAX_WORK);
  /** A minimal MP4: ftyp, then moov › trak › tkhd (version 0) with its matrix and its size. */
  const mp4 = (width: number, height: number, turned: boolean) => {
    const box = (kind: string, body: Uint8Array) => {
      const out = new Uint8Array(8 + body.length);
      new DataView(out.buffer).setUint32(0, out.length);
      out.set([...kind].map((c) => c.charCodeAt(0)), 4);
      out.set(body, 8);
      return out;
    };
    const tkhd = new Uint8Array(84);
    const v = new DataView(tkhd.buffer);
    // version/flags 4, times 8, id 4, reserved 4, duration 4, reserved 8, layer/group/volume/reserved 8: matrix at 40.
    const m = turned ? [0, 0x10000, 0, -0x10000, 0, 0, 0, 0, 0x40000000] : [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];
    m.forEach((x, i) => v.setInt32(40 + i * 4, x));
    v.setUint32(76, width * 65536);
    v.setUint32(80, height * 65536);
    return new Uint8Array([...box("ftyp", new Uint8Array(8)), ...box("moov", box("trak", box("tkhd", tkhd)))]);
  };
  assert.deepEqual(mp4Size(mp4(854, 480, false)), { width: 854, height: 480 });
  assert.deepEqual(mp4Size(mp4(854, 480, true)), { width: 480, height: 854 });
  assert.equal(mp4Size(new Uint8Array(16)), null);
});

test("relief: the videos a photo keeps go with it", () => {
  assert.deepEqual(
    reliefFiles({ a: { path: "s/reliefs/p-1.mp4", frames: 90, w: 1080, h: 1440, at: "2026-11-03T12:00:00Z" }, b: { failed_at: "2026-11-03T12:00:00Z", error: "no card" } }),
    ["s/reliefs/p-1.mp4"],
  );
  assert.deepEqual(reliefFiles(null), []);
  assert.deepEqual(reliefFiles({ broken: 1 }), []);
});

test("looks: the date a look prints, in its camera's format", () => {
  assert.equal(lookStamp(LOOK_PRESETS.disposable, "2026-10-29"), "'26 10 29");
  assert.equal(lookStamp(LOOK_PRESETS.vhs, "2026-02-03"), "3 FÉVR. 2026");
  assert.equal(lookStamp(LOOK_PRESETS.bw, "2026-10-29"), undefined);
  assert.equal(lookStamp(LOOK_PRESETS.disposable, undefined), undefined);
  const stamp = { style: "typed" as const, format: "dd_mm_yyyy" as const, color: "#FFFFFF", corner: "top_left" as const, label: "", clock: false };
  assert.equal(lookStamp({ ...LOOK_PRESETS.bw, stamp }, "2026-10-29"), "29/10/2026");
  // Seven segments draw only digits: a month in letters falls back to its digits.
  assert.equal(lookStamp({ ...LOOK_PRESETS.bw, stamp: { ...stamp, style: "digital", format: "d_mon_yyyy" } }, "2026-10-29"), "'26 10 29");
  assert.equal(lookStamp({ ...LOOK_PRESETS.bw, stamp: { ...stamp, style: "digital" } }, "2026-10-29"), "29 10 2026");
  assert.match(dayIn("Europe/Paris", new Date("2026-10-29T23:30:00Z")), /^2026-10-30$/);
});

/** A colour through a feColorMatrix, as the render applies it (clamped to 0–1). */
const apply = (m: number[], [r, g, b]: [number, number, number]) =>
  [0, 1, 2].map((i) => Math.min(1, Math.max(0, m[i * 5]! * r + m[i * 5 + 1]! * g + m[i * 5 + 2]! * b + m[i * 5 + 4]!)));

test("looks: its grade is one colour matrix, 0 leaving her image as it is", () => {
  const plain = reelLookSchema.parse({ name: "rien" });
  assert.deepEqual(lookMatrix(plain), [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
  // Black and white: every colour comes out grey.
  const [r, g, b] = apply(lookMatrix(LOOK_PRESETS.bw), [0.8, 0.3, 0.2]);
  assert.ok(Math.abs(r! - g!) < 1e-3 && Math.abs(g! - b!) < 1e-3);
  // Warm: a grey turns orange; cool: blue.
  const [wr, , wb] = apply(lookMatrix(reelLookSchema.parse({ name: "chaud", warmth: 1 })), [0.5, 0.5, 0.5]);
  assert.ok(wr! > 0.5 && wb! < 0.5);
  // Faded: the blacks lift, the whites dim.
  const faded = lookMatrix(reelLookSchema.parse({ name: "délavé", fade: 1 }));
  assert.ok(apply(faded, [0, 0, 0])[0]! > 0.1 && apply(faded, [1, 1, 1])[0]! < 0.95);
  // Split toning: a teal in the shadows, an orange in the highlights.
  const split = lookMatrix(reelLookSchema.parse({ name: "ciné", shadows: "#0F6E7A", highlights: "#FF9A50", split: 1 }));
  const [sr, , sb] = apply(split, [0.1, 0.1, 0.1]);
  const [hr, , hb] = apply(split, [0.9, 0.9, 0.9]);
  assert.ok(sb! > sr! && hr! > hb!);
});

test("looks: her words are none, a preset or a look to design; the designer's answer is a look", () => {
  assert.deepEqual(lookChoice("none"), { look: null });
  assert.deepEqual(lookChoice("Sans look"), { look: null });
  assert.deepEqual(lookChoice("vhs"), { look: LOOK_PRESETS.vhs });
  assert.deepEqual(lookChoice("Appareil jetable"), { look: LOOK_PRESETS.disposable });
  assert.deepEqual(lookChoice("pellicule Kodak des années 70"), { design: "pellicule Kodak des années 70" });
  assert.equal(lookChoice("  "), null);
  // The editor names it in « look », an older answer in « effect ».
  assert.deepEqual(editorLook({ look: "bw" }), { look: LOOK_PRESETS.bw });
  assert.deepEqual(editorLook({ effect: "dust" }), { look: LOOK_PRESETS.dust });
  assert.deepEqual(editorLook({ look: "façon Polaroid" }), { design: "façon Polaroid" });
  assert.equal(editorLook({}), null);
  const design: LookDesign = {
    ...LOOK_PRESETS.disposable,
    name: "Polaroid des années 70",
    hint: "couleurs délavées et chaudes",
    shadows: "#0f6e7a",
    highlights: "orange",
    glow_color: "nope",
    leak_color: "#FF7828",
    stamp: { style: "digital", format: "yy_mm_dd", color: "#ff8a1e", corner: "bottom_right", label: "", clock: false },
    note: "",
  };
  const { look, note } = lookFromDesign(design);
  assert.equal(look.name, "Polaroid des années 70");
  assert.equal(look.shadows, "#0F6E7A");
  assert.equal(look.highlights, null);
  assert.equal(look.glow_color, "#FF6A3D");
  assert.equal(look.stamp?.color, "#FF8A1E");
  assert.equal(look.preset, undefined);
  assert.equal(note, "");
});

test("looks: a plan made before keeps its preset, a new one its own settings", () => {
  assert.equal(planLook({ effect: "vhs" }), LOOK_PRESETS.vhs);
  const own = reelLookSchema.parse({ name: "Portra", warmth: 0.3, grain: 0.4 });
  assert.equal(planLook({ look: own, effect: "vhs" }), own);
  assert.equal(planLook({}), null);
  assert.ok(editPlanSchema.safeParse({ ...validPlanBase, look: own }).success);
  // A new look replaces an older plan's preset; none takes both off.
  assert.deepEqual(withLook({ effect: "vhs" as const, duration: 4 }, own), { duration: 4, look: own });
  assert.deepEqual(withLook({ effect: "vhs" as const, look: own, duration: 4 }, null), { duration: 4 });
  assert.equal(editPlanSchema.safeParse({ ...validPlanBase, look: { ...own, warmth: 3 } }).success, false);
});

test("looks: the editor's look is kept when it is one, the copied Reel brings its own", () => {
  const written = {
    duration: 4,
    tempo: 100,
    form: "montage" as const,
    segments: [{ clip_id: "a", in: 0, out: 4, move: "none", speed: 1 }],
    texts: [],
    transitions: "cut" as const,
    subtitles: false,
  };
  assert.equal(fromEditorPlan({ ...written, look: "vhs" }).look, LOOK_PRESETS.vhs);
  assert.equal(fromEditorPlan({ ...written, look: "none" }).look, undefined);
  // Her words for a look are designed after (the editor's plan carries no settings it did not write).
  assert.equal(fromEditorPlan({ ...written, look: "façon Polaroid" }).look, undefined);
  const followed = { look: { effect: "bw" } } as unknown as Parameters<typeof followedFilter>[1];
  assert.deepEqual(followedFilter({}, followed), { look: LOOK_PRESETS.bw });
  assert.deepEqual(followedFilter({ effect: "dust" }, followed), {});
  assert.deepEqual(followedFilter({}, { look: { effect: "grain" } } as unknown as Parameters<typeof followedFilter>[1]), {});
  // Its filter designed from what Gemini saw comes before the preset it named.
  const own = reelLookSchema.parse({ name: "Pellicule délavée", fade: 0.5 });
  assert.deepEqual(followedFilter({}, { look: { effect: "bw" }, filter_look: own } as unknown as Parameters<typeof followedFilter>[1]), { look: own });
  assert.ok(editPlanSchema.safeParse({ ...validPlanBase, effect: "y2k" }).success);
  assert.equal(editPlanSchema.safeParse({ ...validPlanBase, effect: "sepia" }).success, false);
});

test("steal: its filter in words, and what it makes with generative AI, said and never imitated", () => {
  const reading: StolenLookReading = {
    name: "transformation manga",
    format: "autre",
    voice: "aucune",
    hook: { kind: "geste", what: "elle claque des doigts" },
    text: { amount: "une ligne", composition: "une phrase au tiers haut", case: "normal", weight: "bold", tracking: "normal", align: "center", stress: "color", band: "none", subtitles: false, font: "", font_alternatives: [], stroke: "regular", lines: "aligned", tilt: 0, shadow: "soft", sample: "", seen_at: 0 },
    colors: [],
    effect: "none",
    filter: "couleurs délavées et chaudes, grain fort, coins sombres.",
    generative: "la personne est redessinée en personnage de manga image par image.",
    to_film: "",
    moments: [],
    shots: [],
    grade: "warm",
    motion: "energique",
    layout: "plein cadre",
    camera: "à la main",
    transitions: "coupes nettes",
    music: "upbeat j-pop",
    ending: "elle sourit à la caméra.",
    why: "La transformation surprend.",
  };
  const look = clampLook(reading);
  assert.equal(look.filter, "couleurs délavées et chaudes, grain fort, coins sombres.");
  const style = { look, measures: { duration: 9, cuts: [1.2, 4.4], bpm: null, lufs: -14 } };
  const lines = stolenStyleLines(style);
  assert.match(lines[2]!, /couleurs délavées et chaudes/);
  assert.match(lines[3]!, /^Ce que je ne refais pas : la personne est redessinée en personnage de manga image par image : c'est de l'IA qui fabrique ou transforme les images, et moi je monte tes vraies images\. Je reprends tout le reste\.$/);
  const followed = followedFrom("11111111-2222-4333-8444-555555555555", style);
  assert.match(followedForEditor(followed).ia_generative ?? "", /à ne jamais imiter/);
  assert.match(followedLine(followed), /images d'IA générative du Reel recopié, volontairement non refaites/);
  // Without either, nothing is said (an older reading has neither).
  const plain = clampLook({ ...reading, filter: "", generative: "" });
  assert.equal("generative" in plain, false);
  assert.equal(stolenStyleLines({ ...style, look: plain }).length, 3);
  assert.equal(followedForEditor(followedFrom("11111111-2222-4333-8444-555555555555", { ...style, look: plain })).ia_generative, undefined);
});

test("steal: what only she can film for her copy, said as soon as a model is chosen, known to the editor and the critic", () => {
  const reading: StolenLookReading = {
    name: "carte au feutre",
    format: "message",
    voice: "aucune",
    hook: { kind: "mystère", what: "une carte blanche tenue devant le premier plan" },
    text: { amount: "un message tenu", composition: "une phrase au feutre rouge sur une carte", case: "upper", weight: "bold", tracking: "normal", align: "center", stress: "none", band: "none", subtitles: false, font: "", font_alternatives: [], stroke: "thick", lines: "aligned", tilt: 0, shadow: "none", sample: "", seen_at: 0 },
    colors: [],
    effect: "none",
    filter: "",
    generative: "",
    to_film: "ta main qui tient une carte blanche devant tes plans.",
    moments: [],
    shots: [],
    grade: "flash",
    motion: "fait_main",
    layout: "plein cadre, avec une carte tenue au centre",
    camera: "à la main",
    transitions: "coupes nettes",
    music: "upbeat funk soul",
    ending: "la carte avec la phrase entière.",
    why: "La phrase se lit en se construisant.",
  };
  const look = clampLook(reading);
  assert.equal(look.to_film, "ta main qui tient une carte blanche devant tes plans.");
  const style = { look, measures: { duration: 9, cuts: [0.3, 0.6, 0.9], bpm: 92, lufs: -14 } };
  // Said in her lines (Créer shows them), in the message after the reading, to the editor and to the critic.
  assert.ok(stolenStyleLines(style).includes("Il faut que tu me filmes ta main qui tient une carte blanche devant tes plans ; sans ça, je fais au plus proche avec tes images."));
  assert.match(stolenStyleMessage(style, false), /Envoie-moi tes photos et vidéos\. Et il faut que tu me filmes ta main qui tient une carte blanche devant tes plans\.$/);
  assert.match(stolenStyleMessage(style, true), /Ton Reel arrive dans quelques minutes\. Pour qu’il ressemble encore plus au modèle, filme-moi ta main/);
  const followed = followedFrom("11111111-2222-4333-8444-555555555555", style);
  assert.match(followedForEditor(followed).a_filmer ?? "", /^ta main qui tient une carte blanche.*sers-t'en à sa place.*rationale/);
  assert.match(followedLine(followed), /à filmer par elle, son absence n'est jamais un défaut du montage/);
  // Nothing to film: nothing said.
  const plain = clampLook({ ...reading, to_film: "" });
  assert.equal("to_film" in plain, false);
  assert.equal(filmWords(plain), null);
  assert.doesNotMatch(stolenStyleMessage({ ...style, look: plain }, false), /filmes/);
  // One of Edith's models needs something filmed, with what it does without it (« Carte au feutre » v2 draws its
  // notebook itself: nothing of hers to film any more).
  const card = houseModel("carte-feutre")!;
  assert.ok(!houseLines(card).some((l) => /Il faut que tu me filmes/.test(l)));
  const told = houseModelsForEdith().filter((m) => m.a_lui_dire).map((m) => m.key);
  assert.deepEqual(told.sort(), ["nike"]);
});

const validPlanBase = {
  format: "9:16",
  duration: 4,
  template: "libre",
  segments: [{ clip_id: "a", in: 0, out: 4, zoom: "none" }],
  texts: [],
  images: [],
  transitions: "cut",
  subtitles: false,
  music: null,
};

// ---------------------------------------------------------------------------
// Story express.
// ---------------------------------------------------------------------------

test("story express: a photo and a sentence become a 5 s animated story, its detail under its sentence", () => {
  const plan = storyPlan({ mediaId: "p1", photo: true, text: "2 places ce soir", detail: "19 h · cours débutant", look: LOOK_PRESETS.disposable });
  assert.equal(plan.duration, 5);
  assert.deepEqual(plan.segments, [{ clip_id: "p1", in: 0, out: 5, zoom: "none" }]);
  assert.equal(plan.texts[0]!.text, "2 places ce soir");
  assert.equal(plan.texts[0]!.from, 0);
  assert.deepEqual(plan.texts[0]!.items, [{ title: "19 h · cours débutant" }]);
  assert.deepEqual(plan.look, LOOK_PRESETS.disposable);
  // Normalized and finished like a montage: the photo is framed and moves (its one slow push).
  const detection = { regions: [], adjust: { exposure: 0, contrast: 0, saturation: 0, warmth: 0, straighten: 0 }, subject: { x: 500, y: 450 }, notes: "", text_boxes: [] };
  const photoFacts = { p1: { width: 1200, height: 1600, detection } };
  const finished = finishPlan(normalizeEditPlan(plan, { p1: 5 }, 0), { clips: {}, photos: photoFacts }, { p1: 5 });
  const shot = finished.segments[0]!;
  assert.ok("clip_id" in shot && shot.move === "in" && shot.photo);
  assert.equal(depthPhotoIds(finished)[0], "p1");
});

test("story express: a video's story starts on its best moment, inside the clip", () => {
  const analysis = { duration: 12, best_moments: [{ start: 8, end: 10, why: "" }], shots: [] };
  assert.deepEqual(storyPassage(analysis), { in: 5, out: 12 });
  assert.deepEqual(storyPassage({ duration: 4, best_moments: [], shots: [] }), { in: 0, out: 4 });
  const plan = storyPlan({ mediaId: "v1", photo: false, analysis: { duration: 20, best_moments: [{ start: 3, end: 6, why: "" }], shots: [] }, text: "Le plat du jour" });
  assert.deepEqual([plan.segments[0] && "clip_id" in plan.segments[0] ? [plan.segments[0].in, plan.segments[0].out] : null, plan.duration], [[3, 10], 7]);
  assert.equal(plan.texts[0]!.items, undefined);
});

// ---------------------------------------------------------------------------
// Her finishing touches: everything the engine adds by itself, hers to change.
// ---------------------------------------------------------------------------

const talkPlan = (finish?: EditPlan["finish"]): EditPlan =>
  editPlanSchema.parse({
    format: "9:16",
    duration: 9,
    template: "libre",
    tempo: 100,
    segments: [clip({ move: "in" }), { clip_id: "broll", in: 0, out: 2, zoom: "none" }],
    texts: [
      { text: "le hook", from: 0, to: 2, style: "hook" },
      { text: "sur le b-roll", from: 7.2, to: 8.8, style: "caption" },
    ],
    images: [],
    transitions: "cut",
    subtitles: true,
    music: null,
    ...(finish ? { finish } : {}),
  });

test("finish: the « euh » cuts are marked and undone, the passage and its texts back as written", () => {
  const plan = talkPlan();
  const cut = applySpeechCuts(plan, { talk: facts }, { talk: 7, broll: 4 });
  assert.ok(cut.segments.slice(0, 4).every((s) => "clip_id" in s && s.jump?.in === 0 && s.jump.out === 7 && s.jump.move === "in"));
  const back = undoSpeechCuts(cut);
  assert.equal(back.segments.length, 2);
  const [talk] = back.segments;
  assert.ok(talk && "clip_id" in talk);
  assert.deepEqual([talk.in, talk.out, talk.move, talk.jump], [0, 7, "in", undefined]);
  // The b-roll's caption is back on the b-roll (7.2 s in the Reel as written).
  assert.ok(Math.abs(back.texts.find((t) => t.style === "caption")!.from - 7.2) < 0.05);
  // Nothing to undo: the same plan.
  assert.equal(undoSpeechCuts(plan), plan);
  // Her words as she said them: no cut at all.
  assert.equal(applySpeechCuts(talkPlan({ cuts: "off" }), { talk: facts }, { talk: 7, broll: 4 }).segments.length, 2);
  assert.equal(normalizeEditPlan(talkPlan({ cuts: "off" }), { talk: 7, broll: 4 }, 8, { talk: facts }).segments.length, 2);
});

test("finish: plain slow motion when she wants no ramp", () => {
  const analysis = {
    duration: 10,
    orientation: "portrait" as const,
    summary: "",
    setting: "",
    lighting: "good" as const,
    shots: [],
    best_moments: [],
    transcript: "",
    issues: [],
    actions: [{ start: 4.2, end: 4.8, what: "geste" }],
  };
  const plan = editPlanSchema.parse({ ...validPlanBase, duration: 3, segments: [{ clip_id: "a", in: 4, out: 5, zoom: "none", speed: 0.5 }] });
  const ramped = finishPlan(plan, { clips: { a: analysis }, photos: {} }, { a: 10 });
  assert.ok("clip_id" in ramped.segments[0]! && ramped.segments[0].ramp);
  const plain = finishPlan({ ...plan, finish: { ramp: "off" } }, { clips: { a: analysis }, photos: {} }, { a: 10 });
  assert.ok("clip_id" in plain.segments[0]! && !plain.segments[0].ramp);
});

test("finish: the sound of her videos (speech, all along, none) and a photo kept flat", () => {
  const plan = editPlanSchema.parse({
    ...validPlanBase,
    duration: 5,
    segments: [
      { clip_id: "v", in: 0, out: 3, zoom: "none" },
      { clip_id: "p", in: 0, out: 2, zoom: "none", move: "in", photo: photoEdit },
    ],
  });
  const inputs = {
    template: "libre" as const,
    clipUrls: { v: "https://x/v.mp4", p: "https://x/p.jpg" },
    photoIds: ["p"],
    brand: { name: "Studio" },
    depth: { p: { src: "https://x/p.webp", box: { x: 0.2, y: 0.2, w: 0.5, h: 0.7 } } },
  };
  const heard = (finish?: EditPlan["finish"]) => {
    const first = buildReelProps({ ...plan, ...(finish ? { finish } : {}) }, inputs).segments[0]!;
    return first.type === "clip" ? Boolean(first.speech) : null;
  };
  // Nobody speaks: muted by default, heard all along when she keeps the ambience, never with « none ».
  assert.equal(heard(), false);
  assert.equal(heard({ video_sound: "all" }), true);
  assert.equal(heard({ video_sound: "none" }), false);
  const relief = (finish?: EditPlan["finish"]) => {
    const photo = buildReelProps({ ...plan, ...(finish ? { finish } : {}) }, inputs).segments[1]!;
    return photo.type === "image" ? Boolean(photo.depth) : null;
  };
  assert.equal(relief(), true);
  assert.equal(relief({ relief: "off" }), false);
  assert.deepEqual(depthPhotoIds({ ...plan, finish: { relief: "off" } }), []);
});

test("finish: an ambience under the music, and the sound cleaned on demand", () => {
  const ambient = mixGains({ speech: -30, music: -12 }, false, true);
  assert.equal(ambient.kind, "ambient");
  assert.equal(ambient.speechGain, 9);
  assert.equal(ambient.musicGain, -4);
  assert.match(mixFilter(ambient, 10), /^\[0:a\].*volume=9dB\[own\];\[1:a\].*amix=inputs=2/);
  assert.doesNotMatch(mixFilter(ambient, 10), /sidechaincompress/);
  // Someone speaks: a voice's level, ducking as before.
  assert.equal(mixGains({ speech: -30, music: -12 }, false).kind, "speech_in_clips");
  // A clean recording is cleaned too when she asks for it, lightly.
  const forced = speechCleanFilter(-62, "/m.rnnn", true);
  assert.equal(forced.denoised, true);
  assert.match(forced.filter, /mix=0\.6/);
});

test("captions: what is said written like a creator, phrase by phrase, its strong word big, behind her at the start", async () => {
  const { captionCards, strongIndex, strongSize, cardTop } = await import("../../../apps/render/src/captions.ts");
  const { fromEditorPlan } = await import("./editor.ts");
  const { subjectPassages, wantsSubjects, CAPTION_SUBJECT_SECONDS } = await import("./subject.ts");
  const said = (text: string, from = 0, step = 9) => text.split(" ").map((w, i) => ({ w, from: from + i * step, to: from + i * step + 7 }));
  // A phrase is cut on its punctuation, a pause, or five words; its strong word carries meaning, a number first.
  const cards = captionCards([...said("quand tu n'en as plus,"), ...said("trouver de l'inspiration", 80), ...said("en 1 favori", 140)], 30, 300);
  assert.deepEqual(
    cards.map((c) => c.words.map((w) => w.w).join(" ")),
    ["quand tu n'en as plus,", "trouver de l'inspiration", "en 1 favori"],
  );
  // Only small words: the last one, long enough, carries the phrase (« quand tu n'en as PLUS »).
  assert.equal(cards[0]!.words.findIndex((w) => w.strong), 4);
  assert.equal(cards[1]!.words.find((w) => w.strong)?.w, "l'inspiration");
  assert.equal(cards[2]!.words.find((w) => w.strong)?.w, "1");
  // A phrase holds a little after its last word (0.6 s), never into the next one; the faces change from phrase to phrase.
  assert.equal(cards[0]!.to, 43 + 18);
  assert.equal(captionCards([...said("deux mots"), ...said("puis trois autres", 30)], 30, 100)[0]!.to, 30);
  assert.notEqual(cards[0]!.face, cards[1]!.face);
  // « et » alone never holds the screen: it joins the next phrase.
  assert.equal(captionCards([{ w: "et", from: 0, to: 5 }, ...said("un café offert", 8)], 30, 100).length, 1);
  assert.equal(strongIndex([{ w: "et" }]), -1);
  // The strong word fills its width, never more than its size cap; a long one is smaller.
  assert.ok(strongSize("PLUS", "display", 850, 300) === 300);
  assert.ok(strongSize("INSPIRATION", "display", 850, 300) < 150);
  // Its block sits in the free band above a low row, never under the apps' own caption; from a high row down.
  assert.ok(cardTop(0.64, 0.2) + 0.2 <= 0.74 + 1e-9);
  assert.equal(cardTop(0.2, 0.2), 0.2);
  // The editor's choice is kept when it is one of the styles, and a correction keeps it; an unknown one leaves the default.
  const base = { format: "9:16", duration: 6, template: "libre", segments: [{ clip_id: "c1", in: 0, out: 3, zoom: "none" }, { clip_id: "c2", in: 0, out: 3, zoom: "none" }], texts: [], transitions: "cut", subtitles: true };
  assert.equal(fromEditorPlan({ ...base, captions: "kinetic" } as never).captions, "kinetic");
  assert.equal(fromEditorPlan({ ...base, captions: "glitter" } as never).captions, undefined);
  // Her finish comes first; kinetic captions cut her out over the opening seconds only.
  const plan = editPlanSchema.parse({ ...fromEditorPlan({ ...base, captions: "stickers" } as never), finish: { captions: "kinetic" } });
  assert.equal(wantsSubjects(plan), true);
  assert.equal(wantsSubjects({ ...plan, subtitles: false }), false);
  const passages = subjectPassages(plan, () => true);
  assert.equal(passages.length, 2);
  assert.ok(passages.reduce((n, p) => n + p.to - p.from, 0) <= CAPTION_SUBJECT_SECONDS);
  assert.deepEqual(subjectPassages({ ...plan, finish: { captions: "native" } }, () => true), []);
  // The render gets the style only when words are said.
  const props = buildReelProps(plan, { template: "libre", clipUrls: { c1: "https://x/c1.mp4", c2: "https://x/c2.mp4" }, brand: { name: "Studio" }, words: { c1: [{ w: "bonjour", start: 0.2, end: 0.6 }] } });
  assert.equal(props.captions, "kinetic");
  assert.equal(buildReelProps({ ...plan, subtitles: false }, { template: "libre", clipUrls: { c1: "https://x/c1.mp4", c2: "https://x/c2.mp4" }, brand: { name: "Studio" } }).captions, undefined);
});

test("what is said: an animation that only lists `spoken` in its inputs, or times its own words on it, leaves the subtitles to the engine", async () => {
  const { readsSpoken, writesSpoken, SPOKEN_WRITTEN } = await import("./motion.ts");
  // Only named among its inputs (the first background replaced in production): it does not read it.
  assert.equal(readsSpoken("function Scene({ width, height, fps, durationInFrames, brand, texts, photos, cuts, shots, track, spoken }) { return null; }"), false);
  assert.equal(readsSpoken("const Scene = ({ track, spoken }) => null;"), false);
  assert.equal(readsSpoken("function Scene(props) { const { width, spoken } = props; return null; }"), false);
  // Used: it reads it.
  assert.equal(readsSpoken("function Scene({ spoken }) { return React.createElement(Captions, { words: spoken }); }"), true);
  assert.equal(readsSpoken("function Scene(props) { return props.spoken.map((w) => w.w); }"), true);
  // Read, and the check saw it writing the words said: the engine's captions step aside; seen leaving them out, they stay.
  const js = "function Scene({ spoken }) { return spoken.map((w) => w.w); }";
  assert.equal(writesSpoken({ js }), true);
  assert.equal(writesSpoken({ js, writes_spoken: true }), true);
  assert.equal(writesSpoken({ js, writes_spoken: false }), false);
  assert.ok(SPOKEN_WRITTEN > 0.5 && SPOKEN_WRITTEN < 1);
  // A composition that reads it without writing it all keeps the apps' plain subtitles, never a second set of big words.
  const base = { format: "9:16", duration: 6, template: "libre", segments: [{ clip_id: "c1", in: 0, out: 6, zoom: "none" }], texts: [], images: [], music: null, transitions: "cut", subtitles: true, captions: "kinetic" };
  const inputs = { template: "libre" as const, clipUrls: { c1: "https://x/c1.mp4" }, brand: { name: "Studio" }, words: { c1: [{ w: "bonjour", start: 0.2, end: 0.6 }, { w: "Lille", start: 0.8, end: 1.2 }] } };
  const layer = (writes: boolean) => ({ from: 0, to: 6, compose: true, motion: { brief: "her on orange, a big word per phrase behind her", js: "function Scene({ spoken, shots }) { const big = spoken.find((w) => w.w.length > 4); return big ? big.w : null; }", writes_spoken: writes } });
  const partly = buildReelProps(editPlanSchema.parse({ ...base, layers: [layer(false)] }), inputs);
  assert.equal(partly.captions, undefined);
  assert.equal(partly.layers?.[0]?.spoken, undefined);
  assert.ok(partly.words.length > 0);
  const whole = buildReelProps(editPlanSchema.parse({ ...base, layers: [layer(true)] }), inputs);
  assert.equal(whole.captions, "kinetic");
  assert.ok((whole.layers?.[0]?.spoken?.length ?? 0) > 0);
});

test("a word behind her: her silhouette from what was tracked hides it on a close-up, not above her head; the probe's words", async () => {
  const { silhouette, coveredShare, probeSpoken, onlyProbe } = await import("../../../apps/render/src/silhouette.ts");
  const names = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye", "right_eye_outer", "left_ear", "right_ear",
    "mouth_left", "mouth_right", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_pinky",
    "right_pinky", "left_index", "right_index", "left_thumb", "right_thumb", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle",
    "right_ankle", "left_heel", "right_heel", "left_foot_index", "right_foot_index",
  ];
  const body = (at: Record<string, [number, number]>) => ({
    id: 1,
    x: 540,
    y: 900,
    points: Object.fromEntries(names.map((n) => [n, at[n] ? { x: at[n]![0], y: at[n]![1], visible: true } : { x: 0, y: 0, visible: false }])),
  });
  const frame = { left: 0, top: 0, width: 1080, height: 1920 };
  // A close-up: her face fills the top, her shoulders the width, her hips out of the picture.
  const close = { hands: [], faces: [], bodies: [body({ nose: [540, 700], left_ear: [700, 650], right_ear: [380, 650], left_shoulder: [960, 1250], right_shoulder: [120, 1250] })] };
  const shapes = silhouette(close as never, frame);
  // A big word across her body is hidden; one at the top of the picture, above her hair, reads.
  assert.ok(coveredShare({ left: 150, top: 1350, right: 930, bottom: 1600 }, shapes, frame) > 0.8);
  assert.ok(coveredShare({ left: 150, top: 90, right: 930, bottom: 180 }, shapes, frame) < 0.2);
  // Standing in the middle, small in the picture: a word beside her reads, one across her waist is partly hidden.
  const standing = { hands: [], faces: [], bodies: [body({ nose: [540, 500], left_shoulder: [610, 620], right_shoulder: [470, 620], left_hip: [590, 950], right_hip: [490, 950], left_knee: [585, 1250], right_knee: [495, 1250], left_ankle: [585, 1550], right_ankle: [495, 1550] })] };
  const her = silhouette(standing as never, frame);
  assert.ok(coveredShare({ left: 60, top: 700, right: 400, bottom: 900 }, her, frame) < 0.05);
  const across = coveredShare({ left: 200, top: 800, right: 880, bottom: 950 }, her, frame);
  assert.ok(across > 0.1 && across < 0.4);
  // Nothing tracked: nothing hidden. Outside the box she is drawn in, nothing either.
  assert.deepEqual(silhouette({ hands: [], faces: [], bodies: [] } as never, frame), []);
  assert.equal(coveredShare({ left: 150, top: 1350, right: 930, bottom: 1600 }, shapes, { left: 0, top: 0, width: 1080, height: 960 }), 0);
  // The probe: all different words over the scene, phrases ending on a full stop; a text made of them is left out of the reading checks.
  const said = probeSpoken(300);
  assert.equal(new Set(said.map((w) => w.w.replace(".", ""))).size, said.length);
  assert.ok(said.at(-1)!.to <= 300 && said.length >= 20);
  assert.ok(said[3]!.w.endsWith("."));
  assert.equal(onlyProbe("lumière matin boutique"), true);
  assert.equal(onlyProbe("-20 % sur tout"), false);
});

test("what a composition's code cuts out: her, or the objects it names, shot by shot", async () => {
  const { drawsSubject, objectsDrawn, objectPassages, objectKey, OBJECT_MAX } = await import("./subject.ts");
  // Her: Subject, SubjectBox, SubjectOutline or Outline without an object's name (an outline needs her cut out too).
  assert.equal(drawsSubject(`<Outline shot={shots[0]} at={4} />`), true);
  assert.equal(drawsSubject(`const b = SubjectBox(shots[1], f, laid);`), true);
  assert.equal(drawsSubject(`<Subject shot={0} rim={8} />`), true);
  // Only objects: she is not cut out for them. As kept (compiled by sucrase, a style nested in the props) and as JSX.
  const objectsOnly =
    `const b = SubjectBox(shots[1], f, laid, "the red bag"); React.createElement(Subject, { shot: 2, style: { left: 0, top: 0 }, object: "Coffee  Cup"  ,} ), ` +
    `React.createElement(Outline, { shot: shots[2], object: "coffee cup" , dash: true,} )`;
  assert.equal(drawsSubject(objectsOnly), false);
  assert.deepEqual(objectsDrawn(objectsOnly), [
    { shot: 2, name: "coffee cup" },
    { shot: 1, name: "the red bag" },
  ]);
  assert.deepEqual(objectsDrawn(`<Subject shot={3} style={{ left: 0 }} object="vase" />`), [{ shot: 3, name: "vase" }]);
  assert.equal(drawsSubject(`${objectsOnly} React.createElement(Subject, { shot: 0, rim: 8,} )`), true);
  assert.equal(drawsSubject(undefined), false);
  // A shot written as a variable: any shot under the animation (the photo test's code switched shots by the frame).
  assert.deepEqual(objectsDrawn(`<Subject shot={i} object="cup" />`), [{ shot: -1, name: "cup" }]);
  // A nested call among its arguments (the Text Brush test's code) is still read as a call for the cup, not for her.
  const nested = `const b = SubjectBox(shots[0], Math.min(frame, 116), laid, "espresso cup"); React.createElement(Subject, { shot: 0, object: "espresso cup", style: { left: 0 },} )`;
  assert.equal(drawsSubject(nested), false);
  assert.deepEqual(objectsDrawn(nested), [{ shot: 0, name: "espresso cup" }]);
  assert.equal(drawsSubject(`SubjectOutline(shots[1], Math.round(f / 2), { left: 0, top: 0, width: 1080, height: 1920 })`), true);
  // Each object through the passage of its shot (the plan's n-th shot, photos counted), videos at their own pace only.
  const plan = {
    segments: [
      { clip_id: "photo1", in: 0, out: 2 },
      { clip_id: "v1", in: 1, out: 4 },
      { clip_id: "v2", in: 0, out: 3, speed: 0.5 },
    ],
    layers: [{ from: 0, to: 9, brief: "", compose: true, motion: { js: `<Subject shot={1} object="cup" /> <Subject shot={2} object="ball" /> <Subject shot={0} object="vase" />` } }],
  } as never;
  const passages = objectPassages(plan, (id) => id.startsWith("v"));
  assert.deepEqual(passages, [{ clip_id: "v1", from: 1, to: 4, key: objectKey("v1", 1, 4, "cup"), name: "cup" }]);
  assert.match(passages[0]!.key, /^v1@1\.00-4\.00#cup$/);
  assert.ok(OBJECT_MAX >= 2);
  // An animation laid over the montage follows them too (the Text Brush test: a word around her cup, behind it).
  const over = { ...(plan as object), layers: [{ from: 0, to: 4, brief: "", motion: { js: `SubjectOutline(shots[1], frame, laid, "espresso cup")` } }] } as never;
  assert.deepEqual(objectPassages(over, (id) => id.startsWith("v")).map((p) => p.name), ["espresso cup"]);
});

test("an animation over the montage gets the shots under it when its code draws one, and her cut out when it uses Subject", async () => {
  const { wantsSubjects, subjectPassages } = await import("./subject.ts");
  const plan = {
    format: "9:16",
    duration: 4,
    template: "libre",
    segments: [{ clip_id: "v1", in: 0, out: 4, zoom: "none" }],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    layers: [
      { from: 0, to: 2, brief: "", motion: { js: `React.createElement(Subject, { shot: 0, style: { left: 0, top: 0, width: 1080, height: 1920 },} )` } },
      { from: 2, to: 4, brief: "", motion: { js: `React.createElement("div", null, "bonjour")` } },
    ],
  } as never;
  assert.equal(wantsSubjects(plan), true);
  assert.deepEqual(subjectPassages(plan, () => true).map((p) => p.clip_id), ["v1"]);
  const props = buildReelProps(plan, { template: "libre", clipUrls: { v1: "https://x/v1.mp4" }, brand: { name: "Studio" } } as never);
  const [drawing, plain] = props.layers ?? [];
  assert.equal(drawing?.shots?.length, 1);
  assert.equal(drawing?.shots?.[0]?.from, 0);
  assert.equal(plain?.shots, undefined);
});

test("what a composition shows in depth: the shots its code names, read through their passages, given to the render", async () => {
  const { depthsDrawn, depthPassages, depthKey, drawsSubject, objectsDrawn, wantsDepth, DEPTH_MAX } = await import("./subject.ts");
  const { buildReelProps } = await import("./motion.ts");
  // As kept (compiled by sucrase) and as JSX; a shot written as a variable is not read; never her cut-out nor an object.
  const code = `React.createElement(Depth, { shot: 1, style: { left: 0, top: 0, width: 1080, height: 1920 }, invert: true,} ) <Depth shot={shots[2]} />`;
  assert.deepEqual(depthsDrawn(code).sort(), [1, 2]);
  assert.deepEqual(depthsDrawn(`<Depth shot={i} />`), []);
  assert.equal(drawsSubject(code), false);
  assert.deepEqual(objectsDrawn(code), []);
  const plan = {
    segments: [
      { clip_id: "photo1", in: 0, out: 2 },
      { clip_id: "v1", in: 1, out: 4 },
      { clip_id: "v2", in: 0, out: 3, speed: 0.5 },
    ],
    layers: [{ from: 0, to: 9, brief: "", compose: true, motion: { js: code } }],
  } as never;
  assert.equal(wantsDepth(plan), true);
  // A video at its own pace only (shot 2 plays at half speed), under a key no object takes (« ~ », never « # »).
  const passages = depthPassages(plan, (id) => id.startsWith("v"));
  assert.deepEqual(passages, [{ clip_id: "v1", from: 1, to: 4, key: depthKey("v1", 1, 4) }]);
  assert.match(passages[0]!.key, /^v1@1\.00-4\.00~depth$/);
  assert.ok(DEPTH_MAX >= 2);
  // The render gets it on its shot, apart from the objects.
  const props = buildReelProps(
    {
      format: "9:16",
      duration: 3,
      template: "libre",
      segments: [{ clip_id: "v1", in: 1, out: 4, zoom: "none" }],
      texts: [],
      images: [],
      transitions: "cut",
      subtitles: false,
      music: null,
    } as never,
    { template: "libre", clipUrls: { v1: "https://x/v1.mp4" }, brand: { name: "Studio" }, subjects: { [depthKey("v1", 1, 4)]: { src: "https://x/v1-depth.mp4" } } } as never,
  );
  const shot = props.segments[0] as { depthMap?: { src: string }; objects?: unknown };
  assert.deepEqual(shot.depthMap, { src: "https://x/v1-depth.mp4" });
  assert.equal(shot.objects, undefined);
});

test("her outline: a smooth closed path, open where the frame cuts her", async () => {
  const { outlinePath } = await import("../../../apps/render/src/outline.ts");
  const ring = (pts: number[][]) => pts.flat();
  const full = (x: number, y: number) => [x * 1080, y * 1920] as const;
  // A diamond in the middle: closed, its corners rounded by curves, from its first point.
  const diamond = ring([[0.5, 0.3], [0.7, 0.5], [0.5, 0.7], [0.3, 0.5], [0.4, 0.4], [0.6, 0.4]]);
  const d = outlinePath(diamond, full)!;
  assert.match(d, /^M 540\.0 576\.0 C /);
  assert.ok(d.endsWith(" Z"));
  assert.equal((d.match(/ C /g) ?? []).length, 6);
  // Cut by the bottom of the picture: no line along the frame's edge (two edge points in a row), the path left open.
  const bust = ring([[0.5, 0.2], [0.8, 0.6], [0.9, 1], [0.6, 1], [0.3, 1], [0.2, 0.6]]);
  const open = outlinePath(bust, full)!;
  assert.ok(!open.endsWith("Z"));
  assert.equal((open.match(/ C /g) ?? []).length, 4);
  // Too few points: nothing to draw.
  assert.equal(outlinePath([0.5, 0.5, 0.6, 0.6], full), null);
});

test("a photo's cut-out from the card or the sandbox is kept, an older one is cut again", async () => {
  const { currentCutout, CARD_CUTOUT_MODEL, CUTOUT_MODEL } = await import("./cutout.ts");
  assert.equal(currentCutout(CARD_CUTOUT_MODEL), true);
  assert.equal(currentCutout(CUTOUT_MODEL), true);
  assert.equal(currentCutout("u2net"), false);
  assert.equal(currentCutout(undefined), false);
});

test("the rented card's price: its card and a sandbox's CPU and memory by the second", async () => {
  const { modalCostUsd } = await import("./pricing.ts");
  // 100 s with an A10G, 2 cores and 8 GiB: about 4.4 cents (the card, then the sandbox's CPU and memory at 3 times the functions' price).
  assert.ok(Math.abs(modalCostUsd(100, 2, 8) - 0.04382) < 1e-6);
  assert.ok(Math.abs(modalCostUsd(100, 2, 8, "L4") - 0.03542) < 1e-6);
  // A machine without a card: its CPU and memory only; an unknown card at the price of an A100.
  assert.ok(Math.abs(modalCostUsd(100, 2, 8, null) - 0.01322) < 1e-6);
  assert.ok(Math.abs(modalCostUsd(100, 2, 8, "B300") - 0.07152) < 1e-6);
  assert.equal(modalCostUsd(-5, 2, 8), 0);
});

test("a photo's outline: read on its cut-out's transparency, clockwise from its top, nothing for a speck", async () => {
  const { contourOfAlpha, CONTOUR_POINTS } = await import("./contour.ts");
  // A rectangle x 10..29, y 5..14 in a 40 × 20 mask: 64 points, from its top left corner, along the top first (clockwise on the screen).
  const w = 40;
  const h = 20;
  const rect = new Uint8Array(w * h);
  for (let y = 5; y < 15; y++) for (let x = 10; x < 30; x++) rect[y * w + x] = 255;
  const c = contourOfAlpha(rect, w, h)!;
  assert.equal(c.length, CONTOUR_POINTS * 2);
  assert.deepEqual(c.slice(0, 2), [0.263, 0.275]);
  assert.ok(c[2]! > c[0]! && c[3] === c[1]);
  const xs = c.filter((_, i) => i % 2 === 0);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [0.263, 0.738]);
  // A disc of radius 30, and a speck far from it (only the largest piece has an outline): within a pixel of its edge.
  const W = 100;
  const H = 80;
  const disc = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - 50) ** 2 + (y - 40) ** 2 <= 900) disc[y * W + x] = 255;
  disc[2 * W + 2] = 255;
  const d = contourOfAlpha(disc, W, H)!;
  for (let i = 0; i < d.length; i += 2) assert.ok(Math.abs(Math.hypot(d[i]! * W - 50.5, d[i + 1]! * H - 40.5) - 30) < 1.2);
  // Nothing worth an outline: a speck alone, an empty mask.
  const speck = new Uint8Array(W * H);
  speck[5 * W + 5] = 255;
  assert.equal(contourOfAlpha(speck, W, H), null);
  assert.equal(contourOfAlpha(new Uint8Array(W * H), W, H), null);
});

test("text around something of her photos: her subject, an object found on a photo, kept flat, given to the render", async () => {
  const { objectPassages, objectKey, photoKey, photoObjectsDrawn, photosDrawnOver, subjectPhotoIds, AROUND_WORDS, PHOTO_OBJECT_MAX } = await import("./subject.ts");
  const ring = `React.createElement(Subject, { shot: 0, object: "wine glass", style: laid }); SubjectBox(shots[0], frame, laid, "wine glass")`;
  const her = `<Subject shot={1} style={{ position: "absolute", ...laid }} />`;
  const plan: EditPlan = editPlanSchema.parse({
    format: "9:16",
    duration: 5,
    template: "libre",
    segments: [
      { clip_id: "p1", in: 0, out: 2.5, zoom: "none", move: "in", photo: { source: { width: 1080, height: 1920 } } },
      { clip_id: "p2", in: 0, out: 2.5, zoom: "none", move: "in", photo: { source: { width: 1080, height: 1920 } } },
    ],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    layers: [{ from: 0, to: 5, motion: { brief: "le mot tourne autour du verre", js: `${ring} ${her}` } }],
  });
  // The glass is found once on the photo itself (one image, from 0 to 0), whatever the photo's move; never as a video passage.
  assert.deepEqual(objectPassages(plan, () => false), [{ clip_id: "p1", from: 0, to: 0, key: objectKey("p1", 0, 0, "wine glass"), name: "wine glass", photo: true }]);
  assert.equal(objectKey("p1", 0, 0, "wine glass"), `${photoKey("p1")}#wine glass`);
  assert.ok(PHOTO_OBJECT_MAX >= 4);
  // Her subject drawn by an animation: every photo of the Reel has its own cut-out made (none when nothing draws her),
  // the one it draws her on first (ten are cut out at a time: past ten, hers is never left out).
  assert.deepEqual(subjectPhotoIds(plan), ["p2", "p1"]);
  const many: EditPlan = {
    ...plan,
    segments: Array.from({ length: 20 }, (_, k) => ({ ...plan.segments[0]!, clip_id: `w${k}` })),
    layers: [{ ...plan.layers![0]!, motion: { ...plan.layers![0]!.motion, js: `<Subject shot={0} style={{ position: "absolute", ...laid }} />` } }],
  };
  assert.equal(subjectPhotoIds(many)[0], "w0");
  assert.equal(subjectPhotoIds(many).length, 10);
  const last: EditPlan = { ...many, layers: [{ ...many.layers![0]!, motion: { ...many.layers![0]!.motion, js: `<Subject shot={19} style={laid} />` } }] };
  assert.equal(subjectPhotoIds(last)[0], "w19");
  assert.deepEqual(subjectPhotoIds({ ...plan, layers: [{ ...plan.layers![0]!, motion: { ...plan.layers![0]!.motion, js: ring } }] }), []);
  // Photos drawn over move flat: a relief would move her subject away from its cut-out laid over it.
  assert.deepEqual(photosDrawnOver(plan).sort(), ["p1", "p2"]);
  assert.deepEqual(depthPhotoIds(plan), []);
  assert.deepEqual(depthPhotoIds({ ...plan, layers: [] }).sort(), ["p1", "p2"]);
  // A carousel's code names its objects on photos[n], a reframing after the name.
  assert.deepEqual(photoObjectsDrawn(`<Subject photo={photos[1]} style={box} object="Wine Glass" /> SubjectOutline(photos[0], box, "bottle", { zoom: 1.2 })`), [
    { photo: 1, name: "wine glass" },
    { photo: 0, name: "bottle" },
  ]);
  // What asks for it before any code is written.
  assert.ok(AROUND_WORDS.test("Le mot « CHEERS » qui tourne autour du verre"));
  assert.ok(AROUND_WORDS.test("un texte derrière la bouteille"));
  assert.ok(!AROUND_WORDS.test("un Reel de mes plats du jour"));

  // The render: each photo segment gets its cut-out and the objects found on it; each shot under the animation its box and outline, placed by its framing.
  const contour = Array.from({ length: 128 }, (_, i) => (i % 2 ? 0.4 : 0.5));
  const props = buildReelProps(plan, {
    template: "libre",
    clipUrls: { p1: "https://x/p1.jpg", p2: "https://x/p2.jpg" },
    photoIds: ["p1", "p2"],
    brand: { name: "Studio" },
    sceneCutouts: { p2: { src: "https://x/p2-cut.webp", box: { x: 0.3, y: 0.2, w: 0.4, h: 0.6 }, contour } },
    subjects: { [objectKey("p1", 0, 0, "wine glass")]: { src: "https://x/p1-glass.png", still: true, boxes: [[0.4, 0.5, 0.2, 0.3]], contours: [contour] } },
  });
  const [first, second] = props.segments;
  assert.deepEqual(first?.type === "image" && first.objects, { "wine glass": { src: "https://x/p1-glass.png" } });
  assert.equal(first?.type === "image" && first.subject, undefined);
  assert.deepEqual(second?.type === "image" && second.subject, { src: "https://x/p2-cut.webp" });
  const shots = props.layers?.[0]?.shots ?? [];
  assert.equal(shots.length, 2);
  assert.deepEqual(shots[0]?.objects, { "wine glass": { boxes: [[0.4, 0.5, 0.2, 0.3]], contours: [contour] } });
  assert.deepEqual(shots[1]?.subjectBoxes, [[0.3, 0.2, 0.4, 0.6]]);
  assert.deepEqual(shots[1]?.subjectContours, [contour]);
  assert.deepEqual(shots[1]?.edit, { source: { width: 1080, height: 1920 } });
});

test("an object named on a shot written as a variable is looked for on every shot under the animation", async () => {
  const { objectPassages, objectsDrawn, photoObjectsDrawn, photosDrawnOver, ANY_SHOT } = await import("./subject.ts");
  // The photo test's code: the same photo on two shots, switched by the frame (shotIdx), as compiled.
  const code = `const shotIdx = frame < 150 ? 0 : 1; SubjectBox(shots[shotIdx], frame, laid, "coffee cup"); React.createElement(Subject, { key: shotIdx, shot: shotIdx, object: "coffee cup", style: laid })`;
  assert.deepEqual(objectsDrawn(code), [{ shot: ANY_SHOT, name: "coffee cup" }]);
  assert.deepEqual(photoObjectsDrawn(`photos.map((p, i) => <Subject photo={photos[i]} object="wine glass" />)`), [{ photo: ANY_SHOT, name: "wine glass" }]);
  const plan: EditPlan = editPlanSchema.parse({
    format: "9:16",
    duration: 9,
    template: "libre",
    segments: [
      { clip_id: "p1", in: 0, out: 5, zoom: "none", move: "in", photo: { source: { width: 800, height: 1000 } } },
      { clip_id: "p1", in: 0, out: 4, zoom: "none", move: "punch", photo: { source: { width: 800, height: 1000 } } },
      { clip_id: "v1", in: 1, out: 3, zoom: "none" },
    ],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    layers: [{ from: 0, to: 9, motion: { brief: "ring", js: code } }],
  });
  // The photo once (its two shots are the same image), not the video after the animation.
  assert.deepEqual(
    objectPassages(plan, (id) => id === "v1").map((p) => [p.clip_id, p.photo ?? false]),
    [["p1", true]],
  );
  assert.deepEqual(photosDrawnOver(plan), ["p1"]);
  // Over the whole Reel, the video too; over its last shot only, the video alone.
  assert.deepEqual(
    objectPassages({ ...plan, layers: [{ ...plan.layers![0]!, to: 11 }] }, (id) => id === "v1").map((p) => p.clip_id),
    ["p1", "v1"],
  );
  assert.deepEqual(
    objectPassages({ ...plan, layers: [{ ...plan.layers![0]!, from: 9.2, to: 11 }] }, (id) => id === "v1").map((p) => p.clip_id),
    ["v1"],
  );
});

test("Edith's art direction by default: a model her files can make, never one of her last Reels, dressed in her charter", async () => {
  const { readHousePick, housePickInput, HOUSE_PICK_AVOID } = await import("./house-pick.ts");
  const { HOUSE_MODELS, houseModel, houseStyle } = await import("./house-models.ts");
  const { followedLook, followedSignature, stolenStyleSchema } = await import("./steal.ts");
  // The picker reads every model, her files and the models of her last Reels.
  const input = JSON.parse(housePickInput({ request: "Six heures du matin, ça grouille.", business: "boulangerie", files: [{ kind: "video", seconds: 8, shows: "pain qui sort du four" }], voice: false, avoid: ["mosaique"] }));
  assert.equal(input.modeles.length, HOUSE_MODELS.length);
  assert.deepEqual(input.derniers_modeles, ["mosaique"]);
  assert.equal(HOUSE_PICK_AVOID, 3);
  // A model of the catalogue, not one of her last Reels', that her files can fill.
  assert.equal(readHousePick({ key: "decode", why: "" }, 5, []), "decode");
  assert.equal(readHousePick({ key: " Decode ", why: "" }, 5, []), "decode");
  assert.equal(readHousePick({ key: "decode", why: "" }, 5, ["decode"]), null);
  assert.equal(readHousePick({ key: "none", why: "" }, 5, []), null);
  assert.equal(readHousePick({ key: "inconnu", why: "" }, 5, []), null);
  // The card wants 10 files: three are too few.
  assert.equal(houseModel("carte-feutre")!.files[0], 10);
  assert.equal(readHousePick({ key: "carte-feutre", why: "" }, 3, []), null);
  assert.equal(readHousePick({ key: "carte-feutre", why: "" }, 8, []), "carte-feutre");
  // Picked by Edith, the model wears her charter: her fonts set the Reel, its pairing only offered.
  const style = stolenStyleSchema.parse(houseStyle(houseModel("decode")!));
  const chosen = followedFrom("00000000-0000-4000-8000-000000000000", style);
  const dressed = followedFrom("00000000-0000-4000-8000-000000000000", style, false, true);
  assert.ok(chosen.fonts && !chosen.dressed);
  assert.equal(dressed.dressed, true);
  assert.equal(dressed.fonts, undefined);
  assert.deepEqual(dressed.pairing, chosen.fonts);
  assert.ok(Object.keys(followedLook({}, chosen)).length > 0);
  assert.deepEqual(followedLook({}, dressed), {});
  assert.match(String(followedForEditor(dressed).police), /polices de sa charte/);
  assert.match(String(followedForEditor(dressed).origine), /choisi par Edith/);
  assert.match(followedLine(dressed), /habillé de sa charte/);
  // Her charter's music stays when she has one; the model's otherwise.
  const charter = { titles: { font: "display", case: "normal", weight: "bold", align: "center", tracking: "normal" }, stress: "color", band: "white", grade: "natural", base: "light", motion: "chaleureux", music: "warm acoustic guitar", voice: "" } as const;
  assert.equal(followedSignature(charter, dressed.look, true).music, "warm acoustic guitar");
  assert.notEqual(followedSignature(charter, chosen.look).music, "warm acoustic guitar");
});

test("each of Edith's models shows its original's frames as a Reel she sends: sheets of ten frames over its passage", async () => {
  const { HOUSE_MODELS, houseModel, houseStyle, HOUSE_VERSION } = await import("./house-models.ts");
  const { houseSheets, sheetSpan, houseOriginalPath, HOUSE_PASSAGES, MODEL_SHEETS, HOUSE_DESIGNS } = await import("./house-sheets.ts");
  const { HOUSE_MEASURES } = await import("./house-measures.ts");
  const { stolenStyleSchema } = await import("./steal.ts");
  // A studio's row written before the sheets is rewritten (11: ten models written again on their originals' fiches).
  assert.equal(HOUSE_VERSION, 20);
  for (const m of HOUSE_MODELS) {
    const sheets = houseSheets(m.key);
    // A model written as a design has no original, so no sheets (its row names none).
    if (HOUSE_DESIGNS.has(m.key)) {
      assert.deepEqual(sheets, [], m.key);
      assert.equal(stolenStyleSchema.parse(houseStyle(m)).sheets, undefined, m.key);
      continue;
    }
    const duration = HOUSE_MEASURES[m.key]!.duration;
    // Every model has sheets over its whole passage, in order, a twelfth of it each (two seconds at least), twelve at most.
    assert.ok(sheets.length > 0 && sheets.length <= MODEL_SHEETS, m.key);
    assert.equal(sheets[0]!.from, 0);
    assert.ok(Math.abs(sheets.at(-1)!.to - duration) < 0.01, m.key);
    for (const [i, s] of sheets.entries()) {
      // The last one reaches the end: a span and less than a frame's interval more.
      assert.ok(s.to > s.from && s.to - s.from <= sheetSpan(duration) * 1.1 + 0.01, m.key);
      assert.equal(s.path, `house/sheets/${m.key}/${String(i).padStart(2, "0")}.jpg`);
    }
    // Named on the model's row, read as a Reel she sends.
    assert.deepEqual(stolenStyleSchema.parse(houseStyle(m)).sheets, sheets);
    // A passage ends where the model was measured.
    if (HOUSE_PASSAGES[m.key]) assert.equal(HOUSE_PASSAGES[m.key]!.to, duration, m.key);
  }
  assert.equal(houseOriginalPath("facade"), "house/originals/facade.mp4");
  // A 31 s original: twelve sheets of 2.583 s; a 9.4 s one: five of 2 s; as many as the workshop made for each model.
  assert.equal(sheetSpan(31), 2.583);
  const made: Record<string, number> = { decode: 12, "quatre-coins": 11, mosaique: 3, "carte-feutre": 5, pile: 5, "photo-dump": 6, table: 5, "ecran-partage": 7, cadre: 4, fenetres: 7, facade: 5, gaufre: 7, "mot-cle": 12, frappe: 7, "titre-derriere": 6, journee: 8, "plans-fixes": 7, "coups-de-fouet": 12, tourne: 7, nike: 6, eventail: 10, coulisses: 6, interrupteur: 5, interface: 7, pixel: 8, "mots-meles": 10, aplat: 5, detourages: 9, createur: 12, silhouette: 6, vision: 5, "mon-travail": 5, rallume: 0 };
  for (const m of HOUSE_MODELS) assert.equal(houseSheets(m.key).length, made[m.key], m.key);
  assert.deepEqual(houseSheets("facade").at(-1), { from: 8, to: 9.4, path: "house/sheets/facade/04.jpg" });
  assert.deepEqual(houseSheets("inconnu"), []);
  assert.ok(houseModel("nike") && HOUSE_PASSAGES.nike!.crop);
});

test("one director for a Reel that follows a model: its answer, the original at the same point, the frame of its sheets", async () => {
  const { directorOutputSchema, originalInstant, sheetCell, DIRECTOR_PROMPT, DIRECTOR_LOOK_NOTE } = await import("./director.ts");
  const { houseSheets } = await import("./house-sheets.ts");
  // Its answer is the editor's, with a composition and, after a look, keep.
  const shape = Object.keys(directorOutputSchema.shape).sort();
  assert.deepEqual(shape, ["composition_code", "composition_name", "keep", "plan", "rationale"]);
  // Flat and required (a nested composition made the grammar too large), without what the engine sets itself.
  for (const key of ["captions", "look", "colors", "fonts"]) assert.equal(key in directorOutputSchema.shape.plan.shape, false, key);
  assert.ok(!directorOutputSchema.shape.keep.isOptional() && !directorOutputSchema.shape.composition_code.isOptional());
  assert.match(DIRECTOR_PROMPT, /never seconds you wrote/);
  assert.match(DIRECTOR_LOOK_NOTE, /keep true/);
  // The same second when the two lengths are close, the same point of it otherwise; never past its end.
  assert.equal(originalInstant(3, 12, 12.5), 3);
  assert.equal(originalInstant(6, 12, 24), 12);
  assert.equal(originalInstant(20, 12, 13), 13);
  assert.equal(originalInstant(-1, 12, 12), 0);
  // The nearest of its frames: ten a sheet, five by two; the last sheet ends with the original.
  const facade = houseSheets("facade");
  assert.deepEqual(sheetCell(facade, 0), { sheet: 0, col: 0, row: 0 });
  assert.deepEqual(sheetCell(facade, 1.0), { sheet: 0, col: 0, row: 1 });
  assert.deepEqual(sheetCell(facade, 2.6), { sheet: 1, col: 3, row: 0 });
  assert.deepEqual(sheetCell(facade, 9.3), { sheet: 4, col: 1, row: 1 });
  assert.deepEqual(sheetCell(facade, 50), { sheet: 4, col: 1, row: 1 });
  assert.equal(sheetCell([], 1), null);
});

test("the director's look at its own Reel: its first image, each text coming in and read, each shot, its end, sixteen at most", async () => {
  const { lookMoments, LOOK_FRAMES } = await import("./rework.ts");
  const plan = { duration: 10, texts: [{ from: 0, to: 2 }, { from: 4, to: 6 }] } as unknown as Pick<EditPlan, "duration" | "texts">;
  const moments = lookMoments(plan, [
    { start: 0, length: 2 },
    { start: 2, length: 3 },
    { start: 5, length: 5 },
  ]);
  assert.equal(moments[0], 0.2);
  assert.equal(moments.at(-1), 9.7);
  // Each text as it comes in and while it reads (60 % of its span), each shot's middle; none closer than 0.35 s to the one before.
  for (const t of [1.2, 4.2, 5.2, 3.5, 7.5]) assert.ok(moments.some((m) => Math.abs(m - t) < 0.36), `${t} looked at`);
  for (let i = 1; i < moments.length; i++) assert.ok(moments[i]! - moments[i - 1]! >= 0.35);
  // A long Reel: sixteen at most, its first and last kept.
  const long = lookMoments({ duration: 40, texts: [] } as unknown as Pick<EditPlan, "duration" | "texts">, Array.from({ length: 30 }, (_, i) => ({ start: i * 1.3, length: 1.3 })));
  assert.equal(long.length, LOOK_FRAMES);
  assert.equal(long[0], 0.2);
  assert.equal(long.at(-1), 39.7);
});

test("a model Edith picked holds her floor: words on screen, an ambiance 15 s at most when nobody speaks", async () => {
  const { dressedFloorNote, AMBIANCE_MAX_SECONDS } = await import("./editor.ts");
  const base = { duration: 12, texts: [{ text: "le premier café", from: 0, to: 2 }], end_card: undefined } as unknown as Parameters<typeof dressedFloorNote>[0];
  const quiet = { voice: false, speech: false };
  assert.equal(dressedFloorNote(base, quiet), null);
  // Café Tolbiac's mosaic: 30 s, not one word.
  const mosaic = { ...base, duration: 30, texts: [] } as unknown as Parameters<typeof dressedFloorNote>[0];
  const note = dressedFloorNote(mosaic, quiet)!;
  assert.match(note, /aucun texte/);
  assert.match(note, new RegExp(`${AMBIANCE_MAX_SECONDS} s au plus`));
  // Someone speaks, a voice tells it, or she asked for a length: the length is theirs.
  assert.doesNotMatch(dressedFloorNote(mosaic, { voice: false, speech: true })!, /au plus/);
  assert.equal(dressedFloorNote({ ...mosaic, texts: base.texts } as typeof mosaic, { ...quiet, duration: 30 }), null);
  // Her request wants no words: none is asked.
  assert.equal(dressedFloorNote({ ...base, texts: [] } as typeof base, { ...quiet, request: "Juste les images, sans texte." }), null);
  // An end card is a word on screen.
  assert.equal(dressedFloorNote({ ...base, texts: [], end_card: { title: "Café Tolbiac" } } as unknown as typeof base, quiet), null);
});

test("montage skills: each one's plan holds for every number of shots it takes, with or without its ending", async () => {
  const { MONTAGE_SKILLS } = await import("./skill-library.ts");
  const { skillPlan, skillShotCount } = await import("./skills.ts");
  const { checkMotionCode } = await import("./motion-scene.ts");
  const { houseModel } = await import("./house-models.ts");
  for (const skill of Object.values(MONTAGE_SKILLS)) {
    assert.ok(houseModel(skill.key), `${skill.key}: a house model`);
    assert.deepEqual(checkMotionCode(skill.code), [], `${skill.key}: its code passes the code check`);
    assert.match(skill.code, /function Scene\s*\(/);
    assert.ok(skill.bpm >= 60 && skill.bpm <= 140, `${skill.key}: its tempo is one a plan takes`);
    assert.ok(skill.files[0] >= 1 && skill.files[0] <= skill.files[1] && skill.shots[0] <= skill.shots[1]);
    // A skill timed on her voice plays her talk (its own tests): without one, it makes no Reel.
    if (skill.voice) {
      const files = [{ id: "v0", photo: false, seconds: 16 }];
      assert.throws(() => skillPlan({ skill, name: "Test", files, fill: { shots: [], texts: {}, end: null } }), /se cale sur sa voix/, skill.key);
      continue;
    }
    for (let n = skill.shots[0]; n <= Math.max(skill.shots[1], skill.long ?? 0); n++) {
      // Enough footage for its count (a long version takes more of her files): each video three passages at most.
      const files = Array.from({ length: Math.max(4, Math.ceil(n / 3)) }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 16, moments: [{ start: 1, end: 4 }, { start: 6, end: 9 }, { start: 11, end: 14 }] }));
      for (const end of [false, true]) {
        const texts = Object.fromEntries(skill.texts.map((t) => [t.slot, "abc".repeat(Math.ceil(t.max / 3)).slice(0, t.max)]));
        const plan = skillPlan({ skill, name: "Test", files, fill: { shots: Array.from({ length: n }, (_, i) => ({ file: files[i % files.length]!.id, at: Math.floor(i / files.length) * 5 })), texts, end: end && skill.end ? { title: "Ouverture samedi" } : null } });
        const parsed = editPlanSchema.safeParse(plan);
        assert.ok(parsed.success, `${skill.key} n=${n} end=${end}: ${parsed.success ? "" : parsed.error.message.slice(0, 300)}`);
        assert.equal(plan.segments.length, n);
        assert.ok(plan.duration <= 45, `${skill.key}: ${plan.duration} s`);
        const marks = plan.layers![0]!.motion.texts!;
        for (const v of Object.values(marks)) assert.ok(Number.isFinite(Number(v)), `${skill.key}: marks are numbers`);
        assert.equal(plan.skill?.key, skill.key);
        assert.equal(plan.layers![0]!.compose, true);
        assert.equal(plan.texts.length, skill.texts.length);
        // A video's passages never overlap: the same picture twice reads as a missed cut.
        const byFile = new Map<string, [number, number][]>();
        for (const s of plan.segments) {
          if (!("clip_id" in s)) continue;
          for (const [a, b] of byFile.get(s.clip_id) ?? []) assert.ok(s.in >= b - 0.01 || s.out <= a + 0.01, `${skill.key} n=${n}: ${s.clip_id} ${s.in}–${s.out} overlaps ${a}–${b}`);
          byFile.set(s.clip_id, [...(byFile.get(s.clip_id) ?? []), [s.in, s.out]]);
        }
      }
    }
    assert.equal(skillShotCount(skill, [{ id: "p", photo: true, seconds: 0 }]), skill.shots[0]);
  }
});

test("montage skills: the filler's answer is read against the skill and her files", async () => {
  const { decode } = await import("./skills/decode.ts");
  const { readSkillFill, fitWords, fewFiles } = await import("./skills.ts");
  const files = [
    { id: "a", photo: false, seconds: 10 },
    { id: "b", photo: true, seconds: 0 },
  ];
  const read = readSkillFill(decode, files, 3, {
    fits: true,
    missing: "",
    shots: [{ file: "a", at: 40 }, { file: "inconnu", at: 2 }],
    texts: [
      { slot: "surtitre", text: "un samedi tranquille au cœur de" },
      { slot: "titre", text: "le marais" },
    ],
    end: { title: "", subtitle: "" },
    why: "",
  })!;
  assert.equal(read.shots.length, 3);
  // A start past its video is brought back into it; an unknown file is one of hers.
  assert.equal(read.shots[0]!.at, 10);
  assert.ok(["a", "b"].includes(read.shots[1]!.file));
  // Cut at the last word that fits its place, never in the middle of one.
  assert.equal(read.texts.surtitre, "un samedi tranquille au");
  assert.equal(read.end, null);
  assert.equal(fitWords("bonjour à tous", 9), "bonjour à");
  // A required text missing: the editor makes the Reel.
  assert.equal(readSkillFill(decode, files, 3, { fits: true, missing: "", shots: [], texts: [{ slot: "surtitre", text: "un" }], end: null, why: "" }), null);
  assert.equal(fewFiles(decode, 2), true);
  assert.equal(fewFiles(decode, 3), false);
});

test("Edith picks a model coded as a skill only when her files fill it", async () => {
  const { readHousePick, housePickInput } = await import("./house-pick.ts");
  assert.equal(readHousePick({ key: "decode", why: "" }, 2, [], { decode: 3 }), null);
  assert.equal(readHousePick({ key: "decode", why: "" }, 3, [], { decode: 3 }), "decode");
  const shown = JSON.parse(housePickInput({ request: "", business: null, files: [], voice: false, avoid: [], least: { decode: 5 } })) as { modeles: { key: string; fichiers: number[] }[] };
  assert.deepEqual(shown.modeles.find((m) => m.key === "decode")!.fichiers, [5, 12]);
});

test("the motion designer keeps a skill's code but for what her request needs", async () => {
  const { motionDesignerPrompt } = await import("./motion-scene.ts");
  assert.match(motionDesignerPrompt({ skill: true }).parts, /montage skill/);
  assert.match(motionDesignerPrompt({ skill: true }).parts, /Never remove, shrink or tame its signature moment/);
  assert.doesNotMatch(motionDesignerPrompt({ example: true }).parts, /montage skill/);
});

test("a skill without words of its own writes its title when Edith picked the model", async () => {
  const { mosaique } = await import("./skills/mosaique.ts");
  const { readSkillFill, skillFillInput } = await import("./skills.ts");
  const files = [{ id: "a", photo: true, seconds: 0 }];
  const answer = { fits: true, missing: "", shots: [{ file: "a", at: 0 }], texts: [], end: null, why: "" };
  // Her pick: as the model, no words.
  assert.ok(readSkillFill(mosaique, files, 4, answer));
  // Edith's pick: the form, never the silence.
  assert.equal(readSkillFill(mosaique, files, 4, answer, { wordsWanted: true }), null);
  const input = skillFillInput({ skill: mosaique, name: "Mosaïque", n: 4, files, business: {}, request: "", wordsWanted: true });
  assert.equal(input.textes[0]!.obligatoire, true);
});

test("a montage skill comes close to the length she asked for by its number of shots, then by its tempo", async () => {
  const { MONTAGE_SKILLS } = await import("./skill-library.ts");
  const { skillFit, skillLengths, skillTempos, TALK_MAX_SECONDS } = await import("./skills.ts");
  for (const skill of Object.values(MONTAGE_SKILLS)) {
    // A skill timed on her voice takes her length (45 s at most), never a count of shots or a tempo for it.
    if (skill.voice) {
      assert.deepEqual(skillLengths(skill), { min: 3, max: TALK_MAX_SECONDS }, skill.key);
      continue;
    }
    const [slow, fast] = skillTempos(skill);
    assert.ok(slow >= 60 && slow <= skill.bpm && fast <= 140 && fast >= skill.bpm, skill.key);
    const length = (fit: { n: number; bpm: number }) => skill.timeline(fit.n, { end: false, bpm: fit.bpm }).duration;
    const { min, max } = skillLengths(skill);
    assert.ok(min <= max, skill.key);
    // Past its ends: its fastest tempo and fewest shots, its slowest tempo and most.
    assert.equal(skillFit(skill, 0).bpm, fast, skill.key);
    assert.equal(length(skillFit(skill, 0)), min, skill.key);
    assert.equal(skillFit(skill, 999).bpm, slow, skill.key);
    assert.equal(length(skillFit(skill, 999)), max, skill.key);
    // Inside its own lengths: its own tempo, the closest count.
    const own = Array.from({ length: Math.max(skill.shots[1], skill.long ?? 0) - skill.shots[0] + 1 }, (_, k) => skill.timeline(skill.shots[0] + k, { end: false }).duration);
    const mid = (Math.min(...own) + Math.max(...own)) / 2;
    const fit = skillFit(skill, mid);
    const gap = Math.min(...own.map((d) => Math.abs(d - mid)));
    if (gap <= 1) {
      assert.equal(fit.bpm, skill.bpm, `${skill.key}: ${mid} s`);
      assert.equal(Math.abs(length(fit) - mid), gap, `${skill.key}: ${mid} s`);
    }
    // A third longer than its longest at its own tempo: slower, and closer to it than its own tempo could come.
    const long = Math.max(...own) * 1.3;
    const slower = skillFit(skill, long);
    assert.ok(slower.bpm < skill.bpm, `${skill.key}: ${long} s at ${slower.bpm} BPM`);
    assert.ok(Math.abs(length(slower) - long) < long - Math.max(...own), `${skill.key}: ${long} s, ${length(slower)} s`);
  }
});

test("a montage skill played at another tempo keeps its cuts on that tempo's beats and composes its music at it", async () => {
  const { MONTAGE_SKILLS } = await import("./skill-library.ts");
  const { skillPlan } = await import("./skills.ts");
  for (const skill of Object.values(MONTAGE_SKILLS)) {
    // A skill timed on her voice keeps its own tempo under her voice (its music only; her cuts are hers).
    if (skill.voice) continue;
    const n = skill.shots[0];
    const bpm = Math.max(60, Math.round(skill.bpm * 0.8));
    const own = skill.timeline(n, { end: false });
    const slower = skill.timeline(n, { end: false, bpm });
    // Every length counted in beats follows the tempo: about its ratio longer.
    assert.ok(Math.abs(slower.duration / own.duration - skill.bpm / bpm) < 0.15, `${skill.key}: ${own.duration} s → ${slower.duration} s`);
    const files = Array.from({ length: n }, (_, i) => ({ id: `f${i}`, photo: true, seconds: 0 }));
    const fill = { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: Object.fromEntries(skill.texts.map((t) => [t.slot, "Chez Lou"])), end: null };
    const plan = skillPlan({ skill, name: "Chez Lou", files, fill, bpm });
    assert.equal(plan.tempo, bpm, skill.key);
    assert.ok(Math.abs(plan.duration - slower.duration) < 0.05, `${skill.key}: ${plan.duration} s`);
  }
});

test("still shots get none of the engine's slow pushes, in a montage skill (its code moves them) or in the editor's plan", async () => {
  const { skillFor } = await import("./skill-library.ts");
  const { skillPlan } = await import("./skills.ts");
  const { finishPlan } = await import("./finish.ts");
  const skill = skillFor("decode")!;
  const n = skill.shots[0];
  const files = [{ id: "v", photo: false, seconds: 60 }];
  const fill = { shots: Array.from({ length: n }, (_, i) => ({ file: "v", at: i * 6 })), texts: { surtitre: "un samedi dans", titre: "le marais" }, end: null };
  const plan = skillPlan({ skill, name: "Chez Lou", files, fill });
  const still = { start: 0, end: 60, description: "", subject: "", energy: 1, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, camera: "static" };
  const facts = { clips: { v: { duration: 60, orientation: "landscape", summary: "", setting: "", lighting: "ok", shots: [still], best_moments: [], transcript: "", issues: [] } }, photos: {} } as never;
  const moved = (p: typeof plan) => p.segments.filter((s) => "move" in s && s.move && s.move !== "none").length;
  assert.equal(moved(finishPlan(plan, facts, { v: 60 })), 0);
  // The same shots in a plan of the editor's: as filmed too (Tristan, on the light zooms: « je trouve ça cheap »).
  const { skill: _skill, ...chain } = plan;
  assert.equal(moved(finishPlan(chain as typeof plan, facts, { v: 60 })), 0);
});

test("a model whose middle repeats reaches 30 s at its own tempo for a length she asks for, its default length unchanged", async () => {
  const { MONTAGE_SKILLS } = await import("./skill-library.ts");
  const { skillFit, skillShotCount } = await import("./skills.ts");
  for (const key of ["decode", "quatre-coins", "journee"]) {
    const skill = MONTAGE_SKILLS[key]!;
    const fit = skillFit(skill, 30);
    assert.equal(fit.bpm, skill.bpm, key);
    assert.ok(Math.abs(skill.timeline(fit.n, { end: false }).duration - 30) <= 1, `${key}: ${skill.timeline(fit.n, { end: false }).duration} s`);
    // From her files alone (no length asked for), never past its own most.
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 20 }));
    assert.equal(skillShotCount(skill, many), skill.shots[1], key);
  }
});

test("a Reel that follows a sound: its tempo, halved or doubled, and its cuts from the sound's first beat", async () => {
  const { soundTempo, soundLead, leadPlan } = await import("./sound-follow.ts");
  const { snapToTempo } = await import("./tempo.ts");
  const { planTimeline } = await import("./motion.ts");
  const { skillFor } = await import("./skill-library.ts");
  const { skillPlan } = await import("./skills.ts");
  const { buildReelProps } = await import("./motion.ts");
  // Its own tempo when it fits, else halved or doubled within 60 to 140, the nearest to the one wanted.
  assert.equal(soundTempo(96, 100), 96);
  assert.equal(soundTempo(150, 100), 75);
  assert.equal(soundTempo(70, 120), 140);
  assert.equal(soundTempo(70, 80), 70);
  // Its first beat within one of the Reel's beats; under a frame from a beat, none.
  assert.equal(soundLead(0.25, 120), 0.25);
  assert.equal(soundLead(1.2, 120), 0.2);
  assert.equal(soundLead(0.51, 120), 0);
  // A skill's plan held on its first image: its cuts all that much later, its composition starting then, held before.
  const skill = skillFor("decode")!;
  const files = Array.from({ length: 4 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 30 }));
  const fill = { shots: Array.from({ length: 9 }, (_, i) => ({ file: files[i % 4]!.id, at: 2 + Math.floor(i / 4) * 8 })), texts: { surtitre: "un samedi dans", titre: "le marais" }, end: null };
  const plan = skillPlan({ skill, name: "Chez Lou", files, fill, bpm: 120 });
  const led = leadPlan(plan, 0.25);
  assert.equal(led.beat_at, 0.25);
  assert.ok(Math.abs(led.duration - plan.duration - 0.25) < 0.01);
  const cuts = (p: typeof plan) => planTimeline(p).segments.slice(1).map((s) => s.start);
  cuts(plan).forEach((t, i) => assert.ok(Math.abs(cuts(led)[i]! - t - 0.25) < 0.04, `cut ${i}`));
  assert.equal(led.layers![0]!.from, 0.25);
  assert.equal(led.layers![0]!.hold_first, true);
  assert.ok(Math.abs(led.texts[0]!.from - plan.texts[0]!.from - 0.25) < 0.01);
  // Its first shot starts that much earlier in its video, so its first image is the same.
  const first = (p: typeof plan) => p.segments[0] as { in: number; out: number };
  assert.ok(Math.abs(first(plan).in - first(led).in - 0.25) < 0.01);
  // The render holds the composition's first image until it starts.
  const props = buildReelProps(led, { template: "libre", clipUrls: Object.fromEntries(files.map((f) => [f.id, `/${f.id}.mp4`])), photoIds: [], brand: { name: "Chez Lou" } });
  const layer = props.layers!.find((l) => l.compose)!;
  assert.equal(layer.holdFirst, true);
  assert.ok(layer.from >= 7 && layer.from <= 8);
  // The editor's plan: its grid starts at the sound's first beat, every cut on beat_at + k beats.
  const editor = {
    format: "9:16", duration: 6, template: "libre", tempo: 120, beat_at: 0.25, images: [], transitions: "cut", subtitles: false, music: null, texts: [],
    segments: [{ clip_id: "a", in: 0, out: 1.1, zoom: "none" }, { clip_id: "b", in: 0, out: 1.4, zoom: "none" }, { clip_id: "c", in: 0, out: 2, zoom: "none" }],
  } as never;
  const snapped = snapToTempo(editor, { a: 10, b: 10, c: 10 });
  for (const t of planTimeline(snapped).segments.slice(1).map((s) => s.start)) assert.ok(Math.abs(((t - 0.25) / 0.5) - Math.round((t - 0.25) / 0.5)) < 0.07, `${t} s on a beat from 0.25`);
});

test("a skill's settings: her words choose them, the code reads them, a correction keeps them", async () => {
  const { mosaique } = await import("./skills/mosaique.ts");
  const { readSkillFill, skillPlan, skillSettings, mergeSkillSettings, skillFillInput } = await import("./skills.ts");
  // Only its own settings at one of their choices; a default needs no saying.
  assert.deepEqual(skillSettings(mosaique, [{ name: "cases", value: "6x8" }, { name: "cases", value: "9x9" }, { name: "taille", value: "xl" }, { name: "ordre", value: "lecture" }]), { cases: "6x8" });
  const files = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 30 }));
  const answer = { fits: true, missing: "", shots: files.map((f) => ({ file: f.id, at: 2 })), texts: [], end: null, settings: [{ name: "cases", value: "6x8" }, { name: "vitesse", value: "lente" }], why: "" };
  const fill = readSkillFill(mosaique, files, 6, answer)!;
  assert.deepEqual(fill.settings, { cases: "6x8", vitesse: "lente" });
  const plan = skillPlan({ skill: mosaique, name: "Mosaïque", files, fill });
  // The code reads them by name; its timeline follows them (lente: four beats a picture instead of two).
  assert.equal(plan.layers![0]!.motion.texts!.cases, "6x8");
  assert.deepEqual(plan.skill?.settings, { cases: "6x8", vitesse: "lente" });
  const plain = skillPlan({ skill: mosaique, name: "Mosaïque", files, fill: { ...fill, settings: {} } });
  assert.ok(Math.abs(plan.duration - plain.duration * 2) < 0.1, `${plan.duration} s, ${plain.duration} s`);
  assert.equal(plain.skill?.settings, undefined);
  // A correction keeps them but what it asks; the original's asked again is the default back.
  assert.deepEqual(mergeSkillSettings(mosaique, { cases: "6x8", vitesse: "lente" }, [{ name: "vitesse", value: "rapide" }]), { cases: "6x8", vitesse: "rapide" });
  assert.deepEqual(mergeSkillSettings(mosaique, { cases: "6x8" }, [{ name: "cases", value: "3x4" }]), {});
  // The filler sees them, the default marked as the original's, and a correction's current ones.
  const input = skillFillInput({ skill: mosaique, name: "Mosaïque", n: 6, files, business: {}, request: "plus de cases", currentSettings: { cases: "6x8" } });
  assert.equal(input.reglages?.[0]?.nom, "cases");
  assert.match(input.reglages![0]!.choix[0]!, /par défaut/);
  assert.deepEqual(input.reglages_actuels, { cases: "6x8" });
});

test("a skill's objects: the filler names what lights up in her shot, the engine follows it, nothing named is none", async () => {
  const { frappe } = await import("./skills/frappe.ts");
  const { readSkillFill, skillPlan, skillObjectName, skillCode, skillFillInput } = await import("./skills.ts");
  const { objectsDrawn, objectPassages, drawsSubject } = await import("./subject.ts");
  // Plain English as the detector reads it; « none », empty or a word of one letter is no object.
  assert.equal(skillObjectName(" Shop Sign "), "shop sign");
  assert.equal(skillObjectName("every window"), "every window");
  assert.equal(skillObjectName("string lights!"), "string lights");
  assert.equal(skillObjectName("none"), null);
  assert.equal(skillObjectName(""), null);
  // Unnamed, its « @slot » is no object: nothing is followed, its code does without.
  assert.deepEqual(objectsDrawn(frappe.code), []);
  const named = skillCode(frappe, { lumieres: "shop sign", nuit: "neon sign" });
  assert.deepEqual(objectsDrawn(named), [{ shot: 1, name: "shop sign" }, { shot: 3, name: "neon sign" }]);
  // Its white passer-by is her subject: she is cut out too.
  assert.ok(drawsSubject(named));
  // The filler sees its object slots and what each looks for; its answer is kept by slot.
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 20, shows: i === 1 ? "la devanture avec son enseigne en lettres dorées" : "la rue" }));
  const input = skillFillInput({ skill: frappe, name: "Lieu tapé", n: 15, files, business: {}, request: "" });
  assert.deepEqual(input.objets?.map((o) => o.slot), ["lumieres", "nuit"]);
  assert.equal(input.objets?.[0]?.case, 2);
  const answer = {
    fits: true,
    missing: "",
    shots: Array.from({ length: 15 }, (_, i) => ({ file: files[i % 8]!.id, at: 1 })),
    texts: [{ slot: "lieu", text: "Farine" }],
    end: null,
    objets: [{ slot: "lumieres", name: "Bakery sign" }, { slot: "nuit", name: "" }],
    why: "",
  };
  const fill = readSkillFill(frappe, files, 15, answer)!;
  assert.deepEqual(fill.objects, { lumieres: "bakery sign" });
  const plan = skillPlan({ skill: frappe, name: "Lieu tapé", files, fill });
  const passages = objectPassages(plan, () => true);
  assert.equal(passages.length, 1);
  assert.equal(passages[0]!.name, "bakery sign");
  // On the passage of its shot 2 (index 1): the closer shot.
  const second = plan.segments[1] as ClipSegment;
  assert.equal(passages[0]!.clip_id, second.clip_id);
  assert.equal(passages[0]!.from, second.in);
});

test("« Lieu tapé » cuts where its original does, on its own music (82,5 BPM)", async () => {
  const { frappe } = await import("./skills/frappe.ts");
  const line = frappe.timeline(15, { end: false });
  // The original's cuts (s), measured image by image (docs/fiches/frappe.md): within two images each.
  const original = [0, 1.6, 4.867, 7.867, 8.4, 8.6, 8.767, 8.967, 10.167, 11.6, 11.767, 11.933, 12.133, 12.267, 12.433];
  line.shots.forEach((s, i) => assert.ok(Math.abs(s.start - original[i]!) <= 2 / 30 + 1e-6, `shot ${i + 1}: ${s.start} s, the original's ${original[i]} s`));
  assert.ok(Math.abs(line.duration - 13.35) < 0.1, `${line.duration} s`);
  // Everything lights up at once on the original's image 130, the night shot blinks on its image 241.
  assert.ok(Math.abs(line.marks.flash! - 130) <= 1);
  assert.ok(Math.abs(line.marks.blink! - 241) <= 1);
  assert.equal(line.marks.type, 164);
  // What belongs to the original's brand is left to it: no In-N-Out arrow, no yellow of its own.
  assert.ok(!/ffcc00|strokeDasharray/i.test(frappe.code));
  // Its quick zoom lands on the closer shot's first image (the original's images 46 to 51 straddle it).
  assert.equal(line.marks.zoom, Math.round(line.shots[1]!.start * 30));
  // Her name types in the clear area of her sky shot (its sky first), read on that shot only.
  const { clearsDrawn } = await import("./subject.ts");
  assert.deepEqual(clearsDrawn(frappe.code), [2]);
  // Its music stops dead four images before the end, as the original's; it adds no sound its original has not.
  assert.ok(Math.abs(line.music!.end!.at - (line.duration - 4 / 30)) < 0.01);
  assert.equal(line.sounds, undefined);
  // A piece comes out at its own light, the rest dimmed: never pushed into white (a lit neon burnt into blots).
  assert.ok(!/brightness\(1\.[6-9]/.test(frappe.code));
  assert.ok(/background: "#000000", opacity: dimK/.test(frappe.code));
});

test("« Photo dump » frames a video wider than 4:3 at 4:3, its original's widest picture", async () => {
  const { photoDump } = await import("./skills/photo-dump.ts");
  assert.equal(photoDump.version, 2);
  assert.ok(/Math\.min\(4 \/ 3, Number\(s\.aspect\)/.test(photoDump.code));
  assert.ok(!/Math\.min\(2\.4/.test(photoDump.code));
});

test("« Lieu tapé » in the catalogue: her colour, not its original's orange", async () => {
  const { houseModel } = await import("./house-models.ts");
  const model = houseModel("frappe")!;
  assert.ok(!model.look.colors?.length);
  assert.ok(!/orange/i.test(JSON.stringify(model)));
});

// ---------------------------------------------------------------------------
// A model's music shaped as its original's (pauses, muffled passages, its end) and its own sound effects.
// ---------------------------------------------------------------------------

test("a model's music shape: read on the Reel, kept on the plan, shaped on its own samples by the mix", async () => {
  const { readMusicShape, musicShapeGraph, shiftMusicShape, musicEnvelope, shapesMusic } = await import("./music-shape.ts");
  // In order, two that touch are one, one at the very start is a late start, nothing shaped after its end.
  assert.deepEqual(
    readMusicShape({ pauses: [{ from: 5, to: 5.5 }, { from: 0.01, to: 0.5 }, { from: 5.505, to: 6 }, { from: 7.9, to: 8 }, { from: 3, to: 3.01 }], end: { at: 7.5 } }, 8),
    { pauses: [{ from: 0, to: 0.5 }, { from: 5, to: 6 }], end: { at: 7.5, fade: 0.012 } },
  );
  // Filtered passages one after the other (the next one once the previous has opened), within the Reel; two of a kind that touch, one.
  assert.deepEqual(readMusicShape({ filters: [{ kind: "radio", from: 2, to: 6 }, { kind: "muffled", from: 5, to: 9 }] }, 8), {
    filters: [{ kind: "radio", from: 2, to: 6, open: 0.02 }, { kind: "muffled", from: 6.02, to: 8, open: 0.02 }],
  });
  assert.deepEqual(readMusicShape({ filters: [{ kind: "muffled", from: 0, to: 2 }, { kind: "muffled", from: 2, to: 3, open: 3 }] }, 8), { filters: [{ kind: "muffled", from: 0, to: 3, open: 3 }] });
  // No music at all stands alone; nothing left, no shape.
  assert.deepEqual(readMusicShape({ none: true, pauses: [{ from: 1, to: 2 }] }, 8), { none: true });
  assert.equal(readMusicShape({ pauses: [{ from: 9, to: 10 }] }, 8), null);
  assert.equal(shapesMusic({ none: true }), false);
  // Kept on the plan (bounded), never in the editor's answer.
  const { editorOutputSchemaLegacy } = await import("./editor.ts");
  assert.ok(!("music_shape" in editorOutputSchemaLegacy.shape.plan.shape));
  const plan = {
    format: "9:16", duration: 8, template: "libre", segments: [{ clip_id: "a", in: 0, out: 8, zoom: "none" }], texts: [], images: [], transitions: "cut", subtitles: false, music: null,
  };
  assert.ok(editPlanSchema.safeParse({ ...plan, music_shape: { pauses: [{ from: 2, to: 2.5 }], filters: [{ kind: "muffled", from: 0, to: 2 }], end: { at: 7.5 } } }).success);
  assert.ok(!editPlanSchema.safeParse({ ...plan, music_shape: { filters: [{ kind: "underwater", from: 0, to: 2 }] } }).success);
  // Sample accurate: a one-beat stop at 120 BPM (2 s to 2,5 s) silent from sample 88 200, back from 110 030 (5 ms of fade
  // before the beat), the music cut dead at 7,5 s (its last 12 ms faded), a muffled intro closed into the dry sound.
  const graph = musicShapeGraph({ pauses: [{ from: 2, to: 2.5 }], filters: [{ kind: "muffled", from: 0, to: 4 }], end: { at: 7.5 } }, "in", "out", 8);
  assert.match(graph, /^\[in\]asplit=2\[ms_dry\]\[ms_muffled\];/);
  assert.match(graph, /\[ms_muffled\]lowpass=f=1300\[ms_muffledf\]/);
  assert.match(graph, /\[ms_dryk\]\[ms_muffledk\]amix=inputs=2:normalize=0\[ms_filtered\]/);
  assert.match(graph, /atrim=end_sample=88200,asetpts=PTS-STARTPTS,afade=t=out:ss=87979:ns=221\[ms_paused_k0\]/);
  assert.match(graph, /anullsrc=r=44100:cl=stereo,atrim=end_sample=21830\[ms_paused_z1\]/);
  assert.match(graph, /atrim=start_sample=110030,asetpts=PTS-STARTPTS,afade=t=in:ns=220\[ms_paused_k1\]/);
  assert.match(graph, /\[ms_paused\]afade=t=out:ss=330221:ns=529\[ms_ended\];\[ms_ended\]anull\[out\]$/);
  // A pause to the end: silent to the end of the Reel (and half a second more), the mix never shorter than the video.
  assert.match(musicShapeGraph({ pauses: [{ from: 6, to: 8 }] }, "in", "out", 8), /anullsrc=r=44100:cl=stereo,atrim=end_sample=110250\[ms_paused_zend\]/);
  assert.equal(musicShapeGraph({ none: true }, "in", "out", 8), "[in]anull[out]");
  // In the mix: shaped before anything joins it; its own end replaces the mix's fade (its last 20 ms only).
  const gains = mixGains({ speech: null, music: -15 }, false);
  const shaped = mixFilter(gains, 7.2, [], { shape: { pauses: [{ from: 2, to: 2.5 }], end: { at: 7.5 } }, duration: 8 });
  assert.match(shaped, /^\[1:a\]aformat=sample_rates=44100:channel_layouts=stereo,volume=1dB\[ms_in\];\[ms_in\]asplit=2/);
  assert.match(shaped, /\[ms_out\]anull,alimiter=limit=0\.891:level=false,afade=t=out:st=7\.980:d=0\.02\[a\]$/);
  // Without an end of its own, the mix's fade; without a shape, the mix as before.
  assert.match(mixFilter(gains, 7.2, [], { shape: { pauses: [{ from: 2, to: 2.5 }] }, duration: 8 }), /afade=t=out:st=7\.20:d=0\.8\[a\]$/);
  assert.equal(mixFilter(gains, 7.2, [], { shape: { none: true }, duration: 8 }), mixFilter(gains, 7.2));
  const ducked = mixFilter(mixGains({ speech: -20, music: -15 }, false), 7.2, [], { shape: { pauses: [{ from: 2, to: 2.5 }] }, duration: 8 });
  assert.match(ducked, /\[ms_out\]anull\[m\];\[m\]\[key\]sidechaincompress/);
  // Later with the Reel's first image held (a sound she follows): a late start still starts at 0.
  assert.deepEqual(shiftMusicShape({ pauses: [{ from: 0, to: 0.5 }, { from: 2, to: 2.5 }], end: { at: 7.5, fade: 0.012 } }, 0.2), {
    pauses: [{ from: 0, to: 0.7 }, { from: 2.2, to: 2.7 }],
    end: { at: 7.7, fade: 0.012 },
  });
  // The live preview: silent in its pauses and after its end (its filters are the render's).
  assert.deepEqual(musicEnvelope({ pauses: [{ from: 0, to: 0.5 }, { from: 2, to: 2.5 }], end: { at: 7.5 } }, 8, 30), [
    [0, 0], [14, 0], [15, 1], [59, 1], [60, 0], [74, 0], [75, 1], [224, 1], [225, 0], [241, 0],
  ]);
  assert.deepEqual(musicEnvelope({ filters: [{ kind: "radio", from: 0, to: 2 }] }, 8, 30), []);
  const props = buildReelProps({ ...plan, music_shape: { pauses: [{ from: 2, to: 2.5 }] } } as EditPlan, { template: "libre", clipUrls: { a: "https://x/a.mp4" }, brand: { name: "Studio" }, soundtrack: "https://x/m.mp3" });
  assert.deepEqual(props.soundtrack?.envelope, [[59, 1], [60, 0], [74, 0], [75, 1]]);
});

test("a skill's sound effects: on their own moments, all kept a frame apart at any level but off, at their own gain", async () => {
  const { planCues, pickCues, placeSounds, sfxGain } = await import("./sfx.ts");
  const plan = {
    duration: 8,
    texts: [{ text: "CHEZ LOU", from: 1, to: 3, style: "hook" }],
    segments: [{ clip_id: "a", in: 0, out: 4 }, { clip_id: "b", in: 0, out: 4 }],
    sounds: [
      // A key click on each letter typed 6 images apart, the first on the text's own moment: never pulled onto it.
      ...[30, 36, 42, 48].map((f) => ({ at: f / 30, sound: "typewriter key click", seconds: 0.5, skill: true, gain: -4 })),
      { at: 4.1, sound: "soft whoosh", seconds: 1 },
    ],
  } as never;
  const cues = planCues(plan, [{ start: 0, length: 4 }, { start: 4, length: 4 }]);
  assert.deepEqual(cues.map((c) => [c.at, c.from, c.gain ?? 0]), [[1, "skill", -4], [1.2, "skill", -4], [1.4, "skill", -4], [1.6, "skill", -4], [4, "editor", 0]]);
  // All kept at the light level, one frame apart (not a quarter of a second), under speech too, lower; a free sound gives way near them.
  const many = [...[0, 1, 2, 3, 4, 5].map((f) => ({ at: 1 + Math.round((f / 30) * 1000) / 1000, skill: true })), { at: 1.3 }, { at: 1 + 1 / 60, skill: true }];
  const kept = pickCues(many, { level: "light", duration: 8, speech: [[1.25, 1.4]] });
  assert.deepEqual(kept.map((c) => [c.at, c.under]), [[1, false], [1.033, false], [1.067, false], [1.1, true], [1.133, true], [1.167, true]]);
  assert.deepEqual(pickCues(many, { level: "off", duration: 8, speech: [] }), []);
  // Its gain from its level's target, its peak still under -4 dBFS.
  assert.equal(sfxGain({ lufs: -30, peak: -20 }, "music", "light", false, -4), sfxGain({ lufs: -30, peak: -20 }, "music", "light") - 4);
  assert.equal(sfxGain({ lufs: -30, peak: -6 }, "music", "light", false, 6), 2);
  const library = { "typewriter key click@0.5": { lufs: -26, peak: -10, onset: 0.04, end: 0.12, hit: 0.045 } };
  const placed = placeSounds(cues, { level: "light", mix: "music", duration: 8, speech: [], library });
  assert.deepEqual(placed.map((p) => [p.at, p.gain]), [[0.995, 2], [1.195, 2], [1.395, 2], [1.595, 2]]);
});

test("« Plans fixes de cinéma » (v2, v3): a dry click on each word of its title as its code lays it, again on her words", async () => {
  const { plansFixes } = await import("./skills/plans-fixes.ts");
  const { skillPlan, replaySkillAudio, skillWordsOf } = await import("./skills.ts");
  const { leadPlan } = await import("./sound-follow.ts");
  // The original's words land on its images 14, 26, 41, 59 and 83 (docs/fiches/plans-fixes.md): its code within an
  // image since v3 (three in v2), and a click on each.
  const line = plansFixes.timeline(10, { end: false, words: { accroche: "The power of", titre: "Static shot" } });
  const frames = (line.sounds ?? []).map((s) => Math.round(s.at * 30));
  assert.deepEqual(frames, [14, 26, 42, 59, 84]);
  [14, 26, 41, 59, 83].forEach((f, i) => assert.ok(Math.abs(frames[i]! - f) <= 1, `word ${i + 1}: image ${frames[i]}, the original's ${f}`));
  assert.ok(line.sounds!.every((s) => s.sound === "light click" && s.seconds === 0.5));
  // Its lengths never follow her words; without them (its lengths, the filler's input), no sounds.
  const bare = plansFixes.timeline(10, { end: false });
  assert.equal(bare.sounds, undefined);
  assert.equal(bare.duration, line.duration);
  // On the plan: its sounds, its own, valid; at another tempo, they follow its beats.
  const files = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 }));
  const fill = { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { accroche: "un soir à", titre: "Belleville" }, end: null };
  const plan = skillPlan({ skill: plansFixes, name: "Plans fixes", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.sounds?.map((s) => [Math.round(s.at * 30), s.sound, s.skill]), [[14, "light click", true], [26, "light click", true], [42, "light click", true], [59, "light click", true]]);
  // Since v3, its music dies away over its last beat and stops with the picture, as its original's.
  assert.deepEqual(plan.music_shape, { end: { at: plan.duration, fade: 0.93 } });
  const slower = skillPlan({ skill: plansFixes, name: "Plans fixes", files, fill, bpm: 60 });
  assert.equal(Math.round(slower.sounds![1]!.at * 30), 28);
  // Her words changed by hand: a click on each of the new ones; another version or another cut keeps its own.
  assert.deepEqual(skillWordsOf(plansFixes, plan.texts), { accroche: "un soir à", titre: "Belleville" });
  const edited = { ...plan, texts: plan.texts.map((t) => (t.style === "hook" ? { ...t, text: "le canal Saint-Martin" } : t)) };
  assert.equal(replaySkillAudio(plansFixes, edited)?.sounds?.length, 6);
  assert.equal(replaySkillAudio(plansFixes, { ...edited, skill: { key: "plans-fixes", version: 2 } }), null);
  assert.equal(replaySkillAudio(plansFixes, { ...edited, duration: edited.duration + 1 }), null);
  // Held on its first image for a sound she follows: its clicks that much later, again the same on her words.
  const held = leadPlan(plan, 0.3);
  assert.deepEqual(held.sounds?.map((s) => s.at), plan.sounds!.map((s) => Math.round((s.at + 0.3) * 1000) / 1000));
  assert.deepEqual(replaySkillAudio(plansFixes, held)?.sounds?.map((s) => Math.round(s.at * 100)), held.sounds?.map((s) => Math.round(s.at * 100)));
});

// ——— Where a text can be set in her shot (ClearBox): the grid clear_area.py reads, the area apps/render/src/clear.ts chooses ———

/** A synthetic picture's grid, a string a row (« 2 » sky, « 1 » calm, « 0 » busy). */
const grid = (rows: string[], motion?: number[]) => ({ cols: rows[0]!.length, rows: rows.length, cells: rows.join(""), ...(motion ? { motion } : {}) });
/** A picture of `aspect` covering a box, centred, as the Reel's placer lays a video without a camera move. */
const cover = (aspect: number, laid: { left: number; top: number; width: number; height: number }) => {
  const frame = laid.width / laid.height;
  const dw = aspect > frame ? laid.height * aspect : laid.width;
  const dh = aspect > frame ? laid.height : laid.width / aspect;
  return (x: number, y: number) => [laid.left - (dw - laid.width) / 2 + x * dw, laid.top - (dh - laid.height) / 2 + y * dh] as const;
};
/** A 16:9 shot laid in frappe's horizontal frame (1080 × 608 at the top 656 of the Reel), and laid over the whole vertical frame. */
const WIDE = { left: 0, top: 0, width: 1080, height: 608 };
const FULL = { left: 0, top: 0, width: 1080, height: 1920 };

test("where a text can be set: the shots a composition names in ClearBox are read, a photo once, a video at its own pace", async () => {
  const { ANY_SHOT, clearKey, clearPassages, clearsDrawn, drawsSubject, objectsDrawn, wantsClear, CLEAR_MAX } = await import("./subject.ts");
  assert.deepEqual(clearsDrawn(`const a = ClearBox(shots[2], frame, laid, { aspect: 6 }); const b = ClearBox( 3 , f);`), [2, 3]);
  assert.deepEqual(clearsDrawn(`ClearBox(shots[i], frame, laid)`), [ANY_SHOT]);
  assert.deepEqual(clearsDrawn(`SubjectBox(shots[1], frame, laid)`), []);
  // It never cuts her out nor follows an object.
  assert.equal(drawsSubject(`ClearBox(shots[1], frame, laid)`), false);
  assert.deepEqual(objectsDrawn(`ClearBox(shots[1], frame, laid, { fallback: "x" })`), []);
  const plan = {
    segments: [
      { clip_id: "v0", in: 0, out: 2 },
      { clip_id: "v1", in: 1, out: 4 },
      { clip_id: "photo1", in: 0, out: 2, photo: { source: { width: 4, height: 3 } } },
      { clip_id: "v2", in: 0, out: 3, speed: 0.5 },
    ],
    layers: [{ from: 0, to: 10, brief: "", compose: true, motion: { js: `ClearBox(shots[1], frame, laid); ClearBox(shots[2], frame, laid); ClearBox(shots[3], frame, laid)` } }],
  } as never;
  assert.equal(wantsClear(plan), true);
  assert.equal(wantsClear({ layers: [{ from: 0, to: 2, brief: "", motion: { js: `SubjectBox(shots[0], f)` } }] } as never), false);
  // Its photo once, under its own key; the shot at half speed is left out (its camera's move would not match: the fallback).
  assert.deepEqual(clearPassages(plan, (id) => id.startsWith("v")), [
    { clip_id: "v1", from: 1, to: 4, key: clearKey("v1", 1, 4) },
    { clip_id: "photo1", from: 0, to: 0, key: clearKey("photo1", 0, 0), photo: true },
  ]);
  assert.match(clearKey("v1", 1, 4), /^v1@1\.00-4\.00~clear$/);
  // A shot written as a variable: every shot under the animation, CLEAR_MAX at most.
  const any = { ...(plan as object), layers: [{ from: 0, to: 3, brief: "", motion: { js: `ClearBox(shots[k], frame, laid)` } }] } as never;
  assert.deepEqual(clearPassages(any, (id) => id.startsWith("v")).map((p) => p.clip_id), ["v0", "v1"]);
  assert.ok(CLEAR_MAX >= 4);
});

test("where a text can be set: its grid kept in a file beside the clip, removed with it, given to the composition's shot", async () => {
  const { clearKey, clearMapSchema, mediaSubjectsSchema, subjectFiles } = await import("./subject.ts");
  const map = grid(["2200", "2200", "0011"]);
  assert.ok(clearMapSchema.safeParse(map).success);
  assert.equal(clearMapSchema.safeParse({ ...map, cells: "22001" }).success, false);
  assert.equal(clearMapSchema.safeParse({ ...map, cells: "2200220000a1" }).success, false);
  // Its entry is a reading like the others (an older deploy reads it too, and the retention removes its file).
  const kept = { [clearKey("v1", 1, 4)]: { path: "s/subjects/v1-abc.clear.json", still: true, at: "x", frames: 90, clear: true } };
  assert.ok(mediaSubjectsSchema.safeParse(kept).success);
  assert.deepEqual(subjectFiles(kept), ["s/subjects/v1-abc.clear.json"]);
  const plan = {
    format: "9:16",
    duration: 3,
    template: "libre",
    segments: [{ clip_id: "v1", in: 1, out: 4, zoom: "none" }],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    layers: [{ from: 0, to: 3, brief: "", compose: true, motion: { js: `function Scene({ shots }) { const b = ClearBox(shots[0], 0, undefined, { fallback: null }); return null; }` } }],
  } as never;
  const props = buildReelProps(plan, { template: "libre", clipUrls: { v1: "https://x/v1.mp4" }, brand: { name: "Studio" }, subjects: { [clearKey("v1", 1, 4)]: { src: "", clear: map } } } as never);
  assert.deepEqual(props.layers?.[0]?.shots?.[0]?.clear, map);
  // Never taken for her cut-out or an object of the shot.
  const segment = props.segments[0] as { subject?: unknown; objects?: unknown };
  assert.equal(segment.subject, undefined);
  assert.equal(segment.objects, undefined);
  // An animation over the montage that calls it gets the shots under it.
  const over = buildReelProps({ ...(plan as object), layers: [{ from: 0, to: 3, brief: "", motion: { js: `ClearBox(shots[0], frame, laid)` } }] } as never, {
    template: "libre",
    clipUrls: { v1: "https://x/v1.mp4" },
    brand: { name: "Studio" },
    subjects: { [clearKey("v1", 1, 4)]: { src: "", clear: map } },
  } as never);
  assert.deepEqual(over.layers?.[0]?.shots?.[0]?.clear, map);
});

test("the clear area: the sky beside the towers and never on them, the largest, the upper part first, off the busy cells", async () => {
  const { affineOf, chooseClear, clearRoom, placeClear } = await import("../../../apps/render/src/clear.ts");
  // A white sky over a city, two towers in the middle (columns 7 and 8), trees on the right from row 3, a plain wall
  // low on the left, the ground at the bottom (a 16:9 picture, 16 × 9 cells).
  const city = grid([
    "2222222002222222",
    "2222222002222222",
    "2222222002222222",
    "2222222002200000",
    "2222222000000000",
    "0000000000000000",
    "1111100000000000",
    "1111100000000000",
    "0000000000000000",
  ]);
  const place = affineOf(cover(16 / 9, WIDE));
  const room = clearRoom(WIDE, undefined, { x: 0, y: 656 });
  const free = chooseClear(city, () => place, 90, room)!;
  const box = placeClear(free, place);
  // The sky left of the towers (cells of 67.6 px), less the safe zone's 40 px on the left, its pad (12 px) and the
  // room's off the box's edges (12 px): columns 1 to 6, rows 1 to 4.
  const cell = 608 / 9;
  assert.ok(box.x >= 52 && box.x + box.w <= 7 * cell, JSON.stringify(box));
  assert.ok(box.y >= 12 && box.y + box.h <= 5 * cell, JSON.stringify(box));
  assert.ok(box.w > 370 && box.h > 240, JSON.stringify(box));
  // A one-line name (6 times wider than tall): in the sky, on one side of the towers, in its upper part.
  const name = placeClear(chooseClear(city, () => place, 90, room, { aspect: 6 })!, place);
  assert.ok(Math.abs(name.w / name.h - 6) < 0.01);
  assert.ok(name.x + name.w <= 7 * cell || name.x >= 9 * cell, JSON.stringify(name));
  assert.ok(name.y < 2 * cell, JSON.stringify(name));
  // Its size: no larger than max, its shape kept, in the middle of the sky it found.
  const capped = placeClear(chooseClear(city, () => place, 90, room, { aspect: 6, max: { w: 300 } })!, place);
  assert.ok(Math.abs(capped.w - 300) < 0.5 && Math.abs(capped.h - 50) < 0.5, JSON.stringify(capped));
  // Too large a minimum: none (the composition takes its fallback).
  assert.equal(chooseClear(city, () => place, 90, room, { min: { w: 700 } }), null);
  // Any calm area alike, in the lower part first, at a size both can hold: the plain wall low on the left.
  const low = placeClear(chooseClear(city, () => place, 90, room, { sky: false, prefer: "bottom", aspect: 2, max: { w: 220 } })!, place);
  assert.ok(low.y > 6 * cell && low.x + low.w <= 5 * cell, JSON.stringify(low));
  // No sky large enough (a strip at the top): the calm wall instead.
  const strip = grid(["2222222222222222", "0000000000000000", "0000000000000000", "0000111111110000", "0000111111110000", "0000111111110000", "0000000000000000", "0000000000000000", "0000000000000000"]);
  const wall = placeClear(chooseClear(strip, () => place, 90, room, { min: { w: 200, h: 100 } })!, place);
  assert.ok(wall.y >= 3 * (608 / 9) - 0.5 && wall.x >= 4 * 67.5 - 0.5 && wall.x + wall.w <= 12 * 67.5 + 0.5, JSON.stringify(wall));
});

test("the clear area: in the part of her picture the box shows, inside the Reel's safe zone, off her faces", async () => {
  const { affineOf, chooseClear, clearRoom, placeClear, readableMap } = await import("../../../apps/render/src/clear.ts");
  // A 16:9 picture laid over the vertical frame shows its middle third only: the sky on its left is out of the box.
  const left = grid(["2222200000000000", "2222200000000000", "2222200022222000", "2222200022222000", "0000000022222000", "0000000000000000", "1111111111111111", "1111111111111111", "1111111111111111"]);
  const place = affineOf(cover(16 / 9, FULL));
  const room = clearRoom(FULL);
  const box = placeClear(chooseClear(left, () => place, 60, room)!, place);
  // The sky in the middle columns (8 to 12, of which the box shows 6 to 10), never the bottom's calm floor (under 0.75 of the height).
  assert.ok(box.x >= 40 && box.x + box.w <= 1040 && box.y >= 80 && box.y + box.h <= 1440, JSON.stringify(box));
  assert.ok(box.y < 5 * (1920 / 9), JSON.stringify(box));
  // Only a calm floor at the bottom: nothing (the apps' interface covers it).
  const floor = grid(["0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "1111111111111111", "1111111111111111"]);
  assert.equal(chooseClear(floor, () => place, 60, room), null);
  // The whole box (within: null) takes it.
  assert.ok(chooseClear(floor, () => place, 60, clearRoom(FULL, null)));
  // Her face in the middle of an even wall: the area keeps off it.
  const even = grid(Array.from({ length: 9 }, () => "1111111111111111"));
  const face = { x: 0.4, y: 0.2, w: 0.2, h: 0.4 };
  const off = chooseClear(even, () => affineOf(cover(16 / 9, WIDE)), 60, clearRoom(WIDE, undefined, { x: 0, y: 656 }), { avoid: [face] })!;
  assert.ok(off.x + off.w <= face.x + 1e-9 || off.x >= face.x + face.w - 1e-9 || off.y + off.h <= face.y + 1e-9 || off.y >= face.y + face.h - 1e-9, JSON.stringify(off));
  // A grid that cannot be read is no grid.
  assert.equal(readableMap({ cols: 4, rows: 2, cells: "2222" }), false);
  assert.equal(readableMap(undefined), false);
});

test("the clear area follows the camera: the same place of the scene at every image, never out of the box", async () => {
  const { affineOf, cameraAt, chooseClear, clearRoom, placeClear, withCamera } = await import("../../../apps/render/src/clear.ts");
  // The camera pans right: the scene moves left by 10 % of the picture over 31 images.
  const motion = Array.from({ length: 31 }, (_, t) => [1, (-0.1 * t) / 30, 0]).flat();
  const sky = grid(["2222222222222222", "2222222222222222", "2222222222222222", "2222222222222222", "0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000"], motion);
  assert.deepEqual(cameraAt(sky, 30), [1, -0.1, 0]);
  assert.deepEqual(cameraAt(sky, 99), [1, -0.1, 0]);
  assert.deepEqual(cameraAt({ ...sky, motion: undefined }, 5), [1, 0, 0]);
  const place = affineOf(cover(16 / 9, WIDE));
  const project = (t: number) => withCamera(place, cameraAt(sky, t));
  const area = chooseClear(sky, project, 31, clearRoom(WIDE, undefined, { x: 0, y: 656 }))!;
  const first = placeClear(area, project(0));
  const last = placeClear(area, project(30));
  // It moves with the scene, 108 px left, and stays in the box (less its pad) at both ends.
  assert.ok(Math.abs(first.x - last.x - 108) < 0.5 && Math.abs(first.y - last.y) < 0.01, JSON.stringify([first, last]));
  assert.ok(last.x >= 12 && first.x + first.w <= 1080 - 12, JSON.stringify([first, last]));
  // A push in (scale 1.2 about the centre) enlarges it with the picture.
  const pushed = withCamera(place, [1.2, 0, 0]);
  const near = placeClear({ x: 0.45, y: 0.45, w: 0.1, h: 0.1 }, pushed);
  assert.ok(Math.abs(near.w - 0.12 * 1080) < 0.5 && Math.abs(near.x + near.w / 2 - 540) < 0.5, JSON.stringify(near));
});

// ——— « Plans fixes de cinéma » v3, written again on its original's fiche (docs/fiches/plans-fixes.md) ———————————————

/** What a composition's Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
function drawScene(code: string, frame: number, props: Record<string, unknown>): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const interpolate = (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1)));
  // ClearBox gives its fallback, as in the scene check (no clear area read here).
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    useCurrentFrame: () => frame,
    interpolate,
    ClearBox: (_shot: unknown, _frame: number, _laid: unknown, options?: { fallback?: unknown }) => options?.fallback ?? null,
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
/** Every node of a drawn tree, depth first. */
const drawnNodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(drawnNodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(drawnNodes)];
};
/** The words right under a node (its strings, at any depth of its arrays), and all those it holds. */
const drawnText = (node: Drawn): string => (node.children.flat(Infinity) as unknown[]).filter((c): c is string => typeof c === "string").join("");
const heldText = (node: Drawn): string => drawnNodes(node).map(drawnText).join(" ");
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;

/** Her shots as a composition gets them: n of that shape (width / height), a beat (27.864 images) each from image 125. */
const composeShots = (aspects: number[]) => aspects.map((aspect, i) => ({ src: `/v${i}.mp4`, aspect, from: i ? 125 + (i - 1) * 28 : 0, durationInFrames: i ? 28 : 125, kind: "video", segment: i }));

test("« Plans fixes de cinéma » (v3) cuts where its original does, on its own music (64,6 BPM), its words on its beats", async () => {
  const { plansFixes, wordFrames } = await import("./skills/plans-fixes.ts");
  const { clearsDrawn, objectsDrawn } = await import("./subject.ts");
  assert.equal(plansFixes.version, 3);
  assert.equal(plansFixes.bpm, 64.6);
  const line = plansFixes.timeline(9, { end: false, words: { accroche: "The power of", titre: "Static shot" } });
  // The original's nine shots, cut on its images 125, 155, 183, 210, 236, 265, 293 and 319 (measured image by image at
  // 30 i/s): within two images each, on its own music's beats; its last shot held two beats, to its 12,5 s.
  const original = [0, 125, 155, 183, 210, 236, 265, 293, 319];
  assert.equal(line.shots.length, original.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - original[i]!) <= 2, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${original[i]}`));
  assert.ok(Math.abs(line.duration - 12.5) < 0.1, `${line.duration} s`);
  // Its title from its music's first beat (image 14, half a beat in) to the first cut; a click on each word, within an
  // image of the original's (14, 26, 41, 59 and 83).
  assert.equal(Math.round(line.texts.accroche!.from * 30), 14);
  assert.equal(line.texts.titre!.to, line.shots[1]!.start);
  const clicks = (line.sounds ?? []).map((s) => Math.round(s.at * 30));
  [14, 26, 41, 59, 83].forEach((f, i) => assert.ok(Math.abs(clicks[i]! - f) <= 1, `word ${i + 1}: image ${clicks[i]}, the original's ${f}`));
  assert.deepEqual(wordFrames(3, 2, 14, 27.864), clicks);
  // Its closing line fades in from the original's image 342 over its 19 images; its music dies away over the last beat.
  assert.ok(Math.abs(line.marks.close! - 342) <= 1, `${line.marks.close}`);
  assert.equal(line.marks.close_in, 19);
  assert.deepEqual(line.music, { end: { at: line.duration, fade: 0.93 } });
  // With an ending card, its last shot held whole beats longer (the card's 1,6 s), its cuts the same.
  const ended = plansFixes.timeline(9, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), plansFixes.timeline(9, { end: false }).shots.slice(0, -1));
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs(((ended.duration - line.duration) * 64.6) / 60 - 2) < 0.05, `${ended.duration} s`);
  // The camera never moves in these still shots: no push, no zoom, nothing turned (Tristan, of the light zooms: « cheap »).
  assert.doesNotMatch(plansFixes.code, /transform|scale\(/);
  // Its title is set on a calm area of her first shot (read there only); nothing is cut out.
  assert.deepEqual(clearsDrawn(plansFixes.code), [0]);
  assert.deepEqual(objectsDrawn(plansFixes.code), []);
  // Its finish keeps each shot in the light of its hour: no warmth, grain nor corners laid over everything.
  assert.deepEqual(plansFixes.finish, { contrast: 0.1, saturation: 0.08, warmth: 0, grain: 0, vignette: 0 });
  // Its code lays each word on the frame its click lands on.
  const reelTexts = [
    { text: "The power of", role: "caption", from: 14, to: 125, emphasis: [] },
    { text: "Static shot", role: "hook", from: 14, to: 125, emphasis: [] },
  ];
  const marks = { beat: "27.864", close: "343", close_in: "19" };
  const shown = new Map<string, number>();
  for (let f = 0; f < 125; f++) {
    const tree = drawScene(plansFixes.code, f, { width: 1080, height: 1920, durationInFrames: 376, brand: { name: "Atelier Rose", displayFont: "Lora", bodyFont: "Poppins" }, shots: composeShots(Array(9).fill(16 / 9)), reelTexts, end: null, texts: marks });
    for (const n of drawnNodes(tree)) if (n.type === "span" && styleOf(n).opacity === 1 && !shown.has(drawnText(n))) shown.set(drawnText(n), f);
  }
  assert.deepEqual(["The", "power", "of", "Static", "shot"].map((w) => shown.get(w)), clicks);
});

test("« Plans fixes de cinéma » (v3): horizontal 4:3 on black as its original when her files are, full frame otherwise or on her word", async () => {
  const { plansFixes } = await import("./skills/plans-fixes.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const reelTexts = [
    { text: "les bouquets du jour", role: "caption", from: 14, to: 125, emphasis: [] },
    { text: "faits à la main", role: "hook", from: 14, to: 125, emphasis: [] },
  ];
  const draw = (aspects: number[], frame: number, extra: Record<string, unknown> = {}) =>
    drawScene(plansFixes.code, frame, { width: 1080, height: 1920, durationInFrames: 460, brand: { name: "Atelier Rose", displayFont: "Lora", bodyFont: "Poppins" }, shots: composeShots(aspects), reelTexts, end: null, texts: { beat: "27.864", close: "400", close_in: "19" }, ...extra });
  /** Its frame (the box its shots are laid in) and the shot laid in it. */
  const frameOf = (tree: Drawn) => {
    const box = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!;
    const footage = drawnNodes(box).find((n) => n.type === "Footage")!;
    return { top: styleOf(box).top, height: styleOf(box).height, shot: styleOf(footage) };
  };
  const wide = Array(12).fill(16 / 9);
  const tall = Array(12).fill(9 / 16);
  // Her files mostly horizontal: the original's 4:3 picture (1080 × 810) at the middle of the frame, on black; a 16:9
  // video covers it (an eighth of each side cut, on its subject).
  assert.deepEqual(frameOf(draw(wide, 60)), { top: 555, height: 810, shot: { position: "absolute", left: 0, top: 0, width: 1080, height: 810 } });
  assert.equal(frameOf(draw([...Array(7).fill(16 / 9), ...Array(5).fill(9 / 16)], 60)).height, 810);
  // Mostly vertical (half and half too): full frame.
  assert.deepEqual(frameOf(draw(tall, 60)), { top: 0, height: 1920, shot: { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 } });
  assert.equal(frameOf(draw([...Array(6).fill(16 / 9), ...Array(6).fill(9 / 16)], 60)).height, 1920);
  // On her word, the other format.
  assert.equal(frameOf(draw(wide, 60, { texts: { beat: "27.864", close: "400", close_in: "19", format: "vertical" } })).height, 1920);
  assert.equal(frameOf(draw(tall, 60, { texts: { beat: "27.864", close: "400", close_in: "19", format: "horizontal" } })).top, 555);
  // Its title at the very middle of its picture in both formats (ClearBox's fallback: no clear area read here), its
  // small words a label over its serif; its lines in the safe zone, left of the apps' buttons.
  for (const aspects of [wide, tall]) {
    const tree = draw(aspects, 100);
    const { top } = frameOf(tree);
    const boxes = drawnNodes(tree).filter((n) => n.type === "FitText").map((n) => n.props.style as { left: number; top: number; width: number; height: number });
    assert.equal(boxes.length, 2);
    const [kicker, serif] = boxes as [(typeof boxes)[number], (typeof boxes)[number]];
    assert.ok(kicker.top + kicker.height <= serif.top, JSON.stringify(boxes));
    assert.ok(Math.abs(kicker.left + kicker.width / 2 - 540) <= 1 && Math.abs(serif.left + serif.width / 2 - 540) <= 1, JSON.stringify(boxes));
    assert.ok(Math.abs(Number(top) + (kicker.top + serif.top + serif.height) / 2 - 960) <= 2, JSON.stringify(boxes));
    for (const b of boxes) assert.ok(b.left >= 140 && b.left + b.width <= 940, JSON.stringify(b));
    assert.ok(drawnNodes(tree).some((n) => "data-fauve-accent" in n.props && heldText(n).includes("bouquets")));
  }
  // Its closing line: her name small at the middle of its last shot, fading in over 19 images, no veil; her ending
  // card's words when she has some.
  const closing = (tree: Drawn, words: string) => drawnNodes(tree).find((n) => n.type === "span" && drawnText(n) === words);
  assert.equal(closing(draw(wide, 399), "Atelier Rose"), undefined);
  assert.equal(styleOf(closing(draw(wide, 400), "Atelier Rose")!).opacity, 0);
  assert.equal(styleOf(closing(draw(wide, 419), "Atelier Rose")!).opacity, 1);
  assert.equal(drawnNodes(draw(wide, 430)).filter((n) => n.type === "div" && /rgba/.test(String(styleOf(n).backgroundColor ?? ""))).length, 0);
  const card = draw(wide, 430, { end: { title: "Réserve ton bouquet", subtitle: null, from: 412 } });
  assert.equal(styleOf(closing(card, "Réserve ton bouquet")!).opacity, 1);
  assert.equal(closing(card, "Atelier Rose"), undefined);
  // The setting: the filler sees it (the original's first, the default), the plan keeps a choice her words asked for.
  assert.deepEqual(plansFixes.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(plansFixes, [{ name: "format", value: "auto" }]), {});
  const files = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: plansFixes, name: "Plans fixes", n: 9, files, business: {}, request: "en vertical" });
  assert.equal(input.reglages?.[0]?.nom, "format");
  const plan = skillPlan({ skill: plansFixes, name: "Plans fixes", files, fill: { shots: Array.from({ length: 9 }, (_, i) => ({ file: files[i % 6]!.id, at: 1 })), texts: { accroche: "un soir à", titre: "Belleville" }, end: null, settings: { format: "vertical" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
  assert.deepEqual(plan.skill, { key: "plans-fixes", version: 3, settings: { format: "vertical" } });
});

// ——— « Une journée chez toi » v2, written again on its original's fiche (docs/fiches/journee.md) ———————————————————

/**
 * A skill's composition run at one frame with a stand-in scope (each kit piece a named element, SubjectParts given), its
 * tree returned: what its code lays and where, without a browser.
 */
function sceneAt(code: string, frame: number, props: Record<string, unknown>, parts: { x: number; y: number; w: number; h: number }[] = []): Drawn {
  const h = (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() });
  const interpolate = (x: number, [a, b]: number[], [c, d]: number[]) => c! + (d! - c!) * Math.min(1, Math.max(0, (x - a!) / (b! - a! || 1)));
  const scope: Record<string, unknown> = { React: { createElement: h, Fragment: "Fragment" }, useCurrentFrame: () => frame, interpolate, AbsoluteFill: "AbsoluteFill", Footage: "Footage", FitText: "FitText", SubjectParts: () => parts, Flash: "Flash", Burn: "Burn", WindowStar: "WindowStar" };
  const Scene = new Function(...Object.keys(scope), `${code}\nreturn Scene;`)(...Object.values(scope)) as (p: unknown) => Drawn;
  return Scene({ width: 1080, height: 1920, durationInFrames: 451, brand: { displayFont: "Bodoni Moda", bodyFont: "Jost" }, reelTexts: [], end: null, ...props });
}
/** Every element of a tree, depth first. */
const drawnIn = (node: unknown): Drawn[] => (node && typeof node === "object" && "children" in node ? [node as Drawn, ...(node as Drawn).children.flatMap(drawnIn)] : []);

test("« Une journée chez toi » (v2) cuts where its original does, on its own music (136,8 BPM), with its clicks and its muffled night", async () => {
  const { journee } = await import("./skills/journee.ts");
  const line = journee.timeline(22, { end: false });
  // The original's cuts (images at 30 i/s, docs/fiches/journee.md), the two under its bands where each band starts to
  // leave: within two images each.
  const original = [0, 5, 26, 44, 55, 75, 93, 106, 116, 135, 158, 191, 213, 240, 263, 273, 283, 293, 319, 344, 366, 393].map((f) => f / 30);
  assert.equal(line.shots.length, original.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(s.start - original[i]!) <= 2 / 30 + 1e-6, `shot ${i + 1}: ${s.start} s, the original's ${original[i]} s`));
  assert.ok(Math.abs(line.duration - 15.02) < 0.1, `${line.duration} s`);
  assert.equal(journee.bpm, 136.8);
  // Its flashes and its burns on the original's cuts, its walk jerky from its image 301, its bands over its images 26 and 44.
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => line.marks[`flash_${k}`]), [93, 106, 263, 273, 283]);
  assert.deepEqual([0, 1, 2].map((k) => line.marks[`burn_${k}`]), [191, 213, 293]);
  assert.ok(Math.abs(line.marks.jerky! - 301) <= 1);
  assert.deepEqual([line.marks.burst, line.marks.burst_to, line.marks.veil_a, line.marks.veil_b], [5, 19, 26, 44]);
  // Its title from the image after the second band's cut to the cut on her day (images 45 to 75).
  assert.deepEqual([line.texts.titre!.from, line.texts.titre!.to].map((t) => Math.round(t * 30)), [45, 75]);
  assert.deepEqual(line.texts.surtitre, line.texts.titre);
  // A shutter on the title and on each flash and burn, where the original's are heard (s), the second burn's the loudest.
  const heard = [1.51, 3.1, 3.55, 6.23, 6.33, 6.43, 7.08, 8.75, 9.06, 9.42, 9.75];
  assert.deepEqual(line.sounds!.map((s) => s.sound), heard.map(() => "camera shutter"));
  line.sounds!.forEach((s, i) => assert.ok(Math.abs(s.at - heard[i]!) <= 2 / 30, `click ${i + 1}: ${s.at} s, the original's ${heard[i]} s`));
  assert.ok(line.sounds![6]!.gain! > 0 && line.sounds![8]!.gain! < 0);
  // Its music muffled from the beat after the cut on the night (12,25 – 12,33 s), faded out over its last 1,7 s.
  const [muffled] = line.music!.filters!;
  assert.equal(muffled!.kind, "muffled");
  assert.ok(muffled!.from > 12.2 && muffled!.from <= 12.33 && muffled!.to === line.duration, JSON.stringify(muffled));
  assert.ok(Math.abs(line.music!.end!.fade! - 1.7) < 0.02 && Math.abs(line.music!.end!.at - 15) < 0.05);
  // At another tempo, all of it follows its beats.
  const slower = journee.timeline(22, { end: false, bpm: 100 });
  assert.ok(Math.abs(slower.marks.night! / line.marks.night! - 136.8 / 100) < 0.01);
  // Fewer files drop the shots of its day with nothing at their cut first (every flash and burn stays down to 18 shots);
  // more of them, moments held three beats, up to about 30 s.
  const fewer = journee.timeline(18, { end: false });
  assert.equal(Object.keys(fewer.marks).filter((k) => k.startsWith("flash_")).length, 5);
  assert.equal(Object.keys(fewer.marks).filter((k) => k.startsWith("burn_")).length, 3);
  assert.ok(Math.abs(journee.timeline(33, { end: false }).duration - 29.5) < 0.2);
});

test("« Une journée chez toi » (v2): horizontal 4:3 on black as its original when her videos are, her setting else", async () => {
  const { journee } = await import("./skills/journee.ts");
  const { skillCode } = await import("./skills.ts");
  const { drawsSubject, objectsDrawn } = await import("./subject.ts");
  const line = journee.timeline(22, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const shots = (aspect: number) => line.shots.map((s) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect }));
  const frameBox = (tree: Drawn) => tree.children[0] as Drawn;
  const style = (d: Drawn) => d.props.style as Record<string, number | string>;
  // Her videos in width (the Budapest bench: 16:9): its 4:3 frame, 1080 × 810 in the middle of the vertical frame.
  const wide = style(frameBox(sceneAt(journee.code, 100, { shots: shots(16 / 9), texts: marks })));
  assert.deepEqual([wide.top, wide.width, wide.height], [555, 1080, 810]);
  // Upright videos: the whole frame; her setting prevails both ways.
  const tall = style(frameBox(sceneAt(journee.code, 100, { shots: shots(9 / 16), texts: marks })));
  assert.deepEqual([tall.top, tall.height], [0, 1920]);
  const asked = style(frameBox(sceneAt(journee.code, 100, { shots: shots(9 / 16), texts: { ...marks, format: "horizontal" } })));
  assert.deepEqual([asked.top, asked.height], [555, 810]);
  const upright = style(frameBox(sceneAt(journee.code, 100, { shots: shots(16 / 9), texts: { ...marks, format: "vertical" } })));
  assert.deepEqual([upright.top, upright.height], [0, 1920]);
  assert.deepEqual(journee.settings?.[0]?.choices.map((c) => c.value), ["auto", "horizontal", "vertical"]);
  // Its title red, centred a little under the middle of its frame (52 %), in it.
  const titled = sceneAt(journee.code, 60, { shots: shots(16 / 9), texts: marks, reelTexts: [{ text: "Paris", role: "hook", from: 45, to: 75 }, { text: "une journée à", role: "caption", from: 45, to: 75 }] });
  const fit = drawnIn(frameBox(titled)).find((d) => d.type === "FitText")!;
  assert.ok(Math.abs(Number(style(fit).top) + Number(style(fit).height) / 2 - 0.52 * 810) <= 1, JSON.stringify(style(fit)));
  assert.match(JSON.stringify(drawnIn((fit.children[0] as (scale: number) => Drawn)(1))), /#fa010c.*PARIS|PARIS.*#fa010c/s);
  // Things alike in its burst shot, each brought to the same place and size, one a film image: 49 % across, 21,5 % down.
  // Its 16:9 picture laid whole (1440 × 810 from 180 px left of the frame), so a piece off the 4:3 crop comes in too
  // (the first one here); one whose picture would then leave much of the frame black is left out (the last one).
  const parts = [...Array.from({ length: 10 }, (_, i) => ({ x: i ? 100 + i * 60 : -50, y: 160 + (i % 3) * 30, w: 60, h: 100 + (i % 2) * 20 })), { x: 1250, y: 700, w: 60, h: 100 }];
  const laid = [5, 6, 8].map((f) => drawnIn(frameBox(sceneAt(journee.code, f, { shots: shots(16 / 9), texts: marks }, parts))).find((d) => d.type === "Footage")!);
  const centres = laid.map((d, k) => {
    const s = style(d);
    const p = parts[k]!;
    const z = Number(s.width) / 1440;
    return [Number(s.left) + z * (p.x + p.w / 2 + 180), Number(s.top) + z * (p.y + p.h / 2), z * p.h];
  });
  for (const [x, y, size] of centres) {
    assert.ok(Math.abs(x! - 0.49 * 1080) < 1 && Math.abs(y! - 0.215 * 810) < 1, JSON.stringify(centres));
    assert.ok(Math.abs(size! - centres[0]![2]!) < 1, JSON.stringify(centres));
  }
  assert.deepEqual(laid.map((d) => d.props.shot), [1, 1, 1]);
  // Its ten pieces kept over its fourteen images, every fifth image twice (one a film image).
  const burst = Array.from({ length: 14 }, (_, i) => String(style(drawnIn(frameBox(sceneAt(journee.code, 5 + i, { shots: shots(16 / 9), texts: marks }, parts))).find((d) => d.type === "Footage")!).left));
  assert.equal(new Set(burst).size, 10);
  // Its objects: what repeats in its burst shot, named by the filler; nobody cut out (no one passes in front of its title).
  assert.equal(drawsSubject(journee.code), false);
  assert.deepEqual(objectsDrawn(journee.code), []);
  assert.deepEqual(objectsDrawn(skillCode(journee, { pareilles: "every jar" })), [{ shot: 1, name: "every jar" }]);
  // A flash overexposes its cuts (the picture kit's Flash expose, never a white card: its film image doubled at 30 i/s
  // lit before it), a burn lays its light in screen around its three cuts (Burn, its images as measured); her footage
  // itself unfiltered; no zoom, no grain, no dark corners.
  const flash = drawnIn(frameBox(sceneAt(journee.code, 93, { shots: shots(16 / 9), texts: marks })));
  const lit = flash.find((d) => d.type === "Flash")!;
  assert.deepEqual([lit.props.at, lit.props.expose, lit.props.before], [[93, 106, 263, 273, 283], true, 2]);
  assert.equal(style(flash.find((d) => d.type === "Footage")!).filter, undefined);
  const burns = flash.filter((d) => d.type === "Burn");
  assert.deepEqual(burns.map((d) => d.props.at), [191, 213, 293]);
  assert.match(JSON.stringify(burns[0]!.props.steps), /rgba\(255,96,64/);
  assert.deepEqual((burns[0]!.props.steps as unknown[][]).map((s) => s[0]), [-3, -2, -1]);
  assert.ok(!/\b(Whip|ZoomThrough|Subject)\b|scale\(1\.0/.test(journee.code));
  assert.deepEqual(journee.finish, { grain: 0, vignette: 0 });
});

// ——— « Mosaïque qui change » v3, written again on its original's fiche (docs/fiches/mosaique.md) ——————————————————————

/** A deterministic random(seed) for a composition drawn here (the render has Remotion's own). */
const SEEDED = `function random(seed) { let x = 2166136261; for (const ch of String(seed)) x = Math.imul(x ^ ch.charCodeAt(0), 16777619) >>> 0; return x / 4294967296; }\n`;
type MosaicPrint = { shot: number | null; at: number | undefined; lean: number | null };
/**
 * What each print of a mosaic shows at a frame, read from what its code draws (its block: where its pictures are laid):
 * the shot it shows (null: blank paper), where that shot plays from, and its tilt while it lands (null: laid straight).
 */
function mosaicAt(code: string, frame: number, props: Record<string, unknown>, cols: number, rows: number): MosaicPrint[] {
  const tree = drawScene(SEEDED + code, frame, props);
  const out: MosaicPrint[] = Array.from({ length: cols * rows }, () => ({ shot: null, at: undefined, lean: null }));
  const nodes = drawnNodes(tree);
  const laid = nodes.find((n) => n.type === "Footage");
  // Its block: where a picture is laid, less the few pixels it is laid past it.
  const box = laid ? (styleOf(laid) as Record<string, number>) : { left: 7, top: 1, width: 1066, height: 1918 };
  const block = { left: box.left! + 6, top: box.top! + 6, width: box.width! - 12, height: box.height! - 12 };
  const cell = (x: number, y: number) =>
    Math.min(cols - 1, Math.max(0, Math.floor(((x - block.left) / block.width) * cols))) + cols * Math.min(rows - 1, Math.max(0, Math.floor(((y - block.top) / block.height) * rows)));
  for (const node of nodes) {
    if (node.type !== "div") continue;
    const style = styleOf(node);
    const footage = drawnNodes(node).find((x) => x.type === "Footage");
    const shown = { shot: footage ? Number(footage.props.shot) : null, at: footage?.props.at as number | undefined };
    const clip = /^path\('(.*)'\)$/.exec(String(style.clipPath ?? ""));
    for (const part of clip ? clip[1]!.split("Z").filter((p) => p.trim()) : []) {
      const xy = part.replace(/[ML]/g, " ").trim().split(/\s+/).map(Number);
      out[cell((xy[0]! + xy[2]! + xy[4]! + xy[6]!) / 4, (xy[1]! + xy[3]! + xy[5]! + xy[7]!) / 4)] = { ...shown, lean: null };
    }
    const lean = /rotate\((-?[\d.]+)deg\)/.exec(String(style.transform ?? ""));
    if (lean) out[cell(Number(style.left) + Number(style.width) / 2, Number(style.top) + Number(style.height) / 2)] = { ...shown, lean: Number(lean[1]) };
  }
  return out;
}
/** Her pictures as a mosaic's composition gets them: n of that shape (width / height), a wave (36 images) each. */
const mosaicShots = (aspects: number[], kind = "photo") => aspects.map((aspect, i) => ({ src: `/f${i}.jpg`, aspect, from: i * 36, durationInFrames: 36, kind, segment: i }));
const MOSAIC_BRAND = { name: "La Fripe Rétro", displayFont: "Instrument Serif", bodyFont: "Inter Tight" };

test("« Mosaïque qui change » (v3) changes its prints on its original's images, on its own music (130 BPM)", async () => {
  const { mosaique } = await import("./skills/mosaique.ts");
  assert.equal(mosaique.version, 3);
  assert.equal(mosaique.bpm, 130);
  // Its five pictures in 6 s, 13 beats of its music: a wave of 2,6 beats (36 images) each, as the original's.
  const line = mosaique.timeline(5, { end: false });
  assert.equal(line.duration, 6);
  assert.deepEqual(line.shots.map((s) => Math.round(s.start * 30)), [0, 36, 72, 108, 144]);
  assert.equal(line.marks.cycle, 36);
  // Any count: the whole loop a whole number of beats, a print every 3 images within a fifth of an image.
  for (let n = 4; n <= 10; n++) {
    const other = mosaique.timeline(n, { end: false });
    assert.ok(Math.abs(((other.duration * 130) / 60) % 1) < 0.05 || Math.abs(((other.duration * 130) / 60) % 1) > 0.95, `${n}: ${other.duration} s`);
    assert.ok(Math.abs(other.marks.cycle! / 12 - 3) < 0.2, `${n}: ${other.marks.cycle}`);
  }
  // No text and no sound of its own; its music plays to its last image and stops dead as it loops (the original's
  // never fades); a Reel that ends on a card does not loop, the mix fades it.
  assert.equal(line.sounds, undefined);
  assert.deepEqual(line.music, { end: { at: 6 } });
  assert.equal(mosaique.timeline(5, { end: true }).music, undefined);
  // Image by image: its 59 changes on the original's images (3 + 3 × the print's rank + 36 × the wave), within two
  // images (here on them), in reading order, each print to the next picture; the first one comes back last.
  const props = { width: 1080, height: 1920, durationInFrames: 180, brand: MOSAIC_BRAND, shots: mosaicShots(Array(5).fill(3 / 4)), reelTexts: [], end: null, texts: { cycle: "36" } };
  const seen = Array.from({ length: 180 }, (_, f) => mosaicAt(mosaique.code, f, props, 3, 4));
  const expected = Array.from({ length: 5 }, (_, w) => Array.from({ length: 12 }, (_, j) => ({ j, at: 3 + 3 * j + 36 * w, shot: (w + 1) % 5 }))).flat().filter((c) => c.at < 180);
  const changes = seen.flatMap((prints, f) => (f ? prints.flatMap((p, j) => (p.shot !== seen[f - 1]![j]!.shot ? [{ j, at: f, shot: p.shot }] : [])) : []));
  assert.equal(changes.length, 59);
  for (const c of expected) assert.ok(changes.some((x) => x.j === c.j && x.shot === c.shot && Math.abs(x.at - c.at) <= 2), `print ${c.j + 1} to picture ${c.shot + 1} on image ${c.at}`);
  // Its first image whole and straight; the next picture whole for 3 images (its last print still landing).
  assert.ok(seen[0]!.every((p) => p.shot === 0 && p.lean === null));
  for (const f of [36, 37, 38]) assert.ok(seen[f]!.every((p) => p.shot === 1), `image ${f}`);
  assert.ok(seen[39]!.some((p) => p.shot === 2));
  // Each print lands askew for 3 images, about 1° (0,3 to 2,1), the first one counterclockwise and the way alternating
  // from one to the next, then lies straight as the next one lands.
  for (const c of expected) {
    const leans = [0, 1, 2].map((k) => seen[c.at + k]![c.j]!.lean);
    assert.ok(leans.every((a) => a !== null && Math.abs(a) >= 0.3 && Math.abs(a) <= 2.1 && Math.sign(a) === (c.j % 2 ? 1 : -1)), `print ${c.j + 1} on image ${c.at}: ${leans}`);
    if (c.at + 3 < 180) assert.equal(seen[c.at + 3]![c.j]!.lean, null);
  }
  assert.ok(seen.every((prints) => prints.filter((p) => p.lean !== null).length <= 1));
  // Photos stay still, videos play: each picture a wave long, centred on the moment it is whole; the first one, brought
  // back, holds the image the Reel starts on, its last print landing on the loop's first image.
  assert.deepEqual([4, 40, 76, 112, 148].map((f) => [seen[f]![0]!.shot, seen[f]![0]!.at]), [[1, 18], [2, 54], [3, 90], [4, 126], [0, 180]]);
  assert.ok(seen[179]!.slice(0, 11).every((p) => p.shot === 0 && p.at === 180) && seen[179]![11]!.shot === 4);
  // On its original's flat warm light grey paper; its finish keeps its matte, warm print: lifted blacks, no grain nor
  // dark corners.
  assert.match(mosaique.code, /"#d5d0c6"/);
  assert.deepEqual({ grain: mosaique.finish?.grain, vignette: mosaique.finish?.vignette }, { grain: 0, vignette: 0 });
  assert.ok((mosaique.finish?.fade ?? 0) > 0);
});

test("« Mosaïque qui change » (v3): vertical full frame as its original, her horizontal pictures whole in a 16:9 block, a square on her word", async () => {
  const { mosaique } = await import("./skills/mosaique.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const title = { text: "La Fripe Rétro", role: "hook", from: 0, to: 78, emphasis: [] };
  const draw = (aspects: number[], frame: number, texts: Record<string, string> = {}, extra: Record<string, unknown> = {}) =>
    drawScene(SEEDED + mosaique.code, frame, { width: 1080, height: 1920, durationInFrames: aspects.length * 36, brand: MOSAIC_BRAND, shots: mosaicShots(aspects, "video"), reelTexts: [title], end: null, texts: { cycle: "36", ...texts }, ...extra });
  /** Its block (where its pictures are laid, less the 6 px they are laid past it), and its prints (each one's box, from its clip). */
  const blockOf = (tree: Drawn) => {
    const s = styleOf(drawnNodes(tree).find((n) => n.type === "Footage")!) as Record<string, number>;
    return { left: s.left! + 6, top: s.top! + 6, width: s.width! - 12, height: s.height! - 12 };
  };
  const printsOf = (tree: Drawn) =>
    drawnNodes(tree).flatMap((n) => {
      const clip = /^path\('(.*)'\)$/.exec(String(styleOf(n).clipPath ?? ""));
      return clip
        ? clip[1]!.split("Z").filter((p) => p.trim()).map((part) => {
            const xy = part.replace(/[ML]/g, " ").trim().split(/\s+/).map(Number);
            const xs = [xy[0]!, xy[2]!, xy[4]!, xy[6]!];
            const ys = [xy[1]!, xy[3]!, xy[5]!, xy[7]!];
            return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
          })
        : [];
    });
  const wide = Array(6).fill(1920 / 1012);
  const tall = Array(6).fill(9 / 16);
  // Her files mostly vertical (half and half too): the original's full frame, 3 × 4 standing prints of its 231 × 315 px
  // at 720 (32,1 % × 24,6 %), its margin of 13 px on the sides and 7 at the top and the bottom, a gap of 4 px.
  const full = { left: 13, top: 7, width: 1054, height: 1906 };
  assert.deepEqual(blockOf(draw(tall, 0)), full);
  assert.deepEqual(blockOf(draw([...Array(3).fill(16 / 9), ...Array(3).fill(9 / 16)], 0)), full);
  const standing = printsOf(draw(tall, 0));
  assert.equal(standing.length, 12);
  assert.ok(standing.every((p) => Math.abs(p.w - 346.5) <= 6 && Math.abs(p.h - 472.5) <= 6 && p.x >= 6 && p.x + p.w <= 1074), JSON.stringify(standing));
  // Mostly horizontal: her pictures whole in a 16:9 block in the middle of the paper, 4 × 3 lying prints.
  const block = { left: 13, top: 664, width: 1054, height: 593 };
  assert.deepEqual(blockOf(draw(wide, 0)), block);
  const lying = printsOf(draw(wide, 0));
  assert.equal(lying.length, 12);
  assert.ok(lying.every((p) => p.w > p.h && p.y >= 660 && p.y + p.h <= 1261), JSON.stringify(lying[0]));
  assert.equal(new Set(lying.map((p) => Math.round(p.x / 100))).size, 4);
  // On her word, the other one, or a square block of 3 × 3 at the original's pace (a print every 3 images).
  assert.deepEqual(blockOf(draw(wide, 0, { format: "vertical" })), full);
  assert.deepEqual(blockOf(draw(tall, 0, { format: "horizontal" })), block);
  const square = mosaique.timeline(6, { end: false, settings: { format: "carre" } });
  assert.ok(Math.abs(square.marks.cycle! / 9 - 3) < 0.2, `${square.marks.cycle}`);
  const squared = draw(tall, 0, { format: "carre", cycle: String(square.marks.cycle) });
  assert.deepEqual(blockOf(squared), { left: 13, top: 433, width: 1054, height: 1054 });
  assert.equal(printsOf(squared).length, 9);
  // Her title: on a paper label at the top full frame; in a block, in the serif on the paper above it.
  const titleBox = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "FitText" && heldText(n).includes("La Fripe Rétro"))!;
  const onLabel = titleBox(draw(tall, 10));
  assert.equal(styleOf(onLabel).top, 150);
  assert.ok(drawnNodes(onLabel).some((n) => n.type === "span" && styleOf(n).background));
  const above = titleBox(draw(wide, 10));
  assert.ok(Number(styleOf(above).top) + Number(styleOf(above).height) <= 664 && Number(styleOf(above).top) >= 80, JSON.stringify(styleOf(above)));
  assert.match(String((above.props.innerStyle as Record<string, unknown>).fontFamily), /Instrument Serif/);
  // Its ending card on blank paper prints laid by its last wave, its words on them, in its block.
  const card = draw(wide, 220, {}, { durationInFrames: 264, end: { title: "Ouvert dimanche", subtitle: "12 rue des Martyrs", from: 216 } });
  assert.ok(printsOf(card).length === 12 && drawnNodes(card).filter((n) => n.type === "Footage").length === 0);
  const words = drawnNodes(card).filter((n) => n.type === "FitText").map((n) => ({ text: heldText(n), box: styleOf(n) }));
  assert.deepEqual(words.map((w) => w.text.trim()), ["Ouvert dimanche", "12 rue des Martyrs"]);
  for (const w of words) assert.ok(Number(w.box.top) >= 664 && Number(w.box.top) + Number(w.box.height) <= 1257, JSON.stringify(w.box));
  // Its settings: the original's first (the default); the filler sees them; the plan keeps the one her words asked for.
  assert.deepEqual(mosaique.settings?.map((s) => s.name), ["cases", "vitesse", "ordre", "papier", "format"]);
  assert.deepEqual(mosaique.settings?.at(-1)?.choices.map((c) => c.value), ["auto", "vertical", "horizontal", "carre"]);
  assert.deepEqual(skillSettings(mosaique, [{ name: "format", value: "auto" }]), {});
  const files = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: mosaique, name: "Mosaïque", n: 6, files, business: {}, request: "en horizontal" });
  assert.equal(input.reglages?.at(-1)?.nom, "format");
  const plan = skillPlan({ skill: mosaique, name: "Mosaïque", files, fill: { shots: files.map((f) => ({ file: f.id, at: 1 })), texts: {}, end: null, settings: { format: "horizontal" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "horizontal");
  assert.deepEqual(plan.skill, { key: "mosaique", version: 3, settings: { format: "horizontal" } });
  assert.deepEqual(plan.music_shape, { end: { at: plan.duration, fade: 0.012 } });
});

// ——— « Mots aux quatre coins » v2, written again on its original's fiche (docs/fiches/quatre-coins.md) ——————————————

test("« Mots aux quatre coins » (v2) cuts where its original does, on its own music (92 BPM), its words and its pause on its beats", async () => {
  const { quatreCoins } = await import("./skills/quatre-coins.ts");
  const { clearsDrawn, objectsDrawn } = await import("./subject.ts");
  assert.equal(quatreCoins.version, 3);
  assert.equal(quatreCoins.bpm, 92);
  const line = quatreCoins.timeline(12, { end: false });
  const f = (s: number) => Math.round(s * 30);
  // The original's twelve shots, cut on its images 165, 186, 205, 234, 259, 285, 315, 339, 361, 394 and 430 (measured
  // image by image at 30 i/s): within two images each, on its own music's beats; its front held to its 21,8 s.
  const original = [0, 165, 186, 205, 234, 259, 285, 315, 339, 361, 394, 430];
  assert.equal(line.shots.length, original.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(f(s.start) - original[i]!) <= 2, `shot ${i + 1}: image ${f(s.start)}, the original's ${original[i]}`));
  assert.ok(Math.abs(line.duration - 21.8) < 0.1, `${line.duration} s`);
  // Its six pieces land on its images 20, 30, 46, 61, 75 and 89 (within two): the top row's three, her name, her place, her address.
  const lands = [f(line.texts.debut!.from), line.marks.w1!, line.marks.w2!, f(line.texts.nom!.from), f(line.texts.lieu!.from), f(line.texts.adresse!.from)];
  [20, 30, 46, 61, 75, 89].forEach((at, i) => assert.ok(Math.abs(lands[i]! - at) <= 2, `piece ${i + 1}: image ${lands[i]}, the original's ${at}`));
  // They all go with the first cut; her name stays hers to the end, alone on her front from the original's image 476.
  for (const slot of ["debut", "lieu", "adresse"]) assert.equal(line.texts[slot]!.to, line.shots[1]!.start, slot);
  assert.equal(line.texts.nom!.to, line.duration);
  assert.equal(line.marks.cut, f(line.shots[1]!.start));
  assert.ok(Math.abs(line.marks.name! - 476) <= 1, `${line.marks.name}`);
  // Its music loses its bass and drums half a beat after its sentence is whole (the original's 3,15 s), all of it back
  // at once on the first cut (opened slowly, its line hollowed); it plays on to the last image. No sound of its own.
  const { readMusicShape } = await import("./music-shape.ts");
  const thin = readMusicShape(line.music, line.duration)!.filters![0]!;
  assert.equal(line.music!.filters!.length, 1);
  assert.equal(thin.kind, "thin");
  assert.ok(Math.abs(thin.from - 3.15) < 0.05 && thin.from > f(line.texts.adresse!.from) / 30, `${thin.from} s`);
  assert.equal(thin.to, line.shots[1]!.start);
  assert.equal(thin.open, 0.02);
  assert.deepEqual(line.music!.end, { at: line.duration, fade: 0.02 });
  assert.equal(line.sounds, undefined);
  // The life of the place: never two close shots in a row, its two last ones the longest of the ten.
  const life = line.shots.slice(1, -1).map((s) => f(s.end) - f(s.start));
  assert.ok(life.at(-1)! >= Math.max(...life.slice(0, -2)) && life.at(-2)! >= Math.max(...life.slice(0, -2)), JSON.stringify(life));
  assert.ok(line.shots.slice(1, -1).every((s, i, all) => !(/de près/.test(s.want) && /de près/.test(all[i + 1]?.want ?? ""))));
  // With an ending card, its front held half beats longer (the card's 1,6 s), its cuts the same; her name gives way to it.
  const ended = quatreCoins.timeline(12, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1).map((s) => s.start), line.shots.map((s) => s.start).slice(0, -1));
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs(((ended.duration - line.duration) * 92) / 60 - 2.5) < 0.05, `${ended.duration} s`);
  assert.ok(Math.abs(ended.texts.nom!.to - (ended.duration - 1.6)) < 0.01);
  // Fewer moments (six at least): its opening, its first life shots and its front as the original's; more: two beats each.
  assert.deepEqual(quatreCoins.shots, [8, 12]);
  const eight = quatreCoins.timeline(8, { end: false });
  assert.deepEqual(eight.shots.slice(0, 4).map((s) => s.start), line.shots.slice(0, 4).map((s) => s.start));
  assert.ok(Math.abs(eight.shots.at(-1)!.end - eight.shots.at(-1)!.start - (line.shots.at(-1)!.end - line.shots.at(-1)!.start)) <= 1 / 30 + 0.01);
  const more = quatreCoins.timeline(14, { end: false });
  assert.ok(Math.abs(more.duration - line.duration - 2 * 2 * (60 / 92)) < 0.05, `${more.duration} s`);
  // At its slowest tempo and its most shots, never past 45 s; its words never cut its cuts.
  assert.ok(quatreCoins.timeline(19, { end: false, bpm: 64 }).duration <= 45);
  // Nothing is followed nor read in her shots: its words keep the original's places; its camera never moves.
  assert.deepEqual(clearsDrawn(quatreCoins.code), []);
  assert.deepEqual(objectsDrawn(quatreCoins.code), []);
  assert.doesNotMatch(quatreCoins.code, /transform|scale\(/);
  // The original's cream, with no shadow nor edge: only a wide dark halo, unseen on a dark wall, for a light one (its
  // fallback on a very bright edge); its finish without the vignette its original does not have.
  assert.match(quatreCoins.code, /#E7E2CC/);
  assert.deepEqual(quatreCoins.code.match(/textShadow: "[^"]*"/g), ['textShadow: "0 0 0.5em rgba(0,0,0,0.3)"']);
  assert.doesNotMatch(quatreCoins.code, /TextStroke|WebkitTextStroke/);
  assert.deepEqual(quatreCoins.finish, { vignette: 0 });
});

test("« Mots aux quatre coins » (v2): horizontal 16:9 on black as its original when her files are, full frame otherwise or on her word; its words on the edges", async () => {
  const { quatreCoins } = await import("./skills/quatre-coins.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const line = quatreCoins.timeline(12, { end: false });
  const f = (s: number) => Math.round(s * 30);
  const shotsOf = (aspects: number[]) => line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: aspects[i]!, from: f(s.start), durationInFrames: f(s.end) - f(s.start), kind: "video", segment: i }));
  const at = (slot: string) => ({ from: f(line.texts[slot]!.from), to: f(line.texts[slot]!.to), emphasis: [] });
  const reelTexts = [
    { text: "une journée au", role: "caption", ...at("debut") },
    { text: "Brighton Pier", role: "hook", ...at("nom") },
    { text: "Brighton", role: "band", ...at("lieu") },
    { text: "Madeira Dr, Brighton BN2 1TW", role: "caption", ...at("adresse") },
  ];
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const draw = (aspects: number[], frame: number, extra: Record<string, unknown> = {}) =>
    drawScene(quatreCoins.code, frame, { width: 1080, height: 1920, durationInFrames: f(line.duration), brand: { name: "Brighton Pier", displayFont: "Inter Tight", bodyFont: "Inter Tight" }, shots: shotsOf(aspects), reelTexts, end: null, texts: marks, ...extra });
  const frameOf = (tree: Drawn) => {
    const box = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!;
    return { top: styleOf(box).top, height: styleOf(box).height };
  };
  const boxes = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "FitText").map((n) => ({ ...(n.props.style as { left: number; top: number; width: number; height: number }), text: heldText(n).trim() }));
  const wide = Array(12).fill(16 / 9);
  const tall = Array(12).fill(9 / 16);
  // Her files mostly horizontal: a 16:9 picture (1080 × 608) at the middle of the frame, on black; mostly vertical (half and half too): full frame.
  assert.deepEqual(frameOf(draw(wide, 100)), { top: 656, height: 608 });
  assert.equal(frameOf(draw([...Array(7).fill(16 / 9), ...Array(5).fill(9 / 16)], 100)).height, 608);
  assert.deepEqual(frameOf(draw(tall, 100)), { top: 0, height: 1920 });
  assert.equal(frameOf(draw([...Array(6).fill(16 / 9), ...Array(6).fill(9 / 16)], 100)).height, 1920);
  // On her word, the other format.
  assert.equal(frameOf(draw(wide, 100, { texts: { ...marks, format: "vertical" } })).height, 1920);
  assert.equal(frameOf(draw(tall, 100, { texts: { ...marks, format: "horizontal" } })).top, 656);
  for (const aspects of [wide, tall]) {
    const { top, height } = frameOf(draw(aspects, 100));
    // Each piece set at once on the image it lands on (its first word with its capital, her name and place in lower case,
    // her address as written, its postcode kept on one line).
    const shown = new Map<string, number>();
    for (let frame = 0; frame < line.marks.cut!; frame++) {
      for (const n of drawnNodes(draw(aspects, frame))) if (n.type === "span" && styleOf(n).opacity === 1 && !shown.has(drawnText(n))) shown.set(drawnText(n), frame);
    }
    assert.deepEqual(
      ["Une", "journée", "au", "brighton pier", "brighton", "Madeira Dr, Brighton BN2\u00a01TW"].map((w) => shown.get(w)),
      [f(line.texts.debut!.from), line.marks.w1, line.marks.w2, f(line.texts.nom!.from), f(line.texts.lieu!.from), f(line.texts.adresse!.from)],
    );
    // Three rows on the edges of its picture, at one size: its top row near its top, the address near its bottom, the
    // middle row a little under its middle; 40 px from the sides, left of the apps' buttons below the middle of the
    // screen, above the apps' caption.
    const rows = boxes(draw(aspects, 100));
    assert.equal(rows.length, 3);
    const [upper, middle, lower] = rows as [(typeof rows)[number], (typeof rows)[number], (typeof rows)[number]];
    assert.ok(upper.top + upper.height < middle.top && middle.top + middle.height < lower.top, JSON.stringify(rows));
    assert.ok(upper.top - Number(top) < 0.1 * Number(height) && upper.top >= 80, JSON.stringify(upper));
    assert.ok(lower.top + lower.height <= Math.min(Number(top) + Number(height), 1440), JSON.stringify(lower));
    for (const b of rows) {
      assert.equal(b.left, 40);
      assert.ok(b.left + b.width <= (b.top + b.height > 948 ? 940 : 1040), JSON.stringify(b));
    }
    assert.equal(upper.left + upper.width, 1040);
    // Nothing on her life of the place, then her name alone at the middle of her picture from its image, held to the end.
    assert.equal(boxes(draw(aspects, line.marks.cut! + 30)).length, 0);
    assert.equal(boxes(draw(aspects, line.marks.name! - 1)).length, 0);
    const alone = boxes(draw(aspects, line.marks.name!));
    assert.equal(alone.length, 1);
    assert.equal(alone[0]!.text, "brighton pier");
    assert.ok(Math.abs(alone[0]!.left + alone[0]!.width / 2 - 540) <= 1 && Math.abs(alone[0]!.top + alone[0]!.height / 2 - (Number(top) + Number(height) / 2)) <= 12, JSON.stringify(alone));
    assert.equal(boxes(draw(aspects, f(line.duration) - 1)).length, 1);
  }
  // Its ending card in its own words: her title where her name was, her line on the bottom row a step later, no veil.
  const endAt = f(line.duration) - 48;
  const card = boxes(draw(wide, endAt + 20, { end: { title: "Ouvert tous les jours", subtitle: "dès 10 h", from: endAt } }));
  assert.deepEqual(card.map((b) => b.text), ["Ouvert tous les jours", "dès 10 h"]);
  assert.equal(drawnNodes(draw(wide, endAt + 20, { end: { title: "Ouvert", subtitle: null, from: endAt } })).filter((n) => /rgba/.test(String(styleOf(n).backgroundColor ?? ""))).length, 0);
  // The setting: the filler sees it (the original's first, the default), the plan keeps a choice her words asked for;
  // its music shape and its marks are on the plan.
  assert.deepEqual(quatreCoins.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(quatreCoins, [{ name: "format", value: "auto" }]), {});
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 9 }));
  const input = skillFillInput({ skill: quatreCoins, name: "Mots aux quatre coins", n: 12, files, business: {}, request: "en vertical" });
  assert.equal(input.reglages?.[0]?.nom, "format");
  assert.equal(input.cases.length, 12);
  const fill = { shots: files.map((x) => ({ file: x.id, at: 0.5 })), texts: { debut: "un matin chez", nom: "Farine", lieu: "Belleville", adresse: "12 rue Ramponeau" }, end: null, settings: { format: "vertical" } };
  const plan = skillPlan({ skill: quatreCoins, name: "Mots aux quatre coins", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
  assert.deepEqual(plan.skill, { key: "quatre-coins", version: 3, settings: { format: "vertical" } });
  const { readMusicShape } = await import("./music-shape.ts");
  assert.deepEqual(plan.music_shape, readMusicShape(line.music, line.duration));
  assert.equal(plan.sounds, undefined);
});

// ——— « Éventail de bandes » v2, written again on its original's fiche (docs/fiches/eventail.md) ——————————————————————

test("« Éventail de bandes » (v2) cuts where its original does, on its own music (119,8 BPM): its star, its drop, its intro of hits alone", async () => {
  const { eventail } = await import("./skills/eventail.ts");
  const { readMusicShape } = await import("./music-shape.ts");
  assert.equal(eventail.version, 2);
  assert.equal(eventail.bpm, 119.8);
  const line = eventail.timeline(13, { end: false });
  // The original's thirteen shots and its black (images at 30 i/s, docs/fiches/eventail.md), counted from its first
  // beat (its square, image 4: its picture runs five images ahead of its own music, ours lands on our music's beats from
  // the first image): within two images each, on its beats.
  const original = [4, 139, 169, 199, 230, 261, 291, 320, 350, 379, 410, 440, 469].map((f) => f - 4);
  assert.equal(line.shots.length, original.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - original[i]!) <= 2, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${original[i]}`));
  assert.ok(Math.abs(line.duration * 30 - (597 - 4)) <= 2, `${line.duration} s`);
  // A band on each beat after its square (the original's images 19, 33, 49, 64, 79, 94), the whole shot on the drop (109).
  const beat = line.marks.beat!;
  [19, 33, 49, 64, 79, 94].forEach((f, k) => assert.ok(Math.abs(Math.round((k + 1) * beat) - (f - 4)) <= 1, `band ${k + 1}: image ${Math.round((k + 1) * beat)}`));
  assert.ok(Math.abs(line.marks.whole! - (109 - 4)) <= 1);
  assert.equal(line.marks.whole, Math.round(line.shots[0]!.start * 30 + 7 * beat));
  // Its split screen on its fifth two-beat shot (the original's images 261 to 291), its right half the black's file.
  assert.deepEqual([line.marks.split, line.marks.split_to], [Math.round(line.shots[5]!.start * 30), Math.round(line.shots[5]!.end * 30)]);
  assert.match(line.shots.at(-1)!.want, /6e.*écran partagé/);
  assert.match(line.shots[9]!.want, /centre et des lignes/);
  // Its words on the black only: her name from its first image (the original's 469), its red line two beats later (498).
  assert.equal(Math.round(line.texts.signature!.from * 30), line.marks.black);
  assert.ok(Math.abs(Math.round(line.texts.ligne!.from * 30) - (498 - 4)) <= 2, `${line.texts.ligne!.from} s`);
  assert.deepEqual([line.texts.signature!.to, line.texts.ligne!.to], [line.duration, line.duration]);
  // Its music shaped as the original's: a hit of it on each of the seven beats before the drop (0,28 s), through a small
  // speaker (its intro's sound is all between 400 and 1 800 Hz), silent between; all of it, open, on the drop; going on
  // under the black and cut with a short fade at the very end. No sound effect: its original has none.
  const shape = readMusicShape(line.music, line.duration)!;
  assert.equal(shape.pauses!.length, 7);
  shape.pauses!.forEach((p, k) => assert.ok(Math.abs(p.from - (k * beat) / 30 - 0.28) < 0.01 && Math.abs(p.to - ((k + 1) * beat) / 30) < 0.002, JSON.stringify(p)));
  assert.deepEqual(shape.filters, [{ kind: "radio", from: 0, to: Math.round((7 * beat * 1000) / 30) / 1000, open: 0.02 }]);
  assert.deepEqual(shape.end, { at: line.duration, fade: 0.25 });
  assert.equal(line.sounds, undefined);
  // With an ending card (an option): her name six beats on the black, then the card's 1,6 s from a beat; cuts the same.
  const ended = eventail.timeline(13, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(Math.abs(((ended.duration - 1.6) * 30) / beat - 37) < 0.05, `${ended.duration} s`);
  assert.equal(ended.texts.signature!.to, Math.round((ended.duration - 1.6) * 100) / 100);
  // Fewer of her files: down to six shots, its split screen and its echo kept; more for a length she asks for, about 30 s.
  const fewest = eventail.timeline(6, { end: false });
  assert.equal(fewest.shots.length, 6);
  assert.match(fewest.shots[3]!.want, /écran partagé/);
  assert.match(fewest.shots[4]!.want, /centre et des lignes/);
  assert.match(fewest.shots[5]!.want, /4e.*écran partagé/);
  assert.equal(fewest.marks.split, Math.round(fewest.shots[3]!.start * 30));
  assert.ok(Math.abs(eventail.timeline(23, { end: false }).duration - 29.8) < 0.1);
  // At another tempo, all of it follows its beats.
  const slower = eventail.timeline(13, { end: false, bpm: 100 });
  assert.ok(Math.abs(slower.marks.whole! / line.marks.whole! - 119.8 / 100) < 0.01);
  assert.ok(Math.abs(readMusicShape(slower.music, slower.duration)!.filters![0]!.to - 7 * 0.6) < 0.002);
});

test("« Éventail de bandes » (v2): horizontal 16:9 on black when her videos are, its star of windows on one shot, its frame, its split, its end", async () => {
  const { eventail } = await import("./skills/eventail.ts");
  const { skillCode, skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const { drawsSubject, objectsDrawn } = await import("./subject.ts");
  const line = eventail.timeline(13, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const shots = (aspect: number) => line.shots.map((s) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect }));
  // The kit pieces its code lays besides the stand-in scope's, as named elements too; its shot's heart when one is found.
  const run = (frame: number, props: Record<string, unknown>, heart: unknown = null) =>
    sceneAt(`const Paper = "Paper"; const Split = "Split"; const SubjectBox = () => (${JSON.stringify(heart)});\n${eventail.code}`, frame, { durationInFrames: Math.round(line.duration * 30), ...props });
  const { starPath, starRays } = await import("../../../apps/render/src/picture-kit.ts");
  const style = (d: Drawn) => (d.props.style ?? {}) as Record<string, number | string>;
  const frameBox = (tree: Drawn) => tree.children[0] as Drawn;
  const clipped = (tree: Drawn, kind: string) => drawnIn(tree).find((d) => String(style(d).clipPath ?? "").startsWith(kind));
  // Its star is the picture kit's WindowStar: its windows at a frame as the kit draws them (its square, then the bands
  // landed by then, a beat apart; the original's six by default, turned a quarter upright).
  const star = (tree: Drawn) => drawnIn(tree).find((d) => d.type === "WindowStar");
  const windows = (tree: Drawn, frame: number) => {
    const p = star(tree)!.props as { box: { x: number; y: number; w: number; h: number }; center: { x: number; y: number }; upright: boolean; at: number; every: number };
    const S = Math.min(p.box.w, p.box.h);
    const landed = starRays(S, p.upright).filter((_, k) => frame >= Math.round(p.at + (k + 1) * p.every));
    return starPath(p.center, 0.094 * S, landed, p.box.w + p.box.h).match(/M[^MZ]*Z/g)!;
  };
  // Her videos in width: the original's 16:9 frame, 1080 × 608 in the middle of the vertical frame, on black.
  assert.deepEqual([style(frameBox(run(60, { shots: shots(16 / 9), texts: marks }))).top, style(frameBox(run(60, { shots: shots(16 / 9), texts: marks }))).height], [656, 608]);
  // Upright videos: the whole frame; her setting prevails both ways.
  assert.deepEqual([style(frameBox(run(60, { shots: shots(9 / 16), texts: marks }))).top, style(frameBox(run(60, { shots: shots(9 / 16), texts: marks }))).height], [0, 1920]);
  assert.equal(style(frameBox(run(60, { shots: shots(9 / 16), texts: { ...marks, format: "horizontal" } }))).height, 608);
  assert.equal(style(frameBox(run(60, { shots: shots(16 / 9), texts: { ...marks, format: "vertical" } }))).height, 1920);
  assert.deepEqual(eventail.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]], ["fond", ["bordeaux", "sienne"]]]);
  // The star: on its bordeaux ground, the square alone on its first image, a band more on each beat, all windows onto her
  // opening shot laid whole at its place, in black and white; no frame around it.
  const wide = (frame: number) => run(frame, { shots: shots(16 / 9), texts: marks });
  assert.equal((frameBox(wide(0)).children[0] as Drawn).type, "Paper");
  assert.equal((frameBox(wide(0)).children[0] as Drawn).props.color, "#440a0b");
  assert.deepEqual([0, 14, 15, 50, 89, 90, 104].map((f) => windows(wide(f), f).length), [1, 1, 2, 4, 6, 7, 7]);
  assert.deepEqual(star(wide(50))!.props.box, { x: 0, y: 0, w: 1080, h: 608 });
  const starShot = drawnIn(star(wide(50))!).find((d) => d.type === "Footage")!;
  assert.deepEqual([starShot.props.shot, style(starShot).width, style(starShot).height], [0, 1080, 608]);
  assert.match(String(style(starShot).filter), /^grayscale\(1\)/);
  // Its square at the middle, 9,4 % of the short side; its diagonals 36° from the horizontal, its last two upright; each
  // half cut short of the square (its first band from 13,5 % of the short side).
  const point = (w: string, k: number) => w.match(/-?[\d.]+/g)!.map(Number).slice(2 * k, 2 * k + 2) as [number, number];
  const [square, first, , , , upright] = windows(wide(104), 104) as [string, string, string, string, string, string];
  assert.deepEqual(point(square, 0).map(Math.round), [511, 275]);
  assert.ok(Math.abs(Number(square.match(/h([\d.]+)/)![1]) - 0.094 * 608) < 0.1);
  const slope = (w: string) => {
    const [a, b] = [point(w, 0), point(w, 1)];
    return (Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0])) * 180) / Math.PI;
  };
  assert.ok(Math.abs(slope(first) - 36) < 0.1 && Math.abs(slope(upright) - 90) < 0.1, `${slope(first)}°, ${slope(upright)}°`);
  assert.ok(Math.hypot(point(first, 0)[0] - 540, point(first, 0)[1] - 304) > 0.135 * 608);
  // Turned a quarter upright: its straight bands to the sides, its diagonals to the corners at 54°.
  const tall = windows(run(104, { shots: shots(9 / 16), texts: marks }), 104);
  assert.ok(Math.abs(slope(tall[1]!) - 54) < 0.1 && Math.abs(slope(tall[5]!)) < 0.1, `${slope(tall[1]!)}°, ${slope(tall[5]!)}°`);
  // On her shot's heart when the filler named it and it was found small: read once, the star pulled within an eighth of
  // the frame; a heart that fills much of it (a whole bandstand) leaves the star at the middle.
  assert.deepEqual(point(windows(run(30, { shots: shots(16 / 9), texts: marks }, { x: 800, y: 40, w: 40, h: 40 }), 30)[0]!, 0).map(Math.round), [646, 199]);
  assert.deepEqual(point(windows(run(30, { shots: shots(16 / 9), texts: marks }, { x: 100, y: 0, w: 900, h: 400 }), 30)[0]!, 0).map(Math.round), [511, 275]);
  assert.deepEqual(objectsDrawn(eventail.code), []);
  assert.deepEqual(objectsDrawn(skillCode(eventail, { coeur: "pendant lamp" })), [{ shot: 0, name: "pendant lamp" }]);
  assert.equal(drawsSubject(eventail.code), false);
  // The whole shot at once on the drop, at the same place and size, in a thin frame of the ground laid over it (the
  // original's 14 px a side, 12 above and below, of 720 × 406), its blacks lifted to the blue black, its whites held.
  const dropped = wide(Number(marks.whole));
  assert.equal(star(dropped), undefined);
  const film = clipped(dropped, "inset")!;
  assert.equal(style(film).clipPath, "inset(18px 21px)");
  const whole = drawnIn(film).find((d) => d.type === "Footage")!;
  assert.deepEqual([whole.props.shot, style(whole).width, style(whole).height], [0, 1080, 608]);
  assert.deepEqual(drawnIn(film).filter((d) => style(d).mixBlendMode).map((d) => [style(d).backgroundColor, style(d).mixBlendMode]), [["#03090d", "lighten"], ["#e8e9ea", "darken"]]);
  assert.equal(style(clipped(run(Number(marks.whole), { shots: shots(9 / 16), texts: marks }), "inset")!).clipPath, "inset(37px 32px)");
  // Its split screen: her shot and the one that answers it (her last, from the split's first image), side by side, each
  // an exact half, nothing between; one above the other upright.
  const split = drawnIn(wide(Number(marks.split) + 3)).find((d) => d.type === "Split")!;
  assert.deepEqual([split.props.direction, split.props.gap, split.props.enter, split.props.box], ["row", 0, "cut", { x: 0, y: 0, w: 1080, h: 608 }]);
  const halves = (split.props.parts as ((size: { width: number; height: number }) => Drawn)[]).map((p) => p({ width: 540, height: 608 }));
  assert.deepEqual(halves.map((d) => [d.props.shot, d.props.at]), [[5, undefined], [12, Number(marks.split)]]);
  assert.equal(drawnIn(run(Number(marks.split) + 3, { shots: shots(9 / 16), texts: marks })).find((d) => d.type === "Split")!.props.direction, "column");
  assert.equal(drawnIn(wide(Number(marks.split_to))).find((d) => d.type === "Split"), undefined);
  // Its end: the blue black in the frame, her name white at the middle in its serif, its red line two beats later under
  // it, a short one an accent beside her name; nothing of the original's own words.
  const reelTexts = [
    { text: "Brighton Pier", role: "hook", from: Number(marks.black), to: 593 },
    { text: "@brighton.pier", role: "caption", from: Number(marks.black) + 30, to: 593 },
  ];
  const black = run(Number(marks.black) + 31, { shots: shots(16 / 9), texts: marks, reelTexts });
  assert.ok(drawnIn(frameBox(black)).some((d) => style(d).backgroundColor === "#03090d" && style(d).clipPath === "inset(18px 21px)"));
  assert.equal(drawnIn(frameBox(black)).filter((d) => d.type === "Footage").length, 0);
  const [name, handle] = drawnIn(black).filter((d) => d.type === "FitText");
  assert.deepEqual([(name!.props.innerStyle as Record<string, unknown>).color, (handle!.props.innerStyle as Record<string, unknown>).color], ["#ffffff", "#972f34"]);
  assert.match(String((name!.props.innerStyle as Record<string, unknown>).fontFamily), /^'Bodoni Moda', 'Instrument Serif'/);
  assert.ok(Math.abs(Number(style(name!).top) + Number(style(name!).height) / 2 - 953) <= 1 && Number(style(handle!).top) > Number(style(name!).top));
  assert.ok(drawnIn(handle!).some((d) => "data-fauve-accent" in d.props));
  assert.equal(drawnIn(run(Number(marks.black) + 29, { shots: shots(16 / 9), texts: marks, reelTexts })).filter((d) => d.type === "FitText").length, 1);
  assert.doesNotMatch(eventail.code, /Preet|blaster|\bscale\(|\b(Flash|Whip|ZoomThrough|Fan)\b/);
  // On her word, her own dark colour for its ground and its frame (the bordeaux when she has none).
  const hers = run(0, { shots: shots(16 / 9), texts: { ...marks, fond: "sienne" }, brand: { displayFont: "Lora", bodyFont: "Jost", palette: { dark: "#1d3b2a" } } });
  assert.equal((frameBox(hers).children[0] as Drawn).props.color, "#1d3b2a");
  assert.equal((frameBox(run(0, { shots: shots(16 / 9), texts: { ...marks, fond: "sienne" } })).children[0] as Drawn).props.color, "#440a0b");
  // Its own grade: nothing of its model's finish laid over everything (no grey bordeaux, no grain, no crushed blacks).
  assert.deepEqual(eventail.finish, { saturation: 0, contrast: 0, grain: 0, vignette: 0 });
  // The filler sees its object and its settings; the plan keeps a choice her words asked for.
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: eventail, name: "Éventail de bandes", n: 13, files, business: {}, request: "avec ma couleur" });
  assert.deepEqual([input.objets?.[0]?.slot, input.objets?.[0]?.case], ["coeur", 1]);
  assert.deepEqual(skillSettings(eventail, [{ name: "fond", value: "bordeaux" }]), {});
  const plan = skillPlan({ skill: eventail, name: "Éventail de bandes", files, fill: { shots: Array.from({ length: 13 }, (_, i) => ({ file: files[i % 12]!.id, at: 1 })), texts: { signature: "Brighton Pier" }, end: null, settings: { fond: "sienne" } } });
  assert.equal(plan.layers![0]!.motion.texts!.fond, "sienne");
  assert.deepEqual(plan.skill, { key: "eventail", version: 2, settings: { fond: "sienne" } });
  assert.equal(plan.music_shape?.pauses?.length, 7);
});

// ——— « Titre qui se décode » v3, written again on its original's fiche (docs/fiches/decode.md) ———————————————————————

/** Its shots as a composition gets them, from its timeline, each of that shape (width / height); `cut`, those whose subject is cut out. */
const decodeShots = (line: { shots: { start: number; end: number }[] }, aspect: (i: number) => number, cut: number[] = []) =>
  line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: aspect(i), from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i, ...(cut.includes(i) ? { cut: true } : {}) }));

/** What its Scene draws at a frame, the kit's pieces as named nodes; SubjectBox finds a subject on the shots marked `cut`. */
function drawDecode(code: string, frame: number, props: Record<string, unknown>): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const interpolate = (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1)));
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    Decode: "Decode",
    useCurrentFrame: () => frame,
    interpolate,
    // Remotion's seeded random: the same number for the same seed.
    random: (seed: string) => {
      let x = 2166136261;
      for (const c of seed) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
      return x / 4294967296;
    },
    SubjectBox: (shot: { cut?: boolean } | undefined) => (shot?.cut ? { x: 400, y: 120, w: 260, h: 480 } : null),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
/** A FitText's content laid out at full size (it may be a function of its scale). */
const fitContent = (node: Drawn): unknown[] => node.children.map((c) => (typeof c === "function" ? (c as (scale: number) => unknown)(1) : c));
const drawnDeep = (node: unknown): Drawn[] => drawnNodes(node).flatMap((n) => (n.type === "FitText" ? [n, ...fitContent(n).flatMap(drawnDeep)] : [n]));

test("« Titre qui se décode » (v3) cuts and lands where its original does, on its own music (122 BPM), with its sounds and its music's shape", async () => {
  const { decode, decodeParts } = await import("./skills/decode.ts");
  const { objectsDrawn, drawsSubject, clearsDrawn, depthsDrawn } = await import("./subject.ts");
  assert.equal(decode.version, 4);
  assert.equal(decode.bpm, 122);
  const line = decode.timeline(16, { end: false });
  // The original's 22,64 s (679 images), its last image black.
  assert.equal(line.shots.length, 16);
  assert.ok(Math.abs(line.duration - 22.64) < 0.05, `${line.duration} s`);
  const near = (frame: number, original: number, what: string) => assert.ok(Math.abs(frame - original) <= 2, `${what}: image ${frame}, the original's ${original}`);
  const starts = line.shots.map((s) => Math.round(s.start * 30));
  const { montage } = decodeParts(16);
  // Its shots start where the original's picture changes (docs/fiches/decode.md, measured image by image at 30 i/s),
  // within two images: the opening, the band opening behind the title, the calm shot, the followed one, the place it
  // leaves, the next one, the person landing.
  assert.equal(starts[0], 0);
  near(starts[1]!, 172, "the band opens");
  near(starts[1 + montage]!, 398, "the calm shot");
  [441, 530, 592, 621].forEach((f, i) => near(starts.at(i - 4)!, f, `ending ${i + 1}`));
  // The montage's shots inside the original's machine-gun montage (a cut every 4 images, its 1st and 30th of 5): each
  // within two images of one of its cuts.
  const flash = [172, ...Array.from({ length: 29 }, (_, k) => 177 + 4 * k), ...Array.from({ length: 27 }, (_, k) => 294 + 4 * k)];
  for (const f of starts.slice(1, 1 + montage)) assert.ok(flash.some((c) => Math.abs(c - f) <= 2), `montage shot at image ${f}`);
  // Its moments, its original's images: the bands land, the fold's three steps of six images, the title on the black
  // (still 12 images, scrambling 19, landing over 8), the band, the layers of its ending, the black.
  const m = line.marks;
  [4, 9, 14, 19, 26, 32].forEach((f, i) => near(m[`band${i + 1}`]!, f, `band ${i + 1}`));
  [69, 84, 98].forEach((f, i) => near(m[`fold${i + 1}`]!, f, `fold step ${i + 1}`));
  assert.equal(m.step, 6);
  assert.deepEqual([m.hold, m.scramble, m.resolve], [12, 19, 8]);
  near(Math.round(line.texts.titre!.from * 30), 119, "the title shows");
  near(Math.round(line.texts.titre!.from * 30) + m.hold! + m.scramble! + m.resolve!, 158, "the title lands");
  assert.deepEqual(line.texts.surtitre, line.texts.titre);
  near(Math.round(line.texts.titre!.to * 30), 398, "the title goes");
  near(m.open!, 172, "the band");
  near(m.full!, 398, "the band full");
  const ending: [string, number][] = [["swap", 507], ["leave", 530], ["early", 562], ["next", 592], ["person", 621], ["decor1", 635], ["decor2", 648], ["black", 678]];
  for (const [k, f] of ending) near(m[k]!, f, k);
  // Its original's sounds, where its fiche measured them: a shutter on each band, a rumble, a whoosh before each step,
  // an impact before the title, ticks while it scrambles, the last on its landing; nothing else.
  const at = (sound: string) => (line.sounds ?? []).filter((s) => s.sound === sound).map((s) => s.at);
  const close = (got: number[], want: number[], what: string) => {
    assert.equal(got.length, want.length, what);
    got.forEach((t, i) => assert.ok(Math.abs(t - want[i]!) <= 2 / 30, `${what} ${i + 1}: ${t} s, the original's ${want[i]} s`));
  };
  close(at("camera shutter click"), [0.21, 0.38, 0.56, 0.74, 0.92, 1.1], "shutter");
  close(at("short air whoosh"), [2.26, 2.73, 3.2], "whoosh");
  close(at("deep dry impact"), [3.87], "impact");
  const ticks = at("digital glitch tick");
  assert.ok(Math.abs(ticks[0]! - 4.33) <= 2 / 30 && Math.abs(ticks.at(-1)! - 5.27) <= 1 / 30 && ticks.length >= 8, JSON.stringify(ticks));
  assert.equal(at("low cinematic rumble").length, 1);
  assert.equal(line.sounds!.length, 6 + 3 + 1 + 1 + ticks.length);
  // Its music: none under its opening, coming in with the band out of a small speaker, stopped on a last hit as the band
  // is full (its original's at 13,26 s), full again on the beat after the calm shot itself (its attack whole, its
  // original's at 14,73 s) to its last image; read by the mix as it is.
  const { readMusicShape } = await import("./music-shape.ts");
  const shape = line.music!;
  const read = readMusicShape(shape, line.duration)!;
  assert.deepEqual([read.pauses, read.end, read.filters?.map(({ kind, from, to }) => ({ kind, from, to }))], [shape.pauses, shape.end, shape.filters]);
  assert.equal(shape.pauses![0]!.from, 0);
  near(Math.round(shape.pauses![0]!.to * 30), 172, "the music comes in");
  assert.deepEqual(shape.filters, [{ kind: "radio", from: shape.pauses![0]!.to, to: shape.pauses![1]!.from }]);
  assert.ok(shape.pauses![1]!.from > 13.26 && shape.pauses![1]!.from < 13.45, `${shape.pauses![1]!.from} s`);
  assert.ok(Math.abs(shape.pauses![1]!.to - (30 * 60) / 122) < 0.001 && Math.abs(shape.pauses![1]!.to - 14.73) < 2 / 30, `${shape.pauses![1]!.to} s`);
  assert.deepEqual(shape.end, { at: line.duration, fade: 0.02 });
  // With an ending card: the same cuts, the black after its ending long enough for the card.
  const ended = decode.timeline(16, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(ended.duration - line.duration >= 1.6, `${ended.duration} s`);
  assert.equal(ended.marks.black, line.marks.black! + 1);
  // A longer Reel: more of her shots full frame after the calm one, two beats each, its opening and its ending as they are.
  const longer = decode.timeline(20, { end: false });
  assert.equal(longer.marks.extra, 4);
  assert.ok(Math.abs(longer.duration - line.duration - (4 * 2 * 60) / 122) < 0.05);
  assert.deepEqual(longer.shots.slice(0, 2 + montage), line.shots.slice(0, 2 + montage));
  // Fewer shots: fewer in its montage, the same length.
  assert.equal(decode.timeline(9, { end: false }).duration, line.duration);
  // Its subjects are her own cut-outs (the person, else what stands in front): no object named, no depth, no clear area.
  assert.deepEqual(objectsDrawn(decode.code), []);
  assert.ok(drawsSubject(decode.code));
  assert.deepEqual(clearsDrawn(decode.code), []);
  assert.deepEqual(depthsDrawn(decode.code), []);
  // No zoom anywhere (the bands and the band are masks); its title without a shadow, only a thin edge of 2 px at most
  // (its original has none: white on her pale roses had to hold); its finish without grain nor dark corners.
  assert.doesNotMatch(decode.code, /scale\(/);
  const edge = /const edge = "([^"]+)"/.exec(decode.code)![1]!;
  assert.ok([...edge.matchAll(/0 0 (\d+)px/g)].every((m) => Number(m[1]) <= 2) && !/\d+px \d+px/.test(edge.replace(/0 0 \d+px/g, "")), edge);
  assert.equal(decode.finish?.grain, 0);
  assert.equal(decode.finish?.vignette, 0);
});

test("« Titre qui se décode » (v3): its bands, its fold, its title, its band and its montage, its ending by layers, in its 16:9 frame or full frame", async () => {
  const { decode, decodeParts } = await import("./skills/decode.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const line = decode.timeline(16, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const reelTexts = [
    { text: "un matin chez", role: "caption", from: 119, to: 398, emphasis: [] },
    { text: "Atelier Rose", role: "hook", from: 119, to: 398, emphasis: [] },
  ];
  const draw = (frame: number, extra: Record<string, unknown> = {}, aspect = 16 / 9, cut: number[] = []) =>
    drawDecode(decode.code, frame, { width: 1080, height: 1920, durationInFrames: 679, brand: { name: "Atelier Rose", displayFont: "Open Sans", bodyFont: "Inter" }, shots: decodeShots(line, () => aspect, cut), reelTexts, end: null, texts: marks, ...extra });
  const frameOf = (tree: Drawn) => styleOf(drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden" && styleOf(n).backgroundColor === "#000000")!);
  const footage = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "Footage").map((n) => ({ shot: n.props.shot as number, at: n.props.at as number | undefined }));
  const subjects = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "Subject").map((n) => n.props.shot as number);
  // Her videos horizontal: its original's 16:9 frame (1080 × 608) at the middle, on black; vertical, or on her word, full frame.
  assert.deepEqual([frameOf(draw(50)).top, frameOf(draw(50)).height], [656, 608]);
  assert.deepEqual([frameOf(draw(50, {}, 9 / 16)).top, frameOf(draw(50, {}, 9 / 16)).height], [0, 1920]);
  assert.equal(frameOf(draw(50, { texts: { ...marks, format: "vertical" } })).height, 1920);
  assert.equal(frameOf(draw(50, { texts: { ...marks, format: "horizontal" } }, 9 / 16)).height, 608);
  // Six bands of a sixth of its width, landing at once one after the other, each playing from its landing, her opening
  // shot first, then another of her shots each.
  const bands = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "div" && String(n.props.key ?? "").startsWith("b"));
  assert.equal(bands(draw(3)).length, 0);
  assert.equal(bands(draw(9)).length, 2);
  const six = draw(50);
  assert.deepEqual(bands(six).map((n) => styleOf(n).width), [180, 180, 180, 180, 180, 180]);
  const played = footage(six);
  assert.deepEqual(played.map((f) => f.at), [4, 9, 14, 19, 26, 32]);
  assert.equal(played[0]!.shot, 0);
  assert.equal(new Set(played.map((f) => f.shot)).size, 6);
  // The fold: three steps of six images at a constant speed, held between, a mask over pictures that keep their size.
  const rowH = (f: number) => styleOf(bands(draw(f))[0]!).height;
  assert.deepEqual([60, 72, 80, 95].map(rowH), [608, Math.round(608 * (1 - (0.483 * 4) / 6)), Math.round(608 * 0.517), Math.round(608 * 0.227)]);
  assert.equal(styleOf(drawnNodes(bands(draw(80))[0]!).find((n) => n.type === "Footage")!).height, 608);
  assert.equal(bands(draw(104)).length, 0);
  // Its title on the black at once, scrambled, its small words labels over it: its original's decoding.
  const title = draw(130);
  const decoded = drawnDeep(title).find((n) => n.type === "Decode")!;
  assert.deepEqual([decoded.props.text, decoded.props.at, decoded.props.hold, decoded.props.scramble, decoded.props.resolve], ["ATELIER ROSE", 119, 12, 19, 8]);
  const small = drawnDeep(title).filter((n) => "data-fauve-accent" in n.props);
  assert.deepEqual(small.map(drawnText), ["un", "matin", "chez"]);
  // Its small words 0,375 of the title, in normal case, a little spaced; the block as wide as its place allows, at the
  // middle of the frame, held left of the apps' buttons.
  const titleSize = Number(styleOf(drawnDeep(title).find((n) => n.type === "div" && styleOf(n).fontSize === 110)!).fontSize);
  assert.ok(small.every((n) => Math.abs(Number(styleOf(n).fontSize) - titleSize * 0.375) < 1 && styleOf(n).letterSpacing === "0.15em"));
  const block = drawnNodes(title).find((n) => n.type === "FitText")!;
  assert.deepEqual([styleOf(block).left, styleOf(block).width], [140, 800]);
  assert.ok(Math.abs(Number(styleOf(block).top) + Number(styleOf(block).height) / 2 - 960) <= 1);
  // Full frame, where the band opens at 436 px, the title takes more of its width (150 px at most), its words the same share.
  const tall = drawnDeep(draw(130, {}, 9 / 16));
  assert.ok(tall.some((n) => n.type === "div" && styleOf(n).fontSize === 150));
  assert.ok(tall.filter((n) => "data-fauve-accent" in n.props).every((n) => styleOf(n).fontSize === 56));
  assert.equal(footage(title).length, 0);
  assert.equal(drawnDeep(draw(398)).filter((n) => n.type === "Decode").length, 0);
  // The band: opens at 22,7 % of its frame with the music, grows at a constant speed to the full frame.
  const bandBox = (f: number) => styleOf(drawnNodes(draw(f)).find((n) => n.props.key === "band")!);
  assert.equal(bandBox(173).height, Math.round(608 * 0.227));
  assert.equal(bandBox(173).top, Math.round((608 - Math.round(608 * 0.227)) / 2));
  assert.equal(bandBox(396).height, 608);
  const growth = [200, 250, 300].map((f) => Number(bandBox(f).height));
  assert.ok(Math.abs(growth[2]! - growth[1]! - (growth[1]! - growth[0]!)) <= 1, JSON.stringify(growth));
  // Its montage: a cut every 4 images (5 now and then), never the same shot twice in a row, every one of her shots in it.
  const pieces: { shot: number; from: number; at: number }[] = [];
  for (let f = 173; f < 398; f++) {
    const [p] = footage(draw(f));
    if (!pieces.length || pieces.at(-1)!.at !== p!.at || pieces.at(-1)!.shot !== p!.shot) pieces.push({ shot: p!.shot, from: f, at: p!.at! });
  }
  assert.equal(pieces.length, 56);
  assert.equal(pieces[0]!.shot, 1);
  pieces.slice(1).forEach((p, i) => {
    assert.notEqual(p.shot, pieces[i]!.shot, `piece ${i + 2}`);
    assert.ok(p.from - pieces[i]!.from >= 4 && p.from - pieces[i]!.from <= 5, `piece ${i + 1}: ${p.from - pieces[i]!.from} images`);
  });
  assert.equal(new Set(pieces.map((p) => p.shot)).size, 16);
  // Each piece inside its shot's passage: never a held image.
  const shots = decodeShots(line, () => 16 / 9);
  pieces.forEach((p, i) => {
    const next = pieces[i + 1]?.from ?? 398;
    assert.ok(p.from - p.at >= 0 && next - p.at <= shots[p.shot]!.durationInFrames, `piece ${i + 1} of shot ${p.shot}`);
  });
  // Its ending, by layers when her subjects are cut out: the place frozen behind the followed one's subject, then alone,
  // the next one's subject early on it, the person over the next place, then over two more of her places.
  const { montage } = decodeParts(16);
  const [B1, B2, K, L, M, P] = [montage - 1, montage, 12, 13, 14, 15];
  assert.deepEqual(footage(draw(400)), [{ shot: 1 + montage, at: undefined }]);
  assert.deepEqual(footage(draw(480)), [{ shot: K, at: undefined }]);
  const layered = (f: number) => draw(f, {}, 16 / 9, [K, M, P]);
  assert.deepEqual([footage(layered(515)), subjects(layered(515))], [[{ shot: L, at: undefined }], [K]]);
  assert.deepEqual([footage(layered(540)), subjects(layered(540))], [[{ shot: L, at: undefined }], []]);
  assert.deepEqual([footage(layered(570)), subjects(layered(570))], [[{ shot: L, at: undefined }], [M]]);
  assert.deepEqual([footage(layered(600)), subjects(layered(600))], [[{ shot: M, at: undefined }], []]);
  assert.deepEqual([footage(layered(625)), subjects(layered(625))], [[{ shot: M, at: undefined }], [P]]);
  assert.deepEqual([footage(layered(640)), subjects(layered(640))], [[{ shot: B1, at: 634 }], [P]]);
  assert.deepEqual([footage(layered(660)), subjects(layered(660))], [[{ shot: B2, at: 649 }], [P]]);
  assert.deepEqual(footage(layered(678)), []);
  // Nothing cut out (no one there, the scene check): plain cuts on the same beats.
  assert.deepEqual([footage(draw(515)), subjects(draw(515))], [[{ shot: L, at: undefined }], []]);
  assert.deepEqual(subjects(draw(570)), []);
  assert.deepEqual(footage(draw(625)), [{ shot: P, at: undefined }]);
  assert.deepEqual(footage(draw(640)), [{ shot: B1, at: 634 }]);
  // The setting: the filler sees it (the original's first, the default), the plan keeps a choice her words asked for.
  assert.deepEqual(decode.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(decode, [{ name: "format", value: "auto" }]), {});
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: decode, name: "Titre qui se décode", n: 16, files, business: {}, request: "en vertical" });
  assert.equal(input.reglages?.[0]?.nom, "format");
  assert.equal(input.cases.length, 16);
  const plan = skillPlan({ skill: decode, name: "Titre qui se décode", files, fill: { shots: Array.from({ length: 16 }, (_, i) => ({ file: files[i % 8]!.id, at: 0 })), texts: { surtitre: "un matin chez", titre: "Atelier Rose" }, end: null, settings: { format: "vertical" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
  assert.deepEqual(plan.skill, { key: "decode", version: 4, settings: { format: "vertical" } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.sounds?.length, line.sounds!.length);
  const { readMusicShape } = await import("./music-shape.ts");
  assert.deepEqual(plan.music_shape, readMusicShape(line.music, line.duration));
});

// ——— « Cadre dans le cadre » v2, written again on its original's fiche (docs/fiches/cadre.md) ———————————————————————

/** Its composition run at a frame by sceneAt, SubjectBox giving `door` for her wide shot (sceneAt's scope has none). */
function cadreAt(code: string, frame: number, props: Record<string, unknown>, door: { x: number; y: number; w: number; h: number } | null = null): Drawn {
  const scope = globalThis as { SubjectBox?: unknown };
  scope.SubjectBox = () => door;
  try {
    return sceneAt(code, frame, props);
  } finally {
    delete scope.SubjectBox;
  }
}

test("« Cadre dans le cadre » (v2) cuts where its original does, an eighth note each on its own music (90 BPM), its music cut dead", async () => {
  const { cadre, frameBeats } = await import("./skills/cadre.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(cadre.version, 2);
  assert.equal(cadre.bpm, 90);
  const line = cadre.timeline(18, { end: false });
  // The original's cuts (images at 30 i/s, docs/fiches/cadre.md): a picture every ten images, from its fifth cut one
  // image after its eighth note, its last picture full frame on its image 171: within two images each.
  const original = [0, 10, 20, 30, 40, 51, 61, 71, 81, 91, 101, 111, 121, 131, 141, 151, 161, 171];
  assert.equal(line.shots.length, original.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - original[i]!) <= 2, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${original[i]}`));
  assert.ok(Math.abs(line.duration - 6.37) < 0.1, `${line.duration} s`);
  // Its music cut dead at the original's 5,80 s (3 images after its full frame), silent to the end; no sound of its own.
  assert.ok(Math.abs(line.music!.end!.at - 5.8) <= 1 / 30, JSON.stringify(line.music));
  assert.equal(line.music!.end!.fade, undefined);
  assert.equal(line.sounds, undefined);
  // Both labels from the first image to the last.
  assert.deepEqual(line.texts, { gauche: { from: 0, to: line.duration }, droite: { from: 0, to: line.duration } });
  // Fewer pictures: the first ones a beat each, its last notch still on beat 8 (its music's downbeat) and the full frame on
  // beat 8,5, down to ten shots; under, a beat each.
  assert.deepEqual(frameBeats(17), Array(17).fill(0.5));
  assert.deepEqual(frameBeats(12), [1, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(frameBeats(7), Array(7).fill(1));
  for (const n of [10, 13, 16]) {
    const fewer = cadre.timeline(n, { end: false });
    assert.equal(fewer.shots.length, n);
    assert.ok(Math.abs(fewer.shots.at(-1)!.start - (8.5 * 2) / 3) < 0.02, `${n} shots: ${fewer.shots.at(-1)!.start} s`);
    assert.ok(Math.abs(fewer.shots.at(-2)!.start - (8 * 2) / 3) < 0.02, `${n} shots: ${fewer.shots.at(-2)!.start} s`);
    assert.ok(Math.abs(fewer.duration - line.duration) < 0.02, `${n} shots: ${fewer.duration} s`);
  }
  assert.ok(Math.abs(cadre.timeline(8, { end: false }).duration - (8 * 2) / 3) < 0.02);
  // With an ending card (an option): the same cuts, its last picture held whole beats longer (the card's 1,6 s), its
  // music cut dead 0,8 beat before the end.
  const ended = cadre.timeline(18, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs(((ended.duration - line.duration) * 90) / 60 - 3) < 0.05, `${ended.duration} s`);
  assert.ok(Math.abs(ended.music!.end!.at - (ended.duration - 0.8 * (2 / 3))) < 0.01);
  // At another tempo (a longer Reel, a sound she follows), all of it follows its beats.
  const slower = cadre.timeline(18, { end: false, bpm: 72 });
  assert.ok(Math.abs(slower.duration / line.duration - 90 / 72) < 0.01, `${slower.duration} s`);
  // On the plan: its tempo and its music's shape, as the original's.
  const files = Array.from({ length: 18 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 }));
  const plan = skillPlan({ skill: cadre, name: "Cadre dans le cadre", files, fill: { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { gauche: "Travaux en cours", droite: "Párisi Udvar" }, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.tempo, 90);
  assert.deepEqual(plan.music_shape, { end: { at: 5.8, fade: 0.012 } });
  assert.equal(plan.sounds, undefined);
});

test("« Cadre dans le cadre » (v2): a notch larger at each cut, upright or lying as her pictures, all of it in 16:9 on her word", async () => {
  const { cadre } = await import("./skills/cadre.ts");
  const line = cadre.timeline(18, { end: false });
  const shots = (aspect: number) => line.shots.map((s, i) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: i % 3 ? "video" : "photo", aspect }));
  const style = (d: Drawn) => (d.props.style ?? {}) as Record<string, number | string>;
  const reelTexts = [
    { text: "Travaux en cours", role: "hook", from: 0, to: 190, emphasis: [] },
    { text: "Párisi Udvar", role: "caption", from: 0, to: 190, emphasis: [] },
  ];
  const draw = (frame: number, aspect: number, texts: Record<string, string> = {}, door: { x: number; y: number; w: number; h: number } | null = null, extra: Record<string, unknown> = {}) =>
    cadreAt(cadre.code, frame, { durationInFrames: 190, shots: shots(aspect), texts, reelTexts, ...extra }, door);
  /** Its picture (the whole frame, or the 16:9 one on black), its frame in it (none once the last picture fills it), the shots it lays. */
  const read = (tree: Drawn) => {
    const box = tree.children[0] as Drawn;
    const inner = drawnIn(box).filter((d) => d !== box && d.type === "div" && style(d).overflow === "hidden");
    return { box: style(box), frame: inner[0] ? style(inner[0]) : null, footage: drawnIn(box).filter((d) => d.type === "Footage") };
  };
  // Upright pictures: its frame upright (2:3), centred, 15 % of the width at the first image, 5 % more at each cut, at
  // once (the same box all through its picture), up to 95 %; the last picture takes the whole frame at its cut.
  for (let k = 0; k < 17; k++) {
    const w = 162 + 54 * k;
    for (const f of [k * 10 + 1, k * 10 + 8]) {
      const { frame } = read(draw(f, 9 / 16));
      assert.deepEqual([frame!.width, frame!.height], [w, Math.round(w * 1.5)], `image ${f}`);
      assert.ok(Math.abs(Number(frame!.left) + w / 2 - 540) <= 1 && Math.abs(Number(frame!.top) + Number(frame!.height) / 2 - 960) <= 1, `image ${f}: ${JSON.stringify(frame)}`);
    }
  }
  const full = read(draw(175, 9 / 16));
  assert.equal(full.frame, null);
  assert.deepEqual(full.footage.map((d) => [d.props.shot, style(d).width, style(d).height]), [[17, 1080, 1920]]);
  // Behind it, her wide shot frozen on its first image (played from far past the Reel's end), in a dark black and
  // white; in the frame, her picture in its own moment (a video plays, a photo stays still), the first one her wide shot.
  const opening = read(draw(5, 9 / 16)).footage;
  assert.equal(opening[0]!.props.shot, 0);
  assert.ok(Number(opening[0]!.props.at) > 190);
  assert.match(String(style(opening[0]!).filter), /grayscale\(1\).*contrast\(1\.4\)/);
  assert.deepEqual([opening[1]!.props.shot, opening[1]!.props.at], [0, undefined]);
  const later = read(draw(45, 9 / 16)).footage[1]!;
  assert.deepEqual([later.props.shot, later.props.at], [4, undefined]);
  // Her pictures mostly in width (the Budapest bench): its frame lying (3:2), the same notches in width, the Reel full
  // frame; upright again on her word.
  for (const k of [0, 8, 16]) {
    const w = 162 + 54 * k;
    const lying = read(draw(k * 10 + 2, 16 / 9));
    assert.deepEqual([lying.frame!.width, lying.frame!.height, lying.box.height], [w, Math.round(w / 1.5), 1920]);
    const upright = read(draw(k * 10 + 2, 16 / 9, { format: "vertical" })).frame!;
    assert.deepEqual([upright.width, upright.height], [w, Math.round(w * 1.5)]);
  }
  // All of it in 16:9 on black on her word: her wide shot whole, its frame lying, from 15 % to 95 % of that picture's height.
  for (const k of [0, 8, 16]) {
    const s = 0.15 + 0.05 * k;
    const wide = read(draw(k * 10 + 2, 9 / 16, { format: "horizontal" }));
    assert.deepEqual([wide.box.top, wide.box.width, wide.box.height], [656, 1080, 608]);
    assert.deepEqual([wide.frame!.width, wide.frame!.height], [Math.round(608 * s * 1.5), Math.round(608 * s)]);
    assert.ok(Math.abs(Number(wide.frame!.top) + Number(wide.frame!.height) / 2 - 304) <= 1);
  }
  // Opened first in her door, window or mirror at the back of her wide shot, near its middle: its notches from that box
  // to the centred one; one off the middle is left aside, the frame at the very centre as the original's.
  const door = { x: 480, y: 800, w: 120, h: 260 };
  assert.deepEqual(read(draw(3, 9 / 16, {}, door)).frame, { position: "absolute", left: 480, top: 800, width: 120, height: 260, overflow: "hidden" });
  const reached = read(draw(165, 9 / 16, {}, door)).frame!;
  assert.deepEqual([reached.left, reached.width, reached.height], [27, 1026, 1539]);
  assert.equal(read(draw(3, 9 / 16, {}, { ...door, x: 40 })).frame!.width, 162);
  // Its two labels over everything, fixed on the middle line 13 % from either edge, at the original's size: decor.
  const tree = draw(100, 9 / 16);
  const [left, right] = tree.children.slice(-2) as Drawn[];
  for (const [label, text] of [[left!, "Travaux en cours"], [right!, "Párisi Udvar"]] as const) {
    assert.equal(drawnText(label), text);
    assert.ok("data-fauve-decor" in label.props);
    assert.deepEqual([style(label).fontSize, style(label).top, style(label).height, style(label).textTransform, style(label).color], [24, 936, 48, "uppercase", "#ffffff"]);
  }
  assert.deepEqual([style(left!).left, style(right!).right], [140, 140]);
  // With an ending card (an option): its title above the labels' line, its line under it, the last picture a little darker.
  const card = draw(185, 9 / 16, {}, null, { end: { title: "Ouverture samedi", subtitle: "rue des Martyrs", from: 142 } });
  const boxes = drawnIn(card).filter((d) => d.type === "FitText").map(style);
  assert.ok(Number(boxes[0]!.top) + Number(boxes[0]!.height) <= 936 && Number(boxes[1]!.top) >= 984, JSON.stringify(boxes));
  assert.ok(drawnIn(card.children[0] as Drawn).some((d) => style(d).background === "#000000" && Number(style(d).opacity) > 0.3));
});

test("« Cadre dans le cadre » (v2): its door named by the filler, its format a setting, nothing cut out, zoomed nor its original's", async () => {
  const { cadre } = await import("./skills/cadre.ts");
  const { skillCode, skillFillInput, skillPlan, skillSettings } = await import("./skills.ts");
  const { clearsDrawn, drawsSubject, objectsDrawn } = await import("./subject.ts");
  // Unnamed (nothing at the back of her wide shot to open in), nothing is followed; named, it is found in her wide shot.
  assert.deepEqual(objectsDrawn(cadre.code), []);
  const named = skillCode(cadre, { porte: "door" });
  assert.deepEqual(objectsDrawn(named), [{ shot: 0, name: "door" }]);
  // Nobody is cut out, no clear area is read: its labels have their fixed place.
  assert.equal(drawsSubject(named), false);
  assert.deepEqual(clearsDrawn(cadre.code), []);
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: cadre, name: "Cadre dans le cadre", n: 18, files, business: {}, request: "" });
  assert.deepEqual(input.objets, [{ slot: "porte", case: 1, cherche: cadre.objects![0]!.want }]);
  // Its format: as her pictures by default (Tristan), the original's upright frame or all in 16:9 on her word.
  assert.deepEqual(cadre.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(cadre, [{ name: "format", value: "auto" }]), {});
  assert.equal(input.reglages?.[0]?.nom, "format");
  const plan = skillPlan({
    skill: cadre,
    name: "Cadre dans le cadre",
    files,
    fill: { shots: Array.from({ length: 18 }, (_, i) => ({ file: files[i % 12]!.id, at: Math.floor(i / 12) * 4 })), texts: { gauche: "Travaux en cours", droite: "Párisi Udvar" }, end: null, settings: { format: "horizontal" } },
  });
  assert.equal(plan.layers![0]!.motion.texts!.format, "horizontal");
  assert.deepEqual(plan.skill, { key: "cadre", version: 2, settings: { format: "horizontal" } });
  // Its notches are cuts, never a zoom; no grain nor dark corners; none of its original's words.
  assert.doesNotMatch(cadre.code, /\btransform\b|\bscale\(/);
  assert.deepEqual(cadre.finish, { grain: 0, vignette: 0 });
  assert.doesNotMatch(cadre.code + JSON.stringify(cadre.texts), /work in progress|artsiri/i);
});

// ——— « Pile de photos » v2, written again on its original's fiche (docs/fiches/pile.md) ——————————————————————————

/** The original's 37 photos as its fiche measured them, image by image at 30 i/s: when each one lands. */
const PILE_LANDS = [3, 5, 7, 10, 13, 15, 18, 21, 24, 26, 29, 32, 35, 37, 40, 42, 43, 48, 51, 54, 56, 59, 62, 65, 67, 70, 73, 76, 80, 85, 89, 95, 101, 107, 114, 123, 130];
/** Its shots as its composition gets them, from its timeline: each one's span in frames, of that shape. */
const pileShots = (line: { shots: { start: number; end: number }[] }, aspect = 16 / 9, kind = "video") =>
  line.shots.map((s, i) => ({ src: `/f${i}.mp4`, aspect, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind, segment: i }));
/** What its code lays at a frame: each photo's shot, its box and where its Footage plays from, in drawing order; and its words. */
const pileDrawn = (code: string, frame: number, props: Record<string, unknown>) => {
  const tree = drawScene(code, frame, { width: 1080, height: 1920, brand: { name: "La Fripe Rétro", displayFont: "Anton", bodyFont: "Inter Tight", accent: "#2f6b4f" }, reelTexts: [], end: null, ...props });
  const photos = drawnNodes(tree).flatMap((n) => {
    const footage = n.type === "div" && styleOf(n).overflow === "hidden" ? drawnNodes(n).find((c) => c.type === "Footage") : undefined;
    return footage ? [{ shot: footage.props.shot as number, at: footage.props.at as number, box: styleOf(n) as { left: number; top: number; width: number; height: number } }] : [];
  });
  return { tree, photos };
};

test("« Pile de photos » (v2) lays its photos where and when its original does, within two images", async () => {
  const { pile, pileLandings } = await import("./skills/pile.ts");
  assert.equal(pile.version, 3);
  assert.equal(pile.bpm, 120);
  const line = pile.timeline(37, { end: false });
  // Each photo lands on its shot's first image (the first a little in): the original's 37, within two images; its burst
  // at 2 or 3 images, its nine last on the original's own slowing gaps.
  const lands = [line.marks.first!, ...line.shots.slice(1).map((s) => Math.round(s.start * 30))];
  assert.deepEqual(lands, pileLandings(37).map((b) => Math.round(b * 15)));
  lands.forEach((f, k) => assert.ok(Math.abs(f - PILE_LANDS[k]!) <= 2, `photo ${k + 1}: image ${f}, the original's ${PILE_LANDS[k]}`));
  const gaps = lands.slice(1).map((f, k) => f - lands[k]!);
  assert.ok(gaps.slice(0, 27).every((g) => g === 2 || g === 3), gaps.join(" "));
  assert.deepEqual(gaps.slice(27), [4, 5, 4, 6, 6, 6, 7, 9, 7]);
  // 9,13 s (274 images), its second-last leaving on its hit (image 239), its last 5 images after, its words alone then.
  assert.ok(Math.abs(Math.round(line.duration * 30) - 274) <= 2, `${line.duration} s`);
  assert.ok(Math.abs(line.marks.hit! - 239) <= 2 && line.marks.last! - line.marks.hit! === 5, JSON.stringify(line.marks));
  assert.equal(line.marks.stay, 120);
  assert.deepEqual(line.texts, { mots: { from: 0, to: line.duration } });
  // Its code: each photo lands on its image, at once, and leaves 120 images later (the pile empties from the top at the
  // pace it was made, no full pile held), the second-last on the hit, the last after; nothing but its words after them.
  const shots = pileShots(line);
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const on = (f: number) => new Set(pileDrawn(pile.code, f, { durationInFrames: 275, shots, texts: marks }).photos.map((p) => p.shot));
  const seen = Array.from({ length: 276 }, (_, f) => on(f));
  for (let k = 0; k < 37; k++) {
    const from = seen.findIndex((s) => s.has(k));
    const to = seen.findIndex((s, f) => f > from && !s.has(k));
    assert.equal(from, lands[k], `photo ${k + 1} lands`);
    if (k < 35) assert.ok(Math.abs(to - (PILE_LANDS[k]! + 120)) <= 2 || (k === 16 || k === 30), `photo ${k + 1} leaves at ${to}, the original's ${PILE_LANDS[k]! + 120}`);
    if (k < 35) assert.ok(to <= lands[k]! + 120 && to < line.marks.hit!, `photo ${k + 1} leaves at ${to}`);
  }
  assert.equal(seen.findIndex((s, f) => f > lands[35]! && !s.has(35)), line.marks.hit);
  assert.equal(seen.findIndex((s, f) => f > lands[36]! && !s.has(36)), line.marks.last);
  // The top already leaves while the last two land (its image 123): the full pile is never held.
  assert.equal(seen.findIndex((s, f) => f > 3 && !s.has(0)), 123);
  assert.ok(lands[35]! <= 123 && lands[36]! > 123);
  assert.ok(!seen.some((s) => s.size === 37));
  assert.ok(seen.slice(line.marks.last!).every((s) => s.size === 0));
  assert.equal(seen[0]!.size, 0);
  // With an ending card, its cuts the same, the last shot longer for the engine's 1,6 s and its words up to the card.
  const ended = pile.timeline(37, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(ended.duration - line.duration >= 1, `${ended.duration} s`);
  assert.equal(ended.texts.mots!.to, Math.round((ended.duration - 1.6) * 100) / 100);
  // At another tempo, every length in beats follows it.
  const slower = pile.timeline(37, { end: false, bpm: 100 });
  assert.equal(slower.marks.stay, 144);
  assert.ok(Math.abs(slower.duration / line.duration - 1.2) < 0.01, `${slower.duration} s`);
});

test("« Pile de photos » (v2): the original's boxes cropped square but three, her photos still, her videos playing while on top", async () => {
  const { pile } = await import("./skills/pile.ts");
  const line = pile.timeline(37, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const shots = pileShots(line);
  const draw = (f: number, extra: Record<string, unknown> = {}) => pileDrawn(pile.code, f, { durationInFrames: 275, shots, texts: marks, ...extra });
  const lands = (k: number) => (k ? Math.round(line.shots[k]!.start * 30) : line.marks.first!);
  // The pile as the last one lands (its first three already gone, as the original's at its image 130): later ones on top.
  const full = draw(lands(36)).photos;
  assert.deepEqual(full.map((p) => p.shot), Array.from({ length: 34 }, (_, i) => i + 3));
  // In the original's boxes (centres and sides measured at 1080 × 1920, within a few pixels): its 27th a big 2:3 portrait,
  // its 35th a 4:5, the others square, no turn, no border, no shadow.
  const box = (k: number) => draw(lands(k)).photos.find((p) => p.shot === k)!.box;
  const measured: Record<number, [number, number, number, number]> = { 0: [349, 511, 308, 458], 2: [568, 426, 477, 474], 14: [432, 897, 366, 372], 26: [734, 1269, 446, 660], 34: [824, 1477, 339, 424], 36: [584, 1503, 363, 360] };
  for (const [k, [cx, cy, w, hh]] of Object.entries(measured)) {
    const b = box(Number(k));
    assert.ok(Math.abs(b.left + b.width / 2 - cx) <= 6 && Math.abs(b.top + b.height / 2 - cy) <= 6, `photo ${Number(k) + 1}: ${JSON.stringify(b)}`);
    assert.ok(Math.abs(b.width - w) <= 8 && Math.abs(b.height - hh) <= 8, `photo ${Number(k) + 1}: ${JSON.stringify(b)}`);
  }
  const shapes = Array.from({ length: 37 }, (_, k) => Math.round((box(k).width / box(k).height) * 100) / 100);
  assert.deepEqual(shapes.flatMap((a, k) => (a !== 1 ? [[k, a]] : [])), [[0, 0.67], [26, 0.67], [34, 0.8]]);
  assert.ok(!drawnNodes(draw(130).tree).some((n) => /rotate|scale/.test(String(styleOf(n).transform ?? "none")) && n.type === "div" && styleOf(n).overflow === "hidden"));
  assert.doesNotMatch(pile.code, /boxShadow|border:/);
  // Each shot plays from its photo's landing (a video while it lies on top, until the next one lands, then it holds; a
  // photo stays still); her last one plays its whole stay.
  for (const p of full) assert.equal(p.at, lands(p.shot));
  for (let k = 1; k < 36; k++) assert.equal(Math.round(line.shots[k]!.end * 30), lands(k + 1), `shot ${k + 1}`);
  assert.ok(line.shots.at(-1)!.end - line.shots.at(-1)!.start > (line.marks.last! - lands(36)) / 30);
  // Fewer photos: bigger squares on the same surface, the first still in portrait; on her word, each at its own shape or
  // all in portrait 4:5.
  const few = pile.timeline(12, { end: false });
  const fewShots = pileShots(few, 3 / 4, "photo");
  const fewMarks = Object.fromEntries(Object.entries(few.marks).map(([k, v]) => [k, String(v)]));
  const fewBox = (f: number, settings: Record<string, string> = {}) => pileDrawn(pile.code, f, { durationInFrames: Math.round(few.duration * 30), shots: fewShots, texts: { ...fewMarks, ...settings } }).photos.at(-1)!.box;
  const third = Math.round(few.shots[3]!.start * 30);
  assert.ok(fewBox(third).width >= 480 && fewBox(third).width === fewBox(third).height, JSON.stringify(fewBox(third)));
  assert.ok(Math.abs(fewBox(third, { format: "forme" }).width / fewBox(third, { format: "forme" }).height - 0.75) < 0.01);
  assert.ok(Math.abs(fewBox(third, { format: "portrait" }).width / fewBox(third, { format: "portrait" }).height - 0.8) < 0.01);
  assert.deepEqual(pile.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["carre", "forme", "portrait"]]]);
  // The page stays white, without grade: her photos keep their colours.
  assert.deepEqual(pile.finish, { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 });
  assert.equal(styleOf(draw(0).tree).backgroundColor, "#fdfdfd");
  // 20 files at least before Edith asks for more (under 20, no burst), 40 at most.
  assert.deepEqual([pile.files, pile.shots], [[20, 40], [8, 40]]);
});

test("« Pile de photos » (v2): her words in front, as tall and condensed as its original's, in her colour, never its yellow", async () => {
  const { pile } = await import("./skills/pile.ts");
  const line = pile.timeline(37, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const reelTexts = [{ text: "La\u00a0Fripe\u00a0Rétro", role: "hook", from: 0, to: 275, emphasis: [] }];
  const draw = (f: number, brand: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    pileDrawn(pile.code, f, { durationInFrames: 275, shots: pileShots(line), texts: marks, reelTexts, brand: { name: "La Fripe Rétro", displayFont: "Anton", bodyFont: "Inter Tight", accent: "#2f6b4f", ...brand }, ...extra }).tree;
  const words = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "div" && styleOf(n).height === 211);
  // Her name split one word a line (its no-break spaces too), in two pairs, from the first image to the last, in front of
  // the photos (drawn after them).
  for (const f of [0, 130, 274]) assert.deepEqual(words(draw(f)).map(drawnText), ["LA", "FRIPE", "RÉTRO"]);
  assert.deepEqual(words(draw(0)).map((n) => styleOf(n).marginTop), [0, 0, 74]);
  const kids = drawnNodes(draw(130))[0]!.children.flat(Infinity) as Drawn[];
  assert.ok(kids.findIndex((n) => n && heldText(n).includes("FRIPE")) > kids.findIndex((n) => n && Array.isArray(n.children) && drawnNodes(n).some((c) => c.type === "Footage")));
  // Capitals of 140 px (Anton's 132 at 154 px, its bars thickened by four copies of its own colour 2 and 4 px above and
  // under it), squeezed to two thirds: within 140 to 940 px once squeezed.
  const wrap = drawnNodes(draw(0)).find((n) => /scaleX/.test(String(styleOf(n).transform ?? "")))!;
  assert.equal(styleOf(wrap).transform, "scaleX(0.66)");
  const w = Number(styleOf(wrap).width);
  assert.ok(Math.abs(Number(styleOf(wrap).left) + w / 2 - 540) <= 1 && Math.abs(w * 0.66 - 800) <= 1, JSON.stringify(styleOf(wrap)));
  assert.equal(styleOf(words(draw(0))[0]!).fontSize, 154);
  assert.equal(styleOf(words(draw(0))[0]!).textShadow, "0 2px 0 #2f6b4f, 0 -2px 0 #2f6b4f, 0 4px 0 #2f6b4f, 0 -4px 0 #2f6b4f");
  // Her own face is never squeezed nor thickened.
  assert.ok(!drawnNodes(draw(0, { displayFont: "Playfair Display" })).some((n) => /scaleX/.test(String(styleOf(n).transform ?? ""))));
  assert.equal(styleOf(words(draw(0, { displayFont: "Playfair Display" }))[0]!).textShadow, undefined);
  // Her colour; one too pale for the white page (paler than the original's yellow there), her dark one, else ink.
  assert.equal(styleOf(words(draw(0))[0]!).color, "#2f6b4f");
  assert.equal(styleOf(words(draw(0, { accent: "#f3efe6", palette: { dark: "#3a2a1f" } }))[0]!).color, "#3a2a1f");
  assert.equal(styleOf(words(draw(0, { accent: "#ffffff" }))[0]!).color, "#161616");
  assert.ok(!/fbd201|ffe100/i.test(pile.code) && !/THIS|WORK/.test(pile.code));
  // More than four words: four lines at most, none ending on a word that belongs to the next.
  const long = draw(0, {}, { reelTexts: [{ text: "nos pièces uniques chinées à la main", role: "hook", from: 0, to: 275, emphasis: [] }] });
  const set = words(long).map(drawnText);
  assert.ok(set.length <= 4 && !set.slice(0, -1).some((l) => /(^| )(À|LA)$/.test(l)), set.join(" / "));
  // Its ending card, after the pile: its title in the same capitals, a line under it.
  const ended = pile.timeline(37, { end: true });
  const endFrom = Math.round(ended.duration * 30) - 48;
  const card = drawScene(pile.code, endFrom + 5, { width: 1080, height: 1920, durationInFrames: Math.round(ended.duration * 30), brand: { name: "La Fripe Rétro", displayFont: "Anton", bodyFont: "Inter Tight", accent: "#2f6b4f" }, shots: pileShots(ended), texts: Object.fromEntries(Object.entries(ended.marks).map(([k, v]) => [k, String(v)])), reelTexts, end: { title: "Vide-dressing samedi", subtitle: "de 10 h à 18 h", from: endFrom } });
  assert.deepEqual(words(card).map(drawnText), ["VIDE-DRESSING", "SAMEDI"]);
  assert.ok(heldText(card).includes("de 10 h à 18 h") && !heldText(card).includes("FRIPE"));
});

test("« Pile de photos » (v2): its clicks slowing down on its measured moments, a dry knock as the pile empties, its music lighter after", async () => {
  const { pile } = await import("./skills/pile.ts");
  const { skillPlan } = await import("./skills.ts");
  const line = pile.timeline(37, { end: false });
  // The original's clicks from 1,6 s (images, measured on its sound) and its hit at 7,962 s: each within two images.
  const original = [48, 50.1, 52.1, 54.2, 56.5, 58.9, 61, 63.7, 66.7, 69.6, 72.8, 75.6, 79.4, 83, 86.7, 90.9, 95.6, 100.4, 105.5, 111.1, 117.4, 124, 131.3, 139.7, 148.7, 159.1, 170.8, 184.1, 199.6, 218.2, 238.9];
  // (Those laid one by one; its denser clicking before, one burst since v3.)
  const sounds = line.sounds!.filter((s) => !s.burst);
  assert.equal(sounds.length, original.length);
  sounds.forEach((s, i) => assert.ok(Math.abs(s.at * 30 - original[i]!) <= 2, `sound ${i + 1}: image ${s.at * 30}, the original's ${original[i]}`));
  assert.ok(sounds.slice(0, -1).every((s) => s.sound === "light click" && s.seconds === 0.5 && s.gain! < 6 && s.gain! >= -12));
  // The knock on the hit, the loudest, where the second-last leaves; no paper sound on each photo (its original has none).
  assert.deepEqual(sounds.at(-1), { at: line.marks.hit! / 30, sound: "dry knock", seconds: 0.5, gain: 6 });
  assert.ok(!sounds.some((s) => /paper|whoosh|pop/.test(s.sound)));
  // Its music lighter from the hit (without its bass) to its end, which it reaches without fading.
  assert.deepEqual(line.music, { filters: [{ kind: "thin", from: line.marks.hit! / 30, to: line.duration }], end: { at: line.duration, fade: 0.02 } });
  // On her plan, valid: its sounds (under the 40 a Reel takes) and its music's shape, as its original plays them; at
  // another tempo, they follow its beats.
  const files = Array.from({ length: 37 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 }));
  const fill = { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { mots: "La Fripe Rétro" }, end: null };
  const plan = skillPlan({ skill: pile, name: "Pile de photos", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.sounds?.length, 32);
  assert.ok(plan.sounds!.every((s) => s.skill));
  assert.deepEqual(plan.music_shape, { filters: [{ kind: "thin", from: 8, to: plan.duration, open: 0.02 }], end: { at: plan.duration, fade: 0.02 } });
  assert.deepEqual(plan.skill, { key: "pile", version: 3 });
  const slower = skillPlan({ skill: pile, name: "Pile de photos", files, fill, bpm: 100 });
  assert.ok(Math.abs(slower.sounds!.at(-1)!.at - 9.6) < 0.01, `${slower.sounds!.at(-1)!.at}`);
  // Fewer photos: the same clicks counted back from its hit, none before the first photo.
  const few = pile.timeline(8, { end: false });
  assert.ok(few.sounds!.every((s) => s.at >= few.marks.first! / 30) && few.sounds!.at(-1)!.at === few.marks.hit! / 30);
});

// ——— « Titre derrière le décor » v2, written again on its original's fiche (docs/fiches/titre-derriere.md) ————————————

type TdBox = { x: number; y: number; w: number; h: number };
/**
 * What its Scene draws at a frame, as drawScene does, with what the engine reads before the render given: a cut-out's
 * box (SubjectBox), its outline (SubjectOutline, an SVG path) and its pieces (SubjectParts), by shot and object
 * (« 0#rooftops », « 9 » for her subject); where its sky ends (SkylineAt, by shot and span) and its light (LightUnder);
 * Subject and the other drawing tools named nodes.
 */
function drawCutOuts(
  code: string,
  frame: number,
  props: Record<string, unknown>,
  read: { boxes?: Record<string, TdBox>; outlines?: Record<string, string>; parts?: Record<string, TdBox[]>; skyline?: (shot: number | undefined, span: { from?: number; to?: number }) => number | null; light?: { mean: number; high: number } } = {},
): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const interpolate = (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1)));
  const key = (shot: { segment?: number } | undefined, object?: string) => `${shot?.segment ?? "?"}${object ? `#${object}` : ""}`;
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    Near: "Near",
    Skyline: "Skyline",
    CastShadow: "CastShadow",
    Look: "Look",
    Sketch: "Sketch",
    Ascii: "Ascii",
    Easing: { bezier: () => (t: number) => t },
    useCurrentFrame: () => frame,
    interpolate,
    ClearBox: (_shot: unknown, _frame: number, _laid: unknown, options?: { fallback?: unknown }) => options?.fallback ?? null,
    SubjectBox: (shot: { segment?: number } | undefined, _frame: number, _laid: unknown, object?: string) => read.boxes?.[key(shot, object)] ?? null,
    SubjectOutline: (shot: { segment?: number } | undefined, _frame: number, _laid: unknown, object?: string) => read.outlines?.[key(shot, object)] ?? null,
    SubjectParts: (shot: { segment?: number } | undefined, _frame: number, _laid: unknown, object?: string) => read.parts?.[key(shot, object)] ?? [],
    SkylineAt: (shot: { segment?: number } | undefined, _frame: number, _laid: unknown, span: { from?: number; to?: number } = {}) => read.skyline?.(shot?.segment, span) ?? null,
    LightUnder: () => read.light ?? null,
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}

/** The original's cuts (its images, 30 i/s, measured image by image), and its last image: 23 shots in 12,03 s. */
const TD_CUTS = [0, 101, 133, 139, 144, 150, 174, 187, 204, 221, 275, 306, 310, 313, 317, 320, 324, 328, 331, 335, 338, 342, 346];
/** Its music's first beat: its image 2,1 (0,07 s). Its model starts on it, its composed music's first beat. */
const TD_FIRST_BEAT = 2.1;

test("« Titre derrière le décor » (v2) cuts where its original does, on its own music (82,9 BPM), stopped one beat a bar", async () => {
  const { titreDerriere } = await import("./skills/titre-derriere.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(titreDerriere.version, 2);
  assert.equal(titreDerriere.bpm, 82.9);
  const line = titreDerriere.timeline(23, { end: false });
  // Its 23 shots, each cut within two images of the original's, counted from their music's first beat (the original
  // shows two images before it, the model none: its music's first beat is its first image).
  assert.equal(line.shots.length, TD_CUTS.length);
  line.shots.forEach((s, i) => {
    const at = Math.round(s.start * 30);
    if (i) assert.ok(Math.abs(at - (TD_CUTS[i]! - TD_FIRST_BEAT)) <= 2, `shot ${i + 1}: image ${at}, the original's ${TD_CUTS[i]} (its beat at ${TD_FIRST_BEAT})`);
    // On the original's own clock, those two images earlier: never more than four.
    if (i) assert.ok(TD_CUTS[i]! - at >= -2 && TD_CUTS[i]! - at <= 4, `shot ${i + 1}: image ${at}, the original's ${TD_CUTS[i]}`);
  });
  assert.ok(Math.abs(line.duration - (12.03 - 0.07)) < 0.05, `${line.duration} s`);
  // Its burst: eleven shots of 3 or 4 images from beat 14 (the original: 4 3 4 3 4 4 3 4 3 4 4).
  const burst = line.shots.slice(11, 22).map((s) => Math.round((s.end - s.start) * 30));
  assert.ok(burst.every((l) => l === 3 || l === 4) && burst.reduce((a, b) => a + b, 0) === 40, JSON.stringify(burst));
  // Its title rises from two images before the hit (half a beat in), its small words from the hit; both go with the cut.
  const hit = line.marks.hit!;
  assert.ok(Math.abs(hit - (12 - TD_FIRST_BEAT)) <= 1.5, `hit ${hit}`);
  assert.equal(Math.round(line.texts.titre!.from * 30), hit - 2);
  assert.equal(Math.round(line.texts.surtitre!.from * 30), hit);
  assert.equal(line.texts.titre!.to, line.shots[1]!.start);
  // Its paper from the music's return (image 47), its wave (67), the wheel's pieces (162), the wall's flashes (253 and
  // 256), its next shot's silhouette (263): within two images of the original's.
  for (const [name, image] of [["chase", 47], ["wave", 67], ["pieces", 162], ["flash", 253], ["ghost", 263]] as const)
    assert.ok(Math.abs(line.marks[name]! - (image - TD_FIRST_BEAT)) <= 2, `${name}: ${line.marks[name]}, the original's ${image}`);
  // Its music: silent to beat 2 but for the whoosh into the hit, then stopped dead one beat in every bar (the original's
  // 3,60–4,40 · 6,55–7,30 · 9,40–10,20 s, from its first beat), cut dead with the picture.
  const beat = 60 / 82.9;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  assert.deepEqual(line.music, {
    pauses: [{ from: 0, to: r3(2 * beat) }, { from: r3(5 * beat), to: r3(6 * beat) }, { from: r3(9 * beat), to: r3(10 * beat) }, { from: r3(13 * beat), to: r3(14 * beat) }],
    end: { at: line.duration },
  });
  const stops: [number, number][] = [[3.6, 4.4], [6.55, 7.3], [9.4, 10.2]];
  line.music!.pauses!.slice(1).forEach((p, i) => assert.ok(Math.abs(p.from - (stops[i]![0] - 0.07)) < 0.1 && Math.abs(p.to - (stops[i]![1] - 0.07)) < 0.1, JSON.stringify(p)));
  // Its cuts on the music's returns (beats 6, 10, 14) and the calm shots over its stops.
  for (const b of [6, 10, 14]) assert.ok(line.shots.some((s) => Math.abs(s.start - b * beat) <= 1 / 30), `a cut on beat ${b}`);
  // Its sounds: the low whoosh that rises into the hit, and one dry knock in the third stop (the original's 6,96 s).
  assert.deepEqual(line.sounds?.map((s) => [s.at, s.sound]), [[r3(0.5 * beat), "low whoosh rising into a deep bass hit"], [r3(9.52 * beat), "single dry drum hit"]]);
  assert.ok(Math.abs(line.sounds![1]!.at - (6.96 - 0.07)) < 0.02);
  // Fewer shots: a shorter burst from beat 14, the same end, just after the snare; more (a length she asks): bars of a
  // held shot and a calm one on the music's stop before it, its sections where they were.
  const fewer = titreDerriere.timeline(14, { end: false });
  assert.equal(fewer.shots.length, 14);
  assert.deepEqual(fewer.shots.slice(0, 12).map((s) => s.start), line.shots.slice(0, 12).map((s) => s.start));
  assert.equal(fewer.duration, line.duration);
  const longer = titreDerriere.timeline(35, { end: false });
  assert.equal(longer.shots.length, 35);
  assert.deepEqual(longer.shots.slice(0, 11).map((s) => s.start), line.shots.slice(0, 11).map((s) => s.start));
  assert.ok(Math.abs(longer.duration - 30) < 1, `${longer.duration} s`);
  assert.equal(longer.music!.pauses!.length, 4 + 6);
  // With an ending card, its last shot held whole bars of two beats longer (the card's 1,6 s), its cuts the same.
  const ended = titreDerriere.timeline(23, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  const held = (ended.duration - line.duration) / beat;
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs(held - 2 * Math.round(held / 2)) < 0.05, `${ended.duration} s`);
  // Its finish keeps the original's warmth and contrast, without the catalogue's grain nor dark corners.
  assert.deepEqual(titreDerriere.finish, { contrast: 0.16, warmth: 0.12, grain: 0, vignette: 0 });
  // On the plan: valid, its music's shape and its sounds kept.
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const plan = skillPlan({ skill: titreDerriere, name: "Titre derrière le décor", files, fill: { shots: Array.from({ length: 23 }, (_, i) => ({ file: files[i % 12]!.id, at: i < 12 ? 1 : 6 })), texts: { surtitre: "un samedi à", titre: "Brighton" }, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.music_shape?.pauses?.length, 4);
  assert.deepEqual(plan.sounds?.map((s) => s.skill), [true, true]);
});

test("« Titre derrière le décor » (v2): its scenery named by the filler passes in front of its title, then turns to paper piece by piece", async () => {
  const { titreDerriere } = await import("./skills/titre-derriere.ts");
  const { skillCode } = await import("./skills.ts");
  const { objectsDrawn, drawsSubject, OBJECT_MAX } = await import("./subject.ts");
  // Unnamed (nothing in her shots fits), no object; named, the four it follows, each on its shot, within a Reel's four.
  assert.deepEqual(objectsDrawn(titreDerriere.code), []);
  const code = skillCode(titreDerriere, { decor: "rooftops", morceaux: "every lamp", enseigne: "shop sign", cadres: "every frame" });
  assert.deepEqual(
    objectsDrawn(code).sort((a, b) => a.shot - b.shot),
    [{ shot: 0, name: "rooftops" }, { shot: 5, name: "every lamp" }, { shot: 7, name: "shop sign" }, { shot: 9, name: "every frame" }],
  );
  assert.ok(objectsDrawn(code).length <= OBJECT_MAX);
  const { checkMotionCode } = await import("./motion-scene.ts");
  assert.deepEqual(checkMotionCode(code), []);
  // Her subject too: on her first shot, the wall's big thing in front, the next shot's silhouette.
  assert.ok(drawsSubject(code));
  assert.deepEqual(titreDerriere.objects?.map((o) => [o.slot, o.shot]), [["decor", 0], ["morceaux", 5], ["enseigne", 7], ["cadres", 9]]);
  // Its own colours, measured on the original: never its old lighter red nor a light edge around the letters.
  assert.match(code, /#640005/);
  assert.doesNotMatch(code, /#7a1414|textShadow: "0 0 1px rgba\(251/);
  const line = titreDerriere.timeline(23, { end: false });
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: 16 / 9, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const cut = shots[1]!.from;
  const reelTexts = [
    { text: "un samedi à", role: "caption", from: line.marks.hit, to: cut, emphasis: [] },
    { text: "Brighton", role: "hook", from: line.marks.hit! - 2, to: cut, emphasis: [] },
  ];
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const props = { width: 1080, height: 1920, durationInFrames: Math.round(line.duration * 30), brand: { name: "Brighton Pier", displayFont: "Archivo Black", bodyFont: "Caveat" }, shots, reelTexts, end: null, texts: marks };
  // The rooftops' top at 300 px of its 4:3 frame (1080 × 810): its foot half a capital under it.
  const read = { boxes: { "0#rooftops": { x: 100, y: 250, w: 800, h: 400 } }, parts: { "0#rooftops": [500, 100, 300, 700, 900].map((x) => ({ x, y: 260, w: 90, h: 300 })) } };
  const draw = (f: number, r: Parameters<typeof drawCutOuts>[3] = read) => drawCutOuts(code, f, props, r);
  const frameBox = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden" && styleOf(n).top === 555)!;
  // Its title's box: the only text box of its first shot (its letters one span each while the wave runs).
  const titleBox = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "FitText" && heldText(n).replace(/\s/g, "").includes("BRIGHTON"));
  // Its title rises from below onto the hit in three images, blurred, and lands: 0,65 · 0,29 · 0,09 · 0,015 of its capitals.
  const lifts = [9, 10, 11, 12, 13, 14].map((f) => {
    const div = drawnNodes(titleBox(draw(f))!).find((n) => n.type === "div" && /translateY/.test(String(styleOf(n).transform)) && drawnText(n).includes("BRIGHTON"))!;
    return Number(/translateY\((-?[\d.]+)px\)/.exec(String(styleOf(div).transform))![1]);
  });
  assert.ok(lifts.every((l, i) => i === 0 || l < lifts[i - 1]! || l === 0) && lifts[0]! > 90 && lifts.at(-1) === 0, JSON.stringify(lifts));
  assert.equal(titleBox(draw(8)), undefined);
  // Its box's foot half a capital (about its width over its 8 letters) under the rooftops' top, its width 90,7 % of the frame's.
  const fit = titleBox(draw(30))!.props.style as { left: number; top: number; width: number; height: number };
  assert.ok(Math.abs(fit.top + fit.height - (250 + (0.5 * 980) / 8)) <= 1, JSON.stringify(fit));
  assert.equal(fit.width, Math.round(1080 * 0.907));
  // Its outline, when read: the second highest of its tops across the title's width (a pole rising past it in one sixth).
  const footOf = (r: Parameters<typeof drawCutOuts>[3]) => {
    const s = titleBox(draw(30, r))!.props.style as { top: number; height: number };
    return s.top + s.height;
  };
  const skyline = "M 100 300 C 250 280 400 100 420 100 C 600 290 750 310 900 320 C 1000 330 1000 330 1000 330";
  assert.ok(Math.abs(footOf({ ...read, outlines: { "0#rooftops": skyline } }) - (280 + (0.5 * 980) / 8)) <= 1);
  // Without anything named in front: the bottom of its sky, else the original's place, its foot at 41,3 %.
  const bare = titleBox(draw(30, {}))!.props.style as { top: number; height: number };
  assert.equal(bare.top + bare.height, Math.round(810 * 0.413));
  // What rises past its highest place is not laid over it: the title in front, at its sky's or the original's place.
  const towering = { ...read, outlines: { "0#rooftops": "M 100 40 C 300 40 500 40 700 40 C 900 40 1000 40 1000 40" } };
  assert.equal(footOf(towering), Math.round(810 * 0.413));
  assert.ok(!drawnNodes(frameBox(draw(30, towering))).some((n) => n.type === "Subject" && n.props.object === "rooftops" && !n.props.fill));
  // The rooftops cut out over it, then her when her head rises into it (never when she towers over it).
  const order = (tree: Drawn) => frameBox(tree).children.flat(Infinity).filter((c): c is Drawn => Boolean(c && typeof c === "object" && "type" in c));
  const kids = order(draw(30));
  const at = (pred: (n: Drawn) => boolean) => kids.findIndex((n) => drawnNodes(n).some(pred));
  assert.ok(at((n) => n.type === "FitText") < at((n) => n.type === "Subject" && n.props.object === "rooftops"));
  const withHer = (y: number) => drawnNodes(frameBox(draw(30, { ...read, boxes: { ...read.boxes, "0": { x: 400, y, w: 200, h: 500 } } }))).some((n) => n.type === "Subject" && n.props.shot === 0 && !n.props.object && !n.props.fill);
  assert.equal(withHer(240), true);
  assert.equal(withHer(60), false);
  // From the music's return: its pieces in paper white one at a time, left to right, three images each: the picture
  // kit's Subject part, the k-th of SubjectParts (here out of order), cut to its own outline when the card read it
  // apart, else to its box (slices of it when the scenery is in one piece).
  const lit = (f: number) => {
    const piece = drawnNodes(frameBox(draw(f))).find((n) => n.type === "Subject" && n.props.fill === "#EFEDE9" && typeof n.props.part === "number");
    if (!piece) return null;
    assert.deepEqual([piece.props.shot, piece.props.object, piece.props.slices], [0, "rooftops", 5]);
    return read.parts["0#rooftops"][piece.props.part as number]!.x;
  };
  const chase = line.marks.chase!;
  assert.equal(lit(chase - 1), null);
  assert.deepEqual([0, 3, 6, 9, 12].map((d) => lit(chase + d)), [100, 300, 500, 700, 900]);
  assert.equal(lit(chase + 15), null);
  // Then the white wave: one letter at a time, never two, left to right, 2 or 3 images each.
  const wave = line.marks.wave!;
  const litLetters: number[] = [];
  for (let f = wave - 2; f < cut; f++) {
    const spans = drawnNodes(titleBox(draw(f))!).filter((n) => n.type === "span" && styleOf(n).color === "#FCF8F9");
    assert.ok(spans.length <= 1, `image ${f}: ${spans.length} letters lit`);
    if (spans.length) litLetters.push(f);
  }
  assert.equal(litLetters[0], wave);
  assert.ok(litLetters.length >= 8 * 2 && litLetters.length <= 8 * 3, `${litLetters.length} images`);
});

test("« Titre derrière le décor » (v2): its sign blinks, the wall's big thing flashes twice, the next shot's silhouette, its zoom blur", async () => {
  const { titreDerriere } = await import("./skills/titre-derriere.ts");
  const { skillCode } = await import("./skills.ts");
  const code = skillCode(titreDerriere, { enseigne: "neon sign", cadres: "every arch" });
  const line = titreDerriere.timeline(23, { end: false });
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: 16 / 9, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const props = { width: 1080, height: 1920, durationInFrames: Math.round(line.duration * 30), brand: { name: "Studio", displayFont: "Archivo Black", bodyFont: "Caveat" }, shots, reelTexts: [], end: null, texts: marks };
  const subjects = (f: number) => drawnNodes(drawCutOuts(code, f, props)).filter((n) => n.type === "Subject");
  // Its sign in paper white over the last eight images of its shot, one in two, irregular: 1 0 1 0 1 1 0 1.
  const signCut = shots[7]!.from + shots[7]!.durationInFrames;
  const blinks = Array.from({ length: 10 }, (_, i) => subjects(signCut - 9 + i).filter((n) => n.props.object === "neon sign").length);
  assert.deepEqual(blinks, [0, 1, 0, 1, 0, 1, 1, 0, 1, 0]);
  // The wall's big thing (her subject there) in paper white for one image, twice, three images apart.
  const flash = line.marks.flash!;
  const white9 = (f: number) => subjects(f).some((n) => n.props.shot === 9 && !n.props.object && n.props.fill === "#EFEDE9");
  assert.deepEqual([flash - 1, flash, flash + 1, flash + 2, flash + 3, flash + 4].map(white9), [false, true, false, false, true, false]);
  // The next shot's subject, a still white silhouette at its place, from the beat to the cut that shows it.
  const ghost = (f: number) => subjects(f).some((n) => n.props.shot === 10 && n.props.fill === "#EFEDE9");
  assert.equal(ghost(line.marks.ghost! - 1), false);
  assert.equal(ghost(line.marks.ghost!), true);
  assert.equal(ghost(shots[10]!.from - 1), true);
  assert.equal(ghost(shots[10]!.from), false);
  // The shot towards her door opens on a zoom blur (copies of its picture, larger each), strong then less, then as filmed.
  const copies = (f: number) => drawnNodes(drawCutOuts(code, f, props)).filter((n) => n.type === "Footage").length;
  const door = shots[8]!.from;
  assert.deepEqual([door - 1, door, door + 1, door + 2].map(copies), [1, 6, 6, 1]);
  // Nothing in its frames named: the wall's subject turns white at once for 3 images from its cut.
  const bare = skillCode(titreDerriere, {});
  const plainWall = (f: number) => drawnNodes(drawCutOuts(bare, f, props)).some((n) => n.type === "Subject" && n.props.shot === 9 && n.props.fill === "#EFEDE9");
  assert.deepEqual([0, 1, 2, 3].map((d) => plainWall(shots[9]!.from + d)), [true, true, true, false]);
});

test("« Titre derrière le décor » (v2): horizontal 4:3 on black as its original when her files are, full frame otherwise or on her word", async () => {
  const { titreDerriere } = await import("./skills/titre-derriere.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const line = titreDerriere.timeline(23, { end: false });
  const draw = (aspects: number[], frame: number, extra: Record<string, string> = {}) => {
    const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: aspects[i % aspects.length]!, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
    const texts = { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...extra };
    return drawCutOuts(titreDerriere.code, frame, { width: 1080, height: 1920, durationInFrames: 359, brand: { name: "Studio", displayFont: "Archivo Black", bodyFont: "Caveat" }, shots, reelTexts: [{ text: "Brighton", role: "hook", from: 9, to: 99, emphasis: [] }], end: null, texts });
  };
  const frameOf = (tree: Drawn) => {
    const box = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden" && styleOf(n).backgroundColor === "#000000")!;
    return { top: styleOf(box).top, height: styleOf(box).height };
  };
  const wide = [16 / 9];
  const tall = [9 / 16];
  // Her files mostly horizontal: the original's 4:3 picture (1080 × 810) at the middle of the frame, on black.
  assert.deepEqual(frameOf(draw(wide, 120)), { top: 555, height: 810 });
  assert.deepEqual(frameOf(draw([16 / 9, 16 / 9, 9 / 16], 120)), { top: 555, height: 810 });
  // Mostly vertical: full frame; on her word, the other format.
  assert.deepEqual(frameOf(draw(tall, 120)), { top: 0, height: 1920 });
  assert.equal(frameOf(draw(wide, 120, { format: "vertical" })).height, 1920);
  assert.equal(frameOf(draw(tall, 120, { format: "horizontal" })).top, 555);
  // Its title across its width, in its upper half, its glyphs above the apps' buttons in both formats.
  for (const aspects of [wide, tall]) {
    const tree = draw(aspects, 40);
    const { top } = frameOf(tree);
    const fit = drawnNodes(tree).find((n) => n.type === "FitText")!.props.style as { left: number; top: number; width: number; height: number };
    assert.ok(Math.abs(fit.left + fit.width / 2 - 540) <= 1 && fit.left >= 40, JSON.stringify(fit));
    assert.ok(Number(top) + fit.top + fit.height < 940, JSON.stringify(fit));
  }
  // The setting: the filler sees it (the original's first, the default), the plan keeps a choice her words asked for.
  assert.deepEqual(titreDerriere.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(titreDerriere, [{ name: "format", value: "auto" }]), {});
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: titreDerriere, name: "Titre derrière le décor", n: 23, files, business: {}, request: "en vertical" });
  assert.equal(input.reglages?.[0]?.nom, "format");
  assert.deepEqual(input.objets?.map((o) => [o.slot, o.case]), [["decor", 1], ["morceaux", 6], ["enseigne", 8], ["cadres", 10]]);
  const plan = skillPlan({ skill: titreDerriere, name: "Titre derrière le décor", files, fill: { shots: Array.from({ length: 23 }, (_, i) => ({ file: files[i % 12]!.id, at: 1 })), texts: { surtitre: "un samedi à", titre: "Brighton" }, end: null, settings: { format: "vertical" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
  assert.deepEqual(plan.skill, { key: "titre-derriere", version: 2, settings: { format: "vertical" } });
});

// ——— « Ville en coups de fouet » v2, written again on its original's fiche (docs/fiches/coups-de-fouet.md) ——————————

/** Its shots as a composition gets them, on its timeline for n shots: each of that shape (width / height), or a photo. */
async function fouetShots(n: number, aspect = 16 / 9, photos: number[] = []) {
  const { coupsDeFouet } = await import("./skills/coups-de-fouet.ts");
  const line = coupsDeFouet.timeline(n, { end: false });
  const shots = line.shots.map((s, i) => ({
    src: `/v${i}.mp4`,
    aspect,
    from: Math.round(s.start * 30),
    durationInFrames: Math.round((s.end - s.start) * 30),
    kind: photos.includes(i) ? "photo" : "video",
    segment: i,
  }));
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  return { code: coupsDeFouet.code, line, shots, marks, durationInFrames: Math.round(line.duration * 30) };
}

test("« Ville en coups de fouet » (v2) cuts where its original does, on its own music (84 BPM), its percussion on its cuts", async () => {
  const { coupsDeFouet, fouetRoles } = await import("./skills/coups-de-fouet.ts");
  const { skillPlan } = await import("./skills.ts");
  const { clearsDrawn, objectsDrawn, drawsSubject } = await import("./subject.ts");
  assert.equal(coupsDeFouet.version, 3);
  assert.equal(coupsDeFouet.bpm, 84);
  assert.deepEqual(coupsDeFouet.shots, [12, 23]);
  // The original's 23 shots, cut on its images 20, 55 … 595 (measured image by image at 30 i/s; a whip flash's cut on its
  // second image): within two images each, the last held to its 23,3 s.
  const line = coupsDeFouet.timeline(23, { end: false });
  const original = [0, 20, 55, 86, 106, 133, 160, 189, 226, 257, 274, 298, 330, 366, 390, 413, 438, 466, 494, 513, 543, 571, 595];
  assert.equal(line.shots.length, original.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - original[i]!) <= 2, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${original[i]}`));
  assert.ok(Math.abs(line.duration - 23.3) < 0.05, `${line.duration} s`);
  // Fewer shots leave out shots of its middle, never its opening, its name, its signature shots nor its last; the four cuts
  // the original lays on a beat (the colour detail as its percussion comes in, the light, people passing, the jerky whip)
  // stay on a beat of its music (to the frame).
  const beat = 60 / 84;
  for (let n = 12; n <= 23; n++) {
    const l = coupsDeFouet.timeline(n, { end: false });
    const roles = fouetRoles(n);
    assert.equal(l.shots.length, n);
    for (const r of [0, 1, 2, 5, 6, 9, 10, 12, 14, 19, 21, 22]) assert.ok(roles.includes(r), `n=${n}: role ${r}`);
    for (const r of [9, 13, 18, 19]) {
      const k = roles.indexOf(r);
      if (k < 0) continue;
      const on = Math.round(l.shots[k]!.start / beat);
      assert.ok(Math.abs(l.shots[k]!.start - on * beat) <= 0.5 / 30 + 0.006, `n=${n}: role ${r} at ${l.shots[k]!.start} s`);
    }
    assert.equal(l.texts.titre!.from, l.shots[1]!.start);
  }
  assert.deepEqual(fouetRoles(12), [0, 1, 2, 5, 6, 9, 10, 12, 14, 19, 21, 22]);
  // Her name from the white flash to the first whip flash (the original's images 20 to 53).
  assert.deepEqual([Math.round(line.texts.titre!.from * 30), Math.round(line.texts.titre!.to * 30)], [20, 54]);
  // Its music muffled where the original's percussion is silent: until the colour detail (on beat 12, 8,57 s; the
  // original's 8,62), then from the calm street to the tram (13,0 s); dying away over the last second, the picture held.
  assert.equal(Math.round(line.shots[9]!.start * 30), 257);
  assert.deepEqual(line.music, {
    filters: [
      { kind: "muffled", from: 0, to: line.shots[9]!.start },
      { kind: "muffled", from: line.shots[12]!.start, to: line.shots[14]!.start },
    ],
    end: { at: line.duration, fade: 1 },
  });
  // Its original's sounds only: a dull thud as its name appears, a whoosh into its first whip flash (none on the others).
  assert.deepEqual(line.sounds?.map((s) => [Math.round(s.at * 30), s.sound]), [[20, "deep soft thud"], [54, "quick air whoosh"]]);
  // On the plan: its shape and its sounds, its marks (each shot's role) for its code.
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 20 }));
  const plan = skillPlan({ skill: coupsDeFouet, name: "Ville en coups de fouet", files, fill: { shots: Array.from({ length: 23 }, (_, i) => ({ file: files[i % 8]!.id, at: Math.floor(i / 8) * 6 })), texts: { titre: "Belleville" }, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.music_shape?.filters?.map((f) => [f.kind, f.from, f.to]), [["muffled", 0, 8.57], ["muffled", 11, 13]]);
  assert.deepEqual(plan.music_shape?.end, { at: 23.3, fade: 1 });
  assert.equal(plan.sounds?.length, 2);
  const marks = plan.layers![0]!.motion.texts!;
  assert.deepEqual(Array.from({ length: 23 }, (_, i) => marks[`r${i}`]), Array.from({ length: 23 }, (_, i) => String(i)));
  const fewer = skillPlan({ skill: coupsDeFouet, name: "Ville en coups de fouet", files, fill: { shots: Array.from({ length: 12 }, (_, i) => ({ file: files[i % 8]!.id, at: 1 })), texts: { titre: "Belleville" }, end: null } });
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => Number(fewer.layers![0]!.motion.texts![`r${i}`])), fouetRoles(12));
  // Her name set in the clear area of her name's shot (read there only); nothing cut out nor followed.
  assert.deepEqual(clearsDrawn(coupsDeFouet.code), [1]);
  assert.deepEqual(objectsDrawn(coupsDeFouet.code), []);
  assert.equal(drawsSubject(coupsDeFouet.code), false);
  // Its finish: no grain (its original has none); its code holds the whites low itself. Nothing of its original's own.
  assert.deepEqual(coupsDeFouet.finish, { grain: 0 });
  assert.doesNotMatch(coupsDeFouet.code, /NEW YORK|NYC/);
});

test("« Ville en coups de fouet » (v2): its whip flashes made of her sky, its white flashes, its fades, frame by frame", async () => {
  const { code, shots, marks, durationInFrames } = await fouetShots(23);
  const reelTexts = [{ text: "Belleville", role: "hook", from: 20, to: 54, emphasis: [] }];
  const draw = (frame: number, extra: Record<string, unknown> = {}) =>
    drawScene(code, frame, { width: 1080, height: 1920, durationInFrames, brand: { name: "Chez Lou", displayFont: "Big Shoulders Display", bodyFont: "Inter" }, shots, reelTexts, end: null, texts: marks, ...extra });
  const footages = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "Footage").map((n) => n.props as { shot: number; at?: number; style: Record<string, unknown> });
  const white = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).background === "#ffffff");
  const blurs = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "feGaussianBlur");
  const title = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "FitText" && heldText(n).includes("BELLEVILLE"));
  // The flash into her name's shot: the opening lit up (image 19), a plain white image over her name's shot with her name
  // on it (image 20), her name's shot at its light (image 21).
  assert.equal(styleOf(white(draw(19))!).opacity, 0.3);
  assert.equal(styleOf(white(draw(20))!).opacity, 0.9);
  assert.ok(title(draw(20)));
  assert.equal(white(draw(21)), undefined);
  // Her name still from image 20 to 53, gone with the whip flash; at the middle of its picture without a clear area.
  assert.deepEqual(styleOf(title(draw(21))!), styleOf(title(draw(53))!));
  assert.equal(title(draw(54)), undefined);
  // Each whip flash: the same two images of her name's shot (its image 10), smeared, lit up: images 54 and 55 (the first),
  // 256 to 258 (the second, one image doubled), 389 and 390 (the third), 569 to 573 (the last, under a white).
  for (const f of [54, 55, 256, 257, 258, 389, 390, 569, 570, 571, 572, 573]) {
    const tree = draw(f);
    assert.deepEqual(footages(tree).map((p) => [p.shot, p.at]), [[1, f - 10]], `image ${f}`);
    assert.equal(blurs(tree).length, 1, `image ${f}`);
  }
  for (const f of [53, 56, 255, 259, 388, 391, 568, 574]) assert.ok(!footages(draw(f)).some((p) => p.shot === 1 && p.at !== undefined), `image ${f}`);
  // The last one comes after the façade whitens over its last four images (the original's 565 to 568).
  assert.deepEqual([565, 566, 567, 568].map((f) => styleOf(white(draw(f))!).opacity), [0.1, 0.2, 0.32, 0.45]);
  // The white flashes of three images: the shot before lit up twice, then the white over the next one.
  assert.deepEqual([296, 297, 298].map((f) => styleOf(white(draw(f))!).opacity), [0.2, 0.38, 0.9]);
  // The jerky whip faded in from the shot before over two images (514, 515), its images held 3, 5, 3… images, blurred.
  const fade = drawnNodes(draw(514)).find((n) => n.type === "div" && styleOf(n).opacity === 1 / 3);
  assert.ok(fade && footages(fade).some((p) => p.shot === 19));
  const held = [514, 515, 516, 517, 518, 519, 520, 521, 522].map((f) => footages(draw(f)).find((p) => p.shot === 19)!.at);
  assert.deepEqual(held.map((at, i) => 514 + i - at!), [0, 0, 0, 3, 3, 3, 3, 3, 8]);
  assert.ok(blurs(draw(520)).length >= 1);
  // Its black and white (the low angle, someone passing) and the ghost images of what passes: its images of 3, 6 and 9
  // images before, under it.
  assert.equal(footages(draw(70)).find((p) => p.shot === 2)!.style.filter, "grayscale(1) contrast(1.3)");
  const ghosts = footages(draw(285)).filter((p) => p.shot === 10);
  assert.deepEqual(ghosts.map((p) => [285 - p.at!, p.style.opacity]), [[2, 1], [5, 0.565], [8, 0.49], [11, 0.55]]);
  assert.equal(drawnNodes(draw(285)).find((n) => n.type === "div" && styleOf(n).filter === "grayscale(1) contrast(1.3)")?.type, "div");
  // Its pushes on her videos, steady from the centre (×1,11 behind her name); a photo stays still.
  const scale = (tree: Drawn, shot: number) => Number(/scale\(([\d.]+)\)/.exec(String(footages(tree).find((p) => p.shot === shot)?.style.transform ?? ""))?.[1] ?? 1);
  assert.ok(scale(draw(40), 1) > scale(draw(25), 1) && scale(draw(25), 1) > 1 && scale(draw(53), 1) <= 1.11);
  const still = await fouetShots(23, 16 / 9, [1, 2]);
  const drawStill = (frame: number) => drawScene(still.code, frame, { width: 1080, height: 1920, durationInFrames: still.durationInFrames, brand: { name: "Chez Lou", displayFont: "Inter", bodyFont: "Inter" }, shots: still.shots, reelTexts, end: null, texts: still.marks });
  assert.equal(scale(drawStill(40), 1), 1);
  assert.equal(scale(drawStill(70), 2), 1);
  // Its ending card, only when she has one: its words in the name's capitals over her last shot.
  const ending = draw(durationInFrames - 10, { end: { title: "Ouvert dimanche", subtitle: null, from: durationInFrames - 48 } });
  assert.ok(drawnNodes(ending).some((n) => n.type === "FitText" && heldText(n).includes("Ouvert dimanche")));
  assert.ok(!drawnNodes(draw(durationInFrames - 10)).some((n) => n.type === "FitText"));
});

test("« Ville en coups de fouet » (v2): horizontal 4:3 on black as its original when her files are, full frame otherwise or on her word", async () => {
  const { coupsDeFouet } = await import("./skills/coups-de-fouet.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const reelTexts = [{ text: "Belleville", role: "hook", from: 20, to: 54, emphasis: [] }];
  const frameOf = async (aspect: number, format?: string, wideOnes?: number) => {
    const { code, shots, marks, durationInFrames } = await fouetShots(23, aspect);
    const mixed = wideOnes === undefined ? shots : shots.map((s, i) => ({ ...s, aspect: i < wideOnes ? 16 / 9 : 9 / 16 }));
    const tree = drawScene(code, 30, { width: 1080, height: 1920, durationInFrames, brand: { name: "Chez Lou", displayFont: "Big Shoulders Display", bodyFont: "Inter" }, shots: mixed, reelTexts, end: null, texts: { ...marks, ...(format ? { format } : {}) } });
    const box = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!;
    const name = drawnNodes(box).find((n) => n.type === "FitText")!;
    return { top: styleOf(box).top, height: styleOf(box).height, name: name.props.style as { left: number; top: number; width: number; height: number } };
  };
  // Her files mostly horizontal: the original's 4:3 picture (1080 × 810) at the middle of the frame, on black; mostly
  // vertical (half and half too): full frame.
  const wide = await frameOf(16 / 9);
  assert.deepEqual([wide.top, wide.height], [555, 810]);
  assert.equal((await frameOf(16 / 9, undefined, 12)).height, 810);
  assert.equal((await frameOf(9 / 16)).height, 1920);
  assert.equal((await frameOf(16 / 9, undefined, 11)).height, 1920);
  // On her word, the other format.
  assert.equal((await frameOf(16 / 9, "vertical")).height, 1920);
  assert.equal((await frameOf(9 / 16, "horizontal")).top, 555);
  // Her name at the middle of its picture when her sky has no room (the clear area's fallback), above the middle in the
  // vertical frame, in the safe zone and left of the apps' buttons, 800 px wide at most.
  for (const f of [wide, await frameOf(9 / 16)]) {
    const n = f.name;
    assert.ok(Math.abs(n.left + n.width / 2 - 540) <= 1 && n.left >= 140 && n.left + n.width <= 940, JSON.stringify(n));
    const middle = Number(f.top) + n.top + n.height / 2;
    assert.ok(middle >= 600 && middle <= 960, `${middle}`);
  }
  // The setting: the filler sees it (the original's first, the default), the plan keeps a choice her words asked for.
  assert.deepEqual(coupsDeFouet.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(coupsDeFouet, [{ name: "format", value: "auto" }]), {});
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 20 }));
  const input = skillFillInput({ skill: coupsDeFouet, name: "Ville en coups de fouet", n: 23, files, business: {}, request: "en vertical" });
  assert.equal(input.reglages?.[0]?.nom, "format");
  assert.equal(input.cases.length, 23);
  const plan = skillPlan({ skill: coupsDeFouet, name: "Ville en coups de fouet", files, fill: { shots: Array.from({ length: 23 }, (_, i) => ({ file: files[i % 8]!.id, at: Math.floor(i / 8) * 6 })), texts: { titre: "Belleville" }, end: null, settings: { format: "vertical" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
  assert.deepEqual(plan.skill, { key: "coups-de-fouet", version: 3, settings: { format: "vertical" } });
});

// ——— « Quart de tour, deux tons » v2 (`tourne`), written again on its original's fiche (docs/fiches/tourne.md) ——————

/** Its composition run at one frame with a stand-in scope (Turn, Flash, Footage, FitText and the picture kit's pieces as named elements), as sceneAt does. */
function turnedAt(code: string, frame: number, props: Record<string, unknown>): Drawn {
  const h = (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() });
  const interpolate = (x: number, [a, b]: number[], [c, d]: number[]) => c! + (d! - c!) * Math.min(1, Math.max(0, (x - a!) / (b! - a! || 1)));
  const scope: Record<string, unknown> = {
    React: { createElement: h, Fragment: "Fragment" },
    useCurrentFrame: () => frame,
    interpolate,
    Easing: { bezier: () => (t: number) => t },
    AbsoluteFill: "AbsoluteFill",
    Footage: "Footage",
    FitText: "FitText",
    Turn: "Turn",
    Flash: "Flash",
    Punch: "Punch",
    Smear: "Smear",
    LensEdges: "LensEdges",
  };
  const Scene = new Function(...Object.keys(scope), `${code}\nreturn Scene;`)(...Object.values(scope)) as (p: unknown) => Drawn;
  return Scene({ width: 1080, height: 1920, durationInFrames: 384, brand: { displayFont: "Big Shoulders Display", bodyFont: "Inter" }, reelTexts: [], end: null, ...props });
}

test("« Quart de tour, deux tons » (v2) cuts where its original does, on its own music (118,3 BPM), its strobe, its hits and its muffled pad", async () => {
  const { tourne, burstFor } = await import("./skills/tourne.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(tourne.version, 2);
  assert.equal(tourne.bpm, 118.3);
  const line = tourne.timeline(28, { end: false });
  // The original's 28 shots, cut on its images (measured at 30 i/s; a white flash on the first image of the shot it
  // opens): within two images each, its burst on the quarters of its beat from beat 13.
  const original = [0, 6, 11, 16, 24, 55, 69, 98, 124, 151, 183, 198, 209, 223, 228, 231, 235, 244, 254, 258, 261, 266, 270, 285, 293, 304, 309, 319];
  assert.equal(line.shots.length, original.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - original[i]!) <= 2, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${original[i]}`));
  assert.ok(Math.abs(line.duration - 12.8) < 0.05, `${line.duration} s`);
  const quarter = 60 / 118.3 / 4;
  line.shots.slice(11).forEach((s) => assert.ok(Math.abs(s.start / quarter - Math.round(s.start / quarter)) * quarter * 30 < 0.75, `${s.start} s on a quarter of its beat`));
  // Its strobe on the original's images 3 to 23, its five shots in colour, its upright one, its zoom, its whip.
  assert.deepEqual(Array.from({ length: 9 }, (_, k) => line.marks[`strobe_${k}`]), [3, 5, 8, 10, 11, 12, 15, 19, 23]);
  assert.deepEqual(Array.from({ length: 5 }, (_, k) => line.marks[`colour_${k}`]), [4, 5, 8, 17, 22]);
  assert.deepEqual([line.marks.flip, line.marks.zoom, line.marks.zoom_in, line.marks.whip], [6, 12, 8, 24]);
  // Its white flashes on the first images of the shots the original's open (151, 223, 319), its passage blurs into them.
  [line.marks.flash_0!, line.marks.flash_1!, line.marks.flash_2!].forEach((k, i) => assert.ok(Math.abs(Math.round(line.shots[k]!.start * 30) - [151, 223, 319][i]!) <= 1));
  assert.deepEqual([line.marks.soft_0, line.marks.soft_1, line.marks.soft_2], [7, 9, 27]);
  // Its music muffled on its pad, open at once on the burst's first image, muffled again from the last flash, cut dead
  // with the picture: three bars of pad, two of beat, one of pad.
  assert.deepEqual(line.music, {
    filters: [
      { kind: "muffled", from: 0, to: line.shots[11]!.start },
      { kind: "muffled", from: line.shots[27]!.start, to: line.duration },
    ],
    end: { at: line.duration },
  });
  assert.ok(Math.abs(line.shots[11]!.start - 6.6) < 0.04);
  // Its own sounds: its rising roll under the strobe, its two big hits on the cuts to the camels and the walker, the
  // second the loudest.
  assert.deepEqual(line.sounds!.map((s) => [s.sound, s.at]), [["fast snare drum roll building up", 0.609], ["deep cinematic impact hit", line.shots[5]!.start], ["deep cinematic impact hit", line.shots[6]!.start]]);
  assert.ok(line.sounds![2]!.gain! > (line.sounds![1]!.gain ?? 0));
  // Its optional title over the opening and the first colour shot.
  assert.deepEqual(line.texts.titre, { from: 0, to: line.shots[5]!.start });
  // Fewer of her shots: its burst keeps its 8 beats, its zoom, flash, colours and whip, the Reel its length.
  for (const n of [20, 24]) {
    const fewer = tourne.timeline(n, { end: false });
    assert.equal(fewer.shots.length, n);
    assert.ok(Math.abs(fewer.duration - line.duration) < 0.01, `${n}: ${fewer.duration} s`);
    assert.deepEqual(fewer.shots.slice(0, 13), line.shots.slice(0, 13));
    assert.equal(Object.keys(fewer.marks).filter((k) => k.startsWith("colour_")).length, 5);
    assert.ok(fewer.marks.whip! > fewer.marks.zoom! && fewer.marks.flash_2 === n - 1);
  }
  assert.equal(burstFor(8).length, 8);
  assert.equal(burstFor(8).reduce((a, b) => a + b.q, 0), 32);
  assert.deepEqual(burstFor(16).map((b) => b.q), [3, 4, 1, 1, 1, 2, 3, 1, 1, 1, 1, 4, 2, 3, 1, 3]);
  // At another tempo, all of it follows its beats; with an ending card, its black after the last shot carries the card.
  const slower = tourne.timeline(28, { end: false, bpm: 100 });
  assert.ok(Math.abs(slower.duration / line.duration - 118.3 / 100) < 0.01);
  const ended = tourne.timeline(28, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(ended.duration - ended.marks.black! / 30 >= 1.6 && Math.abs(ended.marks.black! - Math.round(line.duration * 30)) <= 1, JSON.stringify(ended.marks));
  // On the plan: its sounds and its music's shape, valid.
  const files = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const plan = skillPlan({ skill: tourne, name: "Quart de tour", files, fill: { shots: Array.from({ length: 28 }, (_, i) => ({ file: files[i % 10]!.id, at: Math.floor(i / 10) * 4 })), texts: {}, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.sounds?.map((s) => s.skill), [true, true, true]);
  assert.deepEqual(plan.music_shape?.filters?.map((f) => f.kind), ["muffled", "muffled"]);
  // Nothing of its model's finish over the Reel (its code draws its tones and its colour shots): no grain, no dark corners.
  assert.deepEqual(tourne.finish, { exposure: 0, contrast: 0, saturation: 0, warmth: 0, split: 0, grain: 0, vignette: 0, fade: 0 });
});

test("« Quart de tour, deux tons » (v2): every shot in width turned a quarter clockwise, its upright one upside down, two tones but where colour counts, its settings", async () => {
  const { tourne } = await import("./skills/tourne.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const line = tourne.timeline(28, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const shots = (aspect: (i: number) => number) => line.shots.map((s, i) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect: aspect(i) }));
  const wide = shots(() => 16 / 9);
  /** What its code lays at a frame: its shot's picture (the first one with its tones) and what turns it. */
  const at = (frame: number, props: Record<string, unknown> = {}) => {
    const nodes = drawnIn(turnedAt(tourne.code, frame, { shots: wide, texts: marks, ...props }));
    const picture = nodes.find((d) => /url\(#tourne-(duo|lit|colour)\)/.test(String(styleOf(d).filter ?? "")));
    return { nodes, filter: String(styleOf(picture!).filter), turn: nodes.find((d) => d.type === "Turn") };
  };
  // Her shots in width turned a quarter, always clockwise (the top of the scene on the right), drawn whole at the
  // frame's height by its width; one way then the other on her word.
  for (const f of [2, 30, 100, 240, 350]) assert.equal(at(f).turn?.props.angle, 90, `image ${f}`);
  const drawnShot = (turn: Drawn) => (turn.props.draw as (size: { width: number; height: number }) => Drawn)({ width: 1920, height: 1080 });
  assert.deepEqual(styleOf(drawnShot(at(100).turn!)), { position: "absolute", left: 0, top: 0, width: 1920, height: 1080 });
  assert.deepEqual([60, 30].map((f) => at(f, { texts: { ...marks, sens: "alterne" } }).turn?.props.angle), [-90, 90]);
  // An upright video plays upright; in its slot for one (a silhouette on the sky), a half turn (the picture kit's Turn
  // 180, drawn at the frame's size), unless she wants them upright.
  const upright = shots((i) => (i === 6 || i === 7 ? 9 / 16 : 16 / 9));
  const turnedBack = (frame: number, texts = marks) => drawnIn(turnedAt(tourne.code, frame, { shots: upright, texts })).find((d) => d.type === "Turn" && d.props.angle === 180);
  assert.equal(drawnShot(turnedBack(80)!).props.shot, 6);
  assert.deepEqual(drawnIn(turnedAt(tourne.code, 80, { shots: upright, texts: marks })).filter((d) => d.type === "Turn").map((d) => d.props.angle), [180]);
  assert.equal(turnedBack(80, { ...marks, format: "droit" }), undefined);
  assert.equal(turnedBack(110), undefined);
  // Two tones on all but its colour shots, the strobe's images overexposed; all in two tones on her word.
  assert.match(at(2).filter, /^url\(#tourne-duo\)$/);
  assert.match(at(3).filter, /^url\(#tourne-lit\)$/);
  assert.match(at(30).filter, /^url\(#tourne-colour\)$/);
  assert.match(at(250).filter, /^url\(#tourne-colour\)$/);
  assert.match(at(30, { texts: { ...marks, couleur: "aucune" } }).filter, /^url\(#tourne-duo\)$/);
  // Its lens edges (the picture kit's LensEdges, at the top and the bottom of the frame by default, 6 px apart at the
  // top and 5 at the bottom) over its shots in two tones, none on a colour shot.
  const edges = (f: number) => at(f).nodes.filter((d) => d.type === "LensEdges").map((d) => [d.props.axis ?? "y", d.props.size ?? 0.25, d.props.split]);
  assert.deepEqual(edges(100), [["y", 0.25, [6, 5]]]);
  assert.deepEqual(edges(30), []);
  // Its passage blur into the close detail (the walker's last images, the cactus's first), its white flashes over the
  // first images of the shots they open, the shot under them overexposed.
  assert.match(at(97).filter, /blur\(14px\)/);
  assert.match(at(98).filter, /blur\(10px\)/);
  assert.doesNotMatch(at(99).filter, /blur/);
  const flash = (f: number) => at(f).nodes.find((d) => d.type === "Flash")?.props;
  assert.deepEqual(flash(151), { key: "w9", at: 151, frames: 2, color: "rgba(250,248,251,0.9)" });
  assert.match(at(152).filter, /brightness\(1\.6\)/);
  assert.equal(flash(153), undefined);
  assert.equal(flash(Math.round(line.shots[13]!.start * 30))?.frames, 1);
  assert.equal(flash(320)?.color, "rgba(250,248,251,0.9)");
  // Its punch zoom in one shot (the picture kit's Punch from its cut, ×2,3 in eight images): its first image wide, then
  // ×2,3 about the middle, held (no zoom blur once it has landed; punchCopies, tested with the kit).
  const zoomFrom = Math.round(line.shots[12]!.start * 30);
  const punch = at(zoomFrom + 2).nodes.find((d) => d.type === "Punch")!;
  assert.deepEqual([punch.props.at, punch.props.frames, punch.props.scale], [zoomFrom, 8, 2.3]);
  assert.equal(drawnIn(punch).find((d) => d.type === "Turn")?.props.angle, 90);
  assert.equal(at(zoomFrom - 1).nodes.find((d) => d.type === "Punch"), undefined);
  // Its filés (the picture kit's Smear, sliding along the height): the opening's over all its images, its burst's whip on
  // its first image and its last four, then a hard cut.
  const streaked = (f: number) => at(f).nodes.some((d) => d.type === "Smear");
  assert.deepEqual([10, 11, 13, 15, 16].map(streaked), [false, true, true, true, false]);
  const smear = at(13).nodes.find((d) => d.type === "Smear")!.props;
  assert.deepEqual([smear.direction, smear.blur, smear.travel, smear.scale], ["up", 46, 0.12, 1.3]);
  assert.ok(Math.abs(Number(smear.progress) - 2.5 / 5) < 1e-9, JSON.stringify(smear));
  const whipFrom = Math.round(line.shots[24]!.start * 30);
  const whipTo = Math.round(line.shots[25]!.start * 30);
  assert.deepEqual([whipFrom, whipFrom + 1, whipTo - 5, whipTo - 4, whipTo - 1, whipTo].map(streaked), [true, false, false, true, true, false]);
  // Its optional title, turned a quarter like the shots, in its cream capitals; no text of its own otherwise.
  assert.equal(at(20).nodes.find((d) => d.type === "FitText"), undefined);
  const titled = at(20, { reelTexts: [{ text: "Brighton", role: "hook", from: 0, to: 55 }] }).nodes.find((d) => d.type === "FitText")!;
  assert.equal(styleOf(titled).transform, "rotate(90deg)");
  assert.equal((titled.props.innerStyle as Record<string, unknown>).color, "#E8E5DA");
  // Its ending card on the black after the last shot, only when the Reel has one.
  const ended = tourne.timeline(28, { end: true });
  const black = turnedAt(tourne.code, ended.marks.black! + 2, { shots: wide, texts: Object.fromEntries(Object.entries(ended.marks).map(([k, v]) => [k, String(v)])), end: { title: "Ouvert dimanche", subtitle: null, from: ended.marks.black! + 2 }, durationInFrames: Math.round(ended.duration * 30) });
  assert.equal(drawnIn(black).find((d) => d.type === "Turn"), undefined);
  assert.ok(drawnIn(black).some((d) => d.type === "span" && d.children.includes("Ouvert dimanche")));
  // Its settings: the filler sees them (the original's first, the default), the plan keeps a choice her words asked for.
  assert.deepEqual(tourne.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "droit"]], ["sens", ["horaire", "alterne"]], ["couleur", ["auto", "aucune"]]]);
  assert.deepEqual(skillSettings(tourne, [{ name: "format", value: "auto" }, { name: "couleur", value: "aucune" }]), { couleur: "aucune" });
  const files = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: tourne, name: "Quart de tour", n: 28, files, business: {}, request: "garde mes vidéos droites" });
  assert.deepEqual(input.reglages?.map((r) => r.nom), ["format", "sens", "couleur"]);
  const plan = skillPlan({ skill: tourne, name: "Quart de tour", files, fill: { shots: Array.from({ length: 28 }, (_, i) => ({ file: files[i % 10]!.id, at: 1 })), texts: {}, end: null, settings: { format: "droit" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "droit");
  assert.deepEqual(plan.skill, { key: "tourne", version: 2, settings: { format: "droit" } });
});

// ——— « Écran partagé titré » v3, written again on its original's fiche (docs/fiches/ecran-partage.md), its halves on the same moment ———

test("« Écran partagé titré » (v3) cuts where its original does, its two halves laid on the same moment, on its grid of half a second", async () => {
  const { ecranPartage } = await import("./skills/ecran-partage.ts");
  const { skillFit } = await import("./skills.ts");
  const { clearsDrawn, objectsDrawn, subjectsDrawn } = await import("./subject.ts");
  assert.equal(ecranPartage.version, 3);
  assert.equal(ecranPartage.bpm, 120);
  const line = ecranPartage.timeline(10, { end: false });
  // Its five pairs, two shots each (the person at work, what it gives), cutting together where the original's do, on its
  // images 67, 172, 232 and 320 (measured image by image at 30 i/s): within two images each; 12,77 s in all.
  const original = [0, 67, 172, 232, 320];
  assert.equal(line.shots.length, 10);
  original.forEach((f, k) => {
    const at = Math.round(line.shots[2 * k]!.start * 30);
    assert.ok(Math.abs(at - f) <= 2, `pair ${k + 1}: image ${at}, the original's ${f}`);
  });
  assert.ok(Math.abs(line.duration - 12.77) < 0.05, `${line.duration} s`);
  // Each pair's two halves on the same moment, the whole pair each (the second laid beside the first, its time counted
  // once): its main line, the first halves, one after the other from 0.
  for (let k = 0; k < 5; k++) {
    const [a, b] = [line.shots[2 * k]!, line.shots[2 * k + 1]!];
    assert.deepEqual([b.start, b.end, Boolean(b.beside), Boolean(a.beside)], [a.start, a.end, true, false], `pair ${k + 1}`);
    if (k) assert.equal(a.start, line.shots[2 * k - 2]!.end);
  }
  assert.equal(line.marks.solo, -1);
  // Its two titles from the first image to the last; no sound of its own (its original has none); its music without its
  // bass to the third bar (the original's held bass comes in at 4,55 s), cut dead with the last image.
  assert.deepEqual(line.texts, { personne: { from: 0, to: line.duration }, resultat: { from: 0, to: line.duration } });
  assert.equal(line.sounds, undefined);
  assert.deepEqual(line.music, { filters: [{ kind: "thin", from: 0, to: 4 }], end: { at: line.duration } });
  // An odd count takes a short pair more in the middle, one shot alone in both halves (laid beside nothing), never a
  // shot alone full frame; the even counts keep their own lengths (12,8 s asked: the original's five pairs).
  const odd = ecranPartage.timeline(9, { end: false });
  assert.equal(odd.shots.length, 9);
  assert.equal(odd.marks.solo, 4);
  assert.equal(odd.shots[4]!.beside, undefined);
  assert.equal(odd.shots[4]!.start, odd.shots[3]!.end);
  assert.ok(odd.duration > ecranPartage.timeline(8, { end: false }).duration && odd.duration < line.duration, `${odd.duration} s`);
  assert.deepEqual(skillFit(ecranPartage, 12.8), { n: 10, bpm: 120 });
  // With an ending card (the original has none: only when she wants one), its last pair held whole beats longer.
  const ended = ecranPartage.timeline(10, { end: true });
  assert.deepEqual(ended.shots.slice(0, 8), line.shots.slice(0, 8));
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs((ended.duration - line.duration) * 2 - 4) < 0.05, `${ended.duration} s`);
  assert.ok(Math.abs(ended.texts.personne!.to - (ended.duration - 1.6)) < 0.01);
  // Cuts only: no zoom, push nor slide; nothing read in her shots (its titles stay where the original's are) and nothing
  // cut out.
  assert.doesNotMatch(ecranPartage.code, /transform|scale\(|interpolate/);
  assert.deepEqual(clearsDrawn(ecranPartage.code), []);
  assert.deepEqual(objectsDrawn(ecranPartage.code), []);
  assert.deepEqual(subjectsDrawn(ecranPartage.code), []);
  // Its finish leaves out the catalogue's vignette and grain: its original has neither.
  assert.deepEqual(ecranPartage.finish, { grain: 0, vignette: 0 });
});

test("« Écran partagé titré » (v3): the original's card for vertical files, one half above the other for horizontal ones, each half at its own speed", async () => {
  const { ecranPartage } = await import("./skills/ecran-partage.ts");
  const line = ecranPartage.timeline(10, { end: false });
  const shotsOf = (aspects: number[], kinds: string[] = []) =>
    line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: aspects[i % aspects.length], from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: kinds[i] ?? "video", segment: i }));
  const brand = { name: "Atelier Rose", displayFont: "EB Garamond", bodyFont: "Inter Tight" };
  const reelTexts = [
    { text: "les fleuristes", role: "hook", from: 0, to: 383, emphasis: [] },
    { text: "les fleurs", role: "caption", from: 0, to: 383, emphasis: [] },
  ];
  const draw = (aspects: number[], frame: number, extra: Record<string, unknown> = {}, kinds: string[] = []) =>
    drawScene(ecranPartage.code, frame, { width: 1080, height: 1920, durationInFrames: 383, brand, shots: shotsOf(aspects, kinds), reelTexts, end: null, texts: { solo: "-1" }, ...extra });
  /** The card (the box with its rounded corners) and its halves, each with the Footage laid in it. */
  const cardOf = (tree: Drawn) => {
    const card = drawnNodes(tree).find((n) => n.type === "div" && Number(styleOf(n).borderRadius) > 0)!;
    const halves = (card.children.flat(Infinity) as unknown[]).filter((n): n is Drawn => Boolean(n) && typeof n === "object" && (n as Drawn).type === "div" && styleOf(n as Drawn).overflow === "hidden");
    const box = (s: Record<string, number | string>) => [s.left, s.top, s.width, s.height];
    return { card: box(styleOf(card)), radius: styleOf(card).borderRadius, halves: halves.map((n) => box(styleOf(n))), footage: halves.map((n) => drawnNodes(n).filter((x) => x.type === "Footage").map((x) => x.props)) };
  };
  const tall = [9 / 16];
  const wide = [16 / 9];
  // Her files mostly vertical: the original's 4:3 card at the middle of the screen (1080 × 810), on black, its margins
  // and rounded corners as the original's, its two 2:3 halves side by side, touching.
  const card = cardOf(draw(tall, 30));
  assert.deepEqual(card.card, [10, 570, 1060, 783]);
  assert.equal(card.radius, 30);
  assert.deepEqual(card.halves, [[0, 0, 530, 783], [530, 0, 530, 783]]);
  // Mostly horizontal: the card over the whole screen, one half above the other (9:8): a 16:9 video keeps most of its width.
  const stacked = cardOf(draw(wide, 30));
  assert.deepEqual(stacked.card, [10, 35, 1060, 1856]);
  assert.deepEqual(stacked.halves, [[0, 0, 1060, 928], [0, 928, 1060, 928]]);
  assert.equal(cardOf(draw([16 / 9, 9 / 16], 30)).card[1], 570);
  // On her word, another layout: the card whatever her files, side by side over the whole screen, one above the other.
  assert.deepEqual(cardOf(draw(wide, 30, { texts: { solo: "-1", format: "carte" } })).card, [10, 570, 1060, 783]);
  assert.deepEqual(cardOf(draw(tall, 30, { texts: { solo: "-1", format: "plein-ecran" } })).halves, [[0, 0, 530, 1856], [530, 0, 530, 1856]]);
  assert.deepEqual(cardOf(draw(tall, 30, { texts: { solo: "-1", format: "empile" } })).halves, [[0, 0, 1060, 928], [0, 928, 1060, 928]]);
  // Both halves of a pair laid on the same moment (the second pair: its shots 3 and 4, both from image 68 to 173), each
  // its own passage at its own speed, as the original's: laid once, played from its own first image (no `at`, no blend
  // of two images); the two always cut together.
  const shots = shotsOf(tall);
  assert.deepEqual([shots[2]!.from, shots[3]!.from, shots[2]!.durationInFrames, shots[3]!.durationInFrames], [68, 68, 105, 105]);
  for (const f of [68, 88, 120, 172]) {
    const { footage } = cardOf(draw(tall, f));
    assert.deepEqual(footage.map((list) => list.map((p) => [p.shot, p.at])), [[[2, undefined]], [[3, undefined]]], `image ${f}`);
  }
  assert.deepEqual(cardOf(draw(tall, 173)).footage.map((list) => list.map((p) => p.shot)), [[4], [5]]);
  // A photo stays still: laid once, never played.
  const photo = cardOf(draw(tall, 88, {}, ["video", "video", "photo", "video"]));
  assert.deepEqual(photo.footage[0]!.map((p) => [p.shot, p.at]), [[2, undefined]]);
  // An odd count: a video alone in its pair plays its gesture in one half while the other holds its last image (what it
  // gives: its Footage laid as if just over); a photo alone is laid across the card, never twice.
  const nine = ecranPartage.timeline(9, { end: false });
  const oddShots = nine.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: 9 / 16, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const solo = oddShots[4]!;
  const oddDraw = (list: typeof oddShots) => drawScene(ecranPartage.code, solo.from + 10, { width: 1080, height: 1920, durationInFrames: 341, brand, shots: list, reelTexts, end: null, texts: { solo: "4" } });
  const alone = cardOf(oddDraw(oddShots));
  assert.deepEqual(alone.footage.map((list) => list.map((p) => p.shot)), [[4], [4]]);
  assert.equal(alone.footage[0]![0]!.at, undefined);
  assert.equal(solo.from + 10 - Number(alone.footage[1]![0]!.at), solo.durationInFrames);
  assert.deepEqual(cardOf(oddDraw(oddShots.map((s, i) => (i === 4 ? { ...s, kind: "photo" } : s)))).halves, [[0, 0, 1060, 783]]);
  // A pair before and after it keeps its two shots side by side.
  assert.deepEqual(cardOf(drawScene(ecranPartage.code, oddShots[5]!.from + 3, { width: 1080, height: 1920, durationInFrames: 341, brand, shots: oddShots, reelTexts, end: null, texts: {} })).footage.map((list) => list.map((p) => p.shot)), [[5], [6]]);
  // Shots that all follow one another (a plan of the editor's, after a request out of the model: it lays none beside
  // another) are paired two by two, each half over its pair at half its speed, an image between two blended, as v2 did.
  const row = [0, 1, 2, 3].map((i) => ({ src: `/v${i}.mp4`, aspect: 9 / 16, from: 34 * i, durationInFrames: 34, kind: "video", segment: i }));
  const sequential = cardOf(drawScene(ecranPartage.code, 34, { width: 1080, height: 1920, durationInFrames: 136, brand, shots: row, reelTexts, end: null, texts: {} }));
  assert.deepEqual(sequential.footage.map((list) => list.map((p) => [p.shot, p.at])), [[[0, 17], [0, 16]], [[1, 17], [1, 16]]]);
  // Its two small titles, on the card and still: a book serif in title case, white, 50 px; side by side just under the
  // middle of the card (54 % of its height), at 43 % and 51 % of their halves, the right one left of the apps' buttons;
  // one above the other, centred, as far above the line between the halves as below it, clear of the apps' caption.
  const titles = (tree: Drawn) =>
    drawnNodes(tree)
      .filter((n) => n.type === "FitText")
      .map((n) => ({ box: n.props.style as { left: number; top: number; width: number; height: number }, size: (n.props.innerStyle as { fontSize: number }).fontSize, text: heldText(n).replace(/\s+/g, " ").trim() }));
  const side = titles(draw(tall, 30));
  assert.deepEqual(side.map((t) => [t.text, t.size]), [["Les fleuristes", 50], ["Les fleurs", 50]]);
  for (const t of side) assert.ok(Math.abs(t.box.top + t.box.height / 2 - (570 + 0.54 * 783)) <= 1, JSON.stringify(t.box));
  const [left, right] = side as [(typeof side)[number], (typeof side)[number]];
  assert.ok(left.box.left >= 50 && left.box.left + left.box.width <= 520 && Math.abs(left.box.left + left.box.width / 2 - 238) <= 2, JSON.stringify(left.box));
  // (The right one moved in when its box would reach the buttons' column.)
  assert.ok(right.box.left >= 560 && right.box.left + right.box.width <= 930, JSON.stringify(right.box));
  assert.ok(Math.abs(right.box.left + right.box.width / 2 - 810) <= 2 || right.box.left + right.box.width === 930, JSON.stringify(right.box));
  assert.ok(Math.abs(right.box.left + right.box.width / 2 - 810) <= 10, JSON.stringify(right.box));
  assert.deepEqual(titles(draw(tall, 360)).map((t) => t.box), side.map((t) => t.box));
  const above = titles(draw(wide, 30));
  assert.ok(above.every((t) => Math.abs(t.box.left + t.box.width / 2 - 540) <= 1), JSON.stringify(above));
  const [upper, lower] = above.map((t) => t.box.top + t.box.height / 2) as [number, number];
  assert.ok(Math.abs(963 - upper - (lower - 963)) <= 25 && upper > 480 && above[1]!.box.top + above[1]!.box.height <= 1440, `${upper}, ${lower}`);
  // A long title goes on two lines rather than shrinking, never past the buttons.
  const long = titles(draw(tall, 30, { reelTexts: [reelTexts[0], { text: "les bouquets du jour", role: "caption", from: 0, to: 383, emphasis: [] }] }))[1]!;
  assert.ok(long.box.left + long.box.width <= 930 && long.box.height >= 2 * 50 * 1.15, JSON.stringify(long.box));
  // Its ending card when she has one: the last pair darkened under its title, its small titles gone.
  const ending = draw(tall, 370, { end: { title: "Ouvert dimanche", subtitle: "Atelier Rose", from: 335 } });
  assert.ok(drawnNodes(ending).some((n) => n.type === "div" && styleOf(n).background === "#000000" && Number(styleOf(n).opacity) === 0.55));
  assert.deepEqual(titles(ending).map((t) => t.text), ["Ouvert dimanche", "Atelier Rose"]);
  assert.equal(drawnNodes(draw(tall, 370)).filter((n) => n.type === "div" && styleOf(n).background === "#000000").length, 0);
});

test("« Écran partagé titré » (v3): its layout as a setting her words ask, and the filler sees which of her files is wide", async () => {
  const { ecranPartage } = await import("./skills/ecran-partage.ts");
  const { skillPlan, skillFillInput, skillSettings, fileFormat } = await import("./skills.ts");
  // The setting: the filler sees it (its default first: as her files), the plan keeps a choice her words asked for.
  assert.deepEqual(ecranPartage.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "carte", "plein-ecran", "empile"]]]);
  assert.deepEqual(skillSettings(ecranPartage, [{ name: "format", value: "auto" }]), {});
  // Each file's shape, in the filler's words: a horizontal video in a tall half keeps only its middle.
  assert.deepEqual([16 / 9, 9 / 16, 1, 4 / 3, 3 / 4, undefined, 0].map(fileFormat), ["horizontale", "verticale", "carrée", "horizontale", "verticale", undefined, undefined]);
  const files = [
    { id: "v0", photo: false, seconds: 12, aspect: 16 / 9 },
    { id: "v1", photo: false, seconds: 12, aspect: 9 / 16 },
    { id: "p0", photo: true, seconds: 0, aspect: 1 },
    { id: "v2", photo: false, seconds: 12 },
  ];
  const input = skillFillInput({ skill: ecranPartage, name: "Écran partagé titré", n: 10, files, business: {}, request: "l'un au-dessus de l'autre" });
  assert.deepEqual(input.fichiers.map((f) => ("format" in f ? f.format : undefined)), ["horizontale", "verticale", "carrée", undefined]);
  assert.equal(input.reglages?.[0]?.nom, "format");
  // Its slots say where each half is: as her files give it, or the layout she asked for.
  assert.match(ecranPartage.timeline(10, { end: false }).shots[0]!.want, /^le plan qui ouvre, la moitié de gauche \(du haut quand ses fichiers sont horizontaux\)/);
  const asked = ecranPartage.timeline(10, { end: false, settings: { format: "empile" } });
  assert.match(asked.shots[0]!.want, /moitié du haut/);
  assert.match(asked.shots[1]!.want, /moitié du bas/);
  const plan = skillPlan({ skill: ecranPartage, name: "Écran partagé titré", files, fill: { shots: Array.from({ length: 10 }, (_, i) => ({ file: files[i % 4]!.id, at: 0 })), texts: { personne: "les fleuristes", resultat: "les fleurs" }, end: null, settings: { format: "empile" } } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.layers![0]!.motion.texts!.format, "empile");
  assert.equal(plan.layers![0]!.motion.texts!.solo, "-1");
  assert.deepEqual(plan.skill, { key: "ecran-partage", version: 3, settings: { format: "empile" } });
  // Its music shaped on the plan: without its bass to the third bar, cut dead at the end.
  assert.deepEqual(plan.music_shape, { filters: [{ kind: "thin", from: 0, to: 4, open: 0.02 }], end: { at: plan.duration, fade: 0.012 } });
  // Each second half is laid beside its first on the plan (its moment kept), and the filler is told which slot it plays
  // with: the Reel lasts its five pairs, not ten shots in a row.
  const segments = plan.segments as { beside?: { at: number } }[];
  assert.deepEqual(segments.map((s) => s.beside?.at ?? null), [null, 0, null, 2.27, null, 5.77, null, 7.77, null, 10.67]);
  assert.ok(Math.abs(plan.duration - 12.77) < 0.05, `${plan.duration} s`);
  assert.deepEqual(input.cases.map((c) => ("en_meme_temps_que" in c ? c.en_meme_temps_que : null)), [null, 1, null, 3, null, 5, null, 7, null, 9]);
});

// ——— The engine's tools the fiches found missing (5 November): simultaneous shots, objects counted from the end or
// placed by the timeline, cut-outs only on the shots drawn, eight objects a Reel, a ready look on one passage, a skill
// rendered locally with its model's finish ———————————————————————————————————————————————————————————————————————————

/** A plan of her shots (a, b, c, d of 2 s each), the second and fourth laid beside the first and the third. */
const besidePlan = (over: Partial<EditPlan> = {}): EditPlan =>
  editPlanSchema.parse({
    format: "9:16",
    duration: 4,
    template: "libre",
    segments: [
      { clip_id: "a", in: 0, out: 2 },
      { clip_id: "b", in: 1, out: 3, beside: { at: 0 } },
      { clip_id: "c", in: 0, out: 2 },
      { clip_id: "d", in: 2, out: 4, beside: { at: 2 } },
    ],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    ...over,
  });

test("simultaneous shots: a shot laid beside another starts on its own moment, its time counted once, only a composition draws it", async () => {
  const { planTimeline } = await import("./motion.ts");
  const { renderDuration } = await import("./render.ts");
  const { segmentSpans, withoutScenes, isBeside } = await import("./schemas.ts");
  const { timeline } = await import("./plan-edit.ts");
  const { leadPlan } = await import("./sound-follow.ts");
  const { editorOutputSchemaLegacy } = await import("./editor.ts");
  const plan = besidePlan();
  // Its shots two by two on the same moment: 4 s, not 8.
  assert.deepEqual(planTimeline(plan), { segments: [{ start: 0, length: 2 }, { start: 0, length: 2 }, { start: 2, length: 2 }, { start: 2, length: 2 }], duration: 4 });
  assert.deepEqual(segmentSpans(plan.segments).end, 4);
  assert.deepEqual(timeline(plan), [{ start: 0, end: 2 }, { start: 0, end: 2 }, { start: 2, end: 4 }, { start: 2, end: 4 }]);
  assert.deepEqual(plan.segments.map(isBeside), [false, true, false, true]);
  // The ffmpeg engine plays the main line (a, c), 4 s.
  assert.deepEqual(withoutScenes(plan).segments.map((s) => ("clip_id" in s ? s.clip_id : "")), ["a", "c"]);
  assert.equal(renderDuration(plan), 4);
  // A plan without any is unchanged: one shot after the other.
  const plain = besidePlan({ segments: plan.segments.map((s) => ({ ...s, beside: undefined })) as EditPlan["segments"] });
  assert.equal(planTimeline(plain).duration, 8);
  assert.equal(renderDuration(plain), 8);
  // The render: both start on the same frame, the second marked (the plain montage skips it), never heard, its words
  // not the Reel's subtitles; a composition gets both shots on that frame, and one cut where both change.
  const props = buildReelProps(
    {
      ...plan,
      subtitles: true,
      finish: { video_sound: "all" },
      layers: [{ from: 0, to: 4, compose: true, motion: { brief: "b", js: "function Scene(){ return null }", draws_texts: true } }],
    },
    {
      template: "libre",
      clipUrls: { a: "/a.mp4", b: "/b.mp4", c: "/c.mp4", d: "/d.mp4" },
      words: { b: [{ w: "bonjour", start: 1.2, end: 1.6 }] },
      brand: { name: "Atelier" },
    },
  );
  assert.equal(props.durationInFrames, 120);
  assert.deepEqual(props.segments.map((s) => [s.startAt, s.durationInFrames, "beside" in s ? Boolean(s.beside) : false]), [[0, 60, false], [0, 60, true], [60, 60, false], [60, 60, true]]);
  assert.deepEqual(props.segments.map((s) => (s.type === "clip" ? Boolean(s.speech) : null)), [true, false, true, false]);
  assert.deepEqual(props.words, []);
  assert.deepEqual(props.layers![0]!.shots!.map((s) => [s.segment, s.from]), [[0, 0], [1, 0], [2, 60], [3, 60]]);
  assert.deepEqual(props.layers![0]!.cuts, [60]);
  // A sound she follows holds the first image longer: the shots laid beside start that much later too.
  const led = leadPlan(plan, 0.4);
  assert.deepEqual(led.segments.map((s) => ("beside" in s ? (s.beside?.at ?? null) : null)), [null, 0.4, null, 2.4]);
  assert.equal(planTimeline(led).duration, 4.4);
  // Kept on the plan (its schema), never written by the editor (its answer has no such field).
  assert.equal("beside" in editorOutputSchemaLegacy.shape.plan.shape.segments.element.options[0].shape, false);
  // The tempo's snap leaves them where the skill set them, on its beats.
  assert.deepEqual(snapToTempo({ ...plan, tempo: 100 }, { a: 10, b: 10, c: 10, d: 10 }).segments, plan.segments);
});

test("simultaneous shots in a skill: a half that cuts alone while the other plays on, cast by the filler like any slot", async () => {
  const { skillPlan, skillFillInput, besideOf } = await import("./skills.ts");
  const { planTimeline } = await import("./motion.ts");
  // « Photos posées sur la table »: its split screen's left half holds one shot while its right half cuts twice.
  const skill = {
    key: "toy",
    version: 1,
    bpm: 120,
    shots: [3, 3],
    files: [3, 3],
    how: "",
    texts: [],
    end: false,
    timeline: () => ({
      duration: 4,
      shots: [
        { start: 0, end: 4, want: "à gauche, le lieu" },
        { start: 0, end: 2, want: "à droite, le geste", beside: true },
        { start: 2, end: 4, want: "à droite, le même geste de plus près", beside: true },
      ],
      texts: {},
      marks: {},
    }),
    code: "function Scene(){ return null }",
  } satisfies MontageSkillShape;
  const line = skill.timeline();
  assert.deepEqual(besideOf(line), [null, 0, 0]);
  const files = ["v0", "v1", "v2"].map((id) => ({ id, photo: false, seconds: 10 }));
  const input = skillFillInput({ skill, name: "Table", n: 3, files, business: {}, request: "" });
  assert.deepEqual(input.cases.map((c) => ("en_meme_temps_que" in c ? c.en_meme_temps_que : null)), [null, 1, 1]);
  const plan = skillPlan({ skill, name: "Table", files, fill: { shots: files.map((f) => ({ file: f.id, at: 1 })), texts: {}, end: null } });
  assert.deepEqual(plan.segments.map((s) => ("beside" in s ? (s.beside?.at ?? null) : null)), [null, 0, 2]);
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(planTimeline(plan), { segments: [{ start: 0, length: 4 }, { start: 0, length: 2 }, { start: 2, length: 2 }], duration: 4 });
  assert.equal(plan.duration, 4);
});

/** What a test skill needs (its timeline taking no arguments). */
type MontageSkillShape = Omit<import("./skills.ts").MontageSkill, "timeline"> & { timeline: (...args: never[]) => import("./skills.ts").SkillTimeline };

test("objects of a skill: on a slot counted from the end, or placed by its timeline, followed only there", async () => {
  const { skillObjectShot, skillFillInput, skillPlan, skillDrawn } = await import("./skills.ts");
  const { objectPassages, layerObjects } = await import("./subject.ts");
  // « Mots aux quatre coins »: her front is always the last shot, whatever the count; another slot placed by the timeline.
  const objects = [
    { slot: "enseigne", shot: -1, want: "son enseigne" },
    { slot: "fenetres", shot: 0, want: "ses fenêtres" },
  ];
  const line = (n: number) => ({ shots: Array.from({ length: n }, (_, i) => ({ start: i, end: i + 1, want: "" })), objects: { fenetres: n - 3 } });
  assert.equal(skillObjectShot(objects[0]!, line(5)), 4);
  assert.equal(skillObjectShot(objects[0]!, line(9)), 8);
  assert.equal(skillObjectShot(objects[1]!, line(9)), 6);
  assert.equal(skillObjectShot({ slot: "x", shot: 12 }, line(5)), null);
  assert.equal(skillObjectShot({ slot: "x", shot: -6 }, line(5)), null);
  const skill = {
    key: "toy",
    version: 1,
    bpm: 120,
    shots: [4, 9],
    files: [2, 9],
    how: "",
    texts: [],
    end: false,
    objects,
    timeline: (n: number) => ({ duration: n, ...line(n), texts: {}, marks: {} }),
    // Its code names the shots by a variable (its front: the last one).
    code: `function Scene({ shots }) { const front = shots.length - 1; return [SubjectParts(shots[front], 0, null, "@enseigne", 8), SubjectBox(shots[shots.length - 3], 0, null, "@fenetres")]; }`,
  } satisfies MontageSkillShape;
  const files = Array.from({ length: 7 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 10 }));
  // The filler is told the slot each object is on for this count.
  assert.deepEqual(skillFillInput({ skill, name: "Toy", n: 7, files, business: {}, request: "" }).objets, [
    { slot: "enseigne", case: 7, cherche: "son enseigne" },
    { slot: "fenetres", case: 5, cherche: "ses fenêtres" },
  ]);
  const plan = skillPlan({ skill, name: "Toy", files, fill: { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: {}, end: null, objects: { enseigne: "shop sign", fenetres: "every window" } } });
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 7, objects: [{ shot: 6, name: "shop sign" }, { shot: 4, name: "every window" }] });
  assert.ok(editPlanSchema.safeParse(plan).success);
  // Only those passages are followed, though its code writes their shots as variables.
  assert.deepEqual(layerObjects(plan, plan.layers![0]!), [{ shot: 6, name: "shop sign" }, { shot: 4, name: "every window" }]);
  assert.deepEqual(objectPassages(plan, () => true).map((p) => [p.clip_id, p.name]), [["v6", "shop sign"], ["v4", "every window"]]);
  // Its code kept over other shots (the editor's correction): the count no longer fits, its code is read again (every
  // shot under it: its seven seconds, seven shots, for each of its two objects).
  const kept = { ...plan, segments: [...plan.segments, ...plan.segments.slice(0, 2)] };
  assert.equal(layerObjects(kept, kept.layers![0]!).length, 14);
  // A slot left unnamed (nothing in her shot fits) is no object; a timeline that says nothing, nothing declared.
  assert.equal(skillDrawn(skill, line(7), { enseigne: "none" }), undefined);
  assert.equal(skillDrawn({}, { shots: line(7).shots }, {}), undefined);
});

/** Every shot a composition draws her cut out on over the frames given (Subject without an object, SubjectBox, SubjectOutline or SubjectParts without a name), each one found so every branch that needs her is taken. */
async function cutoutsDrawn(code: string, props: Record<string, unknown>, frames: number[]): Promise<Set<number>> {
  const { MOTION_SCOPE } = await import("./motion-scene.ts");
  const seen = new Set<number>();
  let current = 0;
  const React = {
    createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]) => {
      if (type === "Subject" && p && !p.object && typeof p.shot === "number") seen.add(p.shot);
      // A FitText's content may be a function of its scale: run it, so what it holds is drawn too.
      for (const c of children) if (typeof c === "function") (c as (s: number) => unknown)(1);
      return { type, props: p ?? {}, children };
    },
    Fragment: "Fragment",
  };
  const her = (shot: { segment?: number } | undefined, name?: unknown) => {
    if (shot && typeof name !== "string" && typeof shot.segment === "number") seen.add(shot.segment);
    return { x: 400, y: 120, w: 260, h: 480 };
  };
  const scope: Record<string, unknown> = Object.fromEntries(MOTION_SCOPE.filter((n) => n !== "React").map((n) => [n, n]));
  Object.assign(scope, {
    useCurrentFrame: () => current,
    useVideoConfig: () => ({ width: 1080, height: 1920, fps: 30, durationInFrames: props.durationInFrames }),
    interpolate: (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1))),
    interpolateColors: () => "#000000",
    spring: () => 1,
    random: (seed: string) => [...seed].reduce((x, c) => Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) / 4294967296,
    SubjectBox: (shot: { segment?: number }, _f: number, _laid: unknown, name?: string) => her(shot, name),
    SubjectOutline: (shot: { segment?: number }, _f: number, _laid: unknown, name?: string) => (her(shot, name), null),
    SubjectParts: (shot: { segment?: number }, _f: number, _laid: unknown, name?: string) => (her(shot, name), []),
    ClearBox: (_s: unknown, _f: number, _l: unknown, options?: { fallback?: unknown }) => options?.fallback ?? null,
    Easing: { bezier: () => (t: number) => t, out: (f: unknown) => f, inOut: (f: unknown) => f, cubic: (t: number) => t },
    // Nothing else read on her shots (as in the scene check): no sky, no light, no lines.
    SkylineAt: () => null,
    LightUnder: () => null,
    VanishingPoint: (_s: unknown, _f: number, _l: unknown, options?: { fallback?: unknown }) => options?.fallback ?? null,
    HeadMoves: () => [],
  });
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => unknown;
  const Scene = make(React, ...Object.values(scope));
  for (const f of frames) {
    current = f;
    Scene(props);
  }
  return seen;
}

test("cut-outs: only on the shots a composition draws her on, as its code names them or its skill's timeline says them", async () => {
  const { subjectsDrawn, subjectPassages, subjectShots, ANY_SHOT } = await import("./subject.ts");
  const { decode } = await import("./skills/decode.ts");
  const { skillPlan } = await import("./skills.ts");
  // Read in its code: a shot as a number or shots[n], an object never, a variable every shot.
  assert.deepEqual(subjectsDrawn(`h(Subject, { shot: 3, style }); SubjectBox(shots[5], f, laid); h(Subject, { shot: 1, object: "cup" })`), [3, 5]);
  assert.deepEqual(subjectsDrawn(`<Outline shot={shots[2]} box={laid} />`), [2]);
  assert.deepEqual(subjectsDrawn(`h(Subject, { shot: 5 + j, style })`), [ANY_SHOT]);
  assert.deepEqual(subjectsDrawn(`SubjectBox(shots[i], f, laid)`), [ANY_SHOT]);
  assert.deepEqual(subjectsDrawn(`const S = Subject; h(S, {})`), [ANY_SHOT]);
  assert.deepEqual(subjectsDrawn(`SubjectBox(shots[1], f, laid, "cup")`), []);
  // A composition over six shots that draws her on her shot 2: only that passage is cut out, not the 12 s of the six.
  const segments = Array.from({ length: 6 }, (_, i) => ({ clip_id: `v${i}`, in: 0, out: 2 }));
  const layers = (js: string, drawn?: unknown) => [{ from: 0, to: 12, compose: true, motion: { brief: "b", js, ...(drawn ? { drawn } : {}) } }];
  assert.deepEqual(subjectPassages({ segments, layers: layers("h(Subject, { shot: 2 })") } as never, () => true).map((p) => p.clip_id), ["v2"]);
  assert.equal(subjectPassages({ segments, layers: layers("h(Subject, { shot: k })") } as never, () => true).length, 6);
  // Declared by its skill for this count: those, and its code's numbers; for another count (its code kept over other shots), read again.
  assert.deepEqual(subjectPassages({ segments, layers: layers("h(Subject, { shot: k })", { shots: 6, subjects: [1, 4] }) } as never, () => true).map((p) => p.clip_id), ["v1", "v4"]);
  assert.equal(subjectPassages({ segments, layers: layers("h(Subject, { shot: k })", { shots: 5, subjects: [1, 4] }) } as never, () => true).length, 6);
  assert.deepEqual([...subjectShots({ segments, layers: layers("h(Subject, { shot: k })", { shots: 6, subjects: [] }) } as never)], []);
  // A composition still to be written (her cut-outs made while it is written), and what is said written around her: as before, every passage.
  assert.equal(subjectPassages({ segments, layers: [{ from: 0, to: 12, compose: true, motion: { brief: "b" } }] } as never, () => true, true).length, 6);
  // « Titre qui se décode »: its code names its ending's three by their place from the end; its timeline says them, and
  // they are exactly the shots its code draws her on, at every image, for every count it plays (with an ending card too).
  for (const [n, end] of [[9, false], [12, false], [16, false], [16, true], [23, false]] as const) {
    const line = decode.timeline(n, { end });
    const shots = line.shots.map((s, i) => ({ src: `/v${i % 5}.mp4`, aspect: 16 / 9, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
    const durationInFrames = Math.round(line.duration * 30);
    const props = {
      width: 1080,
      height: 1920,
      durationInFrames,
      brand: { name: "Atelier", displayFont: "Open Sans", bodyFont: "Open Sans" },
      shots,
      reelTexts: [
        { text: "Paris", role: "hook", from: 0, to: 300, emphasis: [] },
        { text: "un samedi à", role: "caption", from: 0, to: 300, emphasis: [] },
      ],
      end: end ? { title: "Ouvert dimanche", subtitle: null, from: durationInFrames - 48 } : null,
      texts: Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])),
    };
    const drawn = await cutoutsDrawn(decode.code, props, Array.from({ length: durationInFrames }, (_, f) => f));
    assert.deepEqual([...drawn].sort((a, b) => a - b), line.cutouts, `${n} shots${end ? ", an ending card" : ""}`);
  }
  // On its plan: declared, so only those three passages are cut out (2 s of the ending's 6 s, not the Reel's 22 s).
  const files = Array.from({ length: 16 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 20 }));
  const plan = skillPlan({ skill: decode, name: "Titre qui se décode", files, fill: { shots: files.map((f) => ({ file: f.id, at: 1 })), texts: { surtitre: "un samedi à", titre: "Paris" }, end: null } });
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 16, subjects: [12, 14, 15] });
  assert.deepEqual(subjectPassages(plan, () => true).map((p) => p.clip_id), ["v12", "v14", "v15"]);
});

test("objects: up to eight a Reel, their seconds of video and the card's cost held to their budgets", async () => {
  const { OBJECT_MAX, OBJECT_MAX_SECONDS, OBJECT_MAX_EUR, OBJECT_CARD, objectPassages, objectsWithinBudget } = await import("./subject.ts");
  const { modalCostUsd } = await import("./pricing.ts");
  assert.equal(OBJECT_MAX, 8);
  // « Titre derrière le décor » named five on five of her shots: all five are followed now.
  const segments = Array.from({ length: 10 }, (_, i) => ({ clip_id: `v${i}`, in: 0, out: 1.5 }));
  const names = ["skyline", "every window", "shop sign", "every frame", "ferris wheel hub"];
  const js = names.map((name, i) => `h(Subject, { shot: ${2 * i}, object: "${name}" })`).join("; ");
  const plan = { segments, layers: [{ from: 0, to: 15, compose: true, motion: { brief: "b", js } }] } as never;
  assert.deepEqual(objectPassages(plan, () => true).map((p) => p.name), names);
  // Eleven on long passages: within the 20 s of video (each read on its whole passage), whatever their number.
  const long = { segments: Array.from({ length: 11 }, (_, i) => ({ clip_id: `v${i}`, in: 0, out: 4 })), layers: [{ from: 0, to: 44, compose: true, motion: { brief: "b", js: Array.from({ length: 11 }, (_, i) => `h(Subject, { shot: ${i}, object: "cup" })`).join(";") } }] } as never;
  const kept = objectPassages(long, () => true);
  assert.ok(kept.length <= OBJECT_MAX && kept.reduce((n, p) => n + p.to - p.from, 0) <= OBJECT_MAX_SECONDS, `${kept.length} passages`);
  // The card's cost: 20 s of video on an A10G stays under the budget; at a dearer price the last ones named are left out.
  const a10g = modalCostUsd(1, 2, 8, "A10G") * 0.92;
  const twenty = Array.from({ length: 5 }, (_, i) => ({ from: 0, to: 4, key: `p${i}` }));
  assert.ok((OBJECT_CARD.load + 20 * OBJECT_CARD.perSecond) * a10g < OBJECT_MAX_EUR, `${(OBJECT_CARD.load + 240) * a10g} €`);
  assert.deepEqual(objectsWithinBudget(twenty, a10g).length, 5);
  const dear = objectsWithinBudget(twenty, a10g * 2);
  assert.deepEqual(dear.map((p) => p.key), twenty.slice(0, dear.length).map((p) => p.key));
  assert.ok(dear.length < 5 && dear.length > 0, `${dear.length}`);
  // A photo is one image read: a few seconds of the card.
  assert.equal(objectsWithinBudget([{ from: 0, to: 0, photo: true as const }], a10g).length, 1);
  assert.deepEqual(objectsWithinBudget([], a10g), []);
});

test("a ready look on one passage: the composition's Look lays a preset over what it wraps, while its shot plays or within its span", async () => {
  const { passageLooks, usesPassageLooks } = await import("./motion.ts");
  const { MOTION_SCOPE, MOTION_DESIGNER_PROMPT } = await import("./motion-scene.ts");
  const { CAROUSEL_SCOPE } = await import("./carousel.ts");
  const { passageLook, passageLookOn } = await import("../../../apps/render/src/look-passage.ts");
  // Given to the render only when an animation's code lays one: each ready look, its grade as one matrix, its camera's date.
  const code = `function Scene({ shots }) { return h(Look, { preset: "vhs", shot: shots[2] }, h(Footage, { shot: 2 })); }`;
  const plan = besidePlan({ layers: [{ from: 0, to: 4, compose: true, motion: { brief: "b", js: code, draws_texts: true } }] });
  assert.equal(usesPassageLooks(plan), true);
  assert.equal(usesPassageLooks(besidePlan()), false);
  assert.equal(usesPassageLooks(besidePlan({ layers: [{ from: 0, to: 4, compose: true, motion: { brief: "b", js: "function Scene(){ return h(LookBack) }" } }] })), false);
  const props = buildReelProps(plan, { template: "libre", clipUrls: { a: "/a", b: "/b", c: "/c", d: "/d" }, brand: { name: "Atelier" }, today: "2026-11-05" });
  assert.deepEqual(Object.keys(props.looks ?? {}).sort(), [...Object.keys(LOOK_PRESETS)].sort());
  assert.deepEqual(props.looks!.vhs!.look.matrix, lookMatrix(LOOK_PRESETS.vhs));
  assert.equal(props.looks!.vhs!.stamp, "5 NOV. 2026");
  assert.equal(props.looks!.bw!.stamp, undefined);
  assert.equal(props.look, undefined);
  assert.equal(buildReelProps(besidePlan(), { template: "libre", clipUrls: { a: "/a", b: "/b", c: "/c", d: "/d" }, brand: { name: "Atelier" } }).looks, undefined);
  // Named by its key or its name; another word is none (the passage plays plain).
  const looks = passageLooks();
  assert.equal(passageLook(looks, "vhs")?.look.name, "Cassette VHS");
  assert.equal(passageLook(looks, "Noir et blanc"), passageLook(looks, "bw"));
  assert.equal(passageLook(looks, "aquarelle"), null);
  assert.equal(passageLook(null, "vhs"), null);
  // On while its shot plays, or within its span (its end excluded), all along with neither.
  const shot = { from: 60, durationInFrames: 30 };
  assert.deepEqual([59, 60, 89, 90].map((f) => passageLookOn(f, { shot })), [false, true, true, false]);
  assert.deepEqual([9, 10, 13, 14].map((f) => passageLookOn(f, { from: 10, to: 14 })), [false, true, true, false]);
  assert.deepEqual([65, 70, 75].map((f) => passageLookOn(f, { shot, from: 70 })), [false, true, true]);
  assert.equal(passageLookOn(0, {}), true);
  // In the motion designer's scope and kit, not a carousel's (no ready looks are given to it).
  assert.ok((MOTION_SCOPE as readonly string[]).includes("Look"));
  assert.ok(!CAROUSEL_SCOPE.includes("Look"));
  assert.match(MOTION_DESIGNER_PROMPT, /<Look preset="vhs"/);
});

test("a skill rendered locally is dressed as production dresses it: its model's finish without what its code does, its lettering", async () => {
  const { dressSkillPlan, skillPlan } = await import("./skills.ts");
  const { houseStyle, houseFinish } = await import("./house-models.ts");
  const { ecranPartage } = await import("./skills/ecran-partage.ts");
  const { readFileSync } = await import("node:fs");
  const model = houseModel("ecran-partage")!;
  const files = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const bare = skillPlan({ skill: ecranPartage, name: model.name, files, fill: { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { personne: "les artistes", resultat: "l'art" }, end: null } });
  assert.equal(bare.look, undefined);
  // Chosen by her: the model's finish over the whole Reel, its grain and vignette taken out (its code has neither), its pairing.
  const chosen = dressSkillPlan(bare, ecranPartage, followedFrom("local", houseStyle(model)));
  assert.deepEqual(chosen.look, { ...houseFinish(model), grain: 0, vignette: 0 });
  assert.ok(chosen.fonts?.display, JSON.stringify(chosen.fonts));
  // Picked by Edith: dressed in her charter (no lettering of the model's), the same finish.
  const picked = dressSkillPlan(bare, ecranPartage, followedFrom("local", houseStyle(model), false, true));
  assert.equal(picked.fonts, undefined);
  assert.deepEqual(picked.look, chosen.look);
  // Without a model followed, her own look for all her Reels, else none; the plan given is left as it was.
  assert.equal(dressSkillPlan(bare, ecranPartage, undefined, LOOK_PRESETS.bw).look, LOOK_PRESETS.bw);
  assert.equal(dressSkillPlan(bare, ecranPartage, undefined).look, undefined);
  assert.equal(bare.look, undefined);
  // The local render and production dress it the same way.
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(read("../../../scripts/skill-render.mts"), /dressSkillPlan\(skillPlan\(/);
  assert.match(read("../../../apps/web/src/lib/agent/skill-design.ts"), /dressSkillPlan\(leadPlan\(skillPlan\(/);
});

// ——— « Façade qui se construit » v2, written again on its original's fiche (docs/fiches/facade.md) —————————————————

/** The original's pieces (its images at 30 i/s, measured piece by piece): four slow, a burst of twelve, three big ones. */
const FACADE_SLOW = [1, 25, 53, 80];
const FACADE_BURST = [85, 90, 94, 97, 100, 104, 109, 114, 118, 124, 128, 132];
const FACADE_BIG = [158, 175, 190];

/** Its composition's props on its timeline for n shots, each of that shape (width / height), its marks as its slot texts. */
async function facadeProps(n: number, aspect = 9 / 16, options: { end?: boolean; settings?: Record<string, string> } = {}) {
  const { facade } = await import("./skills/facade.ts");
  const line = facade.timeline(n, { end: Boolean(options.end) });
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const texts = { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...(options.settings ?? {}) };
  const brand = { name: "Brick Lane Bookshop", displayFont: "DM Serif Display", bodyFont: "Poppins" };
  return { line, props: { width: 1080, height: 1920, durationInFrames: Math.round(line.duration * 30), brand, shots, reelTexts: [] as unknown[], end: null as unknown, texts } };
}
/** The pieces its clip shows at a frame, in the order they landed (a rectangle's box, or a path), null once her front is whole. */
function facadeClip(tree: Drawn): (number[] | string)[] | null {
  const clip = drawnNodes(tree).find((n) => n.type === "clipPath");
  if (!clip) return null;
  return drawnNodes(clip.children).map((n) => (n.type === "path" ? String(n.props.d) : [n.props.x, n.props.y, n.props.width, n.props.height].map(Number)));
}
/** Its code with its objects named as the filler names them on a front: what repeats on it, and her sign. */
const facadeNamed = async () => {
  const { facade } = await import("./skills/facade.ts");
  const { skillCode } = await import("./skills.ts");
  return SEEDED + skillCode(facade, { morceaux: "every window", enseigne: "shop sign" });
};
/** An upright front read on its first image, as the card reads it: its sign and its outline, its windows and its door. */
const FACADE_OUTLINE = "M 80 560 C 300 554 560 554 780 560 C 784 625 784 625 780 690 C 560 696 300 696 80 690 C 76 625 76 625 80 560 Z";
const FACADE_READ = {
  boxes: { "0#shop sign": { x: 80, y: 560, w: 700, h: 130 }, "0#every window": { x: 40, y: 260, w: 820, h: 960 } },
  outlines: { "0#shop sign": FACADE_OUTLINE },
  parts: {
    "0#every window": [
      { x: 120, y: 260, w: 200, h: 240 }, { x: 360, y: 280, w: 160, h: 200 }, { x: 560, y: 260, w: 200, h: 240 },
      { x: 40, y: 760, w: 200, h: 400 }, { x: 260, y: 760, w: 200, h: 400 }, { x: 480, y: 760, w: 200, h: 400 }, { x: 700, y: 740, w: 160, h: 480 },
    ],
  },
};

test("« Façade qui se construit » (v2) lays its pieces on its original's images and notes, the rest on its music's first beats (120 BPM)", async () => {
  const { facade } = await import("./skills/facade.ts");
  const { skillPlan, skillFit } = await import("./skills.ts");
  assert.equal(facade.version, 2);
  assert.equal(facade.bpm, 120);
  assert.deepEqual(facade.shots, [1, 3]);
  const line = facade.timeline(1, { end: false });
  // Her front alone: the original's 9 s, to its only cut (its image 270).
  assert.equal(line.shots.length, 1);
  assert.equal(line.duration, 9);
  // Its four slow pieces and its burst of twelve on the original's images (within two each), one every 3 to 6 images.
  const at = Array.from({ length: 19 }, (_, i) => line.marks[`piece_${i}`]!);
  [...FACADE_SLOW, ...FACADE_BURST].forEach((f, i) => assert.ok(Math.abs(at[i]! - f) <= 2, `piece ${i + 1}: image ${at[i]}, the original's ${f}`));
  for (let i = 5; i < 16; i++) assert.ok(at[i]! - at[i - 1]! >= 3 && at[i]! - at[i - 1]! <= 6, `piece ${i + 1}: ${at[i]! - at[i - 1]!} images after the one before`);
  // Its three big ones a hair before its music's beats 11, 12 and 13 (images 165, 180, 195), as the original's before
  // its chords (2,7 then 0,9 image): 4 images after the original's own (its grid 0,72 beat off ours); nothing new between.
  [165, 180, 195].forEach((beat, k) => assert.ok(at[16 + k]! < beat && beat - at[16 + k]! <= 3, `big ${k + 1}: image ${at[16 + k]}`));
  FACADE_BIG.forEach((f, k) => assert.ok(at[16 + k]! - f >= 0 && at[16 + k]! - f <= 5, `big ${k + 1}: image ${at[16 + k]}, the original's ${f}`));
  assert.ok(at[16]! - at[15]! >= 26, "its silence");
  // Her optional name with the first piece, its line with the second; both go with the last piece.
  assert.deepEqual([line.texts.nom!.from, line.texts.ligne!.from, line.texts.nom!.to, line.texts.ligne!.to].map((t) => Math.round(t * 30)), [1, 25, at[18], at[18]]);
  // A note on each piece as it lands: four lone notes rising, then twelve plucks rising and louder; none on the big ones.
  const sounds = line.sounds!;
  assert.deepEqual(sounds.map((s) => Math.round(s.at * 30)), at.slice(0, 16));
  assert.equal(new Set(sounds.slice(0, 4).map((s) => s.sound)).size, 4);
  assert.ok(sounds.slice(4).every((s) => /harp pluck/.test(s.sound)));
  assert.ok(sounds.slice(5).every((s, i) => (s.gain ?? 0) >= (sounds[4 + i]!.gain ?? 0)));
  // Its music silent while her front builds, in on beat 11 (its first big piece), cut dead with the last image.
  assert.deepEqual(line.music, { pauses: [{ from: 0, to: 5.5 }], end: { at: 9 } });
  // Her other files after it, a bar each, cut on the beat: the first on the original's cut (9,0 s).
  const three = facade.timeline(3, { end: false });
  assert.deepEqual(three.shots.map((s) => [s.start, s.end]), [[0, 9], [9, 11], [11, 13]]);
  assert.equal(three.marks.piece_18, at[18]);
  // With an ending card (an option: the original has none), the last shot held half beats more, black from its end.
  const ended = facade.timeline(3, { end: true });
  assert.deepEqual(ended.shots.slice(0, 2), three.shots.slice(0, 2));
  assert.ok(ended.duration - three.duration >= 1.65 && ended.duration - three.duration <= 1.9, `${ended.duration} s`);
  assert.equal(ended.marks.black, 390);
  assert.ok(three.marks.black! > Math.round(three.duration * 30));
  // At another tempo all of it follows its beats; a length she asks for: more of her files, a bar each, 23 s at its own
  // tempo, 30 s a little slower.
  const slower = facade.timeline(1, { end: false, bpm: 100 });
  assert.ok(Math.abs(slower.marks.piece_18! / at[18]! - 1.2) < 0.01 && Math.abs(slower.duration - 10.8) < 0.04, `${slower.duration} s`);
  assert.ok(Math.abs(facade.timeline(8, { end: false }).duration - 23) < 0.05);
  assert.deepEqual(skillFit(facade, 15), { n: 4, bpm: 120 });
  const thirty = skillFit(facade, 30);
  assert.ok(thirty.bpm < 120 && Math.abs(facade.timeline(thirty.n, { end: false, bpm: thirty.bpm }).duration - 30) <= 1, JSON.stringify(thirty));
  // On the plan: valid, its sounds kept as the model's, its music's shape.
  const files = [{ id: "front", photo: false, seconds: 15 }, { id: "inside", photo: false, seconds: 12 }];
  const plan = skillPlan({ skill: facade, name: "Façade qui se construit", files, fill: { shots: [{ file: "front", at: 0 }, { file: "inside", at: 2 }], texts: { nom: "Brick Lane" }, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.sounds?.length, 16);
  assert.ok(plan.sounds!.every((s) => s.skill));
  assert.deepEqual(plan.music_shape, { pauses: [{ from: 0, to: 5.5 }], end: { at: 11, fade: 0.012 } });
  // Its finish keeps its ground a pure black: no grain, no dark corners, no fade lifting it.
  assert.deepEqual(facade.finish, { grain: 0, vignette: 0, fade: 0 });
});

test("« Façade qui se construit » (v2): her front's own elements, named by the filler, build it piece by piece on the black", async () => {
  const { facade } = await import("./skills/facade.ts");
  const { skillPlan } = await import("./skills.ts");
  const { objectsDrawn, objectPassages, clearsDrawn, drawsSubject } = await import("./subject.ts");
  const { checkMotionCode } = await import("./motion-scene.ts");
  // Unnamed, nothing is followed; named, what repeats on her front first (read first within a Reel's 20 s of objects),
  // then her sign, both on her front's shot; nobody cut out, nothing read for a text (her name sits on the black).
  assert.deepEqual(objectsDrawn(facade.code), []);
  const code = await facadeNamed();
  assert.deepEqual(objectsDrawn(code), [{ shot: 0, name: "every window" }, { shot: 0, name: "shop sign" }]);
  assert.deepEqual(clearsDrawn(code), []);
  assert.equal(drawsSubject(code), false);
  assert.deepEqual(checkMotionCode(facade.code), []);
  assert.deepEqual(facade.objects?.map((o) => [o.slot, o.shot]), [["morceaux", 0], ["enseigne", 0]]);
  // A front of 9 s keeps both within them; a lone front that carries an ending card (10,8 s) keeps what repeats on it.
  const files = [{ id: "front", photo: false, seconds: 15 }, { id: "inside", photo: false, seconds: 12 }];
  const objects = { morceaux: "every window", enseigne: "shop sign" };
  const two = skillPlan({ skill: facade, name: "Façade", files, fill: { shots: [{ file: "front", at: 0 }, { file: "inside", at: 1 }], texts: {}, end: null, objects } });
  assert.deepEqual(objectPassages(two, () => true).map((p) => [p.name, p.from, p.to]), [["every window", 0, 9], ["shop sign", 0, 9]]);
  const alone = skillPlan({ skill: facade, name: "Façade", files, fill: { shots: [{ file: "front", at: 0 }], texts: {}, end: { title: "Ouvert dimanche" }, objects } });
  assert.deepEqual(objectPassages(alone, () => true).map((p) => p.name), ["every window"]);
  // An upright front, as the original's, read on its first image.
  const { line, props } = await facadeProps(1);
  const at = Array.from({ length: 19 }, (_, i) => line.marks[`piece_${i}`]!);
  const clipAt = (f: number, read: Parameters<typeof drawCutOuts>[3] = FACADE_READ) => facadeClip(drawCutOuts(code, f, props, read));
  // On pure black at first; each piece at once on its image, never moving again; whole on the last one (no clip).
  assert.deepEqual(clipAt(0), []);
  for (let i = 0; i < 18; i++) {
    assert.equal(clipAt(at[i]!)!.length, i + 1, `image ${at[i]}`);
    assert.equal(clipAt(at[i + 1]! - 1)!.length, i + 1, `image ${at[i + 1]! - 1}`);
  }
  assert.equal(clipAt(at[18]!), null);
  // Her sign first, along its outline; then three far from it and from each other (her door, a pane, an upper window),
  // the larger first; the burst: her other windows, the lower first and right to left, then the pavement under them
  // right to left, the side of her front going up, the wall above it; then the street, the top's left third, the rest.
  assert.deepEqual(clipAt(at[18]! - 1), [
    FACADE_OUTLINE,
    [700, 740, 160, 480], [40, 760, 200, 400], [560, 260, 200, 240],
    [480, 760, 200, 400], [260, 760, 200, 400], [360, 280, 160, 200], [120, 260, 200, 240],
    [810, 1220, 270, 96], [540, 1220, 270, 96], [270, 1220, 270, 96], [0, 1220, 270, 96],
    [860, 900, 220, 320], [860, 580, 220, 320], [860, 260, 220, 320],
    [40, 145, 820, 115],
    [0, 1316, 1080, 604], [0, 0, 366, 658],
  ]);
  // Its video plays in them: her front's shot laid over the whole frame, seen through the clip until it is whole.
  const film = (f: number) => drawnNodes(drawCutOuts(code, f, props, FACADE_READ)).find((n) => n.type === "div" && n.children.some((c) => Boolean(c) && typeof c === "object" && (c as Drawn).type === "Footage"))!;
  assert.match(String(styleOf(film(100)).clipPath), /^url\(#fc/);
  assert.equal(styleOf(film(200)).clipPath, undefined);
  assert.deepEqual(styleOf(drawnNodes(film(100)).find((n) => n.type === "Footage")!), { left: 0, top: 0, width: 1080, height: 1920 });
  // Fewer than six elements found (nothing named here): her picture in regular rectangles, five a row above the street's
  // two rows, laid at random on the same times; the street, the top's left third, then the rest.
  const grid = clipAt(at[18]! - 1, {})!;
  assert.equal(grid.length, 18);
  const cells = grid.slice(0, 16) as number[][];
  assert.equal(new Set(cells.map((c) => c.join())).size, 16);
  for (const [x, y, w, h] of cells) assert.ok(x! % 216 === 0 && w === 216 && [0, 274, 549, 823, 1097].includes(y!) && h! >= 274 && h! <= 275, JSON.stringify([x, y, w, h]));
  assert.deepEqual(grid.slice(16), [[0, 1371, 1080, 549], [0, 0, 366, 960]]);
  // The camera never moves: no zoom nor push, even to fill the screen.
  assert.doesNotMatch(facade.code, /scale\(|transform/);
});

test("« Façade qui se construit » (v2): vertical as its original, her horizontal front whole in a band on the black, her name on a piece of it", async () => {
  const { facade } = await import("./skills/facade.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const code = await facadeNamed();
  const frameOf = (tree: Drawn) => {
    const box = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden" && styleOf(n).backgroundColor === "#000000")!;
    return [styleOf(box).top, styleOf(box).height];
  };
  const front = (tree: Drawn) => styleOf(drawnNodes(tree).find((n) => n.type === "Footage" && n.props.shot === 0)!);
  const draw = async (aspect: number, f: number, settings?: Record<string, string>, read: Parameters<typeof drawCutOuts>[3] = {}, extra: Record<string, unknown> = {}) => {
    const { props } = await facadeProps(2, aspect, settings ? { settings } : {});
    return drawCutOuts(code, f, { ...props, ...extra }, read);
  };
  // Her front upright: the whole vertical frame, as the original.
  assert.deepEqual(frameOf(await draw(9 / 16, 100)), [0, 1920]);
  assert.deepEqual(front(await draw(9 / 16, 100)), { left: 0, top: 0, width: 1080, height: 1920 });
  // In width: its whole picture across the middle of the black, at its own shape (16:9, 4:3), never zoomed to fill.
  assert.deepEqual(frameOf(await draw(16 / 9, 100)), [656, 608]);
  assert.deepEqual(front(await draw(16 / 9, 100)), { left: 0, top: 0, width: 1080, height: 608 });
  assert.deepEqual(frameOf(await draw(4 / 3, 100)), [555, 810]);
  // On her word, vertical full frame from her front in width: its whole picture at the frame's height, the part around her
  // sign shown (else around its subject); or a 16:9 band from an upright front.
  const sign = { boxes: { "0#shop sign": { x: 2200, y: 700, w: 600, h: 150 } } };
  assert.deepEqual(frameOf(await draw(16 / 9, 100, { format: "vertical" }, sign)), [0, 1920]);
  assert.deepEqual(front(await draw(16 / 9, 100, { format: "vertical" }, sign)), { left: -1960, top: 0, width: 3413, height: 1920 });
  assert.deepEqual(front(await draw(16 / 9, 100, { format: "vertical" })), { left: -1167, top: 0, width: 3413, height: 1920 });
  assert.deepEqual(frameOf(await draw(9 / 16, 100, { format: "horizontal" })), [656, 608]);
  // Her other files after it in the same frame, as filmed.
  assert.deepEqual(styleOf(drawnNodes(await draw(16 / 9, 280)).find((n) => n.type === "Footage")!), { left: 0, top: 0, width: 1080, height: 608 });
  // Her optional name and its line on a piece of the black while her front builds, gone with the last piece: over the band
  // on the black; full frame where it hides the fewest of its first pieces. Nothing is ever written on her whole front.
  const reelTexts = [
    { text: "Brick Lane", role: "hook", from: 1, to: 194, emphasis: [] },
    { text: "librairie · londres", role: "caption", from: 25, to: 194, emphasis: [] },
  ];
  const label = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).backgroundColor === "#000000" && drawnNodes(n.children).some((m) => m.type === "FitText"));
  const named = (aspect: number, f: number, read: Parameters<typeof drawCutOuts>[3] = {}) => draw(aspect, f, undefined, read, { reelTexts });
  const box = (n: Drawn) => [styleOf(n).left, styleOf(n).top, styleOf(n).width, styleOf(n).height].map(Number);
  const inBand = label(await named(16 / 9, 60))!;
  assert.deepEqual(box(inBand), [114, 190, 852, 276]);
  assert.ok(box(inBand)[1]! + box(inBand)[3]! < 656);
  assert.match(heldText(inBand), /Brick Lane/);
  assert.ok(drawnNodes(inBand).some((n) => "data-fauve-accent" in n.props && /librairie/.test(heldText(n))));
  assert.equal(label(await named(16 / 9, 0)), undefined);
  assert.ok(label(await named(16 / 9, 193)));
  for (const f of [194, 230, 269]) assert.equal(drawnNodes(await named(16 / 9, f)).filter((n) => n.type === "FitText").length, 0, `image ${f}`);
  // Full frame: where the black stays longest, each piece it hides counted for as long as it hides it (here at the top,
  // over the wall above her upper windows and the top's left third, the last but one: off her sign and her door),
  // inside the Reel's safe zone.
  const [left, top, width, height] = box(label(await named(9 / 16, 60, FACADE_READ))!) as [number, number, number, number];
  assert.deepEqual([left, top, width, height], [114, 92, 852, 276]);
  assert.ok(left >= 40 && left + width <= 1040 && top >= 80 && top + height <= 0.75 * 1920);
  // Its ending card on the black after the last shot, its words at once.
  const { props } = await facadeProps(3, 9 / 16, { end: true });
  const card = drawCutOuts(code, 400, { ...props, end: { title: "Ouvert dimanche", subtitle: "Brick Lane", from: 395 } });
  assert.equal(drawnNodes(card).filter((n) => n.type === "Footage").length, 0);
  assert.deepEqual(drawnNodes(card).filter((n) => n.type === "FitText").map((n) => heldText(n).trim()), ["Ouvert dimanche", "Brick Lane"]);
  // The setting: the filler sees it (the default first: as her front), the plan keeps a choice her words asked for.
  assert.deepEqual(facade.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(facade, [{ name: "format", value: "auto" }]), {});
  const files = [{ id: "front", photo: false, seconds: 15, aspect: 16 / 9 }, { id: "inside", photo: false, seconds: 12 }];
  const input = skillFillInput({ skill: facade, name: "Façade qui se construit", n: 2, files, business: {}, request: "en vertical" });
  assert.equal(input.reglages?.[0]?.nom, "format");
  assert.deepEqual(input.objets?.map((o) => [o.slot, o.case]), [["morceaux", 1], ["enseigne", 1]]);
  const plan = skillPlan({ skill: facade, name: "Façade qui se construit", files, fill: { shots: [{ file: "front", at: 0 }, { file: "inside", at: 1 }], texts: {}, end: null, settings: { format: "vertical" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
  assert.deepEqual(plan.skill, { key: "facade", version: 2, settings: { format: "vertical" } });
});

// ——— « Coulisses façon fiche » v2, written again on its original's fiche (docs/fiches/coulisses.md) ——————————————————

/** Where each of the original's 28 shots starts (its images at 30 i/s, measured image by image); it ends on its image 315. */
const CF_CUTS = [0, 35, 45, 75, 100, 108, 109, 110, 113, 114, 115, 118, 125, 135, 148, 160, 188, 196, 205, 214, 226, 239, 246, 258, 265, 273, 285, 293];
/** Her six texts as its composition gets them, in its slots' order (images). */
const CF_TEXTS = [
  { text: "le son de", role: "caption", from: 0, to: 315, emphasis: [] },
  { text: "Coulisses", role: "hook", from: 0, to: 315, emphasis: [] },
  { text: "24 h chez", role: "caption", from: 4, to: 315, emphasis: [] },
  { text: "Atelier Rose", role: "hook", from: 9, to: 315, emphasis: [] },
  { text: "fleuriste à", role: "caption", from: 18, to: 315, emphasis: [] },
  { text: "Paris 11e", role: "hook", from: 26, to: 315, emphasis: [] },
];
const CF_WORDS = { surtitre: "le son de", titre: "Coulisses", quand: "24 h chez", nom: "Atelier Rose", pres: "fleuriste à", lieu: "Paris 11e" };
/** Its composition at a frame (drawCutOuts), her videos of that shape, its marks as the plan gives them. */
async function coulissesAt(frame: number, aspect = 16 / 9, extra: Record<string, unknown> = {}): Promise<Drawn> {
  const { coulisses } = await import("./skills/coulisses.ts");
  const line = coulisses.timeline(28, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight" };
  return drawCutOuts(coulisses.code, frame, { width: 1080, height: 1920, durationInFrames: 315, brand, shots: decodeShots(line, () => aspect), reelTexts: CF_TEXTS, end: null, texts: marks, ...extra });
}

test("« Coulisses façon fiche » (v2) cuts where its original does, names each sound as it is heard, its sounds alone and no music", async () => {
  const { coulisses } = await import("./skills/coulisses.ts");
  const { skillPlan, skillShotCount } = await import("./skills.ts");
  const { readMusicShape } = await import("./music-shape.ts");
  const { SFX_MAX_NEW, soundKey, pickCues } = await import("./sfx.ts");
  assert.equal(coulisses.version, 3);
  assert.equal(coulisses.bpm, 120);
  const line = coulisses.timeline(28, { end: false });
  // Its 28 shots (a burst of six shots of one to three images, a shot seen again, three cut in silence), each within two
  // images of the original's (on them: its images counted in beats at 120 BPM, 15 a beat), and its 10,5 s.
  assert.equal(line.shots.length, CF_CUTS.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - CF_CUTS[i]!) <= 2, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${CF_CUTS[i]}`));
  assert.ok(Math.abs(line.duration - 10.5) < 0.02, `${line.duration} s`);
  assert.deepEqual(coulisses.shots, [28, 28]);
  assert.equal(skillShotCount(coulisses, [{ id: "p", photo: true, seconds: 0 }]), 28);
  // Its label changes where the original's does (its images, read on its pixels), gone in its three silences.
  [1, 8, 18, 33, 48, 70, 80, 105, 120, 130, 154, 159, 191, 219, 243, 255, 270, 283, 290].forEach((f, i) =>
    assert.ok(Math.abs(line.marks[`l${i}`]! - f) <= 1, `label ${i + 1}: image ${line.marks[`l${i}`]}, the original's ${f}`),
  );
  // The title of her video: its small words fall on image 4, her name flickers from 9, its three pops on 18, 23 and 26;
  // each text from its moment, the title on top from the first image.
  assert.deepEqual([line.marks.fall, line.marks.flicker, line.marks.pop1, line.marks.pop2, line.marks.pop3], [4, 9, 18, 23, 26]);
  assert.deepEqual(Object.fromEntries(Object.entries(line.texts).map(([k, t]) => [k, Math.round(t.from * 30)])), { surtitre: 0, titre: 0, quand: 4, nom: 9, pres: 18, lieu: 26 });
  // Its sounds, each within an image of the original's (its loudest moments and its clicks, measured every 5 ms): its
  // whooshes, a click on each image that lights her name and on each image of each stutter, one on each pop, the
  // computer's beeps under each loading, the ratchet under the burst, the double click on the cut, a shutter on each flash.
  const heard = (sound: string) => (line.sounds ?? []).filter((s) => s.sound === sound).map((s) => s.at * 30);
  const close = (got: number[], want: number[], what: string) => {
    assert.equal(got.length, want.length, what);
    got.forEach((f, i) => assert.ok(Math.abs(f - want[i]!) <= 1, `${what} ${i + 1}: image ${f.toFixed(1)}, the original's ${want[i]}`));
  };
  close(heard("short air whoosh"), [4.5, 34.4, 44.5, 74.5, 132, 145.8, 223.3, 237.1], "whoosh");
  close(heard("camera shutter click"), [8.8, 10.9, 14.2, 16.3, 246, 247.1, 248.1, 249.2, 250.2, 251.1, 272.2, 273.3, 274.5, 275.5, 276.6, 277.6, 292.3, 293.3, 294.4, 295.4, 296.5, 297.5], "click");
  close(heard("light click"), [18.9, 23.8, 27.5], "pop");
  close(heard("computer data processing beeps"), [47.1, 162.1], "beeps");
  close(heard("mechanical ratchet clicks"), [107.2], "ratchet");
  close(heard("computer mouse double click"), [124.8], "mouse");
  close(heard("camera shutter"), [197.3, 206.4, 215.5], "shutter");
  // 40 in all (what a plan keeps), from eight sounds at most (what the library makes for one Reel), all kept a frame apart
  // at any level but off, at its tempo and its fastest.
  assert.equal(line.sounds!.length, 40);
  assert.ok(new Set(line.sounds!.map((s) => soundKey(s.sound, s.seconds))).size <= SFX_MAX_NEW);
  for (const bpm of [120, 140]) {
    const t = coulisses.timeline(28, { end: false, bpm });
    assert.equal(pickCues(t.sounds!.map((s) => ({ at: s.at, skill: true })), { level: "light", duration: t.duration, speech: [] }).length, 40, `${bpm} BPM`);
  }
  // No music at all: its sounds alone (unless she asks for a music); the plan says so to the mix.
  assert.deepEqual(line.music, { none: true });
  // With an ending card (the original has none: it loops back on its first image), its last shot held the card's 1,6 s
  // more, the rest as it is; her video's title gone under the card.
  const ended = coulisses.timeline(28, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(Math.abs(ended.duration - line.duration - 1.6) < 0.02, `${ended.duration} s`);
  assert.deepEqual(ended.sounds, line.sounds);
  assert.equal(ended.texts.nom!.to, line.duration);
  // At another tempo (a length she asks for): every moment follows it.
  const slower = coulisses.timeline(28, { end: false, bpm: 90 });
  assert.ok(Math.abs(slower.duration - 14) < 0.05, `${slower.duration} s`);
  assert.equal(slower.marks.l11, Math.round((159 * 120) / 90));
  // On the plan: valid, its 40 sounds its own, no music.
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 14 }));
  const plan = skillPlan({ skill: coulisses, name: "Coulisses façon fiche", files, fill: { shots: Array.from({ length: 28 }, (_, i) => ({ file: files[i % 12]!.id, at: Math.floor(i / 12) * 4 })), texts: CF_WORDS, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.sounds?.length, 40);
  assert.ok(plan.sounds!.every((s) => s.skill));
  assert.deepEqual(plan.music_shape, readMusicShape({ none: true }, plan.duration));
  assert.deepEqual(plan.skill, { key: "coulisses", version: 3 });
});

test("« Coulisses façon fiche » (v2): its 16:9 card for her horizontal videos as the original's, square for vertical ones or on her word, the sheet centred", async () => {
  const { coulisses } = await import("./skills/coulisses.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const keyed = (tree: Drawn, key: string) => drawnNodes(tree).find((n) => n.props.key === key)!;
  const box = (n: Drawn) => [styleOf(n).left, styleOf(n).top, styleOf(n).width, styleOf(n).height];
  // Her videos horizontal: the original's card (16:9, from 12,2 % of the width, 30,5 % of the height, corners of 30 px),
  // the title on it, the label under it, the timeline under the label: the sheet from 22 % to 77,6 % of the height.
  const wide = await coulissesAt(150);
  assert.deepEqual(box(keyed(wide, "card")), [132, 586, 816, 459]);
  assert.equal(styleOf(keyed(wide, "card")).borderRadius, 30);
  assert.deepEqual(box(keyed(wide, "timeline")), [135, 1224, 809, 266]);
  const title = box(keyed(wide, "title")) as number[];
  assert.ok(title[1]! + title[3]! <= 586 && title[1]! >= 0.17 * 1920, JSON.stringify(title));
  // Mostly vertical, or on her word: a square card of the same width, the sheet centred, the label above 75 % of the
  // height and left of the apps' buttons; on her word, the original's card whatever her videos.
  const tall = await coulissesAt(150, 9 / 16);
  assert.deepEqual(box(keyed(tall, "card")), [132, 408, 816, 816]);
  assert.deepEqual(box(keyed(await coulissesAt(150, 16 / 9, { texts: { format: "vertical" } }), "card")), [132, 408, 816, 816]);
  assert.deepEqual(box(keyed(await coulissesAt(150, 9 / 16, { texts: { format: "horizontal" } }), "card")), [132, 586, 816, 459]);
  for (const tree of [wide, tall]) {
    const label = drawnNodes(tree).find((n) => n.type === "FitText" && String(n.props.key).startsWith("n"))!;
    const [left, top, width, height] = box(label) as number[];
    assert.ok(top! + height! <= 0.75 * 1920 && left! >= 140 && left! + width! <= 940, JSON.stringify(box(label)));
    // (Its title's capitals start 158 px above the card, as the original's.)
    const timeline = box(keyed(tree, "timeline")) as number[];
    assert.ok(Math.abs((Number(styleOf(keyed(tree, "card")).top) - 158 + timeline[1]! + timeline[3]!) / 2 - 960) <= 2, JSON.stringify(timeline));
  }
  // Its ground squared like a technical sheet, still: the original's blue, its fine violet lines, 32 squares across.
  assert.deepEqual([styleOf(wide).backgroundColor, styleOf(wide).backgroundSize], ["#15017A", "33.75px 33.75px"]);
  // Its timeline and the title of her video are decor (their type as tiny as the original's: Tristan's exception).
  assert.ok("data-fauve-decor" in keyed(wide, "timeline").props && "data-fauve-decor" in keyed(wide, "inner").props);
  // The setting: the filler sees it (the default first), the plan keeps a choice her words asked for.
  assert.deepEqual(coulisses.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(coulisses, [{ name: "format", value: "auto" }]), {});
  const files = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12, aspect: 9 / 16 }));
  const input = skillFillInput({ skill: coulisses, name: "Coulisses façon fiche", n: 28, files, business: {}, request: "dans une carte carrée" });
  assert.equal(input.reglages?.[0]?.nom, "format");
  assert.equal(input.cases.length, 28);
  assert.deepEqual(input.objets?.map((o) => [o.slot, o.case]), [["plat", 15], ["main", 22]]);
  const plan = skillPlan({ skill: coulisses, name: "Coulisses façon fiche", files, fill: { shots: Array.from({ length: 28 }, (_, i) => ({ file: files[i % 10]!.id, at: Math.floor(i / 10) * 4 })), texts: CF_WORDS, end: null, settings: { format: "vertical" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
  assert.deepEqual(plan.skill, { key: "coulisses", version: 3, settings: { format: "vertical" } });
});

test("« Coulisses façon fiche » (v2): her video's title in three times, two loadings tile by tile, its cut-outs before their cuts, its flashes and stutters", async () => {
  const { coulisses } = await import("./skills/coulisses.ts");
  const { skillCode } = await import("./skills.ts");
  const { objectsDrawn, drawsSubject, clearsDrawn, depthsDrawn, OBJECT_MAX } = await import("./subject.ts");
  const card = (tree: Drawn) => drawnNodes(drawnNodes(tree).find((n) => n.props.key === "card")!);
  const deep = async (frame: number) => drawnDeep(await coulissesAt(frame));
  // Its small words fall onto their place on the whoosh (one image 29 % of the card higher), her name flickers on as
  // its original's (lit on 9, 11, 12, 14, then from 16), its three pieces pop at half their size, then at their size.
  const row = (nodes: Drawn[]) => nodes.find((n) => n.type === "div" && styleOf(n).justifyContent === "space-between" && styleOf(n).fontSize === 15);
  assert.equal(row(await deep(3)), undefined);
  assert.deepEqual([styleOf(row(await deep(4))!).opacity, styleOf(row(await deep(4))!).transform, styleOf(row(await deep(5))!).transform], [1, "translateY(-133px)", "none"]);
  const name = async (f: number) => styleOf((await deep(f)).find((n) => n.type === "div" && drawnText(n) === "ATELIER ROSE")!).opacity;
  const lit = [];
  for (let f = 8; f <= 17; f++) lit.push(await name(f));
  assert.deepEqual(lit, [0, 1, 0, 1, 1, 0, 1, 0, 1, 1]);
  // (Its pieces in the block on the right of the card.)
  const right = (nodes: Drawn[]) => {
    const block = nodes.find((n) => n.props.key === "ir");
    return block ? drawnDeep(block) : [];
  };
  const piece = async (f: number, k: number) => {
    const node = right(await deep(f)).find((n) => n.props.key === `p${k}`);
    const s = node ? styleOf(node) : { opacity: 0 };
    return s.opacity === 0 ? "none" : s.transform === "scale(0.5)" ? "half" : "whole";
  };
  const pops = [];
  for (const [f, k] of [[17, 0], [18, 0], [19, 0], [22, 1], [23, 1], [24, 1], [25, 2], [26, 2], [27, 2], [28, 2]] as const) pops.push(await piece(f, k));
  assert.deepEqual(pops, ["none", "half", "whole", "none", "half", "whole", "none", "half", "half", "whole"]);
  // Without a logo, her first small words then her last one; with hers (never the original's camera), her words then it.
  const pieces = (nodes: Drawn[]) => [0, 1].map((k) => drawnNodes(right(nodes).find((n) => n.props.key === `p${k}`)).map((n) => (n.type === "Img" ? "logo" : drawnText(n))).join(""));
  assert.deepEqual(pieces(await deep(40)), ["FLEURISTE", "À"]);
  (globalThis as { Img?: unknown }).Img = "Img";
  try {
    const logo = drawnDeep(await coulissesAt(40, 16 / 9, { brand: { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight", logoUrl: "/logo.png" } }));
    assert.deepEqual(pieces(logo), ["FLEURISTE À", "logo"]);
  } finally {
    delete (globalThis as { Img?: unknown }).Img;
  }
  // Nothing of the original's own words nor its camera's brand.
  assert.ok(!/BREAKDOWN|SOUND|EFFECTS|DJI|OSMO|VANCOUVER|HOURS/.test(coulisses.code) && !/\bdji\b/i.test(coulisses.code));
  // The next shot loading tile by tile, in place: the 5 × 3 tiles of the card, one jumping in reading order across its
  // 3rd and 4th shots (its image 45 the first tile, 75 the thirteenth), three blocks, then its 5th shot whole at 100; the
  // second time over its 16th shot, from the top row's right end (161), 11 tiles at once on 185, its 17th whole on 188.
  const loading = async (f: number) => {
    const d = card(await coulissesAt(f)).find((n) => String(n.props.key).startsWith("load"));
    return d ? { tiles: (String(styleOf(d).clipPath).match(/M/g) ?? []).length, shot: drawnNodes(d).find((n) => n.type === "Footage")!.props.shot, path: String(styleOf(d).clipPath) } : null;
  };
  assert.deepEqual(await loading(45), { tiles: 1, shot: 4, path: "path('M0.0 0.0h163.2v153.0h-163.2Z')" });
  assert.equal((await loading(75))!.path, "path('M326.4 306.0h163.2v153.0h-163.2Z')");
  assert.deepEqual([(await loading(93))!.tiles, (await loading(95))!.tiles, (await loading(99))!.tiles, await loading(100)], [3, 6, 5, null]);
  assert.deepEqual(await loading(161), { tiles: 1, shot: 16, path: "path('M652.8 0.0h163.2v153.0h-163.2Z')" });
  assert.deepEqual([(await loading(185))!.tiles, await loading(188)], [11, null]);
  // What the next shot shows, cut out, laid in the card exactly where it will be, its five images before the cut (its
  // 15th shot's dish, its 22nd's hand and what it holds), named by the filler; her own subject never cut out.
  const cutOut = async (f: number) => card(await coulissesAt(f)).filter((n) => n.type === "Subject").map((n) => [n.props.shot, n.props.object]);
  assert.deepEqual([await cutOut(142), await cutOut(143), await cutOut(147), await cutOut(148)], [[], [[14, "@plat"]], [[14, "@plat"]], []]);
  assert.deepEqual([await cutOut(233), await cutOut(234), await cutOut(238), await cutOut(239)], [[], [[21, "@main"]], [[21, "@main"]], []]);
  assert.deepEqual(objectsDrawn(coulisses.code), []);
  const named = objectsDrawn(skillCode(coulisses, { plat: "plate of pastries", main: "hand holding a box" }));
  assert.deepEqual(named, [{ shot: 14, name: "plate of pastries" }, { shot: 21, name: "hand holding a box" }]);
  assert.ok(named.length <= OBJECT_MAX && !drawsSubject(coulisses.code));
  assert.deepEqual([clearsDrawn(coulisses.code), depthsDrawn(coulisses.code)], [[], []]);
  // Three flashes in the card, over its title too: two white images on the cut into its 18th shot, an image 80 % white
  // on the first of its 19th and its 20th.
  const flash = async (f: number) => {
    const nodes = card(await coulissesAt(f));
    const white = nodes.find((n) => n.props.key === "flash");
    return white ? [styleOf(white).opacity, nodes.indexOf(white) > nodes.findIndex((n) => n.props.key === "inner")] : null;
  };
  assert.deepEqual([await flash(195), await flash(196), await flash(197), await flash(198), await flash(205), await flash(214)], [null, [1, true], [1, true], null, [0.8, true], [0.8, true]]);
  // The cuts that stutter, an image each between the two shots, as its original's (B B A B A B, then twice B A B A A B).
  const shown = async (f: number) => card(await coulissesAt(f)).find((n) => n.type === "Footage" && String(n.props.key).startsWith("s"))!.props.shot;
  for (const [from, b, pattern] of [[246, 22, "BBABABB"], [273, 25, "BABAABB"], [293, 27, "BABAABB"]] as const) {
    let got = "";
    for (let k = 0; k < 7; k++) got += (await shown(from + k)) === b ? "B" : "A";
    assert.equal(got, pattern, `the stutter from image ${from}`);
  }
  // Its label: the name of the sound heard, none before it starts, none in its silences, the last one kept.
  const label = async (f: number) => (await deep(f)).find((n) => n.type === "FitText" && String(n.props.key).startsWith("n"))?.children.join("") ?? null;
  assert.deepEqual([await label(0), await label(1), await label(20), await label(60), await label(154), await label(200), await label(256), await label(314)], [null, "WHOOSH", "CLIC x 3", "CHARGEMENT", null, "DÉCLENCHEUR x 3", null, "DÉCLICS"]);
  // Its playhead from the first image to the last, at a constant speed across the timeline's tracks.
  const head = async (f: number) => Number(styleOf(drawnNodes(drawnNodes(await coulissesAt(f)).find((n) => n.props.key === "timeline")!).find((n) => styleOf(n).background === "#ff3131")!).left);
  assert.deepEqual([await head(0), await head(157), await head(314)], [116, 461, 806]);
});

// ——— « Recette cosy, typo pixel » v2, written again on its original's fiche (docs/fiches/pixel.md) ———————————————————

/** Its texts as its composition gets them on its original's 26 shots (frames), and what it draws at a frame. */
const PIXEL_TEXTS = [
  { text: "fraisier menthe!!", role: "hook", from: 5, to: 104, emphasis: [] },
  { text: "fait maison, pour le goûter", role: "caption", from: 5, to: 104, emphasis: [] },
  { text: "les œufs / farine tamisée, sucre et beurre / ça prend forme !", role: "band", from: 104, to: 424, emphasis: [] },
  { text: "bonne dégustation", role: "caption", from: 424, to: 466, emphasis: [] },
];
async function pixelAt(frame: number, aspect = 9 / 16, extra: Record<string, unknown> = {}): Promise<Drawn> {
  const { pixel } = await import("./skills/pixel.ts");
  const line = pixel.timeline(26, { end: false });
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const texts = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  return drawScene(SEEDED + pixel.code, frame, { width: 1080, height: 1920, durationInFrames: 466, brand: { name: "Pâtisserie Lou", displayFont: "Pixelify Sans", bodyFont: "Space Mono" }, shots, reelTexts: PIXEL_TEXTS, end: null, texts, ...extra });
}
/** Every word under a node in the page's order, spaces left out (its letters are each in their own span). */
const pixelWords = (node: unknown) => drawnNodes(node).map(drawnText).join("").replace(/\s+/g, "");
/** A text's box (FitText) by the colour of its type, and each of its letters' pose (null: straight). */
const pixelBoxes = (tree: Drawn, color: string) => drawnNodes(tree).filter((n) => n.type === "FitText" && (n.props.innerStyle as Record<string, unknown> | undefined)?.color === color);
const pixelPoses = (node: Drawn) =>
  drawnNodes(node)
    .filter((n) => n.type === "span" && styleOf(n).display === "inline-block" && n.children.length === 1 && typeof n.children[0] === "string")
    .map((n) => (styleOf(n).transform as string | undefined) ?? null);

test("« Recette cosy, typo pixel » (v2) cuts where its original does, gesture by gesture, on its own music (100 BPM)", async () => {
  const { pixel, pixelSections, pixelRest } = await import("./skills/pixel.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(pixel.version, 2);
  assert.equal(pixel.bpm, 100);
  const line = pixel.timeline(26, { end: false });
  // The original's 26 pieces (images at 30 i/s, docs/fiches/pixel.md: 15 of its 25 cuts in the same frame, a gesture
  // each), within two images each, on its own music's tempo.
  const original = [0, 16, 40, 53, 70, 86, 104, 113, 127, 150, 175, 186, 202, 216, 230, 245, 257, 272, 284, 296, 323, 338, 351, 365, 386, 424];
  assert.equal(line.shots.length, original.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - original[i]!) <= 2, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${original[i]}`));
  assert.ok(Math.abs(line.duration - 15.53) < 0.05, `${line.duration} s`);
  // Its title and its tiny lines from its image 5 (before the first note) to the cut on its first step (image 104), its
  // captions on its steps, its closing word on its loop; its sections given to its code.
  assert.deepEqual([line.texts.titre!.from, line.texts.titre!.to].map((t) => Math.round(t * 30)), [5, 104]);
  assert.deepEqual(line.texts.petit_mot, line.texts.titre);
  assert.deepEqual([line.texts.etapes!.from, line.texts.etapes!.to].map((t) => Math.round(t * 30)), [104, 424]);
  assert.deepEqual([line.texts.fin!.from, line.texts.fin!.to].map((t) => Math.round(t * 30)), [424, 466]);
  assert.deepEqual(line.marks, { cut: 104, fill: 150, hand: 245, cook: 272, near: 365, loop: 424, boil: 5 });
  // Its piano rests a beat in its first step and comes back on the downbeat at 4,8 s (the original's 4,25 – 4,75 s),
  // without its bass until the cooking (9 s: its bass comes in at 8,98 s), stopped dead with the last image as it loops;
  // no sound effect: its knife and its boiling water are its videos' own.
  assert.deepEqual(line.music, { pauses: [{ from: 4.2, to: 4.8 }], filters: [{ kind: "thin", from: 0, to: 9 }], end: { at: line.duration } });
  assert.equal(line.sounds, undefined);
  // Its gestures: the next ones of a step want the same video, the loop the first one's video just before it.
  assert.match(line.shots[1]!.want, /^la même vidéo que la case précédente/);
  assert.match(line.shots.at(-1)!.want, /^la même vidéo que la case 1, juste avant elle/);
  assert.ok(line.shots.filter((s) => /^la même vidéo que la case précédente/.test(s.want)).length === 15);
  // Fewer shots: its gestures go first, every place keeps one, its steps with words enough of theirs to be read.
  assert.deepEqual(pixel.shots, [15, 26]);
  for (let n = 15; n <= 26; n++) {
    const sections = pixelSections(n);
    assert.equal(sections.flat().length, n);
    assert.equal(sections.length, 11);
    assert.ok(sections.every((g) => g.length >= 1));
    const fewer = pixel.timeline(n, { end: false });
    assert.equal(fewer.shots.length, n);
    assert.ok(fewer.texts.titre!.to - fewer.texts.titre!.from >= 1.6, `${n} shots: its title`);
    assert.ok((fewer.marks.hand! - fewer.marks.fill!) / 30 >= 1.7, `${n} shots: its list`);
    const rest = fewer.music!.pauses![0]!;
    assert.ok(rest.from >= fewer.marks.cut! / 30 - 1e-6 && rest.to <= fewer.marks.fill! / 30 + 1e-6, `${n} shots: ${JSON.stringify(rest)}`);
  }
  assert.ok(pixel.timeline(15, { end: false }).duration < pixel.timeline(20, { end: false }).duration);
  // Its rest comes back on the latest downbeat of its first step, else its latest beat, none in a step under a beat.
  assert.equal(pixelRest(5.78, 8.33), 8);
  assert.equal(pixelRest(5.06, 7.11), 7);
  assert.equal(pixelRest(5.2, 5.9), null);
  // With an ending card (an option: the original loops), its loop held whole beats longer, the same cuts, the mix's fade.
  const ended = pixel.timeline(26, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs(((ended.duration - line.duration) * 100) / 60 - 3) < 0.05, `${ended.duration} s`);
  assert.equal(ended.music!.end, undefined);
  assert.ok(Math.abs(ended.texts.fin!.to - (ended.duration - 1.6)) < 0.01);
  // At another tempo, all of it follows its beats.
  const slower = pixel.timeline(26, { end: false, bpm: 80 });
  assert.ok(Math.abs(slower.duration / line.duration - 100 / 80) < 0.01);
  assert.ok(Math.abs(slower.marks.cook! / line.marks.cook! - 100 / 80) < 0.01);
  // On the plan: its tempo and its music's shape, no sound of its own.
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 20 }));
  const words = { titre: "fraisier menthe!!", petit_mot: "fait maison, pour le goûter", etapes: "les œufs / farine, sucre et beurre / ça prend forme", fin: "bonne dégustation" };
  const plan = skillPlan({ skill: pixel, name: "Recette cosy, typo pixel", files, fill: { shots: Array.from({ length: 26 }, (_, i) => ({ file: files[i % 12]!.id, at: Math.floor(i / 12) * 6 })), texts: words, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.tempo, 100);
  assert.deepEqual(plan.music_shape, { pauses: [{ from: 4.2, to: 4.8 }], filters: [{ kind: "thin", from: 0, to: 9, open: 0.02 }], end: { at: plan.duration, fade: 0.012 } });
  assert.equal(plan.sounds, undefined);
});

test("« Recette cosy, typo pixel » (v2): its title in pixels at once on image 5, every letter trembling every 5 images, its tiny lines, her name", async () => {
  const { pixel } = await import("./skills/pixel.ts");
  const { clearsDrawn, drawsSubject, objectsDrawn } = await import("./subject.ts");
  // Nothing on its first 5 images: the finished result alone; then its title at once, nothing typed nor lit.
  assert.equal(pixelBoxes(await pixelAt(4), "#d4f7e9").length, 0);
  const title = pixelBoxes(await pixelAt(5), "#d4f7e9")[0]!;
  assert.equal(pixelWords(title), "fraisiermenthe!!");
  // Pale mint, its thin dark grey-green edge all round, no shadow; 89 px on two lines balanced by their letters, centred
  // at the original's 34 % (ClearBox's fallback here: no clear area read), its face before it and its star after it.
  const inner = title.props.innerStyle as Record<string, string | number>;
  assert.equal(inner.fontSize, 89);
  assert.match(String(inner.textShadow), /^2px 0px 0 #2c4741, -2px 0px 0 #2c4741/);
  assert.doesNotMatch(String(inner.textShadow), /\d+px \d+px [1-9]/);
  const lines = drawnNodes(title).filter((n) => n.type === "div" && styleOf(n).whiteSpace === "nowrap");
  assert.deepEqual(lines.map(pixelWords), ["fraisier", "menthe!!"]);
  assert.ok(lines.every((l) => drawnNodes(l).some((n) => "data-fauve-decor" in n.props && drawnNodes(n).some((d) => d.type === "svg"))));
  const box = styleOf(title);
  assert.ok(Math.abs(Number(box.left) + Number(box.width) / 2 - 540) <= 1 && Math.abs(Number(box.top) + Number(box.height) / 2 - 0.343 * 1920) <= 2, JSON.stringify(box));
  // Its first pose straight (images 5 to 9); then every 5 images each letter its own small tilt (2 to 10°) and a shift
  // of a pixel or two, held until the next.
  const poses = async (f: number) => pixelPoses(pixelBoxes(await pixelAt(f), "#d4f7e9")[0]!);
  assert.equal((await poses(5)).length, 16);
  assert.ok((await poses(5)).every((t) => t === null) && (await poses(9)).every((t) => t === null));
  const first = await poses(10);
  assert.deepEqual(await poses(14), first);
  assert.notDeepEqual(await poses(15), first);
  for (const t of first) {
    const m = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) rotate\((-?[\d.]+)deg\)$/.exec(String(t));
    assert.ok(m && Math.abs(Number(m[3])) >= 2 && Math.abs(Number(m[3])) <= 10 && Math.abs(Number(m[1])) <= 2 && Math.abs(Number(m[2])) <= 2, String(t));
  }
  assert.ok(new Set(first).size === first.length);
  // Its two tiny typewriter lines cut at their comma, the first on the left at mid-height, the second low on the right
  // above the apps' caption (the original's 75 %, lifted), its comma kept in the page; her name very small at the top
  // (never the original's own account), all trembling.
  const tree = await pixelAt(60);
  const tiny = pixelBoxes(tree, "#fff8e8");
  assert.deepEqual(tiny.map(pixelWords), ["pâtisserielou", "faitmaison", "pourlegoûter"]);
  assert.ok(pixelWords(tree).includes("faitmaison,pourlegoûter"));
  const [name, left, right] = tiny.map(styleOf);
  assert.ok(Number(name!.top) < 0.14 * 1920 && Math.abs(Number(name!.left) + Number(name!.width) / 2 - 540) <= 1);
  assert.equal(Number(left!.left), Math.round(0.136 * 1080));
  assert.ok(Number(right!.left) + Number(right!.width) <= 940 && Number(right!.top) + Number(right!.height) <= 0.75 * 1920, JSON.stringify(right));
  assert.ok(tiny.every((n) => (n.props.innerStyle as Record<string, number>).fontSize! >= 20 && pixelPoses(n).some((t) => t !== null)));
  assert.doesNotMatch(pixel.code + JSON.stringify(pixel.texts), /kometoneko|chayote|comfort food|cold days|smells so good|enjoy cooking/i);
  // Gone with the cut on its first step.
  assert.equal(pixelBoxes(await pixelAt(104), "#d4f7e9").length, 0);
  // Set on the calmest part of the upper third of her result, read there only; nothing cut out nor followed, no zoom.
  assert.deepEqual(clearsDrawn(pixel.code), [0]);
  assert.equal(drawsSubject(pixel.code), false);
  assert.deepEqual(objectsDrawn(pixel.code), []);
  assert.doesNotMatch(pixel.code, /scale\(|\bSubject\b|Whip|ZoomThrough/);
});

test("« Recette cosy, typo pixel » (v2): its captions on their steps, its little faces and its stars, its loop, its format, its finish", async () => {
  const { pixel } = await import("./skills/pixel.ts");
  const { skillFillInput, skillPlan, skillSettings } = await import("./skills.ts");
  /** The captions seen at a frame: the words of each one shown, in the page's order. */
  const seen = async (f: number) => {
    const tree = await pixelAt(f);
    return { tree, words: drawnNodes(tree).filter((n) => n.type === "div" && styleOf(n).opacity === 1).map(pixelWords) };
  };
  // Each on its step, from its first cut to its last: its first one upper left, its second on two centred lines under
  // what is prepared (above the apps' caption), its third once nearly ready; every one in the page all along.
  const eggs = await seen(110);
  assert.deepEqual(eggs.words, ["lesœufs"]);
  assert.ok(pixelWords(eggs.tree).includes("lesœufs/farinetamisée,sucreetbeurre/çaprendforme!"));
  const list = await seen(160);
  assert.deepEqual(list.words, ["farinetamisée,sucreetbeurre"]);
  const listLines = pixelBoxes(list.tree, "#ffffff").filter((n) => ["farinetamisée,", "sucreetbeurre"].includes(pixelWords(n)));
  assert.equal(listLines.length, 2);
  for (const n of listLines) assert.ok(Math.abs(Number(styleOf(n).left) + Number(styleOf(n).width) / 2 - 540) <= 1 && Number(styleOf(n).top) + Number(styleOf(n).height) <= 0.75 * 1920);
  assert.deepEqual((await seen(370)).words, ["çaprendforme!"]);
  // A gesture by hand: no words, its shy little face alone at the middle, trembling; the cooking: two pairs of stars in
  // opposite corners, from its first place to its last, never blinking.
  const hand = await seen(250);
  assert.deepEqual(hand.words, []);
  const decor = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "div" && "data-fauve-decor" in n.props);
  const face = decor(hand.tree);
  assert.equal(face.length, 1);
  assert.ok(Math.abs(Number(styleOf(face[0]!).left) - 0.454 * 1080) <= 1 && Math.abs(Number(styleOf(face[0]!).top) - 0.492 * 1920) <= 1);
  assert.equal(decor((await seen(244)).tree).length, 0);
  const cooking = decor((await seen(300)).tree);
  assert.equal(cooking.length, 2);
  assert.ok(Number(styleOf(cooking[0]!).top) < 0.25 * 1920 && Number(styleOf(cooking[1]!).top) > 0.7 * 1920 && Number(styleOf(cooking[1]!).left) > 0.75 * 1080);
  assert.equal(decor((await seen(365)).tree).length, 0);
  // Its loop: its closing word upper left, no card, no black.
  const loop = await seen(440);
  assert.ok(pixelBoxes(loop.tree, "#ffffff").some((n) => pixelWords(n) === "bonnedégustation"));
  assert.equal(drawnNodes(loop.tree).filter((n) => /rgba\(20,12,6/.test(String(styleOf(n).background ?? ""))).length, 0);
  // More words than its three: a fourth in place of the little face, a fifth in place of the stars.
  const five = [{ ...PIXEL_TEXTS[2]!, text: "les œufs / farine et sucre / ça prend forme / on mélange / au frais" }, ...PIXEL_TEXTS.filter((t) => t.role !== "band")];
  assert.deepEqual((await (async () => drawnNodes(await pixelAt(250, 9 / 16, { reelTexts: five })).filter((n) => n.type === "div" && styleOf(n).opacity === 1).map(pixelWords))()), ["onmélange"]);
  assert.equal(drawnNodes(await pixelAt(300, 9 / 16, { reelTexts: five })).filter((n) => n.type === "div" && "data-fauve-decor" in n.props).length, 0);
  // An ending card (an option): the last image softly darkened, its title in the title's pixels, a typewriter line to read.
  const card = await pixelAt(480, 9 / 16, { durationInFrames: 520, end: { title: "commande pour samedi", subtitle: "au 06 12 34 56 78", from: 466 } });
  assert.ok(drawnNodes(card).some((n) => /rgba\(20,12,6,0\.5/.test(String(styleOf(n).background ?? ""))));
  assert.deepEqual(pixelBoxes(card, "#d4f7e9").map(pixelWords), ["commandepoursamedi"]);
  assert.equal((pixelBoxes(card, "#fff8e8").find((n) => pixelWords(n) === "au0612345678")!.props.innerStyle as Record<string, number>).fontSize, 48);
  // Its format: as her videos, the whole vertical frame as the original, 16:9 on black when most are in width; her word prevails.
  const frameBox = async (aspect: number, format?: string) => {
    const line = pixel.timeline(26, { end: false });
    const texts = { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...(format ? { format } : {}) };
    return styleOf((await pixelAt(60, aspect, { texts })).children[0] as Drawn);
  };
  assert.deepEqual([(await frameBox(9 / 16)).top, (await frameBox(9 / 16)).height], [0, 1920]);
  assert.deepEqual([(await frameBox(16 / 9)).top, (await frameBox(16 / 9)).height], [656, 608]);
  assert.equal((await frameBox(16 / 9, "vertical")).height, 1920);
  assert.equal((await frameBox(9 / 16, "horizontal")).height, 608);
  // In its 16:9 frame its title at 59 px (it reads), its tiny lines at 26 px and her name at 20, all inside it.
  const wide = await pixelAt(60, 16 / 9);
  assert.equal((pixelBoxes(wide, "#d4f7e9")[0]!.props.innerStyle as Record<string, number>).fontSize, 59);
  assert.deepEqual(pixelBoxes(wide, "#fff8e8").map((n) => (n.props.innerStyle as Record<string, number>).fontSize), [20, 26, 26]);
  assert.ok(pixelBoxes(wide, "#fff8e8").every((n) => Number(styleOf(n).top) + Number(styleOf(n).height) <= 608));
  // The setting: the filler sees it (the default first: as her videos), the plan keeps a choice her words asked for.
  assert.deepEqual(pixel.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(pixel, [{ name: "format", value: "auto" }]), {});
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 16 }));
  assert.equal(skillFillInput({ skill: pixel, name: "Recette cosy", n: 26, files, business: {}, request: "en horizontal" }).reglages?.[0]?.nom, "format");
  const plan = skillPlan({ skill: pixel, name: "Recette cosy", files, fill: { shots: Array.from({ length: 26 }, (_, i) => ({ file: files[i % 8]!.id, at: Math.floor(i / 8) * 4 })), texts: { titre: "fraisier menthe!!", petit_mot: "fait maison, pour le goûter", etapes: "les œufs / farine et sucre / ça sent bon", fin: "à demain" }, end: null, settings: { format: "horizontal" } } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "horizontal");
  assert.deepEqual(plan.skill, { key: "pixel", version: 2, settings: { format: "horizontal" } });
  assert.deepEqual(plan.layers![0]!.motion.fonts, ["Courier Prime", "Inter"]);
  // Its finish: no grain, no dark corners, no lifted blacks (the catalogue's « Cosy » laid them over everything).
  assert.deepEqual(pixel.finish, { contrast: 0.08, grain: 0, vignette: 0, fade: 0 });
});

// ——— « Titre gaufré » v2, written again on its original's fiche (docs/fiches/gaufre.md) ——————————————————————————

/** Where its original's pieces land (images at 30 i/s): one on each of its three chords, thirteen in its burst, the street on its reprise and the two largest on its next beats. */
const GAUFRE_PIECES = [1, 25, 53, 80, 85, 90, 94, 97, 100, 104, 109, 114, 118, 124, 128, 132, 158, 175, 190];
/** What its four objects are on the passage under its paper, as the engine reads them (px of the vertical frame): her sign, her two windows, three bags in her window, a bicycle. */
const GAUFRE_READ = {
  boxes: { "1#shop sign": { x: 200, y: 400, w: 580, h: 150 } },
  parts: {
    "1#every window": [{ x: 120, y: 0, w: 260, h: 210 }, { x: 700, y: 0, w: 260, h: 210 }],
    "1#every tote bag": [{ x: 60, y: 600, w: 90, h: 170 }, { x: 300, y: 600, w: 90, h: 170 }, { x: 600, y: 600, w: 90, h: 170 }],
    "1#every bicycle": [{ x: 860, y: 1000, w: 220, h: 400 }],
  },
};
const GAUFRE_NAMED = { nom: "shop sign", fenetres: "every window", vitrine: "every tote bag", devant: "every bicycle" };

test("« Titre gaufré » (v2) lands its front's pieces and cuts to its paper where its original does, on its own music (113,2 BPM)", async () => {
  const { gaufre } = await import("./skills/gaufre.ts");
  const { skillPlan, skillCode } = await import("./skills.ts");
  const { objectsDrawn, objectPassages, drawsSubject, clearsDrawn } = await import("./subject.ts");
  assert.equal(gaufre.version, 2);
  assert.equal(gaufre.bpm, 113.2);
  // Her one video of her front (its original has one), and the same video under the paper, where its things are read.
  assert.deepEqual([gaufre.shots, gaufre.files], [[2, 2], [1, 1]]);
  const line = gaufre.timeline(2, { end: false });
  assert.equal(line.shots.length, 2);
  assert.ok(Math.abs(line.shots[1]!.start * 30 - 270) <= 2, `the paper at ${line.shots[1]!.start} s, the original's 9,00 s`);
  assert.ok(Math.abs(line.duration * 30 - 382) <= 2, `${line.duration} s`);
  assert.equal(line.marks.paper, Math.round(line.shots[1]!.start * 30));
  // Each of its 19 pieces within two images of the original's.
  GAUFRE_PIECES.forEach((f, i) => assert.ok(Math.abs(line.marks[`piece_${i}`]! - f) <= 2, `piece ${i + 1}: image ${line.marks[`piece_${i}`]}, the original's ${f}`));
  // Its reprise, the two largest pieces after it and its paper on whole beats of its music, its end too (10, 11, 12, 17, 24).
  const beat = (60 / 113.2) * 30;
  for (const [k, b] of [["piece_16", 10], ["piece_17", 11], ["piece_18", 12], ["paper", 17]] as const) assert.ok(Math.abs(line.marks[k]! - b * beat) <= 1.5, `${k}: image ${line.marks[k]}, beat ${b}`);
  assert.ok(Math.abs(line.duration * 30 - 24 * beat) <= 1);
  // Its ink as the original's: the first letter already in it at the cut and done at 323, the second from 317, the last
  // from 355, a dot from 359, all of it by 374; its line from 325 to 378.
  assert.ok(line.marks.ink! < line.marks.paper!);
  for (const [k, f] of [["first", 323], ["second", 317], ["last", 355], ["dots", 359], ["inked", 374], ["line_from", 325], ["line_to", 378]] as const)
    assert.ok(Math.abs(line.marks[k]! - f) <= 2, `${k}: image ${line.marks[k]}, the original's ${f}`);
  assert.ok(line.marks.dry! >= 45 && line.marks.dry! <= 90, `dry ${line.marks.dry}`);
  // Her name and her line pressed in the paper from its first image to the end.
  assert.deepEqual(line.texts, { titre: { from: line.shots[1]!.start, to: line.duration }, ligne: { from: line.shots[1]!.start, to: line.duration } });
  // Its music thin (without its bass) to its reprise, stopped before it while nothing lands, whole again on it, cut dead as
  // its groove ends (the original's 11,95 s); no sound of its own.
  const s = 60 / 113.2;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  assert.deepEqual(line.music, { filters: [{ kind: "thin", from: 0, to: r3(10 * s) }], pauses: [{ from: r3(8.5 * s), to: r3(10 * s) }], end: { at: r3(22.5 * s) } });
  assert.ok(line.marks.piece_15! < line.music!.pauses![0]!.from * 30 && line.marks.piece_16! <= line.music!.pauses![0]!.to * 30);
  assert.ok(Math.abs(line.music!.end!.at - 11.95) <= 2 / 30);
  assert.equal(line.sounds, undefined);
  // At another tempo, all of it follows its beats.
  const slower = gaufre.timeline(2, { end: false, bpm: 90 });
  assert.ok(Math.abs(slower.marks.paper! / line.marks.paper! - 113.2 / 90) < 0.01 && Math.abs(slower.marks.piece_9! / line.marks.piece_9! - 113.2 / 90) < 0.02);
  // With an ending card (an option: its original has none), the inked card held whole beats longer for its 1,6 s, its
  // music playing on to the mix's own fade.
  const ended = gaufre.timeline(2, { end: true });
  assert.deepEqual(ended.shots[0], line.shots[0]);
  const more = (ended.duration - line.duration) / s;
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs(more - Math.round(more)) < 0.05, `${ended.duration} s`);
  assert.equal(ended.music!.end, undefined);
  assert.ok(Math.abs(ended.texts.titre!.to - (ended.duration - 1.6)) < 0.01);
  // Its objects: what her front is made of, named by the filler and looked for on the passage under the paper; nobody
  // cut out, no clear area read, no zoom nor move; no grain nor dark corners.
  assert.deepEqual(objectsDrawn(gaufre.code), []);
  const named = skillCode(gaufre, GAUFRE_NAMED);
  assert.deepEqual(objectsDrawn(named), Object.values(GAUFRE_NAMED).map((name) => ({ shot: 1, name })));
  assert.equal(drawsSubject(named), false);
  assert.deepEqual(clearsDrawn(gaufre.code), []);
  assert.doesNotMatch(gaufre.code, /scale\(|translate|rotate\(|ellipse/);
  assert.deepEqual(gaufre.finish, { grain: 0, vignette: 0 });
  // On the plan: valid, its two shots on her one video, its music's shape kept, its four objects within the engine's
  // budget (the passage under the paper is short); with an ending card, the fourth is left out.
  const files = [{ id: "v", photo: false, seconds: 15 }];
  const fill = { shots: [{ file: "v", at: 1 }, { file: "v", at: 1 }], texts: { titre: "Brick Lane", ligne: "librairie · spitalfields" }, end: null, objects: GAUFRE_NAMED };
  const plan = skillPlan({ skill: gaufre, name: "Titre gaufré", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.segments.map((x) => (x as ClipSegment).clip_id), ["v", "v"]);
  assert.deepEqual(plan.music_shape, { pauses: [{ from: r3(8.5 * s), to: r3(10 * s) }], filters: [{ kind: "thin", from: 0, to: r3(10 * s), open: 0.02 }], end: { at: r3(22.5 * s), fade: 0.012 } });
  assert.deepEqual(objectPassages(plan, () => true).map((p) => [p.from, p.name]), Object.values(GAUFRE_NAMED).map((name) => [(plan.segments[1] as ClipSegment).in, name]));
  const withCard = skillPlan({ skill: gaufre, name: "Titre gaufré", files, fill: { ...fill, end: { title: "Ouvert dimanche" } } });
  assert.equal(objectPassages(withCard, () => true).length, 3);
});

test("« Titre gaufré » (v2): her front built on the black from what it is made of, her name first, as her video is; its paper, her name pressed then inked", async () => {
  const { gaufre } = await import("./skills/gaufre.ts");
  const { skillCode } = await import("./skills.ts");
  const line = gaufre.timeline(2, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const shotsOf = (aspect: number, srcs = ["/v0.mp4", "/v0.mp4"]) => line.shots.map((x, i) => ({ src: srcs[i], aspect, from: Math.round(x.start * 30), durationInFrames: Math.round((x.end - x.start) * 30), kind: "video", segment: i }));
  const reelTexts = [
    { text: "Still", role: "hook", from: 270, to: 382 },
    { text: "in the moment", role: "caption", from: 270, to: 382 },
  ];
  const named = skillCode(gaufre, GAUFRE_NAMED);
  const draw = (frame: number, extra: Record<string, unknown> = {}, read: Parameters<typeof drawCutOuts>[3] = GAUFRE_READ) =>
    drawCutOuts(named, frame, { width: 1080, height: 1920, durationInFrames: 382, brand: { displayFont: "DM Serif Display", bodyFont: "Cormorant Garamond" }, shots: shotsOf(9 / 16), reelTexts, end: null, texts: marks, ...extra }, read);
  const frameBox = (tree: Drawn) => tree.children[0] as Drawn;
  const film = (tree: Drawn) => frameBox(tree).children[0] as Drawn | null;
  const rects = (tree: Drawn) => [...String(styleOf(film(tree)!).clipPath ?? "").matchAll(/M(-?\d+) (-?\d+)H(-?\d+)V(-?\d+)H/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])]);
  // Black on its first image; her sign alone on its second, whole and at its place; then a thing far from it, then the
  // highest, one more on each of the original's chords (images 25 and 53), each staying where it landed.
  assert.equal(styleOf(film(draw(0))!).clipPath, "inset(50%)");
  assert.deepEqual(rects(draw(1)), [[200, 400, 580, 150]]);
  assert.deepEqual(rects(draw(24)), rects(draw(1)));
  assert.deepEqual(rects(draw(25)), [[200, 400, 580, 150], [860, 1000, 220, 400]]);
  assert.deepEqual(rects(draw(53))[2], [120, 0, 260, 210]);
  // Then its burst: the widest thing across it first, its bicycle, its windows and bags from right to left, then the
  // walls between its rows of things from the bottom up: sixteen by the original's image 132, none in its stop.
  assert.equal(rects(draw(131)).length, 15);
  assert.equal(rects(draw(132)).length, 16);
  assert.deepEqual(rects(draw(157)), rects(draw(132)));
  // The street on the reprise (all of it under its things), the top on its left, then the whole picture, no zoom nor move.
  const street = rects(draw(158))[16]!;
  assert.deepEqual([street[0], street[2], street[1]! + street[3]!], [0, 1080, 1920]);
  assert.deepEqual(rects(draw(175))[17]!.slice(0, 3), [0, 0, 366]);
  assert.equal(styleOf(film(draw(190))!).clipPath, undefined);
  const footage = drawnNodes(film(draw(120))!).find((n) => n.type === "Footage")!;
  assert.deepEqual([footage.props.shot, styleOf(footage).left, styleOf(footage).top, styleOf(footage).width, styleOf(footage).height], [0, 0, 0, 1080, 1920]);
  // Another video cast under the paper, or nothing found in it: its middle in sixteen regular pieces, the same times.
  const grid = rects(draw(132, {}, {}));
  assert.equal(grid.length, 16);
  assert.ok(grid.every(([x, y, w, h]) => x! >= 86 && x! + w! <= 995 && y! >= 288 && y! + h! <= 1384), JSON.stringify(grid));
  assert.deepEqual(rects(draw(132, { shots: shotsOf(9 / 16, ["/v0.mp4", "/v1.mp4"]) })), grid);
  // Its frame as her video: upright, the whole frame; in width, all of it in a 16:9 band in the middle of the black; her
  // setting prevails both ways. The paper always full frame.
  const boxAt = (aspect: number, format?: string) => styleOf(frameBox(draw(100, { shots: shotsOf(aspect), texts: { ...marks, ...(format ? { format } : {}) } })));
  assert.deepEqual([boxAt(9 / 16).top, boxAt(9 / 16).height], [0, 1920]);
  assert.deepEqual([boxAt(16 / 9).top, boxAt(16 / 9).width, boxAt(16 / 9).height], [656, 1080, 608]);
  assert.deepEqual([boxAt(9 / 16, "horizontal").top, boxAt(9 / 16, "horizontal").height], [656, 608]);
  assert.deepEqual([boxAt(16 / 9, "vertical").top, boxAt(16 / 9, "vertical").height], [0, 1920]);
  assert.deepEqual(gaufre.settings?.map((x) => [x.name, x.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  const banded = draw(270, { shots: shotsOf(16 / 9) });
  assert.deepEqual([styleOf(banded.children[1] as Drawn).top, styleOf(banded.children[1] as Drawn).height], [0, 1920]);
  // At the cut: no more of her video, the paper full frame in the original's peach, its fibres, no shade at its edges.
  const card = draw(270);
  assert.equal(film(card), null);
  assert.equal(styleOf(card.children[1] as Drawn).backgroundColor, "#f5cca4");
  // Her name the size of the original's (its five letters at most 800 px wide), centred half way down; its line under it
  // in capitals spread over its width; every letter pressed in its cavity from the paper's first image, and in ink over it.
  const fit = drawnNodes(card).find((n) => n.type === "FitText")!;
  assert.ok(styleOf(fit).left === 140 && styleOf(fit).width === 800 && Math.abs(Number(styleOf(fit).top) - 756) <= 2, JSON.stringify(styleOf(fit)));
  const letterSpans = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "span" && typeof n.children[0] === "string" && /\S/.test(n.children[0] as string));
  const pressed = letterSpans(card).filter((n) => /^url\(#\w+\)$/.test(String(styleOf(n).filter)));
  assert.equal(pressed.map((n) => n.children[0]).join(""), "StillINTHEMOMENT");
  assert.ok(drawnNodes(card).some((n) => n.type === "div" && styleOf(n).justifyContent === "space-between" && n.props["data-fauve-accent"] === ""));
  // Its ink: the first letter already in it at the cut, from its upper left; the next ones rising from their foot, 0,4 s
  // apart; the dot of the i last; all of it by the end, the line too; dark as it comes in, rust once dry.
  const inkedAt = (f: number) => letterSpans(draw(f)).filter((n) => /drop-shadow/.test(String(styleOf(n).filter)));
  const letter = (f: number, c: string) => inkedAt(f).find((n) => n.children[0] === c)!;
  const front = (n: Drawn) => Number(/rgba\([\d,]+,1\) (-?[\d.]+)%, rgba\([\d,]+,0\)/.exec(String(styleOf(n).backgroundImage))?.[1]);
  const colours = (n: Drawn) => [...String(styleOf(n).backgroundImage).matchAll(/rgba\((\d+),(\d+),(\d+),1\)/g)].map((m) => m.slice(1, 4).map(Number));
  assert.deepEqual(inkedAt(270).map((n) => n.children[0]), ["S"]);
  assert.match(String(styleOf(letter(300, "S")).backgroundImage), /^radial-gradient/);
  assert.deepEqual(inkedAt(316).map((n) => n.children[0]), ["S"]);
  assert.deepEqual(inkedAt(317).map((n) => n.children[0]), ["S", "t"]);
  assert.match(String(styleOf(letter(325, "t")).backgroundImage), /^linear-gradient\(to top/);
  assert.ok(front(letter(325, "t")) > 0 && front(letter(330, "t")) > front(letter(325, "t")));
  // The i's stem inked and its dot held until 359, then inked last with the second l.
  assert.equal(front(letter(352, "i")), front(letter(358, "i")));
  assert.ok(front(letter(358, "i")) < 70 && front(letter(366, "i")) > front(letter(358, "i")) && front(letter(374, "i")) >= 100);
  assert.equal(inkedAt(381).length, 5 + 11);
  assert.match(String(styleOf(letter(381, "N")).backgroundImage), /^linear-gradient\(to right/);
  assert.deepEqual(colours(letter(290, "S"))[1], [125, 33, 0]);
  assert.deepEqual(colours(letter(381, "S"))[0], [180, 60, 1]);
  // It lifts off the paper over 0,4 s: its soft shadow from nothing as its ink comes in.
  assert.match(String(styleOf(letter(317, "t")).filter), /rgba\(72,26,4,0\.000\)/);
  assert.match(String(styleOf(letter(330, "t")).filter), /rgba\(72,26,4,0\.500\)/);
  // Its ending card when she has one (an option): the same paper, its title pressed, then inked quickly.
  const ending = draw(440, { durationInFrames: 445, end: { title: "Ouvert dimanche", subtitle: "rue des Martyrs", from: 397 } });
  assert.equal(letterSpans(ending).filter((n) => /^url\(#\w+\)$/.test(String(styleOf(n).filter))).map((n) => n.children[0]).join(""), "OuvertdimancheRUEDESMARTYRS");
  assert.ok(letterSpans(ending).filter((n) => /drop-shadow/.test(String(styleOf(n).filter))).length >= 20);
});

// ---------------------------------------------------------------------------
// The tools of « Mot clé en grand », « Face caméra et références » and « Fenêtres et étiquettes »: a skill timed on her
// voice, her two takes synced on their sound, a font per word, her address as coordinates.
// ---------------------------------------------------------------------------

/** « Alors aujourd'hui (euh) je vais vous montrer trois soins pour l'hiver. … Le gommage, le masque, et l'huile. … Voilà, à bientôt. » (10 s). */
const talkFacts = {
  clip: "talk",
  seconds: 10,
  words: [
    word("Alors", 0.5, 0.8),
    word("aujourd'hui", 0.85, 1.3),
    word("je", 1.75, 1.85),
    word("vais", 1.88, 2.05),
    word("vous", 2.08, 2.25),
    word("montrer", 2.28, 2.65),
    word("trois", 2.7, 2.95),
    word("soins", 3.0, 3.4),
    word("pour", 3.45, 3.6),
    word("l'hiver.", 3.62, 4.1),
    word("Le", 5.2, 5.3),
    word("gommage,", 5.35, 5.9),
    word("le", 6.0, 6.1),
    word("masque,", 6.15, 6.7),
    word("et", 6.8, 6.9),
    word("l'huile.", 6.95, 7.5),
    word("Voilà,", 7.95, 8.3),
    word("à", 8.35, 8.45),
    word("bientôt.", 8.5, 9.0),
  ],
  speech: {
    source: "scribe" as const,
    cleaned: false,
    floor: -55,
    fillers: [word("euh", 1.35, 1.7)],
    pauses: [
      { start: 0, end: 0.48 },
      { start: 4.12, end: 5.18 },
      { start: 7.52, end: 7.93 },
      { start: 9.02, end: 10 },
    ],
  },
};

/** The filler's choice in it: her two first words, three ideas, a list of three names each in a font it evokes. */
const talkAnswer = {
  hook: { from: 0, to: 1, text: "Alors aujourd'hui" },
  ideas: [
    { from: 0, to: 9, key: 7, text: "soins", font: "", items: [] },
    {
      from: 10,
      to: 15,
      key: 11,
      text: "gommage",
      font: "",
      items: [
        { word: 11, text: "gommage", font: "Great Vibes" },
        { word: 13, text: "masque", font: "fraunces" },
        { word: 15, text: "l'huile", font: "Comic Sans" },
      ],
    },
    { from: 16, to: 18, key: 16, text: "Voilà", font: "", items: [] },
  ],
};

test("a skill timed on her voice: her talk cut as a creator cuts it, her words moved with it, 45 s at most", async () => {
  const { skillTalk, saidLines, TALK_MAX_SECONDS } = await import("./skills.ts");
  const { MAX_REEL_SECONDS } = await import("./editor.ts");
  assert.equal(TALK_MAX_SECONDS, MAX_REEL_SECONDS);
  const talk = skillTalk(talkFacts)!;
  // From just before her first word to just after her last; her « euh » and her two long pauses out, a breath kept.
  assert.deepEqual(
    talk.pieces.map((p) => [p.in, p.out]),
    [
      [0.15, 1.32],
      [1.73, 4.24],
      [5.06, 7.64],
      [7.81, 9.5],
    ],
  );
  // One after the other on the Reel's clock, her words with them.
  assert.deepEqual(talk.pieces.map((p) => p.start), [0, 1.17, 3.68, 6.26]);
  assert.equal(talk.duration, 7.95);
  assert.equal(talk.words.length, 19);
  assert.deepEqual(talk.words.find((w) => w.w === "soins"), { w: "soins", start: 2.44, end: 2.84 });
  assert.deepEqual(talk.words.find((w) => w.w === "Le"), { w: "Le", start: 3.82, end: 3.92 });
  assert.equal(talk.words.at(-1)!.end, 7.45);
  // Numbered, phrase by phrase, for the filler.
  assert.deepEqual(saidLines(talk.words).slice(0, 2), ["[0] Alors [1] aujourd'hui [2] je [3] vais [4] vous [5] montrer [6] trois [7] soins [8] pour [9] l'hiver.", "[10] Le [11] gommage, [12] le [13] masque, [14] et [15] l'huile."]);
  // Never past 45 s: cut after the last word that fits.
  const long = Array.from({ length: 160 }, (_, i) => word(`mot${i}`, 0.5 + i * 0.4, 0.8 + i * 0.4));
  const capped = skillTalk({ clip: "long", seconds: 70, words: long, speech: { source: "scribe", cleaned: false, floor: -60, fillers: [], pauses: [] } })!;
  assert.ok(capped.duration <= 45 && capped.duration > 44, `${capped.duration} s`);
  assert.ok(capped.words.every((w) => w.end <= capped.duration));
  // Fewer than three words: no talk.
  assert.equal(skillTalk({ ...talkFacts, words: talkFacts.words.slice(0, 2) }), null);
});

test("a skill timed on her voice: what the filler chose in what she says is read against her words", async () => {
  const { skillTalk, readSaid } = await import("./skills.ts");
  const talk = skillTalk(talkFacts)!;
  const voice = { hook: "ses deux premiers mots", key: "le mot de l'idée", ideas: [1, 3] as [number, number], items: "une liste", max: { hook: 20, key: 12, item: 10 }, fonts: ["item" as const] };
  const picks = readSaid(voice, talk, talkAnswer)!;
  assert.deepEqual(picks.hook, { from: 0, to: 1, text: "Alors aujourd'hui" });
  assert.deepEqual(picks.ideas.map((i) => [i.from, i.to, i.key, i.text]), [
    [0, 9, 7, "soins"],
    [10, 15, 11, "gommage"],
    [16, 18, 16, "Voilà"],
  ]);
  // Fonts only where the skill asks for them, and only of the library (« Comic Sans » is not one: her fonts).
  assert.deepEqual(picks.ideas[1]!.items, [
    { word: 11, text: "gommage", font: "Great Vibes" },
    { word: 13, text: "masque", font: "Fraunces" },
    { word: 15, text: "l'huile" },
  ]);
  assert.equal(picks.ideas[0]!.font, undefined);
  // Numbers out of her words brought back, ideas that overlap made to follow each other, a keyword outside its idea its first word.
  const loose = readSaid(voice, talk, {
    hook: { from: 4, to: 5, text: "vous montrer" },
    ideas: [
      { from: 12, to: 99, key: 3, text: "", font: "", items: [{ word: 2, text: "je", font: "" }] },
      { from: 0, to: 13, key: 7, text: "SOINS d'hiver pour toutes", font: "", items: [] },
    ],
  })!;
  assert.equal(loose.hook, null);
  // (Its keyword cut at the last word that fits its 12 characters.)
  assert.deepEqual(loose.ideas.map((i) => [i.from, i.to, i.key, i.text, i.items.length]), [
    [0, 13, 7, "SOINS", 0],
    [14, 18, 14, "et", 0],
  ]);
  // As many ideas as the skill takes at most; none at all: the editor makes the Reel.
  assert.equal(readSaid({ ...voice, ideas: [1, 2] }, talk, talkAnswer)!.ideas.length, 2);
  assert.equal(readSaid(voice, talk, { hook: null, ideas: [] }), null);
  assert.equal(readSaid(voice, talk, undefined), null);
});

/** A skill timed on her voice, as « Mot clé en grand » will be: her keywords big at their instant, the names of her lists each in its font. */
const voicedSkill = async () => {
  const { nominalSaid } = await import("./skills.ts");
  const skill: import("./skills.ts").MontageSkill = {
    key: "mot-cle",
    version: 1,
    bpm: 108,
    shots: [1, 12],
    files: [1, 2],
    how: "Elle face caméra ; ses premiers mots en grand dès la première image, puis le mot clé de chaque idée au moment où elle le dit.",
    texts: [],
    end: false,
    voice: { hook: "ses deux premiers mots", key: "le mot qui porte l'idée", ideas: [1, 4], items: "une liste qu'elle dit", max: { hook: 20, key: 14, item: 16 }, fonts: ["item"], row: 0.75 },
    timeline(n, options) {
      const said = options.said ?? nominalSaid(n, {});
      return {
        duration: said.duration,
        shots: said.shots.map((s) => ({ ...s, want: "elle, face caméra" })),
        texts: {},
        marks: { beat: (30 * 60) / 108 },
        // A low whoosh under each keyword as it slides in.
        sounds: said.ideas.map((i) => ({ at: i.at, sound: "low whoosh", seconds: 0.5 })),
      };
    },
    code: "function Scene({ spoken, reelTexts, texts }) { const h = React.createElement; return h(AbsoluteFill, null, reelTexts.map((t, i) => h('div', { key: i, style: { fontFamily: t.font || 'Inter' } }, t.text)), spoken.length); }",
  };
  return skill;
};

test("a skill timed on her voice: its shots on her talk, a new frame between two ideas, her words big at the instant she says them", async () => {
  const { skillTalk, readSkillFill, skillPlan, skillSaid, skillLengths } = await import("./skills.ts");
  const skill = await voicedSkill();
  const talk = skillTalk(talkFacts)!;
  const files = [{ id: "talk", photo: false, seconds: 10 }];
  const answer = { fits: true, missing: "", shots: [], texts: [], end: null, why: "", voice: talkAnswer };
  // Without her talk there is nothing to play.
  assert.equal(readSkillFill(skill, files, 4, answer), null);
  const fill = readSkillFill(skill, files, 4, answer, { talk })!;
  assert.deepEqual(fill.shots, []);
  const said = skillSaid(talk, fill.said!, skill.voice!);
  // Each idea where it is said; its pieces of talk, the second idea framed tighter (one take: a frame held, never a zoom).
  assert.deepEqual(said.ideas.map((i) => [i.from, i.at, i.to]), [
    [0.35, 2.44, 3.54],
    [3.82, 3.97, 6.12],
    [6.4, 6.4, 7.45],
  ]);
  assert.deepEqual(said.shots.map((s) => [s.start, s.end, s.idea, s.punch]), [
    [0, 1.17, 0, false],
    [1.17, 3.68, 0, false],
    [3.68, 6.26, 1, true],
    [6.26, 7.95, 2, false],
  ]);
  // Its hook from the first image until she says the word after it; each keyword from its word to its idea's end.
  assert.deepEqual(said.texts.accroche, { from: 0, to: 1.19 });
  assert.deepEqual(said.texts.idee1, { from: 2.44, to: 3.64 });
  assert.deepEqual(said.texts.idee2_2, { from: 4.77, to: 6.22 });
  assert.deepEqual(said.texts.idee3, { from: 6.4, to: 7.55 });
  // An idea that ends in the middle of a piece cuts it there (between its last word and the next idea's first).
  const joined = { ...talk, pieces: [{ in: 0.15, out: 9.5, start: 0, end: 9.35 }], words: talkFacts.words.map((w) => ({ ...w, start: w.start - 0.15, end: w.end - 0.15 })), duration: 9.35 };
  const split = skillSaid(joined, fill.said!, skill.voice!);
  assert.deepEqual(split.shots.map((s) => [s.start, s.end, s.idea]), [
    [0, 4.5, 0],
    [4.5, 7.57, 1],
    [7.57, 9.35, 2],
  ]);

  const plan = skillPlan({ skill, name: "Mot clé en grand", files, fill, talk });
  const parsed = editPlanSchema.safeParse(plan);
  assert.ok(parsed.success, parsed.success ? "" : parsed.error.message.slice(0, 300));
  assert.deepEqual(plan.segments.map((s) => ("clip_id" in s ? [s.clip_id, s.in, s.out, s.move ?? "none"] : [])), [
    ["talk", 0.15, 1.32, "none"],
    ["talk", 1.73, 4.24, "none"],
    ["talk", 5.06, 7.64, "punch"],
    ["talk", 7.81, 9.5, "none"],
  ]);
  assert.equal(plan.duration, 7.95);
  // Her words in the order they show: the hook, each keyword (band), the names of the list (caption), each in its font.
  assert.deepEqual(plan.texts.map((t) => [t.style, t.text, t.from, t.to, t.font ?? ""]), [
    ["hook", "Alors aujourd'hui", 0, 1.19, ""],
    ["band", "soins", 2.44, 3.64, ""],
    ["band", "gommage", 3.97, 6.22, ""],
    ["caption", "gommage", 3.97, 6.22, "Great Vibes"],
    ["caption", "masque", 4.77, 6.22, "Fraunces"],
    ["caption", "l'huile", 5.57, 6.22, ""],
    ["band", "Voilà", 6.4, 7.55, ""],
  ]);
  // What she says subtitled by the engine under it, its code given her words (times_spoken), its row on her chest.
  assert.equal(plan.subtitles, true);
  const motion = plan.layers![0]!.motion;
  assert.equal(motion.times_spoken, true);
  assert.equal(motion.writes_spoken, false);
  assert.equal(motion.subtitle_y, 0.75);
  // Its marks: its own, and where each idea is said (frames).
  assert.equal(motion.texts!.said_ideas, "3");
  assert.equal(motion.texts!.said_idea2_key, String(Math.round(3.97 * 30)));
  assert.equal(motion.texts!.said_hook_to, String(Math.round(1.19 * 30)));
  assert.ok(Number(motion.texts!.beat) > 16);
  // Its sounds on her keywords, as its timeline times them.
  assert.deepEqual(plan.sounds?.map((s) => s.at), [2.44, 3.97, 6.4]);
  // Its lengths are hers.
  assert.deepEqual(skillLengths(skill), { min: 3, max: 45 });
  // Its subtitles its own: the engine's step aside.
  const own = skillPlan({ skill: { ...skill, voice: { ...skill.voice!, subtitles: "own" } }, name: "Mot clé", files, fill, talk });
  assert.equal(own.layers![0]!.motion.writes_spoken, true);
});

test("a skill timed on her voice: its code gets her words said, each at its frame, and the engine's subtitles stay under it", async () => {
  const { skillTalk, readSkillFill, skillPlan } = await import("./skills.ts");
  const { compositionTexts } = await import("./compose.ts");
  const skill = await voicedSkill();
  const talk = skillTalk(talkFacts)!;
  const files = [{ id: "talk", photo: false, seconds: 10 }];
  const fill = readSkillFill(skill, files, 4, { fits: true, missing: "", shots: [], texts: [], end: null, why: "", voice: talkAnswer }, { talk })!;
  const plan = editPlanSchema.parse(skillPlan({ skill, name: "Mot clé en grand", files, fill, talk }));
  const inputs = { template: "libre" as const, clipUrls: { talk: "https://x/talk.mp4" }, brand: { name: "Studio" }, words: { talk: talkFacts.words } };
  const props = buildReelProps(plan, inputs);
  const layer = props.layers![0]!;
  // Every word she says kept (her « euh » was never a word), at its frame on the Reel.
  assert.equal(layer.spoken?.length, 19);
  assert.deepEqual(layer.spoken?.find((w) => w.w === "soins"), { w: "soins", from: Math.round(2.44 * 30), to: Math.round(2.84 * 30) });
  assert.equal(layer.captionsStay, true);
  // The engine still writes them as subtitles (the Reel's own words), in the skill's row.
  assert.equal(props.words.length, 19);
  assert.equal(props.subtitleY, 0.75);
  // Its texts reach its code with their fonts, in the check as in the render.
  assert.equal(layer.reelTexts?.find((t) => t.text === "masque")?.font, "Fraunces");
  assert.equal(compositionTexts(plan).texts.find((t) => t.text === "masque")?.font, "Fraunces");
  assert.ok((compositionTexts(plan).subtitles?.y_top ?? 0) > 1300);
  // Its subtitles its own: its code writes them, the engine's step aside.
  const own = editPlanSchema.parse(skillPlan({ skill: { ...skill, voice: { ...skill.voice!, subtitles: "own" } }, name: "Mot clé", files, fill, talk }));
  const ownLayer = buildReelProps(own, inputs).layers![0]!;
  assert.equal(ownLayer.spoken?.length, 19);
  assert.equal(ownLayer.captionsStay, undefined);
});

test("a skill timed on her voice: the filler reads her words numbered, what to choose in them, the fonts, and a correction keeps its choices", async () => {
  const { skillTalk, skillFillInput, saidCurrent, skillPlan, readSkillFill, skillFillSchema, SKILL_FILL_PROMPT } = await import("./skills.ts");
  const skill = await voicedSkill();
  const talk = skillTalk(talkFacts)!;
  const files = [{ id: "talk", photo: false, seconds: 10 }];
  const input = skillFillInput({ skill, name: "Mot clé en grand", n: talk.pieces.length, files, business: {}, request: "", talk }) as Record<string, unknown> & {
    voix: { idees: string; liste: string };
    ce_qu_elle_dit: string[];
    cases: unknown[];
    polices?: string[];
    modele: { longueurs: string };
  };
  assert.deepEqual(input.cases, []);
  assert.match(input.voix.idees, /^de 1 à 4 ; chacune : le mot qui porte l'idée \(14 caractères au plus\)$/);
  assert.match(input.voix.liste, /police : oui, une différente par nom/);
  assert.equal(input.ce_qu_elle_dit[0]!.slice(0, 22), "[0] Alors [1] aujourd'");
  assert.ok((input.polices?.length ?? 0) >= 40);
  assert.match(input.modele.longueurs, /ce Reel : 7\.95 s/);
  assert.match(SKILL_FILL_PROMPT, /A model timed on her voice/);
  assert.ok(skillFillSchema.shape.voice);
  // A correction: what it chose shown back, its hook, its keywords and its list.
  const fill = readSkillFill(skill, files, 4, { fits: true, missing: "", shots: [], texts: [], end: null, why: "", voice: talkAnswer }, { talk })!;
  const plan = skillPlan({ skill, name: "Mot clé", files, fill, talk });
  assert.deepEqual(saidCurrent(plan.texts), ["accroche : Alors aujourd'hui", "idée 1 : soins", "idée 2 : gommage ; sa liste : gommage, masque, l'huile", "idée 3 : Voilà"]);
  const again = skillFillInput({ skill, name: "Mot clé", n: 4, files, business: {}, request: "change le mot clé", talk, currentSaid: saidCurrent(plan.texts) }) as { voix_actuelle?: string[] };
  assert.equal(again.voix_actuelle?.length, 4);
  // A skill without voice keeps its slots to cast.
  const { decode } = await import("./skills/decode.ts");
  assert.ok((skillFillInput({ skill: decode, name: "Décode", n: 12, files, business: {}, request: "" }).cases as unknown[]).length === 12);
});

test("two videos of one take: their offset found on their sound to a sample, two different talks told apart", async () => {
  const { takeOffset, wordsOffset, pcmSamples, sameTake, TAKE_RATE, TAKE_MATCH } = await import("./takes.ts");
  const rng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** A voice: syllables (a pitch with its harmonics, or a noisy consonant) in phrases, pauses between them. */
  const speech = (seconds: number, seed: number) => {
    const r = rng(seed);
    const out = new Float32Array(Math.round(seconds * TAKE_RATE));
    let t = Math.round(0.4 * TAKE_RATE);
    while (t < out.length) {
      for (let s = 0, n = 3 + Math.floor(r() * 8); s < n && t < out.length; s++) {
        const len = Math.round((0.08 + r() * 0.18) * TAKE_RATE);
        const f0 = 110 + r() * 140;
        const voiced = r() > 0.25;
        for (let i = 0; i < len && t + i < out.length; i++) {
          let v = 0;
          if (voiced) for (let h = 1; h <= 6; h++) v += Math.sin((2 * Math.PI * f0 * h * i) / TAKE_RATE) / h;
          else v = (r() * 2 - 1) * 0.6;
          out[t + i] = 0.3 * Math.sin((Math.PI * i) / len) * v;
        }
        t += len + Math.round(r() * 0.05 * TAKE_RATE);
      }
      t += Math.round((0.15 + r() * 0.6) * TAKE_RATE);
    }
    return out;
  };
  /** The same voice heard by a second phone: its own clock (b(t + offset) = a(t)), duller, the room's echo, its own noise. */
  const otherPhone = (a: Float32Array, offset: number, seed: number, noise = 0.01) => {
    const r = rng(seed);
    const out = new Float32Array(a.length);
    let low = 0;
    for (let n = 0; n < out.length; n++) {
      const src = n - offset * TAKE_RATE;
      const i = Math.floor(src);
      const x = i >= 0 && i + 1 < a.length ? a[i]! * (1 - (src - i)) + a[i + 1]! * (src - i) : 0;
      const e = Math.floor(src - 0.031 * TAKE_RATE);
      low += 0.35 * (x + (e >= 0 && e < a.length ? 0.35 * a[e]! : 0) - low);
      out[n] = 0.45 * low + (r() * 2 - 1) * noise;
    }
    return out;
  };
  const voice = speech(20, 7);
  for (const offset of [0.8137, -2.4562, 0, 6.03]) {
    const found = takeOffset(voice, otherPhone(voice, offset, 3), TAKE_RATE)!;
    assert.ok(Math.abs(found.offset - offset) < 0.001, `${offset} s found ${found.offset} s`);
    assert.ok(sameTake(found) && found.score >= TAKE_MATCH, `${offset}: ${found.score}`);
  }
  // A loud room (each phone its own noise), searched near the gap between their words.
  const noisy = takeOffset(voice.map((v, i) => v + (rng(i)() * 2 - 1) * 0.08), otherPhone(voice, 3.3333, 4, 0.08), TAKE_RATE, { around: 3.3 })!;
  assert.ok(Math.abs(noisy.offset - 3.3333) < 0.001 && sameTake(noisy), JSON.stringify(noisy));
  // Another voice, or the same words said again in another take: not one take.
  assert.equal(sameTake(takeOffset(voice, speech(20, 99), TAKE_RATE)), false);
  assert.equal(sameTake(takeOffset(voice, otherPhone(speech(20, 8), 1, 3), TAKE_RATE)), false);
  // Too short or silent: nothing.
  assert.equal(takeOffset(new Float32Array(TAKE_RATE), voice, TAKE_RATE), null);
  // Their words: the same speech, the gap between the same words (its median); too few, or other words, none.
  const said = (shift: number, words = "alors aujourd hui je vais vous montrer trois soins pour l hiver le gommage") => words.split(" ").map((w, i) => word(w, i * 0.4 + shift, i * 0.4 + shift + 0.3));
  assert.deepEqual(wordsOffset(said(0), said(1.25)), { offset: 1.25, matched: 14, share: 1 });
  assert.equal(wordsOffset(said(0), said(0).slice(0, 4)), null);
  assert.equal(wordsOffset(said(0), said(0, "bonjour à tous bienvenue chez nous on va parler de la coupe du jour")), null);
  // Her sound as the sandbox decodes it (s16le).
  assert.deepEqual([...pcmSamples(new Uint8Array([0x00, 0x40, 0x00, 0xc0, 0xff, 0x7f]))].map((v) => Math.round(v * 1000) / 1000), [0.5, -0.5, 1]);
});

test("two videos of one take: a skill timed on her voice plays every other idea from her other angle, at the same moment of what she says", async () => {
  const { skillTalk, readSkillFill, skillPlan } = await import("./skills.ts");
  const skill = await voicedSkill();
  const files = [{ id: "talk", photo: false, seconds: 10 }, { id: "side", photo: false, seconds: 11 }];
  const answer = { fits: true, missing: "", shots: [], texts: [], end: null, why: "", voice: talkAnswer };
  // Her side angle started 1,25 s before the front one: the same moment is 1,25 s later on it.
  const talk = skillTalk(talkFacts, { takes: [{ clip: "side", offset: 1.25, seconds: 11 }] })!;
  const plan = skillPlan({ skill, name: "Mot clé", files, fill: readSkillFill(skill, files, 4, answer, { talk })!, talk });
  assert.deepEqual(plan.segments.map((s) => ("clip_id" in s ? [s.clip_id, s.in, s.out, s.move ?? "none"] : [])), [
    ["talk", 0.15, 1.32, "none"],
    ["talk", 1.73, 4.24, "none"],
    ["side", 6.31, 8.89, "none"],
    ["talk", 7.81, 9.5, "none"],
  ]);
  assert.equal(plan.duration, 7.95);
  // An angle that does not have that moment (it started 6 s later): her main video, framed tighter.
  const late = skillTalk(talkFacts, { takes: [{ clip: "side", offset: -6, seconds: 11 }] })!;
  const fallback = skillPlan({ skill, name: "Mot clé", files, fill: readSkillFill(skill, files, 4, answer, { talk: late })!, talk: late });
  assert.deepEqual(fallback.segments.map((s) => ("clip_id" in s ? [s.clip_id, s.move ?? "none"] : [])), [
    ["talk", "none"],
    ["talk", "none"],
    ["talk", "punch"],
    ["talk", "none"],
  ]);
  // One frame all along when the skill says so.
  const still = skillPlan({ skill: { ...skill, voice: { ...skill.voice!, angles: false } }, name: "Mot clé", files, fill: readSkillFill(skill, files, 4, answer, { talk })!, talk });
  assert.ok(still.segments.every((s) => "clip_id" in s && s.clip_id === "talk" && !s.move));
  // Her video runs on after her last word when its timeline lasts longer (an ending), as far as it goes.
  const longer = { ...skill, timeline: (n: number, o: Parameters<typeof skill.timeline>[1]) => ({ ...skill.timeline(n, o), duration: o.said!.duration + 1.6 }) };
  const ending = skillPlan({ skill: longer, name: "Mot clé", files, fill: readSkillFill(skill, files, 4, answer, { talk: late })!, talk: late });
  assert.equal(ending.duration, 8.45);
  assert.deepEqual(ending.segments.at(-1), { clip_id: "talk", in: 7.81, out: 10, zoom: "none" });
});

test("a font per word: a library of Google Fonts families by what they evoke, one picked by the filler for a word, loaded with the Reel", async () => {
  const { WORD_FONTS, wordFont, wordFontsBrief, FONT_PAIRS } = await import("./font-pairs.ts");
  const { readSkillFill, skillPlan, skillFillInput } = await import("./skills.ts");
  const { LOOK_FONT } = await import("./text-look.ts");
  assert.ok(WORD_FONTS.length >= 40);
  assert.equal(new Set(WORD_FONTS.map((f) => f.family)).size, WORD_FONTS.length);
  for (const f of WORD_FONTS) {
    assert.match(f.family, LOOK_FONT);
    assert.ok(f.evokes.length >= 3 && f.looks.length > 5 && f.weight >= 100 && f.weight <= 900, f.family);
  }
  // Every theme Tristan named has its families.
  for (const theme of ["boulangerie", "vin", "sport", "fleurs", "beauté", "café", "vintage", "tech"]) assert.ok(WORD_FONTS.some((f) => f.evokes.includes(theme)), theme);
  assert.equal(wordFont("great  vibes")?.family, "Great Vibes");
  assert.equal(wordFont("Comic Sans"), undefined);
  assert.equal(wordFont(""), undefined);
  assert.match(wordFontsBrief().find((l) => l.startsWith("Anton"))!, /^Anton : condensée très grasse, en capitales ; évoque sport, force/);
  // The pairs (three added on November 5: « Mot clé en grand »'s, « Face caméra et références »' and « Ton nom qui clignote »').
  assert.equal(FONT_PAIRS.length, 18);
  // A slot that asks for one: the filler's family when it is one of the library; none otherwise, nor on a slot that does not ask.
  const skill = {
    key: "test",
    version: 1,
    bpm: 100,
    shots: [1, 1] as [number, number],
    files: [1, 1] as [number, number],
    how: "",
    end: false,
    texts: [
      { slot: "mot", role: "hook" as const, want: "un mot", max: 20, required: true, font: true },
      { slot: "ligne", role: "caption" as const, want: "une ligne", max: 40, required: false },
    ],
    timeline: () => ({ duration: 4, shots: [{ start: 0, end: 4, want: "" }], texts: { mot: { from: 0, to: 4 }, ligne: { from: 1, to: 4 } }, marks: {} }),
    code: "function Scene() { return null; }",
  };
  const files = [{ id: "a", photo: true, seconds: 0 }];
  const read = (fonts: [string, string]) =>
    readSkillFill(skill, files, 1, { fits: true, missing: "", shots: [{ file: "a", at: 0 }], texts: [{ slot: "mot", text: "Croissant", font: fonts[0] }, { slot: "ligne", text: "tous les matins", font: fonts[1] }], end: null, why: "" })!;
  assert.deepEqual(read(["fraunces", "Pacifico"]).fonts, { mot: "Fraunces" });
  assert.equal(read(["Arial", ""]).fonts, undefined);
  const plan = skillPlan({ skill, name: "Test", files, fill: read(["Fraunces", ""]) });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.texts.map((t) => t.font ?? null), ["Fraunces", null]);
  // The render loads it (its texts' fonts) and the composition finds it on its text.
  const props = buildReelProps(plan, { template: "libre", clipUrls: { a: "https://x/a.jpg" }, photoIds: ["a"], brand: { name: "Farine" } });
  assert.equal(props.texts[0]!.font, "Fraunces");
  assert.equal(props.layers![0]!.reelTexts?.[0]?.font, "Fraunces");
  // The filler sees which slot asks for one, and the library.
  const input = skillFillInput({ skill, name: "Test", n: 1, files, business: {}, request: "" }) as { textes: { police?: string }[]; polices?: string[] };
  assert.deepEqual(input.textes.map((t) => t.police ?? null), ["oui", null]);
  assert.equal(input.polices?.length, WORD_FONTS.length);
  // A font that is not a family name is refused on a plan.
  assert.equal(editPlanSchema.safeParse({ ...plan, texts: [{ ...plan.texts[0]!, font: "x;}" }] }).success, false);
});

test("her address as coordinates: found in her facts or her site, Nominatim's answer kept only when it is her door, four decimals", async () => {
  const { addressIn, siteAddressLines, nominatimUrl, readNominatim, coordinatesText, placeCoordinates, studioPlaceSchema, GEO_USER_AGENT } = await import("./geo.ts");
  const line = (facts: string[]) => addressIn(facts)?.line ?? null;
  assert.equal(line(["Ouvert du mardi au samedi", "Adresse : 12 rue des Martyrs, 75009 Paris"]), "12 rue des Martyrs, 75009 Paris");
  assert.equal(line(["Le studio est au 3 bis, avenue Jean Jaurès 69007 Lyon."]), "3 bis avenue Jean Jaurès, 69007 Lyon");
  assert.equal(line(["Salon au 8 place du Marché à Saint-Ouen, ouvert du mardi au samedi"]), "8 place du Marché, Saint-Ouen");
  assert.equal(line(["Studio Pilates : 14B quai de la Charente, 75019 Paris. Tél 01 23 45 67 89"]), "14B quai de la Charente, 75019 Paris");
  assert.equal(line(["Notre adresse : 5, allée des Tilleuls - 1050 Bruxelles"]), "5 allée des Tilleuls, 1050 Bruxelles");
  // Never a street without its number, a town alone, or a sentence that only looks like one.
  assert.equal(line(["Rue des Martyrs, Paris", "Paris 11e", "12 cours de yoga par semaine, Paris", "3 cours sur 4 sont complets, Nous ouvrons bientôt"]), null);
  assert.equal(line(["14 route de Lyon"]), null);
  assert.equal(line(["14 route de Lyon 69300 Caluire"]), "14 route de Lyon, 69300 Caluire");
  // Her site's structured data.
  const html = `<script type="application/ld+json">{"@type":"Bakery","address":{"@type":"PostalAddress","streetAddress":"27 rue Ramponeau","postalCode":"75020","addressLocality":"Paris"}}</script>`;
  assert.deepEqual(siteAddressLines(html), ["27 rue Ramponeau, 75020 Paris"]);
  assert.equal(line(siteAddressLines(html)), "27 rue Ramponeau, 75020 Paris");
  // One request, as its usage policy asks: one result with its details, an app's name, never an email.
  const address = addressIn(["12 rue des Martyrs, 75009 Paris"])!;
  const url = new URL(nominatimUrl(address));
  assert.equal(url.origin + url.pathname, "https://nominatim.openstreetmap.org/search");
  assert.deepEqual([url.searchParams.get("q"), url.searchParams.get("format"), url.searchParams.get("limit"), url.searchParams.get("addressdetails")], ["12 rue des Martyrs, 75009 Paris", "jsonv2", "1", "1"]);
  assert.doesNotMatch(GEO_USER_AGENT, /@/);
  assert.match(GEO_USER_AGENT, /^Edith\//);
  // Its real answer (asked once, 5 November 2026): her door, four decimals.
  const answer = [{ lat: "48.8772264", lon: "2.3394407", category: "place", type: "house", place_rank: 30, address: { house_number: "12", road: "Rue des Martyrs", city: "Paris", postcode: "75009", country_code: "fr" } }];
  const found = readNominatim(answer, address)!;
  assert.equal(coordinatesText(found), "48.8772° N, 2.3394° E");
  assert.equal(coordinatesText({ lat: -33.86789, lon: -151.20732 }), "33.8679° S, 151.2073° O");
  // Its street or its town instead of her door, another number or another postcode: no coordinates, never made up.
  assert.equal(readNominatim([{ ...answer[0], address: { road: "Rue des Martyrs", postcode: "75009" } }], address), null);
  assert.equal(readNominatim([{ ...answer[0], address: { ...answer[0]!.address, house_number: "21" } }], address), null);
  assert.equal(readNominatim([{ ...answer[0], address: { ...answer[0]!.address, postcode: "75018" } }], address), null);
  assert.equal(readNominatim([], address), null);
  assert.equal(readNominatim({ error: "Unable to geocode" }, address), null);
  // As cached on the studio: found, or not found (asked once all the same).
  assert.deepEqual(placeCoordinates(studioPlaceSchema.parse({ address: address.line, lat: 48.8772264, lon: 2.3394407, at: "2026-11-05T08:00:00Z" })), { lat: 48.8772264, lon: 2.3394407 });
  assert.equal(placeCoordinates(studioPlaceSchema.parse({ address: address.line, none: true, at: "2026-11-05T08:00:00Z" })), null);
});

test("her address as coordinates: a skill's label written by the engine when they are known, by the filler as its fallback when not", async () => {
  const { readSkillFill, skillFillInput, skillPlan } = await import("./skills.ts");
  const skill = {
    key: "test",
    version: 1,
    bpm: 93,
    shots: [1, 1] as [number, number],
    files: [1, 1] as [number, number],
    how: "",
    end: false,
    texts: [
      { slot: "gauche", role: "hook" as const, want: "son quartier", max: 20, required: true },
      { slot: "droite", role: "caption" as const, want: "ses coordonnées, sinon sa ville", max: 24, required: true, fact: "coordinates" as const },
    ],
    timeline: () => ({ duration: 4, shots: [{ start: 0, end: 4, want: "" }], texts: { gauche: { from: 0, to: 4 }, droite: { from: 0, to: 4 } }, marks: {} }),
    code: "function Scene() { return null; }",
  };
  const files = [{ id: "a", photo: true, seconds: 0 }];
  const answer = { fits: true, missing: "", shots: [{ file: "a", at: 0 }], texts: [{ slot: "gauche", text: "Pigalle" }, { slot: "droite", text: "48.8800° N, 2.3400° E" }], end: null, why: "" };
  const facts = { coordinates: "48.8772° N, 2.3394° E" };
  // Known: the engine's words, whatever the filler wrote; shown to the filler as written, never to be written again.
  assert.equal(readSkillFill(skill, files, 1, answer, { facts })!.texts.droite, "48.8772° N, 2.3394° E");
  const input = skillFillInput({ skill, name: "Fenêtres", n: 1, files, business: {}, request: "", facts }) as { textes: Record<string, unknown>[] };
  assert.deepEqual(input.textes[1], { slot: "droite", ecrit_par_le_moteur: "48.8772° N, 2.3394° E", obligatoire: false });
  assert.equal(skillPlan({ skill, name: "Fenêtres", files, fill: readSkillFill(skill, files, 1, answer, { facts })! }).texts[1]!.text, "48.8772° N, 2.3394° E");
  // Unknown: the filler writes its fallback (here what it wrote).
  assert.equal(readSkillFill(skill, files, 1, { ...answer, texts: [{ slot: "gauche", text: "Pigalle" }, { slot: "droite", text: "Paris 9e" }] })!.texts.droite, "Paris 9e");
  assert.equal((skillFillInput({ skill, name: "Fenêtres", n: 1, files, business: {}, request: "" }) as { textes: Record<string, unknown>[] }).textes[1]!.dit, "ses coordonnées, sinon sa ville");
  // Longer than its place: not written by the engine (never cut in the middle of a number).
  assert.equal(readSkillFill({ ...skill, texts: [skill.texts[0]!, { ...skill.texts[1]!, max: 12 }] }, files, 1, { ...answer, texts: [{ slot: "gauche", text: "Pigalle" }, { slot: "droite", text: "Paris 9e" }] }, { facts })!.texts.droite, "Paris 9e");
});

// The music and sound tools the models' fiches found missing: the piece set on the model's beats (its first strong
// beat on beat 0 or on a mark), a pause that leaves its tail, an end on a hit ringing, a tape stop, a build-up, bursts,
// a shot's own sound, a sound on her gesture.
// ---------------------------------------------------------------------------

/**
 * Bass levels every 10 ms of a groove from `first` s at `beat` s a beat: a kick on the beats of each bar listed in
 * `kicks` (−10 dB, then −18, then gone), a bass note on each bar's 1 (−17 dB, held a bar, `ripple` dB up every other
 * window as a held 55 Hz note beats with them), `pickup` beats before the first bar with only a soft tick (−30 dB).
 */
function groove(o: { beat: number; first: number; seconds: number; kicks: number[]; pickup?: number; ripple?: number; bass?: boolean }): number[] {
  let seed = 11;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 1.5;
  return Array.from({ length: Math.round(o.seconds / 0.01) }, (_, i) => {
    const t = (i + 0.5) * 0.01;
    let power = 10 ** ((-42 + noise()) / 10);
    const n = Math.floor((t - o.first) / o.beat + 1e-9);
    const since = t - (o.first + n * o.beat);
    if (n >= 0 && o.kicks.includes(((n % 4) + 4) % 4)) power += 10 ** ((since < 0.02 ? -10 : since < 0.1 ? -18 : -60) / 10);
    if (n < 0 && n >= -(o.pickup ?? 0)) power += 10 ** ((since < 0.02 ? -30 : -60) / 10);
    if (o.bass !== false && n >= 0) {
      const bar = Math.floor(n / 4);
      const sinceBar = t - (o.first + bar * 4 * o.beat);
      power += 10 ** ((sinceBar < 0.03 ? -15 : -17 + (i % 2 ? (o.ripple ?? 0) : 0)) / 10);
    }
    return 10 * Math.log10(power);
  });
}

test("the composed piece set on the model's beats: its first strong beat on beat 0, a late start's end or the model's mark", async () => {
  const { beatGrid, firstDownbeat, musicStart, musicSetting, ATTACK_LEAD } = await import("./mix.ts");
  const { musicDownbeat, musicHeard, shiftMusicShape } = await import("./music-shape.ts");
  const beat = 60 / 120;
  // A beat of pickup (a soft tick, no kick) before its first bar at 0,5 s, its kicks on 1 and 3, its bass on each 1: its
  // grid may start on the pickup, its first strong beat is its first bar's.
  const pickup = groove({ beat, first: 0.5, seconds: 20, kicks: [0, 2], pickup: 1 });
  const grid = beatGrid(pickup, beat)!;
  assert.ok(grid && Math.abs(grid.period - beat) < 0.002, JSON.stringify(grid));
  assert.ok(Math.abs(firstDownbeat(pickup, grid)! - 0.5) <= 0.01, `${firstDownbeat(pickup, grid)}`);
  // Its bars tell their 1 when it is the strongest beat of four by a quarter: kicks on every beat from 0,3 s over its pad
  // (a rise of 6 dB), but its bass note starts on the third (its bars from 1,3 s, a rise of 12): the composer's start is a
  // half-bar pickup.
  const late = Array.from({ length: 2000 }, (_, i) => {
    const t = (i + 0.5) * 0.01;
    const since = (t - 0.3 + 40 * beat) % beat;
    const sinceBar = (t - 1.3 + 40 * beat) % (4 * beat);
    if (t >= 1.3 && sinceBar < 0.02) return -10;
    return t >= 0.3 && since < 0.02 ? -16 : -22;
  });
  const four = beatGrid(late, beat)!;
  assert.ok(Math.abs(firstDownbeat(late, four)! - 1.3) <= 0.01, `${firstDownbeat(late, four)}`);
  // Four on the floor, every beat alike: the composer's first kick stays its beat 0.
  const floor = groove({ beat, first: 0.2, seconds: 20, kicks: [0, 1, 2, 3], bass: false });
  assert.ok(Math.abs(firstDownbeat(floor, beatGrid(floor, beat)!)! - 0.2) <= 0.01);
  // A held bass rippling 2 dB from a window to the next under the kicks: its grid is still found (before, never).
  const held = groove({ beat, first: 0.1, seconds: 20, kicks: [0, 2], ripple: 2.4 });
  assert.ok(beatGrid(held, beat), "the grid under a held bass");

  // Where it starts: cut to its first strong beat (its attack 5 ms after the mark, as on every cut), on its own clock
  // before its tempo moves; a mark in music already heard takes it from a later bar (a pickup plays before, never a
  // silence); a late start holds it back (silence where it is not heard anyway).
  assert.equal(ATTACK_LEAD, 0.005);
  assert.deepEqual(musicStart({ downbeat: 0.5, tempo: 1, bar: 2, mark: 0, heard: 0 }), { trim: 0.495, delay: 0 });
  assert.deepEqual(musicStart({ downbeat: 0.5, tempo: 1, bar: 2, mark: 0.25, heard: 0 }), { trim: 0.245, delay: 0 });
  assert.deepEqual(musicStart({ downbeat: 0.5, tempo: 1, bar: 2, mark: 0.75, heard: 0 }), { trim: 1.745, delay: 0 });
  assert.deepEqual(musicStart({ downbeat: 0.5, tempo: 1, bar: 2, mark: 5.78, heard: 5.78 }), { trim: 0, delay: 5.285 });
  // A hair is not worth a cut; held to a tempo 2 % faster, its silence is on the Reel's clock.
  assert.deepEqual(musicStart({ downbeat: 0.012, tempo: 1, bar: 2, mark: 0, heard: 0 }), { trim: 0, delay: 0 });
  assert.deepEqual(musicStart({ downbeat: 0.51, tempo: 1.02, bar: 2, mark: 1, heard: 1 }), { trim: 0, delay: 0.505 });
  // On the piece itself: its grid, its first strong beat, its tempo; without a grid, held back only for a late start.
  const set = musicSetting(pickup, beat, 0, 0);
  assert.ok(set.aligned && Math.abs(set.trim - 0.495) <= 0.01 && Math.abs(set.tempo - 1) < 0.005, JSON.stringify(set));
  const quiet = Array.from({ length: 1500 }, () => -50);
  assert.deepEqual(musicSetting(quiet, beat, 0, 0), { trim: 0, delay: 0, tempo: 1, aligned: false });
  assert.deepEqual(musicSetting(quiet, beat, 5.78, 5.78), { trim: 0, delay: 5.785, tempo: 1, aligned: false });

  // Its mark: the model's downbeat, else where a late start ends (it comes in on its downbeat), else 0; later with a lead.
  assert.equal(musicDownbeat({ pauses: [{ from: 0, to: 5.78 }, { from: 8, to: 9 }] }, 20), 5.78);
  assert.equal(musicHeard({ pauses: [{ from: 0, to: 5.78 }] }, 20), 5.78);
  assert.equal(musicDownbeat({ downbeat: 0.33, pauses: [{ from: 0, to: 2 }] }, 20), 0.33);
  assert.equal(musicDownbeat({ pauses: [{ from: 1, to: 2 }] }, 20), 0);
  assert.equal(musicDownbeat(null, 20), 0);
  assert.deepEqual(shiftMusicShape({ downbeat: 0.33 }, 0.2), { downbeat: 0.53 });
});

test("a gap the Reel never lets be heard is not composed again: a wanted break, a late start, after its end", async () => {
  const { heardGaps } = await import("./mix.ts");
  // Its beat holds but for 2 s from 6 s (the bass 30 dB down): a gap, until a pause, a late start or the end hides it.
  const levels = Array.from({ length: 2400 }, (_, i) => (i >= 600 && i < 800 ? -48 : -15));
  const none = { trim: 0, delay: 0, tempo: 1 };
  assert.deepEqual(heardGaps(levels, 20, none), [{ from: 6, to: 8 }]);
  assert.deepEqual(heardGaps(levels, 20, none, { pauses: [{ from: 5.5, to: 8.5 }] }), []);
  // Half of it under a late start: what is left heard is under a second; a second of it still heard is one.
  assert.deepEqual(heardGaps(levels, 20, none, { pauses: [{ from: 0, to: 7.2 }] }), []);
  assert.deepEqual(heardGaps(levels, 20, none, { end: { at: 6.8 } }), []);
  assert.deepEqual(heardGaps(levels, 20, none, { end: { at: 7 } }), [{ from: 6, to: 7 }]);
  // Held back 3 s (its late start), the piece's gap is heard 3 s later; cut 2 s, 2 s earlier.
  assert.deepEqual(heardGaps(levels, 20, { trim: 0, delay: 3, tempo: 1 }), [{ from: 9, to: 11 }]);
  assert.deepEqual(heardGaps(levels, 20, { trim: 2, delay: 0, tempo: 1 }), [{ from: 4, to: 6 }]);
});

test("a pause that leaves its tail, an end on its hit ringing, a tape stop, a soft build-up: read, drawn on their own samples", async () => {
  const { readMusicShape, musicShapeGraph, musicEnvelope, pauseShifts, TAIL_GRAB } = await import("./music-shape.ts");
  // A tail dies within its pause (never in a late start); an end has one way of ending: a stop, else a tail, else a fade.
  assert.deepEqual(readMusicShape({ pauses: [{ from: 0, to: 1, tail: 1 }, { from: 4, to: 4.5, tail: 2 }] }, 8), {
    pauses: [{ from: 0, to: 1 }, { from: 4, to: 4.5, tail: 0.5 }],
  });
  assert.deepEqual(readMusicShape({ end: { at: 7, tail: 3, fade: 1 } }, 8), { end: { at: 7, tail: 1 } });
  assert.deepEqual(readMusicShape({ end: { at: 7, stop: 1.5, tail: 1 } }, 8), { end: { at: 7, stop: 1.5 } });
  assert.deepEqual(readMusicShape({ end: { at: 7.98, tail: 1 } }, 8), { end: { at: 7.98, fade: 0.012 } });
  assert.deepEqual(readMusicShape({ filters: [{ kind: "soft", from: 2, to: 6, open: 4 }] }, 8), { filters: [{ kind: "soft", from: 2, to: 6, open: 4, db: -8 }] });
  // Its tail: the reverb of its last quarter of a second before the stop, a room of noise falling 60 dB over the tail,
  // at 0,7 of the music, from the stop (fading in over the dry's last 5 ms) to its end, mixed back with the music gated.
  const graph = musicShapeGraph({ pauses: [{ from: 4, to: 5, tail: 0.5 }] }, "in", "out", 8);
  assert.equal(TAIL_GRAB, 0.25);
  assert.match(graph, /\[ms_pt0\]atrim=start_sample=165375:end_sample=176400,asetpts=PTS-STARTPTS,afade=t=in:ns=441,apad=pad_dur=0\.550\[ms_tail0_x\]/);
  assert.match(graph, /aevalsrc=exprs='\(2\*random\(0\)-1\)\*exp\(-6\.9\*t\/0\.500\)\|\(2\*random\(1\)-1\)\*exp\(-6\.9\*t\/0\.500\)':s=44100:d=0\.500,lowpass=f=6000\[ms_tail0_ir\]/);
  assert.match(graph, /\[ms_tail0_x\]\[ms_tail0_ir\]afir=irnorm=2:wet=0\.7\[ms_tail0_w\]/);
  assert.match(graph, /adelay=176180S:all=1\[ms_tail0\]/);
  assert.match(graph, /\[ms_pgk\]\[ms_tail0\]amix=inputs=2:duration=first:normalize=0\[ms_paused\]/);
  // An end on its last hit: the music cut dead at it, its tail after it.
  const ring = musicShapeGraph({ end: { at: 6, tail: 1.4 } }, "in", "out", 8);
  assert.match(ring, /\[ms_eg\]afade=t=out:ss=264071:ns=529\[ms_egk\]/);
  assert.match(ring, /exp\(-6\.9\*t\/1\.400\)/);
  assert.match(ring, /\[ms_egk\]\[ms_etail\]amix=inputs=2:duration=first:normalize=0\[ms_ended\]/);
  // A tape stop over 1,5 s ending at 6 s: 50 steps of 30 ms, each at its speed (falling evenly to nothing), its sound
  // fading over its last 0,6 s, silent to the end.
  const stop = musicShapeGraph({ end: { at: 6, stop: 1.5 } }, "in", "out", 8);
  assert.match(stop, /^\[in\]asplit=51\[ms_ended_h\]/);
  assert.match(stop, /\[ms_ended_h\]atrim=end_sample=198450,asetpts=PTS-STARTPTS\[ms_ended_head\]/);
  assert.match(stop, /asetrate=43659,aresample=44100/);
  assert.match(stop, /asetrate=441,aresample=44100/);
  assert.match(stop, /concat=n=51:v=0:a=1,afade=t=out:ss=238140:ns=26460,apad=whole_len=374850\[ms_ended\]/);
  // A build-up: 12 dB softer from 2 s, its level rising back over 4 s, the same sound (no filter to hollow it).
  const soft = musicShapeGraph({ filters: [{ kind: "soft", from: 2, to: 6, open: 4, db: -12 }, { kind: "soft", from: 7, to: 7.5, db: -6 }] }, "in", "out", 8);
  assert.match(soft, /^\[in\]asplit=3\[ms_dry\]\[ms_soft120\]\[ms_soft60\];/);
  assert.match(soft, /\[ms_soft120\]volume=-12dB\[ms_soft120f\]/);
  assert.match(soft, /\[ms_soft60\]volume=-6dB\[ms_soft60f\]/);
  // A passage still filtered as the music stops opens in the silence, on its return (never 20 ms before the stop).
  const radio = musicShapeGraph({ pauses: [{ from: 4, to: 5 }], filters: [{ kind: "radio", from: 1, to: 4 }] }, "in", "out", 8);
  assert.match(radio, /\[ms_dryk_s1\]atrim=start_sample=219618,/);
  // Its returns on the music's beats once it is set on the cuts: « Titre qui se décode » comes in on its downbeat with its
  // band (11,75 beats), and back after its breath on the Reel's beat 30, a quarter beat later on the music's own grid.
  const beat = 60 / 122;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const open = r3(11.75 * beat);
  const pauses = [{ from: 0, to: open }, { from: r3(27 * beat + 0.1), to: r3(30 * beat) }];
  assert.deepEqual(pauseShifts(pauses, { beat, downbeat: open }, 22.6), [0, 0.123]);
  assert.deepEqual(pauseShifts(pauses, null, 22.6), [0, 0]);
  assert.deepEqual(pauseShifts([{ from: 2, to: 3 }], { beat: 0.5, downbeat: 0 }, 8), [0]);
  const shifted = musicShapeGraph({ pauses }, "in", "out", 22.6, { beat, downbeat: open });
  // (The part after the return plays from 123 ms earlier in the piece: its beat 18 on the Reel's beat 30.)
  assert.match(shifted, /\[ms_paused_s1\]atrim=start_sample=645007,/);
  assert.match(musicShapeGraph({ pauses }, "in", "out", 22.6), /\[ms_paused_s1\]atrim=start_sample=650431,/);
  // The live preview: a tail fades over half of it, a soft passage is lower then rises, a tape stop fades over its stop.
  assert.deepEqual(musicEnvelope({ pauses: [{ from: 2, to: 3, tail: 0.6 }] }, 8, 30), [[60, 1], [69, 0], [89, 0], [90, 1]]);
  assert.deepEqual(musicEnvelope({ filters: [{ kind: "soft", from: 2, to: 6, open: 4, db: -12 }] }, 8, 30), [[59, 1], [60, 0.25], [180, 1]]);
  assert.deepEqual(musicEnvelope({ end: { at: 6, stop: 1.5 } }, 8, 30), [[135, 1], [180, 0], [241, 0]]);
  assert.deepEqual(musicEnvelope({ end: { at: 6, tail: 1 } }, 8, 30), [[180, 1], [195, 0], [241, 0]]);
});

test("a burst: one sound laid as a sequence denser than a frame, one cue, every hit on its own sample", async () => {
  const { burstTimes, planCues, placeSounds, BURST_MAX } = await import("./sfx.ts");
  const { soundChains } = await import("./mix.ts");
  const { skillAudio } = await import("./skills.ts");
  // « Pile de photos »'s clicking before 1,6 s: 40 a second slowing evenly to 16 over 1,5 s.
  const times = burstTimes(40, 16, 1.5);
  assert.equal(times[0], 0);
  assert.equal(Math.round((times[1]! - times[0]!) * 1000), 25);
  assert.ok(Math.abs(times.at(-1)! - times.at(-2)! - 1 / 16) < 0.004 && times.length >= 36 && times.length <= 40, `${times.length} hits`);
  assert.deepEqual(burstTimes(10, 10, 1), [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  assert.equal(burstTimes(60, 60, 10).length, BURST_MAX);
  // On the plan: one cue, its hits in order within the Reel, their gains bounded; a burst of one hit is none.
  const audio = skillAudio({
    duration: 4,
    sounds: [
      { at: 0.1, sound: "light click", seconds: 0.5, gain: -8, burst: { times: [0.05, 0, 3.86, 0.025], gains: [-2, 0, -30, 9] } },
      { at: 2, sound: "dry knock", burst: { times: [0] } },
    ],
  });
  assert.deepEqual(audio.sounds, [
    { at: 0.1, sound: "light click", seconds: 0.5, skill: true, gain: -8, burst: { times: [0, 0.025, 0.05], gains: [0, 6, -2] } },
    { at: 2, sound: "dry knock", seconds: 1, skill: true },
  ]);
  const plan = { duration: 4, texts: [], segments: [{ clip_id: "a", in: 0, out: 4 }], sounds: audio.sounds } as never;
  const cues = planCues(plan, [{ start: 0, length: 4 }]);
  assert.deepEqual(cues[0]!.burst, audio.sounds![0]!.burst);
  // Placed as the mix places it: its whole sound on each hit, each at its moment from the first and its own gain.
  const library = { "light click@0.5": { lufs: -26, peak: -10, onset: 0.02, end: 0.09 }, "dry knock@1": { lufs: -20, peak: -6, onset: 0, end: 0.4 } };
  const [click] = placeSounds(cues, { level: "light", mix: "music", duration: 4, speech: [], library });
  assert.deepEqual(click!.burst, { times: [0, 0.025, 0.05], gains: [0, 6, -2] });
  assert.deepEqual([click!.at, click!.onset, click!.end], [0.1, 0.02, 0.09]);
  // In the mix: its file once, split, each copy delayed to its own sample and at its own gain, mixed back.
  const chain = soundChains([{ at: 0.1, gain: -2, onset: 0.02, end: 0.09, burst: click!.burst }], 2);
  assert.match(chain, /afade=t=out:st=0\.030:d=0\.04,asplit=3\[x0b0\]\[x0b1\]\[x0b2\];/);
  assert.match(chain, /\[x0b0\]adelay=4410S:all=1\[x0d0\];\[x0b1\]adelay=5513S:all=1,volume=6dB\[x0d1\];\[x0b2\]adelay=6615S:all=1,volume=-2dB\[x0d2\]/);
  assert.match(chain, /\[x0d0\]\[x0d1\]\[x0d2\]amix=inputs=3:duration=longest:normalize=0\[x0\]$/);
  // A single sound's chain stays as it was.
  assert.equal(
    soundChains([{ at: 0.1, gain: -2, onset: 0.02, end: 0.09 }], 2),
    "[2:a]atrim=start=0.020:end=0.090,asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,volume=-2dB,afade=t=in:d=0.005,afade=t=out:st=0.030:d=0.04,adelay=100:all=1[x0]",
  );
});

test("her video's own sound on a model's shot: kept by the render, heard on its shot, the music stepping back under it", async () => {
  const { skillPlan } = await import("./skills.ts");
  const { mixGains, mixFilter, SHOT_SOUND_LUFS, MIX_CASES } = await import("./mix.ts");
  const { editorOutputSchemaLegacy } = await import("./editor.ts");
  const skill = {
    key: "test-sound",
    version: 1,
    bpm: 120,
    shots: [3, 3] as [number, number],
    files: [1, 3] as [number, number],
    how: "",
    texts: [],
    end: false,
    timeline: () => ({ duration: 6, shots: [{ start: 0, end: 2, want: "", sound: true }, { start: 2, end: 4, want: "" }, { start: 4, end: 6, want: "", sound: true }], texts: {}, marks: {} }),
    code: "function Scene() { return null; }",
  };
  const files = [{ id: "v0", photo: false, seconds: 10 }, { id: "v1", photo: false, seconds: 10 }, { id: "p0", photo: true, seconds: 0 }];
  const plan = skillPlan({ skill, name: "Test", files, fill: { shots: [{ file: "v0", at: 1 }, { file: "v1", at: 0 }, { file: "p0", at: 0 }], texts: {}, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  // A video it hears keeps the flag; a photo has no sound to keep.
  assert.deepEqual(plan.segments.map((s) => ("sound" in s ? s.sound : undefined)), [true, undefined, undefined]);
  // The render plays that passage's sound (at its own pace, unless she wants none of her videos' sound).
  const inputs = { template: "libre" as const, clipUrls: { v0: "https://x/v0.mp4", v1: "https://x/v1.mp4", p0: "https://x/p0.jpg" }, photoIds: ["p0"], brand: { name: "Studio" }, soundtrack: "https://x/m.mp3" };
  const props = buildReelProps(plan, inputs);
  assert.deepEqual(props.segments.map((s) => (s.type === "clip" ? Boolean(s.speech) : null)), [true, false, null]);
  const none = buildReelProps({ ...plan, finish: { video_sound: "none" } }, inputs).segments[0]!;
  assert.equal(none.type === "clip" && Boolean(none.speech), false);
  // The live preview's music steps back under that shot as the mix does.
  assert.deepEqual(props.soundtrack?.duck?.windows, [[0, 60]]);
  // The mix: that sound a little under the music's level, the music ducking some 6 dB under it (not 17, as under speech).
  const gains = mixGains({ speech: -30, music: -15 }, false, "shots");
  assert.deepEqual([gains.kind, gains.speechGain, gains.musicGain], ["shot_sound", SHOT_SOUND_LUFS + 30, 0]);
  assert.match(mixFilter(gains, 5.2), /sidechaincompress=threshold=0\.05:ratio=2:attack=15:release=400/);
  assert.equal(MIX_CASES.shot_sound.under - MIX_CASES.shot_sound.music, -6);
  // Never written by the editor (its grammar stays as it was).
  const editorSegment = (editorOutputSchemaLegacy.shape.plan.shape.segments.element.options[0] as unknown as { shape: Record<string, unknown> }).shape;
  assert.ok(!("sound" in editorSegment));
});

test("a sound on her gesture: when her hand does it in the shot, read on her hands, else on its beat", async () => {
  const { handMoment } = await import("./tracking.ts");
  const { planCues } = await import("./sfx.ts");
  const { skillAudio } = await import("./skills.ts");
  // Her hand (thousandths of the picture) rises from the bottom to the top of a jump at image 64, then comes down.
  const hand = (y: number) => [1, ...Array.from({ length: 21 }, (_, k) => [500 + k, y - (k === 8 ? 40 : 0)]).flat()];
  const heights = Array.from({ length: 120 }, (_, k) => 800 - 600 * Math.max(0, 1 - Math.abs(k - 64) / 40));
  const file = { fps: 30, w: 1000, h: 1000, from: 0, n: 120, frames: heights.map((y) => ({ h: [hand(y)] })) };
  assert.equal(handMoment(file, 0, 4, "highest"), 2.133);
  assert.equal(handMoment(file, 0, 1.5, "highest"), 1.467);
  assert.equal(handMoment(file, 0, 4, "lowest"), 0);
  // A hand that goes up: once it has risen (handMoves).
  const jump = { ...file, frames: Array.from({ length: 60 }, (_, k) => ({ h: [hand(k < 20 ? 800 : k < 30 ? 800 - 50 * (k - 20) : 300)] })) };
  const raised = handMoment(jump, 0, 2, "raised");
  assert.ok(raised !== null && raised > 0.6 && raised < 1.1, `${raised}`);
  // No hand found: her body's wrists and fingers (visible), else nothing.
  const body = (y: number) => [1, ...Array.from({ length: 33 }, (_, p) => [500, p >= 15 && p <= 22 ? y : 900, 90]).flat()];
  assert.equal(handMoment({ ...file, frames: heights.map((y) => ({ b: [body(y)] })) }, 0, 4, "highest"), 2.133);
  assert.equal(handMoment({ ...file, frames: heights.map(() => ({})) }, 0, 4, "highest"), null);
  // On the plan: a skill's click on her hand at the switch, in its second shot (2 s to 6 s, her clip from 0,5 s), lands
  // where her hand is highest; without her tracks (or another clip's), on its beat; a shot it does not have, none.
  const audio = skillAudio({
    duration: 8,
    shots: [{ start: 0, end: 2, want: "" }, { start: 2, end: 6, want: "" }],
    sounds: [
      { at: 4, sound: "switch click", hand: { shot: 1, moment: "highest" } },
      { at: 5, sound: "light click", hand: { shot: 7, moment: "highest" } },
    ],
  });
  assert.deepEqual(audio.sounds!.map((s) => s.hand), [{ shot: 1, moment: "highest" }, undefined]);
  const plan = { duration: 8, texts: [], segments: [{ clip_id: "a", in: 0, out: 2 }, { clip_id: "her", in: 0.5, out: 4.5 }], sounds: audio.sounds } as never;
  const starts = [{ start: 0, length: 2 }, { start: 2, length: 4 }];
  assert.equal(planCues(plan, starts, { her: file })[0]!.at, 3.633);
  assert.equal(planCues(plan, starts)[0]!.at, 4);
  assert.equal(planCues(plan, starts, { a: file })[0]!.at, 4);
});

test("the models switched to the new tools: its tail (décode v4), its downbeat (quatre coins v3), its burst (pile v3), its shots heard (coups de fouet v3)", async () => {
  const { decode } = await import("./skills/decode.ts");
  const { quatreCoins } = await import("./skills/quatre-coins.ts");
  const { pile } = await import("./skills/pile.ts");
  const { coupsDeFouet, fouetRoles } = await import("./skills/coups-de-fouet.ts");
  const { skillPlan } = await import("./skills.ts");
  const { musicDownbeat, musicShapeGraph } = await import("./music-shape.ts");
  // « Titre qui se décode »: its last hit's tail dies away over the calm shot (60 dB down in 0,6 s, its breath almost
  // silent), its music comes in on its downbeat with the band (its late start's end), its radio opens in the silence.
  const line = decode.timeline(16, { end: false });
  const [late, breath] = line.music!.pauses!;
  assert.equal(breath!.tail, 0.6);
  assert.ok(breath!.to - breath!.from > 1.3);
  assert.equal(musicDownbeat(line.music, line.duration), late!.to);
  const graph = musicShapeGraph(line.music!, "in", "out", line.duration, { beat: 60 / 122, downbeat: late!.to });
  assert.match(graph, /afir=irnorm=2/);
  // « Mots aux quatre coins »: its music's first strong beat half a beat in; its first cut (the reprise) on the first beat
  // of its third bar, the next two on its beats, the fourth on an off-beat, as the original's after its reprise.
  const coins = quatreCoins.timeline(12, { end: false });
  const beat = 60 / 92;
  const down = musicDownbeat(coins.music, coins.duration);
  assert.ok(Math.abs(down - 0.5 * beat) < 1 / 30, `${down}`);
  const onMusic = coins.shots.slice(1, 5).map((s) => Math.round(((s.start - down) / beat) * 100) / 100);
  assert.ok(Math.abs(onMusic[0]! - 8) < 0.06 && Math.abs(onMusic[1]! - 9) < 0.06 && Math.abs(onMusic[2]! - 10) < 0.06 && Math.abs(onMusic[3]! - 11.5) < 0.06, JSON.stringify(onMusic));
  // « Pile de photos »: its clicking before 1,6 s as one burst from its first photo, 46 a second slowing to 16,5, its last
  // a click's gap before the first one laid alone; at a slower tempo, slower.
  const stack = pile.timeline(37, { end: false });
  const burst = stack.sounds!.find((s) => s.burst)!;
  const alone = stack.sounds!.filter((s) => !s.burst);
  assert.ok(burst.at >= stack.marks.first! / 30 && burst.at < 0.2, `${burst.at}`);
  const hits = burst.burst!.times;
  assert.ok(hits.length >= 38 && hits.length <= 44, `${hits.length} hits`);
  assert.ok(Math.abs(hits[1]! - hits[0]! - 1 / 46) < 0.003 && Math.abs(hits.at(-1)! - hits.at(-2)! - 1 / 16.5) < 0.005);
  assert.ok(burst.at + hits.at(-1)! < alone[0]!.at - 0.03, `${burst.at + hits.at(-1)!} → ${alone[0]!.at}`);
  const slow = pile.timeline(37, { end: false, bpm: 100 }).sounds!.find((s) => s.burst)!;
  assert.ok(Math.abs(slow.burst!.times.at(-1)! - hits.at(-1)! * 1.2) < 0.01);
  const files = Array.from({ length: 37 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 }));
  const pilePlan = skillPlan({ skill: pile, name: "Pile de photos", files, fill: { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { mots: "La Fripe Rétro" }, end: null } });
  assert.equal(pilePlan.sounds![0]!.burst!.times.length, hits.length);
  // « Ville en coups de fouet »: its opening shot and its tram keep their own sound, whatever its count of shots.
  const city = coupsDeFouet.timeline(23, { end: false });
  assert.deepEqual(city.shots.flatMap((s, i) => (s.sound ? [i] : [])), [0, 14]);
  const fewer = fouetRoles(14);
  assert.deepEqual(coupsDeFouet.timeline(14, { end: false }).shots.flatMap((s, i) => (s.sound ? [fewer[i]] : [])), [0, 14]);
  const videos = Array.from({ length: 23 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 8 }));
  const cityPlan = skillPlan({ skill: coupsDeFouet, name: "Ville en coups de fouet", files: videos, fill: { shots: videos.map((f) => ({ file: f.id, at: 0 })), texts: { titre: "Belleville" }, end: null } });
  assert.deepEqual(cityPlan.segments.flatMap((s, i) => ("sound" in s && s.sound ? [i] : [])), [0, 14]);
});

// ——— « Voici mon travail » v1, written on its original's fiche (docs/fiches/mon-travail.md) ——————————————————————————

/** The original's 37 works as its fiche measured them, image by image at 30 i/s: when each one lands (« Pile de photos »'s own). */
const MT_LANDS = [3, 5, 7, 10, 13, 15, 18, 21, 24, 26, 29, 32, 35, 37, 40, 42, 43, 48, 51, 54, 56, 59, 62, 65, 67, 70, 73, 76, 80, 85, 89, 95, 101, 107, 114, 123, 130];
/** And when each one leaves, where it is seen leaving (null: already covered); its 31st leaves after 55 images, as pile's. */
const MT_LEAVES = [123, 125, 127, 130, 133, 135, 138, 141, 144, 146, 149, 152, 155, 157, 160, 162, null, 168, 171, 174, 176, 179, 182, 185, 187, null, 193, 196, 200, 205, 144, 211, 217, 227, 234, 239, 244];
/** What its code lays at a frame: her shot, each work's shot, its box and where its Footage plays from, her cut-out, in drawing order. */
const travailDrawn = (code: string, frame: number, props: Record<string, unknown>, read: { boxes?: Record<string, TdBox>; outlines?: Record<string, string> } = {}) => {
  const tree = drawCutOuts(code, frame, { width: 1080, height: 1920, brand: { name: "Atelier Terre", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#b5543a" }, reelTexts: [], end: null, ...props }, read);
  const nodes = drawnNodes(tree);
  const works = nodes.flatMap((n) => {
    const footage = n.type === "div" && styleOf(n).overflow === "hidden" ? drawnNodes(n).find((c) => c.type === "Footage") : undefined;
    return footage ? [{ shot: footage.props.shot as number, at: footage.props.at as number, box: styleOf(n) as { left: number; top: number; width: number; height: number } }] : [];
  });
  const order = nodes.filter((n) => n.type === "Footage" || n.type === "Subject").map((n) => `${n.type === "Subject" ? "cut" : "shot"}${n.props.shot as number}`);
  return { tree, nodes, works, order };
};
const travailMarks = (line: { marks: Record<string, number> }) => Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));

test("« Voici mon travail » (v1) lays her works where and when its original does, within two images, her shot under them all along", async () => {
  const { monTravail, workLandings, frontFrom } = await import("./skills/mon-travail.ts");
  assert.equal(monTravail.version, 1);
  assert.equal(monTravail.bpm, 120);
  const line = monTravail.timeline(38, { end: false });
  // Her shot and the original's 37 works; 9,17 s (275 images), as the original.
  assert.equal(line.shots.length, 38);
  assert.ok(Math.abs(Math.round(line.duration * 30) - 275) <= 1, `${line.duration} s`);
  // Each work lands where the original's does, within two images: its burst at 2 or 3 images, its nine last on the
  // original's own slowing gaps.
  const lands = Array.from({ length: 37 }, (_, k) => line.marks[`l${k}`]!);
  assert.deepEqual(lands, workLandings(37).map((b) => Math.round(b * 15)));
  lands.forEach((f, k) => assert.ok(Math.abs(f - MT_LANDS[k]!) <= 2, `work ${k + 1}: image ${f}, the original's ${MT_LANDS[k]}`));
  const gaps = lands.slice(1).map((f, k) => f - lands[k]!);
  assert.ok(gaps.slice(0, 27).every((g) => g === 2 || g === 3), gaps.join(" "));
  assert.deepEqual(gaps.slice(27), [4, 5, 4, 6, 6, 6, 7, 9, 7]);
  // Each one leaves 120 images after it landed (the original's 28 seen leaving so, its 32nd and 33rd 4 images earlier),
  // the second-last on its hit (image 240, the original's 239), the last 5 images after; its 31st's early leaving not kept.
  const leaves = Array.from({ length: 37 }, (_, k) => line.marks[`o${k}`]!);
  leaves.forEach((f, k) => {
    const seen = MT_LEAVES[k];
    if (seen !== null && k !== 30) assert.ok(Math.abs(f - seen!) <= 3, `work ${k + 1} leaves at ${f}, the original's ${seen}`);
  });
  assert.equal(line.marks.hit, 240);
  assert.equal(line.marks.last, 245);
  assert.ok(leaves.slice(0, 35).every((f, k) => f <= lands[k]! + 120 && f < 240));
  // Its code: each work on its image, at once, until it leaves (the top already leaving while the last two land: the
  // full collage is never held); nothing but her and her words after the last; her shot under them at every image.
  const shots = pileShots(line, 1, "photo");
  const texts = travailMarks(line);
  const seen = Array.from({ length: 276 }, (_, f) => travailDrawn(monTravail.code, f, { durationInFrames: 275, shots, texts }));
  const on = seen.map((d) => new Set(d.works.map((w) => w.shot - 1)));
  for (let k = 0; k < 37; k++) {
    const from = on.findIndex((s) => s.has(k));
    assert.equal(from, lands[k], `work ${k + 1} lands`);
    assert.equal(on.findIndex((s, f) => f > from && !s.has(k)), leaves[k], `work ${k + 1} leaves`);
  }
  assert.equal(on.findIndex((s, f) => f > 3 && !s.has(0)), 123);
  assert.ok(!on.some((s) => s.size === 37));
  assert.ok(on.slice(245).every((s) => s.size === 0) && on[0]!.size === 0);
  assert.ok(seen.every((d) => d.order[0] === "shot0" && d.order.includes("cut0")));
  // Her shot first in the plan, its passage her last 6 s (held on its first image while her works burst in), a work's an
  // image each (a photo still, a video held on its instant), the last one two seconds (it plays them).
  assert.deepEqual([line.shots[0]!.start, line.shots[0]!.end], [0, 6]);
  assert.equal(line.marks.hold, 95);
  assert.ok(seen.every((d) => d.nodes.find((n) => n.type === "Footage" && n.props.shot === 0)!.props.at === 95));
  for (let k = 1; k < 37; k++) assert.equal(Math.round((line.shots[k]!.end - line.shots[k]!.start) * 30), 1, `shot ${k + 1}`);
  assert.equal(Math.round((line.shots[37]!.end - line.shots[37]!.start) * 30), 59);
  for (const w of seen[130]!.works) assert.equal(w.at, lands[w.shot - 1]);
  // The last six of 37 pass in front of her (her cut-out drawn before them), the others behind.
  assert.equal(frontFrom(37), 31);
  assert.equal(line.marks.front, 31);
  const order = seen[130]!.order;
  assert.ok(order.indexOf("cut0") > order.indexOf("shot31") && order.indexOf("cut0") < order.indexOf("shot32"), order.join(" "));
  // With an ending card, its landings the same, longer for the engine's 1,6 s, its words up to the card.
  const ended = monTravail.timeline(38, { end: true });
  assert.deepEqual(Array.from({ length: 37 }, (_, k) => ended.marks[`l${k}`]), lands);
  assert.ok(ended.duration - line.duration >= 1, `${ended.duration} s`);
  assert.equal(ended.texts.mots!.to, Math.round((ended.duration - 1.6) * 100) / 100);
  // At another tempo, every length in beats follows it; fewer works keep an image each and her shot the rest.
  const slower = monTravail.timeline(38, { end: false, bpm: 100 });
  assert.ok(Math.abs(slower.duration / line.duration - 1.2) < 0.01, `${slower.duration} s`);
  const few = monTravail.timeline(9, { end: false });
  assert.equal(few.shots.length, 9);
  assert.ok(few.shots.slice(1).every((s) => Math.round((s.end - s.start) * 30) >= 1) && few.marks.hold! >= 8);
});

test("« Voici mon travail » (v1): the original's boxes, square but one, behind her but the last ones, never laid on her face uncut", async () => {
  const { monTravail } = await import("./skills/mon-travail.ts");
  const line = monTravail.timeline(38, { end: false });
  const texts = travailMarks(line);
  const shots = pileShots(line, 1, "photo");
  const draw = (f: number, extra: Record<string, unknown> = {}, read: { boxes?: Record<string, TdBox> } = { boxes: { "0": { x: 300, y: 280, w: 480, h: 1560 } } }) =>
    travailDrawn(monTravail.code, f, { durationInFrames: 275, shots, texts, ...extra }, read);
  const box = (k: number) => draw(line.marks[`l${k}`]!).works.find((w) => w.shot === k + 1)!.box;
  // In the original's boxes (measured at 720 × 1280 where nothing hides them, at 1080 × 1920 here): centre within 12 px,
  // sides within 16; its 35th a 4:5, the others square; no turn, no border, no shadow.
  const measured: Record<number, [number, number, number, number]> = { 0: [348, 510, 315, 312], 2: [570, 428, 477, 476], 4: [755, 528, 391, 390], 19: [765, 1056, 414, 414], 34: [823, 1477, 345, 428], 36: [584, 1503, 364, 363] };
  for (const [k, [cx, cy, w, hh]] of Object.entries(measured)) {
    const b = box(Number(k));
    assert.ok(Math.abs(b.left + b.width / 2 - cx) <= 12 && Math.abs(b.top + b.height / 2 - cy) <= 12, `work ${Number(k) + 1}: ${JSON.stringify(b)}`);
    assert.ok(Math.abs(b.width - w) <= 16 && Math.abs(b.height - hh) <= 16, `work ${Number(k) + 1}: ${JSON.stringify(b)}`);
  }
  const shapes = Array.from({ length: 37 }, (_, k) => Math.round((box(k).width / box(k).height) * 100) / 100);
  assert.deepEqual(shapes.flatMap((a, k) => (a !== 1 ? [[k, a]] : [])), [[34, 0.8]]);
  assert.doesNotMatch(monTravail.code, /boxShadow|border:|rotate\(/);
  // On her word: each at its own shape, or all in portrait 4:5; the Reel stays vertical.
  const wide = pileShots(line, 4 / 3, "photo");
  const own = draw(130, { shots: wide, texts: { ...texts, format: "forme" } }).works.at(-1)!.box;
  assert.ok(Math.abs(own.width / own.height - 4 / 3) < 0.01, JSON.stringify(own));
  const tall = draw(130, { texts: { ...texts, format: "portrait" } }).works.at(-1)!.box;
  assert.ok(Math.abs(tall.width / tall.height - 0.8) < 0.01, JSON.stringify(tall));
  assert.deepEqual(monTravail.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["carre", "forme", "portrait"]], ["couleur", ["sienne", "pale", "original"]]]);
  // Fewer works: bigger squares on the same surface.
  const few = monTravail.timeline(16, { end: false });
  const fewDrawn = travailDrawn(monTravail.code, few.marks.l3!, { durationInFrames: Math.round(few.duration * 30), shots: pileShots(few, 1, "photo"), texts: travailMarks(few) });
  const third = fewDrawn.works.find((w) => w.shot === 4)!.box;
  assert.ok(third.width >= 480 && third.width === third.height, JSON.stringify(third));
  // Without her cut-out (none made in time), no work is laid over her face, as tracked: she stays seen.
  const tracked = { track: () => ({ hands: [], faces: [{ id: 0, x: 470, y: 560, width: 150, height: 180, points: {} }], bodies: [] }) };
  const bare = draw(60, tracked, {});
  const face = { x: 470, y: 560, w: 150, h: 180 };
  const covered = (b: { left: number; top: number; width: number; height: number }) =>
    Math.max(0, Math.min(b.left + b.width, face.x + face.w) - Math.max(b.left, face.x)) * Math.max(0, Math.min(b.top + b.height, face.y + face.h) - Math.max(b.top, face.y));
  assert.ok(bare.works.length > 0 && bare.works.every((w) => covered(w.box) <= 0.3 * face.w * face.h));
  assert.ok(draw(60, tracked).works.some((w) => covered(w.box) > 0.3 * face.w * face.h));
  // No grade: her shot and her works keep their colours; 15 works and her before Edith asks for more, 40 at most.
  assert.deepEqual(monTravail.finish, { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 });
  assert.deepEqual([monTravail.files, monTravail.shots], [[16, 41], [9, 41]]);
});

test("« Voici mon travail » (v1): her words in front, at the original's size, one a line, in her colour, off her face", async () => {
  const { monTravail } = await import("./skills/mon-travail.ts");
  const line = monTravail.timeline(38, { end: false });
  const texts = travailMarks(line);
  const reelTexts = [{ text: "Voici mon travail", role: "hook", from: 0, to: 275, emphasis: [] }];
  const draw = (f: number, extra: Record<string, unknown> = {}, read: { boxes?: Record<string, TdBox>; outlines?: Record<string, string> } = {}) =>
    travailDrawn(monTravail.code, f, { durationInFrames: 275, shots: pileShots(line, 1, "photo"), texts, reelTexts, ...extra }, read);
  const words = (d: { nodes: Drawn[] }) => d.nodes.filter((n) => n.type === "div" && styleOf(n).height === 257);
  const block = (d: { nodes: Drawn[] }) => d.nodes.find((n) => n.type === "FitText" && heldText(n).includes("TRAVAIL"))!;
  // One word a line, from the first image to the last, drawn after her works and her cut-out (in front of everything).
  for (const f of [0, 130, 274]) assert.deepEqual(words(draw(f)).map(drawnText), ["VOICI", "MON", "TRAVAIL"]);
  const flat = draw(130).nodes;
  assert.ok(flat.findIndex((n) => n.type === "FitText") > flat.findIndex((n) => n.type === "Subject"));
  assert.ok(flat.findIndex((n) => n.type === "FitText") > flat.map((n) => n.type === "Footage" && Number(n.props.shot) > 31).lastIndexOf(true));
  // Bold capitals as tall as the original's (7,3 % of the frame: a size of a tenth of it), a line every 13,4 %, centred in
  // its box, kept clear of the apps' caption and their buttons.
  const style = styleOf(words(draw(0))[0]!);
  assert.equal(style.fontSize, 192);
  assert.equal(style.fontWeight, 700);
  assert.equal(style.lineHeight, "257px");
  const b = styleOf(block(draw(0)));
  assert.deepEqual([b.left, b.width, b.top, Number(b.top) + Number(b.height)], [140, 800, 394, 1430]);
  // In her colour as it is (a soft light halo keeping it on a darker picture), a pale one deepened (its hue kept): on
  // the white walls of a workshop, a pale tint did not read. On her word a pale tint of hers, vivid, with a thin dark
  // edge, as the original's lime, or that lime itself; never its words.
  const lumOf = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  assert.equal(style.color, "#b5543a");
  assert.match(String(style.textShadow), /rgba\(255,255,255,0\.5\)/);
  const deepened = String(styleOf(words(draw(0, { brand: { name: "Atelier Terre", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#f6c8d2" } }))[0]!).color);
  assert.ok(lumOf(deepened) <= 0.22 && parseInt(deepened.slice(1, 3), 16) > parseInt(deepened.slice(3, 5), 16), deepened);
  const paleWords = styleOf(words(draw(0, { texts: { ...texts, couleur: "pale" } }))[0]!);
  const pale = String(paleWords.color);
  assert.ok(lumOf(pale) >= 0.6 && parseInt(pale.slice(1, 3), 16) > parseInt(pale.slice(5, 7), 16), `${pale}: her terracotta's hue, pale`);
  assert.match(String(paleWords.textShadow), /rgba\(0,0,0,0\.55\)/);
  assert.equal(styleOf(words(draw(0, { texts: { ...texts, couleur: "original" } }))[0]!).color, "#e7fa87");
  assert.doesNotMatch(monTravail.code, /THIS|WORK/);
  // Off her face: her face beside a short word, as the original's, leaves the block where it is; one under a line moves
  // it below her face (else above it).
  const beside = { track: () => ({ hands: [], faces: [{ id: 0, x: 160, y: 770, width: 110, height: 130, points: {} }], bodies: [] }) };
  assert.equal(styleOf(block(draw(0, beside))).top, 394);
  const under = { track: () => ({ hands: [], faces: [{ id: 0, x: 470, y: 420, width: 150, height: 190, points: {} }], bodies: [] }) };
  const moved = styleOf(block(draw(0, under)));
  assert.ok(Number(moved.top) >= 610 && Number(moved.top) + Number(moved.height) === 1430, JSON.stringify(moved));
  // From her cut-out when she is not tracked: her head at the top of its outline (the ceramicist of its bench, arms out
  // holding her apron's straps: her box as wide as the frame), else the top of its box.
  const head = "M 610 397 L 687 403 L 733 459 L 742 536 L 714 605 L 1075 879 L 878 1918 L 336 1411 L 127 883 L 526 511 L 548 440 Z";
  const outlined = styleOf(block(draw(0, {}, { boxes: { "0": { x: 119, y: 397, w: 960, h: 1523 } }, outlines: { "0": head } })));
  assert.equal(outlined.top, 397 + Math.round(207 * 1.3) + 38);
  const cut = styleOf(block(draw(0, {}, { boxes: { "0": { x: 330, y: 450, w: 420, h: 1400 } } })));
  assert.ok(Number(cut.top) > 394 + 100, JSON.stringify(cut));
  // More than four words: four lines at most, none ending on a word that belongs to the next.
  const long = draw(0, { reelTexts: [{ text: "mes bouquets faits main à Lyon depuis dix ans", role: "hook", from: 0, to: 275, emphasis: [] }] });
  const set = words(long).map(drawnText);
  assert.ok(set.length <= 4 && !set.slice(0, -1).some((l) => /(^| )(À|MES)$/.test(l)), set.join(" / "));
  // Its ending card over her: its title in the same capitals, a line under it, her words gone.
  const ended = monTravail.timeline(38, { end: true });
  const endFrom = Math.round(ended.duration * 30) - 48;
  const card = travailDrawn(monTravail.code, endFrom + 5, { durationInFrames: Math.round(ended.duration * 30), shots: pileShots(ended, 1, "photo"), texts: travailMarks(ended), reelTexts, end: { title: "Atelier ouvert samedi", subtitle: "de 10 h à 18 h", from: endFrom } });
  assert.deepEqual(words(card).map(drawnText), ["ATELIER", "OUVERT", "SAMEDI"]);
  assert.ok(heldText(card.tree).includes("de 10 h à 18 h") && !heldText(card.tree).includes("TRAVAIL"));
});

test("« Voici mon travail » (v1): its clicks slowing down on their measured moments, a dry knock as the collage empties, its music lighter after", async () => {
  const { monTravail } = await import("./skills/mon-travail.ts");
  const { skillPlan, skillFillInput } = await import("./skills.ts");
  const line = monTravail.timeline(38, { end: false });
  // The original's clicks from 1,6 s (images, measured on its sound, the same as pile's) and its hit at 7,962 s: each
  // within two images.
  const original = [48, 50.1, 52.1, 54.2, 56.5, 58.9, 61, 63.7, 66.7, 69.6, 72.8, 75.6, 79.4, 83, 86.7, 90.9, 95.6, 100.4, 105.5, 111.1, 117.4, 124, 131.3, 139.7, 148.7, 159.1, 170.8, 184.1, 199.6, 218.2, 238.9];
  const sounds = line.sounds!;
  assert.equal(sounds.length, original.length);
  sounds.forEach((s, i) => assert.ok(Math.abs(s.at * 30 - original[i]!) <= 2, `sound ${i + 1}: image ${s.at * 30}, the original's ${original[i]}`));
  assert.deepEqual(sounds.at(-1), { at: line.marks.hit! / 30, sound: "dry knock", seconds: 0.5, gain: 6 });
  assert.ok(!sounds.some((s) => /paper|whoosh|pop/.test(s.sound)));
  assert.deepEqual(line.music, { filters: [{ kind: "thin", from: line.marks.hit! / 30, to: line.duration }], end: { at: line.duration, fade: 0.02 } });
  // On her plan, valid: her video's passage her last 6 s at its own pace (so she is cut out at every image), each work's
  // an image, its sounds and its music's shape; a work's video on its best instant.
  const files = [{ id: "her", photo: false, seconds: 9, moments: [{ start: 1, end: 8 }] }, ...Array.from({ length: 36 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 })), { id: "v", photo: false, seconds: 5 }];
  const fill = { shots: files.map((f) => ({ file: f.id, at: f.id === "her" ? 1 : f.id === "v" ? 2 : 0 })), texts: { mots: "Voici mon travail" }, end: null };
  const plan = skillPlan({ skill: monTravail, name: "Voici mon travail", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const her = plan.segments[0] as ClipSegment;
  assert.deepEqual([her.clip_id, her.in, her.out, her.speed], ["her", 1, 7, undefined]);
  assert.ok(plan.segments.slice(1, -1).every((s) => Math.round(segmentSeconds(s) * 30) === 1));
  const last = plan.segments.at(-1) as ClipSegment;
  assert.deepEqual([last.clip_id, last.in, last.speed], ["v", 2, undefined]);
  assert.equal(plan.sounds?.length, 31);
  assert.deepEqual(plan.music_shape, { filters: [{ kind: "thin", from: 8, to: plan.duration, open: 0.02 }], end: { at: plan.duration, fade: 0.02 } });
  assert.deepEqual(plan.skill, { key: "mon-travail", version: 1 });
  assert.equal(plan.layers![0]!.motion.texts!.front, "31");
  // The filler sees her shot first, then her works, and her words' slot.
  const input = skillFillInput({ skill: monTravail, name: "Voici mon travail", n: 38, files, business: {}, request: "voici mon travail" });
  assert.match(input.cases[0]!.veut, /debout dans son lieu/);
  assert.match(input.cases[1]!.veut, /première photo de son travail/);
  assert.match(input.cases[33]!.veut, /devant ses jambes/);
  assert.deepEqual(input.textes.map((t) => [t.slot, "max_caracteres" in t ? t.max_caracteres : null]), [["mots", 26]]);
});

// ——— « La pièce qui se rallume » v1, Tristan's own idea written as a design (docs/fiches/rallume.md) ——————————————————

/** Its shots as a composition gets them, on its timeline, all of one shape. */
const rallumeShots = (line: { shots: { start: number; end: number }[] }, aspect = 16 / 9) =>
  line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
/** What it lights at a frame: for each object drawn at its own light seen through its lit pieces' soft ovals (v2), its name and the number of pieces lit. */
const litPieces = (tree: Drawn) =>
  drawnNodes(tree)
    .filter((n) => n.type === "div" && /^brightness\(1\.18\)/.test(String(styleOf(n).filter ?? "")))
    .map((n) => {
      const cut = drawnNodes(n).find((m) => m.type === "div" && /radial-gradient\(ellipse/.test(String(styleOf(m).maskImage ?? "")))!;
      return [String(drawnNodes(cut).find((m) => m.type === "Subject")?.props.object), (String(styleOf(cut).maskImage).match(/radial-gradient\(/g) ?? []).length] as const;
    });
/** The filter its room shot is drawn with (empty: as filmed). */
const filmTone = (tree: Drawn) => String(styleOf(drawnNodes(tree).find((n) => n.type === "Footage")!).filter ?? "");

test("« La pièce qui se rallume » (v1): its lights on its beats faster and faster, the whole room on the downbeat, off at the end, at 96 BPM", async () => {
  const { rallume } = await import("./skills/rallume.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(rallume.version, 2);
  assert.equal(rallume.bpm, 96);
  const beat = 60 / 96;
  const line = rallume.timeline(10, { end: false });
  // Its room shot two bars long, then the life of her place in shots of 1, 1 and 2 beats, then her room once more for
  // three beats: every cut on a beat (on the image nearest to it).
  const beats = [0, 8, 9, 10, 12, 13, 14, 16, 17, 18];
  assert.equal(line.shots.length, beats.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(s.start - beats[i]! * beat) <= 1 / 30 + 0.005, `shot ${i + 1}: ${s.start} s, beat ${beats[i]}`));
  assert.ok(Math.abs(line.duration - 21 * beat) < 0.02, `${line.duration} s`);
  // Its eight lights on beats 0, 1, 1,5, 2, 2,5, 2,75, 3 and 3,25 (faster and faster), the whole room on beat 4, off on beat 20.
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((k) => line.marks[`step_${k}`]), [0, 1, 1.5, 2, 2.5, 2.75, 3, 3.25].map((b) => Math.round(b * beat * 30)));
  assert.equal(line.marks.all, 75);
  assert.equal(line.marks.off, 375);
  // Her name and its line from the moment the room lights up to the end (its code keeps them as its format does).
  assert.deepEqual(line.texts, { nom: { from: 2.5, to: line.duration }, ligne: { from: 2.5, to: line.duration } });
  // A soft click on each light, a heavier one when the room comes on and when it goes off, on their own images.
  assert.deepEqual(line.sounds!.map((s) => [Math.round(s.at * 30), s.sound]), [
    ...[0, 19, 28, 38, 47, 52, 56, 61].map((f) => [f, "light switch click"]),
    [75, "heavy light switch clunk"],
    [375, "heavy light switch clunk"],
  ]);
  assert.ok(line.sounds![8]!.gain! > line.sounds![1]!.gain!);
  // Its music muffled while the room is dark, open at once on its light, muffled again when it goes off, cut with it.
  assert.deepEqual(line.music, { filters: [{ kind: "muffled", from: 0, to: 2.5, open: 0.02 }, { kind: "muffled", from: 12.5, to: line.duration }], end: { at: line.duration } });
  // Fewer files, a shorter life of her place; a length she asks for, more of it held two beats, up to about 30 s.
  assert.ok(Math.abs(rallume.timeline(6, { end: false }).duration - 16 * beat) < 0.02);
  assert.ok(Math.abs(rallume.timeline(14, { end: false }).duration - 27 * beat) < 0.02);
  const longest = rallume.timeline(24, { end: false });
  assert.ok(longest.duration <= 30 && longest.duration > 29, `${longest.duration} s`);
  assert.equal(Math.round((longest.shots[20]!.end - longest.shots[20]!.start) / beat), 2);
  // With an ending card, her room stays dark three beats (the card's 1,6 s), its cuts and its lights the same.
  const ended = rallume.timeline(10, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(Math.abs(ended.duration - line.duration - 2 * beat) < 0.02 && ended.duration - ended.marks.off! / 30 >= 1.6, `${ended.duration} s`);
  assert.equal(ended.marks.off, line.marks.off);
  // At another tempo, all of it follows its beats.
  const slower = rallume.timeline(10, { end: false, bpm: 80 });
  assert.ok(Math.abs(slower.marks.all! / line.marks.all! - 96 / 80) < 0.02 && Math.abs(slower.marks.off! / line.marks.off! - 96 / 80) < 0.01);
  // On the plan, for every count it takes, with or without its card: valid, 45 s at most, its texts, sounds and music.
  for (let n = rallume.shots[0]; n <= rallume.long!; n++) {
    for (const end of [false, true]) {
      const files = Array.from({ length: Math.max(4, Math.ceil(n / 3)) }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 16 }));
      const plan = skillPlan({ skill: rallume, name: "La pièce qui se rallume", files, fill: { shots: Array.from({ length: n }, (_, i) => ({ file: files[i % files.length]!.id, at: Math.floor(i / files.length) * 5 })), texts: { nom: "Le Comptoir", ligne: "bar à vins" }, end: end ? { title: "Ouvert dès 18 h" } : null } });
      const parsed = editPlanSchema.safeParse(plan);
      assert.ok(parsed.success, `n=${n} end=${end}: ${parsed.success ? "" : parsed.error.message.slice(0, 300)}`);
      assert.ok(plan.duration <= 45 && plan.segments.length === n && plan.texts.length === 2);
      assert.equal(plan.sounds?.length, 10);
      assert.equal(plan.music_shape?.filters?.length, 2);
    }
  }
});

test("« La pièce qui se rallume » (v1): dark, then her things lit one by one at their own light, all at once, her name like a sign, off at the end", async () => {
  const { rallume } = await import("./skills/rallume.ts");
  const { skillCode } = await import("./skills.ts");
  const line = rallume.timeline(10, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const reelTexts = [
    { text: "Le Comptoir", role: "hook", from: 75, to: 394, emphasis: [] },
    { text: "bar à vins", role: "caption", from: 75, to: 394, emphasis: [] },
  ];
  const props = (extra: Record<string, unknown> = {}) => ({ width: 1080, height: 1920, durationInFrames: 394, brand: { name: "Le Comptoir", displayFont: "Instrument Serif", bodyFont: "Inter Tight" }, shots: rallumeShots(line), reelTexts, end: null, texts: marks, ...extra });
  // Ten lamps across its 16:9 picture (and two cut off by its edges, which never count), three bottles under them.
  const lamps = [-80, ...Array.from({ length: 10 }, (_, i) => 60 + i * 100), 1100].map((x) => ({ x, y: 40, w: 60, h: 90 }));
  const bottles = [300, 500, 700].map((x) => ({ x, y: 300, w: 30, h: 110 }));
  const read = { parts: { "0#every pendant lamp": lamps, "0#every bottle": bottles } };
  const code = skillCode(rallume, { lampes: "every pendant lamp", rangees: "every bottle" });
  const draw = (f: number, r: Parameters<typeof drawCutOuts>[3] = read, extra: Record<string, unknown> = {}, c = code) => drawCutOuts(c, f, props(extra), r);
  // The room dark from its first image (a fifth of its light, cooler); its first two lamps already on (13 pieces on 8 steps).
  assert.equal(filmTone(draw(0)), "brightness(0.240) saturate(0.7)");
  assert.ok(drawnNodes(draw(0)).some((n) => styleOf(n).mixBlendMode === "multiply"));
  assert.deepEqual(litPieces(draw(0)), [["every pendant lamp", 2]]);
  // Then more of them on each step, what is lit staying lit: the lamps first, then the bottles.
  assert.deepEqual(litPieces(draw(30)), [["every pendant lamp", 5]]);
  assert.deepEqual(litPieces(draw(55)), [["every pendant lamp", 10]]);
  assert.deepEqual(litPieces(draw(58)), [["every pendant lamp", 10], ["every bottle", 2]]);
  assert.deepEqual(litPieces(draw(74)), [["every pendant lamp", 10], ["every bottle", 3]]);
  // Each piece at its own light, never pushed into white, and a bloom of its own highlights blurred in screen (no glow
  // drawn round its shape: its brass cap lit like a sticker); a warm pool spilling from each, in screen.
  const layers = drawnNodes(draw(30)).filter((n) => n.type === "div" && /^(brightness|contrast)\(/.test(String(styleOf(n).filter ?? "")));
  assert.deepEqual(layers.map((n) => [styleOf(n).filter, styleOf(n).mixBlendMode ?? null]), [["brightness(1.18) saturate(1.1)", null], ["contrast(2.6) brightness(1.1) blur(12px)", "screen"]]);
  assert.ok(layers.every((n) => drawnNodes(n).some((m) => m.type === "Subject" && m.props.object === "every pendant lamp")));
  const pools = drawnNodes(draw(30)).find((n) => styleOf(n).mixBlendMode === "screen")!;
  assert.equal((String(styleOf(pools).background).match(/radial-gradient/g) ?? []).length, 5);
  // A lamp's pool flickers on as a bulb does: half, too bright, a little less, itself.
  const alpha = (f: number) => Number(/rgba\(255,206,146,([\d.]+)\)/.exec(String(styleOf(drawnNodes(draw(f)).find((n) => styleOf(n).mixBlendMode === "screen")!).background))![1]);
  assert.deepEqual([0, 1, 2, 3].map(alpha), [0.25, 0.675, 0.425, 0.5]);
  // The whole room at once on the beat: two images brighter, a warm veil, then as filmed; nothing cut out any more (its
  // own light takes over), the pools of all its pieces fading over ten images.
  assert.equal(filmTone(draw(75)), "brightness(1.3)");
  assert.equal(filmTone(draw(76)), "brightness(1.12)");
  assert.equal(filmTone(draw(77)), "");
  assert.ok(drawnNodes(draw(75)).some((n) => styleOf(n).mixBlendMode === "screen" && styleOf(n).background === "#fff1dc"));
  const cutOuts = (f: number) => drawnNodes(draw(f)).filter((n) => n.type === "Subject").length;
  assert.deepEqual([74, 75, 120].map(cutOuts), [4, 0, 0]);
  assert.deepEqual([75, 80].map(alpha), [0.5, 0.25]);
  assert.equal(drawnNodes(draw(85)).filter((n) => styleOf(n).mixBlendMode === "screen").length, 0);
  // Her name catches like a neon with it (off, on, almost off, on, half, on), above its 16:9 picture on the black,
  // its small line under it as a label; both lit to the end, the room off too.
  const nameOf = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "FitText" && heldText(n).includes("Le Comptoir"));
  const glowOf = (f: number) => { const n = nameOf(draw(f)); return n ? Number((n.props.innerStyle as Record<string, number>).opacity) : 0; };
  assert.deepEqual([74, 75, 76, 77, 78, 79, 80].map(glowOf), [0, 0, 1, 0.3, 1, 0.55, 1]);
  const box = nameOf(draw(120))!.props.style as { left: number; top: number; width: number; height: number };
  assert.ok(box.top >= 80 && box.top + box.height <= 656 - 30 && box.left === 140 && box.width === 800, JSON.stringify(box));
  assert.match(String((nameOf(draw(120))!.props.innerStyle as Record<string, string>).textShadow), /rgba\(255,176,92/);
  const label = drawnNodes(draw(120)).find((n) => n.type === "FitText" && heldText(n).includes("bar à vins"))!;
  assert.ok(drawnNodes(label).some((n) => "data-fauve-accent" in n.props));
  assert.ok((label.props.style as { top: number }).top >= 656 + 608);
  assert.ok(nameOf(draw(200)) && nameOf(draw(380)));
  // Off at once on its beat, back to the dark of its opening (its end loops into its beginning).
  assert.equal(filmTone(draw(374)), "");
  assert.equal(filmTone(draw(375)), "brightness(0.240) saturate(0.7)");
  // Few things (three lamps): one a step, then the room's own light back a notch on each step left, with a flicker.
  const few = { parts: { "0#every pendant lamp": lamps.slice(1, 4) } };
  assert.deepEqual(litPieces(draw(30, few)), [["every pendant lamp", 3]]);
  assert.deepEqual([37, 38, 39, 40, 47].map((f) => filmTone(draw(f, few))), ["brightness(0.240) saturate(0.7)", "brightness(0.540) saturate(0.7)", "brightness(0.380) saturate(0.7)", "brightness(0.280) saturate(0.7)", "brightness(0.580) saturate(0.7)"]);
  // Nothing named (nothing in her room shot to light): the room comes back notch by notch, then all at once.
  assert.deepEqual([0, 1, 2].map((f) => filmTone(draw(f, {}, {}, rallume.code))), ["brightness(0.540) saturate(0.7)", "brightness(0.380) saturate(0.7)", "brightness(0.280) saturate(0.7)"]);
  assert.deepEqual(litPieces(draw(30, {}, {}, rallume.code)), []);
  assert.equal(filmTone(draw(75, {}, {}, rallume.code)), "brightness(1.3)");
});

test("« La pièce qui se rallume » (v1): horizontal 16:9 on black when her videos are, full frame otherwise or on her word; her colour; nothing cut out but her things", async () => {
  const { rallume } = await import("./skills/rallume.ts");
  const { skillCode, skillPlan, skillFillInput, skillSettings, readSkillFill } = await import("./skills.ts");
  const { objectsDrawn, drawsSubject, clearsDrawn, objectPassages, OBJECT_MAX } = await import("./subject.ts");
  const { checkMotionCode } = await import("./motion-scene.ts");
  const line = rallume.timeline(10, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const reelTexts = [{ text: "Le Comptoir", role: "hook", from: 75, to: 394, emphasis: [] }];
  const draw = (aspect: number, f: number, extra: Record<string, string> = {}, brand: Record<string, string> = {}) =>
    drawCutOuts(rallume.code, f, { width: 1080, height: 1920, durationInFrames: 394, brand: { name: "Le Comptoir", displayFont: "Instrument Serif", bodyFont: "Inter Tight", ...brand }, shots: rallumeShots(line, aspect), reelTexts, end: null, texts: { ...marks, ...extra } });
  const frameOf = (tree: Drawn) => {
    const box = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden" && styleOf(n).backgroundColor === "#000000")!;
    return { top: styleOf(box).top, height: styleOf(box).height };
  };
  const nameOf = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "FitText" && heldText(n).includes("Le Comptoir"));
  // Her videos in width: its 16:9 frame in the middle; upright ones: the whole frame; her setting both ways.
  assert.deepEqual(frameOf(draw(16 / 9, 120)), { top: 656, height: 608 });
  assert.deepEqual(frameOf(draw(9 / 16, 120)), { top: 0, height: 1920 });
  assert.equal(frameOf(draw(16 / 9, 120, { format: "vertical" })).height, 1920);
  assert.equal(frameOf(draw(9 / 16, 120, { format: "horizontal" })).top, 656);
  // Full frame: her name in the calm part of her room shot (here ClearBox's place for it, high in the frame), in the
  // safe zone; gone with the cut, back in the dark at the end.
  const tall = nameOf(draw(9 / 16, 120))!.props.style as { left: number; top: number; width: number; height: number };
  assert.deepEqual(tall, { position: "absolute", left: 140, top: 288, width: 800, height: 195 });
  assert.equal(nameOf(draw(9 / 16, 200)), undefined);
  assert.ok(nameOf(draw(9 / 16, 376)));
  // Her colour's light on her word, its tube a pale tint of it; a colour too pale to glow keeps the warm white.
  const style = (tree: Drawn) => nameOf(tree)!.props.innerStyle as Record<string, string>;
  const hers = style(draw(16 / 9, 120, { couleur: "sienne" }, { accent: "#7a2e8c" }));
  assert.equal(hers.color, "rgb(218,196,223)");
  assert.match(hers.textShadow!, /rgba\(122,46,140/);
  assert.equal(style(draw(16 / 9, 120, { couleur: "sienne" }, { accent: "#f4efe6" })).color, "#fff3df");
  assert.equal(style(draw(16 / 9, 120, {}, { accent: "#7a2e8c" })).color, "#fff3df");
  assert.deepEqual(rallume.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]], ["couleur", ["chaude", "sienne"]]]);
  assert.deepEqual(skillSettings(rallume, [{ name: "format", value: "auto" }, { name: "couleur", value: "sienne" }]), { couleur: "sienne" });
  // Its objects: up to four kinds of her things in her room shot, named by the filler; nothing named, nothing followed.
  assert.deepEqual(checkMotionCode(rallume.code), []);
  assert.deepEqual(objectsDrawn(rallume.code), []);
  const named = skillCode(rallume, { lampes: "every pendant lamp", rangees: "every bottle", tables: "every cup", plantes: "every plant" });
  assert.deepEqual(objectsDrawn(named).map((o) => [o.shot, o.name]), [[0, "every pendant lamp"], [0, "every bottle"], [0, "every cup"], [0, "every plant"]]);
  assert.ok(objectsDrawn(named).length <= OBJECT_MAX);
  // Nobody cut out (only her things), its name set in the clear part of its room shot, no zoom, no push.
  assert.equal(drawsSubject(named), false);
  assert.deepEqual(clearsDrawn(rallume.code), [0]);
  assert.doesNotMatch(rallume.code, /transform|scale\(/);
  assert.deepEqual(rallume.finish, { grain: 0, vignette: 0 });
  // The filler sees its object slots on its first shot, and its answer is kept by slot; on the plan, its four objects
  // are followed on her room shot's passage, within a Reel's 20 s of followed video at its own tempo.
  const files = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 16, shows: i ? "des gens au comptoir" : "la salle du bar le soir, ses suspensions allumées" }));
  const input = skillFillInput({ skill: rallume, name: "La pièce qui se rallume", n: 10, files, business: {}, request: "" });
  assert.deepEqual(input.objets?.map((o) => [o.slot, o.case]), [["lampes", 1], ["rangees", 1], ["tables", 1], ["plantes", 1]]);
  assert.equal(input.textes.find((t) => t.slot === "ligne")?.obligatoire, false);
  const fill = readSkillFill(rallume, files, 10, { fits: true, missing: "", shots: files.map((f) => ({ file: f.id, at: 0.5 })), texts: [{ slot: "nom", text: "Le Comptoir" }], end: null, objets: [{ slot: "lampes", name: "every pendant lamp" }, { slot: "rangees", name: "every bottle" }, { slot: "tables", name: "every cup" }, { slot: "plantes", name: "every plant" }], why: "" })!;
  assert.deepEqual(fill.objects, { lampes: "every pendant lamp", rangees: "every bottle", tables: "every cup", plantes: "every plant" });
  const plan = skillPlan({ skill: rallume, name: "La pièce qui se rallume", files, fill });
  const passages = objectPassages(plan, () => true);
  assert.equal(passages.length, 4);
  assert.ok(passages.every((p) => p.clip_id === "v0" && p.from === 0.5 && p.to === 5.5), JSON.stringify(passages));
  assert.deepEqual(plan.skill, { key: "rallume", version: 2 });
  // Written as a design, without a reference Reel: no original kept, so no sheets of one, whatever its measures.
  const { HOUSE_DESIGNS, houseSheets } = await import("./house-sheets.ts");
  assert.ok(HOUSE_DESIGNS.has("rallume"));
  assert.deepEqual(houseSheets("rallume"), []);
});

// ——— What else is read on her shots (shot_read.py, depth_video.py) and her files (video_read.py), for any skill ——————————

test("readings of her shots: the tools a composition names ask for them, a photo once, a video at its own pace, a ground within its budget", async () => {
  const { ANY_SHOT, drawsSubject, groundKey, GROUND_MAX, GROUND_MAX_SECONDS, objectsDrawn, readKey, readPassages, readsDrawn, wantsReads } = await import("./subject.ts");
  // As kept (compiled by sucrase) and as JSX; each tool reads its own thing; a variable is every shot under the animation.
  const code = `React.createElement(Skyline, { shot: 1, style: laid }); const y = SkylineAt(shots[2], frame, laid, { from: 0, to: 540 });
    const v = VanishingPoint(shots[1], frame, laid, { fallback: null }); const l = LightUnder( 3 , frame, laid, box); <Skyline shot={shots[2]} />`;
  assert.deepEqual(readsDrawn(code), [
    { shot: 1, kinds: ["ground", "vanish"] },
    { shot: 2, kinds: ["ground", "sky"] },
    { shot: 3, kinds: ["light"] },
  ]);
  assert.deepEqual(readsDrawn(`LightUnder(shots[k], frame, laid)`), [{ shot: ANY_SHOT, kinds: ["light"] }]);
  assert.deepEqual(readsDrawn(`ClearBox(shots[1], frame, laid)`), []);
  // Never her cut-out nor an object: Skyline is not Subject.
  assert.equal(drawsSubject(code), false);
  assert.deepEqual(objectsDrawn(code), []);
  const plan = {
    segments: [
      { clip_id: "v0", in: 0, out: 2 },
      { clip_id: "v1", in: 1, out: 4 },
      { clip_id: "photo1", in: 0, out: 2, photo: { source: { width: 4, height: 3 } } },
      { clip_id: "v2", in: 0, out: 3, speed: 0.5 },
    ],
    layers: [{ from: 0, to: 10, brief: "", compose: true, motion: { js: code } }],
  } as never;
  assert.equal(wantsReads(plan), true);
  assert.equal(wantsReads({ layers: [{ from: 0, to: 2, brief: "", motion: { js: `SubjectBox(shots[0], f)` } }] } as never), false);
  // Its photo once (from 0 to 0), the shot at half speed left out (the tools give their fallback there).
  assert.deepEqual(readPassages(plan, (id) => id.startsWith("v")), [
    { clip_id: "v1", from: 1, to: 4, key: readKey("v1", 1, 4), kinds: ["ground", "vanish"] },
    { clip_id: "photo1", from: 0, to: 0, key: readKey("photo1", 0, 0), kinds: ["ground", "sky"], photo: true },
  ]);
  assert.match(readKey("v1", 1, 4), /^v1@1\.00-4\.00~read$/);
  assert.match(groundKey("v1", 1, 4), /^v1@1\.00-4\.00~ground$/);
  // Past its budget, a ground is its skyline only: SkylineAt still reads it, Skyline draws nothing.
  const long = {
    segments: Array.from({ length: 6 }, (_, i) => ({ clip_id: `v${i}`, in: 0, out: 6 })),
    layers: [{ from: 0, to: 36, brief: "", compose: true, motion: { js: Array.from({ length: 6 }, (_, i) => `<Skyline shot={${i}} />`).join("") } }],
  } as never;
  const kinds = readPassages(long, () => true).map((p) => p.kinds.join(","));
  const grounds = kinds.filter((k) => k.includes("ground")).length;
  assert.ok(grounds <= GROUND_MAX && grounds * 6 <= GROUND_MAX_SECONDS && grounds >= 1, kinds.join(" | "));
  assert.ok(kinds.slice(grounds).every((k) => k === "sky"), kinds.join(" | "));
});

test("readings of her shots: kept as a file beside the clip and its ground as a cut-out, given to the render on their shot", async () => {
  const { groundKey, mediaSubjectsSchema, readKey, shotReadingSchema, subjectFiles, fileKey } = await import("./subject.ts");
  const reading = {
    motion: [1, 0, 0, 1, -0.01, 0],
    sky: { share: 0.4, profile: Array.from({ length: 64 }, (_, i) => (i < 32 ? 0.5 : 0.3)) },
    vanish: { x: 0.6, y: 0.5, strength: 0.7 },
    light: { cols: 2, rows: 2, cells: "ff800000", mean: 0.4, high: 0.9 },
  };
  assert.ok(shotReadingSchema.safeParse(reading).success);
  assert.equal(shotReadingSchema.safeParse({ ...reading, light: { ...reading.light, cells: "ff80" } }).success, false);
  // Its entries are readings like the others (the retention removes their files); a file's own readings have no file.
  const kept = {
    [readKey("v1", 1, 4)]: { path: "s/subjects/v1-a.read.json", still: false, at: "x", frames: 90, read: true },
    [groundKey("v1", 1, 4)]: { path: "s/subjects/v1-b.webm", still: false, at: "x", frames: 90, ground: true },
    [fileKey("v1")]: { file: { moves: [{ from: 1, to: 1.3, kind: "whip", towards: "right", speed: 0.2 }], covered: [], colour: { score: 40, words: "colorée" } }, at: "x" },
  };
  assert.ok(mediaSubjectsSchema.safeParse(kept).success);
  assert.deepEqual(subjectFiles(kept), ["s/subjects/v1-a.read.json", "s/subjects/v1-b.webm"]);
  const plan = {
    format: "9:16",
    duration: 3,
    template: "libre",
    segments: [{ clip_id: "v1", in: 1, out: 4, zoom: "none" }],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    layers: [{ from: 0, to: 3, brief: "", compose: true, motion: { js: `function Scene({ shots }) { return h(Skyline, { shot: 0 }); }` } }],
  } as never;
  const props = buildReelProps(plan, {
    template: "libre",
    clipUrls: { v1: "https://x/v1.mp4" },
    brand: { name: "Studio" },
    subjects: { [readKey("v1", 1, 4)]: { src: "", reading }, [groundKey("v1", 1, 4)]: { src: "https://x/v1-ground.webm" } },
  } as never);
  assert.deepEqual(props.layers?.[0]?.shots?.[0]?.read, reading);
  const segment = props.segments[0] as { ground?: unknown; subject?: unknown; objects?: unknown };
  assert.deepEqual(segment.ground, { src: "https://x/v1-ground.webm" });
  assert.equal(segment.subject, undefined);
  assert.equal(segment.objects, undefined);
  // A shot at another speed has none (its images are not those read).
  const slow = buildReelProps({ ...(plan as object), segments: [{ clip_id: "v1", in: 1, out: 4, zoom: "none", speed: 0.5 }] } as never, {
    template: "libre",
    clipUrls: { v1: "https://x/v1.mp4" },
    brand: { name: "Studio" },
    subjects: { [readKey("v1", 1, 4)]: { src: "", reading }, [groundKey("v1", 1, 4)]: { src: "https://x/v1-ground.webm" } },
  } as never);
  assert.equal(slow.layers?.[0]?.shots?.[0]?.read, undefined);
  assert.equal((slow.segments[0] as { ground?: unknown }).ground, undefined);
});

test("her skyline, her vanishing point, her light: placed where the Reel draws the shot, moving with its camera", async () => {
  const { affineOf, withCamera } = await import("../../../apps/render/src/clear.ts");
  const { lightIn, movedAt, readingPlace, skylineIn, vanishIn } = await import("../../../apps/render/src/reading.ts");
  // A 16:9 shot laid in a 1080 × 608 box: its sky ends at 50 % of its height on the left half, 30 % on the right.
  const reading = {
    sky: { share: 0.4, profile: Array.from({ length: 64 }, (_, i) => (i < 32 ? 0.5 : 0.3)) },
    vanish: { x: 0.6, y: 0.5, strength: 0.7 },
    light: { cols: 2, rows: 2, cells: "ff800000", mean: 0.4, high: 0.9 },
  };
  const place = affineOf(cover(16 / 9, WIDE));
  assert.equal(Math.round(skylineIn(reading, place, 0, 500)!), 304);
  assert.equal(Math.round(skylineIn(reading, place)!), Math.round(0.3 * 608));
  assert.equal(skylineIn(reading, place, 2000, 3000), null);
  assert.equal(skylineIn({ ...reading, sky: { share: 0, profile: reading.sky.profile } }, place), null);
  const point = vanishIn(reading, place)!;
  assert.ok(Math.abs(point.x - 0.6 * 1080) < 0.5 && Math.abs(point.y - 304) < 0.5, JSON.stringify(point));
  assert.equal(vanishIn(reading, place, 0.8), null);
  assert.equal(vanishIn({ vanish: null }, place), null);
  // Its light: the top left cell white, the top right half grey, the bottom black; under a box, its cells' mean.
  assert.deepEqual(lightIn(reading, place, { x: 0, y: 0, w: 540, h: 304 }), { mean: 1, high: 1 });
  assert.equal(lightIn(reading, place, null, WIDE)!.mean, Math.round(((255 + 128) / 4 / 255) * 1000) / 1000);
  assert.equal(lightIn(reading, place, { x: 2000, y: 0, w: 10, h: 10 }), null);
  // The camera pans right (the scene moves left by 10 % of the picture over 31 images): its point follows the scene.
  const moving = { ...reading, motion: Array.from({ length: 31 }, (_, t) => [1, (-0.1 * t) / 30, 0]).flat() };
  assert.deepEqual(movedAt(moving.motion, 30), [1, -0.1, 0]);
  const first = vanishIn(moving, readingPlace(moving, place, 0))!;
  const last = vanishIn(moving, readingPlace(moving, place, 30))!;
  assert.ok(Math.abs(first.x - last.x - 108) < 0.5 && Math.abs(first.y - last.y) < 0.01, JSON.stringify([first, last]));
  assert.deepEqual(readingPlace(moving, place, 30), withCamera(place, [1, -0.1, 0]));
});

/** Tracks of a face whose nose drops against its ears from image 10 to 20, rises back from 40 to 50, and turns right from 70 to 80 (body points, facing the camera). */
function headTracks() {
  const frames = Array.from({ length: 100 }, (_, t) => {
    const down = t < 10 ? 0 : t < 20 ? (t - 10) / 10 : t < 40 ? 1 : t < 50 ? 1 - (t - 40) / 10 : 0;
    const turn = t < 70 ? 0 : t < 80 ? (t - 70) / 10 : 1;
    const points = Array.from({ length: 33 }, () => [500, 500, 0]);
    // Its ears level, 100 thousandths apart; its nose 20 below them, 50 more when lowered, 60 to the right when turned.
    points[7] = [550, 300, 95];
    points[8] = [450, 300, 95];
    points[0] = [500 + 60 * turn, 320 + 50 * down, 95];
    return { b: [[1, ...points.flat()]] };
  });
  return { fps: 30, w: 1000, h: 1000, from: 0, n: frames.length, frames };
}

test("a head gesture measured and named: lowered, raised, turned, the same for the designer, the filler and a composition", async () => {
  const { headMoveFrames, headMoves } = await import("./tracking.ts");
  const { headMovesOf } = await import("../../../apps/render/src/reading.ts");
  const file = headTracks();
  const frames = headMoveFrames(file.frames, 1);
  assert.deepEqual(frames.map((m) => m.what), ["down", "up", "right"]);
  assert.ok(frames[0]!.from >= 8 && frames[0]!.from <= 14 && frames[0]!.to >= 18 && frames[0]!.to <= 22, JSON.stringify(frames[0]));
  assert.ok(frames[1]!.from >= 38 && frames[1]!.to <= 52, JSON.stringify(frames[1]));
  assert.ok(frames[2]!.from >= 68 && frames[2]!.to <= 82, JSON.stringify(frames[2]));
  // The render's mirror reads the same moves (a composition times its effect on them with HeadMoves).
  assert.deepEqual(headMovesOf(file.frames, 1, 30), frames);
  // In words and seconds, like the hands' moves.
  const words = headMoves({ fps: 30, from: 0, frames: file.frames, aspect: 1 });
  assert.deepEqual(words.map((m) => m.what), ["la tête se baisse", "la tête se relève", "la tête tourne vers la droite de l'image"]);
  assert.ok(Math.abs(words[0]!.start - frames[0]!.from / 30) < 0.06, JSON.stringify(words[0]));
  // A still head says nothing; a head seen from behind (its ears hidden) neither.
  const still = { frames: file.frames.map(() => ({ b: [[1, ...Array.from({ length: 33 }, (_, k) => (k === 0 ? [500, 320, 95] : k === 7 ? [550, 300, 95] : k === 8 ? [450, 300, 95] : [500, 500, 0])).flat()]] })) };
  assert.deepEqual(headMoveFrames(still.frames, 1), []);
  const behind = { frames: file.frames.map((row) => ({ b: row.b.map((b) => b.map((v, i) => (i === 3 + 3 * 7 || i === 3 + 3 * 8 ? 10 : v))) })) };
  assert.deepEqual(headMoveFrames(behind.frames, 1), []);
});

test("a head gesture: HeadMoves gives a composition its frames, the shot's own moment and speed taken in", async () => {
  const { shotHeadMoves: HeadMoves } = await import("../../../apps/render/src/reading.ts");
  const file = headTracks();
  // The shot shows the clip from its image 30 at its own speed, from frame 100 of the composition, for 60 frames.
  const shot = {
    src: "/v.mp4",
    aspect: 1,
    segment: 0,
    from: 100,
    durationInFrames: 60,
    kind: "video" as const,
    track: { startFrom: 30, look: { aspect: 1 }, tracks: { fps: 30, from: 0, aspect: 1, frames: file.frames } },
  };
  const moves = HeadMoves(shot);
  // Its raise (images 40 to 50 of the clip) at frames 110 to 120, its turn (70 to 80) at 140 to 150; its lowering, before the shot, left out.
  assert.deepEqual(moves.map((m) => m.what), ["up", "right"]);
  assert.ok(moves[0]!.from >= 108 && moves[0]!.to <= 122, JSON.stringify(moves));
  assert.ok(moves[1]!.from >= 138 && moves[1]!.to <= 152, JSON.stringify(moves));
  assert.deepEqual(HeadMoves({ ...shot, track: undefined }), []);
});

test("her depth as a mask: the shots a composition rebuilds with Near, read on the card, given to the render on their shot", async () => {
  const { DEPTH_MAX, depthsDrawn, nearKey, nearPassages, nearsDrawn, NEAR_MAX_SECONDS, wantsNear } = await import("./subject.ts");
  const code = `React.createElement(Near, { shot: 1, depth: interpolate(frame, [0, 30], [0, 1]), style: laid }) <Near shot={shots[2]} depth={0.4} />`;
  assert.deepEqual(nearsDrawn(code).sort(), [1, 2]);
  assert.deepEqual(nearsDrawn(`<Near shot={i} />`), []);
  // Not the grey pass: Depth is read on its own.
  assert.deepEqual(depthsDrawn(code), []);
  const plan = {
    segments: [
      { clip_id: "photo1", in: 0, out: 2 },
      { clip_id: "v1", in: 1, out: 4 },
      { clip_id: "v2", in: 0, out: 3, speed: 0.5 },
    ],
    layers: [{ from: 0, to: 9, brief: "", compose: true, motion: { js: code } }],
  } as never;
  assert.equal(wantsNear(plan), true);
  assert.deepEqual(nearPassages(plan, (id) => id.startsWith("v")), [{ clip_id: "v1", from: 1, to: 4, key: nearKey("v1", 1, 4) }]);
  assert.match(nearKey("v1", 1, 4), /^v1@1\.00-4\.00~near$/);
  assert.ok(DEPTH_MAX >= 2 && NEAR_MAX_SECONDS >= 6);
  const props = buildReelProps(
    { format: "9:16", duration: 3, template: "libre", segments: [{ clip_id: "v1", in: 1, out: 4, zoom: "none" }], texts: [], images: [], transitions: "cut", subtitles: false, music: null } as never,
    { template: "libre", clipUrls: { v1: "https://x/v1.mp4" }, brand: { name: "Studio" }, subjects: { [nearKey("v1", 1, 4)]: { src: "https://x/v1-near.webm" } } } as never,
  );
  const shot = props.segments[0] as { near?: unknown; depthMap?: unknown };
  assert.deepEqual(shot.near, { src: "https://x/v1-near.webm" });
  assert.equal(shot.depthMap, undefined);
});

test("what the filler reads on her files: her camera's fast moves, her lens covered, her colours, her gestures, in its words", async () => {
  const { coveredWords, measuredFiles, moveWords, skillFillInput, SKILL_FILL_PROMPT } = await import("./skills.ts");
  const { fileReadingSchema } = await import("./subject.ts");
  const { coupsDeFouet } = await import("./skills/coups-de-fouet.ts");
  const { journee } = await import("./skills/journee.ts");
  const { tourne } = await import("./skills/tourne.ts");
  // The models whose slots want them ask for them.
  assert.deepEqual([coupsDeFouet.reads, journee.reads, tourne.reads], [["moves"], ["covered"], ["colour"]]);
  assert.equal(moveWords({ kind: "whip", towards: "right", speed: 0.23, from: 4.4, to: 4.8 }), "un fouet de la caméra vers la droite, flou (0,4 s, jusqu'à 23 % de l'image par image)");
  assert.equal(moveWords({ kind: "rush", towards: "in", speed: 0.05, from: 1, to: 1.5 }), "la caméra fonce en avant (0,5 s)");
  assert.match(coveredWords({ peak: 0.8, share: 0.98, enters: "right" }), /^quelque chose passe tout près de l'objectif et cache toute l'image, entre par la droite, le plus couvert à 0,8 s/);
  // As video_read.py prints them (its colour, and its moments in seconds of the file).
  const reading = fileReadingSchema.parse({
    seconds: 15,
    moves: [{ from: 4.43, to: 4.83, kind: "whip", towards: "left", speed: 0.17 }],
    covered: [{ from: 0.67, to: 0.93, peak: 0.8, share: 0.98, colour: "#775c49", dark: false, enters: "right" }],
    colour: { score: 64, words: "très colorée", best: { from: 2, to: 3, score: 80 } },
  });
  const files = [
    { id: "v1", photo: false, seconds: 15, shows: "sa rue", moments: [{ start: 0, end: 2, what: "la rue" }] },
    { id: "p1", photo: true, seconds: 0, shows: "ses fleurs" },
    { id: "v2", photo: false, seconds: 8 },
  ];
  const measured = measuredFiles(files, { v1: reading, p1: { moves: [], covered: [], colour: { score: 12, words: "presque sans couleur" } } }, { v2: [{ start: 1, end: 1.5, what: "la tête se baisse" }] });
  const input = skillFillInput({ skill: coupsDeFouet, name: "Ville en coups de fouet", n: 12, files: measured, business: {}, request: "" });
  const [v1, p1, v2] = input.fichiers as Record<string, unknown>[];
  assert.deepEqual(v1!.mouvements_rapides, [{ de: 4.43, a: 4.83, quoi: "un fouet de la caméra vers la gauche, flou (0,4 s, jusqu'à 17 % de l'image par image)" }]);
  assert.match(String((v1!.objectif_couvert as { quoi: string }[])[0]!.quoi), /cache toute l'image, entre par la droite, le plus couvert à 0,8 s/);
  assert.equal(v1!.couleur, "très colorée (64), la plus colorée de 2 à 3 s");
  assert.equal(p1!.couleur, "presque sans couleur (12)");
  assert.deepEqual(v2!.gestes_mesures, [{ de: 1, a: 1.5, quoi: "la tête se baisse" }]);
  // A file nothing was measured on is told as before; the filler is told what they are for.
  assert.deepEqual(measuredFiles(files, {}), files);
  assert.match(SKILL_FILL_PROMPT, /mouvements_rapides/);
  assert.match(SKILL_FILL_PROMPT, /objectif_couvert/);
  assert.match(SKILL_FILL_PROMPT, /couleur/);
});

test("the kit tells the motion designer the new readings, and every scope has them (carousels without Skyline nor Near)", async () => {
  const { MOTION_DESIGNER_PROMPT, MOTION_SCOPE } = await import("./motion-scene.ts");
  const { CAROUSEL_SCOPE } = await import("./carousel.ts");
  for (const name of ["Skyline", "SkylineAt", "Near", "VanishingPoint", "LightUnder", "HeadMoves"]) {
    assert.ok((MOTION_SCOPE as readonly string[]).includes(name), name);
    assert.match(MOTION_DESIGNER_PROMPT, new RegExp(`\\b${name}\\b`), name);
  }
  assert.ok(!CAROUSEL_SCOPE.includes("Skyline") && !CAROUSEL_SCOPE.includes("Near"));
});

// ——— The picture kit (apps/render/src/Picture.tsx and picture-kit.ts): image effects the models' fiches found missing ———

test("picture kit: a camera's flash overexposes the picture as measured on « a day in PARIS », a film burn lays its light in screen round a cut", async () => {
  const { burnSteps, exposeAt, rgbOf } = await import("../../../apps/render/src/picture-kit.ts");
  // « Une journée chez toi »'s flash, its film image doubled at 30 i/s (two images lit before the brightest): ×1,2 and
  // +14 % of white, ×1,35 and +18 % on the cut, ×1,18 and +13 % after, then nothing (docs/fiches/journee.md, effect 4).
  assert.deepEqual([-3, -2, -1, 0, 1, 2].map((t) => exposeAt(t, 2, 2)), [null, [1.2, 0.14], [1.2, 0.14], [1.35, 0.18], [1.18, 0.13], null]);
  // By default a single image before; half as strong; longer, its last images fading out, never darker than the picture.
  assert.deepEqual([-2, -1].map((t) => exposeAt(t)), [null, [1.2, 0.14]]);
  assert.deepEqual(exposeAt(0, 1, 2, 0.5), [1.175, 0.09]);
  const long = [1, 2, 3].map((t) => exposeAt(t, 1, 4)!);
  assert.ok(long[0]![0] > long[1]![0] && long[1]![0] > long[2]![0] && long[2]![0] > 1, JSON.stringify(long));
  // A burn from the left (its colour in screen): a glow growing from that edge, the whole picture washed just before the
  // cut in a paler colour, still washed on the new shot's first image, a rest of it in the bottom right corner after.
  const steps = burnSteps({ from: "left", color: "#ff6040" });
  assert.deepEqual(steps.map((s) => s[0]), [-4, -3, -2, -1, 0, 1]);
  assert.match(steps[0]![1], /^radial-gradient\(ellipse 45% 90% at 0% 55%, rgba\(255,96,64,0\.9\)/);
  assert.match(steps[1]![1], /^radial-gradient\(ellipse 75% 110% at 0% 55%/);
  assert.match(steps[2]![1], /^linear-gradient\(to right, rgba\(255,96,64,0\.95\)/);
  assert.deepEqual(steps.slice(3).map((s) => [s[1].slice(0, 35), s[2]]), [["#ffb7a9", 0.86], ["#ffb7a9", 0.62], ["radial-gradient(circle at 100% 100%", 1]]);
  // From a corner, in her own wash, weaker; nothing to filter under it (only steps given by hand do: Une journée's first burn).
  const corner = burnSteps({ from: "top-right", color: "#f8ecaa", wash: "#efe9b4", strength: 0.5 });
  assert.match(corner[0]![1], /at 100% 0%/);
  assert.match(corner[2]![1], /^linear-gradient\(to bottom left/);
  assert.deepEqual([corner[3]![1], corner[3]![2]], ["#efe9b4", 0.43]);
  assert.ok(steps.every((s) => s[3] === undefined));
  assert.deepEqual([rgbOf("#abc"), rgbOf("#FF6040"), rgbOf("rouge")], [[170, 187, 204], [255, 96, 64], null]);
});

test("picture kit: a punch zoom inside one shot as « Quart de tour »'s (×1,06, ×1,2, ×1,41… to ×2,3 in eight images), its lens edges' band", async () => {
  const { edgeFade, punchAt, punchCopies } = await import("../../../apps/render/src/picture-kit.ts");
  assert.deepEqual([0, 1, 2, 3, 8, 12].map((t) => Math.round(punchAt(t) * 100) / 100), [1, 1.06, 1.2, 1.41, 2.3, 2.3]);
  // Its first image wide (and before it, the shot as it is); four copies while it rushes, the first the picture itself;
  // held at ×2,3 without them once it has landed; no blur on demand.
  assert.deepEqual([punchCopies(-5), punchCopies(0)], [[], []]);
  const rushing = punchCopies(4);
  assert.deepEqual(rushing.map((c) => c.opacity), [1, 0.3, 0.3, 0.3]);
  assert.ok(rushing[0]!.scale === punchAt(4) && rushing[3]!.scale > rushing[1]!.scale, JSON.stringify(rushing));
  assert.deepEqual(punchCopies(10), [{ scale: 2.3, opacity: 1 }]);
  assert.deepEqual(punchCopies(4, 8, 2.3, false), [{ scale: punchAt(4), opacity: 1 }]);
  // A lens edge's band: its outermost 8 px left to the picture, full to a third of the band, faded out at its end.
  assert.equal(edgeFade("top"), "linear-gradient(to bottom, transparent 0px, #000 8px, #000 32%, transparent 100%)");
  assert.equal(edgeFade("right", 4, 0.5), "linear-gradient(to left, transparent 0px, #000 4px, #000 50%, transparent 100%)");
});

test("picture kit: a star of windows onto one shot as « Éventail de bandes »'s, its square, its six bands cut square round it", async () => {
  const { starPath, starRays } = await import("../../../apps/render/src/picture-kit.ts");
  const S = 608;
  const rays = starRays(S);
  // « \ », « / », then « | », each in two halves; turned a quarter in a vertical frame.
  assert.deepEqual(rays.map((r) => r.angle), [36, 216, 144, 324, 270, 90]);
  assert.deepEqual(starRays(S, true).map((r) => r.angle), [126, 306, 234, 414, 360, 180]);
  assert.ok(Math.abs(rays[0]!.width - 0.14 * S) < 1e-9 && Math.abs(rays[4]!.width - 0.155 * S) < 1e-9);
  assert.ok(Math.abs(rays[0]!.from - 0.135 * S) < 1e-9 && Math.abs(rays[5]!.from - 0.115 * S) < 1e-9);
  const c = { x: 540, y: 304 };
  assert.equal(starPath(c, 0.094 * S, [], 1688), "M511.4 275.4 h57.2 v57.2 h-57.2 Z");
  assert.equal(starPath(c, 0, [], 1688), "");
  const all = starPath(c, 0.094 * S, rays, 1688).match(/M[^MZ]*Z/g)!;
  assert.equal(all.length, 7);
  // Each band starts square at its distance from the centre (the middle of its inner end), whatever its angle.
  all.slice(1).forEach((w, k) => {
    const v = w.match(/-?[\d.]+/g)!.map(Number);
    const mid = { x: (v[0]! + v[6]!) / 2, y: (v[1]! + v[7]!) / 2 };
    assert.ok(Math.abs(Math.hypot(mid.x - c.x, mid.y - c.y) - rays[k]!.from) < 0.15, `band ${k}: ${w}`);
  });
  // A band growing out from its inner end: half its way at 0.5, whole at 1.
  const half = starPath(c, 0, [{ ...rays[0]!, grow: 0.5 }], 1688).match(/-?[\d.]+/g)!.map(Number);
  assert.ok(Math.abs(Math.hypot(half[2]! - half[0]!, half[3]! - half[1]!) - (1688 - rays[0]!.from) / 2) < 0.2, JSON.stringify(half));
  assert.equal(starPath(c, 0, [{ ...rays[0]!, grow: 1 }], 1688), starPath(c, 0, [rays[0]!], 1688));
});

test("picture kit: tiles land as « Mosaïque qui change »'s prints, askew one way then the other, a pixel or three off, then straight", async () => {
  const { landPose } = await import("../../../apps/render/src/picture-kit.ts");
  const poses = Array.from({ length: 12 }, (_, rank) => landPose(rank, 0, rank, 12, "tiles"));
  poses.forEach((p, i) => {
    assert.equal(Math.sign(p.angle), i % 2 ? 1 : -1, `tile ${i}: the first counterclockwise, then alternating`);
    assert.ok(Math.abs(p.angle) >= 0.4 && Math.abs(p.angle) <= 1.6, JSON.stringify(p));
    assert.ok(Math.abs(p.dx) <= 3 && Math.abs(p.dy) <= 3, JSON.stringify(p));
  });
  // The next picture goes on alternating across the grid (12 tiles: it starts as the first did; 11: the other way).
  assert.equal(Math.sign(landPose(0, 1, 0, 12, "tiles").angle), -1);
  assert.equal(Math.sign(landPose(0, 1, 0, 11, "tiles").angle), 1);
  assert.deepEqual(landPose(5, 2, 7, 12, "x"), landPose(5, 2, 7, 12, "x"));
});

test("picture kit: a fade by light as the pile of « this is Joe Taylor » goes, the dark first, the white of a plate last", async () => {
  const { lumaMatrix, lumaProgress } = await import("../../../apps/render/src/picture-kit.ts");
  // The alpha its matrix gives a grey point of light L (its last row: three weights, then its offset).
  const alpha = (m: string, L: number) => {
    const v = m.trim().split(/\s+/).map(Number);
    return Math.max(0, Math.min(1, (v[15]! + v[16]! + v[17]!) * L + v[19]!));
  };
  assert.deepEqual([3, 4, 5, 7, 8, 9].map((f) => lumaProgress(f, 4, 4)), [0, 0.2, 0.4, 0.8, 1, 1]);
  assert.deepEqual([3, 4, 8].map((f) => lumaProgress(f, 4, 4, "in")), [1, 0.8, 0]);
  // Before it, all there; on its first image its darkest points already half gone, the light ones whole; then only the
  // brightest; at its end nothing, the white too. Its colours are kept.
  assert.equal(alpha(lumaMatrix(0), 0), 1);
  const first = lumaMatrix(0.2);
  assert.ok(alpha(first, 0.05) > 0.2 && alpha(first, 0.05) < 0.6 && alpha(first, 0.8) === 1, first);
  const third = lumaMatrix(0.6);
  assert.ok(alpha(third, 0.3) === 0 && alpha(third, 0.95) === 1, third);
  assert.ok(alpha(lumaMatrix(1), 1) < 1e-3);
  assert.match(lumaMatrix(0.4), /^1 0 0 0 0 {2}0 1 0 0 0 {2}0 0 1 0 0 {2}/);
  // Inverted: the light goes first.
  const inverted = lumaMatrix(0.5, 0.35, true);
  assert.ok(alpha(inverted, 0.95) < alpha(inverted, 0.1), inverted);
});

test("picture kit: an echo's copies, a cut-out's shadow from her feet, a dot grid's build, a pass in characters by light", async () => {
  const { cellRamp, dotOrder, echoCopies, glyphTile, shadowPose, tileImage } = await import("../../../apps/render/src/picture-kit.ts");
  // The echo of « Présente-toi »: its copies the oldest first, paler and paler, a gap of images apart.
  assert.deepEqual(echoCopies(4, 1, 0.6), [
    { back: 4, k: 4, opacity: 0.13 },
    { back: 3, k: 3, opacity: 0.216 },
    { back: 2, k: 2, opacity: 0.36 },
    { back: 1, k: 1, opacity: 0.6 },
  ]);
  assert.deepEqual(echoCopies(3, 2).map((c) => c.back), [6, 4, 2]);
  assert.deepEqual(echoCopies(0), []);
  // Aplat's walker: his shadow from his feet (the bottom middle of his box), flattened and slanted (its v1's 0.26 and
  // 38°), toward one side or the other; or dropped behind him.
  const her = { x: 350, y: 560, w: 420, h: 1100 };
  assert.deepEqual(shadowPose(her), { transformOrigin: "560px 1660px", transform: "skewX(38deg) scaleY(-0.26)" });
  assert.deepEqual(shadowPose(her, "cast", 38, 0.3, "left"), { transformOrigin: "560px 1660px", transform: "skewX(-38deg) scaleY(-0.3)" });
  assert.deepEqual(shadowPose(her, "drop", 0, 0, "right", 14, 18), { transformOrigin: "0 0", transform: "translate(14px, 18px)" });
  // A dot grid builds from the bottom up (with some scatter), in reading order, or from the top down.
  const cols = 8;
  const rows = 10;
  const mean = (build: "rise" | "fall", r: number) => Array.from({ length: cols }, (_, c) => dotOrder(build, c, r, cols, rows, "d")).reduce((a, b) => a + b) / cols;
  assert.ok(mean("rise", rows - 1) < mean("rise", 0) && mean("fall", 0) < mean("fall", rows - 1));
  assert.deepEqual([dotOrder("reading", 0, 0, cols, rows, "d"), dotOrder("reading", 7, 9, cols, rows, "d")], [0, 1]);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) assert.ok(dotOrder("random", c, r, cols, rows, "d") < 1);
  // A pass in characters (« Vision »'s cells of 4 × 8 px): a cell inks more of itself as its light rises, a dot first,
  // never its margin (letters do not touch); in dots, a disc from its middle.
  const tile = glyphTile(4, 8);
  assert.equal(tile.length, 32);
  for (let y = 0; y < 8; y++) assert.equal(tile[y * 4 + 3], 1);
  for (let x = 0; x < 4; x++) assert.equal(tile[7 * 4 + x], 1);
  const inked = (L: number) => tile.filter((v) => v < L).length;
  assert.deepEqual([inked(0.1), inked(0.5), inked(0.99)], [1, 9, 21]);
  const dots = glyphTile(7, 7, "dots");
  assert.ok(dots[3 * 7 + 3]! < dots[3 * 7 + 1]! && dots[3 * 7 + 1]! < dots[0]!);
  const image = tileImage(tile, 4, 8);
  assert.match(image, /^data:image\/svg\+xml;utf8,/);
  assert.equal(decodeURIComponent(image).match(/<rect /g)!.length, 32);
  // Its light read once per cell: a tiled displacement map sends every pixel of a cell to the cell's middle (red the
  // x, green the y, over twice the cell's longer side), each shift within a tenth of a pixel once its colour is rounded.
  const ramp = cellRamp(4, 8);
  assert.equal(ramp.scale, 16);
  assert.deepEqual([ramp.shifts[0], ramp.shifts[4 * 4 + 2], ramp.shifts[31]], [[2, 4], [0, 0], [-1, -3]]);
  const colours = [...decodeURIComponent(ramp.href).matchAll(/rgb\((\d+),(\d+),0\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(colours.length, 32);
  colours.forEach(([r, g], i) => assert.ok(Math.abs((r! / 255 - 0.5) * 16 - ramp.shifts[i]![0]) < 0.1 && Math.abs((g! / 255 - 0.5) * 16 - ramp.shifts[i]![1]) < 0.1, `pixel ${i}`));
});

test("picture kit: one piece of an object alone (Subject part) is cut as « Titre derrière le décor » cut it by hand, unless read apart", async () => {
  const { pieceInset } = await import("../../../apps/render/src/picture-kit.ts");
  // Its box and a pad of 1,2 % of the box's height round it, as the model's own inset (p.y − pad, the right, the bottom, p.x − pad).
  const laid = { left: 0, top: 0, width: 1080, height: 810 };
  assert.equal(pieceInset({ x: 300, y: 200, w: 120, h: 340 }, laid, Math.max(2, Math.round(810 * 0.012))), "inset(190px 650px 260px 290px)");
  assert.equal(pieceInset({ x: 300, y: 200, w: 120, h: 340 }, { left: 40, top: 100, width: 1000, height: 700 }, 0), "inset(100px 620px 260px 260px)");
  assert.equal(pieceInset(undefined, laid), null);
  assert.equal(pieceInset({ x: 1, y: 1, w: 0, h: 5 }, laid), null);
});

test("picture kit: its pieces are in the motion designer's scope and prompt, the renderer's and the scene check's", async () => {
  const { readFileSync } = await import("node:fs");
  const { MOTION_DESIGNER_PROMPT, MOTION_SCOPE } = await import("./motion-scene.ts");
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const picture = read("../../../apps/render/src/Picture.tsx");
  for (const name of ["Burn", "LensEdges", "Smear", "Punch", "WindowStar", "LumaFade", "Echo", "CastShadow", "DotGrid", "Ascii"]) {
    assert.ok((MOTION_SCOPE as readonly string[]).includes(name), name);
    assert.match(MOTION_DESIGNER_PROMPT, new RegExp(`<${name}\\b`), name);
    assert.match(picture, new RegExp(`\\b${name}(: ${name}Of\\(hooks\\)|,)`), `${name} in makePicture`);
  }
  // Its additions to existing pieces: the flash that overexposes, the half turn, the reading wave and the landing tiles, one piece of an object.
  assert.match(MOTION_DESIGNER_PROMPT, /<Flash at=\{\[frames\]\} expose/);
  assert.match(MOTION_DESIGNER_PROMPT, /<Turn draw angle=\{180\} \/>/);
  assert.match(MOTION_DESIGNER_PROMPT, /wave: "reading"[^\n]*reveal: "land"/);
  assert.match(MOTION_DESIGNER_PROMPT, /object="every window" part=\{k\}/);
  // LensEdges draws what it shows once, each band filtering what is under it: drawn once more in each band, her shot
  // (its video, its tones) took half the render of « Quart de tour ».
  const lens = /function LensEdgesOf[\s\S]*?\n}\n/.exec(picture)![0];
  assert.equal(lens.match(/drawAt\(children/g)?.length, 1);
  assert.match(lens, /backdropFilter: `url\(#\$\{id\}-\$\{side\}\)`/);
  assert.doesNotMatch(lens, /[^p]filter: `url\(#/);
  // The scene check draws them on its own clock, as the other kits.
  assert.match(read("../../../apps/render/src/SceneCheck.tsx"), /\.\.\.makePicture\(\{ useCurrentFrame, useVideoConfig \}\)/);
  assert.match(read("../../../apps/render/src/Graphic.tsx"), /angle\?: 90 \| -90 \| 180/);
  assert.match(read("../../../apps/render/src/Kit.tsx"), /\| "reading";/);
});

// ——— The hand-made pieces of the kit (apps/render/src/handmade.ts, pictos.ts, captions.ts), asked by the models' fiches ———

/** A chance by key, the same for the same key (Remotion's random in the render). */
const chance = (key: string) => {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
/** Whether a point is inside a closed polyline (even-odd). */
const insideRing = (pts: { x: number; y: number }[], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

test("kit: a hand's pace round a word, as « Mots mêlés » measured it (no easing, slower in the turns, back faster)", async () => {
  const { capsuleRing, handPace, loopRing } = await import("../../../apps/render/src/handmade.ts");
  // SATURDAY on a grid of 120 px: the loop 0,9 of a pitch tall, its ends 0,4 of a pitch past its first and last letters.
  const p = 120;
  const word = (n: number) => ({ x: 140 - 0.4 * p, y: 300 - 0.45 * p, w: (n - 1) * p + 0.8 * p, h: 0.9 * p });
  const box = word(8);
  const ring = capsuleRing(box, "top-left", "ccw");
  // It starts just above its first letter, turns counterclockwise (down round the first letter first), and closes on its start.
  assert.ok(Math.abs(ring[0]!.x - (box.x + box.h / 2)) < 0.5 && Math.abs(ring[0]!.y - box.y) < 0.5, JSON.stringify(ring[0]));
  assert.ok(ring[1]!.x < ring[0]!.x && ring[6]!.y > ring[0]!.y);
  assert.ok(Math.hypot(ring.at(-1)!.x - ring[0]!.x, ring.at(-1)!.y - ring[0]!.y) < 0.06 * box.w);
  // Clockwise from the bottom right, the other way.
  const cw = capsuleRing(box, "bottom-right", "cw");
  assert.ok(Math.abs(cw[0]!.y - (box.y + box.h)) < 0.5 && cw[1]!.x < cw[0]!.x);
  const loop = loopRing(box, "top", "ccw");
  assert.ok(Math.abs(loop[0]!.x - (box.x + box.w / 2)) < 0.5 && loop[0]!.y < box.y && loop[1]!.x < loop[0]!.x);
  // A letter every 4,5 images: its quarters drawn as the original's (21, 47, 70 %), where an ease-out draws 58, 88, 98.
  const pace = handPace([ring], p / 4.5, { closed: true, radius: box.h / 2 });
  const length = ring.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - ring[i]!.x, q.y - ring[i]!.y), 0);
  assert.ok(Math.abs(pace.frames - length / (p / 4.5)) < 0.5, `${pace.frames}`);
  const quarters = [0.25, 0.5, 0.75].map((f) => pace.drawn(pace.frames * f));
  [0.21, 0.47, 0.7].forEach((want, i) => assert.ok(Math.abs(quarters[i]! - want) < 0.04, `${quarters}`));
  assert.equal(pace.drawn(0), 0);
  assert.equal(pace.drawn(pace.frames), 1);
  for (let t = 1; t < pace.frames; t++) assert.ok(pace.drawn(t) >= pace.drawn(t - 1));
  // Faster on the way back than in the ends.
  const speedAt = (f: number) => pace.drawn(pace.frames * (f + 0.02)) - pace.drawn(pace.frames * (f - 0.02));
  assert.ok(speedAt(0.85) > speedAt(0.05) * 1.3, `${speedAt(0.85)} ${speedAt(0.05)}`);
  // Its length follows the word's: FOR takes less than SATURDAY at the same pace; two strokes leave the pen lifted between.
  assert.ok(handPace([capsuleRing(word(3))], p / 4.5, { closed: true }).frames < pace.frames * 0.5);
  const cross = handPace([ring.slice(0, 20), ring.slice(30, 50)], 20, { lift: 5 });
  assert.ok(cross.drawn(cross.frames / 2) > 0.3 && cross.drawn(cross.frames / 2) < 0.7);
  const none = handPace([], 20);
  assert.ok(none.frames === 0 && none.drawn(5) === 1);
});

test("kit: one stroke round a word over two rows (« AFTER » over « NOON »), in steps, from above its first letter", async () => {
  const { cellsRing } = await import("../../../apps/render/src/handmade.ts");
  const p = 120;
  const row = (r: number, c0: number, c1: number) => ({ x: 140 + c0 * p - 0.42 * p, y: 600 + r * p - 0.45 * p, w: (c1 - c0) * p + 0.84 * p, h: 0.9 * p });
  const centre = (r: number, c: number) => ({ x: 140 + c * p, y: 600 + r * p });
  const ring = cellsRing([row(0, 0, 4), row(1, 0, 3)], "top-left", "ccw");
  // Every letter of both rows inside it; the cell under the R of « AFTER », outside: it steps.
  for (let c = 0; c <= 4; c++) assert.ok(insideRing(ring, centre(0, c).x, centre(0, c).y), `AFTER ${c}`);
  for (let c = 0; c <= 3; c++) assert.ok(insideRing(ring, centre(1, c).x, centre(1, c).y), `NOON ${c}`);
  assert.ok(!insideRing(ring, centre(1, 4).x, centre(1, 4).y));
  // Above its A, going left then down (counterclockwise), back on its start.
  assert.ok(Math.abs(ring[0]!.y - row(0, 0, 4).y) < 1 && ring[0]!.x < centre(0, 0).x + 0.1 * p, JSON.stringify(ring[0]));
  assert.ok(ring[1]!.x < ring[0]!.x && ring[8]!.y > ring[0]!.y);
  assert.ok(ring.slice(-4).some((q) => Math.hypot(q.x - ring[0]!.x, q.y - ring[0]!.y) < 1) && Math.hypot(ring.at(-1)!.x - ring[0]!.x, ring.at(-1)!.y - ring[0]!.y) < 0.4 * p);
  // Its points evenly apart, its corners rounded (no point at a corner of the cells' union).
  const steps = ring.slice(1).map((q, i) => Math.hypot(q.x - ring[i]!.x, q.y - ring[i]!.y));
  assert.ok(Math.max(...steps) < 0.2 * p);
  assert.ok(!ring.some((q) => Math.hypot(q.x - row(0, 0, 4).x, q.y - row(0, 0, 4).y) < 0.1 * p));
  // Rows offset on both sides step on both sides; rows that do not touch are stretched until one outline goes round them.
  const offset = cellsRing([row(0, 1, 5), row(1, 0, 3), row(2, 2, 6)], "top-left", "cw");
  for (const [r, c] of [[0, 5], [1, 0], [2, 6], [1, 2]] as const) assert.ok(insideRing(offset, centre(r, c).x, centre(r, c).y), `${r},${c}`);
  const apart = cellsRing([row(0, 0, 1), row(1, 4, 6)], "top-left", "ccw");
  for (const [r, c] of [[0, 0], [1, 6]] as const) assert.ok(insideRing(apart, centre(r, c).x, centre(r, c).y), `${r},${c}`);
  // One row is a capsule round it.
  const one = cellsRing([row(0, 0, 4)]);
  for (let c = 0; c <= 4; c++) assert.ok(insideRing(one, centre(0, c).x, centre(0, c).y));
  assert.deepEqual(cellsRing([]), []);
});

test("kit: a word search hides her words and the words of her world it never circles, the accents dropped", async () => {
  const { placeWords, plainLetters } = await import("../../../apps/render/src/handmade.ts");
  assert.equal(plainLetters("Crème brûlée"), "CREMEBRULEE");
  assert.equal(plainLetters("l'Été !"), "LETE");
  const [cols, rows] = [9, 16];
  const allowed = (c: number, r: number) => c >= 1 && c <= 7 && r >= 1 && r <= 11;
  const grid = new Map<string, string>();
  const found = placeWords(["SAMEDI", "Café", "crème"], cols, rows, allowed, "plage", chance, grid);
  const hidden = placeWords(["brioche", "mer", "thé", "tartine"], cols, rows, () => true, "plage-decoy", chance, grid);
  assert.deepEqual(found.map((p) => p.word), ["SAMEDI", "CAFE", "CREME"]);
  assert.deepEqual(hidden.map((p) => p.word), ["BRIOCHE", "MER", "THE", "TARTINE"]);
  assert.ok(found.every((p) => p.cells.every(([c, r]) => allowed(c, r))));
  // Each in a line, read forwards (along a row, down a column or a diagonal), every letter where the grid says.
  for (const p of [...found, ...hidden]) {
    const [dx, dy] = [p.cells[1]![0] - p.cells[0]![0], p.cells[1]![1] - p.cells[0]![1]];
    assert.ok(["h", "v", "d", "u"].includes(p.dir) && dx === 1 - Number(p.dir === "v") && dy === { h: 0, v: 1, d: 1, u: -1 }[p.dir]);
    p.cells.forEach(([c, r], k) => assert.equal(grid.get(`${c},${r}`), p.word[k]));
  }
  // The same seed, the same grid: the words placed before its decoys never move for them.
  assert.deepEqual(placeWords(["SAMEDI", "Café", "crème"], cols, rows, allowed, "plage", chance).map((p) => p.cells), found.map((p) => p.cells));
});

test("kit: TypeOn's cursor goes back and eats the text, down to what it keeps", async () => {
  const { typedState } = await import("../../../apps/render/src/handmade.ts");
  // « Héloïse Marchand » typed a letter every 2 frames; from frame 40 the cursor eats one every 2 frames (15 a second).
  const times = Array.from({ length: 16 }, (_, i) => i * 2);
  assert.deepEqual(typedState(times, 5), { shown: 3, busy: true, since: 5 });
  assert.deepEqual(typedState(times, 35), { shown: 16, busy: false, since: 30 });
  const erase = { at: 40, perSecond: 15, keep: 7 };
  assert.equal(typedState(times, 39, erase).shown, 16);
  assert.equal(typedState(times, 40, erase).shown, 15);
  assert.equal(typedState(times, 44, erase).shown, 13);
  // Down to « Héloïse », then it rests: the caret blinks from the frame the last letter went.
  assert.deepEqual(typedState(times, 80, erase), { shown: 7, busy: false, since: 40 + 8 * 2 });
  // Erasing before the end of its typing: what was typed then, nothing more.
  assert.equal(typedState(times, 13, { at: 12, perSecond: 30, keep: 0 }).shown, 5);
  assert.equal(typedState(times, 60, { at: 12, perSecond: 30, keep: 0 }).shown, 0);
});

test("kit: a hand that never repeats (« Carte au feutre »): each letter different, its lines, its textures", async () => {
  const { handBreak, handLine, handSlots, handStrays, strokeTexture } = await import("../../../apps/render/src/handmade.ts");
  // The two T of « THAT », the two M of « MAMAN »: never the same letter twice, never larger than the font by 3 %.
  const strays = handStrays(5, "maman", chance);
  for (const [a, b] of [[0, 2], [1, 3], [2, 4]] as const) {
    const [s, t] = [strays[a]!, strays[b]!];
    assert.ok(Math.abs(s.rotate - t.rotate) + Math.abs(s.sx - t.sx) + Math.abs(s.sy - t.sy) + Math.abs(s.dy - t.dy) > 0.01, `${a} ${b}`);
  }
  for (const s of handStrays(200, "long", chance)) {
    assert.ok(s.sx <= 1.03 && s.sy <= 1.03 && s.sx >= 0.89 && s.sy >= 0.9 && Math.abs(s.rotate) <= 4 && Math.abs(s.dy) <= 0.051, JSON.stringify(s));
  }
  assert.deepEqual(handStrays(3, "maman", chance), handStrays(3, "maman", chance));
  assert.ok(handStrays(2, "x", chance, 0).every((s) => Math.abs(s.dx) + Math.abs(s.dy) + Math.abs(s.rotate) < 1e-12 && s.sx === 1 && s.sy === 1));
  assert.ok(Math.abs(handLine("carte", 0, chance).tilt) <= 1.4);
  // Its own lines; else even lines between its words, about ten letters each, never a word cut.
  assert.deepEqual(handBreak("PUT THAT\nPHONE DOWN\n\n& COME TO\n BURGER  NIGHT "), ["PUT THAT", "PHONE DOWN", "& COME TO", "BURGER NIGHT"]);
  const cut = handBreak("UN BOUQUET POUR MAMAN CE DIMANCHE");
  assert.equal(cut.join(" "), "UN BOUQUET POUR MAMAN CE DIMANCHE");
  assert.ok(cut.length === 3 && Math.max(...cut.map((l) => l.length)) <= 12, JSON.stringify(cut));
  assert.deepEqual(handBreak("Bonjour"), ["Bonjour"]);
  assert.deepEqual(handBreak("UN DEUX TROIS", 2), ["UN DEUX", "TROIS"]);
  // The last line 1,3 times as tall, the slots filling the box.
  const slots = handSlots(4, 660, 1.3);
  assert.ok(Math.abs(slots[3]!.h / slots[0]!.h - 1.3) < 1e-9 && Math.abs(slots[3]!.top + slots[3]!.h - 660) < 1e-9);
  assert.deepEqual(handSlots(1, 300), [{ top: 0, h: 300 }]);
  // Its textures, made once: the same for a seed, a slow noise (neighbours close, opaque), a grain (its alpha spread out).
  const slow = strokeTexture("slow", 48, "carte", 10);
  assert.equal(slow.length, 48 * 48 * 4);
  assert.deepEqual(strokeTexture("slow", 48, "carte", 10), slow);
  const jumps: number[] = [];
  for (let i = 4; i < slow.length; i += 4) if ((i / 4) % 48) jumps.push(Math.abs(slow[i]! - slow[i - 4]!));
  const mean = jumps.reduce((a, b) => a + b, 0) / jumps.length;
  assert.ok(Math.max(...jumps) < 100 && mean < 20 && slow[3] === 255, `${Math.max(...jumps)} ${mean}`);
  const fine = strokeTexture("fine", 64, "carte");
  const alphas = Array.from({ length: 64 * 64 }, (_, i) => fine[i * 4 + 3]!);
  assert.ok(Math.min(...alphas) < 20 && Math.max(...alphas) > 235 && new Set(alphas).size > 200);
});

test("kit: an eye's almond for a window (« Silhouette et mot »)", async () => {
  const { almondPath } = await import("../../../apps/render/src/handmade.ts");
  const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  // Shut: its lids on the middle line; open: its corners at the box's left and right middle, its lids touching top and bottom.
  assert.ok(numbers(almondPath(800, 220, 0)).every((v, i) => i % 2 === 0 || v === 110));
  const open = numbers(almondPath(800, 220, 1));
  assert.deepEqual([open[0], open[1], open[6], open[7]], [0, 110, 800, 110]);
  // A cubic peaks at three quarters of its handles' height: the upper lid's handles at −36,7 reach the top, the lower's 256,7 the bottom.
  assert.ok(Math.abs(110 - 0.75 * (110 - open[3]!) - 0) < 0.2 && Math.abs(110 + 0.75 * (open[9]! - 110) - 220) < 0.2, JSON.stringify(open));
  // Narrowed from below: the lower lid opens a fifth as far as the upper.
  const narrowed = numbers(almondPath(800, 220, 1, [1, 0.2]));
  assert.ok(Math.abs((narrowed[9]! - 110) / (110 - narrowed[3]!) - 0.2) < 0.01);
  assert.ok(!/NaN/.test(almondPath(0, 0, 2, [3, -1])));
});

test("kit: a creator's hook on bands (« Face caméra et références »): phrases of nine words, lines as even as they go", async () => {
  const { BAND_LIMITS, bandLines, captionCards } = await import("../../../apps/render/src/captions.ts");
  const said = "Avoir une très bonne culture visuelle, je pense que c'est un des points les plus importants en réalisation.".split(" ");
  const words = said.map((w, i) => ({ w, from: i * 8, to: i * 8 + 7 }));
  const bands = captionCards(words, 30, 400, BAND_LIMITS);
  assert.deepEqual(bands[0]!.words.map((w) => w.w).join(" "), "Avoir une très bonne culture visuelle,");
  assert.ok(bands.every((c) => c.words.length <= 9) && bands.map((c) => c.words.map((w) => w.w).join(" ")).join(" ") === said.join(" "));
  // The engine's own phrases keep six words at most.
  assert.ok(captionCards(words, 30, 400).every((c) => c.words.length <= 6));
  // As few lines as hold the words, then even: never a line past the width unless a word alone is wider.
  assert.deepEqual(bandLines([150, 100, 110, 170, 200, 230], 600, 20), [[0, 1, 2, 3], [4, 5]]);
  assert.deepEqual(bandLines([200, 200, 200, 200], 1000, 20), [[0, 1, 2, 3]]);
  assert.deepEqual(bandLines([200, 200, 200, 200], 500, 20), [[0, 1], [2, 3]]);
  assert.deepEqual(bandLines([900, 100], 600, 20), [[0], [1]]);
  assert.deepEqual(bandLines([100], 600, 20), [[0]]);
  assert.deepEqual(bandLines([], 600, 20), []);
});

test("kit: line pictograms by trade, drawn as strokes on their grid, found by her trade's words", async () => {
  const { PICTOS, PICTO_NAMES, pathLength, pathStrokes, pictoFor } = await import("../../../apps/render/src/pictos.ts");
  assert.ok(PICTO_NAMES.length >= 20);
  for (const [name, picto] of Object.entries(PICTOS)) {
    assert.ok(picto.paths.length >= 1 && picto.paths.length <= 8, name);
    for (const d of picto.paths) {
      // Only the commands the pictograms are written in; every stroke on the grid, with room for the line's width.
      assert.match(d, /^[MLHVCQZ0-9.\s-]+$/, name);
      const strokes = pathStrokes(d);
      assert.ok(strokes.length >= 1 && pathLength(d) > 3, `${name}: ${d}`);
      for (const p of strokes.flat()) assert.ok(p.x >= 3 && p.x <= 97 && p.y >= 3 && p.y <= 97, `${name} ${p.x},${p.y}`);
    }
    for (const w of picto.words) assert.equal(w, w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(), `${name}: ${w}`);
  }
  // Her trade in her own words, French or English, a key as it is; « salon de thé » before « salon ».
  const asked: [string, string | null][] = [
    ["Salon de coiffure", "ciseaux"],
    ["Café des Arts", "cafe"],
    ["Boulangerie Dupont", "croissant"],
    ["Fleuriste du marché", "tulipe"],
    ["La Friperie", "cintre"],
    ["Atelier Pilates", "lotus"],
    ["Bar à vin", "vin"],
    ["Salon de thé", "the"],
    ["Le Barbier", "moustache"],
    ["The Barber", "moustache"],
    ["Studio photo", "appareil"],
    ["Pizzeria Mamma", "pizza"],
    ["scissors", "ciseaux"],
    ["lotus", "lotus"],
    ["Notaire", null],
    ["", null],
  ];
  for (const [name, want] of asked) assert.equal(pictoFor(name), want, name);
  // A square drawn clockwise is 4 sides; a curve is cut in pieces.
  assert.equal(pathLength("M 10 10 H 20 V 20 H 10 Z"), 40);
  assert.ok(Math.abs(pathLength("M 0 0 C 0 0 10 0 10 0") - 10) < 1e-9);
});

test("kit: the hand-made pieces are in the scope and told to the motion designer", async () => {
  const { MOTION_SCOPE, MOTION_DESIGNER_PROMPT } = await import("./motion-scene.ts");
  assert.ok(MOTION_SCOPE.includes("Handwriting") && MOTION_SCOPE.includes("Picto"));
  for (const told of [/erase=\{\{ at, speed: 14, keep \}\}/, /kind="loop" \| "capsule" \| "cells"/, /Scribble\.frames\(props\)/, /decoys=\{\[…\]\}/, /pace=\{4\.5\}/, /<Handwriting text=/, /<Picto name=/, /reveal="grow" \| "iris" \| "eye"/, /style="kinetic" \| "stickers" \| "bands"/]) {
    assert.match(MOTION_DESIGNER_PROMPT, told);
  }
  // A pictogram goes with its word, never an icon floating on its own (what looks cheap).
  assert.match(MOTION_DESIGNER_PROMPT, /never an icon floating on its own/);
});

// ——— « Mots mêlés » v2 and « Interrupteur » v2, written again on their originals' fiches (docs/fiches/mots-meles.md, interrupteur.md) ———

/** What the kit's stand-ins read: her shot's light (LightUnder), her cut-out's outline (SubjectOutline) and her tracks, by frame. */
type KitReads = { light?: { mean: number; high: number } | null; outline?: (frame: number) => string | null; track?: (frame: number, box: { left: number; top: number; width: number; height: number }) => unknown; box?: (frame: number) => { x: number; y: number; w: number; h: number } | null };
/**
 * A skill's Scene drawn at a frame as drawCutOuts draws it, with the scope its code also needs: its hooks (useMemo run at
 * once), Remotion's seeded random, Scribble with its hand's pace (Scribble.frames: the length of the kit's own ring,
 * capsuleRing or cellsRing of handmade.ts, over its speed), LightUnder, SubjectOutline and track as given.
 */
async function kitScene(code: string, read: KitReads = {}) {
  const { capsuleRing, cellsRing } = await import("../../../apps/render/src/handmade.ts");
  type Pt = { x: number; y: number };
  type Ring = { kind?: string; box?: { x: number; y: number; w: number; h: number }; rows?: { x: number; y: number; w: number; h: number }[]; speed: number };
  const length = (pts: Pt[]) => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - pts[i]!.x, q.y - pts[i]!.y), 0);
  const ring = (p: Ring) => (p.kind === "cells" ? cellsRing(p.rows ?? [], "top-left", "ccw") : capsuleRing(p.box!, "top-left", "ccw"));
  const Scribble = Object.assign(() => null, { frames: (p: Ring) => Math.ceil(length(ring(p)) / p.speed) });
  let current = 0;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: <T,>(make: () => T) => make() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    Img: "Img",
    Scribble,
    useCurrentFrame: () => current,
    interpolate: (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1))),
    random: chance,
    LightUnder: () => read.light ?? null,
    SubjectOutline: (_shot: unknown, f: number) => read.outline?.(f) ?? null,
    ...(read.box ? { SubjectBox: (_shot: unknown, f: number) => read.box!(f) } : {}),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const Scene = make(React, ...Object.values(scope));
  const draw = (frame: number, props: Record<string, unknown>) => {
    current = frame;
    return Scene({ ...(read.track ? { track: read.track } : {}), ...props });
  };
  return { draw, Scribble, frames: (p: Ring) => Scribble.frames(p) };
}

/** The original's sentence and its words of the same world, as its fiche read them (« SATURDAY AFTERNOON CALL FOR GREEK YOGURT »). */
const MM_WORDS = [
  { text: "Saturday afternoon call for greek yogurt", role: "band", from: 0, to: 563, emphasis: [] },
  { text: "blackberry cinnamon honey dill", role: "caption", from: 0, to: 563, emphasis: [] },
];
/** Each letter a word-search Scene lays (a cell of its grid): its letter, its size, its box, and whether it is decor. */
function gridLetters(tree: unknown) {
  const out: { ch: string; size: number; decor: boolean; left: number; top: number; width: number; height: number }[] = [];
  const walk = (node: unknown, decor: boolean): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, decor));
      return;
    }
    if (!("children" in node)) return;
    const n = node as Drawn;
    const isDecor = decor || "data-fauve-decor" in n.props;
    const s = styleOf(n);
    if (n.type === "div" && s.display === "flex" && typeof s.fontSize === "number" && typeof n.children[0] === "string") {
      out.push({ ch: n.children[0] as string, size: s.fontSize, decor: isDecor, left: Number(s.left), top: Number(s.top), width: Number(s.width), height: Number(s.height) });
    }
    n.children.forEach((c) => walk(c, isDecor));
  };
  walk(tree, false);
  return out;
}

test("« Mots mêlés » (v2): one calm shot of 25 beats at 80 BPM as its 18,67 s original, no cut, its sentence held, its card after the hold", async () => {
  const { motsMeles } = await import("./skills/mots-meles.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(motsMeles.version, 4);
  assert.equal(motsMeles.bpm, 80);
  const line = motsMeles.timeline(1, { end: false });
  // One shot, no cut (the original has none, measured image by image): 25 of its beats, the original's 560 images and three.
  assert.equal(line.shots.length, 1);
  assert.equal(line.shots[0]!.start, 0);
  assert.equal(Math.round(line.duration * 30), 563);
  // Its first loop on the original's image 4, its sentence held 4 beats at least (3 s), its grid all along.
  assert.deepEqual(line.marks, { first: 4, hold: 90 });
  assert.deepEqual(line.texts, { mots: { from: 0, to: line.duration }, autres: { from: 0, to: line.duration } });
  // An ending card after the hold, never in its place: the grid stays its 25 beats at least, the card its 1,6 s.
  const ended = motsMeles.timeline(1, { end: true });
  assert.ok(ended.texts.mots!.to >= line.duration - 0.02 && Math.abs(ended.duration - ended.texts.mots!.to - 1.6) < 0.02, JSON.stringify(ended.texts));
  // Its music calm (70 to 90 BPM): its length follows it, its loops a hand.
  assert.deepEqual(motsMeles.tempo, [70, 90]);
  assert.ok(Math.abs(motsMeles.timeline(1, { end: false, bpm: 70 }).duration - (25 * 60) / 70) < 0.02);
  // No sound of its own (the original has none) and no shape of its music; a format setting, its default as her video.
  const files = [{ id: "v", photo: false, seconds: 25 }];
  const plan = skillPlan({ skill: motsMeles, name: "Mots mêlés", files, fill: { shots: [{ file: "v", at: 2 }], texts: { mots: "Samedi matin café croissant" }, end: null } });
  assert.equal(plan.sounds, undefined);
  assert.equal(plan.music_shape, undefined);
  assert.deepEqual(motsMeles.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(plan.skill, { key: "mots-meles", version: 4 });
});

test("« Mots mêlés » (v2): its loops at the original's hand, chained 3 to 6 images apart, from just above each first letter, the letters never changing", async () => {
  const { motsMeles } = await import("./skills/mots-meles.ts");
  const line = motsMeles.timeline(1, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const { draw, Scribble, frames } = await kitScene(motsMeles.code);
  const props = { width: 1080, height: 1920, durationInFrames: 563, brand: { name: "Le Studio", displayFont: "Inter Tight", bodyFont: "Inter Tight" }, shots: rallumeShots(line), reelTexts: MM_WORDS, end: null, texts: marks };
  type Loop = { at: number; speed: number; kind: string; angle?: number; start: string; direction: string; width: number; color: string; box?: { x: number; y: number; w: number; h: number }; rows?: { x: number; y: number; w: number; h: number }[] };
  // Its white loops (under each one, the same stroke darker and wider: its halo, v3).
  const loops = (f: number, p: Record<string, unknown> = props) => drawnNodes(draw(f, p)).filter((n) => n.type === Scribble && (n.props as { color?: string }).color === "#ffffff").map((n) => n.props as Loop);
  const all = loops(562);
  // Six loops, one a word, « AFTERNOON » in one stroke round two rows, « GREEK » up a diagonal (41,7° in the original).
  assert.equal(all.length, 6);
  assert.deepEqual(all.map((l) => l.kind), ["capsule", "cells", "capsule", "capsule", "capsule", "capsule"]);
  assert.equal(all[1]!.rows!.length, 2);
  assert.ok(all[4]!.angle! < -40 && all[4]!.angle! > -43, `${all[4]!.angle}`);
  assert.ok(all.every((l) => l.start === "top-left" && l.direction === "ccw" && l.color === "#ffffff"));
  // Their starts and lengths: the original's images 4, 88, 168, 227, 274 and 339, its 78, 74, 55, 42, 62 and 60 images
  // of stroke, within a few images (a word's time is the hand's, 18,6 images plus 3,2 a row of stroke).
  const starts = [4, 88, 168, 227, 274, 339];
  const lengths = [78, 74, 55, 42, 62, 60];
  all.forEach((l, i) => {
    assert.ok(Math.abs(l.at - starts[i]!) <= 10, `loop ${i + 1} starts on image ${l.at}, the original's ${starts[i]}`);
    assert.ok(Math.abs(frames(l) - lengths[i]!) <= 7, `loop ${i + 1} takes ${frames(l)} images, the original's ${lengths[i]}`);
  });
  // The next one 3 to 6 images after the one before closes (the pen lifted), the sentence held 5 s and more at the end.
  for (let i = 1; i < all.length; i++) {
    const lift = all[i]!.at - (all[i - 1]!.at + frames(all[i - 1]!));
    assert.ok(lift >= 2 && lift <= 7, `lift ${i}: ${lift}`);
  }
  const closed = all.at(-1)!.at + frames(all.at(-1)!);
  assert.ok(563 - closed >= 150, `held from image ${closed}`);
  // Each one drawn from its start only: none before image 4, two by image 100.
  assert.equal(loops(3).length, 0);
  assert.equal(loops(100).length, 2);
  // A stroke 3,8 % of a row, its capsule 0,9 of a row tall.
  const row = 608 / 10.46;
  assert.ok(Math.abs(all[0]!.width - 0.038 * row) < 0.15 && Math.abs(all[0]!.box!.h - 0.9 * row) < 1);
  // A long sentence goes a little faster rather than eat its hold.
  const fast = loops(562, { ...props, reelTexts: [{ ...MM_WORDS[0]!, text: "Samedi après-midi grand café crème croissant tartine confiture" }] });
  const last = fast.at(-1)!;
  assert.ok(fast.length === 8 && last.at + frames(last) <= 563 - 90 + 1, `the last closes on image ${last.at + frames(last)}`);
  // The letters never change: the same letters, the same white, before and after their loop.
  const letters = (f: number) => gridLetters(draw(f, props)).map((l) => `${l.left},${l.top}:${l.ch}`).sort().join("|");
  assert.equal(letters(10), letters(500));
  assert.ok(gridLetters(draw(500, props)).every((l) => l.size === 24));
});

test("« Mots mêlés » (v2): 16 × 10 on her horizontal video in a 16:9 band as the original, 9 × 16 full frame otherwise; her words in order, her other words hidden", async () => {
  const { motsMeles } = await import("./skills/mots-meles.ts");
  const line = motsMeles.timeline(1, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "Le Studio", displayFont: "Inter Tight", bodyFont: "Inter Tight" };
  const props = (aspect: number, extra: Record<string, string> = {}) => ({ width: 1080, height: 1920, durationInFrames: 563, brand, shots: rallumeShots(line, aspect), reelTexts: MM_WORDS, end: null, texts: { ...marks, ...extra } });
  const { draw } = await kitScene(motsMeles.code);
  const band = (tree: Drawn) => {
    const b = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!;
    return { top: styleOf(b).top, height: styleOf(b).height };
  };
  // Her video in width: the original's frame, 1080 × 608 in the middle, its 160 letters on it, the first 0,73 of a step in.
  const wide = draw(300, props(16 / 9));
  assert.deepEqual(band(wide), { top: 656, height: 608 });
  const cells = new Map(gridLetters(wide).map((l) => [`${l.left},${l.top}`, l]));
  assert.equal(cells.size, 160);
  const step = 1080 / 16.46;
  const row = 608 / 10.46;
  const first = [...cells.values()].sort((a, b) => a.top - b.top || a.left - b.left)[0]!;
  assert.ok(Math.abs(first.left + first.width / 2 - 0.73 * step) < 1.5 && Math.abs(first.top + first.height / 2 - (656 + 0.73 * row)) < 1.5, JSON.stringify(first));
  // There all its letters are decor, at the original's size (2 % of its height); upright, her words are read at 48 px.
  assert.ok(gridLetters(wide).every((l) => l.decor && l.size === 24));
  const tall = draw(300, props(9 / 16));
  assert.deepEqual(band(tall), { top: 0, height: 1920 });
  const upright = gridLetters(tall);
  assert.equal(new Set(upright.map((l) => `${l.left},${l.top}`)).size, 144);
  const read = upright.filter((l) => !l.decor);
  assert.equal(read.map((l) => l.ch).join(""), "SATURDAYAFTERNOONCALLFORGREEKYOGURT");
  for (const l of read) {
    const x = l.left + l.width / 2;
    const y = l.top + l.height / 2;
    assert.ok(l.size === 48 && x - 22 >= 28 && y - 26 >= 80 && y + 26 <= 1440 && x + 22 <= (y + 26 > 960 ? 952 : 1052), `${l.ch} at ${x},${y}`);
  }
  // Her setting both ways.
  assert.equal(band(draw(300, props(9 / 16, { format: "horizontal" }))).top, 656);
  assert.equal(band(draw(300, props(16 / 9, { format: "vertical" }))).height, 1920);
  // Her words in the order of her sentence, top to bottom: AFTER over NOON from the same column, GREEK rising one row a
  // letter from its first; her other words hidden in the grid, never ringed; her shortest word once more, as a trap.
  const cellOf = (l: { left: number; top: number; width: number; height: number }) => ({ c: Math.round((l.left + l.width / 2) / step - 0.73), r: Math.round((l.top + l.height / 2 - 656) / row - 0.73) });
  const words = drawnNodes(wide).find((n) => n.type === "div" && "data-fauve-decor" in n.props && gridLetters(n).length === 35)!;
  const mine = gridLetters(words).map((l) => ({ ch: l.ch, ...cellOf(l) }));
  const word = (from: number, to: number) => mine.slice(from, to);
  const firstRows = [word(0, 8), word(8, 13), word(17, 21), word(21, 24), word(24, 29), word(29, 35)].map((w) => w[0]!.r);
  for (let i = 1; i < firstRows.length; i++) assert.ok(firstRows[i]! > firstRows[i - 1]!, `rows ${firstRows}`);
  const a = word(8, 9)[0]!;
  assert.ok(word(8, 13).every((l, k) => l.r === a.r && l.c === a.c + k), "AFTER on one row");
  assert.ok(word(13, 17).every((l, k) => l.r === a.r + 1 && l.c === a.c + k), "NOON under AFTER");
  const g = word(24, 25)[0]!;
  assert.ok(word(24, 29).every((l, k) => l.c === g.c + k && l.r === g.r - k), "GREEK up a diagonal");
  const grid = new Map(gridLetters(wide).map((l) => [`${cellOf(l).c},${cellOf(l).r}`, l.ch]));
  const lines = (w: string) => {
    let found = 0;
    for (let c = 0; c < 16; c++) for (let r = 0; r < 10; r++) for (const [dc, dr] of [[1, 0], [0, 1], [1, -1]] as const) if ([...w].every((ch, k) => grid.get(`${c + dc * k},${r + dr * k}`) === ch)) found++;
    return found;
  };
  for (const hidden of ["BLACKBERRY", "CINNAMON", "HONEY", "DILL"]) assert.equal(lines(hidden), 1, hidden);
  assert.equal(lines("FOR"), 2);
  // The other letters drawn from the whole alphabet alike, Z, Q, J and X too.
  assert.ok(["Z", "Q", "J", "X", "W", "K"].filter((ch) => [...grid.values()].includes(ch)).length >= 4);
});

test("« Mots mêlés » (v2): its picture darkened to its own light, as filmed, nothing cut out or followed: light to render", async () => {
  const { motsMeles } = await import("./skills/mots-meles.ts");
  const { subjectsDrawn, objectsDrawn, clearsDrawn, readsDrawn, depthsDrawn } = await import("./subject.ts");
  const { checkMotionCode } = await import("./motion-scene.ts");
  const line = motsMeles.timeline(1, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const props = { width: 1080, height: 1920, durationInFrames: 563, brand: { name: "Le Studio", displayFont: "Inter Tight", bodyFont: "Inter Tight" }, shots: rallumeShots(line), reelTexts: MM_WORDS, end: null, texts: marks };
  const veil = async (light: { mean: number; high: number } | null) => {
    const { draw } = await kitScene(motsMeles.code, { light });
    const box = drawnNodes(draw(200, props)).find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!;
    const v = drawnNodes(box).find((n) => n.type === "div" && styleOf(n).backgroundColor === "#000000");
    return v ? Number(styleOf(v).opacity) : 0;
  };
  // Its bright tenth brought under 60 % of white: a white room in daylight takes far more than a dark kitchen; unread, a fixed dose.
  assert.equal(await veil({ mean: 0.7, high: 0.9 }), 0.333);
  assert.equal(await veil({ mean: 0.3, high: 0.5 }), 0);
  assert.equal(await veil({ mean: 0.9, high: 1 }), 0.4);
  assert.equal(await veil(null), 0.25);
  // Its light read on its one shot, nothing else: nobody cut out, no object, no clear area, no depth; no zoom, no push.
  assert.deepEqual(checkMotionCode(motsMeles.code), []);
  assert.deepEqual(readsDrawn(motsMeles.code), [{ shot: 0, kinds: ["light"] }]);
  assert.deepEqual([subjectsDrawn(motsMeles.code), objectsDrawn(motsMeles.code), clearsDrawn(motsMeles.code), depthsDrawn(motsMeles.code)], [[], [], [], []]);
  assert.doesNotMatch(motsMeles.code, /transform|scale\(|filter:/);
  // Its finish leaves the darkening to its code, without grain or dark corners (the original has none).
  assert.deepEqual(motsMeles.finish, { exposure: 0, grain: 0, vignette: 0 });
});

test("« Interrupteur » (v2): one shot of 9,1 s on its original's grid (143,7 BPM, one beat in two), its music stopped dead and back as she lands, its beep", async () => {
  const { interrupteur } = await import("./skills/interrupteur.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(interrupteur.version, 9);
  assert.equal(interrupteur.bpm, 71.85);
  const line = interrupteur.timeline(1, { end: false });
  // One fixed shot, no cut (the original has none): its 275 images less its last two, a rest of its edit.
  assert.equal(line.shots.length, 1);
  assert.equal(Math.round(line.duration * 30), 273);
  // Its switch flips on its image 123 (beat 9¼) when nothing read on her shot says when; her hand looked for around it.
  assert.equal(line.marks.flip, 123);
  assert.ok(line.marks.look_from! <= 60 && line.marks.look_to! >= 190);
  // Its music: its first beat at 0,24 s, stopped dead at 2,29 s (just before beat 5), back on beat 10 (4,41 s, as she
  // lands) with its bass, cut on beat 21 (9,0 s); each within an image of the original's.
  const music = line.music!;
  assert.ok(Math.abs(music.downbeat! - 0.24) < 0.005);
  assert.equal(music.pauses!.length, 1);
  assert.ok(Math.abs(music.pauses![0]!.from - 2.29) <= 1 / 30 && Math.abs(music.pauses![0]!.to - 4.41) <= 1 / 30, JSON.stringify(music.pauses));
  assert.deepEqual(music.filters, [{ kind: "thin", from: 0, to: music.pauses![0]!.from }]);
  assert.ok(Math.abs(music.end!.at - 9.0) <= 2 / 30 && music.end!.fade! < 0.02);
  // Its one sound: the short high beep alone in the silence, on beat 6¾ (3,06 s, its image 92), as loud as the music.
  assert.equal(line.sounds!.length, 1);
  assert.ok(Math.abs(line.sounds![0]!.at - 3.06) <= 1 / 30 && line.sounds![0]!.gain === 6 && /beep/.test(line.sounds![0]!.sound));
  // Her poster's words from the flip to the end; she is cut out on her one shot.
  assert.deepEqual(Object.keys(line.texts), ["nom", "ligne", "detail"]);
  assert.ok(Object.values(line.texts).every((t) => Math.abs(t.from - 4.1) < 0.01 && t.to === line.duration));
  assert.deepEqual(line.cutouts, [0]);
  // An ending card after it (1,6 s at least, on its grid), the music ending as much later; at another tempo, all of it follows.
  const ended = interrupteur.timeline(1, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs(ended.music!.end!.at - music.end!.at - (ended.duration - line.duration)) < 0.02);
  const slower = interrupteur.timeline(1, { end: false, bpm: 64 });
  assert.ok(Math.abs(slower.marks.flip! / line.marks.flip! - 71.85 / 64) < 0.01 && Math.abs(slower.music!.pauses![0]!.to / music.pauses![0]!.to - 71.85 / 64) < 0.01);
  // On the plan: its sound, its music's shape, her cut-out on that passage only.
  const files = [{ id: "v", photo: false, seconds: 14 }];
  const plan = skillPlan({ skill: interrupteur, name: "Interrupteur", files, fill: { shots: [{ file: "v", at: 0.5 }], texts: { nom: "Atelier Rose", ligne: "nouvelle collection" }, end: null } });
  assert.equal(plan.sounds?.length, 1);
  assert.deepEqual(plan.music_shape?.pauses, [{ from: 2.29, to: 4.415 }]);
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 1, subjects: [0] });
  assert.deepEqual(interrupteur.reads, ["gestures"]);
});

test("« Interrupteur » (v2): its switch where her hand goes highest, flipped in one image as it gets there, her poster at once, she in front", async () => {
  const { interrupteur } = await import("./skills/interrupteur.ts");
  const line = interrupteur.timeline(1, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#7a2e3b", palette: { secondary: "#2c4a3e", light: "#f4efe9", dark: "#1d1d1b" } };
  const reelTexts = [
    { text: "Atelier Rose", role: "hook", from: 123, to: 273, emphasis: [] },
    { text: "nouvelle collection", role: "caption", from: 123, to: 273, emphasis: [] },
    { text: "dès samedi", role: "caption", from: 123, to: 273, emphasis: [] },
  ];
  const props = (extra: Record<string, unknown> = {}) => ({ width: 1080, height: 1920, durationInFrames: 273, brand, shots: rallumeShots(line, 9 / 16), reelTexts, end: null, texts: marks, ...extra });
  // Her index finger rises from her chest to the top of her jump on image 110, then down again.
  const tip = (f: number) => ({ x: 600 + (f - 60) * 0.5, y: f < 110 ? 1100 - (f - 60) * 14 : 400 + (f - 110) * 14 });
  const track = (f: number) => ({
    hands: f >= 60 && f <= 160 ? [{ points: { index_tip: tip(f), wrist: { x: tip(f).x, y: tip(f).y + 120 } } }] : [],
    bodies: f >= 40 ? [{ points: { left_shoulder: { x: 560, y: 900, visible: true }, right_shoulder: { x: 700, y: 900, visible: true } } }] : [],
  });
  const { draw } = await kitScene(interrupteur.code, { track });
  type Box = { left: number; top: number; width: number; height: number };
  const switchOf = (tree: Drawn) => {
    const s = drawnNodes(tree).find((n) => n.props.key === "switch")!;
    return { ...(styleOf(s) as Box & { backgroundColor: string }), knob: styleOf(drawnNodes(s)[1]!) as Box };
  };
  // Its proportions: 0,2875 of the width, 0,46 of that tall, a capsule knob 1,28 times as wide as tall, 10,5 % in.
  const off = switchOf(draw(100, props()));
  assert.deepEqual([off.width, off.height], [311, 143]);
  assert.ok(Math.abs(off.knob.width / off.knob.height - 1.28) < 0.02 && off.knob.top === 15 && off.knob.left === 15, JSON.stringify(off.knob));
  // At the height where her fingertip goes highest, across in the original's middle (49,9 %) while her fingertip stays
  // on it (v9, Tristan: « le bouton n'est pas au centre »); off and grey until then.
  assert.ok(Math.abs(off.left + off.width / 2 - Math.round(1080 * 0.499)) <= 1 && Math.abs(off.top + off.height / 2 - 400) <= 1, JSON.stringify(off));
  assert.ok(Math.abs(tip(110).x - (off.left + off.width / 2)) <= 0.42 * 311, "her fingertip on it");
  assert.equal(off.backgroundColor, "#605e5a");
  // It flips in one image as her hand gets within a hair of the top: no image between; her colour, the knob on the right.
  const flips = [107, 108, 109, 110].map((f) => switchOf(draw(f, props())).backgroundColor);
  const at = flips.indexOf("#7a2e3b") + 107;
  assert.ok(at >= 108 && at <= 110, flips.join(" "));
  const on = switchOf(draw(at, props()));
  assert.equal(on.knob.left, 311 - 15 - on.knob.width);
  assert.equal(switchOf(draw(at - 1, props())).knob.left, 15);
  // Her poster there at once with it, never before; flat (nothing grows or fades in); under the switch, centred.
  const poster = (f: number) => drawnNodes(draw(f, props())).find((n) => n.props.key === "poster");
  assert.equal(poster(at - 1), undefined);
  const lit = poster(at)!;
  assert.doesNotMatch(JSON.stringify(lit), /opacity|scale|blur/);
  const texts = drawnNodes(lit).filter((n) => n.type === "FitText");
  assert.deepEqual(texts.map((n) => heldText(n).replace(/\s+/g, " ").trim()), ["Atelier Rose", "nouvelle collection", "dès samedi"]);
  assert.ok(texts.every((n) => (n.props.style as Box).top > on.top + on.height));
  // Each of its words inside the safe zone, left of the apps' buttons below the middle of the frame.
  for (const n of texts) {
    const b = n.props.style as Box;
    assert.ok(b.left >= 40 && b.top >= 80 && b.top + b.height <= 1440 && b.left + b.width <= (b.top + b.height > 960 ? 940 : 1040), `${heldText(n)}: ${JSON.stringify(b)}`);
  }
  // Her name in her second colour, her line in spaced capitals between two rules in the first, small labels beside it.
  assert.equal((texts[0]!.props.innerStyle as { color: string }).color, "#2c4a3e");
  assert.equal((texts[1]!.props.innerStyle as { color: string }).color, "#7a2e3b");
  assert.ok(drawnNodes(texts[1]!).some((n) => "data-fauve-accent" in n.props) && drawnNodes(texts[1]!).filter((n) => n.props.key === "a" || n.props.key === "b").length === 2);
  assert.ok(drawnNodes(lit).some((n) => n.type === "svg"), "its sparkle");
  // She passes in front of both: her cut-out laid after them, only from just before the flip.
  const order = (f: number) => drawnNodes(draw(f, props())).filter((n) => n.props.key === "switch" || n.props.key === "poster" || n.type === "Subject").map((n) => (n.type === "Subject" ? "her" : String(n.props.key)));
  assert.deepEqual(order(at), ["switch", "poster", "her"]);
  assert.deepEqual(order(at - 25), ["switch"]);
  // Nothing read (no hand, no outline): at the original's place, on its image 123.
  const { draw: bare } = await kitScene(interrupteur.code);
  const still = switchOf(bare(122, props()));
  assert.ok(Math.abs(still.left + still.width / 2 - 539) <= 1 && Math.abs(still.top + still.height / 2 - 394) <= 1, JSON.stringify(still));
  assert.equal(still.backgroundColor, "#605e5a");
  assert.equal(switchOf(bare(123, props())).backgroundColor, "#7a2e3b");
  // Her cut-out's outline when her hands were not tracked: the top of her raised arm.
  const outline = (f: number) => (f >= 90 && f <= 130 ? `M 640 ${f === 112 ? 500 : 760} L 700 900 L 560 1500 Z` : "M 640 1000 L 700 1100 L 560 1500 Z");
  const { draw: cut } = await kitScene(interrupteur.code, { outline });
  const fromOutline = switchOf(cut(80, props()));
  assert.ok(Math.abs(fromOutline.top + fromOutline.height / 2 - 500) <= 1, JSON.stringify(fromOutline));
  // No colour of hers dark enough: a phone's green, an ink; a logo that says her name is never written under again.
  const pale = { ...brand, accent: "#f5e6d8", palette: { light: "#ffffff" } };
  assert.equal(switchOf(bare(130, props({ brand: pale }))).backgroundColor, "#34c759");
  const withLogo = drawnNodes(bare(130, props({ brand: { ...brand, logoUrl: "/logo.png" } }))).find((n) => n.props.key === "poster")!;
  assert.ok(drawnNodes(withLogo).some((n) => n.type === "Img"));
  assert.ok(!drawnNodes(withLogo).some((n) => n.type === "FitText" && heldText(n).includes("Atelier Rose")));
  // Its ending card takes the place of her name and her line on the poster.
  const card = drawnNodes(bare(240, props({ end: { title: "Ouvert dimanche", subtitle: "de 10 h à 18 h", from: 225 } }))).find((n) => n.props.key === "poster")!;
  assert.deepEqual(drawnNodes(card).filter((n) => n.type === "FitText").map((n) => heldText(n).replace(/\s+/g, " ").trim()), ["Ouvert dimanche", "de 10 h à 18 h"]);
});

test("« Interrupteur » (v2): upright as her video, a horizontal one cropped on her reach when her gesture fits, else whole in a band; light to render", async () => {
  const { interrupteur } = await import("./skills/interrupteur.ts");
  const { subjectsDrawn, objectsDrawn, clearsDrawn, readsDrawn } = await import("./subject.ts");
  const { checkMotionCode } = await import("./motion-scene.ts");
  const line = interrupteur.timeline(1, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight" };
  const reelTexts = [{ text: "Atelier Rose", role: "hook", from: 123, to: 273, emphasis: [] }];
  const props = (aspect: number, extra: Record<string, string> = {}) => ({ width: 1080, height: 1920, durationInFrames: 273, brand, shots: rallumeShots(line, aspect), reelTexts, end: null, texts: { ...marks, ...extra } });
  type Box = { left: number; top: number; width: number; height: number };
  // Her hand at the top of her reach a little right of the middle of her picture (its own box, as laid), her body under it.
  const track = (f: number, box: Box) => {
    const x = box.left + box.width * 0.55;
    const y = box.top + box.height * (f === 120 ? 0.25 : 0.45);
    return { hands: [{ points: { index_tip: { x, y } } }], bodies: [{ points: { left_shoulder: { x: x - 80, y: box.top + box.height * 0.5, visible: true }, right_shoulder: { x: x + 80, y: box.top + box.height * 0.5, visible: true } } }] };
  };
  const wall = (tree: Drawn) => styleOf(drawnNodes(tree).find((n) => n.type === "Footage")!) as Box;
  const { draw } = await kitScene(interrupteur.code, { track });
  const { draw: bare } = await kitScene(interrupteur.code);
  // Upright: full frame. Horizontal with her whole gesture in a window: cropped on her reach, the window fixed (her video
  // laid at its own shape, her reach in the middle of the frame). Horizontal without anything read: whole in a band.
  assert.deepEqual(wall(draw(130, props(9 / 16))), { left: 0, top: 0, width: 1080, height: 1920 });
  const cropped = wall(draw(130, props(16 / 9)));
  assert.equal(cropped.width, 3413);
  assert.ok(Math.abs(cropped.left + cropped.width * 0.55 - 540) <= 1 && cropped.height === 1920, JSON.stringify(cropped));
  assert.deepEqual(wall(draw(10, props(16 / 9))), cropped);
  assert.deepEqual(wall(bare(130, props(16 / 9))), { left: 0, top: 656, width: 1080, height: 608 });
  // Her words: whole in the band, or full frame as asked.
  assert.deepEqual(wall(draw(130, props(16 / 9, { format: "horizontal" }))), { left: 0, top: 656, width: 1080, height: 608 });
  assert.deepEqual(wall(bare(130, props(16 / 9, { format: "vertical" }))), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(interrupteur.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]]]);
  // In the band, its switch at the band's scale (the original's 16,2 % of its height wide).
  assert.equal(styleOf(drawnNodes(bare(130, props(16 / 9))).find((n) => n.props.key === "switch")!).width, 98);
  // Light to render: her cut-out on her one shot only, nothing followed, no clear area, no reading; no zoom, no push;
  // her cut-out laid only from just before the flip.
  assert.deepEqual(checkMotionCode(interrupteur.code), []);
  assert.deepEqual(subjectsDrawn(interrupteur.code), [0]);
  assert.deepEqual([objectsDrawn(interrupteur.code), clearsDrawn(interrupteur.code), readsDrawn(interrupteur.code)], [[], [], []]);
  assert.doesNotMatch(interrupteur.code, /transform|scale\(/);
  assert.equal(drawnNodes(bare(100, props(9 / 16))).filter((n) => n.type === "Subject").length, 0);
  assert.equal(drawnNodes(bare(103, props(9 / 16))).filter((n) => n.type === "Subject").length, 1);
});

// ——— « Fenêtres et étiquettes » v2, written on its original's fiche (docs/fiches/fenetres.md) —————————————————————

/** The original's main line (its images at 30 i/s, measured cell by cell): where each shot first shows, its first cell or its cut. */
const FE_CUTS = [0, 4, 24, 40, 54, 101, 120, 136, 146, 156, 180, 194, 203, 265, 286, 305, 325, 340, 347, 365, 384];
/** Its shot by day, laid beside the night from this image to the night's end; its last image (13,8 s). */
const FE_DAY = 216;
const FE_END = 414;
/** Its composition's props on its timeline for n shots (its marks as its slot texts), all its shots of that shape; its two labels. */
async function fenetresAt(n: number, options: { end?: boolean; aspect?: number; settings?: Record<string, string> } = {}) {
  const { fenetres } = await import("./skills/fenetres.ts");
  const line = fenetres.timeline(n, { end: Boolean(options.end) });
  const durationInFrames = Math.round(line.duration * 30);
  const props = {
    width: 1080,
    height: 1920,
    durationInFrames,
    brand: { name: "Le Kiosque", displayFont: "Oswald", bodyFont: "IBM Plex Mono" },
    shots: decodeShots(line, () => options.aspect ?? 16 / 9),
    reelTexts: [
      { text: "OUVERT DÈS 8 H", role: "hook", from: 0, to: durationInFrames, emphasis: [] },
      { text: "50.8164° N, 0.1366° O", role: "caption", from: 0, to: durationInFrames, emphasis: [] },
    ],
    end: options.end ? { title: "Ouvert ce dimanche", subtitle: "de 9 h à 19 h", from: durationInFrames - 48 } : null,
    texts: { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...(options.settings ?? {}) },
  };
  const at = (f: number) => drawDecode(fenetres.code, f, props);
  return { fenetres, line, props, at, durationInFrames };
}
/** What a frame lays in its frame box: each shot drawn (its index, from where it plays, the rectangles it is cut to, its filter), each cut-out (its shot, its fill). */
const fenetresLayers = (tree: Drawn) => {
  const nodes = drawnNodes(tree);
  const rectsOf = (clip: unknown) => [...String(clip ?? "").matchAll(/M(-?\d+) (-?\d+)h(-?\d+)v(-?\d+)/g)].map((m) => m.slice(1).map(Number) as [number, number, number, number]);
  return {
    shots: nodes.filter((x) => x.type === "Footage").map((x) => ({ shot: x.props.shot as number, at: x.props.at as number | undefined, rects: rectsOf(styleOf(x).clipPath), filter: styleOf(x).filter as string | undefined })),
    cutouts: nodes.filter((x) => x.type === "Subject").map((x) => ({ shot: x.props.shot as number, at: x.props.at as number | undefined, fill: x.props.fill as string | undefined })),
    washes: nodes.filter((x) => x.type === "div" && x.props.key === "wash").map((x) => ({ background: String(styleOf(x).background), opacity: Number(styleOf(x).opacity), blend: styleOf(x).mixBlendMode })),
  };
};

test("« Fenêtres et étiquettes » (v2) cuts where its original does, on its own music (92,9 BPM), its music stopped in the intro's hole", async () => {
  const { fenetres, line } = await fenetresAt(22);
  const { skillPlan, skillFillInput } = await import("./skills.ts");
  assert.equal(fenetres.version, 3);
  assert.equal(fenetres.bpm, 92.9);
  // Its 21 shots one after the other, each where the original's first shows (its first cell, or its cut), within two
  // images; its shot by day laid beside the night from image 216 to the night's end; 13,8 s.
  const main = line.shots.filter((s) => !s.beside);
  assert.equal(line.shots.length, 22);
  assert.equal(main.length, FE_CUTS.length);
  main.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - FE_CUTS[i]!) <= 2, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${FE_CUTS[i]}`));
  const day = line.shots.findIndex((s) => s.beside);
  assert.equal(day, 13);
  assert.ok(Math.abs(Math.round(line.shots[day]!.start * 30) - FE_DAY) <= 2);
  assert.equal(line.shots[day]!.end, line.shots[day - 1]!.end);
  assert.ok(Math.abs(line.duration * 30 - FE_END) <= 2, `${line.duration} s`);
  // From the mirror on, a shot a beat of its music (the original's beats 13 to 19 from its first, at 0,53 s).
  const beat = 60 / 92.9;
  for (const i of [14, 15, 16, 18, 19, 20]) {
    const b = (main[i]!.start - 0.53) / beat;
    assert.ok(Math.abs(b - Math.round(b)) < 0.11, `shot ${i + 1} on beat ${b}`);
  }
  // Its music on its first beat, stopped after the intro's third kick and back with the drums on beat 4, the kick
  // ringing out; no sound effect (its original has none on its windows).
  assert.deepEqual(line.music, { downbeat: 0.53, pauses: [{ from: 2, to: 3.113, tail: 0.5 }] });
  assert.equal(line.sounds, undefined);
  // Its labels the whole Reel; the right one her place's coordinates, written by the engine.
  assert.deepEqual(line.texts, { gauche: { from: 0, to: line.duration }, droite: { from: 0, to: line.duration } });
  assert.equal(fenetres.texts.find((t) => t.slot === "droite")?.fact, "coordinates");
  // With an ending card, its cuts the same, its last shot held whole beats longer (the card's 1,6 s).
  const ended = fenetres.timeline(22, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(ended.duration - line.duration >= 1.6 && Math.abs(((ended.duration - line.duration) * 92.9) / 60 - 3) < 0.05, `${ended.duration} s`);
  // At another tempo, all of it follows its beats.
  const slower = fenetres.timeline(22, { end: false, bpm: 80 });
  assert.ok(Math.abs(slower.duration / line.duration - 92.9 / 80) < 0.01, `${slower.duration} s`);
  // Fewer shots: the moments without a signature go first, their time to the shot before them (or a beat less in its
  // last section): its cuts on the original's images still, the last section a shot a beat. More: shots held two beats
  // before the night. On the plan, for every count it takes, with or without its card: valid, 30 s at most.
  for (let n = fenetres.shots[0]; n <= fenetres.long!; n++) {
    const l = fenetres.timeline(n, { end: false });
    assert.equal(l.shots.length, n);
    const starts = l.shots.filter((s) => !s.beside).map((s) => Math.round(s.start * 30));
    if (n <= 22) for (const f of starts.slice(0, 7)) assert.ok(FE_CUTS.some((c) => Math.abs(c - f) <= 2), `${n} shots: ${starts.join(" ")}`);
    const last = l.shots.filter((s) => !s.beside).slice(-4);
    for (const s of last) {
      const b = (s.start - 0.53) / ((60 / 92.9) * 1);
      assert.ok(Math.abs(b - Math.round(b)) < 0.15 || Math.abs(b - Math.round(b) - 0.73) < 0.15 || Math.abs(b - Math.round(b) + 0.27) < 0.15, `${n} shots: ${s.start} s on beat ${b}`);
    }
    assert.ok(l.duration <= 30, `${n} shots: ${l.duration} s`);
    for (const end of [false, true]) {
      const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 16 }));
      const plan = skillPlan({ skill: fenetres, name: "Fenêtres et étiquettes", files, fill: { shots: Array.from({ length: n }, (_, i) => ({ file: files[i % 12]!.id, at: Math.floor(i / 12) * 5 })), texts: { gauche: "OUVERT DÈS 8 H", droite: "PARIS 9E" }, end: end ? { title: "Ouvert dimanche" } : null } });
      const parsed = editPlanSchema.safeParse(plan);
      assert.ok(parsed.success, `n=${n} end=${end}: ${parsed.success ? "" : parsed.error.message.slice(0, 300)}`);
      assert.equal(plan.segments.length, n);
      assert.ok(plan.segments.filter((s) => "beside" in s && s.beside).length === 1);
      assert.deepEqual(plan.music_shape?.pauses?.length, 1);
    }
  }
  assert.ok(Math.abs(fenetres.timeline(34, { end: false }).duration - 29.3) < 0.05);
  assert.ok(fenetres.timeline(11, { end: false }).duration < line.duration);
  // The filler sees which slot plays beside the night, and each slot's want.
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12, aspect: 16 / 9 }));
  const input = skillFillInput({ skill: fenetres, name: "Fenêtres et étiquettes", n: 22, files, business: {}, request: "" });
  assert.equal(input.cases[13]!.en_meme_temps_que, 13);
  assert.match(input.cases[12]!.veut, /le soir ou la nuit/);
  assert.match(input.cases[18]!.veut, /debout/);
});

test("« Fenêtres et étiquettes » (v2): cells in a snake, jumping windows, a window behind her, silhouettes, a split screen, squares, her subject before its place, the loop", async () => {
  const { at, line, durationInFrames } = await fenetresAt(22);
  const seen = Array.from({ length: durationInFrames }, (_, f) => fenetresLayers(at(f)));
  const bw = 1080;
  const bh = 608;
  // The next shot takes the 3 × 3 cells of the frame over the one before, already playing, a cell or two every two
  // images: from the top right (its first row right to left), then from the bottom left; a cell on each kick of the
  // intro (images 16, 36, 54); the shot alone once all are taken.
  const cells = (f: number, shot: number) => seen[f]!.shots.find((s) => s.shot === shot && !s.at)?.rects ?? [];
  assert.deepEqual(cells(4, 1), [[720, 0, 360, 203]]);
  assert.deepEqual(cells(6, 1).map((r) => r.slice(0, 2)), [[720, 0], [360, 0]]);
  assert.equal(cells(8, 1)[2]![0], 0);
  assert.deepEqual(cells(24, 2)[0], [0, 405, 360, 203]);
  for (const [f, shot] of [[16, 1], [36, 2], [54, 4]] as const) assert.ok(cells(f, shot).length > cells(f - 1, shot).length || (f === 54 && cells(54, 4).length > 0), `a cell on image ${f}`);
  assert.equal(seen[23]!.shots.length, 1);
  assert.ok(seen[5]!.shots.some((s) => s.shot === 0) && seen[5]!.shots.some((s) => s.shot === 1));
  // Windows of the frame's shape on the next shot, played from where they start (image 74), at its place: one of 21 %,
  // then two of 21 and 28 %, then two or three of a third, jumping every two images; then the cut, its white silhouette
  // just before it (97 to 100).
  const wins = (f: number) => seen[f]!.shots.find((s) => s.shot === 5 && s.at === 74)?.rects ?? [];
  assert.deepEqual([wins(73).length, wins(74).length, wins(83).length, wins(84).length, wins(89).length], [0, 1, 1, 2, 2]);
  assert.ok([90, 95, 100].every((f) => wins(f).length >= 2 && wins(f).every((r) => Math.abs(r[2] - 0.33 * bw) <= 1)));
  assert.ok(Math.abs(wins(74)[0]![2] - 0.21 * bw) <= 1 && Math.abs(wins(74)[0]![3] - 0.21 * bh) <= 1);
  assert.notDeepEqual(wins(74), wins(76));
  assert.equal(wins(101).length, 0);
  // The middle cell onto the waterfall from image 110, in negative 110 to 114 and 116 to 117, the cell above it taken
  // from 115; the person of the shot in front of it.
  const mid = (f: number) => seen[f]!.shots.find((s) => s.shot === 6 && s.at === 110);
  assert.deepEqual(mid(110)!.rects, [[360, 203, 360, 203]]);
  assert.deepEqual([110, 114, 115, 116, 117, 118, 119].map((f) => mid(f)!.filter ?? "colour"), ["invert(1)", "invert(1)", "colour", "invert(1)", "invert(1)", "colour", "colour"]);
  assert.equal(mid(115)!.rects.length, 2);
  assert.ok(seen[112]!.cutouts.some((c) => c.shot === 5 && !c.fill));
  // Its silhouettes, white or cream, two to four images before what comes (the 4x4's on its first cells), as the original's.
  const sils = new Map<number, number[]>();
  seen.forEach((s, f) => s.cutouts.filter((c) => c.fill).forEach((c) => sils.set(c.shot, [...(sils.get(c.shot) ?? []), f])));
  assert.deepEqual(Object.fromEntries(sils), { 2: [22, 23], 3: [40, 41], 5: [97, 98, 99, 100], 7: [132, 133, 134, 135], 10: [184, 185], 11: [192, 193], 14: [263, 264], 18: [329, 330] });
  const fills = (shot: number) => seen[sils.get(shot)![0]!]!.cutouts.find((c) => c.shot === shot)!.fill;
  assert.deepEqual([2, 3, 5, 7, 10, 11, 14, 18].map(fills), ["#fbf2db", "#fcf9fd", "#fcf9fd", "#fcf9fd", "#fbf2db", "#fbf2db", "#fcf9fd", "#fbf2db"]);
  // The valley cut in twice in the creek, 182 to 185 and 193.
  const back = seen.flatMap((s, f) => (s.shots.some((x) => x.shot === 9 && !x.rects.length) && f >= 180 ? [f] : []));
  assert.deepEqual(back, [182, 183, 184, 185, 193]);
  // The day slides in from the left over the night (21, 30, 37, 43, 47, then 50 %), then the middle block's halves swap,
  // a checkerboard, then its flashes, an image each: the day in negative, the night, the negative, the night, the day.
  const dayRects = (f: number) => seen[f]!.shots.find((s) => s.shot === 13 && !s.filter)!.rects;
  assert.deepEqual([216, 217, 218, 219, 220, 221, 230].map((f) => dayRects(f)[0]![2]), [227, 324, 400, 464, 508, 540, 540]);
  assert.deepEqual(dayRects(235), [[0, 0, 270, 608], [270, 0, 270, 152], [270, 456, 270, 152]]);
  assert.ok(dayRects(240).some((r) => r[0] === 540 && r[1] === 152));
  assert.deepEqual([256, 257, 258, 259, 260].map((f) => seen[f]!.shots.some((s) => s.shot === 13 && s.filter === "invert(1)")), [true, false, true, false, false]);
  assert.ok(dayRects(260).some((r) => r[0] === 270 && r[1] === 152));
  // Small squares lit one by one in reading order on her other shots, at their place (5 × 3), across the cut, 286 to 323.
  const square = (f: number) => seen[f]!.shots.filter((s) => s.rects.length === 1 && Math.abs(s.rects[0]![2] - 216) <= 1);
  assert.ok(Array.from({ length: 38 }, (_, k) => 286 + k).every((f) => square(f).length === 1), "a square at each image");
  assert.equal(square(324).length + square(285).length, 0);
  const order = [286, 287, 289, 293, 296, 299, 301, 305, 307, 308, 312, 315, 317, 319].map((f) => square(f)[0]!.rects[0]!);
  assert.deepEqual(order.slice(0, 4).map((r) => [r[0], r[1]]), [[0, 0], [216, 0], [432, 0], [864, 0]]);
  assert.ok(order.every((r, k) => k === 0 || r[1] > order[k - 1]![1] || r[0] > order[k - 1]![0]), "in reading order");
  assert.ok(seen[290]!.shots.every((s) => s.shot !== 15 || !s.rects.length) && square(290)[0]!.shot !== 15 && square(290)[0]!.shot !== 16);
  // The three shots after the next in turn, each on its first image (played from after the Reel's end): three images to
  // read for its fourteen squares, not a seek in another video each (its passage rendered 3 times slower than plans-fixes).
  const squared = Array.from({ length: 38 }, (_, k) => square(286 + k)[0]!);
  assert.deepEqual([...new Set(squared.map((s) => s.shot))].sort((a, b) => a - b), [17, 18, 19]);
  assert.ok(squared.every((s) => s.at! > durationInFrames));
  // Her subject before its place: its cream silhouette on the truck (329, 330), then her in colour on it while her own
  // place comes round her by big rectangles (the truck's bottom right last), then her shot alone at 340.
  const decor = (f: number) => seen[f]!.shots.find((s) => s.shot === 18 && s.at === 329)?.rects.length ?? 0;
  assert.deepEqual([330, 331, 333, 335, 336, 339, 340].map(decor), [0, 2, 3, 4, 5, 5, 0]);
  assert.ok([331, 335, 339].every((f) => seen[f]!.cutouts.some((c) => c.shot === 18 && !c.fill && c.at === 329)));
  assert.ok(seen[340]!.cutouts.length === 0 && seen[340]!.shots.some((s) => s.shot === 18 && !s.rects.length));
  // Light on its cuts: washed white (146 to 148), a light flash on the friends' cut (304, 305), a warm burn on the peak
  // (347, 348), cream (365, 366, 384).
  const washed = seen.flatMap((s, f) => (s.washes.length ? [f] : []));
  assert.deepEqual(washed, [146, 147, 148, 304, 305, 347, 348, 365, 366, 384]);
  assert.deepEqual([365, 366, 384].map((f) => seen[f]!.washes[0]!.background), ["#faf2dc", "#cfc7b4", "#faf2dc"]);
  assert.deepEqual([146, 147, 148].map((f) => seen[f]!.washes[0]!.opacity), [0.75, 0.5, 0.25]);
  assert.ok(seen[347]!.washes[0]!.blend === "screen" && /linear-gradient/.test(seen[347]!.washes[0]!.background));
  // The loop: the first shot back on the last through two or three windows of 28 %, held on its first image (played
  // from after the Reel's end), then alone, the Reel's last image its first one.
  const loop = (f: number) => seen[f]!.shots.find((s) => s.shot === 0);
  assert.ok([384, 395, 407].every((f) => loop(f)!.at! > durationInFrames && loop(f)!.rects.length >= 2 && loop(f)!.rects.every((r) => Math.abs(r[2] - 0.28 * bw) <= 1)));
  assert.ok([408, 413].every((f) => loop(f)!.at! > durationInFrames && !loop(f)!.rects.length));
  assert.equal(line.shots.length, 22);
});

test("« Fenêtres et étiquettes » (v2): horizontal 16:9 on black as its original when her videos are, full frame otherwise or on her word; its labels fixed; cut out only where drawn", async () => {
  const { fenetres } = await import("./skills/fenetres.ts");
  const { skillSettings, skillPlan } = await import("./skills.ts");
  const frameOf = (tree: Drawn) => {
    const box = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!;
    return { top: styleOf(box).top, height: styleOf(box).height };
  };
  const wide = await fenetresAt(22);
  const tall = await fenetresAt(22, { aspect: 9 / 16 });
  assert.deepEqual(frameOf(wide.at(60)), { top: 656, height: 608 });
  assert.deepEqual(frameOf(tall.at(60)), { top: 0, height: 1920 });
  assert.equal(frameOf((await fenetresAt(22, { settings: { format: "vertical" } })).at(60)).height, 1920);
  assert.equal(frameOf((await fenetresAt(22, { aspect: 9 / 16, settings: { format: "horizontal" } })).at(60)).top, 656);
  assert.deepEqual(fenetres.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(fenetres, [{ name: "format", value: "auto" }]), {});
  // Upright: its cells and windows of the frame's shape (a third of it each), its squares 3 × 5.
  const tallCells = fenetresLayers(tall.at(6)).shots.find((s) => s.shot === 1)!.rects;
  assert.deepEqual(tallCells[0], [720, 0, 360, 640]);
  assert.deepEqual(fenetresLayers(tall.at(286)).shots.find((s) => s.rects.length === 1 && s.rects[0]![2] === 360)?.rects[0], [0, 0, 360, 384]);
  // Its two labels at the original's distance from the edges (10,3 % and 89,9 % of the width), just above the middle,
  // clear of the apps' buttons; thin white capitals as tall as the original's, decor (Tristan's exception for its tiny
  // type), no shadow; the same box at every image, over everything, both formats; never animated.
  const labels = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "FitText" && /OUVERT|50\.8164/.test(heldText(n))).map((n) => n.props.style as { left: number; top: number; width: number; height: number });
  for (const { at } of [wide, tall]) {
    const first = labels(at(0));
    assert.equal(first.length, 2);
    assert.equal(first[0]!.left, 111);
    assert.equal(first[1]!.left + first[1]!.width, 971);
    assert.ok(first.every((b) => b.top + b.height <= 940 && b.top >= 820), JSON.stringify(first));
    for (const f of [100, 220, 300, 413]) assert.deepEqual(labels(at(f)), first);
  }
  const style = drawnNodes(wide.at(0)).find((n) => n.type === "FitText")!.props.innerStyle as Record<string, unknown>;
  // v3: a little heavier and larger than the original's thin capitals, with a soft dark shadow (« ce qui est écrit se voit moyen »).
  assert.deepEqual([style.color, style.textShadow, style.textTransform, style.fontSize, style.fontWeight], ["#f1f2f4", "0 0 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.7)", "uppercase", 44, 500]);
  assert.ok(drawnNodes(wide.at(0)).filter((n) => "data-fauve-decor" in n.props).map(heldText).join(" ").includes("OUVERT DÈS 8 H"));
  const kids = drawnNodes(wide.at(100))[0]!.children as Drawn[];
  assert.ok(kids.findIndex((k) => k && k.type === "FitText") > kids.findIndex((k) => k && styleOf(k).overflow === "hidden"));
  // Its ending card over the first shot held, darkened: its title and its line, the labels still there.
  const ended = await fenetresAt(22, { end: true });
  const card = ended.at(ended.durationInFrames - 20);
  assert.ok(heldText(card).includes("Ouvert ce dimanche") && heldText(card).includes("de 9 h à 19 h") && labels(card).length === 2);
  // Light to render: at most three of her shots and two cut-outs at once; she is cut out only on the shots its code
  // draws her on, as its timeline says them, for every count it plays (with an ending card too): 4,5 s of video at most.
  for (const [n, end] of [[11, false], [16, false], [22, false], [22, true], [28, false], [34, false]] as const) {
    const run = await fenetresAt(n, { end });
    const drawn = await cutoutsDrawn(fenetres.code, run.props, Array.from({ length: run.durationInFrames }, (_, f) => f));
    assert.deepEqual([...drawn].sort((a, b) => a - b), run.line.cutouts, `${n} shots${end ? ", an ending card" : ""}`);
    const most = Math.max(...Array.from({ length: run.durationInFrames }, (_, f) => fenetresLayers(run.at(f))).map((l) => l.shots.length + 2 * l.cutouts.length));
    assert.ok(most <= 5, `${n} shots: ${most}`);
    const seconds = run.line.cutouts!.reduce((s, k) => s + run.line.shots[k]!.end - run.line.shots[k]!.start, 0);
    assert.ok(run.line.cutouts!.length <= 8 && seconds <= 4.5, `${n} shots: ${run.line.cutouts!.length} cut out, ${seconds} s`);
  }
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 16 }));
  const plan = skillPlan({ skill: fenetres, name: "Fenêtres et étiquettes", files, fill: { shots: Array.from({ length: 22 }, (_, i) => ({ file: files[i % 12]!.id, at: 1 })), texts: { gauche: "OUVERT DÈS 8 H", droite: "PARIS 9E" }, end: null, settings: { format: "vertical" } } });
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 22, subjects: [2, 3, 5, 7, 10, 11, 14, 18] });
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
  assert.deepEqual(plan.skill, { key: "fenetres", version: 3, settings: { format: "vertical" } });
  // Its look is its model's (no grain, no corners on the black); its code within a plan's 24 000 characters; no zoom,
  // nothing of its original's (its altitude, its coordinates, its pass).
  assert.deepEqual(fenetres.finish, { grain: 0, vignette: 0 });
  assert.ok(fenetres.code.length <= 24000, `${fenetres.code.length}`);
  assert.doesNotMatch(fenetres.code, /scale\(|FEET|32\.9585|Shinkun/i);
});

// ——— « Interface minimaliste » v2, written on its original's fiche (docs/fiches/interface.md) ———————————————————————

/** Its original's moments (its images at 30 i/s, measured image by image), before the two holds its model lengthens. */
const IF_AT = { hook: 4, out: 44, list: 51, line: 95, ann: 121, erase: 165, type: 172, icon: 217, card: 234, zoom: 270, click: 295, pill: 305, at: 332, end: 381 };
/** Her words, as the filler writes them for « Atelier Argile ». */
const IF_WORDS: Record<string, string> = { accroche: "Un nouveau départ", liste: "tournage, émail, cuisson", etiquette: "ce que je fais", annonce: "j'ouvre ma page pour montrer mes pièces", promesse: "des pièces qui durent", metier: "céramiste", compte: "@atelier.argile" };
/** Its composition at a frame on its timeline, her words at their moments, her photo (or none), as turnedAt runs it. */
async function interfaceAt(options: { end?: boolean; photo?: boolean; words?: Record<string, string>; settings?: Record<string, string>; brand?: Record<string, unknown> } = {}) {
  const { interfaceSkill } = await import("./skills/interface.ts");
  const words = options.words ?? IF_WORDS;
  const line = interfaceSkill.timeline(1, { end: Boolean(options.end), words });
  const durationInFrames = Math.round(line.duration * 30);
  const reelTexts = interfaceSkill.texts.flatMap((t) => (words[t.slot] && line.texts[t.slot] ? [{ text: words[t.slot]!, role: t.role, from: Math.round(line.texts[t.slot]!.from * 30), to: Math.round(line.texts[t.slot]!.to * 30), emphasis: [] }] : []));
  const props = {
    durationInFrames,
    brand: { name: "Atelier Argile", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#b5543a", ...options.brand },
    shots: options.photo === false ? [] : [{ src: "/her.jpg", aspect: 9 / 16, from: 0, durationInFrames, kind: "photo", segment: 0 }],
    reelTexts,
    end: options.end ? { title: "Atelier ouvert samedi", subtitle: "de 10 h à 18 h", from: durationInFrames - 48 } : null,
    texts: { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...(options.settings ?? {}) },
  };
  return { interfaceSkill, line, durationInFrames, at: (f: number) => turnedAt(interfaceSkill.code, f, props) };
}
/** The nodes of a tree whose style matches, and a node's words. */
const ifFind = (tree: Drawn, test: (n: Drawn) => boolean) => drawnNodes(tree).filter(test);
const ifSeen = (n: Drawn) => Number(styleOf(n).opacity ?? 1);

test("« Interface minimaliste » (v2) lays its moments where its original does, on its own music (110,5 BPM), two holds lengthened for a phone", async () => {
  const { interfaceSkill, interfaceImages } = await import("./skills/interface.ts");
  assert.equal(interfaceSkill.version, 3);
  assert.equal(interfaceSkill.bpm, 110.5);
  const line = interfaceSkill.timeline(1, { end: false, words: IF_WORDS });
  // Each moment on the original's image, within two, its announcement held two beats longer and its typed promise one
  // (the engine reads a sentence in 0,8 s and 0,3 s a word: the original holds them 0,8 and 0,5 s).
  const beat = (30 * 60) / 110.5;
  for (const [k, f] of Object.entries(IF_AT)) {
    const more = (f >= IF_AT.erase ? 2 * beat : 0) + (f >= IF_AT.icon ? beat : 0);
    if (k !== "end") assert.ok(Math.abs(line.marks[k]! - (f + more)) <= 2, `${k}: image ${line.marks[k]}, the original's ${f} + ${Math.round(more)}`);
  }
  assert.deepEqual(interfaceImages().end, IF_AT.end + 3 * beat);
  assert.ok(Math.abs(line.duration * 30 - (IF_AT.end + 3 * beat)) <= 1, `${line.duration} s`);
  // Its one shot, her photo, the whole Reel long; each of her texts in its moment.
  assert.deepEqual(line.shots.map((s) => [s.start, s.end]), [[0, line.duration]]);
  assert.deepEqual(Object.keys(line.texts), ["accroche", "liste", "etiquette", "annonce", "promesse", "metier", "compte"]);
  assert.ok(line.texts.accroche!.to <= line.texts.liste!.from && line.texts.annonce!.from < line.texts.promesse!.from && line.texts.compte!.to === line.duration);
  // Its sounds, its original's: a soft key click every other letter of her promise as the caret types it (38 a second),
  // a double click on « Suivre », the second just after its beat.
  const [typing, click1, click2] = line.sounds!;
  assert.ok(Math.abs(typing!.at - line.marks.type! / 30) < 1 / 30);
  assert.equal(typing!.burst!.times.length, Math.ceil(Array.from(IF_WORDS.promesse!).length / 2));
  assert.ok(Math.abs(typing!.burst!.times[1]! - 2 / 38) < 0.002);
  assert.ok(click1!.at < line.marks.click! / 30 && click2!.at > line.marks.click! / 30 && Math.abs(click2!.at - click1!.at - 0.09) < 0.002);
  assert.equal(line.sounds!.length, 3);
  // Its music soft (10 dB under) until the icon lands, open on a downbeat of its bars (from its first beat at 0,04 s),
  // fading over its last second.
  const music = line.music!;
  assert.equal(music.downbeat, 0.04);
  const opens = music.filters![0]!;
  assert.deepEqual([opens.kind, opens.db, opens.from], ["soft", -10, 0]);
  const bars = (opens.to - 0.04) / (60 / 110.5) / 4;
  assert.ok(Math.abs(bars - Math.round(bars)) < 0.02 && Math.abs(opens.to * 30 - (line.marks.icon! - 4.3)) < 0.5, `${opens.to} s`);
  assert.deepEqual(music.end, { at: line.duration, fade: 1 });
  // With an ending card, its moments the same, the card's 1,6 s after her account; at another tempo all of it follows.
  const ended = interfaceSkill.timeline(1, { end: true, words: IF_WORDS });
  assert.deepEqual(ended.marks, line.marks);
  assert.ok(ended.duration - line.duration >= 1.6 && ended.texts.compte!.to === line.duration);
  const slower = interfaceSkill.timeline(1, { end: false, bpm: 92 });
  assert.ok(Math.abs(slower.marks.pill! / line.marks.pill! - 110.5 / 92) < 0.01 && Math.abs(slower.duration / line.duration - 110.5 / 92) < 0.01);
});

test("« Interface minimaliste » (v2): each element becomes the next, through the blur, on the original's places and sizes", async () => {
  const { line, at } = await interfaceAt();
  const m = line.marks as Record<string, number>;
  // Her first words a letter an image from image 4, at the middle, its last word in the serif italic.
  const letters = (f: number) => ifFind(at(f), (n) => n.type === "span" && styleOf(n).display === "inline-block" && styleOf(n).whiteSpace === "pre" && ifSeen(n) > 0.05).map(drawnText).join("");
  assert.equal(letters(3), "");
  assert.ok(letters(8).length >= 3 && letters(8).length < letters(14).length, `${letters(8)} / ${letters(14)}`);
  assert.equal(letters(30).replace(/\s/g, ""), "Unnouveaudépart");
  const italic = ifFind(at(30), (n) => n.type === "span" && styleOf(n).fontStyle === "italic")[0]!;
  assert.equal(heldText(italic).replace(/\s/g, ""), "départ");
  assert.match(String(styleOf(italic).fontFamily), /Instrument Serif/);
  // Its last word rises into the label's place, halved and grey; the label in small spaced capitals (an accent) takes
  // its place letter by letter.
  const moved = ifFind(at(m.out! + 12), (n) => n.type === "span" && styleOf(n).fontStyle === "italic")[0]!;
  assert.match(String(styleOf(moved).transform), /scale\(0\.500\)/);
  assert.equal(styleOf(moved).color, "#87888e");
  const label = ifFind(at(m.list! + 20), (n) => n.type === "div" && styleOf(n).letterSpacing === "0.4em")[0]!;
  assert.equal(heldText(label).replace(/\s/g, ""), "cequejefais");
  assert.deepEqual([styleOf(label).fontSize, styleOf(label).top, styleOf(label).textTransform], [21, 806, "uppercase"]);
  assert.ok(drawnNodes(label).some((n) => "data-fauve-accent" in n.props));
  // Her list through the middle line: the item there sharp and black, its neighbours 75 px above and below, pale and
  // blurred; a step a beat; the last underlined by a tapering stroke in the blue's gradient, drawn from the left.
  const items = (f: number) => ifFind(at(f), (n) => n.type === "FitText" && (n.props.style as { height: number }).height === 75).map((n) => ({ text: heldText(n).trim(), top: (n.props.style as { top: number }).top, opacity: Number((n.props.innerStyle as Record<string, unknown>).opacity), filter: String((n.props.innerStyle as Record<string, unknown>).filter) }));
  const settled = items(m.list! + 26);
  const middle = settled.find((x) => x.top === 922)!;
  assert.equal(middle.text, "Émail");
  assert.ok(middle.opacity === 1 && middle.filter === "none");
  assert.ok(settled.filter((x) => x.top !== 922).every((x) => Math.abs(x.top - 922) === 75 && x.opacity <= 0.15 && /blur/.test(x.filter)), JSON.stringify(settled));
  const stroke = ifFind(at(m.line! + 12), (n) => /polygon\(0% 8%, 100% 50%/.test(String(styleOf(n).clipPath)))[0]!;
  assert.match(String(styleOf(stroke).background), /#1051c4, #222853/);
  assert.equal(items(m.line! + 12).find((x) => x.top === 922)!.text, "Cuisson");
  // Her announcement on two lines rising word by word, its two last words italic, then erased from the left.
  const ann = ifFind(at(m.ann! + 30), (n) => n.type === "FitText" && n.props.key === "ann")[0]!;
  assert.equal(drawnNodes(ann).filter((n) => n.type === "div" && n.props.key !== undefined).length, 2);
  assert.equal(drawnNodes(ann).filter((n) => n.type === "span" && styleOf(n).fontStyle === "italic").map((n) => heldText(n).replace(/\s/g, "")).join(" "), "mes pièces");
  const erased = (f: number) => drawnNodes(ifFind(at(f), (n) => n.type === "FitText" && n.props.key === "ann")[0]).filter((n) => n.type === "span" && styleOf(n).opacity === 0).length;
  assert.ok(erased(m.erase! + 3) > 0 && erased(m.erase! + 3) < erased(m.erase! + 7));
  // Her promise typed from the type mark, 38 letters a second, behind a blue caret that never blinks and fades after it.
  const typedCount = (f: number) => drawnNodes(ifFind(at(f), (n) => n.type === "FitText" && n.props.key === "typed")[0]).filter((n) => n.type === "span" && styleOf(n).opacity === 1 && !styleOf(n).position).map(drawnText).join("").length;
  assert.ok(Math.abs(typedCount(m.type! + 8) - Math.floor((8 * 38) / 30 + 1)) <= 1, `${typedCount(m.type! + 8)}`);
  assert.equal(typedCount(m.type! - 1), 0);
  const caret = (f: number) => ifFind(at(f), (n) => n.type === "span" && styleOf(n).width === 3)[0];
  assert.ok([m.type! + 5, m.type! + 9, m.type! + 13, m.type! + 20].every((f) => styleOf(caret(f)!).opacity === 1), "never blinks");
  assert.equal(styleOf(caret(m.icon! + 2)!).opacity, 0);
  assert.equal(styleOf(caret(m.type! + 5)!).background, "#1051c4");
  // The app's icon lands on her last word, glides to the middle; it opens into her card (768 × 485 at the middle).
  const plate = (f: number) => ifFind(at(f), (n) => n.type === "div" && n.props.key === "shape")[0];
  const p0 = styleOf(plate(m.icon! + 1)!);
  assert.ok(Number(p0.left) + Number(p0.width) / 2 > 600 && Number(p0.width) === 119, JSON.stringify(p0));
  const p1 = styleOf(plate(m.icon! + 15)!);
  assert.ok(Math.abs(Number(p1.left) + Number(p1.width) / 2 - 540) < 1, JSON.stringify(p1));
  const open = ["left", "top", "width", "height"].map((k) => Number(styleOf(plate(m.card! + 20)!)[k]));
  assert.ok([156, 718, 768, 485].every((v, i) => Math.abs(open[i]! - v) <= 1), open.join(" "));
  const card = at(m.card! + 25);
  for (const w of ["atelier.argile", "Atelier Argile", "Céramiste", "Message", "S'abonner"]) assert.ok(heldText(card).includes(w), w);
  assert.ok(ifFind(card, (n) => "data-fauve-decor" in n.props).some((n) => heldText(n).includes("Tournage. Émail. Cuisson.")));
  // The zoom as a camera: « Suivre » to the middle 1,5 times larger, the card gone but her photo and the button.
  const btn = (f: number) => styleOf(ifFind(at(f), (n) => n.type === "div" && n.props.key === "btn")[0]!);
  const zoomed = btn(m.zoom! + 24);
  assert.ok(Math.abs(Number(zoomed.left) + Number(zoomed.width) / 2 - 540) < 1 && Math.abs(Number(zoomed.top) + Number(zoomed.height) / 2 - 960) < 1 && Math.abs(Number(zoomed.width) - 505.5) < 1, JSON.stringify(zoomed));
  assert.equal(plate(m.zoom! + 10), undefined);
  // An arrow, no ring, from the bottom right in an arc onto its right part; the blue fades, « Suivi(e) » rises.
  const arrow = (f: number) => styleOf(ifFind(at(f), (n) => n.props.key === "arrow")[0]!);
  assert.deepEqual([Number(arrow(m.zoom! + 1).left) + 3, Number(arrow(m.zoom! + 1).top) + 3], [702, 1651]);
  assert.deepEqual([Number(arrow(m.zoom! + 23).left) + 3, Number(arrow(m.zoom! + 23).top) + 3], [648, 979]);
  assert.ok(!drawnNodes(at(m.click!)).some((n) => n.type === "Cursor"));
  assert.ok(heldText(at(m.click! + 9)).includes("Abonné(e)"));
  // Folded into a white pill with her account and a tick, round at its ends; then her account alone in the gradient
  // with its « @ », « À SUIVRE » over it.
  const pill = btn(m.pill! + 14);
  assert.ok(Number(pill.height) === 96 && Number(pill.borderRadius) === 48 && Math.abs(Number(pill.left) + Number(pill.width) / 2 - 540) < 1, JSON.stringify(pill));
  assert.ok(heldText(at(m.pill! + 14)).includes("atelier.argile"));
  const fin = at(m.at! + 30);
  assert.ok(heldText(fin).includes("@") && heldText(fin).includes("atelier.argile") && heldText(fin).replace(/\s/g, "").includes("ÀSUIVRE"));
  assert.ok(ifFind(fin, (n) => /#0c3a83, #181744/.test(String(styleOf(n).backgroundImage))).length === 2);
});

test("« Interface minimaliste » (v2): her photo in the round, her colour on her word, her name without « @ » when her account is not known, nothing of its original's", async () => {
  const { interfaceSkill, line, at } = await interfaceAt();
  const m = line.marks as Record<string, number>;
  // Her photo in its round, in black and white, on her face (the upper middle of an upright one).
  const face = ifFind(at(m.card! + 25), (n) => n.type === "Footage")[0]!;
  assert.match(String(styleOf(face).filter), /grayscale\(1\)/);
  assert.ok(Number(styleOf(face).width) > 134 && Number(styleOf(face).top) < 0, JSON.stringify(styleOf(face)));
  // No photo: her initial on her colour.
  const none = (await interfaceAt({ photo: false })).at(m.card! + 25);
  assert.ok(!drawnNodes(none).some((n) => n.type === "Footage") && drawnNodes(none).some((n) => drawnText(n) === "A" && /rgb\(181,84,58\)/.test(String(styleOf(n).background))));
  // Her colour on her word (the blue when hers is too pale to read on the ground).
  const hers = (await interfaceAt({ settings: { couleur: "sienne" } })).at(m.line! + 12);
  assert.ok(ifFind(hers, (n) => /rgb\(181,84,58\)/.test(String(styleOf(n).background))).length > 0);
  const pale = (await interfaceAt({ settings: { couleur: "sienne" }, brand: { accent: "#f4efe6" } })).at(m.line! + 12);
  assert.ok(ifFind(pale, (n) => /#1051c4/.test(String(styleOf(n).background))).length > 0);
  assert.deepEqual(interfaceSkill.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["couleur", ["bleu", "sienne"]]]);
  // Her account not known: her name, without « @ ».
  const named = (await interfaceAt({ words: { ...IF_WORDS, compte: "Atelier Argile" } })).at(m.at! + 30);
  assert.ok(heldText(named).includes("Atelier Argile") && !heldText(named).includes("@"));
  // Its ending card, out of the blur after her account.
  const ended = await interfaceAt({ end: true });
  const card = ended.at(ended.durationInFrames - 10);
  assert.ok(heldText(card).includes("Atelier ouvert samedi") && heldText(card).includes("de 10 h à 18 h") && !heldText(card).includes("SUIVRE"));
  // Its words where they read, a little over the engine's 48 px; its labels and its card as accents (20 px at least) or decor.
  const sizes = drawnNodes(at(m.list! + 26)).flatMap((n) => (n.type === "FitText" ? [Number((n.props.innerStyle as Record<string, unknown>).fontSize)] : []));
  assert.ok(sizes.every((s) => s === 50), sizes.join(" "));
  // Its pale ground as it is; Instrument Serif brought; its code within a plan's 24 000 characters; nothing of its
  // original's words, handle or name; no flash, no grain.
  assert.deepEqual(interfaceSkill.finish, { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 });
  assert.deepEqual(interfaceSkill.fonts, ["Instrument Serif"]);
  assert.ok(interfaceSkill.code.length <= 24000, `${interfaceSkill.code.length}`);
  assert.doesNotMatch(interfaceSkill.code + JSON.stringify(interfaceSkill.texts), /Follow|tejya|Tejas|WHAT I DO|Giving brands|Editor\b|beginning/);
  // On her plan: valid, its one shot her photo, its sounds and its music.
  const { skillPlan } = await import("./skills.ts");
  const files = [{ id: "her", photo: true, seconds: 0, aspect: 9 / 16 }];
  const plan = skillPlan({ skill: interfaceSkill, name: "Interface minimaliste", files, fill: { shots: [{ file: "her", at: 0 }], texts: IF_WORDS, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.skill, { key: "interface", version: 3 });
  assert.equal(plan.texts.length, 7);
  assert.equal(plan.sounds?.length, 3);
  assert.equal(plan.music_shape?.filters?.[0]?.kind, "soft");
});

// ---------------------------------------------------------------------------
// « Mot clé en grand » and « Face caméra et références », the two models timed on her voice, and the voice tools their
// fiches found missing: her images on what she says, her business's name said, the frame changing on a word's attack.
// ---------------------------------------------------------------------------

/** A voice skill's answer from the filler, as readSkillFill takes it. */
const voiceAnswer = (voice: Record<string, unknown>) => ({ fits: true, missing: "", shots: [], texts: [], end: null, why: "", voice }) as unknown as import("./skills.ts").SkillFillAnswer;

test("a skill timed on her voice: her images of what she names laid beside her talk from the instant she names them, her name marked", async () => {
  const { skillTalk, readSkillFill, skillPlan, skillFillInput, SKILL_FILL_PROMPT, skillFillSchema } = await import("./skills.ts");
  const base = await voicedSkill();
  const skill = { ...base, voice: { ...base.voice!, refs: "une photo ou une vidéo de ce qu'elle nomme", name: "son logo sur son nom" } };
  const talk = skillTalk(talkFacts)!;
  const files = [
    { id: "talk", photo: false, seconds: 10 },
    { id: "hiver", photo: true, seconds: 0 },
    { id: "gommage", photo: true, seconds: 0 },
    // A video shorter than its span: all of it, slowed down; one longer: from its best moment.
    { id: "masque", photo: false, seconds: 0.5 },
    { id: "huile", photo: false, seconds: 6, moments: [{ start: 2, end: 4 }] },
  ];
  const [first, second, third] = talkAnswer.ideas;
  const answer = voiceAnswer({
    ...talkAnswer,
    ideas: [
      // Her talking video is never one of her images, nor a file she does not have; each file once in the Reel.
      { ...first, files: ["hiver", "talk", "nope"] },
      { ...second, items: second!.items.map((item, j) => ({ ...item, file: ["gommage", "masque", "huile"][j] })) },
      { ...third, files: ["hiver"] },
    ],
    name: { from: 16, to: 16 },
  });
  const fill = readSkillFill(skill, files, 4, answer, { talk })!;
  assert.deepEqual(fill.said!.ideas.map((i) => i.files ?? []), [["hiver"], [], []]);
  assert.deepEqual(fill.said!.ideas[1]!.items.map((i) => i.file), ["gommage", "masque", "huile"]);
  assert.deepEqual(fill.said!.name, { from: 16, to: 16 });
  // A skill that lays no images keeps none, nor her name.
  const plain = readSkillFill(base, files, 4, answer, { talk })!;
  assert.ok(plain.said!.ideas.every((i) => !i.files && i.items.every((x) => !x.file)) && plain.said!.name === undefined);

  const plan = skillPlan({ skill, name: "Mot clé", files, fill, talk });
  assert.ok(editPlanSchema.safeParse(plan).success);
  // Her talk's four shots, then her images beside it, each from its moment: the idea's own from where it begins to the
  // next idea, each name's from the instant she says it to the next one, never heard; her talk alone makes its length.
  assert.equal(plan.duration, 7.95);
  assert.deepEqual(plan.segments.slice(4).map((s) => ("clip_id" in s ? [s.clip_id, s.in, s.out, s.speed ?? 1, s.beside?.at] : [])), [
    ["hiver", 0, 3.68, 1, 0],
    ["gommage", 0, 0.8, 1, 3.97],
    ["masque", 0, 0.5, 0.63, 4.77],
    ["huile", 2, 2.69, 1, 5.57],
  ]);
  assert.ok(plan.segments.slice(0, 4).every((s) => "clip_id" in s && s.clip_id === "talk" && !s.beside));
  // Its code finds them by marks: how many of its shots are her talk, each image's idea, item and span; her name said.
  const marks = plan.layers![0]!.motion.texts!;
  assert.equal(marks.said_shots, "4");
  assert.equal(marks.said_refs, "4");
  assert.deepEqual([marks.said_ref1_idea, marks.said_ref1_item, marks.said_ref1_from, marks.said_ref1_to], ["1", "0", "0", "110"]);
  assert.deepEqual([marks.said_ref3_idea, marks.said_ref3_item, marks.said_ref3_from, marks.said_ref3_to], ["2", "2", "143", "167"]);
  assert.deepEqual([marks.said_name_from, marks.said_name_to], ["192", "203"]);
  // The composition gets them after her talk, each on its frame.
  const props = buildReelProps(editPlanSchema.parse(plan), { template: "libre", clipUrls: Object.fromEntries(files.map((f) => [f.id, `https://x/${f.id}`])), photoIds: ["hiver", "gommage"], brand: { name: "Lune" }, words: { talk: talkFacts.words } });
  assert.deepEqual(props.layers![0]!.shots!.map((s) => [s.kind, s.from]), [["video", 0], ["video", 35], ["video", 110], ["video", 187], ["photo", 0], ["photo", 119], ["video", 143], ["video", 167]]);
  // The filler is told what her images are, which video is hers, and to mark her name.
  const input = skillFillInput({ skill, name: "Mot clé", n: 4, files, business: { name: "Lune" }, request: "", talk }) as unknown as { voix: Record<string, unknown> };
  assert.match(String(input.voix.images), /de ce qu'elle nomme ; chaque fichier une seule fois/);
  assert.deepEqual(input.voix.sa_video, ["talk"]);
  assert.equal(input.voix.son_nom, "son logo sur son nom");
  assert.match(SKILL_FILL_PROMPT, /"files" of an idea and "file" of each name/);
  assert.ok(skillFillSchema.shape.voice.unwrap().shape.name);
  // A skill whose code writes her first phrase itself asks for no hook, and keeps none.
  const own = { ...skill, voice: { ...skill.voice, hook: undefined } };
  assert.match(String((skillFillInput({ skill: own, name: "Créateur", n: 4, files, business: {}, request: "", talk }) as unknown as { voix: { accroche: string } }).voix.accroche), /^aucune/);
  assert.equal(readSkillFill(own, files, 4, answer, { talk })!.said!.hook, null);
});

test("a skill timed on her voice: the frame changes on the next idea's first word when it says so, on a cut of her pauses when one is near", async () => {
  const { skillTalk, readSaid, skillSaid } = await import("./skills.ts");
  const skill = await voicedSkill();
  const talk = skillTalk(talkFacts)!;
  const picks = readSaid(skill.voice!, talk, talkAnswer)!;
  // One piece of talk: in the middle of the breath by default, on the attack of the next idea's first word.
  const joined = { ...talk, pieces: [{ in: 0.15, out: 9.5, start: 0, end: 9.35 }], words: talkFacts.words.map((w) => ({ ...w, start: w.start - 0.15, end: w.end - 0.15 })), duration: 9.35 };
  assert.deepEqual(skillSaid(joined, picks, {}).shots.map((s) => s.start), [0, 4.5, 7.57]);
  assert.deepEqual(skillSaid(joined, picks, { cut: "attack" }).shots.map((s) => s.start), [0, 5.05, 7.8]);
  // Cut by her pauses: an idea that begins within a fifth of a second of a cut begins on it (no sliver of the other frame).
  const cut = skillSaid(talk, picks, { cut: "attack" });
  assert.deepEqual(cut.shots.map((s) => [s.start, s.idea]), [
    [0, 0],
    [1.17, 0],
    [3.68, 1],
    [6.26, 2],
  ]);
  // Each piece the idea of its middle: an idea beginning just after a cut leaves that piece its own.
  const late = { ...talk, words: talk.words.map((w, i) => (i === 10 ? { ...w, start: 3.75 } : w)) };
  assert.equal(skillSaid(late, picks, {}).shots.find((s) => s.start === 3.68)!.idea, 1);
});

// ——— « Mot clé en grand » v1, written on its original's fiche (docs/fiches/mot-cle.md) ——————————————————————————————

/** Its original's words as Scribe would time them, on its fiche's instants (each small word, each name, « forty-one ») and its voice's pauses: 23,43 s. */
const MC_WORDS = (
  "So,:0.34:0.48 today:0.5:0.86 I'm:0.88:0.94 going:0.95:1 to:1.01:1.05 show:1.07:1.21 you:1.23:1.33 a:1.35:1.4 couple:1.43:1.6 of:1.63:1.7 " +
  "fonts:1.73:2.1 you:2.27:2.4 can:2.43:2.6 pair:2.63:2.8 together:2.83:3.3 in:3.5:3.64 your:3.67:3.84 videos:3.87:4.4 to:4.5:4.58 have:4.6:4.75 " +
  "an:4.77:4.85 amazing:4.88:5.2 look.:5.22:5.5 So:6:6.12 you:6.14:6.24 can:6.26:6.38 decide:6.4:6.7 to:6.72:6.78 pair:6.8:7.05 Inter:7.1:7.4 " +
  "with:7.45:7.75 Tempting,:7.8:8.4 Avant:8.47:8.7 Garde:8.72:9.05 with:9.1:9.5 Cooper,:9.57:10.1 Impact:10.23:10.7 with:10.75:11.25 " +
  "Poppins,:11.33:11.9 Helvetica:12.03:12.7 with:12.75:13.15 Courier:13.2:13.55 New,:13.57:13.95 Bebas:14.03:14.4 Neue:14.42:14.8 with:14.85:15.4 " +
  "Montserrat.:15.47:16.5 So:16.86:17 this:17.02:17.15 is:17.17:17.26 day:17.28:17.55 forty-one:17.6:18.1 of:18.15:18.25 my:18.27:18.4 " +
  "sixty:18.42:18.75 days:18.77:19.05 challenge:19.1:19.6 of:19.65:19.75 being:19.78:20 consistent,:20.02:20.55 creative,:20.6:21 copycat.:21.05:21.5 " +
  "Thank:21.62:21.85 you:21.87:22 for:22.02:22.12 watching:22.15:22.5 and:22.56:22.7 see:22.72:22.8 you:22.82:22.85 soon.:22.9:23.3"
)
  .split(" ")
  .map((s) => {
    const [w, a, b] = s.split(":");
    return word(w!, Number(a), Number(b));
  });
const MC_TALK = { clip: "orig", seconds: 23.43, words: MC_WORDS, speech: { source: "scribe" as const, cleaned: false, floor: -50, fillers: [], pauses: [{ start: 0, end: 0.32 }, { start: 5.52, end: 5.98 }, { start: 16.52, end: 16.84 }, { start: 23.32, end: 23.43 }] } };
/** What its filler would choose in it: « So, today », « fonts », its five pairs of names (each in a font it evokes), « 41 » and its three words. */
const MC_SAID = {
  hook: { from: 0, to: 1, text: "So, today" },
  ideas: [
    { from: 2, to: 22, key: 10, text: "fonts", font: "", items: [] },
    {
      from: 23,
      to: 46,
      key: 29,
      text: "inter",
      font: "",
      items: [
        [29, "inter", ""],
        [31, "Tempting", "Great Vibes"],
        [32, "avant garde", ""],
        [35, "cooper", "Fraunces"],
        [36, "impact", "Anton"],
        [38, "poppins", ""],
        [39, "Helvetica", ""],
        [41, "courier new", "Courier Prime"],
        [43, "BEBAS NUEUE", "Bebas Neue"],
        [46, "montserrat", ""],
      ].map(([w, text, font]) => ({ word: w as number, text: text as string, font: font as string })),
    },
    { from: 47, to: 61, key: 51, text: "41", font: "", items: [59, 60, 61].map((w, j) => ({ word: w, text: ["consistent", "creative", "copycat"][j]!, font: "" })) },
  ],
};
/** Its original's two cuts and texts, measured image by image (s): each name on its word, a pair gone on the next one's first. */
const MC_ORIGINAL = { cuts: [5.67, 16.7], hook: [1 / 30, 32 / 30], fonts: [52 / 30, 5.4], names: [7.1, 7.8, 8.47, 9.57, 10.23, 11.33, 12.03, 13.2, 14.03, 15.47], number: [17.6, 21.6] };

/** « Mot clé en grand » made on its original's own talk, as the engine makes it: its plan, its talk, and the composition's props. */
const motCleOnOriginal = async () => {
  const { motCle } = await import("./skills/mot-cle.ts");
  const { skillTalk, readSkillFill, skillPlan } = await import("./skills.ts");
  const talk = skillTalk(MC_TALK)!;
  const files = [{ id: "orig", photo: false, seconds: 23.43, aspect: 9 / 16 }];
  const fill = readSkillFill(motCle, files, talk.pieces.length, voiceAnswer(MC_SAID), { talk })!;
  const plan = editPlanSchema.parse(skillPlan({ skill: motCle, name: "Mot clé en grand", files, fill, talk }));
  const props = buildReelProps(plan, { template: "libre", clipUrls: { orig: "https://x/o.mp4" }, aspects: { orig: 9 / 16 }, brand: { name: "Fonts" }, words: { orig: MC_WORDS } });
  return { motCle, talk, plan, layer: props.layers![0]! };
};
/** A time on the Reel's clock on her video's (through her talk's pieces): where the original's own times are. */
const onHerVideo = (talk: { pieces: { in: number; start: number; end: number }[] }, t: number) => {
  const p = talk.pieces.find((x) => t >= x.start - 0.005 && t < x.end + 0.005) ?? talk.pieces.at(-1)!;
  return p.in + (t - p.start);
};
const within2 = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) <= 2 / 30 + 0.001, `${what}: ${a.toFixed(3)} s, the original's ${b} s`);

/** What a voice skill's Scene draws at a frame, every piece of the kit a named node: her face where `face` says (track), her wall's light, her cut-out's box by shot. */
async function drawVoiced(code: string, frame: number, props: Record<string, unknown>, read: { face?: { x: number; y: number; width: number; height: number } | null; light?: { mean: number; high: number } | null; boxes?: Record<number, TdBox> } = {}): Promise<Drawn> {
  const { MOTION_SCOPE } = await import("./motion-scene.ts");
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = Object.fromEntries(MOTION_SCOPE.filter((n) => n !== "React").map((n) => [n, n]));
  Object.assign(scope, {
    useCurrentFrame: () => frame,
    useVideoConfig: () => ({ width: 1080, height: 1920, fps: 30, durationInFrames: props.durationInFrames }),
    interpolate: (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1))),
    spring: () => 1,
    random: () => 0.5,
    SubjectBox: (shot: { segment?: number } | undefined) => read.boxes?.[shot?.segment ?? -1] ?? null,
    SubjectOutline: () => null,
    SubjectParts: () => [],
    ClearBox: (_s: unknown, _f: number, _l: unknown, options?: { fallback?: unknown }) => options?.fallback ?? null,
    LightUnder: () => read.light ?? null,
  });
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const track = () => ({ hands: [], faces: read.face ? [{ id: 0, ...read.face, points: {} }] : [], bodies: [] });
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, brand: { name: "Atelier Argile", displayFont: "Poppins", bodyFont: "Poppins", accent: "#b5543a" }, track, ...props });
}
/** A drawn layer's props from a Reel's composition layer. */
const sceneProps = (layer: { durationInFrames: number; shots?: unknown[]; texts?: Record<string, string>; reelTexts?: unknown[]; spoken?: unknown[] }) => ({ durationInFrames: layer.durationInFrames, shots: layer.shots ?? [], texts: layer.texts ?? {}, reelTexts: layer.reelTexts ?? [], spoken: layer.spoken ?? [] });

test("« Mot clé en grand » (v1) cuts where its original does, between its ideas, its words on its words, within two images", async () => {
  const { motCle, talk, plan } = await motCleOnOriginal();
  assert.equal(motCle.version, 1);
  assert.equal(motCle.bpm, 108);
  assert.ok(motCle.voice && !motCle.voice.cut && motCle.voice.fonts?.includes("item") && motCle.voice.row === 0.75);
  // Its frame changes only between its ideas, in the breath between them: the original's two cuts, on her video's clock
  // (her pause of 0,46 s shortened as everywhere), within two images; one take, every other idea framed tighter.
  const shots = plan.segments.filter((s): s is ClipSegment => "clip_id" in s);
  const frames = shots.slice(1).map((s, i) => [shots[i]!.out, s.in]);
  assert.equal(frames.length, 2);
  within2(frames[0]![0]!, MC_ORIGINAL.cuts[0]!, "its first cut");
  within2(frames[1]![1]!, MC_ORIGINAL.cuts[1]!, "its second cut");
  assert.deepEqual(shots.map((s) => s.move ?? "none"), ["none", "punch", "none"]);
  // (Its first cut is also her pause, shortened as everywhere; its second only a new frame at the same moment.)
  assert.ok(frames[0]![1]! - frames[0]![0]! > 0.15);
  assert.equal(frames[1]![0], frames[1]![1]);
  // Her hook from the first image until she says the word after it; « fonts » on its word, gone on its idea's last one.
  const at = (style: string, text: string) => plan.texts.find((t) => t.style === style && t.text === text)!;
  within2(at("hook", "So, today").from, MC_ORIGINAL.hook[0]!, "its hook in");
  within2(at("hook", "So, today").to, MC_ORIGINAL.hook[1]!, "its hook out");
  within2(at("band", "fonts").from, MC_ORIGINAL.fonts[0]!, "« FONTS » in");
  within2(at("band", "fonts").to, MC_ORIGINAL.fonts[1]!, "« FONTS » out");
  // Its ten names each on its word; a pair gone when the next one's first is said, the last with the cut.
  const names = plan.texts.filter((t) => t.style === "caption" && !["consistent", "creative", "copycat"].includes(t.text));
  assert.equal(names.length, 10);
  names.forEach((t, j) => within2(onHerVideo(talk, t.from), MC_ORIGINAL.names[j]!, `« ${t.text} » in`));
  names.forEach((t, j) => {
    const next = j % 2 === 0 ? names[j + 2] : names[j + 1];
    if (next) assert.equal(t.to, next.from, `« ${t.text} » goes with the next pair`);
  });
  within2(onHerVideo(talk, names.at(-1)!.to), MC_ORIGINAL.cuts[1]!, "its last pair out");
  // No keyword before its list: its first name is its keyword. Each name in the font it evokes, or hers.
  assert.equal(plan.texts.filter((t) => t.style === "band").length, 2);
  assert.deepEqual(names.map((t) => t.font ?? ""), ["", "Great Vibes", "", "Fraunces", "Anton", "", "", "Courier Prime", "Bebas Neue", ""]);
  // « 41 » on « forty-one », its three words with it, all held to its idea's end.
  const number = at("band", "41");
  within2(onHerVideo(talk, number.from), MC_ORIGINAL.number[0]!, "« 41 » in");
  within2(onHerVideo(talk, number.to), MC_ORIGINAL.number[1]!, "« 41 » out");
  for (const w of ["consistent", "creative", "copycat"]) assert.deepEqual([at("caption", w).from, at("caption", w).to], [number.from, number.to], w);
  // Its music (108 BPM) waits for « fonts », comes in on its beat 5 (2,82 s, its beat 0 at 0,04 s), loses its bass from its
  // beat 21 to its beat 37 (11,71 and 20,61 s), and is cut with the picture.
  const beat = 60 / 108;
  within2(plan.music_shape!.pauses![0]!.to + 0.04, 2.82, "its music in");
  const thin = plan.music_shape!.filters![0]!;
  assert.equal(thin.kind, "thin");
  within2(thin.from + 0.04, 11.71, "its bass out");
  within2(thin.to + 0.04, 20.61, "its bass back");
  assert.ok(Math.abs((thin.to - thin.from) / beat - 16) < 0.01);
  assert.equal(plan.music_shape!.end!.at, plan.duration);
  // A low whoosh on each word that slides in, at its loudest on its bounce (the original's 0,16 and 1,80 s).
  assert.deepEqual(plan.sounds!.map((s) => s.sound), ["low whoosh", "low whoosh"]);
  within2(plan.sounds![0]!.at, 0.16, "its hook's whoosh");
  within2(plan.sounds![1]!.at, 1.8, "« FONTS »'s whoosh");
  // The engine's subtitles of what is said stay under it, on her chest.
  assert.equal(plan.subtitles, true);
  assert.equal(plan.layers![0]!.motion.writes_spoken, false);
  assert.equal(plan.layers![0]!.motion.subtitle_y, 0.75);
});

test("« Mot clé en grand » (v1): its words slide in as the original's, above her head, her words one by one, a list two by two, a number and its words", async () => {
  const { SLIDE } = await import("./skills/mot-cle.ts");
  const { motCle, layer } = await motCleOnOriginal();
  const props = sceneProps(layer);
  // Her head where the original's is (its top at 42 % of the height): every word in the original's place.
  const low = { x: 540, y: 1000, width: 160, height: 200 };
  const draw = (f: number, read: Parameters<typeof drawVoiced>[3] = { face: low }) => drawVoiced(motCle.code, f, props, read);
  const slides = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "div" && "transform" in styleOf(n) && drawnNodes(n).some((c) => c.type === "FitText"));
  // Its hook on the first image, from the left: three images fast and blurred, past its place, back, set on the sixth.
  for (let f = 0; f <= 5; f++) {
    const s = slides(await draw(f))[0]!;
    const dx = f < 5 ? Math.round(SLIDE[f]! * 1080) : 0;
    assert.equal(styleOf(s).transform, dx ? `translateX(${dx}px)` : undefined, `image ${f}`);
    assert.equal(Boolean(styleOf(s).filter), f < 3, `image ${f}'s blur`);
  }
  const hookFit = drawnNodes(await draw(10)).find((n) => n.type === "FitText")!;
  assert.equal(drawnText(hookFit), "SO, TODAY");
  assert.equal((hookFit.props.innerStyle as Record<string, unknown>).fontWeight, 700);
  // « FONTS » in its place (its box from 26,6 % of the height), the small line of her words above it, each word in place
  // from the start of its line, seen from the image it is said: « to » as the hook goes, « show », then « you »,
  // « couple », « of » (« a » and « fonts » left out), very spaced.
  const key = (tree: Drawn) => slides(tree).find((n) => drawnText(drawnNodes(n).find((c) => c.type === "FitText")!) === "FONTS");
  const line = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).display === "flex" && styleOf(n).alignItems === "flex-end");
  const at50 = await draw(56);
  assert.equal(styleOf(key(at50)!).top, Math.round(0.266 * 1920));
  const words = (tree: Drawn) => drawnNodes(line(tree)!).filter((n) => n.type === "span").map((n) => [drawnText(n), styleOf(n).opacity]);
  assert.deepEqual(words(at50), [["to", 1], ["show", 1], ["you", 1], ["couple", 1], ["of", 1]]);
  assert.deepEqual(words(await draw(33)), [["to", 1], ["show", 1], ["you", 0], ["couple", 0], ["of", 0]]);
  assert.ok(Number(styleOf(line(at50)!).gap) >= 0.05 * 1080 && Number(styleOf(line(at50)!).top) < Number(styleOf(key(at50)!).top));
  // Her head higher: the whole block moved up; no room left above it: before her chest, never on her face.
  const high = await draw(56, { face: { x: 540, y: 700, width: 160, height: 200 } });
  assert.ok(Number(styleOf(key(high)!).top) < Math.round(0.266 * 1920) - 150, String(styleOf(key(high)!).top));
  const none = await draw(56, { face: { x: 540, y: 420, width: 160, height: 200 } });
  assert.ok(Number(styleOf(key(none)!).top) >= 420 + 150, String(styleOf(key(none)!).top));
  // White on a dark wall, in ink on a light one.
  const color = (tree: Drawn) => (drawnNodes(tree).find((n) => n.type === "FitText")!.props.innerStyle as Record<string, unknown>).color;
  assert.equal(color(at50), "#ffffff");
  assert.equal(color(await draw(56, { face: low, light: { mean: 0.8, high: 0.9 } })), "#161616");
  // Its list two names at a time, the first small on top, the second big under it, each in its font; « inter » alone first.
  const fits = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "FitText").map((n) => [drawnText(n), (n.props.innerStyle as Record<string, unknown>).fontFamily, styleOf(n).top] as const);
  const reel = (s: number) => Math.round(s * 30);
  const inter = layer.reelTexts!.find((t) => t.text === "inter")!;
  const tempting = layer.reelTexts!.find((t) => t.text === "Tempting")!;
  assert.deepEqual((await fits(await draw(inter.from + 3))).map((x) => x[0]), ["inter"]);
  const pair = fits(await draw(tempting.from + 3));
  assert.deepEqual(pair.map((x) => x[0]), ["inter", "Tempting"]);
  assert.match(String(pair[1]![1]), /^'Great Vibes', /);
  assert.ok(Number(pair[0]![2]) < Number(pair[1]![2]));
  assert.ok(reel(7.1) - 12 <= inter.from && inter.from <= reel(7.1));
  // « 41 » very condensed (Anton), its three words stacked at its right, all at once.
  const number = layer.reelTexts!.find((t) => t.text === "41")!;
  const block = drawnNodes(await draw(number.from + 5)).find((n) => n.type === "div" && styleOf(n).display === "flex" && styleOf(n).alignItems === "center")!;
  assert.match(String(styleOf(drawnNodes(block)[1]!).fontFamily), /^'Anton', /);
  assert.equal(drawnText(drawnNodes(block)[1]!), "41");
  assert.deepEqual(drawnNodes(block).filter((n) => n.type === "div" && !n.children.some((c) => typeof c !== "string")).slice(1).map(drawnText), ["consistent", "creative", "copycat"]);
  assert.deepEqual(motCle.fonts, ["Anton"]);
  // Nothing above her head while she says goodbye.
  const bye = await draw(layer.durationInFrames - 10);
  assert.equal(drawnNodes(bye).filter((n) => n.type === "FitText" || n.type === "span").length, 0);
});

test("« Mot clé en grand » (v1): full frame for her vertical video, a 16:9 band on black for a horizontal one or on her word; light to render", async () => {
  const { motCle, plan, layer } = await motCleOnOriginal();
  const props = sceneProps(layer);
  const footage = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "Footage").map((n) => styleOf(n));
  // Its format: as her video, full frame (the original's) or her horizontal video whole on black, its words above it.
  assert.deepEqual(motCle.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]]]);
  const box = (f: Record<string, number | string>) => [f.left, f.top, f.width, f.height];
  assert.deepEqual(box(footage(await drawVoiced(motCle.code, 100, props))[0]!), [0, 0, 1080, 1920]);
  const wideShots = (props.shots as { aspect: number }[]).map((s) => ({ ...s, aspect: 16 / 9 }));
  const wide = await drawVoiced(motCle.code, 100, { ...props, shots: wideShots });
  assert.deepEqual(box(footage(wide)[0]!), [0, 656, 1080, 608]);
  const words = drawnNodes(wide).filter((n) => n.type === "div" && "transform" in styleOf(n));
  assert.ok(words.every((n) => Number(styleOf(n).top) + Number(styleOf(n).height) <= 656), JSON.stringify(words.map((n) => styleOf(n).top)));
  assert.deepEqual(box(footage(await drawVoiced(motCle.code, 100, { ...props, shots: wideShots, texts: { ...props.texts, format: "vertical" } }))[0]!), [0, 0, 1080, 1920]);
  assert.deepEqual(box(footage(await drawVoiced(motCle.code, 100, { ...props, texts: { ...props.texts, format: "horizontal" } }))[0]!), [0, 656, 1080, 608]);
  // Light: one shot of hers mounted at a time; nothing of her cut out (her face followed), her wall's light read on her
  // first shot only.
  const { subjectShots, readsDrawn } = await import("./subject.ts");
  for (const f of [0, 60, 250, 500, 680]) assert.equal(footage(await drawVoiced(motCle.code, f, props)).length, 1, `image ${f}`);
  assert.deepEqual([...subjectShots(plan)], []);
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 3, subjects: [] });
  assert.deepEqual(readsDrawn(motCle.code), [{ shot: 0, kinds: ["light"] }]);
  assert.doesNotMatch(motCle.code, /\bSubject\b|SubjectBox|Depth|Skyline/);
  // Its lengths are hers (45 s at most); its finish is its model's (« Studio »).
  assert.equal(motCle.finish, undefined);
});

// ——— « Face caméra et références » v1, written on its original's fiche (docs/fiches/createur.md) ————————————————————

/** Its original's first 15 s as Scribe would time them, on its fiche's instants (each name's attack, each phrase's first word) and its voice's breaths. */
const CR_WORDS = (
  "Avoir:0.13:0.22 une:0.23:0.45 très:0.47:0.65 bonne:0.67:0.81 culture:0.83:1.1 visuelle,:1.13:1.55 je:1.6:1.7 pense:1.72:1.92 que:1.95:2.02 " +
  "c'est:2.04:2.18 un:2.2:2.28 des:2.3:2.42 points:2.45:2.72 les:2.75:2.86 plus:2.9:3.02 importants:3.05:3.42 en:3.45:3.52 réalisation.:3.55:3.9 " +
  "Les:4.02:4.12 clips:4.15:4.38 de:4.4:4.48 Théodora:4.5:5 qui:5.05:5.12 nous:5.15:5.22 ont:5.25:5.32 tous:5.35:5.45 marqués,:5.5:5.85 on:5.95:6.02 " +
  "peut:6.05:6.18 y:6.2:6.26 trouver:6.3:6.48 des:6.5:6.58 références:6.6:6.82 à:6.84:6.87 Jean-Paul:6.88:7.3 Goude,:7.32:7.6 à:7.66:7.75 " +
  "Lotte:7.78:8.05 Reiniger:8.08:8.5 ou:8.52:8.6 à:8.62:8.66 Saul:8.67:8.95 Bass.:8.97:9.36 Derrière:9.64:9.98 un:10:10.08 clip:10.1:10.35 " +
  "iconique,:10.38:10.95 il:11:11.04 y:11.04:11.08 a:11.1:11.14 des:11.16:11.24 références:11.26:11.5 iconiques.:11.52:11.72 Un:12.05:12.14 de:12.16:12.22 " +
  "mes:12.24:12.36 outils:12.38:12.62 préférés:12.64:12.98 à:13:13.04 moi:13.06:13.2 pour:13.22:13.3 trouver:13.32:13.5 des:13.52:13.6 " +
  "bonnes:13.62:13.75 Flim.:13.83:14.2"
)
  .split(" ")
  .map((s) => {
    const [w, a, b] = s.split(":");
    return word(w!, Number(a), Number(b));
  });
const CR_TALK = { clip: "orig", seconds: 14.97, words: CR_WORDS, speech: { source: "scribe" as const, cleaned: false, floor: -50, fillers: [], pauses: [{ start: 3.9, end: 4.02 }, { start: 9.36, end: 9.64 }, { start: 11.72, end: 12.05 }, { start: 14.2, end: 14.97 }] } };
/** What its filler would cast: an image for each idea it shows in the top half, one for each name he cites, the tool's name (« Flim »). */
const CR_SAID = {
  hook: null,
  ideas: [
    { from: 0, to: 17, key: 4, text: "culture", font: "", files: ["planete"], items: [] },
    {
      from: 18,
      to: 42,
      key: 21,
      text: "Théodora",
      font: "",
      files: ["lune"],
      items: [
        { word: 34, text: "Jean-Paul Goude", font: "", file: "goude" },
        { word: 37, text: "Lotte Reiniger", font: "", file: "reiniger" },
        { word: 41, text: "Saul Bass", font: "", file: "bass" },
      ],
    },
    { from: 43, to: 52, key: 46, text: "iconique", font: "", files: ["cerise"], items: [] },
    { from: 53, to: 64, key: 64, text: "Flim", font: "", items: [] },
  ],
  name: { from: 64, to: 64 },
};
/** Its original's cuts in that passage (s, measured image by image), and when its card starts growing. */
const CR_ORIGINAL = { split: 4.03, names: [6.87, 7.8, 8.67], next: 9.67, frame: 12.07, card: 13.83, chime: 13.96 };
const CR_FILES = [
  { id: "orig", photo: false, seconds: 14.97, aspect: 9 / 16 },
  { id: "planete", photo: true, seconds: 0, aspect: 1 },
  { id: "lune", photo: false, seconds: 8, aspect: 9 / 16 },
  { id: "goude", photo: true, seconds: 0, aspect: 9 / 16 },
  { id: "reiniger", photo: true, seconds: 0, aspect: 9 / 16 },
  { id: "bass", photo: true, seconds: 0, aspect: 2 / 3 },
  { id: "cerise", photo: false, seconds: 5, aspect: 16 / 9 },
];
const createurOnOriginal = async (said: Record<string, unknown> = CR_SAID, files = CR_FILES) => {
  const { createur } = await import("./skills/createur.ts");
  const { skillTalk, readSkillFill, skillPlan } = await import("./skills.ts");
  const talk = skillTalk(CR_TALK)!;
  const fill = readSkillFill(createur, files, talk.pieces.length, voiceAnswer(said), { talk })!;
  const plan = editPlanSchema.parse(skillPlan({ skill: createur, name: "Face caméra et références", files, fill, talk }));
  const props = buildReelProps(plan, {
    template: "libre",
    clipUrls: Object.fromEntries(files.map((f) => [f.id, `https://x/${f.id}`])),
    photoIds: files.filter((f) => f.photo).map((f) => f.id),
    aspects: Object.fromEntries(files.map((f) => [f.id, f.aspect])),
    photoAspects: Object.fromEntries(files.filter((f) => f.photo).map((f) => [f.id, f.aspect])),
    sceneCutouts: { planete: { src: "https://x/planete-cut.png", box: { x: 0.2, y: 0.1, w: 0.6, h: 0.8 } } },
    brand: { name: "Flim" },
    words: { orig: CR_WORDS },
  });
  return { createur, talk, plan, layer: props.layers![0]! };
};

test("« Face caméra et références » (v1) cuts where its original does: on the first word of an idea, on each name he cites, within two images", async () => {
  const { createur, plan } = await createurOnOriginal();
  assert.equal(createur.version, 1);
  assert.equal(createur.voice?.cut, "attack");
  assert.equal(createur.voice?.subtitles, "own");
  assert.equal(createur.voice?.hook, undefined);
  // Its talk: no pause of his long enough to cut, so the Reel's clock is the original's.
  assert.equal(plan.duration, 14.7);
  const shots = plan.segments.filter((s): s is ClipSegment => "clip_id" in s);
  const talkShots = shots.filter((s) => !s.beside);
  const refs = shots.filter((s) => s.beside);
  // The frame changes on the first word of each idea (4,03 s: the split; 9,67 s: the cherry; 12,07 s: another frame),
  // her images on the names he cites (6,87 · 7,80 · 8,67 s), within two images.
  const starts = talkShots.slice(1).map((s) => s.in);
  within2(starts[0]!, CR_ORIGINAL.split, "the split");
  within2(starts[1]!, CR_ORIGINAL.next, "the next idea");
  within2(starts[2]!, CR_ORIGINAL.frame, "another frame");
  assert.deepEqual(talkShots.map((s) => s.move ?? "none"), ["none", "punch", "none", "punch"]);
  assert.deepEqual(refs.map((s) => s.clip_id), ["planete", "lune", "goude", "reiniger", "bass", "cerise"]);
  within2(refs[1]!.beside!.at, CR_ORIGINAL.split, "its top half");
  refs.slice(2, 5).forEach((s, j) => within2(s.beside!.at, CR_ORIGINAL.names[j]!, `« ${s.clip_id} »`));
  within2(refs[5]!.beside!.at, CR_ORIGINAL.next, "the cherry");
  // Each name's image until the next one, the last to the next idea; its own image the idea until its first name.
  assert.ok(Math.abs(refs[1]!.beside!.at + (refs[1]!.out - refs[1]!.in) - refs[2]!.beside!.at) < 0.011);
  assert.ok(Math.abs(refs[4]!.beside!.at + (refs[4]!.out - refs[4]!.in) - refs[5]!.beside!.at) < 0.011);
  // Its card on his tool's name with its chime (13,83 and 13,96 s); no music (his voice alone); nothing written big
  // (its keywords and the names it shows are its images).
  within2(plan.sounds![0]!.at, CR_ORIGINAL.chime, "its chime");
  assert.equal(plan.sounds![0]!.sound, "sparkle chime");
  within2(Number(plan.layers![0]!.motion.texts!.said_name_from) / 30, CR_ORIGINAL.card, "its card");
  assert.deepEqual(plan.music_shape, { none: true });
  assert.deepEqual(plan.texts, []);
  // What he says, written by its code (its first phrase on bands, then its small subtitles): the engine's step aside.
  assert.equal(plan.layers![0]!.motion.writes_spoken, true);
});

test("« Face caméra et références » (v1): its images where the original puts them, its hook on bands, its small subtitles, its card", async () => {
  const { createur, layer } = await createurOnOriginal();
  const props = sceneProps(layer);
  const face = { x: 540, y: 1150, width: 170, height: 220 };
  const brand = { name: "Flim", displayFont: "Inter Tight", bodyFont: "Inter Tight" };
  const draw = (f: number, read: Parameters<typeof drawVoiced>[3] = { face }) => drawVoiced(createur.code, f, { ...props, brand }, read);
  const laid = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "Footage" || n.type === "Cutout").map((n) => [n.type, n.props.shot ?? (n.props.photo as { segment: number }).segment, styleOf(n).top ?? n.props.y, styleOf(n).height ?? n.props.height]);
  // Its first idea: its photo of an object cut out on his wall above his head (his head low, room above), his shot full
  // frame; then, his head higher, the top half (his the bottom half, framed on his face).
  const first = laid(await draw(30));
  assert.deepEqual(first[0], ["Footage", 0, 0, 1920]);
  assert.equal(first[1]![0], "Cutout");
  assert.ok(Number(first[1]![2]) + Number(first[1]![3]) <= 1150 - 0.95 * 220 - 0.02 * 1920 + 1);
  const cutout = drawnNodes(await draw(30)).find((n) => n.type === "Cutout")!;
  assert.deepEqual([cutout.props.rim, cutout.props.shadow], [0, false]);
  assert.deepEqual(laid(await draw(30, { face: { ...face, y: 600 } })).map((x) => [x[0], x[2], x[3]]), [["Footage", 960, 960], ["Footage", 0, 960]]);
  // Its second idea's clip in the top half; then each name's image full frame from the instant he names it.
  const split = laid(await draw(Math.round(5 * 30)));
  assert.deepEqual(split.map((x) => [x[1], x[2], x[3]]), [[1, 960, 960], [5, 0, 960]]);
  for (const [s, shot] of [[7.2, 6], [8.2, 7], [9.0, 8]] as const) assert.deepEqual(laid(await draw(Math.round(s * 30))), [["Footage", shot, 0, 1920]], `${s} s`);
  // Its hook: his first phrase on black bands from its first word, then small sober subtitles, one phrase at a time,
  // white, no word in colour, in the middle (on the split's line).
  const bands = drawnNodes(await draw(20)).find((n) => n.type === "Captions")!;
  assert.equal(bands.props.style, "bands");
  assert.deepEqual((bands.props.words as { w: string }[]).map((w) => w.w).join(" "), CR_WORDS.slice(0, 18).map((w) => w.w).join(" "));
  const subtitle = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).fontWeight === 600);
  const at46 = await draw(Math.round(4.6 * 30));
  const sub = subtitle(at46)!;
  assert.equal(drawnText(sub), "Les clips de Théodora qui nous ont tous marqués,");
  assert.equal(styleOf(sub).color, "#ffffff");
  assert.ok(Number(styleOf(sub).fontSize) >= 48);
  const subBox = drawnNodes(at46).find((n) => n.type === "div" && styleOf(n).justifyContent === "center" && drawnNodes(n).includes(sub))!;
  assert.equal(Number(styleOf(subBox).top) + Number(styleOf(subBox).height) / 2, 960);
  // His tool named: a white card grows from the middle onto his chest under his face in 14 images, blurred at first,
  // his name on it (no logo), and no subtitles under it.
  const nameAt = Number(props.texts.said_name_from);
  const card = (tree: Drawn) => drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).background === "#ffffff");
  const start = card(await draw(nameAt))!;
  const grown = card(await draw(nameAt + 14))!;
  assert.ok(Number(styleOf(start).width) < 200 && String(styleOf(start).filter).startsWith("blur"));
  assert.deepEqual([styleOf(grown).width, styleOf(grown).left, styleOf(grown).filter], [Math.round(1080 * 0.74), Math.round((1080 - Math.round(1080 * 0.74)) / 2), undefined]);
  // (His face low in the picture: above his head; higher, on his chest under it.)
  assert.ok(Number(styleOf(grown).top) + Number(styleOf(grown).height) <= 1150 - 0.95 * 220, String(styleOf(grown).top));
  const chest = card(await draw(nameAt + 14, { face: { ...face, y: 560 } }))!;
  assert.ok(Number(styleOf(chest).top) >= 560 + 0.75 * 220 && Number(styleOf(chest).top) + Number(styleOf(chest).height) <= 0.75 * 1920, String(styleOf(chest).top));
  assert.equal(drawnText(drawnNodes(grown).find((n) => n.type === "FitText")!), "Flim");
  assert.equal(subtitle(await draw(nameAt + 14)), undefined);
});

test("« Face caméra et références » (v1): a wall of her images behind her cut out on those shots only, its format, no music", async () => {
  const { createur, plan, layer } = await createurOnOriginal({
    ...CR_SAID,
    ideas: [CR_SAID.ideas[0], CR_SAID.ideas[1], { ...CR_SAID.ideas[2], files: ["cerise", "w1", "w2", "w3", "w4", "w5"] }, CR_SAID.ideas[3]],
  }, [...CR_FILES, ...["w1", "w2", "w3", "w4", "w5"].map((id) => ({ id, photo: true, seconds: 0, aspect: 4 / 5 }))]);
  const props = sceneProps(layer);
  const face = { x: 540, y: 1150, width: 170, height: 220 };
  const wallFrom = Math.round(CR_ORIGINAL.next * 30);
  // Her cut-out on the shots of that idea only (her other shots are never cut out), declared for the engine.
  const wallShot = plan.segments.filter((s): s is ClipSegment => "clip_id" in s && !s.beside).findIndex((s) => s.in > 9.5);
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 15, subjects: [wallShot] });
  const { subjectShots } = await import("./subject.ts");
  assert.deepEqual([...subjectShots(plan)], [wallShot]);
  const drawn = await cutoutsDrawn(createur.code, { width: 1080, height: 1920, brand: { name: "Flim", displayFont: "Inter Tight", bodyFont: "Inter Tight" }, ...props }, Array.from({ length: props.durationInFrames }, (_, f) => f));
  assert.deepEqual([...drawn], [wallShot]);
  // Its six thumbnails in two columns sliding in from both edges in 7 images, posed, her cut out in front of them.
  const wall = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "div" && styleOf(n).overflow === "hidden" && String(styleOf(n).boxShadow).length > 4);
  const her = { [wallShot]: { x: 300, y: 700, w: 480, h: 1220 } };
  const posed = wall(await drawVoiced(createur.code, wallFrom + 10, props, { face, boxes: her }));
  assert.equal(posed.length, 6);
  assert.ok(posed.every((n) => !styleOf(n).transform));
  assert.deepEqual([...new Set(posed.map((n) => Number(styleOf(n).left) < 540))], [true, false]);
  assert.ok(Math.max(...posed.map((n) => Number(styleOf(n).top) + Number(styleOf(n).height))) <= 0.73 * 1920 + 1);
  const sliding = wall(await drawVoiced(createur.code, wallFrom + 1, props, { face, boxes: her }));
  assert.ok(sliding.some((n) => String(styleOf(n).transform).startsWith("translateX(-")) && sliding.some((n) => /^translateX\(\d/.test(String(styleOf(n).transform))));
  const order = drawnNodes(await drawVoiced(createur.code, wallFrom + 10, props, { face, boxes: her })).filter((n) => n.type === "Subject" || (n.type === "div" && styleOf(n).boxShadow)).map((n) => n.type);
  assert.equal(order.at(-1), "Subject");
  // Without her cut-out, the wall stops above her head.
  const above = wall(await drawVoiced(createur.code, wallFrom + 10, props, { face }));
  assert.ok(above.length >= 2 && above.every((n) => Number(styleOf(n).top) + Number(styleOf(n).height) <= 1150 - 0.95 * 220 - 0.02 * 1920 + 1));
  // Its format: as her video; split all along on her word, or full frame all along; her horizontal video split.
  assert.deepEqual(createur.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "partage", "plein"]]]);
  const boxes = async (f: number, extra: Record<string, unknown>) => drawnNodes(await drawVoiced(createur.code, f, { ...props, ...extra }, { face })).filter((n) => n.type === "Footage").map((n) => [styleOf(n).top, styleOf(n).height]);
  assert.deepEqual(await boxes(Math.round(7.2 * 30), { texts: { ...props.texts, format: "partage" } }), [[960, 960], [0, 960]]);
  assert.deepEqual(await boxes(Math.round(5 * 30), { texts: { ...props.texts, format: "plein" } }), [[0, 1920]]);
  const wideShots = (props.shots as { aspect: number; kind: string }[]).map((s, i) => (i < 4 ? { ...s, aspect: 16 / 9 } : s));
  assert.deepEqual(await boxes(Math.round(7.2 * 30), { shots: wideShots }), [[960, 960], [0, 960]]);
  // No music, no grade (the images she shows as they are); 2 to 10 files.
  assert.deepEqual(plan.music_shape, { none: true });
  assert.deepEqual(createur.finish, { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 });
  assert.deepEqual(createur.files, [2, 10]);
  // Light: the images of one moment only are mounted (a name's one, an idea's one, or the wall's six), never all of them.
  for (const f of [30, 150, 216, 250, wallFrom + 10, 380]) {
    const n = drawnNodes(await drawVoiced(createur.code, f, props, { face, boxes: her })).filter((x) => x.type === "Footage" || x.type === "Cutout").length;
    assert.ok(n <= 7, `image ${f}: ${n}`);
  }
});

// ——— « Carte au feutre » v2 and « Photos posées sur la table » v2, written again on their originals' fiches ——————————

/**
 * A composition run at any frame with every piece of the motion designer's scope as a named element (Handwriting,
 * LumaFade…; random seeded as Remotion's, interpolate clamped), as cutoutsDrawn lays its scope: its tree.
 */
async function kitDraw(code: string): Promise<(frame: number, props: Record<string, unknown>) => Drawn> {
  const { MOTION_SCOPE } = await import("./motion-scene.ts");
  return (frame, props) => {
    const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
    const scope: Record<string, unknown> = Object.fromEntries(MOTION_SCOPE.filter((n) => n !== "React").map((n) => [n, n]));
    Object.assign(scope, {
      useCurrentFrame: () => frame,
      interpolate: (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1))),
      random: (seed: string) => [...seed].reduce((x, c) => Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) / 4294967296,
    });
    const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
    return make(React, ...Object.values(scope))(props);
  };
}
/** A timeline's marks as its composition gets them (its slot texts). */
const marksOf = (line: { marks: Record<string, number> }) => Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
/** The frames from which a function of the frame changes, over a Reel. */
const changesOf = (frames: number, at: (f: number) => unknown) =>
  Array.from({ length: frames }, (_, f) => f).filter((f) => f > 0 && JSON.stringify(at(f)) !== JSON.stringify(at(f - 1)));

/** « Carte au feutre »: the original's words land on its images 27 (« PUT »), 52, 72, 99, 123, 147 and 177 (« BURGER NIGHT »). */
const CARTE_WORDS = [27, 52, 72, 99, 123, 147, 177];
const CARTE_TEXTS = [
  { text: "put that phone down & come to", role: "hook", from: 0, to: 270, emphasis: [] },
  { text: "burger night", role: "caption", from: 177, to: 270, emphasis: [] },
];
const carteProps = (line: { shots: { start: number; end: number }[]; marks: Record<string, number> }, extra: Record<string, unknown> = {}) => ({
  width: 1080,
  height: 1920,
  durationInFrames: 270,
  brand: { name: "Le Salon", displayFont: "Permanent Marker", bodyFont: "Inter Tight", accent: "#d2122e" },
  shots: pileShots(line, 9 / 16, "photo"),
  reelTexts: CARTE_TEXTS,
  end: null,
  texts: marksOf(line),
  ...extra,
});
const handsOf = (tree: Drawn) => drawnNodes(tree).filter((n) => n.type === "Handwriting");
const notebookAngle = (tree: Drawn) => Number(/^rotate\((-?[\d.]+)deg\)/.exec(String(styleOf(drawnNodes(tree).find((n) => n.type === "div" && /^rotate\(/.test(String(styleOf(n).transform ?? "")))!).transform))![1]);

test("« Carte au feutre » (v2) writes its words where its original does, a photo every 3 images, on its music (135 BPM in half time)", async () => {
  const { carteFeutre } = await import("./skills/carte-feutre.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(carteFeutre.version, 2);
  assert.equal(carteFeutre.bpm, 135);
  const line = carteFeutre.timeline(23, { end: false });
  // Its 23 photos, one a slot, over its 9 s (270 images).
  assert.equal(line.shots.length, 23);
  assert.equal(Math.round(line.duration * 30), 270);
  // Its words' moments, the original's within two images (in its beats: at another tempo they follow it).
  const marks = [0, 1, 2, 3, 4, 5].map((k) => line.marks[`a${k}`]!).concat(line.marks.name!);
  marks.forEach((f, k) => assert.ok(Math.abs(f - CARTE_WORDS[k]!) <= 2, `word ${k + 1}: image ${f}, the original's ${CARTE_WORDS[k]}`));
  // Its code writes the original's sentence word by word on those images, each on a change of photo (its 52 an image
  // early), « & COME » at once, « TO » alone, the name at once; a new photo every 3 images in its order, round after round
  // (the original's 89 cuts, every one of them).
  const draw = await kitDraw(carteFeutre.code);
  const props = carteProps(line);
  const shown = (f: number) => handsOf(draw(f, props)).map((n) => n.props.upTo);
  const lands = changesOf(270, shown);
  assert.deepEqual(lands, [27, 51, 72, 99, 123, 147, 177]);
  lands.forEach((f, k) => assert.ok(Math.abs(f - CARTE_WORDS[k]!) <= 2 && f % 3 === 0, `word ${k + 1} at ${f}`));
  assert.deepEqual(shown(123), [19, 6]);
  assert.deepEqual(shown(147), [19, 9]);
  assert.deepEqual(shown(269), [19, 22]);
  const shotAt = (f: number) => drawnNodes(draw(f, props)).filter((n) => n.type === "Footage").map((n) => n.props.shot);
  for (let f = 0; f < 270; f++) assert.deepEqual(shotAt(f), [Math.floor(f / 3) % 23], `image ${f}`);
  assert.deepEqual(changesOf(270, shotAt), Array.from({ length: 89 }, (_, k) => 3 * (k + 1)));
  // Its music: in after nine silent images, its first bass hit on beat 1,5 (0,67 s); stopped dead a beat for the name,
  // which lands in that blank two images before the reprise on a bar's first beat; its sound fading over the last second.
  assert.deepEqual(line.music, { downbeat: 0.667, pauses: [{ from: 0, to: 0.289 }, { from: 5.556, to: 6 }], end: { at: 9, fade: 1 } });
  assert.ok(177 / 30 > 5.556 && 6 - 177 / 30 < 0.11);
  // No sound of its own (none when a word lands, measured); its message from the first image, its name from its landing.
  assert.equal(line.sounds, undefined);
  assert.deepEqual(line.texts, { message: { from: 0, to: 9 }, nom: { from: 5.9, to: 9 } });
  assert.deepEqual(carteFeutre.texts.map((t) => [t.slot, t.role, t.max, t.required]), [["message", "hook", 32, true], ["nom", "caption", 16, true]]);
  // With an ending card (the original has none), four whole beats more for its 1,6 s, its words up to it.
  const ended = carteFeutre.timeline(23, { end: true });
  assert.ok(Math.abs(ended.duration - line.duration - (4 * 60) / 135) < 0.04, `${ended.duration} s`);
  assert.equal(ended.texts.message!.to, Math.round((ended.duration - 1.6) * 100) / 100);
  // At another tempo its words follow its beats; its photos keep their pace of 3 images.
  const slower = carteFeutre.timeline(23, { end: false, bpm: 108 });
  assert.ok(Math.abs(slower.duration / line.duration - 135 / 108) < 0.01 && slower.marks.name! > line.marks.name!);
  // On her plan, for every count it takes, with or without its card: valid, its music shaped, no sound.
  for (let n = carteFeutre.shots[0]; n <= carteFeutre.shots[1]; n++) {
    for (const end of [false, true]) {
      const files = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, photo: i % 3 > 0, seconds: i % 3 > 0 ? 0 : 6 }));
      const plan = skillPlan({ skill: carteFeutre, name: "Carte au feutre", files, fill: { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { message: "ce jeudi on vous attend pour la", nom: "soirée jazz" }, end: end ? { title: "Ouvert dimanche" } : null } });
      const parsed = editPlanSchema.safeParse(plan);
      assert.ok(parsed.success, `n=${n} end=${end}: ${parsed.success ? "" : parsed.error.message.slice(0, 300)}`);
      assert.equal(plan.music_shape?.pauses?.length, 2);
      assert.equal(plan.sounds, undefined);
    }
  }
});

test("« Carte au feutre » (v2): an open notebook laid over her pictures, a new pose with each word, two lines a page, a hand that never repeats", async () => {
  const { carteFeutre } = await import("./skills/carte-feutre.ts");
  const line = carteFeutre.timeline(23, { end: false });
  const draw = await kitDraw(carteFeutre.code);
  const props = carteProps(line);
  // Its eight poses, the original's: tilted left while empty, then left and right in turn with each word, straight when
  // the sentence is whole; still between two words (7 to 10 photos pass under it).
  assert.deepEqual([0, 27, 51, 72, 99, 123, 147, 177].map((f) => notebookAngle(draw(f, props))), [-7.3, 4, -4.3, -0.3, 4.5, 4.3, -5.3, -0.4]);
  assert.deepEqual(changesOf(270, (f) => notebookAngle(draw(f, props))), [27, 51, 72, 99, 123, 147, 177]);
  // 66,5 % of the width by 41 % of the height at the middle (its centre as the original's, within 3 %): its grey paper,
  // its binding across the middle with its stitches, the top page darker just before it, a notch at the fold, no shadow;
  // its perspective an outline, never a 3D transform.
  const notebook = drawnNodes(draw(200, props)).find((n) => n.type === "div" && /^rotate\(/.test(String(styleOf(n).transform ?? "")))!;
  const box = styleOf(notebook) as { left: number; top: number; width: number; height: number };
  assert.deepEqual([box.width, box.height], [718, 787]);
  assert.ok(Math.abs(box.left + 359 - 540) <= 0.03 * 1080 && Math.abs(box.top + 393 - 0.515 * 1920) <= 0.03 * 1920, JSON.stringify(box));
  const paper = drawnNodes(notebook).find((n) => /^path\('M/.test(String(styleOf(n).clipPath ?? "")))!;
  assert.match(String(styleOf(paper).background), /#b7b6ad 49\.3%/);
  assert.ok(drawnNodes(paper).some((n) => /repeating-linear-gradient/.test(String(styleOf(n).background))));
  assert.doesNotMatch(carteFeutre.code, /boxShadow|perspective\(|rotateX\(/);
  // Two lines a page, each across its width: its top page; under the binding, its third line and the name she announces,
  // the biggest line (its slot a third taller, the page stretched as far as the name's width needs to fill it); in the
  // original's red, a hand that never repeats in Covered By Your Grace, a grease pencil's grain, stretched to their height.
  const hands = handsOf(draw(200, props));
  assert.deepEqual(hands.map((n) => [n.props.text, n.props.last, n.props.color, n.props.grain, n.props.align]), [
    ["PUT THAT\nPHONE DOWN", 1, "#b20b21", 0.6, "left"],
    ["& COME TO\nBURGER NIGHT", 1.3, "#b20b21", 0.6, "left"],
  ]);
  assert.ok(hands.every((n) => /^'Covered By Your Grace'/.test(String((n.props.style as Record<string, string>).fontFamily)) && !n.props.bend));
  const blocks = drawnNodes(notebook).filter((n) => n.type === "div" && /^scaleY\(/.test(String(styleOf(n).transform ?? ""))).map((n) => ({ top: Number(styleOf(n).top), stretch: Number(/scaleY\(([\d.]+)\)/.exec(String(styleOf(n).transform))![1]), slot: (drawnNodes(n).find((c) => c.type === "Handwriting")!.props.box as TdBox).h }));
  const visible = blocks.map((b) => b.slot * b.stretch);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.stretch, 1.45);
  assert.ok(blocks[0]!.top + visible[0]! < 0.495 * 787 && blocks[1]!.top > 0.495 * 787 && blocks[1]!.top + visible[1]! <= 787, JSON.stringify(blocks));
  // The name's capitals, as its hand sizes them (its slot's height or its width, about 0.38 em a letter, the font's
  // capitals at 0.72 em, stretched): taller than the third line's and the top page's (the original's 10,5 % of the image).
  const cap = (slot: number, stretch: number, letters: number) => Math.min((slot / stretch / 0.72) * 0.92, 692 / (letters * 0.38)) * 0.72 * stretch;
  const bottom = blocks[1]!;
  const name = cap((visible[1]! / 2.3) * 1.3, bottom.stretch, 12);
  assert.ok(bottom.stretch > 1.45 && name > cap(visible[1]! / 2.3, bottom.stretch, 9) * 1.2 && name > cap(visible[0]! / 2, 1.45, 10) * 1.1, `${name} px`);
  // A name alone on its page (a short message): its own stretch, its letters tighter.
  const alone = handsOf(draw(200, { ...props, reelTexts: [{ ...CARTE_TEXTS[0]!, text: "viens goûter la" }, { ...CARTE_TEXTS[1]!, text: "pizza du jeudi" }] }))[1]!;
  assert.equal((alone.props.style as Record<string, string>).letterSpacing, "-0.02em");
  assert.deepEqual(carteFeutre.fonts, ["Covered By Your Grace"]);
  // Nothing written while it is empty, the bottom page only once its words come.
  assert.equal(handsOf(draw(20, props)).length, 0);
  assert.equal(handsOf(draw(100, props)).length, 1);
  // Her colour as its ink when it is dark enough to read on its grey paper; else, or on her word, the original's red.
  const inkOf = (brand: Record<string, string>, texts: Record<string, string> = {}) => handsOf(draw(200, { ...props, brand: { ...props.brand, ...brand }, texts: { ...props.texts, ...texts } }))[0]!.props.color;
  assert.equal(inkOf({ accent: "#1F3A5F" }), "#1f3a5f");
  assert.equal(inkOf({ accent: "#e8b4c8" }), "#b20b21");
  assert.equal(inkOf({ accent: "#1F3A5F" }, { encre: "rouge" }), "#b20b21");
  // A shorter message: its lines on the top page, the name alone on the bottom one; the word before the name alone.
  const short = { ...props, reelTexts: [{ ...CARTE_TEXTS[0]!, text: "viens goûter la" }, { ...CARTE_TEXTS[1]!, text: "pizza du jeudi" }] };
  assert.deepEqual(handsOf(draw(200, short)).map((n) => n.props.text), ["VIENS GOÛTER LA", "PIZZA DU JEUDI"]);
  assert.deepEqual(changesOf(270, (f) => handsOf(draw(f, short)).map((n) => n.props.upTo)), [27, 87, 147, 177]);
  // Its ending card, when she has one: the notebook straight, her title and its line written at once.
  const card = draw(250, { ...props, end: { title: "Ouvert dimanche", subtitle: "dès 19 h", from: 222 } });
  assert.equal(notebookAngle(card), 0);
  assert.deepEqual(handsOf(card).map((n) => n.props.text), ["OUVERT DIMANCHE", "DÈS 19 H"]);
  assert.deepEqual(handsOf(draw(250, { ...props, end: { title: "Soirée jazz tous les jeudis", subtitle: null, from: 222 } })).map((n) => n.props.text), ["SOIRÉE JAZZ\nTOUS LES JEUDIS"]);
  assert.doesNotMatch(carteFeutre.code + JSON.stringify(carteFeutre.texts), /PUT|BURGER|PHONE/i);
});

test("« Carte au feutre » (v2): full frame as the original, two bands when her pictures are in width, a video in stop motion, light to render", async () => {
  const { carteFeutre } = await import("./skills/carte-feutre.ts");
  const { dressSkillPlan, skillPlan, skillSettings } = await import("./skills.ts");
  const { houseStyle } = await import("./house-models.ts");
  const { subjectsDrawn, objectsDrawn, clearsDrawn, depthsDrawn } = await import("./subject.ts");
  const { checkMotionCode } = await import("./motion-scene.ts");
  const line = carteFeutre.timeline(23, { end: false });
  const draw = await kitDraw(carteFeutre.code);
  const pictures = (f: number, extra: Record<string, unknown> = {}) =>
    drawnNodes(draw(f, carteProps(line, extra))).filter((n) => n.type === "Footage").map((n) => ({ shot: n.props.shot, at: n.props.at, box: [styleOf(n).top, styleOf(n).height] }));
  // Her pictures upright: each full frame, as the original's.
  assert.deepEqual(pictures(30), [{ shot: 10, at: 30, box: [0, 1920] }]);
  // Mostly in width: two bands above and under the notebook (a 16:9 picture almost whole in each), changing one after
  // the other, still a change every 3 images; on her word, either way.
  const wide = { shots: pileShots(line, 16 / 9, "photo") };
  assert.deepEqual(pictures(30, wide).map((p) => [p.shot, ...p.box]), [[10, 0, 640], [11, 1280, 640]]);
  assert.deepEqual(pictures(33, wide).map((p) => p.shot), [12, 11]);
  assert.deepEqual(pictures(36, wide).map((p) => p.shot), [12, 13]);
  assert.equal(pictures(30, { ...wide, texts: { ...marksOf(line), format: "vertical" } }).length, 1);
  assert.equal(pictures(30, { texts: { ...marksOf(line), format: "bandes" } }).length, 2);
  assert.deepEqual(carteFeutre.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "bandes"]], ["encre", ["sienne", "rouge"]]]);
  assert.deepEqual(skillSettings(carteFeutre, [{ name: "format", value: "auto" }, { name: "encre", value: "rouge" }]), { encre: "rouge" });
  // A photo the same image each round; a video 3 images further on its passage each time it comes back (stop motion).
  const videos = { shots: pileShots(line, 9 / 16, "video") };
  assert.deepEqual([5, 74, 143].map((f) => { const p = pictures(f, videos)[0]!; return [p.shot, f - Number(p.at)]; }), [[1, 0], [1, 3], [1, 6]]);
  assert.deepEqual([5, 74].map((f) => f - Number(pictures(f)[0]!.at)), [0, 0]);
  // Warm and saturated on her pictures only: none of its model's finish on the whole Reel (its flash and its grain would
  // light the notebook and move on it).
  assert.match(carteFeutre.code, /filter: tone/);
  const files = Array.from({ length: 23 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 }));
  const plan = skillPlan({ skill: carteFeutre, name: "Carte au feutre", files, fill: { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { message: "ce jeudi on vous attend pour la", nom: "soirée jazz" }, end: null } });
  const dressed = dressSkillPlan(plan, carteFeutre, followedFrom("local", houseStyle(houseModel("carte-feutre")!)));
  assert.ok(dressed.look && dressed.look.flash === 0 && dressed.look.grain === 0 && dressed.look.warmth === 0 && dressed.look.contrast === 0, JSON.stringify(dressed.look));
  // Light to render: one picture a frame (two in bands), two written blocks at most (each one's grain a filter pass a
  // frame), each mounted once it has letters, nothing cut out, followed, read or in depth; no 3D transform, its hand
  // without its costly bend.
  for (let f = 0; f < 270; f += 3) {
    const tree = draw(f, carteProps(line, wide));
    assert.ok(drawnNodes(tree).filter((n) => n.type === "Footage").length <= 2 && handsOf(tree).length <= 2 && handsOf(tree).every((n) => Number(n.props.upTo) > 0), `image ${f}`);
  }
  assert.deepEqual([subjectsDrawn(carteFeutre.code), objectsDrawn(carteFeutre.code), clearsDrawn(carteFeutre.code), depthsDrawn(carteFeutre.code)], [[], [], [], []]);
  assert.deepEqual(checkMotionCode(carteFeutre.code), []);
  assert.equal(plan.layers![0]!.motion.drawn, undefined);
  assert.deepEqual(plan.skill, { key: "carte-feutre", version: 2 });
});

/** « Photos posées sur la table »: the original's cuts on its main line (its images at 30 i/s, measured), its ten prints' landings. */
const TABLE_CUTS = [0, 61, 70, 76, 101, 120, 143, 163, 183, 200];
const TABLE_PRINTS = [13, 14, 16, 19, 21, 24, 28, 30, 33, 38];
/** Its shots as its composition gets them: her table, her prints as photos (3:4), her videos of that shape. */
const tableShots = (line: { shots: { start: number; end: number }[] }, aspect = 16 / 9, prints = 10) =>
  pileShots(line, aspect).map((s, i) => (i >= 1 && i <= prints ? { ...s, kind: "photo", aspect: 0.75 } : s));
const tableProps = (line: { shots: { start: number; end: number }[]; marks: Record<string, number> }, extra: Record<string, unknown> = {}) => ({
  width: 1080,
  height: 1920,
  durationInFrames: 268,
  brand: { name: "Atelier Argile", displayFont: "Instrument Serif", bodyFont: "Inter Tight" },
  shots: tableShots(line),
  reelTexts: [
    { text: "voici", role: "caption", from: 9, to: 76, emphasis: [] },
    { text: "Argile", role: "hook", from: 9, to: 76, emphasis: [] },
  ],
  end: null,
  texts: marksOf(line),
  ...extra,
});
/** Its prints at a frame: each one's box and angle, and the shot it shows. */
const tablePrints = (tree: Drawn) =>
  drawnNodes(tree)
    .filter((n) => n.type === "div" && /^rotate\(/.test(String(styleOf(n).transform ?? "")) && styleOf(n).overflow === "hidden")
    .map((n) => ({ shot: drawnNodes(n).find((c) => c.type === "Footage")!.props.shot as number, angle: Number(/rotate\((-?[\d.]+)deg/.exec(String(styleOf(n).transform))![1]), box: styleOf(n) as { left: number; top: number; width: number; height: number } }));
/** Its halves at a frame: each box (left, top, width, height in its frame, on black) and the shot laid in it. */
const tableHalves = (tree: Drawn) =>
  drawnNodes(tree)
    .filter((n) => n.type === "div" && styleOf(n).overflow === "hidden" && !styleOf(n).transform && styleOf(n).backgroundColor !== "#000000" && n.children.flat(Infinity).some((c) => (c as Drawn)?.type === "Footage"))
    .map((n) => { const s = styleOf(n); const f = drawnNodes(n).find((c) => c.type === "Footage")!; return { box: [s.left, s.top, s.width, s.height], shot: f.props.shot, style: styleOf(f) }; });

test("« Photos posées sur la table » (v2) cuts where its original does, its prints and its halves laid on the same moment, on its music (110 BPM)", async () => {
  const { table, tableParts, printLandings } = await import("./skills/table.ts");
  const { besideOf, skillPlan } = await import("./skills.ts");
  assert.equal(table.version, 2);
  assert.equal(table.bpm, 110);
  const line = table.timeline(25, { end: false });
  // The original's 25 shots in its 8,93 s (268 images): its table, ten prints, two quick shots, five pairs, the gesture's
  // half alone, its last shot.
  assert.equal(line.shots.length, 25);
  assert.equal(Math.round(line.duration * 30), 268);
  assert.deepEqual(tableParts(25), { prints: 10, pairs: 5 });
  // Its main line cuts where the original's do, within two images (here to the image): the bare table at 61, the quick
  // shots, each pair cutting together, the gesture alone at 183, its last shot at 200.
  const main = line.shots.filter((s) => !s.beside).map((s) => Math.round(s.start * 30));
  assert.equal(main.length, TABLE_CUTS.length);
  main.forEach((f, k) => assert.ok(Math.abs(f - TABLE_CUTS[k]!) <= 2, `cut ${k + 1}: image ${f}, the original's ${TABLE_CUTS[k]}`));
  // Its prints laid beside its table (time counted once), each from its landing, the original's within two images, to
  // the bare table; each pair's place beside its gesture, the last one held until an image after the last shot comes in.
  const prints = line.shots.slice(1, 11);
  assert.ok(prints.every((s) => s.beside));
  prints.forEach((s, k) => assert.ok(Math.abs(Math.round(s.start * 30) - TABLE_PRINTS[k]!) <= 2 && Math.round(s.end * 30) === 58, `print ${k + 1}: ${s.start}–${s.end}`));
  assert.deepEqual(printLandings(10).map((b) => Math.round(b * (1800 / 110))), TABLE_PRINTS);
  assert.deepEqual(besideOf(line), [null, ...Array<number>(10).fill(0), null, null, null, 13, null, 15, null, 17, null, 19, null, 21, null, null]);
  for (let j = 0; j < 5; j++) {
    const [g, p] = [line.shots[13 + 2 * j]!, line.shots[14 + 2 * j]!];
    assert.equal(p.start, g.start);
    assert.equal(Math.round(p.end * 30), j < 4 ? Math.round(g.end * 30) : 201);
  }
  // Its code's marks: its pile's fade by light at 54, its burn at 74.
  assert.deepEqual([line.marks.prints, line.marks.pairs, line.marks.fade, line.marks.burn], [10, 5, 54, 74]);
  // Its words from image 9 (fading in before the first print) to the split screen; its music's first beat at 0,13 s, 4 dB
  // softer until its bass line comes in on the third pair's cut (image 120), cut dead two images before the end; its
  // prints' clicking, its own, one burst from the first print as measured on its sound.
  assert.deepEqual(line.texts, { gauche: { from: 0.3, to: 2.53 }, droite: { from: 0.3, to: 2.53 } });
  assert.deepEqual(line.music, { downbeat: 0.13, filters: [{ kind: "soft", from: 0, to: 4, db: -4 }], end: { at: 8.863 } });
  assert.equal(line.sounds?.length, 1);
  const burst = line.sounds![0]!;
  assert.deepEqual([burst.at, burst.sound, burst.burst?.times.length, burst.burst?.times.at(-1)], [0.43, "light click", 18, 0.845]);
  // Fewer shots: fewer prints over the same burst, fewer pairs, every cut kept still on one of the original's.
  for (let n = table.shots[0]; n <= table.shots[1]; n++) {
    const fewer = table.timeline(n, { end: false });
    const { prints: p, pairs: k } = tableParts(n);
    assert.equal(fewer.shots.length, n);
    assert.equal(p + 2 * k + 5, n);
    assert.ok(p >= 4 && k >= 2 && k <= 5);
    const lands = fewer.shots.slice(1, 1 + p).map((s) => Math.round(s.start * 30));
    assert.ok(lands[0] === 13 && lands.at(-1) === 38, `${n}: ${lands}`);
    const cuts = fewer.shots.filter((s) => !s.beside).map((s) => Math.round(s.start * 30));
    assert.deepEqual(cuts.slice(0, 4), [0, 61, 70, 76], `${n}`);
  }
  // With an ending card (the original has none), its last shot held three whole beats longer for the card's 1,6 s.
  const ended = table.timeline(25, { end: true });
  assert.ok(Math.abs(ended.duration - line.duration - (3 * 60) / 110) < 0.04, `${ended.duration} s`);
  assert.deepEqual(ended.shots.slice(0, 24), line.shots.slice(0, 24));
  // At another tempo, all of it follows its beats.
  const slower = table.timeline(25, { end: false, bpm: 88 });
  assert.ok(Math.abs(slower.duration / line.duration - 110 / 88) < 0.01 && Math.abs(slower.sounds![0]!.burst!.times.at(-1)! - 0.845 * 1.25) < 0.002);
  // On her plan, for every count, with or without its card: valid, its prints and places laid beside on their moments.
  for (let n = table.shots[0]; n <= table.shots[1]; n++) {
    for (const end of [false, true]) {
      const files = Array.from({ length: n }, (_, i) => ({ id: `f${i}`, photo: i >= 1 && i <= tableParts(n).prints, seconds: 8 }));
      const plan = skillPlan({ skill: table, name: "Photos posées sur la table", files, fill: { shots: files.map((f) => ({ file: f.id, at: f.photo ? 0 : 1 })), texts: { gauche: "voici", droite: "Atelier Argile" }, end: end ? { title: "Ouvert dimanche" } : null } });
      const parsed = editPlanSchema.safeParse(plan);
      assert.ok(parsed.success, `n=${n} end=${end}: ${parsed.success ? "" : parsed.error.message.slice(0, 300)}`);
      assert.equal(plan.segments.filter((s) => "beside" in s && s.beside).length, tableParts(n).prints + tableParts(n).pairs);
      assert.ok(Math.abs(plan.duration - (end ? ended : table.timeline(n, { end: false })).duration) < 0.02 || n !== 25);
    }
  }
});

test("« Photos posées sur la table » (v2): its prints at once at the centre at the original's angles, gone by their light; its words by hand on either side", async () => {
  const { table } = await import("./skills/table.ts");
  const line = table.timeline(25, { end: false });
  const draw = await kitDraw(table.code);
  const props = tableProps(line);
  // Each print at once on its image, on the others, at the original's boxes: its ten angles (left as minus), its centres
  // at the middle, eight in 2:3, its 5th almost square and its 7th in 3:4, heights from 42 to 53 % of its 4:3 frame
  // (32 % for the square one); no border, no shadow.
  const lands = Array.from({ length: 10 }, (_, k) => changesOf(60, (f) => tablePrints(draw(f, props)).length > k)[0]);
  assert.deepEqual(lands, TABLE_PRINTS);
  const pile = tablePrints(draw(50, props));
  assert.deepEqual(pile.map((p) => p.angle), [0, -14.9, -9.9, -7.1, 7.8, -13.1, 11, -1.9, 0, 0]);
  assert.deepEqual(pile.map((p) => p.shot), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const p of pile) {
    assert.ok(Math.abs(p.box.left + p.box.width / 2 - 540) <= 15 && Math.abs(p.box.top + p.box.height / 2 - 0.513 * 810) <= 15, JSON.stringify(p.box));
    assert.ok(p.box.height >= 0.32 * 810 - 1 && p.box.height <= 0.53 * 810 + 1, JSON.stringify(p.box));
  }
  assert.deepEqual(pile.map((p) => Math.round((p.box.width / p.box.height) * 100) / 100).filter((a) => a !== 0.67), [0.96, 0.75]);
  assert.doesNotMatch(table.code, /boxShadow|border:/);
  // The pile goes by its light from image 54 in four images (the dark first, a plate's white last), the table bare after.
  const fade = drawnNodes(draw(55, props)).find((n) => n.type === "LumaFade")!;
  assert.deepEqual([fade.props.at, fade.props.frames], [54, 4]);
  assert.equal(tablePrints(draw(58, props)).length, 0);
  // Its two words written by hand from image 9, cream, fading in over 8 images: the words that bring her name left of the
  // pile against it, her name right of it, above the middle (clear of the apps' buttons), gone with the split screen.
  const words = (f: number) => handsOf(draw(f, props)).map((n) => ({ text: n.props.text, align: n.props.align, box: n.props.box as TdBox, color: n.props.color, font: String((n.props.style as Record<string, string>).fontFamily) }));
  assert.equal(words(8).length, 0);
  const pair = words(40);
  assert.deepEqual(pair.map((w) => [w.text, w.align, w.color]), [["voici", "right", "#fff0d6"], ["Argile", "left", "#fff0d6"]]);
  assert.ok(pair.every((w) => /^'Shadows Into Light'/.test(w.font)));
  const [left, right] = pair as [(typeof pair)[number], (typeof pair)[number]];
  assert.ok(left.box.x >= 40 && left.box.x + left.box.w <= 0.34 * 1080 && right.box.x >= 0.68 * 1080 && right.box.x + right.box.w <= 1040, JSON.stringify(pair.map((w) => w.box)));
  // Its letters reach about 50 px below their slot's middle (Shadows Into Light at 57 px, measured by the scene check in
  // Chrome): above the apps' buttons, which begin at the screen's middle on the right (less the check's 12 px).
  assert.ok(555 + right.box.y + right.box.h / 2 + 50 <= 960 - 12, JSON.stringify(right.box));
  const opacity = (f: number) => Number(styleOf(drawnNodes(draw(f, props)).find((n) => n.type === "div" && n.children.flat(Infinity).some((c) => (c as Drawn)?.type === "Handwriting"))!).opacity);
  assert.deepEqual([9, 13, 17, 60].map(opacity), [0, 0.5, 1, 1]);
  assert.deepEqual([75, 76].map((f) => words(f).length), [2, 0]);
  // A long name on two lines, growing upward (its bottom where one line's is), never smaller.
  const long = handsOf(draw(40, { ...props, reelTexts: [props.reelTexts[0]!, { ...props.reelTexts[1]!, text: "Maison Farine Lyon" }] }))[1]!;
  assert.equal(long.props.text, "Maison\nFarine Lyon");
  const tall = long.props.box as TdBox;
  assert.equal(tall.y + tall.h, right.box.y + right.box.h);
  // Its quick shots jerky (each image held three), the second burned on image 74, then black on the left and white on
  // the right on image 75, its words still over them.
  assert.deepEqual([61, 66, 70, 73].map((f) => drawnNodes(draw(f, props)).find((n) => n.type === "Footage")!.props.hold), [3, 3, 3, 3]);
  const burned = drawnNodes(draw(74, props));
  assert.match(String(styleOf(burned.find((n) => n.type === "Footage")!).filter), /^brightness\(3\.2\) contrast\(3\.4\)/);
  assert.ok(burned.some((n) => styleOf(n).mixBlendMode === "multiply" && styleOf(n).background === "#ecfcff"));
  const black = drawnNodes(draw(75, props));
  assert.ok(!black.some((n) => n.type === "Footage") && black.some((n) => /linear-gradient\(90deg, #000000 30%, #f2fdff 41%\)/.test(String(styleOf(n).background))));
  // None of its original's own words or name.
  assert.doesNotMatch(table.code + JSON.stringify(table.texts), /Joe Taylor|this is/i);
});

test("« Photos posées sur la table » (v2): horizontal 4:3 on black when her table is in width, full frame otherwise or on her word; its halves; light to render", async () => {
  const { table } = await import("./skills/table.ts");
  const { skillFillInput, skillSettings, skillPlan } = await import("./skills.ts");
  const { subjectsDrawn, objectsDrawn, clearsDrawn, depthsDrawn } = await import("./subject.ts");
  const { checkMotionCode } = await import("./motion-scene.ts");
  const line = table.timeline(25, { end: false });
  const draw = await kitDraw(table.code);
  const frameOf = (tree: Drawn) => {
    const b = drawnNodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden" && styleOf(n).backgroundColor === "#000000")!;
    return [styleOf(b).top, styleOf(b).height];
  };
  const upright = { shots: tableShots(line, 9 / 16) };
  // Her table in width: the original's 4:3 band in the middle of the screen; upright: the whole frame; her setting either way.
  assert.deepEqual(frameOf(draw(100, tableProps(line))), [555, 810]);
  assert.deepEqual(frameOf(draw(100, tableProps(line, upright))), [0, 1920]);
  assert.deepEqual(frameOf(draw(100, tableProps(line, { texts: { ...marksOf(line), format: "vertical" } }))), [0, 1920]);
  assert.deepEqual(frameOf(draw(100, tableProps(line, { ...upright, texts: { ...marksOf(line), format: "horizontal" } }))), [555, 810]);
  assert.deepEqual(table.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(table, [{ name: "format", value: "vertical" }]), { format: "vertical" });
  // Its halves, each at its own speed (no `at`): side by side, her place on the left and the gesture on the right (2:3
  // each); in vertical the gesture above her place (9:8 each).
  const halves = (f: number, extra: Record<string, unknown> = {}) => tableHalves(draw(f, tableProps(line, extra))).map((h) => [h.shot, ...h.box]);
  assert.deepEqual(halves(110), [[16, 0, 0, 540, 810], [15, 540, 0, 540, 810]]);
  assert.deepEqual(halves(110, upright), [[16, 0, 960, 1080, 960], [15, 0, 0, 1080, 960]]);
  assert.ok(tableHalves(draw(110, tableProps(line))).every((h) => h.style.left === 0 && !("at" in h)));
  // The gesture's half still bright two images after the burn; then it cuts alone (183), her place held.
  const lit = (f: number) => tableHalves(draw(f, tableProps(line))).find((h) => h.box[0] === 540)!.style.filter;
  assert.deepEqual([76, 77, 78].map(lit), ["brightness(1.14)", "brightness(1.14)", undefined]);
  assert.deepEqual(halves(170), [[22, 0, 0, 540, 810], [21, 540, 0, 540, 810]]);
  assert.deepEqual(halves(190), [[22, 0, 0, 540, 810], [23, 540, 0, 540, 810]]);
  // Its last shot takes the gesture's half on image 200 (its whole frame seen through it, in place), the whole frame an
  // image later, to the end.
  const through = tableHalves(draw(200, tableProps(line)));
  assert.deepEqual(through.map((h) => [h.shot, h.style.left, h.style.width]), [[22, 0, 540], [24, -540, 1080]]);
  assert.deepEqual(drawnNodes(draw(201, tableProps(line))).filter((n) => n.type === "Footage").map((n) => [n.props.shot, styleOf(n).width]), [[24, 1080]]);
  // The filler sees which half plays with which, and where each is.
  const files = Array.from({ length: 16 }, (_, i) => ({ id: `f${i}`, photo: i >= 1 && i <= 8, seconds: i >= 1 && i <= 8 ? 0 : 10, aspect: i >= 1 && i <= 8 ? 0.75 : 9 / 16 }));
  const input = skillFillInput({ skill: table, name: "Photos posées sur la table", n: 25, files, business: {}, request: "" });
  assert.equal(input.cases.filter((c) => "en_meme_temps_que" in c).length, 15);
  assert.match(input.cases[13]!.veut, /^la moitié de droite \(du haut quand le Reel est vertical\) de l'écran partagé : un geste/);
  assert.match(input.cases[14]!.veut, /^la moitié de gauche \(du bas quand le Reel est vertical\) de l'écran partagé : son lieu/);
  assert.match(table.timeline(25, { end: false, settings: { format: "vertical" } }).shots[13]!.want, /^la moitié du haut/);
  // Its grade without vignette nor grain; light to render: her prints mounted only while the pile is seen (inside one
  // light fade), two shots at once in the split screen, nothing cut out, followed, read or in depth.
  assert.deepEqual(table.finish, { vignette: 0, grain: 0 });
  for (let f = 0; f < 268; f++) {
    const n = drawnNodes(draw(f, tableProps(line))).filter((x) => x.type === "Footage").length;
    assert.ok(f < 13 ? n === 1 : f < 58 ? n <= 11 : n <= 2, `image ${f}: ${n}`);
  }
  assert.deepEqual([subjectsDrawn(table.code), objectsDrawn(table.code), clearsDrawn(table.code), depthsDrawn(table.code)], [[], [], [], []]);
  assert.deepEqual(checkMotionCode(table.code), []);
  assert.doesNotMatch(table.code, /scale\(|translate|Whip|Punch|ZoomThrough/);
  const plan = skillPlan({ skill: table, name: "Photos posées sur la table", files, fill: { shots: Array.from({ length: 25 }, (_, i) => ({ file: files[i % 16]!.id, at: 0 })), texts: { gauche: "voici", droite: "Argile" }, end: null, settings: { format: "vertical" } } });
  assert.deepEqual(plan.skill, { key: "table", version: 2, settings: { format: "vertical" } });
  assert.equal(plan.layers![0]!.motion.texts!.format, "vertical");
});

test("« Interrupteur » (v4): once she has left, her wall held on that image to the end, nothing of hers coming back; never frozen when nothing says she was there", async () => {
  const { interrupteur } = await import("./skills/interrupteur.ts");
  assert.equal(interrupteur.version, 9);
  const line = interrupteur.timeline(1, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#7a2e3b", palette: { secondary: "#2c4a3e", light: "#f4efe9", dark: "#1d1d1b" } };
  const reelTexts = [{ text: "Atelier Rose", role: "hook", from: 123, to: 273, emphasis: [] }];
  const props = { width: 1080, height: 1920, durationInFrames: 273, brand, shots: rallumeShots(line, 9 / 16), reelTexts, end: null, texts: marks };
  // She is seen until image 200, gone from 201, and her hand comes back into the picture on 240.
  const track = (f: number) => ({
    hands: (f >= 60 && f <= 160) || f >= 240 ? [{ points: { index_tip: { x: 640, y: f < 110 ? 1100 - (f - 60) * 14 : 400 + (f - 110) * 14 }, wrist: { x: 640, y: 1300 } } }] : [],
    bodies: f >= 40 && f <= 200 ? [{ points: { left_shoulder: { x: 560, y: 900, visible: true }, right_shoulder: { x: 700, y: 900, visible: true } } }] : [],
  });
  const { draw } = await kitScene(interrupteur.code, { track });
  const footageAt = (f: number) => drawnNodes(draw(f, props)).find((n) => n.props.key === "wall")!.props.at as number | undefined;
  // While she is there, her shot plays as filmed; from her leaving, the image of that moment, whatever comes after.
  assert.equal(footageAt(150), undefined);
  assert.equal(footageAt(195), undefined);
  const held = [210, 240, 272].map((f) => f - (footageAt(f) ?? f));
  assert.ok(held.every((h) => h === held[0]) && held[0]! >= 201 && held[0]! <= 207, held.join(" "));
  // Seen to the end: her shot plays to the end.
  const stays = (f: number) => ({ ...track(f), bodies: f >= 40 ? track(Math.min(f, 200)).bodies : [] });
  const { draw: there } = await kitScene(interrupteur.code, { track: stays });
  assert.equal(drawnNodes(there(250, props)).find((n) => n.props.key === "wall")!.props.at, undefined);
  // A track that never saw her at the flip (her back turned, a pose read lost): nothing says she left, never frozen.
  const blind = (f: number) => ({ hands: [], bodies: f < 30 ? [{ points: {} }] : [] });
  const { draw: lost } = await kitScene(interrupteur.code, { track: blind });
  assert.equal(drawnNodes(lost(250, props)).find((n) => n.props.key === "wall")!.props.at, undefined);
});

test("« Mots mêlés » (v4): each letter's halo stronger where the picture stays bright under it, the same as v3's on a dark one", async () => {
  const { motsMeles } = await import("./skills/mots-meles.ts");
  assert.equal(motsMeles.version, 4);
  const line = motsMeles.timeline(1, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const props = { width: 1080, height: 1920, durationInFrames: 563, brand: { name: "Le Studio", displayFont: "Inter Tight", bodyFont: "Inter Tight" }, shots: rallumeShots(line), reelTexts: MM_WORDS, end: null, texts: marks };
  const halo = async (light: { mean: number; high: number }) => {
    const { draw } = await kitScene(motsMeles.code, { light });
    const shadows = drawnNodes(draw(500, props)).map((n) => styleOf(n).textShadow).filter((t): t is string => typeof t === "string" && t.startsWith("0 0 "));
    assert.ok(shadows.length > 100);
    const alpha = Number(/rgba\(0,0,0,([\d.]+)\)/.exec(shadows[0]!)![1]);
    const blur = Number(/^0 0 (\d+)px/.exec(shadows[0]!)![1]);
    return { alpha, blur };
  };
  // Under a dark part (a fifth of white): v3's soft halo; under a glass roof that stays bright under the veil: darker and wider.
  const dark = await halo({ mean: 0.2, high: 0.2 });
  assert.deepEqual(dark, { alpha: 0.55, blur: 6 });
  const bright = await halo({ mean: 0.85, high: 1 });
  assert.ok(bright.alpha > 0.7 && bright.blur >= 10, JSON.stringify(bright));
});

// ——— « Toi sur un aplat de couleur » v2, written on its original's fiche (docs/fiches/aplat.md) ——————————————————————

/** Its music's first beat: the original's image 1,95 (0,065 s). Its model starts on it. */
const AP_FIRST_BEAT = 1.95;
/** The original's cuts (images at 30 i/s): the next shot whole, the one in front of a background, the same later; the red; its end. */
const AP_CUTS = [120, 178, 236];
const AP_RED = 251;
const AP_END = 264;
/** What its code draws at a frame, as the render gets it: her walk and the next shot's pieces read (« 0 », « 1#every tote bag »), her sky. */
const aplatDrawn = async (frame: number, options: { n?: number; aspect?: number; end?: boolean; read?: Parameters<typeof drawCutOuts>[3]; settings?: Record<string, string>; accent?: string; named?: boolean; texts?: unknown[] } = {}) => {
  const { aplat } = await import("./skills/aplat.ts");
  const { skillCode } = await import("./skills.ts");
  const line = aplat.timeline(options.n ?? 4, { end: Boolean(options.end) });
  const durationInFrames = Math.round(line.duration * 30);
  const code = options.named === false ? aplat.code : skillCode(aplat, { choses: "every tote bag" });
  const tree = drawCutOuts(
    code,
    frame,
    {
      width: 1080,
      height: 1920,
      durationInFrames,
      brand: { name: "Brick Lane", displayFont: "Anton", bodyFont: "Inter Tight", accent: options.accent ?? "#e4572e" },
      shots: pileShots(line, options.aspect ?? 9 / 16),
      reelTexts: options.texts ?? [],
      end: options.end ? { title: "Vide-dressing samedi", subtitle: "de 10 h à 18 h", from: durationInFrames - 48 } : null,
      texts: { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...(options.settings ?? {}) },
    },
    options.read ?? AP_READ,
  );
  return { line, tree, nodes: drawnNodes(tree) };
};
/** Her walking and her box, the next shot's four tote bags and one far one, her sky (a straight skyline at 600 px). */
const AP_READ = {
  boxes: { "0": { x: 400, y: 900, w: 200, h: 600 }, "2": { x: 300, y: 600, w: 400, h: 1200 } },
  parts: { "1#every tote bag": [{ x: 100, y: 1300, w: 200, h: 300 }, { x: 700, y: 1250, w: 220, h: 300 }, { x: 150, y: 800, w: 180, h: 250 }, { x: 800, y: 900, w: 160, h: 200 }, { x: 500, y: 300, w: 100, h: 100 }] },
  skyline: (shot: number | undefined) => (shot === 0 ? 600 : null),
};
/** The kinds of what is drawn, in order: « Subject0 », « Subject1/2 white » (a piece, white), « Near0 », « Footage1 »… */
const apKinds = (nodes: Drawn[]) =>
  nodes
    .filter((n) => ["Footage", "Subject", "Near", "Skyline", "CastShadow", "Look", "Sketch", "Ascii"].includes(n.type as string))
    .map((n) => `${n.type as string}${n.props.shot ?? ""}${typeof n.props.part === "number" ? `/${n.props.part}` : ""}${n.props.fill ? " white" : ""}`);

test("« Toi sur un aplat de couleur » (v2) cuts where its original does, on its own music (123 BPM), its dips, its end on the colour", async () => {
  const { aplat } = await import("./skills/aplat.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(aplat.version, 2);
  assert.equal(aplat.bpm, 123);
  const line = aplat.timeline(4, { end: false });
  // Its walk, the next shot, the one in front of a background, the same later: each cut within two images of the
  // original's, counted from its music's first beat; the colour back on beat 17, the Reel 18 beats long.
  assert.equal(line.shots.length, 4);
  line.shots.slice(1).forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - (AP_CUTS[i]! - AP_FIRST_BEAT)) <= 2, `shot ${i + 2}: image ${Math.round(s.start * 30)}, the original's ${AP_CUTS[i]}`));
  assert.ok(Math.abs(line.marks.red! - (AP_RED - AP_FIRST_BEAT)) <= 1, `red ${line.marks.red}`);
  assert.ok(Math.abs(Math.round(line.duration * 30) - (AP_END - AP_FIRST_BEAT)) <= 2, `${line.duration} s`);
  assert.ok(Math.abs(line.duration - 18 * (60 / 123)) < 0.02);
  // Its moments, within an image of the original's: her shot rebuilding from beat 1 (its image 16), her ground white
  // (59) and back (62), her sky white (76) and her shot whole (79), the next shot's pieces in colour (87, 91, 98, 105,
  // 112), its frame closing from 136 to 177, its six looks on its notes (192, 198, 207, 212, 219, 226).
  const at = (image: number) => image - AP_FIRST_BEAT;
  assert.ok(Math.abs(line.marks.near_0! - at(16)) <= 1);
  assert.ok(Math.abs(line.marks.ground! - at(59)) <= 1 && Math.abs(line.marks.sky! - at(76)) <= 1);
  [87, 91, 98, 105, 112].forEach((image, k) => assert.ok(Math.abs(line.marks[`land_${k}`]! - at(image)) <= 1, `piece ${k + 1}: ${line.marks[`land_${k}`]}`));
  const second = Math.round(line.shots[1]!.start * 30);
  assert.ok(Math.abs(second + line.marks.close_after! - at(136)) <= 2);
  assert.equal(second + Math.round((line.shots[1]!.end - line.shots[1]!.start) * 30) - 1, Math.round(at(177)));
  [192, 198, 207, 212, 219, 226].forEach((image, k) => assert.ok(Math.abs(line.marks[`style_${k}`]! - at(image)) <= 1, `look ${k + 1}: ${line.marks[`style_${k}`]}`));
  // Its music: its held note's dip in the beat before beat 4 and before the frozen world (the original's 1,60 to 2,00 s
  // and 5,43 to 5,92 s), faded out in a tenth of a second at its end; no sound effect (its original has none).
  const beat = 60 / 123;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  assert.deepEqual(line.music, {
    filters: [
      { kind: "soft", from: r3(3.15 * beat), to: r3(4 * beat), db: -6, open: 0.02 },
      { kind: "soft", from: r3(line.shots[2]!.start - beat), to: line.shots[2]!.start, db: -6, open: 0.02 },
    ],
    end: { at: line.duration, fade: 0.1 },
  });
  assert.ok(Math.abs(line.music!.filters![0]!.from - (1.6 - 0.065)) < 0.05 && Math.abs(line.music!.filters![1]!.from - (5.43 - 0.065)) < 0.05);
  assert.equal(line.sounds, undefined);
  // More shots (her files, a length she asks for): framed shots of four beats in its middle, its walk, its frozen world
  // and its end the same, up to about 28 s; at another tempo all of it follows; with an ending card, the colour lasts
  // the card's 1,6 s, its cuts the same.
  const longest = aplat.timeline(14, { end: false });
  assert.equal(longest.shots.length, 14);
  assert.ok(longest.duration > 27 && longest.duration < 29, `${longest.duration} s`);
  assert.ok(longest.shots.slice(1, 12).every((s) => Math.abs(s.end - s.start - 4 * beat) < 0.04));
  assert.ok(Math.abs(longest.music!.filters![1]!.to - longest.shots[12]!.start) < 0.005);
  const ended = aplat.timeline(4, { end: true });
  assert.deepEqual(ended.shots.slice(0, 3), line.shots.slice(0, 3));
  assert.ok(ended.duration - ended.marks.red! / 30 >= 1.6, `${ended.duration} s`);
  const slower = aplat.timeline(4, { end: false, bpm: 100 });
  assert.ok(Math.abs(slower.duration / line.duration - 1.23) < 0.01 && Math.abs(slower.marks.red! / line.marks.red! - 1.23) < 0.02);
  // On the plan: valid, its music's shape, its version.
  const files = Array.from({ length: 4 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const plan = skillPlan({ skill: aplat, name: "Toi sur un aplat de couleur", files, fill: { shots: files.map((f) => ({ file: f.id, at: 1 })), texts: {}, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.music_shape?.filters?.length, 2);
  assert.deepEqual(plan.skill, { key: "aplat", version: 2 });
  assert.equal(plan.texts.length, 0);
});

test("« Toi sur un aplat de couleur » (v2): her silhouette white then on the colour, her shot rebuilt from the nearest, her ground, her sky, the next shot's still pieces", async () => {
  // Her first three images: she and her shadow flat white in a white halo, on the flat colour (hers, vivid); then in
  // her own colours, her shadow cast from her feet (drawn from her silhouette), under her.
  const first = await aplatDrawn(0);
  assert.deepEqual(apKinds(first.nodes), ["CastShadow", "Subject0", "Subject0 white"]);
  assert.ok(first.nodes.some((n) => n.type === "div" && /drop-shadow\(0 0 \d+px #ffffff\)/.test(String(styleOf(n).filter ?? ""))));
  assert.ok(first.nodes.some((n) => n.type === "div" && styleOf(n).backgroundColor === "#e4572e"));
  assert.equal((first.nodes.find((n) => n.type === "CastShadow")!.props as { color: string }).color, "#ffffff");
  const walking = await aplatDrawn(10);
  assert.deepEqual(apKinds(walking.nodes), ["CastShadow", "Subject0", "Subject0"]);
  assert.deepEqual(walking.nodes.find((n) => n.type === "CastShadow")!.props.box, AP_READ.boxes["0"]);
  // From beat 1 her shot rebuilds itself from the nearest to the farthest: its depth as a mask growing (the ground under
  // her in seven images, its path, then on at a constant speed), held, under her.
  const line = (await aplatDrawn(0)).line;
  const depth = async (f: number) => Number((await aplatDrawn(f)).nodes.find((n) => n.type === "Near")?.props.depth ?? -1);
  assert.equal(await depth(line.marks.near_0! - 1), -1);
  const ds: number[] = [];
  for (let f = line.marks.near_0!; f < line.marks.ground!; f++) ds.push(await depth(f));
  assert.ok(ds.every((d, i) => i === 0 || d >= ds[i - 1]!) && ds[0]! < 0.06 && ds.at(-1)! >= 0.55, ds.join(" "));
  const steps = ds.slice(line.marks.near_3! - line.marks.near_0! + 1, line.marks.near_4! - line.marks.near_0!).map((d, i, all) => (i ? d - all[i - 1]! : null)).filter((d): d is number => d !== null);
  assert.ok(Math.max(...steps) - Math.min(...steps) < 1e-9, "constant speed");
  // Just before beat 4 the rest of her ground (her shot without its sky) flat white for three images, then in its
  // colours, her sky still the colour; then her sky white for three images, then her shot whole.
  const g = line.marks.ground!;
  const sky = line.marks.sky!;
  const whiteGround = async (f: number) => (await aplatDrawn(f)).nodes.some((n) => n.type === "div" && styleOf(n).filter === "brightness(0) invert(1)" && drawnNodes(n).some((c) => c.type === "Skyline"));
  assert.deepEqual(await Promise.all([g - 1, g, g + 2, g + 3].map(whiteGround)), [false, true, true, false]);
  assert.deepEqual(apKinds((await aplatDrawn(g + 3)).nodes), ["Skyline0"]);
  const ground = async (f: number) => (await aplatDrawn(f)).nodes.find((n) => n.type === "div" && styleOf(n).width === 1080 && styleOf(n).height === 1920 && styleOf(n).backgroundColor && !drawnNodes(n).slice(1).length);
  assert.equal(styleOf((await ground(g + 3))!).backgroundColor, "#e4572e");
  assert.equal(styleOf((await ground(sky))!).backgroundColor, "#ffffff");
  assert.deepEqual(apKinds((await aplatDrawn(sky + 3)).nodes), ["Footage0"]);
  // No sky in her shot (an interior): her ground and her top come back as bands, each white three images first.
  const noSky = { ...AP_READ, skyline: () => null };
  const band = async (f: number) => (await aplatDrawn(f, { read: noSky })).nodes.filter((n) => n.type === "div" && styleOf(n).backgroundColor === "#ffffff" && styleOf(n).width === 1080 && Number(styleOf(n).height) < 1920).map((n) => styleOf(n).top);
  assert.deepEqual(await band(g), [653]);
  assert.ok(apKinds((await aplatDrawn(g + 3, { read: noSky })).nodes).includes("Footage0"));
  assert.deepEqual(await band(sky), [0]);
  // Without her cut-out: her shot in black and white multiplied by the colour.
  const bare = await aplatDrawn(10, { read: { skyline: AP_READ.skyline } });
  assert.ok(bare.nodes.some((n) => n.type === "Footage" && /^grayscale\(1\)/.test(String(styleOf(n).filter))) && bare.nodes.some((n) => styleOf(n).mixBlendMode === "multiply"));
  // From beat 5¾ the next shot lands on her walk piece by piece, still: what it has several of (named by the filler),
  // from the nearest to the farthest, alternating sides (bottom left, bottom right, middle left, middle right), each
  // white an image, then an image without it, then itself; then its whole bottom, its white burnt.
  const lands = [0, 1, 2, 3, 4].map((k) => line.marks[`land_${k}`]!);
  const pieces = async (f: number) => apKinds((await aplatDrawn(f)).nodes).filter((k) => k.startsWith("Subject1") || k.startsWith("Footage1"));
  assert.deepEqual(await pieces(lands[0]! - 3), []);
  assert.deepEqual(await pieces(lands[0]! - 2), ["Subject1/0 white"]);
  assert.deepEqual(await pieces(lands[0]! - 1), []);
  assert.deepEqual(await pieces(lands[0]!), ["Subject1/0"]);
  assert.deepEqual(await pieces(lands[1]!), ["Subject1/0", "Subject1/1"]);
  assert.deepEqual(await pieces(lands[3]!), ["Subject1/0", "Subject1/1", "Subject1/2", "Subject1/3"]);
  const burnt = (await aplatDrawn(lands[4]! - 2)).nodes.find((n) => n.type === "Footage" && n.props.shot === 1)!;
  assert.deepEqual([styleOf(burnt).filter, styleOf(burnt).clipPath], ["brightness(3)", "inset(768px 0 0px 0)"]);
  assert.deepEqual(await pieces(lands[4]!), ["Subject1/0", "Subject1/1", "Subject1/2", "Subject1/3", "Footage1"]);
  // Nothing named in that shot: three bands of it from the bottom up, one an eighth.
  const bands = async (f: number) => (await aplatDrawn(f, { named: false })).nodes.filter((n) => n.type === "Footage" && n.props.shot === 1).map((n) => styleOf(n).clipPath);
  assert.deepEqual(await bands(lands[2]!), ["inset(1280px 0 0px 0)"]);
  assert.deepEqual(await bands(lands[4]!), ["inset(1280px 0 0px 0)", "inset(640px 0 640px 0)", "inset(0px 0 1280px 0)"]);
});

test("« Toi sur un aplat de couleur » (v2): its next shot burnt as it lands, a frame of the colour at a constant speed, the frozen world in a new look on each note", async () => {
  const { line } = await aplatDrawn(0);
  const from = Math.round(line.shots[1]!.start * 30);
  // The next shot whole, overexposed for two images as it lands, then as filmed.
  const framed = async (f: number, options: Parameters<typeof aplatDrawn>[1] = {}) => (await aplatDrawn(f, options)).nodes.find((n) => n.type === "Footage" && n.props.shot === 1)!;
  assert.deepEqual(await Promise.all([from, from + 1, from + 2].map(async (f) => styleOf(await framed(f)).filter ?? null)), ["brightness(2.8) saturate(1.15)", "brightness(2.8) saturate(1.15)", null]);
  // A beat in, a frame of the colour closes in on it from its four sides at a constant speed to the cut, the picture
  // never shrinking nor moving (its box the whole frame, clipped): 150 px a side full frame; in its 4:3 frame, the
  // original's 14,7 % of the width on its sides and 17,8 % of the height above and below.
  const close = from + line.marks.close_after!;
  assert.equal(styleOf(await framed(close - 1)).clipPath, undefined);
  const insets: number[] = [];
  for (let f = close; f < from + Math.round((line.shots[1]!.end - line.shots[1]!.start) * 30); f++) {
    const s = styleOf(await framed(f));
    assert.deepEqual([s.left, s.top, s.width, s.height], [0, 0, 1080, 1920]);
    insets.push(Number(/inset\((\d+)px/.exec(String(s.clipPath ?? "inset(0px"))![1]));
  }
  assert.equal(insets.at(-1), 150);
  const gaps = insets.slice(1).map((v, i) => v - insets[i]!);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, gaps.join(" "));
  assert.equal(styleOf(await framed(from + 58, { aspect: 16 / 9 })).clipPath, "inset(144px 159px)");
  // Someone in front of a background: as filmed for a beat, then the world behind them frozen on one image (its
  // Footage held on the frame of the first note) in a new look on each note, they cut out in front, moving.
  const photo = Math.round(line.shots[2]!.start * 30);
  const looks = [0, 1, 2, 3, 4, 5].map((k) => line.marks[`style_${k}`]!);
  const frozen = async (f: number) => {
    const { nodes } = await aplatDrawn(f);
    const footage = nodes.find((n) => n.type === "Footage" && n.props.shot === 2)!;
    return { held: typeof footage.props.at === "number" ? f - (footage.props.at as number) : null, kinds: apKinds(nodes), filter: String(styleOf(footage).filter ?? ""), nodes };
  };
  assert.deepEqual((await frozen(looks[0]! - 1)).kinds, ["Footage2"]);
  const seen = await Promise.all(looks.map((f) => frozen(f)));
  assert.ok(seen.every((s) => s.held === looks[0]! - photo && s.kinds.at(-1) === "Subject2"), JSON.stringify(seen.map((s) => [s.held, s.kinds])));
  assert.equal(seen[0]!.filter, "saturate(2.1) contrast(1.2) brightness(1.04)");
  assert.match(seen[1]!.filter, /^url\(#ap/);
  assert.ok(seen[2]!.kinds.includes("Sketch"));
  assert.ok(seen[3]!.filter.startsWith("grayscale(1)") && seen[3]!.nodes.some((n) => styleOf(n).mixBlendMode === "screen" && styleOf(n).backgroundColor === "#e4572e"));
  assert.deepEqual(seen[4]!.nodes.find((n) => n.type === "Look")!.props.preset, "bw");
  assert.ok(seen[5]!.nodes.some((n) => n.type === "Ascii" && n.props.kind === "dots" && n.props.ink === "#e4572e"));
  // Never a look the original's AI drew: no painting, no invented clouds; every look one of the engine's own filters.
  assert.doesNotMatch((await import("./skills/aplat.ts")).aplat.code, /cloud|paint|cartoon/i);
  // Without their cut-out: the whole shot frozen, a new look on each note.
  const alone = await aplatDrawn(looks[2]!, { read: { ...AP_READ, boxes: { "0": AP_READ.boxes["0"] } } });
  assert.deepEqual(apKinds(alone.nodes), ["Sketch", "Footage2"]);
  // The same shot later, then the colour full frame on beat 17 to the end: the Reel loops onto its opening.
  const red = line.marks.red!;
  assert.deepEqual(apKinds((await aplatDrawn(red - 1)).nodes), ["Footage3"]);
  assert.deepEqual(apKinds((await aplatDrawn(red)).nodes), []);
  assert.ok((await aplatDrawn(red)).nodes.some((n) => n.type === "div" && styleOf(n).backgroundColor === "#e4572e" && styleOf(n).height === 1920));
  // Its ending card on the colour, five images in: its title stacked in capitals of the colour's ink, its line under it.
  const ended = (await import("./skills/aplat.ts")).aplat.timeline(4, { end: true });
  const card = await aplatDrawn(Math.round(ended.duration * 30) - 48 + 5, { end: true });
  assert.ok(heldText(card.tree).includes("Vide-dressing\nsamedi") && heldText(card.tree).includes("de 10 h à 18 h"), heldText(card.tree));
  assert.ok(card.nodes.some((n) => n.type === "div" && styleOf(n).backgroundColor === "#e4572e" && styleOf(n).height === 1920));
});

test("« Toi sur un aplat de couleur » (v2): horizontal 4:3 on black as its original when her files are, full frame otherwise; her colour, the original's red; light to render", async () => {
  const { aplat } = await import("./skills/aplat.ts");
  const { skillCode, skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const { ANY_SHOT, objectsDrawn, nearsDrawn, readsDrawn, subjectsDrawn } = await import("./subject.ts");
  const { usesPassageLooks } = await import("./motion.ts");
  const frameOf = (nodes: Drawn[]) => {
    const box = nodes.find((n) => n.type === "div" && styleOf(n).overflow === "hidden" && styleOf(n).backgroundColor === "#000000")!;
    return { top: styleOf(box).top, height: styleOf(box).height };
  };
  // Her files mostly horizontal: its 4:3 picture (1080 × 810) at the middle of the frame, on black; upright: the whole
  // frame; her setting either way.
  assert.deepEqual(frameOf((await aplatDrawn(120, { aspect: 16 / 9 })).nodes), { top: 555, height: 810 });
  assert.deepEqual(frameOf((await aplatDrawn(120)).nodes), { top: 0, height: 1920 });
  assert.equal(frameOf((await aplatDrawn(120, { aspect: 16 / 9, settings: { format: "vertical" } })).nodes).height, 1920);
  assert.equal(frameOf((await aplatDrawn(120, { settings: { format: "horizontal" } })).nodes).top, 555);
  assert.deepEqual(aplat.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]], ["couleur", ["sienne", "rouge"]]]);
  assert.deepEqual(skillSettings(aplat, [{ name: "format", value: "auto" }, { name: "couleur", value: "rouge" }]), { couleur: "rouge" });
  // Its colour: hers when vivid, else the original's pure red (#FF0000 measured), on her word the red whatever hers.
  const colourOf = async (accent: string, settings: Record<string, string> = {}) =>
    styleOf((await aplatDrawn(10, { accent, settings })).nodes.find((n) => n.type === "div" && styleOf(n).height === 1920 && styleOf(n).backgroundColor && styleOf(n).backgroundColor !== "#000000")!).backgroundColor;
  assert.equal(await colourOf("#e4572e"), "#e4572e");
  assert.equal(await colourOf("#f3efe6"), "#ff0000");
  assert.equal(await colourOf("#2f6b4f"), "#ff0000");
  assert.equal(await colourOf("#e4572e", { couleur: "rouge" }), "#ff0000");
  assert.doesNotMatch(aplat.code, /#e30613/);
  // Her optional title on the colour of her opening, above her (she passes in front of it), until her ground comes back.
  const texts = [{ text: "un samedi", role: "hook", from: 3, to: 57, emphasis: [] }];
  const titled = await aplatDrawn(10, { texts });
  const title = titled.nodes.find((n) => n.type === "FitText" && heldText(n).includes("un samedi"))!;
  const box = title.props.style as { top: number; height: number; left: number; width: number };
  assert.ok(box.top + box.height <= AP_READ.boxes["0"].y && box.left === 140 && box.width === 800, JSON.stringify(box));
  assert.ok(titled.nodes.indexOf(title) < titled.nodes.map((n) => n.type === "Subject").lastIndexOf(true));
  assert.equal((await aplatDrawn(57, { texts })).nodes.some((n) => n.type === "FitText"), false);
  assert.deepEqual(aplat.texts.map((t) => [t.slot, t.role, t.required]), [["titre", "hook", false], ["ligne", "caption", false]]);
  // What it cuts out: her walk and the one in front of a background, for every count it plays, exactly the shots its
  // code draws them on (every image, every branch); its object on the next shot; her walk's depth and sky only.
  for (const n of [4, 5, 9, 14]) {
    for (const end of [false, true]) {
      const line = aplat.timeline(n, { end });
      const durationInFrames = Math.round(line.duration * 30);
      const props = { width: 1080, height: 1920, durationInFrames, brand: { name: "Studio", displayFont: "Anton", bodyFont: "Inter Tight", accent: "#e4572e" }, shots: pileShots(line, 9 / 16), reelTexts: [{ text: "un samedi", role: "hook", from: 3, to: 57, emphasis: [] }], end: end ? { title: "Ouvert samedi", subtitle: null, from: durationInFrames - 48 } : null, texts: Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])) };
      const drawn = await cutoutsDrawn(skillCode(aplat, { choses: "every table" }), props, Array.from({ length: durationInFrames }, (_, f) => f));
      assert.deepEqual([...drawn].sort((a, b) => a - b), line.cutouts, `${n} shots${end ? ", an ending card" : ""}`);
    }
  }
  const named = skillCode(aplat, { choses: "every tote bag" });
  assert.deepEqual(objectsDrawn(named), [{ shot: 1, name: "every tote bag" }]);
  assert.deepEqual(objectsDrawn(aplat.code), []);
  assert.deepEqual(nearsDrawn(aplat.code), [0]);
  assert.deepEqual(readsDrawn(aplat.code), [{ shot: 0, kinds: ["ground", "sky"] }]);
  // (Its code names the one in front of a background by its place from the end: its timeline says which shots, the engine reads that.)
  assert.deepEqual(subjectsDrawn(aplat.code), [ANY_SHOT, 0]);
  // Light to render: each piece mounted only while it is seen (her shot's depth while it rebuilds, her ground and her
  // sky while they come back, her cut-out and her shadow while the colour is around her, the next shot's pieces from
  // the first to land), never more than six of her pictures at once; no grain nor dark corners on the colour.
  const { line } = await aplatDrawn(0);
  const total = Math.round(line.duration * 30);
  let most = 0;
  for (let f = 0; f < total; f++) {
    const kinds = apKinds((await aplatDrawn(f)).nodes);
    most = Math.max(most, kinds.length);
    if (kinds.includes("Near0")) assert.ok(f >= line.marks.near_0! && f < line.marks.ground! + 3, `Near at ${f}`);
    if (kinds.includes("Skyline0")) assert.ok(f >= line.marks.ground! && f < line.marks.sky! + 3, `Skyline at ${f}`);
    if (kinds.includes("CastShadow")) assert.ok(f < line.marks.ground!, `shadow at ${f}`);
    if (kinds.some((k) => k.startsWith("Subject0"))) assert.ok(f < line.marks.ground! + 3, `her at ${f}`);
    if (kinds.some((k) => k.startsWith("Subject1"))) assert.ok(f >= line.marks.land_0! - 2 && f < Math.round(line.shots[1]!.start * 30), `a piece at ${f}`);
    if (kinds.includes("Subject2")) assert.ok(f >= line.marks.style_0! && f < Math.round(line.shots[3]!.start * 30), `them at ${f}`);
  }
  assert.ok(most <= 6, `${most} pictures at once`);
  assert.deepEqual(aplat.finish, { grain: 0, vignette: 0 });
  assert.equal(usesPassageLooks({ segments: [], layers: [{ from: 0, to: 9, compose: true, motion: { brief: "b", js: aplat.code } }] }), true);
  // The filler sees its object slot on its next shot, its slots, its four to six shots and its lengths.
  const files = Array.from({ length: 5 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: aplat, name: "Toi sur un aplat de couleur", n: 4, files, business: {}, request: "" });
  assert.deepEqual(input.objets?.map((o) => [o.slot, o.case]), [["choses", 2]]);
  assert.match(input.cases[0]!.veut, /marche/);
  assert.match(input.cases[2]!.veut, /devant un fond/);
  assert.deepEqual([aplat.shots, aplat.files, aplat.long], [[4, 6], [3, 10], 14]);
  const plan = skillPlan({ skill: aplat, name: "Toi sur un aplat de couleur", files, fill: { shots: files.slice(0, 4).map((f) => ({ file: f.id, at: 1 })), texts: { titre: "un samedi" }, end: null, objects: { choses: "every table" } } });
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 4, subjects: [0, 2], objects: [{ shot: 1, name: "every table" }] });
});

// ——— « Ton nom qui clignote » (`detourages`) v2, written on its original's fiche (docs/fiches/detourages.md) —————————————

/** The original's cuts (images at 30 i/s): its opening, the drop, its burst (its sweeps the 10th and 18th of it), its last shot; its end. */
const DT_CUTS = [0, 187, 198, 205, 216, 226, 239, 248, 258, 268, 290, 300, 308, 328, 341, 352, 365, 380, 394, 404, 413, 432, 445];
const DT_END = 494;
/** Its letters as the fiche measured ICELAND's (images): each one's flash, its dark and its light for good. */
const DT_LETTERS: Record<string, [number, number, number]> = { D: [108, 112, 116], C: [116, 120, 124], L: [124, 126, 130], E: [128, 132, 134], I: [133, 136, 139], N: [137, 139, 142], A: [140, 143, 145] };
/** What its code draws at a frame for her name, her shots of one shape, her sky (a dome, its top at 400 px of its window). */
const detouragesDrawn = async (frame: number, options: { n?: number; aspect?: number; end?: boolean; read?: Parameters<typeof drawCutOuts>[3]; settings?: Record<string, string>; name?: string } = {}) => {
  const { detourages } = await import("./skills/detourages.ts");
  const name = options.name ?? "ICELAND";
  const line = detourages.timeline(options.n ?? 23, { end: Boolean(options.end), words: { titre: name } });
  const durationInFrames = Math.round(line.duration * 30);
  const drop = Math.round(line.shots[1]!.start * 30);
  const tree = drawCutOuts(
    detourages.code,
    frame,
    {
      width: 1080,
      height: 1920,
      durationInFrames,
      brand: { name, displayFont: "Montserrat", bodyFont: "Montserrat" },
      shots: pileShots(line, options.aspect ?? 16 / 9),
      reelTexts: [{ text: name, role: "hook", from: line.marks.name, to: drop, emphasis: [] }],
      end: options.end ? { title: "Ouvert dimanche", subtitle: "de 9 h à 18 h", from: durationInFrames - 48 } : null,
      texts: { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...(options.settings ?? {}) },
    },
    options.read ?? DT_READ,
  );
  return { line, tree, nodes: drawnNodes(tree), drop };
};
const DT_READ = { skyline: (shot: number | undefined, span: { from?: number; to?: number }) => (shot === 0 ? 400 + Math.abs(((span.from ?? 0) + (span.to ?? 1080)) / 2 - 540) * 0.25 : null) };

test("« Ton nom qui clignote » (v2) cuts where its original does, on its own music (140 BPM): its burst on the dotted rhythm, its sweeps, its intro and its bass", async () => {
  const { detourages, burstCuts } = await import("./skills/detourages.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(detourages.version, 2);
  assert.equal(detourages.bpm, 140);
  const line = detourages.timeline(23, { end: false });
  // Its 23 shots, each cut within two images of the original's (here within one: its cuts measured, just after the
  // song's hits), its length the original's.
  assert.equal(line.shots.length, DT_CUTS.length);
  line.shots.forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - DT_CUTS[i]!) <= 1, `shot ${i + 1}: image ${Math.round(s.start * 30)}, the original's ${DT_CUTS[i]}`));
  assert.ok(Math.abs(Math.round(line.duration * 30) - DT_END) <= 1, `${line.duration} s`);
  // Its burst on the dotted rhythm: twelve of about ¾ of a beat, six of about one, three of one and a half or more.
  const beat = 60 / 140;
  const lengths = line.shots.slice(1, 22).map((s) => (s.end - s.start) / beat);
  assert.deepEqual([lengths.filter((b) => b < 0.95).length, lengths.filter((b) => b >= 0.95 && b < 1.4).length, lengths.filter((b) => b >= 1.4).length], [12, 6, 3]);
  // Its two sweeps, its 10th and 18th shots of the burst (10 images each).
  assert.deepEqual([line.marks.file_a, line.marks.file_b], [10, 18]);
  for (const k of [10, 18]) assert.equal(Math.round((line.shots[k]!.end - line.shots[k]!.start) * 30), 10);
  // Its window opens from its second image to its 125th, her name's first flash on image 108, gone with the drop.
  assert.deepEqual([line.marks.slit_from, line.marks.slit_to, line.marks.name], [1, 125, 108]);
  assert.deepEqual(line.texts.titre, { from: 3.6, to: line.shots[1]!.start });
  // Its letters on the original's images (ICELAND: D, C, L, E, I, N, A), a soft high tick on each flash and when the
  // whole name is lit (the original's little high hits under them, 3,6 to 4,8 s).
  [..."ICELAND"].forEach((c, k) => assert.deepEqual([line.marks[`fl${k}`], line.marks[`dk${k}`], line.marks[`on${k}`]], DT_LETTERS[c], c));
  assert.deepEqual(line.sounds, [{ at: 3.6, sound: "soft high glass tick", seconds: 0.5, gain: -4, burst: { times: [0, 0.267, 0.533, 0.667, 0.833, 0.967, 1.067, 1.233] } }]);
  // Its music: the highs opening over its first 3 s, softer to the drop, where its first strong beat lands; the bass
  // falling away under its last shot (the original's 15,0 s) and back on 16,1 s; cut dead at the end (the loop).
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const last = line.shots[22]!.start;
  assert.deepEqual(line.music, {
    downbeat: line.shots[1]!.start,
    filters: [
      { kind: "muffled", from: 0, to: 3, open: 3 },
      { kind: "soft", from: 3, to: line.shots[1]!.start, db: -5, open: 0.02 },
      { kind: "thin", from: r3(last + 0.4 * beat), to: r3(last + 2.9 * beat), open: 0.02 },
    ],
    end: { at: line.duration },
  });
  assert.ok(Math.abs(line.music!.filters![2]!.from - 15.0) < 0.05 && Math.abs(line.music!.filters![2]!.to - 16.1) < 0.05);
  // Fewer shots: whole bars of its burst left out from its middle (its drop and its last bar kept, with its last
  // sweep), each cut still one of the original's (relative to its bar), its last shot the same; more: bars added.
  for (const n of [11, 12, 15, 16, 18, 19, 20, 22]) {
    const fewer = detourages.timeline(n, { end: false });
    assert.equal(fewer.shots.length, n);
    const bars = burstCuts(n - 2).cuts;
    assert.deepEqual(bars.slice(0, 5).map((c) => c.at), [0, 0.9, 1.45, 2.3, 3.05]);
    assert.deepEqual(bars.slice(-4).map((c) => c.of), [17, 18, 19, 20], `${n}`);
    assert.ok(bars.slice(-4)[0]!.file && fewer.marks.file_a! > 0);
    assert.ok(Math.abs(fewer.shots.at(-1)!.end - fewer.shots.at(-1)!.start - 3.8 * beat) < 0.04);
  }
  assert.ok(Math.abs(detourages.timeline(11, { end: false }).duration - 11.3) < 0.05);
  const longest = detourages.timeline(31, { end: false });
  assert.ok(longest.shots.length === 31 && longest.duration < 21, `${longest.duration} s`);
  // With an ending card, its last shot two beats longer, its cuts the same; at another tempo every length follows it.
  const ended = detourages.timeline(23, { end: true });
  assert.deepEqual(ended.shots.slice(0, -1), line.shots.slice(0, -1));
  assert.ok(Math.abs(ended.duration - line.duration - 2 * beat) < 0.04);
  const slower = detourages.timeline(23, { end: false, bpm: 112, words: { titre: "ICELAND" } });
  assert.ok(Math.abs(slower.duration / line.duration - 1.25) < 0.01 && Math.abs(slower.marks.on4! / line.marks.on4! - 1.25) < 0.02);
  // On the plan: valid, its sounds and its music's shape, its version.
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const plan = skillPlan({ skill: detourages, name: "Ton nom qui clignote", files, fill: { shots: Array.from({ length: 23 }, (_, i) => ({ file: files[i % 12]!.id, at: i < 12 ? 1 : 6 })), texts: { titre: "Udvar" }, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.sounds?.length, 1);
  assert.equal(plan.sounds![0]!.burst!.times.length, 6);
  assert.equal(plan.music_shape?.downbeat, line.shots[1]!.start);
  assert.deepEqual(plan.skill, { key: "detourages", version: 2 });
});

test("« Ton nom qui clignote » (v2): its window opens as a slit at a constant speed, her name lights letter by letter as the original's, behind her scenery", async () => {
  // Black on its first image; then a slit at the middle, the whole height, widening at a constant speed to the whole
  // width, its ends round while it is narrow, then the picture in its rounded rectangle (a 3 % radius, its fine edge).
  const clipOf = async (f: number, options: Parameters<typeof detouragesDrawn>[1] = {}) => String(styleOf((await detouragesDrawn(f, options)).nodes.find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!).clipPath);
  assert.equal((await detouragesDrawn(0)).nodes.some((n) => n.type === "Footage"), false);
  const sides = [];
  for (let f = 1; f <= 124; f++) sides.push(Number(/inset\(0 (\d+)px/.exec(await clipOf(f))![1]));
  const widths = sides.map((s) => 1080 - 2 * s);
  assert.ok(widths[0]! <= 12 && widths.at(-1)! >= 1060, `${widths[0]} … ${widths.at(-1)}`);
  const steps = widths.slice(1).map((w, i) => w - widths[i]!);
  assert.ok(Math.max(...steps) - Math.min(...steps) <= 2, steps.join(" "));
  const pill = /inset\(0 (\d+)px round (\d+)px\)/.exec(await clipOf(2))!;
  assert.ok(Math.abs(Number(pill[2]) - (1080 - 2 * Number(pill[1])) / 2) <= 1, pill[0]);
  assert.equal(await clipOf(200), "inset(0 3px round 32px)");
  // Her name, from its first flash: each letter flashes at 60 %, goes dark (a ghost of 6 %), then lights for good, on
  // the original's images, out of order (D, C, L, E, I, N, A of ICELAND); every letter in the page all along.
  const states = async (f: number) => {
    const { nodes } = await detouragesDrawn(f);
    return Object.fromEntries(nodes.filter((n) => n.type === "span" && typeof styleOf(n).opacity === "number").map((n) => [drawnText(n), styleOf(n).opacity]));
  };
  for (const [c, [flash, dark, on]] of Object.entries(DT_LETTERS)) {
    assert.deepEqual([(await states(flash - 1))[c] ?? 0, (await states(flash))[c], (await states(dark))[c], (await states(on - 1))[c], (await states(on))[c]], [0, 0.6, 0.06, 0.06, 1], c);
  }
  assert.deepEqual(Object.keys(await states(108)).sort(), [..."ACDEILN"]);
  // Very bold wide capitals across 87,6 % of its window when its foot is above the Reel's middle, within the apps'
  // margins below it; as tall as the original's (16,8 % of the window): its font in the name's display face, white.
  const nameBox = async (options: Parameters<typeof detouragesDrawn>[1] = {}) => {
    const { nodes } = await detouragesDrawn(150, options);
    const fit = nodes.find((n) => n.type === "FitText")!;
    return { box: fit.props.style as { left: number; top: number; width: number; height: number }, inner: fit.props.innerStyle as Record<string, unknown>, nodes };
  };
  const { box, inner, nodes } = await nameBox();
  assert.equal(inner.fontWeight, 800);
  assert.equal(inner.color, "#ffffff");
  assert.equal(inner.fontSize, Math.round(Math.round(915 * 0.168) / 0.7));
  // In her sky, behind everything else (Skyline laid over it), its foot so that about an eighth of the word is hidden.
  assert.ok(nodes.findIndex((n) => n.type === "Skyline") > nodes.findIndex((n) => n.type === "FitText"));
  const foot = box.top + box.height - Math.round(0.2 * 154);
  const tops = Array.from({ length: 8 }, (_, k) => DT_READ.skyline(0, { from: 67 + (k * 946) / 8, to: 67 + ((k + 1) * 946) / 8 })!);
  const hidden = tops.reduce((a, y) => a + Math.max(0, Math.min(154, foot - y)), 0) / (8 * 154);
  assert.ok(hidden > 0.09 && hidden < 0.16, `${hidden}`);
  assert.deepEqual([box.left, box.width], 503 + foot > 960 ? [140, 800] : [67, 946]);
  // A high skyline (her buildings fill the frame), or a narrow sky (trees and a front up to the top of the frame on
  // both sides: whole letters hidden): not behind her sky; behind her cut-out when she has one, else in front.
  const high = await nameBox({ read: { skyline: (shot) => (shot === 0 ? 40 : null) } });
  assert.equal(high.nodes.some((n) => n.type === "Skyline"), false);
  const narrow = { skyline: (shot: number | undefined, span: { from?: number; to?: number }) => (shot !== 0 ? null : (span.from ?? 0) < 320 || (span.from ?? 0) > 700 ? 0 : 300) };
  assert.equal((await nameBox({ read: narrow })).nodes.some((n) => n.type === "Skyline"), false);
  const highHer = await nameBox({ read: { ...narrow, boxes: { "0": { x: 450, y: 300, w: 180, h: 500 } } } });
  assert.ok(highHer.nodes.some((n) => n.type === "Subject" && n.props.shot === 0) && !highHer.nodes.some((n) => n.type === "Skyline"));
  // Without a sky, behind what stands before her wall (her cut-out), its foot just under its top; else in front.
  const her = await nameBox({ read: { boxes: { "0": { x: 450, y: 300, w: 180, h: 500 } } } });
  assert.ok(her.nodes.some((n) => n.type === "Subject" && n.props.shot === 0) && !her.nodes.some((n) => n.type === "Skyline"));
  assert.equal(her.box.top + her.box.height, Math.round(300 + 0.3 * 154 + 0.2 * 154));
  assert.deepEqual([her.box.left, her.box.width], [67, 946]);
  const plain = await nameBox({ read: {} });
  assert.ok(!plain.nodes.some((n) => n.type === "Subject" || n.type === "Skyline"));
  // A soft shade under it only on a bright sky.
  assert.equal(inner.textShadow, "none");
  assert.match(String((await nameBox({ read: { ...DT_READ, light: { mean: 0.8, high: 0.9 } } })).inner.textShadow), /rgba\(0,0,0,0\.32\)/);
  // A longer name, its spaces kept: smaller in the same box, each letter on its own image.
  const long = await detouragesDrawn(150, { name: "Párisi Udvar" });
  assert.equal(long.nodes.filter((n) => n.type === "span" && typeof styleOf(n).opacity === "number").length, 11);
  // Gone with the drop, as the original (no fade).
  const { drop } = await detouragesDrawn(0);
  assert.ok((await detouragesDrawn(drop - 1)).nodes.some((n) => n.type === "FitText"));
  assert.equal((await detouragesDrawn(drop)).nodes.some((n) => n.type === "FitText" || n.type === "Skyline"), false);
});

test("« Ton nom qui clignote » (v2): its rounded window on black when her videos are horizontal, full frame otherwise or on her word; its sweeps; light to render", async () => {
  const { detourages } = await import("./skills/detourages.ts");
  const { skillPlan, skillFillInput, skillSettings } = await import("./skills.ts");
  const { readsDrawn, subjectsDrawn } = await import("./subject.ts");
  const frameOf = (nodes: Drawn[]) => {
    const box = nodes.find((n) => n.type === "div" && styleOf(n).overflow === "hidden" && styleOf(n).backgroundColor === "#000000")!;
    return { top: styleOf(box).top, height: styleOf(box).height };
  };
  // Her videos horizontal (or square): the original's window, 1,18:1, at the middle of the frame on black; upright: the
  // whole frame, its corners rounded and its slit kept; her setting either way.
  assert.deepEqual(frameOf((await detouragesDrawn(300)).nodes), { top: 503, height: 915 });
  assert.deepEqual(frameOf((await detouragesDrawn(300, { aspect: 1 })).nodes), { top: 503, height: 915 });
  assert.deepEqual(frameOf((await detouragesDrawn(300, { aspect: 9 / 16 })).nodes), { top: 0, height: 1920 });
  assert.equal(frameOf((await detouragesDrawn(300, { settings: { format: "vertical" } })).nodes).height, 1920);
  assert.equal(frameOf((await detouragesDrawn(300, { aspect: 9 / 16, settings: { format: "fenetre" } })).nodes).top, 503);
  assert.match(String(styleOf((await detouragesDrawn(300, { aspect: 9 / 16 })).nodes.find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!).clipPath), /^inset\(0 0px round 32px\)$/);
  assert.deepEqual(detourages.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "fenetre", "vertical"]]]);
  assert.deepEqual(skillSettings(detourages, [{ name: "format", value: "auto" }, { name: "format", value: "vertical" }]), { format: "vertical" });
  // Its two sweeps streaked along their way and sliding (a vertical one, then a sideways one), its other shots as filmed.
  const { line } = await detouragesDrawn(0);
  const streak = async (f: number) => {
    const blur = (await detouragesDrawn(f)).nodes.find((n) => n.type === "feGaussianBlur");
    return blur ? String(blur.props.stdDeviation) : null;
  };
  const sweep = (k: number) => Math.round(line.shots[k]!.start * 30);
  assert.deepEqual(await Promise.all([sweep(10) - 1, sweep(10), sweep(10) + 9, sweep(10) + 10].map(streak)), [null, "0 42", "0 42", null]);
  assert.equal(await streak(sweep(18) + 3), "42 0");
  // Light to render: one of her pictures at a time, and her sky's ground only while her name is on (never on the slit
  // before it nor on the burst); her opening shot the only one it cuts out or reads, exactly what its code draws.
  let most = 0;
  for (let f = 0; f < Math.round(line.duration * 30); f++) {
    const { nodes } = await detouragesDrawn(f);
    const pictures = nodes.filter((n) => ["Footage", "Skyline", "Subject"].includes(n.type as string));
    most = Math.max(most, pictures.length);
    if (pictures.some((n) => n.type === "Skyline")) assert.ok(f >= line.marks.name! && f < sweep(1), `Skyline at ${f}`);
  }
  assert.ok(most <= 2, `${most} pictures at once`);
  for (const n of [11, 16, 23, 31]) {
    for (const end of [false, true]) {
      const l = detourages.timeline(n, { end, words: { titre: "Udvar" } });
      const durationInFrames = Math.round(l.duration * 30);
      const props = { width: 1080, height: 1920, durationInFrames, brand: { name: "Udvar", displayFont: "Montserrat", bodyFont: "Montserrat" }, shots: pileShots(l, 16 / 9), reelTexts: [{ text: "Udvar", role: "hook", from: l.marks.name, to: Math.round(l.shots[1]!.start * 30), emphasis: [] }], end: end ? { title: "Ouvert dimanche", subtitle: null, from: durationInFrames - 48 } : null, texts: Object.fromEntries(Object.entries(l.marks).map(([k, v]) => [k, String(v)])) };
      const drawn = await cutoutsDrawn(detourages.code, props, Array.from({ length: durationInFrames }, (_, f) => f));
      assert.deepEqual([...drawn].sort((a, b) => a - b), l.cutouts, `${n} shots${end ? ", an ending card" : ""}`);
    }
  }
  assert.deepEqual(subjectsDrawn(detourages.code), [0]);
  assert.deepEqual(readsDrawn(detourages.code), [{ shot: 0, kinds: ["ground", "light", "sky"] }]);
  // Its grade is its finish without what would grey the black around its window; her real whips read for its sweeps.
  assert.deepEqual(detourages.finish, { fade: 0, grain: 0, vignette: 0 });
  assert.deepEqual(detourages.reads, ["moves"]);
  assert.deepEqual(detourages.fonts, ["Montserrat"]);
  assert.doesNotMatch(detourages.code, /ICELAND|Permanent Marker|Cutout/);
  // The filler sees its sweeps where they are kept, its name's slot; its ending card over its last shot.
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const input = skillFillInput({ skill: detourages, name: "Ton nom qui clignote", n: 23, files, business: {}, request: "" });
  assert.match(input.cases[0]!.veut, /large et fixe/);
  assert.match(input.cases[10]!.veut, /balayage très rapide/);
  assert.match(input.cases[18]!.veut, /balayage très rapide de côté/);
  assert.ok(input.cases.filter((c) => /balayage/.test(c.veut)).length === 2);
  assert.match(input.cases[22]!.veut, /de dos/);
  assert.deepEqual(input.textes.map((t) => [t.slot, "max_caracteres" in t ? t.max_caracteres : null, t.obligatoire]), [["titre", 12, true]]);
  const fewer = skillFillInput({ skill: detourages, name: "Ton nom qui clignote", n: 16, files, business: {}, request: "" });
  assert.ok(fewer.cases.filter((c) => /balayage/.test(c.veut)).length === 1);
  const ended = await detouragesDrawn(Math.round(detourages.timeline(23, { end: true }).duration * 30) - 40, { end: true });
  assert.ok(heldText(ended.tree).includes("Ouvert dimanche") && heldText(ended.tree).includes("de 9 h à 18 h"));
  const plan = skillPlan({ skill: detourages, name: "Ton nom qui clignote", files, fill: { shots: Array.from({ length: 23 }, (_, i) => ({ file: files[i % 8]!.id, at: Math.floor(i / 8) * 4 })), texts: { titre: "Udvar" }, end: null } });
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 23, subjects: [0] });
});

// ——— « Présente-toi » v2 and « Vision machine » v1, written on their originals' fiches (docs/fiches/silhouette.md, vision.md) ———

type KitRead = { boxes?: Record<string, TdBox>; outlines?: Record<string, string>; parts?: Record<string, TdBox[]>; heads?: { from: number; to: number; what: string }[]; light?: { mean: number; high: number } };
/**
 * What a skill's Scene draws at a frame with the whole kit in its scope, each piece a named node (as cutoutsDrawn lays
 * them), what the engine reads on her shots given by shot and object as drawCutOuts takes them (« 0 » her cut-out,
 * « 1#every person »), her head's moves (HeadMoves), the other readings at their fallback, as in the scene check.
 */
async function drawKit(code: string, frame: number, props: Record<string, unknown>, read: KitRead = {}): Promise<Drawn> {
  const { MOTION_SCOPE } = await import("./motion-scene.ts");
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const key = (shot: { segment?: number } | undefined, object?: string) => `${shot?.segment ?? "?"}${object ? `#${object}` : ""}`;
  const ease = (f: (t: number) => number) => f;
  const fallback = (_s: unknown, _f: number, _l: unknown, o?: { fallback?: unknown }) => o?.fallback ?? null;
  const scope: Record<string, unknown> = Object.fromEntries(MOTION_SCOPE.filter((n) => n !== "React").map((n) => [n, n]));
  Object.assign(scope, {
    useCurrentFrame: () => frame,
    useVideoConfig: () => ({ width: 1080, height: 1920, fps: 30, durationInFrames: props.durationInFrames }),
    interpolate: (x: number, [a, b]: [number, number], [y0, y1]: [number, number], o?: { easing?: (t: number) => number }) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1)));
      return y0 + (y1 - y0) * (o?.easing ? o.easing(t) : t);
    },
    Easing: { in: ease, out: ease, inOut: ease, quad: (t: number) => t * t, cubic: (t: number) => t * t * t },
    // Remotion's seeded random: the same number for the same seed.
    random: (seed: string) => [...seed].reduce((x, c) => Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) / 4294967296,
    SubjectBox: (shot: { segment?: number }, _f: number, _l: unknown, object?: string) => read.boxes?.[key(shot, object)] ?? null,
    SubjectOutline: (shot: { segment?: number }, _f: number, _l: unknown, object?: string) => read.outlines?.[key(shot, object)] ?? null,
    SubjectParts: (shot: { segment?: number }, _f: number, _l: unknown, object?: string) => read.parts?.[key(shot, object)] ?? [],
    HeadMoves: () => read.heads ?? [],
    LightUnder: () => read.light ?? null,
    ClearBox: fallback,
    VanishingPoint: fallback,
  });
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
/** The words held right under a node and in all it holds, without the spaces heldText puts between its pieces. */
const textIn = (node: Drawn | undefined) => (node ? drawnNodes(node).map(drawnText).join("") : "");
/** A node of a drawn tree by its key. */
const byKey = (tree: Drawn, key: string) => drawnNodes(tree).find((n) => n.props.key === key);

const SIL_WORDS = { bonjour: "Hello", nom: "Héloïse Marchand", choses: "bouquets, mariages, deuil, plantes", je: "Je suis", ton: "Votre", metier: "Fleuriste" };
/** « Présente-toi » as its composition gets it at a frame, from its plan on her one video: its two shots, her texts, its marks. */
async function silhouetteAt(frame: number, read: KitRead = {}, options: { settings?: Record<string, string>; end?: boolean; brand?: Record<string, string> } = {}) {
  const { silhouette } = await import("./skills/silhouette.ts");
  const { skillPlan } = await import("./skills.ts");
  const end = options.end ? { title: "Ouvert dimanche", subtitle: "de 10 h à 18 h" } : null;
  const plan = skillPlan({ skill: silhouette, name: "Présente-toi", files: [{ id: "v0", photo: false, seconds: 12 }], fill: { shots: [{ file: "v0", at: 1 }, { file: "v0", at: 6 }], texts: SIL_WORDS, end, ...(options.settings ? { settings: options.settings } : {}) } });
  const durationInFrames = Math.round(plan.duration * 30);
  const reelTexts = plan.texts.map((t) => ({ text: t.text, role: t.style, from: Math.round(t.from * 30), to: Math.round(t.to * 30), emphasis: [] }));
  const props = {
    width: 1080,
    height: 1920,
    durationInFrames,
    brand: { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight", ...options.brand },
    shots: decodeShots(silhouette.timeline(2, { end: Boolean(end) }), () => 16 / 9),
    reelTexts,
    end: end ? { ...end, from: durationInFrames - 48 } : null,
    texts: plan.layers![0]!.motion.texts!,
  };
  return { tree: await drawKit(silhouette.code, frame, props, read), props };
}
/** Her profile cut out (its box and outline, the top of her head at 700 px), as the engine reads it on her first shot. */
const SIL_READ: KitRead = { boxes: { "0": { x: 300, y: 700, w: 560, h: 1220 } }, outlines: { "0": "M 470 700 C 560 690 640 720 660 800 C 700 820 760 900 860 1000 L 860 1920 L 300 1920 C 300 1500 330 1200 380 1000 C 400 900 410 760 470 700 Z" } };

test("« Présente-toi » (v2) changes where its original does, on its own music (84,5 BPM), with its clicks, its break and its last hit", async () => {
  const { silhouette, letterFrames } = await import("./skills/silhouette.ts");
  const { skillPlan } = await import("./skills.ts");
  assert.equal(silhouette.version, 3);
  assert.equal(silhouette.bpm, 84.5);
  assert.deepEqual([silhouette.shots, silhouette.files], [[2, 2], [1, 4]]);
  const line = silhouette.timeline(2, { end: false, words: { bonjour: "Hello" } });
  // The original's five changes (its images at 30 i/s: the negative, the cut on him, the lids on the drop, the eye open
  // onto the pale, the cut on the logo), each within two images, on its beats from its first bar (1,5 beats in).
  const original = [14, 32, 117, 161, 287];
  const ours = [line.marks.negative!, line.marks.cut!, line.marks.eye!, line.marks.open! + 1, line.marks.logo!];
  ours.forEach((f, i) => assert.ok(Math.abs(f - original[i]!) <= 2, `change ${i + 1}: image ${f}, the original's ${original[i]}`));
  assert.ok(Math.abs(line.duration - 11.07) < 0.02, `${line.duration} s`);
  // Its two shots: her profile, played from the cut on her to the lids (its first 1,5 beats under the opening), then a
  // shot never seen under the eye, her trades and her logo; her cut-out made on her profile only.
  assert.deepEqual(line.shots.map((s) => [s.start, s.end]), [[0, 3.9], [3.9, 11.07]]);
  assert.deepEqual(line.cutouts, [0]);
  assert.deepEqual(silhouette.reads, ["gestures"]);
  // A key click on each letter of her first word as its code types it (« Hello »: the original's 0,16 · 0,60 · 0,71 ·
  // 0,83 · 0,97 s, within an image), a click as the letters of « Votre » pop (2,93 s), a breath rising into the drop.
  const keys = line.sounds!.filter((s) => s.sound === "keyboard key click").map((s) => s.at * 30);
  [4.8, 18, 21.3, 24.9, 29.1, 87.9].forEach((f, i) => assert.ok(Math.abs(keys[i]! - f) <= 1, `click ${i + 1}: image ${keys[i]}, the original's ${f}`));
  assert.equal(keys.length, 6);
  assert.deepEqual(letterFrames(7, 5, 18, 29), [5, 18, 20, 22, 25, 27, 29]);
  assert.deepEqual(line.sounds!.at(-1), { at: 3.9, sound: "short rising whoosh", seconds: 0.5, gain: -4 });
  assert.equal(silhouette.timeline(2, { end: false }).sounds!.length, 2);
  // Its music's first strong beat on its first bar; on beat 3 of that bar it breaks (its last hit ringing) until the drop
  // on the lids, a little softer before; it stops on its last hit (her logo's cut) and rings 1,4 s, as the original's.
  assert.deepEqual(line.music, { downbeat: 1.067, pauses: [{ from: 3.2, to: 3.9, tail: 0.6 }], filters: [{ kind: "soft", from: 0, to: 3.2, db: -2 }], end: { at: 9.7, tail: 1.4 } });
  // Her texts at their moments: her first word in the opening, « Je suis » in her head, her name from its typing to her
  // logo, « Votre » as its letters pop, her trade from the iris, what she does on its hits.
  assert.deepEqual(Object.fromEntries(Object.entries(line.texts).map(([k, t]) => [k, [Math.round(t.from * 30), Math.round(t.to * 30)]])), {
    bonjour: [5, 32],
    je: [32, 50],
    nom: [50, 288],
    ton: [88, 117],
    metier: [146, 234],
    choses: [165, 234],
  });
  // With an ending card: after her logo, the card's 1,6 s at least, the music faded under it; at another tempo, all of it
  // follows its beats.
  const ended = silhouette.timeline(2, { end: true });
  assert.ok(ended.duration * 30 - ended.marks.logo_out! >= 48, `${ended.duration} s`);
  assert.deepEqual(ended.music!.end, { at: ended.duration, fade: 0.6 });
  const slower = silhouette.timeline(2, { end: false, bpm: 70 });
  assert.ok(Math.abs(slower.marks.eye! - 117 * (84.5 / 70)) <= 1 && Math.abs(slower.duration - line.duration * (84.5 / 70)) < 0.05);
  // On the plan, with or without its card: valid, her words in its six slots, her cut-out on her profile only.
  for (const end of [false, true]) {
    const files = [{ id: "v0", photo: false, seconds: 12 }];
    const plan = skillPlan({ skill: silhouette, name: "Présente-toi", files, fill: { shots: [{ file: "v0", at: 1 }, { file: "v0", at: 6 }], texts: SIL_WORDS, end: end ? { title: "Ouvert dimanche" } : null } });
    assert.ok(editPlanSchema.safeParse(plan).success);
    assert.equal(plan.texts.length, 6);
    assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 2, subjects: [0] });
    assert.deepEqual(plan.skill, { key: "silhouette", version: 3 });
    assert.equal(plan.sounds?.length, 7);
  }
});

test("« Présente-toi » (v2): its layout program, her silhouette with « Je suis » in it, her name behind her, the eye, her trades, her logo", async () => {
  const at = async (f: number, read = SIL_READ, options = {}) => (await silhouetteAt(f, read, options)).tree;
  const bg = (tree: Drawn) => styleOf(tree).backgroundColor;
  // Midnight blue, her first letter alone, white; the whole picture negative on image 14 (the pale, the ink); her word
  // typed whole by image 29 with its peach echo while it grows; its guides and px counts a decor; a pixel hand from 17.
  const five = await at(5);
  assert.equal(bg(five), "#0d0d1b");
  assert.equal(textIn(byKey(five, "word")), "H");
  assert.equal(bg(await at(14)), "#f3f4f9");
  const echo = byKey(await at(29), "word")!;
  assert.equal(echo.type, "Echo");
  assert.equal(echo.props.color, "#d99868");
  const typed = (echo.props.draw as (f: number) => Drawn)(29);
  assert.equal(textIn(typed), "Hello");
  assert.equal(styleOf(drawnNodes(typed)[0]!).color, "#0a0a10");
  assert.ok(drawnNodes(byKey(five, "guides")!).some((n) => "data-fauve-decor" in n.props));
  const hand = byKey(await at(20), "hand")!;
  assert.deepEqual([hand.type, hand.props.at, hand.props.frames, hand.props.build], ["DotGrid", 17, 4, "rise"]);
  assert.match(String(hand.props.shape), /^M\d/);
  assert.equal(byKey(await at(32), "hand"), undefined);
  // Her profile from the cut: her cut-out filled with one midnight tone, played from the cut, on the pale; « Je suis » in
  // white in her head, kept inside her outline; no cut-out: her shot as a hard black and white print on the pale.
  const sil = await at(40);
  const her = drawnNodes(sil).find((n) => n.type === "Subject")!;
  assert.deepEqual([her.props.shot, her.props.at, her.props.fill], [0, 32, "#0f0f1c"]);
  assert.ok(!drawnNodes(sil).some((n) => n.type === "Footage"));
  // Her picture laid whole, in its own shape (a horizontal video is not cropped round her head), down to the frame's bottom.
  const laidHer = styleOf(her);
  assert.ok(Math.abs(Number(laidHer.width) / Number(laidHer.height) - 16 / 9) < 0.01, `${laidHer.width} × ${laidHer.height}`);
  assert.ok(Number(laidHer.top) + Number(laidHer.height) >= 1920);
  const im = byKey(sil, "im")!;
  assert.equal(textIn(im), "Je suis");
  assert.match(String(styleOf(im).clipPath), /^path\('M 470 700/);
  // Her outline in pieces where her picture cuts her (the kit leaves it open there): joined into one shape for the clip.
  const open = { ...SIL_READ, outlines: { "0": "M 300 1910 C 300 1500 330 1200 380 1000 C 400 900 410 760 470 700 C 560 690 640 720 660 800 M 700 820 C 760 900 860 1000 860 1910" } };
  assert.match(String(styleOf(byKey(await at(40, open), "im")!).clipPath), /^path\('M 300 1910 C .* L 700 820 C [^M]* Z'\)$/);
  assert.ok(drawnNodes(im).some((n) => styleOf(n).color === "#ffffff"));
  const bare = await at(40, {});
  assert.match(String(styleOf(drawnNodes(bare).find((n) => n.type === "Footage")!).filter), /grayscale\(1\)/);
  // Its first letter peach, the rest gone from its end as she lowers her head (on the beat here: nothing measured).
  const peach = drawnNodes(byKey(await at(47), "im")!).filter((n) => n.type === "span");
  assert.deepEqual([styleOf(peach[0]!).color, styleOf(peach[6]!).opacity], ["#d99868", 0]);
  // Her name typed behind her head (painted before her), 40 letters a second, a peach cursor; its last name rising away.
  const typing = await at(57);
  const name = byKey(typing, "name")!;
  assert.match(textIn(name), /^Héloïse Ma/);
  const order = (tree: Drawn) => (tree.children as unknown[]).flat().filter(Boolean).map((c) => String((c as Drawn).props.key));
  assert.ok(order(typing).indexOf("name") < order(typing).indexOf("her"));
  const leaving = drawnNodes(byKey(await at(75), "name")!).find((n) => textIn(n) === " Marchand")!;
  assert.ok(Number(styleOf(leaving).opacity) < 1 && /translateY\(-/.test(String(styleOf(leaving).transform)));
  // « Votre » in front of her, its round letter higher; it fills with peach, a pupil grows: an eye.
  assert.equal(textIn(byKey(await at(92), "ton")), "Votre");
  assert.ok(drawnNodes(byKey(await at(104), "seye")!).filter((n) => n.type === "circle").length === 2);
  // On the drop: lids closing into an almond on the midnight blue (a window that opens as an eye, moved four times, to
  // a box past the whole frame when it opens onto the pale); her trade white only inside the iris.
  const eye = byKey(await at(117), "eye")!;
  assert.deepEqual([eye.type, eye.props.reveal, eye.props.at, eye.props.open, (eye.props.moves as unknown[]).length], ["Window", "eye", 117, 0, 4]);
  assert.equal(bg(await at(117)), "#0d0d1b");
  const iris = drawnNodes(byKey(await at(150), "eye")!).find((n) => /^circle\(/.test(String(styleOf(n).clipPath)));
  assert.ok(iris && textIn(iris) === "Fleuriste");
  // Her trade held, what she does on the hits (faster, then settling), the peach dot then her trade's pictogram.
  const jobs = async (f: number) => textIn(byKey(await at(f), "jobs"));
  assert.deepEqual(await Promise.all([165, 181, 197, 213, 230].map(jobs)), ["Fleuristebouquets", "Fleuristemariages", "Fleuristedeuil", "Fleuristeplantes", "Fleuristeplantes"]);
  assert.equal(drawnNodes(byKey(await at(190), "jobs")!).find((n) => n.type === "Picto")?.props.name, "Fleuriste");
  // Her name alone, receding; on the last bar, the blue and her place's name in white capitals (or her logo, whitened).
  assert.equal(textIn(byKey(await at(240), "alone")), "Héloïse Marchand");
  const last = await at(290);
  assert.equal(bg(last), "#0d0d1b");
  assert.equal(textIn(byKey(last, "logo")), "ATELIER ROSE");
  assert.equal(byKey(await at(290, SIL_READ, { brand: { logoUrl: "/logo.png" } }), "logo")?.type, "Img");
  assert.equal(textIn(byKey(await at(345, SIL_READ, { end: true }), "end")), "Ouvert dimanchede 10 h à 18 h");
});

test("« Présente-toi » (v2): vertical by default, the original's 16:9 frame on her word; light to render; timed on her head when it is measured", async () => {
  const { silhouette } = await import("./skills/silhouette.ts");
  const { skillSettings } = await import("./skills.ts");
  // Vertical full frame by default (drawn on its two flat colours, whatever her videos); on her word, the original's
  // 16:9 frame in the middle on midnight bands, the pale scenes a band, the dark ones the whole frame.
  assert.deepEqual(silhouette.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  assert.deepEqual(skillSettings(silhouette, [{ name: "format", value: "horizontal" }]), { format: "horizontal" });
  const tall = (await silhouetteAt(40, SIL_READ)).tree;
  assert.equal(styleOf(tall).backgroundColor, "#f3f4f9");
  const wide = (await silhouetteAt(40, SIL_READ, { settings: { format: "horizontal" } })).tree;
  assert.equal(styleOf(wide).backgroundColor, "#0d0d1b");
  const band = drawnNodes(wide).find((n) => styleOf(n).background === "#f3f4f9" && styleOf(n).top === 656)!;
  assert.deepEqual([styleOf(band).left, styleOf(band).width, styleOf(band).height], [0, 1080, 608]);
  // Light to render: her shot and her cut-out are drawn only while they are seen (the cut to the lids), and only her
  // profile is cut out; the pieces of each moment mounted only during it.
  const { props } = await silhouetteAt(0, SIL_READ);
  assert.deepEqual([...(await cutoutsDrawn(silhouette.code, props, Array.from({ length: props.durationInFrames }, (_, f) => f)))], [0]);
  const seen: number[] = [];
  for (let f = 0; f < props.durationInFrames; f++) if (drawnNodes((await silhouetteAt(f, SIL_READ)).tree).some((n) => n.type === "Subject" || n.type === "Footage")) seen.push(f);
  assert.deepEqual([seen[0], seen.at(-1), seen.length], [32, 118, 87]);
  // Her head lowered as her tracks measure it (frames of her shot at its own moment): « Je suis » goes as it starts, her
  // name types five images in.
  const heads = { ...SIL_READ, heads: [{ from: 20, to: 28, what: "down" }] };
  const measured = drawnNodes(byKey((await silhouetteAt(52, heads)).tree, "im")!).filter((n) => n.type === "span");
  assert.equal(styleOf(measured[0]!).color, "#d99868");
  assert.equal(byKey((await silhouetteAt(56, heads)).tree, "name"), undefined);
  assert.ok(byKey((await silhouetteAt(57, heads)).tree, "name"));
});

const VIS_NAMED = { sujet: "woman standing at the tram stop", support: "tram shelter" };
/** What is read on her shots: her still subject and her shelter on the anchor, three passers-by on her place. */
const VIS_READ: KitRead = {
  boxes: { "0#woman standing at the tram stop": { x: 420, y: 900, w: 150, h: 420 }, "0#tram shelter": { x: 40, y: 700, w: 330, h: 520 } },
  parts: { "1#every person": [{ x: 700, y: 820, w: 60, h: 160 }, { x: 820, y: 860, w: 50, h: 140 }, { x: 600, y: 1300, w: 160, h: 420 }] },
};
/** « Vision machine » as its composition gets it at a frame, from its plan on her one video, its objects named. */
async function visionAt(frame: number, read: KitRead = VIS_READ, options: { settings?: Record<string, string>; titre?: string } = {}) {
  const { vision } = await import("./skills/vision.ts");
  const { skillPlan, skillCode } = await import("./skills.ts");
  const fill = { shots: [{ file: "v0", at: 0 }, { file: "v0", at: 0.5 }], texts: { etiquette: "LE SALON", ...(options.titre ? { titre: options.titre } : {}) }, end: null, objects: VIS_NAMED, ...(options.settings ? { settings: options.settings } : {}) };
  const plan = skillPlan({ skill: vision, name: "Vision machine", files: [{ id: "v0", photo: false, seconds: 12 }], fill });
  const durationInFrames = Math.round(plan.duration * 30);
  const reelTexts = plan.texts.map((t) => ({ text: t.text, role: t.style, from: Math.round(t.from * 30), to: Math.round(t.to * 30), emphasis: [] }));
  const props = { width: 1080, height: 1920, durationInFrames, brand: { name: "Le Salon", displayFont: "Inter Tight", bodyFont: "Inter Tight" }, shots: decodeShots(vision.timeline(2, { end: false }), () => 9 / 16), reelTexts, end: null, texts: plan.layers![0]!.motion.texts! };
  return { tree: await drawKit(skillCode(vision, VIS_NAMED), frame, props, read), props, plan };
}
/** Her shot's media mounted at a frame (what decodes a video). */
const mediaOf = (tree: Drawn) => drawnNodes(tree).filter((n) => ["Footage", "Subject", "Depth", "Near"].includes(String(n.type)));

test("« Vision machine » (v1) passes where its original does, image by image at its tempo (77,5 BPM, a beat every two beeps), its blacks, its silence", async () => {
  const { vision, PASSES } = await import("./skills/vision.ts");
  const { skillPlan } = await import("./skills.ts");
  const { objectPassages, depthPassages, nearPassages, subjectShots, readsDrawn, OBJECT_MAX_SECONDS } = await import("./subject.ts");
  assert.equal(vision.version, 1);
  assert.equal(vision.bpm, 77.5);
  assert.deepEqual([vision.shots, vision.files], [[2, 2], [1, 3]]);
  const line = vision.timeline(2, { end: false });
  // Every change the measure found in the original (its 19 big ones, images at 30 i/s) within two images of one of its
  // passes, or of the place's jump to half its tiles at once (image 21); its 61 passes from its fiche's list, its eleven
  // blacks before the end and its final one, its 8,5 s.
  const changes = [...PASSES.map((p) => p[0]), 21];
  for (const f of [6, 21, 36, 45, 53, 63, 79, 90, 98, 109, 140, 154, 161, 170, 178, 196, 206, 214, 241]) assert.ok(changes.some((c) => Math.abs(c - f) <= 2), `the original's change at image ${f}`);
  assert.equal(PASSES.length, 61);
  assert.equal(PASSES.filter((p) => p[1] === "k" && p[0] < 246).length, 11);
  assert.deepEqual(PASSES.at(-1), [246, "k"]);
  assert.ok(PASSES.every((p, i) => i === 0 || p[0] > PASSES[i - 1]![0]));
  assert.ok(Math.abs(line.duration - 8.5) < 0.02, `${line.duration} s`);
  // Its two shots of her one video: its first 14 images, where her still subject and what it is on are read, then her place.
  assert.deepEqual(line.shots.map((s) => [s.start, s.end]), [[0, 0.47], [0.47, 8.5]]);
  assert.deepEqual(line.cutouts, []);
  // Its beep stops two images into the final black, cut dead; its first beat at 0,05 s; no other sound.
  assert.deepEqual(line.music, { downbeat: 0.05, end: { at: 8.267 } });
  assert.equal(line.sounds, undefined);
  // Her word on every label to its last characters; her title, in option, until the place is erased.
  assert.deepEqual(line.texts, { etiquette: { from: 0, to: 8.03 }, titre: { from: 0, to: 7.23 } });
  // At another tempo, every image of its passes follows it; with an ending card, black under it for 1,6 s at least.
  const faster = vision.timeline(2, { end: false, bpm: 100 });
  assert.equal(faster.marks.r, 0.775);
  assert.equal(faster.marks.erase, Math.round(217 * 0.775));
  assert.ok(Math.abs(faster.duration - 8.5 * 0.775) < 0.05);
  const ended = vision.timeline(2, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6 && ended.music!.end!.at === ended.duration, `${ended.duration} s`);
  // On the plan: valid; her still subject and what it is on followed on the anchor shot, every person on her place, within
  // the 20 s a Reel's objects take; its depth and its nearness on her place only; nothing of her cut out besides; the
  // vanishing point of her place read for its tiles.
  const { plan } = await visionAt(0);
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.skill, { key: "vision", version: 1 });
  const objects = objectPassages(plan, () => true);
  assert.deepEqual(objects.map((o) => [o.clip_id, o.from, o.to, o.name]), [["v0", 0, 0.47, "tram shelter"], ["v0", 0, 0.47, "woman standing at the tram stop"], ["v0", 0.5, 8.53, "every person"]]);
  assert.ok(objects.reduce((s, o) => s + o.to - o.from, 0) <= OBJECT_MAX_SECONDS);
  assert.deepEqual(depthPassages(plan, () => true).map((p) => [p.from, p.to]), [[0.5, 8.53]]);
  assert.deepEqual(nearPassages(plan, () => true).map((p) => [p.from, p.to]), [[0.5, 8.53]]);
  assert.deepEqual([...subjectShots(plan)], []);
  assert.deepEqual(readsDrawn(plan.layers![0]!.motion.js).map((r) => r.shot), [1]);
  for (const end of [false, true]) {
    const p = skillPlan({ skill: vision, name: "Vision machine", files: [{ id: "v0", photo: false, seconds: 12 }], fill: { shots: [{ file: "v0", at: 0 }, { file: "v0", at: 0.5 }], texts: { etiquette: "LE SALON" }, end: end ? { title: "Ouvert dimanche" } : null } });
    assert.ok(editPlanSchema.safeParse(p).success && p.texts.length === 1 && p.duration <= 45);
  }
});

test("« Vision machine » (v1): its machine looks pass by pass, each at its own moment of her place, its labels dropping letters, its tiles from her still subject", async () => {
  const at = async (f: number, read = VIS_READ, options = {}) => (await visionAt(f, read, options)).tree;
  const kinds = (tree: Drawn) => drawnNodes(tree).map((n) => String(n.type));
  // The man and his bench alone on white in their frames: blue (their cut-outs in two tones of blue), then black with
  // light dots; each frame's tab drops letters of her word at every image (a decor; the word kept whole, unseen).
  const blue = await at(0);
  const tinted = drawnNodes(blue).filter((n) => styleOf(n).filter === "url(#vblue)");
  assert.deepEqual(tinted.map((n) => drawnNodes(n).find((m) => m.type === "Subject")!.props.object), ["woman standing at the tram stop", "tram shelter"]);
  assert.ok(drawnNodes(blue).some((n) => n.type === "feComponentTransfer"));
  const dotted = await at(1);
  assert.ok(drawnNodes(dotted).some((n) => n.type === "Ascii" && n.props.kind === "dots") && drawnNodes(dotted).some((n) => styleOf(n).background === "#07070e"));
  const tags = drawnNodes(blue).find((n) => "data-fauve-decor" in n.props)!;
  const shown = drawnNodes(tags).filter((n) => styleOf(n).fontSize === 17).map(drawnText);
  assert.equal(shown.length, 2);
  assert.ok(shown.every((s) => s.length === "LE SALON".length));
  assert.ok(textIn(tags).includes("LE SALON"));
  const later = drawnNodes(drawnNodes(await at(2)).find((n) => "data-fauve-decor" in n.props)!).filter((n) => styleOf(n).fontSize === 17).map(drawnText);
  assert.notDeepEqual(later, shown);
  // A black is black, nothing of her shot mounted; her still subject alone on white, as filmed.
  assert.deepEqual(mediaOf(await at(3)), []);
  const alone = await at(11);
  assert.deepEqual(mediaOf(alone).map((n) => [n.type, n.props.object]), [["Subject", "tram shelter"], ["Subject", "woman standing at the tram stop"]]);
  // Her place built tile by tile round her (half of it at once on image 21, the others fading in from white), its back's
  // openings left white; its tiles in the perspective of her floor, the nearest to her first.
  const tilesAt = async (f: number) => (String(styleOf(drawnNodes(await at(f)).find((n) => /^path\('M/.test(String(styleOf(n).clipPath)))!).clipPath).match(/M/g) ?? []).length;
  const counts = await Promise.all([14, 20, 21, 28, 35].map(tilesAt));
  assert.ok(counts.every((c, i) => i === 0 || c >= counts[i - 1]!), JSON.stringify(counts));
  assert.ok(counts[2]! - counts[1]! > counts[1]! - counts[0]!, JSON.stringify(counts));
  assert.ok(drawnNodes(await at(22)).some((n) => n.type === "path" && n.props.fill === "#fdfdfd" && Number(n.props.opacity) < 1));
  // A frame on everyone: her place, its frames in two tones of blue or black with light dots at random at every image.
  const frames = await at(41);
  assert.deepEqual(kinds(frames).filter((k) => k === "Footage").length, 2);
  assert.ok(drawnNodes(frames).some((n) => styleOf(n).filter === "url(#vblue)" && /^path\('M/.test(String(styleOf(n).clipPath))));
  assert.ok(drawnNodes(drawnNodes(frames).find((n) => n.type === "Ascii")!).some((n) => n.type === "Subject" && n.props.object === "every person"));
  // The depth in grey; the network: the depth with its blacks lifted, everyone as filmed in a black frame, wires between.
  assert.ok(kinds(await at(56)).includes("Depth"));
  const net = await at(38);
  assert.equal(styleOf(drawnNodes(net).find((n) => n.type === "Depth")!).filter, "contrast(0.78) brightness(1.18)");
  assert.ok(drawnNodes(net).filter((n) => n.type === "path" && n.props.stroke === "#c8c8c8").length >= 5);
  // The graph alone (a dot for each one seen, binary codes), then everyone in their frames on it.
  const graph = await at(109);
  assert.equal(drawnNodes(graph).filter((n) => n.type === "circle").length, 5);
  assert.ok(/^[01]{16} [01]{8} [01]{8} [01]{8}$/.test(textIn(drawnNodes(graph).find((n) => n.type === "div" && /^[01]/.test(textIn(n)) && styleOf(n).fontSize === 14))));
  assert.ok(kinds(await at(117)).includes("Footage") && !kinds(graph).includes("Footage"));
  // Everyone in dots on white, tight on their edges (them in pale grey with a dark rim of two hard shadows, in halftone:
  // no cut-out's rim, a dilation over her whole picture); the whole place in characters; at the end, her still subject
  // alone in characters, then black.
  const dots = drawnNodes(drawnNodes(await at(174)).find((n) => n.type === "Ascii")!).filter((n) => n.type === "Subject");
  assert.deepEqual(dots.map((n) => [n.props.object, n.props.rim ?? 0]), [["every person", 0]]);
  assert.match(String(styleOf(dots[0]!).filter), /^grayscale\(1\).*drop-shadow\(3px 2px 0 #1a1a1a\) drop-shadow\(-3px -2px 0 #1a1a1a\)$/);
  assert.ok(drawnNodes(drawnNodes(await at(201)).find((n) => n.type === "Ascii")!).some((n) => n.type === "Footage"));
  const end = drawnNodes(drawnNodes(await at(242)).find((n) => n.type === "Ascii")!);
  assert.ok(end.some((n) => n.type === "Subject") && !end.some((n) => n.type === "Footage"));
  assert.deepEqual(mediaOf(await at(250)), []);
  // Its place erased from the back towards her: fewer tiles at every image; its back whitening by depth.
  const erased = await Promise.all([217, 225, 235].map(tilesAt));
  assert.ok(erased[0]! > erased[1]! && erased[1]! > erased[2]!, JSON.stringify(erased));
  assert.ok(Number(drawnNodes(await at(100)).find((n) => n.type === "Near")!.props.depth) < Number(drawnNodes(await at(99)).find((n) => n.type === "Near")!.props.depth));
  // Each pass at its own moment of her place; held two images each where the original is (15 i/s).
  const momentOf = async (f: number) => drawnNodes(await at(f)).find((n) => n.type === "Footage")!.props;
  const [first, second] = await Promise.all([momentOf(41), momentOf(83)]);
  assert.notEqual(41 - Number(first.at), 83 - Number(second.at));
  assert.deepEqual([(await momentOf(40)).hold, (await momentOf(68)).hold], [2, 1]);
});

test("« Vision machine » (v1): vertical as its original, her shot in a 16:9 band on her word; her title in option; light to render", async () => {
  const { vision } = await import("./skills/vision.ts");
  // Vertical full frame; on her word her shot in a 16:9 band in the middle on the white of the passes, its blacks full frame.
  assert.deepEqual(vision.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]]]);
  const bandOf = (tree: Drawn) => drawnNodes(tree).find((n) => styleOf(n).background === "#fdfdfd" && styleOf(n).overflow === "hidden")!;
  assert.deepEqual([styleOf(bandOf(await (await visionAt(11)).tree)).top, styleOf(bandOf(await (await visionAt(11)).tree)).height], [0, 1920]);
  const wide = (await visionAt(11, VIS_READ, { settings: { format: "horizontal" } })).tree;
  assert.deepEqual([styleOf(bandOf(wide)).top, styleOf(bandOf(wide)).height], [656, 608]);
  // A shot in width framed on her still subject, kept in the middle of the vertical frame.
  const read = { ...VIS_READ, boxes: { ...VIS_READ.boxes, "0#woman standing at the tram stop": { x: 1600, y: 900, w: 150, h: 420 } } };
  const { vision: v } = await import("./skills/vision.ts");
  const { skillCode } = await import("./skills.ts");
  const { props } = await visionAt(11);
  const shots = (props.shots as { aspect: number }[]).map((s) => ({ ...s, aspect: 16 / 9 }));
  const laid = styleOf(drawnNodes(await drawKit(skillCode(v, VIS_NAMED), 11, { ...props, shots }, read)).find((n) => n.type === "Subject")!);
  assert.deepEqual([laid.left, laid.width, laid.height], [Math.round(540 - 1675), 3413, 1920]);
  // Her title, in option (none in the original): a large detection label, steady over the strobe until the place is erased.
  const titled = (await visionAt(50, VIS_READ, { titre: "Samedi soir au Salon" })).tree;
  assert.equal(textIn(byKey(titled, "title")), "Samedi soir au Salon");
  assert.equal(byKey((await visionAt(50)).tree, "title"), undefined);
  // Light to render: at most four layers of her shot at any image (one on most), none on a black; its depth only where drawn.
  const { props: all } = await visionAt(0);
  let most = 0;
  for (let f = 0; f < all.durationInFrames; f++) {
    const n = mediaOf((await visionAt(f)).tree).length;
    most = Math.max(most, n);
  }
  assert.ok(most <= 4, `${most} layers`);
});

test("« Présente-toi » (v3): nobody in profile, what the filler named there takes her place; the print's threshold from her shot's light", async () => {
  const { silhouette } = await import("./skills/silhouette.ts");
  const { skillCode, skillDrawn } = await import("./skills.ts");
  // The filler names what stands in her place only when nobody is in profile there; the engine follows it on her first shot.
  assert.deepEqual(silhouette.objects?.map((o) => [o.slot, o.shot]), [["forme", 0]]);
  const line = silhouette.timeline(2, { end: false });
  assert.deepEqual(skillDrawn(silhouette, line, { forme: "bouquet of roses" }), { shots: 2, subjects: [0], objects: [{ shot: 0, name: "bouquet of roses" }] });
  assert.deepEqual(skillDrawn(silhouette, line, {}), { shots: 2, subjects: [0] });
  const { props } = await silhouetteAt(40, {});
  const code = skillCode(silhouette, { forme: "bouquet of roses" });
  const bouquet: KitRead = {
    boxes: { "0#bouquet of roses": { x: 280, y: 820, w: 520, h: 1100 } },
    outlines: { "0#bouquet of roses": "M 540 820 C 700 830 800 1000 780 1200 L 760 1920 L 320 1920 L 300 1200 C 290 1000 380 830 540 820 Z" },
  };
  // Its shape cut out in her place, one midnight tone, « Je suis » kept inside it.
  const named = await drawKit(code, 40, props, bouquet);
  const cut = drawnNodes(named).find((n) => n.type === "Subject")!;
  assert.deepEqual([cut.props.shot, cut.props.at, cut.props.fill, cut.props.object], [0, 32, "#0f0f1c", "bouquet of roses"]);
  assert.match(String(styleOf(byKey(named, "im")!).clipPath), /^path\('M 540 820/);
  // Under the lids too, on the drop.
  assert.equal(drawnNodes(byKey(await drawKit(code, 117, props, bouquet), "eye")!).find((n) => n.type === "Subject")?.props.object, "bouquet of roses");
  // Her own cut-out first when she is in it: the object is left.
  const both = await drawKit(code, 40, props, { boxes: { ...SIL_READ.boxes, ...bouquet.boxes }, outlines: { ...SIL_READ.outlines, ...bouquet.outlines } });
  assert.equal(drawnNodes(both).find((n) => n.type === "Subject")!.props.object, undefined);
  // Nothing named (its code as written): no object, her print.
  assert.equal(drawnNodes(await drawKit(silhouette.code, 40, props, bouquet)).find((n) => n.type === "Subject"), undefined);
  // No cut-out at all: her shot as a print whose threshold is her shot's light (a bright window stays half dark), its
  // darks midnight and its lights the pale; unmeasured, as before.
  const print = async (light?: { mean: number; high: number }) => drawnNodes(await drawKit(silhouette.code, 40, props, light ? { light } : {})).find((n) => n.type === "Footage")!;
  assert.match(String(styleOf(await print({ mean: 0.8, high: 0.95 })).filter), new RegExp("^grayscale\\(1\\) brightness\\(" + (0.5 / 0.8).toFixed(2) + "\\) contrast\\(3\\.2\\)$"));
  assert.match(String(styleOf(await print({ mean: 0.1, high: 0.3 })).filter), /brightness\(2\.40\)/);
  assert.match(String(styleOf(await print()).filter), /brightness\(1\.35\)/);
  const blends = drawnNodes(await drawKit(silhouette.code, 40, props, {})).filter((n) => styleOf(n).mixBlendMode);
  assert.deepEqual(blends.map((n) => [styleOf(n).background, styleOf(n).mixBlendMode]), [["#f3f4f9", "darken"], ["#0f0f1c", "lighten"]]);
});

test("« Interrupteur » (v6): held only once nothing of her is left in her cut-out; her hands still at the edge play on to the end", async () => {
  const { interrupteur } = await import("./skills/interrupteur.ts");
  const line = interrupteur.timeline(1, { end: false });
  // v7: her passage ends on her wall alone, a second at least after she has left, before the top of her reach.
  assert.match(line.shots[0]!.want, /finit sur son mur vide, une fois qu'elle est sortie du cadre, avec au moins une seconde de mur vide/);
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#7a2e3b", palette: { secondary: "#2c4a3e", light: "#f4efe9", dark: "#1d1d1b" } };
  const reelTexts = [{ text: "Atelier Rose", role: "hook", from: 123, to: 273, emphasis: [] }];
  const props = { width: 1080, height: 1920, durationInFrames: 273, brand, shots: rallumeShots(line, 9 / 16), reelTexts, end: null, texts: marks };
  const body = { x: 420, y: 300, w: 560, h: 1500 };
  const hands = { x: 960, y: 1300, w: 120, h: 520 };
  const wallAt = async (box: (f: number) => typeof body | null, f: number) => drawnNodes((await kitScene(interrupteur.code, { box })).draw(f, props)).find((n) => n.props.key === "wall")!.props.at as number | undefined;
  // Her body gone from 201, her two hands left at the picture's edge (a tenth of her): she is still there, never frozen.
  const edge = (f: number) => (f <= 200 ? body : hands);
  assert.equal(await wallAt(edge, 230), undefined);
  assert.equal(await wallAt(edge, 272), undefined);
  // v8: her hand leaving at the edge, a hundredth of her, is still her: never frozen on it (v7 froze it there).
  const finger = { x: 1040, y: 1500, w: 40, h: 210 };
  assert.equal(await wallAt((f: number) => (f <= 200 ? body : finger), 260), undefined);
  // Nothing of her from 201, her hand back on 240: held from her leaving, her hand never seen.
  const back = (f: number) => (f <= 200 ? body : f >= 240 ? hands : null);
  const held = await Promise.all([215, 240, 272].map(async (f) => f - ((await wallAt(back, f)) ?? f)));
  assert.ok(held.every((h) => h === held[0]) && held[0]! >= 201 && held[0]! <= 207, held.join(" "));
});

/**
 * The parameters an answer's schema leaves optional, as the API counts them for its grammar (a property its object does
 * not require, every reference followed): past 24 in a request, Claude refuses it with a 400.
 */
function optionalParameters(schema: Record<string, unknown>): number {
  type N = Record<string, unknown>;
  let count = 0;
  const walk = (node: unknown, depth: number): void => {
    if (!node || typeof node !== "object" || depth > 40) return;
    const n = node as N;
    if (typeof n.$ref === "string") {
      let target: unknown = schema;
      for (const k of n.$ref.replace(/^#\//, "").split("/")) target = (target as N | undefined)?.[k];
      return walk(target, depth + 1);
    }
    if (n.properties && typeof n.properties === "object") {
      const required = new Set((n.required as string[] | undefined) ?? []);
      for (const [k, v] of Object.entries(n.properties as N)) {
        if (!required.has(k)) count++;
        walk(v, depth + 1);
      }
    }
    for (const key of ["items", "anyOf", "oneOf", "allOf", "additionalProperties"]) {
      const v = n[key];
      if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
      else if (v && typeof v === "object") walk(v, depth + 1);
    }
  };
  walk(schema, 0);
  return count;
}

test("the answers' schemas stay within the API's optional parameters: the editor's gave 25 on 5 November (its texts' own font)", async () => {
  const { outputFormat } = await import("./answer.ts");
  const { editorOutputSchema } = await import("./editor.ts");
  const { directorOutputSchema } = await import("./director.ts");
  const { skillFillSchema } = await import("./skills.ts");
  const { motionSceneOutputSchema } = await import("./motion-scene.ts");
  const { reelContractSchema } = await import("./contract.ts");
  const { montageReviewSchema } = await import("./critic.ts");
  const { voiceOverDecisionSchema, voiceOverScriptSchema } = await import("./voice-over.ts");
  const optional = (schema: unknown) => optionalParameters((outputFormat(schema as never) as unknown as { schema: Record<string, unknown> }).schema);
  // The API counted 4 more than this for the editor's (25 for 21 here, 24 for 20 when it last passed, on 3 November):
  // 20 here at most for any of them, and the editor's under it, so one more field on a plan's texts never breaks it.
  const counts = { editorOutputSchema, directorOutputSchema, skillFillSchema, motionSceneOutputSchema, reelContractSchema, montageReviewSchema, voiceOverDecisionSchema, voiceOverScriptSchema };
  for (const [name, schema] of Object.entries(counts)) assert.ok(optional(schema) <= 20, `${name}: ${optional(schema)} optional parameters`);
  assert.ok(optional(editorOutputSchema) <= 19, `the editor's: ${optional(editorOutputSchema)}`);
  // Its texts never carry a font of their own (a skill filler's); its fonts, when it gives them, both faces.
  const text = (editorOutputSchema.shape.plan.shape.texts.element as unknown as { shape: Record<string, unknown> }).shape;
  assert.equal("font" in text, false);
  const fonts = editorOutputSchema.shape.plan.shape.fonts;
  assert.equal(fonts.safeParse({ display: "Anton" }).success, false);
  assert.equal(fonts.safeParse({ display: "Anton", body: "Inter" }).success, true);
  assert.equal(fonts.safeParse(undefined).success, true);
});

test("« Interrupteur » (v8): its poster's texts keyed by their words, so its ending card's long line is measured again", async () => {
  const { interrupteur } = await import("./skills/interrupteur.ts");
  const line = interrupteur.timeline(1, { end: true });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "La Fripe Rétro", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#c4471c", palette: { secondary: "#2c4a3e", light: "#f4efe9", dark: "#1d1d1b" } };
  const durationInFrames = Math.round(line.duration * 30);
  const reelTexts = [
    { text: "La Fripe Rétro", role: "hook", from: 123, to: durationInFrames, emphasis: [] },
    { text: "Nouvelle saison", role: "caption", from: 123, to: durationInFrames, emphasis: [] },
  ];
  const end = { title: "La nouvelle saison est ouverte", subtitle: "Deux salles, de nouvelles pièces chaque semaine", from: durationInFrames - 48 };
  const props = { width: 1080, height: 1920, durationInFrames, brand, shots: rallumeShots(line, 9 / 16), reelTexts, end, texts: marks };
  const { draw } = await kitScene(interrupteur.code);
  const fits = (f: number) => drawnNodes(draw(f, props)).filter((n) => n.type === "FitText").map((n) => String(n.props.key));
  const before = fits(end.from - 5), after = fits(end.from + 5);
  // A new box for each text (a FitText measures once): the card's title and line are never the poster's boxes.
  assert.ok(before.includes("s-Nouvelle saison") && before.includes("title-La Fripe Rétro"), before.join(" "));
  assert.ok(after.includes("s-Deux salles, de nouvelles pièces chaque semaine") && after.includes("title-La nouvelle saison est ouverte"), after.join(" "));
  assert.equal(after.some((k) => before.includes(k)), false);
});

test("« Interrupteur » (v9): its switch as near the middle as her fingertip stays on it, her poster centred under it", async () => {
  const { interrupteur } = await import("./skills/interrupteur.ts");
  const line = interrupteur.timeline(1, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#7a2e3b", palette: { secondary: "#2c4a3e", light: "#f4efe9", dark: "#1d1d1b" } };
  const props = { width: 1080, height: 1920, durationInFrames: 273, brand, shots: rallumeShots(line, 9 / 16), reelTexts: [{ text: "Atelier Rose", role: "hook", from: 123, to: 273, emphasis: [] }], end: null, texts: marks };
  // Her hand reaching high far on the right (x 900): the switch goes no further from the middle than her fingertip allows.
  const at = (x: number) => (f: number) => ({
    hands: f >= 60 && f <= 160 ? [{ points: { index_tip: { x, y: f < 110 ? 1100 - (f - 60) * 14 : 400 + (f - 110) * 14 }, wrist: { x, y: 1300 } } }] : [],
    bodies: f >= 40 ? [{ points: { left_shoulder: { x: x - 80, y: 900, visible: true }, right_shoulder: { x: x + 60, y: 900, visible: true } } }] : [],
  });
  const centre = async (x: number) => {
    const { draw } = await kitScene(interrupteur.code, { track: at(x) });
    const s = drawnNodes(draw(100, props)).find((n) => n.props.key === "switch")!;
    const st = styleOf(s);
    return Number(st.left) + Number(st.width) / 2;
  };
  const SW = Math.round(1080 * 0.2875);
  assert.ok(Math.abs((await centre(900)) - (900 - SW * 0.42)) <= 1);
  // Near the middle: in the middle.
  assert.ok(Math.abs((await centre(600)) - Math.round(1080 * 0.499)) <= 1);
});

test("the model picker reads her taste: her moodboard, her art direction, the Reels she sent and kept, the models she published", async () => {
  const { housePickInput, housePickTaste, HOUSE_PICK_PROMPT } = await import("./house-pick.ts");
  // Nothing said: nothing given (the picker reads as before).
  assert.equal(housePickTaste(undefined), undefined);
  assert.equal(housePickTaste({ copied: [" "], kept: [] }), undefined);
  // Each part kept short, three at most of each list (four for her published Reels' models).
  const taste = housePickTaste({ moodboard: "x".repeat(900), direction: "Minimal, noir et blanc", copied: ["Titre néon : son nom tapé lettre à lettre", "a", "b", "c"], kept: ["Mosaïque"], published: ["Titre qui se décode"] })!;
  assert.equal((taste.moodboard as string).length, 600);
  assert.deepEqual(taste.reels_envoyes_a_recopier, ["Titre néon : son nom tapé lettre à lettre", "a", "b"]);
  assert.deepEqual([taste.direction_artistique, taste.reels_gardes_comme_modeles, taste.modeles_de_ses_reels_publies], ["Minimal, noir et blanc", ["Mosaïque"], ["Titre qui se décode"]]);
  const input = JSON.parse(housePickInput({ request: "", business: "fleuriste", files: [], voice: false, avoid: [], taste: { direction: "Minimal" } }));
  assert.deepEqual(input.ses_gouts, { direction_artistique: "Minimal" });
  assert.equal("ses_gouts" in JSON.parse(housePickInput({ request: "", business: null, files: [], voice: false, avoid: [] })), false);
  // The rule: between the models her files and request allow, the one in that spirit; never against them.
  assert.match(HOUSE_PICK_PROMPT, /ses_gouts/);
  assert.match(HOUSE_PICK_PROMPT, /never against her files or her request/);
});

test("« Fenêtres et étiquettes » (v3): its labels read over any shot, its ending card on black", async () => {
  const ended = await fenetresAt(22, { end: true });
  const card = ended.at(ended.durationInFrames - 20);
  // On black once its 6 images of fade are past (it was the last shot darkened by half).
  assert.ok(drawnNodes(card).some((n) => styleOf(n).backgroundColor === "rgba(0,0,0,1.000)"));
  // Its labels heavier and larger than the original's thin capitals, a soft dark shadow under them.
  const label = drawnNodes(ended.at(100)).find((n) => n.type === "FitText" && /OUVERT|50\.8164/.test(heldText(n)))!;
  const inner = (label.props as { innerStyle: Record<string, unknown> }).innerStyle;
  assert.deepEqual([inner.fontWeight, inner.fontSize], [500, 44]);
  assert.match(String(inner.textShadow), /rgba\(0,0,0,0\.6\)/);
});

test("a composition's titles in the font her signature gives titles; the other kept as its accent", async () => {
  const { titleFonts } = await import("../../../apps/render/src/title-fonts.ts");
  const brand = { displayFont: "Instrument Serif", bodyFont: "Inter Tight" };
  // Tristan's account: titles in its text font (Inter Tight, bold and tight), a key word in Instrument Serif italic.
  assert.deepEqual(titleFonts({ ...brand, signature: { titles: { font: "body" as const } } }), { ...brand, displayFont: "Inter Tight", accentFont: "Instrument Serif", signature: { titles: { font: "body" } } });
  // Titles in its display font, or no signature: as before, its display font also its accent.
  assert.equal(titleFonts({ ...brand, signature: { titles: { font: "display" as const } } }).displayFont, "Instrument Serif");
  assert.deepEqual(titleFonts(brand), { ...brand, accentFont: "Instrument Serif" });
  // A monospace text font is never a title's.
  assert.equal(titleFonts({ displayFont: "Anton", bodyFont: "IBM Plex Mono", signature: { titles: { font: "body" as const } } }).displayFont, "Anton");
});

