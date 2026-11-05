import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Ville en coups de fouet », version 2, written again on its original's fiche (docs/fiches/coups-de-fouet.md: measured
// image by image at 30 i/s, its music and its sounds measured, the video watched and heard by Gemini; Tristan: « c'est
// un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A city in 23 shots on a cinematic pad at
// 84 BPM: every length below is in its beats from the Reel's start, so its cuts fall where the original's do (within two
// images), the four the original lays on a beat (a colour detail as the percussion comes in, a light, people passing,
// the jerky whip) on a beat of its music:
//   0 – 2,57   a shot already moving; a white flash; her name's shot, wide and calm, the name in very condensed white
//              capitals still in her sky (ClearBox) while the picture pushes in behind it, gone with the first whip flash
//              (two bright smeared images and a whoosh, the same insert at every whip flash, made of her sky);
//   to 12      the drumless part (its music muffled): a low angle in black and white pushing in, a shot that comes in
//              rushing and brakes on a detail, a calm bright shot after a flash, hard cuts in between;
//   to 18,2    a whip flash, the percussion comes in on a colour detail; someone passing in black and white with ghost
//              images between two flashes; her calm street and a light under the muffled music;
//   to 27,8    a whip flash, the percussion back on a tram rushing past; a wide shot pulling back after a flash, a counter
//              pushing in; the jerky whip (its images held two to five images, faded in and out); a façade that whitens
//              into the last whip flash; a sweep of the sky faster and faster into a flash;
//   the last   wide and calm, held 4,85 beats, its sound dying away over its last second.
// Fewer shots leave out shots of its middle (never its opening, its name, its signature shots nor its last), the four
// cuts on a beat kept on one. Played as the original, a horizontal 4:3 picture on black, when most of her files are
// horizontal (or she asks), else full frame (Tristan: « format par défaut [comme ses vidéos], et changement à la demande
// du user »). Its pushes, whips and flashes are its original's (Tristan: « on garde »); a photo stays still, a video plays.
// Nothing of its original's own is copied: its city's name is her place's, its insert her sky.

const BPM = 84;
/**
 * The original's 23 shots, in beats of its music one after the other from the Reel's start: their cuts on the original's
 * images 20, 55, 86, 106, 133, 160, 189, 226, 257, 274, 298, 330, 366, 390, 413, 438, 466, 494, 513, 543, 571 and 595
 * (within two images), the last held to its 23,3 s.
 */
const LENGTHS = [0.93, 1.64, 1.43, 0.95, 1.25, 1.27, 1.35, 1.73, 1.45, 0.8, 1.1, 1.5, 1.6, 1.2, 1.07, 1.18, 1.3, 1.25, 1, 1.33, 1.32, 1.12, 4.85];
/** Its roles left out first when her files give fewer shots, in this order (its opening, its name, its signature shots and its last stay). */
const LEFT_OUT = [4, 17, 7, 15, 11, 3, 18, 8, 16, 13, 20];
/** The roles whose cut the original lays on a beat: kept on one when shots before them are left out (the shot before them a little longer or shorter). */
const ON_BEAT = [9, 13, 18, 19];
/** The roles the music follows: the percussion comes in on the colour detail, stops under the calm street, comes back on the tram. */
const PERCUSSION = 9;
const CALM = 12;
const RETURN = 14;
/** Its name's shot, its first whip flash (two images, the second one on the cut). */
const NAME = 1;
const FIRST_WHIP = 2;
/** The image of her name's shot its whip flashes are made of (from that shot's start). */
const SKY_IMAGE = 10;
/** The shortest a shot may become when another is moved onto a beat (beats). */
const SHORTEST = 0.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The roles of n shots, in order: the original's 23, less the first ones its middle leaves out. */
export function fouetRoles(n: number): number[] {
  const count = Math.max(LENGTHS.length - LEFT_OUT.length, Math.min(LENGTHS.length, Math.round(n)));
  const out = new Set(LEFT_OUT.slice(0, LENGTHS.length - count));
  return LENGTHS.map((_, r) => r).filter((r) => !out.has(r));
}

