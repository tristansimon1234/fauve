import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Tes produits en affiches », version 1, written on its original's fiche (docs/fiches/affiches.md: measured image by
// image at 30 i/s, each poster's ground read on its pixels, each print on its white border, each label on its ink, its
// sound by bands; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Ten slides
// of one second, all still: a slit of a picture on a red ground, five words dropping one every 6 images at its corners;
// eight posters, each one picture in a white-bordered print on a flat vivid colour (red, royal blue, orange, pink, grey,
// black, sky blue, yellow), each print at its own place and size (two cut by an edge of the frame), the first, the last
// and one in two between them with a name in very big letters on its paper; a call in white capitals on black. Its cuts
// sit on a one-second grid that never follows its music (a trap beat at 134 BPM, a cut every 2,23 beats): here every
// landmark is in beats of 120 BPM, two a poster, so each cut falls exactly on the original's (1,000 s) and the music
// composed at it has its beats on them. The original's words, its Japanese, its images and its call to comment are its
// own, never copied: her title, her names, her call, her shots. Her photos stay still, her videos play in their print.

const BPM = 120;
/** Its lengths in beats: the opening slit, each poster, the black ending (the original's 1 s, lengthened to be read). */
const OPEN = 2;
const POSTER = 2;
const ENDING = 4;
/** Its title's words drop one every 0,4 beat (the original's every 6 images, 0,2 s). */
const POP = 0.4;
const round = (n: number) => Math.round(n * 100) / 100;
const comma = (n: number) => String(round(n)).replace(".", ",");

/**
 * Whether poster p of a run of `posters` carries its name, as the original's four of eight: the first, the last and one
 * in two before it from the end, never the second (it would follow the first); every one when her words ask for it.
 */
