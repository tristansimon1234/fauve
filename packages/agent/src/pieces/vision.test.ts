import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan } from "../pieces.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { vision, visionTimeline, VISION_STROBE_A, VISION_STROBE_B } from "./vision.ts";

// « Vision machine », the effect of the bank (vision.ts): its own checks, beside the bank's (features.test.ts).

type Box = { x: number; y: number; w: number; h: number };
type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** Its Scene at one frame with a stand-in scope (each tool a named node), the boxes of everyone as given. */
function drawAt(frame: number, texts: Record<string, string>, people: Box[] = [], frames = 126): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() }), Fragment: "Fragment", useId: () => ":r0:" };
  // Remotion's random: deterministic by its seed.
  const random = (seed: string) => {
    let x = 0;
    for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) % 1000003;
    return (x % 1000) / 1000;
  };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Ascii: "Ascii", useCurrentFrame: () => frame, random, SubjectParts: () => people };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${vision.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const shots = [
    { from: -36, durationInFrames: 36, kind: "video", aspect: 16 / 9 },
    { from: 0, durationInFrames: frames, kind: "video", aspect: 16 / 9 },
    { from: frames, durationInFrames: 36, kind: "video", aspect: 16 / 9 },
  ];
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames: frames, brand: { name: "Brocante Lune", accent: "#b5293f" }, shots, texts: { beat: "18", ...texts } });
}
const nodes = (n: unknown): Drawn[] => (n && typeof n === "object" && "children" in n ? [n as Drawn, ...(n as Drawn).children.flatMap(nodes)] : []);
const styleOf = (n: Drawn) => (n.props.style ?? {}) as Record<string, string | number>;
const textOf = (n: Drawn): string => (n.children.flat(Infinity) as unknown[]).map((c) => (typeof c === "string" ? c : c && typeof c === "object" && "children" in c ? textOf(c as Drawn) : "")).join("");

