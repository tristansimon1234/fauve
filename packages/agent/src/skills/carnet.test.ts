import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReelProps } from "../motion.ts";
import { checkMotionCode, MOTION_SCOPE } from "../motion-scene.ts";
import { editPlanSchema, type ClipSegment } from "../schemas.ts";
import { readSkillFill, skillPlan, skillTalk, type SkillFillAnswer } from "../skills.ts";
import { subjectShots, objectsDrawn, readsDrawn, clearsDrawn, depthsDrawn } from "../subject.ts";
import { carnet, carnetKinds, KIND, questionTimes, windowMoments } from "./carnet.ts";

// « Ton produit raconté » (carnet.ts, docs/fiches/carnet.md), checked on its original's own talk, as the engine makes it.

const word = (w: string, start: number, end: number) => ({ w, start, end });
/** Its original's words as Scribe would time them, on its fiche's instants (each word written big, each subtitle, his pauses): 37,36 s. */
const CN_WORDS = (
  "this:0.14:0.3 is:0.31:0.45 my:0.46:0.62 notebook:0.65:1.15 " +
  "It's:2.53:2.66 a:2.68:2.72 place:2.75:2.96 for:2.98:3.08 ideas.:3.1:3.5 thoughts:3.6:4 essentially:4.2:4.7 anything:4.75:5.1 that:5.33:5.43 comes:5.45:5.63 to:5.65:5.72 my:5.75:5.88 mind.:5.9:6.3 " +
  "168:7.03:7.78 pages:7.83:8.25 of:8.6:8.72 pure:8.8:9.1 creative:9.17:9.7 sparks.:9.77:10.1 " +
  "What:11.33:11.48 I:11.5:11.56 like:11.6:11.78 about:11.8:11.98 it?:12:12.23 It:12.6:12.68 doesn't:12.7:12.93 have:12.95:13.08 to:13.1:13.18 be:13.2:13.33 polished.:13.35:13.77 It's:14.1:14.23 supposed:14.25:14.58 to:14.6:14.68 be:14.7:14.83 rough.:14.85:15.3 " +
  "Why:15.52:15.8 use:15.85:16.1 a:16.23:16.33 notebook?:16.57:17 " +
  "Over:17.47:17.63 the:17.65:17.73 years:17.75:18.03 I've:18.05:18.28 filled:18.3:18.7 numerous:18.77:19.18 different:19.2:19.58 notebooks.:19.6:20.13 Small:20.43:20.68 ones,:20.7:21 big:21.03:21.28 ones,:21.3:21.58 some:21.62:21.83 more:21.85:22.08 than:22.1:22.28 others.:22.3:22.87 " +
  "From:23.63:23.78 my:23.8:23.93 early:23.95:24.25 LEGO:24.27:24.58 photography:24.6:25.08 concepts:25.1:25.55 to:25.57:25.68 storyboards:25.7:26.28 for:26.3:26.43 my:26.45:26.68 first:26.7:26.98 client:27:27.38 projects:27.4:27.85 to:28.4:28.48 the:28.5:28.58 next:28.6:28.83 big:28.85:28.98 startup:29:29.38 idea.:29.4:29.83 " +
  "Each:30.37:30.58 page:30.6:30.88 represents:30.9:31.48 a:31.5:31.6 different:31.87:32.28 chapter:32.3:32.58 of:32.6:32.73 my:32.75:32.88 life.:32.9:33.15 " +
  "And:33.2:33.33 now:33.35:33.48 that:33.5:33.63 I've:33.65:33.88 finished:33.9:34.18 this:34.2:34.38 notebook:34.4:35.1 I:35.7:35.78 got:35.8:35.98 a:36:36.08 new:36.1:36.28 one.:36.3:36.55"
)
  .split(" ")
  .map((s) => {
    const [w, a, b] = s.split(":");
    return word(w!, Number(a), Number(b));
  });
