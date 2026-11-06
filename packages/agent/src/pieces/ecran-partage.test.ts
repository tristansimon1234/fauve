import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type EditPlan } from "../schemas.ts";
import { pieceTestPlan, type PieceFill } from "../pieces.ts";
import { skillSettings } from "../skills.ts";
import { ecranPartage } from "./ecran-partage.ts";

// « Écran partagé titré », the effect of the bank (ecran-partage.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** Its code run at one frame with a stand-in scope (the kit's pieces as named nodes): what it draws. */
function drawAt(code: string, frame: number, props: Record<string, unknown>): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children: children.flat(Infinity) }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Drawn[] => (node && typeof node === "object" && "children" in node ? [node as Drawn, ...(node as Drawn).children.flatMap(nodes)] : []);
const textOf = (node: Drawn): string => node.children.map((c) => (typeof c === "string" ? c : c && typeof c === "object" && "children" in c ? textOf(c as Drawn) : "")).join("");
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const keyed = (tree: Drawn, key: string) => nodes(tree).find((n) => n.props.key === key);

/** Her shots as its layer gets them: from the plan's shots, `from` in frames from the layer's start (negative before it). */
function layerProps(plan: EditPlan, aspect = 9 / 16, photos: string[] = []) {
  const layer = plan.layers![0]!;
  let at = 0;
  const shots = plan.segments.map((s, i) => {
    const seconds = "clip_id" in s ? s.out - s.in : 0;
    const photo = "clip_id" in s && photos.includes(s.clip_id);
    const shot = { segment: i, src: `/v${i}.mp4`, aspect, kind: photo ? "photo" : "video", from: Math.round((at - layer.from) * 30), durationInFrames: Math.round(seconds * 30) };
    at += seconds;
    return shot;
  });
  const durationInFrames = Math.round((layer.to - layer.from) * 30);
  return { width: 1080, height: 1920, durationInFrames, brand: { name: "Le Comptoir", displayFont: "EB Garamond", bodyFont: "Inter Tight" }, shots: shots.filter((s) => s.from < durationInFrames), texts: layer.motion.texts };
}

/** A run under it: a lead shot, then `n` shots of `each` s (a beat at 100 BPM: 0,6 s), then the montage. */
function run(n: number, each = 0.6) {
  return [
    { file: "lead", at: 1, seconds: 1.2 },
    ...Array.from({ length: n }, (_, i) => ({ file: `f${i}`, at: 0.5, seconds: each })),
    { file: "after", at: 2, seconds: 1.8 },
  ];
}
const WORDS = { personne: "les artistes", resultat: "l'art" };
const fill = (settings: Record<string, string> = {}, texts: Record<string, string> = WORDS): PieceFill => ({ texts, objects: {}, settings });
/** The shot each half shows at a frame (its key, then its Footage: which shot, from which frame), in order. */
const halves = (tree: Drawn) =>
  nodes(keyed(tree, "card")!)
    .filter((n) => n.type === "div" && /^[pq]\d+$/.test(String(n.props.key)))
    .map((half) => ({ key: String(half.props.key), footage: nodes(half).filter((n) => n.type === "Footage").map((f) => ({ shot: f.props.shot, at: f.props.at, opacity: styleOf(f).opacity })) }));

test("« Écran partagé titré » (effect v1): its layer over each count of shots, nothing cut out, no sound, its two titles", () => {
  for (let n = ecranPartage.shots[0]; n <= ecranPartage.shots[1]; n++) {
    const plan = pieceTestPlan({ piece: ecranPartage, shots: run(n), span: [1.2, 1.2 + n * 0.6], fill: fill(), bpm: 100 });
    assert.ok(editPlanSchema.safeParse(plan).success, `n=${n}`);
    const motion = plan.layers![0]!.motion;
    assert.equal(motion.drawn, undefined);
    assert.equal(motion.sounds, undefined);
    assert.deepEqual([motion.texts!.personne, motion.texts!.resultat], ["les artistes", "l'art"]);
    // Every frame has both halves, or one shot alone across the card (a photo): never a shot alone full frame.
    const props = layerProps(plan);
    for (let f = 0; f < props.durationInFrames; f += 3) assert.equal(halves(drawAt(ecranPartage.code, f, props)).length, 2, `n=${n}, frame ${f}`);
  }
});

