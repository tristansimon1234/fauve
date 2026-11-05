import type { EffectPiece, PieceTimeline } from "../pieces.ts";

// « Quart de tour, deux tons », the effect (docs/fiches/tourne.md, effects 1, 4, 6 and 7; its whole Reel is
// skills/tourne.ts). Over a run of her shots, each one filmed in width is turned a quarter, always clockwise (the top of
// the scene on the right of the screen), whole: a 16:9 video turned fills the vertical frame exactly, never cut, never
// turning while it plays; one filmed upright plays upright. All of them in the original's two tones (deep blacks,
// blue-green shadows, green-grey mids, cream highlights, its whites never past #E8E5DA), with its lens edges at the top
// and the bottom of the frame (streaked along the height, split green and magenta); the colour kept on the shot where it
// counts, the one the editor holds longest (never its first: the two tones come first), and a second one from seven
// shots, graded as the original's colour shots. Its last shot arrives through the original's last flash: the shot
// before it blurring over its last five images, a white flash on its first image, its second still blurred. Its two
// big hits: one as it comes in, the louder on the cut into its colour shot (the original's on the cuts into its first
// colour shots), her music muffled as through a wall until that cut and open at once on it (v2, its skill's pad then
// its burst). Then the montage takes over, upright and in colour. Its optional title is turned a quarter like the
// shots, in cream capitals along the middle of the frame, over its first shot. It leaves the rest of its Reel: its
// opening strobe and its filé, its burst on the quarter beats and its punch zoom, its upside-down upright video (a
// slot of its own), its last shot held and its ending card. Nothing of the original's own (its places are Egypt's):
// her shots, her words.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const rankOf = (k) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? Math.round(v) : -1; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  // Its shots: those that play during it, in order, each from its cut (the first one from its start).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return null;
  const n = mine.length;
  const starts = mine.map((i) => Math.max(0, Math.round(shots[i].from)));
  const rank = starts.reduce((r, s, k) => (s <= frame ? k : r), 0);
  const cutAt = (r) => (r >= 0 && r < n ? starts[r] : durationInFrames + 1);
  const full = { position: "absolute", left: 0, top: 0, width, height };
  // Its settings: the colour kept where it counts (or nowhere), the quarter turn always clockwise (or one way then the
  // other). Its marks: the ranks of its shots left in colour, the rank of the shot its flash opens.
  const COLOURS = setting("couleur", "auto") === "aucune" ? [] : [rankOf("colour_0"), rankOf("colour_1")].filter((r) => r >= 0 && r < n);
  const BOTH_WAYS = setting("sens", "horaire") === "alterne";
  const FLASH = rankOf("flash") >= 1 && rankOf("flash") < n ? rankOf("flash") : -1;

  // 1. Its two tones, as inline filters (measured on the original's 23 shots in two tones): her picture's light mapped to
  // deep blacks, blue-green shadows, green-grey mids and cream highlights, its whites never past #E8E5DA; a natural
  // contrast, never a grey black and white. Her shots in colour graded as its colour ones: cool shadows, warm mids, the
  // same cream whites (her colours as she filmed them, never pushed).
  const TONE = [[5, 5, 8], [22, 28, 30], [42, 51, 52], [64, 75, 74], [87, 98, 95], [108, 122, 111], [132, 141, 129], [156, 165, 147], [181, 187, 166], [206, 207, 189], [232, 229, 218]];
  const toneAt = (y) => {
    const x = Math.max(0, Math.min(1, y)) * 10;
    const i = Math.min(9, Math.floor(x));
    return TONE[i].map((v, c) => v + (TONE[i + 1][c] - v) * (x - i));
  };
  const table = (c) => Array.from({ length: 21 }, (_, k) => (toneAt(k / 20)[c] / 255).toFixed(3)).join(" ");
  const luma = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
  const defs = h("svg", { key: "defs", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
    h("defs", null,
      h("filter", { id: "tourne-piece-duo", x: "0", y: "0", width: "1", height: "1", colorInterpolationFilters: "sRGB" },
        h("feColorMatrix", { type: "matrix", values: luma }),
        h("feComponentTransfer", null, ["R", "G", "B"].map((c, i) => h("feFunc" + c, { key: c, type: "table", tableValues: table(i) })))),
      h("filter", { id: "tourne-piece-colour", x: "0", y: "0", width: "1", height: "1", colorInterpolationFilters: "sRGB" },
        h("feComponentTransfer", null,
          h("feFuncR", { type: "table", tableValues: "0.02 0.235 0.515 0.765 0.905" }),
          h("feFuncG", { type: "table", tableValues: "0.02 0.245 0.5 0.74 0.885" }),
          h("feFuncB", { type: "table", tableValues: "0.04 0.27 0.48 0.69 0.835" })))));

  // 2. Every shot filmed in width turned a quarter, clockwise (the top of the scene on the right of the screen), whole:
  // a 16:9 video turned fills the vertical frame exactly; it never turns while it plays. Upright, it plays upright.
  const wideOf = (s) => (Number(s && s.aspect) || 0.5625) > 1.15;
  const drawn = (r) => {
    const i = mine[r];
    const draw = (size) => h(Footage, { shot: i, style: { position: "absolute", left: 0, top: 0, width: size.width, height: size.height } });
    if (wideOf(shots[i])) return h(Turn, { angle: BOTH_WAYS && r % 2 ? -90 : 90, draw });
    return h("div", { style: full }, draw({ width, height }));
  };

  // 3. Its last flash, the original's: the shot before it blurred over its last five images (copies of the shot
  // blurred, not a fade: px), a white flash on the first image of its last shot (not a pure white: the shot shows
  // through, overexposed), its second image still blurred; then a hard cut back to the montage after its end.
  const BEFORE = [5, 12, 20, 20, 21];
  const AFTER = [0, 12];
  const blurOf = (r) => {
    if (FLASH < 1) return 0;
    const c = cutAt(FLASH);
    if (r === FLASH - 1 && frame < c && frame >= c - BEFORE.length) return BEFORE[BEFORE.length - (c - frame)];
    if (r === FLASH && frame >= c && frame - c < AFTER.length) return AFTER[frame - c];
    return 0;
  };
  const lit = FLASH >= 1 && rank === FLASH && frame === cutAt(FLASH);
  const picture = (r) => {
    const px = blurOf(r);
    const tone = COLOURS.includes(r) ? "url(#tourne-piece-colour)" : "url(#tourne-piece-duo)";
    const filter = [tone, lit ? "brightness(1.6)" : "", px ? "blur(" + px + "px)" : ""].filter(Boolean).join(" ");
    // A blurred shot a little larger, so its edges stay off the frame.
    return h("div", { key: "p" + r, style: { ...full, overflow: "hidden", filter, ...(px ? { transform: "scale(" + (1 + (3 * px) / width).toFixed(3) + ")" } : {}) } }, drawn(r));
  };
  const film = picture(rank);
  // 4. Its lens edges over her shots in two tones (laid after the tones: a grey picture has no colour to split), at the
  // top and the bottom of the frame (the sides of her shot before its quarter turn, as an anamorphic lens): streaked
  // along the height, split green and magenta, the magenta outward (6 px apart at the top, 5 at the bottom).
  const lensed = COLOURS.includes(rank) ? film : h(LensEdges, { key: "lens", split: [6, 5] }, film);
  const flash = FLASH >= 1 ? h(Flash, { key: "flash", at: cutAt(FLASH), frames: 1, color: "rgba(250,248,251,0.9)" }) : null;

  // Its optional title, turned a quarter like the shots, in condensed cream capitals along the middle of the frame,
  // reading as the turned scene does; its size follows its length. Over its first shot: to the first cut a second and a
  // half in (or to its end).
  const title = word("titre");
  const display = "'" + brand.displayFont + "', 'Big Shoulders Display', 'Oswald', 'Arial Narrow', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const shade = "0 0 2px rgba(0,0,0,0.55), 0 1px 5px rgba(0,0,0,0.4), 0 2px 18px rgba(0,0,0,0.32)";
  const until = starts.find((s) => s >= 45) || durationInFrames;
  const size = Math.min(240, Math.max(110, Math.round(3900 / Math.max(6, Array.from(title).length))));
  const titled = title && frame < until
    ? h(FitText, { key: "titre", style: { position: "absolute", left: Math.round(width / 2 - 620), top: 760 - 130, width: 1240, height: 260, transform: "rotate(90deg)", transformOrigin: "50% 50%" }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: size, lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", color: "#E8E5DA", whiteSpace: "nowrap", textShadow: shade } }, keep(title))
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, defs, lensed, flash, titled);
}`;

/** The original's big hit: its two, on the cuts into its first colour shots, the second the loudest of the piece. */
const HIT = { sound: "deep cinematic impact hit", seconds: 1.5 };

/**
 * Its shots left in colour, by rank: the one the editor holds longest on screen (the colour shot of the original is
 * held two seconds), never its first (its two tones come first); from seven shots, a second one, not beside the first
 * (the original keeps its colour on 5 of its 28).
 */
export function colourRanks(shots: { from: number; frames: number }[], frames: number): number[] {
  if (shots.length < 2) return [];
  const seen = shots.map((s, r) => ({ r, f: Math.min(frames, s.from + s.frames) - Math.max(0, s.from) }));
  const longest = (skip: (r: number) => boolean) => seen.filter((s) => s.r > 0 && !skip(s.r)).sort((a, b) => b.f - a.f || a.r - b.r)[0]?.r;
  const first = longest(() => false)!;
  if (shots.length < 7) return [first];
  const second = longest((r) => Math.abs(r - first) <= 1);
  return second === undefined ? [first] : [first, second].sort((a, b) => a - b);
}

export const tourne: EffectPiece = {
  key: "tourne",
  version: 2,
  name: "Quart de tour, deux tons",
  how: "ses plans filmés en largeur tournés d'un quart de tour, dans le sens des aiguilles d'une montre, pour remplir l'écran en entier, en deux tons bleu-vert et crème, avec des bords d'objectif en haut et en bas ; la couleur gardée sur le plan où elle compte (celui qui dure le plus) ; son dernier plan arrive par un flou et un flash blanc ; un grand coup sourd quand il arrive, un plus fort sur le plan en couleur ; puis le montage reprend, droit et en couleur.",
  needs: "des vidéos filmées en largeur (le téléphone couché) : des lignes, des matières, des gestes, et un plan où la couleur compte (ses fleurs, ses fruits, un mur peint, la mer).",
  lays: "sur 2 à 6 de ses plans filmés en largeur, coupés d'un ou deux temps chacun ; le plan où la couleur compte tenu le plus longtemps, jamais le premier (il reste en couleur)",
  shots: [2, 8],
  seconds: [2, 8],
  require: { files: 2, shot: { video: true, wide: true } },
  texts: [
    {
      slot: "titre",
      want: "facultatif : un titre court tourné d'un quart de tour comme les plans, en capitales crème le long de l'écran, sur son premier plan (son lieu, sa ville, son métier), seulement quand le moment a besoin de mots",
      max: 16,
      required: false,
    },
  ],
  settings: [
    {
      name: "sens",
      want: "le sens du quart de tour",
      choices: [
        { value: "horaire", says: "toujours dans le sens des aiguilles d'une montre, comme l'original" },
        { value: "alterne", says: "un plan dans un sens, le suivant dans l'autre" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur",
      choices: [
        { value: "auto", says: "comme l'original : deux tons bleu-vert et crème, la couleur gardée sur le plan où elle compte" },
        { value: "aucune", says: "tout en deux tons, aucun plan en couleur" },
      ],
    },
  ],
  timeline({ frames, shots, settings }): PieceTimeline {
    const colours = settings.couleur === "aucune" ? [] : colourRanks(shots, frames);
    const flash = shots.length >= 2 ? shots.length - 1 : -1;
    // Its hits: as it comes in, and the louder on the cut into its first shot in colour.
    const into = colours[0] !== undefined ? shots[colours[0]]!.from / 30 : -1;
    const cut = Math.round(into * 1000) / 1000;
    return {
      marks: {
        ...Object.fromEntries(colours.map((r, k) => [`colour_${k}`, r])),
        ...(flash > 0 ? { flash } : {}),
      },
      sounds: [{ at: 0, ...HIT }, ...(into > 0 ? [{ at: cut, ...HIT, gain: 4 }] : [])],
      // Her music muffled as through a wall until that cut, open at once on it (its skill's pad, then its burst).
      ...(into > 0.3 ? { music: { filters: [{ kind: "muffled" as const, from: 0, to: cut }] } } : {}),
    };
  },
  code: CODE,
};
