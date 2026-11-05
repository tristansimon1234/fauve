import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Le lieu tapé », the effect of « Lieu tapé lettre à lettre » (docs/fiches/frappe.md, effects 1, 2 and 4; its whole
// Reel is skills/frappe.ts, v4): over the wide shot with sky the editor cut (her street, her terrace, her front, the sky
// at the top, or a plain wall), her name is typed by hand in extra-bold capitals of her colour, a character on each
// step, a pause in the middle and before the last letter as a hand types (the original's « IN-N-OUT », 6 images a
// character, 11 and 10 before its second hyphen and its last letter), with a thin light edge and a soft shadow, in the
// clear area of HER shot, its sky first (ClearBox: at the original's fixed place, a café's name fell on the towers of
// Notre-Dame), a little above the middle of that sky rather than stuck to its top (the original's sits a third of the
// way down); then her logo wipes in above it when she has one, and her name stays to the cut. When a close shot of
// her sign (or of her cups, her bouquets, her windows side by side) plays just before it, its pieces come out one after
// the other, 2 or 3 images each, the rest of the shot dimmed, then a dark moment, then all of it at once for 6 images,
// before the cut: each piece at its own light, a little brighter and warmer (pushed harder, a lit neon burnt into white
// blots on the bench of Le Petit Pont), its light fading out in a soft oval round it (cut square, a letter of a
// lightbox sign read as a lit box: its first local render, a « HOTEL »); nothing found to light there, a short flash of
// light on the picture instead. Its timings are in beats of the Reel's tempo, as its skill's (82,5 BPM there): the
// typing starts 0,77 of a beat into the sky shot, a step of 0,29 beat, 2,5 beats at most, a piece lit 0,1125 beat (2,5
// images at least), the dark 0,32 beat; the all-at-once on a beat of the sign shot when the chase fits before it, else
// just before the cut.
// Its sound: a key click on each letter as it lands (the original types silently under its own music; laid on any
// Reel's music, the typing is heard), at the very frame its code shows the letter (typedFrames: one formula for both).
// Left to the model: its quick zoom, its night front that blinks, its flash shots, its cinema bars and its burst, its
// ending card, its horizontal frame (the montage plays her shots full frame), and what belongs to its original (In-N-
// Out's arrow and colours: her logo and her colour, or the original's red-orange only on her word).
// An optional small line under her name (her street, her neighbourhood), set at once when the name is typed: a label
// in white capitals at a small size beside a title that reads (data-fauve-accent), never in the original.

/** Its typing, in beats of the Reel's tempo (its skill's): its start into the sky shot (in a short span, as soon as), a step, the longest. */
const TYPE_FROM = 0.77;
const TYPE_SOONEST = 0.35;
const TYPE_STEP = 0.29;
const TYPE_MOST = 2.5;
/** A step in frames, whatever the tempo: a hand types 4 to 10 characters a second (2 at the least for a long name in a short shot). */
const STEP_RANGE: [number, number] = [3, 7];
const STEP_LEAST = 2;
/**
 * Her name whole on screen before the effect ends (frames: 0,8 s, the original's 0,7 s before its cut, a beat when the
 * beat is longer); with its small line, that line's time (1 s, its two to four words), when it leaves the hand a step
 * of 2,5 frames at least (else her name alone, at its pace).
 */
const HOLD = 24;
const LINE_HOLD = 30;
const LINE_STEP = 2.5;
/** Its logo and its small line after the last letter (beats, 3 frames at least), the logo's wipe (beats: 8 to 16 frames). */
const AFTER = 0.15;
const AFTER_LEAST = 3;
const WIPE = 0.58;
/** Its pieces: each one lit (beats, 2,5 frames at least: the original's 2 or 3 images), the dark before all of them light up (beats, 4 frames at least), all lit (frames), the dim's own entrance (frames). */
const PIECE = 0.1125;
const PIECE_LEAST = 2.5;
const DARK = 0.32;
const LIT = 6;
const DIM_IN = 3;
/** One key click on each typed letter, 16 at most (a long name: spread over its letters, its first and its last). */
const CLICK = { sound: "keyboard key click", seconds: 0.5, gain: -4 };
const CLICKS = 16;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, n));
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("fr", { granularity: "grapheme" }) : null;

