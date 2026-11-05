import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Petites lumières », written on its original's fiche (docs/fiches/petites-lumieres.md: measured image by image at
// 30 i/s, its lamp's light, its red disc as a blob, its windows mapped back through the picture's slow move, its sound's
// bands every 10 ms; its second example, the same song, cross-correlated with it; Tristan: « c'est un effet que l'on veut
// pouvoir faire, pas exactement reproduire l'image »). Three still pictures of a city at dusk where only lights move, on a
// dark lo-fi trap beat at 83 BPM (a beat every 0,723 s, the first at 0,09 s: its opening low hit) that stops dead three
// times for a beat. Every landmark below is in beats of that grid, from its first beat:
//   −0,1 – 5,59   a street lamp against a sunset sky: on four images on the opening hit, off while the music stops,
//                 three blinks of four images (two off between) as it comes back, held from 2,23 to 4,16, off; the cut two
//                 images after the music is back from its second stop (5,5);
//   5,59 – 9,10   a courtyard seen from below: a flat red disc in its sky behind the buildings, shrinking slowly (its radius
//                 from 20 to 15,7 % of the width); its windows filled with red in six waves from the bottom (5,69 · 5,87 ·
//                 6,15 · 6,98 · 7,16 · 8,17), lit to the cut, on the tick alone in its third stop (9,03);
//   9,10 – 13,48  towers: a column of windows lit crimson from the bottom in four steps after the music is back (9,65 ·
//                 9,88 · 10,16 · 10,39), all off at once on 12,19; the music cut on 12,37, the picture held to the end.
// Here on her place: her own light (a lamp, a lantern, her sign, a neon: named by the filler) dimmed off and lit on those
// beats; her windows (or what she has several of that can light) filled with her red in waves from the bottom, and a red
// sun in her sky, behind her roofs (her skyline read on her shot cuts it, her shot without its sky laid over it when the
// engine has it); her last shot's column lit from the bottom, then everything off. Its words: none in the original; her
// name, when the Reel wants words, lit like a neon in the calm part of her last shot and left on as the last light. A
// fourth file adds a verse: one more bar, lit like the last shot and kept on to its cut, on the next stop's tick (its
// second example has four shots). Her photos stay still, her videos play (the original's slow push and pull-back left
// out: Tristan). Vertical full frame as the original when her files are upright; horizontal ones whole in a 16:9 band on
// black, as its second example (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »).

