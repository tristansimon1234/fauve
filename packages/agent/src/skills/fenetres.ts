import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Fenêtres et étiquettes », written on its original (house/originals/fenetres.mp4, 13,8 s at 93 BPM, a road trip
// filmed in width, looked at image by image): two small technical labels in white condensed capitals (an altitude on
// the left, coordinates on the right) stay at mid-height the whole Reel while the shots change about every beat; each
// change is made of windows: the next shot shows through hard rectangles cut in place on the frame's thirds (a corner,
// a band, a cell), a few more every two images, until it fills the frame, the last pieces of the one before lingering
// in a cell or two; now and then a window opens in the middle with the next shot in it a beat ahead, then takes the
// whole frame on the cut; at the end the first shot comes back through windows, so the Reel loops. Made vertical: its
// windows are the cells of a 3 × 3 grid over the frame (9:16 cells), its labels just above the middle (clear of the
// apps' buttons), hers. Its ending card (an offer, an announcement) is set in the labels' capitals over the last shot,
// darkened, the labels still there between its title and its line.

const BPM = 93;
/** The shots in beats, in turn after the first (one held two beats now and then, as the original's). */
const PATTERN = [1, 1, 2, 1, 1, 1, 2];
const FIRST = 1;
/** The last shot, held, the first shot coming back through windows in its last beat (the loop). */
const LAST = 2.5;
/** With an ending card: beats more on the last shot (at least the engine's 1,6 s). */
const CARD = 3;
const CARD_SECONDS = 1.6;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const n = shots.length;
  const BEAT = mark("beat", 19.35);
  const LOOP = mark("loop", 1) > 0.5;
  const endAt = end ? end.from : durationInFrames + 1;
  const display = "'" + brand.displayFont + "', 'Oswald', 'Arial Narrow', sans-serif";
  const body = "'" + brand.bodyFont + "', 'IBM Plex Mono', monospace";
  const shade = "0 0 2px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.45), 0 2px 16px rgba(0,0,0,0.3)";
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

  // 1. Her shots, full frame; each change made of windows: the 3 × 3 cells of the frame turn to the next shot one or a
  // few at a time, every two images, from a little before the cut to a little after it (the last cells of the one
  // before lingering), in an order that changes from one cut to the next (from a corner, a band, the middle, scattered).
  // Every fourth change, a window opens in the middle with the next shot a beat ahead, then the rest follows on the cut.
  const COLS = 3;
  const ROWS = 3;
  const cellW = width / COLS;
  const cellH = height / ROWS;
  const step2 = (beats) => 2 * Math.round((beats * BEAT) / 2);
  const SPREAD = [-0.3, -0.2, -0.1, -0.1, 0, 0, 0.1, 0.2, 0.42];
  const LATE = [-0.06, 0, 0, 0.06, 0.1, 0.16, 0.26, 0.42];
  const orderFor = (c) => {
    const cells = Array.from({ length: COLS * ROWS }, (_, k) => k);
    const kind = c % 4;
    const seed = "win-" + c;
    if (kind === 3) {
      // A window in the middle first, then the others scattered.
      const rest = cells.filter((k) => k !== 4).sort((a, b) => random(seed + "-" + a) - random(seed + "-" + b));
      return { order: [4].concat(rest), early: true };
    }
    if (kind === 1) {
      // A band first (top, middle or bottom), then the band next to it, then the last.
      const first = Math.floor(random(seed + "-band") * ROWS);
      const rows = [first].concat([0, 1, 2].filter((r) => r !== first).sort((a, b) => Math.abs(a - first) - Math.abs(b - first)));
      return { order: rows.flatMap((r) => (random(seed + "-dir-" + r) < 0.5 ? [0, 1, 2] : [2, 1, 0]).map((col) => r * COLS + col)), early: false };
    }
    if (kind === 2) {
      return { order: cells.sort((a, b) => random(seed + "-" + a) - random(seed + "-" + b)), early: false };
    }
    // From a corner, spreading.
    const corner = Math.floor(random(seed + "-corner") * 4);
    const cx = corner % 2 ? COLS - 1 : 0;
    const cy = corner < 2 ? 0 : ROWS - 1;
    return { order: cells.sort((a, b) => Math.hypot((a % COLS) - cx, Math.floor(a / COLS) - cy) + random(seed + "-" + a) * 0.6 - Math.hypot((b % COLS) - cx, Math.floor(b / COLS) - cy) - random(seed + "-" + b) * 0.6), early: false };
  };
  // When each cell turns at each cut (frames): the cut's frame plus its offset in the order.
  const cuts = shots.slice(1).map((s) => s.from);
  const turns = cuts.map((at, c) => {
    const { order, early } = orderFor(c);
    const t = new Array(COLS * ROWS);
    order.forEach((cell, k) => {
      t[cell] = at + (early ? (k === 0 ? -step2(0.85) : step2(LATE[k - 1])) : step2(SPREAD[k]));
    });
    return t;
  });
  // The loop: in the last shot's last beat, the first shot comes back through windows (the Reel starts again on it).
  const loopAt = LOOP && !end && n > 1 ? durationInFrames - Math.round(0.9 * BEAT) : -1;
  const loopTurns = loopAt >= 0 ? (() => {
    const { order } = orderFor(cuts.length);
    const t = new Array(COLS * ROWS);
    order.forEach((cell, k) => { t[cell] = loopAt + step2(SPREAD[k] + 0.3); });
    return t;
  })() : null;
  const shownIn = (cell) => {
    let shot = 0;
    for (let c = 0; c < turns.length; c++) if (frame >= turns[c][cell]) shot = c + 1;
    if (loopTurns && frame >= loopTurns[cell]) shot = -1;
    return shot;
  };
  const groups = {};
  for (let cell = 0; cell < COLS * ROWS; cell++) {
    const s = shownIn(cell);
    (groups[s] = groups[s] || []).push(cell);
  }
  const rect = (cell) => {
    const col = cell % COLS;
    const row = Math.floor(cell / COLS);
    const x0 = Math.round(col * cellW);
    const y0 = Math.round(row * cellH);
    return "M" + x0 + " " + y0 + "H" + Math.round((col + 1) * cellW) + "V" + Math.round((row + 1) * cellH) + "H" + x0 + "Z";
  };
  const film = n
    ? Object.keys(groups).map((key) => {
        const s = Number(key);
        const cells = groups[key];
        const whole = cells.length === COLS * ROWS;
        const shot = s < 0 ? 0 : Math.min(n - 1, s);
        return h("div", { key: "g" + key, style: { position: "absolute", left: 0, top: 0, width, height, clipPath: whole ? undefined : "path('" + cells.map(rect).join(" ") + "')" } },
          h(Footage, { shot, ...(s < 0 ? { at: loopAt } : {}), style: { left: 0, top: 0, width, height } }));
      })
    : null;

  // 2. Its two labels, fixed the whole Reel, just above the middle: one on the left, one on the right, small white
  // condensed capitals (the frame's own edge of shade, so they read on a bright sky).
  const hook = reelTexts.find((t) => t.role === "hook");
  const caption = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== caption);
  const label = { fontFamily: display, fontWeight: 500, fontSize: 50, lineHeight: 1.05, letterSpacing: "0.04em", textTransform: "uppercase", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade };
  const tag = (t, left, align, key) => t && frame >= t.from && frame < t.to
    ? h(FitText, { key, style: { position: "absolute", left, top: 880, width: 470, height: 70 }, innerStyle: { ...label, alignItems: align } }, t.text)
    : null;
  const labels = [tag(hook, 50, "flex-start", "left"), tag(caption, width - 520, "flex-end", "right")];

  // Any other text of the Reel (none in its slots): a plain line at the top, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 170 + i * 130, height: 120 }, innerStyle: { fontFamily: display, fontWeight: 500, fontSize: 56, lineHeight: 1.1, textTransform: "uppercase", color: "#ffffff", textAlign: "center", textShadow: shade } }, t.text));

  // 3. Its ending card: the last shot darkened, its title in the labels' capitals above them, its line under them in
  // the typewriter, the labels still there between.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, { style: { backgroundColor: "rgba(0,0,0," + (0.5 * interpolate(frame, [endAt, endAt + 6], [0, 1], clamp)).toFixed(3) + ")" } },
        h(FitText, { style: { position: "absolute", left: 140, top: 520, width: width - 280, height: 330 }, innerStyle: { justifyContent: "flex-end", fontFamily: display, fontWeight: 600, fontSize: 120, lineHeight: 1.0, letterSpacing: "0.01em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade } },
          h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 2, endAt + 8], [0, 1], clamp) } }, String(end.title || ""))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1000, width: width - 280, height: 190 }, innerStyle: { justifyContent: "flex-start", fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.2, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 6, endAt + 12], [0, 1], clamp) } }, String(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, ending, labels, extra);
}`;

export const fenetres: MontageSkill = {
  key: "fenetres",
  version: 1,
  bpm: BPM,
  shots: [6, 16],
  // Up to 34 for a length she asks for: about 30 s at its own tempo (more of the journey, the same windows).
  long: 34,
  files: [5, 14],
  how: "Deux petites étiquettes techniques en capitales blanches restent fixes à mi-hauteur, une à gauche, une à droite, tout le Reel ; ses plans changent à peu près à chaque temps, et chaque changement se fait par fenêtres : le plan suivant apparaît dans des rectangles posés sur les tiers de l'image (un coin, une bande, une case), quelques-uns de plus toutes les deux images, jusqu'à prendre tout l'écran ; de temps en temps une fenêtre s'ouvre au milieu avec le plan suivant un temps en avance ; à la fin, le premier plan revient par fenêtres et le Reel tourne en boucle.",
  end: true,
  texts: [
    { slot: "gauche", role: "hook", want: "l'étiquette de gauche, comme une étiquette technique en capitales : ce qui situe, son quartier, sa rue ou sa ville quand on les sait, sinon son nom (une forme comme « PARIS 11E », « RUE DES MARTYRS »)", max: 20, required: true },
    { slot: "droite", role: "caption", want: "l'étiquette de droite, au même ton technique : un repère concret qu'on sait (son année d'ouverture, son heure d'ouverture), sinon ce qu'elle fait en un ou deux mots (une forme comme « DEPUIS 1998 », « OUVERT DÈS 8 H », « TORRÉFACTEUR »)", max: 20, required: true },
  ],
  timeline(n, options) {
    const { end } = options;
    // At its own tempo, or at a music's when the Reel follows one: every length in beats, so a slower tempo makes it longer
    // and calmer, a faster one shorter, its cuts still on the beats.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const middle = Array.from({ length: Math.max(0, n - 2) }, (_, i) => PATTERN[i % PATTERN.length]!);
    // Its ending card lasts the engine's 1,6 s at least, whatever the tempo.
    const spans = beatSpans(bpm, [FIRST, ...middle, LAST + (end ? Math.max(CARD, CARD_SECONDS / beat) : 0)].slice(0, Math.max(1, n)));
    const duration = spans.at(-1)!.end;
    const wants = spans.map((s, i) =>
      i === 0
        ? "le plan qui ouvre le Reel, large et beau : un paysage, sa rue ou son lieu en mouvement ; il revient à la fin, par fenêtres, pour que le Reel tourne en boucle"
        : i === spans.length - 1
          ? "un dernier plan large de son quartier ou de son lieu, tenu un peu plus longtemps"
          : s.end - s.start > 1.5 * beat
            ? "un plan large et vivant de son quartier, de sa rue ou de son lieu, tenu deux temps (chacun différent du précédent)"
            : "un plan de son quartier, de sa rue ou de son lieu, en mouvement si possible (une route, des gens, une devanture, un détail), chacun différent du précédent",
    );
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Both labels the whole Reel, its ending card too (between its title and its line).
      texts: { gauche: { from: 0, to: duration }, droite: { from: 0, to: duration } },
      marks: { beat: beat * 30, loop: end ? 0 : 1, last: toFrame(spans.at(-1)!.start) },
    };
  },
  code: CODE,
};
