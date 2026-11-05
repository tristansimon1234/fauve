import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { planCues } from "../sfx.ts";
import { interrupteur, interrupteurFlip } from "./interrupteur.ts";

// « Interrupteur », the effect of the bank (interrupteur.ts): its own checks, beside the bank's (features.test.ts).

/** Her one still shot as the chain cuts it under it (6 s), between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "wall", at: 0.5, seconds: 6 },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Interrupteur » (effect v1): its layer over her one shot, her cut out there, its click on her gesture, its flip on a beat", () => {
  const plan = pieceTestPlan({ piece: interrupteur, shots, span: [1.2, 7.2], fill: { texts: { nom: "Soirée vinyles" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "interrupteur", version: 1 });
  // Its fallback moment on the beat nearest to the original's (45 % of it), and the window where her hand is looked for.
  assert.equal(interrupteurFlip(180, 100), 90);
  assert.deepEqual(motion.texts, { beat: "18", flip: "90", look_from: "12", look_to: "150", mine: "1", nom: "Soirée vinyles" });
  // She is cut out on her shot (the second of hers), to pass in front of the switch and the poster.
  assert.deepEqual(motion.drawn, { shots: 3, subjects: [1] });
  // Its click: on her gesture in that shot (the plan's second segment), the window on the Reel's clock, else its moment.
  assert.equal(motion.sounds?.length, 1);
  assert.deepEqual(motion.sounds![0], { at: 3, sound: "light switch click", seconds: 0.5, gain: -2, skill: true, hand: { shot: 1, moment: "highest", within: [1.6, 6.2] } });
  // No tracks: the click lands on its own moment, 3 s into it (4,2 s of the Reel).
  assert.deepEqual(planCues(plan, [{ start: 0, length: 1.2 }, { start: 1.2, length: 6 }, { start: 7.2, length: 1.8 }]).map((c) => c.at), [4.2]);
  // A short one: its moment a second before its end at the latest, on a beat when it can.
  assert.equal(interrupteurFlip(90, 100), 36);
  assert.ok(interrupteurFlip(300, 120) % 15 === 0 && interrupteurFlip(300, 120) <= 270);
});

test("« Interrupteur »: its words, the poster's title required, its line and detail optional, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "nom", text: "Soirée vinyles du jeudi" }, { slot: "ligne", text: "" }, { slot: "detail", text: "dès 19 h" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(interrupteur, answer)!.texts, { nom: "Soirée vinyles du", detail: "dès 19 h" });
  assert.equal(readPieceFill(interrupteur, { ...answer, texts: [{ slot: "ligne", text: "ouverture" }] }), null);
});

test("« Interrupteur » is offered on a still video of someone, never on a moving camera nor on her photos", () => {
  const clip = (camera: string) =>
    ({
      duration: 9,
      orientation: "portrait",
      summary: "une femme saute devant un mur blanc",
      setting: "intérieur, un mur blanc",
      lighting: "good",
      shots: [{ start: 0, end: 9, description: "une femme saute et touche le mur", subject: "femme", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: true, framing: "wide", camera, subject_box: [300, 100, 700, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([interrupteur], pieceShots([{ media_id: "a", analysis: clip("static") }], {}), 1).map((p) => p.key), ["interrupteur"]);
  assert.deepEqual(piecesOffered([interrupteur], pieceShots([{ media_id: "a", analysis: clip("handheld") }], {}), 1), []);
  assert.deepEqual(piecesOffered([interrupteur], pieceShots([], { p: { detection: { regions: [{ kind: "face" }], notes: "une femme devant un mur" } } as never }), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Seen = { hands: { points: Record<string, { x: number; y: number }> }[]; faces: unknown[]; bodies: { points: Record<string, { x: number; y: number; visible: boolean }> }[] };
type Box = { x: number; y: number; w: number; h: number } | null;

/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; track?: (f: number, box?: unknown) => Seen; subject?: (f: number) => Box; outline?: (f: number) => string | null; brand?: Record<string, unknown>; durationInFrames?: number; light?: number }): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    Img: "Img",
    Scribble: "Scribble",
    useCurrentFrame: () => frame,
    SubjectBox: (_shot: unknown, f: number) => (props.subject ? props.subject(f) : null),
    SubjectOutline: (_shot: unknown, f: number) => (props.outline ? props.outline(f) : null),
    LightUnder: () => (props.light === undefined ? null : { mean: props.light, high: props.light }),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${interrupteur.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const brand = { name: "Maison Farine", displayFont: "DM Serif Display", bodyFont: "Inter Tight", accent: "#b5293f", palette: { secondary: "#1d3b2a" }, ...props.brand };
  const durationInFrames = props.durationInFrames ?? 180;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames,
    brand,
    shots: [{ from: -15, durationInFrames: durationInFrames + 15, kind: "video", aspect: 0.5625 }],
    texts: { beat: "18", flip: "81", look_from: "12", look_to: String(durationInFrames - 30), nom: "Soirée vinyles", ...props.texts },
    track: props.track,
  });
}

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
/** The switch at that frame: its centre, its colour, its knob on the right or not. */
function switchAt(tree: Drawn) {
  const sw = flatten(tree).find((n) => n.props.key === "switch")!;
  const s = styleOf(sw);
  const knob = styleOf(sw.children[0] as Drawn);
  return { x: Number(s.left) + Number(s.width) / 2, y: Number(s.top) + Number(s.height) / 2, width: Number(s.width), height: Number(s.height), color: s.backgroundColor, on: Number(knob.left) > Number(s.width) * 0.3 };
}
const posterAt = (tree: Drawn) => flatten(tree).find((n) => n.props.key === "poster") ?? null;
const keyed = (tree: Drawn, key: string) => flatten(tree).find((n) => n.props.key === key) ?? null;

