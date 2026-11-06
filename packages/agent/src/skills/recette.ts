import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Pas à pas raconté », version 1, written on its original's fiche (docs/fiches/recette.md: a creator's recipe of
// dumplings told by his voice-over, measured image by image at 30 i/s, its 56 cuts found image to image with its
// subtitles' band masked, its subtitles read on the pixel, its sound by bands, mid and side; Tristan: « c'est un effet
// que l'on veut pouvoir faire, pas exactement reproduire l'image »). 57 shots in 14 places, the phone posed at each one:
//   0 – 3,67     the result first: the finished dish set down on the counter in front of the lens (from the front, his
//                burgundy torso behind, never his head), then a piece lifted to the lens with chopsticks, close;
//   3,67 – 42,03 eleven steps, each from one place (from above on the wood, three from the front behind the counter),
//                each cut gesture by gesture in the same frame (43 cuts in the same place: the flour, then the yogurt,
//                then the salt, then the yeast in the same bowl), every cut on the start of the next gesture, the dead
//                time between two gestures cut away, at real speed;
//   42,03 – 44,97 the end: in his kitchen, at the lens, he tastes it, bites, and his face says it is good.
// All along, what he says is written in the middle of the picture (its lower case letters' middle at 50 % of the
// height, centred), in groups of one to three words that cut in and out with his voice: a bold serif (Georgia Bold to
// the eye, Gelasio 700 on Google Fonts, the same old-style figures), lower case, a warm white, a faint dark shadow, a
// size of about 64 px in 1080 × 1920. The cuts follow his voice, not a beat (they sit on a grid no better than random
// cuts); under his voice a soft bed twelve dB down, no drum to measure, no tempo: the model composes its own at 85 BPM,
// where a beat (21,2 images) lasts about one of its gestures, each gesture's length below in images of the original at
// that tempo, so its cuts fall where the original's do (within an image). A model is played without a voice (a
// voice-over takes the Reel to the chain): its words are written as the subtitles of a voice one does not hear, one
// group on each gesture, changed on the cut, each held as long as its gesture (a group of three words 1,4 s at least,
// the time to read it); the end's words under her face when it is followed (never on her mouth, as the original's).
// Nothing of the original's own: his voice, his face, his diet promise. Her photos stay still, her videos play. Its
// format follows her videos (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »).

const BPM = 85;
/** Images of 30 a second in one beat of its music at its own tempo: its gestures are measured in them. */
const IMAGES_A_BEAT = 1800 / BPM;
/** Its opening, in images of the original: the result set down in front of the lens, then a piece lifted to it. */
const RESULT = 31;
const LIFT = 79;
/** Its eleven steps, each gesture's length in images (docs/fiches/recette.md, « Déroulé »). */
const STEPS: number[][] = [
  [18, 23, 21, 23, 19, 23],
  [19, 17, 15, 19],
  [49, 17, 20, 20, 20, 30],
  [15, 11, 19, 20],
  [24, 27, 16, 20, 20, 19],
  [23, 18, 20, 12, 29],
  [19, 18, 22],
  [17, 19, 22],
  [18, 21, 15, 18, 33, 21, 29],
  [34, 27, 32, 36, 19],
  [27, 35, 23],
];
/** Its three steps filmed from the front, behind the counter (the dough, the meat, the sauce); the others from above. */
const FRONT = new Set([0, 3, 9]);
/** Its end: the piece held out to the lens, the bite, the face that says it is good. */
const TASTE = [26, 20, 42];
/** Fewer shots: the steps go, one gesture after the other (its last first), in this order (first, a middle one and the last stay). */
const GONE = [5, 7, 3, 6, 1, 9, 4, 2];
const MOST = 2 + STEPS.flat().length + TASTE.length;
const FEWEST = 12;
/** A Reel lasts 45 s at most (MAX_REEL_SECONDS): at a slower tempo, or with an ending card, its longest are held to it. */
const MAX_SECONDS = 45;
/** The engine's ending card: the Reel's last 1,6 s, her end held whole beats longer for it. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Its sections for n shots (images of the original at its tempo): its eleven steps thinned to three gestures each
 * (their middle ones out, the step with the most first), then whole steps out gesture by gesture (GONE), then the bite
 * at the end and a gesture of the first step; never under FEWEST. Each step keeps its place among the original's (`at`).
 */
