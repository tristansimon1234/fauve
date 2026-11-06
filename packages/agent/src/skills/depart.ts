import { beatSpans, toFrame, type MontageSkill, type SkillShot } from "../skills.ts";

// « Le grand départ », version 1, written on its original's fiche (docs/fiches/depart.md: measured image by image at
// 30 i/s, its zooms fitted on its own frames, its colours read on the pixels, its sound by bands; Tristan: « c'est un
// effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A trip told in eleven seconds, in black and
// white: someone stands at the place he leaves, a bus passes right before the lens and he is gone; the journey in
// flashes, each heard with its own sound and no music; the music comes in with the arrival, a crowd rushing, and a
// small gold title in the middle. Its music (a calm melodic lo-fi, no sub-bass, a soft backbeat every 1,082 s) is
// counted at 110,9 BPM, a beat every 0,541 s from the first image; every length below is in its beats, so its cuts fall
// within an image of the original's:
//   0 – 1,5      him at his place, the original's zoom out in three steps (2,88, 2,04 and 1,56 times, its images 0,
//                1–2 and 3–4), then the whole street, at 15 images a second; a bus crosses from the right and covers the
//                whole picture; the cut under it (its image 25);
//   1,5 – 2      the same place without him, held still (seven images);
//   2 – 6        the journey, four shots at their own pace and with their own sound (a metro in its tunnel 0,625, a wing
//                on its runway 0,5, a train's window 1,875, an escalator 1, which rushes onto its arrival sign on its last
//                half beat: 3,6 times in eight images, faster and faster); no music;
//   6 – 20,625   the music comes in on the arrival: three crowds rushing (accelerated, about six times), 3,125, 4,375
//                and 7,125 beats; a beat into the last, two small lines in a muted gold, fading in over nine images, in
//                the middle of the picture to the end.
// Here she stands at her place (her door, her front, her counter), something passes close before her lens (a car, a
// bus, someone: the cut hidden there, read on her files, `covered`), and a blurred mass drawn the same way passes over
// that cut whatever her video has, so she always vanishes; her journey in two to four shots with their sound, the last
// one rushing onto where she goes; her arrival twice as fast as filmed (the engine's most, SkillShot.speed); her two
// lines in her colour when it reads on grey, else the gold. Its words are hers (the original's « Slow down / Japan », its
// signs and its places are its author's: never copied). Vertical full frame as the original when her videos are upright,
// whole in 16:9 bands on black when most are in width, or as her words ask (Tristan: « format par défaut [comme ses
// vidéos], et changement à la demande du user »). More of her arrival for a length she asks for, 4 beats a shot.

