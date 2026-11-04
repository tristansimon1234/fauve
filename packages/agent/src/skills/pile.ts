import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Pile de photos », written on its original (house/originals/pile.mp4, 9,2 s, looked at image by image): on a white
// page, a few big yellow words stacked in very condensed capitals, one per line in pairs, held the whole Reel in front;
// her photos land one after the other, at once, without border nor shadow, each at its own shape, the pile growing from
// the top of the page to the bottom in a zigzag (left, right, left…), quick then settling for the last ones; held full a
// moment, they leave in the order they came (the first laid first, so the pile empties from the top), at the same pace,
// and the words end alone on the white. Its ending card (an offer, an announcement) is set in its words' style.

const BPM = 110;
/** The full pile, held (beats). */
const HOLD = 0.5;
/** The words alone on the white at the end (beats), or before the ending card. */
const ALONE = 2;
const ALONE_BEFORE_CARD = 1;
/** The ending card's beats (at least the engine's 1,6 s). */
const CARD = 3;
/** The engine's ending card: the last 1,6 s. */
const CARD_SECONDS = 1.6;

/**
 * How the photos land (beats): the model lays a photo every sixth of a beat; fewer photos land on a slower subdivision
 * so the pile still takes a few seconds to build, and the last ones land twice slower (it settles).
 */
