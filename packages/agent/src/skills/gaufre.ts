import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Titre gaufré », written on its original (house/originals/gaufre.mp4, 12,8 s, looked at image by image): after the
// façade that builds itself (its own model), a calm shot held full frame; a hard cut to a sheet of peach paper, its
// grain and fibres visible, where the title is already pressed in (one big serif word, in normal case) with a line
// under it in spaced capitals, set to the title's width; the rust ink flows into the letters one after the other from
// their top left corner (the first letter in about a second, the next ones faster), the line inks last, and the inked
// card holds to the end. Here her calm shots come first, cut on the beat, and the card is the Reel's end; its ending
// card (an offer, an announcement) is the next card of the same paper, pressed and inked at once.

const BPM = 84;
/** The paper and its title last this many beats (the ink about 2,5 s, then held), as on the original (3,8 s). */
const PAPER_BEATS = 5;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS). */
const END_CARD = 1.6;
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = mark("beat", 21.43);
  const PAPER = mark("paper", Math.max(0, durationInFrames - Math.round(5 * BEAT)));
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const display = "'" + brand.displayFont + "', serif";
  const body = "'" + brand.bodyFont + "', serif";
  // The model's own card: a peach paper and a rust ink, measured on its original (the paper's colour under its grain,
  // shade and fibres, which bring it to the original's #f3caa2).
  const PAPER_COLOR = "#fac492";
  const INK = "#a8380a";
  const RELIEF = interpolateColors(0.07, [0, 1], [PAPER_COLOR, "#000000"]);
  const hook = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== line);
  const endAt = end ? end.from : durationInFrames + 1;
  const box = { position: "absolute", left: 0, top: 0, width, height };

  // A letter pressed into the paper (its cavity shaded from the top, its upper lip in shade, its lower lip lit, in
  // proportion to its size), then filled with ink that flows in from its top left corner; once inked it has a little
  // thickness and a soft shadow, as printed. Each letter is its own span from the start (no kerning across them), so
  // the word never moves when the ink is done.
  const CAVITY = "linear-gradient(180deg, " + interpolateColors(0.15, [0, 1], [PAPER_COLOR, "#3a1a06"]) + " 0%, " + interpolateColors(0.03, [0, 1], [PAPER_COLOR, "#3a1a06"]) + " 100%)";
  const letter = (c, key, p, size) => {
    if (/\s/.test(c)) return c;
    const d = Math.max(1.5, size * 0.012);
    const px = (v) => v.toFixed(1) + "px";
    const front = (p * 150 - 32).toFixed(1);
    const back = (p * 150 - 6).toFixed(1);
    const layers = "linear-gradient(155deg, " + INK + " " + front + "%, rgba(168,56,10,0) " + back + "%), " + CAVITY;
    // Its shadows, each a filter pass: pressed, its two lips; inked, its thickness and its soft shadow; all four only
    // while its ink flows in (a letter or two at a time), each fading out or in.
    const lips = p < 1 ? "drop-shadow(0 " + px(-d) + " " + px(d * 0.6) + " rgba(70,30,5," + (0.6 * (1 - p)).toFixed(3) + ")) drop-shadow(0 " + px(d) + " " + px(d * 0.6) + " rgba(255,251,243," + (0.95 * (1 - p)).toFixed(3) + "))" : "";
    const printed = p > 0 ? "drop-shadow(" + px(d * 0.3 * p) + " " + px(d * 0.8 * p) + " 0 rgba(96,28,4," + (0.6 * p).toFixed(3) + ")) drop-shadow(0 " + px(d * 2 * p) + " " + px(d * 2.4) + " rgba(90,35,8," + (0.3 * p).toFixed(3) + "))" : "";
    const filter = [lips, printed].filter(Boolean).join(" ");
    return h("span", { key, style: { display: "inline-block", padding: "0.18em 0.12em 0.26em", margin: "-0.18em -0.12em -0.26em", backgroundImage: layers, backgroundSize: "100% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent", filter } }, c);
  };
  const ink = (j, start, each, gap) => interpolate(frame, [start + j * gap, start + j * gap + each], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const count = (text) => Array.from(text).filter((c) => !/\s/.test(c)).length;
  // A title on one, two or three lines (as long as needed, the longest line as short as it can be), broken between words.
  const linesOf = (text, most) => {
    const words = text.split(/[ \t\n]+/).filter(Boolean);
    const want = text.length <= 9 || words.length < 2 ? 1 : text.length <= 16 || words.length < 3 || most < 3 ? 2 : 3;
    if (want === 1) return [words.join(" ")];
    let best = null;
    const join = (a, b) => words.slice(a, b).join(" ");
    for (let i = 1; i < words.length; i++) {
      if (want === 2) {
        const lines = [join(0, i), join(i, words.length)];
        const longest = Math.max(...lines.map((l) => l.length));
        if (!best || longest < best.longest) best = { lines, longest };
      } else {
        for (let j = i + 1; j < words.length; j++) {
          const lines = [join(0, i), join(i, j), join(j, words.length)];
          const longest = Math.max(...lines.map((l) => l.length));
          if (!best || longest < best.longest) best = { lines, longest };
        }
      }
    }
    return best ? best.lines : [text];
  };

  // 1. Her shots, full frame, calm, cut on the beat (the last one runs on under the paper); a photo that opens the Reel
  // slowly pushed in, so its first image moves (the others stay still, as a composition lays them).
  const first = shots[0];
  const push = cur === 0 && first && first.kind === "photo" ? 1 + 0.06 * interpolate(frame, [0, Math.max(1, Math.min(first.durationInFrames, PAPER))], [0, 1], clamp) : 1;
  const film = frame < PAPER ? h(Footage, { shot: cur, style: { ...box, ...(push > 1 ? { transform: "scale(" + push.toFixed(4) + ")" } : {}) } }) : null;

  // 2. The card: her title pressed into the paper at the cut, as big as the card holds (the original's single word
  // fills two thirds of its width), a line in spaced capitals under it, justified to the title's width; the ink flows
  // letter by letter (about 2,5 s whatever its length), then the line. One box, shrunk as a whole if it must.
  const card = (title, small, at, fast) => {
    const lines = linesOf(title, fast ? 2 : 3);
    const longest = Math.max(1, ...lines.map((l) => l.length));
    const size = Math.round(Math.max(120, Math.min(fast ? 210 : 400, 800 / (longest * 0.4))));
    const n = count(title);
    // The ink takes about two thirds of the card's time (its five beats: slower at a slower tempo), the line inks last.
    const k = fast ? 1 : Math.max(0.6, Math.min(1.5, ((end ? endAt : durationInFrames) - PAPER) / 107));
    const each = fast ? 9 : Math.round(20 * k);
    const gap = fast ? Math.max(1, Math.min(3, Math.round(12 / Math.max(1, n - 1)))) : Math.max(2, Math.min(Math.round(14 * k), Math.round((50 * k) / Math.max(1, n - 1))));
    const titleDone = at + 3 + gap * Math.max(0, n - 1) + each;
    // The line: about a fifth of the title's size, never wider than the title, spread over its width when long enough.
    const m = small ? small.length : 0;
    const titleWidth = Math.min(800, longest * 0.45 * size);
    const lineSize = Math.round(Math.max(40, Math.min(size * 0.22, 96, titleWidth / Math.max(1, m * 0.7))));
    // Spread over the title's width when it nearly fills it (the original's line); a short one centred, spaced.
    const justify = m > 6 && m * 0.72 * lineSize >= titleWidth * 0.6;
    const lineAt = fast ? at + 8 : Math.round(at + (titleDone - at) * 0.6);
    const lineEach = fast ? 7 : Math.round(12 * k);
    const lineGap = fast ? 1 : Math.max(1, Math.min(3, Math.round((20 * k) / Math.max(1, count(small || "") - 1))));
    let k = 0;
    const titleRows = lines.map((l, r) =>
      h("div", { key: "t" + r, style: { whiteSpace: "nowrap" } },
        Array.from(l).map((c, i) => {
          if (/\s/.test(c)) return c;
          return letter(c, r + "-" + i, ink(k++, at + 3, each, gap), size);
        }),
        r < lines.length - 1 ? " " : null));
    let q = 0;
    const lineLetters = small && !fast
      ? Array.from(small.toUpperCase()).map((c, i) =>
          /\s/.test(c)
            ? h("span", { key: "s" + i, style: { width: "0.4em", flex: "0 0 auto" } }, " ")
            : h("span", { key: "c" + i, style: { flex: "0 0 auto" } }, letter(c, "l" + i, ink(q++, lineAt, lineEach, lineGap), lineSize)))
      : null;
    const block = h(FitText, { style: { position: "absolute", left: 140, top: fast ? 600 : 620, width: width - 280, height: fast ? 520 : 680 } }, (scale) =>
      h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "stretch", fontKerning: "none", fontVariantLigatures: "none" } },
        h("div", { style: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: size, lineHeight: 1.02, letterSpacing: "-0.01em", textAlign: "center", color: RELIEF } }, titleRows),
        // The line keeps a size that reads when a long title makes the card shrink.
        lineLetters
          ? h("div", { "data-fauve-accent": "", style: { display: "flex", justifyContent: justify ? "space-between" : "center", marginTop: Math.round(size * 0.14), fontFamily: body, fontWeight: 700, fontSynthesis: "none", fontSize: Math.round(lineSize / Math.max(0.65, scale)), lineHeight: 1.1, letterSpacing: justify ? 0 : "0.28em", whiteSpace: "nowrap", color: RELIEF } }, lineLetters)
          : null));
    if (!fast || !small) return block;
    // The ending card's line (an address, a date: as long as it needs) under its title, pressed, then inked as a whole.
    const p = ink(0, lineAt, 10, 1);
    return h(React.Fragment, null, block,
      h(FitText, { style: { position: "absolute", left: 140, top: 1150, width: width - 280, height: 210 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSynthesis: "none", fontSize: 52, lineHeight: 1.2, letterSpacing: "0.08em", textTransform: "uppercase", textWrap: "balance", color: interpolateColors(p, [0, 1], [RELIEF, INK]), filter: "drop-shadow(0 -1px 0.8px rgba(70,30,5,0.45)) drop-shadow(0 1px 0.8px rgba(255,251,243,0.85))" } }, small));
  };
  const onPaper = frame >= PAPER && frame < endAt;
  const titled = onPaper && (hook || line)
    ? card(hook ? hook.text : "", line ? line.text : "", Math.max(PAPER, hook ? hook.from : PAPER), false)
    : null;

  // Any other text of the Reel (none in its slots): a plain line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1300, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: frame >= PAPER ? INK : "#ffffff", textAlign: "center", textShadow: frame >= PAPER ? "none" : "0 0 2px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.4)" } }, t.text));

  // 3. Its ending card: the next card of the same paper, its title pressed and inked at once, its line under it.
  const ending = end && frame >= endAt ? card(String(end.title || ""), end.subtitle ? String(end.subtitle) : "", endAt, true) : null;

  // The paper: its colour, its fine grain, the wavy fibres of a handmade sheet in relief lit from the top left, a little
  // darker at its edges. Its textures are images drawn once (the same for every frame), so a long card costs nothing
  // more, in the render as in the scene check.
  const svg = (inner) => "url(\"data:image/svg+xml;charset=utf-8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='" + width + "' height='" + height + "'>" + inner + "</svg>") + "\")";
  const FIBRES = svg("<filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='turbulence' baseFrequency='0.012 0.022' numOctaves='3' seed='4'/><feDiffuseLighting lighting-color='#ffffff' surfaceScale='3' diffuseConstant='1'><feDistantLight azimuth='235' elevation='28'/></feDiffuseLighting></filter><rect width='100%' height='100%' filter='url(#f)'/>");
  const GRAIN = svg("<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/>");
  const layer = (image, extra) => h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, backgroundImage: image, backgroundSize: "100% 100%", ...extra } });
  const paper = frame >= PAPER
    ? h("div", { style: { ...box, backgroundColor: PAPER_COLOR, overflow: "hidden" } },
        layer(GRAIN, { opacity: 0.3 }),
        layer(FIBRES, { mixBlendMode: "overlay", opacity: 0.5 }),
        h("div", { style: { position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(40,24,10,0.063) 100%)" } }))
    : null;
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, paper, titled, ending, extra);
}`;

export const gaufre: MontageSkill = {
  key: "gaufre",
  version: 1,
  bpm: BPM,
  shots: [1, 6],
  files: [1, 6],
  how: "Ses plans calmes en plein écran, coupés sur le temps ; puis une coupe franche sur un papier pêche où son nom est déjà pressé en relief, une ligne en capitales espacées dessous ; l'encre rouille entre dans les lettres l'une après l'autre, puis dans la ligne, et la carte encrée reste jusqu'à la fin, comme un faire-part.",
  end: true,
  texts: [
    { slot: "titre", role: "hook", want: "le titre pressé dans le papier puis encré : son nom (le mieux), ou 1 à 3 mots qui la disent, dans sa casse, sans point", max: 22, required: true },
    { slot: "ligne", role: "caption", want: "une ligne courte sous le titre, en capitales espacées : son métier et son quartier, une date, ce qu'elle fait (une forme comme « pâtisserie · paris 11e », « depuis 1998 »)", max: 24, required: false },
  ],
  timeline(n, options: { end: boolean; bpm?: number }) {
    const { end } = options;
    // At her music's tempo when one is given (slower: a longer, calmer Reel; faster: a shorter one), else the model's.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    // Calm shots of two beats, the last one held three before the paper; a single shot holds four (the original's
    // street, before its paper, holds about five).
    const count = Math.max(1, Math.min(6, n));
    const lens = count === 1 ? [4] : [...Array.from({ length: count - 1 }, () => 2), 3];
    const shown = lens.reduce((a, b) => a + b, 0);
    // The last shot's segment runs on under the paper (its cut to the paper is on a beat), and under the ending card.
    const spans = beatSpans(bpm, [...lens.slice(0, -1), lens.at(-1)! + PAPER_BEATS]);
    const paperAt = onFrame(shown * beat);
    const cardAt = onFrame((shown + PAPER_BEATS) * beat);
    const duration = round(end ? onFrame(cardAt + END_CARD) : cardAt);
    spans[spans.length - 1] = { start: spans.at(-1)!.start, end: duration };
    // The last one is seen for its first beats only: the paper comes over it.
    const seen = (lens.at(-1)! * beat).toFixed(1).replace(".", ",");
    const wants = lens.map((_, i) =>
      i === lens.length - 1
        ? `${i === 0 ? "le seul plan du Reel" : "le dernier plan"}, calme et beau, en plein écran : seules ses ${seen} premières secondes se voient, puis le papier vient par-dessus (un plan large ou un détail qui respire)`
        : i === 0
          ? "le plan qui ouvre le Reel, calme et beau, en plein écran : son lieu, son travail ou ses produits"
          : "un plan calme de son lieu, de ses gestes ou de ses produits, en plein écran",
    );
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The title and its line are pressed into the paper from its first image, and stay until the ending card.
      texts: {
        titre: { from: round(paperAt), to: round(cardAt) },
        ligne: { from: round(paperAt), to: round(cardAt) },
      },
      marks: { beat: beat * 30, paper: toFrame(paperAt) },
    };
  },
  code: CODE,
};
