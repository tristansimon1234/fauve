import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillFillInput, skillLengths, skillPlan } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { boutiqueSlots, enBoutique } from "./en-boutique.ts";

// « Création à quatre mains », the model (en-boutique.ts, version 1), on its original's fiche (docs/fiches/en-boutique.md).

const f = (s: number) => Math.round(s * 30);

test("« Création à quatre mains » (v1): its sections on its original's, 133,75 BPM, the sticker 31 images into the artisan's smile", () => {
  assert.equal(enBoutique.version, 1);
  assert.equal(enBoutique.bpm, 133.75);
  assert.deepEqual([enBoutique.shots, enBoutique.long, enBoutique.files, enBoutique.tempo], [[12, 22], 29, [4, 16], [114, 140]]);
  const line = enBoutique.timeline(29, { end: false });
  assert.equal(line.shots.length, 29);
  // Its idea in 10 beats (4,49 s; the original's 4,43), its six shots sharing it by their own lengths; the artisan then,
  // deadpan 62 images, smiling 76; the sticker 31 images into his smile, 66 images up (the original's 31 and 60).
  const starts = line.shots.map((s) => f(s.start));
  assert.deepEqual(starts.slice(0, 8), [0, 17, 37, 58, 81, 104, 135, 197]);
  assert.equal(line.marks.artisan, 135);
  assert.equal(line.marks.pop, 197 + 31);
  assert.equal(line.marks.out, 197 + 31 + 66);
  // Its passage behind the counter, its exchange, its gestures (1,6 s at most each), the result shown 103 images, the
  // tasting, its last wide shot 104 images with her logo 37 images into it.
  assert.equal(line.marks.echange, 273);
  assert.ok(line.marks.gestes! > line.marks.echange! && line.marks.resultat! > line.marks.gestes! && line.marks.degustation! === line.marks.resultat! + 103);
  const last = line.shots.at(-1)!;
  assert.equal(f(last.end - last.start), 104);
  assert.equal(line.marks.logo, f(last.start) + 37);
  assert.ok(Math.abs(line.duration - 43.8) < 0.02, String(line.duration));
  // Its words over their sections: her idea over the idea, her line on the artisan until the exchange, the sticker's
  // name and its line while it is up, the exchange, the gestures, the verdict from the result shown to the end.
  assert.deepEqual(Object.keys(line.texts), ["idee", "titre", "artisan", "avec", "echange", "gestes", "verdict"]);
  assert.deepEqual(line.texts.idee, { from: 0, to: 4.5 });
  assert.deepEqual(line.texts.titre, line.texts.avec);
  assert.equal(f(line.texts.titre!.from), line.marks.pop);
  assert.equal(line.texts.artisan!.to, line.texts.echange!.from);
  assert.equal(line.texts.verdict!.to, line.duration);
  // Each slot wants what an ordinary shop films, with what does when she has not filmed it.
  const wants = line.shots.map((s) => s.want);
  assert.match(wants[0]!, /^celle ou celui qui vient .*face caméra ; sinon/);
  assert.match(wants[6]!, /derrière son comptoir ou à son poste, face caméra, sérieux.*; sinon/);
  assert.match(wants[7]!, /un titre en autocollant surgit/);
  assert.ok(wants.every((w) => w.length > 20));
  // The shots where people speak keep their sound; the close-ups play under the music.
  assert.deepEqual(line.shots.filter((s) => s.sound).length, 17);
  assert.equal(line.shots[1]!.sound, undefined);
});