/** Its voice's long pauses (silencedetect), the engine shortening each one over 0,4 s to a breath. */
const CN_PAUSES = [
  [0, 0.12],
  [1.17, 2.5],
  [6.32, 7.01],
  [10.12, 11.3],
  [17.02, 17.45],
  [22.89, 23.6],
  [29.85, 30.35],
  [35.12, 35.68],
  [36.57, 37.36],
].map(([start, end]) => ({ start: start!, end: end! }));
const CN_TALK = { clip: "orig", seconds: 37.36, words: CN_WORDS, speech: { source: "scribe" as const, cleaned: false, floor: -50, fillers: [], pauses: CN_PAUSES } };
/** Its pictures, as his files would be: the notebook held up, under its spot, its pages, the stack, his desk… */
const PICTURES = Array.from({ length: 23 }, (_, i) => `p${i + 1}`);
/** What its filler would choose in it: « notebook » and its three pictures, « 168 » and « pages », his window, his question and its four notebooks, a list of four pages held up. */
const CN_SAID = {
  hook: null,
  ideas: [
    { from: 0, to: 3, key: 3, text: "notebook", font: "", files: ["p1", "p2", "p3"], items: [] },
    { from: 4, to: 16, key: 8, text: "ideas", font: "", files: ["p4", "p5", "p6", "p7"], items: [] },
    { from: 17, to: 22, key: 17, text: "168", font: "", files: ["p8", "p9", "p10"], items: [{ word: 18, text: "pages", font: "" }] },
    { from: 23, to: 38, key: 33, text: "polished", font: "", files: [], items: [] },
    { from: 39, to: 42, key: 39, text: "why use a notebook ?", font: "", files: ["p11", "p12", "p13", "p14"], items: [] },
    { from: 43, to: 58, key: 50, text: "notebooks", font: "", files: ["p15", "p16", "p17"], items: [] },
    { from: 59, to: 77, key: 64, text: "concepts", font: "", files: [], items: [[62, "LEGO", "p18"], [66, "storyboards", "p19"], [70, "client", "p20"], [76, "startup", "p21"]].map(([w, text, file]) => ({ word: w as number, text: text as string, font: "", file: file as string })) },
    { from: 78, to: 98, key: 83, text: "chapter", font: "", files: ["p22", "p23"], items: [] },
  ],
};
const voiceAnswer = (voice: Record<string, unknown>) => ({ fits: true, missing: "", shots: [], texts: [], end: null, why: "", voice }) as unknown as SkillFillAnswer;

/** « Ton produit raconté » made on its original's own talk, as the engine makes it: its plan, its talk, the composition's props. */
function onOriginal(options: { aspect?: number } = {}) {
  const talk = skillTalk(CN_TALK)!;
  const files = [{ id: "orig", photo: false, seconds: 37.36, aspect: options.aspect ?? 9 / 16 }, ...PICTURES.map((id) => ({ id, photo: true, seconds: 0 }))];
  const fill = readSkillFill(carnet, files, talk.pieces.length, voiceAnswer(CN_SAID), { talk })!;
  const plan = editPlanSchema.parse(skillPlan({ skill: carnet, name: "Ton produit raconté", files, fill, talk }));
  const props = buildReelProps(plan, {
    template: "libre",
    clipUrls: Object.fromEntries(files.map((f) => [f.id, `https://x/${f.id}.mp4`])),
    photoIds: PICTURES,
    aspects: { orig: options.aspect ?? 9 / 16 },
    brand: { name: "Carnet" },
    words: { orig: CN_WORDS },
  });
  return { talk, plan, layer: props.layers![0]! as unknown as Layer };
}
type Layer = { durationInFrames: number; shots: { from: number; durationInFrames: number; aspect?: number; kind?: string }[]; texts: Record<string, string>; reelTexts: { text: string; role: string; from: number; to: number }[]; spoken: { w: string; from: number; to: number }[] };
/** A time on the Reel's clock on his video's (through his talk's pieces): where the original's own times are. */
const onHisVideo = (talk: { pieces: { in: number; start: number; end: number }[] }, t: number) => {
  const p = talk.pieces.find((x) => t >= x.start - 0.005 && t < x.end + 0.005) ?? talk.pieces.at(-1)!;
  return p.in + (t - p.start);
};
const within2 = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) <= 2 / 30 + 0.001, `${what}: ${a.toFixed(3)} s, the original's ${b} s`);
const within = (a: number, b: number, what: string, tolerance = 2) => assert.ok(Math.abs(a - b) <= tolerance, `${what}: ${a} for ${b}`);

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Face = { x: number; y: number; width: number; height: number };
/** What its Scene draws at a frame, every piece of the kit a named node: his face where `face` says (track). */
function drawAt(frame: number, layer: Layer, read: { face?: Face | null; texts?: Record<string, string>; shots?: Layer["shots"] } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), useMemo: (f: () => unknown) => f(), Fragment: "Fragment" };
  const scope: Record<string, unknown> = Object.fromEntries(MOTION_SCOPE.filter((n) => n !== "React").map((n) => [n, n]));
  Object.assign(scope, { useCurrentFrame: () => frame, useVideoConfig: () => ({ width: 1080, height: 1920, fps: 30, durationInFrames: layer.durationInFrames }) });
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${carnet.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const track = () => ({ hands: [], faces: read.face ? [{ id: 0, ...read.face, points: {} }] : [], bodies: [] });
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: layer.durationInFrames,
    brand: { name: "Carnet", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#b5543a" },
    shots: read.shots ?? layer.shots,
    texts: { ...layer.texts, ...read.texts },
    reelTexts: layer.reelTexts,
    spoken: layer.spoken,
    track,
  });
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const textOf = (node: Drawn): string => nodes(node).flatMap((n) => n.children.flat(Infinity).filter((c): c is string => typeof c === "string")).join("");
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const fits = (tree: Drawn) => nodes(tree).filter((n) => n.type === "FitText");
const footage = (tree: Drawn) => nodes(tree).filter((n) => n.type === "Footage");
const keyed = (tree: Drawn, key: string) => nodes(tree).find((n) => n.props.key === key) ?? null;
const f = (s: number) => Math.round(s * 30);