test("« Écran partagé titré » (effect v1): two shots that follow each other laid on the same moment, each filling the pair, cutting together", () => {
  const plan = pieceTestPlan({ piece: ecranPartage, shots: run(4), span: [1.2, 1.2 + 4 * 0.6], fill: fill(), bpm: 100 });
  const props = layerProps(plan);
  // Its first pair (her shots 1 and 2, cut a beat apart by the editor) over both their beats: at frame 10, each half at
  // its passage's image 5 (half its speed: a beat's passage over two beats), the second shown beside the first, early.
  assert.deepEqual(halves(drawAt(ecranPartage.code, 10, props)), [
    { key: "p1", footage: [{ shot: 1, at: 5, opacity: undefined }] },
    { key: "q2", footage: [{ shot: 2, at: 5, opacity: undefined }] },
  ]);
  // Between two images, the next one blended over it.
  assert.deepEqual(halves(drawAt(ecranPartage.code, 11, props))[1], { key: "q2", footage: [{ shot: 2, at: 6, opacity: undefined }, { shot: 2, at: 5, opacity: 0.5 }] });
  // Both halves cut together on the pair's last image, to the next pair (her shots 3 and 4).
  assert.deepEqual(halves(drawAt(ecranPartage.code, 35, props)).map((h) => h.key), ["p1", "q2"]);
  assert.deepEqual(halves(drawAt(ecranPartage.code, 36, props)).map((h) => h.key), ["p3", "q4"]);
  // A passage longer than half its pair plays faster, at its own speed at most; a photo stays still.
  const mixed = pieceTestPlan({ piece: ecranPartage, shots: [...run(0), { file: "a", at: 0, seconds: 1.8 }, { file: "b", at: 0, seconds: 0.6 }].filter((s) => s.file !== "after").concat([{ file: "after", at: 2, seconds: 1.8 }]), span: [1.2, 3.6], fill: fill(), bpm: 100 });
  const mixedProps = layerProps(mixed, 9 / 16, ["b"]);
  const [a, b] = halves(drawAt(ecranPartage.code, 40, mixedProps));
  // Her first shot (54 images) over its pair (72): three quarters of its speed, its image 30 at frame 40.
  assert.deepEqual(a!.footage[0], { shot: 1, at: 10, opacity: undefined });
  assert.deepEqual(b!.footage, [{ shot: 2, at: undefined, opacity: undefined }]);
});

test("« Écran partagé titré » (effect v1): an odd count takes one shot alone in the middle, its gesture beside its last image", () => {
  // Three shots: the lone one first (its skill's middle of one pair), then a pair.
  const three = pieceTestPlan({ piece: ecranPartage, shots: run(3), span: [1.2, 3.0], fill: fill(), bpm: 100 });
  const props = layerProps(three);
  assert.deepEqual(halves(drawAt(ecranPartage.code, 5, props)), [
    { key: "p1", footage: [{ shot: 1, at: undefined, opacity: undefined }] },
    { key: "q1", footage: [{ shot: 1, at: 5 - 18, opacity: undefined }] },
  ]);
  assert.deepEqual(halves(drawAt(ecranPartage.code, 20, props)).map((h) => h.key), ["p2", "q3"]);
  // Five: a pair, the lone one, a pair.
  const five = pieceTestPlan({ piece: ecranPartage, shots: run(5), span: [1.2, 4.2], fill: fill(), bpm: 100 });
  const fiveProps = layerProps(five);
  assert.deepEqual([10, 40, 60].map((f) => halves(drawAt(ecranPartage.code, f, fiveProps)).map((h) => h.key).join(" ")), ["p1 q2", "p3 q3", "p4 q5"]);
  // A photo alone: across the card, once.
  const photo = layerProps(three, 9 / 16, ["f0"]);
  const lone = halves(drawAt(ecranPartage.code, 5, photo));
  assert.equal(lone.length, 1);
  assert.deepEqual(lone[0]!.footage, [{ shot: 1, at: undefined, opacity: undefined }]);
});