export function recetteSections(n: number): { steps: { at: number; gestures: number[] }[]; taste: number[] } {
  const count = Math.max(FEWEST, Math.min(MOST, Math.round(n)));
  const steps = STEPS.map((g, at) => ({ at, gestures: [...g] }));
  const taste = [...TASTE];
  let total = MOST;
  while (total > count) {
    const thick = steps.filter((s) => s.gestures.length > 3);
    if (!thick.length) break;
    const s = thick.reduce((a, b) => (b.gestures.length > a.gestures.length || (b.gestures.length === a.gestures.length && sum(b.gestures) >= sum(a.gestures)) ? b : a));
    s.gestures.splice(Math.floor(s.gestures.length / 2), 1);
    total--;
  }
  for (const k of GONE) {
    while (total > count && steps[k]!.gestures.length) {
      steps[k]!.gestures.pop();
      total--;
    }
  }
  if (total > count) {
    taste.splice(1, 1);
    total--;
  }
  if (total > count) {
    steps[0]!.gestures.splice(1, 1);
    total--;
  }
  return { steps: steps.filter((s) => s.gestures.length), taste };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const until = Math.min(durationInFrames, endAt);

  // 1. Its frame: her videos full frame and upright, as the original; whole in a 16:9 band on black when most of them
  // are in width (or she asks). Its words sit in the middle of that frame.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: by, width, height: bh };
  const MID = by + Math.round(bh / 2);

  // 2. Its sections (frames): her result and the piece lifted to the lens up to its first step, each step (s1 … sK),
  // the end (she tastes, at the lens). Each gesture is one of her shots: a cut inside a section is its next gesture.
  const K = Math.max(0, Math.round(mark("steps", 0)));
  const TASTE = Math.round(mark("taste", durationInFrames));
  const S = [];
  for (let k = 1; k <= K; k++) S.push(Math.round(mark("s" + k, TASTE)));
  const FIRST = K ? S[0] : TASTE;
  const cutsIn = (a, b) => shots.map((s) => s.from).filter((f) => f > a + 2 && f < b - 2);

  // 3. Her words as a creator subtitles what he says: groups of one to three words, a group never ending on « de »,
  // « la », « tu »…, a number with its word, a verb with what it takes (« perdre du poids »), two short neighbours
  // together, from the end of the phrase (« des œufs » then « vraiment crémeux »); a comma, a full stop or a « / » always
  // a change. No punctuation shown: each mark stays in the page, hidden, so the whole text is there for the check.
  const LIGHT = new Set("le la les l un une des du de d au aux à a en et ou ni mais donc car que qu qui dont ce c cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je j tu t te il ils elle elles on nous vous se s y ne n me m lui sur sous dans par pour avec sans chez vers entre est es sont ai as ont va vas vont si deux trois quatre cinq six sept huit neuf dix douze quinze vingt trente cent mille".split(" "));
  const LEADS = new Set("le la les l un une des du de d au aux à en ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs deux trois quatre cinq six sept huit neuf dix douze quinze vingt trente cent mille".split(" "));
  const bare = (w) => w.toLowerCase().replace(/^.*['’]/, "").replace(/[^\p{L}\p{N}]/gu, "");
  const light = (w) => /^\d/.test(w) || /['’]$/.test(w) || LIGHT.has(bare(w));
  const leads = (w) => /^\d/.test(w) || /^(l|d|qu)['’]/i.test(w) || LEADS.has(bare(w));
  const phrase = (text) => {
    const words = [];
    let lead = "";
    String(text || "").split(/(\s+)/).forEach((p) => {
      if (!p) return;
      const last = words[words.length - 1];
      if (/^\s+$/.test(p)) { if (last) last.after += p; else lead += p; return; }
      const m = /^(.*?)([,;:.…\/]*)$/u.exec(p);
      if (!/[\p{L}\p{N}]/u.test(m[1])) { if (last) { last.after += p; last.brk = true; } else lead += p; return; }
      words.push({ w: m[1], after: m[2], brk: Boolean(m[2]) });
    });
    const units = [];
    let u = [];
    words.forEach((x) => { u.push(x); if (!light(x.w) || x.brk) { units.push(u); u = []; } });
    if (u.length) { const prev = units[units.length - 1]; if (prev && !prev[prev.length - 1].brk) prev.push(...u); else units.push(u); }
    const size = (g) => g.reduce((s, x) => s + x.w.length, 0) + g.length - 1;
    const full = (g) => g.filter((x) => !light(x.w)).length;
    const joins = (g, b) => !g[g.length - 1].brk && g.length + b.length <= 3 && size(g) + 1 + size(b) <= 18;
    const groups = units.slice();
    for (let i = 0; i + 1 < groups.length; i++) if (leads(groups[i + 1][0].w) && joins(groups[i], groups[i + 1])) groups.splice(i, 2, groups[i].concat(groups[i + 1]));
    for (let i = groups.length - 2; i >= 0; i--) if (joins(groups[i], groups[i + 1]) && full(groups[i].concat(groups[i + 1])) <= 2) groups.splice(i, 2, groups[i].concat(groups[i + 1]));
    return { lead, items: groups.map((g) => ({ show: g.map((x) => x.w).join(" "), after: g[g.length - 1].after, tokens: g.length, chars: size(g) })) };
  };

  // 4. Each group's time in its section: one group on each run of gestures when they fit, each one cut in on its
  // gesture's cut; else shared by what each one needs to be read (three words or more: 0,8 s plus 0,3 s a word, as the
  // check reads it), the longer ones longer, a change moved onto a cut when one is near.
  const needOf = (g) => (g.tokens >= 3 ? Math.ceil(24 * (0.8 + 0.3 * g.tokens)) + 2 : 15);
  const timed = (items, a, b) => {
    const m = items.length;
    if (!m || b <= a) return [];
    const cuts = cutsIn(a, b);
    const G = cuts.length + 1;
    const edges = [a].concat(cuts, [b]);
    const need = items.map(needOf);
    if (m <= G) {
      const at = items.map((_, j) => edges[Math.floor((j * G) / m)]).concat([b]);
      if (items.every((_, j) => at[j + 1] - at[j] >= need[j])) return items.map((_, j) => ({ from: at[j], to: at[j + 1] }));
    }
    const T = b - a;
    const N = need.reduce((s, x) => s + x, 0);
    const W = items.reduce((s, g) => s + g.chars + 4, 0);
    const d = items.map((g, j) => (N >= T ? (need[j] * T) / N : need[j] + ((T - N) * (g.chars + 4)) / W));
    const at = [a];
    for (let j = 0; j < m; j++) at.push(at[j] + d[j]);
    at[m] = b;
    for (let j = 1; j < m; j++) {
      const near = cuts.filter((c) => Math.abs(c - at[j]) <= 8 && c - at[j - 1] >= Math.min(need[j - 1], d[j - 1]) && at[j + 1] - c >= Math.min(need[j], d[j]));
      if (near.length) at[j] = near.reduce((x, y) => (Math.abs(y - at[j]) < Math.abs(x - at[j]) ? y : x));
    }
    return items.map((_, j) => ({ from: Math.round(at[j]), to: Math.round(at[j + 1]) }));
  };

  // Its texts: the hook over her result and the piece lifted; its steps' words, in its band texts one after the other
  // (« / » between two steps), each step's over that step (more than its steps: the last step tells the rest); the
  // end's over her tasting.
  const hook = reelTexts.find((t) => t.role === "hook");
  const bands = reelTexts.filter((t) => t.role === "band");
  const fin = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== fin && bands.indexOf(t) < 0);
  const told = React.useMemo(() => {
    const part = (text, a, b) => { const p = phrase(text); return { lead: p.lead, items: p.items, times: timed(p.items, a, b) }; };
    const out = [];
    if (hook) out.push({ t: hook, parts: [part(hook.text, 0, FIRST)] });
    if (bands.length) {
      const chunks = bands.flatMap((t) => String(t.text).match(/[^\/]*\/?\s*/g).filter(Boolean));
      const kept = K ? chunks.slice(0, K - 1).concat(chunks.length >= K ? [chunks.slice(K - 1).join("")] : []) : [chunks.join("")];
      const t = { from: Math.min.apply(null, bands.map((x) => x.from)), to: Math.max.apply(null, bands.map((x) => x.to)) };
      out.push({ t, parts: kept.map((c, k) => part(c, K ? S[k] : FIRST, K ? (k + 1 < K ? S[k + 1] : TASTE) : TASTE)) });
    }
    if (fin) out.push({ t: fin, parts: [part(fin.text, TASTE, until)] });
    return out;
  }, [reelTexts, K, FIRST, TASTE, until, n]);

  // 5. Where her words sit on each shot: in the middle of the frame, as the original; under the face of someone who
  // looks at the lens (her tracked face), never on it; at the end, where she tastes at the lens, lower by default.
  const spot = React.useMemo(() => shots.map((s, i) => {
    const late = s.from >= TASTE - 1;
    const base = late ? MID + Math.round(bh * 0.12) : MID;
    if (typeof track !== "function") return base;
    const faces = [];
    for (let f = Math.max(0, s.from) + 1; f < Math.min(durationInFrames, s.from + s.durationInFrames); f += 5) {
      const seen = track(f, { shot: i, ...laid }) || {};
      (seen.faces || []).forEach((q) => { if (q && Number.isFinite(q.y) && Number.isFinite(q.height)) faces.push(q); });
    }
    if (!faces.length) return base;
    const top = Math.min.apply(null, faces.map((q) => q.y - q.height / 2));
    const bottom = Math.max.apply(null, faces.map((q) => q.y + q.height * 0.62));
    const clear = (y) => y + 62 < top || y - 62 > bottom;
    if (clear(MID)) return MID;
    const low = Math.round(bottom + 74);
    if (low + 62 <= Math.min(by + bh, height * 0.75) - 8) return low;
    const high = Math.round(top - 74);
    if (high - 62 >= Math.max(by, 90)) return high;
    return base;
  }), [shots, track, TASTE, MID, bh, durationInFrames]);
  const Y = n ? spot[cur] : MID;

  // 6. Its subtitle: her display font (its pairing's Gelasio, a Georgia twin) in bold, a warm white, a soft shadow (a
  // little more than the original's faint one: her pale dough, her white flour, a yellow pan); one group seen at a time,
  // cut in and out; the others in the page, hidden, so the whole text is there.
  const serif = "'" + brand.displayFont + "', 'Gelasio', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Gelasio', Georgia, serif";
  const WHITE = "#fefaf6";
  const shade = "0 2px 4px rgba(0,0,0,0.45), 0 0 2px rgba(0,0,0,0.35), 0 0 16px rgba(0,0,0,0.3)";
  const hidden = { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1, whiteSpace: "pre" };
  const lines = told.filter((x) => frame >= x.t.from && frame < Math.min(x.t.to, endAt)).map((x, ti) =>
    h("div", { key: "t" + ti },
      x.parts.map((p, pi) => h(React.Fragment, { key: "p" + pi },
        p.lead ? h("span", { style: hidden }, p.lead) : null,
        p.items.map((g, gi) => {
          const span = p.times[gi];
          const on = Boolean(span) && frame >= span.from && frame < span.to;
          return h(React.Fragment, { key: "g" + gi },
            on
              ? h(FitText, { key: "w-" + pi + "-" + gi + "-" + g.show, style: { position: "absolute", left: 140, top: Y - 52, width: 800, height: 104 }, innerStyle: { fontFamily: serif, fontWeight: 700, fontSize: 64, lineHeight: 1.15, color: WHITE, textShadow: shade, whiteSpace: "nowrap", textAlign: "center" } }, g.show)
              : h("span", { style: hidden }, g.show),
            g.after ? h("span", { style: hidden }, g.after) : null);
        })))));

  // 7. Her shots full frame in its frame, as filmed: a video plays, a photo stays still; nothing zooms nor moves.
  const film = n ? h(Footage, { key: "shot", shot: cur, style: { left: 0, top: 0, width, height: bh } }) : null;

  // 8. Its ending card, when the Reel has one (the original ends on his face): her last shot under a soft veil, her title
  // in the subtitle's serif, a line under it.
  const card = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { position: "absolute", left: 0, top: by, width, height: bh, background: "rgba(16,11,8,0.42)" } }),
        h(FitText, { key: "ct-" + end.title, style: { position: "absolute", left: 140, top: MID - 150, width: 800, height: 196 }, innerStyle: { fontFamily: serif, fontWeight: 700, fontSize: 84, lineHeight: 1.08, color: WHITE, textShadow: shade, textAlign: "center", textWrap: "balance" } }, end.title),
        end.subtitle ? h(FitText, { key: "cs-" + end.subtitle, style: { position: "absolute", left: 140, top: MID + 58, width: 800, height: 128 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 52, lineHeight: 1.15, color: WHITE, textShadow: shade, textAlign: "center", textWrap: "balance" } }, end.subtitle) : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain line at the top of its frame, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.max(100, by - 150 - i * 120) : 170 + i * 130, height: 110 }, innerStyle: { fontFamily: serif, fontWeight: 700, fontSize: 52, lineHeight: 1.15, color: WHITE, textAlign: "center", textShadow: shade } }, t.text));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } },
    h("div", { style: { position: "absolute", left: 0, top: by, width, height: bh, overflow: "hidden" } }, film),
    card, lines, extra);
}`;

/** What each of its slots wants (for the filler), its next gestures the same video just after. */
const RESULT_WANT =
  "son résultat fini, de face, le téléphone posé à hauteur de son plan de travail : elle le pose devant l'objectif (le plat sur le comptoir, le bouquet sur la table, la pièce sur l'établi) ; ses mots commencent dessus dès la première image";
const LIFT_WANT =
  "le même résultat de tout près : ce qu'on en prend ou qu'on en montre, soulevé vers l'objectif (une bouchée tenue, une fleur, une mèche, l'anse d'une tasse) ; la même vidéo que la case 1 un peu plus loin, ou une autre";
const NEXT = "la même vidéo que la case précédente, juste après : le geste suivant de cette étape (sans les temps morts entre deux gestes)";
const TASTE_WANT =
  "la fin : elle, ou un client, goûte, sent, essaie ou reçoit le résultat, face à l'objectif, de près : son visage et sa réaction (sinon son résultat de tout près une dernière fois)";
const TASTE_NEXT = "la même vidéo que la case précédente, juste après : sa réaction";
const stepWant = (k: number, of: number, front: boolean) =>
  `l'étape ${k} sur ${of}, filmée d'un seul endroit, le téléphone posé ${front ? "de face, à hauteur de son plan de travail, elle derrière (ses mains, pas forcément sa tête), ou de dessus" : "au-dessus de son plan de travail (de dessus), ou de face"} : son premier geste (ce qu'on pose, verse, coupe, mélange ou plie)`;

export const recette: MontageSkill = {
  key: "recette",
  // 2: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 2,
  bpm: BPM,
  shots: [FEWEST, MOST],
  files: [4, 16],
  // Its gestures follow the tempo a little (30 to 37 s at 38 shots between 102 and 85 BPM); its longest held to 45 s.
  tempo: [72, 102],
  how: "Un pas à pas raconté en sous-titres : son résultat fini posé devant l'objectif, puis de tout près ce qu'on en prend ; puis chaque étape d'un seul endroit (de dessus, ou de face derrière son plan de travail), coupée geste par geste dans le même plan (ses cases suivantes la même vidéo un peu plus loin), le téléphone posé ; tout du long, ses mots écrits au milieu de l'image comme les sous-titres d'une voix, en petits groupes d'un à trois mots dans une serif grasse blanche, un groupe par geste ; à la fin, elle ou un client goûte, essaie ou reçoit le résultat face à l'objectif.",
  end: true,
  texts: [
    {
      slot: "accroche",
      role: "hook",
      want: "l'accroche, écrite en sous-titres sur son résultat fini dès la première image : ce que son savoir-faire promet à celle qui regarde, une phrase de 4 à 10 mots, en minuscules, au tutoiement (une forme comme « si tu veux un bouquet qui tient deux semaines », « le dégradé qu'on me demande le plus ») ; rien d'inventé, aucune promesse de santé ou de régime",
      max: 64,
      required: true,
    },
    {
      slot: "etapes_1",
      role: "band",
      want: "ses étapes racontées, dans l'ordre, une par étape de ses cases (« l'étape … sur … »), séparées par « / » : chacune quelques mots simples en minuscules, ce qu'on y voit faire, une virgule là où le sous-titre change, un groupe d'un à trois mots par geste (une forme comme « farine, yaourt, sel, levure / tu tailles, tes légumes / à feu vif ») ; rien d'inventé ; quand elles n'y tiennent pas toutes, la suite dans « etapes_2 » puis « etapes_3 »",
      max: 118,
      required: true,
    },
    {
      slot: "etapes_2",
      role: "band",
      want: "facultatif : la suite de « etapes_1 » quand ses étapes n'y tiennent pas toutes, les étapes suivantes dans l'ordre, séparées par « / », de la même façon ; vide sinon",
      max: 118,
      required: false,
    },
    {
      slot: "etapes_3",
      role: "band",
      want: "facultatif : la suite de « etapes_2 » quand ses étapes n'y tiennent toujours pas, de la même façon ; vide sinon",
      max: 118,
      required: false,
    },
    {
      slot: "fin",
      role: "caption",
      want: "le mot de la fin sur sa réaction, 2 à 6 mots en minuscules (une forme comme « et tu te régales », « et voilà le travail »)",
      max: 40,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran comme l'original, ou ses vidéos horizontales entières sur du noir",
      choices: [
        { value: "vertical", says: "vertical plein écran comme l'original, ses vidéos en largeur recadrées sur leur sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 sur du noir, ses mots au milieu de la bande", band: true },
        { value: "auto", says: "comme ses vidéos (vertical plein écran ; horizontal 16:9 sur du noir quand la plupart sont en largeur)" },
      ],
    },
  ],
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const { steps, taste } = recetteSections(n);
    const gestures = [RESULT, LIFT, ...steps.flatMap((s) => s.gestures), ...taste].map((f) => f / IMAGES_A_BEAT);
    // With an ending card, her last gesture held whole beats longer (the card's 1,6 s), as « Recette cosy » holds its loop.
    const last = gestures.length - 1;
    if (end) gestures[last] = gestures[last]! + Math.ceil(END_CARD / beat - 1e-6);
    // Never past 45 s: at a slower tempo, or with its card, its longest versions are held to it, every gesture alike.
    const squeeze = Math.min(1, MAX_SECONDS / (sum(gestures) * beat));
    const spans = beatSpans(bpm, gestures.map((b) => b * squeeze));
    const duration = spans.at(-1)!.end;
    const firsts: number[] = [];
    let at = 2;
    for (const s of steps) {
      firsts.push(at);
      at += s.gestures.length;
    }
    const tasted = spans[at]!.start;
    const wants = [
      RESULT_WANT,
      LIFT_WANT,
      ...steps.flatMap((s, k) => s.gestures.map((_, j) => (j === 0 ? stepWant(k + 1, steps.length, FRONT.has(s.at)) : NEXT))),
      ...taste.map((_, j) => (j === 0 ? TASTE_WANT : TASTE_NEXT)),
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its hook over her result and the piece lifted; each step's words over its step; her end's over her tasting.
      texts: {
        accroche: { from: 0, to: spans[1]!.end },
        // Its steps' words over all its steps, in three slots that follow one another (a plan's text holds 120 signs):
        // its code reads their phrases in order, one for each step.
        etapes_1: { from: spans[2]!.start, to: tasted },
        etapes_2: { from: spans[2]!.start, to: tasted },
        etapes_3: { from: spans[2]!.start, to: tasted },
        fin: { from: tasted, to: round(end ? duration - END_CARD : duration) },
      },
      marks: {
        lift: toFrame(spans[1]!.start),
        steps: steps.length,
        ...Object.fromEntries(firsts.map((i, k) => [`s${k + 1}`, toFrame(spans[i]!.start)])),
        taste: toFrame(tasted),
      },
    };
  },
  code: CODE,
};
