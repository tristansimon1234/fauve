import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";
import { landingSlots, welcomeLines } from "../skills/bienvenue.ts";

// « L'accueil, puis la rafale », the effect (docs/fiches/bienvenue.md, effects 1 to 3; its whole Reel is
// skills/bienvenue.ts): over a run of her calm shots, the opening of a Reel, her welcome sentence written by a hand that
// never repeats (Handwriting in Mynerve, its capitals about 80 px, spaced, no grain), one line more on each shot of hers,
// stacked in the middle of the frame (a line every 185 px, the stack centred on the middle, as the original's « WELCOME /
// TO / OUR / SALON »): its first line a sixteenth after its start, each next one on the next cut, the last always on its
// last shot; her shots under it darker (a veil dosed on the light read under her words, as the model's: their mean
// brought to about 0,3, their brightest tenth to about 0,7), a snap of fingers as each line lands, the music stopped from
// its start and back on the Reel's beat at its end (the original's voice counting alone, then the drop). Then the montage
// takes over without her words. Its ink: her colour when it reads on a dark picture, else the original's fluo yellow (or
// the yellow, or white, as her words ask). Kept from the skill: its hand and its sizes, its four lines at most (the cut
// whose longest line is the shortest), its landings, its snaps, its silence until the drop. Left out: its burst (the
// editor cuts the Reel after it), its format setting (the montage frames her shots), its ending card.

/** A line lands a sixteenth after its start (the original's 5 images of 82). */
const LEAD = 0.25;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * When each of its lines lands (frames from its start), as its code lays them: its first a sixteenth in (or on its first
 * shot of hers when that starts later), each next one on the next shot's cut, the last always on its last shot; four lines
 * at most, never more than its shots.
 */
export function bienvenueLands(frames: number, beat: number, shots: { from: number }[], words: Record<string, string>): number[] {
  const n = Math.max(1, shots.length);
  const lines = welcomeLines(words.accueil, Math.min(4, n)).length;
  const starts = shots.map((s) => Math.max(0, Math.round(s.from)));
  const lead = Math.max(1, Math.round((beat > 0 ? beat : 18) * LEAD));
  const slots = landingSlots(lines).map((k) => (k === 3 ? n - 1 : k));
  const lands: number[] = [];
  // Each after the one before (a first shot shorter than its lead), every one before its end.
  slots.forEach((k, g) => lands.push(Math.min(Math.max(0, frames - 2), Math.max(g === 0 ? Math.max(starts[0] ?? 0, lead) : (starts[k] ?? 0), g ? lands[g - 1]! + 1 : 0))));
  return lands;
}

/**
 * Its snaps and its silence: a snap of fingers as each line lands; the music stopped from its start and back on the
 * Reel's beat at its end (its beats counted from its first shot's cut, which falls on one), never past its span.
 */