const BPM = 110.9;
/** Its opening in beats: her at her place (the cut under what passes on its last image), her place empty, held. */
const STAND = 1.5;
const EMPTY = 0.5;
/** Its journey for two to four shots, in beats (four in all): the original's metro, wing, train and escalator. */
const TRIP: Record<number, number[]> = { 2: [3, 1], 3: [0.625, 2.375, 1], 4: [0.625, 0.5, 1.875, 1] };
/** Its arrival for two or three shots (14,625 beats in all), the original's three crowds; more for a length she asks for. */
const ARRIVAL: Record<number, number[]> = { 2: [7.5, 7.125], 3: [3.125, 4.375, 7.125] };
const MORE = 4;
/** Its fewest shots, its own count, its most for a length she asks for (about 26 s at its tempo). */
const FEWEST = 6;
const ORIGINAL = 9;
const LONGEST = 16;
/** The rush onto where she arrives: the last half beat of her journey (the original's eight images, 2,93 – 3,2 s). */
const RUSH = 0.5;
/** Her two lines come a beat into the last shot of her arrival (the original's 7,8 s), and stay. */
const TITLE_IN = 1;
/** The engine's ending card: the Reel's last 1,6 s, over her last arrival shot held whole beats longer. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");

/** How many shots of her journey and of her arrival it plays for n shots (2 + journey + arrival). */
export function departCounts(n: number): { trip: number; arrival: number } {
  const count = Math.max(FEWEST, Math.min(LONGEST, Math.round(n)));
  const trip = Math.min(4, count - 4);
  return { trip, arrival: count - 2 - trip };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const BEAT = Math.max(1, mark("beat", 16));
  const TRIP = Math.max(1, Math.min(n, Math.round(mark("trip", 2))));
  const ARRIVAL = Math.max(TRIP, Math.min(n, Math.round(mark("arrival", n - 2))));
  const at = (i, d) => (shots[i] ? shots[i].from : d);
  const CUT = at(1, Math.round(1.5 * BEAT));
  const LANDS = at(ARRIVAL, durationInFrames);
  const RUSH = Math.min(LANDS - 1, Math.round(mark("rush", LANDS - 8)));
  const TITLE = Math.round(mark("title", durationInFrames - 6 * BEAT));

  // 1. Its frame: her upright videos full frame; whole in a 16:9 band on black when most are in width (or as she asks).
  const format = setting("format", "auto");
  const inWidth = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const band = format === "horizontal" || (format === "auto" && n > 0 && inWidth * 2 > n);
  const BH = Math.round((width * 9) / 16);
  const BOX = band ? { left: 0, top: Math.round((height - BH) / 2), width, height: BH } : { left: 0, top: 0, width, height };
  const boxed = { position: "absolute", left: BOX.left, top: BOX.top, width: BOX.width, height: BOX.height, overflow: "hidden" };
  // Black and white as the original's (its blacks deep); her arrival a touch warm, as its crowds.
  const GREY = "grayscale(1) contrast(1.1)";
  const WARM = "grayscale(1) sepia(0.09) contrast(1.08)";
  // One of her shots in its box, scaled s times about the point (cx, cy) of its picture, which always covers the box.
  const pic = (i, s, cx, cy, extra, filter, key) => {
    const w = BOX.width * s;
    const ht = BOX.height * s;
    const left = Math.min(0, Math.max(BOX.width - w, BOX.width / 2 - cx * w));
    const top = Math.min(0, Math.max(BOX.height - ht, BOX.height / 2 - cy * ht));
    return h("div", { key: key || "s" + i, style: boxed },
      h(Footage, { shot: i, style: { position: "absolute", left: Math.round(left), top: Math.round(top), width: Math.round(w), height: Math.round(ht), filter: filter || GREY }, ...(extra || {}) }));
  };

  // 2. Her at her place: the original's zoom out in three steps about her middle (2,88, 2,04, 1,56 times on its images
  // 0, 1–2 and 3–4), then her whole place; each image held two frames (15 a second), as the original's first second.
  const STEPS = [2.88, 2.04, 2.04, 1.56, 1.56];
  const stand = n > 0 ? pic(0, frame < 5 ? STEPS[frame] : 1, 0.5, 0.53, { hold: 2 }, GREY, "stand") : null;
  // Her place empty, held still on its first image (the original's seven images).
  const empty = n > 1 ? pic(1, 1, 0.5, 0.5, { hold: Math.max(2, shots[1].durationInFrames) }, GREY, "empty") : null;

  // 3. What passes before her lens, as the original's bus: a dark blurred mass from the right that covers her whole
  // picture from six images before the cut to one after (the cut under it, unseen), then leaves to the left, its edge
  // sweeping over her place empty; at 15 images a second like the shot. The same mass over her own passer-by.
  const E = BOX.width * 0.22;
  const v0 = CUT - 12;
  const step = v0 + Math.floor((frame - v0) / 2) * 2;
  const L = interpolate(step, [v0, CUT - 6], [BOX.width, -E], clamp);
  const R = interpolate(step, [CUT + 1, CUT + 6], [BOX.width + E, 0], clamp);
  const mask = "linear-gradient(to right, transparent " + Math.round(L) + "px, #000 " + Math.round(L + E) + "px, #000 " + Math.round(R - E) + "px, transparent " + Math.round(R) + "px)";
  const veil = n > 1 && frame >= v0 && frame < CUT + 6
    ? h("div", { key: "veil", style: { ...boxed, WebkitMaskImage: mask, maskImage: mask } },
        h("div", { style: { position: "absolute", left: Math.round(BOX.width * 0.375), top: Math.round(BOX.height * 0.375), width: Math.round(BOX.width / 4), height: Math.round(BOX.height / 4), transform: "scale(9.6)", filter: "blur(7px) brightness(0.45) grayscale(1)" } },
          h(Footage, { shot: 0, at: frame - Math.max(0, CUT - 1 - at(0, 0)), style: { position: "absolute", left: 0, top: 0, width: Math.round(BOX.width / 4), height: Math.round(BOX.height / 4) } })))
    : null;

  // 4. Her journey, each shot as filmed (its sound heard: no music yet); the last one rushes onto where she arrives on its
  // last half beat: 3,6 times in eight images, faster and faster, a little above the middle (where a sign, a door is).
  const p = Math.max(0, Math.min(1, (frame - RUSH + 1) / Math.max(1, LANDS - RUSH)));
  const rush = frame >= RUSH && frame < LANDS ? Math.pow(3.6, Math.pow(p, 1.4)) : 1;
  const trip = cur >= TRIP && cur < ARRIVAL ? pic(cur, cur === ARRIVAL - 1 ? rush : 1, 0.5, 0.42, null, rush > 1 ? GREY + " blur(" + (2.5 * p).toFixed(1) + "px)" : GREY, "t" + cur) : null;
  // Her arrival (played faster by the engine, as the original's crowds), a touch warm.
  const arrival = cur >= ARRIVAL ? pic(cur, 1, 0.5, 0.5, null, WARM, "a" + cur) : null;

  // 5. Her two lines, small in the middle of the picture (the original's 45 % down), in her colour when it reads on grey,
  // else a muted gold; her body font, regular; fading in over nine images a beat into her last shot, held to the end.
  const luma = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return -1; const v = parseInt(m[1], 16); return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255; };
  const chroma = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return 0; const v = parseInt(m[1], 16); const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255; return (Math.max(r, g, b) - Math.min(r, g, b)) / 255; };
  const INK = luma(brand.accent) >= 0.45 && chroma(brand.accent) >= 0.18 ? brand.accent : "#cdb672";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const keep = (s) => String(s || "").normalize("NFC").replace(/(\d) (?=\d)/g, "$1 ");
  const hook = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== line);
  const Y = Math.round(height * 0.45);
  const SIZE = 60;
  const lineStyle = { fontFamily: body, fontWeight: 500, fontSize: SIZE, lineHeight: 1.12, letterSpacing: "0.01em", color: INK, whiteSpace: "nowrap", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.5), 0 0 22px rgba(0,0,0,0.4)" };
  const row = (text, top, opacity, key) => h(FitText, { key: key + "-" + keep(text), style: { position: "absolute", left: 140, width: width - 280, top, height: Math.round(SIZE * 1.3) }, innerStyle: { ...lineStyle, opacity } }, keep(text));
  const two = (a, b, opacity, key) => (a && b
    ? [row(a, Y - Math.round(SIZE * 1.3), opacity, key + "1"), row(b, Y, opacity, key + "2")]
    : [row(a || b, Y - Math.round(SIZE * 0.65), opacity, key)]);
  const shown = (t) => t && frame >= t.from && frame < Math.min(t.to, endAt);
  const start = hook ? hook.from : TITLE;
  const fade = interpolate(frame, [start, start + 9], [0, 1], clamp);
  const title = shown(hook) ? two(shown(line) ? line.text : "", hook.text, fade, "title") : [];
  // Its ending card, only when the Reel has one: its words in their place, the same way, over her last shot still playing.
  const card = end && frame >= endAt ? two(end.title, end.subtitle || "", interpolate(frame, [endAt, endAt + 9], [0, 1], clamp), "card") : [];

  // Any other text of the Reel (none in its slots): a plain line under her two lines, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 1120 + i * 110, width: width - 280, height: 100 }, innerStyle: { ...lineStyle, fontSize: 52 } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, cur === 0 ? stand : null, cur === 1 ? empty : null, trip, arrival, veil, ...title, ...card, ...extra);
}`;

export const depart: MontageSkill = {
  key: "depart",
  version: 1,
  bpm: BPM,
  shots: [FEWEST, ORIGINAL],
  long: LONGEST,
  files: [4, 10],
  // A trip on the beat: slower is longer and calmer.
  tempo: [92, 124],
  // The moments something passes right before her lens (video_read.py): the filler sets her first passage so the most
  // covered image falls on the cut where she vanishes.
  reads: ["covered"],
  how: "La personne debout devant son lieu, le téléphone posé : l'image part de près sur elle et recule en trois sauts, en noir et blanc saccadé ; quelque chose passe tout près devant l'objectif (une voiture, un bus, quelqu'un, sinon une masse floue dessinée) et la personne a disparu : son lieu vide, tenu un instant ; puis son trajet en éclairs, chaque plan avec son propre son et sans musique (une vitre de train, la route, un métro, un escalier), le dernier qui fonce d'un coup sur ce vers quoi elle va ; la musique arrive avec l'arrivée, un endroit plein de vie en accéléré, et deux petites lignes dorées au milieu de l'image. En vertical plein écran ; ses vidéos horizontales entières dans une bande 16:9 sur du noir.",
  end: true,
  texts: [
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : la première des deux petites lignes de l'arrivée, au-dessus du lieu : ce qu'on y fait ou ce qu'on y dit, un à trois mots (une forme comme « Ce week-end », « Rendez-vous », « Bienvenue », « On arrive ») ; jamais une phrase",
      max: 24,
      required: false,
    },
    {
      slot: "lieu",
      role: "hook",
      want: "la seconde ligne, le lieu ou l'événement où l'on arrive : ses deux à quatre mots les plus forts tirés de sa demande, jamais sa phrase entière (une forme comme « au marché aux puces », « Lyon », « Salon du chocolat », « notre nouvelle adresse »)",
      max: 24,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran comme l'original, ou ses vidéos horizontales entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme ses vidéos : plein écran quand la plupart sont en hauteur, sinon entières dans une bande 16:9 sur du noir" },
        { value: "vertical", says: "vertical plein écran, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 au milieu de l'écran, sur du noir" },
      ],
    },
    {
      name: "arrivee",
      want: "l'arrivée : en accéléré comme l'original (une foule qui court), ou à sa vitesse réelle",
      choices: [
        { value: "acceleree", says: "deux fois plus vite que filmée, comme les foules de l'original" },
        { value: "normale", says: "à sa vitesse réelle" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo, settings }) {
    // At another tempo (a longer Reel, a music's own): every length in beats follows it; its zoom steps stay images.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const { trip, arrival } = departCounts(n);
    const lands = arrival <= 3 ? ARRIVAL[arrival]! : [3.125, 4.375, ...Array.from({ length: arrival - 3 }, () => MORE), 7.125];
    // With an ending card, her last arrival shot held whole beats longer (the engine's 1,6 s at least, a frame lost to rounding never cutting into it).
    const card = end ? Math.ceil((END_CARD + 0.05) / beat) : 0;
    const beats = [STAND, EMPTY, ...TRIP[trip]!, ...lands.slice(0, -1), lands.at(-1)! + card];
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const first = 2 + trip;
    const fast = settings?.arrivee !== "normale";
    const length = (i: number) => round(spans[i]!.end - spans[i]!.start);
    const want = (i: number): string => {
      if (i === 0)
        return `la personne debout devant son lieu (sa porte, sa devanture, son comptoir, sa rue), en entier ou à mi-corps au milieu de l'image, le téléphone posé, ${comma(length(0))} s : le mieux, quelque chose qui passe tout près devant le téléphone (une voiture, un bus, un vélo, quelqu'un) : le passage commence alors ${comma(length(0))} s avant l'instant où il cache le plus l'image (une coupe s'y cache) ; sinon n'importe quelle vidéo fixe où quelqu'un se tient dans son lieu ; sinon une vidéo fixe de son lieu`;
      if (i === 1)
        return "le même endroit sans la personne, cadré pareil, tenu un instant : la fin de la même vidéo une fois qu'elle est hors du cadre (le mieux), ou une autre prise du même endroit vide ; sinon une vidéo ou une photo de son lieu sans personne";
      if (i === first - 1)
        return `le dernier plan du trajet, ${comma(length(i))} s, avec son son : ce vers quoi on avance (un escalier, un escalator, un couloir, une porte, une enseigne, l'entrée de l'endroit où l'on va), au milieu de l'image ; sa fin fonce d'un coup dessus ; sinon un plan du trajet qui bouge`;
      if (i < first)
        return `un plan du trajet qui bouge, ${comma(length(i))} s, avec son son : par la vitre d'un train, d'un bus ou d'une voiture, la route ou la rue qui défile, un métro, un vélo, des pieds qui marchent ; un autre que le précédent ; sinon n'importe quelle vidéo où l'image ou ce qu'on voit bouge vite`;
      const room = fast ? ` ; joué deux fois plus vite : il prend ${comma(2 * length(i))} s de sa vidéo` : "";
      return i === spans.length - 1
        ? `le dernier plan de l'arrivée, ${comma(length(i))} s : un endroit plein de vie (une foule, une rue passante, un marché, un salon, une terrasse ou sa boutique pleine), filmé à hauteur des gens, de loin au zoom de préférence ; ses deux petites lignes s'y posent au milieu${room} ; sinon une vidéo de son lieu où il se passe quelque chose`
        : `l'arrivée, ${comma(length(i))} s : un endroit plein de vie (une foule, une rue passante, un marché, un salon, une terrasse ou sa boutique pleine), filmé à hauteur des gens, un autre que le précédent${room} ; sinon une vidéo de son lieu où il se passe quelque chose`;
    };
    const shots: SkillShot[] = spans.map((s, i) => ({ ...s, want: want(i), ...(i < first ? { sound: true } : fast ? { speed: 2 } : {}) }));
    const lands0 = spans[first]!.start;
    const last = spans.at(-1)!;
    const title = round(last.start + TITLE_IN * beat);
    const until = end ? round(duration - END_CARD) : duration;
    return {
      duration,
      shots,
      // Her two lines a beat into her last shot, to the end (or her ending card).
      texts: { ligne: { from: title, to: until }, lieu: { from: title, to: until } },
      marks: { beat: round3(beat * 30), trip: 2, arrival: first, rush: toFrame(lands0 - RUSH * beat), title: toFrame(title) },
      // No music for the journey, heard with the sound of each of her shots; it comes in on its downbeat with her
      // arrival, and is cut dead at the end (the Reel loops onto her place). No sound effects: the original lays none.
      music: { downbeat: round3(lands0), pauses: [{ from: 0, to: round3(lands0) }], end: { at: duration } },
    };
  },
  code: CODE,
  // Its code draws its black and white itself, under her coloured words: its model's finish keeps its contrast, grain and corners.
  finish: { saturation: 0 },
};
