// How what is said is laid out when a Reel writes it like a creator (plan.captions, lot 7; Tristan's references of
// creators talking to camera): the words of each phrase appear on the frame they are said, around the person, the
// phrase's strong word big in another face, the faces changing from one phrase to the next (« kinetic »), or each word
// on a small label near her (« stickers »). Pure, frame based, the same in the render, the live preview and the scene
// check (no JSX: the tests read it).

export type SpokenWord = { w: string; from: number; to: number };
export type CaptionStyle = "kinetic" | "stickers";
export type CaptionWord = SpokenWord & { strong: boolean };
/** A phrase: its words, the frames it holds, how it is set (its strong word's face and colour, its side). */
export type CaptionCard = {
  index: number;
  from: number;
  to: number;
  words: CaptionWord[];
  align: "left" | "right" | "center";
  face: "display" | "serif";
  tone: "white" | "accent";
};

// Small words never carry a phrase (French and English, as said: elided forms included).
const STOP = new Set(
  (
    "le la les l un une des du de d à au aux et ou mais donc or ni car que qu qui quoi dont où ce cet cette ces c ça ca se s sa son ses " +
    "ma mon mes ta ton tes notre nos votre vos leur leurs je j tu il elle on nous vous ils elles me m te t lui y en ne n pas plus " +
    "moins très tres trop bien est es suis sont a as ai ont avoir être etre fait faire va vais vas vont sur sous dans par pour avec " +
    "sans chez comme si alors aussi tout tous toute toutes quand là voilà voila oui non bon ben euh hein ici c'est j'ai c'était y'a " +
    "the a an and or but so of to in on at for with is are was be it i you we they he she this that my your our just not do did " +
    "have has had what when then there here as by from if it's i'm"
  ).split(" "),
);

