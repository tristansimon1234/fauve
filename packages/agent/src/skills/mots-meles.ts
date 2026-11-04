import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Mots mêlés », written on its original (house/originals/mots-meles.mp4, 18,7 s, one calm fixed shot of a woman
// eating in her kitchen, looked at image by image): the shot a little darkened under a grid of thin grey capitals spread
// evenly over the whole frame, edge to edge (16 × 10 on its landscape frame), the hidden words lying along its rows,
// down a column or up a diagonal, among other words of the same world left unringed (« blackberry », « cinnamon »);
// from half a second, a thin white line drawn by hand rings a word in about 0,6 s, then the next one, a word every 1,5
// to 3 s in the order of the sentence, top to bottom (« saturday », « afternoon » over two rows, « call », « for »,
// « greek » up a diagonal, « yogurt »), and the grid holds the whole sentence ringed for its last 6 s. Here the grid is
// laid out by code for a vertical frame (9 columns of square cells): her words set in its rows in the order of her
// sentence, a row each spread from the top of the safe zone to its bottom (one down a diagonal, one too long for a row
// over two), never under the apps' buttons; its other letters drawn the French way, her other words hidden among them
// unringed; a ringed word's letters turn white. Its ending card (an offer, an announcement) is written over the grid,
// dimmed.

const BPM = 80;
/** The first loop is drawn on this beat (the grid alone before it). */
const FIRST = 1;
/** The grid with every word found is held this long at the end (beats): the last loop starts no later than this before it. */
const HOLD = 5;
/** Its length without an ending card (beats): 15 s at its own tempo, the calm video of about 15 s it wants. */
const LENGTH = 20;
/** The engine's ending card: the Reel's last 1,6 s. */
const CARD_SECONDS = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const comma = (n: number) => String(round(n)).replace(".", ",");

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = Math.max(4, mark("beat", 22.5));
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const FIRST = Math.max(4, mark("first", Math.round(BEAT)));
  // The last loop starts by then, so the whole sentence is read before the end (or the ending card).
  const LAST = Math.max(FIRST, Math.min(mark("last", Math.round(15 * BEAT)), Math.min(endAt, durationInFrames) - Math.round(4 * BEAT)));
  const LOOP = Math.max(10, Math.min(18, Math.round(0.8 * BEAT)));
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const display = "'" + brand.displayFont + "', '" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const full = { position: "absolute", left: 0, top: 0, width, height };
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number, nor a line before a « · ».
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0").replace(/ (\d+(?:er|e))\b/g, "\u00a0$1").replace(/ ([·•|–—]) /g, "\u00a0$1 ");
  const phrase = reelTexts.find((t) => t.role === "band");
  const decoys = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== phrase && t !== decoys);

  // The grid: nine columns of square cells over the whole frame, edge to edge.
  const COLS = 9;
  const CELL = width / COLS;
  const ROWS = Math.ceil(height / CELL);
  const mid = (r) => r * CELL + CELL / 2;
  // Where her words may lie: each letter whole in the safe zone (a capital is about half a cell wide), left of the
  // apps' buttons below the middle of the frame.
  const readable = (c, r) =>
    c >= 0 && c < COLS && mid(r) - 26 >= 80 && mid(r) + 26 <= height * 0.75 && c * CELL + CELL / 2 - 22 >= 28 && c * CELL + CELL / 2 + 22 <= (mid(r) + 26 > height / 2 ? width - 128 : width - 28);
  const readRows = [];
  for (let r = 0; r < ROWS; r++) if (Array.from({ length: COLS }, (_, c) => c).some((c) => readable(c, r))) readRows.push(r);

  // 1. The grid, laid out once from her words, like a text set in its rows: each word on a row below the one before,
  // the rows spread from the top of the readable ones to their bottom (a word too long for its row over two, one
  // under the other, as « after » over « noon » in the model), one of them down a diagonal; her other words hidden
  // among the letters without a loop; the other letters drawn the French way. What is not a letter (an apostrophe, a
  // comma) is kept unseen in its place, so her sentence stays whole in the page.
  const laid = React.useMemo(() => {
    const isLetter = (c) => /[\p{L}\p{N}]/u.test(c);
    const units = (w) => Array.from(String(w).normalize("NFC")).map((c) => ({ c: isLetter(c) ? c.toUpperCase() : c, cell: isLetter(c) }));
    // Her words, her name's too (the engine joins it with fixed spaces).
    const split = (s) => String(s || "").split(/[ \t\n\u00a0\u202f]+/).filter(Boolean).map(units);
    const count = (w) => w.filter((u) => u.cell).length;
    const words = split(phrase ? phrase.text : "");
    // A word of one letter (« à ») joins the next one, so each loop goes round a word.
    for (let i = 0; i < words.length && words.length > 1; i++) {
      if (count(words[i]) >= 2) continue;
      if (i < words.length - 1) words.splice(i, 2, words[i].concat(words[i + 1]));
      else words.splice(i - 1, 2, words[i - 1].concat(words[i]));
      i = -1;
    }
    // Ten loops at most: the two shortest neighbours join.
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
    const R = readRows.length;
    // How many letters each readable row holds (its readable cells, from the left).
    const wide = readRows.map((r) => Array.from({ length: COLS }, (_, c) => c).filter((c) => readable(c, r)).length);
    // Its rows: one, or two for a word longer than any row.
    const span = (i) => (chars[i].length > COLS ? 2 : 1);
    const holds = (i, q) => (span(i) === 1 ? chars[i].length <= wide[q] : q + 1 < R && readRows[q + 1] === readRows[q] + 1 && Math.ceil(chars[i].length / 2) <= wide[q] && Math.floor(chars[i].length / 2) <= wide[q + 1]);
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
    // One word down a diagonal, as the model (its fifth of six): from its own row, where its letters are free; the
    // words that could take it are laid last, the nearest to that place first, the others along their row.
    const prefer = k >= 4 ? k - 2 : 1;
    const slants = Array.from({ length: k }, (_, i) => i)
      .filter((i) => k >= 3 && chars[i].length >= 3 && chars[i].length <= 6 && rowOf[i] >= 0 && span(i) === 1 && rowOf[i] + chars[i].length <= R)
      .sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer));
    const cellsOf = words.map(() => null);
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
        if (!slanted && slants.indexOf(i) >= 0) for (const c of cols) { const t = run(c, r, 1, 1, L); if (ok(t)) { cells = t; slanted = true; break; } }
        if (!cells && span(i) === 1) for (const c of cols) { const t = run(c, r, 1, 0, L); if (ok(t)) { cells = t; break; } }
        if (!cells && span(i) === 2) for (const c of cols) { const t = run(c, r, 1, 0, Math.ceil(L / 2)).concat(run(c, r + 1, 1, 0, L - Math.ceil(L / 2))); if (ok(t)) { cells = t; break; } }
      }
      // No row kept for it (her sentence too long for the grid): along any readable row it fits, else anywhere.
      for (let j = 0; j < R && !cells; j++) for (const c of cols) { const t = run(c, readRows[j], 1, 0, L); if (ok(t)) { cells = t; break; } }
      for (let r = 0; r < ROWS && !cells; r++) for (let c = 0; c < COLS && !cells; c++) { const t = run(c, r, 1, 0, Math.min(L, COLS)); if (fits(t, chars[i])) cells = t; }
      cellsOf[i] = cells;
      (cells || []).forEach((p, j) => { grid[p[0] + "," + p[1]] = chars[i][j]; });
    });
    const placed = words.map((w, i) => ({ units: w, cells: cellsOf[i] || [] }));
    // Her other words, hidden among the letters without a loop: along a row or down a column, wherever they fit.
    const hidden = split(decoys ? decoys.text : "").map((w, i) => {
      const chars = w.filter((u) => u.cell).map((u) => u.c);
      const L = chars.length;
      let cells = null;
      if (L) {
        const spots = shuffled(Array.from({ length: COLS * ROWS * 2 }, (_, s) => s), "mm-d-" + i);
        for (const s of spots) {
          const down = s >= COLS * ROWS;
          const c = (s % (COLS * ROWS)) % COLS;
          const r = Math.floor((s % (COLS * ROWS)) / COLS);
          const t = down ? run(c, r, 0, 1, L) : run(c, r, 1, 0, L);
          if (fits(t, chars)) { cells = t; break; }
        }
      }
      (cells || []).forEach((p, j) => { grid[p[0] + "," + p[1]] = chars[j]; });
      return { units: w, cells: cells || [] };
    });
    // The other letters, the French way: the common ones more often.
    const FRENCH = "EEEEEEAAAAIIIISSSSNNNNRRRTTTOOOLLLUUUDDCCMMPPGBVHFQJXYZ";
    const filler = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (at(c, r) === undefined) filler.push({ c, r, ch: FRENCH[Math.floor(random("mm-f-" + c + "-" + r) * FRENCH.length)] });
    return { placed, hidden, filler };
  }, [phrase ? phrase.text : "", decoys ? decoys.text : "", width, height]);

  // 2. The words found one after the other, in the order of her sentence: a loop every few beats from the first one,
  // the last no later than the hold, each drawn by hand in a moment; its letters turn white once ringed.
  const k = laid.placed.length;
  const step = k > 1 ? Math.max(Math.round(1.5 * BEAT), Math.min(Math.round(4 * BEAT), Math.floor((LAST - FIRST) / (k - 1) / (BEAT / 2)) * (BEAT / 2))) : 0;
  const when = (i) => Math.round(FIRST + i * step);
  const LETTER = { fontFamily: body, fontWeight: 300, fontSize: Math.round(CELL * 0.4), lineHeight: 1, color: "rgba(255,255,255,0.6)", textShadow: "0 1px 2px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.35)" };
  const cell = (key, c, r, ch, style) => h("div", { key, style: { position: "absolute", left: Math.round(c * CELL), top: Math.round(r * CELL), width: Math.ceil(CELL), height: Math.ceil(CELL), display: "flex", alignItems: "center", justifyContent: "center", ...LETTER, ...(style || {}) } }, ch);
  const unseen = (key, ch) => h("span", { key, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, ch);
  // A word's letters in its cells, in reading order, what is not a letter unseen in its place.
  const spell = (word, key, found) => {
    let j = 0;
    return word.units.map((u, m) => {
      if (!u.cell) return unseen(key + "-p" + m, u.c);
      const p = word.cells[j++];
      if (!p) return unseen(key + "-u" + m, u.c);
      return cell(key + "-" + m, p[0], p[1], u.c, found ? { color: "rgba(255,255,255," + (0.6 + 0.4 * found).toFixed(3) + ")", fontWeight: found > 0.5 ? 500 : 300 } : null);
    });
  };
  const decor = h("div", { key: "grid", "data-fauve-decor": "", style: full },
    laid.filler.map((f) => cell("f" + f.c + "-" + f.r, f.c, f.r, f.ch)),
    laid.hidden.map((w, i) => h(React.Fragment, { key: "d" + i }, i ? unseen("ds" + i, " ") : null, spell(w, "d" + i, 0))));
  const found = laid.placed.map((w, i) => h(React.Fragment, { key: "w" + i }, spell(w, "w" + i, interpolate(frame, [when(i) + LOOP * 0.6, when(i) + LOOP + 4], [0, 1], clamp))));
  const loops = laid.placed.map((w, i) => {
    const a = when(i);
    if (!w.cells.length || frame < a) return null;
    const xs = w.cells.map((p) => p[0]);
    const ys = w.cells.map((p) => p[1]);
    const c0 = Math.min(...xs);
    const c1 = Math.max(...xs);
    const r0 = Math.min(...ys);
    const r1 = Math.max(...ys);
    const p0 = w.cells[0];
    const p1 = w.cells[w.cells.length - 1];
    const slant = w.cells.length > 1 && c1 - c0 === r1 - r0 && c1 > c0 && p0[1] !== p1[1] && Math.abs(p1[0] - p0[0]) === Math.abs(p1[1] - p0[1]);
    let box;
    let angle = 0;
    if (r0 === r1 || slant || c0 === c1) {
      const ax = p0[0] * CELL + CELL / 2;
      const ay = p0[1] * CELL + CELL / 2;
      const bx = p1[0] * CELL + CELL / 2;
      const by = p1[1] * CELL + CELL / 2;
      const length = Math.hypot(bx - ax, by - ay) + CELL * 0.92;
      box = { x: (ax + bx) / 2 - length / 2, y: (ay + by) / 2 - CELL * 0.36, w: length, h: CELL * 0.72 };
      angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    } else box = { x: c0 * CELL + CELL * 0.06, y: r0 * CELL + CELL * 0.1, w: (c1 - c0 + 1) * CELL - CELL * 0.12, h: (r1 - r0 + 1) * CELL - CELL * 0.2 };
    return h("div", { key: "loop" + i, style: { ...full, filter: "drop-shadow(0 0 1.5px rgba(0,0,0,0.6))" } },
      h(Scribble, { kind: "capsule", box, angle, at: a, frames: LOOP, color: "#ffffff", width: 4, wobble: 0.5, seed: "mm-loop-" + i }));
  });

  // 3. Her calm shot full frame, a little darkened so the grid reads on it.
  const film = n ? h(Footage, { key: "film", shot: 0, style: full }) : null;
  const veil = h("div", { key: "veil", style: { ...full, backgroundColor: "rgba(0,0,0,0.2)" } });

  // Any other text of the Reel (none in its slots): a plain line on a dark label at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 96 + i * 112, width: width - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#ffffff", textAlign: "center" } },
      h("span", { style: { backgroundColor: "rgba(0,0,0,0.55)", padding: "6px 18px" } }, keep(t.text))));

  // 4. Its ending card: the grid dimmed, its title in white over it, a line under it.
  const shade = end ? interpolate(frame, [endAt, endAt + 8], [0, 1], clamp) : 0;
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { ...full, backgroundColor: "rgba(8,8,10," + (0.66 * shade).toFixed(3) + ")" } }),
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 700 : 780, width: width - 280, height: 300 }, innerStyle: { justifyContent: end.subtitle ? "flex-end" : "center", fontFamily: display, fontWeight: 600, fontSize: 104, lineHeight: 1.04, letterSpacing: "-0.02em", color: "#ffffff", textAlign: "center", textWrap: "balance" } },
          h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 2, endAt + 8], [0, 1], clamp) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1024, width: width - 280, height: 170 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 52, lineHeight: 1.2, color: "#ffffff", textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 6, endAt + 12], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#141414" } }, film, veil, decor, found, loops, extra, ending);
}`;

export const motsMeles: MontageSkill = {
  key: "mots-meles",
  version: 1,
  bpm: BPM,
  shots: [1, 1],
  files: [1, 2],
  how: "Un seul plan calme et fixe, un peu assombri, sous une grille de lettres capitales fines qui couvre tout le cadre, comme un mots mêlés ; les mots de sa phrase y sont cachés dans l'ordre, de haut en bas (en ligne, un en diagonale), parmi d'autres mots de son univers ; un trait blanc fait main entoure un mot puis le suivant, sur le temps, jusqu'à la phrase entière, tenue à la fin.",
  end: true,
  texts: [
    {
      slot: "mots",
      role: "band",
      want: "la phrase cachée dans la grille, 3 à 6 mots séparés par des espaces, entourés un à un dans l'ordre : un moment concret de chez elle, comme on le dirait (une forme comme « samedi matin café croissant », « une coupe et un brushing ») ; des mots de 3 à 9 lettres de préférence, sans chiffres",
      max: 48,
      required: true,
    },
    {
      slot: "autres",
      role: "caption",
      want: "facultatif : 2 ou 3 autres mots de son univers cachés dans la grille sans être entourés, comme dans un vrai mots mêlés (une forme comme « brioche cannelle », « lissage frange ») ; 9 lettres au plus chacun",
      max: 30,
      required: false,
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // One shot under the grid; with an ending card, its time after the hold (the engine's 1,6 s at least, on the
    // half-beat grid, rounded up so a frame lost to rounding never cuts into it).
    const card = end ? Math.ceil(((CARD_SECONDS + 0.05) / beat) * 2) / 2 : 0;
    const spans = beatSpans(bpm, [LENGTH + card]);
    const duration = spans[0]!.end;
    const grid = round(end ? duration - CARD_SECONDS : duration);
    return {
      duration,
      shots: spans.map((s) => ({
        ...s,
        want: `une vidéo calme et fixe de son lieu ou d'elle au travail, d'au moins ${comma(duration)} s, sans coupe ni mouvement de caméra : une grille de lettres la recouvre tout le Reel (l'ambiance compte plus qu'un détail)`,
      })),
      // The grid is there from the first image with her words in it; with an ending card, it dims under it.
      texts: { mots: { from: 0, to: grid }, autres: { from: 0, to: grid } },
      marks: { beat: beat * 30, first: toFrame(FIRST * beat), last: toFrame((LENGTH - HOLD) * beat) },
    };
  },
  code: CODE,
};
