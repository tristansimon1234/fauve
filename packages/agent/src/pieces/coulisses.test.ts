import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type EditPlan } from "../schemas.ts";
import { pieceTestPlan, type PieceFill } from "../pieces.ts";
import { pickCues } from "../sfx.ts";
import { objectsDrawn, subjectsDrawn } from "../subject.ts";
import { coulisses, CUT, cutPlan, cutSounds, fallFrame, loadFrames } from "./coulisses.ts";

// « Coulisses façon fiche », the effect of the bank (coulisses.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** Its code run at one frame with a stand-in scope (the kit's pieces as named nodes, FitText's content drawn at its size): what it draws. */
function drawAt(code: string, frame: number, props: Record<string, unknown>): Drawn {
  const React = {
    createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat(Infinity).map((c) => (typeof c === "function" ? (c as (scale: number) => unknown)(1) : c)) }),
    Fragment: "Fragment",
  };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Subject: "Subject", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Drawn[] => (node && typeof node === "object" && "children" in node ? [node as Drawn, ...(node as Drawn).children.flatMap(nodes)] : []);
const textOf = (node: Drawn) => node.children.filter((c): c is string => typeof c === "string").join("");
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const keyed = (tree: Drawn, key: string) => nodes(tree).find((n) => n.props.key === key);

/** Her shots as its layer gets them: from the plan's shots, `from` in frames from the layer's start (negative before it). */
function layerProps(plan: EditPlan, aspect = 16 / 9) {
  const layer = plan.layers![0]!;
  let at = 0;
  const shots = plan.segments.map((s, i) => {
    const seconds = "clip_id" in s ? s.out - s.in : 0;
    const shot = { segment: i, src: `/v${i}.mp4`, aspect, kind: "video", from: Math.round((at - layer.from) * 30), durationInFrames: Math.round(seconds * 30) };
    at += seconds;
    return shot;
  });
  const durationInFrames = Math.round((layer.to - layer.from) * 30);
  return { width: 1080, height: 1920, durationInFrames, brand: { name: "Le Fournil", displayFont: "Inter Tight", bodyFont: "Inter Tight" }, shots: shots.filter((s) => s.from < durationInFrames), texts: layer.motion.texts };
}

/** A run under it: a lead shot, its first one `first` s long, then `n − 1` shots of `each` s (a beat at 100 BPM: 0,6 s), then the montage. */
function run(n: number, first = 1.2, each = 0.6) {
  return [
    { file: "lead", at: 1, seconds: 1.2 },
    ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: i ? each : first })),
    { file: "after", at: 2, seconds: 1.8 },
  ];
}
const fill = (texts: Record<string, string>, objects: Record<string, string> = {}, settings: Record<string, string> = {}): PieceFill => ({ texts, objects, settings });
const WORDS = { surtitre: "le son du", titre: "fournil" };

