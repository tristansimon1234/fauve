import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Toi sur un aplat de couleur », the effect (docs/fiches/aplat.md, effects 1 and 2; its whole Reel is skills/aplat.ts):
// on one of her shots of someone walking (her, or someone of her team, in full, from behind or in profile), her
// silhouette cut out walks alone on a big flat colour (hers when it is a vivid one, else the original's pure red): flat
// white in a white halo, her shadow too, for three images, then in her own colours with her shadow cast from her feet;
// from a beat in, her real shot comes back around her from the nearest to the farthest (the ground under her feet first,
// a straight edge rising from the bottom of the frame, fast for a fifth of a beat, then on at a constant speed); just
// before its fourth beat the rest of her ground flat white for three images, then in its colours, her sky still the
// colour; just after its fifth beat her sky flat white for three images, then her shot whole: the montage goes on, on the
// same shot. The original's timings in its beats, kept at the Reel's tempo; a shorter span drops beats from the rebuild
// (never its flashes), a longer one gives her walk on the colour a beat more. Optional words on the colour above her (she
// passes in front of them), as the skill's: a title in the title's capitals, a small line over it.
// What it keeps of its skill: its colour (and its setting: hers or the red), its ink, its white silhouette and halo, its
// cast shadow, its rebuild's beats, its two white flashes, its ground and sky read on her shot (SkylineAt: where her sky
// ends, column by column, on her shot's first image, her own columns given the horizon beside her), its fallbacks
// (without her cut-out, her shot in black and white multiplied by the colour, and where the tracker saw her for her
// sky's outline; no sky read, her lower two thirds then her top). What it leaves: the next shot landing piece by piece,
// the frame of colour, the frozen world, the end on the colour, the 4:3 format, its music's dips. Her depth (Near) is not
// used: a layer's shots are only known once it is laid, and the engine reads a depth only on a shot written as a number
// (subject.ts, nearsDrawn); the rebuild rises from the bottom of the frame instead, the nearest ground of a shot of
// someone walking. Her sky's outline is read on her shot's first image and kept (a camera following her keeps its
// horizon; a move read on a ground that flows past, a dolly behind her, was taken for a zoom that swelled it).

/** How far her rebuilt shot reaches at each of its marks: shares of the way from the frame's bottom to where her sky begins. */
export const APLAT_REACH = [0.04, 0.25, 0.4, 0.4, 0.62];
/** The rebuild's marks between its start and its end (shares of it): the original's 1, 1,48, 1,8, 1,84 and 3,1 beats. */
const RISE_AT = [0, 0.23, 0.38, 0.4, 1];

/**
 * Its marks for a span (frames from its start), on the Reel's beats: her walk on the colour, her shot rebuilt (rise_0 to
 * rise_4), her ground's flash (just before a beat) and her sky's (just after the next); her shot whole three images after.
 * Within her walking shot (the first under it), half a beat of her shot whole before it is cut (none when it goes on).
 */
