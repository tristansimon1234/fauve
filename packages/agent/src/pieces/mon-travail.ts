import type { EffectPiece, PieceTimeline } from "../pieces.ts";

// « Voici mon travail », the effect (its whole Reel is skills/mon-travail.ts, written on docs/fiches/mon-travail.md,
// effects 1 to 5; Tristan's idea): over a run of her shots, the first one is her, standing in her place, full frame and
// still, her words in very big capitals behind her (v3: her cut-out over their letters; Tristan on its skill's v1: « la
// police passe pas derrière la dame »); the others are photos of her work, laid at once behind her in a
// burst down the frame in a zigzag (the original's boxes, square, no border, no shadow, never moving), slower and slower
// for the last ones, the very last ones in front of her legs; she stays cut out in front of them. They leave at once, one
// by one from the top in the order they came, from about halfway to the hit (the original's top leaves while its last
// ones land: never a full collage held long), the second-last on a whole beat (a dry knock), the last a third of a beat
// after; then she is alone with her words, and the montage takes over. Its shots are cut a beat each by the editor; the
// effect covers them all and lays its works at its own pace (a photo stays still whenever it is drawn), faster than one a
// beat. What it keeps of its skill: the boxes and their sizes, the burst and its slowing gaps (in beats), the works that
// leave in order, her cut-out between the two layers of the collage, her words one a line off her face, her colour or a
// pale tint of it, its clicks and its knock (on the landings, as they slow down). What it leaves: the Reel's own length
// (its stays of 8 beats become what the span holds), its ending card. Its music (v2): without its bass after the hit, to
// the cut, as its skill's; its clicks one burst, however many. Its words' colour
// is chosen against the light of her shot under each line (LightUnder): hers when it reads, else a pale or deep tint of
// it, else white or ink with a firm edge (v4); unread, hers as the skill draws it, white over her body. Her words behind
// her only when every line still reads there, else beside or above her where her shot is calm (ClearBox), else over her
// under her face. A work behind her that her silhouette would hide for the most part moves toward the nearer side, else
// comes in front of her below her chin; without her cut-out, her works keep off her face, or off the middle.

/** The first work lands at the original's image 3 (beats); the burst after it at its cadence (beats a landing). */
const FIRST = 0.2;
const STEP = 0.18;
/** The gaps before its nine last works in the original (beats: its 4, 5, 4, 6, 6, 6, 7, 9 and 7 images, a beat being 15). */
const SLOWING = [4, 5, 4, 6, 6, 6, 7, 9, 7].map((f) => f / 15);
/**
 * The burst stretched or tightened so its last work lands about halfway to the hit, as the original's (8,6 of 16 beats),
 * within these bounds of its cadence: a span that holds more keeps a frantic burst and holds the full collage longer.
 */
const LANDED_AT = 0.5;
const STRETCH: [number, number] = [0.6, 1.3];
/** Its leaving at most this many times slower than its burst: a span that holds more starts leaving later. */
const LEAVE_STRETCH = 3;
/** The last work leaves this long after the hit (beats: the original's 5 images). */
const LAST_AFTER = 1 / 3;
/** Her alone with her words after the last one leaves, at least (beats). */
const ALONE = 1.5;
/** The works from this share of the collage on pass in front of her (the original's last six of 37, low, over her legs). */
const FRONT = 31 / 36;
/** Its sounds: a light click on each landing (the ratchet that slows down), the dry knock on the hit. */
const CLICK = { sound: "light click", seconds: 0.5 };
const KNOCK = { sound: "dry knock", seconds: 0.5, gain: 6 };
/** Two clicks at least this far apart (frames): a burst denser than that is one ratchet, not a click a work. */
const CLICK_GAP = 3;

/**
 * Its schedule over a span of `frames` at a tempo, for `works` works after her shot (frames from its start): when each
 * one lands and leaves, its hit (the second-last leaves on it, a whole beat), the first that passes in front of her.
 */
