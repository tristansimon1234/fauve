import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type EditPlan } from "./schemas.ts";
import {
  castOf,
  colourMode,
  CURVE_POINTS,
  reelGrades,
  shotGrade,
  throughCurve,
  TONE,
  toneAdjust,
  toneBaseline,
  toneCrop,
  toneCurve,
  toneFor,
  tonePassages,
  withTones,
  type ShotGrade,
  type ShotTone,
} from "./shot-tone.ts";
import { buildReelProps } from "./motion.ts";
import { carryRetouch } from "./editor.ts";
import { LOOK_PRESETS, reelLookSchema } from "./looks.ts";
import { toneOfPixels } from "../../../apps/render/tone_read.mjs";

// Tristan, 8 November, on a CapCut tutorial's recipe for phone footage (« Ajustement automatique », exposure −10,
// highlights −10, saturation +5, clarity +15, « Lueur 2 »): one setting on every clip darkens the shots already dark.
// Each shot is measured and brought part of the way to the Reel's light instead, gently and capped.

const tone = (mean: number, extra: Partial<ShotTone> = {}): ShotTone => ({ at: [0, 2], mean, low: 0.05, high: Math.min(0.95, mean + 0.35), burnt: 0, rgb: [0.5, 0.5, 0.5], ...extra });
const graded = (g: ShotGrade | "as_filmed" | null): ShotGrade => {
  assert.ok(g && g !== "as_filmed", "a grade");
  return g;
};
/** The mean light a shot shows once its curve is laid (its mean through the curve: what the gamma aims at). */
const shown = (g: ShotGrade | null, mean: number) => throughCurve(g?.curve, mean);

function plan(segments: object[], extra: Partial<EditPlan> = {}): EditPlan {
  return editPlanSchema.parse({ format: "9:16", duration: 8, template: "libre", segments, texts: [{ text: "Le samedi", style: "hook", from: 0, to: 2, emphasis: [] }], images: [], transitions: "cut", subtitles: false, music: null, ...extra });
}
const shot = (id: string, t?: ShotTone, more: object = {}) => ({ clip_id: id, in: 0, out: 2, zoom: "none", ...(t ? { tone: t } : {}), ...more });

test("the Reel's light: its shots' median, pulled a little toward a well exposed shot, unless a model's look is followed", () => {
  const dark = [tone(0.18), tone(0.2), tone(0.22)];
  const free = toneBaseline(dark, false);
  // Night footage stays night footage: pulled at most TONE.pullMax toward the standard.
  assert.equal(Math.round(free.mean * 1000) / 1000, 0.26);
  assert.equal(toneBaseline(dark, true).mean, 0.2);
  const bright = toneBaseline([tone(0.62), tone(0.66)], false);
  assert.ok(bright.mean < 0.64 && bright.mean >= 0.64 - TONE.pullMax);
});

test("a dark shot among brighter ones is lifted, part of the way and capped; a shot already at the Reel's light is left alone", () => {
  const base = toneBaseline([tone(0.45), tone(0.47), tone(0.2)], false);
  const lifted = graded(shotGrade(tone(0.2), base, false));
  assert.ok(shown(lifted, 0.2) > 0.27, "lifted");
  assert.ok(shown(lifted, 0.2) <= 0.2 + TONE.lift + 0.01, "never more than the cap");
  // Black stays black, white stays white (a gamma, not a gain).
  assert.equal(lifted.curve[0], 0);
  assert.equal(lifted.curve.at(-1), 1);
  assert.equal(shotGrade(tone(0.45), base, false), null, "nothing to do: no grade at all");
  // A very dark shot is lifted by the cap at most.
  const veryDark = graded(shotGrade(tone(0.06), toneBaseline([tone(0.5), tone(0.5), tone(0.06)], false), false));
  assert.ok(shown(veryDark, 0.06) <= 0.06 + TONE.lift + 0.015);
});

test("a bright shot is darkened less readily than a dark one is lifted", () => {
  const base = toneBaseline([tone(0.4), tone(0.42), tone(0.75)], false);
  const calmed = graded(shotGrade(tone(0.75), base, false));
  const drop = 0.75 - shown(calmed, 0.75);
  assert.ok(drop > 0.03 && drop <= TONE.darken + 0.01, `darkened by ${drop}`);
});

test("burnt whites are calmed, milky blacks brought down", () => {
  const base = toneBaseline([tone(0.45), tone(0.45)], false);
  const burnt = graded(shotGrade(tone(0.45, { high: 0.99, burnt: 0.08 }), base, false));
  assert.ok(burnt.curve.at(-1)! < 1 && burnt.curve.at(-1)! >= 1 - TONE.burnt - 1e-9);
  const milky = graded(shotGrade(tone(0.45, { low: 0.2 }), base, false));
  assert.ok(milky.curve[2]! < 2 / (CURVE_POINTS - 1), "its shadows go down");
});