/** Their lengths in beats: their own, the shot before one on a beat moved so it starts on the nearest whole beat. */
export function fouetBeats(roles: number[]): number[] {
  const beats: number[] = [];
  let at = 0;
  roles.forEach((r, i) => {
    if (i > 0 && ON_BEAT.includes(r)) {
      const moved = Math.round(at) - at;
      if (Math.abs(moved) > 1e-6 && beats[i - 1]! + moved >= SHORTEST) {
        beats[i - 1] = round(beats[i - 1]! + moved);
        at = Math.round(at);
      }
    }
    beats.push(LENGTHS[r]!);
    at += LENGTHS[r]!;
  });
  return beats;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

  // Its frame: a horizontal 4:3 picture on black, as the original, when most of her files are horizontal (or she asks),
  // else the whole vertical frame; every place below is in it.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 3) / 4) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const box = { position: "absolute", left: 0, top: 0, width: bw, height: bh };

  // The original's 23 shots by what each one does (each of her shots gets one, r0, r1…): how it comes in (0 a hard cut,
  // 1 a fade of two images, 2 and 3 a white flash of two or three images, 4 and 5 a whip flash of two or three images, 6
  // the last whip flash, of five images after a white that rises over four), and what plays in it (its push, its black
  // and white, its ghost images, its rush in, its whip out, its jerky whip).
  const ROLES = [
    { enter: 0 }, { enter: 2, push: 1.11 }, { enter: 4, mono: 1, push: 1.09 }, { enter: 0 }, { enter: 0 }, { enter: 0, land: 1 }, { enter: 2 }, { enter: 0 },
    { enter: 0 }, { enter: 5 }, { enter: 2, mono: 1, ghost: 1 }, { enter: 3 }, { enter: 0 }, { enter: 0 }, { enter: 4 }, { enter: 0 }, { enter: 3, push: 0.94 },
    { enter: 0, push: 1.065 }, { enter: 0 }, { enter: 1, jerk: 1 }, { enter: 1 }, { enter: 6, leave: 1 }, { enter: 2 },
  ];
  const role = (i) => Math.max(0, Math.min(ROLES.length - 1, Math.round(mark("r" + i, i))));
  // A shot that comes in on a hard cut takes the flash or the fade of the shots the Reel left out just before it.
  const entry = (i) => {
    if (i <= 0 || i >= n) return 0;
    const own = ROLES[role(i)].enter;
    if (own) return own;
    let most = 0;
    for (let r = role(i - 1) + 1; r < role(i); r++) most = Math.max(most, ROLES[r].enter);
    return most;
  };
  const at = (i) => (shots[i] ? shots[i].from : durationInFrames);
  const local = (i) => Math.max(0, Math.min(Math.max(0, shots[i].durationInFrames - 1), frame - shots[i].from));
  const video = (i) => Boolean(shots[i]) && shots[i].kind !== "photo";

  // A motion blur along a direction (CSS degrees from the horizontal): an SVG blur in a turned box, its id this image's.
  const D = Math.ceil(Math.hypot(bw, bh));
  const smear = (node, sigma, angle, key) => {
    if (!(sigma > 0.5)) return node;
    const id = "cdf-" + key + "-" + frame;
    return h("div", { key, style: box },
      h("svg", { width: 0, height: 0, style: { position: "absolute" } },
        h("filter", { id, x: "-10%", y: "-10%", width: "120%", height: "120%", colorInterpolationFilters: "sRGB" }, h("feGaussianBlur", { stdDeviation: sigma.toFixed(1) + " 0" }))),
      h("div", { style: { position: "absolute", left: Math.round((bw - D) / 2), top: Math.round((bh - D) / 2), width: D, height: D, transform: "rotate(" + angle + "deg)", filter: "url(#" + id + ")" } },
        h("div", { style: { position: "absolute", left: Math.round((D - bw) / 2), top: Math.round((D - bh) / 2), width: bw, height: bh, transform: "rotate(" + -angle + "deg)" } }, node)));
  };
  // One of her shots in its frame: as it plays, or one of its images held (still: its image from the shot's start).
  const footage = (i, style, still) => h(Footage, { shot: i, style: { ...box, ...style }, ...(still === undefined ? {} : { at: frame - still }) });
  // Her shot as it moves on, copies of it side by side, every other one turned over, so nothing shows behind it.
  const strip = (i, x, copies, style, still) => h("div", { style: { ...box, ...style, transform: "translate(" + Math.round(x) + "px, 0px)" + (style && style.transform ? " " + style.transform : "") } },
    Array.from({ length: copies }, (_, c) => h("div", { key: c, style: { ...box, left: c * bw, transform: c % 2 ? "scaleX(-1)" : "none" } }, footage(i, {}, still))));

  // Her shot at this image, as its role plays it.
  const MONO = "grayscale(1) contrast(1.3)";
  const HOLDS = [3, 5, 3, 2, 3, 4, 4, 2, 2];
  const pic = (i) => {
    if (!shots[i]) return null;
    const r = ROLES[role(i)];
    const moving = video(i);
    const t = local(i);
    const len = Math.max(1, shots[i].durationInFrames);
    const tone = r.mono ? { filter: MONO } : {};
    // Its push from the centre, steady over the shot (the original's ×1,11 behind the name, ×1,09, ×1,065, and ×0,94 back).
    const push = moving && r.push ? Math.pow(r.push, t / len) / Math.min(1, r.push) : 1;
    const pushed = Math.abs(push - 1) > 1e-4 ? { transform: "scale(" + push.toFixed(4) + ")" } : {};
    if (moving && r.ghost) {
      // Its images of 3, 6 and 9 images before kept in transparency, fainter and fainter: what moves leaves ghosts and
      // trails, the rest stays sharp.
      const echo = (d, o) => footage(i, { opacity: o }, Math.max(0, t - d));
      return h("div", { style: { ...box, ...tone } }, echo(9, 1), echo(6, 0.565), echo(3, 0.49), echo(0, 0.55));
    }
    if (moving && r.jerk) {
      // The jerky whip: each image held 2 to 5 images as the original's (about ten a second), and at each one another
      // part of the picture (or of its copy turned over), thrown along a slant then flat, heavily blurred.
      let held = 0;
      let step = 0;
      while (held + HOLDS[step % HOLDS.length] <= t) { held += HOLDS[step % HOLDS.length]; step++; }
      const slant = step < 5 ? -25 : 0;
      const x = -(1.3 * (step % 2) - 0.15 + 0.3 * ((step * 0.618) % 1)) * bw;
      const y = (step % 2 ? -0.06 : 0.06) * bh * (slant ? 1 : 0.3);
      return smear(strip(i, x, 2, { transform: "translateY(" + Math.round(y) + "px) scale(1.3)", transformOrigin: "50% 50%" }, held), 62, slant, "j" + i);
    }
    if (moving && r.land && t < 12) {
      // It comes in already moving, the camera rushing left, and brakes onto its detail over 12 images (the original's 133 to 145).
      const p = 1 - t / 12;
      return smear(strip(i, -0.64 * bw * p * p * p, 2), 0.35 * 0.16 * bw * p * p, 0, "l" + i);
    }
    if (moving && r.leave && t >= len - 11) {
      // It sweeps on to the right faster and faster, into the flash of the next shot (the original's 584 to 594).
      const u = Math.min(1, (t - (len - 11)) / 10);
      return smear(strip(i, -1.03 * bw * u * u * u, 3), 0.35 * 0.31 * bw * u * u, 0, "v" + i);
    }
    return footage(i, { ...tone, ...pushed });
  };

  // The whip flash: the same two bright smeared images every time, as the original's (a ready-made bit of whip pan, never
  // a move between the two shots): the sky and the roofs of her name's shot, thrown to the right along a slant, lit up.
  const SKY = Math.max(0, Math.min(n > 1 ? shots[1].durationInFrames - 1 : 0, Math.round(mark("sky", 10))));
  const flung = (j) =>
    smear(
      h("div", { style: { ...box, transform: "translate(" + Math.round((j ? 0.14 : -0.1) * bw) + "px, " + Math.round((j ? -0.04 : 0.02) * bh) + "px) scale(1.6)", transformOrigin: "50% 30%", filter: "brightness(1.6) saturate(0.75)" } }, footage(Math.min(1, n - 1), {}, SKY)),
      j ? 58 : 44,
      -12,
      "w" + j,
    );

  // What its frame shows at this image: her shot (the one before it too, through a fade), or a whip flash, under a white flash.
  let insert = null;
  let veil = 0;
  for (let k = 1; k < n; k++) {
    const e = entry(k);
    const d = frame - at(k);
    if (e >= 4) {
      const from = e === 6 ? -2 : -1;
      const to = e === 6 ? 2 : e === 5 ? 1 : 0;
      if (d >= from && d <= to) {
        insert = flung(d < 0 ? 0 : 1);
        // As light as the original's (its two images at 166 and 181 of 255 on average, its shots around them 40 to 115).
        veil = Math.max(veil, e === 6 ? [0.72, 0.55, 0.45, 0.4, 0.36][d + 2] : d < 0 ? 0.36 : 0.44);
      }
      // The last one: the shot before it whitens over its last four images first (the original's 565 to 568).
      if (e === 6 && d >= -6 && d <= -3) veil = Math.max(veil, [0.1, 0.2, 0.32, 0.45][d + 6]);
    } else if (e === 2 || e === 3) {
      // The shot before it lit up an image or two, then a plain white image over the next one (it shows through), then the next one at its light.
      veil = Math.max(veil, d === 0 ? 0.9 : d === -1 ? (e === 3 ? 0.38 : 0.3) : d === -2 && e === 3 ? 0.2 : 0);
    }
  }
  const fading = cur > 0 && entry(cur) === 1 && frame - at(cur) < 2;
  const film = insert || (fading ? h("div", { style: box }, pic(cur - 1), h("div", { style: { ...box, opacity: (frame - at(cur) + 1) / 3 } }, pic(cur))) : pic(cur));
  // Its film grade, held as the original's: the whites kept low (its brightest images at 206 to 217 of 255, a flash
  // 217), the middle as filmed; the Reel's finish then lays its contrast, its colours and its corners over it.
  const grade = h("svg", { width: 0, height: 0, style: { position: "absolute" } },
    h("filter", { id: "cdf-film", x: "0", y: "0", width: "100%", height: "100%", colorInterpolationFilters: "sRGB" },
      h("feComponentTransfer", null, ["feFuncR", "feFuncG", "feFuncB"].map((f) => h(f, { key: f, type: "table", tableValues: "0 0.25 0.5 0.69 0.81" })))));
  const picture = h("div", { style: { ...box, filter: "url(#cdf-film)" } }, film, veil > 0 ? h("div", { style: { ...box, background: "#ffffff", opacity: veil } }) : null);

  // Her name: very condensed white capitals, there at once on the white flash, still while the picture pushes in behind
  // it, gone with the whip flash; a hair of shade only (the original's has none: her sky may be paler than its grey one).
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const display = "'" + brand.displayFont + "', 'Big Shoulders Display', 'Oswald', 'Arial Narrow', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter', sans-serif";
  const shade = "0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.22)";
  const name = hook ? keep(hook.text).toUpperCase() : "";
  // Its capitals about 15 % of the 4:3 picture's height, as the original's (the same in the vertical frame, whose width it
  // shares), 800 px wide at most: a long name stays clear of the apps' buttons.
  const SIZE = 150;
  const nameW = Math.min(800, Math.round(Math.max(4, Array.from(name).length) * SIZE * 0.47));
  const nameH = Math.round(SIZE * 1.08);
  const centre = { x: Math.round((bw - nameW) / 2), y: Math.round(bh * (wide ? 0.5 : 0.38) - nameH / 2), w: nameW, h: nameH };
  // In her sky: the largest clear area of her name's shot, read on its first image and kept there (the name does not move
  // while the picture pushes in), down to half its size (the original's fills 27 % of the width); the middle of the
  // picture when it has none.
  const spot = ClearBox(shots[1], n > 1 ? shots[1].from : 0, laid, { aspect: nameW / nameH, min: { w: Math.round(nameW * 0.5), h: Math.round(nameH * 0.5) }, max: { w: nameW, h: nameH }, origin: { x: 0, y: by }, fallback: centre }) || centre;
  const fit = Math.min(1, spot.h / nameH);
  const title = hook && frame >= hook.from && frame < hook.to
    ? h(FitText, { key: "title", style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(spot.h) }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: Math.round(SIZE * fit), lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade } }, name)
    : null;

  // An ending card when she has one (the original has none): its words in the name's capitals over her last shot, held.
  const endAt = end ? end.from : durationInFrames + 1;
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], clamp);
  const mid = Math.round(bh / 2);
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h("div", { style: { ...box, background: "#000000", opacity: 0.28 * o(endAt, endAt + 8) } }),
        h(FitText, { style: { position: "absolute", left: 140, top: mid - (end.subtitle ? 190 : 110), width: bw - 280, height: 180 }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 128, lineHeight: 0.98, letterSpacing: "-0.01em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "normal", textWrap: "balance", textAlign: "center", textShadow: shade, justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", { style: { opacity: o(endAt, endAt + 5) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: mid + 10, width: bw - 280, height: 140 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.22, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: shade } },
              h("span", { style: { opacity: o(endAt + 5, endAt + 12) } }, keep(end.subtitle)))
          : null)
    : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, grade, picture, title, ending);

  // Any other text of the Reel (none in its slots): a plain white line, above its frame in width, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.max(100, by - 130 - i * 120) : 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

