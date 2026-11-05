import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Photos posées sur la table », the effect (docs/fiches/table.md, effects 1 to 3; its whole Reel is skills/table.ts):
// over her table filmed still (the first shot under it), her photos (the shots after it) printed and laid at once at its
// centre, one on the other, each at one of the original's ten measured boxes and angles (borderless, no shadow, never
// moving again), with a dry click as each one lands; two small words written by hand fade in on either side of the pile
// just before the first print (the words that bring her name on the left, her name on the right); the pile held, then
// gone by its light in four images (the dark first, the white of a plate last), the table bare three images, and the
// montage goes on. Her photos stay still whenever they are drawn (a video laid as a print is still on its first image),
// so they all land within the span whatever the beat the editor cut them on: at the original's pace (eleven a second,
// on its images 13 to 38 at the Reel's tempo), a little slower on a longer span (half a beat apart at most, on the
// quarters of the beat), the pile always held about a beat before it goes; a span longer than that (a beat a photo, as
// the editor cuts them) ends on the first cut after it, her next photos then full frame on their beats. Her table plays
// all along: slowed when its passage is shorter than the effect, never frozen nor looped. Her words in cream on a dark
// table, in a dark ink on a light one (its light read under them, LightUnder), never smaller than can be read.
// What it keeps of its skill: its prints' boxes and angles in vertical, their burst and its clicks, its handwriting
// (Handwriting, Shadows Into Light, two lines growing upward for a long name), the pile's fade by light (LumaFade), the
// bare table. What it leaves: its two quick shots and their burned flash, its split screen, its last shot, the 4:3
// format, its music's rise and cut.

/** The original's prints land on its images 13, 14, 16, 19, 21, 24, 28, 30, 33 and 38, at 110 BPM (16,36 images a beat): in beats. */
const LANDS = [13, 14, 16, 19, 21, 24, 28, 30, 33, 38].map((i) => i / 16.36);
/** Its words fade in from its image 9 (in beats). */
const WORDS = 9 / 16.36;
/** The pile goes by its light over four images, the table then bare three: from the effect's end. */
const FADE_FROM_END = 7;
/** The click as each print lands (its level alternating, as the original's clicks). */
const CLICK = { sound: "light click", seconds: 0.5 };

/** When each of its prints lands, in beats, at the original's pace: its ten, or as many sampled along them. */
function landings(prints: number): number[] {
  return Array.from({ length: prints }, (_, k) => {
    const x = prints > 1 ? (k * (LANDS.length - 1)) / (prints - 1) : 0;
    const i = Math.min(LANDS.length - 2, Math.floor(x));
    return LANDS[i]! + (LANDS[i + 1]! - LANDS[i]!) * (x - i);
  });
}

/**
 * Its marks for a span (frames from its start): its words, each print's landing (p0, p1…), the pile's fade and its end
 * (frames from its start); a click on each landing. Its prints land in a burst at the original's pace (eleven a second),
 * a little slower on a longer span (half a beat apart at most, on the quarters of the beat), squeezed on a shorter one;
 * the pile then held a beat, gone by its light, the table bare three images. A span that holds more than that (one beat
 * a photo, as the editor cuts them) ends on the first cut after it: her photos after it play full frame, on their beats.
 */
