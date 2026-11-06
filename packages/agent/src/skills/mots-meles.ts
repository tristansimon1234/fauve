import { END_CARD_SECONDS, beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Mots mêlés », version 2, written again on its original's fiche (docs/fiches/mots-meles.md: measured image by image
// at 30 i/s, each pixel of its strokes dated, the grid's letters, strokes and colours measured to the pixel, every word
// of its grid found; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). The
// original has no sound: its pace is a hand's. One calm shot, the phone posed, the picture kept dark and soft under a
// grid of thin white capitals spread over the whole frame, edge to edge (16 × 10 on its 16:9 frame, the first letter
// 0,73 of a step from the edge, a fifth of a step tall), its words hidden in the order of its sentence, top to bottom
// (« SATURDAY », « AFTER » over « NOON » ringed by one stroke in steps, « CALL », « FOR », « GREEK » up a diagonal,
// « YOGURT »), among words of the same world never ringed (« BLACKBERRY », « CINNAMON », « HONEY », « DILL », a second
// « FOR » as a trap) and letters drawn from the whole alphabet alike. From its image 4, a thin white stroke drawn by
// hand rings the first word, from just above its first letter, counterclockwise, at a hand's pace (no easing, slower in
// its ends: 42 images for FOR, 78 for SATURDAY), and the next one starts 3 to 6 images after it closes; the letters
// never change; the whole sentence held 5,37 s at the end. Nothing lights up, nothing cuts, nothing moves but her.
// Its music is Edith's (calm, no marked drums, 70 to 90 BPM, here 80): its length is 25 of its beats (18,75 s), the
// loops following the hand, never a beat; the sentence held 4 beats at least however long her words, her ending card
// in option after the hold. Played horizontal 16:9 on black as the original when her video is (or she asks), its grid
// over the video only, its letters at the original's size: there her words are decor too, read by their loops as in
// the original (to decide with Tristan: the minimum of 48 px is kept for what is read); else full frame, the grid's
// density turned a quarter (9 × 16), her words at 48 px inside the safe zone, the other letters everywhere (decor).
// Her photo stays still, her video plays; no zoom, no push.

const BPM = 80;
/** Its length (beats): 18,75 s at its own tempo, the original's 18,67 s. */
const LENGTH = 25;
/** Its sentence held this long at least at the end (beats, 3 s at its tempo): a long sentence's loops go faster rather than eat it. */
const HOLD = 4;
/** Its first loop starts on this image (the original's 0,13 s: the grid alone before it). */
const FIRST_FRAME = 4;
/** The engine's ending card: the Reel's last 2,5 s. */
const END_CARD = END_CARD_SECONDS;
const round = (n: number) => Math.round(n * 100) / 100;
const comma = (n: number) => String(round(n)).replace(".", ",");

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const until = Math.min(endAt, durationInFrames);
  const FIRST = Math.max(0, Math.round(mark("first", 4)));
  const HOLD = Math.max(30, Math.round(mark("hold", 90)));
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const display = "'" + brand.displayFont + "', '" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  // A phone number or a date never breaks between its digits, nor a line before a « · ».
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ").replace(/ ([·•|–—]) /g, " $1 ");

  // Its frame: horizontal 16:9 on black as the original when her video is (or she asks), else the whole vertical frame.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && n > 0 && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: by, width: bw, height: bh };

  // 1. The grid: the original's 16 columns × 10 rows on its 16:9 frame, its density turned a quarter on the vertical
  // one (9 × 16), the first letter 0,73 of a step from each edge; capitals of a regular grotesque, white, no shadow, at
  // the original's size on the 16:9 frame (2 % of its height), at 48 px on the vertical one, where her words are read.
  const COLS = wide ? 16 : 9;
  const ROWS = wide ? 10 : 16;
  const M = 0.73;
  const px = bw / (COLS - 1 + 2 * M);
  const py = bh / (ROWS - 1 + 2 * M);
  const cx = (c) => (M + c) * px;
  const cy = (r) => by + (M + r) * py;
  // A little bigger than the original's on the 16:9 frame (Tristan, on its first bench: « un peu plus grosse »): 4 % of
  // its height, 24 px; 48 px on the vertical one.
  const SIZE = wide ? Math.max(20, Math.round(bh * 0.04)) : 48;
  // Where her words may lie: on the 16:9 frame anywhere but under the apps' buttons (its two last columns on its five
  // bottom rows); on the vertical one, each letter whole inside the safe zone, left of the buttons below the middle.
  const readable = (c, r) => {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    if (wide) return !(c >= COLS - 2 && r >= ROWS - 5);
    const x = cx(c);
    const y = cy(r);
    const hw = SIZE * 0.46;
    const hh = SIZE * 0.55;
    return y - hh >= 80 && y + hh <= height * 0.75 && x - hw >= 28 && x + hw <= (y + hh > height / 2 ? width - 128 : width - 28);
  };
  const phrase = reelTexts.find((t) => t.role === "band");
  const decoys = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== phrase && t !== decoys);

  // Laid out once from her words, as a text set in rows: each word on a row below the one before, the rows spread
  // from the top of the readable ones to their bottom; one word over two rows, left-aligned, when too long for a row,
  // else the first with a hyphen (« APRÈS » over « MIDI ») or of 9 letters and more (« AFTER » over « NOON »); one up a
  // diagonal from its first letter (the original's fifth of six); her other words hidden among the letters, never
  // ringed, along a row, down a column or up a diagonal, and her shortest word once more, as a trap; the other letters
  // drawn from the whole alphabet alike. What is not a letter (an apostrophe, a comma) stays unseen in its place, so her
  // sentence stays whole in the page.
  const laidOut = React.useMemo(() => {
    const isLetter = (ch) => /[\p{L}\p{N}]/u.test(ch);
    const units = (w) => Array.from(String(w).normalize("NFC")).map((ch) => ({ c: isLetter(ch) ? ch.toUpperCase() : ch, cell: isLetter(ch) }));
    const split = (s) => String(s || "").split(/[ \t\n  ]+/).filter(Boolean).map(units);
    const count = (w) => w.filter((u) => u.cell).length;
    const words = split(phrase ? phrase.text : "");
    // A word of one letter (« à ») joins the next one, so each loop goes round a word; ten loops at most.
    for (let i = 0; i < words.length && words.length > 1; i++) {
      if (count(words[i]) >= 2) continue;
      if (i < words.length - 1) words.splice(i, 2, words[i].concat(words[i + 1]));
      else words.splice(i - 1, 2, words[i - 1].concat(words[i]));
      i = -1;
    }
    while (words.length > 10) {
      let best = 0;
      for (let i = 1; i < words.length - 1; i++) if (count(words[i]) + count(words[i + 1]) < count(words[best]) + count(words[best + 1])) best = i;
      words.splice(best, 2, words[best].concat(words[best + 1]));
    }
    const grid = {};
    const at = (c, r) => grid[c + "," + r];
    const fits = (cells, chars) => cells.every((p, i) => p[0] >= 0 && p[0] < COLS && p[1] >= 0 && p[1] < ROWS && (at(p[0], p[1]) === undefined || at(p[0], p[1]) === chars[i]));
    const run = (c0, r0, dc, dr, L) => Array.from({ length: L }, (_, i) => [c0 + dc * i, r0 + dr * i]);
    const shuffled = (list, seed) => list.map((v, i) => ({ v, k: random(seed + "-" + i) })).sort((a, b) => a.k - b.k).map((x) => x.v);
    const k = words.length;
    const chars = words.map((w) => w.filter((u) => u.cell).map((u) => u.c));
    const readRows = [];
    for (let r = 0; r < ROWS; r++) if (Array.from({ length: COLS }, (_, c) => c).some((c) => readable(c, r))) readRows.push(r);
    const R = readRows.length;
    const room = readRows.map((r) => Array.from({ length: COLS }, (_, c) => c).filter((c) => readable(c, r)).length);
    const most = Math.max(0, ...room);
    // The letters of each word on its first row (all of them: one row).
    const cut = chars.map((cs, i) => (cs.length > most ? Math.ceil(cs.length / 2) : 0));
    if (!cut.some(Boolean)) {
      const hyphen = words.findIndex((w) => { const j = w.findIndex((u) => !u.cell && /[-‐–]/.test(u.c)); const before = w.slice(0, j).filter((u) => u.cell).length; return j > 0 && before >= 2 && count(w) - before >= 2 && count(w) >= 6; });
      const long = chars.findIndex((cs) => cs.length >= 9);
      if (hyphen >= 0) { const w = words[hyphen]; cut[hyphen] = w.slice(0, w.findIndex((u) => !u.cell && /[-‐–]/.test(u.c))).filter((u) => u.cell).length; }
      else if (long >= 0) cut[long] = Math.ceil(chars[long].length / 2);
    }
    const span = (i) => (cut[i] ? 2 : 1);
    const holds = (i, q) => (span(i) === 1 ? chars[i].length <= room[q] : q + 1 < R && readRows[q + 1] === readRows[q] + 1 && cut[i] <= room[q] && chars[i].length - cut[i] <= room[q + 1]);
    const goal = (i) => (k > 1 ? (i * (R - 1)) / (k - 1) : (R - 1) / 2);
    // The rows, in the order of her sentence, as close as can be to an even spread (a small dynamic programme).
    const cost = words.map(() => readRows.map(() => Infinity));
    const back = words.map(() => readRows.map(() => -1));
    for (let i = 0; i < k; i++)
      for (let q = 0; q < R; q++) {
        if (!holds(i, q)) continue;
        const own = Math.abs(q - goal(i));
        if (i === 0) cost[i][q] = own;
        else for (let p = 0; p + span(i - 1) <= q; p++) if (cost[i - 1][p] + own < cost[i][q]) { cost[i][q] = cost[i - 1][p] + own; back[i][q] = p; }
      }
    const rowOf = words.map(() => -1);
    if (k && R) {
      let q = cost[k - 1].reduce((b, v, j) => (v < cost[k - 1][b] ? j : b), 0);
      if (cost[k - 1][q] < Infinity) for (let i = k - 1; i >= 0; i--) { rowOf[i] = q; q = back[i][q]; }
    }
    // One word up a diagonal from its first letter, rising to the right (the original's fifth of six): laid last, the
    // nearest to that place first, where its letters are free; the others along their row.
    const prefer = k >= 4 ? k - 2 : 1;
    const slants = Array.from({ length: k }, (_, i) => i)
      .filter((i) => k >= 3 && chars[i].length >= 3 && chars[i].length <= 6 && rowOf[i] >= 0 && span(i) === 1 && rowOf[i] - (chars[i].length - 1) >= 0)
      .sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer));
    const cellsOf = words.map(() => null);
    const kinds = words.map(() => "row");
    const order = Array.from({ length: k }, (_, i) => i).filter((i) => slants.indexOf(i) < 0).concat(slants);
    let slanted = false;
    order.forEach((i) => {
      const L = chars[i].length;
      if (!L) return;
      const cols = shuffled(Array.from({ length: COLS }, (_, c) => c), "mm-c-" + i + "-" + chars[i].join(""));
      const ok = (cells) => cells.every((p) => readable(p[0], p[1])) && fits(cells, chars[i]);
      const q = rowOf[i];
      let cells = null;
      if (q >= 0) {
        const r = readRows[q];
        if (!slanted && slants.indexOf(i) >= 0) for (const c of cols) { const t = run(c, r, 1, -1, L); if (ok(t)) { cells = t; slanted = true; kinds[i] = "slant"; break; } }
        if (!cells && span(i) === 1) for (const c of cols) { const t = run(c, r, 1, 0, L); if (ok(t)) { cells = t; break; } }
        if (!cells && span(i) === 2) for (const c of cols) { const t = run(c, r, 1, 0, cut[i]).concat(run(c, r + 1, 1, 0, L - cut[i])); if (ok(t)) { cells = t; kinds[i] = "rows"; break; } }
      }
      // No row kept for it (her sentence too long for the grid): along any readable row it fits, else anywhere.
      for (let j = 0; j < R && !cells; j++) for (const c of cols) { const t = run(c, readRows[j], 1, 0, L); if (ok(t)) { cells = t; break; } }
      for (let r = 0; r < ROWS && !cells; r++) for (let c = 0; c < COLS && !cells; c++) { const t = run(c, r, 1, 0, Math.min(L, COLS)); if (fits(t, chars[i])) cells = t; }
      cellsOf[i] = cells;
      (cells || []).forEach((p, j) => { grid[p[0] + "," + p[1]] = chars[i][j]; });
    });
    const placed = words.map((w, i) => ({ units: w, cells: cellsOf[i] || [], kind: cellsOf[i] ? kinds[i] : "row", cut: cut[i] }));
    // Her other words, hidden without a loop wherever they fit: along a row, down a column, up a diagonal.
    const hide = (ws, seed) => ws.map((w, i) => {
      const cs = w.filter((u) => u.cell).map((u) => u.c);
      const L = cs.length;
      let cells = null;
      if (L) {
        const spots = shuffled(Array.from({ length: COLS * ROWS * 3 }, (_, s) => s), seed + i);
        for (const s of spots) {
          const way = Math.floor(s / (COLS * ROWS));
          const c = (s % (COLS * ROWS)) % COLS;
          const r = Math.floor((s % (COLS * ROWS)) / COLS);
          const t = way === 0 ? run(c, r, 1, 0, L) : way === 1 ? run(c, r, 0, 1, L) : run(c, r, 1, -1, L);
          if (fits(t, cs)) { cells = t; break; }
        }
      }
      (cells || []).forEach((p, j) => { grid[p[0] + "," + p[1]] = cs[j]; });
      return { units: w, cells: cells || [] };
    });
    const hidden = hide(split(decoys ? decoys.text : ""), "mm-d-");
    // Her shortest word once more, hidden as a trap (the original's second « FOR »): letters of the grid only.
    const short = chars.map((cs, i) => [cs.length, i]).filter((x) => x[0] >= 3 && x[0] <= 5).sort((a, b) => a[0] - b[0])[0];
    if (short) hide([words[short[1]].filter((u) => u.cell)], "mm-t-");
    const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const filler = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (placed.some((w) => w.cells.some((p) => p[0] === c && p[1] === r)) || hidden.some((w) => w.cells.some((p) => p[0] === c && p[1] === r))) continue;
      filler.push({ c, r, ch: at(c, r) !== undefined ? at(c, r) : ABC[Math.floor(random("mm-f-" + c + "-" + r) * 26)] });
    }
    return { placed, hidden, filler };
  }, [phrase ? phrase.text : "", decoys ? decoys.text : "", wide]);

  // 2. Her words ringed one after the other in the order of her sentence, each by one stroke drawn by hand: from just
  // above its first letter, counterclockwise, closed on its start, a capsule round its letters (0,9 of a row tall, its
  // ends 0,4 of a column past its first and last letters; up a diagonal along it, a little off its axis), the rounded
  // outline of its cells in steps round a word over two rows; white, a stroke 3,8 % of a row thick, no shadow, still
  // once drawn. At the original's hand: no easing, slower in its ends, a word taking 18,6 images plus 3,2 a row of
  // stroke (42 for FOR, 78 for SATURDAY), the next one 3 to 6 images after it closes; past the hold, all a little faster.
  const LIFTS = [6, 6, 4, 5, 3];
  const WIDTH = Math.round(py * 0.038 * 10) / 10;
  const loops = React.useMemo(() => {
    const list = laidOut.placed.map((w, i) => {
      if (!w.cells.length) return null;
      const p0 = w.cells[0];
      const p1 = w.cells[w.cells.length - 1];
      const seed = "mm-loop-" + i;
      let shape;
      if (w.kind === "rows") {
        const a = w.cells.slice(0, w.cut);
        const b = w.cells.slice(w.cut);
        const box = (cs) => ({ x: cx(cs[0][0]) - 0.42 * px, y: cy(cs[0][1]) - 0.45 * py, w: (cs[cs.length - 1][0] - cs[0][0]) * px + 0.84 * px, h: 0.9 * py });
        shape = { kind: "cells", rows: [box(a), box(b)] };
      } else {
        const ax = cx(p0[0]);
        const ay = cy(p0[1]);
        const bx = cx(p1[0]);
        const by2 = cy(p1[1]);
        const slant = w.kind === "slant";
        const length = Math.hypot(bx - ax, by2 - ay) + 0.8 * px;
        const mx = (ax + bx) / 2 + (slant ? 0.12 * px : 0);
        const my = (ay + by2) / 2 + (slant ? 0.12 * py : 0);
        shape = { kind: "capsule", box: { x: mx - length / 2, y: my - 0.45 * py, w: length, h: 0.9 * py }, angle: (Math.atan2(by2 - ay, bx - ax) * 180) / Math.PI };
      }
      const stroke = Scribble.frames({ ...shape, speed: 1, start: "top-left", direction: "ccw", wobble: 0.45, seed });
      return { shape, seed, stroke, cells: w.cells, takes: Math.max(12, (shape.kind === "cells" ? 27.9 : 18.6) + (3.21 * stroke) / py) };
    });
    const kept = list.filter(Boolean);
    const total = kept.reduce((s, l, j) => s + l.takes + (j < kept.length - 1 ? LIFTS[j % LIFTS.length] : 0), 0);
    const room = Math.max(1, until - HOLD - FIRST);
    const k = total > room ? room / total : 1;
    let next = FIRST;
    return kept.map((l, j) => {
      const takes = l.takes * k;
      const out = { ...l, at: Math.round(next), speed: l.stroke / Math.max(1, takes) };
      next += takes + Math.max(2, LIFTS[j % LIFTS.length] * k);
      return out;
    });
  }, [laidOut, until, HOLD, FIRST, wide]);

  // 3. Her calm shot, as filmed, darkened just enough for its bright parts to stay under 60 % of white (dosed by its
  // own light: a white room in daylight takes far more than a dark kitchen); a still photo, a playing video.
  const light = React.useMemo(() => (n ? LightUnder(shots[0], 0, laid) : null), [n, wide]);
  const veil = light && light.high > 0 ? Math.max(0, Math.min(0.55, 1 - 0.6 / light.high)) : 0.25;
  const film = n ? h(Footage, { key: "film", shot: 0, style: { left: 0, top: 0, width: bw, height: bh } }) : null;
  const frameBox = h("div", { key: "frame", style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#141414" } },
    film, veil > 0 ? h("div", { style: { position: "absolute", left: 0, top: 0, width: bw, height: bh, backgroundColor: "#000000", opacity: Number(veil.toFixed(3)) } }) : null);

  // The letters, each centred in its cell, the same white from the first image to the last (ringed or not), with a soft
  // dark halo so they read on a bright part of her shot too (« parfois on voit pas » under a glass roof, its first bench),
  // stronger where the picture stays bright under its veil, by the light read under each letter (a glass roof, a window,
  // a white wall: Tristan, « on voit pas bien les lettres sur certaines zones ») and nowhere else.
  const LETTER = { fontFamily: body, fontWeight: wide ? 500 : 400, fontSize: SIZE, lineHeight: 1, color: "#ffffff" };
  const lightAt = React.useMemo(() => {
    const memo = new Map();
    return (c, r) => {
      const k = c + "," + r;
      if (memo.has(k)) return memo.get(k);
      const read = n ? LightUnder(shots[0], 0, laid, { x: cx(c) - px, y: cy(r) - py, w: 2 * px, h: 2 * py }) : null;
      const v = read ? read.high * (1 - veil) : null;
      memo.set(k, v);
      return v;
    };
  }, [n, wide, veil]);
  const brightAt = (c, r) => { const v = lightAt(c, r); return v === null ? 0 : Math.max(0, Math.min(1, (v - 0.3) / 0.35)); };
  const haloOf = (k) => "0 0 " + Math.round(6 + 9 * k) + "px rgba(0,0,0," + (0.55 + 0.35 * k).toFixed(2) + "), 0 1px 2px rgba(0,0,0," + (0.45 + 0.4 * k).toFixed(2) + ")";
  const cell = (key, c, r, ch) => h("div", { key, style: { position: "absolute", left: Math.round(cx(c) - px / 2), top: Math.round(cy(r) - py / 2), width: Math.ceil(px), height: Math.ceil(py), display: "flex", alignItems: "center", justifyContent: "center", ...LETTER, textShadow: haloOf(brightAt(c, r)) } }, ch);
  const unseen = (key, ch) => h("span", { key, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, ch);
  const spell = (word, key) => {
    let j = 0;
    return word.units.map((u, m) => {
      if (!u.cell) return unseen(key + "-p" + m, u.c);
      const p = word.cells[j++];
      return p ? cell(key + "-" + m, p[0], p[1], u.c) : unseen(key + "-u" + m, u.c);
    });
  };
  const decor = h("div", { key: "grid", "data-fauve-decor": "", style: { position: "absolute", left: 0, top: 0, width, height } },
    laidOut.filler.map((f) => cell("f" + f.c + "-" + f.r, f.c, f.r, f.ch)),
    laidOut.hidden.map((w, i) => h(React.Fragment, { key: "d" + i }, i ? unseen("ds" + i, " ") : null, spell(w, "d" + i))));
  // Her words: to be read on the vertical frame (outside the decor); on the 16:9 one, at the original's size, decor too.
  const words = h("div", { key: "words", ...(wide ? { "data-fauve-decor": "" } : {}), style: { position: "absolute", left: 0, top: 0, width, height } },
    laidOut.placed.map((w, i) => h(React.Fragment, { key: "w" + i }, i ? unseen("ws" + i, " ") : null, spell(w, "w" + i))));
  const rings = loops.map((l, i) => (frame < l.at ? null : h(Scribble, { key: "loop" + i, ...l.shape, at: l.at, speed: l.speed, start: "top-left", direction: "ccw", color: "#ffffff", width: WIDTH, wobble: 0.45, seed: l.seed })));

  // Any other text of the Reel (none in its slots): a plain line at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 96 + i * 112, width: width - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.6)" } }, keep(t.text)));

  // 4. Its ending card, in option, after the hold: the grid dimmed, its title in white, a line under it.
  const shade = end ? interpolate(frame, [endAt, endAt + 8], [0, 1], clamp) : 0;
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { position: "absolute", left: 0, top: 0, width, height, backgroundColor: "rgba(8,8,10," + (0.7 * shade).toFixed(3) + ")" } }),
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 700 : 780, width: width - 280, height: 300 }, innerStyle: { justifyContent: end.subtitle ? "flex-end" : "center", fontFamily: display, fontWeight: 600, fontSize: 104, lineHeight: 1.04, letterSpacing: "-0.02em", color: "#ffffff", textAlign: "center", textWrap: "balance" } },
          h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 2, endAt + 8], [0, 1], clamp) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1024, width: width - 280, height: 170 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 52, lineHeight: 1.2, color: "#ffffff", textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 6, endAt + 12], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  // Under each loop, the same stroke darker and wider: a soft halo like its letters', without a filter (light to render).
  // Darker where the picture under the loop stays bright (its brightest letter's light).
  const loopBright = (l) => (l.cells && l.cells.length ? Math.max.apply(null, l.cells.map((p) => brightAt(p[0], p[1]))) : 0);
  const halos = loops.map((l, i) => (frame < l.at ? null : h(Scribble, { key: "halo" + i, ...l.shape, at: l.at, speed: l.speed, start: "top-left", direction: "ccw", color: "rgba(0,0,0," + (0.32 + 0.3 * loopBright(l)).toFixed(2) + ")", width: Math.round(WIDTH * 3.2 * 10) / 10, wobble: 0.45, seed: l.seed })));
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, decor, words, halos, rings, extra, ending);
}`;

export const motsMeles: MontageSkill = {
  key: "mots-meles",
  // 2: written again on its original's fiche (its grid, its hand's pace, its sentence held, its light, its format).
  // 3: its letters 1,4 times bigger on the 16:9 frame and a soft dark halo under its letters and loops, to read on a
  // bright shot (Tristan, on its first bench: « un peu plus grosse et parfois on voit pas »). 4: that halo stronger where
  // the picture stays bright under the letters, by the light read there (« il devrait appliquer un filtre »).
  // 5: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 5,
  bpm: BPM,
  // A calm music without marked drums: its length follows it (21,4 s at 70 BPM, 16,7 s at 90), its loops the hand.
  tempo: [70, 90],
  shots: [1, 1],
  files: [1, 2],
  how: "Un seul plan calme, téléphone posé, assombri juste ce qu'il faut sous une grille de fines capitales blanches qui couvre tout le cadre, comme un mots mêlés (9 × 16 en vertical plein écran ; 16 × 10 sur sa vidéo horizontale en 16:9 sur du noir, à sa demande) ; les mots de sa phrase y sont cachés dans l'ordre, de haut en bas (un sur deux rangées, un en diagonale qui monte), parmi d'autres mots de son univers jamais entourés ; une boucle blanche tracée à la main, à l'allure d'une main, entoure un mot, la suivante part dès qu'elle se ferme, et toute la phrase entourée reste tenue au moins trois secondes à la fin. Rien ne s'allume, rien ne coupe.",
  end: true,
  texts: [
    {
      slot: "mots",
      role: "band",
      want: "sa phrase cachée dans la grille et entourée mot à mot : ce que montre sa vidéo, dit comme on le dirait, en 4 à 6 mots de 3 à 9 lettres, sans chiffres (une forme comme « samedi matin café croissant », « une coupe et un brushing », « mardi soir yoga doux ») ; un mot plus long ou avec un trait d'union (« après-midi ») passe sur deux rangées",
      max: 48,
      required: true,
    },
    {
      slot: "autres",
      role: "caption",
      want: "facultatif : 2 à 4 autres mots de son univers cachés dans la grille sans jamais être entourés, comme dans un vrai mots mêlés (ses produits, ses gestes, son lieu : une forme comme « brioche cannelle miel », « frange lissage ») ; 9 lettres au plus chacun",
      max: 30,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, ou horizontal comme l'original (sa vidéo en 16:9 sur du noir, la grille dessus)",
      choices: [
        { value: "vertical", says: "vertical plein écran, la grille sur tout le cadre, sa vidéo horizontale recadrée sur son sujet" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, la grille sur la vidéo, comme l'original", band: true },
        { value: "auto", says: "comme sa vidéo (horizontal si elle l'est)" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): its length and its hold follow it; its loops follow the hand.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // One shot under the grid; with an ending card, its time after the hold (the engine's 2,5 s at least, on the
    // half-beat grid, rounded up so a frame lost to rounding never cuts into it).
    const card = end ? Math.ceil(((END_CARD + 0.05) / beat) * 2) / 2 : 0;
    const spans = beatSpans(bpm, [LENGTH + card]);
    const duration = spans[0]!.end;
    const grid = round(end ? duration - END_CARD : duration);
    return {
      duration,
      shots: spans.map((s) => ({
        ...s,
        want: `sa vidéo la plus calme, filmée téléphone posé (sur un pied, une étagère, une table), d'au moins ${comma(duration)} s sans coupe ni mouvement de caméra : quelqu'un qui fait une chose simple dans son lieu (manger, boire un café, lire, des mains au travail, une posture tenue), avec de la place autour et une lumière douce ; une photo marche aussi, tenue fixe : une grille de lettres la recouvre tout le Reel`,
      })),
      // The grid is there from the first image with her words in it; with an ending card, it dims under it.
      texts: { mots: { from: 0, to: grid }, autres: { from: 0, to: grid } },
      marks: { first: FIRST_FRAME, hold: toFrame(HOLD * beat) },
    };
  },
  code: CODE,
  // Its code darkens her shot to its own light (the veil dosed by LightUnder): none of its model's exposure laid over
  // it again, and no grain nor dark corners (the original has none: its corners are lighter than its middle).
  finish: { exposure: 0, grain: 0, vignette: 0 },
};
