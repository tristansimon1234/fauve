import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Façade qui se construit », version 4, written on its original's fiche (docs/fiches/facade.md: measured image
// by image at 30 i/s and piece by piece, its notes heard, its music measured; Tristan: « c'est un effet que l'on veut
// pouvoir faire, pas exactement reproduire l'image »). Its music has no tempo while the front builds (four lone notes, a
// rising arpeggio, a second of silence), then 120 BPM from its first chord (Gemini heard 115, v1 counted 84); every
// length below is in beats of 120 BPM from the first image, so its pieces land on the original's own images and its
// three big ones on the beats of its music:
//   0 – 2,7   on pure black, her front piece by piece, each at once and at its exact place, her video playing in it,
//             each on a note: her sign or her door with her name first (image 1), then three of her front's elements far
//             from it and from each other (images 25, 53, 80), as the original's door, window, upper window and awning;
//   2,8 – 4,4 a burst of twelve, one every 3 to 6 images, each on a rising harp pluck: her other elements (what stands
//             in front of another first, then the lower ones, right to left), then the smaller regions of her picture;
//   4,4 – 5,4 nothing new: its silence;
//   5,4 – 6,5 the music comes in: the street (its regions at the bottom), what is left of the top's left half, then all
//             that is still black, a hair before its first three beats as the original's before its chords;
//   6,5 – 9   her front whole, still camera, no text, no zoom; the cut on the beat, her other files a bar each.
// Each piece is a shape of HER picture, cut along its own edges, as the original's are its own front's (v4, Tristan, on
// the bench of a painted shop door: « le montage devrait détourer la photo pour adapter les formes ») : the elements her
// front is made of, named by the filler in a detector's words (« painted door, every window, shop sign, awning »:
// `@morceaux`; her sign: `@enseigne`) and read by the engine once on its first image (a still camera: `still`), each along
// its own outline; then her picture's regions, split along its own edges by colour (PictureRegions: a wall, a door's
// frame, a plinth, the pavement, the sky), for all the rest: as many pieces as her picture has, nothing invented
// (Tristan: « toujours mettre de l'intelligence »), the geometric cut of v3 only when nothing of her picture was read. Its format follows her front (Tristan: « format par défaut
// [comme ses vidéos], et changement à la demande du user »): vertical full frame as the original, or her horizontal
// front whole in a band across the middle of the black. Her photos stay still, her videos play. Nothing is written on
// her front: her optional name sits on a piece of the black while it builds and goes with the last piece. Nothing of the
// original's own is copied (its café, its words, the embossed title that follows it: « Titre gaufré », its own model).

const BPM = 120;
/** Her front's pieces, in beats from the first image: the original's images 1, 25, 53 and 80, then 85 … 132 (30 i/s). */
const SLOW = [0.067, 1.667, 3.533, 5.333];
const BURST = [5.667, 6, 6.267, 6.467, 6.667, 6.933, 7.267, 7.6, 7.867, 8.267, 8.533, 8.8];
/**
 * Its three big pieces: 0,2, 0,07 and 0,07 beat before our music's beats 11, 12 and 13, as the original's before its
 * chords (its music's grid falls 0,72 beat later than ours, whose first beat is the first image: they land 4 images after
 * the original's own 158, 175 and 190).
 */
const BIG = [10.796, 11.928, 12.928];
/** Its music comes in on beat 11 (its first big piece); her front plays whole to beat 18 (9 s), the cut. */
const ENTRY = 11;
const FRONT = 18;
/**
 * Her other files after it, a bar each; up to this many shots for a length she asks for (23 s at its own tempo, 30 s a
 * little slower): her front's 9 s take most of a video, and her files give three passages each at most.
 */
