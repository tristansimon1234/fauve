import { burstTimes } from "../sfx.ts";
import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Pile de photos », version 3, written again on its original's fiche (docs/fiches/pile.md: measured image by image at
// 30 i/s, each photo's landing, box and leaving found on the differences of its images, its clicks on its sound; Tristan:
// « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). The original has no cut and no
// tempo: one white page where 37 photos land and leave, on a clicking that slows down like a wheel over a held chord.
// Its landmarks fall on a grid of 120 BPM (a beat every 15 images): each photo stays 8 beats (its 120 images), the pile
// is empty on beat 16 (its dry hit, 7,96 s), its words alone 2 beats at the end. Every length below is in those beats,
// so its moments fall where the original's do (within two images) on her music, composed at 120:
//   0 – 0,2     the white page and her words alone (3 images);
//   0,2 – 5     her photos land at once, in a burst, one every 0,18 beat (2 or 3 images: 11 a second), down the page in a
//               zigzag (the original's 37 boxes), each one over the one before, half covering it, cropped square (three
//               in portrait, as the original's), never moving, no border, no shadow;
//   5 – 8,6     the nine last land slower and slower (4, 5, 4, 6, 6, 6, 7, 9 and 7 images apart);
//   8,2 – 16,3  each one leaves 8 beats after it landed, at once: the pile empties from the top at the pace it was made,
//               the top going while the last two land below (no full pile held); the second-last leaves on beat 16, the
//               pile empty on its dry hit, the last one a third of a beat after;
//   16,3 – 18,3 her words alone on the white, the music lighter (without its bass) since the hit.
// Her words (a phrase of 2 to 4 short words) stand in front of everything from the first image to the last, one a line in
// pairs, very condensed bold capitals at the original's size (Anton squeezed to two thirds, its letters being 1,5 times
// wider at the same height, its bars thickened as the original's), in her colour: its yellow and its words are the
// original's own, never copied. Her photos stay still, her videos play while they lie on top of the pile (Tristan: « si
// photos envoyées, figées ; si vidéos, ça joue »); its format setting crops them square as the original, or keeps their
// own shape, or all in portrait, on her word; the Reel stays vertical, a white page. Its clicks as they slow down are
// laid as its own sounds, its densest first second as one burst, then on their measured moments, then a dry knock on
// the hit; no paper sound on each photo: its
// original has none. Its page is plain white, without grade: her photos keep their colours. Its ending card (an offer,
// an announcement), in option.

const BPM = 120;
/** The first photo lands at the original's image 3 (beats); the burst after it on the line through its 28 landings: one every STEP from CADENCE (its image 2). */
const FIRST = 0.2;
const CADENCE = 2 / 15;
const STEP = 0.18;
/** The gaps before its nine last photos (beats: its 4, 5, 4, 6, 6, 6, 7, 9 and 7 images, a beat being 15 of them). */
const SLOWING = [4, 5, 4, 6, 6, 6, 7, 9, 7].map((f) => f / 15);
/** Each photo stays this long (beats: its 120 images). */
const STAY = 8;
/** The second-last leaves on the hit, a whole beat; the last this long after it (beats: 5 images). */
const LAST_AFTER = 1 / 3;
/** Its words alone on the white at the end (beats: its last second), or before the ending card. */
const ALONE = 2;
const ALONE_BEFORE_CARD = 1;
/** The ending card's beats: the engine's last 1,6 s at least. */
const CARD = 3.25;
const CARD_SECONDS = 1.6;
/**
 * Its clicking as it slows down, measured on the original's sound (s on its clock, and how strong each attack is next to
 * its hit): 40 clicks a second at 0,3 s, 17 at 1,5, 10 at 2,3, 6 at 3,3, 4 at 4,3, 2 at 6,4, up to its dry hit at 7,962 s,
 * the loudest of its sound. Laid one by one from 1,6 s, where they are two images apart or more and its photos land on
 * them, each at its own strength, its hit 6 dB up; before, too dense for one sound a frame, as one burst (BURST).
 */
