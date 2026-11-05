// The hand-made pieces of the text kit (Type.tsx, Kit.tsx), pure and tested (no imports): the pace of a hand along a
// stroke (Scribble speed: a speed and no easing, slower in the turns, a little faster on the way back, from a start and
// in a direction), the rounded outline of a word's cells over several rows, in steps when they are not the same length
// (Scribble kind "cells": « AFTER » over « NOON » in « Mots mêlés »), where a word search hides its words and the words
// it never circles (WordSearch decoys), a typed text the cursor goes back over (TypeOn erase), the letters of a hand
// that never repeats (Handwriting: « Carte au feutre »), and the almond of an eye (Window reveal "eye": « Silhouette et
// mot »). Chance comes from outside (Remotion's random in the render, any seeded function in the tests).

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
/** A number in [0, 1) for a key, always the same for the same key. */
export type Chance = (key: string) => number;
/** Where a closed stroke starts on its outline (top-left: just above its first letter, like a hand circling a word). */
export type Spot = "top-left" | "top" | "top-right" | "right" | "bottom-right" | "bottom" | "bottom-left" | "left";
/** Clockwise or counterclockwise, as seen on the screen. */
export type Turn = "cw" | "ccw";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 0 below a, 1 above b, smooth in between. */
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

// ——— A hand's pace —————————————————————————————————————————————————————————————————————

/**
 * The pace of a hand drawing a stroke, measured on « Mots mêlés » (its loops round the words of a grid): no easing, the
 * same speed on the whole (a quarter of its time draws 21 % of it, half 47 %, three quarters 70 %, where an ease-out
 * draws 58, 88 and 98 %), 0,6 times as fast in the turns (a capsule's ends), 1,25 times on the way back of a closed
 * stroke, the pen landing then slowing down to close. `strokes`: the points of each stroke in drawing order (a cross has
 * two), the pen lifted `lift` frames between two. `speed`: px an image on average; `radius`: the size its turns are
 * measured against (a capsule's half height: its ends are drawn at 0,6 of its speed). The frames it takes, and the
 * share of its length drawn at a frame from its start.
 */
export function handPace(
  strokes: Pt[][],
  speed: number,
  options: { closed?: boolean; radius?: number; lift?: number } = {},
): { frames: number; drawn: (t: number) => number } {
  const lines = strokes.filter((s) => s.length >= 2);
  const lengths = lines.map((s) => s.slice(1).reduce((sum, p, i) => sum + dist(s[i]!, p), 0));
  const total = lengths.reduce((a, b) => a + b, 0);
  if (!(total > 0) || !(speed > 0)) return { frames: 0, drawn: () => 1 };
  const xs = lines.flat().map((p) => p.x);
  const ys = lines.flat().map((p) => p.y);
  const radius = options.radius ?? Math.max(1, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2);
  const lift = Math.max(0, options.lift ?? 3);
  // Each segment: its length, where it starts along the whole length, and its time at the pace of a hand.
  const segments: { length: number; from: number; time: number }[] = [];
  let along = 0;
  lines.forEach((s, k) => {
    const turnAt = (i: number) => {
      if (i <= 0 || i >= s.length - 1) return 0;
      const a = Math.atan2(s[i]!.y - s[i - 1]!.y, s[i]!.x - s[i - 1]!.x);
      const b = Math.atan2(s[i + 1]!.y - s[i]!.y, s[i + 1]!.x - s[i]!.x);
      let d = Math.abs(b - a);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return d;
    };
    if (k > 0) segments.push({ length: 0, from: along, time: lift });
    for (let i = 0; i + 1 < s.length; i++) {
      const length = dist(s[i]!, s[i + 1]!);
      const mid = (along + length / 2) / total;
      // How sharply it turns here (radians a px), against the size of the stroke.
      const bend = length > 1e-6 ? (turnAt(i) + turnAt(i + 1)) / 2 / length : 0;
      const turn = 1 / (1 + 0.65 * bend * radius);
      const back = options.closed ? 1 + 0.25 * smoothstep(0.45, 0.6, mid) : 1;
      const land = 0.6 + 0.4 * smoothstep(0, 0.04, mid);
      const close = 1 - 0.45 * smoothstep(0.93, 1, mid);
      segments.push({ length, from: along, time: length / (turn * back * land * close) });
      along += length;
    }
  });
  // Its average speed is the one given: the lifts aside, it draws `speed` px an image.
  const drawing = segments.filter((s) => s.length > 0).reduce((sum, s) => sum + s.time, 0);
  const scale = total / speed / drawing;
  const times: number[] = [0];
  for (const s of segments) times.push(times.at(-1)! + (s.length > 0 ? s.time * scale : s.time));
  const frames = times.at(-1)!;
  return {
    frames,
    drawn: (t: number) => {
      if (t <= 0) return 0;
      if (t >= frames) return 1;
      let i = 0;
      while (i < segments.length - 1 && times[i + 1]! <= t) i++;
      const s = segments[i]!;
      const span = times[i + 1]! - times[i]!;
      const into = span > 0 ? (t - times[i]!) / span : 1;
      return clamp01((s.from + s.length * into) / total);
    },
  };
}

