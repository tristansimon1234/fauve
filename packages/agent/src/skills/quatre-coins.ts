import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Mots aux quatre coins », version 3, written again on its original's fiche (docs/fiches/quatre-coins.md: measured
// image by image at 30 i/s, its music measured band by band, the video watched and heard by Gemini; Tristan: « c'est un
// effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Its music is a downtempo groove at 92 BPM (its
// first image is its beat −0,3; Gemini heard 78), and every length below is in its beats from the Reel's start, so its
// cuts fall where the original's do (within an image), the music's first strong beat set half a beat in so they fall on
// its beats:
//   0 – 5,53   the first shot of the place, fixed and lively: from its beat 0,75 a sentence lands a piece at a time on
//              the frame's edges, cut in, every three quarters of a beat (the first two half a beat apart): its first
//              words along the top (left, a third in, right), her name and her place on the middle row (left, right),
//              her address along the bottom on one line; small cream lower case, the five words at one size, no shadow
//              (a wide dark halo that only shows on a light area);
//              half a beat after the sentence is whole its bass and kick drop out (only what is above 240 Hz plays)
//              and come back at once on the first cut, where every word goes at once;
//   then ten shots of the place's life, full frame, no text, a beat and a third or so each, wide and close in turn;
//   then her front, held 11,5 beats to the end, her name alone in the middle 2,35 beats after the cut (as someone
//   passes its door), held to the end; its music plays to the last image and stops with it.
// Played horizontal 16:9 on black as the original (a 1,57:1 picture) when her files are mostly horizontal (or she asks),
// else full frame (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »); her photos
// stay still, her videos play, the camera never moves. What belongs to the original's own brand is never copied: its
// name's ® and its sign are its own; hers is her name, as she writes it, in its lower case.

const BPM = 92;
/** The opening shot, in beats: its words, its pause, and its first cut on the original's 8th beat, 5,5 s in (its beats a little slower before). */
const OPENING = 8.5;
/** Where the original's first beat falls in the Reel (its first image is its beat −0,3): its words and its pause are counted from it. */
const LEAD = 0.3;
/**
 * Where its music's first strong beat lands (beats from the Reel's start): half a beat in, so its first cut (8,5) is the
 * first beat of the music's third bar, its next two on its beats and its fourth on an off-beat, as the original's after
 * its reprise (its beats 8, 9, 10, 11,5: composed from 0, the music had its beats half a beat off, its cuts on its off-beats).
 */
const DOWNBEAT = 0.5;
/** Its six pieces land on these beats of the original (images 20, 30, 46, 61, 75 and 89): every three quarters of a beat, the first two closer. */
const WORDS = [0.75, 1.25, 2, 2.75, 3.5, 4.25];
/** Its bass and drums drop out on its beat 4,5 (3,15 s), half a beat after its sentence is whole, until its first cut (here its bass and kick). */
const PAUSE = 4.5;
/** The life of the place, each shot in beats: the original's 21 · 19 · 29 · 25 · 26 · 30 · 24 · 22 · 33 · 36 images, its two last longer. */
const LIFE = [1, 1, 1.5, 1.25, 1.25, 1.625, 1.125, 1.25, 1.625, 1.875];
/** Fewer than ten (six at least): the middle ones go first, in this order; its first three, on the beat, and its two longer last ones stay. */
const DROP = [7, 6, 4, 5];
/** Past ten (a length she asked for), each one more is held two beats. */
const MORE = 2;
/** Each shot of its life, by how close it is, as the original's alternate (never two close ones in a row). */
const LIFE_KINDS = ["wide", "medium", "close", "wide", "detail", "medium", "detail", "medium", "detail", "wide"] as const;
/** Its front, held to the end (the original's 7,47 s), and her name alone this many beats after its cut (image 476). */
const FRONT = 11.5;
const NAME = 2.35;
/** Its address reads before the cut (s): at a fast tempo, its opening lasts that much longer, in half beats. */
const ADDRESS_READ = 2.4;
/** The engine's ending card: the Reel's last 1,6 s (motion.ts, END_CARD_SECONDS); its front is held that much longer, in half beats. */
const END_CARD = 1.6;
/** Its shots: the opening, six to ten of its life, its front; up to 19 for a length she asks for (about 31 s at its tempo, 45 s at its slowest). */
const SHOTS: [number, number] = [8, 12];
const LONGEST = 19;

