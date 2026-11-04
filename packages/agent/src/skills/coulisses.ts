import { beatSpans, type MontageSkill } from "../skills.ts";

// « Coulisses façon fiche », written on its original (house/originals/coulisses.mp4, 10,5 s, looked at image by image):
// a deep electric blue squared like a technical sheet; at the middle of the frame a big condensed white title sitting
// on a card with rounded corners (two small words over its two ends: « SOUND » left, « EFFECTS » right, over
// « BREAKDOWN », the whole as wide as the card), the card showing her shots cut fast, a white label in capitals under
// it that changes with each moment (what we see, how many times: « WHOOSH x 2 »), and under the label the edit's own
// timeline, its red playhead crossing it from the first image to the last, its timecode running. Nothing moves but the
// shots, the label and the playhead. Here each of her shots is a moment with its label, cut on the beat; the timeline
// is this Reel's (her shots are the clips of its first track, a sound under each label). Its ending card (an offer, an
// announcement): the card darkens on its last image and takes the ending's title, its line in the label's place.

const BPM = 120;
/** Each shot in the card (beats); the last one held a little longer, the sheet's last label. */
const EACH = 2;
const LAST = 3;
/** The engine's ending card: the Reel's last 1,6 s. */
const CARD_SECONDS = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  // Frames a beat lasts (a sound clip on the timeline lasts most of one).
  const BEAT = Math.max(4, mark("beat", 15));
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: ease });
  const display = "'" + brand.displayFont + "', sans-serif";
  const body = "'" + brand.bodyFont + "', sans-serif";
  // The model's own colours: a deep electric blue squared like a technical sheet, white type.
  const BLUE = "#16017a";
  const LINE = "#2c1a98";
  const WHITE = "#ffffff";
  // Its layout, measured on the model (px of the frame): the title sits on the card, the label under it, the timeline
  // under the label, the whole block at the middle of the frame.
  const X = 132;
  const W = 816;
  const CARD_Y = 585;
  const CARD_H = 459;
  const LABEL_Y = 1104;
  const TL_Y = 1222;
  const TL_H = 272;
  const caps = (s) => String(s || "").toUpperCase();
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const hook = reelTexts.find((t) => t.role === "hook");
  const kicker = reelTexts.find((t) => t.role === "caption");
  const list = reelTexts.find((t) => t.role === "band");
  const others = reelTexts.filter((t) => t !== hook && t !== kicker && t !== list);
  const shown = (t) => Boolean(t) && frame >= t.from && frame < t.to;

  // 1. The title in two levels, as the model: a small word over each end of a big condensed word, the block as wide as
  // the card (a short title as tall as the model's, a long one shrunk to the card's width). Her small words split in
  // two groups, the most even between words; a single one sits over the left end.
  const halves = (text) => {
    const words = String(text || "").split(/[ \t\n]+/).filter(Boolean);
    if (words.length < 2) return [words.join(" "), ""];
    const gap = (k) => Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
    let best = 1;
    for (let k = 2; k < words.length; k++) if (gap(k) < gap(best)) best = k;
    return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  };
  const pair = halves(caps(kicker ? kicker.text : ""));
  const title = caps(hook ? hook.text : "");
  const big = Math.min(168, Math.round(W / (Math.max(4, Array.from(title).length) * 0.5)));
  const titleBlock = shown(hook) || shown(kicker)
    ? h(FitText, { key: "title", style: { position: "absolute", left: X, top: 386, width: W, height: 200 }, innerStyle: { justifyContent: "flex-end" } }, (scale) =>
        h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "stretch" } },
          shown(kicker)
            ? h("div", { style: { display: "flex", justifyContent: pair[1] ? "space-between" : "flex-start", gap: Math.round(28 / scale), fontFamily: body, fontWeight: 700, fontSize: Math.round(60 / Math.max(0.75, scale)), lineHeight: 1, letterSpacing: "-0.01em", color: WHITE, whiteSpace: "nowrap", marginBottom: Math.round(2 / scale) } },
                h("span", { "data-fauve-accent": "" }, pair[0]),
                pair[1] ? h("span", { "data-fauve-accent": "" }, pair[1]) : null)
            : null,
          shown(hook) ? h("div", { style: { fontFamily: display, fontWeight: 700, fontSize: big, lineHeight: 0.84, letterSpacing: "-0.01em", color: WHITE, whiteSpace: "nowrap", textAlign: "center" } }, title) : null))
    : null;

  // 2. The card: her shot of the moment, cut on the beat, its corners rounded; on the ending card it darkens.
  const card = h("div", { key: "card", style: { position: "absolute", left: X, top: CARD_Y, width: W, height: CARD_H, borderRadius: 30, overflow: "hidden", backgroundColor: "#0b0440" } },
    n ? h(Footage, { shot: cur, style: { left: 0, top: 0, width: W, height: CARD_H } }) : null,
    end && frame >= endAt ? h("div", { style: { position: "absolute", left: 0, top: 0, width: W, height: CARD_H, backgroundColor: "rgba(10,3,52," + (0.64 * o(endAt, endAt + 8)).toFixed(3) + ")" } }) : null);

  // 3. The label under the card: what this shot shows, her words one per shot in their order (spread over the shots
  // when she gave fewer), white capitals changing on the cut. Every label is in the page all along (her separators
  // too), only the current one seen.
  let labels = null;
  if (list && frame >= list.from && frame < Math.min(list.to, endAt)) {
    const text = String(list.text);
    const parts = text.split(/[,;·|\/\n]/.test(text) ? /(\s*[,;·|\/\n]\s*)/ : /([ \t]+)/);
    const items = [];
    parts.forEach((p, i) => { if (i % 2 === 0 && p.trim()) items.push(i); });
    const count = Math.max(1, items.length);
    const startOf = (k) => (!n ? 0 : count <= n ? shots[Math.floor((k * n) / count)].from : k < n ? shots[k].from : durationInFrames + 1);
    let current = -1;
    for (let k = 0; k < items.length; k++) if (startOf(k) <= frame) current = k;
    labels = h("div", { key: "labels", style: { position: "absolute", left: 0, top: 0, width, height } },
      parts.map((p, i) => {
        const k = items.indexOf(i);
        if (k < 0) return h("span", { key: "s" + i, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, p);
        return h(FitText, { key: "l" + i, style: { position: "absolute", left: 140, top: LABEL_Y, width: 800, height: 100, opacity: k === current ? 1 : 0 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 72, lineHeight: 1, letterSpacing: "-0.01em", color: WHITE, whiteSpace: "nowrap" } }, caps(p.trim()));
      }));
  }

  // 4. The timeline under it: this Reel's own edit as an editing app shows it, its playhead crossing it from the first
  // image to the last, its timecode running; her shots are the clips of its first track, a sound under each cut. A
  // graphic: its marks are decor.
  const HEAD = 140;
  const SPAN = W - HEAD - 14;
  const xAt = (f) => HEAD + Math.max(0, Math.min(1, f / Math.max(1, durationInFrames - 1))) * SPAN;
  const block = (key, left, w, y, hh, style, child) => h("div", { key, style: { position: "absolute", left: Math.round(left), top: y, width: Math.max(2, Math.round(w)), height: hh, borderRadius: 3, overflow: "hidden", ...style } }, child || null);
  const pad = (v) => (v < 10 ? "0" : "") + v;
  const tc = "01:00:" + pad(Math.floor(frame / 30) % 60) + ":" + pad(frame % 30);
  const ROWS = [["V6", 42, 10], ["V5", 55, 10], ["V4", 68, 10], ["V3", 81, 10], ["V2", 94, 10], ["V1", 108, 40], ["A1", 156, 32], ["A2", 194, 32], ["A3", 232, 30]];
  const heads = ROWS.map((r) => h("div", { key: "h" + r[0], style: { position: "absolute", left: 10, top: r[1], width: HEAD - 22, height: r[2], display: "flex", alignItems: "center", gap: 6 } },
    h("div", { style: { minWidth: 26, height: Math.min(14, r[2]), borderRadius: 3, backgroundColor: r[0][0] === "V" ? "#5b1f2a" : "#1f4d3a", color: "#f3d6d9", fontFamily: "sans-serif", fontSize: 10, lineHeight: Math.min(14, r[2]) + "px", textAlign: "center" } }, r[0]),
    h("div", { style: { width: 12, height: Math.min(8, r[2]), borderRadius: 2, backgroundColor: "#3d3a46" } }),
    h("div", { style: { width: 12, height: Math.min(8, r[2]), borderRadius: 2, backgroundColor: "#3d3a46" } })));
  const ticks = Array.from({ length: 11 }, (_, i) => h("div", { key: "t" + i, style: { position: "absolute", left: Math.round(HEAD + (i * SPAN) / 10), top: 18, width: 1, height: 10, backgroundColor: "#6d6977" } }));
  const span = (s) => [xAt(s.from), xAt(s.from + s.durationInFrames) - xAt(s.from) - 2];
  const film = "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 30px), linear-gradient(180deg, #5b5866, #3b3943)";
  const clips = shots.map((s, i) => {
    const [x, w] = span(s);
    return h(React.Fragment, { key: "c" + i },
      block("v" + i, x, w, 108, 28, { backgroundImage: film }),
      block("n" + i, x, w, 137, 11, { backgroundColor: i % 2 ? "#3f86d8" : "#a36ad6" }),
      block("a" + i, x, Math.min(w, BEAT * 0.8 * (SPAN / Math.max(1, durationInFrames))), i % 2 ? 194 : 156, 32, { backgroundColor: "#1f9e63", display: "flex", alignItems: "center", justifyContent: "center" },
        h("div", { style: { width: 10, height: 10, transform: "rotate(45deg)", backgroundColor: "rgba(255,255,255,0.85)" } })));
  });
  const bars = [
    block("b6", xAt(0), SPAN, 42, 10, { backgroundColor: "#d9c7a4" }),
    block("b5", xAt(0), SPAN, 55, 10, { backgroundColor: "#cdb994" }),
    block("b4", xAt(0), SPAN, 68, 10, { backgroundColor: "#3a76c8" }),
    block("b3", xAt(durationInFrames * 0.03), SPAN * 0.97, 81, 10, { backgroundColor: "#f0600f" }),
    block("b2", xAt(0), SPAN, 94, 10, { backgroundColor: "#e5560a" }),
    block("m", xAt(0), SPAN, 232, 30, { backgroundColor: "#1a8a57", backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 9px)", backgroundSize: "100% 30%", backgroundRepeat: "no-repeat", backgroundPosition: "0 50%" }),
  ];
  const head = xAt(frame);
  const timeline = h("div", { key: "timeline", "data-fauve-decor": "", style: { position: "absolute", left: X, top: TL_Y, width: W, height: TL_H, borderRadius: 24, overflow: "hidden", backgroundColor: "#1e1b25" } },
    h("div", { style: { position: "absolute", left: 16, top: 4, fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, color: "#e9e7ee", letterSpacing: "0.02em" } }, tc),
    h("div", { style: { position: "absolute", left: HEAD - 6, top: 0, width: 1, height: TL_H, backgroundColor: "#34313d" } }),
    h("div", { style: { position: "absolute", left: HEAD, top: 30, width: SPAN, height: 1, backgroundColor: "#3a3744" } }),
    ticks, heads, bars, clips,
    h("div", { style: { position: "absolute", left: Math.round(head - 1), top: 12, width: 3, height: TL_H - 12, backgroundColor: "#ff3b30" } }),
    h("div", { style: { position: "absolute", left: Math.round(head - 8), top: 4, width: 17, height: 14, backgroundColor: "#ff3b30", clipPath: "polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)" } }));

  // Any other text of the Reel (none in its slots): a plain white line in the squares above the title, so nothing she wrote is lost.
  const extra = others.filter((t) => shown(t) && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: 800, top: 200 + i * 110, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, color: WHITE, textAlign: "center" } }, t.text));

  // 5. Its ending card: in the darkened card, its title in the title's condensed capitals; its line in the label's place.
  // Their entrance moves a span inside each box: a transform on the box itself would undo FitText's own scale.
  const rise = (a) => ({ display: "inline-block", opacity: o(a, a + 6), transform: "translateY(" + ((1 - o(a, a + 10)) * 16).toFixed(1) + "px)" });
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h(FitText, { style: { position: "absolute", left: X + 48, top: CARD_Y + 44, width: W - 96, height: CARD_H - 88 }, innerStyle: { fontFamily: display, fontWeight: 700, fontSize: 132, lineHeight: 0.92, letterSpacing: "-0.01em", color: WHITE, textAlign: "center", textWrap: "balance" } },
          h("span", { style: rise(endAt + 2) }, keep(caps(end.title)))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1086, width: 800, height: 128 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 60, lineHeight: 1.05, letterSpacing: "-0.01em", color: WHITE, textAlign: "center", textWrap: "balance" } },
              h("span", { style: rise(endAt + 6) }, keep(caps(end.subtitle))))
          : null)
    : null;

  const ground = { backgroundColor: BLUE, backgroundImage: "linear-gradient(" + LINE + " 0 2px, transparent 2px), linear-gradient(90deg, " + LINE + " 0 2px, transparent 2px)", backgroundSize: "33.75px 33.75px", backgroundPosition: "14px 34px" };
  return h(AbsoluteFill, { style: ground }, titleBlock, card, labels, timeline, extra, ending);
}`;

export const coulisses: MontageSkill = {
  key: "coulisses",
  version: 1,
  bpm: BPM,
  shots: [6, 14],
  files: [4, 10],
  how: "Un fond bleu électrique quadrillé comme une fiche technique ; au milieu, un grand titre condensé blanc posé sur une carte aux coins arrondis, un petit mot au-dessus de chacun de ses bouts ; dans la carte ses plans de coulisses coupés sur le temps, sous la carte une étiquette en capitales qui dit ce qu'on voit à chaque plan, et dessous la timeline du montage dont la tête de lecture avance jusqu'à la fin.",
  end: true,
  texts: [
    {
      slot: "surtitre",
      role: "caption",
      want: "2 petits mots posés au-dessus des deux bouts du titre, le premier à gauche, le second à droite : chez qui, ou de quoi (une forme comme « chez lino », « pâte fraîche », « le fournil »)",
      max: 20,
      required: true,
    },
    {
      slot: "titre",
      role: "hook",
      want: "le grand titre condensé en capitales sur la carte, un ou deux mots : ce que montre la fiche (une forme comme « coulisses », « en cuisine », « making-of »)",
      max: 16,
      required: true,
    },
    {
      slot: "etiquettes",
      role: "band",
      want: "une étiquette par plan, dans l'ordre des plans (autant que de cases), séparées par des virgules : ce qu'on voit à ce plan en 1 ou 2 mots, 16 caractères au plus chacune, avec si tu veux combien de fois (« x2 », « x3 »), comme une fiche technique (une forme comme « le pétrin, la pâte x2, le four, la fournée »)",
      max: 200,
      required: true,
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // Each shot two beats in the card, the last one three; with an ending card, the card's time after it (at least 1,6 s).
    const card = end ? Math.ceil(CARD_SECONDS / beat - 0.01) : 0;
    const spans = beatSpans(bpm, [...Array.from({ length: Math.max(0, n - 1) }, () => EACH), LAST + card]);
    const duration = spans.at(-1)!.end;
    const wants = spans.map((_, i) =>
      i === 0
        ? "le plan qui ouvre la fiche, dans la carte : un geste de son travail, net et de près, qu'on comprend d'un coup d'œil"
        : i < spans.length - 1
          ? "un geste, un outil ou une étape de ses coulisses, de près, différent du précédent (vu dans une carte en largeur : le centre de l'image compte)"
          : "le plan qui finit la fiche, tenu un peu plus longtemps : le résultat, ou un plan comme le premier pour boucler",
    );
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The title is there from the first image to the last; the labels until the ending card.
      texts: {
        surtitre: { from: 0, to: duration },
        titre: { from: 0, to: duration },
        etiquettes: { from: 0, to: round(end ? duration - CARD_SECONDS : duration) },
      },
      marks: { beat: beat * 30 },
    };
  },
  code: CODE,
};