const CLICKS: [number, number][] = [
  [1.599, 0.19], [1.669, 0.31], [1.736, 0.47], [1.808, 0.4], [1.884, 0.22], [1.962, 0.45], [2.032, 0.21], [2.123, 0.27], [2.223, 0.24], [2.321, 0.27],
  [2.425, 0.2], [2.519, 0.2], [2.646, 0.28], [2.768, 0.21], [2.889, 0.22], [3.03, 0.22], [3.185, 0.19], [3.347, 0.19], [3.518, 0.2], [3.704, 0.23],
  [3.913, 0.23], [4.135, 0.18], [4.377, 0.06], [4.656, 0.25], [4.957, 0.29], [5.303, 0.27], [5.693, 0.18], [6.137, 0.74], [6.654, 0.17], [7.272, 0.44],
];
const HIT_AT = 7.962;
/**
 * Its clicking before 1,6 s, too dense to lay a click a frame (its fiche measured its pace, not each click): one burst
 * from its first photo (0,1 s) to 1,54 s, a click before the first one laid alone, its pace falling evenly from 46 to
 * 16,5 a second (the line through its two measures, 40 at 0,3 s and 17 at 1,5), each as soft as its quietest measured ones.
 */
const BURST = { from: 0.1, to: 1.54, pace: [46.3, 16.5] as const, strength: 0.2 };
const CLICK = { sound: "light click", seconds: 0.5 };
const KNOCK = { sound: "dry knock", seconds: 0.5, gain: 6 };
/** A click's gain (dB): its strength next to the hit's, from the hit's +6, never under -12. */
const clickGain = (strength: number) => Math.round(Math.max(-12, Math.min(6, 6 + 20 * Math.log10(strength))) * 10) / 10;
const round = (n: number) => Math.round(n * 100) / 100;

