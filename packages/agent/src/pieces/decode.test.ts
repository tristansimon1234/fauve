import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceMusicShape, pieceTestPlan } from "../pieces.ts";
import { decode, decodeMoments } from "./decode.ts";

// « Titre qui se décode », the effect of the bank (decode.ts): its own checks, beside the bank's (features.test.ts).

const run = (n: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: 0.6, ...(i === 2 ? { photo: true } : {}) })),
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Titre qui se décode » (effect v2): its layer over a run of shots, its title on the black, then its band on a beat, full at its end", () => {
  const fill = { texts: { titre: "le Marais", surtitre: "un matin dans" }, objects: {}, settings: {} };
  const plan = pieceTestPlan({ piece: decode, shots: run(8), span: [1.2, 6], fill, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // It cuts nothing out and follows nothing: its band shows her shots as filmed (Footage), the eight under it.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.texts!.mine, "1,2,3,4,5,6,7,8");
  assert.equal(motion.texts!.titre, "le Marais");
  assert.equal(motion.texts!.surtitre, "un matin dans");
  // 4,8 s at 100 BPM: its title just after the cut, decoded in its original's 2,64 beats (12, 19 and 8 of its images at
  // 122 BPM), landed before its band opens on the 4th beat; the band full two images before its end.
  const marks = Object.fromEntries(["show", "hold", "scramble", "resolve", "open", "full"].map((k) => [k, Number(motion.texts![k])]));
  assert.equal(marks.show, 2);
  assert.ok(Math.abs(marks.hold! + marks.scramble! + marks.resolve! - (39 / 14.754) * 18) <= 1);
  assert.equal(marks.open, 72);
  assert.ok(marks.show! + marks.hold! + marks.scramble! + marks.resolve! < marks.open!);
  assert.equal(marks.full, 142);
  // Its sounds: an impact on the cut, then a burst of ticks, one every three images while it scrambles, within it.
  const [impact, ticks] = motion.sounds ?? [];
  assert.equal(impact?.at, 0);
  assert.match(impact!.sound, /impact/);
  assert.match(ticks!.sound, /tick/);
  assert.equal(ticks!.at, Math.round(((marks.show! + marks.hold!) / 30) * 1000) / 1000);
  const times = ticks!.burst!.times;
  assert.ok(times.length >= 8 && times.every((t, i) => i === 0 || Math.abs(t - times[i - 1]! - 0.1) < 0.02), JSON.stringify(times));
  assert.ok(ticks!.at + times.at(-1)! <= (marks.show! + marks.hold! + marks.scramble! + marks.resolve! + 1) / 30);
  // Its music, as its skill's: silent from the cut to black to the beat its band opens on, then muffled to the cut back.
  assert.deepEqual(pieceMusicShape({ piece: decode, fill, plan, layer: plan.layers![0]!, bpm: 100 }), {
    pauses: [{ from: 1.2, to: 3.6 }],
    filters: [{ kind: "radio", from: 3.6, to: 6, open: 0.05 }],
  });
  // A mask that grows, never a zoom: nothing in its code scales or moves a picture.
  assert.doesNotMatch(decode.code, /transform|scale\(/);
});

test("« Titre qui se décode »: its small words optional, a short span keeps its band, any tempo keeps its moments in order", () => {
  // Without its small words: its title alone.
  const alone = pieceTestPlan({ piece: decode, shots: run(5), span: [1.2, 4.2], fill: { texts: { titre: "Lune" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(alone).success);
  assert.equal(alone.layers![0]!.motion.texts!.surtitre, undefined);
  for (const bpm of [60, 72, 90, 100, 122, 140]) {
    const beat = 1800 / bpm;
    for (const seconds of [2.4, 3, 4, 5, 6, 8]) {
      const frames = Math.round(seconds * 30);
      const at = decodeMoments(frames, bpm);
      // Its title lands before its band opens, which always leaves the band 45 % of it at least, and is full by its end.
      assert.ok(at.lands < at.open, `${bpm} BPM, ${seconds} s: lands ${at.lands}, opens ${at.open}`);
      assert.ok(at.open <= frames * 0.55 + 1, `${bpm} BPM, ${seconds} s: opens at ${at.open} of ${frames}`);
      assert.ok(at.full > at.open && at.full <= frames);
      // Its music back on a whole beat of the Reel (a silence ending off the beat moves the music off the cuts), never
      // after its band opens; on that very beat whenever it can be.
      if (at.back) assert.ok(Math.abs(at.back / beat - Math.round(at.back / beat)) < 0.01 && at.back <= at.open + 0.5, `${bpm} BPM, ${seconds} s: back at ${at.back}`);
      if (seconds >= 4) assert.ok(Math.abs(at.open / beat - Math.round(at.open / beat)) < 0.05 && at.back > 0, `${bpm} BPM, ${seconds} s: ${at.open} off its beat`);
      // Its decoding never slower than its original's by much (a half-beat pace on a slow Reel).
      assert.ok(at.lands - at.show <= (39 / 14.754) * 21.2 + 1, `${bpm} BPM, ${seconds} s: decoded in ${at.lands - at.show}`);
    }
  }
});
