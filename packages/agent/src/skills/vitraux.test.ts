import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillCode, skillLengths, skillPlan, skillTempos, type SkillFile } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { vitraux } from "./vitraux.ts";

// « Ta devanture en kaléidoscope » (skills/vitraux.ts, docs/fiches/vitraux.md): its timeline on its original's grid, its
// loop's music, and what its code draws frame by frame (its mirrors over her thing or her whole picture, its rosace, its
// frame, her name), run with a plain tree for React and stand-ins for the kit's readings.

/** The original's images, at 30 i/s (the fiche): the change from its third image, whole by 1,56 s, back from 7,40 s, real from 8,50 s, its end. */
const ORIGINAL = { open: 2, full: 47, close: 222, real: 255, end: 270 };

test("« Ta devanture en kaléidoscope » (v1): one still shot on its original's grid (123,4 BPM, its first beat at 0,345 s), its landmarks within an image", () => {
  assert.equal(vitraux.key, "vitraux");
  assert.equal(vitraux.version, 1);
  assert.equal(vitraux.bpm, 123.4);
  assert.deepEqual(vitraux.shots, [1, 1]);
  assert.equal(vitraux.long, 3);
  const line = vitraux.timeline(1, { end: false });
  assert.equal(line.shots.length, 1);
  assert.equal(Math.round(line.duration * 30), ORIGINAL.end);
  const m = line.marks;
  assert.equal(m.first, 10);
  assert.ok(Math.abs(m.beat! - 14.587) < 0.01);
  for (const [k, f] of [["open_from", ORIGINAL.open], ["full", ORIGINAL.full], ["close", ORIGINAL.close], ["real", ORIGINAL.real]] as const) {
    assert.ok(Math.abs(m[k]! - f) <= 1, `${k}: ${m[k]} for ${f}`);
  }
  // Her name and her line from beat 12 (6,18 s) to the end; nothing cut out of her, ever.
  assert.deepEqual(Object.keys(line.texts), ["nom", "ligne"]);
  assert.ok(Math.abs(line.texts.nom!.from - 6.18) <= 0.02 && line.texts.nom!.to === line.duration);
  assert.equal(line.cutouts, undefined);
  assert.equal(line.sounds, undefined);
  // Its loop played through, its first beat on 0,345 s, cut dead at its end (no stop, no filter).
  assert.ok(Math.abs(line.music!.downbeat! - 0.345) < 0.005);
  assert.ok(line.music!.end!.at === line.duration && line.music!.end!.fade! < 0.02);
  assert.equal(line.music!.pauses, undefined);
  assert.equal(line.music!.filters, undefined);
  // Its tempo range: 86 to 140 BPM, 7,9 to 12,9 s with one shot, up to about 24 s with its two verses.
  assert.deepEqual(skillTempos(vitraux), [86, 140]);
  const lengths = skillLengths(vitraux);
  assert.ok(lengths.min > 7.5 && lengths.min < 8.2 && lengths.max > 23.5 && lengths.max < 45, JSON.stringify(lengths));
});

test("« Ta devanture en kaléidoscope »: a verse is one more of her things, eight beats, cut on a bar; an ending card after the loop", () => {
  const one = vitraux.timeline(1, { end: false });
  const two = vitraux.timeline(2, { end: false });
  const three = vitraux.timeline(3, { end: false });
  const beat = 60 / 123.4;
  assert.equal(two.shots.length, 2);
  // Its cut on the bar of beat 8 (4,24 s), the next eight beats later; each verse eight beats longer.
  assert.ok(Math.abs(two.shots[1]!.start - (0.71 + 8) * beat) < 0.02, String(two.shots[1]!.start));
  assert.ok(Math.abs(three.shots[2]!.start - three.shots[1]!.start - 8 * beat) < 0.02);
  assert.ok(Math.abs(two.duration - one.duration - 8 * beat) < 0.02 && Math.abs(three.duration - two.duration - 8 * beat) < 0.02);
  // Its closing and its name follow: the mirrors close on the last shot, her name eight beats later.
  assert.ok(Math.abs(two.marks.close! - one.marks.close! - 8 * beat * 30) <= 1 && Math.abs(two.marks.real! - one.marks.real! - 8 * beat * 30) <= 1);
  assert.ok(Math.abs(two.texts.nom!.from - one.texts.nom!.from - 8 * beat) < 0.02);
  assert.match(two.shots[1]!.want, /une autre de ses choses/);
  // An ending card: whole beats after its loop (1,6 s at least), her words giving way to it.
  const ended = vitraux.timeline(1, { end: true });
  assert.ok(ended.duration - one.duration >= 1.6 && ended.texts.nom!.to <= ended.duration - 1.6 + 0.01);
  assert.ok(ended.music!.end!.at === ended.duration);
  // At another tempo, every landmark follows it.
  const slower = vitraux.timeline(1, { end: false, bpm: 100 });
  assert.ok(Math.abs(slower.marks.close! / one.marks.close! - 123.4 / 100) < 0.02 && Math.abs(slower.duration / one.duration - 123.4 / 100) < 0.02);
});

