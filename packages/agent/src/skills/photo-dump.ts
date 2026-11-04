import { beatSpans, type MontageSkill } from "../skills.ts";

// « Photo dump », written on its original (house/originals/photo-dump.mp4, 11,3 s, 32 pictures, looked at image by
// image): on a very light grey page, one photo or video at a time, laid at once in the middle, at its own shape and
// the same width (80 % of the frame: a portrait 3:4, a tall 9:16, a landscape, a wide 16:9), now and then a smaller one;
// no border, no shadow, no text, a new one on every half-beat (a picture every 0,35 s), the last one a little longer.
// Its ending card (an offer, an announcement) is a plain line of text on the same grey, after the last picture.

const BPM = 85;
/** Each picture stays half a beat; the last one a beat. */
const EACH = 1 / 2;
const LAST = 1;
/** The ending card's beats (at least the engine's 1,6 s). */
const CARD = 2.5;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Inter', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const INK = "#161616";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

  // 1. The picture of the moment, alone in the middle: 80 % of the frame's width at its own shape (between a tall
  // 9:16 and a wide panorama), a smaller one now and then, as the model; it plays while it is on.
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const s = shots[cur];
  const a = s ? Math.max(0.5625, Math.min(2.4, Number(s.aspect) || 0.75)) : 0.75;
  const small = cur > 0 && cur < n - 1 && cur % 11 === 6;
  const w = Math.round(width * 0.8 * (small ? 0.73 : 1));
  const hh = Math.round(w / a);
  const picture = s && frame < endAt
    ? h("div", { key: "pic" + cur, style: { position: "absolute", left: Math.round((width - w) / 2), top: Math.round((height - hh) / 2), width: w, height: hh, overflow: "hidden" } },
        h(Footage, { shot: cur, style: { left: 0, top: 0, width: w, height: hh } }))
    : null;

  // Any text of the Reel (none in its slots): a plain line on a white pill above the pictures, so nothing she wrote is lost.
  const extra = reelTexts.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 84 + i * 104, height: 96 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: INK, textAlign: "center" } },
      h("span", { style: { background: "#ffffff", padding: "6px 20px", borderRadius: 40 } }, t.text)));

  // 2. Its ending card, on the same grey after the last picture: its words in plain ink, the title above a small line.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, null,
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 620 : 760, width: width - 280, height: 360 }, innerStyle: { justifyContent: end.subtitle ? "flex-end" : "center", fontFamily: display, fontWeight: 600, fontSize: 108, lineHeight: 1.06, letterSpacing: "-0.02em", color: INK, textAlign: "center", textWrap: "balance" } },
          h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt, endAt + 3], [0, 1], clamp) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1008, width: width - 280, height: 190 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 400, fontSize: 52, lineHeight: 1.22, color: "#3a3a3a", textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 2, endAt + 5], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#eeeeee" } }, picture, extra, ending);
}`;

export const photoDump: MontageSkill = {
  key: "photo-dump",
  version: 1,
  bpm: BPM,
  shots: [12, 32],
  files: [8, 20],
  how: "Ses photos et petits passages de vidéo, un à la fois, posés d'un coup au milieu d'une page gris très clair, chacun à sa forme sur la même largeur (de temps en temps un plus petit), sans bord, sans ombre ni texte, un nouveau tous les demi-temps, comme un carnet qu'on feuillette ; le dernier un peu plus long.",
  end: true,
  texts: [],
  timeline(n, { end }) {
    const spans = beatSpans(BPM, Array.from({ length: n }, (_, i) => (i < n - 1 ? EACH : LAST + (end ? CARD : 0))));
    const duration = spans.at(-1)!.end;
    const wants = spans.map((_, i) =>
      i === 0
        ? "la photo qui ouvre le carnet : la plus belle, qu'on comprend d'un coup d'œil"
        : i < spans.length - 1
          ? "une photo ou un court passage de vidéo de sa semaine, chacun différent du précédent (un détail, un lieu, une personne, un geste)"
          : "la dernière image, un peu plus longue : une photo calme ou un passage qui finit bien",
    );
    return { duration, shots: spans.map((s, i) => ({ ...s, want: wants[i]! })), texts: {}, marks: {} };
  },
  code: CODE,
};
