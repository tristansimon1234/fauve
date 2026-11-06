import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Court métrage », version 2, written on its original's fiche (docs/fiches/court-metrage.md: measured image by image
// at 30 i/s, its picture's box, its slit, its title, its burns and its film roll read on the pixels, its sound by
// bands). A short travel film projected as on an old projector: its picture 1,94:1 with its corners rounded, on a soft
// black, one shot a bar of its music, cut on each new chord. Its cuts fit 85,5 BPM within an image (a beat every
// 0,7018 s, the first of its grid at 0,49 s); every landmark below is in those beats from the Reel's start:
//   0 – 5,7     its first four images are its title card (the cover a feed shows), then black with a click; its first
//               shot opens from a slit in the middle (two black bars parting at an even pace) to beat 3 (2,6 s), a
//               projector running under it, no music yet; on beat 3 its title cuts in whole with a click: one small word
//               in a little spaced serif capitals near the top, two lines of big capitals of a high-contrast display
//               serif in the middle, a small roman credit near the bottom, all of them lemon yellow; from beat 4,9 a film burn floods in from the left (red-orange,
//               orange, amber, then pale yellow at its height, the title washed under it), the cut on beat 5,7 under it,
//               and the music comes in there, its bass a bar later;
//   5,7 – 29,7  one shot a bar (4 beats, 2,8 s), cut on the chord; on its fifth cut (beat 21,7) the film slips in the
//               projector: a burn, then six images of the strip rolling up in jerks (its black frame lines and sprocket
//               holes passing, the next shot coming on the beat), a blank burnt image, a last burn, settled; its bass
//               out from two beats before to the cut after;
//   29,7 – 34,8 its last shot, calm, fading to black over its last 0,7 beat with the music.
// Here her shots fill its gate: in width when most of hers are (or she asks), the whole frame but for its margins
// when they are upright; her title in her words (the original's « MOMENTS / SHORT CINEMA / Archived by : your name »
// are its template's, never copied), in its lemon yellow (or her colour, or white), her first shot dimmed under it when
// it is bright; the film roll on the cut after four of her shots, or onto her last one when she has fewer.
// Its light is drawn by its code on her shots only (the original's golden print: warm and rich, amber mids, its blacks a
// little lifted, its highlights held), so its words, its soft black and its burns keep their measured colours.

