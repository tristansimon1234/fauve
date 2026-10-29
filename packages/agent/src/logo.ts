// How a logo is shown over a dark picture (the Reel's end card): as it is, in
// white (a dark one-colour logo on a transparent background, the most common
// case: black on dark would vanish), or on a light plate (a dark logo in colours,
// which white would spoil). Read once from its pixels.

export type LogoOnDark = "as_is" | "white" | "plate";

/** From the logo's RGBA pixels (any size; a small thumbnail is enough). */
export function logoOnDark(rgba: Uint8Array | Buffer): LogoOnDark {
  let opaque = 0;
  let total = 0;
  let light = 0;
  let chroma = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    total++;
    const a = rgba[i + 3]!;
    if (a < 128) continue;
    opaque++;
    const r = rgba[i]! / 255;
    const g = rgba[i + 1]! / 255;
    const b = rgba[i + 2]! / 255;
    light += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    chroma += Math.max(r, g, b) - Math.min(r, g, b);
  }
  // Nothing drawn, or a logo with its own background (a square or a badge): as it is.
  if (!opaque || opaque / total > 0.97) return "as_is";
  if (light / opaque >= 0.4) return "as_is";
  return chroma / opaque < 0.15 ? "white" : "plate";
}

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

export type LogoColor = { color: string; share: number; background?: true };

/**
 * The colours a logo is drawn in, from its RGBA pixels (a small thumbnail is enough), the most
 * present first with their share of what is drawn; given to the reading of her brand as facts, her
 * palette starts there when she has no site. Transparent pixels are not the logo. The colour all
 * around its edge is its background: left out when it is white (a logo saved on white), kept and
 * marked when it is a colour (white letters on a red square: the red is the brand). Close shades
 * (the edges of the letters) are merged.
 */
export function logoColors(rgba: Uint8Array | Buffer, width: number, height: number): LogoColor[] {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const edge: number[] = [];
  for (let x = 0; x < width; x++) edge.push(at(x, 0), at(x, height - 1));
  for (let y = 1; y < height - 1; y++) edge.push(at(0, y), at(width - 1, y));
  const filled = edge.filter((i) => rgba[i + 3]! >= 128);
  let background: { r: number; g: number; b: number } | null = null;
  if (filled.length >= edge.length * 0.6) {
    const sum = { r: 0, g: 0, b: 0 };
    for (const i of filled) {
      sum.r += rgba[i]!;
      sum.g += rgba[i + 1]!;
      sum.b += rgba[i + 2]!;
    }
    const mean = { r: sum.r / filled.length, g: sum.g / filled.length, b: sum.b / filled.length };
    const near = filled.filter((i) => Math.hypot(rgba[i]! - mean.r, rgba[i + 1]! - mean.g, rgba[i + 2]! - mean.b) < 30);
    if (near.length >= filled.length * 0.8) background = mean;
  }
  const white = background !== null && Math.min(background.r, background.g, background.b) > 235;
  const merged: { r: number; g: number; b: number; n: number; background: boolean }[] = [];
  let total = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3]! < 128) continue;
    const [r, g, b] = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!];
    const onBackground = background !== null && Math.hypot(r - background.r, g - background.g, b - background.b) < 30;
    if (onBackground && white) continue;
    total++;
    const near = merged.find((m) => Math.hypot(m.r - r, m.g - g, m.b - b) < 40);
    if (near) {
      near.r += (r - near.r) / (near.n + 1);
      near.g += (g - near.g) / (near.n + 1);
      near.b += (b - near.b) / (near.n + 1);
      near.n++;
      near.background ||= onBackground;
    } else merged.push({ r, g, b, n: 1, background: onBackground });
  }
  if (!total) return [];
  return merged
    .filter((m) => m.n / total >= 0.03)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((m) => ({ color: hex(m.r, m.g, m.b), share: Math.round((m.n / total) * 100) / 100, ...(m.background ? { background: true as const } : {}) }));
}

/** What Gemini is asked of a logo, read once: the letters it writes. */
export const LOGO_WORDS_PROMPT = `Copy the letters written in this logo, in reading order, exactly as they are. Only what is written, no description. A logo with no letters at all (a drawing, a character, a symbol) gives an empty string.`;

/**
 * Whether the words a logo writes already say the business's name: the end card then does not write
 * it again under the logo. A drawing or a mascot says nothing: taken for a name, Edith's mascot left
 * her end card without one.
 */
export function logoSaysName(words: string, name: string): boolean {
  const plain = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
  const said = plain(words);
  const named = plain(name);
  if (!said || !named) return false;
  // « LUNE » says Studio Lune too; a monogram (« SL ») does not.
  return said.includes(named) || (said.length >= 3 && named.includes(said));
}