export function travailLine(frames: number, bpm: number, works: number): { lands: number[]; leaves: number[]; hit: number; front: number } {
  const B = (60 / bpm) * 30;
  const m = Math.max(0, works);
  if (!m) return { lands: [], leaves: [], hit: 0, front: 0 };
  // The collage empty on the last whole beat that leaves her alone with her words long enough after the last one goes.
  const latest = Math.floor((frames - LAST_AFTER * B - ALONE * B) / B) * B;
  // Its gaps at the original's cadence: the burst, then its slowest gaps spread over the last third of its works.
  const slow = Math.min(SLOWING.length, Math.ceil((m - 1) / 3));
  const gaps = Array.from({ length: m - 1 }, (_, k) => {
    const i = k - (m - 1 - slow);
    if (i < 0) return STEP;
    return slow === 1 ? SLOWING[SLOWING.length - 1]! : SLOWING[Math.round((i * (SLOWING.length - 1)) / (slow - 1))]!;
  });
  const total = gaps.reduce((a, b) => a + b, 0) * B;
  const first = FIRST * B;
  // Stretched so its last lands about halfway to the hit, never closer than a beat to it.
  const hit = Math.max(latest, Math.ceil((first + total * STRETCH[0] + B) / B) * B);
  const room = hit - B - first;
  const c = total > 0 ? Math.max(0.3, Math.min(STRETCH[1], Math.max(STRETCH[0], (hit * LANDED_AT - first) / total), room / total)) : 1;
  const lands: number[] = [];
  let at = first;
  for (let k = 0; k < m; k++) {
    if (k > 0) at += gaps[k - 1]! * c * B;
    lands.push(Math.max(k ? lands[k - 1]! + 1 : 0, Math.round(at)));
  }
  // They leave from the top in the order they came, the second-last on the hit and the last a third of a beat after
  // it: the burst played again, stretched (one to three times) from about halfway to the hit, as the original's top
  // leaves while its last ones land, so the full collage is never held long; each one a beat at least, one an image.
  const H = Math.round(hit);
  const reach = m > 1 ? lands[m - 2]! - lands[0]! : 0;
  const start = Math.max(lands[m - 1]! + Math.round(B / 2), Math.round(H * LANDED_AT));
  const d = reach > 0 ? Math.max(1, Math.min(LEAVE_STRETCH, (H - start) / reach)) : 1;
  const from = H - d * reach;
  const leaves = lands.map((f, k) => (k === m - 1 ? Math.round(H + (m > 1 ? LAST_AFTER * B : 0)) : k === m - 2 ? H : Math.round(from + (f - lands[0]!) * d)));
  for (let k = 0; k < m - 2; k++) leaves[k] = Math.min(H - (m - 2 - k), Math.max(leaves[k]!, lands[k]! + Math.round(B), k ? leaves[k - 1]! + 1 : 0));
  const front = m > 1 ? Math.ceil(FRONT * (m - 1) - 1e-9) : m;
  return { lands, leaves, hit: H, front };
}

