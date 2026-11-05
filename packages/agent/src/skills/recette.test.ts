import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillLengths, skillPlan } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { recette, recetteSections } from "./recette.ts";

// « Pas à pas raconté », the model (recette.ts, version 1), on its original's fiche (docs/fiches/recette.md).

/** The original's cuts, the first image of each new shot: 13 to a new place, 43 in the same place (a gesture each). */
const ORIGINAL_CUTS = [31, 110, 128, 151, 172, 195, 214, 237, 256, 273, 288, 307, 356, 373, 393, 413, 433, 463, 478, 489, 508, 528, 552, 579, 595, 615, 635, 654, 677, 695, 715, 727, 756, 775, 793, 815, 832, 851, 873, 891, 912, 927, 945, 978, 999, 1028, 1062, 1089, 1121, 1157, 1176, 1203, 1238, 1261, 1287, 1307];

test("« Pas à pas raconté » (v1): its 57 shots on its original's cuts, 44,97 s at 85 BPM, its words over their sections", () => {
  assert.equal(recette.version, 1);
  assert.equal(recette.bpm, 85);
  const line = recette.timeline(57, { end: false });
  // 1349 images, the original's; each of its 56 cuts within an image of the original's.
  assert.equal(line.shots.length, 57);
  assert.equal(Math.round(line.duration * 30), 1349);
  const cuts = line.shots.slice(1).map((s) => Math.round(s.start * 30));
  cuts.forEach((c, i) => assert.ok(Math.abs(c - ORIGINAL_CUTS[i]!) <= 1, `cut ${i + 1}: ${c} for ${ORIGINAL_CUTS[i]}`));
  // Its sections: the piece lifted, its eleven steps where the original's places change, the end where he tastes.
  assert.deepEqual(line.marks, { lift: 31, steps: 11, s1: 110, s2: 237, s3: 307, s4: 463, s5: 528, s6: 654, s7: 756, s8: 815, s9: 873, s10: 1028, s11: 1176, taste: 1261 });
  // Its hook over her result and the piece lifted, its steps' words over its steps (three slots that follow one another:
  // a plan's text holds 120 signs), its end's over her tasting.
  const steps = { from: 3.67, to: 42.03 };
  assert.deepEqual(line.texts, { accroche: { from: 0, to: 3.67 }, etapes_1: steps, etapes_2: steps, etapes_3: steps, fin: { from: 42.03, to: 44.97 } });
  assert.deepEqual(recette.texts.map((t) => [t.slot, t.role, t.max, t.required]), [["accroche", "hook", 64, true], ["etapes_1", "band", 118, true], ["etapes_2", "band", 118, false], ["etapes_3", "band", 118, false], ["fin", "caption", 40, true]]);
  // Each slot wants what the original films there: the result from the front, the piece close, each step's first
  // gesture (three of them from the front), its next ones the same video just after, the tasting at the lens.
  const wants = line.shots.map((s) => s.want);
  assert.match(wants[0]!, /^son résultat fini, de face/);
  assert.match(wants[1]!, /de tout près/);
  assert.match(wants[2]!, /^l'étape 1 sur 11, .*de face, à hauteur de son plan de travail/);
  assert.match(wants[3]!, /^la même vidéo que la case précédente, juste après/);
  assert.match(wants[12]!, /^l'étape 3 sur 11, .*au-dessus de son plan de travail/);
  assert.match(wants[54]!, /^la fin : elle, ou un client, goûte/);
  assert.equal(wants.filter((w) => /^l'étape/.test(w)).length, 11);
  // No sound of its own, its music as composed (the original's bed under his voice has no shape to give).
  assert.equal(line.sounds, undefined);
  assert.equal(line.music, undefined);
});

test("« Pas à pas raconté »: 12 to 57 shots, its steps thinned then taken out, never past 45 s", () => {
  const counts = (n: number) => recetteSections(n).steps.map((s) => s.gestures.length);
  // Down to 38: every step thinned to three gestures (its middle ones out); then whole steps out, a gesture at a time,
  // until three are left: the first, the ninth (the cooking) and the last (the finishing touch); then the bite and a
  // gesture of the first.
  assert.deepEqual(counts(38), Array(11).fill(3));
  assert.deepEqual(recetteSections(14).steps.map((s) => s.at), [0, 8, 10]);
  assert.deepEqual(counts(14), [3, 3, 3]);
  assert.deepEqual(recetteSections(12), { steps: [{ at: 0, gestures: [18, 23] }, { at: 8, gestures: [18, 21, 29] }, { at: 10, gestures: [27, 35, 23] }], taste: [26, 42] });
  assert.deepEqual(recetteSections(57).steps.map((s) => s.gestures), [[18, 23, 21, 23, 19, 23], [19, 17, 15, 19], [49, 17, 20, 20, 20, 30], [15, 11, 19, 20], [24, 27, 16, 20, 20, 19], [23, 18, 20, 12, 29], [19, 18, 22], [17, 19, 22], [18, 21, 15, 18, 33, 21, 29], [34, 27, 32, 36, 19], [27, 35, 23]]);
  assert.deepEqual([recette.shots, recette.files], [[12, 57], [4, 16]]);
  for (let n = 12; n <= 57; n++) {
    for (const end of [false, true]) {
      for (const bpm of [72, 85, 102]) {
        const line = recette.timeline(n, { end, bpm });
        assert.equal(line.shots.length, n);
        assert.ok(line.duration <= 45, `${n} shots at ${bpm}: ${line.duration} s`);
        // Every step's words over its own step, its marks in order.
        assert.equal(line.marks.steps, recetteSections(n).steps.length);
        for (let k = 2; k <= line.marks.steps!; k++) assert.ok(line.marks[`s${k}`]! > line.marks[`s${k - 1}`]!);
      }
    }
  }
  // Its lengths: 12,4 s at its fewest, about 23 s for eight of her videos (24 shots), its original's 44,97 s at most.
  assert.ok(Math.abs(recette.timeline(12, { end: false }).duration - 12.4) < 0.02);
  assert.ok(Math.abs(recette.timeline(24, { end: false }).duration - 22.67) < 0.02);
  assert.deepEqual(skillLengths(recette), { min: 10.33, max: 45 });
  // An ending card: her last gesture longer by whole beats (1,6 s at least), her end's words up to it.
  const line = recette.timeline(24, { end: false });
  const ended = recette.timeline(24, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6);
  assert.equal(ended.texts.fin!.to, Math.round((ended.duration - 1.6) * 100) / 100);
  // At another tempo, every length counted in beats follows it.
  const fast = recette.timeline(24, { end: false, bpm: 102 });
  assert.ok(Math.abs(fast.duration / line.duration - 85 / 102) < 0.01);
  assert.ok(Math.abs(fast.marks.taste! / line.marks.taste! - 85 / 102) < 0.01);
});

test("« Pas à pas raconté »: its plan (its words by role), nothing cut out nor followed, light to render", () => {
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 14 }));
  const line = recette.timeline(24, { end: false });
  const fill = {
    shots: line.shots.map((_, i) => ({ file: files[Math.min(7, Math.floor(i / 3))]!.id, at: (i % 3) * 3 })),
    texts: { accroche: "si tu veux un bouquet qui tient deux semaines", etapes_1: "les tiges, en biais / l'eucalyptus d'abord / le ruban", fin: "et voilà le travail" },
    end: null,
  };
  const plan = skillPlan({ skill: recette, name: "Pas à pas raconté", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.texts.map((t) => [t.style, t.text]), [["hook", fill.texts.accroche], ["band", fill.texts.etapes_1], ["caption", fill.texts.fin]]);
  assert.deepEqual(plan.skill, { key: "recette", version: 1 });
  assert.equal(plan.tempo, 85);
  assert.equal(plan.sounds, undefined);
  assert.equal(plan.music_shape, undefined);
  assert.equal(plan.layers![0]!.motion.drawn, undefined);
  assert.deepEqual(checkMotionCode(recette.code), []);
  assert.deepEqual([subjectsDrawn(recette.code), objectsDrawn(recette.code), clearsDrawn(recette.code), readsDrawn(recette.code)], [[], [], [], []]);
  assert.ok(recette.code.length < 24000);
  assert.doesNotMatch(recette.code, /transform|scale\(/);
  assert.deepEqual(recette.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]]]);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };
type Face = { x: number; y: number; width: number; height: number };

const HOOK = "si tu veux un bouquet qui tient deux semaines";
const STEPS3 = "les tiges, en biais / l'eucalyptus d'abord, puis les roses / le ruban";
const FIN = "et voilà le travail";

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, options: { n?: number; aspect?: number; texts?: Record<string, string>; reel?: { text: string; role: string; from?: number; to?: number }[]; brand?: Record<string, unknown>; end?: unknown; end_card?: boolean; faces?: (f: number) => Face[] } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${recette.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const line = recette.timeline(options.n ?? 14, { end: Boolean(options.end_card) });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const durationInFrames = Math.round(line.duration * 30);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 9 / 16, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
  const at = (slot: string) => line.texts[slot]!;
  const reelTexts = (
    options.reel ?? [
      { text: HOOK, role: "hook", from: Math.round(at("accroche").from * 30), to: Math.round(at("accroche").to * 30) },
      { text: STEPS3, role: "band", from: Math.round(at("etapes_1").from * 30), to: Math.round(at("etapes_1").to * 30) },
      { text: FIN, role: "caption", from: Math.round(at("fin").from * 30), to: Math.round(at("fin").to * 30) },
    ]
  ).map((t) => ({ from: 0, to: durationInFrames, emphasis: [], ...t }));
  const brand = { name: "Atelier Rose", displayFont: "Gelasio", bodyFont: "Gelasio", accent: "#b5293f", palette: { light: "#f6efe4", dark: "#1d1b19" }, ...options.brand };
  const track = options.faces ? (f: number) => ({ hands: [], bodies: [], faces: options.faces!(f) }) : undefined;
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots, reelTexts, end: options.end ?? null, texts: { ...marks, ...options.texts }, ...(track ? { track } : {}) });
}

