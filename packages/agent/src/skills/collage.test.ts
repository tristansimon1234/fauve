import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { skillCode, skillPlan, skillShotCount } from "../skills.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { objectsDrawn, readPassages, readsDrawn, subjectShots } from "../subject.ts";
import { collage, collageChain } from "./collage.ts";

// « Collage qui s'emboîte » (skills/collage.ts), on its original's fiche (docs/fiches/collage.md).

/** The original's changes of picture in its first loop (images at 30 i/s): every 6 images, its loop starting again at 125. */
const ORIGINAL_STEPS = Array.from({ length: 21 }, (_, k) => k * 6);
const ORIGINAL_LOOP = 125;

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };
type Shot = { from: number; durationInFrames: number; kind: string; aspect: number; index: number };
/** What the engine read on her shots, by case: her cut-out's box, her outline, the window's outline, her sky. */
type Reads = { cut?: (i: number) => boolean; outline?: (i: number) => string | null; window?: string | null; sky?: (i: number) => number | null };

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
const textOf = (node: Drawn): string => node.children.map((c) => (typeof c === "string" ? c : c && typeof c === "object" ? textOf(c as Drawn) : "")).join("");

/** Its timeline's shots as its code gets them (frames), each of one shape, with its case's index (for the readings). */
const shotsOf = (spans: { start: number; end: number }[], aspect = 9 / 16): Shot[] =>
  spans.map((s, index) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "photo", aspect, index }));
const marksOf = (n = 13, options: { end?: boolean; settings?: Record<string, string> } = {}) =>
  Object.fromEntries(Object.entries(collage.timeline(n, { end: options.end ?? false, ...(options.settings ? { settings: options.settings } : {}) }).marks).map(([k, v]) => [k, String(v)]));

/** Its Scene drawn at a frame with a plain tree for React (no renderer), its readings as the test gives them. */
function drawAt(frame: number, props: { n?: number; aspect?: number; reelTexts?: unknown[]; texts?: Record<string, string>; end?: { title: string; subtitle?: string; from: number } | null; reads?: Reads; ended?: boolean } = {}): Drawn {
  const n = props.n ?? 13;
  const line = collage.timeline(n, { end: Boolean(props.end) });
  const shots = shotsOf(line.shots, props.aspect);
  const reads = props.reads ?? {};
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    Skyline: "Skyline",
    useCurrentFrame: () => frame,
    SubjectBox: (shot: Shot | undefined) => (shot && (reads.cut ? reads.cut(shot.index) : true) ? { x: 300, y: 600, w: 480, h: 1300 } : null),
    SubjectOutline: (shot: Shot | undefined, _f: number, _laid: Box, name?: string) =>
      !shot ? null : name ? (shot.index === 7 && reads.window !== undefined ? reads.window : null) : reads.outline ? reads.outline(shot.index) : `M 300 600 L 780 600 L 780 1900 L 300 1900 Z`,
    SkylineAt: (shot: Shot | undefined) => (shot && reads.sky ? reads.sky(shot.index) : null),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${collage.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: Math.round(line.duration * 30),
    brand: { name: "Café des Arts", displayFont: "Big Shoulders Display", bodyFont: "Inter", accent: "#b5293f", palette: { secondary: "#1d3b2a", light: "#f4efe9", dark: "#1d1d1b" } },
    shots,
    reelTexts: props.reelTexts ?? [{ text: "Belleville", role: "hook", from: 0, to: Math.round(line.texts.titre!.to * 30), emphasis: [] }],
    end: props.end ?? null,
    texts: { ...marksOf(n, { end: Boolean(props.end) }), ...props.texts },
  });
}

/** What the frame shows, in order: each picture drawn, by its kind and its case (« Footage 3 », « Subject 4 », « Skyline 2 », « window 8 »), and the title. */
function layers(tree: Drawn): string[] {
  const top = tree.children as Drawn[];
  return top.flatMap((node) => {
    if (node.type === "Footage" || node.type === "Subject" || node.type === "Skyline") return [`${String(node.type)} ${String(node.props.shot)}`];
    if (node.type === "div" && styleOf(node).clipPath) return [`window ${String((node.children[0] as Drawn).props.shot)}`];
    if (node.type === "FitText") return [`text ${textOf(node)}`];
    return [];
  });
}

