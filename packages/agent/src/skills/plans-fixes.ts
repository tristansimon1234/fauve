import { beatSpans, type MontageSkill } from "../skills.ts";

// « Plans fixes de cinéma », written on its original (house/originals/plans-fixes.mp4, 12,5 s, a city at golden hour
// looked at image by image, its words and cuts measured): its tempo is 65 BPM, every cut on a beat. A first still shot
// held four beats and a half, a small white title at the middle on two levels: three small sans words above (cut in on
// the half beats: 0,47, 0,87 and 1,37 s), two serif words under them (1,97 and 2,77 s), nothing else, no shade but a
// soft one, gone with the cut; then still shots of a beat each, from golden hour to blue hour, the camera never moving
// and the world moving in it; the last one, at night, held two beats, a tiny line at the middle fading in. Here her words
// land on the same beats, her photos are still too (the one that opens moves a little), a file seen again shows another
// part of its picture (a video in width) or a closer frame, and its ending card (an offer, an announcement) is the
// title's two levels at the middle of the last shot, faintly darkened.

const BPM = 65;
/** The first shot, with the title on it, then each still shot, then the last one, in beats. */
const OPENING = 4.5;
const SHOT = 1;
const LAST = 2;
/** Past the original's ten shots in the middle (a length she asked for), each one more is held two beats. */
const MORE = 2;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS). */
const END_CARD = 1.6;
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = mark("beat", 27.69);
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const display = "'" + brand.displayFont + "', 'Instrument Serif', Georgia, serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const small = reelTexts.find((t) => t.role === "caption");
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== small && t !== hook);
  // White, as the model, with only a soft shade and a tight edge, so it still reads on a pale sky.
  const shade = "0 0 1px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3), 0 2px 14px rgba(0,0,0,0.32)";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");

  // 1. Her still shots, full frame, cut on the beat, as filmed. A file seen again (a video given several shots) shows
  // another frame of it, so two moments of one still camera never read as a missed cut: a video in width another part
  // of its picture (the side farther from its subject first), else a closer frame. A photo that opens the Reel moves a
  // little over its four beats; the other photos stay still, as the model's shots.
  const again = (i) => {
    let k = 0;
    for (let j = 0; j < i; j++) if (shots[i] && shots[i].src && shots[j].src === shots[i].src) k++;
    return k;
  };
  const place = (i) => {
    const sh = shots[i];
    const k = sh ? again(i) : 0;
    const a = sh ? Number(sh.aspect) || 0.5625 : 0.5625;
    if (k && a > 1.2) {
      const W = Math.round(height * a);
      const fx = sh.focus && Number.isFinite(sh.focus.x) ? sh.focus.x : 0.5;
      const right = (fx < 0.5) === (k % 2 === 1);
      return { style: { position: "absolute", left: right ? width - W : 0, top: 0, width: W, height }, scale: 1, origin: "50% 50%" };
    }
    return { style: full, scale: k ? 1.35 : 1, origin: k % 2 ? "50% 64%" : "50% 30%" };
  };
  const s = shots[cur];
  const p = place(cur);
  const push = cur === 0 && s && s.kind === "photo" ? 1 + 0.03 * interpolate(frame, [0, Math.max(1, s.durationInFrames)], [0, 1], clamp) : 1;
  const scale = p.scale * push;
  const film = n
    ? h("div", { style: { ...full, overflow: "hidden" } },
        h("div", { style: { ...full, ...(scale > 1.0001 ? { transform: "scale(" + scale.toFixed(4) + ")", transformOrigin: p.origin } : {}) } },
          h(Footage, { shot: cur, style: p.style })))
    : null;

  // 2. The small title at the middle, on two levels: its small sans words above, cut in on the half beats from half a
  // beat in; its serif words under them, cut in a beat apart from half a beat after them, all of them in by the third
  // beat (closer together when there are many). Each word is in the page from the start, unseen until its turn; a
  // separator (« · », « — ») stays with the word before it.
  const split = (text) => {
    const out = [];
    String(text || "").split(/[ \t\n]+/).filter(Boolean).forEach((w) => {
      if (out.length && !/[\p{L}\p{N}]/u.test(w)) out[out.length - 1] += " " + w;
      else out.push(w);
    });
    return out;
  };
  const HALF = BEAT / 2;
  const sw = small ? split(small.text) : [];
  const tw = hook ? split(hook.text) : [];
  const start = Math.min(small ? small.from : Infinity, hook ? hook.from : Infinity);
  const smallStep = Math.min(HALF, (1.5 * BEAT) / Math.max(1, sw.length));
  const serifFrom = start + (sw.length ? sw.length * smallStep : 0);
  const serifStep = tw.length > 1 ? Math.min(BEAT, Math.max(HALF / 2, (start + 3 * BEAT - serifFrom) / (tw.length - 1))) : 0;
  const words = (list, at, accent) => list.flatMap((w, i) => [
    i ? " " : null,
    h("span", { key: i, ...(accent ? { "data-fauve-accent": "" } : {}), style: { whiteSpace: "nowrap", opacity: frame >= Math.round(at(i)) ? 1 : 0 } }, w),
  ]);
  const smallOn = small && frame >= start && frame < Math.min(small.to, endAt);
  const hookOn = hook && frame >= start && frame < Math.min(hook.to, endAt);
  const smallStyle = { fontFamily: body, fontWeight: 600, fontSize: 30, lineHeight: 1.2, letterSpacing: "0.02em", wordSpacing: "0.32em", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade };
  const serifStyle = { fontFamily: display, fontWeight: 400, fontSize: 104, lineHeight: 1.0, letterSpacing: "-0.01em", color: "#ffffff", whiteSpace: "nowrap", textShadow: shade };
  const kicker = smallOn
    ? h(FitText, { key: "k", style: { position: "absolute", left: 140, top: 846, width: width - 280, height: 56 }, innerStyle: { ...smallStyle, justifyContent: "flex-end" } },
        h("span", null, words(sw, (i) => start + i * smallStep, true)))
    : null;
  const title = hookOn
    ? h(FitText, { key: "t", style: { position: "absolute", left: 140, top: 904, width: width - 280, height: 132 }, innerStyle: { ...serifStyle, justifyContent: "flex-start" } },
        h("span", null, words(tw, (i) => serifFrom + i * serifStep, false)))
    : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1250 - i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: shade } }, t.text));

  // 3. Its ending card, small at the middle of the last shot (faintly darkened), as the model ends: its title in the
  // serif, a line of small spaced capitals under it, fading in.
  const fade = (a) => interpolate(frame, [a, a + 5], [0, 1], clamp);
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, null,
        h("div", { style: { ...full, backgroundColor: "rgba(0,0,0," + (0.24 * fade(endAt)).toFixed(3) + ")" } }),
        h(FitText, { style: { position: "absolute", left: 140, top: end.subtitle ? 700 : 760, width: width - 280, height: 300 }, innerStyle: { ...serifStyle, fontSize: 96, lineHeight: 1.02, whiteSpace: "normal", textWrap: "balance", textAlign: "center", justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", { style: { opacity: fade(endAt + 1) } }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 1018, width: width - 280, height: 130 }, innerStyle: { ...smallStyle, fontSize: 36, lineHeight: 1.3, letterSpacing: "0.14em", wordSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "normal", textWrap: "balance", textAlign: "center", justifyContent: "flex-start", fontVariantNumeric: "lining-nums" } },
              h("span", { style: { opacity: fade(endAt + 6) } }, words(split(keep(end.subtitle)), () => endAt + 6, true)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, kicker, title, extra, ending);
}`;

export const plansFixes: MontageSkill = {
  key: "plans-fixes",
  version: 1,
  bpm: BPM,
  shots: [5, 12],
  // Up to 20 for a length she asks for: about 30 s at its own tempo.
  long: 20,
  files: [4, 10],
  how: "Des plans fixes, la caméra posée, le monde qui bouge dedans : le premier tenu quatre temps et demi, un petit titre blanc au milieu en deux niveaux, ses petits mots sans serif au-dessus qui arrivent un à un sur les demi-temps, ses mots en serif dessous ; puis un plan fixe par temps, de l'heure dorée à l'heure bleue, et un dernier plan du soir tenu deux temps.",
  end: true,
  texts: [
    {
      slot: "accroche",
      role: "caption",
      want: "2 à 4 petits mots sans serif au-dessus du titre, qui l'amènent (une forme comme « le pouvoir du », « un soir à », « la lumière de »)",
      max: 22,
      required: true,
    },
    {
      slot: "titre",
      role: "hook",
      want: "le petit titre en serif sous ces mots, 1 ou 2 mots : son lieu, son quartier ou le moment (une forme comme « plan fixe », « Belleville », « l'heure dorée »)",
      max: 18,
      required: true,
    },
  ],
  timeline(n, options: { end: boolean; bpm?: number }) {
    const { end } = options;
    // At her music's tempo when one is given (slower: a longer, calmer Reel; faster: a shorter one), else the model's.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(5, Math.min(20, n));
    // The opening shot, a still shot a beat (past the original's ten, two beats), the last one held; with an ending card,
    // the last shot held the card's 1.6 s more, from a beat.
    const middle = Array.from({ length: count - 2 }, (_, i) => (i < 10 ? SHOT : MORE));
    const spans = beatSpans(bpm, [OPENING, ...middle, LAST]);
    const cardAt = spans.at(-1)!.end;
    const duration = round(end ? onFrame(cardAt + END_CARD) : cardAt);
    spans[spans.length - 1] = { start: spans.at(-1)!.start, end: duration };
    const cut = spans[1]!.start;
    const wants = [
      "le plan fixe qui ouvre, large et beau, filmé sans bouger : son lieu ou sa rue, idéalement à l'heure dorée, le milieu de l'image calme (le petit titre s'y pose) ; tenu quatre secondes",
      ...middle.map((_, i) =>
        i === middle.length - 1 && middle.length > 2
          ? "un plan fixe du soir qui tombe, bien composé : des lumières, des passants"
          : "un plan fixe de son lieu ou de son quartier, filmé sans bouger et bien composé : quelque chose bouge dans le cadre (des passants, une lumière, un geste) ; dans l'ordre de la journée, du plus lumineux au plus sombre",
      ),
      "le dernier plan fixe, tenu jusqu'à la fin : un plan du soir ou de nuit, calme, des lumières",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its words cut in from half a beat in, on the first shot, and go with the cut.
      texts: {
        accroche: { from: round(onFrame(beat / 2)), to: round(cut) },
        titre: { from: round(onFrame(beat / 2)), to: round(cut) },
      },
      marks: { beat: beat * 30 },
    };
  },
  code: CODE,
};
