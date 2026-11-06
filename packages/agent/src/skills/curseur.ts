import { beatSpans, type MontageSkill } from "../skills.ts";

// « Un clic sur tes produits » (`curseur`), version 1, written on its original's fiche (docs/fiches/curseur.md: measured
// image by image at 30 i/s, its cursor tracked on every image, its freezes, its labels and its sound by frequency bands;
// Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A desktop cursor drawn over
// a real video, as if the video were playing on a computer: the classic white pixel arrow, its black outline, pressed in
// for an image on each click (69 % of its size, about its centre), no ring, no shadow, gliding in straight lines at an
// even pace and resting between them. Its original has no beat to count (its sound is its street's, cut by its first
// click and back on its last); its moments are counted in images at 90 BPM, a beat every 20 images (its first click on
// beat 2), so that at another tempo they all follow:
//   0 – 40     her place plays (someone comes out with what she sells); the cursor slides in from the left edge (image
//              10) and rests beside the person; a click (image 40): the video pauses and the music stops dead;
//   40 – 68    the picture held; the cursor glides onto what the person holds and clicks: the close-up of her products,
//              held (image 68);
//   68 – 161   a click on her first product (83) writes its name in big white condensed capitals in the free space near
//              it, a hand-drawn arrow from the product to the word, at once; a click on her second (109), the same; a
//              click away from them (161) clears both (the original 141: one beat more, for her second name to be read);
//   161 – 238  the cursor rises to the top, a double click (194, 199) goes back to her place, held on the image where it
//              stopped; it glides down onto the person and clicks (238): the video plays on and the music comes back;
//   238 – 326  her place plays (the person walks off); the cursor slides out by the bottom left (282).
// Each click heard (a computer mouse click, alone in the silence). Its words: her two products' names; nothing of the
// original's own (its restaurant's name and sign, its dishes' names, its chicks). Its frame as her videos (Tristan:
// « format par défaut [comme ses vidéos], et changement à la demande du user »): an upright one full frame, a horizontal
// one whole in a 16:9 band on black (its names then on the black above or below, their arrows into the picture).

const BPM = 90;
/** A beat of its own tempo, in images (90 BPM). */
const BEAT = 20;
/**
 * Its moments, in images at its own tempo: the cursor's keyframes (it glides from one to the next, at an even pace) and
 * its clicks, the original's but for one beat more after its second name (shown 1,07 s there, read in 1,7 s here).
 */
