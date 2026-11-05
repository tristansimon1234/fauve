import type { EffectPiece } from "../pieces.ts";

// « La mosaïque », the effect (docs/fiches/mosaique.md, effects 1 to 4; its whole Reel is skills/mosaique.ts, version 3):
// over a run of her close shots, the picture on screen is cut into twelve prints laid by hand on a flat light grey
// paper, and each of her shots under it replaces the last picture print by print, in reading order, from its cut to
// the next one, so a print is always changing. Kept from the model: its grid of 3 × 4 standing prints, its paper
// (#D5D0C6, a margin of 1,2 % of the width on the sides and 0,35 % of the height at the top and the bottom, a gap of
// 0,4 % of the width, the blank side of a print a little lighter), each print a pixel or two off its place and one in
// four a hair off straight, the picture in place across them; each print landing askew, about 1°, the way alternating
// from one to the next (the first one counterclockwise), a pixel or two off, over the gap and the margin, and lying
// straight at once as the next one lands; her photos still, her videos playing; its settings (cases, ordre, papier,
// format: a vertical full frame by default, as the original and the montage around it). Its pace is the editor's cuts,
// which are on the beat: a picture's first print lands on its cut, its last one just before the next cut, so the picture
// is whole one step and the next one starts at once (at two beats a shot and 100 BPM, a print every 3 images, the
// original's step). It opens on the picture the montage was showing (its last image, now in prints): the Reel breaks
// into its prints; when it opens the Reel, on the picture it ends on, as the original's loop does. Then the montage
// takes over, her next shot full frame. Left out: the model's loop and its music cut dead, its ending card written on
// blank prints, its speed (her cuts set it); the original has no text nor sound of its own. Her optional title on a
// paper label at the top of the grid all along it (in a block, in the serif on the paper above it).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const D = Math.max(1, durationInFrames);
  const list = shots || [];
  // Its shots: those that play during it, in order.
  const mine = list.map((s, i) => i).filter((i) => list[i].from < durationInFrames && list[i].from + list[i].durationInFrames > 0);
  if (!mine.length) return null;
  const BEAT = mark("beat", 18);

  // The picture on screen just before its first frame (the montage's last image before it), cut into prints at once.
  const before = list.map((s, i) => i).filter((i) => list[i].from < 0 && list[i].from + list[i].durationInFrames >= 0);
  const prev = before.length ? before[before.length - 1] : -1;
  // Each of its shots that starts during it lays its picture over the one before, print by print, from its cut to the
  // next cut (the first one from its first frame, so a print is always changing); a shot starting within half a beat
  // of the last one, or of its end, lays none.
  const MIN = Math.max(4, Math.round(BEAT / 2));
  const waves = [];
  mine.forEach((i) => {
    const cut = Math.round(list[i].from);
    if (cut < 0 || cut > D - MIN) return;
    if (waves.length && cut - waves[waves.length - 1].cut < MIN) return;
    waves.push({ shot: i, cut, at: waves.length ? cut : 0 });
  });
  waves.forEach((w, k) => { w.to = k + 1 < waves.length ? waves[k + 1].at : D; });
  // Opening the Reel (nothing on screen before it): the picture it ends on, as the original's loop opens on its last.
  const first = prev >= 0 ? prev : waves.length ? waves[waves.length - 1].shot : mine[0];

  // Its frame: a vertical full frame as the original (3 × 4 prints standing); her horizontal pictures whole in a 16:9
  // block of 4 × 3 lying prints in the middle of the paper, or a square block of 3 × 3, on her word.
  const format = setting("format", "vertical");
  const grid = /^(\d)x(\d)$/.exec(setting("cases", "3x4"));
  const A = grid ? Number(grid[1]) : 3;
  const B = grid ? Number(grid[2]) : 4;
  const kind = format === "carre" ? "carre" : format === "horizontal" ? "horizontal" : "vertical";
  const COLS = kind === "horizontal" ? B : A;
  const ROWS = kind === "vertical" ? B : A;
  const N = COLS * ROWS;
  const display = "'" + brand.displayFont + "', 'Instrument Serif', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";

  // Between the prints and round them: the original's flat warm light grey paper, her own colour, or black; a print's
  // blank side a little lighter.
  const paper = setting("papier", "clair");
  const PAPER = paper === "couleur" && brand.accent ? brand.accent : paper === "noir" ? "#111111" : "#d5d0c6";
  const SHEET = paper === "noir" ? "#1d1b19" : paper === "couleur" ? ((brand.palette && brand.palette.light) || "#f2ece4") : "#ece7df";
  const INK = paper === "noir" ? "#f2ece4" : "#1c1916";
  // What is written on the paper itself: ink on a light paper, light on a dark one.
  const lum = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); if (!m) return 1; const v = parseInt(m[1], 16); return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255; };
  const ON_PAPER = lum(PAPER) > 0.45 ? "#1c1916" : "#f2ece4";

  // The order the prints change in: reading order (the original's), a spiral from the edge in, or at random (the same
  // at every render).
  const ordre = setting("ordre", "lecture");
  const order = (() => {
    const ids = Array.from({ length: N }, (_, j) => j);
    if (ordre === "hasard") return ids.map((j) => ({ j, r: random("mosaic-order-" + j) })).sort((a, b) => a.r - b.r).map((x) => x.j);
    if (ordre !== "spirale") return ids;
    const out = [];
    let up = 0, left = 0, down = ROWS - 1, right = COLS - 1;
    while (up <= down && left <= right) {
      for (let c = left; c <= right; c++) out.push(up * COLS + c);
      up++;
      for (let r = up; r <= down; r++) out.push(r * COLS + right);
      right--;
      if (up <= down) { for (let c = right; c >= left; c--) out.push(down * COLS + c); down--; }
      if (left <= right) { for (let r = down; r >= up; r--) out.push(r * COLS + left); left++; }
    }
    return out;
  })();
  const rank = new Array(N);
  order.forEach((j, k) => { rank[j] = k; });

  // Its block: the whole frame but the original's margin (1,2 % of the width on the sides, 0,35 % of the height at the
  // edges up and down), or a block of that width in the middle of the paper; a gap of 0,4 % of the width between prints.
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

  // Wave w lays its shot's picture: print j (its rank in the order) on the wave's start plus rank × its length / N, its
  // first print on the cut (on the beat), its last just before the next cut; until its first wave, a print shows the
  // first picture.
  const landed = (w, j) => waves[w].at + Math.floor((rank[j] * (waves[w].to - waves[w].at)) / N + 1e-6);
  const waveOf = (j) => { let found = -1; for (let w = 0; w < waves.length; w++) { if (landed(w, j) <= frame) found = w; else break; } return found; };
  // A print lands askew and stays so until the next one lands (3 images at the original's step), then lies straight at
  // once: about 1°, counterclockwise for the first one and the way alternating from one to the next, a pixel or two off.
  const LAND = (w) => Math.max(1, Math.round((waves[w].to - waves[w].at) / N));
  const askew = (j) => { const w = waveOf(j); return w >= 0 && frame - landed(w, j) < LAND(w); };
  const lean = (j, w) => ((w * N + rank[j]) % 2 ? 1 : -1) * (0.4 + 1.2 * random("mosaic-lean-" + w + "-" + j));
  const nudge = (j, w, axis) => Math.round((random("mosaic-nudge-" + axis + "-" + w + "-" + j) - 0.5) * 6);

  // Each picture as the montage plays it: a video in time with its shot, holding its nearest image before and after it
  // (the first picture its last image, a picture being replaced the image it stopped on), a photo still.
  const shotOf = (w) => (w < 0 ? first : waves[w].shot);
  const picture = (w, x, y) => h(Footage, { shot: shotOf(w), style: { left: x - BLEED, top: y - BLEED, width: bw + 2 * BLEED, height: bh + 2 * BLEED } });
  // Each picture on screen drawn once in its block, seen through its prints only (the paper shows in the gaps); a print
  // landing drawn on its own, its piece of the picture askew with it, the paper showing where it has not landed yet.
  const groups = {};
  const seen = [];
  tiles.forEach((t) => {
    if (askew(t.j)) return;
    const w = waveOf(t.j);
    if (!groups[w]) { groups[w] = []; seen.push(w); }
    groups[w].push(t);
  });
  const layers = seen.map((w) =>
    h("div", { key: "w" + w, style: { position: "absolute", left: 0, top: 0, width, height, clipPath: "path('" + groups[w].map(outline).join(" ") + "')", backgroundColor: SHEET } }, picture(w, bx, by)));
  const prints = tiles.filter((t) => askew(t.j)).map((t) => {
    const w = waveOf(t.j);
    return h("div", { key: "p" + t.j, style: { position: "absolute", left: t.x + nudge(t.j, w, "x"), top: t.y + nudge(t.j, w, "y"), width: t.w, height: t.h, overflow: "hidden", backgroundColor: SHEET, transform: "rotate(" + lean(t.j, w).toFixed(2) + "deg)" } },
      picture(w, bx - t.x, by - t.y));
  });

  // Her optional title, all along it: a plain line on a paper label laid at the top of the grid (laid like a print, a
  // hair askew its first images); in a block, in the serif on the paper above it. A number never breaks between digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const titre = word("titre");
  const label = titre && kind === "vertical"
    ? h(FitText, { style: { position: "absolute", left: 140, top: 150, width: width - 280, height: 140, transform: frame < 3 ? "translate(2px, -1px) rotate(1.1deg)" : undefined }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 52, lineHeight: 1.12, color: INK, textAlign: "center" } },
        h("span", { style: { display: "inline-block", maxWidth: "100%", background: SHEET, padding: "10px 26px" } }, keep(titre)))
    : null;
  const heading = titre && kind !== "vertical"
    ? h(FitText, { style: { position: "absolute", left: 140, width: width - 280, top: Math.max(100, by - 250), height: Math.max(110, Math.min(200, by - 150)) }, innerStyle: { justifyContent: "flex-end", fontFamily: display, fontWeight: 400, fontSize: 100, lineHeight: 1.02, letterSpacing: "-0.01em", color: ON_PAPER, textAlign: "center", textWrap: "balance" } },
        h("span", null, keep(titre)))
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: PAPER, overflow: "hidden" } }, layers, prints, label, heading);
}`;

export const mosaique: EffectPiece = {
  key: "mosaique",
  version: 1,
  name: "La mosaïque",
  how: "l'image à l'écran se coupe d'un coup en douze tirages posés à la main sur un papier gris clair, puis chacun de ses plans remplace l'image d'avant case par case dans l'ordre de lecture, de sa coupe à la suivante, chaque case posée un instant de travers puis droite : une case change toujours, ses photos restent figées, ses vidéos jouent ; puis le montage reprend, le plan suivant en plein écran.",
  needs: "une série de photos ou de vidéos serrées de même famille (ses plats, ses produits, ses créations), le sujet au centre, chacune différente de la précédente, de préférence sur un fond sombre et simple où les traits du papier se lisent.",
  lays: "sur 3 à 12 de ses plans serrés de même famille, coupés d'un ou deux temps chacun (à deux temps, une case toutes les 3 images comme l'original), chacun devenant une image de la grille, le plus beau en dernier ; l'image juste avant est celle qui se coupe en tirages",
  shots: [3, 12],
  seconds: [2.5, 8],
  require: { files: 3, shot: { framing: ["close", "detail"] } },
  texts: [
    {
      slot: "titre",
      want: "facultatif : un titre court sur une étiquette de papier posée en haut de la grille (en serif au-dessus du bloc quand ses images sont entières), tout le long de l'effet : son nom, son plat, son moment (une forme comme « la carte d'automne », « nos fraisiers », « les nouveautés ») ; seulement quand ce moment a besoin de mots",
      max: 24,
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
      want: "la forme de la grille : plein cadre comme l'original et le montage autour, ou ses images horizontales entières dans un bloc au milieu du papier",
      choices: [
        { value: "vertical", says: "plein cadre, 3 × 4 cases debout, comme l'original" },
        { value: "horizontal", says: "ses images horizontales entières : 4 × 3 cases couchées dans un bloc 16:9 au milieu du papier, son titre au-dessus" },
        { value: "carre", says: "un bloc carré de 3 × 3 cases au milieu du papier, pour un mélange d'images verticales et horizontales" },
      ],
    },
  ],
  code: CODE,
};
