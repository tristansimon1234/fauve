import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillLengths, skillPlan } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { courtMetrage, rollShot } from "./court-metrage.ts";

// « Court métrage », the model (court-metrage.ts, version 2), on its original's fiche (docs/fiches/court-metrage.md).

/** Its light, drawn on her shots (v2: the original's golden print). */
const GOLDEN = "sepia(0.45) saturate(1.7) contrast(1.05) brightness(0.93)";

/** The original's cuts, the first image of each new picture (its burn's cut, then a bar each, its roll on the fifth). */
const ORIGINAL_CUTS = [120, 205, 288, 372, 456, 541, 626];

test("« Court métrage » (v1, v2): its eight shots on its original's cuts (85,5 BPM), its title on beat 3, its fade, 24,4 s", () => {
  assert.equal(courtMetrage.version, 2);
  assert.equal(courtMetrage.bpm, 85.5);
  const line = courtMetrage.timeline(8, { end: false });
  // 732 images, the original's; each cut within an image of the original's.
  assert.equal(line.shots.length, 8);
  assert.equal(Math.round(line.duration * 30), 732);
  const cuts = line.shots.slice(1).map((s) => Math.round(s.start * 30));
  cuts.forEach((c, i) => assert.ok(Math.abs(c - ORIGINAL_CUTS[i]!) <= 1, `cut ${i + 1}: ${c} for ${ORIGINAL_CUTS[i]}`));
  // Its title card for four images (the cover), black, its slit open two images before its title (beat 3, image 78:
  // the original's 77), the film slipping onto its sixth shot, its fade to black over images 717 to 731.
  assert.deepEqual(line.marks, { cover: 4, open: 76, title: 78, roll: 5, fade: 717, black: 731 });
  assert.ok(Object.values(line.texts).every((t) => t.from === 0 && Math.abs(t.to - 4) < 0.01));
  // No music under its opening: it comes in on the first cut (a late start on its downbeat), without its bass for a bar
  // and around the roll (the original's bass out at 13,9 s and back at 18,04 s), faded with the picture.
  const music = line.music!;
  assert.deepEqual(music.pauses, [{ from: 0, to: 4 }]);
  assert.equal(music.downbeat, 4);
  assert.equal(music.filters!.length, 2);
  assert.ok(music.filters!.every((f) => f.kind === "thin"));
  assert.ok(Math.abs(music.filters![0]!.to - 205 / 30) < 0.05);
  assert.ok(Math.abs(music.filters![1]!.from - 13.9) < 0.1 && Math.abs(music.filters![1]!.to - 18.04) < 0.05, JSON.stringify(music.filters));
  assert.ok(music.end!.at === line.duration && Math.abs(music.end!.fade! - 0.5) < 0.01);
  // A projector: its click on the black (image 4), running under the slit, a click on the title (the original's at
  // 2,54 s), its film fluttering as it slips (the original's first burst at 14,95 s).
  const sounds = line.sounds!;
  assert.deepEqual(sounds.map((s) => s.sound), ["film projector switch click", "old film projector running", "film projector click", "film reel flutter"]);
  assert.ok(Math.abs(sounds[0]!.at - 4 / 30) < 0.005 && Math.abs(sounds[2]!.at - 2.54) < 0.07 && Math.abs(sounds[3]!.at - 14.95) < 0.05, JSON.stringify(sounds));
});

