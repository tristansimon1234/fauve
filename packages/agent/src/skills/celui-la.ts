import { HEARD_CARD, HEARD_HOLD } from "../own-voice.ts";
import { beatSpans, toFrame, type MontageSkill, type SkillHeard, type SkillTimeline } from "../skills.ts";

// « Celui-là, celui-là… », version 1, written on its original's fiche (docs/fiches/celui-la.md: a ceramist's Reel and a
// second one made on the same template by another, measured image by image at 30 i/s: each word's box, size, colour and
// opacity read on its pale yellow pixels, its cuts, its sound by bands; Tristan: « c'est un effet que l'on veut pouvoir
// faire, pas exactement reproduire l'image »). Her products one by one, a playful word popping on each, on the beat, at
// a new place each time. The original's sound is a man's voice alone (« Heeeeey! Stop! Stop! Stop! Look at this, this…
// aaaand… this »), a trending sound of another account, never copied; but it chants on a steady pulse of 96,5 BPM (a
// beat every 0,622 s, its beat 0 at −0,11 s: the Reel starts on beat 0,18), and every landmark below is in beats of it:
//   0,18 – 4   her empty display (a stool): her hail typed letter by letter from its left edge (25,6 % of the width),
//              from beat 0,23 to 0,82, held, faded in 4 images (gone on 1,04); her stop word popping on three places
//              (beats 1,31, 1,58, 1,95: top left, right, bottom left, the third 9 % bigger), gone on 2,6; « Regarde »
//              alone in the middle from beat 2,97;
//   4 – 11     seven products, one a beat, hard cuts (the original's within 2,2 images of the grid); on each the same
//              pointing word, at once on its cut (no grow, no fade), each time elsewhere, never twice in a region (the
//              original's seven places, then five more of the same kind), sometimes on the product, sometimes beside it;
//   11 – 15    her whole series together, a hand placing the last piece; her hesitation typed letter by letter (from
//              its left edge, 14,2 %) from beat 11,12 to 11,98, held, faded (gone on 13,21); her last word alone in
//              the middle on beat 13,5, held 1,5 beats to the end (the original's 0,4 s ended on its voice: Instagram
//              loops it; Edith's must be read), then her ending card in option.
// All her words are the same big narrow serif (her title font: the model's pairing is Instrument Serif), upright, in
// sentence case, the original's pale cream yellow (#FFFCC0) with a thin dark edge of its own (on its white wall the
// original's contrast is 1,7: the scene check would call it lost), never boxed nor animated but for the typing. Its music
// is composed at its tempo and shaped as its voice: without its bass during the hail, its bass in on the first product,
// stopped on the series with its last hit ringing (the hesitation in the suspense), back on her last word, ended on a
// hit a beat later. Her photos stay still, her videos play. Vertical full frame as the original when her files are
// upright; each shot whole in a 16:9 band on black when most are horizontal (Tristan: « format par défaut [comme ses
// vidéos], et changement à la demande du user »).
// Version 2: its words are what its voice says, as its original's (Tristan: « par défaut voix off et le user peut changer
// de voix »): by default a voice (Edith's default for her, or the one she chose) says each of its words exactly when it
// lands on screen, on the beats: her hail, her stop word on each of its pops, « Regarde », her pointing word on each
// product, her hesitation, her last word (saysWords, its timeline's `says`; model-voice.ts); no subtitles, her music under it.
// Version 3: her own recorded voice can lead it instead (Tristan: « qq qui parle face cam ou qui enregistre sa propre
// voix, pourquoi on peut pas jouer celle-là ? »; own-voice.ts): her voice note, or the sound of one of her videos where
// she speaks, played whole (never cut into words), and the model on what she says (`heard`): its words on screen are
// hers, each from when she says it (her stop word as many times as she says it, three at most; her pointing word, as
// she says it, on each product), each product cut two images before she points at it, her series on her hesitation
// (or her last word), its music thin until her first product, stopped on her series and back on her last word. Her
// face-cam is heard, never seen here: the original's voice is off screen, a voice that stops you and points, over her
// empty display where her products will parade, its opening words posed across the middle of the frame (on her face).

