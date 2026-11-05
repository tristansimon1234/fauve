import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Carte au feutre », version 2, written again on its original's fiche (docs/fiches/carte-feutre.md: measured image by
// image at 30 i/s, the notebook of each step found on the pixels that do not change while the photos pass under it, its
// music measured; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). An open
// notebook, photographed, cut out and laid over her pictures, which pass under it in stop motion; her message written on
// it by hand in red felt-tip capitals, a word at a time. Its music is a slow beat at 135 BPM played in half time, every
// length below in its beats from the Reel's start, so its words land where the original's do (within two images):
//   0 – 2       the notebook still empty, tilted left, her pictures passing under it (the hook: nothing written, all
//               passing); the music comes in at 0,65 beat, its first bass hit on beat 1,5;
//   2 – 11      her words, one at a time on the original's moments (a short word with the next one, « & COME »), each
//               on a change of picture, the notebook taking a new pose with each (4 to 7°, left and right in turn);
//   12,5 – 13,5 the music stops dead a beat; the name she announces lands in that blank, two images before its reprise,
//               the biggest line, the notebook straight;
//   to 20,25    her whole sentence held on the reprise, her pictures still passing; the sound fades over the last second;
//               no ending card, no black (her ending card, an offer, only when she has one).
// Under it, a new picture every 3 images (a tenth of a second, never on the music), her pictures always in her order,
// round after round: a photo the same image each time, a video a little further on each time it comes back (stop
// motion; Tristan: « si photos envoyées, figées ; si vidéos, ça joue »); full frame, or, when most of her pictures are in
// width, two bands of them above and under the notebook, changing one after the other (its format setting). The notebook
// is drawn: two pages of warm light grey paper, its binding across the middle with its stitches, the top page darker
// just before it, corners hardly rounded, a notch at the fold, no shadow; it moves only with each word. Her words in the
// original's red (#b20b21), or in her colour when it is dark enough to read on its paper; a hand that never repeats
// (Handwriting: each letter a little different, each line across the notebook's width, a grease pencil's grain), in
// Covered By Your Grace, the closest to the original's tall narrow capitals, stretched to their height. Nothing of the
// original's own is copied: its words, its night's name, its menus' red writing are its brand; hers are written here.

const BPM = 135;
/** Her pictures change every this many images (a tenth of a second at 30 i/s, never on the music). */
const TICK = 3;
/**
 * Its words land on the original's images 27, 52, 72, 99, 123 and 147 (« PUT », « THAT », « PHONE », « DOWN »,
 * « & COME », « TO »), the name on 177 (« BURGER NIGHT »), in beats from the Reel's start (13,33 images a beat).
 */
