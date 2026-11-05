import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan } from "../pieces.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { table, tableTimeline } from "./table.ts";

// « Photos posées sur la table », the effect of the bank (table.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** Its Scene at one frame with a stand-in scope (each tool a named node), the light under its words as given. */
function drawAt(frame: number, texts: Record<string, string>, options: { light?: number | null; table?: number; frames?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() }), Fragment: "Fragment" };
  const interpolate = (x: number, [a, b]: number[], [c, d]: number[]) => c! + (d! - c!) * Math.min(1, Math.max(0, (x - a!) / (b! - a! || 1)));
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    Footage: "Footage",
    LumaFade: "LumaFade",
    Handwriting: "Handwriting",
    useCurrentFrame: () => frame,
    interpolate,
    LightUnder: () => (options.light === undefined || options.light === null ? null : { mean: options.light, high: options.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${table.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const frames = options.frames ?? 144;
  const lead = options.table ?? 36;
  const shots = [
    { from: -36, durationInFrames: 36, kind: "video", aspect: 9 / 16 },
    { from: 0, durationInFrames: lead, kind: "video", aspect: 16 / 9 },
    ...Array.from({ length: 6 }, (_, k) => ({ from: lead + 18 * k, durationInFrames: 18, kind: "photo", aspect: 2 / 3 })),
    { from: frames, durationInFrames: 54, kind: "video", aspect: 9 / 16 },
  ];
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames: frames, brand: { bodyFont: "Inter Tight" }, shots, texts: { beat: "18", ...texts } });
}
const nodes = (n: unknown): Drawn[] => (n && typeof n === "object" && "children" in n ? [n as Drawn, ...(n as Drawn).children.flatMap(nodes)] : []);

