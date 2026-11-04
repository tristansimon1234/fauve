import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Lieu tapé lettre à lettre », written on its original (house/originals/frappe.mp4, 13,4 s, a sunny travel edit
// looked at image by image, its tempo measured at 146, half of it here): a wide, sunny opening shot held long; a cut on
// a calm shot of sky where the name of the place types itself letter by letter in orange capitals, unevenly like a hand,
// no caret, from 0,6 s after the cut, held a moment once typed; then the cut on the place itself (its front, its sign):
// the name is read just before the place is seen. Then it goes fast: the place for a moment, three very brief shots, two
// wide ones held, cinema bars closing in over the second, six very brief shots inside the bars, and black. Its ending
// card (an offer, an announcement) types itself in the same orange on the black.

const BPM = 73;
/** Its sections in beats: the opening, the shot where the name types, the place revealed, a wide shot, the one the bars close over. */
const OPENING = 6;
const TYPED_SHOT = 3.5;
const REVEAL = 0.75;
const WIDE = 1.5;
const BOXED_SHOT = 1.75;
/** The very brief shots (a quarter of a beat each). */
const QUICK = 0.25;
/** The typing: it starts this long after the cut, lasts this long, and the name is held until the cut on the place. */
const TYPE_START = 0.75;
const TYPE_LENGTH = 2;
/** The bars close this long into their shot, in a beat. */
const BARS_START = 0.75;
const BARS_LENGTH = 1;
/** The black at the end (beats); with an ending card, at least the engine's 1,6 s. */
const BLACK = 1;
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const n = shots.length;
  const BEAT = mark("beat", 24.66);
  const REVEAL_AT = mark("reveal", n > 2 ? shots[2].from : Math.round(9.5 * BEAT));
  const TYPE_AT = mark("type", (n > 1 ? shots[1].from : 0) + Math.round(0.75 * BEAT));
  const TYPED_AT = mark("typed", REVEAL_AT - Math.round(0.75 * BEAT));
  const BARS_AT = mark("bars", durationInFrames + 1);
  const BARRED_AT = mark("barred", BARS_AT + Math.round(BEAT));
  const BLACK_AT = mark("black", durationInFrames - Math.round(BEAT));
  const endAt = end ? end.from : durationInFrames + 1;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const display = "'" + brand.displayFont + "', 'Anton', 'Arial Narrow', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  // The model's orange, as typed on its sky.
  const ORANGE = "#ff5a1f";
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const inOut = Easing.bezier(0.65, 0, 0.35, 1);
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));

  // A text typed by a hand: each letter shows at once on its own frame, the first at "from", the last at "to", the gaps
  // uneven, longer after a punctuation mark, a space quicker; the whole text is laid out from the start (the letters to
  // come are there unseen), so nothing moves as it types.
  const typed = (text, from, to, seed) => {
    const chars = letters(String(text || ""));
    const gaps = chars.map((c, i) => (i === 0 ? 0 : (/\s/.test(c) ? 0.45 : 0.55 + 0.9 * random(seed + "-" + i)) * (/[.,;:!?'’-]/.test(chars[i - 1]) ? 1.7 : 1)));
    const total = gaps.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return chars.map((c, i) => {
      acc += gaps[i];
      const at = Math.round(from + ((to - from) * acc) / total);
      return h("span", { key: i, style: { opacity: frame >= at ? 1 : 0 } }, c);
    });
  };
  const nameStyle = { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 128, lineHeight: 1.08, letterSpacing: "0.01em", textTransform: "uppercase", color: ORANGE, whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,0.22)" };

  // 1. Her shots full frame, cut on the beat, each playing; black at the end.
  const film = frame < BLACK_AT ? h(Footage, { shot: cur, style: { left: 0, top: 0, width, height } }) : null;

  // 2. The name of her place, typed letter by letter in orange in the sky of its shot, then cut on the place itself.
  const name = hook && frame >= hook.from && frame < Math.min(hook.to, REVEAL_AT, BLACK_AT)
    ? h(FitText, { style: { position: "absolute", left: 140, top: 500, width: width - 280, height: 180 }, innerStyle: nameStyle },
        h("span", null, typed(hook.text, Math.max(hook.from, TYPE_AT), Math.max(Math.max(hook.from, TYPE_AT) + 4, Math.min(TYPED_AT, REVEAL_AT - 6)), "frappe")))
    : null;

  // 3. Cinema bars: they close in over one wide shot, and the last brief shots play inside them.
  const BAR = Math.round(height * 0.125);
  const bar = frame >= BARS_AT && frame < BLACK_AT ? Math.round(BAR * inOut(interpolate(frame, [BARS_AT, Math.max(BARS_AT + 1, BARRED_AT)], [0, 1], clamp))) : 0;
  const bars = bar > 0
    ? h(React.Fragment, null,
        h("div", { style: { position: "absolute", left: 0, top: 0, width, height: bar, background: "#000000" } }),
        h("div", { style: { position: "absolute", left: 0, top: height - bar, width, height: bar, background: "#000000" } }))
    : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < Math.min(endAt, BLACK_AT)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1220 - i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.35)" } }, t.text));

  // 4. Its ending card on the black: its title typed in the name's orange, a white line under it once typed.
  const titleIn = endAt + 2;
  const titleDone = endAt + 16;
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 640 : 720, width: width - 280, height: 240 }, innerStyle: { ...nameStyle, fontSize: 112, whiteSpace: "normal", textWrap: "balance", lineHeight: 1.04, textShadow: "none", justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", null, typed(keep(end.title), titleIn, titleDone, "frappe-end"))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 904, width: width - 280, height: 170 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.22, color: "#ffffff", textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [titleDone, titleDone + 5], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, name, bars, extra, ending);
}`;

export const frappe: MontageSkill = {
  key: "frappe",
  version: 1,
  bpm: BPM,
  shots: [8, 16],
  files: [5, 12],
  how: "Un plan large et ensoleillé tenu longtemps ; coupe sur un plan calme avec du ciel où le nom de son lieu se tape lettre à lettre en capitales orange, comme une main, puis coupe sur le lieu lui-même (sa devanture) ; ensuite ça va vite : trois plans très brefs, deux plans larges tenus, des bandes noires de cinéma qui se ferment sur le second, six plans très brefs entre les bandes, et le noir.",
  end: true,
  texts: [
    {
      slot: "lieu",
      role: "hook",
      want: "le nom de son lieu, tel qu'on le lit sur sa devanture (son enseigne, son nom), ou son quartier : 1 à 3 mots, tapés lettre à lettre en capitales juste avant qu'on le voie",
      max: 22,
      required: true,
    },
  ],
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(8, Math.min(16, n));
    // The very brief shots: a third after the place, the others inside the bars at the end (the model: 3 and 6).
    const quick = count - 5;
    const first = Math.max(1, Math.min(4, Math.round(quick / 3)));
    const last = quick - first;
    // The black at the end: a beat, or the ending card's time (on the beat grid) when the Reel ends on one.
    const black = end ? Math.max(BLACK, Math.ceil(((END_CARD + 0.05) / beat) * 4) / 4) : BLACK;
    const beats = [
      OPENING,
      TYPED_SHOT,
      REVEAL,
      ...Array.from({ length: first }, () => QUICK),
      WIDE,
      BOXED_SHOT,
      ...Array.from({ length: last }, (_, i) => QUICK + (i === last - 1 ? black : 0)),
    ];
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const typedAt = spans[1]!.start;
    const revealAt = spans[2]!.start;
    const boxedShot = spans[3 + first + 1]!;
    const blackAt = round(duration - black * beat);
    const wants = [
      "le plan qui ouvre, tenu longtemps : large, ensoleillé et qui bouge (sa rue, son quartier, une place, la vue de son lieu)",
      "un plan calme avec du ciel ou un mur dégagé en haut de l'image (une rue vue de loin, des toits, le haut d'une façade) : le nom de son lieu s'y tape lettre à lettre",
      "sa devanture, son enseigne ou l'entrée de son lieu : le lieu dont le nom vient de se taper, vu au moment où on le lit",
      ...Array.from({ length: first }, () => "un plan très bref de l'intérieur ou d'un détail (un geste, un produit, une table), sur le temps"),
      "un plan large et vivant de son quartier ou de son lieu",
      "un plan large tenu : des bandes noires de cinéma se ferment dessus",
      ...Array.from({ length: last }, (_, i) => (i < last - 1 ? "un plan très bref et ensoleillé de sa rue, de son lieu ou d'un détail, entre les bandes noires" : "le dernier plan très bref, juste avant le noir de la fin")),
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The name types from a moment after the cut on its sky, and goes with the cut on the place.
      texts: { lieu: { from: round(typedAt + TYPE_START * beat), to: revealAt } },
      marks: {
        beat: beat * 30,
        type: toFrame(typedAt + TYPE_START * beat),
        typed: toFrame(typedAt + (TYPE_START + TYPE_LENGTH) * beat),
        reveal: toFrame(revealAt),
        bars: toFrame(boxedShot.start + BARS_START * beat),
        barred: toFrame(boxedShot.start + (BARS_START + BARS_LENGTH) * beat),
        black: toFrame(blackAt),
      },
    };
  },
  code: CODE,
};
