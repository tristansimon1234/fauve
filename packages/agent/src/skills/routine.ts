import { END_CARD_SECONDS, beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Rituel du matin », version 1, written on its original's fiche (docs/fiches/routine.md: a « day in my life » of
// 58,5 s measured image by image at 30 i/s, its title read pixel by pixel, its sound by frequency bands; Tristan: « c'est
// un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Its music is a soft lo-fi beat at
// 90,73 BPM (its kick on 1 and on the swung offbeat of 2, a bar every 2,645 s, its first beat at 0,214 s) far under a
// voice-over that talks from start to end; its cuts follow her gestures and her voice, not its beats, so every length
// below is the original's in images, counted in beats of that music: they fall where the original's do (within an
// image) at its tempo, and follow any other one. Its structure, kept within 45 s (the original runs 58,5):
//   0 – 2,07     the trailer: 13 flashes of 4 or 5 images, each a moment of a shot to come, in the Reel's order (her
//                results, her table from above, her place, her day), under her title typed letter by letter at the
//                middle, two lines of lower-case italic tracked tight in cream, a thin white cursor after the last
//                letter; then her small line under it in a fine italic, at once; all gone with the cut;
//   2,07 – 23    her ritual at the counter, one fixed frontal shot at chest height, one gesture a shot (0,37 to 1,6 s,
//                jump cuts in the same frame), each preparation ending on its result presented with both hands;
//   23 – 24,4    what she made, served, seen from above;
//   24,4 – 42,2  her place shot by shot: its sign, its corners, her people, walking into the room, her at work;
//   42,2 – 58,4  the rest of her day (only in its longest versions here), then three black images, the sound cut.
// Its trailer plays her later shots early (Footage at); nothing is drawn on her shots but the title: no zoom, no push,
// no flash, no grain (the original has none). Her photos stay still, her videos play. Nothing of the original's own is
// copied (its studio's sign and lettering, its drinks' brands, its words « a day in my life », its voice): her title, her
// line, her place. Its format follows her videos (Tristan: « format par défaut [comme ses vidéos], et changement à la
// demande du user »): vertical full frame as the original, her horizontal videos whole in a 16:9 band on black when most
// of them are, or as her words ask.

const BPM = 90.73;
/** Images a beat at its own tempo (19,84): its lengths are measured in images of the original. */
const IPB = 1800 / BPM;
/** Its first beat (0,214 s): the composed music's first strong beat lands there. */
const FIRST = 0.214;
/** Its trailer, in images: 13 flashes, each its length as the original cuts them (4,77 images on average). */
const TRAILER = 62;
const FLASHES = [0, 5, 9, 14, 19, 24, 28, 33, 38, 42, 47, 52, 57];
/** Her small line comes in at once on this image of the trailer (its typing done four images before). */
const LINE_AT = 28;
/**
 * Its ritual, in images, as the original cuts it (16 of its 22 gestures kept, in their order): what each one is. « start »
 * the bowl set down, « quick » a strawberry dropped (0,37 s), « first » the first thing ready presented with both hands,
 * « next » the second begun, « long » the milk poured (1,6 s), « result » the last thing ready, held still.
 */
const RITUAL: [number, "start" | "step" | "quick" | "first" | "next" | "long" | "result"][] = [
  [23, "start"],
  [36, "step"],
  [31, "step"],
  [11, "quick"],
  [28, "step"],
  [27, "first"],
  [29, "next"],
  [23, "step"],
  [48, "long"],
  [28, "step"],
  [36, "step"],
  [27, "step"],
  [30, "step"],
  [34, "step"],
  [27, "step"],
  [30, "result"],
];
/** Fewer gestures: these go first (their index in RITUAL); its start, its quick one, its long pour and its result stay. */
const RITUAL_DROP = [12, 9, 7, 2, 11, 6, 5, 10, 14, 1];
/** What she made, served, seen from above (1,4 s). */
const SERVED = 42;
/** Her place as the original shows its studio, in images, and what each shot wants. */
const PLACE: [number, string][] = [
  [44, "son lieu qui ouvre : son enseigne, son logo au mur ou sa devanture, de face et calme"],
  [37, "un coin de son lieu, large et calme : son comptoir, son bar, ses étagères"],
  [45, "un autre coin, une main qui y passe : ses portants, ses produits, sa vitrine"],
  [38, "des gens : elle avec quelqu'un de l'équipe ou une cliente, souriants (un selfie au miroir, un moment ensemble)"],
  [43, "un détail calme de son lieu : une lumière, une plante, un lavabo, des rideaux"],
  [40, "elle (ou quelqu'un) qui entre dans la salle, filmée de dos en marchant"],
  [34, "la salle plus loin, elle qui avance"],
  [46, "elle au travail, de face ou dans un miroir"],
  [54, "son métier en action, téléphone posé : un geste, un service, une séance"],
  [76, "son métier en action, un autre moment, tenu plus longtemps"],
  [77, "son métier en action, le dernier moment, tenu jusqu'à la fin de son lieu"],
];
/** Fewer shots of her place: these go first; its sign, a corner, her people and her work stay. */
const PLACE_DROP = [6, 4, 2, 8, 5, 9, 7];
/** The rest of her day (the original's last 16 s), in its longest versions only: four of its moments. */
const DAY: [number, string][] = [
  [45, "la suite de sa journée : elle qui marche dehors"],
  [33, "une terrasse, un café dehors"],
  [47, "un moment à table, avec des proches ou des clients"],
  [31, "le chemin du retour, la fin de sa journée (une rue, une voiture, le soir)"],
];
/** The order its day comes in as the Reel grows: the way home first. */
const DAY_ADD = [3, 0, 2, 1];
/** Its three black images at the end, the sound cut with the last one. */
const BLACK = 3;
/** The engine's ending card (an option: the original has none), on the black: the Reel's last 2,5 s at least. */
const END_CARD = END_CARD_SECONDS;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its sections for n shots: its ritual's gestures, its place's shots and its day's (indices in RITUAL, PLACE, DAY). */
export function routineSections(n: number): { ritual: number[]; place: number[]; day: number[] } {
  const m = Math.max(12, Math.min(33, Math.round(n))) - 2;
  const day = Math.max(0, Math.min(DAY.length, m - RITUAL.length - PLACE.length));
  const rest = m - day;
  const place = Math.max(4, Math.min(PLACE.length, rest - Math.max(6, Math.min(RITUAL.length, Math.ceil(rest / 2)))));
  const ritual = rest - place;
  const keep = (count: number, all: number, drop: number[]) => Array.from({ length: all }, (_, i) => i).filter((i) => !drop.slice(0, all - count).includes(i));
  return { ritual: keep(ritual, RITUAL.length, RITUAL_DROP), place: keep(place, PLACE.length, PLACE_DROP), day: DAY_ADD.slice(0, day).sort((a, b) => a - b) };
}

/**
 * Its trailer's flashes for its shots (their index and length in frames, in the Reel's order): its first shot's own
 * moment, then a shot to come each, in the Reel's order (as the original: her pour, her table from above, then her place
 * and her day spread evenly), her other gestures when too few are to come, a shot again at another moment last; each
 * from its passage's middle, a shot seen again from another of its moments each time.
 */
export function routineFlashes(roles: { kind: "trailer" | "ritual" | "served" | "place" | "day"; long?: boolean }[], frames: number[]): { shot: number; offset: number }[] {
  const pour = roles.findIndex((r) => r.long);
  const served = roles.findIndex((r) => r.kind === "served");
  const later = roles.flatMap((r, i) => (r.kind === "place" || r.kind === "day" ? [i] : []));
  const wanted = FLASHES.length - 3;
  // Evenly through a list: `count` of its items, its first and its last among them.
  const spread = (list: number[], count: number) => Array.from({ length: count }, (_, k) => list[Math.round((k * (list.length - 1)) / Math.max(1, count - 1))]!);
  const picks = spread(later, Math.min(wanted, later.length));
  const steps = roles.flatMap((r, i) => (r.kind === "ritual" && i !== pour ? [i] : []));
  picks.push(...spread(steps, Math.min(steps.length, wanted - picks.length)));
  // Still too few: her last shots again (her work, the longest), from another of their moments.
  for (let k = 0; picks.length < wanted && later.length; k++) picks.push(later[later.length - 1 - (k % later.length)]!);
  const used = new Map<number, number>();
  const flashes = [pour, served, ...picks]
    .filter((s) => s > 0)
    .sort((a, b) => a - b)
    .map((shot) => {
      const time = used.get(shot) ?? 0;
      used.set(shot, time + 1);
      const at = [0.45, 0.15, 0.75, 0.3, 0.6, 0.05, 0.9][time % 7]!;
      return { shot, offset: Math.max(0, Math.min(frames[shot]! - 5, Math.round(frames[shot]! * at) - 2)) };
    });
  return [{ shot: 0, offset: 0 }, ...flashes].slice(0, FLASHES.length);
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  // Its moments (frames: its timeline's marks, the original's by default): the trailer's end, her small line, the black.
  const TRAILER = Math.max(13, Math.round(mark("trailer_to", 62)));
  const LINE_AT = Math.max(6, Math.round(mark("line_at", Math.round((TRAILER * 28) / 62))));
  const BLACK = Math.round(mark("black", end ? durationInFrames + 1 : durationInFrames - 3));

  // Its frame: the whole vertical frame, as the original; her videos whole in a 16:9 band on black when most of them
  // are in width (or she asks). Its title stays where the original sets it, a little over the frame's middle.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const box = { position: "absolute", left: 0, top: by, width, height: bh };

  // 1. The trailer: 13 flashes of 4 or 5 images (the original's cuts, at its tempo), its first shot's own moment, then
  // each a shot to come seen early from its middle (its timeline's marks: f<k> the shot, o<k> how far into it), cut clean;
  // then her shots one after the other, as filmed (no zoom, no push).
  const CUTS = [0, 5, 9, 14, 19, 24, 28, 33, 38, 42, 47, 52, 57];
  const flashAt = (k) => Math.round((CUTS[k] * TRAILER) / 62);
  let k = 0;
  while (k < CUTS.length - 1 && flashAt(k + 1) <= frame) k++;
  const fs = Math.round(mark("f" + k, 0));
  const flash = fs >= 0 && fs < n ? fs : 0;
  const picture = !n || frame >= BLACK || frame >= endAt ? null
    : frame < TRAILER ? h(Footage, { key: "t" + k, shot: flash, at: flashAt(k) - Math.round(mark("o" + k, 0)), style: box })
    : h(Footage, { key: "s" + cur, shot: cur, style: box });

  // 2. Her title typed letter by letter at the middle (a hand, unevenly; done before her small line comes in), two lines
  // of lower-case italic tracked tight (« a day / in my life »: its second line the longer), in a warm cream, flat but for
  // a tight edge hardly seen (the original's whites are warm; on her white glass the cream was lost), a thin white cursor
  // after the last letter until her line comes in; her line under it at once, in a fine italic, small beside the title;
  // both gone with the cut (her ending card typed the same way on the black).
  const hook = reelTexts.find((t) => t.role === "hook");
  const small = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== small);
  const luma = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return -1; const v = parseInt(m[1], 16); return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255; };
  const light = brand.palette && brand.palette.light;
  const CREAM = luma(light) >= 0.82 ? light : "#f6e2c1";
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/(\d) (?=\d)/g, "$1 ");
  // Two lines at the word that balances them best, the second never the shorter (a single word: one line).
  const lines = (s) => {
    const w = keep(s).split(" ");
    if (w.length < 2) return keep(s);
    let best = 1;
    let score = Infinity;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(" ").length;
      const b = w.slice(i).join(" ").length;
      const v = Math.max(a, b) + (a > b ? 3 : 0);
      if (v < score) { score = v; best = i; }
    }
    return w.slice(0, best).join(" ") + "\n" + w.slice(best).join(" ");
  };
  const SIZE = 110;
  const EDGE = "0 1px 2px rgba(48, 32, 18, 0.4), 0 0 1px rgba(48, 32, 18, 0.4)";
  const Y = Math.round(by + bh * 0.488);
  const titleBox = { position: "absolute", left: 140, top: Y - SIZE - 14, width: width - 280, height: 2 * SIZE + 28 };
  const lineBox = { position: "absolute", left: 140, top: Y + SIZE + 18, width: width - 280, height: 56 };
  const typed = (text, from, until, key) => {
    const letters = text.replace(/\s/g, "").length;
    const speed = Math.max(15.6, (letters * 30 * 1.25) / Math.max(6, until - 4 - from));
    return h(FitText, { key, style: titleBox, innerStyle: { fontFamily: display, fontStyle: "italic", fontWeight: 600, fontSize: SIZE, lineHeight: 1, letterSpacing: "-0.045em", color: CREAM, textShadow: EDGE, whiteSpace: "pre", textAlign: "center" } },
      h(TypeOn, { text, at: from, speed, jitter: 0.8, caret: frame < until ? "bar" : "none", caretColor: "#ffffff", seed: "routine" }));
  };
  const fine = (text, key) => h(FitText, { key, style: lineBox, innerStyle: { fontFamily: body, fontStyle: "italic", fontWeight: 300, fontSize: 36, lineHeight: 1.2, letterSpacing: "0.01em", color: CREAM, textShadow: EDGE, whiteSpace: "nowrap", textAlign: "center" } },
    h("span", { "data-fauve-accent": "" }, keep(text)));
  const shown = (t, a, b) => t && frame >= a && frame < b;
  const title = shown(hook, hook ? hook.from : 0, Math.min(hook ? hook.to : 0, TRAILER, endAt)) ? typed(lines(hook.text), hook.from, LINE_AT, "title-" + keep(hook.text)) : null;
  const line = small && shown(small, Math.max(small.from, LINE_AT), Math.min(small.to, TRAILER, endAt)) ? fine(small.text, "line-" + keep(small.text)) : null;

  // 3. Its end: three black images, the sound cut with the last; her ending card (an option) typed like her title on the
  // black, quicker (the engine gives a card 2,5 s), her line under it from its 16th image, a second on screen.
  const CARD_LINE = endAt + 16;
  const card = end && frame >= endAt
    ? h(React.Fragment, null,
        typed(lines(end.title), endAt + 1, CARD_LINE, "card-" + keep(end.title)),
        end.subtitle && frame >= CARD_LINE ? fine(end.subtitle, "sub-" + keep(end.subtitle)) : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain line under her title, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 1220 + i * 110, width: width - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, picture, title, line, card, extra);
}`;

export const routine: MontageSkill = {
  key: "routine",
  // 2: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 2,
  bpm: BPM,
  // From her files alone, up to 22 shots (about 30 s); up to 33 for a length she asks for (about 42 s: more gestures,
  // more of her place, then the rest of her day), never past 45 s, its card included.
  shots: [12, 22],
  long: 33,
  // Her ritual from one video or several, what she made from above, her place: five files at least.
  files: [5, 22],
  // Never slower than 89 BPM: its longest stays under 45 s with its card; up to 1,2 times faster for a short Reel.
  tempo: [89, 109],
  how: "La bande-annonce de sa journée en ouverture : 13 éclairs de ses plans à venir, un tous les cinq images, sous son titre tapé lettre à lettre au milieu avec son curseur, en minuscules italiques sur deux lignes, puis une petite ligne fine dessous ; puis son rituel du matin au comptoir, filmé de face téléphone posé, un geste par plan (moins d'une seconde chacun, les coupes au même endroit), chaque préparation finie présentée des deux mains ; ce qu'elle a préparé, servi, vu d'en haut ; son lieu plan par plan (son enseigne, ses coins, ses gens, elle qui entre dans la salle, elle au travail) ; dans sa version longue, la suite de sa journée ; trois images noires à la fin. En vertical plein cadre, ses vidéos horizontales recadrées sur leur sujet ; entières dans une bande 16:9 sur du noir à sa demande.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "le titre tapé lettre à lettre au milieu de la bande-annonce, en minuscules italiques sur deux lignes, comme « a day in my life » : 2 à 4 mots courts qui disent sa journée, en français (une forme comme « une journée avec moi », « un matin au fournil », « ma matinée chez Farine »)",
      max: 24,
      required: true,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : la petite ligne fine sous le titre, ce que mélange sa journée en deux ou trois mots reliés par « + », comme « pilates reformer + matcha » (une forme comme « fournil + café crème », « bouquets + thé glacé ») ; 4 mots au plus",
      max: 26,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein cadre comme l'original, ou ses vidéos entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "vertical", says: "vertical plein cadre, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 sur du noir", band: true },
        { value: "auto", says: "comme ses vidéos (vertical plein cadre ; ses vidéos horizontales entières sur du noir quand la plupart le sont)" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer or shorter Reel, a music's own): every length counted in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const { ritual, place, day } = routineSections(n);
    // With an ending card, its time on the black instead of the three black images (the engine's 2,5 s at least,
    // rounded up to a half beat so a frame lost to rounding never cuts into it).
    const tail = end ? (Math.ceil(((END_CARD + 0.05) / beat) * 2) / 2) * IPB : BLACK;
    const roles: { kind: "trailer" | "ritual" | "served" | "place" | "day"; long?: boolean; images: number; want: string }[] = [
      { kind: "trailer", images: TRAILER, want: "le premier éclair de la bande-annonce, un sixième de seconde sous son titre : ce qu'elle prépare, fini, dans ses mains ou posé devant elle (un autre moment d'une vidéo de son rituel convient)" },
      ...ritual.map((i, j) => {
        const [images, is] = RITUAL[i]!;
        const first = j === 0;
        const last = j === ritual.length - 1;
        const want = first
          ? "son rituel du matin au comptoir, filmé de face téléphone posé à hauteur de poitrine (son haut, ses mains, le plan de travail en bas) : elle pose ce qu'elle va remplir (un bol, une tasse, un verre, un vase)"
          : last
            ? "le résultat fini, présenté des deux mains vers l'objectif ou posé devant elle, tenu immobile"
            : is === "quick"
              ? "un geste éclair de son rituel, du même endroit : un fruit posé, une pincée, un glaçon"
              : is === "long"
                ? "le geste le plus long de son rituel, du même endroit : ce qu'elle verse (le lait, l'eau chaude, le café)"
                : is === "first"
                  ? "la première chose prête, présentée des deux mains (si elle en prépare deux), sinon l'étape suivante"
                  : is === "next"
                    ? "elle commence la suivante : elle pose un verre ou une tasse (sinon l'étape suivante)"
                    : "l'étape suivante de son rituel, du même endroit : un geste (ce qu'elle verse, coupe, ajoute, mélange, fouette)";
        return { kind: "ritual" as const, ...(is === "long" ? { long: true } : {}), images, want };
      }),
      { kind: "served", images: SERVED, want: "ce qu'elle a préparé, posé et servi, vu d'en haut, téléphone au-dessus (sur une table, un comptoir, un tissu)" },
      ...place.map((i) => ({ kind: "place" as const, images: PLACE[i]![0], want: PLACE[i]![1] })),
      ...day.map((i) => ({ kind: "day" as const, images: DAY[i]![0], want: DAY[i]![1] })),
    ];
    const lengths = roles.map((r, i) => (i === roles.length - 1 ? r.images + tail : r.images) / IPB);
    const spans = beatSpans(bpm, lengths);
    const duration = spans.at(-1)!.end;
    const trailer = spans[0]!.end;
    const frames = spans.map((s) => toFrame(s.end) - toFrame(s.start));
    const flashes = routineFlashes(roles, frames);
    const line = round((LINE_AT / TRAILER) * trailer);
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: roles[i]!.want })),
      // Her title from the first image, her line once it is typed, both to the trailer's cut.
      texts: { titre: { from: 0, to: round(trailer) }, ligne: { from: line, to: round(trailer) } },
      marks: {
        trailer_to: toFrame(trailer),
        line_at: toFrame(line),
        ...(end ? {} : { black: toFrame(duration) - BLACK }),
        ...Object.fromEntries(flashes.flatMap((f, k) => [[`f${k}`, f.shot], [`o${k}`, f.offset]])),
      },
      // Its first beat at 0,214 s (the original's grid); played to the last image, cut dead with it.
      music: { downbeat: round3(FIRST * (BPM / bpm)), end: { at: duration, fade: 0.012 } },
    };
  },
  code: CODE,
  // Its original has neither grain nor dark corners (its fiche, effect 9).
  finish: { grain: 0, vignette: 0 },
};
