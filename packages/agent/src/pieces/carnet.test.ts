import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceLine, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { carnet, carnetLead, carnetPunch } from "./carnet.ts";

// « Le hublot », the effect of the bank (carnet.ts): its own checks, beside the bank's (features.test.ts).

/** Her talking shot as the chain cuts it under it (6 s), between a picture of what she talks about and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "talk", at: 3, seconds: 6 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Le hublot » (effect v1): its layer over her talking shot, black first, its jump on a beat, her words read under it", () => {
  const plan = pieceTestPlan({ piece: carnet, shots, span: [1.2, 7.2], fill: { texts: {}, objects: {}, settings: {} }, bpm: 90 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "carnet", version: 1 });
  // Its black first (the original's 10 images), its fallback jump on the beat nearest 62 % of it (6 s: image 120).
  assert.deepEqual(motion.texts, { beat: "20", lead: "10", punch: "120", mine: "1" });
  assert.equal(motion.times_spoken, true);
  // Nothing of her cut out, no sound of its own: the montage's music and the engine's subtitles run under it.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  // Its black: a seventh of a short one, 4 images at least; no fallback jump on a short one.
  assert.deepEqual([carnetLead(300), carnetLead(42), carnetLead(14)], [10, 6, 4]);
  assert.equal(carnetPunch(60, 90), -1);
  assert.ok(carnetPunch(240, 120) % 15 === 0 && carnetPunch(240, 120) >= carnetLead(240) + 36);
});

test("« Le hublot »: no words of its own, offered on a video of someone seen close or at mid-shot, never on her photos", () => {
  assert.deepEqual(carnet.texts, []);
  assert.deepEqual(readPieceFill(carnet, { fits: true, missing: "", texts: [], objects: [], settings: [] })!.texts, {});
  assert.match(pieceLine(carnet), /^carnet — /);
  const clip = (framing: string, person = true) =>
    ({
      duration: 9,
      orientation: "portrait",
      summary: "une femme parle face caméra dans son atelier",
      setting: "intérieur, son atelier",
      lighting: "good",
      shots: [{ start: 0, end: 9, description: person ? "une femme parle face caméra" : "un vase sur une table", subject: person ? "femme" : "vase", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: person, framing, camera: "static", subject_box: [300, 100, 700, 900], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([carnet], pieceShots([{ media_id: "a", analysis: clip("medium") }], {}), 1).map((p) => p.key), ["carnet"]);
  assert.deepEqual(piecesOffered([carnet], pieceShots([{ media_id: "a", analysis: clip("wide") }], {}), 1), []);
  assert.deepEqual(piecesOffered([carnet], pieceShots([{ media_id: "a", analysis: clip("close", false) }], {}), 1), []);
  assert.deepEqual(piecesOffered([carnet], pieceShots([], { p: { detection: { regions: [{ kind: "face" }], notes: "une femme" } } as never }), 1), []);
  assert.deepEqual(checkMotionCode(carnet.code), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Face = { x: number; y: number; width: number; height: number };

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; face?: Face | null; spoken?: { w: string; from: number; to: number }[]; durationInFrames?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", Footage: "Footage", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${carnet.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const durationInFrames = props.durationInFrames ?? 180;
  const track = () => ({ hands: [], faces: props.face ? [{ id: 0, ...props.face, points: {} }] : [], bodies: [] });
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames,
    brand: { name: "Atelier Argile", displayFont: "Inter Tight", bodyFont: "Inter Tight" },
    shots: [{ from: -36, durationInFrames: 36, kind: "photo" }, { from: 0, durationInFrames, kind: "video", aspect: 0.5625 }],
    texts: { beat: "20", lead: "10", punch: "120", mine: "1", ...props.texts },
    track,
    spoken: props.spoken ?? [],
  });
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const round = (tree: Drawn) => nodes(tree).find((n) => n.props.key === "round" || n.props.key === "round-p") ?? null;
const her = (tree: Drawn) => nodes(tree).find((n) => n.type === "Footage") ?? null;
/** Her words: « Ce que j'aime ? » at 20, « Il n'a pas besoin d'être parfait. » at 60, « Il doit être brut. » at 104. */
const said = [
  ["Ce", 20], ["que", 26], ["j'aime", 31], ["?", 38],
  ["Il", 60], ["n'a", 65], ["pas", 70], ["besoin", 75], ["d'être", 82], ["parfait.", 88],
  ["Il", 104], ["doit", 109], ["être", 115], ["brut.", 121],
].map(([w, from]) => ({ w: String(w), from: Number(from), to: Number(from) + 5 }));

