import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { readSkillFill, skillLengths, skillPlan, toFrame } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { CURSEUR_CLICKS, CURSEUR_MOMENTS, curseur } from "./curseur.ts";

// « Un clic sur tes produits » (curseur.ts, docs/fiches/curseur.md): its own checks, beside those every skill passes (features.test.ts).

/** The original's clicks, image by image (its cursor pressed in to 69 % on each): the pause, the close-up, its two names, clearing them, the double click back, the play. */
const ORIGINAL_CLICKS = [40, 68, 83, 109, 141, 174, 179, 218];
/** Its two cuts (the close-up opened on a click, closed on the second click of a double click). */
const ORIGINAL_CUTS = [68, 179];

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };
type Seen = { hands?: { points: Record<string, { x: number; y: number }> }[]; bodies?: { points: Record<string, { x: number; y: number; visible: boolean }> }[]; faces?: unknown[] };
type Reads = { track?: (f: number, box?: Record<string, number>) => Seen; boxes?: Record<string, Box>; light?: number };

/** Its Scene drawn at a frame with a plain tree for React: the kit's pieces as named nodes, what is read on her shots given. */
function sceneOf(code: string, read: Reads = {}) {
  let current = 0;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: <T,>(make: () => T) => make() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Scribble: "Scribble",
    useCurrentFrame: () => current,
    SubjectBox: (_shot: unknown, _f: number, _laid: unknown, name?: string) => (name && read.boxes?.[name]) ?? null,
    LightUnder: () => (read.light === undefined ? null : { mean: read.light, high: read.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const Scene = make(React, ...Object.values(scope));
  return (frame: number, props: Record<string, unknown>) => {
    current = frame;
    return Scene({ ...(read.track ? { track: read.track } : {}), ...props });
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

/** The props its composition gets: three shots of the given shapes (width / height), its words at their moments. */
function propsFor(aspects: [number, number, number], words: Record<string, string>, extra: Record<string, unknown> = {}, line = curseur.timeline(3, { end: false })) {
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: aspects[i], from: toFrame(s.start), durationInFrames: toFrame(s.end) - toFrame(s.start), kind: i === 1 ? "photo" : "video", segment: i }));
  const reelTexts = curseur.texts.flatMap((t) => (words[t.slot] ? [{ text: words[t.slot], role: t.role, from: toFrame(line.texts[t.slot]!.from), to: toFrame(line.texts[t.slot]!.to), emphasis: [] }] : []));
  const brand = { name: "Café des Arts", displayFont: "Bebas Neue", bodyFont: "Jost", accent: "#1f6b4f", palette: { secondary: "#c8553d", light: "#f4efe9", dark: "#1d1d1b" } };
  return { width: 1080, height: 1920, durationInFrames: toFrame(line.duration), brand, shots, reelTexts, end: null, texts: marks, ...extra };
}
const WORDS = { produit1: "Cappuccino", produit2: "Brownie" };
const UPRIGHT: [number, number, number] = [9 / 16, 3 / 4, 9 / 16];

/** The cursor at a frame: its tip (its box's corner at rest), its size, or null when it is not on screen. */
function cursorAt(tree: Drawn) {
  const c = nodes(tree).find((n) => n.props.key === "cursor");
  if (!c) return null;
  const s = styleOf(c);
  return { x: Number(s.left), y: Number(s.top), w: Number(c.props.width), h: Number(c.props.height) };
}

test("« Un clic sur tes produits » (v1): its three shots and its moments at the original's images (90 BPM, a beat every 20), one beat more for her second name", () => {
  assert.equal(curseur.version, 1);
  assert.equal(curseur.bpm, 90);
  assert.deepEqual(curseur.shots, [3, 3]);
  const line = curseur.timeline(3, { end: false });
  // Her place until its pause (its first click on image 40), the paused time (the close-up), her place played again.
  assert.deepEqual(line.shots.map((s) => [toFrame(s.start), toFrame(s.end)]), [[0, 41], [41, 238], [238, 326]]);
  assert.equal(toFrame(line.duration), 326);
  // Its clicks on the original's images, up to its second name; after it, one beat later (20 images: her name read 1,7 s).
  const clicks = CURSEUR_CLICKS.map((c) => line.marks[c]!);
  clicks.forEach((c, i) => assert.equal(c, ORIGINAL_CLICKS[i]! + (i >= 4 ? 20 : 0), `${CURSEUR_CLICKS[i]}`));
  assert.deepEqual([line.marks.zoom, line.marks.back! - 20], ORIGINAL_CUTS);
  // Each click heard (a mouse click, alone in the silence), on its image.
  assert.deepEqual(line.sounds!.map((s) => toFrame(s.at)), clicks);
  assert.ok(line.sounds!.every((s) => s.sound === "computer mouse click" && s.gain === 2));
  // The music stops dead on the first click and comes back on the last, to the end.
  assert.deepEqual(line.music!.pauses!.map((p) => [toFrame(p.from), toFrame(p.to)]), [[40, 238]]);
  assert.ok(Math.abs(line.music!.end!.at - line.duration) < 0.001);
  // Its names on their clicks, cleared together; each read long enough (0,8 s and 0,3 s a word, three words at most).
  assert.deepEqual(Object.keys(line.texts), ["produit1", "produit2"]);
  assert.deepEqual([toFrame(line.texts.produit1!.from), toFrame(line.texts.produit2!.from), toFrame(line.texts.produit1!.to)], [83, 109, 161]);
  assert.ok(line.texts.produit2!.to - line.texts.produit2!.from >= 0.8 + 3 * 0.3 - 0.01);
  // Nothing of her is cut out; its products are named by the filler on the close-up.
  assert.deepEqual(line.cutouts, []);
  assert.deepEqual(curseur.objects?.map((o) => [o.slot, o.shot]), [["produit1", 1], ["produit2", 1]]);
  // The shots' wants for the filler: her place, her products close, the rest of the same video from its pause.
  assert.match(line.shots[0]!.want, /se met en pause/);
  assert.match(line.shots[1]!.want, /deux de ses produits/);
  assert.match(line.shots[2]!.want, /même vidéo que le premier plan.*1,37 s/);
});

test("« Un clic sur tes produits »: at another tempo all of it follows; an ending card after it, a click more, the music to its end", () => {
  const line = curseur.timeline(3, { end: false });
  const slow = curseur.timeline(3, { end: false, bpm: 76 });
  assert.ok(Math.abs(slow.duration / line.duration - 90 / 76) < 0.01, `${slow.duration}`);
  assert.equal(slow.marks.play, Math.round((238 * 90) / 76));
  assert.ok(Math.abs(slow.music!.pauses![0]!.to - slow.marks.play! / 30) < 0.02);
  const { min, max } = skillLengths(curseur);
  assert.ok(min >= 9 && max <= 13.5, `${min}–${max}`);
  // An ending card: 1,6 s at least after its length, its last shot longer, one click more (the cursor comes back for it).
  const ended = curseur.timeline(3, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6 && ended.duration - line.duration < 1.75, `${ended.duration}`);
  assert.equal(ended.shots[1]!.end, line.shots[1]!.end);
  assert.equal(ended.sounds!.length, line.sounds!.length + 1);
  assert.ok(Math.abs(ended.sounds!.at(-1)!.at - (ended.duration - 1.6)) < 0.01);
  assert.ok(Math.abs(ended.music!.end!.at - ended.duration) < 0.001);
});

test("« Un clic sur tes produits »: its plan, the same video from its pause on its last shot, its sounds and its music", () => {
  const files = [
    { id: "lieu", photo: false, seconds: 10 },
    { id: "gros", photo: true, seconds: 0 },
  ];
  const fill = readSkillFill(curseur, files, 3, {
    fits: true,
    missing: "",
    shots: [{ file: "lieu", at: 4 }, { file: "gros", at: 0 }, { file: "lieu", at: 5.37 }],
    texts: [{ slot: "produit1", text: "Cappuccino" }, { slot: "produit2", text: "Brownie aux noix de pécan" }],
    objets: [{ slot: "produit1", name: "cappuccino cup" }, { slot: "produit2", name: "brownie" }],
    end: null,
    why: "",
  } as never)!;
  // A name longer than its place cut at its last word that fits.
  assert.deepEqual(fill.texts, { produit1: "Cappuccino", produit2: "Brownie aux noix" });
  assert.deepEqual(fill.objects, { produit1: "cappuccino cup", produit2: "brownie" });
  const plan = skillPlan({ skill: curseur, name: "Un clic sur tes produits", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  // Her place, then from where it stopped: never the same passage twice.
  assert.deepEqual(plan.segments.map((s) => ("clip_id" in s ? [s.clip_id, s.in, s.out] : [])), [["lieu", 4, 5.37], ["gros", 0, 6.56], ["lieu", 5.37, 8.31]]);
  assert.equal(plan.sounds?.length, 8);
  assert.deepEqual(plan.music_shape?.pauses, [{ from: 1.333, to: 7.933 }]);
  // What its code follows: her two products on the close-up, by the names its filler gave; nothing of her cut out.
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 3, subjects: [], objects: [{ shot: 1, name: "cappuccino cup" }, { shot: 1, name: "brownie" }] });
  assert.match(plan.layers![0]!.motion.code!, /"cappuccino cup"/);
  // Light to render: no cut-out, no clear area, its light read under its names on the close-up only.
  assert.deepEqual(checkMotionCode(curseur.code), []);
  assert.deepEqual(subjectsDrawn(curseur.code), []);
  assert.deepEqual([objectsDrawn(curseur.code), clearsDrawn(curseur.code)], [[], []]);
  assert.deepEqual(readsDrawn(curseur.code).map((r) => r.shot), [1]);
  assert.ok(curseur.code.length < 24000, `${curseur.code.length}`);
});

test("« Un clic sur tes produits »: her video plays, stops on the first click, the close-up held, her video held then played on", () => {
  const draw = sceneOf(curseur.code);
  const props = propsFor(UPRIGHT, WORDS);
  const footage = (f: number) => nodes(draw(f, props)).find((n) => n.type === "Footage")!;
  // Her place at its own moment (it holds its last image after its pause, image 40), full frame.
  assert.equal(footage(20).props.shot, 0);
  assert.equal(footage(60).props.shot, 0);
  assert.equal(footage(60).props.at, undefined);
  assert.deepEqual(styleOf(footage(20)), { left: 0, top: 0, width: 1080, height: 1920 });
  // The close-up from the second click, held on its first image (it plays from the frame shown: always its image 0).
  assert.equal(footage(67).props.shot, 0);
  assert.equal(footage(68).props.shot, 1);
  assert.equal(footage(120).props.at, 120);
  // Back on the double click's second click (image 199): her place again, held until the last click (its own moment), then played.
  assert.equal(footage(198).props.shot, 1);
  assert.equal(footage(199).props.shot, 2);
  assert.equal(footage(260).props.at, undefined);
});

test("« Un clic sur tes produits »: the cursor, a pixel arrow pressed in on each click, in from the left, out by the bottom left", () => {
  const draw = sceneOf(curseur.code);
  const props = propsFor(UPRIGHT, WORDS);
  // Not there before image 10; in from the left edge; gone once out by the bottom left.
  assert.equal(cursorAt(draw(9, props)), null);
  const first = cursorAt(draw(10, props))!;
  assert.ok(first.x < 0 && first.y > 700 && first.y < 800, JSON.stringify(first));
  assert.equal(cursorAt(draw(300, props)), null);
  // Its size: 12 × 19 cells of 9 px (171 px tall, 9 % of the height as the original's), 69 % on a click, 84 % around it.
  const rest = cursorAt(draw(36, props))!;
  assert.deepEqual([rest.w, rest.h], [108, 171]);
  for (const c of [40, 68, 83, 109, 161, 194, 199, 238]) {
    assert.ok(Math.abs(cursorAt(draw(c, props))!.h - 171 * 0.69) < 1, `click ${c}`);
    assert.ok(Math.abs(cursorAt(draw(c - 1, props))!.h - 171 * 0.84) < 1, `before ${c}`);
  }
  // Pressed about its centre: its box's middle stays.
  const pressed = cursorAt(draw(40, props))!;
  const restAt40 = cursorAt(draw(37, props))!;
  assert.ok(Math.abs(pressed.x + pressed.w / 2 - (restAt40.x + restAt40.w / 2)) <= 1 && Math.abs(pressed.y + pressed.h / 2 - (restAt40.y + restAt40.h / 2)) <= 1);
  // Its pixels: a white body and a black outline, drawn crisp.
  const svg = nodes(draw(36, props)).find((n) => n.props.key === "cursor")!;
  assert.equal(svg.props.shapeRendering, "crispEdges");
  assert.deepEqual(nodes(svg).filter((n) => n.type === "path").map((n) => n.props.fill), ["#ffffff", "#000000"]);
  // In a straight line at an even pace between two of its keyframes (its glide down to her second product).
  const a = cursorAt(draw(90, props))!;
  const b = cursorAt(draw(96, props))!;
  const c = cursorAt(draw(102, props))!;
  assert.ok(Math.abs(b.x - a.x - (c.x - b.x)) <= 1 && Math.abs(b.y - a.y - (c.y - b.y)) <= 1, JSON.stringify([a, b, c]));
});

test("« Un clic sur tes produits »: without anything read, the cursor clicks where the original's does", () => {
  const draw = sceneOf(curseur.code);
  const props = propsFor(UPRIGHT, WORDS);
  const tip = (f: number) => cursorAt(draw(f, props))!;
  // Beside the person (67,6 %, 63,2 %), on what she holds (47,4 %, 60,2 %), her two products (41,3 %, 45 % and 51 %, 73 %),
  // away from them (82,8 %, 55,4 %), the top for the double click (62,2 %, 20 %), the person again (50 %, 62 %).
  const near = (f: number, x: number, y: number) => {
    const p = tip(f - 3);
    assert.ok(Math.abs(p.x - 1080 * x) <= 2 && Math.abs(p.y - 1920 * y) <= 2, `${f}: ${JSON.stringify(p)} for ${x}, ${y}`);
  };
  near(40, 0.676, 0.632);
  near(68, 0.474, 0.602);
  near(83, 0.413, 0.45);
  near(109, 0.51, 0.73);
  near(161, 0.828, 0.554);
  near(194, 0.622, 0.2);
  near(238, 0.5, 0.62);
});

test("« Un clic sur tes produits »: the cursor goes to the person and to her products as they are read, her names placed near them", () => {
  // Her body and hands on the image where it stops (and on its last shot's first), her products found on the close-up.
  const track = (_f: number, box?: Record<string, number>) => ({
    bodies: [{ points: { left_shoulder: { x: 380, y: 700, visible: true }, right_shoulder: { x: 600, y: 700, visible: true }, left_hip: { x: 400, y: 1100, visible: true }, right_hip: { x: 580, y: 1100, visible: true } } }],
    hands: [{ points: { wrist: { x: 470, y: (box?.top ?? 0) + 980 }, index_tip: { x: 500, y: (box?.top ?? 0) + 1000 } } }],
  });
  const boxes = { "cappuccino cup": { x: 80, y: 700, w: 420, h: 360 }, brownie: { x: 560, y: 1150, w: 380, h: 300 } };
  const code = curseur.code.split('"@produit1"').join('"cappuccino cup"').split('"@produit2"').join('"brownie"');
  const draw = sceneOf(code, { track, boxes });
  const props = propsFor(UPRIGHT, WORDS);
  const tip = (f: number) => cursorAt(draw(f, props))!;
  // Its first click beside her, at her hands' height; its second onto what she holds.
  assert.ok(Math.abs(tip(37).x - (600 + 1080 * 0.11)) <= 2 && Math.abs(tip(37).y - (990 + 1920 * 0.04)) <= 2, JSON.stringify(tip(37)));
  assert.ok(Math.abs(tip(66).x - 485) <= 2 && Math.abs(tip(66).y - 990) <= 2, JSON.stringify(tip(66)));
  // On each product, a little right of its middle and above.
  assert.ok(Math.abs(tip(81).x - (80 + 420 * 0.58)) <= 2 && Math.abs(tip(81).y - (700 + 360 * 0.4)) <= 2, JSON.stringify(tip(81)));
  assert.ok(Math.abs(tip(107).x - (560 + 380 * 0.58)) <= 2 && Math.abs(tip(107).y - (1150 + 300 * 0.4)) <= 2, JSON.stringify(tip(107)));
  // Her names: there at once on their click, never before; gone at once on the click that clears them.
  const named = (f: number) => nodes(draw(f, props)).filter((n) => n.type === "FitText" && String(n.props.key).startsWith("name-"));
  assert.equal(named(82).length, 0);
  assert.deepEqual(named(83).map(textOf), ["Cappuccino"]);
  assert.deepEqual(named(109).map(textOf), ["Cappuccino", "Brownie"]);
  assert.equal(named(160).length, 2);
  assert.equal(named(161).length, 0);
  // Each one near its product, never on the other product nor on the other name, inside the safe zone, at 48 px at least.
  type R = { left: number; top: number; width: number; height: number };
  const [n1, n2] = named(120).map((n) => styleOf(n) as unknown as R);
  const hit = (a: R, b: Box) => a.left < b.x + b.w && b.x < a.left + a.width && a.top < b.y + b.h && b.y < a.top + a.height;
  assert.ok(!hit(n1!, boxes.brownie) && !hit(n2!, boxes["cappuccino cup"]), JSON.stringify([n1, n2]));
  assert.ok(!hit(n1!, { x: n2!.left, y: n2!.top, w: n2!.width, h: n2!.height }));
  for (const b of [n1!, n2!]) {
    assert.ok(b.left >= 40 && b.top >= 80 && b.top + b.height <= 1440 && b.left + b.width <= (b.top + b.height > 960 ? 940 : 1040), JSON.stringify(b));
  }
  assert.ok(named(120).every((n) => (n.props.innerStyle as { fontSize: number }).fontSize >= 48));
  // In big white condensed capitals, her title font; a hand-drawn arrow from each product to its name, drawn at once.
  const inner = named(120)[0]!.props.innerStyle as Record<string, unknown>;
  assert.deepEqual([inner.color, inner.textTransform, inner.fontSize], ["#ffffff", "uppercase", 104]);
  assert.match(String(inner.fontFamily), /Bebas Neue/);
  const strokes = nodes(draw(120, props)).filter((n) => n.type === "Scribble");
  const arrows = strokes.filter((n) => String(n.props.key).startsWith("arrow-"));
  assert.equal(arrows.length, 2);
  assert.ok(strokes.every((a) => a.props.kind === "arrow" && a.props.frames === 1));
  assert.equal(arrows[0]!.props.at, 82);
  // Each over a thin dark edge on the same path (it reads where it crosses a white plate).
  const edges = strokes.filter((n) => String(n.props.key).startsWith("edge-"));
  assert.deepEqual(edges.map((e) => [e.props.seed, e.props.from, e.props.to]), arrows.map((a) => [a.props.seed, a.props.from, a.props.to]));
  assert.ok(edges.every((e, i) => Number(e.props.width) > Number(arrows[i]!.props.width)));
  // On a bright place (a white plate under it), her dark ink instead.
  const bright = sceneOf(code, { track, boxes, light: 0.85 });
  assert.equal((nodes(bright(120, props)).find((n) => n.type === "FitText")!.props.innerStyle as { color: string }).color, "#1d1d1b");
});

test("« Un clic sur tes produits »: a horizontal video whole in a band on black, its names on the black; or as her words ask", () => {
  const draw = sceneOf(curseur.code);
  const wide: [number, number, number] = [16 / 9, 16 / 9, 16 / 9];
  const footage = (f: number, p: Record<string, unknown>) => styleOf(nodes(draw(f, p)).find((n) => n.type === "Footage")!);
  assert.deepEqual(footage(20, propsFor(wide, WORDS)), { left: 0, top: 656, width: 1080, height: 608 });
  // Its upright close-up full frame, between her horizontal place in its band (each shot as it was filmed).
  const mixed: [number, number, number] = [16 / 9, 3 / 4, 16 / 9];
  assert.deepEqual(footage(100, propsFor(mixed, WORDS)), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(footage(20, propsFor(mixed, WORDS)).top, 656);
  // In the band, her names on the black above or below the picture.
  const names = nodes(draw(120, propsFor(wide, WORDS))).filter((n) => n.type === "FitText").map((n) => styleOf(n) as { top: number; height: number });
  assert.equal(names.length, 2);
  assert.ok(names.every((b) => b.top + b.height <= 656 || b.top >= 1264), JSON.stringify(names));
  // As her words ask: all upright, or all in the band.
  assert.deepEqual(footage(20, propsFor(wide, WORDS, { texts: { ...propsFor(wide, WORDS).texts, format: "vertical" } })), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(footage(100, propsFor(UPRIGHT, WORDS, { texts: { ...propsFor(UPRIGHT, WORDS).texts, format: "horizontal" } })).height, 608);
  assert.deepEqual(curseur.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]]]);
});

test("« Un clic sur tes produits »: one name only, its second click skipped; its ending card after a click, in the same capitals", () => {
  const draw = sceneOf(curseur.code);
  const one = propsFor(UPRIGHT, { produit1: "Croissant" });
  assert.deepEqual(nodes(draw(120, one)).filter((n) => n.type === "FitText").map(textOf), ["Croissant"]);
  const line = curseur.timeline(3, { end: true });
  const props = propsFor(UPRIGHT, WORDS, { end: { title: "Ouvert dimanche", subtitle: "de 9 h à 14 h", from: toFrame(line.duration) - 48 } }, line);
  const at = toFrame(line.duration) - 48;
  // The cursor back for it, its click on the card's first image.
  assert.ok(cursorAt(draw(at - 10, props)));
  assert.ok(Math.abs(cursorAt(draw(at, props))!.h - 171 * 0.69) < 1);
  const texts = nodes(draw(at + 5, props)).filter((n) => n.type === "FitText").map(textOf);
  assert.deepEqual(texts, ["Ouvert dimanche", "de 9 h à 14 h"]);
  assert.equal(nodes(draw(at - 1, props)).filter((n) => n.type === "FitText").length, 0);
});
