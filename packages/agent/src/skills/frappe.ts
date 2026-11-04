import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Lieu tapé lettre à lettre », version 2, written again on its original's fiche (docs/fiches/frappe.md: measured image
// by image at 30 i/s, its music measured, the video watched and heard by Gemini; Tristan: « ton analyse préalable des
// reels manque réellement », « tu n'as pas tout vu, il y a des trucs qui clignotent », « c'est un effet que l'on veut
// pouvoir faire, pas exactement reproduire l'image »). Its music is a lo-fi beat at 82,5 BPM (Gemini heard 95), and
// every length below is in its beats, so its cuts fall where the original's do (within an image) on its own music:
//   0 – 2,25    a wide sunny shot of the place (the original's quick zoom in is a plain cut: Tristan finds them cheap);
//   2,25 – 6,75 the same place closer: what can light up in it (her sign's letters, each window, a garland: named by
//               the filler from what the file shows) lights up piece by piece, 2 or 3 images each, then all of it at
//               once for 6 images on beat 6, its bright parts blooming;
//   6,75 – 10,75 a fixed shot with sky beside a building: her name typed by hand in red-orange capitals (a character
//               a third of a beat or so, a pause in the middle and before the last letter), then her logo drawing
//               itself around it, the cut landing on her sign (the match cut);
//   10,75 – 11,5 her shop front at night or lit, its sign and lights blinking on for 3 images just after the cut;
//   three flash shots, a wide shot of life, a front with cinema bars closing over it, a burst of six shots between the
//   bars on the snare roll (a passer-by flashing white), black.
// Played horizontal as the original when her videos are horizontal (or she asks), else full frame.

