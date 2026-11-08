import assert from "node:assert/strict";
import { test } from "node:test";
import { composedShots, composedShotsMoved, namesShotsByIndex, sameComposedShots, withoutStaleComposition } from "./compose.ts";
import { asksCreation } from "./house-pick.ts";
import { buildReelProps } from "./motion.ts";
import { asksCameraMove } from "./motion-scene.ts";
import { exchangeLines, herWordsFor } from "./request-log.ts";
import { editPlanSchema, type EditPlan } from "./schemas.ts";
import { objectKey, objectPassages, onLaidShot } from "./subject.ts";
import { toolSpecs } from "./tools.ts";
import { slowPush } from "../../../apps/render/src/push.ts";

// « Novembre, version cocon » (8 November): « Sois créatif », Edith asked « refaire ou nouveau », she chose « Refaire
// Novembre », and a correction re-cut the Reel from 3 shots into 5 (street ×2, candle ×2, living room) while the
// composition written for the 3 shots was kept: its « table lamp » of shots[2] was found in the candle and painted flat
// yellow over it and over « Ce soir, on reste au chaud ». Tristan: « à mon avis la tâche est un effet mal appliqué ».

const STREET = "190b58f7-87ce-48b8-a6fd-03bb51d1e4ed";
const CANDLE = "edaeb6f0-c468-46eb-be12-8e98229551d1";
const ROOM = "9b021554-9be2-4311-9d9c-c01f6f57a497";
const LAMP_CODE = `function Scene({ shots, frame }) { const parts = SubjectParts(shots[2], frame, laid, 'table lamp', 4); const breath = LightUnder(shots[1], frame, laid, null); return h(Subject, { shot: 2, object: 'table lamp', fill: '#ffc56e' }); }`;

const base = {
  format: "9:16",
  template: "libre",
  texts: [],
  images: [],
  transitions: "cut",
  subtitles: false,
  music: null,
} as const;

/** Version 2: three still shots, the composition written for them. */
const v2: EditPlan = editPlanSchema.parse({
  ...base,
  duration: 12.3,
  segments: [
    { clip_id: STREET, in: 0, out: 4.33, zoom: "none" },
    { clip_id: CANDLE, in: 5.5, out: 8.4, zoom: "none" },
    { clip_id: ROOM, in: 0, out: 5.07, zoom: "none" },
  ],
  layers: [{ from: 0, to: 12.3, compose: true, motion: { brief: "Whole Reel, a cosy November evening told only with light", code: LAMP_CODE, js: LAMP_CODE, draws_texts: true } }],
});

/** Version 3 as it went out: the same brief, the same code, over five shots (and an end card). */
const v3: EditPlan = editPlanSchema.parse({
  ...base,
  duration: 11.6,
  segments: [
    { clip_id: STREET, in: 0, out: 2.03, zoom: "none" },
    { clip_id: STREET, in: 6.8, out: 8.87, zoom: "none", move: "punch" },
    { clip_id: CANDLE, in: 5.5, out: 7.53, zoom: "none", move: "in" },
    { clip_id: CANDLE, in: 2, out: 2.7, zoom: "none", move: "punch" },
    { clip_id: ROOM, in: 0, out: 2.7, zoom: "none", move: "in" },
  ],
  layers: [{ from: 0, to: 11.6, compose: true, motion: { ...v2.layers![0]!.motion } }],
});

test("a composition's code fits only the shots it was written for", () => {
  assert.deepEqual(composedShots(v2), [STREET, CANDLE, ROOM]);
  assert.deepEqual(composedShots(v3), [STREET, STREET, CANDLE, CANDLE, ROOM]);
  // Re-cut into five shots: shots[2] is now the candle.
  assert.equal(sameComposedShots(v2, v3), false);
  // The same shots, trimmed: its code reads each one's moment and length, it still fits.
  const trimmed: EditPlan = { ...v2, segments: v2.segments.map((s) => ("clip_id" in s ? { ...s, out: s.out - 0.4 } : s)) };
  assert.equal(sameComposedShots(v2, trimmed), true);
  // Two shots swapped: each index shows another clip.
  const swapped: EditPlan = { ...v2, segments: [v2.segments[0]!, v2.segments[2]!, v2.segments[1]!] };
  assert.equal(sameComposedShots(v2, swapped), false);
  // No composition: nothing to fit.
  assert.equal(composedShots({ ...v2, layers: [] }), null);
});

