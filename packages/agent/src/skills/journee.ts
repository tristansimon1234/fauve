import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Une journée chez toi », version 2, written again on its original's fiche (docs/fiches/journee.md: « a day in
// PARIS », measured image by image at 30 i/s, its music and its clicks; v1 was written before it). Its music is soft and
// retro, without drums, at 136,8 BPM (Gemini heard 115), and every length below is in its beats, so its cuts fall where
// the original's do (within an image) on its own music; they do not fall on its beats: the original is cut by ear.
//   0 – 0,17    her place, wide and calm, five images;
//   0,17 – 0,87 things alike side by side in her shot (her jars, her cups, her windows: named by the filler), one a film
//               image (24 a second), each brought to the same place and size, the last ones sliding left; then a band
//               crosses from the right and hides the cut: a copy of her own shot, enlarged and blurred, as something
//               passing right in front of the lens;
//   0,87 – 1,47 a morning shot, another band over the cut;
//   1,47 – 2,5  the top of her front against the sky: her title fades in under the band that leaves (its first letters
//               hidden while it covers them), red didone capitals in the middle, small words by hand above its first
//               letter, a shutter click; held over the cut on a dark shot (a door, an arch, people walking away), gone
//               at the next one;
//   2,5 – 9,77  her day in twelve short shots, five flashes that overexpose the cut as a camera's (never a white card), in
//               series as someone taking photos, and three film burns (red-orange then white, cream from a corner, cream
//               from the right), each with its click;
//   9,77 – 15   people against the light turning jerky (an image held every four), a calm dusk, her place in the
//               evening, then the same at night, lit, at the same place of the picture (the day-to-night match), its
//               music muffled from the beat after that cut, and a last night shot as it fades out. No black, no logo,
//               no card: an ending card only when she has one to give (Tristan: « en option »).
// Played horizontal 4:3 on black as the original when her videos are horizontal (or she asks), else full frame; every
// place and size a share of its frame. No zoom, no push, no grain, no dark corners: the original has none. A photo
// stays still, a video plays (Tristan). Nothing of the original's own is copied: its words are hers.

