import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { pieceMusicShape, pieceTestPlan } from "../pieces.ts";
import { editPlanSchema } from "../schemas.ts";
import { facade, facadeLandings } from "./facade.ts";

// « Façade qui se construit », the effect of the bank (facade.ts): its own checks, beside the bank's (features.test.ts).

/** Her front under it (a lead shot before, her next shot after), the effect over her front from its first image. */
function frontPlan(seconds: number, bpm: number, fill: { texts?: Record<string, string>; objects?: Record<string, string>; settings?: Record<string, string> } = {}) {
  const shots = [
    { file: "lead", at: 1, seconds: 1.2 },
    { file: "front", at: 0.5, seconds },
    { file: "after", at: 2, seconds: 1.8 },
  ];
  return pieceTestPlan({ piece: facade, shots, span: [1.2, 1.2 + seconds], fill: { texts: fill.texts ?? {}, objects: fill.objects ?? {}, settings: fill.settings ?? {} }, bpm });
}

test("« Façade qui se construit » (effect v2): its layer over her front, her front's elements and her sign named for that shot only", () => {
  const plan = frontPlan(6, 100, { objects: { morceaux: "every window", enseigne: "shop sign" }, settings: { format: "horizontal" } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // Both followed on her front, the second of her shots, never elsewhere.
  assert.deepEqual(motion.drawn, { shots: 3, objects: [{ shot: 1, name: "every window" }, { shot: 1, name: "shop sign" }] });
  assert.ok(motion.code!.includes('SubjectParts(shot, f0, laid, "every window", 0)'));
  assert.ok(motion.code!.includes('SubjectBox(shot, f0, laid, "shop sign")'));
  assert.equal(motion.texts!.format, "horizontal");
  // Nothing named: its code reads nothing and cuts her front in regular rectangles.
  assert.equal(frontPlan(6, 100).layers![0]!.motion.drawn, undefined);
  assert.deepEqual(checkMotionCode(facade.code), []);
  // A piece lands at once and never moves: nothing is animated between two landings, never a zoom.
  assert.doesNotMatch(facade.code, /interpolate\(|spring\(|scale\(/);
});

test("« Façade qui se construit »: its 19 pieces in order, four slow ones, a burst, three big ones on the beat, her front whole a second at least", () => {
  for (const bpm of [60, 82, 100, 120, 140]) {
    // Every length it is laid over: its own, and down to the 0,8 of its shortest the chain still plays.
    for (const seconds of [facade.seconds[0] * 0.8, facade.seconds[0], 6, 7, facade.seconds[1]]) {
      const frames = Math.round(seconds * 30);
      const at = facadeLandings(frames, bpm);
      assert.equal(at.length, 19);
      assert.equal(at[0], 1, "her sign on its first image, after one of black");
      for (let i = 1; i < 19; i++) assert.ok(at[i]! > at[i - 1]!, `${bpm} BPM ${seconds} s: piece ${i} after the one before (${at.join(",")})`);
      // Its slow ones far slower than its burst; its big ones a beat, half or a quarter apart, on the beat grid.
      const beat = (60 / bpm) * 30;
      const burst = (at[15]! - at[4]!) / 11;
      assert.ok(burst <= 6, `${bpm} BPM ${seconds} s: a burst, one every 6 images at most`);
      // (Its first one a frame shorter: her sign lands on its second image, after one of black, the next ones on the grid.)
      for (let i = 1; i < 4; i++) assert.ok(at[i]! - at[i - 1]! >= Math.max(6, 1.5 * burst) - (i === 1 ? 1 : 0), `${bpm} BPM ${seconds} s: slow note ${i} (${at.slice(0, 4).join(",")})`);
      const step = at[17]! - at[16]!;
      assert.ok([beat, beat / 2, beat / 4].some((b) => Math.abs(step - b) <= 1), `${bpm} BPM ${seconds} s: its big ones a beat, half or a quarter apart (${step})`);
      const q = beat / 4;
      assert.ok(Math.abs(at[16]! - Math.round(at[16]! / q) * q) <= 0.6, `${bpm} BPM ${seconds} s: its first big one on the beat grid`);
      assert.ok(frames - at[18]! >= 30, `${bpm} BPM ${seconds} s: her front whole ${frames - at[18]!} frames`);
    }
  }
  // At the original's tempo and length, its pieces land on the original's images, give or take a few.
  const original = [1, 25, 53, 80, 85, 90, 94, 97, 100, 104, 109, 114, 118, 124, 128, 132, 162, 179, 194];
  const at = facadeLandings(270, 120);
  at.forEach((f, i) => assert.ok(Math.abs(f - original[i]!) <= 10, `piece ${i}: ${f}, the original's ${original[i]}`));
  // A span far too short still gives 19 landings inside it (the chain never lays it there; its tests do).
  assert.ok(facadeLandings(18, 100).every((f) => f >= 1 && f < 18));
});

test("« Façade qui se construit »: its marks, its sixteen notes inside its span, its optional words", () => {
  const plan = frontPlan(6, 100, { texts: { nom: "Farine", ligne: "boulangerie · belleville" } });
  const motion = plan.layers![0]!.motion;
  const at = facadeLandings(180, 100);
  at.forEach((f, i) => assert.equal(Number(motion.texts![`piece_${i}`]), f));
  assert.equal(motion.texts!.beat, "18");
  assert.equal(motion.texts!.nom, "Farine");
  assert.equal(motion.texts!.ligne, "boulangerie · belleville");
  // A note on each of its slow pieces and a pluck on each of its burst, at the image it lands, all inside its span.
  const sounds = motion.sounds!;
  assert.equal(sounds.length, 16);
  assert.ok(sounds.every((s) => s.skill && s.at >= 0 && s.at < 6));
  assert.deepEqual(
    sounds.map((s) => Math.round(s.at * 30)),
    at.slice(0, 16),
  );
  assert.match(sounds[0]!.sound, /low soft harp note/);
  assert.match(sounds[15]!.sound, /high harp pluck/);
  // Its plucks louder as they climb, as the original's arpeggio.
  assert.ok(sounds[4]!.gain! < sounds[14]!.gain!);
  // Its words left out: none written (both are optional).
  const bare = frontPlan(6, 100).layers![0]!.motion;
  assert.equal(bare.texts!.nom, undefined);
  assert.equal(bare.texts!.ligne, undefined);
});

test("« Façade qui se construit » (effect v2): her music silent while her front builds, in on its first big piece on a whole beat", () => {
  for (const bpm of [70, 90, 100, 120, 128, 140])
    for (const seconds of [5, 6, 7.5, 9]) {
      const frames = Math.round(seconds * 30);
      const at = facadeLandings(frames, bpm);
      const line = facade.timeline!({ frames, bpm, shots: [{ from: 0, frames }], words: {}, settings: {} });
      const beat = (60 / bpm) * 30;
      const where = `${bpm} BPM, ${seconds} s`;
      const pause = line.music?.pauses?.[0];
      assert.ok(pause, where);
      assert.equal(pause.from, 0, where);
      const back = pause.to * 30;
      assert.ok(Math.abs(back / beat - Math.round(back / beat)) * beat < 0.6, `${where}: back on a beat (${back})`);
      assert.ok(at.slice(16).some((f) => Math.abs(f - back) < 0.05) || (back <= at[16]! && back > at[15]!), `${where}: ${back} on a big piece (${at.slice(16)})`);
      // On its first big piece when it falls on a beat.
      if (Math.abs(at[16]! / beat - Math.round(at[16]! / beat)) * beat <= 0.6) assert.ok(Math.abs(back - at[16]!) < 0.05, `${where}: ${back}`);
    }
  // On the Reel's clock: from the start of its span to its first big piece (here on the beat).
  const plan = frontPlan(6, 100);
  const shape = pieceMusicShape({ piece: facade, fill: { texts: {}, objects: {}, settings: {} }, plan, layer: plan.layers![0]!, bpm: 100 })!;
  const layer = plan.layers![0]!;
  assert.deepEqual(shape.pauses, [{ from: layer.from, to: Math.round((layer.from + facadeLandings(180, 100)[16]! / 30) * 1000) / 1000 }]);
});
