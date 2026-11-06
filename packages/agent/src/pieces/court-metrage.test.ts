import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { courtMetrage, filmMoments } from "./court-metrage.ts";

// « Générique de court métrage », the effect of the bank (court-metrage.ts): its own checks, beside the bank's (features.test.ts).

/** Her shots as the chain cuts them under it: a lead shot, her first one (4,4 s, its title there), two of a bar, the last, an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "cup", at: 0.5, seconds: 4.4 },
  { file: "street", at: 1, seconds: 2.8 },
  { file: "machine", at: 2, seconds: 2.8 },
  { file: "latte", at: 3, seconds: 2 },
  { file: "after", at: 0, seconds: 1.5 },
];
const words = { titre: "Café Lumière", surtitre: "un matin", signature: "par Léa" };

test("« Générique de court métrage » (effect v1): its layer over her four shots, its moments, its projector, its music low under the slit", () => {
  const plan = pieceTestPlan({ piece: courtMetrage, shots, span: [1.2, 13.2], fill: { texts: words, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3, 4]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "court-metrage", version: 2 });
  // Its first cut at 4,4 s (the burn), its last at 10 s (the roll); the slit open over 71 images; its title on the first
  // beat once it is open that leaves it 1,4 s on screen (image 90, beat 5 at 100 BPM).
  assert.deepEqual(motion.texts, { beat: "18", cut: "132", open: "71", title: "90", roll: "300", mine: "1,2,3,4", ...words });
  // Nothing cut out of her shots.
  assert.equal(motion.drawn?.subjects?.length ?? 0, 0);
  // Its projector: a click on the black, its whirr under the slit, a click on the title, its film fluttering on the roll.
  assert.deepEqual(motion.sounds?.map((s) => [s.sound, s.at]), [
    ["film projector switch click", 0],
    ["old film projector running", 0.8],
    ["film projector click", 3],
    ["film reel flutter", 9.733],
  ]);
  // Its music low under its slit and its title, back on the burn's cut; without its bass from two beats before the roll.
  const shape = pieceMusicShape({ piece: courtMetrage, fill: { texts: words, objects: {}, settings: {} }, plan, layer, bpm: 100 })!;
  assert.deepEqual(shape.filters, [
    { kind: "soft", from: 1.2, to: 5.6, open: 0.02, db: -14 },
    { kind: "thin", from: 10, to: 13.2, open: 0.02 },
  ]);
});

test("« Générique de court métrage »: its moments for any first shot, two shots without a roll", () => {
  // A short first shot: the slit shortened so its title still shows 1,4 s before the cut, off the beat if it must.
  const short = filmMoments({ frames: 150, bpm: 100, shots: [{ from: 0, frames: 66 }, { from: 66, frames: 84 }] });
  assert.deepEqual(short, { cut: 66, roll: null, open: 22, title: 24 });
  // A long one: the original's 71 images of slit, its title on a beat.
  const long = filmMoments({ frames: 300, bpm: 85.5, shots: [{ from: 0, frames: 150 }, { from: 150, frames: 80 }, { from: 230, frames: 70 }] });
  assert.equal(long.open, 71);
  assert.equal(long.roll, 230);
  assert.ok(Math.abs(long.title / (60 / 85.5 * 30) - Math.round(long.title / (60 / 85.5 * 30))) < 0.05 && long.title <= 150 - 42, String(long.title));
  // Its words: its title required, its small word and its credit optional, cut to their place.
  const answer = { fits: true, missing: "", texts: [{ slot: "titre", text: "Le petit café du port de Honfleur" }, { slot: "surtitre", text: "" }, { slot: "signature", text: "par Léa" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(courtMetrage, answer)!.texts, { titre: "Le petit café du port", signature: "par Léa" });
  assert.equal(readPieceFill(courtMetrage, { ...answer, texts: [{ slot: "surtitre", text: "un matin" }] }), null);
});

test("« Générique de court métrage » is offered on her videos, never on her photos alone", () => {
  const clip = {
    duration: 8,
    orientation: "landscape",
    summary: "une tasse de café près d'une fenêtre au matin",
    setting: "intérieur, un café",
    lighting: "good",
    shots: [{ start: 0, end: 8, description: "une tasse qui fume près d'une fenêtre", subject: "tasse", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing: "medium", camera: "static", subject_box: [300, 300, 700, 900], beauty: 4 }],
    best_moments: [],
    transcript: "",
  } as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([courtMetrage], pieceShots([{ media_id: "a", analysis: clip }, { media_id: "b", analysis: clip }], {}), 2).map((p) => p.key), ["court-metrage"]);
  assert.deepEqual(piecesOffered([courtMetrage], pieceShots([], { p: { detection: { regions: [], notes: "une tasse" }, width: 1600, height: 1000 } } as never), 2), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame over the plan's layer (its marks, its words, its shots from its start), the kit as named nodes. */
