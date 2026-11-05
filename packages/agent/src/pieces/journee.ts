import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Une journée chez toi », the effect (docs/fiches/journee.md, effects 2, 3 and 4; its whole Reel is skills/journee.ts):
// over a run of her shots, something blurred passes right in front of the lens across her first one (a copy of that
// shot, enlarged and very blurred, crossing from the right to the left, its edges very soft: in over 6 images, all of it
// covered 5, out over 5, as the original's two passes), and as it leaves, her title is there behind it, in the decor:
// elegant capitals in the middle of the picture, fading in over three images under the leaving pass (its first letters
// still hidden while it covers them), small words by hand above its first letter coming whole on the third, a shutter
// click; nothing moves after. It holds still over the cut onto her next shot, exactly in place, and goes with the cut
// after, on a camera's flash; from there each cut under it is a flash (the picture overexposed, never a white card: the
// kit's Flash expose, the last film image of the shot that goes and the first two of the one that comes), each with its
// click, as someone taking photos. Then the montage takes over. Kept of its skill: its pass (its copy of her shot, its
// blur, its light, its timing in images), its title (its place a little under the middle, its capitals a fifth of the 4:3
// frame high, 800 px wide at most, its fade in three images, its small words a twelfth of its capitals by hand above its
// first letter, over an accent when it has one, no edge, no shadow), its flashes and their clicks (the title's louder,
// every third one softer). Left: its burst of things alike, its film burns, its jerky walk, its day-to-night match, its
// music's shape, its format (the piece plays in the Reel's frame). A covered lens is not measured for a piece: the pass
// is its own, half a beat into her first shot, and her title rises at its own moment after it. Its colour is her charter's
// main one when it reads on a pale sky and on a dark shot alike (a deep red, a violet, a coral), else the original's red;
// its type her title font, its small words in Caveat, as its skill's. Nothing of the original's own: its words are hers.

/** The pass, from the image it comes in (frames): all of it covered from this many images, out from this many, gone after this many. */
const PASS_IN = 6;
const PASS_OUT = 11;
const PASS_GONE = 16;
/** Her title fades in this many images after the pass comes in (under the pass that leaves). */
const TITLE_AFTER = 13;
/** Her title shows at least this long on her first shot before the cut it holds over (frames). */
const BEFORE_CUT = 6;
/** The shutter's click on her title's arrival and on each flash (a camera's, as its fiche hears it). */
const SHUTTER = { sound: "camera shutter", seconds: 0.5 };
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Its moments for a span (frames from its start): the pass coming in (half a beat into her first shot, earlier when it
 * is short, so her title shows a little on it before the cut), her title from its arrival to the cut after the one it
 * holds over (or its end), and a flash on that cut and on each one after.
 */
