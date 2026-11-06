import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Création à quatre mains », the effect (docs/fiches/en-boutique.md, effect 2; its whole Reel is skills/en-boutique.ts,
// version 1): « Titre en autocollant », over one or two shots of someone at her counter or her post, the name of what is
// made (the creation of the day, an event, a collab) pops at once as a comic-strip sticker, with a pop and its little
// sting, bounces, holds two seconds and pops off with a whoosh; then the montage goes on. Kept from the model: the white
// card 800 px wide (x 140 to 940), tilted 5,5° rising to the right, its thick black edges and the black block under its
// lower left (its 3D: 18 px out to the left, 21 below), two thin white strokes of shine across that block under its
// lower right; its name in capitals of a heavy rounded face (Paytone
// One) on two lines, never a first line ending on a small word, in her colour when it is bright and vivid enough, else
// the original's yellow, a black shadow down-left; who makes it under it in black capitals of 48 px; its pop (0,55
// blurred, then 1,04, 1,08, 1,03, 1) and its exit (0,75, then 0,42), never a fade; 31 images into the shot as the
// original when there is room, 66 images up. Its place: on her chest or her counter, under her face as the engine
// follows it over its two seconds (`track(frame, box).faces`), above it when her face is low, smaller when neither leaves
// room; half the height without a face (the original's 60 %, raised to keep off a voice's subtitles, which a bank effect
// cannot move). Left out: the model's subtitles of two voices, its deep boom, its bass drop and its logo at the end (the
// montage's), its format setting (the montage frames her shot).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const list = shots || [];
  const mine = list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const POP = Math.round(Math.max(0, Math.min(D - 2, mark("pop", Math.min(31, D * 0.26)))));
  const OUT = Math.round(Math.max(POP + 2, Math.min(D, mark("out", POP + 66))));
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");

  // 1. Its colours: the name in her colour when it is bright and vivid enough to pop on white with its black shadow,
  // else the original's yellow.
  const rgb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return null; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const luma = (c) => { const x = rgb(c); return x ? (0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]) / 255 : -1; };
  const vivid = (c) => { const x = rgb(c); if (!x) return 0; const a = Math.max(x[0], x[1], x[2]); return a ? (a - Math.min(x[0], x[1], x[2])) / a : 0; };
  const INK = luma(brand.accent) >= 0.28 && luma(brand.accent) <= 0.86 && vivid(brand.accent) >= 0.45 ? brand.accent : "#fcc83b";
  const STICKER = "'Paytone One', '" + brand.displayFont + "', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Figtree', sans-serif";

  // 2. Its words: the name on two lines (never a first line ending on « du », « de », « la »…), who makes it under it.
  const LIGHT = new Set("le la les l un une des du de d au aux à a en et ou que qu qui ce ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs sur sous dans par pour avec sans chez".split(" "));
  const light = (w) => /['’]$/.test(w) || LIGHT.has(w.toLowerCase().replace(/^.*['’]/, "").replace(/[^\p{L}\p{N}]/gu, ""));
  const splitName = (s) => {
    const words = String(s).trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return [words.join(" ")];
    let best = null;
    for (let i = 1; i < words.length; i++) {
      if (light(words[i - 1])) continue;
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const score = Math.max(a.length, b.length);
      if (!best || score < best.score) best = { lines: [a, b], score };
    }
    return best ? best.lines : [words.join(" ")];
  };
  const title = word("titre");
  const line = word("avec");

  // 3. Its place: under her face as the engine follows it over its two seconds, on her chest or her counter; above it
  // when her face is low; smaller where there is more room when neither leaves enough; its middle at half the height
  // without a face. Always above the row of a voice's subtitles (64 % of the height), its tilt, its block and its bounce
  // included, and under the top of the frame.
  const SW = W - 280;
  const tall = Math.round(H * (line ? 0.19 : 0.15));
  const TILT = (5.5 * Math.PI) / 180;
  const up = (SW / 2) * Math.sin(TILT) + (tall / 2) * Math.cos(TILT);
  const down = (SW / 2 + 18) * Math.sin(TILT) + (tall / 2 + 21) * Math.cos(TILT);
  const ROW = H * 0.64 - 8;
  const TOP = 90;
  const spot = React.useMemo(() => {
    const most = ROW - down * 1.08;
    const base = { cy: Math.round(Math.min(H * 0.5, most)), k: 1 };
    if (typeof track !== "function") return base;
    const ys = [];
    const hs = [];
    for (let f = POP; f < OUT; f += 6) {
      const k = mine.find((i) => list[i].from <= f && list[i].from + list[i].durationInFrames > f);
      if (k === undefined) continue;
      const seen = track(f, { shot: k, left: 0, top: 0, width: W, height: H }) || {};
      const fs = (seen.faces || []).filter((q) => q && q.height > 0 && Number.isFinite(q.y));
      if (!fs.length) continue;
      const q = fs.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
      ys.push(q.y);
      hs.push(q.height);
    }
    if (!ys.length) return base;
    const mid = (a) => a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)];
    const chin = mid(ys) + mid(hs) * 0.62 + 30;
    const brow = mid(ys) - mid(hs) * 0.62 - 30;
    if (chin + up <= most) return { cy: Math.round(Math.max(base.cy, chin + up)), k: 1 };
    if (brow - down >= TOP + up * 1.08) return { cy: Math.round(Math.min(base.cy, brow - down)), k: 1 };
    const kb = (ROW - chin) / (up + down * 1.08);
    const ka = (brow - TOP) / (down + up * 1.08);
    const k = Math.round(Math.max(0.45, Math.min(1, Math.max(kb, ka))) * 1000) / 1000;
    return kb >= ka ? { cy: Math.round(chin + up * k), k } : { cy: Math.round(brow - down * k), k };
  }, [track, POP, OUT, tall]);
  const cy = spot.cy;

  // 4. The sticker: pops in with a bounce and a blur, holds, pops off the same way, never fading.
  const t = frame - POP;
  const u = OUT - frame;
  const at = !title || t < 0 || u <= 0 ? null : u === 1 ? { s: 0.42, b: 6 } : u === 2 ? { s: 0.75, b: 4 } : t === 0 ? { s: 0.55, b: 7 } : t === 1 ? { s: 1.04, b: 3 } : t === 2 ? { s: 1.08, b: 0 } : t === 3 ? { s: 1.03, b: 0 } : { s: 1, b: 0 };
  const EXTRUDE = Array.from({ length: 8 }, (_, q) => "-" + Math.round((q + 1) * 0.9) + "px " + (q + 1) + "px 0 #141414").join(", ");
  const card = at
    ? h("div", { key: "sticker", style: { position: "absolute", left: 140, top: Math.round(cy - tall / 2), width: SW, height: tall, transform: "rotate(-5.5deg) scale(" + Math.round(at.s * spot.k * 1000) / 1000 + ")", filter: at.b ? "blur(" + at.b + "px)" : "none" } },
        h("div", { style: { position: "absolute", left: -18, top: 21, width: SW, height: tall, borderRadius: 16, backgroundColor: "#141414" } }),
        h("div", { style: { position: "absolute", left: 0, top: 0, width: SW, height: tall, borderRadius: 16, backgroundColor: "#ffffff", border: "9px solid #141414", boxSizing: "border-box" } }),
        h("svg", { "data-fauve-decor": "", width: 46, height: 32, viewBox: "0 0 46 32", style: { position: "absolute", left: SW - 104, top: tall + 2 } },
          h("path", { d: "M5 27 L22 5 M20 27 L37 5", stroke: "#ffffff", strokeWidth: 3, strokeLinecap: "round" })),
        h(FitText, { key: "n-" + title, style: { position: "absolute", left: 40, top: 26, width: SW - 80, height: Math.round(tall * (line ? 0.66 : 0.8)) }, innerStyle: { fontFamily: STICKER, fontWeight: 400, fontSize: 124, lineHeight: 0.98, letterSpacing: "0.01em", textTransform: "uppercase", color: INK, textShadow: EXTRUDE, textAlign: "center" } },
          splitName(keep(title)).map((l, i) => h("div", { key: i, style: { whiteSpace: "nowrap" } }, l))),
        line ? h(FitText, { key: "l-" + line, style: { position: "absolute", left: 40, top: Math.round(tall * 0.72), width: SW - 80, height: 62 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 48, lineHeight: 1.1, letterSpacing: "0.05em", textTransform: "uppercase", color: "#141414", whiteSpace: "nowrap", textAlign: "center" } }, keep(line)) : null)
    : null;
  // Before its pop and after its exit, its words stay in the page, hidden: the scene check finds them whole.
  const hidden = { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1, whiteSpace: "pre" };
  const rest = !card && title ? h("span", { key: "rest", style: hidden }, keep(title) + (line ? "\n" + keep(line) : "")) : null;
  return h(AbsoluteFill, null, card, rest);
}`;

/** Its moments, frames from its start: the pop (the original's 31 images into the shot when there is room), its exit 66 images later at most. */
export function stickerMoments(frames: number): { pop: number; out: number } {
  const pop = Math.round(Math.max(0, Math.min(frames - 2, Math.min(31, frames * 0.26))));
  return { pop, out: Math.max(pop + 2, Math.min(frames, pop + 66)) };
}

export const enBoutique: EffectPiece = {
  key: "en-boutique",
  version: 1,
  name: "Titre en autocollant",
  how: "le nom de ce qu'on fait (la création du jour, un événement, une collab) qui surgit d'un coup en autocollant de bande dessinée sur la personne à son comptoir : une carte blanche penchée bordée de noir, le nom en capitales jaunes (ou à sa couleur) à l'ombre noire, qui le fait dessous en petites capitales ; un pop, un rebond, deux secondes, puis il repart d'un coup avec un souffle ; puis le montage reprend.",
  needs: "un plan de quelqu'un derrière son comptoir ou à son poste, face caméra, son visage en haut de l'image (la carte se pose sur sa poitrine ou le comptoir).",
  lays: "sur un ou deux plans de la personne à son comptoir, quand elle sourit ou se présente, plutôt tôt dans le Reel",
  shots: [1, 2],
  seconds: [2, 4],
  require: { files: 1, shot: { person: true } },
  texts: [
    {
      slot: "titre",
      want: "le nom de ce qu'on fait, dans l'autocollant : deux ou trois mots qui le nomment (une forme comme « Pizza du marché », « Bouquet surprise », « Latte de saison », « Soirée vinyles »), jamais une phrase",
      max: 22,
      required: true,
    },
    {
      slot: "avec",
      want: "facultatif : la petite ligne sous le nom, qui le fait : « avec » et leurs prénoms (« avec Léa & Marco »), sinon « chez » et le nom de son commerce ; seulement des prénoms ou un nom donnés, jamais inventés",
      max: 22,
      required: false,
    },
  ],
  timeline(input: PieceTimelineInput) {
    const { pop, out } = stickerMoments(input.frames);
    return {
      marks: { pop, out },
      // A cartoon pop and its little sting as it lands, a soft whoosh as it goes (the original's own, on its side channel).
      sounds: [
        { at: pop / 30, sound: "cartoon pop with a bright comic sting", seconds: 1, gain: 0 },
        ...(out - pop >= 20 ? [{ at: Math.max(0, out - 2) / 30, sound: "quick soft whoosh", seconds: 0.5, gain: -6 }] : []),
      ],
    };
  },
  code: CODE,
  fonts: ["Paytone One"],
};