test("« Création à quatre mains »: its sounds and its music, as the original's (a boom, a pop and its sting, a whoosh, a bass drop)", () => {
  const line = enBoutique.timeline(22, { end: false });
  const sounds = line.sounds!;
  assert.deepEqual(sounds.map((s) => s.sound), ["deep cinematic boom hit", "cartoon pop with a bright comic sting", "quick soft whoosh", "deep 808 bass drop sliding down", "cartoon pop"]);
  // The boom as the artisan appears, the pop with the sticker, the whoosh as it goes, the drop on his tasting face, a pop with her logo.
  assert.equal(f(sounds[0]!.at), line.marks.artisan);
  assert.equal(f(sounds[1]!.at), line.marks.pop);
  assert.ok(Math.abs(f(sounds[2]!.at) - (line.marks.out! - 2)) <= 1);
  const g4 = boutiqueSlots(22).findIndex((s) => s.id === "g4");
  assert.equal(f(sounds[3]!.at), f(line.shots[g4]!.start) + 2);
  assert.equal(f(sounds[4]!.at), line.marks.logo);
  // Without its artisan's tasting face (its twelve shots keep it): no drop.
  assert.ok(boutiqueSlots(12).some((s) => s.id === "g4"));
  // Its music soft under the idea (her words lead), opened on the artisan's boom, which falls on a bar; faded at its end.
  const beat = 60 / 133.75;
  assert.deepEqual(line.music!.filters, [{ kind: "soft", from: 0, to: 4.5, db: -9 }]);
  assert.ok(Math.abs(line.music!.downbeat! - 2 * beat) < 0.002);
  assert.ok(Math.abs((4.5 - line.music!.downbeat!) / beat - 8) < 0.05, "the boom on a bar, two after its downbeat");
  assert.deepEqual(line.music!.end, { at: line.duration, fade: 0.25 });
  // With an ending card: its last shot longer by whole beats (1,6 s at least), her logo's pop on the card.
  const ended = enBoutique.timeline(22, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6);
  assert.equal(ended.texts.verdict!.to, Math.round((ended.duration - 1.6) * 100) / 100);
  assert.ok(Math.abs(ended.sounds!.at(-1)!.at - (ended.duration - 1.6)) < 0.01);
});

test("« Création à quatre mains »: 12 to 29 shots, its least needed first out, 24 to 44 s, never past 45 s", () => {
  const ids = (n: number) => boutiqueSlots(n).map((s) => s.id);
  assert.deepEqual(ids(12), ["a1", "a2", "a6", "b1", "b2", "d1", "e1", "e6", "f1", "g1", "g4", "g8"]);
  assert.deepEqual(ids(22), ["a1", "a2", "a4", "a6", "a7", "b1", "b2", "d1", "e1", "e3", "e6", "e8", "e9", "e10", "e11", "e12", "f1", "g1", "g4", "g5", "g6", "g8"]);
  assert.equal(ids(29).length, 29);
  assert.deepEqual(ids(5), ids(12));
  for (let n = 12; n <= 29; n++) {
    for (const end of [false, true]) {
      for (const bpm of [114, 133.75, 140]) {
        const line = enBoutique.timeline(n, { end, bpm });
        assert.equal(line.shots.length, n);
        assert.ok(line.duration <= 45, `${n} shots at ${bpm}: ${line.duration} s`);
        // Its marks in order, its texts each with a span.
        const m = line.marks;
        assert.ok(m.artisan! < m.pop! && m.pop! < m.out! && m.echange! < m.gestes! && m.gestes! < m.resultat! && m.resultat! < m.degustation! && m.degustation! < m.logo!, `${n} ${bpm}`);
        for (const [slot, t] of Object.entries(line.texts)) assert.ok(t.to > t.from, `${slot} at ${n}`);
      }
    }
  }
  // Its lengths: 24,4 s at its fewest, 36,1 s from her files at most (22 shots), 43,8 s for a length she asks for.
  assert.ok(Math.abs(enBoutique.timeline(12, { end: false }).duration - 24.4) < 0.02);
  assert.ok(Math.abs(enBoutique.timeline(22, { end: false }).duration - 36.07) < 0.02);
  assert.deepEqual(skillLengths(enBoutique), { min: 23.3, max: 45 });
  // At another tempo, every length counted in beats follows it.
  const own = enBoutique.timeline(16, { end: false });
  const fast = enBoutique.timeline(16, { end: false, bpm: 140 });
  assert.ok(Math.abs(fast.duration / own.duration - 133.75 / 140) < 0.01);
  assert.ok(Math.abs(fast.marks.pop! / own.marks.pop! - 133.75 / 140) < 0.02);
});

