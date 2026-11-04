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
  // Two of Edith's models need something filmed, with what they do without it.
  const card = houseModel("carte-feutre")!;
  assert.ok(houseLines(card).includes("Il faut que tu me filmes ta main qui tient une carte blanche devant tes plans, comme dans le modèle ; sans ça, je dessine la carte par-dessus tes images."));
  const told = houseModelsForEdith().filter((m) => m.a_lui_dire).map((m) => m.key);
  assert.deepEqual(told.sort(), ["carte-feutre", "nike"]);
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
  // Her subject drawn by an animation: every photo of the Reel has its own cut-out made (none when nothing draws her).
  assert.deepEqual(subjectPhotoIds(plan), ["p1", "p2"]);
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
  const { houseSheets, sheetSpan, houseOriginalPath, HOUSE_PASSAGES, MODEL_SHEETS } = await import("./house-sheets.ts");
  const { HOUSE_MEASURES } = await import("./house-measures.ts");
  const { stolenStyleSchema } = await import("./steal.ts");
  // A studio's row written before the sheets is rewritten (7: four models renamed after their originals).
  assert.equal(HOUSE_VERSION, 8);
  for (const m of HOUSE_MODELS) {
    const sheets = houseSheets(m.key);
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
  const made: Record<string, number> = { decode: 12, "quatre-coins": 11, mosaique: 3, "carte-feutre": 5, pile: 5, "photo-dump": 6, table: 5, "ecran-partage": 7, cadre: 4, fenetres: 7, facade: 5, gaufre: 7, "mot-cle": 12, frappe: 7, "titre-derriere": 6, journee: 8, "plans-fixes": 7, "coups-de-fouet": 12, tourne: 7, nike: 6, eventail: 10, coulisses: 6, interrupteur: 5, interface: 7, pixel: 8, "mots-meles": 10, aplat: 5, detourages: 9, createur: 12, silhouette: 6, vision: 5 };
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
  assert.deepEqual(shown.modeles.find((m) => m.key === "decode")!.fichiers, [5, 8]);
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
  const { skillFit, skillLengths, skillTempos } = await import("./skills.ts");
  for (const skill of Object.values(MONTAGE_SKILLS)) {
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
  // Its music stops dead four images before the end, as the original's; it adds no sound its original has not.
  assert.ok(Math.abs(line.music!.end!.at - (line.duration - 4 / 30)) < 0.01);
  assert.equal(line.sounds, undefined);
  // A piece comes out at its own light, the rest dimmed: never pushed into white (a lit neon burnt into blots).
  assert.ok(!/brightness\(1\.[6-9]/.test(frappe.code));
  assert.ok(/background: "#000000", opacity: dimK/.test(frappe.code));
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

test("« Plans fixes de cinéma » (v2): a dry click on each word of its title as its code lays it, again on her words", async () => {
  const { plansFixes } = await import("./skills/plans-fixes.ts");
  const { skillPlan, replaySkillAudio, skillWordsOf } = await import("./skills.ts");
  const { leadPlan } = await import("./sound-follow.ts");
  // The original's words land on its images 14, 26, 41, 59 and 83 (docs/fiches/plans-fixes.md): its code within 3 images,
  // and a click on each.
  const line = plansFixes.timeline(10, { end: false, words: { accroche: "The power of", titre: "Static shot" } });
  const frames = (line.sounds ?? []).map((s) => Math.round(s.at * 30));
  assert.deepEqual(frames, [14, 28, 42, 56, 83]);
  [14, 26, 41, 59, 83].forEach((f, i) => assert.ok(Math.abs(frames[i]! - f) <= 3, `word ${i + 1}: image ${frames[i]}, the original's ${f}`));
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
  assert.deepEqual(plan.sounds?.map((s) => [Math.round(s.at * 30), s.sound, s.skill]), [[14, "light click", true], [28, "light click", true], [42, "light click", true], [56, "light click", true]]);
  assert.equal(plan.music_shape, undefined);
  const slower = skillPlan({ skill: plansFixes, name: "Plans fixes", files, fill, bpm: 60 });
  assert.equal(Math.round(slower.sounds![1]!.at * 30), 30);
  // Her words changed by hand: a click on each of the new ones; another version or another cut keeps its own.
  assert.deepEqual(skillWordsOf(plansFixes, plan.texts), { accroche: "un soir à", titre: "Belleville" });
  const edited = { ...plan, texts: plan.texts.map((t) => (t.style === "hook" ? { ...t, text: "le canal Saint-Martin" } : t)) };
  assert.equal(replaySkillAudio(plansFixes, edited)?.sounds?.length, 6);
  assert.equal(replaySkillAudio(plansFixes, { ...edited, skill: { key: "plans-fixes", version: 1 } }), null);
  assert.equal(replaySkillAudio(plansFixes, { ...edited, duration: edited.duration + 1 }), null);
  // Held on its first image for a sound she follows: its clicks that much later, again the same on her words.
  const held = leadPlan(plan, 0.3);
  assert.deepEqual(held.sounds?.map((s) => s.at), plan.sounds!.map((s) => Math.round((s.at + 0.3) * 1000) / 1000));
  assert.deepEqual(replaySkillAudio(plansFixes, held)?.sounds?.map((s) => Math.round(s.at * 100)), held.sounds?.map((s) => Math.round(s.at * 100)));
});
