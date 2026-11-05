import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Vision machine » (key `vision`), version 1, written on its original's fiche (docs/fiches/vision.md: measured image by
// image at 30 i/s, its frames, labels, colours, grids and the share of the picture shown by its tiles measured on its
// pixels, the spectrum and the envelope of its beep). One fixed shot of a square seen from above, a man reading on a
// bench in the middle and passers-by round him, run through some ten « machine looks » that take turns in a strobe of
// clean cuts (71 changes in 8,5 s, a pass of 1 to 8 images, eleven blacks), each pass at its own moment of the shot.
// Its music is a held beep retriggered on every beat at 155 BPM over a deep rumble; ours counts a beat every two beeps
// (77,5 BPM), and every pass below starts on the original's own image at that tempo (its fiche's list, image by image):
//   0 – 0,47    the man and his bench alone on white, in their frames, blue then dotted then blue, blacks between;
//   0,37 – 0,47 the same, as filmed (three images);
//   0,47 – 1,20 the place built tile by tile round him, from him outwards (its tiles in the perspective of her floor),
//               half of them at once, the others fading in from white, the back's openings left white;
//   1,20 – 3,63 a first strobe: the place with its back still white, every passer-by in a frame that flickers between
//               two tones of blue and black with light dots, the depth in grey, the network (the depth behind them, each
//               one in its frame as filmed, linked by wires), the passers-by in dots, the man in characters with his
//               tiles leaving, blacks; each frame's label drops its letters at every image;
//   3,63 – 4,53 the graph alone on white (a dot per passer-by, wires, binary codes), then the passers-by in their frames on it;
//   4,53 – 7,23 a second strobe, tighter (a pass every two images when the beep doubles, held two images each), the
//               whole place in characters once;
//   7,23 – 8,03 the place erased tile by tile from the back towards him, until the man and his bench alone;
//   8,03 – 8,52 the man and his bench in light characters on black, then black.
// Vertical full frame as the original (a shot in width framed on her still subject, kept in the middle of the frame);
// on her word, her shot in width in a 16:9 band on the white of the passes (its blacks full frame). Two shots of her one
// video: a short one where her still subject and what it is on are read (her shot's first images), then her place with
// its people, every pass replaying a moment of it. Her photo stays still (no depth then: those passes go black). No grade:
// her shot as filmed, the only colour added the frames' blue. Nothing of the original's own is copied: « REPROGRAMMING »
// gives way to her own word on every label.

const BPM = 77.5;
/** Its passes, each from the original's image (30 i/s at its tempo) and its kind (see the code). */
export const PASSES: [number, string][] = [
  [0, "b"], [1, "d"], [2, "b"], [3, "k"], [6, "d"], [7, "m"], [8, "k"], [11, "s"], [14, "T"],
  [36, "k"], [38, "n"], [39, "p"], [41, "c"], [45, "s"], [47, "o"], [49, "p"], [53, "k"], [56, "z"], [59, "k"], [63, "z"], [68, "a"], [69, "n"], [70, "A"], [77, "k"], [79, "p"], [80, "f"], [82, "n"], [83, "c"], [90, "f"], [98, "k"], [99, "w"], [104, "k"],
  [109, "g"], [117, "G"],
  [136, "f"], [140, "n"], [146, "a"], [151, "k"], [154, "c"], [161, "f"], [164, "p"], [166, "t"], [170, "c"], [172, "n"], [174, "o"], [176, "t"], [178, "c"], [180, "n"], [182, "a"], [183, "k"], [186, "B"], [196, "g"], [198, "k"], [200, "o"], [201, "P"], [206, "o"], [210, "w"], [214, "o"],
  [217, "E"], [241, "X"], [246, "k"],
];
/** The original's images a beat of ours (two of its beeps, 0,774 s), its length (255 images), its anchor shot (its first 14 images: the man and his bench read there). */
const FRAMES_A_BEAT = 30 * (60 / BPM);
const LENGTH = 255;
const ANCHOR = 14;
/** Its images held two images each (15 i/s) and the beep stopping (images). */
const HELD: [number, number][] = [[39, 53], [164, 182]];
const SILENT = 248;
/** The ending card, in option: black after its last characters, the engine's 1,6 s at least. */
const CARD_SECONDS = 1.6;
const round = (s: number) => Math.round(s * 100) / 100;
const round3 = (s: number) => Math.round(s * 1000) / 1000;

