import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Coulisses façon fiche », version 2, written again on its original's fiche (docs/fiches/coulisses.md: a creator's
// « sound effects breakdown », measured image by image at 30 i/s, its sounds measured every 5 ms, the video watched and
// heard by Gemini; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A
// technical sheet on an electric blue squared ground, still from the first image to the last: a big bold title sitting
// on a card with rounded corners, the name of each sound under it as it is heard, this Reel's own timeline under that,
// its red playhead crossing it. Its original has no music: nothing but sound effects (whooshes, clicks, a computer's
// beeps, a ratchet, shutters) between dead silences, so there is no beat to count: every moment below is its
// original's image (30 a second) counted in beats at 120 BPM (15 images a beat, its catalogue's tempo), so its cuts
// fall where the original's do (within an image) and a slower tempo stretches them all:
//   0 – 1,17    on a calm wide shot of her place, the title of her video written in three times, each on its sound:
//               small words fall into place on a whoosh, her name flickers on with the clicks, then three pops on three
//               clicks (her small words, her logo, her place); it stays over everything to the end;
//   1,17 – 3,6  two cuts on two whooshes, then the next shot loading tile by tile across two of her shots, a beep a
//               jump, and filling the card;
//   3,6 – 4,93  a burst of six flash shots on a ratchet, a shot seen again, a cut on a double mouse click, then what the
//               next shot shows (a dish seen from above: named by the filler) cut out and laid on the shot before, five
//               images before the cut;
//   4,93 – 7,97 the next shot loading again, faster; three shutters, a camera flash on each cut; the hand and what it
//               holds cut out before the cut into it;
//   7,97 – 10,5 three cuts that stutter between two shots on salvos of six clicks, three cuts in silence (the label
//               gone), the last shot held to the end, like the first one (a loop).
// The name of each sound is in French (« WHOOSH x 2 », « DÉCLICS », « CLIC x 3 »), the sound itself its original's.
// Played in the original's 16:9 card when her videos are mostly horizontal (or she asks), else in a square card of the
// same width (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »); her photos stay
// still, her videos play. Nothing of the original's own is copied: its camera's logo is her logo, its words are hers.

const BPM = 120;
/** Its original's images in a beat at its tempo (30 i/s). */
const IMAGES_PER_BEAT = 15;
/** Where each of its 28 shots starts, its original's images (docs/fiches/coulisses.md, measured image by image), and its end. */
const CUTS = [0, 35, 45, 75, 100, 108, 109, 110, 113, 114, 115, 118, 125, 135, 148, 160, 188, 196, 205, 214, 226, 239, 246, 258, 265, 273, 285, 293];
const END = 315;
/** Where each label changes (its images): the name of the sound heard, or none in a silence (its code says which). */
const LABELS = [1, 8, 18, 33, 48, 70, 80, 105, 120, 130, 154, 159, 191, 219, 243, 255, 270, 283, 290];
/** The title of her video: its small words fall (high on this image, in place on the next), her name flickers from this one, its three pops. */
const FALL = 4;
const FLICKER = 9;
const POPS = [18, 23, 26];
/** The flicker's images that light her name (its original's 9, 11, 14 and 16), a click on each. */
const FLICKER_ON = [0, 2, 5, 7];
/** Each pop's click, this many images after it (the original's loudest at 18,9, 23,8 and 27,5). */
const POP_HIT = [0.9, 0.8, 1.5];
/** The loudest moment of each whoosh (its images): on a cut, or two or three images before it. */
const WHOOSHES = [4.5, 34.4, 44.5, 74.5, 132, 145.8, 223.3, 237.1];
/** The computer's beeps under each loading: from (its images), for (s). */
const BEEPS: [number, number][] = [
  [46.8, 2],
  [162, 1],
];
/**
 * Its shots its sounds fall on (their index; its code reads them by the same numbers): the burst's first one, the cut
 * into the café, the three flashed cuts, the three cuts that stutter.
 */
