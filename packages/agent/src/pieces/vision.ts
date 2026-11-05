import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Vision machine », the effect (docs/fiches/vision.md, effects 3 to 10; its whole Reel is skills/vision.ts): on one
// still shot of her place with people in it, her place seen by a machine, a strobe of clean cuts (a pass every 1 to 8
// images, never a zoom, a fade or a white flash), each pass at its own moment of the shot (her people elsewhere from one
// pass to the next): first her shot as filmed with every person in a box that flickers, image by image and box by box,
// between two tones of blue that keep the picture's light and black with light dots, a small tab above each box with
// her word dropping its letters; then the strobe: her place as filmed, the boxes on white, the grey pass, the network
// (each one in its box as filmed over the grey pass, linked by wires to their nearest and to the farthest), the people in
// dots, the place redrawn in small characters light on black, blacks; on a beat about two fifths in, the graph on white
// (a dot for each one seen, wires, binary codes), then them in their frames on it; a second, tighter strobe; and her
// place redrawn in characters on its last half beat, before the montage goes on. Its two strobes are the original's
// passes image by image (its first from image 36, its second from 136, each held two images where its original's are),
// cut to the span, repeated past their end. An optional title: a detection label in large, steady over the strobe.
// What it keeps of its skill: its passes and their order, its two blues (the table filter #142754 to #C8D6EF), its black
// with light dots, its labels (VT323, her word losing its letters at random at every image), its wires in a web, its
// graph and binary codes, its characters (Ascii), its moments per pass, its holds. What it leaves: her still subject
// alone on white and the tiles of her floor that build and erase (they need her still subject cut out and her floor's
// perspective), the format setting, its ending card. Its depth pass is a grey pass of her shot (her depth is read only on
// a shot written as a number, never on a layer's: subject.ts, depthsDrawn), its people in dots are their boxes in dots
// (no cut-out of everyone needed). Its people: everyone followed in her shot (« @gens », SubjectParts: their boxes on
// the image they were found, laid on the box of them all at every image), else the people the tracker follows (two at
// most, image by image); nobody seen, its boxes give way to the whole picture in blue, its graph to the characters.

/** The first strobe: the original's passes from its image 36, each [images, kind, held two images]. */
export const VISION_STROBE_A: [number, string, boolean?][] = [
  [2, "k"], [1, "n"], [2, "v", true], [4, "c", true], [2, "W", true], [2, "o", true], [4, "v", true], [3, "k"], [3, "z"], [4, "k"], [5, "z"], [1, "P"],
  [1, "n"], [7, "P"], [2, "k"], [1, "v"], [2, "b"], [1, "n"], [7, "c"], [8, "b"], [1, "k"], [5, "v"], [5, "k"],
];
/** The second, tighter: the original's passes from its image 136 (its passes of two images when its beep doubles, held two images each). */
export const VISION_STROBE_B: [number, string, boolean?][] = [
  [4, "b"], [6, "n"], [5, "P"], [3, "k"], [7, "c"], [3, "b"], [2, "v", true], [4, "t", true], [2, "c", true], [2, "n", true], [2, "o", true], [2, "t", true],
  [2, "c", true], [2, "n", true], [1, "P"], [3, "k"], [10, "P"], [2, "g"], [2, "k"], [1, "o"], [5, "P"], [4, "o"], [4, "v"], [3, "o"],
];

/**
 * Its marks for a span (frames from its start): its opening (her shot as filmed, her people boxed), its graph on a beat
 * about two fifths in (a beat long, half a beat on a short span) and its people on it, its second strobe, its closing in
 * characters (its last half beat).
 */
export function visionTimeline({ frames, bpm }: PieceTimelineInput): PieceTimeline {
  const beat = 1800 / Math.min(140, Math.max(60, bpm));
  const half = Math.round(beat / 2);
  const open = Math.max(4, Math.min(half, Math.round(frames * 0.12)));
  const close = Math.max(open + 8, frames - Math.max(6, half));
  const room = close - open;
  const length = room >= 3 * beat ? Math.round(beat) : Math.max(6, Math.round(beat / 2));
  const onBeat = Math.round(Math.round((open + room * 0.42) / beat) * beat);
  const graph = Math.max(open + Math.min(Math.round(beat * 0.75), Math.round(room / 4)), Math.min(close - length, onBeat));
  const people = graph + Math.min(8, Math.round(length / 3));
  return { marks: { open, graph, people, after: Math.min(close, graph + length), close } };
}