test("« Ton produit raconté » (v1): its words on its original's words, its window's black and jump, its question, its end, within two images", () => {
  const { talk, plan } = onOriginal();
  assert.equal(carnet.version, 1);
  assert.equal(carnet.bpm, 90);
  assert.ok(carnet.voice && carnet.voice.cut === "attack" && carnet.voice.subtitles === "own" && carnet.voice.angles === false && !carnet.voice.hook);
  // His long pauses shortened as everywhere: 33,5 s of his 37,36.
  assert.ok(plan.duration > 32.5 && plan.duration < 34.5, String(plan.duration));
  // What each idea is laid as: its name, pictures, a number, his window, a question, pictures, a list of pictures, pictures.
  assert.deepEqual(Object.keys(plan.layers![0]!.motion.texts!).filter((k) => /^kind\d$/.test(k)).map((k) => Number(plan.layers![0]!.motion.texts![k])), [KIND.name, KIND.pictures, KIND.number, KIND.window, KIND.question, KIND.pictures, KIND.pictures, KIND.pictures]);
  const text = (t: string) => plan.texts.find((x) => x.text === t)!;
  // « notebook » very big on its word, gone 3 images before its cut (the original's 0,67 and 1,27 s).
  within2(onHisVideo(talk, text("notebook").from), 0.65, "« notebook » in");
  within2(onHisVideo(talk, text("notebook").to), 1.25, "« notebook » out");
  // « 168 » on its word, with « pages », both gone with « pages » (the original's 7,03, 7,83 and 8,27 s).
  within2(onHisVideo(talk, text("168").from), 7.03, "« 168 » in");
  within2(onHisVideo(talk, text("pages").from), 7.83, "« pages » in");
  within2(onHisVideo(talk, text("168").to), 8.3, "« 168 » out");
  assert.equal(text("pages").to, text("168").to);
  // His question whole from its first word to the next idea; each of its words on its instant (the original's 15,50 · 15,83
  // · 16,23 · 16,57 s), « ? » nine images after the last (16,87 s); a thud as each notebook lands on the stack.
  const marks = plan.layers![0]!.motion.texts!;
  assert.equal(marks.q5_count, "4");
  [15.52, 15.85, 16.23, 16.57].forEach((t, j) => within2(onHisVideo(talk, Number(marks[`q5_${j + 1}`]) / 30), t, `question word ${j + 1}`));
  within2(onHisVideo(talk, text("why use a notebook ?").from), 15.52, "the question in");
  assert.deepEqual(plan.sounds!.map((s) => s.sound), Array(4).fill("soft thud of a notebook laid on a table"));
  plan.sounds!.forEach((s, j) => within2(onHisVideo(talk, s.at), [15.52, 15.85, 16.23, 16.57][j]!, `thud ${j + 1}`));
  // His window: black just after « sparks. », shown 4 images into « What » (the original's 10 images of black), its jump on
  // « It's supposed to be rough. » (14,10 s).
  const black = Number(marks.win_black) / 30;
  const shown = Number(marks.win_from) / 30;
  assert.ok(shown - black >= 0.2 && shown - black <= 0.34, `${black} → ${shown}`);
  within2(onHisVideo(talk, Number(marks.win_punch) / 30), 14.1, "its jump");
  // Nothing written of his keywords that only separate his ideas, nor of the names whose pictures show.
  assert.deepEqual(plan.texts.map((t) => t.text), ["notebook", "168", "pages", "why use a notebook ?"]);
  // His last word, then black: its music stopped with it (the original's 36,67 s).
  within2(onHisVideo(talk, plan.music_shape!.end!.at), 36.67, "its black and its music's end");
  assert.ok(plan.music_shape!.end!.fade! > 0 && !plan.music_shape!.pauses && !plan.music_shape!.none);
  // Its subtitles are its own; its pictures laid beside his talk, never heard; nothing of him cut out.
  assert.equal(plan.subtitles, true);
  assert.equal(plan.layers![0]!.motion.writes_spoken, true);
  assert.equal(plan.layers![0]!.motion.times_spoken, true);
  const segments = plan.segments.filter((s): s is ClipSegment => "clip_id" in s);
  assert.equal(segments.filter((s) => s.clip_id === "orig").length, Number(marks.said_shots));
  assert.ok(Number(marks.said_shots) >= talk.pieces.length);
  assert.equal(segments.filter((s) => s.beside).length, 3 + 4 + 3 + 4 + 3 + 4 + 2);
  assert.deepEqual([...subjectShots(plan)], []);
});

