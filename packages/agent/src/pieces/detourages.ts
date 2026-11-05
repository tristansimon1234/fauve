import { readingSeconds } from "../editor.ts";
import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";
import { letterTimes } from "../skills/detourages.ts";

// « L'œil qui s'ouvre », the effect of « Ton nom qui clignote » (docs/fiches/detourages.md, effects 1 to 3; its whole
// Reel is skills/detourages.ts): over one of her wide still shots (her place, her street, a landscape), the picture is
// black for an image, then an eye opens on it: an almond across the frame whose lids part from its middle line at a
// constant pace (the original's slit widens at 7 px an image, never slowing down) while its corners slide out of the
// frame, until the whole picture is open (Window reveal "eye", « Fenêtre en amande » of docs/animations.md, its box grown
// by the code). Her name lights up in it, in very bold capitals across the frame, white with no outline: each letter
// flashes (60 %), goes dark (a ghost of 6 %), then lights for good, out of order and faster and faster (the original's
// D, C, L, E, I, N, A of « ICELAND », sampled for her letters by its skill's letterTimes), a soft high tick on each flash
// and when the whole name is lit. Behind her scenery: in her sky, her roofs, chimneys, hills and whoever stands there in
// front of it (Skyline), its foot set so that about an eighth of the word is hidden (SkylineAt, read on eight columns),
// never more than 60 % of a letter; a sky where that would hide too much takes it in front, just over what stands there;
// without a sky, behind what stands before her wall (her cut-out); else on a clear wall of her shot (ClearBox), else in
// front, just over the middle. It goes with the cut: the montage resumes on her next shot, full frame.
// Kept of its skill and fiche: its moments in the original's proportions (the window open a little after the name's
// first flash, at 46 % of its letters; the whole name lit 1,4 s before the cut, never less than its reading time), its
// letters at the original's pace in beats of the Reel's tempo (37 images at 140 BPM, within a third of its span), its
// type (a capital of 14,2 % of the width, the word on 87,6 % of it, within the apps' margins once its foot goes under
// the middle), its placing behind the decor, its shade only on a bright sky (LightUnder), its tick. The slit becomes an
// eye: what Edith calls this effect, from the kit (the original's slit is a format of its whole Reel, its rounded window
// on black). Left to its Reel: that window, its burst on the dotted rhythm, its two sweeps, its last shot held, its
// ending card, and its music shaped (an effect does not shape the Reel's music: the intro's muffled highs that open with
// the slit are not there). Nothing of the original's own: « ICELAND » gives way to her name.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = texts && typeof texts[k] === "string" && texts[k].trim() ? Number(texts[k]) : NaN; return Number.isFinite(v) ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  // Its shot: the one that plays longest during it (a neighbour by a frame never is), drawn full frame as the montage draws it.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return null;
  const during = (i) => Math.min(durationInFrames, shots[i].from + shots[i].durationInFrames) - Math.max(0, shots[i].from);
  const ground = mine.reduce((a, i) => (during(i) > during(a) ? i : a), mine[0]);
  const shot = shots[ground];
  const laid = { left: 0, top: 0, width, height };
  const full = { position: "absolute", left: 0, top: 0, width, height };
  // Its moments (its timeline's, frames from its start).
  const EYE_FROM = Math.max(0, Math.round(mark("eye_from", 1)));
  const EYE_TO = Math.max(EYE_FROM + 2, mark("eye_to", Math.round(durationInFrames * 0.55)));
  const NAME_AT = Math.max(EYE_FROM + 1, mark("name", Math.round(durationInFrames * 0.45)));
  const LIT = Math.max(NAME_AT + 1, mark("lit", Math.round(durationInFrames * 0.7)));

  // 1. The eye: black on its first image, then an almond across the frame (its corners at its edges), its lids parting
  // from its middle line at a constant pace while its corners slide out of the frame, to an almond that holds the whole
  // picture (3 times its width, 1,2 times its height: the corners of the frame 100 px inside it).
  const open = interpolate(frame, [EYE_FROM, EYE_TO], [0.012, 1], clamp);
  const eyeW = width * (1 + 2 * open * open);
  const eyeH = height * 1.2 * open;
  const eye = { x: (width - eyeW) / 2, y: (height - eyeH) / 2, w: eyeW, h: eyeH };

  // 2. Her name, in very bold capitals across the frame (87,6 % of its width; within the apps' margins once its foot goes
  // under the middle), a capital of 14,2 % of the width as the original's, white, no outline: each letter flashes (60 %),
  // goes dark (a ghost), then lights for good, on its own images (its timeline's: the original's order and pace), every
  // letter in the page from the start, the plain word once all are lit (laid out the same: no kerning across them).
  const name = word("nom");
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const graphemes = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const upper = keep(name).toUpperCase();
  const chars = graphemes(upper);
  const CAP = Math.round(width * 0.142);
  const F = Math.round(CAP / 0.7);
  const FULL = Math.round(width * 0.876);
  const BOX_H = Math.round(CAP * 1.8);
  // Where it goes, read once on its first flash. Behind her scenery: in her sky (Skyline: everything else in front of it),
  // its foot set so that about an eighth of the word is hidden, in its middle (the top of what stands there, read across it
  // on eight columns), never more than 60 % of a letter (the original hides the feet of its letters, never a whole one). A
  // sky where that would hide too much (a tower, a tree or her front up to the top) takes it in front, its foot just over
  // what stands there (what rises higher than it can go left aside).
  // Without a sky, behind what stands before her wall (her cut-out), its foot under its top; else on a clear wall of her
  // shot (ClearBox); else in front, its foot just over the middle of the frame, where the eye opened first (the lowest it
  // keeps its whole width: under the middle, the apps' buttons take the right).
  const REF = Math.round(NAME_AT);
  const COLS = 8;
  const x0 = Math.round((width - FULL) / 2);
  const tops = [];
  for (let k = 0; k < COLS; k++) {
    const y = SkylineAt(shot, REF, laid, { from: x0 + (k * FULL) / COLS, to: x0 + ((k + 1) * FULL) / COLS });
    if (typeof y === "number" && Number.isFinite(y)) tops.push(y);
  }
  const hidden = (foot) => tops.reduce((a, y) => a + Math.max(0, Math.min(CAP, foot - y)), 0) / (COLS * CAP);
  // Its foot within the frame's safe zone: its letters' tops under the top margin, its foot above the lowest third.
  const footMin = 80 + Math.round(1.7 * CAP);
  const footMax = Math.round(height * 0.62);
  let foot = Math.round(height / 2 - 20 - 0.45 * CAP);
  let behind = null;
  let area = null;
  if (tops.length >= COLS / 2) {
    let lo = footMin;
    let hi = Math.min(footMax, Math.round(Math.min(...tops) + 0.6 * CAP));
    if (hi >= lo) for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (hidden(mid) < 0.125) lo = mid; else hi = mid; }
    const f = Math.round((lo + hi) / 2);
    if (hi >= footMin && hidden(f) <= 0.2) { foot = f; behind = "sky"; }
    else {
      const under = tops.filter((y) => y >= footMin);
      if (under.length >= COLS / 2) { foot = Math.round(Math.min(...under) - 0.1 * CAP); behind = "front"; }
    }
  }
  if (!behind) {
    const her = SubjectBox(shot, REF, laid);
    if (her && her.h > height * 0.08) {
      const f = Math.round(her.y + 0.3 * CAP);
      if (f >= footMin && f <= footMax) { foot = f; behind = "her"; }
    }
  }
  if (!behind) {
    const clear = ClearBox(shot, REF, laid, { aspect: FULL / BOX_H, min: { w: Math.round(width * 0.5), h: Math.round(BOX_H * 0.5) }, max: { w: FULL, h: BOX_H }, prefer: "top", sky: false, fallback: null });
    if (clear && clear.w > 0 && clear.h > 0) area = clear;
  }
  foot = Math.max(footMin, Math.min(footMax, foot));
  // Within the apps' margins on both sides once its letters reach under the middle of the Reel.
  const low = foot + 0.45 * CAP > height / 2 - 12;
  const TW = low ? width - 280 : FULL;
  const nameBox = area
    ? { left: Math.round(area.x), top: Math.round(area.y), width: Math.round(area.w), height: Math.round(area.h) }
    : { left: Math.round((width - TW) / 2), top: Math.round(foot + 0.2 * CAP - BOX_H), width: TW, height: BOX_H };
  const size = area ? Math.max(1, Math.round(Math.min(F, area.h / 1.8 / 0.7))) : F;
  // Only on a bright sky or wall (else it would not read): a fine tight edge and a soft shade under it.
  const light = LightUnder(shot, REF, laid, { x: nameBox.left, y: nameBox.top + Math.round(nameBox.height * 0.25), w: nameBox.width, h: Math.round(nameBox.height * 0.6) });
  const shade = light && light.mean > 0.68 ? "0 0 2px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.35), 0 2px 22px rgba(0,0,0,0.28)" : "none";
  const display = "'" + brand.displayFont + "', 'Montserrat', 'Archivo Black', sans-serif";
  let k = -1;
  const letters = frame >= LIT ? upper : chars.map((c, i) => {
    if (!/\S/.test(c)) return h("span", { key: i }, c);
    k += 1;
    const fl = mark("fl" + k, NAME_AT);
    const dk = mark("dk" + k, fl + 3);
    const on = mark("on" + k, dk + 3);
    const o = frame < fl ? 0 : frame < dk ? 0.6 : frame < on ? 0.06 : 1;
    return h("span", { key: i, style: { opacity: o } }, c);
  });
  const title = name && frame >= NAME_AT
    ? h(FitText, { key: "name", style: { position: "absolute", ...nameBox }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: size, lineHeight: 1, letterSpacing: "0.005em", fontKerning: "none", fontVariantLigatures: "none", color: "#ffffff", whiteSpace: "nowrap", textAlign: "center", justifyContent: "flex-end", textShadow: shade } },
        h("span", { style: { display: "inline-block" } }, letters))
    : null;
  const front = title && behind === "sky" ? h(Skyline, { key: "front", shot: ground, style: full }) : title && behind === "her" ? h(Subject, { key: "front", shot: ground, style: full }) : null;

  // Her shot in the eye, as the montage draws it under it (it plays at its own moment), her name and her scenery with it.
  const picture = h(React.Fragment, null, h(Footage, { key: "film", shot: ground, style: full }), title, front);
  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } },
    h(Window, { box: eye, at: EYE_FROM, open: 0, reveal: "eye", fit: "cut" }, picture));
}`;

const FPS = 30;
/** Her name's letters (graphemes but spaces), in capitals as its code lights them. */
const lettersOf = (text: string) =>
  (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(text), (x) => x.segment) : Array.from(text)).filter((c) => /\S/.test(c));
/** The original's letters keep their pace in beats: 37 images from the first flash to the last one lit at its 140 BPM. */
const BPM = 140;
/** The most of its span its letters take, and where its name flashes at the earliest (shares of its span). */
const LETTERS_MOST = 0.3;
const NAME_EARLIEST = 0.2;
/** Its whole name lit to the cut, the original's share (1,38 s of its 6,22 s intro), its reading time at least, half its span at most. */
const HOLD_SHARE = 0.222;
const HOLD_MOST = 0.5;
/** How long after its reading time its name stays lit at least (images): a margin over the scene check's. */
const READ_MARGIN = 6;
/** The window fully open this far into its letters (the original's slit at 9,72 beats, its name from 8,4 to 11,28). */
const OPEN_IN_LETTERS = 0.46;
/** A soft high tick on each letter's flash and when the whole name is lit, as its skill's (dB). */
const TICK = { sound: "soft high glass tick", seconds: 0.5, gain: -4 };
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Its moments for a span (frames from its start): the eye opening from its second image, her name's first flash, the
 * window open, each letter's flash, dark and lit (by its place in her word: fl0, dk0, on0…), the whole name lit; a tick
 * on each flash and when all is lit; her cut-out on its shot (for her name behind what stands before her wall).
 */
export function eyeTimeline({ frames, bpm, words }: Pick<PieceTimelineInput, "frames" | "bpm" | "words">) {
  const name = (words.nom ?? "").toUpperCase();
  const times = letterTimes(lettersOf(name).length || 7);
  const length = Math.max(1, ...times.map((t) => t.on));
  // Her whole name lit long enough to read it before the cut.
  const hold = Math.max(1, Math.round(Math.min(frames * HOLD_MOST, Math.max(Math.ceil(readingSeconds(name || "nom") * FPS) + READ_MARGIN, frames * HOLD_SHARE))));
  const lit = Math.max(2, frames - hold);
  // Its letters at the original's pace in beats, within a third of the span, never before a fifth of it.
  const letters = Math.min(Math.round((length * BPM) / Math.max(1, bpm)), Math.round(frames * LETTERS_MOST));
  const nameAt = Math.max(1, Math.min(lit - 1, Math.max(Math.round(frames * NAME_EARLIEST), lit - letters)));
  const scale = (lit - nameAt) / length;
  const eyeTo = Math.max(2, Math.min(lit, nameAt + Math.round(OPEN_IN_LETTERS * (lit - nameAt))));
  const marks: Record<string, number> = { eye_from: 1, eye_to: eyeTo, name: nameAt, lit };
  const flashes = new Set<number>();
  for (const t of times) {
    // Each one flashes and goes dark an image at least, lit for good by the whole name's moment.
    const fl = Math.min(lit - 1, Math.round(nameAt + t.flash * scale));
    const dk = Math.max(fl + 1, Math.min(lit, Math.round(nameAt + t.dark * scale)));
    const on = Math.max(dk, Math.min(lit, Math.round(nameAt + t.on * scale)));
    marks[`fl${t.place}`] = fl;
    marks[`dk${t.place}`] = dk;
    marks[`on${t.place}`] = on;
    flashes.add(fl);
  }
  const sounds = [...flashes, lit].sort((a, b) => a - b).map((f) => ({ at: round3(f / FPS), ...TICK }));
  return { marks, sounds, cutouts: [0] };
}

export const detourages: EffectPiece = {
  key: "detourages",
  version: 1,
  name: "L'œil qui s'ouvre",
  how: "l'image noire, puis un œil en amande qui s'ouvre au milieu et s'agrandit jusqu'à tout l'écran sur son plan large et fixe ; son nom s'y allume en très grandes capitales blanches, lettre par lettre dans le désordre (chacune clignote, s'éteint puis tient), derrière le décor (ses toits, ses collines, quelqu'un debout passent devant) ; il part avec la coupe.",
  needs: "un plan large et fixe de son lieu, de sa rue ou d'un paysage, le téléphone posé, avec du ciel ou un mur dégagé au-dessus de ce qui s'y détache (ses toits, sa devanture, quelqu'un debout).",
  lays: "sur un seul de ses plans, large et fixe, en ouverture du Reel de préférence (l'œil s'ouvre sur le noir) ; ce plan dure tout l'effet",
  shots: [1, 1],
  seconds: [2.5, 6],
  require: { files: 1, shot: { framing: ["wide"], still: true } },
  texts: [
    {
      slot: "nom",
      want: "son nom, sa rue, son quartier ou un mot de sa demande, qui s'allume lettre par lettre en très grandes capitales dans le ciel de son plan : un seul mot de préférence (le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), plus il est court plus il est grand",
      max: 12,
      required: true,
    },
  ],
  timeline: eyeTimeline,
  code: CODE,
};
