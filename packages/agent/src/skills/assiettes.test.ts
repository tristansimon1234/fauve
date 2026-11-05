import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillFit, skillLengths, skillPlan } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { assiettes, keptCuts, phraseCounts } from "./assiettes.ts";

// « Défilé d'assiettes », the model (assiettes.ts, version 1), on its original's fiche (docs/fiches/assiettes.md).

/** The original's 30 cuts, the first image of each new dish (measured image by image; measure.py found them all). */
const ORIGINAL_CUTS = [14, 31, 46, 64, 74, 85, 97, 108, 129, 140, 154, 169, 188, 191, 277, 291, 313, 329, 348, 358, 368, 383, 392, 418, 426, 437, 446, 463, 472, 490];

test("« Défilé d'assiettes » (v1): its 31 dishes on its original's cuts (91,6 BPM, in sixteenths), its flash, its vedette, 16,9 s", () => {
  assert.equal(assiettes.version, 1);
  assert.equal(assiettes.bpm, 91.6);
  const line = assiettes.timeline(31, { end: false });
  // 507 images, the original's; each cut within an image of the original's, eleven right on it.
  assert.equal(line.shots.length, 31);
  assert.equal(Math.round(line.duration * 30), 507);
  const cuts = line.shots.slice(1).map((s) => Math.round(s.start * 30));
  cuts.forEach((c, i) => assert.ok(Math.abs(c - ORIGINAL_CUTS[i]!) <= 1, `cut ${i + 1}: ${c} for ${ORIGINAL_CUTS[i]}`));
  assert.equal(cuts.filter((c, i) => c === ORIGINAL_CUTS[i]).length, 11);
  // Its flash: three images right before its vedette, held 2,87 s (images 192 to 278); its drop's dish on beat 16.
  const lengths = line.shots.map((s) => Math.round((s.end - s.start) * 30));
  assert.equal(lengths[13], 3);
  assert.equal(lengths[14], 86);
  assert.match(line.shots[13]!.want, /éclair/);
  assert.match(line.shots[14]!.want, /plat vedette, tenu 2,87 s/);
  assert.equal(Math.round(line.shots[17]!.start * 30), 314);
  assert.match(line.shots[17]!.want, /plat du drop/);
  // No dish held over 0,9 s but its vedette and its last (the original's longest, 0,87 s).
  assert.ok(lengths.every((l, i) => i === 14 || i === 30 || l <= 27), lengths.join(" "));
  // Its title typed from image 4 to 42, its line from 2 to 39, both gone on the ninth dish's cut (image 108).
  assert.deepEqual(line.marks, { type_at: 4, type_end: 42, line_at: 2, line_end: 39, title_out: 108 });
  assert.deepEqual(line.texts, { titre: { from: 0.13, to: 3.6 }, ligne: { from: 0.07, to: 3.6 } });
  // Its music from its first image: without its bass to just after the vedette's start (the original's drums out at
  // 6,92 s), muffled to its vocal's return (8,97 s), without its bass again, a near silence (9,95 s) dying away, the
  // drop on its cut (10,48 s), cut dead at the end. No sound effects (no typing sound under its title).
  const music = line.music!;
  assert.equal(music.downbeat, 0);
  assert.deepEqual(music.filters!.map((f) => f.kind), ["thin", "muffled", "thin"]);
  assert.ok(Math.abs(music.filters![0]!.to - 6.92) < 0.03 && Math.abs(music.filters![1]!.to - 8.97) < 0.04 && Math.abs(music.filters![2]!.to - 9.95) < 0.03, JSON.stringify(music.filters));
  assert.equal(music.pauses!.length, 1);
  assert.ok(Math.abs(music.pauses![0]!.to - 10.48) < 0.02 && music.pauses![0]!.tail === 0.12, JSON.stringify(music.pauses));
  assert.deepEqual(music.end, { at: 16.9 });
  assert.equal(line.sounds, undefined);
});

