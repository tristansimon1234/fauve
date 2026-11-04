import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Une journée chez toi », written on its original (house/originals/journee.mp4, 15 s, a day in Paris, looked at image
// by image): two quick shots of the place (a façade, a detail), then a wide shot where the title flickers on letter by
// letter, a giant name in a red didone in capitals, three small red words written by hand above its left edge; the
// title stays over the next shot, where people walk past in front of it, and goes at the cut; then the day in short
// shots, about one a beat (some half, some one and a half), details, gestures, passers-by; and an evening shot of
// blurred lights held to the end. Here the title is hers and her passers-by walk in front of it when they are cut out
// (when they are not, the title simply stays in front); its ending card (an offer, an announcement) is the title's red
// over the last shot.

const BPM = 92;
/** The title's two shots, in beats, and the evening shot that ends it. */
const TITLE_SHOT = 2;
const EVENING = 4;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS). */
const END_CARD = 1.6;
/** The day's shots in beats, as the original cuts them (mostly a beat, some quicker, some held). */
const PATTERN = [1, 1, 0.5, 1, 1.5, 1, 0.5, 0.5, 1];
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = mark("beat", 19.57);
  const TITLE_AT = mark("title", Math.round(2 * BEAT));
  const DAY_AT = mark("day", TITLE_AT + Math.round(4 * BEAT));
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const display = "'" + brand.displayFont + "', serif";
  const body = "'" + brand.bodyFont + "', sans-serif";
  const hand = "'Caveat', '" + brand.bodyFont + "', cursive";
  // The model's own red, measured on its original.
  const RED = "#f2101a";
  const box = { position: "absolute", left: 0, top: 0, width, height };
  const hook = reelTexts.find((t) => t.role === "hook");
  const small = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== small);
  const endAt = end ? end.from : durationInFrames + 1;
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });

  // Her shots, full frame, as filmed, cut on the beat; a photo that opens the Reel slowly pushed in, so its first image
  // moves (the others stay still, as a composition lays them).
  const first = shots[0];
  const push = cur === 0 && first && first.kind === "photo" ? 1 + 0.04 * interpolate(frame, [0, Math.max(1, first.durationInFrames)], [0, 1], clamp) : 1;
  const film = h(Footage, { shot: cur, style: { ...box, ...(push > 1 ? { transform: "scale(" + push.toFixed(4) + ")" } : {}) } });

  // A line of the ending card on two lines when long, broken between words (a non-breaking space keeps « 9 h » whole).
  const twoLines = (text) => {
    const words = text.split(/[ \t\n]+/).filter(Boolean);
    if (text.length <= 12 || words.length < 2) return text;
    let best = 1;
    for (let i = 1; i < words.length; i++) {
      const gap = (k) => Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
      if (gap(i) < gap(best)) best = i;
    }
    return words.slice(0, best).join(" ") + "\n" + words.slice(best).join(" ");
  };

  // Letters that light up one after the other in a random order, blinking a few times before they hold (the
  // original's title: about seven letters in a second); and words that fade in one after the other. Every letter is in
  // the page from the start (unseen until its turn), so the title's size is measured once, on its whole name.
  const flicker = (text, at, stagger, frames, seed) => {
    const chars = Array.from(text);
    const units = chars.map((c, i) => i).filter((i) => !/\s/.test(chars[i]));
    // Settled: the plain name, laid out the same (no kerning across its letters, as while it flickers).
    if (frame >= at + stagger * Math.max(0, units.length - 1) + frames) return text;
    const order = units.slice().sort((a, b) => random(seed + "-o-" + a) - random(seed + "-o-" + b));
    return chars.map((c, i) => {
      if (/\s/.test(c)) return c;
      const turn = order.indexOf(i);
      const p = interpolate(frame, [at + turn * stagger, at + turn * stagger + frames], [0, 1], clamp);
      const on = p >= 1 || (p > 0 && random(seed + "-f-" + i + "-" + Math.floor(frame / 2)) < 0.25 + 0.75 * p);
      return h("span", { key: i, style: { opacity: on ? 1 : 0 } }, c);
    });
  };
  const fadeWords = (text, at) => text.split(/( +)/).map((w, i) =>
    / /.test(w) || !w ? w : h("span", { key: i, style: { opacity: o(at + (i / 2) * 3, at + (i / 2) * 3 + 8) } }, w));

  // The title: its small words written by hand over its left edge, then the giant name flickering on letter by letter,
  // over the title's two shots; as wide as the frame holds in its upper half. Her passers-by in front of it.
  const titleOn = hook && frame >= TITLE_AT && frame < DAY_AT;
  const lettering = (words, name, at, big) => {
    const lines = big ? [name] : twoLines(name).split("\n");
    // Its box ends above the middle (so it may take the frame's whole width), as tall as the name will be drawn:
    // a short name giant, a longer one on its line lower down, near the middle as in the original.
    const fit = Math.min(1, 1000 / (Math.max(1, name.length) * 0.62 * 330));
    const tall = big ? Math.max(180, Math.round((330 * 0.92 + 95) * fit * 1.15)) : 380;
    // (Its letters' boxes reach about a sixth of their size below its line: the box stops short of the middle.)
    return h(FitText, { style: { position: "absolute", left: 40, top: 890 - tall, width: width - 80, height: tall } }, (scale) =>
      h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: big ? "flex-start" : "center" } },
        words
          ? h("div", { "data-fauve-accent": "", style: { fontFamily: hand, fontWeight: 600, fontSize: Math.round(74 / Math.max(0.45, scale)), lineHeight: 1.1, color: RED, whiteSpace: "nowrap", marginLeft: "0.08em", marginBottom: -6 } }, fadeWords(words, at - 3))
          : null,
        lines.map((l, r) =>
          h("div", { key: r, style: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontKerning: "none", fontVariantLigatures: "none", fontSize: big ? 330 : 190, lineHeight: 0.92, letterSpacing: "-0.03em", textTransform: "uppercase", whiteSpace: "nowrap", color: RED } },
            flicker(l, at + 4 + r * 6, big ? 3 : 1, 7, "t" + r), r < lines.length - 1 ? " " : null))));
  };
  const title = titleOn ? lettering(small ? small.text : "", hook.text, TITLE_AT + 3, true) : null;
  const passers = titleOn ? h(Subject, { shot: cur, style: box }) : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1250, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#ffffff", textAlign: "center", textShadow: "0 0 2px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.4)" } }, t.text));

  // Its ending card: the last shot a little darker, its title in the title's red flickering on, a fine line under it.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, null,
        h("div", { style: { ...box, backgroundColor: "rgba(0,0,0," + (0.35 * o(endAt, endAt + 8)).toFixed(3) + ")" } }),
        lettering("", String(end.title || ""), endAt, false),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 905, width: width - 280, height: 150 }, innerStyle: { fontFamily: body, fontWeight: 400, fontSize: 52, lineHeight: 1.2, letterSpacing: "0.03em", color: "#ffffff", textWrap: "balance", opacity: o(endAt + 8, endAt + 16), textShadow: "0 0 2px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.35)" } }, end.subtitle)
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, title, passers, extra, ending);
}`;

export const journee: MontageSkill = {
  key: "journee",
  version: 1,
  bpm: BPM,
  shots: [10, 18],
  // Up to 30 for a length she asks for: about 30 s at its own tempo.
  long: 30,
  files: [6, 16],
  how: "Deux plans rapides de son lieu, puis un plan large où son nom s'allume lettre à lettre en rouge, géant, en didone capitales, avec trois petits mots écrits à la main au-dessus ; le titre reste sur le plan suivant, derrière les passants, et part à la coupe ; puis sa journée en plans courts sur le temps (des détails, des gestes, des gens) et un plan du soir tenu jusqu'à la fin, comme un film.",
  end: true,
  texts: [
    { slot: "surtitre", role: "caption", want: "2 ou 3 petits mots écrits à la main au-dessus du titre, qui l'amènent (une forme comme « une journée à », « un samedi chez », « le matin au »)", max: 20, required: true },
    { slot: "titre", role: "hook", want: "le titre rouge géant, sur une ligne en capitales : un seul mot de préférence (son quartier, sa rue, son nom s'il est court), plus il est court plus il est grand", max: 12, required: true },
  ],
  timeline(n, options: { end: boolean; bpm?: number }) {
    const { end } = options;
    // At her music's tempo when one is given (slower: a longer, calmer Reel; faster: a shorter one), else the model's.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(10, Math.min(30, n));
    // Two quick shots, the title's two shots, the day on the pattern, the evening shot held (longer under the ending card);
    // past 18 shots (a length she asked for), the day goes on in moments held two beats.
    const day = Array.from({ length: count - 5 }, (_, i) => (i >= 13 ? 2 : PATTERN[i % PATTERN.length]!));
    const beats = [1, 1, TITLE_SHOT, TITLE_SHOT, ...day, EVENING];
    const spans = beatSpans(bpm, beats);
    const eveningAt = spans.at(-1)!.start;
    const duration = round(end ? onFrame(eveningAt + (EVENING - 1) * beat + END_CARD) : spans.at(-1)!.end);
    spans[spans.length - 1] = { start: eveningAt, end: duration };
    const titleAt = spans[2]!.start;
    const dayAt = spans[4]!.start;
    const wants = [
      "un plan rapide qui ouvre : son lieu, sa façade ou sa rue, en mouvement",
      "un autre plan rapide de son lieu : un détail, un mouvement de caméra",
      "une vidéo large de son lieu ou de sa rue avec des gens qui passent : son nom s'y écrit en très grand",
      "un plan large où des gens passent devant (le titre reste derrière eux)",
      ...day.map((b) => (b < 1 ? "un plan très court de sa journée : un geste, un détail" : b > 1 ? "un plan de sa journée, un peu plus long : quelqu'un, un moment" : "un plan de sa journée : un détail, un geste, des gens")),
      "le plan du soir qui finit le Reel, calme, des lumières (tenu jusqu'à la fin)",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: {
        surtitre: { from: round(titleAt), to: round(dayAt) },
        titre: { from: round(titleAt), to: round(dayAt) },
      },
      marks: { beat: beat * 30, title: toFrame(titleAt), day: toFrame(dayAt) },
    };
  },
  code: CODE,
  fonts: ["Caveat"],
};