// ——— Closed strokes from a start, in a direction ——————————————————————————————————————

/** The share of the way round a capsule's outline a spot is, clockwise from just above its first letter. */
function capsuleSpot(spot: Spot, half: number, r: number): number {
  const P = 4 * half + 2 * Math.PI * r;
  const at: Record<Spot, number> = {
    "top-left": 0,
    top: half,
    "top-right": 2 * half,
    right: 2 * half + (Math.PI * r) / 2,
    "bottom-right": 2 * half + Math.PI * r,
    bottom: 3 * half + Math.PI * r,
    "bottom-left": 4 * half + Math.PI * r,
    left: 4 * half + 1.5 * Math.PI * r,
  };
  return at[spot] / P;
}

/**
 * Points round a capsule (two half circles joined by two straight sides) filling the box, from a spot of its outline
 * (top-left: just above its first letter, where a hand starts circling a word), clockwise or counterclockwise on the
 * screen, `past` of a turn beyond its start (the loops of « Mots mêlés » close on their start, within 5 px).
 */
export function capsuleRing(box: Rect, start: Spot = "top-left", turn: Turn = "ccw", past = 0.02, n = 64): Pt[] {
  const r = box.h / 2;
  const half = Math.max(0, box.w / 2 - r);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const P = 4 * half + 2 * Math.PI * r;
  const at = (u: number): Pt => {
    let s = (((u % 1) + 1) % 1) * P;
    if (s < 2 * half) return { x: cx - half + s, y: cy - r };
    if ((s -= 2 * half) < Math.PI * r) {
      const a = -Math.PI / 2 + s / r;
      return { x: cx + half + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    }
    if ((s -= Math.PI * r) < 2 * half) return { x: cx + half - s, y: cy + r };
    s -= 2 * half;
    const a = Math.PI / 2 + s / r;
    return { x: cx - half + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  };
  const u0 = capsuleSpot(start, half, r);
  const sign = turn === "cw" ? 1 : -1;
  const count = Math.round(n * (1 + Math.max(0, past)));
  return Array.from({ length: count + 1 }, (_, i) => at(u0 + (sign * i) / n));
}

/** The angle of a spot on an ellipse (screen angles: y down). */
const ELLIPSE_SPOT: Record<Spot, number> = {
  "top-left": -0.75 * Math.PI,
  top: -0.5 * Math.PI,
  "top-right": -0.25 * Math.PI,
  right: 0,
  "bottom-right": 0.25 * Math.PI,
  bottom: 0.5 * Math.PI,
  "bottom-left": 0.75 * Math.PI,
  left: Math.PI,
};

/** Points round a loop (an ellipse a little wider than the box, opening out as it goes), from a spot, in a direction. */
export function loopRing(box: Rect, start: Spot = "top-left", turn: Turn = "ccw", past = 0.04, n = 48): Pt[] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const sign = turn === "cw" ? 1 : -1;
  const count = Math.round(n * (1 + Math.max(0, past)));
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = ELLIPSE_SPOT[start] + (sign * i * 2 * Math.PI) / n;
    const grow = 1 + 0.05 * (i / count);
    return { x: cx + Math.cos(a) * (box.w / 2) * 1.14 * grow, y: cy + Math.sin(a) * (box.h / 2) * 1.3 * grow };
  });
}

