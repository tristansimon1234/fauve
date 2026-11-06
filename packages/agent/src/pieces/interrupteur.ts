import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Interrupteur », the effect (docs/fiches/interrupteur.md, effects 1 to 4 and 7; its whole Reel is
// skills/interrupteur.ts, version 9): over ONE still shot of her, phone posed, a big phone switch drawn flat on her plain
// light wall, off, out of her reach; she jumps or reaches up and touches it at the top of her gesture: it flips in one
// image (its knob on the right, its track in her colour), with a click, and her poster is there at once on the wall
// under it, she in front of both; once she has left the frame, her wall is held on that image to the end. Kept from the
// model (v9): the switch's proportions (its track 28,75 % of the width, as tall as 0,46 of it; its knob a white capsule
// 1,28 times as wide as tall, 10,5 % of the track from its edges), flat, no shadow, never pulsing, there from the first
// image, set at the height where her hand goes highest and across as near the middle as her fingertip stays on it
// (Tristan on v7: « le bouton n'est pas au centre »); her hand read as the engine follows it in the box her shot is
// drawn in (`track(frame, box).hands`, else her body's hand points; across, the top of her cut-out's outline when it is
// her hand, as her picture is drawn), the moment the same as the one its click lands on (the image where a hand of hers is
// highest, over three images: handMoment in tracking.ts, the timeline's sound with `hand`), its place only when her
// hand rises above her shoulders (well above where it rests when her body is not seen: a jump with her hands low is
// no reach, where the skill also took a hand risen with her whole body); without anyone followed, the original's place (49,9 % across, 20,5 % down) and its
// fallback moment (`flip`, on a beat near the middle of the effect, as the original's 4,1 s of 9,1). The poster lights
// at once with the switch (no fade, no growth, no halo, the light unchanged), 87 % of the width and 40 % of the height,
// 4,3 % under the switch (above it when her hand reaches low): her logo; her name or what she launches in big letters of
// her title font, underlined by hand (alone and bigger without a logo; never her name twice under a logo that says it);
// her line in spaced capitals between two rules; a small detail; a four-pointed sparkle; in her two colours (the first
// of hers dark enough to read on a pale wall for the switch, its rules and small lines; her second for her name and its
// sparkle; a phone's green and an ink when she has none). She passes in front (her cut-out over them, from just before
// the flip). Once she has left (nothing of her left in her cut-out, under a five-hundredth of what it held at the flip;
// else her track, when it saw her at the flip; eight images in a row), her wall is held on that image to the end of the
// effect: her hands at the picture's edge are her, played on (v6, v8). Left out: the model's music stopped dead, its
// silence and its beep (the montage's music runs under an effect), its format setting (the montage frames her shot),
// its ending card on the poster (the Reel's own ending is the engine's).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const list = shots || [];
  // Its shot: the first one that plays during it (one still shot of her; one more, if any, sees her wall held).
  const mine = list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const k0 = mine.length ? mine[0] : -1;
  const BOX = { left: 0, top: 0, width: W, height: H };
  const FLIP = Math.round(within(mark("flip", Math.round(D * 0.45)), 1, D - 1));
  const FROM = Math.round(within(mark("look_from", 12), 0, D - 2));
  const TO = Math.round(within(mark("look_to", D - 30), FROM + 1, D));
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  // A phone number or a date never breaks between its digits, nor « Paris 3e » before its number.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ").replace(/ (\d+(?:er|e))\b/g, " $1");

  // 1. Where and when her hand goes highest, as the engine finds the moment its click lands on: at each image the
  // highest point of her hands (else of her body's hand points), the median of three images, the highest of them; its
  // place only when her hand rises above her shoulders (or well above where it rests). Read in the box her shot is
  // drawn in, as the skill reads it (her shot as Footage lays it, without the montage's punch).
  const reach = React.useMemo(() => {
    if (typeof track !== "function") return null;
    const BODY = ["left_wrist", "right_wrist", "left_pinky", "right_pinky", "left_index", "right_index", "left_thumb", "right_thumb"];
    const seen = [];
    for (let f = FROM; f < TO; f++) {
      const s = (k0 >= 0 ? track(f, { shot: k0, ...BOX }) : track(f)) || {};
      const pts = [];
      (s.hands || []).forEach((hand) => { const p = (hand && hand.points) || {}; Object.keys(p).forEach((k) => { const q = p[k]; if (q && Number.isFinite(q.y)) pts.push(q); }); });
      if (!pts.length) (s.bodies || []).forEach((b) => { const p = (b && b.points) || {}; BODY.forEach((k) => { const q = p[k]; if (q && q.visible && Number.isFinite(q.y)) pts.push(q); }); });
      if (!pts.length) continue;
      const high = pts.reduce((a, b) => (b.y < a.y ? b : a));
      let shoulder = null;
      (s.bodies || []).forEach((b) => { const p = (b && b.points) || {}; ["left_shoulder", "right_shoulder"].forEach((k) => { const q = p[k]; if (q && q.visible) shoulder = shoulder === null ? q.y : Math.min(shoulder, q.y); }); });
      seen.push({ f, x: high.x, y: high.y, shoulder });
    }
    if (seen.length < 3) return null;
    const smooth = seen.map((s, i) => { const around = seen.slice(Math.max(0, i - 1), i + 2).map((x) => x.y).sort((a, b) => a - b); return around[Math.floor(around.length / 2)]; });
    let best = 0;
    smooth.forEach((y, i) => { if (y < smooth[best] || (y === smooth[best] && seen[i].y < seen[best].y)) best = i; });
    const peak = seen[best];
    const ys = seen.map((s) => s.y).sort((a, b) => a - b);
    const rest = ys[Math.floor(ys.length / 2)];
    // Above her shoulders when they are seen (a jump with her hands low, a gift held, is no reach); else well above
    // where her hand rests (a hand alone in the picture).
    const risen = peak.shoulder !== null ? peak.y < peak.shoulder - H * 0.015 : peak.y < rest - H * 0.08;
    return { at: peak.f, x: peak.x, y: peak.y, risen };
  }, [track, k0, FROM, TO, W, H]);
  const ON = reach ? reach.at : FLIP;
  const lit = frame >= ON;
  // Her fingertip across as her shot is drawn: the top of her cut-out's outline on that image, when it is her hand (an
  // arm up over her head, at the height the tracker saw it). Her tracked points are placed centred, where Footage and
  // her cut-out frame a horizontal video on her face (its tracks are given her face without its framing): the switch
  // sat beside her hand.
  const tip = React.useMemo(() => {
    if (!reach || k0 < 0 || typeof SubjectOutline !== "function") return null;
    const d = SubjectOutline(list[k0], reach.at, BOX);
    const nums = d ? String(d).match(/-?\d+(?:\.\d+)?/g) : null;
    if (!nums || nums.length < 6) return null;
    let best = null;
    for (let i = 0; i + 1 < nums.length; i += 2) { const x = Number(nums[i]); const y = Number(nums[i + 1]); if (!best || y < best.y) best = { x, y }; }
    return best && Math.abs(best.y - reach.y) <= H * 0.04 && Math.abs(best.x - reach.x) <= W * 0.2 ? best : null;
  }, [reach, k0, W, H]);

  // Her colours: the first of hers dark enough to read on a pale wall for the switch, its rules and its small lines
  // (the original's green role), her second one for her name and its sparkle (its red role); a phone's green and an ink
  // when she has none (the poster's own, read on her wall, below).
  const luma = (c) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return -1;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  const hers = [brand.accent, brand.palette && brand.palette.secondary, brand.palette && brand.palette.dark].filter((c, i, all) => luma(c) >= 0 && luma(c) <= 0.55 && all.indexOf(c) === i);
  const ON_COLOR = hers[0] || "#34c759";
  const OFF = "#605e5a";

  // 2. The switch: a phone's, flat, the original's proportions, there from the first image, never pulsing; at the
  // height where her hand goes highest, across as near the middle as her fingertip stays on it; without her hand, where
  // the original sets it. It flips in one image when her hand gets there: the knob on the right, the track in her colour.
  const SW = Math.round(W * 0.2875);
  const SH = Math.round(SW * 0.46);
  const mid = W * 0.499;
  const placed = reach && reach.risen;
  const handX = tip ? tip.x : reach ? reach.x : mid;
  const sx = Math.round(placed ? within(within(mid, handX - SW * 0.42, handX + SW * 0.42), SW / 2 + 20, W - SW / 2 - 20) : mid);
  const sy = Math.round(placed ? within(reach.y, SH / 2 + 90, H * 0.6) : H * 0.205);
  const pad = Math.round(SH * 0.105);
  const kh = SH - 2 * pad;
  const kw = Math.round(kh * 1.28);
  const toggle = h("div", { key: "switch", style: { position: "absolute", left: sx - SW / 2, top: sy - SH / 2, width: SW, height: SH, borderRadius: SH / 2, backgroundColor: lit ? ON_COLOR : OFF } },
    h("div", { style: { position: "absolute", top: pad, left: lit ? SW - pad - kw : pad, width: kw, height: kh, borderRadius: kh / 2, backgroundColor: "#ffffff" } }));

  // 3. Her poster, there at once with the switch, flat on the wall: 87 % of the width and 40 % of the height, 4,3 % under
  // the switch (above it when her hand reaches low), centred under it. From the top: her logo; her name or what she
  // launches in big letters, underlined by hand; her line in spaced capitals between two rules; a small detail; a sparkle.
  const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const named = plain(brand.name);
  const isName = (s) => { const w = plain(s).split(" ").filter(Boolean); return w.length > 0 && named.length > 0 && w.every((x) => (" " + named + " ").indexOf(" " + x + " ") >= 0); };
  const logo = Boolean(brand.logoUrl);
  const nom = word("nom");
  const title = nom && !(logo && isName(nom)) ? nom : "";
  const line = word("ligne");
  const detail = word("detail");
  const PW = Math.round(W * 0.87);
  const PH0 = Math.round(H * 0.403);
  const gap = Math.round(H * 0.043);
  const under = { a: sy + SH / 2 + gap, b: H * 0.74 };
  const over = { a: H * 0.06, b: sy - SH / 2 - gap };
  const region = under.b - under.a >= PH0 * 0.75 || under.b - under.a >= over.b - over.a ? under : over;
  const PH = Math.round(Math.max(H * 0.2, Math.min(PH0, region.b - region.a)));
  const PY = Math.round(region === under ? region.a : region.b - PH);
  const PX = Math.round(within(sx - PW / 2, 40, W - 40 - PW));
  // Its words in her colours on her pale wall; on a dark one (her wall's light read under the poster), in her light
  // colour, else a warm white, so they still read.
  const wallLight = k0 >= 0 ? LightUnder(list[k0], ON, BOX, { x: PX, y: PY, w: PW, h: PH }) : null;
  const darkWall = Boolean(wallLight && wallLight.mean < 0.42);
  const lightInk = brand.palette && luma(brand.palette.light) >= 0.75 ? brand.palette.light : "#f7f3ee";
  const INK = darkWall ? lightInk : hers[0] || "#1f1f1d";
  const NAME = darkWall ? lightInk : hers[1] || hers[0] || "#1f1f1d";
  const words = (s) => String(s || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  // A text's box, centred on the poster, kept left of the apps' buttons below the middle of the frame.
  const CX = PX + PW / 2;
  const at = (top, tall) => {
    const y = Math.round(PY + PH * top);
    const tallPx = Math.max(1, Math.round(PH * tall));
    const limit = y + tallPx > H / 2 ? W - 152 : W - 52;
    const half = Math.max(40, Math.min(PW / 2, limit - CX, CX - 52));
    return { position: "absolute", left: Math.round(CX - half), top: y, width: Math.round(2 * half), height: tallPx };
  };
  const rule = (k) => h("span", { key: k, style: { display: "inline-block", width: "1.6em", height: "0.12em", backgroundColor: INK, verticalAlign: "middle", margin: "0 0.6em" } });
  // Keyed by its text: a FitText measures once, so another text in the same box would keep the first one's size.
  // Small labels beside the name that reads; read at 48 px at least when no name is written (her logo says it).
  const small = (text, top, tall, size, spaced) => {
    const fit = words(text) > 4 || !title ? Math.max(size, 48) : size;
    return h(FitText, { key: "s-" + keep(text), style: at(top, Math.max(tall, (fit * 1.25) / PH)), innerStyle: { fontFamily: body, fontWeight: 700, fontSize: fit, lineHeight: 1.1, letterSpacing: spaced ? "0.18em" : "0.08em", textTransform: "uppercase", color: INK, whiteSpace: "nowrap", textAlign: "center" } },
      h("span", title ? { "data-fauve-accent": "" } : null, spaced ? rule("a") : null, keep(text), spaced ? rule("b") : null));
  };
  const sparkle = (cx0, cy0, r) => h("svg", { key: "spark", width: 2 * r, height: 2 * r, viewBox: "-1 -1 2 2", style: { position: "absolute", left: Math.round(cx0 - r), top: Math.round(cy0 - r) } },
    h("path", { d: "M0 -1 C0.1 -0.25 0.25 -0.1 1 0 C0.25 0.1 0.1 0.25 0 1 C-0.1 0.25 -0.25 0.1 -1 0 C-0.25 -0.1 -0.1 -0.25 0 -1 Z", fill: NAME }));
  const LINE = Math.round(H * 0.0224);
  const DETAIL = Math.round(H * 0.0135);
  const nameTop = logo ? 0.49 : 0.02;
  const nameTall = (logo ? 0.31 : 0.74) + (title && !line ? 0.07 : 0);
  const nameBox = at(nameTop, nameTall);
  const poster = lit
    ? h("div", { key: "poster" },
        logo ? h("div", { style: { ...at(0, title ? 0.5 : 0.78), left: Math.round(PX + PW * 0.2), width: Math.round(PW * 0.6) } },
          h(Img, { src: brand.logoUrl, maxRetries: 1, onError: () => null, style: { width: "100%", height: "100%", objectFit: "contain" } })) : null,
        title ? h(FitText, { key: "title-" + keep(title), style: nameBox, innerStyle: { fontFamily: display, fontWeight: 700, fontSize: Math.round(PH * nameTall * 0.62), lineHeight: 1, letterSpacing: "-0.02em", color: NAME, textAlign: "center", textWrap: "balance" } }, keep(title)) : null,
        title ? h(Scribble, { key: "under", kind: "underline", box: { x: nameBox.left + nameBox.width * 0.02, y: nameBox.top, w: nameBox.width * 0.96, h: nameBox.height * 0.9 }, at: ON - 1, frames: 1, color: NAME, width: Math.max(3, Math.round(PH * 0.011)), wobble: 0.5, seed: "switch-under" }) : null,
        line ? small(line, 0.8, 0.07, LINE, true) : null,
        detail ? small(detail, 0.875, 0.045, DETAIL, false) : null,
        sparkle(PX + PW / 2, PY + PH * 0.96, Math.max(8, Math.round(PH * 0.04))))
    : null;

  // 4. Her shot as filmed, the light never changing; she passes in front of what is drawn on her wall (her cut-out over
  // it, from just before the flip). Once she has left (gone from her cut-out, else from her track, eight images in a row
  // after the flip), her wall is held on that image to the end: nothing of hers comes back into the picture.
  const GONE = React.useMemo(() => {
    if (k0 < 0) return null;
    const cut = (f) => (typeof SubjectBox === "function" ? SubjectBox(list[k0], f, BOX) : null);
    const tracked = (f) => {
      if (typeof track !== "function") return null;
      const s = track(f) || {};
      if (!s.bodies && !s.hands && !s.faces) return null;
      return Boolean((s.bodies || []).length || (s.hands || []).length || (s.faces || []).length);
    };
    // What says she is there: her cut-out when it was made (it holds her at the flip), else her track when it saw her
    // at the flip; nothing says it: never held.
    const atFlip = cut(ON);
    const byCut = Boolean(atFlip && atFlip.w * atFlip.h > 0);
    if (!byCut && tracked(ON) !== true) return null;
    // Gone when nothing of her is left in her cut-out (under a five-hundredth of what it held at the flip): her hands
    // still at the picture's edge are her; a hand coming back once she has gone is not.
    const her = byCut ? atFlip.w * atFlip.h : 0;
    const seenAt = (f) => {
      if (!byCut) return tracked(f) !== false;
      const b = cut(f);
      return Boolean(b && b.w * b.h > her * 0.002);
    };
    let run = 0;
    for (let f = ON + 6; f < D; f++) {
      if (seenAt(f)) run = 0;
      else if (++run >= 8) return f - 7;
    }
    return null;
  }, [track, k0, ON, D]);
  const held = k0 >= 0 && GONE !== null && frame >= GONE ? { at: frame - (GONE - list[k0].from) } : {};
  const wall = k0 >= 0 ? h(Footage, { key: "wall", shot: k0, style: BOX, ...held }) : null;
  // Her cut-out only over what is drawn on her wall (v2, as its skill's v10; Tristan: « bizarre il passe en découpé en
  // dessous »): over the switch from just before the flip, over her poster once lit; elsewhere her shot alone.
  const zone = (x, y, w, hh, m) => {
    const x0 = Math.round(Math.max(0, x - m));
    const y0 = Math.round(Math.max(0, y - m));
    const x1 = Math.round(Math.min(W, x + w + m));
    const y1 = Math.round(Math.min(H, y + hh + m));
    return "M " + x0 + " " + y0 + " H " + x1 + " V " + y1 + " H " + x0 + " Z";
  };
  const zones = [frame >= ON - 20 ? zone(sx - SW / 2, sy - SH / 2, SW, SH, SH * 0.35) : "", lit ? zone(PX, PY, PW, PH, H * 0.02) : ""].filter(Boolean).join(" ");
  const her = k0 >= 0 && zones ? h("div", { key: "her", style: { position: "absolute", left: 0, top: 0, width: W, height: H, clipPath: "path('" + zones + "')" } }, h(Subject, { shot: k0, style: BOX, ...held })) : null;
  return h(AbsoluteFill, null, wall, toggle, poster, her);
}`;

/** Its fallback moment, frames from its start: the beat nearest to the original's (4,1 s of 9,1), a second at least before its end. */
export function interrupteurFlip(frames: number, bpm: number): number {
  const beat = (60 / bpm) * 30;
  return Math.round(Math.max(Math.min(15, frames - 1), Math.min(frames - 30, Math.round((frames * 0.45) / beat) * beat)));
}

export const interrupteur: EffectPiece = {
  key: "interrupteur",
  // 2: her cut-out only over the switch and her poster (its skill's v10).
  version: 2,
  name: "Interrupteur",
  how: "un grand interrupteur de téléphone dessiné à plat sur son mur, éteint, là où sa main montera le plus haut ; quand elle saute ou tend le bras et le touche, il bascule d'un coup sur sa couleur avec un clic, et son affiche est là d'un coup sur le mur dessous (son logo, sinon son nom ou ce qu'elle lance en grand, sa ligne en capitales entre deux traits, un petit détail), elle passant devant ; une fois qu'elle est sortie du cadre, le mur reste avec l'affiche jusqu'à la fin ; puis le montage reprend.",
  needs: "une vidéo fixe, téléphone posé, de quelqu'un qui saute ou tend le bras vers un point haut d'un mur clair et uni, puis sort du cadre (le mur vide à la fin).",
  lays: "sur ce seul plan, de son entrée (ou de son élan) jusqu'à son mur vide, sa main au plus haut vers le milieu de l'effet",
  shots: [1, 1],
  seconds: [3, 10],
  require: { files: 1, shot: { still: true, person: true, video: true } },
  texts: [
    {
      slot: "nom",
      want: "le titre de son affiche, qui s'allume en grand sur le mur sous l'interrupteur : son nom, ou le mot de son nom qui la distingue (« Farine » pour « Maison Farine »), ou le nom de ce qu'elle lance (une forme comme « Soirée vinyles », « Nouvelle carte ») ; sous son logo quand elle en a un, jamais son nom deux fois",
      max: 18,
      required: true,
    },
    {
      slot: "ligne",
      want: "facultatif : ce qu'elle annonce, en petites capitales espacées entre deux traits sous le titre, comme sur une affiche (une forme comme « la semaine des events », « ouverture », « nouvelle collection ») ; 4 mots au plus",
      max: 24,
      required: false,
    },
    {
      slot: "detail",
      want: "facultatif : une date, une heure ou une adresse en tout petit sous la ligne (une forme comme « du 8 au 14 février », « dès 18 h », « 12 rue des Martyrs ») ; 4 mots au plus, rien d'inventé",
      max: 24,
      required: false,
    },
  ],
  timeline(input: PieceTimelineInput) {
    const flip = interrupteurFlip(input.frames, input.bpm);
    // Her hand is looked for over the whole effect but its first and last instants (a second of poster at least).
    const from = Math.min(12, Math.max(0, input.frames - 31));
    const to = Math.max(from + 1, input.frames - 30);
    return {
      marks: { flip, look_from: from, look_to: to },
      // The click as her hand touches the switch: where a hand of hers is highest in its shot, within the same window as
      // its code (its moment), else on its fallback moment.
      sounds: [{ at: flip / 30, sound: "light switch click", seconds: 0.5, gain: -2, hand: { shot: 0, moment: "highest" as const, within: [from / 30, to / 30] as [number, number] } }],
      // She is cut out on her one shot (only from just before the flip, in its code).
      cutouts: [0],
    };
  },
  code: CODE,
};
