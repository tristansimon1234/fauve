import type { MontageSkill, SkillShot, SkillSound } from "../skills.ts";

// « L'accueil, puis la rafale », version 1, written on its original's fiche (docs/fiches/bienvenue.md: measured image by
// image at 30 i/s, its yellow letters read on the pixels, the light of each shot, its sound by bands; Tristan: « c'est un
// effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A welcome in two parts: her place calm before it
// opens, four still shots, darker and paler, on which her welcome sentence is written by hand, one line more on each shot,
// stacked in the middle of the frame; then the drop, her words gone, the music in at once and the life of her place in a
// burst of short shots, to her place full in a wide shot. Its sound is a voice alone (four syllables at its own pace), then
// a drop with a heavy 808 at 91,7 BPM: one grid suffices, the drop's, counted from the first image, where it lands on
// sixteenth 16,75; every length below is in its sixteenths (a quarter beat, 0,1636 s), so its 23 cuts fall within an
// image of the original's (19 right on them):
//   0 – 16,75    its four calm shots (cuts on 5, 9,25 and 12,5), a line of her sentence landing at once on each one (the
//                first a sixteenth in), a snap of fingers with each (the original's voice counts; a composed music has
//                none), no music;
//   16,75        the drop: the music comes in at once on its first strong beat, her words gone, the light back;
//   16,75 – 47,25 the burst, twenty shots on the original's cuts (its first four a sixteenth each, stuttering on the
//                drop), her last a wide shot of her place full, the sound to the end.
// Fewer of her files: fewer cuts in the burst, the original's kept by how much they matter (its beats first, then its
// half beats, its stutter last), the burst as long. More, for a length she asks for: bars of ten more shots (its second
// bar's) before its last one. Her photos stay still, her videos play. Its words are hers (the original's « WELCOME TO OUR
// SALON », its salon's logo on its wall and its song are its own: never copied).

const BPM = 91.7;
/** Where its four calm shots start (sixteenths from the Reel's start) and where each line of her sentence lands. */
const CALM = [0, 5, 9.25, 12.5];
const LANDS = [1, 5, 9.25, 12.5];
/** The drop: the original's image 82. */
const DROP = 16.75;
/** The burst's cuts after the drop (sixteenths) and its end (the original's last image), its second bar from 15,75. */
const BURST = [0, 1, 2, 3, 4, 6, 7.5, 10, 11.5, 13.25, 15.75, 17.25, 18, 19.25, 20.5, 22, 24.75, 26, 27.5, 28.75];
const BURST_END = 30.5;
const SECOND = 15.75;
/** A bar added for a longer Reel: its second bar's cuts, sixteen sixteenths. */
const BAR = [0, 1.5, 2.25, 3.5, 4.75, 6.25, 9, 10.25, 11.75, 13];
const BAR_LENGTH = 16;
/** Its burst's inner cuts in the order they are kept for fewer shots: its beats, then its half beats, its stutter last. */
const KEEP = [4, 15.75, 7.5, 11.5, 20.5, 24.75, 28.75, 2, 10, 22, 13.25, 26, 6, 18, 1, 3, 17.25, 27.5, 19.25];
/** Its own count (four calm shots and twenty in the burst), its fewest, and its most for a length she asks for. */
const ORIGINAL = 24;
const FEWEST = 10;
const LONGEST = 44;
/** The engine's ending card: the Reel's last 1,6 s, over its last shot held whole beats longer. */
const END_CARD = 1.6;
/** The most lines of her sentence (one per calm shot). */
const LINES = 4;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");

/**
 * Her sentence cut into lines as its code writes them: in capitals, at most `most` lines, the cut whose longest line is
 * the shortest (« BIENVENUE / DANS NOTRE / NOUVEAU / SALON »); one line a word up to `most` words.
 */
