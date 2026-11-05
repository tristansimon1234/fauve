import { beatSpans, type MontageSkill } from "../skills.ts";

// « Écran partagé titré », version 2, written again on its original's fiche (docs/fiches/ecran-partage.md: measured image
// by image at 30 i/s, each half measured on its own, its music measured, the video watched and heard by Gemini; Tristan:
// « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). On black, a card with rounded
// corners cut in two halves that touch, still from the first image to the last: her or her team at work in one, what
// it gives in the other at the same moment (the dish set down in front of the camera, its last touch). Its music has no
// steady beat; its cuts follow a grid of half a second (120 BPM), and every length below is in those beats, so its cuts
// fall where the original's do (within an image):
//   five pairs of 4,5 · 7 · 4 · 5,85 · 4,2 beats, both halves cutting on the same image, never one alone, never a shot
//   full frame; two small titles in a classic book serif, white, one on each half, just under the middle of the card,
//   that answer each other (« The Artists », « The Art »), still the whole Reel; a clean end on the last pair.
// Each half plays its own passage over its whole pair at half its speed (the original's play at their own: a Reel's
// shots follow one another, so each half has half its pair to play; the engine cannot lay two passages on one moment
// yet). An odd number of shots takes a second passage of one of her videos: a short pair more in the middle plays the
// start of a video in one half and the rest of it in the other, never a shot alone full frame. Her photos stay still,
// her videos play. Its layout follows her files (Tristan: « format par défaut [comme ses vidéos], et changement à la
// demande du user »): the original's 4:3 card at the middle of the screen, its halves 2:3, when they are mostly
// vertical; full screen, one half above the other, when they are horizontal (a 16:9 video keeps 38 % of its width in a
// 2:3 half, 63 % in a 9:8 one); or as she asks. Its ending card, which the original has not, only when she wants one
// (an offer, an announcement).

const BPM = 120;
/**
 * Its pairs, in beats of its cuts' grid: the opening, the middle ones in turn, the last one (the original's 4,5 · 7 · 4
 * on its half-beats, then 5,85 and 4,2 as measured: its cuts on its images 68, 173, 233, 320 and its end on 383).
 */
const OPENING = 4.5;
const MIDDLE = [7, 4, 5.85];
const LAST = 4.2;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS); the last pair held whole beats longer for it. */
const END_CARD = 1.6;
/** Its music without its bass until this beat (the third bar: the original's held bass comes in at 4,55 s). */
const BASS = 8;
/**
 * With an odd count, a pair in the middle is one shot alone, this long (beats): shorter than any full pair, so an even
 * count keeps its own length (for a length she asks for, a tie went to the smaller, odd count).
 */
