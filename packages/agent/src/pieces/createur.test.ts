import assert from "node:assert/strict";
import { test } from "node:test";
import { outputFormat } from "../answer.ts";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { pieceFillInput, pieceFillSchemaFor, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { createur } from "./createur.ts";

// « Face caméra et références », the effect of the bank (createur.ts): its own checks, beside the bank's (features.test.ts).

/** Her talk as the chain cuts it under it: a lead shot, her talking shot in n pieces of 1,5 s, an after shot. */
const talk = (n: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  ...Array.from({ length: n }, (_, i) => ({ file: "talk", at: 2 + i * 1.6, seconds: 1.5 })),
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Face caméra et références » (effect v1): its layer over her talk, timed on what she says, her photos laid in its order", () => {
  for (const n of [1, 2, 6]) {
    const fill = { texts: { nom1: "le croissant", nom2: "les macarons" }, objects: {}, settings: {}, photos: ["p1", "p2"] };
    const plan = pieceTestPlan({ piece: createur, shots: talk(n), span: [1.2, 1.2 + n * 1.5], fill, bpm: 100 });
    assert.ok(editPlanSchema.safeParse(plan).success, `n=${n}`);
    const motion = plan.layers![0]!.motion;
    assert.deepEqual(motion.piece, { key: "createur", version: 1 });
    assert.equal(motion.times_spoken, true);
    assert.deepEqual(motion.photos, ["p1", "p2"]);
    assert.deepEqual(motion.texts, { beat: "18", nom1: "le croissant", nom2: "les macarons" });
    // Nothing of her cut out (her photos bring their own cut-outs), no object, no sound.
    assert.equal(motion.drawn, undefined);
    assert.equal(motion.sounds, undefined);
  }
  // Its code draws her shot again in the bottom half: it gets its shots (Footage).
  assert.match(createur.code, /h\(Footage, \{ key: "low"/);
});

test("« Face caméra et références »: its filler names what she names and picks her photos of them, four at most, among hers", () => {
  const schema = pieceFillSchemaFor(createur);
  const json = (outputFormat(schema as never) as unknown as { schema: { required?: string[] } }).schema;
  assert.ok(json.required?.includes("photos"));
  const answer = {
    fits: true,
    missing: "",
    texts: [{ slot: "nom1", text: "le croissant" }, { slot: "nom2", text: "les macarons framboise et pistache" }, { slot: "nom3", text: "" }, { slot: "nom4", text: "" }],
    objects: [],
    settings: [{ name: "format", value: "plein" }],
    photos: ["p2", "x", "p1", "p3", "p4", "p5"],
  };
  const read = readPieceFill(createur, answer, { photos: ["p1", "p2", "p3", "p4", "p5"] })!;
  assert.deepEqual(read.photos, ["p2", "p1", "p3", "p4"]);
  assert.deepEqual(read.texts, { nom1: "le croissant", nom2: "les macarons framboise" });
  assert.deepEqual(read.settings, { format: "plein" });
  // Its first name is required.
  assert.equal(readPieceFill(createur, { ...answer, texts: [] }, { photos: ["p1"] }), null);
  const input = pieceFillInput({ piece: createur, under: [{ id: "talk", photo: false, shows: "elle parle face caméra" }], brief: "", request: "", business: {}, said: "D'abord le croissant", photos: [{ id: "p1", shows: "un croissant sur une assiette" }] });
  assert.deepEqual(input.effet.photos, { veut: createur.photos!.want, au_plus: 4 });
  assert.deepEqual(input.ses_photos, [{ id: "p1", montre: "un croissant sur une assiette" }]);
});

test("« Face caméra et références » is offered on a video of someone and another file, never on her talk alone", () => {
  const clip = {
    duration: 12,
    orientation: "portrait",
    summary: "une pâtissière parle face caméra",
    setting: "intérieur",
    lighting: "good",
    shots: [{ start: 0, end: 12, description: "une femme assise qui parle face caméra", subject: "femme", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: true, framing: "medium", camera: "static", subject_box: [300, 200, 700, 900], beauty: 4 }],
    best_moments: [],
    transcript: "",
  } as unknown as ClipAnalysis;
  const shots = pieceShots([{ media_id: "a", analysis: clip }], {});
  assert.deepEqual(piecesOffered([createur], shots, 2).map((p) => p.key), ["createur"]);
  assert.deepEqual(piecesOffered([createur], shots, 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Face = { x: number; y: number; width: number; height: number; points?: Record<string, { x: number; y: number }> };
type Photo = { src: string; aspect: number; cutout?: string; subject?: { x: number; y: number; w: number; h: number } };
type Body = { points: Record<string, { x: number; y: number; visible: boolean }> };

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; spoken?: { w: string; from: number; to: number }[]; face?: Face | null; body?: Body; photos?: Photo[] }): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }) };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Img: "Img", Cutout: "Cutout", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${createur.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const brand = { displayFont: "Bricolage Grotesque", bodyFont: "Inter Tight", accent: "#c0532b" };
  const { face, body } = props;
  // Her face and her body in the frame (as the montage draws her shot).
  const track = face === undefined && !body ? undefined : () => ({ hands: [], bodies: body ? [body] : [], faces: face ? [face] : [] });
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: 240,
    brand,
    shots: [{ from: -30, durationInFrames: 300, kind: "video", aspect: 0.5625 }],
    texts: { beat: "18", ...props.texts },
    spoken: props.spoken ?? [],
    photos: props.photos ?? [],
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
/** The photos laid at that frame (their src and the box that holds them), her shot laid again, the subtitle and the big name. */
function seenAt(tree: Drawn) {
  const nodes = flatten(tree);
  const imgs = nodes.filter((n) => n.type === "Img").map((img) => {
    const box = nodes.find((n) => n.children.includes(img))!;
    return { src: img.props.src as string, top: Number(styleOf(box).top), height: Number(styleOf(box).height) };
  });
  // Her shot laid again: its box, inside the bottom half that clips it when it is moved down.
  const her = nodes.find((n) => n.type === "Footage");
  const clip = her ? nodes.find((n) => n.children.includes(her) && styleOf(n).overflow === "hidden") : undefined;
  const fits = nodes.filter((n) => n.type === "FitText");
  const sub = fits.find((n) => String(n.props.key).startsWith("sub-"));
  const big = fits.find((n) => String(n.props.key).startsWith("big-"));
  return {
    imgs,
    her: her ? { top: Number(styleOf(her).top) + (clip ? Number(styleOf(clip).top) : 0), height: Number(styleOf(her).height), clip: clip ? [Number(styleOf(clip).top), Number(styleOf(clip).height)] : null } : null,
    cutout: nodes.find((n) => n.type === "Cutout") ?? null,
    sub: sub ? { text: sub.children[0] as string, top: Number(styleOf(sub).top), height: Number(styleOf(sub).height), size: Number((sub.props.innerStyle as Record<string, number>).fontSize) } : null,
    big: big ? { text: big.children[0] as string, top: Number(styleOf(big).top), left: Number(styleOf(big).left), width: Number(styleOf(big).width) } : null,
  };
}

const SPEECH = sayFrom(6, "Alors chez nous, il y a d'abord le croissant, puis les macarons, et les beignets à la crème.");
const PHOTOS: Photo[] = [{ src: "/croissant.jpg", aspect: 1.5 }, { src: "/macarons.jpg", aspect: 1.5 }, { src: "/beignets.jpg", aspect: 1.5 }];
const TEXTS = { nom1: "le croissant", nom2: "les macarons", nom3: "les beignets" };
const at = (w: string) => SPEECH.find((x) => x.w.replace(/[.,]$/, "") === w)!.from;

test("« Face caméra et références » draws: each photo in the top half from the instant she names it to the next name", () => {
  // Before the first name: nothing over her picture but her words.
  const before = seenAt(drawAt(at("le") - 5, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS }));
  assert.deepEqual(before.imgs, []);
  assert.ok(before.sub);
  // On the image she says « le » of « le croissant », its photo, cut sharp in the top half; then the next one.
  const one = seenAt(drawAt(at("le"), { texts: TEXTS, spoken: SPEECH, photos: PHOTOS }));
  assert.deepEqual(one.imgs, [{ src: "/croissant.jpg", top: 0, height: 960 }]);
  assert.equal(seenAt(drawAt(at("les") - 1, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS })).imgs[0]!.src, "/croissant.jpg");
  assert.equal(seenAt(drawAt(at("les"), { texts: TEXTS, spoken: SPEECH, photos: PHOTOS })).imgs[0]!.src, "/macarons.jpg");
  assert.equal(seenAt(drawAt(239, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS })).imgs[0]!.src, "/beignets.jpg");
  // No face followed: she is laid again in the bottom half (framed on her by the engine), the subtitles on the split's line.
  assert.deepEqual(one.her, { top: 960, height: 960, clip: null });
  assert.ok(one.sub && one.sub.top < 960 && one.sub.top + one.sub.height > 960 && one.sub.size >= 48, JSON.stringify(one.sub));
});

