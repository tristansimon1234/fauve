import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceMusicShape, pieceTestPlan, readPieceFill } from "../pieces.ts";
import { gaufre, gaufreMoments } from "./gaufre.ts";

// « Titre gaufré », the effect of the bank (gaufre.ts): its own checks, beside the bank's (features.test.ts).

const run = (n: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: 1.4 })),
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Titre gaufré » (effect v2): its paper over the shots under it, her name inked in its original's order, then held to be read", () => {
  const fill = { texts: { titre: "Farine", ligne: "pâtisserie · paris 11e" }, objects: {}, settings: {} };
  const plan = pieceTestPlan({ piece: gaufre, shots: run(3), span: [1.2, 5.4], fill, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // A drawn paper: it covers her shots and draws none of them, cuts nothing out, follows nothing; no sound of its own.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.doesNotMatch(gaufre.code, /\b(Footage|Subject|SubjectBox|SubjectParts)\b/);
  assert.equal(motion.texts!.titre, "Farine");
  assert.equal(motion.texts!.ligne, "pâtisserie · paris 11e");
  // 4,2 s at 100 BPM: its first letter already inking before the cut, the second starting before the first is done,
  // the last after them, its dots last, its line along; all of it done with a beat and a half to spare.
  const at = Object.fromEntries(["ink", "first", "second", "last", "dots", "inked", "line_from", "line_to", "dry"].map((k) => [k, Number(motion.texts![k])]));
  assert.ok(at.ink! < 0, `its first letter's ink starts before the cut (${at.ink})`);
  assert.ok(at.second! < at.first! && at.first! < at.last! && at.last! < at.dots! && at.dots! < at.inked! && at.inked! <= at.line_to!);
  assert.ok(at.line_from! > at.second! && at.line_from! < at.last!);
  assert.equal(126 - at.line_to!, 27);
  // Its music stopped dead on the beat before her name is inked whole (its 5th, at 95 images), back on its last (its 7th).
  assert.deepEqual(pieceMusicShape({ piece: gaufre, fill, plan, layer: plan.layers![0]!, bpm: 100 }), { pauses: [{ from: 4.2, to: 5.4 }] });
  // Its paper's colours on her word only: the original's peach by default, her charter's when the brief or her request asks.
  assert.equal(motion.texts!.papier, undefined);
  const read = readPieceFill(gaufre, { fits: true, missing: "", texts: [{ slot: "titre", text: "Farine" }], objects: [], settings: [{ name: "papier", value: "charte" }, { name: "papier", value: "rose" }] })!;
  assert.deepEqual(read.settings, { papier: "charte" });
  const charter = pieceTestPlan({ piece: gaufre, shots: run(2), span: [1.2, 4.0], fill: read, bpm: 100 });
  assert.equal(charter.layers![0]!.motion.texts!.papier, "charte");
  // Its line optional.
  assert.equal(charter.layers![0]!.motion.texts!.ligne, undefined);
});

test("« Titre gaufré »: short, its ink runs faster; long, never more than a quarter slower than its original, the rest held inked", () => {
  const ORIGINAL = 1800 / 113.2;
  for (const bpm of [60, 100, 120, 140]) {
    for (const seconds of [2, 2.5, 4, 6]) {
      const frames = Math.round(seconds * 30);
      const at = gaufreMoments(frames, bpm);
      assert.ok(at.inked <= at.line_to && at.line_to < frames, `${bpm} BPM, ${seconds} s: inked by ${at.line_to} of ${frames}`);
      // Held inked a beat and a half (half-beats on a slow Reel; a fifth of it at most when it is short), more when it is long.
      const beat = (1800 / bpm) * (bpm < 80 ? 0.5 : 1);
      assert.ok(at.hold >= Math.min(beat * 1.5, frames * 0.22) - 1, `${bpm} BPM, ${seconds} s: held ${at.hold}`);
      // Its pace: the first letter's ink lasts 6 of its original's beats, never more than a quarter slower than its own.
      assert.ok(at.first - at.ink <= 6 * ORIGINAL * 1.25 + 1);
      // Its silence on whole beats of the Reel (a silence ending off the beat moves the music off the cuts), a beat long
      // at least, from before her name is inked whole, within the effect.
      const whole = 1800 / bpm;
      if (at.quiet) {
        const [from, to] = at.quiet;
        assert.ok([from, to].every((f) => Math.abs(f / whole - Math.round(f / whole)) < 0.01) && to - from >= whole - 0.5 && from <= at.inked && to <= frames, `${bpm} BPM, ${seconds} s: ${from}–${to}`);
      }
    }
  }
});
