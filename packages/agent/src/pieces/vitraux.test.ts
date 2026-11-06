import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { subjectShots } from "../subject.ts";
import { vitraux, vitrauxTimeline } from "./vitraux.ts";

// « Le kaléidoscope », the effect of the bank (vitraux.ts): its own checks, beside the bank's (features.test.ts).

/** Her door straight on as the chain cuts it under it (6 s), between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "door", at: 0.5, seconds: 6 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Le kaléidoscope » (effect v1): its layer over her shot, her door named there, never her cut-out; its marks on the Reel's beat", () => {
  const plan = pieceTestPlan({ piece: vitraux, shots, span: [1.2, 7.2], fill: { texts: { nom: "Maison Farine" }, objects: { devanture: "front door" }, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "vitraux", version: 1 });
  // Open from its third image, whole after 2,5 beats (45 images at 100 BPM), closed over 2,3 beats, her real picture its
  // last half beat; her name 2,2 s before its end.
  assert.deepEqual(motion.texts, { beat: "18", open_from: "2", full: "45", close: "130", real: "171", name: "114", turn: "11.25", mine: "1", nom: "Maison Farine" });
  // Her door followed on her shot under it; she is never cut out (no rented card).
  assert.deepEqual(motion.drawn, { shots: 3, objects: [{ shot: 1, name: "front door" }] });
  assert.deepEqual([...subjectShots(plan)], []);
  assert.match(motion.code!, /"front door"/);
  // A short span: every landmark inside it, in order.
  const short = vitrauxTimeline({ frames: 20, bpm: 120, shots: [{ from: 0, frames: 20 }], words: {}, settings: {} }).marks!;
  assert.ok(short.open_from! < short.full! && short.full! < short.close! && short.close! < short.real! && short.real! < 20, JSON.stringify(short));
  // No words wanted: none; its rosace when her request asks for it.
  const bare = pieceTestPlan({ piece: vitraux, shots, span: [1.2, 7.2], fill: { texts: {}, objects: {}, settings: { figure: "rosace" } }, bpm: 100 });
  assert.equal(bare.layers![0]!.motion.texts!.figure, "rosace");
  assert.equal(bare.layers![0]!.motion.drawn, undefined);
});

test("« Le kaléidoscope »: its words cut to their place, its door named as the detector reads it, « none » no object", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "nom", text: "La boutique de la rue Saint-Denis" }], objects: [{ slot: "devanture", name: "The Front Door" }], settings: [{ name: "figure", value: "rosace" }] };
  const read = readPieceFill(vitraux, answer)!;
  assert.equal(read.texts.nom, "La boutique de la rue");
  assert.equal(read.objects.devanture, "the front door");
  assert.deepEqual(read.settings, { figure: "rosace" });
  assert.deepEqual(readPieceFill(vitraux, { ...answer, objects: [{ slot: "devanture", name: "none" }] })!.objects, {});
  // Its name is optional: none written, it still plays.
  assert.deepEqual(readPieceFill(vitraux, { ...answer, texts: [] })!.texts, {});
});

test("« Le kaléidoscope » is offered on a still shot (a video or her photo), never on a moving camera", () => {
  const clip = (camera: string) =>
    ({
      duration: 9,
      orientation: "portrait",
      summary: "la devanture d'une boutique de face",
      setting: "extérieur, une rue",
      lighting: "good",
      shots: [{ start: 0, end: 9, description: "la porte et la vitrine de face", subject: "devanture", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing: "medium", camera, subject_box: [100, 100, 900, 1800], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([vitraux], pieceShots([{ media_id: "a", analysis: clip("static") }], {}), 1).map((p) => p.key), ["vitraux"]);
  assert.deepEqual(piecesOffered([vitraux], pieceShots([{ media_id: "a", analysis: clip("handheld") }], {}), 1), []);
  assert.deepEqual(piecesOffered([vitraux], pieceShots([], { p: { width: 1200, height: 1600, detection: { regions: [], notes: "une vitrine de face" } } } as never), 1).map((p) => p.key), ["vitraux"]);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };

/** What its Scene draws at a frame (180 images, its shot from 15 images before it), run with a plain tree for React. */
function drawAt(frame: number, props: { door?: Box | null; outline?: string | null; texts?: Record<string, string>; light?: number; shots?: { from: number; durationInFrames: number }[] } = {}): Drawn {
  const D = 180;
  const marks = vitrauxTimeline({ frames: D, bpm: 100, shots: [{ from: -15, frames: D + 15 }], words: {}, settings: {} }).marks!;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }) };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    useCurrentFrame: () => frame,
    SubjectBox: (_s: unknown, _f: number, _l: unknown, name: string) => (name === "front door" ? (props.door ?? null) : null),
    SubjectOutline: (_s: unknown, _f: number, _l: unknown, name: string) => (name === "front door" ? (props.outline ?? null) : null),
    ClearBox: (_s: unknown, _f: number, _l: unknown, o: { fallback: Box }) => o.fallback,
    LightUnder: () => (props.light === undefined ? null : { mean: props.light, high: props.light }),
  };
  const code = vitraux.code.split('"@devanture"').join('"front door"');
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const texts = { beat: "18", mine: "0", ...Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, String(v)])), ...props.texts };
  const list = props.shots ?? [{ from: -15, durationInFrames: D + 15 }];
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames: D, brand: { name: "Maison Farine", displayFont: "Bodoni Moda", bodyFont: "Jost" }, shots: list.map((s) => ({ ...s, kind: "video", aspect: 0.5625 })), texts: { ...texts, ...(props.shots ? { mine: props.shots.map((_, i) => i).join(",") } : {}) } });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const keyed = (tree: Drawn, key: string) => flatten(tree).find((d) => d.props.key === key) ?? null;
const styleOf = (d: Drawn | null) => (d?.props.style ?? {}) as Record<string, string | number>;
const strips = (tree: Drawn) => (keyed(tree, "battants")?.children.flat() ?? []) as Drawn[];