test("« Coulisses façon fiche » (effect v1): its layer over each count of shots, a move on each cut, its sounds within its span", () => {
  for (let n = coulisses.shots[0]; n <= coulisses.shots[1]; n++) {
    const span: [number, number] = [1.2, 1.2 + 1.2 + (n - 1) * 0.6];
    const plan = pieceTestPlan({ piece: coulisses, shots: run(n), span, fill: fill(WORDS, { objet: "plate of pastries" }), bpm: 100 });
    assert.ok(editPlanSchema.safeParse(plan).success, `n=${n}`);
    const motion = plan.layers![0]!.motion;
    // What her last shot shows, followed on that shot only (its index among her shots: the lead shot is the first).
    assert.deepEqual(motion.drawn, { shots: n + 2, objects: [{ shot: n, name: "plate of pastries" }] });
    // Its moves as marks: one on each cut, its last a whoosh, a loading's length with it.
    const kinds = Array.from({ length: n - 1 }, (_, k) => Number(motion.texts![`k${k + 1}`]));
    assert.equal(kinds.at(-1), CUT.whoosh, `n=${n}`);
    if (n >= 3) assert.equal(kinds[0], CUT.load, `n=${n}: the next shot loads over its first`);
    kinds.forEach((kind, k) => assert.equal(motion.texts![`ld${k + 1}`] !== undefined, kind === CUT.load));
    assert.equal(motion.texts!.fall, String(fallFrame(18)));
    // Its sounds: 16 at most, within its span, all kept a frame apart at any level but off.
    const sounds = motion.sounds ?? [];
    const seconds = span[1] - span[0];
    assert.ok(sounds.length >= 2 && sounds.length <= 16, `n=${n}: ${sounds.length}`);
    assert.ok(sounds.every((s) => s.skill && s.at >= 0 && s.at < seconds), `n=${n}`);
    assert.equal(pickCues(sounds, { level: "light", duration: 10, speech: [] }).length, sounds.length, `n=${n}`);
  }
  // Nothing named: nothing followed, and never her cut out (no matte job for every shot under it).
  const bare = pieceTestPlan({ piece: coulisses, shots: run(4), span: [1.2, 1.2 + 1.2 + 3 * 0.6], fill: fill({ titre: "coulisses" }), bpm: 100 });
  assert.equal(bare.layers![0]!.motion.drawn, undefined);
  assert.deepEqual(subjectsDrawn(coulisses.code), []);
  assert.deepEqual(objectsDrawn(coulisses.code), []);
  assert.deepEqual(subjectsDrawn(bare.layers![0]!.motion.js), []);
  const named = pieceTestPlan({ piece: coulisses, shots: run(4), span: [1.2, 1.2 + 1.2 + 3 * 0.6], fill: fill({ titre: "coulisses" }, { objet: "coffee cup" }), bpm: 100 });
  assert.deepEqual(subjectsDrawn(named.layers![0]!.motion.js), []);
  assert.deepEqual(objectsDrawn(named.layers![0]!.motion.js).map((o) => o.name), ["coffee cup"]);
});

test("« Coulisses façon fiche » (effect v1): the name of each sound under the card as it is heard, counted when it comes again, gone in a silence", () => {
  const NAME: Record<string, string> = {
    "short air whoosh": "WHOOSH",
    "camera shutter": "DÉCLENCHEUR",
    "computer data processing beeps": "CHARGEMENT",
    "camera shutter click": "DÉCLICS",
    "computer mouse double click": "CLIC SOURIS",
  };
  for (const n of [2, 4, 6, 8, 10]) {
    const plan = pieceTestPlan({ piece: coulisses, shots: run(n), span: [1.2, 1.2 + 1.2 + (n - 1) * 0.6], fill: fill(WORDS), bpm: 100 });
    const props = layerProps(plan);
    const labelAt = (f: number) => {
      const label = nodes(drawAt(coulisses.code, f, props)).find((x) => x.type === "FitText" && String(x.props.key).startsWith("n"));
      return label ? textOf(label) : "";
    };
    // On every sound, its label (its count after it when the same sound came within two thirds of a second).
    for (const s of plan.layers![0]!.motion.sounds ?? []) {
      const f = Math.round(s.at * 30);
      assert.ok(labelAt(f).startsWith(NAME[s.sound]!), `n=${n}: « ${labelAt(f)} » at frame ${f} for ${s.sound}`);
    }
  }
  // Her first shot a beat long, too short to load over: two flashes a beat apart, one label, counted.
  const flashes = pieceTestPlan({ piece: coulisses, shots: run(10, 0.6), span: [1.2, 1.2 + 10 * 0.6], fill: fill(WORDS), bpm: 100 });
  const flashed = layerProps(flashes);
  assert.deepEqual([flashes.layers![0]!.motion.texts!.k1, flashes.layers![0]!.motion.texts!.k2], [String(CUT.flash), String(CUT.flash)]);
  const flashLabel = nodes(drawAt(coulisses.code, 19, flashed)).find((x) => x.type === "FitText" && String(x.props.key).startsWith("n"))!;
  assert.equal(textOf(flashLabel), "DÉCLENCHEUR x2");
  // A cut in silence (the cycle's seventh): its label gone three images after the sound before it.
  const plan = pieceTestPlan({ piece: coulisses, shots: run(9), span: [1.2, 1.2 + 1.2 + 8 * 0.6], fill: fill(WORDS), bpm: 100 });
  const kinds = Array.from({ length: 8 }, (_, k) => Number(plan.layers![0]!.motion.texts![`k${k + 1}`]));
  assert.equal(kinds[6], CUT.silent);
  const props = layerProps(plan);
  const silent = props.shots.filter((s) => s.from >= 0)[7]!.from;
  const label = nodes(drawAt(coulisses.code, silent + 6, props)).find((x) => x.type === "FitText" && String(x.props.key).startsWith("n"));
  assert.equal(label, undefined);
});

