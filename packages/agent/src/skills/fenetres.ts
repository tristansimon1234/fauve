import { type MontageSkill } from "../skills.ts";

// « Fenêtres et étiquettes », version 2, written on its original's fiche (docs/fiches/fenetres.md: a road trip in the
// mountains, 22 shots in 13,8 s, measured image by image at 30 i/s, its windows mapped cell by cell, its sound read by
// bands; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Two small technical
// labels in thin white capitals stay at mid-height from the first image to the last, over everything, while her shots
// change through windows. Its music is a lo-fi hip-hop beat at 92,9 BPM, its first beat at 0,53 s; every moment below is
// its original's image (30 a second) counted in beats at that tempo, so its cuts fall where the original's do (within an
// image) and a slower tempo stretches them all:
//   0 – 101    five shots that flow into each other: the next one, already playing, takes the 3 × 3 cells of the
//              frame one or two at a time every two images, row after row in a snake, from the top right or the bottom
//              left (18 images the first time, then 12), a cell on each kick of the intro; a cream silhouette of what
//              comes before the third, a white one of the fourth's people on its first cells; then, in the hole of the
//              music, windows of the frame's shape open at once on the next shot at its place and jump every two
//              images, one, then two, then two or three a third of the frame, its white silhouette, the cut;
//   101 – 265  strong moments on the beats: a window in the middle behind the person of the shot, onto the next one
//              in negative, then in colour, taking the cell above; white silhouettes before the cuts; a shot washed
//              white on its first images; the shot before cut in twice as flash frames, cream silhouettes; a night shot
//              then the same place by day sliding in from the left to a split screen, a checkerboard in its middle
//              block, its flashes in negative;
//   265 – 414  a shot a beat: small squares lit one by one across two cuts on her other shots, her subject laid on the
//              shot before as a cream silhouette then in colour while its own place is laid round it by big
//              rectangles, a warm light and cream flashes on the cuts; the first shot back through windows, held on its
//              first image: the Reel loops.
// Fewer shots: the moments without a signature go first (their time to the shot before them, or a beat less in its
// last section, so every cut stays on its beat); more, for a length she asks: shots held two beats before the night,
// entering by cells or windows. Played horizontal 16:9 on black when her videos are, as the original (or on her word),
// else full frame, its cells and windows of the frame's shape. Her photos stay still, her videos play. Its labels are
// hers: a landmark of her business on the left, her place's coordinates on the right (written by the engine from her
// address, nothing invented). No sound effect (its original has none); its music stops after the intro's third kick
// and comes back with the drums. Nothing of the original's own is copied.

const BPM = 92.9;
/** Its original's images in a beat at its tempo (30 i/s). */
const IMAGES = (30 * 60) / BPM;
/** Its music's first beat (images): the Reel starts 0,82 beat before it. */
const FIRST_BEAT = 15.9;
/** Its music stops after the intro's third kick and comes back with the drums on beat 4 (images), the kick ringing out. */
const HOLE = { from: 60, to: FIRST_BEAT + 4 * IMAGES, tail: 0.5 };
/** Its end (images): 13,8 s. */
const END = 414;
/** The engine's ending card, on whole beats. */
const CARD_SECONDS = 1.6;
/** Its silhouettes' colours: white, or cream. */
type Sil = { from: number; n: number; cream?: boolean };
type Entry = "cells-tr" | "cells-bl" | "windows" | "center" | "decor";
/**
 * One of its original's shots (its images, docs/fiches/fenetres.md): where it starts (its first cell, or its cut), what
 * brings it in and how long (images: its cells after its start; its windows, its middle window, its decor before it),
 * its silhouette (images from its start, negative before it), its flash (images from its start), the shot before it cut
 * in twice (`back`), its squares (`sweep`), and, with fewer shots, its rank (`drop`, lowest first) and where its time
 * goes (`beat`: a beat less to the Reel, the rest to the shot before; otherwise all of it to the shot before).
 */
type Slot = {
  at: number;
  entry?: Entry;
  len?: number;
  sil?: Sil;
  flash?: { kind: 1 | 2 | 3 | 4 | 5; at: number };
  back?: boolean;
  sweep?: boolean;
  drop?: number;
  beat?: boolean;
  want: string;
};