const CODE =
  String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  // Its shots: those that play during it; the one playing now is its place.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return h(AbsoluteFill, { style: { pointerEvents: "none" } });
  const cur = mine.reduce((k, i) => (shots[i].from <= frame ? i : k), mine[0]);
  const place = shots[cur];
  const BEAT = mark("beat", 18);
  const OPEN = mark("open", Math.round(BEAT / 2));
  const CLOSE = Math.max(OPEN + 1, mark("close", durationInFrames - Math.round(BEAT / 2)));
  const GRAPH = Math.max(OPEN, Math.min(CLOSE, mark("graph", Math.round(OPEN + (CLOSE - OPEN) * 0.42))));
  const PEOPLE = Math.max(GRAPH, Math.min(CLOSE, mark("people", GRAPH + 8)));
  const AFTER = Math.max(PEOPLE, Math.min(CLOSE, mark("after", GRAPH + Math.round(BEAT))));
  const rnd = (s) => random("vis" + s);

  // Its pass now: the opening, its first strobe, the graph and its people, its second strobe, its closing.
  const A = ` +
  JSON.stringify(VISION_STROBE_A) +
  String.raw`;
  const B = ` +
  JSON.stringify(VISION_STROBE_B) +
  String.raw`;
  const run = (list, from, to, seed) => {
    let at = from;
    for (let i = 0; at < to; i++) {
      const p = list[i % list.length];
      const end = Math.min(to, at + p[0]);
      if (frame < end) return { kind: p[1], P0: at, P1: end, id: seed + i, hold: p[2] ? 2 : 1 };
      at = end;
    }
    return { kind: "k", P0: from, P1: to, id: seed, hold: 1 };
  };
  const pass = frame < OPEN ? { kind: "c", P0: 0, P1: OPEN, id: "open", hold: 1, own: true }
    : frame < GRAPH ? run(A, OPEN, GRAPH, "a")
    : frame < PEOPLE ? { kind: "g", P0: GRAPH, P1: PEOPLE, id: "g", hold: 1 }
    : frame < AFTER ? { kind: "G", P0: PEOPLE, P1: AFTER, id: "G", hold: 1 }
    : frame < CLOSE ? run(B, AFTER, CLOSE, "b")
    : { kind: "P", P0: CLOSE, P1: durationInFrames, id: "close", hold: 1, own: true };
  const t = frame - pass.P0;

  // Each pass at its own moment of her place (her people elsewhere from one pass to the next); her opening and her
  // closing at the shot's own moment, so it leaves and takes back the montage seamlessly.
  const n1 = Math.max(1, place.durationInFrames);
  const off = Math.floor(rnd(pass.id + "off") * Math.max(1, n1 - (pass.P1 - pass.P0) - 1));
  const AT = pass.own ? undefined : pass.P0 - off;
  const shown = pass.own ? frame - place.from : pass.hold > 1 ? Math.floor((off + t) / 2) * 2 : off + t;
  const RF = place.from + shown;
  const laid = { left: 0, top: 0, width: W, height: H };
  const L = { position: "absolute", left: 0, top: 0, width: W, height: H };
  const abs = (s) => ({ position: "absolute", ...s });
  const foot = (style) => h(Footage, { shot: cur, ...(AT !== undefined ? { at: AT } : {}), ...(pass.hold > 1 ? { hold: 2 } : {}), style: { ...L, ...style } });

  // Who is seen: everyone followed in her place (their boxes at this moment), with the people the tracker follows there
  // (image by image), each once; boxes padded a little, inside the picture.
  const pad = (b) => ({ x: b.x - 5, y: b.y - 5, w: b.w + 10, h: b.h + 10 });
  const followed = SubjectParts(place, RF, laid, "@gens");
  const bodies = typeof track === "function" ? ((track(RF, { shot: cur, ...laid }) || {}).bodies || []).flatMap((b) => {
    const p = Object.values(b.points || {}).filter((q) => q && q.visible);
    if (p.length < 4) return [];
    const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
    const x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    return [{ x: x0 - 6, y: y0 - 24, w: Math.max.apply(null, xs) - x0 + 12, h: Math.max.apply(null, ys) - y0 + 34 }];
  }) : [];
  const overlap = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), hh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && hh > 0 ? (w * hh) / Math.min(a.w * a.h, b.w * b.h) : 0;
  };
  const boxes = bodies.concat(followed.filter((f) => !bodies.some((b) => overlap(f, b) > 0.5))).map(pad)
    .filter((b) => b.w > 8 && b.h > 8 && b.w < W * 0.8 && b.h < H * 0.8 && b.x < W && b.y < H && b.x + b.w > 0 && b.y + b.h > 0).slice(0, 24);
  const seen = boxes.length > 0;

  // Its labels: her word on a small tab above each box's corner, letters dropped at random at every image (a decor).
  const word0 = (word("etiquette") || String(brand.name || "")).toUpperCase();
  const MONO = "'VT323', 'IBM Plex Mono', monospace";
  const drop = (i) => Array.from(word0).map((c, j) => (rnd(frame * 7919 + i * 131 + j + "l") < 0.3 ? [" ", "·", "?", "<", ">", "/"][Math.floor(rnd(frame * 7919 + i * 131 + j + "k") * 6)] : c)).join("");
  const tags = (bg, list) => h("div", { key: "tags", "data-fauve-decor": "" }, (list || boxes).map((b, i) =>
    h("div", { key: "t" + i, style: abs({ left: Math.round(b.x), top: Math.round(b.y) - 18, height: 18, padding: "0 4px", background: bg, color: "#ffffff", fontFamily: MONO, fontSize: 18, lineHeight: "18px", whiteSpace: "pre" }) }, drop(i))));
  const stroke = (color, w) => boxes.map((b, i) => h("div", { key: "s" + i, style: abs({ left: Math.round(b.x), top: Math.round(b.y), width: Math.round(b.w), height: Math.round(b.h), boxShadow: "inset 0 0 0 " + w + "px " + color }) }));
  const clip = (bs) => (bs.length ? "path('" + bs.map((b) => "M" + Math.round(b.x) + " " + Math.round(b.y) + "h" + Math.round(b.w) + "v" + Math.round(b.h) + "h" + -Math.round(b.w) + "Z").join(" ") + "')" : "inset(100%)");
  // Two tones of blue that keep the picture's light (black #142754 to white #C8D6EF), one id per copy of the scene.
  const ID = "vm" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const BLUE = h("svg", { key: "blue", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" }, h("filter", { id: ID, colorInterpolationFilters: "sRGB" },
    h("feColorMatrix", { type: "matrix", values: "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" }),
    h("feComponentTransfer", null, h("feFuncR", { type: "table", tableValues: "0.078 0.278 0.667 0.784" }), h("feFuncG", { type: "table", tableValues: "0.153 0.361 0.737 0.839" }), h("feFuncB", { type: "table", tableValues: "0.329 0.533 0.867 0.937" }))));
  const blued = (kids, key) => h("div", { key, style: abs({ left: 0, top: 0, width: W, height: H, filter: "url(#" + ID + ")" }) }, kids);
  const dots = (kid, ink, paper) => h(Ascii, { cell: [4, 8], kind: "dots", ink, paper }, kid);
  const WHITE = "#fdfdfd";
  const fill = (c, ...kids) => h("div", { style: abs({ left: 0, top: 0, width: W, height: H, background: c, overflow: "hidden" }) }, ...kids);
  // Her place's grey pass, a machine's view of it as its depth would be (soft and grey, black far up the frame, white
  // near); under the network, its blacks lifted and its people still to be made out.
  const grey = (lift) => h(React.Fragment, { key: "grey" },
    foot({ filter: lift ? "grayscale(1) contrast(0.62) brightness(1.35) blur(3px)" : "grayscale(1) contrast(0.5) brightness(1.6) blur(7px)" }),
    h("div", { style: abs({ left: 0, top: 0, width: W, height: H, background: lift ? "linear-gradient(to bottom, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.38) 48%, rgba(255,255,255,0.12) 100%)" : "linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.62) 38%, rgba(0,0,0,0.12) 72%, rgba(255,255,255,0.3) 100%)" }) }));

  // Each one's box as seen at every image: two blues, or black with light dots, chosen box by box.
  const flicker = (onWhite) => {
    const blue = boxes.filter((b, i) => rnd(frame * 131 + i + "c") < 0.55), dark = boxes.filter((b) => !blue.includes(b));
    return h(React.Fragment, { key: "boxes" }, BLUE,
      blue.length ? h("div", { key: "bl", style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(blue) }) }, blued(foot({}), "b")) : null,
      dark.length ? h("div", { key: "dk", style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(dark), background: "#07070e" }) }, dots(foot({ filter: "grayscale(1) contrast(1.2)" }), "#e9ecf2", "none")) : null,
      onWhite ? stroke("#a0a0a0", 2) : null,
      tags("#243250"));
  };
  // The graph: a dot for each one seen, wires to their two nearest and to the farthest (up the frame), binary codes.
  const nodes = boxes.map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h * 0.45 }));
  const far = nodes.map((p, i) => i).sort((a, b) => nodes[a].y - nodes[b].y).slice(0, 2);
  const wires = (color) => h("svg", { key: "wires", width: W, height: H, style: abs({ left: 0, top: 0 }) }, nodes.flatMap((a, i) => {
    const near = nodes.map((b, j) => j).filter((j) => j !== i).sort((x, y) => Math.hypot(nodes[x].x - a.x, nodes[x].y - a.y) - Math.hypot(nodes[y].x - a.x, nodes[y].y - a.y)).slice(0, 2).concat(far.filter((j) => j !== i));
    return near.map((j, k) => { const b = nodes[j], sag = 40 + rnd(i * 97 + j + "w") * 80; return h("path", { key: i + "-" + k, d: "M" + Math.round(a.x) + " " + Math.round(a.y) + " Q" + Math.round((a.x + b.x) / 2) + " " + Math.round((a.y + b.y) / 2 + sag) + " " + Math.round(b.x) + " " + Math.round(b.y), fill: "none", stroke: color, strokeWidth: rnd(i * 13 + k + "ww") < 0.15 ? 3 : 1.5 }); });
  }));
  const bits = (i) => [16, 8, 8, 8].map((m, g) => Array.from({ length: m }, (_, k) => (rnd(k + i * 41 + g * 997 + "b") < 0.5 ? 0 : 1)).join("")).join(" ");
  const graph = (withThem) => fill("#fbfdfa",
    withThem ? h("div", { key: "them", style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(boxes) }) }, foot({})) : null,
    wires("#c8c9c6"),
    withThem ? stroke("#111111", 3) : null,
    withThem ? tags("#000000") : null,
    h("svg", { key: "dots", width: W, height: H, style: abs({ left: 0, top: 0 }) }, nodes.map((p, i) => h("circle", { key: i, cx: Math.round(p.x), cy: Math.round(p.y), r: 6, fill: "#2f302e" }))),
    h("div", { key: "bits", "data-fauve-decor": "" }, nodes.slice(0, 6).map((p, i) => (i % 2 ? null : h("div", { key: i, style: abs({ left: Math.round(Math.min(W - 400, p.x + 16)), top: Math.round(p.y - 9), fontFamily: MONO, fontSize: 18, color: "#2f302e", whiteSpace: "nowrap" }) }, bits(i))))));
  // Her place redrawn in small characters by its light, light on black.
  const chars = () => fill("#000000", h(Ascii, { cell: [4, 8], ink: "#e6e6e6", paper: "#000000" }, foot({})));

  // The passes. k black; v her place as filmed; c a box on everyone, as filmed around them; b their boxes on white;
  // z the grey pass; n the network; g the graph, G with them in their frames; o them in dots on white; W them on white
  // as filmed; t the two at every image (her place, them on white: the original's tiles in two states); P her place in
  // characters. Nobody seen: the whole picture in blue, her place as filmed, or the characters.
  const two = pass.kind === "t" ? (t % 2 ? "v" : "W") : pass.kind;
  const kind = !seen && /[cbW]/.test(two) ? (pass.kind === "t" ? "v" : "u") : !seen && /[gGo]/.test(two) ? "P" : two;
  const body = (() => {
    switch (kind) {
      case "k": return fill("#000000");
      case "v": return fill("#000000", foot({}));
      case "u": return fill("#000000", BLUE, blued(foot({}), "u"));
      case "c": return fill("#000000", foot({}), flicker(false));
      case "b": return fill(WHITE, flicker(true));
      case "z": return fill("#000000", grey(false));
      case "n": return fill("#000000", grey(true), wires("#c8c8c8"), h("div", { key: "them", style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(boxes) }) }, foot({})), stroke("#000000", 3), tags("#000000"));
      case "g": return graph(false);
      case "G": return graph(true);
      case "o": return fill("#fbfdfa", dots(h("div", { style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(boxes) }) }, foot({ filter: "grayscale(1) contrast(0.7) brightness(1.5)" })), "#26262a", "#fbfdfa"));
      case "W": return fill(WHITE, h("div", { key: "them", style: abs({ left: 0, top: 0, width: W, height: H, clipPath: clip(boxes) }) }, foot({})), stroke("#a0a0a0", 2), tags("#243250"));
      default: return chars();
    }
  })();

  // Her title, in option (none in the original): a detection label in large, steady over the strobe.
  const title = word("titre");
  const titled = title
    ? h(FitText, { key: "title", style: abs({ left: 140, top: 160, width: W - 280, height: 110 }), innerStyle: { justifyContent: "flex-start", alignItems: "flex-start" } },
        h("span", { style: { background: "#243250", color: "#ffffff", fontFamily: MONO, fontSize: 96, lineHeight: 1.05, padding: "2px 18px", letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap" } }, title))
    : null;
  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, body, titled);
}`;

export const vision: EffectPiece = {
  key: "vision",
  version: 1,
  name: "Vision machine",
  how: "son lieu vu par une machine, en coupes franches qui clignotent : chaque personne dans un cadre qui passe d'un bleu à deux tons au noir à points, une petite étiquette à son mot qui perd ses lettres ; puis son lieu tel quel, les cadres sur blanc, une passe grise, le réseau (chacun dans son cadre, relié aux autres par des fils), les gens en points, des noirs ; sur un temps, le graphe sur blanc (un point par personne, des fils, des codes binaires), puis eux dans leurs cadres ; un second clignotement plus serré, et son lieu redessiné en caractères clairs sur noir avant que le montage reprenne.",
  needs: "un plan fixe de son lieu avec du monde (une salle, sa terrasse, son marché, une rue devant chez elle), filmé de haut de préférence, téléphone posé : des gens qui passent et d'autres qui bougent peu (attablés, qui flânent, qui attendent).",
  lays: "sur un seul de ses plans, ce plan fixe avec du monde, coupé de 5 à 8 temps",
  shots: [1, 1],
  seconds: [2, 5],
  require: { files: 1, shot: { framing: ["wide", "medium"], still: true, person: true, video: true } },
  texts: [
    {
      slot: "etiquette",
      want: "le mot de toutes les petites étiquettes des cadres, en capitales, qui perd ses lettres à chaque image (un décor, on le devine) : le nom de son lieu ou un mot de ce que dit le Reel (une forme comme « LE SALON », « OUVERTURE », « BRUNCH »)",
      max: 14,
      required: true,
    },
    {
      slot: "titre",
      want: "facultatif : un titre court qui se lit, posé en grand comme une étiquette de détection, tenu par-dessus les passes (une forme comme « Samedi au marché ») ; vide quand rien ne s'impose",
      max: 22,
      required: false,
    },
  ],
  objects: [
    {
      slot: "gens",
      shot: 0,
      want: "les personnes qu'on voit dans ce plan, chacune dans son cadre : « every person » (ou « every customer », « every shopper » quand c'est plus juste) ; « none » quand il n'y a personne",
    },
  ],
  timeline: visionTimeline,
  code: CODE,
  fonts: ["VT323"],
};