const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const own = (node: Drawn): string => (node.children.flat(Infinity) as unknown[]).filter((c): c is string => typeof c === "string").join("");
/** The words seen at a frame: each FitText's text (one subtitle at a time, its ending card's two lines). */
const seen = (tree: Drawn) => nodes(tree).filter((n) => n.type === "FitText");
/** All its text in the page, seen or hidden, in order (what the scene check reads as the copy's text). */
const page = (tree: Drawn) => nodes(tree).map(own).join("");
const plain = (s: string) => s.replace(/\s+/g, "").toLowerCase();
/** The subtitles shown over a span of frames, each with the frames it holds. */
function shown(from: number, to: number, options: Parameters<typeof drawAt>[1] = {}): { text: string; from: number; to: number }[] {
  const out: { text: string; from: number; to: number }[] = [];
  for (let f = from; f < to; f++) {
    const text = seen(drawAt(f, options)).map(own).join(" | ");
    const last = out[out.length - 1];
    if (last && last.text === text && last.to === f) last.to = f + 1;
    else out.push({ text, from: f, to: f + 1 });
  }
  return out;
}

test("« Pas à pas raconté » writes her words as subtitles: one group at a time, in the middle, cut in on the gestures", () => {
  const line = recette.timeline(14, { end: false });
  const s1 = line.marks.s1!;
  // Its hook from the first image, in groups of one to three words (« si tu veux » never broken after « tu »), each
  // cut in whole; a group of three words held 1,4 s at least, the time to read it.
  const hook = shown(0, s1);
  assert.deepEqual(hook.map((g) => g.text), ["si tu veux", "un bouquet", "qui tient", "deux semaines"]);
  assert.equal(hook[0]!.from, 0);
  assert.ok(hook[0]!.to - hook[0]!.from >= 41, JSON.stringify(hook));
  // Set as the original's: centred, its middle at half the height, a bold serif of 64 px in her display font, a warm white.
  const word = seen(drawAt(10))[0]!;
  assert.deepEqual(styleOf(word), { position: "absolute", left: 140, top: 908, width: 800, height: 104 });
  const type = word.props.innerStyle as Record<string, string | number>;
  assert.deepEqual([type.fontSize, type.fontWeight, type.color, String(type.fontFamily).split(",")[0]], [64, 700, "#fefaf6", "'Gelasio'"]);
  // The whole hook in the page all along (the hidden groups, the marks), so the check finds it whole.
  for (const f of [0, 40, 100]) assert.ok(plain(page(drawAt(f))).includes(plain(HOOK)), String(f));
  // Over her first step (three gestures, two groups): its first group on its first gesture, the next on a cut.
  const step = shown(s1, line.marks.s2!);
  assert.deepEqual(step.map((g) => g.text), ["les tiges", "en biais"]);
  assert.equal(step[0]!.from, s1);
  const cuts = line.shots.map((s) => Math.round(s.start * 30));
  assert.ok(cuts.includes(step[1]!.from), `${step[1]!.from} is a cut`);
  // Each step's words over their own step: the second and the third, a comma always a change.
  assert.deepEqual(shown(line.marks.s2!, line.marks.s3!).map((g) => g.text), ["l'eucalyptus", "d'abord", "puis les roses"]);
  assert.deepEqual(shown(line.marks.s3!, line.marks.taste!).map((g) => g.text), ["le ruban"]);
  // The whole of its steps' words in the page during its steps.
  assert.ok(plain(page(drawAt(line.marks.s2! + 3))).includes(plain(STEPS3)));
  // Its end over her tasting, lower than the middle (under her face, which the original's words covered).
  const end = shown(line.marks.taste!, Math.round(line.duration * 30));
  assert.deepEqual(end.map((g) => g.text), ["et voilà", "le travail"]);
  assert.equal(styleOf(seen(drawAt(line.marks.taste! + 2))[0]!).top, 908 + 230);
});

