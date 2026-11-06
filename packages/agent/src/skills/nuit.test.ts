import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { readSkillFill, skillCode, skillFillInput, skillPlan, type SkillTimeline } from "../skills.ts";
import { objectsDrawn, subjectsDrawn } from "../subject.ts";
import { angleFrames, nuit, nuitCounts, nuitRoles } from "./nuit.ts";

// « La nuit sous tous les angles » (skills/nuit.ts), its own checks beside the library's (features.test.ts): its
// original's cuts at its own tempo, its counts, its music and sounds, and what its code draws frame by frame.

type Drawn = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number } | null;

/** Her shots as a composition gets them: the timeline's spans in frames, each of that shape. */
const shotsOf = (line: Pick<SkillTimeline, "shots">, aspect = 16 / 9) =>
  line.shots.map((s, i) => ({ src: `/v${i}.mp4`, aspect, from: Math.round(s.start * 30), durationInFrames: Math.round((s.end - s.start) * 30), kind: "video", segment: i }));
/** Its marks as the plan passes them (strings). */
const marksOf = (line: Pick<SkillTimeline, "marks">) => Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));

type Laid = { left: number; top: number; width: number; height: number };

/** Its Scene at a frame, run with a plain tree for React (no renderer): the kit's pieces as named nodes; `box` stands for what the engine found of an object, by its name and shot, in the box her picture is laid in. */
function drawAt(code: string, frame: number, props: Record<string, unknown>, box?: (shot: { segment: number }, f: number, name: string, laid: Laid) => Box): Drawn {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Drawn => ({ type, props: p ?? {}, children }), Fragment: "Fragment", useMemo: (f: () => unknown) => f() };
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    SubjectBox: (shot: { segment: number } | undefined, f: number, laid: Laid, name: string) => (shot && box ? box(shot, f, name, laid) : null),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Drawn;
  return make(React, ...Object.values(scope))(props);
}
const flatten = (node: unknown): Drawn[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const d = node as Drawn;
  return [d, ...d.children.flatMap(flatten)];
};
const styleOf = (node: Drawn) => (node.props.style ?? {}) as Record<string, string | number>;
const footage = (tree: Drawn) => flatten(tree).filter((n) => n.type === "Footage");
/** The image of a shot a Footage shows at a frame (its `at` held from that frame). */
const imageOf = (node: Drawn, frame: number) => frame - Number(node.props.at);
const keyed = (tree: Drawn, key: string) => flatten(tree).find((n) => n.props.key === key) ?? null;

const BRAND = { name: "Chez Lou", displayFont: "Bodoni Moda", bodyFont: "Inter" };
const LINE = nuit.timeline(29, { end: false });
const props = (extra: Record<string, unknown> = {}, line = LINE) => ({
  width: 1080,
  height: 1920,
  durationInFrames: Math.round(line.duration * 30),
  brand: BRAND,
  shots: shotsOf(line),
  reelTexts: [{ text: "Chez Lou", role: "hook", from: 78, to: 123, emphasis: [] }],
  end: null,
  // « Comme ses vidéos » (her words: « comme mes vidéos »): its 16:9 frame for her horizontal videos.
  texts: { ...marksOf(line), format: "auto" },
  ...extra,
});

