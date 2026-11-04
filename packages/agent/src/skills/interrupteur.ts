import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Interrupteur », written on its original (house/originals/interrupteur.mp4, 9,2 s, one fixed shot, looked at image
// by image): a pale wall over a bench, a big phone switch drawn high on it at the middle (off: a grey track, 0,29 of the
// width, its white knob a little wider than tall on the left), alone for a second; a woman walks in from the right,
// raises her hand to the wall under it, cannot reach, crouches and jumps: on the image her fingers touch it (4,1 s) the
// switch is on (its dark green track, its knob on the right) and the poster is on the wall under it at once, a mascot,
// the name in a red script, a line and a date, 0,4 of the frame high, she in front of it; she lands and walks off to the
// left, and the wall holds the poster to the end (5 s). Here the switch is where her hand really goes and flips when it
// gets there, read on her shot (her hands as tracked, else her outline's highest point when her arm rises above her
// head), else on the eighth beat; the room brightens a little and her logo lights up on the wall (her name in big
// letters when she has none), she in front of it. Its ending card (an offer, an announcement) is written on the wall
// under the logo, as the poster's lines.

const BPM = 120;
/** Her hand reaches the switch on this beat when nothing read on her shot says when it does (the original: 4 s). */
const TOUCH = 8;
/** The wall lit after it, held (she walks off and the logo stays: the original's 5 s). */
const LIT = 10;
/** The engine's ending card: the Reel's last 1,6 s. */
const CARD_SECONDS = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const comma = (n: number) => String(round(n)).replace(".", ",");

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const BEAT = Math.max(4, mark("beat", 15));
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const until = Math.min(durationInFrames, endAt);
  // The switch flips on its beat when nothing says when her hand gets there; the wall stays lit two seconds at least.
  const TOUCH = Math.max(12, Math.min(mark("touch", Math.round(8 * BEAT)), until - 60));
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const laid = { left: 0, top: 0, width, height };
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number, nor a line before a « · ».
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0").replace(/ (\d+(?:er|e))\b/g, "\u00a0$1").replace(/ ([·•|–—]) /g, "\u00a0$1 ");

  // Her colour on the wall: the first of hers dark enough to read on a pale wall, else the model's dark green.
  const luma = (c) => {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return 1;
    const x = m[1].length === 3 ? m[1].split("").map((k) => k + k).join("") : m[1];
    const v = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255);
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const GREEN = "#234134";
  const OFF = "#605e5a";
  const INK = [brand.accent, brand.palette && brand.palette.dark].find((c) => luma(c) <= 0.42) || GREEN;
  const SWITCH_ON = luma(brand.accent) <= 0.45 ? brand.accent : GREEN;
  // A light edge, so her dark words still read if the wall is darker than asked.
  const HALO = "0 0 2px rgba(255,255,255,0.45), 0 1px 4px rgba(255,255,255,0.3)";

  // 1. When her hand reaches highest on the wall, and where: her hands and arms as tracked in her shot (above her
  // shoulders, or well above where they rest), else the highest point of her outline when it rises well above where she
  // stands (an arm up over her head); the moment it gets there, within the Reel (never in its first second, nor so late
  // the wall cannot stay lit). Nothing read: the switch waits at its place and flips on the beat.
  const reach = React.useMemo(() => {
    if (!n) return null;
    const from = 36;
    const to = until - 72;
    if (to <= from) return null;
    const box = { shot: 0, left: 0, top: 0, width, height };
    const middle = (list) => {
      const ys = list.map((t) => t.y).sort((a, b) => a - b);
      return ys.length ? ys[Math.floor(ys.length / 2)] : 0;
    };
    const choose = (list, risen) => {
      const inside = list.filter((t) => t.f >= from && t.f <= to && risen(t));
      if (!inside.length) return null;
      const peak = inside.reduce((a, b) => (b.y < a.y ? b : a));
      const first = inside.find((t) => t.y <= peak.y + 24) || peak;
      return { at: first.f, x: first.x, y: first.y };
    };
    const hands = [];
    if (typeof track === "function") {
      for (let f = 0; f < until; f += 2) {
        const seen = track(f, box) || {};
        let best = null;
        let shoulder = null;
        (seen.hands || []).forEach((hand) => {
          const p = hand.points || {};
          ["index_tip", "middle_tip", "ring_tip", "pinky_tip", "thumb_tip", "wrist"].forEach((k) => {
            const q = p[k];
            if (q && Number.isFinite(q.y) && (!best || q.y < best.y)) best = { x: q.x, y: q.y };
          });
        });
        (seen.bodies || []).forEach((b) => {
          const p = b.points || {};
          ["left_index", "right_index", "left_pinky", "right_pinky", "left_thumb", "right_thumb", "left_wrist", "right_wrist"].forEach((k) => {
            const q = p[k];
            if (q && q.visible && Number.isFinite(q.y) && (!best || q.y < best.y)) best = { x: q.x, y: q.y };
          });
          ["left_shoulder", "right_shoulder"].forEach((k) => {
            const q = p[k];
            if (q && q.visible) shoulder = shoulder === null ? q.y : Math.min(shoulder, q.y);
          });
        });
        if (best) hands.push({ f, x: best.x, y: best.y, shoulder });
      }
    }
    const rest = middle(hands);
    const byHand = choose(hands, (t) => (t.shoulder !== null && t.y < t.shoulder - 30) || t.y < rest - height * 0.08);
    if (byHand) return byHand;
    const tops = [];
    for (let f = 0; f < until; f += 2) {
      const d = SubjectOutline(shots[0], f, laid);
      const nums = d ? String(d).match(/-?\d+(?:\.\d+)?/g) : null;
      if (!nums || nums.length < 6) continue;
      let best = null;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = Number(nums[i]);
        const y = Number(nums[i + 1]);
        if (!best || y < best.y) best = { x, y };
      }
      if (best) tops.push({ f, x: best.x, y: best.y });
    }
    const stands = middle(tops);
    return choose(tops, (t) => t.y < stands - Math.max(90, height * 0.05));
  }, [track, n, until, width, height]);

  // 2. The switch: a phone's switch drawn on her wall (the model's proportions), its knob under her fingertip when we
  // know where it goes; it flips when her hand gets there, the knob sliding to the right on her colour.
  const ON = reach ? reach.at : TOUCH;
  const SW = Math.round(width * 0.285);
  const SH = Math.round(SW * 0.46);
  const sx = Math.round(reach ? within(reach.x + SW / 2 - SH / 2, SW / 2 + 40, width - SW / 2 - 40) : width / 2);
  const sy = Math.round(reach ? within(reach.y + SH * 0.1, 150 + SH / 2, height * 0.45) : height * 0.204);
  const lit = ease(interpolate(frame, [ON, ON + 4], [0, 1], clamp));
  const pad = Math.round(SH * 0.09);
  const kh = SH - 2 * pad;
  const kw = Math.round(kh * 1.28 * (frame >= ON && frame < ON + 4 ? 1.12 : 1));
  const press = frame >= ON && frame < ON + 6 ? 1 - 0.05 * Math.sin(((frame - ON) / 6) * Math.PI) : 1;
  const toggle = h("div", { key: "switch", style: { position: "absolute", left: sx - SW / 2, top: sy - SH / 2, width: SW, height: SH, borderRadius: SH / 2, backgroundColor: interpolateColors(lit, [0, 1], [OFF, SWITCH_ON]), transform: "scale(" + press.toFixed(4) + ")" } },
    h("div", { style: { position: "absolute", top: pad, left: Math.round(pad + (SW - 2 * pad - kw) * lit), width: kw, height: kh, borderRadius: kh / 2, backgroundColor: "#ffffff" } }));

  // 3. What lights up: her logo, else her name in big letters, under the switch (above it when her hand reaches low),
  // with her line under it as the poster's; the ending card's words take the line's place.
  const hook = reelTexts.find((t) => t.role === "hook");
  const caption = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== caption);
  const plain = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const named = plain(brand.name);
  // Her name, as her logo already says it: never written twice under it.
  const isName = (s) => {
    const w = plain(s).split(" ").filter(Boolean);
    return w.length > 0 && named.length > 0 && w.every((x) => (" " + named + " ").indexOf(" " + x + " ") >= 0);
  };
  const logo = Boolean(brand.logoUrl);
  // Her name as a sign, on two lines when it is long (the engine keeps it whole with fixed spaces: a sign breaks it).
  const signText = String(logo ? "" : hook ? hook.text : brand.name || "").replace(/[\u00a0\u202f]+/g, " ");
  const lines = [logo && hook && !isName(hook.text) ? hook : null, caption].filter(Boolean);
  const LINE = 92;
  const TITLE = 150;
  const SUB = 128;
  const need = Math.max(lines.length * LINE, end ? TITLE + (end.subtitle ? SUB : 0) : 0);
  const gap = need ? 24 : 0;
  const under = { a: sy + SH / 2 + 56, b: Math.round(height * 0.72) };
  const over = { a: 140, b: sy - SH / 2 - 56 };
  const room = (r) => r.b - r.a - need - gap;
  const region = room(under) >= 300 || room(under) >= room(over) ? under : over;
  const signH = Math.round(Math.max(160, Math.min(780, room(region))));
  const signY = Math.round(region.a + Math.max(0, (room(region) - signH) / 2));
  const linesY = signY + signH + gap;
  const pop = (a) => ({ display: "inline-block", opacity: interpolate(frame, [a, a + 3], [0, 1], clamp), transform: "scale(" + (0.94 + 0.06 * ease(interpolate(frame, [a, a + 6], [0, 1], clamp))).toFixed(4) + ")" });
  const sign = frame >= ON
    ? logo
      ? h("div", { key: "logo", style: { position: "absolute", left: 100, top: signY, width: width - 200, height: signH, ...pop(ON) } },
          h(Img, { src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { width: "100%", height: "100%", objectFit: "contain", ...(brand.logoOnDark ? {} : { filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))" }) } }))
      : h(FitText, { key: "name", style: { position: "absolute", left: 140, top: signY, width: width - 280, height: signH }, innerStyle: { fontFamily: display, fontWeight: 800, fontSize: Math.min(230, Math.round(signH * 0.6)), lineHeight: 0.98, letterSpacing: "-0.025em", color: INK, textWrap: "balance", textShadow: HALO } },
          h("span", { style: pop(ON) }, keep(signText)))
    : null;
  // Her line in the poster's capitals, between two fine rules when it is short, her other words (the name under a
  // logo) above it.
  const rule = (k) => h("span", { key: k, "data-fauve-decor": "", style: { display: "inline-block", width: 40, height: 4, borderRadius: 2, backgroundColor: INK, verticalAlign: "middle", margin: "0 18px" } });
  const lineBox = (key, y, tall, text, style, at, ruled) => h(FitText, { key, style: { position: "absolute", left: 140, top: y, width: width - 280, height: tall }, innerStyle: { fontFamily: body, color: INK, textAlign: "center", textShadow: HALO, ...style } },
    h("span", { style: pop(at) }, ruled ? rule("a") : null, keep(text), ruled ? rule("b") : null));
  const posterLines = frame >= ON && frame < endAt
    ? lines.map((t, i) => (t === caption
        ? lineBox("l" + i, linesY + i * LINE, LINE - 8, String(t.text).toUpperCase(), { fontWeight: 700, fontSize: 48, letterSpacing: "0.05em", lineHeight: 1.1, whiteSpace: "nowrap" }, ON + 2 + i * 2, Array.from(String(t.text)).length <= 14)
        : lineBox("l" + i, linesY + i * LINE, LINE - 8, t.text, { fontFamily: display, fontWeight: 800, fontSize: 64, letterSpacing: "-0.02em", lineHeight: 1.05, whiteSpace: "nowrap" }, ON + 2, false)))
    : null;
  const ending = end && frame >= endAt
    ? [
        lineBox("et", linesY, TITLE, end.title, { fontFamily: display, fontWeight: 800, fontSize: 64, letterSpacing: "-0.02em", lineHeight: 1.04, textWrap: "balance" }, endAt + 2, false),
        end.subtitle ? lineBox("es", linesY + TITLE, SUB, end.subtitle, { fontWeight: 600, fontSize: 48, lineHeight: 1.1, textWrap: "balance" }, endAt + 6, false) : null,
      ]
    : null;

  // 4. Her shot full frame, as filmed; she passes in front of what is drawn on her wall (her cut-out over it); the room
  // a little darker until the switch is on.
  const wall = n ? h(Footage, { key: "wall", shot: 0, style: full }) : null;
  const her = n ? h(Subject, { key: "her", shot: 0, style: full }) : null;
  const dim = lit < 1 ? h("div", { key: "dim", style: { ...full, backgroundColor: "rgba(0,0,0," + (0.14 * (1 - lit)).toFixed(3) + ")" } }) : null;

  // Any other text of the Reel (none in its slots): a plain line away from the poster, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: (region === under ? 150 : 1250) + i * 110, width: width - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 52, color: INK, textAlign: "center", textShadow: HALO } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#d8d4cf" } }, wall, toggle, sign, posterLines, ending, her, dim, extra);
}`;

export const interrupteur: MontageSkill = {
  key: "interrupteur",
  version: 1,
  bpm: BPM,
  shots: [1, 1],
  files: [1, 2],
  // A single shot: its length follows the tempo, within what keeps her gesture around its fourth second.
  tempo: [100, 140],
  how: "Un seul plan fixe devant son mur clair : un grand interrupteur de téléphone dessiné sur le mur, éteint ; elle lève la main et le touche, il passe à sa couleur en glissant, la pièce s'éclaire un peu et son logo (son nom en grand quand elle n'en a pas) s'allume aussitôt sur le mur, sous l'interrupteur, elle devant ; elle s'éloigne, le logo reste jusqu'à la fin, comme une affiche.",
  end: true,
  texts: [
    {
      slot: "nom",
      role: "hook",
      want: "ce qui s'allume en grand sur le mur quand elle touche l'interrupteur, comme une enseigne : son nom, ou le mot de son nom qui la distingue (« Farine » pour « Maison Farine ») ; quand elle a un logo, c'est son logo qui s'allume",
      max: 18,
      required: true,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : une petite ligne en capitales sous son nom ou son logo, comme sur une affiche : ce qu'elle annonce ou un repère qu'on sait (une forme comme « ouvert dès 8 h », « nouvelle carte », « Lyon 2e »)",
      max: 24,
      required: false,
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every length in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    // One shot: her gesture, the lit wall held, and with an ending card its time after it (the engine's 1,6 s at
    // least, on the half-beat grid, rounded up so a frame lost to rounding never cuts into it).
    const card = end ? Math.ceil(((CARD_SECONDS + 0.05) / beat) * 2) / 2 : 0;
    const spans = beatSpans(bpm, [TOUCH + LIT + card]);
    const duration = spans[0]!.end;
    const touch = round(TOUCH * beat);
    const lit = round(end ? duration - CARD_SECONDS : duration);
    return {
      duration,
      shots: spans.map((s) => ({
        ...s,
        want: `sa vidéo filmée fixe devant un mur clair, d'au moins ${comma(duration)} s : elle entre ou elle est là, lève la main et touche le mur, puis s'éloigne ; le passage commence environ ${comma(touch)} s avant que sa main touche le mur (un interrupteur dessiné y bascule à cet instant et son logo s'allume en dessous)`,
      })),
      // Her words light up with the switch and stay on the wall (up to the ending card).
      texts: { nom: { from: touch, to: lit }, ligne: { from: touch, to: lit } },
      marks: { beat: beat * 30, touch: toFrame(touch) },
    };
  },
  code: CODE,
};
