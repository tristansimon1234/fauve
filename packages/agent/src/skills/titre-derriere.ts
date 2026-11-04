import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Titre derrière toi », written on its original (house/originals/titre-derriere.mp4, 12,1 s, a city edit looked at
// image by image): a wide still shot of the place, someone walking in front of it; at the tenth image a giant name in
// very bold capitals, a deep red measured on the original, spans the frame's width in its upper third, dropping in with
// a vertical motion blur in three images, what stands in front of it passing over its letters; two small handwritten
// white words between little stars just above it; a white silhouette of something in the picture flashes for a few
// images, then a white wave runs across the title's letters, one after the other, from the first to the last, and the
// title goes with the cut (3,4 s). Then a burst of shots on the beat, some very quick, a push through with a zoom blur
// into a few of them, the subject of a shot flashing white now and then; a rapid burst of half beats; a last wide shot.
// Here her subject is cut out at every image and walks in front of her title (when it is not, the title simply stays
// in front); its ending card (an offer, an announcement) drops in in the title's capitals over the last shot, darkened.

const BPM = 96;
/** The title's shot, in beats: the title lands half a beat in, its white wave starts at three and a half. */
const TITLE = 6;
const LAND = 0.5;
const WAVE = 3.5;
/** The shots after it, as the original cuts them (in beats at its tempo), then its rapid burst and its last shot. */
const VERSE = [1.5, 0.5, 0.5, 1.5, 0.5, 1, 1, 1.5, 1, 1.5];
const RAPID = 5;
const HALF = 0.5;
const LAST = 2;
/** Past the original's ten (a length she asked for), each verse shot more holds two beats. */
const MORE = 2;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS). */
const END_CARD = 1.6;
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  // Its blur filter's id, its own (two copies of the scene in one page never share one).
  const BLUR = "vb" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = mark("beat", 18.75);
  const WAVE = mark("wave", Math.round(3.5 * BEAT));
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const o = (a, b) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  const display = "'" + brand.displayFont + "', 'Archivo Black', 'Arial Black', sans-serif";
  const hand = "'Caveat', '" + brand.bodyFont + "', cursive";
  const body = "'" + brand.bodyFont + "', 'Inter', sans-serif";
  // The model's own colours: its deep red (as read on its original, a touch brighter than its graded frames, so it holds
  // on a darker wall), and the warm white of its flashes.
  const RED = "#7a1414";
  const WHITE = "#fbf7f2";
  const box = { position: "absolute", left: 0, top: 0, width, height };
  const hook = reelTexts.find((t) => t.role === "hook");
  const small = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== small);
  const shade = "0 1px 2px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.4), 0 2px 14px rgba(0,0,0,0.35)";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");

  // 1. Her shots full frame, cut on the beat; a photo that opens the Reel slowly pushed in (her cut-out with it). A few
  // cuts between two shots of a beat or more push through the outgoing shot into the next one with a zoom blur: every
  // second such cut.
  // A file seen again (a video given several shots) shows another frame of it, so two moments of one still camera never
  // read as a missed cut: a video in width the part of its picture next to the first one, else a closer frame, low then
  // high. Her cut-out is drawn in the same place as her shot.
  const again = (i) => {
    let k = 0;
    for (let j = 0; j < i; j++) if (shots[i] && shots[i].src && shots[j].src === shots[i].src) k++;
    return k;
  };
  const place = (i) => {
    const sh = shots[i];
    const k = sh ? again(i) : 0;
    const a = sh ? Number(sh.aspect) || 0.5625 : 0.5625;
    if (k && k <= 2 && a > 1.2) {
      // Its first frame is the part around its subject; seen again, the part next to it (most of a frame over, toward
      // the side with room, then the other), never a side so far it may be empty; no room there, a closer frame.
      const W = Math.round(height * a);
      const room = W - width;
      const fx = sh.focus && Number.isFinite(sh.focus.x) ? sh.focus.x : 0.5;
      const first = Math.max(0, Math.min(room, fx * W - width / 2));
      const toward = first > room / 2 ? -1 : 1;
      const left = Math.max(0, Math.min(room, first + (k === 1 ? toward : -toward) * 0.6 * width));
      if (Math.abs(left - first) >= 0.3 * width) return { style: { position: "absolute", left: -Math.round(left), top: 0, width: W, height }, scale: 1, origin: "50% 50%" };
    }
    return { style: box, scale: k ? 1.35 : 1, origin: k % 2 ? "50% 64%" : "50% 30%" };
  };
  const first = shots[0];
  const push = first && first.kind === "photo" ? 1 + 0.04 * interpolate(frame, [0, Math.max(1, first.durationInFrames)], [0, 1], clamp) : 1;
  const laid = (Kind, i, extra) => {
    const p = place(i);
    const scale = p.scale * (i === 0 ? push : 1);
    const node = h(Kind, { shot: i, style: p.style, ...(extra || {}) });
    return scale > 1.0001 ? h("div", { style: { ...box, overflow: "hidden" } }, h("div", { style: { ...box, transform: "scale(" + scale.toFixed(4) + ")", transformOrigin: p.origin } }, node)) : node;
  };
  const draw = (i) => () => laid(Footage, i);
  const long = (i) => shots[i] && shots[i].durationInFrames >= BEAT - 1;
  const zooms = [];
  let eligible = 0;
  for (let k = 2; k < n; k++) {
    if (!long(k - 1) || !long(k)) continue;
    eligible++;
    if (eligible % 2 === 0) zooms.push(k);
  }
  const ZOOM = 8;
  const zooming = zooms.find((k) => frame >= shots[k].from - ZOOM / 2 && frame < shots[k].from + ZOOM / 2);
  const film = zooming !== undefined && frame < endAt
    ? h(ZoomThrough, { key: "z" + zooming, from: draw(zooming - 1), to: draw(zooming), at: shots[zooming].from - ZOOM / 2, frames: ZOOM, scale: 2.2 })
    : laid(Footage, cur);

  // 2. Her subject flashing white for a few images, a silhouette of the warm white: once on the title's shot before its
  // wave, then on every fifth shot of the burst, just after its cut.
  const flashOn = (cur === 0 && frame >= Math.round(2.75 * BEAT) && frame < Math.round(2.75 * BEAT) + 3) ||
    (cur >= 3 && cur % 5 === 3 && frame >= shots[cur].from + 1 && frame < shots[cur].from + 3 && frame < endAt);
  const flash = flashOn ? laid(Subject, cur, { fill: WHITE }) : null;

  // 3. The title: one line of giant capitals across the frame's width in its upper third, dropping in with a vertical
  // motion blur, its small handwritten words between little stars just above it; behind her (her cut-out drawn over
  // it). Its letters are all in the page from its first image (so its size is measured once, on the whole name), each
  // its own span only while the white wave runs across them; no kerning across its letters, so nothing moves then.
  const titleOn = hook && frame >= hook.from && frame < Math.min(hook.to, endAt);
  const drop = (at) => {
    const p = interpolate(frame, [at, at + 4], [0, 1], clamp);
    const q = 1 - p;
    return { display: "inline-block", opacity: frame >= at ? 1 : 0, transform: "translateY(" + (-90 * q * q).toFixed(1) + "px) scaleY(" + (1 + 0.32 * q).toFixed(3) + ")", transformOrigin: "50% 100%", filter: q > 0.02 ? "url(#" + BLUR + ")" : "none" };
  };
  const blurOf = (at) => (1 - interpolate(frame, [at, at + 4], [0, 1], clamp)) * 16;
  const blurDef = (at) => h("svg", { key: "vb", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
    h("filter", { id: BLUR, x: "-10%", y: "-60%", width: "120%", height: "220%" }, h("feGaussianBlur", { stdDeviation: "0 " + blurOf(at).toFixed(2) })));
  const waved = (text) => {
    const chars = Array.from(text);
    const units = chars.map((c, i) => i).filter((i) => !/\s/.test(chars[i]));
    const span = units.length * 2.4 + 3;
    if (frame < WAVE || frame >= WAVE + span) return text;
    return chars.map((c, i) => {
      const k = units.indexOf(i);
      const lit = k >= 0 && frame >= WAVE + k * 2.4 && frame < WAVE + k * 2.4 + 3;
      return h("span", { key: i, style: { color: lit ? WHITE : RED } }, c);
    });
  };
  // A very fine warm-white edge: unseen on a sky, it keeps the red word whole on a dark wall.
  const titleStyle = { fontFamily: display, fontWeight: 900, fontSize: 250, lineHeight: 1, letterSpacing: "-0.02em", textTransform: "uppercase", whiteSpace: "nowrap", color: RED, textShadow: "0 0 1px rgba(251,247,242,0.55), 0 0 3px rgba(251,247,242,0.2)", fontKerning: "none", fontVariantLigatures: "none", fontSynthesis: "none" };
  const star = (k, size) => h("svg", { key: "st" + k, width: size, height: size, viewBox: "-1 -1 2 2", style: { display: "inline-block", verticalAlign: "middle", margin: "0 0.06em" } },
    h("path", { d: "M0 -1C0.12 -0.12 0.12 -0.12 1 0C0.12 0.12 0.12 0.12 0 1C-0.12 0.12 -0.12 0.12 -1 0C-0.12 -0.12 -0.12 -0.12 0 -1Z", fill: WHITE }));
  // One box for both, its bottom fixed: a long title is smaller, its small words still just above it, at their size.
  const smallOn = small && frame >= small.from && frame < Math.min(small.to, endAt);
  const title = titleOn
    ? h(React.Fragment, { key: "title" },
        blurDef(hook.from),
        h(FitText, { style: { position: "absolute", left: 54, top: 380, width: width - 108, height: 380 }, innerStyle: { justifyContent: "flex-end" } }, (scale) =>
          h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "center" } },
            small
              ? h("div", { style: { display: "inline-flex", alignItems: "center", gap: Math.round(18 / Math.max(0.45, scale)), marginBottom: Math.round(-6 / Math.max(0.45, scale)), fontFamily: hand, fontWeight: 600, fontSize: Math.round(74 / Math.max(0.45, scale)), lineHeight: 1.1, color: WHITE, whiteSpace: "nowrap", textShadow: shade, opacity: smallOn ? o(small.from, small.from + 4) : 0 } },
                  h("span", { style: { display: "inline-flex", alignItems: "center" } }, star(0, Math.round(26 / Math.max(0.45, scale))), star(1, Math.round(17 / Math.max(0.45, scale)))),
                  h("span", null, small.text),
                  h("span", { style: { display: "inline-flex", alignItems: "center" } }, star(2, Math.round(17 / Math.max(0.45, scale))), star(3, Math.round(26 / Math.max(0.45, scale)))))
              : null,
            h("div", { style: titleStyle }, h("span", { style: drop(hook.from) }, waved(hook.text))))))
    : null;
  const subject = titleOn && !flashOn ? laid(Subject, 0) : null;

  // Any other text of the Reel (none in its slots): a plain white line, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: 1250 - i * 130, height: 120 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: WHITE, textAlign: "center", textShadow: shade } }, t.text));

  // 4. Its ending card: the last shot darkened, its words dropping in in the title's capitals (the warm white of its
  // flashes, so they read on any picture), a handwritten line under them.
  const ending = end && frame >= endAt
    ? h(AbsoluteFill, null,
        h("div", { style: { ...box, backgroundColor: "rgba(0,0,0," + (0.42 * o(endAt, endAt + 6)).toFixed(3) + ")" } }),
        blurDef(endAt + 2),
        h(FitText, { style: { position: "absolute", left: 54, top: end.subtitle ? 520 : 600, width: width - 108, height: 420 }, innerStyle: { ...titleStyle, fontSize: 150, lineHeight: 0.96, whiteSpace: "normal", textWrap: "balance", textAlign: "center", color: WHITE, textShadow: shade, justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", { style: drop(endAt + 2) }, keep(end.title))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: 960, width: width - 280, height: 190 }, innerStyle: { justifyContent: "flex-start", fontFamily: hand, fontWeight: 600, fontSize: 64, lineHeight: 1.12, color: WHITE, textAlign: "center", textWrap: "balance", textShadow: shade } },
              h("span", { style: { display: "inline-block", opacity: o(endAt + 7, endAt + 12) } }, keep(end.subtitle)))
          : null)
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, film, title, subject, flash, extra, ending);
}`;

export const titreDerriere: MontageSkill = {
  key: "titre-derriere",
  version: 1,
  bpm: BPM,
  shots: [6, 17],
  // Up to 30 for a length she asks for: about 30 s at its own tempo.
  long: 30,
  files: [5, 14],
  how: "Un plan large et fixe de son lieu où elle passe devant ; son titre géant en capitales très grasses, d'un rouge profond, tombe en travers de l'écran au tiers haut avec un flou de mouvement, deux petits mots écrits à la main entre de petites étoiles au-dessus, et elle passe devant ses lettres ; sa silhouette flashe en blanc, une vague blanche court sur les lettres du titre, qui part à la coupe ; puis une rafale de ses plans sur le temps, certains très courts, quelques-uns poussés dans un flou de zoom, une silhouette qui flashe en blanc de temps en temps, une rafale de demi-temps et un dernier plan large.",
  end: true,
  texts: [
    {
      slot: "surtitre",
      role: "caption",
      want: "2 ou 3 petits mots écrits à la main au-dessus du titre, entre deux petites étoiles, qui l'amènent (une forme comme « un mois à », « un samedi à », « bienvenue à »)",
      max: 18,
      required: true,
    },
    {
      slot: "titre",
      role: "hook",
      want: "le titre géant derrière elle, sur une ligne en capitales : un seul mot de préférence (son quartier, sa rue, sa ville, ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), plus il est court plus il est grand",
      max: 12,
      required: true,
    },
  ],
  timeline(n, options: { end: boolean; bpm?: number }) {
    const { end } = options;
    // At her music's tempo when one is given (slower: a longer, calmer Reel; faster: a shorter one), else the model's.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(6, Math.min(30, n));
    // The title's shot, the verse on the original's cuts (past its ten, moments of two beats), the rapid burst of half
    // beats (when there are shots enough for it), the last shot held (longer under the ending card).
    const middle = count - 2;
    const rapid = Math.max(0, Math.min(RAPID, middle - 5));
    const verse = Array.from({ length: middle - rapid }, (_, i) => VERSE[i] ?? MORE);
    const beats = [TITLE, ...verse, ...Array.from({ length: rapid }, () => HALF), LAST];
    const spans = beatSpans(bpm, beats);
    const lastAt = spans.at(-1)!.start;
    const duration = round(end ? onFrame(spans.at(-1)!.end + END_CARD) : spans.at(-1)!.end);
    spans[spans.length - 1] = { start: lastAt, end: duration };
    const cut = spans[1]!.start;
    const wants = [
      "une vidéo large et fixe de son lieu où elle marche ou passe devant (elle, l'équipe, un client), le haut de l'image dégagé : son titre géant s'y pose derrière elle",
      ...verse.map((b) =>
        b < 1
          ? "un plan très court : un détail, un geste, un produit"
          : b > 1
            ? "un plan de son lieu ou de son quartier avec du mouvement : quelqu'un qui passe, un geste, la caméra qui avance"
            : "un plan de sa journée : son travail, ses produits, ses clients",
      ),
      ...Array.from({ length: rapid }, () => "un plan très court et vif, en rafale : un détail, un geste, un produit"),
      "le plan qui finit le Reel, tenu jusqu'à la fin : un plan large et calme de son lieu, idéalement en fin de journée",
    ];
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // The title lands half a beat in, its small words with it; both go with the cut.
      texts: {
        surtitre: { from: round(onFrame(LAND * beat + 2 / 30)), to: round(cut) },
        titre: { from: round(onFrame(LAND * beat)), to: round(cut) },
      },
      marks: { beat: beat * 30, wave: toFrame(WAVE * beat) },
    };
  },
  code: CODE,
  // Its small words are always handwritten, the model's script, whatever her charter's fonts.
  fonts: ["Caveat"],
};
