import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { skillFit, skillLengths, skillPlan, skillShotCount, skillTempos } from "../skills.ts";
import { clearsDrawn, objectsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { routine, routineFlashes, routineSections } from "./routine.ts";

// « Rituel du matin » (routine.ts, docs/fiches/routine.md): its own checks, beside those every skill passes (features.test.ts).

/** The original's lengths in images, as its fiche measures them (30 i/s): its trailer, its ritual's 22 gestures, its overhead, its place. */
const TRAILER = 62;
const RITUAL = [23, 27, 36, 31, 25, 11, 28, 27, 29, 28, 23, 48, 28, 23, 36, 28, 29, 27, 30, 34, 27, 30];
const PLACE = [44, 37, 45, 38, 43, 40, 34, 46, 54, 76, 77];

/** Its shots' lengths in images for a count, as its timeline lays them. */
const images = (n: number, end = false, bpm?: number) => routine.timeline(n, { end, ...(bpm ? { bpm } : {}) }).shots.map((s) => Math.round(s.end * 30) - Math.round(s.start * 30));

test("« Rituel du matin » (v1): its tempo, its trailer of 2,07 s, its gestures and its place at the original's lengths, its sections for each count", () => {
  assert.equal(routine.version, 1);
  assert.equal(routine.bpm, 90.73);
  // Its shortest: the trailer, six gestures, what she made from above, four shots of her place; 15,9 s.
  const short = routine.timeline(12, { end: false });
  assert.equal(short.shots.length, 12);
  assert.ok(Math.abs(short.duration - 15.9) < 0.05, `${short.duration}`);
  const cut = images(12);
  // Each length the original's within an image: its trailer, its first gesture (the bowl set down), its quick one (a
  // strawberry, 11 images), its long pour (48), its result (30), its overhead (42), its sign (44); its last shot carries
  // the three black images.
  assert.deepEqual(cut.slice(0, 8), [62, 23, 11, 28, 48, 34, 30, 42]);
  assert.deepEqual(cut.slice(8), [44, 37, 38, 77 + 3]);
  // Its sections: the ritual and the place grow together, the rest of her day only past 29 shots.
  assert.deepEqual([12, 16, 22, 29, 30, 33].map((n) => Object.values(routineSections(n)).map((s) => s.length)), [[6, 4, 0], [7, 7, 0], [10, 10, 0], [16, 11, 0], [16, 11, 1], [16, 11, 4]]);
  // Its ritual keeps its start, its quick gesture, its long pour and its result whatever the count; its place its sign first.
  for (const n of [12, 18, 24, 33]) {
    const { ritual, place } = routineSections(n);
    assert.equal(ritual[0], 0);
    assert.equal(ritual.at(-1), 15);
    assert.ok(ritual.includes(3) && ritual.includes(8), `${n}: ${ritual}`);
    assert.equal(place[0], 0);
    assert.equal(place.at(-1), 10);
  }
  // Its longest from her files alone: 22 shots, about 30 s; for a length she asks for, up to 33 (42,2 s, 43,7 with its card).
  assert.ok(Math.abs(routine.timeline(22, { end: false }).duration - 30.23) < 0.05);
  assert.ok(Math.abs(routine.timeline(33, { end: false }).duration - 42.17) < 0.05);
  assert.ok(routine.timeline(33, { end: true }).duration <= 45);
  // At its 16 gestures and 11 shots of her place, every gesture and shot kept at the original's length.
  const full = images(29);
  assert.equal(full[0], TRAILER);
  const kept = [0, 2, 3, 5, 6, 7, 8, 10, 11, 12, 14, 17, 18, 19, 20, 21].map((i) => RITUAL[i]!);
  assert.deepEqual(full.slice(1, 17), kept);
  assert.equal(full[17], 42);
  assert.deepEqual(full.slice(18, 28), PLACE.slice(0, 10));
  assert.equal(full[28], PLACE[10]! + 3);
});

test("« Rituel du matin »: its trailer's flashes, each a shot to come seen early from its middle, in the Reel's order", () => {
  // Its first shot's own moment, then 12 flashes; its pour and its overhead among them.
  for (const n of [12, 16, 22, 33]) {
    const line = routine.timeline(n, { end: false });
    const marks = line.marks;
    const shots = Array.from({ length: 13 }, (_, k) => marks[`f${k}`]!);
    const offsets = Array.from({ length: 13 }, (_, k) => marks[`o${k}`]!);
    assert.equal(shots[0], 0);
    assert.equal(offsets[0], 0);
    // In the Reel's order after its first; every shot one of the Reel's, and each offset leaves five images of it.
    for (let k = 1; k < 13; k++) {
      assert.ok(shots[k]! >= shots[k - 1]! && shots[k]! > 0 && shots[k]! < n, `${n}: ${shots}`);
      const frames = Math.round(line.shots[shots[k]!]!.end * 30) - Math.round(line.shots[shots[k]!]!.start * 30);
      assert.ok(offsets[k]! >= 0 && offsets[k]! <= frames - 5, `${n} flash ${k}: ${offsets[k]} of ${frames}`);
    }
    const { ritual } = routineSections(n);
    const pour = 1 + ritual.indexOf(8);
    const served = 1 + ritual.length;
    assert.ok(shots.includes(pour) && shots.includes(served), `${n}: ${shots}`);
    // Enough shots to come: a different shot each.
    if (n >= 14) assert.equal(new Set(shots).size, 13, `${n}: ${shots}`);
  }
  // Too few shots to come: her other gestures, then a shot again at another moment.
  const roles = [{ kind: "trailer" as const }, ...Array.from({ length: 3 }, () => ({ kind: "ritual" as const })), { kind: "ritual" as const, long: true }, { kind: "served" as const }, { kind: "place" as const }, { kind: "place" as const }];
  const flashes = routineFlashes(roles, roles.map(() => 40));
  assert.equal(flashes.length, 13);
  assert.deepEqual(flashes.slice(0, 1), [{ shot: 0, offset: 0 }]);
  const again = flashes.filter((f) => f.shot === 6);
  assert.ok(again.length >= 2 && new Set(again.map((f) => f.offset)).size === again.length, JSON.stringify(flashes));
  // The original's trailer: 2,07 s, its flashes cut on its images (0, 5, 9, 14…), its title to its cut, her line from image 28.
  const line = routine.timeline(16, { end: false });
  assert.equal(line.marks.trailer_to, 62);
  assert.equal(line.marks.line_at, 28);
  assert.deepEqual(line.texts, { titre: { from: 0, to: 2.07 }, ligne: { from: 0.93, to: 2.07 } });
  assert.equal(line.marks.black, Math.round(line.duration * 30) - 3);
});

test("« Rituel du matin »: its music on the original's grid, cut dead with the last image; at another tempo, all of it follows", () => {
  const line = routine.timeline(16, { end: false });
  assert.deepEqual(line.music, { downbeat: 0.214, end: { at: line.duration, fade: 0.012 } });
  assert.equal(line.sounds, undefined);
  assert.equal(line.cutouts, undefined);
  // Faster (a shorter Reel): its lengths and its trailer follow; its title's moments too.
  const faster = routine.timeline(16, { end: false, bpm: 109 });
  assert.ok(Math.abs(faster.duration / line.duration - 90.73 / 109) < 0.01, `${faster.duration}`);
  assert.ok(Math.abs(faster.marks.trailer_to! / 62 - 90.73 / 109) < 0.03);
  assert.ok(Math.abs(faster.music!.downbeat! - 0.214 * (90.73 / 109)) < 0.002);
  // With an ending card: its 1,6 s at least on the black instead of the three black images, the music ending with it.
  const ended = routine.timeline(16, { end: true });
  assert.ok(ended.duration - line.duration >= 1.6 - 0.1 - 1 / 30);
  assert.equal(ended.marks.black, undefined);
  assert.equal(ended.music!.end!.at, ended.duration);
  // Never slower than 89 BPM: its longest stays under 45 s, its card included; up to 109 for a short Reel.
  assert.deepEqual(skillTempos(routine), [89, 109]);
  assert.ok(skillLengths(routine).max <= 45);
  assert.ok(routine.timeline(33, { end: true, bpm: 89 }).duration <= 45);
  assert.deepEqual(skillFit(routine, 30), { n: 22, bpm: 90.73 });
});

test("« Rituel du matin »: its plan, her files in its slots, her words at their moments, its music shaped, light to render", () => {
  const files = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, photo: i === 5, seconds: i === 5 ? 0 : 30 }));
  assert.equal(skillShotCount(routine, files), 16);
  const fill = { shots: Array.from({ length: 16 }, (_, i) => ({ file: files[i % 6]!.id, at: Math.floor(i / 6) * 8 })), texts: { titre: "un matin au fournil", ligne: "fournil + café crème" }, end: null };
  const plan = skillPlan({ skill: routine, name: "Rituel du matin", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 16);
  assert.deepEqual(plan.texts.map((t) => [t.text, t.style, t.from, t.to]), [["un matin au fournil", "hook", 0, 2.07], ["fournil + café crème", "caption", 0.93, 2.07]]);
  assert.deepEqual(plan.music_shape, { downbeat: 0.214, end: { at: plan.duration, fade: 0.012 } });
  assert.equal(plan.sounds, undefined);
  assert.equal(plan.layers![0]!.motion.drawn, undefined);
  assert.deepEqual(plan.skill, { key: "routine", version: 1 });
  // Nothing cut out, followed, cleared or read: its code draws her shots and its title, nothing else.
  assert.deepEqual(checkMotionCode(routine.code), []);
  assert.deepEqual([subjectsDrawn(routine.code), objectsDrawn(routine.code), clearsDrawn(routine.code), readsDrawn(routine.code)], [[], [], [], []]);
  assert.doesNotMatch(routine.code, /transform|scale\(|filter:/);
  assert.ok(routine.code.length < 24000);
  assert.deepEqual(routine.finish, { grain: 0, vignette: 0 });
  assert.deepEqual(routine.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["auto", "vertical", "horizontal"]]]);
});