test("« Face caméra et références »: over her own picture when her head is below the middle, laid again when it is not", () => {
  const low = { x: 540, y: 1400, width: 300, height: 360 };
  const over = seenAt(drawAt(at("le") + 2, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS, face: low }));
  assert.equal(over.her, null);
  assert.equal(over.imgs[0]!.height, 960);
  // Her head higher: her own picture, at the montage's scale (full frame), moved down until the top of her head is just
  // under the split, clipped to the bottom half; her words on the split's line.
  const high = { x: 540, y: 700, width: 300, height: 360 };
  const moved = seenAt(drawAt(at("le") + 2, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS, face: high }));
  assert.deepEqual(moved.her, { top: Math.round(960 + 0.02 * 1920 - (700 - 0.95 * 360)), height: 1920, clip: [960, 960] });
  assert.ok(moved.sub && moved.sub.top < 960 && moved.sub.top + moved.sub.height > 960);
  // A small face, its eyes coming up near the split's line once moved down: the subtitles go onto the photo.
  const small = { x: 540, y: 700, width: 110, height: 130, points: { right_eye: { x: 520, y: 690 }, left_eye: { x: 560, y: 690 } } };
  const lifted = seenAt(drawAt(at("le") + 2, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS, face: small }));
  assert.ok(lifted.sub && lifted.sub.top + lifted.sub.height <= 960, JSON.stringify(lifted.sub));
  // Her head read on her body (her nose, sized by her shoulders) where the face model misses it, or where it gives a
  // small face that is not hers: moved down until her hair is under the split all the same.
  const shoulders = { left_shoulder: { x: 680, y: 900, visible: true }, right_shoulder: { x: 400, y: 900, visible: true } };
  const body = { points: { nose: { x: 540, y: 700, visible: true }, ...shoulders } };
  const turned = seenAt(drawAt(at("le") + 2, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS, body }));
  assert.deepEqual(turned.her, { top: Math.round(960 + 0.02 * 1920 - (700 - 0.68 * 280)), height: 1920, clip: [960, 960] });
  const wrong = seenAt(drawAt(at("le") + 2, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS, body, face: { x: 540, y: 880, width: 50, height: 60 } }));
  assert.deepEqual(wrong.her, turned.her);
  // Full frame on her word.
  const full = seenAt(drawAt(at("le") + 2, { texts: { ...TEXTS, format: "plein" }, spoken: SPEECH, photos: PHOTOS, face: high }));
  assert.deepEqual(full.imgs.map((i) => [i.top, i.height]), [[0, 1920]]);
  assert.equal(full.her, null);
});

