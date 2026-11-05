import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Recette cosy, typo pixel », the effect (docs/fiches/pixel.md, effects 2 to 6; its whole Reel is skills/pixel.ts):
// over a run of her shots, the first one her finished result seen from above, her title in pixels lands at once on its
// fifth image (nothing typed nor lit), pale mint with a thin dark grey-green edge all round and no shadow, in lower case
// on two lines balanced by their letters, centred on the calmest part of the upper third of her result (ClearBox, any
// calm area: her dark worktop, a plain wall), a little face « (๑˃ᴗ˂) » raised before it and an outlined star after it,
// two tiny typewriter lines with it when she has them; it holds at least a second and a third, to the cut it leaves on.
// Then her steps, the shots after it: each with its tiny caption in a plain sans, set on its first cut and gone with its
// last (a caption for a step of up to three shots when there are fewer captions than shots, as the original's steps of
// several gestures), in a calm, empty part of the step's first shot as the original's (ClearBox: the plate behind, her
// wall), else in one of the original's places in turn, its ink dosed to the light under it (LightUnder: white on a dark
// or mid ground as the original's, a dark ink on her pale wall or her batter, where white got lost); a step without words
// gets the shy little face « (´•ω•`) » alone at the middle, or two pairs of outlined stars in opposite corners (its tiny
// lines with the title dosed the same way). Everything trembles, six times a second: every 5 images from its own
// arrival, each letter, each star and each face drawn again with its own small tilt and a shift of a pixel or two, its
// first pose straight; nothing blinks, nothing lights up, nothing moves on her shots. Then the montage takes over. Kept
// of its skill: its title (its font at 89 px, its mint and its edge, its place and its two lines, its face and its
// star), its tremble, its tiny lines, its captions (their font, size and places) and its decor. Left: its 26
// gestures and their timing (the editor cuts her steps), its loop and its ending card, its music's rest and its bass, its
// format, its grade, her name in small (the original's @). Its tiny step captions are decor, as the original's (29 px, as
// Tristan allows for decor: « exception » to the 48 px of what reads); its tiny lines with the title are short labels
// beside a title that reads. Its fonts are its own (Pixelify Sans, Courier Prime, Inter), its mint unless her words ask
// for her charter's colour. No sound: the original has none (its knife and its boiling water are its videos' own).

/** Her title lands on this image of her result (before the original's first note). */
const TITLE_AT = 5;
/** Her title stays at least this long (frames), to the first cut after. */
const TITLE_LEAST = 40;
/** A caption holds over this many of her shots at most (a step of several gestures). */
const STEP_SHOTS = 3;

