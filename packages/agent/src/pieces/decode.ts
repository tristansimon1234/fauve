import type { EffectPiece } from "../pieces.ts";

// « Titre qui se décode », the effect (docs/fiches/decode.md, effects 3, 4 and 5; its whole Reel is skills/decode.ts):
// her shot cuts to black, an impact, and on the black her title in capitals shows at once, scrambled, holds, scrambles
// anew every image or two, then lands through look-alikes (the original's 12, 19 and 8 images at its 122 BPM, counted
// in the Reel's beats, half-beats on a slow one), her small words over it (in normal case, a little spaced, the first on
// the title's left edge, the last on its right); on a beat after it lands, a band of video opens at once behind it,
// 22,7 % of the frame high (where the original's fold had left its row), and grows at a constant speed to the full
// frame by its last image: a mask, never a zoom. In it, a cut every 4 images like a machine (8 with her photos only):
// pieces of all her shots under it (Footage `at`), as many of each, taken across each one's passage, in an order that
// never loops, never the same shot twice in a row. Then the title goes at once with the effect, and the montage takes
// over on her next shot full frame, as the original's calm shot does. Its sounds are the original's: an impact on the
// cut to black and a digital tick every three images while the title scrambles. Its music (v2), as its skill's: silent
// under the title on the black (its impact and its ticks alone), in on the beat the band opens, muffled as out of a
// small speaker (« radio ») while it grows, whole again when the montage takes over. It keeps its skill's title (its
// size, its face, its thin dark edge for her pale pictures), its decoding, its band, its flash montage and its music's
// shape under them; it leaves the six bands and their fold, the music's stop on the calm shot, the ending by layers, and
// its 16:9 format (a piece plays in her vertical Reel). Short, it shortens its title's decoding so that its band still
// has at least 45 % of it. Nothing of the original's own: « A · Summer · In » and « THE CANADIAN ROCKIES » give way to
// her words.

/** Its decoding, in beats of the Reel: its original's 12 images still, 19 scrambling, 8 landing, at its 122 BPM (14,75 images a beat). */
const DECODE_BEATS = 39 / 14.754;
const DECODE = { hold: 12, scramble: 19, resolve: 8 };
/** The title shows this many images after the cut to black (an impact on the cut, the title on the black just after). */
const SHOW = 2;
/** The band opens on the first beat this far after the title lands (beats: the original's opens 1,04 beat after it). */
const AFTER_LANDING = 0.4;
/** The title's part of the effect at most: its band always has the rest (45 % at least). */
const TITLE_SHARE = 0.55;
/** The band is full this many images before the end (the original's is full as its calm shot cuts in). */
const FULL_BEFORE = 2;
/** Its sounds: a deep impact on the cut, a digital tick every three images while the title scrambles (a burst, 40 at most). */
const IMPACT = { sound: "deep dry impact", seconds: 0.5 };
const TICK = { sound: "digital glitch tick", seconds: 0.5, gain: -9 };
const TICK_EVERY = 3;
const MOST_TICKS = 40;

/** Its original's beat, in frames (122 BPM). */
const ORIGINAL_BEAT = 1800 / 122;

/** The music comes back (with the band) at least this long after the cut, else it is not stopped at all (frames). */
const SHORTEST_SILENCE = 12;

/**
 * Its moments in frames from its start for a span of `frames` at a tempo: the title shows, decodes (in the Reel's beats,
 * half-beats on a slow one: it keeps about its original's pace), lands; the band opens on a whole beat of the Reel after
 * it (the music comes back there: a silence ending off the beat would move her music off the cuts) and is full by the
 * end; `back`, the whole beat the music comes back on (the band's, or the one before it when the band could not wait for
 * one), 0 when it is not stopped.
 */