test("« La nuit sous tous les angles » (v1): its 29 shots at 136,8 BPM, its night's cuts on the original's frames, 12 s", () => {
  assert.equal(nuit.version, 2);
  assert.equal(nuit.bpm, 136.8);
  assert.deepEqual([nuit.shots, nuit.files, nuit.long], [[15, 29], [6, 20], 43]);
  // Its night cut where the original's is, image for image: the burn (74), the white flash (96), 126 … the black (328).
  assert.deepEqual(LINE.shots.slice(13).map((s) => Math.round(s.start * 30)), [74, 96, 126, 139, 155, 164, 204, 214, 240, 250, 259, 268, 275, 278, 302, 328]);
  assert.equal(Math.round(LINE.duration * 30), 360);
  // Its six angles share the stutter's 46 images by turns (four images for the first, five for the second…), its six round
  // things the 13 images to the lens, held 15 (its flash, then black).
  assert.deepEqual(angleFrames(6), [12, 9, 7, 4, 7, 7]);
  assert.deepEqual(angleFrames(4), [14, 13, 12, 7]);
  assert.deepEqual(LINE.shots.slice(0, 13).map((s) => Math.round(s.start * 30)), [0, 12, 21, 28, 32, 39, 46, 48, 50, 52, 54, 56, 59]);
  // From the fewest (four angles, two round things, the lens, eight of the night) to the most, then a longer night.
  assert.deepEqual(nuitCounts(15), { angles: 4, rounds: 2, main: 8, extras: 0 });
  assert.deepEqual(nuitCounts(29), { angles: 6, rounds: 6, main: 16, extras: 0 });
  assert.deepEqual(nuitCounts(43), { angles: 6, rounds: 6, main: 16, extras: 14 });
  // Fewer: its middle goes first (the second taxi, the pier, the misty street…), never its flashes, its photographer nor its last.
  assert.deepEqual(nuitRoles(8), { roles: [0, 1, 5, 7, 8, 13, 14, 15], entries: [0, 3, 1, 0, 4, 2, 0, 0] });
  assert.ok(Math.abs(nuit.timeline(15, { end: false }).duration - 9.47) < 0.02);
  // Longer: its own tempo to 30 s, more of her night before the photographer (never past 45 s).
  const long = nuit.timeline(43, { end: false });
  assert.ok(long.duration >= 30 && long.duration <= 45, String(long.duration));
  assert.equal(long.marks.r28, 14);
});

test("« La nuit sous tous les angles » (v1): its music without its bass under the stutter, cut dead to the drop, its roll and its shutters", () => {
  const music = LINE.music!;
  // Thin to 2,235 s, as the picture goes black; silent to the drop on its beat 1 (2,425 s); cut with its last image (it loops).
  assert.deepEqual(music, { downbeat: 2.425, filters: [{ kind: "thin", from: 0, to: 2.235 }], pauses: [{ from: 2.235, to: 2.425 }], end: { at: 12, fade: 0.012 } });
  // Its roll: a tick on each of its 23 cuts from the stutter's second angle to the held lens, faster and louder.
  const roll = LINE.sounds![0]!;
  assert.equal(roll.at, 0.133);
  assert.equal(roll.burst!.times.length, 23);
  const gaps = roll.burst!.times.slice(1).map((t, k) => t - roll.burst!.times[k]!);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(gaps.slice(0, 2).every((g) => g >= 0.13) && gaps.slice(-6).every((g) => g <= 0.07) && mean(gaps.slice(0, 11)) > 1.5 * mean(gaps.slice(11)), JSON.stringify(gaps));
  assert.ok(roll.burst!.gains![0]! < roll.burst!.gains!.at(-1)!);
  // A shutter as the lens flashes (its image 63) and as the one who takes a photo does (324).
  assert.deepEqual(LINE.sounds!.slice(1).map((s) => [s.sound, Math.round(s.at * 30)]), [["camera shutter click", 63], ["camera shutter click", 324]]);
  // An ending card after its last shot: 1,6 s more, faded under it; at another tempo all of it follows.
  const ended = nuit.timeline(29, { end: true });
  assert.ok(ended.duration - LINE.duration >= 1.6 && ended.music!.end!.fade === 0.8);
  const slow = nuit.timeline(29, { end: false, bpm: 96 });
  assert.ok(Math.abs(slow.duration / LINE.duration - 136.8 / 96) < 0.01 && Math.abs(slow.music!.downbeat! / 2.425 - 136.8 / 96) < 0.01);
  assert.equal(slow.marks.scale, 1.425);
});

