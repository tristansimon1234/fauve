import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Façade qui se construit », the effect (docs/fiches/facade.md, effects 1 to 4; its whole Reel is skills/facade.ts):
// over one still shot of her front, the screen goes black and her front is built on it piece by piece, each piece at
// once and at its exact place, no fade, no edge, never moving again, her video playing in it, each on a note: her sign
// or her door with her name first, then three of her front's elements far from it and from each other, slowly; then a
// burst of twelve, one every 3 to 6 images (her other elements, what stands in front of another first, then the lower
// ones right to left, then the smaller regions of her picture); a short pause; then the big ones a beat apart (the
// street, what is left of the top's left half, all that is still black), and her front plays whole, alive, the camera
// still, nothing written on it, until the montage takes over. Each piece is a shape of HER picture, cut along its own
// edges (v4, Tristan: « le montage devrait détourer la photo pour adapter les formes »): the elements her front is made
// of, named by its filler in a detector's words (« painted door, every window, shop sign, awning »: `@morceaux`; her
// sign: `@enseigne`) and read once on its first image (`still`), each along its own outline; then her picture's regions
// along its edges, by colour (PictureRegions). Rectangles along her front's lines when only her elements were read; the
// cut of every shape of v3 (tall ones, wide ones, flat bands, an arch) only when nothing of her picture was read.
// Kept of its skill: its tools, its order, its proportions, its four rising harp notes and twelve rising plucks (one
// per piece), its optional name (and its line) on a piece of the black while it builds, its format (her front upright
// full frame, her front in width whole in a band across the black, no zoom to fill the screen ever). Its timing is
// the original's (four lone notes about 0,9 s apart, a burst a sixteenth or so apart, a second of silence, three big
// pieces on its music's beats, her front whole about 30 % of the time) set on the Reel's beats, made tighter when its
// span is short (the pause, then the slow notes, then the burst, then the big pieces on half beats) so her front always
// lives a second whole. Its music (v2), as its skill's: silent while it builds (its notes alone), in on its first big
// piece that falls on a beat of the Reel (on half beats, the second or the third). Left to its Reel: her other files
// after it, its ending card.
// Nothing of the original's own (its café, its words, the embossed title that follows it: « Titre gaufré »).

/** The original's pace at its 30 images a second: frames between its slow pieces (images 1, 25, 53, 80). */
const SLOW_FRAMES = 26.3;
/** Its burst (images 85 … 132): the gaps between its twelve pieces, one every 3 to 6 images, 4,27 on average. */
const BURST_GAPS = [5, 4, 3, 3, 4, 5, 5, 4, 6, 4, 4];
const BURST_FRAMES = BURST_GAPS.reduce((s, g) => s + g, 0) / BURST_GAPS.length;
/** Its big pieces a beat apart at its 120 BPM (images 162, 179, 194): a half beat at a slow tempo, where a beat is longer. */
const BIG_MAX_FRAMES = 22;
/** Her front whole and alive at the end, at least this long (frames): a second. */
const MIN_HOLD = 30;
/** A note on each slow piece, rising (the original's four lone notes), and a pluck on each of the burst, rising and louder (its arpeggio). */
const NOTES = ["low soft harp note, long decay", "soft harp note, long decay", "high soft harp note, long decay", "very high soft harp note, long decay"];
const PLUCKS = ["low harp pluck", "harp pluck", "high harp pluck"];

type Pace = { slow: number; burst: number; pause: number; big: number };

