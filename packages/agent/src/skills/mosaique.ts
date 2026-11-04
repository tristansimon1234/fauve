import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Mosaïque qui change », written on its original (house/originals/mosaique.mp4, 6 s at 100 BPM, looked at image by
// image): her pictures full frame, cut into a grid of 3 × 4 tiles laid on a light paper (a thin gap between them, a
// margin round the edge, each tile set by hand, a pixel or two off); from the first images, the next picture replaces
// the tiles one by one in reading order (left to right, top to bottom), a tile every sixth of a beat, so a wave lasts
// two beats and the next one starts as it ends: a tile is always changing and a picture is never whole for long. The
// last wave brings the first picture back, so the Reel loops. Its ending card (an offer, an announcement): the last
// wave lays blank paper tiles instead, and its words are written on them.

const BPM = 100;
/** Beats per picture: its wave sweeps the twelve tiles in that time. */
const CYCLE = 2;
/** The ending card's length (s): exactly the engine's 1,6 s at any tempo, so its words land as the paper wave ends. */
const CARD_SECONDS = 1.6;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  // Her words' settings (cases, ordre, papier), the original's by default.
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const C = mark("cycle", 36);
  const grid = /^(\d)x(\d)$/.exec(setting("cases", "3x4"));
  const COLS = grid ? Number(grid[1]) : 3;
  const ROWS = grid ? Number(grid[2]) : 4;
  const N = COLS * ROWS;
  const STEP = C / N;
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', 'Instrument Serif', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  // Between the tiles: the original's light paper, her own colour, or black.
  const paper = setting("papier", "clair");
  const PAPER = paper === "couleur" ? brand.accent : paper === "noir" ? "#111111" : "#ddd4cb";
  const SHEET = paper === "noir" ? "#1d1b19" : paper === "couleur" ? ((brand.palette && brand.palette.light) || "#f2ece4") : "#f2ece4";
  const INK = paper === "noir" ? "#f2ece4" : "#1c1916";
  // The order the tiles change in: reading order (the original's), a spiral from the edge in, or at random (the same at every render).
  const kind = setting("ordre", "lecture");
  const order = (() => {
    const ids = Array.from({ length: N }, (_, j) => j);
    if (kind === "hasard") return ids.map((j) => ({ j, r: random("mosaic-order-" + j) })).sort((a, b) => a.r - b.r).map((x) => x.j);
    if (kind !== "spirale") return ids;
    const out = [];
    let top = 0, left = 0, bottom = ROWS - 1, right = COLS - 1;
    while (top <= bottom && left <= right) {
      for (let c = left; c <= right; c++) out.push(top * COLS + c);
      top++;
      for (let r = top; r <= bottom; r++) out.push(r * COLS + right);
      right--;
      if (top <= bottom) { for (let c = right; c >= left; c--) out.push(bottom * COLS + c); bottom--; }
      if (left <= right) { for (let r = bottom; r >= top; r--) out.push(r * COLS + left); left++; }
    }
    return out;
  })();
  const rank = new Array(N);
  order.forEach((j, k) => { rank[j] = k; });
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

  // The grid: a margin round the edge and a thin gap between the tiles, each tile laid by hand (a pixel or two off).
  const MX = 13;
  const MY = 8;
  const GAP = 5;
  const tw = (width - 2 * MX - (COLS - 1) * GAP) / COLS;
  const th = (height - 2 * MY - (ROWS - 1) * GAP) / ROWS;
  const tiles = Array.from({ length: N }, (_, j) => {
    const c = j % COLS;
    const r = Math.floor(j / COLS);
    const dx = Math.round((random("mosaic-x-" + j) - 0.5) * 4);
    const dy = Math.round((random("mosaic-y-" + j) - 0.5) * 4);
    return { j, x: Math.round(MX + c * (tw + GAP)) + dx, y: Math.round(MY + r * (th + GAP)) + dy, w: Math.round(tw), h: Math.round(th) };
  });

  // Waves: wave w (1 to n) starts a tile after (w - 1) cycles and lays picture w on the tiles in their order; the last
  // one brings the first picture back (the loop), or blank paper when the Reel ends on a card.
  const waveOf = (j) => Math.max(0, Math.min(n, Math.floor((frame - STEP * (rank[j] + 1)) / C) + 1));
  // A video plays a cycle long, centred on the moment its picture is whole; the first picture brought back holds its
  // first image, as the Reel starts on it.
  const playAt = (w, k) => (w === 0 ? undefined : w >= n ? n * C : Math.max(0, k * C - C / 2));
  // Each picture on screen drawn once, full frame, seen through its tiles only (the paper shows in the gaps).
  const groups = {};
  tiles.forEach((t) => { const w = waveOf(t.j); (groups[w] = groups[w] || []).push(t); });
  const layers = Object.keys(groups).map((key) => {
    const w = Number(key);
    const d = groups[key].map((t) => "M" + t.x + " " + t.y + "h" + t.w + "v" + t.h + "h" + -t.w + "Z").join(" ");
    const paper = Boolean(end) && w >= n;
    const k = w % Math.max(1, n);
    return h("div", { key: "w" + w, style: { position: "absolute", left: 0, top: 0, width, height, clipPath: "path('" + d + "')", backgroundColor: SHEET } },
      paper || !n ? null : h(Footage, { shot: k, at: playAt(w, k), style: { left: 0, top: 0, width, height } }));
  });

  // Its optional title (and any other text of the Reel): a plain line on a paper label at the top, so nothing she wrote is lost.
  const extra = reelTexts.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 150 + i * 120, height: 104 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.15, color: INK, textAlign: "center" } },
      h("span", { style: { background: SHEET, padding: "8px 22px" } }, t.text)));

  // Its ending card, written on the paper tiles once the last wave has laid them: the title in the serif, a line under it.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, null,
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 520 : 700, width: width - 280, height: 420 }, innerStyle: { justifyContent: end.subtitle ? "flex-end" : "center", fontFamily: display, fontWeight: 400, fontSize: 136, lineHeight: 1.02, letterSpacing: "-0.01em", color: INK, textAlign: "center", textWrap: "balance" } },
          h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt, endAt + 4], [0, 1], clamp) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1000, width: width - 280, height: 190 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.22, letterSpacing: "0.01em", color: INK, textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 3, endAt + 7], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: PAPER } }, layers, extra, ending);
}`;

export const mosaique: MontageSkill = {
  key: "mosaique",
  // 2: its settings (cases, vitesse, ordre, papier); played with none, it is version 1's.
  version: 2,
  bpm: BPM,
  shots: [4, 10],
  files: [4, 10],
  how: "Ses images plein cadre, coupées en une grille de 3 × 4 cases posées sur du papier clair ; l'image suivante remplace les cases une à une dans l'ordre de lecture, une case tous les sixièmes de temps, chaque vague longue de deux temps, si bien qu'une case change toujours ; la dernière vague ramène la première image et le Reel tourne en boucle.",
  end: true,
  texts: [{ slot: "titre", role: "hook", want: "facultatif : un titre court posé sur une étiquette de papier en haut, le temps de la première vague (son nom, son plat, son moment), seulement quand le Reel a besoin de mots", max: 28, required: false }],
  settings: [
    {
      name: "cases",
      want: "le nombre de cases de la grille",
      choices: [
        { value: "3x4", says: "12 grandes cases" },
        { value: "4x6", says: "24 cases" },
        { value: "6x8", says: "48 petites cases, une mosaïque fine" },
        { value: "2x3", says: "6 très grandes cases" },
      ],
    },
    {
      name: "vitesse",
      want: "la vitesse des vagues : combien de temps chaque image met à remplir la grille",
      choices: [
        { value: "normale", says: "une image tous les deux temps" },
        { value: "lente", says: "une image tous les quatre temps, plus calme" },
        { value: "rapide", says: "une image à chaque temps, plus nerveux" },
      ],
    },
    {
      name: "ordre",
      want: "l'ordre dans lequel les cases changent",
      choices: [
        { value: "lecture", says: "dans l'ordre de lecture, de gauche à droite et de haut en bas" },
        { value: "spirale", says: "en spirale, du bord vers le centre" },
        { value: "hasard", says: "dans le désordre" },
      ],
    },
    {
      name: "papier",
      want: "la couleur entre les cases",
      choices: [
        { value: "clair", says: "un papier clair" },
        { value: "couleur", says: "sa couleur à elle (celle de sa charte)" },
        { value: "noir", says: "du noir" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo, settings }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // Her pace: a picture every two beats (the original's), four (calmer) or one (quicker).
    const cycle = ({ lente: 4, rapide: 1 } as Record<string, number>)[settings?.vitesse ?? ""] ?? CYCLE;
    const spans = beatSpans(bpm, Array.from({ length: n }, (_, i) => (i < n - 1 ? cycle : cycle + (end ? CARD_SECONDS / beat : 0))));
    const duration = spans.at(-1)!.end;
    const wants = spans.map((_, i) =>
      i === 0
        ? "la plus belle image, plein cadre : elle ouvre la grille et la referme en boucle (un plat, un produit ou une création, serré)"
        : "une image serrée et pleine de ses plats, produits ou réalisations, différente de la précédente, vue en entier à travers la grille",
    );
    return { duration, shots: spans.map((s, i) => ({ ...s, want: wants[i]! })), texts: { titre: { from: 0, to: Math.min(duration, Math.max(2.6, spans[0]!.end)) } }, marks: { cycle: toFrame(cycle * beat) } };
  },
  code: CODE,
};