function drawAt(frame: number, options: { aspect?: number; texts?: Record<string, string>; light?: number; two?: boolean } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Burn: "Burn",
    useCurrentFrame: () => frame,
    LightUnder: () => (options.light === undefined ? null : { mean: options.light, high: options.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${courtMetrage.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const run = options.two ? shots.slice(0, 3) : shots;
  const span: [number, number] = options.two ? [1.2, 8.4] : [1.2, 13.2];
  const plan = pieceTestPlan({ piece: courtMetrage, shots: run, span, fill: { texts: words, objects: {}, settings: {} }, bpm: 100 });
  const layer = plan.layers![0]!;
  // Her shots as its code gets them: the Reel's, from its start (a lead one started before it).
  let at = 0;
  const under = run.map((s) => {
    const shot = { from: Math.round((at - span[0]) * 30), durationInFrames: Math.round(s.seconds * 30), kind: "video", aspect: options.aspect ?? 16 / 9 };
    at += s.seconds;
    return shot;
  });
  const brand = { name: "Café Lumière", displayFont: "Cormorant Garamond", bodyFont: "Cormorant Garamond", accent: "#e8b4a0", palette: { light: "#f6efe4" } };
  const durationInFrames = Math.round((span[1] - span[0]) * 30);
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots: under, texts: { ...layer.motion.texts, ...options.texts } });
}

const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const textOf = (node: Drawn): string => nodes(node).map((n) => (n.children.flat(Infinity) as unknown[]).filter((c): c is string => typeof c === "string").join("")).join(" ").replace(/\s+/g, " ").trim();
const keyed = (tree: Drawn, key: string) => nodes(tree).find((n) => n.props.key === key) ?? null;
const fits = (tree: Drawn) => nodes(tree).filter((n) => n.type === "FitText");

test("« Générique de court métrage » draws its gate, its slit, its title card on its beat, its burn, its roll on its last cut", () => {
  // Its gate: her shots in width, 1,94:1 at the middle of the frame on a soft black, corners rounded; upright: the frame.
  const gate = (tree: Drawn) => styleOf(keyed(tree, "gate")!);
  assert.deepEqual([gate(drawAt(100)).top, gate(drawAt(100)).height, gate(drawAt(100)).borderRadius], [682, 557, 45]);
  assert.equal(gate(drawAt(100, { aspect: 9 / 16 })).height, 1759);
  // Black on its first image, its slit open at an even pace to image 71.
  const inset = (f: number) => {
    const clip = styleOf(keyed(drawAt(f), "shown")!).clipPath;
    return clip === undefined ? 0 : Number(/inset\((\d+)px/.exec(String(clip))![1]);
  };
  assert.ok(inset(0) >= 278);
  assert.ok(Math.abs(inset(35) - 557 / 4) <= 2, String(inset(35)));
  assert.equal(inset(71), 0);
  // Its title card on image 90, whole, gone with the first cut (132).
  assert.equal(fits(drawAt(89)).length, 0);
  assert.deepEqual(fits(drawAt(90)).map(textOf), ["un matin", "CAFÉ LUMIÈRE", "par Léa"]);
  assert.equal(fits(drawAt(131)).length, 3);
  assert.equal(fits(drawAt(132)).length, 0);
  // Its words in the safe zone, left of the apps' buttons below the middle.
  for (const t of fits(drawAt(100))) {
    const b = styleOf(t) as unknown as Box;
    const y = 682 + b.top;
    assert.ok(y >= 80 && y + b.height <= 1440, textOf(t));
    if (y + b.height > 960) assert.ok(b.left >= 140 && b.left + b.width <= 940, textOf(t));
  }
  // Its burn around the first cut, as its skill's.
  const burn = keyed(drawAt(128), "burn")!;
  assert.equal(burn.type, "Burn");
  assert.equal(burn.props.at, 132);
  // The roll onto its last shot (image 300): the strip on six images, the shot that goes in both frames, then the next.
  for (let k = 0; k < 6; k++) {
    const strip = keyed(drawAt(296 + k), "strip");
    assert.ok(strip, String(296 + k));
    assert.deepEqual(nodes(strip!).filter((n) => n.type === "Footage").map((n) => n.props.shot), k < 4 ? [3, 3] : [4, 4]);
  }
  assert.equal(keyed(drawAt(295), "strip"), null);
  assert.equal(styleOf(keyed(drawAt(302), "blank")!).backgroundColor, "#ebe5bb");
  // Two shots: its burn, no roll.
  assert.equal(keyed(drawAt(200, { two: true }), "roll"), null);
  assert.ok(keyed(drawAt(128, { two: true }), "burn"));
  // Its colours: lemon yellow, her colour on her word, a warm white; her first shot dimmed under a bright title.
  const color = (texts: Record<string, string> = {}) => (fits(drawAt(100, { texts }))[1]!.props.innerStyle as { color: string }).color;
  assert.deepEqual([color(), color({ couleur: "sienne" }), color({ couleur: "blanc" })], ["#f2ea4a", "#e8b4a0", "#f4f1e8"]);
  assert.equal(styleOf(keyed(drawAt(60, { light: 0.84 }), "shown")!).filter, "brightness(0.550)");
  assert.equal(styleOf(keyed(drawAt(140, { light: 0.84 }), "shown")!).filter, undefined);
});
