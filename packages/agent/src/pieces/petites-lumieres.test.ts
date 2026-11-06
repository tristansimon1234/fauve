import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { petitesLumieres, petitesLumieresTimeline } from "./petites-lumieres.ts";

// « Petites lumières », the effect of the bank (petites-lumieres.ts): its own checks, beside the bank's (features.test.ts).

/** Her light's shot (3 s) and her windows' (2,4 s), between a lead shot and an after shot, at 100 BPM (a beat of 18 images). */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "lamp", at: 0, seconds: 3, photo: true },
  { file: "front", at: 0.5, seconds: 2.4 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Petites lumières » (effect v1): its light's spans on its first shot, the music stopped between its flash and its blinks, its waves on its second", () => {
  const plan = pieceTestPlan({ piece: petitesLumieres, shots, span: [1.2, 6.6], fill: { texts: { nom: "Café Lune" }, objects: { lumiere: "street lamp head", fenetres: "every window" }, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2]);
  assert.deepEqual(layer.motion.piece, { key: "petites-lumieres", version: 2 });
  // Its objects on its two shots (the second and third of the plan); nothing of her cut out.
  assert.deepEqual(layer.motion.drawn, { shots: 4, objects: [{ shot: 1, name: "street lamp head" }, { shot: 2, name: "every window" }] });
  const t = layer.motion.texts!;
  // The flash on its first beat (four images), three blinks of four images every six just before the music is back two
  // beats later (36 images), then held to its first shot's cut (90).
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => [Number(t[`lamp_${k}_on`]), Number(t[`lamp_${k}_off`])]), [[1, 5], [34, 38], [40, 44], [46, 50], [52, 90]]);
  // Its waves after its second shot's cut (90), at its skill's offsets in beats of 18 images (the last at 2,58 beats).
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => Number(t[`wave_${k}`])), [92, 95, 100, 115, 118, 136]);
  assert.equal(Number(t.name), 92);
  // The music stopped dead after the flash (0,44 beat in), back on the Reel's whole beat with the blinks: 1,46 – 2,4 s.
  const shape = pieceMusicShape({ piece: petitesLumieres, fill: { texts: {}, objects: {}, settings: {} }, plan, layer, bpm: 100 });
  assert.deepEqual(shape?.pauses, [{ from: 1.467, to: 2.4 }]);
});

test("« Petites lumières »: on a short shot, the music back after a beat, or no stop and the blinks squeezed in; its waves squeezed too", () => {
  // 2 s: back one beat after its first.
  const short = petitesLumieresTimeline({ frames: 60, bpm: 100, shots: [{ from: 0, frames: 60 }], words: {}, settings: {} });
  assert.deepEqual([short.marks!.lamp_1_on, short.marks!.lamp_4_off], [16, 60]);
  assert.deepEqual(short.music?.pauses, [{ from: 0.267, to: 0.6 }]);
  // 1 s: no stop, its spans one after the other within the shot.
  const tiny = petitesLumieresTimeline({ frames: 30, bpm: 100, shots: [{ from: 0, frames: 30 }], words: {}, settings: {} });
  assert.equal(tiny.music, undefined);
  const spans = [0, 1, 2, 3, 4].flatMap((k): [number, number][] => (tiny.marks![`lamp_${k}_on`] === undefined ? [] : [[tiny.marks![`lamp_${k}_on`]!, tiny.marks![`lamp_${k}_off`]!]]));
  assert.ok(spans.length >= 3 && spans.every(([a, b], k) => b > a && b <= 30 && (k === 0 || a >= spans[k - 1]![1]!)), JSON.stringify(spans));
  // A shot that started before it: its first beat counted from that shot's cut.
  const late = petitesLumieresTimeline({ frames: 90, bpm: 100, shots: [{ from: -10, frames: 100 }], words: {}, settings: {} });
  assert.equal(late.marks!.lamp_0_on, 9);
  // A short second shot: its six waves within it.
  const two = petitesLumieresTimeline({ frames: 80, bpm: 100, shots: [{ from: 0, frames: 50 }, { from: 50, frames: 30 }], words: {}, settings: {} });
  assert.ok([0, 1, 2, 3, 4, 5].every((k) => two.marks![`wave_${k}`]! >= 50 && two.marks![`wave_${k}`]! < 80));
});

