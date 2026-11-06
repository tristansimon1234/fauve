import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { clearsDrawn, readsDrawn, subjectsDrawn } from "../subject.ts";
import { monTravail } from "./mon-travail.ts";

// « Voici mon travail » v3 (skills/mon-travail.ts; docs/fiches/mon-travail.md, « Version 3 »). Tristan on v2's bench, a
// florist in a red apron at her counter filling the vertical frame: « mes bouquets de saison ça va pas » (her raspberry
// words across her apron and her chin, her bouquets hidden behind her). The original: a slim figure on the left third,
// its collage a mass around her, its pale words reading on everything under them.

type Box = { x: number; y: number; w: number; h: number };
type Node = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Light = { mean: number; high: number } | null;

const nodesOf = (n: unknown): Node[] => {
  if (Array.isArray(n)) return n.flatMap(nodesOf);
  if (!n || typeof n !== "object" || !("type" in n)) return [];
  const node = n as Node;
  return [node, ...node.children.flatMap(nodesOf)];
};
const textOf = (n: unknown): string => (typeof n === "string" ? n : Array.isArray(n) ? n.map(textOf).join("") : n && typeof n === "object" && "children" in n ? textOf((n as Node).children) : "");
const styleOf = (n: Node) => (n.props.style ?? {}) as Record<string, unknown>;

/** What its code draws at a frame, her cut-out's box, outline and her shot's light (by box) and calm areas given. */
function draw(frame: number, read: { box?: Box; outline?: string; light?: (b: Box | undefined) => Light; calm?: (within: Box) => Box | null; accent?: string } = {}) {
  const line = monTravail.timeline(38, { end: false });
  const texts = Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(v)]));
  const shots = line.shots.map((s, i) => ({ segment: i, from: Math.round(s.start * 30), durationInFrames: Math.max(1, Math.round((s.end - s.start) * 30)), aspect: 1, kind: "photo" }));
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Node => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  const lights: Box[] = [];
  const scope: Record<string, unknown> = {
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Footage: "Footage",
    Subject: "Subject",
    useCurrentFrame: () => frame,
    SubjectBox: (shot: { segment: number }) => (shot.segment === 0 ? (read.box ?? null) : null),
    SubjectOutline: (shot: { segment: number }) => (shot.segment === 0 ? (read.outline ?? null) : null),
    LightUnder: (_shot: unknown, _f: number, _laid: unknown, box?: Box) => { if (box) lights.push(box); return read.light ? read.light(box) : null; },
    ClearBox: (_shot: unknown, _f: number, _laid: unknown, options: { within: Box; fallback: Box | null }) => (read.calm ? read.calm(options.within) : options.fallback),
  };
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${monTravail.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Node;
  const tree = make(React, ...Object.values(scope))({
    width: 1080, height: 1920, durationInFrames: 275, shots, texts,
    brand: { name: "Fleurs de Léa", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: read.accent ?? "#b03a5b" },
    reelTexts: [{ text: "Mes bouquets de saison", role: "hook", from: 0, to: 275, emphasis: [] }], end: null,
  });
  const top = tree.children.flat() as unknown[];
  const kids = nodesOf(top);
  const cutAt = top.findIndex((n) => n && typeof n === "object" && (n as Node).type === "Subject");
  const block = (key: string) => kids.find((n) => n.type === "FitText" && n.props.key === key);
  const linesIn = (b: Node | undefined) => (b ? nodesOf(b).filter((c) => c.type === "div" && styleOf(c).height === 257) : []);
  // Her works laid at this frame, each with its box and whether it is drawn behind her (before her cut-out) or in front.
  const works = top.flatMap((n, i) => (Array.isArray(n) ? n.map((w) => ({ w, i })) : [{ w: n, i }])).flatMap(({ w, i }) => {
    if (!w || typeof w !== "object" || (w as Node).type !== "div" || styleOf(w as Node).overflow !== "hidden") return [];
    const s = styleOf(w as Node) as { left: number; top: number; width: number; height: number };
    return [{ box: { x: s.left, y: s.top, w: s.width, h: s.height }, front: i > cutAt }];
  });
  return { tree, back: block("words"), front: block("words-front"), linesIn, works, lights, top, cutAt };
}

/** The florist of the bench, cropped to the vertical frame: her curls from 130 px, her face 340 to 660, her shoulders
 * and arms (white sleeves) wider than the frame from 760 down, her apron in the middle. */
