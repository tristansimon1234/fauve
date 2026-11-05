import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Défilé d'assiettes », the effect (docs/fiches/assiettes.md, effects 1 to 3 and 7; its whole Reel is
// skills/assiettes.ts): over a run of her shots of dishes or products seen from above, a parade at the original's pace.
// Her shots come back one after the other full frame, each one dish, cut on the original's groove (a dish on sixteenths
// 0, 3, 7, 9, 11 and 14 of a bar, then 0, 5, 7, 9, 11 and 14: two to five sixteenths each), in turn and then from her
// middle one (never twice in a row), a video a little further on its passage each time it comes back, playing while it
// is on, a photo still. Over the first ones, her title is typed letter by letter in the middle in condensed bold
// capitals of her title font, her fine line in her text font typed under it at once behind a caret, both whole
// together, at an even pace, in the original's warm white; both gone at once on a dish's cut once they have been read
// (or held to its end on a short span). Her music without its bass under her title, back as it leaves (the original's
// intro without bass, then its drop). Then the montage takes over. Left: its flash, its vedette, its near silence and
// its loop (its whole Reel's), its ending card. Nothing of the original's own: its words are hers.

/** The original's drop, bar by bar: where each dish starts, in sixteenths (a quarter of a beat). */
const BARS = [
  [0, 3, 7, 9, 11, 14],
  [0, 5, 7, 9, 11, 14],
];
/** Its title typed from images 4 to 42, its line from 2 to 39, at the model's 91,6 BPM (both about two beats). */
const TYPE = [4, 42];
const LINE = [2, 39];
const MODEL_BPM = 91.6;
/** Its words held this long once typed before they leave on a cut (images: 2,2 s, the model's). */
const HOLD = 66;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its dishes' cuts for a span (frames from its start, its first at 0), on the original's two bars in turn at its tempo. */
export function dishCuts(frames: number, bpm: number): number[] {
  const s16 = ((60 / bpm) * 30) / 4;
  const cuts: number[] = [];
  for (let bar = 0; ; bar++) {
    for (const c of BARS[bar % 2]!) {
      const f = Math.round((bar * 16 + c) * s16);
      if (f >= frames - 3) return cuts.length ? cuts : [0];
      cuts.push(f);
    }
  }
}