test("a strong colour cast is neutralised a little, each channel capped, the light kept", () => {
  // Two neutral shots and a cold one (daylight through a window among warm lamps).
  const warm = (m: number) => tone(m, { rgb: [0.52, 0.47, 0.42] });
  const cold = tone(0.45, { rgb: [0.44, 0.48, 0.51] });
  const base = toneBaseline([warm(0.45), warm(0.45), cold], false);
  const g = graded(shotGrade(cold, base, false));
  const [r, , , , , , gg, , , , , , b] = g.matrix;
  assert.ok(r! > gg! && b! < gg!, "warmed: more red, less blue");
  assert.ok(Math.log(r! / gg!) <= TONE.castMax + 1e-3 && Math.log(gg! / b!) <= TONE.castMax + 1e-3, "capped");
  assert.ok(Math.abs(0.2126 * r! + 0.7152 * gg! + 0.0722 * b! - 1) < 1e-3, "its light kept");
  // A warm restaurant stays warm: only what goes beyond the tolerance is corrected.
  const restaurant = graded(shotGrade(tone(0.45, { rgb: [0.53, 0.47, 0.41] }), base, true));
  assert.ok(Math.abs(restaurant.matrix[0]! - 1) < 0.02 && Math.abs(restaurant.matrix[12]! - 1) < 0.02, "a touch at most");
  // A neutral shot among shots of a mint backdrop is not pushed toward their colour (a white top went pink).
  const mint = (m: number) => tone(m, { rgb: [0.36, 0.45, 0.43] });
  const white = tone(0.45, { rgb: [0.6, 0.6, 0.6] });
  const studio = toneBaseline([mint(0.45), mint(0.45), white], false);
  assert.equal(shotGrade(white, studio, false), null);
  // Too few neutral parts read (a field of flowers): no cast is guessed.
  assert.equal(castOf(tone(0.45, { rgb: null })), null);
  assert.equal(shotGrade(tone(0.45, { rgb: null }), toneBaseline([tone(0.45, { rgb: null })], false), false), null);
});

test("the tone curve stays in range and never goes back down", () => {
  for (const settings of [{ gamma: 0.72 }, { gamma: 1.3 }, { black: 0.05, gamma: 0.8, pull: 0.09 }, { pull: TONE.polishPull }]) {
    const curve = toneCurve(settings);
    assert.equal(curve.length, CURVE_POINTS);
    curve.forEach((v, i) => {
      assert.ok(v >= 0 && v <= 1);
      if (i) assert.ok(v >= curve[i - 1]!, `monotonic ${JSON.stringify(settings)}`);
    });
  }
  assert.ok(Math.abs(throughCurve(toneCurve({}), 0.37) - 0.37) < 1e-4);
});

test("the light finish: highlights pulled and a small glow, without a measure too; never over a model's look", () => {
  const polish = graded(shotGrade(null, null, true));
  assert.equal(polish.glow, TONE.polishGlow);
  assert.ok(Math.abs(polish.curve.at(-1)! - (1 - TONE.polishPull)) < 1e-9);
  assert.ok(Math.abs(throughCurve(polish.curve, 0.4) - 0.4) < 1e-4, "mid-tones untouched");
  // On a plan without measures yet (the preview before its first render), the finish alone.
  const fresh = reelGrades(plan([shot("a"), shot("b")]));
  assert.deepEqual(fresh.map((g) => graded(g).glow), [TONE.polishGlow, TONE.polishGlow]);
  // A Reel wearing a graded look (hers, the Reel she copies, a model's finish), or a model's code: no finish of the engine.
  for (const extra of [{ look: LOOK_PRESETS.cine }, { skill: { key: "mosaique", version: 3 } }]) {
    assert.deepEqual(reelGrades(plan([shot("a"), shot("b")], extra)), [null, null]);
  }
  // A model whose finish is « Naturel » (no grade): the light finish stays.
  assert.ok(graded(reelGrades(plan([shot("a")], { look: reelLookSchema.parse({ name: "Naturel" }) }))[0]!).glow > 0);
  // « Couleurs naturelles »: matched, no finish.
  assert.deepEqual(reelGrades(plan([shot("a")], { finish: { colour: "natural" } })), [null]);
});

test("on a model, the shots are matched to each other only: no pull toward a standard light or colour", () => {
  const dark = (m: number) => tone(m, { rgb: [0.55, 0.45, 0.35] });
  const segments = [shot("a", dark(0.2)), shot("b", dark(0.2)), shot("c", dark(0.2))];
  // A night Reel on a model stays as dark and as warm as it was filmed: every shot already at its own median.
  assert.deepEqual(reelGrades(plan(segments, { skill: { key: "nuit", version: 2 } })), [null, null, null]);
  // Without a model, it is lifted a little and its warmth softened.
  const free = reelGrades(plan(segments, { finish: { colour: "natural" } }));
  assert.ok(free.every((g) => g && g !== "as_filmed" && shown(g, 0.2) > 0.2));
});