test("« Collage qui s'emboîte » (v1): the original's loop of 21 steps of 6 images in 13 cases, its cuts on the original's within an image", () => {
  assert.equal(collage.version, 1);
  assert.equal(collage.bpm, 75);
  assert.deepEqual([collage.shots, collage.files, collage.long], [[13, 26], [8, 26], 39]);
  const line = collage.timeline(13, { end: false });
  assert.equal(line.shots.length, 13);
  // One loop: 21 steps of 0,2 s (6 images), the original's 125 images within one.
  assert.equal(Math.round(line.duration * 30), 126);
  assert.ok(Math.abs(Math.round(line.duration * 30) - ORIGINAL_LOOP) <= 1);
  // Its photos (the main line) and the three people of its parade, beside C, each one step: as the original's cases.
  const frames = line.shots.map((s) => [Math.round(s.start * 30), Math.round(s.end * 30), Boolean(s.beside)]);
  assert.deepEqual(frames, [
    [0, 12, false],
    [12, 24, false],
    [24, 54, false],
    [30, 36, true],
    [36, 42, true],
    [42, 48, true],
    [54, 60, false],
    [60, 72, false],
    [72, 84, false],
    [84, 90, false],
    [90, 102, false],
    [102, 114, false],
    [114, 126, false],
  ]);
  // Where the picture changes: each photo's start, each person of the parade, each next image arriving (t<i>): the
  // original's 21 steps, every 6 images.
  const changes = new Set<number>();
  for (const s of line.shots) changes.add(Math.round(s.start * 30));
  for (const [k, v] of Object.entries(line.marks)) if (/^t\d+$/.test(k)) changes.add(v);
  assert.deepEqual([...changes].sort((a, b) => a - b), ORIGINAL_STEPS);
  assert.equal(line.marks.step, 6);
  // Its moves, in the original's order: her person arriving, its roofs (twice), its parade, a cut, a window, her
  // silhouette, a cut, a sky, her person arriving, and the loop.
  assert.deepEqual(collageChain(13).moves, ["arrive", "ground", "ground", "parade", "parade", "parade", "cut", "window", "silhouette", "cut", "sky", "arrive", "stay"]);
  assert.deepEqual(Object.entries(line.marks).filter(([k]) => /^k\d+$/.test(k)).map(([, v]) => v), [1, 2, 2, 7, 7, 7, 0, 3, 4, 0, 5, 1, 6]);
  // D and I in black and white, as the original's; all in colour as her words ask.
  assert.deepEqual(Object.keys(line.marks).filter((k) => /^g\d+$/.test(k)), ["g6", "g11"]);
  assert.deepEqual(Object.keys(collage.timeline(13, { end: false, settings: { couleur: "toutes" } }).marks).filter((k) => /^g/.test(k)), []);
  // Its title over its first ten steps (2 s); its music a beat's pickup without its bass, its downbeat at 0,8 s, cut dead.
  assert.deepEqual(line.texts, { titre: { from: 0, to: 2 } });
  assert.deepEqual(line.music, { downbeat: 0.8, filters: [{ kind: "thin", from: 0, to: 0.8 }], end: { at: 4.2, fade: 0.012 } });
  assert.equal(line.sounds, undefined);
  // Cut out: every image whose person arrives, parades, stays or makes a window: all but A and H.
  assert.deepEqual(line.cutouts, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12]);
});