test("« Le hublot » draws: black first, then at once her face in the middle of a round of light on black, 42 % of its width", () => {
  const face = { x: 560, y: 720, width: 220, height: 280 };
  // Black: her shot not drawn yet.
  assert.equal(her(drawAt(9, { face })), null);
  assert.equal(round(drawAt(9, { face })), null);
  // Then at once the round: an ellipse 49,4 % of the width, 1,36 times as tall, its top at 44 % of the height less half.
  const tree = drawAt(10, { face });
  const b = styleOf(round(tree)!);
  assert.equal(b.borderRadius, "50%");
  assert.equal(b.overflow, "hidden");
  assert.ok(Math.abs(Number(b.width) - 534) <= 1 && Math.abs(Number(b.height) / Number(b.width) - 1.36) < 0.01, JSON.stringify(b));
  assert.ok(Math.abs(Number(b.top) + Number(b.height) / 2 - 0.44 * 1920) <= 1);
  // The engine's subtitles (their row at 64 % of the height) run under it.
  assert.ok(Number(b.top) + Number(b.height) <= 0.64 * 1920);
  // Her face in its middle, 42 % of its width; its edge falls into the black.
  const p = styleOf(her(tree)!);
  const s = Number(p.width) / 1080;
  assert.ok(Math.abs(Number(p.left) + face.x * s - Number(b.width) / 2) <= 2 && Math.abs(Number(p.top) + face.y * s - Number(b.height) / 2) <= 2, JSON.stringify(p));
  assert.ok(Math.abs(face.width * s - 0.42 * Number(b.width)) <= 2);
  assert.match(String(styleOf(nodes(round(tree)!).find((n) => n.props.key === "rim")!).background), /^radial-gradient\(closest-side, rgba\(0,0,0,0\) 82%/);
  // Without her face followed: the round filled with the top of her picture, never an empty edge.
  const bare = drawAt(40);
  const q = styleOf(her(bare)!);
  const r = styleOf(round(bare)!);
  assert.ok(Number(q.left) <= 0 && Number(q.top) <= 0 && Number(q.left) + Number(q.width) >= Number(r.width) && Number(q.top) + Number(q.height) >= Number(r.height));
});

test("« Le hublot »: 1,61 times closer in one image on the first word of her last phrase, her face still in the middle; never on a short one", () => {
  const face = { x: 560, y: 720, width: 220, height: 280 };
  // On « Il doit être brut. » (image 104), not before.
  const before = styleOf(round(drawAt(103, { face, spoken: said }))!);
  const after = drawAt(104, { face, spoken: said });
  const close = styleOf(round(after)!);
  assert.equal(round(after)!.props.key, "round-p");
  assert.ok(Math.abs(Number(close.width) / Number(before.width) - 1.61) < 0.01);
  const p = styleOf(her(after)!);
  const s = Number(p.width) / 1080;
  assert.ok(Math.abs(Number(p.left) + face.x * s - Number(close.width) / 2) <= 2);
  assert.ok(Math.abs(Number(p.width) / Number(styleOf(her(drawAt(103, { face, spoken: said }))!).width) - 1.61) < 0.01);
  // No words under it: on its fallback beat (image 120).
  assert.equal(round(drawAt(119, { face }))!.props.key, "round");
  assert.equal(round(drawAt(120, { face }))!.props.key, "round-p");
  // Her last phrase too late (less than 0,8 s before its end): on its fallback beat; a short one: no jump at all.
  const late = said.map((w) => (w.from >= 104 ? { ...w, from: w.from + 60, to: w.to + 60 } : w));
  assert.equal(round(drawAt(119, { face, spoken: late }))!.props.key, "round");
  assert.equal(round(drawAt(121, { face, spoken: late }))!.props.key, "round-p");
  assert.equal(round(drawAt(55, { face, durationInFrames: 60, texts: { punch: "-1", lead: "6" } }))!.props.key, "round");
});
