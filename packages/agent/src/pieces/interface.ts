import type { EffectPiece } from "../pieces.ts";

// « Interface minimaliste », the effect (docs/fiches/interface.md, effects 1 to 12; its whole Reel is skills/interface.ts):
// a cut from her shot to a pale blue-grey ground, one shot of motion design where each element becomes the next, all
// coming in and going out through the blur: her first words out of the blur letter by letter at the middle, the last in
// a serif italic, which rises, halves and greys into the small spaced label of her list; her list stepping through the
// middle line a beat at a time, the item there sharp and black, its neighbours pale and blurred, the last one
// underlined by a stroke that tapers, blue to indigo; her promise typed by a blue caret that never blinks; the app's
// icon lands on its last word, swallows it and opens into her profile card (her account, her round photo in black and
// white, her name, her trade, her list and her promise as its bio, « S'abonner » turning blue, « Message »); the card
// zooms onto « S'abonner », an arrow glides up in an arc and clicks (no ring): the blue fades, « Abonné(e) » rises; and
// when it has room, the button and her photo fold into a white pill with her account and a tick, her photo shrinks into
// the « @ » of her account in the blue gradient, « À SUIVRE » over it. It keeps its skill's code, sizes, colours and
// timings (its original's images at its 110,5 BPM, counted in the Reel's beats), a little faster or slower to fill its
// span (0,8 to 1,1 times); the shorter the span, the less it shows: her first words and her list only when they fit,
// the pill and her @ only when it is long, never less than her typed promise and her card's click. Its texts and its
// typed promise held long enough to be read on a phone. Its photo is her logo, else one of her shots under it, in the
// round in black and white (else her initial on her colour); its sounds the original's: a soft key click as the caret
// types, a double click on « S'abonner ». Its music as its skill's: 10 dB softer from the cut, opened at once on a whole
// beat of the Reel just before the icon lands (her promise held a little longer for it). It leaves the announcement on
// two lines and the ending card. « Abonné(e) » and « S'abonner » set 32 px (48 once zoomed: the scene check holds its
// small labels to a text that reads). Nothing of the original's own: its handle, its name and its words are hers.

/** Its original's images (30 a second) in a beat at its 110,5 BPM. */
const IMAGES = 1800 / 110.5;
/** Its card's act, its original's images from the icon landing: the click, the pill; ended on « Abonné(e) » held, or on her @ held. */
const CLICK_AT = 78;
const PILL_AT = 88;
const CARD_SHORT = 100;
const CARD_LONG = 164;
/** How much faster or slower than its original (at the Reel's tempo) it plays to fill its span. */
const FASTEST = 0.8;
const SLOWEST = 1.1;
/** Its typing (images a letter: its original's 38 letters a second) and its key clicks (one every other letter, a burst). */
const TYPING = 30 / 38;
/** Its music opens this many of its original's images before its icon lands (on a downbeat in the original), 10 dB softer until then. */
const OPENS = 4.3;
const SOFT_DB = -10;

/** Her words as its code reads them: the first letter of a sentence in capital, its words, its letters. */
const cap = (s: string) => {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};
const wordsOf = (s: string) => s.split(/[ \t\n]+/).filter(Boolean);
const lettersOf = (s: string) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s)).length : Array.from(s).length);
/** Its list's items, as its code splits them. */
export const listItems = (s: string) => s.split(/\s*[,;·/\n]\s*/).filter((p) => p.trim()).length;
/** The seconds a sentence needs on a phone (the scene check's: 0,8 s and 0,3 s a word). */
const reading = (words: number) => Math.min(4.5, Math.max(1.2, 0.8 + 0.3 * words));

type Variant = { hook: boolean; list: boolean; long: boolean };
type Words = { hookWords: number; items: number; letters: number; promiseWords: number };

/**
 * Its acts at a pace (frames an image of its original), for what it shows: their marks, the frame it ends, its typing,
 * and the whole beat of the Reel (`beat`, frames) its music opens on, its icon landing just after it.
 */
function layout(k: number, v: Variant, w: Words, beat: number) {
  const o = (x: number) => Math.round(x * k);
  const marks: Record<string, number> = { k, hook: -1, out: -1, list: -1, gone: -1, pill: -1 };
  let at = 0;
  if (v.hook) {
    marks.hook = o(4);
    // Her first words held long enough to be read before they go.
    marks.out = marks.hook! + Math.max(o(40), Math.round(0.85 * reading(w.hookWords) * 30) - o(8));
    at = marks.out! + o(12);
  }
  if (v.list) {
    marks.list = v.hook ? marks.out! + o(7) : o(4);
    const gap = Math.min(o(17), Math.floor(o(44) / Math.max(1, w.items - 1)));
    const lineAt = Math.max(marks.list! + o(44), marks.list! + (w.items - 1) * gap + o(10));
    marks.gone = lineAt + o(20);
    at = marks.gone + o(6);
  }
  marks.typed = at;
  const type = at + o(7);
  const per = k * TYPING;
  const typing = Math.round(w.letters * per);
  // Her promise held whole long enough to be read before the icon swallows it; then her music opens on the next whole
  // beat it can (her promise held a little longer), and the icon lands just after it, as in the original.
  const hold = Math.max(o(16), Math.round(0.85 * reading(w.promiseWords) * 30) - typing - o(10));
  const opens = Math.max(1, Math.ceil((type + typing + hold - OPENS * k) / beat - 0.02)) * beat;
  marks.card = Math.round(opens + OPENS * k);
  if (v.long) marks.pill = marks.card + o(PILL_AT);
  return { marks, end: marks.card + o(v.long ? CARD_LONG : CARD_SHORT), type, per, opens };
}

