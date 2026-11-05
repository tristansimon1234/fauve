import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Sous tous les angles », the effect of « La nuit sous tous les angles » (docs/fiches/nuit.md, effects 1, 3 and 4; its
// whole Reel is skills/nuit.ts, version 1): over THREE TO SIX of her shots of one object (her sign, her neon, her door,
// her tap) taken from different places, that object at one place and one size in every one of them (its box read where
// the engine found it by the name its filler gives; each shot enlarged 1,15 to 1,9 times and moved onto the point the most
// of them can reach, nearest the middle, never uncovering an edge), the shots in turn on the original's fifteen cuts (four
// or five images a shot, then two: the roll that speeds up), its last turn streaked; then the last one burnt white, the
// picture in negative, black, the music cut dead, and back on a beat on the film burn that slides off to the right (the
// original's four images, opaque); then the montage resumes. Kept from the model: the original's cuts in proportion, the
// alignment and its bounds, its streaks, its burn, its silence before the drop and its tick on each cut. Left out: its
// round things (its shots are her angles), its night and its photographer (the montage's own), its format setting (the
// montage frames her shots).

const CODE = String.raw`function Scene({ width, height, durationInFrames, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const DUR = Math.max(1, durationInFrames);
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const list = shots || [];
  // Its shots: those the engine counts under it (their indices in shots), else those playing during it.
  const counted = String((texts && texts.mine) || "").split(",").filter((v) => v !== "").map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = counted.length ? counted : list.map((s, i) => i).filter((i) => list[i].from < DUR && list[i].from + list[i].durationInFrames > 0);
  const N = Math.max(1, Math.min(6, mine.length));
  const box = { position: "absolute", left: 0, top: 0, width: W, height: H };
  const fill =(bg, key, extra) => h("div", { key, style: { ...box, background: bg, ...extra } });
  const len = (i) => Math.max(1, list[i] ? list[i].durationInFrames : 1);
  // One image of one of her shots at this frame (k: its image in her passage), held: a photo stays still.
  const pic = (i, k, style, key) => (list[i] ? h(Footage, { key: key || "p" + i, shot: i, style: { ...box, ...style }, at: frame - Math.max(0, Math.min(len(i) - 1, Math.round(k))) }) : null);
  // Its moments (frames from its start): its burn on its last four images, the black on the eight before, the flash on
  // the two before that (the music, cut in the black, comes back on a beat near the burn: its timeline's).
  const BURN = Math.max(3, Math.round(mark("burn", DUR - 4)));
  const BLACK = Math.max(2, Math.round(mark("black", BURN - 8)));
  const FLASH = Math.max(1, BLACK - 2);

  // 1. Her object at one place and one size in every shot: its box read once in each, where the engine found it by its
  // name, on her whole picture laid to cover the frame (a horizontal one keeps its sides: room to move it on); each shot
  // enlarged a little (1,15 times, room to move it) and more until her object is as big as where it is biggest (1,9 times
  // at most), then moved onto the point the most can reach, nearest the middle, never uncovering an edge (one that cannot
  // reach it comes as near as it can). Not found: as the montage frames it.
  const near = (k) => (mine[k] !== undefined && list[mine[k]] ? Math.max(0, list[mine[k]].from) + 1 : 0);
  const whole = (k) => {
    const a = Number(list[mine[k]] && list[mine[k]].aspect) || W / H;
    return a >= W / H ? { left: 0, top: 0, width: H * a, height: H } : { left: 0, top: 0, width: W, height: W / a };
  };
  const fit = React.useMemo(() => {
    const seen = [
      N > 0 ? SubjectBox(shots[mine[0]], near(0), whole(0), "@objet1") : null,
      N > 1 ? SubjectBox(shots[mine[1]], near(1), whole(1), "@objet2") : null,
      N > 2 ? SubjectBox(shots[mine[2]], near(2), whole(2), "@objet3") : null,
      N > 3 ? SubjectBox(shots[mine[3]], near(3), whole(3), "@objet4") : null,
      N > 4 ? SubjectBox(shots[mine[4]], near(4), whole(4), "@objet5") : null,
      N > 5 ? SubjectBox(shots[mine[5]], near(5), whole(5), "@objet6") : null,
    ].map((b, k) => (b && b.w > 8 && b.h > 8 && b.w < whole(k).width * 0.9 && b.h < whole(k).height * 0.9 ? b : null));
    const tall = 1.15 * Math.max(0, ...seen.map((b) => (b ? b.h : 0)));
    if (!(tall > 0)) return [];
    const place = seen.map((b, k) => {
      if (!b) return null;
      const s = Math.min(1.9, Math.max(1.15, tall / b.h));
      const w = whole(k).width * s;
      const ht = whole(k).height * s;
      const cx = (b.x + b.w / 2) * s;
      const cy = (b.y + b.h / 2) * s;
      return { w, ht, cx, cy, rx: [cx - (w - W), cx], ry: [cy - (ht - H), cy] };
    });
    const within = (v, r) => Math.max(r[0], Math.min(r[1], v));
    const most = (ranges, centre) => {
      let pick = centre;
      let count = -1;
      for (const e of ranges.flatMap((r) => r).concat([centre])) {
        const c = ranges.filter((r) => r[0] - 0.5 <= e && e <= r[1] + 0.5).length;
        if (c > count || (c === count && Math.abs(e - centre) < Math.abs(pick - centre))) { count = c; pick = e; }
      }
      return pick;
    };
    const kept = place.filter(Boolean);
    const tx = most(kept.map((p) => p.rx), W * 0.5);
    const ty = most(kept.map((p) => p.ry), H * 0.42);
    return place.map((p) => (p ? { left: Math.floor(within(tx, p.rx) - p.cx), top: Math.floor(within(ty, p.ry) - p.cy), width: Math.ceil(p.w) + 1, height: Math.ceil(p.ht) + 1 } : null));
  }, [N, W, H, DUR]);
  // An image of one of her shots, her picture laid where her object comes to its place (else as the montage frames it).
  const angle = (a, k, style, key) => pic(mine[a], k, fit[a] ? { ...style, ...fit[a] } : style, key);
  // A motion blur along a slant: an SVG blur in a turned box, its id this image's.
  const DIAG = Math.ceil(Math.hypot(W, H));
  const streak = (node, sigma, angle, key) => {
    const id = "na-" + key + "-" + frame;
    return h("div", { key, style: box },
      h("svg", { width: 0, height: 0, style: { position: "absolute" } },
        h("filter", { id, x: "-10%", y: "-10%", width: "120%", height: "120%", colorInterpolationFilters: "sRGB" }, h("feGaussianBlur", { stdDeviation: sigma.toFixed(1) + " 0" }))),
      h("div", { style: { position: "absolute", left: Math.round((W - DIAG) / 2), top: Math.round((H - DIAG) / 2), width: DIAG, height: DIAG, transform: "rotate(" + angle + "deg)", filter: "url(#" + id + ")" } },
        h("div", { style: { position: "absolute", left: Math.round((DIAG - W) / 2), top: Math.round((DIAG - H) / 2), width: W, height: H, transform: "rotate(" + -angle + "deg) scale(1.08)" } }, node)));
  };

  // 2. Its stutter: the original's fifteen cuts in proportion to the time before the flash, her shots in turn, each one's
  // images going on from turn to turn; its last turn streaked, more and more.
  const ST = [0, 4, 9, 13, 15, 19, 23, 28, 30, 33, 35, 38, 40, 43, 45, 46].map((f) => Math.round((f * Math.max(1, FLASH)) / 46));
  const angleAt = (f) => {
    let p = 0;
    while (p < 14 && f >= ST[p + 1]) p++;
    // In turn, its last cut on her last shot as the original's (A B C D E F A B C D E F A B F).
    const a = p === 14 && N > 2 ? N - 1 : p % N;
    let k = f - ST[p];
    for (let q = a; q < p; q += N) k += ST[q + 1] - ST[q];
    return { p, a, k };
  };
  // 3. Its film burn, the original's four images: warm white, then the light sliding off to the right, black behind it.
  const MOTTLE = "radial-gradient(circle at 68% 34%, rgba(110,96,86,0.3) 0%, rgba(110,96,86,0) 24%), radial-gradient(circle at 44% 72%, rgba(140,126,112,0.24) 0%, rgba(140,126,112,0) 28%), ";
  const BURNS = [
    "radial-gradient(ellipse 72% 95% at 58% 50%, #f6f2ea 0%, #f2ede3 55%, #e6ddd0 80%, #d6c6b8 100%)",
    "linear-gradient(90deg, #2d2523 0%, #8c847d 20%, #d6cbc0 42%, #e6ddd0 62%, #d0c4b6 100%)",
    "linear-gradient(90deg, #000000 0%, #000000 19%, #373232 24%, #87827c 42%, #c0b5ad 62%, #d0c3b7 100%)",
  ];
  let node = null;
  if (frame < FLASH) {
    const { p, a, k } = angleAt(frame);
    const shot = angle(a, k, {}, "an" + a);
    node = p >= 9 && p <= 13 ? streak(shot, 9 + (p - 9) * 7, p % 2 ? 8 : -8, "st" + p) : shot;
  } else if (frame < BLACK) {
    // Its last image burnt white (its blacks lifted: a night burns through), then the whole picture in negative.
    const { a, k } = angleAt(FLASH - 1);
    node = angle(a, k + 1, { filter: frame === FLASH ? "contrast(0.86) brightness(10) saturate(0.5)" : "invert(1) contrast(1.15)" }, "flash");
  } else if (frame < BURN) node = fill("#000000", "black");
  else node = fill(MOTTLE + BURNS[Math.min(2, frame - BURN)], "burn", { backgroundColor: "#000000" });
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, node);
}`;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Its moments for a span (frames from its start) and a tempo, as the original's (its black of 8 images, its burn of 4,
 * the next shot): its burn on its last four images, the black on the eight before, the flash on the two before that;
 * the music cut a frame into the black and back on the whole beat of the Reel nearest the burn's first image, when one
 * falls from the middle of the black to the next shot (`back`, else null: the music plays on).
 */
