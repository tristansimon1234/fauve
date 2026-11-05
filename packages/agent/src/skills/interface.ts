import { toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Interface minimaliste », version 2, written on its original's fiche (docs/fiches/interface.md: 12,7 s of pure motion
// design on a pale blue-grey, measured image by image at 30 i/s, its sound read by bands; Tristan: « c'est un effet que
// l'on veut pouvoir faire, pas exactement reproduire l'image »). No cut: one shot of motion design where each element
// becomes the next, everything coming in and going out through the blur, on the beats of its music (110,5 BPM, its first
// beat at 0,04 s). Every moment below is its original's image (30 a second) counted in beats at that tempo, so a slower
// tempo stretches them all; two holds are a few beats longer for a phone (its announcement two beats, its typed promise
// one: the engine reads a sentence in 0,8 s plus 0,3 s a word, the original holds them 0,8 and 0,5 s):
//   4 – 44      her first words out of the blur letter by letter at the middle, small, the last one in a serif italic;
//   44 – 69     her first words go left into the blur; the last one rises, halves and greys, then turns into the small
//               spaced label of her list letter by letter; her list's first item rises out of the blur on beat 3;
//   69 – 121    her list steps through the middle line on beats 4 and 5, the item there sharp and black, its neighbours
//               pale and blurred; the last one underlined by a stroke that tapers, blue to indigo, drawn from the left;
//   121 – 172   her list goes up into the blur while her announcement rises on two lines, word by word, its two last
//               words in the italic; read whole, it is erased letter by letter from the left;
//   172 – 217   a blue caret types her promise from the left edge (38 letters a second, each one blurred an image or
//               two), its last words in the italic; the caret never blinks and fades out after it; the music opens;
//   217 – 270   the app's icon lands on her last word, glides to the middle and swallows her promise, then opens into her
//               profile card: her account, her round photo, her name, her trade, her list and her promise as its bio,
//               « S'abonner » turning blue, « Message »;
//   270 – 305   the whole card zooms 1,5 times onto « S'abonner »; the card goes but her photo and the button; an arrow
//               glides up in an arc and clicks on beat 18 (no ring): the blue fades, « Abonné(e) » rises;
//   305 – 381   the button and her photo fold into a white pill with her account and a tick; the pill fades, her photo
//               shrinks into a dot that becomes the « @ » of her account, in the blue gradient, « À SUIVRE » over it.
// Her texts are the original's sizes where they read (a little over the engine's 48 px), its small labels and its card
// as accents (20 px at least) or decor. Its photo is hers (her profile photo or her logo; a video of her plays in the
// round), in black and white as the original's; with none, her logo or her initial. Its blue is the original's royal blue
// to indigo, hers on her word. Its sounds are the original's: a soft typing as the caret types, a double click; its
// music soft until it opens, fading over its last second. Nothing of the original's own is copied: its handle, its name
// and its words are hers. Its ending card (an offer, an announcement), in option, comes out of the blur after it.

const BPM = 110.5;
/** Its original's images in a beat at its tempo (30 i/s). */
const IMAGES = (30 * 60) / BPM;
/** Its moments, its original's images (docs/fiches/interface.md), before its longer holds. */
const AT = { hook: 4, out: 44, list: 51, line: 95, ann: 121, erase: 165, type: 172, icon: 217, card: 234, zoom: 270, click: 295, pill: 305, at: 332, end: 381 };
/** Its music opens 4,3 images before the icon lands (7,09 s), on a downbeat; its first beat at 0,04 s. */
const OPENS = 4.3;
const FIRST_BEAT = 1.2;
/** Its holds lengthened for a phone (beats): its announcement read whole two beats more, its promise typed one more. */
const ANN_MORE = 2;
const TYPED_MORE = 1;
/** Its typing, letters a second (the original's 37 in 29 images), a soft key click every other letter. */
const TYPING = 38;
/** The engine's ending card: the Reel's last 1,6 s, on the half-beat grid. */
const CARD_SECONDS = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its moments in images of the original, its longer holds counted in (before the announcement's erase, and after its promise). */
export function interfaceImages(): Record<keyof typeof AT, number> {
  const more = (at: number) => at + (at >= AT.erase ? ANN_MORE * IMAGES : 0) + (at >= AT.icon ? TYPED_MORE * IMAGES : 0);
  return Object.fromEntries(Object.entries(AT).map(([k, v]) => [k, more(v)])) as Record<keyof typeof AT, number>;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement, frame = useCurrentFrame(), R = Math.round, mn = Math.min, mx = Math.max;
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its moments (frames); o: its original's images at its tempo.
  const K = mark("beat", 16.29) / 16.29, o = (x) => R(x * K);
  const [IN, OUT, LIST, LINE, ANN, ERASE, TYPE, ICON, CARD, ZOOM, CLICK, PILL, AT] = "hook out list line ann erase type icon card zoom click pill at".split(" ").map((k, i) => mark(k, [4, 44, 51, 95, 121, 198, 205, 266, 283, 319, 344, 354, 381][i]));
  const endAt = end ? end.from : durationInFrames + 1, n = shots.length;
  const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" }, ease = Easing.bezier(0.22, 1, 0.36, 1), both = Easing.bezier(0.65, 0, 0.35, 1);
  const at01 = (f, a, b) => interpolate(f, [a, b], [0, 1], cl), k01 = (a, b) => at01(frame, a, b), ek = (a, b) => ease(k01(a, b));
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
  const wordsOf = (s) => String(s || "").split(/[ \t\n]+/).filter(Boolean), letters = (s) => Array.from(String(s));
  const cap = (s) => { const t = String(s || "").trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
  // A text's width (px), told from its letters.
  const est = (s, size, it) => letters(s).reduce((w, c) => w + (/[ il.,;:'’!|fjtrI1]/.test(c) ? 0.3 : /[mwMW@]/.test(c) ? 0.84 : /[A-Z]/.test(c) ? 0.66 : 0.55), 0) * size * (it ? 0.97 : 1);
  // Out of the blur (p 0 to 1), rising a little.
  const fx = (p, rise) => ({ opacity: mn(1, mx(0, p * 1.25)), filter: blur((1 - p) * 9), transform: rise && p < 0.995 ? "translateY(" + px((1 - p) * rise) + "px)" : undefined });
  const S = 50;
  const IT = (size) => ({ fontFamily: serif, fontStyle: "italic", fontWeight: 400, fontSize: R(size * 1.16), letterSpacing: "-0.01em" });
  const line = (size, x) => ({ fontFamily: sans, fontWeight: 600, fontSize: size, lineHeight: 1.2, letterSpacing: "-0.03em", color: INK, whiteSpace: "nowrap", ...x });
  const full = abs(0, 0, width, height), all = abs(0, 0, "100%", "100%"), F = React.Fragment;
  const hook = reelTexts.find((t) => t.role === "hook"), band = reelTexts.find((t) => t.role === "band"), caps = reelTexts.filter((t) => t.role === "caption");
  const within = (a, b) => caps.find((t) => t.from >= a && t.from < b);
  const label = within(LIST - 2, ANN - 2), ann = within(ANN - 2, ERASE), promise = within(ERASE, ICON), metier = within(CARD - 2, CARD + 3), account = within(CARD + 3, durationInFrames + 1);
  const mine = [hook, band, label, ann, promise, metier, account], others = reelTexts.filter((t) => mine.indexOf(t) < 0);
  const lit = (c, j, style) => h("span", { key: j, style: { display: "inline-block", whiteSpace: "pre", ...style } }, c);
  const flex = { display: "flex", alignItems: "center", justifyContent: "center" };
  // A small label in spaced capitals (an accent), each letter out of the blur at p(its share of the word).
  const tag = (top, text, p, x) => h("div", { style: { ...abs(140, top, 800, 32), ...flex, fontFamily: sans, fontWeight: 600, fontSize: 21, letterSpacing: "0.4em", textTransform: "uppercase", color: GREY, whiteSpace: "nowrap", ...x } },
    h("span", { "data-fauve-accent": "", style: { marginRight: "-0.4em" } }, letters(text).map((c, j, a) => lit(c, j, fx(p(j / a.length))))));

  // 1. Her first words out of the blur; the last (italic) rises, halves and greys into the label it becomes.
  const hw = wordsOf(cap(hook ? hook.text : ""));
  const lastW = hw.length > 1 ? hw[hw.length - 1] : "", firstW = hw.length > 1 ? hw.slice(0, -1).join(" ") + " " : hw.join(" ");
  const wide = est(firstW, S) + est(lastW, S, true) * 1.16;
  const HS = R(S * mn(1, 760 / mx(1, wide)));
  const LY = 822, hasLabel = Boolean(label && label.text), morph = OUT + o(13);
  const moveT = both(k01(OUT + o(4), OUT + o(12))), lastX = 540 + (wide * HS) / S / 2 - (est(lastW, HS, true) * 1.16) / 2;
  let li = 0;
  const hookLetter = (c, j, it, total) => {
    const a = IN + R(li++ * 0.87 * K), go = (j / mx(1, total)) * (it && hasLabel ? o(12) : o(6)), from = it && hasLabel ? morph : OUT;
    return lit(c, j, fx(mn(ek(a, a + o(5)), 1 - ek(from + go, from + go + (it && hasLabel ? o(3) : o(4)))), 14));
  };
  const lastStyle = lastW && hasLabel && frame >= OUT + o(4) ? { transform: "translate(" + px((540 - lastX) * moveT) + "px," + px((LY + 14 - 960) * moveT) + "px) scale(" + (1 - 0.5 * moveT).toFixed(3) + ")", color: frame >= OUT + o(8) ? GREY : INK } : {};
  const hookLine = hook && frame < morph + o(16)
    ? h("div", { key: "hook", style: { ...abs(0, R(960 - HS * 0.62 - 10 * (1 - ek(IN, OUT))), width), textAlign: "center", ...line(HS) } },
        h("span", null, letters(firstW).map((c, j, a) => hookLetter(c, j, false, a.length))),
        lastW ? h("span", { style: { display: "inline-block", transformOrigin: "50% 60%", ...IT(HS), ...lastStyle } }, letters(lastW).map((c, j, a) => hookLetter(c, j, true, a.length))) : null)
    : null;

  // 2. Her list through the middle line, a step a beat, the last underlined by a tapering stroke (her separators unseen).
  const parts = band ? String(band.text).split(/(\s*[,;·\/\n]\s*)/) : [], items = [];
  parts.forEach((p, i) => { if (i % 2 === 0 && p.trim()) items.push(i); });
  const m = mx(1, items.length), gap = mn(o(17), Math.floor(o(44) / mx(1, m - 1)));
  let pos = 0;
  for (let j = 1; j < m; j++) pos += both(k01(LIST + j * gap, LIST + j * gap + o(8)));
  const lineAt = mx(LINE, LIST + (m - 1) * gap + o(10)), gone = ek(ANN, ANN + o(13));
  const drawn = k01(lineAt, lineAt + o(5)) * 0.6 + k01(lineAt + o(5), lineAt + o(11)) * 0.4;
  const stroke = (word) => h("span", { style: { position: "relative", display: "inline-block" } }, word,
    drawn > 0 ? h("span", { style: { position: "absolute", left: -12, right: -24, top: "92%", height: 15, clipPath: "inset(0 " + px((1 - drawn) * 100) + "% 0 0)" } },
      h("span", { style: { position: "absolute", inset: 0, background: "linear-gradient(90deg, " + LINEC[0] + ", " + LINEC[1] + ")", clipPath: "polygon(0% 8%, 100% 50%, 100% 56%, 0% 92%)" } })) : null);
  const listLayer = band && frame >= LIST - 2 && frame < ANN + o(14)
    ? h("div", { key: "list", style: { ...full, transform: gone > 0 ? "translateY(" + px(-150 * gone) + "px)" : undefined } },
        parts.map((p, i) => {
          const j = items.indexOf(i), d = j - pos;
          if (j < 0 || Math.abs(d) > 1.4) return h("span", { key: i, style: { ...abs(0, 0), opacity: 0, fontSize: 1 } }, p);
          const come = j === 0 ? ek(LIST, LIST + o(9)) : 1, near = mn(1, Math.abs(d));
          return h(FitText, { key: i, style: abs(140, R(922 + d * 75 + (1 - come) * 102), 800, 75), innerStyle: line(S, { opacity: px(come * (1 - gone) * (1 - 0.88 * near) * 100) / 100, filter: blur(7 * near + 9 * (1 - come) + 9 * gone) }) },
            j === m - 1 ? stroke(cap(p)) : cap(p));
        }),
        hasLabel ? tag(LY - 16, label.text, (r) => ek(morph + r * o(12), morph + r * o(12) + o(4)), { filter: blur(9 * gone), opacity: 1 - gone }) : null)
    : null;

  // 3. Her announcement rising on two lines word by word, its two last words italic; then erased from the left.
  const aw = wordsOf(ann ? ann.text : "");
  let cut = aw.length, best = 1e9;
  if (aw.length > 3) for (let k = 1; k < aw.length; k++) {
    const a = aw.slice(0, k).join(" ").length, b = aw.slice(k).join(" ").length, score = Math.abs(a - 1.2 * b) + (a < b ? 20 : 0);
    if (score < best) { best = score; cut = k; }
  }
  let wi = 0;
  const annLayer = ann && aw.length && frame >= ANN - 2 && frame < ERASE + o(9)
    ? h(FitText, { key: "ann", style: abs(140, R(888 + 150 * (1 - ek(ANN, ANN + o(20)))), 800, 145), innerStyle: line(S, { lineHeight: 1.42 }) },
        h("div", null, [aw.slice(0, cut), aw.slice(cut)].filter((l) => l.length).map((ws, l) => {
          const chars = ws.join(" ").length;
          let ci = 0;
          return h("div", { key: l }, ws.map((w, k) => {
            const a = ANN + R(wi * mn(o(2.3), o(20) / mx(1, aw.length))), italic = wi++ >= aw.length - 2 && aw.length > 2;
            return h(F, { key: k }, k ? " " : null, h("span", { style: { display: "inline-block", ...(italic ? IT(S) : {}), ...fx(ek(a, a + o(8))) } },
              letters(w).map((c, j) => h("span", { key: j, style: { opacity: frame >= ERASE + R((ci++ / mx(1, chars)) * o(8)) ? 0 : 1 } }, c))));
          }));
        })))
    : null;

  // 4. Her promise typed from the line's left edge, its caret never blinking; the icon lands on it and swallows it.
  const pw = wordsOf(cap(promise ? promise.text : "")), lastN = pw.length >= 4 ? 2 : 1;
  const total = pw.reduce((s, w) => s + letters(w).length, 0), per = (K * 30) / 38, typedEnd = TYPE + R(total * per);
  const shown = mx(0, mn(total, Math.floor((frame - TYPE) / per) + 1));
  const caretOn = frame >= ERASE + 1 ? 1 - k01(typedEnd + o(7), typedEnd + o(11)) : 0;
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
  const typedLayer = promise && pw.length && frame >= ERASE - 2 && frame < ICON + o(18) ? h(FitText, { key: "typed", style: abs(140, 960 - S, 800, S * 2), innerStyle: line(S) }, h("span", null, typed)) : null;

  // 5. The icon opens into her card (its bio decor: read before); a zoom as a camera onto « S'abonner », the rest gone.
  const CW = 768, CH = 485, CX = 156, CY = 718, B0 = { x: CX + 41, y: CY + 380, w: 337, h: 62 }, bx = B0.x + B0.w / 2, by = B0.y + B0.h / 2;
  const grow = Easing.bezier(0.5, 0, 0.12, 1)(k01(CARD, CARD + o(14))), landed = ek(ICON, ICON + o(3)), zoom = both(k01(ZOOM, ZOOM + o(24))), s = 1 + 0.5 * zoom;
  const cam = (x, y) => ({ x: mix(bx, 540, zoom) + s * (x - bx), y: mix(by, 960, zoom) + s * (y - by) });
  const box = (x, y) => { const c = cam(CX + x, CY + y); return { position: "absolute", left: px(c.x), top: px(c.y), transform: "scale(" + s + ")", transformOrigin: "0 0" }; };
  const restGone = k01(ZOOM + o(5), ZOOM + o(10)), row = (k) => ek(CARD + o(8) + k * o(2), CARD + o(14) + k * o(2)) * (1 - restGone);
  const handleOf = (t) => { const v = String(t || "").trim(); return /^@?[A-Za-z0-9._]{2,30}$/.test(v) ? v.replace(/^@/, "") : ""; };
  const handle = account ? handleOf(account.text) : "";
  const NAME = brand.name || (account && !handle ? account.text : "") || (hook ? hook.text : ""), who = handle || (account ? account.text : NAME);
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
          metier && metier.text ? h("div", { style: { ...IT(26), color: "#939393", marginTop: 4, whiteSpace: "nowrap" } }, acc(keep(cap(metier.text)))) : null),
        h("div", { "data-fauve-decor": "", style: { ...box(42, 272), ...small(25, { fontWeight: 500, lineHeight: 1.45 }), ...fx(row(2)) } }, h("div", null, keep(listLine)), promise ? h("div", null, keep(cap(promise.text))) : null),
        h("div", { style: { ...box(392, 380), width: 333, height: 62, borderRadius: 14, background: "#ebecf1", ...flex, ...small(27, { fontWeight: 700 }), ...fx(row(3)) } }, acc("Message")))
    : null;

  // 6. The click (no ring), « Abonné(e) »; photo and button fold into a pill; her photo shrinks into the « @ ».
  const fold = both(k01(PILL, PILL + o(13))), atGo = k01(AT, AT + o(15)), pdot = k01(AT + o(7), AT + o(10));
  const ES = 54, EW = mn(780, est((handle ? "@" : "") + who, ES)), atX = 540 - EW / 2 + est("@", ES) / 2;
  const PH = 96, PWD = mx(321, mn(700, est(who, 32) + 177)), pillX = 540 - PWD / 2;
  const pc = cam(CX + 109, CY + 178);
  const photoC = { x: mix(mix(pc.x, pillX + 46, fold), atX, pdot), y: mix(mix(pc.y, 960, fold), 958, pdot), d: mix(mix(134 * s, 57, fold), 16, pdot) };
  const rush = frame > PILL && frame < PILL + o(13) ? (fold - both(at01(frame - 1, PILL, PILL + o(13)))) * 260 : 0, appear = ek(CARD + o(10), CARD + o(16));
  // Her photo in the round, on her face (as tracked, else the upper middle of an upright one), in black and white.
  const sh = shots[0] || {}, asp = Number(sh.aspect) || 1, fz = sh.face, Z = asp < 0.9 ? 1.5 : 1, Wd = photoC.d * Z * mx(1, asp), Hd = Wd / asp;
  const fl = mn(0, mx(photoC.d - Wd, photoC.d / 2 - Wd * (fz ? fz.x + fz.w / 2 : 0.5))), ft = mn(0, mx(photoC.d - Hd, photoC.d / 2 - Hd * (fz ? fz.y + fz.h / 2 : asp < 0.9 ? 0.36 : 0.5)));
  const face = n
    ? h(Footage, { shot: 0, style: { left: px(fl), top: px(ft), width: px(Wd), height: px(Hd), filter: "grayscale(1) contrast(1.08)" } })
    : brand.logoUrl
      ? h(Img, { src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { ...abs("14%", "14%", "72%", "72%"), objectFit: "contain" } })
      : h("div", { style: { ...all, background: rgb ? "rgb(" + rgb.join(",") + ")" : INK, color: "#ffffff", ...flex, fontFamily: sans, fontWeight: 700, fontSize: R(photoC.d * 0.45) } }, (NAME || "·").charAt(0).toUpperCase());
  const photo = frame >= CARD && frame < AT + o(15)
    ? h("div", { key: "photo", style: { ...abs(px(photoC.x - photoC.d / 2), px(photoC.y - photoC.d / 2), px(photoC.d), px(photoC.d)), borderRadius: "50%", overflow: "hidden", background: n ? "#d9dbe3" : "#ffffff", opacity: mn(1, appear * 1.25) * (1 - k01(AT + o(10), AT + o(14))), filter: blur((1 - appear) * 9 + mn(3, rush)) } },
        face, pdot > 0 ? h("div", { style: { ...all, background: "#a9bce6", opacity: pdot } }) : null)
    : null;
  const bc = cam(bx, by), white = k01(CLICK + o(1), CLICK + o(3)), bs = mix(27, 40, zoom);
  const btn = { x: mix(bc.x - (B0.w * s) / 2, pillX, fold), y: mix(bc.y - (B0.h * s) / 2, 960 - PH / 2, fold), w: mix(B0.w * s, PWD, fold), h: mix(B0.h * s, PH, fold), r: mix(14 * s, PH / 2, fold) };
  const centred = (x) => ({ ...all, ...flex, ...x });
  const button = frame >= CARD && frame < AT + o(15)
    ? h("div", { key: "btn", style: { ...abs(px(btn.x), px(btn.y), px(btn.w), px(btn.h)), borderRadius: px(btn.r), background: grad(BTN), boxShadow: white > 0 ? "0 14px 34px rgba(20,24,60," + px(10 * white) / 100 + ")" : "none", opacity: frame < ZOOM ? ek(CARD + o(14), CARD + o(20)) : 1 - atGo, overflow: "hidden" } },
        h("div", { style: { ...all, background: "#ffffff", opacity: frame < CLICK ? 0.65 - 0.65 * ek(CARD + o(16), CARD + o(23)) : white } }),
        frame < PILL + o(11) ? h("div", { style: centred({ ...small(R(bs), { fontWeight: 700, color: "#ffffff" }), opacity: 1 - white }) }, acc("S'abonner")) : null,
        frame >= CLICK + o(6) && frame < PILL + o(11) ? h("div", { style: centred({ ...small(R(bs), { fontWeight: 700 }), ...fx(ek(CLICK + o(6), CLICK + o(10)) * (1 - k01(PILL + o(7), PILL + o(10))), 24) }) }, acc("Abonné(e)")) : null,
        frame >= PILL + o(7) ? h(FitText, { style: abs(99, 0, mx(80, PWD - 169), PH), innerStyle: { alignItems: "flex-start", ...small(32, { fontWeight: 700 }), ...fx(ek(PILL + o(8), PILL + o(11))) } }, acc(keep(who))) : null,
        frame >= PILL + o(11) ? h("svg", { width: 34, height: 34, viewBox: "0 0 24 24", style: { position: "absolute", right: 24, top: (PH - 34) / 2, opacity: ek(PILL + o(11), PILL + o(13)) } }, h("path", { d: "M5 12.5 L10 17 L19 7.5", fill: "none", stroke: "#69768b", strokeWidth: 2, strokeLinecap: "round" })) : null)
    : null;
  // The arrow, up from the bottom right in an arc, blurred while it rushes.
  const q = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const tip = (f) => { const t = both(at01(f, ZOOM + o(1), ZOOM + o(23))), l = ease(at01(f, PILL + o(7), PILL + o(15))); return { x: q(702, 930, 648, t) + 140 * l, y: q(1651, 1180, 979, t) + 260 * l, l }; };
  const now = tip(frame), was = tip(frame - 1), fast = Math.hypot(now.x - was.x, now.y - was.y);
  const arrow = frame > ZOOM && frame < PILL + o(16)
    ? h("svg", { key: "arrow", width: 40, height: 56, viewBox: "0 0 20 28", style: { ...abs(px(now.x - 3), px(now.y - 3)), opacity: 1 - now.l, filter: blur(fast > 12 ? mn(2.5, fast / 25) : 0) } },
        h("path", { d: "M1.5 1.5 L1.5 22 L6.6 17.4 L10.2 25.8 L13.6 24.3 L10.1 16.2 L17.2 16.2 Z", fill: "#111111", stroke: "#ffffff", strokeWidth: 1.6, strokeLinejoin: "round" }))
    : null;

  // 7. Her account in the gradient (her name, without « @ », when not known), « À SUIVRE » over it.
  const shownEnd = (a) => fx(ek(a, a + o(6)) * (end ? 1 - k01(endAt - 8, endAt) : 1));
  const inked = { backgroundImage: grad(ACC), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", paddingBottom: "0.08em" };
  const fin = frame >= AT + o(9) && frame < endAt
    ? h("div", { key: "fin", style: full },
        tag(852, "À SUIVRE", (r) => ek(AT + o(15) + r * o(10), AT + o(18) + r * o(10)), { color: "#919297", ...(end ? shownEnd(AT + o(15)) : {}) }),
        h(FitText, { style: abs(140, 924, 800, 74), innerStyle: { fontFamily: sans, fontWeight: 700, fontSize: ES, lineHeight: 1.15, letterSpacing: "-0.035em", whiteSpace: "nowrap", ...shownEnd(AT + o(9)) } },
          h("span", null, handle ? h("span", { style: { ...inked, opacity: k01(AT + o(10), AT + o(14)) } }, "@") : null, h("span", { style: inked }, keep(who)))))
    : null;

  // Any other text of the Reel: a plain line, so nothing she wrote is lost; its ending card out of the blur.
  const extra = others.filter((t) => frame >= t.from && frame < mn(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: abs(140, 320 + i * 112, 800, 100), innerStyle: line(52, { textAlign: "center", whiteSpace: "normal" }) }, keep(t.text)));
  const ending = end && frame >= endAt
    ? h(F, { key: "end" },
        h(FitText, { style: abs(140, end.subtitle ? 700 : 790, 800, 300), innerStyle: { justifyContent: end.subtitle ? "flex-end" : "center", ...line(88, { fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.04em", textAlign: "center", whiteSpace: "normal", textWrap: "balance" }) } },
          h("span", { style: { display: "inline-block", ...fx(ek(endAt + 2, endAt + 12)) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: abs(140, 1024, 800, 170), innerStyle: { justifyContent: "flex-start", ...line(50, { fontWeight: 500, color: GREY, textAlign: "center", whiteSpace: "normal", textWrap: "balance" }) } },
              h("span", { style: { display: "inline-block", ...fx(ek(endAt + 6, endAt + 16)) } }, keep(end.subtitle)))
          : null)
    : null;
  return h(AbsoluteFill, { style: { backgroundColor: GROUND } }, hookLine, listLayer, annLayer, typedLayer, shape, cardText, button, photo, arrow, fin, extra, ending);
}`;

export const interfaceSkill: MontageSkill = {
  key: "interface",
  // 3: « S'abonner » on her profile's button, then « Abonné(e) » (Tristan: « oui s'abonner »), as its pitch says.
  version: 3,
  bpm: BPM,
  // Her profile photo (or her logo, or a video of her looking at the camera): it plays in the round of her card.
  shots: [1, 1],
  files: [1, 2],
  fonts: ["Instrument Serif"],
  how: "Pur motion design sur un fond clair, sans coupe, comme une appli : ses premiers mots sortent du flou lettre à lettre au centre, le dernier en italique, qui devient la petite étiquette de sa liste ; sa liste défile sur la ligne du milieu, celui du milieu net, les autres flous, le dernier souligné d'un trait bleu qui s'effile ; son annonce monte sur deux lignes, mot à mot ; un curseur bleu tape sa promesse, avalée par l'icône d'Instagram qui s'ouvre en carte de profil (sa photo ronde, son nom, son métier, sa liste et sa promesse) ; zoom sur « S'abonner », une flèche clique, « Abonné(e) » ; tout se replie en pastille, sa photo devient le « @ » de son compte, en bleu, sous « À SUIVRE ».",
  end: true,
  texts: [
    {
      slot: "accroche",
      role: "hook",
      want: "2 à 4 mots qui sortent du flou lettre à lettre au début, le dernier en italique, qui devient ensuite l'étiquette de sa liste : ce qui commence ou qui elle est (une forme comme « un nouveau départ », « bienvenue chez Lune », « la rentrée arrive »)",
      max: 24,
      required: true,
    },
    {
      slot: "liste",
      role: "band",
      want: "trois choses qu'elle fait ou propose, séparées par des virgules, 1 ou 2 mots chacune (une forme comme « coupe, couleur, soin ») : elles défilent l'une après l'autre sur la ligne du milieu, la dernière soulignée, puis forment la bio de son profil",
      max: 40,
      required: true,
    },
    {
      slot: "etiquette",
      role: "caption",
      want: "facultatif : 1 à 3 petits mots en capitales espacées au-dessus de sa liste, en lesquels le dernier mot de l'accroche se change (une forme comme « ce qu'on fait », « au menu », « nos soins »)",
      max: 18,
      required: false,
    },
    {
      slot: "annonce",
      role: "caption",
      want: "facultatif : son annonce en une phrase de 5 à 7 mots, qui monte sur deux lignes mot à mot, ses deux derniers mots en italique (une forme comme « j'ouvre ma page pour montrer mes pièces »)",
      max: 44,
      required: false,
    },
    {
      slot: "promesse",
      role: "caption",
      want: "une phrase de 3 à 6 mots tapée lettre à lettre, comme sa bio : ce qu'elle apporte, ses derniers mots en italique (une forme comme « des coupes qui vous ressemblent »)",
      max: 34,
      required: true,
    },
    {
      slot: "metier",
      role: "caption",
      want: "facultatif : son métier en un ou deux mots, sous son nom dans sa carte de profil (une forme comme « céramiste », « fleuriste », « salon de coiffure »)",
      max: 22,
      required: false,
    },
    {
      slot: "compte",
      role: "caption",
      want: "son compte Instagram avec @ quand on le sait (jamais inventé), sinon son nom : il est en haut de sa carte de profil, dans la pastille après le clic, puis finit le Reel en bleu sous « À SUIVRE »",
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
  // Its pale ground and its ink as they are: none of the catalogue's contrast, grain or corners laid over them.
  finish: { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 },
  timeline(_n, { end, bpm: tempo, words }) {
    // At another tempo (a longer Reel, or a music's own): every moment, counted in beats, follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const at = interfaceImages();
    const seconds = (images: number) => (images / IMAGES) * beat;
    const frames = (images: number) => toFrame(seconds(images));
    // With an ending card, its time after her account (the engine's 1,6 s at least, rounded up on the half-beat grid).
    const card = end ? (Math.ceil(((CARD_SECONDS + 0.05) / beat) * 2) / 2) * beat : 0;
    const lit = round(seconds(at.end));
    const duration = round(lit + card);
    // Her promise's letters (as written, when they are): a soft key click on every other one as the caret types them.
    const letters = Math.max(6, Array.from(String(words?.promesse ?? "des coupes qui vous ressemblent")).length);
    const typing = seconds(at.type);
    const per = (60 / bpm / (60 / BPM)) / TYPING;
    const sounds: SkillSound[] = [
      { at: round3(typing), sound: "soft keyboard click", seconds: 0.5, gain: -8, burst: { times: Array.from({ length: Math.ceil(letters / 2) }, (_, k) => round3(k * 2 * per)) } },
      // Its double click on « S'abonner », the second on the beat.
      { at: round3(seconds(at.click) - 0.045 * (beat / (60 / BPM))), sound: "soft mouse click", seconds: 0.5, gain: -4 },
      { at: round3(seconds(at.click) + 0.045 * (beat / (60 / BPM))), sound: "soft mouse click", seconds: 0.5, gain: -4 },
    ];
    const opens = round3(seconds(at.icon - OPENS));
    return {
      duration,
      shots: [
        {
          start: 0,
          end: duration,
          want: "sa photo de profil, son logo en image, ou une photo d'elle bien éclairée, son visage au centre (une vidéo de 2 à 3 s d'elle qui regarde l'objectif y joue aussi) : elle apparaît ronde et en noir et blanc dans sa carte de profil Instagram, puis devient le « @ » de son compte",
        },
      ],
      // Each text in its moment: her first words, her list and its label, her announcement, her promise, her trade on her
      // card, her account from the pill to the end (or to her ending card).
      texts: {
        accroche: { from: 0, to: round(seconds(at.list)) },
        liste: { from: round(seconds(at.list)), to: round(seconds(at.ann + 13)) },
        etiquette: { from: round(seconds(at.list + 6)), to: round(seconds(at.ann + 13)) },
        annonce: { from: round(seconds(at.ann)), to: round(seconds(at.erase + 8)) },
        promesse: { from: round(seconds(at.type)), to: round(seconds(at.icon + 14)) },
        metier: { from: round(seconds(at.card)), to: round(seconds(at.zoom + 10)) },
        compte: { from: round(seconds(at.pill)), to: lit },
      },
      marks: {
        beat: round3(beat * 30),
        hook: frames(at.hook),
        out: frames(at.out),
        list: frames(at.list),
        line: frames(at.line),
        ann: frames(at.ann),
        erase: frames(at.erase),
        type: frames(at.type),
        icon: frames(at.icon),
        card: frames(at.card),
        zoom: frames(at.zoom),
        click: frames(at.click),
        pill: frames(at.pill),
        at: frames(at.at),
      },
      sounds,
      // Soft until the icon lands (10 dB under), then open, on a downbeat (its bars from its first beat); fading over its
      // last second, as the original's.
      music: { downbeat: round3(seconds(FIRST_BEAT)), filters: [{ kind: "soft", db: -10, from: 0, to: opens, open: 0.05 }], end: { at: duration, fade: end ? 0.6 : 1 } },
    };
  },
  code: CODE,
};
