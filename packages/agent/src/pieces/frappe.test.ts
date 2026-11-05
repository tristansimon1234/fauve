import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, isClipSegment, segmentSpans, type EditPlan } from "../schemas.ts";
import { pieceCode, pieceFillInput, pieceTestPlan, type PieceFill } from "../pieces.ts";
import { clearPassages, objectPassages, subjectPassages } from "../subject.ts";
import { frappe, typedFrames, typedLetters, typingWeight } from "./frappe.ts";

// « Le lieu tapé », the effect of the bank (frappe.ts): its own checks, beside the bank's (features.test.ts).

/** A plain montage cut as the chain cuts it: a lead shot, her sign close (1,2 s), her wide shot with sky (3,6 s), the next shot; at 100 BPM. */
const run = [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "sign", at: 2, seconds: 1.2 },
  { file: "sky", at: 1, seconds: 3.6 },
  { file: "after", at: 2, seconds: 1.5 },
];
const fill = (texts: Record<string, string>, objects: Record<string, string> = {}, settings: Record<string, string> = {}): PieceFill => ({ texts, objects, settings });

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  return [node as Drawn, ...(node as Drawn).children.flatMap(nodes)];
};
const styleOf = (n: Drawn | undefined) => (n?.props.style ?? {}) as Record<string, unknown>;
type Box = { x: number; y: number; w: number; h: number };

/** Its layer's shots as the render gives them to its code (composeShots): her shots up to its end, in frames from its start. */
function layerProps(plan: EditPlan) {
  const layer = plan.layers![0]!;
  const { spans } = segmentSpans(plan.segments);
  const from = Math.round(layer.from * 30);
  const length = Math.round(layer.to * 30) - from;
  const shots = plan.segments.flatMap((s, i) => (isClipSegment(s) ? [{ from: Math.round(spans[i]!.start * 30) - from, durationInFrames: Math.round(spans[i]!.length * 30), kind: "video", aspect: 9 / 16 }] : [])).filter((s) => s.from < length);
  return { layer, length, shots };
}

type ClearAsk = { aspect?: number; min?: { w?: number; h?: number }; max?: { w?: number; h?: number }; fallback?: Box | null };
/**
 * Its code run at one frame with a stand-in scope (each kit piece a named element), what the engine read on her shots
 * given: `sky`, the one clear area of her shot (ClearBox gives the largest box asked for in it, at its top, or its fallback).
 */
