import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { pieceMusicShape, pieceTestPlan, readPieceFill } from "../pieces.ts";
import { editPlanSchema, type EditPlan } from "../schemas.ts";
import { ANY_SHOT, readsDrawn } from "../subject.ts";
import { eventail, starFrames } from "./eventail.ts";

// « Éventail de bandes », the effect of the bank (eventail.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };
type LayerInput = { durationInFrames: number; shots: { from: number; durationInFrames: number; kind: string; aspect: number }[]; texts: Record<string, string> };

/**
 * Its code run at one frame with a stand-in scope (the kit's pieces as named nodes), over the shots of its layer;
 * `heart` and `vanish`: what SubjectBox and VanishingPoint find in its first shot (nothing by default, as in the check).
 */
function sceneAt(frame: number, layer: LayerInput, brand: Record<string, unknown> = {}, reads: { heart?: Box; vanish?: { x: number; y: number } } = {}): Drawn | null {
  const h = (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() });
  const scope: Record<string, unknown> = {
    React: { createElement: h, Fragment: "Fragment" },
    useCurrentFrame: () => frame,
    AbsoluteFill: "AbsoluteFill",
    Footage: "Footage",
    FitText: "FitText",
    WindowStar: "WindowStar",
    Paper: "Paper",
    SubjectBox: (_shot: unknown, _frame: number, _laid: unknown, object: string) => (object && reads.heart ? reads.heart : null),
    VanishingPoint: (_shot: unknown, _frame: number, _laid: unknown, options: { fallback?: unknown }) => reads.vanish ?? options.fallback ?? null,
  };
  const Scene = new Function(...Object.keys(scope), `${eventail.code}\nreturn Scene;`)(...Object.values(scope)) as (p: unknown) => Drawn | null;
  return Scene({ width: 1080, height: 1920, brand: { displayFont: "Instrument Serif", bodyFont: "Inter Tight", accent: "#b5543a", palette: { secondary: "#b5543a", light: "#ffffff", dark: "#141414" }, ...brand }, ...layer });
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const style = (n: Drawn | undefined) => (n?.props.style ?? {}) as Record<string, unknown>;

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

/** Its star's shot after a lead shot, then her next shots, the effect over them; 100 BPM unless said (a beat is 18 images). */
const planOf = (seconds: number[], options: { bpm?: number; texts?: Record<string, string>; objects?: Record<string, string>; settings?: Record<string, string> } = {}) =>
  pieceTestPlan({
    piece: eventail,
    shots: [{ file: "lead", at: 1, seconds: 1.2 }, ...seconds.map((s, i) => ({ file: `f${i}`, at: 0.5, seconds: s })), { file: "after", at: 2, seconds: 1.8 }],
    span: [1.2, 1.2 + seconds.reduce((a, b) => a + b, 0)],
    fill: { texts: options.texts ?? {}, objects: options.objects ?? {}, settings: options.settings ?? {} },
    bpm: options.bpm ?? 100,
  });

