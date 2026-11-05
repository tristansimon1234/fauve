import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { recette } from "./recette.ts";

// « Les gestes racontés », the effect of the bank (recette.ts): its own checks, beside the bank's (features.test.ts).

/** Four of her gestures as the chain cuts them under it, between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "board", at: 2, seconds: 0.8 },
  { file: "board", at: 6, seconds: 0.7 },
  { file: "board", at: 9, seconds: 0.9 },
  { file: "bowl", at: 3, seconds: 1.1 },
  { file: "after", at: 2, seconds: 1.5 },
];
const RECIT = "le piment, l'oignon, les herbes, tu fouettes";

test("« Les gestes racontés » (effect v1): a layer over her gestures, its words only, nothing cut out, no sound", () => {
  const plan = pieceTestPlan({ piece: recette, shots, span: [1.2, 4.7], fill: { texts: { recit: RECIT }, objects: {}, settings: {} }, bpm: 85 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3, 4]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "recette", version: 1 });
  assert.deepEqual(motion.texts, { beat: "21.176", mine: "1,2,3,4", recit: RECIT });
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.equal(pieceMusicShape({ piece: recette, fill: { texts: { recit: RECIT }, objects: {}, settings: {} }, plan, layer, bpm: 85 }), undefined);
});

test("« Les gestes racontés »: its words required, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "recit", text: "trois œufs, un peu de lait, une pincée de sel, tu fouettes bien fort, à feu doux sans arrêter de remuer" }], objects: [], settings: [] };
  assert.equal(readPieceFill(recette, answer)!.texts.recit, "trois œufs, un peu de lait, une pincée de sel, tu fouettes bien fort, à feu doux sans");
  assert.equal(readPieceFill(recette, { ...answer, texts: [] }), null);
});

test("« Les gestes racontés » is offered on her still close videos, never on a moving camera nor on her photos", () => {
  const clip = (camera: string, framing: string) =>
    ({
      duration: 9,
      orientation: "landscape",
      summary: "des mains coupent des herbes sur une planche",
      setting: "intérieur, une cuisine",
      lighting: "good",
      shots: [{ start: 0, end: 9, description: "des mains coupent des herbes", subject: "mains", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera, subject_box: [300, 100, 700, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([recette], pieceShots([{ media_id: "a", analysis: clip("static", "close") }], {}), 1).map((p) => p.key), ["recette"]);
  assert.deepEqual(piecesOffered([recette], pieceShots([{ media_id: "a", analysis: clip("handheld", "close") }], {}), 1), []);
  assert.deepEqual(piecesOffered([recette], pieceShots([{ media_id: "a", analysis: clip("static", "wide") }], {}), 1), []);
  assert.deepEqual(piecesOffered([recette], pieceShots([], { p: { detection: { regions: [], notes: "un bouquet sur une table" } } as never }), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Face = { x: number; y: number; width: number; height: number };

/** What its Scene draws at a frame (its four shots of 24, 21, 27 and 33 images), run with a plain tree for React. */
function drawAt(frame: number, props: { recit?: string; faces?: (f: number) => Face[]; brand?: Record<string, unknown> } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${recette.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const list = [
    { from: -36, durationInFrames: 36, kind: "video", aspect: 16 / 9 },
    { from: 0, durationInFrames: 24, kind: "video", aspect: 16 / 9 },
    { from: 24, durationInFrames: 21, kind: "video", aspect: 16 / 9 },
    { from: 45, durationInFrames: 27, kind: "video", aspect: 16 / 9 },
    { from: 72, durationInFrames: 33, kind: "video", aspect: 16 / 9 },
  ];
  const track = props.faces ? (f: number) => ({ hands: [], bodies: [], faces: props.faces!(f) }) : undefined;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: 105,
    brand: { name: "Maison Farine", displayFont: "Gelasio", bodyFont: "Gelasio", accent: "#b5293f", ...props.brand },
    shots: list,
    texts: { beat: "21.176", mine: "1,2,3,4", recit: props.recit ?? RECIT },
    ...(track ? { track } : {}),
  });
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const own = (node: Drawn): string => (node.children.flat(Infinity) as unknown[]).filter((c): c is string => typeof c === "string").join("");
const seen = (tree: Drawn) => nodes(tree).filter((n) => n.type === "FitText");
const plain = (s: string) => s.replace(/\s+/g, "").toLowerCase();
function shown(props: Parameters<typeof drawAt>[1] = {}): { text: string; from: number; to: number }[] {
  const out: { text: string; from: number; to: number }[] = [];
  for (let f = 0; f < 105; f++) {
    const text = seen(drawAt(f, props)).map(own).join(" | ");
    const last = out[out.length - 1];
    if (last && last.text === text && last.to === f) last.to = f + 1;
    else out.push({ text, from: f, to: f + 1 });
  }
  return out;
}

