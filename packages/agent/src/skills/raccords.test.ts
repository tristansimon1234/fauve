import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillFit, skillLengths, skillPlan } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn } from "../subject.ts";
import { raccordCuts, raccords } from "./raccords.ts";

// « Plans qui s'emboîtent », the model (raccords.ts, version 1), on its original's fiche (docs/fiches/raccords.md).

/** The original's five cuts, the first image of each new shot (measured image by image). */
const ORIGINAL_CUTS = [39, 78, 124, 162, 188];
/** The original's hits, the images each piece lands on: its nine cells (1, 3, 5, 9), the room's three, the turntable's three, the notebook. */
const ORIGINAL_POPS = [[53, 58, 66, 71], [101, 106, 114], [142, 146, 154], [176]];

test("« Plans qui s'emboîtent » (v1): its six shots on its original's cuts (95 BPM, in sixteenths), 7,23 s", () => {
  assert.equal(raccords.version, 2);
  assert.equal(raccords.bpm, 95);
  const line = raccords.timeline(6, { end: false });
  // 217 images, the original's; each cut within an image of the original's.
  assert.equal(line.shots.length, 6);
  assert.equal(Math.round(line.duration * 30), 217);
  const cuts = line.shots.slice(1).map((s) => Math.round(s.start * 30));
  cuts.forEach((c, i) => assert.ok(Math.abs(c - ORIGINAL_CUTS[i]!) <= 1, `cut ${i + 1}: ${c} for ${ORIGINAL_CUTS[i]}`));
  // Its raccords: the double exposure from image 23, then the cells, two runs of pieces, the match; each hit within an
  // image of the original's.
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => line.marks[`kind_${k}`]), [0, 1, 2, 2, 3]);
  assert.equal(line.marks.blend_0, 23);
  ORIGINAL_POPS.forEach((pops, k) => pops.forEach((p, j) => assert.ok(Math.abs(line.marks[`pop_${k + 1}_${j}`]! - p) <= 1, `pop ${k + 1}.${j}: ${line.marks[`pop_${k + 1}_${j}`]} for ${p}`)));
  // The shot the cells bring in lights up onto image 86, the second bar's first beat.
  assert.equal(line.marks.lit_1, 86);
  // Its word blinks over its first half second; only the shots whose subject arrives cut out are cut out.
  assert.deepEqual(line.texts, { mot: { from: 0, to: 0.5 } });
  assert.deepEqual(line.cutouts, [3, 4, 5]);
  // Its music: its first beat 0,334 s in, each bar's break (its bass gone from its sixteenth 10,5 to the next bar's first
  // beat: 1,99 to 2,86 s, 4,52 to 5,39 s, then from 7,04 s to the end), faded at the end; no sound effects.
  const music = line.music!;
  assert.ok(Math.abs(music.downbeat! - 0.334) < 0.005, String(music.downbeat));
  assert.deepEqual(music.filters!.map((f) => f.kind), ["thin", "thin", "thin"]);
  const edges = music.filters!.map((f) => [f.from, f.to]);
  [[1.99, 2.86], [4.52, 5.39], [7.04, 7.23]].forEach(([a, b], i) => assert.ok(Math.abs(edges[i]![0]! - a!) < 0.015 && Math.abs(edges[i]![1]! - b!) < 0.015, JSON.stringify(edges)));
  assert.deepEqual(music.end, { at: line.duration, fade: 0.05 });
  assert.equal(line.sounds, undefined);
  // What each shot wants says how it arrives, its fallback included.
  assert.match(line.shots[0]!.want, /quelqu'un de près .*sinon le plus beau plan/);
  assert.match(line.shots[2]!.want, /neuf cases .*s'allume sur le temps fort/);
  assert.match(line.shots[3]!.want, /intérieur .*sinon .*trois morceaux/);
  assert.match(line.shots[4]!.want, /vu d'en haut .*sinon .*trois morceaux/);
  assert.match(line.shots[5]!.want, /tient un produit .*sinon un produit net/);
});

test("« Plans qui s'emboîtent »: 4 to 9 shots from her files, its middle by threes, up to 22 for a length she asks for", () => {
  for (let n = 4; n <= 22; n++) {
    const { lengths, cuts } = raccordCuts(n);
    assert.equal(lengths.length, n);
    assert.equal(cuts.length, n - 1);
    // Its double exposure first, its match last, its middle cells then pieces then pieces.
    assert.equal(cuts[0]!.kind, 0);
    assert.equal(cuts.at(-1)!.kind, 3);
    cuts.slice(1, -1).forEach((c, i) => assert.equal(c.kind, [1, 2, 2][i % 3]));
    // Every hit before its own cut, after the cut before it.
    cuts.forEach((c, k) => c.pops.forEach((p) => assert.ok(p < c.at && (k === 0 || p > cuts[k - 1]!.at), `n=${n} cut ${k}`)));
    const line = raccords.timeline(n, { end: false });
    assert.equal(line.shots.length, n);
    // No shot under 0,85 s nor over 1,6 s.
    line.shots.forEach((s) => assert.ok(s.end - s.start >= 0.85 && s.end - s.start <= 1.6, `n=${n}: ${s.start}–${s.end}`));
    // Its filters within the schema (8 at most), each in its own bar.
    assert.ok(line.music!.filters!.length <= 8);
  }
  assert.deepEqual([4, 5, 6, 9].map((n) => raccords.timeline(n, { end: false }).duration), [4.43, 5.97, 7.23, 11.33]);
  assert.equal(raccords.long, 22);
  assert.ok(raccords.timeline(22, { end: false }).duration <= 30);
  assert.ok(raccords.timeline(22, { end: true, bpm: 80 }).duration <= 45);
  assert.ok(skillLengths(raccords).max <= 45);
  // For a length she asks for, its own tempo first, the closest count.
  assert.deepEqual(skillFit(raccords, 11.3), { n: 9, bpm: 95 });
  // An ending card: its last shot held whole sixteenths longer (1,6 s at least), its music to the end.
  const line = raccords.timeline(6, { end: false });
  const ended = raccords.timeline(6, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6);
  assert.equal(ended.music!.end!.at, ended.duration);
  // At another tempo, every length counted in sixteenths follows it.
  const slow = raccords.timeline(6, { end: false, bpm: 80 });
  assert.ok(Math.abs(slow.duration / line.duration - 95 / 80) < 0.01);
  assert.ok(Math.abs(slow.marks.pop_1_0! / line.marks.pop_1_0! - 95 / 80) < 0.03);
});

test("« Plans qui s'emboîtent »: its plan (its word, its music's shape, its cut-outs), nothing else followed or read", () => {
  const files = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 4 }));
  const plan = skillPlan({
    skill: raccords,
    name: "Plans qui s'emboîtent",
    files,
    fill: { shots: files.map((f) => ({ file: f.id, at: 0.5 })), texts: { mot: "Farine" }, end: null },
  });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 6);
  assert.deepEqual(plan.texts.map((t) => [t.style, t.text]), [["hook", "Farine"]]);
  assert.equal(plan.sounds?.length ?? 0, 0);
  assert.equal(plan.music_shape?.filters?.length, 3);
  assert.deepEqual(plan.skill, { key: "raccords", version: 2 });
  assert.equal(plan.tempo, 95);
  // Only the three shots whose subject arrives cut out are cut out; no object followed, no clear area; the light under
  // its word read on its first shot only.
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 6, subjects: [3, 4, 5] });
  assert.deepEqual(checkMotionCode(raccords.code), []);
  assert.deepEqual([objectsDrawn(raccords.code), clearsDrawn(raccords.code)], [[], []]);
  assert.deepEqual(readsDrawn(raccords.code), [{ shot: 0, kinds: ["light"] }]);
  assert.ok(raccords.code.length < 24000);
  assert.doesNotMatch(raccords.code, /transform|scale\(/);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(
  frame: number,
  options: { aspect?: number; texts?: Record<string, string>; reel?: { text: string; role: string }[]; end?: unknown; end_card?: boolean; n?: number; subject?: (shot: number) => Box | null; light?: number | null; brand?: Record<string, unknown>; focus?: Record<number, { x: number; y: number }> } = {},
): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    interpolate: (x: number, [a, b]: number[], [u, v]: number[]) => (x <= a! ? u! : x >= b! ? v! : u! + ((v! - u!) * (x - a!)) / (b! - a!)),
    SubjectBox: (shot: { segment: number } | undefined) => (shot && options.subject ? options.subject(shot.segment) : null),
    LightUnder: () => (options.light === undefined || options.light === null ? null : { mean: options.light, high: options.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${raccords.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const line = raccords.timeline(options.n ?? 6, { end: Boolean(options.end_card) });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const durationInFrames = Math.round(line.duration * 30);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 9 / 16, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i, ...(options.focus?.[i] ? { focus: options.focus[i] } : {}) }));
  const reelTexts = (options.reel ?? [{ text: "Farine", role: "hook" }]).map((t) => ({ ...t, from: 0, to: 15, emphasis: [] }));
  const brand = { name: "Maison Farine", displayFont: "Montserrat", bodyFont: "Montserrat", accent: "#b5543a", palette: { light: "#f6efe4", dark: "#1d1b19" }, ...options.brand };
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots, reelTexts, end: options.end ?? null, texts: { ...marks, ...options.texts } });
}