function drawAt(code: string, frame: number, props: Record<string, unknown>, read: { parts?: Box[]; box?: Box | null; sky?: Box } = {}): Drawn {
  const h = (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat() });
  const clear = (ask: ClearAsk = {}) => {
    const sky = read.sky;
    if (!sky) return ask.fallback ?? null;
    let w = Math.min(sky.w, ask.max?.w ?? sky.w);
    let hh = Math.min(sky.h, ask.max?.h ?? sky.h);
    if (ask.aspect && w / hh > ask.aspect) w = hh * ask.aspect;
    else if (ask.aspect) hh = w / ask.aspect;
    if (w < (ask.min?.w ?? 0) - 0.5 || hh < (ask.min?.h ?? 0) - 0.5) return ask.fallback ?? null;
    return { x: sky.x + (sky.w - w) / 2, y: sky.y, w, h: hh };
  };
  const scope: Record<string, unknown> = {
    React: { createElement: h, Fragment: "Fragment" },
    useCurrentFrame: () => frame,
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Img: "Img",
    Subject: "Subject",
    SubjectParts: () => read.parts ?? [],
    SubjectBox: () => read.box ?? null,
    // Without a clear area read: its fallback, as in the scene check.
    ClearBox: (_shot: unknown, _frame: number, _laid: unknown, options?: ClearAsk) => clear(options),
  };
  const Scene = new Function(...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`)(...Object.values(scope)) as (p: unknown) => Drawn;
  return Scene({ width: 1080, height: 1920, brand: { name: "Hôtel Luna", accent: "#1f4e79", accentInk: "#ffffff", displayFont: "Archivo Black", bodyFont: "Inter Tight", logoUrl: null }, ...props });
}
/** What of her name is typed at a frame (its words seen; those to come are laid out unseen). */
const typedAt = (tree: Drawn) => {
  const name = nodes(tree).find((n) => n.type === "FitText" && n.props.key === "name");
  const span = name?.children[0] as Drawn | undefined;
  return typeof span?.children[0] === "string" ? span.children[0] : "";
};

test("« Le lieu tapé » (effect v1): its layer over her sign and her wide shot, its sign's pieces followed only on the sign", () => {
  const plan = pieceTestPlan({ piece: frappe, shots: run, span: [1.2, 6], fill: fill({ lieu: "Hôtel Luna" }, { lumieres: "Neon sign" }), bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  assert.deepEqual(motion.piece, { key: "frappe", version: 1 });
  // Its sign's letters on the first shot under it (the second of her shots), named for the detector; never her cut out.
  assert.deepEqual(motion.drawn, { shots: 4, objects: [{ shot: 1, name: "neon sign" }] });
  assert.ok(motion.code!.includes('"neon sign"') && !motion.code!.includes('"@lumieres"'));
  const passages = objectPassages(plan, () => true);
  assert.deepEqual(passages.map((p) => [p.clip_id, p.name]), [["sign", "neon sign"]]);
  assert.deepEqual(subjectPassages(plan, () => true), []);
  // Its clear areas read on the shots under it (her name's place is chosen in the last one).
  assert.deepEqual(clearPassages(plan, () => true).map((p) => p.clip_id), ["sign", "sky"]);
  // Its marks: the typing 0,77 beat into the sky shot (36 + 14), the all-at-once just before the cut on her wide shot
  // (the sign's two beats leave no beat with the chase before it).
  assert.equal(Number(motion.texts!.type), 50);
  assert.equal(Number(motion.texts!.flash), 30);
  assert.equal(motion.texts!.lieu, "Hôtel Luna");
  // Over her wide shot alone: its filler is asked for no object (there is no sign shot), so nothing is followed.
  const under = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, photo: false, shows: "un plan" }));
  const input = (n: number) => pieceFillInput({ piece: frappe, under: under(n), brief: "[borrow: frappe] « Hôtel Luna » in its sky", request: "Un Reel pour l'hôtel", business: { name: "Hôtel Luna" } });
  assert.deepEqual(input(2).effet.ses_objets, [{ slot: "lumieres", plan: 1, cherche: frappe.objects![0]!.want }]);
  assert.deepEqual(input(1).effet.ses_objets, []);
  const alone = pieceTestPlan({ piece: frappe, shots: [run[0]!, run[2]!, run[3]!], span: [1.2, 4.8], fill: fill({ lieu: "Hôtel Luna" }), bpm: 100 });
  assert.equal(alone.layers![0]!.motion.drawn, undefined);
  assert.equal(Number(alone.layers![0]!.motion.texts!.flash), -100);
  assert.equal(Number(alone.layers![0]!.motion.texts!.type), 14);
  assert.deepEqual(objectPassages(alone, () => true), []);
});

test("« Le lieu tapé »: each letter of her name typed on the frame of its key click, a hand's pauses, her name whole to the end", () => {
  const plan = pieceTestPlan({ piece: frappe, shots: run, span: [1.2, 6], fill: fill({ lieu: "Hôtel Luna" }), bpm: 100 });
  const { layer, length, shots } = layerProps(plan);
  const chars = typedLetters("Hôtel Luna");
  assert.deepEqual(chars, ["H", "Ô", "T", "E", "L", " ", "L", "U", "N", "A"]);
  // Its first character at once, a pause before the middle one and before the last (1,8 and 1,65 steps).
  assert.deepEqual(chars.map((_, i) => typingWeight(i, chars.length)), [0, 1, 1, 1, 1, 1.8, 1, 1, 1, 1.65]);
  const shown = new Map<number, number>();
  let before = 0;
  for (let f = 0; f < length; f++) {
    const typed = typedAt(drawAt(layer.motion.code!, f, { durationInFrames: length, shots, texts: layer.motion.texts }));
    // Never a letter taken back: it only grows, in order.
    assert.ok(typed.length >= before && "HÔTEL LUNA".startsWith(typed), `frame ${f}: « ${typed} »`);
    for (let i = before; i < typed.length; i++) shown.set(i, f);
    before = typed.length;
  }
  // Nothing typed before its sky shot, all of it typed by 0,8 s before the end.
  assert.equal(before, chars.length);
  assert.ok(shown.get(0)! >= 36 && shown.get(chars.length - 1)! <= length - 24, JSON.stringify([...shown]));
  // A click on each letter (none on the space) on the very frame it shows, within its span, a hand's pace at 100 BPM.
  const clicks = layer.motion.sounds!.map((s) => Math.round(s.at * 30));
  const letters = chars.flatMap((c, i) => (c === " " ? [] : [shown.get(i)!]));
  assert.deepEqual(clicks, letters);
  assert.ok(layer.motion.sounds!.every((s) => s.skill && s.sound === "keyboard key click" && s.at < length / 30));
  assert.deepEqual(typedFrames(chars.length, Number(layer.motion.texts!.type), Number(layer.motion.texts!.type_step)).filter((_, i) => chars[i] !== " "), clicks);
  const gaps = clicks.slice(1).map((f, i) => f - clicks[i]!);
  assert.ok(gaps.every((g) => g >= 3 && g <= 13), JSON.stringify(gaps));
  // A long name: a click on each of its 16 letters; past 16, spread over them, its first and its last among them.
  const long = pieceTestPlan({ piece: frappe, shots: run, span: [1.2, 6], fill: fill({ lieu: "Boulangerie Marie" }), bpm: 100 }).layers![0]!.motion;
  const frames = typedFrames(17, Number(long.texts!.type), Number(long.texts!.type_step));
  assert.deepEqual(long.sounds!.map((s) => Math.round(s.at * 30)), frames.filter((_, i) => i !== 11));
  const longer = frappe.timeline!({ frames: 144, bpm: 100, shots: [{ from: 0, frames: 36 }, { from: 36, frames: 108 }], words: { lieu: "ABCDEFGHIJKLMNOPQR" }, settings: {} });
  const all18 = typedFrames(18, longer.marks!.type!, longer.marks!.type_step!);
  assert.equal(longer.sounds!.length, 16);
  assert.deepEqual([longer.sounds![0]!.at * 30, longer.sounds!.at(-1)!.at * 30].map(Math.round), [all18[0], all18[17]]);
  assert.ok(longer.sounds!.every((s, i) => i === 0 || s.at > longer.sounds![i - 1]!.at));
});

test("« Le lieu tapé »: her sign's pieces one by one on its shot, the rest dimmed, then all at once; a flash of light when nothing was found", () => {
  const plan = pieceTestPlan({ piece: frappe, shots: run, span: [1.2, 6], fill: fill({ lieu: "Hôtel Luna" }, { lumieres: "neon sign" }), bpm: 100 });
  const { layer, length, shots } = layerProps(plan);
  const parts = Array.from({ length: 5 }, (_, i) => ({ x: 400, y: 500 + i * 160, w: 140, h: 150 }));
  const draw = (f: number, read: { parts?: Box[]; box?: Box | null }) => drawAt(layer.motion.code!, f, { durationInFrames: length, shots, texts: layer.motion.texts }, read);
  const seen = Array.from({ length }, (_, f) => {
    const tree = draw(f, { parts, box: { x: 400, y: 500, w: 140, h: 800 } });
    const dim = nodes(tree).find((n) => n.props.key === "dim");
    // The piece lit: a soft oval round one of its pieces (by its middle), her sign drawn in it where the montage draws it.
    const piece = nodes(tree).find((n) => n.props.key === "piece");
    const box = styleOf(piece) as { left: number; top: number; width: number; height: number };
    const lit = piece ? parts.findIndex((q) => Math.abs(q.x + q.w / 2 - (box.left + box.width / 2)) <= 1 && Math.abs(q.y + q.h / 2 - (box.top + box.height / 2)) <= 1) : -1;
    if (piece) {
      const sign = nodes(piece).find((n) => n.type === "Subject")!;
      assert.deepEqual([box.left + Number(styleOf(sign).left), box.top + Number(styleOf(sign).top), styleOf(sign).width, styleOf(sign).height], [0, 0, 1080, 1920]);
      assert.equal(sign.props.object, "neon sign");
      assert.ok(box.width > parts[lit]!.w && box.height > parts[lit]!.h && /radial-gradient/.test(String(styleOf(piece).maskImage)));
    }
    const all = nodes(tree).find((n) => n.props.key === "all");
    return { parts: piece ? [lit] : [], all: Boolean(all && nodes(all).some((n) => n.type === "Subject")), dim: Number(styleOf(dim).opacity ?? 0) };
  });
  // Lit on her sign's shot only (frames 0 to 35), named as its filler named it.
  assert.ok(seen.slice(36).every((s) => !s.parts.length && !s.all && !s.dim));
  const chase = seen.flatMap((s, f) => (s.parts.length ? [[f, s.parts[0]!]] : []));
  // Each piece in reading order, one at a time, 2 or 3 images each as the original's, then 6 images of dark.
  const runs: { k: number; n: number }[] = [];
  for (const [, k] of chase) {
    if (runs.at(-1)?.k === k) runs.at(-1)!.n++;
    else runs.push({ k: k!, n: 1 });
  }
  assert.deepEqual(runs.map((r) => r.k), [0, 1, 2, 3, 4]);
  assert.ok(runs.every((r) => r.n === 2 || r.n === 3), JSON.stringify(runs));
  const lastPiece = chase.at(-1)![0]!;
  const all = seen.flatMap((s, f) => (s.all ? [f] : []));
  assert.deepEqual(all, [30, 31, 32, 33, 34, 35]);
  assert.ok(seen.slice(lastPiece + 1, 30).every((s) => !s.parts.length && s.dim > 0.5), "dark before all of it lights up");
  // The rest of the shot dimmed from three frames before the first piece to the end of the all-at-once (58 %).
  const dimmed = seen.flatMap((s, f) => (s.dim > 0 ? [f] : []));
  assert.equal(dimmed[0], chase[0]![0]! - 3);
  assert.equal(dimmed.at(-1), 35);
  assert.ok(Math.abs(Math.max(...seen.map((s) => s.dim)) - 0.58) < 1e-9);
  // Each piece at its own light: never pushed into white (a lit neon burnt into blots).
  assert.doesNotMatch(frappe.code, /brightness\(1\.[4-9]/);
  // Nothing found on her sign's shot: no chase, a short flash of light on the beat instead, three frames.
  const bloom = (f: number) => Number(styleOf(nodes(draw(f, {})).find((n) => n.props.key === "bloom")).opacity ?? 0);
  assert.deepEqual([29, 30, 31, 32, 33].map(bloom), [0, 0.32, 0.2, 0.1, 0]);
  assert.ok(Array.from({ length }, (_, f) => draw(f, {})).every((t) => !nodes(t).some((n) => n.type === "Subject" || n.props.key === "dim")));
});

test("« Le lieu tapé »: her name in her sky, a little above its middle, and in a thin band of sky still at a size that reads", () => {
  const nameIn = (sky: Box | undefined, lieu: string) => {
    const plan = pieceTestPlan({ piece: frappe, shots: [run[0]!, run[2]!, run[3]!], span: [1.2, 4.8], fill: fill({ lieu }), bpm: 100 });
    const { layer, length, shots } = layerProps(plan);
    const tree = drawAt(layer.motion.code!, length - 1, { durationInFrames: length, shots, texts: layer.motion.texts }, sky ? { sky } : {});
    const name = nodes(tree).find((n) => n.props.key === "name")!;
    return { box: styleOf(name) as { left: number; top: number; width: number; height: number }, size: Number((name.props.innerStyle as { fontSize: number }).fontSize) };
  };
  // A tall sky over her street: her name in it, its line at its full size (a long name set smaller to fill its width),
  // not at the top of that sky but a little above its middle.
  const tall = { x: 100, y: 100, w: 880, h: 700 };
  const high = nameIn(tall, "Hôtel Luna");
  assert.ok(high.box.left >= tall.x && high.box.left + high.box.width <= tall.x + tall.w, JSON.stringify(high));
  assert.ok(high.box.top > tall.y + 150 && high.box.top + high.box.height < tall.y + tall.h, JSON.stringify(high));
  assert.ok(high.size >= 100 && high.size <= 150, JSON.stringify(high));
  // A thin band of dusk sky over a front (80 px between its roof and the top of the frame): her name in the band, a
  // line about 60 px tall, never on the front at the original's place.
  const band = { x: 100, y: 230, w: 760, h: 80 };
  const thin = nameIn(band, "Bar la Lune");
  assert.ok(thin.box.top >= band.y && thin.box.top + thin.box.height <= band.y + band.h + 0.5, JSON.stringify(thin));
  assert.ok(thin.size >= 54, JSON.stringify(thin));
  // No clear area read (or too small for a name that reads): the original's place, its upper third.
  assert.equal(nameIn(undefined, "Bar la Lune").box.top, 576);
  assert.equal(nameIn({ x: 100, y: 230, w: 760, h: 40 }, "Bar la Lune").box.top, 576);
});

test("« Le lieu tapé »: its small line and her logo once the name is typed, her colour readable on a sky", () => {
  const draw = (words: Record<string, string>, f: number, brand: Record<string, unknown> = {}, settings: Record<string, string> = {}) => {
    const plan = pieceTestPlan({ piece: frappe, shots: run, span: [1.2, 6], fill: fill(words, {}, settings), bpm: 100 });
    const { layer, length, shots } = layerProps(plan);
    const tree = drawAt(layer.motion.code!, f, {
      durationInFrames: length,
      shots,
      texts: layer.motion.texts,
      brand: { name: "Hôtel Luna", accent: "#1f4e79", accentInk: "#ffffff", displayFont: "Archivo Black", bodyFont: "Inter Tight", logoUrl: null, ...brand },
    });
    return { tree, marks: layer.motion.texts! };
  };
  // Its small line only when given: at once, a few images after the last letter, an accent in white capitals.
  const { marks } = draw({ lieu: "Le Petit Pont", ligne: "Paris 5e" }, 0);
  const lineAt = Number(marks.line);
  assert.ok(lineAt > 0);
  const lineOf = (tree: Drawn) => nodes(tree).find((n) => n.type === "FitText" && n.props.key === "line");
  assert.equal(lineOf(draw({ lieu: "Le Petit Pont", ligne: "Paris 5e" }, lineAt - 1).tree), undefined);
  const line = lineOf(draw({ lieu: "Le Petit Pont", ligne: "Paris 5e" }, lineAt).tree)!;
  assert.equal(((line.props.innerStyle as Record<string, unknown>).color), "#ffffff");
  assert.deepEqual((line.children[0] as Drawn).props, { "data-fauve-accent": "" });
  assert.equal(Number(draw({ lieu: "Le Petit Pont" }, 0).marks.line), -100);
  assert.ok(Array.from({ length: 144 }, (_, f) => lineOf(draw({ lieu: "Le Petit Pont" }, f).tree)).every((n) => !n));
  // Her name and its line in the upper half, inside the safe zone, her logo's room above it (no clear area read: the
  // original's place in its upper third).
  const end = draw({ lieu: "Le Petit Pont", ligne: "Paris 5e" }, 143, { logoUrl: "/logo.png" }).tree;
  const boxes = nodes(end).filter((n) => n.type === "FitText" || n.props.key === "logo").map((n) => styleOf(n) as { left: number; top: number; width: number; height: number });
  assert.equal(boxes.length, 3);
  for (const b of boxes) assert.ok(b.left >= 40 && b.left + b.width <= 1040 && b.top >= 80 && b.top + b.height <= 960, JSON.stringify(b));
  // Her logo wipes in from the left once the name is typed, whole after its wipe; none without a logo.
  const plain = draw({ lieu: "Le Petit Pont" }, 0).marks;
  const logoAt = Number(plain.logo);
  const lastLetter = typedFrames(13, Number(plain.type), Number(plain.type_step)).at(-1)!;
  assert.ok(logoAt > lastLetter && logoAt + Number(plain.wipe) <= 144 - 6, JSON.stringify(plain));
  const clip = (f: number) => styleOf(nodes(draw({ lieu: "Le Petit Pont" }, f, { logoUrl: "/logo.png" }).tree).find((n) => n.props.key === "logo")).clipPath;
  assert.equal(clip(logoAt - 1), undefined);
  assert.equal(clip(logoAt), "inset(0 100% 0 0)");
  assert.equal(clip(logoAt + Number(plain.wipe)), "inset(0 0% 0 0)");
  assert.ok(!nodes(draw({ lieu: "Le Petit Pont" }, 143).tree).some((n) => n.props.key === "logo"));
  // Her colour with the original's thin light edge; her other colour when hers is too pale for a sky, else the
  // original's red-orange; white on her word, its edge then dark.
  const ink = (brand: Record<string, unknown>, settings: Record<string, string> = {}) => {
    const name = nodes(draw({ lieu: "Le Petit Pont" }, 143, brand, settings).tree).find((n) => n.props.key === "name")!;
    const style = name.props.innerStyle as { color: string; textShadow: string };
    return [style.color, /^1px 0 0 (#[0-9a-f]+)/.exec(style.textShadow)![1]];
  };
  assert.deepEqual(ink({}), ["#1f4e79", "#fff4d6"]);
  assert.deepEqual(ink({ accent: "#f6e7dc", palette: { secondary: "#7a2e1d" } }), ["#7a2e1d", "#fff4d6"]);
  assert.deepEqual(ink({ accent: "#f6e7dc" }), ["#ff2b00", "#fff4d6"]);
  assert.deepEqual(ink({}, { couleur: "blanc" }), ["#ffffff", "#1d140e"]);
  assert.deepEqual(ink({ accent: "#f2a65a" }), ["#f2a65a", "#1d140e"]);
  // Its code with no object named keeps its words and lights nothing (« @lumieres » left: no object followed).
  assert.ok(pieceCode(frappe, {}).includes('"@lumieres"'));
});