test("« Ta devanture en kaléidoscope »: on the plan, her thing named and followed on her one shot, never her cut-out; its code light to check", () => {
  const files: SkillFile[] = [{ id: "door", photo: false, seconds: 12, aspect: 9 / 16 }];
  const fill = { shots: [{ file: "door", at: 1 }], texts: { nom: "Maison Farine", ligne: "12 rue des Martyrs" }, end: null, objects: { devanture: "front door" } };
  const plan = skillPlan({ skill: vitraux, name: "Ta devanture en kaléidoscope", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 1);
  assert.equal(plan.duration, 9);
  assert.equal(plan.tempo, 123.4);
  const layer = plan.layers![0]!;
  assert.deepEqual(layer.motion.drawn, { shots: 1, objects: [{ shot: 0, name: "front door" }] });
  const code = skillCode(vitraux, fill.objects);
  assert.ok(code.length < 24000, String(code.length));
  assert.deepEqual(checkMotionCode(code), []);
  // Never her cut-out (no rented card for it): only her thing, by its name, on her first shot.
  assert.deepEqual(subjectsDrawn(code), []);
  assert.deepEqual(objectsDrawn(code), [{ shot: 0, name: "front door" }]);
  // Unnamed (her thing fills her picture), « @devanture » is no object: the mirrors take her whole picture.
  assert.deepEqual(objectsDrawn(vitraux.code), []);
  // Her words set in the calm part of her last picture, their colour by its light there.
  assert.deepEqual(clearsDrawn(code), [-1]);
  assert.deepEqual(readsDrawn(code), [{ shot: -1, kinds: ["light"] }]);
  // A photo plays still: the mirrors alone move over it.
  const photo = skillPlan({ skill: vitraux, name: "Ta devanture en kaléidoscope", files: [{ id: "p", photo: true, seconds: 0 }], fill: { ...fill, shots: [{ file: "p", at: 0 }] } });
  assert.deepEqual(photo.segments[0], { clip_id: "p", in: 0, out: 9, zoom: "none" });
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };
type Reads = { box?: Box | null; outline?: string | null; clear?: Box | null; light?: number };

/** What its Scene draws at a frame, run with a plain tree for React: the kit's pieces as named nodes, its readings as given. */
function drawAt(frame: number, props: { shots?: number; aspect?: number; reads?: Reads; settings?: Record<string, string>; hook?: string; caption?: string; end?: { title: string; subtitle?: string; from: number } | null } = {}): Drawn {
  const n = props.shots ?? 1;
  const line = vitraux.timeline(n, { end: Boolean(props.end) });
  const r = props.reads ?? {};
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    useCurrentFrame: () => frame,
    SubjectBox: (_s: unknown, _f: number, laid: { left: number }, name: string) => (name === "front door" && r.box ? { ...r.box, x: r.box.x + (laid?.left ?? 0) } : null),
    SubjectOutline: (_s: unknown, _f: number, _l: unknown, name: string) => (name === "front door" ? (r.outline ?? null) : null),
    ClearBox: (_s: unknown, _f: number, _l: unknown, o: { fallback: Box }) => (r.clear === undefined ? o.fallback : r.clear),
    LightUnder: () => (r.light === undefined ? null : { mean: r.light, high: r.light }),
  };
  const code = skillCode(vitraux, { devanture: "front door" });
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const shots = line.shots.map((s) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect: props.aspect ?? 9 / 16 }));
  const durationInFrames = Math.round(line.duration * 30);
  const texts = { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...props.settings };
  const span = (slot: string) => ({ from: Math.round(line.texts[slot]!.from * 30), to: Math.round(line.texts[slot]!.to * 30) });
  const reelTexts = [...(props.hook ? [{ text: props.hook, role: "hook", ...span("nom"), emphasis: [] }] : []), ...(props.caption ? [{ text: props.caption, role: "caption", ...span("ligne"), emphasis: [] }] : [])];
  const brand = { name: "Maison Farine", displayFont: "Bodoni Moda", bodyFont: "Jost", accent: "#b5293f", palette: { secondary: "#1d3b2a" } };
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
/** Its strips of mirrors at a frame: each one's span across and where its column x shows her picture from. */
function strips(tree: Drawn) {
  const group = keyed(tree, "battants");
  if (!group) return [];
  return (group.children.flat() as Drawn[]).map((s) => {
    const st = styleOf(s);
    const inner = s.children[0] as Drawn;
    const copy = inner.children[0] as Drawn;
    const move = String(styleOf(copy).transform);
    const t = Number(/translateX\((-?[\d.]+)px\)/.exec(move)![1]);
    const mirrored = /scaleX\(-1\)/.test(move);
    // Her picture's column shown at x: x − t straight, t − x mirrored.
    return { left: Number(st.left), right: Number(st.left) + Number(st.width), top: Number(st.top), height: Number(st.height), source: (x: number) => (mirrored ? t - x : x - t), mirrored };
  });
}

