import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Rituel du matin », the effect (docs/fiches/routine.md, effects 1 and 2; its whole Reel is skills/routine.ts,
// version 1): the trailer of her day as the opening of any Reel. Over a run of her shots, a flash of them every four or
// five images (the original's own cuts: 5, 4, 5, 5, 5, 4, 5, 5, 4, 5, 5, 5, 5, again), each the next of her shots under
// it at another of its moments (its own first moment for the first, then from its middle, a shot seen again from
// another moment each time), cut clean, no flash nor fade; over them, her title typed letter by letter at the middle by
// a hand (uneven, done before her small line comes in), two lines of lower-case italic tracked tight in her light
// colour (else the original's warm cream #f6e2c1), flat but for a tight edge hardly seen (so it reads on a white shot),
// a thin white cursor after the last letter until her small
// line comes in, at once, in a fine italic under it, small beside the title; at its last image all goes with the cut and
// the montage takes over. Kept from the model: its flashes' lengths, its title's place (a little over the middle of the
// frame, in the safe zone), its size (110 px), its weight and tracking, its cursor, its line's moment (image 28 of 62).
// Left out: its shots to come (an effect sees only the shots under it: its flashes are those), her ritual, her place,
// its music on the original's grid, its black ending, its format setting (the montage frames her shots).

/** Its flashes, in images, as the original cuts its trailer (4,77 on average), repeated over its length. */
const PATTERN = [5, 4, 5, 5, 5, 4, 5, 5, 4, 5, 5, 5, 5];
/** Her small line comes in at once on this share of its length (image 28 of the original's 62: its typing done before). */
const LINE_SHARE = 28 / 62;

/** Where each flash starts (frames from its start), the original's pattern over its length. */
export function routineFlashStarts(frames: number): number[] {
  const starts: number[] = [];
  for (let f = 0, k = 0; f < frames; k++) {
    starts.push(f);
    f += PATTERN[k % PATTERN.length]!;
  }
  return starts;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const list = shots || [];
  // Its shots: those the engine counts under it (texts.mine), else those that play during it.
  const given = String((texts && texts.mine) || "").split(",").filter((x) => x !== "").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const m = mine.length;
  const BOX = { position: "absolute", left: 0, top: 0, width: W, height: H };

  // 1. Its flashes: a new image every four or five images (the original's cuts, again over its length), each the next of
  // her shots under it, its first at its own first moment, the others from their middle, a shot seen again from another
  // of its moments each time; cut clean.
  const PATTERN = [5, 4, 5, 5, 5, 4, 5, 5, 4, 5, 5, 5, 5];
  const starts = [];
  for (let f = 0, k = 0; f < D; k++) { starts.push(f); f += PATTERN[k % PATTERN.length]; }
  let k = 0;
  while (k < starts.length - 1 && starts[k + 1] <= frame) k++;
  const AT = [0.45, 0.15, 0.75, 0.3, 0.6, 0.05, 0.9];
  const shotOf = (j) => mine[j % m];
  const offsetOf = (j) => {
    if (j === 0) return 0;
    const len = Math.max(1, list[shotOf(j)].durationInFrames);
    return Math.max(0, Math.min(len - 5, Math.round(len * AT[Math.floor(j / m) % AT.length]) - 2));
  };
  const flash = m ? h(Footage, { key: "f" + k, shot: shotOf(k), at: starts[k] - offsetOf(k), style: BOX }) : null;

  // 2. Her title typed letter by letter at the middle, two lines of lower-case italic tracked tight in her light colour
  // (else a warm cream), flat, a thin white cursor after the last letter until her small line comes in at once under it,
  // in a fine italic, small beside the title; both to its last image.
  const luma = (c) => { const q = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!q) return -1; const v = parseInt(q[1], 16); return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255; };
  const light = brand.palette && brand.palette.light;
  const CREAM = luma(light) >= 0.82 ? light : "#f6e2c1";
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  // Two lines at the word that balances them best, the second never the shorter (a single word: one line).
  const lines = (s) => {
    const w = keep(s).split(" ");
    if (w.length < 2) return keep(s);
    let best = 1;
    let score = Infinity;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(" ").length;
      const b = w.slice(i).join(" ").length;
      const v = Math.max(a, b) + (a > b ? 3 : 0);
      if (v < score) { score = v; best = i; }
    }
    return w.slice(0, best).join(" ") + "\n" + w.slice(best).join(" ");
  };
  const LINE_AT = Math.max(6, Math.min(D - 1, Math.round(mark("line_at", Math.round(D * ${LINE_SHARE.toFixed(4)})))));
  const SIZE = 110;
  // A tight edge hardly seen: the cream still reads on a white shot (a glass, a wall).
  const EDGE = "0 1px 2px rgba(48, 32, 18, 0.4), 0 0 1px rgba(48, 32, 18, 0.4)";
  const Y = Math.round(H * 0.488);
  const titleBox = { position: "absolute", left: 140, top: Y - SIZE - 14, width: W - 280, height: 2 * SIZE + 28 };
  const lineBox = { position: "absolute", left: 140, top: Y + SIZE + 18, width: W - 280, height: 56 };
  const title = word("titre");
  const small = word("ligne");
  const letters = title.replace(/\s/g, "").length;
  const speed = Math.max(15.6, (letters * 30 * 1.25) / Math.max(6, LINE_AT - 4));
  const typed = title
    ? h(FitText, { key: "title-" + keep(title), style: titleBox, innerStyle: { fontFamily: display, fontStyle: "italic", fontWeight: 600, fontSize: SIZE, lineHeight: 1, letterSpacing: "-0.045em", color: CREAM, textShadow: EDGE, whiteSpace: "pre", textAlign: "center" } },
        h(TypeOn, { text: lines(title), at: 0, speed, jitter: 0.8, caret: frame < LINE_AT ? "bar" : "none", caretColor: "#ffffff", seed: "routine" }))
    : null;
  const line = small && frame >= LINE_AT
    ? h(FitText, { key: "line-" + keep(small), style: lineBox, innerStyle: { fontFamily: body, fontStyle: "italic", fontWeight: 300, fontSize: 36, lineHeight: 1.2, letterSpacing: "0.01em", color: CREAM, textShadow: EDGE, whiteSpace: "nowrap", textAlign: "center" } },
        h("span", { "data-fauve-accent": "" }, keep(small)))
    : null;
  return h(AbsoluteFill, { style: { overflow: "hidden" } }, flash, typed, line);
}`;

export const routine: EffectPiece = {
  key: "routine",
  version: 1,
  name: "Bande-annonce tapée",
  how: "la bande-annonce de sa journée en ouverture : un éclair de ses plans toutes les quatre ou cinq images, chacun à un autre moment, sous son titre tapé lettre à lettre au milieu avec un curseur fin, en minuscules italiques serrées sur deux lignes, puis sa petite ligne fine dessous d'un coup ; tout part à la coupe et le montage reprend.",
  needs: "des plans variés de sa journée posés dessous (sa préparation, son lieu, ses gens, son travail), photos ou vidéos, et un titre de 2 à 4 mots.",
  lays: "en ouverture du Reel, sur 3 à 10 de ses plans les plus variés, 1,5 à 3 s ; ses éclairs les montrent tour à tour, chacun à un autre moment",
  shots: [3, 10],
  seconds: [1.5, 3.5],
  require: { files: 3 },
  texts: [
    {
      slot: "titre",
      want: "le titre tapé lettre à lettre au milieu, en minuscules italiques sur deux lignes, comme « a day in my life » : 2 à 4 mots courts qui disent sa journée, en français (une forme comme « une journée avec moi », « un matin au fournil », « ma matinée chez Farine »)",
      max: 24,
      required: true,
    },
    {
      slot: "ligne",
      want: "facultatif : la petite ligne fine sous le titre, ce que mélange sa journée en deux ou trois mots reliés par « + », comme « pilates reformer + matcha » (une forme comme « fournil + café crème », « bouquets + thé glacé ») ; 4 mots au plus",
      max: 26,
      required: false,
    },
  ],
  timeline(input: PieceTimelineInput) {
    // Her small line on the original's moment of its trailer (image 28 of 62), her title typed before it.
    return { marks: { line_at: Math.max(6, Math.round(input.frames * LINE_SHARE)) } };
  },
  code: CODE,
};
