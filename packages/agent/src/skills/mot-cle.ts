import { nominalSaid, type MontageSkill, type SkillSaid, type SkillSound } from "../skills.ts";

// « Mot clé en grand », version 1, written on its original's fiche (docs/fiches/mot-cle.md: measured image by image at
// 30 i/s, each text's box and instant, its two cuts, its music's entry and its bass taken away; Tristan: « c'est un effet
// que l'on veut pouvoir faire, pas exactement reproduire l'image »). A creator sits before a plain wall and talks to the
// camera; what he says is written above his head. Timed on her voice (SkillVoice): her talking video is the Reel, cut by
// the engine (her « euh » and long pauses out, the frame changing only between two ideas, in the breath between them:
// her other take, else a tighter frame held), and its words are hers, chosen by the filler in what she says, each at the
// instant she says it. Section by section, as the original:
//   her hook       her first two or three words in bold capitals slide in from the left on the first image (a whoosh
//                  on their bounce: three images at 19 % of the width each, blurred, 3 % past their place, 4 % back,
//                  set on the sixth), held until she says the word after them;
//   a plain idea   her words said, one by one, on a small line of very spaced small words above, emptied at the end of
//                  each phrase (its keyword and its one-letter words left out), while its keyword slides in big under
//                  it on the instant she says it, as the hook did, and stays the whole idea;
//   a list         two names at a time, each in the font its word evokes (the filler's, WORD_FONTS), each on the instant
//                  she says it, the first small on top, the second big under it; a pair goes when she says the next
//                  one's first name; a last one alone big;
//   a number       her number very condensed and very bold (Anton), its two or three words stacked at its right as tall
//                  as it, all at once on the instant she says it, held to the end of its idea;
//   her goodbye    nothing above her head.
// Everything is set in the one place above her head, centred (her face followed: the block moves up, then shrinks, and
// goes before her chest only when nothing is left above her head; never on her face), white on a dark or coloured wall,
// in ink on a light one (the light of her wall read under it, LightUnder). Version 2 (Tristan on v1's bench, 6 November:
// « là les sous-titres ne sont plus utiles, et le choix des vidéos + la voix off sont sous quali »): its code writes all
// she says itself, on its small line (never a word written big at that moment), and the engine's subtitles step aside
// (v1 kept them on her chest, as the original keeps both: each keyword was read three times); her photo or video of each
// name of a list she says (cast by its filler, `refs`) shows full frame under that name. Its music (108 BPM, the original's) waits for her first
// keyword, comes in on a beat after it, loses its bass for 16 beats from the middle and is cut with the picture; a low
// whoosh under each word that slides. Her video full frame when vertical (as the original), whole in a 16:9 band on
// black when horizontal, its words in the black above it (the `format` setting). Nothing of the original's own words is
// copied: the font names it lists are its subject, not an effect.

