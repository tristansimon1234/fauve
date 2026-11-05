import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { vlogMoments, vlogVille, VLOG_RUN } from "./vlog-ville.ts";

// « Ta ville racontée », the effect of the bank (vlog-ville.ts): its own checks, beside the bank's (features.test.ts).

/** Its three shots as the chain cuts them under it: her wide calm shot (2,6 s), her detail (1,2 s), her from behind (2,4 s), after a lead and before an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1 },
  { file: "street", at: 0.5, seconds: 2.6 },
  { file: "detail", at: 1, seconds: 1.2 },
  { file: "back", at: 2, seconds: 2.4 },
  { file: "after", at: 2, seconds: 1.8 },
];
const words = { phrase: "Chaque quartier a son rythme", ici: "voici Belleville.", nom: "Belleville", signature: "par Café des Arts", genre: "un court-métrage." };

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
function sceneOf(code: string) {
  let current = 0;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => current };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const Scene = make(React, ...Object.values(scope));
  return (frame: number, props: Record<string, unknown>) => {
    current = frame;
    return Scene(props);
  };
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const textOf = (node: Drawn): string => nodes(node).flatMap((n) => n.children.flat(Infinity).filter((c): c is string => typeof c === "string")).join("");
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;

test("« Ta ville racontée » (effect v1): its layer over her three shots, its drop on the cut into her detail, its title on her last shot, its music held back then muffled", () => {
  const plan = pieceTestPlan({ piece: vlogVille, shots, span: [1, 7.2], fill: { texts: words, objects: {}, settings: {} }, bpm: 76 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3]);
  assert.deepEqual(layer.motion.piece, { key: "vlog-ville", version: 1 });
  // Its words from 23 % of her first shot, her second sentence from 67 %, the drop on the cut (2,6 s in), its title half a second into her last.
  assert.deepEqual(vlogMoments({ frames: 186, shots: [{ from: 0, frames: 78 }, { from: 78, frames: 36 }, { from: 114, frames: 72 }] }), { from: 18, ici: 52, drop: 78, title: 129 });
  const texts = layer.motion.texts!;
  assert.deepEqual([texts.words_from, texts.words_second, texts.drop, texts.title], ["18", "52", "78", "129"]);
  assert.equal(texts.mine, "1,2,3");
  // Nothing cut out; its music: silent under her words, back on the drop, muffled under her title.
  assert.equal(layer.motion.drawn, undefined);
  const shape = pieceMusicShape({ piece: vlogVille, fill: { texts: words, objects: {}, settings: {} }, plan, layer, bpm: 76 })!;
  assert.deepEqual(shape.pauses, [{ from: 1, to: 3.6 }]);
  assert.deepEqual(shape.filters?.map((f) => [f.kind, f.from, f.to]), [["muffled", 5.133, 6.6]]);
  // Two shots only: its title after the burst and its sweep on her detail, when there is room for it; else none.
  assert.equal(vlogMoments({ frames: 180, shots: [{ from: 0, frames: 70 }, { from: 70, frames: 110 }] }).title, 70 + 22 + 14 + 15);
  assert.equal(vlogMoments({ frames: 150, shots: [{ from: 0, frames: 70 }, { from: 70, frames: 80 }] }).title, -1);
});

test("« Ta ville racontée » (effect v1): her words one at a time, the burst of nine close-ups on the drop, then the sweep, her name between quotes in red", () => {
  const plan = pieceTestPlan({ piece: vlogVille, shots, span: [1, 7.2], fill: { texts: words, objects: {}, settings: {} }, bpm: 76 });
  const layer = plan.layers![0]!;
  const draw = sceneOf(layer.motion.code!);
  // The shots as its code gets them: frames from its start (the lead began before it).
  const laid = [
    { from: -30, durationInFrames: 30 },
    { from: 0, durationInFrames: 78 },
    { from: 78, durationInFrames: 36 },
    { from: 114, durationInFrames: 72 },
  ];
  const brand = { name: "Café des Arts", displayFont: "Unbounded", bodyFont: "Inter", accent: "#1f6b4f", palette: {} };
  const props = { width: 1080, height: 1920, durationInFrames: 186, brand, shots: laid, texts: layer.motion.texts };
  const sub = (f: number) => {
    const s = nodes(draw(f, props)).find((n) => n.props.key === "sub");
    return s ? textOf(s) : null;
  };
  assert.equal(sub(10), null);
  assert.equal(sub(19), "Chaque");
  assert.equal(sub(50), "rythme");
  assert.equal(sub(53), "voici");
  // Her place's name held over the burst, gone after it.
  assert.equal(sub(90), "Belleville.");
  assert.equal(sub(101), null);
  const box = nodes(draw(30, props)).find((n) => n.props.key === "sub")!;
  assert.ok(Number(styleOf(box).top) + Number(styleOf(box).height) <= 1440 && Number(styleOf(box).left) === 140 && Number(styleOf(box).width) === 800);
  // Nothing drawn over her first shot; on the drop, her detail in nine close-ups of 2 and 3 images, each framed elsewhere.
  assert.equal(nodes(draw(40, props)).filter((n) => n.type === "Footage").length, 0);
  const origins: string[] = [];
  for (let f = 78; f < 78 + 22; f++) {
    const footage = nodes(draw(f, props)).find((n) => n.type === "Footage")!;
    assert.equal(footage.props.shot, 2);
    origins.push(String(styleOf(footage).transformOrigin));
  }
  const runs = origins.reduce<number[]>((acc, o, i) => (i && o === origins[i - 1] ? [...acc.slice(0, -1), acc.at(-1)! + 1] : [...acc, 1]), []);
  assert.deepEqual(runs, VLOG_RUN);
  assert.equal(new Set(origins).size, 9);
  assert.ok(nodes(draw(105, props)).some((n) => n.type === "feGaussianBlur"));
  assert.equal(nodes(draw(118, props)).filter((n) => n.type === "Footage").length, 0);
  // Its title from half a second into her last shot: her name between quotes, her signature above, its line under, in her vivid colour.
  assert.equal(nodes(draw(128, props)).filter((n) => n.type === "FitText").length, 0);
  const [name, signature, genre] = nodes(draw(140, props)).filter((n) => n.type === "FitText");
  assert.deepEqual([textOf(name!), textOf(signature!), textOf(genre!)], ["”Belleville”", "par Café des Arts", "un court-métrage."]);
  assert.ok([name, signature, genre].every((n) => (n!.props.innerStyle as Record<string, unknown>).color === "#1f6b4f"));
  for (const n of [name, signature, genre]) assert.ok(Number(styleOf(n!).left) >= 140 && Number(styleOf(n!).left) + Number(styleOf(n!).width) <= 940);
  // Without her optional words: her name alone; a pale accent: a film title's red.
  const bare = { ...props, brand: { ...brand, accent: "#efe6d8" }, texts: { ...layer.motion.texts, signature: "", genre: "" } };
  const alone = nodes(draw(140, bare)).filter((n) => n.type === "FitText");
  assert.equal(alone.length, 1);
  assert.equal((alone[0]!.props.innerStyle as Record<string, unknown>).color, "#d7261e");
  // « rouge », chosen as her setting: the original's red whatever her colour, through the layer's words.
  const redPlan = pieceTestPlan({ piece: vlogVille, shots, span: [1, 7.2], fill: { texts: words, objects: {}, settings: { couleur: "rouge" } }, bpm: 76 });
  const red = { ...props, texts: redPlan.layers![0]!.motion.texts };
  assert.equal(red.texts?.couleur, "rouge");
  assert.ok(nodes(sceneOf(redPlan.layers![0]!.motion.code!)(140, red)).filter((n) => n.type === "FitText").every((n) => (n.props.innerStyle as Record<string, unknown>).color === "#d7261e"));
  assert.deepEqual(readPieceFill(vlogVille, { fits: true, missing: "", texts: [{ slot: "phrase", text: "Chaque quartier a son rythme" }, { slot: "ici", text: "voici Belleville." }, { slot: "nom", text: "Belleville" }], objects: [], settings: [{ name: "couleur", value: "rouge" }] })!.settings, { couleur: "rouge" });
});

test("« Ta ville racontée » (effect v1): its words, its title required, its signature and its line optional, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "phrase", text: "Chaque quartier a son rythme bien à lui" }, { slot: "ici", text: "voici Belleville." }, { slot: "nom", text: "Belleville" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(vlogVille, answer)!.texts, { phrase: "Chaque quartier a son rythme", ici: "voici Belleville.", nom: "Belleville" });
  assert.equal(readPieceFill(vlogVille, { ...answer, texts: answer.texts.slice(0, 2) }), null);
});

test("« Ta ville racontée » (effect v1) is offered on her wide or medium shots, never with a single file", () => {
  const clip = (framing: string) =>
    ({
      duration: 9,
      orientation: "landscape",
      summary: "une rue de quartier",
      setting: "extérieur, une rue",
      lighting: "good",
      shots: [{ start: 0, end: 9, description: "une rue animée, des passants", subject: "passants", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera: "static", subject_box: [100, 100, 900, 900], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  const files = [
    { media_id: "a", analysis: clip("wide") },
    { media_id: "b", analysis: clip("close") },
  ];
  assert.deepEqual(piecesOffered([vlogVille], pieceShots(files, {}), 2).map((p) => p.key), ["vlog-ville"]);
  assert.deepEqual(piecesOffered([vlogVille], pieceShots(files, {}), 1), []);
  assert.deepEqual(piecesOffered([vlogVille], pieceShots([{ media_id: "b", analysis: clip("close") }, { media_id: "c", analysis: clip("detail") }], {}), 2), []);
});
