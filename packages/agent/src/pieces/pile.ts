import type { EffectPiece, PieceTimeline } from "../pieces.ts";
import { burstTimes } from "../sfx.ts";

// « Pile de photos », the effect (docs/fiches/pile.md, effects 1 to 5; its whole Reel is skills/pile.ts): over a run of
// her shots, a white page covers the frame and her photos land on it at once, in a burst, down the page in the
// original's zigzag (its 37 boxes measured at 1080 × 1920, sampled along them for her count, bigger when there are
// fewer), each one over the one before, half covering it, cropped square (three in portrait, to break the grid), never
// moving, no border, no shadow; its last third slower and slower (the original's nine last gaps); each one leaves at
// once as long after it landed as it takes the pile to empty from the top at the pace it was made, the second-last on a
// whole beat (a dry knock: the pile empty), the last a third of a beat after; then her words alone on the white, a beat
// or two, and the montage takes over, her next shot full frame. Her 2 to 4 words stand in front of everything from its
// first image to its last, one a line in pairs, very condensed bold capitals at the original's size, in her colour,
// with a fine rim of the page's white that only shows over her photos (the original's yellow read on its photos; her
// colour, which must read on the white page too, may be the hue of her photos).
// The editor cuts her shots a beat each at least: the burst lays all of them faster than that with Footage `at`, at the
// original's pace (0,18 beat a photo) when the span fits it, faster on a short one (the top never leaving before the
// last has landed), slower on a long one (the full pile held a beat at most);
// its timeline sets every landing and leaving (its marks l0…, o0…) and lays the original's clicks on them, its dry knock
// on the hit. Her photos stay still, her videos play while they lie on top of the pile, then hold. Kept from the skill:
// its boxes, its shapes and its format setting, its words' type (Anton squeezed to two thirds, its bars thickened, her
// own face as it is), its page without grade, its sound (v2): a click on each landing and, under its first photos, a
// clicking too dense for a click a photo, slowing down like a wheel (its skill's burst, at the Reel's tempo), all one
// burst of the same click; the dry knock on the hit; after it, her music without its bass to the cut (its skill's
// `thin`), whole again with the montage. Left out: its ending card, its whole Reel's length (37 photos over 9 s).

/** The original's landmarks, in beats: its first photo, its burst's pace a photo. */
const FIRST = 0.2;
const STEP = 0.18;
/** Its nine last gaps (its 4, 5, 4, 6, 6, 6, 7, 9 and 7 images, a beat being 15 of them), as multiples of its burst's pace. */
const SLOWING = [4, 5, 4, 6, 6, 6, 7, 9, 7].map((f) => f / 15 / STEP);
/** The share of her photos that land slower, at the end (the original's nine of 36 gaps; a third here, for a run of 6 to 16). */
const SLOW_SHARE = 0.35;
/** The last one leaves this long after the hit (beats: the original's 5 images). */
const LAST_AFTER = 1 / 3;
/** Its sounds: a light click on each landing (the original's soft ticks, its slower ones a little louder), a dry knock on the hit, the loudest. */
const CLICK = { sound: "light click", seconds: 0.5 };
const KNOCK = { sound: "dry knock", seconds: 0.5, gain: 6 };
const BURST_GAIN = -8;
const SLOW_GAIN = -3;
/**
 * Its clicking under its first photos, too dense for a click a photo (its skill's burst: the original's 40 a second at
 * 0,3 s, 17 at 1,5): its pace falling evenly from 46 to 16,5 a second at 120 BPM (the Reel's tempo scales it), over the
 * first 57 % of its fast landings (the original's 1,44 s of its 2,53), as soft as its quietest clicks.
 */
const DENSE = { pace: [46.3, 16.5] as const, share: 0.57, gain: -8, bpm: 120 };
/** Two hits of its burst closer than this are one (s). */
const SAME_HIT = 0.012;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** A value along a list, at t from 0 (its first) to 1 (its last), between two of them. */
const along = (list: number[], t: number) => {
  const x = Math.max(0, Math.min(1, t)) * (list.length - 1);
  const i = Math.max(0, Math.min(list.length - 2, Math.floor(x)));
  return list[i]! + (list[i + 1]! - list[i]!) * (x - i);
};

