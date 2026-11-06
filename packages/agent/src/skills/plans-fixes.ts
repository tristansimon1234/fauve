import { END_CARD_SECONDS, beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Plans fixes de cinéma », version 3, written again on its original's fiche (docs/fiches/plans-fixes.md: measured image
// by image at 30 i/s, its music measured, the video watched and heard by Gemini). Its music is a drumless electric piano
// at 64,6 BPM (Gemini heard a boom-bap beat at 85), its first beat half a beat in, on « The », and every length below is
// in its beats from the Reel's start, so its cuts fall where the original's do (within two images):
//   0 – 4,5    a wide still shot (its sunset), the camera posed; from its first beat its small title comes word by word
//              at the middle, on a calm area of the shot, each word set at once with a dry click: its small sans words
//              above (0 · 0,4 · 1), its bold serif words under them (1,6 · 2,5), all gone with the cut;
//   then still shots of a beat each, cut on the chord, the world moving in them, one with something passing close to
//   the lens in the middle, its last three from dusk to night;
//   the last one held two beats, its closing line (her ending card's words, else her name) fading in small at the
//   middle 0,83 beat after the cut, over 19 images, no veil; its music dies away over the last beat and stops with it.
//   Her name is then held two seconds at least (the engine's heldEnding: two beats more than the original's).
// Played as the original, a horizontal 4:3 picture on black, when her files are mostly horizontal (or she asks), else
// full frame (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »). Her shots as
// filmed: the camera never moves, never zooms (a still shot is the effect), a photo stays still, a video plays.

const BPM = 64.6;
/** The first shot (half a beat before its music's first beat, then four), each still shot, the last one, in beats. */
const OPENING = 4.5;
const SHOT = 1;
const LAST = 2;
/** Past ten shots in the middle (a length she asked for), each one more is held two beats. */
const MORE = 2;
/** The engine's ending card: the Reel's last 2,5 s (motion.ts, END_CARD_SECONDS); its last shot held whole beats longer for it. */
const END_CARD = END_CARD_SECONDS;
/** Its closing line fades in this far after the last cut, over this long (beats: the original's images 342 to 361). */
const CLOSE_FROM = 0.83;
const CLOSE_IN = 0.68;
/** Its title's words, in beats from its first: the small ones over the first beat, each waiting a little longer; the serif ones from 1,6 to 2,5. */
const SMALL_SPAN = 1;
const SMALL_EASE = 1.2;
const SERIF_FROM = 1.6;
const SERIF_TO = 2.5;
/** The click on each word of its title, as it lands (the sound library's « light click »). */
const CLICK = { sound: "light click", seconds: 0.5 };
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;

/** Its words as its code splits them: by spaces, a separator (« · », « — ») kept with the word before it. */
function titleWords(text: string | undefined): string[] {
  const out: string[] = [];
  for (const w of String(text ?? "").split(/[ \t\n]+/).filter(Boolean)) {
    if (out.length && !/[\p{L}\p{N}]/u.test(w)) out[out.length - 1] += "\u00a0" + w;
    else out.push(w);
  }
  return out;
}

/**
 * The frame each word of its title lands on, as its code lays them (`start`, its first frame; `beat`, frames a beat): its
 * small words over the first beat, each waiting a little longer than the one before, its serif words from beat 1,6 to
 * 2,5 (the original's « The power of / Static shot »: beats 0 · 0,4 · 1 · 1,6 · 2,5, images 14, 26, 41, 59 and 83).
 */
export function wordFrames(small: number, serif: number, start: number, beat: number): number[] {
  const from = small ? SERIF_FROM : 0;
  return [
    ...Array.from({ length: small }, (_, i) => (small > 1 ? SMALL_SPAN * Math.pow(i / (small - 1), SMALL_EASE) : 0)),
    ...Array.from({ length: serif }, (_, j) => from + (serif > 1 ? (j / (serif - 1)) * (SERIF_TO - from) : 0)),
  ].map((b) => Math.round(start + b * beat));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const BEAT = Math.max(1, mark("beat", 27.864));
  const CLOSE = mark("close", durationInFrames + 1);
  const CLOSE_IN = Math.max(1, mark("close_in", 19));
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

  // Its frame: a horizontal 4:3 picture on black, as the original, when most of her files are horizontal (or she asks),
  // else the whole vertical frame; every place below is in it.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 3) / 4) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };

  // Its two faces: a bold serif for its title, a geometric sans for its small words and its closing line.
  const display = "'" + brand.displayFont + "', 'EB Garamond', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Poppins', 'Inter Tight', sans-serif";
  // White, with the original's tight dark halo, and a thin dark edge of its own (her shots are not all as dark as its
  // river: on pale roses or a white shirt, a halo alone did not hold the letters).
  const halo = "0 0 1px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.45), 0 1px 10px rgba(0,0,0,0.25)";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const small = reelTexts.find((t) => t.role === "caption");
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== small && t !== hook);

  // 1. Her still shots in its frame, cut on its beats, as filmed: the camera never moves nor zooms, a photo stays still,
  // a video plays. Full frame, a video in width seen again shows the part of its picture next to the first one (most of
  // a frame over, toward the side with room), never a closer frame; in its 4:3 frame, as it is.
  const again = (i) => {
    let k = 0;
    for (let j = 0; j < i; j++) if (shots[i] && shots[i].src && shots[j].src === shots[i].src) k++;
    return k;
  };
  const place = (i) => {
    const sh = shots[i];
    const k = sh ? again(i) : 0;
    const a = sh ? Number(sh.aspect) || 0.5625 : 0.5625;
    if (!wide && k && k <= 2 && a > 1.2) {
      const W = Math.round(bh * a);
      const room = W - bw;
      const fx = sh.focus && Number.isFinite(sh.focus.x) ? sh.focus.x : 0.5;
      const first = Math.max(0, Math.min(room, fx * W - bw / 2));
      const toward = first > room / 2 ? -1 : 1;
      const left = Math.max(0, Math.min(room, first + (k === 1 ? toward : -toward) * 0.6 * bw));
      if (Math.abs(left - first) >= 0.3 * bw) return { position: "absolute", left: -Math.round(left), top: 0, width: W, height: bh };
    }
    return { position: "absolute", left: 0, top: 0, width: bw, height: bh };
  };
  const film = n ? h(Footage, { shot: cur, style: place(cur) }) : null;

  // 2. Its small title at the middle of its first shot, on two levels, each line laid out whole from the start and its
  // words shown one by one, each at once: its small sans words above (a small label), over its first beat, each waiting
  // a little longer than the one before; its bold serif words under them, from beat 1,6 to 2,5 (the original: 0 · 0,4
  // · 1 · 1,6 · 2,5); gone with the cut. Set on the calmest area of the middle of her shot (the original's sits under
  // its horizon, on the dark city), else at the very middle. A separator (« · », « — ») stays with the word before it.
  const split = (text) => {
    const out = [];
    String(text || "").split(/[ \t\n]+/).filter(Boolean).forEach((w) => {
      if (out.length && !/[\p{L}\p{N}]/u.test(w)) out[out.length - 1] += "\u00a0" + w;
      else out.push(w);
    });
    return out;
  };
  const sw = small ? split(small.text) : [];
  const tw = hook ? split(hook.text) : [];
  const start = Math.min(small ? small.from : Infinity, hook ? hook.from : Infinity);
  const smallBeat = (i) => (sw.length > 1 ? Math.pow(i / (sw.length - 1), 1.2) : 0);
  const serifFrom = sw.length ? 1.6 : 0;
  const serifBeat = (j) => serifFrom + (tw.length > 1 ? (j / (tw.length - 1)) * (2.5 - serifFrom) : 0);
  const lands = (b) => Math.round(start + b * BEAT);
  const smallOn = small && frame >= start && frame < small.to;
  const hookOn = hook && frame >= start && frame < hook.to;
  // Its sizes, the original's at 1080 px wide (its serif's capitals 60 px, EB Garamond's 0,66 of its size; its small words' 19 px), in both formats.
  const SMALL = 28;
  const SERIF = 91;
  const TOP_H = 40;
  const GAP = 10;
  const SERIF_H = 100;
  const H = TOP_H + GAP + SERIF_H;
  // Its width from its words (a bold serif's letter is about half its size), within the band it may go in.
  const chars = (list) => list.join(" ").length;
  const blockW = Math.min(800, Math.max(360, Math.round(chars(tw) * SERIF * 0.52), Math.round(chars(sw) * SMALL * 0.56 + Math.max(0, sw.length - 1) * SMALL * 0.5)));
  const centre = { x: Math.round((bw - blockW) / 2), y: Math.round(bh / 2 - H / 2), w: blockW, h: H };
  // Where it may go: the middle of her picture, inside the Reel's safe zone and left of the apps' buttons.
  const band = { x: Math.round((bw - 800) / 2), y: Math.round(bh * (wide ? 0.3 : 0.36)), w: 800, h: Math.round(bh * (wide ? 0.42 : 0.28)) };
  const spot = smallOn || hookOn
    ? ClearBox(shots[0], frame, laid, { aspect: blockW / H, min: { w: Math.round(blockW * 0.85), h: Math.round(H * 0.85) }, max: { w: blockW, h: H }, sky: false, prefer: "any", within: band, pad: 6, fallback: centre }) || centre
    : centre;
  const fit = Math.min(1, spot.h / H);
  const word = (w, i, at) => [i ? " " : null, h("span", { key: i, style: { whiteSpace: "nowrap", opacity: frame >= at ? 1 : 0 } }, w)];
  const smallStyle = { fontFamily: body, fontWeight: 600, fontSize: Math.round(SMALL * fit), lineHeight: 1.2, wordSpacing: "0.5em", color: "#ffffff", whiteSpace: "nowrap", textShadow: halo, justifyContent: "flex-end" };
  const serifStyle = { fontFamily: display, fontWeight: 700, fontSize: Math.round(SERIF * fit), lineHeight: 1.0, letterSpacing: "-0.04em", color: "#ffffff", whiteSpace: "nowrap", textShadow: halo, justifyContent: "flex-start" };
  const kicker = smallOn
    ? h(FitText, { key: "k", style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(TOP_H * fit) }, innerStyle: smallStyle },
        h("span", { "data-fauve-accent": "" }, sw.flatMap((w, i) => word(w, i, lands(smallBeat(i))))))
    : null;
  const title = hookOn
    ? h(FitText, { key: "t", style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y + (TOP_H + GAP) * fit), width: Math.round(spot.w), height: Math.round(SERIF_H * fit) }, innerStyle: serifStyle },
        h("span", null, tw.flatMap((w, j) => word(w, j, lands(serifBeat(j))))))
    : null;

  // 3. Its closing line, small at the middle of its last shot, as the original's « Follow for more »: her ending card's
  // words (a second line under it when it has one), else her name; in the sans of its small words, bold, fading in over
  // 19 images from 0,83 beat after the last cut, held to the end (her name two seconds at least: the engine holds it,
  // heldEnding); no veil, nothing darkened, only a thin dark edge (her last shot may be bright). 64 px (the original's 36
  // px would not read on a phone, its 48 px until v5 were lost in the middle of the picture).
  const plain = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const name = String(brand.name || "").trim();
  const line = end ? keep(end.title) : name && !(hook && plain(hook.text) === plain(name)) ? name : "";
  const fade = (a) => interpolate(frame, [a, a + CLOSE_IN], [0, 1], clamp);
  const mid = Math.round(bh / 2);
  const two = Boolean(end && end.subtitle);
  const closeStyle = { fontFamily: body, fontWeight: 700, fontSize: 64, lineHeight: 1.18, color: "#ffffff", whiteSpace: "normal", textWrap: "balance", textAlign: "center", textShadow: "0 0 1px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.6), 0 1px 6px rgba(0,0,0,0.35)" };
  const closing = line && frame >= CLOSE
    ? h(React.Fragment, null,
        h(FitText, { key: "c", style: { position: "absolute", left: 140, top: two ? mid - 136 : mid - 65, width: bw - 280, height: 130 }, innerStyle: { ...closeStyle, justifyContent: two ? "flex-end" : "center" } },
          h("span", { style: { opacity: fade(CLOSE) } }, line)),
        two
          ? h(FitText, { key: "s", style: { position: "absolute", left: 140, top: mid + 6, width: bw - 280, height: 130 }, innerStyle: { ...closeStyle, fontWeight: 500, justifyContent: "flex-start", fontVariantNumeric: "lining-nums" } },
              h("span", { style: { opacity: fade(CLOSE + 6) } }, keep(end.subtitle)))
          : null)
    : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film, kicker, title, closing);

  // Any other text of the Reel (none in its slots): a plain white line, above its frame in width, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.max(100, by - 130 - i * 120) : 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: halo } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