const BPM = 82.5;
/** Its sections, in beats of its music. */
const OPENING = 2.25;
const CLOSER = 4.5;
const SKY = 4;
const REVEAL = 0.75;
const FLASHES = [0.3, 0.25, 0.3];
const WIDE = 1.65;
const BOXED = 2;
/** Everything lights up at once on this beat of the Reel (the snare of beat 6), for 6 images. */
const FLASH_BEAT = 6;
/** The pieces light up one after the other, each this long (beats: 2,5 images at its tempo), and go dark this long before it all lights up. */
const PIECE = 0.1125;
const DARK = 0.32;
/** In the night shot: its lights blink on this far after the cut (beats), for 3 images. */
const BLINK = 0.225;
/** In the sky shot: the name starts typing here, a character every TYPE_STEP (beats, the original's own hand); its logo draws itself from STROKE_FROM to the cut. */
const TYPE_FROM = 0.77;
const TYPE_STEP = 0.29;
const TYPE_MOST = 2.5;
const STROKE_FROM = 3.42;
/** The bars close this far into the boxed shot, over this long (beats). */
const BARS_FROM = 1;
const BARS_LENGTH = 0.35;
/** The burst at the end: a shot every 0,23 beat (5 images at its tempo), then black. */
const BURST = 0.23;
const BLACK = 1.03;
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const FLASH = mark("flash", -100);
  const PIECE = Math.max(1, mark("piece", 2.5));
  const DARK = Math.max(1, Math.round(mark("dark", 7)));
  const BLINK_AT = mark("blink", -100);
  const TYPE_AT = mark("type", 0);
  const TYPE_STEP = Math.max(2, mark("type_step", 6));
  const TYPE_MOST = mark("type_most", 52);
  const STROKE_AT = mark("stroke", 0);
  const REVEAL_AT = mark("reveal", durationInFrames);
  const BARS_AT = mark("bars", durationInFrames + 1);
  const BARRED_AT = mark("barred", BARS_AT + 6);
  const WHITE_AT = mark("white", -100);
  const BLACK_AT = mark("black", durationInFrames);
  const endAt = end ? end.from : durationInFrames + 1;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

  // Its frame: horizontal 16:9 on black as the original when her videos are mostly horizontal (or she asks), else the
  // whole vertical frame; every place below is a share of it.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };

  // Its colours: the original's red-orange and yellow, or hers.
  const own = setting("couleur", "original") === "sienne";
  const RED = own && brand.accent ? brand.accent : "#ff2b00";
  const YELLOW = own ? ((brand.palette && brand.palette.light) || "#ffcc00") : "#ffcc00";
  const display = "'" + brand.displayFont + "', 'Montserrat', 'Poppins', 'Arial Black', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const name = hook ? keep(hook.text).toUpperCase() : "";
  const chars = letters(name);

  // 1. Her shots in its frame, cut on its beats; black at the end.
  const shot = (k) => h(Footage, { shot: k, style: { left: 0, top: 0, width: bw, height: bh } });
  const film = frame < BLACK_AT ? shot(cur) : null;

  // 2. What lights up in the closer shot (her sign's letters, each window, a garland: what the filler saw there, cut
  // out at every image): its pieces one after the other, 2 or 3 images each, then dark, then all of it at once on the
  // beat for 6 images, its bright parts blooming. Lit: its own picture brighter, paler, with a warm halo.
  const litStyle = { position: "absolute", left: 0, top: 0, width: bw, height: bh, filter: "brightness(1.85) saturate(0.55) contrast(1.05) drop-shadow(0 0 " + Math.round(bh * 0.008) + "px rgba(255,238,205,0.95))" };
  // (Each object written with its shot as a number, so the engine follows it in that shot before the render.)
  const lit = (cutOut, clip) => h("div", { style: { ...litStyle, ...(clip ? { clipPath: clip } : {}) } }, cutOut);
  const sign = () => h(Subject, { shot: 1, object: "@lumieres", style: { left: 0, top: 0, width: bw, height: bh } });
  const night = () => h(Subject, { shot: 3, object: "@nuit", style: { left: 0, top: 0, width: bw, height: bh } });
  const pieces = cur === 1 ? SubjectParts(shots[1], frame, laid, "@lumieres", Math.max(4, Math.min(12, chars.filter((c) => /\S/.test(c) && c !== "-").length || 8))) : [];
  const chaseFrom = FLASH - DARK - pieces.length * PIECE;
  const piece = pieces.length && frame >= chaseFrom && frame < FLASH - DARK ? Math.floor((frame - chaseFrom) / PIECE) : -1;
  const p = piece >= 0 ? pieces[Math.min(pieces.length - 1, piece)] : null;
  const pad = Math.round(bh * 0.006);
  const chase = p ? lit(sign(), "inset(" + Math.max(0, Math.round(p.y - pad)) + "px " + Math.max(0, Math.round(bw - p.x - p.w - pad)) + "px " + Math.max(0, Math.round(bh - p.y - p.h - pad)) + "px " + Math.max(0, Math.round(p.x - pad)) + "px)") : null;
  const flashing = frame >= FLASH && frame < FLASH + 6 && frame < BLACK_AT;
  const allLit = flashing && cur === 1 ? lit(sign()) : null;
  // The night shot's sign and lights blink on for 3 images just after its cut.
  const blinking = frame >= BLINK_AT && frame < BLINK_AT + 3 && frame < BLACK_AT;
  const nightLit = blinking && cur === 3 ? lit(night()) : null;
  // Its bright parts bloom with them (a brightened, contrasted, blurred copy laid over in screen), its darks untouched.
  const bloomK = flashing ? interpolate(frame, [FLASH, FLASH + 1, FLASH + 4, FLASH + 6], [0, 1, 0.85, 0], clamp) : blinking ? (frame === BLINK_AT + 1 ? 0.7 : 0.5) : 0;
  const bloom = bloomK > 0
    ? h("div", { style: { position: "absolute", left: 0, top: 0, width: bw, height: bh, mixBlendMode: "screen", opacity: 0.85 * bloomK, filter: "brightness(2.1) contrast(2.8) saturate(1.2) blur(" + Math.round(bh * 0.006) + "px)" } }, shot(cur))
    : null;

  // 3. Her name typed by hand in the sky, a character on each step (its hyphens and spaces too, the whole name laid out
  // from the start so nothing moves as it types), a pause in the middle and before the last letter: extra-bold
  // capitals, red-orange, a thin light edge and a soft shadow.
  const steps = chars.map((_, i) => (i === 0 ? 0 : i === chars.length - 1 && chars.length > 2 ? 1.65 : chars.length >= 6 && i === Math.floor(chars.length / 2) ? 1.8 : 1));
  const total = steps.reduce((a, b) => a + b, 0);
  const step = total > 0 ? Math.min(TYPE_STEP, TYPE_MOST / total) : TYPE_STEP;
  const shows = []; let acc = TYPE_AT;
  for (let i = 0; i < chars.length; i++) { acc += steps[i] * step; shows.push(Math.round(acc)); }
  const nameSize = wide ? Math.round(bh * 0.081) : Math.min(150, Math.max(72, Math.round(2300 / Math.max(6, chars.length))));
  const edge = "#fff4d6";
  const nameStyle = {
    fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: nameSize, lineHeight: 1, letterSpacing: "0.01em", color: RED, whiteSpace: "nowrap",
    textShadow: "1px 0 0 " + edge + ", -1px 0 0 " + edge + ", 0 1px 0 " + edge + ", 0 -1px 0 " + edge + ", 0 " + Math.round(nameSize * 0.06) + "px " + Math.round(nameSize * 0.12) + "px rgba(0,0,0,0.35)",
  };
  // Where the original sets it: its left edge at 38,8 % of the frame, its top at 34,3 % (the sky beside a building);
  // full frame, a little lower in the upper third, wide enough for a long name.
  const nx = Math.round(bw * (wide ? 0.388 : 0.12));
  const ny = Math.round(bh * (wide ? 0.343 : 0.3));
  const nw = Math.round(bw * (wide ? 0.57 : 0.76));
  const nh = Math.round(nameSize * 1.3);
  const showing = hook && frame >= TYPE_AT && frame < Math.min(REVEAL_AT, BLACK_AT);
  const typed = showing
    ? h(FitText, { style: { position: "absolute", left: nx, top: ny, width: nw, height: nh }, innerStyle: { ...nameStyle, justifyContent: "flex-start", textAlign: "left" } },
        h("span", null, chars.map((c, i) => h("span", { key: i, style: { opacity: frame >= shows[i] ? 1 : 0 } }, c))))
    : null;

  // 4. Its logo draws itself around the name, then the cut lands on her sign: her logo when she has one (wiped in),
  // else a yellow stroke drawn as the original's arrow (up from under the name, over it to the right).
  const strokeK = interpolate(frame, [STROKE_AT, Math.max(STROKE_AT + 1, REVEAL_AT - 1)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const textW = Math.min(nw, Math.round(chars.length * nameSize * 0.68));
  const logo = showing && frame >= STROKE_AT
    ? brand.logoUrl
      ? h("div", { style: { position: "absolute", left: nx, top: Math.round(ny - nameSize * 1.25), width: textW, height: Math.round(nameSize * 1.1), clipPath: "inset(0 " + Math.round((1 - strokeK) * 100) + "% 0 0)" } },
          h(Img, { src: brand.logoUrl, style: { width: "100%", height: "100%", objectFit: "contain", objectPosition: "left center" } }))
      : h("svg", { width: bw, height: bh, style: { position: "absolute", left: 0, top: 0, overflow: "visible" } },
          h("path", {
            d: "M " + (nx + textW * 0.3) + " " + (ny + nameSize * 1.15) + " L " + (nx + textW * 0.04) + " " + (ny - nameSize * 0.4) + " L " + (nx + textW * 1.02) + " " + (ny - nameSize * 0.4),
            fill: "none", stroke: YELLOW, strokeWidth: Math.max(6, Math.round(nameSize * 0.16)), strokeLinejoin: "miter", strokeLinecap: "butt",
            pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - strokeK,
            style: { filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" },
          }))
    : null;

  // 5. A passer-by flashing white for two images, on the first shot of the burst (her subject when one is cut out).
  const white = frame >= WHITE_AT && frame < WHITE_AT + 2 && frame < BLACK_AT ? h(Subject, { shot: cur, fill: "#ffffff", style: { left: 0, top: 0, width: bw, height: bh } }) : null;

  // 6. Cinema bars closing to 2,35:1 over the front shot, kept to the end (full frame: an eighth of the height each).
  const BAR = wide ? Math.round((bh - bw / 2.35) / 2) : Math.round(bh * 0.125);
  const bar = frame >= BARS_AT && frame < BLACK_AT ? Math.round(BAR * interpolate(frame, [BARS_AT, Math.max(BARS_AT + 1, BARRED_AT)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) })) : 0;
  const bars = bar > 0
    ? h(React.Fragment, null,
        h("div", { style: { position: "absolute", left: 0, top: 0, width: bw, height: bar, background: "#000000" } }),
        h("div", { style: { position: "absolute", left: 0, top: bh - bar, width: bw, height: bar, background: "#000000" } }))
    : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film, bloom, chase, allLit, nightLit, white, typed, logo, bars);

  // Any other text of the Reel (none in its slots): a plain white line under its frame, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < Math.min(endAt, BLACK_AT)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: Math.min(1300, (wide ? by + bh + 40 : 1220) + i * 120), height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, t.text));

  // 7. Its ending card on the black: its title typed in the name's red-orange with its light edge, a white line under it.
  const titleChars = end ? letters(keep(end.title)) : [];
  const titleIn = endAt + 2;
  const titleStep = titleChars.length > 1 ? Math.max(1, Math.min(4, Math.floor(14 / (titleChars.length - 1)))) : 1;
  const titleDone = titleIn + titleStep * Math.max(0, titleChars.length - 1);
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 640 : 720, width: width - 280, height: 240 }, innerStyle: { ...nameStyle, fontSize: 104, whiteSpace: "normal", textWrap: "balance", lineHeight: 1.04, textAlign: "center", justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", null, titleChars.map((c, i) => h("span", { key: i, style: { opacity: frame >= titleIn + i * titleStep ? 1 : 0 } }, c)))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 904, width: width - 280, height: 170 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.22, color: "#ffffff", textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [titleDone, titleDone + 5], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra, ending);
}`;

export const frappe: MontageSkill = {
  key: "frappe",
  // 2: written again on its original's fiche (its format, its music, its lights, its typing, its logo, its bars, its burst).
  version: 2,
  bpm: BPM,
  shots: [12, 18],
  files: [5, 12],
  how: "Un plan large et ensoleillé de son lieu, puis le même plus serré, où ce qui peut s'allumer (les lettres de son enseigne, ses fenêtres, une guirlande) s'allume morceau par morceau puis d'un coup sur un temps ; un plan fixe avec du ciel à côté d'un bâtiment, où son nom se tape à la main en capitales rouge orangé, puis son logo (ou un trait jaune) se dessine autour, et la coupe tombe sur son enseigne de nuit, qui clignote ; trois plans éclair, un plan large, une façade sur laquelle des bandes de cinéma se ferment, six plans éclair entre les bandes, un passant qui flashe en blanc, et le noir. En horizontal comme l'original quand ses vidéos le sont.",
  end: true,
  texts: [
    {
      slot: "lieu",
      role: "hook",
      want: "le nom de son lieu tel qu'on le lit sur son enseigne (il se tape en capitales, lettre à lettre, juste avant qu'on voie l'enseigne)",
      max: 18,
      required: true,
    },
  ],
  objects: [
    { slot: "lumieres", shot: 1, want: "ce qui peut s'allumer morceau par morceau dans ce plan : les lettres de son enseigne, un néon, chaque fenêtre d'une façade (« every window »), une guirlande, des lampes" },
    { slot: "nuit", shot: 3, want: "ce qui s'allume dans sa devanture de nuit ou éclairée : son enseigne, son néon, ses lampes, ses vitrines" },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos (horizontal si elles le sont)" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, comme l'original" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur du nom tapé et de son trait",
      choices: [
        { value: "original", says: "rouge orangé et jaune, comme l'original" },
        { value: "sienne", says: "ses couleurs à elle (celles de sa charte)" },
      ],
    },
  ],
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    // The burst at the end takes the shots past the twelve of its sections (the original: six).
    const count = Math.max(12, Math.min(18, n));
    const burst = count - 9;
    // The black at the end, or the ending card's time (on the beat grid) when the Reel ends on one.
    const black = end ? Math.max(BLACK, Math.ceil(((END_CARD + 0.05) / beat) * 4) / 4) : BLACK;
    const beats = [OPENING, CLOSER, SKY, REVEAL, ...FLASHES, WIDE, BOXED, ...Array.from({ length: burst }, (_, i) => BURST + (i === burst - 1 ? black : 0))];
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const sky = spans[2]!;
    const reveal = spans[3]!;
    const boxed = spans[8]!;
    const burstAt = spans[9]!.start;
    const blackAt = round(duration - black * beat);
    const wants = [
      "le plan qui ouvre : large, ensoleillé, son lieu ou sa rue avec son enseigne, la caméra qui avance un peu",
      "son lieu plus serré, avec ce qui peut s'allumer : son enseigne (des lettres séparées ou un néon, c'est mieux), ses fenêtres, une guirlande, des lampes",
      "un plan fixe avec beaucoup de ciel ou de mur dégagé en haut, à côté d'un bâtiment : son nom s'y tape dans le vide",
      "sa devanture avec son enseigne, de nuit ou éclairée, l'enseigne dans le haut de l'image : là où son nom vient de se taper",
      "un plan éclair de l'intérieur ou d'un détail, sur le temps",
      "un plan éclair d'un détail, d'une enseigne ou d'un produit",
      "un plan éclair de sa rue ou de son lieu",
      "un plan large et vivant : du monde, une rue animée, une salle pleine",
      "une façade de face, large : des bandes de cinéma se ferment dessus",
      ...Array.from({ length: burst }, (_, i) => (i === 0 ? "un plan éclair avec un passant au premier plan (il flashe en blanc)" : i < burst - 1 ? "un plan éclair et ensoleillé de sa rue, de son lieu ou d'un détail, entre les bandes" : "le dernier plan éclair, juste avant le noir")),
    ];
    const frame = 1 / 30;
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The name types in the sky shot and goes with the cut on her sign.
      texts: { lieu: { from: round(sky.start + TYPE_FROM * beat), to: reveal.start } },
      marks: {
        flash: toFrame(FLASH_BEAT * beat),
        // Images: a piece lit, the dark before it all lights up, a character's step and the longest typing.
        piece: Math.round(((PIECE * beat) / frame) * 100) / 100,
        dark: Math.max(1, Math.round((DARK * beat) / frame)),
        blink: toFrame(reveal.start + BLINK * beat),
        type: toFrame(sky.start + TYPE_FROM * beat),
        type_step: Math.round(((TYPE_STEP * beat) / frame) * 100) / 100,
        type_most: Math.round((TYPE_MOST * beat) / frame),
        stroke: toFrame(sky.start + STROKE_FROM * beat),
        reveal: toFrame(reveal.start),
        bars: toFrame(boxed.start + BARS_FROM * beat),
        barred: toFrame(boxed.start + (BARS_FROM + BARS_LENGTH) * beat),
        white: toFrame(burstAt),
        black: toFrame(blackAt),
      },
    };
  },
  code: CODE,
};