test("« Collage qui s'emboîte » (v1): 26 cases last the original's 8,4 s, its second loop within an image of the original's; its last case closes the loop", () => {
  const line = collage.timeline(26, { end: false });
  assert.equal(line.shots.length, 26);
  assert.equal(line.duration, 8.4);
  // Its second loop: the original's second one starts on image 125, its steps every 6 images from there.
  const second = line.shots.filter((s, i) => i >= 13 && !s.beside).map((s) => Math.round(s.start * 30));
  const original = [125, 137, 149, 179, 185, 197, 209, 215, 227, 239];
  assert.equal(second.length, original.length);
  for (const [k, f] of second.entries()) assert.ok(Math.abs(f - original[k]!) <= 1, `${f} for ${original[k]}`);
  // Its second loop: its roofs once (C), then her person where no sky is read (four grounds a Reel at most), its
  // silhouette for its window (one thing named in the Reel), and the loop at the end.
  const moves = collageChain(26).moves;
  assert.deepEqual(moves.slice(13), ["arrive", "ground", "arrive", "parade", "parade", "parade", "cut", "silhouette", "silhouette", "cut", "arrive", "arrive", "stay"]);
  // Its last image's person stays on the first image: cut out whatever its place; J of the first loop stays on A of the second.
  assert.equal(moves[12], "stay");
  assert.ok(line.cutouts!.includes(25) && !line.cutouts!.includes(13) && !line.cutouts!.includes(23));
  const short = collage.timeline(14, { end: false });
  assert.deepEqual(collageChain(14).moves.slice(-2), ["stay", "stay"]);
  assert.ok(short.cutouts!.includes(13));
  // A third loop for a length she asks for, at most; at its slowest tempo, longer.
  const long = collage.timeline(39, { end: false });
  assert.equal(long.duration, 12.6);
  assert.ok(collage.timeline(39, { end: false, bpm: 60 }).duration <= 45);
  // Every count holds: its cases in order, a beside one right after the photo it plays on.
  for (let n = 13; n <= 39; n++) {
    const l = collage.timeline(n, { end: n % 2 === 0 });
    assert.equal(l.shots.length, n);
    for (const [i, s] of l.shots.entries()) {
      if (!s.beside) continue;
      const main = l.shots.slice(0, i).reverse().find((x) => !x.beside)!;
      assert.ok(s.start >= main.start && s.end <= main.end, `n=${n}: case ${i} beside its photo`);
    }
  }
  // With an ending card: its first image comes back for 1,8 s (whole steps over the engine's 1,6 s) after the loop.
  const ended = collage.timeline(13, { end: true });
  assert.ok(Math.abs(ended.duration - 4.2 - 1.8) < 0.01);
  assert.equal(ended.shots.at(-1)!.end, ended.duration);
  assert.equal(ended.music!.end!.at, ended.duration);
  // At another tempo, every length in steps follows it.
  const slower = collage.timeline(13, { end: false, bpm: 60 });
  assert.ok(Math.abs(slower.duration - 5.25) < 0.05);
});

