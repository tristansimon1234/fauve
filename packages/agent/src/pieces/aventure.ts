import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Un an de plus », the effect (docs/fiches/aventure.md, effects 1 and 2; its whole Reel is skills/aventure.ts,
// version 1): over her strongest shot, close up, and the one or two that follow, her counter is laid in the middle in
// condensed capitals on two lines, white and translucent (the picture seen through it), from its first image (where
// the editor lays it: on a strong beat, the original's drop); one beat later its number takes one more (« 4 ANS », then
// « 5 ANS », hers: never invented) and swells a quarter for three images, its other line still; before the cut into
// the next shot, the colours of her strong shot fill the lens (its powder, its flour, its steam: a copy of it enlarged
// and very blurred) and hide the cut; the counter stays over it and goes at once with the effect's last image (laid
// over three beats, as the original's); then the montage resumes. Kept from the model: its counter's lettering (her title font, the model's Bebas Neue when she chose
// it; capitals 8 % of the height, centred a little under the middle, about 48 % white), its tick and swell, its cover's
// timing (in over six images, out over three towards the top left), its dark ink on a bright place (her light read
// under it). Left out: its other hidden cuts, its plunge, its music (the montage's runs under an effect: a drop on its
// first image would mean shaping the music before it), its format setting and its ending card.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const list = shots || [];
  // Its shots: those that play during it, as the engine counts them (texts.mine), else as they fall in its span.
  const given = String((texts && texts.mine) || "").split(",").map((s) => Number(s)).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const BEAT = mark("beat", 18);
  const TICK = Math.round(mark("tick", Math.round(1.05 * BEAT)));
  const OUT = Math.round(mark("out", D));
  const BOX = { left: 0, top: 0, width, height };
  const k0 = mine.length ? mine[0] : -1;
  const k1 = mine.length > 1 ? mine[1] : -1;
  const CUT = k1 >= 0 ? Math.max(1, list[k1].from) : -1;

  // 1. The colours of her strong shot filling the lens before the cut into the next one: a copy of it enlarged and very
  // blurred, in over six images, held one past the cut, out over three towards the top left.
  const fill = (() => {
    if (k0 < 0 || CUT < 0 || frame < CUT - 6 || frame >= CUT + 4) return null;
    const o = interpolate(frame, [CUT - 7, CUT], [0, 1], clamp);
    const out = interpolate(frame, [CUT + 1, CUT + 4], [0, 130], clamp);
    const mask = out > 0 ? "linear-gradient(315deg, transparent " + Math.round(out - 30) + "%, #000 " + Math.round(out) + "%)" : "none";
    const q = { position: "absolute", left: 0, top: 0, width: Math.round(width / 4), height: Math.round(height / 4) };
    return h("div", { key: "fill", style: { position: "absolute", left: 0, top: 0, width, height, overflow: "hidden", opacity: o, WebkitMaskImage: mask, maskImage: mask } },
      h("div", { style: { ...q, left: Math.round((width * 3) / 8), top: Math.round((height * 3) / 8), transform: "scale(6.4)", filter: "blur(6px) brightness(1.05) saturate(1.3)" } },
        h(Footage, { shot: k0, style: q })));
  })();

  // 2. Her counter: one or two words of condensed capitals on two lines, her number one less first, hers one beat later
  // swelling for three images; in dark ink on a bright place (her strong shot's light under it).
  const said = word("compteur").replace(/\s+/g, " ");
  const CAP = height * 0.08;
  const cy = height * 0.527;
  const zone = { x: width * 0.2, y: cy - CAP * 1.4, w: width * 0.6, h: CAP * 2.8 };
  const light = k0 >= 0 ? LightUnder(list[k0], frame, BOX, zone) : null;
  const INK = light && light.mean >= 0.6 ? "#17130f" : "#ffffff";
  const display = "'" + brand.displayFont + "', 'Bebas Neue', 'Oswald', sans-serif";
  const counter = (() => {
    if (!said || frame >= OUT) return null;
    const nums = said.match(/\d+/g) || [];
    const last = nums.length ? nums[nums.length - 1] : null;
    const pos = last ? said.lastIndexOf(last) : -1;
    const v = last ? Number(last) : NaN;
    const before = last && v >= 1 ? said.slice(0, pos) + String(v - 1).padStart(last.length > 1 && last[0] === "0" ? last.length : 1, "0") + said.slice(pos + last.length) : said;
    const shown = frame < TICK ? before : said;
    const words = shown.split(" ");
    const lines = words.length > 1 ? [words.slice(0, -1).join(" "), words[words.length - 1]] : [shown];
    const numLine = !last ? -1 : lines.length > 1 && pos > said.lastIndexOf(" ") ? 1 : 0;
    const k = frame - TICK;
    const swell = k >= 1 && k <= 3 ? [1.25, 1.35, 1.12][k - 1] : 1;
    const F = Math.round(CAP / 0.7);
    return lines.map((line, i) => {
      const y = lines.length > 1 ? cy + (i ? 0.585 : -0.585) * CAP : cy;
      const s = numLine < 0 || numLine === i ? swell : 1;
      return h(FitText, { key: "n" + i + line, style: { position: "absolute", left: Math.round(width / 2 - 295), top: Math.round(y - CAP * 0.72), width: 590, height: Math.round(CAP * 1.44), opacity: 0.48, ...(s !== 1 ? { transform: "scale(" + s + ")", filter: k <= 2 ? "blur(2px)" : "none" } : {}) }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: F, lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", whiteSpace: "nowrap", color: INK } }, line);
    });
  })();
  return h(AbsoluteFill, null, fill, counter);
}`;

/**
 * Its counter's moments, frames from its start: its number one more a beat in (the original's 14 images), ten images
 * before its end at the latest; it goes with the effect's last image (laid over three beats, as the original's: an
 * effect draws something at every image of its span, the scene check refuses an empty one).
 */
export function aventureMoments(frames: number, bpm: number): { tick: number; out: number } {
  const beat = (60 / bpm) * 30;
  return { tick: Math.max(1, Math.min(frames - 10, Math.round(1.05 * beat))), out: frames };
}

export const aventure: EffectPiece = {
  key: "aventure",
  version: 1,
  name: "Un an de plus",
  how: "son compteur en capitales étroites, blanches et translucides, posé au milieu de son plan le plus fort ; un temps plus tard son nombre prend un de plus (« 4 ANS », puis « 5 ANS ») et gonfle trois images ; les couleurs de ce plan remplissent l'objectif et cachent la coupe sur le suivant, et le compteur part d'un coup avec la fin de l'effet ; puis le montage reprend.",
  needs: "un gros plan fort au milieu de l'image (un visage dans un moment fort, de la farine, des confettis, de la vapeur), et ce qu'elle compte (ses années, une saison, une édition, l'année qu'elle raconte).",
  lays: "en ouverture ou sur un temps fort : son plan le plus fort d'abord (un peu plus d'une seconde, deux temps et demi), puis le début du plan suivant, qui bouge ; trois temps en tout, le compteur part avec sa fin",
  shots: [1, 3],
  seconds: [1.2, 2.5],
  require: { files: 1, shot: { framing: ["close", "medium"] } },
  texts: [
    {
      slot: "compteur",
      want: "ce que compte son histoire, en un ou deux mots courts (le code les met en capitales), avec le nombre qu'elle atteint : son âge (« 5 ans » pour ses 5 ans), une saison (« saison 3 »), une édition (« édition 4 »), l'année qu'elle raconte (« 2026 ») ; le code montre d'abord le nombre d'avant ; jamais un nombre inventé : sans nombre dans sa demande ni dans ce qu'on sait d'elle, un ou deux mots de ce qu'on raconte (« un an », « l'été »)",
      max: 12,
      required: true,
    },
  ],
  timeline(input: PieceTimelineInput) {
    return { marks: aventureMoments(input.frames, input.bpm) };
  },
  code: CODE,
};
