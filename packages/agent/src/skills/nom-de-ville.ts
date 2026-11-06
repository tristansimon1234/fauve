import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Nom aux cinq polices », written on its original's fiche (docs/fiches/nom-de-ville.md: Tristan's travel
// film of a city, measured image by image at 30 i/s, its title's red read pixel by pixel image by image, its sound by
// bands; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A 16:9 film of a
// city in 15 shots and clean cuts. Its music is two pieces and a break; one grid is kept, its first piece's, 142,4 BPM
// (a beat every 0,4214 s, the first at 0,17 s; counted one beat in two for the engine, 71,2): every landmark below is
// in beats of that grid from its first beat:
//   −0,4 – 5   a still wide shot of the city's roofs in a low sun, its name giant in the sky, its foot behind the roofs,
//              rising slowly (0,4 of its capitals over 1,85 s, easing out); its typeface changes at once, in one image,
//              on beats 1, 2, 3 and 4: very fat and round, square and heavy, narrow, square and wider, then a clean
//              condensed one that stays; the same colour, the same centre and foot; two or three small words above it,
//              a credit at the bottom (its author's: never copied);
//   5 – 9      four shots of one beat, details where something moves; the music without its big bass;
//   9 – 14,6   on its big bass hit, a long shot that moves along a narrow alley, looking up; a beat later its drums and
//              bass stop, a break (a held note, a sung phrase, a chord rising);
//   14,6 – 34,6  something passing right by the lens, the music back on a hit in it, then the life of the place, a shot
//              every 2 to 3 beats (its second piece is at 150,5 BPM: on our one grid its cuts fall 1 to 3 images from the
//              original's), and the sunset behind a silhouette, cut dead with the music.
// Here her name is laid in the sky of her first shot, its foot a fifth of its capitals under her roofs (SkylineAt),
// behind them (Skyline: her roofs, trees, poles and passers-by in front of its letters, none of them named), in five
// typefaces on the same beats: the model's three (Lilita One round, Bungee square, League Gothic narrow; Bungee again a
// little bigger), then her title font, which stays; all at one size (one FitText for the five: the widest sets it), in
// her colour (the model's red when she chose it) deepened or lightened until it stands out 2:1 from her sky, the
// original's contrast. Her small words above it, her signature (in option) at the bottom, both in her text font. The
// music shaped as the original's: without its bass until the drop, a hit there, stopped a beat later with its sound
// ringing on over the alley, back on beat 16 with a rising whoosh, cut dead with the picture (its break's voice and its
// second piece cannot be composed: the tail and the whoosh stand for them). Played as the original, 16:9 on black, when
// her files are mostly horizontal (or she asks), else full frame (Tristan: « format par défaut [comme ses vidéos], et
// changement à la demande du user »). Her shots as filmed (a photo stays still, a video plays). Nothing of the
// original's own: its words (« THE STREETS OF », « MARRAKECH ») are hers, its author's credit her signature or nothing.

