import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « La pièce qui se rallume », Tristan's own idea: no original Reel, written as a design (docs/fiches/rallume.md). Her
// place in the dark, then what it has several of (her lamps, her bottles, her cups, her plants: named by the filler from
// her room shot, up to four kinds, « every … » for each one of them) lights up again one piece after the other, faster
// and faster, each at its own light with a warm halo spilling on the room and a soft click, the music muffled as through
// a wall; then the whole room at once on the downbeat, the music opening, her name lighting up like a sign; then the life
// of her place cut on the beat; at the end everything goes off at once and the Reel loops into its dark opening. Its
// music is a warm late-night groove at 96 BPM, every length below in its beats:
//   0 – 8      her room shot: dark (a fifth of its light, cooler); its pieces light on beats 0, 1, 1,5, 2, 2,5, 2,75, 3
//              and 3,25 (several on a step when she has many, the room's own light coming back a notch, with a flicker,
//              on the steps left when she has few or none); everything at once on beat 4, her name lit with it;
//   8 – …      the life of her place: shots of one, one and two beats, more of them held two beats for a longer Reel;
//   last       her room once more, lit two beats, then off at once (the music muffled again, her name still lit), a
//              beat of dark, or her ending card's time when she has one.
// Played horizontal 16:9 on black when her videos are (her name lit above the picture, its small line under it, both
// kept to the end), else full frame (her name in the calm part of her room shot, then again in the dark at the end). Her
// photos stay still, her videos play. No zoom, no push: clean cuts (the editor's rule; no original asks otherwise).