test("« Ta devanture en kaléidoscope »: her real picture first, mirrors that open fast then slower, slide all along, close and give her picture back", () => {
  // Her real picture alone on its first images, and again at the end: the loop.
  for (const f of [0, 1, 2, 255, 262, 269]) assert.equal(keyed(drawAt(f), "battants"), null, `frame ${f}`);
  assert.ok(keyed(drawAt(0), "real"));
  // From its third image: a few strips, the middle one nearly her whole picture at its own place.
  const early = strips(drawAt(4));
  const middle = early.find((s) => s.left <= 540 && s.right >= 540)!;
  assert.ok(middle.right - middle.left > 700, JSON.stringify(early.map((s) => [s.left, s.right])));
  assert.ok(Math.abs(middle.source(540) - 540) < 40);
  // At full: three to five strips over her whole picture, from edge to edge, joined: each mirror line shows the same
  // column of her picture on both sides (no seam), every strip the same window of it, one in two mirrored.
  for (const f of [60, 110, 160, 210]) {
    const s = strips(drawAt(f)).sort((a, b) => a.left - b.left);
    assert.ok(s.length >= 3 && s.length <= 7, `frame ${f}: ${s.length}`);
    assert.equal(s[0]!.left, 0);
    assert.equal(s.at(-1)!.right, 1080);
    for (let j = 1; j < s.length; j++) {
      assert.ok(s[j]!.left <= s[j - 1]!.right && s[j]!.left >= s[j - 1]!.right - 1, `frame ${f}: strips ${j - 1} and ${j}`);
      const x = s[j]!.left + 0.5;
      assert.ok(Math.abs(s[j - 1]!.source(x) - s[j]!.source(x)) < 2, `frame ${f}: a seam at ${x}`);
      assert.notEqual(s[j]!.mirrored, s[j - 1]!.mirrored);
    }
    assert.ok(s.every((x) => x.top === 0 && x.height === 1920));
  }
  // It never comes back the same: its strips move from one moment to the next.
  const at = (f: number) => strips(drawAt(f)).map((s) => s.left).join(",");
  assert.notEqual(at(100), at(130));
  assert.notEqual(at(130), at(160));
  // Closing: fewer and wider strips, then none.
  assert.ok(strips(drawAt(250)).find((s) => s.left <= 540 && s.right >= 540)!.right - strips(drawAt(250)).find((s) => s.left <= 540 && s.right >= 540)!.left > 600);
});

