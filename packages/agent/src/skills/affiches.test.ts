import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { readSkillFill, skillFit, skillLengths, skillPlan, skillTempos } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { affiches, affichesLabelled } from "./affiches.ts";

// « Tes produits en affiches », the model (affiches.ts, version 1), on its original's fiche (docs/fiches/affiches.md).

/** The original's nine cuts, one every second to the image (images 30 to 270; measure.py found them all). */
const ORIGINAL_CUTS = [30, 60, 90, 120, 150, 180, 210, 240, 270];

test("« Tes produits en affiches » (v1): its opening slit and eight posters of two beats at 120 BPM, each cut on the original's, its call on black", () => {
  assert.equal(affiches.version, 1);
  assert.equal(affiches.bpm, 120);
  const line = affiches.timeline(9, { end: false });
  // The opening, eight posters, the last one under the black ending: the original's 10 s, its ending held 2 s to be read.
  assert.equal(line.shots.length, 9);
  assert.equal(line.duration, 11);
  const cuts = line.shots.slice(1).map((s) => Math.round(s.start * 30));
  assert.deepEqual(cuts, ORIGINAL_CUTS.slice(0, 8));
  // Its black ending on the original's last cut (image 270, where its call comes).
  assert.deepEqual(line.marks, { beat: 15, pop: 6, first: 30, ending: ORIGINAL_CUTS[8] });
  assert.deepEqual(line.texts, { titre: { from: 0, to: 1 }, noms: { from: 1, to: 9 }, fin: { from: 9, to: 11 } });
  // The last poster's passage runs under the ending (3 s, 1 s of it seen); every other one 1 s.
  assert.deepEqual(line.shots.map((s) => Math.round((s.end - s.start) * 30)), [30, 30, 30, 30, 30, 30, 30, 30, 90]);
  assert.match(line.shots[8]!.want, /son passage dure 3 s : la fin sur le noir passe dessus après 1 s/);
  assert.match(line.shots[0]!.want, /fente horizontale/);
  // Its music composed at its tempo, cut dead at its end; no sound effects (the original has none); nothing cut out.
  assert.deepEqual(line.music, { end: { at: 11 } });
  assert.equal(line.sounds, undefined);
  assert.equal(line.cutouts, undefined);
});

test("« Tes produits en affiches »: the first, the last and one in two named, as the original's four of eight; every one as asked", () => {
  const named = (posters: number, every = false) => Array.from({ length: posters }, (_, p) => p).filter((p) => affichesLabelled(p, posters, every));
  // The original's: A, D, F, H of its eight.
  assert.deepEqual(named(8), [0, 3, 5, 7]);
  assert.deepEqual(named(4), [0, 3]);
  assert.deepEqual(named(5), [0, 2, 4]);
  assert.deepEqual(named(6), [0, 3, 5]);
  assert.deepEqual(named(11), [0, 2, 4, 6, 8, 10]);
  // Never the second (it would follow the first), never two in a row, always the last.
  for (let n = 3; n <= 27; n++) {
    const list = named(n);
    assert.ok(!list.includes(1) && list.every((p, i) => i === 0 || p - list[i - 1]! >= 2) && list.includes(n - 1), `n=${n}: ${list}`);
  }
  assert.deepEqual(named(5, true), [0, 1, 2, 3, 4]);
  // Each labelled case says the rank of its name in « noms »; the others name none.
  const line = affiches.timeline(9, { end: false });
  const ranks = line.shots.map((s) => /le (\d+)(?:er|e) nom de « noms »/.exec(s.want)?.[1] ?? null);
  assert.deepEqual(ranks, [null, "1", null, null, "2", null, "3", null, "4"]);
  const all = affiches.timeline(6, { end: false, settings: { etiquettes: "toutes" } });
  assert.deepEqual(all.shots.map((s) => /le (\d+)(?:er|e) nom/.exec(s.want)?.[1] ?? null), [null, "1", "2", "3", "4", "5"]);
});

