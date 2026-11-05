import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Celui-là, celui-là… », the effect (docs/fiches/celui-la.md, effects 1 to 4; its whole Reel is skills/celui-la.ts,
// version 1): over a run of her product shots the editor cut on the beats, one a beat, the same playful pointing word
// (« Celui-là ») lands at once on each cut, each time at another place of the frame (the original's seven places, then
// five more of the same kind: never twice in a region, sometimes on the product, sometimes beside it); on its last shot
// (her series together, her favourite piece placed last), her hesitation typed letter by letter from its left edge
// (« Eeeet… ») while the music holds its breath (it stops just after that cut, its hit ringing), held, faded, then her
// last word alone in the middle as the music comes back, on a whole beat, held to its end; then the montage resumes.
// Kept from the model: its lettering (her title font, upright, sentence case, one size: the original's « This », 6,5 %
// of the height from its top to its baseline), its ink (the original's pale cream yellow where it reads on her picture,
// a deep warm ink where the picture under the word is too bright: her light read under each word, LightUnder), its thin
// edge of the other tone, its places in the safe zone, no animation but the typing. Left out: its hail, its stop word
// and « Regarde » on her empty display (the montage's own opening is the editor's), its format and colour settings (the
// montage frames her shots), its ending card (the Reel's is the engine's).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const list = shots || [];
  // Its shots: those that play during it, as the engine counts them (texts.mine), else as they fall in its span.
  const given = String((texts && texts.mine) || "").split(",").map((s) => Number(s)).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const BEAT = mark("beat", 18);
  const LAST_CUT = mark("last_cut", mine.length ? Math.max(0, list[mine[mine.length - 1]].from) : Math.max(0, D - 3 * BEAT));
  const AND_FROM = mark("and_from", LAST_CUT + 2), AND_TYPED = mark("and_typed", LAST_CUT + 16), AND_OUT = mark("and_out", LAST_CUT + 30), AND_GONE = mark("and_gone", LAST_CUT + 36);
  const LAST = mark("last", Math.min(D - 15, LAST_CUT + 2.5 * BEAT));
  // The shot on screen, and its rank under it.
  const rank = mine.reduce((r, i, k) => (list[i].from <= frame ? k : r), 0);
  const cur = mine.length ? mine[rank] : -1;
  const BOX = { left: 0, top: 0, width, height };
  // French spacing: a non-breaking space before « ! ? : ; », a number never broken from its digits.
  const keep = (s) => String(s || "").trim().replace(/\s+([!?:;»])/g, " $1").replace(/«\s+/g, "« ").replace(/(\d) (?=\d)/g, "$1 ");
  const point = word("celui");
  const and = word("et");
  const lastText = word("fin") || (point ? (/[!?.…]$/.test(point) ? point : point + " !") : "");

  // Its lettering and its ink: her title font, one size; the original's pale cream where it reads on her picture, a deep
  // warm ink where it is too bright for it (her light under the word, read on her shot), each with a thin edge.
  const display = "'" + brand.displayFont + "', 'Instrument Serif', serif";
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return -1;
    const v = parseInt(m[1], 16);
    return 0.2126 * lin(((v >> 16) & 255) / 255) + 0.7152 * lin(((v >> 8) & 255) / 255) + 0.0722 * lin((v & 255) / 255);
  };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const CREAM = "#fffcc0";
  const DEEP = "#2b2118";
  // Its edge: thin where its ink was chosen on its shot's own light, firmer (still tight) where it was not read.
  const edgeOf = (ink, sure) =>
    lum(ink) >= 0.3
      ? sure ? "0 0 1px rgba(38,30,18,0.62), 0 0 3px rgba(38,30,18,0.36)" : "0 0 2px rgba(38,30,18,0.8), 0 1px 4px rgba(38,30,18,0.5)"
      : sure ? "0 0 1px rgba(255,250,236,0.6), 0 0 3px rgba(255,250,236,0.34)" : "0 0 2px rgba(255,250,236,0.8), 0 1px 4px rgba(255,250,236,0.5)";
  const inkOn = (k, b) => {
    const read = k >= 0 && k < list.length ? LightUnder(list[k], frame, BOX, { x: b.left, y: b.top, w: b.width, h: b.height }) : null;
    if (!read) return { ink: CREAM, sure: false };
    const under = lin(read.mean);
    const mineRatio = ratio(lum(CREAM), under);
    return { ink: mineRatio >= 2.4 || ratio(lum(DEEP), under) <= mineRatio ? CREAM : DEEP, sure: true };
  };
  const S = Math.round(height * 0.087);
  const type = (size, choice, x) => ({ fontFamily: display, fontWeight: 400, fontSize: size, lineHeight: 1.12, letterSpacing: "-0.005em", color: choice.ink, textShadow: edgeOf(choice.ink, choice.sure), whiteSpace: "nowrap", ...x });
  const letters = (s) => Array.from(String(s || ""));

  // A word's box at its place (its centre, as shares of the frame), kept in the safe zone (under the middle between x 140
  // and 940, never in the bottom quarter); pushed back inside it, the word keeps to that side of its box.
  const boxAt = (cx, cy, text, size) => {
    const tall = Math.round(size * 1.4);
    const top = Math.round(within(cy * height - tall / 2, 90, height * 0.75 - 12 - tall));
    const low = top + tall > height / 2;
    const L = low ? 140 : 52, R = low ? width - 140 : width - 52;
    const wide = Math.round(Math.min(R - L, Math.max(size * 1.2, letters(text).length * size * 0.5 + size * 0.4)));
    const wanted = cx * width - wide / 2;
    const left = Math.round(within(wanted, L, R - wide));
    const align = wanted < L - 1 ? "flex-start" : wanted > R - wide + 1 ? "flex-end" : "center";
    return { style: { position: "absolute", left, top, width: wide, height: tall }, align };
  };
  // A word that pops on shot k: there at once on its moment, gone at once, keyed by its words and its place.
  const pop = (key, text, cx, cy, k) => {
    const b = boxAt(cx, cy, keep(text), S);
    return h(FitText, { key: key + "-" + keep(text), style: b.style, innerStyle: type(S, inkOn(k, b.style), { alignItems: b.align }) }, keep(text));
  };
  // Her hesitation typed from its left edge (every letter in place from the start, the ones to come unseen), then faded.
  const typed = (text, k) => {
    const chars = letters(keep(text));
    const count = frame < AND_FROM ? 0 : Math.min(chars.length, 1 + Math.floor(((frame - AND_FROM) / Math.max(1, AND_TYPED - AND_FROM)) * chars.length));
    const fade = interpolate(frame, [AND_OUT, Math.max(AND_OUT + 1, AND_GONE)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tall = Math.round(S * 1.4);
    const top = Math.round(height * 0.49 - tall / 2);
    const left = 153;
    const right = top + tall > height / 2 ? width - 140 : width - 52;
    const ink = inkOn(k, { left, top, width: Math.min(right - left, Math.round(chars.length * S * 0.45)), height: tall });
    return h(FitText, { key: "and-" + keep(text), style: { position: "absolute", left, top, width: right - left, height: tall, opacity: fade }, innerStyle: type(S, ink, { alignItems: "flex-start", textAlign: "left" }) },
      h("span", null, chars.map((c, j) => h("span", { key: j, style: { opacity: j < count ? 1 : 0 } }, c))));
  };

  // Where its pointing word lands on each of her shots: the original's seven places, then five more of the same kind.
  const SPOTS = [[0.245, 0.286], [0.69, 0.404], [0.316, 0.534], [0.36, 0.704], [0.71, 0.648], [0.67, 0.267], [0.497, 0.696], [0.3, 0.4], [0.7, 0.55], [0.42, 0.25], [0.62, 0.7], [0.28, 0.62]];
  const words = [];
  // Its last shot from its cut (with a single shot under it, its last two thirds: its timeline's mark).
  const series = frame >= LAST_CUT;
  if (point && !series && cur >= 0) {
    const spot = SPOTS[rank % SPOTS.length];
    words.push(pop("point" + rank, point, spot[0], spot[1], cur));
  }
  // On its last shot: her hesitation, then her last word alone in the middle to its end.
  if (and && series && frame >= AND_FROM && frame < AND_GONE) words.push(typed(and, cur));
  if (lastText && series && frame >= LAST) words.push(pop("last", lastText, 0.5, 0.493, cur));
  return h(AbsoluteFill, null, words);
}`;

/**
 * Its last word's moment and its hesitation's, frames from its start: the last word on the whole beat nearest 2,5 beats
 * after its last cut (the original's), within that shot and a second at least before its end; the hesitation typed from
 * just after the cut over 0,86 beat (less on a short shot), faded out just before the last word.
 */
export function celuiLaMoments(frames: number, beat: number, lastCut: number): { andFrom: number; andTyped: number; andOut: number; andGone: number; last: number } {
  const latest = Math.max(lastCut + 6, frames - Math.max(30, beat));
  const earliest = Math.min(latest, lastCut + Math.max(12, beat));
  // On a whole beat of the Reel from its start (the music comes back there: off it, it would drift from the cuts after),
  // the nearest one to the original's moment within its bounds; none there (a very short series): its latest moment.
  const low = Math.ceil(earliest / beat - 1e-9);
  const high = Math.floor(latest / beat + 1e-9);
  const k = Math.min(high, Math.max(low, Math.round((lastCut + 2.5 * beat) / beat)));
  const last = Math.round(low <= high ? k * beat : latest);
  const gap = Math.max(6, last - lastCut);
  const andFrom = Math.round(lastCut + Math.min(2, gap * 0.05));
  const andTyped = Math.round(Math.min(lastCut + 0.98 * beat, lastCut + gap * 0.4));
  const andGone = Math.round(Math.max(andTyped + 2, last - Math.min(0.29 * beat, gap * 0.12)));
  const andOut = Math.round(Math.max(andTyped + 1, andGone - Math.min(5, gap * 0.1)));
  return { andFrom, andTyped, andOut, andGone, last };
}

export const celuiLa: EffectPiece = {
  key: "celui-la",
  version: 1,
  name: "Et… celui-là !",
  how: "le même petit mot drôle (« Celui-là ») posé d'un coup sur chacun de ses produits, sur la coupe, chaque fois à un autre endroit de l'image ; sur le dernier plan (toute sa série), une hésitation tapée lettre à lettre (« Eeeet… ») pendant que la musique retient son souffle, puis le dernier mot seul au milieu quand elle repart ; puis le montage reprend.",
  needs: "une photo ou une courte vidéo de chacun de ses produits, un par plan (trois au moins), et pour finir un plan de toute sa série réunie ou de sa pièce préférée.",
  lays: "sur ses plans de produits coupés sur les temps, un par temps, le dernier (sa série réunie) tenu deux secondes au moins pour l'hésitation et le dernier mot",
  shots: [3, 10],
  seconds: [3, 10],
  require: { files: 4, shot: { framing: ["close", "detail", "medium"] } },
  texts: [
    {
      slot: "celui",
      want: "le mot posé sur chacun de ses produits, le même à chaque fois, accordé à ce qu'ils sont : « Celui-là » (un bol, un bouquet, un gâteau), « Celle-là » (une tasse, une bougie, une robe), « Ceux-là », ou « Ça » ; un ou deux mots",
      max: 12,
      required: true,
    },
    {
      slot: "et",
      want: "l'hésitation avant le dernier, sur toute sa série réunie, étirée et tapée lettre à lettre (une forme comme « Eeeeet… », « Eeet… »)",
      max: 12,
      required: true,
    },
    {
      slot: "fin",
      want: "facultatif : le dernier mot, seul au milieu sur sa série réunie (une forme comme « Celle-là ! », « Tout ça ! », « La nouvelle ! ») ; deux mots au plus ; sans lui, le mot de chaque produit avec « ! »",
      max: 16,
      required: false,
    },
  ],
  timeline(input: PieceTimelineInput) {
    const beat = (60 / input.bpm) * 30;
    // Its last shot under it: her series (or, with one shot only, the last two thirds of it).
    const last = input.shots.at(-1);
    const lastCut = input.shots.length > 1 && last ? Math.max(0, last.from) : Math.round(input.frames * 0.34);
    const at = celuiLaMoments(input.frames, beat, lastCut);
    const s = (f: number) => Math.round((f / 30) * 1000) / 1000;
    // The music holds its breath over her hesitation: stopped just after the last cut (its hit ringing), back on her last
    // word, a whole beat of the Reel from its start.
    const pause = at.last - lastCut >= 1.25 * beat ? [{ from: s(lastCut + 0.25 * beat), to: s(at.last), tail: s(Math.min(36, at.last - lastCut - 0.25 * beat - 6)) }] : [];
    return {
      marks: { last_cut: lastCut, and_from: at.andFrom, and_typed: at.andTyped, and_out: at.andOut, and_gone: at.andGone, last: at.last },
      ...(pause.length ? { music: { pauses: pause } } : {}),
    };
  },
  code: CODE,
};
