import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Montage sport noir et blanc », written on its original (house/originals/nike.mp4: the sports edit in the left part
// of a tutorial, its first 10,4 s, looked at image by image): it opens on a strobe (two images red, three in negative,
// two red), foggy high-key runners, then a burst of seven shots of four images each, every image held (red ones, then
// black and white); on black a giant red word at the top, the next one at the bottom, both cut by the frame's right
// edge, then the whole title smaller, centred, for a second; then a word per shot in red condensed capitals at the
// middle of the frame (its cities), each one landing on a cut with two images in negative where the word is black;
// black and white very contrasted, a shot now and then all red (multiplied), some held image by image; a gesture
// frozen on the last beat, then black. Here the burst flashes her later shots ahead (a teaser), the title and the words
// are hers (white over a red shot, where the original's red word would vanish); its ending card (an offer, an
// announcement) is the title's red on the black.

const BPM = 120;
/** Each section in beats: the burst, the title on black, the last shot before it freezes, its freeze, the black. */
const BURST = 2;
const TITLE = 4;
const LAST = 2;
const FROZEN = 1;
const BLACK = 1;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS). */
const END_CARD = 1.6;
/** The words' shots, in beats, over and over: one held two beats, two quick ones. */
const PATTERN = [2, 1, 1];
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = mark("beat", 15);
  const BURST_AT = mark("burst", Math.round(3 * BEAT));
  const TITLE_AT = mark("title", BURST_AT + Math.round(2 * BEAT));
  const WORDS_AT = mark("words", TITLE_AT + Math.round(4 * BEAT));
  const FREEZE_AT = mark("freeze", Math.max(WORDS_AT + 30, durationInFrames - Math.round(2 * BEAT)));
  const BLACK_AT = mark("black", Math.min(durationInFrames, FREEZE_AT + Math.round(BEAT)));
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const display = "'" + brand.displayFont + "', sans-serif";
  const body = "'" + brand.bodyFont + "', sans-serif";
  // The model's own colours: black and white very contrasted, its red.
  const RED = "#f2000c";
  const BW = "grayscale(1) contrast(1.45) brightness(0.9)";
  const NEGATIVE = "grayscale(1) invert(1) contrast(1.3) brightness(1.08)";
  const box = { position: "absolute", left: 0, top: 0, width, height };
  const hook = reelTexts.find((t) => t.role === "hook");
  const list = reelTexts.find((t) => t.role === "band");
  const others = reelTexts.filter((t) => t !== hook && t !== list);
  const endAt = end ? end.from : durationInFrames + 1;
  const wordStyle = { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 190, lineHeight: 1, letterSpacing: "0.005em", textTransform: "uppercase", whiteSpace: "nowrap", textAlign: "center" };
  // A shot as the model draws it: black and white, all red (multiplied), or in negative; each image held "hold" frames.
  const shot = (i, look, extra) => {
    const neg = look === "negative";
    return h(React.Fragment, { key: "s" + i + look },
      h(Footage, { shot: i, style: { ...box, filter: neg ? NEGATIVE : BW }, ...(extra || {}) }),
      look === "red" ? h(Tint, { color: RED, mode: "multiply" }) : null);
  };

  // 1. The opening: her first shots, the first one through the strobe (red, negative, red), then the burst: her later
  // shots flashed ahead, each one still, red then black and white.
  let film = null;
  let redShot = false;
  if (frame < BURST_AT) {
    const strobe = frame < 2 || (frame >= 5 && frame < 7) ? "red" : frame >= 2 && frame < 5 ? "negative" : null;
    film = strobe ? shot(0, strobe) : shot(cur, cur === 2 ? "red" : "bw", cur === 1 ? { hold: 3 } : null);
  } else if (frame < TITLE_AT) {
    const later = [];
    for (let i = 3; i < n; i++) later.push(i);
    if (!later.length) later.push(cur);
    const flashes = Math.min(6, later.length);
    const len = Math.max(3, Math.floor((TITLE_AT - BURST_AT) / flashes));
    const k = Math.min(flashes - 1, Math.floor((frame - BURST_AT) / len));
    const pick = later[Math.round((k * (later.length - 1)) / Math.max(1, flashes - 1))];
    const s = shots[pick];
    film = shot(pick, k < flashes / 2 ? "red" : "bw", { at: BURST_AT + k * len - Math.floor((s ? s.durationInFrames : 0) / 2), hold: len });
  } else if (frame >= WORDS_AT && frame < BLACK_AT) {
    // 3. The words' shots: black and white, every fourth one red, the quick ones held image by image; the last one
    // frozen on its last beat.
    const i = Math.max(3, cur);
    const s = shots[i];
    const frozen = frame >= FREEZE_AT && s ? { hold: Math.max(2, FREEZE_AT - s.from) } : null;
    const quick = s && s.durationInFrames <= Math.round(BEAT) + 1;
    redShot = (i - 3) % 4 === 2;
    // The first of them runs on under the title: it starts playing when it is seen.
    film = shot(i, redShot ? "red" : "bw", frozen || (quick ? { hold: 3 } : s && s.from < WORDS_AT ? { at: WORDS_AT } : null));
  }

  // A long title on two lines, as even as can be, broken between words (a non-breaking space keeps « 9 h » whole).
  const stacked = (text) => {
    const words = text.split(/[ \t\n]+/).filter(Boolean);
    if (text.length <= 11 || words.length < 2) return text;
    let best = 1;
    const gap = (k) => Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
    for (let i = 1; i < words.length; i++) if (gap(i) < gap(best)) best = i;
    return words.slice(0, best).join(" ") + "\n" + words.slice(best).join(" ");
  };

  // 2. The title on black: each of its words giant, one after the other, top then bottom, cut by the right edge (decor:
  // the title itself is read next), then the whole title smaller, centred, in red.
  let title = null;
  if (hook && frame >= TITLE_AT && frame < WORDS_AT) {
    const parts = hook.text.split(/[ \t\n]+/).filter(Boolean);
    const each = Math.max(4, Math.floor(BEAT / Math.max(1, parts.length)));
    const giant = frame < TITLE_AT + each * parts.length ? Math.floor((frame - TITLE_AT) / each) : -1;
    title = giant >= 0
      ? h("div", { "data-fauve-decor": "", style: { position: "absolute", left: 84, top: giant % 2 ? 1250 : 120, fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 330, lineHeight: 1, textTransform: "uppercase", whiteSpace: "nowrap", color: RED } }, parts[giant])
      : h(FitText, { style: { position: "absolute", left: 140, top: 760, width: width - 280, height: 400 }, innerStyle: { ...wordStyle, whiteSpace: "pre", color: RED } }, stacked(hook.text));
  }

  // 3. The words, one per shot (or per beat when she gave more words than shots), red at the middle of the frame (white
  // over a red shot, where red would vanish), each landing on its cut with two images in negative where it is black.
  // Every word is in the page all along (her separators too), only the current one seen.
  let words = null;
  let flash = false;
  if (list && frame >= WORDS_AT && frame < BLACK_AT) {
    // Her words between commas (or slashes, dots, lines); none of them: a word each.
    const parts = list.text.split(/[,;·|\/\n]/.test(list.text) ? /(\s*[,;·|\/\n]\s*)/ : /( +)/);
    const items = parts.filter((p, i) => i % 2 === 0 && p.trim());
    const W = Math.max(1, items.length);
    const section = [];
    for (let i = 3; i < n; i++) section.push(Math.max(WORDS_AT, shots[i].from));
    if (!section.length) section.push(WORDS_AT);
    const starts = items.map((_, k) =>
      W <= section.length ? section[Math.floor((k * section.length) / W)] : WORDS_AT + Math.round((k * (FREEZE_AT - WORDS_AT)) / W / BEAT) * BEAT);
    const current = starts.reduce((c, s, k) => (s <= frame ? k : c), 0);
    flash = frame - starts[current] < 2;
    let index = -1;
    words = h("div", { style: { position: "absolute", left: 0, top: 0, width, height } },
      parts.map((p, i) => {
        if (i % 2 === 1 || !p.trim()) return h("span", { key: "p" + i, style: { position: "absolute", opacity: 0, fontSize: 1 } }, p);
        index += 1;
        const on = index === current;
        return h(FitText, { key: "w" + i, style: { position: "absolute", left: 140, top: 760, width: width - 280, height: 400, opacity: on ? 1 : 0 }, innerStyle: { ...wordStyle, whiteSpace: "pre", color: on && flash ? "#000000" : redShot ? "#ffffff" : RED } }, stacked(p.trim()));
      }));
    if (flash) film = shot(Math.max(3, cur), "negative", shots[Math.max(3, cur)] && shots[Math.max(3, cur)].from < WORDS_AT ? { at: WORDS_AT } : null);
  }

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1250, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#ffffff", textAlign: "center" } }, t.text));

  // 4. Its ending card: on the black, its title in the title's red, a white line under it.
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: 640, width: width - 280, height: 390 }, innerStyle: { ...wordStyle, whiteSpace: "pre", color: RED } }, stacked(String(end.title || ""))),
        end.subtitle ? h(FitText, { style: { position: "absolute", left: 140, top: 1045, width: width - 280, height: 150 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 52, lineHeight: 1.2, color: "#ffffff", textAlign: "center", textWrap: "balance" } }, end.subtitle) : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, title, words, extra, ending);
}`;

export const nike: MontageSkill = {
  key: "nike",
  version: 1,
  bpm: BPM,
  shots: [8, 16],
  files: [5, 14],
  how: "Noir et blanc très contrasté : un stroboscope rouge et négatif sur le premier plan, deux plans, puis une rafale de ses plans figés image par image ; sur le noir, son titre en rouge géant mot par mot, puis entier ; puis un mot en rouge condensé par plan au milieu de l'écran, chacun arrivant sur une coupe avec deux images en négatif, un plan sur quatre tout rouge, les plans rapides saccadés ; le dernier geste se fige sur le dernier temps, puis le noir.",
  end: true,
  texts: [
    { slot: "titre", role: "hook", want: "le titre sur le noir, en capitales : 1 à 3 mots qui annoncent la série de mots qui suit (une forme comme « sept jours », « le geste », « un samedi »)", max: 18, required: true },
    { slot: "mots", role: "band", want: "4 à 6 mots ou groupes de 2 mots, séparés par des virgules, un par plan en grand : les gestes, les moments ou les lieux de son métier (une forme comme « pétrir, façonner, cuire, servir »)", max: 60, required: true },
  ],
  timeline(n, options: { end: boolean; bpm?: number }) {
    const { end } = options;
    // At her music's tempo when one is given (slower: a longer, calmer Reel; faster: a shorter one), else the model's.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(8, Math.min(16, n));
    // Shots 1 and 2: a beat each; shot 3: a beat, then the burst over it (its video runs on under it); the words' shots
    // on the pattern, the first one under the title before it is seen; the last one: two beats, frozen one, then black
    // (or the ending card). No segment longer than it must be: each one's video holds its passage.
    const words = Array.from({ length: count - 4 }, (_, i) => PATTERN[i % PATTERN.length]!);
    const beats = [1, 1, 1 + BURST, TITLE + words[0]!, ...words.slice(1), LAST + FROZEN + BLACK];
    const spans = beatSpans(bpm, beats);
    const lastAt = spans.at(-1)!.start;
    const freezeAt = onFrame(lastAt + LAST * beat);
    const blackAt = onFrame(freezeAt + FROZEN * beat);
    const duration = round(end ? onFrame(blackAt + END_CARD) : spans.at(-1)!.end);
    spans[spans.length - 1] = { start: lastAt, end: duration };
    const burstAt = onFrame(3 * beat);
    const titleAt = onFrame((3 + BURST) * beat);
    const wordsAt = onFrame((3 + BURST + TITLE) * beat);
    const wants = [
      "le plan qui ouvre : un geste fort en mouvement (il passe en rouge et en négatif)",
      "un plan en mouvement, de près",
      "un plan fort, un visage ou un geste : seule sa première demi-seconde se voit, en rouge, juste avant la rafale",
      ...words.map((b, i) => (i === 0 ? "le premier plan des mots, juste après le titre (sa vidéo part quand on la voit) : un geste fort, un mot en grand par-dessus" : b > 1 ? "un plan d'action tenu : un geste, un effort, un service, un mot en grand par-dessus" : "un plan d'action rapide, saccadé image par image")),
      "le dernier geste, fort et net : il joue une seconde puis se fige sur le dernier temps",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: {
        titre: { from: round(titleAt), to: round(wordsAt) },
        mots: { from: round(wordsAt), to: round(blackAt) },
      },
      marks: { beat: beat * 30, burst: toFrame(burstAt), title: toFrame(titleAt), words: toFrame(wordsAt), freeze: toFrame(freezeAt), black: toFrame(blackAt) },
    };
  },
  code: CODE,
};
