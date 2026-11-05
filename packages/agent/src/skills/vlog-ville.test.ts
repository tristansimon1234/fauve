import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { skillPlan, skillLengths, toFrame } from "../skills.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { subjectsDrawn, objectsDrawn, clearsDrawn, readsDrawn } from "../subject.ts";
import { vlogVille, vlogRoles, vlogTitleFrame } from "./vlog-ville.ts";

// « Ta ville racontée » (vlog-ville.ts, docs/fiches/vlog-ville.md): its own checks, beside the skills' (features.test.ts).

/** The original's 30 cuts between its shots (images at 30 i/s), measured image by image (the bursts' pieces aside). */
const ORIGINAL_CUTS = [79, 115, 136, 160, 184, 257, 314, 328, 350, 374, 408, 459, 519, 537, 559, 581, 608, 633, 646, 709, 805, 848, 876, 897, 948, 1001, 1067, 1111, 1125, 1171];
/** Its subtitles as they change on its voice (the first two sentences word by word), its title. */
const ORIGINAL_WORDS: Record<string, [number, number]> = {
  accroche: [18, 53],
  ici: [53, 101],
  l1: [101, 166],
  l2: [166, 199],
  l3: [238, 323],
  l4: [323, 390],
  l5: [390, 477],
  l6: [477, 519],
  l7: [519, 601],
  l8: [601, 723],
  l9: [723, 805],
  l10: [805, 872],
  l11: [872, 948],
  l12: [948, 1067],
  l13: [1067, 1171],
  l14: [1171, 1255],
  nom: [199, 257],
};

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
/** Its Scene drawn at a frame with a plain tree for React: the kit's pieces as named nodes. */
function sceneOf(code: string) {
  let current = 0;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Flash: "Flash", useCurrentFrame: () => current };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const Scene = make(React, ...Object.values(scope));
  return (frame: number, props: Record<string, unknown>) => {
    current = frame;
    return Scene(props);
  };
}
const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const textOf = (node: Drawn): string => nodes(node).flatMap((n) => n.children.flat(Infinity).filter((c): c is string => typeof c === "string")).join("");
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;

const WORDS = {
  accroche: "Chaque quartier a son rythme",
  ici: "voici Belleville.",
  nom: "Belleville",
  signature: "par Café des Arts",
  genre: "un court-métrage.",
  l1: "ici rien ne va comme ailleurs",
  l2: "tout va à son rythme",
  l3: "être ici me fait sentir chez moi",
  l4: "l'odeur du café dès le matin",
  l5: "les gens qui montent la rue",
  l6: "tout le monde ensemble",
  l7: "le quartier s'allume le soir",
  l8: "les rues respirent, les gens passent",
  l9: "tant de vie qu'on s'y laisse emporter",
  l10: "ou on ralentit pour en profiter",
  l11: "chacun a sa journée à mener",
  l12: "on comprend qu'on est tous pareils",
  l13: "c'est pour ça qu'on s'y sent bien",
  l14: "au rythme de Belleville.",
};

/** The props its composition gets for n shots of one shape (width / height), its words at their moments. */
function propsFor(n: number, aspect: number, extra: Record<string, unknown> = {}) {
  const line = vlogVille.timeline(n, { end: false });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect, from: toFrame(s.start), durationInFrames: toFrame(s.end) - toFrame(s.start), kind: "video", segment: i }));
  const roles = Object.fromEntries(vlogVille.texts.map((t) => [t.slot, t.role]));
  const reelTexts = vlogVille.texts.map((t) => ({ text: WORDS[t.slot as keyof typeof WORDS], role: roles[t.slot], from: toFrame(line.texts[t.slot]!.from), to: toFrame(line.texts[t.slot]!.to), emphasis: [] }));
  const brand = { name: "Café des Arts", displayFont: "Unbounded", bodyFont: "Inter", accent: "#1f6b4f", palette: {} };
  return { width: 1080, height: 1920, durationInFrames: toFrame(line.duration), brand, shots, reelTexts, end: null, texts: marks, ...extra };
}

