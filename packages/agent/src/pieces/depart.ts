import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Disparition au passage », the effect of « Le grand départ » (docs/fiches/depart.md, effects 1 to 4; its whole Reel is
// skills/depart.ts, version 1): over ONE shot of her standing at her place (her door, her front, her counter), phone
// posed, and the shot after it if any (her place empty, the end of the same video once she is out of the frame): her
// picture comes from close and steps back in three jumps (2,88, 2,04 and 1,56 times on its first five images, about her
// chest), at 15 images a second like the original's departure (each image held two frames); a dark streaked mass passes
// right before the lens from the right to the left (her picture held, enlarged 1,6 times, blurred along the way it goes
// and darkened, as the original's bus is a flank streaked by its speed), at 15 images a second too, covering her whole
// picture from six images before the cut to one after; under it the cut: her place empty, held still seven images (the
// original's), revealed by the mass's edge as it leaves to the left, then playing on. With her shot alone, the mass
// covers the effect's last six images and the montage's next shot comes out from under it: the cut hidden there all the
// same. A soft whoosh as it passes (the original's bus has its own sound; her shots are silent under the music). Kept
// from the model: the steps of its zoom out, its 15 images a second, the mass's timing and its edges. Left out: its black
// and white (the Reel's own look), its journey, its rush, its arrival and its music (the model's whole Reel), its format
// setting (the montage frames her shots).

const CODE = String.raw`function Scene({ width, height, durationInFrames, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const list = shots || [];
  // Its shots: those the engine counts under it (their indices in shots), else those playing during it; her standing
  // shot first, her place empty (or the next shot) second.
  const counted = String((texts && texts.mine) || "").split(",").filter((v) => v !== "").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = counted.length ? counted : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const k0 = mine.length ? mine[0] : -1;
  const k1 = mine.length > 1 ? mine[1] : -1;
  const BOX = { position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" };
  // The cut under the mass: the start of her second shot, else the effect's end (the montage's next shot after it).
  const CUT = k1 >= 0 ? Math.max(8, Math.min(D, Math.round(list[k1].from))) : D;
  // One of her shots full frame, scaled s times about where someone standing has her face and her chest (44 % down),
  // its picture always covering the frame.
  const pic = (i, s, extra, key) => {
    const w = W * s;
    const ht = H * s;
    const left = Math.min(0, Math.max(W - w, W / 2 - 0.5 * w));
    const top = Math.min(0, Math.max(H - ht, H / 2 - 0.44 * ht));
    return h("div", { key, style: BOX }, h(Footage, { shot: i, style: { position: "absolute", left: Math.round(left), top: Math.round(top), width: Math.round(w), height: Math.round(ht) }, ...(extra || {}) }));
  };

  // 1. Her at her place: three steps back on her shot's first five images (or the effect's, when it started before),
  // then her whole place; each image held two frames (15 a second).
  const f0 = k0 >= 0 ? frame - Math.max(0, Math.round(list[k0].from)) : frame;
  const STEPS = [2.88, 2.04, 2.04, 1.56, 1.56];
  const stand = k0 >= 0 && frame < CUT ? pic(k0, f0 >= 0 && f0 < 5 ? STEPS[f0] : 1, { hold: 2 }, "stand") : null;
  // 2. Her place empty from the cut: its first image held seven images, then playing on.
  const empty = k1 >= 0 && frame >= CUT ? pic(k1, 1, frame < CUT + 7 ? { hold: 7 } : null, "empty") : null;

  // 3. The mass that passes before her lens, from the right: its left edge in over the six images before it covers her
  // whole picture, covering from six images before the cut to one after, its right edge out to the left over five; moving
  // at 15 images a second like the shot.
  const E = W * 0.22;
  const v0 = CUT - 12;
  const step = v0 + Math.floor((frame - v0) / 2) * 2;
  const L = interpolate(step, [v0, CUT - 6], [W, -E], clamp);
  const R = interpolate(step, [CUT + 1, CUT + 6], [W + E, 0], clamp);
  const mask = "linear-gradient(to right, transparent " + Math.round(L) + "px, #000 " + Math.round(L + E) + "px, #000 " + Math.round(R - E) + "px, transparent " + Math.round(R) + "px)";
  // Her picture held on its image before the cut, its middle blown up 9,6 times (nothing of her recognisable: something
  // out of focus right before the lens), streaked along the way it goes (a blur along x, its id this image's), darkened.
  const held = k0 >= 0 ? Math.max(0, Math.min(list[k0].durationInFrames - 1, CUT - 1 - Math.round(list[k0].from))) : 0;
  const vid = "dp-pass-" + frame;
  const small = { position: "absolute", left: 0, top: 0, width: Math.round(W / 4), height: Math.round(H / 4) };
  const veil = k0 >= 0 && frame >= v0 && frame < CUT + 6
    ? h("div", { key: "veil", style: { ...BOX, WebkitMaskImage: mask, maskImage: mask } },
        h("svg", { width: 0, height: 0, style: { position: "absolute" } },
          h("filter", { id: vid, x: "-25%", y: "-5%", width: "150%", height: "110%", colorInterpolationFilters: "sRGB" }, h("feGaussianBlur", { stdDeviation: "16 1.2" }))),
        h("div", { style: { ...small, left: Math.round(W * 0.375), top: Math.round(H * 0.375), transform: "scale(9.6)", filter: "url(#" + vid + ") brightness(0.36) saturate(0.5)" } },
          h(Footage, { shot: k0, at: frame - held, style: small })))
    : null;
  return h(AbsoluteFill, null, stand, empty, veil);
}`;

/** When its mass covers the whole picture (frames from its start): six images before its cut to one after, the cut at its second shot's start, else its end. */
export function departCover(input: Pick<PieceTimelineInput, "frames" | "shots">): { cut: number; from: number; to: number } {
  const second = input.shots[1];
  const cut = second ? Math.max(8, Math.min(input.frames, Math.round(second.from))) : input.frames;
  return { cut, from: Math.max(0, cut - 6), to: Math.min(input.frames, cut + 1) };
}

export const depart: EffectPiece = {
  key: "depart",
  version: 1,
  name: "Disparition au passage",
  how: "la personne debout devant son lieu, l'image qui part de près et recule en trois sauts, saccadée à 15 images par seconde ; une masse floue passe tout près devant l'objectif, de la droite vers la gauche, avec un souffle, et cache la coupe : la personne a disparu, son lieu vide tenu un instant puis qui reprend (ou le plan suivant du montage) ; puis le montage reprend.",
  needs: "une vidéo fixe de quelqu'un debout devant son lieu (sa porte, sa devanture, son comptoir), le téléphone posé, et si possible le même endroit vide juste après (la fin de la même vidéo une fois hors du cadre).",
  lays: "sur ce plan d'elle debout et le plan de son lieu vide qui le suit (sinon le plan suivant), plutôt en ouverture comme l'original : un départ, juste avant un trajet ou une sortie",
  shots: [1, 2],
  seconds: [1.2, 3],
  require: { files: 1, shot: { still: true, person: true, video: true } },
  texts: [],
  timeline(input: PieceTimelineInput) {
    const { from, to } = departCover(input);
    return {
      // Its mass passing close before the lens: a soft whoosh peaking as it covers her whole picture.
      sounds: [{ at: Math.round(((from + to) / 2 / 30) * 1000) / 1000, sound: "fast soft whoosh of a vehicle passing close", seconds: 0.8, gain: -6 }],
    };
  },
  code: CODE,
};
