import { beatSpans, type MontageSkill } from "../skills.ts";

// « Cadre dans le cadre », version 2, written again on its original's fiche (docs/fiches/cadre.md: measured image by
// image at 30 i/s, its frame's box read at every image, its music and its labels; Tristan: « c'est un effet que l'on veut
// pouvoir faire, pas exactement reproduire l'image »). Its music is a lo-fi hip-hop beat at 90 BPM (v1 read 120), its
// first beat at 0, and every length below is in its beats, so its cuts fall where the original's do (within an image):
//   0 – 5,67   her widest shot of the place, frozen on one image in a dark, contrasted black and white, fills the
//              frame; at its middle (or in her door, window or mirror at the back of it, when the filler saw one there)
//              a frame with no edge, no shadow and square corners shows her pictures in colour, one an eighth note (a
//              half beat, 10 images), the first one her wide shot itself; at each cut the frame is a notch larger, at
//              once, from 15 % of the width to 95 % (17 notches, nothing moving between two: never a zoom), its 95 %
//              landing on the downbeat of the third measure;
//   5,67 – 6,33 her finest wide picture takes the whole frame at once, held a beat; the music is cut dead 0,2 beat
//              later (the original's 5,80 s), the end silent.
// Two small labels in white capitals stay on the middle line from the first image to the last, over everything (what
// is going on on the left, her name on the right, 13 % from either edge): set at the original's size, a decor text
// (Tristan, of the originals' tiny texts: « exception » for decor; the 48 px stay for what must be read). Fewer pictures:
// fewer, larger notches, the first ones a beat each, so the frame still reaches 95 % on that downbeat. Her photos stay
// still, her videos play (Tristan); her wide shot behind the frame is frozen, as the original's photo is: it is the
// effect. Its format follows her pictures (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du
// user »): the frame upright (2:3) as the original's, or lying (3:2) when most of her pictures are in width, the Reel
// full frame; or, on her word, all of it in a 16:9 picture on black. Nothing of the original's own is copied: its words
// (« WORK IN PROGRESS », « ARTSIRI SPACE ») give way to hers. It has no sound effect, no grain, no dark corners.

const BPM = 90;
/** Her pictures in the frame: half a beat each (an eighth note, as the original's), a beat each for the first ones when she has fewer. */
const STEP = 0.5;
const SLOW = 1;
/** The frame reaches its last notch on beat 8 (its music's downbeat) and the last picture takes the frame on beat 8,5. */
const WINDOW = 8.5;
/** The last picture, full frame: a beat (with an ending card, whole beats more for its 1,6 s at least). */
const FINAL = 1;
const END_CARD = 1.6;
/** Its music is cut dead this far after the last picture takes the frame (beats: the original's 5,80 s, 3 images after its 5,70). */
const SILENCE = 0.2;
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Its pictures in the frame for m of them, in beats: half a beat each as the original's, the first ones a beat each when
 * she has fewer than 17, so the frame still reaches its last notch on the downbeat of the third measure (beat 8); under
 * nine, all of them a beat each.
 */
