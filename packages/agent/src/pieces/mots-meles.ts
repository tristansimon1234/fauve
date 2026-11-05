import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Mots mêlés », the effect (docs/fiches/mots-meles.md, effects 1 to 8; its whole Reel is skills/mots-meles.ts): over one
// calm shot, darkened just enough under it, a grid of thin white capitals covers the whole frame edge to edge like a
// word search (9 columns × 16 rows, the first letter 0,73 of a step from each edge); her sentence is hidden in it in its
// order, top to bottom (one word over two rows ringed by one stroke in steps, one up a diagonal from its first letter),
// among words of her world never ringed, a short word of hers once more as a trap, and letters drawn from the whole
// alphabet alike; from its fifth image a thin white stroke drawn by hand rings her first word, from just above its first
// letter, counterclockwise, at a hand's pace (no easing, slower in its ends), the next one starting 3 to 6 images after
// it closes; the letters never change; the whole sentence ringed is held to the cut. Kept of its skill v4: its grid and
// its proportions, its hand's pace (18,6 images plus 3,2 a row of stroke, 27,9 for a stroke in steps; its lifts of 6,
// 6, 4, 5 and 3 images), its loops' shapes and sizes, its veil dosed by her shot's own light (its brightest tenth under
// 60 % of white), the halo of each letter and the dark stroke under each loop stronger where the picture stays bright.
// Made for a moment of any Reel: its loops a little faster when its span is short, so the sentence is always held
// whole (a third of its span, 1,2 to 3 s) before the cut; her words never on a face seen under it (they go to other
// cells of their row, its filler letters a decor there). Played full frame only, over the montage's own shot: in the original's
// 16:9 band her words would be decor under the size a phone reads (its skill's question to Tristan). Left to its Reel:
// its length (25 beats), its ending card. Nothing of the original's own (its sentence, its words, its yoghurt).

/** Its first loop starts on this image (the original's 0,13 s: the grid alone before it). */
const FIRST_FRAME = 4;
/** Its whole sentence held at the end: a third of its span, between these (frames). */
const HOLD = [36, 90] as const;

