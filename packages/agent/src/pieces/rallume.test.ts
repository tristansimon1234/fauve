import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { pieceCode, pieceTestPlan, readPieceFill } from "../pieces.ts";
import { editPlanSchema } from "../schemas.ts";
import { ANY_SHOT, clearsDrawn, drawsSubject, objectsDrawn, readsDrawn, subjectShots } from "../subject.ts";
import { rallume, rallumeTimeline } from "./rallume.ts";

// « La pièce qui se rallume », the effect of the bank (rallume.ts): its own checks, beside the bank's (features.test.ts).

type Box = { x: number; y: number; w: number; h: number };
type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/**
 * Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes, what the engine
 * reads before the render given (its objects' pieces by name, its light under a box), ClearBox giving its fallback.
 */
function draw(code: string, frame: number, props: Record<string, unknown>, read: { parts?: Record<string, Box[]>; light?: (box: Box | null) => { mean: number; high: number } | null } = {}): Drawn | null {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    ClearBox: (_shot: unknown, _frame: number, _laid: unknown, options?: { fallback?: unknown }) => options?.fallback ?? null,
    SubjectParts: (_shot: unknown, _frame: number, _laid: unknown, object?: string) => read.parts?.[object ?? ""] ?? [],
    LightUnder: (_shot: unknown, _frame: number, _laid: unknown, box?: Box | null) => read.light?.(box ?? null) ?? null,
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn | null;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  return [node as Drawn, ...(node as Drawn).children.flatMap(nodes)];
};
const styleOf = (n: Drawn) => (n.props.style ?? {}) as Record<string, string | number>;
const textOf = (n: Drawn): string => nodes(n).flatMap((m) => m.children.flat(Infinity).filter((c): c is string => typeof c === "string")).join(" ");
/** The filter its room is drawn with in the dark (its first Footage, full frame). */
const tone = (tree: Drawn | null) => String(styleOf(nodes(tree).find((n) => n.type === "Footage")!).filter ?? "");
/** What it lights at a frame: each kind drawn at its own light through its lit pieces' ovals (its cut-out, or her shot itself), and how many. */
const lit = (tree: Drawn | null) =>
  nodes(tree)
    .filter((n) => n.type === "div" && /^brightness\(1\.18\)/.test(String(styleOf(n).filter ?? "")))
    .map((n) => {
      const cut = nodes(n).find((m) => m.type === "div" && /radial-gradient\(ellipse/.test(String(styleOf(m).maskImage ?? "")))!;
      const drawnIn = nodes(cut).find((m) => m.type === "Subject" || m.type === "Footage")!;
      return [drawnIn.type === "Subject" ? String(drawnIn.props.object) : "her shot", (String(styleOf(cut).maskImage).match(/radial-gradient\(/g) ?? []).length] as const;
    });
const nameOf = (tree: Drawn | null, words: string) => nodes(tree).find((n) => n.type === "FitText" && textOf(n).includes(words));

/** Its room shot as its layer gets it: the lead shot before it, the room under its span (150 images), the next one after. */
const shots = [
  { src: "/lead.mp4", aspect: 16 / 9, from: -36, durationInFrames: 36, kind: "video", segment: 0 },
  { src: "/room.mp4", aspect: 16 / 9, from: 0, durationInFrames: 150, kind: "video", segment: 1 },
];
const at96 = rallumeTimeline({ frames: 150, bpm: 96, shots: [{ from: 0, frames: 150 }], words: { nom: "Le Comptoir", ligne: "bar à vins" }, settings: {} });
const marks = { beat: "18.75", ...Object.fromEntries(Object.entries(at96.marks!).map(([k, v]) => [k, String(v)])) };
const props = (texts: Record<string, string> = {}) => ({ width: 1080, height: 1920, durationInFrames: 150, brand: { name: "Le Comptoir", displayFont: "Instrument Serif", bodyFont: "Inter Tight", accent: "#b5543a" }, shots, texts: { ...marks, nom: "Le Comptoir", ligne: "bar à vins", ...texts } });

test("« La pièce qui se rallume » (effect v2): its lights on the beat faster and faster, its dark about half its shot, her name's time kept", () => {
  // At its skill's tempo over 5 s: its skill's own steps (beats 0, 1, 1,5, 2, 2,5, 2,75, 3, 3,25), the whole room on beat 4.
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((k) => at96.marks![`step_${k}`]), [0, 19, 28, 38, 47, 52, 56, 61]);
  assert.equal(at96.marks!.all, 75);
  // A soft click on each light, the first a little louder, a heavier one on the room.
  assert.deepEqual(at96.sounds!.map((s) => [Math.round(s.at * 30), s.sound]), [...[0, 19, 28, 38, 47, 52, 56, 61].map((f) => [f, "light switch click"]), [75, "heavy light switch clunk"]]);
  assert.ok(at96.sounds![8]!.gain! > at96.sounds![0]!.gain! && at96.sounds![0]!.gain! > at96.sounds![1]!.gain!);
  assert.equal(at96.cutouts, undefined);
  // Her music muffled as through a wall while the room is dark, open at once when it all comes on.
  assert.deepEqual(at96.music, { filters: [{ kind: "muffled", from: 0, to: 2.5 }] });
  // On any tempo and length it takes: its dark in whole beats (a bar, two, half a bar, a beat), about half its shot, 4 s
  // at most, its steps faster and faster before it, her name then lit long enough to read; its sounds within its span.
  for (const bpm of [60, 72, 84, 96, 110, 120, 128, 140]) {
    for (let seconds = rallume.seconds[0]; seconds <= rallume.seconds[1]; seconds += 0.5) {
      const frames = Math.round(seconds * 30);
      for (const nom of ["Lino", "Café des Arts"]) {
        const line = rallumeTimeline({ frames, bpm, shots: [{ from: 0, frames }], words: { nom }, settings: {} });
        const beat = (60 / bpm) * 30;
        const all = line.marks!.all!;
        const steps = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => line.marks![`step_${k}`]!);
        const where = `${bpm} BPM, ${seconds} s, « ${nom} »`;
        assert.ok([1, 2, 4, 8].some((d) => Math.abs(all - d * beat) <= 0.5), `${where}: its dark ${all} images, ${all / beat} beats`);
        assert.ok(all <= 120, where);
        assert.ok(steps[0] === 0 && steps.every((f, i) => i === 0 || f >= steps[i - 1]!) && steps[7]! < all, `${where}: ${steps}`);
        const read = Math.max(1.2, 0.8 + 0.3 * nom.split(" ").length);
        assert.ok(frames - all >= Math.max(2 * beat, 45, 3 + read * 30) - 0.5, `${where}: her name lit ${frames - all} images`);
        assert.ok(line.sounds!.every((s) => s.at >= 0 && s.at < seconds - 0.05), where);
      }
    }
  }
  // About half its shot: a longer shot holds a longer dark on the same tempo (two bars on 7 s at 120 BPM).
  const long = rallumeTimeline({ frames: 210, bpm: 120, shots: [{ from: 0, frames: 210 }], words: { nom: "Lino" }, settings: {} });
  assert.equal(long.marks!.all, 120);
  // Laid past her room shot (another shot under its end): its dark within the room, her name lit before its cut.
  const two = rallumeTimeline({ frames: 180, bpm: 96, shots: [{ from: 0, frames: 120 }, { from: 120, frames: 60 }], words: { nom: "Lino" }, settings: {} });
  assert.ok(two.marks!.all! <= 120 - 45, `${two.marks!.all}`);
  // A room shot that started before it: its marks still from its own first image.
  assert.equal(rallumeTimeline({ frames: 150, bpm: 96, shots: [{ from: -20, frames: 170 }], words: { nom: "Lino" }, settings: {} }).marks!.all, 75);
});