test("« Défilé d'assiettes »: 12 to 31 dishes from her files, whole phrases out first, up to 61 for a length she asks for", () => {
  // Every count adds up; its second bar of the drop, its intro's second half and its flash go first.
  for (let n = 12; n <= 61; n++) {
    const { counts, encore, flash } = phraseCounts(n);
    const total = Object.values(counts).reduce((a, b) => a + b, 0) + encore.reduce((a, e) => a + e.m, 0) + (flash ? 1 : 0);
    assert.equal(total, n, `n=${n}`);
    const line = assiettes.timeline(n, { end: false });
    assert.equal(line.shots.length, n);
    // A parade: no dish over 1,25 s but its vedette and its last.
    const long = line.shots.filter((s, i) => s.end - s.start > 1.25 && i !== line.shots.findIndex((x) => /^le plat vedette/.test(x.want)) && i !== n - 1);
    assert.deepEqual(long, [], `n=${n}`);
  }
  assert.deepEqual(phraseCounts(25).encore, []);
  assert.equal(phraseCounts(21).counts.suite, 0);
  assert.equal(phraseCounts(20).flash, false);
  // Its lengths: 12,2 s (12 to 21 dishes), 14,3 s (22 to 25), 16,9 s (26 to 31), then a bar of six more each 2,6 s.
  assert.deepEqual([12, 21, 22, 25, 26, 31].map((n) => assiettes.timeline(n, { end: false }).duration), [12.23, 12.23, 14.3, 14.3, 16.9, 16.9]);
  assert.equal(assiettes.long, 61);
  assert.equal(assiettes.timeline(61, { end: false }).duration, 30);
  assert.ok(assiettes.timeline(32, { end: false }).duration > 16.9);
  assert.ok(assiettes.timeline(61, { end: true, bpm: 80 }).duration <= 45);
  assert.ok(skillLengths(assiettes).max <= 45);
  // Each count only adds: for a length she asks for, its own tempo, the closest count.
  assert.deepEqual(skillFit(assiettes, 22), { n: 43, bpm: 91.6 });
  // A phrase kept in part keeps the original's cuts that make its dishes the most even.
  assert.deepEqual(keptCuts({ cuts: [0, 3, 6.5, 9.5, 13, 15, 17.5, 20, 22], length: 26.5 }, 5), [0, 6.5, 13, 17.5, 22]);
  assert.deepEqual(keptCuts({ cuts: [0, 5, 7, 9, 11, 14], length: 16 }, 3), [0, 5, 11]);
  // An ending card: its last dish held whole beats longer (1,6 s at least), its music to the end.
  const line = assiettes.timeline(31, { end: false });
  const ended = assiettes.timeline(31, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6);
  assert.equal(ended.shots.length, 31);
  assert.equal(ended.music!.end!.at, ended.duration);
  // At another tempo, every length counted in sixteenths follows it; its flash stays three images.
  const slow = assiettes.timeline(31, { end: false, bpm: 80 });
  assert.ok(Math.abs(slow.duration / line.duration - 91.6 / 80) < 0.01);
  assert.ok(Math.abs(slow.marks.type_end! / line.marks.type_end! - 91.6 / 80) < 0.03);
  assert.equal(Math.round((slow.shots[13]!.end - slow.shots[13]!.start) * 30), 3);
});

test("« Défilé d'assiettes »: its plan (its words by role, its music's shape), nothing cut out, followed or read", () => {
  const files = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 9 }));
  const plan = skillPlan({
    skill: assiettes,
    name: "Défilé d'assiettes",
    files,
    fill: { shots: Array.from({ length: 31 }, (_, i) => ({ file: files[i % 12]!.id, at: Math.floor(i / 12) * 3 })), texts: { titre: "Notre carte d'hiver", ligne: "faite maison" }, end: null },
  });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 31);
  assert.deepEqual(plan.texts.map((t) => [t.style, t.text]), [["hook", "Notre carte d'hiver"], ["caption", "faite maison"]]);
  assert.equal(plan.sounds?.length ?? 0, 0);
  assert.equal(plan.music_shape?.pauses?.length, 1);
  assert.deepEqual(plan.skill, { key: "assiettes", version: 1 });
  assert.equal(plan.tempo, 91.6);
  // Light to render: nothing cut out nor followed, no clear area, no reading of her shots.
  assert.deepEqual(checkMotionCode(assiettes.code), []);
  assert.deepEqual([subjectsDrawn(assiettes.code), objectsDrawn(assiettes.code), clearsDrawn(assiettes.code), readsDrawn(assiettes.code)], [[], [], [], []]);
  assert.ok(assiettes.code.length < 24000);
  assert.doesNotMatch(assiettes.code, /transform|scale\(/);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, options: { aspect?: number; texts?: Record<string, string>; reel?: { text: string; role: string }[]; end?: unknown; end_card?: boolean; n?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", TypeOn: "TypeOn", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${assiettes.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const line = assiettes.timeline(options.n ?? 31, { end: Boolean(options.end_card) });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const durationInFrames = Math.round(line.duration * 30);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 9 / 16, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const reelTexts = (options.reel ?? [
    { text: "Notre carte d'hiver", role: "hook" },
    { text: "faite maison", role: "caption" },
  ]).map((t) => ({ ...t, from: 0, to: 108, emphasis: [] }));
  const brand = { name: "Cantine Lou", displayFont: "Anton", bodyFont: "Cormorant Garamond", accent: "#b5543a", palette: { light: "#f6efe4", dark: "#1d1b19" } };
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots, reelTexts, end: options.end ?? null, texts: { ...marks, ...options.texts } });
}

const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const of = (tree: Drawn, type: string) => nodes(tree).filter((n) => n.type === type);
const typedText = (fit: Drawn) => String(of(fit, "TypeOn")[0]?.props.text ?? "");