test("« Pas à pas raconté »: its groups read like a creator's subtitles of the original's sentences", () => {
  const groups = (text: string) => {
    const line = recette.timeline(57, { end: false });
    const reel = [{ text, role: "hook", from: 0, to: line.marks.s1! }];
    return shown(0, line.marks.s1!, { n: 57, reel }).map((g) => g.text).filter(Boolean);
  };
  assert.deepEqual(groups("si tu veux vraiment perdre du poids"), ["si tu veux", "vraiment", "perdre du poids"]);
  assert.deepEqual(groups("les courgettes en dernier c'est le plus rapide à cuire"), ["les courgettes", "en dernier", "c'est le plus", "rapide à cuire"]);
  assert.deepEqual(groups("il te faut deux trucs : du plaisir et du volume"), ["il te faut", "deux trucs", "du plaisir", "et du volume"]);
  assert.deepEqual(groups("dans une poêle bien chaude"), ["dans une poêle", "bien chaude"]);
  // Two short neighbours from the end of the phrase: « vraiment crémeux », never « des œufs vraiment ».
  assert.deepEqual(groups("si tu veux des œufs vraiment crémeux"), ["si tu veux", "des œufs", "vraiment crémeux"]);
  assert.deepEqual(groups("à feu doux, sans arrêter"), ["à feu doux", "sans arrêter"]);
  // A number with its word, the marks never shown.
  assert.deepEqual(groups("12 raviolis, 100 calories !"), ["12 raviolis", "100 calories"]);
});

