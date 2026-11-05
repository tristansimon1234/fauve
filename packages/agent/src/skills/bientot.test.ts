import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillPlan, skillShotCount } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { bientot } from "./bientot.ts";

// « Teaser qui se charge » (skills/bientot.ts, docs/fiches/bientot.md): its own checks, beside the skills' (features.test.ts).

/** The original's 64 flashes and its logo on the black, the image each one starts on (30 i/s), measured image by image. */
const ORIGINAL = [0, 3, 5, 8, 11, 14, 17, 20, 23, 26, 29, 31, 34, 37, 40, 43, 46, 49, 52, 54, 57, 60, 63, 66, 69, 72, 75, 78, 80, 83, 86, 89, 91, 93, 96, 99, 101, 104, 106, 109, 112, 114, 116, 119, 121, 124, 127, 130, 132, 134, 136, 139, 142, 145, 147, 150, 153, 156, 159, 162, 165, 168, 171, 174, 177];

test("« Teaser qui se charge » (v1): 56 slots and eight replays on its cuts' grid (79 BPM), each of its 64 flashes within an image of the original's", () => {
  assert.equal(bientot.version, 1);
  assert.equal(bientot.bpm, 79);
  assert.deepEqual(bientot.shots, [56, 56]);
  // Its count never moves: its flashes are its form, whatever she sends.
  assert.equal(skillShotCount(bientot, [{ id: "a", photo: false, seconds: 9 }]), 56);
  const line = bientot.timeline(56, { end: false });
  assert.equal(line.shots.length, 56);
  // Its length: 10¾ beats (its name held to read, where the original's video stops after four images).
  assert.equal(Math.round(line.duration * 30), 245);
  // Its slots one after the other from 0, and its replays drawn by its code: with its logo, 65 starts, each within an image.
  line.shots.forEach((s, i) => assert.ok(i === 0 ? s.start === 0 : Math.abs(s.start - line.shots[i - 1]!.end) < 1e-9, `slot ${i}`));
  const replays = Object.entries(line.marks).filter(([k]) => /^replay\d+_at$/.test(k)).map(([, v]) => v);
  assert.equal(replays.length, 8);
  const starts = [...line.shots.map((s) => Math.round(s.start * 30)), ...replays, line.marks.logo!].sort((a, b) => a - b);
  assert.equal(starts.length, ORIGINAL.length);
  starts.forEach((f, i) => assert.ok(Math.abs(f - ORIGINAL[i]!) <= 1, `flash ${i}: ${f} for the original's ${ORIGINAL[i]}`));
  // Under the counter an eighth of a beat each (2 or 3 images), after her word a ninth (faster), in her place an eighth.
  const lengths = starts.slice(1).map((f, i) => f - starts[i]!);
  assert.ok(lengths.every((l) => l === 2 || l === 3), lengths.join(" "));
  // Which slot each replay shows: its still again two flashes later (the original's 99 at 104), then seven earlier
  // flashes, nearly backwards, two in a row never from one file whatever rotation of 4 to 12 files the filler made.
  const shown = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => line.marks[`replay${k}_shot`]!);
  assert.deepEqual(shown, [35, 34, 31, 18, 5, 2, 15, 12]);
  for (let files = 4; files <= 12; files++) shown.slice(1).forEach((s, i) => i && assert.notEqual(s % files, shown[i]! % files, `${files} files: slots ${shown[i]} and ${s}`));
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8].every((k) => line.marks[`replay${k}_to`]! - line.marks[`replay${k}_at`]! >= 2));
  // A replay's time belongs to the slot before it on the main line (slot 36 before the still, slot 45 before the run).
  assert.equal(Math.round(line.shots[45]!.start * 30), 127);
  assert.equal(Math.round(line.shots[45]!.end * 30), 148);
  // Its landmarks (frames): the counter gone, her word, her logo on the black, the boom, her name.
  assert.deepEqual([line.marks.off, line.marks.word, line.marks.logo, line.marks.boom, line.marks.name], [89, 91, 177, 188, 194]);
  assert.ok(Math.abs(line.marks.beat! - 22.785) < 0.01);
  // Her word from the counter's place to her logo; her name from its beat to the end.
  assert.deepEqual(line.texts, { bientot: { from: 3.04, to: 5.89 }, nom: { from: 6.46, to: 8.17 } });
  // Its last slot under its ending (only its first flash shows, its code draws the black).
  assert.equal(Math.round(line.shots[55]!.start * 30), 174);
  assert.equal(line.shots[55]!.end, line.duration);
  assert.match(line.shots[0]!.want, /premier éclair/);
  assert.match(line.shots[50]!.want, /son lieu/);
});

