import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Ville en coups de fouet », the effect (docs/fiches/coups-de-fouet.md, effects 1, 2 and 3; its whole Reel is
// skills/coups-de-fouet.ts): over a run of her shots, the first one, her wide calm shot with sky, lands on a white flash
// with a dull thud, her name in very condensed white capitals laid still in its sky (ClearBox, its sky first, read on its
// first image and kept there) while the picture pushes in behind it from its centre (the original's ×1,11 over the shot);
// a whip flash takes the name away into her next shot: the kit's Whip between her two shots, two blurred images and the
// cut on the second, lit up as the original's (its two images twice as bright as the shots around them), with a whoosh;
// then her shots of a beat or so, chained by white flashes (the shot before lit up an image, then a near-white image over
// the next one, which shows through) and more whip flashes, every other cut, the cuts in between hard as the original's.
// Then the montage takes over. Kept of its skill: its name's place, size and stillness, its push, its whip flash (two
// images, the cut on the second, the same light), its white flash (its two images and their light), its thud and its
// whoosh. Left: its format (the piece plays in the Reel's frame), its 23 roles and their beats, its black and white, its
// ghost images, its rush in, its jerky whip and its sweep out (they need her camera's own whips, measured on her videos:
// not for a piece), its film grade (her Reel has its own look). Its music (v2): muffled under her name, open at once on
// the whip that takes it away (its skill's pad, then its percussion). Her real whips are not measured for a
// piece: the effect draws its whips itself, at the cuts under it. Its lettering is its own, a very condensed face (League
// Gothic, the original's extra-condensed capitals: Big Shoulders Display, its skill's, writes a name twice as wide), in
// white, a tight shade dosed to the light of her sky (LightUnder) so it reads on a pale one. Nothing of the original's own:
// its city's name gives way to hers.

/** What plays on the cuts under it after the first (a whip flash, which takes her name away): a white flash, a hard cut, a whip flash, a hard cut, again. */
const CYCLE = ["flash", "cut", "whip", "cut"] as const;
export type FouetCut = "whip" | (typeof CYCLE)[number];

/** What plays on its k-th cut (0 the first). */
export const fouetCut = (k: number): FouetCut => (k <= 0 ? "whip" : CYCLE[(k - 1) % CYCLE.length]!);

/** Its cuts: where each of its shots after the first starts (frames from its start), once and inside it, each with what plays on it. */
export function fouetCuts(shots: PieceTimelineInput["shots"], frames: number): { at: number; kind: FouetCut }[] {
  const starts = [...shots]
    .sort((a, b) => a.from - b.from)
    .slice(1)
    .map((s) => Math.round(s.from))
    .filter((f, i, all) => f > 0 && f < frames && all.indexOf(f) === i);
  return starts.map((at, k) => ({ at, kind: fouetCut(k) }));
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const laid = { left: 0, top: 0, width, height };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  // Its shots: those that play during it, in order; the first one is her wide calm shot, where her name sits.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  const drawn = [];
  if (mine.length) {
    const ground = mine[0];
    // Its cuts (where each next shot starts), each with what plays on it: a whip flash first (it takes her name away),
    // then a white flash, a hard cut, a whip flash, a hard cut, again (the original chains them on about half its cuts).
    const CYCLE = ${JSON.stringify(CYCLE)};
    const cuts = [];
    mine.slice(1).forEach((i) => {
      const at = Math.round(shots[i].from);
      if (at <= 0 || at >= durationInFrames || cuts.some((c) => c.at === at)) return;
      const k = cuts.length;
      const before = mine.filter((j) => Math.round(shots[j].from) < at).pop();
      cuts.push({ at, shot: i, before: before === undefined ? ground : before, kind: k === 0 ? "whip" : CYCLE[(k - 1) % CYCLE.length] });
    });

    // Her shot as the effect draws it in a box: the first one pushed in from its centre behind her name, steadily, the
    // original's ×1,11 over the shot (a photo stays still); the others as filmed.
    const PUSH = 1.11;
    const scaleOf = (i) => {
      if (i !== ground || shots[i].kind === "photo") return 1;
      const len = Math.max(1, shots[i].durationInFrames);
      return Math.pow(PUSH, Math.max(0, Math.min(len - 1, frame - shots[i].from)) / len);
    };
    const shot = (i, size) => {
      const w = size && size.width ? size.width : width;
      const t = size && size.height ? size.height : height;
      const k = scaleOf(i);
      return h("div", { style: { position: "absolute", left: 0, top: 0, width: w, height: t, overflow: "hidden" } },
        h(Footage, { shot: i, style: { position: "absolute", left: 0, top: 0, width: w, height: t, ...(k > 1.0001 ? { transform: "scale(" + k.toFixed(4) + ")" } : {}) } }));
    };

    // The whip flash: the kit's Whip from the shot before to the next one, its two blurred images on the cut's image
    // and the one before (the cut on its second, as the original's), lit up as the original's (its two images at 166 and
    // 181 of 255, its shots around them 40 to 115), every other one the other way.
    const whips = cuts.filter((c) => c.kind === "whip");
    const live = whips.find((c) => frame >= c.at - 1 && frame <= c.at);
    const firstCut = cuts.length ? cuts[0].at : durationInFrames;
    if (live) {
      drawn.push(h(Whip, { key: "whip", from: (size) => shot(live.before, size), to: (size) => shot(live.shot, size), at: live.at - 2, frames: 3, direction: whips.indexOf(live) % 2 ? "right" : "left", blur: 130 }));
    } else if (frame < firstCut) {
      drawn.push(h("div", { key: "ground", style: full }, shot(ground)));
    }

    // Its white veil at this image: the whip flash's light; a white flash (the shot before lit up an image, then a
    // near-white image over the next one, which shows through); and the white her wide shot lands on, when it starts
    // with the effect (its name already in it, as the original's).
    let veil = live ? (frame === live.at - 1 ? 0.36 : 0.44) : 0;
    cuts.forEach((c) => {
      if (c.kind === "flash") veil = Math.max(veil, frame === c.at ? 0.9 : frame === c.at - 1 ? 0.3 : 0);
    });
    if (frame === 0 && Math.round(shots[ground].from) === 0) veil = Math.max(veil, 0.9);
    if (veil > 0) drawn.push(h("div", { key: "veil", style: { ...full, background: "#ffffff", opacity: veil } }));

    // Her name: very condensed white capitals, still in her sky from the first image to the whip flash that takes it
    // away, while the picture pushes in behind it. Its capitals about 11 % of the frame's width high, as the original's,
    // 800 px wide at most (clear of the apps' buttons); in the largest clear area of her wide shot, its sky first, read on
    // its first image and kept there, down to half its size; in its upper part when there is none.
    const name = word("nom").replace(/(\d) (?=\d)/g, "$1\u00a0").toUpperCase();
    const nameTo = cuts.length && cuts[0].kind === "whip" ? firstCut - 1 : firstCut;
    if (name && frame < nameTo) {
      const SIZE = 168;
      const nameW = Math.min(800, Math.round(Math.max(4, Array.from(name).length) * SIZE * 0.36));
      const nameH = Math.round(SIZE * 1.08);
      const upper = { x: Math.round((width - nameW) / 2), y: Math.round(height * 0.3 - nameH / 2), w: nameW, h: nameH };
      const spot = ClearBox(shots[ground], 0, laid, { aspect: nameW / nameH, min: { w: Math.round(nameW * 0.5), h: Math.round(nameH * 0.5) }, max: { w: nameW, h: nameH }, pad: 12, fallback: upper }) || upper;
      const fit = Math.min(1, spot.h / nameH);
      // A hair of shade on a dark sky, a little more on a pale one (the original's sky is grey, hers may be white).
      const light = LightUnder(shots[ground], 0, laid, spot);
      const dose = light ? interpolate(light.mean, [0.45, 0.85], [0.3, 0.62], clamp) : 0.45;
      const shade = "0 0 2px rgba(0,0,0," + dose.toFixed(2) + "), 0 1px 4px rgba(0,0,0," + (dose * 0.6).toFixed(2) + ")";
      const display = "'League Gothic', '" + brand.displayFont + "', 'Oswald', 'Arial Narrow', sans-serif";
      drawn.push(h(FitText, { key: "name", style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(spot.h) }, innerStyle: { fontFamily: display, fontWeight: 400, fontSynthesis: "none", fontSize: Math.round(SIZE * fit), lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade } }, name));
    }
  }
  return h(AbsoluteFill, { style: { pointerEvents: "none", overflow: "hidden" } }, ...drawn);
}`;

export const coupsDeFouet: EffectPiece = {
  key: "coups-de-fouet",
  version: 2,
  name: "Ville en coups de fouet",
  how: "son plan large et calme arrive sur un flash blanc, son nom en capitales blanches très condensées posé immobile dans son ciel pendant que l'image avance doucement derrière ; un fouet éclair l'emporte dans le plan suivant, puis ses plans d'un temps environ s'enchaînent en flashs blancs et fouets éclair, une coupe sur deux ; puis le montage reprend.",
  needs: "un plan large et calme de sa rue, de sa façade ou de son quartier, avec du ciel au-dessus des toits (son nom s'y pose), puis des plans vivants de son quartier ou de son lieu (des passants, un vélo, un tram, sa devanture, un détail de couleur).",
  lays: "sur 3 à 8 de ses plans, le premier son plan large avec du ciel, tenu deux temps au moins (son nom s'y lit), les suivants d'un temps environ chacun",
  shots: [2, 10],
  seconds: [2, 9],
  require: { files: 3, shot: { framing: ["wide"], outdoors: true } },
  texts: [
    {
      slot: "nom",
      want: "son nom posé dans le ciel du premier plan, en capitales très condensées sur une ligne : son quartier, sa ville ou le nom de son lieu, 1 à 3 mots (une forme comme « Belleville », « Paris 11e », « Chez Lino »)",
      max: 18,
      required: true,
    },
  ],
  timeline({ frames, shots }): PieceTimeline {
    const cuts = fouetCuts(shots, frames);
    // Her music muffled under her name (its skill's pad before its percussion), open at once on the whip that takes it away.
    const whip = cuts.find((c) => c.kind === "whip");
    return {
      ...(whip && whip.at >= 9 ? { music: { filters: [{ kind: "muffled" as const, from: 0, to: round3(whip.at / 30) }] } } : {}),
      // Its original's own: a dull thud as her name lands, a whoosh rising into each whip flash (softer after the first).
      sounds: [
        { at: 0, sound: "deep soft thud", seconds: 0.6 },
        ...cuts.flatMap((c, k) => (c.kind === "whip" ? [{ at: round3((c.at - 1) / 30), sound: "quick air whoosh", seconds: 0.5, ...(k ? { gain: -4 } : {}) }] : [])),
      ],
    };
  },
  code: CODE,
  fonts: ["League Gothic"],
};
