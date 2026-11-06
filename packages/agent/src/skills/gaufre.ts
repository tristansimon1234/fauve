import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Titre gaufré », version 2, written again on its original's fiche (docs/fiches/gaufre.md: measured image by image at
// 30 i/s, each piece of its front box by box, its ink letter by letter, its music by bands of frequency; Tristan: « c'est
// un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Its original is one still video of a café's
// front, then a sheet of peach paper (« Façade qui se construit » is its first half: two models, chained on her word). Its
// music has two tempos, an intro without drums at about 136 and a played groove at about 120 from its reprise; ours is
// one loop from its first beat at 0, so every length below is in beats of 113,2 BPM, the grid on which the original's
// reprise (5,30 s), its two pieces after it, its cut to the paper (9,00 s) and its end (12,73 s) all fall on whole beats
// (10, 11, 12, 17, 24, its groove's first three beats played at that pace); each piece lands within an image of the
// original's:
//   0 – 2,67    on pure black, pieces of her front land one at a time, whole, at their place, in one image (no fade, no
//               slide, no edge), her video playing in them: what carries her name first, then a large thing far from it,
//               then the highest one (one a chord of the original);
//   2,67 – 4,40 thirteen more in a burst, one every 3 to 6 images: the widest thing across it, what stands before it, its
//               windows and what her window shows from right to left, then the walls between them, from the bottom up;
//   4,40 – 5,27 nothing lands: its music, thin from the start (without its bass), stops;
//   5,27 · 5,83 · 6,33 the street on the reprise (the music back whole), the top on the left, then the rest;
//   6,33 – 9,00 her front whole, still and alive (no zoom, no push: measured);
//   9,00 – 12,73 a hard cut to a peach paper with short curly fibres, her name pressed in it from its first image (its
//               walls dark at the top and the left, lit at the bottom and the right: the light from the top left), a line
//               of serif capitals under it at its width; a dark ink comes into each letter with a soft front (the first
//               one slowly from its upper left, the others rising from their foot 0,4 s apart, a dot or an accent last),
//               dries to rust and lifts the letter off the paper (a soft shadow at its bottom right, a darker rim); the
//               line inks from left to right; the music stops dead at 11,93 s, the card inked whole on the last images.
// Her front's pieces are what it is made of, named by the filler and read once on a passage of the same video under the
// paper (a still camera: its things at the same places; four objects within the engine's 20 s a Reel, the fourth left
// out when an ending card makes that passage longer); too few found, its middle in regular pieces. Played full frame
// as the original when her video is upright, her video whole in a 16:9 band in the middle of the black when it is in
// width (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »); the paper always full
// frame. Her photo stays still, her video plays. Nothing of the original's own is copied: « Still » and « IN THE MOMENT »
// give way to her name and her line; the peach paper and the rust ink are the model's own.

const BPM = 113.2;
/** Her front's pieces land on these beats: the original's images 1, 25, 53, then its burst (80 to 132), then the street on its reprise and the two largest on its next beats (158, 175, 190). */
const PIECES = [0.06, 1.57, 3.33, 5.03, 5.35, 5.66, 5.91, 6.1, 6.29, 6.54, 6.86, 7.17, 7.42, 7.8, 8.05, 8.3, 9.94, 11, 11.95];
/** Its music: thin (without its bass) until the reprise, stopped dead from this beat to it, cut dead when its groove ends. */
const STOP = 8.5;
const REPRISE = 10;
const GROOVE_END = 22.5;
/** The cut to the paper and the Reel's end (its card inked whole on its last images). */
const PAPER = 17;
const END = 24;
/**
 * Its ink, in beats: the first letter from before the cut (already in it on the paper's first image, then 1,8 s) to
 * FIRST, the second from SECOND, the last from LAST (the others between, 0,4 s apart at five letters), each done in
 * INKED − LAST; the dots and accents from DOTS; all of it by INKED; the line from LINE_FROM to LINE_TO; an ink dries to
 * rust over DRY.
 */