const SLOTS: Slot[] = [
  { at: 0, want: "le plan qui ouvre le Reel : un plan large et beau de son lieu ou de son quartier, posé ; il revient à la fin, figé sur sa première image, et le Reel tourne en boucle" },
  { at: 4, entry: "cells-tr", len: 18, want: "un plan de son quartier ou de son lieu, en mouvement si possible (une rue, une vitrine, des gens qui passent) : il entre case par case" },
  { at: 24, entry: "cells-bl", len: 12, sil: { from: -2, n: 2, cream: true }, drop: 10, want: "un détail de son lieu, net au milieu (son enseigne, sa porte, un objet) : sa silhouette crème juste avant, puis il entre case par case" },
  { at: 40, entry: "cells-tr", len: 12, sil: { from: 0, n: 2 }, drop: 5, want: "des gens dans son lieu ou devant (un groupe, ses clients, son équipe) : leur silhouette blanche se pose quand il entre case par case" },
  { at: 54, entry: "cells-bl", len: 12, want: "un plan large et calme qui dure un peu (une rue, une place, un paysage, sa salle) : des fenêtres s'y ouvrent sur le plan suivant" },
  { at: 101, entry: "windows", len: 27, sil: { from: -4, n: 4 }, want: "quelqu'un ou quelque chose debout au milieu, presque immobile, de face ou de dos (elle, un client, une bouteille, un vélo) : une fenêtre s'ouvre au centre derrière lui, sur le plan suivant" },
  { at: 120, entry: "center", len: 10, want: "un plan qui bouge au milieu de l'image (de l'eau, une flamme, un geste, des gens qui passent) : il apparaît d'abord dans la fenêtre du milieu, en négatif" },
  { at: 136, sil: { from: -4, n: 4 }, drop: 1, want: "des gens de près, de face (elle et son équipe, des clients qui rient) : leur silhouette blanche juste avant la coupe" },
  { at: 146, flash: { kind: 1, at: 0 }, drop: 6, want: "un plan pris à travers une vitre ou face à la lumière : il arrive délavé de blanc" },
  { at: 156, drop: 8, want: "un plan en mouvement (en marchant, en voiture, à vélo, en suivant quelqu'un)" },
  { at: 180, back: true, sil: { from: 4, n: 2, cream: true }, drop: 11, want: "un plan vu d'en haut ou de loin (sa rue depuis une fenêtre, sa salle vue d'en haut, des toits) : le plan d'avant y revient deux fois en éclair" },
  { at: 194, sil: { from: -2, n: 2, cream: true }, drop: 2, want: "quelqu'un qui bouge, en entier (qui danse, qui marche, qui saute, un geste de son métier)" },
  { at: 203, want: "son lieu, sa vitrine ou sa rue le soir ou la nuit (ou vide) : le même endroit à un autre moment glisse à côté, en écran partagé, puis en damier" },
  { at: 265, sil: { from: -2, n: 2 }, drop: 4, beat: true, want: "un détail tout près de la caméra (un reflet, une tasse au premier plan, ses mains, un rétroviseur) : sa silhouette blanche juste avant" },
  { at: 286, sweep: true, want: "un plan large de son quartier ou de sa rue : de petits carrés s'y allument un par un, chacun sur un autre de ses plans" },
  { at: 305, flash: { kind: 2, at: -1 }, drop: 7, beat: true, want: "des gens de dos ou de profil devant son lieu ou un paysage" },
  { at: 325, want: "un plan où quelque chose passe ou roule (une voiture, un vélo, des passants, un service)" },
  { at: 340, entry: "decor", len: 11, sil: { from: -11, n: 2, cream: true }, want: "elle (ou quelqu'un) debout, de face ou de dos, presque immobile, devant son lieu : elle apparaît d'abord détourée sur le plan d'avant, puis son décor se pose autour d'elle" },
  { at: 347, flash: { kind: 3, at: 0 }, drop: 9, beat: true, want: "un plan large et lumineux de son lieu ou de son quartier : il arrive dans une lumière chaude" },
  { at: 365, flash: { kind: 4, at: 0 }, drop: 3, beat: true, want: "un plan du soir ou de la nuit (des lumières, une vitrine éclairée, un ciel) : il arrive délavé de crème" },
  { at: 384, flash: { kind: 5, at: 0 }, want: "un dernier plan, son entrée ou sa porte : le premier plan y revient par fenêtres et le Reel reboucle" },
];
/** The night shot (its index in SLOTS) and its shot by day laid beside it, from this many images into it. */
const NIGHT = 12;
const DAY_AT = 13;
const DAY_WANT = "le même endroit que le plan d'à côté à un autre moment (le jour, plein, le matin) : il glisse depuis la gauche jusqu'au milieu, en écran partagé, puis en damier";
/** More shots for a length she asks: held two beats each, before the night, entering by cells or windows in turn. */
const MORE_BEATS = 2;
const MORE: Entry[] = ["cells-tr", "cells-bl", "windows"];
const MORE_WANT = "un plan de plus de son lieu, de sa rue ou de son quartier, tenu deux temps (chacun différent du précédent)";
/** The longest shot a silhouette goes to when its own shot goes (images): its whole passage is cut out for it. */
const SIL_MOST = 25;
/** Its squares sweep this long (images: 286 to 324), and end before the decor of the shot after the next. */
const SWEEP = 38;
const ENTRIES: Record<Entry, number> = { "cells-tr": 1, "cells-bl": 2, windows: 3, center: 4, decor: 5 };
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its main line for n shots (the shot by day beside the night counted): its slots, each one's start and length in images. */
export function fenetresLine(n: number): { slots: (Slot & { start: number; images: number })[]; end: number } {
  const count = Math.max(11, n) - 1;
  let list = SLOTS.map((s, i) => ({ ...s, images: (SLOTS[i + 1]?.at ?? END) - s.at }));
  // Fewer: the lowest ranks go first, their time to the shot before them (or a beat less to the Reel in its last
  // section); their silhouette or their flash to the next shot that has none.
  const drops = list.filter((s) => s.drop).sort((a, b) => a.drop! - b.drop!).slice(0, Math.max(0, list.length - count));
  for (const d of drops) {
    const k = list.indexOf(d);
    const before = list[k - 1]!;
    before.images += d.beat ? d.images - IMAGES : d.images;
    // (A silhouette only to a short shot: its whole passage is cut out for its two to four images.)
    const next = list[k + 1];
    if (next && d.sil && !next.sil && next.images <= SIL_MOST && (d.sil.from < 0 || next.entry?.startsWith("cells"))) next.sil = d.sil;
    if (next && d.flash && !next.flash && !next.entry) next.flash = d.flash;
    list = list.filter((s) => s !== d);
  }
  // More: shots held two beats before the night.
  const more = Array.from({ length: Math.max(0, count - list.length) }, (_, i) => ({ at: 0, entry: MORE[i % MORE.length]!, len: MORE[i % MORE.length] === "windows" ? 27 : 12, images: MORE_BEATS * IMAGES, want: MORE_WANT }) as Slot & { images: number });
  const night = list.findIndex((s) => s.at === SLOTS[NIGHT]!.at);
  list.splice(night, 0, ...more);
  let at = 0;
  const slots = list.map((s) => {
    const start = at;
    at += s.images;
    return { ...s, start };
  });
  return { slots, end: at };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement, frame = useCurrentFrame(), R = Math.round, mn = Math.min, mx = Math.max;
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length, DAY = mark("day", -1), K = mark("beat", 19.376) / 19.376, o = (x) => mx(1, R(x * K));
  const endAt = end ? end.from : durationInFrames + 1;
  // Its frame: 16:9 on black when her videos mostly are (or on her word), else the whole vertical frame.
  const format = setting("format", "auto");
  const main = shots.map((s, i) => i).filter((i) => i !== DAY);
  const wide = format === "horizontal" || (format === "auto" && main.filter((i) => (Number(shots[i].aspect) || 0.5625) > 1.15).length * 2 > main.length);
  const bw = width, bh = wide ? R((width * 9) / 16) : height, by = wide ? R((height - bh) / 2) : 0;
  const box = { position: "absolute", left: 0, top: 0, width: bw, height: bh };
  const start = (i) => shots[i].from;
  let ci = 0;
  main.forEach((i, k) => { if (start(i) <= frame) ci = k; });
  const cur = main[ci], prev = ci > 0 ? main[ci - 1] : -1, nxt = ci + 1 < main.length ? main[ci + 1] : -1, last = main[main.length - 1];
  const rects = (list) => "path('" + list.map(([x, y, w, hh]) => "M" + R(x) + " " + R(y) + "h" + R(w) + "v" + R(hh) + "h" + -R(w) + "Z").join(" ") + "')";
  // One of her shots in the frame: at its moment, or played from "at"; cut to rectangles; a filter.
  const shot = (i, x) => (i >= 0 && i < n ? h(Footage, { key: (x && x.key) || "s" + i, shot: i, ...(x && x.at !== undefined ? { at: x.at } : {}), style: { ...box, ...(x && x.cut ? { clipPath: rects(x.cut) } : {}), ...(x && x.filter ? { filter: x.filter } : {}) } }) : null);
  const cell = (c, cols, rows) => [(c % cols) * (bw / cols), Math.floor(c / cols) * (bh / rows), bw / cols, bh / rows];
  const layers = [];

  // 1. Her shot of the moment. When it comes in by cells, the one before stays in the cells not yet taken (its last
  // image), and the new one, already playing, takes one or two of the 3 × 3 cells every two images, row after row in a
  // snake, from the top right or the bottom left.
  const ORDER = { 1: [2, 1, 0, 3, 4, 5, 8, 7, 6], 2: [6, 7, 8, 5, 4, 3, 0, 1, 2] };
  const kind = mark("e" + cur, 0), T = mark("t" + cur, 0), el = frame - start(cur);
  if ((kind === 1 || kind === 2) && el <= T && prev >= 0) {
    const steps = Math.floor(T / o(2)) + 1, k = mn(steps - 1, Math.floor(el / o(2)));
    layers.push(shot(prev), shot(cur, { cut: ORDER[kind].slice(0, Math.ceil(((k + 1) * 9) / steps)).map((c) => cell(c, 3, 3)) }));
  } else layers.push(shot(cur));
  // The shot before cut in twice, as flash frames (its last images).
  if (mark("b" + cur, 0) && prev >= 0 && ((el >= o(2) && el < o(6)) || el === o(13))) layers.push(shot(prev, { key: "back", at: start(cur) + o(6) - shots[prev].durationInFrames }));

  // 2. Before the next shot: windows of the frame's shape open at once on it at its place, jumping every two images, one
  // of 21 % of the frame, two of 21 and 28 %, then two or three of a third; or the middle cell onto it, in negative then
  // in colour, taking the cell above, her subject of the moment standing in front; or her next subject cut out on this
  // shot while its own place is laid round it by big rectangles, the last at the cut.
  const jump = (seed, size, t) => {
    const w = size * bw, hh = size * bh, r = (k) => random(seed + "-" + k + "-" + Math.floor(t / o(2)));
    return [r("x") * (bw - w), r("y") * (bh - hh), w, hh];
  };
  if (nxt >= 0) {
    const e = mark("e" + nxt, 0), t = mark("t" + nxt, 0), at = start(nxt) - t, rel = frame - at;
    if (e === 3 && rel >= 0) {
      const sizes = rel < o(10) ? [0.21] : rel < o(16) ? [0.21, 0.28] : random("n" + nxt + Math.floor(rel / o(4))) < 0.5 ? [0.33, 0.33] : [0.33, 0.33, 0.33];
      layers.push(shot(nxt, { key: "win", at, cut: sizes.map((s, k) => jump("w" + nxt + k, s, rel)) }));
    }
    if (e === 4 && rel >= 0) {
      const neg = rel < o(5) || (rel >= o(6) && rel < o(8));
      layers.push(shot(nxt, { key: "mid", at, cut: [cell(4, 3, 3), ...(rel >= o(5) ? [cell(1, 3, 3)] : [])], filter: neg ? "invert(1)" : undefined }), h(Subject, { key: "front", shot: cur, style: box }));
    }
    if (e === 5 && rel >= o(2)) {
      const BIG = [[1, 2], [2, 2], [0, 4], [3, 6], [4, 7]].filter(([, a]) => rel >= o(a)).map(([c]) => cell(c, 3, 2));
      layers.push(shot(nxt, { key: "decor", at, cut: BIG }), h(Subject, { key: "her", shot: nxt, at, style: box }));
    }
  }

  // 3. The night and the same place by day beside it: the day slides in from the left to the middle (21, 30, 37, 43, 47,
  // 50 %), held; then the middle block of a 4 × 4 grid swaps its halves (a checkerboard), held; then flashes, an image
  // each: the day in negative, the night, the negative, the night, the day.
  if (DAY >= 0 && cur === DAY - 1 && frame >= start(DAY)) {
    const r = frame - start(DAY), q = bw / 4, v = bh / 4;
    const edge = [0.21, 0.3, 0.37, 0.43, 0.47][Math.floor(r / K + 0.01)] || 0.5;
    const left = [[0, 0, q, bh], [q, 0, q, v], [q, 3 * v, q, v]];
    const day = r < o(19) ? [[0, 0, edge * bw, bh]] : r < o(24) ? left : r < o(40) || r >= o(44) ? [...left, [2 * q, v, q, 2 * v], ...(r >= o(44) ? [[q, v, q, 2 * v]] : [])] : left;
    layers.push(shot(DAY, { key: "day", cut: day }));
    if (r >= o(40) && r < o(44) && (r - o(40)) % 2 === 0) layers.push(shot(DAY, { key: "neg", cut: [[q, v, 2 * q, 2 * v]], filter: "invert(1)" }));
  }

  // 4. Small squares lit one by one in reading order, an image to five each, across the cut: each a window on another
  // of her shots at its place (5 × 3 in width, 3 × 5 upright), the three after the next in turn (one of the original's
  // is the truck two shots on), each on its first image: three images to read for all fourteen, not a seek each.
  const SQ = mark("sq", -1), SQE = mark("sqe", -1);
  if (SQ >= 0 && frame >= SQ && frame < SQE) {
    const AT = [0, 1, 3, 7, 10, 13, 15, 19, 21, 22, 26, 29, 31, 33], CELL = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    let k = 0, base = 0;
    AT.forEach((a, j) => { if (frame - SQ >= o(a)) k = j; });
    main.forEach((i, j) => { if (start(i) <= SQ) base = j; });
    layers.push(shot(main[(base + 2 + (k % 3)) % main.length], { key: "sq", at: durationInFrames + 30, cut: [wide ? cell(CELL[k], 5, 3) : cell(CELL[k], 3, 5)] }));
  }

  // 5. The loop: the first shot back on the last one, held on its first image, through two or three windows of 28 % that
  // jump; then alone, its first image, as the Reel starts.
  if (cur === last && main.length > 1) {
    const rel = frame - start(last), still = durationInFrames + 30;
    if (rel >= o(24)) layers.push(shot(main[0], { key: "loop", at: still }));
    else layers.push(shot(main[0], { key: "loop", at: still, cut: (random("l" + Math.floor(rel / o(4))) < 0.5 ? [0, 1] : [0, 1, 2]).map((k) => jump("l" + k, 0.28, rel)) }));
  }

  // 6. White or cream silhouettes of what comes, its subject cut out and filled at its place, two to four images.
  for (let i = 0; i < n; i++) {
    const w = mark("w" + i, -1);
    if (w >= 0 && frame >= w && frame < w + mark("wn" + i, 2)) layers.push(h(Subject, { key: "sil" + i, shot: i, at: mn(w, start(i)), fill: mark("wc" + i, 0) ? "#fbf2db" : "#fcf9fd", style: box }));
  }
  // 7. Light on the cuts: a shot washed white on its first images, a light one on a cut, a warm burn, cream (twice, once).
  const f = mark("f" + cur, 0), nf = nxt >= 0 ? mark("f" + nxt, 0) : 0, fa = frame - mark("fa" + cur, start(cur)), na = nxt >= 0 ? frame - mark("fa" + nxt, start(nxt)) : -9;
  const wash = (c, a, blend) => h("div", { key: "wash", style: { ...box, background: c, opacity: a, mixBlendMode: blend || "normal" } });
  const lit = (kind, k) => kind === 1 ? [0.75, 0.5, 0.25][k] : kind === 2 ? [0.3, 0.18][k] : kind === 4 ? [0.7, 0.3][k] : kind === 5 ? [0.7][k] : kind === 3 && k < 2 ? 1 : 0;
  const flash = (kind, k) => {
    const a = lit(kind, k);
    if (!a) return null;
    if (kind === 3) return wash(k ? "linear-gradient(160deg, #ffe066, #ff8fa3)" : "linear-gradient(160deg, #ff7a3d, #e8402a)", k ? 0.75 : 0.9, "screen");
    return wash(kind >= 4 ? (k ? "#cfc7b4" : "#faf2dc") : "#ffffff", a);
  };
  layers.push(fa >= 0 ? flash(f, fa) : null, nf === 2 && na >= 0 ? flash(nf, na) : null);

  // 8. Its two labels, fixed from the first image to the last over everything, at mid-height of its frame (just above
  // its middle, clear of the apps' buttons): thin white condensed capitals as tall as the original's (4,4 % of its 16:9
  // frame), no shadow, at its distance from the edges; decor (Tristan's exception for its tiny type), in their boxes.
  const hook = reelTexts.find((t) => t.role === "hook"), cap = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== cap);
  const display = "'" + brand.displayFont + "', 'Oswald', 'Arial Narrow', sans-serif";
  const LBL = { fontFamily: display, fontWeight: 300, fontSize: 40, lineHeight: 1.1, letterSpacing: "0.02em", textTransform: "uppercase", color: "#f1f2f4", whiteSpace: "nowrap" };
  const ly = by + R(bh / 2) - 76;
  const label = (t, left, w, align) => (t && frame >= t.from && frame < t.to ? h(FitText, { key: "l" + left, style: { position: "absolute", left, top: ly, width: w, height: 52 }, innerStyle: { ...LBL, alignItems: align } }, h("span", { "data-fauve-decor": "" }, String(t.text))) : null);

  // Any other text of the Reel: a plain line at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < mn(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: 800, top: 170 + i * 130, height: 120 }, innerStyle: { ...LBL, fontWeight: 400, fontSize: 56, color: "#ffffff", textAlign: "center", whiteSpace: "normal" } }, t.text));

  // 9. Its ending card: the first shot held and darkened, its title in the labels' capitals above them, its line under them.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, { style: { backgroundColor: "rgba(0,0,0," + (0.5 * interpolate(frame, [endAt, endAt + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })).toFixed(3) + ")" } },
        h(FitText, { style: { position: "absolute", left: 140, top: 470, width: 800, height: 340 }, innerStyle: { ...LBL, justifyContent: "flex-end", fontWeight: 500, fontSize: 118, lineHeight: 1.0, color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance" } },
          h("span", { style: { opacity: frame >= endAt + 3 ? 1 : 0 } }, String(end.title || ""))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1000, width: 800, height: 190 }, innerStyle: { ...LBL, justifyContent: "flex-start", fontSize: 50, lineHeight: 1.2, color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance" } },
              h("span", { style: { opacity: frame >= endAt + 7 ? 1 : 0 } }, String(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } },
    h("div", { key: "frame", style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden" } }, layers),
    ending, label(hook, R(bw * 0.103), 420, "flex-start"), label(cap, R(bw * 0.899) - 460, 460, "flex-end"), extra);
}`;

export const fenetres: MontageSkill = {
  key: "fenetres",
  version: 2,
  bpm: BPM,
  // Its original's 22 (21 one after the other, the shot by day beside the night); 11 at least (its signature moments).
  shots: [11, 22],
  // Up to 34 for a length she asks for: about 29 s at its own tempo (more of her place, two beats a shot).
  long: 34,
  files: [5, 14],
  how: "Deux petites étiquettes techniques en capitales blanches fines restent fixes à mi-hauteur, une à gauche (un repère de son commerce), une à droite (les coordonnées de son lieu), pendant que ses plans changent par fenêtres : le plan suivant prend les cases d'une grille 3 × 3 une ou deux à la fois en serpentin ; des fenêtres sautent sur le plan qui vient ; une fenêtre s'ouvre au milieu derrière quelqu'un, en négatif ; des silhouettes blanches ou crème de ce qui arrive ; un écran partagé jour et nuit puis un damier ; de petits carrés qui s'allument sur ses autres plans ; son sujet posé sur le plan d'avant avant son décor ; des éclats sur les coupes ; le premier plan revient par fenêtres et le Reel tourne en boucle.",
  end: true,
  texts: [
    {
      slot: "gauche",
      role: "hook",
      want: "l'étiquette de gauche, au ton d'un relevé technique, en capitales : un repère vrai de son commerce qu'on sait (son année ou son heure d'ouverture, une mesure de son métier, son adresse), sinon son quartier ou sa ville (une forme comme « DEPUIS 1998 », « OUVERT DÈS 8 H », « 250 °C », « 12 RUE DES MARTYRS », « PARIS 11E »)",
      max: 22,
      required: true,
    },
    {
      slot: "droite",
      role: "caption",
      want: "l'étiquette de droite : les coordonnées de son lieu, écrites par le moteur quand son adresse est connue ; sinon son quartier ou sa ville en capitales, ou ce qu'elle fait en un ou deux mots (une forme comme « PARIS 9E », « VIEUX LYON », « TORRÉFACTEUR »)",
      max: 24,
      required: true,
      fact: "coordinates",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal 16:9 sur du noir comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, comme l'original (ses vidéos verticales y perdent beaucoup)" },
        { value: "vertical", says: "vertical plein écran, ses cases et ses fenêtres à la forme de l'écran" },
      ],
    },
  ],
  // Its look is its model's teal and orange; the black around its horizontal frame carries no grain, no corners.
  finish: { grain: 0, vignette: 0 },
  timeline(n, options) {
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const s = (images: number) => (images / IMAGES) * beat;
    const f = (images: number) => Math.round(s(images) * 30);
    const line = fenetresLine(n);
    // Its last shot holds whole beats more with an ending card (the engine's 1,6 s at least).
    const card = options.end ? Math.ceil(CARD_SECONDS / beat - 1e-6) * IMAGES : 0;
    const total = line.end + card;
    const duration = round(s(total));
    // Its shots, one after the other on their images (each edge on the nearest frame), the shot by day laid beside the night.
    const edge = (images: number) => round(Math.round(s(images) * 30) / 30);
    const spans = line.slots.map((x, i) => ({ start: edge(x.start), end: i === line.slots.length - 1 ? duration : edge(x.start + x.images), slot: x }));
    const night = spans.findIndex((x) => x.slot.at === SLOTS[NIGHT]!.at && !x.slot.entry);
    const shots = spans.flatMap((x, i) => {
      const one = { start: x.start, end: x.end, want: x.slot.want };
      return i === night ? [one, { start: edge(x.slot.start + DAY_AT), end: x.end, want: DAY_WANT, beside: true }] : [one];
    });
    // Each main shot's index in its shots (the shot by day after the night), and what its code reads: its entry, its
    // silhouette, its flash, its flash frames; the shot by day; its squares.
    const index = (i: number) => (i > night ? i + 1 : i);
    const marks: Record<string, number> = { beat: round3(beat * 30), day: night + 1 };
    const cutouts = new Set<number>();
    line.slots.forEach((x, i) => {
      const k = index(i);
      const at = x.start;
      if (x.entry) Object.assign(marks, { [`e${k}`]: ENTRIES[x.entry], [`t${k}`]: f(x.len ?? 12) });
      if (x.sil) {
        Object.assign(marks, { [`w${k}`]: f(at + x.sil.from), [`wn${k}`]: Math.max(1, f(x.sil.n)), ...(x.sil.cream ? { [`wc${k}`]: 1 } : {}) });
        cutouts.add(k);
      }
      if (x.flash) Object.assign(marks, { [`f${k}`]: x.flash.kind, [`fa${k}`]: f(at + x.flash.at) });
      if (x.back) marks[`b${k}`] = 1;
      // The shot whose subject stands in front of the middle window; the one laid on the shot before its decor.
      if (x.entry === "center" && i > 0) cutouts.add(index(i - 1));
      if (x.entry === "decor") cutouts.add(k);
      if (x.sweep) {
        // Across the next cut, never into the decor of the shot after it.
        const after = line.slots[i + 2];
        marks.sq = f(at);
        marks.sqe = f(Math.min(at + SWEEP, after ? after.start - (after.entry === "decor" ? (after.len ?? 11) + 1 : 0) : at + SWEEP));
      }
    });
    return {
      duration,
      shots,
      // Both labels the whole Reel, its ending card too (between its title and its line).
      texts: { gauche: { from: 0, to: duration }, droite: { from: 0, to: duration } },
      marks,
      cutouts: [...cutouts].sort((a, b) => a - b),
      // Its music on its first beat; stopped after the intro's third kick, its kick ringing out, back with the drums.
      music: { downbeat: round3(s(FIRST_BEAT)), pauses: [{ from: round3(s(HOLE.from)), to: round3(s(HOLE.to)), tail: HOLE.tail }] },
    };
  },
  code: CODE,
};
