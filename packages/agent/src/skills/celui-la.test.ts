import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { readSkillFill, skillFillInput, skillPlan } from "../skills.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { ANY_SHOT, clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { celuiLa } from "./celui-la.ts";

// « Celui-là, celui-là… », the model (celui-la.ts; docs/fiches/celui-la.md): its own checks, beside the library's
// (features.test.ts, « montage skills »).

/** The original's cuts (images at 30 i/s): its seven products, then its series together. */
const CUTS = [69, 91, 109, 129, 146, 164, 182, 203];

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** Its Scene drawn at a frame as a plain tree (no renderer): the kit's pieces as named nodes, her light as given. */
function scene(light: (shot: unknown) => { mean: number; high: number } | null = () => null) {
  let current = 0;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: <T,>(make: () => T) => make() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    useCurrentFrame: () => current,
    interpolate: (x: number, [a, b]: [number, number], [y0, y1]: [number, number]) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - a) / (b - a || 1))),
    LightUnder: (shot: unknown) => light(shot),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${celuiLa.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const Scene = make(React, ...Object.values(scope));
  return (frame: number, props: Record<string, unknown>) => {
    current = frame;
    return Scene(props);
  };
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const textOf = (node: unknown): string => {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return (node as Drawn).children.map(textOf).join("");
};
/** Its words at a frame: each FitText's key, words (letters to come included), box and type. */
const wordsAt = (tree: Drawn) =>
  flatten(tree)
    .filter((n) => n.type === "FitText")
    .map((n) => ({ key: String(n.props.key), text: textOf(n).replace(/ /g, " "), box: n.props.style as Box & { opacity?: number }, type: n.props.innerStyle as Record<string, string | number> }));

/** The props its composition gets for a plan of n shots (its marks, its texts in frames, as the engine gives them). */
function propsFor(n: number, options: { aspect?: number; end?: { title: string; subtitle?: string } | null; settings?: Record<string, string>; words?: Record<string, string> } = {}) {
  const line = celuiLa.timeline(n, { end: Boolean(options.end) });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const words: Record<string, string> = { appel: "Hééééé", arret: "Attends !", regarde: "Regarde", celui: "Celle-là", et: "Eeeeet…", fin: "Tout ça !", ...options.words };
  const role = Object.fromEntries(celuiLa.texts.map((t) => [t.slot, t.role]));
  const reelTexts = Object.entries(line.texts).flatMap(([slot, t]) => (words[slot] ? [{ text: words[slot], role: role[slot], from: Math.round(t.from * 30), to: Math.round(t.to * 30), emphasis: [] }] : []));
  const durationInFrames = Math.round(line.duration * 30);
  const shots = line.shots.map((s) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect: options.aspect ?? 0.5625 }));
  const end = options.end ? { ...options.end, from: durationInFrames - 48 } : null;
  return { line, props: { width: 1080, height: 1920, durationInFrames, brand: { name: "Atelier Terre", displayFont: "Instrument Serif", bodyFont: "Inter Tight", accent: "#8a3b2a", palette: { dark: "#1d1b18" } }, shots, reelTexts, end, texts: { ...marks, ...options.settings } } };
}

/** Where a word itself sits (its centre): pushed back into the zone, it keeps to that side of its box (about 0,4 em a letter). */
function anchor(w: { text: string; box: Box; type: Record<string, string | number> }): [number, number] {
  const wide = Math.min(w.box.width, w.text.length * Number(w.type.fontSize) * 0.4);
  const x = w.type.alignItems === "flex-start" ? w.box.left + wide / 2 : w.type.alignItems === "flex-end" ? w.box.left + w.box.width - wide / 2 : w.box.left + w.box.width / 2;
  return [Math.round(x), Math.round(w.box.top + w.box.height / 2)];
}

/** Its words inside Instagram's safe zone: 80 px from the top, above the bottom quarter, x 140 to 940 under the middle, 40 px from the sides above it. */
function inZone(box: Box, label: string) {
  const bottom = box.top + box.height;
  assert.ok(box.top >= 80 && bottom <= 1440, `${label}: ${JSON.stringify(box)}`);
  if (bottom > 960) assert.ok(box.left >= 140 && box.left + box.width <= 940, `${label}: ${JSON.stringify(box)}`);
  else assert.ok(box.left >= 40 && box.left + box.width <= 1040, `${label}: ${JSON.stringify(box)}`);
}