const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const of = (tree: Drawn, type: string) => nodes(tree).filter((n) => n.type === type);
const keyed = (tree: Drawn, key: string) => nodes(tree).find((n) => n.props.key === key) ?? null;
/** The rectangles of a clip path (« path('M x y h w v h h -w Z…') »). */
const rects = (clip: unknown) => [...String(clip).matchAll(/M(-?\d+) (-?\d+)h(-?\d+)v(-?\d+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));

test("« Plans qui s'emboîtent »: her word, very big across the frame, blinking image by image over her first shot", () => {
  const on = Array.from({ length: 18 }, (_, f) => of(drawAt(f), "FitText").length);
  assert.deepEqual(on, [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0]);
  const word = of(drawAt(4), "FitText")[0]!;
  assert.equal(word.children[0], "Farine");
  // In capitals, very bold, across the frame in its upper half (a giant word may span it there), plain.
  const b = styleOf(word);
  assert.deepEqual([b.left, b.width, b.top, Number(b.top) + Number(b.height)], [40, 1000, 150, 930]);
  const inner = word.props.innerStyle as Record<string, unknown>;
  assert.deepEqual([inner.textTransform, inner.fontWeight, inner.whiteSpace], ["uppercase", 800, "nowrap"]);
  assert.equal(inner.textShadow, undefined);
  // In her colour dark enough on a light picture (and when nothing is read), light enough on a dark one, else white.
  assert.equal(inner.color, "#b5543a");
  assert.equal((of(drawAt(4, { light: 0.2 }), "FitText")[0]!.props.innerStyle as Record<string, unknown>).color, "#f6efe4");
  assert.equal((of(drawAt(4, { light: 0.2, brand: { accent: "#123456", palette: {} } }), "FitText")[0]!.props.innerStyle as Record<string, unknown>).color, "#ffffff");
  // Her shots in a band (most of them in width, on her word): the word within the apps' margins, inside the band.
  const banded = styleOf(of(drawAt(4, { aspect: 16 / 9, texts: { format: "auto" } }), "FitText")[0]!);
  assert.deepEqual([banded.left, banded.width], [140, 800]);
  assert.ok(Number(banded.top) >= 656 && Number(banded.top) + Number(banded.height) <= 1264);
});

test("« Plans qui s'emboîtent »: the next shot in her first one's lights, then the cut", () => {
  // Before image 23, her shot alone; from it, the next shot's first image over it in « darken », rising to the cut.
  assert.deepEqual(of(drawAt(22), "Footage").map((f) => f.props.shot), [0]);
  const blend = of(drawAt(23), "Footage");
  assert.deepEqual(blend.map((f) => f.props.shot), [0, 1]);
  assert.equal(styleOf(blend[1]!).mixBlendMode, "darken");
  assert.equal(styleOf(blend[1]!).opacity, 0.6);
  // Her shot a dark one (her face lit, her room dark): the next shot in her shadows, her lights in front.
  assert.equal(styleOf(of(drawAt(23, { light: 0.2 }), "Footage")[1]!).mixBlendMode, "lighten");
  assert.equal(styleOf(of(drawAt(30), "Footage")[1]!).opacity, 1);
  // The cut: the next shot alone, full frame.
  const line = raccords.timeline(6, { end: false });
  const cut = Math.round(line.shots[1]!.start * 30);
  assert.deepEqual(of(drawAt(cut), "Footage").map((f) => [f.props.shot, styleOf(f).height]), [[1, 1920]]);
});

test("« Plans qui s'emboîtent »: the shot after next in nine cells, one, three, five, nine, then lit on its beat", () => {
  const counts = [52, 53, 57, 67, 72, 77].map((f) => rects(styleOf(keyed(drawAt(f), "c2") ?? { type: "", props: {}, children: [] }).clipPath).length);
  assert.deepEqual(counts, [0, 1, 3, 5, 9, 9]);
  // Square cells about the middle of the frame, the grid 0,7 of its width; the middle cell first, then its column.
  const cells = rects(styleOf(keyed(drawAt(57), "c2")!).clipPath);
  assert.ok(cells.every((c) => c.w === c.h && c.w === 204), JSON.stringify(cells));
  assert.equal(cells[0]!.x + cells[0]!.w / 2, 540);
  assert.deepEqual(cells.map((c) => c.x), [438, 438, 438]);
  // About its subject where Footage frames it (its focus), inside the frame: an upright shot as it is, a wide one cropped
  // about its subject.
  const moved = rects(styleOf(keyed(drawAt(57, { focus: { 2: { x: 0.62, y: 0.3 } } }), "c2")!).clipPath);
  assert.deepEqual([moved[0]!.x + 102, moved[0]!.y + 102], [670, 576]);
  assert.equal(rects(styleOf(keyed(drawAt(57, { focus: { 2: { x: 0.05, y: 0.3 } } }), "c2")!).clipPath)[0]!.x, 296);
  assert.equal(rects(styleOf(keyed(drawAt(57, { aspect: 16 / 9, texts: { format: "vertical" }, focus: { 2: { x: 0.3, y: 0.5 } } }), "c2")!).clipPath)[0]!.x, 438);
  // The shot after next in them, dimmed (41 % of its light), on its first image (no `at`: before its own start).
  const inside = keyed(drawAt(60), "c2")!;
  assert.deepEqual(of(inside, "Footage").map((f) => [f.props.shot, f.props.at]), [[2, undefined]]);
  assert.equal(styleOf(inside.children[1] as Drawn).opacity, 0.59);
  // Its cut, dimmed the same, lit over three images onto image 86.
  const dim = (f: number) => Math.round(Number(styleOf(keyed(drawAt(f), "dim") ?? { type: "", props: { style: { opacity: 0 } }, children: [] }).opacity) * 1000) / 1000;
  assert.deepEqual([78, 83, 84, 85, 86].map(dim), [0.59, 0.59, 0.393, 0.197, 0]);
});

test("« Plans qui s'emboîtent »: the next subject cut out in three pieces where it will be, its middle last, else its picture in cells", () => {
  const her = { x: 300, y: 600, w: 480, h: 900 };
  const subject = (shot: number) => (shot === 3 ? her : null);
  // Its two outer thirds then its middle, on images 101, 106 and 114.
  const piece = (f: number) => keyed(drawAt(f, { subject }), "p3");
  assert.equal(piece(100), null);
  const thirds = [101, 106, 114].map((f) => rects(styleOf(piece(f)!).clipPath));
  assert.deepEqual(thirds.map((r) => r.length), [1, 2, 3]);
  const pad = 22;
  assert.deepEqual(thirds[2], [
    { x: her.x - pad, y: her.y - pad, w: 160 + pad, h: her.h + 2 * pad },
    { x: 620, y: her.y - pad, w: 160 + pad, h: her.h + 2 * pad },
    { x: 460, y: her.y - pad, w: 160, h: her.h + 2 * pad },
  ]);
  assert.deepEqual(of(piece(114)!, "Subject").map((s) => s.props.shot), [3]);
  // Without a cut-out, its picture in cells on the same hits: one, five, nine.
  assert.deepEqual([101, 106, 114].map((f) => rects(styleOf(keyed(drawAt(f), "c3")!).clipPath).length), [1, 5, 9]);
  // The next run starts on the other side; the match arrives whole on image 176.
  const other = (shot: number) => (shot === 4 ? her : null);
  assert.equal(rects(styleOf(keyed(drawAt(143, { subject: other }), "p4")!).clipPath)[0]!.x, 620);
  const whole = (shot: number) => (shot === 5 ? her : null);
  assert.equal(keyed(drawAt(175, { subject: whole }), "p5"), null);
  assert.deepEqual(rects(styleOf(keyed(drawAt(176, { subject: whole }), "p5")!).clipPath), [{ x: her.x - pad, y: her.y - pad, w: her.w + 2 * pad, h: her.h + 2 * pad }]);
  // A tiny subject is no piece: its picture in cells.
  assert.ok(keyed(drawAt(176, { subject: () => ({ x: 500, y: 900, w: 60, h: 80 }) }), "c5"));
});

test("« Plans qui s'emboîtent » (v2): full frame by default, its band as her videos or as she asks", () => {
  const frameOf = (tree: Drawn) => styleOf(keyed(tree, "frame")!);
  assert.deepEqual([frameOf(drawAt(40)).top, frameOf(drawAt(40)).height], [0, 1920]);
  // By default (Tristan, 6 November: « tout vertical please »), her videos in width full frame, cropped on their subject.
  assert.deepEqual([frameOf(drawAt(40, { aspect: 16 / 9 })).top, frameOf(drawAt(40, { aspect: 16 / 9 })).height], [0, 1920]);
  const asVideos = { aspect: 16 / 9, texts: { format: "auto" } };
  assert.deepEqual([frameOf(drawAt(40, asVideos)).top, frameOf(drawAt(40, asVideos)).height], [656, 608]);
  assert.equal(frameOf(drawAt(40, { texts: { format: "auto" } })).height, 1920);
  assert.equal(frameOf(drawAt(40, { texts: { format: "horizontal" } })).height, 608);
  assert.equal(frameOf(drawAt(40, { aspect: 16 / 9, texts: { format: "vertical" } })).height, 1920);
  assert.deepEqual(raccords.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["vertical", "horizontal", "auto"]]]);
  // In a band, the cells are the band's: 0,62 of its height.
  const cells = rects(styleOf(keyed(drawAt(57, asVideos), "c2")!).clipPath);
  assert.ok(cells.every((c) => c.w === 102), JSON.stringify(cells));
});

test("« Plans qui s'emboîtent »: its ending card over its last shot, blinking in, readable", () => {
  const line = raccords.timeline(6, { end: true });
  const from = Math.round((line.duration - 1.6) * 30);
  const end = { title: "Ouvert dès 7 h", subtitle: "au 12 rue des Martyrs", from };
  const card = (f: number) => of(drawAt(f, { end, end_card: true }), "FitText").map((t) => t.children[0]);
  assert.deepEqual(card(from - 1), []);
  assert.deepEqual([from, from + 1, from + 2, from + 3, from + 4].map((f) => card(f).length), [1, 0, 1, 0, 1]);
  assert.deepEqual(card(from + 8), ["Ouvert dès 7 h", "au 12 rue des Martyrs"]);
  for (const t of of(drawAt(from + 8, { end, end_card: true }), "FitText")) {
    const b = styleOf(t);
    assert.ok(Number(b.left) >= 140 && Number(b.left) + Number(b.width) <= 940 && Number(b.top) >= 80 && Number(b.top) + Number(b.height) <= 1440, JSON.stringify(b));
  }
  // Over her last shot, still playing.
  assert.equal(of(drawAt(from + 8, { end, end_card: true }), "Footage")[0]!.props.shot, 5);
});
