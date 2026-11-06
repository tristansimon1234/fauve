import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Teaser qui se charge » (`bientot`), version 1, written on its original's fiche (docs/fiches/bientot.md: Tristan's
// Reel of a sewing atelier, measured image by image at 30 i/s; its counter read value by value, its 64 flashes matched to
// one another, its sound by bands; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire
// l'image »). A teaser in dense black and white: 64 flashes of a tenth of a second (two or three images) of hands at work
// and materials, close; at the very centre a small white serif counter climbs on its own clock, 3 % every tenth of a
// second, from 1 % to 88 % (never 100: something is coming); her word takes its place (the original's « Coming soon »),
// the flashes faster, seven of the first ones back in a run, then her place; black, her logo with a roll of ticks, a
// deep boom, her name in small spaced capitals. Its music has no steady beat (a bed of mechanical clicks, three deep
// hits): its tempo is the grid of its cuts, 79 BPM, every one of its 64 cuts within an image of the original's. In beats
// from the start:
//   0 – 4        32 flashes of an eighth of a beat; the counter from 1 % to 88 % (each value 0,13 beat), gone at 3,9;
//   4 – 6        her word in its place, small at the centre; 18 flashes of a ninth of a beat (faster); from 5⅔ seven
//                earlier flashes again (the original reuses its clips), on a deep hit;
//   6 – 7¾       14 flashes of an eighth: the last four of that run, then her place (her shelves, her products, her room);
//   7¾ – 8½      black, her logo; a roll of ticks (25 a second) up to a deep boom on 8¼, the music muffled after it;
//   8½ – 10¾     her name in spaced capitals on the black (the original's is cut after four images: held here to read).
// The original's own (its round badge with a butterfly, « MAISON DE COUTURE », « MAISON LIFE », « Coming soon ») is never
// drawn: her logo, her name, her word. Her shots as filmed in their box (upright full frame, a horizontal one whole in a
// band on black as the original's one, a square one in its square), in black and white unless her words ask for her
// colours; her photos still. Its ending card (in option) follows her name on the black.

const BPM = 79;
/** Its flashes by section: their count and each one's length in beats (under the counter, after her word, in her place). */
const SECTIONS: [number, number][] = [
  [32, 1 / 8],
  [18, 1 / 9],
  [14, 1 / 8],
];
/** Each flash's start in beats, and the montage's end (its logo on the black, 7¾). */
const FLASHES: number[] = SECTIONS.reduce((out, [count, unit]) => {
  for (let i = 0; i < count; i++) out.push(out[out.length - 1]! + unit);
  return out;
}, [0]);
/**
 * The flashes that replay an earlier one, as the original reuses eight of its clips (flash → the flash it replays): its
 * still seen again two flashes later, then its run of seven earlier flashes, nearly backwards. The original's run took
 * flashes 34, 30, 18, 8, 7, 12 and 10; here two in a row are always 3 or 13 slots apart, so they come from two different
 * files whatever rotation of 4 to 12 files the filler made (the original's 34 then 30 were one file in a rotation of 4,
 * and its first render read as four held shots instead of seven flashes).
 */
