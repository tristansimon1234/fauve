import { END_CARD_SECONDS, beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Toi sur un aplat de couleur », version 2, written again on its original's fiche (docs/fiches/aplat.md: a hiker's
// edit of 8,8 s measured image by image at 30 i/s, its music measured by bands; Tristan: « c'est un effet que l'on veut
// pouvoir faire, pas exactement reproduire l'image »). Its music is a melody without drums at 123 BPM (Gemini heard
// 120), in phrases of a bar; every length below is in its beats from its first beat (the original's image 2: its two
// images before it are left out, the Reel starts on its music's first beat), so its cuts fall where the original's do:
//   0 – 8     her walking shot: for three images she and her shadow are flat white in a white halo on a flat pure red
//             (her colour when it is a vivid one), then she walks in her own colours on it, her shadow cast from her
//             feet; from beat 1 her shot rebuilds itself around her from the nearest to the farthest (her depth read as
//             a mask: the ground under her feet in seven images, the path further, then on at a constant speed); just
//             before beat 4 the rest of her ground flat white for three images, then in its colours, her sky still red;
//             on beat 5 her sky white for three images, then her shot whole; from beat 5¾ the next shot lands on her
//             walk piece by piece, still, one an eighth (what it has several of, named by the filler, from the nearest
//             to the farthest, alternating sides, each flat white an image then itself), then its whole bottom, burnt;
//   8 – 12    the next shot whole, overexposed two images, then playing; a beat in, a frame of the colour closes in on it
//             from its four sides at a constant speed, the picture never shrinking; the music dips in its last beat;
//   12 – 16   someone in front of a background: one beat as filmed, then the world behind them frozen and redrawn in a
//             new look on each note of the phrase (pushed colours, posterised, a line drawing, a duotone of the colour,
//             black and white, a halftone in the colour: looks that invent nothing, where the original's styles were
//             made by a generative AI, Tristan: « on est un outil de montage pas une ia »), they go on moving in front;
//   16 – 17   the same shot later (their last gesture);
//   17 – 18   the colour full frame, the Reel looping onto its opening (or her ending card on it).
// A length she asks for adds shots in its middle, each whole for a beat then framed by the colour closing in. Played as
// the original, a horizontal 4:3 picture on black, when her files are mostly horizontal (or she asks), else full frame.
// Her photos stay still, her videos play. No text in the original: its title is optional, on the colour of her opening
// (her words, or Edith's when Edith picked the model), and nothing of the original's own is copied.

const BPM = 123;
/** Its sections, in beats: her walk, each framed shot, the frozen world, the same shot later, the colour. */
const WALK = 8;
const FRAMED = 4;
const FROZEN = 4;
const LATER = 1;
const COLOUR = 1;
/** Past its four shots (a length she asks for), more framed shots in its middle: up to 14 (about 28 s). */
const LONG = 14;
/** Her shot rebuilt from the nearest: from beat 1, its ground under her in seven images, its path to her shoulders, a breath, then on at a constant speed (beats). */
const NEAR = [1, 1.45, 1.8, 1.85, 3.1];
/** Its rest of the ground white just before beat 4 (images before the beat), its sky white just after beat 5 (images after it); three images each. */
const GROUND_BEFORE = 2;
const SKY_AFTER = 1;
/** The next shot's pieces: each in its colours an image after these eighths (beats), the white two images before; the last one its whole bottom. */
const LANDS = [5.75, 6, 6.5, 7, 7.5];
/** A framed shot is whole this long before its frame closes in (beats: the original's 16 images). */
const CLOSE_AFTER = 1.1;
/** The frozen world's looks, on the notes of the phrase (beats from that shot's start: the original's images 192, 198, 207, 212, 219 and 226). */
const STYLES = [1, 1.4, 2, 2.35, 2.85, 3.3];
/** The engine's ending card: the Reel's last 2,5 s, on the colour (whole beats of it). */
const END_CARD = END_CARD_SECONDS;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const NEAR = [0, 1, 2, 3, 4].map((k) => mark("near_" + k, 15 + 7 * k));
  const GROUND = mark("ground", 57);
  const SKY = mark("sky", 74);
  const LANDS = [0, 1, 2, 3, 4].map((k) => mark("land_" + k, 85 + 6 * k));
  const CLOSE = Math.max(1, mark("close_after", 16));
  const STYLES = [0, 1, 2, 3, 4, 5].map((k) => mark("style_" + k, -1));
  const RED = mark("red", durationInFrames + 1);
  const PHOTO = Math.max(0, n - 2);
  // Its own filters, one id each (two copies of the scene in one page never share one).
  const ID = "ap" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");

  // Its frame: a horizontal 4:3 picture on black, as the original, when most of her files are horizontal (or she asks),
  // else the whole vertical frame; every place below is a share of it.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 3) / 4) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const box = { position: "absolute", left: 0, top: 0, width: bw, height: bh };

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
  const AP = setting("couleur", "sienne") !== "rouge" && vivid(brand.accent) ? String(brand.accent).toLowerCase() : "#ff0000";
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (() => { const [r, g, b] = rgb(AP); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); })();
  const ON = (lum + 0.05) / 0.06 > 1.05 / (lum + 0.05) ? "#170707" : "#ffffff";
  const flat = (key, color) => h("div", { key, style: { ...box, backgroundColor: color } });
  const display = "'" + brand.displayFont + "', 'Anton', 'Archivo Black', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const hook = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== line);
  const layers = [];

  // 1. Her walk (her first shot, until the next one lands whole). Her cut-out alone on the flat colour, white and
  // glowing for three images, then in her own colours, her shadow cast from her feet (drawn from her silhouette: the
  // cut-out leaves her real one on the ground), dark and about half her height toward the lower left as the original's
  // backlit walker's; without her cut-out, her shot in black and white multiplied by the colour (her dark shapes on it).
  if (cur === 0 && n) {
    const her = SubjectBox(shots[0], frame, laid);
    const whole = frame >= SKY + 3;
    // Her sky, as read on her shot (none: an interior, or not read): her ground and her sky come back in bands instead.
    const sky = SkylineAt(shots[0], GROUND, laid, { from: 0, to: bw }) !== null;
    if (whole) layers.push(h(Footage, { key: "whole", shot: 0, style: box }));
    else {
      if (her || frame >= SKY) layers.push(flat("ground", frame >= SKY ? "#ffffff" : AP));
      else layers.push(h(React.Fragment, { key: "duo" }, h(Footage, { shot: 0, style: { ...box, filter: "grayscale(1) contrast(1.55) brightness(1.1)" } }), h("div", { style: { ...box, backgroundColor: AP, mixBlendMode: "multiply" } })));
      const white = frame < 3;
      if (her && frame < GROUND) {
        layers.push(h("div", { key: "shade", style: { ...box, ...(white ? { filter: "drop-shadow(0 0 " + Math.round(bw * 0.012) + "px #ffffff) drop-shadow(0 0 " + Math.round(bw * 0.045) + "px rgba(255,255,255,0.75))" } : {}) } },
          h(CastShadow, { box: her, direction: "left", length: 0.6, angle: 34, color: white ? "#ffffff" : "#000000", opacity: white ? 1 : 0.75, blur: white ? 1 : 2 }, h(Subject, { shot: 0, style: box }))));
      }
      // Her title, when there is one, on the colour above her (she passes in front of it), until her ground comes back.
      if (hook && frame >= 3 && frame < Math.min(hook.to, GROUND)) layers.push(titleBlock(her));
      // Her shot rebuilding itself from the nearest to the farthest from beat 1: its depth read as a mask grows, the
      // ground under her in seven images, the path further, a breath, then on at a constant speed (nothing without it).
      const depth = frame < NEAR[1] ? interpolate(frame, [NEAR[0], NEAR[1]], [0.04, 0.24], clamp) : frame < NEAR[3] ? interpolate(frame, [NEAR[1], NEAR[2]], [0.24, 0.36], clamp) : interpolate(frame, [NEAR[3], NEAR[4]], [0.36, 0.6], clamp);
      if (frame >= NEAR[0] && frame < (sky ? GROUND + 3 : SKY + 3)) layers.push(h(Near, { key: "near", shot: 0, depth, style: box }));
      if (sky) {
        // The rest of her ground (all but her sky) flat white for three images, then in its colours, her sky still the
        // colour; then her sky white for three images (laid under her ground), then her shot whole.
        if (frame >= GROUND && frame < GROUND + 3) layers.push(h("div", { key: "g", style: { ...box, filter: "brightness(0) invert(1)" } }, h(Skyline, { shot: 0, style: box })));
        else if (frame >= GROUND + 3) layers.push(h(Skyline, { key: "g", shot: 0, style: box }));
      } else {
        // No sky: its lower two thirds, then its top, each flat white for three images, then itself.
        const cut = Math.round(bh * 0.34);
        if (frame >= GROUND && frame < GROUND + 3) layers.push(h("div", { key: "b", style: { position: "absolute", left: 0, top: cut, width: bw, height: bh - cut, backgroundColor: "#ffffff" } }));
        else if (frame >= GROUND + 3) layers.push(h(Footage, { key: "b", shot: 0, style: { ...box, clipPath: "inset(" + cut + "px 0 0 0)" } }));
        if (frame >= SKY) layers.push(h("div", { key: "t", style: { position: "absolute", left: 0, top: 0, width: bw, height: cut, backgroundColor: "#ffffff" } }));
      }
      // Her, on top, while the colour or her rebuilt shot is around her: white in its halo first, then in her colours.
      if (her && (frame < GROUND + 3 || !sky)) {
        layers.push(white
          ? h("div", { key: "her", style: { ...box, filter: "drop-shadow(0 0 " + Math.round(bw * 0.012) + "px #ffffff) drop-shadow(0 0 " + Math.round(bw * 0.045) + "px rgba(255,255,255,0.75))" } }, h(Subject, { shot: 0, fill: "#ffffff", style: box }))
          : h(Subject, { key: "her", shot: 0, style: box }));
      }
    }
    // 2. The next shot lands on her walk piece by piece, still (before its moment it holds its first image): what it has
    // several of (named by the filler), from the nearest to the farthest, alternating sides, up to four, each flat
    // white for an image, then an image without it, then itself, to the cut; then its whole bottom, its white burnt.
    // Nothing named there: three bands of it from the bottom up, one an eighth.
    if (n > 1 && frame >= LANDS[0] - 2) {
      const parts = SubjectParts(shots[1], frame, laid, "@choses", 0).map((p, i) => ({ ...p, i })).filter((p) => p.w > bw * 0.03 && p.h > bh * 0.03);
      const low = (list) => list.sort((a, b) => b.y + b.h - (a.y + a.h));
      const left = low(parts.filter((p) => p.x + p.w / 2 < bw / 2));
      const right = low(parts.filter((p) => p.x + p.w / 2 >= bw / 2));
      const chosen = [];
      while (chosen.length < 4 && (left.length || right.length)) chosen.push((chosen.length % 2 === 0 ? (left.length ? left : right) : right.length ? right : left).shift());
      const at = (k) => LANDS[k];
      const state = (k) => (frame < at(k) - 2 ? 0 : frame === at(k) - 2 ? 1 : frame === at(k) - 1 ? 0 : 2);
      const bottom = Math.round(bh * 0.4);
      const band = (key, top, height, k, burnt) => {
        const s = state(k);
        if (!s) return null;
        if (s === 1 && !burnt) return h("div", { key, style: { position: "absolute", left: 0, top, width: bw, height, backgroundColor: "#ffffff" } });
        return h(Footage, { key, shot: 1, style: { ...box, clipPath: "inset(" + top + "px 0 " + (bh - top - height) + "px 0)", ...(s === 1 ? { filter: "brightness(3)" } : {}) } });
      };
      if (chosen.length) {
        chosen.forEach((p, j) => {
          const k = 4 - chosen.length + j;
          const s = state(k);
          if (s) layers.push(h(Subject, { key: "p" + j, shot: 1, object: "@choses", part: p.i, style: box, ...(s === 1 ? { fill: "#ffffff" } : {}) }));
        });
        layers.push(band("bottom", bottom, bh - bottom, 4, true));
      } else {
        const third = Math.round(bh / 3);
        layers.push(band("b0", bh - third, third, 2), band("b1", bh - 2 * third, third, 3), band("b2", 0, bh - 2 * third, 4));
      }
    }
  }

  // 3. Her framed shots: each one whole (the first overexposed for two images as it lands), then a frame of the colour
  // closing in on it from its four sides at a constant speed, to the cut: the picture under it never shrinks or moves.
  // 4:3: up to 14,7 % of the width on its sides, 17,8 % of the height above and below (the original's 106 and 96 px);
  // full frame, the same thickness on all four sides.
  if (cur >= 1 && cur < PHOTO) {
    const s = shots[cur];
    const burnt = cur === 1 && frame < s.from + 2;
    const t = interpolate(frame, [s.from + CLOSE, s.from + s.durationInFrames - 1], [0, 1], clamp);
    const sideMost = wide ? Math.round(bw * 0.147) : Math.round(bw * 0.139);
    const topMost = wide ? Math.round(bh * 0.178) : sideMost;
    const sd = Math.round(sideMost * t);
    const tp = Math.round(topMost * t);
    if (t > 0) layers.push(flat("frame", AP));
    layers.push(h(Footage, { key: "framed", shot: cur, style: { ...box, ...(t > 0 ? { clipPath: "inset(" + tp + "px " + sd + "px)" } : {}), ...(burnt ? { filter: "brightness(2.8) saturate(1.15)" } : {}) } }));
  }

  // 4. Someone in front of a background: as filmed for a beat, then the world behind them frozen on one image and
  // redrawn in a new look on each note (pushed colours, posterised, a line drawing, a duotone of the colour, black and
  // white, a halftone in the colour), while they go on moving in front, cut out at every image. Without their cut-out:
  // the whole shot frozen, a new look on each note.
  if (cur === PHOTO && n >= 4) {
    const s = shots[PHOTO];
    const k = STYLES.reduce((a, f, i) => (f >= 0 && frame >= f ? i : a), -1);
    if (k < 0) layers.push(h(Footage, { key: "photo", shot: PHOTO, style: box }));
    else {
      const still = (style) => h(Footage, { shot: PHOTO, at: frame - (STYLES[0] - s.from), style: { ...box, ...(style || {}) } });
      const looks = [
        () => still({ filter: "saturate(2.1) contrast(1.2) brightness(1.04)" }),
        () => h(React.Fragment, null,
          h("svg", { width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
            h("filter", { id: ID + "p", colorInterpolationFilters: "sRGB" },
              h("feComponentTransfer", null, ...["R", "G", "B"].map((c) => h("feFunc" + c, { key: c, type: "discrete", tableValues: "0.04 0.32 0.62 0.96" }))))),
          still({ filter: "url(#" + ID + "p) saturate(1.2)" })),
        () => h(Sketch, { style: box }, still()),
        () => h(React.Fragment, null, still({ filter: "grayscale(1) contrast(1.3)" }), h("div", { style: { ...box, backgroundColor: AP, mixBlendMode: "screen" } })),
        () => h(Look, { preset: "bw", style: box, texture: false }, still()),
        () => h("div", { style: { ...box, backgroundColor: "#ffffff" } }, h(Ascii, { cell: [9, 9], kind: "dots", ink: AP, paper: "#ffffff", contrast: 1.25 }, still())),
      ];
      layers.push(h("div", { key: "world" + k, style: box }, looks[k]()));
      if (SubjectBox(shots[PHOTO], frame, laid)) layers.push(h(Subject, { key: "them", shot: PHOTO, style: box }));
    }
  }

  // 5. The same shot later (their last gesture), then the colour full frame on its beat, to the end: the Reel loops onto
  // its opening. Her ending card, when she has one, on the colour: its title stacked in the title's capitals, its line under it.
  if (cur === n - 1 && n >= 4) layers.push(frame >= RED ? flat("red", AP) : h(Footage, { key: "later", shot: n - 1, style: box }));
  const stack = (text) => String(text || "").split(/[ \t\n]+/).filter(Boolean).join("\n");
  const rise = (a) => ({ display: "inline-block", opacity: interpolate(frame, [a, a + 5], [0, 1], clamp), transform: "translateY(" + (16 * (1 - interpolate(frame, [a, a + 8], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) }))).toFixed(1) + "px)" });
  if (end && frame >= endAt) {
    const cardTop = wide ? Math.round(bh * 0.14) : Math.round(bh * 0.24);
    const cardH = wide ? Math.round(bh * 0.5) : Math.round(bh * 0.3);
    layers.push(flat("card", AP),
      h(FitText, { key: "ct", style: { position: "absolute", left: 140, top: cardTop, width: bw - 280, height: cardH }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: wide ? 170 : 210, lineHeight: 0.9, letterSpacing: "-0.01em", textTransform: "uppercase", color: ON, whiteSpace: "pre", textAlign: "center" } },
        h("span", { style: rise(endAt + 1) }, stack(keep(end.title)))),
      end.subtitle
        ? h(FitText, { key: "cs", style: { position: "absolute", left: 140, top: cardTop + cardH + Math.round(bh * 0.03), width: bw - 280, height: wide ? 120 : 170 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.18, color: ON, textAlign: "center", textWrap: "balance" } },
            h("span", { style: rise(endAt + 6) }, keep(end.subtitle)))
        : null);
  }

  // Her title on the colour of her opening (optional: the original has none), above her: one line of the title's
  // capitals in the colour's ink, its small line above it in spaced capitals; under her head when she is tall.
  function titleBlock(her) {
    const top = Math.max(Math.round(bh * 0.07), 80 - by);
    const room = her ? Math.max(0, her.y - top - Math.round(bh * 0.02)) : bh;
    const tall = Math.round(Math.min(bh * 0.2, Math.max(bh * 0.12, room)));
    const small = line ? Math.round(tall * 0.32) : 0;
    const accent = line && String(line.text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length <= 4;
    return h(React.Fragment, { key: "title" },
      line
        ? h(FitText, { style: { position: "absolute", left: 140, top, width: bw - 280, height: small }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: wide ? 30 : 36, lineHeight: 1.1, letterSpacing: "0.24em", textTransform: "uppercase", color: ON, whiteSpace: "nowrap", textAlign: "center" } },
            h("span", accent ? { "data-fauve-accent": "", style: { marginRight: "-0.24em" } } : null, keep(line.text)))
        : null,
      hook
        ? h(FitText, { style: { position: "absolute", left: 140, top: top + small, width: bw - 280, height: tall - small }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: wide ? 150 : 190, lineHeight: 0.92, letterSpacing: "-0.01em", textTransform: "uppercase", color: ON, whiteSpace: "nowrap", textAlign: "center" } }, keep(hook.text))
        : null);
  }

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, ...layers);

  // Any other text of the Reel (none in its slots): a plain white line off its picture, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.max(100, by - 130 - i * 120) : 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