/**
 * The rounded outline of a word's cells over several rows, one under the other (« AFTER » over « NOON »): the outline of
 * their union, its outer corners rounded like a capsule's ends (`radius`, half the rows' height by default), the inner
 * ones where the rows step tighter (`inner`), from a spot (top-left: just above its first letter), clockwise or
 * counterclockwise, `past` of a turn beyond its start, in points about `step` px apart. Rows that do not overlap are
 * stretched until they do: one outline goes round them all. One row gives a capsule.
 */
export function cellsRing(rows: Rect[], start: Spot = "top-left", turn: Turn = "ccw", options: { past?: number; step?: number; radius?: number; inner?: number } = {}): Pt[] {
  const list = rows.filter((r) => r.w > 0 && r.h > 0).sort((a, b) => a.y - b.y).map((r) => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }));
  if (!list.length) return [];
  const low = Math.min(...list.map((r) => r.y1 - r.y0));
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]!;
    const b = list[i]!;
    const need = Math.min(low / 2, (a.x1 - a.x0) / 2, (b.x1 - b.x0) / 2);
    if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) < need) {
      if (b.x0 > a.x1 - need) b.x0 = a.x1 - need;
      if (b.x1 < a.x0 + need) b.x1 = a.x0 + need;
    }
  }
  const R = options.radius ?? low / 2;
  const Ri = options.inner ?? low * 0.3;
  // The outline, clockwise from the top-left corner: the top, down the right side in steps, the bottom, up the left side.
  const v: Pt[] = [
    { x: list[0]!.x0, y: list[0]!.y0 },
    { x: list[0]!.x1, y: list[0]!.y0 },
  ];
  const cut = (i: number) => (list[i]!.y1 + list[i + 1]!.y0) / 2;
  for (let i = 0; i + 1 < list.length; i++) v.push({ x: list[i]!.x1, y: cut(i) }, { x: list[i + 1]!.x1, y: cut(i) });
  const last = list.at(-1)!;
  v.push({ x: last.x1, y: last.y1 }, { x: last.x0, y: last.y1 });
  for (let i = list.length - 2; i >= 0; i--) v.push({ x: list[i + 1]!.x0, y: cut(i) }, { x: list[i]!.x0, y: cut(i) });
  // No point twice, none in the middle of a straight side (rows of the same length do not step).
  const corners: Pt[] = [];
  for (const p of v) if (!corners.length || dist(corners.at(-1)!, p) > 0.5) corners.push(p);
  if (corners.length > 1 && dist(corners[0]!, corners.at(-1)!) <= 0.5) corners.pop();
  for (let i = 0; i < corners.length && corners.length > 3; i++) {
    const a = corners[(i - 1 + corners.length) % corners.length]!;
    const b = corners[i]!;
    const c = corners[(i + 1) % corners.length]!;
    if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 1e-6) {
      corners.splice(i, 1);
      i = -1;
    }
  }
  // Each corner rounded: an arc from the side it comes along to the side it leaves along.
  const m = corners.length;
  const arcs = corners.map((p, i) => {
    const a = corners[(i - 1 + m) % m]!;
    const b = corners[(i + 1) % m]!;
    const lu = dist(a, p);
    const lv = dist(p, b);
    const u = { x: (p.x - a.x) / lu, y: (p.y - a.y) / lu };
    const w = { x: (b.x - p.x) / lv, y: (b.y - p.y) / lv };
    const outer = u.x * w.y - u.y * w.x > 0;
    const rho = Math.min(outer ? R : Ri, lu / 2, lv / 2);
    const t1 = { x: p.x - rho * u.x, y: p.y - rho * u.y };
    const t2 = { x: p.x + rho * w.x, y: p.y + rho * w.y };
    const c = { x: t1.x + rho * w.x, y: t1.y + rho * w.y };
    const a1 = Math.atan2(t1.y - c.y, t1.x - c.x);
    let sweep = Math.atan2(t2.y - c.y, t2.x - c.x) - a1;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep <= -Math.PI) sweep += 2 * Math.PI;
    const k = Math.max(2, Math.ceil((Math.abs(sweep) * rho) / 6));
    return Array.from({ length: k + 1 }, (_, j) => ({ x: c.x + Math.cos(a1 + (sweep * j) / k) * rho, y: c.y + Math.sin(a1 + (sweep * j) / k) * rho }));
  });
  // Clockwise, from the end of the top-left corner's arc (just above the first letter), back to it.
  const outline: Pt[] = [];
  for (let i = 1; i <= m; i++) outline.push(...arcs[i % m]!);
  outline.unshift(arcs[0]!.at(-1)!);
  // Points evenly apart along it.
  const step = Math.max(2, options.step ?? low / 8);
  const even: Pt[] = [outline[0]!];
  let carry = 0;
  for (let i = 1; i < outline.length; i++) {
    const a = outline[i - 1]!;
    const b = outline[i]!;
    const l = dist(a, b);
    let s = step - carry;
    while (s <= l) {
      even.push({ x: a.x + ((b.x - a.x) * s) / l, y: a.y + ((b.y - a.y) * s) / l });
      s += step;
    }
    carry = l - (s - step);
  }
  if (dist(even.at(-1)!, outline[0]!) < step / 2) even.pop();
  // From the spot asked: the point nearest its place on the outline's bounds.
  const xs = even.map((p) => p.x);
  const ys = even.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const anchor: Record<Spot, Pt> = {
    "top-left": even[0]!,
    top: { x: (minX + maxX) / 2, y: minY },
    "top-right": { x: maxX - R, y: minY },
    right: { x: maxX, y: (minY + maxY) / 2 },
    "bottom-right": { x: maxX - R, y: maxY },
    bottom: { x: (minX + maxX) / 2, y: maxY },
    "bottom-left": { x: minX + R, y: maxY },
    left: { x: minX, y: (minY + maxY) / 2 },
  };
  let from = 0;
  even.forEach((p, i) => {
    if (dist(p, anchor[start]) < dist(even[from]!, anchor[start])) from = i;
  });
  const ring = [...even.slice(from), ...even.slice(0, from)];
  const ordered = turn === "cw" ? ring : [ring[0]!, ...ring.slice(1).reverse()];
  const extra = Math.round(ordered.length * Math.max(0, options.past ?? 0.02));
  return [...ordered, ...ordered.slice(0, extra + 1)];
}