/** Its typing and its words' exit for a span: typed over about two beats (half the span at most), out on the first dish's cut once read, else at its end. */
export function menuMoments(input: Pick<PieceTimelineInput, "frames" | "bpm">): { type_at: number; type_end: number; line_at: number; line_end: number; title_out: number } {
  const { frames, bpm } = input;
  const scale = MODEL_BPM / bpm;
  const most = Math.max(6, Math.round(frames * 0.5));
  const type_end = Math.min(most, Math.round(TYPE[0]! + (TYPE[1]! - TYPE[0]!) * scale));
  const line_end = Math.min(most - 2, Math.round(LINE[0]! + (LINE[1]! - LINE[0]!) * scale));
  const out = dishCuts(frames, bpm).find((c) => c >= type_end + HOLD);
  return { type_at: TYPE[0]!, type_end, line_at: LINE[0]!, line_end, title_out: out !== undefined && out <= frames - 9 ? out : frames };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  // Its shots: those that play during it, in order (a sliver of one at either edge left out, as the engine counts them).
  const listed = String((texts && texts.mine) || "").split(",").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < shots.length);
  const mine = listed.length ? listed : shots.map((s, i) => i).filter((i) => shots[i].from <= durationInFrames - 2 && shots[i].from + shots[i].durationInFrames >= 2);
  if (!mine.length) return null;
  const n = mine.length;
  const BEAT = Math.max(6, mark("beat", 18));

  // 1. Its dishes, on the original's drop: a new one on sixteenths 0, 3, 7, 9, 11, 14 of a bar, then 0, 5, 7, 9, 11, 14.
  const S16 = BEAT / 4;
  const BARS = [[0, 3, 7, 9, 11, 14], [0, 5, 7, 9, 11, 14]];
  const cuts = [];
  for (let bar = 0; cuts.length < 400; bar++) {
    let done = false;
    for (const c of BARS[bar % 2]) {
      const f = Math.round((bar * 16 + c) * S16);
      if (f >= durationInFrames - 3) { done = true; break; }
      cuts.push(f);
    }
    if (done) break;
  }
  if (!cuts.length) cuts.push(0);
  const j = cuts.reduce((k, c, i) => (c <= frame ? i : k), 0);
  const start = cuts[j];
  const span = Math.max(1, (j + 1 < cuts.length ? cuts[j + 1] : durationInFrames) - start);

  // 2. Which of her shots: each one in turn, then from her middle one (never the same twice in a row: with fewer than
  // four, always in turn); a photo the same image each time, a video a little further on its passage each time it comes
  // back, playing while it is on.
  const half = n >= 4 ? Math.ceil(n / 2) : 0;
  const round = Math.floor(j / n);
  const k = mine[round % 2 === 0 ? j % n : (j % n + half) % n];
  const s = shots[k];
  const video = s.kind === "video";
  const length = Math.max(1, Math.round(s.durationInFrames));
  const offset = length > span ? (round * span) % (length - span + 1) : 0;
  const shown = Math.max(0, Math.min(length - 1, offset + frame - start));
  const FAR = durationInFrames * 4 + 1000;
  const dish = h(Footage, { key: "dish" + j, shot: k, at: video ? frame - shown : FAR, style: { position: "absolute", left: 0, top: 0, width, height } });

  // 3. Her words, typed as the model's: her title in condensed bold capitals of her title font (its capitals 2,5 % of the
  // frame's height: Anton's are 0,85 of its size), centred on its middle; her line under it in her text font, typed at
  // once behind a caret gone seven images after its last letter; both whole together at an even pace, in a warm white,
  // a soft shade so it still reads on her white plates.
  const keep = (t) => String(t || "").normalize("NFC").replace(/(\d) (?=\d)/g, "$1 ");
  const caps = (t) => keep(t).toUpperCase().replace(/(\d)(\s?)H\b/g, "$1$2h");
  const words = (t) => String(t || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const display = "'" + brand.displayFont + "', 'Anton', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Cormorant Garamond', Georgia, serif";
  const INK = "#fcfaf5";
  const SHADE = "0 1px 3px rgba(0,0,0,0.4), 0 0 24px rgba(0,0,0,0.38)";
  const TPX = Math.round(height * 0.0292);
  const LPX = 42;
  const MID = Math.round(height * 0.5);
  const UNDER = Math.round(height * 0.538);
  const speedFor = (t, from, to) => {
    const u = Array.from(t);
    let steps = 0;
    for (let i = 0; i < u.length - 1; i++) {
      if (!/\s/.test(u[i])) steps += 1;
      if (/[.,!?;:…—]$/.test(u[i])) steps += 1.5;
    }
    return Math.max(0.5, (steps * 30) / Math.max(1, to - from));
  };
  const titleBox = { position: "absolute", left: 140, width: width - 280, top: MID - Math.round(TPX * 0.78), height: Math.round(TPX * 1.56) };
  const lineBox = { position: "absolute", left: 140, width: width - 280, top: UNDER - Math.round(LPX * 0.8), height: Math.round(LPX * 1.6) };
  const typed = (text, at, to, box, font, size, upper, caret, key) => {
    const t = upper ? caps(text) : keep(text);
    const small = !upper && words(t) <= 4;
    const typing = h(TypeOn, { text: t, at, speed: speedFor(t, at, to), jitter: 0, caret: caret && frame < to + 7 ? "bar" : "none", caretColor: INK, seed: key });
    return h(FitText, { key: key + "-" + t, style: box, innerStyle: { fontFamily: font, fontWeight: upper ? 400 : 500, fontSize: upper ? size : small ? size : Math.max(48, size), lineHeight: 1, letterSpacing: upper ? "0.01em" : "0", whiteSpace: "nowrap", color: INK, textShadow: SHADE, textAlign: "center" } },
      small ? h("span", { "data-fauve-accent": "" }, typing) : typing);
  };
  const TYPE_AT = Math.round(mark("type_at", 4));
  const TYPE_END = Math.max(TYPE_AT + 1, Math.round(mark("type_end", 42)));
  const LINE_AT = Math.round(mark("line_at", 2));
  const LINE_END = Math.max(LINE_AT + 1, Math.round(mark("line_end", 39)));
  const OUT = Math.round(mark("title_out", durationInFrames));
  const title = word("titre") && frame >= TYPE_AT && frame < OUT ? typed(word("titre"), TYPE_AT, TYPE_END, titleBox, display, TPX, true, false, "title") : null;
  const line = word("ligne") && frame >= LINE_AT && frame < OUT ? typed(word("ligne"), LINE_AT, LINE_END, lineBox, body, LPX, false, true, "line") : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, dish, title, line);
}`;

export const assiettes: EffectPiece = {
  key: "assiettes",
  version: 1,
  name: "Le menu qui défile",
  how: "le temps de quelques mesures, ses plats vus d'en haut défilent en plein écran sur les coups de la musique, un toutes les deux à cinq doubles-croches (le groove de l'original), ses plans repris tour à tour, une vidéo un peu plus loin chaque fois qu'elle revient, jamais deux fois de suite ; sur les premiers, son titre se tape lettre à lettre au milieu en capitales condensées blanches, une ligne fine en serif tapée dessous en même temps derrière un curseur, puis les deux partent d'un coup ; la musique sans basse sous le titre, qui revient quand il part ; puis le montage reprend.",
  needs: "plusieurs plats ou produits différents filmés d'en haut, chacun au milieu de l'image (trois au moins : ses plats du jour, ses pâtisseries, ses cafés, ses bouquets, ses produits tenus à la main au-dessus du même comptoir).",
  lays: "au début du Reel de préférence, sur 3 à 10 de ses plans de plats ou de produits vus d'en haut, sur 3 à 8 s : son titre ouvre le défilé, ses plans y reviennent chacun deux fois ou plus",
  shots: [3, 10],
  seconds: [2.5, 8],
  require: { files: 3 },
  texts: [
    {
      slot: "titre",
      want: "le titre tapé lettre à lettre en capitales au milieu des premiers plats : ce que le défilé montre, 2 à 4 mots (une forme comme « notre carte d'hiver », « 5 idées de brunch », « les plats du jour », « nos best-sellers ») ; jamais une phrase",
      max: 22,
      required: true,
    },
    {
      slot: "ligne",
      want: "une ligne fine en minuscules tapée sous le titre, ce que ces plats ont en commun (une forme comme « faits maison, de saison », « simples et gourmands », « cuisinés chaque matin ») ; 4 mots au plus, rien d'inventé",
      max: 40,
      required: false,
    },
  ],
  timeline({ frames, bpm }) {
    const m = menuMoments({ frames, bpm });
    return {
      marks: m,
      // Its music without its bass under her title, back with its exit on a dish's cut (none when it stays to the end).
      ...(m.title_out < frames ? { music: { filters: [{ kind: "thin" as const, from: 0, to: round3(m.title_out / 30) }] } } : {}),
    };
  },
  code: CODE,
};
