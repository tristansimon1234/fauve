import { nominalSaid, type MontageSkill, type SkillSaid, type SkillSound } from "../skills.ts";

// « Ton produit raconté », version 1, written on its original's fiche (docs/fiches/carnet.md: measured image by image at
// 30 i/s, each text's box and instant, its round window on black and its jump, its cuts on his words, its sound by bands;
// Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A creator presents the one
// thing he makes his work with, talking: his voice runs all along over his pictures of it, cut on his words, and his face
// is seen only once, in a round of light on black. Timed on her voice (SkillVoice) like « Mot clé en grand » and « Face
// caméra et références », but what those two never do: her voice over her pictures (her talking video under them,
// heard, never seen but in the window), the window itself, her words typed and laid as they mean. Idea by idea:
//   her first idea     her words before the name of what she presents, small, one by one at their final places on a
//                      centred line (the original's « this is my », every 5 images), then its name very big right under
//                      them on the instant she says it (« notebook », 81 % of the width), over her first picture of it;
//                      her second picture of it in the round of light on black (the original's spotlit notebook);
//   a number           typed digit by digit at its final place (« 1 », « 16 », « 168 », 17,5 % of the height), its unit
//                      small under it, then the rest of her phrase one word at a time in the middle, alone (« of »,
//                      « pure », « creative », « sparks »), her pictures cut on its words;
//   her window         0,3 s of black, then at once her face in a lit ellipse on black (49,4 % of the width, 1,36 times
//                      as tall, its edge falling into the black), her subtitles under it; on the first word of her last
//                      phrase the same picture 1,61 times closer in one image (the original's jump), to the cut;
//   a question         its words around her object in the middle, each on the instant she says it (the first big at the
//                      top left, the second under it on the right, a short one low on the left, the last across under
//                      the object), one more picture of her object on each word with a soft thud (the original's
//                      notebooks stacked), then « ? » alone in the middle;
//   her other ideas    her pictures in turn, cut on her words; a name she cites, its picture from the instant she says it;
//                      an idea without pictures after the window, her talking video;
//   her subtitles      small white bold, a short phrase at a time, at the bottom of the safe zone, never while its big
//                      words show; at the end, 0,6 s of black.
// Its music: a soft lofi bed at 90 BPM under her voice (the original's weak pulse, 89,8), stopped with the black.
// Her vertical video full frame (as the original); filmed in width, her pictures whole in a 16:9 band on black (the
// `format` setting). Nothing of the original's own words or its notebooks' brand is copied: her words, her object.

