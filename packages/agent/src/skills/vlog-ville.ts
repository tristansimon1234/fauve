import { toFrame, type MontageSkill } from "../skills.ts";

// « Ta ville racontée », version 1, written on its original's fiche (docs/fiches/vlog-ville.md: a city film of 41,8 s in
// 4:3, measured image by image at 30 i/s, its subtitles read frame by frame, its sound by bands; Tristan: « c'est un
// effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A short film of her place in its city, told
// in small subtitles (a voice tells the original: a voice laid over the model fits, see below), cut by ear on what is
// said rather than on the beat of its music (76 BPM). Every moment below is in images of the original at its own tempo
// (an image is 1/30 s at 76 BPM, so 0,0422 of a beat): its cuts fall on the original's within an image, and follow any
// other tempo. Its film:
//   0 – 79      a wide calm shot, her still in the middle, its own sound: her first sentence comes one word at a time
//               (« Every / city / has / a / pace »), then « this / is / London. », in small white lowercase subtitles;
//               no music yet;
//   79 – 115    the music drops on her name: nine close-ups of one detail-rich shot, two and three images each, then the
//               same shot swept (a whip);
//   115 – 257   something passing fast, a perspective, a hand; then her from behind, still, while the world moves on: half a
//               second in, her name in big red capitals between quotes, her signature small above it, « un court-métrage. »
//               under it, the subtitles silent and the music muffled for 1,3 s, until the voice comes back under it;
//   257 – 737   her city moving: her calm, a texture, people moving, crowds, people passing, a big place; a lively street,
//               then a burst of night lights and signs (2 to 6 images each); her gesture, someone at work, a sign and a
//               whip, something arriving, her waiting (a dark breath, the perspective again), the title's place again;
//   737 – 805   a burst that recalls the shots already seen (the signs, the dark breath, the first burst's close-ups in
//               their order), then the texture again;
//   805 – 1255  « or slow down »: calm shots of her looking, seated, standing; looking up (swept as it turns, one white
//               image); the opening's place again, her gesture again, the title's place again, her at night, walking,
//               the dark breath; the last shot as the title's, the world slower, on the last sentence: the loop.
// Played as the original, a horizontal 4:3 picture on black, when most of her files are horizontal (or she asks), else
// full frame (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »). Fewer shots leave
// out shots of its middle, each one's time given to a neighbour: its sections, its words and its moments stay where the
// original has them. A photo stays still, a video plays. Nothing of the original's own: its city's name is her place's,
// the filmmaker's signature hers, its words hers.
// A voice laid over it (her voice or Edith's, chantier B): its words, as the engine times them (`spoken`), are written by
// its code in its own subtitles' row, in their style (its first phrase word by word, then a phrase at a time), its
// lines staying only where nothing is said; the engine's subtitles step aside.

const BPM = 76;
/**
 * The original's shots by what each one does in its film (its « roles »), each one's end in images of the original at
 * 30 i/s: its cuts measured image by image, the bursts' pieces and the recalls drawn by its code inside them.
 */