test("« Tes produits en affiches »: four to eleven posters from her files, up to 27 for a length she asks for, its tempo within 84 to 140", () => {
  assert.deepEqual(affiches.shots, [5, 12]);
  assert.deepEqual(affiches.files, [4, 12]);
  assert.equal(affiches.long, 28);
  assert.deepEqual([5, 9, 12, 28].map((n) => affiches.timeline(n, { end: false }).duration), [7, 11, 14, 30]);
  assert.deepEqual(skillTempos(affiches), [84, 140]);
  // 30 s at its own tempo, its most shots; at its slowest, still under 45 s, its ending card included.
  assert.deepEqual(skillFit(affiches, 30), { n: 28, bpm: 120 });
  assert.ok(affiches.timeline(28, { end: true, bpm: 84 }).duration <= 45);
  assert.ok(skillLengths(affiches).max <= 45);
  // At another tempo, every length counted in beats follows it: two beats a poster, four for its ending.
  const slow = affiches.timeline(9, { end: false, bpm: 96 });
  // 22 beats of 0,625 s, on the frame grid.
  assert.equal(slow.duration, 13.77);
  assert.deepEqual(slow.marks, { beat: 18.75, pop: 8, first: 38, ending: 338 });
  // An ending card takes its four beats (its 1,6 s and more at every tempo it plays at).
  for (const bpm of [84, 120, 140]) {
    const ended = affiches.timeline(9, { end: true, bpm });
    assert.ok(ended.duration - ended.marks.ending! / 30 >= 1.6, `${bpm} BPM`);
  }
});

test("« Tes produits en affiches »: its plan (its words by role), its music's shape, nothing cut out, followed or read", () => {
  const files = Array.from({ length: 5 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 9 }));
  const plan = skillPlan({
    skill: affiches,
    name: "Tes produits en affiches",
    files,
    fill: { shots: Array.from({ length: 9 }, (_, i) => ({ file: files[i % 5]!.id, at: Math.floor(i / 5) * 4 })), texts: { titre: "Nos douceurs de la semaine", noms: "Croissant / Éclair / Tarte / Macarons", fin: "Viens les goûter" }, end: null },
  });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 9);
  assert.deepEqual(plan.texts.map((t) => [t.style, t.text]), [["hook", "Nos douceurs de la semaine"], ["band", "Croissant / Éclair / Tarte / Macarons"], ["caption", "Viens les goûter"]]);
  assert.deepEqual(plan.skill, { key: "affiches", version: 1 });
  assert.equal(plan.tempo, 120);
  assert.equal(plan.sounds?.length ?? 0, 0);
  // Cut dead at its end (the mix's 12 ms against a click).
  assert.deepEqual(plan.music_shape?.end, { at: 11, fade: 0.012 });
  // Light to render: nothing cut out nor followed, no clear area, no reading of her shots; no zoom, no push.
  assert.deepEqual(checkMotionCode(affiches.code), []);
  assert.deepEqual([subjectsDrawn(affiches.code), objectsDrawn(affiches.code), clearsDrawn(affiches.code), readsDrawn(affiches.code)], [[], [], [], []]);
  assert.ok(affiches.code.length < 24000);
  assert.doesNotMatch(affiches.code, /transform|scale\(/);
  // Its finish keeps its contrast without film grain nor dark corners (its code lays its own still paper grain).
  assert.deepEqual(affiches.finish, { grain: 0, vignette: 0 });
  // Its title is required, its names and its call optional, each cut to its place.
  const answer = { fits: true, missing: "", shots: [{ file: "v0", at: 0 }], texts: [{ slot: "titre", text: "Nos douceurs de la semaine et du dimanche matin" }], end: null, why: "" };
  assert.deepEqual(readSkillFill(affiches, files, 5, answer)!.texts, { titre: "Nos douceurs de la semaine et du" });
  assert.equal(readSkillFill(affiches, files, 5, { ...answer, texts: [{ slot: "noms", text: "Croissant" }] }), null);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(
  frame: number,
  options: { n?: number; aspects?: number[]; texts?: Record<string, string>; settings?: Record<string, string>; brand?: Record<string, unknown>; end?: { title: string; subtitle?: string } } = {},
): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Paper: "Paper", Img: "Img", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${affiches.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const n = options.n ?? 9;
  const line = affiches.timeline(n, { end: Boolean(options.end), ...(options.settings ? { settings: options.settings } : {}) });
  const durationInFrames = Math.round(line.duration * 30);
  const words = { titre: "Nos douceurs de la semaine", noms: "Croissant / Fondant / Gâteau / Petit-déj", fin: "Viens les goûter à « la boutique »", ...options.texts };
  const roles: Record<string, string> = { titre: "hook", noms: "band", fin: "caption" };
  const reelTexts = Object.entries(words)
    .filter(([, w]) => w)
    .map(([slot, w]) => ({ text: w, role: roles[slot], from: Math.round(line.texts[slot]!.from * 30), to: Math.round(line.texts[slot]!.to * 30), emphasis: [] }));
  const shots = line.shots.map((s, i) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect: options.aspects?.[i] ?? 9 / 16 }));
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const brand = { name: "Maison Farine", displayFont: "Anton", bodyFont: "Inter Tight", accent: "#b5293f", palette: { secondary: "#1d3b2a", light: "#f4ebe1", dark: "#2a1f1a" }, ...options.brand };
  const end = options.end ? { ...options.end, from: durationInFrames - 48 } : null;
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots, reelTexts, end, texts: { ...marks, ...options.settings } });
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const boxOf = (node: Drawn) => styleOf(node) as unknown as Box;
const textOf = (node: Drawn): string => node.children.map((c) => (typeof c === "string" ? c : c && typeof c === "object" ? (Array.isArray(c) ? c.map((x) => (typeof x === "string" ? x : textOf(x as Drawn))).join("") : textOf(c as Drawn)) : "")).join("");
const fits = (tree: Drawn) => flatten(tree).filter((n) => n.type === "FitText");
const ground = (tree: Drawn) => flatten(tree).find((n) => n.type === "Paper")?.props.color;
const footage = (tree: Drawn) => flatten(tree).filter((n) => n.type === "Footage");
/** Its words' glyph boxes as the scene check measures them (the box it gives each, as tall as the font's glyph box). */
function inZone(node: Drawn) {
  const b = boxOf(node);
  const low = b.top + b.height > 960;
  assert.ok(b.top >= 80 && b.top + b.height <= 1440, `${textOf(node)}: ${JSON.stringify(b)}`);
  assert.ok(b.left >= (low ? 140 : 40) && b.left + b.width <= (low ? 940 : 1040), `${textOf(node)}: ${JSON.stringify(b)}`);
}