test("« Petites lumières »: its words, her name optional and cut to its place; offered on a still shot, never on a moving camera", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "nom", text: "Le Café de la Lune Rousse" }], objects: [{ slot: "lumiere", name: "Street Lamp Head" }], settings: [] };
  const read = readPieceFill(petitesLumieres, answer)!;
  assert.equal(read.texts.nom, "Le Café de la Lune");
  assert.equal(read.objects.lumiere, "street lamp head");
  assert.deepEqual(readPieceFill(petitesLumieres, { ...answer, texts: [] })!.texts, {});
  const clip = (camera: string) =>
    ({
      duration: 6,
      orientation: "portrait",
      summary: "une rue le soir, un lampadaire allumé",
      setting: "extérieur, une rue",
      lighting: "low",
      shots: [{ start: 0, end: 6, description: "un lampadaire devant le ciel du soir", subject: "lampadaire", energy: 1, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing: "medium", camera, subject_box: [300, 100, 700, 600], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([petitesLumieres], pieceShots([{ media_id: "a", analysis: clip("static") }], {}), 1).map((p) => p.key), ["petites-lumieres"]);
  assert.deepEqual(piecesOffered([petitesLumieres], pieceShots([{ media_id: "a", analysis: clip("handheld") }], {}), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };

/** What its Scene draws at a frame (its marks as its layer gets them), run with a plain tree for React. */
function drawAt(frame: number, props: { box?: Box | null; parts?: Box[]; light?: number; around?: number; windowLight?: (b: Box) => number | undefined; texts?: Record<string, string>; brand?: Record<string, unknown> }): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }) };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    SubjectBox: () => props.box ?? null,
    SubjectParts: () => props.parts ?? [],
    // Its light under her lamp's box; round it, what is around (a dark street by default).
    LightUnder: (_s: unknown, _f: number, _l: unknown, b: Box) => {
      const w = props.windowLight && b ? props.windowLight(b) : undefined;
      if (w !== undefined) return { mean: w, high: w };
      if (props.light === undefined) return props.windowLight ? { mean: 0.2, high: 0.4 } : null;
      const v = b && props.box && b.w === props.box.w && b.h === props.box.h ? props.light : (props.around ?? 0.3);
      return { mean: v, high: v };
    },
    ClearBox: (_s: unknown, _f: number, _l: unknown, o: { fallback: Box }) => o.fallback,
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${petitesLumieres.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const line = petitesLumieresTimeline({ frames: 162, bpm: 100, shots: [{ from: 0, frames: 90 }, { from: 90, frames: 72 }], words: {}, settings: {} });
  const texts = { beat: "18", mine: "1,2", ...Object.fromEntries(Object.entries(line.marks!).map(([k, v]) => [k, String(v)])), ...props.texts };
  const brand = { name: "Café Lune", displayFont: "Instrument Serif", bodyFont: "Inter Tight", accent: "#2f6fd6", ...props.brand };
  const list = [
    { from: -36, durationInFrames: 36, kind: "video", aspect: 0.5625 },
    { from: 0, durationInFrames: 90, kind: "photo", aspect: 0.5625 },
    { from: 90, durationInFrames: 72, kind: "video", aspect: 0.5625 },
  ];
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames: 162, brand, shots: list, texts });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const keyed = (tree: Drawn, key: string) => flatten(tree).find((d) => d.props.key === key) ?? null;
const LAMP = { x: 400, y: 600, w: 180, h: 100 };
const GRID = Array.from({ length: 12 }, (_, i) => ({ x: 200 + (i % 3) * 220, y: 900 + Math.floor(i / 3) * 200, w: 120, h: 140 }));