test("a correction that re-cut the Reel has its composition written again, never the earlier code over the new shots", () => {
  // The case of 8 November: the earlier version's code, kept for its unchanged brief, is taken off (written again).
  const fixed = withoutStaleComposition(v3, v2);
  const layer = fixed.layers![0]!;
  assert.equal(layer.compose, true);
  assert.equal(layer.motion.js, undefined);
  assert.equal(layer.motion.code, undefined);
  assert.equal(layer.motion.brief, v2.layers![0]!.motion.brief);
  // Only trimmed: kept as it is (« pourquoi la correction refait tout, c'est une hérésie »).
  const trimmed: EditPlan = { ...v2, segments: v2.segments.map((s) => ("clip_id" in s ? { ...s, out: s.out - 0.4 } : s)) };
  assert.equal(withoutStaleComposition(trimmed, v2), trimmed);
  // Code written for this plan (not the earlier version's): kept.
  const fresh: EditPlan = { ...v3, layers: [{ ...v3.layers![0]!, motion: { ...v3.layers![0]!.motion, js: "function Scene() { return null; }" } }] };
  assert.equal(withoutStaleComposition(fresh, v2), fresh);
  // Code that says the shots it was written for: kept when they are these, taken off when they are not.
  const laid = (shots: string[]): EditPlan => ({ ...v3, layers: [{ ...v3.layers![0]!, motion: { ...v3.layers![0]!.motion, laid: shots } }] });
  assert.equal(withoutStaleComposition(laid([STREET, STREET, CANDLE, CANDLE, ROOM]), null).layers![0]!.motion.js, LAMP_CODE);
  assert.equal(withoutStaleComposition(laid([STREET, CANDLE, ROOM]), null).layers![0]!.motion.js, undefined);
  assert.equal(composedShotsMoved(v3, v2), true);
  assert.equal(composedShotsMoved(trimmed, v2), false);
  // Code that only reads her shots as they come (a collage laying each one in turn): it lays any shots, kept as it is.
  const generic = "function Scene({ shots, frame }) { const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0); return h(Footage, { shot: cur }); }";
  const earlierGeneric: EditPlan = { ...v2, layers: [{ ...v2.layers![0]!, motion: { ...v2.layers![0]!.motion, js: generic } }] };
  const recutGeneric: EditPlan = { ...v3, layers: [{ ...v3.layers![0]!, motion: { ...v3.layers![0]!.motion, js: generic } }] };
  assert.equal(namesShotsByIndex(generic), false);
  assert.ok(namesShotsByIndex(LAMP_CODE));
  assert.ok(namesShotsByIndex(`<Footage shot={0} style={full} />`));
  assert.equal(composedShotsMoved(recutGeneric, earlierGeneric), false);
  assert.equal(withoutStaleComposition(recutGeneric, earlierGeneric), recutGeneric);
  // A model's composition (a montage skill) reads any number of shots: left alone.
  const skill: EditPlan = { ...v3, skill: { key: "petites-lumieres", version: 1 } };
  assert.equal(withoutStaleComposition(skill, v2), skill);
});

