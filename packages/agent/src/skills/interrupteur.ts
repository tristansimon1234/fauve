import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Interrupteur », version 2, written again on its original's fiche (docs/fiches/interrupteur.md: measured image by
// image at 30 i/s, its switch, her hand and its poster in close-ups, its sound's level, spectrum and attacks; Tristan:
// « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). One fixed shot, the phone posed,
// no cut: a pale wall over a bench, a big phone switch drawn flat high on it (off: a grey track 0,29 of the width, its
// white knob a capsule on the left), out of her reach. Its music is two pieces and a silence on one grid, 143,7 BPM (a
// beat every 0,4175 s, the first at 0,24 s; counted one beat in two for the engine, 71,85): every landmark below is in
// beats of that grid from its first beat:
//   −0,6 – 4,9   the wall, then she walks in and raises her hand, short of the switch; its first piece (a choppy melodic
//                beat) stops dead just before beat 5 (2,29 s);
//   4,9 – 10     silence: her hand flat on the wall, too low, a short high beep on beat 6¾ (3,06 s); she crouches and
//                jumps; on beat 9¼ (4,10 s), at the top of her jump, the switch flips in one image (its knob on the right,
//                its track green) and the poster is on the wall under it at once, she in front of both;
//   10 – 21      she lands and the second piece comes in at once (a hip-hop beat with a big 808 bass); she walks off and
//                the wall holds the poster to the end of the sound (9,0 s), nothing else lit, the light unchanged.
// Here the switch is drawn where her hand goes highest and flips when it gets there, read on her shot (her hands as
// tracked, else the top of her cut-out's outline when her arm rises over her head), else at the original's place and on
// beat 9¼; her poster lights at once under it in her two colours: her logo, her name or what she launches in big
// letters (the original's « Good News » is its own event's: never copied), her line in spaced capitals between two
// rules, a small detail (a date, an hour), a four-pointed sparkle; she passes in front (her cut-out, only from just
// before the flip). One composed music shaped as the original's: without its bass until it stops dead, silent with its
// beep, back on beat 10 with its bass, cut on beat 21 (a second piece cannot be composed: the bass coming in stands for
// it). Its ending card (in option) takes the place of her name and her line on the poster. Vertical full frame as the
// original when her video is upright; a horizontal one cropped to a window fixed on her reach when her whole gesture
// fits in it, else whole on black in a 16:9 band (Tristan: « format par défaut [comme ses vidéos], et changement à la
// demande du user »).