test("« Ton produit raconté »: what each idea is laid as, its question's words on her words, its window's moments", () => {
  // Her first idea presents; a number types; a question with her pictures is laid around her object; the first idea
  // without pictures (never the first) is her window, the next ones her talking video.
  const idea = (text: string) => ({ text, words: [0, 1] as [number, number], key: 0, from: 0, to: 1, at: 0, items: [] });
  const refs = (ideas: number[]) => ideas.map((k) => ({ file: `f${k}`, from: 0, to: 1, idea: k, item: 0 }));
  assert.deepEqual(carnetKinds({ ideas: [idea("vase"), idea("tour"), idea("12"), idea("pourquoi un bol ?"), idea("aime"), idea("atelier")], refs: refs([0, 1, 3]) }), [KIND.name, KIND.pictures, KIND.number, KIND.question, KIND.window, KIND.face]);
  // A question without her pictures is not laid around anything: her window then.
  assert.deepEqual(carnetKinds({ ideas: [idea("vase"), idea("pourquoi un bol ?")], refs: [] }), [KIND.name, KIND.window]);
  // Her question's words found by their letters from its keyword on; a word she does not say, a beat after the one before.
  const words = [word("Et", 0, 0.2), word("pourquoi", 0.3, 0.6), word("un", 0.65, 0.75), word("bol", 0.8, 1.1), word("?", 1.1, 1.12)];
  const said = { words, ideas: [{ ...idea("pourquoi un bol ?"), words: [0, 4] as [number, number], key: 1, at: 0.3 }] };
  assert.deepEqual(questionTimes(said, 0), [0.3, 0.65, 0.8]);
  assert.deepEqual(questionTimes({ ...said, ideas: [{ ...said.ideas[0]!, text: "pourquoi un pot ?" }] }, 0), [0.3, 0.65, 0.92]);
  // Her window: no jump on a short one with one phrase.
  const short = { words: [word("Ce", 1, 1.2), word("que", 1.25, 1.4), word("j'aime.", 1.45, 2)], ideas: [{ ...idea("aime"), words: [0, 0] as [number, number], to: 0.5 }, { ...idea("aime"), words: [0, 2] as [number, number], from: 1, to: 2 }] };
  assert.deepEqual(windowMoments(short, 1), { black: 0.8, from: 1.13, punch: null });
});