const BPM = 85.5;
/** Its grid's first beat from the Reel's start (0,49 s), the first cut five beats later (4,0 s, its image 120). */
const FIRST = 0.7;
const OPENING = FIRST + 5;
/** One shot a bar, cut on the chord. */
const SHOT = 4;
/** Its last shot, to the end (24,40 s for its eight shots: the original's 732 images). */
const LAST = 5.07;
/** Its title on beat 3 (image 78; the original's 77), its slit open two images before. */
const TITLE = FIRST + 3;
/** The fade to black over the last shot's last 0,71 beat, black an image before its end (images 717 to 731). */
const FADE = 0.71;
const BLACK = 0.05;
/** Its shots: the opening, a bar each, the last; up to twelve for a length she asks for (42 s at its slowest tempo). */
const FEWEST = 4;
const LONGEST = 12;
/** The engine's ending card: the Reel's last 1,6 s, on the black after the fade. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The shot the film slips onto: after four of her shots (the original's fifth cut), onto her last one when she has fewer. */
export const rollShot = (n: number) => Math.max(2, Math.min(5, n - 1));

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const n = shots.length;
  const INK = "#0e0c0d";
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const COVER = Math.max(1, Math.round(mark("cover", 4)));
  const OPEN = Math.max(COVER + 2, Math.round(mark("open", 76)));
  const TITLE = Math.max(OPEN, Math.round(mark("title", 78)));
  const R = Math.round(mark("roll", -1));
  const FADE = mark("fade", durationInFrames - 22);
  const BLACK = Math.max(FADE + 1, mark("black", durationInFrames - 1));
  const CUT = n > 1 ? Math.round(shots[1].from) : durationInFrames + 1;
  const ROLL = R >= 2 && R < n ? Math.round(shots[R].from) : null;

  // 1. Its gate: her picture as the original projects it, its corners rounded (4,2 % of the width), on a soft black
  // (14, 12, 13). In width when most of her shots are (or she asks): 1,94:1 across the whole width, at the middle;
  // upright: the whole frame but its margins top and bottom (4,2 % of the height each, as the original's 17 px of 406).
  const format = setting("format", "auto");
  const inWidth = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && inWidth * 2 > n);
  const GW = width;
  const GH = wide ? Math.round(width / 1.94) : Math.round(height * 0.916);
  const GY = Math.round((height - GH) / 2);
  const RAD = Math.round(width * 0.042);
  const full = { position: "absolute", left: 0, top: 0, width: GW, height: GH };
  const box = (x, y, w, t) => ({ position: "absolute", left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(t) });

  // 2. Her words: one small word in a little spaced capitals near the top of the picture, her title in big capitals of
  // a high-contrast display serif on two lines at its middle, her credit in small roman near its bottom (upright:
  // within the safe zone), all at once.
  const band = reelTexts.find((t) => t.role === "band");
  const hook = reelTexts.find((t) => t.role === "hook");
  const credit = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== band && t !== hook && t !== credit);
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  // In capitals, an hour keeps its small h (« 7 h », never « 7 H »).
  const caps = (s) => keep(s).toUpperCase().replace(/(\d)(\s?)H\b/g, "$1$2h");
  const words = (s) => String(s || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const lines = (s) => {
    const w = caps(s).split(/\s+/).filter(Boolean);
    let best = [w.join(" ")];
    let worst = Infinity;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(" ");
      const b = w.slice(i).join(" ");
      if (Math.max(a.length, b.length) < worst) { worst = Math.max(a.length, b.length); best = [a, b]; }
    }
    return best;
  };
  // Its sizes, the original's (its title's capitals 9,4 % of its picture's height, its small word's 2,4 %), in a serif
  // whose capitals are 0,72 of its size; a third larger upright.
  const S = wide ? 1 : 1.3;
  const TPX = Math.round(73 * S);
  const LPX = Math.round(22 * S);
  const CPX = Math.round(25 * S);
  const yLabel = GH * (wide ? 0.1 : 0.12);
  const yTitle = GH * (wide ? 0.485 : 0.47);
  const yCredit = GH * (wide ? 0.902 : 0.72);
  const TB = box((GW - 800) / 2, yTitle - TPX * 0.95, 800, TPX * 1.9);

  // Its lemon yellow (the original's #F2EA4A), else her colour when it reads on a dark picture, else a warm white.
  const luma = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return -1;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  const tone = setting("couleur", "jaune");
  const hers = [brand.accent, brand.palette && brand.palette.light].find((c) => luma(c) >= 0.45);
  const COLOR = tone === "blanc" ? "#f4f1e8" : tone === "sienne" && hers ? hers : "#f2ea4a";
  const display = "'" + brand.displayFont + "', 'Noto Serif Display', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Noto Serif Display', Georgia, serif";
  const shade = "0 0 1px rgba(0,0,0,0.35), 0 2px 12px rgba(0,0,0,0.38)";
  // Its light, on her shots only (setting « lumière »): the original's golden print, warm amber mids, rich colours, its
  // blacks a little lifted and its highlights held; or her shots as filmed.
  const LIGHT = setting("lumiere", "doree") === "naturelle" ? "" : "sepia(0.45) saturate(1.7) contrast(1.05) brightness(0.93)";

  // Her first shot dimmed under her title when it is bright there (the original's is a dim room): from its first
  // image, so nothing changes when the title comes; the burn takes it away.
  const light = React.useMemo(() => {
    const l = n ? LightUnder(shots[0], TITLE, full, { x: TB.left, y: TB.top, w: TB.width, h: TB.height }) : null;
    return l && Number.isFinite(l.mean) ? l.mean : null;
  }, [n, TITLE, GW, GH]);
  const dim = light !== null && light > 0.42 ? Math.max(0.55, 0.42 / light) : 1;

  const titled = (frame < COVER || (frame >= TITLE && frame < CUT)) && hook;
  const card = titled
    ? h(React.Fragment, { key: "card" },
        band
          ? h(FitText, { key: "b-" + band.text, style: box((GW - 800) / 2, yLabel - LPX * 0.8, 800, LPX * 1.6), innerStyle: { fontFamily: body, fontWeight: 500, fontSize: LPX, lineHeight: 1, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", color: COLOR, textShadow: shade } },
              h("span", { "data-fauve-accent": "" }, keep(band.text)))
          : null,
        h(FitText, { key: "t-" + hook.text, style: TB, innerStyle: { fontFamily: display, fontWeight: 500, fontSize: TPX, lineHeight: 0.84, letterSpacing: "0.01em", whiteSpace: "nowrap", color: COLOR, textShadow: shade } },
          lines(hook.text).map((l, i) => h("div", { key: i }, l))),
        credit
          ? h(FitText, { key: "c-" + credit.text, style: box((GW - 800) / 2, yCredit - CPX * 0.85, 800, CPX * 1.7), innerStyle: { fontFamily: body, fontWeight: 500, fontSize: words(credit.text) > 4 ? Math.max(48, CPX) : CPX, lineHeight: 1, whiteSpace: "nowrap", color: COLOR, textShadow: shade } },
              words(credit.text) > 4 ? keep(credit.text) : h("span", { "data-fauve-accent": "" }, keep(credit.text)))
          : null)
    : null;

  // 3. Her shots, as filmed (a photo still, a video playing). The first opens from a slit at its middle: after its
  // title card, black, then two black bars part at an even pace to its title's beat.
  const open = frame < COVER ? 1 : clamp01((frame - COVER) / (OPEN - COVER));
  const slit = Math.round(((1 - open) * GH) / 2);
  const film = n ? h(Footage, { key: "f" + cur, shot: cur, style: full }) : null;
  const lit = [LIGHT, cur === 0 && dim < 1 ? "brightness(" + dim.toFixed(3) + ")" : ""].filter(Boolean).join(" ");
  const shown = h("div", { key: "shown", style: { ...full, clipPath: slit > 0 ? "inset(" + slit + "px 0px " + slit + "px 0px)" : undefined, filter: lit || undefined } }, film);

  // 4. The film slipping in the projector, onto its roll shot: six images of the strip rolling up in jerks, each
  // frame line where the original's was (its top, a share of the picture's height), the shot going until the cut and
  // the next one from it in both frames, each frame a little narrower than the gate (2,5 % in from each side), its
  // sprocket holes on the left edge, cream, at its middle (and every 0,56 width along a tall frame).
  const LINES = [0.315, 0.213, 0.908, 0.825, 0.105, 0.814];
  const step = ROLL === null ? -1 : frame - ROLL + 4;
  const LINE = Math.round(width * 0.043);
  const IN = Math.round(width * 0.025);
  const HOLE = { w: Math.round(width * 0.036), h: Math.round(width * 0.108), pitch: width * 0.56 };
  const strip = (() => {
    if (step < 0 || step >= LINES.length) return null;
    const k = frame < ROLL ? R - 1 : R;
    const L = LINES[step] * GH;
    const one = (top, key) => {
      const holes = [];
      for (let j = -4; j <= 4; j++) {
        const y = top + GH / 2 + j * HOLE.pitch - HOLE.h / 2;
        if (y + HOLE.h > top && y < top + GH) holes.push(h("div", { key: key + "h" + j, style: { ...box(-HOLE.w * 0.3, y, HOLE.w, HOLE.h), borderRadius: Math.round(HOLE.w * 0.3), backgroundColor: "#aea87b" } }));
      }
      return [
        h("div", { key, style: { ...box(IN, top, GW - 2 * IN, GH), overflow: "hidden", borderRadius: RAD, filter: LIGHT || undefined } }, h(Footage, { shot: k, style: box(-IN, 0, GW, GH) })),
        ...holes,
      ];
    };
    return h("div", { key: "strip", style: { ...full, backgroundColor: INK } }, ...one(L - GH, "up"), ...one(L + LINE, "down"));
  })();

  // 5. Its burns (the picture kit's Burn: light laid in screen, image by image around a cut, as measured): onto its
  // first cut, red-orange from the left, orange, amber, pale yellow at its height, the cut under it, then out to the
  // right; around the roll, pale yellow to red-orange before it, a blank burnt image after it (cream, flat), orange to
  // lemon, then a red rest in the bottom right corner.
  const BURN = [
    [-5, "#c8501e", 0.14],
    [-4, "radial-gradient(ellipse 75% 130% at 0% 35%, rgba(214,74,14,0.95), rgba(214,74,14,0.35) 60%, rgba(214,74,14,0) 100%)", 1],
    [-3, "linear-gradient(to right, rgba(232,150,14,0.98), rgba(214,116,22,0.9))", 1],
    [-2, "linear-gradient(to right, #e8a21e, #de901a)", 0.97],
    [-1, "#ece18f", 0.94],
    [0, "linear-gradient(to right, rgba(230,146,34,0.95), rgba(236,192,78,0.92) 50%, rgba(236,212,100,0.9))", 1],
    [1, "linear-gradient(to right, rgba(170,70,26,0.45), rgba(222,146,52,0.85) 50%, rgba(222,146,36,0.85))", 1],
    [2, "radial-gradient(ellipse 70% 110% at 65% 55%, rgba(214,136,60,0.78), rgba(214,136,60,0) 100%)", 1],
    [3, "radial-gradient(ellipse 50% 90% at 62% 55%, rgba(190,110,56,0.5), rgba(190,110,56,0) 100%)", 1],
  ];
  const ROLL_LIGHT = [
    [-5, "linear-gradient(to right, #eadb8c, #ec9a52 50%, #e57238)", 0.96],
    [3, "linear-gradient(to right, #e6aa3c, #e9d25f 50%, #e4ea76)", 0.94],
    [4, "radial-gradient(circle at 100% 100%, rgba(160,60,24,0.8), rgba(160,60,24,0) 40%), radial-gradient(ellipse 45% 100% at 0% 45%, rgba(120,62,22,0.55), rgba(120,62,22,0) 100%)", 1],
  ];
  const burns = [
    n > 1 ? h(Burn, { key: "burn", at: CUT, steps: BURN }) : null,
    ROLL !== null ? h(Burn, { key: "roll", at: ROLL, steps: ROLL_LIGHT }) : null,
    ROLL !== null && frame === ROLL + 2 ? h("div", { key: "blank", style: { ...full, backgroundColor: "#ebe5bb" } }) : null,
  ];

  // 6. Its last shot fading to black with the music (the original's images 717 to 731, to a soft black).
  const fade = frame >= FADE ? h("div", { key: "fade", style: { ...full, backgroundColor: INK, opacity: clamp01((frame - FADE) / (BLACK - FADE)) } }) : null;

  // 7. Its ending card, only when the Reel has one: on the black after the fade, her words in its serif capitals and
  // its small roman, in its colour, fading in.
  const cardIn = (a) => clamp01((frame - a) / 10);
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h(FitText, { key: "e-" + end.title, style: box(140, GH * 0.46 - TPX * 0.9, GW - 280, TPX * 1.8), innerStyle: { fontFamily: display, fontWeight: 500, fontSize: Math.max(58, Math.round(TPX * 0.8)), lineHeight: 0.95, whiteSpace: "normal", textWrap: "balance", color: COLOR, opacity: cardIn(endAt), justifyContent: end.subtitle ? "flex-end" : "center" } }, caps(end.title)),
        end.subtitle
          ? h(FitText, { key: "s-" + end.subtitle, style: box(140, GH * 0.46 + TPX * 0.95, GW - 280, Math.max(70, TPX)), innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.15, whiteSpace: "normal", textWrap: "balance", color: COLOR, opacity: cardIn(endAt + 5), justifyContent: "flex-start" } }, keep(end.subtitle))
          : null)
    : null;

  const gate = h("div", { key: "gate", style: { position: "absolute", left: 0, top: GY, width: GW, height: GH, overflow: "hidden", borderRadius: RAD, backgroundColor: INK } },
    strip || shown, card, ...burns, fade, ending);

  // Any other text of the Reel (none in its slots): a plain line off its picture, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: box(140, wide ? Math.max(100, GY - 140 - i * 120) : GY + GH * 0.3 + i * 120, width - 280, 110), innerStyle: { fontFamily: display, fontWeight: 600, fontSize: 52, lineHeight: 1.1, color: COLOR, textAlign: "center", textShadow: shade } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: INK } }, gate, extra);
}`;

export const courtMetrage: MontageSkill = {
  key: "court-metrage",
  // 2: its light drawn on her shots (the original's golden print; « lumière ne va pas »: the catalogue's « film » grade
  // and its lifted blacks made them grey and flat), its title in a high-contrast display serif (« la police au début
  // pareil »: Cormorant Garamond was narrower and paler), its small word a little spaced, its credit roman, not italic.
  version: 2,
  bpm: BPM,
  shots: [FEWEST, 8],
  long: LONGEST,
  files: [4, 10],
  // A calm film: slower makes it longer and gentler, never past 45 s with its twelve shots and an ending card.
  tempo: [72, 100],
  how: "Un court métrage projeté, dans la lumière dorée d'une vieille pellicule (chaude et riche, les noirs à peine relevés) : ses plans dans une image aux coins arrondis sur un noir doux, en horizontal comme l'original quand ses vidéos le sont (sinon plein écran) ; le premier s'ouvre depuis une fente au milieu, et sur un temps le titre de son film s'y pose d'un coup en jaune (un petit mot en capitales un peu espacées en haut, son titre en grandes capitales d'un serif à fort contraste sur deux lignes au milieu, sa signature en petit romain en bas) ; une brûlure de pellicule blanchit l'image sur la première coupe et la musique entre ; puis un plan par mesure, coupé sur l'accord ; après quatre plans, la pellicule saute dans le projecteur (l'image remonte par à-coups, ses perforations passent, une image blanche brûlée) ; le dernier plan, calme, finit en fondu au noir avec la musique.",
  end: true,
  texts: [
    {
      slot: "surtitre",
      role: "band",
      want: "facultatif : 1 ou 2 petits mots en capitales très espacées en haut de l'image, comme le premier mot d'un générique (une forme comme « moments », « un matin », « depuis 1962 ») ; rien d'inventé",
      max: 16,
      required: false,
    },
    {
      slot: "titre",
      role: "hook",
      want: "le titre de son film en grandes capitales serif sur deux lignes, au milieu de son premier plan : son nom ou ce que le film raconte, 1 à 3 mots (une forme comme « La Fournée », « Le matin », « Chez Rose ») ; jamais une phrase",
      max: 22,
      required: true,
    },
    {
      slot: "signature",
      role: "caption",
      want: "facultatif : sa signature en petit en bas de l'image, comme le nom de qui a filmé (une forme comme « par Maison Farine », « filmé par Rose ») ; 3 mots au plus (le titre ne reste que deux temps)",
      max: 24,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : sa pellicule en horizontal sur du noir comme l'original, ou plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos : en horizontal 1,94:1 sur du noir quand la plupart sont horizontales, sinon plein écran" },
        { value: "horizontal", says: "en horizontal 1,94:1 au milieu de l'écran, sur du noir, comme une pellicule projetée", band: true },
        { value: "vertical", says: "plein écran, coins arrondis, une fine marge noire en haut et en bas" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur de son titre et de ses petits mots",
      choices: [
        { value: "jaune", says: "le jaune citron d'un générique, comme l'original" },
        { value: "sienne", says: "sa couleur (celle de sa charte, si elle se lit sur une image sombre)" },
        { value: "blanc", says: "un blanc chaud" },
      ],
    },
    {
      name: "lumiere",
      want: "la lumière de ses plans",
      choices: [
        { value: "doree", says: "la lumière dorée d'une vieille pellicule, chaude et riche, comme l'original" },
        { value: "naturelle", says: "ses plans tels qu'elle les a filmés" },
      ],
    },
  ],
  // Its code draws its light on her shots (the setting « lumiere »): nothing of its model's finish is laid over it (it
  // would tint its lemon title, its soft black and its burns too).
  finish: { exposure: 0, contrast: 0, saturation: 0, warmth: 0, split: 0, fade: 0, grain: 0, vignette: 0 },
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, a music's own): every landmark counted in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(FEWEST, Math.min(LONGEST, n));
    // With an ending card, its time after the fade, in whole beats (the engine's 1,6 s at least).
    const card = end ? Math.ceil((END_CARD + 0.05) / beat - 1e-6) : 0;
    const spans = beatSpans(bpm, [OPENING, ...Array.from({ length: count - 2 }, () => SHOT), LAST + card]);
    const duration = spans.at(-1)!.end;
    const at = (beats: number) => round3(beats * beat);
    const roll = rollShot(count);
    const rollAt = OPENING + SHOT * (roll - 1);
    const lastCut = OPENING + SHOT * (count - 2);
    const cut = round(spans[1]!.start);
    const middle = (i: number) =>
      i === roll
        ? "le plan où la pellicule saute, qui ouvre la deuxième moitié du film : plein de lumière, en plein soleil ou à contre-jour, quelque chose qui avance ou arrive (un train à quai, sa rue, ses clients qui entrent) ; à l'horizontale de préférence"
        : "un moment de sa journée, à l'horizontale de préférence : sa rue à l'heure dorée, le trajet jusqu'à chez elle (un tram, un vélo, une fenêtre de train), son lieu qui ouvre, ses gestes, ses clients ; une vraie lumière (un contre-jour, un rayon de soleil), quelque chose qui bouge dans le cadre, la caméra posée ou qui avance doucement";
    const wants = [
      "le plan qui ouvre le film, calme et plutôt sombre, le téléphone posé, à l'horizontale de préférence : un intérieur à la lumière du matin ou du soir (un rayon de soleil sur un mur, sa salle avant l'ouverture, une tasse qui fume près d'une fenêtre) ; le milieu de l'image calme (le titre de son film s'y pose) ; tenu 4 secondes",
      ...Array.from({ length: count - 2 }, (_, k) => middle(k + 1)),
      `le dernier plan, calme et large, qui finit le film en fondu au noir : une vue (l'eau, sa terrasse, sa rue le soir), des gens de dos qui regardent, sa devanture à la tombée du jour ; tenu ${String(round(LAST * beat)).replace(".", ",")} secondes`,
    ];
    // The bass out over its first bar, and around the roll from two beats before it to the cut after it (none when it is
    // onto her last shot: that one keeps its bass to its fade).
    const thin = [{ kind: "thin" as const, from: at(OPENING), to: at(OPENING + SHOT) }];
    if (roll < count - 1) thin.push({ kind: "thin" as const, from: at(rollAt - 2), to: at(rollAt + SHOT) });
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its words on its first shot (its title card from the first image, its title from beat 3), gone with the cut.
      texts: { surtitre: { from: 0, to: cut }, titre: { from: 0, to: cut }, signature: { from: 0, to: cut } },
      marks: {
        cover: 4,
        open: toFrame(at(TITLE)) - 2,
        title: toFrame(at(TITLE)),
        roll,
        fade: toFrame(at(lastCut + LAST - FADE)),
        black: toFrame(at(lastCut + LAST - BLACK)),
      },
      // A projector: its click on the black, running under the slit, a click on the title; its film slipping on the roll.
      sounds: [
        { at: round3(4 / 30), sound: "film projector switch click", seconds: 0.5, gain: 0 },
        { at: 0.8, sound: "old film projector running", seconds: 2.5, gain: -8 },
        { at: at(TITLE), sound: "film projector click", seconds: 0.5, gain: 2 },
        { at: round3(at(rollAt) - 0.25), sound: "film reel flutter", seconds: 0.5, gain: 2 },
      ],
      // No music under its opening: it comes in on the first cut, under the burn (a late start on its downbeat),
      // without its bass for a bar; faded with the picture at its end.
      music: {
        downbeat: at(OPENING),
        pauses: [{ from: 0, to: at(OPENING) }],
        filters: thin,
        end: { at: duration, fade: round3(FADE * beat) },
      },
    };
  },
  code: CODE,
};
