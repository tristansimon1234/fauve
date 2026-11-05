// Line pictograms by trade, drawn for Edith (« Silhouette et mot »: « un clap de cinéma au trait » follows the name of
// its trade, « le pictogramme de son métier (ciseaux, tasse, fleur) »): a café's cup, a bakery's croissant, a florist's
// tulip, a hairdresser's scissors, a restaurant's cutlery, a boutique's bag, a studio's lotus, a bar's cocktail… Each is
// a few strokes on a 100 × 100 grid, no fill, so it draws itself like a line by hand (Picto in Type.tsx) in the colour of
// the text next to it. Written here by hand as plain SVG paths (absolute M, L, H, V, C, Q and Z only), no icon set
// copied. Pure, no imports, so the tests read it.

export type PictoPt = { x: number; y: number };

const f = (n: number) => (Math.round(n * 100) / 100).toString();
/** A circle as four cubic curves (0.5523: a quarter circle's handles). */
const circle = (cx: number, cy: number, r: number) => {
  const k = 0.5523 * r;
  return `M ${f(cx - r)} ${f(cy)} C ${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} C ${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} C ${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} C ${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} Z`;
};
/** A rectangle with rounded corners. */
const box = (x: number, y: number, w: number, h: number, r: number) => {
  const k = 0.5523 * r;
  return [
    `M ${f(x + r)} ${f(y)} H ${f(x + w - r)} C ${f(x + w - r + k)} ${f(y)} ${f(x + w)} ${f(y + r - k)} ${f(x + w)} ${f(y + r)}`,
    `V ${f(y + h - r)} C ${f(x + w)} ${f(y + h - r + k)} ${f(x + w - r + k)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}`,
    `H ${f(x + r)} C ${f(x + r - k)} ${f(y + h)} ${f(x)} ${f(y + h - r + k)} ${f(x)} ${f(y + h - r)}`,
    `V ${f(y + r)} C ${f(x)} ${f(y + r - k)} ${f(x + r - k)} ${f(y)} ${f(x + r)} ${f(y)} Z`,
  ].join(" ");
};
/** A point turned by `deg` degrees round (ox, oy). */
const turned = (x: number, y: number, ox: number, oy: number, deg: number): PictoPt => {
  const a = (deg * Math.PI) / 180;
  return { x: ox + (x - ox) * Math.cos(a) - (y - oy) * Math.sin(a), y: oy + (x - ox) * Math.sin(a) + (y - oy) * Math.cos(a) };
};
const line = (...pts: PictoPt[]) => pts.map((p, i) => `${i ? "L" : "M"} ${f(p.x)} ${f(p.y)}`).join(" ");

/** The clapper of a clapperboard, opened 14° on its hinge, and its stripes. */
const clapper = (() => {
  const at = (x: number, y: number) => turned(x, y, 16, 36, -14);
  const lid = `${line(at(16, 36), at(84, 36), at(84, 26), at(16, 26))} Z`;
  const stripes = [0, 1, 2, 3].map((k) => line(at(26 + k * 15, 36), at(33 + k * 15, 26)));
  return [lid, ...stripes];
})();

/** A baguette lying across, its three cuts. */
const baguette = (() => {
  const a = { x: 20, y: 80 };
  const b = { x: 80, y: 20 };
  const r = 11;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const n = { x: -d.y, y: d.x };
  const k = 1.34 * r;
  const p = (base: PictoPt, s: number, t: number) => ({ x: base.x + d.x * s + n.x * t, y: base.y + d.y * s + n.y * t });
  const [a1, a2, b1, b2] = [p(a, 0, r), p(a, 0, -r), p(b, 0, r), p(b, 0, -r)];
  const ca1 = p(a, -k, r);
  const ca2 = p(a, -k, -r);
  const cb1 = p(b, k, r);
  const cb2 = p(b, k, -r);
  const loaf = `M ${f(a2.x)} ${f(a2.y)} L ${f(b2.x)} ${f(b2.y)} C ${f(cb2.x)} ${f(cb2.y)} ${f(cb1.x)} ${f(cb1.y)} ${f(b1.x)} ${f(b1.y)} L ${f(a1.x)} ${f(a1.y)} C ${f(ca1.x)} ${f(ca1.y)} ${f(ca2.x)} ${f(ca2.y)} ${f(a2.x)} ${f(a2.y)} Z`;
  const cuts = [0.28, 0.5, 0.72].map((s) => {
    const c = p(a, len * s, 0);
    return line(p(c, -6, r * 0.55), p(c, 6, -r * 0.55));
  });
  return [loaf, ...cuts];
})();