export function decodeMoments(frames: number, bpm: number): { show: number; hold: number; scramble: number; resolve: number; lands: number; open: number; full: number; back: number } {
  const beat = 1800 / Math.min(140, Math.max(60, bpm));
  let pace = beat;
  while (pace / ORIGINAL_BEAT > 1.42) pace /= 2;
  const total = DECODE_BEATS * pace;
  let open = Math.ceil((SHOW + total + AFTER_LANDING * pace) / beat) * beat;
  // Short: the band opens on the last beat that leaves it its share (else at the middle), the decoding shortened to land before it.
  if (open > frames * TITLE_SHARE) {
    const k = Math.floor((frames * TITLE_SHARE) / beat);
    open = k >= 1 && k * beat >= frames * 0.3 ? k * beat : frames * 0.5;
  }
  open = Math.round(open);
  const decoding = Math.max(9, Math.min(total, open - SHOW - Math.max(4, 0.3 * pace)));
  const hold = Math.round((decoding * DECODE.hold) / 39);
  const resolve = Math.max(1, Math.round((decoding * DECODE.resolve) / 39));
  const scramble = Math.max(1, Math.round(decoding) - hold - resolve);
  const onBeat = Math.floor(open / beat + 0.02) * beat;
  return { show: SHOW, hold, scramble, resolve, lands: SHOW + hold + scramble + resolve, open, full: Math.max(open + 1, frames - FULL_BEFORE), back: onBeat >= SHORTEST_SILENCE ? onBeat : 0 };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const F = durationInFrames;
  const BEAT = Math.max(6, mark("beat", 18));
  // Its shots: those that play during it, in order, as the engine counts them (else those it finds); each one flashes in its band.
  const counted = String((texts && texts.mine) || "").split(",").filter((x) => x !== "").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < shots.length);
  const mine = counted.length ? counted : shots.map((s, i) => i).filter((i) => shots[i].from < F && shots[i].from + shots[i].durationInFrames > 0);

  // Its moments (its timeline's marks; else about the same: the band on its 4th beat, half of it at most).
  const SHOW = Math.max(0, Math.round(mark("show", 2)));
  const OPEN = Math.round(Math.min(F - 4, Math.max(SHOW + 10, mark("open", Math.min(4 * BEAT, F * 0.5)))));
  const room = Math.max(9, Math.min(2.64 * BEAT, OPEN - SHOW - 4));
  const HOLD = Math.max(0, Math.round(mark("hold", (room * 12) / 39)));
  const RESOLVE = Math.max(1, Math.round(mark("resolve", (room * 8) / 39)));
  const SCRAMBLE = Math.max(1, Math.round(mark("scramble", room - HOLD - RESOLVE)));
  const FULL = Math.max(OPEN + 1, Math.round(mark("full", F - 2)));

  // 1. Her title on the black: her small words over it and the title scrambled, all at once just after the cut, the
  // scramble held, then anew every 1 or 2 images, then landing through look-alikes; both stay still to the end, and go
  // at once with it. The title in capitals on one line, white, a regular face (her display font), a thin dark edge of
  // its own (unseen on the black, it holds the letters on her pale pictures in the band), as wide as its place allows
  // (the original's spans 85 % of its frame: here its letters sized to fill the 800 px of its place, 200 px at most, its
  // block inside the band's first opening of 436); the small words 0,375 of its size (30 px at least), in normal case,
  // a little spaced, the first on the title's left edge, the last on its right; the two lines one block at the middle
  // of the frame, held left of the apps' buttons, shrunk as a whole when her face sets it wider (its small words never
  // under 21 px).
  const display = "'" + brand.displayFont + "', 'Open Sans', sans-serif";
  const edge = "0 0 1px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.35)";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const title = keep(word("titre")).toUpperCase();
  const small = word("surtitre").split(/\s+/).filter(Boolean).slice(0, 4);
  const TITLE = Math.max(56, Math.min(200, Math.floor(800 / Math.max(1, Array.from(title).length * 0.5))));
  const SMALL = Math.max(30, Math.round(TITLE * 0.375));
  const lift = small.length ? SMALL : 0;
  const titleStyle = { fontFamily: display, fontWeight: 400, fontSize: TITLE, lineHeight: 1, letterSpacing: 0, color: "#ffffff", whiteSpace: "nowrap", textAlign: "center", textShadow: edge };
  const smallStyle = { fontFamily: display, fontWeight: 400, lineHeight: 1, letterSpacing: "0.15em", color: "#ffffff", whiteSpace: "nowrap", textShadow: edge };
  const block = title && frame >= SHOW
    ? h(FitText, { key: "title", style: { position: "absolute", left: 140, top: Math.round(height / 2 - (lift + TITLE) / 2), width: width - 280, height: lift + TITLE } }, (scale) => {
        const size = Math.max(SMALL, Math.round(21 / Math.max(0.3, scale)));
        return h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "stretch" } },
          small.length
            ? h("div", { style: { display: "flex", justifyContent: small.length > 1 ? "space-between" : "center", alignItems: "flex-end", gap: Math.round(size * 0.4), height: size } },
                small.map((w, i) => h("span", { key: i, "data-fauve-accent": "", style: { ...smallStyle, fontSize: size, marginRight: i === small.length - 1 && small.length > 1 ? "-0.15em" : 0 } }, w)))
            : null,
          h("div", { style: titleStyle }, h(Decode, { text: title, at: SHOW, hold: HOLD, scramble: SCRAMBLE, resolve: RESOLVE, every: 1.4 })));
      })
    : null;

  // 2. On its beat, a band of video opens at once behind the title, 22,7 % of the frame high, and grows at a constant
  // speed to the full frame by the end: a mask on the picture laid full frame, never a zoom. In it, a cut every 4 images
  // like a machine (8 with her photos only): pieces of all her shots under it, as many of each (a video gives as many
  // moments as its passage holds, a photo any), spread over the band in an order that never loops, each one's pieces
  // taken from the start of its passage to its end, never the same shot twice in a row.
  const photosOnly = mine.length > 0 && mine.every((i) => shots[i].kind === "photo");
  const LEN = photosOnly ? 8 : 4;
  const span = Math.max(1, FULL - OPEN);
  const m = Math.max(1, Math.floor(span / LEN));
  const cutAt = (j) => OPEN + Math.round((j * span) / m);
  const count = mine.map(() => 0);
  const holds = mine.map((i) => (shots[i].kind === "photo" ? m : Math.max(1, Math.floor(shots[i].durationInFrames / (LEN + 1)))));
  let given = 0;
  for (let k = 0; given < m && k < m * mine.length; k++) if (count[k % mine.length] < holds[k % mine.length]) { count[k % mine.length]++; given++; }
  for (let k = 0; given < m && mine.length; k++, given++) count[k % mine.length]++;
  const list = [];
  mine.forEach((s, j) => { for (let q = 0; q < count[j]; q++) list.push({ s, j, due: j === 0 && q === 0 ? -1 : (q + 0.5 + 0.8 * (random("decode-" + s + "-" + q) - 0.5)) / count[j] + j * 1e-6 }); });
  list.sort((a, b) => a.due - b.due);
  for (let i = 1; i < list.length; i++) {
    if (list[i].s !== list[i - 1].s) continue;
    const k = list.findIndex((x, y) => y > i && x.s !== list[i].s);
    if (k > 0) { const t = list[i]; list[i] = list[k]; list[k] = t; }
  }
  const taken = mine.map(() => 0);
  const pieces = list.map((p) => {
    const q = taken[p.j]++;
    const free = Math.max(0, shots[p.s].durationInFrames - LEN - 1);
    return { shot: p.s, offset: count[p.j] > 1 ? Math.round((q * free) / (count[p.j] - 1)) : Math.round(free / 2) };
  });
  let j = 0;
  while (j < m - 1 && cutAt(j + 1) <= frame) j++;
  const grown = Math.min(1, Math.max(0, (frame - OPEN) / span));
  const bandH = frame >= OPEN ? Math.round(height * (0.227 + 0.773 * grown)) : 0;
  const bandY = Math.round((height - bandH) / 2);
  const piece = bandH > 0 ? pieces[Math.min(j, pieces.length - 1)] : null;
  const band = piece
    ? h("div", { key: "band", style: { position: "absolute", left: 0, top: bandY, width, height: bandH, overflow: "hidden" } },
        h(Footage, { key: "p" + j, shot: piece.shot, at: cutAt(j) - piece.offset, style: { left: 0, top: -bandY, width, height } }))
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, band, block);
}`;

export const decode: EffectPiece = {
  key: "decode",
  // 2: its music shaped as its skill's (silent under the title, muffled under the band), its band on a whole beat of
  // the Reel, its ticks one burst, its shots as the engine counts them.
  version: 2,
  name: "Titre qui se décode",
  how: "son plan coupe sur du noir ; ses petits mots et son titre en capitales y apparaissent d'un coup, le titre brouillé qui se décode comme un générique de film ; sur un temps, une bande de vidéo s'ouvre derrière lui et grandit jusqu'au plein écran, un montage éclair de ses plans y défile (une coupe toutes les 4 images) ; le titre part avec la bande pleine et le montage reprend. La musique se tait sous le titre, revient étouffée avec la bande, entière quand le montage reprend.",
  needs: "son nom, son lieu ou son quartier en quelques mots, et des vidéos variées de son lieu (des gestes, des visages, des détails, la salle, la rue) pour les éclairs de la bande.",
  lays: "le plus souvent au début du Reel, sur 3 à 10 de ses plans d'un temps chacun, variés (chacun passe en éclairs dans la bande ; ses photos restent fixes) ; il les couvre de noir le temps du titre, et le plan d'après reprend en plein écran",
  shots: [1, 16],
  seconds: [3, 8],
  require: { files: 3 },
  texts: [
    { slot: "titre", want: "le titre qui se décode : son nom, son lieu, sa rue ou son quartier, court (il s'écrit en capitales sur une ligne)", max: 22, required: true },
    {
      slot: "surtitre",
      want: "1 à 3 petits mots qui amènent le titre, en minuscules, posés sur sa ligne au-dessus de lui, le premier sur son bord gauche, le dernier sur son bord droit (une forme comme « un samedi à », « bienvenue chez », « le matin au »)",
      max: 24,
      required: false,
    },
  ],
  timeline({ frames, bpm }) {
    const at = decodeMoments(frames, bpm);
    const s = (f: number) => Math.round((f / 30) * 1000) / 1000;
    // Its ticks while the title scrambles and lands, one every three images (a burst of the same tick).
    const scrambling = at.lands - (at.show + at.hold);
    const ticks = Math.min(MOST_TICKS, Math.max(2, Math.floor(scrambling / TICK_EVERY) + 1));
    // Her music silent under the title (from the cut to black), back on the beat the band opens, muffled as out of a small
    // speaker while it grows, whole on the cut back to the montage.
    const back = at.back || at.open;
    return {
      marks: { show: at.show, hold: at.hold, scramble: at.scramble, resolve: at.resolve, open: at.open, full: at.full },
      sounds: [
        { at: 0, ...IMPACT },
        { at: s(at.show + at.hold), ...TICK, burst: { times: Array.from({ length: ticks }, (_, i) => s((i * scrambling) / (ticks - 1))) } },
      ],
      music: {
        ...(at.back ? { pauses: [{ from: 0, to: s(at.back) }] } : {}),
        filters: [{ kind: "radio" as const, from: s(back), to: s(frames), open: 0.05 }],
      },
    };
  },
  code: CODE,
};
