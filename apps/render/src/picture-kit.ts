// The arithmetic of the picture kit (Picture.tsx, and the pieces it adds to Graphic.tsx, Kit.tsx and Subject): image
// effects the models' fiches measured on their originals and found missing (docs/animations.md, « Kit d'image »). Pure,
// no imports, so the tests read it; the components only draw what it computes, from the frame number alone.

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** A deterministic share in [0, 1) for a seed (FNV-1a): the same at every render, no Math.random. */
export function hash01(seed: string): number {
  let x = 2166136261;
  for (let i = 0; i < seed.length; i++) x = Math.imul(x ^ seed.charCodeAt(i), 16777619) >>> 0;
  return x / 4294967296;
}

// ——— Flash expose: a camera's flash that overexposes the picture, never a white card ————————————————————————————

/**
 * The overexposure of a camera's flash at image `t` from its brightest one, as measured on « a day in PARIS »
 * (docs/fiches/journee.md, effect 4): the last image(s) of the shot that goes ×1.2 and +14 % of white, the first of the
 * one that comes ×1.35 and +18 %, its second ×1.18 and +13 %, then nothing; each image still seen, its whites burnt.
 * `before`: images lit before the brightest; `frames`: images from it (more than 2: the last ones fading out);
 * `strength` scales the light. [gain (the light multiplied), lift (white laid in screen)], or null.
 */
export function exposeAt(t: number, before = 1, frames = 2, strength = 1): [number, number] | null {
  if (!Number.isFinite(t) || t < -Math.max(0, before) || t >= Math.max(1, frames)) return null;
  const s = Math.max(0, strength);
  const fade = t <= 1 || frames <= 2 ? 1 : 1 - (t - 1) / (frames - 1);
  const [g, l] = t < 0 ? [0.2, 0.14] : t === 0 ? [0.35, 0.18] : [0.18 * fade, 0.13 * fade];
  return [round(1 + g * s), round(l * s)];
}

// ——— Burn: a film burn, coloured light in screen around a cut ———————————————————————————————————————————————

/** Where a burn's light comes in from. */
export type BurnFrom = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
/** One image of a burn: its offset from the cut, its light (a CSS background laid in screen), how much, and an optional filter on what is under it. */
export type BurnStep = [offset: number, light: string, opacity: number, under?: string];

const ANCHORS: Record<BurnFrom, string> = {
  left: "0% 55%",
  right: "100% 55%",
  top: "50% 0%",
  bottom: "50% 100%",
  "top-left": "0% 0%",
  "top-right": "100% 0%",
  "bottom-left": "0% 100%",
  "bottom-right": "100% 100%",
};
const AWAY: Record<BurnFrom, string> = {
  left: "to right",
  right: "to left",
  top: "to bottom",
  bottom: "to top",
  "top-left": "to bottom right",
  "top-right": "to bottom left",
  "bottom-left": "to top right",
  "bottom-right": "to top left",
};

/** A colour as its r, g, b (0 to 255), from #rgb or #rrggbb; null otherwise. */
export function rgbOf(color: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color ?? "").trim());
  if (!m) return null;
  const hex = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * A film burn's light image by image around its cut (offsets from the cut, the cut's own image 0), made like the three
 * of « a day in PARIS » (docs/fiches/journee.md, effect 5): a glow of its colour coming in from a side or a corner,
 * growing, the strongest just before the cut where it washes over the whole picture (`wash`: its colour there, a paler
 * one by default), the new shot still washed on its first image, then a rest of it in the bottom right corner
 * (`after` images). `before` 3 to 6 images; `strength` scales it.
 */
