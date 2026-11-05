import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { subjectShots } from "../subject.ts";
import { genericStage, titreCinema } from "./titre-cinema.ts";

// « Générique signé », the effect of the bank (titre-cinema.ts): its own checks, beside the bank's (features.test.ts).

/** Her wide still shot as the chain cuts it under it (5 s), between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "wide", at: 0.5, seconds: 5 },
  { file: "after", at: 2, seconds: 1.8 },
];
const fill = { texts: { titre: "Escapade", signature: "par Léa" }, objects: {}, settings: {} };

test("« Générique signé » (effect v1): its layer over her wide shot, her cut out there, the music without its bass until its cut", () => {
  const plan = pieceTestPlan({ piece: titreCinema, shots, span: [1.2, 6.2], fill, bpm: 124 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1]);
  assert.deepEqual(layer.motion.piece, { key: "titre-cinema", version: 1 });
  assert.equal(layer.motion.texts!.cut, "150");
  assert.equal(layer.motion.texts!.mine, "1");
  // She is cut out on her shot (the second of hers), to pass in front of her signature.
  assert.deepEqual(layer.motion.drawn, { shots: 3, subjects: [1] });
  assert.deepEqual([...subjectShots(plan)], [1]);
  // Its music: without its bass over it, back on the cut that takes its title away.
  const shape = pieceMusicShape({ piece: titreCinema, fill, plan, layer, bpm: 124 })!;
  assert.deepEqual(shape.filters!.map((f) => [f.kind, f.from, f.to]), [["thin", 1.2, 6.2]]);
  // Laid over two of her shots: its title on the first, the bass back on its cut, the second bare.
  const two = pieceTestPlan({ piece: titreCinema, shots, span: [1.2, 8], fill, bpm: 124 });
  const twoLayer = two.layers![0]!;
  assert.deepEqual(layerShots(two, twoLayer), [1, 2]);
  assert.deepEqual(twoLayer.motion.drawn, { shots: 3, subjects: [1] });
  assert.deepEqual(pieceMusicShape({ piece: titreCinema, fill, plan: two, layer: twoLayer, bpm: 124 })!.filters!.map((f) => [f.from, f.to]), [[1.2, 6.2]]);
  // Its stage: the first shot that plays 9 images of it, never the last images of the shot before.
  assert.deepEqual(genericStage([{ from: -40, frames: 44 }, { from: 4, frames: 120 }], 150), { rank: 1, from: 4, to: 124 });
  assert.deepEqual(genericStage([{ from: 0, frames: 90 }], 60), { rank: 0, from: 0, to: 60 });
});

test("« Générique signé »: its words, the title and the signature required, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "titre", text: "Escapade au bord de la mer" }, { slot: "signature", text: "par Léa" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(titreCinema, answer)!.texts, { titre: "Escapade au bord", signature: "par Léa" });
  assert.equal(readPieceFill(titreCinema, { ...answer, texts: [{ slot: "titre", text: "Escapade" }] }), null);
});

test("« Générique signé » is offered on a wide still shot with someone in it, never on a moving camera nor a close-up", () => {
  const clip = (camera: string, framing: string) =>
    ({
      duration: 9,
      orientation: "landscape",
      summary: "une femme marche au coucher du soleil",
      setting: "extérieur, une promenade au bord de la mer",
      lighting: "good",
      shots: [{ start: 0, end: 9, description: "une femme marche le long d'une rambarde, le ciel orange", subject: "femme", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera, subject_box: [300, 100, 700, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([titreCinema], pieceShots([{ media_id: "a", analysis: clip("static", "wide") }], {}), 1).map((p) => p.key), ["titre-cinema"]);
  assert.deepEqual(piecesOffered([titreCinema], pieceShots([{ media_id: "a", analysis: clip("handheld", "wide") }], {}), 1), []);
  assert.deepEqual(piecesOffered([titreCinema], pieceShots([{ media_id: "a", analysis: clip("static", "close") }], {}), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number } | null;
type Style = { left: number; top: number; width: number; height: number; [k: string]: unknown };

/** What its Scene draws at a frame of a 150-image layer over one shot (or the shots given), run with a plain tree for React. */
function drawAt(frame: number, props: { subject?: (f: number) => Box; texts?: Record<string, string>; shots?: { from: number; durationInFrames: number }[] } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }) };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    SubjectBox: (_shot: unknown, f: number) => (props.subject ? props.subject(f) : null),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${titreCinema.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn | null;
  const brand = { name: "Villa Marine", displayFont: "Sarpanch", bodyFont: "Tinos", accent: "#1d3b52" };
  const tree = make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: 150,
    brand,
    shots: props.shots ?? [{ from: 0, durationInFrames: 150, kind: "video", aspect: 9 / 16 }],
    texts: { beat: "14.516", cut: "150", mine: "0", titre: "Escapade", signature: "par Léa", ...props.texts },
  });
  return tree ?? { type: null, props: {}, children: [] };
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Style;
function lockupAt(tree: Drawn) {
  const fit = flatten(tree).find((n) => n.type === "FitText");
  if (!fit) return null;
  const [title, sign] = (fit.children[0] as Drawn).children as Drawn[];
  return { box: styleOf(fit), pad: Number((fit.props.innerStyle as Style).paddingTop), title: styleOf(title!), sign: sign ? styleOf(sign) : null, text: flatten(fit).flatMap((d) => d.children.filter((c) => typeof c === "string")).join(" | ") };
}

