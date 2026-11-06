import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema, segmentSeconds } from "../schemas.ts";
import { skillFit, skillLengths, skillPlan, type MontageSkill } from "../skills.ts";
import { clearsDrawn, depthsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { depart, departCounts } from "./depart.ts";

// « Le grand départ », the model (depart.ts, version 1), on its original's fiche (docs/fiches/depart.md); and the tool it
// added to the engine: a slot played faster than filmed (SkillShot.speed).

/** The original's cuts, the first image of each new shot (measured image by image): its empty place, its four journey shots, its three crowds. */
const ORIGINAL_CUTS = [25, 32, 42, 51, 82, 96, 148, 218];

test("« Le grand départ » (v1): its nine shots on its original's cuts (110,9 BPM from the first image), 11,17 s, its music coming in with the arrival", () => {
  assert.equal(depart.version, 1);
  assert.equal(depart.bpm, 110.9);
  const line = depart.timeline(9, { end: false });
  // 335 images (the original's, its last black one aside); each cut within an image of the original's.
  assert.equal(line.shots.length, 9);
  assert.equal(Math.round(line.duration * 30), 335);
  const cuts = line.shots.slice(1).map((s) => Math.round(s.start * 30));
  cuts.forEach((c, i) => assert.ok(Math.abs(c - ORIGINAL_CUTS[i]!) <= 1, `cut ${i + 1}: ${c} for ${ORIGINAL_CUTS[i]}`));
  assert.deepEqual(cuts, [24, 32, 43, 51, 81, 97, 148, 219]);
  // Her place and her journey heard with their own sound; her arrival twice as fast as filmed, under the music.
  assert.deepEqual(line.shots.map((s) => [Boolean(s.sound), s.speed ?? 1]), [[true, 1], [true, 1], [true, 1], [true, 1], [true, 1], [true, 1], [false, 2], [false, 2], [false, 2]]);
  // Its music: none for the journey, in on its downbeat with the arrival (the original's 3,23 s), cut dead at the end.
  assert.deepEqual(line.music, { downbeat: 3.23, pauses: [{ from: 0, to: 3.23 }], end: { at: 11.17 } });
  assert.equal(line.sounds, undefined);
  // Its rush onto where she arrives on the last half beat of her journey (the original's images 88 to 95), her two lines
  // a beat into her last shot (its 7,8 s) to the end.
  assert.deepEqual(line.marks, { beat: 16.231, trip: 2, arrival: 6, rush: 89, title: 235 });
  assert.deepEqual(line.texts, { ligne: { from: 7.84, to: 11.17 }, lieu: { from: 7.84, to: 11.17 } });
  // What each slot wants: her at her place and something passing before her lens (the cut hidden there), her place empty.
  assert.match(line.shots[0]!.want, /le passage commence alors 0,8 s avant l'instant où il cache le plus l'image/);
  assert.match(line.shots[1]!.want, /sans la personne/);
  assert.match(line.shots[5]!.want, /fonce d'un coup/);
  assert.match(line.shots[8]!.want, /il prend 7,74 s de sa vidéo/);
  assert.deepEqual(depart.reads, ["covered"]);
});

test("« Le grand départ »: 6 to 9 shots from her files (her journey and her arrival shorter), up to 16 for a length she asks for", () => {
  // Two to four journey shots, two or more arrival shots; its length the same from 6 to 9.
  assert.deepEqual([6, 7, 8, 9, 10, 16].map((n) => departCounts(n)), [{ trip: 2, arrival: 2 }, { trip: 3, arrival: 2 }, { trip: 4, arrival: 2 }, { trip: 4, arrival: 3 }, { trip: 4, arrival: 4 }, { trip: 4, arrival: 10 }]);
  for (let n = 6; n <= 16; n++) {
    const line = depart.timeline(n, { end: false });
    assert.equal(line.shots.length, n);
    const { trip } = departCounts(n);
    // Her place 0,8 s, then her place empty, her journey ending on the arrival's beat (3,23 s), the music in there.
    assert.equal(Math.round(line.shots[1]!.start * 30), 24);
    assert.equal(line.shots[2 + trip]!.start, 3.23, `n=${n}`);
    assert.equal(line.music!.pauses![0]!.to, 3.23);
    // No journey shot under a quarter of a second; no arrival shot under 1,6 s.
    line.shots.forEach((s, i) => assert.ok(s.end - s.start >= (i >= 2 + trip ? 1.6 : i > 1 ? 0.25 : 0.25), `n=${n} shot ${i}: ${s.end - s.start}`));
    if (n <= 9) assert.equal(line.duration, 11.17);
  }
  assert.equal(depart.timeline(16, { end: false }).duration, 26.3);
  assert.ok(depart.timeline(16, { end: true, bpm: 92 }).duration <= 45);
  assert.ok(skillLengths(depart).max <= 45);
  assert.deepEqual(skillFit(depart, 20), { n: 13, bpm: 110.9 });
  // An ending card: her last shot held whole beats longer (1,6 s at least), her two lines giving way to it.
  const line = depart.timeline(9, { end: false });
  const ended = depart.timeline(9, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6);
  assert.equal(ended.texts.lieu!.to, Math.round((ended.duration - 1.6) * 100) / 100);
  assert.equal(ended.music!.end!.at, ended.duration);
  // At another tempo, every length in beats follows it.
  const slow = depart.timeline(9, { end: false, bpm: 92 });
  assert.ok(Math.abs(slow.duration / line.duration - 110.9 / 92) < 0.01);
  assert.ok(Math.abs(slow.marks.title! / line.marks.title! - 110.9 / 92) < 0.01);
  // Her arrival at its real pace when she asks.
  assert.ok(depart.timeline(9, { end: false, settings: { arrivee: "normale" } }).shots.every((s) => s.speed === undefined));
  assert.deepEqual(depart.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]], ["arrivee", ["acceleree", "normale"]]]);
});