test("« Petites lumières » draws her light dimmed off and lit on its spans, then her windows from the bottom in its colour, her name a neon", () => {
  // Off before its flash, lit on it, off again, lit on each blink and held to the cut; on her own shot (the plan's second).
  const lit = (f: number) => Boolean(keyed(drawAt(f, { box: LAMP }), "own"));
  assert.ok(!lit(0) && lit(1) && lit(4) && !lit(5) && !lit(20) && lit(34) && !lit(38) && lit(40) && lit(52) && lit(89));
  assert.ok(keyed(drawAt(20, { box: LAMP }), "dim"));
  assert.equal(flatten(keyed(drawAt(20, { box: LAMP }), "dim")).find((d) => d.type === "Subject")!.props.shot, 1);
  // A lamp off in her picture: a lamp's warm light and a halo; already shining: a glow of its highlights.
  assert.ok(keyed(drawAt(60, { box: LAMP, light: 0.3 }), "fill") && keyed(drawAt(60, { box: LAMP, light: 0.3 }), "halo"));
  assert.ok(keyed(drawAt(60, { box: LAMP, light: 0.9 }), "shine") && !keyed(drawAt(60, { box: LAMP, light: 0.9 }), "fill"));
  // As bright as what is round it (a lamp off against a white sky): off in her picture.
  assert.ok(keyed(drawAt(60, { box: LAMP, light: 0.9, around: 0.85 }), "fill") && !keyed(drawAt(60, { box: LAMP, light: 0.9, around: 0.85 }), "shine"));
  // Nothing named: her highlights bloom on the same spans.
  assert.ok(keyed(drawAt(60, {}), "bloom") && !keyed(drawAt(20, {}), "bloom"));
  // Read and nothing shining in it (its brightest tenth near its mean): nothing at all.
  assert.equal(keyed(drawAt(60, { light: 0.3, around: 0.3 }), "bloom"), null);
  // Her shot always under its lights, as the montage plays it: never an empty layer (the scene check refused one at its
  // first image, nothing found to light).
  assert.equal(keyed(drawAt(0, {}), "film")!.props.shot, 1);
  assert.equal(keyed(drawAt(150, {}), "film")!.props.shot, 2);
  // Her windows: none before the first wave, the lowest row first, all twelve on its sixth; the original's red.
  const windows = (f: number, texts?: Record<string, string>) => keyed(drawAt(f, { parts: GRID, ...(texts ? { texts } : {}) }), "windows");
  assert.equal(windows(91), null);
  const first = String((windows(92)!.props.style as Record<string, string>).clipPath);
  assert.equal(first.match(/M/g)!.length, 2);
  assert.match(first, /M194 1494/);
  assert.equal(String((windows(136)!.props.style as Record<string, string>).clipPath).match(/M/g)!.length, 12);
  assert.equal(flatten(windows(136)).find((d) => d.type === "Subject")!.props.fill, "#b4201a");
  assert.equal(flatten(windows(136, { couleur: "sienne" })).find((d) => d.type === "Subject")!.props.fill, "rgb(47,111,214)");
  // Her windows already lit in her picture (her shop windows at night) never covered: a warm white flash on their first
  // image, then her own picture brighter, tinted with its colour; the dark ones filled as the original's.
  const litRow = (f: number) => drawAt(f, { parts: GRID, windowLight: (b) => (b.y >= 1500 ? 0.8 : undefined) });
  assert.equal(keyed(litRow(92), "windows"), null);
  assert.ok(keyed(litRow(92), "windows-own") && keyed(litRow(92), "windows-flash") && !keyed(litRow(105), "windows-flash"));
  assert.equal(String((keyed(litRow(136), "windows")!.props.style as Record<string, string>).clipPath).match(/M/g)!.length, 9);
  assert.ok(flatten(keyed(litRow(136), "windows-own")).some((d) => d.type === "Subject" && d.props.fill === undefined));
  // Her name: a tube catching with its first wave, then lit to the end, in the safe zone.
  const name = (f: number) => flatten(drawAt(f, { parts: GRID, texts: { nom: "Café Lune" } })).find((d) => String(d.props.key).startsWith("name-")) ?? null;
  assert.equal(name(91), null);
  assert.equal(name(92), null);
  assert.equal((name(93)!.props.innerStyle as Record<string, number>).opacity, 1);
  const box = name(161)!.props.style as Record<string, number>;
  assert.ok(box.left! >= 140 && box.left! + box.width! <= 940 && box.top! >= 80 && box.top! + box.height! <= 960, JSON.stringify(box));
  assert.ok(Number((name(161)!.props.innerStyle as Record<string, number>).fontSize) >= 48);
});
