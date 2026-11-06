import { toFrame, type MontageSkill, type SkillShot } from "../skills.ts";

// « Collage qui s'emboîte » (`collage`), version 1, written on its original's fiche (docs/fiches/collage.md: n° 22 of
// Tristan's wave of 5 November, 8,37 s measured image by image at 30 i/s, its sound by bands; Tristan: « c'est un effet
// que l'on veut pouvoir faire, pas exactement reproduire l'image »). A collage of still photos in stop motion, a change
// every 6 images (0,2 s), no text: each next image arrives first in a piece over the one before (its person cut out at
// her own place, its roofs without their sky, or seen through a window of the image before), then whole; three people
// cut out parade over one image; two images in black and white; at the end its last person cut out stays on the first
// image, which comes back: a loop of 125 images played twice. Its music (a trap beat at 80 BPM, its 808 coming in after
// a bar's pickup) runs on its own clock, not on the cuts. Here:
//   - its cases follow the original's loop of thirteen (its ten photos, A to J, and the three people of its parade,
//     beside C), taken again in order for 13 to 26 of her images (39 for a length she asks for), one chain played once
//     (Instagram loops it) rather than the same one twice: 26 cases last the original's 8,4 s;
//   - its step is a sixteenth at 75 BPM (0,2 s, the original's 6 images; at 80 BPM it would be 5,6), its music composed
//     at that tempo so that its cuts fall on Edith's music (the original's do not fall on its own): its cuts land within
//     an image of the original's (its loop 126 images long instead of 125);
//   - its moves, in the original's order, each with its fallback read on her shots (never an empty step): her person
//     arriving cut out (Subject, else a plain cut); the next image's ground without its sky (Skyline, when SkylineAt
//     finds a sky there, else her person); its parade (each one cut out on the image of C, else whole); a plain cut; the
//     next image seen through a thing that makes a window (« @fenetre », named by the filler on its eighth case: a shop
//     window, a mirror, a cup seen from above), through her silhouette (SubjectOutline as a clip path) or through the sky
//     of the image before (its Skyline over the next one); the last person staying on the next image (the loop);
//   - the images in the places of D and I in black and white (setting « couleur »), the others as filmed;
//   - its optional title (the original has none: the form, never the silence when Edith picks it) in big white
//     condensed capitals high on its first ten steps, like a sign's letters, its pieces passing in front of it;
//   - her photos stay still, her videos play; its format as her pictures (vertical full frame, a 16:9 band on black
//     when most are horizontal), or as her words ask (Tristan: « format par défaut [comme ses vidéos], et changement à la
//     demande du user »). Nothing of the original's own (its café's sign, its city, its people, its music).

const BPM = 75;
/** A step: a sixteenth of the beat, 0,2 s at 75 BPM (the original's 6 images). */
const STEP = 0.25;
/** The original's loop, case by case: its ten photos (A to J) and the three people of its parade (P), beside C. */
type Role = "A" | "B" | "C" | "P" | "D" | "E" | "F" | "G" | "H" | "I" | "J";
const CYCLE: Role[] = ["A", "B", "C", "P", "P", "P", "D", "E", "F", "G", "H", "I", "J"];
/** How the next image arrives after each of its photos (its fiche's effects 2 to 6). */
export type CollageMove = "cut" | "arrive" | "ground" | "window" | "silhouette" | "sky" | "stay" | "parade";
const MOVES: Record<Exclude<Role, "P">, CollageMove> = { A: "arrive", B: "ground", C: "ground", D: "cut", E: "window", F: "silhouette", G: "cut", H: "sky", I: "arrive", J: "stay" };
/** Each move as its code reads it (k<i>). */
const CODES: Record<CollageMove, number> = { cut: 0, arrive: 1, ground: 2, window: 3, silhouette: 4, sky: 5, stay: 6, parade: 7 };
/**
 * The cases whose sky its code reads, written as numbers (Skyline and SkylineAt on a variable would read every shot):
 * the images its ground moves bring (C and D of its first loop, C of its second) and H, whose sky shows the next image;
 * four grounds a Reel at most (GROUND_MAX). Elsewhere its person arrives instead.
 */