test("« Photos posées sur la table » (effect v1): its layer on her table and her photos after it, her words, a click on each print", () => {
  const shots = [
    { file: "lead", at: 0.5, seconds: 1.2 },
    { file: "table", at: 1, seconds: 1.2 },
    ...Array.from({ length: 6 }, (_, k) => ({ file: `p${k}`, at: 0, seconds: 0.6, photo: true })),
    { file: "after", at: 2, seconds: 1.8 },
  ];
  const plan = pieceTestPlan({ piece: table, shots, span: [1.2, 6], fill: { texts: { gauche: "voici", droite: "Café Lune" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(checkMotionCode(table.code), []);
  const motion = plan.layers![0]!.motion;
  // Nothing of hers cut out nor followed; its hand's font.
  assert.equal(motion.drawn, undefined);
  assert.deepEqual(motion.fonts, ["Shadows Into Light"]);
  assert.equal(motion.texts!.gauche, "voici");
  assert.equal(motion.texts!.droite, "Café Lune");
  // Its words at 100 BPM half a beat in, its six prints laid from its 14th image half a beat apart (a span this long
  // lays them a little slower than the original's burst), the pile held a beat, its fade and its bare table; then it
  // ends on the next cut (its fifth beat), her photos after it full frame on their beats.
  const lands = Array.from({ length: 6 }, (_, k) => Number(motion.texts![`p${k}`]));
  assert.equal(Number(motion.texts!.words), 10);
  assert.deepEqual(lands, [14, 23, 32, 41, 50, 59]);
  assert.equal(Number(motion.texts!.end), 90);
  assert.equal(Number(motion.texts!.fade), 83);
  // A click on each print, within its span.
  assert.deepEqual(motion.sounds?.map((s) => [Math.round(s.at * 30), s.sound, s.gain]), lands.map((f, k) => [f, "light click", k % 2 ? -11 : -6]));
});

test("« Photos posées sur la table » (effect v1): its prints at the original's pace on a short span, slower on a long one, always before the fade", () => {
  // Its ten prints at 110 BPM: the original's images 13 to 38, within an image.
  const ten = tableTimeline({ frames: 72, bpm: 110, shots: Array.from({ length: 11 }, () => ({ from: 0, frames: 16 })), words: {}, settings: {} }).marks!;
  [13, 14, 16, 19, 21, 24, 28, 30, 33, 38].forEach((f, k) => assert.ok(Math.abs(ten[`p${k}`]! - f) <= 1, `print ${k + 1}: image ${ten[`p${k}`]}, the original's ${f}`));
  for (const [frames, bpm, prints] of [[48, 100, 3], [60, 140, 10], [90, 100, 6], [150, 100, 10], [150, 60, 3], [198, 100, 10]] as const) {
    const m = tableTimeline({ frames, bpm, shots: Array.from({ length: prints + 1 }, () => ({ from: 0, frames: 18 })), words: {}, settings: {} }).marks!;
    const lands = Array.from({ length: prints }, (_, k) => m[`p${k}`]!);
    lands.slice(1).forEach((f, k) => assert.ok(f > lands[k]!, `${frames} images, ${prints} prints at ${bpm} BPM: ${lands}`));
    assert.ok(lands[0]! > m.words! && lands.at(-1)! < m.fade!, `${frames} images: ${JSON.stringify(m)}`);
    assert.equal(m.fade, frames - 7);
    // Never more than half a beat apart (a few prints keep the original's burst as long as its ten: a little more).
    lands.slice(1).forEach((f, k) => assert.ok(f - lands[k]! <= Math.ceil((prints >= 6 ? 900 : 1800) / bpm), `${lands}`));
  }
  // Its shots cut a beat each: a long span ends on the first cut after its pile (its fade seven images before), never
  // before a beat's room is left.
  const cuts = (n: number) => [{ from: 0, frames: 36 }, ...Array.from({ length: n }, (_, k) => ({ from: 36 + 18 * k, frames: 18 }))];
  const long = tableTimeline({ frames: 216, bpm: 100, shots: cuts(10), words: {}, settings: {} }).marks!;
  assert.ok(long.end! < 216 && cuts(10).some((s) => s.from === long.end), JSON.stringify(long));
  assert.equal(long.fade, long.end! - 7);
  const short = tableTimeline({ frames: 90, bpm: 100, shots: cuts(3), words: {}, settings: {} }).marks!;
  assert.equal(short.end, 90);
});

test("« Photos posées sur la table » (effect v1): her table all along, her prints at once, still, turned; her words either side; the pile gone by its light", () => {
  const marks = { words: "10", fade: "137", p0: "14", p1: "28", p2: "41", p3: "55", p4: "68", p5: "82", gauche: "voici", droite: "Café Lune" };
  const at = (frame: number, options = {}) => nodes(drawAt(frame, marks, options));
  // Before its words: her table alone.
  const start = at(5);
  assert.ok(start.some((n) => n.type === "Footage" && n.props.shot === 1));
  assert.ok(!start.some((n) => n.type === "Handwriting"));
  // Her table's passage is shorter than the effect: slowed, never frozen (its frame read further at every image).
  const table1 = at(60).find((n) => n.type === "Footage" && n.props.shot === 1)!;
  const table2 = at(90).find((n) => n.type === "Footage" && n.props.shot === 1)!;
  assert.ok(typeof table1.props.at === "number" && table1.props.at !== table2.props.at);
  // As filmed at its own moment when its passage holds the whole effect.
  assert.equal(at(60, { table: 200 }).find((n) => n.type === "Footage" && n.props.shot === 1)!.props.at, undefined);
  // Its prints: the ones landed, each its photo held still, in a turned box at the centre.
  const pile = at(42);
  const prints = pile.filter((n) => n.type === "Footage" && Number(n.props.shot) >= 2);
  assert.deepEqual(prints.map((n) => n.props.shot), [2, 3, 4]);
  assert.ok(prints.every((n) => Number(n.props.at) > 144));
  assert.ok(pile.some((n) => n.type === "div" && /rotate\(-14\.9deg\)|rotate\(-9\.9deg\)/.test(String((n.props.style as Record<string, unknown>)?.transform ?? ""))));
  // Her words, on either side of the pile, cream on her table (no light read), a dark ink on a pale one.
  const hands = pile.filter((n) => n.type === "Handwriting");
  assert.equal(hands.length, 2);
  assert.ok(hands.every((n) => n.props.color === "#fff0d6"));
  assert.ok(at(42, { light: 0.82 }).filter((n) => n.type === "Handwriting").every((n) => n.props.color === "#2b1d14"));
  for (const n of hands) {
    const b = n.props.box as { x: number; y: number; w: number; h: number };
    assert.ok(b.x >= 40 && b.x + b.w <= 1040 && b.y >= 80 && b.y + b.h <= 960, JSON.stringify(b));
    assert.ok(b.x + b.w <= 540 - 0.245 * 1080 || b.x >= 540 + 0.245 * 1080, `off the pile: ${JSON.stringify(b)}`);
  }
  // The pile goes by its light from its fade, the table bare after it, her words still there.
  assert.ok(at(137).some((n) => n.type === "LumaFade" && n.props.at === 137 && n.props.frames === 4));
  const bare = at(142);
  assert.ok(!bare.some((n) => n.type === "LumaFade"));
  assert.equal(bare.filter((n) => n.type === "Handwriting").length, 2);
  // Ended early (on a cut): nothing of its own from its end, the montage plays her next photo.
  const ended = drawAt(91, { ...marks, end: "90", fade: "83" });
  assert.equal(ended.type, "AbsoluteFill");
  assert.equal(ended.children.length, 0);
});
