import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { layerShots, pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { subjectShots } from "../subject.ts";
import { routine, routineFlashStarts } from "./routine.ts";

// « Rituel du matin », the effect of the bank (routine.ts, « Bande-annonce tapée »): its own checks, beside the bank's (features.test.ts).

/** Five of her shots cut under it at the opening (2 s in all), between nothing and an after shot. */
const shots = [
  { file: "bol", at: 1, seconds: 0.4 },
  { file: "verse", at: 2, seconds: 0.4 },
  { file: "enseigne", at: 0.5, seconds: 0.4 },
  { file: "salle", at: 3, seconds: 0.4 },
  { file: "geste", at: 1, seconds: 0.47 },
  { file: "after", at: 2, seconds: 3 },
];

test("« Rituel du matin » (effect v1): its layer over her opening shots, its small line's moment, nothing cut out, no sound", () => {
  const plan = pieceTestPlan({ piece: routine, shots, span: [0, 2.07], fill: { texts: { titre: "un matin au fournil", ligne: "fournil + café crème" }, objects: {}, settings: {} }, bpm: 90.73 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const layer = plan.layers![0]!;
  assert.deepEqual(layerShots(plan, layer), [0, 1, 2, 3, 4]);
  const motion = layer.motion;
  assert.deepEqual(motion.piece, { key: "routine", version: 1 });
  // Its line on the original's image 28 of 62; the shots under it as the engine counts them.
  assert.equal(motion.texts!.line_at, "28");
  assert.equal(motion.texts!.mine, "0,1,2,3,4");
  assert.equal(motion.texts!.titre, "un matin au fournil");
  // Nothing of hers cut out, nothing followed, no sound (the original has none), no music shaped.
  assert.equal(motion.drawn, undefined);
  assert.equal(motion.sounds, undefined);
  assert.deepEqual([...subjectShots(plan)], []);
  assert.deepEqual(checkMotionCode(routine.code), []);
  assert.doesNotMatch(routine.code, /transform|scale\(|filter:/);
  // Its flashes as the original cuts its trailer (4,77 images on average), again over a longer span.
  assert.deepEqual(routineFlashStarts(62), [0, 5, 9, 14, 19, 24, 28, 33, 38, 42, 47, 52, 57]);
  assert.deepEqual(routineFlashStarts(70).slice(12), [57, 62, 67]);
});

test("« Rituel du matin »: its words, the title required, its line optional, cut to their place", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "titre", text: "une journée au fournil Farine" }, { slot: "ligne", text: "" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(routine, answer)!.texts, { titre: "une journée au fournil" });
  assert.equal(readPieceFill(routine, { ...answer, texts: [{ slot: "ligne", text: "fournil + café" }] }), null);
});

test("« Rituel du matin » is offered from three of her files, photos or videos, whatever they show", () => {
  const clip = (camera: string) =>
    ({
      duration: 9,
      orientation: "portrait",
      summary: "une boulangère prépare un café au comptoir",
      setting: "intérieur, une boulangerie",
      lighting: "good",
      shots: [{ start: 0, end: 9, description: "elle verse le lait", subject: "femme", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing: "close", camera, subject_box: [300, 100, 700, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  const read = pieceShots([{ media_id: "a", analysis: clip("handheld") }], {});
  assert.deepEqual(piecesOffered([routine], read, 3).map((p) => p.key), ["routine"]);
  assert.deepEqual(piecesOffered([routine], read, 2), []);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, props: { texts?: Record<string, string>; brand?: Record<string, unknown>; durationInFrames?: number; count?: number } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }) };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", TypeOn: "TypeOn", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${routine.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const durationInFrames = props.durationInFrames ?? 62;
  const count = props.count ?? 5;
  // Her shots under it, 12 images each, the first from its start; one more after it that the engine does not count.
  const list = [...Array.from({ length: count }, (_, i) => ({ from: i * 12, durationInFrames: 12, kind: "video", aspect: 0.5625 })), { from: count * 12, durationInFrames: 90, kind: "video", aspect: 0.5625 }];
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames,
    brand: { name: "Farine", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#7a2e3b", palette: {}, ...props.brand },
    shots: list,
    texts: { beat: "19.84", line_at: "28", mine: Array.from({ length: count }, (_, i) => i).join(","), titre: "un matin au fournil", ligne: "fournil + café crème", ...props.texts },
  });
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};

test("« Rituel du matin » draws its flashes: the next of her shots every four or five images, each at another moment, its first at its own", () => {
  const footage = (f: number, extra = {}) => nodes(drawAt(f, extra)).find((x) => x.type === "Footage")!;
  // Its first flash: her first shot at its own first moment.
  assert.deepEqual([footage(0).props.shot, footage(0).props.at], [0, 0]);
  // Then the next ones in turn, from their middle (12 images: from its image 3), cut on the original's images 5, 9, 14…
  assert.deepEqual([4, 5, 9, 14, 19, 24].map((f) => footage(f).props.shot), [0, 1, 2, 3, 4, 0]);
  assert.equal(footage(5).props.at, 5 - 3);
  // A shot seen again: another of its moments (its first pass from image 3, its second from image 0).
  assert.equal(footage(24).props.at, 24 - 0);
  assert.deepEqual([footage(5).props.shot, footage(28).props.shot], [1, 1]);
  assert.notEqual(5 - Number(footage(5).props.at), 28 - Number(footage(28).props.at));
  // Full frame, over the montage: nothing of the shot after it.
  assert.deepEqual(footage(40).props.style, { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 });
  assert.ok(nodes(drawAt(61)).every((x) => x.type !== "Footage" || Number(x.props.shot) < 5));
});

test("« Rituel du matin » types her title with its cursor, then her small line at once, in the safe zone, in her light colour", () => {
  const typed = (f: number, extra = {}) => nodes(drawAt(f, extra)).find((x) => x.type === "TypeOn");
  assert.equal(typed(0)!.props.text, "un matin\nau fournil");
  assert.equal(typed(0)!.props.caret, "bar");
  assert.equal(typed(28)!.props.caret, "none");
  assert.ok(Number(typed(0)!.props.speed) >= 15.6);
  const title = nodes(drawAt(10)).find((x) => x.type === "FitText")!;
  const box = title.props.style as { left: number; top: number; width: number; height: number };
  assert.ok(box.left === 140 && box.left + box.width === 940 && box.top >= 80 && box.top + box.height <= 1440, JSON.stringify(box));
  assert.equal((title.props.innerStyle as Record<string, string>).color, "#f6e2c1");
  assert.equal((nodes(drawAt(10, { brand: { palette: { light: "#fbf7f2" } } })).find((x) => x.type === "FitText")!.props.innerStyle as Record<string, string>).color, "#fbf7f2");
  // Its line from its moment, small beside the title (an accent), under it.
  const line = (f: number) => nodes(drawAt(f)).find((x) => String(x.props.key).startsWith("line-"));
  assert.equal(line(27), undefined);
  assert.ok(nodes(line(28)!).some((x) => "data-fauve-accent" in x.props));
  // Without her line: the title alone; a short span: her line still in it, her title typed before.
  assert.equal(nodes(drawAt(40, { texts: { ligne: "" } })).filter((x) => String(x.props.key).startsWith("line-")).length, 0);
  const short = nodes(drawAt(44, { durationInFrames: 45, texts: { line_at: "20" } }));
  assert.ok(short.some((x) => String(x.props.key).startsWith("line-")));
  assert.ok(Number(nodes(drawAt(0, { durationInFrames: 45, texts: { line_at: "20" } })).find((x) => x.type === "TypeOn")!.props.speed) > 15.6);
});
