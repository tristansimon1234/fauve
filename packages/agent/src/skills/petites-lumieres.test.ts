import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillCode, skillLengths, skillPlan, skillTempos, type SkillFile } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { petitesLumieres } from "./petites-lumieres.ts";

// « Petites lumières » (skills/petites-lumieres.ts, docs/fiches/petites-lumieres.md): its timeline on its original's grid,
// its music's three stops and its tick, and what its code draws frame by frame (its light, its windows, its sun, its
// column, her name lit like a neon), run with a plain tree for React and stand-ins for the kit's readings.

/** The original's images, at 30 i/s: its cuts, its lamp's spans, its windows' waves, its column's steps and its end (the fiche). */
const ORIGINAL = { cuts: [124, 200], end: 295, lamp: [[4, 8], [33, 37], [39, 43], [45, 49], [51, 93]], waves: [126, 130, 136, 154, 158, 180], steps: [212, 217, 223, 228], off: 267 };

test("« Petites lumières » (v1): three still shots on its original's grid (83 BPM, its first beat at 0,09 s), its cuts within an image of the original's", () => {
  assert.equal(petitesLumieres.key, "petites-lumieres");
  assert.equal(petitesLumieres.version, 1);
  assert.equal(petitesLumieres.bpm, 83);
  assert.deepEqual(petitesLumieres.shots, [3, 4]);
  const line = petitesLumieres.timeline(3, { end: false });
  assert.equal(line.shots.length, 3);
  // Its cuts on the original's images 124 and 200, its end on 295 (9,83 s).
  const frames = (s: number) => Math.round(s * 30);
  assert.deepEqual(line.shots.slice(1).map((s) => frames(s.start)), ORIGINAL.cuts);
  assert.equal(frames(line.duration), ORIGINAL.end);
  // Its lamp's spans, its windows' waves, its column's steps (after its cut) and its end, each within an image of the original's.
  const m = line.marks;
  ORIGINAL.lamp.forEach(([a, b], k) => {
    assert.ok(Math.abs(m[`lamp_${k}_on`]! - a!) <= 1 && Math.abs(m[`lamp_${k}_off`]! - b!) <= 1, `lamp ${k}: ${m[`lamp_${k}_on`]}–${m[`lamp_${k}_off`]}`);
  });
  ORIGINAL.waves.forEach((f, k) => assert.ok(Math.abs(m[`wave_${k}`]! - f) <= 1, `wave ${k}: ${m[`wave_${k}`]}`));
  ORIGINAL.steps.forEach((f, k) => assert.ok(Math.abs(m[`step_${k}`]! + ORIGINAL.cuts[1]! - f) <= 1, `step ${k}: ${m[`step_${k}`]}`));
  assert.ok(Math.abs(m.off! + ORIGINAL.cuts[1]! - ORIGINAL.off) <= 1);
  // Her name lit with the last column's first step, to the end.
  assert.ok(Math.abs(m.name! - ORIGINAL.steps[0]!) <= 1);
  assert.deepEqual(Object.keys(line.texts), ["nom"]);
  assert.ok(Math.abs(line.texts.nom!.from - 7.07) <= 0.04 && line.texts.nom!.to === line.duration);
  // No cut-out of her: it lights things, never her.
  assert.equal(line.cutouts, undefined);
  // Its tempo range keeps it between 60 and 100 BPM, 8,2 to 13,6 s with three or four shots.
  assert.deepEqual(skillTempos(petitesLumieres), [60, 100]);
  const lengths = skillLengths(petitesLumieres);
  assert.ok(lengths.min > 8 && lengths.max < 18, JSON.stringify(lengths));
});