/** When each of n photos lands and leaves (frames from its start), and the hit (the frame its second-last leaves on, a whole beat). */
export type PileSchedule = { lands: number[]; leaves: number[]; hit: number; slow: number };

/**
 * Its schedule for a span: the hit on the last whole beat that leaves a beat for her words alone (a fifth of a short
 * span) after the last photo; the first photo a fifth of a beat in; the burst at the original's pace, slowed so that
 * the full pile is held a beat at most, never so slow that the top would leave before the last has landed; its last
 * third on the original's slowing gaps; each photo leaving as long after it landed as the second-last stays (it leaves
 * on the hit), the last a third of a beat after the hit.
 */
export function pileSchedule(frames: number, beat: number, n: number): PileSchedule {
  const count = Math.max(1, Math.round(n));
  const B = beat > 0 ? beat : 18;
  const alone = Math.min(B, frames * 0.2);
  const tail = LAST_AFTER * B;
  const room = frames - alone - tail;
  const hit = Math.max(2, Math.round(room >= 2 * B ? Math.floor(room / B + 1e-6) * B : room));
  const first = Math.min(FIRST * B, hit * 0.1);
  const gaps = count - 1;
  const slow = Math.min(SLOWING.length, Math.ceil(gaps * SLOW_SHARE));
  const weights = Array.from({ length: gaps }, (_, j) => {
    const r = j - (gaps - slow);
    return r < 0 ? 1 : along(SLOWING, slow > 1 ? r / (slow - 1) : 1);
  });
  const at: number[] = [0];
  for (const w of weights) at.push(at.at(-1)! + w);
  // Held a beat at most (u at least `held`), the top never leaving before the last has landed (u at most `fill`).
  const pair = at[count - 1]! + (count > 1 ? at[count - 2]! : 0);
  const free = hit - first;
  const fill = pair > 0 ? free / pair : 0;
  const held = pair > 0 ? (free - B) / pair : 0;
  const u = Math.min(fill, Math.max(held, STEP * B));
  const lands = at.map((c) => Math.round(first + u * c));
  if (count === 1) return { lands, leaves: [Math.round(hit + tail)], hit, slow };
  const stay = Math.max(1, hit - lands[count - 2]!);
  const leaves = lands.map((l, k) => (k === count - 1 ? Math.max(hit + 1, Math.round(hit + tail)) : Math.max(l + 1, l + stay)));
  return { lands, leaves, hit, slow };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const at = (k) => { const v = texts && texts[k]; return typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its photos: her shots that play during it, in order (a sliver of one at either edge left out, as the engine counts them).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from <= durationInFrames - 2 && shots[i].from + shots[i].durationInFrames >= 2);
  const n = mine.length;
  const BEAT = mark("beat", 18);
  const PAGE = "#fdfdfd";
  const INK = "#161616";

  // 1. When each photo lands and leaves: its timeline's marks (l0…, o0…: the burst, slower for its last third, each
  // leaving as the pile empties from the top, the second-last on the hit); when they are not all there, a plain burst
  // over the first half and the pile emptied from the top a beat before the end.
  const marked = mine.every((_, k) => at("l" + k) !== null && at("o" + k) !== null);
  const built = Math.max(1, Math.round(durationInFrames * 0.45));
  const end = Math.max(built + 2, Math.round(durationInFrames - BEAT));
  const first = Math.round(BEAT * 0.2);
  const plain = (k) => Math.round(first + (n > 1 ? (k * (built - first)) / (n - 1) : 0));
  const lands = mine.map((_, k) => (marked ? at("l" + k) : plain(k)));
  const leaves = mine.map((_, k) => Math.max(lands[k] + 1, marked ? at("o" + k) : plain(k) + end - plain(n - 1)));

  // 2. Where each lands: in the original's box for it, its 37 measured at 1080 × 1920 (their centres down the page in a
  // zigzag, passes of 3 to 5 from one side to the other, each a seventh of the width over the one before and a little
  // lower; their sides from 26 to 50 % of the width), sampled along them for her count, bigger when there are fewer
  // photos (the same surface), never past the page's edges. Cropped square as the original (its 1st and 27th in
  // portrait 2:3, its 35th in 4:5, to break the grid), at its own shape (between 3:4 and 4:3) or all in portrait 4:5 on
  // her word.
  const PX = [349, 425, 568, 721, 756, 617, 432, 362, 342, 477, 673, 734, 786, 623, 432, 298, 358, 540, 740, 766, 722, 516, 417, 302, 426, 586, 734, 817, 674, 470, 262, 308, 466, 667, 824, 772, 584];
  const PY = [511, 453, 426, 426, 528, 555, 588, 667, 756, 736, 759, 789, 848, 848, 897, 960, 1049, 991, 968, 1058, 1115, 1146, 1124, 1216, 1240, 1276, 1269, 1321, 1350, 1308, 1364, 1393, 1436, 1478, 1477, 1508, 1503];
  const PS = [34.7, 25.9, 44, 35.1, 35.6, 37.7, 33.9, 37.6, 40.8, 31.6, 37.7, 37.6, 35.1, 28.6, 34.2, 29.8, 35.7, 27.7, 31.5, 37.4, 37.4, 38.9, 41.5, 33.8, 33.8, 27.5, 50.2, 31.5, 31.6, 31.5, 31.5, 31.5, 31.4, 35.8, 35.1, 32.5, 33.5];
  const along = (arr, t) => { const x = t * (arr.length - 1); const i = Math.max(0, Math.min(arr.length - 2, Math.floor(x))); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
  const grow = Math.max(0.9, Math.min(1.45, Math.sqrt(37 / Math.max(1, n))));
  const format = setting("format", "carre");
  const tall = n > 2 ? [0, Math.min(n - 2, Math.round((26 / 36) * (n - 1))), Math.min(n - 2, Math.round((34 / 36) * (n - 1)))] : [0];
  const shapeOf = (k) => {
    if (format === "portrait") return 0.8;
    if (format === "forme") return Math.max(0.75, Math.min(4 / 3, Number(shots[mine[k]].aspect) || 1));
    return k === tall[2] && k !== tall[1] ? 0.8 : tall.indexOf(k) >= 0 ? 2 / 3 : 1;
  };
  const FAR = durationInFrames * 4 + 1000;
  const pile = mine.map((i, k) => {
    if (frame < lands[k] || frame >= leaves[k]) return null;
    const a = shapeOf(k);
    const t = n > 1 ? k / (n - 1) : 0;
    const side = (width * along(PS, t) * grow) / 100;
    const w = Math.round(side * Math.sqrt(a));
    const hh = Math.round(side / Math.sqrt(a));
    const cx = Math.max(width * 0.04 + w / 2, Math.min(width * 0.96 - w / 2, (along(PX, t) * width) / 1080));
    const cy = Math.max(height * 0.06 + hh / 2, Math.min(height * 0.93 - hh / 2, (along(PY, t) * height) / 1920));
    // A photo still; a video plays from its landing while it lies on top, then holds on the image it was at.
    const s = shots[i];
    const onTop = k < n - 1 ? lands[k + 1] - lands[k] : durationInFrames;
    const shown = Math.max(0, Math.min(Math.max(1, Math.round(s.durationInFrames)) - 1, onTop, frame - lands[k]));
    return h("div", { key: "p" + k, style: { position: "absolute", left: Math.round(cx - w / 2), top: Math.round(cy - hh / 2), width: w, height: hh, overflow: "hidden" } },
      h(Footage, { shot: i, at: s.kind === "video" ? frame - shown : FAR, style: { left: 0, top: 0, width: w, height: hh } }));
  });

  // 3. Her words, in front of everything from its first image to its last: one a line, in pairs (a wider gap between two
  // pairs), very condensed bold capitals as tall as the original's (7,2 % of the frame), the same size for all (one box
  // shrinks them together for a long word), centred clear of the apps' buttons. Anton, the model's own face, squeezed to
  // two thirds as the original's letters are, its bars thickened as theirs; her own face as it is. More than four words:
  // four lines at most, the longest as short as can be, never a line ending on an article or a preposition.
  const lum = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
    if (!m) return null;
    const v = parseInt(m[1], 16);
    const ch = (x) => { const q = x / 255; return q <= 0.03928 ? q / 12.92 : Math.pow((q + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch((v >> 16) & 255) + 0.7152 * ch((v >> 8) & 255) + 0.0722 * ch(v & 255);
  };
  // Her colour when it reads on the white page (a contrast of 1,6 to 1 or more: its words end alone on it), else her
  // dark colour, else ink.
  const shows = (c) => { const l = lum(c); return l !== null && (lum(PAGE) + 0.05) / (l + 0.05) >= 1.6; };
  const COLOR = shows(brand.accent) ? brand.accent : brand.palette && shows(brand.palette.dark) ? brand.palette.dark : INK;
  const display = "'" + brand.displayFont + "', 'Anton', 'Arial Narrow', sans-serif";
  const SQUEEZE = /^anton$/i.test(String(brand.displayFont || "").trim()) ? 0.66 : 1;
  const SHORT = /^(le|la|les|de|du|des|un|une|à|au|aux|en|et|ou|par|pour|sur|chez|the|a|an|of|my|is|on)$/i;
  const lines = (text) => {
    // A name kept whole by no-break spaces: here each of its words goes on its own line.
    const words = String(text || "").replace(/(\p{L}) (?=\p{L})/gu, "$1 ").toUpperCase().split(/[ \t\n]+/).filter(Boolean);
    if (words.length <= 4) return words;
    let best = null;
    const weigh = (groups) => {
      const longest = Math.max.apply(null, groups.map((g) => g.join(" ").length));
      const loose = groups.slice(0, -1).filter((g) => SHORT.test(g[g.length - 1])).length;
      const score = longest + 3 * loose - 0.1 * groups.length;
      if (!best || score < best.score) best = { score, groups };
    };
    const cut = (start, left, acc) => {
      if (left === 1) return weigh(acc.concat([words.slice(start)]));
      for (let stop = start + 1; stop <= words.length - left + 1; stop++) cut(stop, left - 1, acc.concat([words.slice(start, stop)]));
    };
    for (let k = 2; k <= 4; k++) cut(0, k, []);
    return best.groups.map((g) => g.join(" "));
  };
  // At 1080 × 1920: capitals of 140 px, 73 px between two lines of a pair, 147 between two pairs, the block centred at
  // 48 % of the height. Squeezed Anton keeps the original's stems but not its heavy bars: four copies of each letter 2
  // and 4 px above and under it, of its own colour, thicken its bars only. Under them, a fine rim of the page's own
  // white (3 px once squeezed): on the page it does not show (the original's flat letters), on her photos it keeps her
  // letters apart from what is under them (her colour on photos of the same hue: terracotta on clay).
  const thick = SQUEEZE < 1 ? [2, -2, 4, -4].map((y) => "0 " + y + "px 0 " + COLOR) : [];
  const RIM = SQUEEZE < 1 ? [[0, -7], [0, 7], [-4.5, -5], [4.5, -5], [-4.5, 5], [4.5, 5], [-4.5, 0], [4.5, 0]] : [[0, -3], [0, 3], [-3, 0], [3, 0], [-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]];
  const rim = RIM.map((p) => p[0] + "px " + p[1] + "px 0 " + PAGE);
  const type = { fontFamily: display, fontWeight: 900, fontSynthesis: "none", fontSize: SQUEEZE < 1 ? 154 : 160, lineHeight: "211px", height: 211, letterSpacing: "0.01em", color: COLOR, whiteSpace: "nowrap", textAlign: "center", textShadow: thick.concat(rim).join(", ") };
  const W = Math.round((width - 280) / SQUEEZE);
  const said = lines(word("mots"));
  const words = said.length
    ? h("div", { style: { position: "absolute", left: Math.round((width - W) / 2), top: Math.round(height * 0.4845 - 500), width: W, height: 1000, transform: SQUEEZE < 1 ? "scaleX(" + SQUEEZE + ")" : "none", transformOrigin: "50% 50%" } },
        h(FitText, { style: { position: "absolute", left: 0, top: 0, width: W, height: 1000 } },
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
            said.map((w, i) => h("div", { key: i, style: { ...type, marginTop: i > 0 && i % 2 === 0 ? 74 : 0 } }, w)))))
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: PAGE, overflow: "hidden" } }, pile, words);
}`;

export const pile: EffectPiece = {
  key: "pile",
  version: 2,
  name: "Pile de photos",
  how: "une page blanche couvre l'écran et ses photos s'y posent d'un coup, en rafale, du haut vers le bas en zigzag, chacune par-dessus la précédente dont elle couvre la moitié, recadrées au carré, sans bord ni ombre, de plus en plus lentement pour les dernières ; puis elles repartent d'un coup dans le même ordre, la pile se vidant par le haut au rythme où elle s'est faite, vide sur un coup sec ; 2 à 4 mots en très grandes capitales serrées de sa couleur, un par ligne, restent devant du début à la fin et finissent seuls sur le blanc ; puis le montage reprend, le plan suivant en plein écran.",
  needs: "beaucoup de photos de son travail en série (des gros plans qui se lisent petits : ses coupes, ses plats, ses pièces, ses produits), qui changent de couleur et de cadrage, et une phrase de 2 à 4 mots courts qui dit qui on est.",
  lays: "sur 6 à 16 de ses plans coupés d'un temps chacun (ses photos de son travail, ou des instants de ses vidéos), le dernier son plus beau : il part le dernier",
  shots: [6, 16],
  seconds: [2.5, 8],
  require: { files: 8 },
  texts: [
    {
      slot: "mots",
      want: "2 à 4 mots courts, empilés en très grand un par ligne devant la pile, qui disent qui on est ou ce qu'on montre, sans phrase de pub (une forme comme « voici notre travail », « ça, c'est nous », « fait main à Lyon »)",
      max: 26,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "la forme de ses photos sur la page",
      choices: [
        { value: "carre", says: "au carré, comme l'original (trois en portrait pour casser la grille), quelle que soit la forme de ses fichiers" },
        { value: "forme", says: "chacune à sa forme, comme ses fichiers (de 3:4 en hauteur à 4:3 en largeur)" },
        { value: "portrait", says: "toutes en portrait 4:5" },
      ],
    },
  ],
  timeline({ frames, bpm, shots }): PieceTimeline {
    const beat = (60 / bpm) * 30;
    const plan = pileSchedule(frames, beat, shots.length);
    const marks: Record<string, number> = {};
    plan.lands.forEach((l, k) => (marks[`l${k}`] = l));
    plan.leaves.forEach((o, k) => (marks[`o${k}`] = o));
    // A click on each landing (its slower ones a little louder) and, under its first photos, its denser clicking that
    // slows down: one burst of the same click from its first landing; the knock on the hit.
    const slowFrom = plan.lands.length - plan.slow;
    const first = (plan.lands[0] ?? 0) / 30;
    const landed = plan.lands.map((l, k) => ({ t: l / 30 - first, gain: k >= slowFrom ? SLOW_GAIN : BURST_GAIN }));
    const fast = ((plan.lands[Math.max(0, slowFrom - 1)] ?? 0) / 30 - first) * DENSE.share;
    const scale = bpm / DENSE.bpm;
    const dense = fast > 0.2 ? burstTimes(DENSE.pace[0] * scale, DENSE.pace[1] * scale, fast).map((t) => ({ t, gain: DENSE.gain })) : [];
    const hits: { t: number; gain: number }[] = [];
    for (const h of [...landed, ...dense].sort((a, b) => a.t - b.t || b.gain - a.gain)) if (!hits.length || h.t - hits.at(-1)!.t >= SAME_HIT) hits.push(h);
    const clicks = hits.length > 1 ? { at: round3(first), ...CLICK, burst: { times: hits.map((h) => round3(h.t)), gains: hits.map((h) => h.gain) } } : { at: round3(first), ...CLICK, gain: BURST_GAIN };
    const sounds = [clicks, { at: round3(plan.hit / 30), ...KNOCK }];
    // After the hit, her music goes on lighter, without its bass, to the cut (the original's 10 dB lower and clearer).
    return { marks, sounds, music: { filters: [{ kind: "thin", from: round3(plan.hit / 30), to: round3(frames / 30) }] } };
  },
  code: CODE,
};