test("« Tes produits en affiches » draws its opening: her first shot in a wide slit on red, her title's words one every 6 images at its corners", () => {
  // The slit: 800 × 369 px, x 140 to 940 (the original's height; narrower, so its words under the middle stay in the zone).
  const at0 = drawAt(0);
  assert.equal(ground(at0), "#fc1f10");
  const [slit] = footage(at0);
  assert.deepEqual([boxOf(slit!).left, boxOf(slit!).top, boxOf(slit!).width, boxOf(slit!).height], [140, 650, 800, 369]);
  assert.equal(slit!.props.shot, 0);
  // One word more every 6 images (the original's 0, 6, 12, 18, 24), each there at once, held to the cut.
  const count = (f: number) => fits(drawAt(f)).length;
  assert.deepEqual([0, 5, 6, 11, 12, 18, 24, 29].map(count), [1, 1, 2, 2, 3, 4, 5, 5]);
  // Gone with the cut: the first poster and its own name.
  assert.deepEqual(fits(drawAt(30)).map(textOf), ["Croissant"]);
  // At its corners: top left on its left edge, top right on its right edge, then under it, the fifth lower on the right.
  const words = fits(drawAt(29));
  assert.deepEqual(words.map(textOf), ["Nos", "douceurs", "de", "la", "semaine"]);
  const [tl, tr, bl, br, fifth] = words.map(boxOf);
  assert.equal(tl!.left, 140);
  assert.equal(tr!.left + tr!.width, 940);
  assert.equal(bl!.left, 140);
  assert.equal(br!.left + br!.width, 940);
  assert.equal(fifth!.left + fifth!.width, 940);
  assert.ok(tl!.top + tl!.height / 2 < 650 && bl!.top + bl!.height / 2 > 1019 && fifth!.top > bl!.top + 150, JSON.stringify(words.map(boxOf)));
  const inner = (node: Drawn) => node.props.innerStyle as Record<string, string | number>;
  assert.deepEqual(words.map((w) => inner(w).alignItems), ["flex-start", "flex-end", "flex-start", "flex-end", "flex-end"]);
  // In capitals, in her title font (Anton, set at its one weight), the original's black ink on red; every one in the zone.
  assert.ok(words.every((w) => inner(w).textTransform === "uppercase" && String(inner(w).fontFamily).startsWith("'Anton'") && inner(w).fontWeight === 400 && inner(w).color === "#0d0b0b"));
  words.forEach(inZone);
  // All one size, as the original's (capitals 4,8 % of the height: 92 px, their box 0,58 of it); a row's two words share
  // its width by their lengths.
  assert.equal(new Set(words.map((w) => boxOf(w).height)).size, 1);
  assert.equal(boxOf(words[0]!).height, Math.round(92 / 0.58));
  assert.equal(tl!.width + tr!.width, 776);
  assert.ok(tl!.width < tr!.width, "« Nos » takes less of its row than « douceurs »");
  // Two words: top left and bottom right, each alone on its row; three: the top two and bottom left.
  const two = fits(drawAt(29, { texts: { titre: "Nouvelle carte" } }));
  assert.deepEqual(two.map((w) => [boxOf(w).left, boxOf(w).left + boxOf(w).width, inner(w).alignItems, boxOf(w).top > 960]), [[140, 940, "flex-start", false], [140, 940, "flex-end", true]]);
  assert.equal(fits(drawAt(29, { texts: { titre: "La carte du soir" } })).length, 4);
  const three = fits(drawAt(29, { texts: { titre: "Mes bouquets fanés" } }));
  assert.deepEqual(three.map((w) => [boxOf(w).left, boxOf(w).left + boxOf(w).width, boxOf(w).top > 960]), [[140, 140 + boxOf(three[0]!).width, false], [940 - boxOf(three[1]!).width, 940, false], [140, 940, true]]);
  // A row too long for the slit at that size: every word smaller, all alike.
  const long = fits(drawAt(29, { texts: { titre: "Croissanterie pâtisseries maison artisanale" } }));
  assert.ok(boxOf(long[0]!).height < boxOf(words[0]!).height && new Set(long.map((w) => boxOf(w).height)).size === 1, JSON.stringify(long.map(boxOf)));
  long.forEach(inZone);
  // A font with its weights gets a heavy one.
  assert.equal((fits(drawAt(0, { brand: { displayFont: "Inter Tight" } }))[0]!.props.innerStyle as Record<string, number>).fontWeight, 800);
});