test("« La nuit sous tous les angles » (v1): its plan names her object in each angle and the camera, cuts out the photographer only", () => {
  const files = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, photo: false, seconds: 12, moments: [{ start: 1, end: 4 }, { start: 5, end: 8 }, { start: 9, end: 11 }] }));
  const fill = {
    shots: Array.from({ length: 29 }, (_, i) => ({ file: files[i % 10]!.id, at: Math.floor(i / 10) * 4 })),
    texts: { titre: "Chez Lou" },
    end: null,
    objects: { ...Object.fromEntries(Array.from({ length: 6 }, (_, k) => [`angle${k + 1}`, "neon lips sign"])), appareil: "smartphone" },
  };
  const plan = skillPlan({ skill: nuit, name: "La nuit sous tous les angles", files, fill });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.equal(plan.segments.length, 29);
  assert.equal(plan.tempo, 136.8);
  assert.deepEqual(plan.music_shape?.pauses, [{ from: 2.235, to: 2.425 }]);
  const drawn = plan.layers![0]!.motion.drawn!;
  assert.deepEqual(drawn.subjects, [27]);
  assert.deepEqual(drawn.objects, [...Array.from({ length: 6 }, (_, k) => ({ shot: k, name: "neon lips sign" })), { shot: 27, name: "smartphone" }]);
  // Its code with them named: each angle's object on its own shot, the camera wherever the plan placed it, her cut-out declared.
  const code = plan.layers![0]!.motion.js!;
  assert.deepEqual(checkMotionCode(code), []);
  assert.ok(code.length < 24000, String(code.length));
  assert.deepEqual(objectsDrawn(code).filter((o) => o.shot >= 0).map((o) => o.shot), [0, 1, 2, 3, 4, 5]);
  assert.ok(objectsDrawn(code).some((o) => o.shot === -1 && o.name === "smartphone"));
  assert.ok(subjectsDrawn(code).length > 0);
  // Four angles: the fifth and sixth objects are asked of nobody (they are not on one of her angles).
  const few = nuit.timeline(15, { end: false });
  assert.deepEqual([few.objects!.angle5, few.objects!.angle6, few.objects!.appareil], [99, 99, 13]);
  const input = skillFillInput({ skill: nuit, name: "La nuit sous tous les angles", n: 15, files, business: { name: "Chez Lou" }, request: "" });
  assert.deepEqual(input.objets!.map((o) => [o.slot, o.case]), [["angle1", 1], ["angle2", 2], ["angle3", 3], ["angle4", 4], ["appareil", 14]]);
  // Its one word is optional, as the original writes none; Edith's pick writes it (the form, never the silence).
  const answer = { fits: true, missing: "", shots: [], texts: [], end: null, why: "" };
  assert.ok(readSkillFill(nuit, files, 15, answer));
  assert.equal(readSkillFill(nuit, files, 15, answer, { wordsWanted: true }), null);
  assert.deepEqual(nuit.reads, ["covered"]);
});