export function aplatTimeline({ frames, bpm, shots }: PieceTimelineInput): PieceTimeline {
  const beat = 1800 / Math.min(140, Math.max(60, bpm));
  const walk = shots[0];
  const end = walk ? Math.max(12, Math.min(frames, walk.from + walk.frames)) : frames;
  const tail = walk && walk.from + walk.frames > frames + 1 ? 0 : Math.round(beat / 2);
  // The frames up to her sky's flash (whole three images after it).
  const room = end - tail - 4;
  const whole = Math.floor(room / beat);
  // Five beats as the original (a sixth for her walk on the colour when there is room); three or four drop beats from the
  // rebuild; under three, its beats shortened.
  const step = whole >= 3 ? beat : Math.max(4, room / 3);
  const n = Math.max(3, whole);
  const colour = n >= 6 ? 2 : n >= 4 ? 1 : 0.6;
  const ground = n >= 5 ? colour + 3 : n - 1;
  const sky = n >= 5 ? colour + 4 : n;
  const riseEnd = colour + 0.7 * (ground - colour);
  // Each mark after the one before (its reach is read between them), the first after her three white images.
  const rise: number[] = [];
  for (const k of RISE_AT) rise.push(Math.max(rise.length ? rise.at(-1)! + 1 : 3, Math.round((colour + k * (riseEnd - colour)) * step)));
  const groundAt = Math.max(rise[4]! + 1, Math.round(ground * step) - 2);
  const skyAt = Math.max(groundAt + 4, Math.round(sky * step) + 1);
  return {
    marks: { ...Object.fromEntries(rise.map((f, k) => [`rise_${k}`, f])), ground: groundAt, sky: skyAt },
    // Her cut out on her walking shot (her silhouette, her shadow, her on top of her rebuilt shot).
    cutouts: [0],
  };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  // Nothing of its own once her shot is whole again: the montage plays it (an empty layer, never an empty page).
  const clear = h(AbsoluteFill, { style: { pointerEvents: "none" } });
  // Its shots: those that play during it; the first one is her walk (the effect holds on it alone).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return clear;
  const walk = mine[0];
  const shot = shots[walk];
  const BEAT = mark("beat", 18);
  // Its marks (its timeline's, else the original's beats), each after the one before.
  const RISE = [];
  [1, 1.48, 1.8, 1.84, 3.1].forEach((b, k) => RISE.push(Math.max(k ? RISE[k - 1] + 1 : 3, mark("rise_" + k, Math.round(b * BEAT)))));
  const GROUND = Math.max(RISE[4] + 1, mark("ground", Math.round(4 * BEAT) - 2));
  const SKY = Math.max(GROUND + 4, mark("sky", Math.round(5 * BEAT) + 1));
  const WHOLE = SKY + 3;
  if (frame >= WHOLE || frame >= shot.from + shot.durationInFrames) return clear;
  const laid = { left: 0, top: 0, width: W, height: H };
  const box = { position: "absolute", left: 0, top: 0, width: W, height: H };

  // Its colour: hers when it is a vivid one, else the original's pure red (on her word, the red whatever hers); the ink
  // that reads on it, white or a near black.
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) / 255);
  const vivid = (c) => {
    if (!/^#[0-9a-f]{6}$/i.test(String(c || ""))) return false;
    const [r, g, b] = rgb(c);
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    const l = (hi + lo) / 2;
    const s = hi === lo ? 0 : (hi - lo) / (1 - Math.abs(2 * l - 1));
    return s >= 0.5 && l >= 0.3 && l <= 0.62;
  };
  const AP = word("couleur") !== "rouge" && vivid(brand.accent) ? String(brand.accent).toLowerCase() : "#ff0000";
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (() => { const [r, g, b] = rgb(AP); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); })();
  const ON = (lum + 0.05) / 0.06 > 1.05 / (lum + 0.05) ? "#170707" : "#ffffff";

  // Where she is (her cut-out), and where her sky begins, column by column, read on her shot's first image (none in an
  // interior) and kept: the camera that follows someone walking keeps its horizon, and a move read on a ground that
  // flows past (a dolly behind her) is taken for a zoom that would swell her sky's outline image after image.
  const her = SubjectBox(shot, frame, laid);
  const first = SubjectBox(shot, shot.from, laid);
  const COLS = 20;
  const ends = Array.from({ length: COLS + 1 }, (_, k) => SkylineAt(shot, shot.from, laid, { from: (k - 0.5) * (W / COLS), to: (k + 0.5) * (W / COLS) }));
  const known = ends.filter((y) => typeof y === "number" && Number.isFinite(y));
  const sky = known.length > COLS / 2;
  const fill = (k) => { for (let d = 0; d <= COLS; d++) { const y = ends[k - d] ?? ends[k + d]; if (typeof y === "number" && Number.isFinite(y)) return y; } return 0; };
  // A little under where it was read (its reading is a column's highest point): never a thread of real sky over her ground.
  const line = ends.map((_, k) => Math.max(0, Math.min(H, fill(k) + Math.round(H * 0.006))));
  // Her head stands in her sky in her own columns: there her ground follows the horizon on either side of her (she is
  // drawn on top of it). Without her cut-out, where the tracker saw her (the tallest body), else any bump narrower than
  // nine columns (a head, a passer-by) is her sky.
  const tracked = (() => {
    if (first || typeof track !== "function") return null;
    const bodies = ((track(shot.from, { shot: walk, ...laid }) || {}).bodies || []).map((b) => Object.values(b.points || {}).filter((q) => q && q.visible)).filter((p) => p.length >= 4);
    if (!bodies.length) return null;
    const p = bodies.sort((u, v) => Math.max(...v.map((q) => q.y)) - Math.min(...v.map((q) => q.y)) - (Math.max(...u.map((q) => q.y)) - Math.min(...u.map((q) => q.y))))[0];
    const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
    return { x: Math.min(...xs) - 30, y: Math.min(...ys) - 60, w: Math.max(...xs) - Math.min(...xs) + 60, h: Math.max(...ys) - Math.min(...ys) + 80 };
  })();
  const anchor = first || tracked;
  if (anchor) {
    const a = Math.max(0, Math.floor((anchor.x - 16) / (W / COLS)));
    const b = Math.min(COLS, Math.ceil((anchor.x + anchor.w + 16) / (W / COLS)));
    const left = a > 0 ? line[a - 1] : b < COLS ? line[b + 1] : null;
    const right = b < COLS ? line[b + 1] : left;
    if (left !== null) for (let k = a; k <= b; k++) line[k] = left + ((right - left) * (k - a + 1)) / (b - a + 2);
  } else {
    const lower = line.map((_, k) => Math.max(...line.slice(Math.max(0, k - 4), k + 5)));
    lower.forEach((_, k) => { line[k] = Math.min(...lower.slice(Math.max(0, k - 4), k + 5)); });
  }
  // Her ground: under her sky (its outline), or without a sky her lower two thirds.
  const CUT = Math.round(H * 0.34);
  const groundClip = sky
    ? "path('M0 " + H + " " + line.map((y, k) => "L" + Math.round(k * (W / COLS)) + " " + Math.round(y)).join(" ") + " L" + W + " " + H + " Z')"
    : "inset(" + CUT + "px 0 0 0)";
  // How far up her rebuilt shot is: the original's reach on its marks, toward the lowest point of her sky (or the cut).
  const top = sky ? Math.max(...line) : CUT;
  const reach = frame < RISE[0] ? 0 : interpolate(frame, RISE, [0.04, 0.25, 0.4, 0.4, 0.62], clamp);
  const edge = H - reach * (H - top);
  // A straight edge that rises from the bottom, its right end a little ahead (the original's « bord droit » entering by the bottom right).
  const lean = Math.round(H * 0.035 * Math.min(1, reach * 6));
  const riseClip = "polygon(0px " + H + "px, " + W + "px " + H + "px, " + W + "px " + Math.round(edge - lean) + "px, 0px " + Math.round(edge + lean) + "px)";
  const layers = [];

  // 1. The flat colour (her sky flat white for three images, laid under her ground); without her cut-out, her shot in
  // black and white multiplied by the colour (her dark shapes on it).
  if (her || frame >= SKY) layers.push(h("div", { key: "flat", style: { ...box, backgroundColor: frame >= SKY ? "#ffffff" : AP } }));
  else layers.push(h(React.Fragment, { key: "duo" }, h(Footage, { shot: walk, style: { ...box, filter: "grayscale(1) contrast(1.55) brightness(1.1)" } }), h("div", { style: { ...box, backgroundColor: AP, mixBlendMode: "multiply" } })));
  const white = frame < 3;
  const halo = "drop-shadow(0 0 " + Math.round(W * 0.012) + "px #ffffff) drop-shadow(0 0 " + Math.round(W * 0.045) + "px rgba(255,255,255,0.75))";
  // 2. Her shadow cast from her feet, drawn from her silhouette (her cut-out leaves her real one on the ground), dark and
  // about half her height toward the lower left as the original's backlit walker's; white in her halo at first.
  if (her && frame < GROUND) {
    layers.push(h("div", { key: "shade", style: { ...box, ...(white ? { filter: halo } : {}) } },
      h(CastShadow, { box: her, direction: "left", length: 0.6, angle: 34, color: white ? "#ffffff" : "#000000", opacity: white ? 1 : 0.75, blur: white ? 1 : 2 }, h(Subject, { shot: walk, style: box }))));
  }
  // 3. The rest of her ground flat white for three images, just before its beat (what is rebuilt stays in its colours).
  if (frame >= GROUND && frame < GROUND + 3) layers.push(h("div", { key: "gw", style: { ...box, backgroundColor: "#ffffff", clipPath: groundClip } }));
  // 4. Her shot rebuilt from the nearest, as filmed, the edge rising; then her whole ground in its colours, her sky still the colour.
  if (frame >= RISE[0] && frame < GROUND + 3) layers.push(h(Footage, { key: "rise", shot: walk, style: { ...box, clipPath: riseClip } }));
  if (frame >= GROUND + 3) layers.push(h(Footage, { key: "ground", shot: walk, style: { ...box, clipPath: groundClip } }));
  // 5. Her words, when there are some, on the colour above her (she passes in front of them), until her sky's flash.
  if (frame >= 3 && frame < SKY && (word("titre") || word("ligne"))) layers.push(words());
  // 6. Her, on top, while the colour or her rebuilt shot is around her: white in its halo first, then in her colours.
  if (her) {
    layers.push(white
      ? h("div", { key: "her", style: { ...box, filter: halo } }, h(Subject, { shot: walk, fill: "#ffffff", style: box }))
      : h(Subject, { key: "her", shot: walk, style: box }));
  }

  // Her words above her, on the colour: one line of the title's capitals in the colour's ink, its small line over it in
  // spaced capitals; their box under her head when she is tall in the frame, never smaller than can be read.
  function words() {
    const display = "'" + brand.displayFont + "', 'Anton', 'Archivo Black', sans-serif";
    const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
    const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
    const TOP = 150;
    const room = her ? her.y - TOP - Math.round(H * 0.02) : H;
    const tall = Math.round(Math.min(H * 0.2, Math.max(H * 0.13, room)));
    const small = word("ligne") ? 76 : 0;
    const rise = (a) => ({ display: "inline-block", opacity: interpolate(frame, [a, a + 5], [0, 1], clamp), transform: "translateY(" + (16 * (1 - interpolate(frame, [a, a + 8], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) }))).toFixed(1) + "px)" });
    return h(React.Fragment, { key: "words" },
      word("ligne")
        ? h(FitText, { style: { position: "absolute", left: 140, top: TOP, width: W - 280, height: small }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 48, lineHeight: 1.1, letterSpacing: "0.2em", textTransform: "uppercase", color: ON, whiteSpace: "nowrap", textAlign: "center" } },
            h("span", { style: { ...rise(3), marginRight: "-0.2em" } }, keep(word("ligne"))))
        : null,
      word("titre")
        ? h(FitText, { style: { position: "absolute", left: 140, top: TOP + small, width: W - 280, height: Math.max(150, tall - small) }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 190, lineHeight: 0.92, letterSpacing: "-0.01em", textTransform: "uppercase", color: ON, whiteSpace: "nowrap", textAlign: "center" } },
            h("span", { style: rise(word("ligne") ? 6 : 3) }, keep(word("titre"))))
        : null);
  }

  return h(AbsoluteFill, { style: { overflow: "hidden" } }, ...layers);
}`;

export const aplat: EffectPiece = {
  key: "aplat",
  version: 1,
  name: "Toi sur un aplat de couleur",
  how: "sa silhouette détourée marche seule sur un grand aplat de couleur vive (sa couleur quand elle l'est, sinon un rouge pur), blanche et lumineuse trois images, puis à ses couleurs avec son ombre portée ; un temps après, son vrai plan revient autour d'elle du plus près au plus loin, le sol sous ses pieds d'abord, puis le reste du sol en un éclair blanc, puis son ciel en un éclair blanc ; son plan entier, et le montage reprend.",
  needs: "une vidéo de quelqu'un qui marche (elle ou quelqu'un de l'équipe), de dos ou de profil, en entier dans l'image, le sol bien visible et du ciel ou un plafond en haut, à contre-jour de préférence.",
  lays: "sur un seul de ses plans, quelqu'un qui marche en pied, coupé de 5 à 7 temps (son plan revient entier à la fin de l'effet)",
  shots: [1, 1],
  seconds: [2, 5],
  require: { files: 1, shot: { framing: ["wide", "medium"], person: true, video: true } },
  texts: [
    { slot: "titre", want: "facultatif : 1 à 3 mots sur l'aplat, au-dessus d'elle, en capitales : ce qu'on va voir, ou son nom s'il est court (une forme comme « un samedi », « au marché », « chez Lou »)", max: 16, required: false },
    { slot: "ligne", want: "facultatif : une petite ligne en capitales espacées au-dessus du titre, 2 à 4 mots : où, quand (une forme comme « rue des Martyrs », « tous les samedis »)", max: 24, required: false },
  ],
  settings: [
    {
      name: "couleur",
      want: "la couleur de l'aplat",
      choices: [
        { value: "sienne", says: "sa couleur à elle quand elle est vive (celle de sa charte), sinon le rouge pur de l'original" },
        { value: "rouge", says: "le rouge pur de l'original, quelle que soit sa couleur" },
      ],
    },
  ],
  timeline: aplatTimeline,
  code: CODE,
};