const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const CUT = mark("cut", n > 1 ? shots[1].from : durationInFrames);
  const W1 = mark("w1", 30);
  const W2 = mark("w2", 45);
  const STEP = Math.max(1, mark("step", 15));
  const NAME_AT = mark("name", n > 1 ? shots[n - 1].from + 46 : durationInFrames);
  const endAt = end ? end.from : durationInFrames + 1;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);

  // Its frame: horizontal 16:9 on black as the original when her files are mostly horizontal (or she asks), else the
  // whole vertical frame.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;

  // 1. Her shots in its frame, cut on its beats, as filmed: a video plays, a photo stays still, nothing moves them.
  const film = n ? h(Footage, { shot: cur, style: { position: "absolute", left: 0, top: 0, width: bw, height: bh } }) : null;
  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film);

  // Its words: a semi-bold tight grotesque in a cream, never white (the original's #E7E2CC), with no shadow nor edge but a
  // wide dark halo that only shows where her picture is light (its fallback on a very bright edge: on its bench, cream on
  // a pale sky or a white front did not read); on a dark wall it does not show, as the original's letters.
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const CREAM = "#E7E2CC";
  const low = (s) => String(s || "").toLocaleLowerCase("fr");
  // A phone number, a postcode or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const byFrom = (a, b) => a.from - b.from;
  const captions = reelTexts.filter((t) => t.role === "caption").sort(byFrom);
  const opening = captions[0];
  const address = captions[1];
  const name = reelTexts.find((t) => t.role === "hook");
  const place = reelTexts.find((t) => t.role === "band");
  const others = reelTexts.filter((t) => t !== opening && t !== address && t !== name && t !== place);

  // Its places, shares of its picture: the top row's capitals at 7 % of its height, the middle row's line at 56 %, the
  // address's at 90 %; full frame, of the part above the apps' caption (its lower fifth). 40 px from the sides (the
  // original's 3 %), and left of the apps' buttons for a row below the middle of the screen.
  const tfH = wide ? bh : Math.round(height * 0.81);
  const capTop = by + 0.07 * tfH;
  const midBase = by + 0.56 * tfH;
  const lowBase = by + 0.9 * tfH;
  const L = 40;
  const edge = (bottom) => (bottom > height / 2 - 12 ? width - 140 : width - 40);
  // The five words at one size (the original's capitals, 5,1 % of its width: 76 px at 1080), its address 0,76 of it, her
  // name alone at the end 1,13; smaller together when her words are long (a grotesque's letter is about half its size).
  const SIZE = Math.round(bw * 0.07);
  const em = (s) => Array.from(String(s || "")).length * 0.53;
  const GAP = 0.6;
  const first = opening ? String(opening.text).split(/\s+/).filter(Boolean) : [];
  const pieces = first.length > 3 ? [first[0], first[1], first.slice(2).join(" ")] : first;
  // Its first word with its capital (the original's « A »), the others in lower case.
  const heads = pieces.map((w, i) => (i ? low(w) : w.charAt(0).toLocaleUpperCase("fr") + low(w.slice(1))));
  // Its words land on their own beats: left, a third in, right (with two, left and right).
  const topAt = heads.length === 3 ? [opening.from, W1, W2] : heads.length === 2 ? [opening.from, W2] : [opening ? opening.from : 0];
  const nameWord = name ? low(name.text) : "";
  const placeWord = place ? low(place.text) : "";
  const topW = edge(capTop + 0.97 * SIZE) - L;
  const midW = edge(midBase + 0.25 * SIZE) - L;
  const lowW = edge(lowBase + 0.25 * SIZE) - L;
  const third = Math.round(bw * 0.34) - L;
  const fitTop = heads.length === 3
    ? Math.min((topW - third) / (em(heads[1]) + GAP + em(heads[2])), topW / (em(heads[0]) + em(heads[1]) + em(heads[2]) + 2 * GAP))
    : heads.length === 2 ? topW / (em(heads[0]) + GAP + em(heads[1])) : heads.length ? topW / em(heads[0]) : SIZE;
  const fitMid = midW / Math.max(1, em(nameWord) + (nameWord && placeWord ? GAP : 0) + em(placeWord));
  const S = Math.max(40, Math.floor(Math.min(SIZE, fitTop, fitMid)));
  const A = Math.max(48, Math.round(S * 0.76));
  const NS = Math.round(S * 1.13);
  const word = { fontFamily: display, fontWeight: 600, fontSize: S, lineHeight: 1.1, letterSpacing: "-0.01em", color: CREAM, whiteSpace: "nowrap", textShadow: "0 0 0.5em rgba(0,0,0,0.3)" };
  const seen = (at) => (frame >= at ? 1 : 0);

  // 2. The sentence on the edges, a piece at a time, cut in: each word set at once where it stays, laid out from the
  // start so nothing moves when it lands; every word goes at once on the first cut. Each row is one box (smaller as a
  // whole if its words do not fit); a line never runs under the apps' buttons.
  const opened = frame < CUT;
  const topRow = opened && heads.length
    ? h(FitText, { style: { position: "absolute", left: L, top: Math.round(capTop - 0.19 * S), width: topW, height: Math.round(1.3 * S) }, innerStyle: { ...word, justifyContent: "flex-start", alignItems: "stretch" } },
        h("div", { style: { display: "grid", gridTemplateColumns: "minmax(max-content, " + ((100 * third) / topW).toFixed(2) + "%) minmax(max-content, 1fr) max-content", alignItems: "baseline", justifyItems: "start", textAlign: "left" } },
          heads.map((w, i) => h("span", { key: i, style: { gridColumn: heads.length === 2 && i === 1 ? 3 : i + 1, paddingRight: i < heads.length - 1 ? GAP + "em" : 0, opacity: seen(topAt[i]) } }, w))))
    : null;
  // Her name on the left, her place on the right, a little under the middle of the picture.
  const midRow = opened && (nameWord || placeWord)
    ? h(FitText, { style: { position: "absolute", left: L, top: Math.round(midBase + 0.19 * S - 1.3 * S), width: midW, height: Math.round(1.3 * S) }, innerStyle: { ...word, justifyContent: "flex-end", alignItems: "stretch" } },
        h("div", { style: { display: "flex", justifyContent: nameWord ? "space-between" : "flex-end", alignItems: "baseline", gap: GAP + "em" } },
          nameWord ? h("span", { key: "n", style: { opacity: seen(name.from) } }, nameWord) : null,
          placeWord ? h("span", { key: "p", style: { opacity: seen(place.from) } }, placeWord) : null))
    : null;
  // Her address along the bottom, on one line, as written.
  const lowRow = (rowText, at) => h(FitText, { style: { position: "absolute", left: L, top: Math.round(lowBase + 0.19 * A - 1.3 * A), width: lowW, height: Math.round(1.3 * A) }, innerStyle: { ...word, fontSize: A, justifyContent: "flex-end", alignItems: "flex-start", textAlign: "left" } },
    h("span", { style: { opacity: seen(at) } }, keep(rowText)));
  const bottomRow = opened && address ? lowRow(address.text, address.from) : null;

  // 3. Her front, held: her name alone in the middle of the picture (on its door), the same cream, cut in, held to the end.
  const mid = Math.round(by + bh / 2 - 0.09 * NS);
  const alone = name && frame >= NAME_AT && frame < Math.min(name.to, endAt)
    ? h(FitText, { style: { position: "absolute", left: 140, top: Math.round(mid - 0.65 * NS), width: width - 280, height: Math.round(1.3 * NS) }, innerStyle: { ...word, fontSize: NS } }, nameWord)
    : null;

  // Any other text of the Reel (none in its slots): a plain line, under its picture in width, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.min(1330, by + bh + 30 + i * 120) : Math.round(lowBase - 1.6 * A - 130 - i * 120), height: 110 }, innerStyle: { ...word, fontSize: 52, whiteSpace: "normal", textWrap: "balance" } }, keep(t.text)));

  // 4. Its ending card (her offer, when she has one) in its own words: her title where her name was, her line along the
  // bottom a step later, cut in, the front as it is (no veil).
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: Math.round(mid - 1.15 * NS), width: width - 280, height: Math.round(2.3 * NS) }, innerStyle: { ...word, fontSize: NS, lineHeight: 1.05, whiteSpace: "normal", textWrap: "balance" } }, h("span", null, keep(end.title))),
        end.subtitle ? lowRow(end.subtitle, endAt + STEP) : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, topRow, midRow, bottomRow, alone, extra, ending);
}`;

export const quatreCoins: MontageSkill = {
  key: "quatre-coins",
  // 2: written again on its original's fiche: its format (horizontal 16:9 when her files are), its tempo (92 BPM) and
  // its cuts, its words on its beats from its first image's lead, cream at one size with no shadow (a halo for a light
  // area), its address on one line, its music losing its bass on the whole sentence and back on the first cut, its front
  // held 7,5 s with her name alone in the middle, no vignette.
  // 3: its music's first strong beat half a beat in (`downbeat`): its reprise and its first cuts on the music's beats.
  // 4: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 4,
  bpm: BPM,
  shots: SHOTS,
  long: LONGEST,
  files: [4, 12],
  how: "Sur le premier plan de son lieu, fixe et vivant, une phrase se pose mot à mot sur les bords du cadre, un mot tous les trois quarts de temps, en petites minuscules crème toutes à la même taille, sans ombre : ses premiers mots en haut (à gauche, au tiers, à droite), son nom au milieu à gauche et son quartier au milieu à droite, son adresse en bas sur une ligne ; quand la phrase est complète, la musique perd sa basse et sa grosse caisse, puis repart d'un coup sur la première coupe, où tous les mots partent. Puis la vie du lieu en dix plans courts plein cadre, sans texte, larges et serrés en alternance ; puis sa devanture de face, tenue jusqu'à la fin, où son nom se pose seul au milieu. En vertical plein écran, ses vidéos horizontales recadrées sur leur sujet ; en horizontal comme l'original à sa demande.",
  end: true,
  texts: [
    { slot: "debut", role: "caption", want: "1 à 3 petits mots qui ouvrent la phrase, posés en haut à gauche, au tiers et à droite (une forme comme « un matin chez », « un samedi au », « une journée chez ») ; chacun court", max: 24, required: true },
    { slot: "nom", role: "hook", want: "son nom, posé au milieu à gauche, puis seul au milieu de sa devanture à la fin (il s'écrit en minuscules)", max: 14, required: true },
    { slot: "lieu", role: "band", want: "son quartier ou sa ville quand on les sait, sinon ce qu'elle est en un mot (« fleuriste », « atelier ») ; posé au milieu à droite (il s'écrit en minuscules)", max: 12, required: true },
    { slot: "adresse", role: "caption", want: "une ligne posée en bas, sur une seule ligne : son adresse quand on la sait, sinon un repère concret qu'on sait (« ouvert dès 8 h »), sinon ce qu'elle fait en quelques mots (« fleurs de saison »)", max: 36, required: true },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, ou horizontal comme l'original",
      choices: [
        { value: "vertical", says: "vertical plein écran, les mots en haut, au milieu et en bas du cadre, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, comme l'original, les mots sur les bords de l'image", band: true },
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
      ],
    },
  ],
  // Its original's grade (docs/fiches/quatre-coins.md, effect 5): warm and natural, its corners no darker than the rest:
  // none of the catalogue's vignette laid over everything.
  finish: { vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At her music's tempo when one is given (slower: a longer, calmer Reel; faster: a shorter one), else the model's.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(SHOTS[0], Math.min(LONGEST, n));
    // Its life: the original's ten, its middle ones left out for fewer; past ten, moments held two beats.
    const middle = count - 2;
    const dropped = DROP.slice(0, Math.max(0, LIFE.length - middle));
    const kept = LIFE.map((b, i) => ({ b, kind: LIFE_KINDS[i]! })).filter((_, i) => !dropped.includes(i));
    const life = [...kept, ...Array.from({ length: Math.max(0, middle - LIFE.length) }, () => ({ b: MORE, kind: "more" as const }))];
    // At a fast tempo the opening is never shorter than its address needs to be read; at its own tempo, its beats as written.
    const opening = Math.max(OPENING, Math.ceil((LEAD + WORDS.at(-1)! + ADDRESS_READ / beat) * 2) / 2);
    // With an ending card, its front held half beats longer for the card's 1,6 s (her name held as long as the original's).
    const front = FRONT + (end ? Math.ceil((END_CARD / beat) * 2 - 1e-6) / 2 : 0);
    const spans = beatSpans(bpm, [opening, ...life.map((l) => l.b), front]);
    const duration = spans.at(-1)!.end;
    const cut = spans[1]!.start;
    const frontAt = spans.at(-1)!.start;
    // A moment on its beats from the Reel's start, on the frame grid.
    const at = (b: number) => round(onFrame(b * beat));
    const word = (k: number) => at(LEAD + WORDS[k]!);
    const kinds: Record<(typeof life)[number]["kind"], string> = {
      wide: "un plan large et vivant de son lieu, fixe : des clients à table, sa salle ou sa terrasse pleine, une famille",
      medium: "un plan moyen de l'équipe au travail, fixe : au comptoir, à la machine, au fauteuil, au four",
      close: "un visage de près, fixe : le sourire de quelqu'un de l'équipe ou d'un client",
      detail: "un détail de près, fixe : son enseigne ou sa marque, un geste vu de dessus (une tasse, une assiette, un bouquet), ses outils",
      more: "un moment de plus de la vie du lieu, fixe, tenu deux temps : l'équipe, les clients, un geste ou un détail (large et serré en alternance)",
    };
    const wants = [
      "le premier plan, fixe (téléphone posé), tenu cinq secondes et demie : son lieu assez large et vivant, quelqu'un au travail un peu à gauche du centre (au comptoir, au fauteuil, au four), des bords calmes et plutôt sombres (un mur, une étagère, une vitre) où les mots crème se posent ; pas un grand ciel clair",
      ...life.map((l) => kinds[l.kind]),
      "sa devanture filmée de face, fixe, tenue jusqu'à la fin (une vidéo de 8 s au moins) : son enseigne en haut de l'image, sa porte ouverte ou une vitrine sombre au milieu, où son nom se pose seul, quelqu'un qui entre",
    ];
    return {
      duration,
      music: {
        // Its first strong beat half a beat in (a pickup of the music before it), its cuts on its beats.
        downbeat: at(DOWNBEAT),
        // Its bass and kick drop out half a beat after its sentence is whole (the original's 3,15 s; its snare and hats
        // stay): only what is over 240 Hz plays, and the whole groove is back at once on the first cut (its 20 ms: opened
        // slowly, from its pickup at 4,6 s, the dry music and its filtered copy, out of phase around 300 Hz, hollowed its
        // line by 9 dB). It plays on to the last image and stops with it, as the original's.
        filters: [{ kind: "thin", from: at(LEAD + PAUSE), to: cut }],
        end: { at: duration, fade: 0.02 },
      },
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its pieces on their beats (the top row's other words are marks), all gone with the first cut; her name stays hers
      // to the end: on the middle row with the sentence, then alone on her front.
      texts: {
        debut: { from: word(0), to: cut },
        nom: { from: word(3), to: end ? round(duration - END_CARD) : duration },
        lieu: { from: word(4), to: cut },
        adresse: { from: word(5), to: cut },
      },
      marks: {
        cut: toFrame(cut),
        w1: toFrame(word(1)),
        w2: toFrame(word(2)),
        name: toFrame(frontAt + NAME * beat),
        // Three quarters of a beat in images: the ending card's line a step after its title.
        step: Math.round(0.75 * beat * 30 * 100) / 100,
      },
    };
  },
  code: CODE,
};
