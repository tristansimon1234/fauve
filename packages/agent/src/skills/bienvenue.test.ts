import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillFit, skillLengths, skillPlan, skillShotCount } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { bienvenue, burstCuts, landingSlots, welcomeLines } from "./bienvenue.ts";

// « L'accueil, puis la rafale », the model (bienvenue.ts, version 1), on its original's fiche (docs/fiches/bienvenue.md).

/** The original's 23 cuts, the first image of each new shot (measured image by image; measure.py found them all). */
const ORIGINAL_CUTS = [25, 45, 61, 82, 87, 92, 97, 102, 111, 119, 131, 139, 147, 159, 167, 171, 176, 183, 190, 203, 209, 217, 223];

test("« L'accueil, puis la rafale » (v1): four calm shots, the drop on sixteenth 16,75, twenty shots on the original's cuts (91,7 BPM), 7,73 s", () => {
  assert.equal(bienvenue.version, 1);
  assert.equal(bienvenue.bpm, 91.7);
  const line = bienvenue.timeline(24, { end: false });
  // 232 images, the original's; each cut within an image of the original's, nineteen right on it.
  assert.equal(line.shots.length, 24);
  assert.equal(Math.round(line.duration * 30), 232);
  const cuts = line.shots.slice(1).map((s) => Math.round(s.start * 30));
  cuts.forEach((c, i) => assert.ok(Math.abs(c - ORIGINAL_CUTS[i]!) <= 1, `cut ${i + 1}: ${c} for ${ORIGINAL_CUTS[i]}`));
  assert.equal(cuts.filter((c, i) => c === ORIGINAL_CUTS[i]).length, 19);
  // Its four calm shots (0,83, 0,67, 0,53 and 0,7 s), then the drop's stutter: four shots of five images.
  const lengths = line.shots.map((s) => Math.round((s.end - s.start) * 30));
  assert.deepEqual(lengths.slice(0, 8), [25, 20, 16, 21, 5, 5, 5, 5]);
  // No burst shot over half a second (the original's longest, 13 images).
  assert.ok(lengths.slice(4).every((l) => l <= 14), lengths.join(" "));
  assert.match(line.shots[0]!.want, /^le premier plan.*avant l'ouverture.*sinon/);
  assert.match(line.shots[3]!.want, /produits ou ses outils alignés.*sinon/);
  assert.match(line.shots[4]!.want, /plan du drop/);
  assert.match(line.shots[23]!.want, /^le dernier plan.*plan large.*sinon/);
  // Its lines land on images 5, 25, 45 and 61 (the original's « WELCOME », « TO », « OUR », « SALON »), gone on the drop (82).
  assert.deepEqual(line.marks, { drop: 82, land0: 5, land1: 25, land2: 45, land3: 61 });
  assert.deepEqual(line.texts, { accueil: { from: 0.17, to: 2.73 } });
  // No music on its calm shots: it comes in on the drop, its first strong beat there; cut softly at the end.
  assert.deepEqual(line.music, { downbeat: 2.733, pauses: [{ from: 0, to: 2.733 }], end: { at: 7.73, fade: 0.15 } });
  // A snap of fingers as each line lands (four without her words: the library's lengths).
  assert.deepEqual(
    line.sounds!.map((s) => [Math.round(s.at * 30), s.sound, s.gain]),
    [5, 25, 45, 61].map((f) => [f, "single finger snap", 3]),
  );
  assert.equal(line.cutouts, undefined);
});

test("« L'accueil, puis la rafale »: 10 to 24 shots from her files, the burst as long with fewer cuts, up to 44 for a length she asks for", () => {
  // Its burst for the original's count; fewer: its cuts kept by how much they matter (its beats first, its stutter last).
  assert.deepEqual(burstCuts(20).cuts, [0, 1, 2, 3, 4, 6, 7.5, 10, 11.5, 13.25, 15.75, 17.25, 18, 19.25, 20.5, 22, 24.75, 26, 27.5, 28.75]);
  assert.deepEqual(burstCuts(8), { cuts: [0, 4, 7.5, 11.5, 15.75, 20.5, 24.75, 28.75], length: 30.5 });
  assert.deepEqual(burstCuts(9).cuts, [0, 2, 4, 7.5, 11.5, 15.75, 20.5, 24.75, 28.75]);
  for (let m = 6; m <= 20; m++) {
    const b = burstCuts(m);
    assert.equal(b.cuts.length, m);
    assert.equal(b.length, 30.5);
    assert.ok(b.cuts.every((c) => burstCuts(20).cuts.includes(c)), `m=${m}: the original's cuts`);
  }
  // More: bars of ten more (its second bar's) before its last one, the Reel growing with each shot.
  assert.equal(burstCuts(30).length, 46.5);
  assert.equal(burstCuts(40).length, 62.5);
  assert.equal(burstCuts(23).length, 30.5 + 3.5);
  for (let n = 10; n <= 44; n++) {
    const line = bienvenue.timeline(n, { end: false });
    assert.equal(line.shots.length, n);
    if (n > 10) assert.ok(line.duration >= bienvenue.timeline(n - 1, { end: false }).duration, `n=${n}`);
    // A burst: no shot over 1,7 s but its last (a wide shot of her place full).
    const long = line.shots.slice(4, -1).filter((s) => s.end - s.start > 1.7);
    assert.deepEqual(long, [], `n=${n}`);
    assert.ok(bienvenue.timeline(n, { end: true, bpm: 80 }).duration <= 45);
  }
  // Its lengths: 7,73 s from 10 to 24 shots, 12,97 s with 44; 6,4 to 14,9 s over its tempos.
  assert.deepEqual([10, 17, 24, 34, 44].map((n) => bienvenue.timeline(n, { end: false }).duration), [7.73, 7.73, 7.73, 10.33, 12.97]);
  assert.deepEqual(skillLengths(bienvenue), { min: 6.43, max: 14.87 });
  // For a length she asks for, its own tempo and the closest count.
  assert.deepEqual(skillFit(bienvenue, 10), { n: 33, bpm: 91.7 });
  assert.equal(skillShotCount(bienvenue, [{ id: "p", photo: true, seconds: 0 }]), 10);
  // An ending card: its last shot held whole beats longer (1,6 s at least), its music to the end.
  const line = bienvenue.timeline(24, { end: false });
  const ended = bienvenue.timeline(24, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6);
  assert.equal(ended.shots.length, 24);
  assert.equal(ended.music!.end!.at, ended.duration);
  // At another tempo, every length counted in sixteenths follows it.
  const slow = bienvenue.timeline(24, { end: false, bpm: 80 });
  assert.ok(Math.abs(slow.duration / line.duration - 91.7 / 80) < 0.01);
  assert.ok(Math.abs(slow.marks.drop! / line.marks.drop! - 91.7 / 80) < 0.02);
});

test("« L'accueil, puis la rafale »: her sentence in four lines at most, one snap for each line as it lands", () => {
  assert.deepEqual(welcomeLines("Bienvenue dans notre salon"), ["BIENVENUE", "DANS", "NOTRE", "SALON"]);
  assert.deepEqual(welcomeLines("Bienvenue dans notre nouveau salon"), ["BIENVENUE", "DANS NOTRE", "NOUVEAU", "SALON"]);
  assert.deepEqual(welcomeLines("Bienvenue à la Maison du Pain"), ["BIENVENUE", "À LA", "MAISON", "DU PAIN"]);
  assert.deepEqual(welcomeLines("  Entrez,   c'est ouvert "), ["ENTREZ,", "C'EST", "OUVERT"]);
  assert.deepEqual(welcomeLines(""), []);
  // Its lines on its landing moments: one each, the last always on its last calm shot.
  assert.deepEqual([1, 2, 3, 4].map(landingSlots), [[0], [0, 3], [0, 1, 3], [0, 1, 2, 3]]);
  const three = bienvenue.timeline(24, { end: false, words: { accueil: "Entrez, c'est ouvert" } });
  assert.deepEqual(three.sounds!.map((s) => Math.round(s.at * 30)), [5, 25, 61]);
  const two = bienvenue.timeline(24, { end: false, words: { accueil: "Bonjour Farine" } });
  assert.deepEqual(two.sounds!.map((s) => Math.round(s.at * 30)), [5, 61]);
});

test("« L'accueil, puis la rafale »: its plan (its sentence, its snaps, its music's shape), the light of its calm shots read, nothing cut out", () => {
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 9 }));
  const plan = skillPlan({
    skill: bienvenue,
    name: "L'accueil, puis la rafale",
    files,
    fill: { shots: Array.from({ length: 24 }, (_, i) => ({ file: files[i % 8]!.id, at: Math.floor(i / 8) * 3 })), texts: { accueil: "Bienvenue dans notre salon" }, end: null },
  });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 24);
  assert.deepEqual(plan.texts.map((t) => [t.style, t.text]), [["hook", "Bienvenue dans notre salon"]]);
  assert.equal(plan.sounds?.length, 4);
  assert.ok(plan.sounds!.every((s) => s.skill && s.sound === "single finger snap"));
  assert.deepEqual(plan.music_shape?.pauses, [{ from: 0, to: 2.733 }]);
  assert.deepEqual(plan.skill, { key: "bienvenue", version: 1 });
  assert.equal(plan.tempo, 91.7);
  assert.deepEqual(plan.layers![0]!.motion.fonts, ["Mynerve"]);
  // Light to render: the light of its four calm shots read under her words, nothing cut out nor followed, no clear area.
  assert.deepEqual(checkMotionCode(bienvenue.code), []);
  assert.deepEqual(readsDrawn(bienvenue.code), [0, 1, 2, 3].map((shot) => ({ shot, kinds: ["light"] })));
  assert.deepEqual([subjectsDrawn(bienvenue.code), objectsDrawn(bienvenue.code), clearsDrawn(bienvenue.code)], [[], [], []]);
  assert.ok(bienvenue.code.length < 24000);
  assert.doesNotMatch(bienvenue.code, /transform|scale\(/);
  assert.deepEqual(bienvenue.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]], ["encre", ["sienne", "jaune", "blanc"]]]);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(
  frame: number,
  options: { aspect?: number; texts?: Record<string, string>; reel?: { text: string; role: string }[]; end?: unknown; end_card?: boolean; n?: number; accent?: string; light?: (shot: unknown) => { mean: number; high: number } | null } = {},
): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const light = options.light ?? (() => null);
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Handwriting: "Handwriting", LightUnder: (shot: unknown) => light(shot), useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${bienvenue.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const line = bienvenue.timeline(options.n ?? 24, { end: Boolean(options.end_card) });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const durationInFrames = Math.round(line.duration * 30);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 9 / 16, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const reelTexts = (options.reel ?? [{ text: "Bienvenue dans notre salon", role: "hook" }]).map((t) => ({ ...t, from: 5, to: 82, emphasis: [] }));
  const brand = { name: "Salon Lou", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: options.accent ?? "#3b2a4d", palette: { light: "#f6efe4", dark: "#1d1b19" } };
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
const written = (tree: Drawn) => of(tree, "Handwriting").map((n) => String(n.props.text));

test("« L'accueil, puis la rafale » plays the shot on now, its calm shots darker and paler, its burst as filmed", () => {
  const line = bienvenue.timeline(24, { end: false });
  for (const [k, s] of line.shots.entries()) {
    const f = Math.round(s.start * 30);
    const shot = of(drawAt(f), "Footage");
    assert.equal(shot.length, 1);
    assert.equal(shot[0]!.props.shot, k, `image ${f}`);
    // A veil on its four calm shots (a middle dose without a reading), none on the burst.
    assert.equal(styleOf(shot[0]!).filter, k < 4 ? "brightness(0.720) saturate(0.7)" : undefined, `shot ${k}`);
    assert.deepEqual([styleOf(shot[0]!).left, styleOf(shot[0]!).top, styleOf(shot[0]!).width, styleOf(shot[0]!).height], [0, 0, 1080, 1920]);
  }
  // Dosed on the light read under her words: a bright shot much darker, a dark one hardly, never under 0,4.
  const dose = (light: { mean: number; high: number }) => styleOf(of(drawAt(10, { light: () => light }), "Footage")[0]!).filter;
  assert.equal(dose({ mean: 0.6, high: 0.9 }), "brightness(0.500) saturate(0.7)");
  assert.equal(dose({ mean: 0.75, high: 1 }), "brightness(0.400) saturate(0.7)");
  assert.equal(dose({ mean: 0.2, high: 0.5 }), "brightness(0.920) saturate(0.7)");
  // Most of her videos in width (or her word): whole in a 16:9 band in the middle, on black; upright as asked.
  assert.deepEqual([styleOf(of(drawAt(100, { aspect: 16 / 9 }), "Footage")[0]!).top, styleOf(of(drawAt(100, { aspect: 16 / 9 }), "Footage")[0]!).height], [656, 608]);
  assert.equal(styleOf(of(drawAt(100, { texts: { format: "horizontal" } }), "Footage")[0]!).height, 608);
  assert.equal(styleOf(of(drawAt(100, { aspect: 16 / 9, texts: { format: "vertical" } }), "Footage")[0]!).height, 1920);
});

test("« L'accueil, puis la rafale » writes her sentence a line on each calm shot, stacked in the middle, gone on the drop", () => {
  // Nothing before image 5; then one line more on images 5, 25, 45 and 61; nothing from the drop (82).
  assert.deepEqual(written(drawAt(4)), []);
  assert.deepEqual(written(drawAt(5)), ["BIENVENUE"]);
  assert.deepEqual(written(drawAt(24)), ["BIENVENUE"]);
  assert.deepEqual(written(drawAt(25)), ["BIENVENUE", "DANS"]);
  assert.deepEqual(written(drawAt(45)), ["BIENVENUE", "DANS", "NOTRE"]);
  assert.deepEqual(written(drawAt(81)), ["BIENVENUE", "DANS", "NOTRE", "SALON"]);
  assert.deepEqual(written(drawAt(82)), []);
  assert.deepEqual(written(drawAt(200)), []);
  // Each line at its place from the first (a line every 185 px, the stack centred on the middle), its own box within the
  // safe zone, left of the apps' buttons below the middle; Mynerve 112 px, spaced, no grain, its letters strayed.
  const hands = of(drawAt(70), "Handwriting");
  const centres = hands.map((n) => {
    const b = n.props.box as { x: number; y: number; w: number; h: number };
    return Math.round(b.y + b.h / 2);
  });
  assert.deepEqual(centres, [683, 868, 1053, 1238]);
  assert.equal((of(drawAt(5), "Handwriting")[0]!.props.box as { y: number }).y, (hands[0]!.props.box as { y: number }).y);
  for (const n of hands) {
    const b = n.props.box as { x: number; y: number; w: number; h: number };
    assert.ok(b.x >= 140 && b.x + b.w <= 940 && b.y >= 80 && b.y + b.h <= 1440, JSON.stringify(b));
    const style = n.props.style as { fontFamily: string; fontSize: number; letterSpacing: string };
    assert.match(style.fontFamily, /^'Mynerve'/);
    assert.deepEqual([style.fontSize, style.letterSpacing, n.props.grain, n.props.bend, n.props.align, n.props.wobble], [112, "0.12em", 0, 0, "center", 1.6]);
  }
  // Three lines: the last on the last calm shot; more than four words: two short ones on a line.
  const three = (f: number) => written(drawAt(f, { reel: [{ text: "Entrez, c'est ouvert", role: "hook" }] }));
  assert.deepEqual([three(5), three(25), three(45), three(61)], [["ENTREZ,"], ["ENTREZ,", "C'EST"], ["ENTREZ,", "C'EST"], ["ENTREZ,", "C'EST", "OUVERT"]]);
  assert.deepEqual(written(drawAt(70, { reel: [{ text: "Bienvenue dans notre nouveau salon", role: "hook" }] })), ["BIENVENUE", "DANS NOTRE", "NOUVEAU", "SALON"]);
});

test("« L'accueil, puis la rafale »: its ink, hers when it reads on a dark picture, else the original's fluo yellow; its ending card", () => {
  const ink = (accent: string, encre?: string) => of(drawAt(70, { accent, ...(encre ? { texts: { encre } } : {}) }), "Handwriting")[0]!.props.color;
  assert.equal(ink("#3b2a4d"), "#f4ff00");
  assert.equal(ink("#F4B6C2"), "#f4b6c2");
  assert.equal(ink("#f4b6c2", "jaune"), "#f4ff00");
  assert.equal(ink("#3b2a4d", "blanc"), "#ffffff");
  // Its ending card: her last shot held under it with the calm shots' veil, her title by the same hand, its line smaller.
  const line = bienvenue.timeline(24, { end: true });
  const from = Math.round((line.duration - 1.6) * 30);
  const end = { title: "Ouvert dès mardi", subtitle: "12 rue des Martyrs", from };
  assert.deepEqual(written(drawAt(from - 1, { end, end_card: true })), []);
  const card = drawAt(from + 10, { end, end_card: true });
  assert.deepEqual(written(card), ["OUVERT", "DÈS MARDI", "12 RUE DES MARTYRS"]);
  assert.equal((of(card, "Handwriting")[2]!.props.style as { fontSize: number }).fontSize, 67);
  assert.equal(of(card, "Footage")[0]!.props.shot, 23);
  assert.equal(styleOf(of(card, "Footage")[0]!).filter, "brightness(0.620) saturate(0.7)");
});