test("« Face caméra et références »: the first object cut out above her head when there is room, a name without a photo written big", () => {
  const low = { x: 540, y: 1400, width: 300, height: 360 };
  const object = { src: "/pot.jpg", aspect: 1, cutout: "/pot.png", subject: { x: 0.3, y: 0.2, w: 0.4, h: 0.6 } };
  const cut = seenAt(drawAt(40, { texts: { nom1: "le pot" }, spoken: sayFrom(6, "Voici le pot bleu."), photos: [object], face: low }));
  assert.ok(cut.cutout, "cut out on her wall");
  const placed = cut.cutout!.props as { y: number; height: number; rim: number; shadow: boolean };
  assert.ok(placed.y + placed.height <= low.y - low.height * 0.95, `${placed.y} + ${placed.height}`);
  assert.equal(placed.rim, 0);
  assert.equal(placed.shadow, false);
  // Her face too low for her words under it: they go above her head, under the object, never on her face.
  assert.ok(cut.sub && cut.sub.top >= placed.y + placed.height && cut.sub.top + cut.sub.height <= low.y - low.height * 0.95, JSON.stringify(cut.sub));
  // A name she says without a photo of it: written big on her, under her face, left of the apps' buttons.
  const named = seenAt(drawAt(at("macarons") + 2, { texts: TEXTS, spoken: SPEECH, photos: PHOTOS.slice(0, 1), face: { x: 540, y: 700, width: 300, height: 360 } }));
  assert.equal(named.big?.text, "les macarons");
  assert.ok(named.big!.top >= 700 + 360 * 0.75 && named.big!.left >= 140 && named.big!.left + named.big!.width <= 940);
  assert.deepEqual(named.imgs, []);
});

test("« Face caméra et références »: her words a phrase at a time, nine words at most, cut on her pauses and full stops", () => {
  const words = sayFrom(4, "Alors chez nous on fait tout à la main chaque matin depuis vingt ans. Et voilà.");
  const first = seenAt(drawAt(10, { texts: { nom1: "voilà" }, spoken: words }));
  assert.equal(first.sub?.text, "Alors chez nous on fait tout à la main");
  const later = seenAt(drawAt(words.find((w) => w.w === "chaque")!.from, { texts: { nom1: "voilà" }, spoken: words }));
  assert.equal(later.sub?.text, "chaque matin depuis vingt ans.");
});
