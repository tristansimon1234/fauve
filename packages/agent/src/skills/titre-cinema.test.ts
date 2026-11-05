import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillLengths, skillPlan } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { titreCinema } from "./titre-cinema.ts";

// « Titre de film signé » (titre-cinema.ts, docs/fiches/titre-cinema.md): its own checks, beside the library's
// (features.test.ts runs every skill over every count of shots).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number } | null;
type Style = { left: number; top: number; width: number; height: number; [k: string]: unknown };

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(
  frame: number,
  options: { aspect?: number; subject?: (f: number) => Box; title?: string; sign?: string; settings?: Record<string, string>; end?: { title: string; subtitle?: string } | null; n?: number } = {},
): Drawn {
  const n = options.n ?? 6;
  const line = titreCinema.timeline(n, { end: Boolean(options.end) });
  const shots = line.shots.map((s) => ({ from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", aspect: options.aspect ?? 9 / 16 }));
  const durationInFrames = Math.round(line.duration * 30);
  const to = Math.round(line.texts.titre!.to * 30);
  const reelTexts = [
    { text: options.title ?? "Cinématographe", role: "hook", from: 0, to, emphasis: [] },
    { text: options.sign ?? "par Léa", role: "caption", from: 0, to, emphasis: [] },
  ];
  const end = options.end ? { ...options.end, from: durationInFrames - 48 } : null;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    SubjectBox: (_shot: unknown, f: number) => (options.subject ? options.subject(f) : null),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${titreCinema.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const brand = { name: "Villa Marine", displayFont: "Sarpanch", bodyFont: "Tinos", accent: "#1d3b52" };
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots, reelTexts, end, texts: { ...options.settings } });
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Style;
const words = (node: unknown): string => (typeof node === "string" ? node : flatten(node).flatMap((d) => d.children.filter((c) => typeof c === "string")).join(" "));
/** Its lockup at that frame: its box, its title's line and its signature's line. */
function lockupAt(tree: Drawn, key = "title") {
  const fit = flatten(tree).find((n) => n.type === "FitText" && String(n.props.key).startsWith(key + "-"));
  if (!fit) return null;
  const column = fit.children[0] as Drawn;
  const [title, sign] = column.children as Drawn[];
  return { box: styleOf(fit), pad: Number((fit.props.innerStyle as Style).paddingTop), title: styleOf(title!), titleText: words(title), sign: sign ? styleOf(sign) : null, signText: sign ? words(sign) : "" };
}
/** The order its layers are drawn in: her shot, its lockup, her cut-out. */
const order = (tree: Drawn) =>
  flatten(tree)
    .filter((n) => n.type === "Footage" || n.type === "Subject" || (n.type === "FitText" && String(n.props.key).startsWith("title-")))
    .map((n) => (n.type === "Footage" ? "film" : n.type === "Subject" ? "her" : "title"));

test("« Titre de film signé » (v1): six shots on its original's cuts at 124,2 BPM, its title over its intro without bass, the beat on the cut", () => {
  assert.equal(titreCinema.version, 1);
  assert.equal(titreCinema.bpm, 124.2);
  const line = titreCinema.timeline(6, { end: false });
  // Each cut on the original's image (6,10 · 8,10 · 10,07 · 13,83 · 16,90 s), its end on its last (20,57 s).
  assert.deepEqual(line.shots.slice(1).map((s) => Math.round(s.start * 30)), [183, 243, 302, 415, 507]);
  assert.equal(Math.round(line.duration * 30), 617);
  // Its title and her signature from the first image to the first cut; she is cut out on her first shot only.
  assert.deepEqual(line.texts, { titre: { from: 0, to: 6.1 }, signature: { from: 0, to: 6.1 } });
  assert.deepEqual(line.cutouts, [0]);
  assert.equal(line.sounds, undefined);
  // Its music: its first bar 0,35 s in, without its bass until its bar 4 (an image and a half after the cut), cut dead.
  const music = line.music!;
  assert.ok(Math.abs(music.downbeat! - 0.352) < 0.005, String(music.downbeat));
  assert.equal(music.filters!.length, 1);
  assert.equal(music.filters![0]!.kind, "thin");
  assert.equal(music.filters![0]!.from, 0);
  assert.ok(music.filters![0]!.to - 6.1 > 0 && music.filters![0]!.to - 6.1 <= 2 / 30, String(music.filters![0]!.to));
  assert.ok(music.end!.at === line.duration && music.end!.fade! < 0.02);
  // Its shots want what the original shows: its walker in a still wide shot, someone alone from behind, people, a walk.
  assert.match(line.shots[0]!.want, /large et fixe/);
  assert.match(line.shots[0]!.want, /sa tête passe devant sa signature/);
  assert.match(line.shots[4]!.want, /des gens ensemble/);
  assert.match(line.shots[5]!.want, /soleil couchant/);
});

test("« Titre de film signé »: fewer shots keep its title's intro, more repeat its middle, an ending card adds whole bars; never past 45 s", () => {
  const first = (n: number) => Math.round(titreCinema.timeline(n, { end: false }).shots[1]!.start * 30);
  for (let n = 4; n <= 11; n++) assert.equal(first(n), 183, `n=${n}`);
  // Four: what shines, the longest one, the walk; five: its three still shots; seven: a bar more before its people.
  assert.deepEqual(titreCinema.timeline(4, { end: false }).shots.slice(1).map((s) => Math.round(s.start * 30)), [183, 243, 356]);
  assert.deepEqual(titreCinema.timeline(7, { end: false }).shots.slice(1).map((s) => Math.round(s.start * 30)), [183, 243, 302, 415, 473, 565]);
  assert.ok(titreCinema.timeline(7, { end: false }).shots[5]!.want.startsWith("des gens ensemble"));
  // An ending card: its last shot two beats longer (the card over its last 1,6 s, most of the walk alone), the music ending with it.
  const plain = titreCinema.timeline(6, { end: false });
  const card = titreCinema.timeline(6, { end: true });
  assert.ok(Math.abs(card.duration - plain.duration - 2 * (60 / 124.2)) < 0.04, `${card.duration}`);
  assert.ok(card.duration - card.shots.at(-1)!.start - 1.6 >= 2.5);
  assert.equal(card.music!.end!.at, card.duration);
  // At another tempo, everything counted in beats follows it.
  const slower = titreCinema.timeline(6, { end: false, bpm: 104 });
  assert.ok(Math.abs(slower.duration / plain.duration - 124.2 / 104) < 0.01);
  assert.ok(Math.abs(slower.music!.filters![0]!.to / plain.music!.filters![0]!.to - 124.2 / 104) < 0.01);
  // Its longest, at its slowest tempo and with a card, under 45 s (MAX_REEL_SECONDS).
  assert.ok(titreCinema.timeline(11, { end: true, bpm: 104 }).duration <= 45);
  assert.ok(skillLengths(titreCinema).max <= 45);
});

test("« Titre de film signé »: on the plan, its two words on its first shot, its music's shape, her cut-out there only", () => {
  const files = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12 }));
  const fill = { shots: files.map((f) => ({ file: f.id, at: 1 })), texts: { titre: "Escapade", signature: "par Léa" }, end: null };
  const plan = skillPlan({ skill: titreCinema, name: "Titre de film signé", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.texts.map((t) => [t.text, t.style, t.from, t.to]), [["Escapade", "hook", 0, 6.1], ["par Léa", "caption", 0, 6.1]]);
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 6, subjects: [0] });
  assert.equal(plan.music_shape?.filters?.[0]?.kind, "thin");
  assert.equal(plan.sounds, undefined);
  assert.equal(plan.tempo, 124.2);
});

