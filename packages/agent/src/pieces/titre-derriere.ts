import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Son nom derrière le décor », the effect (docs/fiches/titre-derriere.md, effects 1 to 4; its whole Reel is
// skills/titre-derriere.ts, whose first section it is): over one wide still shot of hers with a sky, a low whoosh rises
// into a hit half a beat in and her name rises from below onto it in three images, blurred upwards, in very bold
// capitals of one flat colour across 90,7 % of the frame's width in her sky, behind everything that stands under it
// (Skyline: her roofs, chimneys, trees, hills, poles, wires and passers-by pass in front of its letters, none of them
// named), the line of her roofs or hills cutting the feet of most of its letters, never deeper than half a capital
// under its second highest top (the original's crowned tower); three small pen words between two crosses on each side
// just above it, an image later. On the music's return, two beats in, the scenery turns to white paper piece by piece,
// left to right, 2 to 3 images each (what its filler named: « every building », each one), then a beat later a white
// wave runs over its letters, one at a time; the title goes with the cut, and the montage takes over. Its timings are
// the model's, on the Reel's beat (its 4,55 beats: a longer shot holds the title longer behind its scenery, whole
// beats, a shorter one runs them closer), its proportions the original's (its capitals 10 % of the height at most, its
// small words 41 % of them, always narrower than it), its sound the model's whoosh into the hit. Kept in her charter:
// her display font in its heaviest weight, her main colour as the title's (deepened or lightened, a step at a time,
// until it stands out 2,5:1 from her sky, as the original's blood red on its pale one), the original's paper and wave
// whites. Left out: the model's other sections, its 4:3 frame (the montage plays full frame under it), its stopped
// music, its ending card, her own cut-out (Skyline passes her in front, the original's walker too, at no cost), and the
// original's own words (« LOS ANGELES », « A month in »), which give way to hers. Without a sky read (an interior, the
// scene check), the title stays in front, at the bottom of her clearest area (ClearBox) or at the original's place;
// nothing named in her shot, or not found there: no paper, the wave alone.

/** Its title's section in its model, in beats of the Reel's music (the original's 0 to 4,55): the hit it lands on, the paper chase on the music's return, the wave. */
const SECTION = 4.55;
const HIT = 0.5;
const CHASE = 2;
const WAVE = 3;

/**
 * Its marks for a stage of `length` frames at `beat` frames a beat (frames from the stage's start): the hit, the paper
 * chase (an image after its beat, as the model's) and the wave. A stage of its section's length or more keeps the
 * model's beats, the paper and the wave moved later by whole beats as it grows (the title read longer behind its
 * scenery, between 1,55 and 2,55 beats left for the wave and its hold before the cut); a shorter one runs them closer, in
 * proportion. The same rule as its code's defaults.
 */
export function titleMarks(length: number, beat: number): { hit: number; chase: number; wave: number } {
  const beats = length / beat;
  const long = beats >= SECTION;
  const wave = long ? Math.floor(beats - (SECTION - WAVE) + 1e-6) : (WAVE * beats) / SECTION;
  const at = (b: number) => Math.round(b * beat);
  return {
    hit: at(long ? HIT : (HIT * beats) / SECTION),
    chase: at(long ? wave - 1 : (CHASE * beats) / SECTION) + 1,
    wave: at(wave),
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = texts && texts[k]; const n = typeof v === "string" && v.trim() ? Number(v) : NaN; return Number.isFinite(n) ? n : d; };
  // Its shots: those that play during it, in order. The first one is its stage, her wide still shot (the first that plays
  // 9 images of it at least: never the last image of the shot before): its title is laid in its sky and goes with its
  // cut, as the original's (a shot after it under the effect plays bare).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  const name = word("titre");
  if (!mine.length || !name) return null;
  const plays = (i) => Math.min(durationInFrames, shots[i].from + shots[i].durationInFrames) - Math.max(0, shots[i].from);
  const g = mine.find((i) => plays(i) >= Math.min(9, durationInFrames / 2)) ?? mine[0];
  const START = Math.max(0, Math.round(shots[g].from));
  const END = Math.min(durationInFrames, Math.round(shots[g].from + shots[g].durationInFrames));
  // Past its cut (an image of its span rounded over the next shot): nothing shows.
  if (frame >= END) return h(AbsoluteFill, { style: { pointerEvents: "none" } });
  const BEAT = Math.max(6, mark("beat", 18));
  // Its marks (frames from its start, as its timeline gives them): the hit its title lands on half a beat in, the paper
  // on the music's return two beats in, the wave a beat later, in the model's 4,55 beats; a longer stage holds the title
  // longer behind its scenery (whole beats), a shorter one runs them closer.
  const L = (END - START) / BEAT;
  const long = L >= 4.55;
  const wb = long ? Math.floor(L - 1.55 + 1e-6) : (3 * L) / 4.55;
  const at = (b) => START + Math.round(b * BEAT);
  const HIT = mark("hit", at(long ? 0.5 : (0.5 * L) / 4.55));
  const CHASE = mark("chase", at(long ? wb - 1 : (2 * L) / 4.55) + 1);
  const WAVE = mark("wave", at(wb));
  // Its place is read on the stage's image just after the hit.
  const LAND = Math.max(START, Math.min(END - 1, HIT + 1));
  const laid = { left: 0, top: 0, width, height };
  const box = { position: "absolute", left: 0, top: 0, width, height };
  // A phone number or a date never breaks between its digits; its letters as one reads them (an accent stays on its letter).
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const chars = letters(keep(name).toUpperCase());
  const small = word("surtitre");

  // 1. Its place: one line across 90,7 % of the frame's width in the sky of her stage, its capitals 10 % of the frame's
  // height at most (a short word as big as the original's, a longer one smaller: about its width over its letters, a
  // black grotesque set tight), behind what stands under her sky: the line of her roofs or hills cutting the feet of
  // most of its letters (a sixth of their height, where half of its width meets them), never deeper than half a
  // capital under the second highest top across it (the original's crowned tower, a lower city under its foot; a lone
  // spire or a mast may pass through a letter, as the original's pole through its E). A scenery that would hide more
  // of it (most of its letters a quarter hidden, or two of its eighths past 60 %: her street's facades over its first
  // and last letters) is too high there. Its small words above it and its glyphs in the Reel's safe zone: its top under
  // the top margin, its foot above the apps' buttons while it spans the width. Then, as her stage allows: 70 % of the
  // width (her facades rising on both sides, the sky between them), or within the apps' margins (140 px each side), its
  // foot above the bottom quarter, when what stands under her sky only reaches lower (a tree up to the middle); lower
  // still (low hills, a beach), in her sky as low as it may go; a scenery too high everywhere leaves it in front.
  const CAPS = Math.round(height * 0.1);
  const F0 = Math.round(CAPS / 0.69);
  const capsFor = (tw) => Math.min(CAPS, Math.round(tw / Math.max(4, chars.length)));
  const WIDE = Math.round(width * 0.907);
  const MID = Math.round(width * 0.7);
  const NARROW = width - 280;
  const footMin = (caps) => Math.round(80 + (small ? 1.65 : 1.35) * caps);
  const footHigh = (caps) => Math.round(940 - 0.3 * caps);
  const footLow = (caps) => Math.round(height * 0.75 - 20 - 0.3 * caps);
  const COLS = 8;
  // The top of what stands under her sky in each eighth of its width, at a frame (null where nothing was read).
  const topsAt = (f, tw) => {
    const x0 = (width - tw) / 2;
    const out = [];
    for (let k = 0; k < COLS; k++) {
      const y = SkylineAt(shots[g], f, laid, { from: x0 + (k * tw) / COLS, to: x0 + ((k + 1) * tw) / COLS });
      out.push(typeof y === "number" && Number.isFinite(y) ? y : null);
    }
    return out;
  };
  // How much of each of its eighths the scenery hides with its foot there (a share of its letters' height).
  const cuts = (tops, foot, caps) => tops.flatMap((y) => (y === null ? [] : [Math.max(0, Math.min(1, (foot - y) / caps))])).sort((a, b) => a - b);
  const behindAt = (tw) => {
    const caps = capsFor(tw);
    const tops = topsAt(LAND, tw);
    const known = tops.filter((y) => y !== null).sort((a, b) => a - b);
    if (known.length < COLS / 2) return null;
    const median = known[Math.floor((known.length - 1) / 2)];
    const foot = Math.round(Math.max(footMin(caps), Math.min(median + 0.16 * caps, known[1] + 0.5 * caps)));
    const cut = cuts(tops, foot, caps);
    return cut[Math.floor((cut.length - 1) / 2)] > 0.25 || cut.filter((c) => c > 0.6).length > 1 ? null : { tw, caps, foot };
  };
  let place = null;
  for (const [tw, most] of [[WIDE, footHigh], [MID, footHigh], [NARROW, footLow]]) {
    const p = behindAt(tw);
    if (p && p.foot <= most(p.caps)) { place = p; break; }
  }
  // What stands under her sky only reaches lower than its foot may go (low hills, a beach): in her sky, as low as it may.
  for (const tw of place ? [] : [WIDE, MID]) {
    const p = behindAt(tw);
    if (p) { place = { ...p, foot: Math.min(p.foot, footHigh(p.caps)) }; break; }
  }
  const behind = Boolean(place);
  // In front, without a sky read: its foot on the bottom of her clearest area (her sky first, else a calm wall), else at
  // the original's place (41,3 % of the height).
  const SKY = { prefer: "top", min: { w: Math.round(width * 0.55), h: Math.round(height * 0.08) }, within: { x: 0, y: 0, w: width, h: footHigh(capsFor(WIDE)) }, pad: 4, fallback: null };
  const sky = ClearBox(shots[g], LAND, laid, SKY);
  const TW = place ? place.tw : WIDE;
  const caps = place ? place.caps : capsFor(WIDE);
  const limit = TW === NARROW ? footLow(caps) : footHigh(caps);
  const foot0 = place ? place.foot : Math.round(Math.max(footMin(caps), Math.min(limit, sky ? sky.y + sky.h : height * 0.413)));
  // It stays on the scenery: moved with the picture (a slow push, a pan, the punch of a cut) as her sky's place is,
  // within its limits.
  const skyNow = sky ? ClearBox(shots[g], frame, laid, SKY) : null;
  const dx = skyNow ? skyNow.x + skyNow.w / 2 - (sky.x + sky.w / 2) : 0;
  const dy = skyNow ? skyNow.y + skyNow.h - (sky.y + sky.h) : 0;
  const foot = Math.round(Math.max(footMin(caps), Math.min(limit, foot0 + dy)));
  const edge = TW === NARROW ? 140 : 40;
  const left = Math.round(Math.max(edge, Math.min(width - edge - TW, (width - TW) / 2 + dx)));

  // 2. Its colours: the title flat and full in her main colour, as it is when it stands out 2,5:1 from her sky under it,
  // else a shade of it a step at a time on its own side of her sky (deeper when it is darker than her sky: the
  // original's blood red on its pale one; lighter when it is lighter), the other side if that one never gets there; the
  // brighter white of its wave on its letters (a deep shade of it on a light title), the paper white of its scenery, its
  // pen words warm white with a tight dark edge, or in the title's colour on a sky too bright for them.
  const PAPER = "#EFEDE9";
  const LIT = "#FCF8F9";
  const PEN = "#FFF5ED";
  const rgb = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const hex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const light = LightUnder(shots[g], LAND, laid, { x: (width - TW) / 2, y: foot0 - caps, w: TW, h: caps });
  const under = light && Number.isFinite(light.mean) ? lin(Math.max(0, Math.min(1, light.mean)) * 255) : 0.4;
  const shade = (c, dark) => { let x = c; for (let i = 0; i < 12 && ratio(lum(x), under) < 2.5; i++) x = dark ? x.map((v) => v * 0.82) : x.map((v) => v + (255 - v) * 0.3); return x; };
  const own = rgb(brand.accent) || [100, 0, 5];
  const near = shade(own, lum(own) <= under);
  const ink = ratio(lum(near), under) >= 2.5 ? near : shade(own, lum(own) > under);
  const INK = hex(ink);
  const WAVE_INK = lum(ink) < 0.3 ? LIT : hex(ink.map((v) => v * 0.45));
  const penOn = ratio(lum(rgb(PEN)), under) >= 1.6;
  const PEN_INK = penOn ? PEN : INK;
  const PEN_EDGE = penOn ? "0 0 1px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)" : "none";

  // 3. Its title: it rises from below in three images onto the hit, decelerating (its capitals 0,65 · 0,29 · 0,09 · 0,015
  // under its place), blurred upwards; its small words an image later, the same small move, fading in (26 %, 90 %). In
  // the page from its first image, hidden, so its box measures it once.
  const display = "'" + brand.displayFont + "', 'Archivo Black', 'Arial Black', sans-serif";
  const pen = "'Nothing You Could Do', 'Caveat', '" + brand.bodyFont + "', cursive";
  const BLUR = "tdb" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const RISE = [0.647, 0.294, 0.088, 0.015];
  const lift = (k) => (k >= 0 && k < 4 ? RISE[k] : 0);
  const t = frame - (HIT - 2);
  const u = frame - HIT;
  const smear = t >= 0 && t < 3 ? [0.16, 0.09, 0.03][t] * CAPS : 0;
  // A white wave over its letters, one at a time, left to right (its spaces skipped), from its mark: 2,4 images a letter,
  // quicker for a long word, done 6 images before the cut; the one before it back to its colour on the same image.
  const units = chars.map((c, i) => i).filter((i) => /\S/.test(chars[i]));
  const STEP = Math.max(1.6, Math.min(2.4, (END - 6 - WAVE) / Math.max(1, units.length)));
  const wk = frame >= WAVE ? Math.floor((frame - WAVE) / STEP) : -1;
  const litAt = wk >= 0 && wk < units.length ? units[wk] : -1;
  const lettering = litAt < 0 ? chars.join("") : chars.map((c, i) => h("span", { key: i, style: { color: i === litAt ? WAVE_INK : INK } }, c));
  const titleStyle = { fontFamily: display, fontWeight: 900, fontSynthesis: "none", fontSize: F0, lineHeight: 0.69, letterSpacing: "-0.02em", color: INK, whiteSpace: "nowrap", fontKerning: "none", fontVariantLigatures: "none", transform: "translateY(" + (lift(t) * CAPS).toFixed(1) + "px)", filter: smear > 0.3 ? "url(#" + BLUR + ")" : "none" };
  // Its small words: their capitals 41 % of its own, just above it, never wider than about 85 % of it (a long line over
  // a short name smaller: the name, never they, sets the size its box fits), as the original's, always narrower.
  const line = "++ " + keep(small) + " ++";
  const SMALL = Math.round(Math.min(CAPS * 0.554, (0.85 * 0.7 * F0 * Math.max(1, chars.length)) / (0.5 * letters(line).length)));
  const smallStyle = { fontFamily: pen, fontSize: SMALL, lineHeight: 0.8, color: PEN_INK, whiteSpace: "nowrap", marginBottom: Math.round(CAPS * 0.02), opacity: u < 0 ? 0 : u === 0 ? 0.26 : u === 1 ? 0.9 : 1, transform: "translateY(" + (lift(u + 1) * SMALL * 0.74).toFixed(1) + "px)", textShadow: PEN_EDGE };
  // One box for both, its bottom on the title's foot: a long title is smaller, its small words with it.
  const boxH = Math.round(F0 * 1.45);
  const title = h("div", { key: "title", style: { ...box, opacity: t >= 0 ? 1 : 0 } },
    h(FitText, { style: { position: "absolute", left, top: foot - boxH, width: TW, height: boxH }, innerStyle: { justifyContent: "flex-end" } },
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
        small ? h("div", { "data-fauve-accent": "", style: smallStyle }, line) : null,
        h("div", { style: titleStyle }, lettering))));
  // What stands under her sky, laid over it at every image: her roofs, trees, poles, wires and passers-by pass in front
  // of it, at the edge her sky's reading gives them (a firmer one, tried, made the clouds it left out of her sky hard
  // patches over its letters). Only across its band (from its small words down to where it rises from): elsewhere it
  // would only lay her shot over itself, a softer copy, and those clouds as patches in her sky.
  const defs = h("svg", { key: "defs", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
    h("filter", { id: BLUR, x: "-5%", y: "-60%", width: "110%", height: "220%" }, h("feGaussianBlur", { stdDeviation: "0 " + smear.toFixed(2) })));
  const band = "inset(" + Math.max(0, foot - Math.round((small ? 1.65 : 1.35) * CAPS) - 12) + "px 0 " + Math.max(0, height - foot - Math.round(0.7 * CAPS) - 12) + "px 0)";
  const front = behind ? h("div", { key: "front", style: { ...box, clipPath: band } }, h(Skyline, { shot: g, style: box })) : null;

  // 4. The scenery in white paper on the music's return, piece by piece, left to right, 2 to 3 images each (the original's
  // four buildings, then its pole): the piece of what its filler named in her stage (each one of « every building »,
  // else slices of it), six at most taken across its width, at its depth (over the title where the scenery passes in
  // front of it); the wave five images later. Nothing named, or not found there: no paper (all that stands under her
  // sky turned white at once, or in strips, is a white flash or a white bar, not paper pieces), the wave alone.
  const chasing = frame >= CHASE && frame < WAVE;
  const all = chasing ? SubjectParts(shots[g], frame, laid, "@decor", 5) : [];
  const sorted = all.slice().sort((a, b) => a.x - b.x);
  const six = sorted.length <= 6 ? sorted : [0, 1, 2, 3, 4, 5].map((i) => sorted[Math.round((i * (sorted.length - 1)) / 5)]);
  const each = six.length ? Math.max(2, Math.min(3, (WAVE - 5 - CHASE) / six.length)) : 3;
  const pk = chasing ? Math.floor((frame - CHASE) / each) : -1;
  const piece = pk >= 0 && pk < six.length ? six[pk] : null;
  const paper = piece ? h(Subject, { key: "paper", shot: g, object: "@decor", part: all.indexOf(piece), slices: 5, fill: PAPER, style: box }) : null;

  return h(AbsoluteFill, null, defs, ...(behind ? [title, front, paper] : [paper, title]));
}`;

export const titreDerriere: EffectPiece = {
  key: "titre-derriere",
  version: 1,
  name: "Son nom derrière le décor",
  how: "sur un coup, son nom géant monte d'en bas dans le ciel de son plan large, en capitales très grasses d'une seule couleur pleine, derrière le décor (ses toits, ses arbres, ses collines, ses passants passent devant ses lettres), trois petits mots au stylo entre deux croix au-dessus ; à la reprise, le décor devient papier blanc morceau par morceau, de gauche à droite, puis une vague blanche passe sur ses lettres, une à la fois ; le titre part avec la coupe.",
  needs: "un plan large et fixe (le téléphone posé) de sa rue, de son quartier, de sa devanture ou d'un paysage, avec un ciel calme dans le haut de l'image (dégagé ou voilé, sans gros nuages qui défilent) et des toits, une enseigne, un clocher ou des arbres qui y montent.",
  lays: "sur un seul de ses plans, ce plan large et fixe, environ 4 à 5 temps de la musique (souvent 2,5 à 4 s ; plus long quand il vit : des passants, des voitures, de la fumée), en ouverture de préférence : son nom s'y pose sur un coup et le montage reprend à la coupe",
  shots: [1, 1],
  seconds: [2.5, 6],
  require: { files: 1, shot: { framing: ["wide"], still: true, outdoors: true } },
  texts: [
    {
      slot: "titre",
      want: "le titre géant posé dans le ciel de son plan large, derrière le décor, sur une ligne en capitales : un seul mot de préférence (son quartier, sa rue, sa ville, ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), plus il est court plus il est grand",
      max: 12,
      required: true,
    },
    {
      slot: "surtitre",
      want: "2 ou 3 petits mots écrits au stylo au-dessus du titre, entre deux petites croix de chaque côté, qui l'amènent (une forme comme « un samedi à », « un mois à », « bienvenue à »)",
      max: 18,
      required: false,
    },
  ],
  objects: [
    {
      slot: "decor",
      shot: 0,
      want: "ce qui, sur ce plan large, monte dans le ciel et peut blanchir morceau par morceau, de gauche à droite : « every building », « every rooftop », « every house », « every tree » quand il y en a plusieurs (ils blanchissent un à un), sinon un seul nom (« skyline », « hills », « church tower ») ; « none » quand rien ne s'y prête (rien ne blanchit, la vague sur ses lettres suffit)",
    },
  ],
  timeline({ frames, bpm, shots }: PieceTimelineInput): PieceTimeline {
    // Its stage: the first of her shots that plays 9 images of it at least, within its span (the title goes with its cut).
    const first = shots.find((s) => Math.min(frames, s.from + s.frames) - Math.max(0, s.from) >= Math.min(9, frames / 2)) ?? shots[0] ?? { from: 0, frames };
    const from = Math.max(0, Math.round(first.from));
    const to = Math.min(frames, Math.round(first.from + first.frames));
    const beat = (60 / bpm) * REEL_FPS;
    const m = titleMarks(Math.max(1, to - from), beat);
    const hit = from + m.hit;
    return {
      marks: { hit, chase: from + m.chase, wave: from + m.wave },
      // The model's low whoosh, its loudest moment on the hit its title lands on (it builds up before it).
      sounds: [{ at: round3(hit / REEL_FPS), sound: "low whoosh rising into a deep bass hit", seconds: 1, gain: 2 }],
    };
  },
  code: CODE,
  // Its small words are always in its fine pen hand, whatever her charter's fonts.
  fonts: ["Nothing You Could Do"],
};