test("« Petites lumières »: its music stopped dead three times for a beat, its tick alone in the third stop, cut on its beat 12,37", () => {
  const line = petitesLumieres.timeline(3, { end: false });
  const music = line.music!;
  assert.ok(Math.abs(music.downbeat! - 0.09) < 0.005);
  // The original's stops (0,41 – 1,18 · 3,28 – 4,06 · 6,21 – 6,96 s), each back on the off-beat.
  const stops = [[0.405, 1.174], [3.28, 4.066], [6.215, 6.957]];
  assert.equal(music.pauses!.length, 3);
  music.pauses!.forEach((p, k) => assert.ok(Math.abs(p.from - stops[k]![0]!) <= 1 / 30 && Math.abs(p.to - stops[k]![1]!) <= 1 / 30, JSON.stringify(p)));
  assert.ok(Math.abs(music.end!.at - 9.03) <= 1 / 30 && music.end!.fade! < 0.02);
  // Its tick, the only sound, at 6,62 s: the second cut 1,5 images after it.
  assert.equal(line.sounds!.length, 1);
  assert.ok(Math.abs(line.sounds![0]!.at - 6.618) <= 1 / 30 && /click/.test(line.sounds![0]!.sound));
  // A verse: one more bar, one more stop and tick, its end a bar later; an ending card after its held picture.
  const four = petitesLumieres.timeline(4, { end: false });
  assert.equal(four.shots.length, 4);
  assert.ok(Math.abs(four.duration - line.duration - 4 * (60 / 83)) < 0.04);
  assert.equal(four.music!.pauses!.length, 4);
  assert.equal(four.sounds!.length, 2);
  assert.ok(Math.abs(four.music!.end!.at - music.end!.at - 4 * (60 / 83)) < 0.02);
  assert.deepEqual(four.objects, { suite: 2 });
  assert.deepEqual(line.objects, { suite: 99 });
  const ended = petitesLumieres.timeline(3, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6 && ended.texts.nom!.to <= ended.duration - 1.6 + 0.01);
  // At another tempo, every landmark follows it.
  const slower = petitesLumieres.timeline(3, { end: false, bpm: 70 });
  assert.ok(Math.abs(slower.marks.wave_0! / line.marks.wave_0! - 83 / 70) < 0.02 && Math.abs(slower.duration / line.duration - 83 / 70) < 0.02);
});

test("« Petites lumières »: on the plan, its objects named for her shots, followed where they are; its code light to check", () => {
  const files: SkillFile[] = [
    { id: "lamp", photo: true, seconds: 0, aspect: 9 / 16 },
    { id: "street", photo: true, seconds: 0, aspect: 9 / 16 },
    { id: "tower", photo: false, seconds: 8, aspect: 9 / 16 },
  ];
  const fill = { shots: [{ file: "lamp", at: 0 }, { file: "street", at: 0 }, { file: "tower", at: 1 }], texts: { nom: "Café Lune" }, end: null, objects: { lumiere: "street lamp head", fenetres: "every window", colonne: "every window" } };
  const plan = skillPlan({ skill: petitesLumieres, name: "Petites lumières", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 3);
  assert.deepEqual(plan.music_shape?.pauses?.length, 3);
  const layer = plan.layers![0]!;
  // Its objects on their shots (its column on its last, whatever the count); her never cut out.
  assert.deepEqual(layer.motion.drawn, { shots: 3, objects: [{ shot: 0, name: "street lamp head" }, { shot: 1, name: "every window" }, { shot: 2, name: "every window" }] });
  const code = skillCode(petitesLumieres, fill.objects);
  assert.ok(code.length < 24000, String(code.length));
  assert.deepEqual(checkMotionCode(code), []);
  assert.deepEqual(subjectsDrawn(code), []);
  // Unnamed (nothing to light in her shot), « @suite » is no object.
  assert.deepEqual(objectsDrawn(code).map((o) => `${o.shot}#${o.name}`).sort(), ["-1#every window", "0#street lamp head", "1#every window"]);
  // It reads her second shot's skyline and ground (its sun), her first shot's light (her lamp), the clear area of her last.
  assert.deepEqual(readsDrawn(code).sort((a, b) => a.shot - b.shot), [{ shot: 0, kinds: ["light"] }, { shot: 1, kinds: ["ground", "sky"] }]);
  assert.deepEqual(clearsDrawn(code).sort(), [2, 3]);
  assert.doesNotMatch(petitesLumieres.code, /transform|scale\(/);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };
type Reads = { box?: (name: string) => Box | null; parts?: (name: string) => Box[]; skyline?: (from: number, to: number) => number | null; light?: number; clear?: Box | null };

/** What its Scene draws at a frame, run with a plain tree for React: the kit's pieces as named nodes, its readings as given. */
function drawAt(frame: number, props: { shots?: number; aspect?: number; reads?: Reads; texts?: Record<string, string>; hook?: string; end?: { title: string; subtitle?: string; from: number } | null; brand?: Record<string, unknown>; code?: string }): Drawn {
  const n = props.shots ?? 3;
  const line = petitesLumieres.timeline(n, { end: Boolean(props.end) });
  const r = props.reads ?? {};
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    Skyline: "Skyline",
    useCurrentFrame: () => frame,
    SubjectBox: (_s: unknown, _f: number, _l: unknown, name: string) => (r.box ? r.box(name) : null),
    SubjectParts: (_s: unknown, _f: number, _l: unknown, name: string) => (r.parts ? r.parts(name) : []),
    SkylineAt: (_s: unknown, _f: number, _l: unknown, span: { from: number; to: number }) => (r.skyline ? r.skyline(span.from, span.to) : null),
    LightUnder: () => (r.light === undefined ? null : { mean: r.light, high: r.light }),
    ClearBox: (_s: unknown, _f: number, _l: unknown, o: { fallback: Box }) => (r.clear === undefined ? o.fallback : r.clear),
  };
  const code = props.code ?? skillCode(petitesLumieres, { lumiere: "street lamp head", fenetres: "every window", suite: "every window", colonne: "every window" });
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const shots = line.shots.map((s) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "photo", aspect: props.aspect ?? 9 / 16 }));
  const durationInFrames = Math.round(line.duration * 30);
  const texts = { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...props.texts };
  const reelTexts = props.hook ? [{ text: props.hook, role: "hook", from: Math.round(line.texts.nom!.from * 30), to: Math.round(line.texts.nom!.to * 30), emphasis: [] }] : [];
  const brand = { name: "Café Lune", displayFont: "Instrument Serif", bodyFont: "Inter Tight", accent: "#2f6fd6", palette: { secondary: "#e8d5b0", light: "#f6f1e8", dark: "#141414" }, ...props.brand };
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots, reelTexts, end: props.end ?? null, texts });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const keyed = (tree: Drawn, key: string) => flatten(tree).find((d) => d.props.key === key) ?? null;
const styleOf = (d: Drawn | null) => (d?.props.style ?? {}) as Record<string, string | number>;
/** The rectangles a lit pieces' clip shows, as [x, y, w, h]. */
const rects = (d: Drawn | null) => [...String(styleOf(d).clipPath ?? "").matchAll(/M(-?\d+) (-?\d+)h(\d+)v(\d+)/g)].map((m) => m.slice(1, 5).map(Number));

