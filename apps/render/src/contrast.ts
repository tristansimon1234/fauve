// Whether an animation's words can be read on the picture under them. The scene check lays a scene out
// over grey cards, so it is given what the picture really is: a coarse grid of colours of each shot (a
// composition's Footage) or of the footage under it at some of its frames (an animation over her video),
// taken from the images of the Reel the motion designer sees before writing. A coral « Edith » held over
// a café's red awning could not be read on four shots of a Reel copied by Tristan.

/** The grid: columns and rows over a 1080 × 1920 picture (40 px cells). */
export const GRID = { cols: 27, rows: 48 } as const;

export type Rgb = [number, number, number];

/**
 * What the picture under a scene really is, as coarse grids of colours (base64 bytes, see gridOf): each of a
 * composition's shots, by its index (`shots`), and the footage under an animation at some of its frames.
 */
export type SceneBackdrop = { shots?: Record<string, string>; frames?: { frame: number; grid: string }[] };

/** WCAG relative luminance of an sRGB colour. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** OKLab of an sRGB colour (Björn Ottosson's matrices). */
export function oklab([r, g, b]: Rgb): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** How far apart two colours look (OKLab distance: about 0.02 is just seen, 0.3 is far). */
export function colourDistance(a: Rgb, b: Rgb): number {
  const [p, q] = [oklab(a), oklab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/**
 * A text colour lost on a background: hardly any contrast (white on a bright sky), or little contrast
 * in a close colour (coral on red, a lilac on a mauve wall).
 */
export function blends(text: Rgb, under: Rgb): boolean {
  const ratio = contrast(text, under);
  return ratio < 1.6 || (ratio < 2.5 && colourDistance(text, under) < 0.18);
}

/** A computed CSS colour (rgb() or rgba()), or null (transparent, a keyword the browser did not resolve). */
export function parseColor(css: string): { rgb: Rgb; alpha: number } | null {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(css.trim());
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: a };
}

/** The shadows of a computed text-shadow (Chrome writes the colour first: « rgba(0, 0, 0, 0.6) 0px 3px 18px, … »). */
export function parseShadows(css: string): { color: { rgb: Rgb; alpha: number }; blur: number }[] {
  if (!css || css === "none") return [];
  // Split on the commas between shadows, never those inside a colour's parentheses.
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")") depth--;
    else if (css[i] === "," && depth === 0) {
      parts.push(css.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(css.slice(start));
  return parts.flatMap((part) => {
    const color = parseColor(/rgba?\([^)]*\)/.exec(part)?.[0] ?? "");
    const lengths = [...part.replace(/rgba?\([^)]*\)/, "").matchAll(/(-?[\d.]+)px/g)].map((x) => Number(x[1]));
    return color ? [{ color, blur: lengths[2] ?? 0 }] : [];
  });
}

/** The tightest blur a shadow may have to outline the letters (a soft glow reads as a haze, not an edge). */
const TIGHT_BLUR = 6;

/**
 * Letters that carry their own edge, readable on any picture: a stroke of 2 px or more, or tight shadows
 * that together are dense enough, in a colour that stands out from the text.
 */
export function outlined(text: Rgb, shadows: string, strokeWidth: number, strokeColor: string): boolean {
  const stroke = parseColor(strokeColor);
  if (strokeWidth >= 2 && stroke && stroke.alpha >= 0.6 && contrast(text, stroke.rgb) >= 3) return true;
  const tight = parseShadows(shadows).filter((s) => s.blur <= TIGHT_BLUR && contrast(text, s.color.rgb) >= 3);
  const density = 1 - tight.reduce((left, s) => left * (1 - Math.min(1, s.color.alpha)), 1);
  return density >= 0.6;
}

/**
 * The grid of a picture, from its pixels (RGB, `width` × `height`, any size): each cell's median colour,
 * so the thin strokes of a text written on it do not change it. Bytes, row after row.
 */
export function gridOf(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(GRID.cols * GRID.rows * 3);
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1] ?? 0;
  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) {
      const [x0, x1] = [Math.floor((col * width) / GRID.cols), Math.max(Math.floor((col * width) / GRID.cols) + 1, Math.floor(((col + 1) * width) / GRID.cols))];
      const [y0, y1] = [Math.floor((row * height) / GRID.rows), Math.max(Math.floor((row * height) / GRID.rows) + 1, Math.floor(((row + 1) * height) / GRID.rows))];
      const channels: [number[], number[], number[]] = [[], [], []];
      for (let y = y0; y < Math.min(y1, height); y++) {
        for (let x = x0; x < Math.min(x1, width); x++) {
          const i = (y * width + x) * 3;
          channels[0].push(rgb[i]!);
          channels[1].push(rgb[i + 1]!);
          channels[2].push(rgb[i + 2]!);
        }
      }
      const at = (row * GRID.cols + col) * 3;
      out[at] = median(channels[0]);
      out[at + 1] = median(channels[1]);
      out[at + 2] = median(channels[2]);
    }
  }
  return out;
}

/** A grid sent as base64, back to its bytes (in the browser, without Buffer). */
export function decodeGrid(base64: string): Uint8Array {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type Box = [number, number, number, number];

/**
 * The colours of the grid under a text's box (px of the frame), the grid's picture laid in `within` (a
 * composition's box for a shot, the whole frame otherwise) as the shot is drawn: covering it, centred.
 */
export function cellsUnder(grid: Uint8Array, box: Box, within: Box): Rgb[] {
  const [bx0, by0, bx1, by1] = within;
  const scale = Math.max((bx1 - bx0) / 1080, (by1 - by0) / 1920);
  const ox = bx0 + (bx1 - bx0 - 1080 * scale) / 2;
  const oy = by0 + (by1 - by0 - 1920 * scale) / 2;
  const toCol = (x: number) => Math.max(0, Math.min(GRID.cols - 1, Math.floor((((x - ox) / scale) * GRID.cols) / 1080)));
  const toRow = (y: number) => Math.max(0, Math.min(GRID.rows - 1, Math.floor((((y - oy) / scale) * GRID.rows) / 1920)));
  const [x0, y0, x1, y1] = [Math.max(box[0], bx0), Math.max(box[1], by0), Math.min(box[2], bx1), Math.min(box[3], by1)];
  if (x1 <= x0 || y1 <= y0) return [];
  const cells: Rgb[] = [];
  for (let row = toRow(y0); row <= toRow(y1 - 1); row++) {
    for (let col = toCol(x0); col <= toCol(x1 - 1); col++) {
      const at = (row * GRID.cols + col) * 3;
      cells.push([grid[at]!, grid[at + 1]!, grid[at + 2]!]);
    }
  }
  return cells;
}

/**
 * Whether a text is lost on the cells under it (most of them), and its median contrast there. A text
 * that is not fully opaque is seen mixed with what is under it.
 */
export function lostOn(text: Rgb, alpha: number, cells: Rgb[]): { lost: boolean; ratio: number } | null {
  if (!cells.length) return null;
  const seen = (under: Rgb): Rgb => (alpha >= 1 ? text : (text.map((c, i) => c * alpha + under[i]! * (1 - alpha)) as Rgb));
  const lost = cells.filter((c) => blends(seen(c), c)).length;
  const ratios = cells.map((c) => contrast(seen(c), c)).sort((a, b) => a - b);
  return { lost: lost >= cells.length / 2, ratio: ratios[ratios.length >> 1]! };
}
