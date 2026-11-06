import { END_CARD_SECONDS, beatSpans, type MontageSkill } from "../skills.ts";

// « Titre de film signé », version 1, written on its original's fiche (docs/fiches/titre-cinema.md: measured image by
// image at 30 i/s, its title's letters and colour read on the pixels, its sound by bands; Gemini's reading corrected:
// its format, its fixed camera, its tempo, its sans-serif title, its upright byline, the man passing in front of it).
// A film's opening title, signed: over a still wide shot at dusk where a man walks slowly towards the camera looking up,
// a word in very heavy square capitals, white, dead centre, there from the first image and still, and under its end, in
// a roman serif, its author's name (« by … »), behind the man: his head covers it as he comes closer, never the title.
// Its music's intro plays under it without its kick nor its bass, rising; the cut takes the title away and the beat
// drops on it. Then five still shots a bar or two each, cut on the kick: someone alone, from behind, before something
// that shines (a carousel), the sea at dusk, a huge aquarium (the longest), people together, a walk at sunset, cut dead.
// Its music: dreamy indie pop in a swaying triplet feel, a bar every 1,932 s (124,2 BPM in fours, a kick on the bar's
// first beat and a snare on its third), its first bar at 0,35 s; every length below is in its beats from the Reel's
// start, at the original's cuts (6,10 · 8,10 · 10,07 · 13,83 · 16,90 s, its end 20,57 s): each one falls on its image.
// Here her title is her craft, her place or what her film shows, her signature « par » and her name (the original's
// « CINEMATOGRAPHY » and « by TASHI » are its own: never copied), in her charter; she passes in front of her signature
// (her cut-out, on her first shot only), the lockup set from where her head is; without her, at the original's place.
// Played as the original, its near-square 10:9 window on black, when her files are mostly horizontal (or she asks),
// else full frame (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »). Her shots as
// filmed: a photo stays still, a video plays; nothing moves the camera.

const BPM = 124.2;
/** The original's first bar starts 0,35 s in: its pickup, in beats from the Reel's start. */
const FIRST = 0.728;
/** The beat its kick and bass drop on, from its first beat (its bar 4, 6,15 s: an image and a half after the cut). */
const DROP = 12;
/** Its title's shot, from the Reel's start to its first cut (6,10 s), in beats. */
const TITLE = 12.63;
/** Its three still shots after it: what shines (8,10 s), a view (10,07 s), the longest one, close (13,83 s). */
const MIDDLE = [4.14, 4.07, 7.79];
/** Past six shots (a length she asks for), more of its middle: a bar, a bar, two bars, before its people. */
const MORE = [4, 4, 8];
/** People together (16,90 s), then the walk at sunset to the end (20,57 s), cut dead. */
const PEOPLE = 6.35;
const LAST = 7.59;
/**
 * With the engine's ending card (its last 2,5 s, over the walk), the walk held half a bar longer (two beats, the snare
 * of its bar), so most of it still plays alone: whole bars longer, the card's walk outran three passages of one video.
 */
