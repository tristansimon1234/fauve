import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Teaser qui se charge », the effect (docs/fiches/bientot.md, effects 1 to 4; its whole Reel is skills/bientot.ts,
// version 1): over a run of her shots, the montage turns into flashes of about a tenth of a second (a whole subdivision of
// the Reel's beat, the one nearest three images: an eighth of a beat at 79 BPM, as the original's), her shots taken in
// turn, each one coming back at a later moment of its own passage, in a dense black and white (or her colours); at the
// very centre a small white serif counter climbs on its own clock, 30 values from 1 % to 88 % (the original's, its one
// jump of 4), or to 100 % when her words say it is ready; gone two images before her word, which takes its place in the
// same face a little smaller, the flashes a little faster (one more a beat, as the original's ninths after its word);
// a deep hit as her word lands. Kept from the model: the counter's place, size (its figures 3,2 % of the height) and
// lining figures, the word's (its capitals 2,8 %), their tight shadow, the grey. Left out: its replays, its logo and name
// on the black, its roll and boom (the Reel's own ending is the montage's), its formats (the montage frames her shots).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const list = shots || [];
  // Its shots: those the engine counts under it (texts.mine), else those that play during it, in order.
  const given = typeof (texts && texts.mine) === "string" ? texts.mine.split(",").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length) : [];
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const n = mine.length;
  const FLASH = Math.max(2, mark("flash", 3));
  const FAST = Math.max(1.5, Math.min(FLASH, mark("fast", FLASH)));
  const WORD = Math.round(Math.min(D - 1, mark("word", D * 0.55)));
  const OFF = Math.round(Math.max(1, Math.min(WORD, mark("off", WORD - 2))));
  const display = "'" + brand.displayFont + "', 'Playfair Display', serif";
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ").replace(/ (\d+(?:er|e))\b/g, " $1");
  const SHADOW = "0 1px 5px rgba(0,0,0,0.6)";
  const centred = (tall) => ({ position: "absolute", left: 140, top: Math.round(H / 2 - tall / 2), width: W - 280, height: Math.round(tall) });

  // 1. Its flashes: before her word one every FLASH frames, after it one every FAST; flash j is her shot j mod n, at its
  // m-th coming back, at the m-th of as many moments spread over its whole passage (a later one each time).
  const before = Math.max(1, Math.ceil(WORD / FLASH));
  const total = before + Math.max(0, Math.ceil((D - WORD) / FAST));
  const startOf = (j) => (j < before ? Math.round(j * FLASH) : WORD + Math.round((j - before) * FAST));
  // The flash on screen: the last one started, by its rounded start.
  let j = Math.max(0, Math.min(total - 1, frame < WORD ? Math.floor(frame / FLASH) : before + Math.floor((frame - WORD) / FAST)));
  if (j + 1 < total && startOf(j + 1) <= frame) j += 1;
  if (j > 0 && startOf(j) > frame) j -= 1;
  const film = (() => {
    if (!n) return null;
    const k = mine[j % n];
    const s = list[k];
    const m = Math.floor(j / n);
    const comes = Math.max(1, Math.ceil((total - (j % n)) / n));
    const len = Math.max(1, Math.round(s.durationInFrames));
    const room = Math.max(0, len - Math.ceil(FLASH));
    const local = comes > 1 ? Math.round((m * room) / (comes - 1)) : Math.round(room / 2);
    const colour = setting("couleur", "noir-et-blanc") === "couleur";
    return h(Footage, { key: "f" + j, shot: k, at: startOf(j) - local, style: { position: "absolute", left: 0, top: 0, width: W, height: H, ...(colour ? {} : { filter: "grayscale(1) brightness(1.06) contrast(1.22)" }) } });
  })();

  // 2. The counter, small at the very centre, on its own clock: 30 values from 1 % to 88 % (or 100 %), gone before her word.
  const target = setting("compteur", "88") === "100" ? 100 : 88;
  const valueAt = (k) => (k <= 0 ? 1 : target === 100 ? Math.round(1 + (99 * k) / 29) : k <= 26 ? 3 * k : 3 * k + 1);
  const C = Math.round(H * 0.0453);
  const step = Math.min(29, Math.floor((Math.max(0, frame) * 30) / OFF));
  const counter = frame < OFF
    ? h("div", { key: "count", style: { ...centred(2 * C), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontSize: C, lineHeight: 1, fontVariantNumeric: "lining-nums", color: "#ffffff", textShadow: SHADOW, whiteSpace: "nowrap" } }, valueAt(step) + " %")
    : null;

  // 3. Her word in its place, the same face a little smaller, from its beat to the end of the effect.
  const said = word("bientot");
  const WS = Math.round(H * 0.0395);
  const shown = said && frame >= WORD
    ? h(FitText, { key: "w-" + said, style: centred(2.4 * WS), innerStyle: { fontFamily: display, fontSize: WS, lineHeight: 1.15, color: "#ffffff", textShadow: SHADOW, whiteSpace: "nowrap", textAlign: "center" } }, keep(said))
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, counter, shown);
}`;

/** Frames of one of its flashes at a tempo: the whole subdivision of a beat nearest three images (0,1 s), and after her word one more a beat. */
export function bientotFlashes(bpm: number): { flash: number; fast: number } {
  const beat = (60 / bpm) * 30;
  const per = Math.max(1, Math.round(beat / 2.85));
  return { flash: Math.round((beat / per) * 1000) / 1000, fast: Math.round((beat / (per + 1)) * 1000) / 1000 };
}

/** Where her word lands, frames from its start: the beat nearest 55 % of it (the original's 4 beats of 7¾), 40 images before its end at the latest. */
export function bientotWord(frames: number, bpm: number): number {
  const beat = (60 / bpm) * 30;
  const latest = Math.max(1, frames - 40);
  return Math.max(Math.min(12, latest), Math.min(latest, Math.round(Math.round((frames * 0.55) / beat) * beat)));
}

export const bientot: EffectPiece = {
  key: "bientot",
  version: 1,
  name: "Teaser qui se charge",
  how: "ses plans repris en éclairs d'un dixième de seconde, l'un après l'autre, en noir et blanc dense, pendant qu'un petit compteur blanc en serif charge au centre de 1 % à 88 % ; puis le mot de ce qui arrive à sa place, les éclairs un peu plus rapides, un coup sourd quand il arrive ; puis le montage reprend.",
  needs: "plusieurs plans courts et différents de gestes, de mains au travail, de matières ou d'outils, de près (filmés à la main, ça va), et ce qui arrive en deux à quatre mots.",
  lays: "sur 3 à 8 de ses plans de gestes et de matières, chacun d'une demi-seconde à une seconde et demie, souvent au début ou juste avant la fin ; le compteur prend un peu plus de la moitié, son mot le reste",
  shots: [2, 8],
  seconds: [2, 7],
  require: { files: 2, shot: { framing: ["detail", "close", "medium"] } },
  texts: [
    {
      slot: "bientot",
      want: "ce qui arrive, en deux à quatre mots, en petit au centre à la place du compteur (une forme comme « Bientôt », « Ouverture samedi », « Nouvelle collection », « La carte d'hiver ») ; une date seulement si elle la donne",
      max: 24,
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
      want: "ses plans en noir et blanc comme l'original, ou dans leurs couleurs",
      choices: [
        { value: "noir-et-blanc", says: "noir et blanc dense, comme l'original" },
        { value: "couleur", says: "ses plans dans leurs couleurs, le reste pareil" },
      ],
    },
  ],
  timeline(input: PieceTimelineInput) {
    const { flash, fast } = bientotFlashes(input.bpm);
    const word = bientotWord(input.frames, input.bpm);
    return {
      // Its flashes' lengths, her word's moment, the counter gone two images before it (frames from its start).
      marks: { flash, fast, word, off: Math.max(1, word - 2) },
      // A deep hit as her word lands (the original's on its replays).
      sounds: [{ at: Math.round((word / 30) * 1000) / 1000, sound: "deep 808 bass hit", seconds: 1, gain: 0 }],
    };
  },
  code: CODE,
};