test("« Ton produit raconté » (v1) draws: her first words small one by one, its name very big, her second picture under a spot", () => {
  const { layer } = onOriginal();
  const name = layer.reelTexts.find((t) => t.text === "notebook")!;
  // Before its name: her words laid out whole on one centred line, each seen from the image she says it.
  const line = (tree: Drawn) => keyed(tree, "small");
  const words = (tree: Drawn) => nodes(line(tree)!).filter((n) => n.type === "span").map((n) => [textOf(n), styleOf(n).opacity]);
  assert.deepEqual(words(drawAt(f(0.2), layer)), [["this", 1], ["is", 0], ["my", 0]]);
  assert.deepEqual(words(drawAt(name.from - 1, layer)), [["this", 1], ["is", 1], ["my", 1]]);
  const small = styleOf(line(drawAt(name.from, layer))!);
  assert.ok(Number(small.top) >= 0.41 * 1920 && Number(small.top) + Number(small.height) <= 0.465 * 1920);
  assert.ok(Number(styleOf(nodes(line(drawAt(name.from, layer))!).find((n) => n.type === "span")!).fontSize) >= 48);
  // Its name from its word, very big right under them, 82 % of the width; no subtitle with it.
  assert.equal(fits(drawAt(name.from - 1, layer)).length, 0);
  const big = fits(drawAt(name.from, layer));
  assert.deepEqual(big.map(textOf), ["notebook"]);
  assert.deepEqual([styleOf(big[0]!).left, styleOf(big[0]!).top, styleOf(big[0]!).width], [Math.round(1080 * 0.09), Math.round(1920 * 0.462), Math.round(1080 * 0.82)]);
  assert.equal((big[0]!.props.innerStyle as Record<string, unknown>).fontWeight, 800);
  assert.equal(line(drawAt(name.to - 2, layer)), null);
  assert.equal(fits(drawAt(name.to, layer)).length, 0);
  // Its pictures in turn over its first idea, cut on his words; the second one under a round of light on black.
  const pics = (tree: Drawn) => footage(tree).map((n) => Number(n.props.shot));
  const talkN = Number(layer.texts.said_shots);
  const first = pics(drawAt(f(0.3), layer));
  assert.deepEqual(first, [talkN]);
  const spot = [...Array(f(1.3)).keys()].map((k) => drawAt(k, layer)).find((t) => keyed(t, "spot"));
  assert.ok(spot, "its spot");
  const disc = styleOf(keyed(spot!, "spot")!);
  assert.equal(disc.borderRadius, "50%");
  assert.ok(Math.abs(Number(disc.width) - 0.494 * 1080) <= 1 && Math.abs(Number(disc.height) / Number(disc.width) - 1.36) < 0.01);
});

test("« Ton produit raconté » (v1): its number typed digit by digit, its unit, then her words one at a time; her question around her object", () => {
  const { layer } = onOriginal();
  const num = layer.reelTexts.find((t) => t.text === "168")!;
  // Typed at its final place: « 1 », « 16 », « 168 » (the original's every 4 to 5 images), its unit small under it.
  const digits = (k: number) => {
    const fit = fits(drawAt(num.from + k, layer)).find((n) => textOf(n) === "168")!;
    return nodes(fit).filter((n) => n.type === "span").map((n) => (styleOf(n).color === "rgba(255,255,255,0)" ? "_" : textOf(n))).join("");
  };
  assert.deepEqual([digits(0), digits(5), digits(9)], ["1__", "16_", "168"]);
  const unitAt = layer.reelTexts.find((t) => t.text === "pages")!.from;
  const both = fits(drawAt(unitAt + 1, layer));
  assert.deepEqual(both.map(textOf), ["168", "pages"]);
  assert.ok(Number(styleOf(both[1]!).top) > Number(styleOf(both[0]!).top) + Number(styleOf(both[0]!).height) - 1);
  assert.ok(Number((both[1]!.props.innerStyle as Record<string, unknown>).fontSize) >= 48);
  // Then the rest of his phrase one word at a time in the middle, each alone: « of », « pure », « creative », « sparks ».
  const after = layer.spoken.filter((w) => w.from >= num.to - 2 && w.from < Number(layer.texts.win_black) && ["of", "pure", "creative", "sparks."].includes(w.w));
  assert.deepEqual(after.map((w) => fits(drawAt(w.from + 1, layer)).map(textOf)), [["of"], ["pure"], ["creative"], ["sparks"]]);
  // No subtitles during its idea.
  assert.ok(!nodes(drawAt(after[0]!.from + 1, layer)).some((n) => String(n.props.key).startsWith("sub")));
  // His question's words around his object, each on its instant, then « ? » alone in the middle; all inside the safe zone.
  // (The engine sets her question's « ? » after a narrow no-break space, as French wants it.)
  const q = layer.reelTexts.find((t) => t.text.replace(/\s+/g, " ") === "why use a notebook ?")!;
  const at = [1, 2, 3, 4].map((j) => Number(layer.texts[`q5_${j}`]));
  const shownAt = (k: number) => fits(drawAt(k, layer)).map(textOf);
  assert.deepEqual(shownAt(at[0]!), ["why"]);
  assert.deepEqual(shownAt(at[1]!), ["why", "use"]);
  assert.deepEqual(shownAt(at[3]! + 8), ["why", "use", "a", "notebook"]);
  assert.deepEqual(shownAt(at[3]! + 9), ["why", "use", "a", "notebook", "?"]);
  const laid = fits(drawAt(q.to - 1, layer)).map((n) => styleOf(n));
  for (const b of laid) {
    const [x, y, w, hh] = [b.left, b.top, b.width, b.height].map(Number) as [number, number, number, number];
    assert.ok(x >= 40 && y >= 80 && y + hh <= 0.75 * 1920 && x + w <= (y + hh > 960 ? 940 : 1040), JSON.stringify(b));
  }
  // The first big at the top left, the second under it on the right, the third low on the left, the last across under the object.
  assert.ok(Number(laid[0]!.top) < Number(laid[1]!.top) && Number(laid[1]!.left) > Number(laid[0]!.left) && Number(laid[2]!.top) > 960 && Number(laid[3]!.top) > Number(laid[2]!.top));
  // One more picture of his object on each of its words.
  const pic = (k: number) => footage(drawAt(k, layer)).map((n) => Number(n.props.shot))[0];
  assert.deepEqual(at.map((k) => pic(k + 1)), [pic(at[0]! + 1), pic(at[0]! + 1)! + 1, pic(at[0]! + 1)! + 2, pic(at[0]! + 1)! + 3]);
});

