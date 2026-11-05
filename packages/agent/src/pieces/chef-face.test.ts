import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { pieceFillInput, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { chefFace, chefFaceLast } from "./chef-face.ts";

// « Le plat, puis la dégustation », the effect of the bank (chef-face.ts): its own checks, beside the bank's (features.test.ts).

/** A run of her shots as the editor cuts it under it: a lead shot, her dish in shots of 0,8 s, her face 2 s last, an after shot. */
const run = (n: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...Array.from({ length: n - 1 }, (_, i) => ({ file: `plat${i}`, at: 0.5, seconds: 0.8 })),
  { file: "elle", at: 1, seconds: 2 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Le plat, puis la dégustation » (effect v1): its layer over her dish then her face, timed on what she says, the music stopped under her formula", () => {
  assert.deepEqual(checkMotionCode(chefFace.code), []);
  assert.ok(chefFace.code.length < 24000);
  for (const n of [2, 4, 8]) {
    const fill = { texts: { fort: "48 heures de pousse", fin: "Bon appétit !" }, objects: {}, settings: {} };
    const span: [number, number] = [1.2, 1.2 + (n - 1) * 0.8 + 2];
    const plan = pieceTestPlan({ piece: chefFace, shots: run(n), span, fill, bpm: 100 });
    assert.ok(editPlanSchema.safeParse(plan).success, `n=${n}`);
    const layer = plan.layers![0]!;
    const motion = layer.motion;
    assert.deepEqual(motion.piece, { key: "chef-face", version: 1 });
    assert.equal(motion.times_spoken, true);
    // Its last shot (her face) from its first image: her formula there.
    assert.deepEqual(motion.texts, { beat: "18", mine: Array.from({ length: n }, (_, i) => i + 1).join(","), last: String((n - 1) * 24), fort: "48 heures de pousse", fin: "Bon appétit !" });
    // Nothing of her cut out, no object, no sound.
    assert.equal(motion.drawn, undefined);
    assert.equal(motion.sounds, undefined);
    // Her music stopped dead from her last shot to its end, back with the montage after it.
    const shape = pieceMusicShape({ piece: chefFace, fill, plan, layer, bpm: 100 })!;
    assert.equal(shape.pauses!.length, 1);
    assert.ok(Math.abs(shape.pauses![0]!.from - (1.2 + (n - 1) * 0.8)) < 0.02 && Math.abs(shape.pauses![0]!.to - span[1]) < 0.02, JSON.stringify(shape.pauses));
  }
  // Its last shot's start, clamped to the effect; on a very short one, no pause.
  assert.equal(chefFaceLast({ frames: 90, shots: [{ from: -10, frames: 40 }, { from: 30, frames: 60 }] }), 30);
  assert.equal(chefFaceLast({ frames: 90, shots: [] }), 54);
  assert.equal(chefFace.timeline!({ frames: 40, bpm: 100, shots: [{ from: 0, frames: 34 }, { from: 34, frames: 6 }], words: {}, settings: {} }).music, undefined);
});

test("« Le plat, puis la dégustation »: its filler writes her formula (required) and her strong words, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "fort", text: "quarante-huit heures de pousse lente" }, { slot: "fin", text: "Venez goûter notre pizza napolitaine maison" }], objects: [], settings: [] };
  const read = readPieceFill(chefFace, answer)!;
  assert.deepEqual(read.texts, { fort: "quarante-huit heures de", fin: "Venez goûter notre pizza" });
  assert.equal(readPieceFill(chefFace, { ...answer, texts: [{ slot: "fort", text: "tout est maison" }] }), null);
  assert.ok(readPieceFill(chefFace, { ...answer, texts: [{ slot: "fin", text: "Bon appétit !" }] }));
  const input = pieceFillInput({ piece: chefFace, under: [{ id: "plat", photo: false, shows: "une pizza qu'on sort du four" }, { id: "elle", photo: false, shows: "une cheffe goûte face caméra" }], brief: "", request: "", business: { name: "Pizzeria Lina" }, said: "Ici la pâte repose 48 heures. Bon appétit !" });
  assert.equal(input.effet.ses_mots.length, 2);
  assert.match(JSON.stringify(input), /Bon appétit/);
});

