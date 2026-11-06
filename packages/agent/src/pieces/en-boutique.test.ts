import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { enBoutique, stickerMoments } from "./en-boutique.ts";

// « Titre en autocollant », the effect of the bank (en-boutique.ts): its own checks, beside the bank's (features.test.ts).

/** Her shot at her counter as the chain cuts it under it (3 s), between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "counter", at: 0.5, seconds: 3 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Titre en autocollant » (effect v1): its layer over her shot at the counter, its pop 31 images in, its sounds", () => {
  const plan = pieceTestPlan({ piece: enBoutique, shots, span: [1.2, 4.2], fill: { texts: { titre: "Pizza du marché", avec: "avec Léa & Marco" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "en-boutique", version: 1 });
  // The original's 31 images into the shot, 66 images up; a pop and its sting, then a whoosh as it goes.
  assert.deepEqual(stickerMoments(90), { pop: 23, out: 89 });
  assert.deepEqual(stickerMoments(120), { pop: 31, out: 97 });
  assert.deepEqual(motion.texts, { beat: "18", pop: "23", out: "89", mine: "1", titre: "Pizza du marché", avec: "avec Léa & Marco" });
  assert.deepEqual(motion.sounds?.map((s) => [s.sound, s.at]), [["cartoon pop with a bright comic sting", 0.767], ["quick soft whoosh", 2.9]]);
  // Its own face, nothing of her cut out.
  assert.deepEqual(motion.fonts, ["Paytone One"]);
  assert.equal(motion.drawn, undefined);
  // A short one: its pop early, its exit at its end.
  assert.deepEqual(stickerMoments(60), { pop: 16, out: 60 });
});

test("« Titre en autocollant »: its words, the name required, who makes it optional, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "titre", text: "Bouquet surprise du samedi" }, { slot: "avec", text: "" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(enBoutique, answer)!.texts, { titre: "Bouquet surprise du" });
  assert.equal(readPieceFill(enBoutique, { ...answer, texts: [{ slot: "avec", text: "avec Léa" }] }), null);
});

test("« Titre en autocollant » is offered on a shot of someone, never on a place without anyone", () => {
  const clip = (person: boolean) =>
    ({
      duration: 6,
      orientation: "portrait",
      summary: person ? "un pizzaïolo derrière son comptoir" : "la salle vide",
      setting: "intérieur, un restaurant",
      lighting: "good",
      shots: [{ start: 0, end: 6, description: person ? "un homme sourit derrière le comptoir" : "des tables vides", subject: person ? "homme" : "tables", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: person, framing: "medium", camera: "handheld", subject_box: [300, 100, 700, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([enBoutique], pieceShots([{ media_id: "a", analysis: clip(true) }], {}), 1).map((p) => p.key), ["en-boutique"]);
  assert.deepEqual(piecesOffered([enBoutique], pieceShots([{ media_id: "a", analysis: clip(false) }], {}), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Face = { x: number; y: number; width: number; height: number };

function drawAt(frame: number, props: { texts?: Record<string, string>; faces?: Face[]; brand?: Record<string, unknown>; durationInFrames?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${enBoutique.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const durationInFrames = props.durationInFrames ?? 120;
  const track = props.faces ? () => ({ hands: [], bodies: [], faces: props.faces! }) : undefined;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames,
    brand: { name: "Chez Léa", displayFont: "Inter Tight", bodyFont: "Figtree", ...props.brand },
    shots: [{ from: -15, durationInFrames: durationInFrames + 15, kind: "video", aspect: 0.5625 }],
    texts: { beat: "18", pop: "31", out: "97", titre: "Pizza du marché", avec: "avec Léa & Marco", ...props.texts },
    ...(track ? { track } : {}),
  });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const own = (node: Drawn): string => (node.children.flat(Infinity) as unknown[]).flatMap((c) => (typeof c === "string" ? [c] : c && typeof c === "object" && "children" in c ? [own(c as Drawn)] : [])).join(" ").replace(/\s+/g, " ").trim();
const sticker = (tree: Drawn) => flatten(tree).find((n) => n.props.key === "sticker") ?? null;
const styleOf = (n: Drawn) => (n.props.style ?? {}) as Record<string, string | number>;

test("« Titre en autocollant » draws: nothing before its pop, then its bounce, two seconds, its exit, never a fade", () => {
  assert.equal(sticker(drawAt(30)), null);
  const look = (f: number) => {
    const s = sticker(drawAt(f))!;
    const t = String(styleOf(s).transform);
    return [Number(/scale\(([\d.]+)\)/.exec(t)![1]), styleOf(s).filter];
  };
  assert.deepEqual([31, 32, 33, 34, 35].map(look), [[0.55, "blur(7px)"], [1.04, "blur(3px)"], [1.08, "none"], [1.03, "none"], [1, "none"]]);
  assert.deepEqual([95, 96].map(look), [[0.75, "blur(4px)"], [0.42, "blur(6px)"]]);
  assert.equal(sticker(drawAt(97)), null);
  assert.doesNotMatch(JSON.stringify(sticker(drawAt(60))), /opacity/);
  // Its card between x 140 and 940, tilted 5,5°, its name on two lines in the sticker's face, who makes it under it.
  const s = sticker(drawAt(60))!;
  assert.deepEqual([styleOf(s).left, styleOf(s).width], [140, 800]);
  assert.match(String(styleOf(s).transform), /rotate\(-5\.5deg\)/);
  const texts = flatten(s).filter((n) => n.type === "FitText");
  assert.deepEqual(texts.map(own), ["Pizza du marché", "avec Léa & Marco"]);
  assert.deepEqual(texts[0]!.children.flat(Infinity).filter((c) => c && typeof c === "object").map((c) => own(c as Drawn)), ["Pizza", "du marché"]);
  const type = texts[0]!.props.innerStyle as Record<string, string>;
  assert.equal(String(type.fontFamily).split(",")[0], "'Paytone One'");
  assert.equal(type.color, "#fcc83b");
  assert.equal((texts[1]!.props.innerStyle as Record<string, number>).fontSize, 48);
  // Her colour when it is bright and vivid enough.
  assert.equal((flatten(sticker(drawAt(60, { brand: { accent: "#e8417a" } }))!).find((n) => n.type === "FitText")!.props.innerStyle as Record<string, string>).color, "#e8417a");
  // Without a name: nothing at all.
  assert.equal(sticker(drawAt(60, { texts: { titre: "" } })), null);
});

test("« Titre en autocollant » sits under her face, above it when her face is low, smaller when neither leaves room, never on a voice's subtitles", () => {
  const placed = (faces?: Face[], texts?: Record<string, string>) => {
    const s = sticker(drawAt(60, { ...(faces ? { faces } : {}), ...(texts ? { texts } : {}) }))!;
    const top = Number(styleOf(s).top);
    const tall = Number(styleOf(s).height);
    const k = Number(/scale\(([\d.]+)\)/.exec(String(styleOf(s).transform))![1]);
    // How far its tilted card reaches above and below its middle (its block under its lower left), at a scale.
    const tilt = (5.5 * Math.PI) / 180;
    const up = (s: number) => (400 * Math.sin(tilt) + (tall / 2) * Math.cos(tilt)) * k * s;
    const down = (s: number) => (412 * Math.sin(tilt) + (tall / 2 + 14) * Math.cos(tilt)) * k * s;
    const cy = top + tall / 2;
    return { cy, tall, k, top: cy - up(1), bottom: cy + down(1), highest: cy - up(1.08), lowest: cy + down(1.08) };
  };
  const clear = (p: ReturnType<typeof placed>, face?: Face) => {
    // Its bounce included: above the row of a voice's subtitles (64 % of the height), under the top of the frame.
    assert.ok(p.lowest <= 1920 * 0.64 - 8 + 1 && p.highest >= 89, JSON.stringify(p));
    // Off her face: under her chin or over her brow, 30 px away.
    if (face) assert.ok(p.top >= face.y + face.height * 0.62 + 29 || p.bottom <= face.y - face.height * 0.62 - 29, JSON.stringify({ p, face }));
  };
  // Without a face followed: its middle at half the height, its card 0,19 of it tall with its line, at its full size.
  const plain = placed();
  assert.equal(plain.tall, Math.round(1920 * 0.19));
  assert.ok(Math.abs(plain.cy - 960) <= 0.5 && plain.k === 1, JSON.stringify(plain));
  clear(plain);
  // Her face high in the picture, as behind a counter: its usual place, under her chin.
  const high: Face = { x: 540, y: 520, width: 200, height: 260 };
  assert.deepEqual(placed([high]), plain);
  clear(plain, high);
  // Her face low: above it, at its full size.
  const low: Face = { x: 540, y: 1250, width: 240, height: 300 };
  const above = placed([low]);
  assert.ok(above.k === 1 && above.cy < plain.cy, JSON.stringify(above));
  clear(above, low);
  // Her face a little lower and bigger: under it, a little smaller.
  const lower: Face = { x: 540, y: 600, width: 240, height: 300 };
  const smaller = placed([lower]);
  assert.ok(smaller.k > 0.8 && smaller.k < 1 && smaller.cy > plain.cy, JSON.stringify(smaller));
  clear(smaller, lower);
  // Her face big in the middle of the picture: where there is more room, over her brow, smaller still.
  const big: Face = { x: 540, y: 700, width: 300, height: 380 };
  const top = placed([big]);
  assert.ok(top.k > 0.6 && top.k < 0.8 && top.cy < 400, JSON.stringify(top));
  clear(top, big);
  // Without its line: a smaller card.
  assert.equal(placed(undefined, { avec: "" }).tall, Math.round(1920 * 0.15));
});
