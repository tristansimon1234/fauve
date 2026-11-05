import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Présente-toi » (key `silhouette`), version 2, written on its original's fiche (docs/fiches/silhouette.md: measured
// image by image at 30 i/s, its colours on its pixels, its silhouette apart from its text, its sound by bands; Tristan:
// « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A creative's animated intro: motion
// design on two flat colours, a midnight blue and a cold pale, and one real video, his profile filled with one tone. Its
// music is a slow half-time beat at 84,5 BPM, its bars on 1,06 · 3,90 · 6,74 · 9,58 s, a break before the drop of its
// second bar; every length below is in its beats from the Reel's start (its first bar 1,5 beats in, a pickup):
//   0 – 1,5     midnight blue, an empty text box as in a layout program (dashed guides across the frame, two tiny px
//               counts running); her first word typed, a letter alone then a burst, a key click each, growing by half
//               with a peach echo; the whole picture turns negative in one image (0,66); a hand of dots waves;
//   1,5 – 5,5   cut on the first bar: her profile, cut out and filled with one midnight tone on the pale; « Je suis » in
//               white inside her head; its first letter turns into a peach cursor and the rest goes as she lowers her
//               head (read on her tracks when it was measured, else on the beat); her name typed behind her head, on her
//               hair, its last name rising away; her first name shrinks to one round letter that grows with its echo
//               into the round letter of « Votre », whose letters pop round it on a click; on the beat the music
//               breaks (its tail ringing), the letter fills with peach, a pupil grows in it, and the eye rises;
//   5,5 – 7,5   on the drop, midnight lids close on the picture into an almond, the eye's iris where the letter was; it
//               narrows, its pupil turns to a cat's slit, it opens wide, its iris slides off with its echo, her trade
//               seen in white only inside the iris, then in ink as the almond opens onto the whole pale ground;
//   7,5 – 11    her trade held, what she does changing beside it on the music's hits (faster, then settling), a wavy line
//               drawn under it and taken back, a peach dot then her trade's line pictogram at the end of each word;
//   11 – 13,5   her name alone, small, receding;
//   13,5 – 15,6 cut on the last bar: midnight blue, her logo in white (else her place's name), the music ending on its
//               last hit with its tail; then the blue alone.
// Vertical full frame by default (its fiche: drawn on two flat colours, it hardly depends on her videos), her silhouette
// at the bottom, cut by the frame as the original's, framed round her head; on her word, the original's 16:9 frame in
// the middle on midnight bands. Her photo stays still, her video plays (at its own pace: a slowed shot is not cut out).
// Nothing of the original's own is copied: its name, its trades and its logo give way to hers.

const BPM = 84.5;
/** Its marks, in beats from the Reel's start (the original's images at 21,3 a beat). */
const CUT = 1.5;
const EYE = 5.5;
const OPEN = 7.5;
const NAME = 11;
const LOGO = 13.5;
const LOGO_HOLD = 1.69;
const END = 15.6;
/** The opening: her first letter, the negative, the burst of her others, her word growing, the hand of dots (images 5, 14, 18 to 29, 13 to 28, 17). */
const FIRST_LETTER = 5 / 21.3;
const NEGATIVE = 14 / 21.3;
const BURST_FROM = 18 / 21.3;
const BURST_TO = 29 / 21.3;
const GROW_FROM = 13 / 21.3;
const GROW_TO = 28 / 21.3;
const HAND = 17 / 21.3;
/** After the cut on her: her head going down on the hit of 0,75 beat when nothing was measured (images 45 to 53), her name typed from image 50. */
const HEAD_DOWN = 0.61;
const NAME_TYPE = 0.845;
/** Her last name rises away; her first name shrinks to its round letter on the hit, the next word's letters pop on a click (images 73, 80, 84, 88). */
const LAST_OUT = 1.92;
const REDUCE = 2.25;
const BECOME = 2.44;
const POP = 2.63;
/** On beat 3 of its first bar the music breaks and the letter fills with peach; its pupil grows, its last letter goes, the eye rises (images 96, 102 to 106, 110, 112). */
const FILL = 3;
const PUPIL = 3.29;
const LAST_LETTER = 3.66;
const RISE = 3.76;
/** After the drop: the slit on the hit of 0,75 beat, the eye opening wide, its iris sliding off, her trade in the iris, the almond widening (images 128, 132, 136, 146, 156). */
const SLIT = 0.52;
const WIDE = 0.7;
const SLIDE = 0.89;
const WORD_IN = 1.36;
const WIDEN = 1.83;
/** What she does, on the hits of its sixteenths from the Reel's start (the original's 31, 34, 37, 39, 41); its line shrinking from 10,52. */
const FIRST_JOB = 31;
const UNDER_FROM = 7.85;
const UNDER_TO = 8.5;
const DOT = 7.88;
const SHRINK = 10.52;
/** The ending card, in option: after her logo, the engine's 1,6 s at least, on whole quarters of a beat. */
const CARD_SECONDS = 1.6;
const round = (s: number) => Math.round(s * 100) / 100;
const round3 = (s: number) => Math.round(s * 1000) / 1000;
/** A key click on each letter typed, a click as the letters of « Votre » pop, a breath rising into the drop. */
const KEY = { sound: "keyboard key click", seconds: 0.5 };
const RISER = { sound: "short rising whoosh", seconds: 0.5, gain: -4 };

/** Her first word's letters as its code types them (code points of her word, its spaces taken out of the count). */
export const typedLetters = (word: string | undefined) => Array.from(String(word ?? "").normalize("NFC").trim()).filter((c) => !/\s/.test(c));

