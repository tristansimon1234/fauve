import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { skillPlan } from "../skills.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { nomDeVille } from "./nom-de-ville.ts";

// « Nom aux cinq polices » (skills/nom-de-ville.ts), on its original's fiche (docs/fiches/nom-de-ville.md).

/** The original's cuts (images at 30 i/s): its first section on its first piece's beats, then the rest. */
const FIRST_CUTS = [68, 82, 94, 106, 119];
const LATER_CUTS = [190, 218, 250, 274, 294, 322, 344, 385, 414];
/** Its typeface changes (images 18, 30, 44, 55) and its last image (14,73 s). */
const FACES = [18, 30, 44, 55];
const END = 442;

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };
type Reads = { skyline?: (frame: number, span: { from: number; to: number }) => number | null; clear?: { x: number; y: number; w: number; h: number } | null; light?: number | null };

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
const textOf = (node: Drawn): string => node.children.map((c) => (typeof c === "string" ? c : c && typeof c === "object" ? textOf(c as Drawn) : "")).join("");

/** Its Scene drawn at a frame with a plain tree for React (no renderer), its readings as the test gives them. */
function drawAt(frame: number, props: { shots?: { from: number; durationInFrames: number; aspect: number }[]; reelTexts?: unknown[]; texts?: Record<string, string>; brand?: Record<string, unknown>; end?: unknown; durationInFrames?: number; reads?: Reads }): Drawn {
  const reads = props.reads ?? {};
  // Its children as React reads them: nested arrays flattened, nothing drawn for null.
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Skyline: "Skyline",
    Img: "Img",
    useCurrentFrame: () => frame,
    SkylineAt: (_shot: unknown, f: number, _laid: unknown, span: { from: number; to: number }) => (reads.skyline ? reads.skyline(f, span) : null),
    ClearBox: (_shot: unknown, _f: number, _laid: unknown, options: { fallback?: unknown }) => reads.clear ?? options.fallback ?? null,
    LightUnder: () => (reads.light === undefined || reads.light === null ? null : { mean: reads.light, high: reads.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${nomDeVille.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: props.durationInFrames ?? END - 1,
    brand: { name: "Maison Farine", displayFont: "Anton", bodyFont: "Inter Tight", accent: "#fd4c4c", palette: { secondary: "#1d3b2a", light: "#f4efe9", dark: "#1d1d1b" }, ...props.brand },
    shots: props.shots ?? shotsOf(nomDeVille.timeline(15, { end: false }).shots, 16 / 9),
    reelTexts: props.reelTexts ?? WORDS,
    end: props.end ?? null,
    // « Comme ses vidéos » unless said (her words: « comme mes vidéos »): its 16:9 frame for her horizontal videos.
    texts: { ...marksOf(), format: "auto", ...props.texts },
  });
}

/** Its timeline's shots as its code gets them (frames), each of one shape. */
const shotsOf = (spans: { start: number; end: number }[], aspect: number) => spans.map((s) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect }));
const marksOf = (line = nomDeVille.timeline(15, { end: false })) => Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
/** Her words on her first shot: her small words, her name, her signature. */
const WORDS = [
  { text: "les rues de", role: "caption", from: 0, to: 68, emphasis: [] },
  { text: "Belleville", role: "hook", from: 0, to: 68, emphasis: [] },
  { text: "par Maison Farine", role: "caption", from: 0, to: 68, emphasis: [] },
];
const title = (tree: Drawn) => flatten(tree).find((n) => String(n.props.key).startsWith("title-")) ?? null;
/** The name's five faces at that frame: each one's family, whether it shows, its colour. */
function faces(tree: Drawn) {
  const grid = flatten(tree).find((n) => n.props.key === "name")!;
  return (grid.children as Drawn[]).map((f) => ({ family: String(styleOf(f).fontFamily).split(",")[0]!.replace(/'/g, ""), shown: styleOf(f).visibility === "visible", color: styleOf(f).color, text: textOf(f) }));
}
const shownFace = (tree: Drawn) => faces(tree).find((f) => f.shown)!.family;

test("« Nom aux cinq polices » (v2): 15 shots on its original's first grid (142,4 BPM, one beat in two), its faces on beats 1 to 4, its music dropped and back", () => {
  assert.equal(nomDeVille.version, 2);
  assert.equal(nomDeVille.bpm, 71.2);
  const line = nomDeVille.timeline(15, { end: false });
  assert.equal(line.shots.length, 15);
  // 14,70 s: the original's 442 images within one.
  assert.ok(Math.abs(line.duration * 30 - END) <= 1, `${line.duration} s`);
  // Its first section on its first piece's beats, each cut within an image of the original's; the rest on our grid,
  // within three images of the original's (its second piece is at 150,5 BPM).
  const cuts = line.shots.slice(1).map((s) => Math.round(s.start * 30));
  cuts.slice(0, 5).forEach((c, i) => assert.ok(Math.abs(c - FIRST_CUTS[i]!) <= 1, `cut ${i + 1}: image ${c}, the original's ${FIRST_CUTS[i]}`));
  cuts.slice(5).forEach((c, i) => assert.ok(Math.abs(c - LATER_CUTS[i]!) <= 3, `cut ${i + 6}: image ${c}, the original's ${LATER_CUTS[i]}`));
  // Every cut on a beat of the original's first piece (half a beat of ours) from its first beat at 0,17 s.
  const half = 30 / 71.2;
  for (const s of line.shots.slice(1)) {
    const beats = (s.start - 0.17) / half;
    assert.ok(Math.abs(beats - Math.round(beats * 2) / 2) * half <= 1 / 30 + 0.005, `${s.start} s on its grid`);
  }
  // Its typeface changes on beats 1, 2 and 3 and lands on beat 4: the original's images 18, 30, 44 and 55, within one.
  [line.marks.f1!, line.marks.f2!, line.marks.f3!, line.marks.land!].forEach((m, i) => assert.ok(Math.abs(m - FACES[i]!) <= 1, `face ${i + 1}: image ${m}, the original's ${FACES[i]}`));
  // Its music: its first beat at 0,17 s; without its bass until the alley's cut (beat 9), stopped a beat later (10¼)
  // with its sound ringing on, back on beat 16, a whole beat of ours from its first; cut dead with the picture.
  const music = line.music!;
  assert.ok(Math.abs(music.downbeat! - 0.17) < 0.005);
  assert.deepEqual(music.filters!.map((f) => f.kind), ["thin"]);
  assert.ok(Math.abs(music.filters![0]!.to - line.shots[5]!.start) <= 1 / 30, JSON.stringify(music.filters));
  const pause = music.pauses![0]!;
  assert.ok(Math.abs(pause.from - 4.49) < 0.02 && Math.abs(pause.to - 6.91) < 0.02 && pause.tail === 2.4, JSON.stringify(pause));
  const ours = (pause.to - music.downbeat!) / (60 / 71.2);
  assert.ok(Math.abs(ours - Math.round(ours)) < 0.01, `its return on beat ${ours} of ours`);
  // It comes back inside the shot passing the lens, as the original's 7,04 s inside its 6,33 – 7,27 s.
  assert.ok(pause.to > line.shots[6]!.start && pause.to < line.shots[6]!.end);
  assert.deepEqual(music.end, { at: line.duration, fade: 0.012 });
  // Its two sounds: the drop on the alley's cut, a whoosh rising into the return.
  assert.equal(line.sounds!.length, 2);
  assert.ok(Math.abs(line.sounds![0]!.at - line.shots[5]!.start) <= 1 / 30 && /bass hit/.test(line.sounds![0]!.sound));
  assert.ok(Math.abs(line.sounds![1]!.at - pause.to) < 0.005 && /rising whoosh/.test(line.sounds![1]!.sound));
  // Her words on her first shot, to its cut.
  assert.deepEqual(Object.keys(line.texts), ["surtitre", "nom", "signature"]);
  assert.ok(Object.values(line.texts).every((t) => t.from === 0 && t.to === line.shots[0]!.end));
});

test("« Nom aux cinq polices »: 8 to 15 shots from her files, up to 30 for a length she asks for, an ending card after its last shot, any tempo", () => {
  // Its eight shots at least: the title, four, the alley, the shot passing the lens, the last (8,2 s).
  const fewest = nomDeVille.timeline(8, { end: false });
  assert.equal(fewest.shots.length, 8);
  assert.ok(Math.abs(fewest.duration - 8.17) < 0.05, `${fewest.duration} s`);
  assert.equal(nomDeVille.timeline(3, { end: false }).shots.length, 8);
  // Up to 30 (the life of the place repeating its pattern): 29 s, never past 45 at its slowest.
  const longest = nomDeVille.timeline(30, { end: true });
  assert.equal(longest.shots.length, 30);
  assert.ok(nomDeVille.timeline(30, { end: false }).duration <= 30 && nomDeVille.timeline(30, { end: true, bpm: 60 }).duration <= 45);
  // An ending card: its last shot held 1,6 s more at least, on whole half-beats; the music's end follows.
  const line = nomDeVille.timeline(15, { end: false });
  const ended = nomDeVille.timeline(15, { end: true });
  assert.ok(ended.duration - line.duration >= 2.5 && ended.music!.end!.at === ended.duration);
  assert.deepEqual(ended.shots.slice(0, 14), line.shots.slice(0, 14));
  // At another tempo, all of it follows.
  const slower = nomDeVille.timeline(15, { end: false, bpm: 64 });
  assert.ok(Math.abs(slower.duration / line.duration - 71.2 / 64) < 0.01);
  assert.ok(Math.abs(slower.marks.land! / line.marks.land! - 71.2 / 64) < 0.03);
  assert.ok(Math.abs(slower.music!.pauses![0]!.to / line.music!.pauses![0]!.to - 71.2 / 64) < 0.01);
  // On the plan: its sounds, its music's shape, its three faces brought; nothing cut out or followed.
  const files = Array.from({ length: 5 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const plan = skillPlan({ skill: nomDeVille, name: "Nom aux cinq polices", files, fill: { shots: Array.from({ length: 15 }, (_, i) => ({ file: `v${i % 5}`, at: Math.floor(i / 5) * 4 })), texts: { surtitre: "les rues de", nom: "Belleville" }, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.sounds?.length, 2);
  assert.deepEqual(plan.music_shape?.pauses?.map((p) => p.tail), [2.4]);
  assert.deepEqual(plan.layers![0]!.motion.fonts, ["Lilita One", "Bungee", "League Gothic"]);
  assert.equal(plan.layers![0]!.motion.drawn, undefined);
  assert.deepEqual(plan.skill, { key: "nom-de-ville", version: 2 });
  assert.deepEqual(nomDeVille.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["vertical", "horizontal", "auto"]]]);
});

test("« Nom aux cinq polices »: its name in five faces, one shown at a time, changing at once on its marks, all in one box, hers last", () => {
  // On its marks (images 18, 30, 43 and 56: the original's 18, 30, 44 and 55 within one).
  const order = [0, 17, 18, 29, 30, 42, 43, 55, 56, 67].map((f) => shownFace(drawAt(f, {})));
  assert.deepEqual(order, ["Lilita One", "Lilita One", "Bungee", "Bungee", "League Gothic", "League Gothic", "Bungee", "Bungee", "Anton", "Anton"]);
  // Every face laid out at every frame (the others hidden), in one box keyed by the name: measured once, one size for all.
  const at = drawAt(30, {});
  assert.equal(faces(at).length, 5);
  assert.ok(faces(at).every((f) => f.text === "BELLEVILLE"));
  assert.deepEqual([...new Set([0, 30, 60].map((f) => String(title(drawAt(f, {}))!.props.key)))], ["title-BELLEVILLE"]);
  // The fourth face, the second one's a little bigger; hers in its heaviest weight, never a faux bold.
  const grid = flatten(at).find((n) => n.props.key === "name")!;
  const sizes = (grid.children as Drawn[]).map((f) => Number(styleOf(f).fontSize));
  assert.ok(sizes[3]! > sizes[1]! && sizes[0] === sizes[1] && sizes[4] === sizes[0]);
  assert.ok((grid.children as Drawn[]).every((f) => styleOf(f).fontSynthesis === "none"));
  assert.equal(styleOf((grid.children as Drawn[])[4]!).fontWeight, 900);
  // Its baselines on one line, centred.
  assert.deepEqual([styleOf(grid).alignItems, styleOf(grid).justifyItems], ["baseline", "center"]);
  // It goes with the cut: nothing of it on the next shot.
  assert.equal(title(drawAt(68, {})), null);
  // Its small words over it as a short label, its signature at the bottom, both in her text font.
  const tree = drawAt(20, {});
  const kick = flatten(title(tree)!).find((n) => "data-fauve-accent" in n.props && textOf(n) === "les rues de")!;
  assert.match(String(styleOf(kick).fontFamily), /Inter Tight/);
  assert.ok(Number(styleOf(kick).fontSize) * Math.min(1, 800 / (0.775 * 210 * 10)) >= 20);
  const sig = flatten(tree).find((n) => String(n.props.key).startsWith("sig-"))!;
  assert.equal(textOf(sig), "par Maison Farine");
  // Without a signature, none.
  assert.equal(flatten(drawAt(20, { reelTexts: WORDS.slice(0, 2) })).find((n) => String(n.props.key).startsWith("sig-")), undefined);
});

test("« Nom aux cinq polices »: behind her roofs when her sky is read, its foot a fifth of its capitals under them, her skyline laid over its band", () => {
  const box = (tree: Drawn) => styleOf(title(tree)!) as unknown as Box;
  const front = (tree: Drawn) => flatten(tree).find((n) => n.props.key === "front") ?? null;
  // Her roofs across its width at 300 px of its 16:9 box, as the original's flat roofline: its foot a fifth under them.
  const roofs = () => 300;
  const tree = drawAt(30, { reads: { skyline: roofs, light: 0.8 } });
  const b = box(tree);
  // Its box's bottom: its foot and the little under its baseline; its capitals about 0,72 of its size once fitted.
  const caps = Math.round(0.72 * 210 * Math.min(1, 800 / (0.775 * 210 * 10)));
  assert.ok(Math.abs(b.top + b.height - (300 + 0.2 * caps + 0.07 * caps)) <= 2, JSON.stringify(b));
  // A wide chimney higher in one of its eighths: it bites 45 % of a letter at most, never swallows one.
  const chimney = (_f: number, span: { from: number; to: number }) => (span.from > 300 && span.from < 400 ? 220 : 300);
  const lifted = box(drawAt(30, { reads: { skyline: chimney } }));
  assert.ok(Math.abs(lifted.top + lifted.height - (220 + 0.45 * caps + 0.07 * caps)) <= 2, JSON.stringify(lifted));
  assert.ok(front(tree), "her skyline laid over it");
  assert.equal(flatten(front(tree)!).find((n) => n.type === "Skyline")!.props.shot, 0);
  // Laid after it, across its band only.
  const nodes = flatten(tree);
  assert.ok(nodes.indexOf(front(tree)!) > nodes.indexOf(title(tree)!));
  assert.match(String(styleOf(front(tree)!).clipPath), /^inset\(\d+px 0 \d+px 0\)$/);
  // No sky read (an interior, the scene check): in front, at the bottom of her calm area, else the original's place.
  const bare = drawAt(30, {});
  assert.equal(front(bare), null);
  assert.ok(Math.abs(box(bare).top + box(bare).height - (Math.round(608 * 0.475) + 0.07 * caps)) <= 2, JSON.stringify(box(bare)));
  const calm = drawAt(30, { reads: { clear: { x: 100, y: 40, w: 800, h: 200 } } });
  assert.ok(Math.abs(box(calm).top + box(calm).height - (240 + 0.07 * caps)) <= 2);
  // Mountains behind her town on its left (two of its eighths at 200 px): they bite 45 % of its letters there, the rest
  // of it free above her roofs.
  const mountains = (_f: number, span: { from: number; to: number }) => (span.from < 300 ? 200 : 300);
  const high = box(drawAt(30, { reads: { skyline: mountains } }));
  assert.ok(Math.abs(high.top + high.height - (200 + 0.45 * caps + 0.07 * caps)) <= 2, JSON.stringify(high));
  // Only a low horizon under it (a beach): behind it all the same, as low in her sky as it may go (two thirds of its box).
  const beach = drawAt(30, { reads: { skyline: () => 560 } });
  assert.ok(front(beach) && Math.abs(box(beach).top + box(beach).height - (Math.round(608 * 0.66) + 0.07 * caps)) <= 2, JSON.stringify(box(beach)));
  // A scenery too high for it (towers over most of its width, no room above them for its small words): in front.
  const towers = (_f: number, span: { from: number; to: number }) => (span.from < 600 ? 120 : 300);
  assert.equal(front(drawAt(30, { reads: { skyline: towers } })), null);
});

test("« Nom aux cinq polices » (v2): full frame by default, 16:9 on black on her word or as her files, its words in the safe zone, in her colour against her sky", () => {
  const frameBox = (tree: Drawn) => styleOf((tree.children as Drawn[])[0]!) as unknown as Box;
  const line = nomDeVille.timeline(15, { end: false });
  // By default (Tristan, 6 November: « tout vertical please »), the whole frame whatever her files: as the engine plays it
  // (its format told), and as its code reads none (an empty setting is its own default).
  assert.equal(frameBox(drawAt(30, { texts: { format: "vertical" } })).height, 1920);
  assert.equal(frameBox(drawAt(30, { texts: { format: "" } })).height, 1920);
  // As her files (« comme mes vidéos »), horizontal: its 16:9 frame on black.
  assert.deepEqual(frameBox(drawAt(30, {})), { position: "absolute", left: 0, top: 656, width: 1080, height: 608, overflow: "hidden", backgroundColor: "#000000" } as unknown as Box);
  const upright = shotsOf(line.shots, 9 / 16);
  assert.equal(frameBox(drawAt(30, { shots: upright })).height, 1920);
  assert.equal(frameBox(drawAt(30, { shots: upright, texts: { format: "horizontal" } })).height, 608);
  assert.equal(frameBox(drawAt(30, { texts: { format: "vertical" } })).height, 1920);
  // Each of its words inside the safe zone on the frame, at every frame of its shot, its longest name and words too:
  // left of the apps' buttons below the middle, above the bottom quarter.
  const long = [
    { text: "un samedi à", role: "caption", from: 0, to: 68, emphasis: [] },
    { text: "Ménilmontant", role: "hook", from: 0, to: 68, emphasis: [] },
    { text: "@maisonfarine.paris", role: "caption", from: 0, to: 68, emphasis: [] },
  ];
  for (const shots of [line.shots.map((s) => s), undefined]) {
    for (const f of [0, 30, 67]) {
      const tree = drawAt(f, { reelTexts: long, ...(shots ? { shots: shotsOf(shots, 9 / 16) } : {}), reads: { skyline: () => 700 } });
      const top = frameBox(tree).top;
      for (const t of flatten(tree).filter((n) => n.type === "FitText")) {
        const b = styleOf(t) as unknown as Box;
        const y0 = top + b.top;
        const y1 = top + b.top + b.height;
        assert.ok(b.left >= 40 && b.left + b.width <= 1040 && y1 <= 1440 && y0 >= 0, `${String(t.props.key)} at ${f}: ${JSON.stringify(b)}`);
        if (y1 > 960) assert.ok(b.left + b.width <= 940, `${String(t.props.key)} below the middle: ${JSON.stringify(b)}`);
      }
    }
  }
  // Her colour as it is when it stands out 2:1 from her sky (the original's red on its pale one, a brighter one too);
  // deepened a step at a time on a greyer sky, until it does.
  const color = (tree: Drawn) => faces(tree)[0]!.color;
  assert.equal(color(drawAt(30, { reads: { light: 0.8 } })), "#fd4c4c");
  assert.equal(color(drawAt(30, { reads: { light: 0.95 } })), "#fd4c4c");
  assert.equal(color(drawAt(30, { reads: { light: 0.6 } })), "#aa3333");
  // A pale colour of hers on a pale sky is deepened until it reads; on a dark sky a dark one is lightened.
  assert.notEqual(color(drawAt(30, { brand: { accent: "#f4d9c8" }, reads: { light: 0.85 } })), "#f4d9c8");
  assert.notEqual(color(drawAt(30, { brand: { accent: "#1d3b2a" }, reads: { light: 0.15 } })), "#1d3b2a");
  // Its small words white with a dark edge on a sky that lets white read, in its colour on one too bright.
  const kick = (tree: Drawn) => flatten(title(tree)!).find((n) => textOf(n) === "les rues de" && "data-fauve-accent" in n.props)!;
  assert.equal(styleOf(kick(drawAt(30, { reads: { light: 0.6 } }))).color, "#ffffff");
  assert.equal(styleOf(kick(drawAt(30, { reads: { light: 0.97 } }))).color, color(drawAt(30, { reads: { light: 0.97 } })));
});

test("« Nom aux cinq polices »: it rises from under its place and lands on beat 4, its small words drifting up and its signature down", () => {
  const rise = (f: number, reads: Reads = {}) => {
    const t = title(drawAt(f, { reads }))!;
    const wrap = flatten(t).find((n) => (n.children as Drawn[]).some((c) => c && typeof c === "object" && c.props.key === "name"))!;
    return Number(/translateY\(([-\d.]+)em\)/.exec(String(styleOf(wrap).transform))![1]);
  };
  // 0,4 of its capitals (0,288 of its size) under its place at first, 70 % of the way in its first 0,6 s, landed on beat 4.
  assert.ok(Math.abs(rise(0) - 0.288) < 0.001);
  // The same behind a flat roofline (a fifth of its letters hidden once landed, 60 % at first, as the original's), and
  // behind mountains that bite 45 % of a letter (v2: v1 rose by half as much there, and the name hardly came out).
  assert.ok(Math.abs(rise(0, { skyline: () => 300 }) - 0.288) < 0.001);
  assert.ok(Math.abs(rise(0, { skyline: (_f, span) => (span.from < 300 ? 200 : 300) }) - 0.288) < 0.001);
  assert.ok(rise(18) < 0.288 * 0.35 && rise(18) > 0);
  assert.equal(rise(56), 0);
  assert.equal(rise(67), 0);
  for (let f = 1; f <= 56; f++) assert.ok(rise(f) <= rise(f - 1));
  // Its small words up, its signature down, a quarter of their size over the shot.
  const kick = (f: number) => Number(/translateY\(([-\d.]+)em\)/.exec(String(styleOf(flatten(title(drawAt(f, {}))!).find((n) => textOf(n) === "les rues de" && "data-fauve-accent" in n.props)!).transform))![1]);
  assert.ok(kick(0) === 0 && kick(60) < 0 && kick(60) >= -0.25);
});

test("« Nom aux cinq polices » (v2): it comes out from behind a line at every image, its roofline or the foot of its place, whether her ground was made or not", () => {
  // Tristan on v1: « l'aspect du texte qui apparaît derrière n'est pas là ». Its letters under the line are cut away
  // (a clip over its frame's box, its small words above the line untouched).
  const line = (tree: Drawn) => {
    const wrap = flatten(tree).find((n) => n.props.key === "name-line");
    const m = wrap ? /^inset\(0 0 (\d+)px 0\)$/.exec(String(styleOf(wrap).clipPath)) : null;
    return m ? 608 - Number(m[1]) : null;
  };
  const caps = Math.round(0.72 * 210 * Math.min(1, 800 / (0.775 * 210 * 10)));
  // Behind a flat roofline at 300 px: the line on her roofs, its foot a fifth of its capitals under it.
  assert.equal(line(drawAt(30, { reads: { skyline: () => 300 } })), 300);
  // A tower biting 45 % of a letter lifts its foot above her median roofline: the line is its foot.
  const tower = line(drawAt(30, { reads: { skyline: (_f, span) => (span.from > 300 && span.from < 400 ? 220 : 300) } }))!;
  assert.ok(Math.abs(tower - (220 + 0.45 * caps)) <= 1, `${tower}`);
  // In front (no sky read; a calm area; a scenery too high): the foot of its place, so it still rises out of a line.
  assert.equal(line(drawAt(30, {})), Math.round(608 * 0.475));
  assert.equal(line(drawAt(30, { reads: { clear: { x: 100, y: 40, w: 800, h: 200 } } })), 240);
  assert.ok(line(drawAt(30, { reads: { skyline: (_f, span) => (span.from < 600 ? 120 : 300) } })) !== null);
  // The whole of its letters under it at its first image but 40 %, out but a fifth behind a roofline once landed: its
  // box's bottom (its foot and a little) under the line by its rise at first.
  const box = (tree: Drawn) => styleOf(flatten(tree).find((n) => String(n.props.key).startsWith("title-"))!) as unknown as Box;
  const landed = box(drawAt(60, { reads: { skyline: () => 300 } }));
  assert.ok(Math.abs(landed.top + landed.height - 0.07 * caps - (300 + 0.2 * caps)) <= 2, JSON.stringify(landed));
  // Its small words above the line, in the same clip but over it.
  const kickTree = drawAt(30, { reads: { skyline: () => 300 } });
  const kickBox = box(kickTree);
  assert.ok(kickBox.top + kickBox.height - 1.05 * 210 * Math.min(1, 800 / (0.775 * 210 * 10)) < 300);
});

test("« Nom aux cinq polices »: its ending card, its last shot darkened, its words through three faces then hers", () => {
  const line = nomDeVille.timeline(15, { end: true });
  const from = Math.round((line.duration - 2.5) * 30);
  const end = { title: "Ouvert dimanche", subtitle: "de 10 h à 18 h", from };
  const props = { shots: shotsOf(line.shots, 16 / 9), texts: marksOf(line), end, durationInFrames: Math.round(line.duration * 30) };
  const card = (f: number) => flatten(drawAt(f, props)).find((n) => n.props.key === "endname") ?? null;
  assert.equal(card(from - 1), null);
  const shown = (f: number) => (card(f)!.children as Drawn[]).map((c) => ({ family: String(styleOf(c).fontFamily).split(",")[0]!.replace(/'/g, ""), on: styleOf(c).visibility === "visible" })).find((c) => c.on)!.family;
  const step = Number(line.marks.step);
  assert.deepEqual([from, from + Math.ceil(step), from + Math.ceil(2 * step), from + Math.ceil(3 * step) + 1].map(shown), ["Lilita One", "Bungee", "League Gothic", "Anton"]);
  assert.ok(flatten(drawAt(from + 30, props)).some((n) => textOf(n) === "de 10 h à 18 h"));
});

test("« Nom aux cinq polices »: its code passes the checks, reads its first shot's sky, ground and light only, cuts nothing out", () => {
  assert.deepEqual(checkMotionCode(nomDeVille.code), []);
  assert.ok(nomDeVille.code.length < 24000, String(nomDeVille.code.length));
  assert.deepEqual(readsDrawn(nomDeVille.code), [{ shot: 0, kinds: ["ground", "light", "sky"] }]);
  assert.deepEqual(clearsDrawn(nomDeVille.code), [0]);
  assert.deepEqual([subjectsDrawn(nomDeVille.code), objectsDrawn(nomDeVille.code)], [[], []]);
  assert.doesNotMatch(nomDeVille.code, /Subject\b|scale\(/);
  // Nothing of the original's own.
  assert.doesNotMatch(nomDeVille.code + JSON.stringify(nomDeVille.texts), /MARRAKECH|STREETS OF|HARPER|VISUALS BY/i);
});
