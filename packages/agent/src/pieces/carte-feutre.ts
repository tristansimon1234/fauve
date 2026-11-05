import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Carte au feutre », the effect (docs/fiches/carte-feutre.md, effects 1 to 5; its whole Reel is skills/carte-feutre.ts):
// over a run of her shots, an open notebook, drawn as the skill draws it (two pages of warm light grey paper, its binding
// across the middle with its stitches, corners hardly rounded, a notch at the fold, no shadow; 66,5 × 41 % of the frame
// in its middle), is laid over her pictures, which pass under it in stop motion: a new one every 3 images (a tenth of a
// second, never on the music), hers in her order, round after round, full frame (or, when most of hers are in width,
// two bands above and under the notebook, changing one after the other); a photo the same image each time, a video a
// little further on its passage each time it comes back. The notebook stays empty a beat (its hook: nothing written,
// all passing), then her message is written on it by a hand that never repeats, in felt-pen capitals, a word at a time
// (a word of one or two letters with the next one), each on a change of picture, the notebook taking a new pose with
// each (the original's: 4 to 7°, left and right in turn, its centre and size a hair off); the name she announces lands
// last, the biggest line, the notebook straight; her whole sentence is then held as long as it takes to read it (a
// third of the span at least, half at most), her pictures still passing; then the montage takes over, her next shot
// full frame. Its steps are spread over its span: the original's 0,83 s between two words on a long one, a few tenths
// on a short one. Its ink the original's red, or her colour when it is dark enough to read on its paper (encre); its
// pictures' place on her word (format). Kept from the skill: its notebook, its eight poses, its hand (Handwriting in
// Covered By Your Grace stretched to the original's tall narrow capitals, two lines a page, each across the page's width,
// the name in a slot a third taller), its pace of pictures, and (v2) its music's blank under the name: the music stops
// dead up to a beat after the word before it and comes back on the Reel's beat just after the name lands (the
// original's 5,57 – 5,93 s, its name 2 images before the return). Left out: its ending card, its music's late start, its
// warm tone on her pictures (they keep the light of the Reel around it); no sound (the original lays none when a word
// arrives).

/** Its words' pace (images): a new picture every 3, each word landing on one. */
const TICK = 3;
/** Its music back this long after the name lands at least (images: the original's 2), on the Reel's next beat. */
const RETURN_AFTER = 2;
/** Its blank this long at least (s), else none: shorter, it would be heard as the sound cutting out. */
const BLANK_LEAST = 0.2;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * When each of its words lands (frames from its start), as its code spreads them: a word of one or two letters with the
 * next one, the notebook empty a beat first, the name last, her whole sentence then held long enough to read; each on a
 * change of picture. Its code's own reckoning, word for word (its words in capitals, one space between them).
 */
