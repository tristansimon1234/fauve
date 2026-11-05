import { beatSpans, toFrame, type MontageSkill, type SkillShot, type SkillSound } from "../skills.ts";

// « Photos posées sur la table », version 2, written again on its original's fiche (docs/fiches/table.md: measured image
// by image at 30 i/s, each print's box and angle fitted to the pixel, the pile's fade by its light, each half of its
// split screen measured on its own, its music measured; Tristan: « c'est un effet que l'on veut pouvoir faire, pas
// exactement reproduire l'image »). Its music is a jazzy lo-fi beat at 110 BPM, its first beat at 0,13 s; every length
// below is in its beats from the Reel's start (16,36 images a beat), so its cuts fall where the original's do (within an
// image):
//   0 – 3,73    her table filmed still; two small words written by hand fade in on either side of its middle (her name
//               on the right, the words that bring it on the left); her prints land on it at once, one on the other, at
//               the centre, eleven a second (the original's ten images, turned as its ten are), with a dry clicking;
//               the pile held, then gone by its light in four images (the dark first, the white of a plate last), the
//               table bare three images;
//   3,73 – 4,64 two quick shots of her place, jerky (each image held three), the second burned to white but for its
//               reddest, then black on the left and white on the right: her words go with the cut;
//   4,64 – 12,2 a split screen, her place in one half, a gesture on what she makes in the other (side by side; one above
//               the other in vertical), each at its own speed, cutting together five times (pairs of 25, 19, 23, 20, 20
//               images); then the gesture's half cuts alone, closer, while her place holds; the music 4 dB up, its bass
//               line in, from the third pair;
//   12,2 – 16,4 her finest piece seen from above takes the gesture's half, then the whole frame an image later: a gesture
//               takes a piece of it out of the frame, then it stays alone; the music cut dead two images before the end.
// Played as the original, a horizontal 4:3 band on black, when her table's video is in width (or she asks), else full
// frame (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »). Her photos stay still,
// her videos play (a video laid as a print is still on its instant). No zoom, no push, no whip added: its quick shots move
// as filmed. Nothing of the original's own is copied (its name, its plates, its burgundy): her words, her place, her work.

const BPM = 110;
/** Images a beat at its tempo: the original's images below, read in its beats. */
const IMAGES = (30 * 60) / BPM;
const beats = (images: number) => images / IMAGES;
/** Its prints land on the original's images 13, 14, 16, 19, 21, 24, 28, 30, 33 and 38 (a fewer count sampled along them). */
const LANDS = [13, 14, 16, 19, 21, 24, 28, 30, 33, 38].map(beats);
/** The pile fades by its light from image 54 (four images), the table bare to image 61; its words fade in from image 9. */
const FADE = beats(54);
const BARE = beats(58);
const WORDS = beats(9);
/** Its table, its two quick shots (the second burned on its last two images), in beats. */
const TABLE = beats(61);
const QUICK = [beats(9), beats(6)];
const BURN = beats(4);
/** Its five pairs (images 76 to 183), the gesture's half alone (to 200), its last shot (to 268), in beats. */
const PAIRS = [25, 19, 23, 20, 20].map(beats);
const ALONE = beats(17);
const LAST = beats(68);
/** With fewer pairs, these of its five are kept (the first, the one before its gesture alone, then the others). */
const KEPT: Record<number, number[]> = { 2: [0, 4], 3: [0, 2, 4], 4: [0, 1, 2, 4], 5: [0, 1, 2, 3, 4] };
/** Its music's first beat at 0,13 s; 4 dB softer until its bass line comes in, on the third pair's cut (image 120). */
const DOWNBEAT = beats(3.9);
const SOFT_DB = -4;
/** The engine's ending card (the Reel's last 1,6 s): its last shot held whole beats longer for it, only when she has one. */
const CARD_SECONDS = 1.6;
/**
 * Its prints' dry clicking, measured on the original's sound (its 1,5 – 5 kHz band, where it stands 8 to 17 dB over the
 * music only while the prints land): s after the first print, and each click's level (dB from the loudest).
 */
