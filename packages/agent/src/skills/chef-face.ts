import { nominalSaid, type MontageSkill } from "../skills.ts";

// « Le plat, puis la dégustation », version 1, written on its original's fiche (docs/fiches/chef-face.md: 59,9 s measured
// image by image at 30 i/s, its 73 chunks of words read on the pixels, its sound by bands; Tristan: « c'est un effet que
// l'on veut pouvoir faire, pas exactement reproduire l'image »). A food creator tells his recipe in his own voice from the
// first image to the last, and his voice leads everything: no music one hears, no beat to cut on. As the original:
//   the dish first   his dish being finished, nine close-ups of 0,47 to 1,67 s (0,92 on average), each a whole gesture,
//                    then the bite on a spoon, before we see him (0 – 10,2 s);
//   the tasting      a cut to him at the table, the dish in front: four quick reactions (eating, eyes closed), then he
//                    talks to the camera (10,2 – 15,67 s); again at the end;
//   the steps        each step's close-up cut in on the word that names it, held to the next (20,2 – 46,4 s);
//   his words        all of them on screen two to four at a time, cut in at once as he says them, cream (#F2E9DC) very
//                    condensed bold capitals with a soft dark shadow, on one line at 59,3 % of the height; the strong
//                    words of an idea 1,75 times bigger in the same place;
//   his formula      his last words 3,5 times bigger on two lines at once, on his face, after a silence (59,03 s).
// Timed on her voice (SkillVoice): her video where she talks at the table is the Reel, cut by the engine (her « euh » and
// long pauses out), its frame changing on the first word of her next idea (`cut: attack`, the original's cuts), tighter
// every other idea. Her other files are laid on what she says (`refs`): her first idea's own images one after the other
// full frame (`turns`: 1,5 s at most each, at their own pace; her dish being finished, the bite last), a later idea's the
// same before her face (her videos tasting), each name of a list she says (her steps) from the instant she says it to the
// next. Her words written by its code (`subtitles: own`); its filler picks each idea's strong words (two to four, as she
// says them) and her formula (her last idea's: « Bon appétit ! »). Her music under her voice (the original's gestures'
// own sound, which images laid on her words cannot give), cut dead on her formula as his silence before it. Its format as
// her talking video: upright, every shot full frame; in width, every shot whole in a 16:9 band on black.

