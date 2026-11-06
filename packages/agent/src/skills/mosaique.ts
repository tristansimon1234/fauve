import { beatSpans, type MontageSkill } from "../skills.ts";

// « Mosaïque qui change », version 3, written again on its original's fiche (docs/fiches/mosaique.md: measured image by
// image at 30 i/s and tile by tile, its music measured, the video watched and heard by Gemini; Tristan: « c'est un effet
// que l'on veut pouvoir faire, pas exactement reproduire l'image »). Its music is a neo-soul beat at 130 BPM (Gemini heard
// 105; v2 counted 100, the tiles' pace and not the music's), and every length below is in its beats, so its tiles change
// on the very images the original's do, on its own music:
//   her picture cut into 3 × 4 prints laid by hand on a flat light grey paper: a thin gap between them, a margin round
//   the edge, each print a pixel or two off its place, a few a hair off straight, the picture in place across them;
//   from its third image the next picture takes the prints one by one in reading order, one every 3 images (0,22 beat:
//   the original's images 3 + 3 × its rank + 36 × its wave), so a picture covers the grid in 2,6 beats (1,2 s), is
//   whole 3 images and the next one starts at once: a print is always changing (never on the music, and a beat always
//   falls within 50 ms of a change);
//   each print lands askew, about 1°, the way alternating from one to the next (the first one counterclockwise), a pixel
//   or two off, over the gap and the margin, and lies straight at once as the next one lands;
//   her photos stay still, her videos play (Tristan: « si photos envoyées, figées ; si vidéos, ça joue »);
//   the last wave brings the first picture back, its last print landing on the loop's first image: the Reel loops, its
//   music cut dead with it (the original's never fades), the whole loop a whole number of beats (its 5 pictures: 13).
// No text and no sound of its own: her optional title on a paper label, her optional ending card written on blank paper
// prints (Tristan, of the cards a v1 added: « l'idée est de pouvoir ajouter des scènes, surtout à la demande du user »).
// Played vertical full frame as the original when most of her files are vertical (or she asks); her horizontal pictures
// whole in a 16:9 block of 4 × 3 lying prints in the middle of the paper, her title on the paper above it; a square
// block of 3 × 3 on her word (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »).

const BPM = 130;
/** Beats a picture takes to cover the grid: 2,6 at its tempo, the original's 36 images, a print every 3. */
const WAVE = 2.6;
/** The ending card's length (s): exactly the engine's 1,6 s at any tempo, so its words land as the paper wave ends. */
const CARD_SECONDS = 1.6;
/** Her title stays this long at least (s): the time to read it on a phone. */
const TITLE_SECONDS = 2.6;
/** A picture's wave at her pace: twice as long (calmer) or half (quicker) as the original's. */
const PACES: Record<string, number> = { lente: 2, rapide: 0.5 };
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Beats per picture for n pictures: the original's 2,6 (in a square block, its share of the prints, each at the same
 * pace), the whole loop brought to a whole number of beats so its music's pulse goes on across the loop (the original's
 * 5 pictures make 13: exactly its own); then her pace.
 */
