import { beatSpans, type MontageSkill } from "../skills.ts";

// « Cadre dans le cadre », written on its original (house/originals/cadre.mp4, 6,4 s at 120 BPM, looked at image by
// image): a wide shot of the place in black and white, still, fills the frame; a window opens at its centre from the
// first image, upright (2:3) and without a border, on her pictures in colour, one every two thirds of a beat; at each
// cut the window is a little larger, from 15 % of the width to 95 %, always centred; then the last picture fills the
// frame. Two small labels in capitals sit on either side of the window at mid-height the whole Reel, over the window as
// it grows. Here the wide shot behind the window is the one that fills the frame at the end, in colour and playing: the
// place comes to life. Its ending card (an offer, an announcement) sits over that last shot, darkened.

const BPM = 120;
/** The window phase lasts about this many beats, whatever her number of pictures (on thirds of a beat: 5 images). */
const WINDOW_BEATS = 11;
/** The last shot, full frame and in colour: this many beats, and this many more with an ending card (its last 1,6 s). */
const FINAL_BEATS = 3;
const END_BEATS = 3.5;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const n = shots.length;
  const last = Math.max(0, n - 1);
  // Her pictures in the window: every shot but the last, which is the wide shot behind them, then the end.
  const m = Math.max(1, n - 1);
  const FINAL_AT = n > 1 ? shots[last].from : 0;
  const cur = Math.min(m - 1, shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0));
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const left = reelTexts.find((t) => t.role === "hook");
  const right = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== left && t !== right);
  const endAt = end ? end.from : durationInFrames + 1;
  const shade = "0 1px 2px rgba(0,0,0,0.42), 0 2px 12px rgba(0,0,0,0.3)";
  const label = { fontFamily: body, fontWeight: 500, fontSize: 52, lineHeight: 1.1, letterSpacing: "0.01em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade };

  // 1. The window: centred, upright (2:3), a little larger at each cut, from 15 % of the width to 95 %; her picture in it
  // in colour, at its own moment. Behind it, the wide shot in black and white, still (its first image, held).
  const W0 = width * 0.15;
  const W1 = width * 0.95;
  const box = (i) => {
    const t = m <= 1 ? 1 : Math.min(1, i / (m - 1));
    const w = Math.round(W0 + (W1 - W0) * t);
    const hh = Math.min(height, Math.round(w * 1.5));
    return { x: Math.round((width - w) / 2), y: Math.round((height - hh) / 2), w, h: hh };
  };
  const b = box(cur);
  const picture = n < 2 || frame >= FINAL_AT
    // 2. The end: that wide shot itself, now in colour and playing, full frame.
    ? h(Footage, { shot: last, style: { left: 0, top: 0, width, height } })
    : h(AbsoluteFill, null,
        h(Footage, { shot: last, at: durationInFrames * 4 + 1000, style: { left: 0, top: 0, width, height, filter: "grayscale(1) contrast(1.12) brightness(0.82)" } }),
        h("div", { style: { position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: "hidden" } },
          h(Footage, { shot: cur, style: { left: 0, top: 0, width: b.w, height: b.h } })));

  // 3. Its two labels, on either side of the window at mid-height, over it as it grows; clear of the apps' buttons
  // (above the middle), with room for a font whose letters reach far above and below their line.
  const tag = (t, x) => t && frame >= t.from && frame < Math.min(t.to, endAt)
    ? h(FitText, { key: x, style: { position: "absolute", left: x, top: 866, width: 480, height: 80 }, innerStyle: label }, t.text)
    : null;
  const labels = [tag(left, 40), tag(right, width - 520)];

  // Any other text of the Reel (none in its slots): a plain line under the window's middle, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 1230, width: width - 280, height: 150 }, innerStyle: { ...label, fontSize: 52, whiteSpace: "normal", textWrap: "balance" } }, t.text));

  // 4. Its ending card: the last shot darkened, its title in the middle, its line under it in the labels' capitals.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, { style: { backgroundColor: "rgba(0,0,0," + (0.5 * Math.min(1, (frame - endAt + 1) / 6)).toFixed(3) + ")" } },
        h(FitText, { style: { position: "absolute", left: 140, top: 690, width: width - 280, height: 330 }, innerStyle: { fontFamily: display, fontWeight: 600, fontSize: 96, lineHeight: 1.02, letterSpacing: "-0.03em", color: "#ffffff", whiteSpace: "normal", textWrap: "balance", textShadow: shade } }, String(end.title || "")),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1046, width: width - 280, height: 190 }, innerStyle: { ...label, whiteSpace: "normal", textWrap: "balance", justifyContent: "flex-start", opacity: frame >= endAt + 6 ? 1 : 0 } }, end.subtitle)
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, picture, labels, extra, ending);
}`;

const round = (s: number) => Math.round(s * 100) / 100;

export const cadre: MontageSkill = {
  key: "cadre",
  version: 1,
  bpm: BPM,
  shots: [8, 18],
  files: [3, 8],
  how: "Un plan large de son lieu en noir et blanc, figé, remplit l'écran ; au centre, un cadre droit sans bord s'ouvre dès la première image sur ses plans en couleur, qui changent sur le temps ; à chaque coupe le cadre grandit un peu, jusqu'à presque tout l'écran ; puis le plan large lui-même passe en couleur et en plein écran pour finir. Deux petites étiquettes en capitales restent de part et d'autre du cadre, à mi-hauteur, tout le Reel.",
  end: true,
  texts: [
    { slot: "gauche", role: "hook", want: "l'étiquette de gauche : ce qui se passe, 1 à 3 mots en capitales (une forme comme « travaux en cours », « nouvelle carte », « en cuisine »)", max: 14, required: true },
    { slot: "droite", role: "caption", want: "l'étiquette de droite : son nom, ou le nom du lieu", max: 14, required: true },
  ],
  timeline(n, { end }) {
    // Her pictures in the window, each the same length on thirds of a beat (two thirds when she has many, as the
    // original, up to two beats when she has few), then the wide shot, full frame.
    const m = Math.max(1, n - 1);
    const each = Math.min(2, Math.max(2 / 3, Math.round((WINDOW_BEATS / m) * 3) / 3));
    const final = FINAL_BEATS + (end ? END_BEATS : 0);
    const spans = beatSpans(BPM, [...Array.from({ length: m }, () => each), final]);
    const duration = spans.at(-1)!.end;
    const wants = [
      ...Array.from({ length: m }, (_, i) =>
        i === 0
          ? "le premier plan vu dans le petit cadre au centre, dès la première image : un détail fort, en couleur (le centre de l'image compte)"
          : i === m - 1
            ? "un beau plan, vu dans le cadre presque plein écran"
            : "un plan en couleur vu dans le cadre au centre, qui grandit à chaque coupe : un détail, un geste, un coin du lieu (le centre de l'image compte)",
      ),
      "un plan large de son lieu (une salle, un couloir, la devanture) : en noir et blanc et figé derrière le cadre pendant tout le Reel, puis en couleur et en plein écran pour finir",
    ];
    // Both labels the whole Reel (up to its ending card).
    const to = end ? round(duration - 1.6) : duration;
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: { gauche: { from: 0, to }, droite: { from: 0, to } },
      marks: {},
    };
  },
  code: CODE,
};