test("« La nuit sous tous les angles » (v1): one object in every angle, in turn on the roll, its last turn streaked, at one place and size", () => {
  // Six angles: the original's 15 cuts dealt by turns, the last on the last angle (A B C D E F A B C D E F A B F), each
  // angle's images going on.
  const shown = (f: number) => {
    const node = footage(drawAt(nuit.code, f, props()))[0]!;
    return [Number(node.props.shot), imageOf(node, f)];
  };
  const starts = [0, 4, 9, 13, 15, 19, 23, 28, 30, 33, 35, 38, 40, 43, 45];
  assert.deepEqual(starts.map((f) => shown(f)[0]), [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 5]);
  // That last F goes on from its two turns (four images, then two): its seventh image.
  assert.deepEqual(shown(45), [5, 6]);
  // The first angle's images 0 – 3, then 4 – 8 on its second turn, then 9 – 11.
  assert.deepEqual([shown(0), shown(3), shown(23), shown(27), shown(40), shown(42)], [[0, 0], [0, 3], [0, 4], [0, 8], [0, 9], [0, 11]]);
  // Its last turn (images 33 to 44) streaked by a blur, more and more; its last angle sharp again.
  const blur = (f: number) => flatten(drawAt(nuit.code, f, props())).find((n) => n.type === "feGaussianBlur")?.props.stdDeviation;
  assert.deepEqual([blur(32), blur(33), blur(43), blur(45)], [undefined, "9.0 0", "37.0 0", undefined]);
  // Her object found in each angle (shares of her picture, as the engine keeps it), read on her whole picture laid to
  // cover the 16:9 frame (1080 × 608): each one enlarged a little and more (1,15 to 1,9 times) and moved so the six land
  // on one place and one size, near the middle.
  const share = (x: number, y: number, w: number, h: number, W = 1080, H = 608) => ({ x: x / W, y: y / H, w: w / W, h: h / H });
  const boxes: Record<number, { x: number; y: number; w: number; h: number }> = {
    0: share(600, 150, 200, 160),
    1: share(420, 120, 230, 180),
    2: share(300, 230, 136, 110),
    3: share(480, 260, 150, 120),
    4: share(380, 200, 180, 140),
    5: share(520, 180, 210, 165),
  };
  const onPicture = (list: typeof boxes) => (shot: { segment: number }, _f: number, _name: string, laid: Laid) => {
    const b = list[shot.segment];
    return b ? { x: laid.left + b.x * laid.width, y: laid.top + b.y * laid.height, w: b.w * laid.width, h: b.h * laid.height } : null;
  };
  const placedWith = (list: typeof boxes, extra: Record<string, unknown> = {}) => (f: number) => {
    const node = footage(drawAt(nuit.code, f, props(extra), onPicture(list)))[0]!;
    const k = Number(node.props.shot);
    const st = styleOf(node) as Laid;
    const b = list[k]!;
    return { k, ...st, cx: st.left + st.width * (b.x + b.w / 2), cy: st.top + st.height * (b.y + b.h / 2), h: st.height * b.h };
  };
  const all = starts.slice(0, 6).map(placedWith(boxes));
  for (const p of all) {
    assert.ok(p.width >= 1080 * 1.15 && p.width <= 1080 * 1.9 + 2, JSON.stringify(p));
    // Never so far that her picture uncovers an edge of the frame.
    assert.ok(p.left <= 0 && p.left + p.width >= 1080 && p.top <= 0 && p.top + p.height >= 608, JSON.stringify(p));
  }
  assert.ok(all.every((p) => Math.abs(p.cx - all[0]!.cx) <= 2 && Math.abs(p.cy - all[0]!.cy) <= 2), JSON.stringify(all));
  assert.ok(Math.abs(all[0]!.cx - 540) <= 80 && Math.abs(all[0]!.cy - 304) <= 80, JSON.stringify(all[0]));
  // One size: 1,15 times as big as where it is biggest (180 px), unless that would take it past 1,9 times.
  assert.ok(all.every((p) => Math.abs(p.h - 207) <= 2), JSON.stringify(all));
  // An angle whose object is small and at the edge cannot reach them: as near as it can, at 1,9 times; the others still one place.
  const outlier = placedWith({ ...boxes, 2: share(30, 250, 60, 50) });
  const others = [0, 4, 13, 15, 19].map(outlier);
  assert.ok(others.every((p) => Math.abs(p.cx - others[0]!.cx) <= 2 && Math.abs(p.cy - others[0]!.cy) <= 2), JSON.stringify(others));
  const far = outlier(9);
  assert.ok(Math.abs(far.height / 608 - 1.9) < 0.01 && far.left === 0, JSON.stringify(far));
  // Horizontal angles in the vertical frame: each one's whole picture (3413 px wide at the frame's height), so an object
  // at its side comes to the middle too (the frame alone shows only its middle third).
  const upright = { texts: { ...marksOf(LINE), format: "vertical" } };
  const sides = { 0: share(0.44, 0.32, 0.12, 0.2, 1, 1), 1: share(0.14, 0.35, 0.12, 0.2, 1, 1), 2: share(0.72, 0.3, 0.12, 0.2, 1, 1), 3: share(0.3, 0.37, 0.12, 0.2, 1, 1), 4: share(0.55, 0.33, 0.12, 0.2, 1, 1), 5: share(0.2, 0.31, 0.12, 0.2, 1, 1) };
  const turned = starts.slice(0, 6).map(placedWith(sides, upright));
  assert.ok(turned.every((p) => Math.abs(p.cx - 540) <= 2 && Math.abs(p.cy - turned[0]!.cy) <= 2 && p.height >= 1920 * 1.15 - 1), JSON.stringify(turned));
  assert.ok(turned.every((p) => p.left <= 0 && p.left + p.width >= 1080 && p.top <= 0 && p.top + p.height >= 1920), JSON.stringify(turned));
  // Nothing found: as filmed.
  assert.deepEqual([styleOf(footage(drawAt(nuit.code, 4, props()))[0]!).left, styleOf(footage(drawAt(nuit.code, 4, props()))[0]!).width], [0, 1080]);
});

