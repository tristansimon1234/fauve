import type { EffectPiece } from "../pieces.ts";

// « La silhouette », the effect (docs/fiches/silhouette.md, effects 6 to 8; its whole Reel is skills/silhouette.ts,
// « Présente-toi »): over her shot of someone in profile (two passages of it at most), the frame turns to one pale
// colour and she is only her silhouette, cut out and filled with one dark tone, her picture laid whole and moved so that
// her head is a third of the frame's width, her body standing from the bottom, cut by the frame wherever her picture
// cuts her. A word in white sits in her head at eye level, kept inside her outline (« Je suis »), sliding 13 px into
// place. As she lowers her head (read on her tracks, HeadMoves, else on the beat), the word goes from its end, its first
// letter turning the cursor's colour; her name is typed behind her head at 40 letters a second, laid on her hair (her
// silhouette passes in front of it as she comes down, its cursor in front of her: on while it types, then on five
// images and off eight), and her last name rises 10 px away, her first name staying; when she raises her head, her head
// lifts her name with it (never hidden behind her). Then the montage takes over, at its next shot.
// Kept of its skill: its tools (Subject with fill, SubjectBox and SubjectOutline for her head, HeadMoves, its print
// when she is not cut out: her shot in a hard black and white, its blacks her tone, its whites the pale, its threshold
// from LightUnder, its words in ink on it as the fiche's fallback says, white where her shot is dark under them); its
// timings on the beat when nothing is measured (her head at 0,61 beat, her name at 0,845, her last name gone at 1,92);
// its proportions (her head a third of the width, its top at 42 % of the height, the word in her head at its size, her
// name 40 letters a second). Its own: when her picture leaves no room above her head (a close-up, a head cut by the
// top of her picture: her picture then covers the frame), her name in her head where its word was, moving with her
// head, centred in her silhouette across its line (never astride her edge), her first name gliding to the middle once
// her last name has gone; its two colours her charter's dark and pale when she has them (else its skill's v4 own:
// a warm ink and a warm paper, its v2), its cursor her accent when it reads on both (else a vermilion).
// Left out: the opening as a layout program and its negative, the round letter that becomes an eye, the almond, her
// trades, her logo, the 16:9 frame, and its sounds (its clicks are its opening's, and a click on her name could not
// follow her head when it is measured: the timeline knows nothing of her tracks).

/** Its marks when her head's move is not measured, in beats from its first frame (the skill's, from its cut on her). */
export const HEAD_DOWN = 0.61;
export const NAME_TYPE = 0.845;
export const LAST_OUT = 1.92;
/** The fewest frames its word stays whole in her head before it goes (0,5 s: « Je suis » is read). */
export const WORD_HOLD = 15;
/** Its word gone this many frames after her head starts down; her name never typed before. */
export const WORD_GONE = 6;
/** Her name typed at 40 letters a second (the original's « Tiago Feitosa » in 9 images). */
export const LETTERS_A_FRAME = 4 / 3;
/** The frames her full name holds, at least, before her last name rises away. */
export const NAME_HOLD = 12;