const SKIES = [2, 6, 10, 15];
/** The one case with a thing that makes a window (E of its first loop: « @fenetre »); later ones use her silhouette. */
const WINDOW = 7;
/** Its title on its first ten steps (2 s at 75 BPM: the original's first ten changes, through its parade). */
const TITLE_STEPS = 10;
/** The engine's ending card: 1,6 s at least, in whole steps. */
const END_CARD = 1.6;
const round = (x: number) => Math.round(x * 100) / 100;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Its chain for n cases: each case's role in the original's loop, the cases that are photos of the chain (the others
 * parade beside the one before them), and how the next image arrives after each one (its last: the loop, its person
 * staying on the first image). A ground or a sky only where its code reads the sky, a window only on its eighth case.
 */
export function collageChain(n: number): { roles: Role[]; mains: number[]; moves: CollageMove[] } {
  const roles = Array.from({ length: n }, (_, i) => CYCLE[i % CYCLE.length]!);
  const mains = roles.flatMap((r, i) => (r === "P" ? [] : [i]));
  const moves = roles.map((r, i): CollageMove => {
    if (r === "P") return "parade";
    const next = mains[mains.indexOf(i) + 1];
    if (next === undefined) return "stay";
    const own = MOVES[r];
    if (own === "ground") return SKIES.includes(next) ? "ground" : "arrive";
    if (own === "sky") return SKIES.includes(i) ? "sky" : "arrive";
    if (own === "window") return i === WINDOW ? "window" : "silhouette";
    return own;
  });
  return { roles, mains, moves };
}

/**
 * The cases its code draws cut out, for n cases: the next photo of each « arrive », each case of its parade, the photo
 * whose window is a thing (its silhouette when none is found) or a silhouette, the person who stays (the case before the
 * next photo, its last case at the end), and, in its first loop only, the photo each ground or sky brings (her person
 * arrives when no sky is read there): the most of them in its first loop, where ten photos a Reel are cut out at most.
 */
export function collageCutouts(n: number): number[] {
  const { mains, moves } = collageChain(n);
  const out = new Set<number>();
  for (const [k, i] of mains.entries()) {
    const next = mains[k + 1];
    const move = moves[i]!;
    if (move === "arrive" && next !== undefined) out.add(next);
    if ((move === "ground" || move === "sky") && next !== undefined && next < CYCLE.length) out.add(next);
    if (move === "window" || move === "silhouette") out.add(i);
    if (move === "stay") out.add((next ?? n) - 1);
  }
  moves.forEach((m, i) => m === "parade" && out.add(i));
  return [...out].sort((a, b) => a - b);
}