const CLICKS: [number, number][] = [
  [0, -5], [0.035, 0], [0.095, -5], [0.13, 0], [0.165, 0], [0.215, 0], [0.255, -5], [0.29, 0], [0.355, -5],
  [0.39, -1], [0.455, -6], [0.49, -2], [0.53, -5], [0.565, 0], [0.615, -5], [0.65, 0], [0.81, -3], [0.845, -2],
];
const CLICK = { sound: "light click", seconds: 0.5, gain: -6 };
const round = (s: number) => Math.round(s * 100) / 100;
const round3 = (s: number) => Math.round(s * 1000) / 1000;

/** For n shots: its prints and its pairs (its table, its two quick shots, its gesture alone and its last shot besides). */
export function tableParts(n: number): { prints: number; pairs: number } {
  const pairs = Math.max(2, Math.min(5, Math.floor((n - 11) / 2)));
  return { prints: Math.max(1, Math.min(10, n - 5 - 2 * pairs)), pairs };
}

/** When each of its prints lands, in beats: the original's ten, or as many sampled along them. */
export function printLandings(prints: number): number[] {
  return Array.from({ length: prints }, (_, k) => {
    const x = prints > 1 ? (k * (LANDS.length - 1)) / (prints - 1) : 0;
    const i = Math.min(LANDS.length - 2, Math.floor(x));
    return LANDS[i]! + (LANDS[i + 1]! - LANDS[i]!) * (x - i);
  });
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  // Its shots in order: her table, her prints, its two quick shots, its pairs (the gesture, then her place beside it),
  // the gesture's half alone, its last shot.
  const P = Math.max(0, Math.min(n - 1, Math.round(mark("prints", Math.max(1, n - 15)))));
  const K = Math.max(0, Math.round(mark("pairs", Math.floor((n - P - 5) / 2))));
  const Q = P + 1;
  const FP = P + 3;
  const SOLO = FP + 2 * K;
  const LAST = n - 1;
  const at = (i) => (shots[i] ? shots[i].from : durationInFrames);
  const SPLIT = n > FP ? at(FP) : durationInFrames;
  const FULL = at(LAST);
  const BURN = Math.round(mark("burn", SPLIT - 2));
  const FADE = Math.round(mark("fade", SPLIT - 22));
  const endAt = end ? end.from : durationInFrames + 1;

  // Its frame: a horizontal 4:3 band on black, as the original, when her table's video is in width (or she asks), else
  // the whole vertical frame; every place below is in it.
  const format = setting("format", "auto");
  const wide = format === "horizontal" || (format === "auto" && (Number(shots[0] && shots[0].aspect) || 0.5625) > 1.15);
  const bw = width;
  const bh = wide ? Math.round((width * 3) / 4) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const box = { position: "absolute", left: 0, top: 0, width: bw, height: bh };

  // Its halves: her place on the left and the gesture on the right (2:3 each); in vertical, the gesture above and her
  // place under it (9:8 each).
  const half = wide ? { place: { x: 0, y: 0, w: Math.round(bw / 2), h: bh }, gesture: { x: Math.round(bw / 2), y: 0, w: bw - Math.round(bw / 2), h: bh } } : { gesture: { x: 0, y: 0, w: bw, h: Math.round(bh / 2) }, place: { x: 0, y: Math.round(bh / 2), w: bw, h: bh - Math.round(bh / 2) } };
  // One of her shots in a half, at its own speed; « whole »: its full frame seen through the half, in place.
  const pane = (i, r, key, style, whole) => h("div", { key, style: { position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, overflow: "hidden" } },
    h(Footage, { shot: i, style: whole ? { position: "absolute", left: -r.x, top: -r.y, width: bw, height: bh, ...style } : { position: "absolute", left: 0, top: 0, width: r.w, height: r.h, ...style } }));

  let film = null;
  if (n && frame < at(Q)) {
    // 1. Her table, as filmed.
    film = h(Footage, { shot: 0, style: box });
  } else if (frame < SPLIT && n > Q) {
    // 3. Its two quick shots, jerky (each image held three: about eleven a second); the second burned on its last two
    // images: all to a cold white but its reddest, then black on the left and white on the right.
    const i = frame < at(Q + 1) ? Q : Q + 1;
    if (frame === BURN + 1) film = h("div", { style: { ...box, background: "linear-gradient(90deg, #000000 30%, #f2fdff 41%)" } });
    else if (frame === BURN) film = h("div", { style: box }, h(Footage, { shot: i, hold: 3, style: { ...box, filter: "brightness(3.2) contrast(3.4) saturate(1.6)" } }), h("div", { style: { ...box, background: "#ecfcff", mixBlendMode: "multiply" } }));
    else film = h(Footage, { shot: i, hold: 3, style: box });
  } else if (frame <= FULL && n > FP) {
    // 4. The split screen: the gesture (its main line: its pairs' first shots, then its half alone) and her place laid
    // beside it on the same moment, each at its own speed, cutting together, the gesture alone once; the gesture's half
    // still bright two images after the burn. Its last shot takes the gesture's half first, then the whole frame.
    let g = FP;
    for (let i = FP; i <= Math.min(SOLO, LAST - 1); i += i < SOLO ? 2 : 1) if (at(i) <= frame) g = i;
    let p = FP + 1;
    for (let i = FP + 1; i < SOLO; i += 2) if (at(i) <= frame) p = i;
    const lit = frame - SPLIT < 2 ? { filter: "brightness(1.14)" } : {};
    film = h(React.Fragment, null,
      p < n ? pane(p, half.place, "place") : null,
      frame >= FULL ? pane(LAST, half.gesture, "last", {}, true) : pane(g, half.gesture, "gesture", lit));
  } else if (n) {
    // 5. Its last shot, full frame, held to the end.
    film = h(Footage, { shot: LAST, style: box });
  }

  // 2. Her prints, laid at once at the centre of her table, one on the other, as the original's ten: their centres,
  // heights (shares of the frame's), shapes and angles, fitted on its images; borderless, with no shadow; never moving.
  // In vertical, about 37 % of the width. A video is still on its instant. The pile goes by its light (LumaFade).
  const PRINTS = [[0.499, 0.499, 0.494, 0.667, 0], [0.508, 0.53, 0.47, 0.667, -14.9], [0.499, 0.499, 0.526, 0.667, -9.9], [0.5, 0.497, 0.48, 0.667, -7.1], [0.497, 0.523, 0.324, 0.96, 7.8], [0.513, 0.53, 0.47, 0.667, -13.1], [0.495, 0.527, 0.456, 0.75, 11], [0.5, 0.5, 0.478, 0.667, -1.9], [0.499, 0.501, 0.424, 0.667, 0], [0.499, 0.513, 0.452, 0.667, 0]];
  const scale = wide ? 1 : 1.5;
  const lands = Array.from({ length: P }, (_, k) => Math.round(mark("p" + k, 13 + 2.5 * k)));
  const pile = P && frame >= lands[0] && frame < FADE + 4 && frame < at(Q)
    ? h(LumaFade, { at: FADE, frames: 4 },
        lands.map((f, k) => {
          if (frame < f) return null;
          const s = PRINTS[Math.min(PRINTS.length - 1, Math.round((k * (PRINTS.length - 1)) / Math.max(1, P - 1)))];
          const ph = Math.round(s[2] * bw * 0.75 * scale);
          const pw = Math.round(ph * s[3]);
          return h("div", { key: "print" + k, style: { position: "absolute", left: Math.round(s[0] * bw - pw / 2), top: Math.round(s[1] * bh - ph / 2), width: pw, height: ph, overflow: "hidden", transform: "rotate(" + s[4] + "deg)" } },
            h(Footage, { shot: k + 1, at: durationInFrames * 4 + 1000, style: { position: "absolute", left: 0, top: 0, width: pw, height: ph } }));
        }))
    : null;

  // Her two words written by hand, cream, with a hair of shade (her table may be lighter than the original's): the words
  // that bring her name on the left of the pile, her name on the right, on one line just above the middle (two when it
  // is long, growing upward, never smaller than can be read); fading in together over 8 images, gone with the split
  // screen. A hand that never repeats (Handwriting), in a fine felt-tip script, its letters spaced.
  const hand = "'Shadows Into Light', '" + brand.bodyFont + "', cursive";
  const SIZE = 56;
  const LINE = Math.round(SIZE * 0.8);
  const lead = reelTexts.find((t) => t.role === "caption");
  const name = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== lead && t !== name);
  const pileW = wide ? 0.17 * bw : 0.245 * bw;
  // Its letters (about 50 px below their slot's middle, measured by the scene check) end above the middle of the screen,
  // where the apps' buttons begin on the right: in the 4:3 band, whose middle is the screen's, its line sits a little
  // higher than the original's (its name is 2.5 times as big and reaches the right edge).
  const baseY = Math.round(bh * (wide ? 0.44 : 0.445)) - LINE;
  const zones = { left: { x: 40, w: Math.round(bw / 2 - pileW - 52) }, right: { x: Math.round(bw / 2 + pileW + 12), w: Math.round(bw / 2 - pileW - 52) } };
  const rowsOf = (text, w) => {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const fits = (s) => Array.from(s).length * SIZE * 0.38 <= w;
    if (words.length < 2 || fits(words.join(" "))) return [words.join(" ")];
    let best = null;
    for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(" "); const b = words.slice(k).join(" "); const m = Math.max(a.length, b.length); if (!best || m < best.m) best = { m, rows: [a, b] }; }
    return best.rows;
  };
  const write = (t, zone, align, seed) => {
    if (!t || frame < t.from || frame >= Math.min(t.to, endAt)) return null;
    const rows = rowsOf(t.text, zone.w);
    return h("div", { key: seed, style: { ...box, opacity: interpolate(frame, [t.from, t.from + 8], [0, 1], clamp) } },
      h(Handwriting, { text: rows.join("\n"), box: { x: zone.x, y: baseY - (rows.length - 1) * LINE, w: zone.w, h: LINE * rows.length }, color: "#fff0d6", grain: 0, wobble: 0.8, last: 1, align, style: { fontFamily: hand, fontWeight: 400, letterSpacing: "0.04em", textShadow: "0 1px 3px rgba(0,0,0,0.45)" }, seed }));
  };
  const words = [write(lead, zones.left, "right", "table-gauche"), write(name, zones.right, "left", "table-droite")];

  // Its ending card when she has one (the original has none): her last shot a little darker, its title written by the
  // same hand in the middle, its line under it.
  const card = end && frame >= endAt
    ? h(React.Fragment, null,
        h("div", { style: { ...box, background: "#0b0706", opacity: 0.35 * interpolate(frame, [endAt, endAt + 8], [0, 1], clamp) } }),
        h(Handwriting, { text: rowsOf(end.title, bw - 280).join("\n"), box: { x: 140, y: Math.round(bh * 0.5) - (end.subtitle ? 150 : 90), w: bw - 280, h: 120 }, color: "#fff0d6", grain: 0, wobble: 0.8, last: 1, align: "center", style: { fontFamily: hand, letterSpacing: "0.03em", textShadow: "0 1px 3px rgba(0,0,0,0.45)" }, seed: "table-carte" }),
        end.subtitle ? h(FitText, { style: { position: "absolute", left: 140, top: Math.round(bh * 0.5) + 10, width: bw - 280, height: 110 }, innerStyle: { fontFamily: "'" + brand.bodyFont + "', 'Inter Tight', sans-serif", fontWeight: 500, fontSize: 48, lineHeight: 1.15, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff0d6", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.5)" } }, end.subtitle) : null)
    : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film, pile, words, card);

  // Any other text of the Reel (none in its slots): a plain line above its band, or at the top, so nothing is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.max(100, by - 130 - i * 120) : 170 + i * 130, height: 110 }, innerStyle: { fontFamily: "'" + brand.bodyFont + "', 'Inter Tight', sans-serif", fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.6)" } }, t.text));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