test("« Création à quatre mains »: its plan subtitled for what is said in her shots, nothing cut out nor followed, its own font", () => {
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 14 }));
  const line = enBoutique.timeline(16, { end: false });
  const fill = { shots: line.shots.map((_, i) => ({ file: files[i % 8]!.id, at: Math.floor(i / 8) * 4 })), texts: WORDS, end: null };
  const plan = skillPlan({ skill: enBoutique, name: "Création à quatre mains", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(plan.texts.map((t) => t.style), ["hook", "band", "caption", "caption", "caption", "caption", "caption"]);
  assert.deepEqual(plan.skill, { key: "en-boutique", version: 1 });
  assert.equal(plan.tempo, 133.75);
  // What is said in her shots is written by its code (the engine's subtitles step aside).
  assert.equal(enBoutique.spoken, "own");
  assert.equal(plan.subtitles, true);
  assert.equal(plan.layers![0]!.motion.writes_spoken, true);
  assert.deepEqual(plan.layers![0]!.motion.fonts, ["Paytone One"]);
  // Nothing of her cut out (declared: the engine reads no cut-out for it).
  assert.deepEqual(plan.layers![0]!.motion.drawn, { shots: 16, subjects: [] });
  assert.equal(plan.sounds?.length, 5);
  assert.deepEqual(checkMotionCode(enBoutique.code), []);
  assert.deepEqual([subjectsDrawn(enBoutique.code), objectsDrawn(enBoutique.code), clearsDrawn(enBoutique.code), readsDrawn(enBoutique.code)], [[], [], [], []]);
  assert.ok(enBoutique.code.length < 24000);
  assert.deepEqual(enBoutique.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]]]);
  // Its filler: its slots, their places, and that what she says in her videos is its subtitles.
  const input = skillFillInput({ skill: enBoutique, name: "Création à quatre mains", n: 16, files, business: { name: "Chez Léa" }, request: "" });
  assert.match(String(input.ses_paroles), /sous-titres/);
  assert.deepEqual(input.textes.map((t) => [t.slot, t.max_caracteres, t.obligatoire]), [["idee", 72, true], ["titre", 22, true], ["artisan", 52, false], ["avec", 22, false], ["echange", 56, false], ["gestes", 110, true], ["verdict", 100, true]]);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };
type Said = { w: string; from: number; to: number };

const WORDS: Record<string, string> = {
  idee: "L'idée : une pizza avec mes légumes !",
  titre: "Pizza du marché",
  artisan: "Marco ne sourit jamais… / Ah si, je l'ai eu !",
  avec: "avec Léa & Marco",
  echange: "Je pensais à tes tomates / — Vas-y, dis-moi !",
  gestes: "— D'abord la sauce / — Pas trop de mozza / Ça sent déjà bon !",
  verdict: "Et voilà la pizza du marché ! / — Waouh ! / Je la trouve très bonne / Bon appétit !",
};
const ROLE: Record<string, string> = { idee: "hook", titre: "band", artisan: "caption", avec: "caption", echange: "caption", gestes: "caption", verdict: "caption" };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function drawAt(frame: number, options: { n?: number; aspect?: number; words?: Record<string, string>; brand?: Record<string, unknown>; end?: { title: string; subtitle?: string } | null; spoken?: Said[]; texts?: Record<string, string> } = {}): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (make: () => unknown) => make() };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", Img: "Img", useCurrentFrame: () => frame };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${enBoutique.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  const line = enBoutique.timeline(options.n ?? 16, { end: Boolean(options.end) });
  const marks = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const durationInFrames = f(line.duration);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 9 / 16, from: f(s.start), durationInFrames: f(s.end - s.start), kind: "video", segment: i }));
  const words = options.words ?? WORDS;
  const reelTexts = Object.entries(words)
    .filter(([, w]) => w)
    .map(([slot, text]) => ({ text, role: ROLE[slot]!, from: f(line.texts[slot]!.from), to: f(line.texts[slot]!.to), emphasis: [] }));
  const brand = { name: "Chez Léa", displayFont: "Paytone One", bodyFont: "Figtree", ...options.brand };
  const end = options.end ? { ...options.end, from: f(line.duration - 1.6) } : null;
  return make(React, ...Object.values(scope))({ width: 1080, height: 1920, durationInFrames, brand, shots, reelTexts, end, texts: { ...marks, ...options.texts }, ...(options.spoken ? { spoken: options.spoken } : {}) });
}

