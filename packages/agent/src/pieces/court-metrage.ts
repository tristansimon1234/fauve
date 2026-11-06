import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Court métrage », the effect (docs/fiches/court-metrage.md, effects 1 to 5 and 8; its whole Reel is
// skills/court-metrage.ts): over a run of her shots, the Reel becomes a short film projected as on an old projector.
// Her shots play in its gate, their corners rounded (4,2 % of the width), on a soft black: 1,94:1 across the width when
// most of them are in width, else the whole frame but its margins. Her first one opens from a slit at its middle (black,
// then two black bars parting at an even pace, as the original's 71 images over its 4 s first shot), and once it is open
// her film's title card cuts in whole on a beat: one small word in spaced capitals near the top, her title in big serif
// capitals on two tight lines at the middle, her credit in small italic near the bottom, lemon yellow (or her colour, or
// a warm white), her first shot dimmed under it when it is bright; it stays until the first cut, which a film burn
// whitens (red-orange from the left, orange, amber, pale yellow at its height, the cut under it, then out to the right).
// On its last cut (three shots or more), the film slips in the projector: a burn, six images of the strip rolling up in
// jerks (its frame lines where the original's were, its cream sprocket holes on the left edge), the next shot coming on
// the cut, a blank burnt image, a last burn. Then the montage takes over full frame. Kept of its skill: its gate, its
// slit, its title card (its sizes, places, colour and font), its burns, its roll, a projector's sounds (a click on the
// black, its whirr under the slit, a click on the title, its film fluttering on the roll), its music low under the slit
// and without its bass around the roll. Left: its cover images, its tempo and cuts (the Reel's), its fade to black, its
// ending card. Nothing of the original's own: its words are hers.

/** Its title stays on screen this long at least before the first cut (frames: the original's 1,4 s). */
const HOLD = 42;
/** The slit opens over this share of her first shot (the original's 71 images of 120), 12 to 71 images. */
const OPEN_SHARE = 0.59;
/** The projector's sounds, as its skill's. */
const CLICK = { sound: "film projector click", seconds: 0.5 };
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Its moments for a span (frames from its start): its first cut (the burn), its last (the roll, with three shots or
 * more, else none), the slit open, its title on the first beat once it is open that leaves it on screen 1,4 s before
 * the first cut (else as soon as it is open), the slit shortened when her first shot is short.
 */
export function filmMoments(input: Pick<PieceTimelineInput, "frames" | "bpm" | "shots">): { cut: number; roll: number | null; open: number; title: number } {
  const beat = (60 / input.bpm) * 30;
  const cuts = [...input.shots]
    .sort((a, b) => a.from - b.from)
    .slice(1)
    .map((s) => Math.round(s.from))
    .filter((f, i, all) => f > 0 && f < input.frames && all.indexOf(f) === i);
  const cut = cuts[0] ?? input.frames;
  const roll = cuts.length >= 2 ? cuts.at(-1)! : null;
  const open = Math.min(Math.max(12, Math.min(71, Math.round(cut * OPEN_SHARE))), Math.max(12, cut - HOLD - 2));
  const onBeat = Math.ceil((open + 2) / beat - 1e-6) * beat;
  const title = Math.round(onBeat <= cut - HOLD ? onBeat : open + 2);
  return { cut, roll, open, title };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const INK = "#0e0c0d";
  const D = Math.max(1, durationInFrames);
  // Its shots: those that play during it, in order; the first opens, the last is where the film slips.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < D - 1 && shots[i].from + shots[i].durationInFrames > 1);
  if (!mine.length) return null;
  const cuts = [];
  mine.slice(1).forEach((i) => { const at = Math.round(shots[i].from); if (at > 0 && at < D && cuts.indexOf(at) < 0) cuts.push(at); });
  const cur = mine.reduce((k, i) => (shots[i].from <= frame ? i : k), mine[0]);
  const CUT = Math.round(mark("cut", cuts.length ? cuts[0] : D + 1));
  const ROLL = cuts.length >= 2 ? Math.round(mark("roll", cuts[cuts.length - 1])) : null;
  const OPEN = Math.max(2, Math.round(mark("open", 40)));
  const TITLE = Math.max(OPEN, Math.round(mark("title", OPEN + 2)));
  const rollShot = ROLL === null ? -1 : mine.reduce((k, i) => (Math.round(shots[i].from) <= ROLL ? i : k), mine[0]);
  const beforeRoll = ROLL === null ? -1 : mine.reduce((k, i) => (Math.round(shots[i].from) < ROLL ? i : k), mine[0]);

  // 1. Its gate: her picture projected, its corners rounded, on a soft black; 1,94:1 across the width when most of her
  // shots under it are in width (or on her word), else the whole frame but its 4,2 % margins top and bottom.
  const fmt = word("format");
  const inWidth = mine.filter((i) => (Number(shots[i].aspect) || 0.5625) > 1.15).length;
  const wide = fmt === "horizontal" || (fmt !== "vertical" && inWidth * 2 > mine.length);
  const GW = width;
  const GH = wide ? Math.round(width / 1.94) : Math.round(height * 0.916);
  const GY = Math.round((height - GH) / 2);
  const RAD = Math.round(width * 0.042);
  const full = { position: "absolute", left: 0, top: 0, width: GW, height: GH };
  const box = (x, y, w, t) => ({ position: "absolute", left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(t) });

  // 2. Her title card: one small word in spaced capitals near the top, her title in big serif capitals on two lines at
  // the middle, her credit in small italic near the bottom (upright: within the safe zone), all at once on its beat.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  // In capitals, an hour keeps its small h (« 7 h », never « 7 H »).
  const caps = (s) => keep(s).toUpperCase().replace(/(\d)(\s?)H\b/g, "$1$2h");
  const count = (s) => String(s || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const lines = (s) => {
    const w = caps(s).split(/\s+/).filter(Boolean);
    let best = [w.join(" ")];
    let worst = Infinity;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(" ");
      const b = w.slice(i).join(" ");
      if (Math.max(a.length, b.length) < worst) { worst = Math.max(a.length, b.length); best = [a, b]; }
    }
    return best;
  };
  const S = wide ? 1 : 1.3;
  const TPX = Math.round(84 * S);
  const LPX = Math.round(26 * S);
  const CPX = Math.round(28 * S);
  const yLabel = GH * (wide ? 0.1 : 0.12);
  const yTitle = GH * (wide ? 0.485 : 0.47);
  const yCredit = GH * (wide ? 0.902 : 0.72);
  const TB = box((GW - 800) / 2, yTitle - TPX * 0.95, 800, TPX * 1.9);
  const luma = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return -1;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  const tone = word("couleur") || "jaune";
  const hers = [brand.accent, brand.palette && brand.palette.light].find((c) => luma(c) >= 0.45);
  const COLOR = tone === "blanc" ? "#f4f1e8" : tone === "sienne" && hers ? hers : "#f2ea4a";
  const display = "'" + brand.displayFont + "', 'Cormorant Garamond', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Cormorant Garamond', Georgia, serif";
  const shade = "0 0 1px rgba(0,0,0,0.35), 0 2px 12px rgba(0,0,0,0.38)";
  const small = word("surtitre");
  const title = word("titre");
  const credit = word("signature");
  // Her first shot dimmed under her title when it is bright there, from its first image to the cut.
  const light = React.useMemo(() => {
    const l = LightUnder(shots[mine[0]], TITLE, full, { x: TB.left, y: TB.top, w: TB.width, h: TB.height });
    return l && Number.isFinite(l.mean) ? l.mean : null;
  }, [TITLE, GW, GH]);
  const dim = light !== null && light > 0.42 ? Math.max(0.55, 0.42 / light) : 1;
  const card = title && frame >= TITLE && frame < CUT
    ? h(React.Fragment, { key: "card" },
        small
          ? h(FitText, { key: "b-" + small, style: box((GW - 800) / 2, yLabel - LPX * 0.8, 800, LPX * 1.6), innerStyle: { fontFamily: body, fontWeight: 500, fontSize: LPX, lineHeight: 1, letterSpacing: "0.22em", textTransform: "uppercase", whiteSpace: "nowrap", color: COLOR, textShadow: shade } },
              h("span", { "data-fauve-accent": "" }, keep(small)))
          : null,
        h(FitText, { key: "t-" + title, style: TB, innerStyle: { fontFamily: display, fontWeight: 600, fontSize: TPX, lineHeight: 0.86, letterSpacing: "-0.005em", whiteSpace: "nowrap", color: COLOR, textShadow: shade } },
          lines(title).map((l, i) => h("div", { key: i }, l))),
        credit
          ? h(FitText, { key: "c-" + credit, style: box((GW - 800) / 2, yCredit - CPX * 0.85, 800, CPX * 1.7), innerStyle: { fontFamily: display, fontWeight: 500, fontStyle: "italic", fontSize: count(credit) > 4 ? Math.max(48, CPX) : CPX, lineHeight: 1, whiteSpace: "nowrap", color: COLOR, textShadow: shade } },
              count(credit) > 4 ? keep(credit) : h("span", { "data-fauve-accent": "" }, keep(credit)))
          : null)
    : null;

  // 3. Her shots in its gate, as filmed; the first opens from a slit at its middle (black on its first image, then two
  // black bars parting at an even pace until it is open).
  const open = clamp01(frame / OPEN);
  const slit = Math.round(((1 - open) * GH) / 2);
  const shown = h("div", { key: "shown", style: { ...full, clipPath: slit > 0 ? "inset(" + slit + "px 0px " + slit + "px 0px)" : undefined, filter: cur === mine[0] && dim < 1 ? "brightness(" + dim.toFixed(3) + ")" : undefined } },
    h(Footage, { key: "f" + cur, shot: cur, style: full }));

  // 4. The film slipping onto its last shot: six images of the strip rolling up in jerks, each frame line where the
  // original's was (its top, a share of the picture's height), the shot that goes in both frames until the cut, the next
  // one from it, each frame 2,5 % in from the sides, its cream sprocket holes on the left edge.
  const LINES = [0.315, 0.213, 0.908, 0.825, 0.105, 0.814];
  const step = ROLL === null ? -1 : frame - ROLL + 4;
  const LINE = Math.round(width * 0.043);
  const IN = Math.round(width * 0.025);
  const HOLE = { w: Math.round(width * 0.036), h: Math.round(width * 0.108), pitch: width * 0.56 };
  const strip = (() => {
    if (step < 0 || step >= LINES.length) return null;
    const k = frame < ROLL ? beforeRoll : rollShot;
    const L = LINES[step] * GH;
    const one = (top, key) => {
      const holes = [];
      for (let j = -4; j <= 4; j++) {
        const y = top + GH / 2 + j * HOLE.pitch - HOLE.h / 2;
        if (y + HOLE.h > top && y < top + GH) holes.push(h("div", { key: key + "h" + j, style: { ...box(-HOLE.w * 0.3, y, HOLE.w, HOLE.h), borderRadius: Math.round(HOLE.w * 0.3), backgroundColor: "#aea87b" } }));
      }
      return [h("div", { key, style: { ...box(IN, top, GW - 2 * IN, GH), overflow: "hidden", borderRadius: RAD } }, h(Footage, { shot: k, style: box(-IN, 0, GW, GH) })), ...holes];
    };
    return h("div", { key: "strip", style: { ...full, backgroundColor: INK } }, ...one(L - GH, "up"), ...one(L + LINE, "down"));
  })();

  // 5. Its burns (the picture kit's Burn, as measured): onto its first cut, and around the roll with its blank image.
  const BURN = [
    [-5, "#c8501e", 0.14],
    [-4, "radial-gradient(ellipse 75% 130% at 0% 35%, rgba(214,74,14,0.95), rgba(214,74,14,0.35) 60%, rgba(214,74,14,0) 100%)", 1],
    [-3, "linear-gradient(to right, rgba(232,150,14,0.98), rgba(214,116,22,0.9))", 1],
    [-2, "linear-gradient(to right, #e8a21e, #de901a)", 0.97],
    [-1, "#ece18f", 0.94],
    [0, "linear-gradient(to right, rgba(230,146,34,0.95), rgba(236,192,78,0.92) 50%, rgba(236,212,100,0.9))", 1],
    [1, "linear-gradient(to right, rgba(170,70,26,0.45), rgba(222,146,52,0.85) 50%, rgba(222,146,36,0.85))", 1],
    [2, "radial-gradient(ellipse 70% 110% at 65% 55%, rgba(214,136,60,0.78), rgba(214,136,60,0) 100%)", 1],
    [3, "radial-gradient(ellipse 50% 90% at 62% 55%, rgba(190,110,56,0.5), rgba(190,110,56,0) 100%)", 1],
  ];
  const ROLL_LIGHT = [
    [-5, "linear-gradient(to right, #eadb8c, #ec9a52 50%, #e57238)", 0.96],
    [3, "linear-gradient(to right, #e6aa3c, #e9d25f 50%, #e4ea76)", 0.94],
    [4, "radial-gradient(circle at 100% 100%, rgba(160,60,24,0.8), rgba(160,60,24,0) 40%), radial-gradient(ellipse 45% 100% at 0% 45%, rgba(120,62,22,0.55), rgba(120,62,22,0) 100%)", 1],
  ];
  const burns = [
    CUT < D ? h(Burn, { key: "burn", at: CUT, steps: BURN }) : null,
    ROLL !== null ? h(Burn, { key: "roll", at: ROLL, steps: ROLL_LIGHT }) : null,
    ROLL !== null && frame === ROLL + 2 ? h("div", { key: "blank", style: { ...full, backgroundColor: "#ebe5bb" } }) : null,
  ];

  const gate = h("div", { key: "gate", style: { position: "absolute", left: 0, top: GY, width: GW, height: GH, overflow: "hidden", borderRadius: RAD, backgroundColor: INK } }, strip || shown, card, ...burns);
  return h(AbsoluteFill, { style: { backgroundColor: INK } }, gate);
}`;

export const courtMetrage: EffectPiece = {
  key: "court-metrage",
  version: 1,
  name: "Générique de court métrage",
  how: "le Reel devient un court métrage projeté le temps de quelques plans : ses plans dans une pellicule aux coins arrondis sur un noir doux ; le premier s'ouvre depuis une fente au milieu, puis le titre de son film s'y pose d'un coup sur un temps, en jaune (un petit mot espacé en haut, son titre en grandes capitales serif sur deux lignes, sa signature en petit italique en bas) ; une brûlure de pellicule blanchit la première coupe ; sur la dernière, la pellicule saute dans le projecteur (l'image remonte par à-coups, ses perforations passent, une image blanche brûlée) ; puis le montage reprend en plein écran.",
  needs: "des vidéos dans une belle lumière (le matin, l'heure dorée, un contre-jour), à l'horizontale de préférence (sinon en plein écran aux coins arrondis), la première calme et plutôt sombre, le milieu dégagé pour le titre.",
  lays: "au début du Reel de préférence, sur 3 à 6 de ses plans : le premier calme, tenu 3 à 4 s (la fente s'ouvre, le titre s'y pose), les suivants d'une mesure environ ; la pellicule saute sur la coupe du dernier",
  shots: [2, 6],
  seconds: [3, 12],
  require: { files: 2, shot: { video: true } },
  texts: [
    {
      slot: "titre",
      want: "le titre de son film en grandes capitales serif sur deux lignes, au milieu de son premier plan : son nom ou ce que le film raconte, 1 à 3 mots (une forme comme « La Fournée », « Le matin », « Chez Rose ») ; jamais une phrase",
      max: 22,
      required: true,
    },
    {
      slot: "surtitre",
      want: "1 ou 2 petits mots en capitales très espacées en haut de l'image, comme le premier mot d'un générique (une forme comme « moments », « un matin », « depuis 1962 ») ; rien d'inventé",
      max: 16,
      required: false,
    },
    {
      slot: "signature",
      want: "sa signature en petit italique en bas de l'image, comme le nom de qui a filmé (une forme comme « par Maison Farine », « filmé par Rose ») ; 3 mots au plus",
      max: 24,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format de ce moment : sa pellicule en horizontal sur du noir, ou plein écran aux coins arrondis",
      choices: [
        { value: "auto", says: "comme ses vidéos : en horizontal 1,94:1 sur du noir quand la plupart sont horizontales, sinon plein écran" },
        { value: "horizontal", says: "en horizontal 1,94:1 au milieu de l'écran, sur du noir, comme une pellicule projetée", band: true },
        { value: "vertical", says: "plein écran, coins arrondis, une fine marge noire en haut et en bas" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur de son titre et de ses petits mots",
      choices: [
        { value: "jaune", says: "le jaune citron d'un générique, comme l'original" },
        { value: "sienne", says: "sa couleur (celle de sa charte, si elle se lit sur une image sombre)" },
        { value: "blanc", says: "un blanc chaud" },
      ],
    },
  ],
  timeline({ frames, bpm, shots }) {
    const m = filmMoments({ frames, bpm, shots });
    const beat = (60 / bpm) * 30;
    const at = (f: number) => round3(f / 30);
    return {
      marks: { cut: m.cut, open: m.open, title: m.title, ...(m.roll !== null ? { roll: m.roll } : {}) },
      // A projector: its click on the black, its whirr under the slit, a click on the title; its film fluttering as it slips.
      sounds: [
        { at: 0, sound: "film projector switch click", seconds: 0.5 },
        ...(m.open >= 24 ? [{ at: at(Math.min(m.open, 24)), sound: "old film projector running", seconds: 2.5, gain: -8 }] : []),
        { at: at(m.title), ...CLICK, gain: 2 },
        ...(m.roll !== null ? [{ at: at(Math.max(0, m.roll - 8)), sound: "film reel flutter", seconds: 0.5, gain: 2 }] : []),
      ],
      // Its music low under the slit and its title (the original's comes in on the burn), without its bass from two beats
      // before the roll to its end.
      music: {
        filters: [
          { kind: "soft" as const, from: 0, to: at(m.cut), db: -14 },
          ...(m.roll !== null ? [{ kind: "thin" as const, from: at(Math.max(m.cut, m.roll - 2 * beat)), to: at(frames) }] : []),
        ],
      },
    };
  },
  code: CODE,
};