/** Her reach: hands that rise to their highest at frame `peak` (x 720, y 520), her shoulders at y 900, then come down. */
function reaching(peak: number, options: { x?: number; y?: number } = {}) {
  const x = options.x ?? 720;
  const top = options.y ?? 520;
  return (f: number): Seen => {
    const y = top + Math.abs(f - peak) * 12;
    const hand = { points: { wrist: { x, y: y + 160 }, index_tip: { x, y }, middle_tip: { x: x + 20, y: y + 6 } } };
    const body = { points: { left_shoulder: { x: 600, y: 900, visible: true }, right_shoulder: { x: 480, y: 900, visible: true } } };
    return { hands: f > peak - 40 && f < peak + 40 ? [hand] : [], faces: [], bodies: [body] };
  };
}

test("« Interrupteur » draws, without anyone followed: the switch at the original's place, off, flipped in one image on its moment", () => {
  const off = switchAt(drawAt(80, {}));
  // 28,75 % of the width, 0,46 of it tall, centred at 49,9 % across and 20,5 % down.
  assert.equal(off.width, 311);
  assert.equal(off.height, 143);
  assert.ok(Math.abs(off.x - 539) <= 1 && Math.abs(off.y - 394) <= 1, `${off.x} ${off.y}`);
  assert.equal(off.on, false);
  assert.equal(off.color, "#605e5a");
  assert.equal(posterAt(drawAt(80, {})), null);
  // On its moment, at once: the knob on the right, the track in her first colour dark enough, the poster there.
  const on = switchAt(drawAt(81, {}));
  assert.equal(on.on, true);
  assert.equal(on.color, "#b5293f");
  assert.ok(posterAt(drawAt(81, {})));
  // Her cut-out over them from just before it; her wall plays on (nothing says she left).
  assert.equal(keyed(drawAt(60, {}), "her"), null);
  assert.ok(keyed(drawAt(61, {}), "her"));
  assert.equal(keyed(drawAt(170, {}), "wall")!.props.at, undefined);
});

