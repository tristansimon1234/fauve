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
//              with three products, a click a beat (83, 103, 123) and the clear at 174 (CURSEUR_THREE). Since v3, each
//              name only on the product it names, found on that very picture (as many as it shows), its arrow only when
//              it points at it; a product not found there: its name alone, no arrow;
//   161 – 238  the cursor rises to the top, a double click (194, 199) goes back to her place, held on the image where it
//              stopped; it glides down onto the person and clicks (238): the video plays on and the music comes back;
//   238 – 326  her place plays (the person walks off); the cursor slides out by the bottom left (282).
// Each click heard (a computer mouse click, alone in the silence). Its words: the names of her products her close-up
// shows (one to three); nothing of the original's own (its restaurant's name and sign, its dishes' names, its chicks).
// Vertical full frame by default (Tristan: « tout vertical please »); on her word, her videos whole in a 16:9 band on
// black (its names then on the black above or below, their arrows into the picture), or each as filmed.

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
  go4b: 114,
  at4b: 130,
  label3: 135,
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
/**
 * Its moments when her close-up shows three products (v3): a click every 20 images (a beat) from the first name, the
 * third read 1,7 s like the second of two, the clear later and the rise to the double click quicker, the rest as before
 * (its length never changes with her words).
 */
export const CURSEUR_THREE = { at4: 98, label2: 103, go4b: 108, at4b: 118, label3: 123, go5: 157, at5: 169, clear: 174, drift: 176, drifted: 180, go6: 181, at6: 189 } as const;
/** Its clicks, each one heard: the pause, the close-up, her names (two by default), clearing them, the double click back, the play. */
export const CURSEUR_CLICKS = ["pause", "zoom", "label1", "label2", "clear", "dbl", "back", "play"] as const;
/** Its names, a slot each, in the order the cursor clicks them. */
const NAMES = ["produit1", "produit2", "produit3"] as const;
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
  [["enter", 10], ["reach", 29], ["at1", 31], ["pause", 40], ["go2", 54], ["at2", 65], ["zoom", 68], ["at3", 75], ["near3", 80], ["label1", 83], ["go4", 88], ["at4", 104], ["label2", 109], ["go4b", 114], ["at4b", 130], ["label3", 135], ["go5", 144], ["at5", 156], ["clear", 161], ["drift", 164], ["drifted", 172], ["go6", 173], ["at6", 185], ["dbl", 194], ["back", 199], ["go7", 219], ["at7", 233], ["play", 238], ["go8", 245], ["out", 282]].forEach((x) => { T[x[0]] = Math.round(mark(x[0], x[1])); });

  // 1. Each shot in its box, as her videos are (an upright one full frame, a horizontal one whole in a 16:9 band on
  // black), or as her words ask: all full frame, or all in the band.
  const format = setting("format", "vertical");
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
    // Each product on the close-up's held image, by the name its filler gave it (written here, so only it is followed);
    // the same thing found under two names (a box mostly inside the other's) is the first one's: never named twice.
    const box = (b) => (b && b.w > 12 && b.h > 12 ? { x: b.x, y: b.y, w: b.w, h: b.h } : null);
    const finds = n > 1;
    const raw = [
      box(finds ? SubjectBox(shots[1], firstOf(1), B1, "@produit1") : null),
      box(finds ? SubjectBox(shots[1], firstOf(1), B1, "@produit2") : null),
      box(finds ? SubjectBox(shots[1], firstOf(1), B1, "@produit3") : null),
    ];
    const same = (a, b) => {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const hh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return w > 0 && hh > 0 && (w * hh) / Math.min(a.w * a.h, b.w * b.h) > 0.6;
    };
    // What of it the frame shows (her horizontal close-up cropped upright shows its middle only): half of it at least,
    // else it is not on her picture (its bench: « brownie » found off the right edge, its arrow from the edge).
    const seen = (b) => {
      const w = Math.min(b.x + b.w, B1.left + B1.width) - Math.max(b.x, B1.left);
      const hh = Math.min(b.y + b.h, B1.top + B1.height) - Math.max(b.y, B1.top);
      return w > 0 && hh > 0 && (w * hh) / (b.w * b.h) >= 0.5 ? { x: Math.max(b.x, B1.left), y: Math.max(b.y, B1.top), w, h: hh } : null;
    };
    const shown = raw.map((b) => (b ? seen(b) : null));
    const products = shown.map((b, i) => (b && !shown.slice(0, i).some((o) => o && same(o, b)) ? b : null));
    return {
      t1: inside(p0 ? side(p0) : at(B0, 0.676, 0.632)),
      t2: inside(p0 ? holds(p0) : at(B0, 0.474, 0.602)),
      t7: inside(p2 ? holds(p2) : at(B2, 0.5, 0.62)),
      raw: shown,
      products,
      // Found but not on her picture, or the same thing as one before it: its name never written.
      twice: raw.map((b, i) => Boolean(b) && !products[i]),
    };
  }, [track, n, format]);

  // 3. Her products' names, as many as her close-up shows (one, two or three): each one on the product it names, found
  // on that very picture, in the free space near it (above it first, else below it or beside it; in a band, on the
  // black above or below the picture), never on another product nor on another name, inside the safe zone: big white
  // condensed capitals (dark ink on a bright place), a hand-drawn arrow from the product to the word only when it points
  // at it without crossing another; there at once on its click, gone at once on the click that clears them. A product
  // not found there (nothing followed on her picture): its name alone, no arrow, in a free calm place, away from those
  // found. Tristan, 6 November: « il a calé "brownie" sur le café », « plus flex, place les flèches si c'est pertinent ».
  const captions = reelTexts.filter((t) => t.role === "caption");
  const LABELS = [T.label1, T.label2, T.label3];
  // Each caption is the product whose click it appears on.
  const slotOf = (t) => LABELS.reduce((b, f, i) => (Math.abs(t.from - f) < Math.abs(t.from - LABELS[b]) ? i : b), 0);
  const found = reads.products.filter(Boolean);
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
  const mid = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  // Whether a straight line from a to b runs over a box (its inner part): an arrow there would point at it.
  const crosses = (a, b, o) => {
    for (let s = 0.12; s <= 0.9; s += 0.06) {
      const x = a.x + (b.x - a.x) * s;
      const y = a.y + (b.y - a.y) * s;
      if (x > o.x + o.w * 0.12 && x < o.x + o.w * 0.88 && y > o.y + o.h * 0.12 && y < o.y + o.h * 0.88) return true;
    }
    return false;
  };
  // What is under a place on the close-up's held image (white words need the darkest: what is brightest counts most).
  const lightCost = (L) => {
    const light = banded1 || n < 2 ? null : LightUnder(shots[1], firstOf(1), B1, { x: L.x, y: L.y, w: L.w, h: L.h });
    return light ? 2.5 * Math.max(0, light.high - 0.6) + Math.max(0, light.mean - 0.45) : 0;
  };
  // Every place tried: above its product (at four heights), below it, beside it; inside the safe zone and off the other
  // names, the cheapest kept: off the other products and its own, near it, above it first, its arrow over no other
  // product, on a calm dark place of the picture.
  const safe = (L) => L.x >= 44 && L.y >= 100 && L.y + L.h <= H * 0.75 - 12 && L.x + L.w <= xMax(L.y, L.h) - 4;
  const place = (P, text, taken, avoid) => {
    const w = estimate(text);
    const cx0 = P.x + P.w / 2;
    const cy0 = P.y + P.h / 2;
    const xs = [];
    for (let i = 0; i <= 16; i++) xs.push(W * (0.14 + i * 0.045) - w / 2);
    const tries = [];
    [1, 0.55, 1.6, 2.3, 0.2, 3].forEach((r, j) => xs.forEach((x) => {
      tries.push({ x, y: banded1 ? B1.top - 36 - LH - j * (LH + 20) : P.y - RISE * r - 40 - LH, side: 0.12 * j });
      tries.push({ x, y: banded1 ? B1.top + B1.height + 36 + j * (LH + 20) : P.y + P.h + RISE * r, side: 0.35 + 0.12 * j });
    }));
    [-0.25, 0, 0.25].forEach((d) => {
      tries.push({ x: P.x + P.w + 40, y: cy0 - LH / 2 + d * P.h, side: 0.5 });
      tries.push({ x: P.x - 40 - w, y: cy0 - LH / 2 + d * P.h, side: 0.5 });
    });
    // Off every other product first (never a name on another product); only when there is no such place, the cheapest.
    let best = null;
    let clear = null;
    tries.forEach((c) => {
      const L = { x: Math.round(c.x), y: Math.round(c.y), w, h: LH };
      if (!safe(L) || taken.some((o) => overlap(L, o) > 0)) return;
      const crossing = avoid.some((o) => crosses(mid(P), mid(L), o)) ? 2 : 0;
      const on = avoid.reduce((s, o) => s + overlap(L, o), 0);
      const cost = 6 * on + 3 * overlap(L, P) + crossing + Math.hypot(L.x + L.w / 2 - cx0, L.y + L.h / 2 - cy0) / (2 * W) + c.side + lightCost(L);
      if (!best || cost < best.cost) best = { ...L, cost };
      if (on === 0 && (!clear || cost < clear.cost)) clear = { ...L, cost };
    });
    return clear || best;
  };
  // A name whose product was not found on her picture: alone, in a free calm place off every product found and every
  // name (in a band, on the black above or below it), one under the other in their order.
  const loose = (text, taken, i) => {
    const w = estimate(text);
    const rows = banded1 ? [0, 1, 2].flatMap((j) => [B1.top - 36 - LH - j * (LH + 20), B1.top + B1.height + 36 + j * (LH + 20)]) : Array.from({ length: 12 }, (_, r) => Math.round(H * (0.12 + r * 0.05)));
    let best = null;
    let clear = null;
    rows.forEach((y) => {
      for (let c = 0; c <= 8; c++) {
        const L = { x: Math.round(W * (0.14 + c * 0.09) - w / 2), y, w, h: LH };
        if (!safe(L) || taken.some((o) => overlap(L, o) > 0)) continue;
        const on = found.reduce((s, o) => s + overlap(L, o), 0);
        const cost = 6 * on + Math.abs(L.y - H * (0.2 + 0.09 * i)) / H + Math.abs(L.x + w / 2 - W / 2) / (2 * W) + lightCost(L);
        if (!best || cost < best.cost) best = { ...L, cost };
        if (on === 0 && (!clear || cost < clear.cost)) clear = { ...L, cost };
      }
    });
    return clear || best;
  };
  const names = React.useMemo(() => {
    const out = [];
    captions.forEach((t) => {
      const i = slotOf(t);
      // A thing found under the name of one before it: the same product, never named twice.
      if (reads.twice[i] || out.some((o) => o.i === i)) return;
      const P = reads.products[i];
      const taken = out.map((o) => o.L);
      const L = (P && place(P, t.text, taken, found.filter((o) => o !== P))) || loose(t.text, taken, i);
      if (L) out.push({ t, i, P, L });
    });
    return out;
  }, [reelTexts, reads, F]);
  // Its arrow only when it points at its product: from its edge to the word, long enough to be one, never over another.
  const arrowOf = (P, L) => {
    // None when the word lies on its product already (a cup that fills the picture): it names what it is on.
    if (!P || overlap(L, P) > 0.3) return null;
    const above = L.y + L.h <= P.y + 6;
    const below = L.y >= P.y + P.h - 6;
    const lx = L.x + L.w / 2;
    const tail = { x: within(lx, P.x + P.w * 0.25, P.x + P.w * 0.75), y: above ? P.y + P.h * 0.08 : below ? P.y + P.h * 0.92 : P.y + P.h * 0.5 };
    const head = { x: lx + (tail.x < lx ? -0.14 : 0.14) * L.w, y: above ? L.y + L.h + 16 : below ? L.y - 16 : L.y + L.h / 2 };
    const length = Math.hypot(head.x - tail.x, head.y - tail.y);
    return length >= 60 && length <= H * 0.32 && !found.some((o) => o !== P && crosses(tail, head, o)) ? { tail, head } : null;
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
  // Its click for each name: on its product, a little right of its middle and above (the original's, on the dish); a
  // name alone, just under it (the place it appears on); the same thing under another name: on it again (nothing
  // written); none for a slot without a name.
  const said = [0, 1, 2].map((i) => captions.some((t) => slotOf(t) === i));
  const clickAt = (i) => {
    const o = names.find((x) => x.i === i);
    if (o && o.P) return inside({ x: o.P.x + o.P.w * 0.58, y: o.P.y + o.P.h * 0.4 });
    if (o) return inside({ x: o.L.x + o.L.w * 0.6, y: o.L.y + o.L.h + 30 });
    const b = reads.raw[i];
    return said[i] && reads.twice[i] && b ? inside({ x: b.x + b.w * 0.58, y: b.y + b.h * 0.4 }) : null;
  };
  const cs = [0, 1, 2].map(clickAt);
  const t5 = (() => {
    const busy = names.map((o) => o.L).concat(found);
    const spots = [[0.828, 0.554], [0.17, 0.554], [0.828, 0.33], [0.17, 0.33], [0.5, 0.68]].map((s) => at(B1, s[0], s[1]));
    return spots.find((p) => !busy.some((b) => p.x >= b.x - 30 && p.x <= b.x + b.w + 30 && p.y >= b.y - 30 && p.y <= b.y + b.h + 30)) || spots[0];
  })();
  // Its double click high in the frame (the original's, at the top of its close-up).
  const t6 = at(FULL, 0.622, 0.2);
  const keys = [
    [T.enter, { x: -W * 0.03, y: H * 0.391 }],
    [T.reach, { x: reads.t1.x - W * 0.015, y: Math.min(H * 0.9, reads.t1.y + H * 0.09) }],
    [T.at1, reads.t1],
    [T.go2, reads.t1],
    [T.at2, reads.t2],
    [T.zoom, reads.t2],
  ];
  // From one product to the next, in a straight line, still on each one's click.
  const goes = [T.zoom, T.go4, T.go4b];
  const arrives = [T.near3, T.at4, T.at4b];
  cs.forEach((c, i) => {
    if (!c) return;
    const last = keys[keys.length - 1];
    if (i === 0) keys.push([T.at3, { x: c.x - W * 0.007, y: c.y - H * 0.009 }], [T.near3, c]);
    else keys.push([Math.max(goes[i], last[0] + 1), last[1]], [Math.max(arrives[i], last[0] + 2), c]);
  });
  const rest = keys[keys.length - 1][1];
  keys.push(
    [Math.max(T.go5, keys[keys.length - 1][0] + 1), rest],
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
  );
  if (end) keys.push([endAt - 16, { x: W * 1.05, y: H * 0.62 }], [endAt - 2, { x: W * 0.56, y: H * 0.4 }]);
  const away = end ? frame > T.out + 8 && frame < endAt - 16 : frame > T.out + 8;
  // Its clicks: a name's only when it has one (as its timeline's sounds, which follow her words).
  const clicks = [T.pause, T.zoom].concat(LABELS.filter((f, i) => said[i]), [T.clear, T.dbl, T.back, T.play], end ? [endAt] : []);
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
  // 2: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  // 3: each name on the product it names, found on that very picture, as many as it shows (one to three), its arrow only
  // when it points at it; never a product her request names that her picture does not show (Tristan, 6 November, on its
  // production bench: « il a calé "brownie" sur le café », then « plus flex, place les flèches si c'est pertinent quoi »).
  version: 3,
  bpm: BPM,
  // Her place, her products close, her place again (the same video, from where it stopped).
  shots: [3, 3],
  files: [2, 3],
  // A gesture's pace: 9,4 s at 104 BPM, 12,9 s at 76 (its clicks, its holds and its glides all follow).
  tempo: [76, 104],
  how: "Un curseur d'ordinateur (la flèche blanche en pixels) se pose sur sa vidéo comme sur un écran : un clic met la vidéo en pause et coupe la musique ; un clic sur ce que tient la personne ouvre la photo de près de ses produits ; un clic sur chacun de ceux qu'elle montre (un, deux ou trois) écrit son nom en grandes capitales blanches, là où il est, avec une flèche dessinée à la main quand elle a quelque chose à montrer ; un clic les efface, un double clic revient sur la vidéo arrêtée, et un dernier clic la relance avec la musique pendant que le curseur s'en va. Chaque clic s'entend dans le silence. En vertical plein écran ; une vidéo horizontale entière dans une bande 16:9 sur du noir à sa demande.",
  end: true,
  texts: [
    {
      slot: "produit1",
      role: "caption",
      want: "le nom du produit que montre la photo de près, sur lequel la souris clique en premier (le plus haut, ou celui de gauche), en un à trois mots comme sur sa carte ou son étiquette (une forme comme « Cappuccino », « Pain au chocolat », « Pivoines ») ; un produit qu'on voit sur cette photo, jamais un autre que sa demande nomme ; jamais une phrase, rien d'inventé",
      max: 18,
      required: true,
      names: "produit1",
    },
    {
      slot: "produit2",
      role: "caption",
      want: "facultatif : le nom d'un deuxième produit qu'on voit sur la photo de près, en un à trois mots de la même façon (une forme comme « Brownie », « Flat white ») ; vide quand elle n'en montre qu'un, même si sa demande en nomme un autre",
      max: 18,
      required: false,
      names: "produit2",
    },
    {
      slot: "produit3",
      role: "caption",
      want: "facultatif : le nom d'un troisième produit qu'on voit sur la photo de près, de la même façon ; vide quand elle n'en montre pas trois",
      max: 18,
      required: false,
      names: "produit3",
    },
  ],
  objects: [
    { slot: "produit1", shot: 1, want: "son premier produit sur la photo de près (le plus haut, ou celui de gauche), nommé en anglais comme l'œil le voit (« cappuccino cup », « croissant », « bouquet of peonies »)" },
    { slot: "produit2", shot: 1, want: "un deuxième produit qu'on voit sur la photo de près, une autre chose que le premier, nommé de même ; aucun quand elle n'en montre qu'un" },
    { slot: "produit3", shot: 1, want: "un troisième produit qu'on voit sur la photo de près, une autre chose que les deux premiers, nommé de même ; aucun quand elle n'en montre pas trois" },
  ],
  settings: [
    {
      name: "format",
      want: "le format : tout en vertical plein écran, ses vidéos horizontales entières dans une bande 16:9 sur du noir, ou comme ses vidéos",
      choices: [
        { value: "vertical", says: "tout en vertical plein écran, ses vidéos horizontales recadrées" },
        { value: "horizontal", says: "tout dans une bande 16:9 sur du noir, les noms de ses produits sur le noir", band: true },
        { value: "auto", says: "comme ses vidéos (une vidéo verticale plein écran, une horizontale entière dans une bande sur du noir)" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo, words }) {
    // At another tempo (a longer Reel, a music's own): every moment counted in beats follows it.
    const bpm = tempo ?? BPM;
    const scale = BPM / bpm;
    // With an ending card, its time after the original's length on the half-beat grid (the engine's 1,6 s at least).
    const half = 30 / bpm;
    const card = end ? Math.ceil((END_CARD + 0.05) / half) / 2 : 0;
    const spans = beatSpans(bpm, [HELD / BEAT, (CURSEUR_MOMENTS.play - HELD) / BEAT, (LENGTH - CURSEUR_MOMENTS.play) / BEAT + card]);
    const duration = spans[2]!.end;
    // Her names as written (the plan's), else its two by default: a third one clicks on its own beat; a slot left empty
    // is never clicked nor heard.
    const has = (slot: (typeof NAMES)[number]) => (words ? Boolean(words[slot]?.trim()) : slot !== "produit3");
    const moments = has("produit3") ? { ...CURSEUR_MOMENTS, ...CURSEUR_THREE } : CURSEUR_MOMENTS;
    const marks = Object.fromEntries(Object.entries(moments).map(([k, v]) => [k, Math.round(v * scale)])) as Record<keyof typeof CURSEUR_MOMENTS, number>;
    const labels = { produit1: "label1", produit2: "label2", produit3: "label3" } as const;
    const clicks = [...CURSEUR_CLICKS.filter((c) => c !== "label2" || has("produit2")), ...(has("produit3") ? (["label3"] as const) : [])].sort((a, b) => marks[a] - marks[b]);
    const s = (frames: number) => round3(frames / 30);
    const d0 = spans[0]!.end;
    const d2 = round(duration - spans[2]!.start);
    const wants = [
      `sa vidéo de son lieu filmée téléphone posé, de préférence en vertical, où quelqu'un de l'équipe sort, passe ou s'avance avec ce qu'elle vend à la main (un plateau, des assiettes, un bouquet, un produit) ; à défaut n'importe quelle vidéo de son lieu où quelqu'un bouge : son passage joue ${comma(d0)} s puis se met en pause d'un clic sur sa dernière image, la personne et ce qu'elle tient bien visibles`,
      `une photo de près de un à trois de ses produits côte à côte, nets et bien séparés, avec un peu de place libre autour (deux plats, une boisson et une pâtisserie, deux pièces, un bouquet), de préférence ceux que tient la personne du premier plan et ceux que sa demande nomme ; à défaut une photo ou une vidéo de près de ce qu'elle vend ou fait (une vidéo est tenue sur sa première image) : on la voit en pause pendant que la souris clique sur chacun et écrit son nom là où il est`,
      `la suite de la même vidéo que le premier plan, depuis l'instant où il se met en pause (son départ plus ${comma(d0)} s) : elle reste en pause puis repart d'un clic et joue ${comma(d2)} s (la personne s'en va, sert, continue) ; à défaut une autre vidéo de son lieu où quelqu'un passe, d'au moins ${comma(d2)} s`,
    ];
    const card0 = end ? round3(duration - END_CARD) : null;
    return {
      duration,
      shots: spans.map((sp, i) => ({ ...sp, want: wants[i]! })),
      // Her names on their clicks, cleared together; at another tempo, on their clicks still.
      texts: Object.fromEntries(NAMES.map((slot) => [slot, { from: s(marks[labels[slot]]), to: s(marks.clear) }])),
      marks,
      // Nothing of her is cut out: its products are found by their names on the close-up's held image.
      cutouts: [],
      // Each click heard: a computer mouse's, alone in the silence (and over the music for the first and the last).
      sounds: [...clicks.map((c) => ({ at: s(marks[c]), sound: "computer mouse click", seconds: 0.5, gain: 2 })), ...(card0 !== null ? [{ at: card0, sound: "computer mouse click", seconds: 0.5, gain: 2 }] : [])],
      // The music plays until the first click, stops dead, and comes back on the last one (on a beat), to the end.
      music: { pauses: [{ from: s(marks.pause), to: s(marks.play) }], end: { at: duration, fade: 0.05 } },
    };
  },
  code: CODE,
};