export const CURSEUR_MOMENTS = {
  enter: 10,
  reach: 29,
  at1: 31,
  pause: 40,
  go2: 54,
  at2: 65,
  zoom: 68,
  at3: 75,
  near3: 80,
  label1: 83,
  go4: 88,
  at4: 104,
  label2: 109,
  go5: 144,
  at5: 156,
  clear: 161,
  drift: 164,
  drifted: 172,
  go6: 173,
  at6: 185,
  dbl: 194,
  back: 199,
  go7: 219,
  at7: 233,
  play: 238,
  go8: 245,
  out: 282,
} as const;
/** Its clicks, each one heard: the pause, the close-up, her two names, clearing them, the double click back, the play. */
export const CURSEUR_CLICKS = ["pause", "zoom", "label1", "label2", "clear", "dbl", "back", "play"] as const;
/** Her place plays until its pause (its first click on image 40, the picture held from there). */
const HELD = 41;
/** Its length, in images at its own tempo (the original's 306 and its one beat more). */
const LENGTH = 326;
/** The engine's ending card: the Reel's last 1,6 s. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const textFont = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  // A price, an hour or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");

  // Its moments (images), as its timeline gives them at the Reel's tempo; the original's at 90 BPM by default.
  const T = {};
  [["enter", 10], ["reach", 29], ["at1", 31], ["pause", 40], ["go2", 54], ["at2", 65], ["zoom", 68], ["at3", 75], ["near3", 80], ["label1", 83], ["go4", 88], ["at4", 104], ["label2", 109], ["go5", 144], ["at5", 156], ["clear", 161], ["drift", 164], ["drifted", 172], ["go6", 173], ["at6", 185], ["dbl", 194], ["back", 199], ["go7", 219], ["at7", 233], ["play", 238], ["go8", 245], ["out", 282]].forEach((x) => { T[x[0]] = Math.round(mark(x[0], x[1])); });

  // 1. Each shot in its box, as her videos are (an upright one full frame, a horizontal one whole in a 16:9 band on
  // black), or as her words ask: all full frame, or all in the band.
  const format = setting("format", "auto");
  const FULL = { left: 0, top: 0, width: W, height: H };
  const BH = Math.round((W * 9) / 16);
  const BAND = { left: 0, top: Math.round((H - BH) / 2), width: W, height: BH };
  const boxOf = (k) => {
    if (format === "vertical") return FULL;
    if (format === "horizontal") return BAND;
    const a = k < n ? Number(shots[k].aspect) || 0.5625 : 0.5625;
    return a > 1.15 ? BAND : FULL;
  };
  const k1 = Math.min(1, Math.max(0, n - 1));
  const k2 = Math.min(2, Math.max(0, n - 1));
  const B0 = boxOf(0);
  const B1 = boxOf(k1);
  const B2 = boxOf(k2);
  // Her place plays until its pause, then holds its last image (the first click); the close-up is held on its first image
  // from the second click to the double click; her place again, held on its first image (where it stopped) until the
  // last click, then plays on.
  const onClose = frame >= T.zoom && frame < T.back;
  const k = frame < T.zoom ? 0 : onClose ? k1 : k2;
  const box = k === 0 ? B0 : onClose ? B1 : B2;
  const picture = n ? h(Footage, { key: "shot-" + k, shot: k, style: box, ...(onClose ? { at: frame } : {}) }) : null;

  // 2. Where the cursor goes on her pictures: the person in her place (her body and hands as tracked, on the image where
  // it stops), each of her products in the close-up (as found by their names, on its held image); else the original's
  // places. Shares of a box → px.
  const at = (bx, x, y) => ({ x: bx.left + bx.width * x, y: bx.top + bx.height * y });
  const inside = (p) => ({ x: within(p.x, W * 0.06, W * 0.9), y: within(p.y, H * 0.1, H * 0.88) });
  const personIn = (kk, f, bx) => {
    if (typeof track !== "function" || kk >= n) return null;
    const seen = track(f, { shot: kk, ...bx }) || {};
    const torso = [];
    const hands = [];
    (seen.bodies || []).forEach((b) => {
      const p = (b && b.points) || {};
      ["left_shoulder", "right_shoulder", "left_hip", "right_hip"].forEach((q) => { if (p[q] && p[q].visible && Number.isFinite(p[q].x)) torso.push(p[q]); });
      ["left_wrist", "right_wrist", "left_index", "right_index"].forEach((q) => { if (p[q] && p[q].visible && Number.isFinite(p[q].x)) hands.push(p[q]); });
    });
    (seen.hands || []).forEach((hd) => { const p = (hd && hd.points) || {}; ["wrist", "index_tip", "middle_tip"].forEach((q) => { if (p[q] && Number.isFinite(p[q].x)) hands.push(p[q]); }); });
    if (!torso.length && !hands.length) return null;
    const mean = (l, a) => l.reduce((s, p) => s + p[a], 0) / l.length;
    const xs = torso.map((p) => p.x);
    return {
      hand: hands.length ? { x: mean(hands, "x"), y: mean(hands, "y") } : null,
      right: xs.length ? Math.max.apply(null, xs) : null,
      mid: torso.length ? { x: mean(torso, "x"), y: mean(torso, "y") } : null,
    };
  };
  const lastOf = (kk) => (kk < n ? shots[kk].from + Math.max(0, shots[kk].durationInFrames - 1) : 0);
  const firstOf = (kk) => (kk < n ? shots[kk].from : 0);
  const reads = React.useMemo(() => {
    const p0 = personIn(0, lastOf(0), B0);
    const p2 = personIn(k2, firstOf(k2), B2);
    // Beside her, at the height of her hands (the original's first click, at the server's side); onto what she holds.
    const side = (p) => ({ x: (p.right !== null ? p.right : p.hand.x) + W * 0.11, y: p.hand ? p.hand.y + H * 0.04 : p.mid.y });
    const holds = (p) => p.hand || { x: p.mid.x, y: p.mid.y + H * 0.06 };
    // Each product on the close-up's held image, by the name its filler gave it (written here, so only it is followed).
    const product = (b, fb) => (b && b.w > 12 && b.h > 12 ? { x: b.x, y: b.y, w: b.w, h: b.h, found: true } : { x: B1.left + B1.width * fb[0], y: B1.top + B1.height * fb[1], w: B1.width * fb[2], h: B1.height * fb[3], found: false });
    const finds = n > 1;
    return {
      t1: inside(p0 ? side(p0) : at(B0, 0.676, 0.632)),
      t2: inside(p0 ? holds(p0) : at(B0, 0.474, 0.602)),
      t7: inside(p2 ? holds(p2) : at(B2, 0.5, 0.62)),
      p1: product(finds ? SubjectBox(shots[1], firstOf(1), B1, "@produit1") : null, [0.02, 0.4, 0.46, 0.22]),
      p2: product(finds ? SubjectBox(shots[1], firstOf(1), B1, "@produit2") : null, [0.03, 0.64, 0.6, 0.29]),
    };
  }, [track, n, format]);
  // Its click on a product: on it, a little right of its middle and above (the original's, on the dish), else the original's.
  const clickOn = (P, fb) => (P.found ? inside({ x: P.x + P.w * 0.58, y: P.y + P.h * 0.4 }) : at(B1, fb[0], fb[1]));
  const c1 = clickOn(reads.p1, [0.413, 0.45]);
  const c2 = clickOn(reads.p2, [0.51, 0.73]);

  // 3. Her products' names, each in the free space near its product (above it first, else below it; in a band, on the
  // black above or below the picture), never on the other product nor on the other name, inside the safe zone: big white
  // condensed capitals (dark ink on a bright place), a hand-drawn arrow from the product to the word, there at once on its
  // click, gone at once on the click that clears them.
  const captions = reelTexts.filter((t) => t.role === "caption");
  const banded1 = B1 === BAND;
  const F = banded1 ? Math.round(H * 0.04) : Math.round(H * 0.054);
  const LH = Math.round(F * 1.18);
  const RISE = Math.round(H * 0.1);
  const estimate = (s) => Math.round(within(String(s).length * F * 0.47 + F * 0.5, W * 0.22, W * 0.76));
  const xMax = (y, hh) => (y + hh > H / 2 ? W - 140 : W - 40);
  const overlap = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const hh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && hh > 0 ? (w * hh) / (a.w * a.h) : 0;
  };
  // Every place tried: above its product (at four heights), below it, beside it; inside the safe zone and off the other
  // name, the cheapest kept: off the other product and its own, near it, above it first, on a calm dark place of the
  // picture (white words read there; read on the close-up's held image).
  const safe = (L) => L.x >= 44 && L.y >= 100 && L.y + L.h <= H * 0.75 - 12 && L.x + L.w <= xMax(L.y, L.h) - 4;
  const place = (P, text, taken, avoid) => {
    const w = estimate(text);
    const cx0 = P.x + P.w / 2;
    const cy0 = P.y + P.h / 2;
    const xs = [];
    for (let i = 0; i <= 16; i++) xs.push(W * (0.14 + i * 0.045) - w / 2);
    const tries = [];
    [1, 0.55, 1.6, 2.3].forEach((r, j) => xs.forEach((x) => {
      tries.push({ x, y: banded1 ? B1.top - 36 - LH - j * (LH + 20) : P.y - RISE * r - 40 - LH, side: 0.12 * j });
      tries.push({ x, y: banded1 ? B1.top + B1.height + 36 + j * (LH + 20) : P.y + P.h + RISE * r, side: 0.35 + 0.12 * j });
    }));
    [-0.25, 0, 0.25].forEach((d) => {
      tries.push({ x: P.x + P.w + 40, y: cy0 - LH / 2 + d * P.h, side: 0.5 });
      tries.push({ x: P.x - 40 - w, y: cy0 - LH / 2 + d * P.h, side: 0.5 });
    });
    let best = null;
    tries.forEach((c) => {
      const L = { x: Math.round(c.x), y: Math.round(c.y), w, h: LH };
      if (!safe(L) || taken.some((o) => overlap(L, o) > 0)) return;
      const light = banded1 || n < 2 ? null : LightUnder(shots[1], firstOf(1), B1, { x: L.x, y: L.y, w: L.w, h: L.h });
      // White words need the darkest place: what is brightest under them (a plate's rim) counts most.
      const cost = 6 * avoid.reduce((s, o) => s + overlap(L, o), 0) + 3 * overlap(L, P) + Math.hypot(L.x + L.w / 2 - cx0, L.y + L.h / 2 - cy0) / (2 * W) + c.side + (light ? 2.5 * Math.max(0, light.high - 0.6) + Math.max(0, light.mean - 0.45) : 0);
      if (!best || cost < best.cost) best = { ...L, cost };
    });
    return best;
  };
  // Nowhere: the original's place, moved down off the other name.
  const fallback = (fx, fy, text, taken) => {
    const w = estimate(text);
    const L = { x: Math.round(within(W * fx - w / 2, 44, W - 144 - w)), y: Math.round(H * fy - LH / 2), w, h: LH };
    while (taken.some((o) => overlap(L, o) > 0) && L.y + 2 * LH < H * 0.75) L.y += LH + 16;
    return L;
  };
  const names = React.useMemo(() => {
    const out = [];
    if (captions[0]) out.push({ t: captions[0], P: reads.p1, L: place(reads.p1, captions[0].text, [], [reads.p2]) || fallback(0.565, 0.249, captions[0].text, []) });
    if (captions[1]) {
      const taken = out.map((o) => o.L);
      out.push({ t: captions[1], P: reads.p2, L: place(reads.p2, captions[1].text, taken, [reads.p1]) || fallback(0.741, 0.458, captions[1].text, taken) });
    }
    return out;
  }, [reelTexts, reads, F]);
  const arrowOf = (P, L) => {
    const above = L.y + L.h <= P.y + 6;
    const below = L.y >= P.y + P.h - 6;
    const lx = L.x + L.w / 2;
    const tail = { x: within(lx, P.x + P.w * 0.25, P.x + P.w * 0.75), y: above ? P.y + P.h * 0.08 : below ? P.y + P.h * 0.92 : P.y + P.h * 0.5 };
    const head = { x: lx + (tail.x < lx ? -0.14 : 0.14) * L.w, y: above ? L.y + L.h + 16 : below ? L.y - 16 : L.y + L.h / 2 };
    return Math.hypot(head.x - tail.x, head.y - tail.y) >= 60 ? { tail, head } : null;
  };
  const inkOf = (L) => {
    if (banded1 || n < 2) return "#ffffff";
    const light = LightUnder(shots[1], firstOf(k1), B1, { x: L.x, y: L.y, w: L.w, h: L.h });
    return light && light.mean > 0.62 ? (brand.palette && brand.palette.dark) || "#121110" : "#ffffff";
  };
  // A hand-drawn arrow from the product to the word, drawn at once, over a thin edge of the other tone (it still reads
  // where it crosses a white plate or a dark table).
  const arrowNodes = (i, a, ink, from) => {
    const dark = ink !== "#ffffff";
    const box = { x: Math.min(a.tail.x, a.head.x), y: Math.min(a.tail.y, a.head.y), w: Math.abs(a.head.x - a.tail.x) + 1, h: Math.abs(a.head.y - a.tail.y) + 1 };
    const stroke = (key, color, width) => h(Scribble, { key, kind: "arrow", from: a.tail, to: a.head, box, at: from - 1, frames: 1, color, width, wobble: 0.6, seed: "curseur-" + i });
    const w = Math.max(4, Math.round(H * 0.0032));
    return [stroke("edge-" + i, dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.38)", w + 4), stroke("arrow-" + i, ink, w)];
  };
  const labels = names.flatMap((o, i) => {
    if (frame < o.t.from || frame >= o.t.to) return [];
    const ink = inkOf(o.L);
    const dark = ink !== "#ffffff";
    const arrow = arrowOf(o.P, o.L);
    const word = h(FitText, { key: "name-" + i + "-" + keep(o.t.text), style: { position: "absolute", left: o.L.x, top: o.L.y, width: o.L.w, height: o.L.h }, innerStyle: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: F, lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", color: ink, textShadow: dark ? "0 1px 10px rgba(255,255,255,0.45)" : "0 2px 12px rgba(0,0,0,0.5), 0 0 3px rgba(0,0,0,0.25)", whiteSpace: "nowrap", textAlign: "center" } }, keep(o.t.text));
    return [...(arrow ? arrowNodes(i, arrow, ink, o.t.from) : []), word];
  });

  // 4. Her ending card (in option): the cursor comes back and clicks, her title pops up in the same capitals, her line under it.
  const card = end && frame >= endAt
    ? h("div", { key: "card" },
        h(FitText, { key: "card-" + keep(end.title), style: { position: "absolute", left: 90, top: Math.round(H * 0.22), width: W - 180, height: Math.round(H * 0.08) }, innerStyle: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: Math.round(H * 0.064), lineHeight: 1, textTransform: "uppercase", color: "#ffffff", textShadow: "0 2px 12px rgba(0,0,0,0.4)", textAlign: "center", textWrap: "balance" } }, keep(end.title)),
        end.subtitle ? h(FitText, { key: "cardline-" + keep(end.subtitle), style: { position: "absolute", left: 120, top: Math.round(H * 0.31), width: W - 240, height: Math.round(H * 0.045) }, innerStyle: { fontFamily: textFont, fontWeight: 600, fontSize: 52, lineHeight: 1.1, color: "#ffffff", textShadow: "0 2px 10px rgba(0,0,0,0.45)", textAlign: "center" } }, keep(end.subtitle)) : null)
    : null;

  // 5. The cursor: its keyframes (it glides from one to the next in a straight line at an even pace, still between),
  // in from the left edge, out by the bottom left; back for her card.
  const t5 = (() => {
    const busy = names.map((o) => o.L).concat([reads.p1, reads.p2]);
    const spots = [[0.828, 0.554], [0.17, 0.554], [0.828, 0.33], [0.17, 0.33]].map((s) => at(B1, s[0], s[1]));
    return spots.find((p) => !busy.some((b) => p.x >= b.x - 30 && p.x <= b.x + b.w + 30 && p.y >= b.y - 30 && p.y <= b.y + b.h + 30)) || spots[0];
  })();
  const t6 = at(B1.height < H ? FULL : B1, 0.622, 0.2);
  const keys = [
    [T.enter, { x: -W * 0.03, y: H * 0.391 }],
    [T.reach, { x: reads.t1.x - W * 0.015, y: Math.min(H * 0.9, reads.t1.y + H * 0.09) }],
    [T.at1, reads.t1],
    [T.go2, reads.t1],
    [T.at2, reads.t2],
    [T.zoom, reads.t2],
    [T.at3, { x: c1.x - W * 0.007, y: c1.y - H * 0.009 }],
    [T.near3, c1],
    [T.go4, c1],
    [T.at4, c2],
    [T.go5, c2],
    [T.at5, t5],
    [T.drift, t5],
    [T.drifted, { x: t5.x + W * 0.004, y: t5.y - H * 0.062 }],
    [T.go6, { x: t5.x + W * 0.004, y: t5.y - H * 0.062 }],
    [T.at6, t6],
    [T.go7, t6],
    [T.at7, reads.t7],
    [T.go8, reads.t7],
    [T.out, { x: W * 0.007, y: H * 0.825 }],
    [T.out + 8, { x: -W * 0.12, y: H * 0.86 }],
  ];
  if (end) keys.push([endAt - 16, { x: W * 1.05, y: H * 0.62 }], [endAt - 2, { x: W * 0.56, y: H * 0.4 }]);
  const away = end ? frame > T.out + 8 && frame < endAt - 16 : frame > T.out + 8;
  const clicks = [T.pause, T.zoom, T.label1, T.label2, T.clear, T.dbl, T.back, T.play].concat(end ? [endAt] : []);
  const pointer = (() => {
    if (frame < T.enter || away) return null;
    let p = keys[0][1];
    for (let i = 0; i < keys.length; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (frame >= a[0]) p = a[1];
      if (b && frame > a[0] && frame < b[0]) { const t = (frame - a[0]) / (b[0] - a[0]); p = { x: a[1].x + (b[1].x - a[1].x) * t, y: a[1].y + (b[1].y - a[1].y) * t }; break; }
    }
    // The classic pixel arrow (12 × 19), white with its black outline; pressed in for an image on a click, about its centre.
    const ROWS = ["B", "BB", "BWB", "BWWB", "BWWWB", "BWWWWB", "BWWWWWB", "BWWWWWWB", "BWWWWWWWB", "BWWWWWWWWB", "BWWWWWWWWWB", "BWWWWWWBBBBB", "BWWWBWWB", "BWWBBWWB", "BWB  BWWB", "BB   BWWB", "B     BWWB", "      BWWB", "       BB"];
    const runs = { B: "", W: "" };
    ROWS.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const c = row[x];
        let e = x;
        while (e < row.length && row[e] === c) e++;
        if (c === "B" || c === "W") runs[c] += "M" + x + " " + y + "h" + (e - x) + "v1h" + (x - e) + "z";
        x = e;
      }
    });
    const press = clicks.indexOf(frame) >= 0 ? 0.69 : clicks.indexOf(frame - 1) >= 0 || clicks.indexOf(frame + 1) >= 0 ? 0.84 : 1;
    const PX = Math.max(5, Math.round(H * (B0 === BAND && B1 === BAND && B2 === BAND ? 0.0036 : 0.0045)));
    const size = PX * press;
    return h("svg", { key: "cursor", width: 12 * size, height: 19 * size, viewBox: "0 0 12 19", shapeRendering: "crispEdges", style: { position: "absolute", left: Math.round(p.x + 6 * PX * (1 - press)), top: Math.round(p.y + 9.5 * PX * (1 - press)) } },
      h("path", { d: runs.W, fill: "#ffffff" }),
      h("path", { d: runs.B, fill: "#000000" }));
  })();

  // Any other text of the Reel (none in its slots): a plain line high in the frame, so nothing she wrote is lost.
  const others = reelTexts.filter((t) => t.role !== "caption" && frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 140 + i * 110, width: W - 280, height: 100 }, innerStyle: { fontFamily: textFont, fontWeight: 700, fontSize: 52, color: "#ffffff", textShadow: "0 2px 10px rgba(0,0,0,0.4)", textAlign: "center" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, picture, labels, others, card, pointer);
}`;

export const curseur: MontageSkill = {
  key: "curseur",
  version: 1,
  bpm: BPM,
  // Her place, her products close, her place again (the same video, from where it stopped).
  shots: [3, 3],
  files: [2, 3],
  // A gesture's pace: 9,4 s at 104 BPM, 12,9 s at 76 (its clicks, its holds and its glides all follow).
  tempo: [76, 104],
  how: "Un curseur d'ordinateur (la flèche blanche en pixels) se pose sur sa vidéo comme sur un écran : un clic met la vidéo en pause et coupe la musique ; un clic sur ce que tient la personne ouvre la photo de près de ses produits ; un clic sur chacun écrit son nom en grandes capitales blanches avec une flèche dessinée à la main ; un clic les efface, un double clic revient sur la vidéo arrêtée, et un dernier clic la relance avec la musique pendant que le curseur s'en va. Chaque clic s'entend dans le silence. En vertical plein écran ; une vidéo horizontale entière dans une bande 16:9 sur du noir.",
  end: true,
  texts: [
    {
      slot: "produit1",
      role: "caption",
      want: "le nom du produit de la photo de près sur lequel la souris clique en premier (le plus haut, ou celui de gauche), en un à trois mots comme sur sa carte ou son étiquette (une forme comme « Cappuccino », « Pain au chocolat », « Pivoines ») ; jamais une phrase, rien d'inventé",
      max: 18,
      required: true,
    },
    {
      slot: "produit2",
      role: "caption",
      want: "facultatif : le nom du second produit de la photo de près, en un à trois mots de la même façon (une forme comme « Brownie », « Flat white ») ; vide quand on n'en voit qu'un",
      max: 18,
      required: false,
    },
  ],
  objects: [
    { slot: "produit1", shot: 1, want: "son premier produit sur la photo de près (le plus haut, ou celui de gauche), nommé en anglais comme l'œil le voit (« cappuccino cup », « croissant », « bouquet of peonies »)" },
    { slot: "produit2", shot: 1, want: "le second produit de la photo de près, nommé de même ; aucun quand on n'en voit qu'un" },
  ],
  settings: [
    {
      name: "format",
      want: "le format : comme ses vidéos, vertical plein écran, ou ses vidéos horizontales entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme ses vidéos (une vidéo verticale plein écran, une horizontale entière dans une bande sur du noir)" },
        { value: "vertical", says: "tout en vertical plein écran, ses vidéos horizontales recadrées" },
        { value: "horizontal", says: "tout dans une bande 16:9 sur du noir, les noms de ses produits sur le noir" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, a music's own): every moment counted in beats follows it.
    const bpm = tempo ?? BPM;
    const scale = BPM / bpm;
    // With an ending card, its time after the original's length on the half-beat grid (the engine's 1,6 s at least).
    const half = 30 / bpm;
    const card = end ? Math.ceil((END_CARD + 0.05) / half) / 2 : 0;
    const spans = beatSpans(bpm, [HELD / BEAT, (CURSEUR_MOMENTS.play - HELD) / BEAT, (LENGTH - CURSEUR_MOMENTS.play) / BEAT + card]);
    const duration = spans[2]!.end;
    const marks = Object.fromEntries(Object.entries(CURSEUR_MOMENTS).map(([k, v]) => [k, Math.round(v * scale)])) as Record<keyof typeof CURSEUR_MOMENTS, number>;
    const s = (frames: number) => round3(frames / 30);
    const d0 = spans[0]!.end;
    const d2 = round(duration - spans[2]!.start);
    const wants = [
      `sa vidéo de son lieu filmée téléphone posé, de préférence en vertical, où quelqu'un de l'équipe sort, passe ou s'avance avec ce qu'elle vend à la main (un plateau, des assiettes, un bouquet, un produit) ; à défaut n'importe quelle vidéo de son lieu où quelqu'un bouge : son passage joue ${comma(d0)} s puis se met en pause d'un clic sur sa dernière image, la personne et ce qu'elle tient bien visibles`,
      `une photo de près de deux de ses produits côte à côte, nets et bien séparés, avec un peu de place libre autour (deux plats, deux pâtisseries, deux boissons, deux pièces, un bouquet), de préférence ceux que tient la personne du premier plan ; à défaut une photo ou une vidéo de près de ce qu'elle vend ou fait (une vidéo est tenue sur sa première image) : on la voit en pause pendant que la souris clique sur chacun et écrit son nom`,
      `la suite de la même vidéo que le premier plan, depuis l'instant où il se met en pause (son départ plus ${comma(d0)} s) : elle reste en pause puis repart d'un clic et joue ${comma(d2)} s (la personne s'en va, sert, continue) ; à défaut une autre vidéo de son lieu où quelqu'un passe, d'au moins ${comma(d2)} s`,
    ];
    const card0 = end ? round3(duration - END_CARD) : null;
    return {
      duration,
      shots: spans.map((sp, i) => ({ ...sp, want: wants[i]! })),
      // Her names on their clicks, cleared together; at another tempo, on their clicks still.
      texts: { produit1: { from: s(marks.label1), to: s(marks.clear) }, produit2: { from: s(marks.label2), to: s(marks.clear) } },
      marks,
      // Nothing of her is cut out: its products are found by their names on the close-up's held image.
      cutouts: [],
      // Each click heard: a computer mouse's, alone in the silence (and over the music for the first and the last).
      sounds: [...CURSEUR_CLICKS.map((c) => ({ at: s(marks[c]), sound: "computer mouse click", seconds: 0.5, gain: 2 })), ...(card0 !== null ? [{ at: card0, sound: "computer mouse click", seconds: 0.5, gain: 2 }] : [])],
      // The music plays until the first click, stops dead, and comes back on the last one (on a beat), to the end.
      music: { pauses: [{ from: s(marks.pause), to: s(marks.play) }], end: { at: duration, fade: 0.05 } },
    };
  },
  code: CODE,
};
