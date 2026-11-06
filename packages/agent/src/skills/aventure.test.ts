import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillFit, skillLengths, skillPlan, skillShotCount, skillTempos } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { aventure, aventureRoles } from "./aventure.ts";

// « Un an de plus » (aventure.ts, docs/fiches/aventure.md): its own checks, beside those every skill passes (features.test.ts).

/** Its shots' starts in images for a count, as its timeline lays them. */
const starts = (n: number, end = false, bpm?: number) => aventure.timeline(n, { end, ...(bpm ? { bpm } : {}) }).shots.map((s) => Math.round(s.start * 30));
/** How each shot comes in, by its index: its code's marks « t1 », « t2 »… (0, a cut). */
const kinds = (n: number) => {
  const line = aventure.timeline(n, { end: false });
  return line.shots.map((_, i) => line.marks[`t${i}`] ?? 0);
};

test("« Un an de plus » (v1): its tempo, its 44 shots at the original's lengths, 41 s at most (42,8 with its card), never past 45", () => {
  assert.equal(aventure.version, 2);
  assert.equal(aventure.bpm, 134.87);
  assert.deepEqual(aventure.shots, [20, 44]);
  assert.deepEqual(aventure.files, [8, 30]);
  // Its longest: the original's 51 shots less the seven that repeat another, 41,03 s; its card adds 1,78 s on its last shot.
  const most = aventure.timeline(44, { end: false });
  assert.equal(most.shots.length, 44);
  assert.ok(Math.abs(most.duration - 41.03) < 0.02, `${most.duration}`);
  assert.ok(Math.abs(aventure.timeline(44, { end: true }).duration - most.duration - 1.8) < 0.03);
  // Its cuts where the original's are, within two images, until the first shot it leaves out (the temple from the air,
  // the original's image 345): the dark covers, its counter's shot on the drop, the crowd, the whip, the smoke…
  assert.deepEqual(starts(44).slice(0, 15), [0, 10, 23, 37, 63, 97, 107, 123, 177, 210, 227, 264, 287, 317, 330]);
  const original = [0, 9, 23, 36, 62, 96, 106, 125, 176, 211, 226, 264, 287, 316, 332];
  starts(44).slice(0, 15).forEach((f, i) => assert.ok(Math.abs(f - original[i]!) <= 2, `shot ${i}: ${f} for ${original[i]}`));
  // Its last shot, the hugs, 2 s; the blow's four shots of one and two beats, its comeback's of three.
  const last = most.shots.at(-1)!;
  assert.ok(Math.abs(last.end - last.start - 2.0) < 0.02);
  // Its shortest: 20 shots, 20,4 s; never slower than 130 BPM, never faster than 140.
  assert.ok(Math.abs(aventure.timeline(20, { end: false }).duration - 20.37) < 0.02);
  assert.deepEqual(skillTempos(aventure), [130, 140]);
  const lengths = skillLengths(aventure);
  assert.ok(lengths.min > 19 && lengths.max <= 43, JSON.stringify(lengths));
  assert.ok(aventure.timeline(44, { end: true, bpm: 130 }).duration <= 45);
  // A Reel of 30 s: its own tempo, 29 shots.
  assert.deepEqual(skillFit(aventure, 30), { n: 29, bpm: 134.87 });
  // At another tempo, every length follows.
  const faster = aventure.timeline(30, { end: false, bpm: 140 });
  assert.ok(Math.abs(faster.duration / aventure.timeline(30, { end: false }).duration - 134.87 / 140) < 0.01);
});