const ARRIVALS = [27, 52, 72, 99, 123, 147].map((f) => f / 13.3333);
const NAME = 177 / 13.3333;
/** Its music comes in at 0,29 s after nine silent images, its first bass hit on beat 1,5 (0,67 s). */
const LATE = 0.65;
const DOWNBEAT = 1.5;
/** It stops dead one beat (5,57 – 5,93 s: the name lands in it) and comes back on the first beat of a bar (5,97 s). */
const BLANK = [12.5, 13.5] as const;
/** Its 9 s (270 images) in beats; its sound fades over the last second. */
const LENGTH = 20.25;
const FADE = 2.25;
/** The engine's ending card: the Reel's last 1,6 s; whole beats more for it, only when she has one. */
const CARD_SECONDS = 1.6;
const round = (s: number) => Math.round(s * 100) / 100;
const round3 = (s: number) => Math.round(s * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const TICK = 3;
  const t = Math.floor(frame / TICK);

  // Its pictures full frame, as the original's; or, when most of hers are in width (or she asks), two bands of them
  // above and under the notebook (a horizontal picture whole in each, almost 16:9), changing one after the other.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const bands = format === "bandes" || (format === "auto" && wideShots * 2 > n);

  // 1. A new picture every 3 images, hers in her order, round after round: a photo the same image each time it comes
  // back; a video 3 images further on its passage each time (stop motion: each of its images held while it shows).
  // Warm and saturated, as the original's flash photos (the notebook never takes their light).
  const tone = "sepia(0.1) saturate(1.12)";
  const picture = (k, style) => {
    const i = k % n;
    const s = shots[i];
    const m = s && s.kind === "video" ? Math.min(Math.max(0, s.durationInFrames - 1), Math.floor(k / n) * TICK) : 0;
    return h(Footage, { key: "p" + k, shot: i, at: frame - m, style: { position: "absolute", ...style, filter: tone } });
  };
  const BAND = Math.round(height / 3);
  const pictures = !n
    ? null
    : bands
      ? [picture(2 * Math.floor((t + 1) / 2), { left: 0, top: 0, width, height: BAND }), picture(2 * Math.floor(t / 2) + 1, { left: 0, top: height - BAND, width, height: BAND })]
      : picture(t, { left: 0, top: 0, width, height });

  // 2. Her words: her message, then the name she announces (its last line, the biggest), in capitals. Her message in at
  // most three lines, the longest as short as can be: two lines on the top page, the rest and the name on the bottom one.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const up = (s) => keep(s).toLocaleUpperCase("fr").replace(/\s+/g, " ").trim();
  const message = reelTexts.find((x) => x.role === "hook");
  const named = reelTexts.find((x) => x.role === "caption");
  const others = reelTexts.filter((x) => x !== message && x !== named);
  const msg = up(message && message.text);
  const nm = up(named && named.text);
  const words = msg ? msg.split(" ") : [];
  const length = (s) => Array.from(s).length;
  const split = (list, k) => {
    let best = null;
    const go = (start, left, acc) => {
      if (left === 1) {
        const lines = acc.concat([list.slice(start).join(" ")]);
        const most = Math.max.apply(null, lines.map(length));
        if (!best || most < best.most) best = { most, lines };
        return;
      }
      for (let stop = start + 1; stop <= list.length - left + 1; stop++) go(stop, left - 1, acc.concat([list.slice(start, stop).join(" ")]));
    };
    if (list.length) go(0, Math.max(1, Math.min(k, list.length)), []);
    return best ? best.lines : [];
  };
  const lines = split(words, Math.max(1, Math.min(3, Math.round(length(msg) / 11))));
  const topLines = lines.slice(0, 2);

  // When each word lands: a word of one or two letters (or « & ») with the next one, the one before the name alone; on
  // the original's moments, sampled along them for another count, each on a change of picture; the name in the music's
  // blank, two images before its reprise.
  const A = [0, 1, 2, 3, 4, 5].map((k) => mark("a" + k, NaN)).filter(Number.isFinite);
  const along = (arr, x) => { const p = x * (arr.length - 1); const i = Math.max(0, Math.min(arr.length - 2, Math.floor(p))); return arr.length > 1 ? arr[i] + (arr[i + 1] - arr[i]) * (p - i) : arr[0] || 0; };
  const snap = (f) => Math.max(TICK, Math.round(f / TICK) * TICK);
  const short = (w) => length(w.replace(/[.,!?;:…'’"«»()]/g, "")) <= 2;
  const ends = [];
  words.forEach((w, i) => { if (!short(w) || i === words.length - 1) ends.push(i + 1); });
  const lands = [];
  ends.forEach((_, k) => { const f = snap(ends.length > 1 ? along(A, k / (ends.length - 1)) : A[0]); lands.push(Math.max(f, k ? lands[k - 1] + TICK : f)); });
  const NAME_AT = snap(mark("name", 177));
  const named_ = Boolean(nm) && frame >= NAME_AT;
  const passed = lands.filter((f) => frame >= f).length;
  let shown = passed ? length(words.slice(0, ends[passed - 1]).join(" ")) : 0;
  if (named_) shown = length(words.concat([nm]).join(" "));
  const topLength = length(topLines.join(" "));

  // 3. The notebook: one of its eight poses (the original's, measured: its centre as shares of the frame, its angle), a
  // new one with each word, left and right in turn, the last one straight when the sentence is whole; a little
  // perspective (its outline's bottom 1 to 2,5 % wider than its top: a flat outline, never a 3D transform, which the
  // scene check's hundred copies could not lay in time) and a size a hair different each time. Still between two words.
  const POSES = [[0.5, 0.53, -7.3], [0.498, 0.525, 4], [0.514, 0.5, -4.3], [0.499, 0.53, -0.3], [0.5, 0.527, 4.5], [0.497, 0.523, 4.3], [0.504, 0.511, -5.3], [0.527, 0.502, -0.4]];
  const card = Boolean(end) && frame >= endAt;
  const step = card ? 8 : named_ ? 7 : passed;
  const pose = card ? [0.5, 0.515, 0] : step === 7 ? POSES[7] : step ? POSES[1 + ((step - 1) % 6)] : POSES[0];
  const NW = Math.round(width * 0.665);
  const NH = Math.round(height * 0.41);
  const sc = (1 + (random("carnet-s-" + step) - 0.5) * 0.03).toFixed(4);
  const FOLD = Math.round(NH * 0.495);
  const R = Math.round(NW * 0.02);
  const C = Math.round(NW * 0.009);
  const T = Math.round(NW * (0.005 + 0.0075 * random("carnet-p-" + step)));
  const inset = (y) => Math.round(T * (1 - y / NH));
  const L = (x, y) => " L" + x + " " + y;
  const arc = (x, y) => " A" + R + " " + R + " 0 0 1 " + x + " " + y;
  const shape = "path('M" + (T + R) + " 0 H" + (NW - T - R) + arc(NW - T, R) + L(NW - inset(FOLD - C), FOLD - C) + L(NW - inset(FOLD) - C, FOLD) + L(NW - inset(FOLD + C), FOLD + C) + L(NW, NH - R) + arc(NW - R, NH) + " H" + R + arc(0, NH - R) + L(inset(FOLD + C), FOLD + C) + L(inset(FOLD) + C, FOLD) + L(inset(FOLD - C), FOLD - C) + L(T, R) + arc(T + R, 0) + " Z')";

  // Its ink: the original's red; her colour when it is dark enough to read on its paper (on her word, the red always).
  const rgb = (c) => { const x = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); if (!x) return null; const v = parseInt(x[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const lin = (s) => { const v = s / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const own = rgb(brand.accent);
  const dark = own && 0.2126 * lin(own[0]) + 0.7152 * lin(own[1]) + 0.0722 * lin(own[2]) <= 0.12;
  const ink = setting("encre", "sienne") === "sienne" && dark ? String(brand.accent).toLowerCase() : "#b20b21";

  // Its lines written by a hand that never repeats, at the left, each across the page's width, its capitals stretched to
  // the original's height (tall and narrow): two lines on the top page, the third under the binding, and the name she
  // announces under it, the biggest line (the original's 10,5 % of the image, the others 6,9 to 8,3 %): written apart and
  // stretched further, as far as its width lets it fill the rest of the page, its letters tighter.
  const hand = "'Covered By Your Grace', '" + brand.displayFont + "', cursive";
  const STRETCH = 1.45;
  const page = (rows, y, hh, upTo, seed, stretch, tight) => rows.length && upTo > 0
    ? h("div", { key: seed, style: { position: "absolute", left: 0, top: y, width: NW, height: hh, transformOrigin: "50% 0%", transform: "scaleY(" + stretch.toFixed(3) + ")" } },
        h(Handwriting, { text: rows.join("\n"), box: { x: Math.round(NW * 0.018), y: 0, w: Math.round(NW * 0.964), h: Math.round(hh / stretch) }, upTo, color: ink, grain: 0.6, wobble: 1, last: 1, align: "left", style: { fontFamily: hand, fontWeight: 400, ...(tight ? { letterSpacing: "-0.02em" } : {}) }, seed }))
    : null;
  const topH = Math.round(NH * 0.4);
  const third = lines[2] || null;
  const nameTop = Math.round(NH * (third ? 0.713 : 0.535));
  const nameH = Math.round(NH * 0.965) - nameTop;
  const nameStretch = Math.max(STRETCH, Math.min(2.2, (0.9 * nameH) / (0.72 * ((NW * 0.964) / (Math.max(4, length(nm)) * 0.38)))));
  let writing = [
    page(topLines, Math.round(NH * 0.045), Math.round((topH * Math.max(1, topLines.length)) / 2), Math.min(shown, topLength), "carnet-haut", STRETCH),
    third ? page([third], Math.round(NH * 0.535), Math.round(NH * 0.163), Math.min(length(third), Math.max(0, shown - topLength - 1)), "carnet-bas", STRETCH) : null,
    nm ? page([nm], nameTop, nameH, named_ ? length(nm) : 0, "carnet-nom", nameStretch, true) : null,
  ];
  // 4. Its ending card, when she has one (the original has none): the notebook straight, written anew at once, her title
  // on the top page, its line on the bottom one.
  if (card) {
    const rows = (s) => { const t = up(s); return split(t.split(" ").filter(Boolean), Math.max(1, Math.min(2, Math.round(length(t) / 11)))); };
    const title = rows(end.title);
    const sub = end.subtitle ? rows(end.subtitle) : [];
    writing = [page(title, Math.round(NH * 0.045), topH, 999, "carte-titre", STRETCH), page(sub, Math.round(NH * 0.535), Math.round((NH * 0.42 * sub.length) / 2), 999, "carte-ligne", STRETCH)];
  }
  const notebook = h("div", { style: { position: "absolute", left: Math.round(width * pose[0] - NW / 2), top: Math.round(height * pose[1] - NH / 2), width: NW, height: NH, transformOrigin: "50% 50%", transform: "rotate(" + pose[2] + "deg) scale(" + sc + ")" } },
    h("div", { style: { position: "absolute", left: 0, top: 0, width: NW, height: NH, clipPath: shape, background: "linear-gradient(180deg, #dcdad0 0%, #dad8cf 36%, #d6d4ca 41.5%, #c4c3b9 46.5%, #b7b6ad 49.3%, #a6a59d 49.5%, #c6c5bc 50%, #d9d8cf 52%, #dbdad1 70%, #d8d7ce 100%)" } },
      h("div", { style: { position: "absolute", left: 0, top: FOLD - 2, width: NW, height: 4, background: "repeating-linear-gradient(90deg, rgba(88,87,80,0.55) 0px, rgba(88,87,80,0.55) 4px, rgba(0,0,0,0) 4px, rgba(0,0,0,0) 23px)" } })),
    writing);

  // Any other text of the Reel (none in its slots): a plain white line above the notebook, so nothing she wrote is lost.
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const extra = others.filter((x) => frame >= x.from && frame < x.to && frame < endAt).map((x, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 220 + i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 56, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.6), 0 2px 14px rgba(0,0,0,0.35)" } }, keep(x.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, pictures, notebook, extra);
}`;

export const carteFeutre: MontageSkill = {
  key: "carte-feutre",
  // 2: written again on its original's fiche: an open notebook laid over her pictures (no hand, no shadow), a new picture
  // every 3 images in her order round after round, her words one at a time on the original's moments with a new pose of
  // the notebook each (4 to 7°), the name she announces in the music's one-beat blank; 135 BPM in half time (v1 counted
  // 72), its late start, its blank and its fading end; a hand that never repeats; two bands for her pictures in width.
  version: 2,
  bpm: BPM,
  shots: [10, 25],
  files: [10, 25],
  how: "Un carnet ouvert, gris clair, posé au milieu de l'écran par-dessus ses photos qui défilent en stop motion, une nouvelle toutes les 3 images (un dixième de seconde), toujours dans son ordre, tour après tour (une vidéo y avance un peu à chaque tour) ; en deux bandes au-dessus et au-dessous du carnet quand la plupart de ses images sont horizontales. Le carnet reste vide une seconde, puis son message s'y écrit à la main au feutre rouge en capitales, un mot à la fois (un petit mot avec le suivant), le carnet changeant de pose à chaque mot ; le nom de ce qu'elle annonce arrive d'un coup, la plus grande ligne, dans le blanc de la musique ; la phrase entière reste jusqu'à la fin, les photos défilant toujours. Le milieu des images est caché par le carnet.",
  end: true,
  texts: [
    {
      slot: "message",
      role: "hook",
      want: "le début de son message, écrit à la main sur le carnet un mot à la fois, qui amène le nom de ce qu'elle annonce : une invitation dite simplement comme on l'écrit sur un carnet (une forme comme « ce jeudi on vous attend pour la », « viens fêter l'été avec nous à la »), 4 à 7 mots, sans slogan",
      max: 32,
      required: true,
    },
    {
      slot: "nom",
      role: "caption",
      want: "le nom de ce qu'elle annonce, qui finit la phrase en plus grand (« soirée jazz », « pizza du jeudi », « brunch »), 1 à 3 mots",
      max: 16,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "la place de ses images sous le carnet : plein écran comme l'original, ou en deux bandes au-dessus et au-dessous du carnet (pour des images horizontales)",
      choices: [
        { value: "auto", says: "comme ses images : plein écran, ou deux bandes quand la plupart sont horizontales" },
        { value: "vertical", says: "chaque image plein écran, comme l'original (une image horizontale y est recadrée)" },
        { value: "bandes", says: "deux bandes d'images horizontales entières au-dessus et au-dessous du carnet, qui changent l'une après l'autre" },
      ],
    },
    {
      name: "encre",
      want: "la couleur de l'encre",
      choices: [
        { value: "sienne", says: "sa couleur quand elle est assez foncée pour se lire sur le papier gris, sinon le rouge de l'original" },
        { value: "rouge", says: "le rouge du feutre de l'original" },
      ],
    },
  ],
  // Its code warms her pictures itself and draws a notebook that never takes their light: none of its model's finish on
  // the whole Reel (its contrast, its warmth and its flash would light the notebook, its grain would move on it).
  finish: { exposure: 0, contrast: 0, saturation: 0, warmth: 0, split: 0, grain: 0, vignette: 0, fade: 0, flash: 0 },
  timeline(n, options) {
    // At another tempo (a longer Reel, a music's own): every length in beats follows it; her pictures keep their pace.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const card = options.end ? Math.ceil(CARD_SECONDS / beat - 1e-6) : 0;
    // Its code shows her pictures in turn, one every 3 images, each coming back round after round: its slots say which
    // picture is which (and the even montage played if the composition cannot), each as long as the others.
    const count = Math.max(1, n);
    const spans = beatSpans(bpm, Array.from({ length: count }, () => (LENGTH + card) / count));
    const duration = spans.at(-1)!.end;
    const wants = spans.map((_, i) =>
      i === 0
        ? "l'image qui ouvre le Reel sous le carnet encore vide : la plus forte et la plus colorée, ce qui compte en haut ou en bas de l'image (le milieu est caché par le carnet)"
        : "une photo de son lieu en action (ou un instant d'une vidéo, qui avance un peu à chaque tour), vue un dixième de seconde sous le carnet à chaque tour : ses plats ou ses produits vus de dessus, des gens à table, son équipe, ses imprimés, un détail ; ce qui compte en haut ou en bas de l'image (le milieu est caché), d'une autre lumière que la précédente",
    );
    // The name on its tick, as its code lands it.
    const nameAt = Math.round(toFrame(NAME * beat) / 3) * 3;
    const to = options.end ? round(duration - CARD_SECONDS) : duration;
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her message from the first image (written a word at a time on its moments), the name from its landing, both to
      // the end (or her ending card).
      texts: { message: { from: 0, to }, nom: { from: round(nameAt / 30), to } },
      marks: { beat: round3(beat * 30), ...Object.fromEntries(ARRIVALS.map((b, k) => [`a${k}`, toFrame(b * beat)])), name: toFrame(NAME * beat) },
      // Its music: in after nine silent images, its first bass hit on beat 1,5; stopped dead a beat for the name, back on
      // the first beat of a bar; its sound fading over the last second, to the end (or her ending card's).
      music: {
        downbeat: round3(DOWNBEAT * beat),
        pauses: [
          { from: 0, to: round3(LATE * beat) },
          { from: round3(BLANK[0] * beat), to: round3(BLANK[1] * beat) },
        ],
        end: { at: duration, fade: round(FADE * beat) },
      },
    };
  },
  code: CODE,
  fonts: ["Covered By Your Grace"],
};
