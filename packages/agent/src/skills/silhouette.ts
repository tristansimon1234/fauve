import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Présente-toi » (key `silhouette`), version 4: its original's idea and its signature effect in a design of its own
// (Tristan, 6 November: « trop similaire à la vidéo originale », and « c'est un effet que l'on veut pouvoir faire, pas
// exactement reproduire l'image »; docs/fiches/silhouette.md). Kept of the original (its fiche, measured image by
// image): a presentation in four bars of a slow half-time beat at 84,5 BPM (its bars on 1,06 · 3,90 · 6,74 · 9,58 s),
// its break before the drop of its second bar, its last hit ringing; and its signature, her profile cut out and filled
// with one dark tone, a word in pale inside her head that goes as she lowers it, her name typed behind her head.
// Its own (nothing of the original's design: no layout program, no negative, no hand of dots, no letter turned into an
// eye, no almond, no wavy line, no clap, no receding name, no logo whitened on midnight blue): her charter's dark, pale
// and accent (else a warm ink, a warm paper and a vermilion, never its midnight, cold pale and peach); every length in
// its beats from the Reel's start (its first bar 1,5 beats in, a pickup):
//   0 – 1,5     her paper; her greeting stamped in big letter by letter on the sixteenths, a light click each, an accent
//               rule drawing itself under it as it comes;
//   1,5 – 5,5   cut on the first bar: her profile in one dark tone on the paper; « Je suis » in pale in her head, gone as
//               she lowers her head (read on her tracks when measured, else on the beat), her name typed behind her head
//               (her last name rising away); on beat 3 the music breaks and her paper turns to her accent, her
//               silhouette and her name held on it;
//   5,5 – 11    on the drop, her dark ground: « Votre » small and her trade big in pale, an accent block wiping in under
//               her trade; what she does on the music's hits, each word in its own accent block under it;
//   11 – 13,5   her paper: her name on two lines, her first name and her last name in bold, an accent rule under it;
//   13,5 – 15,6 cut on the last bar: her accent, her logo in her dark (else her place's name in capitals); the music
//               ending on its last hit with its tail.
// Vertical full frame by default (drawn on flat colours, it hardly depends on her videos), her silhouette at the bottom,
// cut by the frame, framed round her head; on her word a 16:9 frame in the middle on dark bands. Her photo stays still,
// her video plays (at its own pace: a slowed shot is not cut out).

const BPM = 84.5;
/** Its marks, in beats from the Reel's start (21,3 images a beat): the cut on her, the drop, her name, her logo, the end. */
const CUT = 1.5;
const DROP = 5.5;
const NAME = 11;
const LOGO = 13.5;
const LOGO_HOLD = 1.69;
const END = 15.6;
/** Her greeting stamped letter by letter from this beat to that one, its rule drawn under it meanwhile. */
const STAMP_FROM = 4 / 21.3;
const STAMP_TO = 26 / 21.3;
/** After the cut on her: her head going down on the hit of 0,75 beat when nothing was measured, her name typed from image 50, her last name rising away. */
const HEAD_DOWN = 0.61;
const NAME_TYPE = 0.845;
const LAST_OUT = 1.92;
/** On beat 3 of its first bar the music breaks and her paper turns to her accent. */
const FLIP = 3;
/** Her trade's accent block wipes in from the drop; what she does on the hits of its sixteenths from the Reel's start. */
const FIRST_JOB = 31;
/** The ending card, in option: after her logo, the engine's 1,6 s at least, on whole quarters of a beat. */
const CARD_SECONDS = 1.6;
const round = (s: number) => Math.round(s * 100) / 100;
const round3 = (s: number) => Math.round(s * 1000) / 1000;
/** A light click on each letter stamped, a breath rising into the drop. */
const CLICK = { sound: "light click", seconds: 0.5, gain: -3 };
const RISER = { sound: "short rising whoosh", seconds: 0.5, gain: -4 };

/** Her greeting's letters as its code stamps them (code points of her word, its spaces taken out of the count). */
export const typedLetters = (word: string | undefined) => Array.from(String(word ?? "").normalize("NFC").trim()).filter((c) => !/\s/.test(c));