test("« Court métrage »: four to twelve shots, the roll after four of hers or onto her last one, never past 45 s", () => {
  assert.deepEqual([4, 5, 6, 7, 8, 12].map(rollShot), [3, 4, 5, 5, 5, 5]);
  // Fewer than seven: the film slips onto her last shot, which keeps its bass to its fade.
  const four = courtMetrage.timeline(4, { end: false });
  assert.equal(four.marks.roll, 3);
  assert.equal(four.music!.filters!.length, 1);
  assert.ok(Math.abs(four.duration - 13.17) < 0.02);
  // Up to twelve for a length she asks for; at its slowest tempo with an ending card, 45 s at most.
  assert.equal(courtMetrage.long, 12);
  assert.ok(Math.abs(courtMetrage.timeline(12, { end: false }).duration - 35.63) < 0.02);
  assert.ok(courtMetrage.timeline(12, { end: true, bpm: 72 }).duration <= 45);
  assert.ok(skillLengths(courtMetrage).max <= 45);
  // An ending card: its last shot longer by whole beats (1,6 s at least), its fade before the card, its music to the end.
  const line = courtMetrage.timeline(8, { end: false });
  const ended = courtMetrage.timeline(8, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6);
  assert.equal(ended.marks.fade, line.marks.fade);
  assert.ok(ended.marks.black! < Math.round((ended.duration - 1.6) * 30));
  assert.equal(ended.music!.end!.at, ended.duration);
  // At another tempo, every landmark counted in beats follows it.
  const slow = courtMetrage.timeline(8, { end: false, bpm: 72 });
  assert.ok(Math.abs(slow.marks.title! / line.marks.title! - 85.5 / 72) < 0.02);
  assert.ok(Math.abs(slow.shots[1]!.start / line.shots[1]!.start - 85.5 / 72) < 0.01);
});

