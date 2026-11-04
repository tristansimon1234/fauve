import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Recette cosy, typo pixel », written on its original (house/originals/pixel.mp4, 15,6 s, looked at image by image):
// warm close-ups of a recipe, full frame, one after the other. On the finished dish, from the first images, a title in
// a soft pixel font, mint white with a dark edge, on two lines at the upper third, a little kaomoji « (๑˃ᴗ˂) » raised
// at its start and an outlined star after it; tiny typewriter lines beside the bowl (« comfort food » left under the
// title, « perfect for cold days » lower right); it stays two shots. Then the steps, a shot each, each with its tiny
// caption set where the gesture leaves room (under the bowl, in the upper left, on the right), now and then a pair of
// outlined stars in two corners or a tiny kaomoji instead of words; everything cuts in with its shot, nothing types
// nor slides. The finished dish again at the end with a closing word (« enjoy cooking »). Its ending card (an offer,
// an announcement): the title's pixel type over the last image, softly darkened, a typewriter line under it.

const BPM = 84;
/** The title's two shots, the steps (over and over), the last shot (beats). */
const TITLE = [2, 3];
const STEP = [3, 4, 3];
const LAST = 3;
/** The engine's ending card: the Reel's last 1,6 s. */
const CARD_SECONDS = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  // Its sections (frames): the steps after the title's two shots, the last shot with its closing word.
  const STEPS = mark("steps", n > 2 ? shots[2].from : durationInFrames);
  const LASTAT = mark("last", n ? shots[n - 1].from : durationInFrames);
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const display = "'" + brand.displayFont + "', monospace";
  const body = "'" + brand.bodyFont + "', monospace";
  // The model's own colours: a mint white title with a dark teal edge, warm white tiny lines.
  const MINT = "#d6f6ee";
  const WHITE = "#fff8ec";
  // Its pixel letters carry a thin dark teal edge all round and a hard drop under them, as the model's.
  const TITLE_SHADOW = "0 4px 0 rgba(28,74,68,0.9), 2px 0 0 rgba(28,74,68,0.55), -2px 0 0 rgba(28,74,68,0.55), 0 -2px 0 rgba(28,74,68,0.45), 0 2px 14px rgba(0,0,0,0.3)";
  const SMALL_SHADOW = "0 1px 2px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.65), 0 0 9px rgba(0,0,0,0.4)";
  const DROP = "drop-shadow(0 1px 1.5px rgba(0,0,0,0.6))";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const wordsIn = (s) => String(s || "").split(/[\s\u00a0\u202f]+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const hook = reelTexts.find((t) => t.role === "hook");
  const list = reelTexts.find((t) => t.role === "band");
  const captions = reelTexts.filter((t) => t.role === "caption");
  const opening = captions.find((t) => t.from < STEPS);
  const closing = captions.find((t) => t !== opening && t.from >= STEPS);
  const others = reelTexts.filter((t) => t !== hook && t !== list && t !== opening && t !== closing);
  const shown = (t) => Boolean(t) && frame >= t.from && frame < t.to && frame < endAt;

  // Its drawings, decor: the kaomoji « (๑˃ᴗ˂) » and its calmer one « (˘ᴗ˘) », an outlined star.
  const stroke = { fill: "none", stroke: "#ffffff", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" };
  const kaomoji = (w, calm) => h("svg", { width: w, height: Math.round((w * 34) / 70), viewBox: "0 0 70 34", style: { display: "block", overflow: "visible", filter: DROP } },
    h("g", stroke,
      h("path", { d: "M7 3 Q1 17 7 31" }),
      calm ? h("path", { d: "M17 12 Q21.5 17 26 12" }) : h("path", { d: "M22 12 Q21 7 16.5 7 Q12 7 12 13 Q12 20 17 20 Q22 20 22 15" }),
      calm ? null : h("path", { d: "M27 9 L33 13 L27 17" }),
      h("path", { d: "M36 16 Q41.5 23.5 47 16" }),
      calm ? h("path", { d: "M52 12 Q56.5 17 61 12" }) : h("path", { d: "M57 9 L51 13 L57 17" }),
      h("path", { d: "M63 3 Q69 17 63 31" })));
  const star = (s) => h("svg", { width: s, height: s, viewBox: "0 0 40 40", style: { display: "block", overflow: "visible", filter: DROP } },
    h("path", { d: "M20 3 L24.8 15 L37.5 15.4 L27.5 23.3 L31 35.6 L20 28.5 L9 35.6 L12.5 23.3 L2.5 15.4 L15.2 15 Z", fill: "none", stroke: "#ffffff", strokeWidth: 2.6, strokeLinejoin: "round" }));
  const decor = (key, left, y, child) => h("div", { key, "data-fauve-decor": "", style: { position: "absolute", left, top: y } }, child);
  const stars = (key, left, y) => decor(key, left, y, h("div", { style: { display: "flex", alignItems: "flex-end", gap: 6 } }, star(24), star(36)));

  // 1. Her shots full frame, one after the other, each video playing, a photo still.
  const film = n ? h(Footage, { key: "shot", shot: cur, style: { left: 0, top: 0, width, height } }) : null;

  // 2. The title in pixels on her first two shots, at the upper third, on two balanced lines, its kaomoji raised at its
  // start and its star after it; all cut in at once, as the model.
  const titleBlock = shown(hook)
    ? h(FitText, { key: "title", style: { position: "absolute", left: 140, top: 486, width: 800, height: 330 }, innerStyle: { fontFamily: display, fontWeight: 600, fontSize: 92, lineHeight: 1.14, color: MINT, textShadow: TITLE_SHADOW, textAlign: "center", textWrap: "balance" } },
        h("span", null,
          h("span", { "data-fauve-decor": "", style: { display: "inline-block", verticalAlign: "top", marginRight: 12, marginTop: -6 } }, kaomoji(78, false)),
          hook.text,
          h("span", { "data-fauve-decor": "", style: { display: "inline-block", verticalAlign: "baseline", marginLeft: 14 } }, star(42))))
    : null;

  // A tiny typewriter line where its box says (a short one, 4 words at most, as small as the model's; a longer one
  // set bigger, so it still reads).
  const tiny = (key, text, box) => {
    const small = wordsIn(text) <= 4;
    const at = small ? box : { ...box, top: box.top - (box.align === "center" ? 40 : 0), width: Math.max(box.width, 700), left: box.align === "right" ? box.left + box.width - Math.max(box.width, 700) : box.left, height: 130 };
    return h(FitText, { key, style: { position: "absolute", left: at.left, top: at.top, width: at.width, height: at.height }, innerStyle: { alignItems: box.align === "left" ? "flex-start" : box.align === "right" ? "flex-end" : "center", textAlign: box.align, fontFamily: body, fontWeight: 400, fontSize: small ? 32 : 48, lineHeight: 1.3, letterSpacing: "0.01em", color: WHITE, textShadow: SMALL_SHADOW } },
      small ? h("span", { "data-fauve-accent": "" }, text) : text);
  };
  // Where the tiny lines sit, as on the model: under the gesture, in the upper left, on the right (clear of the apps' buttons).
  const SPOTS = [
    { left: 160, top: 1290, width: 760, height: 96, align: "center" },
    { left: 150, top: 520, width: 620, height: 96, align: "left" },
    { left: 380, top: 1010, width: 540, height: 96, align: "right" },
  ];

  // 3. Its tiny line on the title's shots: left under the title, and after a comma, a second one lower on the right.
  let openingLine = null;
  if (shown(opening)) {
    const m = /^(.*?\S)(\s*[,\/]\s*)(\S.*)$/.exec(String(opening.text));
    const parts = m ? [m[1], m[2], m[3]] : [String(opening.text), "", ""];
    openingLine = h("div", { key: "opening" },
      tiny("o1", parts[0], { left: 150, top: 846, width: 620, height: 80, align: "left" }),
      parts[1] ? h("span", { style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, parts[1]) : null,
      parts[2] ? tiny("o2", parts[2], { left: 380, top: 1300, width: 540, height: 80, align: "right" }) : null);
  }

  // 4. The steps: on each step shot its tiny caption, her words in their order (spread over the steps when she gave
  // fewer: a step without words gets the calm kaomoji), at the next of the model's places; every other step a pair of
  // stars in two corners. Every caption is in the page all along (her separators too), only the current one seen.
  let steps = null;
  if (list && frame >= list.from && frame < Math.min(list.to, endAt)) {
    const text = String(list.text);
    const parts = /[\/|\n]/.test(text) ? text.split(/(\s*[\/|\n]\s*)/) : text.split(/(\s*,\s*)/);
    const items = [];
    parts.forEach((p, i) => { if (i % 2 === 0 && p.trim()) items.push(i); });
    const firstStep = shots.findIndex((s) => s.from >= STEPS - 1);
    const lastStep = shots.findIndex((s) => s.from >= LASTAT - 1);
    const first = firstStep < 0 ? n : firstStep;
    const count = Math.max(0, (lastStep < 0 ? n : lastStep) - first);
    const step = cur - first;
    const W = Math.max(1, items.length);
    const stepOf = (k) => (W <= count ? Math.floor((k * count) / W) : k);
    let current = -1;
    for (let k = 0; k < items.length; k++) if (stepOf(k) === step) current = k;
    const spot = SPOTS[((step % 3) + 3) % 3];
    steps = h("div", { key: "steps" },
      parts.map((p, i) => {
        const k = items.indexOf(i);
        if (k < 0) return h("span", { key: "s" + i, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, p);
        const box = SPOTS[((stepOf(k) % 3) + 3) % 3];
        return h("div", { key: "c" + i, style: { opacity: k === current ? 1 : 0 } }, tiny("t" + i, p.trim(), box));
      }),
      current < 0 && step >= 0 && step < count ? decor("calm", spot.align === "right" ? 760 : spot.align === "left" ? 160 : 490, spot.top + 20, kaomoji(84, true)) : null,
      step >= 0 && step < count && step % 2 === 1 ? stars("st1", spot.align === "left" ? 820 : 150, spot.align === "left" ? 1220 : 420) : null,
      step >= 0 && step < count && step % 2 === 1 ? stars("st2", spot.align === "left" ? 150 : 830, spot.align === "left" ? 300 : 1230) : null);
  }

  // 5. The last shot: the finished dish again, its closing word in the upper left, a star after it.
  const closingLine = shown(closing)
    ? h("div", { key: "closing" },
        tiny("end-word", closing.text, { left: 200, top: 560, width: 640, height: 90, align: "left" }),
        stars("st-end", 830, 1230))
    : null;

  // Any other text of the Reel (none in its slots): a tiny line under the gesture, so nothing she wrote is lost.
  const extra = others.filter((t) => shown(t)).map((t, i) => tiny("x" + i, t.text, { left: 160, top: 1180 - i * 110, width: 760, height: 96, align: "center" }));

  // 6. Its ending card: the last image softly darkened, its title in the title's pixel type with its star, a typewriter
  // line under it. The entrance moves a span inside the box: a transform on the box itself would undo FitText's scale.
  const veil = interpolate(frame, [endAt, endAt + 8], [0, 1], clamp);
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { position: "absolute", left: 0, top: 0, width, height, background: "linear-gradient(180deg, rgba(24,14,6," + (0.5 * veil).toFixed(3) + ") 0%, rgba(24,14,6," + (0.36 * veil).toFixed(3) + ") 55%, rgba(24,14,6," + (0.2 * veil).toFixed(3) + ") 100%)" } }),
        h(FitText, { style: { position: "absolute", left: 140, top: 520, width: 800, height: 300 }, innerStyle: { fontFamily: display, fontWeight: 600, fontSize: 92, lineHeight: 1.14, color: MINT, textShadow: TITLE_SHADOW, textAlign: "center", textWrap: "balance" } },
          h("span", { style: { display: "inline-block", opacity: frame >= endAt + 2 ? 1 : 0 } },
            keep(end.title),
            h("span", { "data-fauve-decor": "", style: { display: "inline-block", verticalAlign: "baseline", marginLeft: 14 } }, star(42)))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 846, width: 800, height: 140 }, innerStyle: { fontFamily: body, fontWeight: 400, fontSize: 48, lineHeight: 1.25, color: WHITE, textShadow: SMALL_SHADOW, textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: frame >= endAt + 6 ? 1 : 0 } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#1a120c" } }, film, titleBlock, openingLine, steps, closingLine, extra, ending);
}`;

export const pixel: MontageSkill = {
  key: "pixel",
  version: 1,
  bpm: BPM,
  shots: [5, 9],
  files: [4, 9],
  how: "Des gros plans chauds de sa recette en plein cadre, l'un après l'autre ; sur le plat fini, un titre en pixels doux vert d'eau sur deux lignes au tiers haut, un petit kaomoji au début et une étoile après, et de toutes petites lignes en machine à écrire à côté ; puis chaque étape avec sa toute petite légende posée là où le geste laisse la place, de temps en temps deux étoiles dans les coins ; le plat fini à la fin avec un petit mot.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "le titre en pixels sur le plat fini, en minuscules : son plat ou ce qu'elle prépare, court, avec « !! » à la fin (une forme comme « brioche du dimanche!! », « soupe de saison!! »)",
      max: 24,
      required: true,
    },
    {
      slot: "petit_mot",
      role: "caption",
      want: "une toute petite ligne en machine à écrire sous le titre, en minuscules : ce qui la rend bonne, 2 à 4 mots ; une seconde après une virgule, posée plus bas à droite (une forme comme « fait maison, pour les soirs froids »)",
      max: 40,
      required: true,
    },
    {
      slot: "etapes",
      role: "band",
      want: "une toute petite légende par étape (autant que d'étapes, dans leur ordre), séparées par « / », en minuscules, 2 à 4 mots chacune : ce qu'on fait ou ce qu'on y met (une forme comme « beurre et farine / on mélange doucement / au four »)",
      max: 120,
      required: true,
    },
    {
      slot: "fin",
      role: "caption",
      want: "le petit mot de la fin sur le plat fini, en machine à écrire, en minuscules, 2 ou 3 mots (une forme comme « bon appétit », « à demain matin »)",
      max: 24,
      required: true,
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // The title's two shots, the steps on their pattern, the last shot (with an ending card, its time after it: 1,6 s at least).
    const count = Math.max(3, n);
    const card = end ? Math.ceil(CARD_SECONDS / beat - 0.01) : 0;
    const beats = [...TITLE, ...Array.from({ length: count - 3 }, (_, i) => STEP[i % STEP.length]!), LAST + card];
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const stepsAt = spans[2]!.start;
    const lastAt = spans.at(-1)!.start;
    const wants = spans.map((_, i) =>
      i === 0
        ? "le plat ou la création finie, en gros plan, à la lumière chaude : il ouvre le Reel sous le titre"
        : i === 1
          ? "le même plat de plus près, ou une cuillère qui le goûte : le titre reste dessus"
          : i < spans.length - 1
            ? "une étape de la préparation en gros plan, dans l'ordre de la recette : des mains qui font un geste, un ingrédient qu'on verse, la cuisson"
            : "le plat fini, servi, calme : le Reel finit dessus avec un petit mot",
    );
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The title and its tiny line on the first two shots; the captions on the steps; the closing word on the last shot.
      texts: {
        titre: { from: 0, to: stepsAt },
        petit_mot: { from: 0, to: stepsAt },
        etapes: { from: stepsAt, to: lastAt },
        fin: { from: lastAt, to: round(end ? duration - CARD_SECONDS : duration) },
      },
      marks: { steps: toFrame(stepsAt), last: toFrame(lastAt) },
    };
  },
  code: CODE,
};
