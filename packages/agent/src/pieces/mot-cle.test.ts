import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { pieceFillInput, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { motCle } from "./mot-cle.ts";

// « Mot clé en grand », the effect of the bank (mot-cle.ts): its own checks, beside the bank's (features.test.ts).

/** Her talk as the chain cuts it under it: a lead shot, her talking shot in n pieces of 1,5 s, an after shot. */
const talk = (n: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...Array.from({ length: n }, (_, i) => ({ file: "talk", at: 2 + i * 1.6, seconds: 1.5 })),
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Mot clé en grand » (effect v1): its layer over her talk, timed on what she says, nothing cut out of her shots", () => {
  for (const n of [1, 3, 6]) {
    const plan = pieceTestPlan({ piece: motCle, shots: talk(n), span: [1.2, 1.2 + n * 1.5], fill: { texts: { mot1: "soins", mot2: "brushing" }, objects: {}, settings: {} }, bpm: 100 });
    assert.ok(editPlanSchema.safeParse(plan).success, `n=${n}`);
    const motion = plan.layers![0]!.motion;
    assert.deepEqual(motion.piece, { key: "mot-cle", version: 1 });
    // Timed on what she says: its code gets her words said under it.
    assert.equal(motion.times_spoken, true);
    assert.deepEqual(motion.texts, { beat: "18", mot1: "soins", mot2: "brushing" });
    // Nothing of her cut out, no object, no sound, no font of its own: her face is followed, her wall's light read.
    assert.equal(motion.drawn, undefined);
    assert.equal(motion.sounds, undefined);
    assert.equal(motion.fonts, undefined);
    assert.equal(motion.photos, undefined);
  }
  // Its code reads her wall's light on every shot under it (a variable: each one is read before the render).
  assert.match(motCle.code, /LightUnder\(list\[shot\]/);
  assert.ok(motCle.spoken && !motCle.photos);
});

test("« Mot clé en grand »: its filler chooses its keywords among her words, the first required, each cut to its place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "mot1", text: "croissant" }, { slot: "mot2", text: "pains au chocolat" }, { slot: "mot3", text: "" }, { slot: "mot4", text: "" }], objects: [], settings: [] };
  const read = readPieceFill(motCle, answer)!;
  // Cut at the last word that fits its 12 characters, the optional ones left out.
  assert.deepEqual(read.texts, { mot1: "croissant", mot2: "pains au" });
  // Without its first keyword nothing plays.
  assert.equal(readPieceFill(motCle, { ...answer, texts: [{ slot: "mot2", text: "beurre" }] }), null);
  // Its filler reads what she says under it.
  const input = pieceFillInput({ piece: motCle, under: [{ id: "talk", photo: false, shows: "elle parle face caméra devant un mur bleu", framing: "medium", camera: "static" }], brief: "", request: "", business: { name: "Maison Lune", activity: "pâtisserie" }, said: "D'abord le croissant, feuilleté au beurre." });
  assert.equal(input.ce_qu_elle_dit, "D'abord le croissant, feuilleté au beurre.");
  assert.equal(input.effet.ses_mots.length, 4);
});