test("« Tes produits en affiches » draws a poster a shot: her picture in a white print on the original's colours, at its places, her names on the labelled ones", () => {
  // Its grounds in the original's order, one a poster.
  assert.deepEqual([30, 60, 90, 120, 150, 180, 210, 240].map((f) => ground(drawAt(f))), ["#fc1f10", "#0052b9", "#ff6127", "#ffa7af", "#97989b", "#060608", "#2391d6", "#ffc91b"]);
  // Only the shot on screen, in its print (its white paper around it), framed in it.
  const poster = (f: number, o: Parameters<typeof drawAt>[1] = {}) => {
    const tree = drawAt(f, o);
    const print = flatten(tree).find((n) => n.props.key === "print")!;
    const pic = footage(tree)[0]!;
    return { tree, print: boxOf(print), pic: boxOf(pic), shot: pic.props.shot, paper: styleOf(print).backgroundColor, names: fits(tree) };
  };
  const a = poster(45);
  assert.equal(a.shot, 1);
  assert.equal(a.paper, "#f4f0ec");
  assert.ok(a.pic.left > a.print.left && a.pic.top > a.print.top && a.pic.left + a.pic.width < a.print.left + a.print.width, JSON.stringify(a));
  // An upright video in a print in portrait (4:5); the original's square places square; a horizontal one in width (4:3).
  assert.ok(Math.abs(a.pic.width / a.pic.height - 0.8) < 0.01, JSON.stringify(a.pic));
  const b = poster(75);
  assert.ok(Math.abs(b.pic.width / b.pic.height - 1) < 0.01);
  assert.ok(Math.abs(poster(45, { aspects: [9 / 16, 16 / 9] }).pic.width / poster(45, { aspects: [9 / 16, 16 / 9] }).pic.height - 4 / 3) < 0.01);
  assert.ok(Math.abs(poster(45, { aspects: [9 / 16, 16 / 9], settings: { format: "vertical" } }).pic.width / poster(45, { aspects: [9 / 16, 16 / 9], settings: { format: "vertical" } }).pic.height - 0.8) < 0.01);
  assert.ok(Math.abs(poster(75, { settings: { format: "horizontal" } }).pic.width / poster(75, { settings: { format: "horizontal" } }).pic.height - 4 / 3) < 0.01);
  // Two cut by an edge of the frame, as the original's C (by the left) and D (by the top).
  assert.ok(poster(105).print.left < 0);
  assert.ok(poster(135).print.top < 0);
  // Its names: the first, the last and one in two, the k-th name on the k-th of them, in very big capitals in the zone.
  const named = [45, 75, 105, 135, 165, 195, 225, 255].map((f) => poster(f).names.map(textOf));
  assert.deepEqual(named, [["Croissant"], [], [], ["Fondant"], [], ["Gâteau"], [], ["Petit-déj"]]);
  for (const f of [45, 135, 195, 255]) {
    const { names, print, pic } = poster(f);
    const name = names[0]!;
    inZone(name);
    // On the print's paper, under its picture.
    const box = boxOf(name);
    assert.ok(box.top + box.height / 2 > pic.top + pic.height && box.top + box.height / 2 < print.top + print.height, `${textOf(name)}: ${JSON.stringify({ box, pic, print })}`);
    const style = name.props.innerStyle as Record<string, string | number>;
    assert.ok(style.textTransform === "uppercase" && style.color === "#110c0d" && Number(style.fontSize) >= 48, JSON.stringify(style));
  }
  // The original's F, low in the frame: raised as far as its name needs.
  assert.ok(boxOf(poster(195).names[0]!).top + boxOf(poster(195).names[0]!).height <= 1440);
  // Every poster named when her words ask for it; none without names.
  assert.deepEqual([45, 75, 105].map((f) => poster(f, { settings: { etiquettes: "toutes" }, texts: { noms: "Croissant / Éclair / Tarte" } }).names.map(textOf)), [["Croissant"], ["Éclair"], ["Tarte"]]);
  assert.deepEqual(poster(45, { texts: { noms: "" } }).names, []);
  // Her names written whole for the scene check: an unseen copy of her list while the posters play.
  const copy = flatten(drawAt(45)).find((n) => n.props.key === "names-copy")!;
  assert.equal(textOf(copy), "Croissant / Fondant / Gâteau / Petit-déj");
  assert.ok("data-fauve-decor" in copy.props && styleOf(copy).opacity === 0);
});