test("« Un an de plus »: fewer shots leave out shots of its middle, never its opening, counter, plunge, blow, rising water, dissolve nor end", () => {
  // The roles it never leaves out: its opening's first and dark one, its counter and the crowd, its whip, its fabric,
  // its waterfall, under water and back in the open air, its blow's first and last, its comeback, its object and its
  // rising water, its profile and its light, its fast shot, its people and its last shot.
  const always = [0, 3, 4, 5, 7, 10, 15, 16, 18, 23, 26, 27, 30, 31, 34, 35, 37, 40, 41, 43];
  for (let n = 20; n <= 44; n++) {
    const roles = aventureRoles(n);
    assert.equal(roles.length, n);
    assert.deepEqual(roles, [...roles].sort((a, b) => a - b));
    for (const r of always) assert.ok(roles.includes(r), `${n}: role ${r}`);
    // Every cut stays on a quarter beat of its grid (lengths in quarter beats from its pickup of three quarters).
    const beat = 30 * (60 / 134.87);
    for (const f of starts(n).slice(1)) assert.ok(Math.abs(((f / beat - 0.75) * 4) - Math.round((f / beat - 0.75) * 4)) * (beat / 4) <= 1.01, `${n}: ${f}`);
  }
  assert.deepEqual(aventureRoles(20), always);
  // How its shots come in, at its longest: dark, the night, the powder, a whip, the smoke, a fabric, the plunge, the
  // rising water, the dissolve, a whip; every other one a cut.
  const k44 = kinds(44);
  const special = k44.map((k, i) => [i, k]).filter(([, k]) => k);
  assert.deepEqual(special, [[1, 1], [3, 2], [5, 3], [7, 5], [8, 4], [10, 6], [16, 7], [31, 8], [35, 9], [37, 5]]);
  // At its shortest, each kept with the shot it brings in (the smoke goes with the face out of it).
  assert.deepEqual(kinds(20).map((k, i) => [i, k]).filter(([, k]) => k), [[1, 2], [3, 3], [4, 5], [5, 6], [7, 7], [13, 8], [15, 9], [16, 5]]);
});

test("« Un an de plus »: its counter on the drop, a beat to take one more, three beats on screen; its music shaped as the original's", () => {
  const line = aventure.timeline(44, { end: false });
  // Its counter's shot is its fifth, from image 63 (the original's drop on its image 62), its number one more on 77
  // (76), gone on 103 (102).
  assert.equal(line.marks.counter_shot, 4);
  assert.equal(line.marks.tick, 77);
  assert.deepEqual(line.texts, { compteur: { from: 2.1, to: 3.43 } });
  assert.deepEqual([line.texts.compteur!.from, line.texts.compteur!.to].map((s) => Math.round(s * 30)), [63, 103]);
  assert.ok(Math.abs(line.marks.beat! - 13.346) < 0.01);
  // Its music: its first strong beat on the drop (the mix lays a bar line there), without its bass from half a beat in
  // until then (rising over its last quarter second), muffled from the plunge to the open air, its last shot without
  // its bass, faded over 0,3 s.
  const music = line.music!;
  assert.equal(music.downbeat, 2.1);
  assert.deepEqual(music.filters![0], { kind: "thin", from: 0.556, to: 2.1, open: 0.245 });
  const under = line.shots[16]!.start;
  const air = line.shots[18]!.start;
  assert.deepEqual(music.filters![1], { kind: "muffled", from: under, to: air });
  assert.deepEqual(music.filters![2], { kind: "thin", from: line.shots[43]!.start, to: line.duration });
  assert.deepEqual(music.end, { at: line.duration, fade: 0.3 });
  // Fewer shots: its counter on its own shot wherever it falls, the drop there too.
  const short = aventure.timeline(20, { end: false });
  assert.equal(short.marks.counter_shot, 2);
  assert.equal(short.music!.downbeat, short.texts.compteur!.from);
  assert.equal(short.music!.downbeat, short.shots[2]!.start);
  assert.equal(aventure.timeline(30, { end: false }).marks.counter_shot, 3);
  // No sound effect, no cut-out, no object: the original's are its music's.
  assert.equal(line.sounds, undefined);
  assert.equal(line.cutouts, undefined);
});

test("« Un an de plus »: its plan, her files in its slots, her counter at its moment, light to render", () => {
  const files = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, photo: i === 9, seconds: i === 9 ? 0 : 20 }));
  // Three passages a video, a photo one: 28 shots.
  assert.equal(skillShotCount(aventure, files), 28);
  const fill = { shots: Array.from({ length: 28 }, (_, i) => ({ file: files[i % 10]!.id, at: Math.floor(i / 10) * 6 })), texts: { compteur: "5 ans" }, end: null };
  const plan = skillPlan({ skill: aventure, name: "Un an de plus", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 28);
  assert.deepEqual(plan.texts.map((t) => [t.text, t.style]), [["5 ans", "hook"]]);
  assert.equal(plan.music_shape?.downbeat, plan.texts[0]!.from);
  assert.equal(plan.sounds, undefined);
  assert.equal(plan.layers![0]!.motion.drawn, undefined);
  assert.deepEqual(plan.skill, { key: "aventure", version: 2 });
  assert.deepEqual(aventure.reads, ["moves", "covered"]);
  // Nothing cut out, followed or cleared; only the light under its counter on the shots it can be on (its strong shot,
  // the third, fourth or fifth; then the next one).
  assert.deepEqual(checkMotionCode(aventure.code), []);
  assert.deepEqual([subjectsDrawn(aventure.code), objectsDrawn(aventure.code), clearsDrawn(aventure.code)], [[], [], []]);
  assert.deepEqual(readsDrawn(aventure.code), [2, 3, 4, 5].map((shot) => ({ shot, kinds: ["light"] })));
  assert.ok(aventure.code.length < 24000);
  assert.deepEqual(aventure.finish, { grain: 0, vignette: 0 });
  assert.deepEqual(aventure.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["vertical", "horizontal", "auto"]]]);
  assert.deepEqual(aventure.texts.map((t) => [t.slot, t.role, t.max, t.required]), [["compteur", "hook", 12, true]]);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { left: number; top: number; width: number; height: number };