test("« Défilé d'assiettes » draws the dish on now full frame, as filmed, one after the other", () => {
  const line = assiettes.timeline(31, { end: false });
  for (const [k, s] of line.shots.entries()) {
    const f = Math.round(s.start * 30);
    const dish = of(drawAt(f), "Footage");
    assert.equal(dish.length, 1);
    assert.equal(dish[0]!.props.shot, k, `image ${f}`);
    assert.deepEqual(styleOf(dish[0]!), { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 });
  }
  // Most of her videos in width (or her word): whole in a 16:9 band in the middle, on black; upright as asked.
  assert.deepEqual(styleOf(of(drawAt(20, { aspect: 16 / 9 }), "Footage")[0]!), { position: "absolute", left: 0, top: 656, width: 1080, height: 608 });
  assert.equal(styleOf(of(drawAt(20, { texts: { format: "horizontal" } }), "Footage")[0]!).height, 608);
  assert.equal(styleOf(of(drawAt(20, { aspect: 16 / 9, texts: { format: "vertical" } }), "Footage")[0]!).height, 1920);
});

test("« Défilé d'assiettes » types its title and its line together, at an even pace, its caret on the line only, both gone at once", () => {
  // Nothing before image 2; the line from image 2, the title from image 4.
  assert.equal(of(drawAt(1), "TypeOn").length, 0);
  assert.deepEqual(of(drawAt(2), "TypeOn").map((t) => t.props.text), ["faite maison"]);
  const typing = of(drawAt(10), "TypeOn");
  assert.deepEqual(typing.map((t) => t.props.text), ["NOTRE CARTE D'HIVER", "faite maison"]);
  const [title, line] = typing;
  assert.deepEqual([title!.props.at, line!.props.at, title!.props.jitter, line!.props.jitter], [4, 2, 0, 0]);
  // Each one whole on its last image (TypeOn's even pace: a letter every step, a space free): the title's 16 steps over
  // 38 images, the line's 10 over 37.
  assert.ok(Math.abs(Number(title!.props.speed) - (16 * 30) / 38) < 1e-9, String(title!.props.speed));
  assert.ok(Math.abs(Number(line!.props.speed) - (10 * 30) / 37) < 1e-9, String(line!.props.speed));
  // Its caret on the line only, gone seven images after its last letter.
  assert.deepEqual([title!.props.caret, line!.props.caret], ["none", "bar"]);
  assert.equal(of(drawAt(45), "TypeOn")[1]!.props.caret, "bar");
  assert.equal(of(drawAt(46), "TypeOn")[1]!.props.caret, "none");
  // Held, then both gone at once on image 108 (the ninth dish's cut).
  assert.equal(of(drawAt(107), "TypeOn").length, 2);
  assert.equal(of(drawAt(108), "TypeOn").length, 0);
  // In capitals, an hour keeping its small h; a line of four words a small label beside the title, of five at 48 px.
  assert.equal(typedText(of(drawAt(30, { reel: [{ text: "Ouvert dès 7 h", role: "hook" }] }), "FitText")[0]!), "OUVERT DÈS 7 h");
  const fits = of(drawAt(60), "FitText");
  assert.ok(nodes(fits[1]!).some((n) => "data-fauve-accent" in n.props));
  assert.equal((fits[1]!.props.innerStyle as { fontSize: number }).fontSize, 42);
  const long = of(drawAt(60, { reel: [{ text: "Notre carte", role: "hook" }, { text: "simples, saines, rapides et gourmandes", role: "caption" }] }), "FitText");
  assert.equal((long[1]!.props.innerStyle as { fontSize: number }).fontSize, 48);
  assert.ok(!nodes(long[1]!).some((n) => "data-fauve-accent" in n.props));
  // Its title's capitals 2,5 % of the frame's height (Anton's capitals are 0,85 of its size: 56 px, measured on its
  // render), centred on its middle; its line under it; every word to read inside the safe zone, left of the apps'
  // buttons below the middle.
  assert.equal((fits[0]!.props.innerStyle as { fontSize: number }).fontSize, 56);
  for (const fit of fits) {
    const b = styleOf(fit) as unknown as Box;
    assert.ok(b.top >= 80 && b.top + b.height <= 1440, `${typedText(fit)}: ${b.top}`);
    assert.ok(b.left >= 140 && b.left + b.width <= 940, `${typedText(fit)}: ${b.left} ${b.width}`);
  }
  assert.ok(Math.abs(Number(styleOf(fits[0]!).top) + Number(styleOf(fits[0]!).height) / 2 - 960) <= 1);
  assert.ok(Math.abs(Number(styleOf(fits[1]!).top) + Number(styleOf(fits[1]!).height) / 2 - 1033) <= 1);
});

test("« Défilé d'assiettes »: its ending card over its last dish, typed as its title, readable", () => {
  const line = assiettes.timeline(31, { end: true });
  const from = Math.round((line.duration - 1.6) * 30);
  const end = { title: "Réservez dès 12 h", subtitle: "au 01 23 45 67 89", from };
  assert.equal(of(drawAt(from - 1, { end, end_card: true }), "TypeOn").length, 0);
  const card = of(drawAt(from + 20, { end, end_card: true }), "TypeOn");
  // A phone number never breaks between its digits.
  assert.deepEqual(card.map((t) => t.props.text), ["RÉSERVEZ DÈS 12 h", "au 01 23 45 67 89"]);
  assert.deepEqual(card.map((t) => t.props.at), [from + 2, from]);
  // Over her last dish, still playing.
  assert.equal(of(drawAt(from + 20, { end, end_card: true }), "Footage")[0]!.props.shot, 30);
});
