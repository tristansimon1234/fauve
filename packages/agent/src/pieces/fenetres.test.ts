import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan } from "../pieces.ts";
import { fenetres } from "./fenetres.ts";

// « Fenêtres et étiquettes », the effect of the bank (fenetres.ts): its own checks, beside the bank's (features.test.ts).

/** Its Scene drawn at a frame as a plain tree (no renderer): the kit's pieces as named nodes. */
type Node = { type: unknown; props: Record<string, unknown>; children: unknown[] };
function drawAt(frame: number, props: Record<string, unknown>): Node {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Node => ({ type, props: p ?? {}, children }) };
  // random("seed") as Remotion's: deterministic, from 0 to 1.
  const random = (seed: string) => {
    let x = 0;
    for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) % 1_000_003;
    return (x % 1000) / 1000;
  };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame, random };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${fenetres.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Node;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Node[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  return [node as Node, ...(node as Node).children.flatMap(nodes)];
};
/** Its pictures at a frame: each Footage, its shot, its `at`, how many rectangles it is cut to. */
const pictures = (tree: Node) =>
  nodes(tree)
    .filter((n) => n.type === "Footage")
    .map((n) => ({ shot: n.props.shot as number, at: n.props.at as number | undefined, rects: (String((n.props.style as Record<string, unknown>).clipPath ?? "").match(/M/g) ?? []).length }));
const labels = (tree: Node) => nodes(tree).filter((n) => n.type === "FitText").map((n) => (n.children[0] as Node).children.join(""));

/** Her shots under it, `beats` each at 100 BPM (18 frames a beat), after a lead shot, as its layer gets them. */
function under(n: number, beats: number) {
  return [{ from: -36, durationInFrames: 36, kind: "video", aspect: 0.5625 }, ...Array.from({ length: n }, (_, i) => ({ from: i * 18 * beats, durationInFrames: 18 * beats, kind: "video", aspect: 1.78 }))];
}
const props = (n: number, beats: number, texts: Record<string, string>) => ({ width: 1080, height: 1920, durationInFrames: n * 18 * beats, brand: { displayFont: "DM Serif Display", bodyFont: "Inter Tight", accent: "#b5293f", palette: {} }, shots: under(n, beats), texts: { beat: "18", ...texts } });

test("« Fenêtres et étiquettes » (effect v1): its layer over a run of shots, its two labels, nothing cut out nor heard", () => {
  const shots = [
    { file: "lead", at: 1, seconds: 1.2 },
    ...["a", "b", "c", "d", "e", "f"].map((file) => ({ file, at: 0.5, seconds: 1.2 })),
    { file: "after", at: 2, seconds: 1.8 },
  ];
  const plan = pieceTestPlan({ piece: fenetres, shots, span: [1.2, 8.4], fill: { texts: { gauche: "ouvert dès 8 h", droite: "vieille ville" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // Nothing of her shots read before the render (no cut-out, no object), no sound (its original has none).
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.equal(motion.texts!.gauche, "ouvert dès 8 h");
  // Its labels are decor at the original's size, fixed: never moved nor animated.
  assert.match(fenetres.code, /"data-fauve-decor": ""/);
  assert.doesNotMatch(fenetres.code, /interpolate\(|spring\(/);
});

test("« Fenêtres et étiquettes »: what it draws at each cut — cells from the top right then the bottom left, windows every third cut", () => {
  const texts = { gauche: "ouvert dès 8 h", droite: "vieille ville" };
  // Six shots of two beats (36 frames): cuts at 36, 72, 108, 144 and 180.
  const p = props(6, 2, texts);
  // Its labels on every image, the left then the right.
  assert.deepEqual(labels(drawAt(0, p)), ["ouvert dès 8 h", "vieille ville"]);
  assert.deepEqual(pictures(drawAt(0, p)), []);
  // Two images after the first cut: the shot before (its first under it) held in the six cells not taken yet.
  assert.deepEqual(pictures(drawAt(38, p)), [{ shot: 1, at: undefined, rects: 6 }]);
  // After its cells (eleven images at 100 BPM), the montage's shot alone.
  assert.deepEqual(pictures(drawAt(48, p)), []);
  // The second cut, from the bottom left: the same snake the other way.
  assert.deepEqual(pictures(drawAt(74, p)).map((x) => x.shot), [2]);
  // The third: windows before the cut on the next shot at its first image, one, then two or three.
  const win = pictures(drawAt(108 - 20, p));
  assert.equal(win.length, 1);
  assert.equal(win[0]!.shot, 4);
  assert.ok(win[0]!.at! > 1000, "its first image");
  assert.equal(win[0]!.rects, 1);
  assert.ok(pictures(drawAt(107, p))[0]!.rects >= 2);
  // Optional words: one label.
  assert.deepEqual(labels(drawAt(0, props(6, 2, { gauche: "depuis 1998" }))), ["depuis 1998"]);
  // On her word: cells only (never a window), or windows before every cut that has room.
  const cells = props(6, 2, { ...texts, entree: "cases" });
  for (let f = 0; f < 216; f += 2) assert.ok(pictures(drawAt(f, cells)).every((x) => x.at === undefined), `frame ${f}`);
  const windows = props(6, 2, { ...texts, entree: "fenetres" });
  for (const cut of [36, 72, 108, 144, 180]) assert.equal(pictures(drawAt(cut - 4, windows))[0]?.at! > 1000, true, `cut ${cut}`);
});

test("« Fenêtres et étiquettes »: shots of a beat still get their windows (the cells before them go faster), and a short run gets one", () => {
  // Six shots of one beat (18 frames): its third cut at 54 gets nine images of windows, the cells before them seven.
  const p = props(6, 1, { gauche: "ouvert dès 8 h" });
  assert.equal(pictures(drawAt(54 - 9, p))[0]?.shot, 4);
  assert.deepEqual(pictures(drawAt(36 + 4, p)), [{ shot: 2, at: undefined, rects: 2 }], "the cells of its second cut, in seven images");
  assert.deepEqual(pictures(drawAt(36 + 6, p)), []);
  // Three shots: cells at its first cut, windows at its last.
  const three = props(3, 2, { gauche: "ouvert dès 8 h" });
  assert.equal(pictures(drawAt(38, three))[0]?.at, undefined);
  assert.ok(pictures(drawAt(70, three))[0]!.at! > 1000);
});