test("« Ta ville racontée » (v1): its 31 shots cut where its original's are, within an image at 76 BPM, its 41,8 s; fewer shots keep its film's parts", () => {
  assert.equal(vlogVille.version, 1);
  assert.equal(vlogVille.bpm, 76);
  assert.deepEqual(vlogVille.shots, [18, 31]);
  const line = vlogVille.timeline(31, { end: false });
  assert.equal(line.shots.length, 31);
  assert.equal(toFrame(line.duration), 1255);
  const cuts = line.shots.slice(1).map((s) => toFrame(s.start));
  cuts.forEach((c, i) => assert.ok(Math.abs(c - ORIGINAL_CUTS[i]!) <= 1, `cut ${i}: ${c} for ${ORIGINAL_CUTS[i]}`));
  // Its words at the original's moments, within an image: its first two sentences word by word, then a line a phrase.
  for (const [slot, [a, b]] of Object.entries(ORIGINAL_WORDS)) {
    const t = line.texts[slot]!;
    assert.ok(Math.abs(toFrame(t.from) - a) <= 1 && Math.abs(toFrame(t.to) - b) <= 1, `${slot}: ${t.from}–${t.to}`);
  }
  assert.equal(vlogTitleFrame(), 199);
  // The shots' wants are written for the filler; the opening keeps its own sound (the city under her first words).
  assert.ok(line.shots.every((s) => s.want.length > 30));
  assert.deepEqual(line.shots.map((s, i) => (s.sound ? i : -1)).filter((i) => i >= 0), [0]);
  // Fewer shots: 18 at least, each part of its film kept (its words and moments where they were), none over 3,7 s.
  for (const n of [18, 22, 26, 30]) {
    const fewer = vlogVille.timeline(n, { end: false });
    assert.equal(fewer.shots.length, n);
    assert.equal(fewer.duration, line.duration);
    assert.deepEqual(fewer.texts, line.texts);
    assert.ok(fewer.shots.every((s) => s.end - s.start <= 3.7), `${n}: ${Math.max(...fewer.shots.map((s) => s.end - s.start))} s`);
    // Its cuts are the original's, those left out aside; its roles named for its code.
    fewer.shots.slice(1).forEach((s) => assert.ok(ORIGINAL_CUTS.some((c) => Math.abs(c - toFrame(s.start)) <= 1), `${n}: ${s.start}`));
    const roles = vlogRoles(n).map((r) => r.role);
    assert.deepEqual(Object.keys(fewer.marks).filter((k) => /^r\d+$/.test(k)).map((k) => fewer.marks[k]), roles);
    for (const kept of [0, 1, 2, 5, 13, 14, 20, 30]) assert.ok(roles.includes(kept), `${n}: role ${kept} kept`);
  }
});

test("« Ta ville racontée » (v1): its music drops on her name and is muffled under her title; its card after it, its tempo moving its length", () => {
  const line = vlogVille.timeline(31, { end: false });
  const music = line.music!;
  // No music under her first words: it comes in on its downbeat with the burst (2,63 s, image 79).
  assert.ok(Math.abs(music.downbeat! - 79 / 30) < 0.005);
  assert.deepEqual(music.pauses, [{ from: 0, to: music.downbeat }]);
  // Muffled from just before the title to the next sentence (6,47 to 7,93 s), faded on its last image.
  assert.deepEqual(music.filters!.map((f) => [f.kind, toFrame(f.from), toFrame(f.to)]), [["muffled", 194, 238]]);
  assert.ok(Math.abs(music.end!.at - (line.duration - 1 / 30)) < 0.005 && music.end!.fade === 0.4);
  // An ending card: 1,6 s at least after its last sentence, on its last shot, within 45 s at its slowest tempo.
  const ended = vlogVille.timeline(31, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6 && ended.duration - line.duration < 1.7);
  assert.equal(ended.texts.l14!.to, line.texts.l14!.to);
  assert.ok(vlogVille.timeline(31, { end: true, bpm: 74 }).duration <= 45);
  // At another tempo all of it follows (its film is cut by ear: its length is its tempo's).
  const faster = vlogVille.timeline(31, { end: false, bpm: 90 });
  assert.ok(Math.abs(faster.duration - (line.duration * 76) / 90) < 0.05 && faster.marks.sc === Math.round((76 / 90) * 1000) / 1000);
  assert.ok(Math.abs(faster.music!.downbeat! - (79 / 30) * (76 / 90)) < 0.04);
  const { min, max } = skillLengths(vlogVille);
  assert.ok(min > 35 && max < 43.5, `${min}–${max}`);
});

