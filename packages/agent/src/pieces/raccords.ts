import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Plans qui s'emboîtent », the effect (docs/fiches/raccords.md, effects 3 to 6; its whole Reel is skills/raccords.ts,
// version 1): at each cut under it, the next shot arrives first over the shot on screen, exactly where it will be,
// frozen on its first image, in pieces on the beats; the cut then makes it play. Over one cut, its pieces: what stands
// out in the next shot, cut out on its first image, in three pieces (its two outer thirds, then its middle, on 4¾, 3¾ and
// 2 sixteenths before the cut). Over two or three cuts, first the next shot's picture in nine square cells about the
// middle (one, its column, the cross, all nine, on 5¼, 4¼, 2¼ and 1¼ sixteenths before the cut), dimmed to 41 % of its
// light, the shot arriving dimmed and lit in three images onto 1¾ sixteenths after it (the original's lamp on its bar's
// first beat); then the pieces; then that subject whole, 2½ sixteenths before the cut, the cut keeping it in place (the
// match). Without a cut-out worth it (none made, a subject under 4 % of the frame), its picture in cells on the same
// hits. Its cells about the subject of the shot they show, where the montage frames it (its focus). The music loses its bass while each one builds, and gets it back where it lands (the cut, or the light). Kept
// from the model: the cells' grid (0,7 of the width, each cell 0,27 of it, square, about the middle at 53 % of the
// height without a focus), their order, the thirds, the dim and its light, their sixteenths at the Reel's tempo (pressed into a short
// shot, the earliest left out when it is too short). Left out: its word blinking over the first shot, its double
// exposure, its format setting (the montage frames her shots), its ending card.

/** Its raccords, in order: the nine cells, the subject in three pieces, the subject whole. */
type Kind = 1 | 2 | 3;
/** Each raccord's hits, in sixteenths before its cut (the model's), and where the cells' shot lights up after its cut. */
const POPS: Record<Kind, number[]> = { 1: [-5.25, -4.25, -2.25, -1.25], 2: [-4.75, -3.75, -2], 3: [-2.5] };
const LIT = 1.75;

/**
 * Its cuts over a span: each shot after its first that starts inside it (three at most), its raccord (the pieces alone
 * for one cut; the cells first, then the pieces, then whole for a third), its hits (frames from its start: after the cut
 * before it, the earliest left out when there is no room) and, for the cells, the image its shot is lit on.
 */
