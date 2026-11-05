import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Quart de tour, deux tons » (key `tourne`, « Noir et blanc tourné » until its fiche), version 2, written again on its
// original's fiche (docs/fiches/tourne.md: a travel edit in Egypt, 12,8 s, measured image by image at 30 i/s, its music
// and its sound read by bands; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire
// l'image »). Its music is a cinematic electro at 118,3 BPM (a beat every 0,507 s; v1 had taken 79, Gemini heard 128),
// and every length below is in its beats from the Reel's start, so its cuts fall where the original's do (within an
// image), its burst on the quarters of its beat:
//   0 – 0,8     four shots that rush by (a road, a vehicle, a filé, a matter that scrolls), a strobe over them on
//               images 3, 5, 8, 10, 11, 12, 15, 19 and 23 (overexposed, its blacks lifted), on a rising roll;
//   0,8 – 6,6   seven shots of one or two beats on a muffled music: its first two in colour (a big hit on each cut, the
//               second the loudest), an upright video turned upside down when it reads so (a silhouette on the sky),
//               a passage blur into a close detail, a third in colour that blurs into a white flash (2 images), someone
//               standing before a place, a dark shot a beat before the beat;
//   6,6 – 10,6  the burst when the music opens: 16 shots in 8 beats, 3 to 15 images each on its quarters (¾, 1, ¼, ¼, ¼,
//               ½, ¾, ¼, ¼, ¼, ¼, 1, ½, ¾, ¼, ¾), its second a punch zoom (one wide image, then ×2,3 in eight, held), a
//               white flash on the third's first image, two in colour, something that turns, a view from above, a filmed
//               whip (an image of streak in, four out), the last one blurring into the last flash;
//   10,6 – 12,8 the last shot held to the end (someone from behind, arms raised, before her place), the music muffled
//               again and cut dead with the picture. No text, no logo, no card: her ending card only when she has one.
// Every shot filmed in width is turned a quarter, always clockwise (the top of the scene on the right), whole: a 16:9
// video turned fills the vertical frame exactly. Two tones (deep blacks, blue-green shadows, green-grey mids, cream
// highlights, its whites never past #E8E5DA) on all but five shots, left in colour where the colour counts; lens edges
// at the top and bottom of the frame (streaked along the height, split green and magenta, the magenta outward). No grain,
// no dark corners, no slow push: her shots move as she filmed them; a photo stays still, a video plays (Tristan).
// Nothing of the original's own is copied (its places are Egypt's): her shots, her colours.