test("« Ta ville racontée » (v1): its plan, its words in its slots, its music's shape, her opening's own sound, nothing cut out", () => {
  const files = Array.from({ length: 11 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 16, aspect: 16 / 9 }));
  const fill = { shots: Array.from({ length: 31 }, (_, i) => ({ file: files[i % files.length]!.id, at: Math.floor(i / files.length) * 5 })), texts: WORDS, end: null };
  const plan = skillPlan({ skill: vlogVille, name: "Ta ville racontée", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 31);
  assert.equal(plan.texts.length, vlogVille.texts.length);
  assert.deepEqual(plan.skill, { key: "vlog-ville", version: 1 });
  assert.equal(plan.tempo, 76);
  assert.deepEqual(plan.music_shape?.pauses, [{ from: 0, to: 2.633 }]);
  assert.equal(plan.music_shape?.filters?.[0]?.kind, "muffled");
  assert.equal(plan.sounds, undefined);
  // The city's sound under her first words only.
  assert.deepEqual(plan.segments.map((s, i) => ("sound" in s && s.sound ? i : -1)).filter((i) => i >= 0), [0]);
  // Its code cuts nobody out, follows nothing, reads nothing; no subtitles of the engine (its own lines).
  assert.equal(plan.layers![0]!.motion.drawn, undefined);
  assert.deepEqual([subjectsDrawn(vlogVille.code), objectsDrawn(vlogVille.code), clearsDrawn(vlogVille.code), readsDrawn(vlogVille.code)], [[], [], [], []]);
  assert.equal(plan.subtitles, false);
  assert.deepEqual(checkMotionCode(vlogVille.code), []);
  assert.ok(vlogVille.code.length < 24000, String(vlogVille.code.length));
  assert.deepEqual(vlogVille.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "horizontal", "vertical"]], ["couleur", ["sienne", "rouge"]]]);
});

test("« Ta ville racontée » (v1): 4:3 on black as her horizontal videos, full frame as her vertical ones; its burst of nine close-ups on the drop", () => {
  const draw = sceneOf(vlogVille.code);
  const picture = (tree: Drawn) => nodes(tree).find((n) => n.props.key === "picture")!;
  // Horizontal: a 1080 × 810 picture in the middle of the frame, on black; vertical: the whole frame; or as she asks.
  assert.deepEqual([styleOf(picture(draw(40, propsFor(31, 16 / 9)))).top, styleOf(picture(draw(40, propsFor(31, 16 / 9)))).height], [555, 810]);
  assert.deepEqual([styleOf(picture(draw(40, propsFor(31, 9 / 16)))).top, styleOf(picture(draw(40, propsFor(31, 9 / 16)))).height], [0, 1920]);
  assert.equal(styleOf(picture(draw(40, propsFor(31, 9 / 16, { texts: { ...propsFor(31, 9 / 16).texts, format: "horizontal" } })))).height, 810);
  const props = propsFor(31, 16 / 9);
  const footage = (f: number) => nodes(picture(draw(f, props))).filter((n) => n.type === "Footage");
  // Before the drop: her opening as filmed.
  assert.deepEqual(footage(60).map((n) => [n.props.shot, n.props.at]), [[0, undefined]]);
  // From the drop (image 79) to image 101: nine close-ups of her detail shot, 2 and 3 images each, each framed elsewhere.
  const origins: string[] = [];
  for (let f = 79; f < 101; f++) {
    const [n] = footage(f);
    assert.equal(n!.props.shot, 1);
    assert.match(String(styleOf(n!).transform), /scale\(1\.75\)/);
    origins.push(String(styleOf(n!).transformOrigin));
  }
  const runs = origins.reduce<number[]>((acc, o, i) => (i && o === origins[i - 1] ? [...acc.slice(0, -1), acc.at(-1)! + 1] : [...acc, 1]), []);
  assert.deepEqual(runs, [2, 3, 2, 3, 2, 3, 2, 3, 2]);
  assert.equal(new Set(origins).size, 9);
  // Then the same shot swept (a whip), blurred along its way.
  assert.ok(nodes(picture(draw(108, props))).some((n) => n.type === "feGaussianBlur" && n.props.stdDeviation === "34 0"));
  // One image burnt almost white in the shot looking up, as the original's image 930: a camera's flash over the picture.
  const flash = nodes(picture(draw(930, props))).find((n) => n.type === "Flash")!;
  assert.deepEqual([flash.props.at, flash.props.frames, flash.props.expose], [[930], 1, 3]);
  assert.ok(nodes(picture(draw(930, props))).some((n) => n.type === "Footage"));
  assert.equal(nodes(picture(draw(931, props))).filter((n) => n.type === "Flash").length, 0);
});

