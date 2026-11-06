import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, PIECE_FILL_PROMPT, pieceFillInput, pieceMusicShape, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { subjectShots } from "../subject.ts";
import { curseur, curseurMoments, onWholeBeat } from "./curseur.ts";

// « Un clic sur tes produits », the effect of the bank (curseur.ts): its own checks, beside the bank's (features.test.ts).

/** Her place where someone carries her products (2,4 s), then her close-up of them (4,2 s), between a lead shot and an after shot. */
const shots = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "lieu", at: 0.5, seconds: 2.4 },
  { file: "gros", at: 0, seconds: 4.2, photo: true },
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Un clic sur tes produits » (effect v1): its layer over her place and her close-up, its clicks heard, the music paused between its first and its last", () => {
  const fill = { texts: { produit1: "Cappuccino", produit2: "Brownie" }, objects: { produit1: "cappuccino cup", produit2: "brownie" }, settings: {} };
  const plan = pieceTestPlan({ piece: curseur, shots, span: [1.2, 7.8], fill, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "curseur", version: 2 });
  // Its moments: its pause early in her place, its second click on the cut (2,4 s in), a name a click, the play on a
  // whole beat (18 frames at 100 BPM) a second before its end at most (here the last that leaves her second name a second).
  const m = curseurMoments(198, 100, [{ from: 0, frames: 72 }, { from: 72, frames: 126 }]);
  assert.equal(m.zoom, 72);
  assert.ok(m.pause < m.zoom - 6 && m.pause > m.enter);
  assert.ok(m.label1 > m.zoom && m.label2 > m.label1 && m.play - m.label2 >= 30 && m.play % 18 === 0 && m.play <= 198 - 30, JSON.stringify(m));
  assert.ok(onWholeBeat(m.play, 100) && !onWholeBeat(m.play + 5, 100));
  assert.deepEqual(Object.fromEntries(["enter", "pause", "zoom", "label1", "label2", "label3", "play", "out"].map((k) => [k, motion.texts![k]])), Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)])));
  // Its objects followed on its last shot only (her close-up), by the names its filler gave; nothing of her cut out.
  assert.deepEqual(motion.drawn, { shots: 4, objects: [{ shot: 2, name: "cappuccino cup" }, { shot: 2, name: "brownie" }] });
  assert.deepEqual([...subjectShots(plan)], []);
  // Its five clicks heard (the pause, the cut, her two names, the play).
  assert.deepEqual(motion.sounds!.map((s) => Math.round(s.at * 30)), [m.pause, m.zoom, m.label1, m.label2, m.play]);
  assert.ok(motion.sounds!.every((s) => s.sound === "computer mouse click"));
  // The music stops dead on its first click and comes back on the play, within its span, on the Reel's clock.
  const shape = pieceMusicShape({ piece: curseur, fill, plan, layer, bpm: 100 });
  assert.deepEqual(shape?.pauses, [{ from: Math.round((1.2 + m.pause / 30) * 1000) / 1000, to: Math.round((1.2 + m.play / 30) * 1000) / 1000 }]);
  // One name only: one click less.
  const single = pieceTestPlan({ piece: curseur, shots, span: [1.2, 7.8], fill: { ...fill, texts: { produit1: "Cappuccino" } }, bpm: 100 });
  assert.equal(single.layers![0]!.motion.sounds!.length, 4);
  assert.deepEqual(checkMotionCode(curseur.code), []);
});

test("« Un clic sur tes produits »: over her close-up alone, its pause early, its names, the play on a whole beat", () => {
  const m = curseurMoments(180, 100, [{ from: -12, frames: 192 }]);
  assert.equal(m.zoom, -1);
  assert.ok(m.pause >= 20 && m.pause <= 35 && m.label1 > m.pause && m.label2 > m.label1, JSON.stringify(m));
  assert.ok(m.play - m.label2 >= 51 && m.play % 18 === 0 && m.out <= 180, JSON.stringify(m));
  // A short one still holds: its moments in order within it.
  const short = curseurMoments(36, 100, [{ from: 0, frames: 36 }]);
  assert.ok(short.enter < short.pause && short.pause < short.label1 && short.label1 <= short.label2 && short.play <= 36, JSON.stringify(short));
});

