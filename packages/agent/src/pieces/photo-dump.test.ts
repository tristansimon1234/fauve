import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan } from "../pieces.ts";
import { photoDump } from "./photo-dump.ts";

// « Photo dump », the effect of the bank (photo-dump.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function draw(frame: number, props: Record<string, unknown>): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${photoDump.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const footage = (tree: Drawn) => nodes(tree).filter((n) => n.type === "Footage");

/** Her shots as the effect gets them (frames from its start): her shot before it, then n of a beat each (`beat` images). */
function under(kinds: ("video" | "photo")[], beat = 18) {
  return [
    { from: -36, durationInFrames: 36, kind: "video", aspect: 0.5625 },
    ...kinds.map((kind, i) => ({ from: i * beat, durationInFrames: beat, kind, aspect: kind === "video" ? (i % 4 === 1 ? 16 / 9 : 0.5625) : i % 3 === 0 ? 4 / 3 : 0.75 })),
  ];
}
const brand = { displayFont: "DM Serif Display", bodyFont: "Inter Tight", accent: "#b5543a", palette: { light: "#f4ead8", dark: "#2b1d14" } };

test("« Photo dump » (effect v1): its layer over a run of her shots, no reading of them, no sound, its title optional", () => {
  const shots = [{ file: "lead", at: 1, seconds: 1.2 }, ...Array.from({ length: 10 }, (_, i) => ({ file: `f${i}`, at: 0.3, seconds: 0.6, photo: i % 2 === 0 })), { file: "after", at: 2, seconds: 1.8 }];
  const plan = pieceTestPlan({ piece: photoDump, shots, span: [1.2, 7.2], fill: { texts: {}, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // Nothing of her shots read before the render (no cut-out, no object), no sound: the original lays none on its cuts.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.equal(motion.texts!.beat, "18");
  assert.equal(motion.texts!.titre, undefined);
  // Its settings, only when asked: the page in her light colour, every picture upright.
  const asked = pieceTestPlan({ piece: photoDump, shots, span: [1.2, 7.2], fill: { texts: { titre: "ma semaine en vrac" }, objects: {}, settings: { fond: "charte", format: "hauteur" } }, bpm: 100 });
  assert.deepEqual([asked.layers![0]!.motion.texts!.titre, asked.layers![0]!.motion.texts!.fond, asked.layers![0]!.motion.texts!.format], ["ma semaine en vrac", "charte", "hauteur"]);
});

test("« Photo dump » (effect v1): a new picture every half beat, each of her shots twice in another order, never the same twice in a row", () => {
  const kinds = Array.from({ length: 10 }, (_, i) => (i % 3 === 1 ? "video" : "photo") as "video" | "photo");
  const shots = under(kinds);
  const props = { width: 1080, height: 1920, durationInFrames: 180, brand, shots, texts: { beat: "18" } };
  // At 100 BPM a half beat is 9 images: 20 pictures over its 10 beats.
  const shown = Array.from({ length: 20 }, (_, j) => footage(draw(j * 9 + 4, props)));
  assert.ok(shown.every((f) => f.length === 1), "one picture at a time");
  const order = shown.map((f) => f[0]!.props.shot as number);
  // Her first shot under it opens; her shot before it never shows.
  assert.equal(order[0], 1);
  assert.ok(!order.includes(0));
  for (let k = 1; k <= 10; k++) assert.equal(order.filter((s) => s === k).length, 2, `shot ${k} twice`);
  order.slice(1).forEach((s, j) => assert.notEqual(s, order[j], `picture ${j + 1}`));
  // Never a loop one reads: the second round is not the first one again.
  assert.notDeepEqual(order.slice(10), order.slice(0, 10));
  // Still within a half beat: the same picture on its 9 images.
  assert.equal(footage(draw(9, props))[0]!.props.shot, footage(draw(17, props))[0]!.props.shot);
  // A photo is drawn still (its first image, far ahead); a video plays from its first image, then a half beat further the second time.
  const video = 2;
  const times = order.flatMap((s, j) => (s === video ? [j] : []));
  const at = times.map((j) => footage(draw(j * 9 + 4, props))[0]!.props.at as number);
  assert.deepEqual(at, [times[0]! * 9, times[1]! * 9 - 9]);
  const photo = footage(draw(4, props))[0]!;
  assert.ok((photo.props.at as number) > 180 * 4);
  // Each at its shape on the same width (80 % of the frame), a wider video framed 4:3; one smaller, once.
  const widths = Array.from({ length: 20 }, (_, j) => (nodes(draw(j * 9 + 4, props)).find((n) => n.type === "div")!.props.style as { width: number }).width);
  assert.equal(widths.filter((w) => w === 864).length, 19);
  assert.equal(widths.filter((w) => w < 864).length, 1);
  const wide = order.findIndex((s) => shots[s]!.aspect > 1.5);
  const box = nodes(draw(wide * 9 + 4, props)).find((n) => n.type === "div")!.props.style as { width: number; height: number };
  assert.equal(box.height, Math.round(864 / (4 / 3)));
});

test("« Photo dump » (effect v1): a beat a picture when half a beat is too quick, its page and its title", () => {
  // At 140 BPM half a beat is 6,4 images: a beat a picture.
  const shots = under(Array.from({ length: 6 }, () => "photo"), 12.86);
  const fast = { width: 1080, height: 1920, durationInFrames: 77, brand, shots, texts: { beat: "12.857" } };
  assert.equal(footage(draw(2, fast))[0]!.props.shot, footage(draw(12, fast))[0]!.props.shot);
  assert.notEqual(footage(draw(12, fast))[0]!.props.shot, footage(draw(14, fast))[0]!.props.shot);
  // Its page: the original's grey; her light colour on her word, never a dark one.
  const page = (texts: Record<string, string>, light = "#f4ead8") => (draw(4, { ...fast, brand: { ...brand, palette: { light } }, texts: { beat: "12.857", ...texts } }).props.style as { backgroundColor: string }).backgroundColor;
  assert.equal(page({}), "#efefef");
  assert.equal(page({ fond: "charte" }), "#f4ead8");
  assert.equal(page({ fond: "charte" }, "#5b3fd9"), "#efefef");
  // Its title, on a white pill at the top, only when written.
  assert.equal(nodes(draw(4, fast)).filter((n) => n.type === "FitText").length, 0);
  const titled = nodes(draw(4, { ...fast, texts: { beat: "12.857", titre: "ma semaine en vrac" } })).find((n) => n.type === "FitText")!;
  assert.ok(JSON.stringify(titled.children).includes("ma semaine en vrac"));
  assert.ok((titled.props.style as { top: number }).top >= 80);
});
