import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Interface minimaliste », written on its original (house/originals/interface.mp4, 12,7 s of pure motion design on a
// pale blue-grey, looked at image by image): two words come out of the blur at the middle, a grotesque and its last word
// in a serif italic (« A new beginning »), and go back into it; a tiny spaced label in capitals over a list that rolls
// through the middle line, the one there sharp, its neighbours blurred above and below, the last one underlined by hand
// in blue; a sentence out of the blur on two lines, then another typed letter by letter behind a blue caret (« Giving
// brands a story worth watching », its end in the italic), which blurs away into an app's icon in a white rounded
// square; the icon opens into a white profile card (its handle and icons, a round photo, a name, a bio of two lines, a
// blue « Follow » and a grey « Message »); the card goes but the photo and the button, which come forward, an arrow
// glides onto it and clicks: « Followed »; the photo and the button fold into a white pill, the handle and a tick, then
// the handle alone, and it ends on « FOLLOW ALONG », tiny, over the handle in blue. Here the two sentences are one, typed
// (her promise), in French and big enough for a phone; the photo is hers (her profile photo or her logo, a video plays
// in it), the card her name, her list and her promise; the end her account, or her name when it is not known, her
// logo over it when it reads on the pale ground. Its ending card (an offer, an announcement) comes out of the blur after it.

const BPM = 100;
/** Its sections (beats at its tempo), each never shorter than its words need to be read on a phone (s). */
const SECTIONS: { beats: number; seconds: number }[] = [
  // Her first words out of the blur.
  { beats: 4, seconds: 2.2 },
  // The label and her list rolling.
  { beats: 4, seconds: 2.2 },
  // Her promise typed.
  { beats: 5, seconds: 2.8 },
  // The app's icon, opening into her card.
  { beats: 2, seconds: 1 },
  // Her profile card (its bio read: her list and her promise).
  { beats: 3.5, seconds: 2.2 },
  // The click on « S'abonner ».
  { beats: 2.5, seconds: 1.4 },
  // The pill with her account.
  { beats: 2, seconds: 1 },
  // Her account in blue, at the end.
  { beats: 3.5, seconds: 2 },
];
/** The engine's ending card: the Reel's last 1,6 s. */
const CARD_SECONDS = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = Math.max(4, mark("beat", 18));
  // Its sections (frames): her list, her promise typed, the icon, her card, the click, the pill, her account.
  const LIST = mark("list", Math.round(4 * BEAT));
  const TYPE = mark("type", LIST + Math.round(4 * BEAT));
  const ICON = mark("icon", TYPE + Math.round(5 * BEAT));
  const CARD = mark("card", ICON + Math.round(2 * BEAT));
  const CLICK = mark("click", CARD + Math.round(3.5 * BEAT));
  const PILL = mark("pill", CLICK + Math.round(2.5 * BEAT));
  const FIN = mark("fin", PILL + Math.round(2 * BEAT));
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const inOut = Easing.bezier(0.65, 0, 0.35, 1);
  const k01 = (a, b) => interpolate(frame, [a, b], [0, 1], clamp);
  const mix = (a, b, t) => a + (b - a) * t;
  const sans = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const serif = "'Instrument Serif', '" + brand.displayFont + "', Georgia, serif";
  // The model's own colours: a pale blue-grey ground, near-black type, a grey, its blue.
  const GROUND = "#f4f5fa";
  const INK = "#121317";
  const GREY = "#868a96";
  const BLUE = "#1f45c9";
  const BLUE2 = "#2b2e8c";
  const full = { position: "absolute", left: 0, top: 0, width, height };
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number, nor a line before a « · ».
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0").replace(/ (\d+(?:er|e))\b/g, "\u00a0$1").replace(/ ([·•|–—]) /g, "\u00a0$1 ");
  const wordsOf = (s) => String(s || "").split(/[ \t\n]+/).filter(Boolean);
  // A sentence, an item of her list: its first letter a capital, as an interface writes them.
  const cap = (s) => { const t = String(s || "").trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
  const unseen = (key, s) => h("span", { key, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, s);

  // Out of the blur over "len" frames from "a" (its blur and its opacity), back into it from "b".
  const focus = (a, len, b) => {
    const p = Math.min(ease(k01(a, a + len)), b === undefined ? 1 : 1 - k01(b, b + 8));
    return { filter: p > 0.995 ? "none" : "blur(" + ((1 - p) * 16).toFixed(1) + "px)", opacity: Math.min(1, p * 1.4) };
  };
  const italic = (size) => ({ fontFamily: serif, fontStyle: "italic", fontWeight: 400, fontSize: Math.round(size * 1.16), letterSpacing: "-0.01em" });
  // A line a word at a time out of the blur from the left, its last "last" words in the serif italic.
  const blurred = (text, a, b, last, size) => {
    const ws = wordsOf(text);
    return ws.map((w, i) => h(React.Fragment, { key: i }, i ? " " : null,
      h("span", { style: { display: "inline-block", ...focus(a + i * 3, 10, b === undefined ? undefined : b + i * 2), ...(i >= ws.length - last ? italic(size) : {}) } }, keep(w))));
  };

  const hook = reelTexts.find((t) => t.role === "hook");
  const band = reelTexts.find((t) => t.role === "band");
  const captions = reelTexts.filter((t) => t.role === "caption");
  const label = captions.find((t) => t.from >= LIST - 3 && t.from < TYPE - 3);
  const promise = captions.find((t) => t.from >= TYPE - 3 && t.from < ICON - 3);
  const account = captions.find((t) => t.from >= ICON - 3);
  const others = reelTexts.filter((t) => t !== hook && t !== band && t !== label && t !== promise && t !== account);

  // 1. Her first words out of the blur at the middle, the last one in the serif italic; back into it before the list.
  const SIZE1 = 74;
  const opening = hook && frame < LIST + 8
    ? h(FitText, { key: "hook", style: { position: "absolute", left: 140, top: 880, width: width - 280, height: 160 }, innerStyle: { fontFamily: sans, fontWeight: 600, fontSize: SIZE1, lineHeight: 1.12, letterSpacing: "-0.035em", color: INK, whiteSpace: "nowrap" } },
        h("span", null, blurred(cap(hook.text), 2, LIST - 12, 1, SIZE1)))
    : null;

  // 2. Its small label in spaced capitals, and her list rolling through the middle line: the one there sharp, its
  // neighbours blurred above and below; the last one underlined by hand in blue. Every item is in the page all along
  // (her separators too), the far ones unseen.
  const parts = band ? String(band.text).split(/(\s*[,;·\/\n]\s*)/) : [];
  const items = [];
  parts.forEach((p, i) => { if (i % 2 === 0 && p.trim()) items.push(i); });
  const m = Math.max(1, items.length);
  const firstAt = LIST + Math.round(0.5 * BEAT);
  const stepL = m > 1 ? Math.max(8, Math.min(Math.round(0.8 * BEAT), Math.floor((TYPE - firstAt - Math.round(1.6 * BEAT)) / (m - 1)))) : 0;
  let pos = 0;
  for (let j = 1; j < m; j++) pos += ease(k01(firstAt + j * stepL, firstAt + j * stepL + 8));
  const lineAt = firstAt + (m - 1) * stepL + Math.round(0.4 * BEAT);
  const listOut = TYPE - 9;
  const ROW = 118;
  const underline = (word, at) => {
    const drawn = ease(k01(at, at + 10));
    return h("span", { style: { position: "relative", display: "inline-block" } }, word,
      h("svg", { viewBox: "0 0 200 20", preserveAspectRatio: "none", "data-fauve-decor": "", style: { position: "absolute", left: "-3%", width: "106%", top: "100%", height: "0.2em", overflow: "visible", opacity: drawn > 0 ? 1 : 0 } },
        h("path", { d: "M 2 12 C 50 4, 120 3, 198 9", fill: "none", stroke: BLUE, strokeWidth: 6, strokeLinecap: "round", pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: (1 - drawn).toFixed(3) })));
  };
  const list = band && frame >= LIST && frame < TYPE + 2
    ? h("div", { key: "list", style: full },
        parts.map((p, i) => {
          const j = items.indexOf(i);
          if (j < 0) return unseen("s" + i, p);
          const d = j - pos;
          const enter = firstAt + Math.max(0, j - 1) * stepL;
          const seen = ease(k01(enter, enter + 8)) * (1 - k01(listOut, listOut + 8));
          const near = Math.min(1, Math.abs(d));
          if (Math.abs(d) > 1.5 || seen <= 0) return unseen("w" + i, p);
          const word = j === m - 1 ? underline(cap(p), lineAt) : cap(p);
          return h(FitText, { key: "w" + i, style: { position: "absolute", left: 140, top: Math.round(960 - ROW / 2 + d * ROW), width: width - 280, height: ROW }, innerStyle: { fontFamily: sans, fontWeight: 600, fontSize: 82, letterSpacing: "-0.035em", color: INK, whiteSpace: "nowrap", opacity: seen * (1 - 0.7 * near), filter: "blur(" + (7 * near + 14 * (1 - seen)).toFixed(1) + "px)" } }, word);
        }),
        label
          ? h(FitText, { key: "label", style: { position: "absolute", left: 140, top: 960 - ROW / 2 - ROW - 64, width: width - 280, height: 48 }, innerStyle: { fontFamily: sans, fontWeight: 600, fontSize: 26, letterSpacing: "0.32em", textTransform: "uppercase", color: GREY, whiteSpace: "nowrap", ...focus(LIST + 2, 10, listOut) } },
              h("span", { "data-fauve-accent": "", style: { marginRight: "-0.32em" } }, label.text))
          : null)
    : null;

  // 3. Her promise typed letter by letter at the middle behind a blue caret, its last words in the serif italic; it
  // blurs away, and the app's icon is there in its place.
  const SIZE3 = 66;
  const typed = (text, a, per) => {
    const ws = wordsOf(text);
    const last = ws.length >= 4 ? 2 : 1;
    const total = ws.reduce((s, w) => s + Array.from(w).length, 0);
    const shown = Math.max(0, Math.min(total, Math.floor((frame - a) / per) + 1));
    const blink = shown < total || Math.floor((frame - a - total * per) / 14) % 2 === 0;
    const caret = h("span", { key: "caret", style: { display: "inline-block", width: 0, position: "relative" } },
      h("span", { style: { position: "absolute", left: "0.05em", bottom: "-0.1em", width: "0.07em", height: "1.05em", backgroundColor: BLUE, opacity: frame >= a && blink ? 1 : 0 } }));
    let k = 0;
    return ws.map((w, i) => {
      const letters = Array.from(w).map((c, j) => {
        const at = k++;
        return h(React.Fragment, { key: j }, h("span", { style: { opacity: at < shown ? 1 : 0 } }, c), at === shown - 1 ? caret : null);
      });
      return h(React.Fragment, { key: i }, i ? " " : null, h("span", { style: { whiteSpace: "nowrap", ...(i >= ws.length - last ? italic(SIZE3) : {}) } }, i === 0 && shown === 0 ? caret : null, letters));
    });
  };
  const perLetter = promise ? Math.max(0.8, Math.min(2.2, (Math.round(1.1 * 30)) / Math.max(1, Array.from(String(promise.text)).length))) : 1;
  const promiseLine = promise && frame >= TYPE && frame < ICON + 2
    ? h(FitText, { key: "promise", style: { position: "absolute", left: 140, top: 860, width: width - 280, height: 200 }, innerStyle: { fontFamily: sans, fontWeight: 600, fontSize: SIZE3, lineHeight: 1.16, letterSpacing: "-0.03em", color: INK, textWrap: "balance" } },
        h("span", { style: focus(TYPE, 1, ICON - 8) }, typed(cap(promise.text), TYPE + 3, perLetter)))
    : null;

  // 4. The app's icon in a white rounded square, opening into her profile card.
  const glyph = (s, color) => h("svg", { width: s, height: s, viewBox: "0 0 24 24", style: { display: "block" } },
    h("rect", { x: 3, y: 3, width: 18, height: 18, rx: 5.2, fill: "none", stroke: color, strokeWidth: 1.7 }),
    h("circle", { cx: 12, cy: 12, r: 4.1, fill: "none", stroke: color, strokeWidth: 1.7 }),
    h("circle", { cx: 17.1, cy: 6.9, r: 1.05, fill: color }));
  const I = 132;
  const CX = 110;
  const CY = 640;
  const CW = width - 220;
  const CH = 640;
  const grow = inOut(k01(ICON + Math.round(0.7 * BEAT), CARD));
  const shown4 = ease(k01(ICON - 4, ICON + 4)) * (1 - k01(CLICK, CLICK + 8));
  const shape = frame >= ICON - 4 && frame < CLICK + 8
    ? h("div", { key: "shape", style: { position: "absolute", left: mix(width / 2 - I / 2, CX, grow), top: mix(960 - I / 2, CY, grow), width: mix(I, CW, grow), height: mix(I, CH, grow), borderRadius: mix(34, 44, grow), backgroundColor: "#ffffff", boxShadow: "0 24px 60px rgba(20,24,60,0.10), 0 2px 6px rgba(20,24,60,0.06)", opacity: shown4, transform: "scale(" + (0.7 + 0.3 * ease(k01(ICON - 4, ICON + 4))).toFixed(4) + ")" } },
        grow < 0.6 ? h("div", { style: { position: "absolute", left: "50%", top: "50%", width: 64, height: 64, marginLeft: -32, marginTop: -32, opacity: 1 - grow / 0.6 } }, glyph(64, "#1c1c1e")) : null)
    : null;

  // 5. Her card: her account at the top and its icons, her photo round, her name, her list and her promise as its bio,
  // « S'abonner » and « Écrire ».
  const handleOf = (s) => { const t = String(s || "").trim(); return /^@?[A-Za-z0-9._]{2,30}$/.test(t) ? t.replace(/^@/, "") : ""; };
  const handle = account ? handleOf(account.text) : "";
  const NAME = brand.name || (account ? account.text : "") || (hook ? hook.text : "");
  const who = handle || (account ? account.text : NAME);
  const listLine = items.map((i) => cap(parts[i]).replace(/[.!?…]+$/, "")).join(". ") + (items.length ? "." : "");
  const content = k01(CARD - 2, CARD + 6) * (1 - k01(CLICK, CLICK + 8));
  const icon = (key, x, kind) => h("svg", { key, width: 40, height: 40, viewBox: "0 0 24 24", style: { position: "absolute", left: x, top: CY + 44 } },
    kind === "plus"
      ? h("g", { fill: "none", stroke: INK, strokeWidth: 1.6, strokeLinecap: "round" }, h("rect", { x: 3.5, y: 3.5, width: 17, height: 17, rx: 5 }), h("path", { d: "M12 8 V16 M8 12 H16" }))
      : h("path", { d: "M4 7 H20 M4 12 H20 M4 17 H20", fill: "none", stroke: INK, strokeWidth: 1.6, strokeLinecap: "round" }));
  const card = content > 0
    ? h("div", { key: "card", style: { ...full, opacity: content } },
        h(FitText, { style: { position: "absolute", left: CX + 44, top: CY + 38, width: 560, height: 52 }, innerStyle: { alignItems: "flex-start", fontFamily: sans, fontWeight: 700, fontSize: 38, letterSpacing: "-0.02em", color: INK, whiteSpace: "nowrap" } },
          h("span", { "data-fauve-accent": "" }, who, h("svg", { width: 26, height: 26, viewBox: "0 0 24 24", style: { display: "inline-block", marginLeft: 10, verticalAlign: "middle" } }, h("path", { d: "M6 9 L12 15 L18 9", fill: "none", stroke: INK, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" })))),
        icon("plus", CX + CW - 144, "plus"),
        icon("menu", CX + CW - 84, "menu"),
        h(FitText, { style: { position: "absolute", left: CX + 44 + 176 + 34, top: CY + 152, width: CW - 44 - 176 - 34 - 44, height: 80 }, innerStyle: { alignItems: "flex-start", fontFamily: sans, fontWeight: 700, fontSize: 54, letterSpacing: "-0.03em", color: INK, whiteSpace: "nowrap" } },
          h("span", { "data-fauve-accent": "" }, keep(NAME))),
        h(FitText, { style: { position: "absolute", left: CX + 44, top: CY + 304, width: CW - 88, height: 190 }, innerStyle: { alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left", fontFamily: sans, fontWeight: 500, fontSize: 48, lineHeight: 1.24, letterSpacing: "-0.02em", color: INK } },
          h("div", null, keep(listLine)),
          promise ? h("div", null, keep(cap(promise.text))) : null),
        h("div", { style: { position: "absolute", left: CX + CW / 2 + 12, top: CY + 520, width: CW / 2 - 56, height: 86, borderRadius: 22, backgroundColor: "#ececf1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 600, fontSize: 40, color: INK } },
          h("span", { "data-fauve-accent": "" }, "Écrire")))
    : null;

  // 6. The card goes but her photo and the button, which come forward; the arrow glides onto it and clicks: « Abonné(e) ».
  // 7. They fold into a white pill, her account and a tick; then her account alone.
  const toFocus = inOut(k01(CLICK, CLICK + 12));
  const toPill = inOut(k01(PILL, PILL + 12));
  const pillGone = k01(FIN - 10, FIN);
  const clickAt = CLICK + Math.round(1.3 * BEAT);
  const AV0 = { x: CX + 44, y: CY + 104, s: 176 };
  const AV1 = { x: width / 2 - 130, y: 640, s: 260 };
  const PILLBOX = { x: width / 2 - 260, y: 900, w: 520, h: 120 };
  const AV2 = { x: PILLBOX.x + 20, y: PILLBOX.y + 18, s: 84 };
  const av = {
    x: frame < PILL ? mix(AV0.x, AV1.x, toFocus) : mix(AV1.x, AV2.x, toPill),
    y: frame < PILL ? mix(AV0.y, AV1.y, toFocus) : mix(AV1.y, AV2.y, toPill),
    s: frame < PILL ? mix(AV0.s, AV1.s, toFocus) : mix(AV1.s, AV2.s, toPill),
  };
  const avShown = k01(CARD - 2, CARD + 6) * (1 - pillGone);
  const avatar = n && frame >= CARD - 2 && frame < FIN
    ? h("div", { key: "avatar", style: { position: "absolute", left: Math.round(av.x), top: Math.round(av.y), width: Math.round(av.s), height: Math.round(av.s), borderRadius: "50%", overflow: "hidden", backgroundColor: "#e6e7ee", opacity: avShown } },
        h(Footage, { shot: 0, style: { left: 0, top: 0, width: Math.round(av.s), height: Math.round(av.s) } }))
    : null;
  const BT0 = { x: CX + 44, y: CY + 520, w: CW / 2 - 56, h: 86, f: 40 };
  const BT1 = { x: width / 2 - 250, y: 960, w: 500, h: 118, f: 54 };
  const bt = {
    x: frame < PILL ? mix(BT0.x, BT1.x, toFocus) : mix(BT1.x, PILLBOX.x, toPill),
    y: frame < PILL ? mix(BT0.y, BT1.y, toFocus) : mix(BT1.y, PILLBOX.y, toPill),
    w: frame < PILL ? mix(BT0.w, BT1.w, toFocus) : mix(BT1.w, PILLBOX.w, toPill),
    h: frame < PILL ? mix(BT0.h, BT1.h, toFocus) : mix(BT1.h, PILLBOX.h, toPill),
    f: frame < PILL ? mix(BT0.f, BT1.f, toFocus) : BT1.f,
  };
  const clicked = frame >= clickAt + 2;
  const press = frame >= clickAt && frame < clickAt + 6 ? 1 - 0.05 * Math.sin(((frame - clickAt) / 6) * Math.PI) : 1;
  const button = frame >= CARD - 2 && frame < FIN
    ? h("div", { key: "button", style: { position: "absolute", left: Math.round(bt.x), top: Math.round(bt.y), width: Math.round(bt.w), height: Math.round(bt.h), borderRadius: Math.round(mix(22, bt.h / 2, toPill)), background: clicked ? "#ffffff" : "linear-gradient(100deg, " + BLUE + ", " + BLUE2 + ")", boxShadow: clicked ? "0 18px 44px rgba(20,24,60,0.12), 0 2px 6px rgba(20,24,60,0.06)" : "none", opacity: k01(CARD - 2, CARD + 6) * (1 - pillGone), transform: "scale(" + press.toFixed(4) + ")" } },
        frame < PILL + 6
          ? h("div", { style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 600, fontSize: Math.round(bt.f), letterSpacing: "-0.02em", color: clicked ? INK : "#ffffff", whiteSpace: "nowrap", opacity: 1 - k01(PILL, PILL + 6) } },
              h("span", { "data-fauve-accent": "" }, clicked ? "Abonné(e)" : "S'abonner"))
          : null)
    : null;
  const cursor = frame >= CLICK && frame < PILL + 8
    ? h(Cursor, { key: "cursor", path: [{ x: width - 250, y: 1560, at: CLICK + 6 }, { x: width / 2 + 40, y: 1032, at: clickAt - 4 }, { x: width / 2 + 60, y: 1050, at: clickAt + 10 }], clicks: [clickAt], kind: "arrow", size: 84, color: "#111111", outline: "#ffffff", out: PILL + 2 })
    : null;
  // Her account in the pill, a tick after it; then alone, where it ends.
  const pillText = frame >= PILL + 4 && frame < FIN + 2
    ? h("div", { key: "pill-text", style: { ...full, opacity: k01(PILL + 4, PILL + 10) * (1 - k01(FIN - 2, FIN + 2)) } },
        h(FitText, { style: { position: "absolute", left: PILLBOX.x + 120, top: PILLBOX.y + 22, width: PILLBOX.w - 120 - 76, height: 76 }, innerStyle: { alignItems: "flex-start", fontFamily: sans, fontWeight: 600, fontSize: 48, letterSpacing: "-0.02em", color: INK, whiteSpace: "nowrap" } },
          h("span", { "data-fauve-accent": "" }, keep(who))),
        h("svg", { width: 40, height: 40, viewBox: "0 0 24 24", style: { position: "absolute", left: PILLBOX.x + PILLBOX.w - 64, top: PILLBOX.y + 40, opacity: 1 - pillGone } },
          h("path", { d: "M5 12.5 L10 17 L19 7.5", fill: "none", stroke: INK, strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" })))
    : null;

  // 8. The end: « À suivre », small and spaced, over her account in blue (her name when it is not known), her logo over
  // them when it reads on the pale ground.
  const shownEnd = (a) => focus(a, 10, end ? endAt - 8 : undefined);
  const darkLogo = brand.logoUrl && (brand.logoOnDark === "white" || brand.logoOnDark === "plate");
  const final = frame >= FIN
    ? h("div", { key: "final", style: full },
        darkLogo
          ? h("div", { style: { position: "absolute", left: width / 2 - 150, top: 690, width: 300, height: 150, ...shownEnd(FIN + 2) } },
              h(Img, { src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { width: "100%", height: "100%", objectFit: "contain" } }))
          : null,
        h(FitText, { style: { position: "absolute", left: 140, top: 878, width: width - 280, height: 48 }, innerStyle: { fontFamily: sans, fontWeight: 600, fontSize: 26, letterSpacing: "0.34em", color: GREY, whiteSpace: "nowrap", ...shownEnd(FIN + 4) } },
          h("span", { "data-fauve-accent": "", style: { marginRight: "-0.34em" } }, "À SUIVRE")),
        h(FitText, { style: { position: "absolute", left: 140, top: 930, width: width - 280, height: 130 }, innerStyle: { fontFamily: sans, fontWeight: 700, fontSize: 94, letterSpacing: "-0.04em", whiteSpace: "nowrap", ...shownEnd(FIN) } },
          h("span", { style: { backgroundImage: "linear-gradient(100deg, " + BLUE + ", " + BLUE2 + ")", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", paddingBottom: "0.08em" } }, keep(handle ? "@" + handle : who))))
    : null;

  // Any other text of the Reel (none in its slots): a plain line in the upper third, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 320 + i * 112, width: width - 280, height: 100 }, innerStyle: { fontFamily: sans, fontWeight: 600, fontSize: 52, color: INK, textAlign: "center" } }, keep(t.text)));

  // Its ending card, out of the blur after her account: its title in the grotesque, its line in grey under it.
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 700 : 790, width: width - 280, height: 300 }, innerStyle: { justifyContent: end.subtitle ? "flex-end" : "center", fontFamily: sans, fontWeight: 700, fontSize: 92, lineHeight: 1.04, letterSpacing: "-0.04em", color: INK, textAlign: "center", textWrap: "balance" } },
          h("span", { style: { display: "inline-block", ...focus(endAt + 2, 10) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1024, width: width - 280, height: 170 }, innerStyle: { justifyContent: "flex-start", fontFamily: sans, fontWeight: 500, fontSize: 50, lineHeight: 1.2, letterSpacing: "-0.02em", color: GREY, textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", ...focus(endAt + 6, 10) } }, keep(end.subtitle)))
          : null)
    : null;

  // Her photo over the button: it sits at the left end of the pill they fold into.
  return h(AbsoluteFill, { style: { backgroundColor: GROUND } }, opening, list, promiseLine, shape, card, button, avatar, cursor, pillText, final, extra, ending);
}`;

export const interfaceSkill: MontageSkill = {
  key: "interface",
  version: 1,
  bpm: BPM,
  shots: [1, 1],
  files: [1, 2],
  fonts: ["Instrument Serif"],
  how: "Pur motion design sur un fond clair, comme une appli : ses premiers mots sortent du flou au centre, le dernier en italique ; une petite étiquette et sa liste qui défile, celui du milieu net, les autres flous, le dernier souligné en bleu ; sa phrase tapée lettre à lettre derrière un curseur bleu, qui laisse place à l'icône d'Instagram ; l'icône s'ouvre en carte de profil (sa photo ronde, son nom, sa liste et sa phrase) ; un curseur clique « S'abonner », qui devient « Abonné(e) » ; puis son compte seul en bleu, sous « À suivre ».",
  end: true,
  texts: [
    {
      slot: "accroche",
      role: "hook",
      want: "2 à 4 mots qui sortent du flou au début, le dernier en italique : ce qui commence ou qui elle est (une forme comme « un nouveau départ », « bienvenue chez Lune », « la rentrée arrive »)",
      max: 24,
      required: true,
    },
    {
      slot: "liste",
      role: "band",
      want: "trois choses qu'elle fait ou propose, séparées par des virgules, 1 ou 2 mots chacune (une forme comme « coupe, couleur, soin ») : elles défilent l'une après l'autre, puis forment la bio de son profil",
      max: 40,
      required: true,
    },
    {
      slot: "promesse",
      role: "caption",
      want: "une phrase de 3 à 6 mots tapée lettre à lettre, comme sa bio : ce qu'elle apporte, ses derniers mots en italique (une forme comme « des coupes qui vous ressemblent »)",
      max: 32,
      required: true,
    },
    {
      slot: "etiquette",
      role: "caption",
      want: "facultatif : 1 à 3 petits mots en capitales espacées au-dessus de la liste (une forme comme « ce qu'on fait », « au menu », « nos soins »)",
      max: 18,
      required: false,
    },
    {
      slot: "compte",
      role: "caption",
      want: "son compte Instagram avec @ quand on le sait (jamais inventé), sinon son nom : il est en haut de sa carte de profil et finit le Reel en bleu, sous « À suivre »",
      max: 30,
      required: false,
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it, each section kept long
    // enough to read at a fast tempo (on the half-beat grid).
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const beats = SECTIONS.map((s) => Math.max(s.beats, Math.ceil((s.seconds / beat) * 2) / 2));
    const starts = beats.map((_, i) => beats.slice(0, i).reduce((a, b) => a + b, 0));
    // With an ending card, its time after her account (the engine's 1,6 s at least, rounded up on the half-beat grid).
    const card = end ? Math.ceil(((CARD_SECONDS + 0.05) / beat) * 2) / 2 : 0;
    const spans = beatSpans(bpm, [beats.reduce((a, b) => a + b, 0) + card]);
    const duration = spans[0]!.end;
    const at = (i: number) => round(starts[i]! * beat);
    const lit = round(end ? duration - CARD_SECONDS : duration);
    return {
      duration,
      shots: spans.map((s) => ({
        ...s,
        want: "sa photo de profil, son logo en image, ou une photo d'elle bien éclairée, son visage au centre : elle apparaît ronde dans sa carte de profil Instagram à la fin du Reel (une vidéo y joue aussi)",
      })),
      // Each text in its section: her first words, the list and its label, her promise, her account from her card on.
      texts: {
        accroche: { from: 0, to: at(1) },
        liste: { from: at(1), to: at(2) },
        etiquette: { from: at(1), to: at(2) },
        promesse: { from: at(2), to: at(3) },
        compte: { from: at(4), to: lit },
      },
      marks: {
        beat: beat * 30,
        list: toFrame(at(1)),
        type: toFrame(at(2)),
        icon: toFrame(at(3)),
        card: toFrame(at(4)),
        click: toFrame(at(5)),
        pill: toFrame(at(6)),
        fin: toFrame(at(7)),
      },
    };
  },
  code: CODE,
};