/** Her step captions, as its code reads them: her words between « / » (or « | », a new line), in order. */
export const pixelCaptions = (text: string | undefined) =>
  (text ?? "")
    .trim()
    .split(/\s*[/|\n]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Its moments for a span (frames from its start): her title from its landing to the cut it leaves on (the first at
 * least TITLE_LEAST images after it, or its end), and her steps, the shots after it, each with the caption it gets
 * (its index among her captions) or none (-1: its decor).
 */
export function pixelSteps(input: Pick<PieceTimelineInput, "frames" | "shots">, captions: number): { title: number; titleTo: number; steps: { from: number; to: number; caption: number }[] } {
  const cuts = [...input.shots]
    .sort((a, b) => a.from - b.from)
    .slice(1)
    .map((s) => Math.round(s.from))
    .filter((f, i, all) => f > 0 && f < input.frames && all.indexOf(f) === i);
  const titleTo = cuts.find((f) => f >= TITLE_AT + TITLE_LEAST) ?? input.frames;
  const starts = cuts.filter((f) => f >= titleTo);
  const shots = starts.map((from, k) => ({ from, to: starts[k + 1] ?? input.frames }));
  // Her shots shared out among her captions in order, as evenly as they go (the first ones a shot more), three at most
  // each; the shots left over get her decor, each its own.
  const groups = Math.min(captions, shots.length);
  const sizes = Array.from({ length: groups }, (_, k) => Math.min(STEP_SHOTS, Math.floor(shots.length / groups) + (k < shots.length % groups ? 1 : 0)));
  const steps: { from: number; to: number; caption: number }[] = [];
  let next = 0;
  sizes.forEach((size, caption) => {
    steps.push({ from: shots[next]!.from, to: shots[next + size - 1]!.to, caption });
    next += size;
  });
  for (const s of shots.slice(next)) steps.push({ ...s, caption: -1 });
  return { title: TITLE_AT, titleTo, steps };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return texts && texts[k] !== undefined && Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const laid = { left: 0, top: 0, width, height };
  const X = (p) => Math.round(width * p);
  const Y = (p) => Math.round(height * p);
  // Its shots: those that play during it, in order; the first one is her finished result.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  const drawn = [];
  if (mine.length) {
    const result = mine[0];
    const BOIL = 5;
    // Its moments (frames, its timeline's marks): her title from its landing to the cut it leaves on (to its end without
    // its marks); her steps after it, each with the caption it gets (its index among her captions) or her decor (-1).
    const TITLE_AT = ${TITLE_AT};
    const TITLE_TO = Math.round(mark("title_to", durationInFrames));
    const captions = word("etapes").split(/\s*[\/|\n]\s*/).map((s) => s.trim()).filter(Boolean);
    const steps = Array.from({ length: Math.max(0, Math.min(24, Math.round(mark("steps", 0)))) }, (_, k) => ({ from: Math.round(mark("step_" + k, 0)), to: Math.round(mark("step_" + k + "_to", 0)), caption: Math.round(mark("step_" + k + "_say", -1)) }))
      .filter((s) => s.to > s.from)
      .map((s) => (s.caption >= 0 && !captions[s.caption] ? { ...s, caption: -1 } : s));

    // Its three faces: its title in pixels (Pixelify Sans), its tiny lines in a typewriter (Courier Prime), its captions
    // in a plain sans (Inter). Its title pale mint with a thin dark grey-green edge all round and no shadow (her
    // charter's main colour when her words ask for it, its edge then the ink that reads on it); its tiny lines and
    // drawings white, with a tight dark edge of their own that a dark ground never shows.
    const pixel = "'Pixelify Sans', '" + brand.displayFont + "', monospace";
    const typewriter = "'Courier Prime', '" + brand.bodyFont + "', monospace";
    const plain = "'Inter', '" + brand.bodyFont + "', 'Helvetica Neue', Arial, sans-serif";
    const charter = setting("couleur", "menthe") === "charte" && brand.accent;
    const FILL = charter ? brand.accent : "#d4f7e9";
    const EDGE = charter ? brand.accentInk || "#2c4741" : "#2c4741";
    const CREAM = "#fff8e8";
    const titleEdge = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]].map((d) => d[0] + "px " + d[1] + "px 0 " + EDGE).join(", ");
    const thin = "0 0 1px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.45), 0 1px 6px rgba(0,0,0,0.3)";
    const shade = "drop-shadow(0 0 1px rgba(0,0,0,0.7)) drop-shadow(0 0 3px rgba(0,0,0,0.35))";
    const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");

    // 1. Everything trembles, six times a second: every 5 images from its own arrival, each letter (each star, each
    // little face) is drawn again with its own small tilt, 2 to 6 degrees mostly (10 at most), and a shift of a pixel or
    // two, held until the next; its first pose straight. Nothing blinks, nothing lights up.
    const graphemes = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
    const wobble = (seed, since) => {
      const k = Math.floor(since / BOIL);
      if (!(k >= 1)) return undefined;
      const r = (x) => random(x + k + "-" + seed + "-pixel");
      const deg = (r("s") < 0.5 ? -1 : 1) * (2 + 4 * r("a") + (r("b") > 0.9 ? 4 * r("c") : 0));
      const dx = (r("x") * 2 - 1) * 2;
      const dy = (r("y") * 2 - 1) * 2;
      return "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px) rotate(" + deg.toFixed(1) + "deg)";
    };
    // A text laid out whole from its arrival, word by word (never broken inside one), each letter trembling on its own.
    const boiled = (text, seed, since) => String(text).split(/([ \t\n]+)/).map((w, i) =>
      !w || /^[ \t\n]+$/.test(w)
        ? w
        : h("span", { key: i, style: { whiteSpace: "nowrap" } },
            graphemes(w).map((c, j) => h("span", { key: j, style: { display: "inline-block", transform: wobble(j + "-" + i + "-" + seed, since) } }, c))));

    // Its drawings, white and thin, decor: the little face before its title, the shy one alone on a step, an outlined star.
    const line = (w) => ({ fill: "none", stroke: "#ffffff", strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" });
    const happy = (w) => h("svg", { width: w, height: Math.round(w / 3), viewBox: "0 0 90 30", style: { display: "block", overflow: "visible", filter: shade } },
      h("g", line(2.4),
        h("path", { d: "M7 1 Q1 15 7 29" }),
        h("path", { d: "M23 13 Q23 8 18.5 8 Q14 8 14 13.5 Q14 19 19 19 Q23.5 19 23 15 Q22.5 12.5 19.5 13.5" }),
        h("path", { d: "M29 9 L35 12.5 L29 16" }),
        h("path", { d: "M39 13 Q39 21 45.5 21 Q52 21 52 13" }),
        h("path", { d: "M62 9 L56 12.5 L62 16" }),
        h("path", { d: "M71 1 Q77 15 71 29" })));
    const shy = (w) => h("svg", { width: w, height: Math.round((w * 30) / 110), viewBox: "0 0 110 30", style: { display: "block", overflow: "visible", filter: shade } },
      h("g", line(2.4),
        h("path", { d: "M7 1 Q1 15 7 29" }),
        h("path", { d: "M17 8 L23 3" }),
        h("path", { d: "M40 13 Q40 21 46.5 21 Q53 21 53 14 Q53 21 59.5 21 Q66 21 66 13" }),
        h("path", { d: "M83 3 L89 8" }),
        h("path", { d: "M103 1 Q109 15 103 29" })),
      h("circle", { cx: 30, cy: 14, r: 3.4, fill: "#ffffff" }),
      h("circle", { cx: 76, cy: 14, r: 3.4, fill: "#ffffff" }));
    const star = (s) => h("svg", { width: s, height: s, viewBox: "0 0 40 40", style: { display: "block", overflow: "visible", filter: shade } },
      h("path", { d: "M20 2.5 L24.9 14.6 L37.8 15.3 L27.8 23.5 L31.1 36 L20 28.9 L8.9 36 L12.2 23.5 L2.2 15.3 L15.1 14.6 Z", ...line(2.2) }));
    const decor = (key, x, y, child, since) => h("div", { key, "data-fauve-decor": "", style: { position: "absolute", left: x, top: y, transform: wobble(key, since) } }, child);
    // Two outlined stars, a small one and a larger one on a rising diagonal, each trembling on its own.
    const pair = (key, x, y, big, little, since) =>
      h("div", { key, "data-fauve-decor": "", style: { position: "absolute", left: x, top: y, width: Math.round(little * 0.9 + big), height: Math.round(big + little * 0.4) } },
        h("div", { style: { position: "absolute", left: 0, top: Math.round(big - little * 0.6), transform: wobble("a-" + key, since) } }, star(little)),
        h("div", { style: { position: "absolute", left: Math.round(little * 0.9), top: 0, transform: wobble("b-" + key, since) } }, star(big)));

    // 2. Her title in pixels on her result, at once on its fifth image, nothing typed nor lit, gone with the cut: in
    // lower case on two lines balanced by their letters, 89 px (the original's letters, its lines 5,5 % of the frame
    // apart), centred, set on the calmest part of the upper third of her result (her dark worktop, a plain wall, at its
    // size or nearly), else at the original's place (centred at 34 % of the height); its little face raised before its
    // first letter and its star after its last, outside its centred lines.
    const title = word("titre");
    if (title && frame >= TITLE_AT && frame < TITLE_TO) {
      const SIZE = 89;
      const TW = X(0.72);
      const TH = Math.round(SIZE * 1.19) * 2 + Math.round(SIZE * 0.36);
      const middle = { x: Math.round((width - TW) / 2), y: Y(0.343) - Math.round(TH / 2), w: TW, h: TH };
      const spot = ClearBox(shots[result], frame, laid, { aspect: TW / TH, min: { w: Math.round(TW * 0.85), h: Math.round(TH * 0.85) }, max: { w: TW, h: TH }, sky: false, within: { x: X(0.08), y: Y(0.155), w: X(0.84), h: Y(0.315) }, pad: 6, fallback: middle }) || middle;
      const since = frame - TITLE_AT;
      const size = Math.round(SIZE * Math.min(1, spot.h / TH, spot.w / TW));
      const words = keep(title).split(/[ \t\n]+/).filter(Boolean);
      let split = 1;
      for (let k = 1, best = Infinity; k < words.length; k++) {
        const longest = Math.max(words.slice(0, k).join(" ").length, words.slice(k).join(" ").length);
        if (longest < best) { best = longest; split = k; }
      }
      const lines = words.length > 1 ? [words.slice(0, split).join(" "), words.slice(split).join(" ")] : [words.join(" ")];
      const face = h("span", { key: "face", "data-fauve-decor": "", style: { display: "inline-block", position: "relative", width: 0, height: 0, verticalAlign: "top" } },
        h("span", { style: { position: "absolute", right: Math.round(size * 0.14), top: -Math.round(size * 0.06), transform: wobble("face", since) } }, happy(Math.round(size * 0.92))));
      const after = h("span", { key: "star", "data-fauve-decor": "", style: { display: "inline-block", position: "relative", width: 0, height: 0 } },
        h("span", { style: { position: "absolute", left: Math.round(size * 0.31), top: -Math.round(size * 0.56), transform: wobble("star", since) } }, star(Math.round(size * 0.53))));
      drawn.push(h(FitText, { key: "title", style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(spot.h) }, innerStyle: { fontFamily: pixel, fontWeight: 500, fontSize: size, lineHeight: 1.19, color: FILL, textShadow: titleEdge, textAlign: "center" } },
        h("div", null, lines.map((l, i) => h("div", { key: i, style: { whiteSpace: "nowrap" } }, i === 0 ? face : null, boiled(l, "title-" + i, since), i === lines.length - 1 ? after : null)))));
    }

    // A tiny line in a box, aligned on its side: the typewriter of the lines with the title, or the plain sans of the
    // captions; 30 px, a short label beside a title that reads (accent), or her step's caption (decor, as the original's).
    // Its ink dosed to the light under it, read on her shot over its passage: white (cream for the typewriter) with a
    // tight dark edge on a dark or mid ground, as the original's, a dark ink with a tight light edge on a pale one (her
    // wall, her batter), so it never gets lost; white without a reading.
    const inkUnder = (i, box) => {
      const light = i === undefined ? null : LightUnder(shots[i], Math.max(0, shots[i].from), laid, box);
      return light && light.mean > 0.42 ? { color: "#231a14", textShadow: "0 0 1px rgba(255,255,255,0.8), 0 0 3px rgba(255,255,255,0.45)" } : null;
    };
    const tiny = (key, text, box, align, face, since, mode, ink) => h(FitText, { key, style: { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h }, innerStyle: { alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center", textAlign: align, fontFamily: face, fontWeight: face === plain ? 500 : 400, fontSize: face === plain ? 29 : 30, lineHeight: 1.3, color: face === plain ? "#ffffff" : CREAM, textShadow: thin, whiteSpace: "nowrap", ...(ink || {}) } },
      h("span", mode === "decor" ? { "data-fauve-decor": "" } : { "data-fauve-accent": "" }, boiled(keep(text), key, since)));

    // 3. Its two tiny typewriter lines with the title, its words cut at their comma: the first on the left at mid-height
    // (on the rim of the original's bowl), the second low on the right, just above the apps' caption.
    const small = word("petit_mot");
    if (small && frame >= TITLE_AT && frame < TITLE_TO) {
      const m = /^(.*?\S)\s*[,\/;]\s*(\S.*)$/.exec(small);
      const since = frame - TITLE_AT;
      const b1 = { x: X(0.136), y: Y(0.513), w: X(0.52), h: Y(0.032) };
      const b2 = { x: X(0.3), y: Y(0.71), w: X(0.522), h: Y(0.032) };
      drawn.push(tiny("o1", m ? m[1] : small, b1, "left", typewriter, since, "accent", inkUnder(result, b1)));
      if (m) drawn.push(tiny("o2", m[2], b2, "right", typewriter, since, "accent", inkUnder(result, b2)));
    }

    // 4. Her steps: each caption from its step's first cut to its last, in a calm, empty part of the step's first shot
    // (ClearBox, any calm area, its upper part first: on the plate behind, on her worktop, as the original's), else in one
    // of the original's places in turn (upper left on what is prepared, two centred lines under it, high on the left, at
    // the middle); every one in the page all along, only the current one seen (a box measures its words once). A step
    // without words: the shy little face alone at the middle, or two pairs of outlined stars in opposite corners, in turn.
    const two = (s) => {
      const words = s.split(/\s+/).filter(Boolean);
      if (words.length < 4) return [s];
      const half = s.length / 2;
      let best = -1;
      for (let i = s.indexOf(","); i >= 0; i = s.indexOf(",", i + 1)) if (best < 0 || Math.abs(i - half) < Math.abs(best - half)) best = i;
      if (best > 0 && best < s.length - 2) return [s.slice(0, best + 1).trim(), s.slice(best + 1).trim()];
      const k = Math.ceil(words.length / 2);
      return [words.slice(0, k).join(" "), words.slice(k).join(" ")];
    };
    const PLACES = [
      { x: X(0.254), y: Y(0.312), w: X(0.62), align: "left" },
      { x: X(0.14), y: Y(0.672), w: X(0.72), align: "center", lines: true },
      { x: X(0.14), y: Y(0.192), w: X(0.7), align: "left" },
      { x: X(0.18), y: Y(0.484), w: X(0.64), align: "center" },
    ];
    const LINE = Y(0.032);
    const GAP = Y(0.033);
    let bare = 0;
    steps.forEach((s, k) => {
      const on = frame >= s.from && frame < s.to;
      if (s.caption >= 0) {
        const place = PLACES[s.caption % PLACES.length];
        const text = captions[s.caption];
        const parts = place.lines ? two(text) : [text];
        // Its step's first shot, and the calm stretch its caption sits in the middle of there (a third of the frame wide
        // at least, kept for the whole step); its lines centred in it.
        const first = mine.find((i) => Math.round(shots[i].from) === s.from);
        const tall = LINE + (parts.length - 1) * GAP;
        const calm = first === undefined ? null : ClearBox(shots[first], Math.max(0, shots[first].from), laid, { min: { w: X(0.33), h: tall }, max: { w: place.w, h: Math.round(tall * 1.6) }, sky: false, within: { x: X(0.13), y: Y(0.1), w: X(0.74), h: Y(0.62) }, pad: 10 });
        const spot = calm ? { x: calm.x, y: calm.y + (calm.h - tall) / 2, w: calm.w, h: tall } : { x: place.x, y: place.y, w: place.w, h: tall };
        const ink = inkUnder(first, spot);
        drawn.push(h("div", { key: "c" + k, style: { opacity: on ? 1 : 0 } },
          parts.map((l, j) => tiny("c" + k + "-" + j, l, { x: Math.round(spot.x), y: Math.round(spot.y) + j * GAP, w: Math.round(spot.w), h: LINE }, place.align, plain, frame - s.from, "decor", ink))));
        return;
      }
      const shyOne = bare++ % 2 === 0;
      if (!on) return;
      if (shyOne) drawn.push(decor("shy" + k, X(0.454), Y(0.492), shy(98), frame - s.from));
      else drawn.push(h(React.Fragment, { key: "st" + k }, pair("st1-" + k, X(0.125), Y(0.185), 48, 30, frame - s.from), pair("st2-" + k, X(0.762), Y(0.712), 38, 24, frame - s.from)));
    });
  }
  return h(AbsoluteFill, { style: { pointerEvents: "none", overflow: "hidden" } }, ...drawn);
}`;

export const pixel: EffectPiece = {
  key: "pixel",
  version: 1,
  name: "Recette cosy, typo pixel",
  how: "son titre en pixels vert d'eau, avec un petit visage devant et une étoile après, se pose d'un coup sur son résultat fini vu d'en haut, deux toutes petites lignes en machine à écrire avec lui ; puis chaque étape a sa toute petite légende, ou un petit visage, ou des étoiles dans les coins ; tout tremble légèrement six fois par seconde ; puis le montage reprend.",
  needs: "son résultat fini filmé de dessus ou de face, le tiers haut de l'image sombre ou uni (le titre s'y pose), puis ses étapes filmées téléphone posé, en gestes courts (une recette, un soin, un bouquet, une pièce qu'on façonne).",
  lays: "sur son résultat fini, tenu deux temps au moins (le titre s'y pose), puis sur 1 à 6 de ses étapes, un plan d'un temps ou plus chacune",
  shots: [1, 8],
  seconds: [1.5, 8],
  require: { files: 2, shot: { framing: ["close", "detail", "medium"], still: true } },
  texts: [
    {
      slot: "titre",
      want: "le titre en pixels sur son résultat fini, en minuscules, qui tient sur deux lignes : ce qu'elle prépare, court, avec « !! » à la fin (une forme comme « soupe de saison!! », « gâteau fraise menthe!! »)",
      max: 24,
      required: true,
    },
    {
      slot: "petit_mot",
      want: "deux toutes petites lignes en machine à écrire avec le titre, séparées par une virgule, en minuscules, 2 à 4 mots chacune : ce que c'est, puis pour qui ou pour quand (une forme comme « fait maison, pour les soirs froids »)",
      max: 44,
      required: false,
    },
    {
      slot: "etapes",
      want: "une toute petite légende par étape, séparées par « / », en minuscules, dans l'ordre de ses plans après le premier, 1 à 4 mots chacune : ce qu'on prépare, ce qu'on ajoute, ce que ça sent (une forme comme « les fraises / la crème montée / ça sent bon ! ») ; sans légende, l'étape a un petit visage ou des étoiles",
      max: 90,
      required: false,
    },
  ],
  settings: [
    {
      name: "couleur",
      want: "la couleur du titre en pixels : vert d'eau comme l'original, ou la couleur principale de sa charte",
      choices: [
        { value: "menthe", says: "vert d'eau très pâle, un liseré gris-vert tout autour, comme l'original" },
        { value: "charte", says: "la couleur principale de sa charte, un liseré qui se lit dessus" },
      ],
    },
  ],
  timeline({ frames, shots, words }) {
    const { titleTo, steps } = pixelSteps({ frames, shots }, pixelCaptions(words.etapes).length);
    return {
      marks: {
        title_to: titleTo,
        steps: steps.length,
        ...Object.fromEntries(steps.flatMap((s, k) => [[`step_${k}`, s.from], [`step_${k}_to`, s.to], [`step_${k}_say`, s.caption]])),
      },
    };
  },
  code: CODE,
  fonts: ["Pixelify Sans", "Courier Prime", "Inter"],
};