export function welcomeLines(text: string | undefined, most = LINES): string[] {
  const words = String(text ?? "")
    .normalize("NFC")
    .toLocaleUpperCase("fr")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const length = (s: string) => Array.from(s).length;
  let best: { most: number; even: number; rows: string[] } | null = null;
  const go = (start: number, left: number, acc: string[]) => {
    if (left === 1) {
      const rows = [...acc, words.slice(start).join(" ")];
      const longest = Math.max(...rows.map(length));
      // The longest line the shortest; between two, the more even (« À LA / MAISON » rather than « À / LA MAISON »).
      const even = rows.reduce((sum, r) => sum + length(r) ** 2, 0);
      if (!best || longest < best.most || (longest === best.most && even < best.even)) best = { most: longest, even, rows };
      return;
    }
    for (let stop = start + 1; stop <= words.length - left + 1; stop++) go(stop, left - 1, [...acc, words.slice(start, stop).join(" ")]);
  };
  if (words.length) go(0, Math.max(1, Math.min(most, words.length)), []);
  return (best as { rows: string[] } | null)?.rows ?? [];
}

/** Which of its four landing moments each of `count` lines takes: one each, the last always on its last calm shot. */
export const landingSlots = (count: number): number[] => Array.from({ length: count }, (_, g) => (g === count - 1 && count > 1 ? LINES - 1 : g));