/**
 * The frame each letter of her first word lands on, as its code types it: the first one alone at `h`, the others in a
 * burst evenly from `from` to `to` (the original's « H » at image 5, then « ello » at 18, 22, 25 and 29).
 */
export function letterFrames(count: number, h: number, from: number, to: number): number[] {
  return Array.from({ length: count }, (_, i) => (i === 0 ? h : count === 2 ? from : Math.round(from + ((i - 1) * (to - from)) / Math.max(1, count - 2))));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const M = (k, d) => Math.round(mark(k, d));
  const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const lerp = (f, a, b, x, y, e) => interpolate(f, [a, Math.max(a + 1, b)], [x, y], e ? { ...cl, easing: e } : cl);
  const EIO = (x) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)), EO = (x) => 1 - Math.pow(1 - x, 3), EI = (x) => x * x;
  const CUT = M("cut", 32), EYE = M("eye", 117), OPEN = M("open", 160), NAME = M("name", 234), LOGO = M("logo", 288), NEG = M("negative", 14);
  const endAt = end ? end.from : durationInFrames + 1;
  const NAVY = "#0d0d1b", SIL = "#0f0f1c", PALE = "#f3f4f9", PEACH = "#d99868", INK = "#0a0a10";
  const font = "'" + brand.displayFont + "', 'Inter', 'Helvetica Neue', sans-serif";
  const W = width;
  // Vertical, or on her word its 16:9 frame on midnight bands.
  const wide = texts && texts.format === "horizontal";
  const S = wide ? { x: 0, y: Math.round((height - (W * 9) / 16) / 2), w: W, h: Math.round((W * 9) / 16) } : { x: 0, y: 0, w: W, h: height };
  const at = (fy, vy) => Math.round(wide ? S.y + fy * S.h : vy * height);
  const abs = (s) => ({ position: "absolute", ...s });
  const full = abs({ left: S.x, top: S.y, width: S.w, height: S.h });
  const inFrame = (key, ...kids) => h("div", { key, style: { ...full, overflow: "hidden" } }, h("div", { style: abs({ left: -S.x, top: -S.y, width: W, height }) }, ...kids));
  // A line of text centred on x (from x when left), its top at y.
  const row = (x, y, size, weight, color, kids, more, left) => h("div", { style: abs({ left: Math.round(left ? x : x - 450), width: left ? undefined : 900, top: Math.round(y), display: "flex", justifyContent: "center", fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1, color, whiteSpace: "pre", ...more }) }, kids);
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const role = (r, k) => reelTexts.filter((t) => t.role === r)[k];
  const hello = role("hook", 0), nom = role("band", 0), list = role("band", 1), je = role("caption", 0), ton = role("caption", 1), trade = role("caption", 2);
  const letters = (s) => Array.from(String(s || "").normalize("NFC").trim());
  const ground = frame < NEG || (frame >= EYE && frame < OPEN) || frame >= LOGO ? NAVY : PALE;

  // 1. Her first word typed, growing with its echo; guides, px counts, a hand of dots.
  const word = hello ? letters(keep(hello.text)) : [];
  const units = word.filter((c) => !/\s/.test(c));
  const H0 = M("h", 5), B0 = M("burst_from", 18), B1 = M("burst_to", 29), G0 = M("grow_from", 13), G1 = M("grow_to", 28);
  const lands = units.map((_, i) => (i === 0 ? H0 : units.length === 2 ? B0 : Math.round(B0 + ((i - 1) * (B1 - B0)) / Math.max(1, units.length - 2))));
  const FS = Math.max(72, Math.min(160, Math.round(1380 / Math.max(4, word.length))));
  const BASE = at(0.594, 0.45);
  const wordAt = (f) => {
    let n = 0;
    const shown = word.filter((c) => (/\s/.test(c) ? n < units.length && f >= lands[n] : f >= lands[n++])).join("");
    return { shown, size: FS * lerp(f, G0, G1, 0.67, 1, EIO) };
  };
  const drawWord = (f) => { const s = wordAt(f); return s.shown ? row(W / 2, BASE - s.size * 0.95, s.size, 600, f < NEG ? "#ffffff" : INK, s.shown) : null; };
  const opening = frame < CUT;
  const now = wordAt(frame);
  const tw = now.shown.length * now.size * 0.58;
  const gc = frame < NEG ? "#282836" : "#d6d7dc";
  const dash = (deg) => "repeating-linear-gradient(" + deg + "deg, " + gc + " 0 6px, transparent 6px 12px)";
  const gx0 = Math.round(W / 2 - Math.max(30, tw / 2) - 8), gx1 = Math.round(W / 2 + Math.max(30, tw / 2) + 8);
  const gy0 = Math.round(BASE - now.size * 0.78), gy1 = Math.round(BASE + now.size * 0.04);
  const count = (d) => Math.round(97 + 539 * Math.pow(Math.min(1, frame / 30), frame > 10 ? 0.8 : 1.4) + d) + "px";
  const tiny = (x, y, t) => h("div", { style: abs({ left: x, top: y, fontFamily: "monospace", fontSize: 16, color: gc }) }, t);
  const guides = opening
    ? inFrame("guides", h("div", { "data-fauve-decor": "", style: abs({ left: 0, top: 0, width: W, height }) },
        [gy0, gy1].map((y) => h("div", { key: "y" + y, style: abs({ left: 0, top: y, width: W, height: 2, background: dash(90) }) })),
        [gx0, gx1].map((x) => h("div", { key: "x" + x, style: abs({ left: x, top: 0, width: 2, height, background: dash(180) }) })),
        tiny(gx0 + 6, gy0 - 26, count(9)), tiny(gx0 - 70, gy0 + 8, count(43)),
        frame < H0 && Math.floor(frame / 2) % 2 === 0 ? h("div", { style: abs({ left: W / 2 - 2, top: BASE - FS * 0.62, width: 4, height: FS * 0.66, background: "#ffffff" }) }) : null))
    : null;
  const typed = opening && hello ? (frame >= G0 && frame < G1 + 4 ? h(Echo, { key: "word", draw: (f) => drawWord(f), count: 4, gap: 1, fade: 0.6, color: PEACH }) : h("div", { key: "word" }, drawWord(frame))) : null;
  const HAND = M("hand", 17);
  const hx = W / 2 + tw / 2 + now.size * 0.08, hy = BASE - now.size * 1.55, hs = now.size * 0.8;
  const tilt = (Math.sin(((frame - HAND - 4) / 7) * Math.PI) * 14 * Math.PI) / 180;
  const HANDPTS = [[[20,55],[80,55],[80,96],[66,116],[34,116],[20,96]],[[22,18],[34,18],[34,55],[22,55]],[[37,6],[50,6],[50,55],[37,55]],[[53,12],[66,12],[66,55],[53,55]],[[69,26],[80,26],[80,55],[69,55]],[[2,58],[12,52],[20,64],[20,84],[10,78]]];
  const handPath = HANDPTS.map((poly) => "M" + poly.map(([x, y]) => {
    const dx = (x - 50) / 100, dy = (y - 116) / 100;
    return Math.round(hx + (dx * Math.cos(tilt) - dy * Math.sin(tilt)) * hs) + " " + Math.round(hy + hs + (dx * Math.sin(tilt) + dy * Math.cos(tilt)) * hs);
  }).join(" L") + " Z").join(" ");
  const hand = opening && frame >= HAND ? h(DotGrid, { key: "hand", shape: handPath, box: { x: Math.round(hx - hs), y: Math.round(hy - hs * 0.2), w: Math.round(hs * 2), h: Math.round(hs * 1.4) }, step: 8, size: 6, color: "#3b3b45", at: HAND, frames: 4, build: "rise" }) : null;

  // 2. Her profile in one tone on the pale (nobody: what the filler named, else a print), on the original's head.
  const sh = shots[0];
  const sil = sh && frame >= CUT && frame < EYE;
  const base ={ left: 0, top: 0, width: Math.round(S.h * (sh && sh.aspect > 0 ? sh.aspect : S.w / S.h)), height: S.h };
  const ref = Math.max(0, Math.min(sh ? sh.durationInFrames - 1 : 0, 6));
  const OBJ = "@forme";
  const herBox = sh ? SubjectBox(sh, ref, base) : null;
  const what = herBox || OBJ.charAt(0) === "@" ? undefined : OBJ;
  const box0 = sh ? herBox || (what ? SubjectBox(sh, ref, base, what) : null) : null;
  const cutHer = (style) => h(Subject, { shot: 0, at: CUT, fill: SIL, style, ...(what ? { object: what } : {}) });
  // Her head: the top of her outline.
  const headOf = (path, b) => {
    const nums = path ? String(path).match(/-?\d+(?:\.\d+)?/g) : null;
    if (nums && nums.length >= 12) {
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])]);
      const ys = pts.map((p) => p[1]);
      const y0 = Math.min.apply(null, ys), span = Math.max.apply(null, ys) - y0;
      const xs = pts.filter((p) => p[1] <= y0 + span * 0.16).map((p) => p[0]);
      const lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
      return { x: (lo + hi) / 2, y: y0, w: Math.max(40, hi - lo) * 1.15 };
    }
    return b ? { x: b.x + b.w / 2, y: b.y, w: b.w * 0.45 } : null;
  };
  const head0 = sh ? headOf(SubjectOutline(sh, ref, base, what), box0) : null;
  const want = wide ? { w: S.w * 0.2, y: S.y + S.h * 0.22, x: S.x + S.w * 0.47 } : { w: W * 0.33, y: height * 0.42, x: W * 0.5 };
  // As wide as the original's head (to the bottom when her picture cuts her).
  const low = box0 && box0.y + box0.h >= base.height * 0.97 ? (S.y + S.h - want.y) / Math.max(40, base.height - head0.y) : 0;
  const k = head0 ? Math.max(0.15, Math.min(3, Math.max(want.w / head0.w, low))) : 1;
  const laid = head0 ? { left: Math.round(want.x - head0.x * k), top: Math.round(want.y - head0.y * k), width: Math.round(base.width * k), height: Math.round(base.height * k) } : { ...full };
  // A side her picture cuts goes past the frame's.
  if (head0 && box0.x + box0.w >= base.width * 0.97) laid.left = Math.max(laid.left, S.x + S.w - laid.width);
  if (head0 && box0.x <= base.width * 0.03) laid.left = Math.min(laid.left, S.x);
  const L = abs(laid);
  const local = (f) => Math.max(0, f - CUT);
  const cutOut = Boolean(box0);
  // The print's threshold from her shot's light, its darks midnight.
  const lit = sh && !cutOut && typeof LightUnder === "function" ? LightUnder(shots[0], ref, base) : null;
  const gain = lit && lit.mean > 0.04 ? Math.max(0.55, Math.min(2.4, 0.5 / lit.mean)) : 1.35;
  const print = "grayscale(1) brightness(" + gain.toFixed(2) + ") contrast(3.2)";
  const her = sil ? inFrame("her", cutOut ? cutHer(L) : h("div", { style: { ...full, isolation: "isolate" } }, h(Footage, { shot: 0, at: CUT, style: { ...L, filter: print } }),
    h("div", { style: { ...full, background: PALE, mixBlendMode: "darken" } }), h("div", { style: { ...full, background: SIL, mixBlendMode: "lighten" } }))) : null;
  // Her head going down: measured on her tracks, else on the beat.
  const down = (sh && typeof HeadMoves === "function" ? HeadMoves(sh) : []).map((m) => ({ from: m.from + CUT, to: m.to + CUT, what: m.what })).find((m) => m.what === "down" && m.from >= CUT + 4 && m.from < EYE - 40);
  const D0 = down ? down.from : M("head_down", 45), D1 = down ? Math.min(down.to, D0 + 20) : D0 + 8;
  const headAt = (f) => (sh ? headOf(SubjectOutline(sh, local(f), laid, what), SubjectBox(sh, local(f), laid, what)) : null) || want;
  const hd = headAt(CUT + 4);
  const face = track ? ((track(local(CUT + 4), { shot: 0, ...laid }) || {}).faces || [])[0] : null;
  const imAt = face ? { x: face.x, y: face.y } : { x: hd.x, y: hd.y + hd.w * 0.5 };
  // « Je suis » in her head; its first letter turns peach, the rest goes as her head lowers.
  const imChars = je ? letters(je.text) : [];
  // Kept in her head and in the frame (left of Instagram's buttons).
  const iL = Math.max(60, hd.x - hd.w / 2), iR = Math.min(imAt.y > 900 ? W - 160 : W - 60, hd.x + hd.w / 2);
  const imFs = Math.max(48, Math.min(wide ? 84 : 116, Math.round(((iR - iL) * 1.5) / Math.max(3, imChars.length))));
  const outline = sil ? SubjectOutline(sh, local(frame), laid, what) : null;
  const im = je && frame >= CUT && frame < D0 + 6
    ? h("div", { key: "im", style: abs({ left: 0, top: 0, width: W, height, ...(outline ? { clipPath: "path('" + outline.replace(/ M /g, " L ") + " Z')" } : {}) }) },
        row(Math.max(iL + imChars.length * imFs * 0.31, Math.min(iR - imChars.length * imFs * 0.31, imAt.x)) + lerp(frame, CUT, CUT + 8, 13, 0, EO), imAt.y - imFs * 0.6, imFs, 600, "#ffffff", imChars.map((c, i) => {
          const g = D0 + (imChars.length - 1 - i) * 0.7;
          return h("span", { key: i, style: { opacity: i ? lerp(frame, g, g + 2, 1, 0) : 1, color: i || frame < D0 - 4 ? undefined : frame >= D0 ? PEACH : "#f0c6a6" } }, c);
        })))
    : null;
  // Her name typed behind her head; its round letter becomes the o of « Votre », then an eye.
  const NT = down ? Math.min(EYE - 60, D0 + 5) : M("name_type", 50);
  const hdDown = headAt(Math.min(EYE - 1, Math.max(NT + 9, D1)));
  // Over her head, kept whole in the frame.
  const within = (w) => Math.max(60 + w / 2, Math.min(W - 60 - w / 2, hdDown.x));
  const nameWords = nom ? keep(nom.text).split(/\s+/).filter(Boolean) : [];
  const first = nameWords[0] || "", rest = nameWords.slice(1).join(" ");
  const nmFs = 56;
  const nameLetters = letters(first + (rest ? " " + rest : ""));
  const typedN = Math.max(0, Math.min(nameLetters.length, Math.floor((frame - NT + 1) * 1.33)));
  const LO = M("last_out", 73), RD = M("reduce", 80), BC = M("become", 84), POP = M("pop", 88), FILL = M("fill", 96), PU = M("pupil", 102), LL = M("last_letter", 110), RISE = M("rise", 112);
  const ny = Math.round(Math.max(S.y + 40, hdDown.y - nmFs * 1.1));
  const blink = frame < NT + nameLetters.length * 0.75 + 2 || Math.floor((frame - NT) / 6.5) % 2 === 0;
  const nameNode = nom && frame >= NT && frame < RD
    ? h("div", { key: "name" }, row(within(nameLetters.length * nmFs * 0.6), ny, nmFs, 400, INK, [
        h("span", { key: "f" }, nameLetters.slice(0, Math.min(typedN, first.length)).join("")),
        rest && typedN > first.length + 1 ? h("span", { key: "r", style: { fontWeight: 700, display: "inline-block", transform: "translateY(" + lerp(frame, LO, LO + 5, 0, -10) + "px)", opacity: lerp(frame, LO, LO + 5, 1, 0) } }, " " + nameLetters.slice(first.length + 1, typedN).join("")) : null,
        blink ? h("span", { key: "c", style: { display: "inline-block", width: 5, height: nmFs * 0.95, marginLeft: 3, background: PEACH } }) : null]))
    : null;
  const tonChars = ton ? letters(ton.text) : [];
  const ROUND = /[oOaAeEuUcCdDgGqQbBpP0]/;
  const find = (arr, test) => arr.findIndex(test);
  const hasRound = tonChars.some((c) => ROUND.test(c));
  const ti = Math.max(0, find(tonChars, (c) => /[oO0]/.test(c)) >= 0 ? find(tonChars, (c) => /[oO0]/.test(c)) : find(tonChars, (c) => ROUND.test(c)));
  const fl = letters(first);
  const same = (c) => c.toLowerCase() === String(tonChars[ti] || "o").toLowerCase();
  const fi = Math.max(0, find(fl, same) >= 0 ? find(fl, same) : find(fl, (c) => ROUND.test(c)));
  const tFs = wide ? 72 : 84;
  // Above her head (ink on her silhouette would not read).
  const ty = Math.round(Math.max(S.y + (wide ? 24 : 60), Math.min(hdDown.y, headAt(POP).y, headAt(FILL).y, headAt(EYE - 1).y) - tFs * 1.3));
  const cw = tFs * 0.56;
  // No round letter (« Ta »): a peach dot after it becomes the eye.
  const VX = within((tonChars.length + 1) * cw);
  const ox = VX + ((hasRound ? ti : tonChars.length + 0.2) - (tonChars.length - 1) / 2) * cw;
  const nx = within(nameLetters.length * nmFs * 0.6) - (nameLetters.length * nmFs * 0.54) / 2;
  // The eye rises to where the iris will be (a match cut on the drop).
  const EH = wide ? S.h * 0.76 : W * 0.41;
  const T = wide ? S.y + EH * 0.36 : Math.max(at(0, 0.18), Math.min(at(0, 0.34), ty - tFs * 0.78 - EH * 0.36)) + EH * 0.36;
  const IX = Math.max(S.x + S.w * 0.35, Math.min(S.x + S.w * 0.65, ox)), eyeX = (f) => lerp(f, RISE, EYE, ox, IX, EI);
  const eyeY = (f) => lerp(f, RISE, EYE, ty + tFs * 0.42, T, EI);
  const roundLetter = (f) => {
    const sz = lerp(f, RD, BC, nmFs, tFs) * lerp(f, RD, BC, 1, 1.25, EO);
    return row(lerp(f, RD, BC, nx + (fi + 0.5) * nmFs * 0.54, ox, EIO), lerp(f, RD, BC, ny + nmFs * 0.55, ty + tFs * 0.42, EIO) - sz * 0.55, sz, 400, INK, f < BC ? fl[fi] || "o" : tonChars[ti] || "o");
  };
  const bounce = (i) => { const t = frame - POP - Math.abs(i - ti); return t < 0 ? null : -Math.round(tFs * 0.5 * Math.exp(-t / 3.5) * Math.abs(Math.cos(t / 2.2))); };
  const tonNode = ton && frame >= RD && frame < EYE
    ? h(React.Fragment, { key: "ton" },
        frame < BC + 3 ? h(Echo, { draw: (f) => (f >= RD ? roundLetter(f) : null), count: 3, gap: 1, color: PEACH }) : null,
        row(VX, ty, tFs, 400, INK, tonChars.map((c, i) => {
          if (i === ti && hasRound) return h("span", { key: i, style: { opacity: frame >= BC + 3 && frame < FILL ? 1 : 0, display: "inline-block", transform: "translateY(" + (frame >= POP ? -Math.round(tFs * 0.12) : 0) + "px)" } }, c);
          const dy = bounce(i);
          return h("span", { key: i, style: { opacity: dy === null || (i === tonChars.length - 1 && frame >= LL) ? 0 : 1, display: "inline-block", transform: "translateY(" + (dy || 0) + "px)" } }, c);
        })),
        frame < BC + 3 && hasRound ? roundLetter(frame) : null)
    : null;
  // The eye: peach iris, rays, rim, highlight, pupil (round, then a slit).
  const irisAt = (cx, cy, r, slit, rays) => h("svg", { width: W, height, style: abs({ left: 0, top: 0, overflow: "visible" }) },
    h("circle", { cx, cy, r, fill: "#d69665", stroke: "#8a5a36", strokeWidth: Math.max(2, r * 0.05) }),
    rays ? Array.from({ length: 36 }, (_, i) => { const a = (i * Math.PI) / 18, c = Math.cos(a) * r, s = Math.sin(a) * r; return h("line", { key: i, x1: cx + c * 0.42, y1: cy + s * 0.42, x2: cx + c * 0.92, y2: cy + s * 0.92, stroke: "#a86f45", strokeWidth: 1.2, opacity: 0.5 }); }) : null,
    h("ellipse", { cx, cy, rx: r * (0.5 - 0.38 * slit), ry: r * (0.5 + 0.38 * slit), fill: NAVY }),
    h("circle", { cx: cx + r * 0.42, cy: cy - r * 0.48, r: r * 0.17, fill: "#ffffff" }));
  const smallEye = ton && frame >= FILL && frame < EYE
    ? h("svg", { key: "seye", width: W, height, style: abs({ left: 0, top: 0 }) },
        h("circle", { cx: eyeX(frame), cy: eyeY(frame), r: tFs * 0.27 * lerp(frame, RISE, EYE, 1, 2.4), fill: PEACH, stroke: frame < RISE && hasRound ? INK : "none", strokeWidth: tFs * 0.07 }),
        h("circle", { cx: eyeX(frame), cy: eyeY(frame), r: tFs * 0.15 * lerp(frame, PU, PU + 4, 0, 1) * lerp(frame, RISE, EYE, 1, 2.4), fill: NAVY }))
    : null;

  // 3. On the drop, lids close into an almond; her trade white in the iris, then ink on the pale.
  const E = { x: S.x + S.w * 0.09, y: T - EH * 0.36, w: S.w * 0.82, h: EH };
  const box = (y0, y1, g) => ({ x: E.x - g * E.w, y: E.y + y0 * E.h, w: E.w * (1 + 2 * g), h: (y1 - y0) * E.h * (1 + g) });
  const SL = M("slit", 128), WI = M("wide", 132), SD = M("slide", 136), WO = M("word_in", 146), WN = M("widen", 156);
  const irisX = (f) => lerp(f, SD, SD + 5, IX, IX + E.w * 0.08, EO);
  const irisY = (f) => lerp(f, SD, SD + 5, T, E.y + E.h * 0.62, EO);
  const irisR = E.h * 0.33;
  const tradeText = trade ? keep(trade.text) : "";
  const trFs = wide ? 60 : 66;
  const irisFade = lerp(frame, OPEN - 1, OPEN + 1, 1, 0);
  const inIris = frame < OPEN - 1;
  const eye = frame >= EYE && frame <= OPEN + 1 && frame < endAt
    ? h(Window, { key: "eye", box: box(0, 1, 0), at: EYE, open: 0, reveal: "eye", fit: "cut", moves: [{ at: EYE + 1, frames: 1, box: box(0.05, 0.67, 0) }, { at: WI, frames: 8, box: box(0.05, 1.16, 0) }, { at: WN, frames: 4, box: box(-0.2, 1.4, 0.12) }, { at: OPEN, frames: 1, box: { x: -W, y: -height, w: 3 * W, h: 3 * height } }] },
        h("div", { style: abs({ left: 0, top: 0, width: W, height, background: PALE }) },
          frame < EYE + 2 && cutOut ? cutHer(L) : null,
          irisFade > 0 ? h("div", { style: { opacity: irisFade } }, frame >= SD && frame < SD + 8 ? h(Echo, { draw: (f) => irisAt(irisX(f), irisY(f), irisR, 1, false), count: 4, gap: 1, color: PEACH, self: false }) : null, irisAt(irisX(frame), irisY(frame), irisR, lerp(frame, SL, SL + 7, 0, 1), true)) : null,
          frame >= WO && trade ? h("div", { style: abs({ left: 0, top: 0, width: W, height, ...(inIris ? { clipPath: "circle(" + Math.round(irisR) + "px at " + Math.round(irisX(frame)) + "px " + Math.round(irisY(frame)) + "px)" } : {}) }) },
            row(W / 2, irisY(frame) - trFs * 0.55, trFs, 400, inIris ? "#ffffff" : INK, tradeText)) : null))
    : null;

  // 4. Her trade held, what she does on the hits, a wavy line, a peach dot, her pictogram.
  const items = list ? String(list.text).split(/\s*[,;·|\/\n]\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 5) : [];
  const GAPS = [[0], [0, 6], [0, 4, 8], [0, 3, 6, 9], [0, 3, 6, 8, 10]][Math.max(0, items.length - 1)];
  const jobAt = GAPS.map((g) => Math.round(M("job", 165) + (g * mark("beat", 21.3)) / 4));
  const cur = items.length ? jobAt.reduce((c, f, i) => (frame >= f ? i : c), -1) : -1;
  const JX = wide ? Math.round(S.w * 0.333) : 140, JY = at(0.44, 0.44), SH = M("shrink", 224);
  const jobsOn = trade && frame >= OPEN + 2 && frame < NAME + 2;
  const drawn = Math.min(lerp(frame, M("under_from", 166), M("under_to", 180), 0, 1), lerp(frame, SH, SH + 8, 1, 0));
  const tw2 = tradeText.length * trFs * 0.52;
  const wave = "M0 8 " + Array.from({ length: 12 }, (_, i) => "Q" + ((i + 0.5) * tw2) / 12 + " " + (i % 2 ? 16 : 0) + " " + ((i + 1) * tw2) / 12 + " 8").join(" ");
  const enter = cur === 0 ? lerp(frame, jobAt[0] - 1, jobAt[0] + 2, 60, 0) : 0;
  const PI0 = M("picto", 182);
  const jobs = jobsOn
    ? h("div", { key: "jobs" }, row(JX, JY - trFs * 0.6, trFs, 400, INK, [
        h("span", { key: "t", style: { position: "relative" } }, tradeText,
          drawn > 0 ? h("svg", { width: tw2 + 4, height: 20, style: abs({ left: 0, top: trFs * 1.08, overflow: "visible" }) }, h("path", { d: wave, fill: "none", stroke: INK, strokeWidth: 3, pathLength: 1, strokeDasharray: drawn.toFixed(3) + " 1" })) : null),
        cur >= 0 ? h("span", { key: "j", style: { fontWeight: 700, marginLeft: "0.35em", position: "relative", display: "inline-block", transform: "translateX(" + enter + "px)", filter: enter > 1 ? "blur(3px)" : undefined } }, items[cur],
          frame >= M("dot", 167) ? h("span", { style: abs({ right: -trFs * 0.42, top: -trFs * 0.12, width: W * 0.035, height: W * 0.035, borderRadius: "50%", background: PEACH }) }) : null,
          frame >= PI0 ? h("span", { style: abs({ right: -trFs * 0.62, top: -trFs * 0.42 }) }, h(Picto, { name: tradeText, size: trFs * 0.9, at: PI0, frames: 8 })) : null) : null,
      ], { transformOrigin: "0 50%", transform: "scale(" + lerp(frame, SH, SH + 9, 1, 0.75, EIO).toFixed(3) + ")", opacity: lerp(frame, NAME, NAME + 2, 1, 0), lineHeight: 1.2 }, true))
    : null;
  // Her whole list, for the scene check.
  const listCopy = jobsOn && list ? h("div", { key: "lc", "data-fauve-decor": "", style: abs({ left: JX, top: JY, opacity: 0, fontSize: 20 }) }, list.text) : null;

  // 5. Her name receding; her logo white on the blue (else her place's name); her card in option.
  const MID = at(0.5, 0.45);
  const alone = nom && frame >= NAME && frame < LOGO
    ? h("div", { key: "alone" }, row(W / 2, MID - 40, Math.round(72 * lerp(frame, NAME, LOGO, 1, 0.68)), 400, INK, [first, rest ? h("span", { key: "r", style: { fontWeight: 700 } }, " " + rest) : null], { opacity: lerp(frame, NAME - 1, NAME + 1, 0, 1), lineHeight: 1.1 }))
    : null;
  const logo = frame >= LOGO && frame < M("logo_out", 324) && frame < endAt
    ? brand.logoUrl
      ? h(Img, { key: "logo", src: brand.logoUrl, style: abs({ left: W / 2 - 120, top: MID - 50, width: 240, height: 100, objectFit: "contain", filter: "brightness(0) invert(1)" }) })
      : h("div", { key: "logo" }, row(W / 2, MID - 34, 56, 700, "#ffffff", keep(brand.name || first).toUpperCase(), { letterSpacing: "0.08em" }))
    : null;
  const card = (t, y, size, weight, align) => h(FitText, { style: abs({ left: 140, top: y, width: W - 280, height: size * 2.3 }), innerStyle: { fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.1, color: "#ffffff", textAlign: "center", textWrap: "balance", justifyContent: align } }, keep(t));
  const ending = end && frame >= endAt ? h(React.Fragment, { key: "end" }, card(end.title, MID - 193, 84, 600, "flex-end"), end.subtitle ? card(end.subtitle, MID + 60, 50, 400, "flex-start") : null) : null;
  const used = [hello, nom, list, je, ton, trade];
  const extra = reelTexts.filter((t) => !used.includes(t) && frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: abs({ left: 140, width: W - 280, top: 160 + i * 120, height: 100 }), innerStyle: { fontFamily: font, fontWeight: 600, fontSize: 52, color: ground === NAVY ? "#ffffff" : INK, textAlign: "center" } }, t.text));

  return h(AbsoluteFill, { style: { backgroundColor: wide ? NAVY : ground } },
    wide ? h("div", { style: { ...full, background: ground } }) : null,
    guides, typed, hand, nameNode, her, im, tonNode, smallEye, eye, jobs, listCopy, alone, logo, ending, extra);
}`;

export const silhouette: MontageSkill = {
  key: "silhouette",
  // 2: written again on its original's fiche: its opening as a layout program, its negative, her first word typed with
  // its clicks, her profile in one tone with « Je suis » in her head, her name typed behind it, the round letter that
  // becomes an eye, the almond on the drop, her trades on the hits, her name receding, her logo on the blue; its 84,5
  // BPM, its break and its last hit with its tail. 3: nobody in profile in her shot (its first bench, a florist's window
  // of roses, came out all pale: no silhouette at all): what the filler names there (her bouquet, her shop front) is
  // cut out in its place, and the print without a cut-out takes its threshold from her shot's light, midnight on pale.
  version: 3,
  bpm: BPM,
  // Her profile, then a shot never seen (the eye, her trades and her logo are drawn on its two flat colours).
  shots: [2, 2],
  files: [1, 4],
  how: "Un générique : sur un bleu nuit, une boîte de texte comme dans un logiciel de mise en page, où son premier mot se tape (une lettre, puis une rafale, un clic par lettre) et grandit, et tout passe en négatif sur un fond pâle ; coupe sur sa silhouette de profil, d'un seul bleu nuit, « Je suis » en blanc dans sa tête, qui s'efface quand elle baisse la tête ; son nom se tape derrière sa tête, son nom de famille s'en va, son prénom se réduit à une lettre ronde qui devient l'o de « Votre », qui se remplit de pêche et devient un œil ; sur le drop, des paupières bleu nuit se ferment sur l'image, l'œil s'ouvre, son métier apparaît dans l'iris puis sur le fond pâle, et ce qu'elle fait défile à côté sur les coups ; son nom seul qui recule, puis son logo blanc sur le bleu nuit.",
  end: true,
  texts: [
    { slot: "bonjour", role: "hook", want: "son premier mot, tapé en grand au début : un salut court de 5 à 8 lettres (« Bonjour », « Salut », « Coucou ») ou son prénom", max: 10, required: true },
    { slot: "nom", role: "band", want: "son prénom et son nom (ou le nom de son lieu) : tapé derrière sa tête, le nom s'en va et le prénom reste, puis il revient seul à la fin", max: 26, required: true },
    { slot: "choses", role: "band", want: "facultatif : 3 à 5 choses qu'elle fait, séparées par des virgules, un mot court chacune, qui défilent à côté de son métier (une forme comme « couleur, coupe, chignon, mariage »)", max: 60, required: false },
    { slot: "je", role: "caption", want: "les mots blancs dans sa tête, juste avant son nom : « Je suis » (« On est » pour une équipe, « Voici » quand elle présente quelqu'un)", max: 9, required: true },
    { slot: "ton", role: "caption", want: "le petit mot avant son métier, dont la lettre ronde devient un œil : « Votre » (ou « Ton », « Ta » selon son ton ; jamais un genre deviné)", max: 6, required: true },
    { slot: "metier", role: "caption", want: "son métier ou ce qu'elle est, en un mot (une forme comme « Fleuriste », « Coiffure », « Céramiste », « Barbier »)", max: 14, required: true },
  ],
  objects: [
    {
      slot: "forme",
      shot: 0,
      want: "seulement quand personne n'est de profil dans ce plan : la chose dont la forme fera sa silhouette, une seule, entière dans l'image et nette sur son fond (« bouquet of roses », « vase of flowers », « shop front », « coffee cup », « cake ») ; vide quand quelqu'un y est",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, ou le cadre horizontal 16:9 de l'original au milieu sur des bandes bleu nuit",
      choices: [
        { value: "auto", says: "vertical plein écran (tout est dessiné sur deux aplats, sa vidéo recadrée autour de sa tête)" },
        { value: "horizontal", says: "le cadre 16:9 de l'original au milieu, sur des bandes bleu nuit" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
  ],
  // Her head lowered and raised, measured on her video before it is cast (her passage starts just before she lowers it).
  reads: ["gestures"],
  // Its original has no grade, no grain, no corners: its flat colours stay exact.
  finish: { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 },
  timeline(_n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const f = (b: number) => toFrame(b * beat);
    // With an ending card: after her logo, the card's 1,6 s at least, on whole quarters of a beat.
    const card = end ? Math.ceil((CARD_SECONDS / beat) * 4) / 4 : 0;
    const total = end ? LOGO + LOGO_HOLD + card : END;
    const spans = beatSpans(bpm, [EYE, total - EYE]);
    const duration = spans.at(-1)!.end;
    // A key click on each letter of her first word as its code types it; a click as the letters of « Votre » pop; a
    // breath rising into the drop.
    const units = typedLetters(options.words?.bonjour);
    const sounds: SkillSound[] = [
      ...letterFrames(units.length, f(FIRST_LETTER), f(BURST_FROM), f(BURST_TO)).map((fr) => ({ at: round3(fr / 30), ...KEY })),
      { at: round3(f(CUT + POP) / 30), ...KEY, gain: -2 },
      { at: round3(f(EYE) / 30), ...RISER },
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({
        ...s,
        want:
          i === 0
            ? "elle (ou quelqu'un de son équipe) de profil, tête et épaules, devant un fond clair, le téléphone posé, à vitesse réelle : une vidéo de 5 s où elle regarde droit devant puis baisse vite la tête (penchée sur son travail), la garde baissée et la relève ; son passage commence quand elle regarde encore droit devant, 0,5 s avant qu'elle baisse la tête ; sa silhouette devient d'un seul bleu nuit sur un fond pâle (une photo de profil va aussi, figée). Personne de profil dans ses fichiers : celui où une seule chose de son métier se détache entière sur un fond clair (un bouquet, un vase, sa devanture), sa forme devient la silhouette"
            : "jamais vue (l'œil, son métier, son nom et son logo sont dessinés sur deux aplats par-dessus) : une autre de ses vidéos ou photos, ou la même vidéo à un autre moment",
      })),
      // Her first word in the opening; « Je suis » in her head; her name from its typing to her logo; « Votre » as its
      // letters pop; her trade from the iris to her name; what she does on the hits.
      texts: {
        bonjour: { from: round(f(FIRST_LETTER) / 30), to: round(f(CUT) / 30) },
        je: { from: round(f(CUT) / 30), to: round(f(CUT + 0.85) / 30) },
        nom: { from: round(f(CUT + NAME_TYPE) / 30), to: round(f(LOGO) / 30) },
        ton: { from: round(f(CUT + POP) / 30), to: round(f(EYE) / 30) },
        metier: { from: round(f(EYE + WORD_IN) / 30), to: round(f(NAME) / 30) },
        choses: { from: round(f(FIRST_JOB / 4) / 30), to: round(f(NAME) / 30) },
      },
      marks: {
        beat: Math.round(beat * 30 * 1000) / 1000,
        h: f(FIRST_LETTER),
        negative: f(NEGATIVE),
        burst_from: f(BURST_FROM),
        burst_to: f(BURST_TO),
        grow_from: f(GROW_FROM),
        grow_to: f(GROW_TO),
        hand: f(HAND),
        cut: f(CUT),
        head_down: f(CUT + HEAD_DOWN),
        name_type: f(CUT + NAME_TYPE),
        last_out: f(CUT + LAST_OUT),
        reduce: f(CUT + REDUCE),
        become: f(CUT + BECOME),
        pop: f(CUT + POP),
        fill: f(CUT + FILL),
        pupil: f(CUT + PUPIL),
        last_letter: f(CUT + LAST_LETTER),
        rise: f(CUT + RISE),
        eye: f(EYE),
        slit: f(EYE + SLIT),
        wide: f(EYE + WIDE),
        slide: f(EYE + SLIDE),
        word_in: f(EYE + WORD_IN),
        widen: f(EYE + WIDEN),
        open: f(OPEN),
        job: f(FIRST_JOB / 4),
        under_from: f(UNDER_FROM),
        under_to: f(UNDER_TO),
        dot: f(DOT),
        picto: f(FIRST_JOB / 4 + 0.75) + 1,
        shrink: f(SHRINK),
        name: f(NAME),
        logo: f(LOGO),
        logo_out: f(LOGO + LOGO_HOLD),
      },
      sounds,
      // Her music's first strong beat on its first bar (the cut on her); on beat 3 of that bar it breaks, its last hit
      // ringing, until the drop on the eye, a little louder after it than before; it ends on its last hit (her logo's
      // cut) with its tail (the original's 1,4 s), or under her ending card, faded.
      music: {
        downbeat: round3(f(CUT) / 30),
        pauses: [{ from: round3(f(CUT + FILL) / 30), to: round3(f(EYE) / 30), tail: 0.6 }],
        filters: [{ kind: "soft", from: 0, to: round3(f(CUT + FILL) / 30), db: -2 }],
        end: end ? { at: duration, fade: 0.6 } : { at: round3(f(LOGO) / 30 + 0.1), tail: 1.4 },
      },
      // Her cut-out on her profile only (the shot never seen is never cut out).
      cutouts: [0],
    };
  },
  code: CODE,
};