/** The frame each letter of her greeting lands on, as its code stamps them: evenly from `from` to `to`. */
export function letterFrames(count: number, from: number, to: number): number[] {
  return Array.from({ length: count }, (_, i) => (count < 2 ? from : Math.round(from + (i * (to - from)) / (count - 1))));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const M = (k, d) => Math.round(mark(k, d));
  const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const lerp = (f, a, b, x, y, e) => interpolate(f, [a, Math.max(a + 1, b)], [x, y], e ? { ...cl, easing: e } : cl);
  const EO = (x) => 1 - Math.pow(1 - x, 3);
  const CUT = M("cut", 32), DROP = M("drop", 117), NAME = M("name", 234), LOGO = M("logo", 288), FLIP = M("flip", 96);
  const endAt = end ? end.from : durationInFrames + 1;

  // Its colours: her charter's dark, pale and accent when they read together, else its own warm ink, paper and
  // vermilion (never the original's midnight, cold pale and peach).
  const hex = (c) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim().toLowerCase() : null);
  const lum = (c) => {
    const n = parseInt(c.slice(1), 16);
    const lin = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const pal = brand.palette || {};
  const light = hex(pal.light), dark = hex(pal.dark), accent = hex(brand.accent);
  const PALE = light && light !== "#ffffff" && lum(light) >= 0.7 ? light : "#efe9de";
  const DARK = dark && lum(dark) <= 0.06 ? dark : "#1b1714";
  const ACCENT = accent && ratio(accent, DARK) >= 3 && ratio(accent, PALE) >= 1.8 ? accent : "#e0512f";
  const font = "'" + brand.displayFont + "', 'Inter', 'Helvetica Neue', sans-serif";
  const W = width;
  // Vertical, or on her word a 16:9 frame on dark bands.
  const wide = texts && texts.format === "horizontal";
  const S = wide ? { x: 0, y: Math.round((height - (W * 9) / 16) / 2), w: W, h: Math.round((W * 9) / 16) } : { x: 0, y: 0, w: W, h: height };
  const at = (fy, vy) => Math.round(wide ? S.y + fy * S.h : vy * height);
  const abs = (s) => ({ position: "absolute", ...s });
  const full = abs({ left: S.x, top: S.y, width: S.w, height: S.h });
  const inFrame = (key, ...kids) => h("div", { key, style: { ...full, overflow: "hidden" } }, h("div", { style: abs({ left: -S.x, top: -S.y, width: W, height }) }, ...kids));
  // A line of text centred on x (from x when left), its top at y.
  const row = (x, y, size, weight, color, kids, more, left) => h("div", { style: abs({ left: Math.round(left ? x : x - 450), width: left ? undefined : 900, top: Math.round(y), display: "flex", justifyContent: "center", fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1, color, whiteSpace: "pre", ...more }) }, kids);
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const role = (r, k) => reelTexts.filter((t) => t.role === r)[k];
  const hello = role("hook", 0), nom = role("band", 0), list = role("band", 1), je = role("caption", 0), ton = role("caption", 1), trade = role("caption", 2);
  const letters = (s) => Array.from(String(s || "").normalize("NFC").trim());
  const ground = frame >= LOGO ? ACCENT : frame >= DROP && frame < NAME ? DARK : frame >= FLIP && frame < DROP ? ACCENT : PALE;

  // 1. Her greeting stamped in big, letter by letter (each at once, at its place), an accent rule drawing under it.
  const word = hello ? letters(keep(hello.text)) : [];
  const units = word.filter((c) => !/\s/.test(c));
  const A0 = M("stamp_from", 4), A1 = M("stamp_to", 26);
  const lands = units.map((_, i) => (units.length < 2 ? A0 : Math.round(A0 + (i * (A1 - A0)) / (units.length - 1))));
  const FS = Math.max(96, Math.min(220, Math.round(1500 / Math.max(4, word.length))));
  const BASE = at(0.56, 0.44);
  let seen = 0;
  const greeting = frame < CUT && hello
    ? h("div", { key: "word" },
        row(W / 2, BASE - FS * 0.8, FS, 700, DARK, word.map((c, i) => (/\s/.test(c) ? h("span", { key: i }, c) : h("span", { key: i, style: { opacity: frame >= lands[seen++] ? 1 : 0 } }, c))), { letterSpacing: "-0.03em" }),
        h("div", { key: "rule", style: abs({ left: Math.round(W / 2 - Math.min(800, word.length * FS * 0.56) / 2), top: Math.round(BASE + FS * 0.16), height: Math.max(10, Math.round(FS * 0.07)), width: Math.round(Math.min(800, word.length * FS * 0.56) * lerp(frame, A0, A1 + 4, 0, 1, EO)), background: ACCENT }) }))
    : null;

  // 2. Her profile in one tone on the paper (nobody: what the filler named, else a print), framed round her head.
  const sh = shots[0];
  const sil = sh && frame >= CUT && frame < DROP;
  const base = { left: 0, top: 0, width: Math.round(S.h * (sh && sh.aspect > 0 ? sh.aspect : S.w / S.h)), height: S.h };
  const ref = Math.max(0, Math.min(sh ? sh.durationInFrames - 1 : 0, 6));
  const OBJ = "@forme";
  const herBox = sh ? SubjectBox(sh, ref, base) : null;
  const what = herBox || OBJ.charAt(0) === "@" ? undefined : OBJ;
  const box0 = sh ? herBox || (what ? SubjectBox(sh, ref, base, what) : null) : null;
  const cutHer = (style) => h(Subject, { shot: 0, at: CUT, fill: DARK, style, ...(what ? { object: what } : {}) });
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
  // As wide as a third of the frame (to the bottom when her picture cuts her).
  const low = box0 && box0.y + box0.h >= base.height * 0.97 ? (S.y + S.h - want.y) / Math.max(40, base.height - head0.y) : 0;
  const k = head0 ? Math.max(0.15, Math.min(3, Math.max(want.w / head0.w, low))) : 1;
  const laid = head0 ? { left: Math.round(want.x - head0.x * k), top: Math.round(want.y - head0.y * k), width: Math.round(base.width * k), height: Math.round(base.height * k) } : { ...full };
  // A side her picture cuts goes past the frame's.
  if (head0 && box0.x + box0.w >= base.width * 0.97) laid.left = Math.max(laid.left, S.x + S.w - laid.width);
  if (head0 && box0.x <= base.width * 0.03) laid.left = Math.min(laid.left, S.x);
  const L = abs(laid);
  const local = (f) => Math.max(0, f - CUT);
  const cutOut = Boolean(box0);
  // The print's threshold from her shot's light, its darks her dark tone, its lights the ground.
  const lit = sh && !cutOut && typeof LightUnder === "function" ? LightUnder(shots[0], ref, base) : null;
  const gain = lit && lit.mean > 0.04 ? Math.max(0.55, Math.min(2.4, 0.5 / lit.mean)) : 1.35;
  const print = "grayscale(1) brightness(" + gain.toFixed(2) + ") contrast(3.2)";
  const her = sil ? inFrame("her", cutOut ? cutHer(L) : h("div", { style: { ...full, isolation: "isolate" } }, h(Footage, { shot: 0, at: CUT, style: { ...L, filter: print } }),
    h("div", { style: { ...full, background: ground, mixBlendMode: "darken" } }), h("div", { style: { ...full, background: DARK, mixBlendMode: "lighten" } }))) : null;
  // Her head going down: measured on her tracks, else on the beat.
  const down = (sh && typeof HeadMoves === "function" ? HeadMoves(sh) : []).map((m) => ({ from: m.from + CUT, to: m.to + CUT, what: m.what })).find((m) => m.what === "down" && m.from >= CUT + 4 && m.from < FLIP - 10);
  const D0 = down ? down.from : M("head_down", 45), D1 = down ? Math.min(down.to, D0 + 20) : D0 + 8;
  const headAt = (f) => (sh ? headOf(SubjectOutline(sh, local(f), laid, what), SubjectBox(sh, local(f), laid, what)) : null) || want;
  const hd = headAt(CUT + 4);
  const face = track ? ((track(local(CUT + 4), { shot: 0, ...laid }) || {}).faces || [])[0] : null;
  const imAt = face ? { x: face.x, y: face.y } : { x: hd.x, y: hd.y + hd.w * 0.5 };
  // « Je suis » in pale in her head, kept inside her outline; gone from its end as her head lowers.
  const imChars = je ? letters(je.text) : [];
  const iL = Math.max(60, hd.x - hd.w / 2), iR = Math.min(imAt.y > 900 ? W - 160 : W - 60, hd.x + hd.w / 2);
  const imFs = Math.max(48, Math.min(wide ? 84 : 116, Math.round(((iR - iL) * 1.5) / Math.max(3, imChars.length))));
  const outline = sil ? SubjectOutline(sh, local(frame), laid, what) : null;
  const im = je && frame >= CUT && frame < D0 + 6
    ? h("div", { key: "im", style: abs({ left: 0, top: 0, width: W, height, ...(outline ? { clipPath: "path('" + outline.replace(/ M /g, " L ") + " Z')" } : {}) }) },
        row(Math.max(iL + imChars.length * imFs * 0.31, Math.min(iR - imChars.length * imFs * 0.31, imAt.x)), imAt.y - imFs * 0.6, imFs, 600, PALE, imChars.map((c, i) => {
          const g = D0 + (imChars.length - 1 - i) * 0.7;
          return h("span", { key: i, style: { opacity: lerp(frame, g, g + 2, 1, 0) } }, c);
        })))
    : null;
  // Her name typed behind her head (her silhouette passes in front of it), its last name rising away, her first name held to the drop.
  const NT = down ? Math.min(FLIP - 30, D0 + 5) : M("name_type", 50);
  const hdDown = headAt(Math.min(DROP - 1, Math.max(NT + 9, D1)));
  const within = (w) => Math.max(60 + w / 2, Math.min(W - 60 - w / 2, hdDown.x));
  const nameWords = nom ? keep(nom.text).split(/\s+/).filter(Boolean) : [];
  const first = nameWords[0] || "", rest = nameWords.slice(1).join(" ");
  const nmFs = 64;
  const nameLetters = letters(first + (rest ? " " + rest : ""));
  const typedN = Math.max(0, Math.min(nameLetters.length, Math.floor((frame - NT + 1) * 1.33)));
  const LO = M("last_out", 73);
  const ny = Math.round(Math.max(S.y + 40, hdDown.y - nmFs * 1.1));
  const blink = frame < NT + nameLetters.length * 0.75 + 2 || Math.floor((frame - NT) / 6.5) % 2 === 0;
  const nameNode = nom && frame >= NT && frame < DROP
    ? h("div", { key: "name" }, row(within(nameLetters.length * nmFs * 0.6), ny, nmFs, 500, DARK, [
        h("span", { key: "f" }, nameLetters.slice(0, Math.min(typedN, first.length)).join("")),
        rest && typedN > first.length + 1 ? h("span", { key: "r", style: { fontWeight: 700, display: "inline-block", transform: "translateY(" + lerp(frame, LO, LO + 5, 0, -10) + "px)", opacity: lerp(frame, LO, LO + 5, 1, 0) } }, " " + nameLetters.slice(first.length + 1, typedN).join("")) : null,
        blink && frame < FLIP ? h("span", { key: "c", style: { display: "inline-block", width: 6, height: nmFs * 0.95, marginLeft: 3, background: ACCENT } }) : null]))
    : null;

  // 3. On the drop, her dark ground: « Votre » small and her trade big in pale, an accent block wiping in under it; what
  // she does on the hits, each word in its own accent block under her trade.
  const tradeText = trade ? keep(trade.text) : "";
  const trFs = wide ? 96 : Math.max(72, Math.min(132, Math.round(1400 / Math.max(6, tradeText.length))));
  const TY = at(0.36, 0.36);
  const tw = Math.min(840, tradeText.length * trFs * 0.58);
  const items = list ? String(list.text).split(/\s*[,;·|\/\n]\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 5) : [];
  const GAPS = [[0], [0, 6], [0, 4, 8], [0, 3, 6, 9], [0, 3, 6, 8, 10]][Math.max(0, items.length - 1)];
  const jobAt = GAPS.map((g) => Math.round(M("job", 165) + (g * mark("beat", 21.3)) / 4));
  const cur = items.length ? jobAt.reduce((c, f, i) => (frame >= f ? i : c), -1) : -1;
  const jFs = wide ? 56 : 64;
  const JY = TY + trFs * 1.45;
  const jw = cur >= 0 ? Math.min(800, items[cur].length * jFs * 0.6 + 56) : 0;
  const tradeOn = trade && frame >= DROP && frame < NAME;
  const tradeNode = tradeOn
    ? h("div", { key: "trade" },
        h("div", { key: "bar", style: abs({ left: Math.round(W / 2 - tw / 2), top: Math.round(TY + trFs * 0.98), height: Math.max(8, Math.round(trFs * 0.08)), width: Math.round(tw * lerp(frame, DROP, DROP + 8, 0, 1, EO)), background: ACCENT }) }),
        ton ? row(W / 2, TY - 82, 56, 500, PALE, keep(ton.text)) : null,
        row(W / 2, TY, trFs, 700, PALE, tradeText, { letterSpacing: "-0.03em" }),
        cur >= 0
          ? h("div", { key: "job-" + cur, style: abs({ left: Math.round(W / 2 - jw / 2), top: Math.round(JY), width: Math.round(jw), height: Math.round(jFs * 1.5), background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontWeight: 600, fontSize: jFs, lineHeight: 1, color: DARK, whiteSpace: "pre", clipPath: "inset(0 " + Math.round(lerp(frame, jobAt[cur], jobAt[cur] + 3, 100, 0)) + "% 0 0)" }) }, items[cur])
          : null)
    : null;
  // Her whole list, for the scene check.
  const listCopy = tradeOn && list ? h("div", { key: "lc", "data-fauve-decor": "", style: abs({ left: 140, top: JY, opacity: 0, fontSize: 20 }) }, list.text) : null;

  // 4. Her paper: her name on two lines, her last name bold, an accent rule under it; then her accent and her logo in
  // her dark (else her place's name in capitals); her card in option.
  const NX = wide ? Math.round(S.w * 0.18) : 140, NY = at(0.34, 0.36);
  const nFs = wide ? 84 : Math.max(80, Math.min(128, Math.round(5200 / Math.max(8, Math.max(first.length, rest.length) * 6))));
  const alone = nom && frame >= NAME && frame < LOGO
    ? h("div", { key: "alone" },
        row(NX, NY, nFs, 500, DARK, first, { letterSpacing: "-0.03em" }, true),
        rest ? row(NX, NY + nFs * 1.02, nFs, 700, DARK, rest, { letterSpacing: "-0.03em" }, true) : null,
        h("div", { key: "nrule", style: abs({ left: NX, top: Math.round(NY + nFs * (rest ? 2.22 : 1.2)), height: 10, width: Math.round(260 * lerp(frame, NAME, NAME + 10, 0, 1, EO)), background: ACCENT }) }))
    : null;
  const MID = at(0.5, 0.42);
  const logo = frame >= LOGO && frame < M("logo_out", 324) && frame < endAt
    ? brand.logoUrl
      ? h(Img, { key: "logo", src: brand.logoUrl, style: abs({ left: W / 2 - 160, top: MID - 70, width: 320, height: 140, objectFit: "contain", filter: "brightness(0)" }) })
      : h("div", { key: "logo" }, row(W / 2, MID - 34, 64, 700, DARK, keep(brand.name || first).toUpperCase(), { letterSpacing: "0.04em" }))
    : null;
  const card = (t, y, size, weight, align) => h(FitText, { style: abs({ left: 140, top: y, width: W - 280, height: size * 2.3 }), innerStyle: { fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.1, color: DARK, textAlign: "center", textWrap: "balance", justifyContent: align } }, keep(t));
  const ending = end && frame >= endAt ? h(React.Fragment, { key: "end" }, card(end.title, MID - 193, 84, 700, "flex-end"), end.subtitle ? card(end.subtitle, MID + 60, 50, 500, "flex-start") : null) : null;
  const used = [hello, nom, list, je, ton, trade];
  const extra = reelTexts.filter((t) => !used.includes(t) && frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: abs({ left: 140, width: W - 280, top: 160 + i * 120, height: 100 }), innerStyle: { fontFamily: font, fontWeight: 600, fontSize: 52, color: ground === DARK ? PALE : DARK, textAlign: "center" } }, t.text));

  return h(AbsoluteFill, { style: { backgroundColor: wide ? DARK : ground } },
    wide ? h("div", { style: { ...full, background: ground } }) : null,
    greeting, nameNode, her, im, tradeNode, listCopy, alone, logo, ending, extra);
}`;

export const silhouette: MontageSkill = {
  key: "silhouette",
  // 2: written again on its original's fiche. 3: nobody in profile in her shot: what the filler names there is cut out
  // in its place, the print's threshold from her shot's light. 4: its own design (Tristan: « trop similaire à la vidéo
  // originale »): its idea, its four bars on its music and its signature (her profile in one tone, a word in her head
  // that goes as she lowers it, her name typed behind her head) kept; the original's layout program, negative, hand of
  // dots, eye, almond, wavy line, clap, receding name and midnight logo left; her charter's colours (else its own),
  // her greeting stamped over an accent rule, her paper turning to her accent on the break, her trade in pale on her
  // dark on the drop, what she does in accent blocks, her name on two lines, her logo on her accent.
  version: 4,
  bpm: BPM,
  // Her profile, then a shot never seen (her trade, her name and her logo are drawn on flat colours).
  shots: [2, 2],
  files: [1, 4],
  how: "Une présentation en quatre temps sur ses couleurs : sur son papier, son salut se pose en grand lettre par lettre, un trait de sa couleur se tirant dessous ; coupe sur sa silhouette de profil, d'un seul ton foncé, « Je suis » dans sa tête, qui s'efface quand elle baisse la tête, son nom qui se tape derrière sa tête ; au break, le fond passe à sa couleur ; sur le drop, son métier en grand sur le foncé, ce qu'elle fait sur les coups, chaque mot dans un bloc de sa couleur ; puis son nom sur deux lignes, et son logo sur sa couleur.",
  end: true,
  texts: [
    { slot: "bonjour", role: "hook", want: "son salut, posé en grand au début : un mot court de 5 à 8 lettres (« Bonjour », « Salut », « Coucou ») ou son prénom", max: 10, required: true },
    { slot: "nom", role: "band", want: "son prénom et son nom (ou le nom de son lieu) : tapé derrière sa tête, le nom s'en va et le prénom reste, puis les deux sur deux lignes à la fin", max: 26, required: true },
    { slot: "choses", role: "band", want: "facultatif : 3 à 5 choses qu'elle fait, séparées par des virgules, un mot court chacune, qui passent sous son métier sur les coups (une forme comme « couleur, coupe, chignon, mariage »)", max: 60, required: false },
    { slot: "je", role: "caption", want: "les mots dans sa tête, juste avant son nom : « Je suis » (« On est » pour une équipe, « Voici » quand elle présente quelqu'un)", max: 9, required: true },
    { slot: "ton", role: "caption", want: "le petit mot au-dessus de son métier : « Votre » (ou « Ton », « Ta » selon son ton ; jamais un genre deviné)", max: 6, required: true },
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
      want: "le format : vertical plein écran, ou un cadre horizontal 16:9 au milieu sur des bandes foncées",
      choices: [
        { value: "auto", says: "vertical plein écran (tout est dessiné sur des aplats, sa vidéo recadrée autour de sa tête)" },
        { value: "horizontal", says: "un cadre 16:9 au milieu, sur des bandes foncées" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
  ],
  // Her head lowered and raised, measured on her video before it is cast (her passage starts just before she lowers it).
  reads: ["gestures"],
  // Flat colours that stay exact: no grade, no grain, no corners.
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
    const spans = beatSpans(bpm, [DROP, total - DROP]);
    const duration = spans.at(-1)!.end;
    // A light click on each letter of her greeting as its code stamps it; a breath rising into the drop.
    const units = typedLetters(options.words?.bonjour);
    const sounds: SkillSound[] = [
      ...letterFrames(units.length, f(STAMP_FROM), f(STAMP_TO)).map((fr) => ({ at: round3(fr / 30), ...CLICK })),
      { at: round3(f(DROP) / 30), ...RISER },
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({
        ...s,
        want:
          i === 0
            ? "elle (ou quelqu'un de son équipe) de profil, tête et épaules, devant un fond clair, le téléphone posé, à vitesse réelle : une vidéo de 5 s où elle regarde droit devant puis baisse vite la tête (penchée sur son travail), la garde baissée et la relève ; son passage commence quand elle regarde encore droit devant, 0,5 s avant qu'elle baisse la tête ; sa silhouette devient d'un seul ton foncé sur un fond clair (une photo de profil va aussi, figée). Personne de profil dans ses fichiers : celui où une seule chose de son métier se détache entière sur un fond clair (un bouquet, un vase, sa devanture), sa forme devient la silhouette"
            : "jamais vue (son métier, son nom et son logo sont dessinés sur des aplats par-dessus) : une autre de ses vidéos ou photos, ou la même vidéo à un autre moment",
      })),
      // Her greeting in the opening; « Je suis » in her head; her name from its typing to her logo; « Votre » and her
      // trade from the drop to her name; what she does on the hits.
      texts: {
        bonjour: { from: round(f(STAMP_FROM) / 30), to: round(f(CUT) / 30) },
        je: { from: round(f(CUT) / 30), to: round(f(CUT + 0.85) / 30) },
        nom: { from: round(f(CUT + NAME_TYPE) / 30), to: round(f(LOGO) / 30) },
        ton: { from: round(f(DROP) / 30), to: round(f(NAME) / 30) },
        metier: { from: round(f(DROP) / 30), to: round(f(NAME) / 30) },
        choses: { from: round(f(FIRST_JOB / 4) / 30), to: round(f(NAME) / 30) },
      },
      marks: {
        beat: Math.round(beat * 30 * 1000) / 1000,
        stamp_from: f(STAMP_FROM),
        stamp_to: f(STAMP_TO),
        cut: f(CUT),
        head_down: f(CUT + HEAD_DOWN),
        name_type: f(CUT + NAME_TYPE),
        last_out: f(CUT + LAST_OUT),
        flip: f(CUT + FLIP),
        drop: f(DROP),
        job: f(FIRST_JOB / 4),
        name: f(NAME),
        logo: f(LOGO),
        logo_out: f(LOGO + LOGO_HOLD),
      },
      sounds,
      // Her music's first strong beat on its first bar (the cut on her); on beat 3 of that bar it breaks, its last hit
      // ringing, until the drop, a little louder after it than before; it ends on its last hit (her logo's cut) with its
      // tail (the original's 1,4 s), or under her ending card, faded.
      music: {
        downbeat: round3(f(CUT) / 30),
        pauses: [{ from: round3(f(CUT + FLIP) / 30), to: round3(f(DROP) / 30), tail: 0.6 }],
        filters: [{ kind: "soft", from: 0, to: round3(f(CUT + FLIP) / 30), db: -2 }],
        end: end ? { at: duration, fade: 0.6 } : { at: round3(f(LOGO) / 30 + 0.1), tail: 1.4 },
      },
      // Her cut-out on her profile only (the shot never seen is never cut out).
      cutouts: [0],
    };
  },
  code: CODE,
};