const BPM = 136.8;
/** Its opening, in beats of its music: her place, the burst, the morning shot, the title's shot, the dark shot. */
const OPENING = [0.38, 1.6, 1.37, 0.84, 1.52];
/** Its day as the original cuts it, each shot with what happens at its cut into the next one. */
const DAY: [number, "" | "flash" | "burn"][] = [
  [1.37, "flash"],
  [0.99, "flash"],
  [0.76, ""],
  [1.44, ""],
  [1.75, ""],
  [2.51, "burn"],
  [1.67, "burn"],
  [2.05, ""],
  [1.75, "flash"],
  [0.76, "flash"],
  [0.76, "flash"],
  [0.76, "burn"],
];
/** What each shot of its day wants (the original's painter, his brush, a singer, a ride, the metro, a statue…). */
const DAY_WANTS = [
  "sa journée en plein jour : quelqu'un au travail, des gens autour",
  "le même de plus près (un flash d'appareil photo entre les deux)",
  "un détail en gros plan : des mains, un geste",
  "quelqu'un qu'on regarde : un client, un artisan, quelqu'un qui joue ou qui parle",
  "un geste de son métier, quelqu'un de concentré",
  "un moment qui bouge, un peu plus long : un manège, une machine, quelqu'un qui tourne",
  "quelque chose qui passe derrière quelqu'un : un tram, un métro, sa rue",
  "quelqu'un vu d'en bas, devant son lieu ou le ciel",
  "quelqu'un qui pose, un portrait",
  "un plan éclair : un détail de sa rue ou de son lieu",
  "un plan éclair : quelqu'un en plein geste",
  "un plan éclair : du monde, de l'animation",
];
/** Fewer shots (fewer of her files): these of its day go first, those with nothing at their cut first. */
const DROP = [4, 3, 7, 2, 10, 9];
/** The flash of its day that clicks softly (the original's third, 9,06 s). */
const SOFT = 9;
/** More shots (a length she asks for): moments of her day held three beats each, before the ride. */
const MORE = 3;
const MORE_AT = 5;
/** Its evening: against the light, the dusk, her place in the evening, at night, the last night shot. */
const EVENING = [1.98, 1.9, 1.67, 2.05, 4.41];
/** The burst lasts this long from its shot's start (14 images at its tempo), the band covering what follows. */
const BURST = 1.06;
/** The shot against the light turns jerky this far in (8 images). */
const JERKY = 0.6;
/** Its music fades out over this long (1,7 s), to the image before the end. */
const FADE = 3.88;
/** With an ending card (an option), the last shot is held this much longer. */
const CARD = 2;
/** The click on each flash and burn, and on the title's arrival (a camera's shutter, as its fiche hears it). */
const SHUTTER = { sound: "camera shutter", seconds: 0.5 };
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const BURST = mark("burst", 5);
  const BURST_TO = mark("burst_to", 19);
  const VEIL_A = mark("veil_a", -100);
  const VEIL_B = mark("veil_b", -100);
  const JERKY = mark("jerky", durationInFrames + 1);
  const NIGHT = mark("night", durationInFrames + 1);
  const flashes = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mark("flash_" + i, NaN)).filter(Number.isFinite);
  const burns = [0, 1, 2].map((i) => mark("burn_" + i, NaN));
  const endAt = end ? end.from : durationInFrames + 1;

  // Its frame: horizontal 4:3 on black as the original when her videos are mostly horizontal (or she asks), else the
  // whole vertical frame; every place and size below is a share of it.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 3) / 4) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const full ={ position: "absolute", left: 0, top: 0, width: bw, height: bh };
  const box = (x, y, w, t) => ({ position: "absolute", left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(t) });

  // 1. Her shots, as filmed, cut where the original cuts. The shot against the light turns jerky (an image held every
  // four, from a multiple of four into it), a film's walk. Her place at night is laid where it stood in the evening shot
  // (both on their subject's centre, as far as the picture's edges allow): the day-to-night match.
  const s = shots[cur];
  const J = s && JERKY >= s.from && JERKY < s.from + s.durationInFrames ? s.from + Math.round((JERKY - s.from) / 4) * 4 : null;
  const pic = (sh) => ({ W: Math.round(bh * (Number(sh && sh.aspect) || 0.5625)), fx: sh && sh.focus && Number.isFinite(sh.focus.x) ? sh.focus.x : 0.5 });
  const nightBox = (() => {
    if (cur < 1 || !s || Math.abs(s.from - NIGHT) > 1) return null;
    const e = pic(shots[cur - 1]);
    const m = pic(s);
    if (m.W <= bw || e.W < bw) return null;
    const ex = e.fx * e.W - Math.max(0, Math.min(e.W - bw, e.fx * e.W - bw / 2));
    return box(-Math.max(0, Math.min(m.W - bw, m.fx * m.W - ex)), 0, m.W, bh);
  })();

  // 2. A flash on each of its cuts (the picture kit's Flash expose): the picture overexposed as by a camera's flash,
  // never a white card, the last film image of the shot that goes (two images: its film runs at 24 a second) and the
  // first two of the one that comes, the first of them brightest (×1,35 and white laid in screen).
  // 3. A film burn on each of its three cuts (the picture kit's Burn): coloured light laid on the picture in screen,
  // image by image around its cut as measured ([image from the cut, its light, how much, a filter on the picture under
  // it]): red-orange from the left then a cold white; cream from the top right corner, all of it, a yellow rest low on
  // the right; cream from the right, then the same.
  const BURNS = [
    [[-3, "#56637a", 0.5, "saturate(0.5) brightness(1.08)"], [-2, "radial-gradient(ellipse 80% 110% at 0% 55%, rgba(255,96,64,0.95), rgba(255,96,64,0) 100%)", 1], [-1, "#aab2b9", 0.85]],
    [[-4, "radial-gradient(circle at 100% 0%, rgba(248,236,170,0.95), rgba(248,236,170,0) 55%)", 1], [-3, "radial-gradient(circle at 100% 0%, rgba(248,236,170,0.95), rgba(248,236,170,0.3) 70%, rgba(248,236,170,0.1))", 1], [-2, "#efe9b4", 0.86], [-1, "#efe9b4", 0.9], [0, "#eee6b0", 0.55], [1, "radial-gradient(circle at 100% 100%, rgba(244,212,120,0.85), rgba(244,212,120,0) 55%)", 1]],
    [[-4, "radial-gradient(ellipse 45% 90% at 100% 55%, rgba(240,218,158,0.9), rgba(240,218,158,0) 100%)", 1], [-3, "radial-gradient(ellipse 75% 110% at 100% 55%, rgba(240,218,158,0.95), rgba(240,218,158,0) 100%)", 1], [-2, "linear-gradient(to left, rgba(240,220,160,0.95), rgba(240,220,160,0.45) 60%, rgba(240,220,160,0.15))", 1], [-1, "#eee3b0", 0.78], [0, "#eeeab6", 0.72], [1, "radial-gradient(circle at 100% 100%, rgba(240,212,130,0.8), rgba(240,212,130,0) 55%)", 1]],
  ];
  // Under the first burn, the shot jumps on a third of a second, as the original's ride (image 188).
  const jump = s && frame >= burns[0] - 3 && frame < burns[0] && s.from + s.durationInFrames === burns[0] ? { at: s.from - 8 } : {};
  const film = n ? h(Footage, { shot: cur, ...jump, ...(J !== null && frame >= J ? { hold: 4 } : {}), style: nightBox || full }) : null;
  const light = [
    flashes.length ? h(Flash, { key: "f", at: flashes, expose: true, before: 2 }) : null,
    ...burns.map((c, b) => (Number.isFinite(c) ? h(Burn, { key: "b" + b, at: c, steps: BURNS[b] }) : null)),
  ];

  // 4. The burst: things alike side by side in her shot (what the filler named, each one found), one a film image (24 a
  // second, every fifth image twice), each brought to the same place (49 % across, 21,5 % down) and enlarged to the same
  // size (the original's 37 % of the frame's height, three times at most, less upright), the last ones sliding left as
  // the original turns into a pan under the band coming in. Its picture is laid whole (none of it cropped, so a piece
  // off the frame's crop comes in too); only the pieces it then still fills the frame for are taken (a black edge of
  // 6 % at most, as on the original's image 10). Fewer than four: a burst of her day's shots, an image each, as they come.
  let burst = null;
  if (cur === 1 && frame >= BURST && frame < BURST_TO) {
    const a = Number(shots[1].aspect) || 0.5625;
    const W = a >= bw / bh ? bh * a : bw;
    const H = a >= bw / bh ? bh : bw / a;
    const whole = { left: Math.round((bw - W) / 2), top: Math.round((bh - H) / 2), width: Math.round(W), height: Math.round(H) };
    const found = SubjectParts(shots[1], frame, whole, "@pareilles").filter((p) => p.w > 3 && p.h > 3);
    const Z = wide ? 3 : 1.6;
    const hs = found.map((p) => p.h).sort((x, y) => x - y);
    const size = Math.min(bh * 0.37, Z * (hs[Math.floor(hs.length / 2)] || 1));
    const place = (p, tx) => {
      const k = Math.max(1, Math.min(Z, size / p.h));
      const q = { w: k * whole.width, t: k * whole.height, left: tx - k * (p.x + p.w / 2 - whole.left), top: bh * 0.215 - k * (p.y + p.h / 2 - whole.top) };
      return { ...q, black: Math.max(q.left / bw, 1 - (q.left + q.w) / bw, q.top / bh, 1 - (q.top + q.t) / bh) };
    };
    const parts = found.filter((p) => place(p, bw * 0.49).black <= 0.06);
    const alike = parts.length >= 4;
    const m = alike ? Math.min(11, parts.length) : Math.min(11, Math.max(0, n - 6));
    const j = Math.min(m - 1, Math.floor(((frame - BURST + 0.5) * m) / Math.max(1, BURST_TO - BURST)));
    if (alike) {
      const fixed = m - Math.round((m * 6) / 11);
      const q = place(parts[j], bw * (j < fixed ? 0.49 : 0.47 - 0.04 * (j - fixed)));
      const edge = (v, laidSize, room) => Math.max(room - laidSize - 0.06 * room, Math.min(0.06 * room, v));
      burst = h(Footage, { shot: 1, style: box(edge(q.left, q.w, bw), edge(q.top, q.t, bh), q.w, q.t) });
    } else if (m > 0) burst = h(Footage, { shot: 5 + j, at: frame - 6, style: full });
  }

  // 5. The band over a hidden cut: a copy of the shot that goes, enlarged and very blurred (something passing right in
  // front of the lens), crossing from the right to the left, its edges very soft: in over 6 images, all of it covered
  // 6, out over 5, as the original's. The title is laid under it: it shows as the band leaves.
  const veil = (C, k) => {
    if (!(frame >= C - 12 && frame < C + 4) || !shots[k]) return null;
    const E = bw * 0.22;
    const L = interpolate(frame, [C - 12, C - 6], [bw, -E], clamp);
    const R = interpolate(frame, [C - 1, C + 4], [bw + E, 0], clamp);
    const mask = "linear-gradient(to right, transparent " + Math.round(L) + "px, #000 " + Math.round(L + E) + "px, #000 " + Math.round(R - E) + "px, transparent " + Math.round(R) + "px)";
    return h("div", { key: "v" + k, style: { ...full, overflow: "hidden", WebkitMaskImage: mask, maskImage: mask } },
      h("div", { style: { ...box((bw * 3) / 8, (bh * 3) / 8, bw / 4, bh / 4), transform: "scale(9.6)", filter: "blur(7px) brightness(0.72) saturate(0.85)" } },
        h(Footage, { shot: k, style: box(0, 0, bw / 4, bh / 4) })));
  };

  // 6. Her title in the decor: its name fades in over three images under the band that leaves, its small words come
  // whole on the third, nothing moves after; held over the cut on the dark shot, gone with the next cut. Red didone
  // capitals a fifth of the 4:3 frame high, centred a little under its middle (a long name smaller, on one line); small
  // words by hand above its first letter, their x-height a twelfth of its capitals, their foot almost on them (over an
  // accent when its first letters carry one), the same red, no edge, no shadow.
  const hook = reelTexts.find((t) => t.role === "hook");
  const small = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== small);
  const RED = "#fa010c";
  const display = "'" + brand.displayFont + "', 'Bodoni Moda', 'Didot', serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const hand = "'Caveat', '" + brand.bodyFont + "', cursive";
  const keep = (x) => String(x || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  // Its capitals' height; a didone's are three quarters of its size, its line as tall as its size (the capitals in its middle).
  const CAP = Math.round(bw * 0.15);
  const F = Math.round(CAP / 0.75);
  const nameStyle = { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: F, lineHeight: 1, letterSpacing: "-0.02em", textTransform: "uppercase", whiteSpace: "nowrap", color: RED };
  const NAME = keep(hook ? hook.text : "").toUpperCase();
  const marked = /[\u0300-\u0326\u0329-\u036f]/.test(NAME.slice(0, 4).normalize("NFD"));
  const T0 = hook ? hook.from : 0;
  const NW = Math.min(800, bw - 80);
  const title = hook && frame >= T0 && frame < Math.min(hook.to, endAt)
    ? h(FitText, { style: box((bw - NW) / 2, bh * 0.52 - F * 0.95, NW, F * 1.9) }, (scale) => {
        const sw = Math.round(CAP / 12 / 0.4 / Math.max(0.4, scale));
        return h("div", { style: { position: "relative" } },
          small ? h("div", { "data-fauve-accent": "", style: { position: "absolute", left: Math.round(F * 0.03), bottom: "100%", marginBottom: -Math.round(F * (marked ? -0.11 : 0.09) - 0.08 * sw), fontFamily: hand, fontWeight: 600, fontSize: sw, lineHeight: 1, color: RED, whiteSpace: "nowrap", opacity: frame >= T0 + 3 ? 1 : 0 } }, keep(small.text)) : null,
          h("div", { style: { ...nameStyle, opacity: interpolate(frame, [T0, T0 + 3], [0.25, 1], clamp) } }, NAME));
      })
    : null;

  // 7. Its ending card, only when the Reel has one: the last shot a little darker, its title in the name's red, a white
  // line under it.
  const fade = (a) => interpolate(frame, [a, a + 6], [0, 1], clamp);
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h("div", { style: { ...full, background: "#000000", opacity: 0.32 * fade(endAt) } }),
        h(FitText, { style: box(140, bh * 0.5 - CAP * 1.3, bw - 280, CAP * 1.6), innerStyle: { ...nameStyle, fontSize: Math.round(CAP * 0.95), whiteSpace: "normal", textWrap: "balance", lineHeight: 1.02, textAlign: "center", justifyContent: end.subtitle ? "flex-end" : "center", opacity: fade(endAt + 1) } }, keep(end.title)),
        end.subtitle
          ? h(FitText, { style: box(140, bh * 0.5 + CAP * 0.45, bw - 280, CAP * 0.9), innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.2, color: "#ffffff", textWrap: "balance", textAlign: "center", justifyContent: "flex-start", opacity: fade(endAt + 6) } }, keep(end.subtitle))
          : null)
    : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } },
    burst || film, ...light, title, veil(VEIL_A, 1), veil(VEIL_B, 2), ending);

  // Any other text of the Reel (none in its slots): a plain white line off its picture, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: box(140, wide ? Math.max(90, by - 150 - i * 120) : Math.min(1300, 1220 + i * 120), width - 280, 110), innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, t.text));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