test("« Celui-là » (v1): its original's grid (96,5 BPM), its products one a beat, its cuts within two images of the original's", () => {
  assert.equal(celuiLa.version, 1);
  assert.equal(celuiLa.bpm, 96.5);
  assert.deepEqual(celuiLa.shots, [5, 16]);
  const line = celuiLa.timeline(9, { end: false });
  // Its display, seven products, its series together: nine shots, 9,2 s (the original's 8,66 s, its last word held 1,5 beats).
  assert.equal(line.shots.length, 9);
  assert.equal(Math.round(line.duration * 30), 276);
  // Each cut on its beat, within two images of the original's (its man's voice chants, the music it gets is regular).
  line.shots.slice(1).forEach((s, i) => assert.ok(Math.abs(Math.round(s.start * 30) - CUTS[i]!) <= 2, `cut ${i + 1}: ${s.start * 30} for ${CUTS[i]}`));
  const beat = 60 / 96.5;
  for (let i = 1; i < 8; i++) assert.ok(Math.abs(line.shots[i]!.end - line.shots[i]!.start - beat) <= 1 / 30 + 1e-6, `product ${i}: one beat`);
  // Its words at their moments (images, the original's to an image): its hail typed on 1 to 12, its stop word on 21,
  // 26 and 33, « Regarde » on 52, its hesitation typed on 204 to 220, faded to 243, its last word on 248.
  const m = line.marks;
  assert.deepEqual([m.hail_from, m.hail_typed, m.stop1, m.stop2, m.stop3, m.stopped, m.look], [1, 12, 21, 26, 33, 45, 52]);
  assert.deepEqual([m.first, m.finale, m.and_from, m.and_typed, m.and_out, m.and_gone, m.last], [71, 202, 204, 220, 238, 243, 248]);
  assert.equal(m.products, 7);
  assert.ok(Math.abs(m.beat! - 18.653) < 0.01);
  assert.deepEqual(Object.keys(line.texts), ["appel", "arret", "regarde", "celui", "et", "fin"]);
  assert.deepEqual(line.texts.celui, { from: 2.37, to: 6.73 });
  assert.deepEqual(line.texts.fin, { from: 8.28, to: 9.2 });
  // Nothing cut out, nothing followed, no sound of its own: its sound was a voice, never copied.
  assert.equal(line.cutouts, undefined);
  assert.equal(line.objects, undefined);
  assert.equal(line.sounds, undefined);
  // Fewer or more products: the same opening and ending, a beat each between them.
  const few = celuiLa.timeline(5, { end: false });
  const many = celuiLa.timeline(16, { end: false });
  assert.ok(Math.abs(many.duration - few.duration - 11 * beat) < 0.04, `${few.duration} → ${many.duration}`);
  assert.equal(many.marks.products, 14);
  // An ending card after its last word's hold (whole beats, 1,6 s at least); at another tempo, all of it follows.
  const ended = celuiLa.timeline(9, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6 && ended.texts.fin!.to === Math.round((ended.duration - 1.6) * 100) / 100);
  const slower = celuiLa.timeline(9, { end: false, bpm: 80 });
  assert.ok(Math.abs(slower.marks.last! / line.marks.last! - 96.5 / 80) < 0.01);
});

