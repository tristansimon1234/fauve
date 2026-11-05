import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan, readPieceFill } from "../pieces.ts";
import { pixel, pixelCaptions, pixelSteps } from "./pixel.ts";

// « Recette cosy, typo pixel », the effect of the bank (pixel.ts): its own checks, beside the bank's (features.test.ts).

/** Her result (`first` seconds) after a lead shot, then `n` steps of a beat at 100 BPM, then the montage again. */
const run = (n: number, first = 1.5) => [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "result", at: 0.5, seconds: first },
  ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: 0.6 })),
  { file: "after", at: 2, seconds: 1.8 },
];

/** Her filler's answer with her title alone. */
const bareAnswer = { fits: true, missing: "", texts: [{ slot: "titre", text: "soupe de saison!!" }], objects: [], settings: [] };

test("« Recette cosy, typo pixel » (effect v1): her title on her result, then a caption a step, a step of several shots when they are fewer", () => {
  assert.deepEqual(pixelCaptions(" les fraises / la crème montée | ça sent bon ! "), ["les fraises", "la crème montée", "ça sent bon !"]);
  assert.deepEqual(pixelCaptions(undefined), []);
  const shots = [{ from: 0, frames: 45 }, ...[45, 63, 81, 99].map((from) => ({ from, frames: 18 }))];
  // Two captions over four steps: each one over two of them, set on its first cut, gone with its last.
  assert.deepEqual(pixelSteps({ frames: 117, shots }, 2), {
    title: 5,
    titleTo: 45,
    steps: [
      { from: 45, to: 81, caption: 0 },
      { from: 81, to: 117, caption: 1 },
    ],
  });
  // Three captions over four steps: the first a shot more. Four: one each; none: her decor on each.
  assert.deepEqual(pixelSteps({ frames: 117, shots }, 3).steps.map((s) => [s.from, s.to, s.caption]), [
    [45, 81, 0],
    [81, 99, 1],
    [99, 117, 2],
  ]);
  assert.deepEqual(pixelSteps({ frames: 117, shots }, 4).steps.map((s) => s.caption), [0, 1, 2, 3]);
  assert.deepEqual(pixelSteps({ frames: 117, shots }, 6).steps.map((s) => s.caption), [0, 1, 2, 3]);
  assert.deepEqual(pixelSteps({ frames: 117, shots }, 0).steps.map((s) => s.caption), [-1, -1, -1, -1]);
  // A caption holds over three shots at most: the shots left over get her decor.
  assert.deepEqual(
    pixelSteps({ frames: 135, shots: [...shots, { from: 117, frames: 18 }] }, 1).steps.map((s) => [s.from, s.to, s.caption]),
    [
      [45, 99, 0],
      [99, 117, -1],
      [117, 135, -1],
    ],
  );
  // Her result held a beat: her title stays over the next shot too (a second and a third at least).
  assert.equal(pixelSteps({ frames: 90, shots: [{ from: 0, frames: 18 }, ...[18, 36, 54, 72].map((from) => ({ from, frames: 18 }))] }, 1).titleTo, 54);
  // Her result alone: her title to its end.
  assert.deepEqual(pixelSteps({ frames: 60, shots: [{ from: 0, frames: 60 }] }, 2), { title: 5, titleTo: 60, steps: [] });
});

test("« Recette cosy, typo pixel » (effect v1): its layer, its marks, no sound, its tiny words optional, its colour on her word", () => {
  const plan = pieceTestPlan({
    piece: pixel,
    shots: run(4),
    span: [1.2, 5.1],
    fill: { texts: { titre: "gâteau fraise menthe!!", petit_mot: "fait maison, pour le goûter", etapes: "les fraises / la crème montée" }, objects: {}, settings: {} },
    bpm: 100,
  });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  assert.equal(motion.texts!.titre, "gâteau fraise menthe!!");
  assert.deepEqual(
    ["title_to", "steps", "step_0", "step_0_to", "step_0_say", "step_1", "step_1_to", "step_1_say"].map((k) => motion.texts![k]),
    ["45", "2", "45", "81", "0", "81", "117", "1"],
  );
  // Nothing of her cut out nor followed; no sound effect (the original has none); its three fonts.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.deepEqual(motion.fonts, ["Pixelify Sans", "Courier Prime", "Inter"]);
  // Her title is required, her tiny lines and her captions are not.
  const bare = readPieceFill(pixel, bareAnswer)!;
  assert.deepEqual(bare.texts, { titre: "soupe de saison!!" });
  assert.equal(readPieceFill(pixel, { fits: true, missing: "", texts: [{ slot: "etapes", text: "les œufs" }], objects: [], settings: [] }), null);
  // Without captions, every step is her decor.
  const decor = pieceTestPlan({ piece: pixel, shots: run(3), span: [1.2, 4.5], fill: bare, bpm: 100 }).layers![0]!.motion;
  assert.deepEqual([decor.texts!.step_0_say, decor.texts!.step_1_say, decor.texts!.step_2_say], ["-1", "-1", "-1"]);
  // Her charter's colour only when her words ask (the mint, the original's, is its default: never kept).
  assert.deepEqual(readPieceFill(pixel, { ...bareAnswer, settings: [{ name: "couleur", value: "charte" }] })!.settings, { couleur: "charte" });
  assert.deepEqual(readPieceFill(pixel, { ...bareAnswer, settings: [{ name: "couleur", value: "menthe" }] })!.settings, {});
  // Its tiny step captions are decor, as the original's; its lines with the title short labels beside it. Its title and
  // its captions in calm areas of her shots (ClearBox), its tiny lines' ink dosed to the light under them (LightUnder).
  assert.match(pixel.code, /"data-fauve-decor": ""/);
  assert.match(pixel.code, /"data-fauve-accent": ""/);
  assert.match(pixel.code, /ClearBox\(shots\[result\], frame, laid/);
  assert.match(pixel.code, /ClearBox\(shots\[first\]/);
  assert.match(pixel.code, /LightUnder\(shots\[i\]/);
});
