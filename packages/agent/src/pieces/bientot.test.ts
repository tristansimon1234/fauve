import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { planCues } from "../sfx.ts";
import { bientot, bientotFlashes, bientotWord } from "./bientot.ts";

// « Teaser qui se charge », the effect of the bank (bientot.ts): its own checks, beside the bank's (features.test.ts).

/** A run of four of her shots of gestures under it (4 s), between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "a", at: 0.5, seconds: 1 },
  { file: "b", at: 2, seconds: 1 },
  { file: "c", at: 1, seconds: 1 },
  { file: "d", at: 3, seconds: 1 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Teaser qui se charge » (effect v1): its layer over her run of shots, its flashes on the beat, her word on a beat, a deep hit there", () => {
  const plan = pieceTestPlan({ piece: bientot, shots, span: [1.2, 5.2], fill: { texts: { bientot: "Nouvelle collection" }, objects: {}, settings: {} }, bpm: 79 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3, 4]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "bientot", version: 1 });
  // At 79 BPM its flashes are the original's eighths of a beat (2,85 images), a ninth after her word.
  assert.deepEqual(bientotFlashes(79), { flash: 2.848, fast: 2.532 });
  // At 100 BPM a sixth (3 images), at 140 a fifth (2,57): always a whole subdivision of the beat, about a tenth of a second.
  assert.equal(bientotFlashes(100).flash, 3);
  assert.ok(Math.abs(bientotFlashes(140).flash - 2.571) < 0.001);
  // Her word on the beat nearest 55 % of it (here beat 3, 68 images), the counter gone two images before.
  assert.equal(bientotWord(120, 79), 68);
  assert.deepEqual(
    Object.fromEntries(["flash", "fast", "word", "off", "mine", "bientot"].map((k) => [k, motion.texts![k]])),
    { flash: "2.848", fast: "2.532", word: "68", off: "66", mine: "1,2,3,4", bientot: "Nouvelle collection" },
  );
  // Nothing cut out nor followed; one deep hit as her word lands (1,2 s + 68 images on the Reel's clock).
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds?.length, 1);
  assert.deepEqual(planCues(plan, [{ start: 0, length: 1.2 }, { start: 1.2, length: 1 }, { start: 2.2, length: 1 }, { start: 3.2, length: 1 }, { start: 4.2, length: 1 }, { start: 5.2, length: 1.8 }]).map((c) => c.at), [Math.round((1.2 + 68 / 30) * 1000) / 1000]);
  // A short one: her word 40 images before its end at the latest, so it reads.
  assert.ok(bientotWord(75, 100) <= 35);
});

test("« Teaser qui se charge »: its word required, cut to its place; offered on close shots of gestures, never on wide ones alone", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "bientot", text: "Nouvelle collection d'automne en atelier" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(bientot, answer)!.texts, { bientot: "Nouvelle collection" });
  assert.equal(readPieceFill(bientot, { ...answer, texts: [] }), null);
  assert.deepEqual(readPieceFill(bientot, { ...answer, settings: [{ name: "compteur", value: "100" }] })!.settings, { compteur: "100" });
  const clip = (framing: string) =>
    ({
      duration: 8,
      orientation: "portrait",
      summary: "des mains qui façonnent un bol en argile",
      setting: "intérieur, un atelier de céramique",
      lighting: "good",
      shots: [{ start: 0, end: 8, description: "des mains sur le tour", subject: "mains", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera: "handheld", subject_box: [300, 300, 700, 700], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  const close = pieceShots([{ media_id: "a", analysis: clip("close") }, { media_id: "b", analysis: clip("detail") }], {});
  assert.deepEqual(piecesOffered([bientot], close, 2).map((p) => p.key), ["bientot"]);
  // A single file is not a run of flashes; wide shots alone are not its gestures.
  assert.deepEqual(piecesOffered([bientot], close, 1), []);
  assert.deepEqual(piecesOffered([bientot], pieceShots([{ media_id: "a", analysis: clip("wide") }], {}), 3), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

const FRAMES = 120;
const MARKS = { beat: "22.785", flash: "2.848", fast: "2.532", word: "68", off: "66", mine: "1,2,3,4", bientot: "Nouvelle collection" };

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; brand?: Record<string, unknown> } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${bientot.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: FRAMES,
    brand: { name: "Terre de Lou", displayFont: "Playfair Display", bodyFont: "Jost", ...props.brand },
    // The lead shot before it, its four (30 images each), the after shot.
    shots: [{ from: -36, durationInFrames: 36 }, ...[0, 1, 2, 3].map((i) => ({ from: i * 30, durationInFrames: 30, kind: "video", aspect: 0.5625 })), { from: 120, durationInFrames: 54 }],
    texts: { ...MARKS, ...props.texts },
  });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const footage = (tree: Drawn) => flatten(tree).find((n) => n.type === "Footage")!;
const counterAt = (tree: Drawn) => {
  const c = flatten(tree).find((n) => n.props.key === "count");
  return c ? String(c.children.join("")).replace(/\s/g, "") : null;
};

test("« Teaser qui se charge »: her shots in turn, a flash each, each coming back at a later moment of its own passage, in black and white", () => {
  // A flash every 2 or 3 images, her shots in turn (1, 2, 3, 4, then 1 again).
  const seen = [0, 3, 6, 9, 11, 14].map((f) => footage(drawAt(f)).props.shot);
  assert.deepEqual(seen, [1, 2, 3, 4, 1, 2]);
  // Its first image: her first shot from its first moment; on its next coming back, a later moment of it.
  const first = footage(drawAt(0));
  assert.equal(Number(first.props.at), 0);
  const again = footage(drawAt(12));
  const local = (f: number, node: Drawn) => f - Number(node.props.at);
  assert.ok(local(12, again) > local(0, first) + 2, `${local(12, again)}`);
  // Its last flash of a shot shows the end of its passage, never past it.
  const lastOfOne = [110, 112, 114, 116, 118].map((f) => [f, footage(drawAt(f))] as const).map(([f, node]) => local(f, node));
  assert.ok(lastOfOne.every((l) => l >= 0 && l < 30), lastOfOne.join(" "));
  // Full frame, in its black and white; her colours when her words ask.
  const style = first.props.style as Record<string, string | number>;
  assert.deepEqual([style.left, style.top, style.width, style.height], [0, 0, 1080, 1920]);
  assert.match(String(style.filter), /grayscale\(1\)/);
  assert.equal((footage(drawAt(0, { texts: { couleur: "couleur" } })).props.style as Record<string, unknown>).filter, undefined);
  // After her word, a little faster: more flashes in the same time.
  const changes = (from: number, to: number) => {
    let count = 0;
    for (let f = from + 1; f < to; f++) if (footage(drawAt(f)).props.key !== footage(drawAt(f - 1)).props.key) count++;
    return count;
  };
  assert.ok(changes(68, 108) > changes(20, 60), `${changes(68, 108)} after, ${changes(20, 60)} before`);
});

test("« Teaser qui se charge »: its counter at the centre from 1 to 88 % (or 100), gone two images before her word, which takes its place", () => {
  assert.equal(counterAt(drawAt(0)), "1%");
  assert.equal(counterAt(drawAt(65)), "88%");
  assert.equal(counterAt(drawAt(65, { texts: { compteur: "100" } })), "100%");
  assert.equal(counterAt(drawAt(66)), null);
  // Climbing all along (never down), 30 values.
  const values = Array.from({ length: 66 }, (_, f) => Number(counterAt(drawAt(f))!.replace("%", "")));
  assert.ok(values.every((v, i) => i === 0 || v >= values[i - 1]!));
  assert.equal(new Set(values).size, 30);
  const c = flatten(drawAt(30)).find((n) => n.props.key === "count")!;
  const s = c.props.style as Record<string, string | number>;
  assert.deepEqual([Number(s.top) + Number(s.height) / 2, s.left, s.width, s.fontSize, s.fontVariantNumeric], [960, 140, 800, 87, "lining-nums"]);
  // Her word from its beat to the end, at the same place, inside x 140 – 940 and above the bottom quarter.
  const word = (f: number) => flatten(drawAt(f)).find((n) => n.type === "FitText") ?? null;
  assert.equal(word(67), null);
  const w = word(68)!;
  assert.equal(String(w.children.join("")), "Nouvelle collection");
  const b = w.props.style as { left: number; top: number; width: number; height: number };
  assert.ok(b.left >= 140 && b.left + b.width <= 940 && b.top >= 80 && b.top + b.height <= 1440 && b.top + b.height / 2 === 960, JSON.stringify(b));
  assert.ok(word(FRAMES - 1));
  // Nothing of the original's own.
  assert.doesNotMatch(bientot.code, /MAISON|Coming soon|LIFE/);
});