test("« Interrupteur »: the switch where her hand goes highest, as near the middle as her fingertip stays on it, flipped then", () => {
  const track = reaching(70);
  const sw = switchAt(drawAt(10, { track }));
  // At her fingertip's height; across, the middle pulled toward her hand until her fingertip is 42 % of it from its centre.
  assert.equal(sw.y, 520);
  assert.equal(Math.round(sw.x), Math.round(720 - 311 * 0.42));
  // Flipped on the image her hand is highest (the moment its click lands on), not before.
  assert.equal(switchAt(drawAt(69, { track })).on, false);
  assert.equal(switchAt(drawAt(70, { track })).on, true);
  // Her hand straight above the middle: the switch exactly there.
  assert.ok(Math.abs(switchAt(drawAt(10, { track: reaching(70, { x: 540 }) })).x - 540) <= 1);
  // Her hand read in the box her shot is drawn in (a horizontal video framed on her face there, not as the montage
  // centres it): where her picture shows it.
  const framed = (f: number, box?: unknown) => reaching(70, { x: box ? 540 : 300 })(f);
  assert.ok(Math.abs(switchAt(drawAt(10, { track: framed })).x - 540) <= 1);
  // Her fingertip across read on her cut-out's outline when it is the top of her silhouette at the height the tracker
  // saw her hand (her tracks placed centred, her picture framed on her face); her head at the top of it: the tracker's.
  const arm = () => "M 700 1900 C 760 900 800 700 850 515 C 900 700 950 900 980 1900 Z";
  assert.equal(switchAt(drawAt(10, { track, outline: arm })).x, Math.round(850 - 311 * 0.42));
  const head = () => "M 700 1900 C 760 1100 800 900 850 800 C 900 900 950 1100 980 1900 Z";
  assert.equal(Math.round(switchAt(drawAt(10, { track, outline: head })).x), Math.round(720 - 311 * 0.42));
  // Her hand never raised (under her shoulders, never above where it rests): at the original's place, flipped when her
  // hand is highest all the same (the click lands there).
  const low = (f: number): Seen => ({ ...reaching(70)(f), hands: f > 30 && f < 110 ? [{ points: { index_tip: { x: 700, y: 1000 + (f === 50 ? -4 : 0) } } }] : [] });
  const fallback = switchAt(drawAt(10, { track: low }));
  assert.ok(Math.abs(fallback.y - 394) <= 1 && Math.abs(fallback.x - 539) <= 1, `${fallback.x} ${fallback.y}`);
  assert.equal(switchAt(drawAt(49, { track: low })).on, false);
  assert.equal(switchAt(drawAt(50, { track: low })).on, true);
  // A jump with her hands held low (a gift in her arms): her hands rise with her, never above her shoulders: no reach.
  const jump = reaching(70, { y: 1250 });
  assert.ok(Math.abs(switchAt(drawAt(10, { track: jump })).y - 394) <= 1);
  // Her hand alone in the picture (no body seen): well above where it rests is a reach.
  const alone = (f: number): Seen => ({ ...reaching(70, { y: 1250 })(f), bodies: [] });
  assert.equal(switchAt(drawAt(10, { track: alone })).y, 1152);
});