const ROLE_ENDS = [79, 115, 136, 160, 184, 257, 314, 328, 350, 374, 408, 459, 519, 537, 559, 581, 608, 633, 646, 709, 805, 848, 876, 897, 948, 1001, 1067, 1111, 1125, 1171, 1255];
/** What each role wants, for the filler (French). */
const WANTS = [
  "le plan qui ouvre, large et calme, 2,6 s : sa rue, son quartier ou son lieu, et elle (ou quelqu'un) immobile au milieu pendant que la vie passe autour ; ses premiers mots y arrivent un à un, son propre son dessous",
  "un gros plan d'une chose pleine de détails, de près : sa carte ou son ardoise, une étagère de produits, un plan du quartier, une vitrine, un mur d'affiches ; il éclate en neuf gros plans quand la musique tombe, puis file",
  "quelque chose qui passe vite tout près de l'objectif : un bus, un tram, un vélo, des passants (0,7 s)",
  "une perspective : une allée, un couloir, son lieu vu depuis la porte, un comptoir en enfilade",
  "un gros plan de sa main sur quelque chose : une tasse, une poignée, un outil, une rampe",
  "elle (ou quelqu'un) de dos, immobile au milieu de l'image, devant quelque chose qui bouge (sa rue, une vitrine, des passants, un tram), 2,4 s : le titre s'y pose en grand",
  "elle dans sa ville, calme, le monde qui bouge derrière (en terrasse, à vélo, dans un bus, sur un pont), 1,9 s",
  "une matière qui bouge, vive : de l'eau, de la vapeur, de la mousse, un reflet (0,5 s)",
  "des gens en mouvement : un escalier, des pas, une file qui avance",
  "du monde vu d'en haut ou de loin : une place, un marché, une terrasse pleine",
  "encore du monde, sous un autre angle",
  "des passants qui traversent l'image devant elle ou devant son lieu, caméra posée (1,7 s)",
  "un grand plan de l'endroit, en contre-plongée ou en perspective : une façade, une verrière, un plafond, une rue (2 s)",
  "une rue animée avec ses lumières ou ses décorations (guirlandes, lanternes, enseignes), des gens qui passent",
  "une enseigne, un néon ou une lumière de la ville, de près (elle revient en éclairs)",
  "un autre détail lumineux de près : un feu, une vitrine éclairée, une lampe, des phares",
  "elle assise qui mange, boit ou fait son geste (un café, une bouchée), de près",
  "quelqu'un au travail : derrière le comptoir, en cuisine, à l'atelier",
  "quelque chose qui arrive : un bus, un tram, une porte qui s'ouvre, quelqu'un qui entre",
  "elle assise qui attend ou regarde ailleurs, calme",
  "le même endroit que le plan du titre, à un autre moment (la même vidéo plus loin, ou un autre plan d'elle de dos) ; une rafale y rappelle ensuite les plans déjà vus",
  "elle qui lève les yeux, de profil, calme",
  "elle assise de dos devant l'eau, la rue ou la vue",
  "elle debout de dos qui regarde au loin (une rambarde, une fenêtre, un pont)",
  "en contre-plongée vers le haut : des immeubles, une façade, des arbres, le ciel (1,7 s)",
  "le lieu du premier plan à un autre moment (la même vidéo plus loin), calme",
  "elle et son geste à un autre moment (la même vidéo plus loin)",
  "le plan du titre à un autre moment : elle de dos, immobile, tout qui passe",
  "elle le soir devant des lumières, en silhouette (0,5 s)",
  "elle qui marche vers la caméra, ou qu'on suit (1,5 s)",
  "le dernier plan, comme celui du titre : elle de dos, immobile, le monde qui passe plus lentement, 2 s ; la dernière phrase s'y pose",
];
/**
 * Left out first when her files give fewer shots, in this order, each one's time given to the shot before it (−1) or
 * after it (1), so that each part of its film keeps shots of about its length (18 at least: none over 3,7 s): never its
 * opening, its burst, its passing, its title, her calm, its crowd, its place, its lively street, its light, her waiting,
 * the title's place again, her looking, looking up, the end's four.
 */
