import type { EffectPiece } from "../pieces.ts";

// « Plans fixes de cinéma », the effect (docs/fiches/plans-fixes.md, effects 1 to 3; its whole Reel is
// skills/plans-fixes.ts): over a run of her still shots, the Reel turns into a film for a moment. Her shots play in a
// horizontal 4:3 picture (1080 × 810) at the middle of the frame, on black, as the original is shown in a vertical feed,
// each one as filmed, cut where the editor cut them on the beat: the camera never moves nor zooms (a still shot is the
// effect), a photo stays still, a video plays. On the first one, a small white title on two levels comes word by word,
// each word set at once with a dry click (its timeline's sounds), at the original's moments counted in the Reel's beats:
// its small sans words above (0 · 0,4 · 1 beat after its first), its bold serif words under them (1,6 · 2,5), the first
// half a beat after the effect starts, as the original's lands half a beat after its first image; laid out whole from
// the start, on the calmest area of the middle of that first shot (ClearBox), else at its very middle. Whole, it holds a
// beat at least (the original's 1,5 beats) and until it has been read, then goes with the next cut (the original's goes
// with its first one: a first shot of about 4 beats carries it whole); the rest of the run plays on, wordless, until the
// montage takes over full frame again. On her word, all of it full frame (its « format »). A span too short for its
// words lays them faster (never under a third of their pace), so the title is still held before the montage resumes.
// Kept of its skill: its frame and its sizes (the serif's 88 px, its small words' 28 px, a label beside a title that
// reads), its white with a tight dark halo, its words' pace and its click. Left: its music, its tempo and its cuts (the
// Reel's), its casting (the passer-by, the dusk), its closing line and its finish. Nothing of the original's own words.

/** Its words land over this many beats from their first one (the original's « Static shot »: beat 2,5). */
const SPREAD = 2.5;
/** Its serif words start this many beats after its small ones (the original's « Static »: beat 1,6). */
const SERIF_FROM = 1.6;
/** Its small words: the first on beat 0, the last on beat 1, each waiting a little longer than the one before. */
const SMALL_SPAN = 1;
const SMALL_EASE = 1.2;
/** A span too short for its words lays them faster, never under this share of their pace. */
const SQUEEZE = 0.3;
/** The click on each word of its title as it lands (the sound library's « light click », its skill's). */
const CLICK = { sound: "light click", seconds: 0.5 };

/** Its words as its code splits them: by spaces, a separator (« · », « — ») kept with the word before it. */
export function titleWords(text: string | undefined): string[] {
  const out: string[] = [];
  for (const w of String(text ?? "").split(/[ \t\n]+/).filter(Boolean)) {
    if (out.length && !/[\p{L}\p{N}]/u.test(w)) out[out.length - 1] += " " + w;
    else out.push(w);
  }
  return out;
}

/** Its whole title stays at least this long once its last word has landed (frames): a beat, 0,6 s at the least (the original holds it 1,5 beats). */
export const holdFrames = (beat: number) => Math.round(Math.max(18, beat));

/** And this long from its first word (frames): the time to read its words on a phone, as the scene check counts it (0,8 of 0,8 s plus 0,3 s a word). */
export const readFrames = (words: number) => Math.round(30 * Math.min(4.5, Math.max(1.2, 0.8 + 0.3 * words)) * 0.8);

/**
 * When each word of its title lands, as its code lays them (frames from its start; `beat`, its frames a beat, as its
 * code reads it): the first half a beat in, its small words over its first beat, its serif words from beat 1,6 to 2,5;
 * a span too short to hold them whole a beat after their last lays them faster (never under a third of their pace).
 */
export function titleFrames(small: number, serif: number, frames: number, beat: number): number[] {
  const start = Math.round(beat / 2);
  const room = frames - start - holdFrames(beat);
  const pace = Math.min(1, Math.max(SQUEEZE, room / (SPREAD * beat)));
  const from = small ? SERIF_FROM : 0;
  return [
    ...Array.from({ length: small }, (_, i) => (small > 1 ? SMALL_SPAN * Math.pow(i / (small - 1), SMALL_EASE) : 0)),
    ...Array.from({ length: serif }, (_, j) => from + (serif > 1 ? (j / (serif - 1)) * (SPREAD - from) : 0)),
  ].map((b) => Math.round(start + b * beat * pace));
}

/**
 * When its title goes (frames from its start), as its code decides it: with the first cut under it that comes once it
 * has been whole a beat and read (`cuts`, the frames where her shots change); none: at its last frame.
 */