test("« Pas à pas raconté »: fewer words than steps leave a step quiet; more go to its last step; never on her face", () => {
  const line = recette.timeline(14, { end: false });
  const at = (slot: string) => ({ from: Math.round(line.texts[slot]!.from * 30), to: Math.round(line.texts[slot]!.to * 30) });
  const reel = (band: string, more?: string) => [
    { text: HOOK, role: "hook", ...at("accroche") },
    { text: band, role: "band", ...at("etapes_1") },
    ...(more ? [{ text: more, role: "band", ...at("etapes_2") }] : []),
    { text: FIN, role: "caption", ...at("fin") },
  ];
  // Its steps' words over two slots, one after the other: each step its own, in order; both whole in the page.
  const split = reel("les tiges, en biais / l'eucalyptus d'abord", "le ruban");
  assert.deepEqual(shown(line.marks.s3!, line.marks.taste!, { reel: split }).map((g) => g.text), ["le ruban"]);
  assert.deepEqual(shown(line.marks.s2!, line.marks.s3!, { reel: split }).map((g) => g.text), ["l'eucalyptus", "d'abord"]);
  for (const t of ["les tiges, en biais / l'eucalyptus d'abord", "le ruban"]) assert.ok(plain(page(drawAt(line.marks.s1! + 1, { reel: split }))).includes(plain(t)));
  // Two steps' words for three steps: the third gestures in silence.
  assert.deepEqual(shown(line.marks.s3!, line.marks.taste!, { reel: reel("les tiges / le ruban") }).map((g) => g.text), [""]);
  // Four for three: the last step tells the third and the fourth; all of them in the page.
  const more = "les tiges / le feuillage / les roses / le ruban";
  assert.deepEqual(shown(line.marks.s3!, line.marks.taste!, { reel: reel(more) }).map((g) => g.text), ["les roses", "le ruban"]);
  assert.ok(plain(page(drawAt(line.marks.s1! + 1, { reel: reel(more) }))).includes(plain(more)));
  // A face looking at the lens where the words go: under her chin; on her tasting too.
  const middle = (_f: number): Face[] => [{ x: 540, y: 900, width: 300, height: 380 }];
  const top = (f: number, faces = middle) => Number(styleOf(seen(drawAt(f, { faces }))[0]!).top) + 52;
  assert.equal(top(10), Math.round(900 + 380 * 0.62 + 74));
  // A face high in the frame leaves the middle free; a face low sends the words above it.
  assert.equal(top(10, () => [{ x: 540, y: 420, width: 260, height: 300 }]), 960);
  assert.equal(top(10, () => [{ x: 540, y: 1180, width: 320, height: 400 }]), Math.round(1180 - 200 - 74));
  // Her tasting with her face followed: under it.
  const tasting = (_f: number): Face[] => [{ x: 540, y: 700, width: 320, height: 420 }];
  assert.equal(top(line.marks.taste! + 2, tasting), Math.round(700 + 420 * 0.62 + 74));
});

