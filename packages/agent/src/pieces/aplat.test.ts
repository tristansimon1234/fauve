import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan } from "../pieces.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { aplat, aplatTimeline } from "./aplat.ts";

// « Toi sur un aplat de couleur », the effect of the bank (aplat.ts): its own checks, beside the bank's (features.test.ts).

type Box = { x: number; y: number; w: number; h: number };
type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** Its Scene at one frame with a stand-in scope (each tool a named node), her cut-out's box and her sky's end as given. */
function drawAt(frame: number, texts: Record<string, string>, reads: { her?: Box | null; sky?: number | null } = {}, accent = "#f2552c"): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() }), Fragment: "Fragment" };
  const interpolate = (x: number, input: number[], output: number[]) => {
    if (x <= input[0]!) return output[0]!;
    for (let i = 1; i < input.length; i++) if (x < input[i]!) return output[i - 1]! + ((output[i]! - output[i - 1]!) * (x - input[i - 1]!)) / (input[i]! - input[i - 1]!);
    return output.at(-1)!;
  };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    CastShadow: "CastShadow",
    useCurrentFrame: () => frame,
    interpolate,
    Easing: { bezier: () => (t: number) => t },
    SubjectBox: () => reads.her ?? null,
    SkylineAt: () => reads.sky ?? null,
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${aplat.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const shots = [
    { from: -36, durationInFrames: 36, kind: "video", aspect: 9 / 16 },
    { from: 0, durationInFrames: 108, kind: "video", aspect: 9 / 16 },
    { from: 108, durationInFrames: 36, kind: "video", aspect: 9 / 16 },
  ];
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames: 108, brand: { accent, displayFont: "Archivo Black", bodyFont: "Inter Tight" }, shots, texts: { beat: "18", ...texts } });
}
const nodes = (n: unknown): Drawn[] => (n && typeof n === "object" && "children" in n ? [n as Drawn, ...(n as Drawn).children.flatMap(nodes)] : []);
const styleOf = (n: Drawn) => (n.props.style ?? {}) as Record<string, string | number>;

