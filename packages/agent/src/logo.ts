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