test("« Ton produit raconté » (v1): his window, black first, his face in a lit round on black, 1,61 times closer on his last phrase", () => {
  const { layer } = onOriginal();
  const black = Number(layer.texts.win_black);
  const shown = Number(layer.texts.win_from);
  const punch = Number(layer.texts.win_punch);
  const face = { x: 560, y: 700, width: 220, height: 280 };
  // Black: nothing drawn, no subtitle.
  const dark = drawAt(black + 1, layer, { face });
  assert.equal(footage(dark).length, 0);
  assert.equal(fits(dark).length, 0);
  // Then at once his round: an ellipse 49,4 % of the width, 1,36 times as tall, his face in its middle, 42 % of its width.
  const win = keyed(drawAt(shown, layer, { face }), "win")!;
  const b = styleOf(win);
  assert.equal(b.borderRadius, "50%");
  assert.ok(Math.abs(Number(b.width) - 533.5) <= 1 && Math.abs(Number(b.height) / Number(b.width) - 1.36) < 0.01, JSON.stringify(b));
  assert.ok(Number(b.top) + Number(b.height) <= 0.66 * 1920);
  const her = styleOf(footage(win)[0]!);
  const s = Number(her.width) / 1080;
  within(Number(her.left) + face.x * s, Number(b.width) / 2, "his face across");
  within(Number(her.top) + face.y * s, Number(b.height) / 2, "his face down");
  within(face.width * s, 0.42 * Number(b.width), "his face's size");
  // His subtitles under it, inside the safe zone.
  const sub = nodes(drawAt(shown + 20, layer, { face })).find((n) => String(n.props.key).startsWith("sub"))!;
  assert.ok(Number(styleOf(sub).top) > Number(b.top) + Number(b.height) && Number(styleOf(sub).top) + Number(styleOf(sub).height) <= 0.75 * 1920);
  assert.ok(Number((sub.props.innerStyle as Record<string, unknown>).fontSize) >= 48);
  // On his last phrase, in one image, the same picture 1,61 times closer, his face still in its middle.
  assert.ok(keyed(drawAt(punch - 1, layer, { face }), "win"));
  const close = keyed(drawAt(punch, layer, { face }), "win-p")!;
  assert.ok(Math.abs(Number(styleOf(close).width) / Number(b.width) - 1.61) < 0.01);
  within(Number(styleOf(footage(close)[0]!).width) / Number(her.width), 1.61, "the same take closer", 0.01);
  // Without his face followed: the round still drawn, filled.
  const bare = keyed(drawAt(shown, layer), "win")!;
  const pic = styleOf(footage(bare)[0]!);
  assert.ok(Number(pic.left) <= 0 && Number(pic.top) <= 0 && Number(pic.left) + Number(pic.width) >= Number(styleOf(bare).width) && Number(pic.top) + Number(pic.height) >= Number(styleOf(bare).height));
});