/** interpolate as Remotion's, clamped (all its code uses). */
function interpolate(x: number, [a, b]: number[], [p, q]: number[]) {
  const t = Math.max(0, Math.min(1, (x - a!) / (b! - a!)));
  return p! + (q! - p!) * t;
}

/** Its Scene, run with a plain tree for React (no renderer): the kit's pieces as named nodes; `light`, each shot's (by its segment). */
function scene(light?: number | ((segment: number) => number)) {
  let current = 0;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const lit = (shot: { segment: number }) => (light === undefined ? null : typeof light === "number" ? light : light(shot.segment));
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Whip: "Whip",
    interpolate,
    LightUnder: (shot: { segment: number }) => (lit(shot) === null ? null : { mean: lit(shot), high: lit(shot) }),
    useCurrentFrame: () => current,
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${aventure.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
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
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Box & Record<string, unknown>;

/** Its props for a count: its shots as a composition gets them (of one shape), its marks, her counter in frames. */
function props(n: number, options: { aspect?: number; end?: boolean; settings?: Record<string, string>; text?: string } = {}) {
  const line = aventure.timeline(n, { end: Boolean(options.end) });
  const total = Math.round(line.duration * 30);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 9 / 16, from: Math.round(s.start * 30), durationInFrames: Math.round(s.end * 30) - Math.round(s.start * 30), kind: "video", segment: i }));
  const t = line.texts.compteur!;
  return {
    line,
    total,
    shots,
    p: {
      width: 1080,
      height: 1920,
      durationInFrames: total,
      brand: { name: "Farine", displayFont: "Bebas Neue", bodyFont: "Jost", accent: "#7a2e3b", palette: {} },
      shots,
      reelTexts: [{ text: options.text ?? "5 ans", role: "hook", from: Math.round(t.from * 30), to: Math.round(t.to * 30), emphasis: [] }],
      end: options.end ? { title: "Merci pour cette année", subtitle: "On se retrouve en janvier", from: total - 48 } : null,
      texts: { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...options.settings },
    },
  };
}
const counterAt = (draw: ReturnType<typeof scene>, f: number, p: Record<string, unknown>) =>
  nodes(draw(f, p)).filter((x) => x.type === "FitText" && String(x.props.key).startsWith("n"));
const textOf = (x: Drawn) => String(x.children[0]);