const BPM = 83;
/** Its first beat: the opening's low hit, 0,09 s in. */
const FIRST_S = 0.09;
const FIRST = (FIRST_S * BPM) / 60;
/** Its cuts, two images after the music is back from its second stop (4,13 s) and on the tick of its third (6,67 s); its end (9,83 s). */
const CUT1 = 5.593;
const CUT2 = 9.098;
const END = 13.478;
/** A verse (a fourth file): one more bar, cut on the tick of the next stop. */
const VERSE = 4;
/** Its first shot's light, on from – to (beats): the opening hit, three blinks, then held. */
const LAMP: [number, number][] = [
  [0.06, 0.244],
  [1.397, 1.582],
  [1.674, 1.858],
  [1.951, 2.135],
  [2.227, 4.164],
];
/** Its second shot's windows, six waves from the bottom. */
const WAVES = [5.685, 5.87, 6.146, 6.976, 7.161, 8.175];
/** A column's four steps from the bottom (beats after its shot's cut); in the last shot, everything off this long after its cut. */
const STEPS = [0.553, 0.784, 1.061, 1.291];
const OFF = 3.089;
/** Its music, stopped dead a beat after the first half beat of each bar, back on the off-beat; its tick alone in the third stop; its end. */
const PAUSES: [number, number][] = [
  [0.436, 1.5],
  [4.413, 5.5],
  [8.473, 9.5],
];
const TICK = 9.03;
const MUSIC_END = 12.367;
/** The engine's ending card: the Reel's last 1,6 s. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  if (!n) return h(AbsoluteFill, { style: { backgroundColor: "#000000" } });
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const last = n - 1;
  const rel = frame - shots[cur].from;
  const endAt = end ? end.from : durationInFrames + 1;
  const card = Boolean(end) && frame >= endAt;

  // 1. Its frame: vertical full frame when her files are upright, else whole in a 16:9 band on black (its second example).
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const full = { position: "absolute", left: 0, top: 0, width: bw, height: bh };

  // 2. Its colours: the original's reds (its windows, its sun, a red neon), a window's warm light, or hers when vivid enough to shine.
  const vivid = (c) => {
    const x = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
    if (!x) return null;
    const v = parseInt(x[1], 16);
    const rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    const l = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    return l > 0.08 && l < 0.85 && Math.max(...rgb) - Math.min(...rgb) > 60 ? rgb : null;
  };
  const mode = setting("couleur", "rouge");
  const hers = mode === "sienne" ? vivid(brand.accent) : null;
  const css = (rgb) => "rgb(" + rgb.join(",") + ")";
  const warm = mode === "chaude";
  const WIN = hers ? css(hers) : warm ? "#ffc56e" : "#b4201a";
  const SUN = hers ? css(hers) : warm ? "#ff8a24" : "#fe0000";
  const GLOW = hers || (warm ? [255, 176, 92] : [255, 42, 36]);
  const TUBE = hers ? css(hers.map((c) => Math.round(c + (255 - c) * 0.72))) : warm ? "#fff3df" : "#ffe1dc";

  // 3. Her shot as filmed (a photo still, a video playing), cut on its beats.
  const film = h(Footage, { key: "film", shot: cur, style: full });
  const layers = [];
  const bloom = (k, a) => h("div", { key: "bloom", style: { ...full, mixBlendMode: "screen", opacity: a, filter: "brightness(1.15) contrast(2.4) blur(" + Math.max(6, Math.round(bh * 0.012)) + "px)" } }, h(Footage, { shot: k, style: full }));
  // Pieces in the order they light: the lowest first, left to right (the original's waves climb its floors), read on the
  // shot's first image so each keeps its rank; drawn where they are now.
  const climb = (ref, now) => ref.map((p, i) => ({ i, p, box: now[i] || p })).filter((q) => q.box.w > 2 && q.box.h > 2).sort((a, b) => b.p.y + b.p.h - (a.p.y + a.p.h) || a.p.x - b.p.x);
  const rankOf = (count, steps, g) => (count >= steps ? Math.floor((g * steps) / count) : g);
  const pad = Math.max(2, Math.round(bh * 0.003));
  const clip = (boxes) => "path('" + boxes.map((b) => "M" + Math.round(b.x - pad) + " " + Math.round(b.y - pad) + "h" + Math.round(b.w + 2 * pad) + "v" + Math.round(b.h + 2 * pad) + "h" + -Math.round(b.w + 2 * pad) + "Z").join(" ") + "')";
  // Lit pieces of an object: its silhouette in her colour shown only through their boxes; a soft halo for the warm light.
  const litPieces = (key, boxes, draw) => boxes.length
    ? h("div", { key, style: { ...full, clipPath: clip(boxes) } },
        draw(),
        warm || hers ? h("div", { style: { ...full, mixBlendMode: "screen", opacity: 0.6, filter: "blur(" + Math.max(3, Math.round(bh * 0.004)) + "px)" } }, draw()) : null)
    : null;

  // 4. Its first shot: her light dimmed off, lit on the original's beats (the opening hit, three blinks, held), off again.
  // Lit: its own picture brighter, with a glow of its own highlights when it already shines in her picture (a lit neon, a
  // lamp on); else (a lamp off, black glass) its shape filled with a lamp's warm light, strongest in its middle, a halo
  // round it. Nothing named or found: what already shines in her picture lights and goes out on the same beats.
  const LAMP = [0, 1, 2, 3, 4].map((k) => [mark("lamp_" + k + "_on", NaN), mark("lamp_" + k + "_off", NaN)]).filter((s) => s[1] > s[0]);
  const lampOn = cur === 0 && LAMP.some((s) => frame >= s[0] && frame < s[1]);
  if (cur === 0) {
    const b = SubjectBox(shots[0], frame, laid, "@lumiere");
    const light = () => h(Subject, { shot: 0, object: "@lumiere", style: full });
    if (b && lampOn) {
      const seen = LightUnder(shots[0], frame, laid, b);
      const blur = Math.max(6, Math.round(Math.max(b.w, b.h) * 0.16));
      const core = "radial-gradient(ellipse " + Math.round(b.w * 0.75 + 8) + "px " + Math.round(b.h * 0.75 + 8) + "px at " + Math.round(b.x + b.w / 2) + "px " + Math.round(b.y + b.h / 2) + "px, #000 0%, #000 40%, rgba(0,0,0,0.3) 100%)";
      layers.push(h("div", { key: "own", style: { ...full, filter: "brightness(1.35) saturate(1.15)" } }, light()));
      if (seen && seen.high > 0.72) layers.push(h("div", { key: "shine", style: { ...full, mixBlendMode: "screen", opacity: 0.9, filter: "contrast(2.2) brightness(1.25) blur(" + blur + "px)" } }, light()));
      else layers.push(
        h("div", { key: "fill", style: { ...full, mixBlendMode: "screen", opacity: 0.92, maskImage: core, WebkitMaskImage: core } }, h(Subject, { shot: 0, object: "@lumiere", style: full, fill: "#ffe2a2" })),
        h("div", { key: "halo", style: { ...full, mixBlendMode: "screen", opacity: 0.8, filter: "blur(" + blur + "px)" } }, h(Subject, { shot: 0, object: "@lumiere", style: full, fill: "#ffbf5c" })));
    } else if (b) layers.push(h("div", { key: "dim", style: { ...full, filter: "brightness(0.42) saturate(0.7)" } }, light()));
    else if (lampOn) layers.push(bloom(0, 0.85));
  }

  // 5. Its second shot: a sun in her sky behind her roofs, shrinking slowly (its radius from 20 to 15,7 % of the width), cut
  // to the sky above her skyline as read on her shot, her shot without its sky laid over it; set where her sky goes
  // deepest across a sun's width (the middle on a tie, as the original's), its centre a little above her roofline there;
  // her windows filled with her colour in six waves from the bottom, lit to the cut. No sky read (an interior): no sun.
  if (n > 1 && cur === 1) {
    const s1 = shots[1];
    if (setting("soleil", "oui") !== "non") {
      const COLS = 24;
      const cw = bw / COLS;
      const read = Array.from({ length: COLS }, (_, k) => SkylineAt(shots[1], frame, laid, { from: k * cw, to: (k + 1) * cw }));
      const known = read.map((y, k) => (y !== null ? k : -1)).filter((k) => k >= 0);
      const prof = known.length ? read.map((y, k) => (y !== null ? y : read[known.reduce((a, j) => (Math.abs(j - k) < Math.abs(a - k) ? j : a), known[0])])) : [];
      const t = Math.max(0, Math.min(1, rel / Math.max(1, s1.durationInFrames)));
      const R0 = Math.round(Math.min(bw * 0.2, bh * 0.24));
      const r = Math.round(R0 * (1 - 0.215 * t));
      const span = Math.max(1, Math.round(R0 / cw));
      let best = null;
      for (let c = 0; c < prof.length; c++) {
        const depth = Math.min(...prof.slice(Math.max(0, c - Math.floor(span / 2)), Math.min(COLS, c + Math.ceil(span / 2))));
        const x = (c + 0.5) * cw;
        if (!best || depth > best.depth + 4 || (Math.abs(depth - best.depth) <= 4 && Math.abs(x - bw / 2) < Math.abs(best.x - bw / 2))) best = { depth, x };
      }
      const cy = best ? Math.round(Math.min(best.depth - 0.45 * r, bh * 0.5)) : -1;
      if (best && best.depth > 1.1 * R0 && cy > r * 0.5) {
        const cx = Math.round(Math.max(R0 * 0.8, Math.min(bw - R0 * 0.8, best.x)));
        let d = "M0 0H" + bw;
        for (let k = COLS - 1; k >= 0; k--) d += "V" + Math.round(prof[k]) + "H" + Math.round(k * cw);
        layers.push(
          h("div", { key: "sky", style: { ...full, clipPath: "path('" + d + "Z')" } },
            h("div", { style: { position: "absolute", left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: "50%", backgroundColor: SUN } })),
          h(Skyline, { key: "ground", shot: 1, style: full }));
      }
    }
    const WAVES = [0, 1, 2, 3, 4, 5].map((k) => mark("wave_" + k, NaN)).filter(Number.isFinite);
    const order = climb(SubjectParts(shots[1], s1.from, laid, "@fenetres", 6), SubjectParts(shots[1], frame, laid, "@fenetres", 6));
    const lit = order.filter((q, g) => frame >= WAVES[Math.min(WAVES.length - 1, rankOf(order.length, WAVES.length, g))]).map((q) => q.box);
    if (order.length) layers.push(litPieces("windows", lit, () => h(Subject, { shot: 1, object: "@fenetres", style: full, fill: WIN })));
    else {
      const hit = WAVES.filter((f) => frame >= f && frame < f + 3).length;
      if (hit) layers.push(bloom(1, 0.6));
    }
  }

  // 6. Its later shots: a column lit from the bottom in four steps after its cut; in the last one everything goes off at
  // once, then the picture holds. A verse (a fourth file) keeps its column on to its cut.
  if (cur >= 2 && n > 2) {
    const STEPS = [0, 1, 2, 3].map((k) => mark("step_" + k, NaN)).filter(Number.isFinite);
    const OFF = mark("off", 1e9);
    const verse = cur < last;
    const parts = (f) => (verse ? SubjectParts(shots[2], f, laid, "@suite", 8) : SubjectParts(shots[last], f, laid, "@colonne", 8));
    const order = climb(parts(shots[cur].from), parts(frame));
    const on = verse || rel < OFF;
    const lit = on ? order.filter((q, g) => rel >= STEPS[Math.min(STEPS.length - 1, rankOf(order.length, STEPS.length, g))]).map((q) => q.box) : [];
    if (order.length) layers.push(litPieces("column", lit, () => (verse ? h(Subject, { shot: 2, object: "@suite", style: full, fill: WIN }) : h(Subject, { shot: last, object: "@colonne", style: full, fill: WIN }))));
    else if (on && STEPS.length && rel >= STEPS[0]) layers.push(bloom(cur, rel < STEPS[STEPS.length - 1] + 3 ? 0.7 : 0.45));
  }

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film, ...layers);

  // 7. Her name lit like a neon (a tube catching: off, on, almost off, on, half, on) in the calm part of her last shot (its
  // sky first), with its column's first step, left on once everything else is off: the last light. Horizontal: above
  // the band, on the black. Her ending card in its place after the held picture, lit the same way.
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const display = "'" + brand.displayFont + "', 'Instrument Serif', 'Georgia', serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const keep = (x) => String(x || "").replace(/(\d) (?=\d)/g, "$1 ");
  const NEON = [0, 1, 0.3, 1, 0.55];
  const lightOf = (k) => (k < 0 ? 0 : k < NEON.length ? NEON[k] : 1);
  const glow = (size, a) => "0 0 " + Math.max(2, Math.round(size * 0.03)) + "px rgba(" + GLOW.join(",") + "," + (0.95 * a).toFixed(2) + "), 0 0 " + Math.round(size * 0.12) + "px rgba(" + GLOW.join(",") + "," + (0.75 * a).toFixed(2) + "), 0 0 " + Math.round(size * 0.3) + "px rgba(" + GLOW.join(",") + "," + (0.45 * a).toFixed(2) + ")";
  const NAME_AT = mark("name", Math.max(0, durationInFrames - 75));
  const chars = Array.from(keep(hook ? hook.text : end ? end.title : "")).length;
  const NS = wide ? Math.min(110, Math.round(2600 / Math.max(8, chars))) : Math.min(150, Math.round(3200 / Math.max(8, chars)));
  const NH = Math.round(NS * 1.3);
  const NW = 800;
  const atEnd = cur === last && frame >= NAME_AT - 2;
  const fallback = { x: 140, y: Math.round(bh * 0.12), w: NW, h: NH };
  const spot = wide || !atEnd ? null : (n > 3 ? ClearBox(shots[3], frame, laid, { aspect: NW / NH, min: { w: Math.round(NW * 0.55), h: Math.round(NH * 0.55) }, max: { w: NW, h: NH }, prefer: "top", fallback }) : ClearBox(shots[2], frame, laid, { aspect: NW / NH, min: { w: Math.round(NW * 0.55), h: Math.round(NH * 0.55) }, max: { w: NW, h: NH }, prefer: "top", fallback })) || fallback;
  const box = wide ? { left: 140, top: Math.max(90, by - 40 - NH), width: NW, height: NH } : spot ? { left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(Math.min(spot.h, NH)) } : null;
  const fit = box ? Math.min(1, box.height / NH) : 1;
  const neon = (key, words, size, on, extra) => h(FitText, { key, style: { position: "absolute", ...box, ...extra }, innerStyle: { fontFamily: display, fontWeight: 400, fontSynthesis: "none", fontSize: Math.round(size), lineHeight: 1.05, letterSpacing: "0.01em", color: TUBE, whiteSpace: "nowrap", textAlign: "center", justifyContent: "center", textShadow: glow(size, 1), opacity: on } }, keep(words));
  const nameOn = hook && atEnd && !card ? lightOf(frame - NAME_AT) : 0;
  const name = box && nameOn > 0 ? neon("name-" + keep(hook.text), hook.text, NS * fit, nameOn, {}) : null;
  const cardOn = card ? lightOf(frame - endAt) : 0;
  const cardTitle = card && box && cardOn > 0 ? neon("card-" + keep(end.title), end.title, NS * fit, cardOn, {}) : null;
  const cardLine = card && box && end.subtitle && frame - endAt >= 3
    ? h(FitText, { key: "line-" + keep(end.subtitle), style: { position: "absolute", left: box.left, top: box.top + box.height + 10, width: box.width, height: 90 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.15, letterSpacing: "0.12em", textTransform: "uppercase", color: TUBE, textAlign: "center", justifyContent: "center", textShadow: glow(48, 0.7), opacity: lightOf(frame - endAt - 3) } }, keep(end.subtitle))
    : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.min(1320, by + bh + 120 + i * 110) : Math.min(1300, 1220 + i * 120), height: 100 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, name, cardTitle, cardLine, extra);
}`;

export const petitesLumieres: MontageSkill = {
  key: "petites-lumieres",
  version: 1,
  bpm: BPM,
  shots: [3, 4],
  files: [3, 4],
  how: "Trois images immobiles de son lieu le soir où seules les lumières bougent, sur un beat qui s'arrête net trois fois : sa lampe (ou son enseigne, un néon) clignote sur la musique puis tient allumée et s'éteint ; ses fenêtres se remplissent de rouge par vagues du bas vers le haut, un soleil rouge derrière ses toits ; une colonne de fenêtres s'allume du bas vers le haut, puis tout s'éteint d'un coup ; son nom, quand il faut des mots, reste allumé comme un néon, la dernière lumière. En vertical plein écran ; ses images horizontales entières dans une bande 16:9 sur du noir.",
  end: true,
  texts: [
    {
      slot: "nom",
      role: "hook",
      want: "facultatif : son nom (ou un mot court de son lieu) qui s'allume comme un néon dans le ciel ou la partie calme de son dernier plan et reste allumé quand tout s'éteint ; une ligne, seulement quand le Reel a besoin de mots",
      max: 22,
      required: false,
    },
  ],
  objects: [
    {
      slot: "lumiere",
      shot: 0,
      want: "la lumière de ce plan, la plus petite chose qui éclaire : la tête d'un lampadaire, une lanterne, une applique, un abat-jour, une suspension, son enseigne lumineuse, un néon, une guirlande (« street lamp head », « lantern », « wall lamp », « neon sign », « string lights ») ; vide si aucune ne s'y voit",
    },
    {
      slot: "fenetres",
      shot: 1,
      want: "ses fenêtres dans ce plan, chacune à part (« every window »), ou ce qu'il a plusieurs fois et qui peut s'allumer : ses lampes, ses ampoules, ses bougies (« every lamp », « every light bulb ») ; vide sinon",
    },
    {
      slot: "suite",
      shot: 2,
      want: "ses fenêtres dans ce plan, chacune à part (« every window »), ou ce qu'il a plusieurs fois l'un au-dessus de l'autre : une guirlande, ses étagères éclairées (« every window », « string lights ») ; vide sinon",
    },
    {
      slot: "colonne",
      shot: -1,
      want: "ses fenêtres dans ce plan, chacune à part (« every window »), le mieux les unes au-dessus des autres, ou ce qui s'aligne en hauteur : une guirlande, une enseigne verticale, ses étagères éclairées ; vide sinon",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran comme l'original, ou ses images horizontales entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme ses images (horizontal sur du noir si elles le sont surtout)" },
        { value: "vertical", says: "vertical plein écran, ses images horizontales recadrées" },
        { value: "horizontal", says: "ses images entières dans une bande 16:9 sur du noir, son nom allumé au-dessus" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur de ses lumières (ses fenêtres, le soleil, son nom en néon)",
      choices: [
        { value: "rouge", says: "le rouge de l'original : des fenêtres rouges, un soleil rouge, un néon rouge" },
        { value: "chaude", says: "la lumière chaude d'une fenêtre allumée, un soleil orange, un néon blanc chaud" },
        { value: "sienne", says: "sa couleur à elle (celle de sa charte ; le rouge si elle est trop pâle ou trop sombre pour briller)" },
      ],
    },
    {
      name: "soleil",
      want: "le soleil rouge dans son ciel, derrière ses toits, sur le deuxième plan",
      choices: [
        { value: "oui", says: "un soleil dans son ciel derrière ses toits, qui rétrécit lentement" },
        { value: "non", says: "sans soleil, son ciel tel quel" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer or shorter Reel, a music's own): every landmark counted in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const verse = n > 3 ? VERSE : 0;
    // With an ending card, its whole beats after the held picture (the engine's 1,6 s at least).
    const card = end ? Math.ceil((END_CARD + 0.05) / beat) : 0;
    const spans = beatSpans(bpm, [FIRST + CUT1, CUT2 - CUT1, ...(verse ? [verse] : []), END - CUT2 + card]);
    const duration = spans.at(-1)!.end;
    // A landmark (beats from its first beat) on the Reel's clock (s), and in frames.
    const at = (b: number) => round3((FIRST + b) * beat);
    const lastCut = CUT2 + verse;
    const name = at(lastCut + STEPS[0]!);
    const wants = [
      `une de ses lumières de près, sur une photo ou une vidéo fixe (téléphone posé), le soir : un lampadaire, une lanterne, une applique, son enseigne lumineuse, un néon, devant un ciel ou un mur calme ; elle y clignote sur la musique, tient allumée puis s'éteint (${comma(spans[0]!.end)} s)`,
      `sa rue, sa façade ou son lieu en plan large, sur une photo ou une vidéo fixe, avec des fenêtres (éclairées ou pas) ou des lumières répétées, et un peu de ciel au-dessus des toits : ses fenêtres s'y allument par vagues, un soleil se pose derrière ses toits (${comma(spans[1]!.end - spans[1]!.start)} s)`,
      ...(verse ? ["une autre façade ou une autre vue de son lieu, fixe, avec des fenêtres ou des lumières les unes au-dessus des autres : elles s'y allument du bas vers le haut"] : []),
      "sa façade ou un immeuble de face, sur une photo ou une vidéo fixe, ses fenêtres les unes au-dessus des autres (ou une guirlande, une enseigne verticale) : elles s'allument du bas vers le haut, puis tout s'éteint d'un coup et l'image reste",
    ];
    const ticks = [TICK, ...(verse ? [TICK + verse] : [])];
    const sounds: SkillSound[] = ticks.map((b) => ({ at: at(b), sound: "short high rim click", seconds: 0.5, gain: -2 }));
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her name lit with the last column's first step, on to the end (or to her ending card, which takes its place).
      texts: { nom: { from: round(name), to: round(end ? duration - END_CARD : duration) } },
      marks: {
        ...Object.fromEntries(LAMP.flatMap(([a, b], k) => [[`lamp_${k}_on`, toFrame(at(a))], [`lamp_${k}_off`, toFrame(at(b))]])),
        ...Object.fromEntries(WAVES.map((b, k) => [`wave_${k}`, toFrame(at(b))])),
        // A column's steps and its end, in frames after its shot's cut.
        ...Object.fromEntries(STEPS.map((b, k) => [`step_${k}`, toFrame(b * beat)])),
        off: toFrame(OFF * beat),
        name: toFrame(name),
      },
      sounds,
      // Its first beat at 0,09 s; stopped dead for a beat in each bar (once more for a verse), back on the off-beat; cut on
      // its beat 12,37 (later by a verse and by her ending card), the picture held in silence after it.
      music: {
        downbeat: at(0),
        pauses: [...PAUSES, ...(verse ? [[PAUSES[2]![0] + verse, PAUSES[2]![1] + verse] as [number, number]] : [])].map(([a, b]) => ({ from: at(a), to: at(b) })),
        end: { at: round3(at(MUSIC_END + verse) + card * beat), fade: 0.012 },
      },
      // Its verse's column on its third shot, only with four of them.
      objects: { suite: verse ? 2 : 99 },
    };
  },
  code: CODE,
  // It draws its own lights: its finish keeps its colours, never a grain or corners over its black band.
  finish: { grain: 0, vignette: 0 },
};
