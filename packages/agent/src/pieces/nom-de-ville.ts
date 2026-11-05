import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Son nom aux cinq polices », the effect (docs/fiches/nom-de-ville.md, effects 1 to 3; its whole Reel is
// skills/nom-de-ville.ts, whose opening it is): over one wide still shot of hers with a sky, her name giant in her sky,
// its foot a fifth of its capitals under her roofs (SkylineAt), behind everything that stands under her sky (Skyline:
// her roofs, trees, poles and passers-by in front of its letters, none of them named), rising slowly from under its
// place (0,4 of its capitals, easing out) while its typeface changes at once, in one image, on each step of the Reel's
// music: very fat and round (Lilita One), square and heavy (Bungee), narrow (League Gothic), square and a little bigger
// (Bungee), then hers, which stays until the cut; the same colour, the same centre and foot, one size for all five (one
// FitText: the widest sets it). Its step: the Reel's beat or half of it, whichever is nearer the original's 0,42 s (12,6
// images); a shorter stage changes fewer times, its last face held a step at least. Two to four small words over it, in
// her text font, white with a dark edge (in its colour on a sky too bright). Kept in her charter: her main colour,
// deepened or lightened a step at a time until it stands out 2:1 from her sky (the original's red on its pale one), her
// title face landing. Left out: the model's other sections, its signature at the bottom, its 16:9 frame (the montage
// plays full frame under it), its music's drop and break, its ending card, and the original's own words (« THE STREETS
// OF », « MARRAKECH »), which give way to hers. Without a sky read (an interior, the scene check), the name stays in
// front, at the bottom of her clearest area (ClearBox) or at the original's place; it goes with its stage's cut.

/** The original's step between two faces, in images (a beat of its first piece at 142,4 BPM). */
const STEP = 12.6;

/** Its step for a beat of `beat` frames: the beat or half of it, whichever is nearer the original's. */
export function faceStep(beat: number): number {
  return Math.abs(beat - STEP) <= Math.abs(beat / 2 - STEP) ? beat : beat / 2;
}

/** How many times its face changes on a stage of `frames` at `step` (four, as the original; fewer on a short one, its last face held a step at least). */
export const faceChanges = (frames: number, step: number) => Math.max(1, Math.min(4, Math.floor(frames / Math.max(1, step)) - 1));

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = texts && texts[k]; const n = typeof v === "string" && v.trim() ? Number(v) : NaN; return Number.isFinite(n) ? n : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  // Its stage: the first of its shots that plays 9 images of it at least (never the last image of the shot before); its
  // name goes with its cut, and a shot after it under the effect plays bare.
  const list = shots || [];
  const mine = list.map((s, i) => i).filter((i) => list[i].from < durationInFrames && list[i].from + list[i].durationInFrames > 0);
  const name0 = word("nom");
  if (!mine.length || !name0) return null;
  const plays = (i) => Math.min(durationInFrames, list[i].from + list[i].durationInFrames) - Math.max(0, list[i].from);
  const g = mine.find((i) => plays(i) >= Math.min(9, durationInFrames / 2)) ?? mine[0];
  const START = Math.max(0, Math.round(list[g].from));
  const END = Math.min(durationInFrames, Math.round(list[g].from + list[g].durationInFrames));
  if (frame < START || frame >= END) return h(AbsoluteFill, { style: { pointerEvents: "none" } });
  // Its step: the Reel's beat or half of it, whichever is nearer the original's 12,6 images; four changes, fewer on a
  // short stage (its last face held a step at least), as its timeline counts them.
  const BEAT = Math.max(6, mark("beat", 18));
  const STEP = Math.max(4, mark("step", Math.abs(BEAT - 12.6) <= Math.abs(BEAT / 2 - 12.6) ? BEAT : BEAT / 2));
  const CHANGES = Math.round(within(mark("changes", Math.floor((END - START) / STEP) - 1), 1, 4));
  const LAND = START + Math.round(CHANGES * STEP);
  const SEQ = [0, 1, 2, 3].slice(0, CHANGES).concat([4]);
  const shown = SEQ[Math.min(CHANGES, Math.max(0, Math.floor((frame - START) / STEP)))];
  const laid = { left: 0, top: 0, width, height };
  const box = { position: "absolute", left: 0, top: 0, width, height };
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const name = keep(name0).toUpperCase();
  const small = word("surtitre");
  const count = Math.max(1, letters(name).filter((c) => /\S/.test(c)).length);
  const display = "'" + brand.displayFont + "', 'Anton', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const FACES = [
    { family: "'Lilita One', " + display, weight: 400, size: 1 },
    { family: "'Bungee', " + display, weight: 400, size: 1 },
    { family: "'League Gothic', " + display, weight: 400, size: 1 },
    { family: "'Bungee', " + display, weight: 400, size: 1.06 },
    { family: display, weight: 900, size: 1 },
  ];

  // 1. Its size: its capitals 14 % of the width at most (a short name), its widest face within 80 % of the width, its box
  // above the middle of the frame (left of the apps' buttons wherever it is); its capitals once fitted, for its place.
  const CAPS = Math.round(width * 0.14);
  const F = Math.round(CAPS / 0.72);
  const TW = Math.round(width * 0.8);
  const scale = Math.min(1, TW / (0.775 * F * count));
  const caps = Math.round(0.72 * F * scale);

  // 2. Its place: its foot a fifth of its capitals under her roofs (the median of what stands under her sky across its
  // width, at the image it lands), never deeper than half a capital under the second highest of them, behind them; a
  // scenery too high for it (no room above for its small words) leaves it in front, at the bottom of her sky or calm
  // area, else at the original's place; one lower than it may go has it as low in her sky as it may.
  const top0 = 100;
  const reach = small ? 2.15 : 1.1;
  const footMin = Math.round(top0 + reach * caps);
  const footMax = Math.round(height * 0.45);
  const LOOK = Math.max(START, Math.min(END - 1, LAND));
  const COLS = 8;
  const x0 = (width - TW) / 2;
  const tops = [];
  for (let k = 0; k < COLS; k++) {
    const y = SkylineAt(list[g], LOOK, laid, { from: x0 + (k * TW) / COLS, to: x0 + ((k + 1) * TW) / COLS });
    if (typeof y === "number" && Number.isFinite(y)) tops.push(y);
  }
  tops.sort((a, b) => a - b);
  const median = tops.length >= COLS / 2 ? tops[Math.floor((tops.length - 1) / 2)] : null;
  const under = median === null ? null : Math.round(Math.min(median + 0.2 * caps, tops[1] + 0.5 * caps));
  const behind = under !== null && under >= footMin;
  const SKY = { prefer: "top", min: { w: Math.round(width * 0.5), h: Math.round(height * 0.06) }, within: { x: 0, y: 0, w: width, h: footMax }, pad: 4, fallback: null };
  const sky = behind ? null : ClearBox(list[g], LOOK, laid, SKY);
  const foot = Math.round(within(behind ? under : sky ? sky.y + sky.h : height * 0.42, footMin, footMax));

  // 3. Its colour: her main colour as it is when it stands out 2:1 from her sky under it, else a shade of it a step at a
  // time on its own side of her sky (the other side if that one never gets there); its small words white with a tight
  // dark edge, or in its colour on a sky too bright for white.
  const rgb = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return null; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const lin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const hex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const light = LightUnder(list[g], LOOK, laid, { x: x0, y: Math.round(foot - caps), w: TW, h: caps });
  const skyLum = light && Number.isFinite(light.mean) ? lin(within(light.mean, 0, 1) * 255) : 0.57;
  const shade = (c, dark) => { let x = c; for (let i = 0; i < 12 && ratio(lum(x), skyLum) < 2; i++) x = dark ? x.map((v) => v * 0.82) : x.map((v) => v + (255 - v) * 0.3); return x; };
  const own = rgb(brand.accent) || [253, 76, 76];
  const near = shade(own, lum(own) <= skyLum);
  const INK = hex(ratio(lum(near), skyLum) >= 2 ? near : shade(own, lum(own) > skyLum));
  const whiteOn = ratio(1, skyLum) >= 1.5;
  const PEN = whiteOn ? "#ffffff" : INK;
  const EDGE = whiteOn ? "0 0 1px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.35)" : "none";

  // 4. Its name: its five faces stacked in one box, one shown at a time (the others laid out, hidden, so the box measures
  // them all once), their baselines on one line; rising from 0,4 of its capitals under its place, easing out until it
  // lands; its small words above it, drifting up a little.
  const p = within((frame - START) / Math.max(1, LAND - START), 0, 1);
  const rise = 0.288 * Math.pow(1 - p, 3);
  const drift = within((frame - START) / Math.max(1, END - START), 0, 1);
  const words = (s) => String(s || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const label = small ? words(small) <= 4 : false;
  const kicker = small
    ? h("div", { "data-fauve-accent": label ? "" : undefined, style: { fontFamily: body, fontWeight: 700, fontSize: Math.round(label ? Math.max(F * 0.3, 24 / scale) : Math.max(F * 0.42, 52 / scale)), lineHeight: 1, letterSpacing: "0.14em", textTransform: "uppercase", color: PEN, textShadow: EDGE, whiteSpace: "nowrap", marginBottom: Math.round(F * 0.45), transform: "translateY(" + (-0.25 * drift).toFixed(3) + "em)" } }, keep(small))
    : null;
  const grid = h("div", { key: "name", style: { display: "grid", alignItems: "baseline", justifyItems: "center", fontSize: F } },
    FACES.map((f, i) => h("div", { key: "f" + i, style: { gridArea: "1 / 1", fontFamily: f.family, fontWeight: f.weight, fontSynthesis: "none", fontSize: Math.round(F * f.size), lineHeight: 0.8, letterSpacing: "0.01em", color: INK, whiteSpace: "nowrap", visibility: i === shown ? "visible" : "hidden" } }, name)));
  const lettering = h("div", { style: { transform: "translateY(" + rise.toFixed(3) + "em)", fontSize: F } }, grid);
  const BOXH = Math.round(F * (small ? 1.7 : 1.05));
  const title = h(FitText, { key: "title-" + name, style: { position: "absolute", left: Math.round(x0), top: Math.round(foot + 0.07 * caps - BOXH), width: TW, height: BOXH }, innerStyle: { justifyContent: "flex-end" } },
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } }, kicker, lettering));
  // What stands under her sky, laid over it at every image, across its band only.
  const front = behind ? h("div", { key: "front", style: { ...box, clipPath: "inset(" + Math.max(0, Math.round(foot - 1.5 * caps)) + "px 0 " + Math.max(0, Math.round(height - foot - 0.7 * caps)) + "px 0)" } }, h(Skyline, { shot: g, style: box })) : null;
  return h(AbsoluteFill, null, title, front);
}`;

export const nomDeVille: EffectPiece = {
  key: "nom-de-ville",
  version: 1,
  name: "Son nom aux cinq polices",
  how: "son nom géant dans le ciel de son plan large, derrière ses toits (ils passent devant ses lettres), qui monte doucement pendant que sa police change d'un coup à chaque temps, à la même place et dans la même couleur : ronde et très grasse, carrée, étroite, carrée plus grande, puis la sienne, qui reste ; deux à quatre petits mots au-dessus ; le nom part avec la coupe.",
  needs: "un plan large et fixe (le téléphone posé) de sa rue, de ses toits, de sa devanture ou d'un paysage, avec du ciel calme dans le haut de l'image et des toits, des arbres ou des collines qui y montent.",
  lays: "sur un seul de ses plans, ce plan large et fixe, environ 5 temps de la musique (souvent 2 à 3 s), en ouverture de préférence : son nom change de police à chaque temps, puis le montage reprend à la coupe, sur le même temps",
  shots: [1, 1],
  seconds: [1.5, 5],
  require: { files: 1, shot: { framing: ["wide"], still: true, outdoors: true } },
  texts: [
    {
      slot: "nom",
      want: "le nom géant posé dans le ciel de son plan large, derrière ses toits, dont la police change à chaque temps : un seul mot de préférence (son quartier, sa rue, sa ville, ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), plus il est court plus il est grand",
      max: 12,
      required: true,
    },
    {
      slot: "surtitre",
      want: "2 à 4 petits mots au-dessus du nom, qui l'amènent (une forme comme « les rues de », « un samedi à », « bienvenue à »)",
      max: 18,
      required: false,
    },
  ],
  timeline({ frames, bpm, shots }: PieceTimelineInput): PieceTimeline {
    // Its stage: the first of her shots that plays 9 images of it at least, within its span (the name goes with its cut).
    const first = shots.find((s) => Math.min(frames, s.from + s.frames) - Math.max(0, s.from) >= Math.min(9, frames / 2)) ?? shots[0] ?? { from: 0, frames };
    const from = Math.max(0, Math.round(first.from));
    const to = Math.min(frames, Math.round(first.from + first.frames));
    const step = faceStep((60 / bpm) * REEL_FPS);
    return { marks: { step: round3(step), changes: faceChanges(Math.max(1, to - from), step) } };
  },
  code: CODE,
  // Its first four faces are always the model's; the fifth is hers.
  fonts: ["Lilita One", "Bungee", "League Gothic"],
};
