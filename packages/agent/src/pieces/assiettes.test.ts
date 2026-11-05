import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { assiettes, dishCuts, menuMoments } from "./assiettes.ts";

// « Le menu qui défile », the effect of the bank (assiettes.ts): its own checks, beside the bank's (features.test.ts).

/** Her shots as the chain cuts them under it: a lead shot, four dishes a beat or two each, an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "bowl", at: 0.5, seconds: 1.8 },
  { file: "pizza", at: 1, seconds: 1.2 },
  { file: "salad", at: 2, seconds: 1.8 },
  { file: "cake", at: 3, seconds: 1.2 },
  { file: "after", at: 0, seconds: 1.5 },
];
const words = { titre: "Notre carte d'hiver", ligne: "faite maison" };

test("« Le menu qui défile » (effect v1): its layer over her four dishes, its typing, its words out on a cut, the bass back", () => {
  const plan = pieceTestPlan({ piece: assiettes, shots, span: [1.2, 7.2], fill: { texts: words, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3, 4]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "assiettes", version: 1 });
  // At 100 BPM (a beat of 18 images): its title typed from image 4 to 39, its line from 2 to 36 (about two beats, as the
  // model's 38 images at 91,6), both out on the first dish's cut 2,2 s after (image 113: its second bar's ninth sixteenth).
  assert.deepEqual(motion.texts, { beat: "18", type_at: "4", type_end: "39", line_at: "2", line_end: "36", title_out: "113", mine: "1,2,3,4", ...words });
  // Nothing cut out of her shots, no sound.
  assert.equal(motion.drawn?.subjects?.length ?? 0, 0);
  assert.equal(motion.sounds?.length ?? 0, 0);
  // Her music without its bass under her title, back with its exit.
  const shape = pieceMusicShape({ piece: assiettes, fill: { texts: words, objects: {}, settings: {} }, plan, layer, bpm: 100 })!;
  assert.deepEqual(shape.filters, [{ kind: "thin", from: 1.2, to: 4.967, open: 0.02 }]);
});

test("« Le menu qui défile »: its dishes on the original's drop at any tempo, its words held to its end on a short span", () => {
  // At 100 BPM a sixteenth is 4,5 images: sixteenths 0, 3, 7, 9, 11, 14 of a bar, then 0, 5, 7, 9, 11, 14.
  assert.deepEqual(dishCuts(150, 100), [0, 14, 32, 41, 50, 63, 72, 95, 104, 113, 122, 135, 144]);
  assert.deepEqual(dishCuts(4, 100), [0]);
  // A short span: its words typed over half of it at most and held to its end, no music shaped.
  const short = menuMoments({ frames: 54, bpm: 100 });
  assert.deepEqual(short, { type_at: 4, type_end: 27, line_at: 2, line_end: 25, title_out: 54 });
  assert.equal(assiettes.timeline!({ frames: 54, bpm: 100, shots: [], words, settings: {} }).music, undefined);
  // Its words: its title required, its line optional, cut to their place.
  const answer = { fits: true, missing: "", texts: [{ slot: "titre", text: "Les plats du jour de la cantine" }, { slot: "ligne", text: "" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(assiettes, answer)!.texts, { titre: "Les plats du jour de" });
  assert.equal(readPieceFill(assiettes, { ...answer, texts: [{ slot: "ligne", text: "faite maison" }] }), null);
});

test("« Le menu qui défile » is offered with three of her files at least", () => {
  const clip = {
    duration: 6,
    orientation: "portrait",
    summary: "un bol de riz vu d'en haut, tenu à la main",
    setting: "intérieur, une cuisine",
    lighting: "good",
    shots: [{ start: 0, end: 6, description: "un bol vu d'en haut", subject: "bol", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing: "close", camera: "static", subject_box: [200, 300, 800, 900], beauty: 4 }],
    best_moments: [],
    transcript: "",
  } as unknown as ClipAnalysis;
  const three = pieceShots(["a", "b", "c"].map((media_id) => ({ media_id, analysis: clip })), {});
  assert.deepEqual(piecesOffered([assiettes], three, 3).map((p) => p.key), ["assiettes"]);
  assert.deepEqual(piecesOffered([assiettes], three, 2), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame over the plan's layer (its marks, its words, its shots from its start), the kit as named nodes. */