export const plansFixes: MontageSkill = {
  key: "plans-fixes",
  // 2: the original's dry click on each word of the title, as it lands (its timeline's sounds).
  // 3: written again on its original's fiche: its format (horizontal 4:3 when her files are), its tempo (64,6 BPM) and
  // its cuts, its title's words on its beats, set on a calm area in a bold serif, its closing line that fades in, its
  // music dying away with the picture, no move on any shot, its finish without warmth, grain nor vignette.
  // 4: its title's serif measured on its original's letters (Tristan: « la police est slightly différente »): its
  // x-height 0,65 of its capitals and « Static shot » 5,5 capitals wide, letters almost touching; EB Garamond 700 at
  // -0,04 em sets 0,65 and 5,5, Lora 700 set 0,72 and 6,3 (rounder, a larger eye, looser).
  // Also 4: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  // 5: its closing line (her name) held two seconds at least once faded in (the engine's heldEnding: two beats more, it
  // was half a second) and set at 64 px (Tristan, 6 November: « les scènes de fin avec le nom du commerce sont souvent
  // trop courtes »).
  version: 5,
  bpm: BPM,
  shots: [5, 12],
  // Up to 20 for a length she asks for: about 30 s at its own tempo.
  long: 20,
  files: [4, 10],
  how: "Des plans fixes, la caméra posée, le monde qui bouge dedans, en vertical plein écran (en horizontal 4:3 sur du noir comme l'original à sa demande) : le premier tenu quatre temps et demi, un petit titre blanc au milieu sur une zone calme, en deux niveaux, ses petits mots sans serif au-dessus puis ses mots en serif gras dessous, chaque mot posé d'un coup avec un clic sec ; puis un plan fixe par temps, coupé sur la musique, un passage tout près du téléphone au milieu, le soir qui tombe sur les derniers ; et un dernier plan du soir ou de nuit tenu deux temps, où sa phrase de fin (ou son nom) se fond en petit au milieu, sans voile.",
  end: true,
  texts: [
    {
      slot: "accroche",
      role: "caption",
      want: "2 à 4 petits mots sans serif au-dessus du titre, qui l'amènent (une forme comme « le pouvoir du », « un soir à », « la lumière de »)",
      max: 22,
      required: true,
    },
    {
      slot: "titre",
      role: "hook",
      want: "le petit titre en serif gras sous ces mots, 1 ou 2 mots : son lieu, son quartier ou le moment (une forme comme « plan fixe », « Belleville », « l'heure dorée »)",
      max: 18,
      required: true,
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
  ],
  // Its original's grade (docs/fiches/plans-fixes.md, effect 6): contrasted, rich colours, each shot in the light of its
  // hour; none of the catalogue's « Heure dorée » warmth, grain or corners laid over everything (it warmed the blue hour).
  finish: { contrast: 0.1, saturation: 0.08, warmth: 0, grain: 0, vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At her music's tempo when one is given (slower: a longer, calmer Reel; faster: a shorter one), else the model's.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(5, Math.min(20, n));
    // The opening shot, a still shot a beat (past ten, two beats), the last one held two beats; with an ending card, the
    // last one held whole beats longer, so her words have the card's time.
    const middle = Array.from({ length: count - 2 }, (_, i) => (i < 10 ? SHOT : MORE));
    const last = LAST + (end ? Math.ceil(END_CARD / beat - 1e-6) : 0);
    const spans = beatSpans(bpm, [OPENING, ...middle, last]);
    const duration = spans.at(-1)!.end;
    const cut = spans[1]!.start;
    const lastCut = spans.at(-1)!.start;
    // Something passing close to the lens in the middle of the Reel (the original's 6th shot of 9), and its last shots
    // from dusk to night (the original's last three), the middle in any light of the day.
    const passing = Math.max(1, Math.round((count - 3) * 0.75));
    const dusk = count >= 7 ? [count - 3, count - 2] : [];
    const wants = [
      "le plan fixe qui ouvre, large et beau, le téléphone posé sans bouger : sa rue, sa devanture ou son lieu, idéalement au coucher du soleil ; le milieu de l'image calme et plutôt sombre (le petit titre s'y pose) ; tenu quatre secondes",
      ...middle.map((_, k) =>
        k + 1 === passing
          ? "un plan fixe où quelqu'un ou quelque chose passe tout près du téléphone posé (un serveur, un client, un vélo, une voiture, un chien) : le seul plan qui bouge fort ; sinon un plan où des gens bougent"
          : dusk.includes(k + 1)
            ? "un plan fixe du soir qui tombe (le crépuscule, l'heure bleue), le téléphone posé : des lumières, des passants"
            : "un plan fixe de son lieu ou de son quartier, le téléphone posé sans bouger, bien composé : quelque chose bouge dans le cadre (des passants, des mains au travail, une porte, de la vapeur, des phares)",
      ),
      `le dernier plan fixe, tenu jusqu'à la fin : un plan du soir ou de nuit, calme, des lumières (${end ? "sa phrase de fin" : "son nom"} s'y pose en petit au milieu)`,
    ];
    // Its words come from its music's first beat, half a beat in, and go with the cut.
    const from = round(onFrame(beat / 2));
    // A click on each word as its code lays it (its beat in frames as its code reads it, its words' first frame).
    const words = options.words;
    const frames = words ? wordFrames(titleWords(words.accroche).length, titleWords(words.titre).length, Math.round(from * 30), Math.round(beat * 30 * 1000) / 1000) : [];
    return {
      duration,
      // Its music dies away over its last beat and stops with the picture, as the original's.
      music: { end: { at: duration, fade: round(beat) } },
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: {
        accroche: { from, to: round(cut) },
        titre: { from, to: round(cut) },
      },
      marks: {
        beat: beat * 30,
        // Its closing line: from 0,83 beat after the last cut, in over 0,68 beat (19 images at its own tempo).
        close: toFrame(lastCut + CLOSE_FROM * beat),
        close_in: Math.max(1, Math.round(CLOSE_IN * beat * 30)),
      },
      // Her name, whole once faded in, to the end: held two seconds at least by the engine (it was half a second); with
      // an ending card, its words have the card's time.
      ...(end ? {} : { ending: { from: round((lastCut + (CLOSE_FROM + CLOSE_IN) * beat) + 1 / 30) } }),
      ...(frames.length ? { sounds: frames.map((f) => ({ at: f / 30, ...CLICK })) } : {}),
    };
  },
  code: CODE,
};