const SOLO_BEATS = 3;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const SOLO = mark("solo", -1);
  const n = shots.length;

  // Its layout, as her files are: the original's 4:3 card at the middle of the screen, its halves side by side (2:3), when
  // most of them are vertical; the card over the whole screen, one half above the other (9:8), when most are horizontal;
  // or as she asks: the card, side by side over the whole screen (9:32), one above the other.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const stacked = format === "empile" || (format === "auto" && wideShots * 2 > n);
  const boxed = format === "carte" || (format === "auto" && !stacked);
  const fh = boxed ? Math.round((width * 3) / 4) : height;
  const fy = boxed ? Math.round((height - fh) / 2) : 0;

  // 1. The card on pure black, still from start to end, as the original's: its margins (0,9 % of the width on the sides,
  // 1,8 % of the height above it, 1,5 % below), its rounded corners (2,8 % of its width); cut at 50 % by a straight line,
  // its two halves touching, square in the middle.
  const cx = Math.round(width * 0.009);
  const cy = fy + Math.round(fh * 0.018);
  const cw = width - 2 * cx;
  const ch = fh - Math.round(fh * 0.018) - Math.round(fh * 0.015);
  const radius = Math.round(cw * 0.028);
  const first = stacked ? { x: 0, y: 0, w: cw, h: Math.round(ch / 2) } : { x: 0, y: 0, w: Math.round(cw / 2), h: ch };
  const second = stacked ? { x: 0, y: first.h, w: cw, h: ch - first.h } : { x: first.w, y: 0, w: cw - first.w, h: ch };

  // Its pairs, in order: two shots (the person at work, what it gives), or one shot alone (an odd count) whose start plays
  // in one half and the rest in the other; the two halves always cut together.
  const pairs = [];
  for (let i = 0; i < n; ) {
    const solo = i === SOLO || i + 1 >= n;
    const last = shots[solo ? i : i + 1];
    pairs.push({ a: i, b: solo ? i : i + 1, solo, from: shots[i].from, to: last.from + last.durationInFrames });
    i += solo ? 1 : 2;
  }
  const now = pairs.find((p) => frame >= p.from && frame < p.to) || pairs[pairs.length - 1];

  // Both halves play from their pair's first image, each its whole passage over the pair, at half its speed (a Reel's
  // shots follow one another, so each half has half the pair); an image between two of hers is the two blended, the next
  // one always laid (unseen on the others) so the live preview does not open and close a video at every image. A photo
  // stays still; nothing moves, zooms nor slides in (cuts only).
  const P = now ? Math.max(1, now.to - now.from) : 1;
  const rel = now ? Math.max(0, Math.min(P - 1, frame - now.from)) : 0;
  const pane = (key, k, part, box) => {
    const s = shots[k];
    const style = { position: "absolute", left: 0, top: 0, width: box.w, height: box.h };
    let inside = h(Footage, { shot: k, style });
    if (s && s.kind === "video") {
      const length = Math.max(1, s.durationInFrames);
      const cut = Math.floor(length / 2);
      const start = part === 2 ? cut : 0;
      const span = part === 0 ? length : part === 1 ? cut : length - cut;
      const t = start + (rel * span) / P;
      const at = Math.floor(t);
      const blend = t - at;
      inside = [
        h(Footage, { key: "a", shot: k, at: frame - at, style }),
        h(Footage, { key: "b", shot: k, at: frame - at - 1, style: { ...style, opacity: blend > 0.01 ? Math.round(blend * 100) / 100 : 0 } }),
      ];
    }
    return h("div", { key, style: { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden" } }, inside);
  };
  // A shot alone in its pair (an odd count): a video's start in one half, the rest of it in the other; a photo, still,
  // has no rest: it is laid across the card, the line between its halves on it, rather than twice.
  const alone = now && now.solo && !(shots[now.a] && shots[now.a].kind === "video");
  const panes = !now
    ? null
    : alone
      ? pane("p0", now.a, 0, { x: 0, y: 0, w: cw, h: ch })
      : now.solo
        ? [pane("p0", now.a, 1, first), pane("p1", now.a, 2, second)]
        : [pane("p0", now.a, 0, first), pane("p1", now.b, 0, second)];
  // Its ending card, only when she has one: the last pair darkened under its words.
  const endAt = end ? end.from : durationInFrames + 1;
  const veil = end && frame >= endAt ? h("div", { style: { position: "absolute", left: 0, top: 0, width: cw, height: ch, background: "#000000", opacity: Math.round(55 * Math.min(1, (frame - endAt + 1) / 6)) / 100 } }) : null;
  const card = h("div", { style: { position: "absolute", left: cx, top: cy, width: cw, height: ch, borderRadius: radius, overflow: "hidden", backgroundColor: "#000000" } }, panes, veil);

  // 2. Its two small titles, on the card, not on its halves, still from the first image to the last: a classic book
  // serif, roman, in title case, white, with a tight dark edge and a soft shade so they read on a pale plate too (the
  // original's have none: « The Art » read badly on its white plates); 50 px (the original's 42 would be under the
  // check's 48). Side by side, just under the middle of the card (54 % of its height), at 43 % and 51 % of their halves
  // (one on the person, the other on what she makes), the right one left of the apps' buttons; one above the other,
  // centred, as far above the line between the halves as below it: just under the middle of the upper half (56 %, on
  // the person rather than her face), a little above the middle of the lower one (44 %, clear of the apps' caption). A
  // long title goes on two lines rather than shrinking; a word is never cut at its hyphen.
  const display = "'" + brand.displayFont + "', 'EB Garamond', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const shade = "0 0 1px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.45), 0 2px 14px rgba(0,0,0,0.28)";
  const SIZE = 50;
  const LINE = 1.15;
  const BOX = Math.round(SIZE * LINE * 2 + 12);
  const capital = (s) => { const t = String(s || "").trim(); return t ? t.charAt(0).toLocaleUpperCase("fr") + t.slice(1) : t; };
  const unbroken = (text) => h("span", { style: { display: "block" } }, String(text || "").split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || !w ? w : h("span", { key: i, style: { whiteSpace: "nowrap" } }, w))));
  const person = reelTexts.find((t) => t.role === "hook");
  const result = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== person && t !== result);
  const buttons = width - 150;
  // Its width from its letters (a book serif's letter is about half its size), centred on its place within its room.
  const title = (t, key, centre, y, lo, hi) => {
    if (!t || frame < t.from || frame >= Math.min(t.to, endAt)) return null;
    const w = Math.min(hi - lo, Math.round(String(t.text).length * SIZE * 0.46) + 24);
    const left = Math.max(lo, Math.min(hi - w, Math.round(centre - w / 2)));
    const top = Math.round(y - BOX / 2);
    return h(FitText, { key, style: { position: "absolute", left, top, width: w, height: BOX }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: SIZE, lineHeight: LINE, letterSpacing: "0.005em", color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade } }, unbroken(capital(t.text)));
  };
  const room = (y) => (y + BOX / 2 > height / 2 ? buttons : width - 50);
  const titles = stacked
    ? [
        title(person, "t0", width / 2, cy + Math.round(first.h * 0.56), 50, room(cy + first.h * 0.56)),
        title(result, "t1", width / 2, cy + second.y + Math.round(second.h * 0.44), 50, room(cy + second.y + second.h * 0.44)),
      ]
    : [
        title(person, "t0", cx + Math.round(first.w * 0.43), cy + Math.round(ch * 0.54), 50, cx + first.w - 20),
        title(result, "t1", cx + second.x + Math.round(second.w * 0.51), cy + Math.round(ch * 0.54), cx + second.x + 20, room(cy + ch * 0.54)),
      ];

  // Any other text of the Reel (none in its slots): a plain white line, on the black above the card, else at the top of
  // it, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: boxed ? Math.max(100, cy - 140 - i * 120) : 150 + i * 120, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: shade } }, t.text));

  // 3. Its ending card, which the original has not (it ends clean on its last pair), only when she has one: its title in
  // the serif across the middle of the card, a line in small capitals under it.
  const mid = Math.round(cy + ch / 2);
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? mid - 230 : mid - 150, width: width - 280, height: 300 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 96, lineHeight: 1.05, color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade, justifyContent: end.subtitle ? "flex-end" : "center" } }, unbroken(end.title)),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: mid + 86, width: width - 280, height: 170 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.15, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", justifyContent: "flex-start", textShadow: shade, opacity: frame >= endAt + 6 ? 1 : 0 } }, unbroken(end.subtitle))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, card, titles, extra, ending);
}`;

type Slot = { side: "left" | "right" | "solo"; beats: number; first: boolean; last: boolean };

/**
 * Its shots in time order for n: pairs of two shots (the person at work, then what it gives), each half of its pair,
 * the opening, the middle ones in turn, the last one; with an odd count, a short pair more in the middle, one shot alone
 * (its start in one half, the rest in the other).
 */
function slots(n: number, endBeats: number): Slot[] {
  const full = Math.floor(n / 2);
  const odd = n % 2 === 1;
  const out: Slot[] = [];
  if (!full && odd) out.push({ side: "solo", beats: OPENING + endBeats, first: true, last: true });
  for (let k = 0; k < full; k++) {
    if (odd && k === Math.floor(full / 2)) out.push({ side: "solo", beats: SOLO_BEATS, first: false, last: false });
    const last = k === full - 1;
    const beats = (k === 0 ? OPENING : last ? LAST : MIDDLE[(k - 1) % MIDDLE.length]!) + (last ? endBeats : 0);
    out.push({ side: "left", beats: beats / 2, first: k === 0, last }, { side: "right", beats: beats / 2, first: k === 0, last });
  }
  return out;
}

/** Where each half is, in her words, for the filler: as the layout her files give, or the one she asked for. */
function halves(format: string | undefined): [string, string] {
  if (format === "empile") return ["du haut", "du bas"];
  if (format === "carte" || format === "plein-ecran") return ["de gauche", "de droite"];
  return ["de gauche (du haut quand ses fichiers sont horizontaux)", "de droite (du bas quand ses fichiers sont horizontaux)"];
}

export const ecranPartage: MontageSkill = {
  key: "ecran-partage",
  // 2: written again on its original's fiche: its card 4:3 on black with its halves side by side, or one above the other
  // when her files are horizontal (its format setting); its cuts within an image of the original's (120 BPM), both halves
  // always together, never a shot alone full frame; its titles in a book serif just under the middle of the card; its
  // music without its bass to the third bar, cut dead at the end; no ending card unless she asks, no vignette nor grain.
  version: 2,
  bpm: BPM,
  shots: [6, 10],
  // Up to 22 for a length she asks for: eleven pairs, about 30 s at its own tempo.
  long: 22,
  files: [4, 10],
  how: "Une carte aux coins arrondis sur du noir, coupée en deux moitiés qui se touchent : côte à côte, hautes et étroites (la carte 4:3 de l'original au milieu de l'écran), quand la plupart de ses fichiers sont verticaux ; l'une sur l'autre, larges, sur tout l'écran, quand ils sont horizontaux (un fichier de l'autre format n'y garde que son milieu : son sujet doit être au centre de l'image). Dans l'une, elle ou son équipe au travail ; dans l'autre, au même moment, ce que ce geste donne : le plat qu'on pose devant la caméra, la dernière touche. Les deux moitiés coupent toujours ensemble, une paire toutes les deux à trois secondes et demie, chacune jouée au ralenti sur toute sa paire ; la dernière sur le résultat fini. Deux petits titres en serif blanc, un sur chaque moitié, qui se répondent (« Les artistes » / « L'art »), tenus tout le Reel. Il finit net sur la dernière paire, sans carte de fin, sauf si elle en demande une (une offre, une annonce).",
  end: true,
  texts: [
    {
      slot: "personne",
      role: "hook",
      want: "le petit titre de la moitié de la personne au travail : qui fait, en 1 à 3 mots (une forme comme « Les artistes », « Les fleuristes », « L'atelier »)",
      max: 16,
      required: true,
    },
    {
      slot: "resultat",
      role: "caption",
      want: "le petit titre de la moitié du résultat, qui répond au premier, souvent en le raccourcissant : ce que ça donne, en 1 à 3 mots (« L'art » pour « Les artistes », « Les fleurs » pour « Les fleuristes », « L'œuvre » pour « L'atelier »)",
      max: 16,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "la mise en page : la carte de l'original, ses deux moitiés côte à côte sur tout l'écran, ou l'une sur l'autre",
      choices: [
        { value: "auto", says: "comme ses fichiers : la carte de l'original quand ils sont verticaux, les deux moitiés l'une sur l'autre quand ils sont horizontaux" },
        { value: "carte", says: "la carte 4:3 de l'original au milieu de l'écran, sur du noir, ses deux moitiés côte à côte" },
        { value: "plein-ecran", says: "deux moitiés côte à côte, hautes et étroites, sur tout l'écran" },
        { value: "empile", says: "deux moitiés l'une sur l'autre sur tout l'écran : la personne en haut, le résultat en bas" },
      ],
    },
  ],
  // Its original's grade (docs/fiches/ecran-partage.md, effect 6): dark and warm, deep blacks; no vignette nor grain.
  finish: { grain: 0, vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At its own tempo, or at a music's when the Reel follows one: every length in beats, so a slower tempo makes it
    // longer and calmer, a faster one shorter, its cuts still on its grid.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    // With an ending card, its last pair held whole beats longer, so her words have the card's time.
    const list = slots(n, end ? Math.ceil(END_CARD / beat - 1e-6) : 0);
    const spans = beatSpans(bpm, list.map((s) => s.beats));
    const duration = spans.at(-1)!.end;
    const [a, b] = halves(options.settings?.format);
    const want = (s: Slot) => {
      if (s.side === "solo")
        return "les deux moitiés à la fois : une vidéo où le geste et ce qu'il donne se suivent (ses mains qui dressent puis l'assiette finie, la coupe puis la coiffure) ; son début joue dans une moitié, sa suite dans l'autre, en même temps, au ralenti";
      if (s.side === "left")
        return `${s.first ? "le plan qui ouvre, " : ""}la moitié ${a} : elle ou son équipe au travail, la caméra posée (de dos à son poste, les mains qui font, un visage concentré pris d'en bas, l'atelier en plan large avec quelqu'un derrière) ; joué au ralenti sur toute la paire, en même temps que ce que ce geste donne dans l'autre moitié`;
      return s.last
        ? `la moitié ${b} : le résultat fini, le plus beau, posé devant la caméra ou qui reçoit sa dernière touche, la caméra fixe ; joué au ralenti jusqu'à la fin${end ? ", sous la carte de fin" : ""}`
        : `la moitié ${b} : ce que ce geste donne (le même plat, la même coupe, la même pièce), la caméra fixe, filmé du dessus de préférence : quelqu'un le pose devant la caméra (le passage commence juste avant qu'il entre dans l'image) ou la dernière touche tombe dessus ; joué au ralenti sur toute la paire, en même temps que le geste`;
    };
    // Both titles the whole Reel (up to its ending card).
    const to = end ? round(duration - END_CARD) : duration;
    return {
      duration,
      // Its music: without its bass to the third bar (the original's held bass comes in at 4,55 s), cut dead with the
      // last image, as the original's; no sound effect (its original has none).
      music: { filters: [{ kind: "thin", from: 0, to: round(BASS * beat) }], end: { at: duration } },
      shots: spans.map((s, i) => ({ ...s, want: want(list[i]!) })),
      texts: { personne: { from: 0, to }, resultat: { from: 0, to } },
      marks: { solo: list.findIndex((s) => s.side === "solo") },
    };
  },
  code: CODE,
};