/** Her name as its code types it: her first name (or her place's), then her last name when there is one. */
export const typedName = (words: Record<string, string | undefined>): string[] => {
  const first = String(words.nom ?? "").trim();
  const last = String(words.nom_famille ?? "").trim();
  return Array.from((first + (first && last ? ` ${last}` : "")).normalize("NFC"));
};

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const lerp = (f, a, b, x, y, e) => interpolate(f, [a, Math.max(a + 1, b)], [x, y], e ? { ...cl, easing: e } : cl);
  const EO = (x) => 1 - Math.pow(1 - x, 3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chars = (s) => Array.from(String(s || "").normalize("NFC"));
  const all = Array.isArray(shots) ? shots : [];
  // Its shots: those that play during it, in order (her profile, a second passage of it at most).
  const mine = all.map((s, i) => i).filter((i) => all[i].from < durationInFrames && all[i].from + all[i].durationInFrames > 0);
  if (!mine.length) return null;

  // Its colours: one dark tone and one pale, her charter's when she has them, else its skill's own warm ink and warm
  // paper (v2: never the original's midnight and cold pale); its cursor in her accent when it reads on both, else its
  // skill's vermilion (never the original's peach).
  const hex = (c) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim().toLowerCase() : null);
  const lum = (c) => {
    const n = parseInt(c.slice(1), 16);
    const lin = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const pal = (brand && brand.palette) || {};
  const light = hex(pal.light);
  const dark = hex(pal.dark);
  const accent = hex(brand && brand.accent);
  const PALE = light && light !== "#ffffff" && lum(light) >= 0.75 ? light : "#efe9de";
  const TONE = dark && dark !== "#141414" && lum(dark) <= 0.05 ? dark : "#1b1714";
  const CARET = accent && ratio(accent, PALE) >= 1.8 && ratio(accent, TONE) >= 3 ? accent : "#e0512f";
  const font = "'" + ((brand && brand.displayFont) || "Inter") + "', 'Inter', 'Helvetica Neue', Arial, sans-serif";
  // A white word's tight edge in her tone: unseen on her silhouette, read anywhere off it.
  const edge = "0 0 1px " + TONE + ", 0 0 2px " + TONE + ", 0 1px 1px " + TONE;
  // Where a word to read may go: between x 140 and 925 (the apps' buttons on the right), from y 110 to 72 % down.
  const X0 = 140;
  const X1 = 925;

  // Her outline's points (its path's numbers, in pairs); her head (the top band of her outline, a little wider; else
  // the top of her box); her width at a height.
  const pointsOf = (path) => {
    const nums = path ? String(path).match(/-?\d+(?:\.\d+)?/g) : null;
    if (!nums || nums.length < 12) return null;
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])]);
    return pts;
  };
  const headOf = (pts, b) => {
    if (pts) {
      const ys = pts.map((p) => p[1]);
      const y0 = Math.min.apply(null, ys);
      const span = Math.max.apply(null, ys) - y0;
      const xs = pts.filter((p) => p[1] <= y0 + span * 0.16).map((p) => p[0]);
      const lo = Math.min.apply(null, xs);
      const hi = Math.max.apply(null, xs);
      return { x: (lo + hi) / 2, y: y0, w: Math.max(40, hi - lo) * 1.15 };
    }
    return b ? { x: b.x + b.w / 2, y: b.y, w: b.w * 0.45 } : null;
  };
  const rowOf = (pts, y, half) => {
    const xs = pts ? pts.filter((p) => Math.abs(p[1] - y) <= half).map((p) => p[0]) : [];
    return xs.length >= 2 ? { lo: Math.min.apply(null, xs), hi: Math.max.apply(null, xs) } : null;
  };

  // Her picture laid whole, at its own shape, scaled and moved so that her head is a third of the frame's width, its
  // top at 42 % of the height (the skill's: her silhouette standing from the bottom, the pale above her), cut by the
  // frame wherever her picture cuts her (never a straight edge in the middle of the pale). Read once, on an image near
  // the start of each of its shots.
  const WANT = { w: W * 0.33, x: W / 2, y: H * 0.42 };
  const layoutOf = (i) => {
    const s = all[i];
    const ref = Math.min(s.from + s.durationInFrames - 1, Math.max(s.from, 0) + 4);
    const aspect = Number(s.aspect) > 0 ? Number(s.aspect) : W / H;
    const base = { left: 0, top: 0, width: Math.round(H * aspect), height: H };
    const b = SubjectBox(s, ref, base);
    if (!b || !(b.w > 4) || !(b.h > 4)) return null;
    const hd = headOf(pointsOf(SubjectOutline(s, ref, base)), b);
    if (!hd) return null;
    const cut = { t: b.y <= H * 0.02, b: b.y + b.h >= H * 0.97, l: b.x <= base.width * 0.03, r: b.x + b.w >= base.width * 0.97 };
    let k = WANT.w / hd.w;
    if (cut.b) k = Math.max(k, (H - (cut.t ? 0 : WANT.y)) / Math.max(40, H - (cut.t ? 0 : hd.y)));
    if (cut.l && cut.r) k = Math.max(k, W / base.width);
    k = clamp(k, 0.15, 3);
    const laid = { left: Math.round(WANT.x - hd.x * k), top: Math.round(cut.t ? 0 : WANT.y - hd.y * k), width: Math.round(base.width * k), height: Math.round(base.height * k) };
    if (cut.r) laid.left = Math.max(laid.left, W - laid.width);
    if (cut.l) laid.left = Math.min(laid.left, 0);
    if (cut.b) laid.top = Math.max(laid.top, H - laid.height);
    return { laid, ref };
  };
  const lay = {};
  mine.forEach((i) => { lay[i] = layoutOf(i); });
  const shotAt = (f) => mine.reduce((k, i) => (all[i].from <= f ? i : k), mine[0]);
  const headAt = (f) => {
    const i = shotAt(f);
    const l = lay[i];
    return l ? headOf(pointsOf(SubjectOutline(all[i], f, l.laid)), SubjectBox(all[i], f, l.laid)) : null;
  };

  // When her head goes down: read on her tracks when it was measured, else on the beat (its word read first).
  const BEAT = mark("beat", 18);
  const moves = [];
  mine.forEach((i) => (typeof HeadMoves === "function" ? HeadMoves(all[i]) || [] : []).forEach((m) => moves.push(m)));
  const down = moves.filter((m) => m && m.what === "down" && m.from >= 4 && m.from <= durationInFrames - 24).sort((a, b) => a.from - b.from)[0];
  const D0 = Math.round(down ? down.from : mark("head_down", Math.max(15, 0.61 * BEAT)));
  const D1 = down ? Math.round(Math.min(down.to, down.from + 20)) : D0 + 8;
  const NT = Math.max(D0 + 6, Math.round(down ? 0 : mark("type_at", 0.845 * BEAT)));
  const first = word("nom");
  const last = first ? word("nom_famille") : "";
  const firstU = chars(first);
  const lastU = last ? chars(" " + last) : [];
  const units = firstU.length + lastU.length;
  const shown = clamp(Math.floor((frame - NT + 1) * (4 / 3)), 0, units);
  const typingEnd = NT + Math.ceil(units * 0.75);
  const hold = Math.max(Math.round(1.075 * BEAT), Math.ceil(units * 0.75) + 12);
  const LO = Math.max(typingEnd + 12, Math.round(down ? NT + hold : mark("last_out", NT + hold)));

  // Its word, in her head at eye level (her face when it was tracked), across her head's width there, in its middle.
  const i0 = mine[0];
  const l0 = lay[i0];
  const at0 = l0 ? l0.ref : Math.max(0, all[i0].from) + 4;
  const pts0 = l0 ? pointsOf(SubjectOutline(all[i0], at0, l0.laid)) : null;
  const hd0 = (l0 && headOf(pts0, SubjectBox(all[i0], at0, l0.laid))) || { x: WANT.x, y: WANT.y, w: WANT.w };
  const seen0 = typeof track === "function" ? (l0 ? track(at0, { shot: i0, left: l0.laid.left, top: l0.laid.top, width: l0.laid.width, height: l0.laid.height }) : track(at0)) : null;
  const face0 = seen0 && seen0.faces && seen0.faces[0];
  const eyeY = clamp(face0 ? face0.y : hd0.y + hd0.w * 0.5, 240, H * 0.68);
  // (Only what of her head is inside the frame's safe zone: a close-up's outline runs far past the frame.)
  const head = rowOf(pts0, eyeY, hd0.w * 0.15) || { lo: hd0.x - hd0.w / 2, hi: hd0.x + hd0.w / 2 };
  const across = { lo: Math.max(X0, head.lo), hi: Math.min(X1, head.hi) };
  const span = Math.max(160, across.hi - across.lo);
  const cx = !l0 && face0 ? face0.x : (across.lo + across.hi) / 2;
  const je = word("je");
  const jeU = chars(je);
  const jeFs = Math.round(clamp((span * 0.8) / (0.56 * Math.max(3, jeU.length)), 48, 120));
  const jeHalf = Math.max((jeU.length * jeFs * 0.56) / 2, Math.min(span * 0.45, 380));
  const jeX = clamp(cx, X0 + jeHalf, X1 - 14 - jeHalf);
  const jeY = Math.round(clamp(eyeY - jeFs * 0.65, 110, H * 0.72 - jeFs * 1.3));

  // Her name: on her hair, above her head once lowered; with no room there (her picture cuts her head, a close-up) or
  // no cut-out, in her head on its word's line.
  const fDown = Math.min(durationInFrames - 1, Math.max(NT + 9, D1));
  const hdDown = headAt(fDown) || hd0;
  const widest = (fs) => units * fs * 0.56;
  const onHair = Math.round(Math.max(48, Math.min(clamp(hdDown.w * 0.17, 52, 72), 780 / (0.56 * Math.max(1, units)))));
  const restY = Math.round(hdDown.y - onHair * 1.3);
  const above = mine.every((i) => lay[i]) && restY >= 110;
  const inHead = widest(48) <= span * 0.88;
  const fs = above ? onHair : Math.round(inHead ? clamp((span * 0.88) / (0.56 * Math.max(1, units)), 48, 96) : Math.max(48, Math.min(72, 780 / (0.56 * Math.max(1, units)))));
  const half = Math.min(392, above || !inHead ? Math.max(widest(fs) / 2, 120) : Math.max(widest(fs) / 2, span * 0.44));
  // On her hair, lifted by her head when she raises it (it looks a few images ahead), never lower than where it was laid.
  const topAt = (f) => { const hh = headAt(f); return hh ? hh.y : Infinity; };
  const lifted = frame > D1 ? Math.min(topAt(frame), topAt(frame + 2), topAt(frame + 4)) - fs * 1.3 : Infinity;
  // In her head, it moves with her head as she turns or bows (a few images averaged), centred in her silhouette across
  // its line (never astride her edge); once her last name has gone, her first name glides to the middle.
  const drifts = [frame - 2, frame, frame + 2].map(headAt).filter(Boolean).map((hh) => ({ x: hh.x - hd0.x, y: hh.y - hd0.y }));
  const drift = !above && l0 && drifts.length ? { x: drifts.reduce((s, d) => s + d.x, 0) / drifts.length, y: drifts.reduce((s, d) => s + d.y, 0) / drifts.length } : { x: 0, y: 0 };
  const nameY = Math.round(above ? clamp(Math.min(restY, lifted), 110, H * 0.72 - fs * 1.3) : clamp(jeY + (jeFs - fs) * 0.65 + drift.y, 110, H * 0.72 - fs * 1.3));
  // Her silhouette across a row (its outline's pieces joined, as its clip): the span that holds x, else the widest.
  const spanAt = (f, y, x) => {
    const i = shotAt(f);
    const l = lay[i];
    const pts = l ? pointsOf(SubjectOutline(all[i], f, l.laid)) : null;
    if (!pts) return null;
    const xs = [];
    pts.forEach((a, k) => {
      const b = pts[(k + 1) % pts.length];
      if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    });
    xs.sort((p, q) => p - q);
    const spans = [];
    for (let k = 0; k + 1 < xs.length; k += 2) spans.push({ lo: xs[k], hi: xs[k + 1] });
    return spans.find((s) => s.lo <= x && x <= s.hi) || spans.reduce((m, s) => (!m || s.hi - s.lo > m.hi - m.lo ? s : m), null);
  };
  const out = lerp(frame, LO, LO + 5, 0, 1);
  const gone = lastU.length > 0 && frame >= LO + 5;
  const fullHalf = widest(fs) / 2;
  const lastHalf = (lastU.length * fs * 0.56) / 2;
  const guess = cx + drift.x;
  const mids = !above && l0
    ? [frame - 2, frame, frame + 2].map((f) => spanAt(f, nameY + fs * 0.65, guess)).filter(Boolean).map((s) => {
        const lo = Math.max(X0, s.lo);
        const hi = Math.min(X1, s.hi);
        return clamp((lo + hi) / 2, lo + (gone ? fullHalf - lastHalf : fullHalf), hi - (gone ? fullHalf - lastHalf : fullHalf));
      })
    : [];
  const target = mids.length ? mids.reduce((s, m) => s + m, 0) / mids.length : guess;
  const glide = lerp(frame, LO + 5, LO + 13, 0, 1, EO);
  const together = clamp(target, X0 + fullHalf, X1 - fullHalf);
  const alone = clamp(target, X0 + fullHalf - lastHalf, X1 - fullHalf + lastHalf);
  // (The row keeps her last name, unseen, in its place: its centre is her first name's plus half her last name.)
  const nameX = above ? clamp(hdDown.x, X0 + half, X1 - half) : (gone ? together - lastHalf + (alone - together + lastHalf) * glide : together - lastHalf) + lastHalf;

  // A line in a box that only shrinks a text too wide for it (a wide font), its letters to come kept in their place.
  const line = (key, x, y, size, halfWidth, color, weight, kids, more) =>
    h(FitText, {
      key,
      style: { position: "absolute", left: Math.round(x - halfWidth), top: Math.round(y), width: Math.round(halfWidth * 2), height: Math.round(size * 1.3) },
      innerStyle: { flexDirection: "row", alignItems: "center", justifyContent: "center", fontFamily: font, fontWeight: weight, fontSynthesis: "none", fontSize: size, lineHeight: 1, color, whiteSpace: "pre", ...more },
    }, kids);
  // Her name typed (it grows from its start), its cursor after the last letter typed: on while it types, then on five
  // images and off eight; her last name rising 10 px away, her first name staying, the cursor back after it.
  const blink = frame < typingEnd + 2 || (frame - typingEnd - 2) % 13 < 5;
  const nameKids = (letters, withCaret) => {
    const nFirst = Math.min(shown, firstU.length);
    const nLast = Math.max(0, shown - firstU.length);
    const bar = withCaret && blink ? h("span", { style: { position: "absolute", left: Math.round(fs * 0.05), top: Math.round(fs * 0.03), width: Math.max(4, Math.round(fs * 0.08)), height: Math.round(fs * 0.95), background: CARET } }) : null;
    const caret = h("span", { key: "c", style: { display: "inline-block", position: "relative", width: 0, height: fs } }, bar);
    const after = gone || shown <= firstU.length ? "first" : "last";
    return [
      h("span", { key: "f", style: { fontWeight: 400, opacity: letters ? 1 : 0 } }, firstU.slice(0, nFirst).join("")),
      after === "first" ? caret : null,
      h("span", { key: "fr", style: { fontWeight: 400, opacity: 0 } }, firstU.slice(nFirst).join("")),
      lastU.length ? h("span", { key: "l", style: { fontWeight: 700, display: "inline-block", opacity: letters && !gone ? 1 - out : 0, transform: "translateY(" + Math.round(-10 * out) + "px)" } }, lastU.slice(0, nLast).join("")) : null,
      after === "last" ? caret : null,
      lastU.length ? h("span", { key: "lr", style: { fontWeight: 700, opacity: 0 } }, lastU.slice(nLast).join("")) : null,
    ];
  };

  // Her silhouette, of one tone, on the pale; without her cut-out, her shot as a hard black and white print, its blacks
  // her tone and its whites the pale, its threshold from her shot's light.
  const cur = shotAt(frame);
  const L = lay[cur];
  const her = L ? h(Subject, { key: "her", shot: cur, fill: TONE, style: { position: "absolute", left: L.laid.left, top: L.laid.top, width: L.laid.width, height: L.laid.height } }) : null;
  const FULL = { left: 0, top: 0, width: W, height: H };
  const lit = !L && typeof LightUnder === "function" ? LightUnder(all[cur], Math.max(0, all[cur].from) + 4, FULL) : null;
  const gain = lit && lit.mean > 0.04 ? clamp(0.5 / lit.mean, 0.55, 2.4) : 1.35;
  const print = L
    ? null
    : h("div", { key: "print", style: { position: "absolute", ...FULL, isolation: "isolate" } },
        h(Footage, { shot: cur, style: { ...FULL, filter: "grayscale(1) brightness(" + gain.toFixed(2) + ") contrast(3.2)" } }),
        h("div", { style: { position: "absolute", ...FULL, background: PALE, mixBlendMode: "darken" } }),
        h("div", { style: { position: "absolute", ...FULL, background: TONE, mixBlendMode: "lighten" } }));
  // On her silhouette its words are white, a tight edge of her tone; on the print, ink of her tone with a tight pale edge
  // (the fiche's « à l'encre sur le pâle »), white where her shot is dark under them (its light through the print's gain).
  const paleEdge = "0 0 1px " + PALE + ", 0 0 2px " + PALE + ", 0 1px 1px " + PALE;
  const inkOf = (x, y, size, halfWidth) => {
    if (L) return { color: "#ffffff", edge };
    const under = typeof LightUnder === "function" ? LightUnder(all[cur], Math.max(0, all[cur].from) + 4, FULL, { x: x - halfWidth, y, w: halfWidth * 2, h: size * 1.3 }) : null;
    return under && under.mean * gain < 0.42 ? { color: "#ffffff", edge } : { color: TONE, edge: paleEdge };
  };
  // Its word inside her outline at every image (its pieces joined where her picture cuts her); its first letter turning
  // the cursor's colour as her head starts down, its others gone from its end.
  const outline = L ? SubjectOutline(all[cur], frame, L.laid) : null;
  const clip = outline ? "path('" + String(outline).replace(/ M /g, " L ") + " Z')" : null;
  const jeInk = inkOf(jeX, jeY, jeFs, jeHalf);
  const jeNode = je && frame < D0 + 6
    ? h("div", { key: "je", style: { position: "absolute", left: 0, top: 0, width: W, height: H, ...(clip ? { clipPath: clip } : {}) } },
        line("je-line", jeX + lerp(frame, 0, 8, 13, 0, EO), jeY, jeFs, jeHalf, jeInk.color, 600, jeU.map((c, i) => {
          const g = D0 + (jeU.length - 1 - i) * 0.7;
          const tone = i ? {} : frame >= D0 ? { color: CARET } : frame >= D0 - 4 ? { color: interpolateColors(0.5, [0, 1], [jeInk.color, CARET]) } : {};
          return h("span", { key: i, style: { opacity: i ? lerp(frame, g, g + 2, 1, 0) : 1, ...tone } }, c);
        }), { textShadow: jeInk.edge }))
    : null;
  const typing = units > 0 && frame >= NT;
  // On her hair, her name is laid before her (she passes in front of it) and its cursor after her; in her head, all of
  // it after her.
  const nameInk = inkOf(nameX, nameY, fs, half);
  const behind = typing && above ? line("name", nameX, nameY, fs, half, TONE, 400, nameKids(true, false)) : null;
  const front = typing ? (above ? line("caret", nameX, nameY, fs, half, TONE, 400, nameKids(false, true)) : line("name", nameX, nameY, fs, half, nameInk.color, 400, nameKids(true, true), { textShadow: nameInk.edge })) : null;
  return h(AbsoluteFill, { style: { backgroundColor: PALE, overflow: "hidden" } }, print, behind, her, jeNode, front);
}`;

export const silhouette: EffectPiece = {
  key: "silhouette",
  // 2: its skill's v4 colours when her charter has none (a warm ink, a warm paper, a vermilion: Tristan, of the model,
  // « trop similaire à la vidéo originale »), never the original's midnight, cold pale and peach.
  version: 2,
  name: "La silhouette",
  how: "elle, de profil, devient sa silhouette d'un seul ton sombre sur un aplat clair, un mot blanc dans sa tête (« Je suis ») ; quand elle baisse la tête, le mot s'efface et son nom se tape derrière sa tête, posé sur ses cheveux ; son nom de famille s'envole, son prénom reste, et sa tête le soulève quand elle la relève ; puis le montage reprend.",
  needs: "une vidéo fixe d'elle (ou de quelqu'un de son équipe) de profil, tête et épaules, devant un fond clair et uni, avec de la place au-dessus de sa tête, qui baisse la tête (penchée sur son travail) puis la relève.",
  lays: "sur son plan de profil, son passage commençant une demi-seconde avant qu'elle baisse la tête (deux passages de ce plan au plus)",
  shots: [1, 2],
  seconds: [2.5, 6],
  require: { files: 1, shot: { framing: ["medium", "close"], still: true, person: true, video: true } },
  texts: [
    { slot: "je", want: "les mots blancs dans sa tête, à hauteur des yeux, avant son nom : « Je suis » (« On est » pour une équipe, « Voici » quand elle présente quelqu'un, « Moi, c'est »)", max: 10, required: true },
    { slot: "nom", want: "son prénom, ou le nom de son lieu en entier : tapé derrière sa tête quand elle la baisse, il reste à l'écran", max: 16, required: true },
    { slot: "nom_famille", want: "seulement pour une personne : son nom de famille, tapé juste après son prénom, puis qui s'envole (vide pour le nom d'un lieu)", max: 12, required: false },
  ],
  timeline({ bpm, shots, words }) {
    const beat = (60 / bpm) * 30;
    const letters = typedName(words).length;
    const headDown = Math.max(WORD_HOLD, Math.round(HEAD_DOWN * beat));
    const typeAt = Math.max(headDown + WORD_GONE, Math.round(NAME_TYPE * beat));
    const typing = Math.ceil(letters / LETTERS_A_FRAME);
    const lastOut = Math.max(typeAt + typing + NAME_HOLD, typeAt + Math.max(Math.round((LAST_OUT - NAME_TYPE) * beat), typing + NAME_HOLD));
    // Her cut-out on each of its shots: its code draws her silhouette on the one that plays.
    return { marks: { head_down: headDown, type_at: typeAt, last_out: lastOut }, cutouts: shots.map((_, i) => i) };
  },
  code: CODE,
};