const REPLAYS: Record<number, number> = { 37: 35, 47: 34, 48: 31, 49: 18, 50: 5, 51: 2, 52: 15, 53: 12 };
/** Its slots: the flashes that are not replays (56), in order. */
const SLOTS = FLASHES.slice(0, -1).flatMap((_, f) => (f in REPLAYS ? [] : [f]));
/** Its landmarks, in beats: the counter gone, her word, her logo on the black, the boom, her name, its end. */
const OFF = 3.9;
const WORD = 4;
const LOGO = FLASHES[FLASHES.length - 1]!;
const BOOM = 8.25;
const NAME = 8.5;
const LENGTH = 10.75;
/** Its two deep hits before the boom: on its eighth flash (0,66 s), and as the replays come back (5⅔, 4,30 s). */
const HITS = [FLASHES[7]!, FLASHES[47]!];
/** The engine's ending card: the Reel's last 1,6 s. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const W = width;
  const H = height;
  const n = shots.length;
  const BEAT = mark("beat", 22.785);
  const OFF = Math.max(30, Math.round(mark("off", 3.9 * BEAT)));
  const WORD = Math.max(OFF, Math.round(mark("word", 4 * BEAT)));
  const LOGO = Math.max(WORD + 1, Math.round(mark("logo", 7.75 * BEAT)));
  const NAME = Math.max(LOGO, Math.round(mark("name", 8.5 * BEAT)));
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', 'Playfair Display', serif";
  const body = "'" + brand.bodyFont + "', 'Jost', sans-serif";
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ").replace(/ (\d+(?:er|e))\b/g, " $1");
  // White words with no box, as the original's; a tight dark halo keeps them on a white shot (it hardly shows on a dark one).
  const SHADOW = "0 0 6px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.55)";
  const centred = (tall) => ({ position: "absolute", left: 140, top: Math.round(H / 2 - tall / 2), width: W - 280, height: Math.round(tall) });

  // 1. Her shots, one flash after the other as its slots fall (an eighth of a beat, a ninth after her word), each in its
  // box as filmed: upright full frame, a horizontal one whole in its band on black (as the original's one), a square one
  // in its square; or all full frame, or all in a 16:9 band, as her words ask. In dense black and white unless she wants
  // her colours (its blacks crushed, its whites held: a little lighter, then more contrast). Some flashes replay an
  // earlier slot from its first image, as the original reuses its clips.
  const format = setting("format", "vertical");
  const colour = setting("couleur", "noir-et-blanc") === "couleur";
  const GREY = "grayscale(1) brightness(1.06) contrast(1.22)";
  const FULL = { left: 0, top: 0, width: W, height: H };
  const band = (aspect) => { const bh = Math.round(W / aspect); return { left: 0, top: Math.round((H - bh) / 2), width: W, height: bh }; };
  const boxOf = (s) => {
    const a = Number(s && s.aspect) || 0.5625;
    if (format === "vertical") return FULL;
    if (format === "horizontal") return band(16 / 9);
    if (a > 1.15) return band(Math.min(a, 2.4));
    if (a >= 0.87) return band(1);
    return FULL;
  };
  const replays = [];
  for (let k = 1; k <= 12; k++) {
    const at = mark("replay" + k + "_at", NaN);
    const to = mark("replay" + k + "_to", NaN);
    const shot = mark("replay" + k + "_shot", NaN);
    if (Number.isFinite(at) && to > at && Number.isInteger(shot) && shot >= 0 && shot < n) replays.push({ at, to, shot });
  }
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const replay = replays.find((r) => frame >= r.at && frame < r.to);
  const shown = replay ? replay.shot : cur;
  const film = n && frame < LOGO
    ? h(Footage, { key: "f" + shown + (replay ? "-again" : ""), shot: shown, style: { position: "absolute", ...boxOf(shots[shown]), ...(colour ? {} : { filter: GREY }) }, ...(replay ? { at: replay.at } : {}) })
    : null;

  // 2. The counter, small at the very centre, on its own clock (not the cuts): 30 values from 1 % to 88 % (3 % a tenth of
  // a second; the original's one jump of 4, from 78 to 82), or to 100 % when her words say it is ready; gone just before
  // her word. Its figures lining, 3,2 % of the frame's height (a display serif's capitals are about 0,71 of its size).
  const target = setting("compteur", "88") === "100" ? 100 : 88;
  const valueAt = (k) => (k <= 0 ? 1 : target === 100 ? Math.round(1 + (99 * k) / 29) : k <= 26 ? 3 * k : 3 * k + 1);
  const C = Math.round(H * 0.0453);
  const step = Math.min(29, Math.floor((Math.max(0, frame) * 30) / OFF));
  const counter = n && frame < OFF
    ? h("div", { key: "count", style: { ...centred(2 * C), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontSize: C, lineHeight: 1, fontVariantNumeric: "lining-nums", color: "#ffffff", textShadow: SHADOW, whiteSpace: "nowrap" } }, valueAt(step) + " %")
    : null;

  // 3. Her word in the counter's place, the same face a little smaller (the original's word: its capitals 2,8 % of the
  // height), from her word's beat to her logo, while the flashes run faster.
  const hook = reelTexts.find((t) => t.role === "hook");
  const name = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== name);
  const WS = Math.round(H * 0.0395);
  const word = hook && frame >= Math.min(WORD, hook.from) && frame < LOGO
    ? h(FitText, { key: "w-" + hook.text, style: centred(2.4 * WS), innerStyle: { fontFamily: display, fontSize: WS, lineHeight: 1.15, color: "#ffffff", textShadow: SHADOW, whiteSpace: "nowrap", textAlign: "center" } }, keep(hook.text))
    : null;

  // 4. Its ending on black: her logo, centred and large (the original's round badge is its own, never drawn), white when
  // it is a dark one-colour logo; then her name in thin spaced capitals at the centre, as tall as the original's (3,3 %
  // of the height), from the logo's beat when she has no logo; then her ending card when the Reel has one.
  const logo = brand.logoUrl && frame >= LOGO && frame < NAME && frame < endAt
    ? h(Img, { key: "logo", src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { position: "absolute", left: Math.round(W * 0.15), top: Math.round(H * 0.31), width: Math.round(W * 0.7), height: Math.round(H * 0.43), objectFit: "contain", filter: brand.logoOnDark === "white" ? "brightness(0) invert(1)" : "none" } })
    : null;
  const NS = Math.round(H * 0.047);
  const named = name ? name.text : "";
  const signed = named && frame >= (brand.logoUrl ? NAME : LOGO) && frame < endAt
    ? h(FitText, { key: "n-" + named, style: centred(2 * NS), innerStyle: { fontFamily: body, fontWeight: 300, fontSize: NS, lineHeight: 1.2, letterSpacing: "0.08em", textIndent: "0.08em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textAlign: "center" } }, keep(named))
    : null;
  const card = end && frame >= endAt
    ? h(React.Fragment, { key: "card" },
        h(FitText, { key: "ct-" + end.title, style: { position: "absolute", left: 140, top: Math.round(H * 0.47 - 2.3 * WS), width: W - 280, height: Math.round(2.3 * WS) }, innerStyle: { fontFamily: display, fontSize: Math.round(WS * 1.15), lineHeight: 1.1, color: "#ffffff", textAlign: "center", textWrap: "balance" } }, keep(end.title)),
        end.subtitle ? h(FitText, { key: "cs-" + end.subtitle, style: { position: "absolute", left: 140, top: Math.round(H * 0.47 + 0.4 * WS), width: W - 280, height: 140 }, innerStyle: { fontFamily: body, fontWeight: 400, fontSize: 48, lineHeight: 1.25, letterSpacing: "0.04em", color: "#ffffff", textAlign: "center", textWrap: "balance" } }, keep(end.subtitle)) : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain line high in the frame, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 200 + i * 110, width: W - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 52, color: "#ffffff", textShadow: SHADOW, textAlign: "center" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, counter, word, logo, signed, card, extra);
}`;

/** What each of its slots wants (French, for the filler): a flash of a tenth of a second, by section. */
function want(slot: number): string {
  const flash = SLOTS[slot]!;
  if (slot === 0) return "le premier éclair (0,1 s), celui qui ouvre : le plus beau gros plan d'un geste de son métier, net, sous le petit compteur au centre";
  if (flash < 32) return "un éclair de 0,1 s sous le compteur : un gros plan d'un geste de son métier, de ses mains au travail, d'une matière, d'un outil ou d'un détail, à un autre moment que les éclairs voisins";
  if (flash === 46) return "un éclair de 0,08 s sous son mot, de près (seul son premier dixième de seconde se voit : sept éclairs du début reviennent ensuite)";
  if (flash < 54) return "un éclair de 0,08 s, plus rapide, sous son mot : un geste ou une matière de près, un outil qui travaille ; une photo reste fixe";
  if (slot === SLOTS.length - 1) return "le dernier éclair (0,1 s) juste avant son logo sur le noir : son lieu ou ce qui arrive, plus large (seul son premier dixième de seconde se voit)";
  return "un éclair de 0,1 s juste avant son logo : son lieu et ce qui arrive (ses étagères, ses produits en rangées, sa vitrine, la salle, la nouvelle collection), un peu plus large ; une caméra qui balaie vite va bien";
}