export function journeeMoments(input: Pick<PieceTimelineInput, "frames" | "bpm" | "shots">): { pass: number; title: number; titleTo: number; flashes: number[] } {
  const beat = (60 / input.bpm) * 30;
  const cuts = [...input.shots]
    .sort((a, b) => a.from - b.from)
    .slice(1)
    .map((s) => Math.round(s.from))
    .filter((f, i, all) => f > 0 && f < input.frames && all.indexOf(f) === i);
  const firstEnd = cuts[0] ?? input.frames;
  const pass = Math.max(0, Math.min(Math.round(beat / 2), firstEnd - TITLE_AFTER - BEFORE_CUT));
  return { pass, title: pass + TITLE_AFTER, titleTo: cuts[1] ?? input.frames, flashes: cuts.slice(1) };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const box = (x, y, w, t) => ({ position: "absolute", left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(t) });
  // Its shots: those that play during it, in order; the pass crosses the first one.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  const drawn = [];
  if (mine.length) {
    const first = mine[0];
    const cuts = [];
    mine.slice(1).forEach((i) => { const at = Math.round(shots[i].from); if (at > 0 && at < durationInFrames && cuts.indexOf(at) < 0) cuts.push(at); });
    // Its moments (frames: its timeline's marks; the same rule when one is missing).
    const BEAT = mark("beat", 18);
    const PASS = Math.max(0, Math.round(mark("pass", Math.max(0, Math.min(Math.round(BEAT / 2), (cuts.length ? cuts[0] : durationInFrames) - ${TITLE_AFTER + BEFORE_CUT})))));
    const TITLE = Math.round(mark("title", PASS + ${TITLE_AFTER}));
    const TITLE_TO = Math.round(mark("title_to", cuts.length > 1 ? cuts[1] : durationInFrames));
    const given = [];
    for (let k = 0; k < 16; k++) { const f = mark("flash_" + k, NaN); if (Number.isFinite(f)) given.push(Math.round(f)); }
    const flashes = given.length ? given : cuts.slice(1);

    // 1. A camera's flash on each of its cuts after the first (the kit's Flash expose): the picture overexposed, never a
    // white card, the last film image of the shot that goes and the first two of the one that comes, under her title.
    if (flashes.length) drawn.push(h(Flash, { key: "flash", at: flashes, expose: true, before: 2 }));

    // 2. Her title in the decor: elegant capitals a little under the middle, a fifth of the 4:3 frame high (a long one
    // smaller, on one line), fading in over three images under the pass that leaves, its small words by hand above its
    // first letter coming whole on the third (their x-height a twelfth of its capitals, their foot almost on them, over an
    // accent when its first letters carry one), nothing moving after; still over the cut onto her next shot, gone with the
    // cut after. Its colour: her charter's main one when it reads on a pale sky and on a dark shot alike, else the red of
    // the original; no edge, no shadow.
    const hex = /^#?([0-9a-f]{6})$/i.exec(String(brand.accent || "").trim());
    const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = hex ? (() => { const n = parseInt(hex[1], 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); })() : -1;
    const INK = lum >= 0.08 && lum <= 0.32 ? "#" + hex[1] : "#fa010c";
    const name = word("titre").replace(/(\d) (?=\d)/g, "$1\u00a0").toUpperCase();
    const small = word("surtitre").replace(/(\d) (?=\d)/g, "$1\u00a0");
    if (name && frame >= TITLE && frame < TITLE_TO) {
      const CAP = Math.round(width * 0.15);
      const F = Math.round(CAP / 0.75);
      const NW = Math.min(800, width - 280);
      const display = "'" + brand.displayFont + "', 'Bodoni Moda', 'Didot', serif";
      const hand = "'Caveat', '" + brand.bodyFont + "', cursive";
      const marked = /[\u0300-\u0326\u0329-\u036f]/.test(name.slice(0, 4).normalize("NFD"));
      drawn.push(h(FitText, { key: "title", style: box((width - NW) / 2, height * 0.52 - F * 0.95, NW, F * 1.9) }, (scale) => {
        const sw = Math.round(CAP / 12 / 0.4 / Math.max(0.4, scale));
        return h("div", { style: { position: "relative" } },
          small ? h("div", { "data-fauve-accent": "", style: { position: "absolute", left: Math.round(F * 0.03), bottom: "100%", marginBottom: -Math.round(F * (marked ? -0.11 : 0.09) - 0.08 * sw), fontFamily: hand, fontWeight: 600, fontSize: sw, lineHeight: 1, color: INK, whiteSpace: "nowrap", opacity: frame >= TITLE + 3 ? 1 : 0 } }, small) : null,
          h("div", { style: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: F, lineHeight: 1, letterSpacing: "-0.02em", textTransform: "uppercase", whiteSpace: "nowrap", color: INK, opacity: interpolate(frame, [TITLE, TITLE + 3], [0.25, 1], clamp) } }, name));
      }));
    }

    // 3. The pass, laid over her title: a copy of her first shot, enlarged and very blurred, a little darker (something
    // passing right in front of the lens), crossing from the right to the left, its edges very soft: in over 6 images, all
    // of it covered 5, out over 5.
    if (frame >= PASS && frame < PASS + ${PASS_GONE}) {
      const E = width * 0.22;
      const L = interpolate(frame, [PASS, PASS + ${PASS_IN}], [width, -E], clamp);
      const R = interpolate(frame, [PASS + ${PASS_OUT}, PASS + ${PASS_GONE}], [width + E, 0], clamp);
      const mask = "linear-gradient(to right, transparent " + Math.round(L) + "px, #000 " + Math.round(L + E) + "px, #000 " + Math.round(R - E) + "px, transparent " + Math.round(R) + "px)";
      drawn.push(h("div", { key: "pass", style: { ...full, overflow: "hidden", WebkitMaskImage: mask, maskImage: mask } },
        h("div", { style: { ...box((width * 3) / 8, (height * 3) / 8, width / 4, height / 4), transform: "scale(9.6)", filter: "blur(7px) brightness(0.72) saturate(0.85)" } },
          h(Footage, { shot: first, style: box(0, 0, width / 4, height / 4) }))));
    }
  }
  return h(AbsoluteFill, { style: { pointerEvents: "none", overflow: "hidden" } }, ...drawn);
}`;

export const journee: EffectPiece = {
  key: "journee",
  version: 1,
  name: "Une journée chez toi",
  how: "quelque chose de flou passe tout près de l'objectif sur son premier plan, et quand il repart, son titre est là derrière lui, en capitales élégantes au milieu de l'image avec de petits mots écrits à la main au-dessus et un déclic ; il reste immobile par-dessus la coupe sur le plan suivant, puis part sur un flash d'appareil photo, et chaque coupe suivante est un flash avec son déclic ; puis le montage reprend.",
  needs: "un plan calme et clair au milieu (le haut de sa façade ou son enseigne contre le ciel, un mur clair), un plan plus sombre (une porte, une arche, des gens qui s'éloignent), puis des plans courts de sa journée (des gens, des gestes, ses clients).",
  lays: "sur 3 à 8 de ses plans : le premier calme et clair, tenu deux temps au moins (le passage flou et le titre y arrivent), le deuxième plus sombre (le titre y reste), puis des plans d'un temps environ chacun (un flash sur chaque coupe)",
  shots: [2, 10],
  seconds: [2, 9],
  require: { files: 3, shot: { framing: ["wide", "medium"] } },
  texts: [
    {
      slot: "titre",
      want: "le titre en capitales élégantes au milieu de l'image, sur une ligne : un seul mot de préférence (sa ville, son quartier, sa rue, son nom s'il est court, sinon le mot de son nom qui la distingue : « Farine » pour « Maison Farine »)",
      max: 14,
      required: true,
    },
    {
      slot: "surtitre",
      want: "2 ou 3 petits mots écrits à la main au-dessus du titre, alignés sur sa première lettre, qui l'amènent (une forme comme « une journée à », « un samedi chez », « le matin au »)",
      max: 20,
      required: false,
    },
  ],
  timeline({ frames, bpm, shots }) {
    const m = journeeMoments({ frames, bpm, shots });
    const click = (f: number, gain = 0) => ({ at: round3(f / 30), ...SHUTTER, ...(gain ? { gain } : {}) });
    return {
      marks: { pass: m.pass, title: m.title, title_to: m.titleTo, ...Object.fromEntries(m.flashes.slice(0, 16).map((f, k) => [`flash_${k}`, f])) },
      // A shutter's click on her title's arrival (the loudest) and on each flash, every third one softer (a series).
      sounds: [click(m.title, 3), ...m.flashes.slice(0, 15).map((f, k) => click(f, k % 3 === 2 ? -6 : 0))],
    };
  },
  code: CODE,
  fonts: ["Caveat"],
};