/** A click's gain (dB): soft in the dense burst, louder as the landings slow down. */
const clickGain = (gap: number, B: number) => Math.round(Math.max(-12, Math.min(0, -12 + (12 * (gap - CLICK_GAP)) / Math.max(1, 0.5 * B - CLICK_GAP))) * 10) / 10;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const F = durationInFrames;
  const mark = (k, d) => { const v = Number(texts && texts[k]); return texts && texts[k] !== undefined && Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its shots: those that play during it (a sliver of a frame at an edge left out), in order: hers, then her works.
  const seen = (i) => Math.min(F, shots[i].from + shots[i].durationInFrames) - Math.max(0, shots[i].from);
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < F && shots[i].from + shots[i].durationInFrames > 0 && seen(i) >= 2);
  if (!mine.length) return null;
  const her = mine[0];
  const works = mine.slice(1);
  const m = works.length;
  const B = mark("beat", 18);
  const full = { left: 0, top: 0, width, height };
  const laid = { left: 0, top: 0, width, height };
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  // 1. Her, standing in her place, full frame the whole effect long: a photo still; a video held on its first image
  // while her works burst in, then playing its passage to the end. Her cut-out, drawn exactly over it, in front of them.
  const herInfo = shots[her];
  const HOLD = Math.max(0, F - herInfo.durationInFrames);
  const still = herInfo.from;
  const herShot = h(Footage, { key: "her", shot: her, at: HOLD, style: full });
  const cutOut = h(Subject, { key: "cut", shot: her, at: HOLD, style: full });

  // 2. Where she is, read once on her first image: her outline (her cut-out's), where it crosses a row, and her face as
  // tracked, else her head from her outline's top, four fifths as wide as she is 6 % under it, down to her shoulders (1,8
  // times as wide) or 1,35 times its width (v4: a florist's curls, her chin was under her words), else her cut-out's box.
  const cutBox = SubjectBox(herInfo, still, laid);
  const outline = cutBox ? SubjectOutline(herInfo, still, laid) : null;
  const nums = outline ? String(outline).match(/-?\d+(?:\.\d+)?/g) : null;
  const pts = [];
  if (nums && nums.length >= 12) for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])]);
  const crossings = (y) => {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      if ((p[1] <= y) !== (q[1] <= y)) xs.push(p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
    }
    return xs.sort((u, v) => u - v);
  };
  const extent = (y) => { const xs = pts.length >= 6 ? crossings(y) : []; return xs.length >= 2 ? [xs[0], xs[xs.length - 1]] : null; };
  const headTop = pts.length >= 6 ? Math.min.apply(null, pts.map((p) => p[1])) : cutBox ? cutBox.y : 0;
  const face = (() => {
    if (typeof track === "function") {
      const got = track(still, { shot: her, left: 0, top: 0, width, height }) || {};
      const faces = (got.faces || []).filter((f) => f && f.width > 0 && f.height > 0);
      if (faces.length) {
        const f = faces.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
        return { x: f.x - f.width / 2, y: f.y - f.height / 2, w: f.width, h: f.height };
      }
    }
    const e0 = extent(headTop + height * 0.06) || extent(headTop + height * 0.02);
    if (e0) {
      const w0 = Math.max(1, e0[1] - e0[0]);
      let chin = headTop + Math.min(height * 0.28, 1.35 * w0);
      for (let y = headTop + height * 0.08; y < chin; y += height * 0.01) {
        const e = extent(y);
        if (e && e[1] - e[0] >= 1.8 * w0) { chin = y - height * 0.01; break; }
      }
      const w = Math.max(height * 0.05, Math.min(height * 0.3, 0.8 * w0));
      return { x: (e0[0] + e0[1]) / 2 - w / 2, y: headTop, w, h: Math.max(height * 0.06, chin - headTop) };
    }
    if (cutBox && cutBox.w > 0 && cutBox.h > 0) {
      const hh = Math.min(cutBox.h / 5.5, cutBox.w / 2, height * 0.16);
      return { x: cutBox.x + cutBox.w / 2 - hh * 0.4, y: cutBox.y, w: hh * 0.8, h: hh };
    }
    return null;
  })();
  // Without her cut-out (none made in time) nothing passes behind her: her works keep off her face, or off the middle of
  // the frame where the montage centres her when nothing of her was read.
  const keepOff = cutBox ? null : face ? { x: face.x - face.w * 0.3, y: face.y - face.h * 0.2, w: face.w * 1.6, h: face.h * 1.5 } : { x: width * 0.3, y: height * 0.12, w: width * 0.4, h: height * 0.88 };

  // 3. When each work lands and leaves (its marks, for this count; else the original's burst at its own pace).
  const planned = mark("works", -1) === m;
  const lands = Array.from({ length: m }, (_, k) => Math.round(planned ? mark("l" + k, 4 + 4 * k) : Math.min(F * 0.45, B * 0.2 + k * B * 0.3)));
  const lastLand = m ? lands[m - 1] : 0;
  const hit = planned ? mark("hit", F - 2 * B) : Math.max(lastLand + B, F - 2 * B);
  const leaves = Array.from({ length: m }, (_, k) => Math.round(planned ? mark("o" + k, hit) : k === m - 1 ? hit + B / 3 : Math.min(lands[k] + (hit - (m > 1 ? lands[m - 2] : lands[0])), hit - (m - 2 - k))));
  const FRONT = Math.round(planned ? mark("front", m) : m > 1 ? Math.ceil((31 / 36) * (m - 1) - 1e-9) : m);

  // 4. Their boxes: the original's 37 measured at 1080 × 1920 (down the frame in a zigzag, passes of 3 to 5 from one side
  // to the other; their sides from 26 to 50 % of the width), sampled along them for another count, bigger when there
  // are fewer (the same surface), never past the frame's edges. Square as the original's, one in 4:5; each at its own
  // shape (3:4 to 4:3) or all in portrait 4:5 on her word.
  const PX = [349, 425, 568, 721, 756, 617, 432, 362, 342, 477, 673, 734, 786, 623, 432, 298, 358, 540, 740, 766, 722, 516, 417, 302, 426, 586, 734, 817, 674, 470, 262, 308, 466, 667, 824, 772, 584];
  const PY = [511, 453, 426, 426, 528, 555, 588, 667, 756, 736, 759, 789, 848, 848, 897, 960, 1049, 991, 968, 1058, 1115, 1146, 1124, 1216, 1240, 1276, 1269, 1321, 1350, 1308, 1364, 1393, 1436, 1478, 1477, 1508, 1503];
  const PS = [29.4, 25.9, 44, 35.1, 35.6, 37.7, 33.9, 37.6, 40.8, 31.6, 37.7, 37.6, 35.1, 28.6, 34.2, 29.8, 35.7, 27.7, 31.5, 37.4, 37.4, 38.9, 41.5, 33.8, 33.8, 27.5, 42.2, 31.5, 31.6, 31.5, 31.5, 31.5, 31.4, 35.8, 35.1, 32.5, 33.5];
  const along = (arr, t) => { const x = t * (arr.length - 1); const i = Math.max(0, Math.min(arr.length - 2, Math.floor(x))); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
  const grow = Math.max(0.9, Math.min(1.25, Math.sqrt(37 / Math.max(1, m))));
  // How much of a box her silhouette hides (her outline on 8 × 8 points): a work behind her moves toward the nearer
  // side until most of it shows (a wide figure hid most of them).
  const hidden = (b) => {
    if (pts.length < 6) return 0;
    let n = 0;
    for (let j = 0; j < 8; j++) {
      const xs = crossings(b.y + ((j + 0.5) * b.h) / 8);
      for (let i = 0; i < 8; i++) { const x = b.x + ((i + 0.5) * b.w) / 8; if (xs.filter((v) => v < x).length % 2) n++; }
    }
    return n / 64;
  };
  const format = setting("format", "carre");
  const tall = m > 2 ? Math.min(m - 2, Math.round((34 / 36) * (m - 1))) : -1;
  const shapeOf = (k) => {
    if (format === "portrait") return 0.8;
    if (format === "forme") return Math.max(0.75, Math.min(4 / 3, Number(shots[works[k]].aspect) || 1));
    return k === tall ? 0.8 : 1;
  };
  const boxes = [];
  const boxOf = (k) => {
    if (boxes[k]) return boxes[k];
    const a = shapeOf(k);
    const t = m > 1 ? k / (m - 1) : 0;
    const side = (width * along(PS, t) * grow) / 100;
    const w = Math.round(side * Math.sqrt(a));
    const hh = Math.round(side / Math.sqrt(a));
    const clampX = (x) => Math.max(width * 0.04 + w / 2, Math.min(width * 0.96 - w / 2, x));
    let cx = clampX((along(PX, t) * width) / 1080);
    const cy = Math.max(height * 0.06 + hh / 2, Math.min(height * 0.93 - hh / 2, (along(PY, t) * height) / 1920));
    if (k < FRONT && hidden({ x: cx - w / 2, y: cy - hh / 2, w, h: hh }) > 0.55) {
      const toward = cx < (cutBox ? cutBox.x + cutBox.w / 2 : width / 2) ? -1 : 1;
      let best = { cx, seen: 1 - hidden({ x: cx - w / 2, y: cy - hh / 2, w, h: hh }) };
      for (const way of [toward, -toward]) {
        for (let s = 1; s <= 8; s++) {
          const x = clampX(cx + way * s * width * 0.05);
          const seen = 1 - hidden({ x: x - w / 2, y: cy - hh / 2, w, h: hh });
          if (seen > best.seen + 0.01) best = { cx: x, seen };
          if (seen >= 0.45) break;
        }
        if (best.seen >= 0.45) break;
      }
      cx = best.cx;
    }
    // Off her (no cut-out): moved to the nearer side until a third of it at most is over her.
    if (keepOff) {
      const b = { x: cx - w / 2, y: cy - hh / 2, w, h: hh };
      if (overlap(b, keepOff) > 0.3 * w * hh) {
        const left = cx < keepOff.x + keepOff.w / 2;
        cx = left ? keepOff.x - w / 2 + w * 0.3 : keepOff.x + keepOff.w + w / 2 - w * 0.3;
        cx = Math.max(width * 0.02 + w / 2, Math.min(width * 0.98 - w / 2, cx));
      }
    }
    const b = { x: Math.round(cx - w / 2), y: Math.round(cy - hh / 2), w, h: hh };
    boxes[k] = { ...b, seen: 1 - hidden(b) };
    return boxes[k];
  };
  const work = (k) => {
    if (frame < lands[k] || frame >= leaves[k]) return null;
    const b = boxOf(k);
    if (keepOff && overlap(b, keepOff) > 0.45 * b.w * b.h) return null;
    return h("div", { key: "w" + k, style: { position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: "hidden" } },
      h(Footage, { shot: works[k], at: lands[k], style: { left: 0, top: 0, width: b.w, height: b.h } }));
  };
  // The last ones over her legs, in front of her; never over her face (then behind her).
  const legs = (k) => k >= FRONT && !(face && overlap(boxOf(k), face) > 0.1 * face.w * face.h);

  // 5. Her words from its first image to its last: one a line, at one size, the original's capitals (a line every 13,4 %
  // of the frame); four lines at most, none ending on a word of the next.
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Helvetica Neue', 'Arial', sans-serif";
  const SHORT = /^(le|la|les|de|du|des|un|une|à|au|aux|en|et|ou|par|pour|sur|chez|mon|ma|mes|ton|ta|tes|son|sa|ses|the|a|an|of|my|is|on)$/i;
  const lines = (text) => {
    const words = String(text || "").replace(/(\d) (?=\d)/g, "$1 ").toUpperCase().split(/[ \t\n]+/).filter(Boolean);
    if (words.length <= 4) return words;
    let best = null;
    const weigh = (groups) => {
      const longest = Math.max.apply(null, groups.map((g) => g.join(" ").length));
      const loose = groups.slice(0, -1).filter((g) => SHORT.test(g[g.length - 1])).length;
      const score = longest + 3 * loose - 0.1 * groups.length;
      if (!best || score < best.score) best = { score, groups };
    };
    const cut = (start, left, acc) => {
      if (left === 1) return weigh(acc.concat([words.slice(start)]));
      for (let stop = start + 1; stop <= words.length - left + 1; stop++) cut(stop, left - 1, acc.concat([words.slice(start, stop)]));
    };
    for (let k = 2; k <= 4; k++) cut(0, k, []);
    return best.groups.map((g) => g.join(" "));
  };
  const said = lines(texts && texts.mots);
  const rgb = (c) => { const x = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); if (!x) return null; const v = parseInt(x[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const lin = (s) => { const v = s / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const hsl = (c) => {
    const [r, g, b] = c.map((v) => v / 255);
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    const l = (hi + lo) / 2;
    const d = hi - lo;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let hue = d === 0 ? 0 : hi === r ? ((g - b) / d) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
    return [hue < 0 ? hue + 360 : hue, s, l];
  };
  const fromHsl = (hue, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const q = l - c / 2;
    const p = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
    return p.map((v) => (v + q) * 255);
  };
  const own = rgb(brand.accent) || rgb(brand.palette && brand.palette.dark) || [231, 250, 135];
  const tone = (c, wanted, ok) => {
    const [hue, s] = hsl(c);
    const sat = s < 0.12 ? s : Math.max(0.7, s);
    for (let i = 0; i <= 100; i++) {
      const t = fromHsl(hue, sat, wanted(i / 100));
      if (ok(lum(t))) return hex(t);
    }
    return null;
  };
  const TOP = Math.round(height * 0.205);
  // Its box: 20,5 to 74,5 % of the frame, x 140 to 940, above the works over her legs (down to four fifths of it).
  const lowest = Math.round(height * 0.745);
  const fronts = Array.from({ length: m }, (_, k) => k).filter(legs);
  const frontTop = fronts.length ? Math.min.apply(null, fronts.map((k) => boxOf(k).y)) - Math.round(height * 0.01) : lowest;
  const BOTTOM = Math.max(Math.round(TOP + 0.8 * (lowest - TOP)), Math.min(lowest, frontTop));
  const SIZE = Math.round(height * 0.1);
  const LINE = Math.round(height * 0.134);
  const BOX_W = width - 280;
  const glyph = (ch) => (/[IÎÏ1!.,:;' ]/.test(ch) ? 0.3 : /J/.test(ch) ? 0.52 : /[MWÆŒ]/.test(ch) ? 0.88 : /[EFLTZ]/.test(ch) ? 0.58 : 0.68);
  const near = face ? { x: face.x - height * 0.01, y: face.y - height * 0.01, w: face.w + height * 0.02, h: face.h + height * 0.02 } : null;
  const crosses = (list, top, bottom) => !!face && list.length > 0 && laidLines(list, top, bottom).some((b) => overlap(b, near) > 0);
  // Off her face: below it, else above it (shrunk to two fifths at most).
  const placeFor = (list) => {
    if (!crosses(list, TOP, BOTTOM)) return { top: TOP, bottom: BOTTOM };
    const gap = Math.round(height * 0.02);
    const below = Math.round(face.y + face.h + gap);
    if (BOTTOM - below >= 0.4 * (BOTTOM - TOP)) return { top: below, bottom: BOTTOM };
    const above = Math.round(face.y - gap);
    const roof = Math.round(height * 0.07);
    if (above - roof >= 0.4 * (BOTTOM - TOP)) return { top: roof, bottom: above };
    return { top: TOP, bottom: BOTTOM };
  };
  // A line reads behind her with a third of it hidden at most (her outline at three heights of its capitals, else her box).
  const across = (y, x0, x1) => {
    if (pts.length >= 6) {
      const xs = crossings(y);
      let c = 0;
      for (let i = 0; i + 1 < xs.length; i += 2) c += Math.max(0, Math.min(x1, xs[i + 1]) - Math.max(x0, xs[i]));
      return c;
    }
    if (cutBox && y >= cutBox.y && y <= cutBox.y + cutBox.h) return Math.max(0, Math.min(x1, cutBox.x + cutBox.w) - Math.max(x0, cutBox.x));
    return 0;
  };
  const laidLines = (list, top, bottom, left, boxW) => {
    const L = left === undefined ? 140 : left;
    const W = boxW === undefined ? BOX_W : boxW;
    const widths = list.map((l) => Array.from(l).reduce((a, ch) => a + glyph(ch), 0) * SIZE * 0.99);
    const s = Math.min(1, W / Math.max(1, Math.max.apply(null, widths)), (bottom - top) / (list.length * LINE));
    const mid = (top + bottom) / 2;
    return list.map((l, i) => {
      const w = Math.max(1, widths[i] * s);
      return { x: L + W / 2 - w / 2, y: mid + (i - (list.length - 1) / 2) * LINE * s - 0.38 * SIZE * s, w, h: 0.76 * SIZE * s };
    });
  };
  const behindHer = (list, top, bottom) => (!cutBox ? list.map(() => true) : laidLines(list, top, bottom).map((b) => [0.1, 0.5, 0.9].reduce((a, k) => a + across(b.y + k * b.h, b.x, b.x + b.w) / b.w, 0) / 3 <= 0.38));
  // Where (v4, as its skill's v3; on a florist filling the frame, four lines across her apron): (a) behind her at full
  // size, slid to the nearest place where every line reads; else (b) beside or above her where her shot is calm
  // (ClearBox), two fifths of its size at least; else (c) over her, under her face, else above it. No cut-out: in front.
  const roof = Math.round(height * 0.07);
  let at = null;
  if (said.length && cutBox) {
    const span = BOTTOM - TOP;
    for (let t = roof; t + span <= BOTTOM; t += Math.round(height * 0.02)) {
      if (behindHer(said, t, t + span).every(Boolean) && (!at || Math.abs(t - TOP) < Math.abs(at.top - TOP))) at = { top: t, bottom: t + span, left: 140, w: BOX_W, back: true };
    }
    if (!at && behindHer(said, TOP, BOTTOM).every(Boolean)) at = { top: TOP, bottom: BOTTOM, left: 140, w: BOX_W, back: true };
  }
  if (said.length && !at && cutBox) {
    const ws = said.map((l) => Array.from(l).reduce((a, ch) => a + glyph(ch), 0) * SIZE * 0.99);
    const bw = Math.max.apply(null, ws);
    const bh = said.length * LINE;
    const rows = [];
    for (let y = roof; y <= lowest; y += height * 0.02) { const e = pts.length >= 6 ? extent(y) : y >= cutBox.y ? [cutBox.x, cutBox.x + cutBox.w] : null; if (e) rows.push(e); }
    const her0 = rows.length ? Math.min.apply(null, rows.map((e) => e[0])) : cutBox.x;
    const her1 = rows.length ? Math.max.apply(null, rows.map((e) => e[1])) : cutBox.x + cutBox.w;
    const pad = Math.round(width * 0.03);
    const rooms = [
      { x: 100, y: roof, w: her0 - pad - 100, h: lowest - roof },
      { x: her1 + pad, y: roof, w: width - 140 - her1 - pad, h: lowest - roof },
      { x: 140, y: roof, w: BOX_W, h: headTop - pad - roof },
    ].filter((r) => r.w >= 0.4 * bw && r.h >= 0.4 * bh);
    let best = null;
    for (const r of rooms) {
      const s = Math.min(1, r.w / bw, r.h / bh);
      const w = Math.round(bw * s);
      const hh = Math.round(bh * s);
      const calm = ClearBox(herInfo, still, laid, { aspect: bw / bh, min: { w: Math.round(0.4 * bw), h: Math.round(0.4 * bh) }, max: { w, h: hh }, sky: false, prefer: "any", within: r, pad: 6, fallback: null });
      const spot = calm || { x: Math.round(r.x + (r.w - w) / 2), y: Math.round(r.y + (r.h - hh) / 2), w, h: hh };
      if (!best || spot.w * spot.h > best.w * best.h) best = spot;
    }
    if (best) at = { top: best.y, bottom: best.y + best.h, left: best.x, w: best.w, back: false };
  }
  if (said.length && !at) {
    const p = placeFor(said);
    at = { top: p.top, bottom: cutBox && p.bottom === BOTTOM ? lowest : p.bottom, left: 140, w: BOX_W, back: !cutBox };
  }
  const lineBoxes = at ? laidLines(said, at.top, at.bottom, at.left, at.w) : [];
  // Its colour against her shot's light under each line (LightUnder; behind her, where it shows beside her): hers when
  // it reads (3 to the mean), else a pale tint on a dark ground (the original's lime) or a deep one on a light one, else
  // white (ink on light) with a firm edge. Unread: hers, deepened when pale; over her body, white. On her word, pale.
  const groundOf = (b) => {
    if (!at.back || pts.length < 6) return LightUnder(herInfo, still, laid, b);
    const xs = crossings(b.y + b.h / 2);
    const parts = [];
    let x = b.x;
    for (let i = 0; i + 1 < xs.length; i += 2) { if (xs[i] > x) parts.push([x, Math.min(xs[i], b.x + b.w)]); x = Math.max(x, xs[i + 1]); }
    if (x < b.x + b.w) parts.push([x, b.x + b.w]);
    let sum = 0;
    let wide = 0;
    let high = 0;
    for (const [x0, x1] of parts) {
      if (x1 - x0 < 20) continue;
      const g = LightUnder(herInfo, still, laid, { x: x0, y: b.y, w: x1 - x0, h: b.h });
      if (!g) return null;
      sum += g.mean * (x1 - x0);
      wide += x1 - x0;
      high = Math.max(high, g.high);
    }
    return wide ? { mean: sum / wide, high } : LightUnder(herInfo, still, laid, b);
  };
  const grounds = lineBoxes.map(groundOf);
  const read = grounds.length > 0 && grounds.every((g) => g && Number.isFinite(g.mean) && Number.isFinite(g.high));
  const meanAll = read ? grounds.reduce((a, g) => a + g.mean, 0) / grounds.length : 0.5;
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const reads = (c) => {
    const L = lum(rgb(c));
    return grounds.every((g) => ratio(L, g.mean) >= 3 && ratio(L, L > g.mean ? g.high : Math.max(0, 2 * g.mean - g.high)) >= 1.5);
  };
  const deep = lum(own) > 0.3 ? tone(own, (k) => 0.5 - 0.5 * k, (l) => l <= 0.22) : hex(own);
  const paleOwn = tone(own, (k) => 0.55 + 0.45 * k, (l) => l >= 0.6);
  const asked = setting("couleur", "auto");
  const overHer = at && !at.back && !!cutBox;
  let firm = false;
  let COLOR = asked === "pale" ? paleOwn || "#ffffff" : null;
  if (!COLOR && (asked === "sienne" || (!read && !overHer))) COLOR = deep || "#161616";
  if (!COLOR && read) COLOR = [hex(own)].concat(meanAll < 0.35 ? [paleOwn, deep] : [deep, paleOwn]).filter(Boolean).find(reads) || null;
  if (!COLOR) { firm = true; COLOR = read && meanAll > 0.55 ? "#161616" : "#ffffff"; }
  const lit = lum(rgb(COLOR)) > 0.35;
  const edge = lit
    ? firm ? "0 0 2px rgba(0,0,0,0.75), 0 0 6px rgba(0,0,0,0.45), 0 4px 18px rgba(0,0,0,0.35)" : "0 0 1px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.3), 0 3px 16px rgba(0,0,0,0.28)"
    : firm ? "0 0 2px rgba(255,255,255,0.8), 0 0 6px rgba(255,255,255,0.5), 0 2px 14px rgba(255,255,255,0.35)" : "0 0 2px rgba(255,255,255,0.5), 0 2px 10px rgba(255,255,255,0.25)";
  const wordStyle = { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: SIZE, lineHeight: LINE + "px", height: LINE, letterSpacing: "-0.01em", color: COLOR, whiteSpace: "nowrap", textAlign: "center", textShadow: edge };
  const copy = (key) => h(FitText, { key, style: { position: "absolute", left: at.left, top: at.top, width: at.w, height: at.bottom - at.top } },
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } }, said.map((w, i) => h("div", { key: i, style: wordStyle }, w))));
  const shownWords = at && at.back ? copy("words") : null;
  const frontWords = at && !at.back ? copy("words-front") : null;
  // Her works: one she still hides for the most part in front of her below her chin (her head moves with the camera),
  // never over her words behind her; the legs in front.
  const backBoxes = at && at.back && cutBox ? lineBoxes : [];
  const inFront = (k) => {
    const b = boxOf(k);
    if (legs(k)) return true;
    if (!cutBox || k >= FRONT || b.seen >= 0.45 || (face && b.y < face.y + face.h)) return false;
    return !backBoxes.some((l) => overlap(b, l) > 0);
  };
  const behind = [];
  const before = [];
  for (let k = 0; k < m; k++) (inFront(k) ? before : behind).push(work(k));

  // From the back: her place, works behind, words behind, her cut-out, works in front, words in front.
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, herShot, behind, shownWords, cutOut, before, frontWords);
}`;

export const monTravail: EffectPiece = {
  key: "mon-travail",
  // 3: her words behind her, her cut-out over their letters (Tristan on its skill's v1: « la police passe pas derrière la dame »).
  // 4: always legible, as its skill's v3 (Tristan on its skill's v2 bench: « mes bouquets de saison ça va pas »): behind
  // her only when every line reads there, else beside or above her where her shot is calm, else over her under her
  // face; its colour against the light under each line; her works she would hide laid in front of her below her chin.
  version: 4,
  name: "Voici mon travail",
  how: "elle debout dans son lieu, plein écran et immobile, ses mots en très grandes capitales derrière elle quand chaque ligne s'y lit (elle détourée passe devant leurs lettres), sinon à côté ou au-dessus d'elle là où l'image est calme, jamais sur son visage, dans une couleur qui se lit sur ce qu'il y a dessous ; les photos de son travail se posent d'un coup derrière elle en rafale, en zigzag du haut vers le bas, de plus en plus lentement, les dernières devant ses jambes, elle détourée devant ; puis elles repartent une à une, l'avant-dernière sur un temps, et elle finit seule avec ses mots.",
  needs: "une photo ou une vidéo d'elle (ou de quelqu'un de l'équipe) debout face à l'objectif, téléphone posé, en entier ou jusqu'aux genoux, avec de la place au-dessus et autour d'elle, puis 5 à 15 photos de son travail (gros plans de ses pièces, de ses bouquets, de ses plats), qui changent de couleur et de cadrage.",
  lays: "sur son plan à elle debout (le premier sous lui, il reste figé derrière ses mots), suivi de 5 à 15 photos de son travail coupées d'un temps chacune, sa plus belle en dernier",
  shots: [6, 16],
  seconds: [3, 10],
  require: { files: 6, shot: { person: true, still: true } },
  texts: [
    {
      slot: "mots",
      want: "2 à 4 mots courts, empilés en très grand un par ligne devant elle et son travail, qui le présentent sans phrase de pub (une forme comme « voici mon travail », « mes bouquets », « fait main ici »)",
      max: 26,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "la forme de ses photos dans le collage",
      choices: [
        { value: "carre", says: "au carré, comme l'original (une en portrait 4:5), quelle que soit la forme de ses fichiers" },
        { value: "forme", says: "chacune à sa forme, comme ses fichiers (de 3:4 en hauteur à 4:3 en largeur)" },
        { value: "portrait", says: "toutes en portrait 4:5" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur de ses mots",
      choices: [
        { value: "auto", says: "choisie pour se lire sur ce qu'il y a sous ses mots : sa couleur quand elle s'y lit, sinon une teinte pâle ou profonde de la sienne, sinon du blanc ou de l'encre avec un contour" },
        { value: "sienne", says: "sa couleur telle quelle (plus profonde si elle est très pâle), lisible sur les murs clairs" },
        { value: "pale", says: "sa couleur en teinte pâle et vive, comme l'original, pour un lieu sombre ou très coloré" },
      ],
    },
  ],
  timeline({ frames, bpm, shots }): PieceTimeline {
    const B = (60 / bpm) * 30;
    // Her shot, then her works.
    const works = Math.max(0, shots.length - 1);
    const line = travailLine(frames, bpm, works);
    const marks: Record<string, number> = { works, hit: line.hit, front: line.front };
    line.lands.forEach((f, k) => (marks[`l${k}`] = f));
    line.leaves.forEach((f, k) => (marks[`o${k}`] = f));
    // A light click on each landing that stands apart from the one before (the burst a ratchet, slower and louder as it
    // slows down), every one of them in one burst of the same click; then the dry knock on the hit, the loudest.
    const clicks: { at: number; gap: number }[] = [];
    for (const [k, f] of line.lands.entries()) {
      // (The first at the pace of the burst it opens.)
      const gap = k ? f - line.lands[k - 1]! : (line.lands[1] ?? f + CLICK_GAP) - f;
      if (!clicks.length || f - clicks[clicks.length - 1]!.at >= CLICK_GAP) clicks.push({ at: f, gap });
    }
    const s = (f: number) => Math.round((f / 30) * 1000) / 1000;
    const first = clicks[0];
    const sounds = [
      ...(first && clicks.length > 1
        ? [{ at: s(first.at), ...CLICK, burst: { times: clicks.map((c) => s(c.at - first.at)), gains: clicks.map((c) => clickGain(c.gap, B)) } }]
        : clicks.map((c) => ({ at: s(c.at), ...CLICK, gain: clickGain(c.gap, B) }))),
      ...(works >= 2 ? [{ at: s(line.hit), ...KNOCK }] : []),
    ];
    // After the hit, her music goes on without its bass to the cut, as its skill's (the original's lighter, clearer end).
    const music = works >= 2 && frames - line.hit >= 6 ? { music: { filters: [{ kind: "thin" as const, from: s(line.hit), to: s(frames) }] } } : {};
    return { marks, sounds, cutouts: [0], ...music };
  },
  code: CODE,
};
