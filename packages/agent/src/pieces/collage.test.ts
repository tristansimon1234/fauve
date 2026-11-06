import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { ANY_SHOT, readsDrawn, subjectShots } from "../subject.ts";
import { collage, collageStep } from "./collage.ts";

// « Collage qui s'emboîte », the effect of the bank (pieces/collage.ts): its own checks, beside the bank's (features.test.ts).

/** Her shots as the chain cuts them under it: five of a beat each at 100 BPM, between a lead shot and an after shot. */
const run = [
  { file: "lead", at: 1, seconds: 1.2 },
  ...["a", "b", "c", "d", "e"].map((file) => ({ file, at: 0.5, seconds: 0.6 })),
  { file: "after", at: 2, seconds: 1.8 },
];

test("« Images qui s'emboîtent » (effect v1): its layer over a run of shots, all but its first cut out, its step a beat's sixteenth or eighth", () => {
  const plan = pieceTestPlan({ piece: collage, shots: run, span: [1.2, 4.2], fill: { texts: {}, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [1, 2, 3, 4, 5]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "collage", version: 1 });
  // Every shot under it but its first may arrive cut out (and lend its silhouette): declared, so only those are cut out.
  assert.deepEqual(motion.drawn, { shots: 7, subjects: [2, 3, 4, 5] });
  assert.deepEqual([...subjectShots(plan)].sort((a, b) => a - b), [2, 3, 4, 5]);
  // At 100 BPM a sixteenth is 4,5 images: an eighth (9); at 75 BPM the original's 6 images.
  assert.equal(motion.texts!.step, "9");
  assert.equal(collageStep(24), 6);
  assert.equal(collageStep(18), 9);
  // Its title is optional: none written.
  assert.equal(motion.texts!.titre, undefined);
  // Its words cut to their place.
  assert.deepEqual(readPieceFill(collage, { fits: true, missing: "", texts: [{ slot: "titre", text: "La friperie de Belleville et ses vinyles" }], objects: [], settings: [] })!.texts, { titre: "La friperie de" });
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Shot = { from: number; durationInFrames: number; kind: string; aspect: number; index: number };
type Reads = { cut?: (i: number) => boolean; outline?: (i: number) => string | null; sky?: (i: number) => number | null };

const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;

/** Its Scene at a frame over five shots of 18 images (a beat at 100 BPM each) after a lead one, its readings as given. */
function drawAt(frame: number, props: { texts?: Record<string, string>; reads?: Reads; brand?: Record<string, unknown> } = {}): Drawn {
  const reads = props.reads ?? {};
  // The Reel's shots up to its end, from its start: the lead one before it, then its five.
  const shots: Shot[] = [{ from: -36, durationInFrames: 36, kind: "video", aspect: 0.5625, index: 0 }, ...Array.from({ length: 5 }, (_, k) => ({ from: k * 18, durationInFrames: 18, kind: "video", aspect: 0.5625, index: k + 1 }))];
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) }) };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    Skyline: "Skyline",
    useCurrentFrame: () => frame,
    SubjectBox: (shot: Shot | undefined) => (shot && (reads.cut ? reads.cut(shot.index) : true) ? { x: 300, y: 600, w: 480, h: 1300 } : null),
    SubjectOutline: (shot: Shot | undefined) => (!shot ? null : reads.outline ? reads.outline(shot.index) : "M 300 600 L 780 600 L 780 1900 L 300 1900 Z"),
    SkylineAt: (shot: Shot | undefined) => (shot && reads.sky ? reads.sky(shot.index) : null),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${collage.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: 90,
    brand: { name: "Lou Vintage", displayFont: "Big Shoulders Display", bodyFont: "Inter", accent: "#b3261e", palette: { dark: "#1d1d1b" }, ...props.brand },
    shots,
    texts: { beat: "18", step: "9", mine: "1,2,3,4,5", ...props.texts },
  });
}
/** What it lays at a frame, in order: « Subject 2 », « Skyline 3 », « window 4 » (the next shot through a silhouette), the title. */
const laid = (tree: Drawn) =>
  (tree.children as Drawn[]).flatMap((n) => {
    if (n.type === "Subject" || n.type === "Skyline") return [`${String(n.type)} ${String(n.props.shot)}`];
    if (n.type === "div" && styleOf(n).clipPath) return [`window ${String((n.children[0] as Drawn).props.shot)}`];
    if (n.type === "FitText") return ["title"];
    return [];
  });