const CODE =
  String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const R = mark("r", 1);
  const PASSES = ` +
  JSON.stringify(PASSES) +
  String.raw`.map(([f, k]) => [Math.round(f * R), k]);
  const HELD = ` +
  JSON.stringify(HELD) +
  String.raw`.map(([a, b]) => [Math.round(a * R), Math.round(b * R)]);
  const endAt = end ? end.from : durationInFrames + 1;
  let pi = 0;
  PASSES.forEach((p, i) => { if (p[0] <= frame) pi = i; });
  const P0 = PASSES[pi][0], kind = frame >= endAt ? "k" : PASSES[pi][1];
  const P1 = pi + 1 < PASSES.length ? PASSES[pi + 1][0] : durationInFrames;
  const t = frame - P0;
  const W = width, H = height, WHITE = "#fdfdfd", NAVY = "#243250";
  const abs = (s) => ({ position: "absolute", ...s });
  const rnd = (s) => random("v" + s);
  // Its frame: vertical, a shot in width framed on her still subject in the middle; or her shot in a 16:9 band on her word.
  const wide = texts && texts.format === "horizontal";
  const place = shots[1] || shots[0], anchor = shots[0];
  const band = wide ? { left: 0, top: Math.round((H - (W * 9) / 16) / 2), width: W, height: Math.round((W * 9) / 16) } : { left: 0, top: 0, width: W, height: H };
  const A = (place && Number(place.aspect)) || 9 / 16;
  const big = !wide && A > W / H + 0.02 ? { left: 0, top: 0, width: Math.round(H * A), height: H } : band;
  const sb0 = anchor ? SubjectBox(shots[0], 0, big, "@sujet") : null;
  const laid = big === band || !sb0 ? band : { ...big, left: Math.max(W - big.width, Math.min(0, Math.round(W / 2 - sb0.x - sb0.w / 2))) };
  const L = abs(laid);
  // Each pass at its own moment of her place (passers-by elsewhere from one pass to the next), some held two images each.
  const n1 = place ? place.durationInFrames : 1;
  const off = Math.floor(rnd(pi + "off") * Math.max(1, n1 - (P1 - P0) - 1));
  const AT = P0 - off;
  const hold = HELD.some(([a, b]) => frame >= a && frame < b) ? 2 : 1;
  const shown = hold > 1 ? Math.floor((off + t) / 2) * 2 : off + t;
  const RF = place ? place.from + shown : 0;
  const AF = Math.min(frame, anchor ? anchor.durationInFrames - 1 : 0);
  const foot = (style) => h(Footage, { shot: 1, at: AT, hold, style: { ...L, ...style } });
  const still = (style) => h(React.Fragment, null, h(Subject, { shot: 0, object: "@support", style: { ...L, ...style } }), h(Subject, { shot: 0, object: "@sujet", style: { ...L, ...style } }));
  const people = (style) => h(Subject, { shot: 1, object: "every person", at: AT, hold, style: { ...L, ...style } });
  const fill = (c, kids) => h("div", { style: abs({ left: 0, top: 0, width: W, height: H, background: c }) }, kids);
  const inBand = (c, kids) => fill(wide ? "#000000" : c, h("div", { style: { ...abs(band), background: c, overflow: "hidden" } }, h("div", { style: abs({ left: -band.left, top: -band.top, width: W, height: H }) }, kids)));
  const clip = (bs) => (bs.length ? "path('" + bs.map((b) => "M" + Math.round(b.x) + " " + Math.round(b.y) + "h" + Math.round(b.w) + "v" + Math.round(b.h) + "h" + -Math.round(b.w) + "Z").join(" ") + "')" : "inset(100%)");

  // Who is seen: every person followed in her place (their boxes on this moment), else the tracker's bodies; her still
  // subject and what it is on, read on her anchor shot.
  const pad = (b) => ({ x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 });
  let them = place ? SubjectParts(shots[1], RF, laid, "every person") : [];
  if (!them.length && place && typeof track === "function") {
    them = ((track(RF, { shot: 1, ...laid }) || {}).bodies || []).flatMap((b) => {
      const p = Object.values(b.points || {}).filter((q) => q.visible);
      if (p.length < 4) return [];
      const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
      const x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
      return [{ x: x0, y: y0 - 20, w: Math.max.apply(null, xs) - x0, h: Math.max.apply(null, ys) - y0 + 30 }];
    });
  }
  const su = anchor ? SubjectBox(shots[0], AF, laid, "@sujet") : null;
  const sp = anchor ? SubjectBox(shots[0], AF, laid, "@support") : null;
  const stills = [su, sp].filter(Boolean);
  const boxes = them.map(pad).concat(stills.map(pad)).filter((b) => b.w > 6 && b.h > 6 && b.x < W && b.y < H && b.x + b.w > 0 && b.y + b.h > 0);

  // Its labels: her word on a small tab above each frame's corner, letters dropped at random at every image.
  const etiq = reelTexts.find((t) => t.role === "caption");
  const word = String((etiq && etiq.text) || brand.name || "").toUpperCase();
  const MONO = "'VT323', 'IBM Plex Mono', monospace";
  const drop = (i) => Array.from(word).map((c, j) => (rnd(frame * 7919 + i * 131 + j + "l") < 0.3 ? [" ", "·", "?", "<", ">", "/"][Math.floor(rnd(frame * 7919 + i * 131 + j + "k") * 6)] : c)).join("");
  const tag = (b, i, bg) => h("div", { key: "t" + i, style: abs({ left: Math.round(b.x), top: Math.round(b.y) - 17, height: 17, padding: "0 4px", background: bg, color: "#ffffff", fontFamily: MONO, fontSize: 17, lineHeight: "17px", whiteSpace: "pre" }) }, drop(i));
  const tags = (bg, list) => h("div", { "data-fauve-decor": "" }, (list || boxes).map((b, i) => tag(b, i, bg)), word ? h("span", { style: { opacity: 0, fontSize: 4 } }, word) : null);
  const stroke = (bs, color, w) => bs.map((b, i) => h("div", { key: "s" + i, style: abs({ left: Math.round(b.x), top: Math.round(b.y), width: Math.round(b.w), height: Math.round(b.h), boxShadow: "inset 0 0 0 " + w + "px " + color }) }));
  // Two tones of blue that keep the picture's light (black #142754 to white #c8d6ef).
  const BLUE = h("svg", { width: 0, height: 0, style: { position: "absolute" } }, h("filter", { id: "vblue", colorInterpolationFilters: "sRGB" },
    h("feColorMatrix", { type: "matrix", values: "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" }),
    h("feComponentTransfer", null, h("feFuncR", { type: "table", tableValues: "0.078 0.278 0.667 0.784" }), h("feFuncG", { type: "table", tableValues: "0.153 0.361 0.737 0.839" }), h("feFuncB", { type: "table", tableValues: "0.329 0.533 0.867 0.937" }))));
  const dotsOf = (kid) => h(Ascii, { cell: [4, 8], kind: "dots", ink: "#e9ecf2", paper: "none" }, kid);

  // Her place's tiles: rows in the perspective of her floor (toward her shot's vanishing point), wider at the bottom;
  // above the horizon, the back in plain tiles; each ranked by its distance from her still subject.
  const vp = place ? VanishingPoint(shots[1], RF, laid, { fallback: { x: laid.left + laid.width / 2, y: laid.top + laid.height * 0.3 } }) : { x: W / 2, y: H * 0.3 };
  const top0 = laid.top, bottom = laid.top + laid.height;
  const hy = Math.max(top0 + laid.height * 0.12, Math.min(top0 + laid.height * 0.6, vp.y));
  const cx = Math.max(-W, Math.min(2 * W, vp.x));
  const sx = su ? su.x + su.w / 2 : W / 2, sy = su ? su.y + su.h : top0 + laid.height * 0.63;
  const tiles = [];
  const sw = laid.width / 5;
  for (let k = 0; k < 9; k++) {
    const ya = hy + (bottom - hy) / (1 + 0.42 * k), yb = hy + (bottom - hy) / (1 + 0.42 * (k + 1));
    const at = (xb, y) => cx + ((xb - cx) * (y - hy)) / (bottom - hy);
    for (let j = -8; j < 8; j++) {
      const xa = cx + j * sw, xc = cx + (j + 1) * sw;
      const q = [[at(xa, ya), ya], [at(xc, ya), ya], [at(xc, yb), yb], [at(xa, yb), yb]];
      if (Math.max(q[1][0], q[2][0]) < 0 || Math.min(q[0][0], q[3][0]) > W) continue;
      const mx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, my = (ya + yb) / 2;
      tiles.push({ q, d: Math.abs(mx - sx) / Math.max(20, q[1][0] - q[0][0]) + Math.abs(my - sy) / Math.max(8, ya - yb) * 1.4 });
    }
  }
  const bh = laid.height * 0.07;
  for (let y = hy; y > top0 - 1; y -= bh) for (let x = laid.left; x < laid.left + laid.width; x += laid.width / 8) {
    const y1 = Math.max(top0, y - bh);
    tiles.push({ q: [[x, y1], [x + laid.width / 8, y1], [x + laid.width / 8, y], [x, y]], d: 40 + (hy - y) / bh + rnd(Math.round(x) + "bk") * 2 });
  }
  tiles.forEach((p, i) => { p.d += rnd(i + "tj") * 1.6; });
  tiles.sort((a, b) => a.d - b.d);
  tiles.forEach((p, i) => { p.p = i / Math.max(1, tiles.length - 1); p.fade = rnd(i + "tf") < 0.5 ? 0 : 2 + Math.floor(rnd(i + "tg") * 3); });
  const poly = (q) => "M" + q.map((v) => Math.round(v[0]) + " " + Math.round(v[1])).join(" L") + " Z";
  // The share of her place shown at a frame of the build (the original's 3,3 % to 93 %, its jump at 0,70 s), of the erase
  // (60 % to 5,9 %, the farthest first), or of characters whose tiles leave or come back.
  const lin = (x, xs, ys) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x < xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]); return ys[ys.length - 1]; };
  const BF = [14, 20, 21, 28, 29, 35].map((v) => v * R), BS = [0.033, 0.12, 0.54, 0.67, 0.8, 0.93];
  const shareAt = (f) => (f < BF[0] ? 0 : lin(f, BF, BS));
  // Built: each tile lands on its frame, half at once, the others fading in from white over 2 to 4 images.
  const tiled = (share, build) => {
    const on = tiles.filter((p) => p.p < share);
    const veils = build ? on.filter((p) => p.fade && frame - lin(p.p, BS, BF) < p.fade) : [];
    return h(React.Fragment, null, still({}),
      on.length ? h("div", { style: abs({ left: 0, top: 0, width: W, height: H, clipPath: "path('" + on.map((p) => poly(p.q)).join(" ") + "')" }) }, foot({})) : null,
      veils.length ? h("svg", { width: W, height: H, style: abs({ left: 0, top: 0 }) }, veils.map((p, i) => h("path", { key: i, d: poly(p.q), fill: WHITE, opacity: 1 - (frame - lin(p.p, BS, BF)) / p.fade }))) : null);
  };

  // The graph: a dot for each one seen, wires between them (to their nearest and to the farthest, up the frame), binary codes.
  const nodes = boxes.map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h * 0.45 }));
  const far = nodes.map((n, i) => i).sort((a, b) => nodes[a].y - nodes[b].y).slice(0, 2);
  const wires = (color) => h("svg", { width: W, height: H, style: abs({ left: 0, top: 0 }) }, nodes.flatMap((a, i) => {
    const near = nodes.map((b, j) => j).filter((j) => j !== i).sort((x, y) => Math.hypot(nodes[x].x - a.x, nodes[x].y - a.y) - Math.hypot(nodes[y].x - a.x, nodes[y].y - a.y)).slice(0, 2).concat(far.filter((j) => j !== i));
    return near.map((j, k) => { const b = nodes[j], sag = 40 + rnd(i * 97 + j + "w") * 80; return h("path", { key: i + "-" + k, d: "M" + a.x + " " + a.y + " Q" + (a.x + b.x) / 2 + " " + ((a.y + b.y) / 2 + sag) + " " + b.x + " " + b.y, fill: "none", stroke: color, strokeWidth: rnd(i * 13 + k + "ww") < 0.15 ? 3 : 1.5 }); });
  }));
  const bits = (i) => [16, 8, 8, 8].map((n, g) => Array.from({ length: n }, (_, k) => (rnd(k + i * 41 + g * 997 + "b") < 0.5 ? 0 : 1)).join("")).join(" ");
  const graph = (withThem) => h(React.Fragment, null,
    withThem ? h("div", { style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(boxes) }) }, foot({})) : null,
    wires("#c8c9c6"),
    withThem ? stroke(boxes, "#111111", 3) : null,
    withThem ? tags("#000000") : null,
    h("svg", { width: W, height: H, style: abs({ left: 0, top: 0 }) }, nodes.map((n, i) => h("circle", { key: i, cx: n.x, cy: n.y, r: 6, fill: "#2f302e" }))),
    h("div", { "data-fauve-decor": "" }, nodes.slice(0, 6).map((n, i) => (i % 2 ? null : h("div", { key: i, style: abs({ left: Math.round(n.x + 14), top: Math.round(n.y - 8), fontFamily: MONO, fontSize: 14, color: "#2f302e", whiteSpace: "nowrap" }) }, bits(i))))));

  // Its passes. k black; s her still subject alone on white as filmed; b d m f framed on white (blue, dotted, the two,
  // at random at every image); T the tiles built; p her place with its back still white; t its tiles in two states;
  // w its back whitening by depth; c a frame on everyone (blue or dotted at every image); z the depth; n the network;
  // g the graph, G with them in their frames; o everyone in dots; a A B her still subject and its tiles in characters
  // (leaving, coming back), P the whole place, X at the end; E the place erased tile by tile from the back.
  const framed = (mode) => {
    const parts = [[su, "@sujet"], [sp, "@support"]].filter((x) => x[0]);
    return inBand(WHITE, h(React.Fragment, null, BLUE, parts.map(([b, name], i) => {
      const blue = mode === "b" || (mode === "m" ? name === "@support" : mode === "f" ? rnd(frame * 31 + i + "fr") < 0.5 : false);
      const B = pad(b);
      const cut = () => (name === "@support" ? h(Subject, { shot: 0, object: "@support", style: L }) : h(Subject, { shot: 0, object: "@sujet", style: L }));
      return h("div", { key: name }, blue ? h("div", { style: { filter: "url(#vblue)" } }, cut()) : h("div", { style: abs({ left: B.x, top: B.y, width: B.w, height: B.h, background: "#07070e" }) }), blue ? null : h("div", { style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip([B]) }) }, dotsOf(cut())), stroke([B], "#a0a0a0", 1.5));
    }), tags(NAVY, stills.map(pad))));
  };
  const body = (() => {
    switch (kind) {
      case "k": return fill("#000000");
      case "s": return inBand(WHITE, still({}));
      case "b": case "d": case "m": case "f": return framed(kind);
      case "T": return inBand(WHITE, tiled(shareAt(frame), true));
      case "p": return inBand(WHITE, tiled(0.8));
      case "t": return inBand(WHITE, tiled(t % 2 ? 0.42 : 0.8));
      case "w": return inBand(WHITE, h(React.Fragment, null, still({}), h(Near, { shot: 1, at: AT, depth: 0.92 - 0.12 * t, soft: 0.08, style: L })));
      case "c": {
        const blue = boxes.filter((b, i) => rnd(frame * 131 + i + "c") < 0.55), dark = boxes.filter((b) => !blue.includes(b));
        return inBand(WHITE, h(React.Fragment, null, BLUE, foot({}),
          h("div", { style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(blue), filter: "url(#vblue)" }) }, foot({})),
          h("div", { style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(dark), background: "#07070e" }) }, dotsOf(people({}))),
          tags(NAVY)));
      }
      case "z": return fill("#000000", inBand("#000000", h(Depth, { shot: 1, at: AT, hold, style: L })));
      case "n": return fill("#000000", inBand("#000000", h(React.Fragment, null, h(Depth, { shot: 1, at: AT, hold, style: { ...L, filter: "contrast(0.78) brightness(1.18)" } }), wires("#c8c8c8"),
        h("div", { style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(boxes) }) }, foot({})), stroke(boxes, "#000000", 3), tags("#000000"))));
      case "g": return inBand("#fbfdfa", graph(false));
      case "G": return inBand("#fbfdfa", graph(true));
      case "o": return inBand("#fbfdfa", h(Ascii, { cell: [4, 8], kind: "dots", ink: "#26262a", paper: "#fbfdfa" }, h(Sketch, { invert: true, strength: 1.4 }, people({}))));
      case "a": case "A": case "B": case "X": {
        const share = kind === "A" ? 0.5 - 0.06 * t : kind === "B" ? 0.06 + 0.06 * t : kind === "X" ? 0 : 0.35;
        return fill("#000000", inBand("#000000", h(Ascii, { cell: [4, 8], ink: "#e6e6e6", paper: "#000000" }, share > 0 ? tiled(share) : still({}))));
      }
      case "P": return fill("#000000", h(Ascii, { cell: [4, 8], ink: "#e6e6e6", paper: "#000000" }, inBand("#000000", foot({}))));
      case "E": return inBand(WHITE, tiled(Math.max(0.03, 0.6 - (0.54 * t) / Math.max(1, P1 - P0))));
      default: return fill("#000000");
    }
  })();

  // Her title, in option (none in the original): a detection label in large, steady over the strobe, until its end.
  const title = reelTexts.find((t) => t.role === "hook");
  const titled = title && frame >= title.from && frame < Math.min(title.to, endAt)
    ? h(FitText, { key: "title", style: abs({ left: 80, top: wide ? band.top - 180 : 150, width: W - 220, height: 110 }), innerStyle: { justifyContent: "flex-start" } },
        h("span", { style: { background: NAVY, color: "#ffffff", fontFamily: MONO, fontSize: 72, lineHeight: 1.1, padding: "4px 16px", letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap" } }, title.text))
    : null;
  // Her ending card, in option: on the black at the end, in the labels' type, white.
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h(FitText, { style: abs({ left: 140, top: 700, width: W - 280, height: 240 }), innerStyle: { fontFamily: MONO, fontSize: 96, lineHeight: 1.05, color: "#ffffff", textAlign: "center", textTransform: "uppercase", textWrap: "balance", justifyContent: "flex-end" } }, end.title),
        end.subtitle ? h(FitText, { style: abs({ left: 140, top: 960, width: W - 280, height: 160 }), innerStyle: { fontFamily: MONO, fontSize: 56, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textWrap: "balance", justifyContent: "flex-start" } }, end.subtitle) : null)
    : null;
  const used = [etiq, title];
  const extra = reelTexts.filter((t) => !used.includes(t) && frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: abs({ left: 140, width: W - 280, top: 1200 + i * 110, height: 100 }), innerStyle: { fontFamily: MONO, fontSize: 56, color: "#ffffff", textAlign: "center", textShadow: "0 0 3px #000" } }, t.text));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, body, titled, ending, extra);
}`;

export const vision: MontageSkill = {
  key: "vision",
  version: 1,
  bpm: BPM,
  // Her still subject's anchor (its first images, where it and what it is on are read), then her place with its people.
  shots: [2, 2],
  files: [1, 3],
  how: "Un seul plan fixe de son lieu filmé de haut, quelqu'un d'immobile au milieu et des gens autour, passé dans une dizaine de regards de machine qui se relaient en clignotant, en coupes franches, chacun à un autre moment du plan : la personne immobile seule sur blanc dans ses cadres, puis le lieu qui se construit dalle par dalle autour d'elle ; un cadre sur chaque passant qui clignote entre deux tons de bleu et du noir à points, une étiquette à son mot qui perd ses lettres ; la profondeur en gris, le réseau des passants reliés par des fils, les passants en points, le lieu en caractères clairs sur noir, des noirs ; le graphe sur blanc ; puis le lieu qui s'efface dalle par dalle jusqu'à la personne immobile, en caractères, et le noir.",
  end: true,
  texts: [
    {
      slot: "etiquette",
      role: "caption",
      want: "le mot de toutes les petites étiquettes de détection, en capitales, qui perd ses lettres à chaque image (un décor, on le devine) : le nom de son lieu ou un mot de ce que dit le Reel (une forme comme « LE SALON », « OUVERTURE », « BRUNCH »)",
      max: 16,
      required: true,
    },
    {
      slot: "titre",
      role: "hook",
      want: "facultatif : un titre court qui se lit, posé en grand comme une étiquette de détection, tenu par-dessus les passes (une forme comme « Samedi soir au Salon ») ; vide comme l'original quand rien ne s'impose",
      max: 26,
      required: false,
    },
  ],
  objects: [
    {
      slot: "sujet",
      shot: 0,
      want: "celui ou celle qui ne bouge pas, au milieu du plan, autour de qui les gens passent (« woman sitting at the counter », « man reading on a bench », « customer in the armchair ») : il est l'ancre de toutes les passes",
    },
    {
      slot: "support",
      shot: 0,
      want: "ce sur quoi il est, s'il est assis ou accoudé (« bench », « counter », « armchair », « table ») ; vide sinon",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran comme l'original, ou son plan en largeur dans une bande 16:9 sur le blanc des passes",
      choices: [
        { value: "auto", says: "vertical plein écran, un plan en largeur recadré sur la personne immobile, gardée au milieu" },
        { value: "horizontal", says: "son plan en largeur dans une bande 16:9 au milieu, sur le blanc des passes (les noirs en plein écran)" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
  ],
  // Its original is left as filmed on a grey day: no grade, no grain, no corners (its only colour, the frames' blue).
  finish: { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 },
  fonts: ["VT323"],
  timeline(_n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every image of its passes follows it.
    const bpm = options.bpm ?? BPM;
    const r = BPM / bpm;
    const beat = 60 / bpm;
    const anchor = ANCHOR / FRAMES_A_BEAT;
    const length = LENGTH / FRAMES_A_BEAT + (end ? Math.ceil((CARD_SECONDS / beat) * 4) / 4 : 0);
    const spans = beatSpans(bpm, [anchor, length - anchor]);
    const duration = spans.at(-1)!.end;
    const f = (img: number) => Math.round(img * r);
    return {
      duration,
      shots: spans.map((s, i) => ({
        ...s,
        want:
          i === 0
            ? "le début de son plan fixe de son lieu filmé de haut (la même vidéo que la case 2, juste avant) : on n'en garde que celui ou celle qui ne bouge pas au milieu et ce sur quoi il est, détourés"
            : "son lieu filmé de haut (d'une mezzanine, d'un escalier), le téléphone posé : quelqu'un d'immobile au milieu (au comptoir, dans un fauteuil, à une table) et des gens qui passent autour, près et loin, un sol à carreaux, dalles ou lattes ; la même vidéo que la case 1, juste après, 8 s au moins",
      })),
      // Her word on every label from the first image to its last characters; her title, in option, until the place is erased.
      texts: {
        etiquette: { from: 0, to: round(f(241) / 30) },
        titre: { from: 0, to: round(f(217) / 30) },
      },
      marks: { r: round3(r), erase: toFrame(f(217) / 30), black: f(246), anchor: f(ANCHOR) },
      // Its beep stops two images into the final black, cut dead; with her ending card, faded under it.
      music: end ? { downbeat: round3(0.05 * r), end: { at: duration, fade: 0.5 } } : { downbeat: round3(0.05 * r), end: { at: round3(f(SILENT) / 30) } },
      // Nothing of her is cut out but what its code names (her still subject, what it is on, every person).
      cutouts: [],
    };
  },
  code: CODE,
};