test("« Ta devanture en kaléidoscope »: inside her door when it is found (clipped to its outline when whole), her picture real around it", () => {
  const door = { x: 200, y: 300, w: 680, h: 1300 };
  const s = strips(drawAt(120, { reads: { box: door } }));
  assert.ok(s.length >= 3);
  assert.ok(s.every((x) => x.left >= 200 && x.right <= 880 && x.top === 300 && x.height === 1300), JSON.stringify(s.map((x) => [x.left, x.right, x.top, x.height])));
  // Its outline whole in the picture (a closed path): the mirrors clipped to it; cut by the picture's edge: its box.
  const closed = "M 200 300 C 500 290 800 290 880 300 C 890 900 890 1500 880 1600 C 600 1610 300 1610 200 1600 C 190 900 190 600 200 300 Z";
  assert.equal(styleOf(keyed(drawAt(120, { reads: { box: door, outline: closed } }), "battants")).clipPath, `path('${closed}')`);
  assert.equal(styleOf(keyed(drawAt(120, { reads: { box: door, outline: "M 0 300 C 500 290 800 290 880 300 M 880 1600 C 600 1610 300 1610 0 1600" } }), "battants")).clipPath, undefined);
  // Too small to carry it, or her whole picture already: the mirrors take her whole picture.
  assert.ok(strips(drawAt(120, { reads: { box: { x: 500, y: 900, w: 120, h: 200 } } })).every((x) => x.top === 0 && x.height === 1920));
  assert.ok(strips(drawAt(120, { reads: { box: { x: 0, y: 0, w: 1080, h: 1920 } } })).every((x) => x.top === 0 && x.height === 1920));
});

test("« Ta devanture en kaléidoscope »: its rosace, eight wedges one in two mirrored, opening from her thing's middle, turning, closing", () => {
  const rose = (f: number, reads?: Reads) => keyed(drawAt(f, { settings: { figure: "rosace" }, ...(reads ? { reads } : {}) }), "rosace");
  assert.equal(rose(1), null);
  assert.equal(keyed(drawAt(120, { settings: { figure: "rosace" } }), "battants"), null);
  const radius = (d: Drawn | null) => Number(/circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/.exec(String(styleOf(d).clipPath))![1]);
  const centre = (d: Drawn | null) => /circle\([\d.]+px at ([\d.]+)px ([\d.]+)px\)/.exec(String(styleOf(d).clipPath))!.slice(1, 3).map(Number);
  // A small circle at first, as wide as half the frame at full, back down when it closes.
  assert.ok(radius(rose(5)) < radius(rose(20)) && radius(rose(20)) < radius(rose(120)));
  assert.ok(Math.abs(radius(rose(120)) - 540) < 1);
  assert.ok(radius(rose(250)) < 200);
  assert.deepEqual(centre(rose(120)), [540, 960]);
  const wedges = rose(120)!.children.flat() as Drawn[];
  assert.equal(wedges.length, 8);
  const turns = wedges.map((w) => String(styleOf(w.children[0] as Drawn).transform));
  turns.forEach((t, j) => assert.equal(/scaleX\(-1\)/.test(t), j % 2 === 1, t));
  // It turns: its wedges' angles change from one moment to the next.
  assert.notEqual(String(styleOf((rose(150)!.children.flat() as Drawn[])[0]!.children[0] as Drawn).transform), turns[0]);
  // On her door: centred on it, inscribed in it (the wall around it real).
  const door = { x: 300, y: 500, w: 400, h: 600 };
  const onDoor = rose(120, { box: door });
  assert.deepEqual(centre(onDoor), [500, 800]);
  assert.ok(Math.abs(radius(onDoor) - 200) < 0.1);
});