test("« Teaser qui se charge » (v1): its sound as the original's (two deep hits, a roll of ticks rising to the boom), its music muffled after the boom", () => {
  const line = bientot.timeline(56, { end: false });
  const sounds = line.sounds!;
  assert.equal(sounds.length, 4);
  // Its deep hits on its eighth flash (the original's 0,68 s) and as the seven replays come back (4,32 s), within an image.
  const hits = sounds.filter((s) => /808 bass hit/.test(s.sound));
  assert.deepEqual(hits.map((s) => Math.abs(s.at - [0.68, 4.32][hits.indexOf(s)]!) <= 1 / 30), [true, true]);
  // The roll: 25 ticks a second from just after her logo to just before the boom, rising.
  const roll = sounds.find((s) => s.burst)!;
  assert.ok(Math.abs(roll.at - 5.92) <= 1 / 30, String(roll.at));
  assert.ok(roll.burst!.times.every((t, i) => Math.abs(t - i * 0.04) < 1e-6) && roll.burst!.times.length >= 6);
  assert.ok(roll.burst!.gains!.every((g, i, all) => i === 0 || g >= all[i - 1]!) && roll.burst!.gains!.at(-1)! > roll.burst!.gains![0]!);
  const boom = sounds.find((s) => /boom/.test(s.sound))!;
  assert.ok(Math.abs(boom.at - 6.29) <= 1 / 30 && roll.at + roll.burst!.times.at(-1)! < boom.at, String(boom.at));
  // Its clicks stop at the boom: muffled from it to the end, faded at the end.
  assert.deepEqual(line.music, { filters: [{ kind: "muffled", from: boom.at, to: line.duration }], end: { at: line.duration, fade: 0.5 } });
  // An ending card after her name (1,6 s at least, on a quarter-beat grid); at another tempo every landmark follows.
  const ended = bientot.timeline(56, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6 && ended.duration - line.duration < 1.8);
  assert.ok(Math.abs(ended.texts.nom!.to - (ended.duration - 1.6)) < 0.011);
  const slower = bientot.timeline(56, { end: false, bpm: 64 });
  assert.ok(Math.abs(slower.marks.logo! / line.marks.logo! - 79 / 64) < 0.01 && Math.abs(slower.duration / line.duration - 79 / 64) < 0.01);
  assert.ok(Math.abs(slower.sounds![3]!.at / boom.at - 79 / 64) < 0.01);
  assert.deepEqual(bientot.tempo, [64, 95]);
});

