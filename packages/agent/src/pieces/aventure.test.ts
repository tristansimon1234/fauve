import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { readsDrawn, subjectsDrawn } from "../subject.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { aventure, aventureMoments } from "./aventure.ts";

// « Un an de plus », the effect of the bank (aventure.ts): its own checks, beside the bank's (features.test.ts).

/** Her strong shot (1,2 s) and a shot that moves (0,4 s) under it, between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.5 },
  { file: "flour", at: 8.2, seconds: 1.2 },
  { file: "party", at: 6, seconds: 0.4 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Un an de plus » (effect v1): its layer over her strong shot and the next, its counter's moments on the beat", () => {
  const plan = pieceTestPlan({ piece: aventure, shots, span: [1.5, 3.1], fill: { texts: { compteur: "5 ans" }, objects: {}, settings: {} }, bpm: 134.87 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "aventure", version: 1 });
  // Its number one more a beat in (14 images at the original's tempo), gone with its last image (three beats: 40 there).
  assert.deepEqual(aventureMoments(48, 134.87), { tick: 14, out: 48 });
  assert.equal(motion.texts!.tick, "14");
  assert.equal(motion.texts!.out, "48");
  assert.equal(motion.texts!.compteur, "5 ans");
  // Nothing cut out, no sound, no music shaped: the montage's runs under it.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.equal(plan.music_shape, undefined);
  // A short one: its tick ten images before its end at the latest, its counter to its end.
  assert.deepEqual(aventureMoments(36, 60), { tick: 26, out: 36 });
  assert.deepEqual(aventureMoments(75, 100), { tick: 19, out: 75 });
  // Its code: checked, nothing cut out, only the light under its counter on its shots.
  assert.deepEqual(checkMotionCode(aventure.code), []);
  assert.deepEqual(subjectsDrawn(aventure.code), []);
  assert.deepEqual(readsDrawn(aventure.code).map((r) => r.kinds), [["light"]]);
});

test("« Un an de plus »: its counter required and cut to its place; offered on a close shot, never on a wide one", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "compteur", text: "Saison 3 du club" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(aventure, answer)!.texts, { compteur: "Saison 3 du" });
  assert.equal(readPieceFill(aventure, { ...answer, texts: [] }), null);
  const clip = (framing: string) =>
    ({
      duration: 6,
      orientation: "portrait",
      summary: "une enfant souffle de la farine",
      setting: "intérieur, une cuisine",
      lighting: "good",
      shots: [{ start: 0, end: 6, description: "un nuage de farine devant son visage", subject: "enfant", energy: 4, hook_score: 5, quality: { blurry: false, dark: false, shaky: false }, faces_visible: true, framing, camera: "static", subject_box: [300, 300, 700, 1200], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([aventure], pieceShots([{ media_id: "a", analysis: clip("close") }], {}), 1).map((p) => p.key), ["aventure"]);
  assert.deepEqual(piecesOffered([aventure], pieceShots([{ media_id: "a", analysis: clip("wide") }], {}), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** interpolate as Remotion's, clamped (all its code uses). */
function interpolate(x: number, [a, b]: number[], [p, q]: number[]) {
  const t = Math.max(0, Math.min(1, (x - a!) / (b! - a!)));
  return p! + (q! - p!) * t;
}

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; light?: number | ((from: number) => number); one?: boolean } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }) };
  // Each shot's light, by where it starts.
  const lit = (shot: { from: number }) => (props.light === undefined ? null : typeof props.light === "number" ? props.light : props.light(shot.from));
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    interpolate,
    useCurrentFrame: () => frame,
    LightUnder: (shot: { from: number }) => (lit(shot) === null ? null : { mean: lit(shot), high: lit(shot) }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${aventure.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const list = [
    { from: -45, durationInFrames: 45, kind: "video", aspect: 0.5625 },
    { from: 0, durationInFrames: 36, kind: "video", aspect: 0.5625 },
    ...(props.one ? [] : [{ from: 36, durationInFrames: 12, kind: "video", aspect: 0.5625 }]),
  ];
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: 48,
    brand: { name: "Farine", displayFont: "Bebas Neue", bodyFont: "Jost", accent: "#b5293f", palette: {} },
    shots: list,
    texts: { beat: "13.346", tick: "14", out: "48", mine: props.one ? "1" : "1,2", compteur: "5 ans", ...props.texts },
  });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const counter = (tree: Drawn) => flatten(tree).filter((n) => n.type === "FitText");
