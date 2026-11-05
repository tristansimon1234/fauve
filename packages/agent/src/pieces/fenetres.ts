import type { EffectPiece } from "../pieces.ts";

// « Fenêtres et étiquettes », the effect (docs/fiches/fenetres.md, effects 1 to 3; its whole Reel is skills/fenetres.ts):
// over a run of her shots, two small technical labels in white capitals stay fixed just above the middle of the frame
// from its first image to its last, over everything (a true landmark of her business on the left, her neighbourhood on
// the right), while each of her next shots comes in through windows, at every cut under it, in turn: the next shot,
// already playing, takes the 3 × 3 cells of the frame one or two at a time every two images, row after row in a snake,
// from the top right, then from the bottom left (12 images of the original), the shot before held on its last image in
// the cells not yet taken; or, before the cut, windows of the frame's shape open at once on the next shot at its place
// (its first image, so the cut lands on it) and jump every two images, one of 21 % of the frame, then two of 21 and
// 28 %, then two or three of a third (27 images). Its timings are the original's images at its tempo (92,9 BPM),
// counted in beats of the Reel's. What it keeps of its skill: its cells, their snake and their pace, its jumping
// windows and their sizes, its two labels at its place and size (v3: a little heavier than the original's thin
// capitals, a soft dark shadow, so they read on any shot; decor, at the original's size). What it leaves: its 16:9 frame
// on black (the effect plays in the frame of the Reel around it), its silhouettes and the subject before its decor (her
// cut-out on many shots), its split screen, its squares, its flashes and negative, its loop, its ending card, its music's
// hole. Her coordinates (the skill's right label, written by the engine from her address) are not written by the bank
// yet: its labels are her filler's words, a landmark and her neighbourhood, never coordinates it would invent.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const F = durationInFrames;
  const R = Math.round;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its shots: those that play during it (a sliver of a frame at an edge left out), in order.
  const seen = (i) => Math.min(F, shots[i].from + shots[i].durationInFrames) - Math.max(0, shots[i].from);
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < F && shots[i].from + shots[i].durationInFrames > 0 && seen(i) >= 2);
  if (!mine.length) return null;
  // Its original's images (30 a second at 92,9 BPM: 19,376 a beat) on this tempo's beats.
  const K = mark("beat", 19.376) / 19.376;
  const o = (x) => Math.max(1, R(x * K));
  const start = (i) => Math.max(0, R(shots[i].from));
  const box = { position: "absolute", left: 0, top: 0, width, height };
  const rects = (list) => "path('" + list.map(([x, y, w, hh]) => "M" + R(x) + " " + R(y) + "h" + R(w) + "v" + R(hh) + "h" + -R(w) + "Z").join(" ") + "')";
  const cell = (c) => [(c % 3) * (width / 3), Math.floor(c / 3) * (height / 3), width / 3, height / 3];
  const FAR = F * 4 + 1000;

  // How each of its next shots comes in, at each cut under it: by its cells, from the top right then from the bottom
  // left, and every third cut (its last one at least once) by windows before the cut, as the original's intro (on her
  // word, cells only or windows only). Windows need the shot before the cut: when that shot came in by its own cells, its
  // cells go faster to leave them ten images at least; with no room for either, it comes in by its cells.
  const asked = setting("entree", "melange");
  const CELLS = o(12);
  const WINDOWS = o(27);
  const n = mine.length;
  const entries = [];
  let used = false;
  for (let c = 1; c < n; c++) {
    const wanted = asked === "fenetres" || (asked === "melange" && (c % 3 === 0 || (c === n - 1 && !used)));
    entries.push({ cut: start(mine[c]), kind: wanted ? 3 : 0, length: 0, cap: CELLS });
    if (wanted) used = true;
  }
  entries.forEach((e, i) => {
    if (e.kind !== 3) return;
    const before = entries[i - 1];
    const room = e.cut - start(mine[i]) - 2;
    const cells = Boolean(before && before.kind !== 3);
    const length = Math.min(WINDOWS, cells ? Math.max(o(10), room - CELLS) : room);
    if (length < o(8) || (cells && room - length < 2)) e.kind = 0;
    else {
      e.length = length;
      if (cells) before.cap = Math.min(CELLS, room - length);
    }
  });
  let side = 2;
  entries.forEach((e, i) => {
    if (e.kind === 3) return;
    side = side === 1 ? 2 : 1;
    e.kind = side;
    e.length = Math.max(2, Math.min(e.cap, seen(mine[i + 1]) - 2));
  });
  const layers = [];
  entries.forEach((e, k) => {
    const prev = mine[k];
    const next = mine[k + 1];
    // 1. Its cells: the next shot (the montage's, under it) takes one or two of the 3 × 3 cells every two images, in a
    // snake; the shot before stays in those not taken yet, held on its last image.
    if (e.kind !== 3 && frame >= e.cut && frame < e.cut + e.length) {
      const ORDER = e.kind === 1 ? [2, 1, 0, 3, 4, 5, 8, 7, 6] : [6, 7, 8, 5, 4, 3, 0, 1, 2];
      const steps = Math.floor(e.length / o(2)) + 1;
      const step = Math.min(steps - 1, Math.floor((frame - e.cut) / o(2)));
      const left = ORDER.slice(Math.ceil(((step + 1) * 9) / steps));
      if (left.length) layers.push(h(Footage, { key: "c" + k, shot: prev, style: { ...box, clipPath: rects(left.map(cell)) } }));
    }
    // 2. Its windows: before the cut, windows of the frame's shape open at once on the next shot at its place (its first
    // image) and jump every two images: one of 21 %, then two of 21 and 28 %, then two or three of a third.
    if (e.kind === 3 && frame >= e.cut - e.length && frame < e.cut) {
      const rel = frame - (e.cut - e.length);
      const t = rel / e.length;
      const jump = Math.floor(rel / o(2));
      const sizes = t < 10 / 27 ? [0.21] : t < 16 / 27 ? [0.21, 0.28] : random("n" + k + "-" + Math.floor(rel / o(4))) < 0.5 ? [0.33, 0.33] : [0.33, 0.33, 0.33];
      const wins = sizes.map((s, j) => {
        const w = s * width;
        const hh = s * height;
        return [random("x" + k + "-" + j + "-" + jump) * (width - w), random("y" + k + "-" + j + "-" + jump) * (height - hh), w, hh];
      });
      layers.push(h(Footage, { key: "w" + k, shot: next, at: FAR, style: { ...box, clipPath: rects(wins) } }));
    }
  });

  // 3. Its two labels, fixed from its first image to its last over everything, just above the middle of the frame (clear
  // of the apps' buttons), at the original's distance from the edges (10,3 % and 89,9 % of the width): white capitals as
  // tall as the original's, a little heavier, a soft dark shadow under them so they read on any shot. Decor, in their boxes.
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const LBL = { fontFamily: body, fontWeight: 500, fontSize: 44, lineHeight: 1.1, letterSpacing: "0.02em", textTransform: "uppercase", color: "#f1f2f4", whiteSpace: "nowrap", textShadow: "0 0 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.7)" };
  const top = R(height / 2) - 76;
  const label = (text, left, w, align, key) => text
    ? h(FitText, { key, style: { position: "absolute", left, top, width: w, height: 52 }, innerStyle: { ...LBL, alignItems: align } }, h("span", { "data-fauve-decor": "" }, keep(text)))
    : null;
  const L = R(width * 0.103);
  const Rt = R(width * 0.899);
  const mid = R(width / 2);

  return h(AbsoluteFill, null, layers, label(word("gauche"), L, mid - 9 - L, "flex-start", "lg"), label(word("droite"), mid + 9, Rt - mid - 9, "flex-end", "ld"));
}`;

export const fenetres: EffectPiece = {
  key: "fenetres",
  version: 1,
  name: "Fenêtres et étiquettes",
  how: "deux petites étiquettes techniques en capitales blanches, fixes juste au-dessus du milieu (un repère de son commerce à gauche, son quartier à droite), pendant que chacun de ses plans suivants entre par des fenêtres : il prend les 3 × 3 cases de l'image une ou deux à la fois en serpentin, ou des fenêtres s'ouvrent d'un coup sur lui avant la coupe et sautent en grandissant.",
  needs: "3 à 10 plans de son lieu, de sa rue ou de son quartier, plutôt larges (une case n'en montre qu'un morceau), et un repère vrai de son commerce (son année ou son heure d'ouverture, son adresse, une mesure de son métier) ou son quartier.",
  lays: "sur 3 à 10 de ses plans larges coupés d'un ou deux temps chacun, le plus beau en premier (il porte les étiquettes seul un instant)",
  shots: [3, 10],
  seconds: [2, 8],
  require: { files: 3, shot: { framing: ["wide"] } },
  texts: [
    {
      slot: "gauche",
      want: "l'étiquette de gauche, au ton d'un relevé technique, en capitales : un repère vrai de son commerce qu'on sait (son année ou son heure d'ouverture, une mesure de son métier, son adresse), sinon son quartier ou sa ville (une forme comme « DEPUIS 1998 », « OUVERT DÈS 8 H », « 250 °C », « 12 RUE DES MARTYRS »)",
      max: 20,
      required: true,
    },
    {
      slot: "droite",
      want: "l'étiquette de droite, au même ton : son quartier ou sa ville (une forme comme « PARIS 9E », « VIEUX LYON »), sinon ce qu'elle fait en un ou deux mots (« TORRÉFACTEUR ») ; jamais des coordonnées",
      max: 20,
      required: false,
    },
  ],
  settings: [
    {
      name: "entree",
      want: "comment ses plans entrent",
      choices: [
        { value: "melange", says: "par cases puis par fenêtres, à tour de rôle, comme l'original" },
        { value: "cases", says: "toujours par cases, en serpentin" },
        { value: "fenetres", says: "toujours par fenêtres qui sautent avant la coupe" },
      ],
    },
  ],
  code: CODE,
};