// ——— A word search: its words and the words it never circles ———————————————————————————

const DIRS = { h: [1, 0], v: [0, 1], d: [1, 1], u: [1, -1] } as const;
export type Placed = { word: string; cells: [number, number][]; dir: keyof typeof DIRS };

/** A word as a printed word search writes it: capitals without accents (É is E), letters and digits only. */
export const plainLetters = (w: string) =>
  w
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/**
 * Where each word goes in the grid (cells inside the allowed part only, crossings only on the same letter), along a
 * row, down a column or a diagonal, read forwards; `grid` holds the letters already laid (the words found, before the
 * words she hides without a loop), and gets these.
 */
export function placeWords(
  words: string[],
  cols: number,
  rows: number,
  allowed: (c: number, r: number) => boolean,
  seed: string,
  rand: Chance,
  grid: Map<string, string> = new Map(),
): Placed[] {
  const placed: Placed[] = [];
  words.forEach((raw, wi) => {
    const word = plainLetters(raw);
    if (!word) return;
    for (let attempt = 0; attempt < 400; attempt++) {
      const dir = (["h", "v", "d", "u"] as const)[Math.floor(rand(`${seed}-d-${wi}-${attempt}`) * (attempt < 200 ? 4 : 1))]!;
      const [dx, dy] = DIRS[dir];
      const c0 = Math.floor(rand(`${seed}-c-${wi}-${attempt}`) * cols);
      const r0 = Math.floor(rand(`${seed}-r-${wi}-${attempt}`) * rows);
      const cells = Array.from(word).map((_, i) => [c0 + dx * i, r0 + dy * i] as [number, number]);
      const fits = cells.every(([c, r], i) => c >= 0 && c < cols && r >= 0 && r < rows && allowed(c, r) && (grid.get(`${c},${r}`) ?? word[i]) === word[i]);
      if (!fits) continue;
      cells.forEach(([c, r], i) => grid.set(`${c},${r}`, word[i]!));
      placed.push({ word, cells, dir });
      return;
    }
  });
  return placed;
}

