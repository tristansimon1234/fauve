import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Éventail de bandes », written on its original (house/originals/eventail.mp4, 20 s at 120 BPM, a landscape Reel,
// looked at image by image and measured on its pixels): on a deep bordeaux ground, a small square with a white edge at
// the middle shows the heart of the first shot; then, one on each beat, six bands of the same shot in black and white
// arrive from the corners and the sides and converge on it like the spokes of a star (windows onto that one shot, its
// lines running to the middle), and on the next beat the whole shot is there, in a thin bordeaux frame. Her shots
// follow in black and white, cut every two beats in the frame. It ends on a blue black inside the frame: a small white
// line at the middle, like a credit, and two beats later a smaller dark red one under it. Here the star is turned for
// a vertical Reel (its bands to the four corners and the two sides, as the original's run to its corners and its short
// sides). Its ending card (an offer, an announcement): its title and its line take the credit's place on the black.

const BPM = 120;
/** The star: the square on the first image, a band on each of the next six beats, the whole shot on the seventh. */
const OPENING = 7;
/** The whole first shot, then each of her shots in the frame (beats). */
const EACH = 2;
/**
 * The credit on the black (beats), its red line two beats after it; before an ending card a beat shorter, its red line
 * one beat after it, so both still read before the card.
 */
const CREDIT = 5;
const LINE_AFTER = 2;
/** The engine's ending card: the Reel's last 1,6 s. */
const CARD_SECONDS = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  // Its sections (frames): a band on each beat, the whole shot, the black with its credit, its red line.
  const BEAT = Math.max(4, mark("beat", 15));
  const REVEAL = mark("reveal", Math.round(7 * BEAT));
  const BLACK = mark("black", Math.max(REVEAL + Math.round(2 * BEAT), durationInFrames - Math.round(4 * BEAT)));
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', sans-serif";
  // The model's own colours: a deep bordeaux ground and frame, her shots in black and white, a blue black at the end,
  // a white credit and a dark red line.
  const GROUND = "#3c0c0f";
  const NIGHT = "#03090d";
  const RED = "#a62c2c";
  const INK = "#f3f0ea";
  const BW = "grayscale(1) contrast(1.18) brightness(0.96)";
  // Measured on the model, turned upright: its frame, the square, the bands' width and where they stop (px).
  const FRAME = 37;
  const SQ = 50;
  const R0 = 136;
  const BAND = 172;
  const LONG = 1500;
  const cx = width / 2;
  const cy = height / 2;
  const full = { position: "absolute", left: 0, top: 0, width, height };
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0").replace(/ (\d+(?:er|e))\b/g, "\u00a0$1");
  const credit = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== credit && t !== line);
  const shown = (t) => Boolean(t) && frame >= t.from && frame < t.to && frame < endAt;

  // 1. The star: her first shot through the square at the middle, then one band a beat, in the model's order (a corner,
  // the opposite one, the two others, then the sides), each landing at once; all of them windows onto that one shot,
  // full frame in black and white, so its lines run to the middle.
  const corner = (Math.atan2(height / 2, width / 2) * 180) / Math.PI;
  const ANGLES = [corner, 180 + corner, 180 - corner, -corner, 0, 180];
  const band = (deg) => {
    const a = (deg * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const at = (r, s) => (cx + ux * r - uy * s).toFixed(1) + " " + (cy + uy * r + ux * s).toFixed(1);
    return "M" + at(R0, -BAND / 2) + " L" + at(R0 + LONG, -BAND / 2) + " L" + at(R0 + LONG, BAND / 2) + " L" + at(R0, BAND / 2) + " Z";
  };
  const square = "M" + (cx - SQ) + " " + (cy - SQ) + " h" + 2 * SQ + " v" + 2 * SQ + " h" + -2 * SQ + " Z";
  const landed = ANGLES.filter((_, k) => frame >= Math.round((k + 1) * BEAT));
  const star = frame < REVEAL && n
    ? h("div", { key: "star", style: { ...full, clipPath: "path('" + [square].concat(landed.map(band)).join(" ") + "')" } },
        h(Footage, { shot: 0, style: { left: 0, top: 0, width, height, filter: BW } }))
    : null;
  const edge = frame < REVEAL
    ? h("div", { key: "edge", style: { position: "absolute", left: cx - SQ - 3, top: cy - SQ - 3, width: 2 * SQ + 6, height: 2 * SQ + 6, boxSizing: "border-box", border: "3px solid #efefef", boxShadow: "0 0 0 1px rgba(0,0,0,0.35)" } })
    : null;

  // 2. The whole shot on the next beat, then her shots one after the other, cut every two beats, in black and white,
  // in a thin bordeaux frame.
  const film = frame >= REVEAL && frame < BLACK && n ? h(Footage, { key: "film", shot: cur, style: { left: 0, top: 0, width, height, filter: BW } }) : null;
  const passe = frame >= REVEAL ? h("div", { key: "frame", style: { ...full, boxSizing: "border-box", border: FRAME + "px solid " + GROUND } }) : null;

  // 3. Its end on a blue black inside the frame: the credit, white, at the middle; its red line two beats later, under it.
  const night = frame >= BLACK ? h("div", { key: "night", style: { position: "absolute", left: FRAME, top: FRAME, width: width - 2 * FRAME, height: height - 2 * FRAME, backgroundColor: NIGHT } }) : null;
  const say = (key, text, top, tall, size, color, weight, accent) =>
    h(FitText, { key, style: { position: "absolute", left: 140, top, width: 800, height: tall }, innerStyle: { fontFamily: display, fontWeight: weight, fontSize: size, lineHeight: 1.1, letterSpacing: "-0.01em", color, textAlign: "center", textWrap: "balance" } },
      accent ? h("span", { "data-fauve-accent": "" }, keep(text)) : keep(text));
  // The red line is small beside the credit, as the model's (4 words at most; a longer one at the size that reads).
  const few = (t) => String(t || "").split(/[\s\u00a0\u202f]+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length <= 4;
  const words = [
    shown(credit) ? say("credit", credit.text, 876, 116, 62, INK, 500, false) : null,
    shown(line) ? (few(line.text) ? say("line", line.text, 992, 72, 42, RED, 400, true) : say("line", line.text, 992, 124, 48, RED, 400, false)) : null,
  ];
  // Any other text of the Reel (none in its slots): a plain line on the black above the credit, so nothing she wrote is lost.
  const extra = others.filter((t) => shown(t)).map((t, i) => say("x" + i, t.text, 740 - i * 110, 100, 52, INK, 500, false));

  // Its ending card: on the black, its title in the credit's white and its line in the red, at the credit's place.
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        frame < BLACK ? h("div", { style: { position: "absolute", left: FRAME, top: FRAME, width: width - 2 * FRAME, height: height - 2 * FRAME, backgroundColor: NIGHT } }) : null,
        say("end-title", end.title, 790, 200, 64, INK, 500, false),
        end.subtitle ? say("end-line", end.subtitle, 998, 130, 48, RED, 400, false) : null)
    : null;

  return h(Paper, { color: GROUND, grain: 0.42, shade: 0.7 }, star, edge, film, passe, night, words, extra, ending);
}`;

export const eventail: MontageSkill = {
  key: "eventail",
  version: 1,
  bpm: BPM,
  shots: [5, 12],
  files: [5, 12],
  // Its code draws her shots in black and white on its bordeaux: its model's finish keeps only its contrast and grain.
  finish: { saturation: 0 },
  how: "Sur un fond bordeaux, un petit carré bordé de blanc au milieu montre le cœur de son premier plan ; une bande du même plan en noir et blanc arrive à chaque temps, des coins et des côtés, et toutes convergent vers le carré comme les branches d'une étoile ; au temps suivant le plan entier, dans un fin cadre bordeaux ; puis ses plans en noir et blanc coupés tous les deux temps dans le cadre ; la fin sur un noir bleuté, une petite ligne blanche au milieu comme une signature, et une ligne rouge plus petite dessous.",
  end: true,
  texts: [
    {
      slot: "signature",
      role: "hook",
      want: "la petite ligne blanche de la fin, sur le noir, comme une signature : son nom, ou ce qu'on vient de voir (une forme comme « Studio Ciel », « Un samedi à l'atelier »)",
      max: 28,
      required: true,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : une ligne plus petite en rouge sous la première, qui arrive deux temps après : son quartier, sa ville ou son compte (une forme comme « Lyon 2e », « @studio.ciel »)",
      max: 28,
      required: false,
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // The first shot: the star, then whole; her other shots two beats each; the last one holds under the black (and the
    // ending card after it: 1,6 s at least).
    const card = end ? CARD_SECONDS / beat : 0;
    const credit = end ? CREDIT - 1 : CREDIT;
    const count = Math.max(2, n);
    const spans = beatSpans(bpm, [OPENING + EACH, ...Array.from({ length: count - 2 }, () => EACH), EACH + credit + card]);
    const duration = spans.at(-1)!.end;
    const black = round(spans.at(-1)!.start + EACH * beat);
    const lineAt = round(black + (end ? LINE_AFTER - 1 : LINE_AFTER) * beat);
    const until = round(end ? duration - CARD_SECONDS : duration);
    const wants = spans.map((_, i) =>
      i === 0
        ? "le plan d'ouverture, large et graphique, au moins 4 s : son lieu vu d'en haut ou bien de face, avec des lignes qui partent du centre (une salle, un comptoir, une allée) ; on le voit d'abord par une étoile de bandes qui convergent vers le centre, puis en entier"
        : i < spans.length - 1
          ? "un plan de son lieu en noir et blanc, plein cadre, différent du précédent : des gens, un détail, la lumière, un geste"
          : "un dernier plan fort et calme : le Reel finit ensuite sur le noir avec sa petite ligne",
    );
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its words are only at the end, on the black: the credit, then its red line two beats later (one before a card).
      texts: { signature: { from: black, to: until }, ligne: { from: lineAt, to: until } },
      marks: { beat: beat * 30, reveal: toFrame(OPENING * beat), black: toFrame(black) },
    };
  },
  code: CODE,
};