export function frameBeats(m: number): number[] {
  const count = Math.max(1, Math.round(m));
  const window = Math.min(WINDOW, count * SLOW);
  const slow = Math.max(0, Math.min(count, Math.round((window - count * STEP) / (SLOW - STEP))));
  return Array.from({ length: count }, (_, i) => (i < slow ? SLOW : STEP));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const n = shots.length;
  const last = Math.max(0, n - 1);
  // Her pictures in the frame: every shot but the last (the first one is also her wide shot, frozen behind it); the
  // last one takes the whole frame at its cut.
  const m = Math.max(1, n - 1);
  const FULL = n > 1 ? shots[last].from : durationInFrames + 1;
  const cur = Math.min(m - 1, shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0));
  const endAt = end ? end.from : durationInFrames + 1;

  // Its format: the whole vertical frame, its frame upright (2:3) as the original's, or lying (3:2) when most of her
  // pictures in it are in width; on her word, all of it in a 16:9 picture on black (her wide shot whole).
  const format = setting("format", "vertical");
  const aspect = (s) => Number(s && s.aspect) || 0.5625;
  const lyingShots = shots.slice(0, m).filter((s) => aspect(s) > 1.15).length;
  const boxed = format === "horizontal";
  const lying = boxed || (format === "auto" && lyingShots * 2 > m);
  const bw = width;
  const bh = boxed ? Math.round((width * 9) / 16) : height;
  const by = boxed ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const A = lying ? 3 / 2 : 2 / 3;

  // 1. The frame: no edge, no shadow, square corners. At each cut it is a notch larger, at once, in equal notches from
  // 15 % of the picture's width to 95 % (of its height when the frame is the wider of the two: in 16:9), and nothing
  // moves between two cuts. Centred, as the original's; or opened first in her door, her window, her mirror at the back
  // of her wide shot (the filler named it, it was found there near the middle), its notches then going from that box to
  // the centred one.
  const across = A >= bw / bh;
  const sized = (k) => {
    const w = across ? bw * k : bh * k * A;
    const t = across ? w / A : bh * k;
    return { x: (bw - w) / 2, y: (bh - t) / 2, w, h: t };
  };
  const SMALL = 0.15;
  const LARGE = 0.95;
  const goal = sized(LARGE);
  const found = n > 1 ? SubjectBox(shots[0], shots[0].from, laid, "@porte") : null;
  const fits = (b) => Boolean(b) && b.w >= bw * 0.05 && b.w <= bw * 0.5 && b.h >= bh * 0.04 && b.h <= bh * 0.6 && b.w / b.h >= 0.25 && b.w / b.h <= 3 &&
    Math.abs(b.x + b.w / 2 - bw / 2) <= bw * 0.2 && Math.abs(b.y + b.h / 2 - bh / 2) <= bh * 0.2;
  const door = fits(found) ? found : null;
  const boxOf = (i) => {
    const t = m <= 1 ? 1 : Math.min(1, i / (m - 1));
    const b = door
      ? { x: door.x + (goal.x - door.x) * t, y: door.y + (goal.y - door.y) * t, w: door.w + (goal.w - door.w) * t, h: door.h + (goal.h - door.h) * t }
      : sized(SMALL + (LARGE - SMALL) * t);
    const w = Math.round(b.w);
    const t2 = Math.round(b.h);
    return { x: door ? Math.round(b.x) : Math.round((bw - w) / 2), y: door ? Math.round(b.y) : Math.round((bh - t2) / 2), w, h: t2 };
  };

  // 2. Behind it, her wide shot frozen on its first image, in a dark and contrasted black and white, until the last
  // picture takes the frame (the original's: a grey 26 % bright on average, half of it under 22 %, its blacks closed, its
  // whites at 87 %; this grade gives 26, 50 and 84 % on a glass-roofed passage of Budapest).
  const GREY = "grayscale(1) brightness(0.75) contrast(1.4)";
  const FAR = durationInFrames * 4 + 1000;
  // 3. Her pictures in colour in the frame, as she sent them (a photo still, a video playing), each covering it on its
  // subject; the first one her wide shot itself, in colour; then the last one takes the whole frame, at once.
  const b = boxOf(cur);
  const picture = n < 2
    ? h(Footage, { shot: 0, style: { left: 0, top: 0, width: bw, height: bh } })
    : frame >= FULL
      ? h(Footage, { shot: last, style: { left: 0, top: 0, width: bw, height: bh } })
      : h(React.Fragment, null,
          h(Footage, { shot: 0, at: FAR, style: { left: 0, top: 0, width: bw, height: bh, filter: GREY } }),
          h("div", { style: { position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: "hidden" } },
            h(Footage, { shot: cur, style: { left: 0, top: 0, width: b.w, height: b.h } })));

  // 4. Its ending card, only when the Reel has one (an option: the original ends on its last picture): that picture a
  // little darker, its title above the middle line, its line under it, the labels between them.
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Inter', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const shade = "0 0 1px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.45), 0 2px 12px rgba(0,0,0,0.25)";
  const fade = (a) => interpolate(frame, [a, a + 6], [0, 1], clamp);
  const veil = end && frame >= endAt ? h("div", { style: { position: "absolute", left: 0, top: 0, width: bw, height: bh, background: "#000000", opacity: 0.35 * fade(endAt) } }) : null;
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { key: "et", style: { position: "absolute", left: 140, top: 560, width: width - 280, height: 330 }, innerStyle: { justifyContent: "flex-end", fontFamily: display, fontWeight: 600, fontSize: 92, lineHeight: 1.02, letterSpacing: "-0.03em", color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade } },
          h("span", { style: { display: "inline-block", opacity: fade(endAt + 1) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { key: "es", style: { position: "absolute", left: 140, top: 1020, width: width - 280, height: 180 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.2, color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade } },
              h("span", { style: { display: "inline-block", opacity: fade(endAt + 6) } }, keep(end.subtitle)))
          : null)
    : null;

  // 5. Its two small labels, fixed from the first image to the last, over everything: what is going on on the left, her
  // name on the right, 13 % from either edge, on the middle line (its capitals centred on it), the frame passing under
  // them as it grows. As the original's: capitals 0,9 % of the frame's height (24 px at 1080 wide), medium weight,
  // normal spacing, pure white, no box; a tight dark edge a dark ground never shows (on a light picture they still
  // read). A decor text, at its original's size.
  const hook = reelTexts.find((t) => t.role === "hook");
  const caption = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== caption);
  const SIZE = 24;
  const MARGIN = Math.round(width * 0.13);
  const edge = "0 0 1px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)";
  const label = (t, side) => t && frame >= t.from && frame < t.to
    ? h("div", { key: side, "data-fauve-decor": "", style: { position: "absolute", [side]: MARGIN, top: Math.round(height / 2) - SIZE, height: SIZE * 2, display: "flex", alignItems: "center", fontFamily: body, fontWeight: 500, fontSize: SIZE, lineHeight: 1, letterSpacing: "0em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: edge } }, keep(t.text))
    : null;

  // Any other text of the Reel (none in its slots): a plain white line at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: boxed ? Math.max(100, by - 150 - i * 120) : 170 + i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: shade } }, keep(t.text)));

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, picture, veil);
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, ending, extra, label(hook, "left"), label(caption, "right"));
}`;

export const cadre: MontageSkill = {
  key: "cadre",
  // 2: written again on its original's fiche: its tempo (90) and its cuts (an eighth note each), its wide shot frozen in
  // a dark black and white, a notch at each cut from 15 % to 95 %, its door or window when there is one, its labels at its
  // size, its last picture full frame at once and its music cut dead, its format; no grain nor dark corners.
  // 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 3,
  bpm: BPM,
  shots: [8, 18],
  files: [4, 12],
  how: "Son plan le plus large du lieu, figé en noir et blanc sombre, remplit l'écran ; au milieu (ou dans sa porte, sa fenêtre, son miroir au fond, quand il y en a un), un cadre sans bord montre ses images en couleur, une nouvelle à chaque demi-temps, la première son plan large lui-même : à chaque coupe, le cadre grandit d'un cran, d'un coup, de 15 % à 95 % de la largeur ; puis sa plus belle image prend tout l'écran d'un coup et la musique se coupe net. Deux petites étiquettes blanches en capitales restent fixes à mi-hauteur, une à gauche, une à droite, tout le Reel. Le cadre est debout comme l'original, une image en largeur y est recadrée sur son sujet.",
  end: true,
  texts: [
    {
      slot: "gauche",
      role: "hook",
      want: "la petite étiquette de gauche, en capitales, fixe à mi-hauteur tout le Reel : ce qui se passe, 1 à 3 mots (une forme comme « travaux en cours », « nouvelle carte », « bientôt »)",
      max: 16,
      required: true,
    },
    { slot: "droite", role: "caption", want: "la petite étiquette de droite, au même ton : son nom, ou le nom du lieu", max: 16, required: true },
  ],
  objects: [
    {
      slot: "porte",
      shot: 0,
      want: "ce qui, au fond de son plan large et vers le milieu de l'image, peut accueillir le premier petit cadre : une porte au fond, une fenêtre, un miroir, un passe-plat, sa vitrine (« door », « mirror », « window », « shop window », « archway ») ; vide quand rien au milieu ne s'y prête (le cadre s'ouvre alors au centre exact, comme l'original)",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : le cadre debout en plein écran vertical comme l'original, tout en horizontal sur du noir, ou le cadre comme ses images",
      choices: [
        { value: "vertical", says: "comme l'original : le cadre debout (2:3) en plein écran vertical, ses vidéos en largeur recadrées sur leur sujet" },
        { value: "horizontal", says: "tout en horizontal 16:9 sur du noir : son plan large en entier, le cadre couché jusqu'au plein cadre", band: true },
        { value: "auto", says: "comme ses images : le cadre debout (2:3), ou couché (3:2) quand la plupart sont en largeur, en plein écran vertical" },
      ],
    },
  ],
  // Its original has neither grain nor dark corners (its fiche, effect 7): taken out of its model's finish.
  finish: { grain: 0, vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At its own tempo, or at a music's (a longer Reel, a sound she follows): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    // Its pictures in the frame (the first one her wide shot), then the last one full frame.
    const count = Math.max(2, Math.min(18, Math.round(n)));
    const m = count - 1;
    const final = FINAL + (end ? Math.ceil(END_CARD / beat - 1e-6) : 0);
    const spans = beatSpans(bpm, [...frameBeats(m), final]);
    const duration = spans.at(-1)!.end;
    const wants = [
      "son plan le plus large du lieu, bien droit, qui fuit vers le centre (un couloir, la salle vue de l'entrée, une allée, sa boutique vue de la porte), si possible avec une porte, une fenêtre ou un miroir au fond : il reste figé en noir et blanc derrière le cadre tout le Reel, sur l'image du départ, et se voit d'abord en couleur dans le petit cadre",
      ...Array.from({ length: m - 1 }, (_, k) =>
        k === m - 2
          ? "une belle image en couleur, vue dans le cadre presque plein écran"
          : "une image en couleur dans le cadre au milieu, qui grandit à chaque coupe : ce qui se fait (un geste, un détail, l'équipe, un produit), un coin du lieu, un plan qui fuit vers le centre ; le sujet au milieu de l'image",
      ),
      "sa plus belle image large (la salle prête, sa devanture, l'équipe) : elle prend tout l'écran d'un coup, pour finir",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Both labels from the first image to the last.
      texts: { gauche: { from: 0, to: duration }, droite: { from: 0, to: duration } },
      marks: {},
      // Its music cut dead 0,2 beat after the last picture takes the frame, silent to the end (the original's 5,80 s of
      // 6,37); under an ending card, the same 0,8 beat before the end. No sound of its own: its original has none.
      music: { end: { at: round(duration - (FINAL - SILENCE) * beat) } },
    };
  },
  code: CODE,
};
