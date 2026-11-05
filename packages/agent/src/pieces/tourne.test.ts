import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { pieceMusicShape, pieceTestPlan, readPieceFill } from "../pieces.ts";
import { editPlanSchema, type EditPlan } from "../schemas.ts";
import { colourRanks, tourne } from "./tourne.ts";

// « Quart de tour, deux tons », the effect of the bank (tourne.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type LayerInput = { durationInFrames: number; shots: { from: number; durationInFrames: number; kind: string; aspect: number }[]; texts: Record<string, string> };

/** Its code run at one frame with a stand-in scope (the kit's pieces as named nodes), over the shots of its layer. */
function sceneAt(frame: number, layer: LayerInput): Drawn | null {
  const h = (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() });
  const scope: Record<string, unknown> = {
    React: { createElement: h, Fragment: "Fragment" },
    useCurrentFrame: () => frame,
    AbsoluteFill: "AbsoluteFill",
    Footage: "Footage",
    FitText: "FitText",
    Turn: "Turn",
    LensEdges: "LensEdges",
    Flash: "Flash",
  };
  const Scene = new Function(...Object.keys(scope), `${tourne.code}\nreturn Scene;`)(...Object.values(scope)) as (p: unknown) => Drawn | null;
  return Scene({ width: 1080, height: 1920, brand: { displayFont: "Bricolage Grotesque", bodyFont: "Inter", accent: "#2f6b4f" }, ...layer });
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const style = (n: Drawn | undefined) => (n?.props.style ?? {}) as Record<string, unknown>;