export function affichesLabelled(p: number, posters: number, every = false): boolean {
  return every || p === 0 || (p >= 2 && p < posters && (posters - 1 - p) % 2 === 0);
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const n = shots.length;
  const POP = Math.max(2, Math.round(mark("pop", 6)));
  const FIRST = Math.round(mark("first", n > 1 ? shots[1].from : 30));
  const ENDING = Math.round(mark("ending", Math.max(FIRST + 1, durationInFrames - 60)));
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const keep = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/(\d) (?=\d)/g, "$1 ").replace(/\s+([!?:;»])/g, " $1").replace(/«\s+/g, "« ");

  // Its lettering: her title font for her title and her names (the model's poster capitals, Anton, when she chose it),
  // her text font for her call; a family that only has one weight is set at it (never a faked bold).
  const display = "'" + brand.displayFont + "', 'Anton', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const ONE = /^(anton|bebas neue|archivo black|alfa slab one|abril fatface|dm serif display|instrument serif|bowlby one|titan one|ultra|black ops one|rubik mono one|passion one|bungee|oswald)$/i;
  const heavy = ONE.test(String(brand.displayFont || "").trim()) ? 400 : 800;
  // A capital's width in its capitals' height (Anton's, measured on a render: 0,53; a heavy grotesque's about 0,9), to
  // share one size among words and fit a name to its print before FitText settles it.
  const ADV = /^(anton|bebas neue|oswald|big shoulders display|league gothic|fjalla one|roboto condensed|archivo narrow|barlow condensed)$/i.test(String(brand.displayFont || "").trim()) ? 0.56 : 0.9;

  // 1. Its grounds: the original's eight flat colours in its order (the opening on the first poster's red), her charter's
  // colours in turn, or black, as her words ask; its ink black or white, whichever reads best on each.
  const VIVID = ["#fc1f10", "#0052b9", "#ff6127", "#ffa7af", "#97989b", "#060608", "#2391d6", "#ffc91b"];
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); return m ? "#" + m[1].toLowerCase() : null; };
  const pal = brand.palette || {};
  const hers = [brand.accent, pal.secondary, pal.dark, pal.light].map(hex).filter((c, i, all) => c && all.indexOf(c) === i);
  const choice = setting("couleurs", "vives");
  const GROUNDS = choice === "noir" ? ["#060608"] : choice === "sa-charte" && hers.length >= 2 ? hers : VIVID;
  const groundOf = (p) => GROUNDS[((p % GROUNDS.length) + GROUNDS.length) % GROUNDS.length];
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (c) => { const v = parseInt(c.slice(1), 16); return 0.2126 * lin(((v >> 16) & 255) / 255) + 0.7152 * lin(((v >> 8) & 255) / 255) + 0.0722 * lin((v & 255) / 255); };
  const inkOn = (c) => ((lum(c) + 0.05) / 0.05 >= 1.05 / (lum(c) + 0.05) ? "#0d0b0b" : "#f7f5f2");
  const ground = (c) => h(Paper, { key: "ground", color: c, grain: 0.16, shade: 0 });
  // Her pictures as printed: frank, a little contrasted, never washed out.
  const PRINTED = "saturate(0.95) contrast(1.06)";

  // A word in its box, its capitals cap px tall, centred on the box's middle: a font's capitals are about 0,58 of the
  // glyph box FitText fits (Anton's and Inter Tight's alike), so its box is that much taller and its size a little too
  // big for it (it settles to the box's height, or less to its width). Keyed by its words: a FitText measures once.
  const word = (key, text, box, cap, align, ink) => {
    const tall = Math.round(cap / 0.58);
    return h(FitText, { key: key + "-" + text, style: { position: "absolute", left: Math.round(box.left), top: Math.round(box.mid - tall / 2), width: Math.round(box.width), height: tall },
      innerStyle: { fontFamily: display, fontWeight: heavy, fontSize: Math.round(cap * 1.6), lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", color: ink, whiteSpace: "nowrap", alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center", textAlign: align } }, text);
  };

  // 2. The opening: her first shot seen through a wide slit on the first ground (800 × 369 px: the original's height,
  // narrower so her words under the middle stay between x 140 and 940), her title's words dropping one every 0,4 beat,
  // held to the cut, hugging its edges: top left, top right, bottom left, bottom right, a fifth lower on the right (two
  // words: top left, bottom right; three: the top two and bottom left). All one size, as the original's (capitals 4,8 %
  // of the height, smaller only when a row's words need it), 12 px off the slit; a row's two words share its width by
  // their lengths, each on its edge.
  const SX = 140, SW = W - 280, ST = Math.round(H * 0.3385), SH = Math.round(H * 0.192);
  const GAP = Math.round(H * 0.006), APART = 24;
  const hook = reelTexts.find((t) => t.role === "hook");
  const said = hook ? keep(hook.text).split(" ").filter(Boolean) : [];
  const titled = said.length > 5 ? said.slice(0, 4).concat([said.slice(4).join(" ")]) : said;
  const ORDER = titled.length === 1 ? ["tl"] : titled.length === 2 ? ["tl", "br"] : titled.length === 3 ? ["tl", "tr", "bl"] : ["tl", "tr", "bl", "br", "fifth"];
  const len = (spot) => { const i = ORDER.indexOf(spot); return i >= 0 && i < titled.length ? titled[i].length : 0; };
  const rows = [[len("tl"), len("tr")], [len("bl"), len("br")], [len("fifth"), 0]];
  const CAP = Math.round(Math.min(H * 0.048, ...rows.map((r) => (r[0] + r[1] ? (SW - (r[0] && r[1] ? APART : 0)) / ((r[0] + r[1]) * ADV) : Infinity))));
  const share = (a, b) => (a && b ? ((SW - APART) * a) / (a + b) : SW);
  const TOP = ST - GAP - CAP / 2, LOW = ST + SH + GAP + CAP / 2;
  const SPOTS = {
    tl: { left: SX, width: share(len("tl"), len("tr")), mid: TOP, align: "left" },
    tr: { left: SX + SW - share(len("tr"), len("tl")), width: share(len("tr"), len("tl")), mid: TOP, align: "right" },
    bl: { left: SX, width: share(len("bl"), len("br")), mid: LOW, align: "left" },
    br: { left: SX + SW - share(len("br"), len("bl")), width: share(len("br"), len("bl")), mid: LOW, align: "right" },
    fifth: { left: SX, width: SW, mid: LOW + CAP * 2.7, align: "right" },
  };
  const opening = frame < FIRST && n
    ? h(React.Fragment, { key: "opening" },
        ground(groundOf(0)),
        h(Footage, { key: "slit", shot: 0, style: { position: "absolute", left: SX, top: ST, width: SW, height: SH, filter: PRINTED } }),
        titled.map((w, i) => (frame >= i * POP ? word("w" + i, w, SPOTS[ORDER[i]], CAP, SPOTS[ORDER[i]].align, inkOn(groundOf(0))) : null)))
    : null;

  // 3. Its posters, one a shot: her picture in a white-bordered print on its ground, at the original's eight places in
  // its order (its centre, the share of the frame its picture takes; two cut by an edge: C by the left, D by the top), as
  // her file is shaped (a print in portrait for an upright video, in width for a horizontal one; the original's two
  // square places square), or all in portrait or all in width as her words ask. The first, the last and one in two
  // between them carry her name for what they show, in very big letters filling the paper under the picture; a
  // labelled print rises as far as its name needs to stay above the bottom quarter, and the name keeps between x 140
  // and 940 under the middle of the frame.
  const LAYOUTS = [[0.494, 0.471, 0.32, ""], [0.497, 0.522, 0.22, "", 1], [0.468, 0.685, 0.36, "left"], [0.58, 0.287, 0.3, "top"], [0.503, 0.475, 0.3, ""], [0.497, 0.696, 0.24, ""], [0.505, 0.68, 0.3, ""], [0.518, 0.284, 0.26, "", 1]];
  const format = setting("format", "auto");
  const shapeOf = (k, square) => {
    if (format === "vertical") return 0.8;
    if (format === "horizontal") return 4 / 3;
    if (square) return 1;
    const a = Number(shots[k] && shots[k].aspect) || 0.5625;
    return a > 1.15 ? 4 / 3 : a < 0.87 ? 0.8 : 1;
  };
  const P = Math.max(0, n - 1);
  const every = setting("etiquettes", "une-sur-deux") === "toutes";
  const labelled = (p) => every || p === 0 || (p >= 2 && p < P && (P - 1 - p) % 2 === 0);
  // Her names, in the order of the labelled posters: the k-th name on the k-th of them.
  const band = reelTexts.find((t) => t.role === "band");
  const listed = band ? String(band.text).split(/\s*[\/|·]\s*/).map((s) => keep(s)) : [];
  const RANK = [];
  for (let p = 0; p < P; p++) if (labelled(p)) RANK.push(p);
  const names = RANK.reduce((acc, p, j) => { acc[p] = listed[j] || ""; return acc; }, {});
  const PAPER = "#f4f0ec";
  const INK = "#110c0d";
  const printOf = (p) => {
    const k = p + 1;
    const L = LAYOUTS[p % LAYOUTS.length];
    const a = shapeOf(k, Boolean(L[4]));
    const name = labelled(p) ? names[p] || "" : "";
    // Its picture's size from the share of the frame it takes, then kept within the frame (an edge it is cut by aside).
    let pw = Math.sqrt(L[2] * W * H * a);
    let ph = pw / a;
    // Its name's capitals: as big as the width they fill allows (92 % of the print), a fifth of its width at most (the
    // original's big line); its band of paper under the picture holds them with air.
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
    // Never lower than 92 % of the frame (the original's lowest print), never above 3 % of it but the one its upper edge cuts.
    let left = L[3] === "left" ? -Math.round(PW * 0.12) : Math.round(within(L[0] * W - PW / 2, W * 0.04, W * 0.96 - PW));
    let top = L[3] === "top" ? -Math.round(PH * 0.1) : Math.round(within(L[1] * H - PH / 2, H * 0.03, H * 0.92 - PH));
    // Its name read: its whole glyph box (0,86 of its capitals' height each side of their middle) above the bottom quarter.
    const mid = () => top + B + ph + LB / 2;
    if (name && mid() + cap * 0.87 > H * 0.75 - 6) top -= Math.ceil(mid() + cap * 0.87 - (H * 0.75 - 6));
    return { k, left, top, PW, PH, pw, ph, B, LB, name, cap, mid: mid() };
  };
  const poster = (p) => {
    const q = printOf(p);
    const low = q.mid + q.cap * 0.87 > H / 2;
    const x0 = Math.max(q.left + q.B + q.PW * 0.03, low ? 140 : 40);
    const x1 = Math.min(q.left + q.PW - q.B - q.PW * 0.03, low ? W - 140 : W - 40);
    return h(React.Fragment, { key: "poster" + p },
      ground(groundOf(p)),
      h("div", { key: "print", style: { position: "absolute", left: q.left, top: q.top, width: q.PW, height: q.PH, backgroundColor: PAPER } }),
      h(Footage, { key: "pic", shot: q.k, style: { position: "absolute", left: q.left + q.B, top: q.top + q.B, width: q.pw, height: q.ph, filter: PRINTED } }),
      q.name ? word("name" + p, q.name, { left: x0, width: Math.max(60, x1 - x0), mid: q.mid }, q.cap, "center", INK) : null);
  };
  const showing = frame >= FIRST && frame < ENDING && cur >= 1 ? poster(cur - 1) : null;
  // Her names are written one by one on their posters, never all at once: an unseen copy of her list while the posters
  // play tells the scene check it is written whole (as Handwriting keeps the unseen copy of what it lays as decor).
  const copy = band && frame >= FIRST && frame < ENDING ? h("div", { key: "names-copy", "data-fauve-decor": "", style: { position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "hidden", opacity: 0 } }, band.text) : null;

  // 4. Its ending on black (the original's #000, no paper): her call in two lines of white capitals in the middle, a word
  // between « » in bold italic; without a call, her name; her ending card there instead when the Reel has one, her logo
  // over it.
  const fin = reelTexts.find((t) => t.role === "caption");
  const card = Boolean(end) && frame >= ENDING;
  const CTA = Math.round(H * 0.054);
  const stressed = (text) => String(text).split(/(«[^»]*»|"[^"]*"|“[^”]*”)/).filter(Boolean).map((part, i) => (/^[«"“]/.test(part) ? h("span", { key: i, style: { fontStyle: "italic", fontWeight: 800 } }, part) : part));
  const lines = (key, text, top, size, tall) => h(FitText, { key: key + "-" + text, style: { position: "absolute", left: 140, top: Math.round(top), width: W - 280, height: Math.round(tall) },
    innerStyle: { fontFamily: body, fontWeight: 500, fontSize: size, lineHeight: 1.05, letterSpacing: "-0.01em", textTransform: "uppercase", color: "#f7f7f7", whiteSpace: "normal", textWrap: "balance", textAlign: "center" } }, stressed(text));
  const logo = card && brand.logoUrl
    ? h("div", { key: "logo", style: { position: "absolute", left: Math.round(W * 0.3), top: Math.round(H * 0.25), width: Math.round(W * 0.4), height: Math.round(H * 0.14), padding: brand.logoOnDark === "plate" ? 18 : 0, backgroundColor: brand.logoOnDark === "plate" ? PAPER : "transparent", boxSizing: "border-box" } },
        h(Img, { src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { width: "100%", height: "100%", objectFit: "contain", filter: brand.logoOnDark === "white" ? "brightness(0) invert(1)" : "none" } }))
    : null;
  const call = fin ? keep(fin.text) : keep(brand.name);
  const ending = frame >= ENDING
    ? h(React.Fragment, { key: "ending" },
        h("div", { key: "black", style: { position: "absolute", inset: 0, backgroundColor: "#000000" } }),
        logo,
        card ? lines("title", keep(end.title), H * 0.4, CTA, CTA * 2.3) : call ? lines("call", call, H * 0.5 - CTA * 1.66, CTA, CTA * 3.32) : null,
        card && end.subtitle ? lines("sub", keep(end.subtitle), H * 0.4 + CTA * 2.45, Math.round(CTA * 0.62), CTA * 1.7) : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain line, so nothing she wrote is lost.
  const mine = [hook, band, fin];
  const extra = reelTexts.filter((t) => mine.indexOf(t) < 0 && frame >= t.from && frame < t.to).map((t, i) =>
    h(FitText, { key: "x" + i + "-" + t.text, style: { position: "absolute", left: 140, top: 160 + i * 110, width: W - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#f7f5f2", textShadow: "0 0 3px rgba(0,0,0,0.7)", textAlign: "center" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, opening, showing, copy, ending, extra);
}`;

export const affiches: MontageSkill = {
  key: "affiches",
  version: 1,
  bpm: BPM,
  // The opening slit and four to eleven posters from her files (a video gives up to three passages); up to 27 posters
  // for a length she asks for (30 s at its own tempo), like more pages of the same magazine.
  shots: [5, 12],
  files: [4, 12],
  long: 28,
  how: "Une affiche par seconde, tout immobile : d'abord une fente horizontale de son premier plan sur un aplat rouge, et les mots de son titre qui tombent un à un à ses quatre coins ; puis chacun de ses plans dans un tirage à bord blanc sur un aplat de couleur vive qui change à chaque coupe (rouge, bleu, orange, rose, gris, noir, bleu ciel, jaune), posé chaque fois ailleurs (deux sortent du cadre), et sur le papier du premier, du dernier et d'un sur deux, le nom de ce qu'il montre en très grandes capitales ; enfin son appel en capitales blanches sur du noir. Chaque tirage a la forme de son image ; ses vidéos y jouent, ses photos restent fixes.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "son titre, posé mot à mot autour de la fente de l'ouverture (un mot tous les cinquièmes de seconde, aux quatre coins, le cinquième plus bas) : ses deux à cinq mots les plus forts sur ce qu'elle montre (une forme comme « Nouvelle collection d'automne », « La carte du soir », « Mes bouquets de saison »), jamais sa phrase entière ; des mots courts, onze lettres au plus chacun",
      max: 40,
      required: true,
    },
    {
      slot: "noms",
      role: "band",
      want: "facultatif mais à écrire dès que ses cases montrent des choses qui se nomment : les noms écrits en très grand sur le papier des affiches qui en portent un, dans leur ordre, séparés par « / » (une forme comme « Croissant / Éclair / Tarte / Macarons ») ; la « veut » de chacune de ces cases dit le rang de son nom (« le 2e nom de « noms » ») : celui du produit, du plat, de la création ou du service qu'elle montre, un ou deux mots, jamais une phrase ni un prix inventé",
      max: 120,
      required: false,
    },
    {
      slot: "fin",
      role: "caption",
      want: "facultatif : son appel sur le noir de la fin, en capitales blanches sur deux lignes courtes au plus (une forme comme « Viens les goûter », « Réserve ta place », « Passe à la boutique ») ; un mot entre « » s'écrit en gras italique ; sans appel, son nom s'y écrit",
      max: 44,
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
      name: "format",
      want: "la forme de ses tirages : comme ses images, tous en portrait, ou tous en largeur",
      choices: [
        { value: "auto", says: "comme ses images : en portrait pour une vidéo verticale, en largeur pour une horizontale ; les deux places carrées de l'original carrées" },
        { value: "vertical", says: "tous ses tirages en portrait (4:5)" },
        { value: "horizontal", says: "tous ses tirages en largeur (4:3), ses vidéos verticales recadrées sur leur sujet" },
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
  timeline(n, { end, bpm: tempo, settings }) {
    // At another tempo (a length she asks for, a music's own), every landmark counted in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const posters = Math.max(1, n - 1);
    const every = settings?.etiquettes === "toutes";
    // Its opening, each poster, the last one under the black ending (drawn by its code); an ending card takes the
    // ending's four beats (its 1,6 s and more at every tempo it plays at).
    const spans = beatSpans(bpm, [OPEN, ...Array.from({ length: posters }, (_, i) => (i === posters - 1 ? POSTER + ENDING : POSTER))]);
    const duration = spans.at(-1)!.end;
    const last = spans.at(-1)!;
    const ending = round(toFrame(last.start + POSTER * beat) / 30);
    // The labelled posters in order: the k-th name of « noms » on the k-th of them.
    const ranked = Array.from({ length: posters }, (_, p) => p).filter((p) => affichesLabelled(p, posters, every));
    const poster = (p: number) => {
      const rank = ranked.indexOf(p) + 1;
      const named = rank ? ` ; son nom s'écrit en très grand sur le papier du tirage, sous l'image : le ${rank}${rank > 1 ? "e" : "er"} nom de « noms »` : "";
      const tail = p === posters - 1 ? ` (son passage dure ${comma(last.end - last.start)} s : la fin sur le noir passe dessus après ${comma(POSTER * beat)} s)` : "";
      return `une affiche, ${comma(POSTER * beat)} s${tail} : une photo ou une courte vidéo d'un de ses produits (un plat, une création, un bouquet, une coupe, un article, quelqu'un de l'équipe au travail), seul et bien en vue au milieu de l'image, posée en tirage à bord blanc sur un aplat de couleur ; sinon un autre de ses plans, un détail de son lieu ; jamais deux fois le même${named}`;
    };
    return {
      duration,
      shots: spans.map((s, i) => ({
        ...s,
        want:
          i === 0
            ? `l'ouverture, ${comma(OPEN * beat)} s : vue par une fente horizontale au milieu de l'image (un bandeau deux fois plus large que haut), sous les mots de son titre qui tombent un à un autour : un gros plan d'un regard (les yeux de quelqu'un de l'équipe), d'un détail de son produit ou d'une matière ; sinon n'importe lequel de ses plans (seule sa bande du milieu se voit)`
            : poster(i - 1),
      })),
      // Her title over the opening, her names over the posters, her call (or her ending card) on the black.
      texts: {
        titre: { from: 0, to: round(spans[1]!.start) },
        noms: { from: round(spans[1]!.start), to: ending },
        fin: { from: ending, to: round(duration) },
      },
      marks: {
        beat: round(beat * 30),
        pop: Math.max(2, Math.round(POP * beat * 30)),
        first: toFrame(spans[1]!.start),
        ending: toFrame(ending),
      },
      // Its music composed at its tempo, its first beat on the first image (the original's comes 0,16 s in), cut dead
      // at the end as the original's is.
      music: { end: { at: duration } },
    };
  },
  code: CODE,
  // Its code lays its own still paper grain on its grounds: its model's finish keeps its contrast, without film grain
  // nor dark corners (the original has neither).
  finish: { grain: 0, vignette: 0 },
};