export function waveBeats(n: number, settings?: Record<string, string>): number {
  const grid = /^(\d)x(\d)$/.exec(settings?.cases ?? "3x4");
  const share = settings?.format === "carre" && grid ? Number(grid[1]) / Number(grid[2]) : 1;
  return (Math.max(1, Math.round(WAVE * share * n)) / Math.max(1, n)) * (PACES[settings?.vitesse ?? ""] ?? 1);
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  // Her words' settings (cases, ordre, papier, format), the original's by default.
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  // A picture's wave, in images: the original's 36.
  const C = Math.max(1, mark("cycle", 36));
  const grid = /^(\d)x(\d)$/.exec(setting("cases", "3x4"));
  const A = grid ? Number(grid[1]) : 3;
  const B = grid ? Number(grid[2]) : 4;
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', 'Instrument Serif', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";

  // Its frame: vertical full frame as the original (3 × 4 prints standing) when most of her files are vertical (or she
  // asks); her horizontal pictures whole in a 16:9 block of 4 × 3 lying prints in the middle of the paper; a square
  // block of 3 × 3 on her word. A print every STEP images in each (3 in the original).
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const kind = format === "carre" ? "carre" : format === "horizontal" || (format === "auto" && wideShots * 2 > n) ? "horizontal" : "vertical";
  const COLS = kind === "horizontal" ? B : A;
  const ROWS = kind === "vertical" ? B : A;
  const N = COLS * ROWS;
  const STEP = C / N;

  // Between the prints and round them: the original's flat warm light grey paper, her own colour, or black; a print's
  // blank side a little lighter.
  const paper = setting("papier", "clair");
  const PAPER = paper === "couleur" && brand.accent ? brand.accent : paper === "noir" ? "#111111" : "#d5d0c6";
  const SHEET = paper === "noir" ? "#1d1b19" : paper === "couleur" ? ((brand.palette && brand.palette.light) || "#f2ece4") : "#ece7df";
  const INK = paper === "noir" ? "#f2ece4" : "#1c1916";
  // What is written on the paper itself: ink on a light paper, light on a dark one.
  const lum = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); if (!m) return 1; const v = parseInt(m[1], 16); return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255; };
  const ON_PAPER = lum(PAPER) > 0.45 ? "#1c1916" : "#f2ece4";

  // The order the prints change in: reading order (the original's), a spiral from the edge in, or at random (the same at every render).
  const ordre = setting("ordre", "lecture");
  const order = (() => {
    const ids = Array.from({ length: N }, (_, j) => j);
    if (ordre === "hasard") return ids.map((j) => ({ j, r: random("mosaic-order-" + j) })).sort((a, b) => a.r - b.r).map((x) => x.j);
    if (ordre !== "spirale") return ids;
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

  // Its block: the whole frame but the original's margin (1,2 % of the width on the sides, 0,35 % of the height at the
  // top and the bottom), or a block of that width in the middle of the paper; a gap of 0,4 % of the width between prints.
  const MX = Math.round(width * 0.012);
  const MY = Math.round(height * 0.0035);
  const GAP = Math.max(2, Math.round(width * 0.004));
  const bx = MX;
  const bw = width - 2 * MX;
  const bh = kind === "vertical" ? height - 2 * MY : kind === "horizontal" ? Math.round((bw * 9) / 16) : bw;
  const by = kind === "vertical" ? MY : Math.round((height - bh) / 2);
  // Her picture laid a few pixels past its block, so a print laid a pixel off at the edge never shows its blank side.
  const BLEED = Math.max(4, Math.round(width * 0.006));
  // Each print laid by hand: a pixel or two off its place, one in four a hair off straight; the picture stays in place
  // across them, so they join into one image.
  const tw = (bw - (COLS - 1) * GAP) / COLS;
  const th = (bh - (ROWS - 1) * GAP) / ROWS;
  const tiles = Array.from({ length: N }, (_, j) => {
    const c = j % COLS;
    const r = Math.floor(j / COLS);
    const dx = Math.round((random("mosaic-x-" + j) - 0.5) * 4);
    const dy = Math.round((random("mosaic-y-" + j) - 0.5) * 4);
    const t = random("mosaic-t-" + j);
    return { j, x: Math.round(bx + c * (tw + GAP)) + dx, y: Math.round(by + r * (th + GAP)) + dy, w: Math.round(tw), h: Math.round(th), tilt: t > 0.75 ? (t - 0.875) * 3.2 : 0 };
  });
  const outline = (t) => {
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    const a = (t.tilt * Math.PI) / 180;
    const p = (x, y) => (cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a)).toFixed(1) + " " + (cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)).toFixed(1);
    return "M" + p(t.x, t.y) + "L" + p(t.x + t.w, t.y) + "L" + p(t.x + t.w, t.y + t.h) + "L" + p(t.x, t.y + t.h) + "Z";
  };

  // Waves: print j (its rank k in the order) takes picture w (1 to n) on image (w - 1) × C + (k + 1) × STEP; the last
  // wave brings the first picture back (the loop), or blank paper when the Reel ends on a card.
  const waveOf = (j) => Math.max(0, Math.min(n, Math.floor((frame - STEP * (rank[j] + 1) + 1e-6) / C) + 1));
  const landed = (j, w) => Math.ceil((w - 1) * C + STEP * (rank[j] + 1) - 1e-6);
  // A print lands askew and stays so until the next one lands (3 images in the original), then lies straight at once:
  // about 1°, counterclockwise for the first one and the way alternating from one to the next, a pixel or two off.
  const LAND = Math.max(1, Math.round(STEP));
  const askew = (j) => { const w = waveOf(j); return w >= 1 && frame - landed(j, w) < LAND; };
  const lean = (j, w) => (((w - 1) * N + rank[j]) % 2 ? 1 : -1) * (0.4 + 1.2 * random("mosaic-lean-" + w + "-" + j));
  const nudge = (j, w, axis) => Math.round((random("mosaic-nudge-" + axis + "-" + w + "-" + j) - 0.5) * 6);

  // A video plays a wave long, centred on the moment its picture is whole, and holds its nearest image before and after;
  // the first picture brought back holds its first image, as the Reel starts on it; a photo stays still.
  const playAt = (w, k) => (w === 0 ? undefined : w >= n ? n * C : Math.max(0, k * C - C / 2));
  const picture = (w, x, y) => {
    if (!n || (end && w >= n)) return null;
    const k = w % n;
    return h(Footage, { shot: k, at: playAt(w, k), style: { left: x - BLEED, top: y - BLEED, width: bw + 2 * BLEED, height: bh + 2 * BLEED } });
  };
  // Each picture on screen drawn once in its block, seen through its prints only (the paper shows in the gaps); a print
  // landing drawn on its own, its piece of the picture askew with it, the paper showing where it has not landed yet.
  const groups = {};
  tiles.forEach((t) => { if (askew(t.j)) return; const w = waveOf(t.j); (groups[w] = groups[w] || []).push(t); });
  const layers = Object.keys(groups).map((key) =>
    h("div", { key: "w" + key, style: { position: "absolute", left: 0, top: 0, width, height, clipPath: "path('" + groups[key].map(outline).join(" ") + "')", backgroundColor: SHEET } }, picture(Number(key), bx, by)));
  const prints = tiles.filter((t) => askew(t.j)).map((t) => {
    const w = waveOf(t.j);
    return h("div", { key: "p" + t.j, style: { position: "absolute", left: t.x + nudge(t.j, w, "x"), top: t.y + nudge(t.j, w, "y"), width: t.w, height: t.h, overflow: "hidden", backgroundColor: SHEET, transform: "rotate(" + lean(t.j, w).toFixed(2) + "deg)" } },
      picture(w, bx - t.x, by - t.y));
  });

  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  // Her optional title, and any other text of the Reel so nothing she wrote is lost: a plain line on a paper label, at
  // the top full frame, at the top of its block otherwise; in a block, her title in the serif on the paper above it.
  const on = reelTexts.filter((t) => frame >= t.from && frame < t.to && frame < endAt);
  const hook = kind === "vertical" ? null : on.find((t) => t.role === "hook");
  const label = (t, i, y) => h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: y, height: 104 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.15, color: INK, textAlign: "center" } },
    h("span", { style: { background: SHEET, padding: "8px 22px" } }, keep(t.text)));
  const words = [
    hook
      ? h(FitText, { key: "t", style: { position: "absolute", left: 140, width: width - 280, top: Math.max(100, by - 250), height: Math.max(110, Math.min(200, by - 150)) }, innerStyle: { justifyContent: "flex-end", fontFamily: display, fontWeight: 400, fontSize: 100, lineHeight: 1.02, letterSpacing: "-0.01em", color: ON_PAPER, textAlign: "center", textWrap: "balance" } },
          h("span", null, keep(hook.text)))
      : null,
    ...on.filter((t) => t !== hook).map((t, i) => label(t, i, kind === "vertical" ? 150 + i * 120 : by + 30 + i * 120)),
  ];

  // Its ending card, written on the paper prints once the last wave has laid them: the title in the serif, a line under
  // it; over the whole frame, or centred on its block.
  const sub = Boolean(end && end.subtitle);
  const card = kind === "vertical"
    ? { top: sub ? 520 : 700, height: 420, lineTop: 1000, lineHeight: 190, size: 136 }
    : { top: Math.round(by + bh * (sub ? 0.06 : 0.12)), height: Math.round(bh * (sub ? 0.56 : 0.76)), lineTop: Math.round(by + bh * 0.66), lineHeight: Math.round(bh * 0.26), size: Math.round(Math.min(136, bh * 0.2)) };
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, null,
        h(FitText, { style: { position: "absolute", left: 140, top: card.top, width: width - 280, height: card.height }, innerStyle: { justifyContent: sub ? "flex-end" : "center", fontFamily: display, fontWeight: 400, fontSize: card.size, lineHeight: 1.02, letterSpacing: "-0.01em", color: INK, textAlign: "center", textWrap: "balance" } },
          h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt, endAt + 4], [0, 1], clamp) } }, keep(end.title))),
        sub
          ? h(FitText, { style: { position: "absolute", left: 140, top: card.lineTop, width: width - 280, height: card.lineHeight }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.22, letterSpacing: "0.01em", color: INK, textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 3, endAt + 7], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: PAPER } }, layers, prints, words, ending);
}`;

export const mosaique: MontageSkill = {
  key: "mosaique",
  // 2: its settings (cases, vitesse, ordre, papier); played with none, it is version 1's.
  // 3: written again on its original's fiche: its tempo (130 BPM, its waves in its beats, the loop a whole number of
  // them), its paper and margins, each print landing askew then straight, its format (vertical full frame, a horizontal
  // 16:9 block when her files are, a square block on her word), its music cut dead with the loop, no grain nor vignette.
  // 4: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 4,
  bpm: BPM,
  shots: [4, 10],
  files: [4, 10],
  how: "Ses images coupées en une grille de 3 × 4 tirages posés à la main sur un papier gris clair, avec une fine marge ; l'image suivante remplace les cases une à une dans l'ordre de lecture, une case toutes les 3 images, chacune posée un instant de travers puis droite, si bien qu'une case change toujours et qu'une image passe en 1,2 s ; ses photos restent figées, ses vidéos jouent ; la dernière vague ramène la première image et le Reel tourne en boucle. En vertical plein cadre comme l'original, ses images horizontales recadrées sur leur sujet ; entières dans un bloc 16:9 au milieu du papier à sa demande.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "facultatif : un titre court (son nom, son plat, son moment), le temps des deux premières vagues, sur une étiquette de papier en haut, ou sur le papier au-dessus des cases quand ses images sont dans un bloc 16:9 ; seulement quand le Reel a besoin de mots",
      max: 28,
      required: false,
    },
  ],
  settings: [
    {
      name: "cases",
      want: "le nombre de cases de la grille",
      choices: [
        { value: "3x4", says: "12 grandes cases, comme l'original" },
        { value: "4x6", says: "24 cases" },
        { value: "6x8", says: "48 petites cases, une mosaïque fine qui scintille" },
        { value: "2x3", says: "6 très grandes cases" },
      ],
    },
    {
      name: "vitesse",
      want: "la vitesse des vagues : combien de temps chaque image met à remplir la grille",
      choices: [
        { value: "normale", says: "une image toutes les 1,2 s, une case toutes les 3 images, comme l'original" },
        { value: "lente", says: "une image toutes les 2,4 s, plus calme" },
        { value: "rapide", says: "une image toutes les 0,6 s, plus nerveux" },
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
      want: "la couleur du papier entre les cases et autour",
      choices: [
        { value: "clair", says: "le papier gris clair de l'original" },
        { value: "couleur", says: "sa couleur à elle (celle de sa charte)" },
        { value: "noir", says: "du noir" },
      ],
    },
    {
      name: "format",
      want: "le format : vertical plein cadre comme l'original, ou ses images horizontales entières dans un bloc au milieu du papier",
      choices: [
        { value: "vertical", says: "vertical plein cadre, 3 × 4 cases debout, comme l'original, ses images horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "ses images horizontales entières : 4 × 3 cases couchées dans un bloc 16:9 au milieu du papier, son titre au-dessus", band: true },
        { value: "carre", says: "un bloc carré de 3 × 3 cases au milieu du papier, pour un mélange d'images verticales et horizontales" },
        { value: "auto", says: "comme ses images (horizontal si la plupart le sont)" },
      ],
    },
  ],
  // Its original's grade (docs/fiches/mosaique.md, effect 6): a matte, warm print, blacks lifted (never a pure black) and
  // whites a little lowered, no grain nor dark corners (the catalogue's « Chaud doux » laid a grain and a vignette its
  // original does not have, without its matte).
  finish: { contrast: -0.04, warmth: 0.15, fade: 0.45, grain: 0, vignette: 0 },
  timeline(n, { end, bpm: tempo, settings }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const wave = waveBeats(n, settings);
    const spans = beatSpans(bpm, Array.from({ length: n }, (_, i) => (i < n - 1 ? wave : wave + (end ? CARD_SECONDS / beat : 0))));
    const duration = spans.at(-1)!.end;
    const wants = spans.map((_, i) =>
      i === 0
        ? "la plus belle image, serrée, le sujet au centre : elle ouvre la grille et la referme en boucle (un plat, un produit ou une création)"
        : "une image serrée et pleine de ses plats, produits ou réalisations, différente de la précédente, son sujet au centre à la même place : vue en entier à travers la grille",
    );
    return {
      duration,
      // Its music plays to the last image and stops dead as the Reel loops, as the original's (it never fades); a Reel
      // that ends on a card does not loop: the mix's own fade.
      ...(end ? {} : { music: { end: { at: duration } } }),
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: { titre: { from: 0, to: Math.min(duration, Math.max(TITLE_SECONDS, spans[0]!.end)) } },
      // A picture's wave in images, to the thousandth: its prints land on its beats' images at any tempo.
      marks: { cycle: round3(wave * beat * 30) },
    };
  },
  code: CODE,
};