test("« Ta ville racontée » (v1): its night burst and its recall of the shots already seen, the first burst's close-ups in their order", () => {
  const draw = sceneOf(vlogVille.code);
  const props = propsFor(31, 16 / 9);
  const shotsAt = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => nodes(draw(from + k, props)).find((n) => n.type === "Footage")!.props.shot as number);
  // The night burst (images 537 to 581): her lights and her lively street in turns, never a shot of another part.
  const night = shotsAt(537, 581);
  assert.ok(night.every((s) => [13, 14, 15].includes(s)), night.join(" "));
  assert.ok(new Set(night).size === 3);
  // The recall (737 to 791): her signs and lights, the dark breath of her passing shot, the nine close-ups' first eight.
  const recall = shotsAt(737, 791);
  assert.ok(recall.includes(2) && recall.includes(1) && recall.includes(13) && recall.includes(14), recall.join(" "));
  const origin = (f: number) => String(styleOf(nodes(draw(f, props)).find((n) => n.type === "Footage")!).transformOrigin);
  const first = [79, 81, 84, 86, 89, 91, 94, 96].map(origin);
  const again = [763, 765, 768, 770, 773, 775, 778, 780].map(origin);
  assert.deepEqual(again, first);
  // A dark breath: her passing shot played again, dark.
  assert.ok(nodes(draw(680, props)).some((n) => n.type === "Footage" && n.props.shot === 2 && /brightness\(0\.3\)/.test(String(styleOf(n).filter))));
  // Fewer shots: the recalls of a shot left out play the one standing in for it.
  const fewer = propsFor(18, 16 / 9);
  const roles = vlogRoles(18).map((r) => r.role);
  const perspective = nodes(draw(700, fewer)).find((n) => n.type === "Footage")!.props.shot as number;
  assert.equal(roles[perspective], 2);
});

test("« Ta ville racontée » (v1): her name between quotes in big red capitals on her back, her signature above, its line under; subtitles in the safe zone", () => {
  const draw = sceneOf(vlogVille.code);
  const props = propsFor(31, 16 / 9);
  const fits = (f: number) => nodes(draw(f, props)).filter((n) => n.type === "FitText");
  // Half a second into her shot from behind, at once, to its cut; never before.
  assert.equal(fits(198).length, 0);
  const [name, signature, genre] = fits(199);
  assert.equal(textOf(name!), "”Belleville”");
  assert.equal((name!.props.innerStyle as Record<string, unknown>).textTransform, "uppercase");
  assert.equal(textOf(signature!), "par Café des Arts");
  assert.equal(textOf(genre!), "un court-métrage.");
  // In her colour when it is vivid, else a film title's red; small labels beside the name that reads.
  assert.ok([name, signature, genre].every((n) => (n!.props.innerStyle as Record<string, unknown>).color === "#1f6b4f"));
  const pale = propsFor(31, 16 / 9, { brand: { ...props.brand, accent: "#f2e9dc" } });
  assert.equal((nodes(draw(210, pale)).find((n) => n.type === "FitText")!.props.innerStyle as Record<string, unknown>).color, "#d7261e");
  // « rouge »: the original's red, whatever her colour.
  const red = propsFor(31, 16 / 9, { texts: { ...props.texts, couleur: "rouge" } });
  assert.ok(nodes(draw(210, red)).filter((n) => n.type === "FitText").every((n) => (n.props.innerStyle as Record<string, unknown>).color === "#d7261e"));
  assert.ok(nodes(signature!).some((n) => "data-fauve-accent" in n.props) && nodes(genre!).some((n) => "data-fauve-accent" in n.props));
  // Above, then the name, then the line, centred on her back in the middle of the picture, within x 140–940.
  const top = (n: Drawn) => Number(styleOf(n).top);
  assert.ok(top(signature!) < top(name!) && top(name!) < top(genre!));
  for (const n of [name, signature, genre]) assert.ok(Number(styleOf(n!).left) >= 140 && Number(styleOf(n!).left) + Number(styleOf(n!).width) <= 940);
  assert.ok(Math.abs(top(name!) + Number(styleOf(name!).height) / 2 - (555 + 0.48 * 810)) <= 2);
  // Gone with the cut on her next shot.
  assert.equal(fits(257).length, 0);
  // Its sentences: the first two word by word (one word at a time), the others whole, white at 48 px, nothing said under the title.
  const sub = (f: number) => {
    const s = nodes(draw(f, props)).find((n) => n.props.key === "sub");
    return s ? textOf(s) : null;
  };
  assert.equal(sub(19), "Chaque");
  assert.equal(sub(50), "rythme");
  assert.equal(sub(55), "voici");
  assert.equal(sub(95), "Belleville.");
  assert.equal(sub(120), WORDS.l1);
  assert.equal(sub(220), null);
  assert.equal(sub(250), WORDS.l3);
  assert.equal(sub(1240), WORDS.l14);
  const box = nodes(draw(250, props)).find((n) => n.props.key === "sub")!;
  const b = styleOf(box);
  assert.ok(Number(b.left) >= 140 && Number(b.left) + Number(b.width) <= 940 && Number(b.top) + Number(b.height) <= 1440, JSON.stringify(b));
  assert.equal((nodes(box)[1]!.props.style as Record<string, unknown>).fontSize, 48);
  // Its ending card: her name between quotes again, its words under it, no subtitle over it.
  const line = vlogVille.timeline(31, { end: true });
  const ended = { ...propsFor(31, 16 / 9), durationInFrames: toFrame(line.duration), end: { title: "Ouvert jusqu'à minuit", subtitle: "12 rue de Belleville", from: 1255 } };
  const card = nodes(draw(1270, ended)).filter((n) => n.type === "FitText").map(textOf);
  assert.deepEqual(card, ["”Belleville”", "Ouvert jusqu'à minuit", "12 rue de Belleville"]);
  assert.equal(nodes(draw(1270, ended)).find((n) => n.props.key === "sub"), undefined);
});