export function titleOff(lands: number[], beat: number, cuts: number[], frames: number): number {
  const start = Math.round(beat / 2);
  const last = Math.max(0, ...lands);
  return cuts.find((c) => c >= last + holdFrames(beat) && c >= start + readFrames(lands.length) && c < frames) ?? frames;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  // Its shots: those that play during it, in order; the first one carries its title.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return null;
  const first = mine[0];
  const BEAT = mark("beat", 18);
  const cur = mine.reduce((k, i) => (shots[i].from <= frame ? i : k), first);

  // Its frame: a horizontal 4:3 picture (1080 × 810) at the middle of the frame, on black, as the original shows in a
  // vertical feed; on her word (« format » vertical), the whole frame. Every place below is in it.
  const wide = word("format") !== "vertical";
  const bw = width;
  const bh = wide ? Math.round((width * 3) / 4) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };

  // 1. Her still shots in it, each as filmed, cut where the editor cut them: the camera never moves nor zooms, a photo
  // stays still, a video plays (Footage frames each one on its subject, her faces kept whole).
  const film = h(Footage, { key: "s" + cur, shot: cur, style: { position: "absolute", left: 0, top: 0, width: bw, height: bh } });

  // 2. Its small title on two levels, each line laid out whole from the start and its words shown one by one, each at
  // once (with its click): its small sans words above, a label beside the title, over its first beat, each waiting a
  // little longer than the one before; its bold serif words under them, from beat 1,6 to 2,5; the first half a beat in.
  // A separator (« · », « — ») stays with the word before it.
  const split = (text) => {
    const out = [];
    String(text || "").split(/[ \t\n]+/).filter(Boolean).forEach((w) => {
      if (out.length && !/[\p{L}\p{N}]/u.test(w)) out[out.length - 1] += " " + w;
      else out.push(w);
    });
    return out;
  };
  const sw = split(word("accroche"));
  const tw = split(word("titre"));
  // Whole a beat at least once its last word has landed (0,6 s at the least; the original holds it 1,5 beats), and long
  // enough from its first word to be read; a span too short to hold it lays its words faster, never under a third of
  // their pace.
  const HOLD = Math.round(Math.max(18, BEAT));
  const READ = Math.round(30 * Math.min(4.5, Math.max(1.2, 0.8 + 0.3 * (sw.length + tw.length))) * 0.8);
  const start = Math.round(BEAT / 2);
  const pace = Math.min(1, Math.max(0.3, (durationInFrames - start - HOLD) / (2.5 * BEAT)));
  const serifFrom = sw.length ? 1.6 : 0;
  const smallBeat = (i) => (sw.length > 1 ? Math.pow(i / (sw.length - 1), 1.2) : 0);
  const serifBeat = (j) => serifFrom + (tw.length > 1 ? (j / (tw.length - 1)) * (2.5 - serifFrom) : 0);
  const lands = (b) => Math.round(start + b * BEAT * pace);
  const last = Math.max(sw.length ? lands(smallBeat(sw.length - 1)) : 0, tw.length ? lands(serifBeat(tw.length - 1)) : 0);
  // It goes with the first cut that comes once it has been held and read (the original's goes with its first cut); none
  // in its span: it stays to its last frame, and goes with the cut back to the montage.
  const cuts = mine.slice(1).map((i) => Math.round(shots[i].from)).filter((f) => f >= last + HOLD && f >= start + READ && f < durationInFrames);
  const off = cuts.length ? cuts[0] : durationInFrames;
  const on = (sw.length || tw.length) && frame >= start && frame < off;
  // Its sizes, the original's at 1080 px wide (its serif's capitals 60 px, its small words' 19 px).
  const SMALL = 28;
  const SERIF = 88;
  const TOP_H = 40;
  const GAP = 10;
  const SERIF_H = 100;
  const H = TOP_H + GAP + SERIF_H;
  // Its width from its words (a bold serif's letter is about half its size), within the band it may go in.
  const chars = (list) => list.join(" ").length;
  const blockW = Math.min(800, Math.max(360, Math.round(chars(tw) * SERIF * 0.52), Math.round(chars(sw) * SMALL * 0.56 + Math.max(0, sw.length - 1) * SMALL * 0.5)));
  const centre = { x: Math.round((bw - blockW) / 2), y: Math.round(bh / 2 - H / 2), w: blockW, h: H };
  // Where it may go: the middle of the picture, inside the Reel's safe zone and left of the apps' buttons; on the calmest
  // area of her first shot there (the original's sits under its horizon, on the dark city), else at the very middle.
  const band = { x: Math.round((bw - 800) / 2), y: Math.round(bh * (wide ? 0.3 : 0.36)), w: 800, h: Math.round(bh * (wide ? 0.42 : 0.28)) };
  const spot = on
    ? ClearBox(shots[first], frame, laid, { aspect: blockW / H, min: { w: Math.round(blockW * 0.85), h: Math.round(H * 0.85) }, max: { w: blockW, h: H }, sky: false, prefer: "any", within: band, pad: 6, fallback: centre }) || centre
    : centre;
  const fit = Math.min(1, spot.h / H);
  // White, with the original's tight dark halo and a thin dark edge (her shots are not all as dark as its river).
  const halo = "0 0 1px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.45), 0 1px 10px rgba(0,0,0,0.25)";
  const display = "'" + brand.displayFont + "', 'Lora', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Poppins', 'Inter Tight', sans-serif";
  const shown = (w, i, at) => [i ? " " : null, h("span", { key: i, style: { whiteSpace: "nowrap", opacity: frame >= at ? 1 : 0 } }, w)];
  const smallStyle = { fontFamily: body, fontWeight: 600, fontSize: Math.round(SMALL * fit), lineHeight: 1.2, wordSpacing: "0.5em", color: "#ffffff", whiteSpace: "nowrap", textShadow: halo, justifyContent: "flex-end" };
  const serifStyle = { fontFamily: display, fontWeight: 700, fontSize: Math.round(SERIF * fit), lineHeight: 1.0, letterSpacing: "-0.03em", color: "#ffffff", whiteSpace: "nowrap", textShadow: halo, justifyContent: "flex-start" };
  const kicker = on && sw.length
    ? h(FitText, { key: "k", style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(TOP_H * fit) }, innerStyle: smallStyle },
        h("span", { "data-fauve-accent": "" }, sw.flatMap((w, i) => shown(w, i, lands(smallBeat(i))))))
    : null;
  const title = on && tw.length
    ? h(FitText, { key: "t", style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y + (TOP_H + GAP) * fit), width: Math.round(spot.w), height: Math.round(SERIF_H * fit) }, innerStyle: serifStyle },
        h("span", null, tw.flatMap((w, j) => shown(w, j, lands(serifBeat(j))))))
    : null;

  const picture = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film, kicker, title);
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, picture);
}`;

export const plansFixes: EffectPiece = {
  key: "plans-fixes",
  version: 1,
  name: "Plans fixes de cinéma",
  how: "ses plans fixes passent en horizontal 4:3 sur du noir, comme au cinéma, chacun tel que filmé (ni zoom ni mouvement) ; sur le premier, un petit titre blanc en deux niveaux se pose mot à mot avec un clic sec, ses petits mots sans serif au-dessus, ses mots en serif gras dessous, puis part avec une coupe ; le montage reprend ensuite en plein écran.",
  needs: "des vidéos filmées téléphone posé où le monde bouge dedans (passants, clients, vapeur, une porte qui s'ouvre), à l'horizontale de préférence (en vertical, seule une bande du milieu se voit), la première large et calme au milieu.",
  lays: "sur 3 à 8 de ses plans fixes coupés d'un temps chacun, le premier tenu 4 temps environ (le titre s'y pose)",
  shots: [1, 8],
  seconds: [3, 8],
  require: { files: 2, shot: { still: true, video: true } },
  texts: [
    {
      slot: "accroche",
      want: "2 à 4 petits mots sans serif au-dessus du titre, qui l'amènent (une forme comme « le pouvoir du », « un soir à », « la lumière de »)",
      max: 22,
      required: true,
    },
    {
      slot: "titre",
      want: "le petit titre en serif gras sous ces mots, 1 ou 2 mots : son lieu, son quartier ou le moment (une forme comme « plan fixe », « Belleville », « l'heure dorée »)",
      max: 18,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format de ce moment : horizontal sur du noir comme au cinéma, ou plein écran",
      choices: [
        { value: "horizontal", says: "ses plans en horizontal 4:3 au milieu de l'écran, sur du noir, comme au cinéma" },
        { value: "vertical", says: "ses plans en plein écran, tels quels, le titre au milieu" },
      ],
    },
  ],
  timeline({ frames, bpm, words }) {
    // Its beat as its code reads it (texts.beat, to the thousandth), so each click lands on the frame its word does.
    const beat = Math.round(((60 / bpm) * 30) * 1000) / 1000;
    const lands = titleFrames(titleWords(words.accroche).length, titleWords(words.titre).length, frames, beat);
    return { sounds: lands.filter((f) => f < frames - 2).map((f) => ({ at: f / 30, ...CLICK })) };
  },
  code: CODE,
};