export function carteFeutreLands(frames: number, beat: number, texts: Record<string, string>): { lands: number[]; named: boolean } {
  const up = (s: string | undefined) => String(s || "").trim().replace(/(\d) (?=\d)/g, "$1\u00a0").toLocaleUpperCase("fr").replace(/\s+/g, " ").trim();
  const msg = up(texts.message);
  const nm = up(texts.nom);
  const words = msg ? msg.split(" ") : [];
  const length = (w: string) => Array.from(w).length;
  const short = (w: string) => length(w.replace(/[.,!?;:…'’"«»()]/g, "")) <= 2;
  const ends: number[] = [];
  words.forEach((w, i) => {
    if (!short(w) || i === words.length - 1) ends.push(i + 1);
  });
  const steps = ends.length + (nm ? 1 : 0);
  const said = words.length + (nm ? nm.split(" ").length : 0);
  const BEAT = beat > 0 ? beat : 18;
  const EMPTY = Math.max(TICK * 2, Math.min(BEAT, frames * 0.15));
  const READ = Math.max(36, (0.8 + 0.3 * said) * 30);
  const HOLD = Math.max(frames / 3, Math.min(READ, frames / 2));
  const LAST = Math.max(EMPTY, frames - HOLD);
  const snap = (f: number) => Math.max(TICK, Math.round(f / TICK) * TICK);
  const lands: number[] = [];
  for (let j = 0; j < steps; j++) {
    const f = snap(steps > 1 ? EMPTY + (j * (LAST - EMPTY)) / (steps - 1) : EMPTY);
    lands.push(j ? Math.max(f, lands[j - 1]! + TICK) : f);
  }
  return { lands, named: Boolean(nm) };
}

/**
 * Its music's blank under the name (s from its start): back on the Reel's first beat at least two images after the name
 * lands (its beats counted from its first shot's cut, which falls on one), stopped a beat before, never before the word
 * before it has landed; none without a name, too short, or past its span.
 */
export function carteFeutreTimeline({ frames, bpm, shots, words }: PieceTimelineInput): PieceTimeline {
  const beat = round3((60 / bpm) * REEL_FPS);
  const { lands, named } = carteFeutreLands(frames, beat, words);
  const name = named ? lands.at(-1) : undefined;
  if (name === undefined) return {};
  const grid = shots[0]?.from ?? 0;
  const back = grid + Math.ceil((name + RETURN_AFTER - grid) / beat - 1e-6) * beat;
  const before = lands.length > 1 ? lands[lands.length - 2]! + 1 : 0;
  const stop = Math.min(name, Math.max(back - beat, before));
  if (back > frames - 1 || (back - stop) / REEL_FPS < BLANK_LEAST) return {};
  return { music: { pauses: [{ from: round3(stop / REEL_FPS), to: round3(back / REEL_FPS) }] } };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its pictures: her shots that play during it, in order (a sliver of one at either edge left out, as the engine counts them).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from <= durationInFrames - 2 && shots[i].from + shots[i].durationInFrames >= 2);
  const n = mine.length;
  const BEAT = mark("beat", 18);
  const TICK = 3;
  const t = Math.floor(frame / TICK);
  const FAR = durationInFrames * 4 + 1000;

  // 1. A new picture every 3 images, hers in her order, round after round: a photo the same image each time it comes
  // back, a video 3 images further on its passage each time (stop motion: each of its images held while it shows).
  // Full frame, as the original's; or, when most of hers are in width (or on her word), two bands of them above and
  // under the notebook (a horizontal picture whole in each), changing one after the other.
  const format = setting("format", "auto");
  const wide = mine.filter((i) => (Number(shots[i].aspect) || 0.5625) > 1.15).length;
  const bands = format === "bandes" || (format === "auto" && wide * 2 > n);
  const picture = (k, style) => {
    const i = mine[k % n];
    const s = shots[i];
    const m = s.kind === "video" ? Math.min(Math.max(0, Math.round(s.durationInFrames) - 1), Math.floor(k / n) * TICK) : 0;
    return h(Footage, { key: "p" + k, shot: i, at: s.kind === "video" ? frame - m : FAR, style: { position: "absolute", ...style } });
  };
  const BAND = Math.round(height / 3);
  const pictures = !n
    ? null
    : bands
      ? [picture(2 * Math.floor((t + 1) / 2), { left: 0, top: 0, width, height: BAND }), picture(2 * Math.floor(t / 2) + 1, { left: 0, top: height - BAND, width, height: BAND })]
      : picture(t, { left: 0, top: 0, width, height });

  // 2. Her words: her message, then the name she announces (its last line, the biggest), in capitals. Her message in
  // three lines at most, the longest as short as can be: two lines on the top page, the rest and the name on the bottom one.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const up = (s) => keep(s).toLocaleUpperCase("fr").replace(/\s+/g, " ").trim();
  const msg = up(word("message"));
  const nm = up(word("nom"));
  const words = msg ? msg.split(" ") : [];
  const length = (s) => Array.from(s).length;
  const split = (list, k) => {
    let best = null;
    const go = (start, left, acc) => {
      if (left === 1) {
        const rows = acc.concat([list.slice(start).join(" ")]);
        const most = Math.max.apply(null, rows.map(length));
        if (!best || most < best.most) best = { most, rows };
        return;
      }
      for (let stop = start + 1; stop <= list.length - left + 1; stop++) go(stop, left - 1, acc.concat([list.slice(start, stop).join(" ")]));
    };
    if (list.length) go(0, Math.max(1, Math.min(k, list.length)), []);
    return best ? best.rows : [];
  };
  const lines = split(words, Math.max(1, Math.min(3, Math.round(length(msg) / 11))));
  const topLines = lines.slice(0, 2);

  // When each word lands: a word of one or two letters (or « & ») with the next one, the one before the name alone; the
  // notebook empty a beat first (its hook), the name last; spread so that her whole sentence is then held long enough to
  // read (0,8 s and 0,3 s a word, a third of the span at least, half of it at most), each on a change of picture.
  const short = (w) => length(w.replace(/[.,!?;:…'’"«»()]/g, "")) <= 2;
  const ends = [];
  words.forEach((w, i) => { if (!short(w) || i === words.length - 1) ends.push(i + 1); });
  const steps = ends.length + (nm ? 1 : 0);
  const said = words.length + (nm ? nm.split(" ").length : 0);
  const EMPTY = Math.max(TICK * 2, Math.min(BEAT, durationInFrames * 0.15));
  const READ = Math.max(36, (0.8 + 0.3 * said) * 30);
  const HOLD = Math.max(durationInFrames / 3, Math.min(READ, durationInFrames / 2));
  const LAST = Math.max(EMPTY, durationInFrames - HOLD);
  const snap = (f) => Math.max(TICK, Math.round(f / TICK) * TICK);
  const lands = [];
  for (let j = 0; j < steps; j++) {
    const f = snap(steps > 1 ? EMPTY + (j * (LAST - EMPTY)) / (steps - 1) : EMPTY);
    lands.push(j ? Math.max(f, lands[j - 1] + TICK) : f);
  }
  const passed = lands.filter((f) => frame >= f).length;
  const written = Math.min(ends.length, passed);
  const named = Boolean(nm) && passed > ends.length;
  let shown = written ? length(words.slice(0, ends[written - 1]).join(" ")) : 0;
  if (named) shown = length(words.concat([nm]).join(" "));
  const topLength = length(topLines.join(" "));
  const whole = steps > 0 && passed >= steps;

  // 3. The notebook: one of its eight poses (the original's, measured: its centre as shares of the frame, its angle), a
  // new one with each word, left and right in turn, the last one straight when the sentence is whole; a little
  // perspective (its outline's bottom 1 to 2,5 % wider than its top: a flat outline, never a 3D transform) and a size a
  // hair different each time. Still between two words.
  const POSES = [[0.5, 0.53, -7.3], [0.498, 0.525, 4], [0.514, 0.5, -4.3], [0.499, 0.53, -0.3], [0.5, 0.527, 4.5], [0.497, 0.523, 4.3], [0.504, 0.511, -5.3], [0.527, 0.502, -0.4]];
  const step = whole ? 7 : written;
  const pose = step === 7 ? POSES[7] : step ? POSES[1 + ((step - 1) % 6)] : POSES[0];
  const NW = Math.round(width * 0.665);
  const NH = Math.round(height * 0.41);
  const sc = (1 + (random("carnet-s-" + step) - 0.5) * 0.03).toFixed(4);
  const FOLD = Math.round(NH * 0.495);
  const R = Math.round(NW * 0.02);
  const C = Math.round(NW * 0.009);
  const T = Math.round(NW * (0.005 + 0.0075 * random("carnet-p-" + step)));
  const inset = (y) => Math.round(T * (1 - y / NH));
  const L = (x, y) => " L" + x + " " + y;
  const arc = (x, y) => " A" + R + " " + R + " 0 0 1 " + x + " " + y;
  const shape = "path('M" + (T + R) + " 0 H" + (NW - T - R) + arc(NW - T, R) + L(NW - inset(FOLD - C), FOLD - C) + L(NW - inset(FOLD) - C, FOLD) + L(NW - inset(FOLD + C), FOLD + C) + L(NW, NH - R) + arc(NW - R, NH) + " H" + R + arc(0, NH - R) + L(inset(FOLD + C), FOLD + C) + L(inset(FOLD) + C, FOLD) + L(inset(FOLD - C), FOLD - C) + L(T, R) + arc(T + R, 0) + " Z')";

  // Its ink: the original's red; her colour when it is dark enough to read on its paper (on her word, the red always).
  const rgb = (c) => { const x = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); if (!x) return null; const v = parseInt(x[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const lin = (s) => { const v = s / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const own = rgb(brand.accent);
  const dark = own && 0.2126 * lin(own[0]) + 0.7152 * lin(own[1]) + 0.0722 * lin(own[2]) <= 0.12;
  const ink = setting("encre", "sienne") === "sienne" && dark ? String(brand.accent).toLowerCase() : "#b20b21";

  // Its lines written by a hand that never repeats, at the left, each across the page's width, its capitals stretched to
  // the original's height (tall and narrow): two lines on the top page; on the bottom one, the third and the name she
  // announces, the biggest line (the original's 10,5 % of the image, the others 6,9 to 8,3 %): its slot a third taller
  // and the page stretched as far as the name's width needs to fill it, its letters tighter. Two blocks at most: each
  // one's grain is a filter pass a frame.
  const hand = "'Covered By Your Grace', '" + brand.displayFont + "', cursive";
  const STRETCH = 1.45;
  const page = (rows, y, hh, upTo, seed, stretch, last) => rows.length && upTo > 0
    ? h("div", { key: seed, style: { position: "absolute", left: 0, top: y, width: NW, height: hh, transformOrigin: "50% 0%", transform: "scaleY(" + stretch.toFixed(3) + ")" } },
        h(Handwriting, { text: rows.join("\n"), box: { x: Math.round(NW * 0.018), y: 0, w: Math.round(NW * 0.964), h: Math.round(hh / stretch) }, upTo, color: ink, grain: 0.6, wobble: 1, last, align: "left", style: { fontFamily: hand, fontWeight: 400, ...(rows.length === 1 && rows[0] === nm ? { letterSpacing: "-0.02em" } : {}) }, seed }))
    : null;
  const topH = Math.round(NH * 0.4);
  const bottomH = Math.round(NH * 0.42);
  const third = lines[2] || null;
  const bottom = (third ? [third] : []).concat(nm ? [nm] : []);
  const last = third && nm ? 1.3 : 1;
  const nameSlot = third && nm ? (bottomH / 2.3) * 1.3 : bottomH;
  const stretched = nm ? Math.max(STRETCH, Math.min(2, (0.92 * nameSlot) / (0.72 * ((NW * 0.964) / (Math.max(4, length(nm)) * 0.38))))) : STRETCH;
  const writing = [
    page(topLines, Math.round(NH * 0.045), Math.round((topH * Math.max(1, topLines.length)) / 2), Math.min(shown, topLength), "carnet-haut", STRETCH, 1),
    page(bottom, Math.round(NH * 0.535), bottomH, Math.max(0, shown - topLength - 1), "carnet-bas", stretched, last),
  ];
  const notebook = h("div", { style: { position: "absolute", left: Math.round(width * pose[0] - NW / 2), top: Math.round(height * pose[1] - NH / 2), width: NW, height: NH, transformOrigin: "50% 50%", transform: "rotate(" + pose[2] + "deg) scale(" + sc + ")" } },
    h("div", { style: { position: "absolute", left: 0, top: 0, width: NW, height: NH, clipPath: shape, background: "linear-gradient(180deg, #dcdad0 0%, #dad8cf 36%, #d6d4ca 41.5%, #c4c3b9 46.5%, #b7b6ad 49.3%, #a6a59d 49.5%, #c6c5bc 50%, #d9d8cf 52%, #dbdad1 70%, #d8d7ce 100%)" } },
      h("div", { style: { position: "absolute", left: 0, top: FOLD - 2, width: NW, height: 4, background: "repeating-linear-gradient(90deg, rgba(88,87,80,0.55) 0px, rgba(88,87,80,0.55) 4px, rgba(0,0,0,0) 4px, rgba(0,0,0,0) 23px)" } })),
    writing);

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, pictures, notebook);
}`;

export const carteFeutre: EffectPiece = {
  key: "carte-feutre",
  version: 2,
  name: "Carte au feutre",
  how: "un carnet ouvert gris clair est posé au milieu de l'écran par-dessus ses photos qui défilent en stop motion, une nouvelle toutes les 3 images (un dixième de seconde), dans son ordre, tour après tour (en deux bandes au-dessus et au-dessous du carnet quand la plupart sont horizontales) ; le carnet reste vide un temps, puis son message s'y écrit à la main au feutre (rouge, ou de sa couleur quand elle est foncée) en capitales, un mot à la fois, le carnet changeant de pose à chaque mot ; le nom de ce qu'elle annonce arrive en dernier, la plus grande ligne, le carnet droit, et la phrase entière reste le temps de la lire, les photos défilant toujours ; puis le montage reprend, le plan suivant en plein écran.",
  needs: "une dizaine de photos ou d'images de ses vidéos ou plus (ses plats ou ses produits vus de dessus, des gens à table, son équipe, ses imprimés), où ce qui compte est en haut ou en bas de l'image (le carnet cache le milieu), et un message de 6 à 9 mots qui finit sur le nom de ce qu'elle annonce.",
  lays: "sur 6 à 20 de ses plans coupés d'un temps chacun, d'une autre lumière l'un de l'autre, d'autant plus long que son message a de mots",
  shots: [6, 20],
  seconds: [3, 8],
  require: { files: 8 },
  texts: [
    {
      slot: "message",
      want: "le début de son message, écrit à la main sur le carnet un mot à la fois, qui amène le nom de ce qu'elle annonce : une invitation dite simplement comme on l'écrit sur un carnet (une forme comme « ce jeudi on vous attend pour la », « viens fêter l'été avec nous à la »), 4 à 7 mots, sans slogan",
      max: 32,
      required: true,
    },
    {
      slot: "nom",
      want: "le nom de ce qu'elle annonce, qui finit la phrase en plus grand (« soirée jazz », « pizza du jeudi », « brunch »), 1 à 3 mots",
      max: 16,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "la place de ses images sous le carnet : plein écran comme l'original, ou en deux bandes au-dessus et au-dessous du carnet (pour des images horizontales)",
      choices: [
        { value: "auto", says: "comme ses images : plein écran, ou deux bandes quand la plupart sont horizontales" },
        { value: "vertical", says: "chaque image plein écran, comme l'original (une image horizontale y est recadrée)" },
        { value: "bandes", says: "deux bandes d'images horizontales entières au-dessus et au-dessous du carnet, qui changent l'une après l'autre" },
      ],
    },
    {
      name: "encre",
      want: "la couleur de l'encre",
      choices: [
        { value: "sienne", says: "sa couleur quand elle est assez foncée pour se lire sur le papier gris, sinon le rouge de l'original" },
        { value: "rouge", says: "le rouge du feutre de l'original" },
      ],
    },
  ],
  timeline: carteFeutreTimeline,
  code: CODE,
  fonts: ["Covered By Your Grace"],
};
