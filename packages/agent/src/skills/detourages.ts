import { END_CARD_SECONDS, beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Ton nom qui clignote » (`detourages`), version 2, written again on its original's fiche (docs/fiches/detourages.md:
// a travel edit of 16,5 s measured image by image at 30 i/s, its sound by bands; Tristan: « c'est un effet que l'on
// veut pouvoir faire, pas exactement reproduire l'image »). No cut-out surges in it (its v1 described another Reel): a
// window opens on a still wide shot, a name lights up letter by letter behind the scenery, then a burst of shots on the
// song's dotted rhythm. Its music is an indie-electro song at 140 BPM (Gemini heard 120, the workshop 94: its cuts'
// dotted rhythm), its intro without drums; every length below is in its beats, so its cuts fall where the original's do:
//   0 – 14,5    her still wide shot, her place or her landscape: black for an image, then a slit at its middle, the
//               frame's whole height, widening at a constant speed to its whole width (its ends round while it is
//               narrow), the music's highs opening with it; then her name, in very bold wide capitals across the frame,
//               each letter flashing, going dark, then lit for good, out of order and faster and faster (the original's
//               D, C, L, E, I, N, A of ICELAND, a soft high tick on each), behind her scenery: in her sky, everything
//               else in front of it (her roofs, her hills, someone standing), its foot just under their top; without a
//               sky, behind what stands in front of her wall (her cut-out); it goes with the cut;
//   14,5 – 34,6 the drop: a burst of shots cut on the song's dotted rhythm (three sixteenths: ¾ of a beat most often, a
//               beat, a beat and a half), each cut on the original's own (just after its hit), people, matters and
//               details, wide or from above; its tenth and eighteenth shots streaked as fast sweeps (her real whip when
//               she has one, else her shot swept);
//   34,6 – 38,4 a last shot held, someone from behind before her place, arms raised; the bass falls away under it and
//               comes back, and the Reel ends dead on the next bar, looping onto its black slit.
// Played as the original, a window a little wider than high (1,18:1) with rounded corners on black, when her videos are
// mostly horizontal or square (or she asks), else full frame, its corners rounded and its slit kept. Fewer of her files:
// fewer shots in its burst (whole bars of it left out, from its middle), longer, still on the original's cuts. Her photos
// stay still, her videos play; its grade is its finish (a soft film). Nothing of the original's own is copied: its name
// is hers, its places hers.

const BPM = 140;
/** Its intro to the drop (beats: 6,22 s): the slit opens to its whole width by SLIT, her name lights up from NAME. */
const INTRO = 14.5;
const SLIT = 9.72;
const NAME = 8.4;
/**
 * Its burst, bar by bar, in beats from the drop: where each shot starts (the original's cuts, measured, just after the
 * song's hits) and how long the bar is; `file`: its first shot is a fast sweep (10 images). Its first and last bars
 * always; its middle ones (1, 2, 3) as her files allow, each in whole or in part (its shots then longer).
 */
const BARS: { cuts: number[]; length: number; file?: boolean }[] = [
  { cuts: [0, 0.9, 1.45, 2.3, 3.05], length: 4.1 },
  { cuts: [0, 0.7, 1.45, 2.25], length: 3.95 },
  { cuts: [0, 0.8, 1.4, 2.95], length: 3.95, file: true },
  { cuts: [0, 0.85, 1.9, 3.05], length: 4.15 },
  { cuts: [0, 0.75, 1.45, 2.95], length: 3.95, file: true },
];
/** A middle bar kept in part: which of its cuts, for 1, 2 or 3 shots (its shots as even as its cuts let them). */
const PARTS: number[][][] = [[], [[0], [0, 3], [0, 2, 3]], [[0], [0, 1], [0, 1, 3]], [[0], [0, 2], [0, 2, 3]], []];
/** Past its 23 shots (a length she asks for): more bars of four shots before its last, each four beats. */
const MORE = { cuts: [0, 0.7, 1.45, 2.25], length: 4 };
const LONG = 31;
/** Its last shot, held; with her ending card, two beats longer (its last 2,5 s over it). */
const LAST = 3.8;
const CARD = 2;
/** The bass falls away this far into its last shot and comes back here (beats: the original's 15,0 and 16,1 s). */
const THIN = [0.4, 2.9];
/** The intro: its highs open over its first 3 s (seven beats), then it plays softer to the drop. */
const OPEN = 7;
const SOFT_DB = -5;
/**
 * Her name's letters, as the original's seven (images at 30 i/s from its first flash): when each one flashes, how long
 * it flashes (about 60 %), how long it goes dark (a ghost of 8 % at most), then lit for good; and which letter of the
 * word goes first, second… (its D, C, L, E, I, N and A: the last, the second, the fourth, the third, the first, the
 * sixth, the fifth).
 */
const FLASH_AT = [0, 8, 16, 20, 25, 29, 32];
const FLASH_FOR = [4, 4, 2, 4, 3, 2, 3];
const DARK_FOR = [4, 4, 4, 2, 3, 3, 2];
const ORDER = [6, 1, 3, 2, 0, 5, 4];
/** A soft high tick on each letter's flash and when the whole name is lit, as its music's (dB). */
const TICK = { sound: "soft high glass tick", seconds: 0.5, gain: -4 };
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Her name's letters (graphemes but spaces), as its code lights them. */
const lettersOf = (text: string) =>
  (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(text), (x) => x.segment) : Array.from(text)).filter((c) => /\S/.test(c));