/** Its marks for a span: its first loop's image, and how long its sentence is held whole before the cut. */
export function motsMelesMarks(frames: number): { first: number; hold: number } {
  const hold = Math.round(Math.min(Math.max(HOLD[0], frames * 0.3), HOLD[1], Math.max(6, frames * 0.5)));
  return { first: Math.min(FIRST_FRAME, Math.max(0, frames - hold - 1)), hold };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const D = durationInFrames;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  // Its shots: those that play during it; her calm shot is the first of them (the montage plays it full frame under it).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < D && shots[i].from + shots[i].durationInFrames > 0);
  const seenFor = (i) => Math.min(D, shots[i].from + shots[i].durationInFrames) - Math.max(0, shots[i].from);
  const ground = mine.length ? (mine.find((i) => seenFor(i) > 2) ?? mine[0]) : -1;
  const shot = ground >= 0 ? shots[ground] : null;
  const f0 = shot ? Math.max(0, Math.round(shot.from)) : 0;
  const FIRST = Math.max(0, Math.round(mark("first", 4)));
  const HOLD = Math.max(0, Math.round(mark("hold", Math.min(90, Math.max(36, D * 0.3)))));
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const laid = { left: 0, top: 0, width, height };

  // 1. The grid: the original's density turned a quarter on the vertical frame (9 × 16), the first letter 0,73 of a
  // step from each edge; capitals of a regular grotesque, white, no shadow, 48 px, where her words are read.
  const COLS = 9;
  const ROWS = 16;
  const M = 0.73;
  const px = width / (COLS - 1 + 2 * M);
  const py = height / (ROWS - 1 + 2 * M);
  const cx = (c) => (M + c) * px;
  const cy = (r) => (M + r) * py;
  const SIZE = 48;
  // The faces seen under it (sampled over its span): her words never sit on one (its filler letters do, a decor).
  const features = React.useMemo(() => {
    if (typeof track !== "function") return [];
    const out = [];
    for (let f = 0; f < D; f += 10) {
      const got = track(f);
      for (const face of (got && got.faces) || []) out.push({ x0: face.x - face.width / 2, x1: face.x + face.width / 2, y0: face.y - face.height / 2, y1: face.y + face.height / 2 });
    }
    return out;
  }, [D]);
  // Where her words may lie: each letter whole inside the safe zone, left of the apps' buttons below the middle, off a face.
  const readable = (c, r) => {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    const x = cx(c);
    const y = cy(r);
    const hw = SIZE * 0.46;
    const hh = SIZE * 0.55;
    if (!(y - hh >= 80 && y + hh <= height * 0.75 && x - hw >= 28 && x + hw <= (y + hh > height / 2 ? width - 128 : width - 28))) return false;
    return !features.some((b) => x + hw + 10 >= b.x0 && x - hw - 10 <= b.x1 && y + hh + 10 >= b.y0 && y - hh - 10 <= b.y1);
  };
  const phrase = word("mots");
  const decoys = word("autres");

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
    // Any space between her words, the French no-break ones too (\s holds them).
    const split = (s) => String(s || "").split(/\s+/).filter(Boolean).map(units);
    const count = (w) => w.filter((u) => u.cell).length;
    const words = split(phrase);
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
    // Each row's room: its longest run of free cells (a face seen there splits it).
    const room = readRows.map((r) => { let best = 0, run = 0; for (let c = 0; c < COLS; c++) { run = readable(c, r) ? run + 1 : 0; best = Math.max(best, run); } return best; });
    const most = Math.max(0, ...room);
    // The letters of each word on its first row (all of them: one row).
    const cut = chars.map((cs) => (cs.length > most ? Math.ceil(cs.length / 2) : 0));
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
    const hidden = hide(split(decoys), "mm-d-");
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
  }, [phrase, decoys, features]);

  // 2. Her words ringed one after the other in the order of her sentence, each by one stroke drawn by hand: from just
  // above its first letter, counterclockwise, closed on its start, a capsule round its letters (0,9 of a row tall, its
  // ends 0,4 of a column past its first and last letters; up a diagonal along it, a little off its axis), the rounded
  // outline of its cells in steps round a word over two rows; white, a stroke 3,8 % of a row thick, no shadow, still
  // once drawn. At the original's hand: no easing, slower in its ends, a word taking 18,6 images plus 3,2 a row of
  // stroke (42 for FOR, 78 for SATURDAY), the next one 3 to 6 images after it closes; all a little faster when its span
  // would not hold the sentence whole before the cut.
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
    const room = Math.max(1, D - HOLD - FIRST);
    const k = total > room ? room / total : 1;
    let next = FIRST;
    return kept.map((l, j) => {
      const takes = l.takes * k;
      const out = { ...l, at: Math.round(next), speed: l.stroke / Math.max(1, takes) };
      next += takes + Math.max(2, LIFTS[j % LIFTS.length] * k);
      return out;
    });
  }, [laidOut, D, HOLD, FIRST]);

  // 3. Her calm shot, as the montage plays it under it, darkened just enough for its bright parts to stay under 60 % of
  // white (dosed by its own light: a white room in daylight takes far more than a dark kitchen).
  const light = React.useMemo(() => (shot ? LightUnder(shot, f0, laid) : null), [ground, D]);
  const veil = light && light.high > 0 ? Math.max(0, Math.min(0.55, 1 - 0.6 / light.high)) : 0.25;
  const shade = veil > 0 ? h("div", { key: "veil", style: { position: "absolute", left: 0, top: 0, width, height, backgroundColor: "#000000", opacity: Number(veil.toFixed(3)) } }) : null;

  // The letters, each centred in its cell, the same white from the first image to the last (ringed or not), with a soft
  // dark halo so they read on a bright part of her shot too, stronger where the picture stays bright under its veil, by
  // the light read under each letter (a glass roof, a window, a white wall) and nowhere else.
  const LETTER = { fontFamily: body, fontWeight: 400, fontSize: SIZE, lineHeight: 1, color: "#ffffff" };
  const lightAt = React.useMemo(() => {
    const memo = new Map();
    return (c, r) => {
      const key = c + "," + r;
      if (memo.has(key)) return memo.get(key);
      const read = shot ? LightUnder(shot, f0, laid, { x: cx(c) - px, y: cy(r) - py, w: 2 * px, h: 2 * py }) : null;
      const v = read ? read.high * (1 - veil) : null;
      memo.set(key, v);
      return v;
    };
  }, [ground, veil]);
  const brightAt = (c, r) => { const v = lightAt(c, r); return v === null ? 0 : Math.max(0, Math.min(1, (v - 0.3) / 0.35)); };
  const haloOf = (k) => "0 0 " + Math.round(6 + 9 * k) + "px rgba(0,0,0," + (0.55 + 0.35 * k).toFixed(2) + "), 0 1px 2px rgba(0,0,0," + (0.45 + 0.4 * k).toFixed(2) + ")";
  const cell = (key, c, r, ch) => h("div", { key, style: { position: "absolute", left: Math.round(cx(c) - px / 2), top: Math.round(cy(r) - py / 2), width: Math.ceil(px), height: Math.ceil(py), display: "flex", alignItems: "center", justifyContent: "center", ...LETTER, textShadow: haloOf(brightAt(c, r)) } }, ch);
  const unseen = (key, ch) => h("span", { key, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, ch);
  const spell = (w, key) => {
    let j = 0;
    return w.units.map((u, m) => {
      if (!u.cell) return unseen(key + "-p" + m, u.c);
      const p = w.cells[j++];
      return p ? cell(key + "-" + m, p[0], p[1], u.c) : unseen(key + "-u" + m, u.c);
    });
  };
  const decor = h("div", { key: "grid", "data-fauve-decor": "", style: { position: "absolute", left: 0, top: 0, width, height } },
    laidOut.filler.map((f) => cell("f" + f.c + "-" + f.r, f.c, f.r, f.ch)),
    laidOut.hidden.map((w, i) => h(React.Fragment, { key: "d" + i }, i ? unseen("ds" + i, " ") : null, spell(w, "d" + i))));
  // Her words, to be read (outside the decor).
  const words = h("div", { key: "words", style: { position: "absolute", left: 0, top: 0, width, height } },
    laidOut.placed.map((w, i) => h(React.Fragment, { key: "w" + i }, i ? unseen("ws" + i, " ") : null, spell(w, "w" + i))));
  const rings = loops.map((l, i) => (frame < l.at ? null : h(Scribble, { key: "loop" + i, ...l.shape, at: l.at, speed: l.speed, start: "top-left", direction: "ccw", color: "#ffffff", width: WIDTH, wobble: 0.45, seed: l.seed })));
  // Under each loop, the same stroke darker and wider: a soft halo like its letters', without a filter (light to
  // render), darker where the picture under the loop stays bright (its brightest letter's light); a decor, not a mark.
  const loopBright = (l) => (l.cells && l.cells.length ? Math.max.apply(null, l.cells.map((p) => brightAt(p[0], p[1]))) : 0);
  const halos = h("div", { key: "halos", "data-fauve-decor": "", style: { position: "absolute", left: 0, top: 0, width, height } },
    loops.map((l, i) => (frame < l.at ? null : h(Scribble, { key: "halo" + i, ...l.shape, at: l.at, speed: l.speed, start: "top-left", direction: "ccw", color: "rgba(0,0,0," + (0.32 + 0.3 * loopBright(l)).toFixed(2) + ")", width: Math.round(WIDTH * 3.2 * 10) / 10, wobble: 0.45, seed: l.seed }))));
  return h(AbsoluteFill, { style: { pointerEvents: "none" } }, shade, decor, words, halos, rings);
}`;

export const motsMeles: EffectPiece = {
  key: "mots-meles",
  version: 1,
  name: "Mots mêlés",
  how: "sur un plan calme, assombri juste ce qu'il faut, une grille de fines capitales blanches couvre tout l'écran comme un mots mêlés ; les mots de sa phrase y sont cachés dans l'ordre, de haut en bas (un sur deux rangées, un en diagonale qui monte), parmi d'autres mots de son univers jamais entourés ; une boucle blanche tracée à la main, à l'allure d'une main, entoure chaque mot l'un après l'autre, puis toute la phrase entourée reste jusqu'à la coupe.",
  needs: "un plan calme et fixe, téléphone posé, 4 s au moins : quelqu'un attablé, qui lit ou boit un café, des mains au travail, son lieu au repos ; une lumière douce ; et une phrase de 3 à 5 mots qui dit ce qu'on y voit.",
  lays: "sur un seul plan calme, dès le début du plan ; la grille part avec la coupe",
  shots: [1, 1],
  seconds: [4, 10],
  require: { files: 1, shot: { still: true } },
  texts: [
    {
      slot: "mots",
      want: "sa phrase cachée dans la grille et entourée mot à mot : ce que montre sa vidéo, dit comme on le dirait, en 3 à 5 mots de 3 à 9 lettres, sans chiffres (une forme comme « samedi matin café croissant », « une coupe et un brushing », « bouquets du samedi ») ; un mot plus long ou avec un trait d'union (« après-midi ») passe sur deux rangées",
      max: 36,
      required: true,
    },
    {
      slot: "autres",
      want: "2 à 4 autres mots de son univers cachés dans la grille sans jamais être entourés, comme dans un vrai mots mêlés (ses produits, ses gestes, son lieu : une forme comme « brioche cannelle miel », « frange lissage ») ; 9 lettres au plus chacun",
      max: 30,
      required: false,
    },
  ],
  timeline({ frames }: PieceTimelineInput) {
    return { marks: motsMelesMarks(frames) };
  },
  code: CODE,
};