// ——— What its code draws, frame by frame ————————————————————————————————————————————————————————————————————————————

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };

/** Its Scene, run with a plain tree for React (no renderer): the kit's pieces as named nodes. */
function scene() {
  let current = 0;
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const scope: Record<string, unknown> = { AbsoluteFill: "AbsoluteFill", FitText: "FitText", Footage: "Footage", TypeOn: "TypeOn", useCurrentFrame: () => current };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${routine.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
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
type Box = { left: number; top: number; width: number; height: number };
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Box;

/** Its props for a count: its shots as a composition gets them (of one shape), its marks, her words in frames. */
function props(n: number, options: { aspect?: number; end?: boolean; settings?: Record<string, string>; brand?: Record<string, unknown> } = {}) {
  const line = routine.timeline(n, { end: Boolean(options.end) });
  const total = Math.round(line.duration * 30);
  const shots = line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect: options.aspect ?? 9 / 16, from: Math.round(s.start * 30), durationInFrames: Math.round(s.end * 30) - Math.round(s.start * 30), kind: "video", segment: i }));
  const reelTexts = [
    { text: "un matin au fournil", role: "hook", from: 0, to: 62, emphasis: [] },
    { text: "fournil + café crème", role: "caption", from: 28, to: 62, emphasis: [] },
  ];
  return {
    line,
    total,
    p: {
      width: 1080,
      height: 1920,
      durationInFrames: total,
      brand: { name: "Farine", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#7a2e3b", palette: { light: "#f4efe9" }, ...options.brand },
      shots,
      reelTexts,
      end: options.end ? { title: "Ouvert dès 7 h", subtitle: "12 rue des Martyrs", from: total - 48 } : null,
      texts: { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)])), ...options.settings },
    },
  };
}

