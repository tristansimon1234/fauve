import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { subjectsDrawn } from "../subject.ts";
import { celuiLa, celuiLaMoments } from "./celui-la.ts";

// « Et… celui-là ! », the effect of the bank (celui-la.ts): its own checks, beside the bank's (features.test.ts).

/** Her products as the chain cuts them under it at 100 BPM (0,6 s each), her series 2,4 s, between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "p1", at: 0.5, seconds: 0.6 },
  { file: "p2", at: 0.5, seconds: 0.6 },
  { file: "p3", at: 0.5, seconds: 0.6 },
  { file: "p4", at: 0.5, seconds: 0.6 },
  { file: "series", at: 1, seconds: 2.4 },
  { file: "after", at: 2, seconds: 1.8 },
];
const words = { celui: "Celle-là", et: "Eeeeet…", fin: "Tout ça !" };

test("« Et… celui-là ! » (effect v1): its layer over her products and her series, its last word on a whole beat, the music holding its breath", () => {
  const plan = pieceTestPlan({ piece: celuiLa, shots, span: [1.2, 6.0], fill: { texts: words, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3, 4, 5]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "celui-la", version: 1 });
  // Its series cut 2,4 s in (72 images), its last word on a whole beat (a beat: 18 images), the nearest to 2,5 beats after
  // the cut that leaves a second of it before its end (image 108, six beats in).
  assert.deepEqual(motion.texts, { beat: "18", last_cut: "72", and_from: "74", and_typed: "86", and_out: "100", and_gone: "104", last: "108", mine: "1,2,3,4,5", celui: "Celle-là", et: "Eeeeet…", fin: "Tout ça !" });
  assert.equal(Number(motion.texts!.last) % 18, 0);
  // Nothing cut out, nothing followed, no sound of its own.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  // The music stopped just after her series' cut, its hit ringing, back on her last word: on the Reel's clock, within its span.
  const shape = pieceMusicShape({ piece: celuiLa, fill: { texts: words, objects: {}, settings: {} }, plan, layer, bpm: 100 });
  assert.equal(shape?.pauses?.length, 1);
  const pause = shape!.pauses![0]!;
  assert.ok(Math.abs(pause.from - (1.2 + (72 + 4.5) / 30)) < 0.002 && Math.abs(pause.to - (1.2 + 108 / 30)) < 0.002, JSON.stringify(pause));
  assert.ok(pause.tail! > 0.4 && pause.tail! <= pause.to - pause.from);
  // Its code: plain JS of the scope, under 24 000 characters, no zoom, no cut-out.
  assert.deepEqual(checkMotionCode(celuiLa.code), []);
  assert.deepEqual(subjectsDrawn(celuiLa.code), []);
  assert.doesNotMatch(celuiLa.code, /transform|scale\(/);
});

test("« Et… celui-là ! »: its moments on a short series and a long one, a second of its last word at least", () => {
  // The original's: a series of four beats, its last word 2,5 beats in, on a whole beat from the start.
  const long = celuiLaMoments(200, 18.65, 112);
  assert.ok(Math.abs(long.last - 112 - 2.5 * 18.65) <= 18.65 / 2 + 0.5 && Math.abs((long.last / 18.65) % 1) < 0.03, JSON.stringify(long));
  assert.ok(long.andFrom < long.andTyped && long.andTyped < long.andOut && long.andOut < long.andGone && long.andGone <= long.last);
  // A short series: its last word still a second before the end, its hesitation squeezed before it.
  const short = celuiLaMoments(120, 18, 72);
  assert.ok(short.last <= 90 && short.last >= 72 + 12, JSON.stringify(short));
  assert.ok(short.andGone <= short.last && short.andTyped > short.andFrom);
  // No series to speak of: no pause of the music.
  const tight = celuiLa.timeline!({ frames: 60, bpm: 100, shots: [{ from: 0, frames: 18 }, { from: 18, frames: 18 }, { from: 36, frames: 24 }], words, settings: {} });
  assert.equal(tight.music, undefined);
});

test("« Et… celui-là ! »: its words, the pointing word and the hesitation required, its last word optional, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "celui", text: "Celle-là" }, { slot: "et", text: "Eeeet… et voilà" }, { slot: "fin", text: "" }], objects: [], settings: [] };
  const read = readPieceFill(celuiLa, answer)!;
  assert.equal(read.texts.celui, "Celle-là");
  assert.equal(read.texts.et, "Eeeet… et");
  assert.equal(read.texts.fin, undefined);
  assert.equal(readPieceFill(celuiLa, { ...answer, texts: [{ slot: "et", text: "Eeet…" }] }), null);
});

test("« Et… celui-là ! » is offered on her products seen close, never on a Reel of wide shots only", () => {
  const clip = (framing: "wide" | "medium" | "close" | "detail") =>
    ({
      duration: 6,
      orientation: "portrait",
      summary: "un gâteau posé sur une table",
      setting: "intérieur, une pâtisserie",
      lighting: "good",
      shots: [{ start: 0, end: 6, description: "un gâteau", subject: "gâteau", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera: "static", subject_box: [300, 300, 700, 700], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([celuiLa], pieceShots([{ media_id: "a", analysis: clip("close") }], {}), 4).map((p) => p.key), ["celui-la"]);
  assert.deepEqual(piecesOffered([celuiLa], pieceShots([{ media_id: "a", analysis: clip("wide") }], {}), 4), []);
  assert.deepEqual(piecesOffered([celuiLa], pieceShots([{ media_id: "a", analysis: clip("close") }], {}), 3), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number; opacity?: number };

/** What its Scene draws at a frame, with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, options: { texts?: Record<string, string>; light?: number | null } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    useCurrentFrame: () => frame,
    interpolate: (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1))),
    LightUnder: () => (options.light === undefined || options.light === null ? null : { mean: options.light, high: options.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${celuiLa.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  // Its five shots: four products of a beat (18 images), its series of 72; one before it.
  const list = [{ from: -36, durationInFrames: 36, kind: "video", aspect: 0.5625 }, ...[0, 18, 36, 54].map((from) => ({ from, durationInFrames: 18, kind: "video", aspect: 0.5625 })), { from: 72, durationInFrames: 72, kind: "video", aspect: 0.5625 }];
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: 144,
    brand: { name: "Atelier Terre", displayFont: "Instrument Serif", bodyFont: "Inter Tight", accent: "#8a3b2a", palette: {} },
    shots: list,
    texts: { beat: "18", mine: "1,2,3,4,5", last_cut: "72", and_from: "74", and_typed: "90", and_out: "113", and_gone: "118", last: "126", ...words, ...options.texts },
  });
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const textOf = (node: unknown): string => {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return (node as Drawn).children.map(textOf).join("");
};
const wordsAt = (tree: Drawn) =>
  flatten(tree)
    .filter((n) => n.type === "FitText")
    .map((n) => ({ text: textOf(n).replace(/ /g, " "), box: n.props.style as Box, type: n.props.innerStyle as Record<string, string | number> }));
/** Where a word itself sits: pushed back into the zone, it keeps to that side of its box (about 0,4 em a letter). */
const anchor = (w: { text: string; box: Box; type: Record<string, string | number> }): [number, number] => {
  const wide = Math.min(w.box.width, w.text.length * Number(w.type.fontSize) * 0.4);
  const x = w.type.alignItems === "flex-start" ? w.box.left + wide / 2 : w.type.alignItems === "flex-end" ? w.box.left + w.box.width - wide / 2 : w.box.left + w.box.width / 2;
  return [x, w.box.top + w.box.height / 2];
};
const inZone = (box: Box, label: string) => {
  const bottom = box.top + box.height;
  assert.ok(box.top >= 80 && bottom <= 1440, `${label}: ${JSON.stringify(box)}`);
  if (bottom > 960) assert.ok(box.left >= 140 && box.left + box.width <= 940, `${label}: ${JSON.stringify(box)}`);
  else assert.ok(box.left >= 40 && box.left + box.width <= 1040, `${label}: ${JSON.stringify(box)}`);
};