export const journee: MontageSkill = {
  key: "journee",
  // 2: written again on its original's fiche (its format, its tempo and cuts, its burst, its bands, its title behind the
  // band, its flashes, burns and clicks, its jerky walk, its day-to-night match, its muffled music; no card of its own).
  // 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 3,
  bpm: BPM,
  shots: [16, 22],
  // Up to 33 for a length she asks for: about 30 s at its own tempo (its day goes on in moments held three beats).
  long: 33,
  files: [6, 16],
  // The moments something passes right before her lens (video_read.py): the filler casts them where its cut hides under a band.
  reads: ["covered"],
  how: "Son lieu large et calme, puis une rafale de choses pareilles côte à côte dans son plan (ses bocaux, ses tasses, ses fenêtres), une par image à la même place, et une bande floue qui passe devant l'objectif et cache la coupe ; un plan du matin, une autre bande, et le haut de sa façade contre le ciel où son titre rouge apparaît derrière la bande qui repart, en didone capitales au milieu, de petits mots écrits à la main au-dessus, avec un déclic ; le titre reste sur un plan sombre (une porte, une arche) et part à la coupe ; puis sa journée en plans courts, avec des flashs d'appareil photo et des brûlures de pellicule sur les coupes, chacun avec son déclic ; des gens à contre-jour qui marchent en saccadé, le crépuscule, son lieu le soir puis le même de nuit au même endroit de l'image, la musique étouffée, et un dernier plan de nuit pendant qu'elle s'éteint. En vertical plein écran, ses vidéos horizontales recadrées sur leur sujet ; en horizontal comme l'original à sa demande.",
  end: true,
  texts: [
    {
      slot: "surtitre",
      role: "caption",
      want: "2 ou 3 petits mots écrits à la main au-dessus du titre, alignés sur sa première lettre, qui l'amènent (une forme comme « une journée à », « un samedi chez », « le matin au »)",
      max: 20,
      required: true,
    },
    {
      slot: "titre",
      role: "hook",
      want: "le titre rouge en didone capitales au milieu de l'image, sur une ligne : un seul mot de préférence (sa ville, son quartier, sa rue, son nom s'il est court, sinon le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), plus il est court plus il est grand",
      max: 14,
      required: true,
    },
  ],
  objects: [
    {
      slot: "pareilles",
      shot: 1,
      want: "ce qu'on voit plusieurs fois côte à côte dans ce plan, qui ressort une chose par image à la même place : « every jar », « every cup », « every bottle », « every chair », « every window » (toujours « every » et la chose répétée) ; vide quand rien ne s'y répète",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, ou horizontal comme l'original",
      choices: [
        { value: "vertical", says: "vertical plein écran, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "horizontal 4:3 sur du noir, comme l'original", band: true },
        { value: "auto", says: "comme ses vidéos (horizontal si elles le sont)" },
      ],
    },
  ],
  timeline(n, options) {
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(16, Math.min(33, n));
    // Its day for this count: fewer shots drop those with nothing at their cut first; more are moments held longer.
    const day: { beats: number; cut: string; i: number }[] = DAY.map(([beats, cut], i) => ({ beats, cut, i })).filter((d) => !DROP.slice(0, Math.max(0, 22 - count)).includes(d.i));
    if (count > 22) day.splice(MORE_AT, 0, ...Array.from({ length: count - 22 }, () => ({ beats: MORE, cut: "", i: -1 })));
    const spans = beatSpans(bpm, [...OPENING, ...day.map((d) => d.beats), ...EVENING.slice(0, 4), EVENING[4]! + (options.end ? CARD : 0)]);
    const duration = spans.at(-1)!.end;
    const at = (i: number) => spans[i]!.start;
    // Each shot of its day ends on the cut into the next one: its flash or its burn is there.
    const cuts = day.map((d, j) => ({ ...d, frame: toFrame(at(OPENING.length + j + 1)) }));
    const flashes = cuts.filter((c) => c.cut === "flash");
    const burns = cuts.filter((c) => c.cut === "burn");
    const golden = OPENING.length + day.length;
    const night = golden + 3;
    // Her title fades in from the image after the cut under the second band; it goes with the cut on her day.
    const title = toFrame(at(3)) + 1;
    const click = (f: number, gain = 0): SkillSound => ({ at: Math.round((f / 30) * 1000) / 1000, ...SHUTTER, ...(gain ? { gain } : {}) });
    const wants = [
      "le plan qui ouvre, un sixième de seconde : son lieu large et calme, sa façade ou sa rue le matin",
      "plusieurs choses pareilles côte à côte, chacune nette (ses bocaux, ses tasses, ses gâteaux en vitrine, ses bouteilles, ses chaises, les fenêtres d'une façade) : elles ressortent une par image, à la même place ; sinon un détail de son lieu",
      "un plan du matin, du ciel ou du mouvement : des oiseaux, des arbres, sa rue qui s'éveille",
      "le haut de sa façade ou son enseigne contre le ciel, calme et clair au milieu de l'image : son titre y apparaît",
      "un plan sombre vers la lumière : une porte, une arche, un couloir, des gens qui s'éloignent (son titre reste dessus)",
      ...day.map((d) => (d.i < 0 ? "un moment de sa journée, tenu un peu plus : quelqu'un, un geste, ses clients" : DAY_WANTS[d.i]!)),
      "des gens qui marchent à contre-jour en fin de journée, vers la lumière (le plan devient saccadé)",
      "un plan calme au crépuscule, presque immobile : des gens derrière une vitre, une grille, sous un parapluie",
      "son lieu de loin, au centre de l'image, dans la lumière du soir",
      "le même lieu de nuit, éclairé, de plus près, au centre de l'image (le raccord jour → nuit) ; des lumières floues devant si possible",
      "un dernier plan de nuit avec des lumières, la caméra qui monte doucement, tenu jusqu'à la fin",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: {
        surtitre: { from: round(title / 30), to: round(at(5)) },
        titre: { from: round(title / 30), to: round(at(5)) },
      },
      // A shutter's click on the title's arrival, on each flash and each burn, as its fiche hears them: three around the
      // first burn, the second burn and the title the loudest, the second flash of the last series soft.
      sounds: [
        click(title, 3),
        ...flashes.map((c) => click(c.frame, c.i === SOFT ? -6 : 0)),
        ...(burns[0] ? [-4, -1, 2].map((o) => click(burns[0]!.frame + o)) : []),
        ...(burns[1] ? [click(burns[1].frame - 1, 3)] : []),
        ...(burns[2] ? [click(burns[2].frame)] : []),
      ].sort((a, b) => a.at - b.at),
      // Its music muffled from the beat after the cut on the night (as through a wall), then faded out over its last
      // 1,7 s, silent on its very last image.
      music: {
        filters: [{ kind: "muffled", from: round(Math.ceil((at(night) + 1 / 30) / beat - 1e-6) * beat), to: duration }],
        end: { at: round(duration - 1 / 30), fade: round(Math.min(4, FADE * beat)) },
      },
      marks: {
        burst: toFrame(at(1)),
        burst_to: toFrame(at(1) + BURST * beat),
        veil_a: toFrame(at(2)),
        veil_b: toFrame(at(3)),
        ...Object.fromEntries(flashes.map((c, k) => [`flash_${k}`, c.frame])),
        ...Object.fromEntries(burns.map((c, k) => [`burn_${k}`, c.frame])),
        jerky: toFrame(at(golden) + JERKY * beat),
        night: toFrame(at(night)),
      },
    };
  },
  code: CODE,
  fonts: ["Caveat"],
  // Its original has neither grain nor dark corners (its fiche, effect 9), and its black above and below its horizontal
  // frame would carry the grain: taken out of its model's finish.
  finish: { grain: 0, vignette: 0 },
};
