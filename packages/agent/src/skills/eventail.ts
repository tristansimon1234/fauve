import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Éventail de bandes », version 2, written again on its original's fiche (docs/fiches/eventail.md: measured image by
// image at 30 i/s, its sound read by bands of frequency, the video watched and heard by Gemini; Tristan: « c'est un
// effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Its music is a garba beat at 119,8 BPM and
// every length below is in its beats from the Reel's first image, so each moment lands on the beat it lands on in the
// original (its picture runs five images ahead of its own sound; ours is on our music's beats):
//   0 – 7    on a deep bordeaux ground, a small square at the middle, a window onto the heart of her opening shot (a
//            centre with lines going out of it), then a band a beat, each set at once, all of them windows onto that one
//            shot at its place: three lines through the middle, each in two halves (« \ », « / », then « | »), cut
//            square short of it so their ends draw a hexagon around the square; the shot plays under them;
//   7 – 9    the whole shot at once on the drop, at the same place and size, a thin frame of the ground laid over it;
//   then her shots in black and white, two beats each, cut on the kick: the fifth a split screen of two shots that answer
//   each other (the place and its heart), the ninth a second shot with lines going out of its centre (the opening's echo);
//   31 –     a blue black in the frame: her name in a small white serif at the middle, at once; two beats later a smaller
//            brick red line under it; both held eight beats and a half, its music going on under them.
// Its music shaped as the original's: a short hit of it on each of the seven beats before the drop, through a small
// speaker and silent between (its intro: a mid-range sound alone, 0,28 s a beat), then all of it with the whole shot.
// Black and white with blue blacks and whites never blown, no grain, no zoom, no flash: the original has none. Played
// horizontal 16:9 on black as the original when her videos are horizontal (or she asks), else full frame with its star
// turned a quarter. A photo stays still, a video plays (Tristan). Nothing of the original's own is copied: its credit and
// its handle are her words, its ground her dark colour on her word.