test("« Vision machine » (effect v1): its layer on her still shot with people, everyone followed there, its labels' word and its marks", () => {
  const shots = [
    { file: "lead", at: 1, seconds: 1.2 },
    { file: "place", at: 2, seconds: 4.2 },
    { file: "after", at: 6, seconds: 1.2 },
  ];
  const plan = pieceTestPlan({ piece: vision, shots, span: [1.2, 5.4], fill: { texts: { etiquette: "BROCANTE" }, objects: { gens: "every person" }, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(checkMotionCode(vision.code), []);
  const motion = plan.layers![0]!.motion;
  // Everyone followed on the shot under it (the second of her shots); nobody cut out on her own.
  assert.deepEqual(motion.drawn, { shots: 3, objects: [{ shot: 1, name: "every person" }] });
  assert.ok(motion.code!.includes('SubjectParts(place, RF, laid, "every person")') && !motion.code!.includes('"@gens"'));
  assert.deepEqual(motion.fonts, ["VT323"]);
  assert.equal(motion.texts!.etiquette, "BROCANTE");
  assert.equal(motion.texts!.titre, undefined);
  // Its marks at 100 BPM over 7 beats: its opening half a beat, its graph on its third beat for a beat, its people
  // 8 images later, its closing in characters on its last half beat.
  assert.deepEqual(["open", "graph", "people", "after", "close"].map((k) => Number(motion.texts![k])), [9, 54, 60, 72, 117]);
  assert.equal(motion.sounds, undefined);
  // Its depth is never asked (a layer's shot is a variable there, never read).
  assert.doesNotMatch(vision.code, /\b(Depth|Near)\b/);
});

test("« Vision machine » (effect v1): its marks fit any span, in order; its strobes are the original's passes, one to ten images each", () => {
  for (const [frames, bpm] of [[48, 100], [60, 140], [90, 100], [150, 100], [150, 60], [120, 77.5]] as const) {
    const m = visionTimeline({ frames, bpm, shots: [{ from: 0, frames }], words: {}, settings: {} }).marks!;
    const order = ["open", "graph", "people", "after", "close"].map((k) => m[k]!);
    order.slice(1).forEach((f, i) => assert.ok(f >= order[i]!, `${frames} images at ${bpm} BPM: ${JSON.stringify(m)}`));
    assert.ok(m.open! >= 4 && m.graph! > m.open! && m.close! < frames, `${frames} images at ${bpm} BPM: ${JSON.stringify(m)}`);
  }
  for (const strobe of [VISION_STROBE_A, VISION_STROBE_B]) {
    assert.ok(strobe.every(([n, kind]) => n >= 1 && n <= 10 && /^[kvcbznPgGoWt]$/.test(kind)));
    // Never twice the same pass in a row.
    strobe.slice(1).forEach(([, kind], i) => assert.notEqual(kind, strobe[i]![1]));
  }
});

test("« Vision machine » (effect v1): everyone boxed as filmed first, a strobe at other moments of her shot, the graph on white, her place in characters to finish", () => {
  const people = [
    { x: 300, y: 900, w: 120, h: 340 },
    { x: 520, y: 980, w: 110, h: 320 },
    { x: 700, y: 760, w: 80, h: 220 },
  ];
  const marks = { open: "9", graph: "54", people: "60", after: "72", close: "117", etiquette: "BROCANTE" };
  const at = (frame: number, boxes = people) => nodes(drawAt(frame, marks, boxes));
  // Its opening: her shot at its own moment (no other moment), its boxes clipped on it, a tab with her word above each.
  const open = at(2);
  assert.ok(open.some((n) => n.type === "Footage" && n.props.at === undefined));
  // (each box padded 5 px, in its blue or its black with dots).
  assert.ok(open.some((n) => /^path\('.*M295 895h130v350/.test(String(styleOf(n).clipPath ?? ""))));
  const tabs = open.filter((n) => "data-fauve-decor" in n.props);
  assert.ok(tabs.length >= 1);
  // Each tab its word, some of its letters dropped at random, never longer.
  const words = nodes({ type: "x", props: {}, children: tabs }).filter((n) => n.type === "div" && styleOf(n).fontFamily === "'VT323', 'IBM Plex Mono', monospace").map(textOf);
  assert.equal(words.length, 3);
  assert.ok(words.every((w) => w.length === "BROCANTE".length), JSON.stringify(words));
  // In its strobe, other moments of her shot (Footage from another frame).
  const strobe = Array.from({ length: 40 }, (_, k) => at(10 + k)).flat();
  assert.ok(strobe.some((n) => n.type === "Footage" && typeof n.props.at === "number"));
  // Its graph on white: a dot for each one seen.
  const graph = at(55);
  assert.ok(graph.some((n) => n.type === "div" && styleOf(n).background === "#fbfdfa"));
  assert.equal(graph.filter((n) => n.type === "circle").length, 3);
  // Its closing: her place in characters, at its own moment.
  const close = at(120);
  assert.ok(close.some((n) => n.type === "Ascii" && n.props.kind === undefined));
  assert.ok(close.some((n) => n.type === "Footage" && n.props.at === undefined));
  // Nobody seen: no box, the graph gives way to the characters.
  assert.ok(!at(2, []).some((n) => /^path\(/.test(String(styleOf(n).clipPath ?? ""))));
  assert.ok(at(55, []).some((n) => n.type === "Ascii"));
  assert.equal(at(55, []).filter((n) => n.type === "circle").length, 0);
});

test("« Vision machine » (effect v1): its optional title, a detection label to read, in the safe zone, steady over the strobe", () => {
  const marks = { open: "9", graph: "54", people: "60", after: "72", close: "117" };
  const fits = (frame: number, words: Record<string, string>) => nodes(drawAt(frame, { ...marks, ...words })).filter((n) => n.type === "FitText");
  assert.equal(fits(30, {}).length, 0);
  for (const f of [0, 30, 55, 100, 125]) {
    const [title] = fits(f, { titre: "Samedi aux puces" });
    assert.ok(title, `frame ${f}`);
    const s = styleOf(title!);
    assert.ok(Number(s.left) >= 140 && Number(s.left) + Number(s.width) <= 940 && Number(s.top) >= 80 && Number(s.top) + Number(s.height) < 960, JSON.stringify(s));
    const span = title!.children[0] as Drawn;
    assert.ok(Number(styleOf(span).fontSize) >= 48);
    assert.equal(textOf(title!), "Samedi aux puces");
  }
});