/** Each pictogram: its strokes (100 × 100), drawn in this order, and the trades and things it stands for (lower case, no accents). */
export const PICTOS: Record<string, { paths: string[]; words: string[] }> = {
  cafe: {
    paths: [
      "M 22 42 H 70 V 58 C 70 72 60 80 46 80 C 32 80 22 72 22 58 Z",
      "M 70 48 C 82 47 87 52 87 58 C 87 65 81 68 70 67",
      "M 12 89 H 80",
      "M 37 33 C 31 28 43 23 37 15",
      "M 54 33 C 48 28 60 23 54 15",
    ],
    words: ["cafe", "coffee", "coffee shop", "espresso", "expresso", "torrefacteur", "torrefaction", "barista", "brunch", "tasse", "cup"],
  },
  croissant: {
    paths: [
      "M 8 68 C 13 43 29 26 50 26 C 71 26 87 43 92 68 C 77 61 63 57 50 57 C 37 57 23 61 8 68 Z",
      "M 29 33 C 34 41 36 50 34 59",
      "M 50 26 V 57",
      "M 71 33 C 66 41 64 50 66 59",
    ],
    words: ["croissant", "croissants", "boulangerie", "viennoiserie", "viennoiseries", "bakery", "petit dejeuner", "breakfast"],
  },
  baguette: { paths: baguette, words: ["baguette", "baguettes", "pain", "pains", "bread", "boulanger", "fournil"] },
  tulipe: {
    paths: [
      "M 33 24 L 42 37 L 50 22 L 58 37 L 67 24 C 71 41 65 56 50 58 C 35 56 29 41 33 24 Z",
      "M 50 58 V 91",
      "M 50 85 C 38 84 30 76 27 63 C 40 64 48 72 50 83",
      "M 50 77 C 60 76 68 70 72 60 C 62 60 54 66 50 74",
    ],
    words: ["fleur", "fleurs", "fleuriste", "fleuristerie", "flower", "flowers", "florist", "tulipe", "bouquet", "bouquets", "rose", "roses"],
  },
  ciseaux: {
    paths: [circle(32, 75, 11), circle(68, 75, 11), "M 39 66 Q 53 42 70 11", "M 61 66 Q 47 42 30 11"],
    words: ["ciseaux", "scissors", "coiffure", "coiffeur", "coiffeuse", "salon de coiffure", "hairdresser", "hair salon", "hair", "coupe", "salon", "couture"],
  },
  moustache: {
    paths: [
      "M 50 48 C 42 38 28 38 24 48 C 21 55 14 58 8 54 C 10 65 22 70 34 66 C 42 63 47 58 50 54 C 53 58 58 63 66 66 C 78 70 90 65 92 54 C 86 58 79 55 76 48 C 72 38 58 38 50 48 Z",
    ],
    words: ["barbier", "barber", "barbershop", "moustache", "barbe", "beard"],
  },
  couverts: {
    paths: ["M 26 11 V 33 C 26 41 31 46 36 46 C 41 46 46 41 46 33 V 11", "M 36 11 V 33", "M 36 46 V 89", "M 66 89 V 11 C 77 18 81 34 79 50 C 78 55 73 57 66 57"],
    words: ["restaurant", "resto", "bistrot", "bistro", "brasserie", "cantine", "traiteur", "couverts", "cutlery", "food", "cuisine", "diner", "dejeuner", "table"],
  },
  sac: {
    paths: ["M 21 36 H 79 L 83 89 H 17 Z", "M 38 47 V 30 C 38 15 62 15 62 30 V 47"],
    words: ["boutique", "shop", "magasin", "concept store", "sac", "bag", "shopping", "store", "epicerie", "commerce", "cadeau", "cadeaux"],
  },
  cintre: {
    paths: ["M 50 39 V 32 C 50 26 58 25 58 18 C 58 12 54 9 50 9 C 46 9 42 12 42 16", "M 50 39 L 10 68 C 6 71 8 77 14 77 H 86 C 92 77 94 71 90 68 Z"],
    words: ["cintre", "hanger", "friperie", "vintage", "mode", "fashion", "vetement", "vetements", "pret a porter", "retouche", "retouches", "dressing", "clothes", "seconde main"],
  },
  chaussure: {
    paths: [
      "M 10 79 V 54 C 10 48 14 44 20 44 L 34 42 L 44 54 C 52 60 66 60 78 62 C 86 64 90 68 90 74 V 80 C 90 83 88 85 85 85 H 15 C 12 85 10 83 10 80 Z",
      "M 10 75 H 90",
      "M 37 48 L 45 46",
      "M 43 55 L 51 53",
    ],
    words: ["chaussure", "chaussures", "shoe", "shoes", "sneakers", "cordonnier", "cordonnerie"],
  },
  lotus: {
    paths: [
      "M 50 26 C 59 38 59 56 50 68 C 41 56 41 38 50 26 Z",
      "M 50 68 C 36 68 24 58 20 42 C 34 42 46 52 50 68",
      "M 50 68 C 64 68 76 58 80 42 C 66 42 54 52 50 68",
      "M 16 80 C 32 86 68 86 84 80",
    ],
    words: ["yoga", "studio", "pilates", "meditation", "lotus", "zen", "respiration", "stretching", "danse"],
  },
  haltere: {
    paths: ["M 30 50 H 70", box(18, 30, 12, 40, 3), box(70, 30, 12, 40, 3), box(9, 39, 9, 22, 2.5), box(82, 39, 9, 22, 2.5)],
    words: ["sport", "salle de sport", "fitness", "gym", "musculation", "coach", "coaching", "crossfit", "haltere", "halteres", "dumbbell", "training", "boxe", "entrainement"],
  },
  cocktail: {
    paths: ["M 16 20 H 84 L 50 57 Z", "M 50 57 V 86", "M 32 88 H 68", "M 72 6 L 55 34", circle(52, 37, 6.5)],
    words: ["bar", "bars", "cocktail", "cocktails", "mixologie", "apero", "aperitif", "afterwork", "boite de nuit", "club"],
  },
  vin: {
    paths: ["M 30 12 H 70 C 72 30 68 50 50 52 C 32 50 28 30 30 12 Z", "M 31 29 H 69", "M 50 52 V 85", "M 33 87 H 67"],
    words: ["vin", "vins", "wine", "caviste", "cave", "cave a vin", "bar a vin", "oenologie", "degustation", "vigneron", "domaine"],
  },
  biere: {
    paths: [
      "M 24 33 V 82 C 24 86 27 89 31 89 H 59 C 63 89 66 86 66 82 V 33",
      "M 66 45 H 74 C 80 45 84 49 84 55 V 64 C 84 70 80 74 74 74 H 66",
      "M 22 34 C 15 26 24 15 34 20 C 38 11 53 11 56 20 C 64 14 75 22 68 34 Z",
      "M 37 46 V 77",
      "M 52 46 V 77",
    ],
    words: ["biere", "bieres", "beer", "pub", "brasserie artisanale", "microbrasserie", "brewery", "houblon"],
  },
  clap: {
    paths: [box(16, 40, 68, 46, 3), "M 16 52 H 84", ...clapper],
    words: ["cinema", "film", "films", "video", "videos", "clap", "realisation", "realisateur", "realisatrice", "production", "tournage", "court metrage", "movie", "createur", "createurs"],
  },
  appareil: {
    paths: ["M 14 34 H 32 L 38 24 H 62 L 68 34 H 86 V 80 H 14 Z", circle(50, 56, 15), "M 74 44 H 78"],
    words: ["photo", "photos", "photographe", "photographie", "photographer", "camera", "appareil photo", "studio photo", "shooting"],
  },
  livre: {
    paths: ["M 50 30 C 40 22 24 22 12 26 V 78 C 24 74 40 74 50 82 Z", "M 50 30 C 60 22 76 22 88 26 V 78 C 76 74 60 74 50 82"],
    words: ["livre", "livres", "librairie", "book", "books", "bookshop", "bouquiniste", "bibliotheque", "lecture", "papeterie", "ecole", "cours"],
  },
  vernis: {
    paths: [box(40, 10, 20, 34, 3), "M 34 44 H 66 C 74 44 80 50 80 58 V 80 C 80 86 76 90 70 90 H 30 C 24 90 20 86 20 80 V 58 C 20 50 26 44 34 44 Z", "M 30 60 V 74"],
    words: ["onglerie", "manucure", "ongles", "nail", "nails", "vernis", "beaute", "beauty", "esthetique", "esthetic", "institut", "maquillage"],
  },
  feuille: {
    paths: ["M 18 82 C 18 44 44 20 84 16 C 82 56 58 82 18 82 Z", "M 18 82 L 64 36"],
    words: ["spa", "bien etre", "massage", "massages", "bio", "naturel", "nature", "plante", "plantes", "herboristerie", "vegan", "vegetal", "vegetarien", "feuille", "leaf", "soin", "soins", "jardin", "paysagiste"],
  },
  pizza: {
    paths: ["M 50 90 L 16 24 C 36 12 64 12 84 24 Z", "M 22 35 C 40 25 60 25 78 35", circle(42, 45, 5), circle(60, 51, 4.5), circle(50, 67, 4)],
    words: ["pizza", "pizzas", "pizzeria", "italien", "italienne", "italian", "trattoria"],
  },
  glace: {
    paths: ["M 28 50 C 24 34 36 22 50 22 C 64 22 76 34 72 50", "M 28 50 H 72 L 50 92 Z", "M 38 61 L 59 57", "M 44 73 L 55 71"],
    words: ["glace", "glaces", "glacier", "ice cream", "gelato", "sorbet", "sorbets"],
  },
  cupcake: {
    paths: [
      "M 28 58 L 34 88 H 66 L 72 58",
      "M 44 60 L 46 86",
      "M 56 60 L 54 86",
      "M 26 58 C 18 52 22 40 32 42 C 32 30 46 24 54 32 C 62 26 76 32 72 44 C 82 46 82 58 74 58 Z",
      "M 52 30 C 52 24 56 20 61 18",
    ],
    words: ["patisserie", "patissier", "patissiere", "gateau", "gateaux", "cake", "cakes", "cupcake", "cupcakes", "dessert", "desserts", "chocolatier", "chocolaterie", "confiserie"],
  },
  the: {
    paths: [
      "M 24 52 C 24 38 76 38 76 52 C 76 69 66 80 50 80 C 34 80 24 69 24 52 Z",
      "M 38 41 C 38 31 62 31 62 41",
      circle(50, 26, 3.5),
      "M 24 54 C 15 52 11 45 9 37",
      "M 76 47 C 89 46 91 65 74 68",
      "M 30 89 H 70",
    ],
    words: ["salon de the", "tea", "tea room", "theiere", "teapot", "infusion", "infusions", "matcha"],
  },
  lunettes: {
    paths: [circle(30, 56, 15), circle(70, 56, 15), "M 45 54 C 47 50 53 50 55 54", "M 15 52 L 8 42", "M 85 52 L 92 42"],
    words: ["lunettes", "lunette", "opticien", "opticienne", "optique", "glasses", "lunetterie", "vue"],
  },
};