test("« Tes produits en affiches »: her charter's colours or black as her words ask, its ink read on each ground", () => {
  const grounds = (settings: Record<string, string>, brand?: Record<string, unknown>) => [30, 60, 90, 120].map((f) => ground(drawAt(f, { settings, ...(brand ? { brand } : {}) })));
  assert.deepEqual(grounds({ couleurs: "sa-charte" }), ["#b5293f", "#1d3b2a", "#2a1f1a", "#f4ebe1"]);
  assert.deepEqual(grounds({ couleurs: "noir" }), ["#060608", "#060608", "#060608", "#060608"]);
  // Fewer than two colours of hers: the original's.
  assert.deepEqual(grounds({ couleurs: "sa-charte" }, { accent: "#b5293f", palette: {} }), ["#fc1f10", "#0052b9", "#ff6127", "#ffa7af"]);
  // Its title in white on a dark ground, black on a light one.
  const ink = (settings: Record<string, string>) => (fits(drawAt(0, { settings }))[0]!.props.innerStyle as Record<string, string>).color;
  assert.equal(ink({ couleurs: "noir" }), "#f7f5f2");
  assert.equal(ink({ couleurs: "vives" }), "#0d0b0b");
  assert.deepEqual(affiches.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["couleurs", ["vives", "sa-charte", "noir"]], ["format", ["auto", "vertical", "horizontal"]], ["etiquettes", ["une-sur-deux", "toutes"]]]);
});

test("« Tes produits en affiches »: its ending on black, her call in white capitals with a word in bold italic, her name without it, her card and logo with it", () => {
  const ending = drawAt(275);
  assert.equal(footage(ending).length, 0);
  assert.ok(flatten(ending).some((n) => n.props.key === "black" && styleOf(n).backgroundColor === "#000000"));
  const [call] = fits(ending);
  assert.equal(textOf(call!), "Viens les goûter à « la boutique »");
  inZone(call!);
  const style = call!.props.innerStyle as Record<string, string>;
  assert.ok(style.color === "#f7f7f7" && style.textTransform === "uppercase" && String(style.fontFamily).startsWith("'Inter Tight'"));
  // Her stressed word in bold italic.
  assert.ok(flatten(call!).some((n) => n.type === "span" && styleOf(n).fontStyle === "italic" && textOf(n) === "« la boutique »"));
  // Without a call: her name.
  assert.equal(textOf(fits(drawAt(275, { texts: { fin: "" } }))[0]!), "Maison Farine");
  // Her ending card on the black from its start, its line under it, her logo over it (white when it is a dark one-colour logo).
  const card = drawAt(272, { end: { title: "Ouvert dimanche", subtitle: "de 8 h à 13 h" }, brand: { logoUrl: "/logo.png", logoOnDark: "white" } });
  assert.deepEqual(fits(card).map(textOf), ["Ouvert dimanche", "de 8 h à 13 h"]);
  fits(card).forEach(inZone);
  const logo = flatten(card).find((n) => n.type === "Img")!;
  assert.equal(styleOf(logo).filter, "brightness(0) invert(1)");
  // Before the ending, the last poster.
  assert.equal(footage(drawAt(269))[0]!.props.shot, 8);
});