test("as filmed: the whole Reel (finish.colour off), a shot she asked for, an effects agent's video", () => {
  const off = plan([shot("a", tone(0.2)), shot("b", tone(0.5))], { finish: { colour: "off" } });
  assert.equal(colourMode(off), "off");
  assert.deepEqual(reelGrades(off), ["as_filmed", "as_filmed"]);
  assert.deepEqual(tonePassages(off), []);
  const one = plan([shot("a"), shot("b", undefined, { keep_colour: true })]);
  assert.equal(reelGrades(one)[1], "as_filmed");
  assert.deepEqual(tonePassages(one).map((p) => p.index), [0]);
  // Her kept shot does not count in the Reel's light either.
  const kept = plan([shot("a", tone(0.45)), shot("b", tone(0.45)), shot("c", tone(0.1), { keep_colour: true })], { finish: { colour: "natural" } });
  assert.deepEqual(reelGrades(kept), [null, null, "as_filmed"]);
  assert.equal(colourMode({ segments: [], baked: { by: "agent" } }), "off");
});

test("a measure holds for the passage it was read on: a shot cut elsewhere is read again", () => {
  const p = plan([shot("a", tone(0.3)), { ...shot("b", tone(0.3)), in: 1.5, out: 3 }, { scene: { kind: "title", title: "x", background: "ink" }, duration: 2 }]);
  assert.ok(toneFor(p.segments[0] as never));
  assert.equal(toneFor(p.segments[1] as never), null);
  assert.deepEqual(tonePassages(p), [{ index: 1, in: 1.5, out: 3 }]);
  const read = withTones(p, { 1: { mean: 0.5, low: 0.1, high: 0.8, burnt: 0, rgb: [0.5, 0.5, 0.5] } });
  assert.deepEqual((read.segments[1] as { tone: ShotTone }).tone.at, [1.5, 3]);
  assert.deepEqual(tonePassages(read), []);
  // A correction keeps the measure of a passage it keeps, never one cut elsewhere.
  const next = plan([shot("a"), { ...shot("b"), in: 0, out: 1 }]);
  const carried = carryRetouch(next, read);
  assert.ok((carried.segments[0] as { tone?: ShotTone }).tone);
  assert.equal((carried.segments[1] as { tone?: ShotTone }).tone, undefined);
});

test("the light is read where the Reel shows it: a wide shot cropped to the frame around its subject", () => {
  const [x, y, w, h] = toneCrop(16 / 9, undefined);
  assert.ok(Math.abs(w - (9 / 16) / (16 / 9)) < 1e-3 && h === 1 && y === 0);
  assert.ok(Math.abs(x - (1 - w) / 2) < 1e-3);
  assert.equal(toneCrop(16 / 9, { x: 0, y: 0.5 })[0], 0);
  assert.deepEqual(toneCrop(9 / 16, undefined), [0, 0, 1, 1]);
  assert.deepEqual(toneCrop(undefined, undefined), [0, 0, 1, 1]);
});

test("her light retouch under a grade: the measure's light and warmth replace the ones guessed, as filmed none", () => {
  const adjust = { exposure: 0.3, contrast: 0.1, saturation: 0.1, warmth: 0.2, straighten: 2 };
  assert.deepEqual(toneAdjust(adjust, null, true), { straighten: 2, contrast: 0.1, saturation: 0.1 });
  assert.deepEqual(toneAdjust(adjust, "as_filmed", false), { straighten: 2 });
  assert.deepEqual(toneAdjust(adjust, null, false), adjust);
});

test("the props: her footage graded, the texts untouched, her colours as filmed when she asks", () => {
  const inputs = { template: "libre" as const, clipUrls: { a: "a.mp4", b: "b.mp4" }, photoIds: [], words: {}, brand: { name: "Café", accent: "#b5543a", logoUrl: null } };
  const p = plan([shot("a", tone(0.2), { adjust: { exposure: 0.4 } }), shot("b", tone(0.5))]);
  const props = buildReelProps(p, inputs);
  const [a, b] = props.segments as { type: string; tone?: ShotGrade; adjust?: object }[];
  assert.ok(a!.tone && b!.tone);
  assert.equal(a!.adjust, undefined, "the light guessed by the analysis gives way to the measure");
  assert.ok(shown(a!.tone!, 0.2) > 0.2);
  assert.deepEqual(Object.keys(props.texts[0]!).includes("tone"), false);
  const off = buildReelProps({ ...p, finish: { colour: "off" } }, inputs);
  assert.equal(off.asFilmed, true);
  assert.ok(off.segments.every((s) => (s as { asFilmed?: boolean }).asFilmed));
});

test("tone_read.mjs: a grey picture is neutral, a field of red has no neutral part to read a cast on", () => {
  const n = 64 * 64;
  const grey = new Uint8Array(n * 3).fill(128);
  const t = toneOfPixels(grey)!;
  assert.ok(Math.abs(t.mean - 0.502) < 0.002 && t.burnt === 0);
  assert.deepEqual(t.rgb, [0.502, 0.502, 0.502]);
  const red = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) red.set([220, 30, 40], i * 3);
  assert.equal(toneOfPixels(red)!.rgb, null);
  // Half black, half burnt white: its dark and bright tenths, and what is burnt.
  const split = new Uint8Array(n * 3);
  split.fill(255, 0, (n / 2) * 3);
  const s = toneOfPixels(split)!;
  assert.equal(s.low, 0);
  assert.equal(s.high, 1);
  assert.equal(s.burnt, 0.5);
});