test("« Éventail de bandes » (effect v2): its star on the beats of its first shot, on the half beats or the quarters when shorter, its heart named on that shot", () => {
  assert.deepEqual(checkMotionCode(eventail.code), []);
  // Its star's shot six seconds (ten beats), then one of her shots: a band on each of the beats 1 to 6, the whole shot on beat 7.
  const plan = planOf([6, 1.2], { objects: { coeur: "pendant lamp" } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => motion.texts![`band_${k}`]), ["18", "36", "54", "72", "90", "108"]);
  assert.equal(motion.texts!.whole, "126");
  // Its heart on its first shot (the second of her shots), followed only there; its lines' vanishing point read on its shots.
  assert.deepEqual(motion.drawn, { shots: 4, objects: [{ shot: 1, name: "pendant lamp" }] });
  assert.ok(motion.code!.includes('"pendant lamp"') && !motion.code!.includes('"@coeur"'));
  assert.deepEqual(readsDrawn(eventail.code), [{ shot: ANY_SHOT, kinds: ["vanish"] }]);
  // A first shot of 3,6 s: on the half beats, the whole shot held a beat and a half.
  const half = planOf([3.6]).layers![0]!.motion.texts!;
  assert.deepEqual([half.band_0, half.band_5, half.whole], ["9", "54", "63"]);
  // Three seconds at 60 BPM (a beat is 30 images): on the quarters.
  assert.deepEqual(starFrames(90, 30), { bands: [8, 15, 23, 30, 38, 45], whole: 53 });
  // Shorter still (a first shot of a beat: the editor's slip): its seven steps squeezed, the whole shot last.
  const squeezed = starFrames(18, 18);
  assert.ok(squeezed.whole >= 7 && squeezed.bands.every((b, k) => b < squeezed.whole && (k === 0 || b > squeezed.bands[k - 1]!)), JSON.stringify(squeezed));
  // Its title optional; its settings only when asked.
  assert.equal(motion.texts!.titre, undefined);
  const filled = readPieceFill(eventail, { fits: true, missing: "", texts: [{ slot: "titre", text: "Chez Lino" }], objects: [{ slot: "coeur", name: "none" }], settings: [{ name: "fond", value: "accent" }, { name: "format", value: "vertical" }] })!;
  assert.deepEqual([filled.texts, filled.objects, filled.settings], [{ titre: "Chez Lino" }, {}, { fond: "accent" }]);
  assert.equal(motion.sounds, undefined);
  // Its music through a small speaker until the whole shot, a hit of it on each step (the square and each band, on its
  // beats), silent after each one to the next step; all of it on the whole shot.
  const fill = { texts: {}, objects: { coeur: "pendant lamp" }, settings: {} };
  const shape = pieceMusicShape({ piece: eventail, fill, plan, layer: plan.layers![0]!, bpm: 100 })!;
  const steps = [0, 18, 36, 54, 72, 90, 108, 126];
  assert.deepEqual(shape.pauses, steps.slice(0, -1).map((f, k) => ({ from: Math.round((1.2 + (f + 0.56 * 18) / 30) * 1000) / 1000, to: Math.round((1.2 + steps[k + 1]! / 30) * 1000) / 1000 })));
  assert.deepEqual(shape.filters!.map((f) => [f.kind, f.from, f.to]), [["radio", 1.2, 5.4]]);
  // On the half beats: its speaker only, its silences would end off the beat.
  const halfShape = pieceMusicShape({ piece: eventail, fill: { texts: {}, objects: {}, settings: {} }, plan: planOf([3.6]), layer: planOf([3.6]).layers![0]!, bpm: 100 })!;
  assert.equal(halfShape.pauses, undefined);
  assert.deepEqual(halfShape.filters!.map((f) => [f.kind, f.from, f.to]), [["radio", 1.2, 3.3]]);
});