const BPM = 119.8;
/** The star: the square on the first beat, a band on each of the next six; the whole shot on the drop (beat 7), held two beats. */
const DROP = 7;
const OPENING = 9;
/** Each of her shots after it (beats). */
const EACH = 2;
/** The black at the end (beats): her name on it at once, its red line two beats later, both held to the end. */
const BLACK = 8.5;
const LINE_AFTER = 2;
/** With an ending card (an option): her name six beats on the black, then the card's 1,6 s (the engine's END_CARD_SECONDS). */
const BEFORE_CARD = 6;
const END_CARD = 1.6;
/** Its intro: a hit of its music on each beat before the drop, this long (beats: the original's 0,28 s), then silence to the next beat. */
const HIT = 0.56;
/** Its music cut at the end with a short fade (beats: the original's 0,25 s). */
const FADE = 0.5;
/** Its two-beat shots as the original cuts them: its fifth a split screen (with its last shot), its ninth the opening's echo. */
const SLOTS = [
  "ses lumières vues d'en bas : des guirlandes, des suspensions, un plafond éclairé",
  "un détail lumineux, de près : une lampe, une enseigne, des bougies, une vitrine éclairée",
  "du monde qui bouge : une salle pleine, un cours, des clients, des gens qui dansent",
  "des lignes qui partent d'un point de lumière : un plafond, une verrière, une allée éclairée",
  "le premier de deux plans qui se répondent, montrés côte à côte en écran partagé : son lieu (sa salle, sa vitrine, son geste)",
  "des gens en plan large : deux personnes, un geste, une danse",
  "en regardant le plafond ou le ciel, la caméra qui tourne doucement sur elle-même",
  "un détail qui bouge, de près : des tissus, des mains, un geste",
  "un second plan avec un centre et des lignes qui en partent, comme celui qui ouvre (vu d'en haut, d'en bas ou en perspective)",
  "des gens en mouvement, en ligne ou en groupe : une file, une équipe au travail, un cours",
  "un détail au ras du sol ou des mains : des pas, des pieds, un geste qui finit",
];
const SPLIT = 4;
const ECHO = 8;
/** Fewer shots (fewer of her files): these go first, never the split screen nor the echo. */
const DROPS = [9, 1, 6, 3, 7, 10, 5];
/** More shots (a length she asks for): moments held two beats each, before the echo. */
const MORE = "un moment de son lieu, tenu deux temps : des gens, un détail, la lumière";
/** Its shots from her files alone (the original's thirteen), and the most for a length she asks for (about 30 s). */
const FEWEST = 6;
const ORIGINAL = 13;
const MOST = 23;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const onFrame = (s: number) => Math.round(s * 30) / 30;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its sections (frames): a band on each beat, the whole shot on the drop, the split screen, the black.
  const BEAT = Math.max(4, mark("beat", 15.025));
  const WHOLE = mark("whole", Math.round(7 * BEAT));
  const SPLIT = mark("split", -100);
  const SPLIT_TO = mark("split_to", -100);
  const BLACK = mark("black", durationInFrames + 1);
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;

  // Its frame: horizontal 16:9 on black as the original when most of her videos are horizontal (or she asks), else the
  // whole vertical frame, its star turned a quarter; every size below is a share of the frame's short side.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const S = Math.min(bw, bh);
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const full = { position: "absolute", left: 0, top: 0, width: bw, height: bh };

  // Its colours: a deep bordeaux ground and frame (her own dark colour on her word, when she has one), her shots in
  // black and white, their blacks lifted to the blue black of its end, their whites never blown; a white name and a
  // brick red line.
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); return m ? parseInt(m[1], 16) : null; };
  const lum = (v) => (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  const dark = hex(brand.palette && brand.palette.dark);
  // (Its bordeaux a little purer than the original's #420e0f, as the ground's grain warms it back to it.)
  const GROUND = setting("fond", "bordeaux") === "sienne" && dark !== null && lum(dark) < 0.4 ? "#" + dark.toString(16).padStart(6, "0") : "#440a0b";
  const NIGHT = "#03090d";
  const WHITE = "#ffffff";
  const RED = "#972f34";
  const BW = "grayscale(1) brightness(1.08) contrast(1.22)";
  // The ground darker toward its sides, as the original's (a quarter darker at its left edge, a sixth at its right).
  const sides = h("div", { style: { ...full, background: "linear-gradient(90deg, rgba(0,0,0,0.25), rgba(0,0,0,0.25) 8%, rgba(0,0,0,0.1) 17%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.13) 75%, rgba(0,0,0,0.17))" } });
  // Her picture graded as the original's: black and white, its blacks no darker than the blue black (laid in lighten),
  // its whites no brighter than #e8e9ea (in darken); the grade on her picture only.
  const picture = (child) => h("div", { style: { ...full, overflow: "hidden", isolation: "isolate" } }, child,
    h("div", { style: { ...full, backgroundColor: NIGHT, mixBlendMode: "lighten" } }),
    h("div", { style: { ...full, backgroundColor: "#e8e9ea", mixBlendMode: "darken" } }));

  // 1. The star: her opening shot through a small square at the middle (on its heart, what the filler named there when
  // it is found small, read once and pulled within an eighth of the frame; else the very middle, where she films it),
  // then a band a beat, each set at once, all of them windows onto that one shot at its place, in the original's order:
  // a line through the middle in two halves (« \ »), the other (« / »), then the upright one, each half cut square short
  // of the square, so their ends draw a hexagon around it. Measured on the original's short side: the square 9,4 %; the
  // diagonals 36° from the horizontal (54° turned upright), 14 % wide, ending 13,5 % from the middle; the upright ones
  // 15,5 % wide, ending 11,5 % from it.
  const found = n ? SubjectBox(shots[0], 0, laid, "@coeur") : null;
  const heart = found && found.w < bw / 3 && found.h < bh / 3 ? found : null;
  const pull = (v, mid, room) => Math.max(mid - room, Math.min(mid + room, v));
  const cx = heart ? pull(heart.x + heart.w / 2, bw / 2, bw / 8) : bw / 2;
  const cy = heart ? pull(heart.y + heart.h / 2, bh / 2, bh / 8) : bh / 2;
  const ANGLES = [36, 216, 144, 324, 270, 90].map((a) => a + (wide ? 0 : 90));
  const SQ = 0.094 * S;
  const band = (k) => {
    const upright = k >= 4;
    const w = (upright ? 0.155 : 0.14) * S;
    const r0 = (upright ? 0.115 : 0.135) * S;
    const r1 = bw + bh;
    const a = (ANGLES[k] * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const at = (r, s) => (cx + ux * r - uy * s).toFixed(1) + " " + (cy + uy * r + ux * s).toFixed(1);
    return "M" + at(r0, -w / 2) + " L" + at(r1, -w / 2) + " L" + at(r1, w / 2) + " L" + at(r0, w / 2) + " Z";
  };
  const square = "M" + (cx - SQ / 2).toFixed(1) + " " + (cy - SQ / 2).toFixed(1) + " h" + SQ.toFixed(1) + " v" + SQ.toFixed(1) + " h" + (-SQ).toFixed(1) + " Z";
  const landed = [0, 1, 2, 3, 4, 5].filter((k) => frame >= Math.round((k + 1) * BEAT));
  const star = frame < WHOLE && n
    ? h("div", { key: "star", style: { ...full, clipPath: "path('" + [square].concat(landed.map(band)).join(" ") + "')" } }, picture(h(Footage, { shot: 0, style: { ...full, filter: BW } })))
    : null;

  // 2. The whole shot at once on the drop, at the same place and size, then her shots one after the other, cut every two
  // beats, in black and white, a thin frame of the ground laid over them to the end (the original's 14 px a side and
  // 12 above and below, of 720 × 406). The fifth: a split screen of her shot and the one that answers it (the last of
  // her shots, seen only then), side by side (one above the other upright), each an exact half, no line between.
  const FX = Math.round((wide ? 0.0345 : 0.0296) * S);
  const FY = Math.round((wide ? 0.0296 : 0.0345) * S);
  const framed = { ...full, clipPath: "inset(" + FY + "px " + FX + "px)" };
  const half = (k, at) => (size) => h(Footage, { shot: k, ...(at === undefined ? {} : { at }), style: { position: "absolute", left: 0, top: 0, width: size.width, height: size.height, filter: BW } });
  const splitting = n > 2 && frame >= SPLIT && frame < SPLIT_TO;
  const film = n && frame >= WHOLE && frame < BLACK && frame < endAt
    ? h("div", { key: "film", style: framed }, picture(splitting
        ? h(Split, { parts: [half(cur), half(n - 1, SPLIT)], direction: wide ? "row" : "column", enter: "cut", gap: 0, box: { x: 0, y: 0, w: bw, h: bh } })
        : h(Footage, { shot: cur, style: { ...full, filter: BW } })))
    : null;
  // 3. Its end: the blue black in the frame, to the end (its ending card's too).
  const night = frame >= Math.min(BLACK, endAt) ? h("div", { key: "night", style: { ...framed, backgroundColor: NIGHT } }) : null;

  // Its words, on the black only: her name white at the middle, one line in a small upright serif (the original's
  // capitals are 5,4 % of its height: 50 px here, at the size that reads), its red line two beats later under it,
  // smaller (a short one an accent beside her name, 4 words at most; a longer one at the size that reads).
  const display = "'" + brand.displayFont + "', 'Instrument Serif', Georgia, serif";
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0").replace(/ (\d+(?:er|e))\b/g, "\u00a0$1");
  const credit = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== credit && t !== line);
  const shown = (t) => Boolean(t) && frame >= t.from && frame < t.to && frame < endAt;
  // Their lines' middles, the original's (48,9 % and 56,7 % of its height): 7 px over the frame's middle and 41 under it.
  const mid = by + Math.round(bh / 2);
  const few = (s) => String(s || "").split(/[\s\u00a0\u202f]+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length <= 4;
  // A line in its box (top, height: room for its glyphs, so it is never shrunk), on one line, or on two for her card's
  // longer words (anchored: "flex-end" or "flex-start").
  const say = (key, text, top, tall, size, color, accent, anchor) =>
    h(FitText, { key, style: { position: "absolute", left: 140, top: Math.round(top), width: 800, height: Math.round(tall) }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: size, lineHeight: 1.12, color, textAlign: "center", whiteSpace: anchor ? "normal" : "nowrap", textWrap: "balance", ...(anchor ? { justifyContent: anchor } : {}) } },
      accent ? h("span", { "data-fauve-accent": "" }, keep(text)) : keep(text));
  const red = (key, text, top, anchor) => (few(text) ? say(key, text, top, anchor ? 120 : 68, 42, RED, true, anchor) : say(key, text, top, anchor ? 132 : 76, 48, RED, false, anchor));
  const words = [shown(credit) ? say("credit", credit.text, mid - 47, 80, 50, WHITE, false, null) : null, shown(line) ? red("line", line.text, mid + 41 - (few(line.text) ? 34 : 38), null) : null];

  // Its ending card (an option): its title in place of her name and its line in place of the red one, on the black.
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        say("end-title", end.title, end.subtitle ? mid - 140 : mid - 70, 140, 50, WHITE, false, end.subtitle ? "flex-end" : "center"),
        end.subtitle ? red("end-line", end.subtitle, mid + 24, "flex-start") : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain white line off its picture, so nothing she wrote is lost.
  const extra = others.filter((t) => shown(t)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: 800, top: wide ? Math.max(100, by - 140 - i * 120) : 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 52, lineHeight: 1.15, color: WHITE, textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden" } },
    h(Paper, { color: GROUND, grain: 0.25, shade: 0 }, sides, star, film, night));
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, words, ending, extra);
}`;

export const eventail: MontageSkill = {
  key: "eventail",
  // 2: written again on its original's fiche: its format (16:9 when her videos are), its tempo and its cuts, its star of
  // windows onto one shot (a band a beat, its square on her shot's heart), the whole shot on the drop and its music's
  // intro of hits alone, its split screen, its black and white with blue blacks and no grain, its end in a serif.
  version: 2,
  bpm: BPM,
  shots: [FEWEST, ORIGINAL],
  // Up to 23 for a length she asks for: about 30 s at its own tempo (more of her place, two beats each).
  long: MOST,
  files: [5, 12],
  how: "Sur un fond bordeaux, un petit carré au milieu montre le cœur de son premier plan (un plan avec un centre et des lignes qui en partent) ; puis une bande par temps, posée d'un coup, toutes des fenêtres sur ce même plan, en étoile autour du carré, sur sept petits coups de musique seuls ; au huitième temps le beat entre et le plan entier apparaît d'un coup, dans un fin cadre bordeaux ; puis ses plans en noir et blanc coupés tous les deux temps, dont un écran partagé de deux plans qui se répondent et un second plan aux lignes qui partent du centre ; la fin sur un noir bleuté, son nom en petit serif blanc au milieu comme une signature, et deux temps après une ligne rouge plus petite dessous. En horizontal comme l'original quand ses vidéos le sont.",
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
      want: "facultatif : une ligne plus petite en rouge sous la première, qui arrive deux temps après : son compte, son quartier ou sa ville (une forme comme « @studio.ciel », « Lyon 2e »)",
      max: 28,
      required: false,
    },
  ],
  objects: [
    {
      slot: "coeur",
      shot: 0,
      want: "le petit élément au cœur du plan qui ouvre, là où ses lignes se rejoignent, que le petit carré du milieu cadre : la suspension du plafond, une assiette, une tasse, un gâteau, un bouquet, un kiosque, la porte au bout de l'allée, la personne au centre ; vide quand rien n'y est au centre",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, comme l'original" },
        { value: "vertical", says: "vertical plein écran, l'étoile tournée d'un quart" },
      ],
    },
    {
      name: "fond",
      want: "la couleur du fond de l'étoile et du cadre",
      choices: [
        { value: "bordeaux", says: "le bordeaux profond de l'original" },
        { value: "sienne", says: "sa couleur foncée à elle (celle de sa charte ; le bordeaux si elle n'en a pas)" },
      ],
    },
  ],
  // Its code draws her shots in black and white on its bordeaux, with their blue blacks and their whites held: nothing
  // of its model's finish is laid over it all (its grey turned the bordeaux and the red line grey, its grain is not the
  // original's, its contrast crushed the blue blacks).
  finish: { saturation: 0, contrast: 0, grain: 0, vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(FEWEST, Math.min(MOST, n));
    // Its two-beat shots for this count (the split screen's two halves on one of them, its right half the black's file):
    // fewer drop those with no part to play first; more are moments of her place before the echo.
    const slots = SLOTS.map((want, i) => ({ want, i })).filter((s) => !DROPS.slice(0, Math.max(0, ORIGINAL - count)).includes(s.i));
    if (count > ORIGINAL) slots.splice(slots.findIndex((s) => s.i === ECHO), 0, ...Array.from({ length: count - ORIGINAL }, () => ({ want: MORE, i: -1 })));
    // The black: eight beats and a half, or six before her ending card's 1,6 s (so the card lands on a beat).
    const spans = beatSpans(bpm, [OPENING, ...slots.map(() => EACH), end ? BEFORE_CARD + END_CARD / beat : BLACK]);
    const duration = spans.at(-1)!.end;
    const blackAt = spans.at(-1)!.start;
    const at = slots.findIndex((s) => s.i === SPLIT) + 1;
    const split = spans[at]!;
    const until = end ? round(duration - END_CARD) : duration;
    const wants = [
      "le plan qui ouvre, tenu quatre secondes et demie : un plan avec un centre et des lignes qui en partent, son cœur bien au milieu de l'image (vu d'en haut : sa table, une assiette, son comptoir, un cours vu du plafond ; d'en bas : son plafond, une suspension, une verrière ; en perspective : une allée, un couloir, un comptoir qui file) ; on le voit d'abord par une étoile de fenêtres, une par temps, puis en entier",
      ...slots.map((s) => s.want),
      `le plan qui répond au ${at + 1}e, montré à côté de lui en écran partagé pendant deux temps : le cœur de son lieu ou ce qu'il y a dedans (son comptoir, sa vitrine, le résultat du geste) ; on ne le voit qu'à ce moment-là`,
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its words are on the black only: her name at once, its red line two beats later (both to her card, when she has one).
      texts: { signature: { from: blackAt, to: until }, ligne: { from: round(onFrame(blackAt + LINE_AFTER * beat)), to: until } },
      // Its music as the original's: a hit of it on each beat before the drop, through a small speaker (its intro's
      // sound is all between 400 and 1 800 Hz), silent after each one; all of it, open, on the drop; going on under the
      // black and cut with a short fade at the end.
      music: {
        pauses: Array.from({ length: DROP }, (_, k) => ({ from: round3((k + HIT) * beat), to: round3((k + 1) * beat) })),
        filters: [{ kind: "radio", from: 0, to: round3(DROP * beat) }],
        end: { at: duration, fade: round(FADE * beat) },
      },
      marks: {
        beat: beat * 30,
        whole: toFrame(DROP * beat),
        split: toFrame(split.start),
        split_to: toFrame(split.end),
        black: toFrame(blackAt),
      },
    };
  },
  code: CODE,
};