// ——— A typed text, erased ————————————————————————————————————————————————————————————

/**
 * What a typed text shows at frame t of its start: `times`, the frame each unit (letter or word) comes; `erase`, the
 * frame the cursor goes back (from the same start), eating a unit every 30 / perSecond frames, the first at once, down
 * to `keep` units. How many units show, whether the hand is busy (typing or erasing: the caret holds still), and since
 * when it rests (the caret blinks from then).
 */
export function typedState(times: number[], t: number, erase?: { at: number; perSecond: number; keep: number }): { shown: number; busy: boolean; since: number } {
  const count = (f: number) => times.filter((x) => x <= f).length;
  if (!erase || t < erase.at) {
    const shown = count(t);
    const busy = shown < times.length;
    return { shown, busy, since: busy ? t : (times.at(-1) ?? 0) };
  }
  const typed = count(erase.at);
  const keep = Math.max(0, Math.min(typed, Math.round(erase.keep)));
  const every = 30 / Math.max(0.5, erase.perSecond);
  const eaten = Math.floor((t - erase.at) / every) + 1;
  const shown = Math.max(keep, typed - eaten);
  const busy = shown > keep;
  return { shown, busy, since: busy ? t : typed > keep ? erase.at + (typed - keep - 1) * every : erase.at };
}

// ——— A hand that never repeats ———————————————————————————————————————————————————————

/** How a written letter strays from the font's: its place (em), its angle (degrees), its width and its height. */
export type Stray = { dx: number; dy: number; rotate: number; sx: number; sy: number };

/**
 * Each letter of a line written by hand a little different from the last time it was written (« Carte au feutre »: the
 * two T of « THAT » are not the same): its height and width (never larger than the font's by more than 3 %, so a line
 * fitted to its width stays in it), its angle (±4°), its place on the line. `wobble` scales it all (0: the font itself).
 */
export function handStrays(count: number, seed: string, rand: Chance, wobble = 1): Stray[] {
  const w = Math.max(0, wobble);
  const spread = (key: string, i: number) => rand(`${seed}-${key}-${i}`) * 2 - 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    dx: spread("x", i) * 0.015 * w,
    dy: spread("y", i) * 0.035 * w + Math.sin(i * 0.9 + rand(`${seed}-p`) * 6) * 0.015 * w,
    rotate: spread("a", i) * 4 * w,
    sx: 1 - 0.04 * w + spread("w", i) * 0.06 * w,
    sy: 1 - 0.03 * w + spread("h", i) * 0.06 * w,
  }));
}

/** A line written by hand is a little crooked: its angle (degrees) and how far it drifts up or down (share of its height). */
export function handLine(seed: string, line: number, rand: Chance, wobble = 1): { tilt: number; shift: number } {
  return { tilt: (rand(`${seed}-tilt-${line}`) * 2 - 1) * 1.4 * wobble, shift: (rand(`${seed}-shift-${line}`) * 2 - 1) * 0.04 * wobble };
}

/**
 * A text cut into the lines a hand writes it in: its own line breaks, else `lines` lines (by default about ten letters
 * a line, five at most) as even as its words allow, never cutting a word.
 */
export function handBreak(text: string, lines?: number): string[] {
  const own = text
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (own.length !== 1) return own;
  const words = own[0]!.split(" ");
  const chars = own[0]!.length;
  const n = Math.max(1, Math.min(words.length, Math.round(lines ?? Math.min(5, Math.max(1, Math.round(chars / 10))))));
  if (n === 1) return own;
  // The cut whose longest line is the shortest (a small table over the words: cost[k][i], k lines for the first i words).
  const span = (a: number, b: number) => words.slice(a, b).join(" ").length;
  const cost = Array.from({ length: n + 1 }, () => Array<number>(words.length + 1).fill(Infinity));
  const from = Array.from({ length: n + 1 }, () => Array<number>(words.length + 1).fill(0));
  cost[0]![0] = 0;
  for (let k = 1; k <= n; k++)
    for (let i = k; i <= words.length; i++)
      for (let j = k - 1; j < i; j++) {
        const c = Math.max(cost[k - 1]![j]!, span(j, i));
        if (c < cost[k]![i]!) {
          cost[k]![i] = c;
          from[k]![i] = j;
        }
      }
  const out: string[] = [];
  let i = words.length;
  for (let k = n; k >= 1; k--) {
    const j = from[k]![i]!;
    out.unshift(words.slice(j, i).join(" "));
    i = j;
  }
  return out;
}