const INK = 14.3;
const FIRST = 20.3;
const SECOND = 19.95;
const LAST = 22.33;
const DOTS = 22.58;
const INKED = 23.52;
const LINE_FROM = 20.44;
const LINE_TO = 23.77;
const DRY = 4;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS). */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const PAPER = mark("paper", 270);
  const endAt = end ? end.from : durationInFrames + 1;
  const ID = "gf" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const box = (x, y, w, t) => ({ position: "absolute", left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(t) });

  // Its frame: the whole vertical frame as the original when her video of her front is upright, her video whole in a
  // 16:9 band in the middle of the black when it is in width (or on her word); the paper always full frame.
  const format = setting("format", "vertical");
  const lying = format === "horizontal" || (format === "auto" && (Number(shots[0] && shots[0].aspect) || 0.5625) > 1.15);
  const W = width;
  const H = lying ? Math.round((width * 9) / 16) : height;
  const by = lying ? Math.round((height - H) / 2) : 0;
  const laid = { left: 0, top: 0, width: W, height: H };

  // 1. What her front is made of, read once on the passage of the same video under the paper (shot 1: a still camera,
  // its things at the same places): what carries her name, its windows, what her window shows, what stands before it.
  const same = Boolean(shots[0] && shots[1] && (!shots[1].src || shots[1].src === shots[0].src));
  const READ = shots[1] ? shots[1].from : 0;
  const one = (b) => (b ? [b] : []);
  const own = (parts, b) => (parts.length ? parts : one(b));
  const named = same
    ? [
        ...one(SubjectBox(shots[1], READ, laid, "@nom")).map((b) => ({ ...b, kind: "nom" })),
        ...own(SubjectParts(shots[1], READ, laid, "@fenetres", 0), SubjectBox(shots[1], READ, laid, "@fenetres")).map((b) => ({ ...b, kind: "fenetre" })),
        ...own(SubjectParts(shots[1], READ, laid, "@vitrine", 0), SubjectBox(shots[1], READ, laid, "@vitrine")).map((b) => ({ ...b, kind: "vitrine" })),
        ...own(SubjectParts(shots[1], READ, laid, "@devant", 0), SubjectBox(shots[1], READ, laid, "@devant")).map((b) => ({ ...b, kind: "devant" })),
      ]
    : [];
  const area = (b) => b.w * b.h;
  const over = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  // In the picture and above its street (what lies in it comes with it), neither a speck nor most of it, never twice.
  const els = [];
  named.forEach((b) => {
    const x = Math.max(0, b.x);
    const y = Math.max(0, b.y);
    const c = { x, y, w: Math.min(W, b.x + b.w) - x, h: Math.min(H, b.y + b.h) - y, kind: b.kind };
    if (c.w < 8 || c.h < 8 || c.y > H * 0.8 || area(c) < W * H * 0.002 || area(c) > W * H * 0.3) return;
    if (!els.some((e) => over(e, c) > 0.6 * Math.min(area(e), area(c)))) els.push(c);
  });
  // Its order: slowly, three things far apart that say the place (her name, a large thing far from it, the highest
  // one); then a burst: the widest thing across it, what stands before it from left to right, its windows and what her
  // window shows from right to left.
  const mid = (b) => b.x + b.w / 2;
  const best = (list, score) => list.reduce((m, b) => (m === null || score(b) > score(m) ? b : m), null);
  const rest = els.slice();
  const take = (b) => { if (b) rest.splice(rest.indexOf(b), 1); return b; };
  const p1 = take(rest.find((b) => b.kind === "nom") || best(rest, area));
  const p2 = take(p1 ? best(rest, (b) => Math.abs(mid(b) - mid(p1)) * Math.sqrt(area(b))) : null);
  const p3 = take(best(rest, (b) => -b.y));
  const p4 = take(best(rest, (b) => b.w));
  let pieces = [p1, p2, p3, p4, ...rest.filter((b) => b.kind === "devant").sort((a, b) => a.x - b.x), ...rest.filter((b) => b.kind !== "devant").sort((a, b) => b.x - a.x)].filter(Boolean);
  const NEED = 16;
  if (els.length >= 6) {
    // Then the walls between them, row by row from the bottom up (each row of things, the band between two rows),
    // the widest halved, its right half first, while more pieces are wanted.
    const rows = [];
    els.slice().sort((a, b) => a.y - b.y).forEach((b) => {
      const r = rows.find((q) => b.y < q.y + q.h && b.y + b.h > q.y);
      if (!r) { rows.push({ x: b.x, y: b.y, w: b.w, h: b.h }); return; }
      const x = Math.min(r.x, b.x);
      const y = Math.min(r.y, b.y);
      Object.assign(r, { w: Math.max(r.x + r.w, b.x + b.w) - x, h: Math.max(r.y + r.h, b.y + b.h) - y, x, y });
    });
    rows.sort((a, b) => a.y - b.y);
    let bands = [];
    rows.forEach((r, i) => {
      bands.push(r);
      const n = rows[i + 1];
      if (n && n.y - r.y - r.h > H * 0.02) { const x = Math.min(r.x, n.x); bands.push({ x, y: r.y + r.h, w: Math.max(r.x + r.w, n.x + n.w) - x, h: n.y - r.y - r.h }); }
    });
    // (A row of one thing is that thing: nothing more would show.)
    bands = bands.filter((b) => !els.some((e) => over(e, b) >= 0.85 * area(b))).sort((a, b) => b.y + b.h - (a.y + a.h));
    while (pieces.length + bands.length < NEED) {
      const k = bands.reduce((m, b, i) => (b.w > bands[m].w ? i : m), 0);
      const b = bands[k];
      if (!b || b.w < W * 0.12) break;
      bands.splice(k, 1, { x: b.x + b.w / 2, y: b.y, w: b.w / 2, h: b.h }, { x: b.x, y: b.y, w: b.w / 2, h: b.h });
    }
    pieces = [...pieces, ...bands].slice(0, NEED);
  } else {
    // Too few things found in it: its middle in regular pieces, in an order shuffled once.
    const ORDER = [5, 10, 3, 12, 0, 15, 6, 9, 2, 13, 7, 8, 1, 14, 4, 11];
    pieces = [...pieces, ...ORDER.map((i) => ({ x: W * (0.08 + 0.21 * (i % 4)), y: H * (0.15 + 0.1425 * Math.floor(i / 4)), w: W * 0.21, h: H * 0.1425 }))].slice(0, NEED);
  }
  // Then the three largest: the street (all of it under its things), the top on the left, the rest.
  const low = Math.min(H * 0.86, Math.max(H * 0.5, ...pieces.map((b) => b.y + b.h)));
  const all = [...pieces, { x: 0, y: low, w: W, h: H - low }, { x: 0, y: 0, w: W * 0.339, h: low }, { x: 0, y: 0, w: W, h: H }];
  const LANDS = [1, 25, 53, 80, 85, 90, 94, 97, 100, 104, 109, 114, 118, 124, 128, 132, 158, 175, 190].map((f, j) => mark("piece_" + j, f));
  // Fewer than sixteen before the three largest: the first three slowly, the others spread over the burst.
  const k = pieces.length;
  const slot = (j) => (j >= k ? 16 + j - k : j < 3 || k >= NEED ? j : 3 + Math.round(((j - 3) * 12) / Math.max(1, k - 4)));
  const rect = (b) => "M" + Math.round(b.x) + " " + Math.round(b.y) + "H" + Math.round(b.x + b.w) + "V" + Math.round(b.y + b.h) + "H" + Math.round(b.x) + "Z";
  const shown = all.filter((_, j) => frame >= LANDS[slot(j)]);
  const clip = frame >= LANDS[18] ? null : shown.length ? "path('" + shown.map(rect).join(" ") + "')" : "inset(50%)";
  const film = frame < PAPER
    ? h("div", { style: { ...box(0, 0, W, H), overflow: "hidden", ...(clip ? { clipPath: clip } : {}) } }, h(Footage, { shot: 0, style: box(0, 0, W, H) }))
    : null;
  const frameBox = h("div", { style: { ...box(0, by, W, H), overflow: "hidden", backgroundColor: "#000000" } }, film);

  // 2. The paper, full frame from the cut: the original's peach (#f5cca4 on average), its short curly fibres in relief lit
  // from the top left, as soft as the original's (4 levels of 255 in each colour alike: the relief baked in its image, so
  // its mean stays the peach); no grain, no shade at its edges, still. An image drawn once, the same at every frame.
  const PAPER_COLOR = "#f5cca4";
  const svg = (inner) => "url(\"data:image/svg+xml;charset=utf-8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='" + width + "' height='" + height + "'>" + inner + "</svg>") + "\")";
  const FIBRES = svg("<filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='turbulence' baseFrequency='0.042 0.021' numOctaves='3' seed='4'/><feDiffuseLighting lighting-color='#ffffff' surfaceScale='5' diffuseConstant='1'><feDistantLight azimuth='225' elevation='45'/></feDiffuseLighting><feColorMatrix type='matrix' values='0.0848 0 0 0 0.9045  0.0848 0 0 0 0.7437  0.0848 0 0 0 0.5868  0 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#f)'/>");
  const paper = frame >= PAPER
    ? h("div", { style: { ...box(0, 0, width, height), backgroundColor: PAPER_COLOR, backgroundImage: FIBRES, backgroundSize: "100% 100%", overflow: "hidden" } })
    : null;

  // 3. Her name pressed in it, then inked. Its ink: dark as it comes in, drying to rust; a front 16 % of the letter, soft.
  const FRESH = "#7d2100";
  const RUST = "#b43c01";
  const LINE_RUST = "#a04b20";
  const SHADE = "#b78c64";
  const LIT = "#ffe0b8";
  const DRY = Math.max(1, mark("dry", 64));
  const FRONT = 16;
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = rgb(a); const y = rgb(b); const q = Math.max(0, Math.min(1, t)); return x.map((v, i) => Math.round(v + (y[i] - v) * q)); };
  const css = (c, a) => "rgba(" + c.join(",") + "," + a + ")";
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(2 - 2 * t, 2) / 2);
  const span = (a, b) => (frame <= a ? 0 : frame >= b ? 1 : ease((frame - a) / Math.max(1, b - a)));
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  // Its filters, one pair per size: the cavity's two walls (in the shade at the top and the left, lit at the bottom and
  // the right, its floor the paper itself), and the rim of an inked letter.
  const cavity = (id, d) => h("filter", { key: id, id, x: "-10%", y: "-10%", width: "120%", height: "120%", colorInterpolationFilters: "sRGB" },
    h("feComponentTransfer", { in: "SourceAlpha", result: "a" }, h("feFuncA", { type: "linear", slope: 40 })),
    ...[[d, SHADE, "t"], [-d, LIT, "b"]].flatMap(([o, c, n]) => [
      h("feOffset", { key: n + 1, in: "a", dx: o, dy: o, result: n + "o" }),
      h("feComposite", { key: n + 2, in: "a", in2: n + "o", operator: "out", result: n + "e" }),
      h("feGaussianBlur", { key: n + 3, in: n + "e", stdDeviation: Math.abs(o) * 0.55, result: n + "s" }),
      h("feComposite", { key: n + 4, in: n + "s", in2: "a", operator: "in", result: n + "m" }),
      h("feFlood", { key: n + 5, floodColor: c, result: n + "c" }),
      h("feComposite", { key: n + 6, in: n + "c", in2: n + "m", operator: "in", result: n + "w" }),
    ]),
    h("feMerge", { key: "m" }, h("feMergeNode", { in: "tw" }), h("feMergeNode", { in: "bw" })));
  const rimmed = (id, r) => h("filter", { key: id, id, x: "-10%", y: "-10%", width: "120%", height: "120%" },
    h("feMorphology", { in: "SourceAlpha", operator: "erode", radius: r, result: "e" }),
    h("feComposite", { in: "SourceAlpha", in2: "e", operator: "out", result: "r" }),
    h("feFlood", { floodColor: "#3a0f00", floodOpacity: 0.5, result: "c" }),
    h("feComposite", { in: "c", in2: "r", operator: "in", result: "l" }),
    h("feMerge", null, h("feMergeNode", { in: "SourceGraphic" }), h("feMergeNode", { in: "l" })));
  const cell = { display: "inline-block", padding: "0.22em 0.16em 0.3em", margin: "-0.22em -0.16em -0.3em", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" };
  // A letter's ink at this frame: its front over the glyph in its box (% from its foot: a display serif's line, measured
  // on the model's own), rising from its foot (a tail from under the line, a short letter to its x-height), a round one
  // from its upper left, a line's from its left; a dot or an accent held over its stem until its own time, a sharper
  // front then; the oldest ink the driest.
  const glyph = (c, kind) => (kind === "right" ? [15, 85] : kind === "round" ? [0, /[A-Z]/.test(c) ? 58 : 50] : /[gpqyj]/.test(c) ? [13, 62] : /[A-Zbdfhklt0-9\u00c0-\u00de]/.test(c) ? [29, 78] : [29, 62]);
  const inked = (t, size, rim) => {
    if (frame < t.from) return { ...cell, filter: "none" };
    const p = span(t.from, t.to);
    const q = t.dot ? span(t.dot[0], t.dot[1]) : 0;
    const c0 = mix(FRESH, t.rust, (frame - t.from) / DRY);
    const c1 = mix(FRESH, t.rust, (frame - (t.dot ? t.dot[1] : t.to)) / DRY);
    const [lo, hi] = t.range;
    const ramp = t.dot ? 6 : FRONT;
    const at = t.dot ? (q > 0 ? t.hold + q * (100 + ramp - t.hold) : lo + p * (t.hold - lo + ramp) - ramp) : lo + p * (hi - lo + ramp) - ramp;
    const stops = css(c0, 1) + " 0%, " + css(c1, 1) + " " + at.toFixed(1) + "%, " + css(c1, 0) + " " + (at + ramp).toFixed(1) + "%";
    const image = t.kind === "round" ? "radial-gradient(circle farthest-corner at 34% " + (/[A-Z]/.test(t.c) ? 36 : 46) + "%, " + stops + ")" : "linear-gradient(" + (t.kind === "right" ? "to right" : "to top") + ", " + stops + ")";
    // It lifts off the paper over 0,4 s: a soft shadow at its bottom right, darker at its foot, its rim darker.
    const lift = (0.5 * span(t.from, t.from + 12)).toFixed(3);
    return { ...cell, backgroundImage: image, filter: "url(#" + rim + ") drop-shadow(" + (size * 0.02).toFixed(1) + "px " + (size * 0.034).toFixed(1) + "px " + (size * 0.035).toFixed(1) + "px rgba(72,26,4," + lift + "))" };
  };
  // A block of pressed rows: each letter its own box from the start (nothing moves as it inks), its words never broken;
  // the same rows in ink laid exactly over them.
  const ROUND = /^[SsCcOoGgeQ]$/;
  const dotted = (c) => /^[ij]$/.test(c) || /[\u0300-\u030f]/.test(c.normalize("NFD"));
  const wordsOf = (text) => String(text).split(" ").filter(Boolean).map((w) => letters(w));
  const cells = (text) => wordsOf(text).reduce((a, w) => a + w.length, 0);
  const pressed = (rows) => {
    const layer = (inking) => {
      let j = 0;
      return rows.map((row, r) => {
        const letter = (c, n) => { const t = row.timing(j++, c); return h("span", { key: n, style: inking ? inked(t, row.size, row.rim) : { ...cell, backgroundImage: "linear-gradient(rgba(245,204,164,0.03), rgba(245,204,164,0.03))", filter: "url(#" + row.cavity + ")" } }, c); };
        // Spread over its width, each letter and each space is one step; else its words, never broken.
        const drawn = row.justify
          ? wordsOf(row.text).flatMap((w, i) => [...(i ? [h("span", { key: "s" + i, style: { width: "0.3em" } }, " ")] : []), ...w.map((c, n) => letter(c, i + "-" + n))])
          : wordsOf(row.text).flatMap((w, i) => [...(i && !row.gap ? [" "] : []), h("span", { key: "w" + i, style: { whiteSpace: "nowrap", display: "inline-block" } }, w.map(letter))]);
        return h("div", { key: "r" + r, ...(row.accent ? { "data-fauve-accent": "" } : {}), style: row.style }, drawn);
      });
    };
    return h("div", { style: { position: "relative", display: "flex", flexDirection: "column", alignItems: "stretch" } },
      layer(false), h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "stretch" } }, layer(true)));
  };

  const display = "'" + brand.displayFont + "', 'DM Serif Display', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Cormorant Garamond', Georgia, serif";
  // A title on one, two or three lines (as long as needed, the longest line as short as it can be), broken between words.
  const linesOf = (text, most) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    const want = text.length <= 9 || words.length < 2 ? 1 : text.length <= 16 || words.length < 3 || most < 3 ? 2 : 3;
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
  // A card: its title as big as the original's (its capitals 16,4 % of the height, its word on at most 800 px), its line
  // in serif capitals a quarter of its size or less, spread over the title's width, 4 % of the height under its foot.
  const card = (title, small, timing, lineTiming, fast) => {
    const lines = linesOf(title, fast ? 2 : 3);
    const F = Math.round(Math.min(fast ? 200 : (height * 0.164) / 0.7, 780 / Math.max(1, ...lines.map(ems)), (height * (fast ? 0.24 : 0.36)) / (lines.length * 1.02)));
    const m = small ? letters(small).length : 0;
    const wide = Math.min(800, F * Math.max(...lines.map(ems)));
    const L = Math.round(Math.max(34, Math.min(F * 0.19, fast ? 46 : 80, fast ? 80 : wide / Math.max(1, m * 0.62))));
    const tag = fast ? "e" : "c";
    filters.push(cavity(ID + tag + "t", Math.max(1.5, F * 0.03)), rimmed(ID + tag + "r", Math.max(0.8, F * 0.006)), cavity(ID + tag + "s", Math.max(1.2, L * 0.035)), rimmed(ID + tag + "q", Math.max(0.6, L * 0.008)));
    const head = { size: F, cavity: ID + tag + "t", rim: ID + tag + "r", timing, style: { fontFamily: display, fontWeight: 400, fontSynthesis: "none", fontSize: F, lineHeight: 1.02, letterSpacing: "-0.005em", textAlign: "center", whiteSpace: "nowrap", fontKerning: "none", fontVariantLigatures: "none" } };
    const rows = lines.map((text) => ({ ...head, text }));
    // Spread over the title's width when it nearly fills it (the original's); shorter, centred and spaced; an ending's
    // line as long as it needs, on several lines.
    const justify = !fast && m > 6 && m * 0.62 * L >= wide * 0.6;
    if (small) rows.push({ text: small.toUpperCase(), size: L, cavity: ID + tag + "s", rim: ID + tag + "q", timing: lineTiming, accent: !fast, justify, gap: !justify, style: { display: "flex", flexWrap: fast ? "wrap" : "nowrap", justifyContent: justify ? "space-between" : "center", columnGap: justify ? 0 : "0.3em", marginTop: Math.round(height * 0.04 - F * 0.16 - L * 0.27), fontFamily: body, fontWeight: 600, fontSynthesis: "none", fontSize: L, lineHeight: 1.15, letterSpacing: justify ? 0 : "0.12em", whiteSpace: "nowrap", fontVariantNumeric: "lining-nums" } });
    const tall = lines.length * F * 1.02;
    return h(FitText, { style: box(140, height * 0.504 - tall / 2, width - 280, tall + (small ? height * 0.04 + L * 1.4 : 0) + 40), innerStyle: { justifyContent: "flex-start" } }, pressed(rows));
  };

  // Its schedule: the first letter slowly (already inking at the cut), the others from SECOND to LAST, each in the same
  // time, a dot or an accent from DOTS, all of it by INKED; the line letter by letter from LINE_FROM to LINE_TO.
  const hook = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== line);
  const name = hook ? String(hook.text) : "";
  const count = cells(name);
  const INK = mark("ink", 227);
  const SECOND = mark("second", 317);
  const LAST = mark("last", 355);
  const INKED = mark("inked", 374);
  const EACH = Math.max(6, INKED - LAST);
  // A letter's ink from one frame to another; a dot or an accent (an i, an é) held over its stem (its x-height, a
  // capital's top) to its own time.
  const ink = (from, to, c, kind, rust, dot) => ({ from, to, c, kind, rust, dot, range: glyph(c, kind), hold: /[a-z\u00df-\u00ff]/.test(c) ? 62 : 74 });
  const timing = (j, c) => {
    const from = j === 0 ? INK : count > 2 ? SECOND + ((j - 1) * (LAST - SECOND)) / (count - 2) : LAST;
    return ink(from, j === 0 ? (count > 1 ? mark("first", 323) : INKED) : from + EACH, c, ROUND.test(c) ? "round" : "rise", RUST, j > 0 && dotted(c) ? [mark("dots", 359), INKED] : null);
  };
  const small = line ? keep(line.text) : "";
  const m = cells(small.toUpperCase());
  const LINE_FROM = mark("line_from", 325);
  const LINE_TO = mark("line_to", 378);
  const lineTiming = (j, c) => {
    const from = LINE_FROM + (j - count) * ((LINE_TO - LINE_FROM - 9) / Math.max(1, m - 1));
    return ink(from, from + 9, c, "right", LINE_RUST, null);
  };
  const onCard = frame >= PAPER && frame < endAt && (hook || line);
  const titled = onCard ? card(name, small, timing, lineTiming, false) : null;

  // 4. Its ending card, when she has one (an option: the original has none): the next card of the same paper, its title
  // and its line pressed, then inked quickly.
  const e0 = end ? endAt + 3 : 0;
  const endTitle = end ? keep(end.title) : "";
  const ek = cells(endTitle);
  const est = ek > 1 ? Math.max(1, Math.min(3, 16 / (ek - 1))) : 1;
  const ending = end && frame >= endAt
    ? card(endTitle, end.subtitle ? keep(end.subtitle) : "",
        (j, c) => ink(e0 + j * est, e0 + j * est + 10, c, ROUND.test(c) ? "round" : "rise", RUST, null),
        (j, c) => ink(e0 + ek * est + j - ek, e0 + ek * est + j - ek + 7, c, "right", LINE_RUST, null), true)
    : null;

  // Any other text of the Reel (none in its slots): a plain line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: box(140, 1330 - i * 120, width - 280, 110), innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: frame >= PAPER ? "#7d2100" : "#ffffff", textAlign: "center", textShadow: frame >= PAPER ? "none" : "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  const defs = filters.length ? h("svg", { width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" }, filters) : null;
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, paper, defs, titled, ending, extra);
}`;

export const gaufre: MontageSkill = {
  key: "gaufre",
  // 2: written again on its original's fiche: its front built piece by piece on the black from what it is made of (her
  // name first), on its music's notes, a stop and the street on the reprise; its paper, its name pressed then inked
  // along each letter, dark then rust, lifted off the paper, its line inked from left to right; its tempo (113,2), its
  // music thin then whole, cut dead; its format; no grain nor dark corners.
  // 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 3,
  bpm: BPM,
  // Her front (the original has one video), and the same video under the paper, where its things are read.
  shots: [2, 2],
  files: [1, 1],
  how: "Sur un écran noir, sa devanture se construit morceau par morceau, chacun d'un coup à sa place, sa vidéo jouant dedans : d'abord ce qui porte son nom, puis une chose loin de lui et la plus haute, puis une rafale (ce qui traverse sa devanture, ce qui est devant, ses fenêtres, ses murs), un silence, et sur la reprise la rue, le haut à gauche, le reste ; sa devanture vit en entier ; puis une coupe franche sur un papier pêche où son nom est pressé en creux, une ligne en capitales dessous : l'encre entre dans chaque lettre (la première lentement, les autres en montant, le point d'un i en dernier), sèche du brun au rouille, et la lettre se soulève ; la ligne s'encre de gauche à droite. En plein écran comme l'original, une vidéo en largeur recadrée sur son sujet ; entière dans une bande au milieu du noir à sa demande.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "son nom pressé dans le papier puis encré : son nom (le mieux, un mot court ; l'original en a 5 lettres) ou 1 à 3 mots qui la disent, dans sa casse, sans point",
      max: 22,
      required: true,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "une ligne courte sous son nom, en capitales mises à sa largeur : son métier et son quartier, une date, sa devise (une forme comme « pâtisserie · paris 11e », « depuis 1998 »)",
      max: 24,
      required: false,
    },
  ],
  objects: [
    {
      slot: "nom",
      shot: 1,
      want: "ce qui porte son nom sur sa devanture, le premier morceau qui apparaît : son enseigne, son nom peint sur sa vitrine ou sa porte, son store écrit (« shop sign », « painted window lettering », « lettered awning ») ; vide si son nom ne se voit pas",
    },
    {
      slot: "fenetres",
      shot: 1,
      want: "ce qui se répète dans sa façade : ses fenêtres, les vitres de sa vitrine, sa porte vitrée, ses arches, ses étagères (« every window », « every arch », « every shelf ») ; toujours « every » et la chose répétée",
    },
    {
      slot: "vitrine",
      shot: 1,
      want: "ce que montre sa vitrine, côte à côte : ses sacs, ses bouteilles, ses gâteaux, ses bouquets, ses livres en pile (« every tote bag », « every bottle », « every cake ») ; vide quand on ne voit rien dans sa vitrine",
    },
    {
      slot: "devant",
      shot: 1,
      want: "ce qui est posé devant sa devanture et ne bouge pas : ses tables, ses chaises, ses vélos, ses plantes, ses lampes, son ardoise (« every table », « every bicycle », « every plant », « every lamp ») ; vide quand rien n'y est posé",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : en plein écran vertical, sa vidéo de devanture entière dans une bande horizontale, ou comme elle",
      choices: [
        { value: "vertical", says: "en plein écran vertical comme l'original, sa vidéo en largeur recadrée sur son sujet" },
        { value: "horizontal", says: "sa vidéo entière dans une bande 16:9 au milieu du noir, le papier en plein écran", band: true },
        { value: "auto", says: "comme sa vidéo de devanture (en bande horizontale si elle est en largeur)" },
      ],
    },
  ],
  // Its original has neither grain nor dark corners (its fiche, effect 9): taken out of its model's finish.
  finish: { grain: 0, vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    // With an ending card, the inked card held whole beats longer for its 1,6 s (under the paper: its second shot).
    const card = end ? Math.ceil(END_CARD / beat - 1e-6) : 0;
    const spans = beatSpans(bpm, [PAPER, END - PAPER + card]);
    const duration = spans.at(-1)!.end;
    const at = (b: number) => toFrame(b * beat);
    const wants = [
      "sa devanture filmée de face, le téléphone posé, sans zoom : elle se construit morceau par morceau sur le noir, puis joue en entier (de la vie devant : des gens qui passent ou assis, un vélo, un chien ; son nom visible sur l'enseigne ou la vitrine)",
      "la même vidéo de sa devanture que la case 1, un autre moment : jamais vue (le papier est par-dessus), ses fenêtres et son enseigne y sont lues",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her name and her line pressed in the paper from its first image, to the end (or to her ending card).
      texts: {
        titre: { from: spans[1]!.start, to: end ? round(duration - END_CARD) : duration },
        ligne: { from: spans[1]!.start, to: end ? round(duration - END_CARD) : duration },
      },
      marks: {
        ...Object.fromEntries(PIECES.map((b, i) => [`piece_${i}`, at(b)])),
        paper: at(PAPER),
        ink: at(INK),
        first: at(FIRST),
        second: at(SECOND),
        last: at(LAST),
        dots: at(DOTS),
        inked: at(INKED),
        line_from: at(LINE_FROM),
        line_to: at(LINE_TO),
        dry: at(DRY),
      },
      // Its music thin from the start (without its bass: its intro has no drums), stopped dead before the reprise and
      // whole again on it (Tristan, of its originals' pauses: « oui pourquoi pas si c'est bien fait »), cut dead when its
      // groove ends (11,93 s): the inked card on its last images in silence. With an ending card, it plays on (the mix's
      // own fade). No sound of its own: its original has none it can be told apart from its music.
      music: {
        filters: [{ kind: "thin", from: 0, to: round3(REPRISE * beat) }],
        pauses: [{ from: round3(STOP * beat), to: round3(REPRISE * beat) }],
        ...(end ? {} : { end: { at: round3(GROOVE_END * beat) } }),
      },
    };
  },
  code: CODE,
};