test("« Générique signé » draws, without anyone cut out: its lockup at the original's place, there at once and still", () => {
  const k = lockupAt(drawAt(0))!;
  // « ESCAPADE », 8 letters: bigger than the original's 14 (its capitals 6 % of the width at most), its signature 64 px.
  assert.equal(k.text, "ESCAPADE | par Léa");
  assert.equal(k.title.fontSize, 103);
  assert.equal(k.sign!.fontSize, 64);
  assert.equal(k.box.top + k.pad, Math.round(960 - 0.535 * 103));
  assert.equal(k.sign!.textAlign, "right");
  assert.deepEqual(lockupAt(drawAt(149))!.box, k.box);
  assert.ok(k.box.left >= 140 && k.box.left + k.box.width <= 940);
  assert.equal(flatten(drawAt(60)).filter((n) => n.type === "Subject").length, 0);
  // Its words in her charter: her display font in its heaviest weight, her text font for the signature, the original's warm white.
  assert.match(String(k.title.fontFamily), /^'Sarpanch'/);
  assert.equal(k.title.fontWeight, 900);
  assert.match(String(k.sign!.fontFamily), /^'Tinos'/);
  assert.equal(k.title.color, "#fffcf8");
});

test("« Générique signé »: her head covers the bottom of her signature, she in front of it; gone with its stage's cut", () => {
  const her = () => ({ x: 640, y: 1100, w: 120, h: 600 });
  const tree = drawAt(30, { subject: her });
  const k = lockupAt(tree)!;
  assert.equal(k.box.top + k.pad, Math.round(1100 - 1.22 * 103 - 0.33 * 64));
  assert.equal(k.sign!.textAlign, "right");
  assert.deepEqual(flatten(tree).filter((n) => n.type === "FitText" || n.type === "Subject").map((n) => n.type), ["FitText", "Subject"]);
  // Too high for room above her: in front of her, low in the frame.
  const high = drawAt(30, { subject: () => ({ x: 400, y: 120, w: 400, h: 1500 }) });
  assert.equal(flatten(high).filter((n) => n.type === "Subject").length, 0);
  assert.equal(lockupAt(high)!.box.top + lockupAt(high)!.pad, Math.round(1428 - Math.round(1.22 * 103 + 0.9 * 64)));
  // Over two shots: its title on its stage, gone with its cut (at 100), the second shot bare.
  const two = { shots: [{ from: 0, durationInFrames: 100 }, { from: 100, durationInFrames: 50 }], texts: { cut: "100", mine: "0,1" } };
  assert.ok(lockupAt(drawAt(99, two)));
  assert.equal(lockupAt(drawAt(100, two)), null);
  // Its code: checked, under 24 000 characters, no hook after its early returns, no zoom.
  assert.deepEqual(checkMotionCode(titreCinema.code), []);
  assert.ok(titreCinema.code.length < 24000);
  assert.doesNotMatch(titreCinema.code, /useMemo|useState|useId|transform|scale\(/);
});
