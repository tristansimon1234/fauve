import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Ville en coups de fouet », written on its original (house/originals/coups-de-fouet.mp4, 23,3 s, a city edit in a
// film grade looked at image by image, its tempo measured at 112): a brief opening shot that moves, a white flash, and
// on the next shot the name of the place in very condensed white capitals in the middle of the sky, there at once,
// gone with the whip pan out of its shot; then her shots on the beat, about a second each, linked by whip pans (a motion
// blur that throws one shot into the next, once to the left, once to the right), white flashes and hard cuts, in turn;
// the last whip lands on a wide calm shot (a sky, a sunset) held long to the end. Its ending card (an offer, an
// announcement) is the title's capitals over that last shot.

const BPM = 112;
/** Its sections in beats: the opening shot, the title's shot, the last shot held. */
const OPENING = 1.25;
const TITLE_SHOT = 3;
const LAST = 6.5;
/** Her shots between them, over and over (about two beats each, some shorter). */
const PATTERN = [2, 1.5, 2, 1, 1.5, 2];
/** The engine's ending card: the Reel's last 1,6 s, over its last shot. */
const END_CARD = 1.6;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const n = shots.length;
  const BEAT = mark("beat", 16.07);
  // Its whips last about a quarter of a second; the last one, into the shot held to the end, a little longer.
  const WHIP = Math.max(6, Math.min(9, Math.round(BEAT / 2)));
  const LONG_WHIP = Math.max(WHIP + 2, Math.min(14, Math.round(BEAT * 0.75)));
  const endAt = end ? end.from : durationInFrames + 1;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const display = "'" + brand.displayFont + "', 'Big Shoulders Display', 'Oswald', 'Arial Narrow', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter', sans-serif";
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const full = { left: 0, top: 0, width, height };
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  // White on her sky, as the model: a tight shade only, so it still reads on a pale sky.
  const shade = "0 0 2px rgba(0,0,0,0.55), 0 1px 5px rgba(0,0,0,0.4), 0 2px 18px rgba(0,0,0,0.32)";
  const titleStyle = { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 230, lineHeight: 1, letterSpacing: "-0.005em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade };

  // How each cut goes, as in the model: into the title's shot a white flash, out of it a whip; then hard cuts, a whip,
  // a flash, in turn; the last one, into the shot held to the end, a longer whip.
  const kind = (k) => (k === 1 ? "flash" : k === 2 || k === n - 1 ? "whip" : ["cut", "cut", "whip", "flash"][(k - 3) % 4]);
  const cutAt = (k) => shots[k].from;
  let whips = 0;
  const way = {};
  for (let k = 1; k < n; k++) if (kind(k) === "whip") way[k] = whips++ % 2 ? "right" : "left";

  // The name of the place on the title's shot: very condensed white capitals in the middle of the sky, just above the
  // middle (clear of the apps' buttons), there at once (the flash lights it), moving with its shot as the whip throws it
  // out. Its size follows its length, so a long name in a wide face still fits its line without shrinking too far.
  const titleSize = hook ? Math.min(230, Math.max(110, Math.round(2600 / Math.max(6, Array.from(hook.text).length)))) : 230;
  const title = (i) => hook && i === 1 && hook.to > (n > 1 ? shots[1].from : 0)
    ? h(FitText, { key: "title", style: { position: "absolute", left: 140, top: 680, width: width - 280, height: 280 }, innerStyle: { ...titleStyle, fontSize: titleSize } }, hook.text)
    : null;
  const shot = (i) => h(AbsoluteFill, { key: "s" + i }, h(Footage, { shot: i, style: full }), frame < endAt ? title(i) : null);

  // 1. Her shots full frame, each playing; a whip around its cut throws one into the next.
  let film = n ? shot(cur) : null;
  for (let k = 1; k < n; k++) {
    if (kind(k) !== "whip") continue;
    const frames = k === n - 1 ? LONG_WHIP : WHIP;
    const at = cutAt(k) - Math.floor(frames / 2);
    if (frame >= at && frame < at + frames) film = h(Whip, { key: "w" + k, from: shot(k - 1), to: shot(k), at, frames, direction: way[k], blur: 90 });
  }

  // 2. A white flash on its cuts: the outgoing shot burns out, the incoming one comes out of the white.
  let white = 0;
  for (let k = 1; k < n; k++) {
    if (kind(k) !== "flash") continue;
    const d = frame - cutAt(k);
    const v = d === -1 ? 0.55 : d === 0 ? 0.94 : d === 1 ? 0.45 : d === 2 ? 0.12 : 0;
    white = Math.max(white, v);
  }
  const flash = white > 0 ? h("div", { style: { position: "absolute", left: 0, top: 0, width, height, background: "#ffffff", opacity: white } }) : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1220 - i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.35)" } }, t.text));

  // 3. Its ending card over the last shot, held: its title in the title's capitals, a line under it.
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h("div", { style: { position: "absolute", left: 0, top: 0, width, height, background: "#000000", opacity: 0.32 * o(endAt, endAt + 8) } }),
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 700 : 780, width: width - 280, height: 300 }, innerStyle: { ...titleStyle, fontSize: 170, whiteSpace: "normal", textWrap: "balance", lineHeight: 0.98, justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", { style: { display: "inline-block", opacity: o(endAt, endAt + 6) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1024, width: width - 280, height: 160 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.22, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: shade } },
              h("span", { style: { display: "inline-block", opacity: o(endAt + 6, endAt + 14) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, flash, extra, ending);
}`;

export const coupsDeFouet: MontageSkill = {
  key: "coups-de-fouet",
  version: 1,
  bpm: BPM,
  // Its title holds three beats: past 118, a title of four short words would not be read in time.
  tempo: [78, 118],
  shots: [8, 20],
  files: [6, 16],
  how: "Un plan bref qui bouge, un flash blanc, et sur le plan suivant le nom du lieu en capitales blanches très condensées au milieu du ciel ; puis ses plans sur le temps, une seconde environ chacun, enchaînés par des coups de fouet (un flou de mouvement qui jette un plan dans le suivant, à gauche puis à droite), des flashs blancs et des coupes franches ; le dernier coup de fouet arrive sur un plan large et calme (un ciel, un coucher de soleil) tenu jusqu'à la fin.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "le nom du lieu posé dans le ciel du deuxième plan, en capitales sur une ligne : son quartier, sa ville ou le nom de son lieu, 1 à 3 mots",
      max: 18,
      required: true,
    },
  ],
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(8, Math.min(20, n));
    const middle = Array.from({ length: count - 3 }, (_, i) => PATTERN[i % PATTERN.length]!);
    // The last shot holds to the end; with an ending card over it, a beat more, and always the card's time.
    const last = end ? Math.max(LAST + 1, END_CARD / beat + 2) : LAST;
    const spans = beatSpans(bpm, [OPENING, TITLE_SHOT, ...middle, last]);
    const duration = spans.at(-1)!.end;
    const wants = [
      "le plan qui ouvre, bref et qui bouge déjà (un passage, un métro, une rue filmée en marchant, quelque chose qui défile)",
      "un plan large de son quartier ou de sa ville avec du ciel au milieu : le nom du lieu s'y pose en grand",
      ...middle.map((b) => (b >= 2 ? "un plan de sa rue, de son quartier ou de son lieu, avec du mouvement (des passants, un geste, une caméra qui marche)" : "un plan court et vif de sa ville ou de son lieu (un détail, un passage, un geste)")),
      "le plan qui finit le Reel, tenu longtemps : large et calme (un ciel, un coucher de soleil, une vue)",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The title is on its shot, from the flash to the whip that throws it out.
      texts: { titre: { from: spans[1]!.start, to: spans[1]!.end } },
      marks: { beat: beat * 30, title: toFrame(spans[1]!.start), last: toFrame(spans.at(-1)!.start) },
    };
  },
  code: CODE,
};