/**
 * When each of n letters flashes, goes dark and lights for good (images from the first flash, at 140 BPM), by its place
 * in the word: the original's seven, sampled along it for another count, in the same order of places, faster and
 * faster.
 */
export function letterTimes(n: number): { place: number; flash: number; dark: number; on: number }[] {
  const count = Math.max(1, Math.min(24, n));
  const used = new Set<number>();
  return Array.from({ length: count }, (_, k) => {
    const u = count > 1 ? (k * 6) / (count - 1) : 0;
    const i = Math.min(5, Math.floor(u));
    const at = FLASH_AT[i]! + (FLASH_AT[i + 1]! - FLASH_AT[i]!) * (u - i);
    const j = Math.round(u);
    // Its place: the original's for that step, the nearest one not lit yet.
    const want = (ORDER[j]! / 6) * (count - 1);
    let place = -1;
    for (let p = 0; p < count; p++) if (!used.has(p) && (place < 0 || Math.abs(p - want) < Math.abs(place - want))) place = p;
    used.add(place);
    const flash = Math.round(at);
    const dark = flash + FLASH_FOR[j]!;
    return { place, flash, dark, on: dark + DARK_FOR[j]! };
  });
}

/**
 * Where each shot of its burst starts (beats from the drop), whether it is a fast sweep, which of the original's 21 it
 * stands for (`of`, −1 for a bar added past them), and where its last shot starts, for m shots of its burst.
 */
