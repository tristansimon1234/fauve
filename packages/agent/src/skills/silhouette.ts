import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Silhouette et mot », written on its model and its original (house/originals/silhouette.mp4, 11,1 s, a designer's
// animated intro, looked at image by image): a very pale grey ground crossed by faint layout lines; a black silhouette
// (a head in profile, curly hair) holds the middle of the frame, and a word in a tight grotesque sits at the centre,
// white where it lies on her, dark where it leaves her; words are typed on letter by letter, they take each other's
// place on the beat (« Creative Producer », « Director », « Designer »…), and it ends on a small name typed alone on the
// pale ground, held. Here her silhouette (her cut-out, filled black) walks on the pale ground in each of her shots; her
// word (her name), very bold and tight, flickers on letter by letter at the centre and inverts where she passes under
// it (the word drawn white in difference over the ground and her: dark on the pale, white on her); her other words
// may take its place on the beat in the middle shots, then her word comes back alone on the pale ground, a small line
// typed under it. Without her cut-out (a shot where it failed) her shot plays as a very contrasted black and white
// print clamped to the pale ground, her dark shapes for silhouettes, the word inverting on them the same way. Its
// ending card (an offer, an announcement) takes the word's place, in its type, on the pale ground.

const BPM = 90;
/** The first shot (her silhouette, the word landing), the middle shots, the last one before the word alone (beats). */
const FIRST = 6;
const EACH = 4;
const LAST = 4;
/** The word alone on the pale ground at the end, its small line typed under it (beats). */
const ALONE = 3;
/** The engine's ending card: the Reel's last 1,6 s. */
const CARD_SECONDS = 1.6;
const round = (s: number) => Math.round(s * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  // Its sections (frames): a beat, the word landing, her words in the middle, the word alone at the end.
  const BEAT = Math.max(4, mark("beat", 20));
  const WORD_AT = mark("word", 6);
  const SWAP_AT = mark("swap", shots.length > 1 ? shots[1].from : durationInFrames);
  const ALONE_AT = mark("alone", Math.max(SWAP_AT, durationInFrames - Math.round(3 * BEAT)));
  const n = shots.length;
  const cur = Math.min(Math.max(0, n - 1), shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0));
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Inter', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  // The model's own colours: a very pale cool grey ground, a blue black for her silhouette and the small line.
  const PALE = "#eef0f4";
  const INK = "#0d0f1a";
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const hook = reelTexts.find((t) => t.role === "hook");
  const list = reelTexts.find((t) => t.role === "band");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== list && t !== line);
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");

  // 1. The ground: the pale grey, faint layout lines framing the word (decor), and her silhouette walking on it, her
  // cut-out filled with the blue black. A shot without its cut-out: her shot as a hard black and white print, clamped
  // to the pale ground (darken), so its dark shapes read as silhouettes on the same grey.
  const hasCut = (i) => Boolean(shots[i] && shots[i].subjectBoxes && shots[i].subjectBoxes.some(Boolean));
  const shown = frame < ALONE_AT && n > 0;
  const people = !shown
    ? null
    : hasCut(cur)
      ? h(Subject, { key: "her", shot: cur, fill: INK, style: full })
      : h(React.Fragment, { key: "print" },
          h(Footage, { shot: cur, style: { ...full, filter: "grayscale(1) contrast(3.4) brightness(1.12)" } }),
          h("div", { style: { ...full, backgroundColor: PALE, mixBlendMode: "darken" } }));
  const BOX = { left: 140, top: 820, width: 800, height: 280 };
  const hair = (key, s) => h("div", { key, style: { position: "absolute", backgroundColor: "rgba(13,15,26,0.07)", ...s } });
  const guides = h("div", { key: "guides", "data-fauve-decor": "", style: full },
    hair("g1", { left: BOX.left, top: 0, width: 2, height }),
    hair("g2", { left: BOX.left + BOX.width - 2, top: 0, width: 2, height }),
    hair("g3", { left: 0, top: BOX.top + 18, width, height: 2 }),
    hair("g4", { left: 0, top: BOX.top + BOX.height - 20, width, height: 2 }));

  // 2. The word: very bold and tight, in lower case, white in difference over everything under it: dark on the pale
  // ground, white where her silhouette passes under it. It flickers on letter by letter (each letter lighting up in a
  // random order, blinking before it holds). Her other words take its place one after the other on the beat in the
  // middle shots, then it comes back alone. Every word sits in one cell, laid out all along, only the current one seen:
  // they share one size (the widest sets it), and her separators stay in the page.
  const flicker = (text, at, seed) => {
    const chars = Array.from(text);
    const units = chars.map((c, i) => i).filter((i) => !/\s/.test(chars[i]));
    const stagger = Math.max(1, Math.min(3, Math.floor(18 / Math.max(1, units.length))));
    if (frame >= at + stagger * Math.max(0, units.length - 1) + 7) return text;
    const order = units.slice().sort((a, b) => random(seed + "-o-" + a) - random(seed + "-o-" + b));
    return chars.map((c, i) => {
      if (/\s/.test(c)) return c;
      const turn = order.indexOf(i);
      const p = interpolate(frame, [at + turn * stagger, at + turn * stagger + 7], [0, 1], clamp);
      const lit = p >= 1 || (p > 0 && random(seed + "-f-" + i + "-" + Math.floor(frame / 2)) < 0.25 + 0.75 * p);
      return h("span", { key: i, style: { opacity: lit ? 1 : 0 } }, c);
    });
  };
  const parts = list ? String(list.text).split(/[,;·|\/\n]/.test(list.text) ? /(\s*[,;·|\/\n]\s*)/ : /( +)/) : [];
  const items = [];
  parts.forEach((p, i) => { if (i % 2 === 0 && p.trim()) items.push(i); });
  // Her words from the first middle shot, each on the beat, a beat for a word, the beats a phone needs to read it when
  // it has several (0,8 s and 0,3 s a word), all of them twice as long when they have room, all of them shown however
  // many she gave (quicker when they have less room); then her word again.
  const wordsIn = (s) => String(s || "").split(/[\s  ]+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const need = items.map((i) => (wordsIn(parts[i]) <= 1 ? 1 : Math.ceil(((0.8 + 0.3 * wordsIn(parts[i])) * 30) / BEAT)));
  const room = Math.floor(Math.max(0, ALONE_AT - SWAP_AT) / BEAT);
  const total = need.reduce((a, b) => a + b, 0);
  const scale = total * 2 <= room ? 2 : total <= room ? 1 : room / Math.max(1, total);
  const starts = [];
  const swapBeats = need.reduce((at, b) => { starts.push(at); return at + b * scale; }, 0);
  const swapping = list && items.length && frame >= SWAP_AT && frame < Math.min(ALONE_AT, SWAP_AT + Math.round(swapBeats * BEAT));
  const current = swapping ? starts.reduce((c, s, k) => (SWAP_AT + Math.round(s * BEAT) <= frame ? k : c), 0) : -1;
  const wordStyle = { fontFamily: display, fontWeight: 800, fontSize: 250, lineHeight: 1, letterSpacing: "-0.055em", textTransform: "lowercase", fontKerning: "none", fontVariantLigatures: "none", whiteSpace: "nowrap", color: "#ffffff", textShadow: "0 0 1px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.6)" };
  const cell = (key, seen, child) => h("span", { key, style: { gridArea: "1 / 1", justifySelf: "center", opacity: seen ? 1 : 0, paddingRight: "0.06em" } }, child);
  const hidden = (key, text) => h("span", { key, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, text);
  const mainOn = hook && frame < endAt && (frame < SWAP_AT || current < 0);
  const word = hook && frame < endAt && (frame >= hook.from || frame >= WORD_AT)
    ? h(FitText, { key: "word", style: { position: "absolute", ...BOX, mixBlendMode: "difference" } },
        h("div", { style: { ...wordStyle, display: "grid", alignItems: "center" } },
          cell("w", mainOn, frame < SWAP_AT ? flicker(String(hook.text), WORD_AT, "w") : hook.text),
          parts.map((p, i) => (i % 2 === 1 || !p.trim() ? hidden("s" + i, p) : cell("m" + i, items.indexOf(i) === current, p.trim())))))
    : null;

  // 3. The word alone on the pale ground, its small line typed under it, letter by letter (all its letters in the page
  // from the start, unseen until typed, so its size is measured once).
  const typed = (text, at) => {
    const chars = Array.from(text);
    const k = Math.floor(interpolate(frame, [at, at + Math.max(8, chars.length * 1.6)], [0, chars.length], clamp));
    return chars.map((c, i) => h("span", { key: i, style: { opacity: i < k ? 1 : 0 } }, c));
  };
  const small = line && frame >= line.from && frame < Math.min(line.to, endAt)
    ? h(FitText, { key: "line", style: { position: "absolute", left: 140, top: 1150, width: 800, height: 84 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.2, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap" } },
        h("span", null, typed(keep(line.text), line.from)))
    : null;

  // Any other text of the Reel (none in its slots): a plain line above the word, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 560 - i * 120, width: 800, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: INK, textAlign: "center", textWrap: "balance" } }, t.text));

  // 4. Its ending card: on the pale ground, its title in the word's type flickering on, a little smaller and on two
  // lines when long, its line typed under it.
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h(FitText, { style: { position: "absolute", left: 140, top: 700, width: 800, height: 400, mixBlendMode: "difference" } },
          h("div", { style: { ...wordStyle, fontSize: 170, lineHeight: 0.98, whiteSpace: "normal", textAlign: "center", textWrap: "balance" } }, flicker(keep(end.title), endAt + 2, "e"))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1150, width: 800, height: 150 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.2, color: INK, textAlign: "center", textWrap: "balance" } },
              h("span", null, typed(keep(end.subtitle), endAt + 10)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: PALE } }, people, guides, word, small, extra, ending);
}`;

export const silhouette: MontageSkill = {
  key: "silhouette",
  version: 1,
  bpm: BPM,
  shots: [2, 5],
  files: [1, 4],
  how: "Sur un fond gris très pâle, ta silhouette toute noire qui marche ; au centre, un grand mot très gras en minuscules s'allume lettre par lettre en clignotant, sombre sur le fond pâle et blanc là où ta silhouette passe dessous ; dans les plans du milieu, d'autres mots peuvent le remplacer l'un après l'autre sur le temps ; à la fin, le mot revient seul sur le fond pâle, une petite ligne tapée dessous.",
  end: true,
  texts: [
    { slot: "mot", role: "hook", want: "le grand mot au centre, très gras, en minuscules : son nom s'il est court, sinon le mot de son nom qui la distingue (« Farine » pour « Maison Farine »), ou son quartier ; un seul mot de préférence, plus il est court plus il est grand", max: 12, required: true },
    { slot: "mots", role: "band", want: "facultatif : 2 à 4 mots qui prennent la place du grand mot l'un après l'autre, sur le temps, pendant les plans du milieu, séparés par des virgules, un seul mot court chacun : ce qu'elle fait ou ce qu'on trouve chez elle (une forme comme « bouquets, mariages, deuil »)", max: 40, required: false },
    { slot: "ligne", role: "caption", want: "facultatif : une petite ligne tapée sous le mot à la fin, sur le fond pâle : son métier et son quartier, ou son compte (une forme comme « fleuriste · Paris 11 », « @studio.ciel »)", max: 30, required: false },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // Her silhouette's first shot, the middle ones, the last one; then the word alone (and the ending card after it:
    // 1,6 s at least, in the last shot's span: the engine lays the card over the Reel's last 1,6 s).
    const count = Math.max(2, n);
    const card = end ? Math.max(2, CARD_SECONDS / beat) : 0;
    const spans = beatSpans(bpm, [FIRST, ...Array.from({ length: count - 2 }, () => EACH), LAST + ALONE + card]);
    const duration = spans.at(-1)!.end;
    const swapAt = spans[1]!.start;
    const aloneAt = round(spans.at(-1)!.start + LAST * beat);
    const until = round(end ? duration - CARD_SECONDS : duration);
    const wants = spans.map((_, i) =>
      i === 0
        ? "une vidéo filmée fixe où tu marches (ou des passants), en entier dans l'image et pas trop loin, au moins 5 s : ta silhouette devient toute noire sur un fond pâle, le grand mot posé au centre"
        : i < spans.length - 1
          ? "un autre passage filmé fixe où quelqu'un marche ou passe, différent du précédent (une autre vidéo, ou un autre moment de la même) : sa silhouette noire passe sous le mot"
          : "le dernier passage filmé fixe où quelqu'un marche ou sort de l'image : puis le mot reste seul sur le fond pâle",
    );
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The word from the first image to the end (or its card); her words in the middle shots; the small line on the word alone.
      texts: {
        mot: { from: 0, to: until },
        mots: { from: swapAt, to: aloneAt },
        ligne: { from: round(aloneAt + beat / 2), to: until },
      },
      marks: { beat: beat * 30, word: 6, swap: toFrame(swapAt), alone: toFrame(aloneAt) },
    };
  },
  code: CODE,
};