test("« Mot clé en grand » is offered on a video of someone, never on her photos alone", () => {
  const clip = (person: boolean) =>
    ({
      duration: 12,
      orientation: "portrait",
      summary: "une pâtissière parle face caméra",
      setting: "intérieur, une chambre au mur bleu",
      lighting: "good",
      shots: [{ start: 0, end: 12, description: person ? "une femme assise qui parle face caméra" : "un mur bleu", subject: person ? "femme" : "mur", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: person, framing: "medium", camera: "static", subject_box: [300, 200, 700, 900], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([motCle], pieceShots([{ media_id: "a", analysis: clip(true) }], {}), 1).map((p) => p.key), ["mot-cle"]);
  assert.deepEqual(piecesOffered([motCle], pieceShots([{ media_id: "a", analysis: clip(false) }], {}), 1), []);
  assert.deepEqual(piecesOffered([motCle], pieceShots([], { p: { detection: { regions: [{ kind: "face" }], notes: "une femme" } } as never }), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Face = { x: number; y: number; width: number; height: number };

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { durationInFrames?: number; texts?: Record<string, string>; spoken?: { w: string; from: number; to: number }[]; face?: Face | null; light?: number }): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }) };
  const light = props.light;
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    useCurrentFrame: () => frame,
    LightUnder: () => (light === undefined ? null : { mean: light, high: light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${motCle.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const brand = { displayFont: "Bricolage Grotesque", bodyFont: "Inter Tight", accent: "#c0532b" };
  const face = props.face;
  const track = face === undefined ? undefined : () => ({ hands: [], bodies: [], faces: face ? [face] : [] });
  const durationInFrames = props.durationInFrames ?? 240;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames,
    brand,
    shots: [{ from: -30, durationInFrames: durationInFrames + 60, kind: "video", aspect: 0.5625 }],
    texts: { beat: "18", ...props.texts },
    spoken: props.spoken ?? [],
    track,
  });
}

/** Her words, each 8 frames long with a gap of 2, from a frame on (a pause of 14 frames after a full stop or a comma). */
function sayFrom(at: number, text: string) {
  const out: { w: string; from: number; to: number }[] = [];
  let f = at;
  for (const w of text.split(" ")) {
    out.push({ w, from: f, to: f + 8 });
    f += /[.,]$/.test(w) ? 22 : 10;
  }
  return out;
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
/** Its keyword at that frame: the text drawn big (FitText), its box (the slide's wrapper), its offset. */
function keywordAt(tree: Drawn) {
  const fit = flatten(tree).find((n) => n.type === "FitText");
  if (!fit) return null;
  const wrapper = flatten(tree).find((n) => n.children.includes(fit))!;
  const dx = /translateX\((-?\d+)px\)/.exec(String(styleOf(wrapper).transform ?? ""));
  return { text: fit.children[0] as string, top: Number(styleOf(wrapper).top), height: Number(styleOf(wrapper).height), left: Number(styleOf(fit).left), width: Number(styleOf(fit).width), dx: dx ? Number(dx[1]) : 0, color: (fit.props.innerStyle as Record<string, string>).color };
}
/** Its small line at that frame: the words laid and those shown (opacity 1). */
function lineAt(tree: Drawn) {
  const spans = flatten(tree).filter((n) => n.type === "span");
  return { laid: spans.map((s) => s.children[0] as string), shown: spans.filter((s) => styleOf(s).opacity === 1).map((s) => s.children[0] as string) };
}

const SPEECH = sayFrom(6, "Alors aujourd'hui je vous montre nos SOINS. D'abord le gommage au sucre, puis l'huile de jojoba.");

test("« Mot clé en grand » draws: each keyword on the image she says it, sliding in from the left, held to the next one", () => {
  const texts = { mot1: "soins", mot2: "gommage", mot3: "huile" };
  const soins = SPEECH.find((w) => w.w === "SOINS.")!.from;
  const gommage = SPEECH.find((w) => w.w === "gommage")!.from;
  const huile = SPEECH.find((w) => w.w === "l'huile")!.from;
  // Nothing big before she says her first keyword.
  assert.equal(keywordAt(drawAt(soins - 1, { texts, spoken: SPEECH })), null);
  // On the very image she says it (its letters, case and full stop aside), in capitals, coming from the left, set on its sixth.
  const landing = keywordAt(drawAt(soins, { texts, spoken: SPEECH }))!;
  assert.equal(landing.text, "SOINS");
  assert.ok(landing.dx < -500, `${landing.dx}`);
  assert.ok(keywordAt(drawAt(soins + 3, { texts, spoken: SPEECH }))!.dx > 0, "past its place");
  assert.equal(keywordAt(drawAt(soins + 5, { texts, spoken: SPEECH }))!.dx, 0);
  // Held until the next one, which replaces it on the image she says it; an elision found too (« l'huile »).
  assert.equal(keywordAt(drawAt(gommage - 1, { texts, spoken: SPEECH }))!.text, "SOINS");
  assert.equal(keywordAt(drawAt(gommage, { texts, spoken: SPEECH }))!.text, "GOMMAGE");
  assert.equal(keywordAt(drawAt(huile, { texts, spoken: SPEECH }))!.text, "HUILE");
  assert.equal(keywordAt(drawAt(239, { texts, spoken: SPEECH }))!.text, "HUILE");
  // A keyword she does not say lands on a beat between the ones found (here half way, on the beat), and still shows.
  const missed = { mot1: "soins", mot2: "vanille", mot3: "huile" };
  const between = [...Array(240).keys()].find((f) => keywordAt(drawAt(f, { texts: missed, spoken: SPEECH }))?.text === "VANILLE")!;
  assert.ok(between > soins && between < huile && between % 18 === 0, `${between}`);
  // Nobody says anything: its keywords spread on beats over the effect, the first from its first image.
  assert.equal(keywordAt(drawAt(0, { texts }))!.text, "SOINS");
  assert.equal(keywordAt(drawAt(239, { texts }))!.text, "HUILE");
  // Accents, case and a plural aside: « Crème » she says is « creme » written, « croissants » is « croissant ».
  const accents = sayFrom(4, "La Crème brûlée et nos croissants.");
  assert.equal(keywordAt(drawAt(14, { texts: { mot1: "creme" }, spoken: accents }))?.text, "CREME");
  assert.equal(keywordAt(drawAt(13, { texts: { mot1: "creme" }, spoken: accents })), null);
  assert.equal(keywordAt(drawAt(53, { texts: { mot1: "brûlée", mot2: "croissant" }, spoken: accents }))?.text, "BRÛLÉE");
  assert.equal(keywordAt(drawAt(54, { texts: { mot1: "brûlée", mot2: "croissant" }, spoken: accents }))?.text, "CROISSANT");
});

test("« Mot clé en grand »: her other words one by one on a small line above it, the keyword and one-letter words left out", () => {
  const texts = { mot1: "soins" };
  const vous = SPEECH.find((w) => w.w === "vous")!;
  // Laid out whole from its first word (it never moves), each word shown on the image it is said; as many as its width holds.
  const early = lineAt(drawAt(vous.from, { texts, spoken: SPEECH }));
  assert.deepEqual(early.laid, ["Alors", "aujourd'hui", "je", "vous"]);
  assert.deepEqual(early.shown, ["Alors", "aujourd'hui", "je", "vous"]);
  const before = lineAt(drawAt(vous.from - 1, { texts, spoken: SPEECH }));
  assert.deepEqual(before.laid, ["Alors", "aujourd'hui", "je", "vous"]);
  assert.deepEqual(before.shown, ["Alors", "aujourd'hui", "je"]);
  // The next words on the next line, emptied before it.
  assert.deepEqual(lineAt(drawAt(SPEECH.find((w) => w.w === "nos")!.from, { texts, spoken: SPEECH })).laid, ["montre", "nos"]);
  // The keyword is never in it (it is the big word); a line starts again after a full stop, its own punctuation dropped.
  const after = lineAt(drawAt(SPEECH.find((w) => w.w === "gommage")!.from, { texts, spoken: SPEECH }));
  assert.deepEqual(after.laid, ["D'abord", "le", "gommage", "au"]);
  // A one-letter word is never written there (« à », « y »).
  const short = sayFrom(4, "Elle passe à la boutique.");
  assert.deepEqual(lineAt(drawAt(30, { texts: { mot1: "boutique" }, spoken: short })).laid, ["Elle", "passe", "la"]);
});

test("« Mot clé en grand »: above her head when there is room, smaller when less, before her chest when none, never on her face", () => {
  const texts = { mot1: "soins" };
  const at = SPEECH.find((w) => w.w === "SOINS.")!.from + 10;
  const W = 1080;
  // No face followed: the upper third, the original's place (from 20 % of the height).
  const free = keywordAt(drawAt(at, { texts, spoken: SPEECH }))!;
  assert.ok(free.top > 0.24 * 1920 && free.top + free.height < 0.37 * 1920, `${free.top}`);
  // Her head low (its top at 52 % of the height): the same place, above it.
  const low = { x: 540, y: 1150, width: 300, height: 360 };
  assert.deepEqual(keywordAt(drawAt(at, { texts, spoken: SPEECH, face: low })), free);
  // Her head higher: the block moved up, then smaller, always above her head.
  for (const y of [800, 700]) {
    const face = { x: 540, y, width: 300, height: 360 };
    const k = keywordAt(drawAt(at, { texts, spoken: SPEECH, face }))!;
    assert.ok(k.top + k.height <= face.y - face.height * 0.95, `y=${y}: ${k.top}+${k.height}`);
    assert.ok(k.top >= 80);
  }
  // No room above her head: before her chest, under her face, left of the apps' buttons (between x 140 and 940).
  const high = { x: 540, y: 620, width: 340, height: 380 };
  const chest = keywordAt(drawAt(at, { texts, spoken: SPEECH, face: high }))!;
  assert.ok(chest.top >= high.y + high.height * 0.75, `${chest.top}`);
  assert.ok(chest.left >= 140 && chest.left + chest.width <= W - 140 && chest.top + chest.height <= 0.75 * 1920);
  // The small words keep 48 px at the least, wherever the block goes.
  const spans = flatten(drawAt(SPEECH.find((w) => w.w === "montre")!.from, { texts, spoken: SPEECH, face: high })).filter((n) => n.type === "span");
  assert.ok(spans.length && spans.every((s) => Number(styleOf(s).fontSize) >= 48));
});

test("« Mot clé en grand »: white on a dark or coloured wall, in ink on a light one", () => {
  const texts = { mot1: "soins" };
  const at = SPEECH.find((w) => w.w === "SOINS.")!.from + 10;
  assert.equal(keywordAt(drawAt(at, { texts, spoken: SPEECH, light: 0.25 }))!.color, "#ffffff");
  assert.equal(keywordAt(drawAt(at, { texts, spoken: SPEECH, light: 0.8 }))!.color, "#161616");
  // Not read: white, with its own tight edge (it reads on any wall).
  assert.equal(keywordAt(drawAt(at, { texts, spoken: SPEECH }))!.color, "#ffffff");
});