test("« La pièce qui se rallume » (effect v2): its layer over her room shot, its lamps named there, nothing of her cut out, her name required", () => {
  const run = [
    { file: "lead", at: 1, seconds: 1.2 },
    { file: "room", at: 5, seconds: 5 },
    { file: "after", at: 1, seconds: 1.5 },
  ];
  const plan = pieceTestPlan({ piece: rallume, shots: run, span: [1.2, 6.2], fill: { texts: { nom: "Le Comptoir" }, objects: { lampes: "every pendant lamp", rangees: "every bottle" }, settings: {} }, bpm: 96 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  // Its lamps and bottles on its first shot (the second of her shots), followed only there; her own cut-out never asked.
  assert.deepEqual(motion.drawn, { shots: 3, objects: [{ shot: 1, name: "every pendant lamp" }, { shot: 1, name: "every bottle" }] });
  assert.deepEqual([...subjectShots(plan)], []);
  assert.equal(drawsSubject(motion.code), false);
  assert.deepEqual(objectsDrawn(motion.code).map((o) => o.name), ["every pendant lamp", "every bottle"]);
  // Its calm area and its light read on the shots under it (her room).
  assert.deepEqual(clearsDrawn(motion.code), [ANY_SHOT]);
  assert.deepEqual(readsDrawn(motion.code), [{ shot: ANY_SHOT, kinds: ["light"] }]);
  // Its marks, its words (its line left out: optional), its clicks within its span, marked as a skill's.
  assert.equal(motion.texts!.beat, "18.75");
  assert.equal(motion.texts!.all, "75");
  assert.equal(motion.texts!.nom, "Le Comptoir");
  assert.equal(motion.texts!.ligne, undefined);
  assert.equal(motion.sounds?.length, 9);
  assert.ok(motion.sounds!.every((s) => s.skill && s.at < 5));
  assert.deepEqual(motion.piece, { key: "rallume", version: rallume.version });
  assert.deepEqual(checkMotionCode(motion.code!), []);
  // An object its filler found nothing for stays « @… » in its code: no object followed, its code does without.
  assert.ok(pieceCode(rallume, {}).includes('"@lampes"'));
  assert.deepEqual(objectsDrawn(pieceCode(rallume, {})), []);
  // Her name is its sign: without it, nothing plays; her line only when given; her colour only on her word.
  const answer = { fits: true, missing: "", texts: [{ slot: "nom", text: "Le Comptoir du Marais de Paris" }, { slot: "ligne", text: "" }], objects: [{ slot: "lampes", name: "every pendant lamp" }], settings: [{ name: "couleur", value: "sienne" }] };
  const fill = readPieceFill(rallume, answer)!;
  assert.equal(fill.texts.nom, "Le Comptoir du");
  assert.equal(fill.texts.ligne, undefined);
  assert.deepEqual(fill.settings, { couleur: "sienne" });
  assert.equal(readPieceFill(rallume, { ...answer, texts: [{ slot: "ligne", text: "bar à vins" }] }), null);
  assert.deepEqual(readPieceFill(rallume, { ...answer, settings: [{ name: "couleur", value: "chaude" }] })!.settings, {});
});

test("« La pièce qui se rallume » (effect v2): dark, her lamps lit one by one at their own light, all at once on the beat, her name like a sign, to the cut", () => {
  const code = pieceCode(rallume, { lampes: "every pendant lamp", rangees: "every bottle" });
  // Ten lamps across the top of her room (and one off the frame, which never counts), three bottles under them.
  const lamps = [-120, ...Array.from({ length: 10 }, (_, i) => 60 + i * 96)].map((x) => ({ x, y: 300, w: 60, h: 90 }));
  const bottles = [300, 500, 700].map((x) => ({ x, y: 800, w: 30, h: 110 }));
  const read = { parts: { "every pendant lamp": lamps, "every bottle": bottles } };
  const at = (f: number, r: Parameters<typeof draw>[3] = read, texts: Record<string, string> = {}, c = code) => draw(c, f, props(texts), r);
  // The room dark from its first image (a fifth of its light without a reading, cooler), its first lamps already on.
  assert.equal(tone(at(0)), "brightness(0.240) saturate(0.7)");
  assert.ok(nodes(at(0)).some((n) => styleOf(n).mixBlendMode === "multiply"));
  assert.deepEqual(lit(at(0)), [["every pendant lamp", 2]]);
  // Then more on each step (thirteen pieces on eight steps), what is lit staying lit: its lamps first, then its bottles.
  assert.deepEqual(lit(at(30)), [["every pendant lamp", 5]]);
  assert.deepEqual(lit(at(50)), [["every pendant lamp", 9]]);
  assert.deepEqual(lit(at(55)), [["every pendant lamp", 10]]);
  assert.deepEqual(lit(at(58)), [["every pendant lamp", 10], ["every bottle", 2]]);
  assert.deepEqual(lit(at(74)), [["every pendant lamp", 10], ["every bottle", 3]]);
  // Each lit piece through its own soft oval, a little larger than its box (only its cut-out's pixels light).
  const masks = String(styleOf(nodes(at(30)).find((n) => /radial-gradient\(ellipse/.test(String(styleOf(n).maskImage ?? "")))!).maskImage);
  assert.match(masks, /^radial-gradient\(ellipse 66px 82px at 90px 345px, #000 0%, #000 74%, rgba\(0,0,0,0\) 100%\)/);
  // A warm pool from each lit piece, in screen, its bloom from its own highlights.
  const pools = nodes(at(30)).find((n) => styleOf(n).mixBlendMode === "screen" && /radial-gradient\(circle/.test(String(styleOf(n).background)))!;
  assert.equal((String(styleOf(pools).background).match(/radial-gradient/g) ?? []).length, 5);
  assert.ok(nodes(at(30)).some((n) => /^contrast\(2\.6\)/.test(String(styleOf(n).filter ?? "")) && styleOf(n).opacity === 0.85));
  // The whole room at once on the beat: two images brighter, a warm veil, then as filmed; nothing cut out any more,
  // its pools fading over ten images; then only her name over the montage's own shot.
  assert.equal(tone(at(75)), "brightness(1.3)");
  assert.equal(tone(at(76)), "brightness(1.12)");
  assert.equal(tone(at(77)), "");
  assert.ok(nodes(at(75)).some((n) => styleOf(n).background === "#fff1dc"));
  assert.equal(nodes(at(75)).filter((n) => n.type === "Subject").length, 0);
  assert.equal(nodes(at(90)).filter((n) => n.type === "Footage").length, 0);
  // Her name catches like a neon with it (off, on, almost off, on, half, on), its line three images later as a label.
  const glow = (f: number) => {
    const n = nameOf(at(f), "Le Comptoir");
    return n ? Number((n.props.innerStyle as Record<string, number>).opacity) : 0;
  };
  assert.deepEqual([74, 75, 76, 77, 78, 79, 80].map(glow), [0, 0, 1, 0.3, 1, 0.55, 1]);
  assert.equal(nameOf(at(78), "bar à vins"), undefined);
  const label = nameOf(at(120), "bar à vins")!;
  assert.ok(nodes(label).some((n) => "data-fauve-accent" in n.props));
  // In the calm part of her room (ClearBox's fallback here: high in the frame), inside the apps' safe zone, to the cut.
  const box = nameOf(at(120), "Le Comptoir")!.props.style as { left: number; top: number; width: number; height: number };
  assert.ok(box.left >= 140 && box.left + box.width <= 940 && box.top >= 80 && box.top + box.height <= 960, JSON.stringify(box));
  assert.ok(Number((nameOf(at(149), "Le Comptoir")!.props.innerStyle as Record<string, number>).fontSize) >= 48);
  // Her colour on her word (her accent, brightened like a lit tube), a warm white otherwise.
  assert.match(String((nameOf(at(120), "Le Comptoir")!.props.innerStyle as Record<string, string>).color), /^#fff3df$/);
  assert.match(String((nameOf(at(120, read, { couleur: "sienne" }), "Le Comptoir")!.props.innerStyle as Record<string, string>).color), /^rgb\(/);
  // Past her room shot's cut, nothing: the montage plays on.
  const short = draw(code, 100, { ...props(), shots: [shots[0], { ...shots[1], durationInFrames: 100 }, { src: "/next.mp4", aspect: 1, from: 100, durationInFrames: 50, kind: "video", segment: 2 }] }, read);
  assert.equal(short, null);
  // Few things (three lamps): one a step, then the room's own light back a notch on each step left, with a flicker.
  const few = { parts: { "every pendant lamp": lamps.slice(1, 4) } };
  assert.deepEqual(lit(at(30, few)), [["every pendant lamp", 3]]);
  assert.deepEqual([37, 38, 39, 40].map((f) => tone(at(f, few))), ["brightness(0.240) saturate(0.7)", "brightness(0.540) saturate(0.7)", "brightness(0.380) saturate(0.7)", "brightness(0.280) saturate(0.7)"]);
  // Nothing named, nothing read: the room comes back notch by notch, then all at once.
  assert.deepEqual([0, 1, 2].map((f) => tone(at(f, {}, {}, rallume.code))), ["brightness(0.540) saturate(0.7)", "brightness(0.380) saturate(0.7)", "brightness(0.280) saturate(0.7)"]);
  assert.deepEqual(lit(at(30, {}, {}, rallume.code)), []);
  assert.equal(tone(at(75, {}, {}, rallume.code)), "brightness(1.3)");
});

test("« La pièce qui se rallume » (effect v2): its dark dosed on the room's light, and without her things, her lights read on it", () => {
  // A bright room (a mean light of 0,6): darker than the skill's fifth; a dim bar (0,2): lighter, the same dark on screen
  // (her ten lamps found, no notch: its dose alone).
  const code = pieceCode(rallume, { lampes: "every pendant lamp" });
  const lamps = Array.from({ length: 10 }, (_, i) => ({ x: 60 + i * 96, y: 300, w: 60, h: 90 }));
  const dim = (mean: number) => tone(draw(code, 30, props(), { parts: { "every pendant lamp": lamps }, light: () => ({ mean, high: mean + 0.2 }) }));
  assert.equal(dim(0.6), "brightness(0.150) saturate(0.7)");
  assert.equal(dim(0.2), "brightness(0.375) saturate(0.7)");
  assert.equal(dim(0.3125), "brightness(0.240) saturate(0.7)");
  // Nothing of hers named or found: the room's small bright spots, read on its light (each much brighter than the ring
  // around it), are her lights: a lamp high in the room, a candle on a table; never a white wall larger than them.
  const spots: Box[] = [
    { x: 600, y: 240, w: 60, h: 60 },
    { x: 180, y: 300, w: 60, h: 60 },
    { x: 360, y: 1200, w: 60, h: 60 },
    { x: 60, y: 960, w: 60, h: 60 },
  ];
  const wall = { x: 0, y: 1500, w: 1080, h: 420 };
  const inBox = (b: Box, s: Box) => b.x + b.w / 2 >= s.x && b.x + b.w / 2 <= s.x + s.w && b.y + b.h / 2 >= s.y && b.y + b.h / 2 <= s.y + s.h;
  const light = (box: Box | null) => (!box ? { mean: 0.3, high: 0.6 } : spots.some((s) => inBox(box, s)) ? { mean: 0.8, high: 0.9 } : inBox(box, wall) ? { mean: 0.85, high: 0.88 } : { mean: 0.25, high: 0.3 });
  const tree = (f: number) => draw(rallume.code, f, props(), { light });
  // Four spots, one a step, her own shot lit through their ovals: the upper part of the room first (its lights), each
  // part left to right; a bright cloth just under the middle comes after the lamps high up, even when it is on the left.
  assert.deepEqual(lit(tree(0)), [["her shot", 1]]);
  assert.deepEqual(lit(tree(20)), [["her shot", 2]]);
  assert.deepEqual(lit(tree(30)), [["her shot", 3]]);
  assert.deepEqual(lit(tree(40)), [["her shot", 4]]);
  const ovals = String(styleOf(nodes(tree(40)).find((n) => /radial-gradient\(ellipse/.test(String(styleOf(n).maskImage ?? "")))!).maskImage);
  const centres = [...ovals.matchAll(/at (\d+)px (\d+)px/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(centres, [[210, 330], [630, 270], [90, 990], [390, 1230]]);
  // Their light falling off from their middle (the room around them shows, never as a disc), wider than a cut-out's.
  assert.match(ovals, /^radial-gradient\(ellipse 112px 112px at 210px 330px, #000 0%, rgba\(0,0,0,0\.9\) 22%, rgba\(0,0,0,0\.45\) 55%/);
  // Its bloom half as strong on a spot read on the light (no cut-out: a white cloth must not glow like a bulb).
  assert.ok(nodes(tree(30)).some((n) => /^contrast\(2\.6\)/.test(String(styleOf(n).filter ?? "")) && styleOf(n).opacity === 0.45));
  // Its other steps: the room's light back a notch with a flicker, its dark dosed on it (0,075 / 0,3: 0,25 for 0,24).
  assert.equal(tone(tree(46)), "brightness(0.250) saturate(0.7)");
  assert.equal(tone(tree(47)), "brightness(0.563) saturate(0.7)");
  // Her name's tube edged where the wall under it is bright, bare on a dark one.
  const shadow = (high: number) => String((nameOf(draw(rallume.code, 120, props(), { light: (b) => (b ? { mean: high - 0.1, high } : { mean: 0.3, high: 0.6 }) }), "Le Comptoir")!.props.innerStyle as Record<string, string>).textShadow);
  assert.match(shadow(0.8), /^0 0 2px rgba\(24,14,6,0\.60\)/);
  assert.match(shadow(0.2), /^0 0 \d+px rgba\(255,176,92/);
});