const BPM = 96;
/** Her room shot, in beats: dark, then lit with her name. */
const ROOM = 8;
/** Its pieces light on these beats of the room shot (faster and faster), and the whole room on ALL. */
const STEPS = [0, 1, 1.5, 2, 2.5, 2.75, 3, 3.25];
const ALL = 4;
/** The life of her place, in beats a shot (fewer shots: the first ones); more shots, for a length she asks for: two beats each. */
const LIFE = [1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2];
const MORE = 2;
/** The last shot lit this long, then everything off, then dark this long (or her ending card's time, on whole beats). */
const LIT = 2;
const DARK = 1;
const END_CARD = 1.6;
/** A soft click on each light, a heavier one when the whole room comes on and when it goes off. */
const CLICK = { sound: "light switch click", seconds: 0.5 };
const CLUNK = { sound: "heavy light switch clunk", seconds: 0.5 };
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** What each shot of the life of her place wants, in turn. */
const LIFE_WANTS = [
  "la vie de son lieu : quelqu'un qu'on sert, qu'on conseille ou qui choisit",
  "un détail de près : des mains, un geste, ce qu'elle vend",
  "des gens ensemble : une conversation, un rire, une table",
  "un geste de son métier, de près",
  "quelqu'un qui entre, qui arrive ou qui s'installe",
  "un détail de son lieu sous ses lumières : ses étagères, sa vitrine, ses plantes",
  "quelqu'un qui goûte, qui essaie, qui regarde ou qui sourit",
  "son lieu plein et vivant, plus large",
];

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const STEPS = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => mark("step_" + k, NaN)).filter(Number.isFinite);
  const ALL = mark("all", -100);
  const OFF = mark("off", durationInFrames + 1);
  const endAt = end ? end.from : durationInFrames + 1;

  // Its frame: horizontal 16:9 on black when her videos are mostly horizontal (or she asks), else the whole vertical
  // frame; every place below is a share of it.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const full = { position: "absolute", left: 0, top: 0, width: bw, height: bh };
  const since = frame - ALL;
  const dark = (cur === 0 && frame < ALL) || frame >= OFF;

  // 1. Her things in her room shot, kind by kind (her lights first), each in reading order, as the filler named them:
  // which pieces and on which step taken where the room is still dark (seen inside the frame), placed where they are now.
  const REF = Math.max(0, ALL - 1);
  const KINDS = cur === 0 ? [
    [SubjectParts(shots[0], REF, laid, "@lampes", 1), SubjectParts(shots[0], frame, laid, "@lampes", 1), () => h(Subject, { shot: 0, object: "@lampes", style: full }), 1],
    [SubjectParts(shots[0], REF, laid, "@rangees", 1), SubjectParts(shots[0], frame, laid, "@rangees", 1), () => h(Subject, { shot: 0, object: "@rangees", style: full }), 0.45],
    [SubjectParts(shots[0], REF, laid, "@tables", 1), SubjectParts(shots[0], frame, laid, "@tables", 1), () => h(Subject, { shot: 0, object: "@tables", style: full }), 0.45],
    [SubjectParts(shots[0], REF, laid, "@plantes", 1), SubjectParts(shots[0], frame, laid, "@plantes", 1), () => h(Subject, { shot: 0, object: "@plantes", style: full }), 0.35],
  ] : [];
  const inside = (p) => p && p.w > 2 && p.h > 2 && p.x + p.w / 2 > 0 && p.x + p.w / 2 < bw && p.y + p.h / 2 > 0 && p.y + p.h / 2 < bh;
  const pieces = [];
  KINDS.forEach((k, kind) => k[0].forEach((p, i) => { if (inside(p) && pieces.length < 48) pieces.push({ kind, box: k[1][i] || p, warm: k[3] }); }));
  // Many: one or two on each step; few: one a step from the first, the room's own light coming back a notch on each step left.
  const m = pieces.length;
  const S = STEPS.length;
  pieces.forEach((p, j) => { p.at = STEPS[m >= S ? Math.floor((j * S) / m) : j]; });
  const lit = cur === 0 && frame < ALL ? pieces.filter((p) => frame >= p.at) : [];
  const notches = cur === 0 && frame < ALL && m < S ? STEPS.slice(m).filter((s) => frame >= s) : [];
  const lastNotch = notches.length ? notches[notches.length - 1] : -100;

  // 2. The room in the dark: a fifth of its light, cooler; each notch lifts it a little, with a flicker. The whole room
  // at once on the beat, as a breaker thrown: two images brighter, then its own light. Off at once at the end.
  const DIM = 0.24;
  const flick = frame === lastNotch ? 0.26 : frame === lastNotch + 1 ? 0.1 : 0;
  const breaker = cur === 0 && since >= 0 && since < 2 ? [1.3, 1.12][since] : 1;
  const tone = dark ? "brightness(" + Math.min(0.8, DIM + 0.04 * notches.length + flick).toFixed(3) + ") saturate(0.7)" : breaker !== 1 ? "brightness(" + breaker + ")" : "";
  const film = n ? h(Footage, { shot: cur, style: { ...full, ...(tone ? { filter: tone } : {}) } }) : null;
  const night = dark ? h("div", { style: { ...full, background: "#a9b5d4", mixBlendMode: "multiply" } }) : null;
  const bloom = cur === 0 && since >= 0 && since < 2 ? h("div", { style: { ...full, background: "#fff1dc", mixBlendMode: "screen", opacity: [0.2, 0.08][since] } }) : null;

  // 3. Each piece lit at its own light (a little brighter and warmer), cut to its own box, with a bloom made of its own
  // picture, its highlights only (a strong contrast first), blurred and laid in screen: what shines in it (a bulb, its
  // glass) glows, what does not (a lamp's brass cap, a bottle's label) stays as it is (a glow drawn round its shape lit
  // the caps like stickers on the bench). A warm pool
  // of light spills from it on the room, flickering on as a bulb does; on the beat, the room's own light takes over and
  // the pools fade.
  const ownLight = "brightness(1.18) saturate(1.1)";
  const bloomLight = "contrast(2.6) brightness(1.1) blur(" + Math.max(6, Math.round(bh * 0.02)) + "px)";
  const pad = Math.max(4, Math.round(bh * 0.012));
  const rect = (b) => {
    const x0 = Math.max(0, Math.round(b.x - pad)), y0 = Math.max(0, Math.round(b.y - pad));
    const x1 = Math.min(bw, Math.round(b.x + b.w + pad)), y1 = Math.min(bh, Math.round(b.y + b.h + pad));
    return "M" + x0 + " " + y0 + "H" + x1 + "V" + y1 + "H" + x0 + "Z";
  };
  const litKinds = KINDS.map((k, kind) => {
    const mine = lit.filter((p) => p.kind === kind);
    if (!mine.length) return null;
    const cut = () => h("div", { style: { ...full, clipPath: "path('" + mine.map((p) => rect(p.box)).join(" ") + "')" } }, k[2]());
    return h(React.Fragment, { key: "l" + kind },
      h("div", { style: { ...full, filter: ownLight } }, cut()),
      h("div", { style: { ...full, filter: bloomLight, mixBlendMode: "screen", opacity: 0.85 } }, cut()));
  });
  const WARMUP = [0.5, 1.35, 0.85];
  const pool = (p, a) => {
    const R = Math.round((Math.max(p.box.w, p.box.h) * 0.9 + bh * 0.05) * (0.6 + 0.4 * p.warm));
    const cx = Math.round(p.box.x + p.box.w / 2), cy = Math.round(p.box.y + p.box.h / 2);
    const k = Math.max(0, a * p.warm);
    return "radial-gradient(circle " + R + "px at " + cx + "px " + cy + "px, rgba(255,206,146," + (0.5 * k).toFixed(3) + ") 0%, rgba(255,184,112," + (0.2 * k).toFixed(3) + ") 42%, rgba(255,170,96,0) 100%)";
  };
  const pools = [
    ...lit.map((p) => pool(p, frame - p.at < WARMUP.length ? WARMUP[frame - p.at] : 1)),
    ...(cur === 0 && since >= 0 && since < 10 ? pieces.map((p) => pool(p, 1 - since / 10)) : []),
  ];
  const spill = pools.length ? h("div", { style: { ...full, background: pools.join(", "), mixBlendMode: "screen" } }) : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film, night, spill, ...litKinds, bloom);

  // 4. Her name lit like a sign when the whole room comes on (its tube catching over five images), a warm white with
  // a glow, or her colour's on her word. Horizontal: above the picture on the black, its small line under it, both lit
  // to the end. Full frame: in the calm part of her room shot (its ceiling, a wall), until the cut; then again in the
  // dark at the end, the room off and her sign still on.
  const hook = reelTexts.find((t) => t.role === "hook");
  const small = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== small);
  const display = "'" + brand.displayFont + "', 'Instrument Serif', 'Georgia', serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const keep = (x) => String(x || "").replace(/(\d) (?=\d)/g, "$1 ");
  const vivid = (c) => {
    const x = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
    if (!x) return null;
    const v = parseInt(x[1], 16);
    const rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    const l = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    return l > 0.12 && l < 0.85 ? rgb : null;
  };
  const hers = setting("couleur", "chaude") === "sienne" ? vivid(brand.accent) : null;
  const glowRgb = hers || [255, 176, 92];
  const tube = hers ? "rgb(" + hers.map((c) => Math.round(c + (255 - c) * 0.72)).join(",") + ")" : "#fff3df";
  const glow = (size, a) => "0 0 " + Math.max(2, Math.round(size * 0.03)) + "px rgba(" + glowRgb.join(",") + "," + (0.95 * a).toFixed(2) + "), 0 0 " + Math.round(size * 0.12) + "px rgba(" + glowRgb.join(",") + "," + (0.75 * a).toFixed(2) + "), 0 0 " + Math.round(size * 0.3) + "px rgba(" + glowRgb.join(",") + "," + (0.45 * a).toFixed(2) + ")";
  const NEON = [0, 1, 0.3, 1, 0.55];
  const on = (k) => (k < 0 ? 0 : k < NEON.length ? NEON[k] : 1);
  const lightOf = (delay) => (frame >= endAt ? 0 : wide ? on(since - delay) : frame >= OFF ? on(frame - OFF + 1 - delay) : cur === 0 ? on(since - delay) : 0);
  const chars = Array.from(keep(hook ? hook.text : "")).length;
  const NS = wide ? Math.min(116, Math.round(2600 / Math.max(8, chars))) : Math.min(150, Math.round(3200 / Math.max(8, chars)));
  const NH = Math.round(NS * 1.3);
  const LS = wide ? 34 : 40;
  const LH = small ? Math.round(LS * 1.9) : 0;
  const NW = 800;
  const spot = wide
    ? null
    : ClearBox(shots[0], Math.max(0, ALL + 2), laid, { aspect: NW / (NH + LH), min: { w: Math.round(NW * 0.55), h: Math.round((NH + LH) * 0.55) }, max: { w: NW, h: NH + LH }, prefer: "top", fallback: { x: 140, y: Math.round(bh * 0.15), w: NW, h: NH + LH } });
  const fit = spot ? Math.min(1, spot.h / (NH + LH)) : 1;
  const nameBox = wide ? { left: 140, top: by - 40 - NH, width: NW, height: NH } : { left: Math.round(spot.x), top: by + Math.round(spot.y), width: Math.round(spot.w), height: Math.round(NH * fit) };
  const lineBox = wide ? { left: 140, top: by + bh + 30, width: NW, height: LH } : { left: Math.round(spot.x), top: by + Math.round(spot.y + NH * fit), width: Math.round(spot.w), height: Math.round(LH * fit) };
  const nameOn = hook ? lightOf(0) : 0;
  const name = nameOn > 0
    ? h(FitText, { style: { position: "absolute", ...nameBox }, innerStyle: { fontFamily: display, fontWeight: 400, fontSynthesis: "none", fontSize: Math.round(NS * fit), lineHeight: 1.05, letterSpacing: "0.01em", color: tube, whiteSpace: "nowrap", textAlign: "center", justifyContent: "center", textShadow: glow(NS * fit, 1), opacity: nameOn } }, keep(hook.text))
    : null;
  const lineOn = small ? lightOf(3) : 0;
  const line = lineOn > 0
    ? h(FitText, { style: { position: "absolute", ...lineBox }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: Math.round(LS * fit), lineHeight: 1.2, letterSpacing: "0.2em", textTransform: "uppercase", color: tube, whiteSpace: "nowrap", textAlign: "center", justifyContent: "center", textShadow: glow(LS * fit, 0.7), opacity: lineOn } }, h("span", { "data-fauve-accent": "" }, keep(small.text)))
    : null;

  // 5. Her ending card in the dark, lit as her name: its title, a line under it.
  const cardOn = end ? on(frame - endAt) : 0;
  const card = end && frame >= endAt
    ? h(React.Fragment, null,
        h(FitText, { style: { position: "absolute", left: 140, top: by + Math.round(bh / 2) - (end.subtitle ? 170 : 90), width: NW, height: 170 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSynthesis: "none", fontSize: 100, lineHeight: 1.05, color: tube, whiteSpace: "normal", textWrap: "balance", textAlign: "center", justifyContent: end.subtitle ? "flex-end" : "center", textShadow: glow(100, 1), opacity: cardOn } }, keep(end.title)),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: by + Math.round(bh / 2) + 20, width: NW, height: 140 }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 50, lineHeight: 1.22, color: tube, textAlign: "center", textWrap: "balance", justifyContent: "flex-start", textShadow: glow(50, 0.6), opacity: on(frame - endAt - 3) } }, keep(end.subtitle))
          : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain white line off its picture, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.min(1320, by + bh + 120 + i * 110) : Math.min(1300, 1220 + i * 120), height: 100 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, t.text));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, name, line, card, extra);
}`;

export const rallume: MontageSkill = {
  key: "rallume",
  version: 1,
  bpm: BPM,
  shots: [6, 14],
  // Up to 24 for a length she asks for: about 30 s at its own tempo (the life of her place goes on, two beats a shot).
  long: 24,
  files: [4, 12],
  how: "Son lieu dans le noir : ce qu'il a plusieurs fois (ses lampes, ses bouteilles, ses tasses, ses plantes) se rallume un par un, de plus en plus vite, chacun à sa lumière avec un halo chaud et un petit clic, la musique étouffée comme derrière un mur ; puis toute la pièce d'un coup sur le temps, la musique qui s'ouvre et son nom qui s'allume comme une enseigne ; puis la vie de son lieu en plans courts coupés sur le temps ; à la fin, tout s'éteint d'un coup et le Reel reboucle sur son début. En horizontal 16:9 sur du noir quand ses vidéos le sont (son nom allumé au-dessus de l'image), sinon plein écran.",
  end: true,
  texts: [
    {
      slot: "nom",
      role: "hook",
      want: "le nom de son lieu, tel qu'on le lit sur sa devanture : il s'allume comme une enseigne quand toute la pièce se rallume (une ligne, plus il est court plus il est grand)",
      max: 22,
      required: true,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "deux à quatre petits mots en capitales espacées sous son nom : ce qu'on y fait ou quand (« bar à vins », « dès 18 h », « café · Lyon 1er ») ; vide si rien ne s'impose",
      max: 24,
      required: false,
    },
  ],
  objects: [
    {
      slot: "lampes",
      shot: 0,
      want: "ses lumières dans ce plan, chacune à part : ses suspensions, ses lampes, ses bougies, ses ampoules (« every pendant lamp », « every lamp », « every candle »), ou une guirlande, une enseigne lumineuse (« string lights », « neon sign ») ; vide si aucune ne s'y voit",
    },
    {
      slot: "rangees",
      shot: 0,
      want: "ce qui est aligné dans ce plan, l'un à côté de l'autre : ses bouteilles, ses bocaux, ses livres, ses verres sur une étagère (« every bottle », « every jar ») ; vide sinon",
    },
    {
      slot: "tables",
      shot: 0,
      want: "ce qui est posé sur ses tables ou son comptoir : ses tasses, ses verres, ses assiettes, ses gâteaux (« every cup », « every wine glass ») ; vide sinon",
    },
    {
      slot: "plantes",
      shot: 0,
      want: "ses plantes et ses fleurs, ou ce qu'elle vend en série, accroché ou posé : ses bouquets, ses vêtements sur un portant, ses chaussures (« every plant », « every bouquet ») ; vide sinon",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal sur du noir avec son nom allumé au-dessus, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos (horizontal si elles le sont)" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, son nom allumé au-dessus de l'image" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
    {
      name: "couleur",
      want: "la lumière de son nom allumé",
      choices: [
        { value: "chaude", says: "un blanc chaud, comme une ampoule" },
        { value: "sienne", says: "sa couleur à elle (celle de sa charte ; le blanc chaud si elle est trop pâle ou trop sombre pour briller)" },
      ],
    },
  ],
  timeline(n, options) {
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(6, Math.min(24, n));
    const life = Array.from({ length: count - 2 }, (_, i) => LIFE[i] ?? MORE);
    // The dark at the end, or her ending card's time on whole beats when the Reel ends on one.
    const dark = options.end ? Math.max(DARK, Math.ceil((END_CARD + 0.05) / beat)) : DARK;
    const spans = beatSpans(bpm, [ROOM, ...life, LIT + dark]);
    const duration = spans.at(-1)!.end;
    const steps = STEPS.map((s) => toFrame(s * beat));
    const all = toFrame(ALL * beat);
    // Off on the beat two beats into the last shot.
    const off = toFrame((ROOM + life.reduce((a, b) => a + b, 0) + LIT) * beat);
    const wants = [
      "son lieu de l'intérieur, en plan large, avec ce qui s'y voit plusieurs fois et peut se rallumer un par un : ses suspensions, ses lampes, ses bougies, ses bouteilles alignées, ses tasses, ses plantes, ses vêtements sur un portant ; posé ou qui bouge lentement (il commence dans le noir)",
      ...life.map((_, i) => (i < LIFE.length ? LIFE_WANTS[i % LIFE_WANTS.length]! : "un moment de plus de la vie de son lieu, tenu un peu plus : quelqu'un, un geste, ses clients")),
      "son lieu en plan large une dernière fois (le premier plan à un autre moment, ou un autre plan large de la salle) : tout s'y éteint d'un coup",
    ];
    const at = (f: number) => round3(f / 30);
    const sounds: SkillSound[] = [
      ...steps.map((f, k) => ({ at: at(f), ...CLICK, gain: k ? -3 : -1 })),
      { at: at(all), ...CLUNK, gain: 3 },
      { at: at(off), ...CLUNK, gain: 1 },
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her name and its line from the moment the room lights up: its code lights them, and keeps them as its format does.
      texts: { nom: { from: round(all / 30), to: duration }, ligne: { from: round(all / 30), to: duration } },
      sounds,
      // Muffled as through a wall while the room is dark, open at once when it lights up, muffled again when it goes
      // off: its end sounds as its beginning, so the Reel loops; cut with the picture.
      music: {
        filters: [
          { kind: "muffled", from: 0, to: round3(all / 30), open: 0.02 },
          { kind: "muffled", from: round3(off / 30), to: duration },
        ],
        end: { at: duration },
      },
      marks: { ...Object.fromEntries(steps.map((f, k) => [`step_${k}`, f])), all, off },
    };
  },
  code: CODE,
  // It draws its own dark and its own lights: the black above and below its horizontal frame carries no grain, no corners.
  finish: { grain: 0, vignette: 0 },
};