/** Her name's characters as its code types them: two figures kept together, in capitals, each letter as one sees it (an accented capital is one). */
export function typedLetters(name: string): string[] {
  const set = name.trim().replace(/(\d) (?=\d)/g, "$1\u00a0").toUpperCase();
  return segmenter ? Array.from(segmenter.segment(set), (s) => s.segment) : Array.from(set);
}

/** Each character's step before it (its first at once): a pause before the middle one (six or more) and before the last (three or more), a hand's. */
export const typingWeight = (i: number, n: number): number => (i === 0 ? 0 : i === n - 1 && n > 2 ? 1.65 : n >= 6 && i === Math.floor(n / 2) ? 1.8 : 1);

/** The frame each character shows (from the effect's start): the same formula its code runs, so each click lands on its letter. */
export function typedFrames(n: number, type: number, step: number): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += typingWeight(i, n);
    out.push(Math.round(type + step * acc));
  }
  return out;
}

/** How many pieces its code cuts her sign in when it is read in one piece: one a letter of her name (4 to 12), as its skill's. */
export const pieceSlices = (chars: string[]) => Math.max(4, Math.min(12, chars.filter((c) => /\S/.test(c) && c !== "-").length || 8));

/** Its marks and clicks for a span: the typing in its last shot, the all-at-once in the shot before it, the logo and the small line after. */
function frappeTimeline({ frames, bpm, shots, words }: PieceTimelineInput) {
  const beat = (60 / bpm) * REEL_FPS;
  const chars = typedLetters(words.lieu ?? "");
  const n = chars.length;
  const steps = Array.from({ length: n }, (_, i) => typingWeight(i, n)).reduce((a, b) => a + b, 0);
  const sky = shots.at(-1);
  const skyFrom = sky ? sky.from : 0;
  const soonest = Math.min(Math.max(0, frames - 1), Math.max(0, skyFrom) + 2);
  const wanted = Math.max(soonest, Math.round(skyFrom + TYPE_FROM * beat));
  const earliest = Math.min(wanted, Math.max(soonest, Math.round(skyFrom + TYPE_SOONEST * beat)));
  // Typed from 0,77 beat into its sky shot, a step of 0,29 beat (2,5 beats at most), her name whole long enough before
  // the end (with its small line, that line's reading time). A short span first takes from the time before its first
  // letter (down to 0,35 beat), then from the hand's pace (2 frames a step at least): its pace is the effect.
  const typing = (hold: number) => {
    const lastBy = frames - hold;
    let step = clamp(TYPE_STEP * beat, STEP_RANGE);
    if (steps > 0) step = Math.min(step, (TYPE_MOST * beat) / steps);
    if (steps > 0 && earliest + step * steps > lastBy) step = Math.max(STEP_LEAST, (lastBy - earliest) / steps);
    step = round2(step);
    return { step, type: steps > 0 ? Math.max(soonest, Math.min(wanted, Math.round(lastBy - step * steps))) : wanted };
  };
  const plain = Math.max(HOLD, Math.round(beat));
  // Its small line only when its time leaves the hand its pace: else her name alone.
  const lined = words.ligne?.trim() ? typing(Math.max(plain, LINE_HOLD + AFTER_LEAST)) : null;
  const line = Boolean(lined && (lined.step >= LINE_STEP || lined.step >= typing(plain).step));
  const { step, type } = line && lined ? lined : typing(plain);
  const at = typedFrames(n, type, step);
  // Its logo and its small line once the name is typed; each only when it still has its time before the end.
  const last = at.at(-1) ?? type;
  const after = Math.round(last + Math.max(AFTER_LEAST, AFTER * beat));
  const wipe = clamp(Math.round(WIPE * beat), [8, 16]);
  // The pieces of her sign, in the shot before: all at once on its last beat that leaves the chase its room before it and
  // its 6 images lit before the cut; else just before the cut (a short shot); none when that shot is too short.
  const piece = round2(Math.max(PIECE_LEAST, PIECE * beat));
  const dark = Math.max(4, Math.round(DARK * beat));
  const sign = shots.length > 1 ? shots[shots.length - 2] : undefined;
  let flash = -100;
  if (sign) {
    const s0 = Math.max(0, sign.from);
    const s1 = Math.min(frames, sign.from + sign.frames);
    const need = DIM_IN + dark + pieceSlices(chars) * piece;
    for (let k = Math.floor((s1 - LIT - sign.from) / beat); k >= 1 && flash < 0; k--) {
      const f = Math.round(sign.from + k * beat);
      if (f + LIT <= s1 && f - need >= s0) flash = f;
    }
    if (flash < 0 && s1 - s0 >= LIT + 8) flash = s1 - LIT;
  }
  // A key click on each letter as it lands (never on a space), 16 at most.
  const keys = at.flatMap((f, i) => (/\S/.test(chars[i]!) && f < frames ? [f] : []));
  const clicks = keys.length > CLICKS ? Array.from({ length: CLICKS }, (_, k) => keys[Math.round((k * (keys.length - 1)) / (CLICKS - 1))]!) : keys;
  return {
    marks: {
      type,
      type_step: step,
      flash,
      piece,
      dark,
      logo: after + wipe <= frames - 6 ? after : -100,
      wipe,
      line: line && after <= frames - LINE_HOLD ? after : -100,
    },
    sounds: clicks.map((f) => ({ at: f / REEL_FPS, ...CLICK })),
  };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its shots: those that play during it, in order (a frame and a half of overlap at either end is not one, as the
  // engine counts the shots under it). Her name types in the last one (her wide shot with sky); the one before it, when
  // there is one, is her sign's (its pieces come out one by one).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames - 1.5 && shots[i].from + shots[i].durationInFrames > 1.5);
  const sky = mine.length ? mine[mine.length - 1] : -1;
  const sign = mine.length > 1 ? mine[mine.length - 2] : -1;
  const cur = mine.reduce((k, i) => (shots[i].from <= frame ? i : k), mine.length ? mine[0] : -1);
  const laid = { left: 0, top: 0, width, height };
  const whole = { position: "absolute", left: 0, top: 0, width, height };

  // Her name's characters, in capitals (two figures kept together), each one typed on its frame: a step each, a pause
  // before the middle one and before the last, as a hand types (its timeline's clicks fall on the same frames).
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const chars = letters(keep(word("lieu")).toUpperCase());
  const n = chars.length;
  const weight = (i) => (i === 0 ? 0 : i === n - 1 && n > 2 ? 1.65 : n >= 6 && i === Math.floor(n / 2) ? 1.8 : 1);
  const TYPE = mark("type", 12);
  const STEP = Math.max(1, mark("type_step", 5));
  const shows = [];
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += weight(i); shows.push(Math.round(TYPE + STEP * acc)); }
  const typed = shows.filter((f) => frame >= f).length;

  // Her colour (her charter's other one when it is too pale to read on a sky, else the original's red-orange), white or
  // the original's on her word; a thin edge that stands out from it (light on a dark colour, as the original's, else
  // dark), so it reads on any sky.
  const rgb = (c) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return null; const s = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1]; const v = parseInt(s, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const pale = (c) => { const v = rgb(c); return !v || (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 > 0.72; };
  const lin = (x) => { const c = x / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (c) => { const v = rgb(c) || [0, 0, 0]; return 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]); };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const RED = "#ff2b00";
  const own = [brand.accent, brand.palette && brand.palette.secondary].find((c) => !pale(c));
  const choice = setting("couleur", "sienne");
  const INK = choice === "blanc" ? "#ffffff" : choice === "original" ? RED : own || RED;
  const CREAM = "#fff4d6";
  const EDGE = ratio(INK, CREAM) >= 3 ? CREAM : "#1d140e";
  const display = "'" + brand.displayFont + "', 'Montserrat', 'Poppins', 'Arial Black', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";

  // Its place: the largest clear area of her wide shot, its sky first (else a calm wall), the name's shape with room
  // above it for her logo and under it for its small line, in the safe zone and off her faces; never smaller than keeps
  // her name at about 54 px, else the original's place (its upper third). Its line as tall as the name is set: a long
  // name, set smaller to fill its width, takes a flatter box (sized on its 150 px, the name of a bar did not fit a thin
  // band of dusk sky and fell on its front).
  const SIZE = Math.min(150, Math.max(72, Math.round(2300 / Math.max(6, n))));
  const EM = 0.72;
  const nw = Math.round(width * 0.76);
  const textW = Math.min(nw, Math.round(Math.max(1, n) * SIZE * EM));
  const FS = Math.min(SIZE, textW / (Math.max(1, n) * EM));
  const nh = Math.round(FS * 1.3);
  const LOGO_AT = mark("logo", -100);
  const LINE_AT = mark("line", -100);
  const WIPE = Math.max(1, Math.round(mark("wipe", 10)));
  const hasLogo = Boolean(brand.logoUrl) && LOGO_AT >= 0;
  const line = LINE_AT >= 0 ? keep(word("ligne")) : "";
  const LINE_SIZE = 44;
  const logoH = hasLogo ? Math.round(FS * 1.25) : 0;
  const lineH = line ? Math.round(LINE_SIZE * 1.8) : 0;
  const total = nh + logoH + lineH;
  const least = Math.min(1, Math.max(0.4, 54 / FS));
  const fallback = { x: Math.round(width * 0.12), y: Math.round(height * 0.3) - logoH, w: textW, h: total };
  const found = (sky >= 0 ? ClearBox(shots[sky], frame, laid, { aspect: textW / total, min: { w: Math.round(textW * least), h: Math.round(total * least) }, max: { w: textW, h: total }, fallback }) : null) || fallback;
  // Not stuck to the top of her sky: a little above the middle of the tallest clear room of its width there (the
  // original's name sits a third of the way down its frame, in the sky beside a building).
  const room = found !== fallback ? ClearBox(shots[sky], frame, laid, { min: { w: found.w, h: found.h }, max: { w: found.w, h: height }, fallback: null }) : null;
  const spot = room ? { x: room.x, y: room.y + Math.max(0, room.h - found.h) * 0.42, w: found.w, h: found.h } : found;
  const fit = spot.h / total;
  const at = { x: Math.round(spot.x), y: Math.round(spot.y + logoH * fit), w: Math.round(spot.w), h: Math.round(nh * fit) };

  // 1. Her name, laid out whole from its first letter (nothing moves as it types), what is not typed yet unseen:
  // extra-bold capitals of her colour, its thin edge and a soft shadow.
  const nameSize = Math.round(FS * fit);
  const shadow = "1px 0 0 " + EDGE + ", -1px 0 0 " + EDGE + ", 0 1px 0 " + EDGE + ", 0 -1px 0 " + EDGE + ", 0 " + Math.round(nameSize * 0.06) + "px " + Math.round(nameSize * 0.12) + "px rgba(0,0,0,0.35)";
  const name = n && frame >= shows[0]
    ? h(FitText, { key: "name", style: { position: "absolute", left: at.x, top: at.y, width: at.w, height: at.h }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: nameSize, lineHeight: 1, letterSpacing: "0.01em", color: INK, whiteSpace: "nowrap", textShadow: shadow, justifyContent: "center", alignItems: "flex-start", textAlign: "left" } },
        h("span", null, chars.slice(0, typed).join(""), typed < n ? h("span", { style: { opacity: 0 } }, chars.slice(typed).join("")) : null))
    : null;

  // 2. Her logo wipes in above it, left to right, once it is typed; without a logo, nothing (the original's arrow is its
  // own brand's mark, never hers).
  const wiped = hasLogo ? Math.max(0, Math.min(1, (frame - LOGO_AT) / WIPE)) : 0;
  const eased = 1 - Math.pow(1 - wiped, 3);
  const logo = hasLogo && frame >= LOGO_AT
    ? h("div", { key: "logo", style: { position: "absolute", left: at.x, top: Math.round(spot.y), width: at.w, height: Math.round(logoH * fit * 0.88), clipPath: "inset(0 " + Math.round((1 - eased) * 100) + "% 0 0)" } },
        h(Img, { src: brand.logoUrl, style: { width: "100%", height: "100%", objectFit: "contain", objectPosition: "left center" } }))
    : null;

  // 3. Its small line under her name, at once with the logo: white letter-spaced capitals, a tight dark edge, small
  // beside the name that reads (an accent).
  const lineBox = { left: at.x, top: at.y + at.h, width: at.w, height: Math.round(lineH * fit) };
  const small = line && frame >= LINE_AT
    ? h(FitText, { key: "line", style: { position: "absolute", ...lineBox }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: Math.round(LINE_SIZE * fit), lineHeight: 1.1, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "flex-start", textAlign: "left" } },
        h("span", { "data-fauve-accent": "" }, line))
    : null;

  // 4. Her sign's pieces, in the shot before (what its filler saw there: its letters, her cups, each window), in reading
  // order: the rest of the shot dims (58 % in three images), one piece at a time comes out at its own light, then all of
  // it is dark a moment, then all at once for 6 images with a soft halo. With more pieces than room, each a little
  // shorter. Nothing to light there: a short flash of light on the picture instead, three images.
  const FLASH = mark("flash", -100);
  const PIECE = Math.max(1, mark("piece", 2));
  const DARK = Math.max(1, Math.round(mark("dark", 6)));
  const LIT = 6;
  const SLICES = Math.max(4, Math.min(12, chars.filter((c) => /\S/.test(c) && c !== "-").length || 8));
  const onSign = sign >= 0 && cur === sign && FLASH >= 0;
  const parts = onSign ? SubjectParts(shots[sign], frame, laid, "@lumieres", SLICES) : [];
  const s0 = sign >= 0 ? Math.max(0, shots[sign].from) : 0;
  const per = parts.length ? Math.max(1, Math.min(PIECE, (FLASH - DARK - s0 - 3) / parts.length)) : PIECE;
  const chaseFrom = FLASH - DARK - parts.length * per;
  const k = parts.length && frame >= chaseFrom && frame < FLASH - DARK ? Math.min(parts.length - 1, Math.floor((frame - chaseFrom) / per)) : -1;
  const glow = Math.max(2, Math.round(height * 0.006));
  const litFilter = "brightness(1.22) saturate(1.12) drop-shadow(0 0 " + glow + "px rgba(255,236,200,0.85))";
  // A piece's light fades out round it (a lit box cut square read as a lightbox, not a letter): its picture in a soft
  // oval a third larger than it, a warm glow over it.
  const p = k >= 0 ? parts[k] : null;
  const pad = p ? Math.round(Math.max(p.w, p.h) * 0.3) : 0;
  const FEATHER = "radial-gradient(closest-side, #000 62%, rgba(0,0,0,0) 100%)";
  const lit = p
    ? h("div", { key: "piece", style: { position: "absolute", left: Math.round(p.x - pad), top: Math.round(p.y - pad), width: Math.round(p.w + pad * 2), height: Math.round(p.h + pad * 2), overflow: "hidden", WebkitMaskImage: FEATHER, maskImage: FEATHER } },
        h(Subject, { shot: sign, object: "@lumieres", style: { left: -Math.round(p.x - pad), top: -Math.round(p.y - pad), width, height, filter: "brightness(1.25) saturate(1.12)" } }),
        h("div", { style: { position: "absolute", inset: 0, background: "radial-gradient(closest-side, rgba(255,236,200,0.3), rgba(255,236,200,0) 100%)", mixBlendMode: "screen" } }))
    : null;
  const flashing = onSign && frame >= FLASH && frame < FLASH + LIT;
  const missing = flashing && !SubjectBox(shots[sign], frame, laid, "@lumieres");
  const allLit = flashing && !missing
    ? h("div", { key: "all", style: { ...whole, filter: litFilter } }, h(Subject, { shot: sign, object: "@lumieres", style: { left: 0, top: 0, width, height } }))
    : null;
  const dimFrom = chaseFrom - 3;
  const dimK = onSign && parts.length && frame >= dimFrom && frame < FLASH + LIT ? 0.58 * Math.min(1, (frame - dimFrom + 1) / 3) : 0;
  const dim = dimK > 0 ? h("div", { key: "dim", style: { ...whole, background: "#000000", opacity: dimK } }) : null;
  const since = frame - FLASH;
  const bloomK = missing && since >= 0 && since < 3 ? [0.32, 0.2, 0.1][since] : 0;
  const bloom = bloomK > 0 ? h("div", { key: "bloom", style: { ...whole, background: "#fff6e4", mixBlendMode: "screen", opacity: bloomK } }) : null;

  return h(AbsoluteFill, { style: { overflow: "hidden" } }, dim, bloom, lit, allLit, logo, name, small);
}`;

export const frappe: EffectPiece = {
  key: "frappe",
  version: 1,
  name: "Le lieu tapé",
  how: "son nom tapé à la main, lettre à lettre, en capitales de sa couleur dans le ciel de son plan large (un clic à chaque lettre, une pause au milieu et avant la dernière), puis son logo au-dessus ; quand un plan serré de son enseigne (ou de choses alignées) passe juste avant, ses morceaux ressortent un à un, le reste assombri, puis tous d'un coup ; puis le montage reprend.",
  needs: "un plan large et posé de sa rue, de sa terrasse ou de sa devanture avec du ciel dégagé en haut (sinon un mur uni) ; en plus, si elle en a, son enseigne de près (des lettres séparées, un néon) ou des choses alignées (ses tasses, ses bouquets).",
  lays: "sur son plan large avec du ciel, 2 s au moins (son nom s'y tape) ; ou sur deux plans, son enseigne de près, 1 s au moins, puis ce plan large",
  shots: [1, 2],
  seconds: [2.5, 6],
  require: { files: 1, shot: { framing: ["wide"], outdoors: true } },
  texts: [
    { slot: "lieu", want: "le nom de son lieu tel qu'on le lit sur son enseigne, ou son nom, 1 à 3 mots (il se tape en capitales, lettre à lettre, dans le ciel)", max: 18, required: true },
    { slot: "ligne", want: "une petite ligne sous le nom, 2 à 4 mots vrais (son quartier, sa rue, sa ville : « Paris 11e », « rue des Martyrs »), seulement si le brief ou sa demande la veut", max: 22, required: false },
  ],
  objects: [
    {
      slot: "lumieres",
      shot: -2,
      want: "ce qui, dans ce plan serré, peut ressortir morceau par morceau, le reste assombri : d'abord les lettres de son enseigne (« shop sign », « neon sign ») ; sinon ce qu'elle vend posé côte à côte (« every cup », « every pastry »), chaque fenêtre d'une façade (« every window »), les ampoules d'une guirlande (« string lights ») ; « none » quand rien ne s'y prête (une lumière passe alors sur le plan)",
    },
  ],
  settings: [
    {
      name: "couleur",
      want: "la couleur du nom tapé",
      choices: [
        { value: "sienne", says: "sa couleur à elle (celle de sa charte ; trop pâle pour un ciel, son autre couleur, sinon un rouge orangé)" },
        { value: "blanc", says: "en blanc, avec un liseré sombre fin" },
        { value: "original", says: "le rouge orangé de l'original" },
      ],
    },
  ],
  timeline: frappeTimeline,
  code: CODE,
};
