import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { readsDrawn, subjectsDrawn } from "../subject.ts";
import { faceChanges, faceStep, nomDeVille } from "./nom-de-ville.ts";

// « Son nom aux cinq polices », the effect of the bank (nom-de-ville.ts): its own checks, beside the bank's (features.test.ts).

/** Her wide shot as the chain cuts it under it (2,4 s), between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "roofs", at: 0.5, seconds: 2.4 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Son nom aux cinq polices » (effect v2): its layer over her one wide shot, its step on the Reel's beat or half of it, nothing cut out", () => {
  const plan = pieceTestPlan({ piece: nomDeVille, shots, span: [1.2, 3.6], fill: { texts: { nom: "Belleville", surtitre: "les rues de" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1]);
  assert.deepEqual(layer.motion.piece, { key: "nom-de-ville", version: 2 });
  // At 100 BPM a beat is 18 images: half of it (9) is nearer the original's 12,6; its 72 images hold four changes.
  assert.deepEqual(layer.motion.texts, { beat: "18", step: "9", changes: "4", mine: "1", nom: "Belleville", surtitre: "les rues de" });
  assert.equal(layer.motion.drawn, undefined);
  assert.equal(layer.motion.sounds, undefined);
  assert.deepEqual(layer.motion.fonts, ["Lilita One", "Bungee", "League Gothic"]);
  // Its step: the beat or half of it, the nearer to 12,6 images (the original's 0,42 s at 142,4 BPM).
  assert.equal(faceStep(25.28), 12.64);
  assert.equal(faceStep(15), 15);
  assert.equal(faceStep(30), 15);
  // Four changes on a stage of five steps or more, fewer on a short one (its last face a step at least), one at least.
  assert.equal(faceChanges(72, 12.6), 4);
  assert.equal(faceChanges(40, 12.6), 2);
  assert.equal(faceChanges(10, 12.6), 1);
});

test("« Son nom aux cinq polices »: its name required, its small words optional, both cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "nom", text: "Saint-Germain-des-Prés" }, { slot: "surtitre", text: "un dimanche matin à" }], objects: [], settings: [] };
  // Cut at the last word that fits (a hyphenated name at its last whole part).
  assert.deepEqual(readPieceFill(nomDeVille, answer)!.texts, { nom: "Saint-Germain", surtitre: "un dimanche matin" });
  assert.equal(readPieceFill(nomDeVille, { ...answer, texts: [{ slot: "surtitre", text: "les rues de" }] }), null);
});

test("« Son nom aux cinq polices » is offered on a wide still shot outdoors, never on a close shot nor indoors", () => {
  const clip = (framing: string, setting: string, description: string, camera = "static") =>
    ({
      duration: 6,
      orientation: "landscape",
      summary: description,
      setting,
      lighting: "good",
      shots: [{ start: 0, end: 6, description, subject: "lieu", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera, subject_box: [0, 0, 1000, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  const offered = (c: ClipAnalysis) => piecesOffered([nomDeVille], pieceShots([{ media_id: "a", analysis: c }], {}), 1).map((p) => p.key);
  assert.deepEqual(offered(clip("wide", "extérieur, les toits de la ville", "les toits et le ciel")), ["nom-de-ville"]);
  assert.deepEqual(offered(clip("close", "extérieur, une rue", "une enseigne de près")), []);
  assert.deepEqual(offered(clip("wide", "intérieur d'une boutique", "les rayons et la caisse")), []);
  assert.deepEqual(offered(clip("wide", "extérieur, les toits de la ville", "les toits et le ciel", "handheld")), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; skyline?: (span: { from: number; to: number }) => number | null; light?: number; brand?: Record<string, unknown>; stage?: [number, number] } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Skyline: "Skyline",
    useCurrentFrame: () => frame,
    SkylineAt: (_shot: unknown, _f: number, _laid: unknown, span: { from: number; to: number }) => (props.skyline ? props.skyline(span) : null),
    ClearBox: (_shot: unknown, _f: number, _laid: unknown, options: { fallback?: unknown }) => options.fallback ?? null,
    LightUnder: () => (props.light === undefined ? null : { mean: props.light, high: props.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${nomDeVille.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const [from, length] = props.stage ?? [0, 72];
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: 72,
    brand: { name: "Maison Farine", displayFont: "Anton", bodyFont: "Inter Tight", accent: "#fd4c4c", palette: {}, ...props.brand },
    shots: [{ from: -36, durationInFrames: 36, kind: "video", aspect: 1.78 }, { from, durationInFrames: length, kind: "video", aspect: 1.78 }],
    texts: { beat: "25.28", step: "12.64", changes: "4", mine: "1", nom: "Belleville", surtitre: "les rues de", ...props.texts },
  });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
const shownFace = (tree: Drawn) => {
  const grid = flatten(tree).find((n) => n.props.key === "name");
  const face = grid ? (grid.children as Drawn[]).find((f) => styleOf(f).visibility === "visible") : undefined;
  return face ? String(styleOf(face).fontFamily).split(",")[0]!.replace(/'/g, "") : null;
};

test("« Son nom aux cinq polices » draws its name in five faces, one at a time, on its steps, then hers to the cut", () => {
  // Steps of 12,64 images: Lilita One, Bungee, League Gothic, Bungee bigger, then her title face.
  assert.deepEqual([0, 12, 13, 25, 26, 37, 38, 50, 51, 71].map((f) => shownFace(drawAt(f))), ["Lilita One", "Lilita One", "Bungee", "Bungee", "League Gothic", "League Gothic", "Bungee", "Bungee", "Anton", "Anton"]);
  // Fewer changes on a shorter stage: the first faces, then hers.
  assert.deepEqual([0, 13, 26].map((f) => shownFace(drawAt(f, { texts: { changes: "2" }, stage: [0, 40] }))), ["Lilita One", "Bungee", "Anton"]);
  // Only on its stage: nothing before it (the last images of the shot before), nothing past its cut.
  assert.equal(shownFace(drawAt(5, { stage: [10, 50] })), null);
  assert.equal(shownFace(drawAt(65, { stage: [10, 50] })), null);
  // One box keyed by the name, every face laid out in it at every frame.
  const tree = drawAt(30);
  const title = flatten(tree).find((n) => String(n.props.key).startsWith("title-"))!;
  assert.equal(title.props.key, "title-BELLEVILLE");
  assert.equal((flatten(tree).find((n) => n.props.key === "name")!.children as Drawn[]).length, 5);
  // Its words inside the safe zone, above the middle of the frame, its small words a short label.
  const b = styleOf(title) as unknown as Box;
  assert.ok(b.left >= 40 && b.left + b.width <= 1040 && b.top >= 0 && b.top + b.height <= 960, JSON.stringify(b));
  assert.ok(flatten(title).some((n) => "data-fauve-accent" in n.props));
});

test("« Son nom aux cinq polices »: behind her roofs when her sky is read, in front otherwise; in her colour against her sky", () => {
  const front = (tree: Drawn) => flatten(tree).find((n) => n.props.key === "front") ?? null;
  const roofs = () => 700;
  const behind = drawAt(30, { skyline: roofs, light: 0.8 });
  assert.equal(flatten(front(behind)!).find((n) => n.type === "Skyline")!.props.shot, 1);
  // Its foot a fifth of its capitals under her roofs.
  const title = flatten(behind).find((n) => String(n.props.key).startsWith("title-"))!;
  const b = styleOf(title) as unknown as Box;
  const caps = Math.round(0.72 * 210 * Math.min(1, 864 / (0.775 * 210 * 10)));
  assert.ok(Math.abs(b.top + b.height - (700 + 0.2 * caps + 0.07 * caps)) <= 2, JSON.stringify(b));
  assert.equal(front(drawAt(30)), null);
  // Her red as it is on a pale sky, deepened on a greyer one; white small words on a sky that lets white read.
  const color = (tree: Drawn) => styleOf((flatten(tree).find((n) => n.props.key === "name")!.children as Drawn[])[0]!).color;
  assert.equal(color(drawAt(30, { light: 0.8 })), "#fd4c4c");
  assert.equal(color(drawAt(30, { light: 0.6 })), "#aa3333");
  const kick = flatten(drawAt(30, { light: 0.6 })).find((n) => "data-fauve-accent" in n.props)!;
  assert.equal(styleOf(kick).color, "#ffffff");
});

test("« Son nom aux cinq polices »: its code passes the checks, reads its stage's sky, ground and light, cuts nothing out", () => {
  assert.deepEqual(checkMotionCode(nomDeVille.code), []);
  assert.deepEqual(subjectsDrawn(nomDeVille.code), []);
  // Its stage written as a variable: every shot under it is read (one, for this effect).
  assert.deepEqual(readsDrawn(nomDeVille.code).map((r) => r.kinds), [["ground", "light", "sky"]]);
  assert.doesNotMatch(nomDeVille.code + JSON.stringify(nomDeVille.texts), /MARRAKECH|STREETS OF|HARPER/i);
});