const BPM = 71.2;
/** Its first beat (0,17 s), in beats of the original's first piece (half the engine's), from the Reel's start. */
const FIRST = 0.4035;
/** Its sections in those beats: the title to beat 5, four shots of a beat, the alley to 14,5, the shot passing the lens. */
const TITLE = 5;
const QUICK = [1, 1, 1, 1];
const PLUNGE = 5.5;
const PASSER = 2.5;
/** The life of the place (the original's seven shots after the one passing the lens), repeated for a longer Reel; its last shot. */
const LIFE = [2.5, 2, 1.5, 2, 2, 3, 2.5];
const LAST = 2;
/** Its music: its big bass on beat 9, stopped dead on beat 10¼ (its sound ringing on), back on beat 16, the next bar. */
const DROP = 9;
const STOP = 10.25;
const BACK = 16;
const TAIL = 2.4;
/** Its shots: the eight it always has (title, four, alley, passing, last), the most for a length she asks for. */
const FIXED = 8;
const LONG = 30;
/** The engine's ending card: the Reel's last 1,6 s, its last shot held whole half-beats longer for it. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const CUT = shots[0] ? shots[0].from + shots[0].durationInFrames : 0;
  // Its marks (frames): its typeface changes on beats 1, 2 and 3, the last one lands on beat 4; a beat of the original.
  const F1 = mark("f1", 18);
  const F2 = mark("f2", 30);
  const F3 = mark("f3", 43);
  const LAND = Math.max(1, mark("land", 56));
  const STEP = Math.max(6, mark("step", 12.6));

  // 1. Its frame: a 16:9 picture on black, as the original, when most of her files are horizontal (or she asks), else
  // the whole vertical frame; every place below is in its box.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const band = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = band ? Math.round((width * 9) / 16) : height;
  const by = band ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const box = { position: "absolute", left: 0, top: 0, width: bw, height: bh };

  // 2. Her words: her name (the hook), her small words over it, her signature (the captions, in order).
  const hook = reelTexts.find((t) => t.role === "hook");
  const captions = reelTexts.filter((t) => t.role === "caption");
  const small = captions[0];
  const signed = captions[1];
  const others = reelTexts.filter((t) => t !== hook && captions.indexOf(t) < 0);
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const name = hook ? keep(hook.text).toUpperCase() : "";
  const count = Math.max(1, letters(name).filter((c) => /\S/.test(c)).length);
  const display = "'" + brand.displayFont + "', 'Anton', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  // Its five faces, as the original's: very fat and round, square and heavy, narrow, square and a little bigger, then
  // hers, which stays (its heaviest weight, never a faux bold).
  const FACES = [
    { family: "'Lilita One', " + display, weight: 400, size: 1 },
    { family: "'Bungee', " + display, weight: 400, size: 1 },
    { family: "'League Gothic', " + display, weight: 400, size: 1 },
    { family: "'Bungee', " + display, weight: 400, size: 1.06 },
    { family: display, weight: 900, size: 1 },
  ];
  const faceAt = (f) => (f < F1 ? 0 : f < F2 ? 1 : f < F3 ? 2 : f < LAND ? 3 : 4);

  // 3. Its size: its capitals 14 % of the width at most (a short name), its widest face within 74 % of the width (80 %
  // in the vertical frame, its sky high): one FitText for the five, so the widest sets the size of all, as the original
  // keeps one height of capitals while its width jumps. An estimate of its capitals once fitted, for its place.
  const CAPS = Math.round(bw * 0.14);
  const F = Math.round(CAPS / 0.72);
  const TW = band ? bw - 280 : Math.round(bw * 0.8);
  // Its widest face, Bungee a little bigger, is 0,775 of its size wide a letter: the box's scale and its capitals.
  const scale = Math.min(1, TW / (0.775 * F * count));
  const caps = Math.round(0.72 * F * scale);

  // 4. Its place: its foot (the letters' baseline) a fifth of its capitals under her roofs, the median of what stands
  // under her sky across its width at the image it lands (eight columns), never more than 45 % of a letter hidden by
  // the highest of them (a mountain range behind her town, a tower: they bite its letters, never swallow one), behind
  // them; its small words above it under the top margin. A scenery too high for it (no room above it for its small
  // words) leaves it in front: at the bottom of her sky or calm area (ClearBox), else at the original's place; one only
  // lower than it may go (a beach, low hills) has it as low in her sky as it may.
  const top0 = band ? Math.round(bh * 0.05) : 100;
  // From its foot to the top of its small words (its capitals, the gap and their line), in its capitals.
  const reach = small ? 2.15 : 1.1;
  const footMin = Math.round(top0 + reach * caps);
  const footMax = Math.round(band ? bh * 0.66 : height * 0.45);
  const COLS = 8;
  const x0 = (bw - TW) / 2;
  const tops = [];
  if (shots[0]) for (let k = 0; k < COLS; k++) {
    const y = SkylineAt(shots[0], LAND, laid, { from: x0 + (k * TW) / COLS, to: x0 + ((k + 1) * TW) / COLS });
    if (typeof y === "number" && Number.isFinite(y)) tops.push(y);
  }
  tops.sort((a, b) => a - b);
  const median = tops.length >= COLS / 2 ? tops[Math.floor((tops.length - 1) / 2)] : null;
  const under = median === null ? null : Math.round(Math.min(median + 0.2 * caps, tops[0] + 0.45 * caps));
  const behind = under !== null && under >= footMin;
  const SKY = { prefer: "top", min: { w: Math.round(bw * 0.5), h: Math.round(bh * 0.08) }, within: { x: 0, y: 0, w: bw, h: footMax }, origin: { x: 0, y: by }, pad: 4, fallback: null };
  const sky = !behind && shots[0] ? ClearBox(shots[0], LAND, laid, SKY) : null;
  const foot = Math.round(within(behind ? under : sky ? sky.y + sky.h : bh * (band ? 0.475 : 0.42), footMin, footMax));
  // It comes out from behind a line at every image, as the original's red never goes under its roofline (193 px on all
  // its images): under her roofs, the line where they stand (their median, its foot a fifth of its capitals lower,
  // hidden), whether or not her shot without its sky was made in time (Skyline then draws her roofs over it too); in
  // front, the foot of its place (the bottom of her sky or calm area, else the original's place). It rises 0,4 of its
  // capitals from under that line, easing out until it lands: 60 % of it hidden at its first image over a flat roofline,
  // 40 % in front, as the original's (Tristan on v1: « l'aspect du texte qui apparaît derrière n'est pas là »: behind a
  // jagged roofline v1 rose by less, and in front, with nothing over its foot, it only slid up whole).
  const LINE = Math.round(behind ? Math.min(median, foot) : foot);
  const RISE = 0.4;

  // 5. Its colour: hers, flat and full (the model's red when she chose it), as it is when it stands out 2:1 from her sky
  // under it (the original's red on its pale sky), else a shade of it a step at a time on its own side of her sky,
  // the other side if that one never gets there. Its small words white with a tight dark edge, or in its colour on a
  // sky too bright for white.
  const rgb = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return null; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const lin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const hex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const light = shots[0] ? LightUnder(shots[0], LAND, laid, { x: x0, y: Math.round(foot - caps), w: TW, h: caps }) : null;
  const skyLum = light && Number.isFinite(light.mean) ? lin(within(light.mean, 0, 1) * 255) : 0.57;
  const shade = (c, dark) => { let x = c; for (let i = 0; i < 12 && ratio(lum(x), skyLum) < 2; i++) x = dark ? x.map((v) => v * 0.82) : x.map((v) => v + (255 - v) * 0.3); return x; };
  const own = rgb(brand.accent) || [253, 76, 76];
  const near = shade(own, lum(own) <= skyLum);
  const INK = hex(ratio(lum(near), skyLum) >= 2 ? near : shade(own, lum(own) > skyLum));
  const whiteOn = ratio(1, skyLum) >= 1.5;
  const PEN = whiteOn ? "#ffffff" : INK;
  const EDGE = whiteOn ? "0 0 1px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.35)" : "none";

  // 6. Its title on her first shot: its five faces stacked in one box, one shown at a time (the others laid out, hidden,
  // so the box measures them all once), their baselines on one line; rising from under its place (its capitals are 0,72
  // of its size), easing out until it lands; its small words above it, drifting up a little; it goes with the cut.
  const titleOn = Boolean(hook) && cur === 0 && frame < Math.min(hook.to, endAt, CUT);
  const p = within(frame / LAND, 0, 1);
  const rise = RISE * 0.72 * Math.pow(1 - p, 3);
  const drift = within(frame / Math.max(1, CUT), 0, 1);
  const cycle = (text, shown, size, key, color, wrap) => h("div", { key, style: { display: "grid", alignItems: "baseline", justifyItems: "center", fontSize: size } },
    FACES.map((f, i) => h("div", { key: "f" + i, style: { gridArea: "1 / 1", fontFamily: f.family, fontWeight: f.weight, fontSynthesis: "none", fontSize: Math.round(size * f.size), lineHeight: wrap ? 0.95 : 0.8, letterSpacing: "0.01em", color, whiteSpace: wrap ? "normal" : "nowrap", textWrap: wrap ? "balance" : undefined, textAlign: "center", visibility: i === shown ? "visible" : "hidden" } }, text)));
  const words = (s) => String(s || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  // A short label beside the name that reads (four words at most: 20 px at least once fitted); longer, 48 px at least.
  const label = small ? words(small.text) <= 4 : false;
  const kicker = small
    ? h("div", { "data-fauve-accent": label ? "" : undefined, style: { fontFamily: body, fontWeight: 700, fontSize: Math.round(label ? Math.max(F * 0.3, 24 / scale) : Math.max(F * 0.42, 52 / scale)), lineHeight: 1, letterSpacing: "0.14em", textTransform: "uppercase", color: PEN, textShadow: EDGE, whiteSpace: "nowrap", marginBottom: Math.round(F * 0.45), transform: "translateY(" + (-0.25 * drift).toFixed(3) + "em)" } }, keep(small.text))
    : null;
  const lettering = h("div", { style: { transform: "translateY(" + rise.toFixed(3) + "em)", fontSize: F } }, cycle(name, faceAt(frame), F, "name", INK, false));
  const BOXH = Math.round(F * (small ? 1.7 : 1.05));
  // Its letters under the line cut away (its small words above it untouched).
  const title = titleOn
    ? h("div", { key: "name-line", style: { ...box, clipPath: "inset(0 0 " + Math.max(0, bh - LINE) + "px 0)" } },
        h(FitText, { key: "title-" + name, style: { position: "absolute", left: Math.round(x0), top: Math.round(foot + 0.07 * caps - BOXH), width: TW, height: BOXH }, innerStyle: { justifyContent: "flex-end" } },
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } }, kicker, lettering)))
    : null;
  // What stands under her sky, laid over it at every image (her roofs, trees, poles, wires and passers-by in front of
  // its letters), across its band only: elsewhere it would lay her shot over itself, a softer copy.
  const front = titleOn && behind
    ? h("div", { key: "front", style: { ...box, clipPath: "inset(" + Math.max(0, Math.round(foot - 1.5 * caps)) + "px 0 " + Math.max(0, Math.round(bh - foot - 0.7 * caps)) + "px 0)" } }, h(Skyline, { shot: 0, style: box }))
    : null;
  // Her signature, small at the bottom of her first shot as a film's credit, drifting down a little.
  const sigSize = band ? 34 : 44;
  const sigTop = band ? Math.round(bh * 0.82) : Math.round(height * 0.7);
  const signature = titleOn && signed
    ? h(FitText, { key: "sig-" + signed.text, style: { position: "absolute", left: Math.round(bw / 2 - 300), top: sigTop, width: 600, height: Math.round(sigSize * 1.4) }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: words(signed.text) <= 4 ? sigSize : 48, lineHeight: 1, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff", textShadow: "0 1px 3px rgba(0,0,0,0.6)", whiteSpace: "nowrap" } },
        h("span", { "data-fauve-accent": words(signed.text) <= 4 ? "" : undefined, style: { display: "inline-block", transform: "translateY(" + (0.25 * drift).toFixed(3) + "em)" } }, keep(signed.text)))
    : null;

  // 7. Her shots in its frame, cut on its beats, as filmed.
  const film = n ? h(Footage, { key: "film", shot: cur, style: box }) : null;

  // 8. Its ending card, when she has one: her last shot held and darkened, her words in white through three of its faces,
  // a beat of the original each, then hers; her line under them.
  const card = end && frame >= endAt;
  const e = card ? frame - endAt : -1;
  const ending = card
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { ...box, backgroundColor: "rgba(0,0,0," + (0.4 * Math.min(1, (e + 1) / 6)).toFixed(3) + ")" } }),
        h(FitText, { key: "end-" + end.title, style: { position: "absolute", left: 140, top: Math.round(bh * (band ? 0.2 : 0.3)), width: bw - 280, height: Math.round(band ? bh * 0.4 : 330) }, innerStyle: { justifyContent: end.subtitle ? "flex-end" : "center" } },
          cycle(keep(end.title).toUpperCase(), e < STEP ? 0 : e < 2 * STEP ? 1 : e < 3 * STEP ? 2 : 4, band ? 100 : 120, "endname", "#ffffff", true)),
        end.subtitle
          ? h(FitText, { key: "endsub-" + end.subtitle, style: { position: "absolute", left: 140, top: Math.round(bh * (band ? 0.62 : 0.48)), width: bw - 280, height: band ? 80 : 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: band ? 48 : 54, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: "0 1px 3px rgba(0,0,0,0.5)", justifyContent: "flex-start" } }, keep(end.subtitle))
          : null)
    : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film, title, front, signature, ending);

  // Any other text of the Reel (none in its slots): a plain white line above its frame in width, so nothing she wrote is lost.
  const extra = others.filter((x) => frame >= x.from && frame < Math.min(x.to, endAt)).map((x, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: band ? Math.max(100, by - 130 - i * 120) : 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(x.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

export const nomDeVille: MontageSkill = {
  key: "nom-de-ville",
  // 2: its name comes out from behind a line at every image, its roofline (else the foot of its place), rising 0,4 of
  // its capitals whatever its scenery (Tristan on v1: « l'aspect du texte qui apparaît derrière n'est pas là »).
  version: 2,
  bpm: BPM,
  shots: [FIXED, 15],
  // Up to 30 for a length she asks for: the life of the place in the original's pattern of shots (29 s at its tempo).
  long: LONG,
  files: [4, 15],
  how: "Un plan large et fixe de sa rue, de ses toits ou d'un paysage où son nom géant est posé dans le ciel, derrière ses toits (ils passent devant ses lettres), et monte doucement pendant que sa police change d'un coup à chaque temps, à la même place et dans la même couleur : ronde et très grasse, carrée, étroite, carrée plus grande, puis la sienne, qui reste ; deux à quatre petits mots au-dessus, sa signature en petit en bas. Puis quatre détails d'un temps chacun, un plan qui avance dans une rue ou un passage pendant que la musique tombe, quelque chose qui passe au ras de l'objectif quand elle revient, la vie de son lieu un plan tous les deux ou trois temps, et un coucher de soleil coupé net. En horizontal 16:9 comme l'original quand ses vidéos le sont.",
  end: true,
  texts: [
    {
      slot: "surtitre",
      role: "caption",
      want: "2 à 4 petits mots au-dessus du nom, qui l'amènent (une forme comme « les rues de », « un samedi à », « bienvenue à », « le quartier de »)",
      max: 18,
      required: true,
    },
    {
      slot: "nom",
      role: "hook",
      want: "le nom géant posé dans le ciel de son premier plan, derrière ses toits, dont la police change à chaque temps : un seul mot de préférence (son quartier, sa rue, sa ville, ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), plus il est court plus il est grand",
      max: 12,
      required: true,
    },
    {
      slot: "signature",
      role: "caption",
      want: "facultatif : sa signature en petit en bas du premier plan, comme un générique de film : son nom ou son compte (une forme comme « par Maison Farine », « @maisonfarine ») ; jamais le même mot que le nom, rien d'inventé",
      max: 24,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal 16:9 comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, comme l'original" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, a music's own): every landmark counted in beats follows it.
    const bpm = tempo ?? BPM;
    // A beat of the original's first piece: half one of the engine's.
    const half = 30 / bpm;
    const count = Math.max(FIXED, Math.min(LONG, Math.round(n)));
    const life = Array.from({ length: count - FIXED }, (_, i) => LIFE[i % LIFE.length]!);
    // With an ending card, its last shot held whole half-beats longer (the engine's 1,6 s at least, rounded up).
    const card = end ? Math.ceil((END_CARD + 0.05) / half) : 0;
    const beats = [FIRST + TITLE, ...QUICK, PLUNGE, PASSER, ...life, LAST + card];
    const spans = beatSpans(bpm, beats.map((b) => b / 2));
    const duration = spans.at(-1)!.end;
    const at = (b: number) => round3(b * half);
    const cut = spans[0]!.end;
    const wants = [
      `le plan large et fixe qui ouvre, téléphone posé, ${String(round(cut + 0.5)).replace(".", ",")} s au moins : sa rue, ses toits, son quartier ou un paysage, avec du ciel calme dans le haut de l'image et des toits, des arbres ou des collines qui y montent : son nom s'y pose en géant derrière eux`,
      ...QUICK.map(() => "un plan très court (un temps) : un détail de son lieu ou de son quartier où quelque chose bouge (un passant, une enseigne, un oiseau, une main, une plante dans le vent)"),
      "un plan qui avance, 2,5 s au moins : en marchant dans sa rue, un passage, un couloir ou une allée, la caméra basse ou levée vers le ciel (la musique tombe dessus)",
      "quelque chose qui passe tout près de l'objectif, la caméra basse : un vélo, un scooter, quelqu'un qui marche (la musique revient pendant ce plan)",
      ...life.map(() => "un plan de la vie de son lieu ou de son quartier, environ 1 s : des gens, ses gestes, un animal, quelqu'un qui passe, une lumière"),
      "le dernier plan, calme : un coucher de soleil, une vue, une lumière qui baisse (coupé net avec la musique)",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her name and her words on her first shot, from its first image to its cut.
      texts: { surtitre: { from: 0, to: cut }, nom: { from: 0, to: cut }, signature: { from: 0, to: cut } },
      // Its typeface changes on beats 1, 2 and 3 and lands on beat 4 (the original's images 18, 30, 44 and 55); a beat of
      // the original in frames (its ending card's faces).
      marks: { f1: toFrame(at(FIRST + 1)), f2: toFrame(at(FIRST + 2)), f3: toFrame(at(FIRST + 3)), land: toFrame(at(FIRST + 4)), step: round3(half * 30) },
      // Its drop: a low whoosh into a deep hit, its loudest on the alley's cut (beat 9); a short whoosh rising into the
      // music's return (beat 16).
      sounds: [
        { at: at(FIRST + DROP), sound: "low whoosh rising into a deep bass hit", seconds: 1, gain: 2 },
        { at: at(FIRST + BACK), sound: "short rising whoosh", seconds: 1, gain: -2 },
      ],
      // Its first beat at 0,17 s; without its bass until its drop (beat 9), stopped dead on beat 10¼ with its sound
      // ringing on over the alley, back on beat 16 (the next bar of ours), cut dead with the picture.
      music: {
        downbeat: at(FIRST),
        filters: [{ kind: "thin", from: 0, to: at(FIRST + DROP) }],
        pauses: [{ from: at(FIRST + STOP), to: at(FIRST + BACK), tail: TAIL }],
        end: { at: duration, fade: 0.012 },
      },
    };
  },
  code: CODE,
  // Its first four faces are always the model's (Lilita One round, Bungee square, League Gothic narrow); the fifth is hers.
  fonts: ["Lilita One", "Bungee", "League Gothic"],
};