const CARD_BEATS = 2;
const LONG = 11;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");

  // 1. Its frame: the original's near-square window (10:9, the whole width, black above and below, as its 720 × 648
  // picture shows in a vertical feed) when most of her shots are horizontal, or when she asks; else her vertical frame,
  // full. Every place below is a share of it.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const windowed = format === "fenetre" || (format === "auto" && wideShots * 2 > n);
  const BH = windowed ? Math.round(width * 0.9) : height;
  const BY = windowed ? Math.round((height - BH) / 2) : 0;
  const laid = { left: 0, top: BY, width, height: BH };
  const box = { position: "absolute", left: 0, top: BY, width, height: BH };

  // 2. Its lockup, measured on the original: a word in very heavy square capitals as wide as 62,5 % of the frame for its
  // 14 letters (a shorter word bigger, its capitals 6 % of the width at most), white; under its end, a gap of 59 % of a
  // capital lower, a signature in a roman serif, its capitals 72 % of the title's (48 px at least), set in from its edge
  // a fifth of a capital. Sizes in px of a font whose capitals are 0,63 of it (the title) and 0,66 (the serif).
  const sizes = (word) => {
    const F = Math.round(within((width * 0.625) / (0.716 * Math.max(4, Array.from(word).length)), width * 0.05, width * 0.095));
    const S = Math.round(within(F * 0.69, 48, 64));
    return { F, S, m: Math.round(0.22 * F - 0.25 * S), HK: Math.round(1.22 * F + 0.9 * S), pad: Math.round(0.25 * F) };
  };
  const display = "'" + brand.displayFont + "', 'Sarpanch', 'Archivo Black', sans-serif";
  const serif = "'" + brand.bodyFont + "', 'Tinos', 'Times New Roman', serif";
  const WHITE = "#fffcf8";
  const top0 = Math.max(80, Math.round(BY + BH * 0.05));
  const top1 = (z) => Math.round(Math.min(height * 0.75 - 12, BY + BH * 0.96) - z.HK);
  // The original's place: its title's capitals centred on the middle of the frame.
  const middle = (z) => within(Math.round(BY + BH * 0.5 - 0.535 * z.F), top0, top1(z));
  // One box for both, its top on the title's line, a pad around it (the glyphs of a tight line poke out of it): a long
  // word in a wide font is smaller, its signature with it. Keyed by its words (a box measures once).
  const lockup = (word, line, top, z, side, key) =>
    h(FitText, { key: key + "-" + word + "|" + line, style: { position: "absolute", left: 140, top: top - z.pad, width: width - 280, height: z.HK + 2 * z.pad }, innerStyle: { justifyContent: "flex-start", paddingTop: z.pad } },
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "stretch" } },
        h("div", { style: { fontFamily: display, fontWeight: 900, fontSynthesis: "none", fontSize: z.F, lineHeight: 1, letterSpacing: "-0.01em", color: WHITE, whiteSpace: "nowrap", textAlign: "center" } }, word),
        line ? h("div", { style: { fontFamily: serif, fontWeight: 400, fontSize: z.S, lineHeight: 1.15, marginTop: z.m, padding: "0 " + Math.round(0.13 * z.F) + "px", color: WHITE, whiteSpace: "nowrap", textAlign: side } }, line) : null));

  // 3. Where she is in her first shot, read on her cut-out every six images: the middle of the heights its top reaches
  // (her head, as she walks: the original's walker rises into his signature as he comes closer) and the middle of where
  // she stands across the shot (he comes in near the middle and drifts right, under its signature's end).
  const hook = reelTexts.find((t) => t.role === "hook");
  const sign = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== sign);
  const first = shots[0];
  const cut = shots[1] ? shots[1].from : durationInFrames;
  const her = React.useMemo(() => {
    if (!first) return null;
    const seen = [];
    for (let f = Math.max(0, first.from); f < Math.min(cut, endAt); f += 6) {
      const b = SubjectBox(shots[0], f, laid);
      if (b && b.w > 4 && b.h > 4) seen.push(b);
    }
    if (!seen.length) return null;
    const mid = (list) => list.sort((a, b) => a - b)[Math.floor(list.length / 2)];
    return { top: mid(seen.map((b) => b.y)), x: mid(seen.map((b) => b.x + b.w / 2)) };
  }, [n, windowed, cut]);

  // 4. Its title on her first shot, there from its first image, still, gone with the cut: her head covers the lower half
  // of her signature's capitals (its baseline that much under the top of her head), behind her; the signature under
  // the part of the title above her (its end, its start or its middle). No room for it above her (she fills the
  // frame): in front of her, low in the frame. Nobody: at the original's place, the signature under its end.
  const word = hook ? keep(hook.text).toUpperCase() : "";
  const z = sizes(word);
  const below = her ? Math.round(her.top - 1.22 * z.F - 0.33 * z.S) : null;
  const behind = below !== null && below >= top0;
  const T = behind ? Math.min(below, top1(z)) : her ? top1(z) : middle(z);
  const side = !her ? "right" : her.x > width * 0.58 ? "right" : her.x < width * 0.42 ? "left" : "center";
  const showing = Boolean(hook) && cur === 0 && frame >= hook.from && frame < Math.min(hook.to, endAt);
  const title = showing ? lockup(word, sign ? keep(sign.text) : "", T, z, side, "title") : null;
  const herOver = showing && behind ? h(Subject, { key: "her", shot: 0, style: box }) : null;

  // 5. Her shots as filmed, one at a time on its cuts, in its frame.
  const film = n ? h(Footage, { key: "film", shot: cur, style: box }) : null;

  // 6. Its ending card, when she has one (the original has none): her last shot darkened a little, her words set as its
  // title, in front, at its place.
  const e = end ? frame - endAt : -1;
  const ze = end ? sizes(keep(end.title).toUpperCase()) : null;
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { ...box, backgroundColor: "rgba(0,0,0," + (0.38 * Math.min(1, (e + 1) / 8)).toFixed(3) + ")" } }),
        lockup(keep(end.title).toUpperCase(), end.subtitle ? keep(end.subtitle) : "", middle(ze), ze, "right", "end"))
    : null;

  // Any other text of the Reel (none in its slots): a plain white line above her title's place, so nothing she wrote is lost.
  const extra = others.filter((x) => frame >= x.from && frame < Math.min(x.to, endAt)).map((x, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: Math.max(100, BY + Math.round(BH * 0.12)) + i * 120, height: 110 }, innerStyle: { fontFamily: serif, fontWeight: 400, fontSize: 52, lineHeight: 1.15, color: WHITE, textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.5)" } }, keep(x.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, behind ? title : null, herOver, behind ? null : title, ending, extra);
}`;

export const titreCinema: MontageSkill = {
  key: "titre-cinema",
  // 2: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 2,
  bpm: BPM,
  shots: [4, 8],
  // Up to 11 for a length she asks for: its middle again (a bar, a bar, two bars), about 32 s at its own tempo.
  long: LONG,
  files: [3, 8],
  // Its intro under the title and a bar a shot: within 104 to 140, so its longest stays under 45 s.
  tempo: [104, 140],
  how: "Un plan large et fixe au crépuscule où quelqu'un marche lentement ou se tient, le titre de son film en très grandes capitales carrées blanches au milieu du cadre, là dès la première image et immobile, et sous sa fin sa signature en serif (« par Léa »), derrière la personne : sa tête passe devant la signature, jamais devant le titre ; la musique joue son intro sans basse, puis la coupe emporte le titre et la basse tombe ; ensuite des plans fixes d'une ou deux mesures coupés sur le temps fort : quelqu'un seul de dos devant ce qui brille, une vue, un plan plus long de près, des gens ensemble, et pour finir quelqu'un qui marche au soleil couchant, coupé net. En vertical plein écran, ses vidéos horizontales recadrées sur leur sujet ; dans une fenêtre presque carrée sur du noir comme l'original à sa demande.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "le titre de son film, en très grandes capitales au milieu de son premier plan : son métier ou son art en un mot (« Pâtisserie », « Céramique », « Coiffure »), le nom de son lieu, ou ce que montre ce Reel (« Escapade », « Samedi soir ») ; un seul mot de préférence, plus il est court plus il est grand",
      max: 16,
      required: true,
    },
    {
      slot: "signature",
      role: "caption",
      want: "sa signature sous la fin du titre, comme celle d'un réalisateur : « par » et son prénom quand on le connaît (« par Léa »), sinon le nom de son commerce (« par Maison Farine ») ; rien d'inventé",
      max: 26,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : le vertical plein écran, ou la fenêtre presque carrée de l'original sur du noir",
      choices: [
        { value: "vertical", says: "vertical plein écran, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "fenetre", says: "une fenêtre presque carrée (10:9) sur du noir, comme l'original, ses vidéos recadrées sur leur sujet", band: true },
        { value: "auto", says: "comme ses vidéos (la fenêtre presque carrée si la plupart sont horizontales, sinon vertical plein écran)" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, a music's own), every length counted in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(4, Math.min(LONG, n));
    // Its middle for this count: four shots keep what shines and the longest one; five, its three still shots; six, the
    // original's (with its people); past it, more of its middle before its people.
    const middle =
      count === 4
        ? [MIDDLE[0]!, MIDDLE[2]!]
        : count === 5
          ? MIDDLE
          : [...MIDDLE, ...Array.from({ length: count - 6 }, (_, i) => MORE[i % MORE.length]!), PEOPLE];
    // With an ending card, its last shot held two beats longer (the card over its last 2,5 s).
    const spans = beatSpans(bpm, [TITLE, ...middle, LAST + (end ? Math.max(CARD_BEATS, 2 * Math.ceil(END_CARD_SECONDS / beat / 2 - 1e-6)) : 0)]);
    const duration = spans.at(-1)!.end;
    const cut = spans[1]!.start;
    const kinds = count === 4 ? ["lights", "close"] : ["lights", "view", "close", ...Array.from({ length: Math.max(0, count - 6) }, () => "more"), ...(count >= 6 ? ["people"] : [])];
    const WANTS: Record<string, string> = {
      lights: "quelqu'un seul, de dos ou à contre-jour, immobile devant quelque chose qui brille ou qui bouge (des lumières, une vitrine éclairée, un manège, une machine, un comptoir le soir), filmé fixe",
      view: "quelqu'un seul, de dos, immobile face à une vue (la mer, la rue, une fenêtre, un paysage), filmé fixe, calme",
      close: "le plan le plus long : quelqu'un de dos qui regarde quelque chose de près, la main posée dessus ou tendue (une vitrine, un aquarium, ses créations, une œuvre, ses étagères), filmé fixe",
      more: "un plan contemplatif de son lieu ou de son quartier : quelqu'un seul de dos face à la lumière, filmé fixe",
      people: "des gens ensemble, la vie de son lieu (des clients assis, une salle, une terrasse, un public qui regarde ou qui filme), filmé fixe",
    };
    const wants = [
      `le plan d'ouverture, large et fixe (le téléphone posé), au crépuscule ou à la lumière du soir de préférence : son lieu, sa rue ou un paysage, du ciel ou un fond calme dans le haut, et quelqu'un qui y est ou y entre (elle, de préférence), petit dans l'image, qui s'avance lentement, regarde au loin ou lève les yeux ; ${comma(cut)} s au moins à vitesse réelle : le titre de son film s'y pose au-dessus de sa tête et sa tête passe devant sa signature`,
      ...kinds.map((k) => WANTS[k]!),
      "pour finir, quelqu'un qui marche au soleil couchant, de dos ou à contre-jour (une plage, une rue, un chemin, un pont), filmé fixe : le Reel est coupé net dessus",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its title and her signature from the first image of her first shot, gone with its cut.
      texts: { titre: { from: 0, to: round(cut) }, signature: { from: 0, to: round(cut) } },
      marks: {},
      // She is cut out on her first shot only (she passes in front of her signature).
      cutouts: [0],
      // Its first bar 0,35 s in; its intro without its bass until it drops on its bar 4, an image and a half after the
      // cut (the original's kick and bass at 6,15 s); cut dead with the picture.
      music: {
        downbeat: round3(FIRST * beat),
        filters: [{ kind: "thin", from: 0, to: round3((FIRST + DROP) * beat) }],
        end: { at: duration, fade: 0.012 },
      },
    };
  },
  code: CODE,
};