test("« Ta ville racontée » (v1): a voice laid over it is written in its subtitles' row, its first phrase word by word; its lines stay where nothing is said", () => {
  const draw = sceneOf(vlogVille.code);
  // A voice saying its first phrase from image 18, a pause, then two phrases, then nothing after image 120.
  const say = (w: string, from: number, to: number) => ({ w, from, to });
  const spoken = [say("Chaque", 18, 24), say("rue", 25, 32), say("a", 33, 36), say("son", 37, 42), say("pas.", 43, 52), say("Ici,", 70, 76), say("tout", 77, 84), say("va", 85, 90), say("vite", 91, 98)];
  const props = propsFor(31, 16 / 9, { spoken });
  const sub = (f: number) => {
    const s = nodes(draw(f, props)).find((n) => n.props.key === "sub");
    return s ? textOf(s) : null;
  };
  assert.equal(sub(20), "Chaque");
  assert.equal(sub(39), "son");
  assert.equal(sub(80), "Ici, tout va vite");
  // Where nothing is said, its own line (l3 from image 238); none of its own where the voice speaks.
  assert.equal(sub(250), WORDS.l3);
  assert.notEqual(sub(30), "Chaque quartier a son rythme");
});

test("« Ta ville racontée » (v1): a voice note laid on its plan reaches its code as spoken, the engine's subtitles stepping aside under it", async () => {
  const { buildReelProps } = await import("../motion.ts");
  const files = Array.from({ length: 11 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 16, aspect: 16 / 9 }));
  const fill = { shots: Array.from({ length: 31 }, (_, i) => ({ file: files[i % files.length]!.id, at: Math.floor(i / files.length) * 5 })), texts: WORDS, end: null };
  const plan = skillPlan({ skill: vlogVille, name: "Ta ville racontée", files, fill });
  // As a voice laid over a model would put it (chantier B): her voice note from the Reel's start, subtitled.
  const voiced = { ...plan, subtitles: true, voice: { media_id: "voice", at: 0 } };
  const words = [
    { w: "Chaque", start: 0.6, end: 0.8 },
    { w: "rue", start: 0.8, end: 1.0 },
    { w: "a", start: 1.0, end: 1.1 },
    { w: "son", start: 1.1, end: 1.3 },
    { w: "pas.", start: 1.3, end: 1.7 },
  ];
  const props = buildReelProps(voiced, {
    template: "libre",
    clipUrls: Object.fromEntries(files.map((f) => [f.id, `/${f.id}.mp4`])),
    photoIds: [],
    aspects: Object.fromEntries(files.map((f) => [f.id, f.aspect])),
    brand: { name: "Café des Arts" },
    voice: { src: "/voice.mp3", words },
  } as never);
  const layer = props.layers!.find((l) => l.compose)!;
  // Its code writes what is said (it reads spoken): the words, each at its frame; the engine's own subtitles step aside.
  assert.deepEqual(layer.spoken?.map((w) => [w.w, w.from]), words.map((w) => [w.w, Math.round(w.start * 30)]));
  assert.equal(layer.captionsStay, undefined);
});