test("« Le kaléidoscope » draws her shot, mirrors that open from it, slide, and close back on it at its end", () => {
  // Her shot always under it; no mirror on its first images nor its last ones: the montage resumes on her real picture.
  for (const f of [0, 1, 172, 179]) {
    assert.equal(keyed(drawAt(f), "battants"), null, `frame ${f}`);
    assert.ok(keyed(drawAt(f), "real"));
  }
  // In the middle, three to seven strips over her whole picture, edge to edge, one in two mirrored, moving.
  const mid = strips(drawAt(90));
  assert.ok(mid.length >= 3 && mid.length <= 7, String(mid.length));
  assert.equal(styleOf(mid[0]!).left, 0);
  assert.equal(Number(styleOf(mid.at(-1)!).left) + Number(styleOf(mid.at(-1)!).width), 1080);
  const moves = (tree: Drawn) => strips(tree).map((s) => String(styleOf(((s.children[0] as Drawn).children[0] as Drawn)).transform));
  assert.ok(moves(drawAt(90)).some((t) => /scaleX\(-1\)/.test(t)) && moves(drawAt(90)).some((t) => !/scaleX/.test(t)));
  assert.notEqual(moves(drawAt(90)).join(), moves(drawAt(110)).join());
  // Over her next shot the mirrors go on, on that shot.
  const two = drawAt(120, { shots: [{ from: -15, durationInFrames: 115 }, { from: 100, durationInFrames: 80 }] });
  assert.equal((keyed(two, "real")!.props as { shot: number }).shot, 1);
  assert.ok(strips(two).length >= 3);
});

test("« Le kaléidoscope »: inside her door when it is found, her picture real around it; its rosace when asked; her name above her door", () => {
  const door = { x: 200, y: 500, w: 680, h: 1100 };
  const s = strips(drawAt(90, { door }));
  assert.ok(s.every((x) => Number(styleOf(x).left) >= 200 && Number(styleOf(x).left) + Number(styleOf(x).width) <= 880 && styleOf(x).top === 500), JSON.stringify(s.map((x) => styleOf(x))));
  const closed = "M 200 500 C 500 490 800 490 880 500 C 890 900 890 1500 880 1600 C 600 1610 300 1610 200 1600 C 190 900 190 600 200 500 Z";
  assert.equal(styleOf(keyed(drawAt(90, { door, outline: closed }), "battants")).clipPath, `path('${closed}')`);
  // Its rosace: eight wedges in a circle on her door's middle, as wide as it at most.
  const rose = keyed(drawAt(90, { door, texts: { figure: "rosace" } }), "rosace")!;
  assert.equal(rose.children.flat().length, 8);
  assert.match(String(styleOf(rose).clipPath), /^circle\([\d.]+px at 540\.0px 1050\.0px\)$/);
  // Her name over the closing, above her door, white on her picture, an ink where it is bright.
  const marks = vitrauxTimeline({ frames: 180, bpm: 100, shots: [], words: {}, settings: {} }).marks!;
  assert.equal(flatten(drawAt(marks.name! - 1, { door, texts: { nom: "Maison Farine" } })).filter((d) => d.type === "FitText").length, 0);
  const name = flatten(drawAt(marks.name! + 20, { door, texts: { nom: "Maison Farine" } })).find((d) => d.type === "FitText")!;
  const b = styleOf(name);
  assert.ok(Number(b.top) >= 100 && Number(b.top) + Number(b.height) <= 500 - 20, JSON.stringify(b));
  assert.ok(Number(b.left) >= 140 && Number(b.left) + Number(b.width) <= 940);
  assert.equal((name.props.innerStyle as Record<string, string>).color, "#ffffff");
  const inked = flatten(drawAt(marks.name! + 20, { door, texts: { nom: "Maison Farine" }, light: 0.8 })).find((d) => d.type === "FitText")!;
  assert.equal((inked.props.innerStyle as Record<string, string>).color, "#1c1a17");
});