const BURST = 5;
const CAFE = 12;
const FLASHED = [17, 18, 19];
const STUTTERS = [22, 25, 27];
/** A shutter is loudest this many images after the flash on its cut (the original's 197,3, 206,4, 215,5). */
const SHUTTER_HIT = 1.4;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS); its last shot held that much longer for it. */
const END_CARD = 1.6;
/** Its sounds, the original's as its fiche hears them (the sound library's words; the gain from the level of sound effects). */
const WHOOSH = { sound: "short air whoosh", seconds: 0.5, gain: 6 };
const TICK = { sound: "camera shutter click", seconds: 0.5, gain: -3 };
const CLICK = { sound: "light click", seconds: 0.5 };
const DATA = { sound: "computer data processing beeps", gain: -3 };
const RATCHET = { sound: "mechanical ratchet clicks", seconds: 0.5 };
const MOUSE = { sound: "computer mouse double click", seconds: 0.5 };
const SHUTTER = { sound: "camera shutter", seconds: 0.5, gain: 2 };
const round = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const at = (i) => (shots[i] ? shots[i].from : durationInFrames + 1);
  const endAt = end ? end.from : durationInFrames + 1;
  const live = frame < endAt;
  const WHITE = "#ffffff";

  // Its sheet, one block centred in the frame: its card 16:9 as the original's when most of her videos are horizontal
  // (or she asks), else square at the same width (a vertical video keeps 56 % of its height there, 32 % in a 16:9
  // card); the title sitting on the card, the label under it, the timeline under the label.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const CX = 132;
  const CW = 816;
  const CH = wide ? 459 : 816;
  const CY = wide ? 586 : 408;
  const LABEL_Y = CY + CH + 114;
  const TL_Y = CY + CH + 179;
  const box = { position: "absolute", left: 0, top: 0, width: CW, height: CH };
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Inter', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  // Capitals, as the sheet sets everything; an ordinal keeps its small letters (« PARIS 11e »).
  const caps = (s) => String(s || "").toUpperCase().replace(/(\d)(ER|E)\b/g, (m, d, x) => d + x.toLowerCase());
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const split = (s) => String(s || "").split(/[\s  ]+/).filter(Boolean);
  const hooks = reelTexts.filter((t) => t.role === "hook");
  const smalls = reelTexts.filter((t) => t.role === "caption");
  const mine = [hooks[0], hooks[1], hooks[2], smalls[0], smalls[1], smalls[2]];
  const others = reelTexts.filter((t) => mine.indexOf(t) < 0);
  const shown = (t) => Boolean(t) && frame >= t.from && frame < t.to;

  // 1. Its title, there from the first image to the last: a big word in a bold grotesque set tight, as wide as the card
  // and sitting on it (a short one 1,45 times as tall as the original's at most), and two small words on its two ends,
  // the first on the left, the second on the right (her words in the two most even groups).
  const halves = (text) => {
    let w = String(text || "").split(/[ \t\n]+/).filter(Boolean);
    if (w.length < 2) w = split(text);
    if (w.length < 2) return [w.join(" "), ""];
    const gap = (k) => Math.abs(w.slice(0, k).join(" ").length - w.slice(k).join(" ").length);
    let best = 1;
    for (let k = 2; k < w.length; k++) if (gap(k) < gap(best)) best = k;
    return [w.slice(0, best).join(" "), w.slice(best).join(" ")];
  };
  const title = hooks[0];
  const kicker = smalls[0];
  const pair = halves(caps(kicker ? kicker.text : ""));
  const word = caps(title ? title.text : "");
  const BIG = Math.min(196, Math.round(CW / (Math.max(4, Array.from(word).length) * 0.5)));
  const heading = shown(title) || shown(kicker)
    ? h(FitText, { key: "title", style: { position: "absolute", left: CX, top: CY - 248, width: CW, height: 244 }, innerStyle: { justifyContent: "flex-end" } }, (scale) =>
        h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "stretch" } },
          shown(kicker)
            ? h("div", { style: { display: "flex", justifyContent: pair[1] ? "space-between" : "flex-start", gap: Math.round(28 / scale), fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: Math.round(62 / Math.max(0.6, scale)), lineHeight: 1, letterSpacing: "-0.02em", color: WHITE, whiteSpace: "nowrap", marginBottom: -Math.round(8 / scale) } },
                h("span", { "data-fauve-accent": "" }, pair[0]),
                pair[1] ? h("span", { "data-fauve-accent": "" }, pair[1]) : null)
            : null,
          shown(title) ? h("div", { style: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: BIG, lineHeight: 0.8, letterSpacing: "-0.025em", color: WHITE, whiteSpace: "nowrap", textAlign: "center" } }, word) : null))
    : null;

  // 2. In the card, her shot of the moment as filmed (a photo still, a video playing), cut where the original cuts.
  const shot = (i, key) => (shots[i] ? h(Footage, { key, shot: i, style: box }) : null);
  // The cut that stutters, three times, on a salvo of six clicks: six images between the two shots, an image each, the
  // new one first (its original's B B A B A B, then twice B A B A A B), then the new one stays; the old one holds its
  // last image.
  const STUTTERS = [[22, [1, 1, 0, 1, 0, 1]], [25, [1, 0, 1, 0, 0, 1]], [27, [1, 0, 1, 0, 0, 1]]];
  let showing = cur;
  for (const [i, pattern] of STUTTERS) {
    const k = frame - at(i);
    if (k >= 0 && k < 6 && !pattern[k]) showing = i - 1;
  }
  const film = shot(showing, "s" + showing);

  // The next shot loading tile by tile, a beep a jump: the card cut in 5 × 3 tiles, a piece of the shot to come, in
  // place, jumping from tile to tile (12 jumps a second), then a few at once, then all of it. The first time across two
  // of her shots: in reading order, four at random, then three blocks (the top, the right, the bottom left); the second
  // time faster: the top row from right to left, then 2, 2, 2, 3, 8 and 11 tiles at once. Its picture held on its
  // first image until it plays.
  const COLS = 5;
  const tw = CW / COLS;
  const th = CH / 3;
  const ONE = [0, 3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35].map((f, i) => [f / 55, [i]])
    .concat([[38 / 55, [7]], [40 / 55, [1]], [43 / 55, [12]], [45 / 55, [9]], [48 / 55, [0, 1, 2]], [50 / 55, [3, 4, 8, 9, 13, 14]], [53 / 55, [5, 6, 10, 11, 12]]]);
  const TWO = [[1, [4]], [3, [3]], [5, [2]], [8, [1]], [10, [0]], [13, [6, 13]], [15, [5, 9]], [18, [2, 11]], [20, [0, 8, 14]], [23, [1, 3, 4, 6, 7, 10, 12, 13]], [25, [0, 2, 5, 6, 8, 9, 10, 11, 12, 13, 14]]].map(([f, t]) => [f / 28, t]);
  const loading = (steps, a, b) => {
    if (frame < at(a) || frame >= at(b) || !shots[b]) return null;
    let tiles = null;
    for (const [s, t] of steps) if (frame >= at(a) + Math.round(s * (at(b) - at(a)))) tiles = t;
    if (!tiles) return null;
    const path = tiles.map((t) => "M" + ((t % COLS) * tw).toFixed(1) + " " + (Math.floor(t / COLS) * th).toFixed(1) + "h" + tw.toFixed(1) + "v" + th.toFixed(1) + "h-" + tw.toFixed(1) + "Z").join(" ");
    return h("div", { key: "load" + b, style: { ...box, clipPath: "path('" + path + "')" } }, shot(b, "t" + b));
  };
  const tiles = [loading(ONE, 2, 4), loading(TWO, 15, 16)];

  // Before two cuts, what the next shot shows (a dish seen from above, a hand and what it holds: named by the filler),
  // cut out and laid at once on the shot before, exactly where it will be, five images before the cut, which then
  // brings the rest of its picture around it. Nothing named there: a plain cut on its whoosh.
  const plate = frame >= at(14) - 5 && frame < at(14) ? h(Subject, { key: "o14", shot: 14, object: "@plat", style: box }) : null;
  const hand = frame >= at(21) - 5 && frame < at(21) ? h(Subject, { key: "o21", shot: 21, object: "@main", style: box }) : null;

  // Three camera flashes, in the card only, each on the cut of its shutter: two white images, then an image 80 % white
  // on the first image of each of the next two shots.
  const white = frame >= at(17) && frame < at(17) + 2 ? 1 : frame === at(18) || frame === at(19) ? 0.8 : 0;
  const flash = white ? h("div", { key: "flash", style: { ...box, background: WHITE, opacity: white } }) : null;

  // The title of her video, on its first shot, in two blocks on the card's middle line, laid out like the title above
  // (small words spread over a bigger line), white and as small as the original's (decor: Tristan's exception for its
  // tiny type), a thin dark edge so it holds on her pale shots. Left: when and whose, over her name; right: a word or two
  // and her logo, over her place. Written in three times, each on its sound: the small words fall from high in the
  // card onto their place on the whoosh (one image high, then there); her name flickers on, image by image, on the
  // clicks; on the right three pops, one a click, each piece at half its size for an image or two, then at its size.
  // Then it stays over everything, to her ending card.
  const FALL = mark("fall", 4);
  const FLICK = mark("flicker", 9);
  const POPS = [mark("pop1", 18), mark("pop2", 23), mark("pop3", 26)];
  const BI = Math.round(CW * 0.037);
  const SI = Math.round(CW * 0.0185);
  const edge = "0 0 1px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.45)";
  const big = { fontFamily: body, fontWeight: 700, fontSynthesis: "none", fontSize: BI, lineHeight: 1, letterSpacing: "-0.02em", color: WHITE, whiteSpace: "nowrap", textShadow: edge };
  const small = { fontFamily: body, fontWeight: 700, fontSynthesis: "none", fontSize: SI, lineHeight: 1, letterSpacing: "0.01em", color: WHITE, whiteSpace: "nowrap", textShadow: edge };
  const when = smalls[1];
  const name = hooks[1];
  const near = smalls[2];
  const place = hooks[2];
  const ON = [1, 0, 1, 1, 0, 1, 0];
  const lit = frame < FLICK ? 0 : frame - FLICK < ON.length ? ON[frame - FLICK] : 1;
  const pop = (k) => (frame < POPS[k] ? 0 : frame < POPS[k] + (k === 2 ? 2 : 1) ? 0.5 : 1);
  const blockY = Math.round(CH * 0.505 - BI * 0.9);
  const blockH = Math.round(BI * 1.7);
  const left = live && (shown(when) || shown(name))
    ? h(FitText, { key: "il", style: { position: "absolute", left: Math.round(CW * 0.1), top: blockY, width: Math.round(CW * 0.3), height: blockH }, innerStyle: { alignItems: "flex-start", justifyContent: "flex-end" } }, (scale) =>
        h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "stretch" } },
          h("div", { style: { ...small, display: "flex", justifyContent: "space-between", gap: Math.round(SI * 0.6), marginBottom: -Math.round(BI * 0.11), opacity: when && frame >= FALL ? 1 : 0, transform: frame === FALL ? "translateY(" + Math.round((-0.29 * CH) / scale) + "px)" : "none" } },
            split(caps(when ? when.text : "")).map((w, i) => h("span", { key: i }, w))),
          h("div", { style: { ...big, opacity: name ? lit : 0 } }, caps(name ? name.text : ""))))
    : null;
  // Its three pieces, one a click: her small words, her logo, her place; without a logo her first small words, then her last one.
  const words = split(caps(near ? near.text : ""));
  const logo = brand.logoUrl ? h(Img, { src: brand.logoUrl, style: { height: Math.round(SI * 1.35), width: "auto", maxWidth: Math.round(SI * 6), objectFit: "contain", filter: brand.logoOnDark === "white" ? "brightness(0) invert(1)" : "none" } }) : null;
  const pieces = logo ? [words.join(" "), logo] : words.length > 1 ? [words.slice(0, -1).join(" "), words[words.length - 1]] : [words.join(" "), null];
  const popped = (k, child, style) => h("span", { key: "p" + k, style: { display: "inline-flex", alignItems: "flex-end", ...(style || {}), opacity: pop(k) ? 1 : 0, transform: pop(k) === 0.5 ? "scale(0.5)" : "none", transformOrigin: "50% 60%" } }, child);
  const right = live && (shown(near) || shown(place))
    ? h(FitText, { key: "ir", style: { position: "absolute", left: Math.round(CW * 0.6), top: blockY, width: Math.round(CW * 0.32), height: blockH }, innerStyle: { alignItems: "flex-end", justifyContent: "flex-end" } },
        h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "center" } },
          h("div", { style: { ...small, display: "flex", alignItems: "flex-end", gap: Math.round(SI * 0.5), marginBottom: -Math.round(BI * 0.11) } },
            popped(0, pieces[0]),
            pieces[1] ? popped(1, pieces[1]) : null),
          popped(2, caps(place ? place.text : ""), big)))
    : null;
  const inner = h("div", { key: "inner", "data-fauve-decor": "", style: box }, left, right);

  // Its ending card, only when she has one to give (the original has none: its last shot loops back on its first): the
  // card darkens under her title in the title's capitals, her line in the label's place.
  const fin = Boolean(end) && frame >= endAt;
  const veil = fin ? h("div", { key: "veil", style: { ...box, background: "#000000", opacity: Math.round(55 * Math.min(1, (frame - endAt + 1) / 6)) / 100 } }) : null;
  const endTitle = fin
    ? h(FitText, { key: "et", style: { position: "absolute", left: 48, top: Math.round(CH * 0.18), width: CW - 96, height: Math.round(CH * 0.64) }, innerStyle: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: 110, lineHeight: 0.95, letterSpacing: "-0.02em", color: WHITE, textAlign: "center", textWrap: "balance" } },
        h("span", { style: { opacity: frame >= endAt + 2 ? 1 : 0 } }, keep(caps(end.title))))
    : null;
  // (The flash over everything in the card, the title of her video too.)
  const cardBox = h("div", { key: "card", style: { position: "absolute", left: CX, top: CY, width: CW, height: CH, borderRadius: 30, overflow: "hidden", backgroundColor: "#000000" } }, film, tiles, plate, hand, inner, flash, veil, endTitle);

  // 3. Under the card, the name of the sound heard, white capitals that change at once with it (a count written
  // « x 2 »), gone in a silence of more than a third of a second; the last one stays. Her line in its place at the end.
  const NAMES = ["WHOOSH", "DÉCLICS", "CLIC x 3", "WHOOSH x 2", "CHARGEMENT", "WHOOSH", "CHARGEMENT", "CLIQUET", "CLIC SOURIS", "WHOOSH x 2", "", "CHARGEMENT", "DÉCLENCHEUR x 3", "WHOOSH x 2", "DÉCLICS", "", "DÉCLICS", "", "DÉCLICS"];
  const CHANGES = [1, 8, 18, 33, 48, 70, 80, 105, 120, 130, 154, 159, 191, 219, 243, 255, 270, 283, 290].map((d, i) => mark("l" + i, d));
  let li = -1;
  CHANGES.forEach((f, i) => { if (frame >= f) li = i; });
  const named = li >= 0 && live ? NAMES[li] : "";
  const lineStyle = { fontFamily: body, fontWeight: 700, fontSynthesis: "none", fontSize: 70, lineHeight: 1, letterSpacing: "-0.01em", color: WHITE, whiteSpace: "nowrap" };
  const label = named ? h(FitText, { key: "n" + li, style: { position: "absolute", left: 140, top: LABEL_Y - 50, width: 800, height: 100 }, innerStyle: lineStyle }, named) : null;
  const endLine = fin && end.subtitle
    ? h(FitText, { key: "es", style: { position: "absolute", left: 140, top: LABEL_Y - 60, width: 800, height: 120 }, innerStyle: { ...lineStyle, fontSize: 60, lineHeight: 1.05, whiteSpace: "normal", textAlign: "center", textWrap: "balance" } },
        h("span", { style: { opacity: frame >= endAt + 6 ? 1 : 0 } }, keep(caps(end.subtitle))))
    : null;

  // 4. Under it, this Reel's timeline as an editing app shows it (a graphic: decor): its timecode running, its red
  // playhead crossing it at a constant speed from the first image to the last (the frame's 23,3 % to its 87,2 %); her
  // shots on its first video track, its loadings and its cut-outs and flashes on the two above, its sounds the green
  // clips of its audio tracks, each where it is heard, so the playhead passes over a clip as the label names it.
  const X0 = 117;
  const X1 = 807;
  const xAt = (f) => X0 + Math.max(0, Math.min(1, f / Math.max(1, durationInFrames - 1))) * (X1 - X0);
  const clip = (key, f0, f1, y, hh, bg, child) => h("div", { key, style: { position: "absolute", left: Math.round(xAt(f0)), top: y, width: Math.max(3, Math.round(xAt(f1) - xAt(f0)) - 1), height: hh, borderRadius: 2, overflow: "hidden", background: bg } }, child || null);
  const pad = (v) => (v < 10 ? "0" : "") + v;
  const tracks = [["V9", 36, 8], ["V8", 47, 8], ["V7", 58, 8], ["V6", 69, 8], ["V5", 80, 8], ["V4", 91, 8], ["V3", 102, 8], ["V2", 113, 9], ["V1", 125, 28], ["A1", 160, 24], ["A2", 192, 24], ["A3", 224, 24]];
  const chip = { width: 9, height: 6, borderRadius: 1, background: "#3d3a46" };
  const heads = tracks.map((r) => h("div", { key: "h" + r[0], style: { position: "absolute", left: 18, top: r[1] + Math.round((r[2] - 9) / 2), height: 9, display: "flex", alignItems: "center", gap: 5 } },
    h("div", { style: { width: 15, height: 9, borderRadius: 2, background: "#8c2b35", color: "#f6dada", fontFamily: body, fontSize: 6, lineHeight: "9px", textAlign: "center" } }, r[0]),
    h("div", { style: chip }), h("div", { style: chip }), h("div", { style: chip })));
  const last = durationInFrames - 1;
  const blue = "repeating-linear-gradient(90deg, #2f67a8 0 9px, #23538c 9px 10px)";
  const film2 = "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 14px), linear-gradient(180deg, #67636f, #44414c)";
  const bars = [
    clip("b9", 0, last, 36, 8, "#d8c7a8"), clip("b8", 0, last, 47, 8, "#cdbb98"), clip("b7", 0, last, 58, 8, "#3e6eb0"),
    clip("b6", last * 0.03, last, 69, 8, "#e8590c"), clip("b5", 0, last, 80, 8, "#e4550a"),
    clip("c3", at(14) - 5, at(14), 102, 8, blue), clip("c4", at(21) - 5, at(21), 102, 8, blue),
    ...[17, 18, 19].map((i) => clip("c" + i, at(i), at(i) + (i === 17 ? 2 : 1), 102, 8, blue)),
    clip("c1", at(2), at(4), 113, 9, blue), clip("c2", at(15), at(16), 113, 9, blue),
    ...shots.map((s, i) => h(React.Fragment, { key: "v" + i },
      clip("v" + i, s.from, s.from + s.durationInFrames, 125, 19, film2),
      clip("vl" + i, s.from, s.from + s.durationInFrames, 145, 8, i % 2 ? "#3b80d6" : "#b46fca"))),
  ];
  const diamond = h("div", { style: { position: "absolute", left: "50%", top: "50%", width: 6, height: 6, marginLeft: -3, marginTop: -3, transform: "rotate(45deg)", background: "rgba(255,255,255,0.85)" } });
  const wave = h("div", { style: { position: "absolute", left: 2, right: 2, top: 9, height: 6, backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px)" } });
  const sound = (key, f0, f1, row) => clip(key, f0, f1, [160, 192, 224][row], 24, "#2E8162", row === 2 ? wave : diamond);
  const R0 = mark("r0", 108);
  const M0 = mark("m0", 125);
  const D = [mark("d0", 47), mark("d1", 162)];
  const sounds = [
    sound("k", FLICK, FLICK + 8, 0),
    ...POPS.map((p, i) => sound("p" + i, p, p + 4, 0)),
    sound("r", R0, R0 + 11, 0),
    sound("m", M0 - 2, M0 + 3, 0),
    ...[17, 18, 19].map((i) => sound("f" + i, at(i) - 1, at(i) + 6, 0)),
    ...[22, 25, 27].map((i) => sound("t" + i, at(i) - 1, at(i) + 6, 0)),
    ...[4.5, 34.4, 44.5, 74.5, 132, 145.8, 223.3, 237.1].map((d, i) => { const w = mark("w" + i, d); return sound("w" + i, w - 8, w + 5, 1); }),
    sound("d0", D[0], D[0] + 60, 2),
    sound("d1", D[1], D[1] + 30, 2),
  ];
  const head = xAt(frame);
  const ruler = Array.from({ length: 6 }, (_, i) => h("div", { key: "r" + i, style: { position: "absolute", left: Math.round(X0 + (i * (X1 - X0)) / 5) + 3, top: 10, fontFamily: body, fontSize: 7, color: "#8b8896" } }, "01:00:" + pad(Math.floor((i * durationInFrames) / 150)) + ":00"));
  const timeline = h("div", { key: "timeline", "data-fauve-decor": "", style: { position: "absolute", left: 135, top: TL_Y, width: 809, height: 266, borderRadius: 22, overflow: "hidden", background: "#232128" } },
    h("div", { style: { position: "absolute", left: 26, top: 9, fontFamily: body, fontWeight: 700, fontSize: 14, color: "#e4e2e9", letterSpacing: "0.02em" } }, "01:00:" + pad(Math.floor(frame / 30)) + ":" + pad(frame % 30)),
    h("div", { style: { position: "absolute", left: 112, top: 0, width: 1, height: 266, background: "#34313d" } }),
    h("div", { style: { position: "absolute", left: X0, top: 30, width: X1 - X0, height: 1, background: "#3b3846" } }),
    ruler, heads, bars, sounds,
    h("div", { style: { position: "absolute", left: Math.round(head - 1), top: 14, width: 2, height: 252, background: "#ff3131" } }),
    h("div", { style: { position: "absolute", left: Math.round(head - 6), top: 3, width: 12, height: 12, background: "#ff3131", clipPath: "polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)" } }));

  // Any other text of the Reel (none in its slots): a plain white line above the title, so nothing she wrote is lost.
  const extra = others.filter((t) => shown(t) && live).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: 800, top: Math.max(90, CY - 380) + i * 110, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 52, lineHeight: 1.1, color: WHITE, textAlign: "center" } }, t.text));

  // The ground: an electric blue, squared with fine violet lines like a technical sheet, still; no gradient, grain nor shadow.
  const ground = { backgroundColor: "#15017A", backgroundImage: "linear-gradient(#432DA9 0 2px, transparent 2px), linear-gradient(90deg, #432DA9 0 2px, transparent 2px)", backgroundSize: "33.75px 33.75px", backgroundPosition: "13px 33px" };
  return h(AbsoluteFill, { style: ground }, heading, cardBox, label, endLine, timeline, extra);
}`;

/** Each of its 28 shots' want, for the filler (French). */
const WANTS = [
  "le plan qui ouvre : son lieu large et calme, de loin ou vu d'en haut (sa rue, sa devanture, sa ville, de nuit ou éclairé) : le titre de sa vidéo s'y écrit, et un plan du même genre finit le Reel",
  "un plan bref qui arrive, en mouvement : le trajet, la porte qu'on pousse, la rue qui défile",
  "un plan large et fixe, très différent du 5e (de jour si le 5e est de nuit, dehors s'il est dedans) : le 5e s'y charge case par case",
  "un plan qui bouge, dehors ou dedans : le chargement du plan suivant continue par-dessus",
  "le plan que le chargement amène : son lieu de loin, de nuit ou éclairé, très différent des deux d'avant",
  ...Array.from({ length: 6 }, () => "un plan éclair d'une à trois images : un détail, un geste, un produit, un visage (une rafale sur un cliquet)"),
  "un plan déjà vu : le même fichier que le 3e plan, à un autre moment",
  "un intérieur avec quelque chose qui brille (une guirlande, une vitrine éclairée, une lampe) : la coupe tombe sur un double clic",
  "un comptoir, une table ou un plan de travail vu à hauteur d'yeux : ce que montre le plan suivant s'y pose détouré avant la coupe",
  "un produit ou un plat bien net, vu d'en haut ou de près, posé (une assiette, un bouquet, une tasse) : il arrive détouré, à sa place, sur le plan d'avant",
  "un plan proche et vivant (elle ou l'équipe de près, en mouvement), très différent du suivant : le suivant s'y charge case par case",
  "le plan que le chargement amène : ses rayons ou son lieu, large",
  "un plan de ses rayons ou de ses produits : un flash d'appareil photo à la coupe",
  "un détail posé (des pots, des outils, des magazines sur une table) : un flash à la coupe",
  "un plan de son lieu ou de ses rayons : un flash à la coupe",
  "un plan lumineux de son lieu : ce que tient la main du plan suivant s'y pose détouré avant la coupe",
  "une main qui tient un produit ou un objet bien net, au milieu de l'image : elle arrive détourée, à sa place, sur le plan d'avant",
  "un panneau, une ardoise, son enseigne ou sa vitrine : la coupe hésite entre lui et le plan d'avant",
  "un plan de son lieu ou de ses rayons, coupé dans le silence",
  "son comptoir, sa caisse ou son plan de travail, coupé dans le silence",
  "un plan vivant, du monde ou du mouvement : la coupe hésite entre lui et le plan d'avant",
  "un plan avec des lumières (une guirlande, des bougies, des gens), coupé dans le silence",
  "le plan qui finit, tenu jusqu'au bout : son lieu de loin ou vu d'en haut, comme le premier (la fin boucle sur le début)",
];

export const coulisses: MontageSkill = {
  key: "coulisses",
  // 2: written again on its original's fiche: its 28 cuts within an image of the original's, no music but its sounds
  // (40, on their effects), the name of each sound under the card as it is heard, the title of her video in three times
  // (a fall, a flicker, three pops), two loadings tile by tile, a burst on a ratchet, two cut-outs before their cuts,
  // three flashes, three stutters, this Reel's own timeline and playhead, its format (16:9 or square), no ending card
  // unless she has one. 3: its small words and its big one read as one phrase, as the original's « SOUND EFFECTS
  // BREAKDOWN » (its first bench wrote « les bouquets du » over « coulisses »).
  version: 3,
  bpm: BPM,
  shots: [CUTS.length, CUTS.length],
  files: [6, 16],
  how: "Une fiche technique sur un fond bleu électrique quadrillé, immobile du début à la fin : en haut un grand titre en capitales grasses, deux petits mots posés sur ses deux bouts ; au milieu, une carte aux coins arrondis où passent ses plans ; dessous, le nom de chaque bruitage au moment où on l'entend (« WHOOSH x 2 », « DÉCLICS », « CLIC x 3 »), effacé dans les silences ; en bas, la timeline du montage et sa tête de lecture rouge. Pas de musique : rien que des bruitages. Dans la carte : sur un plan large et calme, le titre de sa vidéo s'écrit en trois temps (de petits mots qui tombent, son nom qui clignote, son lieu et son logo qui apparaissent) ; deux coupes sur des whooshes ; le plan suivant se charge case par case ; une rafale de plans éclair sur un cliquet ; ce que montre le plan suivant (un plat, une main qui tient quelque chose) arrive détouré avant la coupe, deux fois ; trois flashs photo ; trois coupes qui hésitent entre deux plans ; un dernier plan comme le premier, tenu jusqu'au bout. En 16:9 comme l'original quand ses vidéos sont horizontales, sinon dans une carte carrée.",
  end: true,
  texts: [
    {
      slot: "surtitre",
      role: "caption",
      want: "2 ou 3 petits mots posés au-dessus des deux bouts du grand titre (le premier à gauche, le reste à droite), lus avant lui : avec lui, une seule phrase, comme « SOUND EFFECTS » puis « BREAKDOWN » dans l'original (une forme comme « bruitages en » + « coulisses », « le son des » + « coulisses », « les coulisses du » + « fournil », « le son de l' » + « atelier »)",
      max: 20,
      required: true,
    },
    {
      slot: "titre",
      role: "hook",
      want: "le grand titre en capitales grasses posé sur la carte, aussi large qu'elle : un seul mot, qui termine la phrase de ses petits mots, « coulisses » ou son lieu (une forme comme « coulisses », « fournil », « atelier », « boutique »)",
      max: 14,
      required: true,
    },
    {
      slot: "quand",
      role: "caption",
      want: "le titre de sa vidéo, en petit dans la carte à gauche : 2 ou 3 petits mots étalés au-dessus de son nom (une forme comme « 24 h chez », « un samedi chez », « une journée à »)",
      max: 16,
      required: true,
    },
    { slot: "nom", role: "hook", want: "son nom, sous ces petits mots (il clignote sur des déclics)", max: 16, required: true },
    {
      slot: "pres",
      role: "caption",
      want: "en petit dans la carte à droite, 1 ou 2 petits mots devant son logo, au-dessus du lieu (une forme comme « à », « au cœur de », « fleuriste à »)",
      max: 14,
      required: true,
    },
    {
      slot: "lieu",
      role: "hook",
      want: "sous ces petits mots : sa ville, son quartier ou sa rue quand on les connaît, sinon son métier en 2 ou 3 mots (une forme comme « Paris 11e », « fleurs et plantes »)",
      max: 16,
      required: true,
    },
  ],
  objects: [
    {
      slot: "plat",
      shot: 14,
      want: "ce qu'on voit net au milieu de ce plan, vu d'en haut ou de près, qui arrive détouré sur le plan d'avant : « plate of pastries », « bouquet of roses », « coffee cup », « every plate » ; vide quand rien n'y est net",
    },
    {
      slot: "main",
      shot: 21,
      want: "la main et ce qu'elle tient au milieu de ce plan, qui arrivent détourés sur le plan d'avant : « hand holding a box », « hand holding a bouquet », « hand holding a cup » ; sinon l'objet net du plan ; vide quand rien n'y est net",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format de la carte : 16:9 comme l'original, ou carrée",
      choices: [
        { value: "auto", says: "comme ses vidéos (16:9 si la plupart sont horizontales, carrée sinon)" },
        { value: "horizontal", says: "une carte 16:9, comme l'original (une vidéo verticale y est cadrée sur son sujet)" },
        { value: "vertical", says: "une carte carrée de la même largeur, pour des vidéos verticales" },
      ],
    },
  ],
  timeline(_n, options) {
    const { end } = options;
    // At another tempo (a longer or shorter Reel): every length counted in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    // One of its original's images on this Reel's clock (frames).
    const image = (i: number) => (i * BPM) / bpm;
    // With an ending card (an option: the original loops back on its first image), its last shot held the card's time more.
    const beats = CUTS.map((c, i) => ((CUTS[i + 1] ?? END) - c) / IMAGES_PER_BEAT + (end && i === CUTS.length - 1 ? END_CARD / beat : 0));
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const from = (i: number) => toFrame(spans[i]!.start);
    const fall = Math.round(image(FALL));
    const flicker = Math.round(image(FLICKER));
    const pops = POPS.map((p) => Math.round(image(p)));
    const whooshes = WHOOSHES.map((w) => round1(image(w)));
    const beeps = BEEPS.map(([b]) => round1(image(b)));
    const at = (frames: number) => round3(frames / 30);
    // Its sounds, each on its effect (40, its original's 24 sounds with each salvo's clicks one by one): a whoosh on each
    // cut or fall, a click on each image that lights her name and on each pop, the computer's beeps under each loading,
    // a ratchet under the burst, a double click on the cut into the café, a shutter on each flash, a click on each
    // image of each stutter.
    const sounds: SkillSound[] = [
      ...whooshes.map((w) => ({ at: at(w), ...WHOOSH })),
      ...FLICKER_ON.map((o) => ({ at: at(flicker + o), ...TICK })),
      ...pops.map((p, i) => ({ at: at(p + POP_HIT[i]!), ...CLICK })),
      ...BEEPS.map(([, seconds], i) => ({ at: at(beeps[i]!), ...DATA, seconds })),
      { at: at(from(BURST)), ...RATCHET },
      { at: at(from(CAFE)), ...MOUSE },
      ...FLASHED.map((i) => ({ at: at(from(i) + SHUTTER_HIT), ...SHUTTER })),
      ...STUTTERS.flatMap((i) => Array.from({ length: 6 }, (_, k) => ({ at: at(from(i) + k - 0.3), ...TICK }))),
    ].sort((a, b) => a.at - b.at);
    const last = end ? round(duration - END_CARD) : duration;
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: WANTS[i]! })),
      // Its title from the first image to the last; the title of her video as each part is written, to her ending card.
      texts: {
        surtitre: { from: 0, to: duration },
        titre: { from: 0, to: duration },
        quand: { from: round(fall / 30), to: last },
        nom: { from: round(flicker / 30), to: last },
        pres: { from: round(pops[0]! / 30), to: last },
        lieu: { from: round(pops[2]! / 30), to: last },
      },
      // Nothing but its sound effects: no music is composed for it, unless she asks for one.
      music: { none: true },
      sounds,
      marks: {
        fall,
        flicker,
        pop1: pops[0]!,
        pop2: pops[1]!,
        pop3: pops[2]!,
        ...Object.fromEntries(LABELS.map((l, i) => [`l${i}`, Math.round(image(l))])),
        ...Object.fromEntries(whooshes.map((w, i) => [`w${i}`, w])),
        d0: beeps[0]!,
        d1: beeps[1]!,
        r0: from(BURST),
        m0: from(CAFE),
      },
    };
  },
  code: CODE,
};
