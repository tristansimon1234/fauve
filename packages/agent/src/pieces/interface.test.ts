import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceMusicShape, pieceTestPlan, readPieceFill } from "../pieces.ts";
import { interfaceActs, interfaceEffect, listItems, paceBeat } from "./interface.ts";

// « Interface minimaliste », the effect of the bank (interface.ts): its own checks, beside the bank's (features.test.ts).

const run = (n: number, seconds: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: seconds / n, ...(i === 1 ? { photo: true } : {}) })),
  { file: "after", at: 2, seconds: 1.8 },
];
const ALL = {
  accroche: "un nouveau départ",
  liste: "tournage, émail, cuisson",
  etiquette: "ce que je fais",
  promesse: "des pièces qui durent",
  metier: "céramiste",
  compte: "@atelier.argile",
};
const marksOf = (texts: Record<string, string>) => Object.fromEntries(["k", "hook", "out", "list", "gone", "typed", "card", "pill"].map((k) => [k, Number(texts[k])]));

test("« Interface minimaliste » (effect v1): its acts over the shots it covers, her words in order, its click and its music on the beat", () => {
  const fill = { texts: ALL, objects: {}, settings: {} };
  const plan = pieceTestPlan({ piece: interfaceEffect, shots: run(3, 9), span: [1.2, 10.2], fill, bpm: 140 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // It covers her shots (a pale ground drawn): it cuts nothing out, follows nothing; her first shot under it in its round.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.texts!.mine, "1,2,3");
  assert.deepEqual(motion.fonts, ["Instrument Serif"]);
  for (const [slot, w] of Object.entries(ALL)) assert.equal(motion.texts![slot], w);
  // 9 s at 140 BPM: everything, in its order (her first words, her list, her typed promise, her card, the pill and her @).
  const at = marksOf(motion.texts!);
  assert.ok(at.hook! >= 0 && at.hook! < at.out! && at.out! < at.list! && at.list! < at.gone! && at.gone! < at.typed! && at.typed! < at.card! && at.card! < at.pill!, JSON.stringify(at));
  // A little faster or slower than its original at the Reel's tempo, never more.
  const K = 1800 / 140 / (1800 / 110.5);
  assert.ok(at.k! >= K * 0.8 - 0.001 && at.k! <= K * 1.1 + 0.001, `pace ${at.k}`);
  // Its sounds: a burst of key clicks while the caret types, a double click on « S'abonner », all within it.
  const [keys, click1, click2] = motion.sounds ?? [];
  assert.match(keys!.sound, /keyboard/);
  assert.ok(Math.abs(keys!.at * 30 - (at.typed! + Math.round(7 * at.k!))) <= 1);
  assert.equal(keys!.burst!.times.length, Math.ceil("despiècesquidurent".length / 2));
  assert.match(click1!.sound, /mouse/);
  const clickAt = (at.card! + Math.round(78 * at.k!)) / 30;
  assert.ok(Math.abs((click1!.at + click2!.at) / 2 - clickAt) < 0.01 && click2!.at - click1!.at < 0.1);
  assert.ok(click2!.at < 9 - 0.05);
  // Its music softer from the cut, opened on a whole beat of the Reel just before its icon lands.
  const shape = pieceMusicShape({ piece: interfaceEffect, fill, plan, layer: plan.layers![0]!, bpm: 140 })!;
  const filter = shape.filters![0]!;
  assert.equal(filter.kind, "soft");
  assert.equal(filter.db, -10);
  assert.equal(filter.from, 1.2);
  const beats = (filter.to - 1.2) / (60 / 140);
  assert.ok(Math.abs(beats - Math.round(beats)) < 0.01, `opens on beat ${beats}`);
  assert.ok(filter.to < 1.2 + at.card! / 30 && 1.2 + at.card! / 30 - filter.to < 0.2);
  // Its colour on her word only (the original's blue by default).
  assert.equal(motion.texts!.couleur, undefined);
  assert.deepEqual(readPieceFill(interfaceEffect, { fits: true, missing: "", texts: [{ slot: "promesse", text: "des pièces qui durent" }], objects: [], settings: [{ name: "couleur", value: "sienne" }] })!.settings, { couleur: "sienne" });
});

test("« Interface minimaliste »: the shorter its span, the less it shows, never less than her typed promise and its click", () => {
  assert.equal(listItems("tournage, émail · cuisson"), 3);
  // Her promise alone (its only required word): her typed promise and her card.
  const alone = pieceTestPlan({ piece: interfaceEffect, shots: run(2, 5), span: [1.2, 6.2], fill: { texts: { promesse: "des coupes qui vous ressemblent" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(alone).success);
  const one = marksOf(alone.layers![0]!.motion.texts!);
  assert.deepEqual([one.hook, one.list, one.pill, one.typed], [-1, -1, -1, 0]);
  for (const bpm of [60, 80, 100, 120, 140]) {
    const beat = 1800 / bpm;
    let shown = 0;
    for (const seconds of [4, 5, 6, 7, 8, 9, 10]) {
      const frames = Math.round(seconds * 30);
      const acts = interfaceActs({ frames, bpm, words: ALL });
      const { marks: at, variant: v } = acts;
      const label = `${bpm} BPM, ${seconds} s`;
      // It ends within its span, its click and « Abonné(e) » always in it.
      assert.ok(acts.end <= frames && at.card! + Math.round(100 * at.k!) <= frames, label);
      // Its music opens on a whole beat of the Reel, its icon landing just after (its original's 4,3 images).
      assert.ok(Math.abs(acts.opens / beat - Math.round(acts.opens / beat)) < 0.01 && at.card! - acts.opens >= 0 && at.card! - acts.opens <= 4.3 * at.k! + 1, label);
      // Her promise whole long enough to be read on a phone before the icon swallows it (4 words: 2 s, 85 % of it).
      assert.ok(at.card! + Math.round(10 * at.k!) - (acts.type + 1) >= 0.85 * 2 * 30 - 1, label);
      // From 5 s on (its shortest), never much faster than its original: 0,8 times its own pace at the least (or its pace
      // on the Reel's beats, half-beats on a slow one, when that one is faster).
      if (seconds >= 5) assert.ok(at.k! >= Math.min(1, paceBeat(bpm, 1800 / 110.5) / (1800 / 110.5)) * 0.8 - 0.01, `${label}: pace ${at.k}`);
      const now = (v.hook ? 1 : 0) + (v.list ? 1 : 0) + (v.long ? 1 : 0);
      if (seconds >= 8) assert.ok(now >= 1, `${label}: ${JSON.stringify(v)}`);
      shown = Math.max(shown, now);
    }
    assert.ok(shown >= 2, `${bpm} BPM: at 10 s, more than her promise and her card`);
  }
});