const letters = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, "");
const bare = (w: string) => letters(w.toLowerCase().replace(/^[a-z]['’]/, ""));
const isStop = (w: string) => STOP.has(w.toLowerCase().replace(/[^\p{L}\p{N}'’]/gu, "").replace("’", "'")) || STOP.has(bare(w));
/** A phrase ends on its punctuation. */
const ENDS = /[.,!?;:…]$/;

/** The most words a phrase holds, and its longest time (seconds); a pause this long starts another. */
export const CARD_WORDS = 6;
const CARD_SECONDS = 2.6;
const PAUSE_SECONDS = 0.4;
/** What a phrase stays after its last word when nothing follows (seconds). */
const HOLD_SECONDS = 0.6;

/**
 * Where a phrase too long is cut in two: near its middle, before a small word that follows a word carrying meaning
 * (« toute la boutique | est à moins vingt pour cent »), or where the voice pauses.
 */
function splitAt(words: SpokenWord[]): number {
  let best = 1;
  let score = Infinity;
  for (let i = 1; i < words.length; i++) {
    const natural = isStop(words[i]!.w) && !isStop(words[i - 1]!.w) ? 0 : 1.5;
    const pause = words[i]!.from - words[i - 1]!.to > 4 ? -1 : 0;
    const s = Math.abs(i - words.length / 2) + natural + pause;
    if (s < score) {
      score = s;
      best = i;
    }
  }
  return best;
}

/** A clause cut until each piece holds on screen: six words, 2.6 s at most. */
function pieces(words: SpokenWord[], fps: number): SpokenWord[][] {
  if (words.length < 2 || (words.length <= CARD_WORDS && words.at(-1)!.to - words[0]!.from <= CARD_SECONDS * fps)) return [words];
  const at = splitAt(words);
  return [...pieces(words.slice(0, at), fps), ...pieces(words.slice(at), fps)];
}

/**
 * The phrase's strong word: the longest word that carries meaning (a number first), the last one when it is as long; a
 * phrase made only of small words gives its last word when it is long enough (« quand tu n'en as PLUS »).
 */
export function strongIndex(words: { w: string }[]): number {
  let best = -1;
  let score = -1;
  words.forEach((word, i) => {
    const l = letters(word.w).length;
    const digit = /\d/.test(word.w);
    if ((!digit && l < 3) || isStop(word.w)) return;
    const s = l + (digit ? 8 : 0) + (i === words.length - 1 ? 1.5 : 0);
    if (s >= score) {
      score = s;
      best = i;
    }
  });
  if (best >= 0) return best;
  const last = words.length - 1;
  return words.length >= 2 && letters(words[last]!.w).length >= 3 ? last : words.length === 1 && letters(words[0]!.w).length >= 4 ? 0 : -1;
}

const ALIGNS: CaptionCard["align"][] = ["center", "left", "right", "center", "right", "left"];

/** The phrases of what is said, in order, each with its strong word and how it is set. */
export function captionCards(words: SpokenWord[], fps: number, total: number): CaptionCard[] {
  // Clauses first (its punctuation, a pause of the voice), then each one cut until it holds.
  const clauses: SpokenWord[][] = [];
  for (const word of words) {
    const current = clauses.at(-1);
    const last = current?.at(-1);
    if (current && last && word.from - last.to < PAUSE_SECONDS * fps && !ENDS.test(last.w)) current.push(word);
    else clauses.push([word]);
  }
  const groups = clauses.flatMap((c) => pieces(c, fps));
  // A phrase of one small word joins the next one (« et » alone never holds the screen).
  for (let i = groups.length - 2; i >= 0; i--) {
    const g = groups[i]!;
    const next = groups[i + 1]!;
    if (g.length === 1 && isStop(g[0]!.w) && next.length < CARD_WORDS && next[0]!.from - g[0]!.to < PAUSE_SECONDS * fps) {
      groups.splice(i, 2, [...g, ...next]);
    }
  }
  return groups.map((g, index) => {
    const strong = strongIndex(g);
    const next = groups[index + 1]?.[0]?.from ?? total;
    const end = g.at(-1)!.to;
    return {
      index,
      from: g[0]!.from,
      to: Math.min(next, Math.max(end + 4, Math.min(end + Math.round(HOLD_SECONDS * fps), total))),
      words: g.map((w, i) => ({ ...w, strong: i === strong })),
      align: ALIGNS[index % ALIGNS.length]!,
      // The faces change from one phrase to the next: the brand's titles, then a serif italic; one in two of the titles in its colour.
      face: index % 3 === 1 ? "serif" : "display",
      tone: index % 3 === 2 ? "accent" : "white",
    };
  });
}

/** The phrase on screen at a frame. */
export const cardAt = (cards: CaptionCard[], frame: number) => cards.find((c) => frame >= c.from && frame < c.to);

/**
 * The size of a phrase's strong word so it fills the width it has, in px: a display face in capitals runs wider than a
 * serif italic in lowercase.
 */
export function strongSize(word: string, face: CaptionCard["face"], width: number, max: number): number {
  const chars = Math.max(2, [...letters(word)].length + (word.match(/[^\p{L}\p{N}]/gu)?.length ?? 0) * 0.4);
  return Math.round(Math.min(max, width / (chars * (face === "display" ? 0.6 : 0.46))));
}

/**
 * Where a phrase sits (top of its block, share of the height): in the band the engine keeps free of faces and texts
 * (the subtitles' row, `row`), above it when the row is low, from it when it is high.
 */
export function cardTop(row: number, blockShare: number): number {
  // Never under 74 % of the height: the apps' own caption and buttons sit there.
  const bottom = 0.74;
  const top = row >= 0.45 ? Math.min(row + 0.1, bottom) - blockShare : Math.max(row, 0.1);
  return Math.max(0.08, Math.min(bottom - blockShare, top));
}

/** For labels: where a phrase's word sits around its row (shares of the width and the height), changing from phrase to phrase. */
export function labelSpot(index: number, row: number): { x: number; y: number; tilt: number } {
  const spots = [
    { x: 0.5, dy: 0, tilt: -2 },
    { x: 0.36, dy: -0.035, tilt: 2.5 },
    { x: 0.62, dy: 0.03, tilt: -1.5 },
    { x: 0.44, dy: 0.05, tilt: 1.5 },
  ];
  const s = spots[index % spots.length]!;
  return { x: s.x, y: Math.max(0.12, Math.min(0.76, row + 0.06 + s.dy)), tilt: s.tilt };
}