test("« Court métrage »: its plan (its words by role, its sounds, its music's shape), nothing cut out, one reading of its first shot", () => {
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12, aspect: 16 / 9 }));
  const plan = skillPlan({
    skill: courtMetrage,
    name: "Court métrage",
    files,
    fill: { shots: files.map((f) => ({ file: f.id, at: 1 })), texts: { surtitre: "un matin", titre: "Café Lumière", signature: "un film de Léa" }, end: null },
  });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.texts.map((t) => [t.style, t.text]), [["band", "un matin"], ["hook", "Café Lumière"], ["caption", "un film de Léa"]]);
  assert.equal(plan.sounds?.length, 4);
  assert.deepEqual(plan.music_shape?.pauses, [{ from: 0, to: 4 }]);
  assert.deepEqual(plan.skill, { key: "court-metrage", version: 2 });
  // Light to render: nothing cut out nor followed, no clear area; its first shot's light read under its title.
  assert.deepEqual(checkMotionCode(courtMetrage.code), []);
  assert.deepEqual([subjectsDrawn(courtMetrage.code), objectsDrawn(courtMetrage.code), clearsDrawn(courtMetrage.code)], [[], [], []]);
  assert.deepEqual(readsDrawn(courtMetrage.code), [{ shot: 0, kinds: ["light"] }]);
  assert.ok(courtMetrage.code.length < 24000);
  assert.doesNotMatch(courtMetrage.code, /transform|scale\(/);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, options: { aspect?: number; texts?: Record<string, string>; reel?: { text: string; role: string }[]; brand?: Record<string, unknown>; light?: number | null; end?: unknown; n?: number; end_card?: boolean } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Burn: "Burn",
    useCurrentFrame: () => frame,
    LightUnder: () => (options.light === undefined || options.light === null ? null : { mean: options.light, high: options.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${courtMetrage.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const line = courtMetrage.timeline(options.n ?? 8, { end: Boolean(options.end_card) });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const durationInFrames = Math.round(line.duration * 30);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 16 / 9, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const reelTexts = (options.reel ?? [
    { text: "un matin", role: "band" },
    { text: "Café Lumière", role: "hook" },
    { text: "un film de Léa", role: "caption" },
  ]).map((t) => ({ ...t, from: 0, to: 120, emphasis: [] }));
  const brand = { name: "Café Lumière", displayFont: "Cormorant Garamond", bodyFont: "Cormorant Garamond", accent: "#e8b4a0", palette: { light: "#f6efe4", dark: "#1d1b19" }, ...options.brand };
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots, reelTexts, end: options.end ?? null, texts: { ...marks, ...options.texts } });
}

const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const textOf = (node: Drawn): string => nodes(node).map((n) => (n.children.flat(Infinity) as unknown[]).filter((c): c is string => typeof c === "string").join("")).join(" ").replace(/\s+/g, " ").trim();
const gateOf = (tree: Drawn) => nodes(tree).find((n) => n.props.key === "gate")!;
const keyed = (tree: Drawn, key: string) => nodes(tree).find((n) => n.props.key === key) ?? null;
const fits = (tree: Drawn) => nodes(tree).filter((n) => n.type === "FitText");

test("« Court métrage » draws its title card first, black, its slit opening at an even pace, its title cut in on beat 3", () => {
  // Its first four images: the whole picture and its three lines (the cover a feed shows).
  for (const f of [0, 3]) {
    assert.equal(styleOf(keyed(drawAt(f), "shown")!).clipPath, undefined);
    assert.deepEqual(fits(drawAt(f)).map(textOf), ["un matin", "CAFÉ LUMIÈRE", "un film de Léa"]);
  }
  // Black on image 4, then two black bars part from its middle at an even pace to image 76.
  const inset = (f: number) => {
    const clip = styleOf(keyed(drawAt(f), "shown")!).clipPath;
    return clip === undefined ? 0 : Number(/inset\((\d+)px/.exec(String(clip))![1]);
  };
  assert.equal(fits(drawAt(4)).length, 0);
  assert.ok(inset(4) >= Math.floor(557 / 2), String(inset(4)));
  const steps = [10, 20, 30, 40, 50, 60].map((f) => inset(f) - inset(f + 10));
  assert.ok(steps.every((s) => Math.abs(s - steps[0]!) <= 1), steps.join(" "));
  assert.equal(inset(76), 0);
  // Its title cuts in whole on image 78 (beat 3), all three lines at once, and goes with the cut under its burn (120).
  assert.equal(fits(drawAt(77)).length, 0);
  assert.equal(fits(drawAt(78)).length, 3);
  assert.equal(fits(drawAt(119)).length, 3);
  assert.equal(fits(drawAt(120)).length, 0);
  // Its title on two lines, its small word and its credit small labels beside it (a 5-word credit reads at 48 px).
  const title = fits(drawAt(90))[1]!;
  assert.equal(title.children.flat().length, 2);
  assert.ok(nodes(fits(drawAt(90))[0]!).some((n) => "data-fauve-accent" in n.props));
  const long = fits(drawAt(90, { reel: [{ text: "Café Lumière", role: "hook" }, { text: "un film de toute l'équipe", role: "caption" }] }));
  assert.equal(long.length, 2);
  assert.ok(Number((long[1]!.props.innerStyle as { fontSize: number }).fontSize) >= 48);
  assert.ok(!nodes(long[1]!).some((n) => "data-fauve-accent" in n.props));
});

test("« Court métrage »: its burn onto the first cut, the film slipping onto its sixth shot, a blank burnt image, its fade", () => {
  // Its burn: light laid around the first cut, from the left to its pale yellow height an image before it.
  const burn = nodes(drawAt(110)).find((n) => n.props.key === "burn")!;
  assert.equal(burn.type, "Burn");
  assert.equal(burn.props.at, 120);
  const steps = burn.props.steps as [number, string, number][];
  assert.deepEqual(steps.map((s) => s[0]), [-5, -4, -3, -2, -1, 0, 1, 2, 3]);
  assert.equal(steps[4]![1], "#ece18f");
  // The roll onto its sixth shot (image 457): six images of the strip, its frame lines where the original's were, the
  // shot that goes in both frames until the cut, the next one from it.
  const ROLL = 457;
  assert.equal(keyed(drawAt(ROLL - 5), "strip"), null);
  const lines = [0.315, 0.213, 0.908, 0.825, 0.105, 0.814];
  for (let k = 0; k < 6; k++) {
    const tree = drawAt(ROLL - 4 + k);
    const strip = keyed(tree, "strip")!;
    assert.ok(strip, `image ${ROLL - 4 + k}`);
    const up = styleOf(nodes(strip).find((n) => n.props.key === "up")!);
    const down = styleOf(nodes(strip).find((n) => n.props.key === "down")!);
    assert.ok(Math.abs(Number(up.top) + 557 - lines[k]! * 557) <= 1 && Number(down.top) - (Number(up.top) + 557) === 46, `${up.top} ${down.top}`);
    assert.ok(Number(up.left) === 27 && Number(up.width) === 1080 - 54);
    const shot = nodes(strip).filter((n) => n.type === "Footage").map((n) => n.props.shot);
    assert.deepEqual(shot, k < 4 ? [4, 4] : [5, 5]);
    // Its sprocket holes, cream, on the left edge at each frame's middle.
    assert.equal(nodes(strip).filter((n) => styleOf(n).backgroundColor === "#aea87b").length, 2);
  }
  assert.equal(keyed(drawAt(ROLL + 2), "strip"), null);
  assert.equal(styleOf(keyed(drawAt(ROLL + 2), "blank")!).backgroundColor, "#ebe5bb");
  assert.equal(keyed(drawAt(ROLL + 3), "blank"), null);
  const roll = nodes(drawAt(ROLL)).find((n) => n.props.key === "roll")!;
  assert.deepEqual((roll.props.steps as [number][]).map((s) => s[0]), [-5, 3, 4]);
  // Its fade to black: from image 717, black on 731.
  const fade = (f: number) => {
    const d = keyed(drawAt(f), "fade");
    return d ? Number(styleOf(d).opacity) : 0;
  };
  assert.equal(fade(716), 0);
  assert.ok(Math.abs(fade(724) - 0.5) < 0.01);
  assert.equal(fade(731), 1);
});

test("« Court métrage »: its gate as her videos (1,94:1 in width, else the frame), its words in the safe zone, its colours", () => {
  // Her videos in width: the gate across the width, 1,94:1, at the middle, its corners rounded; upright: the frame but
  // its margins; her word over it.
  assert.deepEqual([styleOf(gateOf(drawAt(90))).top, styleOf(gateOf(drawAt(90))).height, styleOf(gateOf(drawAt(90))).borderRadius], [682, 557, 45]);
  assert.deepEqual([styleOf(gateOf(drawAt(90, { aspect: 9 / 16 }))).top, styleOf(gateOf(drawAt(90, { aspect: 9 / 16 }))).height], [81, 1759]);
  assert.equal(styleOf(gateOf(drawAt(90, { aspect: 9 / 16, texts: { format: "horizontal" } }))).height, 557);
  assert.equal(styleOf(gateOf(drawAt(90, { texts: { format: "vertical" } }))).height, 1759);
  // Every word to read inside the safe zone, left of the apps' buttons below the middle, in both formats.
  for (const aspect of [16 / 9, 9 / 16]) {
    const tree = drawAt(90, { aspect });
    const top = Number(styleOf(gateOf(tree)).top);
    for (const t of fits(tree)) {
      const b = styleOf(t) as unknown as Box;
      const y = top + b.top;
      assert.ok(y >= 80 && y + b.height <= 1440, `${textOf(t)}: ${y}`);
      if (y + b.height > 960) assert.ok(b.left >= 140 && b.left + b.width <= 940, `${textOf(t)}: ${b.left} ${b.width}`);
    }
  }
  // Its lemon yellow; her colour when she asks and it reads on a dark picture (else her light one); a warm white.
  const color = (texts: Record<string, string> = {}, brand: Record<string, unknown> = {}) => (fits(drawAt(90, { texts, brand }))[1]!.props.innerStyle as { color: string }).color;
  assert.equal(color(), "#f2ea4a");
  assert.equal(color({ couleur: "sienne" }), "#e8b4a0");
  assert.equal(color({ couleur: "sienne" }, { accent: "#1d3b2a" }), "#f6efe4");
  assert.equal(color({ couleur: "blanc" }), "#f4f1e8");
  // Her first shot dimmed under her title when it is bright there, from its first image to the cut; not when it is
  // dark; always in its golden light (v2), or as filmed when she asks.
  assert.equal(styleOf(keyed(drawAt(10, { light: 0.7 }), "shown")!).filter, `${GOLDEN} brightness(0.600)`);
  assert.equal(styleOf(keyed(drawAt(10, { light: 0.3 }), "shown")!).filter, GOLDEN);
  assert.equal(styleOf(keyed(drawAt(130, { light: 0.7 }), "shown")!).filter, GOLDEN);
  assert.equal(styleOf(keyed(drawAt(10, { light: 0.7, texts: { lumiere: "naturelle" } }), "shown")!).filter, "brightness(0.600)");
  assert.equal(styleOf(keyed(drawAt(130, { texts: { lumiere: "naturelle" } }), "shown")!).filter, undefined);
  // The film roll's two frames in its light too; its soft black, its words and its burns never under it.
  const roll = keyed(drawAt(455), "strip")!;
  assert.ok(nodes(roll).filter((n) => n.props.key === "up" || n.props.key === "down").every((n) => styleOf(n).filter === GOLDEN));
  assert.equal(styleOf(gateOf(drawAt(90))).filter, undefined);
  assert.ok(fits(drawAt(90)).every((t) => !("filter" in styleOf(t))));
  // Its model's finish laid over nothing of its own: its code draws its light.
  assert.deepEqual(courtMetrage.finish, { exposure: 0, contrast: 0, saturation: 0, warmth: 0, split: 0, fade: 0, grain: 0, vignette: 0 });
  assert.deepEqual(courtMetrage.settings?.map((s) => [s.name, s.choices[0]!.value]), [["format", "auto"], ["couleur", "jaune"], ["lumiere", "doree"]]);
});

test("« Court métrage » (v2): its title card in a display serif of strong contrast, its small word a little spaced, its credit roman", () => {
  // Measured on its original's letters (docs/fiches/court-metrage.md, effect 2): no italic anywhere, its title at its
  // regular weight (its stems 0,17 of its capitals), its small word spaced 0,1 em (not 0,22), Noto Serif Display when her
  // charter has no font.
  const [label, title, credit] = fits(drawAt(90)).map((t) => t.props.innerStyle as Record<string, string | number>);
  assert.equal(label!.letterSpacing, "0.1em");
  assert.deepEqual([title!.fontWeight, title!.fontSize, title!.lineHeight], [500, 73, 0.84]);
  assert.equal(credit!.fontStyle, undefined);
  assert.match(String(title!.fontFamily), /'Cormorant Garamond', 'Noto Serif Display'/);
  assert.match(String(credit!.fontFamily), /'Noto Serif Display'/);
  // A third larger upright.
  const up = fits(drawAt(90, { aspect: 9 / 16 }))[1]!.props.innerStyle as { fontSize: number };
  assert.equal(up.fontSize, 95);
  assert.doesNotMatch(courtMetrage.code, /italic/);
});

test("« Court métrage »: its ending card on the black after the fade, in its serif and its small roman, readable", () => {
  const line = courtMetrage.timeline(8, { end: true });
  const from = Math.round((line.duration - 1.6) * 30);
  const end = { title: "Ouvert dès 8 h", subtitle: "12 rue des Martyrs", from };
  assert.equal(keyed(drawAt(from - 1, { end, end_card: true }), "end"), null);
  const card = fits(drawAt(from + 12, { end, end_card: true }));
  // Its title in capitals, an hour keeping its small h.
  assert.deepEqual(card.map(textOf), ["OUVERT DÈS 8 h", "12 rue des Martyrs"]);
  assert.ok(card.every((t) => Number((t.props.innerStyle as { fontSize: number }).fontSize) >= 48));
  assert.equal(Number(styleOf(keyed(drawAt(from, { end, end_card: true }), "fade")!).opacity), 1);
});