test("« Écran partagé titré » (effect v2): over the whole screen, side by side for vertical shots, one above the other for horizontal ones, the card on her word", () => {
  const plan = pieceTestPlan({ piece: ecranPartage, shots: run(4), span: [1.2, 3.6], fill: fill(), bpm: 100 });
  const layout = (props: Record<string, unknown>) => {
    const tree = drawAt(ecranPartage.code, 10, props);
    const card = styleOf(keyed(tree, "card")!);
    const parts = nodes(keyed(tree, "card")!).filter((n) => n.type === "div" && /^[pq]\d+$/.test(String(n.props.key))).map((n) => [styleOf(n).left, styleOf(n).top, styleOf(n).width, styleOf(n).height]);
    return { card: [card.left, card.top, card.width, card.height, card.borderRadius], parts };
  };
  // By default (Tristan, 6 November: « tout vertical please »), vertical: its halves side by side over the whole screen.
  assert.deepEqual(layout(layerProps(plan)), { card: [10, 35, 1060, 1856, 30], parts: [[0, 0, 530, 1856], [530, 0, 530, 1856]] });
  // Horizontal: one half above the other over the whole screen.
  assert.deepEqual(layout(layerProps(plan, 16 / 9)), { card: [10, 35, 1060, 1856, 30], parts: [[0, 0, 1060, 928], [0, 928, 1060, 928]] });
  // On her word, the original's 4:3 card at the middle of the screen on black, its halves side by side (2:3), touching.
  const card = pieceTestPlan({ piece: ecranPartage, shots: run(4), span: [1.2, 3.6], fill: fill({ format: "carte" }), bpm: 100 });
  assert.deepEqual(layout(layerProps(card)), { card: [10, 570, 1060, 783, 30], parts: [[0, 0, 530, 783], [530, 0, 530, 783]] });
  assert.equal(ecranPartage.settings?.[0]?.choices.find((c) => c.band)?.value, "carte");
  // On her word: side by side over the whole screen; the default never kept as a setting.
  const tall = pieceTestPlan({ piece: ecranPartage, shots: run(4), span: [1.2, 3.6], fill: fill({ format: "plein-ecran" }), bpm: 100 });
  assert.deepEqual(layout(layerProps(tall, 16 / 9)).parts, [[0, 0, 530, 1856], [530, 0, 530, 1856]]);
  assert.deepEqual(skillSettings(ecranPartage, [{ name: "format", value: "auto" }]), {});
  // Nothing moves, zooms nor slides in: cuts only.
  assert.doesNotMatch(ecranPartage.code, /transform|scale\(|interpolate\(/);
});

test("« Écran partagé titré » (effect v1): its two titles answer each other in a book serif, in the safe zone, the whole effect", () => {
  const plan = pieceTestPlan({ piece: ecranPartage, shots: run(4), span: [1.2, 3.6], fill: fill(), bpm: 100 });
  for (const aspect of [9 / 16, 16 / 9]) {
    const props = layerProps(plan, aspect);
    for (const f of [0, 40, props.durationInFrames - 1]) {
      const titles = nodes(drawAt(ecranPartage.code, f, props)).filter((n) => n.type === "FitText");
      assert.deepEqual(titles.map(textOf), ["Les artistes", "L'art"], `frame ${f}`);
      for (const t of titles) {
        const s = styleOf(t) as { left: number; top: number; width: number; height: number };
        assert.equal((t.props.innerStyle as { fontSize: number }).fontSize, 50);
        assert.ok(s.left >= 40 && s.left + s.width <= 1040 && s.top >= 80 && s.top + s.height <= 1440, JSON.stringify(s));
        if (s.top + s.height > 960) assert.ok(s.left + s.width <= 940, `left of the apps' buttons: ${JSON.stringify(s)}`);
      }
    }
  }
  // On its card (her word), side by side, just under the middle of the card, one on each half.
  const onCard = pieceTestPlan({ piece: ecranPartage, shots: run(4), span: [1.2, 3.6], fill: fill({ format: "carte" }), bpm: 100 });
  const side = nodes(drawAt(ecranPartage.code, 10, layerProps(onCard))).filter((n) => n.type === "FitText").map((n) => styleOf(n) as { left: number; top: number; width: number; height: number });
  assert.ok(side[0]!.left + side[0]!.width <= 540 && side[1]!.left >= 540, JSON.stringify(side));
  assert.ok(Math.abs(side[0]!.top + side[0]!.height / 2 - (570 + 783 * 0.54)) <= 2);
  // Over the whole screen, one on each half too.
  const wide = nodes(drawAt(ecranPartage.code, 10, layerProps(plan))).filter((n) => n.type === "FitText").map((n) => styleOf(n) as { left: number; width: number });
  assert.ok(wide[0]!.left + wide[0]!.width <= 540 && wide[1]!.left >= 540, JSON.stringify(wide));
});
