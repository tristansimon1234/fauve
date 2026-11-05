import type { EffectPiece } from "../pieces.ts";

// « Titre gaufré », the effect (docs/fiches/gaufre.md, effects 3 to 7; its whole Reel is skills/gaufre.ts): a hard cut
// from her shot to a sheet of peach paper full frame, its short curly fibres in relief lit from the top left, still (no
// zoom, no slide, no vignette); her name pressed into it from its first image (each letter's walls in the shade at the
// top and the left, lit at the bottom and the right, its floor the paper itself), a line of capitals under it at its
// width; then a dark ink comes into each letter with a soft front, the first one slowly (already coming in on the
// paper's first image), the others rising from their foot, overlapping, a dot or an accent last as a hand puts it, and
// dries from brown to rust, the letter lifting off the paper as it is inked (a soft shadow at its bottom right, a darker
// rim); the line inks from left to right and ends with it. Then the inked card holds a beat and a half to be read (the
// original's held 4 images only: its fiche asks for a longer one) and the montage takes over on her next shot. It
// covers whatever plays under it: nothing of her shots is drawn. It keeps its skill's paper, its relief, its ink and
// its timings, as shares of the paper's 7 beats in the original (its first letter slow, the others 0,4 s apart at five
// letters, the dots last, the line along), faster in a short span, never slower than its original by more than a quarter
// (the rest held inked); it leaves the front built piece by piece on the black (« Façade qui se construit »), the music's
// shape and the ending card. Its paper and its ink are the original's peach and rust; on her word, her charter's light
// colour and her main one (`papier`). Nothing of the original's own: « Still » and « IN THE MOMENT » give way to her
// name and her line.

/** The paper's act in its original, in its beats: its line inked to the end at 6,77 beats after the cut. */
const ACT = 6.77;
/** Each moment of its ink in those beats from the cut: the first letter from before it, the second, the last, the dots, all inked, the line, its drying. */
const INK = { ink: -2.7, first: 3.3, second: 2.95, last: 5.33, dots: 5.58, inked: 6.52, line_from: 3.44, line_to: ACT, dry: 4 };
/** Its original's beat on the paper (113,2 BPM): never slower than a quarter more. */
const SLOWEST = (1800 / 113.2) * 1.25;
/** The inked card held this many beats to be read at the end (a part of the span at most). */
const HOLD_BEATS = 1.5;
const HOLD_SHARE = 0.22;