test("an object a composition names is looked for only on the shot its code was written for", () => {
  // Written for three shots: the lamp of shots[2] is the living room.
  const stamped = (plan: EditPlan, shots: string[]): EditPlan => ({ ...plan, layers: [{ ...plan.layers![0]!, motion: { ...plan.layers![0]!.motion, laid: shots } }] });
  const right = objectPassages(stamped(v2, [STREET, CANDLE, ROOM]), () => true);
  assert.deepEqual(right.map((p) => [p.clip_id, p.name]), [[ROOM, "table lamp"]]);
  // The same code over the re-cut Reel: never looked for in the candle.
  assert.deepEqual(objectPassages(stamped(v3, [STREET, CANDLE, ROOM]), () => true), []);
  // Without `laid` (a composition written before it was kept): as before.
  assert.deepEqual(objectPassages(v3, () => true).map((p) => p.clip_id), [CANDLE]);
  assert.equal(onLaidShot({ motion: { brief: "x", laid: [STREET, CANDLE, ROOM] } }, 2, ROOM), true);
  assert.equal(onLaidShot({ motion: { brief: "x", laid: [STREET, CANDLE, ROOM] } }, 2, CANDLE), false);
  assert.equal(onLaidShot({ motion: { brief: "x" } }, 2, CANDLE), true);

  // At the render: a reading found earlier on that passage is not given to a shot the code was not written for.
  const candleLamp = objectKey(CANDLE, 5.5, 7.53, "table lamp");
  const inputs = {
    template: "libre" as const,
    clipUrls: { [STREET]: "https://x/s.mp4", [CANDLE]: "https://x/c.mp4", [ROOM]: "https://x/r.mp4" },
    brand: { name: "Studio" },
    subjects: { [candleLamp]: { src: "https://x/lamp.webm", boxes: [[0.083, 0.182, 0.833, 0.535]] } },
  };
  const shotsOf = (plan: EditPlan) => buildReelProps(plan, inputs).layers?.[0]?.shots ?? [];
  assert.ok(shotsOf(v3)[2]?.objects?.["table lamp"]);
  assert.equal(shotsOf(stamped(v3, [STREET, CANDLE, ROOM]))[2]?.objects, undefined);
});

test("« Sois créatif » read in her own words for this Reel, never in Edith's", () => {
  const rows = [
    { direction: "inbound" as const, type: "text", body: "Sois créatif", created_at: "2026-11-08T10:42:54Z" },
    { direction: "outbound" as const, type: "text", body: "Tu veux que je refasse « Novembre, version cocon » de façon plus créative, ou un tout nouveau Reel ?", created_at: "2026-11-08T10:43:06Z" },
    { direction: "inbound" as const, type: "interactive", body: "Refaire Novembre", created_at: "2026-11-08T10:44:45Z" },
  ];
  const hers = herWordsFor(exchangeLines(rows));
  assert.equal(hers, "Sois créatif\nRefaire Novembre");
  assert.ok(asksCreation(hers));
  // Edith's words alone never route it.
  assert.equal(herWordsFor(exchangeLines([rows[1]!])), "");
  // Her intent in other words is Edith's to read (montage refaire): the field is there, said in one short line.
  const field = toolSpecs.montage.input.shape.refaire;
  assert.ok(field);
  assert.ok((field.description ?? "").length < 220);
});

test("a slow push laid on a whole shot is seen, a punch or an opening that settles is not", () => {
  const ramp = (from: number, to: number, n = 20, length = 60) => Array.from({ length: n }, (_, i) => ({ frame: Math.round((i * (length - 1)) / (n - 1)), scale: from + ((to - from) * i) / (n - 1) }));
  // 100 % to 108 % over the whole shot: a slow push.
  assert.ok(slowPush(ramp(1, 1.08), 60));
  // Its pull out too.
  assert.ok(slowPush(ramp(1.08, 1), 60));
  // Held still, or 1 % only: not a move.
  assert.equal(slowPush(ramp(1, 1), 60), null);
  assert.equal(slowPush(ramp(1, 1.01), 60), null);
  // A punch: a jump in size, held.
  const punch = [...ramp(1, 1, 10), ...ramp(1.15, 1.15, 10).map((s) => ({ ...s, frame: s.frame + 40 }))];
  assert.equal(slowPush(punch, 100), null);
  // An opening that grows then settles on a short part of the shot only.
  assert.equal(slowPush(ramp(1, 1.08, 6, 15), 90), null);
  // A print or a panel (her shot drawn small) that grows: a design, not a push.
  assert.equal(slowPush(ramp(0.4, 0.45), 60), null);
});

test("a camera move is hers only when her own words ask for one", () => {
  assert.equal(asksCameraMove("Sois créatif\nRefaire Novembre"), false);
  assert.ok(asksCameraMove("un zoom lent sur la vitrine"));
  assert.ok(asksCameraMove("Mets plus de mouvement"));
  assert.ok(asksCameraMove("un petit travelling sur le comptoir"));
  assert.equal(asksCameraMove("Fais un Reel sur le cours du mardi"), false);
});
