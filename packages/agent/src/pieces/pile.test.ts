import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceMusicShape, pieceTestPlan } from "../pieces.ts";
import { pile, pileSchedule } from "./pile.ts";

// « Pile de photos », the effect of the bank (pile.ts): its own checks, beside the bank's (features.test.ts).

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
/** What its Scene draws at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function draw(frame: number, props: Record<string, unknown>): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${pile.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const footage = (tree: Drawn) => nodes(tree).filter((n) => n.type === "Footage");
/** The words a tree writes inside its FitText, in order. */
const wordsOf = (tree: Drawn) => {
  const fit = nodes(tree).find((n) => n.type === "FitText");
  return fit ? nodes(fit).flatMap((d) => (d.children.flat(Infinity) as unknown[]).filter((c): c is string => typeof c === "string")) : [];
};

/** Her shots as the effect gets them (frames from its start): her shot before it, then n of a beat each. */
const under = (n: number, beat = 18, video = (i: number) => i % 5 === 3) => [
  { from: -36, durationInFrames: 36, kind: "video", aspect: 16 / 9 },
  ...Array.from({ length: n }, (_, i) => ({ from: i * beat, durationInFrames: beat, kind: video(i) ? "video" : "photo", aspect: video(i) ? 0.5625 : 1 })),
];
const brand = { displayFont: "Anton", bodyFont: "Inter Tight", accent: "#b4532a", palette: { light: "#f4ead8", dark: "#2b1d14" } };

test("« Pile de photos » (effect v2): its schedule holds for every count and span it takes, the pile empty on a whole beat", () => {
  for (const bpm of [60, 85, 100, 120, 140]) {
    const beat = (60 / bpm) * 30;
    for (let n = pile.shots[0]; n <= pile.shots[1]; n++) {
      for (const seconds of [pile.seconds[0], 4, 6, pile.seconds[1]]) {
        const frames = Math.round(seconds * 30);
        const { lands, leaves, hit } = pileSchedule(frames, beat, n);
        const at = `${bpm} BPM, ${n} photos, ${seconds} s`;
        assert.equal(lands.length, n, at);
        // Its words alone on the white first (a fifth of a beat), then the burst, in order, a frame apart at least.
        assert.ok(lands[0]! >= 1, at);
        lands.slice(1).forEach((l, k) => assert.ok(l >= lands[k]!, `${at}: landing ${k + 1}`));
        // Each one leaves after it landed, in the order they landed: the pile empties from the top.
        leaves.forEach((o, k) => assert.ok(o > lands[k]!, `${at}: photo ${k} stays`));
        leaves.slice(1).forEach((o, k) => assert.ok(o >= leaves[k]!, `${at}: leaving ${k + 1}`));
        // The second-last on the hit, the last a third of a beat after; her words alone at the end.
        assert.equal(leaves[n - 2], hit, at);
        assert.ok(leaves[n - 1]! > hit && leaves[n - 1]! <= hit + beat / 3 + 1, at);
        assert.ok(frames - leaves[n - 1]! >= Math.min(beat, frames * 0.2) - 1, `${at}: her words alone ${frames - leaves[n - 1]!} images`);
        // The full pile held a beat at most, the top never leaving before the last has landed.
        assert.ok(leaves[0]! >= lands[n - 1]! - 1, `${at}: the top leaves at ${leaves[0]}, the last lands at ${lands[n - 1]}`);
        assert.ok(leaves[0]! - lands[n - 1]! <= beat + 2, `${at}: held ${leaves[0]! - lands[n - 1]!} images`);
        // On a whole beat (to the nearest image) when the span leaves room for it.
        if (frames - Math.min(beat, frames * 0.2) - beat / 3 >= 2 * beat) assert.ok(Math.abs(hit - Math.round(hit / beat) * beat) <= 0.5, `${at}: hit ${hit}`);
      }
    }
  }
  // The original's pace on a span that fits it (0,18 beat a photo), slowed on a long one, its last third slower still.
  const { lands } = pileSchedule(234, 18, 13);
  const gaps = lands.slice(1).map((l, k) => l - lands[k]!);
  assert.ok(gaps.slice(0, 7).every((g) => g >= 4 && g <= 7), JSON.stringify(gaps));
  assert.ok(gaps.slice(-4).every((g) => g >= 8), JSON.stringify(gaps));
});