test("« Images qui s'emboîtent » (effect v1): on each cut's last step, the next shot in a piece: her person, its ground, through a silhouette; else her person, else a plain cut", () => {
  const sky = { sky: () => 640 };
  // Its first shot whole, then the next one's person on its last eighth (9 images before the cut at 18).
  assert.deepEqual(laid(drawAt(4)), []);
  assert.deepEqual(laid(drawAt(9)), ["Subject 2"]);
  assert.deepEqual(laid(drawAt(17)), ["Subject 2"]);
  // The next one's ground without its sky over the second (a sky read there), else its person.
  assert.deepEqual(laid(drawAt(30, { reads: sky })), ["Skyline 3"]);
  assert.deepEqual(laid(drawAt(30)), ["Subject 3"]);
  // The fourth through the silhouette of the third, at its own place: its whole picture under her outline.
  const w = drawAt(48);
  assert.deepEqual(laid(w), ["window 4"]);
  const clip = (w.children as Drawn[]).find((n) => n.type === "div")!;
  assert.deepEqual([styleOf(clip).left, styleOf(clip).top, styleOf(clip).width, styleOf(clip).height, styleOf(clip).clipPath], [0, 0, 1080, 1920, "path('M 300 600 L 780 600 L 780 1900 L 300 1900 Z')"]);
  assert.deepEqual(styleOf((clip.children as Drawn[])[0]!), { left: 0, top: 0, width: 1080, height: 1920 });
  assert.deepEqual(laid(drawAt(48, { reads: { outline: () => null } })), ["Subject 4"]);
  // Then a person again (the original's order); no cut-out of her: a plain cut.
  assert.deepEqual(laid(drawAt(66)), ["Subject 5"]);
  assert.deepEqual(laid(drawAt(66, { reads: { cut: (i) => i !== 5 } })), []);
  // After its last cut, nothing more: the montage plays on under it; never during a shot's first images. Its root keeps
  // a style even then (the scene check refuses an output under 20 characters: « empty output »).
  assert.deepEqual([72, 80, 89].map((f) => laid(drawAt(f))), [[], [], []]);
  assert.deepEqual(drawAt(89).props.style, { pointerEvents: "none" });
  assert.deepEqual([0, 18, 36, 54].map((f) => laid(drawAt(f))), [[], [], [], []]);
  // A slower Reel: its step a sixteenth, the original's 6 images (beat 24).
  assert.deepEqual([11, 12].map((f) => laid(drawAt(f, { texts: { beat: "24", step: "6" } }))), [[], ["Subject 2"]]);
});

test("« Images qui s'emboîtent » (effect v1): its title on a band of her colour, high, through its first two seconds, what arrives in front", () => {
  const tree = drawAt(10, { texts: { titre: "Lou Vintage" } });
  const nodes = flatten(tree);
  const band = nodes.find((n) => n.props.key === "awning")!;
  assert.deepEqual([styleOf(band).left, styleOf(band).width, styleOf(band).backgroundColor], [0, 1080, "#b3261e"]);
  const title = nodes.find((n) => String(n.props.key).startsWith("title-"))!;
  const b = styleOf(title);
  // In the safe zone, above the middle, centred, big white capitals.
  assert.ok(Number(b.left) >= 40 && Number(b.left) + Number(b.width) <= 1040 && Number(b.top) >= 80 && Number(b.top) + Number(b.height) <= 960, JSON.stringify(b));
  assert.equal(Number(b.left) + Number(b.width) / 2, 540);
  assert.ok(Number((title.props.innerStyle as { fontSize: number }).fontSize) >= 48);
  // What arrives passes in front of it.
  assert.deepEqual(laid(tree), ["title", "Subject 2"]);
  // Two seconds at least (half of a long effect), then gone.
  assert.ok(laid(drawAt(59, { texts: { titre: "Lou Vintage" } })).includes("title"));
  assert.ok(!laid(drawAt(66, { texts: { titre: "Lou Vintage" } })).includes("title"));
  // Her colour too pale for white letters: her dark one.
  assert.equal(styleOf(flatten(drawAt(10, { texts: { titre: "Lou" }, brand: { accent: "#f3e7d9" } })).find((n) => n.props.key === "awning")!).backgroundColor, "#1d1d1b");
});

test("« Images qui s'emboîtent » (effect v1): checked code; its sky read on the shots under it; offered on her files with a person", () => {
  assert.deepEqual(checkMotionCode(collage.code), []);
  assert.doesNotMatch(collage.code, /\btransform\b|\bscale\(|interpolate\(/);
  // Its ground on any of its shots: their sky read under it (four grounds a Reel at most, by the engine).
  assert.deepEqual(readsDrawn(collage.code), [{ shot: ANY_SHOT, kinds: ["ground", "sky"] }]);
  const clip = (person: boolean) =>
    ({
      duration: 6,
      orientation: "portrait",
      summary: "une friperie",
      setting: "intérieur d'une boutique",
      lighting: "good",
      shots: [{ start: 0, end: 6, description: person ? "une cliente pose devant le portant" : "un portant de pulls", subject: person ? "femme" : "pulls", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: person, framing: "medium", camera: "static", subject_box: [300, 100, 700, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  assert.deepEqual(piecesOffered([collage], pieceShots([{ media_id: "a", analysis: clip(true) }], {}), 3).map((p) => p.key), ["collage"]);
  assert.deepEqual(piecesOffered([collage], pieceShots([{ media_id: "a", analysis: clip(false) }], {}), 3), []);
  assert.deepEqual(piecesOffered([collage], pieceShots([{ media_id: "a", analysis: clip(true) }], {}), 2), []);
});