const FLORIST = "M 470 130 L 640 130 L 790 220 L 880 420 L 900 640 L 1080 780 L 1080 1920 L 0 1920 L 0 780 L 190 640 L 210 420 L 300 220 Z";
const FLORIST_BOX = { x: 0, y: 130, w: 1080, h: 1790 };
/** Her real face on the bench (her chin at 660). */
const HER_FACE = { x: 380, y: 330, w: 330, h: 330 };
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** The capitals of each line drawn in a block (px): its box, centred, at the scale its height and width give it. */
const capsOf = (block: Node, lines: string[]) => {
  const s = styleOf(block) as { left: number; top: number; width: number; height: number };
  const glyph = (ch: string) => (/[IÎÏ1!.,:;' ]/.test(ch) ? 0.3 : /J/.test(ch) ? 0.52 : /[MWÆŒ]/.test(ch) ? 0.88 : /[EFLTZ]/.test(ch) ? 0.58 : 0.68);
  const widths = lines.map((l) => Array.from(l).reduce((a, ch) => a + glyph(ch), 0) * 192 * 0.99);
  const k = Math.min(1, s.width / Math.max(...widths), s.height / (lines.length * 257));
  const mid = s.top + s.height / 2;
  return lines.map((_, i) => ({ x: s.left + s.width / 2 - (widths[i]! * k) / 2, y: mid + (i - (lines.length - 1) / 2) * 257 * k - 0.38 * 192 * k, w: widths[i]! * k, h: 0.76 * 192 * k }));
};

test("« Voici mon travail » (v3): its version, its colour chosen against the ground by default, its reads on her shot alone", () => {
  assert.equal(monTravail.version, 3);
  assert.deepEqual(monTravail.settings!.find((s) => s.name === "couleur")!.choices.map((c) => c.value), ["auto", "sienne", "pale", "original"]);
  assert.deepEqual(checkMotionCode(monTravail.code), []);
  assert.ok(monTravail.code.length <= 24000, `${monTravail.code.length}`);
  // Her shot alone is cut out, read for its light and for its calm areas (never one of her works).
  assert.deepEqual(subjectsDrawn(monTravail.code), [0]);
  assert.deepEqual(clearsDrawn(monTravail.code), [0]);
  assert.deepEqual(readsDrawn(monTravail.code).map((r) => r.shot), [0]);
  assert.match(monTravail.timeline(38, { end: false }).shots[0]!.want, /de la place à côté d'elle/);
});

test("« Voici mon travail » (v3): on the florist filling the frame, her words in front of her, under her face, white with a firm edge on her apron and sleeves", () => {
  // Her apron dark, her sleeves white: the mean low, its brightest tenth bright.
  const d = draw(130, { box: FLORIST_BOX, outline: FLORIST, light: () => ({ mean: 0.16, high: 0.82 }) });
  // None behind her (she would swallow a third of each line), none on her face: all in front, after her cut-out.
  assert.equal(d.back, undefined);
  assert.ok(d.front);
  const lines = d.linesIn(d.front).map(textOf);
  assert.deepEqual(lines, ["MES", "BOUQUETS", "DE SAISON"].length === lines.length ? lines : ["MES", "BOUQUETS", "DE", "SAISON"]);
  assert.ok(d.top.indexOf(d.front) > d.cutAt);
  for (const caps of capsOf(d.front!, lines)) {
    assert.equal(overlap(caps, HER_FACE), 0, JSON.stringify(caps));
    // Inside the safe zone, at 48 px at least.
    assert.ok(caps.x >= 140 && caps.x + caps.w <= 940 && caps.y + caps.h <= 0.75 * 1920 && caps.h / 0.76 >= 48, JSON.stringify(caps));
  }
  // Her raspberry would not read on her red apron: white, with a firm dark edge (also on her white sleeves).
  const word = styleOf(d.linesIn(d.front)[0]!);
  assert.equal(word.color, "#ffffff");
  assert.match(String(word.textShadow), /rgba\(0,0,0,0\.75\)/);
  // Its light read under each line, on the lines themselves.
  assert.ok(d.lights.length >= lines.length);
});

test("« Voici mon travail » (v3): her colour only when it reads on what is under it, else a tint of it, else white or ink", () => {
  const at = (light: Light, accent?: string) => styleOf(draw(130, { box: FLORIST_BOX, outline: FLORIST, light: () => light, ...(accent ? { accent } : {}) }).linesIn(draw(130, { box: FLORIST_BOX, outline: FLORIST, light: () => light, ...(accent ? { accent } : {}) }).front)[0]!);
  // A light, even ground (a white counter, a pale wall): her raspberry as it is.
  assert.equal(at({ mean: 0.82, high: 0.9 }).color, "#b03a5b");
  // A dark, even ground (a dark shop at night): a pale tint of hers (her hue kept), as the original's lime.
  const pale = String(at({ mean: 0.06, high: 0.15 }).color);
  assert.notEqual(pale, "#b03a5b");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(pale.slice(i, i + 2), 16));
  assert.ok(r! > g! && r! > b! && g! > 140, pale);
  // A light ground her pale lime would not read on: a deep tone of it, reading there.
  const lime = String(at({ mean: 0.7, high: 0.95 }, "#e7fa87").color);
  const lum = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  assert.ok((0.7 + 0.05) / (lum(lime) + 0.05) >= 3, lime);
  // Unread (no reading of her shot), over her body: white, firm.
  assert.equal(at(null).color, "#ffffff");
});

test("« Voici mon travail » (v3): with room beside her, her words there in front, on its calm area, never across her", () => {
  // Someone wide on the left half, from high up: every line would be half hidden behind her; the room on her right.
  const left = "M 120 300 L 440 300 L 500 520 L 500 1920 L 60 1920 L 60 520 Z";
  const box = { x: 60, y: 300, w: 440, h: 1620 };
  const free = draw(130, { box, outline: left });
  assert.equal(free.back, undefined, JSON.stringify(free.back && styleOf(free.back)));
  const s = styleOf(free.front!) as { left: number; top: number; width: number; height: number };
  assert.ok(s.left >= 500 && s.left + s.width <= 940 && s.width >= 0.4 * 996, JSON.stringify(s));
  // The calm area ClearBox finds in that room, when it reads one.
  const calm = draw(130, { box, outline: left, calm: (within) => ({ x: within.x + 10, y: 900, w: within.w - 20, h: 500 }) });
  const c = styleOf(calm.front!) as { left: number; top: number; width: number; height: number };
  assert.deepEqual([c.left, c.top, c.height], [542, 900, 500]);
});

test("« Voici mon travail » (v3): her works seen, never hidden behind a wide figure nor laid on her face", () => {
  const d = draw(110, { box: FLORIST_BOX, outline: FLORIST, light: () => ({ mean: 0.16, high: 0.82 }) });
  assert.ok(d.works.length >= 20, `${d.works.length} works`);
  // Each work behind her shows half of itself at least (slid toward the sides); one she would still hide is in front
  // of her below her chin, never on her face (at her head's height it stays behind her: her head moves with the camera).
  const inside = (x: number, y: number) => {
    const pts = FLORIST.match(/-?\d+/g)!.map(Number);
    let c = false;
    for (let i = 0, j = pts.length / 2 - 1; i < pts.length / 2; j = i++) {
      const [xi, yi, xj, yj] = [pts[2 * i]!, pts[2 * i + 1]!, pts[2 * j]!, pts[2 * j + 1]!];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const hidden = (b: Box) => {
    let n = 0;
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (inside(b.x + ((i + 0.5) * b.w) / 10, b.y + ((j + 0.5) * b.h) / 10)) n++;
    return n / 100;
  };
  for (const w of d.works) {
    if (!w.front) assert.ok(hidden(w.box) <= 0.55 || w.box.y < 780, JSON.stringify(w));
    else assert.ok(w.box.y >= 660 && overlap(w.box, HER_FACE) === 0, JSON.stringify(w));
  }
  assert.ok(d.works.filter((w) => w.front).length >= 10, "her bouquets over her apron, in front of her");
  // The original's slim figure keeps the original's collage behind her, but its last ones over her legs.
  const slim = draw(110, { box: { x: 227, y: 768, w: 270, h: 1152 }, outline: "M 330 768 L 430 768 L 440 900 L 497 960 L 497 1920 L 227 1920 L 227 960 L 320 900 Z" });
  assert.ok(slim.works.filter((w) => w.front).length <= 8, JSON.stringify(slim.works.filter((w) => w.front)));
});