test("« Le grand départ »: its plan (her arrival played faster, her journey heard, its words by role), nothing cut out, followed or read", () => {
  const files = [
    { id: "elle", photo: false, seconds: 9 },
    { id: "metro", photo: false, seconds: 5 },
    { id: "aile", photo: false, seconds: 5 },
    { id: "vitre", photo: false, seconds: 8 },
    { id: "escalier", photo: false, seconds: 4 },
    { id: "foule", photo: false, seconds: 20 },
    { id: "marche", photo: false, seconds: 3 },
  ];
  const cast = ["elle", "elle", "metro", "aile", "vitre", "escalier", "foule", "marche", "foule"].map((file, i) => ({ file, at: i === 1 ? 7 : i === 8 ? 10 : 0 }));
  const plan = skillPlan({ skill: depart, name: "Le grand départ", files, fill: { shots: cast, texts: { ligne: "Ce week-end", lieu: "au marché aux puces" }, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 9);
  const segs = plan.segments as { clip_id: string; in: number; out: number; speed?: number; sound?: boolean }[];
  // Her journey with its sound; her arrival twice as fast (a short video as fast as it allows), each its slot's length.
  assert.deepEqual(segs.map((s) => Boolean(s.sound)), [true, true, true, true, true, true, false, false, false]);
  assert.deepEqual(segs.slice(6).map((s) => s.speed), [2, 1.26, 2]);
  plan.segments.forEach((s, i) => assert.ok(Math.abs(segmentSeconds(s) - (depart.timeline(9, { end: false }).shots[i]!.end - depart.timeline(9, { end: false }).shots[i]!.start)) < 0.02, `shot ${i}`));
  // Her place empty from the end of her own video, never the same passage as her standing.
  assert.ok(segs[1]!.in >= segs[0]!.out);
  assert.deepEqual(plan.texts.map((t) => [t.style, t.text]), [["caption", "Ce week-end"], ["hook", "au marché aux puces"]]);
  assert.equal(plan.music_shape?.downbeat, 3.23);
  assert.deepEqual(plan.music_shape?.pauses, [{ from: 0, to: 3.23 }]);
  assert.equal(plan.music_shape?.end?.at, 11.17);
  assert.equal(plan.sounds?.length ?? 0, 0);
  assert.deepEqual(plan.skill, { key: "depart", version: 1 });
  assert.equal(plan.tempo, 110.9);
  // Light to render: nothing cut out nor followed, no clear area, no reading, no depth.
  assert.deepEqual(checkMotionCode(depart.code), []);
  assert.deepEqual([subjectsDrawn(depart.code), objectsDrawn(depart.code), clearsDrawn(depart.code), readsDrawn(depart.code), depthsDrawn(depart.code)], [[], [], [], [], []]);
  assert.equal(plan.layers![0]!.motion.drawn, undefined);
  assert.ok(depart.code.length < 24000);
  // Its finish keeps its contrast, grain and corners: its code draws its black and white under her coloured words.
  assert.deepEqual(depart.finish, { saturation: 0 });
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, options: { aspect?: number; texts?: Record<string, string>; reel?: { text: string; role: string }[]; end?: { title: string; subtitle?: string; from: number }; n?: number; brand?: Record<string, unknown> } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const interpolate = (x: number, [a, b]: number[], [y0, y1]: number[]) => (x <= a! ? y0! : x >= b! ? y1! : y0! + ((y1! - y0!) * (x - a!)) / (b! - a!));
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame, interpolate };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${depart.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const line = depart.timeline(options.n ?? 9, { end: Boolean(options.end) });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const durationInFrames = Math.round(line.duration * 30);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 9 / 16, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const title = Math.round(line.texts.lieu!.from * 30);
  const until = Math.round(line.texts.lieu!.to * 30);
  const reelTexts = (options.reel ?? [
    { text: "Ce week-end", role: "caption" },
    { text: "au marché aux puces", role: "hook" },
  ]).map((t) => ({ ...t, from: title, to: until, emphasis: [] }));
  const brand = { name: "Brocante Lou", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#1d3b5a", palette: { light: "#f6efe4", dark: "#1d1b19" }, ...options.brand };
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
const keyed = (tree: Drawn, key: string) => nodes(tree).find((n) => n.props.key === key) ?? null;
/** The shot on screen and how big its picture is drawn (its scale against the frame); the passing mass's copy (held, \`at\`) left out. */
const footage = (tree: Drawn) => of(tree, "Footage").filter((f) => f.props.at === undefined).map((f) => ({ shot: f.props.shot as number, scale: Number(styleOf(f).width) / 1080, style: styleOf(f), hold: f.props.hold, filter: String(styleOf(f).filter ?? "") }));

test("« Le grand départ » draws her at her place zoomed out in three steps at 15 images a second, then her place empty, held", () => {
  // The original's steps: 2,88 times, then 2,04, then 1,56, then her whole place.
  assert.deepEqual([0, 1, 2, 3, 4, 5, 20].map((f) => Math.round(footage(drawAt(f))[0]!.scale * 100) / 100), [2.88, 2.04, 2.04, 1.56, 1.56, 1, 1]);
  // Each image held two frames, in black and white; its picture always covers the frame (about her middle).
  const first = footage(drawAt(0))[0]!;
  assert.equal(first.shot, 0);
  assert.equal(first.hold, 2);
  assert.match(first.filter, /grayscale\(1\)/);
  assert.ok(Number(first.style.left) <= 0 && Number(first.style.left) + Number(first.style.width) >= 1080 && Number(first.style.top) <= 0 && Number(first.style.top) + Number(first.style.height) >= 1920);
  // Her place empty from the cut (image 24), held on its first image to the journey.
  const empty = footage(drawAt(26)).find((f) => f.shot === 1)!;
  assert.ok(Number(empty.hold) >= 8);
  assert.equal(footage(drawAt(31))[0]!.shot, 1);
  assert.equal(footage(drawAt(32))[0]!.shot, 2);
});

test("« Le grand départ »: a dark blurred mass passes from the right over the cut, at 15 images a second, her place empty revealed from the right", () => {
  const mask = (f: number) => {
    const veil = keyed(drawAt(f), "veil");
    return veil ? String(styleOf(veil).maskImage) : null;
  };
  const edges = (f: number) => (mask(f)!.match(/-?\d+px/g) ?? []).map((v) => Number(v.replace("px", "")));
  // Nothing before image 12; in from the right, then the whole picture covered from image 18 to 25 (the cut at 24).
  assert.equal(mask(11), null);
  assert.ok(edges(12)[0]! >= 1080 - 1);
  for (const f of [18, 20, 24, 25]) {
    const [l, l1, r1, r] = edges(f);
    assert.ok(l1! <= 0 && r1! >= 1080, `image ${f}: ${edges(f).join(" ")}`);
    assert.ok(l! < l1! && r! > r1!);
  }
  // Leaving to the left, its right edge sweeping over her place empty; gone after image 29.
  assert.ok(edges(27)[3]! < 1080 && edges(27)[3]! > 0);
  assert.equal(mask(30), null);
  // At 15 images a second: the same place on two frames in a row.
  assert.deepEqual(edges(14), edges(15));
  assert.notDeepEqual(edges(15), edges(16));
  // A copy of her shot, held on its image before the cut, its middle blown up 9,6 times (nothing of her recognisable),
  // streaked along the way it goes (a blur along x, its id this image's), darkened, in black and white.
  const veil = keyed(drawAt(20), "veil")!;
  const copy = of(veil, "Footage")[0]!;
  assert.equal(copy.props.shot, 0);
  assert.equal(20 - Number(copy.props.at), 23);
  const streaked = nodes(veil).find((n) => /url\(#dp-veil-20\)/.test(String(styleOf(n).filter ?? "")))!;
  assert.match(String(styleOf(streaked).filter), /brightness\(0\.36\) grayscale\(1\)/);
  assert.equal(styleOf(streaked).transform, "scale(9.6)");
  assert.equal(of(veil, "feGaussianBlur")[0]!.props.stdDeviation, "16 1.2");
  assert.equal(of(veil, "filter")[0]!.props.id, "dp-veil-20");
});

test("« Le grand départ »: her journey as filmed, the last shot rushing onto where she arrives, then her arrival a touch warm", () => {
  const line = depart.timeline(9, { end: false });
  for (const [k, s] of line.shots.entries()) {
    if (k < 2) continue;
    const f = Math.round(s.start * 30);
    const drawn = footage(drawAt(f));
    assert.equal(drawn.length, 1, `image ${f}`);
    assert.equal(drawn[0]!.shot, k);
    assert.match(drawn[0]!.filter, k >= 6 ? /sepia/ : /^grayscale\(1\) contrast\(1\.1\)$/);
  }
  // The rush: 3,6 times on the last image of her journey (96), from image 89, faster and faster, a little blurred.
  const scales = [88, 89, 92, 95, 96].map((f) => Math.round(footage(drawAt(f))[0]!.scale * 100) / 100);
  assert.equal(scales[0], 1);
  assert.equal(scales[4], 3.6);
  assert.ok(scales[1]! > 1 && scales[2]! - scales[1]! < scales[4]! - scales[3]!, scales.join(" "));
  assert.match(footage(drawAt(96))[0]!.filter, /blur\(2\.5px\)/);
  assert.equal(footage(drawAt(97))[0]!.scale, 1);
  // Its band: most of her videos in width (or her word), whole in a 16:9 band on black; full frame as she asks.
  assert.deepEqual(styleOf(nodes(drawAt(60, { aspect: 16 / 9 })).find((n) => n.props.key === "t4")!), { position: "absolute", left: 0, top: 656, width: 1080, height: 608, overflow: "hidden" });
  assert.equal(styleOf(nodes(drawAt(60, { aspect: 16 / 9, texts: { format: "vertical" } })).find((n) => n.props.key === "t4")!).height, 1920);
  assert.equal(styleOf(nodes(drawAt(60, { texts: { format: "horizontal" } })).find((n) => n.props.key === "t4")!).height, 608);
});

test("« Le grand départ »: her two lines small in the middle, fading in a beat into her last shot, readable, in her colour or the gold", () => {
  const fits = (f: number, options: Parameters<typeof drawAt>[1] = {}) => of(drawAt(f, options), "FitText");
  assert.equal(fits(234).length, 0);
  const lines = fits(250);
  assert.deepEqual(lines.map((t) => t.children[0]), ["Ce week-end", "au marché aux puces"]);
  // Faded in over nine images from image 235.
  assert.equal((fits(235)[0]!.props.innerStyle as { opacity: number }).opacity, 0);
  assert.ok(Math.abs((fits(239)[0]!.props.innerStyle as { opacity: number }).opacity - 4 / 9) < 1e-9);
  assert.equal((fits(244)[0]!.props.innerStyle as { opacity: number }).opacity, 1);
  // 60 px, in the safe zone, centred on 45 % of the height; her dark navy does not read on grey: the gold.
  for (const t of lines) {
    const b = styleOf(t) as unknown as Box;
    assert.ok(b.left >= 140 && b.left + b.width <= 940 && b.top >= 80 && b.top + b.height <= 1440, JSON.stringify(b));
    assert.equal((t.props.innerStyle as { fontSize: number }).fontSize, 60);
    assert.equal((t.props.innerStyle as { color: string }).color, "#cdb672");
  }
  assert.equal(Number(styleOf(lines[0]!).top) + Number(styleOf(lines[0]!).height), Number(styleOf(lines[1]!).top));
  assert.equal(Number(styleOf(lines[1]!).top), 864);
  // A colour of hers that reads on grey (light and coloured): hers.
  assert.equal((fits(250, { brand: { accent: "#e8a33d" } })[0]!.props.innerStyle as { color: string }).color, "#e8a33d");
  // Her place alone: one line, centred there.
  const alone = fits(250, { reel: [{ text: "Lyon", role: "hook" }] });
  assert.equal(alone.length, 1);
  assert.equal(Number(styleOf(alone[0]!).top) + Number(styleOf(alone[0]!).height) / 2, 864);
  // Its ending card in their place over her last shot still playing; her lines gone.
  const line = depart.timeline(9, { end: true });
  const from = Math.round((line.duration - 1.6) * 30);
  const end = { title: "Stand 12", subtitle: "samedi et dimanche", from };
  assert.deepEqual(fits(from - 1, { end }).map((t) => t.children[0]), ["Ce week-end", "au marché aux puces"]);
  assert.deepEqual(fits(from + 12, { end }).map((t) => t.children[0]), ["Stand 12", "samedi et dimanche"]);
  assert.equal(footage(drawAt(from + 12, { end }))[0]!.shot, 8);
});

test("a skill's slot played faster than filmed (SkillShot.speed): that much more of her video, as much as it gives, never slower than filmed", () => {
  const fast: MontageSkill = {
    key: "test-vite",
    version: 1,
    bpm: 120,
    shots: [3, 3],
    files: [1, 3],
    how: "",
    end: false,
    texts: [],
    timeline: () => ({
      duration: 6,
      shots: [
        { start: 0, end: 2, want: "" },
        { start: 2, end: 4, want: "", speed: 2 },
        { start: 4, end: 6, want: "", speed: 2 },
      ],
      texts: {},
      marks: {},
    }),
    code: "function Scene() { return null; }",
  };
  const files = [
    { id: "a", photo: false, seconds: 10 },
    { id: "b", photo: false, seconds: 3 },
    { id: "p", photo: true, seconds: 0 },
  ];
  const plan = skillPlan({ skill: fast, name: "Test", files, fill: { shots: [{ file: "a", at: 0 }, { file: "a", at: 5 }, { file: "b", at: 0 }], texts: {}, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const [first, second, third] = plan.segments as { clip_id: string; in: number; out: number; speed?: number }[];
  // As filmed where its model says nothing; twice as fast where it says so: four seconds of her video in two.
  assert.equal(first!.speed, undefined);
  assert.deepEqual([second!.in, second!.out, second!.speed], [5, 9, 2]);
  // A video too short for it: as fast as it allows (3 s in 2: 1,5 times), all of it.
  assert.deepEqual([third!.in, third!.out, third!.speed], [0, 3, 1.5]);
  // Each one lasts its slot on the Reel: the timeline holds.
  for (const s of plan.segments) assert.ok(Math.abs(segmentSeconds(s) - 2) < 0.01, JSON.stringify(s));
  assert.equal(plan.duration, 6);
  // A photo stays still, whatever its slot says.
  const still = skillPlan({ skill: fast, name: "Test", files, fill: { shots: [{ file: "a", at: 0 }, { file: "p", at: 0 }, { file: "a", at: 4 }], texts: {}, end: null } });
  assert.equal((still.segments[1] as { speed?: number }).speed, undefined);
});
