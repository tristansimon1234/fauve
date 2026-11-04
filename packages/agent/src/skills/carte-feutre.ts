import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Carte au feutre », written on its original (house/originals/carte-feutre.mp4, 9 s, looked at image by image): a
// folded card of grey-white paper (its fold across the middle, its lower half a little darker) held in front of the
// pictures, three quarters of the frame's width, at its middle; under it the pictures change every three images (an
// eighth of a beat at 72 BPM: stop motion), some twenty of them coming back in a new order, and the card jumps a little
// at each one (a few pixels, a degree or two, the angle of a hand that holds it). Blank for a beat, then the sentence is
// written on it in red felt-tip capitals, tall and narrow, from its top left, a word more on each beat (a short word
// with the next: « & COME »), the whole sentence by the eighth beat; held whole to the end, the pictures still flashing.
// Here the card is drawn over her pictures (to_film_else), its words are hers; its ending card (an offer, an
// announcement) is written on the same card at the end, its line under it smaller.

const BPM = 72;
/** The first word on the card, and the beat by which her whole sentence is written (beats). */
const WORDS_AT = 1;
const FULL_BY = 7.5;
/** Its length in beats: 10.5 with ten pictures, an eighth of a beat more for each one past ten (more to see). */
const lengthBeats = (n: number) => 10.5 + 0.125 * (Math.max(10, n) - 10);
/** The ending card's beats (at least the engine's 1,6 s). */
const CARD = 2;
const CARD_SECONDS = 1.6;
const round = (s: number) => Math.round(s * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = mark("beat", 25);
  const WORDS_AT = mark("words", Math.round(BEAT));
  const FULL_BY = mark("full", Math.round(7.5 * BEAT));
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  // A new picture every eighth of a beat (stop motion): tick k starts at the frame nearest to k eighths.
  const TICK = BEAT / 8;
  const startOf = (k) => Math.round(k * TICK);
  const tickAt = (f) => {
    let k = Math.max(0, Math.floor(f / TICK));
    while (startOf(k + 1) <= f) k++;
    while (k > 0 && startOf(k) > f) k--;
    return k;
  };
  const t = tickAt(frame);
  const ink = "#b3172b";
  const hand = "'Just Another Hand', '" + brand.displayFont + "', cursive";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";

  // 1. Her pictures, full frame, one per tick: the first round in her order (her first picture opens the Reel), then
  // each round in a new order, never the same picture twice in a row. A video shows the next slice of its passage each
  // time it comes back, so it moves on in stop motion and its whole passage is seen once over the Reel.
  const orderOf = (c) => {
    const p = Array.from({ length: n }, (_, i) => i);
    if (c === 0 || n < 3) return p;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(random("card-order-" + c + "-" + i) * (i + 1)); const x = p[i]; p[i] = p[j]; p[j] = x; }
    const before = orderOf(c - 1);
    if (p[0] === before[n - 1]) { const x = p[0]; p[0] = p[1]; p[1] = x; }
    return p;
  };
  const cycle = n ? Math.floor(t / n) : 0;
  const shot = n ? orderOf(cycle)[t % n] : -1;
  const picture = shot >= 0
    ? h(Footage, { key: "s" + t, shot, at: startOf(t) - Math.round(cycle * TICK), style: { left: 0, top: 0, width, height } })
    : null;

  // 2. The card: grey-white paper folded across the middle, three quarters of the frame's width, at its middle; at each
  // tick it moves a little, as held in front of the camera (a few pixels, its tilt and its angle to the lens).
  const CW = 728;
  const CH = 810;
  const CX = Math.round(width / 2);
  const CY = 975;
  const L = CX - CW / 2;
  const T = CY - CH / 2;
  const jit = (k, a) => (random("card-" + k + "-" + t) * 2 - 1) * a;
  const move = { dx: jit("x", 11), dy: jit("y", 11), rz: -1 + jit("r", 1.4), ry: jit("ry", 6), rx: jit("rx", 4.5) };
  const P = 1800;
  const turn = (s) => "translate(" + (move.dx / s).toFixed(2) + "px, " + (move.dy / s).toFixed(2) + "px) perspective(" + (P / s).toFixed(1) + "px) rotateX(" + move.rx.toFixed(2) + "deg) rotateY(" + move.ry.toFixed(2) + "deg) rotate(" + move.rz.toFixed(2) + "deg)";
  const FOLD = 0.48;
  const paper = h("div", { style: { position: "absolute", left: L, top: T, width: CW, height: CH, transformOrigin: "50% 50%", transform: turn(1), borderRadius: 12, overflow: "hidden", boxShadow: "0 16px 36px rgba(0,0,0,0.26), 0 2px 6px rgba(0,0,0,0.18)" } },
    h("div", { style: { position: "absolute", left: 0, top: 0, width: CW, height: Math.round(CH * FOLD), background: "linear-gradient(180deg, #d7d5ce 0%, #dcdad3 38%, #e3e0d9 74%, #d6d3cb 90%, #c4c1b9 100%)" } }),
    h("div", { style: { position: "absolute", left: 0, top: Math.round(CH * FOLD), width: CW, height: CH - Math.round(CH * FOLD), background: "linear-gradient(180deg, #e0ded7 0%, #dad8d1 28%, #dfdcd5 70%, #d3d0c8 100%)" } }),
    h("div", { style: { position: "absolute", left: 0, top: Math.round(CH * FOLD) - 1, width: CW, height: 2, background: "#aaa79f" } }),
    h("div", { style: { position: "absolute", left: 0, top: Math.round(CH * FOLD) + 1, width: CW, height: 1, background: "rgba(255,255,255,0.55)" } }),
    h("div", { style: { position: "absolute", inset: 0, borderRadius: 12, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" } }));

  // 3. Her sentence in red felt-tip capitals from the card's top left: its lines chosen for the largest letters (never
  // a line that ends on a little word when another break is as good), every word laid from the start, unseen until its
  // beat, so the card's letters keep one size; a word lands on each beat (a word of one or two letters with the next),
  // faster when her sentence has more words than beats before the eighth.
  const BX = L + 34;
  const BY = T + 30;
  const BW = CW - 34 - 26;
  const BH = CH - 30 - 50;
  const MAXF = 196;
  const LINE = 0.95;
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const unitsOf = (w) => Array.from(w).reduce((u, c) => u + (/[IJ1!.,:;'’|]/.test(c) ? 0.45 : /[MW]/.test(c) ? 1.35 : /\s/.test(c) ? 0.6 : 1), 0);
  const SHORT = /^(&|\+|[A-ZÀ-Ü]{1,2}|LES|DES|AUX|TON|TES|MON|MES|SON|SES|NOS|VOS|POUR|PAR|SUR|CHEZ|DANS|AVEC|THE|AND)$/;
  const layout = (words, box) => {
    const units = words.map(unitsOf);
    let best = null;
    const tryLines = (cuts) => {
      const lines = [];
      for (let i = 0; i < cuts.length - 1; i++) lines.push([cuts[i], cuts[i + 1]]);
      const widths = lines.map(([a, b]) => units.slice(a, b).reduce((x, y) => x + y, 0) + 0.6 * (b - a - 1));
      let f = Math.min(MAXF, box.w / (0.36 * Math.max.apply(null, widths)), box.h / (LINE * lines.length));
      lines.slice(0, -1).forEach(([a, b]) => { if (SHORT.test(words[b - 1])) f *= 0.93; });
      if (!best || f > best.f + 0.01) best = { f, lines };
    };
    const split = (start, left, cuts) => {
      if (left === 1) return tryLines(cuts.concat([words.length]));
      for (let stop = start + 1; stop <= words.length - left + 1; stop++) split(stop, left - 1, cuts.concat([stop]));
    };
    for (let k = 1; k <= Math.min(6, words.length); k++) split(0, k, [0]);
    return best ? best.lines : [[0, words.length]];
  };
  // When each word lands (frames): a word of one or two letters (or « & ») with the next one, a sign with the last.
  const landings = (words, from, until) => {
    const groups = [];
    let pending = [];
    words.forEach((w, i) => {
      if (/^[%!?:;€$.,…)»]+$/.test(w) && groups.length && !pending.length) { groups[groups.length - 1].push(i); return; }
      pending.push(i);
      if (Array.from(w.replace(/[^A-Za-zÀ-ÿ0-9&+]/g, "")).length > 2 || i === words.length - 1) { groups.push(pending); pending = []; }
    });
    if (pending.length) groups.push(pending);
    const t0 = tickAt(from);
    const t1 = Math.max(t0, tickAt(until));
    const G = groups.length;
    const step = G <= 1 || 8 * (G - 1) <= t1 - t0 ? 8 : Math.max(2, Math.floor((t1 - t0) / (G - 1)));
    const at = [];
    groups.forEach((g, k) => g.forEach((i) => { at[i] = startOf(t0 + k * step); }));
    return at;
  };
  const writing = (text, from, until, box, key) => {
    const words = keep(text).toUpperCase().split(/[ \t\n]+/).filter(Boolean);
    if (!words.length) return null;
    const lines = layout(words, box);
    const at = landings(words, from, until);
    const style = { fontFamily: hand, fontWeight: 400, fontSize: MAXF, lineHeight: LINE, letterSpacing: "0.005em", color: ink, WebkitTextStroke: "2.6px " + ink, whiteSpace: "nowrap", textAlign: "left" };
    return h(FitText, { key, style: { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h } }, (s) =>
      h("div", { style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", transformOrigin: ((CX - box.x) / s).toFixed(2) + "px " + ((CY - box.y) / s).toFixed(2) + "px", transform: turn(s) } },
        lines.map(([a, b], r) => h("div", { key: r, style }, words.slice(a, b).map((w, i) => h("span", { key: i, style: { opacity: frame >= at[a + i] ? 1 : 0 } }, (i ? " " : "") + w)))))
    );
  };
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const box = { x: BX, y: BY, w: BW, h: BH };
  const message = hook && frame < endAt ? writing(hook.text, WORDS_AT, FULL_BY, box, "message") : null;

  // Any other text of the Reel (none in its slots): a plain white line above the card, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 200 + i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 56, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 2px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.35)" } }, keep(t.text)));

  // 4. Its ending card: the same card, written anew (its title at once, in the same felt-tip, its line under it smaller,
  // a quarter of a beat later), the pictures still flashing under it.
  let ending = null;
  if (end && frame >= endAt) {
    const title = String(end.title || "");
    const sub = end.subtitle ? String(end.subtitle) : "";
    const tBox = sub ? { x: BX, y: BY, w: BW, h: Math.round(BH * 0.6) } : box;
    const later = startOf(tickAt(endAt) + 2);
    ending = h(React.Fragment, null,
      writing(title, endAt, endAt, tBox, "end-title"),
      sub
        ? h(FitText, { key: "end-sub", style: { position: "absolute", left: BX, top: BY + Math.round(BH * 0.62), width: BW, height: Math.round(BH * 0.38) } }, (s) =>
            h("div", { style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", transformOrigin: ((CX - BX) / s).toFixed(2) + "px " + ((CY - BY - Math.round(BH * 0.62)) / s).toFixed(2) + "px", transform: turn(s) } },
              h("div", { style: { fontFamily: hand, fontWeight: 400, fontSize: 112, lineHeight: 1, color: ink, WebkitTextStroke: "1.8px " + ink, textTransform: "uppercase", whiteSpace: "normal", textAlign: "left", width: "100%", opacity: frame >= later ? 1 : 0 } }, keep(sub))))
        : null);
  }

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, picture, paper, message, extra, ending);
}`;

export const carteFeutre: MontageSkill = {
  key: "carte-feutre",
  version: 1,
  bpm: BPM,
  shots: [10, 24],
  files: [10, 20],
  how: "Une carte de papier blanc pliée, tenue au milieu de l'écran devant ses photos et ses plans qui défilent en stop motion, un nouveau tous les huitièmes de temps (un dixième de seconde), et qui reviennent dans un autre ordre ; la carte bouge un peu à chaque image, comme tenue à la main. Blanche un temps, puis sa phrase s'y écrit au feutre rouge en grandes capitales, un mot de plus à chaque temps, et reste entière jusqu'à la fin, les images défilant toujours dessous.",
  end: true,
  texts: [
    {
      slot: "message",
      role: "hook",
      want: "la phrase écrite au feutre rouge sur la carte, un mot de plus à chaque temps : une invitation ou un message à ses clients, dit simplement comme on l'écrit à la main (une forme comme « pose ton téléphone et viens goûter la pizza du jeudi »), sans slogan ; elle s'écrit en capitales",
      max: 48,
      required: true,
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // Its code shows her pictures in turn, one per eighth of a beat, each coming back several times: the slots only say
    // how much of each passage is seen over the Reel, the same for all (and an even montage if the code cannot run).
    // Its ending card lasts the engine's 1,6 s at least, whatever the tempo.
    const beats = lengthBeats(n) + (end ? Math.max(CARD, CARD_SECONDS / beat) : 0);
    const spans = beatSpans(bpm, Array.from({ length: n }, () => beats / Math.max(1, n)));
    const duration = spans.at(-1)!.end;
    const wants = spans.map((_, i) =>
      i === 0
        ? "l'image qui ouvre le Reel sous la carte encore blanche : la plus forte et la plus colorée de son lieu ou de ses produits (le centre est caché par la carte, ce qui compte se voit autour)"
        : "une photo ou un passage de son lieu, de ses produits, de son équipe ou de ses clients, vu par éclairs d'un dixième de seconde sous la carte : le centre est caché, ce qui compte se voit en haut, en bas ou sur les côtés ; chacun différent du précédent",
    );
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Her sentence is on the card from the first image (written a word a beat from the first beat) to the end, or the card.
      texts: { message: { from: 0, to: end ? round(duration - CARD_SECONDS) : duration } },
      marks: { beat: beat * 30, words: toFrame(WORDS_AT * beat), full: toFrame(FULL_BY * beat) },
    };
  },
  code: CODE,
  fonts: ["Just Another Hand"],
};
