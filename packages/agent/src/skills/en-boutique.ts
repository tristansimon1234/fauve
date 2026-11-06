import { END_CARD_SECONDS, beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Création à quatre mains », version 1, written on its original's fiche (docs/fiches/en-boutique.md: a creator's 71,7 s
// visit to an artisan's counter, measured image by image at 30 i/s, its subtitles read on the pixels, its sticker title
// measured image by image, its sound by bands, mid and side; Tristan: « c'est un effet que l'on veut pouvoir faire, pas
// exactement reproduire l'image »). Someone comes into the shop with an idea and what it takes, and the one behind the
// counter makes it with them, in front of the camera, every line of theirs subtitled:
//   the idea      seven quick shots (0,5 to 0,9 s): what she brings, close-ups of it, her face as she sets the challenge;
//   the artisan   the one behind the counter, deadpan (a deep boom as he appears); he smiles at last, and the title pops
//                 over him as a comic-strip sticker (a white card tilted 5,5°, black edges, its name in yellow capitals
//                 with a black 3D shadow, who makes it under it), with a pop, then pops off two seconds later;
//   the exchange  the two of them at the counter, the idea explained;
//   the gestures  the making, gesture after gesture, his lines as he does it;
//   the result    shown to the camera by both; then they taste it, each one's face, a big bass drop on his « Waouh »,
//                 the verdict; her logo pops over the last wide shot.
// Its words are the subtitles of two voices, as the original's (hers in white, the artisan's in yellow), in groups of one
// to three words at 65 % of the height (lower while the sticker is up), a bold rounded sans with a soft shadow. When what
// is said in her shots reaches it (MontageSkill.spoken: her videos' own words), it writes those, in white, where they are
// said; where nobody speaks (stock videos, an ambiance), its filler's lines, hers and the artisan's. Its length keeps the
// original's structure within 45 s (MAX_REEL_SECONDS): its 40 shots and 71,7 s become 12 to 29 shots, 23 to 42 s, the
// talk shortened, each gesture 1,6 s at most. Nothing of the original's own: its creator's logo badge and its outro, its
// names, its pizza and its words. Her photos stay still, her videos play; its format follows her videos.

const BPM = 133.75;
/** Images of 30 a second in one beat of its music (the original's sections at 133,75 BPM, beat 0,4486 s). */
const IMAGES_A_BEAT = 1800 / BPM;
/** Its idea's section, all its shots together: 10 beats (4,49 s; the original's 4,43 s), shared among the shots kept. */
const OPEN_BEATS = 10;
/** The sticker pops this long into the shot where the artisan smiles (the original's 31 images), and stays (2,2 s). */
const POP_IN = 31;
const STUCK = 66;
/** Her logo pops this long into the last shot (the original's 3 images after its jump cut, 37 into the wide shot). */
const LOGO_IN = 37;
/** The engine's ending card: the Reel's last 2,5 s, her last shot held that much longer. */
const END_CARD = END_CARD_SECONDS;
/** A Reel lasts 45 s at most (MAX_REEL_SECONDS): at a slower tempo, its longest versions are held to it. */
const MAX_SECONDS = 45;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

type Section = "idee" | "artisan" | "passage" | "echange" | "gestes" | "resultat" | "degustation";
type Slot = { id: string; section: Section; frames: number; want: string; sound?: boolean };

const SAME = "la même vidéo que la case précédente, juste après";
/**
 * Its shots in the original's order, each one's length in images of the original (its gestures held to 1,6 s at most,
 * its long talk shortened), what it wants (with what does when she has not filmed it) and whether its sound is heard.
 */
const SLOTS: Slot[] = [
  { id: "a1", section: "idee", frames: 15, sound: true, want: "celle ou celui qui vient (elle, une cliente, un ami, un créateur) avec ce qu'il apporte pour la création (ses ingrédients, ses fleurs, ses produits, un panier), face caméra ; sinon quelqu'un dans son lieu, face caméra" },
  { id: "a2", section: "idee", frames: 17, want: "un gros plan de ce qu'on va utiliser (un ingrédient, une matière, un produit tenu à la main) ; sinon un gros plan de ses produits" },
  { id: "a3", section: "idee", frames: 18, want: "un autre gros plan de ce qu'on va utiliser, différent du précédent ; sinon un détail de son lieu" },
  { id: "a4", section: "idee", frames: 20, sound: true, want: "la même personne qui en montre un à la caméra, le tient ; sinon la vidéo de la case 1 un peu plus loin" },
  { id: "a6", section: "idee", frames: 20, sound: true, want: "la même personne face caméra qui lance l'idée ou le défi (elle parle) ; sinon quelqu'un face caméra qui sourit" },
  { id: "a7", section: "idee", frames: 27, sound: true, want: SAME },
  { id: "b1", section: "artisan", frames: 62, sound: true, want: "celui ou celle qui va le faire (le chef, la fleuriste, le barista, elle-même) derrière son comptoir ou à son poste, face caméra, sérieux, sans sourire ; sinon son comptoir ou son poste de travail" },
  { id: "b2", section: "artisan", frames: 76, sound: true, want: "la même personne qui sourit enfin, ou les deux ensemble derrière le comptoir : un titre en autocollant surgit sur sa poitrine ou le comptoir, son visage en haut de l'image ; sinon la vidéo de la case précédente un peu plus loin" },
  { id: "c1", section: "passage", frames: 40, want: "quelqu'un qui passe derrière le comptoir ou entre dans l'atelier, de dos ; sinon un plan large de son lieu" },
  { id: "d1", section: "echange", frames: 84, sound: true, want: "les deux au comptoir qui discutent, plan moyen (celui qui vient explique son idée, l'artisan écoute) ; sinon l'artisan à son poste qui prépare" },
  { id: "d2", section: "echange", frames: 36, sound: true, want: SAME },
  { id: "e1", section: "gestes", frames: 48, want: "le premier geste de la création, de près, ses mains (couper, presser, verser, choisir) ; sinon ses mains au travail, de près" },
  { id: "e2", section: "gestes", frames: 38, want: `${SAME}, de plus près` },
  { id: "e3", section: "gestes", frames: 48, want: "la suite du même geste, la même vidéo un peu plus loin ou un autre angle" },
  { id: "e4", section: "gestes", frames: 48, sound: true, want: "celui qui est venu, face caméra, qui commente ce qu'il voit (il parle) ; sinon un gros plan des mains au travail" },
  { id: "e6", section: "gestes", frames: 48, want: "le geste principal, de dessus si possible (étaler, monter, assembler, coiffer, tourner) ; sinon un autre geste, de près" },
  { id: "e7", section: "gestes", frames: 42, want: SAME },
  { id: "e8", section: "gestes", frames: 48, want: "le geste suivant (garnir, décorer, ajuster), de près ; sinon la création en cours, de près" },
  { id: "e9", section: "gestes", frames: 48, want: "la transformation : au four, la cuisson, le séchage, l'emballage ; sinon un autre geste" },
  { id: "e10", section: "gestes", frames: 38, want: "le résultat qui sort ou qui apparaît (sorti du four, retourné, déballé, fini) ; sinon le résultat de près" },
  { id: "e11", section: "gestes", frames: 48, want: "la touche finale, de près (le dernier ingrédient, le ruban, la dernière fleur, un filet d'huile) ; sinon un détail du résultat, de près" },
  { id: "e12", section: "gestes", frames: 48, sound: true, want: "l'artisan, son visage : il réagit, surpris ou amusé ; sinon le résultat de près" },
  { id: "f1", section: "resultat", frames: 103, sound: true, want: "le résultat montré face caméra, tenu à deux si possible, comme on le présente ; sinon le résultat de près, en entier" },
  { id: "g1", section: "degustation", frames: 33, sound: true, want: "les deux qui goûtent ou essaient ensemble, plan large ; sinon quelqu'un qui goûte ou essaie" },
  { id: "g3", section: "degustation", frames: 28, sound: true, want: "celui qui est venu qui goûte ou essaie, de près ; sinon le résultat de près, une main qui en prend" },
  { id: "g4", section: "degustation", frames: 39, sound: true, want: "l'artisan qui goûte, de près : sa réaction (un gros son grave tombe dessus) ; sinon quelqu'un qui goûte, de près" },
  { id: "g5", section: "degustation", frames: 38, sound: true, want: "celui qui est venu, face caméra : son verdict ; sinon quelqu'un qui sourit face caméra" },
  { id: "g6", section: "degustation", frames: 34, sound: true, want: "l'artisan, face caméra : son verdict ; sinon le résultat de près" },
  { id: "g8", section: "degustation", frames: 104, sound: true, want: "les deux ensemble, plan large, à la fin (son logo surgit dessus) ; sinon le résultat posé sur le comptoir" },
];
/** Fewer shots: these go, in this order (the first first), down to its twelve. */
const GONE = ["c1", "e7", "g3", "e2", "a3", "e4", "d2", "g6", "e12", "e3", "e8", "a7", "e11", "g5", "a4", "e9", "e10"];
const MOST = SLOTS.length;
const FEWEST = MOST - GONE.length;
/** The most shots from her files alone (34,5 s); up to all its 29 for a length she asks for (42,3 s). */
const OWN = 22;

/** Its shots for n of them: the original's order, those of GONE taken out first. */
export function boutiqueSlots(n: number): Slot[] {
  const count = Math.max(FEWEST, Math.min(MOST, Math.round(n)));
  const out = new Set(GONE.slice(0, MOST - count));
  return SLOTS.filter((s) => !out.has(s.id));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, spoken }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const list = shots || [];
  const n = list.length;
  const cur = list.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : D + 1;
  const until = Math.min(D, endAt);
  const within = (v, a, b) => Math.max(a, Math.min(b, v));

  // 1. Its sections (frames), as its timeline gives them: the idea, the artisan (the sticker from pop to out), the
  // exchange, the gestures, the result shown, the tasting, her logo over the last shot.
  const OPEN = Math.round(mark("open_end", D * 0.12));
  const B1 = Math.round(mark("artisan", OPEN));
  const POP = Math.round(mark("pop", B1 + 90));
  const OUT = Math.round(mark("out", POP + 66));
  const TALK = Math.round(mark("echange", OUT));
  const GEST = Math.round(mark("gestes", TALK + 60));
  const SHOW = Math.round(mark("resultat", GEST + 200));
  const LOGO = Math.round(mark("logo", D - 60));

  // 2. Its frame: her videos full frame, upright, as the original; whole in a 16:9 band on black when most of them are
  // in width (or she asks). Its subtitles at 65 % of the height (on the black under the band), lower while the sticker is up.
  const format = setting("format", "vertical");
  const wideShots = list.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const band = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const BH = band ? Math.round((W * 9) / 16) : H;
  const BY = band ? Math.round((H - BH) / 2) : 0;
  const film = n ? h(Footage, { key: "shot", shot: cur, style: { position: "absolute", left: 0, top: 0, width: W, height: BH } }) : null;

  // 3. Her colours: the sticker's name in her colour when it is bright and vivid enough to pop on white with its black
  // shadow, else the original's yellow; the artisan's lines in her colour when it reads on any picture, else its yellow.
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); return m ? parseInt(m[1], 16) : -1; };
  const rgb = (c) => { const v = hex(c); return v < 0 ? null : [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const luma = (c) => { const x = rgb(c); return x ? (0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]) / 255 : -1; };
  const vivid = (c) => { const x = rgb(c); if (!x) return 0; const a = Math.max(x[0], x[1], x[2]); return a ? (a - Math.min(x[0], x[1], x[2])) / a : 0; };
  const accent = brand.accent;
  const INK = luma(accent) >= 0.28 && luma(accent) <= 0.86 && vivid(accent) >= 0.45 ? accent : "#fcc83b";
  const SECOND = luma(accent) >= 0.6 && vivid(accent) >= 0.3 ? accent : "#f7ce18";
  const STICKER = "'Paytone One', '" + brand.displayFont + "', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Figtree', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ").replace(/ (\d+(?:er|e))\b/g, " $1");

  // 4. Its texts, found by their role and their moment: the hook over the idea, the band for the sticker's name, and
  // its captions by where they start (her line on the artisan, who makes it, the exchange, the gestures, the verdict).
  const all = (reelTexts || []).filter((t) => t && typeof t.text === "string" && t.text.trim());
  const near = (t, f) => Math.abs(t.from - f) <= 3;
  const hook = all.find((t) => t.role === "hook") || null;
  const title = all.find((t) => t.role === "band") || null;
  const captions = all.filter((t) => t.role === "caption");
  const avec = captions.find((t) => near(t, POP)) || null;
  const slotOf = (f) => captions.find((t) => t !== avec && near(t, f)) || null;
  const lines = [hook, slotOf(B1), slotOf(TALK), slotOf(GEST), slotOf(SHOW)].filter(Boolean);
  const others = all.filter((t) => t !== title && t !== avec && lines.indexOf(t) < 0);

  // 5. Its lines as the subtitles of two voices: each line between « / » one person's (the artisan's when it starts with
  // « — »), cut in groups of one to three words (never ending on « de », « la », « on »…, a comma or a full stop always a
  // change), its punctuation shown as the original's. What is really said in her shots, where it is said, comes first.
  const LIGHT = new Set("le la les l un une des du de d au aux à a en et ou ni que qu qui ce c cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je j tu t il ils elle elles on nous vous se s y ne n me m sur sous dans par pour avec sans chez vers est sont va très plus pas trop".split(" "));
  const bare = (w) => w.toLowerCase().replace(/^.*['’]/, "").replace(/[^\p{L}\p{N}]/gu, "");
  const light = (w) => /^\d/.test(w) || /['’]$/.test(w) || LIGHT.has(bare(w));
  const groupsOf = (text) => {
    // A mark set apart the French way (« verra ! », « quoi ? ») stays with its word, never a group of its own.
    const words = String(text).split(/\s+/).filter(Boolean).reduce((ws, w) => {
      if (ws.length && /^[!?:;»…]+$/.test(w)) ws[ws.length - 1] += " " + w;
      else ws.push(w);
      return ws;
    }, []);
    const out = [];
    let g = [];
    words.forEach((w, i) => {
      g.push(w);
      const next = words[i + 1];
      const stop = /[,;:.!?…]$/.test(w);
      const full = g.length >= 3 || g.join(" ").length >= 15;
      // Its last word alone would be a group of one: kept with this one when they read together (« Ça sent déjà bon ! »).
      const lastOne = next && i + 2 === words.length && g.length <= 3 && g.join(" ").length + next.length < 24;
      // Four words ending on small ones (« une pizza avec les »): the small ones start the next group (« avec les légumes »).
      if (next && !stop && g.length >= 4 && light(w)) {
        let k = g.length;
        while (k > 0 && light(g[k - 1])) k--;
        if (k > 0) { out.push(g.slice(0, k).join(" ")); g = g.slice(k); return; }
      }
      if (!next || stop || (full && !light(w) && !lastOne) || g.length >= 5) { out.push(g.join(" ")); g = []; }
    });
    if (g.length) out.push(g.join(" "));
    return out;
  };
  const repliques = (text) => String(text).split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const second = /^[—–-]\s*/.test(s);
    return { second, groups: groupsOf(s.replace(/^[—–-]\s*/, "")) };
  });
  // Each group its share of its span by its length, never under what it takes to be read (three words: 1,4 s), a change
  // moved onto a cut of her shots when one is near.
  const cuts = list.map((s) => s.from).filter((f) => f > 0);
  // As the scene check reads it: three pieces or more (a mark counts) read in 0,8 s plus 0,3 s a word, 1,2 s at least.
  const pieces = (g) => g.replace(/\s+/g, " ").trim().split(" ").length;
  const count = (g) => g.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const need = (g) => (pieces(g) >= 3 ? Math.ceil(24 * Math.min(4.5, Math.max(1.2, 0.8 + 0.3 * count(g)))) + 2 : 13);
  const timed = (items, a, b) => {
    const m = items.length;
    if (!m || b <= a + 2) return [];
    const T = b - a;
    const N = items.reduce((s, g) => s + need(g.text), 0);
    const C = items.reduce((s, g) => s + g.text.length + 6, 0);
    const d = items.map((g) => (N >= T ? (need(g.text) * T) / N : need(g.text) + ((T - N) * (g.text.length + 6)) / C));
    const at = [a];
    for (let j = 0; j < m; j++) at.push(at[j] + d[j]);
    at[m] = b;
    for (let j = 1; j < m; j++) {
      const c = cuts.filter((x) => Math.abs(x - at[j]) <= 6 && x - at[j - 1] >= Math.min(d[j - 1], need(items[j - 1].text)) && at[j + 1] - x >= Math.min(d[j], need(items[j].text)));
      if (c.length) at[j] = c.reduce((x, y) => (Math.abs(y - at[j]) < Math.abs(x - at[j]) ? y : x));
    }
    return items.map((g, j) => ({ ...g, from: Math.round(at[j]), to: Math.round(at[j + 1]) }));
  };
  const said = (Array.isArray(spoken) ? spoken : [])
    .filter((w) => w && typeof w.w === "string" && w.w.trim() && Number.isFinite(w.from))
    .map((w) => ({ w: String(w.w).trim(), from: Math.round(w.from), to: Math.round(Number.isFinite(w.to) ? w.to : w.from + 8) }))
    .sort((a, b) => a.from - b.from);
  const shown = React.useMemo(() => {
    const out = [];
    lines.forEach((t, k) => {
      const a = Math.max(0, t.from);
      const b = Math.min(until, k + 1 < lines.length ? Math.min(t.to, lines[k + 1].from) : t.to);
      const real = said.filter((w) => w.from >= a && w.from < b);
      if (real.length >= 3) {
        // What is said there: two to four words at a time, a new group after a comma, a full stop or a pause.
        const chunks = [];
        let c = [];
        real.forEach((w, i) => {
          const prev = real[i - 1];
          if (prev && c.length && (w.from - prev.to >= 8 || /[,;:.!?…]$/.test(prev.w) || c.length >= 4 || (c.map((x) => x.w).join(" ") + " " + w.w).length > 22)) { chunks.push(c); c = []; }
          c.push(w);
        });
        if (c.length) chunks.push(c);
        chunks.forEach((x, j) => {
          const next = chunks[j + 1];
          out.push({ key: "s" + k + "-" + j, text: x.map((w) => w.w).join(" "), second: false, from: x[0].from, to: Math.min(b + 12, next ? next[0].from : x[x.length - 1].to + 12), whole: null });
        });
        return;
      }
      const items = repliques(t.text).flatMap((r) => r.groups.map((g) => ({ text: g, second: r.second })));
      timed(items, a, b).forEach((g, j) => out.push({ key: "t" + k + "-" + j, text: g.text, second: g.second, from: g.from, to: g.to, whole: t }));
    });
    return out;
  }, [reelTexts, spoken, until, POP, TALK]);

  // 6. Its subtitle: her text font in heavy weight, white (the artisan's lines in the second colour), a soft dark shadow,
  // no box, one or two lines centred, its bottom at 66,8 % of the height (73,5 % while the sticker is up); the groups not
  // seen stay in the page, hidden, so each of its texts is there whole.
  const SIZE = 58;
  const shade = "0 3px 7px rgba(0,0,0,0.55), 0 0 3px rgba(0,0,0,0.45), 0 0 18px rgba(0,0,0,0.25)";
  const stuck = frame >= POP && frame < OUT;
  const bottom = band ? Math.round(H * 0.735) : Math.round(H * (stuck ? 0.735 : 0.668));
  const hidden = { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1, whiteSpace: "pre" };
  const now = shown.find((g) => frame >= g.from && frame < Math.min(g.to, until)) || null;
  const box = { position: "absolute", left: 140, width: W - 280, top: bottom - Math.round(SIZE * 2.3), height: Math.round(SIZE * 2.3) };
  const sub = now ? h(FitText, { key: "sub-" + now.key + "-" + now.text, style: box, innerStyle: { justifyContent: "flex-end", fontFamily: body, fontWeight: 800, fontSize: SIZE, lineHeight: 1.12, color: now.second ? SECOND : "#ffffff", textShadow: shade, textAlign: "center", textWrap: "balance" } }, keep(now.text)) : null;
  const rest = lines.filter((t) => frame >= t.from && frame < Math.min(t.to, until)).map((t, i) => h("span", { key: "h" + i, style: hidden }, keep(t.text)));

  // 7. A sticker: a white card tilted, thick black edges and a black block under its lower left (its 3D: 18 px out to the
  // left, 21 below), two thin white strokes of shine across that block under its lower right; it pops in with a bounce and a blur (0,55, then 1,04, 1,08, 1,03, 1) and pops off the
  // same way (0,75, then 0,42), never fading.
  const SW = Math.round(W - 280);
  const pop = (from, to, f) => {
    const t = f - from;
    const u = to - f;
    if (t < 0 || u <= 0) return null;
    if (u === 1) return { s: 0.42, b: 6 };
    if (u === 2) return { s: 0.75, b: 4 };
    return t === 0 ? { s: 0.55, b: 7 } : t === 1 ? { s: 1.04, b: 3 } : t === 2 ? { s: 1.08, b: 0 } : t === 3 ? { s: 1.03, b: 0 } : { s: 1, b: 0 };
  };
  const splitName = (s) => {
    const words = String(s).trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return [words.join(" ")];
    let best = null;
    for (let i = 1; i < words.length; i++) {
      // Never a first line ending on a small word (« PIZZA DU » / « MARCHÉ »).
      if (light(words[i - 1])) continue;
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const score = Math.max(a.length, b.length);
      if (!best || score < best.score) best = { lines: [a, b], score };
    }
    return best ? best.lines : [words.join(" ")];
  };
  const EXTRUDE = Array.from({ length: 8 }, (_, k) => "-" + Math.round((k + 1) * 0.9) + "px " + (k + 1) + "px 0 #141414").join(", ");
  const sticker = (key, at, cx, cy, w, tall, tilt, inner) => at
    ? h("div", { key, style: { position: "absolute", left: Math.round(cx - w / 2), top: Math.round(cy - tall / 2), width: w, height: tall, transform: "rotate(" + tilt + "deg) scale(" + at.s + ")", filter: at.b ? "blur(" + at.b + "px)" : "none" } },
        h("div", { style: { position: "absolute", left: -18, top: 21, width: w, height: tall, borderRadius: 16, backgroundColor: "#141414" } }),
        h("div", { style: { position: "absolute", left: 0, top: 0, width: w, height: tall, borderRadius: 16, backgroundColor: "#ffffff", border: "9px solid #141414", boxSizing: "border-box" } }),
        h("svg", { "data-fauve-decor": "", width: 46, height: 32, viewBox: "0 0 46 32", style: { position: "absolute", left: w - 104, top: tall + 2 } },
          h("path", { d: "M5 27 L22 5 M20 27 L37 5", stroke: "#ffffff", strokeWidth: 3, strokeLinecap: "round" })),
        inner)
    : null;
  const nameLines = (text, key, top, tall, size) => h(FitText, { key: "n-" + key + "-" + text, style: { position: "absolute", left: 40, top, width: SW - 80, height: tall }, innerStyle: { fontFamily: STICKER, fontWeight: 400, fontSize: size, lineHeight: 0.98, letterSpacing: "0.01em", textTransform: "uppercase", color: INK, textShadow: EXTRUDE, textAlign: "center" } },
    splitName(keep(text)).map((l, i) => h("div", { key: i, style: { whiteSpace: "nowrap" } }, l)));
  const smallLine = (text, key, top) => h(FitText, { key: "l-" + key + "-" + text, style: { position: "absolute", left: 40, top, width: SW - 80, height: 62 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 48, lineHeight: 1.1, letterSpacing: "0.05em", textTransform: "uppercase", color: "#141414", whiteSpace: "nowrap", textAlign: "center" } }, keep(text));
  const card = (key, name, line, at, cy, tilt) => {
    const tall = Math.round(H * (line ? 0.19 : 0.15));
    return sticker(key, at, W / 2, cy, SW, tall, tilt, h(React.Fragment, null,
      nameLines(name, key, 26, Math.round(tall * (line ? 0.66 : 0.8)), 124),
      line ? smallLine(line, key, Math.round(tall * 0.72)) : null));
  };

  // 8. The title sticker, over the artisan as he smiles: its name (what they make), who makes it under it; its middle at
  // 55,5 % of the height (the original's 60 %, raised so that its subtitles pass under it within the safe zone).
  const TITLE_Y = band ? Math.round(H * 0.5) : Math.round(H * 0.555);
  const titled = title && frame < endAt ? card("title", title.text, avec ? avec.text : "", pop(POP, OUT, frame), TITLE_Y, -5.5) : null;

  // 9. The end: her logo pops over the last shot on a smaller white card (else her name in the sticker's letters), held to
  // the end; her ending card, when the Reel has one, the same way in its place (its title, its line).
  const logoAt = pop(end ? endAt : LOGO, D + 3, frame);
  const finale = end && frame >= endAt
    ? card("end", end.title || brand.name || "", end.subtitle || "", logoAt, Math.round(H * 0.5), -4)
    : brand.logoUrl
      ? sticker("logo", logoAt, W / 2, Math.round(H * 0.5), Math.round(W * 0.56), Math.round(H * 0.14), -4,
          h(Img, { src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { position: "absolute", left: 34, top: 26, width: Math.round(W * 0.56) - 68, height: Math.round(H * 0.14) - 52, objectFit: "contain" } }))
      : brand.name ? card("name", brand.name, "", logoAt, Math.round(H * 0.5), -4) : null;

  // Any other text of the Reel (none in its slots): a plain line at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i + "-" + t.text, style: { position: "absolute", left: 140, width: W - 280, top: 170 + i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 800, fontSize: 54, color: "#ffffff", textShadow: shade, textAlign: "center" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } },
    h("div", { style: { position: "absolute", left: 0, top: BY, width: W, height: BH, overflow: "hidden" } }, film),
    sub, rest, titled, finale, extra);
}`;

export const enBoutique: MontageSkill = {
  key: "en-boutique",
  // 2: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 2,
  bpm: BPM,
  shots: [FEWEST, OWN],
  long: MOST,
  files: [4, 16],
  // Its sections follow the tempo a little (24 to 30 s at 22 shots from 140 to 114 BPM); its longest held to 45 s.
  tempo: [114, 140],
  how: "Quelqu'un vient en boutique lancer une idée ou un défi à celui ou celle qui est derrière le comptoir, et ils le font ensemble devant la caméra : l'idée en sept plans rapides sur ce qu'il apporte ; l'artisan impassible derrière son comptoir, puis qui sourit, et le nom de la création qui surgit sur lui en autocollant de bande dessinée (une carte blanche penchée bordée de noir, le nom en capitales jaunes à l'ombre noire, qui le fait dessous), avec un pop ; leur échange au comptoir, les gestes un à un, le résultat montré face caméra, puis ils goûtent ou essaient, chacun son visage, le verdict ; son logo surgit sur le dernier plan. Tout ce qu'ils disent est écrit en sous-titres, deux à trois mots à la fois (lui dans une autre couleur) ; ce qu'on dit vraiment dans ses vidéos est écrit tel quel, ses répliques à lui là où personne ne parle.",
  end: true,
  texts: [
    {
      slot: "idee",
      role: "hook",
      want: "sa première réplique, sur l'idée en plans rapides (4,5 s) : ce qu'on va faire, en 6 à 9 mots, comme on le dit à la caméra (une forme comme « L'idée : un bouquet avec les fleurs du jour ! ») ; deux répliques séparées par « / » au plus ; rien d'inventé",
      max: 72,
      required: true,
    },
    {
      slot: "titre",
      role: "band",
      want: "le nom de la création, dans l'autocollant qui surgit sur l'artisan : deux ou trois mots qui la nomment (une forme comme « Pizza du marché », « Bouquet surprise », « Latte de saison », « Coupe défi »), jamais une phrase",
      max: 22,
      required: true,
    },
    {
      slot: "artisan",
      role: "caption",
      want: "facultatif : sa réplique sur l'artisan derrière son comptoir, avant que le titre surgisse (4,5 s), 4 à 8 mots avec son prénom quand on le connaît (une forme comme « Marco ne sourit jamais… / Ah si, je l'ai eu ! ») ; deux répliques séparées par « / » au plus",
      max: 52,
      required: false,
    },
    {
      slot: "avec",
      role: "caption",
      want: "facultatif : la petite ligne sous le titre de l'autocollant, qui le fait : « avec » et leurs deux prénoms (« avec Léa & Marco »), sinon « chez » et le nom de son commerce ; seulement des prénoms ou un nom donnés, jamais inventés",
      max: 22,
      required: false,
    },
    {
      slot: "echange",
      role: "caption",
      want: "facultatif : leur échange au comptoir (3 s), deux répliques courtes séparées par « / », 8 mots en tout au plus, celles de l'artisan commençant par « — » (une forme comme « Je pensais à tes tomates / — Vas-y, dis-moi ! »)",
      max: 56,
      required: false,
    },
    {
      slot: "gestes",
      role: "caption",
      want: "les répliques sur les gestes, une pour deux cases de gestes, séparées par « / », surtout celles de l'artisan qui explique ce qu'il fait (commençant par « — »), 2 à 5 mots chacune, ce que montrent ses vidéos (une forme comme « — On les presse à la main / — Pas trop de mozza / Ça sent déjà bon ! ») ; rien d'inventé",
      max: 110,
      required: true,
    },
    {
      slot: "verdict",
      role: "caption",
      want: "la fin : la présentation du résultat puis le verdict de la dégustation, trois ou quatre répliques courtes séparées par « / » (une forme comme « Et voilà la pizza du marché ! / — Waouh ! / Je la trouve très bonne / Bon appétit ! »), celles de l'artisan commençant par « — »",
      max: 100,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran comme l'original, ou ses vidéos horizontales entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "vertical", says: "vertical plein écran comme l'original, ses vidéos en largeur recadrées sur leur sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 sur du noir, les sous-titres dessous", band: true },
        { value: "auto", says: "comme ses vidéos (vertical plein écran ; horizontal 16:9 sur du noir quand la plupart sont en largeur)" },
      ],
    },
  ],
  spoken: "own",
  fonts: ["Paytone One"],
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const slots = boutiqueSlots(n);
    // Its idea's shots share its 10 beats by their own lengths; every other shot its own length, in beats.
    const open = slots.filter((s) => s.section === "idee");
    const openFrames = sum(open.map((s) => s.frames));
    const beats = slots.map((s) => (s.section === "idee" ? (OPEN_BEATS * s.frames) / openFrames : s.frames / IMAGES_A_BEAT));
    // With an ending card, her last shot held whole beats longer (the card's 2,5 s).
    const last = beats.length - 1;
    if (end) beats[last] = beats[last]! + Math.ceil(END_CARD / beat - 1e-6);
    // Never past 45 s: at a slower tempo, its longest versions are held to it, every shot alike.
    const squeeze = Math.min(1, MAX_SECONDS / (sum(beats) * beat));
    const spans = beatSpans(bpm, beats.map((b) => b * squeeze));
    const duration = spans.at(-1)!.end;
    const at = (id: string) => slots.findIndex((s) => s.id === id);
    const first = (section: Section) => spans[slots.findIndex((s) => s.section === section)]!.start;
    const b2 = spans[at("b2")]!.start;
    const pop = round3(b2 + (POP_IN / IMAGES_A_BEAT) * beat * squeeze);
    const out = round3(pop + (STUCK / IMAGES_A_BEAT) * beat * squeeze);
    // Their exchange from the shot after the artisan's (the passage behind the counter, else the counter), under the sticker's
    // last instants when it is still up (the original's « Santo, tu me dis… » begins as it goes).
    const talk = slots.some((s) => s.section === "passage") ? first("passage") : first("echange");
    const gestures = first("gestes");
    const shown = first("resultat");
    const finale = spans[last]!.start;
    const logo = round3(finale + (LOGO_IN / IMAGES_A_BEAT) * beat * squeeze);
    const cardFrom = end ? round(duration - END_CARD) : duration;
    const g4 = at("g4");
    const sounds: SkillSound[] = [
      // A deep boom as the artisan appears, a cartoon pop and its sting with the sticker, a whoosh as it goes, a bass drop
      // sliding down on his tasting face, a pop with her logo (the original's own sounds, read on its side channel).
      { at: round3(spans[at("b1")]!.start), sound: "deep cinematic boom hit", seconds: 1, gain: -3 },
      { at: pop, sound: "cartoon pop with a bright comic sting", seconds: 1, gain: 0 },
      { at: round3(Math.max(pop + 0.5, out - 2 / 30)), sound: "quick soft whoosh", seconds: 0.5, gain: -6 },
      ...(g4 >= 0 ? [{ at: round3(spans[g4]!.start + 2 / 30), sound: "deep 808 bass drop sliding down", seconds: 1.5, gain: -4 }] : []),
      { at: end ? round3(cardFrom) : logo, sound: "cartoon pop", seconds: 0.5, gain: -2 },
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: slots[i]!.want, ...(slots[i]!.sound ? { sound: true } : {}) })),
      texts: {
        idee: { from: 0, to: round(spans[at("b1")]!.start) },
        titre: { from: round(pop), to: round(out) },
        artisan: { from: round(spans[at("b1")]!.start), to: round(Math.min(out, talk)) },
        avec: { from: round(pop), to: round(out) },
        echange: { from: round(talk), to: round(gestures) },
        gestes: { from: round(gestures), to: round(shown) },
        verdict: { from: round(shown), to: round(cardFrom) },
      },
      marks: {
        open_end: toFrame(spans[at("b1")]!.start),
        artisan: toFrame(spans[at("b1")]!.start),
        pop: toFrame(pop),
        out: toFrame(out),
        echange: toFrame(round(talk)),
        gestes: toFrame(round(gestures)),
        resultat: toFrame(round(shown)),
        degustation: toFrame(first("degustation")),
        logo: toFrame(logo),
      },
      sounds,
      // Its music soft under the idea (her words lead), opened on the artisan's boom, which falls on a bar (its downbeat
      // two beats in); cut short at its end, as the original ends on its logo.
      music: {
        downbeat: round3(2 * beat),
        filters: [{ kind: "soft", from: 0, to: round3(spans[at("b1")]!.start), db: -9 }],
        end: { at: round3(duration), fade: 0.25 },
      },
      cutouts: [],
    };
  },
  code: CODE,
};