test("« Titre de film signé » draws, without anyone cut out: its lockup at the original's place, in front, there from the first image and gone with the cut", () => {
  const at0 = lockupAt(drawAt(0))!;
  // 14 letters: its capitals over 62,5 % of the width (a 67 px font whose capitals are 0,63 of it), its signature 48 px.
  assert.equal(at0.title.fontSize, 67);
  assert.equal(at0.sign!.fontSize, 48);
  assert.equal(at0.titleText, "CINÉMATOGRAPHE");
  assert.equal(at0.signText, "par Léa");
  // Its title's capitals centred on the middle of the frame (the original's 50,1 %), its signature under its end.
  assert.equal(at0.box.top + at0.pad, Math.round(960 - 0.535 * 67));
  assert.equal(at0.sign!.textAlign, "right");
  assert.equal(at0.title.color, "#fffcf8");
  assert.doesNotMatch(JSON.stringify(at0.title), /shadow/i);
  // Still: the same box on every image of its shot, gone with the cut.
  assert.deepEqual(lockupAt(drawAt(120))!.box, at0.box);
  assert.ok(lockupAt(drawAt(182)));
  assert.equal(lockupAt(drawAt(183)), null);
  // Nobody cut out: nothing passes in front of it.
  assert.deepEqual(order(drawAt(60)), ["film", "title"]);
  // Inside the safe zone, left of the apps' buttons.
  const b = at0.box;
  assert.ok(b.left >= 140 && b.left + b.width <= 940 && b.top + at0.pad >= 80 && b.top + b.height - at0.pad <= 1440, JSON.stringify(b));
  // A shorter word is bigger (capitals 6 % of the width at most), its signature with it (64 px at most).
  const short = lockupAt(drawAt(0, { title: "Escapade" }))!;
  assert.equal(short.title.fontSize, 103);
  assert.equal(short.sign!.fontSize, 64);
});