const BPM = 90;
const FPS = 30;
const frames = (s: number) => Math.round(s * FPS);
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** Its ending: black 4 images after her last word (the original's 0,67 s of it), its music stopped with it. */
const BLACK_AFTER = 0.12;
const TAIL = 0.3;
/** Its window: black that long at most before it (the original's 10 images), shown 4 images into her first word. */
const WINDOW_BLACK = 0.33;
const WINDOW_INTO = 0.13;
/** A thud under each picture of her object laid on the question's words (the original's notebooks on the stack). */
const THUD = { sound: "soft thud of a notebook laid on a table", seconds: 0.5, gain: -8 };

/** What each idea is laid as (its code reads them as `kind1`, `kind2`…). */
export const KIND = { name: 0, pictures: 1, number: 2, question: 3, window: 4, face: 5 } as const;

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/**
 * Each idea's layout, from what the filler chose: her first idea presents (its name very big); an idea whose keyword is a
 * number types it; a question with her pictures is laid around her object; the first idea without pictures (never the
 * first) is her window on black, the next ones her talking video; the others, her pictures cut on her words.
 */
export function carnetKinds(said: Pick<SkillSaid, "ideas" | "refs">): number[] {
  let window = false;
  return said.ideas.map((idea, k) => {
    if (k === 0) return KIND.name;
    const pictures = said.refs.some((r) => r.idea === k);
    if (/\d/.test(idea.text)) return KIND.number;
    if (pictures && /\?\s*$/.test(idea.text)) return KIND.question;
    if (pictures) return KIND.pictures;
    if (!window) {
      window = true;
      return KIND.window;
    }
    return KIND.face;
  });
}

/** When she says each word of her question (s, on the Reel's clock): found by its letters from its keyword on, else a beat of 0,27 s after the one before. */
export function questionTimes(said: Pick<SkillSaid, "words" | "ideas">, k: number): number[] {
  const idea = said.ideas[k]!;
  const asked = idea.text
    .replace(/[?¿]/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  const last = Math.min(said.words.length - 1, idea.words[1]);
  let from = Math.max(idea.words[0], Math.min(idea.key, last));
  const times: number[] = [];
  for (const w of asked) {
    let found = -1;
    for (let j = from; j <= last; j++) if (plain(said.words[j]!.w) === plain(w)) { found = j; break; }
    if (found >= 0) {
      times.push(said.words[found]!.start);
      from = found + 1;
    } else times.push(round3((times.at(-1) ?? idea.at) + (times.length ? 0.27 : 0)));
  }
  return times;
}

/**
 * Its window's moments (s): black from just after the idea before it ends, its round shown 4 images into her first
 * word, and its punch on the first word of her last phrase there when it comes 1,2 s after it is shown and 0,8 s before
 * it ends (else, on a long one, the word nearest 62 % of it; else none).
 */
export function windowMoments(said: Pick<SkillSaid, "words" | "ideas">, k: number): { black: number; from: number; punch: number | null } {
  const idea = said.ideas[k]!;
  const before = said.ideas[k - 1];
  let from = idea.from + WINDOW_INTO;
  const black = Math.max(before ? before.to + 0.03 : 0, from - WINDOW_BLACK);
  if (from - black < 0.2) from = black + 0.2;
  const ws = said.words.slice(idea.words[0], idea.words[1] + 1);
  const phrases = ws.filter((w, i) => i === 0 || w.start - ws[i - 1]!.end >= 0.25 || /[.!?…]$/.test(ws[i - 1]!.w));
  const lastPhrase = phrases.at(-1);
  let punch: number | null = null;
  if (phrases.length >= 2 && lastPhrase && lastPhrase.start - from >= 1.2 && idea.to - lastPhrase.start >= 0.8) punch = lastPhrase.start;
  else if (idea.to - from >= 3) {
    const aim = from + 0.62 * (idea.to - from);
    punch = ws.reduce((a, b) => (Math.abs(b.start - aim) < Math.abs(a.start - aim) ? b : a)).start;
  }
  return { black: round3(black), from: round3(from), punch: punch === null ? null : round3(punch) };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, texts, track, spoken }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = durationInFrames;
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const talkN = Math.max(1, Math.min(shots.length, Math.round(mark("said_shots", shots.length))));
  const refsN = Math.max(0, Math.min(shots.length - talkN, Math.round(mark("said_refs", 0))));
  const shotAt = (f) => { let k = 0; for (let i = 0; i < talkN; i++) if (shots[i].from <= f) k = i; return k; };
  const cur = shotAt(frame);
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Inter', Arial, sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', Arial, sans-serif";
  const said = (spoken || []).filter((w) => w && typeof w.w === "string" && w.w.trim() && Number.isFinite(w.from));
  const box = (b) => ({ position: "absolute", left: Math.round(b.left), top: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) });
  const FULL = { left: 0, top: 0, width: W, height: H };
  // White words with a tight dark edge, so they read on any picture of hers (the original's are white on its own).
  const EDGE = "0 2px 3px rgba(0,0,0,0.38), 0 0 1px rgba(0,0,0,0.45)";
  // Its big words in lowercase as she says them (a word of her business's name keeps its capitals).
  const hers = String(brand.name || "").split(/\s+/);
  const low = (s) => String(s || "").split(/(\s+)/).map((w) => (hers.indexOf(w) < 0 && /^\p{Lu}[\p{Ll}'’-]*$/u.test(w) ? w.toLowerCase() : w)).join("");
  const bare = (s) => String(s || "").replace(/[.,;:!?…]+$/, "");

  // 1. Its frame: as her talking video (upright: full frame, as the original; filmed in width: her pictures whole in a
  // 16:9 band on black), or as her words ask. The window is the same in both.
  const format = setting("format", "auto");
  const wideTalk = (Number(shots[0] && shots[0].aspect) || 0.5625) > 1.15;
  const banded = format === "horizontal" || (format === "auto" && wideTalk);
  const BAND = { left: 0, top: Math.round((H - (W * 9) / 16) / 2), width: W, height: Math.round((W * 9) / 16) };
  const PIC = banded ? BAND : FULL;

  // 2. Her ideas (the engine's marks, in frames) and what each one is laid as (its timeline's kinds).
  const ideas = [];
  for (let i = 1; i <= Math.round(mark("said_ideas", 0)); i++) ideas.push({ k: i, from: mark("said_idea" + i + "_from", 0), to: mark("said_idea" + i + "_to", 0), kind: Math.round(mark("kind" + i, i === 1 ? 0 : 1)) });
  ideas.forEach((x, i) => { x.start = i === 0 ? 0 : x.from; });
  ideas.forEach((x, i) => { x.end = i + 1 < ideas.length ? ideas[i + 1].start : D; });
  let idea = null;
  for (const x of ideas) if (x.start <= frame) idea = x;
  const kind = idea ? idea.kind : 1;
  const bands = reelTexts.filter((t) => t.role === "band");
  const captions = reelTexts.filter((t) => t.role === "caption");
  const inIdea = (t, x) => Boolean(x) && t.from >= x.start - 1 && t.from < x.end;
  const keyOf = (x) => bands.find((t) => inIdea(t, x)) || null;

  // 3. Her pictures of what she says (after her talk's shots): an idea's own ones in turn, cut on her words (on each word
  // of her question, one more picture of her object), a name's from the instant she says it.
  const refs = [];
  for (let i = 0; i < refsN; i++) {
    const s = shots[talkN + i];
    const from = mark("said_ref" + (i + 1) + "_from", s.from);
    refs.push({ i: talkN + i, idea: Math.round(mark("said_ref" + (i + 1) + "_idea", 0)), item: Math.round(mark("said_ref" + (i + 1) + "_item", 0)), from, to: mark("said_ref" + (i + 1) + "_to", from + s.durationInFrames), shot: s });
  }
  const turns = (x) => {
    const group = refs.filter((r) => r.item === 0 && r.idea === x.k);
    if (!group.length) return [];
    const a = group[0].from;
    const b = group[0].to;
    const m = group.length;
    const points = [];
    if (x.kind === 3) {
      for (let j = 2; j <= Math.round(mark("q" + x.k + "_count", 0)) && points.length < m - 1; j++) {
        const q = Math.round(mark("q" + x.k + "_" + j, -1));
        if (q > (points.length ? points[points.length - 1] : a) + 3 && q < b - 3) points.push(q);
      }
    } else {
      const onWords = said.map((w) => Math.round(w.from)).filter((q) => q > a + 5 && q < b - 5);
      let prev = a;
      for (let j = 1; j < m; j++) {
        const ideal = a + ((b - a) * j) / m;
        let best = null;
        for (const q of onWords) if (q >= prev + 6 && q <= b - 6 && (best === null || Math.abs(q - ideal) < Math.abs(best - ideal))) best = q;
        const p = best !== null && Math.abs(best - ideal) <= (b - a) / m / 2 ? best : Math.round(ideal);
        if (p >= prev + 6 && p <= b - 6) { points.push(p); prev = p; }
      }
    }
    // Her first idea: its first picture under its name until the name goes, the others after it when there is room (the
    // original's beauty shots after « notebook »), each 4 images at least (its quickest); else its first one alone.
    const name = x.kind === 0 ? keyOf(x) : null;
    if (name && m > 1 && name.to > a + 6) {
      // The first one after it lies under the round of light, 9 images at least when there is room (the original's 14).
      const room = b - name.to;
      const rest = room < 4 ? 0 : Math.min(m - 1, room < 13 ? 1 : 1 + Math.floor((room - 9) / 4));
      const lit = rest > 1 ? Math.max(9, Math.round(room / rest)) : room;
      points.length = 0;
      if (rest >= 1) points.push(Math.round(name.to));
      for (let j = 1; j < rest; j++) points.push(Math.round(name.to + lit + ((room - lit) * (j - 1)) / (rest - 1)));
    }
    const cuts = [a].concat(points, [b]);
    return cuts.slice(0, -1).map((q, j) => ({ r: group[Math.min(j, m - 1)], j, from: q, to: cuts[j + 1] }));
  };
  // Every idea's turns, on their pictures' own spans (an idea's pictures may start a few images before its first word, on
  // a cut of her pauses).
  const turnsAll = ideas.flatMap((x) => turns(x));
  const turn = turnsAll.find((p) => frame >= p.from && frame < p.to) || null;
  const cited = refs.find((r) => r.item > 0 && frame >= r.from && frame < r.to) || null;
  // Under a round of light (the original's spotlit notebook): the first picture after her first idea's name, of that
  // idea or of the next when it is one of pictures, within a second of it.
  const key1 = ideas.length ? keyOf(ideas[0]) : null;
  const spot = key1 ? turnsAll.find((p) => p.from >= key1.to - 1 && p.r.idea <= 2 && ideas[p.r.idea - 1] && ideas[p.r.idea - 1].kind <= 1) || null : null;
  const litTurn = spot && spot.from <= key1.to + 30 ? spot : null;

  // 4. The window: a round of light on black, an ellipse 49,4 % of the width and 1,36 times as tall (the original's spot
  // on the floor), its edge falling into the black; after its punch, the same picture 1,61 times closer.
  const DW = 0.494;
  const RATIO = 1.36;
  const PUNCH = 1.61;
  const discBox = (punched) => {
    const dw = W * DW * (punched ? PUNCH : 1);
    const dh = dw * RATIO;
    const cx = W * (punched ? 0.515 : 0.505);
    const cy = H * (punched ? 0.47 : 0.46);
    return { left: cx - dw / 2, top: cy - dh / 2, width: dw, height: dh };
  };
  const disc = (inner, punched, key) => {
    const b = discBox(punched);
    return h("div", { key, style: { ...box(b), borderRadius: "50%", overflow: "hidden", backgroundColor: "#000000" } }, inner(b),
      h("div", { key: "rim", style: { ...box({ left: 0, top: 0, width: b.width, height: b.height }), background: "radial-gradient(closest-side, rgba(0,0,0,0) 82%, rgba(0,0,0,0.5) 94%, rgba(0,0,0,0.92) 100%)" } }));
  };
  // Her face as the engine follows it, read once over her window's idea: the window centred on it, her face 42 % of it.
  const win = ideas.find((x) => x.kind === 4) || null;
  const face = React.useMemo(() => {
    if (!win || typeof track !== "function") return null;
    const xs = [];
    const ys = [];
    const ws = [];
    for (let f = Math.round(win.start); f < Math.round(win.end); f += 6) {
      const seen = track(f, { shot: shotAt(f), left: 0, top: 0, width: W, height: H }) || {};
      const fs = (seen.faces || []).filter((q) => q && q.width > 0 && Number.isFinite(q.x) && Number.isFinite(q.y));
      if (!fs.length) continue;
      const q = fs.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
      xs.push(q.x);
      ys.push(q.y);
      ws.push(q.width);
    }
    if (!xs.length) return null;
    const mid = (a) => a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)];
    return { x: mid(xs), y: mid(ys), w: mid(ws) };
  }, [track, win ? win.start : -1, win ? win.end : -1]);
  const herIn = (punched) => (b) => {
    const q = face || { x: W * 0.5, y: H * 0.38, w: W * 0.36 };
    let s = Math.max(0.5, Math.min(2.4, (W * DW * 0.42) / Math.max(1, q.w))) * (punched ? PUNCH : 1);
    s = Math.max(s, b.width / W, b.height / H);
    const left = Math.min(0, Math.max(b.width - W * s, b.width / 2 - q.x * s));
    const top = Math.min(0, Math.max(b.height - H * s, b.height / 2 - q.y * s));
    return h(Footage, { key: "her", shot: cur, style: box({ left, top, width: W * s, height: H * s }) });
  };
  // A picture of her object in the same round of light: framed on its subject, a little larger than the round.
  const picIn = (r) => (b) => h(Footage, { key: "pic", shot: r.i, at: r.shot.from, style: box({ left: -b.width * 0.08, top: -b.height * 0.08, width: b.width * 1.16, height: b.height * 1.16 }) });

  // 5. What plays: black before the window and after her last word; her window; a picture of hers; else her talk.
  const winBlack = Math.round(mark("win_black", -1));
  const winFrom = Math.round(mark("win_from", -1));
  const winPunch = Math.round(mark("win_punch", 0));
  const inBlack = Boolean(win) && winBlack >= 0 && frame >= winBlack && frame < winFrom;
  const endFrom = Math.round(mark("said_end", D) + mark("black_after", 6));
  const ending = D - endFrom >= 8 && frame >= endFrom;
  const layers = [];
  if (inBlack || ending) {
    // Nothing: black.
  } else if (kind === 4) {
    const punched = winPunch > 0 && frame >= winPunch;
    layers.push(disc(herIn(punched), punched, punched ? "win-p" : "win"));
  } else if (cited) {
    layers.push(h(Footage, { key: "c" + cited.i, shot: cited.i, at: cited.shot.from, style: box(PIC) }));
  } else if (turn) {
    const lit = litTurn && litTurn.r.i === turn.r.i && litTurn.from === turn.from;
    layers.push(lit ? disc(picIn(turn.r), false, "spot") : h(Footage, { key: "p" + turn.r.i, shot: turn.r.i, at: turn.r.shot.from, style: box(PIC) }));
  } else {
    layers.push(h(Footage, { key: "t" + cur, shot: cur, style: box(PIC) }));
  }

  // 6. Its big words: very bold lowercase, white, one place each (keyed by their words: a FitText measures once).
  // (A tight line box, so a short word keeps its size; each one between x 140 and 940 when it reaches below the middle.)
  const big = (key, text, b, size, extra) => h(FitText, { key, style: box(b), innerStyle: Object.assign({ fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: Math.round(size), lineHeight: 0.92, letterSpacing: "-0.03em", color: "#ffffff", textShadow: EDGE, whiteSpace: "nowrap" }, extra || {}) }, text);
  // While they show, no subtitles: from her first idea's start to its name's end, a number's or a question's whole idea.
  const quiet = (f) => {
    const x = ideas.find((y) => f >= y.start && f < y.end);
    if (!x) return false;
    if (x.kind === 2 || x.kind === 3) return true;
    const key = x.k === 1 ? keyOf(x) : null;
    return Boolean(key) && f < key.to;
  };
  if (idea && idea.k === 1 && !inBlack && !ending) {
    const key = keyOf(idea);
    if (key && frame < key.to) {
      // Her words before it, small, at their final places on one centred line, each on the image she says it (four at most).
      const before = said.filter((w) => w.from >= idea.start - 1 && w.from < key.from - 1);
      const line = [];
      for (let i = before.length - 1; i >= 0 && line.length < 4; i--) {
        if ([before[i].w].concat(line.map((x) => x.w)).join(" ").length > 24 && line.length) break;
        line.unshift(before[i]);
      }
      if (line.length && frame < key.to - 4) layers.push(h("div", { key: "small", style: { ...box({ left: 60, top: H * 0.414, width: W - 120, height: H * 0.046 }), display: "flex", justifyContent: "center", alignItems: "flex-end", gap: Math.round(H * 0.009) } },
        line.map((w, j) => h("span", { key: j, style: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: Math.round(H * 0.029), lineHeight: 1.1, letterSpacing: "-0.02em", color: "#ffffff", textShadow: EDGE, whiteSpace: "nowrap", opacity: frame >= w.from ? 1 : 0 } }, low(bare(w.w))))));
      // Then the name of what she presents, very big right under them, on the instant she says it: as wide as it goes in
      // 800 px (the original's « notebook », 8 letters, at 81 % of the width), 17 % of the height at most, hugging the line.
      if (frame >= key.from) layers.push(big("name" + key.text, low(key.text), { left: 140, top: H * 0.462, width: W - 280, height: H * 0.17 }, H * 0.17, { justifyContent: "flex-start" }));
    }
  }
  if (idea && kind === 2 && !inBlack && !ending) {
    const key = keyOf(idea);
    if (key && frame >= key.from && frame < key.to) {
      // Her number typed digit by digit at its final place, its unit small under it.
      const s = String(key.text);
      const typed = 1 + Math.floor((frame - key.from) / 4.5);
      let n = 0;
      const parts = s.split("").map((ch, i) => { const shown = ch === " " || n < typed; if (ch !== " ") n++; return h("span", { key: i, style: shown ? {} : { color: "rgba(255,255,255,0)", textShadow: "none" } }, ch); });
      // (One span: FitText lays its children out in a column.)
      // (Its digits 17,5 % of the height, the original's « 168 ».)
      layers.push(big("num" + s, h("span", null, parts), { left: 140, top: H * 0.37, width: W - 280, height: H * 0.25 }, H * 0.245, { letterSpacing: "-0.04em" }));
      const unit = captions.filter((t) => inIdea(t, idea) && frame >= t.from && frame < t.to).map((t) => t.text).join(" ");
      if (unit) layers.push(big("unit" + unit, low(unit), { left: 140, top: H * 0.635, width: W - 280, height: H * 0.04 }, H * 0.029, { fontWeight: 700, letterSpacing: "0em" }));
    } else if (key && frame >= key.to) {
      // Then the rest of her phrase one word at a time in the middle, each alone.
      const rest = said.filter((w) => w.from >= key.to - 2 && w.from < idea.end);
      const w = rest.find((x, i) => frame >= x.from && frame < (rest[i + 1] ? rest[i + 1].from : x.to + 12));
      if (w) layers.push(big("one" + w.from + w.w, low(bare(w.w)), { left: 140, top: H * 0.6, width: W - 280, height: H * 0.05 }, H * 0.031));
    }
  }
  if (idea && kind === 3 && !inBlack && !ending) {
    const key = keyOf(idea);
    if (key) {
      // Its words around her object, each on the instant she says it: the first big at the top left, the second under it
      // on the right, a short one low on the left, the last across under the object; then « ? » alone in the middle.
      const ws = String(key.text).replace(/[?¿]/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
      const n = ws.length;
      const firsts = n <= 4 ? ws.map((_, j) => j) : [0, 1, n - 2, n - 1];
      const groups = firsts.map((j, g) => ws.slice(j, g + 1 < firsts.length ? firsts[g + 1] : n).join(" "));
      const slots = n <= 1 ? [3] : n === 2 ? [0, 3] : n === 3 ? [0, 1, 3] : [0, 1, 2, 3];
      const BOXES = [
        { left: W * 0.11, top: H * 0.118, width: W * 0.7, height: H * 0.15, size: H * 0.14 },
        { left: W * 0.45, top: H * 0.262, width: W * 0.44, height: H * 0.1, size: H * 0.115 },
        { left: W * 0.13, top: H * 0.585, width: W * 0.22, height: H * 0.075, size: H * 0.095 },
        { left: 140, top: H * 0.652, width: W - 280, height: H * 0.092, size: H * 0.105 },
      ];
      let last = key.from;
      groups.forEach((g, j) => {
        const at = Math.round(mark("q" + idea.k + "_" + (firsts[j] + 1), key.from + firsts[j] * 8));
        last = Math.max(last, at);
        const b = BOXES[slots[j]];
        if (frame >= at && frame < idea.end) layers.push(big("q" + j + g, low(g), b, b.size));
      });
      if (frame >= last + 9 && frame < idea.end) layers.push(big("qmark", "?", { left: W * 0.42, top: H * 0.448, width: W * 0.16, height: H * 0.085 }, H * 0.08));
    }
  }

  // 7. What she says, small and bold, a short phrase at a time at the bottom of the safe zone (under her window), never
  // while its big words show, nor in the black: her phrases (a pause, a sentence's end, a comma), a long one halved where
  // its two halves are most even, never after a short word (« à », « le », « mon »), 26 characters at most.
  const phrases = [];
  let c = [];
  said.forEach((w, i) => {
    const prev = said[i - 1];
    if (prev && c.length && (w.from - prev.to >= 9 || /[.!?…;:]$/.test(prev.w) || (/,$/.test(prev.w) && c.length >= 2))) { phrases.push(c); c = []; }
    c.push(w);
  });
  if (c.length) phrases.push(c);
  const chunks = [];
  const len = (ws) => ws.map((x) => x.w).join(" ").length;
  const halve = (ws) => {
    if (len(ws) <= 26 || ws.length < 2) { chunks.push(ws); return; }
    let best = -1;
    for (let k = 1; k < ws.length; k++) {
      if (/^[^.,;:!?…]{1,3}$/.test(ws[k - 1].w)) continue;
      if (best < 0 || Math.abs(len(ws.slice(0, k)) - len(ws.slice(k))) < Math.abs(len(ws.slice(0, best)) - len(ws.slice(best)))) best = k;
    }
    if (best < 0) best = Math.ceil(ws.length / 2);
    halve(ws.slice(0, best));
    halve(ws.slice(best));
  };
  phrases.forEach(halve);
  const sub = inBlack || ending || quiet(frame) ? null : chunks.find((x, i) => !quiet(x[0].from) && frame >= x[0].from && frame < Math.min(x[x.length - 1].to + 10, chunks[i + 1] ? chunks[i + 1][0].from : Infinity));
  if (sub) {
    const t = sub.map((w) => w.w).join(" ");
    layers.push(h(FitText, { key: "sub" + sub[0].from + t, style: box({ left: 140, top: H * 0.692, width: W - 280, height: H * 0.05 }), innerStyle: { fontFamily: body, fontWeight: 700, fontSize: Math.round(H * 0.0272), lineHeight: 1.1, color: "#ffffff", textShadow: EDGE, whiteSpace: "nowrap" } }, t));
  }

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, layers);
}`;

export const carnet: MontageSkill = {
  key: "carnet",
  version: 1,
  // Its original's weak pulse (89,8 BPM, its music under his voice): her music is composed at it, her voice leads its cuts.
  bpm: BPM,
  // Her talk's pieces (the engine cuts them): as many as her pauses and ideas make.
  shots: [1, 40],
  // Her talking video and at least one picture of what she presents; up to eleven.
  files: [2, 12],
  how: "Elle présente en parlant la chose qu'elle fait ou qu'elle vend (un produit, une pièce, un outil) : sa voix court sur ses photos et vidéos de cette chose, coupées sur ses mots ; ses premiers mots s'écrivent un à un en petit, puis le nom de ce qu'elle présente en très grand dessous au moment où elle le dit, puis sa chose sous un rond de lumière sur du noir ; un chiffre qu'elle dit se tape chiffre à chiffre en très grand, puis la suite de sa phrase mot à mot au milieu ; une seule fois, son visage dans un hublot rond sur du noir pendant qu'elle dit ce qu'elle en pense, qui se rapproche d'un coup sur sa dernière phrase ; une question qu'elle pose s'écrit en grand autour de sa chose, un mot à la fois, puis un « ? » seul ; de petits sous-titres le reste du temps ; un peu de noir à la fin.",
  end: false,
  texts: [],
  voice: {
    key: "pour sa première idée, le nom de ce qu'elle présente, dit dans sa première phrase, tel qu'elle le dit (« carnet », « croissant », « vase ») : il s'écrit en très grand ; pour une idée qui dit un chiffre (« 168 pages », « douze heures »), ce chiffre écrit en chiffres (« 168 », « 12 ») ; pour une idée qui pose une question, sa question entière telle qu'elle la dit, avec son point d'interrogation (« pourquoi un carnet ? ») ; sinon le mot qui porte l'idée (il ne s'écrit pas : il sépare ses idées)",
    ideas: [2, 8],
    items: "pour l'idée d'un chiffre, le mot (ou les deux) qui dit ce qu'il compte, tel qu'elle le dit (« pages », « heures ») ; pour une liste qu'elle dit (ses pièces, ses produits l'un après l'autre), chaque nom au moment où elle le dit, avec l'image de ses fichiers qui le montre",
    max: { key: 32, item: 18 },
    // The picture changes on the first word of each idea (the original cuts its pictures on his words).
    cut: "attack",
    refs: "ses photos et vidéos de ce qu'elle présente (la chose tenue face à l'objectif, posée seule sur un fond uni vu de dessus, ses détails de tout près, ses mains qui la font ou s'en servent, son lieu) : deux à huit pour chaque idée, qui défilent sur ses mots (pour sa première idée, au moins trois, la deuxième passe sous un rond de lumière), plusieurs de la même chose sur le même fond pour l'idée d'une question ; aucune pour une idée du milieu, celle où elle dit ce qu'elle en pense ou ce qu'elle aime : son visage y passe dans un hublot rond sur du noir",
    subtitles: "own",
    // One frame of her all along: its window frames her itself.
    angles: false,
  },
  settings: [
    {
      name: "format",
      want: "le format : comme sa vidéo, vertical plein écran, ou ses images entières dans une bande horizontale",
      choices: [
        { value: "auto", says: "comme sa vidéo où elle parle : verticale, tout en plein écran comme l'original ; filmée en largeur, ses images entières dans une bande 16:9 sur du noir" },
        { value: "vertical", says: "tout en plein écran vertical, ses images horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "ses images entières dans une bande 16:9 au milieu, sur du noir, les mots autour" },
      ],
    },
  ],
  // Its blacks stay black (its window, its ending): no fade, no grain on them, no dark corners over her pictures.
  finish: { fade: 0, grain: 0, vignette: 0 },
  timeline(n, { said: given }) {
    const said = given ?? nominalSaid(n, { angles: false });
    const kinds = carnetKinds(said);
    const texts: Record<string, { from: number; to: number }> = {};
    const marks: Record<string, number> = Object.fromEntries(kinds.map((kind, k) => [`kind${k + 1}`, kind]));
    const sounds: SkillSound[] = [];
    const ownRefs = (k: number) => said.refs.filter((r) => r.idea === k && r.item === 0).length;
    said.ideas.forEach((idea, k) => {
      const slot = `idee${k + 1}`;
      const next = said.ideas[k + 1];
      const end = next ? next.from : said.duration;
      const kind = kinds[k]!;
      if (kind === KIND.name) {
        // The name very big from the instant she says it, 0,7 s at least, never into her next idea.
        const spoken = said.words[idea.key]!;
        const to = Math.min(Math.max(idea.at + 0.7, spoken.end + 0.25), idea.to + 0.1, next ? next.from - 0.05 : said.duration);
        texts[slot] = { from: round(idea.at), to: round(Math.max(idea.at + 0.4, to)) };
      } else if (kind === KIND.number) {
        // Typed and held with its unit until its unit is said (the original's « 168 » and « pages » gone with « pages »),
        // 0,9 s at least to be read (the words she says meanwhile are not written), within its idea.
        const lastWord = idea.items.length ? Math.max(...idea.items.map((i) => i.word)) : idea.key;
        const hold = round(Math.min(end, Math.max(idea.at + 0.9, said.words[lastWord]!.end + 0.05)));
        texts[slot] = { from: round(idea.at), to: hold };
        idea.items.forEach((item, j) => (texts[`${slot}_${j + 1}`] = { from: round(Math.min(item.at, hold - 0.1)), to: hold }));
      } else if (kind === KIND.question) {
        // Its words around her object, each on its instant, held with « ? » to the next idea; a thud as each picture of
        // her object lands (the first one and each swap on its words).
        const times = questionTimes(said, k);
        marks[`q${k + 1}_count`] = times.length;
        times.forEach((t, j) => (marks[`q${k + 1}_${j + 1}`] = frames(t)));
        texts[slot] = { from: round(Math.min(times[0] ?? idea.at, idea.at)), to: round(end) };
        const swaps = Math.min(times.length, ownRefs(k));
        times.slice(0, Math.max(1, swaps)).forEach((t) => sounds.push({ at: round3(t), ...THUD }));
      } else {
        // Its keyword only separates her ideas, never written; a name she cites shows its picture.
        texts[slot] = { from: round(idea.at), to: round(idea.at) };
        if (kind === KIND.window) {
          const w = windowMoments(said, k);
          marks.win_black = frames(w.black);
          marks.win_from = frames(w.from);
          marks.win_punch = w.punch === null ? 0 : frames(w.punch);
        }
      }
      if (kind !== KIND.number) idea.items.forEach((item, j) => (texts[`${slot}_${j + 1}`] = { from: round(item.at), to: round(item.at) }));
    });
    const lastWord = said.words.at(-1)?.end ?? said.duration;
    marks.black_after = frames(BLACK_AFTER);
    const duration = round(said.duration + TAIL);
    return {
      duration,
      shots: said.shots.map((s) => ({ start: s.start, end: s.end, want: "elle, face caméra, qui parle d'une traite de ce qu'elle présente (son visage passe dans le hublot)", take: 0, punch: false })),
      texts,
      marks,
      sounds,
      // Its music under her voice, stopped with the black after her last word.
      music: { end: { at: round(Math.min(duration, lastWord + BLACK_AFTER)), fade: 0.15 } },
      cutouts: [],
    };
  },
  code: CODE,
};