/** The frames its 19 pieces land at for a pace: four slow ones from its first image, the burst after them, the big ones on the beat grid. */
function landings(pace: Pace): number[] {
  const slow = [1, ...[1, 2, 3].map((k) => Math.round(k * pace.slow))];
  const burst: number[] = [];
  let at = slow[3]! + pace.burst;
  for (let j = 0; j < 12; j++) {
    burst.push(Math.round(at));
    at += ((BURST_GAPS[j] ?? BURST_FRAMES) * pace.burst) / BURST_FRAMES;
  }
  // Its first big piece on the grid of its big step (its beats, or half beats) at least a pause after the burst.
  const big = Math.ceil((burst[11]! + pace.pause) / pace.big - 1e-6) * pace.big;
  return [...slow, ...burst, Math.round(big), Math.round(big + pace.big), Math.round(big + 2 * pace.big)];
}

/**
 * When its 19 pieces land (frames from its start) for a span and a tempo: the original's pace on the Reel's beats, made
 * tighter step by step until her front lives MIN_HOLD frames whole at the end (the pause, the slow notes on the beat,
 * the burst three images apart, the big pieces on half beats, the slow notes on half beats, half a pause, the burst two
 * images apart, then, at a slow tempo, the big pieces and the slow notes on quarter beats); a span too short even for
 * that (far under its shortest) is scaled into its first 70 %.
 */
