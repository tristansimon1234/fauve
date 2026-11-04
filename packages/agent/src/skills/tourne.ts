import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Noir et blanc tourné », written on its original (house/originals/tourne.mp4, 12,8 s, a travel edit looked at image
// by image, its tempo measured at 158, half of it here): every shot filmed in width turned a quarter to fill the
// vertical frame, one way then the other, in black and white very contrasted. It opens on a flurry (two shots of a
// fifth of a second, flickering, then a whip upward); then calmer shots of about a second, hard cuts; a zoom that goes
// through one shot into the next, a white frame, and a burst of shots of a fifth of a second; two longer ones linked by
// a whip; a white frame, and the last shot held to the end. No words: its optional title is turned a quarter too, in
// very condensed white capitals along the middle of the frame. Its ending card (an offer, an announcement) is upright,
// on the black after the last shot.

const BPM = 79;
/** The flurry that opens (beats): two brief shots, a third whipped in. */
const FLURRY = [0.25, 0.25, 0.5];
/** The calm shots, in turn (about a second each). */
const CALM = [1.5, 1];
/** The shot the zoom goes through, the one it lands on. */
const ZOOM_FROM = 0.75;
const ZOOM_TO = 0.5;
/** The burst's shots, then the two longer ones a whip links. */
const RAPID = 0.25;
const RELEASE = [0.75, 0.5];
/** The last shot, held. */
const LAST = 3;
/** The engine's ending card (the Reel's last 1,6 s), on the black after the last shot. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;

/** How many calm shots and burst shots for n shots (the model: 6 calm, 9 in the burst). */
function sections(n: number): { calm: number; rapid: number } {
  const free = Math.max(4, n - 8);
  const calm = Math.max(2, Math.min(7, free - 2, Math.round(free * 0.45)));
  return { calm, rapid: free - calm };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const n = shots.length;
  const BEAT = mark("beat", 22.78);
  // Where its sections are (shot indexes): the flurry's end, the zoom, the burst, the whip, the last shot.
  const CALM = mark("calm", 3);
  const ZOOM = mark("zoom", Math.max(1, n - 5));
  const BURST = mark("burst", Math.max(1, n - 4));
  const RELEASE = mark("release", Math.max(1, n - 2));
  const FINAL = mark("final", n - 1);
  const BLACK_AT = mark("black", durationInFrames + 1);
  const endAt = end ? end.from : durationInFrames + 1;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const display = "'" + brand.displayFont + "', 'Big Shoulders Display', 'Oswald', 'Arial Narrow', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter', sans-serif";
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  // Black and white very contrasted, as the model.
  const BW = "grayscale(1) contrast(1.3) brightness(0.95)";
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const cutAt = (k) => (shots[k] ? shots[k].from : durationInFrames + 1);

  // Each shot turned: one filmed in width a quarter, one way then the other, so it fills the vertical frame; one filmed
  // upright plays upright (a quarter turn would leave a sliver of it, a half turn its faces upside down).
  const turned = (i) => {
    const s = shots[i];
    const wide = !s || (Number(s.aspect) || 1.78) >= 0.9;
    const draw = (size) => h(Footage, { shot: i, style: { position: "absolute", left: 0, top: 0, width: size.width, height: size.height } });
    return wide
      ? h(Turn, { key: "t" + i, angle: i % 2 ? -90 : 90, draw })
      : h(AbsoluteFill, { key: "t" + i }, draw({ width, height }));
  };

  // 1. Her shots, turned, cut on the beat; a whip upward into the flurry's last shot, a zoom through one shot into the
  // next, a whip downward between the two longer shots after the burst.
  let film = n ? turned(cur) : null;
  const whipAt = (k, frames, direction) => {
    const at = cutAt(k) - Math.floor(frames / 2);
    if (k >= 1 && k < n && frame >= at && frame < at + frames) film = h(Whip, { key: "w" + k, from: turned(k - 1), to: turned(k), at, frames, direction, blur: 90 });
  };
  whipAt(2, 6, "up");
  whipAt(RELEASE, 8, "down");
  const zoomAt = cutAt(ZOOM) - 6;
  if (ZOOM >= 1 && ZOOM < n && frame >= zoomAt && frame < zoomAt + 12) film = h(ZoomThrough, { key: "z", from: turned(ZOOM - 1), to: turned(ZOOM), at: zoomAt, frames: 12, scale: 2.4 });
  // The flurry flickers, its exposure jumping every two images.
  const flicker = frame < cutAt(CALM) ? 0.82 + 0.5 * random("tourne-flicker-" + Math.floor(frame / 2)) : 1;
  film = frame < BLACK_AT ? h(AbsoluteFill, { style: { filter: "brightness(" + flicker.toFixed(3) + ")" } }, film) : null;

  // 2. A white frame into the burst and into the last shot.
  const flashes = [BURST, FINAL].filter((k) => k >= 1 && k < n);
  let white = 0;
  flashes.forEach((k) => { const d = frame - cutAt(k); white = Math.max(white, d === 0 ? 0.95 : d === 1 ? 0.4 : 0); });
  const flash = white > 0 && frame < BLACK_AT ? h("div", { style: { position: "absolute", left: 0, top: 0, width, height, background: "#ffffff", opacity: white } }) : null;

  // 3. Its optional title, turned a quarter like the shots: very condensed white capitals along the middle of the frame,
  // reading upward, on and off on a cut; its size follows its length, so a long one in a wide face still fits.
  const titleSize = hook ? Math.min(260, Math.max(120, Math.round(4200 / Math.max(6, Array.from(hook.text).length)))) : 260;
  const title = hook && frame >= hook.from && frame < Math.min(hook.to, endAt, BLACK_AT)
    ? h(FitText, { style: { position: "absolute", left: Math.round(width / 2 - 620), top: 760 - 140, width: 1240, height: 280, transform: "rotate(-90deg)", transformOrigin: "50% 50%" }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: titleSize, lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: "0 0 2px rgba(0,0,0,0.55), 0 1px 5px rgba(0,0,0,0.4), 0 2px 18px rgba(0,0,0,0.32)" } }, hook.text)
    : null;

  // Any other text of the Reel (none in its slots): a plain white line, upright, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < Math.min(endAt, BLACK_AT)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1220 - i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.35)" } }, t.text));

  // 4. Its ending card, upright on the black after the last shot: its title in the condensed capitals, a line under it.
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 690 : 770, width: width - 280, height: 300 }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 170, lineHeight: 0.98, letterSpacing: "0.01em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", textWrap: "balance", justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", { style: { display: "inline-block", opacity: o(endAt, endAt + 5) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1014, width: width - 280, height: 160 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 400, fontSize: 50, lineHeight: 1.22, letterSpacing: "0.02em", color: "#ffffff", textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: o(endAt + 5, endAt + 12) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", filter: BW } }, film, flash, title, extra, ending);
}`;

export const tourne: MontageSkill = {
  key: "tourne",
  version: 1,
  bpm: BPM,
  shots: [12, 24],
  files: [6, 16],
  // Its code draws its black and white and its contrast (as its reference does): its model's finish keeps only its grain
  // and vignette, else the contrast doubled and crushed its blacks and whites.
  finish: { contrast: 0 },
  how: "Tous ses plans tournés d'un quart de tour pour remplir l'écran, une fois dans un sens, une fois dans l'autre, en noir et blanc très contrasté : une rafale d'ouverture qui scintille, des plans calmes d'une seconde coupés net, un zoom qui traverse un plan dans le suivant, une image blanche et une rafale de plans d'un cinquième de seconde, deux plans plus longs liés par un coup de fouet, une image blanche et le dernier plan tenu jusqu'à la fin.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "facultatif : un titre court tourné d'un quart de tour comme les plans, en capitales le long de l'écran (son lieu, sa ville, son métier), seulement quand le Reel a besoin de mots",
      max: 16,
      required: false,
    },
  ],
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(12, Math.min(24, n));
    const { calm, rapid } = sections(count);
    // The last shot is held; with an ending card, the black after it carries the card: two beats, and always the
    // engine's 1,6 s (on the quarter-beat grid, rounded up, so a frame lost to rounding never cuts into it).
    const card = end ? Math.max(2, Math.ceil(((END_CARD + 0.05) / beat) * 4) / 4) : 0;
    const beats = [
      ...FLURRY,
      ...Array.from({ length: calm }, (_, i) => CALM[i % CALM.length]!),
      ZOOM_FROM,
      ZOOM_TO,
      ...Array.from({ length: rapid }, () => RAPID),
      ...RELEASE,
      LAST + card,
    ];
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const zoom = 3 + calm + 1;
    const burst = zoom + 1;
    const release = burst + rapid + 1;
    const final = release + 1;
    const wants = [
      "le plan qui ouvre la rafale : une texture ou un geste filmé en largeur, très bref (il est tourné d'un quart de tour)",
      "un deuxième plan très bref filmé en largeur (une matière, un détail)",
      "un plan filmé en largeur qui arrive d'un coup de fouet vers le haut",
      ...Array.from({ length: calm }, () => "un plan filmé en largeur, calme et bien composé (son lieu, une matière, un geste), tourné d'un quart de tour"),
      "un plan filmé en largeur que le zoom traverse (une matière, un motif, un détail serré)",
      "le plan où arrive le zoom : un détail serré, un motif",
      ...Array.from({ length: rapid }, () => "un plan d'un cinquième de seconde : une matière, un geste, un visage, un détail"),
      "un plan plus long filmé en largeur (un geste, quelqu'un, son lieu)",
      "un plan qui arrive d'un coup de fouet vers le bas",
      "le plan qui finit le Reel, tenu longtemps : large et beau (son lieu, quelqu'un, une vue), filmé en largeur",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its optional title: over the flurry and the first calm shots, gone on a cut.
      texts: { titre: { from: 0, to: spans[Math.min(spans.length - 1, 3 + Math.min(2, calm))]!.start } },
      marks: {
        beat: beat * 30,
        calm: 3,
        zoom,
        burst,
        release,
        final,
        ...(end ? { black: toFrame(round(duration - card * beat)) } : {}),
      },
    };
  },
  code: CODE,
};