/** A number from a text (FNV-1a), the seed of a texture. */
const hashOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
/** A seeded sequence of numbers in [0, 1) (mulberry32). */
const sequence = (seed: string) => {
  let a = hashOf(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * The textures a hand's stroke is drawn with, made once instead of a noise filter recomputed at every image (an
 * feTurbulence over a card cost about a third of a second an image): `slow`, a smooth noise `cells` values a side (its
 * red and green the two directions a line strays in, its alpha full), and `fine`, a grain (its alpha a value at each
 * pixel), both `size` × `size` RGBA bytes.
 */
export function strokeTexture(kind: "slow" | "fine", size: number, seed: string, cells = 8): Uint8ClampedArray {
  const n = Math.max(2, Math.round(size));
  const out = new Uint8ClampedArray(n * n * 4);
  const next = sequence(`${kind}-${seed}`);
  if (kind === "fine") {
    for (let i = 0; i < n * n; i++) {
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 0;
      out[i * 4 + 3] = Math.floor(next() * 256);
    }
    return out;
  }
  // Value noise: random values on a grid (wrapping), joined by smooth curves.
  const k = Math.max(1, Math.round(cells));
  const grid = [0, 1].map(() => Array.from({ length: k * k }, () => next()));
  const ease = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const gx = (x / n) * k;
      const gy = (y / n) * k;
      const [x0, y0] = [Math.floor(gx), Math.floor(gy)];
      const [tx, ty] = [ease(gx - x0), ease(gy - y0)];
      const at = (g: number[], i: number, j: number) => g[((j % k) * k + (i % k)) % (k * k)]!;
      const value = (g: number[]) => {
        const top = at(g, x0, y0) * (1 - tx) + at(g, x0 + 1, y0) * tx;
        const bottom = at(g, x0, y0 + 1) * (1 - tx) + at(g, x0 + 1, y0 + 1) * tx;
        return top * (1 - ty) + bottom * ty;
      };
      const p = (y * n + x) * 4;
      out[p] = Math.round(value(grid[0]!) * 255);
      out[p + 1] = Math.round(value(grid[1]!) * 255);
      out[p + 2] = 128;
      out[p + 3] = 255;
    }
  return out;
}

/** The slots of a hand's lines in a box of this height: the same for each, the last `last` times taller (its name, its offer). */
export function handSlots(lines: number, height: number, last = 1.3): { top: number; h: number }[] {
  const n = Math.max(1, Math.round(lines));
  const big = n > 1 ? Math.max(0.5, last) : 1;
  const unit = height / (n - 1 + big);
  return Array.from({ length: n }, (_, i) => ({ top: i * unit, h: i === n - 1 ? unit * big : unit }));
}

// ——— The almond of an eye ————————————————————————————————————————————————————————————

/**
 * An eye's almond in a box w × h (px from its top-left corner), as an SVG path: two lids meeting at the box's left and
 * right middle, open by `open` (0: shut on the middle line; 1: touching the box's top and bottom), `lids` the share
 * each opens (upper, lower: [1, 0.2] is an eye narrowed from below, like the one of « Silhouette et mot » as it closes
 * on the picture).
 */
export function almondPath(w: number, h: number, open: number, lids: [number, number] = [1, 1]): string {
  const o = clamp01(open);
  const cy = h / 2;
  const up = (h / 2) * o * clamp01(lids[0]);
  const down = (h / 2) * o * clamp01(lids[1]);
  // A cubic with its handles at a fifth of the width from each corner peaks at three quarters of their height.
  const a = w * 0.2;
  const f = (n: number) => (Math.round(n * 10) / 10).toString();
  return `M 0 ${f(cy)} C ${f(a)} ${f(cy - up / 0.75)} ${f(w - a)} ${f(cy - up / 0.75)} ${f(w)} ${f(cy)} C ${f(w - a)} ${f(cy + down / 0.75)} ${f(a)} ${f(cy + down / 0.75)} 0 ${f(cy)} Z`;
}