const textOf = (n: Drawn) => String(n.children[0]);
const styleOf = (n: Drawn) => (n.props.style ?? {}) as Record<string, number | string>;

test("« Un an de plus » draws its counter: one less first, hers a beat later swelling three images, to its last image", () => {
  assert.deepEqual(counter(drawAt(0)).map(textOf), ["4", "ans"]);
  assert.deepEqual(counter(drawAt(13)).map(textOf), ["4", "ans"]);
  assert.deepEqual(counter(drawAt(14)).map(textOf), ["5", "ans"]);
  assert.deepEqual([15, 16, 17, 18].map((f) => String(styleOf(counter(drawAt(f))[0]!).transform ?? "none")), ["scale(1.25)", "scale(1.35)", "scale(1.12)", "none"]);
  assert.equal(styleOf(counter(drawAt(16))[1]!).transform, undefined);
  // There to its last image (never an empty one: the scene check refuses it), gone from its mark.
  assert.equal(counter(drawAt(47)).length, 2);
  assert.equal(counter(drawAt(40, { texts: { out: "40" } })).length, 0);
  // Translucent white, centred a little under the middle; dark ink on a bright place.
  const [top, bottom] = counter(drawAt(5));
  assert.equal(styleOf(top!).opacity, 0.48);
  assert.equal((top!.props.innerStyle as Record<string, string>).color, "#ffffff");
  assert.ok(Math.abs((Number(styleOf(top!).top) + Number(styleOf(bottom!).top) + Number(styleOf(bottom!).height)) / 2 - 1920 * 0.527) < 4);
  assert.ok(Number(styleOf(top!).left) >= 140 && Number(styleOf(top!).left) + Number(styleOf(top!).width) <= 940);
  assert.equal((counter(drawAt(5, { light: 0.8 }))[0]!.props.innerStyle as Record<string, string>).color, "#17130f");
  // Its ink read on the shot under it: dark on her bright strong shot, white again over the dark one after the cut.
  const flour = (from: number) => (from === 0 ? 0.8 : 0.2);
  assert.equal((counter(drawAt(35, { light: flour }))[0]!.props.innerStyle as Record<string, string>).color, "#17130f");
  assert.equal((counter(drawAt(37, { light: flour }))[0]!.props.innerStyle as Record<string, string>).color, "#ffffff");
  // A year: the one before it first; no number: her words swell on the beat.
  assert.deepEqual(counter(drawAt(2, { texts: { compteur: "2026" } })).map(textOf), ["2025"]);
  assert.equal(styleOf(counter(drawAt(16, { texts: { compteur: "L'été" } }))[0]!).transform, "scale(1.35)");
});

test("« Un an de plus »: the colours of her strong shot fill the lens before the next cut; none with one shot", () => {
  const fill = (f: number, one = false) => flatten(drawAt(f, { one })).find((n) => n.props.key === "fill");
  assert.equal(fill(29), undefined);
  const coming = fill(33)!;
  assert.ok(Number(styleOf(coming).opacity) > 0.4 && Number(styleOf(coming).opacity) < 1);
  assert.equal(flatten(coming).find((n) => n.type === "Footage")!.props.shot, 1);
  assert.equal(styleOf(fill(36)!).opacity, 1);
  assert.match(String(styleOf(fill(38)!).maskImage), /315deg/);
  assert.equal(fill(40), undefined);
  assert.equal(fill(33, true), undefined);
  // The counter stays over it.
  const tree = flatten(drawAt(36));
  assert.ok(tree.findIndex((n) => n.props.key === "fill") < tree.findIndex((n) => n.type === "FitText"));
});
