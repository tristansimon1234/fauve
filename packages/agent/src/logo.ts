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
