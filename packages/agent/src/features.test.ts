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
} from "./speech.ts";
import { fromEditorPlan, normalizeEditPlan } from "./editor.ts";
import { depthPhotoIds } from "./depth.ts";
import { dayIn, lookStamp } from "./looks.ts";
import { followedEffect } from "./steal.ts";
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
  assert.equal(props.effect, "disposable");
  assert.equal(props.stamp, "'26 10 29");
});

test("looks: the date a look prints, only a disposable's or a camcorder's", () => {
  assert.equal(lookStamp("disposable", "2026-10-29"), "'26 10 29");
  assert.equal(lookStamp("vhs", "2026-02-03"), "3 FÉVR. 2026");
  assert.equal(lookStamp("bw", "2026-10-29"), undefined);
  assert.equal(lookStamp("disposable", undefined), undefined);
  assert.match(dayIn("Europe/Paris", new Date("2026-10-29T23:30:00Z")), /^2026-10-30$/);
});

test("looks: the editor's effect is kept when it is one, the copied Reel brings its own", () => {
  const written = {
    duration: 4,
    tempo: 100,
    form: "montage" as const,
    segments: [{ clip_id: "a", in: 0, out: 4, move: "none", speed: 1 }],
    texts: [],
    transitions: "cut" as const,
    subtitles: false,
  };
  assert.equal(fromEditorPlan({ ...written, effect: "vhs" }).effect, "vhs");
  assert.equal(fromEditorPlan({ ...written, effect: "none" }).effect, undefined);
  const followed = { look: { effect: "bw" } } as unknown as Parameters<typeof followedEffect>[1];
  assert.deepEqual(followedEffect({}, followed), { effect: "bw" });
  assert.deepEqual(followedEffect({ effect: "dust" }, followed), {});
  assert.deepEqual(followedEffect({}, { look: { effect: "grain" } } as unknown as Parameters<typeof followedEffect>[1]), {});
  assert.ok(editPlanSchema.safeParse({ ...validPlanBase, effect: "y2k" }).success);
  assert.equal(editPlanSchema.safeParse({ ...validPlanBase, effect: "sepia" }).success, false);
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
  const plan = storyPlan({ mediaId: "p1", photo: true, text: "2 places ce soir", detail: "19 h · cours débutant", effect: "disposable" });
  assert.equal(plan.duration, 5);
  assert.deepEqual(plan.segments, [{ clip_id: "p1", in: 0, out: 5, zoom: "none" }]);
  assert.equal(plan.texts[0]!.text, "2 places ce soir");
  assert.equal(plan.texts[0]!.from, 0);
  assert.deepEqual(plan.texts[0]!.items, [{ title: "19 h · cours débutant" }]);
  assert.equal(plan.effect, "disposable");
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