test("« Un an de plus » draws its counter: the number one less, one more a beat later, swelling three images, gone three beats after", () => {
  const draw = scene();
  const { p, line } = props(44);
  const from = Math.round(line.texts.compteur!.from * 30);
  const to = Math.round(line.texts.compteur!.to * 30);
  const tick = line.marks.tick!;
  // Not before its cut, nor at its end.
  assert.equal(counterAt(draw, from - 1, p).length, 0);
  assert.equal(counterAt(draw, to, p).length, 0);
  // Two lines: her word above, the number under; « 4 » first, « 5 » from the tick (hers: never invented).
  assert.deepEqual(counterAt(draw, from, p).map(textOf), ["4", "ans"]);
  assert.deepEqual(counterAt(draw, tick - 1, p).map(textOf), ["4", "ans"]);
  assert.deepEqual(counterAt(draw, tick, p).map(textOf), ["5", "ans"]);
  // Its number swells for three images after the tick, its word still; back to its size after.
  const scales = (f: number) => counterAt(draw, f, p).map((x) => String(styleOf(x).transform ?? "none"));
  assert.deepEqual(scales(tick), ["none", "none"]);
  assert.deepEqual([1, 2, 3].map((k) => scales(tick + k)[0]), ["scale(1.25)", "scale(1.35)", "scale(1.12)"]);
  assert.deepEqual([1, 2, 3].map((k) => scales(tick + k)[1]), ["none", "none", "none"]);
  assert.deepEqual(scales(tick + 4), ["none", "none"]);
  // White, translucent, no edge, in tall capitals 8 % of the frame's height, centred a little under its middle.
  const [top, bottom] = counterAt(draw, from + 2, p);
  assert.equal(styleOf(top!).opacity, 0.48);
  const inner = top!.props.innerStyle as Record<string, unknown>;
  assert.deepEqual([inner.color, inner.textTransform, inner.fontSize, inner.textShadow], ["#ffffff", "uppercase", 219, undefined]);
  assert.match(String(inner.fontFamily), /^'Bebas Neue'/);
  const a = styleOf(top!);
  const b = styleOf(bottom!);
  assert.ok(a.top < b.top && Math.abs((a.top + b.top + b.height) / 2 - 1920 * 0.527) < 4, `${a.top} ${b.top}`);
  // Inside the safe zone, swelled too: left of the apps' buttons (its boxes 590 wide, centred; 1,35 times: 797).
  for (const x of [a, b]) assert.ok(x.left >= 140 && x.left + x.width * 1.35 <= 1080 - 140 + (x.width * 0.35) / 2 && x.top >= 80 && x.top + x.height <= 1440, JSON.stringify(x));
  assert.ok(590 * 1.35 <= 800);
  // On a bright place (the light of the shot under it), in dark ink; white again over the next shot when it is dark.
  assert.equal((counterAt(scene(0.72), from + 2, p)[0]!.props.innerStyle as Record<string, unknown>).color, "#17130f");
  const flour = scene((segment) => (segment === 4 ? 0.72 : 0.2));
  assert.equal((counterAt(flour, from + 2, p)[0]!.props.innerStyle as Record<string, unknown>).color, "#17130f");
  assert.equal((counterAt(flour, to - 2, p)[0]!.props.innerStyle as Record<string, unknown>).color, "#ffffff");
  // A year, a season: the number before it, then hers; « 1 an » from 0; no number: her words swell on the beat.
  assert.deepEqual(counterAt(draw, from, props(44, { text: "2026" }).p).map(textOf), ["2025"]);
  assert.deepEqual(counterAt(draw, from, props(44, { text: "saison 3" }).p).map(textOf), ["saison", "2"]);
  assert.deepEqual(counterAt(draw, from, props(44, { text: "1 an" }).p).map(textOf), ["0", "an"]);
  const still = props(44, { text: "l'été" }).p;
  assert.deepEqual(counterAt(draw, from, still).map(textOf), ["l'été"]);
  assert.equal(styleOf(counterAt(draw, tick + 2, still)[0]!).transform, "scale(1.35)");
});

