import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { pieceTestPlan, readPieceFill } from "../pieces.ts";
import { editPlanSchema, type EditPlan } from "../schemas.ts";
import { ANY_SHOT, readsDrawn } from "../subject.ts";
import { nike } from "./nike.ts";

// « Montage sport noir et blanc », the effect of the bank (nike.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/**
 * Its code run at one frame with a stand-in scope (the kit's pieces as named nodes), over the shots of its layer;
 * `light`: what LightUnder reads on a shot (nothing read by default, as in the scene check).
 */
function sceneAt(frame: number, layer: LayerInput, extra: Record<string, unknown> = {}, light?: (shot: unknown) => { mean: number; high: number } | null): Drawn | null {
  const h = (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() });
  const scope: Record<string, unknown> = {
    React: { createElement: h, Fragment: "Fragment" },
    useCurrentFrame: () => frame,
    AbsoluteFill: "AbsoluteFill",
    Footage: "Footage",
    FitText: "FitText",
    Tint: "Tint",
    LightUnder: (shot: unknown) => (light ? light(shot) : null),
  };
  const Scene = new Function(...Object.keys(scope), `${nike.code}\nreturn Scene;`)(...Object.values(scope)) as (p: unknown) => Drawn | null;
  return Scene({ width: 1080, height: 1920, brand: { displayFont: "Instrument Serif", bodyFont: "Inter", accent: "#f2694e" }, ...layer, ...extra });
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const style = (n: Drawn | undefined) => (n?.props.style ?? {}) as Record<string, unknown>;
const inner = (n: Drawn | undefined) => (n?.props.innerStyle ?? {}) as Record<string, unknown>;

type LayerInput = { durationInFrames: number; shots: { from: number; durationInFrames: number; kind: string; aspect: number }[]; texts: Record<string, string> };

/** Its layer as the render gets it: its length, the Reel's shots up to its end (frames from its start), its texts. */
function layerOf(plan: EditPlan): LayerInput {
  const layer = plan.layers![0]!;
  const from = Math.round(layer.from * 30);
  const durationInFrames = Math.round((layer.to - layer.from) * 30);
  let t = 0;
  const shots = plan.segments.flatMap((s) => {
    if (!("clip_id" in s)) return [];
    const length = Math.round((s.out - s.in) * 30);
    const shot = { from: t - from, durationInFrames: length, kind: "video", aspect: 16 / 9 };
    t += length;
    return shot.from < durationInFrames ? [shot] : [];
  });
  return { durationInFrames, shots, texts: layer.motion.texts ?? {} };
}

/** A run of her shots at 100 BPM (a beat is 0,6 s, 18 images) after a lead shot, the effect over the run. */
const run = (beats: number[]) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...beats.map((b, i) => ({ file: `f${i}`, at: 0.5, seconds: 0.6 * b })),
  { file: "after", at: 2, seconds: 1.8 },
];
const WORDS = "préparer, frapper, sauter, esquiver, souffler, recommencer";
const planOf = (beats: number[], texts: Record<string, string> = { mots: WORDS }, settings: Record<string, string> = {}) =>
  pieceTestPlan({ piece: nike, shots: run(beats), span: [1.2, 1.2 + 0.6 * beats.reduce((a, b) => a + b, 0)], fill: { texts, objects: {}, settings }, bpm: 100 });

test("« Montage sport noir et blanc » (effect v1): its layer over a run of shots, its last gesture frozen on its last beat, its red and its entry", () => {
  assert.deepEqual(checkMotionCode(nike.code), []);
  const plan = planOf([1, 1, 2, 1, 1, 2]);
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // It cuts nothing out and follows no object: it only draws her shots, in its own look, their light read before the
  // render (every shot under it: a dark one is lifted before its contrast).
  assert.equal(motion.drawn, undefined);
  assert.deepEqual(readsDrawn(nike.code), [{ shot: ANY_SHOT, kinds: ["light"] }]);
  assert.deepEqual(motion.fonts, ["Big Shoulders Display"]);
  assert.equal(motion.texts!.mots, WORDS);
  assert.equal(motion.texts!.beat, "18");
  // Its last shot (two beats from image 108 of its 144) has played a beat on its last beat: frozen there, on image 126.
  assert.equal(motion.texts!.freeze, "126");
  // A last shot of a single beat has not: it plays to the end.
  assert.equal(planOf([1, 1, 2, 1, 1, 1]).layers![0]!.motion.texts!.freeze, undefined);
  // Its settings: her colour and a plain entry only when asked (the defaults are never written).
  const filled = readPieceFill(nike, { fits: true, missing: "", texts: [{ slot: "mots", text: WORDS }], objects: [], settings: [{ name: "couleur", value: "sienne" }, { name: "entree", value: "strobo" }] })!;
  assert.deepEqual(filled.settings, { couleur: "sienne" });
  // No sound of its own: the original's sound is its music.
  assert.equal(motion.sounds, undefined);
});

