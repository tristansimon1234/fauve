import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Titre qui se décode », version 3, written again on its original's fiche (docs/fiches/decode.md: measured image by
// image at 30 i/s, its music and its sounds measured, the video watched and heard by Gemini; Tristan: « c'est un effet
// que l'on veut pouvoir faire, pas exactement reproduire l'image »). Its music is an electro-pop travel beat at 122 BPM
// (Gemini heard 115), its first beat 0,36 s in, and every length below is in its beats from the Reel's start, so its
// cuts and its moments fall where the original's do (within two images):
//   0 – 11,75   six of her shots in vertical bands landing one after the other, each with a shutter's « tchh », a low
//               rumble under the last ones; the row folds into a line at the middle in three steps, one a beat, a whoosh
//               each; black; an impact, and on the black three small words over her title, scrambled, which decodes over
//               ticks and lands on beat 10,7; no music yet;
//   11,75 – 27  with the music (out of a small speaker), a band of video opens behind the title where the fold had left
//               it and grows at a constant speed to the full frame; in it, a cut every 4 images, pieces of all her shots;
//   27 – 30     the title goes at once, the music stops: a calm shot held almost in silence;
//   30 – 46     the music full on a shot that follows someone; the place changes behind its subject on the half beat
//               (34,5), the subject stays on the next place, moving, then goes (36); the subject of the shot after lands
//               early at its own place, two beats before the rest of its picture; then the person, cut out, stays while
//               her places change twice behind her; its last image black.
// Played horizontal 16:9 on black as the original when her videos are mostly horizontal (or she asks), else full frame
// (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »). Her photos stay still, her
// videos play (« si photos envoyées, figées ; si vidéos, ça joue »); no zoom anywhere: the bands and the band are masks.
// A longer Reel she asks for gets more of her shots full frame after the calm one, two beats each, like a verse.