function cadence(n: number): { step: number; slow: number } {
  return { step: n <= 12 ? 1 / 2 : n <= 18 ? 1 / 3 : n <= 24 ? 1 / 4 : 1 / 6, slow: n < 10 ? 2 : 3 };
}
/** The gaps between two photos landing (beats), as its code lays them. */
function gaps(n: number): number[] {
  const { step, slow } = cadence(n);
  return Array.from({ length: Math.max(0, n - 1) }, (_, k) => (k >= n - 1 - slow ? 2 * step : step));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const n = shots.length;
  // Where each photo lands (frames): every "step" beats, the last "slow" ones twice slower, the first at the first
  // image. Each video plays its passage from the moment it lands (its slot is only how long it moves).
  const BEAT = mark("beat", 16.36);
  const STEP = mark("step", 0.5);
  const SLOW = mark("slow", 3);
  const landAt = [];
  for (let k = 0, t = 0; k < n; k++) { landAt.push(Math.round(t * BEAT)); t += k >= n - 1 - SLOW ? 2 * STEP : STEP; }
  const first = n ? landAt[0] : 0;
  const lastAt = n ? landAt[n - 1] : 0;
  // A photo leaves this long after it landed; the words stay alone this long before the end (or the card).
  const SHIFT = mark("shift", lastAt - first + 9);
  const ALONE = mark("alone", 33);
  const endAt = end ? end.from : durationInFrames;
  const display = "'" + brand.displayFont + "', 'Anton', 'Arial Narrow', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const YELLOW = "#fbd201";
  const INK = "#161616";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");

  // 1. Her photos, each at its own shape (cropped between a tall 0,72 and a wide 1,6), landing at once where the model
  // lays them: its zigzag down the page (the centres measured on it, in px of the frame), bigger when there are fewer
  // of them. Each leaves at the same pace it came, the first laid first; squeezed if the Reel is shorter than planned.
  const PX = [350, 424, 568, 722, 756, 618, 432, 362, 342, 477, 672, 732, 786, 624, 430, 298, 358, 540, 741, 766, 722, 516, 418, 303, 426, 586, 734, 816, 675, 470, 261, 309, 466, 668, 824];
  const PY = [512, 453, 426, 426, 528, 555, 588, 668, 756, 735, 759, 789, 848, 848, 897, 960, 1048, 992, 969, 1058, 1114, 1146, 1124, 1215, 1245, 1276, 1269, 1320, 1350, 1308, 1364, 1392, 1436, 1478, 1476];
  const along = (arr, t) => { const x = t * (arr.length - 1); const i = Math.max(0, Math.min(arr.length - 2, Math.floor(x))); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
  const side = Math.max(400, Math.min(540, 600 - 6 * n));
  const span = Math.max(1, lastAt - first);
  const L0 = Math.min(first + SHIFT, endAt - ALONE);
  const squeeze = Math.max(0, Math.min(1, (endAt - ALONE - L0) / span));
  const pile = shots.map((s, k) => {
    const leave = Math.round(L0 + (landAt[k] - first) * squeeze);
    if (frame < landAt[k] || frame >= leave) return null;
    const a = Math.max(0.72, Math.min(1.6, Number(s.aspect) || 1));
    const S = side * (0.82 + 0.36 * random("pile-size-" + k));
    const w = Math.round(a >= 1 ? S : S * a);
    const hh = Math.round(a >= 1 ? S / a : S);
    const t = n > 1 ? k / (n - 1) : 0;
    const cx = Math.max(24 + w / 2, Math.min(width - 24 - w / 2, along(PX, t)));
    const cy = Math.max(150 + hh / 2, Math.min(1770 - hh / 2, along(PY, t)));
    return h("div", { key: "p" + k, style: { position: "absolute", left: Math.round(cx - w / 2), top: Math.round(cy - hh / 2), width: w, height: hh, overflow: "hidden" } },
      h(Footage, { shot: k, at: landAt[k], style: { left: 0, top: 0, width: w, height: hh } }));
  });

  // 2. Its words, in front of the pile: one per line, in pairs (a wider gap between two pairs), very condensed yellow
  // capitals, the same size for all (one box shrinks them together for a long word), centred clear of the app's buttons.
  // More than four words: four lines at most, the longest as short as can be, never a line ending on an article or
  // a preposition that belongs to the next word.
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const SHORT = /^(le|la|les|de|du|des|un|une|à|au|aux|en|et|ou|par|pour|sur|chez|the|a|an|of|my|is|on)$/i;
  const lines = (text) => {
    const words = String(text || "").toUpperCase().split(/[ \t\n]+/).filter(Boolean);
    if (words.length <= 4) return words;
    let best = null;
    const weigh = (groups) => {
      const longest = Math.max.apply(null, groups.map((g) => g.join(" ").length));
      const loose = groups.slice(0, -1).filter((g) => SHORT.test(g[g.length - 1])).length;
      const score = longest + 3 * loose - 0.1 * groups.length;
      if (!best || score < best.score) best = { score, groups };
    };
    const cut = (start, left, acc) => {
      if (left === 1) return weigh(acc.concat([words.slice(start)]));
      for (let stop = start + 1; stop <= words.length - left + 1; stop++) cut(stop, left - 1, acc.concat([words.slice(start, stop)]));
    };
    for (let k = 2; k <= 4; k++) cut(0, k, []);
    return best.groups.map((g) => g.join(" "));
  };
  const word = { fontFamily: display, fontWeight: 900, fontSynthesis: "none", fontSize: 163, lineHeight: "216px", height: 216, letterSpacing: "-0.005em", color: YELLOW, whiteSpace: "nowrap", textAlign: "center" };
  const stack = (words, key, top, tall, align) => h(FitText, { key, style: { position: "absolute", left: 140, top, width: width - 280, height: tall }, innerStyle: { justifyContent: align || "center" } },
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
      words.map((w, i) => h("div", { key: i, style: { ...word, marginTop: i > 0 && i % 2 === 0 ? 72 : 0 } }, w))));
  const shownWords = hook && frame >= hook.from && frame < endAt ? stack(lines(hook.text), "words", 430, 1000) : null;
  // Any other text of the Reel (none in its slots): a plain line on a white pill at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 120 + i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: INK, textAlign: "center" } },
      h("span", { style: { background: "#ffffff", padding: "8px 22px", borderRadius: 40 } }, t.text)));

  // 3. Its ending card, on the white once the pile has gone: its title stacked in the words' style, a line under it.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, null,
        stack(lines(end.title), "card", 300, 910, end.subtitle ? "flex-end" : "center"),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1236, width: width - 280, height: 200 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 58, lineHeight: 1.2, color: INK, textAlign: "center", textWrap: "balance" } }, keep(end.subtitle))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#fdfdfd" } }, pile, shownWords, extra, ending);
}`;

export const pile: MontageSkill = {
  key: "pile",
  version: 1,
  bpm: BPM,
  shots: [8, 30],
  files: [6, 16],
  how: "Ses photos se posent une à une, d'un coup, sur une page blanche, du haut vers le bas en zigzag, vite puis plus lentement pour les dernières, derrière quelques grands mots jaunes empilés en capitales très serrées ; la pile pleine tenue un instant, elles repartent dans l'ordre où elles sont arrivées, et les mots finissent seuls sur le blanc.",
  end: true,
  texts: [
    {
      slot: "mots",
      role: "hook",
      want: "2 à 4 mots courts, empilés en très grand un par ligne, qui disent qui on est ou ce qu'on montre, sans phrase de pub (une forme comme « voici notre travail », « ça, c'est nous », « fait main à Lyon »)",
      max: 26,
      required: true,
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const { step, slow } = cadence(n);
    const build = gaps(n).reduce((a, b) => a + b, 0);
    // The build, the full pile held, the pile leaving at the pace it came, the words alone (or a beat, then the card).
    // Its card lasts the engine's 1,6 s at least, whatever the tempo.
    const beats = build + HOLD + build + (end ? ALONE_BEFORE_CARD + Math.max(CARD, CARD_SECONDS / beat) : ALONE);
    // Its code lays each photo on its own beat subdivision and plays a video from there: the slots only say how long
    // each one moves, the same for all (no passage longer than the others, and an even montage if the code cannot run).
    const spans = beatSpans(bpm, Array.from({ length: n }, () => beats / Math.max(1, n)));
    const duration = spans.at(-1)!.end;
    const wants = spans.map((_, i) =>
      i === 0
        ? "la première photo, posée en haut de la page : la plus forte de son travail"
        : i < spans.length - 1
          ? "une photo ou un passage de son travail, posé d'un coup sur la pile (une vidéo bouge un instant juste après s'être posée)"
          : "la dernière posée, en bas de la pile : elle reste la dernière avant que les mots finissent seuls",
    );
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its words are there from the first image to the end, or to the card.
      texts: { mots: { from: 0, to: Math.round((end ? duration - CARD_SECONDS : duration) * 100) / 100 } },
      marks: {
        beat: beat * 30,
        step,
        slow,
        shift: toFrame((build + HOLD) * beat),
        alone: toFrame((end ? ALONE_BEFORE_CARD : ALONE) * beat),
      },
    };
  },
  code: CODE,
};