test("« Les gestes racontés » draws one group on each of her gestures, cut in on its cut, in the middle, the whole text in the page", () => {
  // Four groups for four shots: each on its own shot, from its first image to the next cut.
  assert.deepEqual(shown(), [
    { text: "le piment", from: 0, to: 24 },
    { text: "l'oignon", from: 24, to: 45 },
    { text: "les herbes", from: 45, to: 72 },
    { text: "tu fouettes", from: 72, to: 105 },
  ]);
  // As its model: 64 px of a bold serif in her display font, a warm white, centred, its middle at half the height.
  const word = seen(drawAt(30))[0]!;
  assert.deepEqual(word.props.style, { position: "absolute", left: 140, top: 908, width: 800, height: 104 });
  const type = word.props.innerStyle as Record<string, string | number>;
  assert.deepEqual([type.fontSize, type.fontWeight, type.color, String(type.fontFamily).split(",")[0]], [64, 700, "#fefaf6", "'Gelasio'"]);
  // Every word and mark in the page, hidden but the one seen.
  for (const f of [0, 50, 100]) assert.ok(plain(nodes(drawAt(f)).map(own).join("")).includes(plain(RECIT)), String(f));
  // Fewer groups than shots: a group over a run of shots, still on the cuts.
  assert.deepEqual(shown({ recit: "farine, yaourt" }).map((g) => [g.text, g.from]), [["farine", 0], ["yaourt", 45]]);
  // More groups than shots: shared by what each needs, a group of three words held 1,4 s at least.
  const many = shown({ recit: "si tu veux, des œufs, vraiment crémeux, et voilà, bon appétit" });
  assert.deepEqual(many.map((g) => g.text), ["si tu veux", "des œufs", "vraiment crémeux", "et voilà", "bon appétit"]);
  assert.ok(many[0]!.to - many[0]!.from >= 41 && many.every((g) => g.to - g.from >= 14), JSON.stringify(many));
  // With room to spare, a change moved onto a cut when one is near (here the first two).
  assert.deepEqual(shown({ recit: "sel, poivre, thym, laurier, et voilà" }).map((g) => g.from).slice(0, 3), [0, 24, 45]);
});

test("« Les gestes racontés »: never on a face that looks at the lens, inside the safe zone", () => {
  const top = (f: number, faces: (f: number) => Face[]) => Number((seen(drawAt(f, { faces }))[0]!.props.style as { top: number }).top) + 52;
  assert.equal(top(30, () => [{ x: 540, y: 900, width: 300, height: 380 }]), Math.round(900 + 380 * 0.62 + 74));
  assert.equal(top(30, () => [{ x: 540, y: 420, width: 260, height: 300 }]), 960);
  assert.equal(top(30, () => [{ x: 540, y: 1180, width: 320, height: 400 }]), Math.round(1180 - 200 - 74));
  for (let f = 0; f < 105; f += 3) {
    for (const t of seen(drawAt(f))) {
      const b = t.props.style as { left: number; top: number; width: number; height: number };
      assert.ok(b.left >= 140 && b.left + b.width <= 940 && b.top >= 80 && b.top + b.height <= 1440, `${own(t)} at ${f}`);
    }
  }
});