const LAMP_BOX = { x: 300, y: 700, w: 160, h: 90 };
/** Twelve windows of her second shot in a 3 × 4 grid (reading order: top row first), and a column of eight on her last. */
const GRID = Array.from({ length: 12 }, (_, i) => ({ x: 200 + (i % 3) * 220, y: 900 + Math.floor(i / 3) * 200, w: 120, h: 140 }));
const COLUMN = Array.from({ length: 8 }, (_, i) => ({ x: 480, y: 300 + i * 150, w: 120, h: 100 }));
const reads = (extra: Reads = {}): Reads => ({ box: (name) => (name === "street lamp head" ? LAMP_BOX : null), parts: (name) => (name === "every window" ? GRID : []), ...extra });

test("« Petites lumières » draws her light dimmed off, lit on its beats (the opening hit, three blinks, held), off again", () => {
  const line = petitesLumieres.timeline(3, { end: false });
  const m = line.marks;
  const on = (f: number, extra: Reads = {}) => Boolean(keyed(drawAt(f, { reads: reads(extra) }), "own"));
  const dim = (f: number) => Boolean(keyed(drawAt(f, { reads: reads() }), "dim"));
  // Off before the opening hit, lit four images, off while the music stops, three blinks, then held to 3,10 s.
  assert.ok(dim(0) && !on(0));
  for (let k = 0; k < 5; k++) {
    assert.ok(on(m[`lamp_${k}_on`]!) && on(m[`lamp_${k}_off`]! - 1) && !on(m[`lamp_${k}_off`]!), `span ${k}`);
  }
  assert.ok(!on(20) && dim(20) && !on(m.lamp_4_off! + 5) && dim(110));
  // Lit: its own picture brighter; a lamp off in her picture gets a lamp's warm light in its shape and a halo; one that
  // already shines (a lit neon) a glow of its own highlights instead.
  const off = drawAt(60, { reads: reads({ light: 0.3 }) });
  assert.ok(keyed(off, "fill") && keyed(off, "halo") && !keyed(off, "shine"));
  assert.equal(flatten(keyed(off, "fill")).find((d) => d.type === "Subject")!.props.fill, "#ffe2a2");
  const lit = drawAt(60, { reads: reads({ light: 0.95 }) });
  assert.ok(keyed(lit, "shine") && !keyed(lit, "fill"));
  // Nothing named in her shot: her own highlights bloom on the same beats, nothing when off.
  const none = { box: () => null };
  assert.ok(keyed(drawAt(60, { reads: none }), "bloom") && !keyed(drawAt(20, { reads: none }), "bloom"));
});