test("« Ta devanture en kaléidoscope »: its frame as her file's, a horizontal one cropped on her door when it fits, else in a band on black", () => {
  const real = (tree: Drawn) => styleOf(keyed(tree, "real"));
  assert.deepEqual(real(drawAt(60)), { left: 0, top: 0, width: 1080, height: 1920 });
  // Horizontal, her door found (500 px wide in her 3413 px picture): cropped on it, its middle in the frame's.
  const wide = real(drawAt(60, { aspect: 16 / 9, reads: { box: { x: 2000, y: 300, w: 500, h: 1300 } } }));
  assert.equal(wide.width, 3413);
  assert.equal(Number(wide.left) + 2250, 540);
  // Too wide for the vertical frame, or nothing found: her whole video in a 16:9 band on black, the mirrors in it.
  const band = { left: 0, top: 656, width: 1080, height: 608 };
  assert.deepEqual(real(drawAt(60, { aspect: 16 / 9, reads: { box: { x: 400, y: 300, w: 2400, h: 1300 } } })), band);
  assert.deepEqual(real(drawAt(60, { aspect: 16 / 9 })), band);
  assert.ok(strips(drawAt(60, { aspect: 16 / 9 })).every((s) => s.top === 656 && s.height === 608));
  // As her words ask.
  assert.deepEqual(real(drawAt(60, { aspect: 16 / 9, settings: { format: "vertical" } })), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(real(drawAt(60, { settings: { format: "horizontal" } })), band);
});

test("« Ta devanture en kaléidoscope »: her name in capitals over the mirrors closing, her line under it, in the safe zone; her ending card after", () => {
  const line = vitraux.timeline(1, { end: false });
  const from = Math.round(line.texts.nom!.from * 30);
  const words = (f: number, extra: Parameters<typeof drawAt>[1] = {}) => flatten(drawAt(f, { hook: "Maison Farine", caption: "12 rue des Martyrs", ...extra })).filter((d) => d.type === "FitText");
  assert.equal(words(from - 1).length, 0);
  const shown = words(from + 30);
  assert.equal(shown.length, 2);
  const [name, small] = shown as [Drawn, Drawn];
  assert.equal(name.children[0], "Maison Farine");
  assert.equal((name.props.innerStyle as Record<string, string>).textTransform, "uppercase");
  for (const t of shown) {
    const b = styleOf(t);
    assert.ok(Number(b.top) >= 80 && Number(b.top) + Number(b.height) <= 0.75 * 1920, `${t.props.key}`);
    assert.ok(Number(b.left) >= 140 && Number(b.left) + Number(b.width) <= 940, `${t.props.key}: ${b.left} ${b.width}`);
  }
  assert.ok(Number(styleOf(small).top) > Number(styleOf(name).top) + Number(styleOf(name).height) - 1);
  assert.equal((small.children[0] as Drawn).props["data-fauve-accent"], "");
  assert.ok(Number((small.props.innerStyle as Record<string, number>).fontSize) >= 48);
  // It comes in softly (a few images), then holds.
  assert.ok(Number(styleOf(words(from)[0]!).opacity) < 0.2 && Number(styleOf(words(from + 12)[0]!).opacity) === 1);
  // Over her picture left real above her door when there is room, its line just over the door; else in the calm part of
  // her picture when there is one; white on a dark one, an ink on a bright one.
  const over = words(from + 30, { reads: { box: { x: 200, y: 620, w: 680, h: 1000 } } });
  const sign = styleOf(over[1]!);
  assert.ok(Number(sign.top) + Number(sign.height) <= 620 - 10 && Number(styleOf(over[0]!).top) >= 110, JSON.stringify([styleOf(over[0]!), sign]));
  const clear = { x: 200, y: 900, w: 680, h: 180 };
  assert.equal(styleOf(words(from + 30, { reads: { clear } })[0]!).top, 900);
  assert.equal((words(from + 30)[0]!.props.innerStyle as Record<string, string>).color, "#ffffff");
  assert.equal((words(from + 30, { reads: { light: 0.8 } })[0]!.props.innerStyle as Record<string, string>).color, "#1c1a17");
  // Her ending card in their place, after her loop.
  const ended = vitraux.timeline(1, { end: true });
  const endFrom = Math.round((ended.duration - 1.6) * 30);
  const card = flatten(drawAt(endFrom + 20, { hook: "Maison Farine", caption: "12 rue des Martyrs", end: { title: "Ouvert dimanche", subtitle: "de 9 h à 13 h", from: endFrom } })).filter((d) => d.type === "FitText");
  assert.deepEqual(card.map((d) => (typeof d.children[0] === "string" ? d.children[0] : (d.children[0] as Drawn).children[0])), ["Ouvert dimanche", "de 9 h à 13 h"]);
});
