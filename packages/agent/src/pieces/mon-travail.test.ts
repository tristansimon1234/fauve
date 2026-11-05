import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan } from "../pieces.ts";
import { monTravail, travailLine } from "./mon-travail.ts";

// « Voici mon travail », the effect of the bank (mon-travail.ts): its own checks, beside the bank's (features.test.ts).

/** Her shot then her works, a beat each at 100 BPM, between a lead shot and the shot after. */
function run(works: number) {
  return [
    { file: "lead", at: 1, seconds: 1.2 },
    { file: "her", at: 0, seconds: 0.6, photo: true },
    ...Array.from({ length: works }, (_, i) => ({ file: `w${i}`, at: 0, seconds: 0.6, photo: true })),
    { file: "after", at: 2, seconds: 1.8 },
  ];
}

test("« Voici mon travail » (effect v1): her cut out on its first shot, her works landing then leaving in order, empty on a beat", () => {
  const works = 8;
  const span: [number, number] = [1.2, 1.2 + (works + 1) * 0.6];
  const plan = pieceTestPlan({ piece: monTravail, shots: run(works), span, fill: { texts: { mots: "voici mon atelier" }, objects: {}, settings: { format: "forme" } }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // Her cut out on the first shot under it (the second of her shots), and only there: her works stay as they are.
  assert.deepEqual(motion.drawn, { shots: works + 3, subjects: [1] });
  assert.equal(motion.texts!.mots, "voici mon atelier");
  assert.equal(motion.texts!.format, "forme");
  // Its marks: its count, each work's landing and leaving, the hit on a whole beat (18 frames at 100 BPM).
  const mark = (k: string) => Number(motion.texts![k]);
  assert.equal(mark("works"), works);
  const lands = Array.from({ length: works }, (_, k) => mark(`l${k}`));
  const leaves = Array.from({ length: works }, (_, k) => mark(`o${k}`));
  const hit = mark("hit");
  assert.equal(hit % 18, 0);
  // A burst that slows down: each landing after the one before, the last gaps the longest.
  for (let k = 1; k < works; k++) assert.ok(lands[k]! > lands[k - 1]!, `landing ${k}`);
  assert.ok(lands[works - 1]! - lands[works - 2]! > lands[1]! - lands[0]!);
  // They leave in order, the second-last on the hit, the last a third of a beat after; then she is alone with her words.
  for (let k = 0; k < works; k++) assert.ok(leaves[k]! > lands[k]!, `work ${k} stays`);
  for (let k = 1; k < works; k++) assert.ok(leaves[k]! >= leaves[k - 1]!, `work ${k} leaves after the one before`);
  assert.equal(leaves[works - 2], hit);
  assert.equal(leaves[works - 1], hit + 6);
  const frames = Math.round((span[1] - span[0]) * 30);
  assert.ok(frames - leaves[works - 1]! >= 1.5 * 18, "her alone with her words a beat and a half at least");
  // The last one passes in front of her legs.
  assert.equal(mark("front"), 7);
  // Its sounds within its span: a click on the landings that stand apart, softer in the burst, then the dry knock on the hit.
  const sounds = motion.sounds!;
  assert.ok(sounds.length >= 3 && sounds.length <= 16);
  assert.deepEqual(sounds.at(-1), { at: Math.round((hit / 30) * 1000) / 1000, sound: "dry knock", seconds: 0.5, gain: 6, skill: true });
  for (const s of sounds) assert.ok(s.at >= 0 && s.at < frames / 30, `${s.sound} at ${s.at} s`);
  const clicks = sounds.filter((s) => s.sound === "light click");
  for (const c of clicks) assert.ok((c.gain ?? 0) >= -12 && (c.gain ?? 0) <= 0);
  assert.ok((clicks.at(-1)!.gain ?? 0) > (clicks[0]!.gain ?? 0), "louder as the landings slow down");
});

/** Its Scene drawn at a frame as a plain tree (no renderer): the kit's pieces as named nodes, its readings stubbed. */
type Node = { type: unknown; props: Record<string, unknown>; children: unknown[] };
function drawAt(frame: number, props: Record<string, unknown>, readings: Record<string, unknown> = {}): Node {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Node => ({ type, props: p ?? {}, children }) };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    SubjectBox: () => null,
    SubjectOutline: () => null,
    LightUnder: () => null,
    ...readings,
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${monTravail.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Node;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Node[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  return [node as Node, ...(node as Node).children.flatMap(nodes)];
};
/** The works drawn in a tree: each one's box and the shot it shows. */
const worksIn = (tree: Node) =>
  nodes(tree)
    .filter((n) => n.type === "div" && String(n.props.key ?? "").startsWith("w"))
    .map((n) => {
      const s = n.props.style as Record<string, number>;
      const shot = (n.children[0] as Node).props.shot as number;
      return { shot, x: s.left!, y: s.top!, w: s.width!, h: s.height! };
    });

test("« Voici mon travail »: what it draws, frame by frame — her and her cut-out held, her works in and out, her words in front; off her when nobody is cut out", () => {
  const works = 8;
  const span: [number, number] = [1.2, 1.2 + (works + 1) * 0.6];
  const plan = pieceTestPlan({ piece: monTravail, shots: run(works), span, fill: { texts: { mots: "voici mon atelier" }, objects: {}, settings: {} }, bpm: 100 });
  const texts = plan.layers![0]!.motion.texts!;
  const F = Math.round((span[1] - span[0]) * 30);
  // The shots as its layer gets them: the lead before it (from −36), her, her works, a beat each.
  const shots = [{ from: -36, durationInFrames: 36, kind: "video", aspect: 0.5625 }, ...Array.from({ length: works + 1 }, (_, i) => ({ from: i * 18, durationInFrames: 18, kind: "photo", aspect: 1 }))];
  const props = { width: 1080, height: 1920, durationInFrames: F, brand: { displayFont: "Inter Tight", bodyFont: "Inter", accent: "#c2263a", palette: {} }, shots, texts, track: () => ({ faces: [] }) };
  // Its first image: her, and her cut-out, held on her first image until her passage plays at its end; her words; no work yet.
  const first = drawAt(0, props);
  const her = nodes(first).find((n) => n.type === "Footage" && n.props.key === "her")!;
  assert.deepEqual([her.props.shot, her.props.at], [1, F - 18]);
  assert.equal(nodes(first).find((n) => n.type === "Subject")!.props.at, F - 18);
  assert.deepEqual(nodes(nodes(first).find((n) => n.type === "FitText")).flatMap((n) => n.children.filter((c) => typeof c === "string")), ["VOICI", "MON", "ATELIER"]);
  assert.equal(worksIn(first).length, 0);
  // Its burst: at its fourth landing, its first four works on their own shots, the lead never one of them.
  assert.deepEqual(worksIn(drawAt(Number(texts.l3), props)).map((w) => w.shot), [2, 3, 4, 5]);
  // Its last image: all gone, her alone with her words.
  assert.equal(worksIn(drawAt(F - 1, props)).length, 0);
  // Her cut-out read: a wide figure (her outline from x 200 to 880 under her head) hides a work behind her: it moves aside.
  const box = () => ({ x: 200, y: 380, w: 680, h: 1540 });
  const cut = { SubjectBox: box, SubjectOutline: () => "M 460 380 C 620 380 880 600 880 900 C 880 1400 880 1920 880 1920 C 200 1920 200 1920 200 1920 C 200 1400 200 900 200 900 C 200 600 300 380 460 380 Z" };
  const full = worksIn(drawAt(Number(texts.l7), props, cut));
  const plain = worksIn(drawAt(Number(texts.l7), props, { SubjectBox: box }));
  assert.equal(full.length, works);
  const inHer = (w: { x: number; w: number }) => Math.max(0, Math.min(w.x + w.w, 880) - Math.max(w.x, 200)) / w.w;
  const moved = full.filter((w, i) => w.x !== plain[i]!.x);
  assert.ok(moved.length >= 1, "a work moved aside");
  for (const w of moved) assert.ok(inHer(w) < inHer(plain[full.indexOf(w)]!), `work on shot ${w.shot} less hidden`);
  const bare = drawAt(Number(texts.l7), props);
  // Nobody cut out nor tracked: her works keep off the middle of the frame (a third at most over it).
  const middle = { x: 324, y: 230, w: 432, h: 1690 };
  const over = (a: { x: number; y: number; w: number; h: number }) => Math.max(0, Math.min(a.x + a.w, middle.x + middle.w) - Math.max(a.x, middle.x)) * Math.max(0, Math.min(a.y + a.h, middle.y + middle.h) - Math.max(a.y, middle.y));
  for (const w of worksIn(bare)) assert.ok(over(w) <= 0.45 * w.w * w.h, `work on shot ${w.shot} over her`);
});

test("« Voici mon travail »: the burst follows the span (its last work about halfway to the hit), at most 15 clicks, every count it takes", () => {
  // A long run: fifteen works over sixteen beats at 100 BPM.
  const long = travailLine(16 * 18, 100, 15);
  assert.equal(long.hit, 14 * 18);
  assert.ok(long.lands[14]! < long.hit * 0.5, `last landing ${long.lands[14]} before half of ${long.hit}`);
  // Never slower than the original's burst stretched by 1.3: its first gaps about four frames (7 works a second).
  assert.ok(long.lands[1]! - long.lands[0]! <= 5);
  // A short run: five works over six beats at 140 BPM, the knock still on a beat, the last one gone before the end.
  const B = (60 / 140) * 30;
  const short = travailLine(Math.round(6 * B), 140, 5);
  assert.ok(Math.abs(short.hit / B - Math.round(short.hit / B)) < 0.06);
  assert.ok(short.leaves[4]! < Math.round(6 * B));
  for (let works = 5; works <= 15; works++) {
    const plan = pieceTestPlan({ piece: monTravail, shots: run(works), span: [1.2, 1.2 + (works + 1) * 0.6], fill: { texts: { mots: "voici mon travail" }, objects: {}, settings: {} }, bpm: 100 });
    const motion = plan.layers![0]!.motion;
    assert.ok(motion.sounds!.filter((s) => s.sound === "light click").length <= 15, `${works} works`);
    assert.deepEqual(motion.drawn?.subjects, [1]);
  }
  // Its code reads her light, her cut-out and her face; it never zooms its works (they land and leave at once).
  assert.match(monTravail.code, /LightUnder\(/);
  assert.match(monTravail.code, /h\(Subject, \{ key: "cut"/);
  assert.doesNotMatch(monTravail.code, /interpolate\(|spring\(/);
});