test("« Pile de photos » (effect v2): its layer gives every landing and leaving, a click on each landing and its knock on the hit", () => {
  const shots = [{ file: "lead", at: 1, seconds: 1.2 }, ...Array.from({ length: 13 }, (_, i) => ({ file: `f${i}`, at: 0, seconds: 0.6, photo: true })), { file: "after", at: 2, seconds: 1.8 }];
  const plan = pieceTestPlan({ piece: pile, shots, span: [1.2, 9], fill: { texts: { mots: "fait main à Lyon" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  const { lands, leaves, hit } = pileSchedule(234, 18, 13);
  lands.forEach((l, k) => assert.equal(motion.texts![`l${k}`], String(l)));
  leaves.forEach((o, k) => assert.equal(motion.texts![`o${k}`], String(o)));
  assert.equal(motion.texts!.mots, "fait main à Lyon");
  assert.equal(motion.drawn, undefined);
  // Its sounds within its span: one burst of light clicks from its first landing (a click on each landing, its slower
  // ones louder, and under its first ones a denser clicking that slows down), then the dry knock on the hit, the loudest.
  const sounds = motion.sounds!;
  assert.equal(sounds.length, 2);
  const [clicks, knock] = sounds as [NonNullable<typeof sounds>[number], NonNullable<typeof sounds>[number]];
  assert.deepEqual([clicks.sound, Math.round(clicks.at * 30)], ["light click", lands[0]]);
  const heard = clicks.burst!.times.map((t, k) => ({ f: (clicks.at + t) * 30, gain: clicks.burst!.gains![k]! }));
  for (const l of lands) assert.ok(heard.some((h) => Math.abs(h.f - l) < 0.6), `a click on its landing at ${l}`);
  assert.ok(heard.length >= lands.length + 15, `its denser clicking (${heard.length} hits)`);
  const gaps = heard.slice(1).map((h, k) => h.f - heard[k]!.f);
  assert.ok(gaps.slice(0, 5).every((g) => g < 1.2), "denser than a click a frame at first");
  assert.ok(heard.at(-1)!.gain > heard[0]!.gain, "its slower ones louder");
  assert.deepEqual([knock.sound, Math.round(knock.at * 30), knock.gain], ["dry knock", hit, 6]);
  assert.ok(sounds.every((s) => s.skill && s.at < 7.8));
  // Its music without its bass from the hit to its cut, whole again with the montage.
  const shape = pieceMusicShape({ piece: pile, fill: { texts: { mots: "fait main à Lyon" }, objects: {}, settings: {} }, plan, layer: plan.layers![0]!, bpm: 100 });
  assert.equal(shape?.filters?.length, 1);
  assert.deepEqual([shape!.filters![0]!.kind, Math.round((shape!.filters![0]!.from - 1.2) * 30), shape!.filters![0]!.to], ["thin", hit, 9]);
  // However many photos: every landing heard, in the one burst.
  const many = [{ file: "lead", at: 1, seconds: 1.2 }, ...Array.from({ length: 16 }, (_, i) => ({ file: `f${i}`, at: 0, seconds: 0.5 })), { file: "after", at: 2, seconds: 1.8 }];
  const crowded = pieceTestPlan({ piece: pile, shots: many, span: [1.2, 9.2], fill: { texts: { mots: "voici notre travail" }, objects: {}, settings: {} }, bpm: 140 });
  const more = crowded.layers![0]!.motion.sounds!;
  assert.equal(more.length, 2);
  const full = pileSchedule(240, (60 / 140) * 30, 16);
  for (const l of full.lands) assert.ok(more[0]!.burst!.times.some((t) => Math.abs((more[0]!.at + t) * 30 - l) < 0.6), `a click on its landing at ${l}`);
  assert.equal(more.at(-1)!.sound, "dry knock");
});

test("« Pile de photos » (effect v2): what it draws: her photos landed and not gone, each over the one before, her words in front all along", () => {
  const n = 13;
  const shots = under(n);
  const { lands, leaves } = pileSchedule(234, 18, n);
  const texts: Record<string, string> = { beat: "18", mots: "fait main à Lyon" };
  lands.forEach((l, k) => (texts[`l${k}`] = String(l)));
  leaves.forEach((o, k) => (texts[`o${k}`] = String(o)));
  const props = { width: 1080, height: 1920, durationInFrames: 234, brand, shots, texts };
  for (const f of [0, lands[3]!, lands[n - 1]!, leaves[2]! + 1, leaves[n - 2]!, 233]) {
    const tree = draw(f, props);
    const laid = footage(tree).map((x) => x.props.shot as number);
    const expected = Array.from({ length: n }, (_, k) => k).filter((k) => f >= lands[k]! && f < leaves[k]!).map((k) => k + 1);
    assert.deepEqual(laid, expected, `frame ${f}`);
    // Her words in front of everything, from its first image to its last, one a line.
    assert.deepEqual(wordsOf(tree).filter((w) => typeof w === "string"), ["FAIT", "MAIN", "À", "LYON"], `frame ${f}`);
  }
  // Her words alone on the white at the start and at the end; never her shot before it.
  assert.equal(footage(draw(0, props)).length, 0);
  assert.equal(footage(draw(233, props)).length, 0);
  // A photo still; a video plays from its landing while it lies on top, then holds on the image it was at.
  const video = 4;
  const k = video - 1;
  const atOf = (f: number) => footage(draw(f, props)).find((x) => x.props.shot === video)!.props.at as number;
  assert.equal(atOf(lands[k]! + 1), lands[k]);
  const onTop = lands[k + 1]! - lands[k]!;
  assert.equal(atOf(lands[k + 1]! + 3), lands[k + 1]! + 3 - onTop);
  assert.ok((footage(draw(lands[0]! + 1, props))[0]!.props.at as number) > 234 * 4);
  // Squares, three in portrait (its first among them); all in portrait 4:5 on her word.
  const boxes = (given: Record<string, string>) =>
    nodes(draw(lands[n - 1]!, { ...props, texts: given }))
      .filter((d) => d.type === "div" && d.children.some((c) => (c as Drawn | null)?.type === "Footage"))
      .map((d) => {
        const box = d.props.style as { width: number; height: number };
        return box.width / box.height;
      });
  const shapes = boxes(texts);
  assert.equal(shapes.length, n);
  assert.equal(shapes.filter((a) => Math.abs(a - 1) < 0.01).length, n - 3);
  assert.ok(Math.abs(shapes[0]! - 2 / 3) < 0.01);
  assert.ok(boxes({ ...texts, format: "portrait" }).every((a) => Math.abs(a - 0.8) < 0.01));
  // Her words' colour: hers when it reads on the white page, else her dark colour, else ink; a rim of the page's white.
  const colour = (accent: string, dark?: string) => {
    const tree = draw(0, { ...props, brand: { ...brand, accent, palette: dark ? { dark } : {} } });
    return (nodes(tree).find((d) => d.type === "div" && (d.props.style as { color?: string } | undefined)?.color)!.props.style as { color: string; textShadow: string });
  };
  assert.equal(colour("#b4532a").color, "#b4532a");
  assert.equal(colour("#fbd201", "#2b1d14").color, "#2b1d14");
  assert.equal(colour("#fbd201").color, "#161616");
  assert.match(colour("#b4532a").textShadow, /#fdfdfd/);
});

test("« Pile de photos » (effect v2): without its marks, a plain burst over its first half, the pile empty a beat before the end", () => {
  const props = { width: 1080, height: 1920, durationInFrames: 180, brand, shots: under(8), texts: { beat: "18", mots: "ça, c'est nous" } };
  const laid = (f: number) => footage(draw(f, props)).length;
  assert.equal(laid(0), 0);
  assert.equal(laid(81), 8);
  assert.equal(laid(170), 0);
});