const BAR = 4;
const LONG = 8;
/** The engine's ending card: the Reel's last 1,6 s, on the black after the last shot (half beats, a few images of black first). */
const END_CARD = 1.6;
/** A note on each slow piece, rising (the original's four lone notes), and a pluck on each of the burst, rising and louder (its arpeggio). */
const NOTES = ["low soft harp note, long decay", "soft harp note, long decay", "high soft harp note, long decay", "very high soft harp note, long decay"];
const PLUCKS = ["low harp pluck", "harp pluck", "high harp pluck"];
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its clip's id, its own (two copies of the scene in one page never share one).
  const CLIP = "fc" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  // When each piece lands (images): four slowly, twelve in a burst, three big ones on the music's first beats.
  const AT = [1, 25, 53, 80, 85, 90, 94, 97, 100, 104, 109, 114, 118, 124, 128, 132, 162, 179, 194].map((d, i) => mark("piece_" + i, d));
  const WHOLE = AT[18];
  const BLACK = mark("black", durationInFrames + 1);
  const front = shots[0];
  const FRONT_END = n > 1 ? shots[1].from : BLACK;
  const endAt = end ? end.from : durationInFrames + 1;

  // 1. Its frame: vertical full frame as the original when her front is upright (or she asks), else her horizontal
  // front whole in a band across the middle of the black (16:9 when she asks it of an upright one); never zoomed.
  const a = front ? Number(front.aspect) || 0.5625 : 0.5625;
  const format = setting("format", "vertical");
  const band = format === "horizontal" || (format === "auto" && a > 1.15);
  const bw = width;
  const bh = band ? Math.min(height, Math.round(width / (a > 1.15 ? a : 16 / 9))) : height;
  const by = Math.round((height - bh) / 2);
  const box = { left: 0, top: 0, width: bw, height: bh };
  // Her front as the frame shows it: covering it; full frame from a horizontal video (on her word), its whole picture at
  // the frame's height, the part around her sign shown (the width of her front lost, never zoomed).
  const f0 = front ? front.from : 0;
  const W = !band && a > 1.15 ? Math.round(bh * a) : bw;
  const whole = { left: 0, top: 0, width: W, height: bh };
  // Read once on its first image (a still camera, read there by the engine): her sign, then the elements her front is
  // made of, each along its own outline (v4, Tristan: « le montage devrait détourer la photo pour adapter les formes »),
  // and her picture's regions along its own edges (by colour: a wall, a door's frame, a plinth, the pavement).
  const signAt = SubjectBox(shots[0], f0, whole, "@enseigne");
  const fx = front && front.focus && Number.isFinite(front.focus.x) ? front.focus.x : 0.5;
  const off = W > bw ? Math.round(Math.max(0, Math.min(W - bw, (signAt ? signAt.x + signAt.w / 2 : fx * W) - bw / 2))) : 0;
  const laid = { left: off ? -off : 0, top: 0, width: W, height: bh };

  // 2. Its pieces, each a shape of her picture (d, its outline) and the box of what the frame shows of it.
  const R = (x0, y0, x1, y1) => ({ x: Math.round(x0), y: Math.round(y0), w: Math.round(x1) - Math.round(x0), h: Math.round(y1) - Math.round(y0) });
  const fit = (b) => { if (!b) return null; const r = R(Math.max(0, b.x), Math.max(0, b.y), Math.min(bw, b.x + b.w), Math.min(bh, b.y + b.h)); return r.w >= bw * 0.02 && r.h >= bh * 0.01 ? { ...r, d: b.d || null, seen: (r.w * r.h) / Math.max(1, b.w * b.h) } : null; };
  const area = (b) => b.w * b.h;
  const inter = (p, q) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
  const inside = (p, q, k) => p !== q && inter(p, q) > k * area(p);
  const sign = fit(SubjectBox(shots[0], f0, laid, "@enseigne"));
  if (sign) sign.d = SubjectOutline(shots[0], f0, laid, "@enseigne");
  const parts = SubjectParts(shots[0], f0, laid, "@morceaux", 0);
  const lone = parts.length ? null : SubjectBox(shots[0], f0, laid, "@morceaux");
  const found = parts.length ? parts : lone ? [{ ...lone, d: SubjectOutline(shots[0], f0, laid, "@morceaux") }] : [];
  // Her elements inside the frame, none her sign again; her regions, none an element again (mostly inside its box), none too small to see.
  const elems = found.map(fit).filter((b) => b && !(sign && inside(b, sign, 0.5)));
  const all = sign ? [sign, ...elems] : elems;
  const read = PictureRegions(shots[0], f0, laid).map(fit).filter((r) => r && area(r) >= 0.004 * bw * bh);
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
    // Built as a front is, and as its original builds its own (v6, Tristan: « une règle de construire de manière
    // cohérente »): first its large openings at their places in her front, each a real piece, never a sliver (her sign
    // or her door when large, a window, an opening up high, her awning: the original's door, window, arched window and
    // awning); then what links them, from the ground floor up, each piece against what is already there (never one
    // floating far from the rest); then its sides going up; the street and what lies outside her front last. As many
    // pieces as her picture has, nothing invented (Tristan: « toujours mettre de l'intelligence »).
    const solid = (b) => area(b) >= 0.015 * bw * bh && b.seen >= 0.5 && b.w >= 0.05 * bw && b.h >= 0.04 * bh;
    // Her street: what lies below the foot of her elements (her doors, her shop window), else below the street line.
    const ground = (b) => mid(b)[1] >= (all.length ? B : S);
    // Her front: the box of her elements (else of her regions above the street), a little wider.
    const core = all.length ? all : regs.filter((r) => !ground(r));
    const M = core.length ? R(Math.min(...core.map((b) => b.x)) - 0.1 * bw, Math.min(...core.map((b) => b.y)) - 0.05 * bh, Math.max(...core.map((b) => b.x + b.w)) + 0.1 * bw, Math.max(...core.map((b) => b.y + b.h)) + 0.05 * bh) : R(0, 0, bw, S);
    const within = (b) => { const [x, y] = mid(b); return x >= M.x && x <= M.x + M.w && y >= M.y && y <= M.y + M.h; };
    // Its openings: her large elements, then (when fewer than four) her large regions on her front, then any above the street.
    const tiers = [all.filter(solid), regs.filter((r) => solid(r) && !ground(r) && within(r) && area(r) <= 0.15 * bw * bh), regs.filter((r) => solid(r) && !ground(r)), [...all, ...regs].sort((p, q) => area(q) - area(p))];
    const pool = [];
    for (const t of tiers) if (pool.length < 4) for (const b of t) if (!pool.includes(b)) pool.push(b);
    // The first: her largest opening on the ground floor (a door, a shop window: the original's door with its name), else
    // her sign when it is a real piece, else her largest.
    const floor = all.filter((b) => solid(b) && b.y + b.h >= B - 0.12 * bh);
    const largest = (list) => list.reduce((m, b) => (area(b) > area(m) ? b : m));
    const first = floor.length ? largest(floor) : sign && solid(sign) ? sign : largest(pool);
    const picked = spread(pool.includes(first) ? pool : [first, ...pool], [first], 4);
    slow = picked.out;
    // Then, one at a time, the piece next to what is already there (the nearest when none touches it), the lower first,
    // right to left; a piece cut by the frame's edge, the street and what lies outside her front kept for the end.
    const gap = (p, q) => Math.max(0, Math.max(p.x, q.x) - Math.min(p.x + p.w, q.x + q.w), Math.max(p.y, q.y) - Math.min(p.y + p.h, q.y + q.h));
    const rest = [...all, ...regs].filter((b) => !slow.includes(b));
    const late = rest.filter((b) => ground(b) || !within(b) || b.seen < 0.5);
    const todo = rest.filter((b) => !late.includes(b));
    const placed = [...slow];
    const near = (b) => { const n = Math.min(...placed.map((q) => gap(b, q))); return n <= 0.02 * bh ? 0 : n; };
    // (What stands in front of a piece already there first: a plant pot before her door, as the original's people before its shop.)
    const ahead = (b) => placed.some((q) => inside(b, q, 0.7));
    burst = [];
    while (burst.length < 12 && todo.length) {
      todo.sort((p, q) => near(p) - near(q) || Number(ahead(q)) - Number(ahead(p)) || lowFirst(p, q));
      const b = todo.shift();
      burst.push(b);
      placed.push(b);
    }
    // What the burst could not take (her elements too) lands with the last ones: nothing of hers is left out.
    const after = [...todo, ...late];
    const street = after.filter(ground);
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
  // playing in them; whole from the last one. Her other files after it, as filmed, cut on the beat; black at the end.
  const landed = pieces.filter((p) => frame >= p.at);
  const defs = frame < WHOLE
    ? h("svg", { key: "clip", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
        h("clipPath", { id: CLIP, clipPathUnits: "userSpaceOnUse" }, landed.flatMap((p, i) => (p.ds || p.d ? (p.ds || [p.d]).map((d, j) => h("path", { key: i + "-" + j, d, clipRule: "evenodd" })) : [h("rect", { key: i, x: p.x, y: p.y, width: p.w, height: p.h })]))))
    : null;
  const film = front && frame < Math.min(FRONT_END, BLACK)
    ? h("div", { style: { position: "absolute", left: 0, top: 0, width: bw, height: bh, ...(frame >= WHOLE ? {} : { clipPath: "url(#" + CLIP + ")" }) } }, h(Footage, { shot: 0, style: laid }))
    : n > 1 && frame < BLACK ? h(Footage, { shot: cur, style: box }) : null;

  // 4. Her optional name (and its line) on a piece of the black that stays while her front builds, taken away with the
  // last piece: nothing is written on her front. Over the band on the black; full frame where the black stays longest
  // (each piece it would hide counted for as long as it would hide it), the upper one first.
  const hook = reelTexts.find((t) => t.role === "hook");
  const cap = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== cap);
  const display = "'" + brand.displayFont + "', 'DM Serif Display', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const on = (t) => t && frame >= t.from && frame < Math.min(t.to, WHOLE, endAt);
  const chars = Math.max(4, String(hook ? hook.text : "").length);
  const FS = Math.round(Math.max(72, Math.min(118, 820 / (0.62 * chars))));
  const LW = Math.round(Math.max(420, Math.min(bw - 100, chars * FS * 0.62 + 120)));
  const capH = cap ? 70 : 0;
  const LH = Math.round((hook ? FS * 1.2 : 0) + capH + 64);
  const hidden = (b) => pieces.reduce((t, p) => t + inter(b, p) * (WHOLE - p.at), 0);
  const spot = band
    ? { x: Math.round((bw - LW) / 2), y: Math.max(90, Math.round(by / 2 - LH / 2)) - by, w: LW, h: LH }
    : [0.12, 0.22, 0.32, 0.42, 0.52].map((c) => ({ x: Math.round((bw - LW) / 2), y: Math.round(c * height - LH / 2), w: LW, h: LH })).reduce((m, b) => (hidden(b) < hidden(m) ? b : m));
  const label = on(hook) || on(cap)
    ? h("div", { key: "label", style: { position: "absolute", left: spot.x, top: by + spot.y, width: LW, height: LH, backgroundColor: "#000000" } },
        hook && on(hook)
          ? h(FitText, { style: { position: "absolute", left: 30, top: 26, width: LW - 60, height: LH - 52 - capH }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: FS, lineHeight: 1.02, letterSpacing: "0.01em", color: "#ffffff", textAlign: "center", textWrap: "balance" } }, keep(hook.text))
          : null,
        cap && on(cap)
          ? h("div", { "data-fauve-accent": "", style: { position: "absolute", left: 20, width: LW - 40, bottom: 26, height: capH, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: body, fontWeight: 600, fontSize: 36, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap" } }, keep(cap.text))
          : null)
    : null;

  // 5. Its ending card, when she has one (an option: the original has none): on the black after the last shot, its
  // words at once in white, its line just after.
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 620 : 720, width: width - 280, height: 280 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 108, lineHeight: 1.02, color: "#ffffff", textAlign: "center", textWrap: "balance", justifyContent: end.subtitle ? "flex-end" : "center" } }, keep(end.title)),
        end.subtitle && frame >= endAt + 4
          ? h(FitText, { style: { position: "absolute", left: 140, top: 924, width: width - 280, height: 170 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 44, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", textWrap: "balance", justifyContent: "flex-start" } }, keep(end.subtitle))
          : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: band ? Math.min(1300, by + bh + 40 + i * 120) : 1220 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, defs, film);
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, label, extra, ending);
}`;

export const facade: MontageSkill = {
  key: "facade",
  // 2: written again on its original's fiche: its tempo (120 BPM, none while it builds), its pieces on its images and
  // on its notes (four slow, a burst of twelve, a silence, three big on its music's first beats), her front's own
  // elements named by the filler, its format, nothing written on her front, its music coming in late and cut dead.
  // 3: its first pieces unlike one another (Tristan: « pas tout à fait la même chose, les formes au départ ne sont pas
  // toutes carrées »): far apart and of different shapes, and without her front's elements its picture cut as a front
  // is built (tall pieces, wide ones, flat bands, an arch, a band wider at its foot), never a grid of near squares.
  // Also 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  // 4: each piece one element of HER picture cut out along its own outline, as the original's are its front's (Tristan, on
  // the bench of a painted shop door: « le montage devrait détourer la photo pour adapter les formes tu vois ? »): her
  // front's elements named as a list a detector finds and read once on its first image (`still`: one image of the card,
  // every piece with its own outline), then her picture's regions along its own edges for the rest (PictureRegions);
  // the geometric cut only when nothing of her picture was read.
  // 5: never stalled on one piece (its production bench of v4: her door alone held 6 s on black, then all of it at
  // once): her own shapes when ten at least were read, her elements and her regions; fewer, her elements first, then
  // the rest of her picture cut at its rhythm. Her regions read again on a video kept without them.
  // 6: built coherently, as its original (Tristan, on the librairie's bench: « peut-être une règle de construire de
  // manière cohérente »; its small sign had stayed 4 s alone on black, slivers at the frame's edge after it): its large
  // openings first, at their places, then each piece against what is already there from the ground floor up, the
  // street and what lies outside her front last.
  version: 6,
  bpm: BPM,
  shots: [1, 3],
  long: LONG,
  files: [1, 3],
  how: "Sur un écran noir, sa devanture se construit morceau par morceau, chaque morceau un élément de sa propre image détouré le long de ses bords (sa porte, une fenêtre, un volet, son enseigne, son store, un pot de fleurs, puis les pans de son mur, de son soubassement, du trottoir), d'un coup à sa place, sa vidéo jouant dedans, chacun sur une note : d'abord son enseigne ou sa porte avec son nom, puis trois éléments loin l'un de l'autre, lentement ; puis une rafale de douze morceaux (ses autres éléments, puis les pans de son image) ; un silence ; puis la musique entre avec les plus grands (la rue, le haut, tout le reste) et sa devanture joue en entier, caméra fixe, sans texte ; ses autres fichiers suivent, une mesure chacun. En vertical plein écran, une vidéo horizontale recadrée autour de son enseigne ; posée en entier dans une bande au milieu du noir à sa demande.",
  end: true,
  texts: [
    {
      slot: "nom",
      role: "hook",
      want: "facultatif : son nom (ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), en blanc sur un morceau du noir pendant que sa devanture se construit, parti avec le dernier morceau ; rien ne s'écrit sur sa devanture entière",
      max: 20,
      required: false,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : 2 à 4 petits mots en capitales espacées sous son nom, sur le même noir : son métier et son quartier, une date (une forme comme « librairie · brick lane », « depuis 1998 »)",
      max: 28,
      required: false,
    },
  ],
  objects: [
    {
      slot: "morceaux",
      shot: 0,
      want: "les éléments dont sa devanture est faite, qui apparaissent un à un sur le noir, chacun détouré : tous ceux qu'on voit sur sa vidéo, séparés par des virgules, chacun en mots simples qu'un détecteur trouve, « every » devant ce qui se répète : sa porte (« door », « painted door »), ses fenêtres et les pans de sa vitrine (« every window »), ses volets (« every shutter »), son enseigne (« shop sign »), son store (« awning »), ses pots de fleurs, ses tables, ses lanternes, ses vélos, ses clients (« every plant pot », « every table », « every lantern », « every bicycle », « every person ») ; une forme comme « painted door, every window, every shutter, shop sign, awning, every plant pot » ; vide quand on ne voit pas sa devanture",
      still: true,
    },
    {
      slot: "enseigne",
      shot: 0,
      want: "ce qui dit son nom sur sa devanture et apparaît seul en premier sur le noir : son enseigne, sa porte avec son nom peint sur la vitre, son store à son nom (« shop sign », « door », « painted window lettering », « awning ») ; vide quand on ne voit pas son nom",
      still: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, sa devanture entière dans une bande 16:9 sur du noir, ou comme sa vidéo de devanture",
      choices: [
        { value: "vertical", says: "vertical plein écran, comme l'original : une vidéo horizontale coupée autour de son enseigne (on perd la largeur de sa devanture)" },
        { value: "horizontal", says: "horizontal : sa devanture dans une bande 16:9 au milieu du noir", band: true },
        { value: "auto", says: "comme sa vidéo de devanture : vertical plein écran si elle est verticale, posée en entier dans une bande au milieu du noir si elle est horizontale" },
      ],
    },
  ],
  // Its original's grade (its fiche, effect 5): bright and natural, no grain, its ground a pure black (no fade lifting it).
  finish: { grain: 0, vignette: 0, fade: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(1, Math.min(LONG, Math.round(n)));
    // Her front, then her other files a bar each; with an ending card, the black that carries it after the last shot.
    const black = end ? Math.ceil(((END_CARD + 0.05) / beat) * 2) / 2 : 0;
    const beats = [FRONT, ...Array.from({ length: count - 1 }, () => BAR)].map((b, i) => (i === count - 1 ? b + black : b));
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const blackAt = toFrame((FRONT + BAR * (count - 1)) * beat);
    const frames = [...SLOW, ...BURST, ...BIG].map((b) => toFrame(b * beat));
    const at = (f: number) => round3(f / 30);
    const wants = [
      "sa devanture filmée de face, de l'autre côté de la rue, le téléphone posé (sans zoom ni mouvement), 9 s au moins : toute la façade dans l'image, du trottoir au toit avec un peu de ciel, son enseigne ou sa porte avec son nom bien visible, un peu de vie devant ; elle se construit morceau par morceau sur le noir, puis joue en entier",
      ...Array.from({ length: count - 1 }, (_, i) =>
        i === count - 2
          ? "le dernier plan, calme, tenu jusqu'à la fin : l'intérieur de son lieu, son travail ou un détail qui finit bien"
          : "un plan de son lieu juste après sa devanture : l'intérieur, un geste, ses produits",
      ),
    ];
    // A note on each piece as it lands (the original's four lone notes rising, then its arpeggio, louder as it climbs).
    const sounds: SkillSound[] = [
      ...SLOW.map((_, i) => ({ at: at(frames[i]!), sound: NOTES[i]!, seconds: 1.5 })),
      ...BURST.map((_, i) => ({ at: at(frames[4 + i]!), sound: PLUCKS[Math.min(2, Math.floor(i / 4))]!, seconds: 0.5, ...(i < 11 ? { gain: round(-6 + (6 * i) / 11) } : {}) })),
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her optional name with the first piece, its line with the second; both go with the last piece.
      texts: { nom: { from: round(frames[0]! / 30), to: round(frames[18]! / 30) }, ligne: { from: round(frames[1]! / 30), to: round(frames[18]! / 30) } },
      marks: { ...Object.fromEntries(frames.map((f, i) => [`piece_${i}`, f])), black: end ? blackAt : toFrame(duration) + 1 },
      sounds,
      // Silent while her front builds (its notes alone, then the silence), in on beat 11 with its first big piece (Tristan,
      // of its originals' pauses: « oui pourquoi pas si c'est bien fait »), cut dead with the last image: the Reel loops
      // back to the black and its first note.
      music: { pauses: [{ from: 0, to: round3(ENTRY * beat) }], end: { at: duration } },
    };
  },
  code: CODE,
};