const BPM = 118.3;
/** Its opening, in beats: the road, a vehicle, the filé, a matter that scrolls (6, 5, 5 and 8 images at its tempo). */
const OPENING = [0.39, 0.33, 0.33, 0.53];
/** Its calm, on the beats of its music's pad: pyramids, camels, the walker upside down, cactus, dune, a man, a lionfish. */
const CALM = [2.03, 0.92, 1.91, 1.71, 1.77, 2.08, 1];
/** What a shot of its burst does. */
type Role = "" | "zoom" | "flash" | "turns" | "colour" | "above" | "whip" | "face";
/** Its burst on the beat: 16 shots in 8 beats, in quarter beats, each with what it does (the original's order). */
const BURST: [number, Role][] = [
  [3, ""],
  [4, "zoom"],
  [1, "flash"],
  [1, ""],
  [1, ""],
  [2, "turns"],
  [3, "colour"],
  [1, ""],
  [1, ""],
  [1, ""],
  [1, ""],
  [4, "colour"],
  [2, "above"],
  [3, "whip"],
  [1, ""],
  [3, "face"],
];
/** Fewer of her shots: these of its burst go into the one before them, in turn (its 8 beats kept, its slots longer). */
const MERGE = [4, 8, 10, 14, 3, 9, 12, 5];
/** The last shot, held (beats: 2,13 s at its tempo). */
const LAST = 4.25;
/** Its slots in the calm: those left in colour, the upright one turned upside down, the one a white flash opens. */
const CALM_COLOUR = [4, 5, 8];
const FLIP = 6;
const FLASH_CALM = 9;
/** The opening's filé, the slot after the passage blur of the calm (its close detail). */
const FILE_IN = 2;
const SOFT_CALM = 7;
/** Its strobe, in beats from the start: the original's images 3, 5, 8, 10, 11, 12, 15, 19 and 23. */
const STROBE = [0.2, 0.33, 0.53, 0.66, 0.72, 0.79, 0.99, 1.25, 1.51];
/** Its punch zoom takes this long from the shot's second image (beats: 8 images at its tempo). */
const ZOOM_IN = 0.53;
/** Its roll, loudest this far in (beats: 0,6 s), and its two big hits, the second the loudest of the piece. */
const ROLL_AT = 1.2;
const ROLL = { sound: "fast snare drum roll building up", seconds: 0.8 };
const HIT = { sound: "deep cinematic impact hit", seconds: 1.5 };
/** The engine's ending card (the Reel's last 1,6 s), on the black after the last shot. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its burst for `count` shots (8 to 16): the original's, its short ones merged into the one before them, in turn. */
export function burstFor(count: number): { q: number; role: Role }[] {
  const shots = BURST.map(([q, role], i) => ({ q, role, i }));
  for (const m of MERGE.slice(0, Math.max(0, Math.min(MERGE.length, BURST.length - count)))) {
    const k = shots.findIndex((s) => s.i === m);
    if (k > 0) {
      shots[k - 1]!.q += shots[k]!.q;
      shots.splice(k, 1);
    }
  }
  return shots.map(({ q, role }) => ({ q, role }));
}