test("« Celui-là » (v1): its music shaped as its original's voice: thin through her hail, its bass on the first product, stopped on her series, back on her last word", () => {
  const line = celuiLa.timeline(9, { end: false });
  const music = line.music!;
  // Its first strong beat on the grid's beat 1 (0,51 s).
  assert.ok(Math.abs(music.downbeat! - 0.51) < 0.005);
  // Without its bass until the first product (2,37 s).
  assert.deepEqual(music.filters, [{ kind: "thin", from: 0, to: 2.37 }]);
  // Stopped just after the series' cut (its hit rings over a tail while her hesitation is typed), back on her last word.
  assert.equal(music.pauses!.length, 1);
  const pause = music.pauses![0]!;
  assert.ok(pause.from > line.shots.at(-1)!.start && pause.from - line.shots.at(-1)!.start < 0.2, JSON.stringify(pause));
  assert.ok(Math.abs(pause.to - 248 / 30) <= 1 / 30 && pause.tail! >= 1 && pause.tail! <= pause.to - pause.from, JSON.stringify(pause));
  // On to the end, cut there.
  assert.deepEqual(music.end, { at: 9.2, fade: 0.12 });
  // On the plan: its shape kept, no sound of its own, nothing drawn of her shots (no cut-out, no object).
  const files = Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, photo: i % 2 === 1, seconds: i % 2 ? 0 : 8 }));
  const words = { appel: "Hééééé", arret: "Attends !", regarde: "Regarde", celui: "Celui-là", et: "Eeeeet…", fin: "Celui-là !" };
  const plan = skillPlan({ skill: celuiLa, name: "Celui-là, celui-là…", files, fill: { shots: files.map((f) => ({ file: f.id, at: 1 })), texts: words, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 9);
  assert.deepEqual(plan.texts.map((t) => t.style), ["hook", "band", "band", "band", "caption", "caption"]);
  assert.ok(plan.music_shape?.pauses?.length === 1 && plan.music_shape.filters?.length === 1);
  assert.equal(plan.sounds, undefined);
  assert.equal(plan.layers![0]!.motion.drawn, undefined);
  assert.deepEqual(plan.skill, { key: "celui-la", version: 1 });
});

test("« Celui-là » (v1): her hail typed letter by letter then faded, her stop word on three places, « Regarde » in the middle", () => {
  const { props } = propsFor(9);
  const draw = scene();
  // Its hail typed from its left edge (25,6 % of the width): its letters to come in place but unseen, then faded out.
  const hail = (f: number) => wordsAt(draw(f, props)).find((w) => w.key.startsWith("hail"));
  assert.equal(hail(0), undefined);
  const seen = (f: number) => flatten(draw(f, props)).filter((n) => n.props.style && (n.props.style as { opacity?: number }).opacity === 1 && n.type === "span").length;
  // Its six letters over its eleven images, as the original's nine over its own: one, two, four, all six.
  assert.deepEqual([1, 4, 8, 12].map(seen), [1, 2, 4, 6]);
  assert.equal(hail(6)!.text, "Hééééé");
  assert.equal(hail(6)!.box.left, 276);
  assert.equal(hail(6)!.type.alignItems, "flex-start");
  assert.equal(hail(12)!.box.opacity, 1);
  assert.ok(hail(14)!.box.opacity! < 1 && hail(14)!.box.opacity! > 0);
  assert.equal(hail(16), undefined);
  // Its stop word at once on its three places, the third 9 % bigger; nothing between it and « Regarde ».
  const stop = (f: number) => wordsAt(draw(f, props)).find((w) => w.key.startsWith("stop"));
  const places = [22, 28, 36].map((f) => stop(f)!);
  assert.deepEqual(places.map((w) => w.text), ["Attends !", "Attends !", "Attends !"]);
  const [a, b, c] = places.map(anchor) as [[number, number], [number, number], [number, number]];
  assert.ok(a[1] < b[1] && b[1] < c[1], "top left, right, bottom left");
  assert.ok(b[0] > a[0] + 100 && b[0] > c[0] + 100, `${a} ${b} ${c}`);
  assert.equal(places[2]!.type.fontSize, Math.round(Math.round(1920 * 0.087) * 1.09));
  assert.equal(wordsAt(draw(48, props)).length, 0);
  const look = wordsAt(draw(60, props))[0]!;
  assert.equal(look.text, "Regarde");
  assert.ok(Math.abs(anchor(look)[0] - 540) <= 1);
  // One size for every word, the original's (6,5 % of the height from its top to its baseline: 8,7 % of it a font size).
  assert.equal(look.type.fontSize, 167);
  assert.equal(look.type.fontFamily, "'Instrument Serif', 'Instrument Serif', serif");
  for (const f of [6, 22, 28, 36, 60]) for (const w of wordsAt(draw(f, props))) inZone(w.box, `${w.text} at ${f}`);
});

