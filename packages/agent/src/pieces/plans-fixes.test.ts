import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type EditPlan } from "../schemas.ts";
import { pieceTestPlan, type PieceFill } from "../pieces.ts";
import { skillSettings } from "../skills.ts";
import { holdFrames, plansFixes, readFrames, titleFrames, titleOff, titleWords } from "./plans-fixes.ts";

// « Plans fixes de cinéma », the effect of the bank (plans-fixes.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** Its code run at one frame with a stand-in scope (the kit's pieces as named nodes, ClearBox its fallback): what it draws. */
function drawAt(code: string, frame: number, props: Record<string, unknown>): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat(Infinity) }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    useCurrentFrame: () => frame,
    ClearBox: (_shot: unknown, _frame: number, _laid: unknown, options?: { fallback?: unknown }) => options?.fallback ?? null,
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Drawn[] => (node && typeof node === "object" && "children" in node ? [node as Drawn, ...(node as Drawn).children.flatMap(nodes)] : []);
const textOf = (node: Drawn) => node.children.filter((c): c is string => typeof c === "string").join("");
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;

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
  return { width: 1080, height: 1920, durationInFrames, brand: { name: "Café des Arts", displayFont: "Lora", bodyFont: "Poppins" }, shots: shots.filter((s) => s.from < durationInFrames), texts: layer.motion.texts };
}

/** A run under it: a lead shot, the first one under it `first` s long, then `n − 1` shots a beat each at 100 BPM, then the montage. */
function run(n: number, first = 2.4) {
  return [
    { file: "lead", at: 1, seconds: 1.2 },
    ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: i ? 0.6 : first })),
    { file: "after", at: 2, seconds: 1.8 },
  ];
}
const fill = (texts: Record<string, string>, settings: Record<string, string> = {}): PieceFill => ({ texts, objects: {}, settings });

test("« Plans fixes de cinéma » (effect v1): its layer over each count of still shots, a click on each word of its title", () => {
  const words = { accroche: "un matin à", titre: "Belleville" };
  for (let n = plansFixes.shots[0]; n <= plansFixes.shots[1]; n++) {
    const span: [number, number] = [1.2, 1.2 + 2.4 + (n - 1) * 0.6];
    const plan = pieceTestPlan({ piece: plansFixes, shots: run(n), span, fill: fill(words), bpm: 100 });
    assert.ok(editPlanSchema.safeParse(plan).success, `n=${n}`);
    const motion = plan.layers![0]!.motion;
    // Nothing of her shots is cut out or followed: it only frames them.
    assert.equal(motion.drawn, undefined);
    assert.equal(motion.texts!.beat, "18");
    // A light click on each of its four words (« un », « matin », « à », « Belleville »), within its span, in order.
    const sounds = motion.sounds ?? [];
    assert.equal(sounds.length, 4, `n=${n}`);
    assert.ok(sounds.every((s) => s.sound === "light click" && s.skill && s.at >= 0 && s.at < span[1] - span[0]));
    assert.deepEqual(sounds.map((s) => Math.round(s.at * 30)), titleFrames(3, 1, Math.round((span[1] - span[0]) * 30), 18));
  }
  // The original's pace on the Reel's beats: half a beat in, then beats 0 · 0,4 · 1 · 1,6 · 2,5 (at 100 BPM, 18 frames a beat).
  assert.deepEqual(titleFrames(3, 2, 200, 18), [9, 9 + Math.round(18 * Math.pow(0.5, 1.2)), 27, Math.round(9 + 1.6 * 18), 54]);
  // A separator stays with the word before it: no click of its own.
  assert.deepEqual(titleWords("le Marais · Paris"), ["le", "Marais ·", "Paris"]);
});

