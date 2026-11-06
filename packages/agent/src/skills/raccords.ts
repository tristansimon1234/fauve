import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Plans qui s'emboîtent » (`raccords`), version 1, written on its original's fiche (docs/fiches/raccords.md: a
// creator's day in six shots, 7,23 s, 4:3, measured image by image at 30 i/s, its sound by bands; Tristan: « c'est un
// effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Its shots are chained by raccords: at each cut,
// what the next shot holds arrives first over the shot on screen, exactly where it will be, in pieces on the music's
// hits, frozen on its first image; the cut then makes it play, so the eye never jumps. Its music is a lo-fi boom bap at
// 95 BPM (Gemini heard 90, measure.py 126,75: its dotted 3-3-2 sixteenths), its first beat 0,334 s in (2,11 sixteenths),
// each bar losing its bass at its sixteenth 10,5 and getting it back on the next bar's first beat. Every landmark below is
// in sixteenths of that grid from its first beat (the original's own, its images 39, 53, 58, 66, 71, 78, 86, 101, 106,
// 114, 124, 142, 146, 154, 162, 176, 188, 217, each within one):
//   −2,1 – 6     her first shot (someone close who smiles and turns): her word in very bold round capitals across the
//                frame, blinking image by image (on at images 0, 2, 4 to 10, 12, 14: the original's « OK », its own, never
//                copied); from 2,75 the next shot shows in its lights, its darks in front (a « darken » blend rising; in
//                its shadows on a dark shot);
//   6 – 14,25    the next shot; on 9, 10, 12 and 13 the shot after it arrives in nine square cells about its subject (one,
//                the column, the cross, all nine), dimmed, exactly where it will be;
//   14,25 – 24   that shot, dimmed, lighting up in three images onto the bar's first beat (16), where the bass comes back;
//                on 19,25, 20,25 and 22 the next one's subject arrives cut out in three pieces (its two outer thirds, then
//                its middle);
//   24 – 32      the same again on 28, 28,75 and 30,5, the cut on the third bar's first beat (32);
//   32 – 37,5    the next one's subject arrives cut out whole on 35: the cut keeps it in place (the match);
//   37,5 – 43,75 her last shot, to the end, in the third bar's break.
// A raccord whose next shot has no cut-out (none made, a tiny subject) shows its picture in the nine cells instead, on
// the same hits. More shots: more of its middle (cells, pieces, pieces), each bar keeping its break; fewer: its middle
// cut short. Full frame when her videos are mostly upright, else whole in a 16:9 band on black (Tristan: « format par
// défaut [comme ses vidéos], et changement à la demande du user »). Her photos stay still, her videos play.

const BPM = 95;
/** Its first beat, 0,334 s after its first image: a pickup of 2,11 sixteenths, its word blinking over it. */
const PICKUP = 2.117;
/** Its first shot, to its first cut (sixteenths from its first beat). */
const OPEN = 6;
/** Its middle, by threes (the original's three shots between its double exposure and its match): each one's length and the raccord that brings in the next. */
const MIDDLE: { length: number; kind: 1 | 2; pops: number[] }[] = [
  // The nine cells on 9, 10, 12, 13 (its cut 14,25): 5,25 … 1,25 sixteenths before it.
  { length: 8.25, kind: 1, pops: [-5.25, -4.25, -2.25, -1.25] },
  // Three pieces on 19,25, 20,25, 22 (its cut 24).
  { length: 9.75, kind: 2, pops: [-4.75, -3.75, -2] },
  // Three pieces on 28, 28,75, 30,5 (its cut 32, the third bar's first beat).
  { length: 8, kind: 2, pops: [-4, -3.25, -1.5] },
];
/** The shot before its last: the next subject whole on 35, its cut 37,5 (the match). */
const MATCH = { length: 5.5, pops: [-2.5] };
/** Its last shot, to its end (43,75: image 217). */
const LAST = 6.25;
/** The double exposure, from 3,25 sixteenths before its first cut (image 23). */
const BLEND = 3.25;
/** A shot brought in by the nine cells lights up onto 1,75 sixteenths after its cut (the bar's first beat, image 86). */
const LIT = 1.75;
/** Each bar's break: its bass gone from its sixteenth 10,5 to the next bar's first beat. */
const BREAK = 10.5;
const BAR = 16;
/** Its word blinks over its first 15 images (the original's « OK »: 0,5 s). */
const WORD = 0.5;
/** The engine's ending card: the Reel's last 1,6 s, after its last shot's own length. */
const END_CARD = 1.6;
/** Up to 22 shots for a length she asks for: more of its middle (29 s at its own tempo). */
const LONG = 22;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");

/** The kind of each raccord: 0 the double exposure, 1 the nine cells, 2 the subject in three pieces, 3 the subject whole. */
export type RaccordKind = 0 | 1 | 2 | 3;

/**
 * Its n shots in sixteenths of its grid: each one's length, and each cut's raccord (its kind, where it falls from its
 * first beat, its hits before it, its double exposure's start, the image its next shot lights up on).
 */
export function raccordCuts(n: number): { lengths: number[]; cuts: { kind: RaccordKind; at: number; pops: number[]; blend?: number; lit?: number }[] } {
  const count = Math.max(4, Math.min(LONG, Math.round(n)));
  const middle = Array.from({ length: count - 3 }, (_, i) => MIDDLE[i % 3]!);
  const lengths = [PICKUP + OPEN, ...middle.map((m) => m.length), MATCH.length, LAST];
  const cuts: { kind: RaccordKind; at: number; pops: number[]; blend?: number; lit?: number }[] = [{ kind: 0, at: OPEN, pops: [], blend: OPEN - BLEND }];
  let at = OPEN;
  for (const m of middle) {
    at += m.length;
    cuts.push({ kind: m.kind, at: round3(at), pops: m.pops.map((p) => round3(at + p)), ...(m.kind === 1 ? { lit: round3(at + LIT) } : {}) });
  }
  at += MATCH.length;
  cuts.push({ kind: 3, at: round3(at), pops: MATCH.pops.map((p) => round3(at + p)) });
  return { lengths, cuts };
}

/** What each shot wants, by the raccord that brings it in (French, for the filler). */
const OPEN_WANT =
  "le plan qui ouvre, le plus vivant : quelqu'un de près qui regarde l'objectif et bouge (un sourire, un tour sur soi, les cheveux qui volent, un geste), dehors avec du ciel ou devant une vitrine claire ; sinon le plus beau plan qui bouge de son lieu. Son mot y clignote en très grand, puis le plan suivant apparaît dans ses clairs";
const WIDE_WANT =
  "un plan large de sa rue, de sa devanture ou de sa salle, fixe de préférence, où il se passe quelque chose (des gens qui passent, une porte qui s'ouvre) ; sinon n'importe quel plan large : il apparaît d'abord dans les clairs du plan d'avant, puis l'image suivante s'y pose en neuf cases au milieu";
const WANTS: Record<RaccordKind, string> = {
  0: WIDE_WANT,
  1: "un plan fixe et graphique de près, le sujet bien au milieu : une lampe, son enseigne, un présentoir, une vitrine, un produit posé, le mieux un peu sombre autour ; sinon un gros plan net de ce qu'elle fait : il arrive d'abord en neuf cases au milieu du plan d'avant, puis s'allume sur le temps fort",
  2: "un plan où quelque chose de net se détache devant : quelqu'un assis ou au travail, un comptoir, une table dressée, un meuble, ou vu d'en haut un objet au milieu (une tasse, une assiette, ses mains au travail) ; sinon un gros plan de son produit : ce qui se détache arrive d'abord détouré en trois morceaux sur le plan d'avant, à sa place",
  3: "le dernier plan : quelqu'un qui tient un produit ou un objet devant l'objectif (une tasse, un livre, un bouquet, une boîte), son lieu derrière ; sinon un produit net au milieu de l'image : il arrive d'abord seul, détouré, sur le plan d'avant, puis le Reel finit sur lui",
};
/** Its two pieces in a row: the first a wide plan of her inside, the second seen from above. */
const PIECE_WANTS = [
  "un plan large et fixe de son intérieur avec quelque chose de net devant (quelqu'un assis ou au travail, un comptoir, une table dressée, un meuble) ; sinon un plan où quelqu'un ou quelque chose se détache bien du fond : il arrive d'abord détouré en trois morceaux sur le plan d'avant, à sa place",
  "vu d'en haut ou de près, un objet net au milieu de l'image (une tasse, une assiette, un plateau, ses mains au travail, un produit posé sur sa table) ; sinon un gros plan de son produit : il arrive d'abord détouré en trois morceaux sur le plan d'avant, à sa place",
];

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ").replace(/ (\d+(?:er|e))\b/g, " $1");
  const display = "'" + brand.displayFont + "', 'Montserrat', 'Archivo Black', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Montserrat', 'Inter', sans-serif";

  // 1. Its frame: full frame when her videos are mostly upright, else whole in a 16:9 band on black (or as she asks).
  // Every raccord is laid in that box, where her shots are drawn: what arrives early lands where its shot will be.
  const format = setting("format", "auto");
  const wide = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const band = format === "horizontal" || (format === "auto" && n > 0 && wide * 2 > n);
  const bw = width;
  const bh = band ? Math.round((width * 9) / 16) : height;
  const by = band ? Math.round((height - bh) / 2) : 0;
  const box = { position: "absolute", left: 0, top: 0, width: bw, height: bh };
  const laid = { left: 0, top: 0, width: bw, height: bh };

  // 2. Each cut's raccord, from its timeline: 0 the double exposure, 1 the nine cells, 2 its subject in three pieces,
  // 3 its subject whole; the images of its hits, the start of its blend, the image its next shot lights up on.
  const kindOf = (k) => mark("kind_" + k, -1);
  const popsOf = (k) => [0, 1, 2, 3].map((j) => mark("pop_" + k + "_" + j, NaN)).filter(Number.isFinite);
  const nx = cur + 1 < n ? cur + 1 : -1;
  const kind = nx > 0 ? kindOf(cur) : -1;
  const pops = nx > 0 ? popsOf(cur) : [];
  const hit = pops.filter((p) => frame >= p).length;

  // 3. The nine cells: square, 27 % of the grid each, the grid 0,7 of the width (0,62 of a band's height), about the
  // subject of the shot they show, where Footage frames it (its focus, the original's lamp in the middle of its cells),
  // else the middle at 53 % of the height (the original's grid centred at 49 % and 54 %); laid in the original's order:
  // the middle, its column, the cross, the corners.
  const G = Math.round(Math.min(bw * 0.7, bh * 0.62));
  const C = Math.round(G * 0.27);
  const GAP = Math.round((G - 3 * C) / 2);
  const focusOf = (s) => {
    const f = s && s.focus;
    if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.y)) return { x: bw / 2, y: bh * 0.53 };
    const A = Number(s.aspect) || bw / bh;
    const dw = A > bw / bh ? bh * A : bw;
    const dh = A > bw / bh ? bh : bw / A;
    return { x: f.x * dw - Math.max(0, Math.min(dw - bw, f.x * dw - bw / 2)), y: f.y * dh - Math.max(0, Math.min(dh - bh, f.y * dh - bh / 2)) };
  };
  const centre = focusOf(nx > 0 ? shots[nx] : null);
  const gx = Math.round(Math.min(bw - G - 20, Math.max(20, centre.x - G / 2)));
  const gy = Math.round(Math.min(bh - G - 20, Math.max(20, centre.y - G / 2)));
  const ORDER = [[1, 1], [0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [0, 2], [2, 0], [2, 2]];
  const rect = (x, y, w, hh) => "M" + Math.round(x) + " " + Math.round(y) + "h" + Math.round(w) + "v" + Math.round(hh) + "h" + -Math.round(w) + "Z";
  const cellsPath = (count) => ORDER.slice(0, count).map(([r, c]) => rect(gx + c * (C + GAP), gy + r * (C + GAP), C, C)).join("");
  const STEPS = { 1: [1, 3, 5, 9], 2: [1, 5, 9], 3: [9] };
  // A shot brought in by the cells arrives dimmed (41 % of its light) and lights up in three images on its beat.
  const DIM = 0.59;

  const layers = [h(Footage, { key: "s" + cur, shot: cur, style: box })];
  const litAt = cur > 0 && kindOf(cur - 1) === 1 ? mark("lit_" + (cur - 1), -1) : -1;
  if (litAt > 0 && frame < litAt) layers.push(h("div", { key: "dim", style: { ...box, backgroundColor: "#000000", opacity: interpolate(frame, [litAt - 3, litAt], [DIM, 0], clamp) } }));

  if (nx > 0 && kind === 0) {
    // The double exposure: the next shot's first image where her shot is empty, her subject in front, more and more to
    // the cut: in her lights, her darks in front (« darken », the original's sky), or in her shadows when her shot is a
    // dark one, her lights in front (« lighten »: her face, not the next place, would hold the darken).
    const from = mark("blend_" + cur, shots[nx].from - 16);
    const lit0 = LightUnder(shots[0], 0, laid);
    const blend = !lit0 || lit0.mean >= 0.45 ? "darken" : "lighten";
    if (frame >= from) layers.push(h(Footage, { key: "x" + nx, shot: nx, style: { ...box, mixBlendMode: blend, opacity: interpolate(frame, [from, from + 6], [0.6, 1], clamp) } }));
  } else if (nx > 0 && hit > 0) {
    // Its subject cut out on its first image, where it will be: in three pieces (its two outer thirds, then its middle;
    // the side first changes from one raccord to the next) or whole; without a cut-out worth it, its picture in cells.
    const s = kind >= 2 ? SubjectBox(shots[nx], shots[nx].from, laid) : null;
    const cut = s && s.w * s.h >= bw * bh * 0.04 ? s : null;
    if (cut) {
      const pad = Math.round(bw * 0.02);
      const x0 = cut.x - pad;
      const x1 = cut.x + cut.w / 3;
      const x2 = cut.x + (2 * cut.w) / 3;
      const x3 = cut.x + cut.w + pad;
      const y0 = cut.y - pad;
      const hh = cut.h + 2 * pad;
      const left = rect(x0, y0, x1 - x0, hh);
      const right = rect(x2, y0, x3 - x2, hh);
      const middle = rect(x1, y0, x2 - x1, hh);
      const parts = kind === 3 ? [rect(x0, y0, x3 - x0, hh)] : cur % 2 ? [right, left, middle] : [left, right, middle];
      layers.push(h("div", { key: "p" + nx, style: { ...box, clipPath: "path('" + parts.slice(0, hit).join("") + "')" } }, h(Subject, { shot: nx, style: box })));
    } else {
      const steps = STEPS[kind] || STEPS[1];
      const count = steps[Math.min(steps.length, hit) - 1];
      layers.push(h("div", { key: "c" + nx, style: { ...box, clipPath: "path('" + cellsPath(count) + "')" } },
        h(Footage, { shot: nx, style: box }),
        kind === 1 ? h("div", { style: { ...box, backgroundColor: "#000000", opacity: DIM } }) : null));
    }
  }
  const frameBox = h("div", { key: "frame", style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, ...layers);

  // 4. Her word, in very bold round capitals across the frame (the original's « OK »: 96 % of its width, two thirds of its
  // height, plain, no outline nor shadow), over her first shot, blinking image by image: on at its images 0, 2, 4 to 10,
  // 12 and 14, then gone. In her colour, dark enough on a light picture, light enough on a dark one (the light under it,
  // read on her shot), else an ink or white. Full frame, in the upper half across the frame; in a band, within the
  // apps' margins.
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const BLINK = "101011111110101";
  const hf = hook ? frame - hook.from : -1;
  const wordBox = band ? { left: 140, top: by + Math.round(bh * 0.06), width: bw - 280, height: Math.round(bh * 0.88) } : { left: 40, top: 150, width: bw - 80, height: 780 };
  const luma = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return -1;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  const mine = [brand.accent, brand.palette && brand.palette.secondary, brand.palette && brand.palette.dark, brand.palette && brand.palette.light].filter((c) => luma(c) >= 0);
  const under = n ? LightUnder(shots[0], 0, laid, { x: wordBox.left, y: wordBox.top - by, w: wordBox.width, h: wordBox.height }) : null;
  const light = !under || under.mean >= 0.45;
  const INK = (light ? mine.find((c) => luma(c) <= 0.45) : mine.find((c) => luma(c) >= 0.55)) || (light ? "#141414" : "#ffffff");
  const word = hook && hf >= 0 && hf < BLINK.length && BLINK[hf] === "1" && frame < endAt
    ? h(FitText, { key: "word-" + keep(hook.text), style: { position: "absolute", ...wordBox }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: Math.round(wordBox.height * 0.9), lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", color: INK, whiteSpace: "nowrap", textAlign: "center" } }, keep(hook.text))
    : null;

  // 5. Its ending card, when she has one, over her last shot softly darkened: its title blinking in like her word, then
  // held; its line under it.
  const e = end ? frame - endAt : -1;
  const ending = end && e >= 0
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, backgroundColor: "rgba(0,0,0," + (0.4 * Math.min(1, (e + 1) / 6)).toFixed(3) + ")" } }),
        e < 4 && e % 2 === 1 ? null : h(FitText, { key: "t-" + keep(end.title), style: { position: "absolute", left: 140, top: band ? by + Math.round(bh * 0.12) : 520, width: bw - 280, height: band ? Math.round(bh * 0.46) : 400 }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 150, lineHeight: 1, textTransform: "uppercase", color: "#ffffff", textAlign: "center", textWrap: "balance", whiteSpace: "normal" } }, keep(end.title)),
        end.subtitle && e >= 6
          ? h(FitText, { key: "u-" + keep(end.subtitle), style: { position: "absolute", left: 140, top: band ? by + Math.round(bh * 0.62) : 940, width: bw - 280, height: band ? Math.round(bh * 0.26) : 220 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 54, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textWrap: "balance" } }, keep(end.subtitle))
          : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,0.6)" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, word, ending, extra);
}`;

export const raccords: MontageSkill = {
  key: "raccords",
  version: 1,
  bpm: BPM,
  // Its opening, at least one shot of its middle, its match and its last; its middle up to six (two rounds of three).
  shots: [4, 9],
  long: LONG,
  files: [4, 9],
  // A boom bap: slower is heavier, faster is busier.
  tempo: [80, 112],
  how: "Ses plans s'emboîtent : son mot en très grand clignote image par image sur le premier (quelqu'un qui sourit et bouge), puis le plan suivant apparaît dans ses clairs ; ensuite chaque plan arrive en avance sur le précédent, exactement à sa place, en morceaux sur les coups de la musique (son image en neuf cases au milieu, qui s'allume sur le temps fort ; puis ce qui s'y détache, détouré en trois morceaux ; puis entier), et la coupe le fait jouer ; la musique perd sa basse pendant que les morceaux arrivent et la retrouve sur la coupe. Plein écran en vertical ; ses vidéos horizontales entières dans une bande 16:9 sur du noir.",
  end: true,
  texts: [
    {
      slot: "mot",
      role: "hook",
      want: "un seul mot de 2 à 9 lettres, en très grandes capitales qui clignotent sur le premier plan : le mot de son nom qui la distingue (« Farine » pour « Maison Farine »), ou le mot le plus fort de sa demande (« Ouvert », « Nouveau », « Samedi », « Soldes »), jamais une phrase ni deux mots",
      max: 10,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : plein écran vertical, ou ses vidéos horizontales entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme ses vidéos (dans une bande sur du noir si la plupart sont horizontales)" },
        { value: "vertical", says: "plein écran vertical, une vidéo horizontale recadrée sur son sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 au milieu, sur du noir" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, a music's own): every length counted in sixteenths follows it.
    const bpm = tempo ?? BPM;
    const sixteenth = 15 / bpm;
    const { lengths, cuts } = raccordCuts(n);
    // With an ending card, its last shot held whole sixteenths longer (the engine's 1,6 s at least).
    const card = end ? Math.ceil((END_CARD + 0.05) / sixteenth) : 0;
    const spans = beatSpans(bpm, lengths.map((l, i) => (l + (i === lengths.length - 1 ? card : 0)) / 4));
    const duration = spans.at(-1)!.end;
    // A time in sixteenths from its first beat, on the Reel's clock (s).
    const at = (s: number) => round3((PICKUP + s) * sixteenth);
    // What each shot wants, by the raccord that brings it in: its two pieces in a row alternate a wide plan and a top view.
    let pieces = 0;
    const wants = spans.map((_, i) => {
      if (i === 0) return OPEN_WANT;
      const kind = cuts[i - 1]!.kind;
      return kind === 2 ? PIECE_WANTS[pieces++ % 2]! : WANTS[kind];
    });
    const marks: Record<string, number> = {};
    cuts.forEach((c, k) => {
      marks[`kind_${k}`] = c.kind;
      c.pops.forEach((p, j) => (marks[`pop_${k}_${j}`] = toFrame(at(p))));
      if (c.blend !== undefined) marks[`blend_${k}`] = toFrame(at(c.blend));
      if (c.lit !== undefined) marks[`lit_${k}`] = toFrame(at(c.lit));
    });
    // Each bar's break, its bass gone from its sixteenth 10,5 to the next bar's first beat, to the Reel's end.
    const filters: { kind: "thin"; from: number; to: number; open: number }[] = [];
    for (let b = 0; at(b * BAR + BREAK) < duration - 0.05 && filters.length < 8; b++) filters.push({ kind: "thin", from: at(b * BAR + BREAK), to: Math.min(duration, at((b + 1) * BAR)), open: 0.02 });
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: `${wants[i]} (au moins ${comma(s.end - s.start)} s)` })),
      // Her word blinks over its first half second.
      texts: { mot: { from: 0, to: Math.min(duration, WORD) } },
      marks,
      // The shots whose subject arrives cut out before them: only those are cut out.
      cutouts: cuts.flatMap((c, k) => (c.kind >= 2 ? [k + 1] : [])),
      music: {
        // Its first strong beat 0,334 s in (its word blinks over the pickup); each bar's break; faded at its end.
        downbeat: at(0),
        filters,
        end: { at: duration, fade: 0.05 },
      },
    };
  },
  code: CODE,
};
