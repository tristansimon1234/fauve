import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceMusicShape, pieceTestPlan } from "../pieces.ts";
import { carteFeutre, carteFeutreLands } from "./carte-feutre.ts";

// « Carte au feutre », the effect of the bank (carte-feutre.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function draw(frame: number, props: Record<string, unknown>): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", Footage: "Footage", Handwriting: "Handwriting", useCurrentFrame: () => frame, random: () => 0.5 };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${carteFeutre.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const footage = (tree: Drawn) => nodes(tree).filter((n) => n.type === "Footage");
const hands = (tree: Drawn) => nodes(tree).filter((n) => n.type === "Handwriting");
/** How many letters its hand has written at a frame (both pages). */
const written = (tree: Drawn) => hands(tree).reduce((sum, n) => sum + (n.props.upTo as number), 0);
/** The notebook's pose at a frame (its rotation and scale). */
const pose = (tree: Drawn) => String((nodes(tree).find((n) => /rotate\(/.test(String((n.props.style as { transform?: string } | undefined)?.transform ?? "")))!.props.style as { transform: string }).transform);

/** Her shots as the effect gets them (frames from its start): her shot before it, then n of a beat each. */
const under = (n: number, aspect: (i: number) => number, beat = 18) => [
  { from: -36, durationInFrames: 36, kind: "video", aspect: 16 / 9 },
  ...Array.from({ length: n }, (_, i) => ({ from: i * beat, durationInFrames: beat, kind: i === 6 ? "video" : "photo", aspect: aspect(i) })),
];
const brand = { displayFont: "DM Serif Display", bodyFont: "Inter Tight", accent: "#1d4d3a", palette: {} };
const words = { message: "ce jeudi on vous attend pour la", nom: "soirée pizza" };

test("« Carte au feutre » (effect v2): its layer, its hand's font, no reading of her shots, no sound", () => {
  const shots = [{ file: "lead", at: 1, seconds: 1.2 }, ...Array.from({ length: 10 }, (_, i) => ({ file: `f${i}`, at: 0, seconds: 0.6, photo: true })), { file: "after", at: 2, seconds: 1.8 }];
  const plan = pieceTestPlan({ piece: carteFeutre, shots, span: [1.2, 7.2], fill: { texts: words, objects: {}, settings: { format: "bandes" } }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  assert.deepEqual(motion.fonts, ["Covered By Your Grace"]);
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.deepEqual([motion.texts!.message, motion.texts!.nom, motion.texts!.format], [words.message, words.nom, "bandes"]);
});

test("« Carte au feutre » (effect v2): her pictures in stop motion, a new one every 3 images in her order, round after round", () => {
  const props = { width: 1080, height: 1920, durationInFrames: 180, brand, shots: under(10, () => 0.5625), texts: { beat: "18", ...words } };
  // Upright pictures: full frame, one at a time, her shots under it in order (never her shot before it), round after round.
  for (let f = 0; f < 180; f += 3) {
    const shown = footage(draw(f, props));
    assert.equal(shown.length, 1);
    assert.equal(shown[0]!.props.shot, 1 + (Math.floor(f / 3) % 10), `frame ${f}`);
    assert.equal(footage(draw(f + 2, props))[0]!.props.shot, shown[0]!.props.shot);
  }
  // A photo the same image each time (far ahead); a video 3 images further on its passage each round.
  const video = 7;
  const rounds = [0, 1, 2].map((r) => (r * 10 + 6) * 3);
  assert.deepEqual(rounds.map((f) => footage(draw(f, props))[0]!.props.shot), [video, video, video]);
  assert.deepEqual(rounds.map((f) => f - (footage(draw(f, props))[0]!.props.at as number)), [0, 3, 6]);
  assert.ok((footage(draw(0, props))[0]!.props.at as number) > 180 * 4);
  // Mostly in width: full frame by default (Tristan, 6 November: « tout vertical please »), as the original; two bands
  // above and under the notebook on her word (or as her pictures, « auto »), changing one after the other.
  const inWidth = { ...props, shots: under(10, (i) => (i < 7 ? 16 / 9 : 0.5625)) };
  assert.equal(footage(draw(0, inWidth)).length, 1);
  assert.equal(footage(draw(0, { ...inWidth, texts: { ...inWidth.texts, format: "bandes" } })).length, 2);
  const wide = { ...inWidth, texts: { ...inWidth.texts, format: "auto" } };
  const bands = [0, 3, 6, 9].map((f) => footage(draw(f, wide)).map((n) => n.props.shot as number));
  assert.ok(bands.every((b) => b.length === 2));
  assert.deepEqual(bands, [[1, 2], [3, 2], [3, 4], [5, 4]]);
  assert.equal((footage(draw(0, wide))[1]!.props.style as { top: number }).top, 1280);
  // Full frame on her word whatever their shape.
  assert.equal(footage(draw(0, { ...wide, texts: { ...wide.texts, format: "vertical" } })).length, 1);
});

test("« Carte au feutre » (effect v2): the notebook empty a beat, her words one at a time on a change of picture, the name last, the whole sentence held", () => {
  for (const frames of [90, 150, 180, 240]) {
    const props = { width: 1080, height: 1920, durationInFrames: frames, brand, shots: under(12, () => 0.5625), texts: { beat: "18", ...words } };
    const letters = Array.from({ length: frames }, (_, f) => written(draw(f, props)));
    const poses = Array.from({ length: frames }, (_, f) => pose(draw(f, props)));
    const steps = letters.flatMap((l, f) => (f && l !== letters[f - 1] ? [f] : []));
    // Empty first (its hook), then each word lands at once, on a change of picture; « ce jeudi », « on vous », « attend »,
    // « pour », « la » and the name: six steps.
    assert.equal(letters[0], 0, `${frames}: empty at first`);
    assert.ok(steps[0]! >= Math.min(18, frames * 0.15) - 3, `${frames}: first word at ${steps[0]}`);
    assert.equal(steps.length, 6, `${frames}: ${JSON.stringify(steps)}`);
    assert.ok(steps.every((f) => f % 3 === 0), JSON.stringify(steps));
    assert.ok(letters.slice(1).every((l, f) => l >= letters[f]!), `${frames}: never unwritten`);
    // The whole sentence, its name included (each page all its letters, its lines joined by a space), held a third of the span at least.
    const pages = hands(draw(frames - 1, props));
    assert.deepEqual(pages.map((p) => p.props.upTo), pages.map((p) => String(p.props.text).replace(/\n/g, " ").length));
    assert.equal(pages.map((p) => String(p.props.text)).join(" ").replace(/\n/g, " "), "CE JEUDI ON VOUS ATTEND POUR LA SOIRÉE PIZZA");
    assert.ok(frames - steps.at(-1)! >= frames / 3 - 3, `${frames}: held ${frames - steps.at(-1)!} images`);
    // The notebook takes a new pose with each word only, straight when the sentence is whole.
    const moves = poses.flatMap((p, f) => (f && p !== poses[f - 1] ? [f] : []));
    assert.deepEqual(moves, steps, `${frames}: its poses`);
    assert.match(poses.at(-1)!, /rotate\(-0\.4deg\)/);
    assert.match(poses[0]!, /rotate\(-7\.3deg\)/);
  }
});

test("« Carte au feutre » (effect v2): its ink, hers when dark enough to read on its paper, else the original's red", () => {
  const ink = (accent: string, encre?: string) => {
    const props = { width: 1080, height: 1920, durationInFrames: 150, brand: { ...brand, accent }, shots: under(8, () => 0.5625), texts: { beat: "18", ...words, ...(encre ? { encre } : {}) } };
    return hands(draw(149, props))[0]!.props.color;
  };
  assert.equal(ink("#1d4d3a"), "#1d4d3a");
  assert.equal(ink("#f2694e"), "#b20b21");
  assert.equal(ink("#1d4d3a", "rouge"), "#b20b21");
});

test("« Carte au feutre » (effect v2): its music stopped dead under the name, back on the Reel's beat just after it lands", () => {
  // Its timeline reckons the landings as its code draws them, whatever the words and the span.
  const sets = [words, { message: "viens fêter l'été avec nous à la", nom: "brunch" }, { message: "le 14 juin on ouvre", nom: "la terrasse du port" }];
  for (const texts of sets)
    for (const frames of [90, 150, 210]) {
      const props = { width: 1080, height: 1920, durationInFrames: frames, brand, shots: under(12, () => 0.5625), texts: { beat: "18", ...texts } };
      const letters = Array.from({ length: frames }, (_, f) => written(draw(f, props)));
      const steps = letters.flatMap((l, f) => (f && l !== letters[f - 1] ? [f] : []));
      assert.deepEqual(carteFeutreLands(frames, 18, texts).lands, steps, `${texts.nom} over ${frames}`);
    }
  // On the Reel: its blank ends on a beat (a cut of her shots, a beat each) two images after the name at least, a beat
  // after it at most, and never starts before the word before it has landed.
  const shots = [{ file: "lead", at: 1, seconds: 1.2 }, ...Array.from({ length: 10 }, (_, i) => ({ file: `f${i}`, at: 0, seconds: 0.6, photo: true })), { file: "after", at: 2, seconds: 1.8 }];
  const fill = { texts: words, objects: {}, settings: {} };
  const plan = pieceTestPlan({ piece: carteFeutre, shots, span: [1.2, 7.2], fill, bpm: 100 });
  const shape = pieceMusicShape({ piece: carteFeutre, fill, plan, layer: plan.layers![0]!, bpm: 100 });
  const { lands } = carteFeutreLands(180, 18, words);
  const name = 1.2 + lands.at(-1)! / 30;
  assert.equal(shape?.pauses?.length, 1);
  const blank = shape!.pauses![0]!;
  assert.ok(blank.to >= name + 2 / 30 - 1e-6 && blank.to <= name + 2 / 30 + 0.6 + 1e-6, `back at ${blank.to}, the name at ${name}`);
  assert.ok(Math.abs(((blank.to - 1.2) / 0.6) - Math.round((blank.to - 1.2) / 0.6)) < 1e-3, `back on a beat: ${blank.to}`);
  assert.ok(blank.from <= name && blank.from > 1.2 + lands.at(-2)! / 30, `stopped at ${blank.from}`);
  assert.ok(blank.to - blank.from >= 0.2 && blank.to - blank.from <= 0.6 + 1e-6);
  // Without the name, no blank.
  assert.equal(pieceMusicShape({ piece: carteFeutre, fill: { ...fill, texts: { message: words.message } }, plan, layer: plan.layers![0]!, bpm: 100 }), undefined);
});
