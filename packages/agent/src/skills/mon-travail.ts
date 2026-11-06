import { END_CARD_SECONDS, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Voici mon travail », written on its original's fiche (docs/fiches/mon-travail.md: measured image by
// image at 30 i/s, each work's landing, box and leaving found on the differences of its images; Tristan, of the Reel he
// sent: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). The original is the same
// template and the same sound as « Pile de photos » (its sound identical, its 37 landings, leavings and boxes the same
// to a few pixels), laid on one fixed shot of a person standing: her works stack up as a collage between the background
// and her, cut out in front of them, then leave one by one. No cut and no tempo: its landmarks fall on a grid of
// 120 BPM (a beat every 15 images), each work stays 8 beats, the collage is empty on beat 16 (its dry hit, 7,96 s), her
// words alone with her 2 beats at the end. Every length below is in those beats:
//   0 – 0,2     her, standing in her place, and her words alone (3 images);
//   0,2 – 5     her works land at once behind her, in a burst, one every 0,18 beat (2 or 3 images: 11 a second), down
//               the frame in a zigzag (the original's 37 boxes), each one over the one before, square (one in 4:5), never
//               moving, no border, no shadow; she stays in front of them, cut out at every image;
//   5 – 8,6     the nine last land slower and slower (4, 5, 4, 6, 6, 6, 7, 9 and 7 images apart), low in the frame: the
//               last six of 37 pass in front of her legs, as the original's;
//   8,2 – 16,3  each one leaves 8 beats after it landed, at once: the collage empties from the top at the pace it was
//               made; the second-last leaves on beat 16, the collage empty on its dry hit, the last one a third of a beat
//               after;
//   16,3 – 18,3 her alone with her words, the music lighter (without its bass) since the hit.
// Her words (2 to 4 short words, « VOICI / MON / TRAVAIL » or hers) stand behind her from the first image to the last
// when every line still reads there (her cut-out over their letters: Tristan on v1, « la police passe pas derrière la
// dame »), one a line at one size, wide bold capitals at the original's size and spacing, never on her face and above
// the works that pass in front of her legs. In the original she is a slim figure on the left third of a sunny street,
// her words in a pale lime that reads on everything under them; v3 (Tristan on v2's bench, a florist filling the
// frame: « mes bouquets de saison ça va pas », her raspberry words across her red apron and her chin, her works hidden
// behind her): a block that cannot pass behind her goes beside or above her where her shot is calm, else over her under
// her face; its colour is chosen against the light under each line (hers when it reads, else a tint of it, else white
// or ink with a firm edge); a work she would hide slides aside, else comes in front of her, off her face. Its words and
// its colour are the original's own, never copied. Her photos stay still, her videos play
// (Tristan: « si photos envoyées, figées ; si vidéos, ça joue »): her shot is held on its first image while her works
// burst in, then plays its last 6 s; a work's video is held on its instant, the last one plays what is left (two seconds
// for 37). The original's background is itself still: a photo of her suits it. Its clicks as they slow down are laid as
// its own sounds, on their measured moments (pile's: the same sound), then a dry knock on the hit. No grade: her shot and
// her works keep their colours. Its ending card (an offer, an announcement), in option.

const BPM = 120;
/** The first work lands at the original's image 3 (beats); the burst after it on the line through its 28 landings: one every STEP from CADENCE (its image 2). */
const FIRST = 0.2;
const CADENCE = 2 / 15;
const STEP = 0.18;
/** The gaps before its nine last works (beats: its 4, 5, 4, 6, 6, 6, 7, 9 and 7 images, a beat being 15 of them). */
const SLOWING = [4, 5, 4, 6, 6, 6, 7, 9, 7].map((f) => f / 15);
/** Each work stays this long (beats: its 120 images). */
const STAY = 8;
/** The second-last leaves on the hit, a whole beat; the last this long after it (beats: 5 images). */
const LAST_AFTER = 1 / 3;
/** Her words alone with her at the end (beats: its last second), or before the ending card. */
const ALONE = 2;
const ALONE_BEFORE_CARD = 1;
/** The ending card's beats: the engine's last 2,5 s at least. */
const CARD = 3.25;
const CARD_SECONDS = END_CARD_SECONDS;
/** Her shot plays this long at the end (beats: 6 s at its tempo), held on its first image before it. */
const HER = 12;
/** The works from this share of the collage on pass in front of her (the original's last six of 37, low, over her legs). */
const FRONT = 31 / 36;
/**
 * Its clicking as it slows down, measured on « Pile de photos »'s original, whose sound this original's is (s on its
 * clock, and how strong each attack is next to its hit): from 1,6 s, where they are two images apart or more, up to its
 * dry hit at 7,962 s.
 */
const CLICKS: [number, number][] = [
  [1.599, 0.19], [1.669, 0.31], [1.736, 0.47], [1.808, 0.4], [1.884, 0.22], [1.962, 0.45], [2.032, 0.21], [2.123, 0.27], [2.223, 0.24], [2.321, 0.27],
  [2.425, 0.2], [2.519, 0.2], [2.646, 0.28], [2.768, 0.21], [2.889, 0.22], [3.03, 0.22], [3.185, 0.19], [3.347, 0.19], [3.518, 0.2], [3.704, 0.23],
  [3.913, 0.23], [4.135, 0.18], [4.377, 0.06], [4.656, 0.25], [4.957, 0.29], [5.303, 0.27], [5.693, 0.18], [6.137, 0.74], [6.654, 0.17], [7.272, 0.44],
];
const HIT_AT = 7.962;
const CLICK = { sound: "light click", seconds: 0.5 };
const KNOCK = { sound: "dry knock", seconds: 0.5, gain: 6 };
/** A click's gain (dB): its strength next to the hit's, from the hit's +6, never under -12. */
const clickGain = (strength: number) => Math.round(Math.max(-12, Math.min(6, 6 + 20 * Math.log10(strength))) * 10) / 10;
const round = (n: number) => Math.round(n * 100) / 100;

/** When each of n works lands (beats from the start): the first at FIRST, the burst on its line, its nine last on the original's slowing gaps. */
export function workLandings(n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    if (k === 0) out.push(FIRST);
    else if (k < n - SLOWING.length) out.push(CADENCE + k * STEP);
    else out.push(out[k - 1]! + SLOWING[k - (n - SLOWING.length)]!);
  }
  return out;
}