export const bientot: MontageSkill = {
  key: "bientot",
  // 2: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 2,
  bpm: BPM,
  // Its 64 flashes are its form: 56 of her passages, eight replays drawn by its code.
  shots: [SLOTS.length, SLOTS.length],
  files: [6, 20],
  // A teaser stays short: 8,2 s at its tempo, from 6,8 s (95 BPM) to 10,1 s (64), its flashes on its beats.
  tempo: [64, 95],
  // Its code draws its own black and white (and her colours when she asks): its model's finish keeps nothing of its grade.
  finish: { saturation: 0, contrast: 0, exposure: 0 },
  how: "Un teaser en noir et blanc dense : ses gestes et ses matières de près en éclairs de 0,1 s (2 ou 3 images, 64 en 6 s), pendant qu'un petit compteur blanc en serif monte au centre de 1 % à 88 % sur sa propre horloge ; puis son mot à la même place (« Bientôt », « Ouverture samedi »), les éclairs plus rapides, sept éclairs du début qui reviennent, puis son lieu ; puis le noir, son logo, un roulement de clics et un boum grave, et son nom en petites capitales espacées.",
  end: true,
  texts: [
    {
      slot: "bientot",
      role: "hook",
      want: "ce qui arrive, en deux à quatre mots, en petit au centre à la place du compteur (une forme comme « Bientôt », « Ouverture samedi », « Nouvelle collection », « La carte d'hiver ») ; une date seulement si elle la donne",
      max: 24,
      required: true,
    },
    {
      slot: "nom",
      role: "caption",
      want: "son nom en petites capitales espacées sur le noir à la fin, après son logo : son nom tel qu'elle l'écrit, ou le mot qui la distingue quand il est long (« Farine » pour « Maison Farine »)",
      max: 18,
      required: true,
    },
  ],
  settings: [
    {
      name: "compteur",
      want: "où le compteur s'arrête avant son mot : à 88 % comme l'original (ça arrive bientôt), ou à 100 % (c'est prêt : une ouverture, un lancement aujourd'hui)",
      choices: [
        { value: "88", says: "il s'arrête à 88 %, puis son mot : ça arrive bientôt" },
        { value: "100", says: "il va jusqu'à 100 %, puis son mot : c'est prêt" },
      ],
    },
    {
      name: "couleur",
      want: "ses vidéos en noir et blanc comme l'original, ou dans leurs couleurs",
      choices: [
        { value: "noir-et-blanc", says: "noir et blanc dense, comme l'original" },
        { value: "couleur", says: "ses vidéos dans leurs couleurs, le reste pareil" },
      ],
    },
    {
      name: "format",
      want: "le format de ses plans : tout en plein écran vertical, tout dans une bande 16:9 sur du noir, ou comme ses vidéos",
      choices: [
        { value: "vertical", says: "tout en plein écran vertical, ses vidéos horizontales recadrées" },
        { value: "horizontal", says: "tout dans une bande 16:9 sur du noir, comme un film", band: true },
        { value: "auto", says: "comme ses vidéos : les verticales en plein écran, une horizontale entière dans une bande sur du noir, comme l'original" },
      ],
    },
  ],
  timeline(_n, { end, bpm: tempo }) {
    // At another tempo (a length she asks for, a music's own): every landmark counted in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // With an ending card, its time after her name on a quarter-beat grid (the engine's 1,6 s at least).
    const card = end ? Math.ceil((END_CARD + 0.05) / (beat / 4)) / 4 : 0;
    const total = LENGTH + card;
    // Each slot from its flash to the next slot's (a replay's time is the slot's before it, shown again by its code);
    // the last one under its ending, drawn on black by its code.
    const spans = beatSpans(
      bpm,
      SLOTS.map((f, j) => (j + 1 < SLOTS.length ? FLASHES[SLOTS[j + 1]!]! : total) - FLASHES[f]!),
    );
    const duration = spans[spans.length - 1]!.end;
    const at = (beats: number) => round3(beats * beat);
    const frameAt = (beats: number) => toFrame(Math.round(beats * beat * 30) / 30);
    const replays = Object.entries(REPLAYS).flatMap(([f, of], k) => [
      [`replay${k + 1}_at`, frameAt(FLASHES[Number(f)]!)],
      [`replay${k + 1}_to`, frameAt(FLASHES[Number(f) + 1]!)],
      [`replay${k + 1}_shot`, SLOTS.indexOf(of)],
    ]);
    // A roll of ticks 25 a second from just after her logo to just before the boom, rising (as the original's music rolls).
    const rollAt = round3(at(LOGO) + 1 / 30);
    const rolls = Math.max(2, Math.floor((at(BOOM) - 0.05 - rollAt) / 0.04) + 1);
    return {
      duration,
      shots: spans.map((s, j) => ({ ...s, want: want(j) })),
      texts: {
        bientot: { from: round(at(WORD)), to: round(at(LOGO)) },
        nom: { from: round(at(NAME)), to: round(end ? duration - END_CARD : duration) },
      },
      marks: {
        beat: beat * 30,
        off: frameAt(OFF),
        word: frameAt(WORD),
        logo: frameAt(LOGO),
        boom: frameAt(BOOM),
        name: frameAt(NAME),
        ...Object.fromEntries(replays),
      },
      // Its sound as the original's: two deep hits, the roll of ticks up to the boom, the boom falling in pitch.
      sounds: [
        ...HITS.map((b) => ({ at: at(b), sound: "deep 808 bass hit", seconds: 1, gain: 0 })),
        { at: rollAt, sound: "short mechanical tick", seconds: 0.5, gain: -8, burst: { times: Array.from({ length: rolls }, (_, k) => round3(k * 0.04)), gains: Array.from({ length: rolls }, (_, k) => Math.round((8 * k) / (rolls - 1))) } },
        { at: at(BOOM), sound: "deep 808 boom falling in pitch", seconds: 2.5, gain: 4 },
      ],
      // Its clicks stop at the boom: the music muffled from it to the end, faded at the end.
      music: {
        filters: [{ kind: "muffled", from: at(BOOM), to: duration }],
        end: { at: duration, fade: 0.5 },
      },
    };
  },
  code: CODE,
};