/** The pictograms' names. */
export const PICTO_NAMES = Object.keys(PICTOS);

const plain = (s: string) =>
  ` ${s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
/** Every word a pictogram stands for, the longest phrases first (« salon de thé » before « salon »), then in list order. */
const LEXICON = Object.entries(PICTOS)
  .flatMap(([name, p], order) => p.words.map((w) => ({ name, phrase: plain(w), words: w.split(" ").length, order })))
  .sort((a, b) => b.words - a.words || a.order - b.order);

/** The pictogram for a trade or a thing, in French or English (« Salon de coiffure », « café », « fleuriste »), or null. */
export function pictoFor(name: string): string | null {
  const key = plain(name);
  const own = key.trim().replace(/ /g, "");
  if (PICTOS[own]) return own;
  return LEXICON.find((w) => key.includes(w.phrase))?.name ?? null;
}

/**
 * A path's strokes as points (curves cut in `steps` straight pieces): its subpaths, each from its move to its close or
 * the next move. Absolute M, L, H, V, C, Q and Z only (the pictograms' own); anything else ends the reading.
 */
export function pathStrokes(d: string, steps = 12): PictoPt[][] {
  const tokens = d.match(/[MLHVCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const strokes: PictoPt[][] = [];
  let i = 0;
  let cmd = "";
  let at: PictoPt = { x: 0, y: 0 };
  let start: PictoPt = { x: 0, y: 0 };
  const num = () => Number(tokens[i++]);
  const current = () => strokes.at(-1)!;
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i]!)) cmd = tokens[i++]!;
    if (cmd === "M") {
      at = { x: num(), y: num() };
      start = at;
      strokes.push([at]);
      cmd = "L";
    } else if (cmd === "L") {
      at = { x: num(), y: num() };
      current().push(at);
    } else if (cmd === "H") {
      at = { x: num(), y: at.y };
      current().push(at);
    } else if (cmd === "V") {
      at = { x: at.x, y: num() };
      current().push(at);
    } else if (cmd === "C" || cmd === "Q") {
      const cubic = cmd === "C";
      const p1 = { x: num(), y: num() };
      const p2 = cubic ? { x: num(), y: num() } : p1;
      const p3 = { x: num(), y: num() };
      const p0 = at;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const u = 1 - t;
        current().push(
          cubic
            ? { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y }
            : { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p3.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p3.y },
        );
      }
      at = p3;
    } else if (cmd === "Z" || cmd === "z") {
      current().push(start);
      at = start;
      cmd = "";
    } else break;
  }
  return strokes.filter((s) => s.length > 1);
}

/** A path's length, its strokes laid end to end. */
export const pathLength = (d: string) => pathStrokes(d).reduce((sum, s) => sum + s.slice(1).reduce((l, p, k) => l + Math.hypot(p.x - s[k]!.x, p.y - s[k]!.y), 0), 0);