test("« Montage sport noir et blanc » (effect v1): a word per shot on its cut through two images in negative, the first through the strobe, a red shot in four, its quick shots jerky, its freeze", () => {
  const layer = layerOf(planOf([1, 1, 2, 1, 1, 2]));
  const at = (f: number) => {
    const tree = nodes(sceneAt(f, layer));
    const footage = tree.find((n) => n.type === "Footage");
    const word = tree.find((n) => n.type === "FitText");
    return { footage, filter: String(style(footage).filter ?? ""), tint: tree.some((n) => n.type === "Tint"), word: String(word?.children.join("") ?? ""), ink: inner(word).color, top: style(word).top };
  };
  // Its first word through the original's strobe: two images red (white words), three in negative (black), two red, then black and white (red words).
  for (const f of [0, 1, 5, 6]) assert.deepEqual([at(f).tint, at(f).ink], [true, "#ffffff"], `image ${f}`);
  for (const f of [2, 3, 4]) assert.deepEqual([/invert/.test(at(f).filter), at(f).ink], [true, "#000000"], `image ${f}`);
  assert.deepEqual([at(7).tint, /invert/.test(at(7).filter), at(7).ink, at(7).word], [false, false, "#f2000c", "préparer"]);
  // The next word lands on its cut (image 18): two images in negative, then its black and white.
  assert.deepEqual([at(18).word, /invert/.test(at(18).filter), /invert/.test(at(19).filter), /invert/.test(at(20).filter)], ["frapper", true, true, false]);
  // Its third shot (rank 2) all red, multiplied: its word white.
  assert.deepEqual([at(40).tint, at(40).ink, at(40).word], [true, "#ffffff", "sauter"]);
  // Its quick shots (a beat) held image by image; the shot of two beats plays as filmed.
  assert.equal(at(10).footage!.props.hold, 3);
  assert.equal(at(50).footage!.props.hold, undefined);
  // Its words at the middle of the frame, in condensed capitals (the model's: her title face is a serif).
  assert.equal(at(10).top, 760);
  assert.match(String(inner(nodes(sceneAt(10, layer)).find((n) => n.type === "FitText")).fontFamily), /^'Big Shoulders Display'/);
  // Its last gesture frozen from its last beat (image 126): held on the image it has played to (18 of its shot).
  assert.equal(at(126).footage!.props.hold, 18);
  assert.equal(at(140).footage!.props.hold, 18);
  // Every image in its own black and white: never her shot in colour under it.
  for (let f = 0; f < layer.durationInFrames; f += 5) assert.match(at(f).filter, /grayscale\(1\)/, `image ${f}`);
  // Its curve as the original's when her shot's light is not read; a dark shot of hers lifted before it (a gym at
  // night, a mean light of 0.18: ×1.9 at most), a bright one barely darkened (×0.9 at least).
  assert.match(at(10).filter, /^grayscale\(1\) brightness\(1\.00\) contrast\(1\.45\)/);
  const lit = (mean: number) => String(style(nodes(sceneAt(10, layer, {}, () => ({ mean, high: mean + 0.3 }))).find((n) => n.type === "Footage")).filter);
  assert.match(lit(0.18), /^grayscale\(1\) brightness\(1\.90\)/);
  assert.match(lit(0.3), /^grayscale\(1\) brightness\(1\.50\)/);
  assert.match(lit(0.7), /^grayscale\(1\) brightness\(0\.90\)/);
});