export const aplat: MontageSkill = {
  key: "aplat",
  // 2: written again on its original's fiche (its 123 BPM and its cuts, its 4:3 format, its pure red, her shot rebuilt
  // from the nearest to the farthest, the next shot's still pieces one an eighth, its overexposed arrival, its frame
  // closing at a constant speed, the frozen world in a new look on each note, its end on the colour; no title of its own).
  // 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 3,
  bpm: BPM,
  // Her walk, the next shot framed, someone in front of a background, the same later; past them (more of her files), more framed shots.
  shots: [4, 6],
  // Up to 14 for a length she asks for (about 28 s at its own tempo): more of her shots framed by the colour.
  long: LONG,
  files: [3, 10],
  how: "Sa silhouette détourée (quelqu'un qui marche, de dos ou de profil) seule sur un grand aplat rouge pur (ou sa couleur quand elle est vive), blanche et lumineuse trois images, puis à ses couleurs avec son ombre ; son vrai plan revient autour d'elle du plus près au plus loin, puis le reste du sol en un flash blanc, puis le ciel ; le plan suivant se pose dessus morceau par morceau, figé, un par croche, puis arrive surexposé ; un cadre de la même couleur se referme sur lui à vitesse constante ; puis quelqu'un devant un fond : le décor derrière se fige et change de look sur chaque note pendant que la personne bouge ; le même plan plus tard, et le Reel finit sur la couleur. En vertical plein écran, ses vidéos horizontales recadrées sur leur sujet ; en horizontal 4:3 comme l'original à sa demande.",
  end: true,
  texts: [
    { slot: "titre", role: "hook", want: "facultatif : 1 à 3 mots sur l'aplat de couleur, au-dessus de la silhouette, en capitales : ce qu'on va voir, ou son nom s'il est court (une forme comme « un samedi », « au marché », « chez Lou »)", max: 18, required: false },
    { slot: "ligne", role: "caption", want: "facultatif : une petite ligne en capitales espacées au-dessus du titre, 2 à 4 mots : où, quand (une forme comme « au marché · samedi », « rue des Martyrs »)", max: 28, required: false },
  ],
  objects: [
    {
      slot: "choses",
      shot: 1,
      want: "ce que ce plan montre plusieurs fois, chose par chose, et qui peut se poser morceau par morceau : ses tables, ses chaises, ses produits sur une étagère, ses plantes, ses bouteilles, des sacs, des vélos, des rochers (« every table », « every plant », « every bottle », « every tote bag ») ; vide si rien ne s'y répète",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, ou horizontal 4:3 comme l'original",
      choices: [
        { value: "vertical", says: "vertical plein écran, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "horizontal 4:3 sur du noir, comme l'original", band: true },
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur de l'aplat",
      choices: [
        { value: "sienne", says: "sa couleur à elle quand elle est vive (celle de sa charte), sinon le rouge pur de l'original" },
        { value: "rouge", says: "le rouge pur de l'original, quelle que soit sa couleur" },
      ],
    },
  ],
  // Its original's grade is its finish (« Couleurs franches », docs/fiches/aplat.md, effect 7), without grain nor dark
  // corners: its colour stays flat and pure to its corners, the black around its 4:3 picture black.
  finish: { grain: 0, vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(4, Math.min(LONG, n));
    const framed = count - 3;
    // The colour at the end, or her ending card's time on it (whole beats).
    const colour = end ? Math.max(COLOUR, Math.ceil((END_CARD + 0.05) / beat)) : COLOUR;
    const spans = beatSpans(bpm, [WALK, ...Array.from({ length: framed }, () => FRAMED), FROZEN, LATER + colour]);
    const duration = spans.at(-1)!.end;
    const photo = spans[count - 2]!.start;
    // The frozen world's notes and the colour's beat, in beats from the Reel's start (its shots' starts are rounded to images).
    const photoBeat = WALK + framed * FRAMED;
    const wants = [
      "une vidéo de quelqu'un qui marche (elle ou quelqu'un de l'équipe), de dos ou de profil, en entier dans l'image, au moins 4 s, à contre-jour si possible, le sol et le fond bien visibles, du ciel ou un plafond en haut : sa silhouette marche seule sur l'aplat de couleur, puis son plan revient autour d'elle",
      "un plan large de son lieu, filmé d'un peu bas, son sujet au milieu, avec plusieurs choses au premier plan (tables, étagères, produits, plantes) : elles se posent une à une sur le plan d'avant, puis un cadre de couleur se referme sur lui",
      ...Array.from({ length: framed - 1 }, () => "un plan vivant de son lieu, son sujet au milieu (un geste, quelqu'un, un détail) : un cadre de couleur se referme sur lui"),
      "quelqu'un devant un fond (sa vitrine, son comptoir, sa devanture), de dos ou de trois-quarts, qui fait un geste (regarder, photographier, servir, écrire), le téléphone posé, au moins 3 s : le décor se fige derrière et change de look sur chaque note pendant qu'il bouge",
      "le même plan un peu plus tard (la fin de son geste : il regarde son téléphone, ferme la porte, tend un sac), ou son dernier geste : puis le Reel finit sur la couleur",
    ];
    const f = (b: number) => toFrame(b * beat);
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her title and its line on the colour of her opening, from its fourth image to her ground coming back.
      texts: { titre: { from: round(3 / 30), to: round((f(4) - GROUND_BEFORE) / 30) }, ligne: { from: round(3 / 30), to: round((f(4) - GROUND_BEFORE) / 30) } },
      marks: {
        ...Object.fromEntries(NEAR.map((b, k) => [`near_${k}`, f(b)])),
        ground: f(4) - GROUND_BEFORE,
        sky: f(5) + SKY_AFTER,
        ...Object.fromEntries(LANDS.map((b, k) => [`land_${k}`, f(b) + 1])),
        close_after: f(CLOSE_AFTER),
        ...Object.fromEntries(STYLES.map((b, k) => [`style_${k}`, f(photoBeat + b)])),
        red: f(photoBeat + FROZEN + LATER),
      },
      // Its walk and the one in front of a background are cut out (her silhouette, its shadow; them over the frozen world).
      cutouts: [0, count - 2],
      // Its music dips (its held note stopped, 6 dB down) in the last beat before beat 4 and before the frozen world, as
      // the original's (1,60 to 2,00 s and 5,43 to 5,92 s), and fades out in a tenth of a second at the end.
      music: {
        filters: [
          { kind: "soft", from: round3(3.15 * beat), to: round3(4 * beat), db: -6, open: 0.02 },
          { kind: "soft", from: round3(photo - beat), to: round3(photo), db: -6, open: 0.02 },
        ],
        end: { at: duration, fade: 0.1 },
      },
    };
  },
  code: CODE,
};
