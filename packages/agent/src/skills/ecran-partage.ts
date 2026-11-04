import { beatSpans, type MontageSkill } from "../skills.ts";

// « Écran partagé titré », written on its original (house/originals/ecran-partage.mp4, 12,8 s, looked at image by
// image): on black, a card with rounded corners cut in two halves side by side, no gap between them; the person at work
// in the left one, what she makes in the right one; a small serif title in white in the middle of each half (« The
// Artists », « The Art »), there from the first image to the last; both halves cut together, a pair every two to three
// seconds and a half, the last one the finished result. Made vertical as the model's reference code does (two halves
// side by side, full height). A Reel's timeline gives each shot its own time, so the two halves of a pair share theirs:
// each plays its passage at half speed over the whole pair, both moving the whole time. An odd shot is the person alone,
// full frame, for two beats in the middle (the model's reading), its titles away. Its ending card (an offer, an
// announcement) is the editorial pair's: its title in the serif over the last pair, darkened, a line in small capitals.

const BPM = 80;
/** A pair lasts three beats, then four, in turn (the original's 2,2 s and 3,5 s); the last one is held a beat longer. */
const PAIR_BEATS = [3, 4];
const LAST_HOLD = 1;
/** With an ending card, the last pair is held this many beats more (the card is its last 1,6 s). */
const END_BEATS = 2;
/** The person alone, full frame, when she has an odd number of shots. */
const SOLO_BEATS = 2;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const SOLO = mark("solo", -1);
  const n = shots.length;
  const display = "'" + brand.displayFont + "', 'Instrument Serif', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const person = reelTexts.find((t) => t.role === "hook");
  const result = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== person && t !== result);
  const endAt = end ? end.from : durationInFrames + 1;
  // White on her footage with the model's soft shade, and a tight dark edge so it reads on a white plate too.
  const shade = "0 1px 2px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.35), 0 2px 14px rgba(0,0,0,0.3)";

  // Its moments, in order: pairs (the person on the left, what she makes on the right) and the person alone.
  const moments = [];
  for (let i = 0; i < n; ) {
    const s = shots[i];
    const pair = i !== SOLO && i + 1 < n && i + 1 !== SOLO;
    const lastShot = pair ? shots[i + 1] : s;
    moments.push({ a: i, b: pair ? i + 1 : -1, from: s.from, to: lastShot.from + lastShot.durationInFrames });
    i += pair ? 2 : 1;
  }
  const now = moments.find((m) => frame >= m.from && frame < m.to) || moments[moments.length - 1];

  // 1. The card: black around it, rounded corners, its two halves touching.
  const M = 12;
  const W = width - M * 2;
  const H = height - M * 2;
  const half = Math.round(W / 2);
  // Both halves of a pair play from its start at half speed (each passage lasts half the pair), so both move the whole
  // time; an image between two of hers is the two blended, so the slow motion stays smooth.
  const rel = now ? Math.max(0, frame - now.from) : 0;
  const step = Math.floor(rel / 2);
  const between = rel % 2 === 1;
  const pane = (shot, x, w) => h("div", { key: "p" + x, style: { position: "absolute", left: x, top: 0, width: w, height: H, overflow: "hidden" } },
    h(Footage, { shot, at: frame - step, style: { left: 0, top: 0, width: w, height: H } }),
    between && shots[shot] && shots[shot].kind === "video" ? h(Footage, { shot, at: frame - step - 1, style: { left: 0, top: 0, width: w, height: H, opacity: 0.5 } }) : null);
  const inside = !now
    ? null
    : now.b < 0
      // The person alone, full frame, at her own pace.
      ? h(Footage, { shot: now.a, style: { left: 0, top: 0, width: W, height: H } })
      : [pane(now.a, 0, half), pane(now.b, half, W - half)];
  const card = h("div", { style: { position: "absolute", left: M, top: M, width: W, height: H, borderRadius: 22, overflow: "hidden", backgroundColor: "#000000" } }, inside);

  // 2. A small serif title in the middle of each half, the whole Reel (not while the person is alone); clear of the
  // apps' buttons (above the middle), with room for a font whose letters reach far above and below their line; a title
  // too long for its line (a wide font) goes on two rather than shrinking.
  const label = { fontFamily: display, fontWeight: 400, fontSize: 54, lineHeight: 1.1, letterSpacing: "0.005em", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade };
  const paired = now && now.b >= 0;
  const title = (t, center) => t && paired && frame >= t.from && frame < Math.min(t.to, endAt)
    ? h(FitText, { key: "t" + center, style: { position: "absolute", left: center - 230, top: 812, width: 460, height: 134 }, innerStyle: { ...label, whiteSpace: "normal", textWrap: "balance" } }, t.text)
    : null;
  const titles = [title(person, M + Math.round(half / 2)), title(result, M + half + Math.round((W - half) / 2))];

  // Any other text of the Reel (none in its slots): a plain line under the titles, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 1180, width: width - 280, height: 150 }, innerStyle: { ...label, whiteSpace: "normal", textWrap: "balance" } }, t.text));

  // 3. Its ending card: the last pair darkened, its title in the serif across the middle, a line in small capitals.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, { style: { backgroundColor: "rgba(0,0,0," + (0.55 * Math.min(1, (frame - endAt + 1) / 6)).toFixed(3) + ")" } },
        h(FitText, { style: { position: "absolute", left: 140, top: 680, width: width - 280, height: 340 }, innerStyle: { ...label, fontSize: 116, lineHeight: 1.0, whiteSpace: "normal", textWrap: "balance" } }, String(end.title || "")),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1046, width: width - 280, height: 200 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.15, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "normal", textWrap: "balance", justifyContent: "flex-start", textShadow: shade, opacity: frame >= endAt + 6 ? 1 : 0 } }, end.subtitle)
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, card, titles, extra, ending);
}`;

const round = (s: number) => Math.round(s * 100) / 100;

type Slot = { side: "left" | "right" | "solo"; beats: number; last: boolean };

/** Its shots in time order for n: pairs (left, right) of three or four beats in turn, the person alone in the middle when n is odd. */
function slots(n: number, end: boolean): Slot[] {
  const pairs = Math.max(1, Math.floor(n / 2));
  const solo = n % 2 === 1;
  const soloAfter = Math.floor(pairs / 2);
  const out: Slot[] = [];
  for (let k = 0; k < pairs; k++) {
    if (solo && k === soloAfter) out.push({ side: "solo", beats: SOLO_BEATS, last: false });
    const last = k === pairs - 1;
    const beats = PAIR_BEATS[k % PAIR_BEATS.length]! + (last ? LAST_HOLD + (end ? END_BEATS : 0) : 0);
    out.push({ side: "left", beats: beats / 2, last }, { side: "right", beats: beats / 2, last });
  }
  return out;
}

export const ecranPartage: MontageSkill = {
  key: "ecran-partage",
  version: 1,
  bpm: BPM,
  shots: [6, 10],
  files: [4, 10],
  how: "L'écran coupé en deux moitiés côte à côte, aux coins arrondis sur fond noir : la personne au travail à gauche, ce qu'elle fait à droite, en même temps et au ralenti ; un petit titre en serif blanc au milieu de chaque moitié, tenu tout le Reel ; les deux moitiés coupent ensemble sur le temps, une paire toutes les deux à trois secondes, la dernière sur le résultat fini. Avec un nombre impair de plans, la personne passe seule en plein écran un instant au milieu.",
  end: true,
  texts: [
    { slot: "personne", role: "hook", want: "le petit titre de la moitié gauche : qui travaille ou ce qu'on y fait, 1 à 3 mots (une forme comme « les mains », « l'équipe », « le geste »)", max: 16, required: true },
    { slot: "resultat", role: "caption", want: "le petit titre de la moitié droite : ce que ça donne, 1 à 3 mots (une forme comme « l'œuvre », « l'assiette », « le résultat »)", max: 16, required: true },
  ],
  timeline(n, { end }) {
    const list = slots(n, end);
    const spans = beatSpans(BPM, list.map((s) => s.beats));
    const duration = spans.at(-1)!.end;
    const want = (s: Slot) =>
      s.side === "solo"
        ? "un plan fort de la personne au travail, seule en plein écran un instant (à sa vitesse)"
        : s.side === "left"
          ? "la personne au travail (un geste, les mains, un visage concentré), dans la moitié gauche, haute et étroite (le centre de l'image compte) ; joué au ralenti, en même temps que le plan d'à côté"
          : s.last
            ? "le résultat fini, le plus beau, dans la moitié droite, haute et étroite ; joué au ralenti jusqu'à la fin"
            : "ce que ce geste donne (le plat, la coupe, le produit, la pièce), dans la moitié droite, haute et étroite (le centre de l'image compte) ; joué au ralenti, en même temps que le plan d'à côté";
    // Both titles the whole Reel (up to its ending card).
    const to = end ? round(duration - 1.6) : duration;
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: want(list[i]!) })),
      texts: { personne: { from: 0, to }, resultat: { from: 0, to } },
      marks: { solo: list.findIndex((s) => s.side === "solo") },
    };
  },
  code: CODE,
};
