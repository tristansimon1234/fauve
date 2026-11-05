import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan, readPieceFill } from "../pieces.ts";
import { journee, journeeMoments } from "./journee.ts";

// « Une journée chez toi », the effect of the bank (journee.ts): its own checks, beside the bank's (features.test.ts).

/** Her calm shot (`first` seconds) after a lead shot, then `n` shots of a beat at 100 BPM, then the montage again. */
const run = (n: number, first = 1.2) => [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "calm", at: 0.5, seconds: first },
  ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: 0.6 })),
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Une journée chez toi » (effect v1): its pass half a beat into her first shot, her title after it held over the cut, a flash on each cut after", () => {
  const shots = [{ from: 0, frames: 36 }, ...[36, 54, 72, 90].map((from) => ({ from, frames: 18 }))];
  // The pass in at 9 (half a beat), her title from 22, still over the cut at 36, gone with the cut at 54 on a flash.
  assert.deepEqual(journeeMoments({ frames: 108, bpm: 100, shots }), { pass: 9, title: 22, titleTo: 54, flashes: [54, 72, 90] });
  // A first shot of a beat: the pass comes in at once, her title still shows on it before the cut.
  assert.deepEqual(journeeMoments({ frames: 54, bpm: 100, shots: [{ from: 0, frames: 18 }, { from: 18, frames: 36 }] }), { pass: 0, title: 13, titleTo: 54, flashes: [] });
  // A first shot that started before it: its cut is not one of its own.
  assert.equal(journeeMoments({ frames: 60, bpm: 100, shots: [{ from: -12, frames: 48 }, { from: 36, frames: 24 }] }).pass, 9);
});

test("« Une journée chez toi » (effect v1): its layer, its marks and its clicks inside its span, its small words optional", () => {
  const plan = pieceTestPlan({ piece: journee, shots: run(4), span: [1.2, 4.8], fill: { texts: { titre: "Belleville", surtitre: "une journée à" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  assert.equal(motion.texts!.titre, "Belleville");
  assert.equal(motion.texts!.surtitre, "une journée à");
  assert.deepEqual(
    [motion.texts!.pass, motion.texts!.title, motion.texts!.title_to, motion.texts!.flash_0, motion.texts!.flash_1, motion.texts!.flash_2, motion.texts!.flash_3],
    ["9", "22", "54", "54", "72", "90", undefined],
  );
  // Nothing of her cut out nor followed: its pass is a copy of her first shot, its flashes overexpose the montage.
  assert.equal(motion.drawn, undefined);
  assert.deepEqual(motion.fonts, ["Caveat"]);
  // A shutter's click on her title's arrival (the loudest) and on each flash, the third one softer: inside its 3,6 s.
  assert.deepEqual(
    motion.sounds!.map((s) => [s.at, s.gain ?? 0]),
    [
      [0.733, 3],
      [1.8, 0],
      [2.4, 0],
      [3, -6],
    ],
  );
  assert.ok(motion.sounds!.every((s) => s.sound === "camera shutter" && s.at < 3.6));
  // Her small words are optional; her title is not.
  const bare = readPieceFill(journee, { fits: true, missing: "", texts: [{ slot: "titre", text: "Farine" }], objects: [], settings: [] })!;
  assert.deepEqual(bare.texts, { titre: "Farine" });
  assert.equal(readPieceFill(journee, { fits: true, missing: "", texts: [{ slot: "surtitre", text: "un samedi chez" }], objects: [], settings: [] }), null);
  // Its code: the kit's Flash expose on its cuts, its pass masked across her first shot, no zoom on her shots.
  assert.match(journee.code, /h\(Flash, \{ key: "flash", at: flashes, expose: true, before: 2 \}\)/);
  assert.match(journee.code, /maskImage: mask/);
});

test("« Une journée chez toi » (effect v1): two shots, its shortest: her title to its end over the cut, no flash", () => {
  const plan = pieceTestPlan({ piece: journee, shots: run(1, 1.5), span: [1.2, 3.3], fill: { texts: { titre: "Farine" }, objects: {}, settings: {} }, bpm: 100 });
  const motion = plan.layers![0]!.motion;
  assert.equal(motion.texts!.title_to, "63");
  assert.equal(motion.texts!.flash_0, undefined);
  assert.deepEqual(motion.sounds!.map((s) => s.at), [Number((22 / 30).toFixed(3))]);
});
