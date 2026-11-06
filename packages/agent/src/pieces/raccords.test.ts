import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceMusicShape, pieceTestPlan, readPieceFill } from "../pieces.ts";
import { subjectShots } from "../subject.ts";
import { raccordPieces, raccords } from "./raccords.ts";

// « Raccords en morceaux », the effect of the bank (raccords.ts): its own checks, beside the bank's (features.test.ts).

/** A lead shot, then `n` shots of the model's lengths (its station, its lamp, its room, its turntable), then the montage again. */
const run = (n: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...[1.33, 1.53, 1.27, 0.87].slice(0, n).map((seconds, i) => ({ file: `f${i}`, at: 0.5, seconds })),
  { file: "after", at: 2, seconds: 1.8 },
];
const fill = { texts: {}, objects: {}, settings: {} };

test("« Raccords en morceaux » (effect v1): the cells first, then the pieces, then whole, each on the model's sixteenths", () => {
  // At 95 BPM a sixteenth is 4,74 images: the model's hits before its cuts, the cells' shot lit 1¾ sixteenths after its cut.
  const cuts = raccordPieces(
    [
      { from: -20, frames: 60 },
      { from: 40, frames: 46 },
      { from: 86, frames: 38 },
      { from: 124, frames: 26 },
    ],
    150,
    95,
  );
  assert.deepEqual(cuts, [
    { at: 40, rank: 1, kind: 1, pops: [15, 20, 29, 34], lit: 48 },
    { at: 86, rank: 2, kind: 2, pops: [64, 68, 77] },
    { at: 124, rank: 3, kind: 3, pops: [112] },
  ]);
  // A short shot presses its hits toward the cut, never before the cut before it nor two on one image.
  const short = raccordPieces(
    [
      { from: -10, frames: 30 },
      { from: 20, frames: 12 },
      { from: 32, frames: 20 },
    ],
    52,
    100,
  );
  assert.deepEqual(short.map((c) => c.pops), [[1, 5, 12, 15], [23, 25, 28]]);
  assert.ok(short.every((c, k) => c.pops.every((p) => p < c.at && (k === 0 || p > short[k - 1]!.at))));
  // One cut alone: its pieces (so a cut-out is declared, never every shot under it); its first shot alone: nothing to do.
  assert.deepEqual(raccordPieces([{ from: -20, frames: 60 }, { from: 40, frames: 50 }], 90, 95).map((c) => [c.kind, c.pops]), [[2, [18, 22, 31]]]);
  assert.deepEqual(raccordPieces([{ from: -10, frames: 60 }], 50, 95), []);
});