test("« Un clic sur tes produits »: its words, the first name required, the second optional, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "produit1", text: "Cappuccino au lait d'avoine" }, { slot: "produit2", text: "" }], objects: [{ slot: "produit1", name: "Cappuccino Cup" }], settings: [] };
  const read = readPieceFill(curseur, answer)!;
  assert.deepEqual(read.texts, { produit1: "Cappuccino au lait" });
  assert.deepEqual(read.objects, { produit1: "cappuccino cup" });
  assert.equal(readPieceFill(curseur, { ...answer, texts: [{ slot: "produit2", text: "Brownie" }] }), null);
});

test("« Un clic sur tes produits » is offered on her close-ups, never on wide shots alone", () => {
  const clip = (framing: string) =>
    ({
      duration: 6,
      orientation: "portrait",
      summary: "deux cafés et un gâteau sur une table",
      setting: "intérieur d'un café",
      lighting: "good",
      shots: [{ start: 0, end: 6, description: "deux cafés et un gâteau", subject: "cafés", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera: "static", subject_box: [100, 300, 800, 900], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([curseur], pieceShots([{ media_id: "a", analysis: clip("close") }], {}), 1).map((p) => p.key), ["curseur"]);
  assert.deepEqual(piecesOffered([curseur], pieceShots([{ media_id: "a", analysis: clip("wide") }], {}), 1), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };

/** What its Scene draws at a frame, run with a plain tree for React: the kit's pieces as named nodes, what is read on her shots given. */
function drawAt(frame: number, props: { texts?: Record<string, string>; boxes?: Record<string, Box>; light?: number; shots?: unknown[]; durationInFrames?: number }): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Scribble: "Scribble",
    useCurrentFrame: () => frame,
    SubjectBox: (_shot: unknown, _f: number, _laid: unknown, name?: string) => (name && props.boxes?.[name]) ?? null,
    LightUnder: () => (props.light === undefined ? null : { mean: props.light, high: props.light }),
  };
  const code = curseur.code.split('"@produit1"').join('"cappuccino cup"').split('"@produit2"').join('"brownie"').split('"@produit3"').join('"croissant"');
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const durationInFrames = props.durationInFrames ?? 198;
  const m = curseurMoments(durationInFrames, 100, [{ from: 0, frames: 72 }, { from: 72, frames: 126 }]);
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames,
    brand: { name: "Café des Arts", displayFont: "Bebas Neue", bodyFont: "Jost", accent: "#1f6b4f", palette: { dark: "#1d1d1b" } },
    shots: props.shots ?? [
      { from: -36, durationInFrames: 36, kind: "video", aspect: 0.5625 },
      { from: 0, durationInFrames: 72, kind: "video", aspect: 0.5625 },
      { from: 72, durationInFrames: 126, kind: "photo", aspect: 0.75 },
    ],
    texts: { beat: "18", mine: "1,2", ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)])), produit1: "Cappuccino", produit2: "Brownie", ...props.texts },
  });
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const textOf = (node: Drawn): string => flatten(node).flatMap((n) => n.children.flat(Infinity).filter((c): c is string => typeof c === "string")).join("");
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number>;
const M = curseurMoments(198, 100, [{ from: 0, frames: 72 }, { from: 72, frames: 126 }]);

test("« Un clic sur tes produits »: her place frozen on the pause, her close-up held from the cut, played on from where it stopped", () => {
  const footage = (f: number) => flatten(drawAt(f, {})).find((n) => n.type === "Footage") ?? null;
  // Nothing over the montage before the pause (her place plays under it).
  assert.equal(footage(M.pause - 1), null);
  // Her place held on the image of the click (shot 1, its image at the pause, whatever the frame).
  const a = footage(M.pause + 5)!;
  assert.equal(a.props.shot, 1);
  assert.equal(M.pause + 5 - Number(a.props.at), M.pause);
  // From the cut, her close-up held on its first image until the play, then played on from there.
  const b = footage(M.zoom + 10)!;
  assert.equal(b.props.shot, 2);
  assert.equal(M.zoom + 10 - Number(b.props.at), 0);
  const later = footage(M.play + 12)!;
  assert.equal(M.play + 12 - Number(later.props.at), 12);
});