const BPM = 122;
/** Its sections, in beats from the Reel's start: the opening (bands, fold, black, the title decoding), the band's montage, the calm shot, then its ending's four shots. */
const OPENING = 11.75;
const MONTAGE = 15.25;
const BREATH = 3;
const FOLLOW = 6;
const PLACE = 4;
const NEXT = 2;
/** The person lands over the next place a beat before her places change behind her; the montage's last two shots are those two more of her places, a beat, then two. */
const AHEAD = 1;
const DECOR = [1, 2] as const;
const PERSON = AHEAD + DECOR[0] + DECOR[1];
/** A longer Reel: each shot more, full frame after the calm one, this long. */
const EXTRA = 2;
/** Its shots: the opening one, the montage's (three to ten, its two places included), the calm one, the four of its ending; past sixteen, more full ones. */
const FEWEST = 9;
const MOST = 16;
const LONGEST = 23;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS); black under it after its ending. */
const END_CARD = 1.6;
/** In the opening (beats): each band lands (its original's images 4, 9, 14, 19, 26, 32), the fold's three steps start a beat apart (69, 84, 98), each six images long. */
const BANDS = [0.27, 0.61, 0.95, 1.29, 1.76, 2.17];
const FOLD_AT = 4.68;
const FOLD_EVERY = 0.98;
const FOLD_STEP = 0.4;
/** The title shows, scrambled (image 119), and lands (image 158): its decoding split as its original's, 12 images still, 19 scrambling, 8 landing. */
const TITLE_AT = 8.07;
const TITLE_LANDS = 10.71;
const DECODE = { hold: 12, scramble: 19, resolve: 8 };
/** Its original's sounds in the opening: a shutter 2 images after each band, a rumble at its loudest, a whoosh 1,5 image before each step, an impact 3 images before the title, a tick every 3 images while it scrambles. */
const SHUTTER = { sound: "camera shutter click", seconds: 0.5 };
const RUMBLE = { at: 2.44, sound: "low cinematic rumble", seconds: 1.5, gain: -3 };
const WHOOSH = { sound: "short air whoosh", seconds: 0.5, gain: -2 };
const IMPACT = { sound: "deep dry impact", seconds: 0.5 };
const TICK = { sound: "digital glitch tick", seconds: 0.5, gain: -9 };
/** In the follow, the place changes behind its subject (beats from its start); in the place, the next shot's subject lands early. */
const SWAP = 4.5;
const EARLY = 2;
/** Its music stops on a last hit as the band is full: that hit heard this long (s), then nothing until the beat after the calm shot. */
const LAST_HIT = 0.1;
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its parts for n shots: its montage's (its two places included), its full ones of a longer Reel. */
export function decodeParts(n: number): { count: number; montage: number; extra: number } {
  const count = Math.max(FEWEST, Math.min(LONGEST, n));
  const extra = Math.max(0, count - MOST);
  return { count, montage: count - 6 - extra, extra };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  // Its moments, in frames (its timeline's marks; its original's at 122 BPM by default).
  const BANDS = [4, 9, 14, 19, 26, 32].map((d, i) => mark("band" + (i + 1), d));
  const FOLD = [69, 84, 98].map((d, i) => mark("fold" + (i + 1), d));
  const STEP = Math.max(1, Math.round(mark("step", 6)));
  const HOLD = Math.max(0, Math.round(mark("hold", 12)));
  const SCRAMBLE = Math.max(1, Math.round(mark("scramble", 19)));
  const RESOLVE = Math.max(1, Math.round(mark("resolve", 8)));
  const OPEN_AT = mark("open", 173);
  const FULL_AT = mark("full", 398);
  const SWAP_AT = mark("swap", 509);
  const LEAVE_AT = mark("leave", 531);
  const EARLY_AT = mark("early", 561);
  const NEXT_AT = mark("next", 590);
  const PERSON_AT = mark("person", 620);
  const DECOR1_AT = mark("decor1", 634);
  const DECOR2_AT = mark("decor2", 649);
  const BLACK_AT = mark("black", durationInFrames - 1);
  const EXTRA = Math.max(0, Math.round(mark("extra", 0)));
  const endAt = end ? end.from : durationInFrames + 1;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  // Its shots by their part: the opening one first, then the montage's (its last two, two more of her places), the
  // calm one, the full ones of a longer Reel, and the four of its ending: the followed one, the place, the next one, the person.
  const P = n - 1;
  const M = n - 2;
  const L = n - 3;
  const K = n - 4;
  const C = Math.max(1, n - 5 - EXTRA);
  const B1 = Math.max(0, C - 2);
  const B2 = Math.max(0, C - 1);

  // Its frame: horizontal 16:9 on black as the original when her videos are mostly horizontal (or she asks), else the
  // whole vertical frame; every place below is a share of it.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const full = (i, at, key) => (i >= 0 && i < n ? h(Footage, { key, shot: i, ...(at === undefined ? {} : { at }), style: { left: 0, top: 0, width: bw, height: bh } }) : null);
  const her = (i, key) => h(Subject, { key, shot: i, style: { left: 0, top: 0, width: bw, height: bh } });

  // Its face for both lines: a regular humanist sans (her display font), white, as the original's, which has no shadow:
  // only a thin dark edge of its own, unseen on the black and on dark pictures (in the band, her pale roses and white
  // walls swallowed the letters where the original's landscapes held them).
  const display = "'" + brand.displayFont + "', 'Open Sans', sans-serif";
  const edge = "0 0 1px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.35)";
  const body = "'" + brand.bodyFont + "', 'Open Sans', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const hook = reelTexts.find((t) => t.role === "hook");
  const kicker = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== kicker);
  // The title as wide as its place allows (its original's spans 85 % of its frame), at most 110 px, so the block of its
  // capitals stays inside the band's first 22,7 %; its small words always 0,375 of it, as the original's.
  const TITLE = 110;
  const SMALL = 41;
  const titleStyle = { fontFamily: display, fontWeight: 400, fontSize: TITLE, lineHeight: 1, letterSpacing: 0, color: "#ffffff", whiteSpace: "nowrap", textAlign: "center", textShadow: edge };
  const smallStyle = { fontFamily: display, fontWeight: 400, lineHeight: 1, letterSpacing: "0.15em", color: "#ffffff", whiteSpace: "nowrap", textShadow: edge };

  // 1. Six of her shots in vertical bands, a sixth of its frame each, side by side, each landing at once from left to
  // right (its original's images 4, 9, 14, 19, 26 and 32) and playing, framed on its subject; then the row folds into a
  // line at the middle in three steps of six images, one a beat, at a constant speed (100, 51,7 and 22,7 % of its
  // height, then nothing): a mask, the pictures cropped, never squeezed nor zoomed. Her opening shot first, then her
  // longest passages (a band plays three seconds), another of her files each while she has some.
  const order = n ? [0] : [];
  const rest = shots.map((_, i) => i).filter((i) => i > 0).sort((a, b) => shots[b].durationInFrames - shots[a].durationInFrames || a - b);
  rest.forEach((i) => { if (order.length < 6 && !order.some((j) => shots[j].src && shots[j].src === shots[i].src)) order.push(i); });
  rest.forEach((i) => { if (order.length < 6 && order.indexOf(i) < 0) order.push(i); });
  const LEVELS = [1, 0.517, 0.227, 0];
  const folded = (f) => {
    let k = 1;
    for (let i = 0; i < 3 && f >= FOLD[i]; i++) k = f >= FOLD[i] + STEP - 1 ? LEVELS[i + 1] : LEVELS[i] + ((LEVELS[i + 1] - LEVELS[i]) * (f - FOLD[i] + 1)) / STEP;
    return k;
  };
  const rowH = Math.round(bh * folded(frame));
  const rowY = Math.round((bh - rowH) / 2);
  const bands = rowH > 0
    ? order.map((shot, i) => {
        if (frame < BANDS[i]) return null;
        const left = Math.round((i * bw) / 6);
        const w = Math.round(((i + 1) * bw) / 6) - left;
        return h("div", { key: "b" + i, style: { position: "absolute", left, top: rowY, width: w, height: rowH, overflow: "hidden" } },
          h(Footage, { shot, at: BANDS[i], style: { left: 0, top: -rowY, width: w, height: bh } }));
      })
    : null;

  // 2. Its title on the black: its small words over it and the title scrambled, all at once (three images after an
  // impact), the scramble held, then anew every 1 or 2 images, then landing through look-alikes (its original's images
  // 119, 131, 150 and 158); both stay still until the band is full, then go at once. The title in capitals on one line;
  // the small words 0,375 of its size, in normal case, a little spaced, the first on the title's left edge, the last on
  // its right; the two lines one block at the middle of the frame, the title just under it and so held left of the
  // apps' buttons (800 px), the block shrunk as a whole for a long one (its small words never under 21 px).
  const shown = (t) => t && frame >= t.from && frame < t.to;
  const words = kicker ? kicker.text.split(/\s+/).filter(Boolean).slice(0, 4) : [];
  const title = hook ? keep(hook.text).toUpperCase() : "";
  const block = shown(hook) || shown(kicker)
    ? h(FitText, { key: "title", style: { position: "absolute", left: 140, top: Math.round(height / 2 - (SMALL + TITLE) / 2), width: width - 280, height: SMALL + TITLE } }, (scale) => {
        const small = Math.max(SMALL, Math.round(21 / Math.max(0.3, scale)));
        return h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "stretch" } },
          h("div", { style: { display: "flex", justifyContent: words.length > 1 ? "space-between" : "center", alignItems: "flex-end", gap: Math.round(small * 0.4), height: small } },
            shown(kicker) ? words.map((w, i) => h("span", { key: i, "data-fauve-accent": "", style: { ...smallStyle, fontSize: small, marginRight: i === words.length - 1 ? "-0.15em" : 0 } }, w)) : null),
          h("div", { style: titleStyle }, shown(hook) ? h(Decode, { text: title, at: hook.from, hold: HOLD, scramble: SCRAMBLE, resolve: RESOLVE, every: 1.4 }) : null));
      })
    : null;

  // 3. With the music, a band of video opens at once behind the title, 22,7 % of its frame high (where the fold had left
  // the row), and grows at a constant speed to the full frame by the calm shot: a mask, never a zoom. In it, a cut every
  // 4 images like a machine (8 with her photos only): pieces of all her shots, the montage's first, as many of each,
  // spread over the band in an order that never loops, each one's pieces taken across its passage, never the same shot
  // twice in a row.
  const photosOnly = n > 0 && shots.every((s) => s.kind === "photo");
  const LEN = photosOnly ? 8 : 4;
  const span = Math.max(1, FULL_AT - OPEN_AT);
  const m = Math.max(1, Math.floor(span / LEN));
  const cutAt = (j) => OPEN_AT + Math.round((j * span) / m);
  const sources = [];
  for (let i = 1; i < Math.min(C, n); i++) sources.push(i);
  for (let i = 0; i < n; i++) if (sources.indexOf(i) < 0) sources.push(i);
  const count = sources.map(() => 0);
  const room = sources.map((i) => (shots[i].kind === "photo" ? m : Math.max(1, Math.floor(shots[i].durationInFrames / (LEN + 1)))));
  let given = 0;
  for (let k = 0; given < m && k < m * sources.length; k++) if (count[k % sources.length] < room[k % sources.length]) { count[k % sources.length]++; given++; }
  for (let k = 0; given < m && sources.length; k++, given++) count[k % sources.length]++;
  const list = [];
  sources.forEach((s, j) => { for (let q = 0; q < count[j]; q++) list.push({ s, j, due: j === 0 && q === 0 ? -1 : (q + 0.5 + 0.8 * (random("decode-" + s + "-" + q) - 0.5)) / count[j] + j * 1e-6 }); });
  list.sort((a, b) => a.due - b.due);
  for (let i = 1; i < list.length; i++) {
    if (list[i].s !== list[i - 1].s) continue;
    const k = list.findIndex((x, y) => y > i && x.s !== list[i].s);
    if (k > 0) { const t = list[i]; list[i] = list[k]; list[k] = t; }
  }
  const taken = sources.map(() => 0);
  const pieces = list.map((p) => {
    const q = taken[p.j]++;
    const free = Math.max(0, shots[p.s].durationInFrames - LEN - 1);
    return { shot: p.s, offset: count[p.j] > 1 ? Math.round((q * free) / (count[p.j] - 1)) : Math.round(free / 2) };
  });
  let j = 0;
  while (j < m - 1 && cutAt(j + 1) <= frame) j++;
  const grown = Math.min(1, Math.max(0, (frame - OPEN_AT) / Math.max(1, span - 2)));
  const bandH = frame >= OPEN_AT && frame < FULL_AT ? Math.round(bh * (0.227 + 0.773 * grown)) : 0;
  const bandY = Math.round((bh - bandH) / 2);
  const piece = bandH > 0 ? pieces[j] : null;
  const band = piece
    ? h("div", { key: "band", style: { position: "absolute", left: 0, top: bandY, width: bw, height: bandH, overflow: "hidden" } },
        h(Footage, { key: "p" + j, shot: piece.shot, at: cutAt(j) - piece.offset, style: { left: 0, top: -bandY, width: bw, height: bh } }))
    : null;

  // 4. Its ending, on the full music, each change on its beat: the calm shot held almost in silence as the title goes,
  // the full ones of a longer Reel, the shot that follows someone; then by layers (her subject cut out at every image:
  // the person, else what stands in front): the place changes behind the followed one's subject on the half beat, the
  // next place frozen behind it (its original's backgrounds are still images), and the subject stays there, moving,
  // then goes at once; the next shot's subject lands at once at its own place, two beats before the rest of its
  // picture; the person lands over the place, and her places change twice behind her (a beat, then two), she stays
  // where she is; the last image black. What is not cut out (no one there, the scene check): plain cuts on the same beats.
  const cut = (i) => i >= 0 && i < n && Boolean(SubjectBox(shots[i], shots[i].from + Math.floor(shots[i].durationInFrames / 2), laid) || SubjectBox(shots[i], shots[i].from, laid));
  let ending = null;
  if (n && frame >= FULL_AT && frame < BLACK_AT) {
    if (frame < SWAP_AT) ending = full(cur, undefined, "s" + cur);
    else if (frame < LEAVE_AT) ending = [full(L, undefined, "s" + L), cut(K) ? her(K, "k") : null];
    else if (frame < NEXT_AT) ending = [full(L, undefined, "s" + L), frame >= EARLY_AT && cut(M) ? her(M, "m") : null];
    else if (frame < PERSON_AT) ending = full(M, undefined, "s" + M);
    else {
      const stays = cut(P);
      const decor = frame < DECOR1_AT ? full(stays ? M : P, undefined, "s" + (stays ? M : P)) : frame < DECOR2_AT ? full(B1, DECOR1_AT, "d1") : full(B2, DECOR2_AT, "d2");
      ending = [decor, stays ? her(P, "p") : null];
    }
  }

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, bands, band, ending);

  // Any other text of the Reel (none in its slots): a plain white line under its frame, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: Math.min(1300, (wide ? by + bh + 40 : 1220) + i * 120), height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  // 5. Its ending card, when the Reel has one (the original has none: an option), on the black after its ending: its
  // title decoding fast in the title's capitals, its line under it in the same face, readable.
  const card = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { key: "ct", style: { position: "absolute", left: 140, top: end.subtitle ? 830 : 895, width: width - 280, height: 130 }, innerStyle: titleStyle },
          h(Decode, { text: keep(end.title).toUpperCase(), at: endAt + 2, hold: 3, scramble: 8, resolve: 6, every: 1.4 })),
        end.subtitle
          ? h(FitText, { key: "cs", style: { position: "absolute", left: 140, top: 970, width: width - 280, height: 130 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 48, lineHeight: 1.2, color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", justifyContent: "flex-start" } },
              h("span", { style: { opacity: interpolate(frame, [endAt + 19, endAt + 25], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, block, extra, card);
}`;

export const decode: MontageSkill = {
  key: "decode",
  // 3: written again on its original's fiche: its format (horizontal 16:9 when her videos are), six bands landing one
  // by one and folding in three steps, its title decoding on the black as its original's (12, 19, 8 images), small
  // words in normal case on its edges, the band that opens with the music and grows for 15 beats with a cut every 4
  // images, the calm shot in silence, its ending by layers (a subject that stays while the place changes), its sounds
  // and its music's shape (late, out of a small speaker, stopped, full), a finish without grain nor dark corners.
  version: 3,
  bpm: BPM,
  shots: [FEWEST, MOST],
  // Up to 23 for a length she asks for: about 30 s at its own tempo, more of her shots full frame after the calm one.
  long: LONGEST,
  files: [3, 12],
  how: "Six de ses plans entrent en bandes verticales l'un après l'autre, puis la rangée se replie en un trait en trois marches ; sur le noir, trois petits mots et le titre brouillé qui se décode ; avec la musique, une bande de vidéo s'ouvre derrière le titre et grandit jusqu'au plein écran, un montage éclair de toutes ses vidéos y défile (une coupe toutes les 4 images) ; le titre part d'un coup sur un plan calme tenu presque en silence ; puis la musique pleine sur un plan qui suit quelqu'un, le lieu qui change derrière lui, la chose du plan suivant qui arrive en avance, et une personne détourée qui reste pendant que ses lieux changent derrière elle. En horizontal comme l'original quand ses vidéos le sont.",
  end: true,
  texts: [
    { slot: "surtitre", role: "caption", want: "1 à 3 petits mots qui amènent le titre, en minuscules, posés sur sa ligne au-dessus de lui : le premier sur son bord gauche, le dernier sur son bord droit (une forme comme « un samedi à », « bienvenue chez », « le matin au »)", max: 24, required: true },
    { slot: "titre", role: "hook", want: "le titre qui se décode : son nom, son lieu, sa rue ou son quartier, court (il s'écrit en capitales sur une ligne)", max: 22, required: true },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, comme l'original" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
  ],
  // Its original's grade (docs/fiches/decode.md, effect 10): soft colours, blacks a little lifted, no vignette nor
  // grain (the catalogue's « Ciné » laid both over everything).
  finish: { contrast: 0.06, saturation: -0.1, warmth: 0, grain: 0, vignette: 0, fade: 0.05 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const { montage, extra } = decodeParts(n);
    const pure = montage - DECOR.length;
    // With an ending card, the black after its ending lasts the card's time, on the beat grid.
    const black = end ? Math.ceil(((END_CARD + 0.05) / beat) * 4) / 4 : 0;
    const spans = beatSpans(bpm, [
      OPENING,
      ...Array.from({ length: pure }, () => (MONTAGE - DECOR[0] - DECOR[1]) / pure),
      ...DECOR,
      BREATH,
      ...Array.from({ length: extra }, () => EXTRA),
      FOLLOW,
      PLACE,
      NEXT,
      PERSON + black,
    ]);
    const duration = spans.at(-1)!.end;
    // A moment in beats from the Reel's start, in frames (on its music's grid).
    const at = (beats: number) => toFrame(beats * beat);
    const open = spans[1]!.start;
    const calm = spans[1 + montage]!.start;
    const follow = OPENING + MONTAGE + BREATH + extra * EXTRA;
    const place = follow + FOLLOW;
    const person = place + PLACE + NEXT;
    // Its title on the black, decoding as its original's: 12 images still, 19 scrambling, 8 landing (at its own tempo).
    const titleFrom = round(onFrame(TITLE_AT * beat));
    const titleFrame = toFrame(titleFrom);
    const total = Math.max(3, at(TITLE_LANDS) - titleFrame);
    const hold = Math.round((total * DECODE.hold) / 39);
    const resolve = Math.max(1, Math.round((total * DECODE.resolve) / 39));
    const scramble = Math.max(1, total - hold - resolve);
    const fold = [0, 1, 2].map((k) => at(FOLD_AT + k * FOLD_EVERY));
    const ticks = Math.max(2, Math.round((total - hold) / 3) + 1);
    const sounds: SkillSound[] = [
      ...BANDS.map((b) => ({ at: (at(b) + 2) / 30, ...SHUTTER })),
      { ...RUMBLE, at: round(RUMBLE.at * beat) },
      ...fold.map((f) => ({ at: (f - 1.5) / 30, ...WHOOSH })),
      { at: (titleFrame - 3) / 30, ...IMPACT },
      ...Array.from({ length: ticks }, (_, i) => ({ at: (titleFrame + hold + Math.round((i * (total - hold)) / (ticks - 1))) / 30, ...TICK })),
    ];
    const wants = [
      "le plan qui ouvre, vu dans la première bande étroite : un sujet debout au centre de l'image (une personne, une porte, une vitrine, une plante, une bouteille) ; ses autres moments passent dans le montage éclair",
      ...Array.from({ length: pure }, () => "un moment vivant de son lieu (des gestes, un visage, un détail, la salle, la rue) : il passe en éclairs de 4 images dans la bande qui grandit derrière le titre, entre tous les autres"),
      "un autre de ses lieux sans personne devant (sa salle, sa devanture, sa rue, sa terrasse), une photo ou un plan fixe pris à hauteur d'yeux : à la fin, il passe derrière la personne détourée",
      "un dernier de ses lieux sans personne devant, une photo ou un plan fixe pris à hauteur d'yeux : il finit le Reel derrière la personne détourée",
      "un plan calme et fixe, tenu 1,5 s presque en silence quand le titre part : un visage, une tasse qui fume, une fleur, son lieu au repos",
      ...Array.from({ length: extra }, () => "un de ses plus beaux plans, en plein écran, sur le temps"),
      "un plan qui suit quelqu'un (de dos qui marche, qui entre) ou une chose nette au premier plan, avec un fond dégagé : le lieu change derrière lui sur le temps, puis il reste détouré un temps sur le plan suivant",
      "un de ses lieux sans personne devant, une photo ou un plan fixe à la même hauteur que le précédent : la personne d'avant y reste un temps, puis la chose du plan suivant y arrive en avance",
      "un plan fixe avec une personne ou une chose nette au premier plan (la coiffeuse, une chaise, la table dressée, un bouquet) : elle arrive détourée sur le plan d'avant, à sa place, avant le reste de l'image",
      "elle, quelqu'un de l'équipe ou une cliente filmée en entier, caméra posée, debout ou qui marche, sur un fond simple (sinon son produit) : détourée, elle reste pendant que ses lieux changent derrière elle",
    ];
    // Its music: none under its opening (its sounds alone), coming in with the band out of a small speaker, stopped on
    // a last hit as the band is full (its original's tail dies away almost in silence over the calm shot), full again on
    // the beat after the calm shot (on the beat itself, so its attack stays whole), to the last image, as its original's.
    const stop = round3((OPENING + MONTAGE) * beat + LAST_HIT);
    return {
      duration,
      music: {
        pauses: [
          { from: 0, to: round3(open) },
          { from: stop, to: round3((OPENING + MONTAGE + BREATH) * beat) },
        ],
        filters: [{ kind: "radio", from: round3(open), to: stop }],
        end: { at: duration, fade: 0.02 },
      },
      sounds,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its words show on the black at once, scrambled, and go at once when the band is full.
      texts: {
        surtitre: { from: titleFrom, to: round(calm) },
        titre: { from: titleFrom, to: round(calm) },
      },
      marks: {
        beat: beat * 30,
        ...Object.fromEntries(BANDS.map((b, i) => [`band${i + 1}`, at(b)])),
        ...Object.fromEntries(fold.map((f, i) => [`fold${i + 1}`, f])),
        step: Math.max(1, Math.round(FOLD_STEP * beat * 30)),
        hold,
        scramble,
        resolve,
        open: toFrame(open),
        full: toFrame(calm),
        swap: at(follow + SWAP),
        leave: at(place),
        early: at(place + EARLY),
        next: at(place + PLACE),
        person: at(person),
        decor1: at(person + AHEAD),
        decor2: at(person + AHEAD + DECOR[0]),
        // Its last image black; with an ending card, the black from the end of its ending, the card on it.
        black: at(person + PERSON) - (end ? 0 : 1),
        extra,
      },
    };
  },
  code: CODE,
};
