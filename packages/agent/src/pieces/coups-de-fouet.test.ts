import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceMusicShape, pieceTestPlan, readPieceFill } from "../pieces.ts";
import { coupsDeFouet, fouetCut, fouetCuts } from "./coups-de-fouet.ts";

// « Ville en coups de fouet », the effect of the bank (coups-de-fouet.ts): its own checks, beside the bank's (features.test.ts).

/** Her wide shot held two beats at 100 BPM after a lead shot, then `n` shots of a beat, then the montage again. */
const run = (n: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "wide", at: 0.5, seconds: 1.2 },
  ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: 0.6 })),
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Ville en coups de fouet » (effect v2): a whip flash first, then white flashes and whip flashes every other cut", () => {
  assert.deepEqual(
    Array.from({ length: 9 }, (_, k) => fouetCut(k)),
    ["whip", "flash", "cut", "whip", "cut", "flash", "cut", "whip", "cut"],
  );
  // Its cuts: where each shot after its first starts, once, inside it.
  const cuts = fouetCuts(
    [
      { from: -6, frames: 42 },
      { from: 36, frames: 18 },
      { from: 36, frames: 18 },
      { from: 54, frames: 30 },
    ],
    84,
  );
  assert.deepEqual(cuts, [
    { at: 36, kind: "whip" },
    { at: 54, kind: "flash" },
  ]);
});

test("« Ville en coups de fouet » (effect v2): its layer over her wide shot and five more, her name kept, its thud and its whooshes inside its span", () => {
  const plan = pieceTestPlan({ piece: coupsDeFouet, shots: run(5), span: [1.2, 5.4], fill: { texts: { nom: "Belleville" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  assert.equal(motion.texts!.nom, "Belleville");
  assert.equal(motion.texts!.beat, "18");
  // Nothing of her cut out nor followed: it draws her shots as filmed, its own whips and flashes over them.
  assert.equal(motion.drawn, undefined);
  assert.deepEqual(motion.fonts, ["League Gothic"]);
  // Its cuts at 36, 54, 72, 90 and 108 frames: a whip flash, a white flash, a hard cut, a whip flash, a hard cut. A dull
  // thud as her name lands, a whoosh rising into each whip flash (its first image), the second softer; all inside it.
  assert.deepEqual(
    motion.sounds!.map((s) => [s.at, s.sound, s.gain ?? 0]),
    [
      [0, "deep soft thud", 0],
      [1.167, "quick air whoosh", 0],
      [2.967, "quick air whoosh", -4],
    ],
  );
  assert.ok(motion.sounds!.every((s) => s.at < 4.2 && s.skill));
  // Her music muffled under her name, open at once on the whip that takes it away (its first cut, 36 images in).
  const shape = pieceMusicShape({ piece: coupsDeFouet, fill: { texts: { nom: "Belleville" }, objects: {}, settings: {} }, plan, layer: plan.layers![0]!, bpm: 100 })!;
  assert.deepEqual(shape.filters!.map((f) => [f.kind, f.from, f.to]), [["muffled", 1.2, 2.4]]);
  // Its code: the kit's Whip between her shots, her name in its sky (ClearBox), its light read under it (LightUnder).
  assert.match(coupsDeFouet.code, /h\(Whip, /);
  assert.match(coupsDeFouet.code, /ClearBox\(shots\[ground\], 0, laid/);
  assert.match(coupsDeFouet.code, /LightUnder\(/);
});

test("« Ville en coups de fouet » (effect v2): her name is required, cut to its place", () => {
  assert.equal(readPieceFill(coupsDeFouet, { fits: true, missing: "", texts: [], objects: [], settings: [] }), null);
  const read = readPieceFill(coupsDeFouet, { fits: true, missing: "", texts: [{ slot: "nom", text: "Le Marais, Paris troisième" }], objects: [], settings: [] })!;
  assert.equal(read.texts.nom, "Le Marais, Paris");
  // Two shots, the shortest it takes: her name, then one whip flash and its whoosh.
  const plan = pieceTestPlan({ piece: coupsDeFouet, shots: run(1), span: [1.2, 3], fill: read, bpm: 100 });
  assert.deepEqual(
    plan.layers![0]!.motion.sounds!.map((s) => s.sound),
    ["deep soft thud", "quick air whoosh"],
  );
});
