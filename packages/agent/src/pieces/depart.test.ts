import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered } from "../pieces.ts";
import { planCues } from "../sfx.ts";
import { subjectShots } from "../subject.ts";
import { depart, departCover } from "./depart.ts";

// « Disparition au passage », the effect of the bank (depart.ts): its own checks, beside the bank's (features.test.ts).

/** Her standing shot and her place empty after it as the chain cuts them under it, between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "her", at: 0.5, seconds: 1.4 },
  { file: "her", at: 6, seconds: 0.8 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Disparition au passage » (effect v1): its layer over her standing shot and her place empty, its whoosh as the mass covers her picture", () => {
  const plan = pieceTestPlan({ piece: depart, shots, span: [1.2, 3.4], fill: { texts: {}, objects: {}, settings: {} }, bpm: 110 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2]);
  assert.deepEqual(layer.motion.piece, { key: "depart", version: 1 });
  // Nothing cut out, nothing followed: light to render.
  assert.equal(layer.motion.drawn, undefined);
  assert.deepEqual([...subjectShots(plan)], []);
  // The cut at her second shot (42 images in), the mass over the whole picture from six images before it to one after.
  assert.deepEqual(departCover({ frames: 66, shots: [{ from: 0, frames: 42 }, { from: 42, frames: 24 }] }), { cut: 42, from: 36, to: 43 });
  // Her shot alone: the cut at its end, the montage's next shot out from under it.
  assert.deepEqual(departCover({ frames: 40, shots: [{ from: 0, frames: 40 }] }), { cut: 40, from: 34, to: 40 });
  // Its whoosh peaking as it covers her picture (1,32 s into it, 2,52 s of the Reel), on its own moment.
  assert.equal(layer.motion.sounds?.length, 1);
  assert.deepEqual(layer.motion.sounds![0], { at: 1.317, sound: "fast soft whoosh of a vehicle passing close", seconds: 0.8, gain: -6, skill: true });
  assert.deepEqual(planCues(plan, [{ start: 0, length: 1.2 }, { start: 1.2, length: 1.4 }, { start: 2.6, length: 0.8 }, { start: 3.4, length: 1.8 }]).map((c) => c.at), [2.517]);
});

test("« Disparition au passage » is offered on a still video of someone, never on a moving camera nor on her photos", () => {
  const clip = (camera: string) =>
    ({
      duration: 6,
      orientation: "portrait",
      summary: "une femme debout devant sa boutique",
      setting: "extérieur, une devanture",
      lighting: "good",
      shots: [{ start: 0, end: 6, description: "une femme debout devant sa porte, une voiture passe", subject: "femme", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: true, framing: "wide", camera, subject_box: [300, 200, 700, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([depart], pieceShots([{ media_id: "a", analysis: clip("static") }], {}), 1).map((p) => p.key), ["depart"]);
  assert.deepEqual(piecesOffered([depart], pieceShots([{ media_id: "a", analysis: clip("handheld") }], {}), 1), []);
  assert.deepEqual(piecesOffered([depart], pieceShots([], { p: { detection: { regions: [{ kind: "face" }], notes: "une femme devant sa boutique" } } as never }), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** What its Scene draws at a frame (66 images: her standing 42, her place empty 24; or her standing alone), as a plain tree. */