test("« Et… celui-là ! » draws its pointing word at once on each product, elsewhere each time, then her hesitation and her last word", () => {
  const places = [0, 18, 36, 54].map((f) => {
    const w = wordsAt(drawAt(f + 3));
    assert.equal(w.length, 1);
    assert.equal(w[0]!.text, "Celle-là");
    inZone(w[0]!.box, `product at ${f}`);
    // The same box all along its shot: no grow, no move.
    assert.deepEqual(wordsAt(drawAt(f + 15))[0]!.box, w[0]!.box);
    return anchor(w[0]!);
  });
  for (let i = 1; i < places.length; i++) assert.ok(Math.hypot(places[i]![0] - places[i - 1]![0], places[i]![1] - places[i - 1]![1]) > 150, `${places[i - 1]} → ${places[i]}`);
  // Her series: the pointing word gone, her hesitation typed from its left edge, held, faded; nothing; her last word.
  assert.equal(wordsAt(drawAt(73)).length, 0);
  const and = wordsAt(drawAt(80))[0]!;
  assert.equal(and.text, "Eeeeet…");
  assert.equal(and.box.left, 153);
  assert.equal(and.type.alignItems, "flex-start");
  assert.ok(wordsAt(drawAt(116))[0]!.box.opacity! < 1);
  assert.equal(wordsAt(drawAt(120)).length, 0);
  const last = wordsAt(drawAt(140))[0]!;
  assert.equal(last.text, "Tout ça !");
  assert.ok(Math.abs(anchor(last)[0] - 540) <= 1);
  inZone(last.box, "last word");
  // Without her last word: her pointing word with « ! ».
  assert.equal(wordsAt(drawAt(140, { texts: { fin: "" } }))[0]!.text, "Celle-là !");
  // Its ink: the cream on a dark picture, the deep ink on a bright one, each with its thin edge; unread, the cream with a
  // firmer edge (still tight).
  assert.equal(wordsAt(drawAt(5))[0]!.type.color, "#fffcc0");
  assert.match(String(wordsAt(drawAt(5))[0]!.type.textShadow), /^0 0 2px rgba\(38,30,18,0\.8\)/);
  assert.equal(wordsAt(drawAt(5, { light: 0.25 }))[0]!.type.color, "#fffcc0");
  assert.match(String(wordsAt(drawAt(5, { light: 0.25 }))[0]!.type.textShadow), /^0 0 1px rgba\(38,30,18,0\.62\)/);
  assert.equal(wordsAt(drawAt(5, { light: 0.82 }))[0]!.type.color, "#2b2118");
  assert.match(String(wordsAt(drawAt(5, { light: 0.82 }))[0]!.type.textShadow), /^0 0 1px rgba\(255,250,236/);
  // One size, the model's: 8,7 % of the height.
  assert.equal(wordsAt(drawAt(5))[0]!.type.fontSize, 167);
});
