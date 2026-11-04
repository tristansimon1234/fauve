import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Façade qui se construit », written on its original (house/originals/facade.mp4, its first 9 s, looked at image by
// image and measured piece by piece): on black, pieces of one still video of a shop front appear one after the other,
// each at once and at its exact place, the video playing inside them: a door at the first image, a window a beat later,
// an upper window, the awning; then a burst of smaller pieces on the quarter beats (the shop window, its sides, the
// pavement, the walls), two big ones (the street, the sky and the upper floor) and the whole picture at the ninth beat;
// the street then plays full frame, held about four beats. Here her name may build itself letter by letter on her
// front once it is whole (nothing is written while it builds), her other files follow full frame on the beat, and its
// ending card (an offer, an announcement) takes the last picture apart piece by piece, back to the black, where its
// words land.

const BPM = 84;
/** The beat the whole picture lands on, and how long her front then plays whole. */
const BUILD = 9;
const ALIVE = 4;
/** How long her name and its line stay whole on her front, at the least (s): a line of five words read on a phone. */
const READ = 2.4;
/** Her other files after it: a shot of two beats each, the last one held three. */
const SHOT = 2;
const LAST = 3;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS). */
const END_CARD = 1.6;
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = mark("beat", 21.43);
  const WHOLE = mark("whole", Math.round(9 * BEAT));
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', 'DM Serif Display', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Cormorant Garamond', Georgia, serif";
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const hook = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== line);
  // White on her front, with a tight dark edge and a soft shade, so it reads on a pale sky as on a dark wall.
  const shade = "0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.4), 0 3px 22px rgba(0,0,0,0.38)";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");

  // 1. The pieces of her front, as the model lays them (fractions of the frame, and the beat each lands on): a door, a
  // window, an upper window, the awning, slowly; then the shop window, its sides, the pavement and the walls in a burst
  // on the quarter beats; then the street and the sky; the whole picture at the ninth beat.
  const PIECES = [
    [0.14, 0.45, 0.31, 0.68, 0], [0.67, 0.45, 0.88, 0.62, 1], [0.41, 0.2, 0.59, 0.35, 2.5], [0.07, 0.39, 0.81, 0.45, 3.75],
    [0.31, 0.45, 0.49, 0.66, 4], [0.49, 0.45, 0.67, 0.68, 4.25], [0, 0.45, 0.14, 0.7, 4.5], [0.88, 0.45, 1, 0.66, 4.75],
    [0.17, 0.66, 0.43, 0.74, 5], [0.07, 0.31, 0.41, 0.39, 5.25], [0.59, 0.21, 0.93, 0.39, 5.5], [0.67, 0.62, 0.91, 0.71, 5.75],
    [0.09, 0.2, 0.41, 0.31, 6], [0.41, 0.35, 0.62, 0.39, 6.25], [0.81, 0.38, 1, 0.46, 6.5],
    [0, 0.66, 1, 1, 7.5], [0, 0, 0.7, 0.47, 8.25],
  ];
  const landAt = (p) => Math.round(p[4] * BEAT);
  const rect = (p) => {
    const x = Math.round(p[0] * width);
    const y = Math.round(p[1] * height);
    return "M" + x + " " + y + "H" + Math.round(p[2] * width) + "V" + Math.round(p[3] * height) + "H" + x + "Z";
  };
  // Its ending takes the last picture apart: the whole goes, then its pieces, the last laid first, one an image.
  const gone = end && frame >= endAt ? frame - endAt : -1;
  const kept = gone < 0 ? PIECES.length : Math.max(0, PIECES.length - gone);
  const isWhole = gone < 0 && frame >= WHOLE;
  const shown = PIECES.slice(0, kept).filter((p) => gone >= 0 || frame >= landAt(p));
  const clip = isWhole ? null : shown.length ? "path('" + shown.map(rect).join(" ") + "')" : "inset(50%)";

  // 2. Her shots: her front first (it plays from the first image, seen through its pieces, then whole); her other files
  // after it, full frame, cut on the beat. A file seen again (her only video, given several shots) shows another frame
  // of it, so two moments of one still camera never read as a missed cut: a video in width the part of its picture next
  // to the first one, else a closer frame, low then high. A photo that plays whole moves a little.
  const again = (i) => {
    let k = 0;
    for (let j = 0; j < i; j++) if (shots[i] && shots[i].src && shots[j].src === shots[i].src) k++;
    return k;
  };
  const place = (i) => {
    const sh = shots[i];
    const k = sh ? again(i) : 0;
    const a = sh ? Number(sh.aspect) || 0.5625 : 0.5625;
    if (k && k <= 2 && a > 1.2) {
      // Its first frame is the part around its subject; seen again, the part next to it (most of a frame over, toward
      // the side with room, then the other), never a side so far it may be empty; no room there, a closer frame.
      const W = Math.round(height * a);
      const room = W - width;
      const fx = sh.focus && Number.isFinite(sh.focus.x) ? sh.focus.x : 0.5;
      const first = Math.max(0, Math.min(room, fx * W - width / 2));
      const toward = first > room / 2 ? -1 : 1;
      const left = Math.max(0, Math.min(room, first + (k === 1 ? toward : -toward) * 0.6 * width));
      if (Math.abs(left - first) >= 0.3 * width) return { style: { position: "absolute", left: -Math.round(left), top: 0, width: W, height }, scale: 1, origin: "50% 50%" };
    }
    return { style: full, scale: k ? 1.35 : 1, origin: k % 2 ? "50% 64%" : "50% 30%" };
  };
  const s = shots[cur];
  const p = place(cur);
  const photoPush = s && s.kind === "photo" ? 1 + 0.05 * interpolate(frame, [cur === 0 ? WHOLE : s.from, s.from + s.durationInFrames], [0, 1], clamp) : 1;
  const scale = photoPush * p.scale;
  const film = n
    ? h("div", { style: { ...full, overflow: "hidden", ...(clip ? { clipPath: clip } : {}) } },
        h("div", { style: { ...full, ...(scale > 1.0001 ? { transform: "scale(" + scale.toFixed(4) + ")", transformOrigin: p.origin } : {}) } },
          h(Footage, { shot: cur, style: p.style })))
    : null;

  // Words that build themselves like her front: each letter lands at once, in a shuffled order, a word never broken
  // (a hyphen or a space inside a name keeps it whole). Every letter is in the page from the start, unseen until its
  // turn, so its box measures the whole name once; built, it is plain words again, laid out the same (no kerning
  // across its letters, as while it builds).
  const built = (text, at, each, seed) => {
    const chars = Array.from(String(text || ""));
    const units = chars.map((c, i) => i).filter((i) => !/\s/.test(chars[i]));
    const order = units.slice().sort((a, b) => random(seed + "-" + a) - random(seed + "-" + b));
    const turn = {};
    order.forEach((i, k) => { turn[i] = k; });
    const done = frame >= at + Math.round(Math.max(0, units.length - 1) * each);
    const words = [];
    let word = [];
    chars.forEach((c, i) => {
      if (/\s/.test(c)) {
        if (word.length) words.push(word);
        words.push(c);
        word = [];
      } else word.push(i);
    });
    if (word.length) words.push(word);
    return words.map((w, k) =>
      typeof w === "string"
        ? w
        : h("span", { key: "w" + k, style: { whiteSpace: "nowrap" } },
            done ? w.map((i) => chars[i]).join("") : w.map((i) => h("span", { key: i, style: { opacity: frame >= at + Math.round(turn[i] * each) ? 1 : 0 } }, chars[i]))));
  };
  const unkerned = { fontKerning: "none", fontVariantLigatures: "none", fontSynthesis: "none" };
  // Figures that stand on the line (a body serif may draw old-style ones: « 3E » would read « 3 » sunk).
  const lining = { fontVariantNumeric: "lining-nums" };

  // 3. Her name on her front once it is whole, white, built letter by letter in a quick burst, a line of small spaced
  // capitals under it; both go with her front. Nothing is written while it builds.
  const nameOn = hook && frame >= hook.from && frame < Math.min(hook.to, endAt);
  const lineOn = line && frame >= line.from && frame < Math.min(line.to, endAt);
  // As big as its place holds: a short name on one line, a longer one on two (its longest line counted).
  const nameLine = hook ? (hook.text.length <= 12 || !/ /.test(hook.text.trim()) ? hook.text.length : Math.ceil(hook.text.length / 2) + 2) : 10;
  const nameSize = Math.round(Math.max(120, Math.min(220, 800 / (Math.max(1, nameLine) * 0.42))));
  const name = nameOn
    ? h(FitText, { key: "name", style: { position: "absolute", left: 140, top: 250, width: width - 280, height: 330 }, innerStyle: { justifyContent: "flex-end", fontFamily: display, fontWeight: 400, fontSize: nameSize, lineHeight: 1.0, letterSpacing: "-0.01em", color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: shade, ...unkerned } },
        h("span", null, built(hook.text, hook.from, Math.max(1, Math.min(2, 24 / Math.max(1, hook.text.length))), "nom")))
    : null;
  // Each of its words its own small label (it lands a moment after the one before), so a word never breaks; a separator
  // (« · », « — ») stays with the word before it, never at the start of a line.
  const spaced = (text, at) => {
    const words = [];
    String(text || "").split(/[ \t\n]+/).filter(Boolean).forEach((w) => {
      if (words.length && !/[\p{L}\p{N}]/u.test(w)) words[words.length - 1] += "\u00a0" + w;
      else words.push(w);
    });
    return words.flatMap((w, i) => [i ? " " : null, h("span", { key: i, "data-fauve-accent": "", style: { whiteSpace: "nowrap", opacity: frame >= at + i * 2 ? 1 : 0 } }, w)]);
  };
  const small = lineOn
    ? h(FitText, { key: "line", style: { position: "absolute", left: 140, top: 596, width: width - 280, height: 120 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 700, fontSize: 44, lineHeight: 1.25, letterSpacing: "0.2em", wordSpacing: "0.18em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: shade, ...lining } },
        h("span", null, spaced(line.text, line.from + 4)))
    : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1250 - i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: shade } }, t.text));

  // 4. Its ending card: the last picture taken apart into the black, its words built on it like her name, a line of
  // spaced capitals under them.
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 520 : 640, width: width - 280, height: 480 }, innerStyle: { justifyContent: end.subtitle ? "flex-end" : "center", fontFamily: display, fontWeight: 400, fontSize: 124, lineHeight: 1.02, letterSpacing: "-0.01em", color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: shade, ...unkerned } },
          h("span", null, built(keep(end.title), endAt + 2, Math.max(0.5, Math.min(1.5, 12 / Math.max(1, String(end.title).length))), "fin"))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1030, width: width - 280, height: 236 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 700, fontSize: 54, lineHeight: 1.2, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: shade, ...lining } },
              h("span", { style: { opacity: frame >= endAt + 12 ? 1 : 0 } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, name, small, extra, ending);
}`;

export const facade: MontageSkill = {
  key: "facade",
  version: 1,
  bpm: BPM,
  shots: [1, 3],
  files: [1, 3],
  how: "Sur un écran noir, des morceaux de sa devanture apparaissent un à un, chacun d'un coup à sa place dans l'image, la vidéo jouant dedans : lentement d'abord (un morceau haut et étroit comme une porte, un autre comme une fenêtre, un en haut, une bande comme l'enseigne), puis en rafale sur les quarts de temps, puis la rue et le ciel, et l'image entière au neuvième temps ; sa devanture joue alors en plein écran, la rue s'anime, et son nom (facultatif) s'y écrit lettre à lettre. Ses autres fichiers suivent en plein écran, coupés sur le temps.",
  end: true,
  texts: [
    {
      slot: "nom",
      role: "hook",
      want: "facultatif : son nom (ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), qui s'écrit lettre à lettre en blanc sur sa devanture une fois entière ; rien ne s'écrit pendant la construction",
      max: 20,
      required: false,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : 2 à 4 petits mots en capitales espacées sous son nom : son métier et son quartier, une date (une forme comme « boulangerie · paris 11e », « depuis 1998 »)",
      max: 28,
      required: false,
    },
  ],
  timeline(n, options: { end: boolean; bpm?: number }) {
    const { end } = options;
    // At her music's tempo when one is given (slower: a longer, calmer Reel; faster: a shorter one), else the model's.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(1, Math.min(3, n));
    // Her front: its pieces, then whole; her other files two beats each, the last one three. With an ending card, the last
    // picture is held the card's 1.6 s more, from a beat (its pieces leave on it).
    // Her front plays whole four beats, or as many half beats more as her name and its line need to be read at a fast tempo.
    const alive = Math.max(ALIVE, Math.ceil((READ / beat + 0.5) * 2) / 2);
    const beats = count === 1 ? [BUILD + alive] : [BUILD + alive, ...Array.from({ length: count - 2 }, () => SHOT), LAST];
    const spans = beatSpans(bpm, beats);
    const cardAt = spans.at(-1)!.end;
    const duration = round(end ? onFrame(cardAt + END_CARD) : cardAt);
    spans[spans.length - 1] = { start: spans.at(-1)!.start, end: duration };
    const wholeAt = onFrame(BUILD * beat);
    const frontEnd = onFrame((BUILD + alive) * beat);
    const wants = [
      "sa devanture filmée de face, fixe et bien droite (la vidéo la plus nette, avec un peu de vie : des passants, une porte qui s'ouvre) : elle se construit morceau par morceau sur le noir, puis joue en entier",
      ...Array.from({ length: count - 1 }, (_, i) =>
        i === count - 2
          ? "le dernier plan, calme, tenu jusqu'à la fin : l'intérieur de son lieu, son travail ou un détail qui finit bien"
          : "un plan de son lieu en plein écran, juste après sa devanture : l'intérieur, un geste, ses produits",
      ),
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her name builds itself half a beat after her front is whole, and goes with it (or at the ending card).
      texts: {
        nom: { from: round(onFrame(wholeAt + beat / 2)), to: round(frontEnd) },
        ligne: { from: round(onFrame(wholeAt + beat / 2)), to: round(frontEnd) },
      },
      marks: { beat: beat * 30, whole: toFrame(wholeAt) },
    };
  },
  code: CODE,
};
