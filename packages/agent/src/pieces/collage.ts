import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Collage qui s'emboîte », the effect (docs/fiches/collage.md, effects 2, 3 and 5; its whole Reel is skills/collage.ts,
// version 1): over a run of her shots, each next shot arrives first in a piece over the one before, on its last step,
// then whole at its cut: its person cut out at her own place (Subject in the montage's frame, no rim, no shadow), its
// ground without its sky when a sky is read there (Skyline, SkylineAt), or seen through the silhouette of the person
// before (SubjectOutline as a clip path, the next shot at its own place and size), in the original's order: a person,
// a ground, a silhouette, again; each move falling back to her person arriving, else a plain cut, never an empty step.
// Its step is a sixteenth of the Reel's beat (the original's 6 images at 75 BPM), an eighth when a sixteenth is under 5
// images, never more than half the shot it lands on. Its optional title, as the model's: white condensed
// capitals on a band of her colour across the frame, high, through its first two seconds, what arrives passing in
// front of it. Left out: its parade, its black and white, its window in a named thing (the editor's shots under it are
// not cast for them), its loop (the montage resumes after it), its music (the montage's runs under an effect).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  // Its shots: those that play during it, as the engine counts them (texts.mine), else by their moments.
  const listed = String((texts && texts.mine) || "").split(",").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < shots.length);
  const mine = listed.length ? listed : shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  const laid = { left: 0, top: 0, width, height };
  const BEAT = mark("beat", 18);
  const STEP = mark("step", BEAT / 4 >= 5 ? BEAT / 4 : BEAT / 2);

  // 1. Its moves at each cut under it, in the original's order: her person arriving, its ground without its sky, the
  // next shot through her silhouette; each one's fallback her person arriving, else a plain cut.
  const hasCut = (i) => i >= 0 && i < shots.length && Boolean(SubjectBox(shots[i], shots[i].from, laid));
  const her = (i, key) => h(Subject, { key, shot: i, style: laid });
  const through = (d, i, key) => h("div", { key, style: { position: "absolute", left: 0, top: 0, width, height, clipPath: "path('" + d + "')" } }, h(Footage, { shot: i, style: laid }));
  const pieces = [];
  for (let k = 0; k + 1 < mine.length; k++) {
    const cur = mine[k];
    const next = mine[k + 1];
    const cut = Math.round(shots[next].from);
    const tail = Math.round(Math.min(STEP, shots[cur].durationInFrames * 0.5));
    if (tail < 3 || frame < cut - tail || frame >= cut || cut <= 0) continue;
    const move = k % 3;
    if (move === 1 && SkylineAt(shots[next], shots[next].from, laid) !== null) {
      pieces.push(h(Skyline, { key: "g" + next, shot: next, style: laid }));
      continue;
    }
    if (move === 2) {
      const d = SubjectOutline(shots[cur], frame, laid);
      if (d) {
        pieces.push(through(d, next, "w" + next));
        continue;
      }
    }
    if (hasCut(next)) pieces.push(her(next, "a" + next));
  }

  // 2. Its title (optional): white condensed capitals on a band of her colour across the frame, high, through its first
  // two seconds; what arrives passes in front of it. Her colour when dark enough for white letters, else her dark one, else ink.
  const luma = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return 1;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  const AWNING = [brand.accent, brand.palette && brand.palette.dark].find((c) => luma(c) <= 0.55) || "#1d1d1b";
  const title = word("titre");
  const shown = title && frame < Math.min(durationInFrames, Math.max(60, Math.round(durationInFrames * 0.5)));
  const band = shown
    ? [
        h("div", { key: "awning", style: { position: "absolute", left: 0, top: 250, width, height: 190, backgroundColor: AWNING } }),
        h(FitText, { key: "title-" + title, style: { position: "absolute", left: 60, top: 273, width: width - 120, height: 144 }, innerStyle: { fontFamily: display, fontWeight: 800, fontSize: 150, lineHeight: 1, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", whiteSpace: "nowrap" } }, keep(title)),
      ]
    : null;

  return h(AbsoluteFill, null, band, pieces);
}`;

/** Its step for a span (frames): a sixteenth of the beat, an eighth when a sixteenth is under 5 images. */
export function collageStep(beat: number): number {
  return beat / 4 >= 5 ? beat / 4 : beat / 2;
}

export const collage: EffectPiece = {
  key: "collage",
  version: 1,
  name: "Images qui s'emboîtent",
  how: "à chaque coupe, l'image suivante arrive d'abord en morceau sur la précédente, puis entière : sa personne détourée à sa place, ses toits sans leur ciel, ou vue dans la silhouette de la personne d'avant, une fois l'un, une fois l'autre ; un titre facultatif en capitales blanches sur une bande de sa couleur en haut ; puis le montage reprend.",
  needs: "plusieurs photos ou courtes vidéos avec un sujet net (des personnes debout, en entier ou jusqu'à la taille, ses produits bien détachés), et si possible un plan de dehors avec du ciel.",
  lays: "sur 3 à 8 de ses plans coupés d'un temps chacun (ou d'un demi-temps à tempo lent), qui ne se ressemblent pas : des personnes, des lieux, des détails",
  shots: [2, 8],
  seconds: [1.2, 6],
  require: { files: 3, shot: { person: true } },
  texts: [
    {
      slot: "titre",
      want: "facultatif : son nom, ou deux à quatre mots qui disent ce qu'on voit (une forme comme « Brunch du dimanche », « Belleville »), jamais sa phrase entière ; en capitales blanches sur une bande de sa couleur en haut de l'image",
      max: 22,
      required: false,
    },
  ],
  timeline(input: PieceTimelineInput) {
    // Every shot under it but its first may arrive cut out (her person), and the one before a silhouette move lends its
    // outline: all but its first, by their rank among its shots.
    return { marks: { step: collageStep((60 / input.bpm) * 30) }, cutouts: input.shots.map((_, k) => k).filter((k) => k > 0) };
  },
  code: CODE,
};