/** Where each half is for the filler, as the layout her table gives it or the one she asked for. */
function sides(format: string | undefined): { place: string; gesture: string } {
  if (format === "horizontal") return { place: "la moitié de gauche", gesture: "la moitié de droite" };
  if (format === "vertical") return { place: "la moitié du bas", gesture: "la moitié du haut" };
  return { place: "la moitié de gauche (du bas quand le Reel est vertical)", gesture: "la moitié de droite (du haut quand le Reel est vertical)" };
}

export const table: MontageSkill = {
  key: "table",
  // 2: written again on its original's fiche: horizontal 4:3 on black as the original when her table's video is in
  // width (its format setting), its prints at once at the centre at its ten measured boxes and angles, without border
  // nor shadow, eleven a second, with its clicking; its pile gone by its light; its quick shots jerky, its burned flash;
  // its split screen side by side, each half at its own speed (simultaneous shots), its gesture's half cutting alone,
  // its last shot taking the frame from that half; its music up 4 dB on its third pair and cut dead; no ending card,
  // vignette nor grain unless she asks.
  version: 2,
  bpm: BPM,
  shots: [13, 25],
  files: [8, 20],
  how: "Sa table filmée posée ; deux petits mots écrits à la main en crème apparaissent en fondu de part et d'autre de son milieu (à gauche ce qui amène son nom, à droite son nom) ; ses photos s'y posent d'un coup au centre, l'une sur l'autre, onze par seconde, comme des tirages sans bord ni ombre, chacune tournée comme celles de l'original ; la pile tenue un temps s'efface par la lumière (le sombre d'abord), puis deux plans éclair de son lieu, saccadés, le second brûlé au blanc ; puis un écran partagé, son lieu dans une moitié et un geste sur ce qu'elle fait dans l'autre, chacun à sa vitesse, qui coupent ensemble, puis la moitié du geste coupe seule, de plus près ; enfin sa plus belle pièce vue du dessus prend la moitié du geste puis tout le cadre : une main en prend un morceau et sort du cadre. En horizontal 4:3 sur du noir comme l'original quand sa vidéo de table est en largeur, sinon plein écran (l'écran partagé en deux moitiés l'une sur l'autre).",
  end: true,
  texts: [
    { slot: "gauche", role: "caption", want: "les petits mots écrits à la main à gauche de la pile, qui amènent son nom (une forme comme « voici », « ici c'est », « ce soir chez »)", max: 14, required: true },
    { slot: "droite", role: "hook", want: "son nom, écrit à la main à droite de la pile (court : le mot qui la distingue quand il est long, « Farine » pour « Maison Farine »)", max: 16, required: true },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal 4:3 comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme sa vidéo de table (horizontal si elle est en largeur)" },
        { value: "horizontal", says: "horizontal 4:3 sur du noir, comme l'original, l'écran partagé en deux moitiés côte à côte" },
        { value: "vertical", says: "vertical plein écran, l'écran partagé en deux moitiés l'une sur l'autre (le geste en haut)" },
      ],
    },
  ],
  // Its original's grade (docs/fiches/table.md, effect 8): warm and dark, but no vignette and no grain.
  finish: { vignette: 0, grain: 0 },
  timeline(n, options) {
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const { prints, pairs } = tableParts(n);
    const kept = KEPT[pairs]!;
    const card = options.end ? Math.ceil(CARD_SECONDS / beat - 1e-6) : 0;
    // Its main line: her table, its quick shots, the gesture of each pair, the gesture alone, its last shot.
    const main = beatSpans(bpm, [TABLE, ...QUICK, ...kept.map((k) => PAIRS[k]!), ALONE, LAST + card]);
    const duration = main.at(-1)!.end;
    const at = (b: number) => round(Math.round(b * beat * 30) / 30);
    const side = sides(options.settings?.format);
    const shot = (s: { start: number; end: number }, want: string, beside = false): SkillShot => ({ start: s.start, end: s.end, want, ...(beside ? { beside: true } : {}) });
    const landed = printLandings(prints);
    const split = main[3]!;
    const last = main.at(-1)!;
    const shots: SkillShot[] = [
      shot(main[0]!, "sa table ou son comptoir filmé posé, de trois quarts en plongée, le milieu dégagé (ses photos s'y posent en pile), dans sa lumière : une vidéo de 2 s au moins, en largeur de préférence (le format de l'original)"),
      ...landed.map((b) =>
        shot({ start: at(b), end: at(BARE) }, "une photo de ce qu'elle fait, posée comme un tirage au milieu de sa table : d'une même série que les autres (même lumière, mêmes fonds), en hauteur de préférence, mieux encore ce qu'on verra filmé ensuite ; une vidéo y entre figée sur un instant, jamais deux fois la même image", true),
      ),
      shot(main[1]!, "un plan éclair de son lieu filmé en bougeant vite, un détail en hauteur : un lustre, une suspension, son enseigne, des plantes (joué saccadé)"),
      shot(main[2]!, "un autre plan éclair, un détail de près filmé en bougeant : une serviette, ses outils, un produit (joué saccadé, puis brûlé au blanc)"),
      ...kept.flatMap((_, j) => {
        const g = main[3 + j]!;
        // The last pair's place holds while the gesture's half cuts alone, until its last shot takes the frame.
        const place = j === kept.length - 1 ? { start: g.start, end: round(last.start + 1 / 30) } : g;
        return [
          shot(g, `${side.gesture} de l'écran partagé : un geste sur ce qu'elle fait, de près (une main qui prend, qui lève un verre, une cuillère qui entame, qui coupe, qui verse, qui emballe)${j === 1 ? ", de préférence le même geste qu'à la paire d'avant, de plus près" : ""} ; joué à sa vitesse, en même temps que son lieu dans l'autre moitié`),
          shot(place, `${side.place} de l'écran partagé : son lieu (la salle, une table dressée, un coin, une applique, sa vitrine), la caméra posée ou qui glisse lentement de côté ; joué à sa vitesse, en même temps que le geste`, true),
        ];
      }),
      shot(main[3 + kept.length]!, `${side.gesture}, seule : le même geste que la case d'avant, de plus près (son lieu reste dans l'autre moitié)`),
      shot(last, "sa plus belle pièce vue du dessus, caméra fixe : une main en prend un morceau et le sort du cadre par le haut, puis la pièce reste seule ; elle prend la moitié du geste puis tout le cadre, jusqu'à la fin"),
    ];
    // Its prints' clicking, from the first one, at the tempo's pace.
    const sounds: SkillSound[] = prints
      ? [{ at: at(landed[0]!), ...CLICK, burst: { times: CLICKS.map(([t]) => round3((t * BPM) / bpm)), gains: CLICKS.map(([, g]) => g) } }]
      : [];
    // Its words fade in on the bare table, before the first print, and go with the split screen.
    const words = { from: at(WORDS), to: split.start };
    return {
      duration,
      shots,
      texts: { gauche: words, droite: words },
      marks: {
        prints,
        pairs,
        fade: toFrame(FADE * beat),
        burn: toFrame(main[2]!.start + BURN * beat),
        ...Object.fromEntries(landed.map((b, k) => [`p${k}`, toFrame(b * beat)])),
      },
      sounds,
      // Its music: its first beat at 0,13 s, 4 dB softer until its bass line comes in on the third pair's cut (the last
      // pair's with fewer), then at its level; cut dead two images before the end, as the original's.
      music: {
        downbeat: round3(DOWNBEAT * beat),
        filters: [{ kind: "soft", from: 0, to: main[3 + Math.min(2, kept.length - 1)]!.start, db: SOFT_DB }],
        end: { at: round3(duration - 2 / 30) },
      },
    };
  },
  code: CODE,
  fonts: ["Shadows Into Light"],
};
