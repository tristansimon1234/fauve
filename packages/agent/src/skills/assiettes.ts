import { END_CARD_SECONDS, toFrame, type MontageSkill, type SkillShot } from "../skills.ts";

// « Défilé d'assiettes », version 2 (its slots say what a business films for it, their passage and fallback), written on its original's fiche (docs/fiches/assiettes.md: measured image by image
// at 30 i/s, its title's typing and its ink read on the pixels, its plates' place in each of its 31 shots, its sound by
// bands; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Her menu shown dish
// by dish: each plate seen from above, held out over the same counter, in the middle of the frame and nearly as wide as
// it, full frame, cut on what is heard. Its sound is two pieces (a chopped sung vocal over light drums at its own pace,
// then a drop with a big 808 bass at 91,6 BPM): one grid suffices, the drop's, which lands exactly on its beat 16 from
// the first image; every length below is in its sixteenths (a quarter of a beat, 0,164 s), so its 30 cuts fall within an
// image of the original's:
//   0 – 39      the intro: a dish every two to four sixteenths (on the vocal's syllables, some on half sixteenths); its
//               title typed letter by letter in the middle in condensed bold capitals, a fine serif line typed under it
//               at once behind a caret, both whole at 1,4 s, both gone at once on the ninth dish's cut (3,6 s); the music
//               without its bass;
//   39 – 56,5   after a dish flashed three images, the vedette held 17,5 sixteenths (2,9 s): its drums cut 3,25
//               sixteenths in (a pad alone, muffled), its vocal back near its end;
//   56,5 – 64   two dishes, the second through a near silence, cut on the drop;
//   64 – 103,25 the drop: six dishes a bar on the groove's hits (sixteenths 0, 3, 7, 9, 11, 14; then 0, 5, 7, 9, 11,
//               14), then two, the last to the end; the music cut dead there, and the Reel loops onto its title.
// Fewer of her files: whole phrases out first (the drop's second bar, the intro's second half, the flash), then some of a
// phrase's cuts (its dishes longer), always on the original's cuts. More, for a length she asks for: bars of six dishes
// added to the drop (30 s at its tempo). Her photos stay still, her videos play. Its words are hers (the original's « IDÉES
// DE RECETTES » and its line are its author's: never copied).

const BPM = 91.6;
type PhraseKey = "intro" | "suite" | "vedette" | "avant" | "drop" | "encore" | "fin";
type Phrase = { key: PhraseKey; cuts: number[]; length: number };
/** Its phrases, in sixteenths of its grid: where each of its shots starts within it, and how long it lasts. */
const PHRASES: Record<PhraseKey, Phrase> = {
  intro: { key: "intro", cuts: [0, 3, 6.5, 9.5, 13, 15, 17.5, 20, 22], length: 26.5 },
  suite: { key: "suite", cuts: [0, 2, 5, 8], length: 12.5 },
  vedette: { key: "vedette", cuts: [0], length: 17.5 },
  avant: { key: "avant", cuts: [0, 3], length: 7.5 },
  drop: { key: "drop", cuts: [0, 3, 7, 9, 11, 14], length: 16 },
  encore: { key: "encore", cuts: [0, 5, 7, 9, 11, 14], length: 16 },
  fin: { key: "fin", cuts: [0, 4], length: 7.25 },
};
/** The flash before the vedette: three images, whatever the tempo (the original's 6,27 – 6,37 s). */
const FLASH = 3;
/** Its own count, its fewest, and its most for a length she asks for (five bars of six more: 30 s at its tempo). */
const ORIGINAL = 31;
const FEWEST = 12;
const LONGEST = 61;
/**
 * From 31 shots down to 12, how many each phrase plays (intro, suite, flash, vedette, avant, drop, its second bar, fin):
 * its second bar of the drop in part, then gone; its intro's second half in part, then gone; its flash; then fewer cuts
 * in its first phrases. No dish ever held longer than a second but its vedette and its ending's.
 */
