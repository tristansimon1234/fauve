import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Toi sur un aplat de couleur », written on its original (house/originals/aplat.mp4, 8,8 s, a hiker's edit, looked at
// image by image): for three images a walker's silhouette glows white on a flat bright red, then he walks in his own
// colours on the red, alone with his shadow; his shot rebuilds itself around him piece by piece from the ground up (the
// path under him, a ditch, the hills, the sky), each piece a white silhouette for three images before it shows; then
// his shots, cut on the music, one of them shrinking inside a thick red frame that closes in on it; it ends on the red.
// Here her silhouette walks on the flat colour (the model's red, or her own colour when it is a vivid one), a title she
// may give stacked very big behind her; her shot rebuilds around her in three pieces from the bottom up (near to far),
// each flashing white; then her shots on the beat, the first one after it closing into a thick frame of the colour,
// every fourth one framed too; the last one is framed in turn and the Reel ends on the colour, her title back on it,
// so it loops. Without her cut-out (when it failed) her first shot plays as a duotone of the colour (her black and white
// shot multiplied by it: her dark shapes on the colour) and the pieces bring it back in colour the same way. Its ending
// card (an offer, an announcement) is set on the colour at the end.

const BPM = 100;
/** Her first shot: alone on the colour, then the three pieces landing (beats from its start), then whole. */
const OPEN = 6;
const PIECES = [2.5, 3.25, 4];
/** The shot that closes into its frame, the shots after it, the last one before the colour (beats). */
const FRAMED = 4;
const EACH = 2;
const LAST = 3;
/** The colour alone at the end, her title on it (beats); with an ending card, the card's time (1,6 s at least). */
const COLOUR = 1;
const CARD_SECONDS = 1.6;
const round = (s: number) => Math.round(s * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  // Its sections (frames): a beat, the three pieces of her first shot, the colour closing in at the end.
  const BEAT = Math.max(4, mark("beat", 18));
  const P1 = mark("p1", Math.round(2.5 * BEAT));
  const P2 = mark("p2", Math.round(3.25 * BEAT));
  const P3 = mark("p3", Math.round(4 * BEAT));
  const CLOSE = mark("close", Math.max(0, durationInFrames - Math.round(BEAT)));
  const n = shots.length;
  const cur = Math.min(Math.max(0, n - 1), shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0));
  const OPEN_TO = n > 1 ? shots[1].from : durationInFrames;
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const ease = Easing.bezier(0.65, 0, 0.35, 1);
  const display = "'" + brand.displayFont + "', 'Anton', 'Archivo Black', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const full = { position: "absolute", left: 0, top: 0, width, height };

  // The colour: her own when it is a vivid one, else the model's red; its ink (white, or a near black on a light colour).
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) / 255);
  const vivid = (c) => {
    if (!/^#[0-9a-f]{6}$/i.test(String(c || ""))) return false;
    const [r, g, b] = rgb(c);
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    const l = (hi + lo) / 2;
    const s = hi === lo ? 0 : (hi - lo) / (1 - Math.abs(2 * l - 1));
    return s >= 0.5 && l >= 0.3 && l <= 0.62;
  };
  const AP = vivid(brand.accent) ? brand.accent : "#e30613";
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (() => { const [r, g, b] = rgb(AP); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); })();
  const ON = (lum + 0.05) / 0.06 > 1.05 / (lum + 0.05) ? "#170707" : "#ffffff";
  const ground = (key, blend) => h("div", { key, style: { ...full, backgroundColor: AP, ...(blend ? { mixBlendMode: blend } : {}) } });

  const hook = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== line);
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");

  // Her title stacked very big in the colour's ink, a word a line (her name kept whole), and its small line above it
  // in spaced capitals: small beside the title (four words at most), at a size that reads otherwise, on two lines when
  // it needs them, in the title's place when it stands alone.
  const wordsIn = (s) => String(s || "").split(/[\s  ]+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const stack = (text) => String(text || "").split(/[ \t\n]+/).filter(Boolean).join("\n");
  const titleBlock = (key, title, small) => {
    const accent = Boolean(title) && wordsIn(small) <= 4;
    return h(React.Fragment, { key },
      small
        ? h(FitText, { style: { position: "absolute", left: 140, top: title ? (accent ? 140 : 96) : 470, width: 800, height: accent ? 64 : 128 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: accent ? 30 : 48, lineHeight: 1.18, letterSpacing: accent ? "0.26em" : "0.12em", textTransform: "uppercase", color: ON, whiteSpace: accent ? "nowrap" : "normal", textWrap: "balance", textAlign: "center" } },
            h("span", accent ? { "data-fauve-accent": "", style: { marginRight: "-0.26em" } } : null, keep(small)))
        : null,
      title
        ? h(FitText, { style: { position: "absolute", left: 60, top: 236, width: 960, height: 634 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 300, lineHeight: 0.86, letterSpacing: "-0.01em", textTransform: "uppercase", color: ON, whiteSpace: "pre", textAlign: "center" } }, stack(keep(title)))
        : null);
  };

  // 1. Her first shot. Her silhouette (her cut-out) alone on the flat colour: white and glowing for three images, then
  // in her own colours, a soft shadow cast from her feet. Without her cut-out: her shot in hard black and white
  // multiplied by the colour (a duotone: her dark shapes on the colour).
  const cut0 = Boolean(shots[0] && shots[0].subjectBoxes && shots[0].subjectBoxes.some(Boolean));
  const opening = [];
  if (frame < OPEN_TO && n) {
    if (cut0) opening.push(ground("g"));
    else opening.push(h(Footage, { key: "bw", shot: 0, style: { ...full, filter: "grayscale(1) contrast(1.55) brightness(1.1)" } }), ground("g", "multiply"));
    // Her title behind her, until the middle piece lands on it.
    if (frame < P2 && (hook || line)) opening.push(titleBlock("t", hook ? hook.text : "", line ? line.text : ""));
    // The three pieces of her shot, from the bottom up, along ragged edges: each one white for three images, then her
    // shot in its place; then her shot whole.
    const edge = (y0, seed) => Array.from({ length: 10 }, (_, i) => [Math.round((i * width) / 9), Math.round(y0 + (random(seed + i) - 0.5) * 110)]);
    const e1 = edge(1290, "e1-");
    const e2 = edge(700, "e2-");
    const poly = (pts) => "polygon(" + pts.map((p) => p[0] + "px " + p[1] + "px").join(", ") + ")";
    const pieces = [
      { at: P1, clip: poly([...e1, [width, height], [0, height]]) },
      { at: P2, clip: poly([...e2, ...e1.slice().reverse()]) },
      { at: P3, clip: poly([[0, 0], [width, 0], ...e2.slice().reverse()]) },
    ];
    if (frame >= P3 + 3) opening.push(h(Footage, { key: "whole", shot: 0, style: full }));
    else pieces.forEach((p, k) => {
      if (frame < p.at) return;
      opening.push(h("div", { key: "p" + k, style: { ...full, clipPath: p.clip, backgroundColor: frame < p.at + 3 ? "#ffffff" : "transparent" } },
        frame < p.at + 3 ? null : h(Footage, { shot: 0, style: full })));
    });
    if (cut0 && frame < P3 + 3) {
      const b = SubjectBox(shots[0], frame, { left: 0, top: 0, width, height });
      if (frame >= 3 && frame < P1 && b && b.y + b.h < height - 24) {
        const feet = Math.round(b.y + b.h);
        opening.push(h(Subject, { key: "shade", shot: 0, fill: "#000000", style: { ...full, opacity: 0.24, transformOrigin: Math.round(b.x + b.w / 2) + "px " + feet + "px", transform: "skewX(38deg) scaleY(-0.26)" } }));
      }
      opening.push(frame < 3
        ? h("div", { key: "glow", style: { ...full, filter: "drop-shadow(0 0 10px #ffffff) drop-shadow(0 0 28px rgba(255,255,255,0.85))" } }, h(Subject, { shot: 0, fill: "#ffffff", style: full }))
        : h(Subject, { key: "her", shot: 0, style: full }));
    }
  }

  // 2. Her shots after it, on the beat. The first one is whole for a beat, then a thick frame of the colour closes in
  // on it over two beats (her picture shrinking inside it), its first two images flashing as overexposed; every fourth
  // one after it is framed, closing a little more; the last one is framed in turn, then the colour fills the frame.
  const framedAt = (i) => i === 1 || i === n - 1 || (i >= 2 && i <= n - 2 && (i - 2) % 4 === 3);
  const inset = (i) => {
    const s = shots[i];
    if (!s || !framedAt(i)) return 0;
    if (i === 1 || i === n - 1) return 0.14 * interpolate(frame, [s.from + BEAT, s.from + 3 * BEAT], [0, 1], { ...clamp, easing: ease });
    return 0.09 + 0.05 * interpolate(frame, [s.from, s.from + s.durationInFrames], [0, 1], clamp);
  };
  let film = null;
  if (frame >= OPEN_TO && frame < CLOSE && n > 1) {
    const t = inset(cur);
    const box = { left: Math.round(t * width), top: Math.round(t * height), width: Math.round(width * (1 - 2 * t)), height: Math.round(height * (1 - 2 * t)) };
    const flash = cur === 1 && frame < shots[1].from + 2;
    film = h(React.Fragment, { key: "film" },
      t > 0 ? ground("frame") : null,
      h(Footage, { shot: cur, style: { position: "absolute", ...box, ...(flash ? { filter: "brightness(2.3) saturate(0.55) contrast(0.85)" } : {}) } }));
  }

  // 3. The end: the colour fills the frame on the last beat, her title back on it (the Reel loops onto its opening);
  // with an ending card, the card is set on it instead.
  const closing = frame >= CLOSE && n > 1
    ? h(React.Fragment, { key: "close" }, ground("c"), !end && (hook || line) ? titleBlock("ct", hook ? hook.text : "", line ? line.text : "") : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain line in the colour's ink near the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 140 + i * 120, width: 800, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: "0 1px 2px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.5)" } }, t.text));

  // 4. Its ending card on the colour: its title stacked in the title's capitals, its line under it.
  const rise = (a) => ({ display: "inline-block", opacity: interpolate(frame, [a, a + 5], [0, 1], clamp), transform: "translateY(" + (18 * (1 - interpolate(frame, [a, a + 8], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) }))).toFixed(1) + "px)" });
  const ending = end && frame >= Math.min(endAt, CLOSE)
    ? h(React.Fragment, { key: "end" },
        ground("eg"),
        h(FitText, { style: { position: "absolute", left: 60, top: 420, width: 960, height: 520 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 230, lineHeight: 0.88, letterSpacing: "-0.01em", textTransform: "uppercase", color: ON, whiteSpace: "pre", textAlign: "center" } },
          h("span", { style: rise(endAt + 1) }, stack(keep(end.title)))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 990, width: 800, height: 170 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.18, color: ON, textAlign: "center", textWrap: "balance" } },
              h("span", { style: rise(endAt + 6) }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: AP } }, opening, film, closing, extra, ending);
}`;

export const aplat: MontageSkill = {
  key: "aplat",
  version: 1,
  bpm: BPM,
  shots: [4, 9],
  // Up to 20 for a length she asks for (29 s at its own tempo, 30 a touch slower): more of her shots on the beat.
  long: 20,
  files: [3, 10],
  how: "La silhouette détourée de quelqu'un qui marche, seule sur un grand aplat de couleur vive (blanche et lumineuse pendant trois images, puis à ses couleurs), le titre empilé en très grand derrière elle ; puis son vrai plan revient autour d'elle en trois morceaux, du sol au ciel, chacun en un flash blanc ; puis ses plans coupés sur le temps, le premier se resserrant dans un épais cadre de la même couleur, un sur quatre encadré lui aussi ; le dernier se fait encadrer à son tour et le Reel finit sur la couleur, le titre revenu dessus.",
  end: true,
  texts: [
    { slot: "titre", role: "hook", want: "facultatif : 1 à 3 mots empilés en très grand sur l'aplat, derrière la silhouette, un par ligne en capitales : ce qu'on va voir, ou son nom s'il est court (une forme comme « un samedi », « au marché », « chez Lou »)", max: 18, required: false },
    { slot: "ligne", role: "caption", want: "facultatif : une petite ligne en capitales espacées au-dessus du titre, 2 à 4 mots : où, quand (une forme comme « au marché · samedi », « rue des Martyrs »)", max: 28, required: false },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // Her first shot, the one that closes into its frame, her shots on the beat, the last one; then the colour (and the
    // ending card on it: 1,6 s at least, the engine's last 1,6 s).
    const count = Math.max(4, n);
    const colour = end ? Math.max(COLOUR, CARD_SECONDS / beat) : COLOUR;
    const spans = beatSpans(bpm, [OPEN, FRAMED, ...Array.from({ length: count - 3 }, () => EACH), LAST + colour]);
    const duration = spans.at(-1)!.end;
    const close = round(spans.at(-1)!.start + LAST * beat);
    const framed = (i: number) => i === 1 || i === count - 1 || (i >= 2 && i <= count - 2 && (i - 2) % 4 === 3);
    const wants = spans.map((_, i) =>
      i === 0
        ? "une vidéo de la personne (ou de quelqu'un) qui marche, de dos ou de profil, en entier dans l'image, au moins 5 s : sa silhouette marche seule sur l'aplat de couleur, puis le vrai plan revient autour d'elle"
        : i === 1
          ? "un plan fort de son lieu ou de son travail, en mouvement : il se resserre dans un épais cadre de couleur"
          : i === spans.length - 1
            ? "un dernier plan large et calme : il se fait encadrer de couleur, puis le Reel finit sur la couleur"
            : framed(i)
              ? "un plan vivant de son lieu, dans un cadre de couleur : un geste, quelqu'un, un détail"
              : "un plan vivant en plein cadre, différent du précédent : un geste, quelqu'un, un détail, son lieu",
    );
    // Her title and its line on the colour at the start, until the middle piece of her shot lands on them.
    const p2 = round(PIECES[1]! * beat);
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: { titre: { from: 0, to: p2 }, ligne: { from: 0, to: p2 } },
      marks: { beat: beat * 30, p1: toFrame(PIECES[0]! * beat), p2: toFrame(p2), p3: toFrame(PIECES[2]! * beat), close: toFrame(close) },
    };
  },
  code: CODE,
};
