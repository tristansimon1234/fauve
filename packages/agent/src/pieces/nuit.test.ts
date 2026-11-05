import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { subjectShots } from "../subject.ts";
import { nuit, nuitMoments } from "./nuit.ts";

// « Sous tous les angles », the effect of the bank (nuit.ts): its own checks, beside the bank's (features.test.ts).

/** Her four shots of one object as the chain cuts them under it (0,6 s each), between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  ...Array.from({ length: 4 }, (_, i) => ({ file: `angle${i}`, at: 0.5, seconds: 0.6 })),
  { file: "after", at: 2, seconds: 1.8 },
];
const named = { objet1: "neon sign", objet2: "neon sign", objet3: "neon sign", objet4: "neon sign", objet5: "neon sign" };

test("« Sous tous les angles » (effect v1): its layer over her angles, her object followed on each, its drop on a beat", () => {
  const plan = pieceTestPlan({ piece: nuit, shots, span: [1.2, 3.6], fill: { texts: {}, objects: named, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3, 4]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "nuit", version: 1 });
  // 2,4 s at 100 BPM (a beat is 18 images): its drop on its third beat (54), its flash eight images before, its black between.
  assert.deepEqual(nuitMoments(72, 100), { back: 54, flash: 46, quiet: true });
  assert.deepEqual(motion.texts, { beat: "18", back: "54", flash: "46", mine: "1,2,3,4" });
  // Her object followed on each of her four angles (the fifth slot names nothing under it), nothing of her cut out.
  assert.deepEqual(motion.drawn, { shots: 6, objects: [1, 2, 3, 4].map((shot) => ({ shot, name: "neon sign" })) });
  assert.deepEqual([...subjectShots(plan)], []);
  // A tick on each of its fourteen cuts, louder and louder; a shutter on its flash.
  assert.equal(motion.sounds?.length, 2);
  assert.equal(motion.sounds![0]!.burst!.times.length, 14);
  assert.ok(motion.sounds![0]!.burst!.gains![0]! < motion.sounds![0]!.burst!.gains!.at(-1)!);
  assert.deepEqual([motion.sounds![1]!.sound, motion.sounds![1]!.at], ["camera shutter click", round3(46 / 30)]);
  // The music cut dead five images before the drop and back on it, a whole beat from its start (on the Reel's beat).
  const shape = pieceMusicShape({ piece: nuit, fill: { texts: {}, objects: named, settings: {} }, plan, layer, bpm: 100 })!;
  assert.deepEqual(shape.pauses, [{ from: round3(1.2 + 49 / 30), to: round3(1.2 + 54 / 30) }]);
  // Too short for its black: its stutter to its end, its flash on its last images, the music untouched.
  assert.deepEqual(nuitMoments(30, 100), { back: 31, flash: 28, quiet: false });
  assert.equal(nuit.timeline!({ frames: 30, bpm: 100, shots: [], words: {}, settings: {} }).music, undefined);
});

const round3 = (n: number) => Math.round(n * 1000) / 1000;

test("« Sous tous les angles »: no words of its own, its objects named by its filler, offered with three files at least", () => {
  const answer = { fits: true, missing: "", texts: [], objects: [{ slot: "objet1", name: "Neon Sign" }, { slot: "objet2", name: "none" }], settings: [] };
  assert.deepEqual(readPieceFill(nuit, answer), { texts: {}, objects: { objet1: "neon sign" }, settings: {} });
  assert.equal(readPieceFill(nuit, { ...answer, fits: false, missing: "un seul angle" }), null);
  const clip = { duration: 6, orientation: "landscape", summary: "une enseigne au néon la nuit", setting: "extérieur, une rue la nuit", lighting: "low", shots: [{ start: 0, end: 6, description: "une enseigne au néon", subject: "enseigne", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing: "medium", camera: "handheld", subject_box: [300, 100, 700, 600], beauty: 4 }], best_moments: [], transcript: "" } as unknown as ClipAnalysis;
  const three = pieceShots(["a", "b", "c"].map((media_id) => ({ media_id, analysis: clip })), {});
  assert.deepEqual(piecesOffered([nuit], three, 3).map((p) => p.key), ["nuit"]);
  assert.deepEqual(piecesOffered([nuit], three, 2), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number } | null;

/** What its Scene draws at a frame (a plain tree for React): her four angles from image 0 of the effect, 18 images each. */
function drawAt(frame: number, options: { box?: (shot: { segment: number }) => Box; durationInFrames?: number; back?: number; flash?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    Footage: "Footage",
    useCurrentFrame: () => frame,
    SubjectBox: (shot: { segment: number } | undefined) => (shot && options.box ? options.box(shot) : null),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${nuit.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const durationInFrames = options.durationInFrames ?? 72;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames,
    shots: [{ from: -36, durationInFrames: 36, kind: "video", aspect: 0.5625, segment: 0 }, ...Array.from({ length: 4 }, (_, i) => ({ from: i * 18, durationInFrames: 18, kind: "video", aspect: 0.5625, segment: i + 1 }))],
    texts: { beat: "18", back: String(options.back ?? 54), flash: String(options.flash ?? 46), mine: "1,2,3,4" },
  });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
const footage = (tree: Drawn) => flatten(tree).filter((n) => n.type === "Footage");
const keyed = (tree: Drawn, key: string) => flatten(tree).find((n) => n.props.key === key) ?? null;

test("« Sous tous les angles » draws her angles in turn on its cuts, its last turn streaked, then flash, negative, black, burn", () => {
  // The original's fifteen cuts in proportion to its 46 images before the flash: her four angles in turn (A B C D A B…),
  // each one's images going on from turn to turn.
  const shown = (f: number) => {
    const node = footage(drawAt(f))[0]!;
    return [Number(node.props.shot), f - Number(node.props.at)];
  };
  assert.deepEqual([0, 4, 9, 13, 15, 19, 23].map((f) => shown(f)[0]), [1, 2, 3, 4, 1, 2, 3]);
  assert.deepEqual([shown(0), shown(3), shown(15), shown(18)], [[1, 0], [1, 3], [1, 4], [1, 7]]);
  const blur = (f: number) => flatten(drawAt(f)).find((n) => n.type === "feGaussianBlur")?.props.stdDeviation;
  assert.deepEqual([blur(30), blur(33), blur(45)], [undefined, "9.0 0", undefined]);
  // Its last image burnt white (46), the picture in negative (47), black to the drop (48 – 54), the burn after it.
  assert.equal(styleOf(footage(drawAt(46))[0]!).filter, "brightness(4) saturate(0.5)");
  assert.equal(styleOf(footage(drawAt(47))[0]!).filter, "invert(1) contrast(1.15)");
  assert.ok([48, 51, 54].every((f) => keyed(drawAt(f), "black")) && footage(drawAt(50)).length === 0);
  const burn = (f: number) => String(styleOf(keyed(drawAt(f), "burn")!).background);
  assert.match(burn(55), /#f6f2ea/);
  assert.match(burn(56), /#2d2523 0%/);
  assert.match(burn(71), /#000000 19%/);
  // Her object found in each angle: one place and one size (1,15 to 1,9 times, never an edge uncovered).
  const boxes: Record<number, { x: number; y: number; w: number; h: number }> = { 1: { x: 380, y: 520, w: 300, h: 260 }, 2: { x: 300, y: 640, w: 330, h: 280 }, 3: { x: 450, y: 560, w: 240, h: 200 }, 4: { x: 330, y: 700, w: 280, h: 240 } };
  const placed = (f: number) => {
    const tree = drawAt(f, { box: (shot) => boxes[shot.segment] ?? null });
    const k = Number(footage(tree)[0]!.props.shot);
    const m = /translate\((-?\d+)px, (-?\d+)px\) scale\(([\d.]+)\)/.exec(String(styleOf(keyed(tree, `al${k - 1}`)!).transform))!;
    const [x, y, s] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const b = boxes[k]!;
    return { s, x, y, cx: x + s * (b.x + b.w / 2), cy: y + s * (b.y + b.h / 2), h: s * b.h };
  };
  const all = [0, 4, 9, 13].map(placed);
  assert.ok(all.every((p) => Math.abs(p.cx - all[0]!.cx) <= 1 && Math.abs(p.cy - all[0]!.cy) <= 1 && Math.abs(p.h - 322) <= 1), JSON.stringify(all));
  assert.ok(all.every((p) => p.s >= 1.15 && p.s <= 1.9 && p.x <= 0 && p.x >= 1080 - 1080 * p.s && p.y <= 0 && p.y >= 1920 - 1920 * p.s), JSON.stringify(all));
  // Nothing found: as the montage frames her shots.
  assert.equal(keyed(drawAt(4), "al1"), null);
  // A short one without black: its stutter to its last images, its flash on them.
  const short = (f: number) => drawAt(f, { durationInFrames: 30, back: 31, flash: 28 });
  assert.equal(styleOf(footage(short(28))[0]!).filter, "brightness(4) saturate(0.5)");
  assert.equal(keyed(short(29), "black"), null);
});
