import { beatSpans, toFrame, type MontageSkill, type SkillSound } from "../skills.ts";

// « Façade qui se construit », version 2, written again on its original's fiche (docs/fiches/facade.md: measured image
// by image at 30 i/s and piece by piece, its notes heard, its music measured; Tristan: « c'est un effet que l'on veut
// pouvoir faire, pas exactement reproduire l'image »). Its music has no tempo while the front builds (four lone notes, a
// rising arpeggio, a second of silence), then 120 BPM from its first chord (Gemini heard 115, v1 counted 84); every
// length below is in beats of 120 BPM from the first image, so its pieces land on the original's own images and its
// three big ones on the beats of its music:
//   0 – 2,7   on pure black, her front piece by piece, each at once and at its exact place, her video playing in it,
//             each on a note: her sign or her door with her name first (image 1), then three of her front's elements far
//             from it and from each other (images 25, 53, 80), as the original's door, window, upper window and awning;
//   2,8 – 4,4 a burst of twelve, one every 3 to 6 images, each on a rising harp pluck: her other elements, the lower first
//             and right to left, then bands cut along her front's lines (the pavement under it, a side going up, the wall
//             above it);
//   4,4 – 5,4 nothing new: its silence;
//   5,4 – 6,5 the music comes in: the street (the whole bottom), the top's left third, then all that is still black, a
//             hair before its first three beats as the original's before its chords;
//   6,5 – 9   her front whole, still camera, no text, no zoom; the cut on the beat, her other files a bar each.
// Her front's elements are named by the filler from what her file shows (« every window », her sign: `@morceaux`,
// `@enseigne`) and read once on its first image (a still camera); fewer than six found, her picture is cut in regular
// rectangles laid at random on the same times (its fiche). Its format follows her front (Tristan: « format par défaut
// [comme ses vidéos], et changement à la demande du user »): vertical full frame as the original, or her horizontal
// front whole in a band across the middle of the black. Her photos stay still, her videos play. Nothing is written on
// her front: her optional name sits on a piece of the black while it builds and goes with the last piece. Nothing of the
// original's own is copied (its café, its words, the embossed title that follows it: « Titre gaufré », its own model).

const BPM = 120;
/** Her front's pieces, in beats from the first image: the original's images 1, 25, 53 and 80, then 85 … 132 (30 i/s). */
const SLOW = [0.067, 1.667, 3.533, 5.333];
const BURST = [5.667, 6, 6.267, 6.467, 6.667, 6.933, 7.267, 7.6, 7.867, 8.267, 8.533, 8.8];
/**
 * Its three big pieces: 0,2, 0,07 and 0,07 beat before our music's beats 11, 12 and 13, as the original's before its
 * chords (its music's grid falls 0,72 beat later than ours, whose first beat is the first image: they land 4 images after
 * the original's own 158, 175 and 190).
 */
const BIG = [10.796, 11.928, 12.928];
/** Its music comes in on beat 11 (its first big piece); her front plays whole to beat 18 (9 s), the cut. */
const ENTRY = 11;
const FRONT = 18;
/**
 * Her other files after it, a bar each; up to this many shots for a length she asks for (23 s at its own tempo, 30 s a
 * little slower): her front's 9 s take most of a video, and her files give three passages each at most.
 */
