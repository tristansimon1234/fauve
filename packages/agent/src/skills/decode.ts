import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Titre qui se décode », written on its original (house/originals/decode.mp4, 22,7 s at 122 BPM, looked at image by
// image): her shots land in vertical bands across the frame one after the other, fold into a line and leave the black;
// small words spread over a line, the title scrambles and lands letter by letter; a band of video opens behind it at the
// middle, her shots cut on the beat inside it, faster and faster; the band grows to the full frame, the title goes, and
// her widest shots play full frame to the end, the last one held. Its ending card (an offer, an announcement) is the
// title's style on black.

const BPM = 122;
const BEAT = 60 / BPM;
/** The opening (bands, fold, black, the title landing) lasts this many beats; the band opens on the next one. */
const OPENING_BEATS = 10;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = mark("beat", 14.75);
  const BAND_AT = mark("band", 148);
  const FULL_AT = mark("full", Math.max(BAND_AT + 60, durationInFrames - 120));
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: ease });
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const display = "'" + brand.displayFont + "', 'Open Sans', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter', sans-serif";
  const hook = reelTexts.find((t) => t.role === "hook");
  const kicker = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== kicker);
  const endAt = end ? end.from : durationInFrames + 1;
  // White on her footage, as the model: a light shade only, so it reads on a bright sky.
  const shade = "0 0 2px rgba(0,0,0,0.45), 0 2px 16px rgba(0,0,0,0.35)";
  const TW = 880;
  const TX = (width - TW) / 2;
  const TY = Math.round(height / 2) - 72;
  const titleStyle = { fontFamily: display, fontWeight: 400, fontSize: 124, lineHeight: 1.1, letterSpacing: "0.02em", color: "#ffffff", whiteSpace: "nowrap", textAlign: "center", textShadow: shade };
  const smallStyle = { fontFamily: body, fontWeight: 500, fontSize: 24, letterSpacing: "0.32em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade };

  // 1. The opening: up to five of her shots in vertical bands, landing one after the other on the half-beat (the
  // first one already there at the first image), each playing; folded into a line at the middle, then gone.
  const full = Math.max(1, shots.findIndex((s) => s.from >= FULL_AT - 1));
  const order = [];
  [0, 1, full, 2, full + 1, 3, 4].forEach((i) => { if (i >= 0 && i < n && order.indexOf(i) < 0 && order.length < 5) order.push(i); });
  const cols = order.length;
  const FOLD = Math.round(3 * BEAT);
  const GONE = Math.round(4 * BEAT);
  const strip = height * (1 - o(FOLD, GONE));
  const opening = frame < GONE && cols
    ? order.map((shot, i) => {
        const at = Math.round((i * BEAT) / 2) - 4;
        const shown = interpolate(frame, [at, at + 5], [0, 1], { ...clamp, easing: ease });
        if (shown <= 0) return null;
        const left = Math.round((i * width) / cols);
        const w = Math.round(((i + 1) * width) / cols) - left;
        return h("div", { key: "b" + i, style: { position: "absolute", left, width: w, top: (height - strip) / 2, height: strip, overflow: "hidden", clipPath: "inset(0 0 " + ((1 - shown) * 100).toFixed(2) + "% 0)" } },
          h(Footage, { shot, at: shot === 0 ? undefined : Math.max(0, at), style: { left: 0, top: -(height - strip) / 2, width: w, height } }));
      })
    : null;

  // 2. The band: her shots seen through a band at the middle, behind the title, cut on the beat; then it grows to the
  // full frame and her last shots play full frame.
  const BAND_H = 560;
  const bandH = frame < BAND_AT ? 0 : interpolate(frame, [BAND_AT, BAND_AT + 10], [0, BAND_H], { ...clamp, easing: ease }) + (height - BAND_H) * o(FULL_AT, FULL_AT + 24);
  const band = bandH > 0
    ? h("div", { style: { position: "absolute", left: 0, width, top: (height - bandH) / 2, height: bandH, overflow: "hidden" } },
        h(Footage, { shot: cur, style: { left: 0, top: -(height - bandH) / 2, width, height } }))
    : null;

  // 3. Its words: the small ones spread over the title's own width (as the model: the first at its left edge, the last at
  // its right), the title scrambled then landing; both leave as the band grows. One box, shrunk as a whole for a long
  // title, its small words kept at their size.
  const out = 1 - o(FULL_AT + 6, FULL_AT + 18);
  const words = kicker ? kicker.text.split(/\s+/).filter(Boolean).slice(0, 5) : [];
  const title = hook ? hook.text.toUpperCase() : "";
  const shown = (t) => t && frame >= t.from && frame < t.to;
  const titleBlock = shown(hook) || shown(kicker)
    ? h(FitText, { style: { position: "absolute", left: TX, top: TY - 62, width: TW, height: 214 }, innerStyle: { opacity: out } }, (scale) =>
        h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "stretch" } },
          h("div", { style: { display: "flex", justifyContent: words.length > 1 ? "space-between" : "center", height: 50, alignItems: "flex-end", gap: 18 } },
            shown(kicker) ? words.map((w, i) => h("span", { key: i, "data-fauve-accent": "", style: { ...smallStyle, fontSize: Math.round(24 / Math.max(0.5, scale)), letterSpacing: "0.32em", marginRight: i === words.length - 1 ? "-0.32em" : 0, opacity: o(kicker.from + i * 3, kicker.from + i * 3 + 8) } }, w)) : null),
          h("div", { style: { ...titleStyle, minHeight: 140 } }, shown(hook) ? h(Decode, { text: title, at: hook.from, hold: 6, scramble: 28, resolve: 16 }) : null)))
    : null;
  // Any other text of the Reel (none in its slots): a plain line under the band, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 100, width: width - 200, top: 1260, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#ffffff", textAlign: "center", textShadow: shade } }, t.text));

  // 4. Its ending card: black over the last shot, its title in the title's style, a line under it.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, { style: { backgroundColor: "rgba(0,0,0," + o(endAt, endAt + 8).toFixed(3) + ")" } },
        h(FitText, { style: { position: "absolute", left: TX, top: TY, width: TW, height: 150 }, innerStyle: { ...titleStyle, opacity: o(endAt + 2, endAt + 8), transform: "translateY(" + (1 - o(endAt + 2, endAt + 12)) * 14 + "px)" } }, String(end.title || "").toUpperCase()),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: TX, top: TY + 168, width: TW, height: 70 }, innerStyle: { fontFamily: body, fontWeight: 400, fontSize: 48, color: "#ffffff", textAlign: "center", opacity: o(endAt + 6, endAt + 14) } }, end.subtitle)
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, opening, band, titleBlock, extra, ending);
}`;

export const decode: MontageSkill = {
  key: "decode",
  version: 1,
  bpm: BPM,
  shots: [7, 14],
  files: [3, 8],
  how: "Ses plans arrivent en bandes verticales l'une après l'autre, se replient en un trait ; sur le noir, de petits mots espacés et le titre brouillé qui se décode lettre à lettre ; une bande de vidéo s'ouvre derrière le titre, ses plans y défilent sur le temps de plus en plus vite ; la bande grandit jusqu'au plein écran et ses plus beaux plans larges finissent le Reel.",
  end: true,
  texts: [
    { slot: "surtitre", role: "caption", want: "1 à 3 petits mots posés au-dessus du titre, espacés sur sa ligne, qui l'amènent (une forme comme « un samedi dans », « bienvenue chez », « le matin à »)", max: 24, required: true },
    { slot: "titre", role: "hook", want: "le titre qui se décode : son nom, son lieu ou son quartier, court (il s'écrit en capitales sur une ligne)", max: 22, required: true },
  ],
  timeline(n, { end }) {
    // Full frame at the end: three shots for a long Reel, two otherwise; the band takes the others after the opening.
    const tail = n >= 10 ? 3 : 2;
    const inBand = Math.max(1, n - 1 - tail);
    // In the band: two shots of two beats, two of one, then half-beats, faster and faster (the model's rapid cuts).
    const band = Array.from({ length: inBand }, (_, i) => (i < 2 ? 2 : i < 4 ? 1 : 0.5));
    // Full frame: four beats each, the last one held (longer with an ending card over its end).
    const last = end ? 9 : 5;
    const fullBeats = [...Array.from({ length: tail - 1 }, () => 4), last];
    const spans = beatSpans(BPM, [OPENING_BEATS, ...band, ...fullBeats]);
    const duration = spans.at(-1)!.end;
    const bandAt = spans[1]!.start;
    const fullAt = spans[1 + inBand]!.start;
    const wants = [
      "le plan qui ouvre le Reel, le plus beau et le plus large : il joue dans la première bande",
      ...band.map((_, i) => (i < 2 ? "un plan varié de son lieu ou de son quartier, vu dans une bande au milieu de l'écran (le centre de l'image compte)" : "un plan court et vivant, vu dans la bande, sur le temps")),
      ...fullBeats.map((_, i) => (i < fullBeats.length - 1 ? "un de ses plus beaux plans larges, en plein écran" : "le plan qui finit le Reel, large et calme, tenu longtemps")),
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The words land after the fold (4,5 beats) and leave as the band grows.
      texts: {
        surtitre: { from: Math.round(4.5 * BEAT * 100) / 100, to: Math.min(duration, Math.round((fullAt + 0.6) * 100) / 100) },
        titre: { from: Math.round(4.5 * BEAT * 100) / 100, to: Math.min(duration, Math.round((fullAt + 0.6) * 100) / 100) },
      },
      marks: { beat: (60 / BPM) * 30, band: toFrame(bandAt), full: toFrame(fullAt) },
    };
  },
  code: CODE,
};
