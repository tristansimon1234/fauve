import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { pieceTestPlan } from "../pieces.ts";
import { editPlanSchema } from "../schemas.ts";
import { motsMeles, motsMelesMarks } from "./mots-meles.ts";

// « Mots mêlés », the effect of the bank (mots-meles.ts): its own checks, beside the bank's (features.test.ts).

/** Her calm shot under it (a lead shot before, her next shot after), the effect over it from its first image. */
function calmPlan(seconds: number, texts: Record<string, string>) {
  const shots = [
    { file: "lead", at: 1, seconds: 1.2 },
    { file: "calm", at: 0.5, seconds },
    { file: "after", at: 2, seconds: 1.8 },
  ];
  return pieceTestPlan({ piece: motsMeles, shots, span: [1.2, 1.2 + seconds], fill: { texts, objects: {}, settings: {} }, bpm: 80 });
}

test("« Mots mêlés » (effect v1): its layer over her calm shot, her sentence and her other words, nothing cut out", () => {
  const plan = calmPlan(7, { mots: "bouquets du samedi matin", autres: "pivoine tulipe" });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // It draws none of her shots cut out and follows nothing: a grid and its loops over the montage's own shot.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined, "the original has no sound");
  assert.equal(motion.texts!.mots, "bouquets du samedi matin");
  assert.equal(motion.texts!.autres, "pivoine tulipe");
  assert.equal(Number(motion.texts!.first), 4);
  assert.equal(Number(motion.texts!.hold), 63);
  assert.deepEqual(checkMotionCode(motsMeles.code), []);
  // Its loops at a hand's pace, from above the first letter, counterclockwise; its filler letters and its loops' dark
  // halos a decor, never words to read; nothing fades in or out.
  assert.match(motsMeles.code, /speed: l\.speed, start: "top-left", direction: "ccw"/);
  assert.equal(motsMeles.code.match(/"data-fauve-decor": ""/g)?.length, 2);
  assert.doesNotMatch(motsMeles.code, /interpolate\(/);
  // Its other words are optional: left out, none hidden.
  assert.equal(calmPlan(5, { mots: "une coupe et un brushing" }).layers![0]!.motion.texts!.autres, undefined);
});

test("« Mots mêlés »: its whole sentence held a third of its span (1,2 to 3 s) before the cut, its first loop on its fifth image", () => {
  for (const seconds of [motsMeles.seconds[0] * 0.8, motsMeles.seconds[0], 6, 8, motsMeles.seconds[1]]) {
    const frames = Math.round(seconds * 30);
    const { first, hold } = motsMelesMarks(frames);
    assert.equal(first, 4);
    assert.ok(hold >= 36 && hold <= 90, `${seconds} s: held ${hold} frames`);
    assert.equal(hold, Math.round(Math.min(Math.max(36, frames * 0.3), 90)));
    // Room left for its loops, at least half its span.
    assert.ok(frames - hold - first >= frames * 0.5, `${seconds} s`);
  }
  // A span far too short still leaves its loops some room.
  const tiny = motsMelesMarks(18);
  assert.ok(tiny.hold <= 9 && tiny.first + tiny.hold < 18);
});