test("« Montage sport noir et blanc » (effect v1): fewer words than shots land on some cuts, more land a beat each, a plain entry on her word", () => {
  const few = layerOf(planOf([1, 1, 1, 1, 1, 1], { mots: "pétrir, cuire, servir" }));
  const wordAt = (layer: LayerInput, f: number) => String(nodes(sceneAt(f, layer)).find((n) => n.type === "FitText")?.children.join("") ?? "");
  // Three words over six shots: on the cuts of its first, third and fifth shots, each staying on until the next.
  assert.deepEqual([0, 20, 40, 60, 80, 100].map((f) => wordAt(few, f)), ["pétrir", "pétrir", "cuire", "cuire", "servir", "servir"]);
  // No flash on a cut without a word.
  assert.doesNotMatch(String(style(nodes(sceneAt(18, few)).find((n) => n.type === "Footage")).filter), /invert/);
  // Ten words over six shots (eight beats): a word a beat, never more words than beats.
  const many = layerOf(planOf([1, 1, 1, 1, 2, 2], { mots: "un, deux, trois, quatre, cinq, six, sept, huit, neuf, dix" }));
  assert.deepEqual([0, 18, 36, 54, 72, 90, 108, 126].map((f) => wordAt(many, f)), ["un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit"]);
  // A long group on two lines as even as can be.
  assert.equal(wordAt(layerOf(planOf([1, 1, 1], { mots: "le premier geste, la corde" })), 10), "le premier\ngeste");
  // A plain entry on her word: its first word lands like the others, two images in negative, no red.
  const plain = layerOf(planOf([1, 1, 1], { mots: WORDS }, { entree: "coupe" }));
  const tree = (f: number) => nodes(sceneAt(f, plain));
  assert.deepEqual([0, 1, 2].map((f) => /invert/.test(String(style(tree(f).find((n) => n.type === "Footage")).filter))), [true, true, false]);
  assert.equal(tree(0).some((n) => n.type === "Tint"), false);
});

test("« Montage sport noir et blanc » (effect v1): its word goes where no face is, and takes her colour on her word only when it holds", () => {
  const layer = layerOf(planOf([2, 2, 2]));
  const topAt = (f: number, faceY: number[]) => {
    const track = () => ({ hands: [], bodies: [], faces: faceY.map((y, id) => ({ id, x: 540, y, width: 260, height: 300, points: { right_eye: { x: 500, y: y - 40 }, left_eye: { x: 580, y: y - 40 }, nose: { x: 540, y }, mouth: { x: 540, y: y + 60 } } })) });
    return style(nodes(sceneAt(f, layer, { track })).find((n) => n.type === "FitText")).top;
  };
  assert.equal(topAt(10, []), 760);
  // A face in the middle: up; faces in the middle and up: down; faces everywhere: the middle, as the original.
  assert.equal(topAt(10, [960]), 300);
  assert.equal(topAt(10, [960, 450]), 1040);
  assert.equal(topAt(10, [960, 450, 1250]), 760);
  // Her colour on her word, when vivid and dark enough (a strong blue); a pale one stays the red.
  const inkWith = (accent: string) => inner(nodes(sceneAt(10, { ...layer, texts: { ...layer.texts, couleur: "sienne" } }, { brand: { displayFont: "Anton", bodyFont: "Inter", accent } })).find((n) => n.type === "FitText")).color;
  assert.equal(inkWith("#1f4fd1"), "#1f4fd1");
  assert.equal(inkWith("#f7c6d0"), "#f2000c");
  // Her own title face when it is condensed already.
  assert.match(String(inner(nodes(sceneAt(10, layer, { brand: { displayFont: "Anton", bodyFont: "Inter" } })).find((n) => n.type === "FitText")).fontFamily), /^'Anton'/);
  // Photos among its shots, words missing: it still draws its look, nothing breaks.
  assert.ok(sceneAt(10, { ...layer, texts: { beat: "18" }, shots: layer.shots.map((s) => ({ ...s, kind: "photo", aspect: 0.75 })) }));
});