test("« Un an de plus » hides its cuts: covers made of her shots, its whips, the plunge, the rising water, the dissolve", () => {
  const draw = scene();
  const { p, shots } = props(44);
  const cut = (k: number) => shots[k]!.from;
  const covers = (f: number) => nodes(draw(f, p)).filter((x) => String(x.props.key).startsWith("c"));
  // Something dark passing on its first cut: a copy of the shot that comes, very dark, in at once, gone 6 images later.
  assert.equal(covers(cut(1) - 2).length, 0);
  const dark = covers(cut(1))[0]!;
  assert.equal(nodes(dark).find((x) => x.type === "Footage")!.props.shot, 1);
  assert.match(String(styleOf(nodes(dark)[1]!).filter), /brightness\(0\.2\)/);
  assert.equal(covers(cut(1) + 6).length, 0);
  // The powder: the colours of the counter's shot filling the lens over six images before the cut on the crowd.
  const fill = covers(cut(5) - 3)[0]!;
  assert.equal(nodes(fill).find((x) => x.type === "Footage")!.props.shot, 4);
  assert.ok(Number(styleOf(fill).opacity) > 0.3 && Number(styleOf(fill).opacity) < 1);
  assert.equal(styleOf(covers(cut(5))[0]!).opacity, 1);
  // The fabric of the shot that comes, right against the lens from its cut, leaving over twelve images.
  assert.equal(nodes(covers(cut(10))[0]!).find((x) => x.type === "Footage")!.props.shot, 10);
  assert.equal(covers(cut(10) + 13).length, 0);
  // A whip pan across its cut: four images before, four after, from the shot that goes to the one that comes.
  const whip = (f: number) => nodes(draw(f, p)).find((x) => x.type === "Whip");
  assert.equal(whip(cut(7) - 5), undefined);
  assert.equal(whip(cut(7) - 4)!.props.at, cut(7) - 4);
  assert.equal(whip(cut(7) + 3)!.props.frames, 8);
  assert.equal(whip(cut(7) + 4), undefined);
  // The plunge: the shot under water blurred and bright, sharp six images later.
  const under = (f: number) => nodes(draw(f, p)).find((x) => x.type === "Footage" && x.props.shot === 16)!;
  assert.match(String(styleOf(under(cut(16))).filter), /blur\(14\.0px\)/);
  assert.equal(styleOf(under(cut(16) + 6)).filter, undefined);
  // The rising water: the next shot over the one that goes, from the bottom, over its last four images.
  const risen = (f: number) => nodes(draw(f, p)).filter((x) => x.type === "Footage" && x.props.shot === 31)[0];
  assert.equal(risen(cut(31) - 5), undefined);
  assert.match(String(styleOf(risen(cut(31) - 4)!).maskImage), /to top, #000 11%, transparent 17%/);
  assert.match(String(styleOf(risen(cut(31) - 1)!).maskImage), /#000 57%/);
  // The dissolve: a second across its cut, the light at half on the cut.
  const light = (f: number) => nodes(draw(f, p)).find((x) => x.type === "Footage" && x.props.shot === 35);
  assert.equal(light(cut(35) - 16), undefined);
  assert.equal(styleOf(light(cut(35))!).opacity, 0.5);
  assert.equal(nodes(draw(cut(35) + 5, p)).filter((x) => x.type === "Footage" && x.props.shot === 34).length, 1);
  // Plain cuts elsewhere: her shot alone, full frame, as filmed.
  const plain = nodes(draw(cut(20) + 5, p)).filter((x) => x.type === "Footage");
  assert.deepEqual(plain.map((x) => [x.props.shot, styleOf(x)]), [[20, { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }]]);
});

test("« Un an de plus » (v2): full frame by default, its band on her word or as her videos, its ending card on its last shot held", () => {
  const draw = scene();
  // By default (Tristan, 6 November: « tout vertical please »), her videos in width full frame, cropped on their subject.
  const plain = props(30, { aspect: 16 / 9 });
  const at0 = Math.round(plain.line.texts.compteur!.from * 30);
  assert.deepEqual(styleOf(nodes(draw(at0 + 2, plain.p)).find((x) => x.type === "Footage")!), { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 });
  // On her word, or as her videos (« auto »), in width: whole in a 16:9 band on black, its counter in the band's middle,
  // bigger to read; full frame as she asks.
  const wide = props(30, { aspect: 16 / 9, settings: { format: "auto" } });
  assert.deepEqual(styleOf(nodes(draw(at0 + 2, props(30, { aspect: 16 / 9, settings: { format: "horizontal" } }).p)).find((x) => x.type === "Footage")!).height, 608);
  const from = Math.round(wide.line.texts.compteur!.from * 30);
  const band = nodes(draw(from + 2, wide.p)).find((x) => x.type === "Footage")!;
  assert.deepEqual(styleOf(band), { position: "absolute", left: 0, top: 0, width: 1080, height: 608 });
  const frameBox = nodes(draw(from + 2, wide.p)).find((x) => x.type === "div" && styleOf(x).top === 656);
  assert.ok(frameBox, "its frame at the band's place");
  const [top, bottom] = counterAt(draw, from + 2, wide.p);
  assert.ok(styleOf(top!).top > 656 - 80 && styleOf(bottom!).top + styleOf(bottom!).height < 656 + 608 + 80, `${styleOf(top!).top}`);
  assert.equal((top!.props.innerStyle as Record<string, unknown>).fontSize, Math.round((1920 * 0.045) / 0.7));
  const asked = props(30, { aspect: 16 / 9, settings: { format: "vertical" } });
  assert.deepEqual(styleOf(nodes(draw(from + 2, asked.p)).find((x) => x.type === "Footage")!), { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 });
  // Its ending card: on its last shot (held 1,8 s more), a little darker, her words in its capitals, a line under them.
  const ended = props(30, { end: true });
  const at = ended.total - 48;
  assert.equal(nodes(draw(at - 1, ended.p)).filter((x) => String(x.props.key).startsWith("e")).length, 0);
  const card = nodes(draw(at + 10, ended.p));
  assert.equal(card.filter((x) => x.type === "Footage").length, 1);
  const title = card.find((x) => String(x.props.key).startsWith("e1"))!;
  assert.equal(textOf(title), "Merci pour cette année");
  const box = styleOf(title);
  assert.ok(box.left === 140 && box.left + box.width === 940 && box.top + box.height <= 1440);
  assert.ok(card.some((x) => String(x.props.key).startsWith("e2")));
});