test("« Rituel du matin » draws its trailer: each flash its shot seen early from its moment, cut clean; then her shots as filmed", () => {
  const draw = scene();
  const { line, p } = props(16);
  const footage = (f: number) => nodes(draw(f, p)).filter((x) => x.type === "Footage");
  // Its first five images: its first shot at its own moment.
  assert.deepEqual(footage(0).map((x) => [x.props.shot, x.props.at]), [[0, 0]]);
  // Its second flash from image 5: the shot its marks name, played so that its offset shows at image 5.
  const second = footage(5)[0]!;
  assert.equal(second.props.shot, line.marks.f1);
  assert.equal(second.props.at, 5 - line.marks.o1!);
  // Its last flash from image 57, then her first gesture at its own moment from the trailer's cut.
  assert.equal(footage(57)[0]!.props.shot, line.marks.f12);
  assert.deepEqual(footage(62).map((x) => [x.props.shot, x.props.at]), [[1, undefined]]);
  // Full frame, nothing over her shots after the trailer: no zoom, no push.
  assert.deepEqual(styleOf(footage(100)[0]!), { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 });
  assert.equal(nodes(draw(100, p)).filter((x) => x.type === "TypeOn" || x.type === "FitText").length, 0);
});

test("« Rituel du matin » types her title on two lines with its cursor, then her small line, both gone with the trailer's cut", async () => {
  const draw = scene();
  const { p } = props(16);
  const typed = (f: number) => nodes(draw(f, p)).find((x) => x.type === "TypeOn");
  // Typed from the first image on two lines (the second the longer), at a hand's pace, its cursor a white bar until her line comes in.
  const at0 = typed(0)!;
  assert.equal(at0.props.text, "un matin\nau fournil");
  assert.equal(at0.props.at, 0);
  assert.equal(at0.props.caret, "bar");
  assert.equal(at0.props.caretColor, "#ffffff");
  assert.ok(Number(at0.props.speed) >= 15.6);
  assert.equal(typed(27)!.props.caret, "bar");
  assert.equal(typed(28)!.props.caret, "none");
  // Lower-case italic, tracked tight, in her light colour when it is light enough (else the original's cream), no edge.
  const box = nodes(draw(10, p)).find((x) => x.type === "FitText")!;
  const inner = box.props.innerStyle as Record<string, unknown>;
  assert.deepEqual([inner.fontStyle, inner.fontWeight, inner.letterSpacing, inner.color, inner.whiteSpace], ["italic", 600, "-0.045em", "#f4efe9", "pre"]);
  // Flat but for a tight edge hardly seen, which the scene check reads as its own edge (it reads on a white shot too).
  assert.equal(inner.textShadow, "0 1px 2px rgba(48, 32, 18, 0.4), 0 0 1px rgba(48, 32, 18, 0.4)");
  const { outlined } = await import("../../../../apps/render/src/contrast.ts");
  assert.equal(outlined([246, 226, 193], "rgba(48, 32, 18, 0.4) 0px 1px 2px, rgba(48, 32, 18, 0.4) 0px 0px 1px", 0, ""), true);
  assert.equal((nodes(draw(10, props(16, { brand: { palette: {} } }).p)).find((x) => x.type === "FitText")!.props.innerStyle as Record<string, unknown>).color, "#f6e2c1");
  // In the safe zone: between x 140 and 940 (it runs under the middle), above the bottom quarter.
  const b = styleOf(box);
  assert.ok(b.left === 140 && b.left + b.width === 940 && b.top >= 80 && b.top + b.height <= 1440, JSON.stringify(b));
  // Her small line from image 28, small beside the title, under it.
  const fine = (f: number) => nodes(draw(f, p)).filter((x) => x.type === "FitText").find((x) => String(x.props.key).startsWith("line-"));
  assert.equal(fine(27), undefined);
  const line = fine(28)!;
  assert.ok(nodes(line).some((x) => "data-fauve-accent" in x.props));
  assert.ok(styleOf(line).top > b.top + b.height - 30 && styleOf(line).top + styleOf(line).height <= 1440);
  // Both gone with the cut on her first gesture.
  assert.ok(typed(61) && fine(61));
  assert.equal(typed(62), undefined);
  assert.equal(fine(62), undefined);
});