export function tableTimeline({ frames, bpm, shots }: PieceTimelineInput): PieceTimeline {
  const beat = 1800 / Math.min(140, Math.max(60, bpm));
  const prints = Math.max(0, shots.length - 1);
  const latest = Math.max(12, frames - FADE_FROM_END);
  const words = Math.max(2, Math.min(Math.round(WORDS * beat), latest - 10));
  const first = Math.max(words + 3, Math.round(LANDS[0]! * beat));
  const hold = Math.round(beat);
  let lands = landings(prints).map((b) => Math.round(b * beat));
  const burst = prints > 1 ? ((lands.at(-1) ?? first) - first) / (prints - 1) : 0;
  if (prints > 1 && (lands.at(-1) ?? first) + hold < latest) {
    const quarter = beat / 4;
    const gap = Math.min(beat / 2, Math.max(burst, Math.floor((latest - hold - first) / (prints - 1) / quarter) * quarter));
    if (gap > burst + 0.5) lands = lands.map((_, k) => Math.round(first + k * gap));
  }
  const room = Math.max(first + 1, latest - 4);
  if (lands.length && lands.at(-1)! > room) lands = lands.map((f) => Math.round(first + ((f - first) * (room - first)) / Math.max(1, lands.at(-1)! - first)));
  // Each after the one before, all before the latest fade.
  lands = lands.reduce<number[]>((out, f) => [...out, Math.min(latest - 1, Math.max(f, (out.at(-1) ?? first - 1) + 1))], []);
  // Its end: the pile held a beat after its last print, its fade and its bare table, on the next cut when two beats or
  // more of the span are left after them (the montage then goes on, on her next photo), else the span's end.
  const done = (lands.at(-1) ?? first) + hold + FADE_FROM_END;
  const cut = shots.map((s) => s.from).filter((f) => f >= done && f <= frames - 6).sort((a, b) => a - b)[0];
  const end = done < frames - 2 * beat && cut !== undefined ? cut : frames;
  return {
    marks: { words, fade: end - FADE_FROM_END, end, ...Object.fromEntries(lands.map((f, k) => [`p${k}`, f])) },
    sounds: lands.map((f, k) => ({ at: Math.round((f / 30) * 1000) / 1000, ...CLICK, gain: k % 2 ? -11 : -6 })),
  };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  // Its shots: those that play during it; the first one is her table, the others her photos.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return h(AbsoluteFill, { style: { pointerEvents: "none" } });
  const table = mine[0];
  const prints = mine.slice(1);
  const shot = shots[table];
  const BEAT = mark("beat", 18);
  // Its end (the montage goes on after it, on her next photo when it comes before the span's end).
  const END = Math.max(1, Math.min(durationInFrames, mark("end", durationInFrames)));
  if (frame >= END) return h(AbsoluteFill, { style: { pointerEvents: "none" } });
  const FADE = Math.min(END - 1, mark("fade", END - 7));
  const WORDS = mark("words", Math.round(BEAT * 0.55));
  const lands = prints.map((_, j) => mark("p" + j, Math.round(WORDS + 4 + 3 * j)));
  const laid = { left: 0, top: 0, width: W, height: H };
  const box = { position: "absolute", left: 0, top: 0, width: W, height: H };

  // Her table, all along: as filmed at its own moment, slowed when its passage is shorter than the effect (each image
  // shown a little longer, never frozen nor looped).
  const span = Math.max(1, END - shot.from);
  const pace = Math.min(1, Math.max(1, shot.durationInFrames - 1) / Math.max(1, span - 1));
  const lt = Math.max(0, Math.min(shot.durationInFrames - 1, Math.floor((frame - shot.from) * pace)));
  const film = h(Footage, { key: "table", shot: table, ...(pace < 1 ? { at: frame - lt } : {}), style: box });

  // Her prints, laid at once at the centre of her table, one on the other, as the original's ten: their centres,
  // heights (shares of the frame's), shapes and angles, fitted on its images, about 37 % of the width; borderless, with
  // no shadow; never moving. A video is still on its first image. The pile goes by its light (LumaFade).
  const PRINTS = [[0.499, 0.499, 0.494, 0.667, 0], [0.508, 0.53, 0.47, 0.667, -14.9], [0.499, 0.499, 0.526, 0.667, -9.9], [0.5, 0.497, 0.48, 0.667, -7.1], [0.497, 0.523, 0.324, 0.96, 7.8], [0.513, 0.53, 0.47, 0.667, -13.1], [0.495, 0.527, 0.456, 0.75, 11], [0.5, 0.5, 0.478, 0.667, -1.9], [0.499, 0.501, 0.424, 0.667, 0], [0.499, 0.513, 0.452, 0.667, 0]];
  const P = prints.length;
  const FAR = durationInFrames * 4 + 1000;
  const pile = P && frame >= lands[0] && frame < FADE + 4
    ? h(LumaFade, { key: "pile", at: FADE, frames: 4 },
        prints.map((i, j) => {
          if (frame < lands[j]) return null;
          const s = PRINTS[Math.min(PRINTS.length - 1, Math.round((j * (PRINTS.length - 1)) / Math.max(1, P - 1)))];
          const ph = Math.round(s[2] * W * 1.125);
          const pw = Math.round(ph * s[3]);
          return h("div", { key: "print" + j, style: { position: "absolute", left: Math.round(s[0] * W - pw / 2), top: Math.round(s[1] * H - ph / 2), width: pw, height: ph, overflow: "hidden", transform: "rotate(" + s[4] + "deg)" } },
            h(Footage, { shot: i, at: FAR, style: { position: "absolute", left: 0, top: 0, width: pw, height: ph } }));
        }))
    : null;

  // Her two words written by hand, with a hair of shade: the words that bring her name on the left of the pile, her
  // name on the right, on one line just above the middle (two when it is long, growing upward, never smaller than can
  // be read); fading in together over 8 images before the first print, there to the end. Cream on a dark table, a dark
  // ink on a light one (its light under them, read on her shot; cream when it was not read). A hand that never repeats.
  const hand = "'Shadows Into Light', '" + brand.bodyFont + "', cursive";
  const SIZE = 62;
  const LINE = Math.round(SIZE * 0.8);
  const pileW = 0.245 * W;
  const baseY = Math.round(H * 0.445) - LINE;
  const zones = { left: { x: 40, w: Math.round(W / 2 - pileW - 52) }, right: { x: Math.round(W / 2 + pileW + 12), w: Math.round(W / 2 - pileW - 52) } };
  const rowsOf = (text, w) => {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const fits = (s) => Array.from(s).length * SIZE * 0.38 <= w;
    if (words.length < 2 || fits(words.join(" "))) return [words.join(" ")];
    let best = null;
    for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(" "); const b = words.slice(k).join(" "); const m = Math.max(a.length, b.length); if (!best || m < best.m) best = { m, rows: [a, b] }; }
    return best.rows;
  };
  const write = (text, zone, align, seed) => {
    if (!text || frame < WORDS) return null;
    const rows = rowsOf(text, zone.w);
    const area = { x: zone.x, y: baseY - (rows.length - 1) * LINE, w: zone.w, h: LINE * rows.length };
    const light = LightUnder(shot, frame, laid, area);
    const pale = light && light.mean > 0.56;
    return h("div", { key: seed, style: { ...box, opacity: interpolate(frame, [WORDS, WORDS + 8], [0, 1], clamp) } },
      h(Handwriting, { text: rows.join("\n"), box: area, color: pale ? "#2b1d14" : "#fff0d6", grain: 0, wobble: 0.8, last: 1, align, style: { fontFamily: hand, fontWeight: 400, letterSpacing: "0.04em", textShadow: pale ? "0 1px 2px rgba(255,255,255,0.4)" : "0 1px 3px rgba(0,0,0,0.45)" }, seed }));
  };
  const words = [write(word("gauche"), zones.left, "right", "table-gauche"), write(word("droite"), zones.right, "left", "table-droite")];

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, film, pile, words);
}`;

export const table: EffectPiece = {
  key: "table",
  version: 1,
  name: "Photos posées sur la table",
  how: "sur sa table filmée posée, ses photos tirées se posent d'un coup au centre, l'une sur l'autre, sans bord ni ombre, chacune un peu tournée, avec un petit clic sec, en rafale ; deux petits mots écrits à la main apparaissent de part et d'autre de la pile (à gauche ce qui amène son nom, à droite son nom) ; la pile tenue un temps s'efface par la lumière (le sombre d'abord), la table nue, puis le montage reprend.",
  needs: "une vidéo de sa table ou de son comptoir filmée téléphone posé, de haut ou de trois quarts, le milieu dégagé, puis 3 à 10 photos d'une même série de ce qu'elle fait (même lumière, mêmes fonds), en hauteur de préférence.",
  lays: "sur sa table filmée posée (le premier plan, 1 à 2 temps) puis 3 à 10 de ses photos coupées d'un temps chacune : elles s'y posent toutes en tirages en 4 à 5 temps ; après la pile, ses photos suivantes passent en plein écran, sur leurs temps",
  shots: [4, 11],
  seconds: [2, 6],
  require: { files: 4, shot: { still: true, video: true } },
  texts: [
    { slot: "gauche", want: "les petits mots écrits à la main à gauche de la pile, qui amènent ceux de droite (une forme comme « voici », « ici c'est », « ce soir chez »)", max: 14, required: true },
    { slot: "droite", want: "son nom, écrit à la main à droite de la pile (court : le mot qui la distingue quand il est long, « Farine » pour « Maison Farine »)", max: 16, required: true },
  ],
  timeline: tableTimeline,
  code: CODE,
  fonts: ["Shadows Into Light"],
};