export function bienvenueTimeline({ frames, bpm, shots, words }: PieceTimelineInput): PieceTimeline {
  const beat = (60 / bpm) * REEL_FPS;
  const lands = bienvenueLands(frames, beat, shots, words);
  const grid = Math.max(0, shots[0]?.from ?? 0);
  const back = grid + Math.floor((frames - grid) / beat + 1e-6) * beat;
  const sounds = lands.map((f) => ({ at: round3(f / REEL_FPS), sound: "single finger snap", seconds: 0.5, gain: 3 }));
  const marks = Object.fromEntries(lands.map((f, g) => [`land${g}`, f]));
  return { marks, sounds, ...(back > lands.at(-1)! + 2 ? { music: { pauses: [{ from: 0, to: round3(back / REEL_FPS) }] } } : {}) };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its shots: her shots that play during it, in order, as the engine counts them.
  const own = String(word("mine")).split(",").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < shots.length);
  const mine = own.length ? own : shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  const n = mine.length;
  const BEAT = mark("beat", 18);
  const startOf = (k) => (k >= 0 && k < n ? Math.max(0, Math.round(shots[mine[k]].from)) : 0);
  const cur = mine.reduce((c, i, k) => (startOf(k) <= frame ? k : c), 0);

  // 1. Her shots under it darker: a black veil dosed on the light read under her words (LightUnder, read before the
  // render on the shots under it): their mean brought to about 0,3 and their brightest tenth to about 0,7, a shot already
  // dark hardly touched; without a reading, a middle dose. The montage plays under it, as filmed.
  const LAID = { left: 0, top: 0, width, height };
  const AREA = { x: 140, y: Math.round(height * 0.3), w: width - 280, h: Math.round(height * 0.4) };
  const read = n ? LightUnder(shots[mine[cur]], frame, LAID, AREA) : null;
  const dose = read ? Math.max(0.4, Math.min(0.92, 0.3 / Math.max(0.05, read.mean), 0.7 / Math.max(0.05, read.high))) : 0.72;
  const veil = h("div", { key: "veil", style: { position: "absolute", left: 0, top: 0, width, height, backgroundColor: "#000000", opacity: Number((1 - dose).toFixed(3)) } });

  // 2. Her sentence: in capitals, four lines at most (and never more than her shots), the cut whose longest line is the
  // shortest; one line more on each shot, stacked in the middle of the frame, each landing whole at once and still.
  const keep = (s) => String(s || "").normalize("NFC").replace(/(\d) (?=\d)/g, "$1 ");
  const up = (s) => keep(s).toLocaleUpperCase("fr").replace(/\s+/g, " ").trim();
  const length = (s) => Array.from(s).length;
  const split = (list, k) => {
    let best = null;
    const go = (start, left, acc) => {
      if (left === 1) {
        const rows = acc.concat([list.slice(start).join(" ")]);
        const most = Math.max.apply(null, rows.map(length));
        const even = rows.reduce((sum, r) => sum + length(r) * length(r), 0);
        if (!best || most < best.most || (most === best.most && even < best.even)) best = { most, even, rows };
        return;
      }
      for (let stop = start + 1; stop <= list.length - left + 1; stop++) go(stop, left - 1, acc.concat([list.slice(start, stop).join(" ")]));
    };
    if (list.length) go(0, Math.max(1, Math.min(k, list.length)), []);
    return best ? best.rows : [];
  };
  const lines = split(up(word("accueil")).split(" ").filter(Boolean), Math.max(1, Math.min(4, n)));
  const L = lines.length;
  const lead = Math.max(1, Math.round(BEAT * 0.25));
  const landOf = (g) => mark("land" + g, g === 0 ? Math.max(startOf(0), lead) : g === L - 1 && L > 1 ? startOf(n - 1) : startOf(g));
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return -1; const v = parseInt(m[1], 16); return 0.2126 * lin(((v >> 16) & 255) / 255) + 0.7152 * lin(((v >> 8) & 255) / 255) + 0.0722 * lin((v & 255) / 255); };
  const encre = setting("encre", "sienne");
  const INK = encre === "blanc" ? "#ffffff" : encre === "sienne" && lum(brand.accent) >= 0.35 ? String(brand.accent).toLowerCase() : "#f4ff00";
  const hand = "'Mynerve', '" + brand.displayFont + "', cursive";
  const PITCH = Math.round(height * 0.0964);
  const SIZE = Math.round(height * 0.0583);
  const SLOT = Math.round(height * 0.075);
  const words = lines.map((t, g) => {
    if (frame < landOf(g)) return null;
    const cy = Math.round(height / 2 + (g - (L - 1) / 2) * PITCH);
    return h(Handwriting, { key: "accueil-" + g + "-" + t, text: t, box: { x: 140, y: Math.round(cy - SLOT / 2), w: width - 280, h: SLOT }, color: INK, grain: 0, wobble: 1.6, bend: 0, last: 1, align: "center", style: { fontFamily: hand, fontWeight: 400, fontSize: SIZE, letterSpacing: "0.12em" }, seed: "accueil-" + g + "-" + t });
  });

  return h(AbsoluteFill, { style: { overflow: "hidden" } }, veil, words);
}`;

export const bienvenue: EffectPiece = {
  key: "bienvenue",
  version: 1,
  name: "L'accueil mot à mot",
  how: "sa phrase d'accueil s'écrit à la main en capitales (jaune fluo, ou de sa couleur claire), une ligne de plus à chaque plan, empilées au milieu de l'image, sur ses plans calmes assombris, un claquement de doigts par ligne, la musique arrêtée ; à sa fin les mots partent et la musique repart sur le temps, comme un drop ; puis le montage reprend.",
  needs: "deux à cinq plans calmes et fixes de son lieu (sa salle vide, un coin, un petit détail qui bouge, ses produits alignés), et une phrase d'accueil de 3 à 5 mots.",
  lays: "en ouverture, sur 2 à 5 de ses plans calmes d'un temps environ chacun, autant que sa phrase a de mots (quatre comme l'original), juste avant le moment où la musique doit tomber",
  shots: [2, 5],
  seconds: [1.5, 4.5],
  require: { files: 3, shot: { still: true } },
  texts: [
    {
      slot: "accueil",
      want: "sa phrase d'accueil, écrite à la main en capitales, une ligne de plus à chaque plan : 3 à 5 mots courts qui accueillent chez elle (une forme comme « Bienvenue dans notre salon », « Bienvenue chez Farine », « Entrez, c'est ouvert ») ; jamais sa demande entière ni une longue phrase",
      max: 40,
      required: true,
    },
  ],
  settings: [
    {
      name: "encre",
      want: "la couleur de sa phrase écrite à la main",
      choices: [
        { value: "sienne", says: "sa couleur quand elle est assez claire pour se lire sur ses plans assombris, sinon le jaune fluo de l'original" },
        { value: "jaune", says: "le jaune fluo de l'original" },
        { value: "blanc", says: "blanc" },
      ],
    },
  ],
  timeline: bienvenueTimeline,
  code: CODE,
  fonts: ["Mynerve"],
};