const BPM = 108;
const BEAT = 60 / BPM;
/** A word that slides in: its offset from its place at each of its first images (shares of the width), the original's. */
export const SLIDE = [-0.54, -0.35, -0.16, 0.035, -0.04];
/** Its blur on its first three images (px, sideways). */
const SLIDE_BLUR = [22, 16, 9];
/** Its whoosh, at its loudest on its bounce (s after it starts sliding). */
const WHOOSH_AT = 0.13;
const WHOOSH = { sound: "low whoosh", seconds: 0.5, gain: -6 };
/** Its music comes in on the first beat a beat after her first keyword lands, 8 beats in at the latest. */
const ENTER_MOST = 8;
/** It loses its bass for this many beats from the middle of the Reel (the original's 16, from its own middle). */
const THIN = 16;
/** A keyword goes this long before its idea's last word ends (s: « FONTS » at 5,40 s, « look » ending at 5,50), held this long at least. */
const KEY_EARLY = 0.1;
const KEY_LEAST = 0.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** What each idea is laid as: 0 a keyword (and the small line), 1 a list (two names at a time), 2 a number and its words. */
export const ideaKind = (idea: Pick<SkillSaid["ideas"][number], "text" | "items">) => (/\d/.test(idea.text) ? 2 : idea.items.length ? 1 : 0);

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, texts, track, spoken }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const talkN = Math.max(1, Math.min(shots.length, Math.round(mark("said_shots", shots.length))));
  const shotAt = (f) => { let k = 0; for (let i = 0; i < talkN; i++) if (shots[i].from <= f) k = i; return k; };
  const cur = shotAt(frame);
  const display = "'" + brand.displayFont + "', 'Poppins', 'Montserrat', 'Arial', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Poppins', 'Inter', sans-serif";
  const own = (t, fallback) => (t && t.font ? "'" + t.font + "', " + fallback : fallback);

  // 1. Its frame: her video full frame when vertical (as the original), whole in a 16:9 band on black when horizontal
  // (or on her word), its words in the black above it.
  const format = setting("format", "auto");
  const wideTalk = (Number(shots[0] && shots[0].aspect) || 0.5625) > 1.15;
  const wide = format === "horizontal" || (format === "auto" && wideTalk);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const box = { left: 0, top: by, width: bw, height: bh };
  const film = shots.length ? h(Footage, { key: "t" + cur, shot: cur, style: { position: "absolute", left: 0, top: by, width: bw, height: bh } }) : null;

  // 2. Her ideas, from the engine's marks (frames): where each begins, its keyword, its end, what it is laid as.
  const ideasN = Math.max(0, Math.round(mark("said_ideas", 0)));
  const ideas = Array.from({ length: ideasN }, (_, i) => ({ k: i + 1, from: mark("said_idea" + (i + 1) + "_from", 0), key: mark("said_idea" + (i + 1) + "_key", 0), to: mark("said_idea" + (i + 1) + "_to", 0), kind: mark("kind" + (i + 1), 0) }));
  ideas.forEach((idea, i) => { idea.start = i === 0 ? 0 : Math.round((ideas[i - 1].to + idea.from) / 2); });
  ideas.forEach((idea, i) => { idea.end = i + 1 < ideas.length ? ideas[i + 1].start : durationInFrames; });
  const ideaAt = (f) => { let found = null; for (const idea of ideas) if (idea.start <= f) found = idea; return found; };
  const hook = reelTexts.find((t) => t.role === "hook");
  const bands = reelTexts.filter((t) => t.role === "band");
  const names = reelTexts.filter((t) => t.role === "caption");
  const inIdea = (t, idea) => t.from >= idea.start - 1 && t.from < idea.end;

  // 3. The one place above her head, the original's (from 20 to 34,4 % of the height, her head 10 % lower): moved up
  // when her head is higher, smaller when there is less room, before her chest when there is none; read once for each
  // idea, a few images into it (her face followed), so nothing moves while it is said.
  const TOP0 = 0.2 * height;
  const BOT0 = 0.344 * height;
  const ROOF = 0.052 * height;
  const headAt = (f) => {
    if (typeof track !== "function") return null;
    const seen = track(f, { shot: shotAt(f), left: 0, top: by, width: bw, height: bh }) || {};
    const faces = (seen.faces || []).filter((x) => x && x.width > 0 && x.height > 0);
    if (!faces.length) return null;
    const face = faces.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    return { top: face.y - face.height * 0.95, bottom: face.y + face.height * 0.75 };
  };
  const placeAt = (f) => {
    const head = wide ? null : headAt(f);
    const limit = wide ? by - 0.016 * height : head ? head.top - 0.035 * height : 0.42 * height;
    const span = BOT0 - TOP0;
    if (limit >= BOT0) return { top: TOP0, s: 1 };
    if (limit - span >= ROOF) return { top: limit - span, s: 1 };
    const s = (limit - ROOF) / span;
    if (s >= 0.5) return { top: ROOF, s };
    const below = head ? head.bottom + 0.035 * height : 0.5 * height;
    return { top: Math.min(below, 0.7 * height - span * 0.8), s: 0.8 };
  };
  const hookPlace = placeAt(4);
  const places = ideas.map((idea) => placeAt(Math.min(durationInFrames - 1, idea.from + 3)));
  const placeOf = (f) => { const idea = ideaAt(f); return idea && (!hook || f >= hook.to) ? places[idea.k - 1] : hookPlace; };
  const Y = (p, y) => Math.round(p.top + (y * height - TOP0) * p.s);
  // A size in the block, smaller with it but never under its floor (on a tight frame its spacing shrinks before its letters).
  const px = (v, floor) => Math.max(floor, Math.round(v));

  // White on a dark or coloured wall, in ink on a light one (her wall's light under the block, on her first shot).
  const light = !wide && shots.length ? LightUnder(shots[0], 6, { left: 0, top: 0, width: bw, height: bh }, { x: 140, y: Math.round(hookPlace.top), w: width - 280, h: Math.round((BOT0 - TOP0) * hookPlace.s) }) : null;
  const inkOn = Boolean(light && light.mean > 0.58);
  const INK = inkOn ? "#161616" : "#ffffff";
  const EDGE = inkOn ? "0 0 2px rgba(255,255,255,0.4)" : "0 1px 2px rgba(0,0,0,0.32), 0 0 1px rgba(0,0,0,0.25)";

  // Her photo or video of a name of her list (cast by its filler on what she says, after her talk's shots): full frame
  // from the instant she says that name to the next one, under its name, white with a deeper shadow there.
  const refsN = Math.max(0, Math.min(shots.length - talkN, Math.round(mark("said_refs", 0))));
  const refs = Array.from({ length: refsN }, (_, i) => {
    const s = shots[talkN + i];
    const from = mark("said_ref" + (i + 1) + "_from", s.from);
    return { i: talkN + i, item: mark("said_ref" + (i + 1) + "_item", 0), from, to: mark("said_ref" + (i + 1) + "_to", from + s.durationInFrames), shot: s };
  });
  // (Only while its own name is the last one said: a next name without an image of hers gives her talk back.)
  const picture = refs.find((r) => r.item > 0 && frame >= r.from && frame < r.to && !names.some((t) => t.from > r.from + 1 && t.from <= frame)) || null;
  const PIC_EDGE = "0 2px 6px rgba(0,0,0,0.55), 0 0 28px rgba(0,0,0,0.45)";
  const shown_ = picture ? h(Footage, { key: "ref" + picture.i, shot: picture.i, at: picture.shot.from, style: { position: "absolute", left: 0, top: 0, width, height } }) : film;
  const tone = picture ? { color: "#ffffff", textShadow: PIC_EDGE } : { color: INK, textShadow: EDGE };

  // 4. A word that slides in from the left as the original's (three images fast and blurred, past its place, back, set).
  const SLIDE = [-0.54, -0.35, -0.16, 0.035, -0.04];
  const BLUR = [22, 16, 9];
  const blurs = h("svg", { key: "blurs", width: 0, height: 0, style: { position: "absolute" } },
    BLUR.map((b) => h("filter", { key: b, id: "mcb" + b, x: "-40%", y: "-40%", width: "180%", height: "180%" }, h("feGaussianBlur", { stdDeviation: b + " 0" }))));
  const slid = (key, from, top, boxH, size, text, family) => {
    const t = frame - from;
    const dx = t >= 0 && t < SLIDE.length ? Math.round(SLIDE[t] * width) : 0;
    const blur = t >= 0 && t < BLUR.length ? BLUR[t] : 0;
    return h("div", { key, style: { position: "absolute", left: 0, top, width, height: boxH, transform: dx ? "translateX(" + dx + "px)" : undefined, filter: blur ? "url(#mcb" + blur + ")" : undefined } },
      h(FitText, { style: { position: "absolute", left: 90, top: 0, width: width - 180, height: boxH }, innerStyle: { fontFamily: family || display, fontWeight: 700, fontSynthesis: "none", fontSize: size, lineHeight: 1, letterSpacing: "0.005em", color: INK, textShadow: EDGE, whiteSpace: "nowrap" } }, String(text || "").toUpperCase()));
  };

  // 5. Her hook: her first words in bold capitals from the first image, in their place (the original's: its top at 28,9 %).
  const hookNode = hook && frame >= hook.from && frame < hook.to ? slid("hook", hook.from, Y(hookPlace, 0.271), px(0.072 * height * hookPlace.s, 92), px(0.05 * height * hookPlace.s, 72), hook.text) : null;

  // 6. The idea said now, laid as it is: its keyword (with the small line of her words above it), its list two names at
  // a time, or its number and its words.
  const idea = ideaAt(frame);
  const place = placeOf(frame);
  const laid = [];
  if (idea && (!hook || frame >= hook.to)) {
    if (idea.kind === 0) {
      const key = bands.find((t) => inIdea(t, idea) && frame >= t.from && frame < t.to);
      if (key) laid.push(slid("key" + idea.k, key.from, Y(place, 0.266), px(0.094 * height * place.s, 120), px(0.073 * height * place.s, 96), key.text, own(key, display)));
    } else if (idea.kind === 1) {
      // Two names at a time, each in its own font on the instant she says it: the first small on top (a label beside the
      // big one, 40 px at least), the second big under it (a last one alone big), from 20 to 34 % of the height; its keyword
      // alone before its list, as a plain one.
      const key = bands.find((t) => inIdea(t, idea) && frame >= t.from && frame < t.to);
      if (key) laid.push(slid("key" + idea.k, key.from, Y(place, 0.266), px(0.094 * height * place.s, 120), px(0.073 * height * place.s, 96), key.text, own(key, display)));
      const list = names.filter((t) => inIdea(t, idea));
      list.forEach((t, j) => {
        if (frame < t.from || frame >= t.to) return;
        const big = j % 2 === 1 || j === list.length - 1;
        laid.push(big
          ? h(FitText, { key: "n" + idea.k + "_" + j, style: { position: "absolute", left: Math.round(0.125 * width), width: Math.round(0.75 * width), top: Y(place, 0.252), height: px(0.088 * height * place.s, 110) }, innerStyle: { fontFamily: own(t, display), fontWeight: 700, fontSynthesis: "none", fontSize: px(0.078 * height * place.s, 96), lineHeight: 1.05, ...tone, whiteSpace: "nowrap" } }, t.text)
          : h("div", { key: "n" + idea.k + "_" + j, "data-fauve-accent": true }, h(FitText, { style: { position: "absolute", left: Math.round(0.25 * width), width: Math.round(0.5 * width), top: Y(place, 0.2), height: Math.max(48, Math.round(0.042 * height * place.s)) }, innerStyle: { fontFamily: own(t, body), fontWeight: 400, fontSynthesis: "none", fontSize: Math.max(40, Math.round(0.031 * height * place.s)), lineHeight: 1.1, ...tone, whiteSpace: "nowrap" } }, t.text)));
      });
    } else {
      // Her number very condensed and very bold, its words stacked at its right as tall as it, all at once (25 to 33 %).
      const key = bands.find((t) => inIdea(t, idea) && frame >= t.from && frame < t.to);
      const its = names.filter((t) => inIdea(t, idea) && frame >= t.from && frame < t.to);
      const tall = px(0.081 * height * place.s, 110);
      if (key) laid.push(h("div", { key: "num" + idea.k, style: { position: "absolute", left: 60, width: width - 120, top: Y(place, 0.246), height: Math.round(tall * 1.25), display: "flex", justifyContent: "center", alignItems: "center", gap: Math.round(0.03 * width) } },
        h("div", { style: { fontFamily: "'Anton', " + display, fontWeight: 400, fontSize: Math.round(tall * 1.36), lineHeight: 1, color: INK, textShadow: EDGE, whiteSpace: "nowrap" } }, key.text),
        its.length ? h("div", { style: { display: "flex", flexDirection: "column", justifyContent: "center" } },
          its.map((t, j) => h("div", { key: j, style: { fontFamily: own(t, body), fontWeight: 400, fontSize: Math.max(48, Math.round((tall / Math.max(3, its.length)) * 1.02)), lineHeight: 1.02, color: INK, textShadow: EDGE, whiteSpace: "nowrap" } }, t.text))) : null));
    }
  }

  // 7. Everything else she says, written by it (the engine's subtitles step aside: v1 kept them on her chest under its
  // words, and they said them a third time; Tristan: « les sous-titres ne sont plus utiles »): her words one by one on a
  // small line of very spaced small words above the big one, each on the image it is said, a line laid out whole from
  // its first word (it never moves), five words at most, emptied at the end of its phrase or when the next begins; never
  // a word written big at that moment (her keyword, a name of her list, her number and its words), nothing under her hook.
  const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const bigs = bands.concat(names);
  const isBig = (w) => bigs.some((t) => w.from >= t.from - 2 && w.from < t.to && plain(t.text).split(" ").includes(plain(w.w)));
  const busy = ideas.flatMap((i) => {
    if (i.kind === 0) return [];
    const its = names.filter((t) => inIdea(t, i));
    const keys = bands.filter((t) => inIdea(t, i));
    const from = (i.kind === 2 ? keys.concat(its) : its).map((t) => t.from);
    return from.length ? [[Math.min(...from), Math.max(...keys.concat(its).map((t) => t.to))]] : [];
  });
  // (Its one-letter words left out, as the original's « a » and « to ».)
  const ws = (spoken || []).filter((w) => w && plain(w.w).length > 1 && (!hook || w.from >= hook.to) && !isBig(w) && !busy.some(([a, b]) => w.from >= a && w.from < b));
  const lines = [];
  let line = [];
  const widthOf = (l) => l.reduce((a, w) => a + String(w.w).length * 29, 0) + Math.max(0, l.length - 1) * 0.05 * width;
  ws.forEach((w, i) => {
    const prev = ws[i - 1];
    // (A short word after four that runs on into the next starts the next line: a line never ends on one seen a tenth of
    // a second.)
    const next = ws[i + 1];
    const runs = next && next.from - w.to < 10 && !/[.!?…,;:]$/.test(String(w.w));
    if (prev && line.length && (w.from - prev.to >= 10 || /[.!?…,;:]$/.test(String(prev.w)) || line.length >= 5 || (line.length >= 4 && runs && plain(w.w).length <= 3) || widthOf(line.concat([w])) > width - 120)) { lines.push(line); line = []; }
    line.push(w);
  });
  if (line.length) lines.push(line);
  const shown = lines.find((l, i) => frame >= l[0].from && frame < Math.min(l[l.length - 1].to + 15, lines[i + 1] ? lines[i + 1][0].from - 2 : Infinity));
  if (shown) {
    const at = placeOf(shown[0].from);
    laid.push(h("div", { key: "line" + shown[0].from, style: { position: "absolute", left: 60, width: width - 120, top: Y(at, 0.196), height: px(0.036 * height * at.s, 62), display: "flex", justifyContent: "center", alignItems: "flex-end", gap: Math.round(0.05 * width * Math.min(1, at.s + 0.2)) } },
      shown.map((w, j) => h("span", { key: j, style: { fontFamily: body, fontWeight: 400, fontSize: px(0.027 * height * at.s, 48), lineHeight: 1.2, ...tone, whiteSpace: "nowrap", opacity: frame >= w.from ? 1 : 0 } }, String(w.w).replace(/[.!?…,;:]+$/, "")))));
  }

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, blurs, shown_, hookNode, laid);
}`;

export const motCle: MontageSkill = {
  key: "mot-cle",
  version: 2,
  bpm: BPM,
  // Her talk's pieces (the engine cuts them): as many as her pauses and ideas make.
  shots: [1, 40],
  // Her talking video, up to two other takes of it (two phones filming her at once), and a photo or video of each name
  // of a list she says.
  files: [1, 12],
  how: "Elle parle face caméra devant un fond uni, assise, la tête vers le milieu de l'image ; ses deux ou trois premiers mots glissent en grandes capitales de la gauche dès la première image ; puis, au-dessus de sa tête, ses mots s'écrivent un à un sur une petite ligne pendant que le mot clé de chaque idée glisse en grand dessous, à l'instant où elle le dit, et reste toute l'idée ; une liste qu'elle dit s'écrit deux noms à la fois, chacun dans la police qu'il évoque, à l'instant où elle le dit ; un chiffre qu'elle dit s'écrit très serré, ses deux ou trois mots empilés à côté ; la photo ou la vidéo qu'elle a de chaque nom de sa liste plein écran sous son nom, à l'instant où elle le dit ; le cadre ne change qu'entre deux idées ; tout ce qu'elle dit d'autre s'écrit sur la petite ligne, sans sous-titres en double.",
  end: false,
  texts: [],
  voice: {
    hook: "ses deux ou trois premiers mots quand ils annoncent déjà quelque chose (« Alors aujourd'hui », « Trois secrets », « Le meilleur pain ») ; null quand elle commence par « Bonjour, je suis… » (son premier mot clé ouvre alors)",
    key: "le mot qui porte l'idée, dit tôt (« SOINS », « BRUSHING », « PAINS », « EXERCICES ») ; pour une idée qui dit un chiffre (« 20 ans », « jour 12 », un prix), ce chiffre écrit en chiffres",
    ideas: [1, 6],
    items: "une liste qu'elle dit dans une idée (ses produits, ses prestations, des étapes, des ingrédients : « le gommage, le masque, l'huile »), chaque nom au moment où elle le dit ; pour l'idée d'un chiffre, les deux ou trois mots qui disent ce qu'il compte, tels qu'elle les dit (« ans », « de », « métier »)",
    max: { hook: 18, key: 12, item: 16 },
    fonts: ["item"],
    // Its code writes what she says itself (the small line), never twice: the engine's subtitles step aside (v1 kept them
    // on her chest, under its words that already said it).
    subtitles: "own",
    refs: "une photo ou une vidéo de chaque nom d'une liste qu'elle dit (son produit, son plat, sa prestation, l'étape qu'elle nomme), plein écran sous son nom à l'instant où elle le dit, la plus nette et la plus belle de ses fichiers pour ce nom ; jamais pour une idée entière (ses idées restent elle qui parle), jamais une image qui ne montre pas ce nom",
  },
  settings: [
    {
      name: "format",
      want: "le format : comme sa vidéo, vertical plein écran, ou horizontal",
      choices: [
        { value: "auto", says: "comme sa vidéo : vertical plein écran quand elle est verticale (comme l'original), horizontal sinon" },
        { value: "vertical", says: "vertical plein écran, recadré sur son visage, les mots au-dessus de sa tête" },
        { value: "horizontal", says: "sa vidéo entière dans une bande 16:9 au milieu, sur du noir, les mots dans le noir au-dessus" },
      ],
    },
  ],
  fonts: ["Anton"],
  timeline(n, { said: given }) {
    const said = given ?? nominalSaid(n, {});
    const duration = said.duration;
    const kinds = said.ideas.map(ideaKind);
    // Its texts as the original lays them: a keyword gone on its idea's last word (« FONTS » 0,1 s before « look » ends);
    // a list's names two at a time (a pair goes when she says the next one's first name, the last one with the cut to the
    // next idea), its keyword only before its list; a number's words with it, all at once, to the end of its idea.
    const texts: Record<string, { from: number; to: number }> = {};
    said.ideas.forEach((idea, k) => {
      const slot = `idee${k + 1}`;
      const end = said.texts[slot]?.to ?? idea.to;
      if (kinds[k] === 0) texts[slot] = { from: round(idea.at), to: round(Math.max(idea.at + KEY_LEAST, Math.min(end, idea.to - KEY_EARLY))) };
      else if (kinds[k] === 1) {
        const cut = said.shots.find((s) => s.idea === k + 1)?.start ?? end;
        texts[slot] = { from: round(idea.at), to: round(Math.min(end, idea.items[0]!.at)) };
        idea.items.forEach((item, j) => {
          const next = idea.items[j - (j % 2) + 2];
          texts[`${slot}_${j + 1}`] = { from: round(item.at), to: round(next ? Math.min(end, next.at) : Math.max(end, cut)) };
        });
      } else idea.items.forEach((_, j) => (texts[`${slot}_${j + 1}`] = { from: round(idea.at), to: round(end) }));
    });
    // A low whoosh under each word that slides in: her hook, each plain keyword.
    const sounds: SkillSound[] = [
      ...(said.hook ? [{ at: WHOOSH_AT, ...WHOOSH }] : []),
      ...said.ideas.flatMap((idea, k) => (kinds[k] !== 2 && (kinds[k] === 0 || idea.items[0]!.at > idea.at + 0.05) ? [{ at: round3(idea.at + WHOOSH_AT), ...WHOOSH }] : [])),
    ];
    // Its music waits for her first keyword and comes in on a beat after it (the original's beat 5, 2,82 s), 8 beats in at
    // the latest; loses its bass for 16 beats from the middle; cut with the picture.
    const first = said.ideas.find((_, k) => kinds[k] === 0)?.at ?? said.hook?.to ?? 0;
    const enter = round3(Math.min(ENTER_MOST, Math.ceil((first + BEAT) / BEAT - 1e-6)) * BEAT);
    const mid = Math.round(duration / 2 / BEAT) * BEAT;
    const back = Math.min(mid + THIN * BEAT, (Math.floor(duration / BEAT) - 2) * BEAT);
    const thin = back - mid >= THIN * BEAT * 0.5 && mid > enter ? [{ kind: "thin" as const, from: round3(mid), to: round3(back) }] : [];
    return {
      duration,
      shots: said.shots.map((s) => ({ start: s.start, end: s.end, want: "elle, face caméra, devant un mur uni", take: s.take, punch: s.punch })),
      texts,
      marks: Object.fromEntries(kinds.map((kind, k) => [`kind${k + 1}`, kind])),
      sounds,
      music: { ...(enter > 0.05 && enter < duration - 1 ? { pauses: [{ from: 0, to: enter }] } : {}), ...(thin.length ? { filters: thin } : {}), end: { at: round(duration) } },
      // Nothing of her is cut out: her face is followed (track), her wall's light read.
      cutouts: [],
    };
  },
  code: CODE,
};