test("« Rituel du matin » ends on three black images, or on her ending card typed on the black; its format as her videos", () => {
  const draw = scene();
  const { total, p } = props(16);
  assert.equal(nodes(draw(total - 4, p)).filter((x) => x.type === "Footage").length, 1);
  assert.equal(nodes(draw(total - 3, p)).filter((x) => x.type === "Footage").length, 0);
  assert.equal(draw(total - 1, p).props.style && (draw(total - 1, p).props.style as Record<string, string>).backgroundColor, "#000000");
  // Her ending card on the black, typed like her title, her line under it once it is typed.
  const ended = props(16, { end: true });
  const at = ended.total - 48;
  assert.equal(nodes(draw(at - 1, ended.p)).filter((x) => x.type === "Footage").length, 1);
  const card = nodes(draw(at + 10, ended.p));
  assert.equal(card.filter((x) => x.type === "Footage").length, 0);
  assert.equal(card.find((x) => x.type === "TypeOn")!.props.text, "Ouvert\ndès 7 h");
  assert.equal(nodes(draw(at + 40, ended.p)).filter((x) => String(x.props.key).startsWith("sub-")).length, 1);
  // Her videos in width: whole in a 16:9 band on black, its title on the band; full frame as she asks.
  const wide = props(16, { aspect: 16 / 9 });
  assert.deepEqual(styleOf(nodes(draw(100, wide.p)).find((x) => x.type === "Footage")!), { position: "absolute", left: 0, top: 656, width: 1080, height: 608 });
  const titleBox = styleOf(nodes(draw(10, wide.p)).find((x) => x.type === "FitText")!);
  assert.ok(titleBox.top > 656 && titleBox.top + titleBox.height < 656 + 608, JSON.stringify(titleBox));
  const asked = props(16, { aspect: 16 / 9, settings: { format: "vertical" } });
  assert.deepEqual(styleOf(nodes(draw(100, asked.p)).find((x) => x.type === "Footage")!), { position: "absolute", left: 0, top: 0, width: 1080, height: 1920 });
});