test("« Toi sur un aplat de couleur » (effect v1): its layer on her walking shot, her cut out there, its words and its colour her choice", () => {
  const shots = [
    { file: "lead", at: 0.5, seconds: 1.2 },
    { file: "walk", at: 1, seconds: 3.6 },
    { file: "after", at: 4, seconds: 1.2 },
  ];
  const plan = pieceTestPlan({ piece: aplat, shots, span: [1.2, 4.8], fill: { texts: { titre: "en route" }, objects: {}, settings: { couleur: "rouge" } }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(checkMotionCode(aplat.code), []);
  const motion = plan.layers![0]!.motion;
  // Her cut out on her walking shot alone (the second of her shots); nothing else followed.
  assert.deepEqual(motion.drawn, { shots: 3, subjects: [1] });
  // Its words: the optional line left out; its setting as she asked (the default is never written).
  assert.equal(motion.texts!.titre, "en route");
  assert.equal(motion.texts!.ligne, undefined);
  assert.equal(motion.texts!.couleur, "rouge");
  // On the Reel's beats at 100 BPM (18 images): the rebuild from its first beat, her ground's flash just before its
  // fourth, her sky's just after its fifth; her shot whole half a beat before its cut.
  assert.deepEqual(
    ["rise_0", "rise_1", "rise_2", "rise_3", "rise_4", "ground", "sky"].map((k) => Number(motion.texts![k])),
    [18, 27, 32, 33, 56, 70, 91],
  );
  // No sound of its own (its original has none), no font beyond the Reel's two.
  assert.equal(motion.sounds, undefined);
  assert.equal(motion.fonts, undefined);
  // Its depth is never asked (a layer's shot is a variable there, never read): its sky is, on her shot's first image.
  assert.doesNotMatch(aplat.code, /\b(Near|Depth|Skyline)\s*,/);
  assert.match(aplat.code, /SkylineAt\(shot, shot\.from/);
});

test("« Toi sur un aplat de couleur » (effect v1): its marks fit any span, beats dropped or added, always in order and inside her shot", () => {
  const marks = (frames: number, bpm: number, shot = { from: 0, frames }) => aplatTimeline({ frames, bpm, shots: [shot], words: {}, settings: {} }).marks!;
  for (const [frames, bpm] of [[48, 100], [60, 140], [60, 60], [90, 100], [150, 100], [150, 60], [72, 123]] as const) {
    const m = marks(frames, bpm);
    const order = ["rise_0", "rise_1", "rise_2", "rise_3", "rise_4", "ground", "sky"].map((k) => m[k]!);
    order.slice(1).forEach((f, i) => assert.ok(f > order[i]!, `${frames} images at ${bpm} BPM: ${JSON.stringify(m)}`));
    // Her three white images first; her shot whole (her sky's flash + 3) half a beat before its end.
    assert.ok(m.rise_0! >= 3);
    assert.ok(m.sky! + 3 <= frames - Math.round(1800 / bpm / 2), `${frames} images at ${bpm} BPM: sky ${m.sky}`);
  }
  // A span of more than six beats: her walk on the colour a beat longer, the rest on the beats after it.
  const long = marks(150, 100, { from: 0, frames: 240 });
  assert.deepEqual([long.rise_0, long.ground, long.sky], [36, 88, 109]);
  // Its walking shot cut before its end (more shots under it): every mark inside it.
  const cut = marks(150, 100, { from: 0, frames: 80 });
  assert.ok(cut.sky! + 3 <= 80 - 9, JSON.stringify(cut));
  // Her cut out on her walking shot, whatever its length.
  assert.deepEqual(aplatTimeline({ frames: 60, bpm: 140, shots: [{ from: 0, frames: 60 }], words: {}, settings: {} }).cutouts, [0]);
});

test("« Toi sur un aplat de couleur » (effect v1): white in her halo, then in her colours with her shadow on the colour; her ground, then her sky, flash white; then the montage", () => {
  const her = { x: 360, y: 380, w: 300, h: 900 };
  const texts = { rise_0: "18", rise_1: "27", rise_2: "32", rise_3: "33", rise_4: "56", ground: "70", sky: "91" };
  const at = (frame: number, reads: { her: Box | null; sky: number | null } = { her, sky: 1000 }, accent?: string) => nodes(drawAt(frame, texts, reads, accent));
  const flat = (all: Drawn[]) => all.find((n) => n.type === "div" && styleOf(n).backgroundColor && !styleOf(n).clipPath && !styleOf(n).mixBlendMode);
  // Her first three images: her silhouette flat white in its halo, on her vivid colour.
  const first = at(1);
  assert.equal(styleOf(flat(first)!).backgroundColor, "#f2552c");
  assert.ok(first.some((n) => n.type === "Subject" && n.props.fill === "#ffffff"));
  assert.ok(first.some((n) => n.type === "div" && /drop-shadow/.test(String(styleOf(n).filter ?? ""))));
  // Then in her colours, her shadow cast; a dull colour of hers gives way to the original's pure red.
  const walk = at(10);
  assert.ok(walk.some((n) => n.type === "Subject" && n.props.fill === undefined));
  assert.ok(walk.some((n) => n.type === "CastShadow" && n.props.direction === "left"));
  assert.equal(styleOf(flat(at(10, { her, sky: 1000 }, "#5e5670"))!).backgroundColor, "#ff0000");
  // Her shot rebuilt from the bottom of the frame, a straight edge rising.
  const rising = at(40).find((n) => n.type === "Footage" && /^polygon/.test(String(styleOf(n).clipPath)));
  assert.ok(rising, "her shot rising from the bottom");
  // Her ground's flash: under her sky's outline, flat white, for three images; then her ground as filmed.
  assert.ok(at(70).some((n) => n.type === "div" && styleOf(n).backgroundColor === "#ffffff" && /^path\('M0 1920/.test(String(styleOf(n).clipPath))));
  assert.ok(at(74).some((n) => n.type === "Footage" && /^path\('M0 1920/.test(String(styleOf(n).clipPath))));
  // Her sky's flash: the flat white under her ground; then nothing of its own, her shot whole is the montage's.
  assert.equal(styleOf(flat(at(92))!).backgroundColor, "#ffffff");
  const whole = drawAt(94, texts, { her, sky: 1000 });
  assert.equal(whole.type, "AbsoluteFill");
  assert.equal(whole.children.length, 0);
  // No sky read (an interior): her lower two thirds, then her top. No cut-out: her shot in black and white times the colour.
  assert.ok(at(74, { her, sky: null }).some((n) => n.type === "Footage" && styleOf(n).clipPath === "inset(653px 0 0 0)"));
  const duo = at(10, { her: null, sky: null });
  assert.ok(duo.some((n) => n.type === "div" && styleOf(n).mixBlendMode === "multiply"));
  assert.ok(!duo.some((n) => n.type === "Subject" || n.type === "CastShadow"));
});

test("« Toi sur un aplat de couleur » (effect v1): its optional words above her, readable, in the safe zone, until her sky's flash", () => {
  const her = { x: 360, y: 560, w: 300, h: 900 };
  const marks = { rise_0: "18", rise_1: "27", rise_2: "32", rise_3: "33", rise_4: "56", ground: "70", sky: "91" };
  const fits = (frame: number, words: Record<string, string>) => nodes(drawAt(frame, { ...marks, ...words }, { her, sky: 1000 })).filter((n) => n.type === "FitText");
  assert.equal(fits(30, {}).length, 0);
  assert.equal(fits(30, { titre: "en route" }).length, 1);
  const both = fits(30, { titre: "en route", ligne: "chaque samedi" });
  assert.equal(both.length, 2);
  for (const n of both) {
    const s = styleOf(n);
    assert.ok(Number(s.left) >= 140 && Number(s.left) + Number(s.width) <= 940 && Number(s.top) >= 80 && Number(s.top) + Number(s.height) <= her.y, JSON.stringify(s));
    assert.ok(Number(((n.props.innerStyle ?? {}) as Record<string, number>).fontSize) >= 48);
  }
  // Gone with her sky's flash; never on her three white images.
  assert.equal(fits(91, { titre: "en route" }).length, 0);
  assert.equal(fits(1, { titre: "en route" }).length, 0);
});