/** The first of n works that passes in front of her (the original's 32nd of 37). */
export const frontFrom = (n: number) => (n > 1 ? Math.ceil(FRONT * (n - 1) - 1e-9) : n);

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  // Her shot first, then her works.
  const m = Math.max(0, n - 1);
  const endAt = end ? end.from : durationInFrames;
  const HOLD = Math.max(0, Math.round(mark("hold", 0)));
  const ALONE = Math.max(1, Math.round(mark("alone", 30)));
  const full = { left: 0, top: 0, width, height };
  const laid = { left: 0, top: 0, width, height };
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Helvetica Neue', 'Arial', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  // 1. Where she is, read once on a still moment: her cut-out's box, its outline (px), where it crosses a row.
  const at0 = Math.min(Math.max(0, durationInFrames - 1), 15);
  const cutBox = n ? SubjectBox(shots[0], at0, laid) : null;
  const silhouette = (() => {
    const outline = cutBox ? SubjectOutline(shots[0], at0, laid) : null;
    const nums = outline ? String(outline).match(/-?\d+(?:\.\d+)?/g) : null;
    if (!nums || nums.length < 12) return null;
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])]);
    return pts;
  })();
  const crossings = (y) => {
    const xs = [];
    if (!silhouette) return xs;
    for (let i = 0; i < silhouette.length; i++) {
      const a = silhouette[i];
      const b = silhouette[(i + 1) % silhouette.length];
      if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    return xs.sort((p, q) => p - q);
  };
  const across = (y, x0, x1) => {
    if (silhouette) {
      const xs = crossings(y);
      let c = 0;
      for (let i = 0; i + 1 < xs.length; i += 2) c += Math.max(0, Math.min(x1, xs[i + 1]) - Math.max(x0, xs[i]));
      return c;
    }
    if (cutBox && y >= cutBox.y && y <= cutBox.y + cutBox.h) return Math.max(0, Math.min(x1, cutBox.x + cutBox.w) - Math.max(x0, cutBox.x));
    return 0;
  };
  const extent = (y) => { const xs = crossings(y); return xs.length >= 2 ? [xs[0], xs[xs.length - 1]] : null; };
  const headTop = silhouette ? Math.min.apply(null, silhouette.map((p) => p[1])) : cutBox ? cutBox.y : 0;
  // Her face: as tracked; else her head from her outline's top, four fifths as wide as she is 6 % under it, down to her shoulders
  // (1,8 times as wide) or 1,35 times its width (a florist's curls: her chin was under « MES »); else her box's top (cut-out).
  const face = (() => {
    if (!n) return null;
    if (typeof track === "function") {
      const seen = track(at0, { shot: 0, left: 0, top: 0, width, height }) || {};
      const faces = (seen.faces || []).filter((f) => f && f.width > 0 && f.height > 0);
      if (faces.length) {
        const f = faces.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
        return { x: f.x - f.width / 2, y: f.y - f.height / 2, w: f.width, h: f.height };
      }
    }
    const e0 = silhouette ? extent(headTop + height * 0.06) || extent(headTop + height * 0.02) : null;
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
  const faceNear = face ? { x: face.x - height * 0.01, y: face.y - height * 0.01, w: face.w + height * 0.02, h: face.h + height * 0.02 } : null;
  const onFace = (b) => !!face && overlap(b, face) > 0.15 * face.w * face.h;

  // 2. Her, full frame, as filmed: a video held on its first image while her works burst in, then playing; her cut-out over it.
  const her = n ? h(Footage, { key: "her", shot: 0, at: HOLD, style: full }) : null;
  const cutOut = n ? h(Subject, { key: "cut", shot: 0, at: HOLD, style: full }) : null;

  // 3. Her works land and leave at once, on their marks; a Reel cut shorter brings them in, her words still alone at the end.
  const lands = Array.from({ length: m }, (_, k) => Math.round(mark("l" + k, 3 + 3 * k)));
  const planned = Array.from({ length: m }, (_, k) => Math.round(mark("o" + k, lands[k] + 120)));
  const first = m ? lands[0] : 0;
  const lastOut = m ? Math.max.apply(null, planned) : 0;
  const latest = Math.max(first + 1, endAt - ALONE);
  const squeeze = m && lastOut > latest ? (latest - first) / Math.max(1, lastOut - first) : 1;
  const leaves = planned.map((o) => Math.round(first + (o - first) * squeeze));
  // The original's 37 boxes (1080 × 1920, a zigzag down the frame), sampled for another count, bigger for fewer; square, one 4:5.
  const PX = [349, 425, 568, 721, 756, 617, 432, 362, 342, 477, 673, 734, 786, 623, 432, 298, 358, 540, 740, 766, 722, 516, 417, 302, 426, 586, 734, 817, 674, 470, 262, 308, 466, 667, 824, 772, 584];
  const PY = [511, 453, 426, 426, 528, 555, 588, 667, 756, 736, 759, 789, 848, 848, 897, 960, 1049, 991, 968, 1058, 1115, 1146, 1124, 1216, 1240, 1276, 1269, 1321, 1350, 1308, 1364, 1393, 1436, 1478, 1477, 1508, 1503];
  const PS = [29.4, 25.9, 44, 35.1, 35.6, 37.7, 33.9, 37.6, 40.8, 31.6, 37.7, 37.6, 35.1, 28.6, 34.2, 29.8, 35.7, 27.7, 31.5, 37.4, 37.4, 38.9, 41.5, 33.8, 33.8, 27.5, 42.2, 31.5, 31.6, 31.5, 31.5, 31.5, 31.4, 35.8, 35.1, 32.5, 33.5];
  const along = (arr, t) => { const x = t * (arr.length - 1); const i = Math.max(0, Math.min(arr.length - 2, Math.floor(x))); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
  const grow = Math.max(0.9, Math.min(1.45, Math.sqrt(37 / Math.max(1, m))));
  const format = setting("format", "carre");
  const tall = m > 2 ? Math.min(m - 2, Math.round((34 / 36) * (m - 1))) : -1;
  const shapeOf = (k) => {
    if (format === "portrait") return 0.8;
    if (format === "forme") return Math.max(0.75, Math.min(4 / 3, Number(shots[k + 1].aspect) || 1));
    return k === tall ? 0.8 : 1;
  };
  // How much of a box she hides (her outline on 8 × 6 points, else her box).
  const hiddenIn = (b) => {
    if (!cutBox) return 0;
    if (!silhouette) return overlap(b, cutBox) / Math.max(1, b.w * b.h);
    let c = 0;
    for (let j = 0; j < 6; j++) {
      const xs = crossings(b.y + ((j + 0.5) * b.h) / 6);
      for (let i = 0; i < 8; i++) { const x = b.x + ((i + 0.5) * b.w) / 8; if (xs.filter((v) => v < x).length % 2) c++; }
    }
    return c / 48;
  };
  const FRONT = Math.round(mark("front", m));
  const middle = cutBox ? cutBox.x + cutBox.w / 2 : width / 2;
  // A work she would hide for the most part slides toward the nearer side until half of it shows: the original's collage
  // is a mass around a slim figure (v3: a florist filling the frame hid them all).
  const boxes = [];
  const boxOf = (k) => {
    if (boxes[k]) return boxes[k];
    const a = shapeOf(k);
    const t = m > 1 ? k / (m - 1) : 0;
    const side = (width * along(PS, t) * grow) / 100;
    const w = Math.round(side * Math.sqrt(a));
    const hh = Math.round(side / Math.sqrt(a));
    const clampX = (x) => Math.max(width * 0.04 + w / 2, Math.min(width * 0.96 - w / 2, x));
    const cx = clampX((along(PX, t) * width) / 1080);
    const cy = Math.max(height * 0.06 + hh / 2, Math.min(height * 0.93 - hh / 2, (along(PY, t) * height) / 1920));
    const put = (x) => ({ x: Math.round(x - w / 2), y: Math.round(cy - hh / 2), w, h: hh });
    let b = put(cx);
    let seen = 1 - hiddenIn(b);
    if (k < FRONT && seen < 0.5) {
      const way = cx < middle ? -1 : 1;
      for (const dir of [way, -way]) {
        for (let s = 1; s <= 10 && seen < 0.5; s++) {
          const c = put(clampX(cx + dir * s * width * 0.05));
          const v = 1 - hiddenIn(c);
          if (v > seen + 0.01) { b = c; seen = v; }
        }
        if (seen >= 0.5) break;
      }
    }
    boxes[k] = { x: b.x, y: b.y, w: b.w, h: b.h, seen };
    return boxes[k];
  };
  // No cut-out made in time: no work on her face.
  const bare = !cutBox && face;
  // The last ones pass in front of her legs (the original's last six of 37), never on her face.
  const legs = (k) => k >= FRONT && !onFace(boxOf(k));

  // 4. Her words to the end (or the card): one a line, at one size, the original's capitals (7,3 % tall, a line every
  // 13,4 %); four lines at most, none ending on a word of the next.
  const SHORT = /^(le|la|les|de|du|des|un|une|à|au|aux|en|et|ou|par|pour|sur|chez|mon|ma|mes|ton|ta|tes|son|sa|ses|the|a|an|of|my|is|on)$/i;
  const lines = (text) => {
    const words = String(text || "").replace(/(\p{L}) (?=\p{L})/gu, "$1 ").toUpperCase().split(/[ \t\n]+/).filter(Boolean);
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
  const SIZE = Math.round(height * 0.1);
  const LINE = Math.round(height * 0.134);
  // Its box: 20,5 to 74,5 % of the frame, x 140 to 940, above the works over her legs (down to four fifths of it).
  const TOP = Math.round(height * 0.205);
  const lowest = Math.round(height * 0.745);
  const roof = Math.round(height * 0.07);
  const legTops = Array.from({ length: m }, (_, k) => k).filter(legs).map((k) => boxOf(k).y);
  const frontTop = legTops.length ? Math.min.apply(null, legTops) - Math.round(height * 0.01) : lowest;
  const BOTTOM = Math.max(Math.round(TOP + 0.8 * (lowest - TOP)), Math.min(lowest, frontTop));
  const BOX_W = width - 280;
  const glyph = (ch) => (/[IÎÏ1!.,:;' ]/.test(ch) ? 0.3 : /J/.test(ch) ? 0.52 : /[MWÆŒ]/.test(ch) ? 0.88 : /[EFLTZ]/.test(ch) ? 0.58 : 0.68);
  const widthsOf = (list) => list.map((l) => Array.from(l).reduce((a, ch) => a + glyph(ch), 0) * SIZE * 0.99);
  const laidLines = (list, top, bottom, left, boxW) => {
    const L = left === undefined ? 140 : left;
    const W = boxW === undefined ? BOX_W : boxW;
    const widths = widthsOf(list);
    const s = Math.min(1, W / Math.max(1, Math.max.apply(null, widths)), (bottom - top) / (list.length * LINE));
    const mid = (top + bottom) / 2;
    return list.map((l, i) => {
      const w = Math.max(1, widths[i] * s);
      return { x: L + W / 2 - w / 2, y: mid + (i - (list.length - 1) / 2) * LINE * s - 0.38 * SIZE * s, w, h: 0.76 * SIZE * s };
    });
  };
  const crosses = (list, top, bottom) => !!face && list.length > 0 && laidLines(list, top, bottom).some((b) => overlap(b, faceNear) > 0);
  // Off her face: below it, else above it (shrunk to two fifths at most).
  const placeFor = (list, bottomAt) => {
    const B = bottomAt || BOTTOM;
    if (!crosses(list, TOP, B)) return { top: TOP, bottom: B };
    const gap = Math.round(height * 0.02);
    const below = Math.round(face.y + face.h + gap);
    if (B - below >= 0.4 * (B - TOP)) return { top: below, bottom: B };
    const above = Math.round(face.y - gap);
    if (above - roof >= 0.4 * (B - TOP)) return { top: roof, bottom: above };
    return { top: TOP, bottom: B };
  };
  // A line reads behind her with a third of it hidden at most (her outline at three heights of its capitals).
  const behindHer = (list, top, bottom) => laidLines(list, top, bottom).map((b) => [0.1, 0.5, 0.9].reduce((a, k) => a + across(b.y + k * b.h, b.x, b.x + b.w) / b.w, 0) / 3 <= 0.38);
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const said = hook ? lines(hook.text) : [];
  let at = null;
  // Where (v3; v2 laid four lines across a florist's apron): (a) behind her at full size, slid to the nearest place where
  // every line reads; else (b) beside or above her where her shot is calm (ClearBox), two fifths of its size at least; else (c) over
  // her, under her face, else above it (as the original's last word across her jeans). No cut-out: in front, off her face.
  if (said.length && cutBox) {
    const t0 = TOP;
    const span = BOTTOM - TOP;
    const tries = [t0];
    for (let t = roof; t + span <= BOTTOM; t += Math.round(height * 0.02)) tries.push(t);
    for (const t of tries) if (behindHer(said, t, t + span).every(Boolean) && (!at || Math.abs(t - t0) < Math.abs(at.top - t0))) at = { top: t, bottom: t + span, left: 140, w: BOX_W, back: true };
  }
  if (said.length && !at && cutBox) {
    const bw = Math.max.apply(null, widthsOf(said));
    const bh = said.length * LINE;
    const rows = [];
    for (let y = roof; y <= lowest; y += height * 0.02) { const e = silhouette ? extent(y) : y >= cutBox.y ? [cutBox.x, cutBox.x + cutBox.w] : null; if (e) rows.push(e); }
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
      const calm = ClearBox(shots[0], at0, laid, { aspect: bw / bh, min: { w: Math.round(0.4 * bw), h: Math.round(0.4 * bh) }, max: { w, h: hh }, sky: false, prefer: "any", within: r, pad: 6, fallback: null });
      const spot = calm || { x: Math.round(r.x + (r.w - w) / 2), y: Math.round(r.y + (r.h - hh) / 2), w, h: hh };
      if (!best || spot.w * spot.h > best.w * best.h) best = spot;
    }
    if (best) at = { top: best.y, bottom: best.y + best.h, left: best.x, w: best.w, back: false };
  }
  if (said.length && !at) {
    const p = placeFor(said, cutBox ? lowest : BOTTOM);
    at = { top: p.top, bottom: p.bottom, left: 140, w: BOX_W, back: !cutBox };
  }
  const lineBoxes = at ? laidLines(said, at.top, at.bottom, at.left, at.w) : [];
  // Its colour against her shot's light under each line (LightUnder; behind her, where it shows): hers when it reads (3 to
  // the mean), else a pale tint on a dark ground (the original's lime) or a deep one on a light one, else white (ink on
  // light) with a firm edge. Unread: hers, deepened when pale; over her body, white.
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
  const groundOf = (b) => {
    if (!at.back || !silhouette) return LightUnder(shots[0], at0, laid, b);
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
      const g = LightUnder(shots[0], at0, laid, { x: x0, y: b.y, w: x1 - x0, h: b.h });
      if (!g) return null;
      sum += g.mean * (x1 - x0);
      wide += x1 - x0;
      high = Math.max(high, g.high);
    }
    return wide ? { mean: sum / wide, high } : LightUnder(shots[0], at0, laid, b);
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
  const choice = setting("couleur", "auto");
  const overHer = at && !at.back && !!cutBox;
  let firm = false;
  let COLOR = choice === "original" ? "#e7fa87" : choice === "pale" ? paleOwn || "#ffffff" : null;
  if (!COLOR && (choice === "sienne" || (!read && !overHer))) COLOR = deep || "#161616";
  if (!COLOR && read) COLOR = [hex(own)].concat(meanAll < 0.35 ? [paleOwn, deep] : [deep, paleOwn]).filter(Boolean).find(reads) || null;
  if (!COLOR) { firm = true; COLOR = read && meanAll > 0.55 ? "#161616" : "#ffffff"; }
  const light = lum(rgb(COLOR)) > 0.35;
  const edge = light
    ? firm ? "0 0 2px rgba(0,0,0,0.75), 0 0 6px rgba(0,0,0,0.45), 0 4px 18px rgba(0,0,0,0.35)" : "0 0 1px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.3), 0 3px 16px rgba(0,0,0,0.28)"
    : firm ? "0 0 2px rgba(255,255,255,0.8), 0 0 6px rgba(255,255,255,0.5), 0 2px 14px rgba(255,255,255,0.35)" : "0 0 2px rgba(255,255,255,0.5), 0 2px 10px rgba(255,255,255,0.25)";
  const word = { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: SIZE, lineHeight: LINE + "px", height: LINE, letterSpacing: "-0.01em", color: COLOR, whiteSpace: "nowrap", textAlign: "center", textShadow: edge };
  const stack = (list, key, box, align) => h(FitText, { key, style: { position: "absolute", left: box.left, top: box.top, width: box.w, height: box.bottom - box.top }, innerStyle: { justifyContent: align || "center" } },
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } }, list.map((w, i) => h("div", { key: i, style: word }, w))));
  const wordsOn = !!at && hook && frame >= hook.from && frame < endAt;
  const backWords = wordsOn && at.back ? stack(said, "words", at) : null;
  const frontWords = wordsOn && !at.back ? stack(said, "words-front", at) : null;
  // Any other text (none in its slots): on a white pill high up.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: BOX_W, top: 120 + i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: "#161616", textAlign: "center" } },
      h("span", { style: { background: "#ffffff", padding: "8px 22px", borderRadius: 40 } }, t.text)));

  // A work she still hides for the most part goes in front of her below her chin (her head moves with the camera),
  // never over her words behind her.
  const backBoxes = at && at.back && cutBox ? lineBoxes : [];
  const inFront = (k) => {
    const b = boxOf(k);
    if (legs(k)) return true;
    if (!cutBox || k >= FRONT || b.seen >= 0.5 || onFace(b) || (face && b.y < face.y + face.h)) return false;
    return !backBoxes.some((l) => overlap(b, l) > 0);
  };
  const work = (k) => {
    if (frame < lands[k] || frame >= leaves[k]) return null;
    const b = boxOf(k);
    if (bare && overlap(b, face) > 0.3 * face.w * face.h) return null;
    return h("div", { key: "w" + k, style: { position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: "hidden" } },
      h(Footage, { shot: k + 1, at: lands[k], style: { left: 0, top: 0, width: b.w, height: b.h } }));
  };
  const behind = [];
  const before = [];
  for (let k = 0; k < m; k++) (inFront(k) ? before : behind).push(work(k));

  // 5. Its ending card, in option: her picture darker, its title in the words' capitals, a line under it.
  const title = end ? lines(keep(end.title)) : [];
  const card = end ? placeFor(title) : null;
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { position: "absolute", left: 0, top: 0, width, height, background: "#000000", opacity: 0.3 } }),
        stack(title, "card", { left: 140, w: BOX_W, top: card.top, bottom: end.subtitle ? Math.round(card.top + (card.bottom - card.top) * 0.78) : card.bottom }, end.subtitle ? "flex-end" : "center"),
        end.subtitle
          ? h(FitText, { key: "cs", style: { position: "absolute", left: 140, top: Math.round(card.top + (card.bottom - card.top) * 0.8), width: BOX_W, height: 170 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 58, lineHeight: 1.2, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(end.subtitle))
          : null)
    : null;

  // From the back: her place, works behind, words behind, her cut-out, works in front, words in front.
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, her, behind, backWords, cutOut, before, frontWords, extra, ending);
}`;


export const monTravail: MontageSkill = {
  key: "mon-travail",
  // 2: her words behind her, her cut-out over their letters (Tristan on v1: « la police passe pas derrière la dame »),
  // kept above the works that pass in front of her legs; her shot declared as the one cut out (`cutouts`).
  // 3: always legible (Tristan on v2's bench: « mes bouquets de saison ça va pas »): behind her only when every line
  // reads there, else beside or above her where her shot is calm, else over her under her face, never on it; its colour
  // chosen against the light under it; her works she would hide slid aside or laid in front of her.
  version: 3,
  bpm: BPM,
  // Her shot and her works: 8 works at least (the collage needs a second-last to leave on its hit), 40 at most.
  shots: [9, 41],
  // Under 16 files (her and 15 works) Edith asks her first whether she has others (each video gives up to three photos).
  files: [16, 41],
  how: "Elle debout dans son lieu, caméra posée (une photo, ou une vidéo qui joue), ses mots en très grandes capitales du début à la fin, derrière elle quand chaque ligne s'y lit encore (elle détourée passe devant leurs lettres), sinon à côté ou au-dessus d'elle là où l'image est calme, jamais sur son visage, dans une couleur choisie pour se lire sur ce qu'il y a dessous ; ses photos de son travail se posent d'un coup derrière elle, en rafale (une toutes les 2 ou 3 images), du haut vers le bas en zigzag, au carré, sans bord ni ombre, puis de plus en plus lentement pour les neuf dernières, en bas, les dernières devant ses jambes (celles qu'elle cacherait glissent sur le côté ou passent devant elle) ; chacune repart d'un coup 4 secondes après s'être posée, le collage se vidant par le haut, vide sur un coup sec, et elle finit seule avec ses mots. Elle reste détourée devant ses travaux.",
  end: true,
  texts: [
    {
      slot: "mots",
      role: "hook",
      want: "2 à 4 mots courts, empilés en très grand un par ligne avec elle et son travail, qui le présentent sans phrase de pub (une forme comme « voici mon travail », « mes bouquets », « fait main ici »)",
      max: 26,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "la forme de ses photos dans le collage (le Reel reste vertical)",
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
        { value: "sienne", says: "sa couleur telle quelle (plus profonde si elle est très pâle), lisible sur les murs clairs de la plupart des lieux" },
        { value: "pale", says: "sa couleur en teinte pâle et vive, comme l'original, pour un lieu sombre ou très coloré" },
        { value: "original", says: "le vert anis pâle de l'original" },
      ],
    },
  ],
  // Its original has no grade on the whole: her shot keeps its light and each work its colours; none of the
  // catalogue's contrast and saturation laid over everything.
  finish: { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 },
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const frames = (beats: number) => toFrame(beats * beat);
    // Her shot, then her works (two at least: the collage is empty on its hit when its second-last leaves).
    const works = Math.max(2, n - 1);
    const lands = workLandings(works);
    // The collage is empty on a whole beat: the second-last leaves on it (beat 16 for its 37 works), the last just after,
    // both a little early, as the original's last ones: those before them that would stay past it leave just before it.
    const hit = Math.floor(lands[works - 2]! + STAY);
    const last = hit + LAST_AFTER;
    // Her words alone with her after it, or a beat of them and the ending card (the engine's 2,5 s at least, whatever the tempo).
    const total = frames(last + (end ? ALONE_BEFORE_CARD + Math.max(CARD, CARD_SECONDS / beat) : ALONE));
    const landed = lands.map(frames);
    const stay = Math.round(STAY * beat * 30);
    const leaving = landed.map((f, k) => (k === works - 1 ? frames(last) : k === works - 2 ? frames(hit) : Math.min(f + stay, frames(hit) - (works - 2 - k))));
    // Her shot's passage: its last 6 s (12 beats), as long as her works keep an image each; held on its first image before.
    const herFrames = Math.max(1, Math.min(frames(HER), total - works));
    // Her works' passages: an image each (a photo is still; a video is held on its instant), the last one the rest.
    const edges = [0, herFrames, ...Array.from({ length: works - 1 }, (_, k) => herFrames + k + 1), total];
    const spans = edges.slice(0, -1).map((f, i) => ({ start: round(f / 30), end: round(edges[i + 1]! / 30) }));
    const duration = round(total / 30);
    const front = frontFrom(works);
    const wants = spans.map((_, i) =>
      i === 0
        ? "elle (ou quelqu'un de l'équipe) debout dans son lieu, face à l'objectif, en entier ou jusqu'aux genoux, caméra posée, son visage dans le haut de l'image, plutôt d'un côté avec de la place à côté d'elle (comme l'original : son travail se voit autour d'elle) : une photo, ou une vidéo d'au moins 6 s où elle bouge peu ; ses travaux se posent derrière elle, elle reste devant"
        : i === 1
          ? "la première photo de son travail, posée en haut derrière elle : une belle photo de ce qu'elle fait, son sujet au centre"
          : i < spans.length - SLOWING.length
            ? "une photo de son travail (ou un instant d'une vidéo, figé), posée d'un coup derrière elle, recadrée au carré sur son sujet, vue au tiers de la largeur : un gros plan qui se lit petit, d'une autre couleur ou d'un autre cadrage que la précédente ; jamais elle"
            : i < spans.length - 1
              ? `une photo de son travail, posée plus bas et plus lentement${i - 1 >= front ? ", devant ses jambes" : ""}, de plus en plus belle ; jamais elle`
              : "sa plus belle photo de son travail (ou une vidéo, qui y joue un moment), posée la dernière en bas, devant elle : la dernière à partir",
    );
    // Its clicks as they slow down, the original's, counted back from its hit (its works of the burst land on them),
    // from its first work; then the dry knock on the hit, the loudest.
    const sounds: SkillSound[] = [
      ...CLICKS.map(([t, strength]) => ({ at: (hit - (HIT_AT - t) * 2) * beat, strength }))
        .filter((c) => c.at >= FIRST * beat)
        .map((c) => ({ at: Math.round(c.at * 1000) / 1000, ...CLICK, gain: clickGain(c.strength) })),
      { at: Math.round(hit * beat * 1000) / 1000, ...KNOCK },
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her words from the first image to the end, or to the card.
      texts: { mots: { from: 0, to: round(end ? duration - CARD_SECONDS : duration) } },
      marks: {
        hold: total - herFrames,
        hit: frames(hit),
        last: frames(last),
        alone: frames(end ? ALONE_BEFORE_CARD : ALONE),
        front,
        ...Object.fromEntries(landed.map((f, k) => [`l${k}`, f])),
        ...Object.fromEntries(leaving.map((f, k) => [`o${k}`, f])),
      },
      // Her cut-out is drawn on her shot alone (in front of her works and her words): her works are never cut out.
      cutouts: [0],
      sounds,
      // Since the hit, its music goes on lighter and clearer (the original's 10 dB lower, without its low notes): without
      // its bass to the end, which it reaches without fading.
      music: { filters: [{ kind: "thin", from: round(hit * beat), to: duration }], end: { at: duration, fade: 0.02 } },
    };
  },
  code: CODE,
};