/** What each shot of its burst wants (French, for the filler). */
const BURST_WANTS: Record<Role, string> = {
  "": "un détail très bref filmé en largeur : une matière, un geste, un visage, un objet de près",
  zoom: "un mur de motifs serrés filmé en largeur (des carreaux, des bocaux alignés, un tissu, une étagère) : une image large, puis le zoom coup de poing dedans",
  flash: "un détail d'une matière ou d'un relief filmé en largeur : il arrive par un flash blanc",
  turns: "quelque chose qui tourne, filmé en largeur (un ventilateur, un batteur, un tour de potier, un disque, une roue)",
  colour: "un détail où la couleur compte, filmé en largeur (ses fleurs, ses fruits, la mer, un mur peint) : il reste en couleur",
  above: "une vue d'en haut filmée en largeur (une table, un comptoir, quelqu'un vu de dessus)",
  whip: "un balayage rapide d'une matière ou d'une façade (la caméra qui balaie vite) : il arrive et repart en filé",
  face: "quelqu'un de près, un visage, filmé en largeur : il se floute avant le dernier flash",
};

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const list = (name) => Array.from({ length: 12 }, (_, k) => mark(name + "_" + k, NaN)).filter(Number.isFinite);
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const cutAt = (k) => (shots[k] ? shots[k].from : durationInFrames + 1);
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const STROBES = list("strobe");
  // Its settings: her shots in colour where the colour counts (or none), her upright video turned upside down (or never),
  // the quarter turn always clockwise (or one way then the other).
  const COLOURS = setting("couleur", "auto") === "aucune" ? [] : list("colour");
  const FLIP = setting("format", "auto") === "droit" ? -1 : mark("flip", -1);
  const BOTH_WAYS = setting("sens", "horaire") === "alterne";
  const FILE_IN = mark("file_in", -1);
  const ZOOM = mark("zoom", -1);
  const ZOOM_IN = Math.max(2, mark("zoom_in", 8));
  const WHIP = mark("whip", -1);
  const BLACK_AT = mark("black", durationInFrames + 1);
  const endAt = end ? end.from : durationInFrames + 1;

  // 1. Its looks, as inline filters. Two tones, as the original's (measured on its 23 shots in two tones): her picture's
  // light mapped to deep blacks, blue-green shadows, green-grey mids and cream highlights, its whites never past
  // #E8E5DA; a natural contrast, never a grey black and white. The strobe's images overexposed before that map (its
  // blacks lifted, its whites still cream). Her shots in colour graded as its colour ones: cool shadows, warm mids,
  // the same cream whites (her colours as she filmed them, never pushed).
  const TONE = [[5, 5, 8], [22, 28, 30], [42, 51, 52], [64, 75, 74], [87, 98, 95], [108, 122, 111], [132, 141, 129], [156, 165, 147], [181, 187, 166], [206, 207, 189], [232, 229, 218]];
  const toneAt = (y) => {
    const x = Math.max(0, Math.min(1, y)) * 10;
    const i = Math.min(9, Math.floor(x));
    return TONE[i].map((v, c) => v + (TONE[i + 1][c] - v) * (x - i));
  };
  const table = (curve, c) => Array.from({ length: 21 }, (_, k) => (toneAt(curve(k / 20))[c] / 255).toFixed(3)).join(" ");
  const luma = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
  const mapped = (id, curve) => h("filter", { key: id, id, x: "0", y: "0", width: "1", height: "1", colorInterpolationFilters: "sRGB" },
    h("feColorMatrix", { type: "matrix", values: luma }),
    h("feComponentTransfer", null, ["R", "G", "B"].map((c, i) => h("feFunc" + c, { key: c, type: "table", tableValues: table(curve, i) }))));
  // 7. Its lens edges, at the top and the bottom of the frame (the sides of her shot before its quarter turn, as an
  // anamorphic lens): the picture streaked along the height and split green and magenta, the magenta outward (6 px
  // apart at the top, 5 at the bottom, as the original's near its edges at 1080).
  const edgeFilter = (id, out) => h("filter", { key: id, id, colorInterpolationFilters: "sRGB" },
    h("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "0 2", result: "streak" }),
    h("feColorMatrix", { in: "streak", type: "matrix", values: "1 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0", result: "magenta" }),
    h("feOffset", { in: "magenta", dx: 0, dy: out, result: "m" }),
    h("feColorMatrix", { in: "streak", type: "matrix", values: "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0", result: "green" }),
    h("feOffset", { in: "green", dx: 0, dy: -out, result: "g" }),
    h("feBlend", { in: "m", in2: "g", mode: "screen" }));
  const defs = h("svg", { key: "defs", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
    h("defs", null,
      mapped("tourne-duo", (y) => y),
      mapped("tourne-lit", (y) => 1 - Math.pow(1 - y, 3)),
      h("filter", { key: "c", id: "tourne-colour", x: "0", y: "0", width: "1", height: "1", colorInterpolationFilters: "sRGB" },
        h("feComponentTransfer", null,
          h("feFuncR", { type: "table", tableValues: "0.02 0.235 0.515 0.765 0.905" }),
          h("feFuncG", { type: "table", tableValues: "0.02 0.245 0.5 0.74 0.885" }),
          h("feFuncB", { type: "table", tableValues: "0.04 0.27 0.48 0.69 0.835" }))),
      h("filter", { key: "s", id: "tourne-streak", x: "0", y: "-0.2", width: "1", height: "1.4", colorInterpolationFilters: "sRGB" },
        h("feGaussianBlur", { stdDeviation: "0 46" })),
      edgeFilter("tourne-edge-top", -3),
      edgeFilter("tourne-edge-bottom", 2.5)));

  // 1. Every shot filmed in width turned a quarter, clockwise (the top of the scene on the right of the screen), whole:
  // a 16:9 video turned fills the vertical frame exactly; it never turns while it plays. A video filmed upright plays
  // upright, but the one its slot asks for (a silhouette on the sky, someone hanging, a reflection) a half turn.
  const wideOf = (s) => (Number(s && s.aspect) || 1.78) > 1.15;
  const drawn = (i) => {
    const s = shots[i];
    if (!s) return null;
    const draw = (size) => h(Footage, { shot: i, style: { position: "absolute", left: 0, top: 0, width: size.width, height: size.height } });
    if (wideOf(s)) return h(Turn, { angle: BOTH_WAYS && i % 2 ? -90 : 90, draw });
    return h("div", { style: { ...full, ...(i === FLIP ? { transform: "rotate(180deg)" } : {}) } }, draw({ width, height }));
  };

  // 4. The passage blur, copies of the shot blurred, not fades ([the slot it leads into, the blur (px) of the outgoing
  // shot's last images, then of the incoming one's first]): into the close detail of the calm, into the white flash of
  // the calm, into the last flash (its first image under the flash, its second still blurred).
  const SOFT = [[mark("soft_0", -9), [2, 5, 13, 14], [10]], [mark("soft_1", -9), [16, 16], []], [mark("soft_2", -9), [5, 12, 20, 20, 21], [0, 12]]];
  const blurOf = (i) => {
    let px = 0;
    SOFT.forEach(([k, before, after]) => {
      const c = cutAt(k);
      if (i === k - 1 && frame < c && frame >= c - before.length) px = before[before.length - (c - frame)];
      if (i === k && frame >= c && frame - c < after.length) px = after[frame - c];
    });
    return px;
  };
  // Its three white flashes, on the first images of a shot: not a pure white (the next shot barely shows through), the
  // shot under them overexposed.
  const FLASHES = [[mark("flash_0", -9), 2, "rgba(250,248,251,0.9)"], [mark("flash_1", -9), 1, "rgba(232,234,237,0.74)"], [mark("flash_2", -9), 1, "rgba(250,248,251,0.9)"]];
  const flashing = FLASHES.filter(([k, length]) => k >= 1 && k < n && frame >= cutAt(k) && frame < cutAt(k) + length);

  // 5. Its punch zoom in one shot: its first image wide, then ×2,3 about the middle over eight images (×1,06, ×1,2,
  // ×1,41… as the original's), a zoom blur while it rushes, then the close shot held.
  const zoomAt = (t) => { const x = Math.max(0, Math.min(1, t / ZOOM_IN)); return 1 + 1.3 * x * x * (3 - 2 * x); };
  const picture = (i) => {
    const px = blurOf(i);
    const lit = flashing.some(([k]) => k === i);
    const tone = COLOURS.includes(i) ? "url(#tourne-colour)" : STROBES.includes(frame) ? "url(#tourne-lit)" : "url(#tourne-duo)";
    const filter = [tone, lit ? "brightness(1.6)" : "", px ? "blur(" + px + "px)" : ""].filter(Boolean).join(" ");
    let body = drawn(i);
    if (i === ZOOM && shots[i]) {
      const t = frame - cutAt(i);
      const s = zoomAt(t);
      const smear = Math.min(0.2, (s - zoomAt(t - 1)) / s);
      const scaled = (k, z) => h("div", { key: "z" + k, style: { ...full, transform: "scale(" + z.toFixed(4) + ")", transformOrigin: "50% 50%", ...(k ? { opacity: 0.3 } : {}) } }, drawn(i));
      body = smear > 0.005 ? h(React.Fragment, null, [0, 1, 2, 3].map((k) => scaled(k, s * (1 + (smear * k) / 3)))) : s > 1 ? scaled(0, s) : body;
    }
    // A blurred shot a little larger, so its edges stay off the frame.
    return h("div", { key: "p" + i, style: { ...full, overflow: "hidden", filter, ...(px ? { transform: "scale(" + (1 + (3 * px) / width).toFixed(3) + ")" } : {}) } }, body);
  };

  // 5. A filé: her shot smeared along the frame's height and sliding, as a camera swept fast: the opening's, over all
  // its images; its burst's whip, its first image and its last four, then a hard cut. Enlarged 1,3 times, it slides an
  // eighth of the height at most, so it always covers the frame.
  const filed = (i, p, way) => h("div", { key: "f" + i, style: { ...full, overflow: "hidden" } },
    h("div", { style: { ...full, transform: "translateY(" + Math.round(way * Math.max(0, Math.min(1, p)) * height * 0.12) + "px) scale(1.3)", filter: "url(#tourne-streak)" } }, picture(i)));

  // 2 and 3. Her shots, turned, cut on its beats (the strobe over the opening, the filés, the zoom, the blurs), black
  // after the last one when the Reel ends on a card.
  const film = (() => {
    if (!n || frame >= BLACK_AT) return null;
    const c = cutAt(cur);
    const next = cutAt(cur + 1);
    if (cur === FILE_IN) return filed(cur, (frame - c + 0.5) / Math.max(1, next - c), -1);
    if (cur === WHIP && cur + 1 < n && (frame === c || frame >= next - 4)) return filed(cur, frame === c ? 0.4 : (frame - next + 5) / 4, 1);
    return picture(cur);
  })();
  // Its lens edges over her shots in two tones (laid after the tones: a grey picture has no colour to split), from the
  // edge of the frame fading out by a quarter of its height; the middle stays sharp. Its outermost 8 px left to the
  // shot itself (a copy shifted inward leaves a bare line there).
  const BAND = Math.round(height * 0.25);
  const fade = (side) => "linear-gradient(" + (side === "top" ? "to bottom" : "to top") + ", transparent 0px, #000 8px, #000 32%, transparent 100%)";
  const edge = (side) => film && !COLOURS.includes(cur)
    ? h("div", { key: "e" + side, style: { position: "absolute", left: 0, top: side === "top" ? 0 : height - BAND, width, height: BAND, overflow: "hidden", filter: "url(#tourne-edge-" + side + ")", WebkitMaskImage: fade(side), maskImage: fade(side) } },
        h("div", { style: { position: "absolute", left: 0, top: side === "top" ? 0 : BAND - height, width, height } }, film))
    : null;
  const flashes = flashing.map(([k, length, colour]) => h(Flash, { key: "w" + k, at: cutAt(k), frames: length, color: colour }));

  // Its optional title (the original has no text): turned a quarter like the shots, in condensed cream capitals along
  // the middle of the frame, reading as the turned scene does; its size follows its length.
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const display = "'" + brand.displayFont + "', 'Big Shoulders Display', 'Oswald', 'Arial Narrow', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter', sans-serif";
  const CREAM = "#E8E5DA";
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const shade = "0 0 2px rgba(0,0,0,0.55), 0 1px 5px rgba(0,0,0,0.4), 0 2px 18px rgba(0,0,0,0.32)";
  const titleSize = hook ? Math.min(240, Math.max(110, Math.round(3900 / Math.max(6, Array.from(hook.text).length)))) : 240;
  const title = hook && frame >= hook.from && frame < Math.min(hook.to, endAt, BLACK_AT)
    ? h(FitText, { style: { position: "absolute", left: Math.round(width / 2 - 620), top: 760 - 130, width: 1240, height: 260, transform: "rotate(90deg)", transformOrigin: "50% 50%" }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: titleSize, lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", color: CREAM, whiteSpace: "nowrap", textShadow: shade } }, hook.text)
    : null;

  // Any other text of the Reel (none in its slots): a plain cream line, upright, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < Math.min(endAt, BLACK_AT)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1220 - i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: CREAM, textAlign: "center", textShadow: shade } }, keep(t.text)));

  // 8. Her ending card, only when she has one (the original ends on its shot): upright on the black after the last
  // shot, its title in the condensed capitals, a line under it, in the cream of its whites.
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 690 : 770, width: width - 280, height: 300 }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 170, lineHeight: 0.98, letterSpacing: "0.01em", textTransform: "uppercase", color: CREAM, textAlign: "center", textWrap: "balance", justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", { style: { display: "inline-block", opacity: o(endAt, endAt + 5) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1014, width: width - 280, height: 160 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 400, fontSize: 50, lineHeight: 1.22, letterSpacing: "0.02em", color: CREAM, textAlign: "center", textWrap: "balance" } },
              h("span", { style: { display: "inline-block", opacity: o(endAt + 5, endAt + 12) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, defs, film, edge("top"), edge("bottom"), ...flashes, title, extra, ending);
}`;

export const tourne: MontageSkill = {
  key: "tourne",
  // 2: written again on its original's fiche: its tempo (118,3) and cuts, its quarter turn always clockwise and its
  // upright video upside down, its strobe, its filés, its punch zoom, its passage blurs and white flashes, its two tones
  // with five shots left in colour, its lens edges, its music muffled before and after its burst with its roll and its
  // two hits, its last shot held, no title of its own, no grain nor dark corners.
  version: 2,
  bpm: BPM,
  shots: [20, 28],
  files: [6, 16],
  how: "Tous ses plans filmés en largeur tournés d'un quart de tour, toujours dans le sens des aiguilles d'une montre, pour remplir l'écran en entier, en deux tons bleu-vert et crème, la couleur gardée sur cinq plans où elle compte : quatre plans qui filent sous un stroboscope ; sept plans d'une à deux secondes sur une musique étouffée, les deux premiers en couleur, une vidéo debout retournée la tête en bas, un flou de passage, un plan en couleur qui se floute dans un flash blanc ; puis, quand la musique s'ouvre, une rafale de seize plans sur le rythme avec un zoom coup de poing, un flash, deux plans en couleur, quelque chose qui tourne, un filé, et le dernier qui se floute dans un dernier flash ; le dernier plan tenu jusqu'à la fin, la musique coupée avec l'image. Sans texte, avec des bords d'objectif en haut et en bas.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "facultatif : un titre court tourné d'un quart de tour comme les plans, en capitales le long de l'écran (son lieu, sa ville, son métier), seulement quand le Reel a besoin de mots",
      max: 16,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "comment ses vidéos debout sont prises (celles en largeur sont toujours tournées d'un quart de tour, l'écran rempli en vertical)",
      choices: [
        { value: "auto", says: "comme l'original : sa vidéo debout qui se lit à l'envers (une silhouette sur le ciel) retournée d'un demi-tour, les autres droites" },
        { value: "droit", says: "ses vidéos debout toujours droites, jamais retournées" },
      ],
    },
    {
      name: "sens",
      want: "le sens du quart de tour",
      choices: [
        { value: "horaire", says: "toujours dans le sens des aiguilles d'une montre, comme l'original" },
        { value: "alterne", says: "un plan dans un sens, le suivant dans l'autre" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur",
      choices: [
        { value: "auto", says: "comme l'original : deux tons bleu-vert et crème, la couleur gardée sur cinq plans où elle compte" },
        { value: "aucune", says: "tout en deux tons, aucun plan en couleur" },
      ],
    },
  ],
  // Its code draws its two tones, its colour shots and its contrast itself; its original has neither grain nor dark
  // corners (its fiche, effect 9): nothing of its model's finish is laid over the Reel (it would grey its colour shots).
  finish: { exposure: 0, contrast: 0, saturation: 0, warmth: 0, split: 0, grain: 0, vignette: 0, fade: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(20, Math.min(28, n));
    const burst = burstFor(count - OPENING.length - CALM.length - 1);
    // The last shot is held; with an ending card, the black after it carries the card: two beats, and always the
    // engine's 1,6 s (on the quarter-beat grid, rounded up, so a frame lost to rounding never cuts into it).
    const card = end ? Math.max(2, Math.ceil(((END_CARD + 0.05) / beat) * 4) / 4) : 0;
    const spans = beatSpans(bpm, [...OPENING, ...CALM, ...burst.map((b) => b.q / 4), LAST + card]);
    const duration = spans.at(-1)!.end;
    const at = (i: number) => spans[i]!.start;
    const from = OPENING.length + CALM.length;
    const last = spans.length - 1;
    const slot = (role: Role) => from + burst.findIndex((b) => b.role === role);
    const colours = [...CALM_COLOUR, ...burst.flatMap((b, k) => (b.role === "colour" ? [from + k] : []))];
    const wants = [
      "le plan qui ouvre, un cinquième de seconde : la route jusqu'à chez elle vue d'une voiture ou d'un vélo, filmée en largeur (tournée d'un quart de tour, elle clignote)",
      "un véhicule qui passe ou qu'on suit (sa livraison, un bus, un vélo), filmé en largeur, très bref",
      "un balayage rapide filmé en largeur (la caméra qui balaie vite une rue, une vitrine) : il passe en filé ; sinon une matière",
      "une matière qui défile vite, filmée en largeur en marchant (un mur, une étagère de bocaux, une façade)",
      "un plan large et beau où la couleur compte, filmé en largeur et tenu deux secondes (la mer, un coucher de soleil, un mur peint, ses fleurs) : il reste en couleur",
      "un autre plan en couleur, filmé en largeur : des gens au bord de l'eau ou dans son lieu, ses plats, ses fruits",
      "une vidéo debout qui se lit à l'envers (une silhouette sur le ciel, quelqu'un en suspension, un reflet, une vue d'en haut) : elle est retournée la tête en bas ; sinon un plan large en largeur avec quelqu'un au loin",
      "une matière ou un détail en très gros plan, filmé en largeur (du bois, un tissu, une pâte, des épines)",
      "un plan large en couleur filmé en largeur, tenu deux secondes (la plage, une dune, sa rue au soleil, un horizon) : il se floute dans un flash blanc",
      "quelqu'un debout devant son lieu ou un monument, filmé en largeur, calme (il arrive par le flash blanc)",
      "un plan sombre et calme filmé en largeur, juste avant la rafale (un poisson, une bougie, une vitrine la nuit)",
      ...burst.map((b) => BURST_WANTS[b.role]),
      "le plan qui finit, tenu deux secondes jusqu'au bout : quelqu'un de dos, les bras levés devant son lieu ou un monument du quartier (elle, son équipe), filmé en largeur",
    ];
    const hit = (s: number, gain = 0): SkillSound => ({ at: round3(s), ...HIT, ...(gain ? { gain } : {}) });
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its optional title: over the opening and the first colour shot, gone on the cut to the second one.
      texts: { titre: { from: 0, to: at(5) } },
      // Its music muffled on its pad (as through a wall), open at once on the burst's first image, muffled again from
      // the last flash, and cut dead with the picture, as the original's: three bars of pad, two of beat, one of pad.
      music: {
        filters: [
          { kind: "muffled", from: 0, to: at(from) },
          { kind: "muffled", from: at(last), to: duration },
        ],
        end: { at: duration },
      },
      // The original's own sounds over that pad: its rising roll under the strobe, its two big hits on the cuts to the
      // second and the third shot of the calm, the second the loudest of the piece.
      sounds: [{ at: round3(ROLL_AT * beat), ...ROLL, gain: -2 }, hit(at(5)), hit(at(6), 4)],
      marks: {
        ...Object.fromEntries(STROBE.map((b, k) => [`strobe_${k}`, toFrame(b * beat)])),
        ...Object.fromEntries(colours.map((s, k) => [`colour_${k}`, s])),
        flip: FLIP,
        file_in: FILE_IN,
        zoom: slot("zoom"),
        zoom_in: Math.max(2, Math.round(ZOOM_IN * beat * 30)),
        whip: slot("whip"),
        // The slots whose first images flash: the calm's man, the burst's third, the last one.
        flash_0: FLASH_CALM,
        flash_1: slot("flash"),
        flash_2: last,
        // The slots the passage blurs lead into: the close detail of the calm, the man, the last one.
        soft_0: SOFT_CALM,
        soft_1: FLASH_CALM,
        soft_2: last,
        ...(end ? { black: toFrame(round(duration - card * beat)) } : {}),
      },
    };
  },
  code: CODE,
};