test("« Un clic sur tes produits »: the cursor and its clicks, her names near her products, gone with the play", () => {
  const boxes = { "cappuccino cup": { x: 80, y: 700, w: 420, h: 360 }, brownie: { x: 560, y: 1150, w: 380, h: 300 } };
  const cursor = (f: number) => {
    const c = flatten(drawAt(f, { boxes })).find((n) => n.props.key === "cursor");
    return c ? { x: styleOf(c).left!, y: styleOf(c).top!, h: Number(c.props.height) } : null;
  };
  assert.equal(cursor(M.enter - 1), null);
  assert.ok(cursor(M.enter)!.x < 0);
  for (const c of [M.pause, M.zoom, M.label1, M.label2, M.play]) assert.ok(Math.abs(cursor(c)!.h - 171 * 0.69) < 1, `click ${c}`);
  // On each product, a little right of its middle and above, as it was found.
  assert.ok(Math.abs(cursor(M.label1 - 2)!.x - (80 + 420 * 0.58)) <= 2 && Math.abs(cursor(M.label1 - 2)!.y - (700 + 360 * 0.4)) <= 2);
  const names = (f: number) => flatten(drawAt(f, { boxes })).filter((n) => n.type === "FitText");
  assert.equal(names(M.label1 - 1).length, 0);
  assert.deepEqual(names(M.label2).map(textOf), ["Cappuccino", "Brownie"]);
  assert.equal(names(M.play).length, 0);
  // Inside the safe zone, never on the other product nor on each other.
  type R = { left: number; top: number; width: number; height: number };
  const [n1, n2] = names(M.label2 + 4).map((n) => styleOf(n) as unknown as R);
  const hit = (a: R, b: Box) => a.left < b.x + b.w && b.x < a.left + a.width && a.top < b.y + b.h && b.y < a.top + a.height;
  assert.ok(!hit(n1!, boxes.brownie) && !hit(n2!, boxes["cappuccino cup"]) && !hit(n1!, { x: n2!.left, y: n2!.top, w: n2!.width, h: n2!.height }));
  for (const b of [n1!, n2!]) assert.ok(b.left >= 40 && b.top >= 80 && b.top + b.height <= 1440 && b.left + b.width <= (b.top + b.height > 960 ? 940 : 1040), JSON.stringify(b));
  // A hand-drawn arrow under each, drawn at once; in dark ink on a bright place.
  const strokes = flatten(drawAt(M.label2 + 4, { boxes })).filter((n) => n.type === "Scribble");
  assert.equal(strokes.filter((n) => String(n.props.key).startsWith("arrow-")).length, 2);
  assert.equal(strokes.filter((n) => String(n.props.key).startsWith("edge-")).length, 2);
  assert.ok(strokes.every((a) => a.props.kind === "arrow" && a.props.frames === 1));
  const bright = flatten(drawAt(M.label2 + 4, { boxes, light: 0.9 })).find((n) => n.type === "FitText")!;
  assert.equal((bright.props.innerStyle as { color: string }).color, "#1d1d1b");
  // Without anything read: no arrow pointing at nothing (v2 pointed at the model's places), each name alone, inside the safe zone.
  assert.equal(flatten(drawAt(M.label2 + 4, {})).filter((n) => n.type === "Scribble").length, 0);
  const bare = flatten(drawAt(M.label2 + 4, {})).filter((n) => n.type === "FitText").map((n) => styleOf(n) as unknown as R);
  assert.equal(bare.length, 2);
  for (const b of bare) assert.ok(b.left >= 40 && b.top >= 80 && b.top + b.height <= 1440 && b.left + b.width <= (b.top + b.height > 960 ? 940 : 1040), JSON.stringify(b));
});

// ——— v2: each name on the product it names (Tristan, 6 November: « il a calé “brownie” sur le café ») ———————————————————

test("« Un clic sur tes produits » (effect v2): the same thing found under two names is named once, never laid on another product", () => {
  // The detector found « brownie » on the cappuccino itself: only the cappuccino named, one arrow; its click still heard.
  const boxes = { "cappuccino cup": { x: 120, y: 640, w: 560, h: 480 }, brownie: { x: 180, y: 700, w: 420, h: 360 } };
  const tree = flatten(drawAt(M.label2 + 4, { boxes }));
  assert.deepEqual(tree.filter((n) => n.type === "FitText").map(textOf), ["Cappuccino"]);
  assert.equal(tree.filter((n) => String(n.props.key).startsWith("arrow-")).length, 1);
});

