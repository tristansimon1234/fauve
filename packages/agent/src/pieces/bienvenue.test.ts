import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceMusicShape, pieceTestPlan } from "../pieces.ts";
import { readsDrawn } from "../subject.ts";
import { bienvenue, bienvenueLands } from "./bienvenue.ts";

// « L'accueil, puis la rafale », the effect of the bank (bienvenue.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function draw(frame: number, props: Record<string, unknown>, light: () => { mean: number; high: number } | null = () => null): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", Handwriting: "Handwriting", LightUnder: light, useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${bienvenue.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const written = (tree: Drawn) => nodes(tree).filter((n) => n.type === "Handwriting").map((n) => String(n.props.text));
const veil = (tree: Drawn) => (nodes(tree).find((n) => n.props.key === "veil")!.props.style as { opacity: number }).opacity;

/** Her shots as the effect gets them (frames from its start): her shot before it, then n of a beat each. */
const under = (n: number, beat = 18) => [{ from: -36, durationInFrames: 36, kind: "video", aspect: 9 / 16 }, ...Array.from({ length: n }, (_, i) => ({ from: i * beat, durationInFrames: beat, kind: "video", aspect: 9 / 16 }))];
const brand = { displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#1d4d3a", palette: {} };
const words = { accueil: "Bienvenue dans notre salon" };
const props = (n: number, texts: Record<string, string> = {}, extra: Record<string, unknown> = {}) => {
  const lands = bienvenueLands(n * 18, 18, under(n).slice(1), { ...words, ...texts });
  const marks = Object.fromEntries(lands.map((f, g) => [`land${g}`, String(f)]));
  return { width: 1080, height: 1920, durationInFrames: n * 18, brand, shots: under(n), texts: { beat: "18", mine: Array.from({ length: n }, (_, i) => i + 1).join(","), ...marks, ...words, ...texts }, ...extra };
};

test("« L'accueil, puis la rafale » (effect v1): its layer, its hand's font, its snaps, the light of the shots under it read", () => {
  const shots = [{ file: "lead", at: 1, seconds: 1.2 }, ...Array.from({ length: 4 }, (_, i) => ({ file: `f${i}`, at: 0, seconds: 0.6 })), { file: "after", at: 2, seconds: 1.8 }];
  const plan = pieceTestPlan({ piece: bienvenue, shots, span: [1.2, 3.6], fill: { texts: words, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  assert.deepEqual(motion.fonts, ["Mynerve"]);
  assert.equal(motion.drawn, undefined);
  // A snap as each of its four lines lands: a sixteenth in, then on each cut (a beat each at 100 BPM).
  assert.deepEqual(motion.sounds?.map((s) => [Math.round(s.at * 30), s.sound]), [5, 18, 36, 54].map((f) => [f, "single finger snap"]));
  assert.deepEqual([motion.texts!.land0, motion.texts!.land3, motion.texts!.accueil], ["5", "54", words.accueil]);
  // The light under her words read on the shots under it (named by a variable: those under it only).
  assert.deepEqual(readsDrawn(bienvenue.code), [{ shot: -1, kinds: ["light"] }]);
});

test("« L'accueil, puis la rafale » (effect v1): her sentence a line on each shot of hers, stacked in the middle, its last on its last shot", () => {
  // Four shots: a line a sixteenth in, then on each cut; nothing before.
  const four = props(4);
  assert.deepEqual(written(draw(4, four)), []);
  assert.deepEqual(written(draw(5, four)), ["BIENVENUE"]);
  assert.deepEqual(written(draw(18, four)), ["BIENVENUE", "DANS"]);
  assert.deepEqual(written(draw(36, four)), ["BIENVENUE", "DANS", "NOTRE"]);
  assert.deepEqual(written(draw(71, four)), ["BIENVENUE", "DANS", "NOTRE", "SALON"]);
  // Stacked in the middle (a line every 185 px), each box inside the safe zone; Mynerve 112 px, no grain.
  const hands = nodes(draw(71, four)).filter((n) => n.type === "Handwriting");
  assert.deepEqual(hands.map((n) => { const b = n.props.box as { y: number; h: number }; return Math.round(b.y + b.h / 2); }), [683, 868, 1053, 1238]);
  for (const n of hands) {
    const b = n.props.box as { x: number; y: number; w: number; h: number };
    assert.ok(b.x >= 140 && b.x + b.w <= 940 && b.y >= 80 && b.y + b.h <= 1440);
    assert.deepEqual([(n.props.style as { fontSize: number }).fontSize, n.props.grain, n.props.color], [112, 0, "#f4ff00"]);
  }
  // Fewer shots than words: as many lines as shots (two short words on one), the last on its last shot.
  assert.deepEqual(written(draw(53, props(3))), ["BIENVENUE", "DANS NOTRE", "SALON"]);
  assert.deepEqual(bienvenueLands(54, 18, under(3).slice(1), words), [5, 18, 36]);
  // Five shots, three words: its last line on its last shot.
  const five = props(5, { accueil: "Entrez, c'est ouvert" });
  assert.deepEqual(bienvenueLands(90, 18, under(5).slice(1), { accueil: "Entrez, c'est ouvert" }), [5, 18, 72]);
  assert.deepEqual([written(draw(40, five)), written(draw(72, five))], [["ENTREZ,", "C'EST"], ["ENTREZ,", "C'EST", "OUVERT"]]);
  // Its ink: hers when light enough to read on a dark picture, else the original's yellow; white on her word.
  const ink = (accent: string, encre?: string) => nodes(draw(60, props(4, encre ? { encre } : {}, { brand: { ...brand, accent } }))).find((n) => n.type === "Handwriting")!.props.color;
  assert.deepEqual([ink("#1d4d3a"), ink("#ffd6e0"), ink("#ffd6e0", "jaune"), ink("#1d4d3a", "blanc")], ["#f4ff00", "#ffd6e0", "#f4ff00", "#ffffff"]);
});

test("« L'accueil, puis la rafale » (effect v1): her shots darker under it, dosed on their light; the music stopped until its end", () => {
  // A middle dose without a reading; a bright shot much darker, a dark one hardly, never under 0,4.
  assert.equal(veil(draw(10, props(4))), 0.28);
  assert.equal(veil(draw(10, props(4), () => ({ mean: 0.6, high: 0.9 }))), 0.5);
  assert.equal(veil(draw(10, props(4), () => ({ mean: 0.75, high: 1 }))), 0.6);
  assert.equal(veil(draw(10, props(4), () => ({ mean: 0.2, high: 0.5 }))), 0.08);
  // On the Reel: the music stopped from its start, back on the beat at its end (the cut after it), within its span.
  const shots = [{ file: "lead", at: 1, seconds: 1.2 }, ...Array.from({ length: 4 }, (_, i) => ({ file: `f${i}`, at: 0, seconds: 0.6 })), { file: "after", at: 2, seconds: 1.8 }];
  const fill = { texts: words, objects: {}, settings: {} };
  const plan = pieceTestPlan({ piece: bienvenue, shots, span: [1.2, 3.6], fill, bpm: 100 });
  const shape = pieceMusicShape({ piece: bienvenue, fill, plan, layer: plan.layers![0]!, bpm: 100 });
  assert.deepEqual(shape?.pauses, [{ from: 1.2, to: 3.6 }]);
  // Too short to come back on a beat after its last line: no silence. A first shot shorter than its lead: each line after the one before.
  assert.equal(bienvenue.timeline!({ frames: 17, bpm: 100, shots: [{ from: 0, frames: 8 }, { from: 8, frames: 9 }], words, settings: {} }).music, undefined);
  assert.deepEqual(bienvenueLands(54, 18, [{ from: 0 }, { from: 3 }, { from: 30 }], words), [5, 6, 30]);
});
