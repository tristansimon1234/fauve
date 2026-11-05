import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan } from "../pieces.ts";
import { cadre } from "./cadre.ts";

// « Cadre dans le cadre », the effect of the bank (cadre.ts): its own checks, beside the bank's (features.test.ts).

test("« Cadre dans le cadre » (effect v1): its layer over a run of shots, its door named for its first shot, its labels optional", () => {
  const shots = [
    { file: "lead", at: 1, seconds: 1.2 },
    ...["wide", "a", "b", "c", "d"].map((file) => ({ file, at: 0.5, seconds: 0.6 })),
    { file: "after", at: 2, seconds: 1.8 },
  ];
  const plan = pieceTestPlan({ piece: cadre, shots, span: [1.2, 4.2], fill: { texts: {}, objects: { porte: "back door" }, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // Its door on the first shot under it (the second of her shots), followed only there.
  assert.deepEqual(motion.drawn, { shots: 7, objects: [{ shot: 1, name: "back door" }] });
  // Its labels left out: none drawn (their words are optional).
  assert.equal(motion.texts!.gauche, undefined);
  // Its frame never zooms: it only grows at a cut or a beat (no interpolate on its size).
  assert.doesNotMatch(cadre.code, /interpolate\(/);
});