test("« La nuit sous tous les angles » (v1): its round things, the lens that flashes and turns negative, the black and the burn", () => {
  const at = (f: number) => drawAt(nuit.code, f, props());
  const shot = (f: number) => Number(footage(at(f))[0]?.props.shot ?? -1);
  // The dark blur (the lens's first image, blurred and darkened), the lens once, then the round things by turns, then the lens held.
  assert.match(String(styleOf(keyed(at(46), "dip")!).filter), /blur\(30px\)/);
  assert.deepEqual([49, 50, 51, 53, 54, 56, 58, 59].map(shot), [12, 6, 7, 8, 9, 10, 11, 12]);
  // Its glass white on 63 (a disc at its middle, in screen), the whole picture negative on 64, then black from 66.
  assert.ok(keyed(at(63), "disc"));
  assert.match(String(styleOf(footage(at(64))[0]!).filter), /invert\(1\)/);
  assert.equal(footage(at(65)).length, 1);
  assert.deepEqual([66, 70, 73].map((f) => footage(at(f)).length), [0, 0, 0]);
  // The burn on the drop: warm white, then sliding off to the right over black, opaque; her night from 78.
  const burn = (f: number) => String(styleOf(keyed(at(f), "drop")!).background);
  assert.match(burn(74), /#f6f2ea/);
  assert.match(burn(75), /#2d2523 0%/);
  assert.match(burn(77), /#000000 19%/);
  assert.equal(styleOf(keyed(at(76), "drop")!).backgroundColor, "#000000");
  assert.equal(shot(78), 13);
  // Her film grade on her pictures, never on its flashes and burns.
  assert.equal(styleOf(keyed(at(80), "base")!).filter, "url(#nt-film)");
  assert.equal(keyed(at(75), "base"), null);
});

test("« La nuit sous tous les angles » (v1): its night comes in as the original's: white flash, panel, leak, negatives and white, the photographer, the loop", () => {
  const at = (f: number, extra = {}) => drawAt(nuit.code, f, props(extra));
  // The white flash before the second shot of the night: the first one's last image burnt white (its blacks lifted: a
  // night burns through) and held on 96 – 98, then the second shot as filmed.
  const burnt = (f: number) => footage(at(f)).find((n) => n.props.key === "burnt")!;
  assert.deepEqual([96, 97, 98].map((f) => [Number(burnt(f).props.shot), imageOf(burnt(f), f), styleOf(burnt(f)).filter]), [96, 97, 98].map(() => [13, Math.round((LINE.shots[13]!.end - LINE.shots[13]!.start) * 30) - 1, "contrast(0.86) brightness(10) saturate(0.5)"]));
  assert.equal(keyed(at(99), "burnt"), null);
  assert.equal(Number(footage(at(99))[0]!.props.shot), 14);
  // The warm panel of light on the right of its last images (123, 124), none on 125.
  assert.ok(keyed(at(123), "panel") && keyed(at(124), "panel") && !keyed(at(125), "panel"));
  // The orange leak on the last image before the neon (239), its first image in a negative burnt white, then two white images.
  assert.match(String(styleOf(keyed(at(239), "leak")!).background), /#893d23/);
  assert.equal(styleOf(keyed(at(240), "burnt")!).filter, "url(#nt-glare)");
  assert.deepEqual([241, 242].map((f) => styleOf(keyed(at(f), "white")!).background), ["#fcfcfc", "#fcfcfc"]);
  // Its counter coming in in negative (250, 251): a night in negative is white, its lights dark.
  assert.deepEqual([250, 251].map((f) => String(styleOf(keyed(at(f), "burnt")!).filter)), ["url(#nt-neg)", "url(#nt-neg)"]);
  const filters = flatten(at(250)).filter((n) => n.type === "filter").map((n) => n.props.id);
  assert.deepEqual(filters, ["nt-film", "nt-neg", "nt-glare"]);
  // The one who takes a photo: their camera white (324), a white veil (325, 326), their silhouette white (327).
  const camera = keyed(at(324), "camera")!;
  assert.deepEqual([camera.type, camera.props.object, camera.props.fill, camera.props.shot], ["Subject", "@appareil", "#ffffff", 27]);
  assert.ok(keyed(at(325), "veil") && keyed(at(326), "veil"));
  assert.deepEqual([styleOf(keyed(at(325), "veil")!).background, styleOf(keyed(at(325), "veil")!).opacity], ["#ffffff", 0.71]);
  assert.deepEqual([keyed(at(327), "silhouette")!.props.fill, keyed(at(327), "silhouette")!.props.object], ["#d2d4d8", undefined]);
  // Then black (328, 329), the burn again (330 – 333), the last shot, cut by the burn (344 – 347), and the loop: her first
  // angle's first image on the last two.
  assert.deepEqual([328, 329].map((f) => footage(at(f)).length), [0, 0]);
  assert.ok([330, 331, 332, 333].every((f) => keyed(at(f), "again")) && [344, 345, 346, 347].every((f) => keyed(at(f), "mid")));
  assert.equal(Number(footage(at(340))[0]!.props.shot), 28);
  const loop = footage(at(358))[0]!;
  assert.deepEqual([Number(loop.props.shot), imageOf(loop, 358)], [0, 0]);
  // With an ending card: no loop, her card over the last shot.
  const ended = nuit.timeline(29, { end: true });
  const frames = Math.round(ended.duration * 30);
  const card = drawAt(nuit.code, frames - 1, props({ end: { title: "Ouvert jusqu'à 2 h", subtitle: "du jeudi au samedi", from: frames - 48 } }, ended));
  assert.equal(Number(footage(card)[0]!.props.shot), 28);
  assert.ok(flatten(card).some((n) => n.type === "FitText" && String(n.props.key).startsWith("card-")));
});

test("« La nuit sous tous les angles » (v2): her name after the burn, in the safe zone; full frame by default, in 16:9 on black as her videos or her word", () => {
  const at = (f: number, extra = {}) => drawAt(nuit.code, f, props(extra));
  const title = (f: number, extra = {}) => flatten(at(f, extra)).find((n) => String(n.props.key).startsWith("title-"));
  assert.equal(title(77), undefined);
  const t = title(78)!;
  // Laid in its 16:9 frame (at 656 of the screen): where it is on the screen.
  const inFrame = styleOf(t) as { left: number; top: number; width: number; height: number };
  const frameTop = Number(styleOf(flatten(at(78)).find((n) => styleOf(n).overflow === "hidden")!).top);
  const b = { ...inFrame, top: frameTop + inFrame.top };
  // Between x 140 and 940 (it crosses the middle), above the bottom quarter, inside its frame, 48 px and more, white, its capitals spaced.
  assert.ok(b.left >= 140 && b.left + b.width <= 940 && b.top >= 80 && b.top + b.height <= 1440, JSON.stringify(b));
  assert.ok(b.top >= 656 && b.top + b.height <= 656 + 608 && Math.abs(b.top + b.height / 2 - 960) <= 2, JSON.stringify(b));
  const inner = t.props.innerStyle as Record<string, string | number>;
  assert.ok(Number(inner.fontSize) >= 48 && inner.color === "#ffffff" && inner.textTransform === "uppercase");
  assert.equal(title(123), undefined);
  // Its frame: 16:9 in the middle of the vertical frame when most of her files are wide; full frame when they stand up or she asks.
  const frameOf = (extra: Record<string, unknown>) => styleOf(flatten(at(100, extra)).find((n) => styleOf(n).overflow === "hidden")!);
  assert.deepEqual([frameOf({}).top, frameOf({}).height], [656, 608]);
  const upright = { shots: shotsOf(LINE, 9 / 16) };
  assert.deepEqual([frameOf(upright).top, frameOf(upright).height], [0, 1920]);
  assert.deepEqual([frameOf({ texts: { ...marksOf(LINE), format: "vertical" } }).height], [1920]);
  // By default (Tristan, 6 November: « tout vertical please »), full frame whatever her files; 16:9 on her word.
  assert.deepEqual([frameOf({ texts: marksOf(LINE) }).top, frameOf({ texts: marksOf(LINE) }).height], [0, 1920]);
  assert.deepEqual([frameOf({ ...upright, texts: { ...marksOf(LINE), format: "horizontal" } }).top], [656]);
  assert.deepEqual(nuit.settings?.map((s) => [s.name, s.choices.map((c) => c.value)]), [["format", ["vertical", "horizontal", "auto"]]]);
});

test("« La nuit sous tous les angles » (v1): its code holds for every count it takes, its words in place, no zoom of its own on her night", () => {
  for (const n of [15, 18, 22, 29, 36, 43]) {
    const line = nuit.timeline(n, { end: false });
    const frames = Math.round(line.duration * 30);
    for (const f of [0, 30, 50, 70, 76, 90, frames - 30, frames - 1]) {
      const tree = drawAt(nuit.code, f, props({}, line));
      assert.ok(tree.type === "AbsoluteFill", `${n} at ${f}`);
    }
  }
  // Its code: plain JS, the kit's tools, under 24 000 characters once its objects are named.
  const named = skillCode(nuit, { angle1: "neon sign", appareil: "camera" });
  assert.deepEqual(checkMotionCode(named), []);
  assert.doesNotMatch(nuit.code, /<[A-Za-z]/);
});