test("« Plans fixes de cinéma » (effect v1): each word shown on the frame its click lands, the title gone with the first cut once read", () => {
  const plan = pieceTestPlan({ piece: plansFixes, shots: run(7, 1.2), span: [1.2, 1.2 + 1.2 + 6 * 0.6], fill: fill({ accroche: "le pouvoir du", titre: "plan fixe" }), bpm: 100 });
  const props = layerProps(plan);
  const clicks = (plan.layers![0]!.motion.sounds ?? []).map((s) => Math.round(s.at * 30));
  const shown = new Map<string, number>();
  let last = -1;
  for (let f = 0; f < props.durationInFrames; f++) {
    const spans = nodes(drawAt(plansFixes.code, f, props)).filter((n) => n.type === "span" && styleOf(n).opacity === 1);
    for (const s of spans) if (!shown.has(textOf(s))) shown.set(textOf(s), f);
    if (spans.length) last = f;
  }
  assert.deepEqual(["le", "pouvoir", "du", "plan", "fixe"].map((w) => shown.get(w)), clicks);
  // Its first shot is short (two beats): the title stays over the next shot until it has been whole a beat and read,
  // then goes with the first cut after that (her shots cut a beat apart: 36, 54, 72 … frames from its start).
  const off = titleOff(clicks, 18, [36, 54, 72, 90, 108, 126], props.durationInFrames);
  assert.equal(off, 72);
  assert.ok(off >= clicks.at(-1)! + holdFrames(18) && off >= 9 + readFrames(5));
  assert.equal(last + 1, off);
  // On a first shot of four beats, it goes with its first cut, as the original's.
  assert.equal(titleOff(titleFrames(3, 2, 144, 18), 18, [72, 90, 108], 144), 72);
  // With no cut late enough in its span, it stays to its last frame.
  const short = pieceTestPlan({ piece: plansFixes, shots: run(3, 1.2), span: [1.2, 1.2 + 1.2 + 2 * 0.6], fill: fill({ accroche: "le pouvoir du", titre: "plan fixe" }), bpm: 100 });
  const shortProps = layerProps(short);
  const end = shortProps.durationInFrames - 1;
  assert.ok(nodes(drawAt(plansFixes.code, end, shortProps)).some((n) => n.type === "span" && styleOf(n).opacity === 1 && textOf(n) === "fixe"));
  // Its small words are a label beside its title, its serif title at 91 px (v2: EB Garamond, its capitals the original's 60 px).
  const tree = drawAt(plansFixes.code, 50, props);
  const boxes = nodes(tree).filter((n) => n.type === "FitText");
  assert.equal(boxes.length, 2);
  assert.ok(nodes(boxes[0]!).some((n) => "data-fauve-accent" in n.props));
  assert.equal((boxes[1]!.props.innerStyle as { fontSize: number }).fontSize, 91);
  for (const b of boxes) {
    const s = styleOf(b) as { left: number; width: number };
    assert.ok(s.left >= 140 && s.left + s.width <= 940, JSON.stringify(s));
  }
});

test("« Plans fixes de cinéma » (effect v1): her shots in a 4:3 picture on black as in a film, full frame on her word, never moved", () => {
  const plan = pieceTestPlan({ piece: plansFixes, shots: run(3), span: [1.2, 4.8], fill: fill({ accroche: "un soir à", titre: "Belleville" }), bpm: 100 });
  const props = layerProps(plan);
  const frameOf = (tree: Drawn) => {
    const box = nodes(tree).find((n) => n.type === "div" && styleOf(n).overflow === "hidden")!;
    const footage = nodes(box).find((n) => n.type === "Footage")!;
    return { top: styleOf(box).top, height: styleOf(box).height, shot: footage.props.shot, style: styleOf(footage) };
  };
  // The first shot under it is her second one (the lead shot plays before it); the 4:3 picture at the middle of the frame.
  assert.deepEqual(frameOf(drawAt(plansFixes.code, 10, props)), { top: 555, height: 810, shot: 1, style: { position: "absolute", left: 0, top: 0, width: 1080, height: 810 } });
  // Each of her shots in its turn, at its cut (two beats in: her third).
  assert.equal(frameOf(drawAt(plansFixes.code, 72, props)).shot, 2);
  // On her word, full frame; the default is never kept as a setting.
  const vertical = pieceTestPlan({ piece: plansFixes, shots: run(3), span: [1.2, 4.8], fill: fill({ accroche: "un soir à", titre: "Belleville" }, { format: "vertical" }), bpm: 100 });
  assert.deepEqual(frameOf(drawAt(plansFixes.code, 10, layerProps(vertical))).height, 1920);
  // As her videos by default: upright ones full frame, the band on her word.
  assert.equal(frameOf(drawAt(plansFixes.code, 10, layerProps(plan, 9 / 16))).height, 1920);
  const banded = pieceTestPlan({ piece: plansFixes, shots: run(3), span: [1.2, 4.8], fill: fill({ accroche: "un soir à", titre: "Belleville" }, { format: "horizontal" }), bpm: 100 });
  assert.equal(frameOf(drawAt(plansFixes.code, 10, layerProps(banded, 9 / 16))).height, 810);
  assert.deepEqual(skillSettings(plansFixes, [{ name: "format", value: "auto" }]), {});
  assert.deepEqual(skillSettings(plansFixes, [{ name: "format", value: "horizontal" }]), { format: "horizontal" });
  assert.deepEqual(skillSettings(plansFixes, [{ name: "format", value: "vertical" }]), { format: "vertical" });
  // A still shot is the effect: nothing zooms, turns or slides.
  assert.doesNotMatch(plansFixes.code, /transform|scale\(|interpolate\(/);
});

test("« Plans fixes de cinéma » (effect v1): a span too short for its words lays them faster, so the title is still read", () => {
  // At 60 BPM over 3 s (its words want half a beat, 2,5 beats, then a beat whole): squeezed, all landed a beat before its end.
  const frames = 90;
  const lands = titleFrames(3, 2, frames, 30);
  assert.ok(lands.at(-1)! < 15 + 75, JSON.stringify(lands));
  assert.ok(lands.at(-1)! + holdFrames(30) <= frames + 1, JSON.stringify(lands));
  assert.ok(lands.every((f, i) => i === 0 || f > lands[i - 1]!), JSON.stringify(lands));
  // Never under a third of their pace: on a span far too short, they run past its hold rather than all at once.
  const tight = titleFrames(3, 2, 30, 30);
  assert.ok(tight.at(-1)! - tight[0]! >= Math.round(2.5 * 30 * 0.3) - 1, JSON.stringify(tight));
});