/** What each case wants, for the filler (French): what any business has, else what does. */
function wantOf(role: Role, i: number, under: number): string {
  switch (role) {
    case "A":
      return i === 0
        ? "la première image, qui ouvre et referme la boucle (le Reel y revient à la fin, la dernière personne détourée posée dessus) : la plus belle image large de son lieu, de sa rue ou de sa vitrine, qu'on comprend d'un coup d'œil"
        : "une belle image large de son lieu ou de sa rue, une autre que la première : la personne d'avant y reste un instant détourée, puis elle ouvre une nouvelle boucle";
    case "B":
      return "quelqu'un en entier ou jusqu'à la taille (elle, son équipe, un client), net sur son fond : il arrive d'abord détouré sur l'image d'avant, à sa place, puis son image entière ; sinon ce qu'elle vend, bien détaché de son fond";
    case "C":
      return SKIES.includes(i)
        ? "un plan de dehors avec du ciel en haut (sa rue, sa façade, sa terrasse, ses toits) : ses toits sans leur ciel arrivent d'abord sur l'image d'avant, puis il reste le décor sur lequel trois personnes détourées défilent ; sinon un plan large et calme de son lieu"
        : "un plan large et calme de son lieu ou de sa rue : le décor sur lequel trois personnes détourées défilent";
    case "P":
      return `quelqu'un d'autre (son équipe, un client) en entier ou jusqu'à la taille, ou une chose qu'elle vend bien détachée : seul ce qu'il montre est détouré et posé un instant sur l'image de la case ${under + 1}, à sa place ; son fond ne se voit jamais`;
    case "D":
      return SKIES.includes(i)
        ? "un plan de dehors avec du ciel (sa façade, la rue, un lieu du quartier), montré en noir et blanc : son premier plan sans le ciel arrive d'abord sur l'image d'avant ; sinon une image de son lieu"
        : "une image de son lieu ou de son quartier, montrée en noir et blanc";
    case "E":
      return i === WINDOW
        ? "une image où quelque chose fait fenêtre (une vitrine, une fenêtre, un miroir, une porte vitrée, une assiette ou une tasse vue de dessus, des lunettes) : l'image suivante y apparaît, à sa place ; sinon quelqu'un, dont la silhouette servira de fenêtre"
        : "quelqu'un en entier ou de près : sa silhouette devient une fenêtre sur l'image suivante";
    case "F":
      return "un portrait, quelqu'un de près (elle, son équipe, un client) : sa silhouette devient une fenêtre sur l'image suivante ; sinon quelqu'un en entier";
    case "G":
      return "un détail de près (ses mains au travail, une matière, un produit), différent des images voisines";
    case "H":
      return SKIES.includes(i)
        ? "un plan de dehors avec du ciel ou une ouverture claire (une arche, une porte ouverte sur la rue, une fenêtre) : l'image suivante apparaît dans son ciel ; sinon un plan large de son lieu"
        : "un plan large de son lieu ou de sa rue";
    case "I":
      return "un plan large et clair (la rue, l'horizon, la salle), montré en noir et blanc : quelqu'un y arrive détouré à la fin";
    case "J":
      return "un portrait de près (elle, quelqu'un de son équipe, un client) : il arrive détouré sur l'image d'avant, puis reste détouré un instant sur l'image suivante";
  }
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");

  // 1. Its chain, as its timeline gives it for each case (k<i>): 0 a plain cut, 1 the next image's person arrives cut
  // out, 2 its ground without its sky arrives, 3 it is seen through a thing that makes a window, 4 through her
  // silhouette, 5 through the sky of this one, 6 its last person stays on the next image (the loop), 7 a case of its
  // parade, beside the photo before it; t<i>, the frame its next image starts arriving on.
  const CUT = 0, ARRIVE = 1, GROUND = 2, FRAMED = 3, SILHOUETTE = 4, SKY = 5, STAY = 6, PARADE = 7;
  const move = (i) => Math.round(mark("k" + i, i < n - 1 ? ARRIVE : STAY));
  const mains = [];
  for (let i = 0; i < n; i++) if (move(i) !== PARADE) mains.push(i);
  const nextOf = (i) => { const k = mains.indexOf(i); return k >= 0 && k + 1 < mains.length ? mains[k + 1] : 0; };

  // 2. Its frame: her upright or square pictures full frame, as the original; mostly horizontal ones whole in a 16:9
  // band on black, every piece at the band's scale; or as her words ask.
  const upright = shots.filter((s) => (Number(s.aspect) || 0.5625) < 1.15).length;
  const format = setting("format", "auto");
  const band = format === "horizontal" || (format === "auto" && n > 0 && upright * 2 < n);
  const BH = Math.round((width * 9) / 16);
  const box = band ? { left: 0, top: Math.round((height - BH) / 2), width, height: BH } : { left: 0, top: 0, width, height };

  // 3. Her pictures as filmed, two of them in a dense black and white (the original's D and I: g<i>); her person cut
  // out exactly where her picture lays her, with a clean edge (no rim, no shadow); her ground without its sky (read on
  // four cases only, written as numbers); a picture seen through a shape of another, at its own place and size.
  const grey = (i) => setting("couleur", "deux") !== "toutes" && mark("g" + i, 0) > 0;
  const tone = (i) => (grey(i) ? { filter: "grayscale(1) contrast(1.18)" } : {});
  const pic = (i, key, at) => h(Footage, { key, shot: i, style: { ...box, ...tone(i) }, ...(at !== undefined ? { at } : {}) });
  const cutOut = (i, key) => h(Subject, { key, shot: i, style: { ...box, ...tone(i) } });
  const hasCut = (i, f) => i >= 0 && i < n && Boolean(SubjectBox(shots[i], f, box));
  const ground = (i, key) => {
    const st = { ...box, ...tone(i) };
    return i === 2 ? h(Skyline, { key, shot: 2, style: st }) : i === 6 ? h(Skyline, { key, shot: 6, style: st }) : i === 10 ? h(Skyline, { key, shot: 10, style: st }) : i === 15 ? h(Skyline, { key, shot: 15, style: st }) : null;
  };
  const skyOf = (i) =>
    i === 2 && shots[2] ? SkylineAt(shots[2], shots[2].from, box)
    : i === 6 && shots[6] ? SkylineAt(shots[6], shots[6].from, box)
    : i === 10 && shots[10] ? SkylineAt(shots[10], shots[10].from, box)
    : i === 15 && shots[15] ? SkylineAt(shots[15], shots[15].from, box)
    : null;
  const framedBy = (f) => (n > 7 ? SubjectOutline(shots[7], f, box, "@fenetre") : null);
  const through = (d, i, key) => h("div", { key, style: { position: "absolute", left: 0, top: 0, width, height, clipPath: "path('" + d + "')" } }, pic(i, key + "-in"));

  // 4. What shows now: the photo of the chain on screen, whole (with the person of its parade on now, cut out on it),
  // or, on its last step, the next image arriving in a piece over it, by its move, else its fallback.
  const at = Math.min(frame, endAt - 1);
  let cur = mains.length ? mains[0] : -1;
  for (const i of mains) if (shots[i].from <= at) cur = i;
  const back = [];
  const front = [];
  if (cur >= 0) {
    const tail = mark("t" + cur, -1);
    const nx = nextOf(cur);
    const arrive = () => {
      if (hasCut(nx, shots[nx].from)) {
        back.push(pic(cur, "s" + cur));
        front.push(cutOut(nx, "a" + nx));
      } else back.push(pic(nx, "s" + nx));
    };
    const silhouette = () => {
      const d = SubjectOutline(shots[cur], at, box);
      if (d) back.push(pic(cur, "s" + cur), through(d, nx, "w" + nx));
      else arrive();
    };
    if (frame >= endAt) {
      // Its ending card, on its first image come back.
      back.push(pic(0, "s0", mark("t" + cur, endAt)));
    } else if (tail < 0 || at < tail) {
      let shown = pic(cur, "s" + cur);
      for (let j = cur + 1; j < n && move(j) === PARADE; j++) {
        if (frame < shots[j].from || frame >= shots[j].from + shots[j].durationInFrames) continue;
        if (hasCut(j, frame)) front.push(cutOut(j, "p" + j));
        else shown = pic(j, "p" + j);
      }
      back.push(shown);
    } else {
      const mv = move(cur);
      if (mv === GROUND) {
        const g = skyOf(nx) !== null ? ground(nx, "g" + nx) : null;
        if (g) {
          back.push(pic(cur, "s" + cur));
          front.push(g);
        } else arrive();
      } else if (mv === FRAMED) {
        const d = cur === 7 ? framedBy(at) : null;
        if (d) back.push(pic(cur, "s" + cur), through(d, nx, "w" + nx));
        else silhouette();
      } else if (mv === SILHOUETTE) silhouette();
      else if (mv === SKY) {
        const g = skyOf(cur) !== null ? ground(cur, "g" + cur) : null;
        if (g) {
          back.push(pic(nx, "s" + nx));
          front.push(g);
        } else arrive();
      } else if (mv === STAY) {
        // The person of its last case stays on the next image (the first one again at the end: from its start, the loop);
        // without her cut-out, the latest person cut out before her (ten photos a Reel are cut out at most).
        let who = (nx > cur ? nx : n) - 1;
        while (who > 0 && !hasCut(who, at)) who--;
        back.push(pic(nx, "s" + nx, nx > cur ? undefined : tail));
        if (who > 0) front.push(cutOut(who, "y" + who));
      } else if (mv === ARRIVE) arrive();
      else back.push(pic(cur, "s" + cur));
    }
  }

  // 5. Its title (none in the original; hers when the Reel has one): her name or a few words in white condensed capitals
  // on a band of her colour across the frame, like the letters of an awning (the original's only lettering, a café's
  // sign in one of its photos), high on its first steps; what arrives passes in front of it, as the roofs of the
  // original's third photo cover its sign. Her colour when it is dark enough for white letters, else her dark one, else ink.
  const luma = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return 1;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  const AWNING = [brand.accent, brand.palette && brand.palette.dark].find((c) => luma(c) <= 0.55) || "#1d1d1b";
  const strip = (key, top, tall) => h("div", { key, style: { position: "absolute", left: 0, top, width, height: tall, backgroundColor: AWNING } });
  const words = (t, style, size, key, more) =>
    h(FitText, { key, style: { position: "absolute", ...style }, innerStyle: { fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", whiteSpace: "nowrap", ...(more || {}) } }, keep(t));
  const hook = reelTexts.find((t) => t.role === "hook");
  const AT = band ? { top: box.top + 30, tall: 120 } : { top: 250, tall: 190 };
  const title = hook && frame >= hook.from && frame < Math.min(hook.to, endAt)
    ? [strip("awning", AT.top, AT.tall), words(hook.text, { left: 60, top: AT.top + Math.round(AT.tall * 0.12), width: width - 120, height: Math.round(AT.tall * 0.76) }, band ? 96 : 150, "title-" + hook.text)]
    : null;

  // 6. Its ending card (in option): her words on the same band, on its first image come back, her line under them.
  const CT = band ? { top: box.top + 20, tall: 250 } : { top: 560, tall: 330 };
  const card = end && frame >= endAt
    ? [
        strip("card", CT.top, CT.tall),
        words(end.title, { left: 60, top: CT.top + 24, width: width - 120, height: end.subtitle ? Math.round(CT.tall * 0.52) : CT.tall - 48 }, band ? 110 : 160, "card-" + end.title),
        end.subtitle
          ? words(end.subtitle, { left: 90, top: CT.top + Math.round(CT.tall * 0.62), width: width - 180, height: Math.round(CT.tall * 0.28) }, 56, "sub-" + end.subtitle, { fontFamily: body, fontWeight: 600, letterSpacing: "0.04em" })
          : null,
      ]
    : [];

  // Any other text of the Reel (none in its slots): a plain line on the band's colour, so nothing she wrote is lost.
  const extra = reelTexts.filter((t) => t !== hook && frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 620 + i * 110, width: width - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 52, color: "#ffffff", textAlign: "center" } }, h("span", { style: { backgroundColor: AWNING, padding: "4px 18px" } }, keep(t.text))));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, back, title, front, card, extra);
}`;

export const collage: MontageSkill = {
  key: "collage",
  version: 1,
  bpm: BPM,
  // One loop of the original (13 cases, 4,2 s) to two (26 cases, its 8,4 s), each case one of her images.
  shots: [13, 26],
  files: [8, 26],
  // A length she asks for: a third loop (39 cases, 12,6 s at its tempo, 15,8 s at its slowest).
  long: 39,
  how: "Un collage image par image de ses photos et vidéos, un changement toutes les 0,2 s : chaque image arrive d'abord en morceau sur la précédente (sa personne détourée à sa place, ses toits sans leur ciel, ou vue dans une vitrine, une silhouette ou le ciel de l'image d'avant), puis entière ; trois personnes détourées défilent sur un même décor ; deux images en noir et blanc ; à la fin, la dernière personne détourée reste sur la première image, qui revient : la boucle. Un titre facultatif en grandes capitales blanches sur ses premières images. En vertical plein cadre ; ses images horizontales dans une bande 16:9 sur du noir.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "facultatif : son nom, ou deux à quatre mots qui disent ce qu'on voit (son lieu, son quartier, sa saison, ce qu'elle lance : une forme comme « Brunch du dimanche », « Belleville »), jamais sa phrase entière ; en grandes capitales blanches étroites dans le haut de ses premières images, que les morceaux qui arrivent recouvrent par moments",
      max: 22,
      required: false,
    },
  ],
  objects: [
    {
      slot: "fenetre",
      shot: WINDOW,
      want: "ce qui fait fenêtre dans cette image et que l'image suivante viendra remplir : une vitrine, une fenêtre, un miroir, une porte vitrée, une assiette ou une tasse vue de dessus, des lunettes (en anglais, comme l'œil le voit : « shop window », « round mirror », « coffee cup ») ; rien quand aucune ne s'y prête (sa silhouette sert alors de fenêtre)",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein cadre comme l'original, ou ses images horizontales entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme ses images (vertical plein cadre, une bande 16:9 sur du noir quand la plupart sont horizontales)" },
        { value: "vertical", says: "vertical plein cadre, ses images horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "toutes ses images entières dans une bande 16:9 sur du noir" },
      ],
    },
    {
      name: "couleur",
      want: "ses deux images en noir et blanc, comme l'original, ou toutes en couleur",
      choices: [
        { value: "deux", says: "deux images en noir et blanc dense (aux places de l'original), les autres telles qu'elle les a filmées" },
        { value: "toutes", says: "toutes ses images en couleur" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo, settings }) {
    // At another tempo (a longer Reel, or a music's own): every length counted in steps follows it.
    const bpm = tempo ?? BPM;
    const step = (STEP * 60) / bpm;
    /** A time in steps, on the frame grid (s). */
    const at = (steps: number) => toFrame(steps * step) / 30;
    const { roles, mains, moves } = collageChain(n);
    const card = end ? Math.ceil((END_CARD + 0.05) / step) : 0;
    const shots: SkillShot[] = [];
    const marks: Record<string, number> = { step: toFrame(step) };
    let steps = 0;
    for (const [k, i] of mains.entries()) {
      const parade = roles.slice(i + 1).findIndex((r) => r !== "P");
      const beside = (parade < 0 ? n - i - 1 : parade);
      const tail = moves[i] === "cut" ? 0 : 1;
      const last = k === mains.length - 1;
      const length = 1 + beside + tail + (last ? card : 0);
      const lastWord = last ? " ; c'est la dernière image de la chaîne : sa personne détourée reste un instant sur la première image, qui revient (la boucle)" : "";
      shots.push({ start: round(at(steps)), end: round(at(steps + length)), want: wantOf(roles[i]!, i, i) + lastWord });
      for (let j = 1; j <= beside; j++) shots.push({ start: round(at(steps + j)), end: round(at(steps + j + 1)), want: wantOf("P", i + j, i), beside: true });
      marks[`k${i}`] = CODES[moves[i]!];
      for (let j = 1; j <= beside; j++) marks[`k${i + j}`] = CODES.parade;
      if (tail) marks[`t${i}`] = toFrame(at(steps + 1 + beside));
      steps += length;
    }
    // The images in the places of the original's D and I, in black and white, unless her words ask for them all in colour.
    if (settings?.couleur !== "toutes") roles.forEach((r, i) => (r === "D" || r === "I") && (marks[`g${i}`] = 1));
    const duration = round(at(steps));
    const beat = 60 / bpm;
    return {
      duration,
      shots,
      // Its title over its first ten steps (through its parade, as the original's first changes).
      texts: { titre: { from: 0, to: round(Math.min(at(TITLE_STEPS), end ? at(steps - card) : duration)) } },
      marks,
      // Only what its moves draw is cut out (ten photos a Reel at most, SUBJECT_PHOTO_MAX, and 30 s of video): the
      // image whose person arrives, each of its parade, the image whose silhouette makes a window, the person who stays
      // (its last case closes the loop), and in its first loop the images its grounds and its sky bring, whose person
      // arrives instead when no sky is read (indoors, the common case).
      cutouts: collageCutouts(n),
      // A beat's pickup without its bass (the original's intro, 0,68 s without drums), its bass coming in on the
      // downbeat; cut dead at the end, where the Reel loops.
      music: {
        downbeat: round3(beat),
        filters: [{ kind: "thin", from: 0, to: round3(beat) }],
        end: { at: duration, fade: 0.012 },
      },
    };
  },
  code: CODE,
};