export function burstCuts(m: number): { cuts: { at: number; file: boolean; of: number }[]; last: number } {
  const total = Math.max(9, m);
  // Its first and last bars always (nine shots); then its middle bars, each in whole before the next; then more bars.
  let left = total - 9;
  const middle = [1, 2, 3].map((b) => {
    const k = Math.min(BARS[b]!.cuts.length, left);
    left -= k;
    return k;
  });
  const more = Math.ceil(left / 4);
  const cuts: { at: number; file: boolean; of: number }[] = [];
  // Where each bar's first shot is among the original's 21.
  const first = BARS.map((_, b) => BARS.slice(0, b).reduce((a, x) => a + x.cuts.length, 0));
  let at = 0;
  const lay = (bar: { cuts: number[]; length: number; file?: boolean }, keep: number[], b: number) => {
    keep.forEach((c, i) => cuts.push({ at: round3(at + bar.cuts[c]!), file: Boolean(bar.file && c === 0 && keep[i + 1] === 1), of: b < 0 ? -1 : first[b]! + c }));
    at += bar.length;
  };
  const all = (bar: { cuts: number[] }) => bar.cuts.map((_, i) => i);
  lay(BARS[0]!, all(BARS[0]!), 0);
  [1, 2, 3].forEach((b, j) => {
    const k = middle[j]!;
    if (k) lay(BARS[b]!, k === BARS[b]!.cuts.length ? all(BARS[b]!) : PARTS[b]![k - 1]!, b);
  });
  for (let i = 0; i < more; i++) lay(MORE, all(MORE).slice(0, Math.min(4, left - 4 * i)), -1);
  lay(BARS[4]!, all(BARS[4]!), 4);
  return { cuts, last: round3(at) };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const SLIT_FROM = mark("slit_from", 1);
  const SLIT_TO = Math.max(SLIT_FROM + 1, mark("slit_to", 125));
  const NAME_AT = mark("name", 108);
  const FILES = [mark("file_a", -1), mark("file_b", -1)];
  // Its own filters, one id each (two copies of the scene in one page never share one).
  const ID = "dt" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");

  // Its frame: the original's window, a little wider than high (1,18:1), when most of her videos are horizontal or
  // square (or she asks), else the whole vertical frame; its corners rounded on black either way (a radius of 3 % of the
  // width), a fine black line on the window's sides. Every place below is a share of it.
  const format = setting("format", "vertical");
  const upright = shots.filter((s) => (Number(s.aspect) || 0.5625) < 0.87).length;
  const windowed = format === "fenetre" || (format === "auto" && upright * 2 <= n);
  const bw = width;
  const bh = windowed ? Math.round(width / 1.18) : height;
  const by = windowed ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const box = { position: "absolute", left: 0, top: 0, width: bw, height: bh };
  const R = Math.round(bw * 0.03);
  const EDGE = windowed ? Math.max(2, Math.round(bw * 0.003)) : 0;

  // 1. The window: black on its first image, then a slit at its middle, the whole height, widening at a constant speed
  // from 1 % of the width to all of it (round ends while it is narrow), then the picture in its rounded rectangle.
  const share = interpolate(frame, [SLIT_FROM, SLIT_TO], [0.01, 1], clamp);
  const open = Math.max(2, Math.round(bw * share));
  const side = frame < SLIT_TO ? Math.max(EDGE, Math.round((bw - open) / 2)) : EDGE;
  const radius = Math.min(R, Math.max(1, Math.round(open / 2)));
  const clip = "inset(0 " + side + "px round " + radius + "px)";

  // 2. Her shots, cut on its hits, as filmed (a photo still, a video playing). Its two fast sweeps streaked along their
  // way and sliding (her own whip, or her shot swept): a vertical sweep, then a sideways one.
  const sweep = FILES.indexOf(cur);
  let film = frame >= SLIT_FROM ? h(Footage, { key: "film", shot: cur, style: box }) : null;
  if (sweep >= 0 && film) {
    const s = shots[cur];
    const p = interpolate(frame, [s.from, s.from + s.durationInFrames], [0, 1], clamp);
    const up = sweep === 0;
    const shift = Math.round((up ? -1 : 1) * p * (up ? bh : bw) * 0.14);
    film = h("div", { key: "film", style: { ...box, overflow: "hidden" } },
      h("svg", { width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
        h("filter", { id: ID + "s", x: up ? "0" : "-0.2", y: up ? "-0.2" : "0", width: up ? "1" : "1.4", height: up ? "1.4" : "1", colorInterpolationFilters: "sRGB" }, h("feGaussianBlur", { stdDeviation: up ? "0 42" : "42 0" }))),
      h("div", { style: { ...box, transform: (up ? "translateY(" : "translateX(") + shift + "px) scale(1.3)", filter: "url(#" + ID + "s)" } }, h(Footage, { shot: cur, style: box })));
  }

  // 3. Her name, in very bold wide capitals across the frame (87,6 % of its width; within the apps' margins once its foot
  // goes under the middle), as tall as the original's (16,8 % of its window), white, no outline: each letter flashes
  // (60 %), goes dark (a ghost), then lights for good, on its own images (its timeline's, the original's order and
  // pace), every letter in the page from the start. Behind her scenery: in her sky (Skyline: everything else in front
  // of it), its foot set so that about an eighth of the word is hidden, in its middle (the top of what stands there
  // read across it); without a sky, behind what stands in front of her wall (her cut-out), its foot under its top; else
  // in front, at the original's place. A soft shade under it only on a bright sky (else it would not read).
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const display = "'" + brand.displayFont + "', 'Montserrat', 'Archivo Black', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Montserrat', 'Inter', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const graphemes = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const nameOn = hook && cur === 0 && frame >= hook.from && frame < Math.min(hook.to, endAt);
  let title = null;
  let front = null;
  if (nameOn) {
    const chars = graphemes(keep(hook.text).toUpperCase());
    const CAP = Math.round(windowed ? bh * 0.168 : bw * 0.142);
    const F = Math.round(CAP / 0.7);
    const FULL = Math.round(bw * 0.876);
    // The top of what stands in its width (eight columns of her skyline), read once on its first lit image.
    const REF = NAME_AT;
    const cols = 8;
    const x0 = Math.round((bw - FULL) / 2);
    const tops = [];
    for (let k = 0; k < cols; k++) {
      const y = SkylineAt(shots[0], REF, laid, { from: x0 + (k * FULL) / cols, to: x0 + ((k + 1) * FULL) / cols });
      if (typeof y === "number" && Number.isFinite(y)) tops.push(y);
    }
    const hidden = (foot) => tops.reduce((a, y) => a + Math.max(0, Math.min(CAP, foot - y)), 0) / (cols * CAP);
    // How many of its columns are hidden past 60 % (a tree or a front up to the top of the frame hides a whole letter).
    const deep = (foot) => tops.filter((y) => foot - y > 0.6 * CAP).length;
    // Its foot within the frame's safe zone: its capitals under the top margin, its foot above the lowest quarter.
    const footMin = Math.max(80 - by, Math.round(bh * 0.06)) + CAP;
    const footMax = Math.min(Math.round(bh * 0.62), Math.round(1440 - by - 0.25 * CAP));
    let foot = Math.round(bh * 0.594);
    let behind = null;
    if (tops.length >= cols / 2) {
      // The foot that hides an eighth of the word (bisection: more is hidden as it goes down); a sky too narrow or too
      // high for it (her trees or her front up to the top of the frame, a whole letter hidden) is none.
      let lo = footMin;
      let hi = footMax;
      for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (hidden(mid) < 0.125) lo = mid; else hi = mid; }
      const f = Math.round(Math.max(footMin, Math.min(footMax, (lo + hi) / 2)));
      if (hidden(f) <= 0.2 && deep(f) <= 2) { foot = f; behind = "sky"; }
    }
    if (!behind) {
      const her = SubjectBox(shots[0], REF, laid);
      if (her && her.h > bh * 0.08) {
        const f = Math.round(her.y + 0.3 * CAP);
        if (f >= footMin && f <= footMax) { foot = f; behind = "her"; }
      }
    }
    foot = Math.max(footMin, Math.min(footMax, foot));
    // Its glyphs within the apps' margins on both sides once they reach under the middle of the Reel.
    const low = by + foot > 960;
    const TW = low ? bw - 280 : FULL;
    const light = LightUnder(shots[0], REF, laid, { x: (bw - TW) / 2, y: foot - CAP, w: TW, h: CAP });
    const shade = light && light.mean > 0.68 ? "0 2px 22px rgba(0,0,0,0.32), 0 0 2px rgba(0,0,0,0.25)" : "none";
    // Each letter's state at this frame: the k-th letter of the word (its spaces left as they are).
    let k = -1;
    const spans = chars.map((c, i) => {
      if (!/\S/.test(c)) return h("span", { key: i }, c);
      k += 1;
      const fl = mark("fl" + k, NAME_AT);
      const dk = mark("dk" + k, fl + 3);
      const on = mark("on" + k, dk + 3);
      const o = frame < fl ? 0 : frame < dk ? 0.6 : frame < on ? 0.06 : 1;
      return h("span", { key: i, style: { opacity: o } }, c);
    });
    // One box, its bottom just under its foot (its line's descent): a long name is smaller, its foot where it was.
    const boxH = Math.round(CAP * 1.6);
    title = h(FitText, { key: "name", style: { position: "absolute", left: Math.round((bw - TW) / 2), top: Math.round(foot + 0.2 * CAP - boxH), width: TW, height: boxH }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: F, lineHeight: 1, letterSpacing: "0.005em", color: "#ffffff", whiteSpace: "nowrap", textAlign: "center", justifyContent: "flex-end", textShadow: shade } },
      h("span", { style: { display: "inline-block" } }, ...spans));
    front = behind === "sky" ? h(Skyline, { key: "front", shot: 0, style: box }) : behind === "her" ? h(Subject, { key: "front", shot: 0, style: box }) : null;
  }

  // 4. Its ending card, when she has one, over the last shot softly darkened: its title in the name's capitals, its line under it.
  const e = end ? frame - endAt : -1;
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { ...box, backgroundColor: "rgba(0,0,0," + (0.42 * Math.min(1, (e + 1) / 6)).toFixed(3) + ")" } }),
        h(FitText, { style: { position: "absolute", left: 140, top: Math.round(bh / 2) - (end.subtitle ? Math.round(bh * 0.2) : Math.round(bh * 0.12)), width: bw - 280, height: Math.round(bh * 0.22) }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 96, lineHeight: 1, color: "#ffffff", textAlign: "center", textWrap: "balance", whiteSpace: "normal", textTransform: "uppercase", justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", { style: { opacity: interpolate(frame, [endAt + 1, endAt + 5], [0, 1], clamp) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: Math.round(bh / 2) + Math.round(bh * 0.04), width: bw - 280, height: Math.round(bh * 0.16) }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.2, color: "#ffffff", textAlign: "center", textWrap: "balance", justifyContent: "flex-start" } },
              h("span", { style: { opacity: interpolate(frame, [endAt + 6, endAt + 10], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000", clipPath: clip } }, film, title, front, ending);

  // Any other text of the Reel (none in its slots): a plain white line off its picture, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: windowed ? Math.max(100, by - 130 - i * 120) : 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

/** What each shot of the original's burst shows, as hers would (its 21, in order: people, matters and details, wide or from above, its two sweeps). */
const BURST_WANTS = [
  "quelqu'un qui fait un grand geste (danse, lève les bras, rit), en mouvement",
  "sa rue, son lieu ou son paysage, en large",
  "des mains dans une matière, de près (farine, café, tissu, terre)",
  "une matière ou un produit de près",
  "quelqu'un qui sourit, de près",
  "un objet de son lieu en entier, un peu de loin",
  "son nom écrit quelque part (vitrine, tablier, enseigne, ardoise)",
  "une matière de près (des grains, une texture, ce qu'elle vend en vrac)",
  "quelqu'un qui lève les bras ou fait un geste large",
  "un balayage très rapide du téléphone sur son sol ou son comptoir (sinon un plan qui bouge, il sera filé)",
  "un détail qui bouge, de près (la vapeur, l'eau, un geste)",
  "quelqu'un qui prend une photo ou qui filme",
  "un plan qui avance vite au ras du sol ou d'une table",
  "sa rue ou son lieu vu d'en haut",
  "quelque chose qui coule ou qui tombe (de l'eau, un café versé, de la farine)",
  "quelqu'un qui danse ou qui bouge, à contre-jour",
  "quelqu'un qui regarde ou qui filme, de près",
  "un balayage très rapide de côté (sinon un plan qui bouge, il sera filé)",
  "vu d'en haut : une table, un comptoir, une rue",
  "vu d'en haut, un autre endroit",
  "une matière vue d'en haut, de près",
];
/** Its two sweeps among the original's 21. */
const SWEEPS = [9, 17];

export const detourages: MontageSkill = {
  key: "detourages",
  // 2: written again on its original's fiche (its 140 BPM and its cuts, its window opening as a slit, her name flashing
  // letter by letter behind her scenery, its burst on the dotted rhythm with its two sweeps, its rounded window on black,
  // its last shot held while the bass falls away, its soft film grade); no cut-out surges any more.
  // 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 3,
  bpm: BPM,
  // Its opening, its burst (whole bars of it left out when her files are fewer), its last shot.
  shots: [11, 23],
  // Up to 31 for a length she asks for: more bars of its burst before its last shot.
  long: LONG,
  files: [6, 16],
  fonts: ["Montserrat"],
  // Its sweeps: her real whips, when she filmed some.
  reads: ["moves"],
  how: "Un plan large et fixe de son lieu ou de son paysage qui s'ouvre comme une fenêtre : une fente noire au milieu qui s'élargit lentement jusqu'à toute la largeur ; son nom s'y allume en très grandes capitales blanches, lettre par lettre dans le désordre (chacune clignote, s'éteint puis tient), derrière le décor (ses toits, ses collines, quelqu'un debout passent devant) ; puis, sur le drop, une rafale de plans courts coupés sur le rythme pointé de la chanson (des gens qui font un geste, des mains et des matières de près, son nom écrit, son lieu vu d'en haut, deux balayages très rapides), et un dernier plan tenu de quelqu'un de dos, les bras levés. En vertical plein écran aux coins arrondis, ses vidéos horizontales recadrées sur leur sujet ; dans une fenêtre un peu plus large que haute sur du noir, comme l'original, à sa demande.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "son nom, sa rue, son quartier ou un mot de sa demande, 4 à 10 lettres, qui s'allume lettre par lettre en très grandes capitales dans le ciel de son premier plan : un seul mot de préférence (le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), plus il est court plus il est grand",
      max: 12,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, ou la fenêtre aux coins arrondis de l'original",
      choices: [
        { value: "vertical", says: "vertical plein écran, ses coins arrondis et sa fente gardés, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "fenetre", says: "une fenêtre un peu plus large que haute (1,18:1) aux coins arrondis sur du noir, comme l'original", band: true },
        { value: "auto", says: "comme ses vidéos (la fenêtre si la plupart sont horizontales ou carrées)" },
      ],
    },
  ],
  // Its grade is its finish (a soft film, docs/fiches/detourages.md, effect 8), without what would grey its black: no
  // fade, no grain, no dark corners on the black around its window.
  finish: { fade: 0, grain: 0, vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(11, Math.min(LONG, n));
    const { cuts, last } = burstCuts(count - 2);
    const hold = LAST + (end ? Math.max(CARD, Math.ceil(END_CARD_SECONDS / beat - 1e-6)) : 0);
    // Its opening, then each shot of its burst to the next cut, then its last shot.
    const edges = [0, ...cuts.map((c) => INTRO + c.at), INTRO + last, INTRO + last + hold];
    const spans = beatSpans(bpm, edges.slice(1).map((b, i) => round3(b - edges[i]!)));
    const duration = spans.at(-1)!.end;
    const drop = spans[1]!.start;
    // What each burst shot wants: the original's at its place; a sweep only where its sweep is kept as one.
    const files = cuts.flatMap((c, i) => (c.file ? [i + 1] : []));
    const wants = [
      "le plan large et fixe qui ouvre, le téléphone posé, au moins 6 s : son lieu, sa rue ou un paysage, avec du ciel (ou un mur dégagé) au-dessus de ce qui passera devant son nom (son toit, sa devanture, ses collines, quelqu'un debout), quelqu'un qui y entre et s'arrête : son nom s'y allume derrière le décor",
      ...cuts.map((c) => (c.of < 0 ? "un moment de plus, court : quelqu'un, un geste, une matière de près, son lieu vu d'en haut" : c.file || !SWEEPS.includes(c.of) ? BURST_WANTS[c.of]! : "un plan qui bouge, court : un geste, une matière, sa rue")),
      "le dernier plan, tenu : quelqu'un de dos devant son lieu, un geste large (les bras levés, un salut), le téléphone posé",
    ];
    // Her name's letters, on their images from its first flash (the original's images at 140 BPM, following its tempo),
    // and a tick on each flash and when it is all lit.
    const name = lettersOf(options.words?.titre ?? "ICELAND");
    const scale = 140 / bpm;
    const nameAt = toFrame(NAME * beat);
    const times = letterTimes(name.length || 7);
    const at = (f: number) => Math.round(nameAt + f * scale);
    const letters: Record<string, number> = {};
    for (const t of times) {
      letters[`fl${t.place}`] = at(t.flash);
      letters[`dk${t.place}`] = at(t.dark);
      letters[`on${t.place}`] = at(t.on);
    }
    const lit = Math.max(...times.map((t) => at(t.on)));
    const flashes = [...new Set([...times.map((t) => at(t.flash)), lit])].sort((a, b) => a - b);
    const sounds: SkillSound[] = [{ at: round3(flashes[0]! / 30), ...TICK, burst: { times: flashes.map((f) => round3((f - flashes[0]!) / 30)) } }];
    const lastAt = spans.at(-1)!.start;
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her name from its first flash to the drop.
      texts: { titre: { from: round(nameAt / 30), to: drop } },
      marks: {
        slit_from: 1,
        slit_to: toFrame(SLIT * beat),
        name: nameAt,
        ...letters,
        file_a: files[0] ?? -1,
        file_b: files[1] ?? -1,
      },
      sounds,
      // Its intro without drums: its highs opening over its first seven beats, then softer to the drop, where its first
      // strong beat lands; the bass falling away under its last shot and back; cut dead at the end (the loop).
      music: {
        downbeat: round3(drop),
        filters: [
          { kind: "muffled", from: 0, to: round3(OPEN * beat), open: round3(OPEN * beat) },
          { kind: "soft", from: round3(OPEN * beat), to: round3(drop), db: SOFT_DB, open: 0.02 },
          { kind: "thin", from: round3(lastAt + THIN[0]! * beat), to: round3(lastAt + THIN[1]! * beat), open: 0.02 },
        ],
        end: { at: duration },
      },
      // Her opening shot cut out, only for her name behind what stands before her wall (no sky there).
      cutouts: [0],
    };
  },
  code: CODE,
};
