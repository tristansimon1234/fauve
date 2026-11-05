import type { EffectPiece } from "../pieces.ts";

// « Cadre dans le cadre », the effect (docs/fiches/cadre.md, effects 1 to 4; its whole Reel is skills/cadre.ts): over a
// run of her shots, the first one, her widest, is frozen on its first image in a dark, contrasted black and white and
// fills the frame; in its middle (or in her door, her window, her mirror at the back of it, when the filler saw one
// there) a frame with no edge, no shadow and square corners shows her shots in colour, each in its turn, the first one
// that widest shot itself; at each cut the frame is a notch larger, at once (never a zoom: nothing moves between two
// notches), from 15 % of the picture's width to 95 % at its last cut. With fewer than four shots under it, it also grows a
// notch on each beat (the same picture a notch larger). Then the montage takes over, her next shot full frame, as the
// original's last picture takes the whole frame. Two small labels in white capitals may stay on the middle line all
// along it, over everything (what is going on on the left, her name on the right), at the original's size: a decor text.
// The frame is upright (2:3) as the original's, lying (3:2) when most of its shots are in width. Nothing of the
// original's own: its words (« WORK IN PROGRESS », « ARTSIRI SPACE ») give way to hers.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  // Its shots: those that play during it, in order; the first one is its ground.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return null;
  const ground = mine[0];
  const BEAT = mark("beat", 18);

  // When the frame grows a notch: at each cut under it; with fewer than four shots, on each beat too (a notch larger, the
  // same picture), so a short run still opens step by step. Never between two notches: nothing moves, never a zoom.
  const cuts = mine.slice(1).map((i) => Math.round(shots[i].from));
  const beats = mine.length < 4 ? Array.from({ length: Math.max(0, Math.floor((durationInFrames - 2) / BEAT)) }, (_, k) => Math.round((k + 1) * BEAT)) : [];
  const steps = [...new Set([...cuts, ...beats])].filter((f) => f > 0 && f < durationInFrames - 1).sort((a, b) => a - b);
  const notch = steps.filter((f) => f <= frame).length;
  const t = steps.length ? notch / steps.length : 1;
  // The picture in the frame: the shot playing now (at first, the ground itself, in colour).
  const cur = mine.reduce((k, i) => (shots[i].from <= frame ? i : k), ground);

  // Its frame upright (2:3) as the original's, or lying (3:2) when most of its shots are in width.
  const aspect = (s) => Number(s && s.aspect) || 0.5625;
  const lying = mine.filter((i) => aspect(shots[i]) > 1.15).length * 2 > mine.length;
  const A = lying ? 3 / 2 : 2 / 3;
  const laid = { left: 0, top: 0, width, height };
  const across = A >= width / height;
  const sized = (k) => {
    const w = across ? width * k : height * k * A;
    const hh = across ? w / A : height * k;
    return { x: (width - w) / 2, y: (height - hh) / 2, w, h: hh };
  };
  const SMALL = 0.15;
  const LARGE = 0.95;
  const goal = sized(LARGE);
  // Opened first in her door, her window, her mirror at the back of her widest shot (its filler named it, found near the
  // middle, a sensible size), its notches going from that box to the centred one; else at the exact centre.
  const found = SubjectBox(shots[ground], shots[ground].from, laid, "@porte");
  const fits = (b) => Boolean(b) && b.w >= width * 0.05 && b.w <= width * 0.5 && b.h >= height * 0.04 && b.h <= height * 0.6 && b.w / b.h >= 0.25 && b.w / b.h <= 3 &&
    Math.abs(b.x + b.w / 2 - width / 2) <= width * 0.2 && Math.abs(b.y + b.h / 2 - height / 2) <= height * 0.2;
  const door = fits(found) ? found : null;
  const start = door || sized(SMALL);
  const box = {
    x: Math.round(start.x + (goal.x - start.x) * t),
    y: Math.round(start.y + (goal.y - start.y) * t),
    w: Math.round(start.w + (goal.w - start.w) * t),
    h: Math.round(start.h + (goal.h - start.h) * t),
  };

  // Behind it, her widest shot frozen on its first image, in a dark and contrasted black and white (the original's: a
  // grey 26 % bright on average, its blacks closed, its whites at 87 %).
  const GREY = "grayscale(1) brightness(0.75) contrast(1.4)";
  const FAR = durationInFrames * 4 + 1000;
  const picture = h(React.Fragment, null,
    h(Footage, { shot: ground, at: FAR, style: { left: 0, top: 0, width, height, filter: GREY } }),
    h("div", { style: { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden" } },
      h(Footage, { shot: cur, style: { left: 0, top: 0, width: box.w, height: box.h } })));

  // Its two small labels, fixed all along it, over everything: what is going on on the left, her name on the right, 13 %
  // from either edge, on the middle line. As the original's: capitals at 1,3 % of the frame's height, medium weight, pure
  // white, no box, a tight dark edge (on a light picture they still read). A decor text, at its original's size.
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const SIZE = 26;
  const MARGIN = Math.round(width * 0.13);
  const edge = "0 0 1px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)";
  const label = (text, side) => text
    ? h("div", { key: side, "data-fauve-decor": "", style: { position: "absolute", [side]: MARGIN, top: Math.round(height / 2) - SIZE, height: SIZE * 2, display: "flex", alignItems: "center", fontFamily: body, fontWeight: 500, fontSize: SIZE, lineHeight: 1, letterSpacing: "0.02em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: edge } }, keep(text))
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, picture, label(word("gauche"), "left"), label(word("droite"), "right"));
}`;

export const cadre: EffectPiece = {
  key: "cadre",
  version: 1,
  name: "Cadre dans le cadre",
  how: "son plan le plus large figé en noir et blanc sombre remplit l'écran ; au milieu (ou dans sa porte, sa fenêtre, son miroir au fond), un cadre sans bord montre ses plans en couleur, chacun à son tour, et grandit d'un cran d'un coup à chaque coupe, de 15 % à 95 % de la largeur ; puis le montage reprend, le plan suivant en plein écran.",
  needs: "un plan large de son lieu qui fuit vers le centre (un couloir, la salle vue de l'entrée, une allée), si possible avec une porte ou une fenêtre au fond, puis des plans de ce qui s'y fait.",
  lays: "sur 4 à 12 de ses plans coupés d'un temps chacun, le premier son plan le plus large (il reste figé derrière le cadre)",
  shots: [1, 16],
  seconds: [2, 8],
  require: { files: 3, shot: { framing: ["wide"] } },
  texts: [
    { slot: "gauche", want: "la petite étiquette de gauche, en capitales, fixe au milieu de l'écran : ce qui se passe, 1 à 3 mots (une forme comme « travaux en cours », « nouvelle carte », « bientôt »)", max: 16, required: false },
    { slot: "droite", want: "la petite étiquette de droite, au même ton : son nom, ou le nom du lieu", max: 16, required: false },
  ],
  objects: [
    {
      slot: "porte",
      shot: 0,
      want: "ce qui, au fond de son plan large et vers le milieu de l'image, peut accueillir le premier petit cadre : une porte au fond, une fenêtre, un miroir, une vitrine, une arche (« back door », « window », « mirror », « shop window », « archway ») ; « none » quand rien au milieu ne s'y prête (le cadre s'ouvre alors au centre exact)",
    },
  ],
  code: CODE,
};
