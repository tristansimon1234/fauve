import type { EffectPiece } from "../pieces.ts";

// « Tes produits en affiches », the effect (docs/fiches/affiches.md, effects 2, 3 and 5; its whole Reel is
// skills/affiches.ts, version 1): over a run of her shots, each one becomes a poster for its own time, cut on the
// montage's cuts: a vivid flat colour with its still paper grain (the original's eight in its order: red, royal blue,
// orange, pink, grey, black, sky blue, yellow; her charter's in turn, or black, as her words ask), her shot in a print
// with a white border at one of the original's eight places in its order (in the middle, high, low, one cut by the left
// edge of the frame, one by its upper edge), shaped as her shot (in portrait for an upright one, in width for a
// horizontal one, the original's two square places square), and the first, the last and one in two between them with
// the name of what it shows in very big capitals filling the paper under the picture (her name's capitals as big as the
// print's width allows, a fifth of it at most; the print raised as far as its name needs to stay above the bottom
// quarter, and between x 140 and 940 under the middle). Then the montage takes over again. Left out: the model's opening
// slit and its title, its call on black, its music (the montage's runs under an effect).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const list = shots || [];
  const keep = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/(\d) (?=\d)/g, "$1 ");
  // Its shots: those the engine counts under it, else those that play during it; the one on screen now.
  const told = String((texts && texts.mine) || "").split(",").map((x) => Number(x)).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = told.length ? told : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  if (!mine.length) return h(AbsoluteFill, null);
  const p = mine.reduce((at, k, j) => (list[k].from <= frame ? j : at), 0);
  const P = mine.length;

  // Its lettering: her title font (a family with one weight set at it, never a faked bold); a capital's width in its
  // height, to fit a name to its print before FitText settles it.
  const display = "'" + brand.displayFont + "', 'Anton', 'Inter Tight', sans-serif";
  const font = String(brand.displayFont || "").trim();
  const heavy = /^(anton|bebas neue|archivo black|alfa slab one|abril fatface|dm serif display|instrument serif|bowlby one|titan one|ultra|black ops one|rubik mono one|passion one|bungee|oswald)$/i.test(font) ? 400 : 800;
  const ADV = /^(anton|bebas neue|oswald|big shoulders display|league gothic|fjalla one|roboto condensed|archivo narrow|barlow condensed)$/i.test(font) ? 0.56 : 0.9;

  // Its grounds: the original's eight flat colours in its order, her charter's in turn, or black.
  const VIVID = ["#fc1f10", "#0052b9", "#ff6127", "#ffa7af", "#97989b", "#060608", "#2391d6", "#ffc91b"];
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); return m ? "#" + m[1].toLowerCase() : null; };
  const pal = brand.palette || {};
  const hers = [brand.accent, pal.secondary, pal.dark, pal.light].map(hex).filter((c, i, all) => c && all.indexOf(c) === i);
  const choice = setting("couleurs", "vives");
  const GROUNDS = choice === "noir" ? ["#060608"] : choice === "sa-charte" && hers.length >= 2 ? hers : VIVID;
  const ground = GROUNDS[p % GROUNDS.length];

  // Its names, one a shot in order; the first, the last and one in two between them written (every one as asked).
  const every = setting("etiquettes", "une-sur-deux") === "toutes";
  const labelled = (q) => every || q === 0 || (q >= 2 && q < P && (P - 1 - q) % 2 === 0);
  const names = String((texts && texts.noms) || "").split(/\s*[\/|·]\s*/).map((s) => keep(s));
  const name = labelled(p) ? names[p] || "" : "";

  // Its print at the original's place for this poster, shaped as her shot.
  const LAYOUTS = [[0.494, 0.471, 0.32, ""], [0.497, 0.522, 0.22, "", 1], [0.468, 0.685, 0.36, "left"], [0.58, 0.287, 0.3, "top"], [0.503, 0.475, 0.3, ""], [0.497, 0.696, 0.24, ""], [0.505, 0.68, 0.3, ""], [0.518, 0.284, 0.26, "", 1]];
  const k = mine[p];
  const L = LAYOUTS[p % LAYOUTS.length];
  const shape = Number(list[k].aspect) || 0.5625;
  const a = L[4] ? 1 : shape > 1.15 ? 4 / 3 : shape < 0.87 ? 0.8 : 1;
  let pw = Math.sqrt(L[2] * W * H * a);
  let ph = pw / a;
  const capFor = (w) => (name ? Math.min(0.2 * w, (0.92 * w) / (Math.max(1, name.length) * ADV)) : 0);
  const bandFor = (w) => (name ? Math.max(0.16 * w, capFor(w) * 1.8) : 0);
  const scale = Math.min(1, (L[3] === "left" ? W * 1.05 : W * 0.88) / (pw * 1.04), (H * (name ? 0.7 : 0.62)) / (ph + pw * 0.04 + bandFor(pw * 1.04)));
  pw = Math.round(pw * scale);
  ph = Math.round(ph * scale);
  const B = Math.max(10, Math.round(pw * 0.02));
  const PW = pw + 2 * B;
  const cap = Math.round(capFor(PW));
  const LB = name ? Math.round(bandFor(PW)) : 0;
  const PH = ph + 2 * B + LB;
  const left = L[3] === "left" ? -Math.round(PW * 0.12) : Math.round(within(L[0] * W - PW / 2, W * 0.04, W * 0.96 - PW));
  let top = L[3] === "top" ? -Math.round(PH * 0.1) : Math.round(within(L[1] * H - PH / 2, H * 0.03, H * 0.92 - PH));
  // Its name read: its whole glyph box (0,86 of its capitals' height each side of their middle) above the bottom quarter.
  if (name && top + B + ph + LB / 2 + cap * 0.87 > H * 0.75 - 6) top -= Math.ceil(top + B + ph + LB / 2 + cap * 0.87 - (H * 0.75 - 6));
  const mid = top + B + ph + LB / 2;
  const low = mid + cap * 0.87 > H / 2;
  const x0 = Math.max(left + B + PW * 0.03, low ? 140 : 40);
  const x1 = Math.min(left + PW - B - PW * 0.03, low ? W - 140 : W - 40);
  // Its capitals cap px tall: a font's capitals are about 0,58 of the glyph box FitText fits, so its box is that much
  // taller and its size a little too big for it (it settles to the box's height, or less to its width).
  const tall = Math.round(cap / 0.58);
  const label = name
    ? h(FitText, { key: "name-" + p + "-" + name, style: { position: "absolute", left: Math.round(x0), top: Math.round(mid - tall / 2), width: Math.round(Math.max(60, x1 - x0)), height: tall },
        innerStyle: { fontFamily: display, fontWeight: heavy, fontSize: Math.round(cap * 1.6), lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", color: "#110c0d", whiteSpace: "nowrap", textAlign: "center" } }, name)
    : null;
  // Her names are written one by one on their posters: an unseen copy of her list tells the scene check it is written.
  const copy = texts && texts.noms ? h("div", { key: "names-copy", "data-fauve-decor": "", style: { position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "hidden", opacity: 0 } }, texts.noms) : null;

  return h(AbsoluteFill, null,
    h(Paper, { key: "ground", color: ground, grain: 0.16, shade: 0 }),
    h("div", { key: "print", style: { position: "absolute", left, top, width: PW, height: PH, backgroundColor: "#f4f0ec" } }),
    h(Footage, { key: "pic" + p, shot: k, style: { position: "absolute", left: left + B, top: top + B, width: pw, height: ph, filter: "saturate(0.95) contrast(1.06)" } }),
    label,
    copy);
}`;

export const affiches: EffectPiece = {
  key: "affiches",
  version: 1,
  name: "Produits en affiches",
  how: "chacun de ses plans dessous devient une affiche le temps de son plan : un aplat de couleur vive qui change à chaque coupe (rouge, bleu roi, orange, rose, gris, noir, bleu ciel, jaune), son plan dans un tirage à bord blanc posé chaque fois ailleurs (l'un coupé par un bord du cadre), et sur le premier, le dernier et un sur deux, le nom de ce qu'il montre en très grandes capitales sur le papier ; puis le montage reprend.",
  needs: "deux à huit photos ou courtes vidéos de ses produits, de ses plats ou de ses créations, une chose seule et bien en vue au milieu de chacune, à la suite.",
  lays: "sur une suite de deux à huit de ses plans qui montrent chacun un produit, chaque affiche le temps de son plan (un ou deux temps chacun)",
  shots: [2, 8],
  seconds: [2, 10],
  require: { files: 2, shot: { framing: ["close", "medium", "detail"] } },
  texts: [
    {
      slot: "noms",
      want: "facultatif mais à écrire dès que ses plans dessous montrent des choses qui se nomment : le nom de ce que montre chaque plan dessous, dans leur ordre, séparés par « / » (une forme comme « Croissant / Flan / Éclair / Tarte ») ; un ou deux mots chacun, jamais une phrase ni un prix inventé ; le premier, le dernier et un sur deux s'écrivent en très grand sur le papier de leur tirage",
      max: 100,
      required: false,
    },
  ],
  settings: [
    {
      name: "couleurs",
      want: "les couleurs des aplats derrière ses tirages : les huit couleurs vives de l'original, celles de sa charte en alternance, ou du noir",
      choices: [
        { value: "vives", says: "rouge, bleu roi, orange, rose, gris, noir, bleu ciel et jaune, une par affiche, comme l'original" },
        { value: "sa-charte", says: "les couleurs de sa charte, une par affiche en alternance (au moins deux)" },
        { value: "noir", says: "tous ses tirages sur du noir" },
      ],
    },
    {
      name: "etiquettes",
      want: "les noms en grand sur ses tirages : sur une affiche sur deux comme l'original, ou sur toutes",
      choices: [
        { value: "une-sur-deux", says: "sur la première, la dernière et une sur deux entre elles, comme l'original" },
        { value: "toutes", says: "sur toutes ses affiches" },
      ],
    },
  ],
  code: CODE,
};
