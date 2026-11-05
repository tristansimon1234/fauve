import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { buildReelProps } from "../motion.ts";
import { editPlanSchema, type ClipSegment } from "../schemas.ts";
import { readSkillFill, skillLengths, skillPlan, skillTalk, TALK_MAX_SECONDS, type SkillFillAnswer } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { chefFace } from "./chef-face.ts";

// « Le plat, puis la dégustation », the model (chef-face.ts, version 1), on its original's fiche (docs/fiches/chef-face.md).

/** Its original's measures (docs/fiches/chef-face.md): its dish shots (s), its words' line and sizes (shares of the height). */
const ORIGINAL = { dishShots: [0.933, 1.1, 0.7, 0.467, 0.667, 1.667, 0.533, 1.333, 0.833], line: 0.593, small: 23 / 1280, big: 41 / 1280, formula: 81 / 1280 };

/** Her talk at the table, as Scribe times it (s of her video): « Alors, chez nous la pizza se fait comme à Naples. … Bon appétit. » */
const SAID =
  "Alors, chez nous la pizza se fait comme à Naples. La pâte repose 48 heures, et ça change tout. Franchement, une tuerie. " +
  "D'abord la pâte, puis la sauce tomate, la mozzarella, et quatre-vingt-dix secondes au four. Bon appétit.";
const WORDS = (() => {
  let at = 0.4;
  return SAID.split(" ").map((w) => {
    const word = { w, start: Math.round(at * 100) / 100, end: Math.round((at + 0.12 + 0.045 * w.length) * 100) / 100 };
    // A breath after a comma, a longer one after a full stop; after « tout. » a pause of 0,7 s the engine shortens.
    at = word.end + (w === "tout." ? 0.7 : /\.$/.test(w) ? 0.3 : /,$/.test(w) ? 0.15 : 0.06);
    return word;
  });
})();
const index = (w: string, from = 0) => WORDS.findIndex((x, i) => i >= from && x.w.replace(/[.,]$/, "") === w);
const PAUSE = { start: WORDS[index("tout")]!.end + 0.02, end: WORDS[index("Franchement")]!.start - 0.02 };
const TALK = { clip: "talk", seconds: 22, words: WORDS, speech: { source: "scribe" as const, cleaned: false, floor: -50, fillers: [], pauses: [PAUSE] } };
const FILES = [
  { id: "talk", photo: false, seconds: 22, aspect: 9 / 16 },
  ...["dresse1", "dresse2", "dresse3", "bouchee", "goute", "pate", "sauce", "mozza", "four"].map((id) => ({ id, photo: false, seconds: 5, aspect: 9 / 16, moments: [{ start: 1, end: 3 }] })),
];
/** What its filler would choose: her dish being finished on her first idea (the bite last), her tasting on her second, her steps each with its video, her formula. */
const CHOICE = {
  hook: null,
  ideas: [
    { from: 0, to: index("Naples"), key: index("comme"), text: "comme à Naples", font: "", items: [], files: ["dresse1", "dresse2", "dresse3", "bouchee"] },
    { from: index("La"), to: index("tuerie"), key: index("repose"), text: "repose 48 heures", font: "", items: [], files: ["goute"] },
    {
      from: index("D'abord"),
      to: index("four"),
      key: index("quatre-vingt-dix"),
      text: "90 secondes au four",
      font: "",
      items: [
        { word: index("pâte", index("D'abord")), text: "la pâte", font: "", file: "pate" },
        { word: index("sauce"), text: "la sauce tomate", font: "", file: "sauce" },
        { word: index("mozzarella"), text: "la mozzarella", font: "", file: "mozza" },
        { word: index("four"), text: "au four", font: "", file: "four" },
      ],
    },
    { from: index("Bon"), to: index("appétit"), key: index("Bon"), text: "Bon appétit !", font: "", items: [] },
  ],
};
const answerOf = (voice: unknown) => ({ fits: true, missing: "", shots: [], texts: [], end: null, why: "", voice }) as unknown as SkillFillAnswer;

/** Her Reel on it, as the engine makes it: her talk cut, the filler's choice read, its plan and its composition's props. */
function made(options: { aspect?: number } = {}) {
  const talk = skillTalk(TALK)!;
  const files = FILES.map((f) => (f.id === "talk" && options.aspect ? { ...f, aspect: options.aspect } : f));
  const fill = readSkillFill(chefFace, files, talk.pieces.length, answerOf(CHOICE), { talk })!;
  const plan = editPlanSchema.parse(skillPlan({ skill: chefFace, name: "Le plat, puis la dégustation", files, fill, talk }));
  const props = buildReelProps(plan, {
    template: "libre",
    clipUrls: Object.fromEntries(files.map((f) => [f.id, `https://x/${f.id}.mp4`])),
    aspects: Object.fromEntries(files.map((f) => [f.id, f.aspect])),
    brand: { name: "Pizzeria Lina" },
    words: { talk: WORDS },
  });
  return { talk, fill, plan, layer: props.layers![0]! };
}