const FEWER: Record<number, [number, number, number, number, number, number, number, number]> = {
  31: [9, 4, 1, 1, 2, 6, 6, 2],
  30: [9, 4, 1, 1, 2, 6, 5, 2],
  29: [9, 4, 1, 1, 2, 6, 4, 2],
  28: [9, 3, 1, 1, 2, 6, 4, 2],
  27: [9, 3, 1, 1, 2, 6, 3, 2],
  26: [9, 2, 1, 1, 2, 6, 3, 2],
  25: [9, 4, 1, 1, 2, 6, 0, 2],
  24: [9, 3, 1, 1, 2, 6, 0, 2],
  23: [9, 2, 1, 1, 2, 6, 0, 2],
  22: [8, 2, 1, 1, 2, 6, 0, 2],
  21: [9, 0, 1, 1, 2, 6, 0, 2],
  20: [9, 0, 0, 1, 2, 6, 0, 2],
  19: [9, 0, 0, 1, 1, 6, 0, 2],
  18: [8, 0, 0, 1, 1, 6, 0, 2],
  17: [7, 0, 0, 1, 1, 6, 0, 2],
  16: [6, 0, 0, 1, 1, 6, 0, 2],
  15: [6, 0, 0, 1, 1, 5, 0, 2],
  14: [5, 0, 0, 1, 1, 5, 0, 2],
  13: [5, 0, 0, 1, 1, 4, 0, 2],
  12: [5, 0, 0, 1, 1, 4, 0, 1],
};
/** Its title: typed from images 4 to 42, its line from 2 to 39 (at its own tempo), gone on the ninth dish's cut (sixteenth 22). */
const TYPE = [4, 42];
const LINE = [2, 39];
const OUT = 22;
/** Its music: without its bass to 3,25 sixteenths into the vedette, muffled to its vocal's return, a near silence before the drop. */
const DRUMS_OUT = 3.25;
const VOCAL_BACK = 16;
const SILENCE = 3.25;
/** The engine's ending card: the Reel's last 2,5 s, over its last dish held whole beats longer. */
const END_CARD = END_CARD_SECONDS;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");

/**
 * How many shots each of its phrases plays for n shots, whether its flash is kept, and the drop's bars after its first
 * (each its shots and its length: its own second bar whole, in part on its own cuts; past 31, bars of six more added
 * before its last two, the last one cut short after its last dish so the Reel grows with each one).
 */
export function phraseCounts(n: number): { counts: Record<Exclude<PhraseKey, "encore">, number>; encore: { m: number; length: number }[]; flash: boolean } {
  const count = Math.max(FEWEST, Math.min(LONGEST, Math.round(n)));
  const [intro, suite, flash, vedette, avant, drop, second, fin] = FEWER[Math.min(ORIGINAL, count)]!;
  const encore = second ? [{ m: second, length: PHRASES.encore.length }] : [];
  for (let more = count - ORIGINAL; more > 0; more -= 6) {
    const m = Math.min(6, more);
    encore.push({ m, length: m < 6 ? PHRASES.encore.cuts[m]! : PHRASES.encore.length });
  }
  return { counts: { intro, suite, vedette, avant, drop, fin }, encore, flash: flash > 0 };
}