test("« Raccords en morceaux » (effect v1): its layer over three shots, their subjects cut out after its first cut, its music thinned while each builds", () => {
  const plan = pieceTestPlan({ piece: raccords, shots: run(3), span: [0.4, 5.33], fill, bpm: 95 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // Its shots 1, 2 and 3: the cells on its first cut, then the pieces; only the subject of shot 3 is cut out (the cells
  // need none), declared, never read in its code.
  assert.equal(motion.texts!.mine, "0,1,2,3");
  assert.deepEqual([motion.texts!.kind_0, motion.texts!.kind_1, motion.texts!.kind_2], ["1", "2", "3"]);
  assert.deepEqual(motion.drawn, { shots: 5, subjects: [2, 3] });
  assert.deepEqual([...subjectShots(plan)].sort(), [2, 3]);
  assert.equal(motion.sounds, undefined);
  // Its music without its bass from each first hit to where it lands, inside its span.
  const shape = pieceMusicShape({ piece: raccords, fill, plan, layer: plan.layers![0]!, bpm: 95 })!;
  assert.deepEqual(shape.filters!.map((f) => f.kind), ["thin", "thin", "thin"]);
  assert.ok(shape.filters!.every((f) => f.from >= 0.4 && f.to <= 5.33 && f.to > f.from), JSON.stringify(shape.filters));
  // No words to write: its filler only says it fits.
  assert.deepEqual(readPieceFill(raccords, { fits: true, missing: "", texts: [], objects: [], settings: [] }), { texts: {}, objects: {}, settings: {} });
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };

/** Its layer at a frame over four shots (a lead, then its three), the montage under it. */
function drawAt(frame: number, subject?: (shot: number) => Box | null, focus?: { x: number; y: number }): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    Footage: "Footage",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    interpolate: (x: number, [a, b]: number[], [u, v]: number[]) => (x <= a! ? u! : x >= b! ? v! : u! + ((v! - u!) * (x - a!)) / (b! - a!)),
    SubjectBox: (shot: { segment: number } | undefined) => (shot && subject ? subject(shot.segment) : null),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${raccords.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const shots = [
    { from: -20, durationInFrames: 60 },
    { from: 40, durationInFrames: 46 },
    { from: 86, durationInFrames: 38 },
    { from: 124, durationInFrames: 26 },
  ].map((s, i) => ({ ...s, src: `/v${i}.mp4`, aspect: 9 / 16, kind: "video", segment: i, ...(focus ? { focus } : {}) }));
  const line = raccords.timeline!({ frames: 150, bpm: 95, shots: shots.map((s) => ({ from: s.from, frames: s.durationInFrames })), words: {}, settings: {} });
  const texts = { ...Object.fromEntries(Object.entries(line.marks!).map(([k, v]) => [k, String(v)])), mine: "0,1,2,3", beat: "18.947" };
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames: 150, brand: { name: "Café Lou", displayFont: "Montserrat", bodyFont: "Montserrat" }, shots, texts });
}

const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const keyed = (tree: Drawn, key: string) => nodes(tree).find((n) => n.props.key === key) ?? null;
const styleOf = (node: Drawn | null) => (node?.props.style ?? {}) as Record<string, number | string>;
const rects = (clip: unknown) => [...String(clip).matchAll(/M(-?\d+) (-?\d+)h(-?\d+)v(-?\d+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));

test("« Raccords en morceaux » (effect v1): the next shot in nine cells, dimmed, then lit after its cut", () => {
  // Nothing before its first hit; then one, three, five, nine cells of shot 1's first image, square, about the middle.
  assert.equal(keyed(drawAt(14), "c1"), null);
  assert.deepEqual([15, 20, 29, 34, 39].map((f) => rects(styleOf(keyed(drawAt(f), "c1")).clipPath).length), [1, 3, 5, 9, 9]);
  const cells = rects(styleOf(keyed(drawAt(34), "c1")).clipPath);
  assert.ok(cells.every((c) => c.w === 204 && c.h === 204));
  assert.equal(cells[0]!.x + 102, 540);
  // About its subject where the montage frames it (its focus), inside the frame.
  const moved = rects(styleOf(keyed(drawAt(34, undefined, { x: 0.62, y: 0.3 }), "c1")).clipPath);
  assert.deepEqual([moved[0]!.x + 102, moved[0]!.y + 102], [670, 576]);
  assert.deepEqual(nodes(keyed(drawAt(34), "c1")).filter((n) => n.type === "Footage").map((n) => n.props.shot), [1]);
  // Its cut: nothing over the montage but the dim, gone in three images onto image 48.
  assert.equal(keyed(drawAt(40), "c1"), null);
  assert.deepEqual([40, 45, 46, 47, 48].map((f) => Math.round(Number(styleOf(keyed(drawAt(f), "dim")).opacity ?? 0) * 100) / 100), [0.59, 0.59, 0.39, 0.2, 0]);
});

test("« Raccords en morceaux » (effect v1): the next subject cut out in three pieces, then whole, else its picture in cells", () => {
  const her = { x: 300, y: 600, w: 480, h: 900 };
  // Shot 2's subject: its left third first (the model's first run of pieces), its right, then its middle.
  const pieces = [64, 68, 77].map((f) => rects(styleOf(keyed(drawAt(f, (s) => (s === 2 ? her : null)), "p2")).clipPath));
  assert.deepEqual(pieces.map((p) => p.length), [1, 2, 3]);
  assert.equal(pieces[0]![0]!.x, 278);
  assert.equal(pieces[1]![1]!.x, 620);
  assert.equal(pieces[2]![2]!.x, 460);
  // Shot 3's whole, 2½ sixteenths before its cut, kept to the cut.
  assert.equal(keyed(drawAt(111, (s) => (s === 3 ? her : null)), "p3"), null);
  assert.deepEqual(rects(styleOf(keyed(drawAt(112, (s) => (s === 3 ? her : null)), "p3")).clipPath), [{ x: 278, y: 578, w: 524, h: 944 }]);
  assert.equal(keyed(drawAt(124, (s) => (s === 3 ? her : null)), "p3"), null);
  // Without a cut-out: its picture in cells, one, five, nine; full light (only the first raccord dims).
  assert.equal(keyed(drawAt(63), "c2"), null);
  assert.deepEqual([64, 68, 77].map((f) => rects(styleOf(keyed(drawAt(f), "c2")).clipPath).length), [1, 5, 9]);
  assert.equal(keyed(drawAt(77), "c2")!.children.filter(Boolean).length, 1);
});