function drawAt(frame: number, options: { photo?: boolean; texts?: Record<string, string>; span?: [number, number] } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", TypeOn: "TypeOn", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${assiettes.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const span = options.span ?? [1.2, 7.2];
  const plan = pieceTestPlan({ piece: assiettes, shots, span, fill: { texts: words, objects: {}, settings: {} }, bpm: 100 });
  const layer = plan.layers![0]!;
  // Her shots as its code gets them: the Reel's, from its start (a lead one started before it).
  let at = 0;
  const under = shots.map((s, i) => {
    const shot = { from: Math.round((at - span[0]) * 30), durationInFrames: Math.round(s.seconds * 30), kind: options.photo && i === 2 ? "photo" : "video", aspect: 9 / 16 };
    at += s.seconds;
    return shot;
  });
  const brand = { name: "Cantine Lou", displayFont: "Anton", bodyFont: "Cormorant Garamond", accent: "#b5543a", palette: { light: "#f6efe4" } };
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
const of = (tree: Drawn, type: string) => nodes(tree).filter((n) => n.type === type);

test("« Le menu qui défile » shows a dish of hers full frame on each of its cuts, in turn then from her middle one, a video further on", () => {
  const cuts = dishCuts(180, 100);
  const dish = (f: number) => of(drawAt(f), "Footage")[0]!;
  // Its first round in her order (shots 1 to 4), its second from her middle one (3, 4, 1, 2): never twice in a row.
  const order = cuts.slice(0, 8).map((c) => dish(c).props.shot);
  assert.deepEqual(order, [1, 2, 3, 4, 3, 4, 1, 2]);
  assert.deepEqual(styleOf(dish(0)), { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 });
  // A video plays while it is on, from where its passage is that round: its first images, then the next ones.
  assert.equal(dish(0).props.at, 0);
  assert.equal(dish(5).props.at, 0);
  const second = cuts[6]!;
  // Shot 1 again in its second round (its 54 images, dishes of 9 to 23 images): further on its passage.
  assert.equal(dish(second).props.shot, 1);
  assert.ok(Number(dish(second).props.at) < second, String(dish(second).props.at));
  // A photo holds its one image.
  assert.ok(Number(of(drawAt(cuts[1]!, { photo: true }), "Footage")[0]!.props.at) > 1000);
  // Three of her shots under it: always in turn (a second round from her middle one would show her last twice in a row).
  const three = dishCuts(144, 100).map((c) => of(drawAt(c, { span: [1.2, 6] }), "Footage")[0]!.props.shot);
  assert.deepEqual(three.slice(0, 7), [1, 2, 3, 1, 2, 3, 1]);
});

test("« Le menu qui défile » types its title and its line together, its caret on the line only, then both leave on a cut", () => {
  assert.equal(of(drawAt(1), "TypeOn").length, 0);
  const typing = of(drawAt(10), "TypeOn");
  assert.deepEqual(typing.map((t) => t.props.text), ["NOTRE CARTE D'HIVER", "faite maison"]);
  assert.deepEqual(typing.map((t) => [t.props.at, t.props.jitter, t.props.caret]), [[4, 0, "none"], [2, 0, "bar"]]);
  // Each one whole on its last image: 16 letters' steps over 35 images, 10 over 34.
  assert.ok(Math.abs(Number(typing[0]!.props.speed) - 480 / 35) < 1e-9 && Math.abs(Number(typing[1]!.props.speed) - 300 / 34) < 1e-9);
  assert.equal(of(drawAt(42), "TypeOn")[1]!.props.caret, "bar");
  assert.equal(of(drawAt(43), "TypeOn")[1]!.props.caret, "none");
  assert.equal(of(drawAt(112), "TypeOn").length, 2);
  assert.equal(of(drawAt(113), "TypeOn").length, 0);
  // Its title's capitals 2,5 % of the frame's height, centred on its middle, its small line beside it; both in the safe zone.
  const fits = of(drawAt(60), "FitText");
  assert.equal((fits[0]!.props.innerStyle as { fontSize: number }).fontSize, 56);
  assert.ok(nodes(fits[1]!).some((n) => "data-fauve-accent" in n.props));
  for (const fit of fits) {
    const b = styleOf(fit) as unknown as Box;
    assert.ok(b.left >= 140 && b.left + b.width <= 940 && b.top >= 80 && b.top + b.height <= 1440, JSON.stringify(b));
  }
});