/** Its burst for m shots: its cuts after the drop (sixteenths, its first at 0) and its length. */
export function burstCuts(m: number): { cuts: number[]; length: number } {
  const count = Math.max(1, Math.round(m));
  if (count <= BURST.length) return { cuts: [0, ...KEEP.slice(0, count - 1).sort((a, b) => a - b)], length: BURST_END };
  // Bars of ten more before its second bar, the last one cut short after its last shot so the Reel grows with each one.
  let extra = count - BURST.length;
  const first = BURST.filter((c) => c < SECOND);
  const added: number[] = [];
  let at = SECOND;
  while (extra > 0) {
    const k = Math.min(BAR.length, extra);
    added.push(...BAR.slice(0, k).map((c) => at + c));
    at += k < BAR.length ? BAR[k]! : BAR_LENGTH;
    extra -= k;
  }
  const shift = at - SECOND;
  return { cuts: [...first, ...added, ...BURST.filter((c) => c >= SECOND).map((c) => c + shift)], length: BURST_END + shift };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const card = Boolean(end) && frame >= endAt;
  const DROP = Math.max(1, Math.round(mark("drop", 82)));
  const LAND = [5, 25, 45, 61].map((d, k) => Math.round(mark("land" + k, d)));

  // 1. Its frame: her pictures full frame, as the original's; or her videos whole in a 16:9 band on black in the middle
  // when most of them are in width (or she asks). Her sentence stays where it is, stacked in the middle of the frame.
  const format = setting("format", "auto");
  const inWidth = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const band = format === "horizontal" || (format === "auto" && n > 0 && inWidth * 2 > n);
  const BH = Math.round((width * 9) / 16);
  const LAID = band ? { left: 0, top: Math.round((height - BH) / 2), width, height: BH } : { left: 0, top: 0, width, height };

  // 2. Her four calm shots, before the drop: her place before it opens, darker and paler (the original's are half as
  // bright as its burst, pale and cool, a light of about 0,2 under its words), a veil dosed on the light read under her
  // words (LightUnder, read before the render on these four only): its mean brought to about 0,25 and its brightest tenth
  // to about 0,6, a shot already dark hardly touched; without a reading, a middle dose. Under her ending card, her last
  // shot gets the middle dose (never read: a shot named by a variable would have every shot of the Reel read).
  const AREA = { x: 140, y: Math.round(height * 0.3), w: width - 280, h: Math.round(height * 0.4) };
  const lightOf = (k) => (k === 0 ? LightUnder(shots[0], frame, LAID, AREA) : k === 1 ? LightUnder(shots[1], frame, LAID, AREA) : k === 2 ? LightUnder(shots[2], frame, LAID, AREA) : k === 3 ? LightUnder(shots[3], frame, LAID, AREA) : null);
  const dose = (read) => (read ? Math.max(0.35, Math.min(0.92, 0.25 / Math.max(0.05, read.mean), 0.6 / Math.max(0.05, read.high))) : 0.7);
  const veil = (b) => "brightness(" + b.toFixed(3) + ") saturate(0.7)";
  const calm = n > 0 && frame < DROP && cur < 4;
  const filter = calm ? veil(dose(lightOf(cur))) : card ? veil(0.62) : null;
  const picture = n ? h(Footage, { key: "shot" + cur, shot: cur, style: { position: "absolute", left: LAID.left, top: LAID.top, width: LAID.width, height: LAID.height, ...(filter ? { filter } : {}) } }) : null;

  // 3. Her welcome sentence, written by a hand that never repeats (Handwriting): in capitals, four lines at most (the cut
  // whose longest line is the shortest), one line more on each calm shot (the first a sixteenth in, the last always on the
  // last calm shot), each landing whole at once and still, stacked in the middle of the frame (a line every 185 px, the
  // stack centred on the middle, as the original's), gone at once on the drop. Mynerve, the closest monoline hand to the
  // original's doodle capitals, 112 px (its capitals about 80 px, the original's 78), spaced 0,12 em, no grain (a digital
  // pen), its letters strayed a little more for their bounce, a thin dark edge so they still read on a bright spot. Its
  // ink: her colour when it reads on a dark picture (light enough), else the original's fluo yellow; or the yellow, or
  // white, as her words ask.
  const keep = (s) => String(s || "").normalize("NFC").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const up = (s) => keep(s).toLocaleUpperCase("fr").replace(/\s+/g, " ").trim();
  const length = (s) => Array.from(s).length;
  const split = (list, k) => {
    let best = null;
    const go = (start, left, acc) => {
      if (left === 1) {
        const rows = acc.concat([list.slice(start).join(" ")]);
        const most = Math.max.apply(null, rows.map(length));
        const even = rows.reduce((sum, r) => sum + length(r) * length(r), 0);
        if (!best || most < best.most || (most === best.most && even < best.even)) best = { most, even, rows };
        return;
      }
      for (let stop = start + 1; stop <= list.length - left + 1; stop++) go(stop, left - 1, acc.concat([list.slice(start, stop).join(" ")]));
    };
    if (list.length) go(0, Math.max(1, Math.min(k, list.length)), []);
    return best ? best.rows : [];
  };
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return -1; const v = parseInt(m[1], 16); return 0.2126 * lin(((v >> 16) & 255) / 255) + 0.7152 * lin(((v >> 8) & 255) / 255) + 0.0722 * lin((v & 255) / 255); };
  const YELLOW = "#f4ff00";
  const encre = setting("encre", "sienne");
  const INK = encre === "blanc" ? "#ffffff" : encre === "sienne" && lum(brand.accent) >= 0.35 ? String(brand.accent).toLowerCase() : YELLOW;
  const hand = "'Mynerve', '" + brand.displayFont + "', cursive";
  const PITCH = Math.round(height * 0.0964);
  const SIZE = Math.round(height * 0.0583);
  const SLOT = Math.round(height * 0.075);
  const lineAt = (text, g, count, size, seed) => {
    const cy = Math.round(height / 2 + (g - (count - 1) / 2) * PITCH);
    return h(Handwriting, { key: seed + "-" + text, text, box: { x: 140, y: Math.round(cy - SLOT / 2), w: width - 280, h: SLOT }, color: INK, grain: 0, wobble: 1.6, bend: 0, last: 1, align: "center", style: { fontFamily: hand, fontWeight: 400, fontSize: size, letterSpacing: "0.12em", textShadow: "0 0 2px rgba(0,0,0,0.45)" }, seed: seed + "-" + text });
  };
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const lines = hook ? split(up(hook.text).split(" ").filter(Boolean), 4) : [];
  const slotOf = (g) => (g === lines.length - 1 && lines.length > 1 ? 3 : g);
  const words = frame < DROP && !card ? lines.map((t, g) => (frame >= LAND[slotOf(g)] ? lineAt(t, g, lines.length, SIZE, "accueil-" + g) : null)) : [];

  // 4. Its ending card, when the Reel has one (the original has none): her last shot held under it with the calm shots'
  // veil, her title written by the same hand in up to three lines, its line smaller under it, both at once.
  let ending = [];
  if (card) {
    const title = split(up(end.title).split(" ").filter(Boolean), Math.max(1, Math.min(3, Math.round(length(up(end.title)) / 10))));
    const sub = end.subtitle ? up(end.subtitle) : "";
    const count = title.length + (sub ? 1 : 0);
    ending = title.map((t, g) => lineAt(t, g, count, SIZE, "fin-" + g));
    if (sub) ending.push(lineAt(sub, count - 1, count, Math.round(SIZE * 0.6), "fin-ligne"));
  }

  // Any other text of the Reel (none in its slots): a plain line high in the frame, so nothing she wrote is lost.
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 200 + i * 120, width: width - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.1, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.6)" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, picture, words, ending, extra);
}`;

export const bienvenue: MontageSkill = {
  key: "bienvenue",
  version: 1,
  bpm: BPM,
  shots: [FEWEST, ORIGINAL],
  long: LONGEST,
  files: [6, 24],
  // A burst on the beat: slower makes it longer and calmer (14,9 s at 80 BPM with its 44 shots).
  tempo: [80, 110],
  how: "Quatre plans calmes de son lieu avant l'ouverture (sa salle vide, un coin, un petit détail qui bouge, ses produits alignés), assombris et pâlis, sur lesquels sa phrase d'accueil s'écrit à la main en capitales jaune fluo (ou de sa couleur claire), une ligne de plus à chaque plan, empilées au milieu de l'image, un claquement de doigts chacune, sans musique ; puis le drop : les mots partent, la musique entre d'un coup et la vie de son lieu défile en rafale, un plan toutes les une à trois doubles-croches (ses gestes de près, ses résultats, son équipe, ses clients), en pleine lumière, jusqu'à son lieu plein en plan large.",
  end: true,
  texts: [
    {
      slot: "accueil",
      role: "hook",
      want: "sa phrase d'accueil, écrite à la main en capitales sur ses plans au calme, une ligne de plus à chaque plan, empilées au milieu de l'image : 3 à 5 mots courts qui accueillent chez elle (une forme comme « Bienvenue dans notre salon », « Bienvenue chez Farine », « Bienvenue à l'atelier », « Entrez, c'est ouvert ») ; jamais sa demande entière ni une longue phrase",
      max: 40,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : ses vidéos en plein écran vertical, ou entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme ses vidéos : en plein écran quand la plupart sont en hauteur (une vidéo horizontale recadrée sur son sujet), sinon entières dans une bande 16:9 sur du noir" },
        { value: "vertical", says: "en plein écran vertical, comme l'original, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 au milieu de l'écran, sur du noir, sa phrase par-dessus" },
      ],
    },
    {
      name: "encre",
      want: "la couleur de sa phrase écrite à la main",
      choices: [
        { value: "sienne", says: "sa couleur quand elle est assez claire pour se lire sur ses plans assombris, sinon le jaune fluo de l'original" },
        { value: "jaune", says: "le jaune fluo de l'original" },
        { value: "blanc", says: "blanc" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo, words }) {
    // At another tempo (a longer Reel, a music's own): every length counted in sixteenths follows it.
    const bpm = tempo ?? BPM;
    const s16 = 60 / bpm / 4;
    const onFrame = (s: number) => Math.round(s * 30) / 30;
    const count = Math.max(FEWEST, Math.min(LONGEST, Math.round(n)));
    const burst = burstCuts(count - CALM.length);
    const edges = [...CALM, ...burst.cuts.map((c) => DROP + c)];
    // With an ending card, its last shot held whole beats longer (the engine's 1,6 s at least, a frame lost to rounding never cutting into it).
    const card = end ? 4 * Math.ceil((END_CARD + 0.05) / (4 * s16) - 1e-6) : 0;
    const secs = (x: number) => round(onFrame(x * s16));
    const duration = secs(DROP + burst.length + card);
    const times = edges.map(secs);
    const spans = times.map((t, i) => ({ start: t, end: i + 1 < times.length ? times[i + 1]! : duration }));
    const hold = (i: number) => comma(spans[i]!.end - spans[i]!.start);
    const last = spans.length - 1;
    const want = (i: number): string => {
      if (i === 0) return `le premier plan, qui ouvre le Reel sous le premier mot de sa phrase (${hold(i)} s) : son lieu vide et calme, avant l'ouverture, en plan large et fixe (sa salle, ses fauteuils, ses tables, son comptoir vu de loin) ; sinon son plan le plus large de son lieu, filmé sans bouger (il est assombri, ses mots s'écrivent au milieu)`;
      if (i === 1) return `un coin de son lieu au calme, filmé fixe (${hold(i)} s) : son comptoir, son enseigne ou son logo au mur, ses étagères, sa vitrine ; sinon un autre plan calme de son lieu, sans personne de préférence (le deuxième mot de sa phrase s'écrit dessus)`;
      if (i === 2) return `un petit détail qui bouge à peine dans le calme (${hold(i)} s) : un café qui coule, de la vapeur, une bougie, une porte qui s'ouvre, un outil qu'on pose ; sinon un autre détail de son lieu filmé de près`;
      if (i === 3) return `ses produits ou ses outils alignés (une étagère, un présentoir, des flacons, des pots), filmés fixe (${hold(i)} s) ; sinon un autre plan calme de son lieu, différent des trois premiers : le dernier mot de sa phrase s'écrit dessus, juste avant le drop`;
      if (i === 4) return `le plan du drop, quand la musique entre d'un coup (${hold(i)} s) : le plus fort de son travail (un résultat fini, un geste spectaculaire, son produit phare), de près, plein de vie et de couleur`;
      if (i === last) return `le dernier plan (${hold(i)} s) : son lieu plein de vie en plan large (sa salle pleine, son équipe au travail, sa devanture animée) ; sinon son plan le plus large où l'on travaille`;
      return `un éclair de la vie de son lieu (${hold(i)} s) : un geste de son métier de près (ses mains au travail, un outil, ce qui se prépare ou se sert), un résultat dont elle est fière, quelqu'un de l'équipe ou un client qui sourit, son lieu plein ; une image différente de la précédente, d'un autre cadre (de près, puis plus large)`;
    };
    const shots: SkillShot[] = spans.map((s, i) => ({ ...s, want: want(i) }));
    // Her lines, as its code cuts her sentence (four of them when her words are not written yet: the library's lengths, a check).
    const lines = words?.accueil ? welcomeLines(words.accueil).length : LINES;
    const lands = landingSlots(lines).map((k) => LANDS[k]!);
    // A snap of fingers as each line lands, in the silence before the drop (the original's voice counts four syllables there).
    const sounds: SkillSound[] = lands.map((x) => ({ at: round3(onFrame(x * s16)), sound: "single finger snap", seconds: 0.5, gain: 3 }));
    return {
      duration,
      shots,
      // Her sentence from its first line to the drop.
      texts: { accueil: { from: secs(LANDS[0]!), to: secs(DROP) } },
      marks: { drop: Math.round(secs(DROP) * 30), ...Object.fromEntries(LANDS.map((x, k) => [`land${k}`, Math.round(secs(x) * 30)])) },
      sounds,
      // No music on its calm shots: it comes in on the drop (its image, to the millisecond), its first strong beat there;
      // cut softly at the end.
      music: {
        downbeat: round3(onFrame(DROP * s16)),
        pauses: [{ from: 0, to: round3(onFrame(DROP * s16)) }],
        end: { at: duration, fade: 0.15 },
      },
    };
  },
  code: CODE,
  fonts: ["Mynerve"],
};
