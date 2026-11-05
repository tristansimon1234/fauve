import type { EffectPiece } from "../pieces.ts";

// « Photo dump », the effect (docs/fiches/photo-dump.md, effects 1 to 5; its whole Reel is skills/photo-dump.ts): over a
// run of her shots, a very light grey page covers the frame, and in its middle one picture at a time, laid at once at
// its own shape and the same width (80 % of the frame: a portrait 3:4, a tall 9:16, a landscape 4:3; a wider video
// framed 4:3, else it would be a thin strip on the page), once a smaller one (73,5 % of the others, about a third of
// the way); no border, no shadow, a new one on every half beat (the original's 0,35 s; a beat when half a beat would be
// shorter than 7 images), the last one until its end. The editor cuts her shots a beat each at least, so the burst
// lays each of them twice (or more, on a long span), with Footage `at`: her first half and her second half interleaved
// (A E B F C G D H), then the pairs swapped (E A F B G C H D), never a loop one reads, never twice in a row; a photo the
// same image each time, a video a little further on its passage each time it comes back, playing while it is on, as
// the original's Live Photos. Then the montage takes over, her next shot full frame. Its title, optional, a plain line
// on a white pill above the pictures (the skill's, for when the Reel needs words: the original has none). The page may
// take her charter's light colour (fond), and her pictures may all be framed upright 3:4 (format), on her word. Left
// out: the skill's ending card and its whole Reel's timeline; no sound (the original lays none on its cuts).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its shots: those that play during it, in order (a sliver of one at either edge left out, as the engine counts them).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from <= durationInFrames - 2 && shots[i].from + shots[i].durationInFrames >= 2);
  if (!mine.length) return null;
  const n = mine.length;
  const BEAT = mark("beat", 18);

  // 1. A new picture every half beat (the original's 0,35 s), a beat when half a beat is under 7 images; the last one
  // until its end (a little longer, at most).
  const STEP = BEAT / 2 >= 7 ? BEAT / 2 : BEAT;
  const count = Math.max(1, Math.floor(durationInFrames / STEP + 0.25));
  const at = Math.min(count - 1, Math.floor(frame / STEP));

  // 2. Which of her shots: each one in every round of n pictures, her first half and her second half interleaved, then
  // the pairs swapped (A E B F C G D H, then E A F B G C H D): her shots come back, never as a loop one reads, never
  // twice in a row. Two shots alternate; one stays.
  const half = Math.ceil(n / 2);
  const rounds = [[], []];
  for (let i = 0; i < half; i++) {
    rounds[0].push(mine[i]);
    if (i + half < n) {
      rounds[0].push(mine[i + half]);
      rounds[1].push(mine[i + half]);
    }
    rounds[1].push(mine[i]);
  }
  const shotOf = (j) => (n < 3 ? mine[j % n] : rounds[Math.floor(j / n) % 2][j % n]);
  const k = shotOf(at);
  const s = shots[k];
  const video = s.kind === "video";
  // A photo the same image each time it comes back; a video plays while it is on, a little further on its passage
  // each time it comes back (its first images, then the next ones, round after round), held on its last image.
  const start = Math.round(at * STEP);
  const span = Math.max(1, Math.round(STEP));
  const length = Math.max(1, Math.round(s.durationInFrames));
  const offset = length > span ? (Math.floor(at / n) * span) % (length - span + 1) : 0;
  const shown = Math.max(0, Math.min(length - 1, offset + frame - start));
  const FAR = durationInFrames * 4 + 1000;

  // 3. Its place: alone in the middle, 80 % of the frame's width at its own shape (between a tall 9:16 and a 4:3: a
  // wider video framed 4:3), or all upright 3:4 on her word; once a smaller one, at 73,5 % (about a third of the way,
  // never the first nor the last). No border, no shadow; laid at once, still.
  const upright = setting("format", "forme") === "hauteur";
  const aspect = Number(s.aspect) || (video ? 0.5625 : 0.75);
  const a = upright ? 0.75 : Math.max(0.5625, Math.min(4 / 3, aspect));
  const smallAt = count >= 6 ? Math.max(2, Math.round(count / 3)) : -1;
  const small = at === smallAt && at < count - 1;
  const w = Math.round(width * 0.8 * (small ? 0.735 : 1));
  const hh = Math.round(w / a);
  const picture = h("div", { key: "pic" + at, style: { position: "absolute", left: Math.round((width - w) / 2), top: Math.round((height - hh) / 2), width: w, height: hh, overflow: "hidden" } },
    h(Footage, { shot: k, at: video ? frame - shown : FAR, style: { left: 0, top: 0, width: w, height: hh } }));

  // 4. Its page: the original's very light grey, plain (no grain, no texture); her charter's light colour on her word,
  // when it is light enough to stay a page.
  const lum = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
    if (!m) return null;
    const v = parseInt(m[1], 16);
    const ch = (x) => { const q = x / 255; return q <= 0.03928 ? q / 12.92 : Math.pow((q + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch((v >> 16) & 255) + 0.7152 * ch((v >> 8) & 255) + 0.0722 * ch(v & 255);
  };
  const light = brand.palette && brand.palette.light;
  const PAGE = setting("fond", "gris") === "charte" && (lum(light) || 0) >= 0.6 ? String(light) : "#efefef";

  // 5. Its title, when the Reel needs words: a plain line in ink on a white pill above the pictures, as Instagram
  // writes it, all along it (a tall picture stops under it).
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif";
  const keep = (t) => String(t || "").replace(/(\d) (?=\d)/g, "$1 ");
  const title = word("titre");
  const label = title
    ? h(FitText, { style: { position: "absolute", left: 140, width: width - 280, top: 84, height: 96 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#161616", textAlign: "center" } },
        h("span", { style: { background: "#ffffff", padding: "6px 20px", borderRadius: 40 } }, keep(title)))
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: PAGE, overflow: "hidden" } }, picture, label);
}`;

export const photoDump: EffectPiece = {
  key: "photo-dump",
  version: 1,
  name: "Photo dump",
  how: "une page gris très clair couvre l'écran et ses photos et petits passages de vidéo s'y posent un à la fois, d'un coup, au milieu, chacun à sa forme sur la même largeur (une fois un plus petit), sans bord ni ombre, un nouveau tous les demi-temps, comme un carnet qu'on feuillette ; chacun de ses plans revient une deuxième fois dans un autre ordre (une vidéo un peu plus loin), jamais deux fois de suite ; puis le montage reprend, le plan suivant en plein écran.",
  needs: "beaucoup de photos et de petits moments de sa semaine, tous différents (une dizaine au moins : l'équipe, les clients, des détails, le lieu, le quartier), surtout en hauteur, et quelques courtes vidéos où quelque chose bouge.",
  lays: "sur 6 à 16 de ses plans coupés d'un temps chacun (photos et courts passages de vidéo), jamais deux fois la même chose de suite, le premier le plus beau",
  shots: [6, 16],
  seconds: [2, 8],
  require: { files: 8 },
  texts: [
    {
      slot: "titre",
      want: "un titre court dans une pastille blanche au-dessus des images, comme sur Instagram (sa semaine, son nom, son moment : une forme comme « ma semaine en vrac », « octobre chez nous »), seulement quand le Reel a besoin de mots",
      max: 28,
      required: false,
    },
  ],
  settings: [
    {
      name: "fond",
      want: "la couleur de la page sous ses images",
      choices: [
        { value: "gris", says: "gris très clair, comme l'original" },
        { value: "charte", says: "la couleur claire de sa charte (crème, lilas…), quand elle en a une" },
      ],
    },
    {
      name: "format",
      want: "la forme de ses images sur la page",
      choices: [
        { value: "forme", says: "chacune à sa forme, comme ses fichiers (une vidéo horizontale en 4:3)" },
        { value: "hauteur", says: "toutes recadrées en hauteur 3:4 sur leur sujet (quand la plupart de ses fichiers sont horizontaux)" },
      ],
    },
  ],
  code: CODE,
};