test("« Teaser qui se charge » (v1): its plan, 56 of her passages, its sounds and its music, nothing cut out nor followed", () => {
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 9 }));
  const fill = { shots: Array.from({ length: 56 }, (_, i) => ({ file: `v${i % 8}`, at: (i % 7) * 1.2 })), texts: { bientot: "Nouvelle collection", nom: "Atelier Rose" }, end: null };
  const plan = skillPlan({ skill: bientot, name: "Teaser qui se charge", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 56);
  assert.equal(plan.tempo, 79);
  assert.deepEqual(plan.texts.map((t) => [t.text, t.style]), [["Nouvelle collection", "hook"], ["Atelier Rose", "caption"]]);
  assert.equal(plan.sounds?.length, 4);
  assert.ok(plan.sounds!.every((s) => s.skill));
  assert.equal(plan.music_shape?.filters?.[0]?.kind, "muffled");
  const layer = plan.layers![0]!;
  assert.equal(layer.motion.drawn, undefined);
  assert.equal(layer.motion.texts!.replay1_shot, "35");
  // Its code: no cut-out, no object, no clear area, no reading; no zoom nor push; well under 24 000 characters.
  assert.deepEqual(checkMotionCode(bientot.code), []);
  assert.deepEqual([subjectsDrawn(bientot.code), objectsDrawn(bientot.code), clearsDrawn(bientot.code), readsDrawn(bientot.code)], [[], [], [], []]);
  assert.doesNotMatch(bientot.code, /transform|\bscale\(/);
  assert.ok(bientot.code.length < 12000);
  // Its finish takes out the grade its code draws (its black and white, or her colours).
  assert.deepEqual(bientot.finish, { saturation: 0, contrast: 0, exposure: 0 });
  assert.deepEqual(bientot.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["compteur", ["88", "100"]], ["couleur", ["noir-et-blanc", "couleur"]], ["format", ["auto", "vertical", "horizontal"]]]);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

const LINE = bientot.timeline(56, { end: false });
const MARKS = Object.fromEntries(Object.entries(LINE.marks).map(([k, v]) => [k, String(Math.round(v * 1000) / 1000)]));

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; brand?: Record<string, unknown>; aspects?: (i: number) => number; end?: { title: string; subtitle?: string; from: number } | null; reelTexts?: unknown[]; duration?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Img: "Img", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${bientot.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const duration = props.duration ?? Math.round(LINE.duration * 30);
  const shots = LINE.shots.map((s, i) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect: props.aspects ? props.aspects(i) : 9 / 16 }));
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: duration,
    brand: { name: "Atelier Rose", displayFont: "Playfair Display", bodyFont: "Jost", ...props.brand },
    shots,
    reelTexts: props.reelTexts ?? [
      { text: "Nouvelle collection", role: "hook", from: 91, to: 177, emphasis: [] },
      { text: "Atelier Rose", role: "caption", from: 194, to: duration, emphasis: [] },
    ],
    end: props.end ?? null,
    texts: { ...MARKS, ...props.texts },
  });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
const footage = (tree: Drawn) => flatten(tree).find((n) => n.type === "Footage") ?? null;
const counterAt = (tree: Drawn) => {
  const c = flatten(tree).find((n) => n.props.key === "count");
  return c ? String(c.children.join("")).replace(/\s/g, "") : null;
};
const textOf = (n: Drawn) => String(n.children.join(""));
const fits = (tree: Drawn) => flatten(tree).filter((n) => n.type === "FitText");

test("« Teaser qui se charge »: her flashes one after the other in black and white, each replay its slot again from its first image", () => {
  // Her first slot full frame, in its black and white, from the first image.
  const first = footage(drawAt(0))!;
  assert.equal(first.props.shot, 0);
  assert.deepEqual([styleOf(first).left, styleOf(first).top, styleOf(first).width, styleOf(first).height], [0, 0, 1080, 1920]);
  assert.match(String(styleOf(first).filter), /grayscale\(1\)/);
  assert.equal(first.props.at, undefined);
  // Each slot on its own flash; a replay shows the slot it replays, from its first image (the original's same images).
  assert.equal(footage(drawAt(LINE.marks.word!))!.props.shot, 32);
  const still = footage(drawAt(LINE.marks.replay1_at!))!;
  assert.deepEqual([still.props.shot, still.props.at], [35, LINE.marks.replay1_at]);
  const run = [2, 3, 4, 5, 6, 7, 8].map((k) => footage(drawAt(LINE.marks[`replay${k}_at`]! + 1))!);
  assert.deepEqual(run.map((f) => f.props.shot), [34, 31, 18, 5, 2, 15, 12]);
  assert.deepEqual(run.map((f) => f.props.at), [2, 3, 4, 5, 6, 7, 8].map((k) => LINE.marks[`replay${k}_at`]));
  // Slot 45 shows only on its own flash, then the run; its next slot after it.
  assert.equal(footage(drawAt(127))!.props.shot, 45);
  assert.equal(footage(drawAt(148))!.props.shot, 46);
  // Her colours when her words ask; her logo's black from its beat on, no shot under it.
  assert.equal(styleOf(footage(drawAt(10, { texts: { couleur: "couleur" } }))!).filter, undefined);
  assert.equal(footage(drawAt(LINE.marks.logo!)), null);
  assert.equal(footage(drawAt(LINE.marks.logo! - 1))!.props.shot, 55);
});