test("« Éventail de bandes » (effect v2): her shot through a star of windows on its ground, whole on the seventh step in a thin frame, her next shot after it", () => {
  const layer = layerOf(planOf([6, 1.2]));
  const at = (f: number, brand: Record<string, unknown> = {}, reads = {}, l = layer) => nodes(sceneAt(f, l, brand, reads));
  // Before the whole shot: its star of windows onto its first shot, turned a quarter (the frame stands), on its marks.
  const star = at(50).find((n) => n.type === "WindowStar")!;
  assert.deepEqual([star.props.upright, star.props.times, star.props.center], [true, [18, 36, 54, 72, 90, 108], { x: 540, y: 960 }]);
  assert.equal(at(50).find((n) => n.type === "Footage")!.props.shot, 1);
  // In the original's black and white: its blacks lifted to the blue black, its whites held.
  assert.match(String(style(at(50).find((n) => n.type === "Footage")).filter), /grayscale\(1\)/);
  assert.ok(at(50).some((n) => style(n).mixBlendMode === "lighten" && style(n).backgroundColor === "#03090d"));
  // On the seventh step: the whole shot at once, no star, a thin frame of the ground over it (32 px a side, 37 above and below).
  assert.equal(at(126).some((n) => n.type === "WindowStar"), false);
  assert.equal(style(at(126).find((n) => n.props.key === "film")).clipPath, "inset(37px 32px)");
  assert.equal(at(126).find((n) => n.type === "Footage")!.props.shot, 1);
  // Her next shot in the same frame at its cut (image 180).
  assert.equal(at(190).find((n) => n.type === "Footage")!.props.shot, 2);
  // Its ground: the original's bordeaux (her darkest is a grey, her main colour a light one); her own deep colour when
  // she has one; her main colour, or the bordeaux, on her word.
  const ground = (brand: Record<string, unknown>, texts: Record<string, string> = {}) =>
    at(10, brand, {}, { ...layer, texts: { ...layer.texts, ...texts } }).find((n) => n.type === "Paper")!.props.color;
  assert.equal(ground({}), "#440a0b");
  assert.equal(ground({ palette: { secondary: "#b5543a", light: "#ffffff", dark: "#1b2a5c" } }), "#1b2a5c");
  assert.equal(ground({}, { fond: "accent" }), "#b5543a");
  assert.equal(ground({ palette: { secondary: "#b5543a", light: "#ffffff", dark: "#1b2a5c" } }, { fond: "bordeaux" }), "#440a0b");
});

test("« Éventail de bandes » (effect v2): its centre on her shot's heart, else where its lines run, within an eighth of the middle; 16:9 and her colours on her word; its title", () => {
  const layer = layerOf(planOf([6]));
  const centre = (reads: { heart?: Box; vanish?: { x: number; y: number } }) => nodes(sceneAt(30, layer, {}, reads)).find((n) => n.type === "WindowStar")!.props.center;
  // A small heart found: on it; a large one (it fills the picture): where the lines run; nothing read: the middle.
  assert.deepEqual(centre({ heart: { x: 560, y: 860, w: 120, h: 100 }, vanish: { x: 300, y: 700 } }), { x: 620, y: 910 });
  assert.deepEqual(centre({ heart: { x: 100, y: 100, w: 800, h: 1200 }, vanish: { x: 600, y: 1000 } }), { x: 600, y: 1000 });
  // Far off: pulled within an eighth of the frame (135 px across, 240 px up and down).
  assert.deepEqual(centre({ vanish: { x: 1000, y: 200 } }), { x: 675, y: 720 });
  assert.deepEqual(centre({}), { x: 540, y: 960 });
  // In 16:9 on black on her word, as the original: its band in the middle of the frame, its star not turned.
  const wide = nodes(sceneAt(30, { ...layer, texts: { ...layer.texts, format: "horizontal" } }));
  assert.deepEqual([style(wide.find((n) => n.props.key === "box")).top, style(wide.find((n) => n.props.key === "box")).height], [656, 608]);
  assert.equal(wide.find((n) => n.type === "WindowStar")!.props.upright, false);
  // Her shots in their colours on her word.
  const coloured = nodes(sceneAt(30, { ...layer, texts: { ...layer.texts, couleur: "couleur" } }));
  assert.equal(style(coloured.find((n) => n.type === "Footage")).filter, "none");
  assert.equal(coloured.some((n) => style(n).mixBlendMode === "lighten"), false);
  // Its optional title: a small white line at the top while the star opens, gone with the whole shot.
  const titled = { ...layer, texts: { ...layer.texts, titre: "Chez Lino" } };
  const title = (f: number) => nodes(sceneAt(f, titled)).find((n) => n.type === "FitText");
  assert.deepEqual([style(title(0)).top, title(0)!.children.join("")], [200, "Chez Lino"]);
  assert.ok(title(125) && !title(126));
  assert.equal(nodes(sceneAt(30, layer)).some((n) => n.type === "FitText"), false);
});