export function facadeLandings(frames: number, bpm: number): number[] {
  const beat = (60 / Math.min(140, Math.max(60, bpm))) * 30;
  const half = beat / 2;
  const big = beat <= BIG_MAX_FRAMES ? beat : half;
  const ideal: Pace = {
    slow: half * Math.max(1, Math.round(SLOW_FRAMES / half)),
    burst: beat / Math.max(1, Math.round(beat / BURST_FRAMES)),
    big,
    pause: 2 * big,
  };
  // At a slow tempo, a quarter beat (7,5 images at 60 BPM) still keeps them on the music's grid.
  const quarter = beat / 4;
  const steps: ((p: Pace) => Pace)[] = [
    (p) => ({ ...p, pause: p.big }),
    (p) => ({ ...p, slow: Math.min(p.slow, beat) }),
    (p) => ({ ...p, burst: Math.min(p.burst, 3) }),
    (p) => (p.big > half + 0.01 ? { ...p, big: half, pause: half } : p),
    (p) => ({ ...p, slow: Math.min(p.slow, half) }),
    (p) => ({ ...p, pause: p.big / 2 }),
    (p) => ({ ...p, burst: Math.min(p.burst, 2) }),
    (p) => (quarter >= 6 && p.big > quarter + 0.01 ? { ...p, big: quarter, pause: Math.min(p.pause, quarter) } : p),
    (p) => (quarter >= 6 ? { ...p, slow: Math.min(p.slow, quarter) } : p),
  ];
  const hold = Math.min(MIN_HOLD, Math.round(frames * 0.3));
  let pace = ideal;
  let at = landings(pace);
  for (const step of steps) {
    if (frames - at[18]! >= hold) break;
    pace = step(pace);
    at = landings(pace);
  }
  if (frames - at[18]! >= hold) return at;
  const k = Math.max(0, frames * 0.7) / Math.max(1, at[18]!);
  return at.map((f, i) => (i ? Math.max(1, Math.round(f * k)) : 1));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const D = durationInFrames;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its clip's id, its own (two copies of the effect in one page never share one).
  const CLIP = "fp" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const none = h(AbsoluteFill, { style: { pointerEvents: "none" } });
  // Its shots: those that play during it; her front is the first of them (where its filler named her front's elements).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < D && shots[i].from + shots[i].durationInFrames > 0);
  const seenFor = (i) => Math.min(D, shots[i].from + shots[i].durationInFrames) - Math.max(0, shots[i].from);
  const front = mine.length ? (mine.find((i) => seenFor(i) > 2) ?? mine[0]) : -1;
  if (front < 0) return none;
  const shot = shots[front];

  // When each piece lands (frames from its start), from its timeline: four slowly, twelve in a burst, three big ones on
  // the beat; without it, the original's images in the first 72 % of its span.
  const ORIGINAL = [1, 25, 53, 80, 85, 90, 94, 97, 100, 104, 109, 114, 118, 124, 128, 132, 162, 179, 194];
  const fill = Math.min(1, (D * 0.72) / 194);
  const AT = ORIGINAL.map((d, i) => Math.max(0, mark("piece_" + i, Math.max(i ? 1 : 0, Math.round(d * fill)))));
  const WHOLE = AT[18];

  // 1. Its frame: her front upright full frame as the original (the montage's own framing of her shot, so the cut back
  // to it is seamless), or in width whole in a band across the middle of the black (16:9 when she asks it of an
  // upright one); never zoomed to fill the screen.
  const a = Number(shot.aspect) || 0.5625;
  const format = setting("format", "vertical");
  const band = format === "horizontal" || (format === "auto" && a > 1.15);
  const bw = width;
  const bh = band ? Math.min(height, Math.round(width / (a > 1.15 ? a : 16 / 9))) : height;
  const by = Math.round((height - bh) / 2);
  const laid = { left: 0, top: 0, width: bw, height: bh };
  // Upright, once her front is whole, the montage under it is her front itself: nothing left to draw.
  if (!band && frame >= WHOLE) return none;

  // Read once on its first image here (a still camera, read there by the engine): her sign, then the elements her front
  // is made of, each along its own outline (v4, Tristan: « le montage devrait détourer la photo pour adapter les formes »),
  // and her picture's regions along its own edges (by colour: a wall, a door's frame, a plinth, the pavement).
  const f0 = Math.max(0, Math.round(shot.from));

  // 2. Its pieces, each a shape of her picture (d, its outline) and the box of what the frame shows of it.
  const R = (x0, y0, x1, y1) => ({ x: Math.round(x0), y: Math.round(y0), w: Math.round(x1) - Math.round(x0), h: Math.round(y1) - Math.round(y0) });
  const fit = (b) => { if (!b) return null; const r = R(Math.max(0, b.x), Math.max(0, b.y), Math.min(bw, b.x + b.w), Math.min(bh, b.y + b.h)); return r.w >= bw * 0.02 && r.h >= bh * 0.01 ? { ...r, d: b.d || null, seen: (r.w * r.h) / Math.max(1, b.w * b.h) } : null; };
  const area = (b) => b.w * b.h;
  const inter = (p, q) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
  const inside = (p, q, k) => p !== q && inter(p, q) > k * area(p);
  const sign = fit(SubjectBox(shot, f0, laid, "@enseigne"));
  if (sign) sign.d = SubjectOutline(shot, f0, laid, "@enseigne");
  const parts = SubjectParts(shot, f0, laid, "@morceaux", 0);
  const lone = parts.length ? null : SubjectBox(shot, f0, laid, "@morceaux");
  const found = parts.length ? parts : lone ? [{ ...lone, d: SubjectOutline(shot, f0, laid, "@morceaux") }] : [];
  // Her elements inside the frame, none her sign again; her regions, none an element again (mostly inside its box), none too small to see.
  const elems = found.map(fit).filter((b) => b && !(sign && inside(b, sign, 0.5)));
  const all = sign ? [sign, ...elems] : elems;
  const read = PictureRegions(shot, f0, laid).map(fit).filter((r) => r && area(r) >= 0.004 * bw * bh);
  // A region inside an element's box is that element's (its plants, a painting on it, what its outline left out): it
  // lands with the smallest element that holds it, so no black is left in it.
  const shape0 = (b) => b.d || "M" + b.x + " " + b.y + "h" + b.w + "v" + b.h + "h" + -b.w + "Z";
  const regs = read.filter((r) => {
    const owner = all.filter((e) => inside(r, e, 0.6)).sort((p, q) => area(p) - area(q))[0];
    if (owner) owner.ds = [...(owner.ds || [shape0(owner)]), r.d];
    return !owner;
  });
  const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  // Those far from the ones taken first, the larger ones before, and unlike them in shape (the original's door, window,
  // arched window and awning: a tall piece, a wide one, a flat band; v3, Tristan: « les formes au départ ne sont pas
  // toutes carrées »): what says her place, all over her front.
  const shape = (b) => Math.log(Math.max(1, b.h) / Math.max(1, b.w));
  const spread = (list, firsts, k) => {
    const out = [...firsts];
    const rest = list.filter((b) => !firsts.includes(b));
    const most = Math.max(...list.map(area));
    while (out.length < k && rest.length) {
      let best = 0, score = -1;
      rest.forEach((b, i) => {
        const [x, y] = mid(b);
        const unlike = Math.min(...out.map((p) => Math.abs(shape(b) - shape(p))));
        const d = Math.min(...out.map((p) => Math.hypot(x - mid(p)[0], y - mid(p)[1]))) * (0.5 + 0.5 * Math.sqrt(area(b) / most)) * (0.6 + Math.min(1.2, unlike));
        if (d > score) { score = d; best = i; }
      });
      out.push(rest.splice(best, 1)[0]);
    }
    return { out, rest };
  };
  const row = (b) => Math.round((b.y + b.h) / (0.05 * bh));
  const lowFirst = (p, q) => row(q) - row(p) || q.x - p.x;
  const join = (list) => list.length ? { ...R(Math.min(...list.map((b) => b.x)), Math.min(...list.map((b) => b.y)), Math.max(...list.map((b) => b.x + b.w)), Math.max(...list.map((b) => b.y + b.h))), ds: list.flatMap((b) => b.ds || [shape0(b)]) } : null;
  const B = all.length ? Math.max(...all.map((b) => b.y + b.h)) : Math.round(0.71 * bh);
  const S = Math.round(all.length ? Math.max(0.5 * bh, Math.min(0.9 * bh, B + 0.05 * bh)) : 0.71 * bh);
  let slow, burst, big;
  // Her own shapes when her picture gave enough of them for its rhythm (ten at least, her elements and her regions): never a
  // build stalled on one piece (the boutique's bench of v4: her door alone held 6 s on black, then all of it at once).
  if (all.length + regs.length >= 10) {
    // Her front in its own shapes, as many pieces as her picture has, nothing invented (v4; Tristan: « toujours mettre
    // de l'intelligence », « plus flex »): her sign first (else her largest element), then three of her elements far
    // from it and from each other (her regions of a middle size when she has fewer), each along its own outline; the
    // burst: her other elements (what stands in front of another first, then the lower ones, right to left), then the
    // smaller of her regions, the lower first, spread over its notes when there are fewer; then what is left in two (the
    // street, all that is left of the top's left half), and the rest. Her elements alone when no region was read.
    // (Of her regions, those of her front that the frame shows whole enough: never a sliver at its edge, nor her ground.)
    const some = all.length >= 4 ? all : [...all, ...regs.filter((r) => area(r) >= 0.012 * bw * bh && area(r) <= 0.15 * bw * bh && r.seen >= 0.6 && r.w >= 0.08 * bw && mid(r)[1] < S)];
    const pool = some.length ? some : regs;
    const first = sign || (all.length ? all : pool).reduce((m, b) => (area(b) > area(m) ? b : m));
    const picked = spread(pool, [first], 4);
    slow = picked.out;
    const restE = all.filter((b) => !slow.includes(b));
    const ahead = (b) => restE.some((q) => inside(b, q, 0.7));
    restE.sort((p, q) => Number(ahead(q)) - Number(ahead(p)) || lowFirst(p, q));
    const left = regs.filter((r) => !slow.includes(r)).sort((p, q) => area(p) - area(q));
    const take = Math.max(0, Math.min(12 - Math.min(12, restE.length), left.length - 2));
    burst = [...restE.slice(0, 12), ...left.slice(0, take).sort(lowFirst)];
    // What the burst could not take (her elements too) lands with the last ones: nothing of hers is left out.
    const after = [...restE.slice(12), ...left.slice(take)];
    const street = after.filter((r) => mid(r)[1] >= S);
    const upper = after.filter((r) => !street.includes(r) && mid(r)[0] < bw / 2);
    const others = after.filter((r) => !street.includes(r) && !upper.includes(r));
    big = [join(street.length ? street : after.slice(-1)), join(upper.length ? upper : others.slice(-1))].filter(Boolean);
  } else {
    // Her regions not read (the scene check, a read that failed; rare in production, where they are read on one image
    // of every front, read again when kept without them): her elements first, as many as were found, each along its own
    // outline (her sign first, then those far from it), then the rest of her picture cut as a front is built, in pieces
    // of every shape, never a grid of squares (v3, Tristan: « les formes au départ ne sont pas toutes carrées »), so
    // the build keeps its rhythm: the part above the street split again and again at a random place, most often across
    // its longer side (tall pieces, wide ones, flat bands), laid at random on the same times after her elements; without
    // any, its first four the farthest apart and the most unlike, the tallest topped by an arch, the flattest a band
    // wider at its foot (the original's arched window and awning); then the street, the top's left third, the rest.
    const S2 = Math.round(bh * 0.71);
    const cells = [];
    const want = (bw * S2) / 17;
    const cut = (x, y, w, t, depth) => {
      const r = random("facade-c" + x + "-" + y + "-" + w + "-" + t);
      if (w * t <= want * (0.8 + 0.9 * r) || depth > 6 || Math.min(w, t) < bw * 0.14) return cells.push(R(x, y, x + w, y + t));
      const across = random("facade-d" + x + "-" + y + "-" + depth) < 0.7 ? w >= t : w < t;
      const k = 0.28 + 0.44 * random("facade-t" + x + "-" + y + "-" + w + "-" + depth);
      if (across) {
        const a = Math.round(w * k);
        if (a < bw * 0.07 || w - a < bw * 0.07) return cells.push(R(x, y, x + w, y + t));
        cut(x, y, a, t, depth + 1);
        cut(x + a, y, w - a, t, depth + 1);
      } else {
        const a = Math.round(t * k);
        if (a < bh * 0.04 || t - a < bh * 0.04) return cells.push(R(x, y, x + w, y + t));
        cut(x, y, w, a, depth + 1);
        cut(x, y + a, w, t - a, depth + 1);
      }
    };
    cut(0, 0, bw, S2, 0);
    const mine = all.length ? spread(all, [sign || all.reduce((m, b) => (area(b) > area(m) ? b : m))], 4) : { out: [], rest: [] };
    const picked = spread([...mine.out, ...cells], mine.out.length ? mine.out : [cells[Math.floor(random("facade-first") * cells.length)]], 4);
    slow = picked.out;
    const cutOnes = slow.filter((b) => !all.includes(b));
    if (cutOnes.length) {
      const tall = cutOnes.reduce((m, b) => (shape(b) > shape(m) ? b : m));
      const flat = cutOnes.reduce((m, b) => (shape(b) < shape(m) ? b : m));
      if (shape(tall) > 0.25) tall.d = "M" + tall.x + " " + (tall.y + tall.h) + "L" + tall.x + " " + (tall.y + tall.w / 2) + "A" + tall.w / 2 + " " + tall.w / 2 + " 0 0 1 " + (tall.x + tall.w) + " " + (tall.y + tall.w / 2) + "L" + (tall.x + tall.w) + " " + (tall.y + tall.h) + "Z";
      if (flat !== tall && shape(flat) < -0.6) flat.d = "M" + Math.round(flat.x + 0.05 * flat.w) + " " + flat.y + "L" + Math.round(flat.x + 0.95 * flat.w) + " " + flat.y + "L" + (flat.x + flat.w) + " " + (flat.y + flat.h) + "L" + flat.x + " " + (flat.y + flat.h) + "Z";
    }
    burst = [...mine.rest.sort(lowFirst), ...picked.rest.filter((c) => !all.includes(c)).map((c) => ({ c, k: random("facade-" + c.x + "-" + c.y) })).sort((p, q) => p.k - q.k).map((p) => p.c)].slice(0, 12);
    big = [R(0, S2, bw, bh), R(0, 0, 0.339 * bw, 0.5 * S2)];
  }
  // Each one on its time; a burst of fewer than twelve spread over its twelve notes, its last on the last (v5); each in its own shape (its
  // outline, its region's, or its box when only that was read).
  const pieces = [
    ...slow.map((b, i) => ({ ...b, at: AT[i] })),
    ...burst.map((b, i) => ({ ...b, at: AT[4 + Math.round((i * 11) / Math.max(1, burst.length - 1))] })),
    ...big.map((b, i) => ({ ...b, at: AT[16 + i] })),
  ];

  // 3. Her front on the black, seen through the pieces landed (each at once, at its place, never moving again), her video
  // playing in them; whole from the last one (in its band, to the end; full frame, the montage's own shot).
  const landed = pieces.filter((p) => frame >= p.at);
  const defs = frame < WHOLE
    ? h("svg", { key: "clip", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
        h("clipPath", { id: CLIP, clipPathUnits: "userSpaceOnUse" }, landed.flatMap((p, i) => (p.ds || p.d ? (p.ds || [p.d]).map((d, j) => h("path", { key: i + "-" + j, d, clipRule: "evenodd" })) : [h("rect", { key: i, x: p.x, y: p.y, width: p.w, height: p.h })]))))
    : null;
  const film = landed.length
    ? h("div", { key: "film", style: { position: "absolute", left: 0, top: 0, width: bw, height: bh, ...(frame >= WHOLE ? {} : { clipPath: "url(#" + CLIP + ")" }) } }, h(Footage, { shot: front, style: laid }))
    : null;
  const frameBox = h("div", { key: "front", style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, defs, film);

  // 4. Her optional name (and its line) in white on a piece of the black that stays while her front builds, gone when a
  // piece lands under it: nothing is written on her front. Over the band on the black; full frame, where the black
  // stays longest (each piece it would hide counted for as long as it would hide it): in the upper half, or under the
  // middle over her street (which lands last) when it holds left of the apps' buttons.
  const title = word("nom");
  const line = word("ligne");
  const display = "'" + brand.displayFont + "', 'DM Serif Display', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const count = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  // Its line in small spaced capitals beside her name (an accent of 4 words at most), else a line that reads alone.
  const accent = Boolean(title) && count(line) <= 4;
  const chars = Math.max(4, Array.from(title).length);
  const LS = accent ? 36 : 52;
  const lineW = line ? Array.from(line).length * LS * (accent ? 0.84 : 0.6) + 80 : 0;
  const capH = line ? (accent ? 70 : 86) : 0;
  // A box as wide as its words at most (narrower under the middle, left of the apps' buttons), her name as big as it holds.
  const sized = (most) => {
    const fs = Math.round(Math.max(60, Math.min(118, 820 / (0.62 * chars), (most - 120) / (0.62 * chars))));
    const w = Math.round(Math.max(420, Math.min(most, Math.max(title ? chars * fs * 0.62 + 120 : 0, lineW))));
    return { fs, w, h: Math.round((title ? fs * 1.2 : 0) + capH + 64) };
  };
  const hidden = (b) => pieces.reduce((t, p) => t + inter(b, p) * Math.max(0, WHOLE - p.at), 0);
  const at = (c, most) => { const s = sized(most); return { ...s, x: Math.round((bw - s.w) / 2), y: Math.round(c * height - s.h / 2) }; };
  const spot = band
    ? (() => { const s = sized(bw - 100); return { ...s, x: Math.round((bw - s.w) / 2), y: Math.max(90, Math.round(by / 2 - s.h / 2)) }; })()
    : [...[0.12, 0.2, 0.28, 0.36].map((c) => at(c, bw - 100)), ...(lineW <= 800 ? [0.56, 0.62].map((c) => at(c, 800)) : [])].reduce((m, b) => (hidden(b) < hidden(m) ? b : m));
  // Gone as soon as a piece lands under it (never a black band over her front), 1,5 s after it shows at the earliest,
  // with the last piece at the latest.
  const under = pieces.filter((p) => inter(spot, p) > 0.05 * spot.w * spot.h).map((p) => p.at);
  const gone = Math.min(WHOLE, Math.max(Math.min(...under, WHOLE), AT[0] + 45));
  const nameOn = Boolean(title) && frame >= AT[0] && frame < gone;
  const lineOn = Boolean(line) && frame >= (title ? AT[1] : AT[0]) && frame < gone;
  const lineStyle = accent
    ? { position: "absolute", left: 20, width: spot.w - 40, bottom: 26, height: capH, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: body, fontWeight: 600, fontSize: LS, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap" }
    : { position: "absolute", left: 20, width: spot.w - 40, bottom: 26, height: capH, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: body, fontWeight: 600, fontSize: LS, lineHeight: 1.1, color: "#ffffff", whiteSpace: "nowrap" };
  const label = nameOn || lineOn
    ? h("div", { key: "label", style: { position: "absolute", left: spot.x, top: spot.y, width: spot.w, height: spot.h, backgroundColor: "#000000" } },
        nameOn
          ? h(FitText, { style: { position: "absolute", left: 30, top: 26, width: spot.w - 60, height: spot.h - 52 - capH }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: spot.fs, lineHeight: 1.02, letterSpacing: "0.01em", color: "#ffffff", textAlign: "center", textWrap: "balance" } }, keep(title))
          : null,
        lineOn ? h("div", accent ? { "data-fauve-accent": "", style: lineStyle } : { style: lineStyle }, keep(line)) : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, frameBox, label);
}`;

export const facade: EffectPiece = {
  key: "facade",
  // 3: its skill's v3 pieces (Tristan: « les formes au départ ne sont pas toutes carrées »): its first four far apart and
  // unlike one another, and without her front's elements a cut of every shape, never a grid of near squares.
  // Also 3: vertical full frame by default, as the models, her horizontal shots cropped on their subject; its band only
  // when she asks for it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  // 4: its skill's v4 pieces: each one a shape of her picture cut along its own edges, her front's elements (named as a
  // list, read once on its first image, each along its own outline) then her picture's regions (Tristan: « le montage
  // devrait détourer la photo pour adapter les formes tu vois ? »).
  // 5: its skill's v5: never stalled on one piece; her elements first, then her regions, else the rest of her picture
  // cut at its rhythm.
  version: 5,
  name: "Façade qui se construit",
  how: "l'écran passe au noir et sa devanture s'y construit morceau par morceau, chaque morceau un élément de sa propre image détouré le long de ses bords (sa porte, une fenêtre, son enseigne, puis les pans de son mur, du trottoir), d'un coup à sa place, sa vidéo jouant dedans, un par note : son enseigne d'abord, trois éléments loin l'un de l'autre, une rafale de douze, une courte pause, puis les trois grands sur le temps, et sa devanture entière s'anime, caméra fixe, sans texte, jusqu'à la coupe ; posée en entier dans une bande au milieu du noir quand sa vidéo est horizontale.",
  needs: "une vidéo fixe de sa devanture filmée de face, de l'autre côté de la rue, 5 s au moins : toute la façade dans l'image, son enseigne ou sa porte à son nom bien visible, faite d'éléments qu'on reconnaît seuls (fenêtres, vitrine, store, tables), un peu de vie devant.",
  lays: "sur un seul plan, sa devanture, dès le début du plan",
  shots: [1, 1],
  seconds: [5, 9],
  require: { files: 1, shot: { framing: ["wide"], still: true, outdoors: true } },
  texts: [
    {
      slot: "nom",
      want: "son nom (ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), en blanc sur un morceau du noir pendant que sa devanture se construit, parti au plus tard avec le dernier morceau ; rien ne s'écrit sur sa devanture entière",
      max: 20,
      required: false,
    },
    {
      slot: "ligne",
      want: "2 à 4 petits mots en capitales espacées sous son nom, sur le même noir : son métier et son quartier, une date (une forme comme « librairie · brick lane », « depuis 1998 »)",
      max: 28,
      required: false,
    },
  ],
  objects: [
    {
      slot: "morceaux",
      shot: 0,
      want: "les éléments dont sa devanture est faite, qui apparaissent un à un sur le noir, chacun détouré : tous ceux qu'on voit sur son plan, séparés par des virgules, chacun en mots simples qu'un détecteur trouve, « every » devant ce qui se répète : sa porte (« door », « painted door »), ses fenêtres et les pans de sa vitrine (« every window »), ses volets (« every shutter »), son enseigne (« shop sign »), son store (« awning »), ses pots de fleurs, ses tables, ses lanternes (« every plant pot », « every table », « every lantern ») ; une forme comme « painted door, every window, every shutter, shop sign, awning, every plant pot » ; « none » quand on ne voit pas sa devanture",
      still: true,
    },
    {
      slot: "enseigne",
      shot: 0,
      want: "ce qui dit son nom sur sa devanture et apparaît seul en premier sur le noir : son enseigne, sa porte avec son nom peint sur la vitre, son store à son nom (« shop sign », « door », « painted window lettering », « awning ») ; « none » quand on ne voit pas son nom",
      still: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, horizontal sur du noir, ou comme sa vidéo de devanture",
      choices: [
        { value: "vertical", says: "vertical plein écran : une vidéo horizontale cadrée comme le reste du montage (on perd la largeur de sa devanture)" },
        { value: "horizontal", says: "horizontal : sa devanture dans une bande 16:9 au milieu du noir", band: true },
        { value: "auto", says: "comme sa vidéo de devanture : en plein écran si elle est verticale, posée en entier dans une bande au milieu du noir si elle est horizontale" },
      ],
    },
  ],
  timeline({ frames, bpm }: PieceTimelineInput): PieceTimeline {
    const at = facadeLandings(frames, bpm);
    const s = (f: number) => Math.round((f / 30) * 1000) / 1000;
    // Her music silent while it builds, in on its first big piece that falls on a whole beat of the Reel (a silence ending
    // off the beat would move her music off the cuts: on half beats, the second or the third), else on the beat before it.
    const beat = (60 / Math.min(140, Math.max(60, bpm))) * 30;
    const onBeat = (f: number) => Math.abs(f - Math.round(f / beat) * beat) <= 0.6;
    const back = at.slice(16).find(onBeat) ?? Math.floor(at[16]! / beat) * beat;
    return {
      ...(back > at[15]! && back >= 15 ? { music: { pauses: [{ from: 0, to: s(back) }] } } : {}),
      marks: Object.fromEntries(at.map((f, i) => [`piece_${i}`, f])),
      // A note on each piece as it lands (the original's four lone notes rising, then its arpeggio, louder as it climbs);
      // its three big pieces fall on the Reel's music, as the original's on its first chords.
      sounds: [
        ...NOTES.map((sound, i) => ({ at: s(at[i]!), sound, seconds: 1.5 })),
        ...at.slice(4, 16).map((f, i) => ({ at: s(f), sound: PLUCKS[Math.min(2, Math.floor(i / 4))]!, seconds: 0.5, ...(i < 11 ? { gain: Math.round((-6 + (6 * i) / 11) * 100) / 100 } : {}) })),
      ],
    };
  },
  code: CODE,
};