/** What each role wants of her files, for the filler (French). */
const WANTS = [
  "le plan qui ouvre, bref, qui défile déjà : un tram, un bus, une rue filmée en marchant vite, quelque chose qui passe tout près",
  "un plan large et calme de sa rue, de sa façade ou de son quartier, avec du ciel au-dessus des toits : son nom s'y pose, immobile, pendant que l'image avance doucement",
  "une contre-plongée : une façade, un immeuble, une tour ou un arbre vu d'en bas (en noir et blanc)",
  "quelqu'un qui marche, que la caméra suit : un passant, un client, quelqu'un de son équipe",
  "un détail vivant devant une façade : un oiseau, un drapeau, un store, une enseigne qui bouge",
  "un plan qui démarre en balayant vite puis s'arrête sur un détail : son enseigne, une lampe, un produit (il arrive en filant et freine)",
  "un plan calme et lumineux : un arbre ou une façade contre le ciel, la lumière dans les feuilles ou sur une vitre",
  "quelqu'un à vélo, à trottinette ou qui marche vite, filmé de près, en mouvement",
  "un détail plus sombre et calme : des feuilles, une ombre, une vitrine, quelque chose qui tombe ou qui passe",
  "un détail de couleur franche, de près : sa devanture, un tram, un vélo coloré, un produit (la musique repart sur ce plan)",
  "quelqu'un qui passe, de dos ou à vélo (en noir et blanc, avec des images fantômes derrière ce qui bouge)",
  "quelqu'un de dos dans la rue, qui marche ou attend, des passants, quelque chose qui passe derrière",
  "sa rue calme, sous les arbres ou au soleil : le plan le plus tranquille du Reel (la musique se tait presque)",
  "un plan fixe où quelque chose se détache devant un grand bâtiment : un feu, un lampadaire, une enseigne",
  "un plan qui défile très vite : un tram, un métro, un bus ou une voiture qui passe tout près (la musique revient)",
  "un plan en mouvement, penché ou de l'intérieur : dans le tram, dans sa boutique, dans sa salle",
  "un plan large et fixe : un pont, une place, la vue de sa rue (l'image recule doucement)",
  "un plan à contre-jour ou de près : un étal, un comptoir, une terrasse, ce qu'elle vend (l'image avance doucement)",
  "du monde qui passe : un passage piéton, des vélos, des passants, une rue animée",
  "un mouvement de caméra rapide et flou : un balayage des arbres, du ciel ou des murs (il passe en saccades)",
  "une façade en contre-plongée, la caméra qui glisse le long : brique, pierre, sa devanture",
  "un balayage rapide des toits et du ciel, téléphone levé, qui file de plus en plus vite",
  "le plan qui finit le Reel, tenu longtemps : large et calme (un ciel, un coucher de soleil, une vue), 4 secondes au moins",
];