/** Its layer as the render gets it: its length, the Reel's shots up to its end (frames from its start), its texts. */
function layerOf(plan: EditPlan, aspects: number[] = []): LayerInput {
  const layer = plan.layers![0]!;
  const from = Math.round(layer.from * 30);
  const durationInFrames = Math.round((layer.to - layer.from) * 30);
  let t = 0;
  const shots = plan.segments.flatMap((s, i) => {
    if (!("clip_id" in s)) return [];
    const length = Math.round((s.out - s.in) * 30);
    const shot = { from: t - from, durationInFrames: length, kind: "video", aspect: aspects[i] ?? 16 / 9 };
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
const planOf = (beats: number[], texts: Record<string, string> = {}, settings: Record<string, string> = {}) =>
  pieceTestPlan({ piece: tourne, shots: run(beats), span: [1.2, 1.2 + 0.6 * beats.reduce((a, b) => a + b, 0)], fill: { texts, objects: {}, settings }, bpm: 100 });

test("« Quart de tour, deux tons » (effect v2): its colour on the shot held longest, its last flash, its two hits within its span", () => {
  assert.deepEqual(checkMotionCode(tourne.code), []);
  const plan = planOf([1, 2, 1, 1]);
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // It cuts nothing out and follows no object: it draws her shots turned, in its tones.
  assert.equal(motion.drawn, undefined);
  // Its colour on its second shot (two beats, the longest), never its first; its flash opens its last shot.
  assert.equal(motion.texts!.colour_0, "1");
  assert.equal(motion.texts!.colour_1, undefined);
  assert.equal(motion.texts!.flash, "3");
  // Its two hits: as it comes in, and the louder on the cut into its colour shot (0,6 s in).
  assert.deepEqual(motion.sounds, [
    { at: 0, sound: "deep cinematic impact hit", seconds: 1.5, skill: true },
    { at: 0.6, sound: "deep cinematic impact hit", seconds: 1.5, gain: 4, skill: true },
  ]);
  // Her music muffled as through a wall until the cut into its colour shot, open at once on it.
  assert.deepEqual(pieceMusicShape({ piece: tourne, fill: { texts: {}, objects: {}, settings: {} }, plan, layer: plan.layers![0]!, bpm: 100 })!.filters!.map((f) => [f.kind, f.from, f.to]), [["muffled", 1.2, 1.8]]);
  // Equal shots: its second; seven and more: two, never side by side, held longest; a shot past its end counts as seen.
  const cut = (lengths: number[]) => lengths.map((frames, k) => ({ from: lengths.slice(0, k).reduce((a, b) => a + b, 0), frames }));
  assert.deepEqual(colourRanks([0, 18, 36, 54].map((from) => ({ from, frames: 18 })), 72), [1]);
  assert.deepEqual(colourRanks(cut([18, 18, 36, 18, 18, 36, 18]), 162), [2, 5]);
  assert.deepEqual(colourRanks(cut([18, 18, 36, 18, 18, 36]), 144), [2]);
  assert.deepEqual(colourRanks([{ from: 0, frames: 18 }, { from: 18, frames: 18 }, { from: 36, frames: 90 }], 54), [1]);
  assert.deepEqual(colourRanks([{ from: -20, frames: 60 }], 40), []);
  // Its hits always within its span, two at most, for every count of shots it takes (each one or two beats long).
  for (let n = tourne.shots[0]; n <= tourne.shots[1]; n++) {
    const beats = Array.from({ length: n }, (_, k) => 1 + ((k * 7) % 3 === 1 ? 1 : 0));
    const laid = planOf(beats).layers![0]!;
    const sounds = laid.motion.sounds ?? [];
    assert.ok(sounds.length >= 1 && sounds.length <= 2 && sounds.every((s) => s.at >= 0 && s.at < laid.to - laid.from), `${n} shots: ${JSON.stringify(sounds)}`);
  }
  // No colour on her word: all in two tones, its entry's hit alone.
  const plain = planOf([1, 2, 1, 1], {}, { couleur: "aucune" }).layers![0]!.motion;
  assert.equal(plain.texts!.colour_0, undefined);
  assert.equal(plain.sounds!.length, 1);
  // Its title optional: left out, nothing written; its default settings never written.
  assert.equal(motion.texts!.titre, undefined);
  const filled = readPieceFill(tourne, { fits: true, missing: "", texts: [{ slot: "titre", text: "" }], objects: [], settings: [{ name: "sens", value: "horaire" }, { name: "couleur", value: "aucune" }] })!;
  assert.deepEqual([filled.texts, filled.settings], [{}, { couleur: "aucune" }]);
});

test("« Quart de tour, deux tons » (effect v2): her shots in width turned a quarter clockwise, upright ones upright, two tones but where colour counts, its lens edges", () => {
  // Its third shot filmed upright.
  const layer = layerOf(planOf([1, 2, 1, 1]), [16 / 9, 16 / 9, 16 / 9, 9 / 16, 16 / 9, 16 / 9]);
  const at = (f: number, l = layer) => nodes(sceneAt(f, l));
  // Its shots in width turned a quarter, clockwise (the top of the scene on the right), each drawn whole at 1920 × 1080.
  const turn = at(5).find((n) => n.type === "Turn")!;
  assert.equal(turn.props.angle, 90);
  const draw = turn.props.draw as (size: { width: number; height: number }) => Drawn;
  assert.deepEqual([draw({ width: 1920, height: 1080 }).props.shot, style(draw({ width: 1920, height: 1080 })).width], [1, 1920]);
  // Its upright one plays upright, full frame.
  assert.equal(at(60).some((n) => n.type === "Turn"), false);
  assert.equal(at(60).find((n) => n.type === "Footage")!.props.shot, 3);
  // Two tones but on its colour shot (rank 1), which keeps its colours without lens edges.
  const filterAt = (f: number) => String(style(at(f).find((n) => typeof n.props.style === "object" && /url\(#tourne-piece/.test(String(style(n).filter ?? "")))).filter);
  assert.match(filterAt(5), /tourne-piece-duo/);
  assert.match(filterAt(30), /tourne-piece-colour/);
  assert.equal(at(5).some((n) => n.type === "LensEdges"), true);
  assert.equal(at(30).some((n) => n.type === "LensEdges"), false);
  // One way then the other on her word.
  const both = { ...layer, texts: { ...layer.texts, sens: "alterne" } };
  assert.deepEqual([at(5, both).find((n) => n.type === "Turn")!.props.angle, at(30, both).find((n) => n.type === "Turn")!.props.angle], [90, -90]);
  // No colour on her word: its second shot in two tones too.
  assert.match(String(style(at(30, { ...layer, texts: { ...layer.texts, couleur: "aucune" } }).find((n) => /url\(#tourne-piece/.test(String(style(n).filter ?? "")))).filter), /tourne-piece-duo/);
});

test("« Quart de tour, deux tons » (effect v2): its last shot through the original's last flash, its optional title turned a quarter", () => {
  const layer = layerOf(planOf([1, 2, 1, 1]));
  // Its last shot (rank 3) from image 72: the shot before it blurred over its last five images, a flash on its first
  // image (overexposed, not blurred), its second image still blurred, then sharp.
  const filterAt = (f: number) => String(style(nodes(sceneAt(f, layer)).find((n) => /url\(#tourne-piece/.test(String(style(n).filter ?? "")))).filter);
  const blur = (f: number) => Number(/blur\((\d+)px\)/.exec(filterAt(f))?.[1] ?? 0);
  assert.deepEqual([66, 67, 68, 69, 70, 71, 72, 73, 74].map(blur), [0, 5, 12, 20, 20, 21, 0, 12, 0]);
  assert.match(filterAt(72), /brightness\(1\.6\)/);
  const flash = nodes(sceneAt(72, layer)).find((n) => n.type === "Flash")!;
  assert.deepEqual([flash.props.at, flash.props.frames], [72, 1]);
  // Its optional title, turned a quarter, over its first shot to the first cut a second and a half in (image 54).
  const titled = { ...layer, texts: { ...layer.texts, titre: "Atelier Terre" } };
  const title = (f: number) => nodes(sceneAt(f, titled)).find((n) => n.type === "FitText");
  assert.equal(style(title(10)).transform, "rotate(90deg)");
  assert.equal(title(10)!.children.join(""), "Atelier Terre");
  assert.ok(title(53) && !title(54));
  // Without it, nothing written.
  assert.equal(nodes(sceneAt(10, layer)).some((n) => n.type === "FitText"), false);
  // A single shot (its span shorter than a cut): turned, in two tones, no flash.
  const one = { ...layer, durationInFrames: 15, shots: layer.shots.slice(0, 2), texts: { beat: "18" } };
  assert.ok(nodes(sceneAt(10, one)).some((n) => n.type === "Turn"));
  assert.equal(nodes(sceneAt(10, one)).some((n) => n.type === "Flash"), false);
});