const DROP: [number, -1 | 1][] = [
  [10, -1],
  [7, -1],
  [28, 1],
  [22, -1],
  [15, -1],
  [3, -1],
  [18, 1],
  [27, -1],
  [23, -1],
  [4, -1],
  [8, 1],
  [17, -1],
  [16, -1],
];
const MOST = ROLE_ENDS.length;
const FEWEST = MOST - DROP.length;
/** Its words' moments, in the original's images: its subtitles as they change on its voice, its title. */
const LINES: [string, number, number][] = [
  ["accroche", 18, 53],
  ["ici", 53, 101],
  ["l1", 101, 166],
  ["l2", 166, 199],
  ["l3", 238, 323],
  ["l4", 323, 390],
  ["l5", 390, 477],
  ["l6", 477, 519],
  ["l7", 519, 601],
  ["l8", 601, 723],
  ["l9", 723, 805],
  ["l10", 805, 872],
  ["l11", 872, 948],
  ["l12", 948, 1067],
  ["l13", 1067, 1171],
  ["l14", 1171, 1255],
];
/** Its title, half a second into its shot, to its cut. */
const TITLE: [number, number] = [199, 257];
/** The music: none until it drops on her name (image 79), muffled under the title (194 to 238). */
const DROP_AT = 79;
const MUFFLED: [number, number] = [194, 238];
/** The engine's ending card: the Reel's last 1,6 s. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its shots for n of hers: each one's role and its span in the original's images, the roles left out given to a neighbour. */
export function vlogRoles(n: number): { role: number; from: number; to: number }[] {
  const count = Math.max(FEWEST, Math.min(MOST, Math.round(n)));
  const out = new Map(DROP.slice(0, MOST - count));
  const kept: { role: number; from: number; to: number }[] = [];
  let pending: number | null = null;
  ROLE_ENDS.forEach((to, role) => {
    const from = role ? ROLE_ENDS[role - 1]! : 0;
    const into = out.get(role);
    if (into === -1) {
      kept[kept.length - 1]!.to = to;
      return;
    }
    if (into === 1) {
      pending ??= from;
      return;
    }
    kept.push({ role, from: pending ?? from, to });
    pending = null;
  });
  return kept;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, spoken }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  // Its moments are in images of the original (30 a second at its own tempo): one of them is SC images here.
  const SC = Math.max(0.5, Math.min(2, mark("sc", 1)));
  const F = (f) => Math.round(f * SC);
  const endAt = end ? end.from : durationInFrames + 1;

  // 1. Its frame: a 4:3 picture on black, as the original, when most of her shots are horizontal (or she asks), else
  // the whole vertical frame; every place below is in it.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const band = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const BW = width;
  const BH = band ? Math.round((width * 3) / 4) : height;
  const BY = band ? Math.round((height - BH) / 2) : 0;
  const box = { position: "absolute", left: 0, top: 0, width: BW, height: BH };

  // 2. Each of her shots plays one of the original's roles (r0, r1…), and a role's shot stands in for one left out.
  const role = {};
  for (let i = 0; i < n; i++) role[Math.round(mark("r" + i, i))] = i;
  const of = (...rs) => { for (const r of rs) if (role[r] !== undefined) return role[r]; return 0; };
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const len = (i) => Math.max(1, shots[i] ? shots[i].durationInFrames : 1);
  // One of her shots in its frame as it plays, or from at (shown again from that frame).
  const shot = (i, extra, at, key) => h(Footage, { key: key || "f" + i, shot: i, style: { ...box, ...(extra || {}) }, ...(at === undefined ? {} : { at }) });
  // A shot already seen, played again from a share of its passage.
  const again = (i, start, share, extra, key) => shot(i, extra, start - Math.round(share * (len(i) - 1)), key);
  // A swept image: blurred along its way and sliding, enlarged so it covers (its filter's id this image's).
  const sweep = (node, key, upright, p) => {
    const id = "vv-" + key + "-" + frame;
    const shift = Math.round((p - 0.5) * 0.16 * (upright ? BH : BW));
    return h("div", { key, style: { ...box, overflow: "hidden" } },
      h("svg", { width: 0, height: 0, style: { position: "absolute" } },
        h("filter", { id, x: "-20%", y: "-20%", width: "140%", height: "140%", colorInterpolationFilters: "sRGB" }, h("feGaussianBlur", { stdDeviation: upright ? "0 34" : "34 0" }))),
      h("div", { style: { ...box, transform: (upright ? "translateY(" : "translateX(") + shift + "px) scale(1.25)", filter: "url(#" + id + ")" } }, node));
  };
  // A close-up of her detail shot, framed on one part of it (the original's nine close-ups of one map).
  const SPOTS = [[22, 30], [74, 62], [40, 78], [80, 22], [30, 60], [62, 36], [16, 80], [86, 78], [50, 50]];
  const RUN = [2, 3, 2, 3, 2, 3, 2, 3, 2];
  const close = (i, k, at, key) => h("div", { key, style: { ...box, overflow: "hidden" } }, shot(i, { transform: "scale(1.75)", transformOrigin: SPOTS[k][0] + "% " + SPOTS[k][1] + "%" }, at));
  const DET = of(1);
  const runStart = (k) => F(79 + RUN.slice(0, k).reduce((a, b) => a + b, 0));

  // 3. What plays at each moment besides her shot as filmed, in the original's images: the bursts, the sweeps, the dark
  // breaths (her passing shot played again, dark and swept), the recalls, the spin and the white image.
  const A = of(14, 15, 13), B = of(15, 14, 13), R = of(13), P = of(2), V = of(3, 2), M = of(7, 6), Wt = of(19, 16);
  // A burst's pieces: [images of the original, shot, the share of it played from, how: "" as filmed, s swept, d dark, c close-up].
  const NIGHT = [[2, A, 0.1], [3, B, 0.1], [2, A, 0.45], [4, R, 0.3], [4, B, 0.5, "s"], [2, A, 0.7], [3, B, 0.75], [6, R, 0.6, "s"], [3, A, 0.85, "s"], [5, R, 0.85], [5, B, 0.9], [5, A, 0.95]];
  const RECALL = [[4, R, 0.2], [2, A, 0.2], [3, B, 0.2], [5, A, 0.5], [2, A, 0.1], [3, R, 0.6, "s"], [2, B, 0.6], [5, P, 0.4, "d"]]
    .concat(RUN.slice(0, 8).map((l, k) => [l, DET, 0, "c" + k]), [[3, V, 0.4], [2, P, 0.7, "d"], [3, A, 0.8, "s"]]);
  const EVENTS = [
    [79, 101, "burst"], [101, 115, "sweep", DET], [345, 350, "dark", P], [537, 581, NIGHT], [616, 618, "again", A, 0.3], [618, 633, "sweep", R],
    [673, 689, "dark", P], [689, 709, "again", V, 0.2], [737, 791, RECALL], [791, 805, "again", M, 0.3], [910, 920, "spin"], [930, 931, "white"],
    [1001, 1026, "again", Wt, 0.3], [1171, 1197, "dark", P],
  ];
  const DARK = { filter: "brightness(0.3) contrast(1.2)" };
  const piece = (src, start, share, how, key, p) => {
    if (how && how[0] === "c") {
      const k = Number(how.slice(1));
      return close(src, k, frame - (runStart(k) - shots[src].from), key);
    }
    const node = src === cur && share === 0 ? shot(cur) : again(src, start, share, how === "d" ? DARK : null, key + "-a");
    return how === "s" || how === "d" ? sweep(node, key, false, p) : node;
  };
  const picture = (() => {
    const ev = EVENTS.find((e) => frame >= F(e[0]) && frame < F(e[1]));
    if (!ev || !n) return n ? shot(cur) : null;
    const a = F(ev[0]);
    const p = (frame - a + 0.5) / Math.max(1, F(ev[1]) - a);
    if (Array.isArray(ev[2])) {
      let at = ev[0];
      for (let k = 0; k < ev[2].length; k++) {
        const q = ev[2][k];
        const b = at + q[0];
        if (frame < F(b)) return piece(q[1], F(at), q[2], q[3] || "", "b" + k, (frame - F(at) + 0.5) / Math.max(1, F(b) - F(at)));
        at = b;
      }
      return shot(cur);
    }
    if (ev[2] === "burst") {
      let k = 0;
      while (k < 8 && frame >= runStart(k + 1)) k++;
      return close(DET, k, undefined, "burst");
    }
    if (ev[2] === "sweep") return sweep(ev[3] === cur ? shot(cur) : again(ev[3], a, 0.4, null, "sw-a"), "sw", false, p);
    if (ev[2] === "dark") return sweep(again(ev[3], a, 0.5, DARK, "dk-a"), "dk", false, p);
    if (ev[2] === "again") return again(ev[3], a, ev[4], null, "ag");
    if (ev[2] === "spin") return sweep(shot(cur), "spin", true, p);
    // One image burnt almost white, the picture still in it (a camera's flash three times as strong, never a white card).
    return [shot(cur), h(Flash, { key: "white", at: [a], frames: 1, before: 0, expose: 3 })];
  })();

  // 4. Its words: her sentences as small white subtitles at the bottom of its picture (the original's row, safe for the
  // apps' buttons), her first two word by word; a voice laid over it is written there instead, where it speaks.
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0").replace(/ ([:;!?»])/g, "\u00a0$1");
  const hook = reelTexts.find((t) => t.role === "hook");
  const caps = reelTexts.filter((t) => t.role === "caption");
  const bands = reelTexts.filter((t) => t.role === "band");
  const said = (Array.isArray(spoken) ? spoken : []).filter((w) => w && typeof w.w === "string" && Number.isFinite(w.from)).sort((a, b) => a.from - b.from);
  const phrases = [];
  said.forEach((w, k) => {
    const p = phrases[phrases.length - 1];
    const prev = said[k - 1];
    const text = p ? p.map((x) => x.w).join(" ") + " " + w.w : "";
    // A phrase ends on a pause (0,3 s), a full stop, a comma after three words, at six words or 30 characters.
    if (p && prev && w.from - (Number.isFinite(prev.to) ? prev.to : prev.from) < 9 && !/[.!?;:…]$/.test(prev.w) && !(/,$/.test(prev.w) && p.length >= 3) && p.length < 6 && text.length <= 30) p.push(w);
    else phrases.push([w]);
  });
  const voiced = (() => {
    for (let j = 0; j < phrases.length; j++) {
      const p = phrases[j];
      const last = p[p.length - 1];
      const to = Math.min(endAt, phrases[j + 1] ? phrases[j + 1][0].from : (Number.isFinite(last.to) ? last.to : last.from) + 15);
      if (frame < p[0].from || frame >= to) continue;
      if (j > 0) return p.map((x) => x.w).join(" ");
      const w = p.filter((x) => x.from <= frame).pop();
      return w ? w.w : null;
    }
    return null;
  })();
  const heard = (t) => said.some((w) => w.from >= t.from && w.from < t.to);
  // A sentence word by word over its moment, each word as long as it is, its last one held longer (the original's « pace »).
  const oneByOne = (t, hold) => {
    const words = String(t.text).split(/\s+/).filter(Boolean);
    const weights = words.map((w, k) => (w.length + 2) * (k === words.length - 1 ? hold : 1));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let at = t.from;
    for (let k = 0; k < words.length; k++) {
      at += ((t.to - t.from) * weights[k]) / total;
      if (frame < at) return words[k];
    }
    return words[words.length - 1] || "";
  };
  const shown = (t) => t && frame >= t.from && frame < Math.min(t.to, endAt) && !heard(t);
  const line = shown(hook) ? oneByOne(hook, 2.5) : shown(caps[0]) ? oneByOne(caps[0], 3) : (caps.slice(1).find(shown) || {}).text;
  const words = voiced !== null && voiced !== undefined ? voiced : line;
  const ROW = band ? BY + Math.round(BH * 0.955) : Math.round(height * 0.7);
  const subtitle = words
    ? h("div", { key: "sub", style: { position: "absolute", left: 140, top: ROW - 130, width: 800, height: 130, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" } },
        h("div", { style: { fontFamily: body, fontWeight: 400, fontSize: 48, lineHeight: 1.18, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: "0 1px 2px rgba(0,0,0,0.55)" } }, keep(words)))
    : null;

  // 5. Its title: half a second into her shot from behind, at once, to its cut: her name in big capitals between quotes
  // (the original's extended black face: her title font), her signature small above it, its line in small lowercase
  // under it, all in one colour on her back in the middle: hers when it is vivid enough (« sienne », her charter), else
  // the original's film-title red, which « rouge » keeps whatever her colour.
  const rgb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return null; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const vivid = (c) => { const p = rgb(c); if (!p) return false; const hi = Math.max(p[0], p[1], p[2]); const lo = Math.min(p[0], p[1], p[2]); const l = (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255; return hi > 0 && (hi - lo) / hi > 0.45 && l > 0.1 && l < 0.6; };
  const RED = setting("couleur", "sienne") !== "rouge" && vivid(brand.accent) ? brand.accent : "#d7261e";
  const T = of(5);
  const tFrom = F(${TITLE[0]});
  const tTo = shots[T] ? shots[T].from + shots[T].durationInFrames : F(${TITLE[1]});
  const CY = band ? BY + Math.round(BH * 0.48) : Math.round(height * 0.46);
  const NH = Math.round(BW * 0.1125);
  const card = Boolean(end) && frame >= endAt;
  const titled = (card || (frame >= tFrom && frame < tTo && frame < endAt)) && bands[0];
  const quoted = (s) => "”" + String(s || "").trim() + "”";
  const title = titled
    ? h("div", { key: "title" },
        h(FitText, { key: "n-" + bands[0].text, style: { position: "absolute", left: 140, top: CY - Math.round(NH / 2), width: 800, height: NH }, innerStyle: { fontFamily: display, fontWeight: 900, fontSize: 108, lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", whiteSpace: "nowrap", color: RED } }, quoted(bands[0].text)),
        !card && bands[1] ? h(FitText, { key: "s-" + bands[1].text, style: { position: "absolute", left: 140, top: CY - Math.round(NH / 2) - 66, width: 800, height: 52 }, innerStyle: { fontFamily: display, fontWeight: 900, fontSize: 42, lineHeight: 1, textTransform: "uppercase", whiteSpace: "nowrap", color: RED } }, h("span", { "data-fauve-accent": "" }, keep(bands[1].text))) : null,
        !card && bands[2] ? h(FitText, { key: "g-" + bands[2].text, style: { position: "absolute", left: 140, top: CY + Math.round(NH / 2) + 16, width: 800, height: 40 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 28, lineHeight: 1, whiteSpace: "nowrap", color: RED } }, h("span", { "data-fauve-accent": "" }, keep(bands[2].text))) : null,
        card ? h(FitText, { key: "c-" + end.title, style: { position: "absolute", left: 140, top: CY + Math.round(NH / 2) + 24, width: 800, height: 70 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 52, lineHeight: 1.1, color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.55)" } }, keep(end.title)) : null,
        card && end.subtitle ? h(FitText, { key: "d-" + end.subtitle, style: { position: "absolute", left: 140, top: CY + Math.round(NH / 2) + 104, width: 800, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 400, fontSize: 48, lineHeight: 1.18, color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.55)" } }, keep(end.subtitle)) : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } },
    h("div", { key: "picture", style: { position: "absolute", left: 0, top: BY, width: BW, height: BH, overflow: "hidden" } }, picture),
    title, card ? null : subtitle);
}`;

const SUBTITLE = "une phrase de sous-titre en minuscules, courte (une ligne, deux au plus), comme dite par une voix calme qui raconte son quartier";

export const vlogVille: MontageSkill = {
  key: "vlog-ville",
  version: 1,
  bpm: BPM,
  shots: [FEWEST, MOST],
  files: [6, 16],
  // Its length is its film's (41,8 s at 76 BPM): its tempo moves it, from 35 to 43 s, its card within 45.
  tempo: [74, 90],
  how: "Un court-métrage de son quartier raconté en petits sous-titres : un plan large et calme où ses premiers mots arrivent un à un, la musique qui tombe sur le nom de son lieu avec une rafale de gros plans d'un détail, puis elle de dos, immobile, pendant que tout passe, et le nom en grandes capitales rouges (ou à sa couleur quand elle est vive) entre guillemets, sa signature au-dessus et « un court-métrage. » dessous ; puis sa ville qui bouge (passants, foule, lumières, une rafale de nuit), une rafale qui rappelle les plans déjà vus, des plans calmes quand le texte dit de ralentir, et la fin qui revient au plan du titre. Ses phrases racontent tout du long, en bas de l'image ; en 4:3 sur du noir quand ses vidéos sont horizontales.",
  end: true,
  texts: [
    { slot: "accroche", role: "hook", want: "sa première phrase, qui arrive mot à mot sur le premier plan, en minuscules comme un sous-titre : le rythme ou l'âme de son quartier, de sa ville ou de son lieu (une forme comme « Chaque quartier a son rythme », « Ici, le matin commence tôt ») ; 5 mots au plus", max: 32, required: true },
    { slot: "ici", role: "caption", want: "la deuxième phrase, mot à mot, qui finit sur le nom de son quartier, de sa ville ou de son lieu (une forme comme « voici Belleville. », « ici, c'est la Croix-Rousse. ») : la musique tombe sur son dernier mot ; 4 mots au plus", max: 30, required: true },
    { slot: "nom", role: "band", want: "le titre du court-métrage, en grandes capitales entre guillemets : le nom de son quartier, de sa ville ou de son lieu, comme un titre de film (une forme comme « Belleville », « Croix-Rousse ») ; 1 ou 2 mots, celui que la deuxième phrase dit", max: 14, required: true },
    { slot: "signature", role: "band", want: "sa signature en petit au-dessus du titre, comme celle d'un réalisateur : son nom ou son compte (une forme comme « par Maison Farine », « @cafedesarts ») ; jamais un nom inventé ; 4 mots au plus", max: 20, required: true },
    { slot: "genre", role: "band", want: "la petite ligne sous le titre, en minuscules avec un point : ce que c'est (« un court-métrage. », ou une forme comme « un film de quartier. ») ; 4 mots au plus", max: 22, required: true },
    { slot: "l1", role: "caption", want: `${SUBTITLE} : ce qui le rend différent d'ailleurs ; 8 mots au plus`, max: 40, required: true },
    { slot: "l2", role: "caption", want: `${SUBTITLE} : qu'il va à son propre rythme, juste avant le titre (1,1 s à l'écran) ; 4 mots au plus`, max: 26, required: true },
    { slot: "l3", role: "caption", want: `${SUBTITLE} : ce que ça fait d'y être, ce qu'on y ressent ; 9 mots au plus`, max: 44, required: true },
    { slot: "l4", role: "caption", want: `${SUBTITLE} : une sensation précise (une odeur, un bruit, l'air, la lumière) ; 8 mots au plus`, max: 40, required: true },
    { slot: "l5", role: "caption", want: `${SUBTITLE} : les gens qui passent, le mouvement de la rue ; 9 mots au plus`, max: 44, required: true },
    { slot: "l6", role: "caption", want: `${SUBTITLE} : tout le monde ensemble (1,4 s à l'écran) ; 4 mots au plus`, max: 28, required: true },
    { slot: "l7", role: "caption", want: `${SUBTITLE} : le quartier qui vit, ses lumières ; 6 mots au plus`, max: 36, required: true },
    { slot: "l8", role: "caption", want: `${SUBTITLE} : ce qui respire et circule (les rues, les passants, ce qui arrive) ; 9 mots au plus`, max: 44, required: true },
    { slot: "l9", role: "caption", want: `${SUBTITLE} : tant de mouvement qu'on se laisse emporter… (une rafale de plans passe dessous) ; 9 mots au plus`, max: 44, required: true },
    { slot: "l10", role: "caption", want: `${SUBTITLE} : … ou qu'on ralentit pour en profiter (le tournant : les plans deviennent calmes) ; 7 mots au plus`, max: 40, required: true },
    { slot: "l11", role: "caption", want: `${SUBTITLE} : tout se passe ici, chacun y a quelque chose à faire ; 9 mots au plus`, max: 44, required: true },
    { slot: "l12", role: "caption", want: `${SUBTITLE} : ce qu'on comprend en regardant les autres ; 9 mots au plus`, max: 44, required: true },
    { slot: "l13", role: "caption", want: `${SUBTITLE} : pourquoi on s'y sent chez soi ; 9 mots au plus`, max: 44, required: true },
    { slot: "l14", role: "caption", want: `${SUBTITLE} : la dernière, qui reprend la première (son rythme, son quartier, son nom) et finit par un point ; 9 mots au plus`, max: 44, required: true },
  ],
  settings: [
    {
      name: "format",
      want: "le format : comme ses vidéos, en 4:3 sur du noir comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos : en 4:3 sur du noir quand la plupart sont horizontales, sinon plein écran" },
        { value: "horizontal", says: "en 4:3 sur du noir, comme l'original" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
    {
      name: "couleur",
      want: "la couleur du titre, de sa signature et de sa petite ligne",
      choices: [
        { value: "sienne", says: "sa couleur à elle quand elle est vive (celle de sa charte), sinon le rouge de titre de film de l'original" },
        { value: "rouge", says: "le rouge de titre de film de l'original, quelle que soit sa couleur" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a length she asked for, a music's own): every moment counted in the original's images follows it.
    const bpm = tempo ?? BPM;
    const sc = BPM / bpm;
    const at = (f: number) => Math.round(f * sc) / 30;
    const kept = vlogRoles(n);
    const last = kept.length - 1;
    // With an ending card, its 1,6 s after the last sentence, on the last shot.
    const card = end ? Math.ceil((END_CARD + 0.02) * 30) / 30 : 0;
    const shots = kept.map((k, i) => ({ start: round(at(k.from)), end: round(at(k.to) + (i === last ? card : 0)), want: WANTS[k.role]!, ...(k.role === 0 ? { sound: true } : {}) }));
    const duration = shots[last]!.end;
    const span = (a: number, b: number) => ({ from: round(at(a)), to: round(at(b)) });
    return {
      duration,
      shots,
      texts: {
        ...Object.fromEntries(LINES.map(([slot, a, b]) => [slot, span(a, b)])),
        nom: span(TITLE[0], TITLE[1]),
        signature: span(TITLE[0], TITLE[1]),
        genre: span(TITLE[0], TITLE[1]),
      },
      marks: { sc: round3(sc), ...Object.fromEntries(kept.map((k, i) => [`r${i}`, k.role])) },
      // No music under her first words: it comes in on its downbeat as the burst starts, on her name; muffled under the
      // title while nothing is said, open again as the next sentence starts; faded on the last image.
      music: {
        downbeat: round3(at(DROP_AT)),
        pauses: [{ from: 0, to: round3(at(DROP_AT)) }],
        filters: [{ kind: "muffled" as const, from: round3(at(MUFFLED[0])), to: round3(at(MUFFLED[1])) }],
        end: { at: round3(duration - 1 / 30), fade: 0.4 },
      },
    };
  },
  code: CODE,
};

/** Its title's first frame at a tempo (for its tests). */
export const vlogTitleFrame = (bpm = BPM) => toFrame(Math.round(TITLE[0] * (BPM / bpm)) / 30);
