import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { pieceMusicShape, pieceTestPlan } from "../pieces.ts";
import { editPlanSchema } from "../schemas.ts";
import { quatreCoins, quatreCoinsLandings, quatreCoinsPieces } from "./quatre-coins.ts";

// « Mots aux quatre coins », the effect of the bank (quatre-coins.ts): its own checks, beside the bank's (features.test.ts).

const WORDS = { debut: "un matin chez", nom: "Farine", lieu: "belleville", adresse: "12 rue des Envierges" };

/** Her place under it (a lead shot before, her next shot after), the effect over her place from its first image. */
function placePlan(seconds: number, bpm: number, texts: Record<string, string> = WORDS, settings: Record<string, string> = {}) {
  const shots = [
    { file: "lead", at: 1, seconds: 1.2 },
    { file: "place", at: 0.5, seconds },
    { file: "after", at: 2, seconds: 1.8 },
  ];
  return pieceTestPlan({ piece: quatreCoins, shots, span: [1.2, 1.2 + seconds], fill: { texts, objects: {}, settings }, bpm });
}

test("« Mots aux quatre coins » (effect v2): its layer over her place, its words and their landings, nothing cut out", () => {
  // The original's opening: 5,5 s at its 92 BPM.
  const plan = placePlan(5.5, 92);
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // It draws none of her shots cut out and follows nothing: it only lays words (and her shot in a band when she is in width).
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined, "the original has no sound effect");
  assert.deepEqual(checkMotionCode(quatreCoins.code), []);
  // Its six pieces in reading order, each on its mark: the original's grid at its tempo (beats 0,75, 1,25, 2, 2,75, 3,5, 4,25).
  assert.deepEqual(quatreCoinsPieces(WORDS), ["top0", "top1", "top2", "nom", "lieu", "adresse"]);
  const beat = (60 / 92) * 30;
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((k) => Number(motion.texts![`t${k}`])),
    [0.75, 1.25, 2, 2.75, 3.5, 4.25].map((b) => Math.round(b * beat)),
  );
  assert.equal(motion.texts!.nom, "Farine");
  // Nothing moves when a word lands, and no word fades: each one is cut in.
  assert.doesNotMatch(quatreCoins.code, /interpolate\(|spring\(/);
  // Her music holds its breath (its bass and kick out) half a beat after her sentence is whole, to the cut.
  const shape = pieceMusicShape({ piece: quatreCoins, fill: { texts: WORDS, objects: {}, settings: {} }, plan, layer: plan.layers![0]!, bpm: 92 })!;
  const layer = plan.layers![0]!;
  assert.deepEqual(shape.filters!.map((f) => [f.kind, f.to]), [["thin", layer.to]]);
  assert.ok(Math.abs(shape.filters![0]!.from - (layer.from + (Math.round(4.25 * beat) + beat / 2) / 30)) < 0.002, String(shape.filters![0]!.from));
});

test("« Mots aux quatre coins »: its words tighter on its beats when its span is short, the sentence always read whole before the cut", () => {
  for (const bpm of [60, 82, 92, 100, 120, 140]) {
    const beat = (60 / bpm) * 30;
    for (const seconds of [quatreCoins.seconds[0] * 0.8, quatreCoins.seconds[0], 5, 6, quatreCoins.seconds[1]]) {
      const frames = Math.round(seconds * 30);
      for (const count of [3, 4, 6]) {
        const at = quatreCoinsLandings(frames, bpm, count);
        assert.equal(at.length, count);
        assert.ok(at[0]! >= 1, "her place alone a moment before the first word");
        for (let k = 1; k < count; k++) assert.ok(at[k]! > at[k - 1]!, `${bpm} BPM ${seconds} s: word ${k} after the one before (${at.join(",")})`);
        // On the beat grid (quarter beats) in its span, and at least 1,6 s of the whole sentence before the cut.
        for (const f of at) assert.ok(Math.abs(f - Math.round(f / (beat / 4)) * (beat / 4)) <= 0.6, `${bpm} BPM ${seconds} s: ${f} on the grid`);
        assert.ok(frames - at.at(-1)! >= 48, `${bpm} BPM ${seconds} s, ${count} words: the sentence whole ${frames - at.at(-1)!} frames`);
      }
    }
  }
  // At the original's tempo and length (5,5 s), its words land on the original's beats: its images (20, 30, 46, 61, 75,
  // 89) less its music's lead of 0,3 beat (the effect starts on a cut, on the Reel's beat), give or take two.
  const original = [20, 30, 46, 61, 75, 89];
  const lead = 0.3 * ((60 / 92) * 30);
  quatreCoinsLandings(166, 92, 6).forEach((f, k) => assert.ok(Math.abs(f - (original[k]! - lead)) <= 2, `word ${k}: ${f}`));
  // Far too short: its words still land inside it, in order.
  const tiny = quatreCoinsLandings(18, 100, 6);
  assert.ok(tiny.every((f) => f >= 1 && f < 18));
});

test("« Mots aux quatre coins »: its optional words left out, its first words cut in three at most, its format", () => {
  // Without her place nor a bottom line: four pieces, the middle row her name alone.
  const short = { debut: "un samedi au", nom: "Comptoir" };
  assert.deepEqual(quatreCoinsPieces(short), ["top0", "top1", "top2", "nom"]);
  const motion = placePlan(4, 100, short).layers![0]!.motion;
  assert.equal(motion.texts!.lieu, undefined);
  assert.equal(motion.texts!.adresse, undefined);
  assert.equal(motion.texts!.t4, undefined);
  // Four first words: the third piece takes the rest of them; two: left and right.
  assert.deepEqual(quatreCoinsPieces({ debut: "un beau matin chez", nom: "Lino" }), ["top0", "top1", "top2", "nom"]);
  assert.deepEqual(quatreCoinsPieces({ debut: "chez", nom: "Lino", adresse: "ouvert dès 8 h" }), ["top0", "nom", "adresse"]);
  // Its format, a setting her words may ask for.
  assert.equal(placePlan(5, 92, WORDS, { format: "horizontal" }).layers![0]!.motion.texts!.format, "horizontal");
  // Vertical full frame by default (Tristan, 6 November: « tout vertical please »), as its model; its band on her word.
  assert.deepEqual(quatreCoins.settings![0]!.choices.map((c) => c.value), ["vertical", "horizontal", "auto"]);
  assert.equal(quatreCoins.settings![0]!.choices.find((c) => c.band)?.value, "horizontal");
});