test("« Interrupteur »: her poster under the switch, in her colours, its words in the safe zone, her name never twice under her logo", () => {
  const tree = drawAt(100, { texts: { ligne: "la semaine des events", detail: "du 8 au 14 février" } });
  const poster = posterAt(tree)!;
  const nodes = flatten(poster);
  const title = nodes.find((n) => String(n.props.key).startsWith("title-"))!;
  const box = styleOf(title);
  // Under the switch, 4,3 % of the height lower; its words between x 140 and 940 below the middle, above the bottom quarter.
  const sw = switchAt(tree);
  assert.ok(Number(box.top) >= sw.y + sw.height / 2 + 82, `${box.top}`);
  for (const t of nodes.filter((n) => n.type === "FitText")) {
    const b = styleOf(t);
    assert.ok(Number(b.top) + Number(b.height) <= 0.75 * 1920, `${t.props.key}`);
    if (Number(b.top) + Number(b.height) > 960) assert.ok(Number(b.left) >= 140 && Number(b.left) + Number(b.width) <= 940, `${t.props.key}: ${b.left} ${b.width}`);
  }
  // Its title in her second colour, its line in spaced capitals between two rules, a small label beside the title.
  assert.equal((title.props.innerStyle as Record<string, string>).color, "#1d3b2a");
  const line = nodes.find((n) => String(n.props.key).startsWith("s-la semaine"))!;
  const span = line.children[0] as Drawn;
  assert.equal(span.props["data-fauve-accent"], "");
  assert.equal(span.children.filter((c) => c && typeof c === "object").length, 2);
  // Her logo saying her name: the logo alone on top, never her name twice; her small words then at 48 px at least.
  const logo = posterAt(drawAt(100, { texts: { nom: "Farine", ligne: "ouverture" }, brand: { logoUrl: "/logo.png" } }))!;
  assert.ok(flatten(logo).some((n) => n.type === "Img"));
  assert.ok(!flatten(logo).some((n) => String(n.props.key).startsWith("title-")));
  const alone = flatten(logo).find((n) => String(n.props.key).startsWith("s-ouverture"))!;
  assert.ok(Number((alone.props.innerStyle as Record<string, number>).fontSize) >= 48);
  // Without a colour of hers dark enough: a phone's green and an ink.
  assert.equal(switchAt(drawAt(100, { brand: { accent: "#f6d7c3", palette: {} } })).color, "#34c759");
  // A dark wall under the poster: its words in her light colour (else a warm white); the switch keeps hers.
  const dark = (light?: string) => flatten(posterAt(drawAt(100, { light: 0.2, brand: { palette: { secondary: "#1d3b2a", ...(light ? { light } : {}) } } }))!).find((n) => String(n.props.key).startsWith("title-"))!;
  assert.equal((dark("#f4ebe1").props.innerStyle as Record<string, string>).color, "#f4ebe1");
  assert.equal((dark().props.innerStyle as Record<string, string>).color, "#f7f3ee");
  assert.equal((flatten(posterAt(drawAt(100, { light: 0.7 }))!).find((n) => String(n.props.key).startsWith("title-"))!.props.innerStyle as Record<string, string>).color, "#1d3b2a");
  assert.equal(switchAt(drawAt(100, { light: 0.2 })).color, "#b5293f");
});

test("« Interrupteur »: once she has left, her wall is held on that image to the end; her hands at the edge played on", () => {
  const track = reaching(70);
  const her = { x: 300, y: 300, w: 400, h: 1400 };
  // Gone from her cut-out at image 120: held from there, the same image to the end.
  const leaving = (f: number): Box => (f < 120 ? her : null);
  assert.equal(keyed(drawAt(119, { track, subject: leaving }), "wall")!.props.at, undefined);
  const at = (f: number) => Number(keyed(drawAt(f, { track, subject: leaving }), "wall")!.props.at);
  // The image of her shot on screen at 120 (it started 15 frames before the effect): held there.
  assert.equal(140 - at(140), 135);
  assert.equal(179 - at(179), 135);
  assert.equal(keyed(drawAt(150, { track, subject: leaving }), "her")!.props.at, at(150));
  // Her hands still at the picture's edge (a hundredth of her): she has not left, her shot plays on.
  const edge = (f: number): Box => (f < 120 ? her : { x: 1040, y: 900, w: 40, h: 140 });
  assert.equal(keyed(drawAt(170, { track, subject: edge }), "wall")!.props.at, undefined);
  // Not cut out, but tracked: gone when nobody is seen eight images in a row.
  const away = (f: number): Seen => (f < 125 ? track(f) : { hands: [], faces: [], bodies: [] });
  assert.equal(170 - Number(keyed(drawAt(170, { track: away }), "wall")!.props.at), 140);
});
