import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { mosaique } from "./mosaique.ts";

// « La mosaïque », the effect of the bank (mosaique.ts): its own checks, beside the bank's (features.test.ts).

/** Her shots as the chain cuts them under it: a lead shot, n shots of `beats` beats each at 100 BPM, an after shot. */
const run = (n: number, beats = 2) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: 0.6 * beats, ...(i % 3 === 2 ? { photo: true } : {}) })),
  { file: "after", at: 2, seconds: 1.8 },
];

test("« La mosaïque » (effect v1): its layer over a run of 3 to 12 shots, the beat its only mark, nothing cut out of her shots", () => {
  for (const [n, beats] of [[3, 2], [6, 2], [12, 1]] as const) {
    const plan = pieceTestPlan({ piece: mosaique, shots: run(n, beats), span: [1.2, 1.2 + n * 0.6 * beats], fill: { texts: {}, objects: {}, settings: {} }, bpm: 100 });
    assert.ok(editPlanSchema.safeParse(plan).success, `n=${n}`);
    const layer = plan.layers![0]!;
    assert.deepEqual(layerShots(plan, layer), Array.from({ length: n }, (_, i) => i + 1));
    const motion = layer.motion;
    assert.deepEqual(motion.piece, { key: "mosaique", version: 1 });
    // No title asked: its only texts are the beat and its shots as the engine counts them (its settings at their defaults are left out).
    assert.deepEqual(motion.texts, { beat: "18", mine: Array.from({ length: n }, (_, i) => i + 1).join(",") });
    // It lays her shots as the montage plays them (Footage): nothing cut out, no object, no sound, no font of its own.
    assert.equal(motion.drawn, undefined);
    assert.equal(motion.sounds, undefined);
    assert.equal(motion.fonts, undefined);
  }
  // A print never slides, fades or zooms: it lands at once, askew, then lies straight.
  assert.doesNotMatch(mosaique.code, /interpolate\(|spring\(/);
  assert.ok(mosaique.seconds[0] >= 2.5 && mosaique.seconds[1] <= 8 && mosaique.shots[0] === 3 && mosaique.shots[1] === 12);
});

test("« La mosaïque »: its settings as its filler sets them, its title optional and cut to its place, read by its code with the first choice as default", () => {
  const answer = {
    fits: true,
    missing: "",
    texts: [{ slot: "titre", text: "nos fraisiers du samedi matin" }],
    objects: [],
    settings: [
      { name: "cases", value: "4x6" },
      { name: "ordre", value: "spirale" },
      // Its default (left to its code) and a value it does not have are dropped.
      { name: "papier", value: "clair" },
      { name: "format", value: "auto" },
    ],
  };
  const read = readPieceFill(mosaique, answer)!;
  assert.deepEqual(read.settings, { cases: "4x6", ordre: "spirale" });
  // Cut at the last word that fits its 24 characters.
  assert.equal(read.texts.titre, "nos fraisiers du samedi");
  const plan = pieceTestPlan({ piece: mosaique, shots: run(4), span: [1.2, 6], fill: read, bpm: 100 });
  assert.deepEqual(plan.layers![0]!.motion.texts, { beat: "18", mine: "1,2,3,4", cases: "4x6", ordre: "spirale", titre: "nos fraisiers du samedi" });
  // Without a title, none is written (it is optional).
  assert.deepEqual(readPieceFill(mosaique, { ...answer, texts: [], settings: [] })!.texts, {});
  // Its code reads each setting by its name, its default the first choice (the one the engine never passes on).
  for (const s of mosaique.settings!) assert.ok(mosaique.code.includes(`setting("${s.name}", "${s.choices[0]!.value}")`), s.name);
  assert.ok(mosaique.code.includes('word("titre")') && mosaique.code.includes('mark("beat", 18)'));
});

test("« La mosaïque » is offered on three files or more with a close or detail shot, not on wide shots alone", () => {
  const clip = (framing: "wide" | "medium" | "close" | "detail") =>
    ({
      duration: 6,
      orientation: "landscape",
      summary: "des makis au saumon",
      setting: "intérieur d'un restaurant",
      lighting: "good",
      shots: [{ start: 0, end: 3, description: "des makis sur une natte", subject: "makis", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera: "static", subject_box: [200, 200, 800, 800], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  const close = pieceShots([{ media_id: "a", analysis: clip("close") }], {});
  assert.deepEqual(piecesOffered([mosaique], close, 3).map((p) => p.key), ["mosaique"]);
  assert.deepEqual(piecesOffered([mosaique], pieceShots([{ media_id: "a", analysis: clip("detail") }], {}), 4).map((p) => p.key), ["mosaique"]);
  assert.deepEqual(piecesOffered([mosaique], close, 2), []);
  assert.deepEqual(piecesOffered([mosaique], pieceShots([{ media_id: "a", analysis: clip("wide") }], {}), 5), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { durationInFrames: number; shots: { from: number; durationInFrames: number }[]; texts?: Record<string, string> }): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }) };
  // Remotion's random gives the same number for the same seed: any steady one does here.
  const random = (seed: string) => {
    let x = 2166136261;
    for (const c of seed) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
    return ((x >>> 0) % 10007) / 10007;
  };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame, random };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${mosaique.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const brand = { displayFont: "DM Serif Display", bodyFont: "Inter Tight", accent: "#c1440e", palette: { light: "#f4ebe1" } };
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, brand, texts: { beat: "18" }, ...props });
}

const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
const shotIn = (node: Drawn) => (node.children[0] as Drawn).props.shot as number;

/** The prints at that frame: how many each picture shows lying flat (one picture drawn through its prints), and those landing askew. */
function printsAt(tree: Drawn) {
  const [groups, landing] = tree.children as [Drawn[], Drawn[]];
  const flat: Record<number, number> = {};
  for (const g of groups) flat[shotIn(g)] = String(styleOf(g).clipPath).split("M").length - 1;
  const askew = landing.map((p) => ({ shot: shotIn(p), angle: Number(/rotate\((-?[\d.]+)deg\)/.exec(String(styleOf(p).transform))![1]), left: Number(styleOf(p).left) }));
  return { flat, askew };
}

/** Her shots as its layer gets them (frames from its start): the one before it, then n of `frames` frames each. */
const under = (n: number, frames: number, before = true) => [
  ...(before ? [{ from: -36, durationInFrames: 36 }] : []),
  ...Array.from({ length: n }, (_, i) => ({ from: i * frames, durationInFrames: frames })),
];

test("« La mosaïque » draws: the picture on screen cut into prints, each of its shots laid over it print by print from its cut to the next", () => {
  const shots = under(4, 36);
  // Its first frame: the montage's last image in eleven prints, the first shot's first print landing, counterclockwise.
  const first = printsAt(drawAt(0, { durationInFrames: 144, shots }));
  assert.deepEqual(first.flat, { 0: 11 });
  assert.equal(first.askew.length, 1);
  assert.equal(first.askew[0]!.shot, 1);
  assert.ok(first.askew[0]!.angle < -0.3 && first.askew[0]!.angle > -1.7, `${first.askew[0]!.angle}°`);
  // A print every 3 images at two beats a shot (the original's step), the one before it straight once the next one lands.
  const later = printsAt(drawAt(9, { durationInFrames: 144, shots }));
  assert.deepEqual(later.flat, { 0: 8, 1: 3 });
  assert.equal(later.askew.length, 1);
  // Just before the next cut, the first shot's picture is whole; on the cut, the next one's first print lands, the other way.
  const whole = printsAt(drawAt(35, { durationInFrames: 144, shots }));
  assert.equal((whole.flat[1] ?? 0) + whole.askew.filter((p) => p.shot === 1).length, 12);
  const cut = printsAt(drawAt(36, { durationInFrames: 144, shots }));
  assert.deepEqual(cut.flat, { 1: 11 });
  assert.equal(cut.askew[0]!.shot, 2);
  // Its last frame: its last shot's picture whole.
  const last = printsAt(drawAt(143, { durationInFrames: 144, shots }));
  assert.equal((last.flat[4] ?? 0) + last.askew.filter((p) => p.shot === 4).length, 12);
  assert.deepEqual(Object.keys(last.flat).map(Number).filter((k) => k !== 4), []);
  // Always a print changing: no stretch of three frames where none lands (one beat a shot, two beats a shot).
  for (const frames of [18, 36]) {
    const d = frames * 4;
    let still = 0;
    let before = JSON.stringify(printsAt(drawAt(0, { durationInFrames: d, shots: under(4, frames) })));
    for (let f = 1; f < d; f++) {
      const now = JSON.stringify(printsAt(drawAt(f, { durationInFrames: d, shots: under(4, frames) })));
      still = now === before ? still + 1 : 0;
      assert.ok(still < 3, `${frames} frames a shot: nothing changes around frame ${f}`);
      before = now;
    }
  }
});

test("« La mosaïque » opens the Reel on the picture it ends on, starts mid-shot at once, and lets a shot too close to its end lay none", () => {
  // Nothing on screen before it: its first picture is the one it ends on (the original's loop).
  const opening = printsAt(drawAt(0, { durationInFrames: 108, shots: under(3, 36, false) }));
  assert.deepEqual(opening.flat, { 2: 11 });
  assert.equal(opening.askew[0]!.shot, 0);
  // Laid from the middle of a shot: that shot is its first picture, the next one's prints landing from its first frame.
  const mid = [{ from: -10, durationInFrames: 46 }, { from: 36, durationInFrames: 36 }, { from: 72, durationInFrames: 36 }];
  const started = printsAt(drawAt(0, { durationInFrames: 108, shots: mid }));
  assert.deepEqual(started.flat, { 0: 11 });
  assert.equal(started.askew[0]!.shot, 1);
  // A shot starting 4 frames before its end (under half a beat) lays no picture: the last wave runs to its end.
  const short = [...under(2, 36), { from: 72, durationInFrames: 36 }];
  const end = printsAt(drawAt(75, { durationInFrames: 76, shots: short }));
  assert.equal(end.askew.some((p) => p.shot === 3) || 3 in end.flat, false);
});

test("« La mosaïque »: its settings change its grid, its order and its paper; its title reads on a paper label in the safe zone", () => {
  const shots = under(3, 36);
  const at = (frame: number, texts: Record<string, string>) => drawAt(frame, { durationInFrames: 108, shots, texts: { beat: "18", ...texts } });
  // 24 prints.
  assert.equal(printsAt(at(0, { cases: "4x6" })).flat[0], 23);
  // Its fourth print: the next row's first in reading order, the right column's in a spiral from the edge in.
  assert.ok(printsAt(at(9, {})).askew[0]!.left < 100);
  assert.ok(printsAt(at(9, { ordre: "spirale" })).askew[0]!.left > 600);
  // Black paper.
  assert.equal(styleOf(at(0, { papier: "noir" })).backgroundColor, "#111111");
  // Her horizontal pictures whole: 4 × 3 lying prints in a 16:9 block in the middle of the paper, her title in the serif above it.
  const block = at(0, { format: "horizontal", titre: "les makis du jour" });
  const [groups] = block.children as [Drawn[]];
  const picture = styleOf(groups[0]!.children[0] as Drawn);
  assert.equal(printsAt(block).flat[0], 11);
  assert.ok(Math.abs(Number(picture.width) / Number(picture.height) - 16 / 9) < 0.05, `${picture.width} × ${picture.height}`);
  const heading = block.children[3] as Drawn;
  assert.equal(heading.type, "FitText");
  assert.ok(Number(styleOf(heading).top) + Number(styleOf(heading).height) <= Number(picture.top), "above the block");
  // A square block of 3 × 3, in the middle of the paper.
  const square = at(0, { format: "carre" });
  const squared = styleOf(((square.children as [Drawn[]])[0][0]!).children[0] as Drawn);
  assert.equal(printsAt(square).flat[0], 8);
  assert.equal(squared.width, squared.height);
  assert.ok(Math.abs(Number(squared.top) + Number(squared.height) / 2 - 960) < 2, `${squared.top}`);
  // Full frame, her title on a paper label at the top, 48 px at least, between x 140 and 940.
  const framed = at(0, { titre: "les makis du jour" });
  const label = framed.children[2] as Drawn;
  assert.equal(label.type, "FitText");
  const box = styleOf(label);
  assert.ok(Number(box.left) >= 140 && Number(box.left) + Number(box.width) <= 940 && Number(box.top) >= 80 && Number(box.top) + Number(box.height) < 960);
  assert.ok(Number((label.props.innerStyle as Record<string, number>).fontSize) >= 48);
  assert.deepEqual((label.children[0] as Drawn).children, ["les makis du jour"]);
  // Laid like a print: a hair askew its first images, then straight.
  assert.match(String(box.transform), /rotate/);
  assert.equal(styleOf(at(5, { titre: "les makis du jour" }).children[2] as Drawn).transform, undefined);
  // No title: no text at all.
  assert.equal(framed.children[3], null);
  assert.equal(at(0, {}).children[2], null);
});
