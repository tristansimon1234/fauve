import { END_CARD_SECONDS, beatSpans, type MontageSkill } from "../skills.ts";

// « Écran partagé titré », version 3, written again on its original's fiche (docs/fiches/ecran-partage.md: measured image
// by image at 30 i/s, each half measured on its own, its music measured, the video watched and heard by Gemini; Tristan:
// « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). On black, a card with rounded
// corners cut in two halves that touch, still from the first image to the last: her or her team at work in one, what
// it gives in the other at the same moment (the dish set down in front of the camera, its last touch). Its music has no
// steady beat; its cuts follow a grid of half a second (120 BPM), and every length below is in those beats, so its cuts
// fall where the original's do (within an image):
//   five pairs of 4,5 · 7 · 4 · 5,85 · 4,2 beats, both halves cutting on the same image, never one alone, never a shot
//   full frame; two small titles in a classic book serif, white, one on each half, just under the middle of the card,
//   that answer each other (« The Artists », « The Art »), still the whole Reel; a clean end on the last pair.
// Since version 3, each half plays its own passage at its own speed, as the original's do: the two shots of a pair are
// laid on the same moment (SkillShot.beside, the engine's simultaneous shots: the second half's time counted once),
// where version 2 had each half play its passage at half its speed over the pair, the images between two blended. An
// odd number of shots takes a short pair more in the middle, one video alone: its gesture plays in one half while the
// other holds its last image, what it gives; never a shot alone full frame. Her photos stay still, her videos play. Its layout follows her files (Tristan: « format par défaut [comme ses vidéos], et changement à la
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
/** The engine's ending card: the Reel's last 2,5 s (motion.ts, END_CARD_SECONDS); the last pair held whole beats longer for it. */
const END_CARD = END_CARD_SECONDS;
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
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;

  // Its layout over the whole screen, as her files are: its halves side by side (9:32) when most of them are vertical, one
  // above the other (9:8) when most are horizontal; or as she asks: the original's 4:3 card on black, its halves side by
  // side (2:3), side by side over the whole screen, one above the other.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const stacked = format === "empile" || (format === "auto" && wideShots * 2 > n);
  const boxed = format === "carte";
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

  // Its pairs, in order: two shots that start on the same image, laid side by side on that moment (the person at work,
  // what it gives: the second half is a shot beside the first), or one shot alone (an odd count); the two halves always
  // cut together. Shots that all follow one another (a plan of the editor's, which lays none beside another) are paired
  // two by two instead, each half played over its pair at half its speed, as version 2 did.
  const together = shots.some((s, i) => i > 0 && Math.abs(s.from - shots[i - 1].from) <= 1);
  const pairs = [];
  for (let i = 0; i < n; ) {
    const b = i + 1 < n && (!together || Math.abs(shots[i + 1].from - shots[i].from) <= 1) ? i + 1 : -1;
    const ends = (k) => shots[k].from + shots[k].durationInFrames;
    pairs.push({ a: i, b, from: shots[i].from, to: b >= 0 ? Math.max(ends(i), ends(b)) : ends(i) });
    i += b >= 0 ? 2 : 1;
  }
  const now = pairs.find((p) => frame >= p.from && frame < p.to) || pairs[pairs.length - 1];

  // Each half plays its own passage at its own speed from their pair's first image, as the original's: a video plays,
  // a photo stays still; nothing moves, zooms nor slides in (cuts only). « held »: its last image held, what it gives.
  // Two shots one after the other (the editor's plan): each over the whole pair, an image between two blended.
  const P = now ? Math.max(1, now.to - now.from) : 1;
  const pane = (key, k, box, held) => {
    const s = shots[k];
    const style = { position: "absolute", left: 0, top: 0, width: box.w, height: box.h };
    let inside = held && s && s.kind === "video" ? h(Footage, { shot: k, at: frame - s.durationInFrames, style }) : h(Footage, { shot: k, style });
    if (!together && s && s.kind === "video" && now && now.b >= 0) {
      const t = (Math.max(0, Math.min(P - 1, frame - now.from)) * Math.max(1, s.durationInFrames)) / P;
      const at = Math.floor(t);
      const mix = Math.round((t - at) * 100) / 100;
      inside = [
        h(Footage, { key: "a", shot: k, at: frame - at, style }),
        h(Footage, { key: "b", shot: k, at: frame - at - 1, style: { ...style, opacity: mix > 0.01 ? mix : 0 } }),
      ];
    }
    return h("div", { key, style: { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden" } }, inside);
  };
  // A shot alone in its pair (an odd count): a video's gesture plays in one half while the other holds its last image,
  // what it gives; a photo, still, is laid across the card rather than twice.
  const alone = Boolean(now) && now.b < 0;
  const still = alone && !(shots[now.a] && shots[now.a].kind === "video");
  const panes = !now
    ? null
    : still
      ? pane("p0", now.a, { x: 0, y: 0, w: cw, h: ch }, false)
      : alone
        ? [pane("p0", now.a, first, false), pane("p1", now.a, second, true)]
        : [pane("p0", now.a, first, false), pane("p1", now.b, second, false)];
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
 * Its shots in time order for n: pairs of two shots laid on the same moment (the person at work, then what it gives
 * beside it), the opening, the middle ones in turn, the last one; with an odd count, a short pair more in the middle,
 * one shot alone. `beats`: the pair's (its second half laid beside its first, the same beats).
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
    out.push({ side: "left", beats, first: k === 0, last }, { side: "right", beats, first: k === 0, last });
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
  // 3: its two halves laid on the same moment (the engine's simultaneous shots), each at its own speed, as the
  // original's, where they played at half speed, their images blended; a video alone in its pair plays its gesture
  // beside its last image.
  // 4: over the whole screen by default, its halves side by side for her vertical files, one above the other for her
  // horizontal ones; the original's card on black only when she asks for it (Tristan, 6 November, on seven benches:
  // « vertical please », « tout vertical please »).
  version: 4,
  bpm: BPM,
  shots: [6, 10],
  // Up to 22 for a length she asks for: eleven pairs, about 30 s at its own tempo.
  long: 22,
  files: [4, 10],
  how: "L'écran coupé en deux moitiés qui se touchent, sur tout l'écran : côte à côte, hautes et étroites, quand la plupart de ses fichiers sont verticaux ; l'une sur l'autre, larges, quand ils sont horizontaux (un fichier de l'autre format n'y garde que son milieu : son sujet doit être au centre de l'image) ; la carte 4:3 aux coins arrondis de l'original, sur du noir, à sa demande. Dans l'une, elle ou son équipe au travail ; dans l'autre, au même moment, ce que ce geste donne : le plat qu'on pose devant la caméra, la dernière touche. Les deux moitiés jouent en même temps, chacune à sa vitesse, et coupent toujours ensemble, une paire toutes les deux à trois secondes et demie ; la dernière sur le résultat fini. Deux petits titres en serif blanc, un sur chaque moitié, qui se répondent (« Les artistes » / « L'art »), tenus tout le Reel. Il finit net sur la dernière paire, sans carte de fin, sauf si elle en demande une (une offre, une annonce).",
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
      want: "la mise en page : sur tout l'écran comme ses fichiers, la carte de l'original sur du noir, ses deux moitiés côte à côte sur tout l'écran, ou l'une sur l'autre",
      choices: [
        { value: "auto", says: "sur tout l'écran, comme ses fichiers : les deux moitiés côte à côte quand ils sont verticaux, l'une sur l'autre quand ils sont horizontaux" },
        { value: "carte", says: "la carte 4:3 de l'original au milieu de l'écran, sur du noir, ses deux moitiés côte à côte", band: true },
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
    // Its main line: each pair's first half (or a shot alone), one after the other on its beats; each pair's second half
    // laid beside its first, on the same span, its time counted once.
    const main = list.flatMap((s, i) => (s.side === "right" ? [] : [i]));
    const mainSpans = beatSpans(bpm, main.map((i) => list[i]!.beats));
    const spans = list.map((s, i) => mainSpans[main.indexOf(s.side === "right" ? i - 1 : i)]!);
    const duration = mainSpans.at(-1)!.end;
    const [a, b] = halves(options.settings?.format);
    const want = (s: Slot) => {
      if (s.side === "solo")
        return "les deux moitiés à la fois : une vidéo où le geste mène à ce qu'il donne (ses mains qui dressent puis l'assiette finie, la coupe puis la coiffure) ; le geste joue dans une moitié pendant que l'autre garde sa dernière image, ce qu'il donne";
      if (s.side === "left")
        return `${s.first ? "le plan qui ouvre, " : ""}la moitié ${a} : elle ou son équipe au travail, la caméra posée (de dos à son poste, les mains qui font, un visage concentré pris d'en bas, l'atelier en plan large avec quelqu'un derrière) ; joué à sa vitesse sur toute la paire, en même temps que ce que ce geste donne dans l'autre moitié`;
      return s.last
        ? `la moitié ${b} : le résultat fini, le plus beau, posé devant la caméra ou qui reçoit sa dernière touche, la caméra fixe ; joué à sa vitesse jusqu'à la fin${end ? ", sous la carte de fin" : ""}, en même temps que le geste`
        : `la moitié ${b} : ce que ce geste donne (le même plat, la même coupe, la même pièce), la caméra fixe, filmé du dessus de préférence : quelqu'un le pose devant la caméra (le passage commence juste avant qu'il entre dans l'image) ou la dernière touche tombe dessus ; joué à sa vitesse sur toute la paire, en même temps que le geste`;
    };
    // Both titles the whole Reel (up to its ending card).
    const to = end ? round(duration - END_CARD) : duration;
    return {
      duration,
      // Its music: without its bass to the third bar (the original's held bass comes in at 4,55 s), cut dead with the
      // last image, as the original's; no sound effect (its original has none).
      music: { filters: [{ kind: "thin", from: 0, to: round(BASS * beat) }], end: { at: duration } },
      // Each pair's second half laid beside its first: the same moment, each at its own speed.
      shots: spans.map((s, i) => ({ ...s, want: want(list[i]!), ...(list[i]!.side === "right" ? { beside: true } : {}) })),
      texts: { personne: { from: 0, to }, resultat: { from: 0, to } },
      marks: { solo: list.findIndex((s) => s.side === "solo") },
    };
  },
  code: CODE,
};