test("« Petites lumières »: her windows filled with her colour in six waves from the bottom; the sun in her sky, behind her roofs, shrinking", () => {
  const line = petitesLumieres.timeline(3, { end: false });
  const m = line.marks;
  // Her skyline at y 700 everywhere but a deep gap in the middle (y 1100): the sun goes there.
  const skyline = (from: number, to: number) => ((from + to) / 2 > 380 && (from + to) / 2 < 700 ? 1100 : 700);
  const at = (f: number) => drawAt(f, { reads: reads({ skyline }) });
  const windows = (f: number) => rects(keyed(at(f), "windows"));
  // Before its first wave nothing; then the lowest row first, left to right; all twelve by its sixth wave.
  assert.equal(keyed(at(m.wave_0! - 1), "windows"), null);
  const first = windows(m.wave_0!);
  assert.equal(first.length, 2);
  // (each clip a few pixels round its window)
  assert.ok(first.every((b) => b[1]! >= 1490), JSON.stringify(first));
  assert.equal(windows(m.wave_5!).length, 12);
  assert.ok(windows(m.wave_2!).length < windows(m.wave_3!).length);
  // Filled flat with the original's red by default, her colour when asked and vivid, a window's warm light.
  const color = (f: number, texts?: Record<string, string>) => flatten(keyed(drawAt(f, { reads: reads({ skyline }), ...(texts ? { texts } : {}) }), "windows")).find((d) => d.type === "Subject")!.props.fill;
  assert.equal(color(m.wave_5!), "#b4201a");
  assert.equal(color(m.wave_5!, { couleur: "sienne" }), "rgb(47,111,214)");
  assert.equal(color(m.wave_5!, { couleur: "chaude" }), "#ffc56e");
  // Its sun: a flat disc in her sky's deepest part, its centre a little above her roofline, cut to her sky, her shot
  // without its sky over it; its radius from 20 % of the width to 15,7 %.
  const sun = (f: number) => {
    const sky = keyed(at(f), "sky")!;
    return { clip: String(styleOf(sky).clipPath), disc: styleOf(sky.children[0] as Drawn) };
  };
  const start = sun(124);
  assert.equal(start.disc.width, 432);
  assert.equal(start.disc.backgroundColor, "#fe0000");
  assert.ok(Math.abs(Number(start.disc.left) + 216 - 540) <= 46, JSON.stringify(start.disc));
  assert.ok(Number(start.disc.top) + 216 < 1100 && Number(start.disc.top) + 432 > 1100, "partly behind her roofs");
  assert.match(start.clip, /^path\('M0 0H1080V700/);
  const late = sun(198);
  assert.ok(Number(late.disc.width) < 432 && Number(late.disc.width) >= Math.round(432 * 0.785) - 2, JSON.stringify(late.disc));
  const order = flatten(at(150)).map((d) => (d.props.key === "sky" ? "sun" : d.type === "Skyline" ? "ground" : d.props.key === "windows" ? "windows" : "")).filter(Boolean);
  assert.deepEqual(order, ["sun", "ground", "windows"]);
  // No sky read, too little of it, or her words: no sun.
  assert.equal(keyed(drawAt(150, { reads: reads() }), "sky"), null);
  assert.equal(keyed(drawAt(150, { reads: reads({ skyline: () => 120 }) }), "sky"), null);
  assert.equal(keyed(drawAt(150, { reads: reads({ skyline }), texts: { soleil: "non" } }), "sky"), null);
});

test("« Petites lumières »: her last shot's column lit from the bottom in four steps, all off at once; her name lit like a neon, the last light", () => {
  const line = petitesLumieres.timeline(3, { end: false });
  const m = line.marks;
  const cut = Math.round(line.shots[2]!.start * 30);
  const column = { parts: (name: string) => (name === "every window" ? COLUMN : []) };
  const lit = (f: number) => rects(keyed(drawAt(f, { reads: reads(column) }), "column"));
  assert.equal(keyed(drawAt(cut + m.step_0! - 1, { reads: reads(column) }), "column"), null);
  // Two a step, the lowest first, all eight on its fourth, held, then none at once.
  assert.deepEqual(lit(cut + m.step_0!).map((b) => b[1]), [1350 - 6, 1200 - 6]);
  assert.equal(lit(cut + m.step_3!).length, 8);
  assert.equal(lit(cut + m.off! - 1).length, 8);
  assert.equal(keyed(drawAt(cut + m.off!, { reads: reads(column) }), "column"), null);
  // Her name: off before the first step, a tube catching (off, on, almost off, on, half, on), then lit to the end.
  const name = (f: number) => flatten(drawAt(f, { reads: reads(column), hook: "Café Lune" })).find((d) => String(d.props.key).startsWith("name-")) ?? null;
  assert.equal(name(m.name! - 1), null);
  assert.equal(name(m.name!), null);
  assert.equal((name(m.name! + 1)!.props.innerStyle as Record<string, number>).opacity, 1);
  assert.equal((name(m.name! + 2)!.props.innerStyle as Record<string, number>).opacity, 0.3);
  const end = Math.round(line.duration * 30) - 1;
  const held = name(end)!;
  assert.ok(held && lit(end).length === 0, "the last light on");
  // In the safe zone, 48 px at least, in a red neon by default (its tube pale, its glow red).
  const box = held.props.style as Record<string, number>;
  assert.ok(box.left! >= 140 && box.left! + box.width! <= 940 && box.top! >= 80 && box.top! + box.height! <= 960, JSON.stringify(box));
  const inner = held.props.innerStyle as Record<string, string | number>;
  assert.ok(Number(inner.fontSize) >= 48 && inner.color === "#ffe1dc" && /255,42,36/.test(String(inner.textShadow)));
  // Its ending card in its place after the held picture, lit the same way; her name gone then.
  const ended = petitesLumieres.timeline(3, { end: true });
  const from = Math.round(ended.duration * 30) - 48;
  const cardTree = drawAt(from + 6, { reads: reads(column), hook: "Café Lune", end: { title: "Ouvert ce soir", subtitle: "jusqu'à minuit", from } });
  assert.ok(flatten(cardTree).some((d) => String(d.props.key).startsWith("card-Ouvert")) && flatten(cardTree).some((d) => String(d.props.key).startsWith("line-")));
  assert.ok(!flatten(cardTree).some((d) => String(d.props.key).startsWith("name-")));
});

test("« Petites lumières »: a verse keeps its column on to its cut; horizontal files whole in a 16:9 band on black, her name above it", () => {
  const four = petitesLumieres.timeline(4, { end: false });
  const m = four.marks;
  const cut2 = Math.round(four.shots[2]!.start * 30);
  const cut3 = Math.round(four.shots[3]!.start * 30);
  const column = { parts: (name: string) => (name === "every window" ? COLUMN : []) };
  const at = (f: number) => drawAt(f, { shots: 4, reads: reads(column) });
  // The verse: lit on its four steps, still on at its last image (its column never goes off).
  assert.equal(rects(keyed(at(cut2 + m.step_3!), "column")).length, 8);
  assert.equal(rects(keyed(at(cut3 - 1), "column")).length, 8);
  // Its own object (« @suite »), on its own shot; the last shot's column off at its end.
  assert.ok(flatten(keyed(at(cut2 + m.step_3!), "column")).some((d) => d.type === "Subject" && d.props.shot === 2));
  assert.equal(keyed(at(cut3 + m.off!), "column"), null);
  // Horizontal: the band at the middle of the frame, on black; her name above it.
  const wide = drawAt(Math.round(four.duration * 30) - 1, { shots: 4, aspect: 16 / 9, reads: reads(column), hook: "Café Lune" });
  const band = flatten(wide).find((d) => styleOf(d).overflow === "hidden")!;
  assert.deepEqual([styleOf(band).top, styleOf(band).height], [656, 608]);
  const name = flatten(wide).find((d) => String(d.props.key).startsWith("name-"))!;
  assert.ok(Number(styleOf(name).top) + Number(styleOf(name).height) <= 656 && Number(styleOf(name).top) >= 80);
  // Vertical as asked: full frame.
  const asked = drawAt(10, { aspect: 16 / 9, reads: reads(), texts: { format: "vertical" } });
  assert.equal(styleOf(flatten(asked).find((d) => styleOf(d).overflow === "hidden")!).height, 1920);
});