test("« Coulisses façon fiche » (effect v1): its moves in the card: a loading tile by tile, a flash, the cut that stutters, her object before the last cut", () => {
  const plan = pieceTestPlan({ piece: coulisses, shots: run(5, 1.2), span: [1.2, 1.2 + 1.2 + 4 * 0.6], fill: fill(WORDS, { objet: "coffee cup" }), bpm: 100 });
  const props = layerProps(plan);
  const [load, flash, stutter, last] = props.shots.filter((s) => s.from > 0).map((s) => s.from);
  assert.deepEqual([load, flash, stutter, last], [36, 54, 72, 90]);
  // The next shot (her third) loading over her second: tiles of it in the card, from the loading's start (once the
  // opening whoosh is over) to the cut.
  const L = Math.min(loadFrames(36, 18), 36 - (fallFrame(18) + 10));
  assert.equal(L, 21);
  assert.equal(props.texts!.ld1, String(L));
  const loading = (f: number) => keyed(drawAt(coulisses.code, f, props), "load2");
  assert.equal(loading(load! - L - 1), undefined);
  assert.ok(loading(load! - 2));
  assert.deepEqual(nodes(loading(load! - 2)!).find((x) => x.type === "Footage")!.props.shot, 2);
  assert.equal(loading(load!), undefined);
  // A camera flash on its cut: two white images, in the card only.
  const white = (f: number) => keyed(drawAt(coulisses.code, f, props), "flash");
  assert.equal(white(flash! - 1), undefined);
  assert.equal(styleOf(white(flash!)!).opacity, 1);
  assert.equal(styleOf(white(flash! + 1)!).opacity, 1);
  assert.equal(white(flash! + 2), undefined);
  // The cut that stutters: six images between the two shots, the new one first (B B A B A B), then the new one stays.
  const inCard = (f: number) => nodes(keyed(drawAt(coulisses.code, f, props), "card")!).find((x) => x.type === "Footage")!.props.shot;
  assert.deepEqual(Array.from({ length: 7 }, (_, k) => inCard(stutter! + k)), [4, 4, 3, 4, 3, 4, 4]);
  // Its last cut a whoosh, what her last shot shows laid on the shot before it, in place, its five last images.
  // (Its layer's code, its object named by its filler: the code the engine plays.)
  const early = (f: number) => keyed(drawAt(plan.layers![0]!.motion.code!, f, props), "o");
  assert.equal(early(last! - 7), undefined);
  assert.deepEqual([early(last! - 6)?.props.shot, early(last! - 6)?.props.object], [5, "coffee cup"]);
  assert.equal(early(last!), undefined);
  // Without a name: a plain cut.
  const bare = pieceTestPlan({ piece: coulisses, shots: run(5, 1.2), span: [1.2, 1.2 + 1.2 + 4 * 0.6], fill: fill(WORDS), bpm: 100 });
  assert.equal(keyed(drawAt(bare.layers![0]!.motion.code!, last! - 3, layerProps(bare)), "o"), undefined);
});