const BPM = 96.5;
/** Where the Reel starts on its original's grid (beats): its beat 0 is 0,11 s before the Reel's first image. */
const START = 0.18;
/** Her hail: typed from beat 0,23 to 0,82, held, faded from 0,88, gone on 1,04. */
const HAIL = { from: 0.23, typed: 0.82, out: 0.88, gone: 1.04 };
/** Her stop word on its three places (beats), gone on 2,6. */
const STOPS = [1.31, 1.58, 1.95];
const STOPPED = 2.6;
/** « Regarde » alone from beat 2,97; the first product on beat 4, one a beat. */
const LOOK = 2.97;
const FIRST = 4;
/** On her series (beats from its cut): her hesitation typed from 0,12 to 0,98, held, faded from 1,95, gone on 2,21; her last word on 2,5, held 1,5. */
const AND = { from: 0.12, typed: 0.98, out: 1.95, gone: 2.21 };
const LAST = 2.5;
const HOLD = 1.5;
/** The engine's ending card: the Reel's last 1,6 s. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");
/** A moment (s) on the frame its code shows it on, as its voice says it there. */
const onFrame = (s: number) => round3(toFrame(s) / 30);
/** Under her own voice: each product cut this long before she points at it (s: the original cuts one or two images before its word). */
const CUT_LEAD = 2 / 30;
/** Under her own voice: her empty display holds this long at least before her first product (s; her talk starts later when she points at once). */
const OPEN_MIN = 0.6;
/** Under her own voice: a product a fifth of a second at least (s); pointed at closer, they are not the model's words. */
const PRODUCT_MIN = 0.2;
/** A mark of a word she never says (images): past any Reel, its word never drawn. */
const ABSENT = 99999;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const n = shots.length;
  const BEAT = mark("beat", 18.65);
  const HAIL_FROM = mark("hail_from", 1), HAIL_TYPED = mark("hail_typed", 12), HAIL_OUT = mark("hail_out", 13), HAIL_GONE = mark("hail_gone", 16);
  const STOP1 = mark("stop1", 21), STOP2 = mark("stop2", 26), STOP3 = mark("stop3", 33), STOPPED = mark("stopped", 45);
  const LOOK = mark("look", 52);
  const FIRST = mark("first", n > 2 ? shots[1].from : 71);
  const FINALE = mark("finale", n > 1 ? shots[n - 1].from : Math.max(FIRST + BEAT, durationInFrames - 75));
  const AND_FROM = mark("and_from", FINALE + 2), AND_TYPED = mark("and_typed", FINALE + 18), AND_OUT = mark("and_out", FINALE + 36), AND_GONE = mark("and_gone", FINALE + 41);
  const LAST = mark("last", FINALE + 47);
  const endAt = end ? end.from : durationInFrames + 1;
  const card = Boolean(end) && frame >= endAt;

  // 1. Its frame: her shots full frame, upright as the original; each one whole in a 16:9 band on black when most of
  // her files are horizontal (or as her words ask). Only the shot on screen is laid: a video plays, a photo stays still.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const band = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const BH = Math.round((width * 9) / 16);
  const box = band ? { left: 0, top: Math.round((height - BH) / 2), width, height: BH } : { left: 0, top: 0, width, height };
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const film = n ? h(Footage, { key: "shot" + cur, shot: cur, style: box }) : null;

  // 2. Its words, found by their moment (an optional one left out never shifts the others): her hail, her stop word,
  // « Regarde », her pointing word, her hesitation, her last word.
  const nearest = (role, at) => reelTexts.filter((t) => t.role === role).sort((a, b) => Math.abs(a.from - at) - Math.abs(b.from - at))[0];
  const near = (role, at) => { const t = nearest(role, at); return t && Math.abs(t.from - at) <= 4 ? t : null; };
  const hail = near("hook", HAIL_FROM), stop = near("band", STOP1), look = near("band", LOOK), point = near("band", FIRST);
  const and = near("caption", AND_FROM), last = near("caption", LAST);
  // Each pop of her stop word and each product its own words when they were said so (her own voice: each time she says
  // it, as she says it), else the one written for all of them.
  const STOPS = [STOP1, STOP2, STOP3];
  const stopAt = (k) => near("band", STOPS[k]) || stop;
  const pointOn = (k) => (k > 1 && shots[k] ? near("band", shots[k].from) : null) || point;
  const mine = [hail, stop, look, point, and, last, stopAt(1), stopAt(2)].concat(shots.map((s, k) => pointOn(k)));
  const others = reelTexts.filter((t) => mine.indexOf(t) < 0);
  // French spacing: a non-breaking space before « ! ? : ; » and inside « », a number never broken from its digits.
  const keep = (s) => String(s || "").trim().replace(/\s+([!?:;»])/g, " $1").replace(/«\s+/g, "« ").replace(/(\d) (?=\d)/g, "$1 ");
  const lastText = last ? last.text : point ? (/[!?.…]$/.test(point.text.trim()) ? point.text : point.text + " !") : "";

  // Its lettering: her title font (the model's narrow serif when she chose it), upright, sentence case, one size for
  // every word (the original's « This »: 6,5 % of the height from its top to its baseline). Its ink: the original's pale
  // cream yellow (white, or her colour, as her words ask) where it reads on her picture, a deep warm ink where the picture
  // under the word is too bright for it (the original's cream reads at 1,6 on its plain grey wall, helped by its voice: on
  // a white plate or a pastel wall it vanishes), told from her light read under the word's box for the shot it is on
  // (LightUnder; read before the render, eight shots a Reel at most: her series, past them, takes her display's, often
  // the same place), each with a thin edge of the other tone, unseen where it is not needed.
  const display = "'" + brand.displayFont + "', 'Instrument Serif', serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return -1;
    const v = parseInt(m[1], 16);
    return 0.2126 * lin(((v >> 16) & 255) / 255) + 0.7152 * lin(((v >> 8) & 255) / 255) + 0.0722 * lin((v & 255) / 255);
  };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const colour = setting("couleur", "creme");
  const CREAM = "#fffcc0";
  const DEEP = "#2b2118";
  const HERS = colour === "blanc" ? "#ffffff" : colour === "sa-couleur" && lum(brand.accent) >= 0 ? brand.accent : CREAM;
  // Its edge: thin where its ink was chosen on its own shot's light; firmer (still tight, never a haze) where it was not
  // (a shot past the Reel's reads, a passage at another speed, her series taking her display's light).
  const edgeOf = (ink, sure) =>
    lum(ink) >= 0.3
      ? sure ? "0 0 1px rgba(38,30,18,0.62), 0 0 3px rgba(38,30,18,0.36)" : "0 0 2px rgba(38,30,18,0.8), 0 1px 4px rgba(38,30,18,0.5)"
      : sure ? "0 0 1px rgba(255,250,236,0.6), 0 0 3px rgba(255,250,236,0.34)" : "0 0 2px rgba(255,250,236,0.8), 0 1px 4px rgba(255,250,236,0.5)";
  const lightOn = (k, b) => {
    if (k < 0 || k >= n) return null;
    const area = { x: b.left, y: b.top, w: b.width, h: b.height };
    const read = LightUnder(shots[k], frame, box, area);
    if (read) return { mean: read.mean, own: true };
    const shown = k === n - 1 && n > 1 ? LightUnder(shots[0], frame, box, area) : null;
    return shown ? { mean: shown.mean, own: false } : null;
  };
  // Its ink on shot k under box b: { ink, sure } (sure: told from that shot's own light).
  const inkOn = (k, b) => {
    const read = lightOn(k, b);
    if (!read) return { ink: HERS, sure: false };
    const under = lin(read.mean);
    const other = lum(HERS) >= 0.3 ? DEEP : CREAM;
    const mine = ratio(lum(HERS), under);
    return { ink: mine >= 2.4 || ratio(lum(other), under) <= mine ? HERS : other, sure: read.own };
  };
  const S = Math.round(height * 0.087);
  const type = (size, choice, x) => ({ fontFamily: display, fontWeight: 400, fontSize: size, lineHeight: 1.12, letterSpacing: "-0.005em", color: choice.ink, textShadow: edgeOf(choice.ink, choice.sure), whiteSpace: "nowrap", ...x });
  const letters = (s) => Array.from(String(s || ""));

  // A word's box at its place (its centre, as shares of the frame), sized on its letters and kept in the safe zone:
  // under the middle of the frame between x 140 and 940 (the apps' buttons), never in its bottom quarter. Pushed back
  // inside the zone, the word keeps to that side of its box (as near its place as the zone lets it).
  const boxAt = (cx, cy, text, size) => {
    const tall = Math.round(size * 1.4);
    const top = Math.round(within(cy * height - tall / 2, 90, height * 0.75 - 12 - tall));
    const low = top + tall > height / 2;
    const L = low ? 140 : 52, R = low ? width - 140 : width - 52;
    const wide = Math.round(Math.min(R - L, Math.max(size * 1.2, letters(text).length * size * 0.5 + size * 0.4)));
    const wanted = cx * width - wide / 2;
    const left = Math.round(within(wanted, L, R - wide));
    const align = wanted < L - 1 ? "flex-start" : wanted > R - wide + 1 ? "flex-end" : "center";
    return { style: { position: "absolute", left, top, width: wide, height: tall }, align };
  };
  // A word that pops on shot k: there at once on its moment, gone at once (no grow, no fade, no bounce), keyed by its
  // words and its place (a FitText measures once).
  const pop = (key, text, cx, cy, size, k) => {
    const b = boxAt(cx, cy, keep(text), size);
    return h(FitText, { key: key + "-" + keep(text), style: b.style, innerStyle: type(size, inkOn(k, b.style), { alignItems: b.align }) }, keep(text));
  };
  // A stretched word typed letter by letter from its left edge on shot k (every letter in place from the start, the
  // ones to come unseen), then faded out: its share of letters at this frame between « from » and « typed », its fade
  // from « out ».
  const typed = (key, text, x0, cy, from, done, out, gone, k) => {
    const chars = letters(keep(text));
    const count = frame < from ? 0 : Math.min(chars.length, 1 + Math.floor(((frame - from) / Math.max(1, done - from)) * chars.length));
    const fade = interpolate(frame, [out, Math.max(out + 1, gone)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tall = Math.round(S * 1.4);
    const top = Math.round(within(cy * height - tall / 2, 90, height * 0.75 - 12 - tall));
    const low = top + tall > height / 2;
    const left = Math.round(within(x0 * width, low ? 140 : 52, width * 0.5));
    const right = low ? width - 140 : width - 52;
    // Its ink read under the part of its box its letters fill.
    const ink = inkOn(k, { left, top, width: Math.min(right - left, Math.round(chars.length * S * 0.45)), height: tall });
    return h(FitText, { key: key + "-" + keep(text), style: { position: "absolute", left, top, width: right - left, height: tall, opacity: fade }, innerStyle: type(S, ink, { alignItems: "flex-start", textAlign: "left" }) },
      h("span", null, chars.map((c, j) => h("span", { key: j, style: { opacity: j < count ? 1 : 0 } }, c))));
  };

  // 3. Where its pointing word lands on each product: the original's seven places, then five more of the same kind,
  // left and right in turn, high and low, never twice in a region (centres, shares of the frame).
  const SPOTS = [[0.245, 0.286], [0.69, 0.404], [0.316, 0.534], [0.36, 0.704], [0.71, 0.648], [0.67, 0.267], [0.497, 0.696], [0.3, 0.4], [0.7, 0.55], [0.42, 0.25], [0.62, 0.7], [0.28, 0.62]];
  const STOP_SPOTS = [[0.28, 0.271], [0.603, 0.442], [0.331, 0.66]];
  const words = [];
  // Her hail on her empty display, typed, then gone; her stop word on its three places, the third bigger; « Regarde ».
  if (hail && frame >= HAIL_FROM && frame < HAIL_GONE) words.push(typed("hail", hail.text, 0.256, 0.5, HAIL_FROM, HAIL_TYPED, HAIL_OUT, HAIL_GONE, 0));
  if (stop && frame >= STOP1 && frame < STOPPED) {
    const k = frame >= STOP3 ? 2 : frame >= STOP2 ? 1 : 0;
    words.push(pop("stop" + k, stopAt(k).text, STOP_SPOTS[k][0], STOP_SPOTS[k][1], k === 2 ? Math.round(S * 1.09) : S, 0));
  }
  if (look && frame >= LOOK && frame < FIRST) words.push(pop("look", look.text, 0.5, 0.493, S, 0));
  // Her pointing word on each product, from its cut to the next one (to the end when no series follows them).
  if (point && frame >= FIRST && frame < FINALE && !card) {
    const k = Math.max(0, cur - 1);
    const spot = SPOTS[k % SPOTS.length];
    words.push(pop("point" + k, pointOn(cur).text, spot[0], spot[1], S, cur));
  }
  // Her series together: her hesitation typed, held, faded; her last word alone in the middle to the end (or the card).
  if (and && frame >= AND_FROM && frame < AND_GONE && !card) words.push(typed("and", and.text, 0.142, 0.49, AND_FROM, AND_TYPED, AND_OUT, AND_GONE, n - 1));
  if (lastText && frame >= LAST && !card) words.push(pop("last", lastText, 0.5, 0.493, S, n - 1));

  // 4. Its ending card (in option): on her series, its title in the same serif where her last word was, its line under it.
  const titleBox = { position: "absolute", left: 140, top: Math.round(height * 0.37), width: width - 280, height: Math.round(S * 2.5) };
  const lineBox = { position: "absolute", left: 140, top: Math.round(height * 0.37 + S * 2.6), width: width - 280, height: Math.round(S * 1.25) };
  const cardInk = inkOn(n - 1, titleBox);
  const ending = card
    ? h(React.Fragment, { key: "card" },
        h(FitText, { key: "title-" + keep(end.title), style: titleBox, innerStyle: type(S, cardInk, { whiteSpace: "normal", textWrap: "balance", textAlign: "center" }) }, keep(end.title)),
        end.subtitle ? h(FitText, { key: "sub-" + keep(end.subtitle), style: lineBox, innerStyle: type(Math.max(56, Math.round(S * 0.5)), cardInk, { whiteSpace: "normal", textAlign: "center" }) }, keep(end.subtitle)) : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) => {
    const b = { position: "absolute", left: 140, top: 1240 - i * 120, width: width - 280, height: 110 };
    const choice = inkOn(cur, b);
    return h(FitText, { key: "x" + i + "-" + keep(t.text), style: b, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: choice.ink, textShadow: edgeOf(choice.ink, choice.sure), textAlign: "center" } }, keep(t.text));
  });

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, words, ending, extra);
}`;

export const celuiLa: MontageSkill = {
  key: "celui-la",
  // Also 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 3,
  bpm: BPM,
  // Its original's words are what its voice says: a voice says hers, each at its moments, unless she takes it away; or her
  // own recorded voice leads it, its words hers (heard).
  saysWords: {
    slots: ["appel", "arret", "regarde", "celui", "et", "fin"],
    default: true,
    hers: {
      counts: { appel: [0, 1], arret: [0, 3], regarde: [0, 1], celui: [3, 14], et: [0, 1], fin: [0, 1] },
      cases:
        "case 1 : son présentoir vide (ou sa vitrine), pendant ses premiers mots, jusqu'à ce qu'elle montre son premier produit ; puis une case par produit, dans l'ordre où elle les montre, chacune à partir de son mot pointé (le produit qu'elle nomme là quand elle le décrit) ; puis, quand elle dit une hésitation ou un dernier mot après eux, une dernière case : toute sa série réunie (sinon pas de série, son dernier produit va jusqu'à la fin)",
    },
  },
  // Her display, three to fourteen products, her series together.
  shots: [5, 16],
  files: [5, 16],
  how: "Son présentoir vide : un appel étiré tapé lettre à lettre (« Hééééé »), un mot qui l'arrête posé trois fois à trois endroits (« Attends ! »), « Regarde » au milieu ; puis ses produits un par temps, coupe sèche, et sur chacun le même mot pointé (« Celui-là ») qui tombe d'un coup chaque fois à un autre endroit de l'image, en grande serif crème ; enfin toute sa série réunie, une hésitation tapée lettre à lettre (« Eeeeet… ») pendant que la musique retient son souffle, et le dernier mot seul au milieu quand elle repart (« Celle-là ! »). Plein écran vertical, ou chaque plan entier dans une bande 16:9 sur du noir.",
  end: true,
  texts: [
    {
      slot: "appel",
      role: "hook",
      want: "l'appel du début, sur son présentoir vide, tapé lettre à lettre comme on le crie : un seul mot étiré (une forme comme « Hééééé », « Psssst », « Coucouuu »), jamais un mot anglais",
      max: 12,
      required: true,
    },
    {
      slot: "arret",
      role: "band",
      want: "le mot qui l'arrête, posé trois fois de suite à trois endroits (une forme comme « Attends ! », « Minute ! », « Pause ! ») ; un ou deux mots",
      max: 12,
      required: true,
    },
    {
      slot: "regarde",
      role: "band",
      want: "seul au milieu juste avant le premier produit, il se lit avec le mot de chaque produit (« Regarde… celle-là ») : « Regarde », « Regarde-moi », ou ce qu'elle montre en deux mots (« Mes tasses », « Les nouveautés ») ; deux mots au plus",
      max: 16,
      required: true,
    },
    {
      slot: "celui",
      role: "band",
      want: "le mot posé sur chacun de ses produits, le même à chaque fois, accordé à ce qu'ils sont : « Celui-là » (un bol, un bouquet, un gâteau), « Celle-là » (une tasse, une bougie, une robe), « Ceux-là », ou « Ça » ; un ou deux mots",
      max: 12,
      required: true,
    },
    {
      slot: "et",
      role: "caption",
      want: "l'hésitation avant le dernier, sur toute sa série réunie, étirée et tapée lettre à lettre (une forme comme « Eeeeet… », « Eeet… »)",
      max: 12,
      required: true,
    },
    {
      slot: "fin",
      role: "caption",
      want: "facultatif : le dernier mot, seul au milieu sur toute sa série réunie (une forme comme « Celle-là ! », « Tout ça ! », « La nouvelle ! ») ; deux mots au plus ; sans lui, le mot de chaque produit avec « ! »",
      max: 16,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : comme ses fichiers, vertical plein écran comme l'original, ou chaque plan entier dans une bande 16:9 sur du noir",
      choices: [
        { value: "vertical", says: "chaque plan plein écran, comme l'original (un plan horizontal y est recadré sur son sujet)" },
        { value: "horizontal", says: "chaque plan entier dans une bande 16:9 au milieu du noir, les mots posés sur la bande et sur le noir", band: true },
        { value: "auto", says: "comme ses fichiers : plein écran vertical, ou dans une bande 16:9 sur du noir quand la plupart sont horizontaux" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur des mots : le jaune crème de l'original, blanc, ou sa couleur",
      choices: [
        { value: "creme", says: "jaune crème pâle, comme l'original" },
        { value: "blanc", says: "blanc" },
        { value: "sa-couleur", says: "la couleur de sa charte" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo, words }) {
    // At another tempo (a longer Reel, a music's own), every landmark counted in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // Her display, her products (one a beat), her series together; at least one product.
    const products = Math.max(1, n - 2);
    const finale = FIRST + products;
    // With an ending card, its time after her last word's hold, on whole beats (the engine's 1,6 s at least).
    const card = end ? Math.ceil((END_CARD + 0.05) / beat) : 0;
    const spans = beatSpans(bpm, [FIRST - START, ...Array.from({ length: products }, () => 1), LAST + HOLD + card]);
    const duration = spans.at(-1)!.end;
    // A landmark's time on the Reel (s), from its beat on the original's grid.
    const at = (b: number) => round3((b - START) * beat);
    const first = spans[1]!.start;
    const series = spans.at(-1)!.start;
    const lastAt = at(finale + LAST);
    const wants = [
      `l'ouverture, ${comma(first)} s : son présentoir vide (un tabouret, une table, une étagère, son comptoir) ou sa vitrine, plan fixe et calme, où ses produits vont défiler ; trois mots s'y posent l'un après l'autre`,
      ...Array.from({ length: products }, (_, i) =>
        i === 0
          ? `son premier produit, seul et bien en vue (${comma(beat)} s), posé si possible là où les suivants le seront et filmé du même angle ; un mot tombe dessus ou à côté`
          : `un autre de ses produits (${comma(beat)} s), seul et bien en vue, au même endroit et du même angle que le précédent si elle les a filmés ainsi ; jamais un produit déjà montré`,
      ),
      `toute sa série réunie (ou sa pièce préférée posée en dernier), ${comma(duration - series)} s : une main qui pose la dernière pièce et se retire avant le dernier mot, qui tombe ${comma(lastAt - series)} s après le début du plan`,
    ];
    // What its voice says, as its original's says its words: each one on the frame its code shows it, her stop word on
    // each of its three pops, her pointing word on each product's cut; her last word, or (none written) her pointing word
    // with « ! », as its code writes it.
    const point = words?.celui?.trim();
    const lastSaid = words && !words.fin?.trim() && point ? { slot: "celui", text: /[!?.…]$/.test(point) ? point : `${point} !` } : { slot: "fin" };
    const says = [
      { slot: "appel", at: onFrame(at(HAIL.from)) },
      ...STOPS.map((b) => ({ slot: "arret", at: onFrame(at(b)) })),
      { slot: "regarde", at: onFrame(at(LOOK)) },
      ...spans.slice(1, 1 + products).map((s) => ({ slot: "celui", at: onFrame(s.start) })),
      { slot: "et", at: onFrame(at(finale + AND.from)) },
      { ...lastSaid, at: onFrame(lastAt) },
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      says,
      texts: {
        appel: { from: round(at(HAIL.from)), to: round(at(HAIL.gone)) },
        arret: { from: round(at(STOPS[0]!)), to: round(at(STOPPED)) },
        regarde: { from: round(at(LOOK)), to: round(first) },
        celui: { from: round(first), to: round(series) },
        et: { from: round(at(finale + AND.from)), to: round(at(finale + AND.gone)) },
        fin: { from: round(lastAt), to: round(end ? duration - END_CARD : duration) },
      },
      marks: {
        beat: round3(beat * 30),
        products,
        hail_from: toFrame(at(HAIL.from)),
        hail_typed: toFrame(at(HAIL.typed)),
        hail_out: toFrame(at(HAIL.out)),
        hail_gone: toFrame(at(HAIL.gone)),
        stop1: toFrame(at(STOPS[0]!)),
        stop2: toFrame(at(STOPS[1]!)),
        stop3: toFrame(at(STOPS[2]!)),
        stopped: toFrame(at(STOPPED)),
        look: toFrame(at(LOOK)),
        first: toFrame(first),
        finale: toFrame(series),
        and_from: toFrame(at(finale + AND.from)),
        and_typed: toFrame(at(finale + AND.typed)),
        and_out: toFrame(at(finale + AND.out)),
        and_gone: toFrame(at(finale + AND.gone)),
        last: toFrame(lastAt),
      },
      // Composed at its tempo and shaped as its voice: its first strong beat on beat 1; without its bass during her
      // hail, its bass in on the first product; stopped on her series just after its hit, which rings while her
      // hesitation is typed, back on her last word (its beat moved onto it), and on to the end, cut there (the
      // original's voice is cut by its end).
      music: {
        downbeat: at(1),
        filters: [{ kind: "thin", from: 0, to: round3(first) }],
        pauses: [{ from: round3(series + 0.25 * beat), to: lastAt, tail: round3(Math.min(1.2, LAST * beat - 0.35)) }],
        end: { at: duration, fade: 0.12 },
      },
    };
  },
  heard: heardLine,
  code: CODE,
};

/**
 * Its timeline under her own voice (MontageSkill.heard; own-voice.ts): her opening words before her first product (her
 * hail, her stop word up to three times, « Regarde »), her pointing word three to fourteen times (each one a product, cut
 * two images before she says it), her hesitation and her last word after them (her series, cut on the first of them);
 * a word out of that order is heard, never shown. Each word shows from when she says it, as she says it (a typed one
 * typed while she says it, faded before her next word), her last word held a second at least, the Reel lasting to just
 * after her last word (her ending card after it); its music thin until her first product, stopped on her series and back
 * on her last word. Her talk starts later when she points at once (her display held 0,6 s). Null when she points at
 * fewer than three things or more than fourteen, or so fast that a product would flash by.
 */
function heardLine(said: SkillHeard, { end }: { end: boolean }): SkillTimeline | null {
  const of = (slot: string) => said.words.filter((w) => w.slot === slot);
  const points = of("celui");
  if (points.length < 3 || points.length > 14) return null;
  const firstPoint = points[0]!;
  const lastPoint = points.at(-1)!;
  // Its opening words before her first product, in its order; its closing ones after her last.
  const before = (w: { end: number }, limit: number) => w.end <= limit + 0.02;
  const stops = of("arret").filter((w) => before(w, firstPoint.at)).slice(0, 3);
  const look = of("regarde").filter((w) => before(w, firstPoint.at) && (!stops.length || w.at >= stops.at(-1)!.end - 0.02)).at(-1);
  const hail = of("appel").find((w) => before(w, stops[0]?.at ?? look?.at ?? firstPoint.at));
  const and = of("et").find((w) => w.at >= lastPoint.end - 0.02);
  const last = of("fin").find((w) => w.at >= (and ?? lastPoint).end - 0.02);
  // Her talk on the Reel: later when she points at once, so her empty display holds OPEN_MIN.
  const lead = round3(Math.max(0, OPEN_MIN - (firstPoint.at - CUT_LEAD)));
  const reel = (t: number) => t + lead;
  const cuts = points.map((p) => onFrame(reel(p.at) - CUT_LEAD));
  const closing = and ?? last;
  const series = closing ? onFrame(reel(closing.at) - CUT_LEAD) : null;
  const edges = [...cuts, ...(series !== null ? [series] : [])];
  if (edges.some((c, i) => i > 0 && c - edges[i - 1]! < PRODUCT_MIN - 1e-6)) return null;
  // To just after her last word, her last word on screen held HEARD_HOLD at least; her ending card after it.
  const shownLast = last ?? (series !== null ? closing! : lastPoint);
  const close = onFrame(Math.max(reel(said.duration), reel(shownLast.at) + HEARD_HOLD));
  const duration = end ? onFrame(close + HEARD_CARD) : close;
  const until = end ? round(duration - END_CARD) : duration;
  // Every word she says, in order: the next one's moment ends a typed word's fade, and her stop word's pops.
  const said_ = [hail, ...stops, look, ...points, and, last].filter((w): w is SkillHeard["words"][number] => Boolean(w)).sort((a, b) => a.at - b.at);
  const nextAt = (w: SkillHeard["words"][number]) => {
    const next = said_[said_.indexOf(w) + 1];
    return next ? (next.slot === "celui" ? cuts[points.indexOf(next)]! : reel(next.at)) : duration;
  };
  // A stretched word typed while she says it, held a little, faded over four images before her next word lands.
  const typing = (w: SkillHeard["words"][number] | undefined) => {
    if (!w) return { from: ABSENT, typed: ABSENT, out: ABSENT, gone: ABSENT };
    const from = toFrame(reel(w.at));
    const out = Math.max(from + 1, Math.min(toFrame(reel(w.end)) + 8, toFrame(nextAt(w)) - 4));
    return { from, typed: Math.max(from + 1, Math.min(toFrame(reel(w.end)), out)), out, gone: out + 3 };
  };
  const hailing = typing(hail);
  const hesitating = typing(and);
  const stopped = stops.length ? Math.max(toFrame(reel(stops.at(-1)!.at)) + 4, Math.min(toFrame(nextAt(stops.at(-1)!)), toFrame(reel(stops.at(-1)!.end) + 0.25))) : ABSENT;
  const spans = [0, ...edges, duration].slice(0, -1).map((start, i, all) => ({ start: round(start), end: round(i + 1 < all.length ? all[i + 1]! : duration) }));
  const shown: NonNullable<SkillTimeline["shown"]> = [
    ...(hail ? [{ slot: "appel", text: hail.text, from: round(reel(hail.at)), to: round(hailing.gone / 30) }] : []),
    ...stops.map((w, k) => ({ slot: "arret", text: w.text, from: round(reel(w.at)), to: round(k + 1 < stops.length ? reel(stops[k + 1]!.at) : stopped / 30) })),
    ...(look ? [{ slot: "regarde", text: look.text, from: round(reel(look.at)), to: round(cuts[0]!) }] : []),
    ...points.map((w, k) => ({ slot: "celui", text: w.text, from: round(cuts[k]!), to: round(k + 1 < cuts.length ? cuts[k + 1]! : (series ?? until)) })),
    ...(and ? [{ slot: "et", text: and.text, from: round(reel(and.at)), to: round(hesitating.gone / 30) }] : []),
    ...(last ? [{ slot: "fin", text: last.text, from: round(reel(last.at)), to: round(until) }] : []),
  ].filter((w) => w.to > w.from);
  const texts = Object.fromEntries(shown.flatMap((w) => (shown.find((x) => x.slot === w.slot) === w ? [[w.slot, { from: w.from, to: w.to }]] : [])));
  const length = (i: number) => comma(spans[i]!.end - spans[i]!.start);
  const wants = [
    `l'ouverture, ${length(0)} s, pendant ses premiers mots : son présentoir vide (un tabouret, une table, une étagère, son comptoir) ou sa vitrine, plan fixe et calme, où ses produits vont défiler`,
    ...points.map((w, i) => `le produit qu'elle montre en disant « ${w.text} » (${length(i + 1)} s), seul et bien en vue, au même endroit et du même angle que les autres si elle les a filmés ainsi${i ? " ; jamais un produit déjà montré" : ""}`),
    ...(series !== null ? [`toute sa série réunie (ou sa pièce préférée posée en dernier), ${length(spans.length - 1)} s, pendant ${and ? "son hésitation et " : ""}son dernier mot`] : []),
  ];
  return {
    duration,
    shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
    texts,
    shown,
    lead,
    marks: {
      beat: round3((60 / BPM) * 30),
      products: points.length,
      hail_from: hailing.from,
      hail_typed: hailing.typed,
      hail_out: hailing.out,
      hail_gone: hailing.gone,
      stop1: stops[0] ? toFrame(reel(stops[0].at)) : ABSENT,
      stop2: stops[1] ? toFrame(reel(stops[1].at)) : ABSENT,
      stop3: stops[2] ? toFrame(reel(stops[2].at)) : ABSENT,
      stopped,
      look: look ? toFrame(reel(look.at)) : ABSENT,
      first: toFrame(cuts[0]!),
      finale: series !== null ? toFrame(series) : ABSENT,
      and_from: hesitating.from,
      and_typed: hesitating.typed,
      and_out: hesitating.out,
      and_gone: hesitating.gone,
      last: last ? toFrame(reel(last.at)) : ABSENT,
    },
    // Its music shaped as with its own voice, on hers: thin until her first product, stopped just after her series' cut
    // (its hit ringing while she hesitates) and back on her last word, then to the end.
    music: {
      downbeat: cuts[0]!,
      filters: [{ kind: "thin", from: 0, to: cuts[0]! }],
      ...(series !== null && last && reel(last.at) - series > 0.6
        ? { pauses: [{ from: round3(series + 0.15), to: round3(reel(last.at)), tail: round3(Math.min(1.2, reel(last.at) - series - 0.35)) }] }
        : {}),
      end: { at: duration, fade: 0.12 },
    },
  };
}