export function raccordPieces(shots: PieceTimelineInput["shots"], frames: number, bpm: number): { at: number; rank: number; kind: Kind; pops: number[]; lit?: number }[] {
  const sixteenth = 450 / Math.min(140, Math.max(60, bpm));
  const starts = shots
    .map((s, rank) => ({ at: Math.round(s.from), rank }))
    .filter((c, i, all) => c.at > 0 && c.at < frames && all.findIndex((x) => x.at === c.at) === i)
    .sort((a, b) => a.at - b.at)
    .slice(0, 3);
  // One cut: its pieces (what stands out in the next shot, cut out); two: the cells, then the pieces; three: then whole.
  const kinds: Kind[] = starts.length === 1 ? [2] : [1, 2, 3];
  return starts.map((c, k) => {
    const kind = kinds[k]!;
    const lo = k === 0 ? 0 : starts[k - 1]!.at + 2;
    const offsets = POPS[kind];
    // Its hits at the Reel's tempo, pressed toward the cut when the shot is too short for them, never on the same image.
    const room = c.at - 1 - lo;
    const want = -offsets[0]! * sixteenth;
    const squeeze = want > room && room > 0 ? room / want : 1;
    const pops: number[] = [];
    for (const o of offsets) {
      const p = Math.round(c.at + o * sixteenth * squeeze);
      if (p >= lo && p < c.at && (!pops.length || p > pops.at(-1)!)) pops.push(p);
    }
    if (!pops.length) pops.push(Math.max(lo, c.at - 1));
    const next = starts[k + 1]?.at ?? frames;
    const lit = kind === 1 ? Math.min(frames - 1, next - 1, Math.round(c.at + LIT * sixteenth)) : undefined;
    return { ...c, kind, pops, ...(lit !== undefined && lit > c.at ? { lit } : {}) };
  });
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const list = shots || [];
  const box = { position: "absolute", left: 0, top: 0, width, height };
  const laid = { left: 0, top: 0, width, height };
  // Its shots, as the engine counts them, and its cuts (where each one after the first starts, inside it), each with
  // the raccord its timeline gives it (its kind, its hits, the image its shot is lit on).
  const given = String((texts && texts.mine) || "").split(",").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < durationInFrames && list[i].from + list[i].durationInFrames > 0);
  const cuts = [];
  mine.slice(1).forEach((i) => {
    const at = Math.round(list[i].from);
    if (at <= 0 || at >= durationInFrames || cuts.some((c) => c.at === at)) return;
    const k = cuts.length;
    const pops = [0, 1, 2, 3].map((j) => mark("pop_" + k + "_" + j, NaN)).filter(Number.isFinite);
    cuts.push({ at, next: i, kind: mark("kind_" + k, 2), pops, lit: mark("lit_" + k, -1) });
  });

  // The nine cells: square, 27 % of the grid each, the grid 0,7 of the width, about the subject of the shot they show
  // where the montage frames it (its focus), else the middle at 53 % of the height; laid in the model's order: the
  // middle, its column, the cross, the corners.
  const G = Math.round(width * 0.7);
  const C = Math.round(G * 0.27);
  const GAP = Math.round((G - 3 * C) / 2);
  const focusOf = (s) => {
    const f = s && s.focus;
    if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.y)) return { x: width / 2, y: height * 0.53 };
    const A = Number(s.aspect) || width / height;
    const dw = A > width / height ? height * A : width;
    const dh = A > width / height ? height : width / A;
    return { x: f.x * dw - Math.max(0, Math.min(dw - width, f.x * dw - width / 2)), y: f.y * dh - Math.max(0, Math.min(dh - height, f.y * dh - height / 2)) };
  };
  const ORDER = [[1, 1], [0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [0, 2], [2, 0], [2, 2]];
  const rect = (x, y, w, hh) => "M" + Math.round(x) + " " + Math.round(y) + "h" + Math.round(w) + "v" + Math.round(hh) + "h" + -Math.round(w) + "Z";
  const cellsPath = (count, centre) => {
    const gx = Math.round(Math.min(width - G - 20, Math.max(20, centre.x - G / 2)));
    const gy = Math.round(Math.min(height - G - 20, Math.max(20, centre.y - G / 2)));
    return ORDER.slice(0, count).map(([r, c]) => rect(gx + c * (C + GAP), gy + r * (C + GAP), C, C)).join("");
  };
  const STEPS = { 1: [1, 3, 5, 9], 2: [1, 5, 9], 3: [9] };
  const DIM = 0.59;

  const drawn = [];
  // A shot the cells brought in: dimmed from its cut, lit in three images onto its beat.
  const lighting = cuts.find((c) => c.kind === 1 && c.lit > c.at && frame >= c.at && frame < c.lit);
  if (lighting) drawn.push(h("div", { key: "dim", style: { ...box, backgroundColor: "#000000", opacity: interpolate(frame, [lighting.lit - 3, lighting.lit], [DIM, 0], clamp) } }));

  // The raccord building toward its cut: its next shot's first image, where it will be, in pieces on its hits.
  const k = cuts.findIndex((c) => frame < c.at);
  const cut = k >= 0 ? cuts[k] : null;
  const hit = cut ? cut.pops.filter((p) => frame >= p).length : 0;
  if (cut && hit > 0) {
    const nx = cut.next;
    const s = cut.kind >= 2 ? SubjectBox(list[nx], list[nx].from, laid) : null;
    const her = s && s.w * s.h >= width * height * 0.04 ? s : null;
    if (her) {
      // Its subject cut out: its two outer thirds then its middle (the side first changes from one raccord to the
      // next), or whole.
      const pad = Math.round(width * 0.02);
      const x0 = her.x - pad;
      const x1 = her.x + her.w / 3;
      const x2 = her.x + (2 * her.w) / 3;
      const x3 = her.x + her.w + pad;
      const y0 = her.y - pad;
      const hh = her.h + 2 * pad;
      const left = rect(x0, y0, x1 - x0, hh);
      const right = rect(x2, y0, x3 - x2, hh);
      const middle = rect(x1, y0, x2 - x1, hh);
      const parts = cut.kind === 3 ? [rect(x0, y0, x3 - x0, hh)] : k % 2 ? [left, right, middle] : [right, left, middle];
      drawn.push(h("div", { key: "p" + nx, style: { ...box, clipPath: "path('" + parts.slice(0, hit).join("") + "')" } }, h(Subject, { shot: nx, style: box })));
    } else {
      // Its picture in the cells, dimmed for the first raccord (its shot then lights up).
      const steps = STEPS[cut.kind] || STEPS[1];
      const count = steps[Math.min(steps.length, hit) - 1];
      drawn.push(h("div", { key: "c" + nx, style: { ...box, clipPath: "path('" + cellsPath(count, focusOf(list[nx])) + "')" } },
        h(Footage, { shot: nx, style: box }),
        cut.kind === 1 ? h("div", { style: { ...box, backgroundColor: "#000000", opacity: DIM } }) : null));
    }
  }
  // Its layer always laid (nothing drawn before its first hit, the montage playing under it).
  return h(AbsoluteFill, { style: { overflow: "hidden" } }, ...drawn);
}`;

export const raccords: EffectPiece = {
  key: "raccords",
  version: 1,
  name: "Raccords en morceaux",
  how: "à chaque coupe sous lui, le plan suivant arrive en avance sur celui-ci, exactement là où il sera, figé sur sa première image, en morceaux sur les coups : ce qui s'y détache, détouré en trois morceaux (les bords, puis le milieu) ; sur deux ou trois coupes, d'abord son image en neuf cases carrées au milieu (une, la colonne, la croix, les neuf), sombre, le plan s'allumant sur le temps fort juste après la coupe, puis les trois morceaux, puis ce qui se détache entier, que la coupe garde à sa place ; la musique perd sa basse pendant que les morceaux arrivent ; puis le montage reprend.",
  needs: "deux à quatre plans à enchaîner, chacun avec quelque chose de net au milieu (quelqu'un, un produit, une lampe, un objet vu d'en haut), chacun d'au moins 0,8 s.",
  lays: "sur deux à quatre plans à la suite, depuis au moins un temps avant la première coupe sous lui jusqu'à la fin du dernier ; chaque coupe sous lui a son raccord",
  shots: [2, 4],
  seconds: [1.2, 6],
  require: { files: 2 },
  texts: [],
  timeline(input: PieceTimelineInput) {
    const cuts = raccordPieces(input.shots, input.frames, input.bpm);
    const marks: Record<string, number> = {};
    cuts.forEach((c, k) => {
      marks[`kind_${k}`] = c.kind;
      c.pops.forEach((p, j) => (marks[`pop_${k}_${j}`] = p));
      if (c.lit !== undefined) marks[`lit_${k}`] = c.lit;
    });
    const s = (f: number) => Math.round((f / 30) * 1000) / 1000;
    return {
      marks,
      // The shots whose subject arrives cut out before them (by their rank among its shots): only those are cut out
      // (with no cut under it, its last one: never every shot under it, as its code alone would have it).
      cutouts: cuts.length ? cuts.filter((c) => c.kind >= 2).map((c) => c.rank) : [-1],
      // Its music without its bass while each raccord builds, back where it lands (the cut, or the cells' light).
      music: { filters: cuts.flatMap((c) => (c.pops.length ? [{ kind: "thin" as const, from: s(c.pops[0]!), to: s(c.lit ?? c.at), open: 0.02 }] : [])) },
    };
  },
  code: CODE,
};