test("« Coulisses façon fiche » (effect v1): its sheet, the card 16:9 for horizontal shots and square for vertical ones, its small words optional", () => {
  const plan = pieceTestPlan({ piece: coulisses, shots: run(4), span: [1.2, 3.0 + 1.2], fill: fill(WORDS), bpm: 100 });
  const card = (tree: Drawn) => styleOf(keyed(tree, "card")!);
  assert.deepEqual([card(drawAt(coulisses.code, 30, layerProps(plan))).top, card(drawAt(coulisses.code, 30, layerProps(plan))).height], [586, 459]);
  assert.deepEqual([card(drawAt(coulisses.code, 30, layerProps(plan, 9 / 16))).top, card(drawAt(coulisses.code, 30, layerProps(plan, 9 / 16))).height], [408, 816]);
  const square = pieceTestPlan({ piece: coulisses, shots: run(4), span: [1.2, 4.2], fill: fill(WORDS, {}, { format: "vertical" }), bpm: 100 });
  assert.equal(card(drawAt(coulisses.code, 30, layerProps(square))).height, 816);
  // Its title over the card, its small words on its two ends, falling into place on the opening whoosh.
  const heading = (f: number, p = layerProps(plan)) => keyed(drawAt(coulisses.code, f, p), "title")!;
  const row = (f: number) => nodes(heading(f)).find((x) => x.type === "div" && styleOf(x).justifyContent === "space-between");
  assert.equal(styleOf(row(1)!).opacity, 0);
  assert.match(String(styleOf(row(fallFrame(18))!).transform), /translateY\(-60px\)/);
  assert.equal(styleOf(row(fallFrame(18) + 1)!).transform, "none");
  assert.deepEqual(nodes(row(20)!).filter((x) => x.type === "span").map(textOf), ["LE", "SON DU"]);
  assert.ok(nodes(heading(20)).some((x) => textOf(x) === "FOURNIL"));
  // Without its small words, the big word alone.
  const alone = pieceTestPlan({ piece: coulisses, shots: run(4), span: [1.2, 4.2], fill: fill({ titre: "coulisses" }), bpm: 100 });
  assert.equal(nodes(heading(20, layerProps(alone))).find((x) => x.type === "div" && styleOf(x).justifyContent === "space-between"), undefined);
  // Its timeline is decor: its playhead crosses it from its first image to its last.
  const timeline = (f: number) => keyed(drawAt(coulisses.code, f, layerProps(plan)), "timeline")!;
  assert.ok("data-fauve-decor" in timeline(0).props);
});

test("« Coulisses façon fiche » (effect v1): its cuts' moves within its 16 sounds, a loading only where it has room", () => {
  // Ten shots a beat each: the cycle (a loading, a flash, a stutter, a click…), its last cut a whoosh. Its first shot a
  // beat long has no room for a loading after the opening whoosh (a flash instead); its eighth cut has.
  const shots = Array.from({ length: 10 }, (_, i) => ({ from: i * 18, frames: 18 }));
  const plan = cutPlan(shots, 18);
  assert.deepEqual(plan.map((c) => c.kind), [CUT.flash, CUT.flash, CUT.stutter, CUT.mouse, CUT.whoosh, CUT.flash, CUT.silent, CUT.load, CUT.whoosh]);
  assert.equal(plan[7]!.load, 16);
  // A loading starts once the sound before it is over: never under another sound's label.
  const sounds = cutSounds(plan, 18);
  const beeps = sounds.find((s) => s.sound === "computer data processing beeps")!;
  assert.ok(Math.round(beeps.at * 30) >= plan[6]!.at, JSON.stringify(beeps));
  // Past its 16 sounds: the second stutter a whoosh, then cuts in silence; its last cut always a whoosh.
  const many = cutPlan(Array.from({ length: 16 }, (_, i) => ({ from: i * 18, frames: 18 })), 18);
  assert.equal(many.at(-1)!.kind, CUT.whoosh);
  assert.equal(many[8]!.kind, CUT.whoosh);
  assert.ok(many.slice(10, -1).every((c) => c.kind === CUT.silent), JSON.stringify(many.map((c) => c.kind)));
  assert.equal(cutSounds(many, 18).length, 16);
  // A first shot too short to load over (13 frames at 140 BPM): a flash instead.
  assert.equal(cutPlan([{ from: 0, frames: 13 }, { from: 13, frames: 13 }, { from: 26, frames: 13 }], 12.857)[0]!.kind, CUT.flash);
  // A long shot before a loading takes its first pattern (55 images), a short one its second (28).
  assert.equal(loadFrames(80, 18), 66);
  assert.equal(loadFrames(36, 18), 34);
});
