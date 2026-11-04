import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Détourages qui surgissent », written on its model (its reading and its reference, a cut-out with a white scissor
// edge over a street shot, a word written with a marker) and on what its original shares with it (house/originals/
// detourages.mp4, 16,5 s at 94 BPM, a travel edit looked at image by image: shots cut fast on the beat and the half
// beat, a warm filmic grade, a last wide shot held; its own opening, a window widening on black and a title landing
// letter by letter behind a house, is another model's). Here her street or her place, full frame, cut on the beat and
// the half beat; every third beat, one of her photos (an object, a product, someone) surges big over the shot, cut
// out with a thick white scissor edge and a soft shadow, a little tilted, each time at another place, a small word
// written with a white marker against it; it stays the next shot and goes on the cut; the last one is laid on the last
// shot, held to the end. The shot under a cut-out as it surges holds its last image (the half beat of a pop); a video
// given a cut-out's place is cut out the same way (her subject from its whole picture, its last image held), and a file
// whose cut-out is missing pops as a print with a white border instead. Its ending card (an offer, an announcement) is
// written with the same marker over the last shot, softly darkened, the last cut-out above it.

const BPM = 94;
/** The first two shots (beats), then each round: a cut-out's half beat, the shot it stays on, a shot without. */
const INTRO = [1.5, 1.5];
const POP = 0.5;
const WITH = 1.5;
const PLAIN = 1;
/** The last shot, the last cut-out laid on it (beats). */
const FINAL = 4;
/** The engine's ending card: the Reel's last 1,6 s, over the last shot. */
const CARD_SECONDS = 1.6;
const round = (s: number) => Math.round(s * 100) / 100;

/** Each shot's part for n shots: the two first, then rounds of a cut-out, the shot it stays on and one without, then the last cut-out and the last shot. */
function detourageRoles(n: number): ("street" | "pop" | "with" | "final")[] {
  const count = Math.max(5, n);
  const middle = count - 4;
  const roles: ("street" | "pop" | "with" | "final")[] = ["street", "street"];
  for (let i = 0; i < middle; i++) roles.push(i % 3 === 0 && i < middle - 1 ? "pop" : roles.at(-1) === "pop" ? "with" : "street");
  roles.push("pop", "final");
  return roles;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = Math.max(4, mark("beat", 19.15));
  const n = shots.length;
  const cur = Math.min(Math.max(0, n - 1), shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0));
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const pop = Easing.bezier(0.34, 1.56, 0.64, 1);
  const hand = "'Permanent Marker', '" + brand.displayFont + "', cursive";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const PAPER = "#fbfaf7";
  const full = { position: "absolute", left: 0, top: 0, width, height };
  // The marker's white, with a fine dark edge all round (and a soft drop) so it reads on a bright street too.
  const edge = "0 0 1px rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.55), -1px 1px 0 rgba(0,0,0,0.55), 1px -1px 0 rgba(0,0,0,0.55), -1px -1px 0 rgba(0,0,0,0.55), 0 3px 6px rgba(0,0,0,0.45)";
  const hook = reelTexts.find((t) => t.role === "hook");
  const list = reelTexts.find((t) => t.role === "band");
  const others = reelTexts.filter((t) => t !== hook && t !== list);
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");

  // Its shots' parts: a cut-out's shot is the short one (half a beat), the shot after it is the one it stays on; the
  // last shot keeps the last one.
  const isPop = (i) => i > 0 && i < n && shots[i].durationInFrames <= Math.round(0.75 * BEAT);
  const pops = [];
  for (let i = 0; i < n; i++) if (isPop(i)) pops.push(i);
  const popNow = isPop(cur) ? cur : isPop(cur - 1) ? cur - 1 : -1;
  // Each cut-out lands at another place, a little tilted: big in the middle first, then around; the last one big in
  // the middle, or above the ending card.
  const SPOTS = [
    { cx: 540, cy: 850, w: 780, h: 860, tilt: -5 },
    { cx: 690, cy: 600, w: 640, h: 700, tilt: 6 },
    { cx: 380, cy: 1110, w: 600, h: 640, tilt: -7 },
    { cx: 390, cy: 600, w: 640, h: 700, tilt: -4 },
    { cx: 640, cy: 1090, w: 560, h: 600, tilt: 7 },
  ];
  const FINAL_SPOT = end ? { cx: 540, cy: 560, w: 720, h: 680, tilt: -4 } : { cx: 540, cy: 870, w: 820, h: 860, tilt: -4 };
  const spotOf = (k, last) => (last ? FINAL_SPOT : k === 0 ? SPOTS[0] : SPOTS[1 + ((k - 1) % 4)]);
  // Its word's box against the piece: under it, or over it when it has no room under it; always inside the safe zone
  // (below the middle, clear of the apps' buttons).
  const WORD_W = 620;
  const WORD_H = 104;
  const wordBox = (px, py, pw, ph) => {
    let y = py + ph + 12;
    if (y + WORD_H > 1436) y = py - WORD_H - 12;
    y = Math.max(92, Math.min(1436 - WORD_H, y));
    const right = y + WORD_H > 948 ? 940 : 1040;
    const x = Math.max(40, Math.min(right - WORD_W, Math.round(px + pw / 2 - WORD_W / 2)));
    return { left: x, top: Math.round(y), width: WORD_W, height: WORD_H };
  };

  // 1. Her shots full frame, cut on the beat; under a cut-out as it surges, the shot before it holds its last image,
  // pushed in a little.
  const bg = isPop(cur) ? cur - 1 : cur;
  const held = isPop(cur) ? interpolate(frame, [shots[cur].from, shots[cur].from + shots[cur].durationInFrames], [0, 1], clamp) : 0;
  const film = n ? h(Footage, { key: "film", shot: Math.max(0, bg), style: { ...full, ...(held > 0 ? { transform: "scale(" + (1 + 0.035 * held).toFixed(4) + ")" } : {}) } }) : null;

  // 2. The cut-out of the moment: her photo's subject cut out with its white scissor edge and its shadow; a video's
  // subject cut out (from its whole picture, at its own shape); without a cut-out, the picture itself as a print with a
  // white border. It surges from small with a bounce, turning to its tilt, then breathes a little.
  let piece = null;
  let label = null;
  if (popNow >= 0) {
    const k = pops.indexOf(popNow);
    const last = popNow === pops[pops.length - 1] && popNow === n - 2;
    const spot = spotOf(k, last);
    const s = shots[popNow];
    const t = frame - s.from;
    const grow = interpolate(t, [0, 7], [0.3, 1], { ...clamp, easing: pop });
    const breath = 1 + 0.015 * Math.sin(t / 17);
    // Its box is the spot's (not the frame's: a layer of the whole frame moved at every image is heavy), what it holds
    // placed from the spot's corner. It turns to its tilt about its middle; one standing on the frame's bottom edge
    // grows from its foot, upright, so its cut edge stays on the frame's.
    const X0 = Math.round(spot.cx - spot.w / 2);
    const Y0 = Math.round(spot.cy - spot.h / 2);
    let at = null;
    let standing = false;
    const wrap = (child) => {
      const turn = standing ? 0 : spot.tilt * interpolate(t, [0, 7], [2.2, 1], clamp) + Math.sin(t / 13) * 0.8;
      const origin = standing ? Math.round(at.x + at.w / 2 - X0) + "px " + Math.round(height - Y0) + "px" : "50% 50%";
      return h("div", { style: { position: "absolute", left: X0, top: Y0, width: spot.w, height: spot.h, opacity: t < 0 ? 0 : interpolate(t, [0, 2], [0, 1], clamp), transformOrigin: origin, transform: "rotate(" + turn.toFixed(2) + "deg) scale(" + (grow * breath).toFixed(4) + ")" } }, child);
    };
    const sub = s.subject;
    const a = Math.max(0.3, Math.min(3.5, s.aspect || 0.8));
    if (s.kind === "photo" && s.cutout && sub && sub.w > 0 && sub.h > 0) {
      // Its subject's own shape, fitted to the spot; a subject cut by its photo's bottom edge stands on the frame's.
      const ratio = (sub.w * a) / sub.h;
      const hh = Math.min(spot.h, spot.w / Math.max(0.05, ratio));
      const ww = hh * ratio;
      standing = (s.cutEdges || []).indexOf("bottom") >= 0;
      at = { x: spot.cx - ww / 2, y: standing ? height - hh : spot.cy - hh / 2, w: ww, h: hh };
      piece = wrap(h(Cutout, { photo: s, x: Math.round(at.x) - X0, y: Math.round(at.y) - Y0, height: Math.round(hh), rim: 13, shadow: true }));
    } else if (s.subjectBoxes && s.subjectBoxes.some(Boolean)) {
      // Her video's subject read in its whole picture (a box of its own shape), then fitted to the spot; one cut by the
      // picture's bottom edge (a bust, a counter) stands on the frame's.
      const whole = { left: 0, top: 0, width: Math.round(1000 * a), height: 1000 };
      const b = SubjectBox(s, s.from, whole);
      if (b && b.w > 0 && b.h > 0) {
        const k2 = Math.min(spot.w / b.w, spot.h / b.h);
        standing = b.y + b.h >= whole.height - 8;
        at = { x: spot.cx - (k2 * b.w) / 2, y: standing ? height - k2 * b.h : spot.cy - (k2 * b.h) / 2, w: k2 * b.w, h: k2 * b.h };
        const laid = { left: Math.round(at.x - k2 * b.x) - X0, top: Math.round(at.y - k2 * b.y) - Y0, width: Math.round(whole.width * k2), height: Math.round(whole.height * k2) };
        piece = wrap(h(Subject, { shot: popNow, rim: 12, rimColor: PAPER, shadow: true, style: { position: "absolute", ...laid } }));
      }
    }
    if (!piece) {
      // The print: the picture at its own shape, fitted to the spot, a white border and a soft shadow.
      standing = false;
      const pw = Math.min(spot.w, spot.h * a) * 0.92;
      const ph = pw / a;
      at = { x: spot.cx - pw / 2, y: spot.cy - ph / 2, w: pw, h: ph };
      piece = wrap(h("div", { style: { position: "absolute", left: Math.round((spot.w - pw) / 2), top: Math.round((spot.h - ph) / 2), width: Math.round(pw), height: Math.round(ph), backgroundColor: PAPER, boxShadow: "0 18px 36px rgba(20,12,4,0.38)" } },
        h(Footage, { shot: popNow, style: { position: "absolute", left: 14, top: 14, width: Math.round(pw) - 28, height: Math.round(ph) - 28 } })));
    }
    // Its small word, written with the marker against it, in at its third image (straight: text turned at an angle in
    // every image of the scene check is more than its browser holds); every word in the page all along (her separators
    // too), only this cut-out's seen.
    if (list && frame >= list.from && frame < Math.min(list.to, endAt)) {
      const parts = String(list.text).split(/[,;·|\/\n]/.test(list.text) ? /(\s*[,;·|\/\n]\s*)/ : /( +)/);
      const box = wordBox(at.x, at.y, at.w, at.h);
      const land = interpolate(t, [3, 8], [1.18, 1], { ...clamp, easing: pop });
      let index = -1;
      label = h("div", { key: "words", style: full },
        parts.map((p, i) => {
          if (i % 2 === 1 || !p.trim()) return h("span", { key: "s" + i, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, p);
          index += 1;
          const on = index === k && t >= 3;
          return h(FitText, { key: "w" + i, style: { position: "absolute", ...box, opacity: on ? 1 : 0 }, innerStyle: { fontFamily: hand, fontWeight: 400, fontSize: 84, lineHeight: 1.05, color: "#ffffff", whiteSpace: "nowrap", textShadow: edge } },
            h("span", { style: { display: "inline-block", transform: "scale(" + (on ? land : 1).toFixed(3) + ")" } }, keep(p.trim())));
        }));
    }
  }

  // 3. Its title (when she gave one), written big with the marker over the first shots, landing on the first image.
  const title = hook && frame >= hook.from && frame < Math.min(hook.to, endAt)
    ? h(FitText, { key: "title", style: { position: "absolute", left: 90, top: 300, width: 900, height: 420 }, innerStyle: { fontFamily: hand, fontWeight: 400, fontSize: 150, lineHeight: 1.02, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: edge } },
        h("span", { style: { display: "inline-block", transform: "scale(" + interpolate(frame - hook.from, [0, 6], [1.25, 1], { ...clamp, easing: pop }).toFixed(3) + ")" } }, keep(hook.text)))
    : null;

  // Any other text of the Reel (none in its slots): a plain line in the marker's white, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: 150 + i * 120, width: 800, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: edge } }, t.text));

  // 4. Its ending card: the last shot softly darkened, its title written with the marker under the last cut-out, its line under it.
  const veil = end && frame >= endAt ? interpolate(frame, [endAt, endAt + 8], [0, 1], clamp) : 0;
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h(FitText, { style: { position: "absolute", left: 120, top: 1010, width: 840, height: 250 }, innerStyle: { fontFamily: hand, fontWeight: 400, fontSize: 110, lineHeight: 1.04, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: edge } },
          h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 2, endAt + 6], [0, 1], clamp) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1272, width: 800, height: 150 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.18, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: edge } },
              h("span", { style: { display: "inline-block", opacity: interpolate(frame, [endAt + 7, endAt + 11], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;
  const shade = veil > 0 ? h("div", { key: "veil", style: { ...full, background: "linear-gradient(180deg, rgba(14,9,4," + (0.12 * veil).toFixed(3) + ") 0%, rgba(14,9,4," + (0.5 * veil).toFixed(3) + ") 62%, rgba(14,9,4," + (0.62 * veil).toFixed(3) + ") 100%)" } }) : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#141009" } }, film, shade, piece, label, title, extra, ending);
}`;

export const detourages: MontageSkill = {
  key: "detourages",
  version: 1,
  bpm: BPM,
  shots: [10, 19],
  // Up to 31 for a length she asks for: more rounds of her street and her cut-outs.
  long: 31,
  files: [6, 16],
  fonts: ["Permanent Marker"],
  how: "Tes plans de rue ou de ton lieu en plein cadre, coupés sur le temps ; toutes les deux secondes environ, sur le temps, une de tes photos (un objet, un produit, quelqu'un) surgit en grand par-dessus, détourée avec un épais bord blanc de ciseau et une ombre, un peu penchée, chaque fois à une autre place, un petit mot écrit au feutre blanc à côté ; elle reste le plan suivant et part à la coupe ; la dernière se pose sur le dernier plan, tenu jusqu'à la fin.",
  end: true,
  texts: [
    { slot: "mots", role: "band", want: "un petit mot écrit au feutre à côté de chaque détourage, dans l'ordre des détourages (autant que de cases « détourage »), séparés par des virgules, 1 ou 2 mots chacun : ce qu'il est ou qui (une forme comme « la baguette, Léa, le four, à emporter ») ; une virgule de plus sans mot laisse un détourage sans mot", max: 96, required: true },
    { slot: "titre", role: "hook", want: "facultatif : 1 à 3 mots écrits en grand au feutre sur les deux premiers plans : sa rue, son quartier ou son lieu (une forme comme « rue des Martyrs », « le marché »)", max: 22, required: false },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const roles = detourageRoles(n);
    const card = end ? Math.max(0, CARD_SECONDS / beat - (FINAL - 2)) : 0;
    let intro = 0;
    const beats = roles.map((r) => (r === "street" && intro < 2 ? INTRO[intro++]! : r === "pop" ? POP : r === "with" ? WITH : r === "final" ? FINAL + card : PLAIN));
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    let cutouts = 0;
    const wants = roles.map((r, i) =>
      i === 0
        ? "le plan qui ouvre le Reel : ta rue, ta devanture ou ton lieu, vivant, en mouvement"
        : r === "pop"
          ? `détourage ${++cutouts} : une photo d'un objet, d'un produit ou de quelqu'un, sur un fond simple et net${i === roles.length - 2 ? " (le plus beau : il se pose sur le dernier plan)" : ""} ; il surgit détouré en grand par-dessus le plan suivant, avec un petit mot à côté`
          : r === "with"
            ? "un plan de ta rue ou de ton lieu en plein cadre, assez calme : le détourage reste posé dessus"
            : r === "final"
              ? "le dernier plan, large et calme, tenu jusqu'à la fin : le dernier détourage s'y pose"
              : "un plan vivant de ta rue ou de ton lieu, en plein cadre, différent du précédent : des gens qui passent, un geste, un détail",
    );
    const firstPop = spans[roles.indexOf("pop")]!.start;
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The title on the first two shots; the words with the cut-outs, from the first to the end (or its card).
      texts: {
        mots: { from: firstPop, to: round(end ? duration - CARD_SECONDS : duration) },
        titre: { from: 0, to: firstPop },
      },
      marks: { beat: beat * 30, first: toFrame(firstPop) },
    };
  },
  code: CODE,
};