const BAR = 4;
const LONG = 8;
/** The engine's ending card: the Reel's last 1,6 s, on the black after the last shot (half beats, a few images of black first). */
const END_CARD = 1.6;
/** A note on each slow piece, rising (the original's four lone notes), and a pluck on each of the burst, rising and louder (its arpeggio). */
const NOTES = ["low soft harp note, long decay", "soft harp note, long decay", "high soft harp note, long decay", "very high soft harp note, long decay"];
const PLUCKS = ["low harp pluck", "harp pluck", "high harp pluck"];
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its clip's id, its own (two copies of the scene in one page never share one).
  const CLIP = "fc" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  // When each piece lands (images): four slowly, twelve in a burst, three big ones on the music's first beats.
  const AT = [1, 25, 53, 80, 85, 90, 94, 97, 100, 104, 109, 114, 118, 124, 128, 132, 162, 179, 194].map((d, i) => mark("piece_" + i, d));
  const WHOLE = AT[18];
  const BLACK = mark("black", durationInFrames + 1);
  const front = shots[0];
  const FRONT_END = n > 1 ? shots[1].from : BLACK;
  const endAt = end ? end.from : durationInFrames + 1;

  // 1. Its frame: vertical full frame as the original when her front is upright (or she asks), else her horizontal
  // front whole in a band across the middle of the black (16:9 when she asks it of an upright one); never zoomed.
  const a = front ? Number(front.aspect) || 0.5625 : 0.5625;
  const format = setting("format", "vertical");
  const band = format === "horizontal" || (format === "auto" && a > 1.15);
  const bw = width;
  const bh = band ? Math.min(height, Math.round(width / (a > 1.15 ? a : 16 / 9))) : height;
  const by = Math.round((height - bh) / 2);
  const box = { left: 0, top: 0, width: bw, height: bh };
  // Her front as the frame shows it: covering it; full frame from a horizontal video (on her word), its whole picture at
  // the frame's height, the part around her sign shown (the width of her front lost, never zoomed).
  const f0 = front ? front.from : 0;
  const W = !band && a > 1.15 ? Math.round(bh * a) : bw;
  const whole = { left: 0, top: 0, width: W, height: bh };
  // Read once on its first image (a still camera): what repeats on it (read first by the engine), then her sign.
  const parts = SubjectParts(shots[0], f0, whole, "@morceaux", 0);
  const lone = parts.length ? null : SubjectBox(shots[0], f0, whole, "@morceaux");
  const signAt = SubjectBox(shots[0], f0, whole, "@enseigne");
  const signLine = SubjectOutline(shots[0], f0, whole, "@enseigne");
  const fx = front && front.focus && Number.isFinite(front.focus.x) ? front.focus.x : 0.5;
  const off = W > bw ? Math.round(Math.max(0, Math.min(W - bw, (signAt ? signAt.x + signAt.w / 2 : fx * W) - bw / 2))) : 0;
  const laid = { left: off ? -off : 0, top: 0, width: W, height: bh };

  // 2. Its pieces, as boxes of the frame. Her elements, inside the frame, none mostly inside her sign.
  const R = (x0, y0, x1, y1) => ({ x: Math.round(x0), y: Math.round(y0), w: Math.round(x1) - Math.round(x0), h: Math.round(y1) - Math.round(y0) });
  const fit = (b) => { if (!b) return null; const r = R(Math.max(0, b.x - off), Math.max(0, b.y), Math.min(bw, b.x - off + b.w), Math.min(bh, b.y + b.h)); return r.w >= bw * 0.02 && r.h >= bh * 0.01 ? r : null; };
  const area = (b) => b.w * b.h;
  const inter = (p, q) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
  const sign = fit(signAt);
  const elems = (parts.length ? parts : lone ? [lone] : []).map(fit).filter((b) => b && !(sign && inter(b, sign) > 0.5 * area(b)));
  const all = sign ? [sign, ...elems] : elems;
  const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  // Those far from the ones taken first, the larger ones before: what says her place, all over her front.
  const spread = (list, first, k) => {
    const out = [first];
    const rest = list.filter((b) => b !== first);
    const most = Math.max(...list.map(area));
    while (out.length < k && rest.length) {
      let best = 0, score = -1;
      rest.forEach((b, i) => {
        const [x, y] = mid(b);
        const d = Math.min(...out.map((p) => Math.hypot(x - mid(p)[0], y - mid(p)[1]))) * (0.5 + 0.5 * Math.sqrt(area(b) / most));
        if (d > score) { score = d; best = i; }
      });
      out.push(rest.splice(best, 1)[0]);
    }
    return { out, rest };
  };
  let slow, burst, big;
  if (all.length >= 6) {
    // Her sign first (else her largest element), then three far from it and from each other.
    const X0 = Math.min(...all.map((b) => b.x)), X1 = Math.max(...all.map((b) => b.x + b.w));
    const T = Math.min(...all.map((b) => b.y)), B = Math.max(...all.map((b) => b.y + b.h));
    const S = Math.round(Math.max(0.5 * bh, Math.min(0.9 * bh, B + 0.05 * bh)));
    const picked = spread(all, sign || all.reduce((m, b) => (area(b) > area(m) ? b : m)), 4);
    slow = picked.out;
    // The burst: her other elements, the lower ones first, right to left; then bands along her front's lines: the
    // pavement under it (right to left), a side going up, the wall above it.
    const row = (b) => Math.round((b.y + b.h) / (0.05 * bh));
    const rest = picked.rest.sort((p, q) => row(q) - row(p) || q.x - p.x);
    const sw = Math.max(X0, bw - X1);
    const sx = X0 >= bw - X1 ? 0 : X1;
    const side = sw >= 0.08 * bw ? [2, 1, 0].map((k) => R(sx, T + (k * (B - T)) / 3, sx + sw, T + ((k + 1) * (B - T)) / 3)) : [];
    const above = T >= 0.1 * bh ? [R(X0, T - 0.06 * bh, X1, T)] : [];
    const k = Math.max(1, Math.min(4, 12 - rest.length - side.length - above.length));
    const pave = S - B > 0.01 * bh ? Array.from({ length: k }, (_, i) => R(((k - 1 - i) * bw) / k, B, ((k - i) * bw) / k, S)) : [];
    burst = [...rest, ...pave, ...side, ...above].slice(0, 12);
    // The rest, in three: the street, the top's left third, then all that is still black.
    big = [R(0, S, bw, bh), R(0, 0, 0.339 * bw, Math.max(T, 0.5 * S))];
  } else {
    // Nothing that draws her front's lines (fewer than six elements found): her picture cut in regular rectangles, laid
    // at random on the same times; the street's two rows, then the top's left third, then the rest.
    const cols = band ? (bw / bh > 1.6 ? 8 : 7) : 5;
    const rows = band ? 5 : 7;
    const cells = [];
    for (let r = 0; r < rows - 2; r++) for (let c = 0; c < cols; c++) cells.push(R((c * bw) / cols, (r * bh) / rows, ((c + 1) * bw) / cols, ((r + 1) * bh) / rows));
    const picked = spread(cells, cells[Math.floor(random("facade-first") * cells.length)], 4);
    slow = picked.out;
    burst = picked.rest.map((c) => ({ c, k: random("facade-" + c.x + "-" + c.y) })).sort((p, q) => p.k - q.k).slice(0, 12).map((p) => p.c);
    big = [R(0, ((rows - 2) * bh) / rows, bw, bh), R(0, 0, 0.339 * bw, 0.5 * bh)];
  }
  // Each one on its time; a burst of fewer than twelve spread over its twelve notes. Her sign follows its outline when
  // one was read (a door's arch, an awning's slant); the others are rectangles, as the original's.
  const moved = (d) => (off ? d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => (Number(x) - off).toFixed(1) + " " + y) : d);
  const pieces = [
    ...slow.map((b, i) => ({ ...b, at: AT[i], d: b === sign && signLine ? moved(signLine) : null })),
    ...burst.map((b, i) => ({ ...b, at: AT[4 + Math.round((i * 12) / Math.max(1, burst.length))] })),
    ...big.map((b, i) => ({ ...b, at: AT[16 + i] })),
  ];

  // 3. Her front on the black, seen through the pieces landed (each at once, at its place, never moving again), her video
  // playing in them; whole from the last one. Her other files after it, as filmed, cut on the beat; black at the end.
  const landed = pieces.filter((p) => frame >= p.at);
  const defs = frame < WHOLE
    ? h("svg", { key: "clip", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
        h("clipPath", { id: CLIP, clipPathUnits: "userSpaceOnUse" }, landed.map((p, i) => (p.d ? h("path", { key: i, d: p.d }) : h("rect", { key: i, x: p.x, y: p.y, width: p.w, height: p.h })))))
    : null;
  const film = front && frame < Math.min(FRONT_END, BLACK)
    ? h("div", { style: { position: "absolute", left: 0, top: 0, width: bw, height: bh, ...(frame >= WHOLE ? {} : { clipPath: "url(#" + CLIP + ")" }) } }, h(Footage, { shot: 0, style: laid }))
    : n > 1 && frame < BLACK ? h(Footage, { shot: cur, style: box }) : null;

  // 4. Her optional name (and its line) on a piece of the black that stays while her front builds, taken away with the
  // last piece: nothing is written on her front. Over the band on the black; full frame where the black stays longest
  // (each piece it would hide counted for as long as it would hide it), the upper one first.
  const hook = reelTexts.find((t) => t.role === "hook");
  const cap = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== cap);
  const display = "'" + brand.displayFont + "', 'DM Serif Display', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const on = (t) => t && frame >= t.from && frame < Math.min(t.to, WHOLE, endAt);
  const chars = Math.max(4, String(hook ? hook.text : "").length);
  const FS = Math.round(Math.max(72, Math.min(118, 820 / (0.62 * chars))));
  const LW = Math.round(Math.max(420, Math.min(bw - 100, chars * FS * 0.62 + 120)));
  const capH = cap ? 70 : 0;
  const LH = Math.round((hook ? FS * 1.2 : 0) + capH + 64);
  const hidden = (b) => pieces.reduce((t, p) => t + inter(b, p) * (WHOLE - p.at), 0);
  const spot = band
    ? { x: Math.round((bw - LW) / 2), y: Math.max(90, Math.round(by / 2 - LH / 2)) - by, w: LW, h: LH }
    : [0.12, 0.22, 0.32, 0.42, 0.52].map((c) => ({ x: Math.round((bw - LW) / 2), y: Math.round(c * height - LH / 2), w: LW, h: LH })).reduce((m, b) => (hidden(b) < hidden(m) ? b : m));
  const label = on(hook) || on(cap)
    ? h("div", { key: "label", style: { position: "absolute", left: spot.x, top: by + spot.y, width: LW, height: LH, backgroundColor: "#000000" } },
        hook && on(hook)
          ? h(FitText, { style: { position: "absolute", left: 30, top: 26, width: LW - 60, height: LH - 52 - capH }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: FS, lineHeight: 1.02, letterSpacing: "0.01em", color: "#ffffff", textAlign: "center", textWrap: "balance" } }, keep(hook.text))
          : null,
        cap && on(cap)
          ? h("div", { "data-fauve-accent": "", style: { position: "absolute", left: 20, width: LW - 40, bottom: 26, height: capH, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: body, fontWeight: 600, fontSize: 36, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap" } }, keep(cap.text))
          : null)
    : null;

  // 5. Its ending card, when she has one (an option: the original has none): on the black after the last shot, its
  // words at once in white, its line just after.
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 620 : 720, width: width - 280, height: 280 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 108, lineHeight: 1.02, color: "#ffffff", textAlign: "center", textWrap: "balance", justifyContent: end.subtitle ? "flex-end" : "center" } }, keep(end.title)),
        end.subtitle && frame >= endAt + 4
          ? h(FitText, { style: { position: "absolute", left: 140, top: 924, width: width - 280, height: 170 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 44, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", textWrap: "balance", justifyContent: "flex-start" } }, keep(end.subtitle))
          : null)
    : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: band ? Math.min(1300, by + bh + 40 + i * 120) : 1220 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(t.text)));

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, defs, film);
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, label, extra, ending);
}`;

export const facade: MontageSkill = {
  key: "facade",
  // 2: written again on its original's fiche: its tempo (120 BPM, none while it builds), its pieces on its images and
  // on its notes (four slow, a burst of twelve, a silence, three big on its music's first beats), her front's own
  // elements named by the filler, its format, nothing written on her front, its music coming in late and cut dead.
  // 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 3,
  bpm: BPM,
  shots: [1, 3],
  long: LONG,
  files: [1, 3],
  how: "Sur un écran noir, sa devanture se construit morceau par morceau, chaque morceau d'un coup à sa place, sa vidéo jouant dedans, chacun sur une note : d'abord son enseigne ou sa porte avec son nom, puis trois éléments loin l'un de l'autre (une fenêtre, une autre, son store), lentement ; puis une rafale de douze morceaux (ses autres fenêtres, sa vitrine, le trottoir, un côté qui monte, le mur au-dessus) ; un silence ; puis la musique entre avec les trois plus grands (la rue, le haut, tout le reste) et sa devanture joue en entier, caméra fixe, sans texte ; ses autres fichiers suivent, une mesure chacun. En vertical plein écran, une vidéo horizontale recadrée autour de son enseigne ; posée en entier dans une bande au milieu du noir à sa demande.",
  end: true,
  texts: [
    {
      slot: "nom",
      role: "hook",
      want: "facultatif : son nom (ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), en blanc sur un morceau du noir pendant que sa devanture se construit, parti avec le dernier morceau ; rien ne s'écrit sur sa devanture entière",
      max: 20,
      required: false,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : 2 à 4 petits mots en capitales espacées sous son nom, sur le même noir : son métier et son quartier, une date (une forme comme « librairie · brick lane », « depuis 1998 »)",
      max: 28,
      required: false,
    },
  ],
  objects: [
    {
      slot: "morceaux",
      shot: 0,
      want: "ce qui se répète sur sa devanture et peut apparaître pièce par pièce sur le noir : ses fenêtres et les pans de sa vitrine (« every window »), sinon ses arcades, ses stores, ses tables en terrasse, ses pots de plantes (« every arch », « every awning », « every table », « every plant pot ») ; toujours « every » et la chose répétée ; vide quand rien ne s'y répète (sa devanture se construit alors en rectangles réguliers)",
    },
    {
      slot: "enseigne",
      shot: 0,
      want: "ce qui dit son nom sur sa devanture et apparaît seul en premier sur le noir : son enseigne, sa porte avec son nom peint sur la vitre, son store à son nom (« shop sign », « door », « painted window lettering », « awning ») ; vide quand on ne voit pas son nom",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, sa devanture entière dans une bande 16:9 sur du noir, ou comme sa vidéo de devanture",
      choices: [
        { value: "vertical", says: "vertical plein écran, comme l'original : une vidéo horizontale coupée autour de son enseigne (on perd la largeur de sa devanture)" },
        { value: "horizontal", says: "horizontal : sa devanture dans une bande 16:9 au milieu du noir", band: true },
        { value: "auto", says: "comme sa vidéo de devanture : vertical plein écran si elle est verticale, posée en entier dans une bande au milieu du noir si elle est horizontale" },
      ],
    },
  ],
  // Its original's grade (its fiche, effect 5): bright and natural, no grain, its ground a pure black (no fade lifting it).
  finish: { grain: 0, vignette: 0, fade: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(1, Math.min(LONG, Math.round(n)));
    // Her front, then her other files a bar each; with an ending card, the black that carries it after the last shot.
    const black = end ? Math.ceil(((END_CARD + 0.05) / beat) * 2) / 2 : 0;
    const beats = [FRONT, ...Array.from({ length: count - 1 }, () => BAR)].map((b, i) => (i === count - 1 ? b + black : b));
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const blackAt = toFrame((FRONT + BAR * (count - 1)) * beat);
    const frames = [...SLOW, ...BURST, ...BIG].map((b) => toFrame(b * beat));
    const at = (f: number) => round3(f / 30);
    const wants = [
      "sa devanture filmée de face, de l'autre côté de la rue, le téléphone posé (sans zoom ni mouvement), 9 s au moins : toute la façade dans l'image, du trottoir au toit avec un peu de ciel, son enseigne ou sa porte avec son nom bien visible, un peu de vie devant ; elle se construit morceau par morceau sur le noir, puis joue en entier",
      ...Array.from({ length: count - 1 }, (_, i) =>
        i === count - 2
          ? "le dernier plan, calme, tenu jusqu'à la fin : l'intérieur de son lieu, son travail ou un détail qui finit bien"
          : "un plan de son lieu juste après sa devanture : l'intérieur, un geste, ses produits",
      ),
    ];
    // A note on each piece as it lands (the original's four lone notes rising, then its arpeggio, louder as it climbs).
    const sounds: SkillSound[] = [
      ...SLOW.map((_, i) => ({ at: at(frames[i]!), sound: NOTES[i]!, seconds: 1.5 })),
      ...BURST.map((_, i) => ({ at: at(frames[4 + i]!), sound: PLUCKS[Math.min(2, Math.floor(i / 4))]!, seconds: 0.5, ...(i < 11 ? { gain: round(-6 + (6 * i) / 11) } : {}) })),
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her optional name with the first piece, its line with the second; both go with the last piece.
      texts: { nom: { from: round(frames[0]! / 30), to: round(frames[18]! / 30) }, ligne: { from: round(frames[1]! / 30), to: round(frames[18]! / 30) } },
      marks: { ...Object.fromEntries(frames.map((f, i) => [`piece_${i}`, f])), black: end ? blackAt : toFrame(duration) + 1 },
      sounds,
      // Silent while her front builds (its notes alone, then the silence), in on beat 11 with its first big piece (Tristan,
      // of its originals' pauses: « oui pourquoi pas si c'est bien fait »), cut dead with the last image: the Reel loops
      // back to the black and its first note.
      music: { pauses: [{ from: 0, to: round3(ENTRY * beat) }], end: { at: duration } },
    };
  },
  code: CODE,
};