export const coupsDeFouet: MontageSkill = {
  key: "coups-de-fouet",
  // 2: written again on its original's fiche (its format, its 84 BPM and its 23 cuts, its whip flashes made of her sky,
  // its flashes, its name still in her sky while the picture pushes in, its black and white, its ghost images, its rush
  // in and its sweep out, its jerky whip and its fades, its music muffled where its percussion is silent, its whoosh and
  // its thud, its sound dying away, its whites held low and no grain).
  version: 2,
  bpm: BPM,
  shots: [12, 23],
  files: [6, 16],
  how: "Une ville en coups de fouet, en horizontal 4:3 comme l'original quand ses vidéos le sont : un plan qui défile déjà, un flash blanc, puis son nom en capitales blanches très condensées posé, immobile, dans le ciel d'un plan large qui avance doucement ; puis des plans d'une seconde environ, enchaînés par des coupes franches, des flashs blancs et des fouets éclair (deux images floues et claires de son ciel) : une contre-plongée en noir et blanc, un plan qui arrive en filant et freine sur un détail, la musique qui repart sur un détail de couleur, quelqu'un qui passe en noir et blanc avec des images fantômes, sa rue calme sous la musique étouffée, un tram qui file quand elle revient, un fouet saccadé, un balayage du ciel de plus en plus vite ; et un dernier plan large et calme tenu jusqu'à la fin, le son qui s'éteint.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "le nom du lieu posé dans le ciel du deuxième plan, en capitales sur une ligne : son quartier, sa ville ou le nom de son lieu, 1 à 3 mots",
      max: 18,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal 4:3 comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
        { value: "horizontal", says: "horizontal 4:3 sur du noir, comme l'original" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
  ],
  // Its original's grade (docs/fiches/coups-de-fouet.md, effect 10): no grain (« pas de grain mesurable »); its code holds the whites low itself.
  finish: { grain: 0 },
  timeline(n, options) {
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const roles = fouetRoles(n);
    const spans = beatSpans(bpm, fouetBeats(roles));
    const duration = spans.at(-1)!.end;
    const start = (r: number) => spans[roles.indexOf(r)]!.start;
    const frame = 1 / 30;
    // Her name from the white flash to the whip flash that takes it away (the original's images 20 to 53).
    const named = { from: start(NAME), to: round(start(FIRST_WHIP) - frame) };
    return {
      duration,
      // Its music muffled where the original's percussion is silent (a pad alone until the colour detail, then under the
      // calm street until the tram), opening on those cuts; it dies away over the last second, the picture held.
      music: {
        filters: [
          { kind: "muffled", from: 0, to: start(PERCUSSION) },
          { kind: "muffled", from: start(CALM), to: start(RETURN) },
        ],
        end: { at: duration, fade: 1 },
      },
      shots: spans.map((s, i) => ({ ...s, want: WANTS[roles[i]!]! })),
      texts: { titre: named },
      marks: {
        // The image of her name's shot its whip flashes are made of, within it.
        sky: Math.max(0, Math.min(SKY_IMAGE, toFrame(spans[NAME]!.end - spans[NAME]!.start) - 1)),
        ...Object.fromEntries(roles.map((r, i) => [`r${i}`, r])),
      },
      // Its original's own: a dull thud as its name appears (the metro's noise cut on it), a whoosh rising into its first whip flash only.
      sounds: [
        { at: start(NAME), sound: "deep soft thud", seconds: 0.6 },
        { at: round3(start(FIRST_WHIP) - frame), sound: "quick air whoosh", seconds: 0.5 },
      ],
    };
  },
  code: CODE,
};