/** When each of n photos lands (beats from the start): the first at FIRST, the burst on its line, its nine last on the original's slowing gaps. */
export function pileLandings(n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    if (k === 0) out.push(FIRST);
    else if (k < n - SLOWING.length) out.push(CADENCE + k * STEP);
    else out.push(out[k - 1]! + SLOWING[k - (n - SLOWING.length)]!);
  }
  return out;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames;
  const FIRST = Math.max(0, Math.round(mark("first", 3)));
  const STAY = Math.max(1, Math.round(mark("stay", 120)));
  const HIT = Math.round(mark("hit", durationInFrames - 35));
  const LAST = Math.max(HIT + 1, Math.round(mark("last", HIT + 5)));
  const PAGE = "#fdfdfd";
  const INK = "#161616";
  const display = "'" + brand.displayFont + "', 'Anton', 'Arial Narrow', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");

  // 1. When each photo lands: on its own shot's first image (each shot lasts until the next one lands, so a video plays
  // while it lies on top of the pile, then holds), the first one a little after the start. Each one leaves STAY after it
  // landed, at once; the second-last on the hit (the pile empty on it), the last just after, the others in order before
  // them; a Reel cut shorter than planned brings them all in, so its words still end alone.
  const lands = shots.map((s, k) => (k === 0 ? (n > 1 ? Math.min(FIRST, Math.max(0, shots[1].from - 1)) : FIRST) : s.from));
  const planned = lands.map((at, k) => (k === n - 1 ? LAST : k === n - 2 ? HIT : Math.min(at + STAY, HIT - (n - 2 - k))));
  const first = n ? lands[0] : 0;
  const room = Math.max(1, endAt - Math.max(1, Math.round(mark("alone", 30))) - first);
  const squeeze = n && LAST - first > room + 1 ? room / (LAST - first) : 1;
  const leaves = planned.map((at) => Math.round(first + (at - first) * squeeze));

  // 2. Where each lands: in the original's box for it, its 37 measured at 1080 × 1920 (their centres down the page in a
  // zigzag, passes of 3 to 5 from one side to the other, each a seventh of the width over the one before and a little
  // lower; their sides from 26 to 50 % of the width, a third on average), sampled along them for another count, bigger
  // when there are fewer photos (the same surface), never past the page's edges. Cropped square as the original (its
  // 1st and 27th in portrait 2:3, its 35th in 4:5, to break the grid), at its own shape (between 3:4 and 4:3) or all in
  // portrait 4:5 on her word.
  const PX = [349, 425, 568, 721, 756, 617, 432, 362, 342, 477, 673, 734, 786, 623, 432, 298, 358, 540, 740, 766, 722, 516, 417, 302, 426, 586, 734, 817, 674, 470, 262, 308, 466, 667, 824, 772, 584];
  const PY = [511, 453, 426, 426, 528, 555, 588, 667, 756, 736, 759, 789, 848, 848, 897, 960, 1049, 991, 968, 1058, 1115, 1146, 1124, 1216, 1240, 1276, 1269, 1321, 1350, 1308, 1364, 1393, 1436, 1478, 1477, 1508, 1503];
  const PS = [34.7, 25.9, 44, 35.1, 35.6, 37.7, 33.9, 37.6, 40.8, 31.6, 37.7, 37.6, 35.1, 28.6, 34.2, 29.8, 35.7, 27.7, 31.5, 37.4, 37.4, 38.9, 41.5, 33.8, 33.8, 27.5, 50.2, 31.5, 31.6, 31.5, 31.5, 31.5, 31.4, 35.8, 35.1, 32.5, 33.5];
  const along = (arr, t) => { const x = t * (arr.length - 1); const i = Math.max(0, Math.min(arr.length - 2, Math.floor(x))); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
  const grow = Math.max(0.9, Math.min(1.45, Math.sqrt(37 / Math.max(1, n))));
  const format = setting("format", "carre");
  // The original's portraits at the same point of the pile: its first, its 27th (2:3) and its 35th (4:5), never its last.
  const tall = n > 2 ? [0, Math.min(n - 2, Math.round((26 / 36) * (n - 1))), Math.min(n - 2, Math.round((34 / 36) * (n - 1)))] : [0];
  const shapeOf = (k) => {
    if (format === "portrait") return 0.8;
    if (format === "forme") return Math.max(0.75, Math.min(4 / 3, Number(shots[k].aspect) || 1));
    return k === tall[2] && k !== tall[1] ? 0.8 : tall.indexOf(k) >= 0 ? 2 / 3 : 1;
  };
  const pile = shots.map((s, k) => {
    if (frame < lands[k] || frame >= leaves[k]) return null;
    const a = shapeOf(k);
    const t = n > 1 ? k / (n - 1) : 0;
    const side = (width * along(PS, t) * grow) / 100;
    const w = Math.round(side * Math.sqrt(a));
    const hh = Math.round(side / Math.sqrt(a));
    const cx = Math.max(width * 0.04 + w / 2, Math.min(width * 0.96 - w / 2, (along(PX, t) * width) / 1080));
    const cy = Math.max(height * 0.06 + hh / 2, Math.min(height * 0.93 - hh / 2, (along(PY, t) * height) / 1920));
    return h("div", { key: "p" + k, style: { position: "absolute", left: Math.round(cx - w / 2), top: Math.round(cy - hh / 2), width: w, height: hh, overflow: "hidden" } },
      h(Footage, { shot: k, at: lands[k], style: { left: 0, top: 0, width: w, height: hh } }));
  });

  // 3. Her words, in front of everything from the first image to the end (or the card): one a line, in pairs (a wider
  // gap between two pairs), very condensed bold capitals as tall as the original's (7,2 % of the frame), the same size
  // for all (one box shrinks them together for a long word), centred clear of the apps' buttons. Anton, the model's own
  // face, squeezed to two thirds as the original's letters are, its bars thickened as theirs; her own face as it is.
  // More than four words: four lines at most, the longest as short as can be, never a line ending on an article or a
  // preposition that belongs to the next word.
  const lum = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
    if (!m) return null;
    const v = parseInt(m[1], 16);
    const ch = (x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch((v >> 16) & 255) + 0.7152 * ch((v >> 8) & 255) + 0.0722 * ch(v & 255);
  };
  // Her colour when it shows on the white page at least as the original's yellow did there (a contrast of 1,3 to 1 or
  // more: it reads by its size, and better on the photos), else her dark colour, else ink.
  const shows = (c) => { const l = lum(c); return l !== null && (lum(PAGE) + 0.05) / (l + 0.05) >= 1.3; };
  const COLOR = shows(brand.accent) ? brand.accent : brand.palette && shows(brand.palette.dark) ? brand.palette.dark : INK;
  const SQUEEZE = /^anton$/i.test(String(brand.displayFont || "").trim()) ? 0.66 : 1;
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const SHORT = /^(le|la|les|de|du|des|un|une|à|au|aux|en|et|ou|par|pour|sur|chez|the|a|an|of|my|is|on)$/i;
  const lines = (text) => {
    // Her name is kept whole by no-break spaces (a title's): here each of its words goes on its own line.
    const words = String(text || "").replace(/(\p{L})\u00a0(?=\p{L})/gu, "$1 ").toUpperCase().split(/[ \t\n]+/).filter(Boolean);
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
  // At 1080 × 1920: capitals of 140 px, 73 px between two lines of a pair, 147 between two pairs, the block centred at
  // 48 % of the height (the original's 26 to 71 %). Squeezed Anton keeps the original's stems (17 px) but not its heavy
  // bars (35 px, Anton's 25): four copies of each letter 2 and 4 px above and under it, of its own colour, thicken its
  // bars only (and add those 8 px to its capitals, 132 px at this size).
  const thick = SQUEEZE < 1 ? { textShadow: [2, -2, 4, -4].map((y) => "0 " + y + "px 0 " + COLOR).join(", ") } : {};
  const word = { fontFamily: display, fontWeight: 900, fontSynthesis: "none", fontSize: SQUEEZE < 1 ? 154 : 160, lineHeight: "211px", height: 211, letterSpacing: "0.01em", color: COLOR, whiteSpace: "nowrap", textAlign: "center", ...thick };
  const W = Math.round((width - 280) / SQUEEZE);
  const stack = (list, key, mid, boxH, align) => h("div", { key, style: { position: "absolute", left: Math.round((width - W) / 2), top: Math.round(mid - boxH / 2), width: W, height: boxH, transform: SQUEEZE < 1 ? "scaleX(" + SQUEEZE + ")" : "none", transformOrigin: "50% 50%" } },
    h(FitText, { style: { position: "absolute", left: 0, top: 0, width: W, height: boxH }, innerStyle: { justifyContent: align || "center" } },
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
        list.map((w, i) => h("div", { key: i, style: { ...word, marginTop: i > 0 && i % 2 === 0 ? 74 : 0 } }, w)))));
  const shownWords = hook && frame >= hook.from && frame < endAt ? stack(lines(hook.text), "words", Math.round(height * 0.4845), 1000) : null;
  // Any other text of the Reel (none in its slots): a plain line on a white pill at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 120 + i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: INK, textAlign: "center" } },
      h("span", { style: { background: "#ffffff", padding: "8px 22px", borderRadius: 40 } }, t.text)));

  // 4. Its ending card, in option, on the white once the pile has gone: its title stacked in the words' style, a line
  // under it in ink.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, null,
        stack(lines(end.title), "card", end.subtitle ? 750 : 930, end.subtitle ? 900 : 1000, end.subtitle ? "flex-end" : "center"),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1230, width: width - 280, height: 200 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 58, lineHeight: 1.2, color: INK, textAlign: "center", textWrap: "balance" } }, keep(end.subtitle))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: PAGE } }, pile, shownWords, extra, ending);
}`;

export const pile: MontageSkill = {
  key: "pile",
  // 2: written again on its original's fiche: its burst on the original's frames, slowing down for its nine last, each
  // photo leaving 4 s after it landed (no full pile held), the pile empty on its dry hit; its 37 boxes, square but three;
  // its words as tall and as condensed as the original's, in her colour; her videos playing while they lie on top; its
  // clicks as they slow down and its hit, its music lighter after it; its page without grade.
  // 3: its clicking before 1,6 s laid too, as one burst (SkillSound.burst), denser than a frame.
  version: 3,
  bpm: BPM,
  shots: [8, 40],
  // Under 20 there is no burst left: Edith asks her first whether she has others (each video gives up to three photos).
  files: [20, 40],
  how: "Ses photos se posent d'un coup sur une page blanche, en rafale (une toutes les 2 ou 3 images), du haut vers le bas en zigzag, chacune par-dessus la précédente dont elle couvre la moitié, recadrées au carré, sans bord ni ombre, puis de plus en plus lentement pour les neuf dernières ; chacune repart d'un coup 4 secondes après s'être posée, la pile se vidant par le haut au rythme où elle s'est faite, vide sur un coup sec ; ses mots, en très grandes capitales serrées de sa couleur, un par ligne, restent devant du début à la fin et finissent seuls sur le blanc. Ses photos restent fixes, ses vidéos jouent tant qu'elles sont sur le dessus.",
  end: true,
  texts: [
    {
      slot: "mots",
      role: "hook",
      want: "2 à 4 mots courts, empilés en très grand un par ligne devant la pile, qui disent qui on est ou ce qu'on montre, sans phrase de pub (une forme comme « voici notre travail », « ça, c'est nous », « fait main à Lyon »)",
      max: 26,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "la forme de ses photos sur la page (le Reel reste vertical)",
      choices: [
        { value: "carre", says: "au carré, comme l'original (trois en portrait pour casser la grille), quelle que soit la forme de ses fichiers" },
        { value: "forme", says: "chacune à sa forme, comme ses fichiers (de 3:4 en hauteur à 4:3 en largeur)" },
        { value: "portrait", says: "toutes en portrait 4:5" },
      ],
    },
  ],
  // Its original has no grade on the whole (docs/fiches/pile.md, effect 6): the page stays white, each photo keeps its
  // colours; none of the catalogue's contrast and saturation laid over everything.
  finish: { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 },
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(2, n);
    const lands = pileLandings(count);
    // The pile is empty on a whole beat: the second-last leaves on it (beat 16 for its 37 photos), the last just after,
    // both a little early, as the original's last ones (4 to 16 images): those before them that would stay past it leave
    // just before it.
    const hit = Math.floor(lands[count - 2]! + STAY);
    const last = hit + LAST_AFTER;
    // Its words alone after it, or a beat of them and the ending card (the engine's 1,6 s at least, whatever the tempo).
    const total = last + (end ? ALONE_BEFORE_CARD + Math.max(CARD, CARD_SECONDS / beat) : ALONE);
    // Each shot from its landing to the next one's (the first from the start, the last to the end): its code lays each
    // photo on its shot's first image, and a video plays while it lies on top, then holds.
    const spans = beatSpans(bpm, lands.map((b, k) => (k < count - 1 ? lands[k + 1]! : total) - (k ? b : 0)));
    const duration = spans.at(-1)!.end;
    const wants = spans.map((_, i) =>
      i === 0
        ? "la première photo, posée en haut de la page : une belle photo de son travail, son sujet au centre"
        : i < spans.length - SLOWING.length
          ? "une photo de son travail (ou un instant d'une vidéo), posée d'un coup sur la pile et recadrée sur son sujet, vue au tiers de la largeur : un gros plan qui se lit petit, d'une autre couleur ou d'un autre cadrage que la précédente"
          : i < spans.length - 1
            ? "une photo de son travail, posée plus lentement vers le bas de la pile, de plus en plus belle (une vidéo y joue tant qu'elle est sur le dessus)"
            : "sa plus belle photo (ou vidéo), posée la dernière en bas de la pile : seule un instant quand les autres sont parties, juste avant que ses mots finissent seuls (une vidéo y joue tout du long)",
    );
    // Its clicks as they slow down, the original's, counted back from its hit (the photos of its burst land on them),
    // from its first photo: the densest as one burst, then one by one; then the dry knock on the hit, the loudest.
    const original = (t: number) => (hit - (HIT_AT - t) * 2) * beat;
    const dense = burstTimes(BURST.pace[0], BURST.pace[1], BURST.to - BURST.from)
      .map((t) => Math.round(original(BURST.from + t) * 1000) / 1000)
      .filter((t) => t >= FIRST * beat);
    const sounds: SkillSound[] = [
      ...(dense.length > 1
        ? [{ at: dense[0]!, ...CLICK, gain: clickGain(BURST.strength), burst: { times: dense.map((t) => Math.round((t - dense[0]!) * 1000) / 1000) } }]
        : []),
      ...CLICKS.map(([t, strength]) => ({ at: original(t), strength }))
        .filter((c) => c.at >= FIRST * beat)
        .map((c) => ({ at: Math.round(c.at * 1000) / 1000, ...CLICK, gain: clickGain(c.strength) })),
      { at: Math.round(hit * beat * 1000) / 1000, ...KNOCK },
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its words from the first image to the end, or to the card.
      texts: { mots: { from: 0, to: round(end ? duration - CARD_SECONDS : duration) } },
      marks: {
        beat: beat * 30,
        first: toFrame(FIRST * beat),
        stay: Math.round(STAY * beat * 30),
        hit: toFrame(hit * beat),
        last: toFrame(last * beat),
        alone: toFrame((end ? ALONE_BEFORE_CARD : ALONE) * beat),
      },
      sounds,
      // Since the hit, its music goes on lighter and clearer (the original's 10 dB lower, without its low notes): without
      // its bass to the end, which it reaches without fading (the original's sound runs past its last image).
      music: { filters: [{ kind: "thin", from: round(hit * beat), to: duration }], end: { at: duration, fade: 0.02 } },
    };
  },
  code: CODE,
};