test("« Un clic sur tes produits » (effect v2): as many names as her close-up shows, a click each, an arrow only when it points at its own", () => {
  const m = curseurMoments(198, 100, [{ from: 0, frames: 72 }, { from: 72, frames: 126 }], true);
  // Three clicks closer together, the last read 1,7 s before the play, on a whole beat.
  assert.ok(m.label2 > m.label1 && m.label3 > m.label2 && m.label3 - m.label2 >= 16 && m.play - m.label3 >= 30 && onWholeBeat(m.play, 100), JSON.stringify(m));
  const fill = { texts: { produit1: "Cappuccino", produit2: "Brownie", produit3: "Croissant" }, objects: { produit1: "cappuccino cup", produit2: "brownie", produit3: "croissant" }, settings: {} };
  const plan = pieceTestPlan({ piece: curseur, shots, span: [1.2, 7.8], fill, bpm: 100 });
  const motion = plan.layers![0]!.motion;
  assert.deepEqual(motion.sounds!.map((s) => Math.round(s.at * 30)), [m.pause, m.zoom, m.label1, m.label2, m.label3, m.play]);
  assert.deepEqual(motion.drawn!.objects!.map((o) => o.name), ["cappuccino cup", "brownie", "croissant"]);
  const boxes = { "cappuccino cup": { x: 90, y: 560, w: 400, h: 330 }, brownie: { x: 600, y: 700, w: 360, h: 260 }, croissant: { x: 260, y: 1100, w: 520, h: 280 } };
  const marks = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)]));
  const tree = flatten(drawAt(m.label3 + 4, { boxes, texts: { ...marks, produit3: "Croissant" } }));
  const named = tree.filter((n) => n.type === "FitText");
  assert.deepEqual(named.map(textOf), ["Cappuccino", "Brownie", "Croissant"]);
  type R = { left: number; top: number; width: number; height: number };
  const own = [boxes["cappuccino cup"], boxes.brownie, boxes.croissant];
  const hit = (a: R, b: Box) => a.left < b.x + b.w && b.x < a.left + a.width && a.top < b.y + b.h && b.y < a.top + a.height;
  named.forEach((n, i) => own.forEach((b, j) => assert.ok(i === j || !hit(styleOf(n) as unknown as R, b), `${i} on ${j}`)));
  for (const a of tree.filter((n) => String(n.props.key).startsWith("arrow-"))) {
    const i = Number(String(a.props.key).slice(6));
    const tail = a.props.from as { x: number; y: number };
    assert.ok(tail.x >= own[i]!.x && tail.x <= own[i]!.x + own[i]!.w && tail.y >= own[i]!.y && tail.y <= own[i]!.y + own[i]!.h, JSON.stringify([i, tail]));
  }
});

test("« Un clic sur tes produits » (effect v2): its filler's names kept only for what the shot under it shows", () => {
  const under = [{ shows: "Un serveur sort du café avec un plateau." }, { shows: "Gros plan d'un cappuccino avec un cœur dans la mousse." }];
  const answer = {
    fits: true,
    missing: "",
    texts: [{ slot: "produit1", text: "Cappuccino" }, { slot: "produit2", text: "Brownie" }, { slot: "produit3", text: "" }],
    objects: [{ slot: "produit1", name: "cappuccino cup", seen: "un cappuccino" }, { slot: "produit2", name: "brownie", seen: "un brownie" }, { slot: "produit3", name: "none" }],
    settings: [],
  };
  // The brownie her request names is not in the shot: not written, not followed.
  const read = readPieceFill(curseur, answer, { under })!;
  assert.deepEqual([read.texts, read.objects], [{ produit1: "Cappuccino" }, { produit1: "cappuccino cup" }]);
  // Seen there: kept.
  const both = readPieceFill(curseur, answer, { under: [under[0]!, { shows: "Un cappuccino et un brownie sur une table." }] })!;
  assert.deepEqual(both.texts, { produit1: "Cappuccino", produit2: "Brownie" });
  // Its first product not seen there: the effect does not play.
  assert.equal(readPieceFill(curseur, { ...answer, objects: [{ slot: "produit1", name: "brownie", seen: "un brownie" }] }, { under }), null);
  // Its filler is told which object each name names, and the rule.
  const input = pieceFillInput({ piece: curseur, under: [{ id: "a", photo: false, shows: under[0]!.shows }, { id: "b", photo: true, shows: under[1]!.shows }], brief: "", request: "Le cappuccino et le brownie du moment.", business: {} });
  assert.deepEqual((input.effet.ses_objets as { slot: string; son_texte?: string }[]).map((o) => o.son_texte), ["produit1", "produit2", "produit3"]);
  assert.match(PIECE_FILL_PROMPT, /a word written on or beside a thing \(a product's name\) names what that shot shows/);
});
