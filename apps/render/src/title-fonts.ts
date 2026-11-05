/**
 * Her brand as a composition gets it: its titles in the font her signature gives titles (Tristan's account: titles in
 * its text font, Inter Tight, bold and tight, a key word in Instrument Serif italic; a model drew its titles in its
 * first font, Instrument Serif, and ignored it). `displayFont` is then that font; the other stays as `accentFont`.
 * A monospace text font is never a title's (as the Reel's own texts: its display font then).
 */
export function titleFonts<B extends { displayFont: string; bodyFont: string; signature?: { titles?: { font?: "display" | "body" } } }>(brand: B): B & { accentFont: string } {
  const body = brand.signature?.titles?.font === "body" && brand.bodyFont !== brand.displayFont && !/mono/i.test(brand.bodyFont);
  return body ? { ...brand, displayFont: brand.bodyFont, accentFont: brand.displayFont } : { ...brand, accentFont: brand.displayFont };
}