test("« Teaser qui se charge »: each shot in its box as filmed (a horizontal one whole in its band on black, a square one in its square), or as her words ask", () => {
  const box = (f: number, aspects: (i: number) => number, texts?: Record<string, string>) => {
    const s = styleOf(footage(drawAt(f, { aspects, ...(texts ? { texts } : {}) }))!);
    return [s.left, s.top, s.width, s.height];
  };
  // Slot 19 horizontal (the original's band, images 54 to 56): whole in a 16:9 band at the middle, on black.
  const wide = (i: number) => (i === 19 ? 16 / 9 : 9 / 16);
  assert.deepEqual(box(55, wide), [0, 656, 1080, 608]);
  assert.deepEqual(box(50, wide), [0, 0, 1080, 1920]);
  assert.deepEqual(box(55, () => 1), [0, 420, 1080, 1080]);
  // All full frame, or all in a 16:9 band, as her words ask.
  assert.deepEqual(box(55, wide, { format: "vertical" }), [0, 0, 1080, 1920]);
  assert.deepEqual(box(50, wide, { format: "horizontal" }), [0, 656, 1080, 608]);
  // Its background is black (the band's black, its ending's).
  assert.equal(styleOf(drawAt(55, { aspects: wide })).backgroundColor, "#000000");
});

test("« Teaser qui se charge »: its counter at the centre on its own clock, 1 to 88 % (the original's values), then her word in its place", () => {
  // The original's values: 1 % on images 0 to 2, then 3 % more every three images, its one jump of 4 (78 to 82), 88 last.
  const values = [0, 2, 3, 6, 9, 45, 78, 81, 85, 88].map((f) => counterAt(drawAt(f)));
  assert.deepEqual(values, ["1%", "1%", "3%", "6%", "9%", "45%", "78%", "82%", "85%", "88%"]);
  // Gone just before her word (two images without text, as the original), never with it.
  assert.equal(counterAt(drawAt(LINE.marks.off!)), null);
  assert.equal(fits(drawAt(LINE.marks.off!)).length, 0);
  assert.equal(counterAt(drawAt(LINE.marks.word!)), null);
  // To 100 % when her words say it is ready.
  assert.equal(counterAt(drawAt(LINE.marks.off! - 1, { texts: { compteur: "100" } })), "100%");
  assert.equal(counterAt(drawAt(0, { texts: { compteur: "100" } })), "1%");
  // At the very centre, white, its figures lining and 3,2 % of the height (Playfair Display's capitals are 0,708 of its
  // size), a tight shadow.
  const c = flatten(drawAt(40)).find((n) => n.props.key === "count")!;
  const s = styleOf(c);
  assert.equal(Number(s.top) + Number(s.height) / 2, 960);
  assert.deepEqual([s.left, s.width, s.color, s.fontSize, s.fontVariantNumeric], [140, 800, "#ffffff", 87, "lining-nums"]);
  assert.ok(Math.abs((0.708 * Number(s.fontSize)) / 1920 - 0.032) < 0.001);
  assert.match(String(s.textShadow), /0 1px 5px/);
  // Her word from its beat to her logo, the same place, its capitals 2,8 % of the height, inside x 140 – 940.
  const word = (f: number) => fits(drawAt(f)).find((n) => String(n.props.key).startsWith("w-"));
  assert.equal(word(LINE.marks.word! - 1), undefined);
  const w = word(LINE.marks.word!)!;
  assert.equal(textOf(w), "Nouvelle collection");
  const ws = styleOf(w);
  assert.deepEqual([ws.left, ws.width, Number(ws.top) + Number(ws.height) / 2], [140, 800, 960]);
  assert.ok(Math.abs((0.708 * Number((w.props.innerStyle as Record<string, number>).fontSize)) / 1920 - 0.028) < 0.001);
  assert.ok(word(LINE.marks.logo! - 1));
  assert.equal(word(LINE.marks.logo!), undefined);
});

