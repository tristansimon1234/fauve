import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Un clic sur tes produits », the effect (docs/fiches/curseur.md, effects 1, 2, 3, 4 and 6; its whole Reel is
// skills/curseur.ts, version 1): over her close-up of her products (or, before it, her video where someone carries them,
// then the close-up, cut on a click), a desktop cursor comes in from the left edge, the classic white pixel arrow with
// its black outline, gliding in straight lines at an even pace, pressed in for an image on each click (69 % of its size,
// about its centre), no ring, no shadow. A click: the picture freezes and the music stops dead; with two shots, a click
// on what the person holds lands on the cut and opens the close-up, held; a click on each of her products writes its name
// at once in big white condensed capitals in the free space near it (above it first, never on the other product nor on
// the other name, on a calm dark place; dark ink on a bright one), a hand-drawn arrow from the product to the word; a last
// click clears them and plays the video on from where it stopped, the music back on a whole beat; the cursor slides out
// by the bottom left; then the montage resumes. Each click heard (a computer mouse click). Kept from the model: its
// cursor, its press, its glides, its labels and their arrows, the pause of the picture and the music. Left out: its
// double click back to her place (the montage goes on with its next shot), its format setting (the montage frames her
// shots), its ending card (the Reel's is the engine's).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const list = shots || [];
  // Its shots: those that play during it, as the engine counts them (texts.mine), else as they fall in its span; the
  // last one is her close-up, the first (when there are two) her place where someone carries her products.
  const given = String((texts && texts.mine) || "").split(",").map((s) => Number(s)).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const kB = mine.length ? mine[mine.length - 1] : -1;
  const kA = mine.length > 1 ? mine[0] : -1;
  const BOX = { left: 0, top: 0, width: W, height: H };
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");

  // Its moments (frames from its start), as its timeline gives them.
  const CUT = kA >= 0 ? Math.max(0, list[kB].from) : -1;
  const ENTER = Math.round(mark("enter", Math.round(D * 0.03)));
  const PAUSE = Math.round(mark("pause", Math.round(D * 0.16)));
  const ZOOM = Math.round(mark("zoom", CUT));
  const L1 = Math.round(mark("label1", Math.round(D * 0.3)));
  const L2 = Math.round(mark("label2", Math.round(D * 0.42)));
  const PLAY = Math.round(mark("play", Math.round(D * 0.72)));
  const OUT = Math.round(mark("out", Math.round(D * 0.92)));

  // 1. Her picture frozen from the pause to the play: her place held on the image of the click, then (two shots) her
  // close-up held on its first image from the cut; from the play, the close-up plays on from where it stopped.
  const localAt = (k, f) => f - list[k].from;
  const heldOf = (k, from) => (frame >= from && frame < PLAY ? { at: frame - localAt(k, from) } : frame >= PLAY ? { at: PLAY - localAt(k, Math.min(PLAY, from)) } : {});
  const picture = (() => {
    if (kB < 0 || frame < PAUSE) return null;
    if (kA >= 0 && frame < CUT) return h(Footage, { key: "held-a", shot: kA, style: BOX, at: frame - localAt(kA, PAUSE) });
    const from = kA >= 0 ? Math.max(PAUSE, CUT) : PAUSE;
    return h(Footage, { key: "held-b", shot: kB, style: BOX, ...heldOf(kB, from) });
  })();

  // 2. Where the cursor goes: the person (her body and hands as tracked on the image where it stops), each of her products
  // on the close-up (found by their names on its held image); else the model's places.
  const firstSeen = kB >= 0 ? (kA >= 0 ? Math.max(PAUSE, CUT) : PAUSE) : 0;
  const inside = (p) => ({ x: within(p.x, W * 0.06, W * 0.9), y: within(p.y, H * 0.1, H * 0.88) });
  const reads = React.useMemo(() => {
    let person = null;
    if (kA >= 0 && typeof track === "function") {
      const seen = track(PAUSE, { shot: kA, ...BOX }) || {};
      const torso = [];
      const hands = [];
      (seen.bodies || []).forEach((b) => {
        const p = (b && b.points) || {};
        ["left_shoulder", "right_shoulder", "left_hip", "right_hip"].forEach((q) => { if (p[q] && p[q].visible && Number.isFinite(p[q].x)) torso.push(p[q]); });
        ["left_wrist", "right_wrist", "left_index", "right_index"].forEach((q) => { if (p[q] && p[q].visible && Number.isFinite(p[q].x)) hands.push(p[q]); });
      });
      (seen.hands || []).forEach((hd) => { const p = (hd && hd.points) || {}; ["wrist", "index_tip", "middle_tip"].forEach((q) => { if (p[q] && Number.isFinite(p[q].x)) hands.push(p[q]); }); });
      const mean = (l, a) => l.reduce((s, p) => s + p[a], 0) / l.length;
      if (torso.length || hands.length) person = { hand: hands.length ? { x: mean(hands, "x"), y: mean(hands, "y") } : null, right: torso.length ? Math.max.apply(null, torso.map((p) => p.x)) : null, mid: torso.length ? { x: mean(torso, "x"), y: mean(torso, "y") } : null };
    }
    const product = (b, fb) => (b && b.w > 12 && b.h > 12 ? { x: b.x, y: b.y, w: b.w, h: b.h, found: true } : { x: W * fb[0], y: H * fb[1], w: W * fb[2], h: H * fb[3], found: false });
    const finds = kB >= 0;
    return {
      t1: inside(person ? { x: (person.right !== null ? person.right : person.hand.x) + W * 0.11, y: person.hand ? person.hand.y + H * 0.04 : person.mid.y } : kA >= 0 ? { x: W * 0.676, y: H * 0.632 } : { x: W * 0.72, y: H * 0.58 }),
      t2: inside(person ? person.hand || { x: person.mid.x, y: person.mid.y + H * 0.06 } : { x: W * 0.474, y: H * 0.602 }),
      p1: product(finds ? SubjectBox(list[kB], firstSeen, BOX, "@produit1") : null, [0.02, 0.4, 0.46, 0.22]),
      p2: product(finds ? SubjectBox(list[kB], firstSeen, BOX, "@produit2") : null, [0.03, 0.64, 0.6, 0.29]),
    };
  }, [track, kA, kB, PAUSE, CUT, W, H]);
  const clickOn = (P, fb) => (P.found ? inside({ x: P.x + P.w * 0.58, y: P.y + P.h * 0.4 }) : { x: W * fb[0], y: H * fb[1] });
  const c1 = clickOn(reads.p1, [0.413, 0.45]);
  const c2 = clickOn(reads.p2, [0.51, 0.73]);

  // 3. Her products' names, each in the free space near its product, big white condensed capitals, a hand-drawn arrow
  // from the product to the word, at once on its click; both gone on the last click.
  const F = Math.round(H * 0.054);
  const LH = Math.round(F * 1.18);
  const RISE = Math.round(H * 0.1);
  const estimate = (s) => Math.round(within(String(s).length * F * 0.47 + F * 0.5, W * 0.22, W * 0.76));
  const overlap = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const hh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && hh > 0 ? (w * hh) / (a.w * a.h) : 0;
  };
  const safe = (L) => L.x >= 44 && L.y >= 100 && L.y + L.h <= H * 0.75 - 12 && L.x + L.w <= (L.y + L.h > H / 2 ? W - 140 : W - 40) - 4;
  const place = (P, text, taken, avoid) => {
    const w = estimate(text);
    const cx0 = P.x + P.w / 2;
    const cy0 = P.y + P.h / 2;
    const xs = [];
    for (let i = 0; i <= 16; i++) xs.push(W * (0.14 + i * 0.045) - w / 2);
    const tries = [];
    [1, 0.55, 1.6, 2.3].forEach((r, j) => xs.forEach((x) => {
      tries.push({ x, y: P.y - RISE * r - 40 - LH, side: 0.12 * j });
      tries.push({ x, y: P.y + P.h + RISE * r, side: 0.35 + 0.12 * j });
    }));
    [-0.25, 0, 0.25].forEach((d) => {
      tries.push({ x: P.x + P.w + 40, y: cy0 - LH / 2 + d * P.h, side: 0.5 });
      tries.push({ x: P.x - 40 - w, y: cy0 - LH / 2 + d * P.h, side: 0.5 });
    });
    let best = null;
    tries.forEach((c) => {
      const L = { x: Math.round(c.x), y: Math.round(c.y), w, h: LH };
      if (!safe(L) || taken.some((o) => overlap(L, o) > 0)) return;
      const light = kB >= 0 ? LightUnder(list[kB], firstSeen, BOX, { x: L.x, y: L.y, w: L.w, h: L.h }) : null;
      // White words need the darkest place: what is brightest under them (a plate's rim) counts most.
      const cost = 6 * avoid.reduce((s, o) => s + overlap(L, o), 0) + 3 * overlap(L, P) + Math.hypot(L.x + L.w / 2 - cx0, L.y + L.h / 2 - cy0) / (2 * W) + c.side + (light ? 2.5 * Math.max(0, light.high - 0.6) + Math.max(0, light.mean - 0.45) : 0);
      if (!best || cost < best.cost) best = { ...L, cost };
    });
    return best;
  };
  const fallback = (fx, fy, text, taken) => {
    const w = estimate(text);
    const L = { x: Math.round(within(W * fx - w / 2, 44, W - 144 - w)), y: Math.round(H * fy - LH / 2), w, h: LH };
    while (taken.some((o) => overlap(L, o) > 0) && L.y + 2 * LH < H * 0.75) L.y += LH + 16;
    return L;
  };
  const one = word("produit1");
  const two = word("produit2");
  const names = React.useMemo(() => {
    const out = [];
    if (one) out.push({ text: one, from: L1, P: reads.p1, L: place(reads.p1, one, [], [reads.p2]) || fallback(0.565, 0.249, one, []) });
    if (two) {
      const taken = out.map((o) => o.L);
      out.push({ text: two, from: L2, P: reads.p2, L: place(reads.p2, two, taken, [reads.p1]) || fallback(0.741, 0.458, two, taken) });
    }
    return out;
  }, [one, two, reads, L1, L2]);
  const arrowOf = (P, L) => {
    const above = L.y + L.h <= P.y + 6;
    const below = L.y >= P.y + P.h - 6;
    const lx = L.x + L.w / 2;
    const tail = { x: within(lx, P.x + P.w * 0.25, P.x + P.w * 0.75), y: above ? P.y + P.h * 0.08 : below ? P.y + P.h * 0.92 : P.y + P.h * 0.5 };
    const headPt = { x: lx + (tail.x < lx ? -0.14 : 0.14) * L.w, y: above ? L.y + L.h + 16 : below ? L.y - 16 : L.y + L.h / 2 };
    return Math.hypot(headPt.x - tail.x, headPt.y - tail.y) >= 60 ? { tail, head: headPt } : null;
  };
  const labels = names.flatMap((o, i) => {
    if (frame < o.from || frame >= PLAY) return [];
    const light = kB >= 0 ? LightUnder(list[kB], firstSeen, BOX, { x: o.L.x, y: o.L.y, w: o.L.w, h: o.L.h }) : null;
    const dark = Boolean(light && light.mean > 0.62);
    const ink = dark ? (brand.palette && brand.palette.dark) || "#121110" : "#ffffff";
    const arrow = arrowOf(o.P, o.L);
    const wordNode = h(FitText, { key: "name-" + i + "-" + keep(o.text), style: { position: "absolute", left: o.L.x, top: o.L.y, width: o.L.w, height: o.L.h }, innerStyle: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: F, lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", color: ink, textShadow: dark ? "0 1px 10px rgba(255,255,255,0.45)" : "0 2px 12px rgba(0,0,0,0.5), 0 0 3px rgba(0,0,0,0.25)", whiteSpace: "nowrap", textAlign: "center" } }, keep(o.text));
    // Its arrow over a thin edge of the other tone (it still reads where it crosses a white plate or a dark table).
    if (!arrow) return [wordNode];
    const box = { x: Math.min(arrow.tail.x, arrow.head.x), y: Math.min(arrow.tail.y, arrow.head.y), w: Math.abs(arrow.head.x - arrow.tail.x) + 1, h: Math.abs(arrow.head.y - arrow.tail.y) + 1 };
    const stroke = (key, color, width) => h(Scribble, { key, kind: "arrow", from: arrow.tail, to: arrow.head, box, at: o.from - 1, frames: 1, color, width, wobble: 0.6, seed: "curseur-" + i });
    const sw = Math.max(4, Math.round(H * 0.0032));
    return [stroke("edge-" + i, dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.38)", sw + 4), stroke("arrow-" + i, ink, sw), wordNode];
  });

  // 4. The cursor: in from the left edge, its clicks, out by the bottom left; in a straight line at an even pace between
  // its keyframes, still at each.
  const away = { x: W * 0.83, y: H * 0.554 };
  const keys = [[ENTER, { x: -W * 0.03, y: H * 0.391 }], [Math.max(ENTER + 1, PAUSE - 6), reads.t1], [PAUSE, reads.t1]];
  if (kA >= 0) keys.push([Math.max(PAUSE + 2, Math.round((PAUSE + ZOOM) / 2)), reads.t2], [ZOOM, reads.t2]);
  keys.push([Math.max(keys[keys.length - 1][0] + 1, L1 - 6), c1], [L1, c1]);
  if (two) keys.push([Math.max(L1 + 2, L2 - 6), c2], [L2, c2]);
  keys.push([Math.max(keys[keys.length - 1][0] + 1, PLAY - 8), away], [PLAY, away], [Math.max(PLAY + 1, OUT), { x: -W * 0.12, y: H * 0.86 }]);
  const clicks = [PAUSE, L1, PLAY].concat(kA >= 0 ? [ZOOM] : []).concat(two ? [L2] : []);
  const pointer = (() => {
    if (frame < ENTER || frame > OUT) return null;
    let p = keys[0][1];
    for (let i = 0; i < keys.length; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (frame >= a[0]) p = a[1];
      if (b && frame > a[0] && frame < b[0]) { const t = (frame - a[0]) / (b[0] - a[0]); p = { x: a[1].x + (b[1].x - a[1].x) * t, y: a[1].y + (b[1].y - a[1].y) * t }; break; }
    }
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
    const PX = Math.max(5, Math.round(H * 0.0045));
    const size = PX * press;
    return h("svg", { key: "cursor", width: 12 * size, height: 19 * size, viewBox: "0 0 12 19", shapeRendering: "crispEdges", style: { position: "absolute", left: Math.round(p.x + 6 * PX * (1 - press)), top: Math.round(p.y + 9.5 * PX * (1 - press)) } },
      h("path", { d: runs.W, fill: "#ffffff" }),
      h("path", { d: runs.B, fill: "#000000" }));
  })();

  return h(AbsoluteFill, null, picture, labels, pointer);
}`;

/**
 * Its moments, frames from its start, for its length, the Reel's tempo and the shots under it (their starts): the
 * model's proportions, its pause early in the first shot, its second click on the cut to the close-up (two shots), its
 * names a click each, the play a whole beat of the Reel from its start (the music comes back there) once the second
 * name has been read (1,7 s), the cursor out before its end.
 */
export function curseurMoments(frames: number, bpm: number, shots: { from: number; frames: number }[]): { enter: number; pause: number; zoom: number; label1: number; label2: number; play: number; out: number } {
  const D = Math.max(1, frames);
  const beat = (60 / Math.min(140, Math.max(60, bpm))) * 30;
  const two = shots.length > 1;
  const cut = two ? Math.max(0, Math.min(D - 1, shots[shots.length - 1]!.from)) : -1;
  const clamp = (v: number, a: number, b: number) => Math.round(Math.max(a, Math.min(b, v)));
  const enter = clamp(D * 0.03, 0, D - 1);
  const pause = two ? clamp(cut - Math.max(12, 0.45 * cut), enter + 1, Math.max(enter + 1, cut - 6)) : clamp(D * 0.16, enter + 1, D - 1);
  const zoom = two ? Math.max(cut, pause + 2) : -1;
  const from = two ? zoom : pause;
  const label1 = clamp(from + Math.max(12, D * (two ? 0.1 : 0.13)), from + 1, D - 1);
  const label2 = clamp(label1 + Math.max(18, D * 0.12), label1 + 1, D - 1);
  // The play on a whole beat from its start (the music comes back there: off it, it would drift from the cuts after),
  // once her second name has been read (1,7 s), a second before its end at most; else the last whole beat that leaves
  // it a second; else (a very short one) a second before its end.
  const wanted = label2 + 51;
  const latest = Math.max(label2 + 1, D - 30);
  const first = Math.ceil(wanted / beat - 1e-9) * beat;
  const last = Math.floor(latest / beat + 1e-9) * beat;
  const play = Math.round(first <= latest ? first : last > label2 + 30 ? last : Math.min(latest, Math.max(label2 + 1, D - 2)));
  const out = clamp(play + Math.max(10, D * 0.12), play + 1, D);
  return { enter, pause, zoom, label1, label2, play, out };
}

/** Whether a moment (frames from its start) is on a whole beat of the Reel, within half an image. */
export const onWholeBeat = (frames: number, bpm: number) => {
  const beat = (60 / Math.min(140, Math.max(60, bpm))) * 30;
  return Math.abs(frames - Math.round(frames / beat) * beat) <= 0.5;
};

export const curseur: EffectPiece = {
  key: "curseur",
  version: 1,
  name: "Un clic sur tes produits",
  how: "un curseur d'ordinateur (la flèche blanche en pixels) entre sur sa vidéo et clique : l'image se fige et la musique s'arrête ; avec deux plans, un clic sur ce que tient la personne ouvre le gros plan de ses produits ; un clic sur chacun écrit son nom en grandes capitales blanches avec une flèche dessinée à la main ; un dernier clic efface les noms et relance la vidéo et la musique, le curseur s'en va ; chaque clic s'entend ; puis le montage reprend.",
  needs: "une photo ou une vidéo de près de un ou deux de ses produits bien séparés, avec un peu de place libre autour ; avant elle, de préférence, une vidéo de son lieu où quelqu'un les porte.",
  lays: "sur son gros plan de produits seul, ou sur sa vidéo où quelqu'un les porte puis le gros plan (coupé sur le clic), de 4 à 9 s, le gros plan tenu 3 s au moins",
  shots: [1, 2],
  seconds: [4, 9],
  require: { files: 1, shot: { framing: ["close", "detail", "medium"] } },
  texts: [
    {
      slot: "produit1",
      want: "le nom du produit sur lequel la souris clique en premier (le plus haut, ou celui de gauche, sur le gros plan), en un à trois mots comme sur sa carte (une forme comme « Cappuccino », « Pain au chocolat ») ; jamais une phrase, rien d'inventé",
      max: 18,
      required: true,
    },
    {
      slot: "produit2",
      want: "facultatif : le nom du second produit du gros plan, en un à trois mots de la même façon (une forme comme « Brownie ») ; vide quand on n'en voit qu'un",
      max: 18,
      required: false,
    },
  ],
  objects: [
    { slot: "produit1", shot: -1, want: "son premier produit sur le gros plan (le plus haut, ou celui de gauche), nommé en anglais comme l'œil le voit (« cappuccino cup », « croissant »)" },
    { slot: "produit2", shot: -1, want: "le second produit du gros plan, nommé de même ; aucun quand on n'en voit qu'un" },
  ],
  timeline(input: PieceTimelineInput) {
    const m = curseurMoments(input.frames, input.bpm, input.shots);
    const two = input.shots.length > 1;
    const s = (f: number) => Math.round((f / 30) * 1000) / 1000;
    const clicks = [m.pause, ...(two ? [m.zoom] : []), m.label1, ...(input.words.produit2 ? [m.label2] : []), m.play].filter((f, i, all) => f >= 0 && f < input.frames && all.indexOf(f) === i);
    return {
      marks: m,
      // Each click heard: a computer mouse's, alone in the silence between the pause and the play.
      sounds: clicks.map((f) => ({ at: s(f), sound: "computer mouse click", seconds: 0.5, gain: 2 })),
      // The music stops dead on its first click and comes back on its last, on a whole beat of the Reel (never off it).
      ...(m.play - m.pause >= 12 && onWholeBeat(m.play, input.bpm) ? { music: { pauses: [{ from: s(m.pause), to: s(m.play) }] } } : {}),
    };
  },
  code: CODE,
};