test("« Collage qui s'emboîte » (v1): each next image arrives in a piece over the one before, by its move, else its fallback", () => {
  const withSky = { sky: (i: number) => ([2, 6, 10].includes(i) ? 700 : null) };
  // A whole, its title over it; then B's person arriving on A, at her place, the title behind her.
  assert.deepEqual(layers(drawAt(3)), ["Footage 0", "text Belleville"]);
  assert.deepEqual(layers(drawAt(8)), ["Footage 0", "text Belleville", "Subject 1"]);
  // No cut-out of her: B whole a step early, a plain cut.
  assert.deepEqual(layers(drawAt(8, { reads: { cut: (i) => i !== 1 } })), ["Footage 1", "text Belleville"]);
  // B, then C's roofs without their sky arriving over it; without a sky read on C, its person.
  assert.deepEqual(layers(drawAt(14)), ["Footage 1", "text Belleville"]);
  assert.deepEqual(layers(drawAt(20, { reads: withSky })), ["Footage 1", "text Belleville", "Skyline 2"]);
  assert.deepEqual(layers(drawAt(20)), ["Footage 1", "text Belleville", "Subject 2"]);
  // Its parade on C: three people cut out, one a step; one without a cut-out shows whole.
  assert.deepEqual([26, 32, 38, 44].map((f) => layers(drawAt(f))), [
    ["Footage 2", "text Belleville"],
    ["Footage 2", "text Belleville", "Subject 3"],
    ["Footage 2", "text Belleville", "Subject 4"],
    ["Footage 2", "text Belleville", "Subject 5"],
  ]);
  assert.deepEqual(layers(drawAt(38, { reads: { cut: (i) => i !== 4 } })), ["Footage 4", "text Belleville"]);
  // D's ground over C, then D whole in black and white, its title's last step; then none.
  assert.deepEqual(layers(drawAt(50, { reads: withSky })), ["Footage 2", "text Belleville", "Skyline 6"]);
  const d = drawAt(56);
  assert.deepEqual(layers(d), ["Footage 6", "text Belleville"]);
  assert.match(String(styleOf((d.children as Drawn[])[0]!).filter), /grayscale\(1\)/);
  assert.deepEqual(layers(drawAt(62)), ["Footage 7"]);
  // E's window: F seen through the thing its filler named, at F's own place (a clip of its whole picture); without it,
  // through E's silhouette; without that either, F's person arriving.
  const framed = drawAt(68, { reads: { window: "M 200 500 L 900 500 L 900 1100 L 200 1100 Z" } });
  assert.deepEqual(layers(framed), ["Footage 7", "window 8"]);
  const clip = (framed.children as Drawn[])[1]!;
  assert.equal(styleOf(clip).clipPath, "path('M 200 500 L 900 500 L 900 1100 L 200 1100 Z')");
  assert.deepEqual([styleOf(clip).left, styleOf(clip).top, styleOf(clip).width, styleOf(clip).height], [0, 0, 1080, 1920]);
  assert.deepEqual(styleOf((clip.children as Drawn[])[0]!), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(layers(drawAt(68)), ["Footage 7", "window 8"]);
  assert.deepEqual(layers(drawAt(68, { reads: { outline: () => null } })), ["Footage 7", "Subject 8"]);
  // F's silhouette shows G; then G, H whole (plain cuts); I seen in H's sky (H's ground over I); I in black and white.
  assert.deepEqual(layers(drawAt(80)), ["Footage 8", "window 9"]);
  assert.deepEqual([86, 92].map((f) => layers(drawAt(f))), [["Footage 9"], ["Footage 10"]]);
  assert.deepEqual(layers(drawAt(98, { reads: withSky })), ["Footage 11", "Skyline 10"]);
  assert.deepEqual(layers(drawAt(98)), ["Footage 10", "Subject 11"]);
  // J's person arriving on I, J whole, then J's person staying on A, which comes back from its start: the loop.
  assert.deepEqual([110, 116].map((f) => layers(drawAt(f))), [["Footage 11", "Subject 12"], ["Footage 12"]]);
  const loop = drawAt(122);
  assert.deepEqual(layers(loop), ["Footage 0", "Subject 12"]);
  assert.equal((loop.children as Drawn[])[0]!.props.at, 120);
  // J of a first loop stays on A of the next: A then plays at its own moment (held, not from the stay).
  const next = drawAt(122, { n: 26 });
  assert.deepEqual(layers(next), ["Footage 13", "Subject 12"]);
  assert.equal((next.children as Drawn[])[0]!.props.at, undefined);
  // Every frame draws a picture, for every count and every reading missing.
  for (const n of [13, 18, 26, 39]) {
    const frames = Math.round(collage.timeline(n, { end: false }).duration * 30);
    for (let f = 0; f < frames; f += 3) {
      for (const reads of [{}, { cut: () => false, outline: () => null }, withSky]) assert.ok(layers(drawAt(f, { n, reads })).some((l) => /^Footage/.test(l)), `n=${n} f=${f}`);
    }
  }
});

test("« Collage qui s'emboîte » (v1): its title in the safe zone; its format as her pictures; its ending card on its first image come back", () => {
  const title = (tree: Drawn) => flatten(tree).find((n) => String(n.props.key).startsWith("title-"));
  // Big white condensed capitals high in the frame, centred, above the middle (the apps' buttons below it).
  const t = title(drawAt(3))!;
  const box = styleOf(t);
  assert.ok(Number(box.left) >= 40 && Number(box.left) + Number(box.width) <= 1040 && Number(box.top) >= 80 && Number(box.top) + Number(box.height) <= 960, JSON.stringify(box));
  assert.equal(Number(box.left) + Number(box.width) / 2, 540);
  const inner = t.props.innerStyle as Record<string, unknown>;
  assert.equal(inner.color, "#ffffff");
  assert.equal(inner.textTransform, "uppercase");
  assert.ok(Number(inner.fontSize) >= 48);
  assert.equal(title(drawAt(62)), undefined);
  // No title (her pick, as the original): nothing written.
  assert.equal(title(drawAt(3, { reelTexts: [] })), undefined);
  // Mostly horizontal pictures: each one whole in a 16:9 band on black, every piece in the band's box; as her words ask, full frame.
  const wide = drawAt(8, { aspect: 16 / 9 });
  for (const node of (wide.children as Drawn[]).filter((n) => n.type === "Footage" || n.type === "Subject")) assert.deepEqual(styleOf(node), { left: 0, top: 656, width: 1080, height: 608 });
  const tb = styleOf(title(wide)!);
  assert.ok(Number(tb.top) >= 656 && Number(tb.top) + Number(tb.height) <= 960, JSON.stringify(tb));
  assert.deepEqual(styleOf((drawAt(8, { aspect: 16 / 9, texts: { format: "vertical" } }).children as Drawn[])[0]!), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(styleOf((drawAt(8, { texts: { format: "horizontal" } }).children as Drawn[])[0]!), { left: 0, top: 656, width: 1080, height: 608 });
  // Its ending card: her words in the same capitals on its first image, come back from the loop and held.
  const line = collage.timeline(13, { end: true });
  const from = Math.round((line.duration - 1.8) * 30);
  const card = drawAt(from + 20, { end: { title: "Ouvert dimanche", subtitle: "de 9 h à 18 h", from } });
  assert.equal((card.children as Drawn[])[0]!.props.shot, 0);
  const words = flatten(card).filter((n) => n.type === "FitText").map((n) => textOf(n).replace(/\s+/g, " "));
  assert.deepEqual(words, ["Ouvert dimanche", "de 9 h à 18 h"]);
  const sub = styleOf(flatten(card).find((n) => String(n.props.key).startsWith("sub-"))!);
  assert.ok(Number(sub.left) >= 140 && Number(sub.left) + Number(sub.width) <= 940 && Number(sub.top) + Number(sub.height) <= 1440, JSON.stringify(sub));
});

test("« Collage qui s'emboîte » (v1): its plan cuts out what its chain draws, reads the sky of four cases only, follows its one window", () => {
  // Its code: checked, no zoom nor push; its sky read on its cases written as numbers, its window on its eighth case.
  assert.deepEqual(checkMotionCode(collage.code), []);
  assert.ok(collage.code.length < 24000);
  assert.doesNotMatch(collage.code, /\btransform\b|\bscale\(/);
  assert.deepEqual(
    readsDrawn(collage.code).map((r) => [r.shot, r.kinds]),
    [
      [2, ["ground", "sky"]],
      [6, ["ground", "sky"]],
      [10, ["ground", "sky"]],
      [15, ["ground", "sky"]],
    ],
  );
  assert.deepEqual(objectsDrawn(collage.code), []);
  assert.deepEqual(objectsDrawn(skillCode(collage, { fenetre: "shop window" })), [{ shot: 7, name: "shop window" }]);
  // On her plan: her photos in its cases, its parade beside C at its moments, her cut-outs and her window declared.
  const files = Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 }));
  const fill = { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { titre: "Belleville" }, end: null, objects: { fenetre: "shop window" } };
  const plan = skillPlan({ skill: collage, name: "Collage qui s'emboîte", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.duration, 4.2);
  assert.deepEqual(plan.segments.flatMap((s) => ("beside" in s && s.beside ? [s.beside.at] : [])), [1, 1.2, 1.4]);
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 13, subjects: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12], objects: [{ shot: 7, name: "shop window" }] });
  assert.deepEqual([...subjectShots(plan)].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12]);
  assert.deepEqual(plan.music_shape, { downbeat: 0.8, filters: [{ kind: "thin", from: 0, to: 0.8, open: 0.02 }], end: { at: 4.2, fade: 0.012 } });
  // Its sky read on C, D and H (C of a second loop is not in a Reel of 13), each as a ground: four at most a Reel.
  assert.deepEqual(readPassages(plan, () => true).map((p) => [p.clip_id, p.kinds]), [
    ["p2", ["ground", "sky"]],
    ["p6", ["ground", "sky"]],
    ["p10", ["ground", "sky"]],
  ]);
  // Its fewest cases from one photo; her settings kept on the plan.
  assert.equal(skillShotCount(collage, [{ id: "p", photo: true, seconds: 0 }]), 13);
  const set = skillPlan({ skill: collage, name: "Collage", files, fill: { ...fill, settings: { couleur: "toutes", format: "vertical" } } });
  assert.deepEqual(set.skill?.settings, { couleur: "toutes", format: "vertical" });
  assert.equal(set.layers![0]!.motion.texts!.g6, undefined);
});
