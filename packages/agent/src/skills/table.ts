import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Photos posées sur la table », written on its original (house/originals/table.mp4, 8,9 s at 110 BPM, a restaurant,
// looked at image by image): its table filmed still, a white cloth and red napkins in a dark room; for a moment it is
// bare, then two small words written by hand fade in, white, on either side of its middle (« this is » on the left,
// its name on the right); her photos land on it one after the other, cut in every sixth of a beat, borderless prints
// in portrait, each a little turned (left, right, in turn) and off centre, piled up; the pile held a beat, it fades
// away and the table is bare again; two quick shots of the place (a chandelier, a napkin in a whip), the words still
// there; then a split screen, two shots at once cutting together about every beat and a quarter (the room, a dish);
// last a close-up of a dish, full frame, held two seconds. Made vertical: its split screen is two halves one above
// the other (her photos and her videos lose half of what they show in tall strips), the dish above, clear of the
// apps' caption; each half plays its passage at half speed over its pair (a Reel's slots are one after the other: two
// shots at once share their time), the table's video a little slowed over the whole opening while the prints, still,
// take a slot each. Its ending card (an offer, an announcement) is set in the serif over the last close-up, darkened.

const BPM = 110;
/** The opening in beats: the bare table, a print every sixth of a beat, the full pile held, its fading, the bare table. */
const BARE = 0.75;
const PRINT_EVERY = 1 / 6;
const HOLD = 1;
const FADE = 0.25;
const BARE_AFTER = 0.125;
/** A print's slot (its picture is still: the table plays on under the prints over the whole opening). */
const PRINT_SLOT = 1 / 8;
/** The two quick shots of the place, the split screen's pairs (in turn), the close-up that ends it (beats). */
const QUICK = [0.5, 0.5];
const PAIRS = [1.5, 1];
const FINAL = 4;
/** With an ending card: beats more on the last close-up (at least the engine's 1,6 s). */
const CARD = 3;
const CARD_SECONDS = 1.6;
/** The words written by hand fade in this many beats in. */
const WORDS_AT = 0.6;
const round = (s: number) => Math.round(s * 100) / 100;

/** For n shots: its prints and its split screen's pairs (the table, two quick shots and the close-up besides). */
function parts(n: number): { prints: number; pairs: number } {
  const pairs = Math.max(2, Math.min(6, Math.floor((n - 6) / 3)));
  return { prints: Math.max(1, Math.min(9, n - 4 - 2 * pairs)), pairs };
}

/** The opening's length in beats for that many prints, its cut on a half beat. */
const openingBeats = (prints: number) => Math.ceil((BARE + (prints - 1) * PRINT_EVERY + HOLD + FADE + BARE_AFTER) * 2) / 2;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const n = shots.length;
  const BEAT = mark("beat", 16.36);
  const P = Math.max(0, Math.min(n - 2, Math.round(mark("prints", Math.max(1, Math.min(9, n - 8))))));
  const FIRST = mark("first", Math.round(0.75 * BEAT));
  const STEP = mark("step", BEAT / 6);
  const OPEN = n > P + 1 ? shots[P + 1].from : durationInFrames;
  const FADE_AT = mark("fade", OPEN - Math.round(0.375 * BEAT));
  const FADE = Math.max(2, Math.round(0.25 * BEAT));
  const QUICK = P + 1;
  const SPLIT = P + 3;
  const LAST = n - 1;
  const SPLIT_AT = SPLIT < LAST ? shots[SPLIT].from : shots[LAST].from;
  const FINAL_AT = n ? shots[LAST].from : durationInFrames;
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: ease });
  const display = "'" + brand.displayFont + "', 'Instrument Serif', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const hand = "'Shadows Into Light', '" + brand.bodyFont + "', cursive";
  const shade = "0 1px 2px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.4), 0 2px 14px rgba(0,0,0,0.35)";
  const box = { position: "absolute", left: 0, top: 0, width, height };
  const isVideo = (i) => shots[i] && shots[i].kind === "video";
  // A video played slower than filmed (speed under 1) from a frame: each of its images is shown a little longer, the
  // next one blended in over it, so the slow motion stays smooth.
  const slowed = (shot, from, speed, style, key) => {
    const t = Math.max(0, frame - from) * speed;
    const k = Math.floor(t);
    const mix = isVideo(shot) ? t - k : 0;
    return h(React.Fragment, { key },
      h(Footage, { shot, at: frame - k, style }),
      mix > 0.02 ? h(Footage, { shot, at: frame - k - 1, style: { ...style, opacity: mix } }) : null);
  };

  // 1. The opening: her table, a little slowed so its passage lasts the whole opening (its prints, still, take a
  // slot each in the Reel's time).
  let film = null;
  if (frame < OPEN && n) {
    film = slowed(0, 0, Math.min(1, shots[0].durationInFrames / Math.max(1, OPEN)), box, "table");
  } else if (frame < SPLIT_AT && QUICK < LAST) {
    // 3. Two quick shots of the place, full frame, as filmed.
    const i = frame < shots[Math.min(LAST, QUICK + 1)].from ? QUICK : Math.min(LAST, QUICK + 1);
    film = h(Footage, { shot: i, style: box });
  } else if (frame < FINAL_AT) {
    // 4. The split screen: two halves, one above the other, cutting together; each plays its passage at half speed
    // over its pair (the dish above, clear of the apps' caption; the place below).
    const pair = Math.max(0, Math.floor((shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0) - SPLIT) / 2));
    const a = Math.min(LAST - 1, SPLIT + 2 * pair);
    const b = Math.min(LAST - 1, a + 1);
    const from = shots[a].from;
    const half = Math.round(height / 2);
    const pane = (shot, top, hh, key) => h("div", { key, style: { position: "absolute", left: 0, top, width, height: hh, overflow: "hidden" } },
      slowed(shot, from, 0.5, { position: "absolute", left: 0, top: 0, width, height: hh }, key + "f"));
    film = h(React.Fragment, null, pane(a, 0, half, "top"), b !== a ? pane(b, half, height - half, "bottom") : null);
  } else if (n) {
    // 5. The close-up that ends it, full frame, held.
    film = h(Footage, { shot: LAST, style: box });
  }

  // 2. Her photos laid one after the other on the table, borderless prints in portrait, each turned a little (left,
  // right, in turn) and off centre, with a soft shadow; a video shows one of its images. The pile held, then it fades.
  const PW = 450;
  const PH = 600;
  const PX = Math.round(width / 2);
  const PY = 880;
  const pileOut = 1 - o(FADE_AT, FADE_AT + FADE);
  const prints = frame < OPEN && pileOut > 0
    ? Array.from({ length: P }, (_, k) => {
        const at = Math.round(FIRST + k * STEP);
        if (frame < at) return null;
        const side = k % 2 ? 1 : -1;
        const turn = k === 0 ? (random("table-r-0") * 2 - 1) * 2 : side * (4 + random("table-r-" + k) * 8);
        const dx = Math.round((random("table-x-" + k) * 2 - 1) * 30);
        const dy = Math.round((random("table-y-" + k) * 2 - 1) * 26);
        return h("div", { key: "p" + k, style: { position: "absolute", left: PX - PW / 2 + dx, top: PY - PH / 2 + dy, width: PW, height: PH, transform: "rotate(" + turn.toFixed(2) + "deg)", boxShadow: "0 12px 28px rgba(0,0,0,0.45), 0 2px 5px rgba(0,0,0,0.3)", overflow: "hidden", opacity: pileOut } },
          h(Footage, { shot: k + 1, at: durationInFrames * 4 + 1000, style: { position: "absolute", left: 0, top: 0, width: PW, height: PH } }));
      })
    : null;

  // Its two words written by hand, white, on either side of the pile's middle (the first on the left, against it; her
  // name on the right), fading in on the bare table; they stay over the quick shots and go with the split screen.
  // Above the middle, clear of the apps' buttons, a little over the pile's edges; a long one on two lines rather than smaller.
  const hook = reelTexts.find((t) => t.role === "hook");
  const lead = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== lead);
  const wordStyle = { fontFamily: hand, fontWeight: 400, fontSize: 66, lineHeight: 1.06, letterSpacing: "0.04em", color: "#ffffff", textShadow: shade, whiteSpace: "normal", textWrap: "balance" };
  const unbroken = (text) => h("span", { style: { display: "block" } }, String(text || "").split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || !w ? w : h("span", { key: i, style: { whiteSpace: "nowrap" } }, w))));
  const written = (t, left, align, key) => t && frame >= t.from && frame < Math.min(t.to, endAt)
    ? h(FitText, { key, style: { position: "absolute", left, top: 780, width: 330, height: 165 }, innerStyle: { ...wordStyle, alignItems: align, textAlign: align === "flex-end" ? "right" : "left" } },
        h("span", { style: { display: "inline-block", opacity: o(t.from, t.from + Math.round(0.25 * BEAT)) } }, unbroken(t.text)))
    : null;
  const words = [written(lead, 40, "flex-end", "lead"), written(hook, width - 370, "flex-start", "name")];

  // Any other text of the Reel (none in its slots): a plain line at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 170 + i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 54, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: shade } }, t.text));

  // Its ending card: the close-up darkened, its title in the serif, its line under it in small spaced capitals.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, { style: { backgroundColor: "rgba(10,4,2," + (0.55 * o(endAt, endAt + 8)).toFixed(3) + ")" } },
        h(FitText, { style: { position: "absolute", left: 140, top: 560, width: width - 280, height: 440 }, innerStyle: { justifyContent: "flex-end", fontFamily: display, fontWeight: 400, fontSize: 132, lineHeight: 1.02, letterSpacing: "-0.01em", color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade } },
          h("span", { style: { display: "inline-block", opacity: o(endAt + 2, endAt + 10) } }, unbroken(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1030, width: width - 280, height: 200 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.2, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade } },
              h("span", { style: { display: "inline-block", opacity: o(endAt + 8, endAt + 16) } }, unbroken(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#0b0706" } }, film, prints, words, extra, ending);
}`;

export const table: MontageSkill = {
  key: "table",
  version: 1,
  bpm: BPM,
  shots: [12, 25],
  files: [5, 12],
  how: "Sa table filmée fixe ; deux petits mots écrits à la main apparaissent en blanc de part et d'autre de son milieu (à gauche ce qui amène son nom, à droite son nom) ; ses photos s'y posent une à une, très vite, comme des photos tirées sans bord, chacune un peu tournée, en pile ; la pile tenue un temps s'efface, puis deux plans rapides de son lieu, les mots toujours là ; puis un écran partagé en deux, un plat en haut et son lieu en bas, qui coupent ensemble sur le temps, au ralenti ; enfin le gros plan d'un plat tenu jusqu'à la fin.",
  end: true,
  texts: [
    { slot: "gauche", role: "caption", want: "les petits mots écrits à la main à gauche de la pile, qui amènent son nom (une forme comme « voici », « ici c'est », « ce soir chez »)", max: 14, required: true },
    { slot: "droite", role: "hook", want: "son nom, écrit à la main à droite de la pile (court : le mot qui la distingue quand il est long, « Farine » pour « Maison Farine »)", max: 16, required: true },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const { prints, pairs } = parts(n);
    const open = openingBeats(prints);
    // The table's slot and its prints' fill the opening; then the quick shots, the pairs (each half half the pair), the
    // close-up (longer with an ending card, which lasts the engine's 1,6 s at least, whatever the tempo).
    const halves = Array.from({ length: pairs }, (_, j) => PAIRS[j % PAIRS.length]! / 2).flatMap((b) => [b, b]);
    const beats = [open - prints * PRINT_SLOT, ...Array.from({ length: prints }, () => PRINT_SLOT), ...QUICK, ...halves, FINAL + (end ? Math.max(CARD, CARD_SECONDS / beat) : 0)];
    const spans = beatSpans(bpm, beats.slice(0, n));
    const duration = spans.at(-1)!.end;
    const splitAt = spans[prints + 1 + QUICK.length]!.start;
    const wants = [
      "sa table ou son comptoir, filmé fixe et de près, la nappe ou le plan de travail au milieu de l'image (ses photos s'y posent une à une) ; joué un peu ralenti pendant toute l'ouverture",
      ...Array.from({ length: prints }, () => "une photo de ses plats ou de ses produits, posée comme une photo tirée au milieu de la table, en portrait (une photo de préférence : une vidéo n'y montre qu'une image)"),
      "un plan rapide de son lieu : une lumière, un détail, un mouvement",
      "un autre plan rapide de son lieu, en mouvement",
      ...Array.from({ length: pairs }, () => [
        "un plat ou un produit de près, dans la moitié haute de l'écran partagé (joué au ralenti, en même temps que le plan du dessous)",
        "son lieu, la salle, l'équipe ou les clients, dans la moitié basse de l'écran partagé (joué au ralenti, en même temps que le plat du dessus)",
      ]).flat(),
      "le gros plan d'un plat ou d'un produit qui finit le Reel, en plein écran, tenu jusqu'à la fin",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its words fade in on the bare table and go with the split screen.
      texts: { gauche: { from: round(WORDS_AT * beat), to: splitAt }, droite: { from: round(WORDS_AT * beat), to: splitAt } },
      marks: { beat: beat * 30, prints, first: toFrame(BARE * beat), step: PRINT_EVERY * beat * 30, fade: toFrame((open - FADE - BARE_AFTER) * beat) },
    };
  },
  code: CODE,
  fonts: ["Shadows Into Light"],
};