test("« Ton produit raconté » (v1): its subtitles a short phrase at a time, never with its big words; black after his last word; its format", () => {
  const { layer } = onOriginal();
  const subs = [...Array(layer.durationInFrames).keys()].map((k) => nodes(drawAt(k, layer)).find((n) => String(n.props.key).startsWith("sub")));
  const texts = [...new Set(subs.filter(Boolean).map((n) => textOf(n!)))];
  // Four words and 26 characters at most, bold, white, at the bottom of the safe zone, left of the apps' buttons.
  assert.ok(texts.length > 20 && texts.every((t) => t.split(" ").length <= 4 && t.length <= 26), JSON.stringify(texts));
  const sub = subs.find(Boolean)!;
  assert.deepEqual([styleOf(sub).left, styleOf(sub).width], [140, 800]);
  assert.ok(Number(styleOf(sub).top) + Number(styleOf(sub).height) <= 1440);
  // Never with its big words.
  for (const t of layer.reelTexts) for (let k = t.from; k < t.to; k += 3) assert.ok(!subs[k], `a subtitle with « ${t.text} » at ${k}`);
  // His last word, then black to the end.
  const end = Number(layer.texts.said_end) + Number(layer.texts.black_after);
  assert.ok(layer.durationInFrames - end >= 8);
  const last = drawAt(layer.durationInFrames - 2, layer);
  assert.deepEqual([footage(last).length, fits(last).length], [0, 0]);
  assert.ok(footage(drawAt(end - 1, layer)).length >= 1);
  // Its format: as his video (full frame), or his pictures whole in a 16:9 band on black, on her word or for a video filmed in width.
  assert.deepEqual(carnet.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]]]);
  const box = (tree: Drawn) => { const s = styleOf(footage(tree)[0]!); return [s.left, s.top, s.width, s.height]; };
  assert.deepEqual(box(drawAt(f(4), layer)), [0, 0, 1080, 1920]);
  assert.deepEqual(box(drawAt(f(4), layer, { texts: { format: "horizontal" } })), [0, 656, 1080, 608]);
  const wide = layer.shots.map((s, i) => (i === 0 ? { ...s, aspect: 16 / 9 } : s));
  assert.deepEqual(box(drawAt(f(4), layer, { shots: wide })), [0, 656, 1080, 608]);
  assert.deepEqual(box(drawAt(f(4), layer, { shots: wide, texts: { format: "vertical" } })), [0, 0, 1080, 1920]);
});

test("« Ton produit raconté » (v1): its code passes the check, light to render, under 24 000 characters; its filler casts only her pictures", () => {
  assert.deepEqual(checkMotionCode(carnet.code), []);
  assert.ok(carnet.code.length < 24000, String(carnet.code.length));
  // Nothing of her cut out, no object followed, nothing read on her shots: her face only, followed as for every talk.
  const { plan } = onOriginal();
  assert.deepEqual([[...subjectShots(plan)], objectsDrawn(carnet.code), readsDrawn(carnet.code), clearsDrawn(carnet.code), depthsDrawn(carnet.code)], [[], [], [], [], []]);
  assert.doesNotMatch(carnet.code, /\bSubject\b|SubjectBox|LightUnder|Depth|Skyline/);
  // Its blacks stay black: no fade, no grain, no dark corners from its finish.
  assert.deepEqual(carnet.finish, { fade: 0, grain: 0, vignette: 0 });
  // Its filler casts her pictures only on her ideas, never her talking video; each picture once.
  const talk = skillTalk(CN_TALK)!;
  const files = [{ id: "orig", photo: false, seconds: 37.36 }, { id: "p1", photo: true, seconds: 0 }, { id: "p2", photo: true, seconds: 0 }];
  const fill = readSkillFill(carnet, files, talk.pieces.length, voiceAnswer({ hook: null, ideas: [{ ...CN_SAID.ideas[0]!, files: ["orig", "p1", "p1"] }, { ...CN_SAID.ideas[1]!, files: ["p2"] }] }), { talk })!;
  assert.deepEqual(fill.said!.ideas.map((i) => i.files ?? []), [["p1"], ["p2"]]);
  // Its lengths are hers.
  assert.equal(carnet.timeline(3, { end: false }).shots.length, 3);
});