/**
 * A beat of the Reel, or half of it on a slow one, the nearest to a beat of its original (`images` frames): its moments
 * keep about their own pace and still fall on her beat grid (at 60 BPM its original's images would have doubled).
 */
export function paceBeat(bpm: number, images: number): number {
  let beat = 1800 / Math.min(140, Math.max(60, bpm));
  while (beat / images > 1.42) beat /= 2;
  while (beat / images < 0.71) beat *= 2;
  return beat;
}

/**
 * Its acts for a span: the most it can show that fits it, 0,8 to 1,1 times its original's pace (faster still when
 * nothing else fits). Her list first, then her first words, then the pill and her @ (most when her @ is known); the
 * shortest of a kind, the least hurried.
 */
export function interfaceActs(input: { frames: number; bpm: number; words: Record<string, string> }) {
  const said = (k: string) => (input.words[k] ?? "").trim();
  const items = said("liste") ? listItems(said("liste")) : 0;
  const hookWords = wordsOf(cap(said("accroche"))).length;
  const promise = wordsOf(cap(said("promesse")));
  const w: Words = { hookWords, items, letters: promise.reduce((s, x) => s + lettersOf(x), 0), promiseWords: promise.length };
  const handle = /^@?[A-Za-z0-9._]{2,30}$/.test(said("compte"));
  const beat = 1800 / Math.min(140, Math.max(60, input.bpm));
  const K = paceBeat(input.bpm, IMAGES) / IMAGES;
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const worth = (v: Variant) => (v.list ? 3 : 0) + (v.hook ? 2 : 0) + (v.long ? (handle ? 2 : 1) : 0);
  const variants: Variant[] = [true, false]
    .flatMap((hook) => [true, false].flatMap((list) => [true, false].map((long) => ({ hook, list, long }))))
    .filter((v) => (!v.hook || hookWords > 0) && (!v.list || items > 0))
    .sort((a, b) => worth(b) - worth(a) || layout(K, a, w, beat).end - layout(K, b, w, beat).end);
  // The largest pace (within its bounds) at which a set of acts still ends within the span.
  const fit = (v: Variant, lowest: number) => {
    let lo = lowest;
    let hi = SLOWEST;
    if (layout(round3(K * lo), v, w, beat).end > input.frames) return null;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (layout(round3(K * mid), v, w, beat).end <= input.frames) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  for (const v of variants) {
    const f = fit(v, FASTEST);
    if (f !== null) return { variant: v, ...layout(round3(K * f), v, w, beat), letters: w.letters };
  }
  const last = variants.at(-1)!;
  const f = fit(last, 0.3) ?? 0.3;
  return { variant: last, ...layout(round3(K * f), last, w, beat), letters: w.letters };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement, frame = useCurrentFrame(), R = Math.round, mn = Math.min, mx = Math.max;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its pace (frames an image of its original) and its acts (its timeline's marks): her first words and her list when
  // they fit, her typed promise, her card and its click, then its pill and her @ when it is long (-1: not shown).
  const K = mx(0.3, mark("k", 1)), o = (x) => R(x * K);
  const IN = mark("hook", -1), OUT = mark("out", -1), LIST = mark("list", -1), GONE = mark("gone", -1);
  const TA = mark("typed", 0), ICON = mark("card", o(57)), PILL0 = mark("pill", -1), LONG = PILL0 >= 0;
  const NEVER = 1e6, PILL = LONG ? PILL0 : NEVER, AT = LONG ? PILL0 + o(27) : NEVER;
  const CARD = ICON + o(17), ZOOM = ICON + o(53), CLICK = ICON + o(78), LEAVE = CLICK + o(17);
  const counted = String((texts && texts.mine) || "").split(",").filter((x) => x !== "").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < shots.length);
  const mine = counted.length ? counted : shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" }, ease = Easing.bezier(0.22, 1, 0.36, 1), both = Easing.bezier(0.65, 0, 0.35, 1);
  const at01 = (f, a, b) => (b > a ? interpolate(f, [a, b], [0, 1], cl) : f >= a ? 1 : 0), k01 = (a, b) => at01(frame, a, b), ek = (a, b) => ease(k01(a, b));
  const mix = (a, b, t) => a + (b - a) * t, px = (v) => R(v * 10) / 10, blur = (b) => (b > 0.05 ? "blur(" + px(b) + "px)" : "none");
  const abs = (l, t, w, hh, x) => ({ position: "absolute", left: l, top: t, width: w, height: hh, ...x });
  const acc = (x) => h("span", { "data-fauve-accent": "" }, x);
  const sans = "'" + brand.displayFont + "', 'Inter Tight', 'Inter', sans-serif", serif = "'Instrument Serif', '" + brand.displayFont + "', Georgia, serif";
  // One accent: the original's royal blue to indigo, or hers on her word (unless too pale).
  const GROUND = "#f4f5fa", INK = "#121317", GREY = "#87888e";
  const hx = /^#?([0-9a-f]{6})$/i.exec(String(brand.accent || "")), rgb = hx ? [0, 2, 4].map((i) => parseInt(hx[1].slice(i, i + 2), 16)) : null;
  const deep = (t) => "rgb(" + rgb.map((v) => R(v * t)).join(",") + ")";
  const hers = setting("couleur", "bleu") === "sienne" && rgb && (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.6;
  const LINEC = hers ? [deep(1), deep(0.55)] : ["#1051c4", "#222853"], BTN = hers ? [deep(1), deep(0.6)] : ["#0450d1", "#332b7f"], ACC = hers ? [deep(0.85), deep(0.45)] : ["#0c3a83", "#181744"];
  const grad = (c) => "linear-gradient(100deg, " + c[0] + ", " + c[1] + ")";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const wordsOf = (s) => String(s || "").split(/[ \t\n]+/).filter(Boolean), letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(String(s)), (x) => x.segment) : Array.from(String(s)));
  const cap = (s) => { const t = String(s || "").trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
  // A text's width (px), told from its letters.
  const est = (s, size, it) => letters(s).reduce((w, c) => w + (/[ il.,;:'’!|fjtrI1]/.test(c) ? 0.3 : /[mwMW@]/.test(c) ? 0.84 : /[A-Z]/.test(c) ? 0.66 : 0.55), 0) * size * (it ? 0.97 : 1);
  // Out of the blur (p 0 to 1), rising a little.
  const fx = (p, rise) => ({ opacity: mn(1, mx(0, p * 1.25)), filter: blur((1 - p) * 9), transform: rise && p < 0.995 ? "translateY(" + px((1 - p) * rise) + "px)" : undefined });
  const S = 50;
  const IT = (size) => ({ fontFamily: serif, fontStyle: "italic", fontWeight: 400, fontSize: R(size * 1.16), letterSpacing: "-0.01em" });
  const line = (size, x) => ({ fontFamily: sans, fontWeight: 600, fontSize: size, lineHeight: 1.2, letterSpacing: "-0.03em", color: INK, whiteSpace: "nowrap", ...x });
  const full = abs(0, 0, width, height), all = abs(0, 0, "100%", "100%"), F = React.Fragment;
  const hookText = IN >= 0 ? word("accroche") : "", band = LIST >= 0 ? word("liste") : "", label = word("etiquette");
  const promise = word("promesse"), metier = word("metier"), account = word("compte");
  const lit = (c, j, style) => h("span", { key: j, style: { display: "inline-block", whiteSpace: "pre", ...style } }, c);
  const flex = { display: "flex", alignItems: "center", justifyContent: "center" };
  // A small label in spaced capitals (an accent), each letter out of the blur at p(its share of the word).
  const tag = (top, text, p, x) => h("div", { style: { ...abs(140, top, 800, 32), ...flex, fontFamily: sans, fontWeight: 600, fontSize: 21, letterSpacing: "0.4em", textTransform: "uppercase", color: GREY, whiteSpace: "nowrap", ...x } },
    h("span", { "data-fauve-accent": "", style: { marginRight: "-0.4em" } }, letters(text).map((c, j, a) => lit(c, j, fx(p(j / a.length))))));

  // 1. Her first words out of the blur; the last (italic) rises, halves and greys into the label of her list it becomes.
  const hw = wordsOf(cap(hookText));
  const lastW = hw.length > 1 ? hw[hw.length - 1] : "", firstW = hw.length > 1 ? hw.slice(0, -1).join(" ") + " " : hw.join(" ");
  const wide = est(firstW, S) + est(lastW, S, true) * 1.16;
  const HS = R(S * mn(1, 760 / mx(1, wide)));
  const LY = 822, labelOn = Boolean(band && label), morphs = labelOn && Boolean(lastW), morph = OUT + o(13);
  const moveT = both(k01(OUT + o(4), OUT + o(12))), lastX = 540 + (wide * HS) / S / 2 - (est(lastW, HS, true) * 1.16) / 2;
  let li = 0;
  const hookLetter = (c, j, it, total) => {
    const a = IN + R(li++ * 0.87 * K), go = (j / mx(1, total)) * (it && morphs ? o(12) : o(6)), from = it && morphs ? morph : OUT;
    return lit(c, j, fx(mn(ek(a, a + o(5)), 1 - ek(from + go, from + go + (it && morphs ? o(3) : o(4)))), 14));
  };
  const lastStyle = morphs && frame >= OUT + o(4) ? { transform: "translate(" + px((540 - lastX) * moveT) + "px," + px((LY + 14 - 960) * moveT) + "px) scale(" + (1 - 0.5 * moveT).toFixed(3) + ")", color: frame >= OUT + o(8) ? GREY : INK } : {};
  const hookLine = hookText && frame < (morphs ? morph + o(16) : OUT + o(12))
    ? h("div", { key: "hook", style: { ...abs(0, R(960 - HS * 0.62 - 10 * (1 - ek(IN, OUT))), width), textAlign: "center", ...line(HS) } },
        h("span", null, letters(firstW).map((c, j, a) => hookLetter(c, j, false, a.length))),
        lastW ? h("span", { style: { display: "inline-block", transformOrigin: "50% 60%", ...IT(HS), ...lastStyle } }, letters(lastW).map((c, j, a) => hookLetter(c, j, true, a.length))) : null)
    : null;

  // 2. Her list through the middle line, a step a beat, the last underlined by a tapering stroke (her separators unseen).
  const parts = band ? String(band).split(/(\s*[,;·\/\n]\s*)/) : [], items = [];
  parts.forEach((p, i) => { if (i % 2 === 0 && p.trim()) items.push(i); });
  const m = mx(1, items.length), gap = mn(o(17), Math.floor(o(44) / mx(1, m - 1)));
  let pos = 0;
  for (let j = 1; j < m; j++) pos += both(k01(LIST + j * gap, LIST + j * gap + o(8)));
  const lineAt = mx(LIST + o(44), LIST + (m - 1) * gap + o(10)), gone = ek(GONE, GONE + o(13));
  const drawn = k01(lineAt, lineAt + o(5)) * 0.6 + k01(lineAt + o(5), lineAt + o(11)) * 0.4;
  const stroke = (w) => h("span", { style: { position: "relative", display: "inline-block" } }, w,
    drawn > 0 ? h("span", { style: { position: "absolute", left: -12, right: -24, top: "92%", height: 15, clipPath: "inset(0 " + px((1 - drawn) * 100) + "% 0 0)" } },
      h("span", { style: { position: "absolute", inset: 0, background: "linear-gradient(90deg, " + LINEC[0] + ", " + LINEC[1] + ")", clipPath: "polygon(0% 8%, 100% 50%, 100% 56%, 0% 92%)" } })) : null);
  const labelAt = morphs ? morph : LIST + o(6);
  const listLayer = band && frame >= LIST - 2 && frame < GONE + o(14)
    ? h("div", { key: "list", style: { ...full, transform: gone > 0 ? "translateY(" + px(-150 * gone) + "px)" : undefined } },
        parts.map((p, i) => {
          const j = items.indexOf(i), d = j - pos;
          if (j < 0 || Math.abs(d) > 1.4) return h("span", { key: i, style: { ...abs(0, 0), opacity: 0, fontSize: 1 } }, p);
          const come = j === 0 ? ek(LIST, LIST + o(9)) : 1, near = mn(1, Math.abs(d));
          return h(FitText, { key: i, style: abs(140, R(922 + d * 75 + (1 - come) * 102), 800, 75), innerStyle: line(S, { opacity: px(come * (1 - gone) * (1 - 0.88 * near) * 100) / 100, filter: blur(7 * near + 9 * (1 - come) + 9 * gone) }) },
            j === m - 1 ? stroke(cap(p)) : cap(p));
        }),
        labelOn ? tag(LY - 16, label, (r) => ek(labelAt + r * o(12), labelAt + r * o(12) + o(4)), { filter: blur(9 * gone), opacity: 1 - gone }) : null)
    : null;

  // 3. Her promise typed from the line's left edge, its caret never blinking; the icon lands on it and swallows it.
  const pw = wordsOf(cap(promise)), lastN = pw.length >= 4 ? 2 : 1;
  const total = pw.reduce((s, w) => s + letters(w).length, 0), TYPE = TA + o(7);
  const per = mn((K * 30) / 38, mx(0.3, (ICON - o(16) - TYPE) / mx(1, total))), typedEnd = TYPE + R(total * per);
  const shown = mx(0, mn(total, Math.floor((frame - TYPE) / per) + 1));
  const caretOn = frame >= TA ? 1 - k01(typedEnd + o(7), typedEnd + o(11)) : 0;
  const ww = pw.map((w, i) => (i >= pw.length - lastN ? est(w, S, true) * 1.16 : est(w, S)));
  const PW = ww.reduce((s, w) => s + w, 0) + est(" ", S) * mx(0, pw.length - 1), PS = mn(1, 780 / mx(1, PW));
  const wordX = [];
  ww.reduce((x, w) => { wordX.push(x + (w * PS) / 2); return x + (w + est(" ", S)) * PS; }, 540 - (PW * PS) / 2);
  const iconX = mix(wordX.length ? mn(900, wordX[wordX.length - 1]) : 540, 540, ek(ICON + o(3), ICON + o(14)));
  const caret = h("span", { key: "c", style: { display: "inline-block", width: 0, position: "relative" } }, h("span", { style: { position: "absolute", left: "0.04em", bottom: "-0.24em", width: 3, height: "1.15em", background: LINEC[0], opacity: caretOn } }));
  let ti = 0;
  const typed = pw.map((w, i) => {
    const q = frame >= ICON + o(3) ? ek(ICON + o(3) + i * o(2), ICON + o(10) + i * o(2)) : 0;
    return h(F, { key: i }, i ? " " : null, h("span", { style: { display: "inline-block", whiteSpace: "nowrap", ...(i >= pw.length - lastN ? IT(S) : {}), ...(q > 0 ? { transform: "translateX(" + px((iconX - wordX[i]) * 0.75 * q) + "px)", opacity: 1 - q, filter: blur(9 * q) } : {}) } },
      i === 0 && shown === 0 ? caret : null,
      letters(w).map((c, j) => { const t = ti++, age = frame - (TYPE + t * per); return h(F, { key: j }, h("span", { style: { opacity: t < shown ? 1 : 0, filter: t < shown && age < 2 ? blur(age < 1 ? 3 : 1.5) : undefined } }, c), t === shown - 1 ? caret : null); })));
  });
  const typedLayer = pw.length && frame >= TA - 2 && frame < ICON + o(18) ? h(FitText, { key: "typed", style: abs(140, 960 - S, 800, S * 2), innerStyle: line(S) }, h("span", null, typed)) : null;

  // 4. The icon opens into her card (its bio decor: read before); a zoom as a camera onto « S'abonner », the rest gone.
  const CW = 768, CH = 485, CX = 156, CY = 718, B0 = { x: CX + 41, y: CY + 380, w: 337, h: 62 }, bx = B0.x + B0.w / 2, by = B0.y + B0.h / 2;
  const grow = Easing.bezier(0.5, 0, 0.12, 1)(k01(CARD, CARD + o(14))), landed = ek(ICON, ICON + o(3)), zoom = both(k01(ZOOM, ZOOM + o(24))), s = 1 + 0.5 * zoom;
  const cam = (x, y) => ({ x: mix(bx, 540, zoom) + s * (x - bx), y: mix(by, 960, zoom) + s * (y - by) });
  const box = (x, y) => { const c = cam(CX + x, CY + y); return { position: "absolute", left: px(c.x), top: px(c.y), transform: "scale(" + s + ")", transformOrigin: "0 0" }; };
  const restGone = k01(ZOOM + o(5), ZOOM + o(10)), row = (k) => ek(CARD + o(8) + k * o(2), CARD + o(14) + k * o(2)) * (1 - restGone);
  const handleOf = (t) => { const v = String(t || "").trim(); return /^@?[A-Za-z0-9._]{2,30}$/.test(v) ? v.replace(/^@/, "") : ""; };
  const handle = handleOf(account);
  const NAME = brand.name || (account && !handle ? account : "") || cap(hookText) || cap(promise), who = handle || account || NAME;
  const small = (size, x) => ({ fontFamily: sans, fontWeight: 600, fontSize: size, lineHeight: 1.15, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", ...x });
  const glyph = h("svg", { width: 56, height: 56, viewBox: "0 0 24 24" }, h("g", { fill: "none", stroke: "#1e1e21", strokeWidth: 1.7 }, h("rect", { x: 3, y: 3, width: 18, height: 18, rx: 5.2 }), h("circle", { cx: 12, cy: 12, r: 4.1 })), h("circle", { cx: 17.1, cy: 6.9, r: 1.05, fill: "#1e1e21" }));
  const shape = frame >= ICON && frame < ZOOM + o(9)
    ? (() => {
        const w = frame < CARD ? 119 : mix(119, CW, grow), hh = frame < CARD ? 114 : mix(114, CH, grow), c = cam(frame < CARD ? iconX : 540, 960);
        return h("div", { key: "shape", style: { ...abs(px(c.x - (w * s) / 2), px(c.y - (hh * s) / 2), px(w * s), px(hh * s)), borderRadius: 30 * s, background: "#ffffff", boxShadow: "0 40px 60px rgba(20,24,60,0.05), 0 2px 6px rgba(20,24,60,0.05)", opacity: mn(landed, 1 - k01(ZOOM + o(6), ZOOM + o(8))), transform: frame < ICON + o(3) ? "scale(" + px(0.6 + 0.4 * landed) + ")" : undefined, ...flex } },
          grow < 0.5 ? h("div", { style: { opacity: 1 - grow * 2 } }, glyph) : null);
      })()
    : null;
  const listLine = items.map((i) => cap(parts[i]).replace(/[.!?…]+$/, "")).join(". ") + (items.length ? "." : "");
  const cardText = frame >= CARD && frame < ZOOM + o(11)
    ? h("div", { key: "card", style: full },
        h("div", { style: { ...box(42, 48), display: "flex", alignItems: "center", gap: 10, ...small(27), ...fx(row(0)) } }, acc(keep(who)),
          h("svg", { width: 20, height: 20, viewBox: "0 0 24 24" }, h("path", { d: "M6 9 L12 15 L18 9", fill: "none", stroke: INK, strokeWidth: 2.2, strokeLinecap: "round" }))),
        h("svg", { width: 98, height: 32, viewBox: "0 0 98 32", style: { ...box(636, 47), ...fx(row(0)) } },
          h("g", { fill: "none", stroke: INK, strokeWidth: 2.2, strokeLinecap: "round" }, h("rect", { x: 3, y: 3, width: 26, height: 26, rx: 8 }), h("path", { d: "M16 10 V22 M10 16 H22 M66 7 H94 M66 16 H94 M66 25 H94" }))),
        h("div", { style: { ...box(212, 146), ...fx(row(1)) } }, h("div", { style: small(30, { fontWeight: 700 }) }, acc(keep(NAME))),
          metier ? h("div", { style: { ...IT(26), color: "#939393", marginTop: 4, whiteSpace: "nowrap" } }, acc(keep(cap(metier)))) : null),
        h("div", { "data-fauve-decor": "", style: { ...box(42, 272), ...small(25, { fontWeight: 500, lineHeight: 1.45 }), ...fx(row(2)) } }, items.length ? h("div", null, keep(listLine)) : null, promise ? h("div", null, keep(cap(promise))) : null),
        h("div", { style: { ...box(392, 380), width: 333, height: 62, borderRadius: 14, background: "#ebecf1", ...flex, ...small(27, { fontWeight: 700 }), ...fx(row(3)) } }, acc("Message")))
    : null;

  // 5. The click (no ring), « Abonné(e) »; when it is long, photo and button fold into a pill, her photo into the « @ ».
  const fold = both(k01(PILL, PILL + o(13))), atGo = k01(AT, AT + o(15)), pdot = k01(AT + o(7), AT + o(10));
  const ES = 54, EW = mn(780, est((handle ? "@" : "") + who, ES)), atX = 540 - EW / 2 + est("@", ES) / 2;
  const PH = 96, PWD = mx(321, mn(700, est(who, 32) + 177)), pillX = 540 - PWD / 2;
  const pc = cam(CX + 109, CY + 178);
  const photoC = { x: mix(mix(pc.x, pillX + 46, fold), atX, pdot), y: mix(mix(pc.y, 960, fold), 958, pdot), d: mix(mix(134 * s, 57, fold), 16, pdot) };
  const rush = frame > PILL && frame < PILL + o(13) ? (fold - both(at01(frame - 1, PILL, PILL + o(13)))) * 260 : 0, appear = ek(CARD + o(10), CARD + o(16));
  // Her photo in the round: her logo, else one of her shots under it in black and white (on her face when it is
  // tracked, else the upper middle of an upright one, playing from when her card opens), else her initial.
  const sh = mine.length ? shots[mine[0]] : {}, asp = Number(sh.aspect) || 1, fz = sh.face, Z = asp < 0.9 ? 1.5 : 1, Wd = photoC.d * Z * mx(1, asp), Hd = Wd / asp;
  const fl = mn(0, mx(photoC.d - Wd, photoC.d / 2 - Wd * (fz ? fz.x + fz.w / 2 : 0.5))), ft = mn(0, mx(photoC.d - Hd, photoC.d / 2 - Hd * (fz ? fz.y + fz.h / 2 : asp < 0.9 ? 0.36 : 0.5)));
  const face = brand.logoUrl
    ? h(Img, { src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { ...abs("14%", "14%", "72%", "72%"), objectFit: "contain" } })
    : mine.length
      ? h(Footage, { shot: mine[0], at: CARD - o(6), style: { left: px(fl), top: px(ft), width: px(Wd), height: px(Hd), filter: "grayscale(1) contrast(1.08)" } })
      : h("div", { style: { ...all, background: rgb ? "rgb(" + rgb.join(",") + ")" : INK, color: "#ffffff", ...flex, fontFamily: sans, fontWeight: 700, fontSize: R(photoC.d * 0.45) } }, (NAME || "·").charAt(0).toUpperCase());
  const photo = frame >= CARD && frame < AT + o(15)
    ? h("div", { key: "photo", style: { ...abs(px(photoC.x - photoC.d / 2), px(photoC.y - photoC.d / 2), px(photoC.d), px(photoC.d)), borderRadius: "50%", overflow: "hidden", background: brand.logoUrl || !mine.length ? "#ffffff" : "#d9dbe3", opacity: mn(1, appear * 1.25) * (1 - k01(AT + o(10), AT + o(14))), filter: blur((1 - appear) * 9 + mn(3, rush)) } },
        face, pdot > 0 ? h("div", { style: { ...all, background: "#a9bce6", opacity: pdot } }) : null)
    : null;
  const bc = cam(bx, by), white = k01(CLICK + o(1), CLICK + o(3)), bs = mix(32, 48, zoom);
  const btn = { x: mix(bc.x - (B0.w * s) / 2, pillX, fold), y: mix(bc.y - (B0.h * s) / 2, 960 - PH / 2, fold), w: mix(B0.w * s, PWD, fold), h: mix(B0.h * s, PH, fold), r: mix(14 * s, PH / 2, fold) };
  const centred = (x) => ({ ...all, ...flex, ...x });
  const button = frame >= CARD && frame < AT + o(15)
    ? h("div", { key: "btn", style: { ...abs(px(btn.x), px(btn.y), px(btn.w), px(btn.h)), borderRadius: px(btn.r), background: grad(BTN), boxShadow: white > 0 ? "0 14px 34px rgba(20,24,60," + px(10 * white) / 100 + ")" : "none", opacity: frame < ZOOM ? ek(CARD + o(14), CARD + o(20)) : 1 - atGo, overflow: "hidden" } },
        h("div", { style: { ...all, background: "#ffffff", opacity: frame < CLICK ? 0.65 - 0.65 * ek(CARD + o(16), CARD + o(23)) : white } }),
        frame < PILL + o(11) ? h("div", { style: centred({ ...small(R(bs), { fontWeight: 700, color: "#ffffff" }), opacity: 1 - white }) }, "S'abonner") : null,
        frame >= CLICK + o(6) && frame < PILL + o(11) ? h("div", { style: centred({ ...small(R(bs), { fontWeight: 700 }), ...fx(ek(CLICK + o(6), CLICK + o(10)) * (1 - k01(PILL + o(7), PILL + o(10))), 24) }) }, "Abonné(e)") : null,
        frame >= PILL + o(7) ? h(FitText, { style: abs(99, 0, mx(80, PWD - 169), PH), innerStyle: { alignItems: "flex-start", ...small(32, { fontWeight: 700 }), ...fx(ek(PILL + o(8), PILL + o(11))) } }, acc(keep(who))) : null,
        frame >= PILL + o(11) ? h("svg", { width: 34, height: 34, viewBox: "0 0 24 24", style: { position: "absolute", right: 24, top: (PH - 34) / 2, opacity: ek(PILL + o(11), PILL + o(13)) } }, h("path", { d: "M5 12.5 L10 17 L19 7.5", fill: "none", stroke: "#69768b", strokeWidth: 2, strokeLinecap: "round" })) : null)
    : null;
  // The arrow, up from the bottom right in an arc, blurred while it rushes; it leaves after its click.
  const q = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const tip = (f) => { const t = both(at01(f, ZOOM + o(1), ZOOM + o(23))), l = ease(at01(f, LEAVE, LEAVE + o(8))); return { x: q(702, 930, 648, t) + 140 * l, y: q(1651, 1180, 979, t) + 260 * l, l }; };
  const now = tip(frame), was = tip(frame - 1), fast = Math.hypot(now.x - was.x, now.y - was.y);
  const arrow = frame > ZOOM && frame < LEAVE + o(9)
    ? h("svg", { key: "arrow", width: 40, height: 56, viewBox: "0 0 20 28", style: { ...abs(px(now.x - 3), px(now.y - 3)), opacity: 1 - now.l, filter: blur(fast > 12 ? mn(2.5, fast / 25) : 0) } },
        h("path", { d: "M1.5 1.5 L1.5 22 L6.6 17.4 L10.2 25.8 L13.6 24.3 L10.1 16.2 L17.2 16.2 Z", fill: "#111111", stroke: "#ffffff", strokeWidth: 1.6, strokeLinejoin: "round" }))
    : null;

  // 6. Her account in the gradient (her name, without « @ », when it is not known), « À SUIVRE » over it, to its end.
  const inked = { backgroundImage: grad(ACC), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", paddingBottom: "0.08em" };
  const fin = frame >= AT + o(9)
    ? h("div", { key: "fin", style: full },
        tag(852, "À SUIVRE", (r) => ek(AT + o(15) + r * o(10), AT + o(18) + r * o(10)), { color: "#919297" }),
        h(FitText, { style: abs(140, 924, 800, 74), innerStyle: { fontFamily: sans, fontWeight: 700, fontSize: ES, lineHeight: 1.15, letterSpacing: "-0.035em", whiteSpace: "nowrap", ...fx(ek(AT + o(9), AT + o(15))) } },
          h("span", null, handle ? h("span", { style: { ...inked, opacity: k01(AT + o(10), AT + o(14)) } }, "@") : null, h("span", { style: inked }, keep(who)))))
    : null;

  // An opaque layer of its own: where the scene check stacks a copy of it for every frame it reads, only the copy on top is drawn.
  return h(AbsoluteFill, { style: { backgroundColor: GROUND, overflow: "hidden", willChange: "transform" } }, hookLine, listLayer, typedLayer, shape, cardText, button, photo, arrow, fin);
}`;

export const interfaceEffect: EffectPiece = {
  key: "interface",
  version: 1,
  name: "Interface minimaliste",
  how: "une coupe sur un fond clair, du motion design sans coupe comme une appli, tout entre et sort par le flou : ses premiers mots lettre à lettre, le dernier en italique qui devient l'étiquette de sa liste ; sa liste qui défile sur la ligne du milieu, la dernière chose soulignée d'un trait bleu ; sa promesse tapée par un curseur bleu, avalée par l'icône d'Instagram qui s'ouvre en carte de profil (sa photo ronde, son nom, son métier) ; zoom sur « S'abonner », une flèche clique, « Abonné(e) » ; long, tout se replie en pastille et sa photo devient le « @ » de son compte en bleu, sous « À SUIVRE ». Plus il est court, moins il en montre (jamais moins que sa promesse tapée et le clic). La musique plus douce sous la frappe, qui s'ouvre quand l'icône arrive.",
  needs: "sa promesse en une phrase, et si elle les a, trois choses qu'elle fait, ses premiers mots, son métier et son compte Instagram ; son logo pour sa photo de profil, sinon l'un de ses plans dessous ; rien à filmer : l'interface est dessinée et couvre ses plans.",
  lays: "le plus souvent à la fin du Reel (son appel à s'abonner), sur 1 à 3 de ses plans qu'il couvre (un fond clair dessiné) ; à 5 s sa promesse tapée et sa carte, vers 7 s sa liste avant, vers 8 s ses premiers mots aussi, à 10 s et plus son @ à la fin ; le plan d'après reprend en plein écran",
  shots: [1, 8],
  seconds: [5, 10],
  require: {},
  texts: [
    {
      slot: "promesse",
      want: "une phrase de 3 à 6 mots tapée lettre à lettre, comme sa bio : ce qu'elle apporte, ses derniers mots en italique (une forme comme « des coupes qui vous ressemblent »)",
      max: 34,
      required: true,
    },
    {
      slot: "accroche",
      want: "facultatif : 2 à 4 mots qui sortent du flou lettre à lettre au début, le dernier en italique, qui devient ensuite l'étiquette de sa liste : ce qui commence ou qui elle est (une forme comme « un nouveau départ », « bienvenue chez Lune »)",
      max: 24,
      required: false,
    },
    {
      slot: "liste",
      want: "facultatif : trois choses qu'elle fait ou propose, séparées par des virgules, 1 ou 2 mots chacune (une forme comme « coupe, couleur, soin ») : elles défilent sur la ligne du milieu, la dernière soulignée, puis forment la bio de son profil",
      max: 40,
      required: false,
    },
    {
      slot: "etiquette",
      want: "facultatif, avec une liste : 1 à 3 petits mots en capitales espacées au-dessus de sa liste, en lesquels le dernier mot de l'accroche se change (une forme comme « ce qu'on fait », « au menu »)",
      max: 18,
      required: false,
    },
    { slot: "metier", want: "facultatif : son métier en un ou deux mots, sous son nom dans sa carte de profil (une forme comme « céramiste », « salon de coiffure »)", max: 22, required: false },
    {
      slot: "compte",
      want: "facultatif : son compte Instagram avec @ quand on le sait (jamais inventé), sinon son nom : en haut de sa carte de profil, puis dans la pastille et en bleu sous « À SUIVRE » à la fin",
      max: 30,
      required: false,
    },
  ],
  settings: [
    {
      name: "couleur",
      want: "la couleur de son accent (le trait sous sa liste, le curseur, le bouton, son compte à la fin)",
      choices: [
        { value: "bleu", says: "le dégradé bleu roi vers indigo de l'original" },
        { value: "sienne", says: "sa couleur à elle (celle de sa charte ; le bleu si elle est trop pâle pour se lire sur le fond clair)" },
      ],
    },
  ],
  timeline({ frames, bpm, words }) {
    const acts = interfaceActs({ frames, bpm, words });
    const s = (f: number) => Math.round((f / 30) * 1000) / 1000;
    const clickAt = acts.marks.card! + Math.round(CLICK_AT * acts.marks.k!);
    // A soft key click on every other letter as the caret types them (one burst), its double click on « S'abonner ».
    const clicks = Math.ceil(acts.letters / 2);
    return {
      marks: acts.marks,
      sounds: [
        ...(clicks ? [{ at: s(acts.type), sound: "soft keyboard click", seconds: 0.5, gain: -8, ...(clicks > 1 ? { burst: { times: Array.from({ length: clicks }, (_, i) => s(2 * i * acts.per)) } } : {}) }] : []),
        { at: s(clickAt - 1.35), sound: "soft mouse click", seconds: 0.5, gain: -4 },
        { at: s(clickAt + 1.35), sound: "soft mouse click", seconds: 0.5, gain: -4 },
      ],
      // Her music 10 dB softer from the cut, opened at once on the beat before its icon lands, as its original's.
      music: { filters: [{ kind: "soft" as const, db: SOFT_DB, from: 0, to: s(acts.opens), open: 0.05 }] },
    };
  },
  code: CODE,
  fonts: ["Instrument Serif"],
};