function drawAt(frame: number, options: { alone?: boolean; before?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const interpolate = (x: number, [a, b]: number[], [y0, y1]: number[]) => (x <= a! ? y0! : x >= b! ? y1! : y0! + ((y1! - y0!) * (x - a!)) / (b! - a!));
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", Footage: "Footage", useCurrentFrame: () => frame, interpolate };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${depart.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const before = options.before ?? 0;
  const list = options.alone
    ? [{ from: -before, durationInFrames: 40 + before, kind: "video", aspect: 0.5625 }]
    : [
        { from: -before, durationInFrames: 42 + before, kind: "video", aspect: 0.5625 },
        { from: 42, durationInFrames: 24, kind: "video", aspect: 0.5625 },
      ];
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames: options.alone ? 40 : 66, shots: list, texts: { beat: "16", mine: options.alone ? "0" : "0,1" } });
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
/** Her shot drawn (the mass's held copy left out): which, how big, held how many frames. */
const shotAt = (tree: Drawn) => flatten(tree).filter((n) => n.type === "Footage" && n.props.at === undefined).map((n) => ({ shot: n.props.shot, scale: Math.round((Number(styleOf(n).width) / 1080) * 100) / 100, hold: n.props.hold }));
const edgesAt = (tree: Drawn) => {
  const veil = flatten(tree).find((n) => n.props.key === "veil");
  return veil ? (String(styleOf(veil).maskImage).match(/-?\d+px/g) ?? []).map((v) => Number(v.replace("px", ""))) : null;
};

test("« Disparition au passage » draws her stepping back in three jumps at 15 images a second, then the mass over the cut, her place empty held", () => {
  // 2,88, 2,04, 1,56 times on its first five images, then her whole place; each image held two frames.
  assert.deepEqual([0, 1, 2, 3, 4, 5, 30].map((f) => shotAt(drawAt(f))[0]!.scale), [2.88, 2.04, 2.04, 1.56, 1.56, 1, 1]);
  assert.equal(shotAt(drawAt(10))[0]!.hold, 2);
  // Her shot already playing before it: the steps on its own first five images all the same.
  assert.equal(shotAt(drawAt(0, { before: 30 }))[0]!.scale, 2.88);
  // The mass: nothing before image 30, in from the right, the whole picture covered from 36 to 43 (the cut at 42).
  assert.equal(edgesAt(drawAt(29)), null);
  assert.ok(edgesAt(drawAt(30))![0]! >= 1079);
  for (const f of [36, 40, 42, 43]) {
    const [, l1, r1] = edgesAt(drawAt(f))!;
    assert.ok(l1! <= 0 && r1! >= 1080, `image ${f}: ${edgesAt(drawAt(f))!.join(" ")}`);
  }
  // Its right edge out to the left over her place empty, gone by image 48; two frames at each place.
  assert.ok(edgesAt(drawAt(45))![3]! < 1080 && edgesAt(drawAt(45))![3]! > 0);
  assert.equal(edgesAt(drawAt(48)), null);
  assert.deepEqual(edgesAt(drawAt(32)), edgesAt(drawAt(33)));
  // Her place empty from the cut, its first image held seven images, then playing on.
  assert.deepEqual(shotAt(drawAt(42)), [{ shot: 1, scale: 1, hold: 7 }]);
  assert.deepEqual(shotAt(drawAt(49)), [{ shot: 1, scale: 1, hold: undefined }]);
  // The mass is her own shot held on its image before the cut, its middle blown up 9,6 times, streaked along x, darkened.
  const copy = flatten(drawAt(40)).find((n) => n.type === "Footage" && n.props.at !== undefined)!;
  assert.equal(copy.props.shot, 0);
  assert.equal(40 - Number(copy.props.at), 41);
  const blown = flatten(drawAt(40)).find((n) => styleOf(n).transform === "scale(9.6)")!;
  assert.match(String(styleOf(blown).filter), /^url\(#dp-pass-40\) brightness\(0\.36\)/);
  assert.equal(flatten(drawAt(40)).find((n) => n.type === "feGaussianBlur")!.props.stdDeviation, "16 1.2");
  // Her shot alone: the mass covers the last six images, the montage's next shot comes from under it.
  for (const f of [34, 37, 39]) {
    const [, l1, r1] = edgesAt(drawAt(f, { alone: true }))!;
    assert.ok(l1! <= 0 && r1! >= 1080, `alone, image ${f}`);
  }
  assert.deepEqual(shotAt(drawAt(39, { alone: true })).map((s) => s.shot), [0]);
});