test("« Pas à pas raconté »: every word in the safe zone, in both formats, its ending card readable", () => {
  for (const aspect of [9 / 16, 16 / 9]) {
    for (let f = 0; f < 400; f += 7) {
      for (const t of seen(drawAt(f, { aspect }))) {
        const b = styleOf(t) as unknown as Box;
        assert.ok(b.top >= 80 && b.top + b.height <= 1440, `${own(t)} at ${f}: ${b.top}`);
        assert.ok(b.left >= 140 && b.left + b.width <= 940, `${own(t)} at ${f}: ${b.left} ${b.width}`);
      }
    }
  }
  // Her videos upright: full frame; in width, whole in a 16:9 band on black, her words in its middle; as she asks.
  const frameOf = (tree: Drawn) => styleOf(nodes(tree).find((n) => n.type === "Footage")!);
  const box = (tree: Drawn) => styleOf(nodes(tree).find((n) => n.children.some((c) => (c as Drawn)?.type === "Footage"))!);
  assert.deepEqual([box(drawAt(20)).top, box(drawAt(20)).height], [0, 1920]);
  assert.deepEqual([box(drawAt(20, { aspect: 16 / 9 })).top, box(drawAt(20, { aspect: 16 / 9 })).height], [656, 608]);
  assert.equal(frameOf(drawAt(20, { aspect: 16 / 9 })).height, 608);
  assert.equal(box(drawAt(20, { texts: { format: "horizontal" } })).height, 608);
  assert.equal(box(drawAt(20, { aspect: 16 / 9, texts: { format: "vertical" } })).height, 1920);
  assert.equal(styleOf(seen(drawAt(10, { aspect: 16 / 9 }))[0]!).top, 908);
  // Its ending card on her last shot under a veil: her title and her line, 48 px at least, inside the safe zone.
  const line = recette.timeline(14, { end: true });
  const from = Math.round((line.duration - 1.6) * 30);
  const end = { title: "Ouvert dimanche", subtitle: "de 10 h à 18 h", from };
  assert.equal(seen(drawAt(from - 1, { end, end_card: true })).map(own).includes("Ouvert dimanche"), false);
  const card = seen(drawAt(from + 6, { end, end_card: true }));
  assert.deepEqual(card.map(own), ["Ouvert dimanche", "de 10 h à 18 h"]);
  assert.ok(card.every((t) => Number((t.props.innerStyle as { fontSize: number }).fontSize) >= 48));
  // Its end's words gone before the card.
  assert.ok(!seen(drawAt(from + 6, { end, end_card: true })).some((t) => /voilà|travail/.test(own(t))));
});