test("« Le plat, puis la dégustation » (v1): timed on her voice, her words its own, her images in turn on what she says", () => {
  assert.equal(chefFace.version, 1);
  assert.equal(chefFace.bpm, 96);
  const voice = chefFace.voice!;
  assert.equal(voice.cut, "attack");
  assert.equal(voice.subtitles, "own");
  assert.equal(voice.turns, 1.5);
  assert.deepEqual(voice.ideas, [2, 8]);
  // No hook of its own (its first words are written as all the others), no name, no font per word.
  assert.equal(voice.hook, undefined);
  assert.equal(voice.name, undefined);
  assert.ok(voice.refs && voice.items);
  assert.equal(chefFace.end, false);
  assert.deepEqual(chefFace.texts, []);
  // Her length (45 s at most), never a count of shots.
  assert.deepEqual(skillLengths(chefFace), { min: 3, max: TALK_MAX_SECONDS });
  // Light to render: nothing cut out, followed, nor read on her shots but her face (track).
  assert.deepEqual(checkMotionCode(chefFace.code), []);
  assert.deepEqual([subjectsDrawn(chefFace.code), objectsDrawn(chefFace.code), clearsDrawn(chefFace.code), readsDrawn(chefFace.code)], [[], [], [], []]);
  assert.ok(chefFace.code.length < 24000);
  assert.doesNotMatch(chefFace.code, /transform|scale\(/);
  // Its plan holds without her talk (the lengths of the library, a check).
  const nominal = chefFace.timeline(4, { end: false });
  assert.equal(nominal.shots.length, 4);
  assert.ok(nominal.texts.idee4 && nominal.texts.idee4.to === nominal.duration);
});

test("« Le plat, puis la dégustation »: her dish first in turn, her tasting before her face, each step on its word, her formula and the music cut", () => {
  const { talk, plan } = made();
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.skill, { key: "chef-face", version: 1 });
  assert.equal(plan.subtitles, true);
  const word = (w: string, from = 0) => talk.words[talk.words.findIndex((x, i) => i >= from && x.w.replace(/[.,]$/, "") === w)]!;
  // Her talk cut by the engine (her long pause shortened), the frame changing on the first word of each idea.
  const shots = plan.segments.filter((s): s is ClipSegment => "clip_id" in s && s.clip_id === "talk");
  const images = plan.segments.filter((s): s is ClipSegment => "clip_id" in s && s.clip_id !== "talk");
  assert.ok(talk.duration < 22 - 0.5 && Math.abs(plan.duration - talk.duration) < 0.02, `${plan.duration} s`);
  assert.ok(shots.length >= 4, `${shots.length} pieces of her talk`);
  const layer = plan.layers![0]!;
  const marks = layer.motion.texts!;
  for (const k of [2, 3, 4]) assert.ok(Math.abs(Number(marks[`said_idea${k}_from`]) / 30 - word(["La", "D'abord", "Bon"][k - 2]!, k === 2 ? 9 : 0).start) < 0.04, `idea ${k}`);
  // Her first idea's four images one after the other from its first image to her second idea, each its share, 1,5 s at
  // most (the original's dish shots are 0,47 to 1,67 s), the bite last; her tasting 1,5 s, then her face.
  const second = Number(marks.said_idea2_from) / 30;
  const dish = images.slice(0, 4);
  assert.deepEqual(dish.map((s) => s.clip_id), ["dresse1", "dresse2", "dresse3", "bouchee"]);
  assert.equal(dish[0]!.beside!.at, 0);
  for (const [i, s] of dish.entries()) {
    const length = s.out - s.in;
    assert.ok(length <= 1.5 + 0.01 && length >= 0.4, `${s.clip_id}: ${length} s`);
    if (i) assert.ok(Math.abs(s.beside!.at - (dish[i - 1]!.beside!.at + dish[i - 1]!.out - dish[i - 1]!.in)) < 0.02, s.clip_id);
    // From its best moment, at its own pace.
    assert.equal(s.in, 1);
    assert.equal(s.speed, undefined);
  }
  assert.ok(Math.max(...ORIGINAL.dishShots) <= 1.7);
  const tasting = images[4]!;
  assert.equal(tasting.clip_id, "goute");
  assert.ok(Math.abs(tasting.out - tasting.in - 1.5) < 0.01 && tasting.beside!.at >= second - 0.25, JSON.stringify(tasting));
  // Each step plein cadre from the instant she names it to the next one (the original's cuts on their words, within an
  // image or two).
  const steps = images.slice(5);
  assert.deepEqual(steps.map((s) => s.clip_id), ["pate", "sauce", "mozza", "four"]);
  const three = word("D'abord");
  assert.ok(Math.abs(steps[0]!.beside!.at - word("pâte", talk.words.indexOf(three)).start) < 0.02);
  assert.ok(Math.abs(steps[1]!.beside!.at - word("sauce").start) < 0.02);
  assert.ok(Math.abs(steps[1]!.beside!.at - (steps[0]!.beside!.at + steps[0]!.out - steps[0]!.in)) < 0.05);
  // Its words: each idea's strong words from the instant she says them to the end of their last one; her formula from
  // « Bon » to the end; the names of her list no text of their own (their images show them).
  const texts = plan.texts.map((t) => [t.style, t.text, t.from, t.to]);
  assert.deepEqual(texts.map((t) => t[1]), ["comme à Naples", "repose 48 heures", "90 secondes au four", "Bon appétit !"]);
  assert.ok(plan.texts.every((t) => t.style === "band"));
  assert.ok(Math.abs(plan.texts[0]!.from - word("comme").start) < 0.01 && Math.abs(plan.texts[0]!.to - Math.min(word("Naples").end + 0.25, word("La").start)) < 0.02, JSON.stringify(texts[0]));
  assert.equal(plan.texts[3]!.to, plan.duration);
  // Her music under her voice, cut dead on her formula.
  assert.ok(Math.abs(plan.music_shape!.end!.at - word("Bon").start) < 0.01 && plan.music_shape!.end!.fade! <= 0.012, JSON.stringify(plan.music_shape));
  // Its code writes everything she says (the engine's subtitles step aside), her face followed.
  assert.equal(layer.motion.times_spoken, true);
  assert.equal(layer.motion.writes_spoken, true);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Face = { x: number; y: number; width: number; height: number };

/** Its Scene at a frame on the composition's own props, run with a plain tree for React (no renderer). */
function drawAt(layer: ReturnType<typeof made>["layer"], frame: number, options: { face?: Face | null; texts?: Record<string, string> } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${chefFace.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const track = options.face === undefined ? undefined : () => ({ hands: [], bodies: [], faces: options.face ? [{ id: 0, ...options.face, points: {} }] : [] });
  return make(React, ...Object.values(scope))({
    width: 1080,
    height: 1920,
    durationInFrames: layer.durationInFrames,
    brand: { name: "Pizzeria Lina", displayFont: "Bebas Neue", bodyFont: "Jost", accent: "#c0392b" },
    shots: layer.shots ?? [],
    texts: { ...(layer.texts ?? {}), ...options.texts },
    reelTexts: layer.reelTexts ?? [],
    spoken: layer.spoken ?? [],
    track,
  });
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const sizeOf = (node: Drawn) => Number((node.props.innerStyle as Record<string, number>).fontSize);
function seen(tree: Drawn) {
  const all = nodes(tree);
  const footage = all.filter((n) => n.type === "Footage");
  const text = all.find((n) => n.type === "FitText") ?? null;
  // (Its words as the engine gives them: a no-break space between a number and its unit, read as a space.)
  return { shots: footage.map((n) => n.props.shot as number), box: footage[0] ? styleOf(footage[0]) : null, text: text ? (text.children.flat().join("") as string).replace(/\s/g, " ") : null, key: text ? String(text.props.key) : null, size: text ? sizeOf(text) : 0, at: text ? styleOf(text) : null };
}

test("« Le plat, puis la dégustation » draws her dish first, her words a few at a time, her strong words big, her formula on her face", () => {
  const { layer } = made();
  const frameOf = (w: string, from = 0) => (layer.spoken as { w: string; from: number }[]).filter((x) => x.w.replace(/[.,]$/, "") === w)[from]!.from;
  const talkN = Number(layer.texts!.said_shots);
  // Her first image from the first frame, full frame; her first words in capitals, the original's small size.
  const first = seen(drawAt(layer, 0));
  assert.deepEqual(first.shots, [talkN]);
  assert.deepEqual([first.box!.top, first.box!.height], [0, 1920]);
  const start = seen(drawAt(layer, frameOf("Alors")));
  assert.equal(start.text, "ALORS");
  // 55 px (capitals of about 38 px): the original's 34,5 px capitals at 1 920, a little bigger to read at 48 px at least.
  assert.equal(start.size, 55);
  assert.ok(start.size * 0.7 >= ORIGINAL.small * 1920 && start.size * 0.7 <= ORIGINAL.small * 1920 * 1.2);
  // A few words at a time, cut on her commas: « chez nous la pizza » (four words, 18 signs).
  assert.equal(seen(drawAt(layer, frameOf("chez"))).text, "CHEZ NOUS LA PIZZA");
  // Its strong words in place of hers, 1,75 times as big, at the instant she says them, on the same line.
  const strong = seen(drawAt(layer, frameOf("comme") + 2));
  assert.equal(strong.text, "COMME À NAPLES");
  assert.equal(strong.size, Math.round(55 * 1.75));
  const line = (s: ReturnType<typeof seen>) => Number(s.at!.top) + Number(s.at!.height) / 2;
  assert.ok(Math.abs(line(strong) - ORIGINAL.line * 1920) <= 1 && Math.abs(line(start) - ORIGINAL.line * 1920) <= 1);
  // A chunk ends before her strong words: « La pâte », then « REPOSE 48 HEURES » big; a comma at its end goes.
  assert.equal(seen(drawAt(layer, frameOf("La"))).text, "LA PÂTE");
  assert.equal(seen(drawAt(layer, frameOf("repose"))).text, "REPOSE 48 HEURES");
  assert.equal(seen(drawAt(layer, frameOf("et"))).text, "ET ÇA CHANGE TOUT");
  // Her tasting, then her face (her talk) for the rest of her second idea.
  const tasting = Math.round(Number(layer.texts!.said_ref5_from));
  assert.deepEqual(seen(drawAt(layer, tasting + 2)).shots, [talkN + 4]);
  assert.ok(seen(drawAt(layer, Math.round(Number(layer.texts!.said_ref5_to)) + 2)).shots[0]! < talkN);
  // Her formula: on her face (no image), 3,3 times as big, on two lines, to the last frame, nothing else written.
  const formula = seen(drawAt(layer, frameOf("Bon") + 1));
  assert.ok(formula.shots[0]! < talkN);
  assert.equal(formula.text, "BON APPÉTIT !");
  assert.equal(formula.size, Math.round(55 * 3.3));
  assert.equal(seen(drawAt(layer, layer.durationInFrames - 1)).text, "BON APPÉTIT !");
  assert.ok(Math.abs(ORIGINAL.formula / ORIGINAL.small - 3.5) < 0.1 && Math.abs(ORIGINAL.big / ORIGINAL.small - 1.78) < 0.05);
});

test("« Le plat, puis la dégustation »: every word in the safe zone, off her face on her shots, its format as her talking video", () => {
  const { layer } = made();
  // Every box centred between x 140 and 940 (left of the apps' buttons), above the bottom quarter, at every frame.
  for (let f = 0; f < layer.durationInFrames; f += 3) {
    const s = seen(drawAt(layer, f));
    if (!s.at) continue;
    const top = Number(s.at.top);
    assert.ok(Number(s.at.left) === 140 && Number(s.at.width) === 800 && top >= 0.06 * 1920 && top + Number(s.at.height) <= 0.75 * 1920 + 1, `${f}: ${JSON.stringify(s.at)}`);
  }
  // Her face on the line on her own shots: her words under her chin (read once a shot); on her images, the line.
  const talkN = Number(layer.texts!.said_shots);
  const onHer = Array.from({ length: layer.durationInFrames }, (_, f) => f).find((f) => { const s = seen(drawAt(layer, f)); return s.shots[0]! < talkN && s.text && !s.key!.startsWith("f-"); })!;
  const face = { x: 540, y: 900, width: 300, height: 260 };
  const moved = seen(drawAt(layer, onHer, { face }));
  assert.ok(Number(moved.at!.top) >= face.y + face.height * 0.75, JSON.stringify(moved.at));
  // A bigger face down to the bottom of the frame: above her head.
  const big = { x: 540, y: 1050, width: 300, height: 360 };
  const above = seen(drawAt(layer, onHer, { face: big }));
  assert.ok(Number(above.at!.top) + Number(above.at!.height) <= big.y - big.height * 0.95, JSON.stringify(above.at));
  // A face above the line leaves it where the original has it.
  const high = seen(drawAt(layer, onHer, { face: { ...face, y: 500 } }));
  assert.ok(Math.abs(Number(high.at!.top) + Number(high.at!.height) / 2 - Math.round(0.593 * 1920)) <= 1);
  // Her talk in width: every shot whole in a 16:9 band on black; upright on her word.
  const wide = made({ aspect: 16 / 9 }).layer;
  assert.deepEqual([seen(drawAt(wide, 0)).box!.top, seen(drawAt(wide, 0)).box!.height], [656, 608]);
  assert.equal(seen(drawAt(wide, 0, { texts: { format: "vertical" } })).box!.height, 1920);
  assert.equal(seen(drawAt(layer, 0, { texts: { format: "horizontal" } })).box!.height, 608);
});