test("« Titre de film signé »: her head covers the bottom of her signature's capitals, she in front of it, the signature on her side", () => {
  // Her cut-out: its top (her head) at 1000 px, its middle at 700 px (right of the middle, as the original's walker drifts).
  const her = (x: number, y: number) => () => ({ x: x - 60, y, w: 120, h: 600 });
  const tree = drawAt(60, { subject: her(700, 1000) });
  const k = lockupAt(tree)!;
  // Its signature's baseline half its capitals under the top of her head: its title's line top at 1000 − 1,22 F − 0,33 S.
  assert.equal(k.box.top + k.pad, Math.round(1000 - 1.22 * 67 - 0.33 * 48));
  // The middle of the heights her head reaches over the shot, not the first one (she walks: her head rises or sinks).
  const walking = (f: number) => ({ x: 640, y: f < 30 ? 900 : 1000, w: 120, h: 600 });
  assert.equal(lockupAt(drawAt(60, { subject: walking }))!.box.top, k.box.top);
  assert.equal(k.sign!.textAlign, "right");
  // She is laid after it: her head passes in front of her signature.
  assert.deepEqual(order(tree), ["film", "title", "her"]);
  assert.equal(order(drawAt(200, { subject: her(700, 1000) })).includes("her"), false);
  // On her side: the signature under the title's start, or its middle.
  assert.equal(lockupAt(drawAt(60, { subject: her(300, 1000) }))!.sign!.textAlign, "left");
  assert.equal(lockupAt(drawAt(60, { subject: her(540, 1000) }))!.sign!.textAlign, "center");
  // No room above her (she fills the frame): in front of her, low in the frame.
  const high = drawAt(60, { subject: her(540, 100) });
  assert.deepEqual(order(high), ["film", "title"]);
  assert.equal(lockupAt(high)!.box.top + lockupAt(high)!.pad, Math.round(1428 - 125));
  // Very low (a wide shot): never under the bottom quarter.
  const low = lockupAt(drawAt(60, { subject: her(700, 1800) }))!;
  assert.ok(low.box.top + low.box.height - low.pad <= 1440);
});

test("« Titre de film signé »: its near-square window on black when her videos are horizontal, full frame when upright, as her words ask", () => {
  const film = (tree: Drawn) => styleOf(flatten(tree).find((n) => n.type === "Footage")!);
  // The original's 10:9: the whole width, 972 px high in the middle of the frame.
  assert.deepEqual(film(drawAt(30, { aspect: 16 / 9 })), { position: "absolute", left: 0, top: 474, width: 1080, height: 972 });
  assert.deepEqual(film(drawAt(30, { aspect: 9 / 16 })), { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(film(drawAt(30, { aspect: 9 / 16, settings: { format: "fenetre" } })).height, 972);
  assert.deepEqual(film(drawAt(30, { aspect: 16 / 9, settings: { format: "vertical" } })).height, 1920);
  assert.deepEqual(titreCinema.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "fenetre"]]]);
  // In the window, its title centred on its middle (the frame's), its words inside it.
  const k = lockupAt(drawAt(30, { aspect: 16 / 9 }))!;
  assert.equal(k.box.top + k.pad, Math.round(474 + 486 - 0.535 * 67));
  // Her cut-out laid in the same box as her shot.
  const tree = drawAt(30, { aspect: 16 / 9, subject: () => ({ x: 600, y: 1000, w: 90, h: 300 }) });
  assert.deepEqual(styleOf(flatten(tree).find((n) => n.type === "Subject")!), film(tree));
});

test("« Titre de film signé »: its ending card on its last shot, its words set as its title; light to render", () => {
  // Its card over its last 48 images (the Reel 646 images long with it).
  assert.equal(Math.round(titreCinema.timeline(6, { end: true }).duration * 30), 646);
  assert.equal(lockupAt(drawAt(590, { end: { title: "Ouvert tout l'été" } }), "end"), null);
  const tree = drawAt(640, { end: { title: "Ouvert tout l'été", subtitle: "dès le 1er juin" } });
  const card = lockupAt(tree, "end")!;
  assert.equal(card.titleText, "OUVERT TOUT L'ÉTÉ");
  assert.equal(card.signText, "dès le 1er juin");
  assert.ok(flatten(tree).some((n) => /rgba\(0,0,0,/.test(String(styleOf(n).backgroundColor ?? ""))), "its last shot darkened a little");
  // Its code: checked, her cut-out on her first shot only, nothing followed, no clear area nor reading, no zoom.
  assert.deepEqual(checkMotionCode(titreCinema.code), []);
  assert.ok(titreCinema.code.length < 24000);
  assert.deepEqual(subjectsDrawn(titreCinema.code), [0]);
  assert.deepEqual([objectsDrawn(titreCinema.code), clearsDrawn(titreCinema.code), readsDrawn(titreCinema.code)], [[], [], []]);
  assert.doesNotMatch(titreCinema.code, /transform|scale\(/);
});