/** The cuts of a phrase it keeps for m shots: its first, and those that make its shots the most even (on the original's cuts). */
export function keptCuts(phrase: Pick<Phrase, "cuts" | "length">, m: number): number[] {
  const inner = phrase.cuts.slice(1);
  const want = Math.max(0, Math.min(inner.length, m - 1));
  let best: number[] = [];
  let score = Infinity;
  const choose = (from: number, picked: number[]) => {
    if (picked.length === want) {
      const edges = [0, ...picked, phrase.length];
      const lengths = edges.slice(1).map((e, i) => e - edges[i]!);
      const s = Math.max(...lengths) * 1000 + lengths.reduce((a, l) => a + l * l, 0);
      if (s < score - 1e-9) {
        score = s;
        best = picked;
      }
      return;
    }
    for (let i = from; i <= inner.length - (want - picked.length); i++) choose(i + 1, [...picked, inner[i]!]);
  };
  choose(0, []);
  return [0, ...best];
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;

  // 1. Her dish, the one on now, as filmed (a photo still, a video playing), seen from above: the whole frame, or her
  // videos whole in a 16:9 band on black in the middle when most of them are in width (or she asks).
  const format = setting("format", "vertical");
  const inWidth = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const band = format === "horizontal" || (format === "auto" && n > 0 && inWidth * 2 > n);
  const BH = Math.round((width * 9) / 16);
  const BOX = band ? { position: "absolute", left: 0, top: Math.round((height - BH) / 2), width, height: BH } : { position: "absolute", left: 0, top: 0, width, height };
  const dish = n ? h(Footage, { key: "dish" + cur, shot: cur, style: BOX }) : null;

  // 2. Her words, typed as the original's: her title in condensed bold capitals of her title font, its capitals 2,5 % of
  // the frame's height, centred on its middle; her line in her text font under it (its middle at 53,8 %), typed at once
  // behind a caret; both start together and are whole together, letter by letter at an even pace, each already in its
  // place (its letters shown from left to right), in the original's warm white, no box, a soft shade so it still reads
  // on her white plates; the caret gone seven images after its last letter; both gone at once on the cut its timeline
  // gives. Anton's capitals are 0,85 of its size: 56 px make the original's 2,5 %, and « IDÉES DE RECETTES » its 36 %.
  const hook = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== line);
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").normalize("NFC").replace(/(\d) (?=\d)/g, "$1 ");
  // In capitals, an hour keeps its small h (« 7 h », never « 7 H »).
  const caps = (s) => keep(s).toUpperCase().replace(/(\d)(\s?)H\b/g, "$1$2h");
  const words = (s) => String(s || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const display = "'" + brand.displayFont + "', 'Anton', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Cormorant Garamond', Georgia, serif";
  const INK = "#fcfaf5";
  const SHADE = "0 1px 3px rgba(0,0,0,0.4), 0 0 24px rgba(0,0,0,0.38)";
  const TPX = Math.round(height * 0.0292);
  const LPX = 42;
  const MID = Math.round(height * 0.5);
  const UNDER = Math.round(height * 0.538);
  // Letters a second so a line is whole on its last image (TypeOn's even pace: a letter every step, a space free, a
  // punctuation mark one and a half more).
  const speedFor = (s, from, to) => {
    const u = Array.from(s);
    let steps = 0;
    for (let i = 0; i < u.length - 1; i++) {
      if (!/\s/.test(u[i])) steps += 1;
      if (/[.,!?;:…—]$/.test(u[i])) steps += 1.5;
    }
    return Math.max(0.5, (steps * 30) / Math.max(1, to - from));
  };
  const titleBox = { position: "absolute", left: 140, width: width - 280, top: MID - Math.round(TPX * 0.78), height: Math.round(TPX * 1.56) };
  const lineBox = { position: "absolute", left: 140, width: width - 280, top: UNDER - Math.round(LPX * 0.8), height: Math.round(LPX * 1.6) };
  const typed = (text, at, to, box, font, size, upper, caret, k) => {
    const s = upper ? caps(text) : keep(text);
    const small = !upper && words(s) <= 4;
    const typing = h(TypeOn, { text: s, at, speed: speedFor(s, at, to), jitter: 0, caret: caret && frame < to + 7 ? "bar" : "none", caretColor: INK, seed: k });
    return h(FitText, { key: k + "-" + s, style: box, innerStyle: { fontFamily: font, fontWeight: upper ? 400 : 500, fontSize: upper ? size : small ? size : Math.max(48, size), lineHeight: 1, letterSpacing: upper ? "0.01em" : "0", textTransform: "none", whiteSpace: "nowrap", color: INK, textShadow: SHADE, textAlign: "center" } },
      small ? h("span", { "data-fauve-accent": "" }, typing) : typing);
  };
  const TYPE_AT = Math.round(mark("type_at", 4));
  const TYPE_END = Math.max(TYPE_AT + 1, Math.round(mark("type_end", 42)));
  const LINE_AT = Math.round(mark("line_at", 2));
  const LINE_END = Math.max(LINE_AT + 1, Math.round(mark("line_end", 39)));
  const OUT = Math.round(mark("title_out", 108));
  const titled = frame < Math.min(OUT, endAt);
  const title = hook && titled && frame >= TYPE_AT ? typed(hook.text, TYPE_AT, TYPE_END, titleBox, display, TPX, true, false, "title") : null;
  const under = line && titled && frame >= LINE_AT ? typed(line.text, LINE_AT, LINE_END, lineBox, body, LPX, false, true, "line") : null;

  // 3. Its ending card, only when the Reel has one: over her last dish, its title typed as hers (the same place, the same
  // capitals), its subtitle typed under it behind its caret.
  const card = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        typed(end.title, endAt + 2, endAt + 2 + (TYPE_END - TYPE_AT), titleBox, display, TPX, true, false, "end-title"),
        end.subtitle ? typed(end.subtitle, endAt, endAt + (LINE_END - LINE_AT), lineBox, body, LPX, false, true, "end-sub") : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain line high in the frame, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 240 + i * 120, width: width - 280, height: 100 }, innerStyle: { fontFamily: display, fontSize: 56, lineHeight: 1.1, color: INK, textShadow: SHADE, textAlign: "center" } }, caps(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, dish, title, under, card, extra);
}`;

export const assiettes: MontageSkill = {
  key: "assiettes",
  // Also 2: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 2,
  bpm: BPM,
  shots: [FEWEST, ORIGINAL],
  long: LONGEST,
  files: [6, 20],
  // A parade on the beat: slower makes it longer and calmer (45 s at most with its 61 dishes and a card at 80).
  tempo: [80, 110],
  how: "Ses plats vus d'en haut, l'un après l'autre en plein écran, chacun tenu à la main au-dessus du même comptoir, l'assiette au milieu de l'image : un plat toutes les deux à quatre doubles-croches, coupés net sur ce qu'on entend ; sur les premiers, son titre se tape lettre à lettre au milieu en capitales condensées blanches, une ligne fine en serif tapée dessous en même temps derrière un curseur, puis les deux partent d'un coup ; un plat en éclair (trois images), puis le plat vedette tenu près de trois secondes pendant que la musique se pose ; deux plats, un presque-silence, le drop, et le reste du menu à toute vitesse jusqu'au dernier plat, qui boucle sur le premier.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "le titre tapé lettre à lettre en capitales au milieu des premiers plats : ce que le défilé montre, 2 à 4 mots (une forme comme « notre carte d'hiver », « 5 idées de brunch », « les plats du jour », « nos best-sellers ») ; jamais une phrase",
      max: 22,
      required: true,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : une ligne fine en minuscules tapée sous le titre, ce que ces plats ont en commun (une forme comme « faits maison, de saison », « simples et gourmands », « cuisinés chaque matin ») ; 4 mots au plus, rien d'inventé",
      max: 40,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : ses plats en plein écran vertical, ou ses vidéos entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "vertical", says: "en plein écran vertical, comme l'original, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 au milieu de l'écran, sur du noir, le titre sur la bande", band: true },
        { value: "auto", says: "comme ses vidéos : en plein écran quand la plupart sont en hauteur (une vidéo horizontale recadrée sur son sujet), sinon entières dans une bande 16:9 sur du noir" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, a music's own): every length counted in sixteenths follows it; its flash stays three images.
    const bpm = tempo ?? BPM;
    const s16 = 60 / bpm / 4;
    const onFrame = (s: number) => Math.round(s * 30) / 30;
    const { counts, encore, flash } = phraseCounts(n);
    const plan: { phrase: Phrase; m: number }[] = [
      { phrase: PHRASES.intro, m: counts.intro },
      { phrase: PHRASES.suite, m: counts.suite },
      { phrase: PHRASES.vedette, m: counts.vedette },
      { phrase: PHRASES.avant, m: counts.avant },
      { phrase: PHRASES.drop, m: counts.drop },
      ...encore.map((e) => ({ phrase: { ...PHRASES.encore, cuts: PHRASES.encore.cuts.filter((c) => c < e.length), length: e.length }, m: e.m })),
      { phrase: PHRASES.fin, m: counts.fin },
    ].filter((p) => p.m > 0);
    // Its edges in sixteenths, each shot's phrase, and where its vedette and its drop start.
    const edges: number[] = [];
    const kinds: PhraseKey[] = [];
    const firsts: boolean[] = [];
    let at = 0;
    const starts: Partial<Record<PhraseKey, number>> = {};
    for (const { phrase, m } of plan) {
      if (starts[phrase.key] === undefined) starts[phrase.key] = at;
      keptCuts(phrase, m).forEach((c, i) => {
        edges.push(at + c);
        kinds.push(phrase.key);
        firsts.push(i === 0);
      });
      at += phrase.length;
    }
    // With an ending card, its last dish held whole beats longer (the engine's 2,5 s at least, a frame lost to rounding never cutting into it).
    const card = end ? 4 * Math.ceil((END_CARD + 0.05) / (4 * s16) - 1e-6) : 0;
    const total = at + card;
    const vedette = starts.vedette!;
    const drop = starts.drop!;
    const secs = (x: number) => round(onFrame(x * s16));
    const times = edges.map(secs);
    const kindsAll: (PhraseKey | "flash")[] = [...kinds];
    // The flash: three images of a dish right before the vedette.
    if (flash) {
      const v = kinds.indexOf("vedette");
      const t = round(onFrame(vedette * s16 - FLASH / 30));
      times.splice(v, 0, t);
      kindsAll.splice(v, 0, "flash");
      firsts.splice(v, 0, false);
    }
    const duration = secs(total);
    const spans = times.map((t, i) => ({ start: t, end: i + 1 < times.length ? times[i + 1]! : duration }));
    const hold = (i: number) => comma(spans[i]!.end - spans[i]!.start);
    // What a business films for it (version 2, Tristan's review of 6 November: « trouver d'autres photos / vidéos »): what
    // she serves (a dish, a cup, a cake), seen from above and whole in the middle of an upright frame; which passage of a
    // video (the plate still and whole, never while it comes in or leaves); and each slot's fallback, as every model has.
    const served = "ce qu'elle sert (un plat, un bol, une tasse ou un verre, une pâtisserie, une part de gâteau)";
    const above = "vu d'en haut, l'assiette entière au milieu de l'image et presque aussi large qu'elle (en vertical, ses bords dans la largeur)";
    const passage = "d'une vidéo, le moment où l'assiette est immobile et entière dans l'image, jamais quand elle entre, sort ou qu'une main la cache";
    const fallback = "sinon ce même genre de plat vu de trois quarts, ou une photo de plat bien nette";
    const want = (k: PhraseKey | "flash", i: number, first: boolean): string => {
      if (i === 0) return `le premier plat, le plus coloré : ${served}, ${above}, tenu à la main ou posé ; ${passage} ; son titre se tape dessus au milieu ; ${fallback}`;
      if (k === "flash") return `un plat de plus, ${above}, montré trois images seulement (un éclair), juste avant le plat vedette ; ${fallback}`;
      if (k === "vedette") return `le plat vedette, tenu ${hold(i)} s pendant que la musique se pose : le plus beau et le plus généreux (un sandwich, un plat à partager, un gâteau entier, son best-seller), vu d'en haut et de plus près, la caméra posée ou qui bouge à peine ; ${passage} ; sinon son plus beau plat de près, de trois quarts`;
      if (k === "avant" && !first) return `un plat juste avant le drop, pendant le presque-silence (on coupe sur le drop), ${above} ; ${fallback}`;
      if (k === "fin" && i === spans.length - 1) return `le dernier plat, ${hold(i)} s : un plat qui donne envie d'y revenir, ${above} (le Reel boucle sur le premier) ; ${passage} ; ${fallback}`;
      if (k === "drop" && first) return `le plat du drop, le plus fort de la musique : un plat très coloré, ${above} ; ${fallback}`;
      return k === "intro"
        ? `${served}, ${above}, tenu à la main au-dessus du même comptoir ou de la même table ; un plat différent du précédent (son titre est encore là, au milieu) ; ${passage} ; ${fallback}`
        : `${served}, ${above}, tenu à la main (ou posé) au même endroit que les autres ; un plat différent du précédent ; ${passage} ; ${fallback}`;
    };
    const shots: SkillShot[] = spans.map((s, i) => ({ ...s, want: want(kindsAll[i]!, i, firsts[i]!) }));
    const scale = BPM / bpm;
    const frames = (f: number) => Math.round(f * scale);
    const at16 = (x: number) => round3(onFrame(x * s16));
    const out = Math.min(OUT, vedette);
    return {
      duration,
      shots,
      // Her title from its first letter, her line from its first, both gone together on the ninth dish's cut.
      texts: { titre: { from: round(frames(TYPE[0]!) / 30), to: secs(out) }, ligne: { from: round(frames(LINE[0]!) / 30), to: secs(out) } },
      marks: { type_at: frames(TYPE[0]!), type_end: frames(TYPE[1]!), line_at: frames(LINE[0]!), line_end: frames(LINE[1]!), title_out: toFrame(secs(out)) },
      // Its music on its first image: without its bass to just after the vedette's start, muffled while it is held (its
      // drums out), without its bass again as its vocal comes back, a near silence dying away, the drop on its cut; cut
      // dead at the end (the loop). No sound effects: the original lays none (no typing sound under its title).
      music: {
        downbeat: 0,
        filters: [
          { kind: "thin", from: 0, to: at16(vedette + DRUMS_OUT) },
          { kind: "muffled", from: at16(vedette + DRUMS_OUT), to: at16(vedette + VOCAL_BACK) },
          { kind: "thin", from: at16(vedette + VOCAL_BACK), to: at16(drop - SILENCE) },
        ],
        pauses: [{ from: at16(drop - SILENCE), to: at16(drop), tail: 0.12 }],
        end: { at: duration },
      },
    };
  },
  code: CODE,
};