test("« Le plat, puis la dégustation » is offered on a video of someone and another file, never on one file alone", () => {
  const clip = {
    duration: 8,
    orientation: "portrait",
    summary: "une cheffe goûte son plat face caméra",
    setting: "intérieur d'un restaurant",
    lighting: "good",
    shots: [{ start: 0, end: 8, description: "une femme à table qui goûte et parle face caméra", subject: "femme", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: true, framing: "medium", camera: "static", subject_box: [300, 200, 700, 900], beauty: 4 }],
    best_moments: [],
    transcript: "",
  } as unknown as ClipAnalysis;
  const shots = pieceShots([{ media_id: "a", analysis: clip }], {});
  assert.deepEqual(piecesOffered([chefFace], shots, 2).map((p) => p.key), ["chef-face"]);
  assert.deepEqual(piecesOffered([chefFace], shots, 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Face = { x: number; y: number; width: number; height: number };

/** What its Scene draws at a frame (its last shot from image 120 of 180), run with a plain tree for React (no renderer). */
function drawAt(frame: number, props: { texts?: Record<string, string>; spoken?: { w: string; from: number; to: number }[]; face?: Face }): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${chefFace.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const track = props.face ? () => ({ hands: [], bodies: [], faces: [{ id: 0, ...props.face, points: {} }] }) : undefined;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: 180,
    brand: { displayFont: "Bebas Neue", bodyFont: "Jost", accent: "#c0392b" },
    shots: [
      { from: -6, durationInFrames: 30, kind: "video", aspect: 0.5625 },
      { from: 24, durationInFrames: 40, kind: "video", aspect: 0.5625 },
      { from: 64, durationInFrames: 56, kind: "video", aspect: 0.5625 },
      { from: 120, durationInFrames: 66, kind: "video", aspect: 0.5625 },
    ],
    texts: { beat: "18", mine: "0,1,2,3", last: "120", fin: "Bon appétit !", ...props.texts },
    spoken: props.spoken ?? [],
    track,
  });
}

/** Her words, each 7 frames long with a gap of 2, from a frame on (a pause of 10 frames after a full stop or a comma). */
function sayFrom(at: number, text: string) {
  const out: { w: string; from: number; to: number }[] = [];
  let f = at;
  for (const w of text.split(" ")) {
    out.push({ w, from: f, to: f + 7 });
    f += /[.,]$/.test(w) ? 17 : 9;
  }
  return out;
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
function seen(tree: Drawn) {
  const fits = flatten(tree).filter((n) => n.type === "FitText");
  assert.ok(fits.length <= 1, "one text at a time");
  const t = fits[0];
  return t ? { text: String(t.children[0]).replace(/\s/g, " "), size: Number((t.props.innerStyle as Record<string, number>).fontSize), box: t.props.style as Record<string, number> } : null;
}

const SPEECH = sayFrom(3, "Ici la pâte repose, et tout est fait maison. Le reste, c'est le four.");
const at = (w: string) => SPEECH.find((x) => x.w.replace(/[.,]$/, "") === w)!.from;

test("« Le plat, puis la dégustation » draws her words a few at a time, her strong words big, her formula huge on her face", () => {
  const texts = { fort: "tout est fait maison" };
  // Her words, four at most, in capitals, small, on the 59 % line; a comma at the end goes.
  const first = seen(drawAt(at("Ici"), { texts, spoken: SPEECH }))!;
  assert.equal(first.text, "ICI LA PÂTE REPOSE");
  assert.equal(first.size, 55);
  assert.ok(Math.abs(first.box.top! + first.box.height! / 2 - Math.round(0.593 * 1920)) <= 1);
  // A word alone before its strong words, as the original's « D'UN » before « CURRY JAPONAIS ».
  assert.equal(seen(drawAt(at("et"), { texts, spoken: SPEECH }))!.text, "ET");
  // Its strong words in place of hers, 1,75 times as big, from the instant she says them.
  const strong = seen(drawAt(at("tout"), { texts, spoken: SPEECH }))!;
  assert.equal(strong.text, "TOUT EST FAIT MAISON");
  assert.equal(strong.size, Math.round(55 * 1.75));
  // Then her words again, until her last shot.
  assert.equal(seen(drawAt(at("Le"), { texts, spoken: SPEECH }))!.text, "LE RESTE");
  // From her last shot: her formula alone, 3,3 times as big, to the last image (her words then not written).
  for (const f of [120, 150, 179]) {
    const formula = seen(drawAt(f, { texts, spoken: SPEECH }))!;
    assert.equal(formula.text, "BON APPÉTIT !");
    assert.equal(formula.size, Math.round(55 * 3.3));
  }
  // Nobody speaks under it: its strong words over her dish from the first image, her formula on her face.
  assert.equal(seen(drawAt(0, { texts }))!.text, "TOUT EST FAIT MAISON");
  assert.equal(seen(drawAt(119, { texts }))!.text, "TOUT EST FAIT MAISON");
  assert.equal(seen(drawAt(120, { texts }))!.text, "BON APPÉTIT !");
  // Without strong words: only hers, four at a time.
  assert.equal(seen(drawAt(at("tout"), { spoken: SPEECH }))!.text, "ET TOUT EST FAIT");
});

test("« Le plat, puis la dégustation »: every word in the safe zone, off her face on her last shot", () => {
  for (let f = 0; f < 180; f += 2) {
    const s = seen(drawAt(f, { texts: { fort: "tout est fait maison" }, spoken: SPEECH }));
    if (!s) continue;
    assert.ok(s.box.left === 140 && s.box.width === 800 && s.box.top! >= 0.06 * 1920 && s.box.top! + s.box.height! <= 0.75 * 1920 + 1, `${f}: ${JSON.stringify(s.box)}`);
  }
  // Her face high on her last shot: her formula on the original's line, under her chin.
  const high = { x: 540, y: 600, width: 280, height: 260 };
  const kept = seen(drawAt(150, { spoken: SPEECH, face: high }))!;
  assert.ok(Math.abs(kept.box.top! + kept.box.height! / 2 - Math.round(0.593 * 1920)) <= 1 && kept.box.top! >= high.y + high.height * 0.75, JSON.stringify(kept.box));
  // Lower, on the line, no room under her chin for two big lines: above her head.
  const low = { x: 540, y: 820, width: 280, height: 260 };
  const above = seen(drawAt(150, { spoken: SPEECH, face: low }))!;
  assert.ok(above.box.top! + above.box.height! <= low.y - low.height * 0.95 + 1, JSON.stringify(above.box));
  // On her dish, the line stays whatever her face does on her last shot.
  const dish = seen(drawAt(at("Ici"), { spoken: SPEECH, face: low }))!;
  assert.ok(Math.abs(dish.box.top! + dish.box.height! / 2 - Math.round(0.593 * 1920)) <= 1);
});