const nodes = (node: unknown): Drawn[] => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("children" in node)) return [];
  const n = node as Drawn;
  return [n, ...n.children.flatMap(nodes)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, number | string>;
const own = (node: Drawn): string => (node.children.flat(Infinity) as unknown[]).flatMap((c) => (typeof c === "string" ? [c] : c && typeof c === "object" && "children" in c ? [own(c as Drawn)] : [])).join(" ").replace(/\s+/g, " ").trim();
/** Its subtitle at a frame: the FitText keyed « sub- », its text and its colour. */
const subtitle = (tree: Drawn) => {
  const s = nodes(tree).find((n) => n.type === "FitText" && String(n.props.key).startsWith("sub-"));
  return s ? { text: own(s), color: (s.props.innerStyle as Record<string, string>).color, box: styleOf(s) as unknown as Box } : null;
};
/** The subtitles shown over a span of frames, each with the frames it holds. */
function shown(from: number, to: number, options: Parameters<typeof drawAt>[1] = {}): { text: string; color: string; from: number; to: number }[] {
  const out: { text: string; color: string; from: number; to: number }[] = [];
  for (let k = from; k < to; k++) {
    const s = subtitle(drawAt(k, options));
    const text = s?.text ?? "";
    const last = out[out.length - 1];
    if (last && last.text === text && last.to === k) last.to = k + 1;
    else out.push({ text, color: s?.color ?? "", from: k, to: k + 1 });
  }
  return out;
}
const sticker = (tree: Drawn, key = "title") => nodes(tree).find((n) => n.props.key === key) ?? null;

test("« Création à quatre mains » writes its lines as the subtitles of two voices: groups of one to three words, the artisan's in yellow", () => {
  const line = enBoutique.timeline(16, { end: false });
  // Her idea from the first image, cut as a creator subtitles it, its punctuation shown, a mark set apart the French
  // way kept with its word.
  const idea = shown(0, line.marks.artisan!).map((g) => g.text);
  assert.deepEqual(idea, ["L'idée :", "une pizza avec mes légumes !"]);
  // A group of three pieces or more held as the scene check reads it (0,8 s plus 0,3 s a word, at 80 %), two words 13 images.
  const reading = (g: { text: string; from: number; to: number }) => {
    const words = g.text.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    return g.text.split(" ").length < 3 || (g.to - g.from) / 30 >= 0.8 * Math.max(1.2, 0.8 + 0.3 * words);
  };
  for (const [a, b] of [[0, line.marks.artisan!], [line.marks.artisan!, line.marks.echange!], [line.marks.gestes!, line.marks.resultat!], [line.marks.resultat!, f(line.duration)]] as const) {
    for (const g of shown(a, b).filter((x) => x.text)) assert.ok(reading(g), JSON.stringify(g));
  }
  // A comma always a change; its last word kept with the group before it when they read together.
  assert.deepEqual(shown(line.marks.artisan!, line.marks.echange!).map((g) => g.text).filter(Boolean), ["Marco ne sourit jamais…", "Ah si,", "je l'ai eu !"]);
  // White for hers, the second colour (the original's yellow) for the artisan's, the lines beginning with « — ».
  const talk = shown(line.marks.echange!, line.marks.gestes!);
  assert.deepEqual(talk.map((g) => [g.text, g.color]), [["Je pensais à tes tomates", "#ffffff"], ["Vas-y,", "#f7ce18"], ["dis-moi !", "#f7ce18"]]);
  const gestures = shown(line.marks.gestes!, line.marks.resultat!);
  assert.deepEqual(gestures.map((g) => [g.text, g.color]), [["D'abord la sauce", "#f7ce18"], ["Pas trop de mozza", "#f7ce18"], ["Ça sent déjà bon !", "#ffffff"]]);
  assert.deepEqual(shown(line.marks.resultat!, f(line.duration)).map((g) => g.text), ["Et voilà la pizza", "du marché !", "Waouh !", "Je la trouve", "très bonne", "Bon appétit !"]);
  // Her colour for the artisan's lines when it reads on any picture; else the original's yellow.
  assert.equal(shown(line.marks.gestes!, line.marks.gestes! + 2, { brand: { accent: "#9be7ff" } })[0]!.color, "#9be7ff");
  // Its subtitle: her text font in heavy weight, 58 px, its bottom at 66,8 % of the height, centred between x 140 and 940.
  const s = subtitle(drawAt(10))!;
  assert.deepEqual(s.box, { position: "absolute", left: 140, width: 800, top: 1283 - 133, height: 133 } as unknown as Box);
  // While the sticker is up, lower (its bottom at 73,5 %), always above the bottom quarter.
  const under = subtitle(drawAt(line.marks.pop! + 5))!;
  assert.equal(under.box.top + under.box.height, Math.round(1920 * 0.735));
  assert.ok(under.box.top + under.box.height <= 1440);
  // Every text whole in the page while it shows (the groups not seen hidden), so the check finds it.
  const page = (tree: Drawn) => nodes(tree).map(own).join(" ").replace(/\s+/g, "");
  assert.ok(page(drawAt(30)).includes(WORDS.idee!.replace(/\s+/g, "")));
});

test("« Création à quatre mains »: its sticker pops over the artisan with a bounce, its name on two lines, who makes it under it, then pops off", () => {
  const line = enBoutique.timeline(16, { end: false });
  const pop = line.marks.pop!;
  const out = line.marks.out!;
  assert.equal(sticker(drawAt(pop - 1)), null);
  // In: 0,55 blurred, then 1,04, 1,08, 1,03, 1; tilted 5,5° rising to the right; off: 0,75, then 0,42, then gone.
  const scale = (k: number) => {
    const s = sticker(drawAt(k))!;
    const t = String(styleOf(s).transform);
    return [Number(/scale\(([\d.]+)\)/.exec(t)![1]), /rotate\(-5\.5deg\)/.test(t), styleOf(s).filter];
  };
  assert.deepEqual([pop, pop + 1, pop + 2, pop + 3, pop + 4].map(scale), [[0.55, true, "blur(7px)"], [1.04, true, "blur(3px)"], [1.08, true, "none"], [1.03, true, "none"], [1, true, "none"]]);
  assert.deepEqual([out - 2, out - 1].map(scale), [[0.75, true, "blur(4px)"], [0.42, true, "blur(6px)"]]);
  assert.equal(sticker(drawAt(out)), null);
  // A white card 800 px wide (x 140 to 940), its black block behind its lower left, its name in the sticker's face.
  const card = sticker(drawAt(pop + 10))!;
  assert.deepEqual([styleOf(card).left, styleOf(card).width], [140, 800]);
  const texts = nodes(card).filter((n) => n.type === "FitText");
  assert.deepEqual(texts.map(own), ["Pizza du marché", "avec Léa & Marco"]);
  const name = texts[0]!;
  // Two lines, never one ending on a small word (« PIZZA » / « DU MARCHÉ »), yellow with a black 3D shadow down-left.
  assert.deepEqual(name.children.flat(Infinity).filter((c) => c && typeof c === "object").map((c) => own(c as Drawn)), ["Pizza", "du marché"]);
  const type = name.props.innerStyle as Record<string, string | number>;
  assert.equal(String(type.fontFamily).split(",")[0], "'Paytone One'");
  assert.equal(type.color, "#fcc83b");
  assert.match(String(type.textShadow), /^-1px 1px 0 #141414, .* -7px 8px 0 #141414$/);
  assert.equal(type.textTransform, "uppercase");
  // Who makes it: 48 px, black capitals.
  assert.deepEqual([(texts[1]!.props.innerStyle as Record<string, number>).fontSize, (texts[1]!.props.innerStyle as Record<string, string>).color], [48, "#141414"]);
  // Her colour for the name when it is bright and vivid enough; a dark one keeps the original's yellow.
  const coloured = (accent: string) => (nodes(sticker(drawAt(pop + 10, { brand: { accent } }))!).find((n) => n.type === "FitText")!.props.innerStyle as Record<string, string>).color;
  assert.equal(coloured("#e8417a"), "#e8417a");
  assert.equal(coloured("#1d2a44"), "#fcc83b");
  // Without its line: the card alone with its name.
  assert.equal(nodes(sticker(drawAt(pop + 10, { words: { ...WORDS, avec: "" } }))!).filter((n) => n.type === "FitText").length, 1);
});

test("« Création à quatre mains »: what is really said in her shots is written where it is said, its own lines elsewhere", () => {
  const line = enBoutique.timeline(16, { end: false });
  // Her words in her exchange's shot: they take the place of its lines there, two to four at a time, in white.
  const at = line.marks.echange! + 4;
  const said: Said[] = ["Bon,", "Marco,", "on", "commence", "par", "quoi", "?"].map((w, k) => ({ w, from: at + k * 7, to: at + k * 7 + 5 }));
  const talk = shown(line.marks.echange!, line.marks.gestes!, { spoken: said }).filter((g) => g.text);
  assert.deepEqual(talk.map((g) => [g.text, g.color]), [["Bon,", "#ffffff"], ["Marco,", "#ffffff"], ["on commence par quoi", "#ffffff"], ["?", "#ffffff"]]);
  assert.equal(talk[0]!.from, at);
  // Elsewhere, where nobody speaks, its own lines as before.
  assert.deepEqual(shown(0, 20, { spoken: said }).map((g) => g.text), ["L'idée :"]);
  assert.deepEqual(shown(line.marks.gestes!, line.marks.gestes! + 20, { spoken: said }).map((g) => g.text), ["D'abord la sauce"]);
});

test("« Création à quatre mains »: her logo pops over the last shot, else her name; her ending card in its place; all in the safe zone", () => {
  const line = enBoutique.timeline(16, { end: false });
  const logo = line.marks.logo!;
  // Without her logo: her name in the sticker's letters on a smaller card, from its moment to the end.
  assert.equal(sticker(drawAt(logo - 1), "name"), null);
  const named = sticker(drawAt(logo + 6), "name")!;
  assert.deepEqual(nodes(named).filter((n) => n.type === "FitText").map(own), ["Chez Léa"]);
  // With her logo: her logo on a white card.
  const withLogo = sticker(drawAt(logo + 6, { brand: { logoUrl: "/logo.png" } }), "logo")!;
  assert.ok(nodes(withLogo).some((n) => n.type === "Img"));
  // Her ending card in its place: its title and its line, the card's 48 px at least.
  const ended = enBoutique.timeline(16, { end: true });
  const from = f(ended.duration - 1.6);
  const card = sticker(drawAt(from + 6, { end: { title: "Ouvert dimanche", subtitle: "de 10 h à 18 h" } }), "end")!;
  assert.deepEqual(nodes(card).filter((n) => n.type === "FitText").map(own), ["Ouvert dimanche", "de 10 h à 18 h"]);
  // Every word to read between x 140 and 940 and above the bottom quarter, its stickers included, in both formats.
  for (const aspect of [9 / 16, 16 / 9]) {
    for (let k = 0; k < f(line.duration); k += 9) {
      const tree = drawAt(k, { aspect });
      for (const t of nodes(tree).filter((n) => n.type === "FitText")) {
        const b = styleOf(t) as unknown as Box;
        const inCard = !String(t.props.key).startsWith("sub-") && !String(t.props.key).startsWith("x");
        if (inCard) continue;
        assert.ok(b.top >= 80 && b.top + b.height <= 1440 && b.left >= 140 && b.left + b.width <= 940, `${own(t)} at ${k}: ${JSON.stringify(b)}`);
      }
      for (const key of ["title", "name"]) {
        const s = sticker(tree, key);
        if (!s) continue;
        const b = styleOf(s) as unknown as Box;
        assert.ok(b.left >= 140 && b.left + b.width <= 940 && b.top >= 80 && b.top + b.height <= 1440, `${key} at ${k}`);
      }
    }
  }
  // Her videos upright: full frame; in width, whole in a 16:9 band on black, its subtitles under it; as she asks.
  const box = (tree: Drawn) => styleOf(nodes(tree).find((n) => n.children.some((c) => (c as Drawn)?.type === "Footage"))!);
  assert.deepEqual([box(drawAt(20)).top, box(drawAt(20)).height], [0, 1920]);
  assert.deepEqual([box(drawAt(20, { aspect: 16 / 9 })).top, box(drawAt(20, { aspect: 16 / 9 })).height], [656, 608]);
  assert.equal(box(drawAt(20, { aspect: 16 / 9, texts: { format: "vertical" } })).height, 1920);
  assert.equal(subtitle(drawAt(20, { aspect: 16 / 9 }))!.box.top + 133, Math.round(1920 * 0.735));
});