const BPM = 96;
/** Her own images of an idea one after the other, each this long at most (s): the original's dish shots 0,47 to 1,67 s, its tastings 0,5 to 0,7. */
const TURNS = 1.5;
/** A strong word stays this long after its last word at most (s), never into her next word. */
const STRONG_HOLD = 0.25;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, texts, track, spoken }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const list = shots || [];
  const talkN = Math.max(1, Math.min(list.length, Math.round(mark("said_shots", list.length))));
  const refsN = Math.max(0, Math.min(list.length - talkN, Math.round(mark("said_refs", 0))));
  const shotAt = (f) => { let k = 0; for (let i = 0; i < talkN; i++) if (list[i] && list[i].from <= f) k = i; return k; };
  const cur = shotAt(frame);
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Arial Narrow', sans-serif";

  // 1. Its frame, as her talking video: upright, every shot full frame; in width (or on her word), every shot whole in a
  // 16:9 band on black, her words on the same line.
  const format = setting("format", "auto");
  const wideTalk = (Number(list[0] && list[0].aspect) || 0.5625) > 1.15;
  const band = format === "horizontal" || (format === "auto" && wideTalk);
  const BH = Math.round((W * 9) / 16);
  const BOX = band ? { left: 0, top: Math.round((H - BH) / 2), width: W, height: BH } : { left: 0, top: 0, width: W, height: H };
  const laid = { position: "absolute", left: BOX.left, top: BOX.top, width: BOX.width, height: BOX.height };

  // 2. Her images on what she says (after her talk's shots), each on its own span: an idea's own one after the other (the
  // engine shares the idea out among them), each name of a list from the instant she says it to the next.
  const refs = Array.from({ length: refsN }, (_, i) => {
    const s = list[talkN + i];
    const from = Math.round(mark("said_ref" + (i + 1) + "_from", s.from));
    return { i: talkN + i, from, to: Math.max(from + 1, Math.round(mark("said_ref" + (i + 1) + "_to", from + s.durationInFrames))) };
  });

  // 3. Her words, each at its frame; each idea's strong words (its band text, at its moment) and her formula (her last
  // idea's, held to the end): from it on, nothing but her face and her formula.
  const ideasN = Math.max(0, Math.round(mark("said_ideas", 0)));
  const bands = (reelTexts || []).filter((t) => t && t.role === "band").sort((a, b) => a.from - b.from);
  const formula = ideasN >= 2 ? bands.filter((t) => t.to >= D - 1).pop() || null : null;
  const strong = bands.filter((t) => t !== formula);
  const hush = formula ? formula.from : Infinity;
  const words = (Array.isArray(spoken) ? spoken : [])
    .filter((w) => w && typeof w.w === "string" && Number.isFinite(w.from))
    .map((w) => ({ w: String(w.w), from: Math.round(w.from), to: Math.round(Number.isFinite(w.to) ? w.to : w.from + 8) }))
    .sort((a, b) => a.from - b.from);
  const inStrong = (f) => strong.some((t) => f >= t.from && f < t.to);
  const free = words.filter((w) => !inStrong(w.from) && w.from < hush);
  // Two to four at a time, 22 signs at most, as the original's: a new chunk after a comma, a full stop or a pause, and
  // before a strong word.
  const signs = (c) => c.reduce((n, w) => n + w.w.length, 0) + Math.max(0, c.length - 1);
  const chunks = [];
  let c = [];
  free.forEach((w, i) => {
    const prev = free[i - 1];
    const cut = prev && c.length && (w.from - prev.to >= 8 || /[.!?…,;:]$/.test(prev.w) || c.length >= 4 || signs(c.concat([w])) > 22 || strong.some((t) => t.from > prev.from && t.from <= w.from));
    if (cut) { chunks.push(c); c = []; }
    c.push(w);
  });
  if (c.length) chunks.push(c);
  // Each from her first word of it, replaced by the next one; 0,4 s after its last word when she pauses; never into a
  // strong word nor her formula.
  const shown = chunks.map((x, k) => {
    const from = x[0].from;
    const ends = strong.map((t) => t.from).filter((f) => f > from).concat([hush, chunks[k + 1] ? chunks[k + 1][0].from : Infinity, x[x.length - 1].to + 12]);
    return { words: x, from, to: Math.min.apply(null, ends) };
  });
  const up = (s) => String(s || "").toUpperCase().replace(/(\d)(\s?)H(?![A-ZÀ-ÖØ-Ý])/g, "$1$2h");
  const chunkText = (x) => x.map((w) => w.w).join(" ").replace(/[,;:]+$/, "").replace(/([^.])\.$/, "$1");

  // 4. The line her words are set on, the original's at 59,3 % of the height; on her own shots off her face (read once a
  // shot), as tall as each text is: under her chin when it fits there, else above her head.
  const LINE = Math.round(H * 0.593);
  const faces = React.useMemo(() => Array.from({ length: talkN }, (_, k) => {
    if (typeof track !== "function" || !list[k]) return null;
    const seen = track(Math.round(list[k].from + list[k].durationInFrames / 2), { shot: k, left: BOX.left, top: BOX.top, width: BOX.width, height: BOX.height }) || {};
    const found = (seen.faces || []).filter((x) => x && x.width > 0 && x.height > 0);
    if (!found.length) return null;
    const face = found.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    return { top: face.y - face.height * 0.95, bottom: face.y + face.height * 0.75 };
  }), [talkN, track]);
  const place = (face, half) => {
    if (!face || face.bottom < LINE - half - H * 0.01 || face.top > LINE + half + H * 0.01) return LINE;
    const under = face.bottom + half + H * 0.02;
    if (under + half <= H * 0.75) return Math.round(under);
    const over = face.top - half - H * 0.02;
    return over - half >= H * 0.06 ? Math.round(over) : LINE;
  };

  // 5. What plays: her image of now, else her talk; from her formula on, her face alone.
  const now = frame >= hush ? null : refs.find((r) => frame >= r.from && frame < r.to) || null;
  const picture = now ? h(Footage, { key: "ref" + now.i, shot: now.i, at: now.from, style: laid }) : list.length ? h(Footage, { key: "her" + cur, shot: cur, style: laid }) : null;
  const face = now ? null : faces[cur] || null;

  // 6. Her words in her title font in capitals, cream, a soft dark shadow, no box: small; her strong words 1,75 times as
  // big; her formula 3,3 times, on two lines, to the end. Each box centred, left of the apps' buttons, above the bottom
  // quarter.
  const S = Math.max(48, Math.round(H * 0.0285));
  const B = Math.round(S * 1.75);
  const F = Math.round(S * 3.3);
  const type = (size) => ({ fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: size, lineHeight: 1, letterSpacing: "0.01em", color: "#f2e9dc", textShadow: "0 0 7px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.5)", textAlign: "center", whiteSpace: "nowrap" });
  const at = (tall) => { const y = place(face, tall / 2); return { position: "absolute", left: 140, width: W - 280, top: Math.round(Math.max(H * 0.06, Math.min(H * 0.75 - tall, y - tall / 2))), height: Math.round(tall) }; };
  const strongNow = strong.find((t) => frame >= t.from && frame < t.to) || null;
  const chunkNow = !strongNow && frame < hush ? shown.find((s) => frame >= s.from && frame < s.to) || null : null;
  const said = formula && frame >= formula.from
    ? h(FitText, { key: "f-" + up(formula.text), style: at(F * 2.15), innerStyle: { ...type(F), lineHeight: 0.95, whiteSpace: "normal", textWrap: "balance" } }, up(formula.text))
    : strongNow
      ? h(FitText, { key: "k-" + up(strongNow.text), style: at(B * 1.3), innerStyle: type(B) }, up(strongNow.text))
      : chunkNow
        ? h(FitText, { key: "s-" + chunkNow.from, style: at(S * 1.45), innerStyle: type(S) }, up(chunkText(chunkNow.words)))
        : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, picture, said);
}`;

export const chefFace: MontageSkill = {
  key: "chef-face",
  version: 1,
  // Its original has no music one hears and no beat to count: its tempo only sets the music under her voice (her cuts are hers).
  bpm: BPM,
  // Her talk's pieces (the engine cuts them): as many as her pauses and ideas make.
  shots: [1, 40],
  // Her video where she talks, and at least two images of her dish; up to fifteen.
  files: [3, 16],
  how: "Elle raconte son plat face caméra et sa voix mène tout : d'abord le plat qui se finit, ses gros plans plein cadre l'un après l'autre sur sa première idée, avant qu'on la voie (la bouchée en dernier) ; puis elle à table qui goûte et qui parle, ses vidéos où elle goûte passant vite avant son visage ; chaque étape qu'elle nomme plein cadre à l'instant où elle la dit ; tous ses mots écrits deux à quatre à la fois au milieu de l'écran, en capitales serrées crème, les mots forts de chaque idée en grand ; sa formule de fin en très grand sur deux lignes sur son visage, la musique coupée net dessous.",
  end: false,
  texts: [],
  voice: {
    key: "les mots forts de l'idée, deux à quatre mots qu'elle dit d'un trait, tels qu'elle les dit (« le goût de la punition », « départ à froid », « 48 heures de pousse »), écrits en grand à l'instant où elle les dit ; pour la dernière idée, sa formule de fin, ses derniers mots tels qu'elle les dit (« Bon appétit ! », « Venez la goûter ! », « À samedi ! »), écrits en très grand sur deux lignes jusqu'à la fin",
    ideas: [2, 8],
    items: "les étapes ou les ingrédients qu'elle nomme l'un après l'autre (« la pâte, la sauce, la mozzarella », « on saisit, on déglace, on nappe »), chaque nom au moment où elle le dit, avec la vidéo de ses fichiers qui le montre, plein écran jusqu'au suivant",
    max: { key: 28, item: 24 },
    cut: "attack",
    refs: "une vidéo (ou une photo) de son plat et de ce qu'elle raconte : pour la première idée, trois à huit vidéos du plat qui se finit (la sauce versée, le dressage, la dernière touche, le plat fini), la bouchée prise à la cuillère ou à la fourchette en dernier, qui défilent plein écran avant qu'on la voie ; pour une idée où elle goûte, ses vidéos où elle goûte (la bouchée, les yeux fermés), qui passent vite avant son visage ; pour chaque étape ou ingrédient qu'elle nomme, la vidéo qui le montre",
    subtitles: "own",
    turns: TURNS,
  },
  settings: [
    {
      name: "format",
      want: "le format : comme sa vidéo où elle parle, tout plein cadre en vertical, ou ses vidéos entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme sa vidéo où elle parle : verticale, tout plein cadre (comme l'original) ; horizontale, tout dans une bande 16:9 sur du noir" },
        { value: "vertical", says: "tout plein cadre en vertical, ses vidéos horizontales recadrées" },
        { value: "horizontal", says: "chaque vidéo entière dans une bande 16:9 au milieu, sur du noir, ses mots sur la même ligne" },
      ],
    },
  ],
  timeline(n, { said: given }) {
    const said = given ?? nominalSaid(n, {});
    const duration = said.duration;
    const last = said.ideas.length - 1;
    const signed = said.ideas.length >= 2;
    // Each idea's strong words from the instant she says them to the end of their last word (a breath more, never into her
    // next word); her formula, her last idea's, from the instant she says it to the end; the names of her lists have no
    // text of their own (their images show them, her words are all written).
    const texts: Record<string, { from: number; to: number }> = {};
    said.ideas.forEach((idea, k) => {
      const slot = `idee${k + 1}`;
      if (signed && k === last) texts[slot] = { from: round(idea.at), to: round(duration) };
      else {
        const count = Math.max(1, idea.text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length);
        const end = Math.min(idea.words[1], idea.key + count - 1);
        const said_ = said.words[end]?.end ?? idea.at + 0.6;
        const next = said.words[end + 1]?.start ?? duration;
        texts[slot] = { from: round(idea.at), to: round(Math.min(duration, Math.max(said_, Math.min(said_ + STRONG_HOLD, next)))) };
      }
      idea.items.forEach((item, j) => (texts[`${slot}_${j + 1}`] = { from: round(item.at), to: round(item.at) }));
    });
    const formula = signed ? said.ideas[last]!.at : null;
    return {
      duration,
      shots: said.shots.map((s) => ({ start: s.start, end: s.end, want: "elle (ou le chef) à table, face caméra, son plat devant elle", take: s.take, punch: s.punch })),
      texts,
      marks: {},
      // Her music under her voice from the first image, cut dead as she says her formula (his silence before it), else faded with the picture.
      music: formula !== null && formula > 0.5 && formula < duration - 0.3 ? { end: { at: round3(formula) } } : { end: { at: round(duration), fade: 0.4 } },
      // Nothing of her cut out: her face is followed (track), her words set off it.
      cutouts: [],
    };
  },
  code: CODE,
};
