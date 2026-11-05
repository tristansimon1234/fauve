import type { EffectPiece } from "../pieces.ts";

// « Mot clé en grand », the effect (docs/fiches/mot-cle.md, effects 2, 3 and 8; its whole Reel is skills/mot-cle.ts,
// version 1): over her talking shot (she speaks to the camera, room above her head), the keyword of each idea she says
// slides in very big above her head on the instant she says it and stays until the next one (or the effect's end),
// while her other words are written one by one, small, on a line above it. Timed on what she says under it (`spoken`):
// its filler chooses its keywords among her words (mot1 … mot4, in the order she says them), and its code finds each one
// in what she says by its letters (accents, case and a plural's s aside), so it lands on the very image she says it.
// Kept from the model: the keyword's slide from the left (three images fast and blurred, 3,5 % past its place, 4 % back,
// set on the sixth: the original's « FONTS »), in bold capitals of her title font, 7,3 % of the height, centred; the
// small line of her words said, very spaced, in her text font, each word on the image it is said, laid out whole from
// its first word (it never moves), emptied at the end of its phrase, the keyword and the one-letter words left out; the
// one place above her head (from 20 to 34,4 % of the height, moved up when her head is higher, smaller when there is
// less room, before her chest only when nothing is left above her head, never on her face), read on her face as the
// engine followed it (`track(frame).faces`) once for each keyword over its whole span, so nothing moves while it is said;
// without a face followed, the upper third, the original's place; white on a dark or coloured wall, in ink on a light
// one (her wall's light under the block, LightUnder). A keyword not found in what she says lands on a beat, spread
// between the ones found. The engine's subtitles of what she says are not drawn by it. Left out: the model's hook, its
// list (two names at a time, each in the font it evokes: WORD_FONTS is a skill's filler's), its number in Anton with its
// words stacked, its cuts and its music (the montage's, around it), its low whoosh under each slide (a sound of its
// timeline cannot know when she says a word), its format setting (the montage frames her shot).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track, spoken }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const list = shots || [];
  // Its shots: those that play during it (her talk, maybe cut into pieces by the editor).
  const mine = list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const shotAt = (f) => { let k = mine.length ? mine[0] : -1; for (const i of mine) if (list[i].from <= f) k = i; return k; };
  const BEAT = mark("beat", 18);
  const display = "'" + brand.displayFont + "', 'Poppins', 'Montserrat', Arial, sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter', Arial, sans-serif";

  // 1. What she says under it: each word at its frame, and its letters alone (accents and case aside).
  const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const said = (Array.isArray(spoken) ? spoken : [])
    .filter((w) => w && typeof w.w === "string" && Number.isFinite(w.from))
    .map((w) => ({ w: w.w, from: Math.round(w.from), to: Math.round(Number.isFinite(w.to) ? w.to : w.from + 8), bare: plain(w.w) }))
    .sort((a, b) => a.from - b.from);
  const flat = [];
  said.forEach((w, i) => w.bare.split(" ").filter(Boolean).forEach((t) => flat.push({ t, i })));
  // A word she says is its keyword when their letters are the same, a plural's s or an elision aside.
  const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2);
  const findFrom = (tokens, start, used) => {
    for (let j = Math.max(0, start); j + tokens.length <= flat.length; j++) {
      let ok = true;
      for (let q = 0; q < tokens.length && ok; q++) ok = !used.has(flat[j + q].i) && same(flat[j + q].t, tokens[q]);
      if (ok) return j;
    }
    return -1;
  };

  // 2. Its keywords, in the order she says them, each on the image she says it (after the one before; else anywhere).
  const keys = ["mot1", "mot2", "mot3", "mot4"].map(word).filter(Boolean).map((text) => ({ text, tokens: plain(text).split(" ").filter(Boolean), words: [] }));
  const used = new Set();
  let cursor = 0;
  keys.forEach((key) => {
    if (!key.tokens.length) return;
    let j = findFrom(key.tokens, cursor, used);
    if (j < 0) j = findFrom(key.tokens, 0, used);
    if (j < 0) return;
    for (let q = 0; q < key.tokens.length; q++) { key.words.push(flat[j + q].i); used.add(flat[j + q].i); }
    key.at = said[flat[j].i].from;
    cursor = j + key.tokens.length;
  });
  // A keyword not found in what she says: on a beat, spread between the ones found (all over the effect when none is).
  const snap = (f) => Math.max(0, Math.round(f / BEAT) * BEAT);
  const found = keys.map((k, i) => (k.at !== undefined ? i : -1)).filter((i) => i >= 0);
  keys.forEach((key, k) => {
    if (key.at !== undefined) return;
    if (!found.length) { key.at = snap((k * D) / keys.length); return; }
    const a = found.filter((i) => i < k).pop();
    const b = found.find((i) => i > k);
    const ta = a === undefined ? 0 : keys[a].at;
    const tb = b === undefined ? D : keys[b].at;
    const ia = a === undefined ? -1 : a;
    const ib = b === undefined ? keys.length : b;
    key.at = snap(ta + ((tb - ta) * (k - ia)) / (ib - ia));
    if (a === undefined && b !== undefined && k === 0) key.at = 0;
  });
  // In time order, each held a beat at least (never under 0,6 s), the last ones that cannot be held left out.
  const HOLD = Math.max(18, Math.round(BEAT));
  const timed = keys.slice().sort((a, b) => a.at - b.at);
  const shown = [];
  timed.forEach((key) => {
    const at = Math.max(key.at, shown.length ? shown[shown.length - 1].at + HOLD : 0);
    if (at <= D - Math.round(HOLD / 2)) shown.push({ ...key, at: Math.round(at) });
  });
  shown.forEach((key, i) => { key.end = i + 1 < shown.length ? shown[i + 1].at : D; });

  // 3. Its windows: before its first keyword (her words alone), then each keyword to the next one.
  const windows = [];
  if (!shown.length || shown[0].at > 0) windows.push({ from: 0, to: shown.length ? shown[0].at : D, key: null });
  shown.forEach((key) => windows.push({ from: key.at, to: key.end, key }));
  const windowAt = (f) => { let w = windows[0]; for (const x of windows) if (x.from <= f) w = x; return w; };

  // 4. The one place above her head, the original's (from 20 to 34,4 % of the height, her head 10 % lower): moved up
  // when her head is higher, smaller when there is less room, before her chest when there is none; read on her face over
  // the whole window, so nothing moves while it is said; the upper third without a face followed.
  const TOP0 = 0.2 * H;
  const BOT0 = 0.344 * H;
  const ROOF = 0.052 * H;
  const SPAN = BOT0 - TOP0;
  const headAt = (f) => {
    if (typeof track !== "function") return null;
    const seen = track(f) || {};
    const faces = (seen.faces || []).filter((x) => x && x.width > 0 && x.height > 0);
    if (!faces.length) return null;
    const face = faces.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    return { top: face.y - face.height * 0.95, bottom: face.y + face.height * 0.75 };
  };
  const headOver = (from, to) => {
    let head = null;
    for (let f = Math.max(0, from); f < Math.min(D, Math.max(from + 1, to)); f += 6) {
      const x = headAt(f);
      if (x) head = head ? { top: Math.min(head.top, x.top), bottom: Math.max(head.bottom, x.bottom) } : x;
    }
    return head;
  };
  const placeFor = (head) => {
    const limit = head ? head.top - 0.035 * H : 0.42 * H;
    if (limit >= BOT0) return { top: TOP0, s: 1, low: false };
    if (limit - SPAN >= ROOF) return { top: limit - SPAN, s: 1, low: false };
    const s = (limit - ROOF) / SPAN;
    if (s >= 0.5) return { top: ROOF, s, low: false };
    const below = head ? head.bottom + 0.035 * H : 0.5 * H;
    return { top: Math.min(below, 0.66 * H - SPAN * 0.8), s: 0.8, low: true };
  };
  // White on a dark or coloured wall, in ink on a light one (her wall's light under the block, on the shot playing then).
  const inkFor = (place, f) => {
    const shot = shotAt(f);
    const box = { x: 140, y: Math.round(place.top), w: W - 280, h: Math.round(SPAN * place.s) };
    const light = shot >= 0 ? LightUnder(list[shot], f, { left: 0, top: 0, width: W, height: H }, box) : null;
    return light && light.mean > 0.58
      ? { color: "#161616", edge: "0 0 2px rgba(255,255,255,0.45)" }
      : { color: "#ffffff", edge: "0 0 2px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)" };
  };
  windows.forEach((w) => {
    w.place = placeFor(headOver(w.from, w.to));
    w.ink = inkFor(w.place, Math.min(D - 1, w.from + 3));
  });
  const Y = (p, y) => Math.round(p.top + (y * H - TOP0) * p.s);
  // A size in the block, smaller with it but never under its floor; below the middle, clear of the apps' buttons.
  const px = (v, floor) => Math.max(floor, Math.round(v));
  const side = (p) => (p.low ? 140 : 90);

  // 5. Her words said, one by one, on a small line above the keyword: very spaced small words, each on the image it is
  // said, the line laid out whole from its first word (it never moves), emptied at the end of its phrase; never across
  // two windows; its keywords and the one-letter words left out.
  const keyWords = new Set();
  shown.forEach((k) => k.words.forEach((i) => keyWords.add(i)));
  const GAP = Math.round(0.06 * W);
  const widthOf = (l) => l.reduce((a, w) => a + String(w.w).length * 27, 0) + Math.max(0, l.length - 1) * GAP;
  const lines = [];
  let line = [];
  let lineWindow = null;
  said.forEach((w, i) => {
    const prev = said[i - 1];
    const win = windowAt(w.from);
    const breaks = prev && (w.from - prev.to >= 10 || /[.!?…,;:]$/.test(String(prev.w)));
    if (line.length && (breaks || win !== lineWindow || line.length >= 5)) { lines.push({ words: line, win: lineWindow }); line = []; }
    if (keyWords.has(i) || String(w.w).replace(/[^\p{L}\p{N}]/gu, "").length <= 1) return;
    if (line.length && widthOf(line.concat([w])) > W - 2 * side(win.place)) { lines.push({ words: line, win: lineWindow }); line = []; }
    if (!line.length) lineWindow = win;
    line.push(w);
  });
  if (line.length) lines.push({ words: line, win: lineWindow });
  const lineNow = lines.find((l, i) => {
    const next = lines[i + 1];
    const until = Math.min(l.words[l.words.length - 1].to + 15, next ? next.words[0].from - 4 : Infinity, l.win.to);
    return frame >= l.words[0].from && frame < until;
  });

  // 6. A keyword slides in from the left as the original's: three images fast and blurred, past its place, back, set.
  const SLIDE = [-0.54, -0.35, -0.16, 0.035, -0.04];
  const BLUR = [22, 16, 9];
  const blurs = h("svg", { key: "blurs", width: 0, height: 0, style: { position: "absolute" } },
    BLUR.map((b) => h("filter", { key: b, id: "mkb" + b, x: "-40%", y: "-40%", width: "180%", height: "180%" }, h("feGaussianBlur", { stdDeviation: b + " 0" }))));
  const upper = (s) => String(s || "").toLocaleUpperCase("fr");
  const win = windowAt(frame);
  const place = win.place;
  const ink = win.ink;
  const laid = [];
  if (win.key) {
    const key = win.key;
    const t = frame - key.at;
    const dx = t >= 0 && t < SLIDE.length ? Math.round(SLIDE[t] * W) : 0;
    const blur = t >= 0 && t < BLUR.length ? BLUR[t] : 0;
    const top = Y(place, 0.266);
    const boxH = px(0.094 * H * place.s, 120);
    const size = px(0.073 * H * place.s, 96);
    const x = side(place);
    laid.push(h("div", { key: "key" + key.at, style: { position: "absolute", left: 0, top, width: W, height: boxH, transform: dx ? "translateX(" + dx + "px)" : undefined, filter: blur ? "url(#mkb" + blur + ")" : undefined } },
      h(FitText, { key: "fit-" + key.text, style: { position: "absolute", left: x, top: 0, width: W - 2 * x, height: boxH }, innerStyle: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: size, lineHeight: 1, letterSpacing: "0.005em", color: ink.color, textShadow: ink.edge, whiteSpace: "nowrap" } }, upper(key.text))));
  }
  if (lineNow) {
    const p = lineNow.win.place;
    const size = px(0.026 * H * p.s, 48);
    const x = side(p);
    laid.push(h("div", { key: "line" + lineNow.words[0].from, style: { position: "absolute", left: x, width: W - 2 * x, top: Y(p, 0.196), height: px(0.036 * H * p.s, 58), display: "flex", justifyContent: "center", alignItems: "flex-end", gap: Math.round(GAP * Math.min(1, p.s + 0.2)) } },
      lineNow.words.map((w, j) => h("span", { key: j, style: { fontFamily: body, fontWeight: 400, fontSize: size, lineHeight: 1.2, color: lineNow.win.ink.color, textShadow: lineNow.win.ink.edge, whiteSpace: "nowrap", opacity: frame >= w.from ? 1 : 0 } }, String(w.w).replace(/[.!?…,;:]+$/, "")))));
  }
  return h(AbsoluteFill, null, blurs, laid);
}`;

export const motCle: EffectPiece = {
  key: "mot-cle",
  version: 1,
  name: "Mot clé en grand",
  how: "pendant qu'elle parle face caméra, le mot clé de chaque idée glisse de la gauche en très grand au-dessus de sa tête à l'instant où elle le dit, et reste jusqu'au mot clé suivant ; ses autres mots s'écrivent un à un en petit sur une ligne au-dessus de lui ; au-dessus de sa tête, devant son buste quand il n'y a pas la place, jamais sur son visage ; puis le montage reprend.",
  needs: "une vidéo d'elle (ou de quelqu'un de l'équipe) qui parle face caméra devant un mur uni, avec de la place au-dessus de sa tête, et des idées qu'un mot résume dans ce qu'elle dit (un produit, une prestation, un chiffre).",
  lays: "sur son plan face caméra pendant qu'elle dit une à quatre idées, ce plan seul ou ses morceaux coupés par le monteur",
  shots: [1, 6],
  seconds: [2, 12],
  require: { files: 1, shot: { framing: ["medium", "close", "wide"], person: true, video: true } },
  spoken: true,
  texts: [
    {
      slot: "mot1",
      want: "le mot clé de la première idée qu'elle dit, tel qu'elle le dit, un ou deux mots (une forme comme « soins », « brushing », « croissant », « 20 ans ») : il s'écrit en très grand au-dessus de sa tête à l'instant où elle le dit",
      max: 12,
      required: true,
    },
    { slot: "mot2", want: "facultatif : le mot clé de l'idée suivante, tel qu'elle le dit, après le précédent", max: 12, required: false },
    { slot: "mot3", want: "facultatif : le mot clé de l'idée d'après, tel qu'elle le dit, après le précédent", max: 12, required: false },
    { slot: "mot4", want: "facultatif : le mot clé de la dernière idée, tel qu'elle le dit, après le précédent", max: 12, required: false },
  ],
  code: CODE,
};
