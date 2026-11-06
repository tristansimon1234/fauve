import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceLine, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { subjectsDrawn } from "../subject.ts";
import { affiches } from "./affiches.ts";

// « Tes produits en affiches », the effect of the bank (affiches.ts): its own checks, beside the bank's (features.test.ts).

/** Four of her products cut by the montage under it, one a beat at 120 BPM, between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.5 },
  { file: "croissant", at: 0.5, seconds: 0.5 },
  { file: "tarte", at: 2, seconds: 0.5 },
  { file: "flan", at: 1, seconds: 0.5, photo: true },
  { file: "eclair", at: 3, seconds: 0.5 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Tes produits en affiches » (effect v1): its layer over her run of products, nothing cut out, no sound, its words and settings for the editor", () => {
  const plan = pieceTestPlan({ piece: affiches, shots, span: [1.5, 3.5], fill: { texts: { noms: "Croissant / Tarte / Flan / Éclair" }, objects: {}, settings: {} }, bpm: 120 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3, 4]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "affiches", version: 1 });
  assert.deepEqual(motion.texts, { beat: "15", mine: "1,2,3,4", noms: "Croissant / Tarte / Flan / Éclair" });
  // Light: nothing cut out or followed, no sound (the original has none), the montage's music as it is.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.deepEqual(subjectsDrawn(affiches.code), []);
  assert.deepEqual(checkMotionCode(affiches.code), []);
  assert.doesNotMatch(affiches.code, /transform|scale\(/);
  assert.match(pieceLine(affiches), /^affiches — Produits en affiches : .* Il faut : .* Se pose : .* Ses mots : .* Réglages : couleurs \(vives, sa-charte, noir\) ; etiquettes \(une-sur-deux, toutes\)\.$/);
});

test("« Tes produits en affiches »: its names optional, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "noms", text: "Croissant au beurre / Tarte aux fraises / Flan pâtissier / Éclair au café / Chausson aux pommes / Brioche" }], objects: [], settings: [] };
  assert.equal(readPieceFill(affiches, answer)!.texts.noms, "Croissant au beurre / Tarte aux fraises / Flan pâtissier / Éclair au café / Chausson aux pommes /");
  assert.deepEqual(readPieceFill(affiches, { ...answer, texts: [] })!.texts, {});
  assert.deepEqual(readPieceFill(affiches, { ...answer, settings: [{ name: "couleurs", value: "noir" }] })!.settings, { couleurs: "noir" });
});

test("« Tes produits en affiches » is offered on close shots of her products, never on wide shots alone", () => {
  const clip = (framing: string) =>
    ({
      duration: 6,
      orientation: "portrait",
      summary: "un croissant sur une assiette",
      setting: "intérieur, une boulangerie",
      lighting: "good",
      shots: [{ start: 0, end: 6, description: "un croissant doré sur une assiette", subject: "croissant", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera: "static", subject_box: [300, 600, 500, 600], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  const offered = (framing: string, files: number) => piecesOffered([affiches], pieceShots([{ media_id: "a", analysis: clip(framing) }, { media_id: "b", analysis: clip(framing) }], {}), files).map((p) => p.key);
  assert.deepEqual(offered("close", 2), ["affiches"]);
  assert.deepEqual(offered("wide", 2), []);
  assert.deepEqual(offered("close", 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; brand?: Record<string, unknown>; aspects?: number[]; count?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Paper: "Paper", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${affiches.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const count = props.count ?? 8;
  // A lead shot that started before it, then its run, one a beat (15 frames), then the one after.
  const list = [{ from: -20, durationInFrames: 20, kind: "video", aspect: 9 / 16 }, ...Array.from({ length: count }, (_, i) => ({ from: i * 15, durationInFrames: 15, kind: "video", aspect: props.aspects?.[i] ?? 9 / 16 }))];
  const mine = Array.from({ length: count }, (_, i) => i + 1).join(",");
  const brand = { name: "Maison Farine", displayFont: "Anton", bodyFont: "Inter Tight", accent: "#b5293f", palette: { secondary: "#1d3b2a" }, ...props.brand };
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames: count * 15, brand, shots: list, texts: { beat: "15", mine, noms: "Croissant / Tarte / Flan / Éclair / Chausson / Brioche / Cookie / Macarons", ...props.texts } });
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const boxOf = (node: Drawn) => (node.props.style ?? {}) as unknown as Box;
const keyed = (tree: Drawn, key: string) => flatten(tree).find((n) => n.props.key === key) ?? null;

test("« Tes produits en affiches » draws each shot under it as a poster for its time: the original's colours in order, a white print, its names on one in two", () => {
  const at = (f: number) => {
    const tree = drawAt(f);
    const pic = flatten(tree).find((n) => n.type === "Footage")!;
    return { tree, ground: flatten(tree).find((n) => n.type === "Paper")!.props.color, shot: pic.props.shot, pic: boxOf(pic), print: boxOf(keyed(tree, "print")!), names: flatten(tree).filter((n) => n.type === "FitText").map((n) => n.children.join("")) };
  };
  // One poster a shot, cut on its shots' cuts, on the original's eight grounds in its order.
  assert.deepEqual([0, 15, 30, 45, 60, 75, 90, 105].map((f) => at(f).ground), ["#fc1f10", "#0052b9", "#ff6127", "#ffa7af", "#97989b", "#060608", "#2391d6", "#ffc91b"]);
  assert.deepEqual([0, 14, 15, 29, 30].map((f) => at(f).shot), [1, 1, 2, 2, 3]);
  // Its print: a white border round her shot, shaped as her shot (an upright one in portrait), two cut by an edge.
  const first = at(5);
  assert.ok(first.pic.left > first.print.left && first.pic.top > first.print.top);
  assert.ok(Math.abs(first.pic.width / first.pic.height - 0.8) < 0.01);
  assert.ok(at(35).print.left < 0 && at(50).print.top < 0);
  assert.ok(Math.abs(at(20).pic.width / at(20).pic.height - 1) < 0.01, "the original's second place, square");
  // Its names: the first, the last and one in two between them (the original's four of eight), each its own shot's.
  assert.deepEqual([0, 15, 30, 45, 60, 75, 90, 105].map((f) => at(f).names), [["Croissant"], [], [], ["Éclair"], [], ["Brioche"], [], ["Macarons"]]);
  // Each in the zone, in capitals on the paper under the picture.
  for (const f of [0, 45, 75, 105]) {
    const { tree, pic, print } = at(f);
    const name = flatten(tree).find((n) => n.type === "FitText")!;
    const b = boxOf(name);
    const lowered = b.top + b.height > 960;
    assert.ok(b.top >= 80 && b.top + b.height <= 1440 && b.left >= (lowered ? 140 : 40) && b.left + b.width <= (lowered ? 940 : 1040), `${f}: ${JSON.stringify(b)}`);
    assert.ok(b.top + b.height / 2 > pic.top + pic.height && b.top + b.height / 2 < print.top + print.height, `${f}: ${JSON.stringify({ b, pic, print })}`);
    assert.equal((name.props.innerStyle as Record<string, string>).textTransform, "uppercase");
  }
  // Every one named as her words ask; none without names; her colours, or black.
  assert.deepEqual([0, 15, 30].map((f) => flatten(drawAt(f, { texts: { etiquettes: "toutes" } })).filter((n) => n.type === "FitText").map((n) => n.children.join(""))), [["Croissant"], ["Tarte"], ["Flan"]]);
  assert.equal(flatten(drawAt(0, { texts: { noms: "" } })).filter((n) => n.type === "FitText").length, 0);
  assert.deepEqual([0, 15].map((f) => flatten(drawAt(f, { texts: { couleurs: "sa-charte" } })).find((n) => n.type === "Paper")!.props.color), ["#b5293f", "#1d3b2a"]);
  assert.equal(flatten(drawAt(15, { texts: { couleurs: "noir" } })).find((n) => n.type === "Paper")!.props.color, "#060608");
  // A horizontal shot in a print in width; a run of two, the first named (never the second, as the model).
  const wide = flatten(drawAt(5, { aspects: [16 / 9] })).find((n) => n.type === "Footage")!;
  assert.ok(Math.abs(boxOf(wide).width / boxOf(wide).height - 4 / 3) < 0.01);
  assert.deepEqual([0, 15].map((f) => flatten(drawAt(f, { count: 2 })).filter((n) => n.type === "FitText").map((n) => n.children.join(""))), [["Croissant"], []]);
  // Her list written whole for the scene check, unseen.
  const copy = keyed(drawAt(0), "names-copy")!;
  assert.ok("data-fauve-decor" in copy.props && (copy.props.style as Record<string, number>).opacity === 0);
});