test("« Teaser qui se charge »: its ending on black, her logo then her name in spaced capitals (never the original's), her card after", () => {
  const logoAt = (f: number, brand?: Record<string, unknown>) => flatten(drawAt(f, brand ? { brand } : {})).find((n) => n.type === "Img") ?? null;
  const nameAt = (f: number, extra: Parameters<typeof drawAt>[1] = {}) => fits(drawAt(f, extra)).find((n) => String(n.props.key).startsWith("n-")) ?? null;
  const withLogo = { logoUrl: "/logo.png" };
  // Her logo on the black from its beat to her name's, large and centred; white when it is a dark one-colour logo.
  assert.equal(logoAt(LINE.marks.logo! - 1, withLogo), null);
  const logo = logoAt(LINE.marks.logo!, withLogo)!;
  const ls = styleOf(logo);
  assert.deepEqual([ls.left, ls.top, ls.width, ls.height, ls.objectFit, ls.filter], [162, 595, 756, 826, "contain", "none"]);
  assert.equal(styleOf(logoAt(180, { ...withLogo, logoOnDark: "white" })!).filter, "brightness(0) invert(1)");
  assert.equal(logoAt(LINE.marks.name!, withLogo), null);
  // Her name from its beat (from the black when she has no logo), in thin spaced capitals of her text face, at the
  // centre, as tall as the original's (3,3 % of the height: Jost's capitals are 0,7 of its size).
  assert.equal(nameAt(LINE.marks.name! - 1, { brand: withLogo }), null);
  const name = nameAt(LINE.marks.name!, { brand: withLogo })!;
  assert.equal(textOf(name), "Atelier Rose");
  const inner = name.props.innerStyle as Record<string, string | number>;
  assert.deepEqual([inner.textTransform, inner.letterSpacing, inner.fontSize, inner.fontWeight], ["uppercase", "0.08em", 90, 300]);
  assert.ok(Math.abs((0.7 * Number(inner.fontSize)) / 1920 - 0.033) < 0.001);
  assert.match(String(inner.fontFamily), /^'Jost'/);
  assert.ok(nameAt(LINE.marks.logo!));
  // Nothing of the original's own is ever drawn: no badge, no butterfly, no « MAISON », no « Coming soon ».
  assert.doesNotMatch(bientot.code, /MAISON|Coming soon|butterfly|papillon|LIFE/);
  // Its ending card after her name, on the black: its title in her title face, its line under it; her name gone.
  const duration = Math.round(LINE.duration * 30) + 51;
  const end = { title: "Ouverture le 12 novembre", subtitle: "12 rue des Martyrs", from: duration - 48 };
  const card = fits(drawAt(duration - 40, { end, duration }));
  assert.deepEqual(card.map(textOf), ["Ouverture le 12 novembre", "12 rue des Martyrs"]);
  assert.equal(nameAt(duration - 40, { end, duration }), null);
  assert.ok(nameAt(duration - 49, { end, duration }));
  // Each of its words inside the safe zone: between x 140 and 940, above the bottom quarter.
  for (const f of [40, 120, 200, duration - 40]) {
    for (const n of fits(drawAt(f, { end, duration, brand: withLogo }))) {
      const b = styleOf(n) as unknown as Box;
      assert.ok(b.left >= 140 && b.left + b.width <= 940 && b.top >= 80 && b.top + b.height <= 1440, `${textOf(n)}: ${JSON.stringify(b)}`);
    }
  }
});