/** Its moments in frames from its start (the first letter's ink starts before it) for a span of `frames` at a tempo (its hold counted in half-beats on a slow Reel). */
export function gaufreMoments(frames: number, bpm: number): Record<keyof typeof INK, number> & { hold: number } {
  let beat = 1800 / Math.min(140, Math.max(60, bpm));
  while (beat / (1800 / 113.2) > 1.42) beat /= 2;
  const hold = Math.min(HOLD_BEATS * beat, frames * HOLD_SHARE);
  const pace = Math.min(SLOWEST, (frames - hold) / ACT);
  const at = Object.fromEntries(Object.entries(INK).map(([k, v]) => [k, Math.round(v * pace)])) as Record<keyof typeof INK, number>;
  return { ...at, hold: frames - at.line_to };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const ID = "gf" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const box = (x, y, w, t) => ({ position: "absolute", left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(t) });

  // Its moments (its timeline's marks; else the same shares of its span, the last part held inked).
  const P = Math.min(19.9, (durationInFrames - Math.min(27, durationInFrames * 0.22)) / 6.77);
  const INK = mark("ink", -2.7 * P);
  const FIRST = mark("first", 3.3 * P);
  const SECOND = mark("second", 2.95 * P);
  const LAST = mark("last", 5.33 * P);
  const DOTS = mark("dots", 5.58 * P);
  const INKED = mark("inked", 6.52 * P);
  const LINE_FROM = mark("line_from", 3.44 * P);
  const LINE_TO = mark("line_to", 6.77 * P);
  const DRY = Math.max(1, mark("dry", 4 * P));

  // Its colours: the original's peach paper and its ink, brown as it comes in, rust once dry; on her word, her charter's
  // light colour for the paper (a white one tinted a tenth with her main colour, so that its lit walls still show) and
  // her main colour (else her dark one) for the ink, whichever reads on it.
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const lum = (c) => { const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const toward = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const WHITE = [255, 255, 255];
  const BLACK = [0, 0, 0];
  let PAPER = [245, 204, 164], RUST = [180, 60, 1], FRESH = [125, 33, 0], LINE_RUST = [160, 75, 32], SHADE = [183, 140, 100], LIT = [255, 224, 184], RIM = [58, 15, 0];
  if (setting("papier", "peche") === "charte") {
    const pal = brand.palette || {};
    const light = hex(pal.light), accent = hex(brand.accent), dark = hex(pal.dark);
    const pale = light && lum(light) >= 0.45 ? light : accent ? toward(accent, WHITE, 0.82) : PAPER;
    const paper = lum(pale) > 0.8 ? toward(pale, accent || [200, 170, 140], 0.1) : pale;
    const ink = [accent, dark].find((c) => c && ratio(c, paper) >= 3) || toward(paper, BLACK, 0.72);
    PAPER = paper; RUST = ink; FRESH = toward(ink, BLACK, 0.45); LINE_RUST = toward(ink, BLACK, 0.12);
    SHADE = toward(paper, BLACK, 0.25); LIT = toward(paper, WHITE, 0.55); RIM = toward(ink, BLACK, 0.6);
  }
  const css = (c, a) => "rgba(" + c.join(",") + "," + a + ")";
  const solid = (c) => "rgb(" + c.join(",") + ")";

  // 1. The paper, full frame from the cut: its short curly fibres in relief lit from the top left, as soft as the
  // original's (4 levels of 255 in each colour alike: the relief baked in its image, its mean the paper's colour); no
  // grain, no shade at its edges, still. One tile drawn once and laid edge to edge (its noise stitched at its edges, so
  // no seam shows): a whole frame of it, drawn in every copy of the scene check, outlasted its wait.
  const TILE = [540, 640];
  // Its drawing's markup, written tag by tag (an element, its attributes, what it holds).
  const LT = String.fromCharCode(60);
  const el = (name, attrs, inner) => LT + name + " " + attrs + (inner ? ">" + inner + LT + "/" + name + ">" : "/>");
  const svg = (inner) => "url(\"data:image/svg+xml;charset=utf-8," + encodeURIComponent(el("svg", "xmlns='http://www.w3.org/2000/svg' width='" + TILE[0] + "' height='" + TILE[1] + "'", inner)) + "\")";
  const base = PAPER.map((v) => (v / 255 - 0.0564).toFixed(4));
  const FIBRES = svg(
    el("filter", "id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'",
      el("feTurbulence", "type='turbulence' baseFrequency='0.042 0.021' numOctaves='3' seed='4' stitchTiles='stitch'") +
      el("feDiffuseLighting", "lighting-color='#ffffff' surfaceScale='5' diffuseConstant='1'", el("feDistantLight", "azimuth='225' elevation='45'")) +
      el("feColorMatrix", "type='matrix' values='0.0848 0 0 0 " + base[0] + "  0.0848 0 0 0 " + base[1] + "  0.0848 0 0 0 " + base[2] + "  0 0 0 0 1'")) +
    el("rect", "width='100%' height='100%' filter='url(#f)'"));
  const paper = h("div", { key: "paper", style: { ...box(0, 0, width, height), backgroundColor: solid(PAPER), backgroundImage: FIBRES, backgroundSize: TILE[0] + "px " + TILE[1] + "px", backgroundRepeat: "repeat", overflow: "hidden" } });

  // 2. Her name pressed in it, then inked: dark as it comes in, drying to rust; a front 16 % of the letter, soft.
  const FRONT = 16;
  const mix = (a, b, t) => { const q = Math.max(0, Math.min(1, t)); return a.map((v, i) => Math.round(v + (b[i] - v) * q)); };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(2 - 2 * t, 2) / 2);
  const span = (a, b) => (frame <= a ? 0 : frame >= b ? 1 : ease((frame - a) / Math.max(1, b - a)));
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  // Its filters, one pair per size, each laid once on a whole row (its letters' alpha together, as many walls as one
  // letter alone: a filter per letter, in every copy of the scene check, outlasted its wait), and only while they show:
  // the cavity's two walls (in the shade at the top and the left, lit at the bottom and the right, its floor the paper
  // itself) until its row is inked whole, and the rim of the inked letters once its row's ink has started. Their region
  // reaches past the row for its accents and its tails.
  const cavity = (id, d) => h("filter", { key: id, id, x: "-10%", y: "-25%", width: "120%", height: "150%", colorInterpolationFilters: "sRGB" },
    h("feComponentTransfer", { in: "SourceAlpha", result: "a" }, h("feFuncA", { type: "linear", slope: 40 })),
    ...[[d, solid(SHADE), "t"], [-d, solid(LIT), "b"]].flatMap(([o, c, n]) => [
      h("feOffset", { key: n + 1, in: "a", dx: o, dy: o, result: n + "o" }),
      h("feComposite", { key: n + 2, in: "a", in2: n + "o", operator: "out", result: n + "e" }),
      h("feGaussianBlur", { key: n + 3, in: n + "e", stdDeviation: Math.abs(o) * 0.55, result: n + "s" }),
      h("feComposite", { key: n + 4, in: n + "s", in2: "a", operator: "in", result: n + "m" }),
      h("feFlood", { key: n + 5, floodColor: c, result: n + "c" }),
      h("feComposite", { key: n + 6, in: n + "c", in2: n + "m", operator: "in", result: n + "w" }),
    ]),
    h("feMerge", { key: "m" }, h("feMergeNode", { in: "tw" }), h("feMergeNode", { in: "bw" })));
  const rimmed = (id, r) => h("filter", { key: id, id, x: "-10%", y: "-25%", width: "120%", height: "150%" },
    h("feMorphology", { in: "SourceAlpha", operator: "erode", radius: r, result: "e" }),
    h("feComposite", { in: "SourceAlpha", in2: "e", operator: "out", result: "r" }),
    h("feFlood", { floodColor: solid(RIM), floodOpacity: 0.5, result: "c" }),
    h("feComposite", { in: "c", in2: "r", operator: "in", result: "l" }),
    h("feMerge", null, h("feMergeNode", { in: "SourceGraphic" }), h("feMergeNode", { in: "l" })));
  const cell = { display: "inline-block", padding: "0.22em 0.16em 0.3em", margin: "-0.22em -0.16em -0.3em", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" };
  // A letter's ink at this frame: its front over the glyph in its box (% from its foot: a display serif's line, measured
  // on the model's own), rising from its foot (a tail from under the line, a short letter to its x-height), a round one
  // from its upper left, a line's from its left; a dot or an accent held over its stem until its own time, a sharper
  // front then; the oldest ink the driest.
  const glyph = (c, kind) => (kind === "right" ? [15, 85] : kind === "round" ? [0, /[A-Z]/.test(c) ? 58 : 50] : /[gpqyj]/.test(c) ? [13, 62] : /[A-Zbdfhklt0-9À-Þ]/.test(c) ? [29, 78] : [29, 62]);
  const SHADOW = toward(FRESH, BLACK, 0.4);
  const inked = (t) => {
    if (frame < t.from) return cell;
    const p = span(t.from, t.to);
    const q = t.dot ? span(t.dot[0], t.dot[1]) : 0;
    const c0 = mix(FRESH, t.rust, (frame - t.from) / DRY);
    const c1 = mix(FRESH, t.rust, (frame - (t.dot ? t.dot[1] : t.to)) / DRY);
    const [lo, hi] = t.range;
    const ramp = t.dot ? 6 : FRONT;
    const at = t.dot ? (q > 0 ? t.hold + q * (100 + ramp - t.hold) : lo + p * (t.hold - lo + ramp) - ramp) : lo + p * (hi - lo + ramp) - ramp;
    const stops = css(c0, 1) + " 0%, " + css(c1, 1) + " " + at.toFixed(1) + "%, " + css(c1, 0) + " " + (at + ramp).toFixed(1) + "%";
    const image = t.kind === "round" ? "radial-gradient(circle farthest-corner at 34% " + (/[A-Z]/.test(t.c) ? 36 : 46) + "%, " + stops + ")" : "linear-gradient(" + (t.kind === "right" ? "to right" : "to top") + ", " + stops + ")";
    return { ...cell, backgroundImage: image };
  };
  // An inked letter lifts off the paper: a soft shadow at its bottom right, darker at its foot, its rim darker, both
  // drawn from the ink itself as it comes in (laid on its row).
  const lifted = (row) => "url(#" + row.rim + ") drop-shadow(" + (row.size * 0.02).toFixed(1) + "px " + (row.size * 0.034).toFixed(1) + "px " + (row.size * 0.035).toFixed(1) + "px " + css(SHADOW, 0.5) + ")";
  // A block of pressed rows: each letter its own box from the start (nothing moves as it inks), its words never broken;
  // the same rows in ink laid exactly over them.
  const ROUND = /^[SsCcOoGgeQ]$/;
  const dotted = (c) => /^[ij]$/.test(c) || /[̀-̏]/.test(c.normalize("NFD"));
  const wordsOf = (text) => String(text).split(" ").filter(Boolean).map((w) => letters(w));
  const cells = (text) => wordsOf(text).reduce((a, w) => a + w.length, 0);
  const floor = "linear-gradient(" + css(PAPER, 0.03) + ", " + css(PAPER, 0.03) + ")";
  const pressed = (rows) => {
    // Each letter's ink, in order over the rows; each row's first ink and the moment it is inked whole.
    let j = 0;
    const timed = rows.map((row) => {
      const words = wordsOf(row.text).map((w) => w.map((c) => ({ c, t: row.timing(j++, c) })));
      const all = words.flat();
      return { row, words, from: Math.min(...all.map((x) => x.t.from)), done: Math.max(...all.map((x) => (x.t.dot ? x.t.dot[1] : x.t.to))) };
    });
    const layer = (inking) =>
      timed.map(({ row, words, from, done }, r) => {
        const letter = (x, n) => h("span", { key: n, style: inking ? inked(x.t) : { ...cell, backgroundImage: floor } }, x.c);
        // Spread over its width, each letter and each space is one step; else its words, never broken.
        const drawn = row.justify
          ? words.flatMap((w, i) => [...(i ? [h("span", { key: "s" + i, style: { width: "0.3em" } }, " ")] : []), ...w.map((x, n) => letter(x, i + "-" + n))])
          : words.flatMap((w, i) => [...(i && !row.gap ? [" "] : []), h("span", { key: "w" + i, style: { whiteSpace: "nowrap", display: "inline-block" } }, w.map(letter))]);
        // Its walls until it is inked whole (its ink then covers them), its rim and its shadow once its ink has started.
        const filter = inking ? (frame >= from ? lifted(row) : "none") : frame <= done + 1 ? "url(#" + row.cavity + ")" : "none";
        return h("div", { key: "r" + r, ...(row.accent ? { "data-fauve-accent": "" } : {}), style: { ...row.style, filter } }, drawn);
      });
    return h("div", { style: { position: "relative", display: "flex", flexDirection: "column", alignItems: "stretch" } },
      layer(false), h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "stretch" } }, layer(true)));
  };

  const display = "'" + brand.displayFont + "', 'DM Serif Display', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Cormorant Garamond', Georgia, serif";
  // A name on one, two or three lines (as long as needed, the longest line as short as it can be), broken between words.
  const linesOf = (text) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    const want = text.length <= 9 || words.length < 2 ? 1 : text.length <= 16 || words.length < 3 ? 2 : 3;
    if (want === 1) return [words.join(" ")];
    let found = null;
    const cut = (a, b) => words.slice(a, b).join(" ");
    for (let i = 1; i < words.length; i++) for (let m = want === 2 ? words.length : i + 1; m <= words.length - (want === 2 ? 0 : 1); m++) {
      const lines = want === 2 ? [cut(0, i), cut(i, words.length)] : [cut(0, i), cut(i, m), cut(m, words.length)];
      const longest = Math.max(...lines.map((l) => l.length));
      if (!found || longest < found.longest) found = { lines, longest };
    }
    return found ? found.lines : [text];
  };
  // How wide a line is in its em (a display serif's narrow, round and wide letters).
  const ems = (s) => letters(s).reduce((a, c) => a + (/[ijlrtfI'’.,:;!|\s]/.test(c) ? 0.3 : /[mwMW]/.test(c) ? 0.85 : /[A-Z]/.test(c) ? 0.68 : 0.52), 0);
  const filters = [];
  // Its card: her name as big as the original's (its capitals 16,4 % of the height, its word on at most 800 px), her
  // line in capitals a quarter of its size or less, spread over the name's width, 4 % of the height under its foot.
  const name = keep(word("titre"));
  const small = keep(word("ligne")).toUpperCase();
  const count = cells(name);
  const m = cells(small);
  const lines = linesOf(name);
  const FS = Math.round(Math.min((height * 0.164) / 0.7, 780 / Math.max(1, ...lines.map(ems)), (height * 0.36) / (lines.length * 1.02)));
  const wide = Math.min(800, FS * Math.max(...lines.map(ems)));
  const L = Math.round(Math.max(34, Math.min(FS * 0.19, 80, wide / Math.max(1, m * 0.62))));
  filters.push(cavity(ID + "t", Math.max(1.5, FS * 0.03)), rimmed(ID + "r", Math.max(0.8, FS * 0.006)), cavity(ID + "s", Math.max(1.2, L * 0.035)), rimmed(ID + "q", Math.max(0.6, L * 0.008)));

  // Its schedule: the first letter slowly (already inking at the cut), the others from SECOND to LAST, each in the same
  // time, a dot or an accent from DOTS, all of it by INKED; the line letter by letter from LINE_FROM to LINE_TO.
  const EACH = Math.max(6, INKED - LAST);
  const ink = (from, to, c, kind, rust, dot) => ({ from, to, c, kind, rust, dot, range: glyph(c, kind), hold: /[a-zß-ÿ]/.test(c) ? 62 : 74 });
  const timing = (j, c) => {
    const from = j === 0 ? INK : count > 2 ? SECOND + ((j - 1) * (LAST - SECOND)) / (count - 2) : LAST;
    return ink(from, j === 0 ? (count > 1 ? FIRST : INKED) : from + EACH, c, ROUND.test(c) ? "round" : "rise", RUST, j > 0 && dotted(c) ? [DOTS, INKED] : null);
  };
  const lineTiming = (j, c) => {
    const from = LINE_FROM + (j - count) * ((LINE_TO - LINE_FROM - 9) / Math.max(1, m - 1));
    return ink(from, from + 9, c, "right", LINE_RUST, null);
  };
  const head = { size: FS, cavity: ID + "t", rim: ID + "r", timing, style: { fontFamily: display, fontWeight: 400, fontSynthesis: "none", fontSize: FS, lineHeight: 1.02, letterSpacing: "-0.005em", textAlign: "center", whiteSpace: "nowrap", fontKerning: "none", fontVariantLigatures: "none" } };
  const rows = name ? lines.map((text) => ({ ...head, text })) : [];
  // Spread over the name's width when it nearly fills it (the original's); shorter, centred and spaced.
  const justify = m > 6 && m * 0.62 * L >= wide * 0.6;
  if (small) rows.push({ text: small, size: L, cavity: ID + "s", rim: ID + "q", timing: lineTiming, accent: true, justify, gap: !justify, style: { display: "flex", flexWrap: "nowrap", justifyContent: justify ? "space-between" : "center", columnGap: justify ? 0 : "0.3em", marginTop: Math.round(height * 0.04 - FS * 0.16 - L * 0.27), fontFamily: body, fontWeight: 600, fontSynthesis: "none", fontSize: L, lineHeight: 1.15, letterSpacing: justify ? 0 : "0.12em", whiteSpace: "nowrap", fontVariantNumeric: "lining-nums" } });
  const tall = lines.length * FS * 1.02;
  const card = rows.length
    ? h(FitText, { key: "card", style: box(140, height * 0.504 - tall / 2, width - 280, tall + (small ? height * 0.04 + L * 1.4 : 0) + 40), innerStyle: { justifyContent: "flex-start" } }, pressed(rows))
    : null;

  const defs = h("svg", { key: "defs", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" }, filters);
  // An opaque layer of its own: where the scene check stacks a copy of it for every frame it reads, only the copy on top
  // is drawn (the others are hidden under its paper), and its filters are drawn once.
  return h(AbsoluteFill, { style: { backgroundColor: solid(PAPER), overflow: "hidden", willChange: "transform" } }, paper, defs, card);
}`;

export const gaufre: EffectPiece = {
  key: "gaufre",
  version: 1,
  name: "Titre gaufré",
  how: "une coupe franche sur un papier pêche en plein écran, son nom pressé en creux dedans dès la première image, une petite ligne en capitales dessous ; l'encre entre dans chaque lettre (la première lentement, les autres en montant, le point d'un i en dernier), sèche du brun au rouille et la lettre se soulève ; la ligne s'encre de gauche à droite ; la carte encrée tenue un temps et demi, puis le montage reprend.",
  needs: "son nom ou 1 à 3 mots qui la disent (le mieux, un mot court), et si elle veut une ligne courte : son métier et son quartier, une date, sa devise ; rien à filmer : le papier est dessiné et couvre les plans dessous.",
  lays: "sur 1 à 3 de ses plans qu'il couvre en entier (un papier dessiné) : en fin de Reel comme une signature, en ouverture, ou comme un carton entre deux moments ; le plan d'après reprend en plein écran",
  shots: [1, 12],
  seconds: [2.5, 6],
  require: {},
  texts: [
    {
      slot: "titre",
      want: "son nom pressé dans le papier puis encré : son nom (le mieux, un mot court ; l'original en a 5 lettres) ou 1 à 3 mots qui la disent, dans sa casse, sans point",
      max: 22,
      required: true,
    },
    {
      slot: "ligne",
      want: "une ligne courte sous son nom, en capitales mises à sa largeur : son métier et son quartier, une date, sa devise (une forme comme « pâtisserie · paris 11e », « depuis 1998 »)",
      max: 24,
      required: false,
    },
  ],
  settings: [
    {
      name: "papier",
      want: "les couleurs du papier et de l'encre",
      choices: [
        { value: "peche", says: "le papier pêche et l'encre rouille de l'original" },
        { value: "charte", says: "le papier dans la couleur claire de sa charte, l'encre dans sa couleur principale (ou sa couleur sombre si elle ne se lit pas dessus)" },
      ],
    },
  ],
  timeline({ frames, bpm }) {
    const { hold: _hold, ...marks } = gaufreMoments(frames, bpm);
    return { marks };
  },
  code: CODE,
};