const BPM = 71.85;
/** Its landmarks, in beats of the original's own grid (twice the engine's), from the Reel's start: its first beat (0,24 s). */
const FIRST = 0.575;
/** The music stops dead just before beat 5 (2,29 s), and comes back on beat 10 as she lands (4,41 s). */
const STOP = FIRST + 4.91;
const BACK = FIRST + 10;
/** The beep in the silence, on beat 6¾ (3,06 s). */
const BEEP = FIRST + 6.75;
/** The switch flips on beat 9¼ when nothing read on her shot says when her hand gets there (4,10 s, its image 123). */
const FLIP = FIRST + 9.25;
/** Its sound ends on beat 21 (9,01 s); the Reel two images later (9,10 s; its last two images, a rest of its edit, left out). */
const SOUND_END = FIRST + 21;
const LENGTH = FIRST + 21.22;
/** Where her hand is looked for on her shot, around the flip (images of 30 a second). */
const LOOK = 75;
/** The engine's ending card: the Reel's last 1,6 s. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const comma = (n: number) => String(round(n)).replace(".", ",");

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const until = Math.min(durationInFrames, endAt);
  const FLIP = Math.max(1, Math.round(mark("flip", 123)));
  const FROM = Math.max(15, Math.round(mark("look_from", FLIP - 75)));
  const TO = Math.max(FROM + 1, Math.min(until - 45, Math.round(mark("look_to", FLIP + 75))));
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ").replace(/ (\d+(?:er|e))\b/g, " $1");

  // 1. Where her hand goes highest on her wall, and when: her hands and arms as tracked in her shot (above her shoulders,
  // or well above where they rest), else the top of her cut-out's outline when it rises well above where she stands (an
  // arm up over her head); the first image within a hair of the top, around the flip. And how wide her gesture goes.
  const reachIn = (box) => {
    if (!n) return null;
    const middle = (list) => { const ys = list.map((t) => t.y).sort((a, b) => a - b); return ys.length ? ys[Math.floor(ys.length / 2)] : 0; };
    const choose = (list, risen) => {
      const up = list.filter(risen);
      if (!up.length) return null;
      const peak = up.reduce((a, b) => (b.y < a.y ? b : a));
      const first = up.find((t) => t.f <= peak.f && t.y <= peak.y + box.height * 0.01) || peak;
      const xs = list.flatMap((t) => t.xs);
      return { at: first.f, x: peak.x, y: peak.y, lo: Math.min.apply(null, xs), hi: Math.max.apply(null, xs) };
    };
    const hands = [];
    if (typeof track === "function") {
      for (let f = FROM; f <= TO; f++) {
        const seen = track(f, { shot: 0, ...box }) || {};
        let best = null;
        let shoulder = null;
        const xs = [];
        const take = (q) => { if (q && Number.isFinite(q.x) && Number.isFinite(q.y)) { xs.push(q.x); if (!best || q.y < best.y) best = { x: q.x, y: q.y }; } };
        (seen.hands || []).forEach((hand) => { const p = hand.points || {}; ["index_tip", "middle_tip", "ring_tip", "pinky_tip", "thumb_tip", "wrist"].forEach((k) => take(p[k])); });
        (seen.bodies || []).forEach((b) => {
          const p = b.points || {};
          ["left_index", "right_index", "left_pinky", "right_pinky", "left_thumb", "right_thumb", "left_wrist", "right_wrist"].forEach((k) => { if (p[k] && p[k].visible) take(p[k]); });
          ["left_shoulder", "right_shoulder", "left_hip", "right_hip"].forEach((k) => { const q = p[k]; if (q && q.visible) xs.push(q.x); });
          ["left_shoulder", "right_shoulder"].forEach((k) => { const q = p[k]; if (q && q.visible) shoulder = shoulder === null ? q.y : Math.min(shoulder, q.y); });
        });
        if (best) hands.push({ f, x: best.x, y: best.y, shoulder, xs });
      }
    }
    const rest = middle(hands);
    const byHand = choose(hands, (t) => (t.shoulder !== null && t.y < t.shoulder - box.height * 0.015) || t.y < rest - box.height * 0.08);
    if (byHand) return byHand;
    const tops = [];
    for (let f = FROM; f <= TO; f += 2) {
      const d = SubjectOutline(shots[0], f, box);
      const nums = d ? String(d).match(/-?\d+(?:\.\d+)?/g) : null;
      if (!nums || nums.length < 6) continue;
      let best = null;
      const xs = [];
      for (let i = 0; i + 1 < nums.length; i += 2) { const x = Number(nums[i]); const y = Number(nums[i + 1]); xs.push(x); if (!best || y < best.y) best = { x, y }; }
      if (best) tops.push({ f, x: best.x, y: best.y, xs });
    }
    const stands = middle(tops);
    return choose(tops, (t) => t.y < stands - Math.max(90, box.height * 0.05));
  };

  // 2. Its frame: her upright video full frame; a horizontal one cropped to a vertical window fixed on her reach (it
  // never follows her) when her whole gesture fits in it, else whole on black in a 16:9 band; or as her words ask.
  const aspect = n ? Number(shots[0].aspect) || 0.5625 : 0.5625;
  const wideVideo = aspect > 1.15;
  const format = setting("format", "auto");
  const FULL = { left: 0, top: 0, width, height };
  const BAND = { left: 0, top: Math.round((height - (width * 9) / 16) / 2), width, height: Math.round((width * 9) / 16) };
  const layout = React.useMemo(() => {
    if (format === "horizontal") return { box: BAND, band: true, reach: reachIn(BAND) };
    if (!wideVideo) return { box: FULL, band: false, reach: reachIn(FULL) };
    const wideBox = { left: 0, top: 0, width: Math.round(height * aspect), height };
    const seen = reachIn(wideBox);
    const fits = seen && seen.hi - seen.lo <= width - 120;
    if (seen && (format === "vertical" || fits)) {
      const left = Math.round(within(width / 2 - seen.x, width - wideBox.width, 0));
      return { box: { ...wideBox, left }, band: false, reach: { ...seen, x: seen.x + left, lo: seen.lo + left, hi: seen.hi + left } };
    }
    if (format === "vertical") return { box: FULL, band: false, reach: reachIn(FULL) };
    return { box: BAND, band: true, reach: reachIn(BAND) };
  }, [track, n, format, aspect, until]);
  const box = layout.box;
  const reach = layout.reach;
  // What the original's sizes are measured against: its frame's height (the band's, at the band's scale).
  const U = box.height;
  const FW = layout.band ? box.width : width;

  // Her colours: the first of hers dark enough to read on a pale wall for the switch, its rules and its small lines
  // (the original's green role), her second one for her name and its sparkle (its red role); a phone's green and an ink
  // when she has none.
  const luma = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return -1;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  const hers = [brand.accent, brand.palette && brand.palette.secondary, brand.palette && brand.palette.dark].filter((c, i, all) => luma(c) >= 0 && luma(c) <= 0.55 && all.indexOf(c) === i);
  const ON_COLOR = hers[0] || "#34c759";
  const INK = hers[0] || "#1f1f1d";
  const NAME = hers[1] || hers[0] || "#1f1f1d";
  const OFF = "#605e5a";

  // 3. The switch: a phone's, flat (no shadow, no outline), the original's proportions (its track 0,29 of the frame's
  // width, as tall as 0,46 of it; its knob a capsule 1,28 times as wide as tall, 10,5 % of the track from its edges),
  // there from the first image, never pulsing; set where her hand goes highest, her fingertip right of its middle at
  // its mid-height, else where the original sets it (49,9 % across, 20,5 % down). It flips in one image when her hand
  // gets there: the knob on the right, the track in her colour; nothing else changes.
  const SW = Math.round(layout.band ? U * 0.162 : FW * 0.2875);
  const SH = Math.round(SW * 0.46);
  const sx = Math.round(reach ? within(reach.x - SW * 0.03, box.left + SW / 2 + 20, box.left + box.width - SW / 2 - 20) : box.left + box.width * 0.499);
  const sy = Math.round(reach ? within(reach.y, Math.max(box.top, 0) + SH / 2 + 30, box.top + box.height * 0.6) : box.top + box.height * 0.205);
  const ON = reach ? reach.at : FLIP;
  const lit = frame >= ON;
  const pad = Math.round(SH * 0.105);
  const kh = SH - 2 * pad;
  const kw = Math.round(kh * 1.28);
  const toggle = h("div", { key: "switch", style: { position: "absolute", left: sx - SW / 2, top: sy - SH / 2, width: SW, height: SH, borderRadius: SH / 2, backgroundColor: lit ? ON_COLOR : OFF } },
    h("div", { style: { position: "absolute", top: pad, left: lit ? SW - pad - kw : pad, width: kw, height: kh, borderRadius: kh / 2, backgroundColor: "#ffffff" } }));

  // 4. Her poster, there at once with the switch (no fade, no growth, no halo), flat on the wall: 87 % of the frame's
  // width and 40 % of its height in the original, 4,3 % under the switch (above it when her hand reaches low), centred.
  // From the top: her logo; her name or what she launches in big letters of her title font (alone, bigger, without a
  // logo; never her name twice under a logo that says it), underlined by hand; her line in spaced capitals between two
  // rules; a small detail; a four-pointed sparkle. Her line and her detail are small labels beside the name that reads.
  const hook = reelTexts.find((t) => t.role === "hook");
  const captions = reelTexts.filter((t) => t.role === "caption");
  const line = captions[0];
  const detail = captions[1];
  const others = reelTexts.filter((t) => t !== hook && captions.indexOf(t) < 0);
  const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const named = plain(brand.name);
  const isName = (s) => { const w = plain(s).split(" ").filter(Boolean); return w.length > 0 && named.length > 0 && w.every((x) => (" " + named + " ").indexOf(" " + x + " ") >= 0); };
  const logo = Boolean(brand.logoUrl);
  const title = end && frame >= endAt ? { text: end.title } : hook && (!logo || !isName(hook.text)) ? hook : null;
  const PW = Math.round(layout.band ? Math.min(box.width * 0.62, U * 1.1) : FW * 0.87);
  const PH0 = Math.round(layout.band ? U * 0.5 : U * 0.403);
  const gap = Math.round(U * 0.043);
  const under = { a: sy + SH / 2 + gap, b: box.top + box.height * (layout.band ? 0.97 : 0.74) };
  const over = { a: box.top + box.height * (layout.band ? 0.03 : 0.06), b: sy - SH / 2 - gap };
  const region = under.b - under.a >= PH0 * 0.75 || under.b - under.a >= over.b - over.a ? under : over;
  const PH = Math.round(Math.max(U * 0.2, Math.min(PH0, region.b - region.a)));
  const PY = Math.round(region === under ? region.a : region.b - PH);
  const PX = Math.round(within(box.left + box.width * 0.512 - PW / 2, 40, width - 40 - PW));
  const words = (s) => String(s || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  // A text's box, centred on the poster, kept left of the apps' buttons below the middle of the frame.
  const CX = PX + PW / 2;
  const at = (top, tall) => {
    const y = Math.round(PY + PH * top);
    const tallPx = Math.max(1, Math.round(PH * tall));
    const limit = y + tallPx > height / 2 ? width - 152 : width - 52;
    const half = Math.max(40, Math.min(PW / 2, limit - CX, CX - 52));
    return { position: "absolute", left: Math.round(CX - half), top: y, width: Math.round(2 * half), height: tallPx };
  };
  const rule = (k) => h("span", { key: k, style: { display: "inline-block", width: "1.6em", height: "0.12em", backgroundColor: INK, verticalAlign: "middle", margin: "0 0.6em" } });
  const small = (t, top, tall, size, spaced) => {
    const fit = words(t.text) > 4 ? Math.max(size, 48) : size;
    return h(FitText, { style: at(top, Math.max(tall, (fit * 1.25) / PH)), innerStyle: { fontFamily: body, fontWeight: 700, fontSize: fit, lineHeight: 1.1, letterSpacing: spaced ? "0.18em" : "0.08em", textTransform: "uppercase", color: INK, whiteSpace: "nowrap", textAlign: "center" } },
      h("span", { "data-fauve-accent": "" }, spaced ? rule("a") : null, keep(t.text), spaced ? rule("b") : null));
  };
  const sparkle = (cx0, cy0, r) => h("svg", { key: "spark", width: 2 * r, height: 2 * r, viewBox: "-1 -1 2 2", style: { position: "absolute", left: Math.round(cx0 - r), top: Math.round(cy0 - r) } },
    h("path", { d: "M0 -1 C0.1 -0.25 0.25 -0.1 1 0 C0.25 0.1 0.1 0.25 0 1 C-0.1 0.25 -0.25 0.1 -1 0 C-0.25 -0.1 -0.1 -0.25 0 -1 Z", fill: NAME }));
  const LINE = Math.round(U * (layout.band ? 0.04 : 0.0224));
  const DETAIL = Math.round(U * (layout.band ? 0.036 : 0.0135));
  const card = end && frame >= endAt;
  const nameTop = logo ? 0.49 : 0.02;
  const nameTall = (logo ? 0.31 : 0.74) + (title && !line && !(card && end.subtitle) ? 0.07 : 0);
  const nameBox = at(nameTop, nameTall);
  const poster = lit
    ? h("div", { key: "poster" },
        logo ? h("div", { style: { ...at(0, title ? 0.5 : 0.78), left: Math.round(PX + PW * 0.2), width: Math.round(PW * 0.6) } },
          h(Img, { src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { width: "100%", height: "100%", objectFit: "contain" } })) : null,
        title ? h(FitText, { key: "title", style: nameBox, innerStyle: { fontFamily: display, fontWeight: 700, fontSize: Math.round(PH * nameTall * 0.62), lineHeight: 1, letterSpacing: "-0.02em", color: NAME, textAlign: "center", textWrap: "balance" } }, keep(title.text)) : null,
        title ? h(Scribble, { key: "under", kind: "underline", box: { x: nameBox.left + nameBox.width * 0.02, y: nameBox.top, w: nameBox.width * 0.96, h: nameBox.height * 0.9 }, at: ON - 1, frames: 1, color: NAME, width: Math.max(3, Math.round(PH * 0.011)), wobble: 0.5, seed: "switch-under" }) : null,
        card ? (end.subtitle ? small({ text: end.subtitle }, 0.8, 0.07, LINE, true) : null) : line ? small(line, 0.8, 0.07, LINE, true) : null,
        !card && detail ? small(detail, 0.875, 0.045, DETAIL, false) : null,
        sparkle(PX + PW / 2, PY + PH * 0.96, Math.max(8, Math.round(PH * 0.04))))
    : null;

  // 5. Her shot as filmed, the light never changing; she passes in front of what is drawn on her wall (her cut-out over
  // it, only from just before the flip: the switch is out of her reach until then). Once she has left (nobody seen for
  // six images after the flip), her wall is held on that image to the end, as the original ends on its wall alone:
  // nothing of hers comes back into the picture (Tristan, on its first bench: « une main qui traîne à la fin »).
  const GONE = (() => {
    if (!n) return null;
    const seenAt = (f) => {
      if (typeof track === "function") {
        const seen = track(f, { shot: 0, ...box }) || {};
        if ((seen.bodies || []).length || (seen.hands || []).length || (seen.faces || []).length) return true;
        if (seen.bodies || seen.hands || seen.faces) return false;
      }
      const b = typeof SubjectBox === "function" ? SubjectBox(shots[0], f, box) : null;
      return Boolean(b && b.w * b.h > box.width * box.height * 0.01);
    };
    let run = 0;
    for (let f = ON + 6; f < until; f++) {
      if (seenAt(f)) run = 0;
      else if (++run >= 6) return f - 5;
    }
    return null;
  })();
  const held = GONE !== null && frame >= GONE ? { at: frame - (GONE - shots[0].from) } : {};
  const wall = n ? h(Footage, { key: "wall", shot: 0, style: box, ...held }) : null;
  const her = n && frame >= ON - 20 ? h(Subject, { key: "her", shot: 0, style: box, ...held }) : null;

  // Any other text of the Reel (none in its slots): a plain line away from the poster, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: (region === under ? 120 : 1260) + i * 110, width: width - 280, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 52, color: INK, textAlign: "center" } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: layout.band ? "#000000" : "#d8d4cf" } }, wall, toggle, poster, her, extra);
}`;

export const interrupteur: MontageSkill = {
  key: "interrupteur",
  // 2: written again on its original's fiche (its music stopped and back, its beep, its flip in one image, its poster, her in front, its format).
  // 3: once she has left, her wall held on that image to the end (a hand had come back into the picture at its bench).
  version: 3,
  bpm: BPM,
  shots: [1, 1],
  files: [1, 2],
  // A single gesture: its length follows the tempo a little (8,2 s at 80 BPM, 10,2 s at 64), her jump on its beat.
  tempo: [64, 80],
  // The filler sets her passage so the top of her reach falls on the flip: her hands measured on her files.
  reads: ["gestures"],
  how: "Un seul plan fixe devant son mur clair : un grand interrupteur de téléphone dessiné à plat sur le mur, éteint, là où sa main montera le plus haut ; elle lève la main sans l'atteindre, la musique s'arrête net, un bip dans le silence, elle saute (ou tend le bras) et le touche au plus haut : il bascule d'un coup sur sa couleur et son affiche est là d'un coup sur le mur sous lui (son logo, son nom ou ce qu'elle lance en grand, sa ligne en capitales entre deux traits, un petit détail), elle devant ; la musique repart avec sa basse quand elle retombe, elle s'en va et le mur garde l'affiche jusqu'à la fin. En vertical plein écran ; sa vidéo horizontale recadrée sur son geste, ou entière dans une bande 16:9 sur du noir.",
  end: true,
  texts: [
    {
      slot: "nom",
      role: "hook",
      want: "le titre de son affiche, qui s'allume en grand sur le mur sous l'interrupteur : son nom, ou le mot de son nom qui la distingue (« Farine » pour « Maison Farine »), ou le nom de ce qu'elle lance (« Soirée vinyles », « Nouvelle carte ») ; sous son logo quand elle en a un, jamais son nom deux fois",
      max: 18,
      required: true,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : ce qu'elle annonce, en petites capitales espacées entre deux traits sous le titre, comme sur une affiche (une forme comme « la semaine des events », « ouverture », « nouvelle collection ») ; 4 mots au plus",
      max: 24,
      required: false,
    },
    {
      slot: "detail",
      role: "caption",
      want: "facultatif : une date, une heure ou une adresse en tout petit sous la ligne (une forme comme « du 8 au 14 février », « dès 18 h », « 12 rue des Martyrs ») ; 4 mots au plus, rien d'inventé",
      max: 24,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran comme l'original, ou sa vidéo horizontale entière dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme sa vidéo (une vidéo horizontale recadrée sur son geste s'il tient dans le cadre, sinon entière sur du noir)" },
        { value: "vertical", says: "vertical plein écran, sa vidéo horizontale recadrée sur son geste" },
        { value: "horizontal", says: "sa vidéo entière dans une bande 16:9 sur du noir, l'interrupteur et l'affiche à l'échelle de la bande" },
      ],
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every landmark counted in beats follows it.
    const bpm = tempo ?? BPM;
    // A beat of the original's own grid: half one of the engine's.
    const half = 30 / bpm;
    // With an ending card, its time after the original's length on the half-beat grid (the engine's 1,6 s at least,
    // rounded up so a frame lost to rounding never cuts into it).
    const card = end ? Math.ceil((END_CARD + 0.05) / half) : 0;
    const spans = beatSpans(bpm, [(LENGTH + card) / 2]);
    const duration = spans[0]!.end;
    const at = (beats: number) => round3(beats * half);
    const flip = at(FLIP);
    const poster = round(end ? duration - END_CARD : duration);
    return {
      duration,
      shots: spans.map((s) => ({
        ...s,
        want: `sa vidéo filmée téléphone posé, en vertical de préférence, devant un mur clair et uni (un mur, une porte, une vitrine vue de dedans, le côté d'un comptoir) avec de la place au-dessus de sa tête, d'au moins ${comma(duration)} s à vitesse réelle : un peu de mur vide, elle entre, lève la main vers un point du mur au-dessus d'elle sans l'atteindre, saute (ou tend le bras) et le touche au plus haut, retombe et s'en va, puis le mur vide ; le passage commence ${comma(flip)} s avant que sa main soit au plus haut (un interrupteur dessiné y bascule à cet instant et son affiche s'allume dessous)`,
      })),
      // Her poster's words light up with the switch and stay on the wall (her name and her line give way to the card).
      texts: { nom: { from: round(flip), to: poster }, ligne: { from: round(flip), to: poster }, detail: { from: round(flip), to: poster } },
      marks: { flip: toFrame(flip), look_from: Math.max(15, toFrame(flip) - LOOK), look_to: toFrame(flip) + LOOK },
      // She is cut out on her one shot (only from just before the flip, in its code).
      cutouts: [0],
      // The short high beep alone in the silence, on its beat, as loud as the music was.
      sounds: [{ at: at(BEEP), sound: "short rising electronic beep", seconds: 0.5, gain: 6 }],
      // Its first beat at 0,24 s; without its bass until it stops dead just before beat 5, silent to beat 10, back with
      // its bass as she lands (the original's second piece, a big 808 bass), cut on beat 21.
      music: {
        downbeat: at(FIRST),
        filters: [{ kind: "thin", from: 0, to: at(STOP) }],
        pauses: [{ from: at(STOP), to: at(BACK) }],
        end: { at: at(SOUND_END + card), fade: 0.012 },
      },
    };
  },
  code: CODE,
};