test("« Celui-là » (v1): her pointing word on each product at once, each time elsewhere, then her hesitation typed and her last word", () => {
  const { line, props } = propsFor(16);
  const draw = scene();
  // On each of her fourteen products from its cut to the next, never twice in a row in the same place, all in the zone:
  // where the word itself sits (pushed back into the zone, it keeps to that side of its box; about 0,4 em a letter).
  const at: [number, number][] = [];
  for (const s of line.shots.slice(1, -1)) {
    const f = Math.round(s.start * 30) + 2;
    const words = wordsAt(draw(f, props));
    assert.equal(words.length, 1, `frame ${f}`);
    const w = words[0]!;
    assert.equal(w.text, "Celle-là");
    inZone(w.box, `product at ${f}`);
    at.push(anchor(w));
  }
  for (let i = 1; i < at.length; i++) assert.ok(Math.hypot(at[i]![0] - at[i - 1]![0], at[i]![1] - at[i - 1]![1]) > 150, `product ${i}: ${at[i - 1]} → ${at[i]}`);
  // At once: no fade, no grow, no move (the same box all along its shot).
  const first = Math.round(line.shots[1]!.start * 30);
  assert.deepEqual(wordsAt(draw(first, props))[0]!.box, wordsAt(draw(first + 15, props))[0]!.box);
  assert.doesNotMatch(JSON.stringify(draw(first, props)), /transform|scale|blur/);
  // Her series: her hesitation typed from 14,2 % of the width, then her last word alone in the middle to the end.
  const finale = Math.round(line.shots.at(-1)!.start * 30);
  const and = wordsAt(draw(finale + 10, props))[0]!;
  assert.equal(and.text, "Eeeeet…");
  assert.equal(and.box.left, 153);
  assert.equal(wordsAt(draw(finale + 44, props)).length, 0);
  const last = wordsAt(draw(Math.round(line.duration * 30) - 1, props))[0]!;
  assert.equal(last.text, "Tout ça !");
  inZone(last.box, "last word");
  // Without a last word of hers: her pointing word, with « ! ».
  const { props: bare } = propsFor(9, { words: { fin: "" } });
  assert.equal(wordsAt(draw(270, bare))[0]!.text, "Celle-là !");
});

test("« Celui-là » (v1): its ink, the original's cream where it reads on her picture, a deep ink where it is too bright; her colours as asked", () => {
  const { props } = propsFor(9);
  const ink = (light: number | null, settings: Record<string, string> = {}, f = 80) => {
    const draw = scene(() => (light === null ? null : { mean: light, high: light }));
    return wordsAt(draw(f, { ...props, texts: { ...props.texts, ...settings } }))[0]!.type;
  };
  // Not read (the check, a passage at another speed): the cream, its firmer dark edge (still tight: no haze).
  assert.equal(ink(null).color, "#fffcc0");
  assert.equal(ink(null).textShadow, "0 0 2px rgba(38,30,18,0.8), 0 1px 4px rgba(38,30,18,0.5)");
  // On a dark picture the cream, its thin edge; on a white plate or a pastel wall, the deep ink with a thin light edge.
  assert.equal(ink(0.3).color, "#fffcc0");
  assert.equal(ink(0.3).textShadow, "0 0 1px rgba(38,30,18,0.62), 0 0 3px rgba(38,30,18,0.36)");
  assert.equal(ink(0.8).color, "#2b2118");
  assert.match(String(ink(0.8).textShadow), /^0 0 1px rgba\(255,250,236/);
  // Her series past the Reel's reads: her display's light, its firmer edge (it may be another place).
  const series = scene((shot) => ((shot as { from: number }).from === props.shots.at(-1)!.from ? null : { mean: 0.85, high: 0.9 }));
  const last = wordsAt(series(props.durationInFrames - 5, props))[0]!.type;
  assert.equal(last.color, "#2b2118");
  assert.match(String(last.textShadow), /^0 0 2px rgba\(255,250,236,0\.8\)/);
  // White or her colour, as her words ask, the deep ink where they would not read either.
  assert.equal(ink(0.3, { couleur: "blanc" }).color, "#ffffff");
  assert.equal(ink(0.85, { couleur: "blanc" }).color, "#2b2118");
  assert.equal(ink(0.85, { couleur: "sa-couleur" }).color, "#8a3b2a");
  assert.equal(ink(0.1, { couleur: "sa-couleur" }).color, "#fffcc0");
  assert.deepEqual(celuiLa.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]], ["couleur", ["creme", "blanc", "sa-couleur"]]]);
});