export function burnSteps({
  from = "left",
  color = "#ff6040",
  wash,
  before = 4,
  after = 1,
  strength = 1,
}: { from?: BurnFrom; color?: string; wash?: string; before?: number; after?: number; strength?: number } = {}): BurnStep[] {
  const rgb = rgbOf(color) ?? [255, 96, 64];
  const pale = rgbOf(wash ?? "") ?? (rgb.map((v) => Math.round(v + (255 - v) * 0.55)) as [number, number, number]);
  const c = (a: number, k = rgb) => `rgba(${k.join(",")},${round(a, 3)})`;
  const flat = `#${pale.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  const at = ANCHORS[from] ?? ANCHORS.left;
  const s = Math.max(0, strength);
  const n = Math.max(2, Math.min(6, Math.round(before)));
  const steps: BurnStep[] = [];
  for (let i = n; i >= 1; i--) {
    if (i === 1) steps.push([-1, flat, round(0.86 * s, 3)]);
    else if (i === 2) steps.push([-2, `linear-gradient(${AWAY[from] ?? AWAY.left}, ${c(0.95)}, ${c(0.45)} 60%, ${c(0.15)})`, round(Math.min(1, s), 3)]);
    else {
      // The glow grows as the cut nears: from a narrow ellipse at its edge to most of the picture.
      const p = (n - i) / Math.max(1, n - 3);
      steps.push([-i, `radial-gradient(ellipse ${Math.round(45 + 30 * p)}% ${Math.round(90 + 20 * p)}% at ${at}, ${c(0.9 + 0.05 * p)}, ${c(0)} 100%)`, round(Math.min(1, s), 3)]);
    }
  }
  steps.push([0, flat, round(0.62 * s, 3)]);
  for (let k = 1; k <= Math.max(0, Math.round(after)); k++) steps.push([k, `radial-gradient(circle at 100% 100%, ${c(0.82)}, ${c(0)} 55%)`, round(s * (1 - (k - 1) / Math.max(1, after)), 3)]);
  return steps;
}

// ——— Smear and Punch: a whip blur and a punch zoom inside one shot ——————————————————————————————————————————

/** How far a punch zoom has gone `t` images after its cut, over `frames` images to `scale` (an ease in and out, as « Quart de tour »'s ×2.3 in eight). */
export function punchAt(t: number, frames = 8, scale = 2.3): number {
  const x = clamp01(t / Math.max(1, frames));
  return 1 + (scale - 1) * x * x * (3 - 2 * x);
}

/**
 * The copies a punch zoom lays at image `t` (each { scale, opacity }, the first the picture itself): four, a little more
 * enlarged each, while it rushes (a zoom blur), one when it is held enlarged, none before it starts (the picture as it is).
 */
export function punchCopies(t: number, frames = 8, scale = 2.3, blur = true): { scale: number; opacity: number }[] {
  const s = punchAt(t, frames, scale);
  const smear = blur ? Math.min(0.2, (s - punchAt(t - 1, frames, scale)) / s) : 0;
  if (smear > 0.005) return [0, 1, 2, 3].map((k) => ({ scale: s * (1 + (smear * k) / 3), opacity: k ? 0.3 : 1 }));
  return s > 1 ? [{ scale: s, opacity: 1 }] : [];
}

// ——— LensEdges: the edges of an anamorphic lens ————————————————————————————————————————————————————————————

/** The mask of a lens edge's band, from the frame's edge inward: the outermost px left to the picture, full, then fading out. */
export function edgeFade(side: "top" | "bottom" | "left" | "right", hold = 8, full = 0.32): string {
  const to = side === "top" ? "to bottom" : side === "bottom" ? "to top" : side === "left" ? "to right" : "to left";
  return `linear-gradient(${to}, transparent 0px, #000 ${Math.round(hold)}px, #000 ${Math.round(full * 100)}%, transparent 100%)`;
}

// ——— WindowStar: windows onto one shot, in a star, opening one by one ———————————————————————————————————————

/** A band of a star: its angle (degrees, 0 to the right, turning clockwise), its width and where it starts from the centre (px). */
export type Ray = { angle: number; width: number; from: number };

/**
 * The six bands of « Éventail de bandes » (docs/fiches/eventail.md, effect 1), measured on its original's short side `S`:
 * three lines through the middle, each in two halves (« \ », « / », then « | »), the diagonals 36° from the horizontal
 * (54° turned upright), 14 % wide, cut square 13.5 % from the centre, the upright ones 15.5 % wide and 11.5 % from it,
 * so their ends draw a hexagon round the square. `upright`: turned a quarter, for a vertical frame.
 */
export function starRays(S: number, upright = false): Ray[] {
  return [36, 216, 144, 324, 270, 90].map((a, k) => ({ angle: a + (upright ? 90 : 0), width: (k >= 4 ? 0.155 : 0.14) * S, from: (k >= 4 ? 0.115 : 0.135) * S }));
}

/**
 * The clip of a star of windows (an SVG path, px of its box): the square at its centre (side `square`, none at 0), then
 * each band shown: a full one reaches `reach` px from the centre (past the box's corners), a growing one `grow` of the
 * way (0 to 1) from its inner end.
 */
export function starPath(center: Point, square: number, rays: (Ray & { grow?: number })[], reach: number): string {
  const { x: cx, y: cy } = center;
  const parts: string[] = [];
  if (square > 0) parts.push("M" + (cx - square / 2).toFixed(1) + " " + (cy - square / 2).toFixed(1) + " h" + square.toFixed(1) + " v" + square.toFixed(1) + " h" + (-square).toFixed(1) + " Z");
  for (const r of rays) {
    const a = (r.angle * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const at = (d: number, s: number) => (cx + ux * d - uy * s).toFixed(1) + " " + (cy + uy * d + ux * s).toFixed(1);
    const end = r.grow === undefined ? reach : r.from + (reach - r.from) * clamp01(r.grow);
    parts.push("M" + at(r.from, -r.width / 2) + " L" + at(end, -r.width / 2) + " L" + at(end, r.width / 2) + " L" + at(r.from, r.width / 2) + " Z");
  }
  return parts.join(" ");
}

// ——— Tiles that land: each print laid askew, then straight ——————————————————————————————————————————————————

/**
 * How a tile lies while it lands (« Mosaïque qui change », docs/fiches/mosaique.md, effect 3): askew 0.4° to 1.6°, one
 * way then the other from one tile to the next in the order they change (the first counterclockwise), a pixel to three
 * off its place. `rank`: its place in the order the tiles of its picture change; `k`: which picture of the tiles.
 */
export function landPose(rank: number, k: number, tile: number, count: number, seed: string): { angle: number; dx: number; dy: number } {
  const way = (k * count + rank) % 2 ? 1 : -1;
  return {
    angle: round(way * (0.4 + 1.2 * hash01(`${seed}-lean-${k}-${tile}`)), 2),
    dx: Math.round((hash01(`${seed}-nudge-x-${k}-${tile}`) - 0.5) * 6),
    dy: Math.round((hash01(`${seed}-nudge-y-${k}-${tile}`) - 0.5) * 6),
  };
}

// ——— LumaFade: the picture fading out by its light ———————————————————————————————————————————————————————————

/**
 * Where a fade by light is at a frame (0: all there, 1: all gone), over `frames` images from `at`, as the pile of
 * « this is Joe Taylor » goes (docs/fiches/table.md, effect 3: the darkest half gone on its first image, only the white
 * of a plate left on its third and fourth, nothing on its fifth); `mode` "in": the reverse, the brightest coming first.
 */
export function lumaProgress(frame: number, at: number, frames = 4, mode: "out" | "in" = "out"): number {
  const p = clamp01((frame - at + 1) / (Math.max(1, frames) + 1));
  return mode === "in" ? 1 - p : p;
}

/**
 * The colour matrix (feColorMatrix values) of a fade by light at progress `p`: the colours kept, each point's alpha from
 * its light, gone once its light is under a threshold that rises from below black to white (`soft`: the width of light
 * that fades at once). `invert`: the light goes first instead (the threshold falls from white).
 */
export function lumaMatrix(p: number, soft = 0.35, invert = false): string {
  const w = Math.max(0.02, soft);
  const t = -w + clamp01(p) * (1 + w);
  const k = [0.2126, 0.7152, 0.0722].map((c) => round((invert ? -c : c) / w, 4));
  const offset = invert ? round((1 - t) / w, 4) : round(-t / w, 4);
  return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${k[0]} ${k[1]} ${k[2]} 0 ${offset}`;
}

// ——— Echo: an element's positions a few images earlier ————————————————————————————————————————————————————————

/** The copies of an echo, the oldest first: how many images back each is drawn, its rank, its opacity (paler and paler). */
export function echoCopies(count = 4, gap = 1, fade = 0.6): { back: number; k: number; opacity: number }[] {
  const n = Math.max(0, Math.min(12, Math.round(count)));
  const g = Math.max(1, Math.round(gap));
  return Array.from({ length: n }, (_, i) => {
    const k = n - i;
    return { back: k * g, k, opacity: round(Math.pow(clamp01(fade), k), 3) };
  });
}

// ——— CastShadow: a cut-out's shadow on the ground ————————————————————————————————————————————————————————————

/**
 * How a cut-out's shadow is laid, from the box its subject is in at this frame (px): cast on the ground from her feet
 * (its bottom middle), flattened to `length` of her height and slanted `angle` degrees toward `direction` (« Aplat »:
 * 0.26 and 38°), or dropped behind her (`kind` "drop": moved by dx, dy).
 */
export function shadowPose(box: Box, kind: "cast" | "drop" = "cast", angle = 38, length = 0.26, direction: "left" | "right" = "right", dx = 14, dy = 18): { transformOrigin: string; transform: string } {
  if (kind === "drop") return { transformOrigin: "0 0", transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px)` };
  const feet = { x: Math.round(box.x + box.w / 2), y: Math.round(box.y + box.h) };
  const a = Math.max(0, Math.min(80, Math.abs(angle))) * (direction === "left" ? -1 : 1);
  return { transformOrigin: `${feet.x}px ${feet.y}px`, transform: `skewX(${round(a, 2)}deg) scaleY(${-round(Math.max(0.02, Math.min(2, length)), 3)})` };
}

// ——— DotGrid: a shape built dot by dot ——————————————————————————————————————————————————————————————————————————

/** How a dot grid builds itself: from the bottom up with some scatter (the hand of « Présente-toi »), at random, in reading order, from the top down. */
export type DotBuild = "rise" | "random" | "reading" | "fall";

/** When a dot of a grid of cols × rows appears, as a share of its build (0 first, 1 last). */
export function dotOrder(build: DotBuild, c: number, r: number, cols: number, rows: number, seed: string): number {
  const x = cols <= 1 ? 0 : c / (cols - 1);
  const y = rows <= 1 ? 0 : r / (rows - 1);
  const chance = hash01(`${seed}-${c}-${r}`);
  if (build === "random") return chance;
  if (build === "reading") return (r * cols + c) / Math.max(1, cols * rows - 1);
  if (build === "fall") return 0.7 * y + 0.3 * chance;
  void x;
  return 0.7 * (1 - y) + 0.3 * chance;
}

// ——— Ascii: the picture redrawn in small characters or dots by its light ——————————————————————————————————————

/** Small characters on a 3 × 5 grid (rows from the top, 1 = ink), from the lightest to the densest: their union at a light is what shows. */
const RAMP: string[][] = [
  ["000", "000", "000", "000", "010"], // .
  ["000", "010", "000", "010", "000"], // :
  ["000", "000", "111", "000", "000"], // -
  ["000", "010", "111", "010", "000"], // +
  ["101", "010", "101", "010", "101"], // x and *
  ["010", "111", "010", "111", "010"], // #
  ["111", "101", "111", "101", "111"], // 8
  ["111", "111", "111", "111", "111"], // █
];

/**
 * The threshold tile of a pass in characters or dots (`w` × `h` px, a cell): for each pixel, the light from which it is
 * inked (0 to 1). Characters: a ramp of small glyphs, each pixel inked from the first glyph that has it, so a cell
 * reads ., :, +, #… as its light rises; dots: a disc growing from the cell's middle with the light (a halftone).
 */
export function glyphTile(w: number, h: number, kind: "chars" | "dots" = "chars"): number[] {
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  const out: number[] = [];
  if (kind === "dots") {
    const r = Math.hypot(W / 2, H / 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.push(round(Math.min(1, Math.hypot(x + 0.5 - W / 2, (y + 0.5 - H / 2) * (W / H)) / (r * Math.min(1, W / H) * 0.86)), 3));
    return out;
  }
  // The glyph's 3 × 5 grid laid in the cell, a margin of a pixel to the right and below (letters do not touch).
  const gw = Math.max(1, W - 1);
  const gh = Math.max(1, H - 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = Math.floor((x * 3) / gw);
      const gy = Math.floor((y * 5) / gh);
      const k = x >= gw || y >= gh ? -1 : RAMP.findIndex((g) => g[gy]?.[gx] === "1");
      out.push(k < 0 ? 1 : round((k + 0.5) / RAMP.length, 3));
    }
  return out;
}

/** A tile as an SVG image, a pixel of each colour ([r, g, b], 0 to 255), for an feImage: no canvas, the same everywhere. */
function pixelImage(colours: [number, number, number][], w: number, h: number): string {
  const rects = colours.map(([r, g, b], i) => `<rect x="${i % w}" y="${Math.floor(i / w)}" width="1" height="1" fill="rgb(${r},${g},${b})"/>`).join("");
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${rects}</svg>`)}`;
}

/** A threshold tile as an SVG image (a grey pixel per value). */
export function tileImage(values: number[], w: number, h: number): string {
  return pixelImage(values.map((v) => { const g = Math.round(clamp01(v) * 255); return [g, g, g] as [number, number, number]; }), w, h);
}

/**
 * The displacement tile that reads a picture once per cell (an feDisplacementMap, tiled: every pixel of a cell moved to
 * its cell's middle, red the x and green the y, over `scale` px), in place of a sampling by flood, tile and morphology,
 * which cost 3,5 s an image at 1080 × 1920 for 0,13 s this way.
 */
export function cellRamp(w: number, h: number): { href: string; scale: number; shifts: [number, number][] } {
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  const scale = 2 * Math.max(W, H);
  const shifts: [number, number][] = [];
  const colours: [number, number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s: [number, number] = [Math.floor(W / 2) - x, Math.floor(H / 2) - y];
      shifts.push(s);
      colours.push([Math.round(255 * (0.5 + s[0] / scale)), Math.round(255 * (0.5 + s[1] / scale)), 0]);
    }
  return { href: pixelImage(colours, W, H), scale, shifts };
}

// ——— Subject part: one piece of a named object, alone ————————————————————————————————————————————————————————

/**
 * The clip of one piece of an object where a Subject is laid (an inset of its box, px), from that piece's box on the
 * frame (SubjectParts) and a pad round it; null when the piece is not there.
 */
export function pieceInset(piece: Box | undefined, laid: { left: number; top: number; width: number; height: number }, pad = 0): string | null {
  if (!piece || !(piece.w > 0) || !(piece.h > 0)) return null;
  const top = piece.y - pad - laid.top;
  const left = piece.x - pad - laid.left;
  const right = laid.left + laid.width - (piece.x + piece.w + pad);
  const bottom = laid.top + laid.height - (piece.y + piece.h + pad);
  return `inset(${[top, right, bottom, left].map((v) => Math.max(0, Math.round(v)) + "px").join(" ")})`;
}
