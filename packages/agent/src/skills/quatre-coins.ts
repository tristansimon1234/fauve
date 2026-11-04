import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Mots aux quatre coins », written on its original (house/originals/quatre-coins.mp4, 21,8 s at 93 BPM, looked at
// image by image): over the first shot of the place (someone at the counter, the centre left free), a sentence lands a
// word at a time on the frame's edges, cut in, all the same size, a creamy white grotesque in lower case: its first
// words along the top (left, middle, right), the business's name and its place on the middle of the left and right
// edges, its address along the bottom; they all leave on the first cut. Then the life of the place, cut on the beat,
// full frame; then its front, held to the end, its name landing alone in the middle. Its ending card (an offer, an
// announcement) is set the same way over the front, darkened. The words are never cut by the frame in the original.

const BPM = 93;
/** The first shot (the sentence on the edges) lasts this many beats; the words leave on its cut. */
const OPENING_BEATS = 8;
/** The words land this many beats apart (one every half second, as the original). */
const WORD_BEATS = 0.75;
/** The front, held: this many beats, and the name lands this many beats into it. */
const FRONT_BEATS = 7;
const NAME_BEATS = 2.5;
/** With an ending card (its last 1,6 s), the front is held half a beat longer and the name lands half a beat sooner. */
const END_FRONT_BEATS = 7.5;
const END_NAME_BEATS = 2;
/** How long its address (seven words at most, landing on the sixth word) and her name before the card are read at a glance (s). */
const ADDRESS_READ = 2.4;
const NAME_READ = 1.5;
/** The ending card: the Reel's last 1,6 s. */
const CARD = 1.6;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const STEP = mark("step", 14.5);
  const CUT = mark("cut", 155);
  const NAME_AT = mark("name", Math.max(CUT + 30, durationInFrames - 90));
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const byFrom = (a, b) => a.from - b.from;
  const captions = reelTexts.filter((t) => t.role === "caption").sort(byFrom);
  const opening = captions[0];
  const address = captions[1];
  const name = reelTexts.find((t) => t.role === "hook");
  const place = reelTexts.find((t) => t.role === "band");
  const others = reelTexts.filter((t) => t !== opening && t !== address && t !== name && t !== place);
  const endAt = end ? end.from : durationInFrames + 1;
  const on = (t, until) => t && frame >= t.from && frame < Math.min(t.to, until);
  // The original's creamy white with a soft shade, and a tight dark edge so it reads on a bright wall.
  const cream = "#EFE7D4";
  const shade = "0 1px 2px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.35), 0 2px 18px rgba(0,0,0,0.22)";
  const word = { fontFamily: display, fontWeight: 600, fontSize: 84, lineHeight: 1.04, letterSpacing: "-0.035em", color: cream, whiteSpace: "nowrap", textShadow: shade };
  const lower = { textTransform: "lowercase" };
  // A line that wraps never cuts a word at its hyphen (« rendez-vous » stays whole); its spaces are kept as they are, the
  // words held in one block so the box lays them out as one text.
  const unbroken = (text) => h("span", { style: { display: "block" } }, String(text || "").split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || !w ? w : h("span", { key: i, style: { whiteSpace: "nowrap" } }, w))));

  // 1. Her shots full frame, one after the other, each at its own moment.
  const footage = h(Footage, { shot: cur, style: { left: 0, top: 0, width, height } });

  // 2. The sentence on the edges, a word at a time, cut in. Each row is one box: its words keep the same size and their
  // places (the first on the left edge, the last on the right one), shrunk together for long words. A word not landed
  // yet is laid out already, unseen, so nothing moves when it lands.
  const first = opening ? opening.text.split(/\s+/).filter(Boolean) : [];
  const along = first.length > 3 ? [first[0], first[1], first.slice(2).join(" ")] : first;
  const topRow = on(opening, CUT)
    ? h(FitText, { style: { position: "absolute", left: 40, top: 84, width: width - 80, height: 104 }, innerStyle: { alignItems: "stretch" } },
        h("div", { style: { display: "flex", justifyContent: along.length > 1 ? "space-between" : "flex-start", alignItems: "baseline", gap: 36 } },
          along.map((w, i) => h("span", { key: i, style: { ...word, ...(i ? lower : {}), opacity: frame >= opening.from + Math.round(i * STEP) ? 1 : 0 } }, w))))
    : null;
  // Her name on the middle of the left edge, her place on the right one: clear of the apps' buttons (above the middle).
  const midRow = on(name, CUT) || on(place, CUT)
    ? h(FitText, { style: { position: "absolute", left: 40, top: 816, width: width - 80, height: 104 }, innerStyle: { alignItems: "stretch" } },
        h("div", { style: { display: "flex", justifyContent: name && place ? "space-between" : place ? "flex-end" : "flex-start", alignItems: "baseline", gap: 40 } },
          name ? h("span", { style: { ...word, ...lower, opacity: on(name, CUT) ? 1 : 0 } }, name.text) : null,
          place ? h("span", { style: { ...word, ...lower, opacity: on(place, CUT) ? 1 : 0 } }, place.text) : null))
    : null;
  // A line along the bottom (her address), as written, on two lines when it is long; above the apps' caption, with room
  // for a font whose letters reach far above and below their line.
  const bottomRow = on(address, CUT)
    ? h(FitText, { style: { position: "absolute", left: 140, top: 1266, width: width - 280, height: 152 }, innerStyle: { ...word, fontSize: 64, whiteSpace: "normal", textWrap: "balance", justifyContent: "flex-end" } }, unbroken(address.text))
    : null;

  // 3. Her front, held: her name lands alone in the middle, white, a little larger.
  const finalName = name && frame >= NAME_AT && frame < Math.min(name.to, endAt)
    ? h(FitText, { style: { position: "absolute", left: 140, top: 884, width: width - 280, height: 150 }, innerStyle: { ...word, ...lower, fontSize: 104, color: "#ffffff" } }, name.text)
    : null;

  // Any other text of the Reel (none in its slots): a plain line above the bottom one, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 1090, width: width - 280, height: 150 }, innerStyle: { ...word, fontSize: 60, whiteSpace: "normal", textWrap: "balance" } }, unbroken(t.text)));

  // 4. Its ending card: the front darkened, its title in the middle and its line along the bottom, cut in like its words.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, { style: { backgroundColor: "rgba(0,0,0," + (0.5 * Math.min(1, (frame - endAt + 1) / 6)).toFixed(3) + ")" } },
        h(FitText, { style: { position: "absolute", left: 140, top: 700, width: width - 280, height: 320 }, innerStyle: { ...word, fontSize: 92, lineHeight: 1.02, whiteSpace: "normal", textWrap: "balance", color: "#ffffff" } }, unbroken(end.title)),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1240, width: width - 280, height: 178 }, innerStyle: { ...word, fontSize: 56, lineHeight: 1.04, whiteSpace: "normal", textWrap: "balance", justifyContent: "flex-end", opacity: frame >= endAt + 8 ? 1 : 0 } }, unbroken(end.subtitle))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, footage, topRow, midRow, bottomRow, finalName, extra, ending);
}`;

const round = (s: number) => Math.round(s * 100) / 100;

export const quatreCoins: MontageSkill = {
  key: "quatre-coins",
  version: 1,
  bpm: BPM,
  shots: [6, 12],
  // Up to 22 for a length she asks for: about 30 s at its own tempo.
  long: 22,
  files: [4, 12],
  how: "Sur le premier plan du lieu, une phrase se pose mot à mot sur les bords du cadre, tous les mots à la même taille, en minuscules : ses premiers mots en haut (à gauche, au milieu, à droite), son nom au milieu du bord gauche et son quartier au milieu du bord droit, son adresse en bas ; ils partent sur la première coupe. Puis la vie du lieu en plein écran, coupée sur le temps ; puis sa devanture, tenue jusqu'à la fin, où son nom se pose seul au milieu.",
  end: true,
  texts: [
    { slot: "debut", role: "caption", want: "1 à 3 petits mots qui ouvrent la phrase, posés en haut à gauche, au milieu et à droite (une forme comme « un matin chez », « un samedi au », « une journée chez ») ; chacun court", max: 24, required: true },
    { slot: "nom", role: "hook", want: "son nom, posé au milieu du bord gauche, puis seul au milieu de sa devanture à la fin (il s'écrit en minuscules)", max: 14, required: true },
    { slot: "lieu", role: "band", want: "son quartier ou sa ville quand on les sait, sinon ce qu'elle est en un mot (« fleuriste », « atelier ») ; posé au milieu du bord droit (il s'écrit en minuscules)", max: 12, required: true },
    { slot: "adresse", role: "caption", want: "une ligne posée en bas : son adresse quand on la sait, sinon un repère concret qu'on sait (« ouvert dès 8 h »), sinon ce qu'elle fait en quelques mots (« fleurs de saison »)", max: 36, required: true },
  ],
  timeline(n, options) {
    const { end } = options;
    // At its own tempo, or at a music's when the Reel follows one: every length in beats, so a slower tempo makes it longer
    // and calmer, a faster one shorter, its cuts still on the beats.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    // The life of the place between the first shot and its front: two quick shots, then a beat and a half or a beat and a
    // quarter; past the tenth (a length she asked for), moments held two beats.
    const middle = Math.max(1, n - 2);
    const mids = Array.from({ length: middle }, (_, k) => (k < 2 ? 1 : k >= 10 ? 2 : k % 2 === 0 ? 1.5 : 1.25));
    // At a fast tempo a section is never shorter than its words need to be read (the address, her name before the card),
    // in whole beats or half beats so its cut stays on one; at its own tempo, its beats as written.
    const opening = Math.max(OPENING_BEATS, Math.ceil((5 * WORD_BEATS * beat + ADDRESS_READ) / beat));
    const front = end ? Math.max(END_FRONT_BEATS, Math.ceil(((END_NAME_BEATS * beat + NAME_READ + CARD) / beat) * 2) / 2) : FRONT_BEATS;
    const spans = beatSpans(bpm, [opening, ...mids, front]);
    const duration = spans.at(-1)!.end;
    const cut = spans[1]!.start;
    const frontAt = spans.at(-1)!.start;
    // A word every three quarters of a beat from the first image: its first words, then the name, the place, the address.
    const word = (k: number) => round(k * WORD_BEATS * beat);
    const wants = [
      "le premier plan du lieu, large et vivant : quelqu'un au comptoir ou au travail, au centre de l'image ; les mots se posent sur ses bords, son centre reste libre",
      ...mids.map(() => "un plan vivant du lieu, en plein écran : l'équipe au travail, les clients, un geste, un détail"),
      "sa devanture ou son entrée, large et calme, tenue jusqu'à la fin : son nom s'y pose au milieu",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: {
        debut: { from: word(0), to: cut },
        // Her name stays hers to the end: on the left edge with the sentence, then alone on her front.
        nom: { from: word(3), to: end ? round(duration - CARD) : duration },
        lieu: { from: word(4), to: cut },
        adresse: { from: word(5), to: cut },
      },
      marks: { step: WORD_BEATS * beat * 30, cut: toFrame(cut), name: toFrame(frontAt + (end ? END_NAME_BEATS : NAME_BEATS) * beat) },
    };
  },
  code: CODE,
};