test("« Celui-là » (v1): upright as her files, in a 16:9 band on black when most are horizontal or she asks; its ending card", () => {
  const draw = scene();
  const footage = (tree: Drawn) => flatten(tree).find((n) => n.type === "Footage")!.props.style as Box;
  assert.deepEqual(footage(draw(80, propsFor(9).props)), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(footage(draw(80, propsFor(9, { aspect: 16 / 9 }).props)), { left: 0, top: 656, width: 1080, height: 608 });
  assert.deepEqual(footage(draw(80, propsFor(9, { aspect: 16 / 9, settings: { format: "vertical" } }).props)), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(footage(draw(80, propsFor(9, { settings: { format: "horizontal" } }).props)), { left: 0, top: 656, width: 1080, height: 608 });
  // Only the shot on screen is laid: the one of that frame.
  assert.equal(flatten(draw(100, propsFor(9).props)).find((n) => n.type === "Footage")!.props.shot, 2);
  // Its ending card in place of her last word, in the same serif, inside the zone.
  const { props } = propsFor(9, { end: { title: "Nouvelle fournée samedi", subtitle: "dès 8 h" } });
  const card = wordsAt(draw(props.durationInFrames - 10, props));
  assert.deepEqual(card.map((w) => w.text), ["Nouvelle fournée samedi", "dès 8 h"]);
  for (const w of card) inZone(w.box, w.text);
  assert.ok(Number(card[1]!.type.fontSize) >= 56);
  assert.equal(wordsAt(draw(props.durationInFrames - 60, props))[0]!.text, "Tout ça !");
});

test("« Celui-là » (v1): its filler's words, its code light to render: her light read on her shots, nothing cut out", () => {
  // Its words: all but its last one required, each cut to its place.
  const files = [{ id: "a", photo: true, seconds: 0 }, { id: "b", photo: false, seconds: 6 }];
  const answer = (texts: { slot: string; text: string }[]) => ({ fits: true, missing: "", shots: [], texts, end: null, why: "" });
  const all = [{ slot: "appel", text: "Hééééé" }, { slot: "arret", text: "Attends !" }, { slot: "regarde", text: "Regarde-moi ça" }, { slot: "celui", text: "Celle-là" }, { slot: "et", text: "Eeeeet…" }];
  const read = readSkillFill(celuiLa, files, 5, answer(all))!;
  assert.equal(read.texts.regarde, "Regarde-moi ça");
  assert.equal(read.texts.fin, undefined);
  assert.equal(readSkillFill(celuiLa, files, 5, answer(all.filter((t) => t.slot !== "celui"))), null);
  // Its filler reads each slot's want, the gender of « celui-là » with her products.
  const input = skillFillInput({ skill: celuiLa, name: "Celui-là, celui-là…", n: 9, files, business: { name: "Atelier Terre" }, request: "" });
  assert.equal(input.cases.length, 9);
  const celui = input.textes.find((t) => t.slot === "celui")!;
  assert.match("dit" in celui ? String(celui.dit) : "", /Celle-là/);
  assert.match(input.cases.at(-1)!.veut, /toute sa série réunie/);
  // Its code: the scope's, no zoom nor push; her light read on her shots (a variable shot: those under it, her display
  // named too, for her series past the reads), nothing else.
  assert.deepEqual(checkMotionCode(celuiLa.code), []);
  assert.ok(celuiLa.code.length < 24000);
  assert.deepEqual(readsDrawn(celuiLa.code).sort((x, y) => x.shot - y.shot), [{ shot: ANY_SHOT, kinds: ["light"] }, { shot: 0, kinds: ["light"] }]);
  assert.deepEqual([subjectsDrawn(celuiLa.code), objectsDrawn(celuiLa.code), clearsDrawn(celuiLa.code)], [[], [], []]);
  assert.doesNotMatch(celuiLa.code, /transform|scale\(/);
  // Its words are the original's never: French, hers.
  for (const t of celuiLa.texts) assert.doesNotMatch(t.want, /« (Stop|This|Look at|Hey)/i);
});