export function nuitMoments(frames: number, bpm: number): { flash: number; black: number; burn: number; back: number | null } {
  const beat = (60 / bpm) * 30;
  const burn = frames - 4;
  const black = burn - 8;
  const near = Math.round(Math.round((burn - 1) / beat) * beat);
  return { flash: black - 2, black, burn, back: near >= black + 4 && near <= frames ? near : null };
}

export const nuit: EffectPiece = {
  key: "nuit",
  version: 1,
  name: "Sous tous les angles",
  how: "le même objet (son enseigne, son néon, sa porte) sous trois à six angles, recalé au même endroit et à la même taille dans chacun, coupé de plus en plus vite sur un roulement qui accélère, le dernier tour filé ; puis un flash, l'image en négatif, le noir et un silence, et la musique repart sur une brûlure de pellicule chaude qui glisse vers la droite ; puis le montage reprend.",
  needs: "trois à six plans du même objet (son enseigne, son néon, son logo, sa porte, sa tireuse, une lampe) pris de différents endroits, l'objet bien visible dans chacun.",
  lays: "sur ces plans à la suite, en ouverture de préférence comme l'original, le plan d'après ouvrant la suite sur le temps fort",
  shots: [3, 6],
  seconds: [1.5, 4],
  require: { files: 3 },
  texts: [],
  objects: Array.from({ length: 6 }, (_, k) => ({ slot: `objet${k + 1}`, shot: k, want: "l'objet qui revient dans chaque plan : son enseigne, son néon, son logo, sa porte, sa tireuse (le même nom dans chaque plan)" })),
  timeline(input: PieceTimelineInput) {
    const { flash, black, burn, back } = nuitMoments(input.frames, input.bpm);
    const cuts = [4, 9, 13, 15, 19, 23, 28, 30, 33, 35, 38, 40, 43, 45].map((f) => Math.round((f * flash) / 46));
    const s = (f: number) => round3(f / 30);
    return {
      marks: { black, burn },
      sounds: [
        // A tick on each of its cuts, louder as they speed up; a shutter on its flash.
        { at: s(cuts[0]!), sound: "short tight hi-hat tick", seconds: 0.5, gain: -4, burst: { times: cuts.map((f) => s(f - cuts[0]!)), gains: cuts.map((_, k) => Math.round(-10 + (8 * k) / (cuts.length - 1))) } },
        { at: s(flash), sound: "camera shutter click", seconds: 0.5, gain: 2 },
      ],
      // The music cut dead a frame into the black, back on the beat nearest its burn.
      ...(back !== null ? { music: { pauses: [{ from: s(black + 1), to: s(back) }] } } : {}),
    };
  },
  code: CODE,
};
