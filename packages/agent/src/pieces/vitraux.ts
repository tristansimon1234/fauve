import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Le kaléidoscope », the effect (docs/fiches/vitraux.md, effects 2 to 4; its whole Reel is skills/vitraux.ts, version
// 1): over one to three of her still shots filmed straight on (her door, her front, her window, a shelf, a display),
// mirrors laid on her real picture, which invent nothing: from its first images, parallel vertical mirrors open over her
// thing (named by its filler; else her whole picture) and slide all along, so it doubles into narrower copies and
// re-forms in symmetric patterns, the rest of her picture real around it (its « battants », the original's leaves); or a
// round kaleidoscope of eight mirrored wedges that opens from its middle and turns (its « rosace », the original's
// fanlight); over her next shots the mirrors go on, cut on her cuts; then they close back on her real picture, and the
// montage resumes on it. Kept from the model: its force (fast then slower as it opens, slowly then faster as it closes),
// its two slow swells of 8 and 6 beats (never the same twice, never on the beat), its strips joined without a seam (each
// the same window of her picture, one in two mirrored), its wedges, its turn of 11,25 degrees a beat, her name in option
// over the closing, above her thing when there is room. Left out: its format setting (an effect plays in the Reel's own
// frame), its verses (the montage cuts her shots), its ending card (the Reel's own ending is the engine's).


/**
 * Its marks over a span (frames from its start): the mirrors open from its third image and are whole after 2,5 beats
 * (a third of it at most), close over 2,3 beats (a third at most) and leave her real picture its last images (half a
 * beat at most), as the model's; her name from 2,2 s before its end (never before the mirrors are whole), to read.
 */
export function vitrauxTimeline({ frames, bpm }: PieceTimelineInput): PieceTimeline {
  const B = (60 / Math.min(140, Math.max(60, bpm))) * REEL_FPS;
  const D = Math.max(1, Math.round(frames));
  const open = Math.min(2, Math.round(D * 0.05));
  const full = Math.max(open + 1, Math.round(Math.min(2.5 * B, D * 0.3)));
  const real = Math.max(full + 2, D - Math.max(2, Math.min(Math.round(B / 2), Math.round(D * 0.06))));
  const close = Math.max(full + 1, Math.round(real - Math.min(2.3 * B, D * 0.3)));
  const name = Math.max(full, D - Math.round(2.2 * REEL_FPS));
  return { marks: { open_from: open, full, close, real, name, turn: 11.25 } };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const list = shots || [];
  // Its shots: those the engine counts under it, else those playing during it.
  const given = String((texts && texts.mine) || "").split(",").map((x) => Number(x)).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  if (!mine.length) return null;
  const k0 = mine[0];
  const kl = mine[mine.length - 1];
  const cur = mine.reduce((k, i) => (list[i].from <= frame ? i : k), k0);
  const BOX = { left: 0, top: 0, width: W, height: H };
  const BEAT = Math.max(4, mark("beat", 15));
  const OPEN = Math.max(0, mark("open_from", 2));
  const FULL = Math.max(OPEN + 1, mark("full", Math.round(D * 0.3)));
  const CLOSE = Math.max(FULL, mark("close", Math.round(D * 0.62)));
  const REAL = Math.max(CLOSE + 1, mark("real", D - 3));
  const TURN = mark("turn", 11.25);
  const figure = setting("figure", "battants");
  const force = (f) => {
    if (f <= OPEN) return 0;
    if (f < FULL) { const p = (f - OPEN) / (FULL - OPEN); return 1 - Math.pow(1 - p, 3); }
    if (f < CLOSE) return 1;
    if (f < REAL) { const p = (f - CLOSE) / (REAL - CLOSE); return 1 - p * p; }
    return 0;
  };
  const k = force(frame);

  // 1. Her thing on its first shot (« @devanture »), smoothed over seven images; the mirrors inside it (clipped to its
  // outline when it is whole in the picture), her picture real around it; not found, too small, or her whole picture
  // already, and on her next shots: the mirrors take her whole picture.
  const thingIn = (f) => {
    let x = 0, y = 0, w = 0, hh = 0, c = 0;
    for (let d = -3; d <= 3; d++) {
      const b = SubjectBox(list[k0], f + d, BOX, "@devanture");
      if (b && b.w > 0 && b.h > 0) { x += b.x; y += b.y; w += b.w; hh += b.h; c++; }
    }
    return c ? { x: x / c, y: y / c, w: w / c, h: hh / c } : null;
  };
  const zoneOf = (i, f) => {
    if (i === k0) {
      const o = thingIn(f);
      if (o && o.w >= W * 0.3 && o.h >= H * 0.2 && (o.w < W * 0.97 || o.h < H * 0.97)) {
        const x0 = Math.max(0, o.x), x1 = Math.min(W, o.x + o.w), y0 = Math.max(0, o.y), y1 = Math.min(H, o.y + o.h);
        const path = SubjectOutline(list[k0], f, BOX, "@devanture");
        const closed = typeof path === "string" && / Z\s*$/.test(path) && path.split("M").length === 2;
        if (x1 - x0 > 60 && y1 - y0 > 60) return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, path: closed ? path : null };
      }
    }
    return { x: 0, y: 0, w: W, h: H, path: null };
  };
  const copy = (i, transform, origin) => h("div", { style: { position: "absolute", left: 0, top: 0, width: W, height: H, transform, transformOrigin: origin } }, h(Footage, { shot: i, style: BOX }));

  // 2a. Its battants: parallel vertical mirrors over her thing, their spacing (copies of it across: 1 her real picture,
  // 1,8 to 3,4 at full) and their place sliding on two slow swells of 8 and 6 beats; strip j the same window of her
  // picture, straight when even, mirrored when odd: no seam at a mirror line.
  const battants = (i, f, z, s) => {
    const b = f / BEAT;
    const swell = 2.6 + 0.8 * Math.sin((2 * Math.PI * (b - 2.5)) / 8 - Math.PI / 2);
    const drift = 0.2 * Math.sin((2 * Math.PI * (b - 2.5)) / 6 + 0.6);
    const copies = 1 + (swell - 1) * s;
    const P = z.w / copies;
    const off = drift * s * z.w;
    const cx = z.x + z.w / 2;
    const K = Math.ceil(copies / 2 + 0.5);
    const strips = [];
    for (let j = -K; j <= K; j++) {
      const s0 = Math.max(z.x, cx + j * P - P / 2);
      const s1 = Math.min(z.x + z.w, cx + j * P + P / 2);
      if (s1 - s0 < 1) continue;
      const L = Math.floor(s0);
      const R = Math.ceil(s1);
      const move = Math.abs(j) % 2 === 1 ? "translateX(" + (2 * cx + j * P + off).toFixed(2) + "px) scaleX(-1)" : "translateX(" + (j * P - off).toFixed(2) + "px)";
      strips.push(h("div", { key: "b" + j, style: { position: "absolute", left: L, top: Math.floor(z.y), width: R - L, height: Math.ceil(z.h), overflow: "hidden" } },
        h("div", { style: { position: "absolute", left: -L, top: -Math.floor(z.y), width: W, height: H } }, copy(i, move, "0 0"))));
    }
    return h("div", { key: "battants", style: { position: "absolute", left: 0, top: 0, width: W, height: H, ...(z.path ? { clipPath: "path('" + z.path + "')" } : {}) } }, strips);
  };

  // 2b. Its rosace: eight wedges of 45 degrees around her thing's middle, each the same wedge of her picture (x 1,15),
  // mirrored one in two, turning 11,25 degrees a beat, in a circle that opens from its middle and closes back.
  const rosace = (i, f, z, s) => {
    const S = 1.15;
    const cx = z.x + z.w / 2;
    const cy = z.y + z.h / 2;
    const cover = S * Math.min(cx, W - cx, cy, H - cy);
    const R = Math.max(1, Math.min(cover, W / 2, Math.min(z.w, z.h) / 2) * s);
    const t0 = (TURN * f) / BEAT - 22.5;
    const at = (a) => (cx + 1.6 * R * Math.sin((a * Math.PI) / 180)).toFixed(1) + "px " + (cy - 1.6 * R * Math.cos((a * Math.PI) / 180)).toFixed(1) + "px";
    const wedges = [];
    for (let j = 0; j < 8; j++) {
      const a0 = j * 45 - 0.6;
      const a1 = (j + 1) * 45 + 0.6;
      const m = ((j + 1) * 45 + t0) / 2;
      const turn = j % 2 ? "rotate(" + m.toFixed(2) + "deg) scaleX(-1) rotate(" + (-m).toFixed(2) + "deg) scale(" + S + ")" : "rotate(" + (j * 45 - t0).toFixed(2) + "deg) scale(" + S + ")";
      wedges.push(h("div", { key: "r" + j, style: { position: "absolute", left: 0, top: 0, width: W, height: H, clipPath: "polygon(" + cx.toFixed(1) + "px " + cy.toFixed(1) + "px, " + at(a0) + ", " + at((a0 + a1) / 2) + ", " + at(a1) + ")" } },
        copy(i, turn, cx.toFixed(1) + "px " + cy.toFixed(1) + "px")));
    }
    return h("div", { key: "rosace", style: { position: "absolute", left: 0, top: 0, width: W, height: H, clipPath: "circle(" + R.toFixed(1) + "px at " + cx.toFixed(1) + "px " + cy.toFixed(1) + "px)" } }, wedges);
  };

  // Her shot as the montage plays it, under its mirrors (so the layer always holds a picture, and gives it back at its end).
  const real = h(Footage, { key: "real", shot: cur, style: BOX });
  const zone = zoneOf(cur, frame);
  const mirrors = k > 0.002 ? (figure === "rosace" ? rosace(cur, frame, zone, k) : battants(cur, frame, zone, k)) : null;

  // 3. Her name in option, in capitals over the closing: above her thing when there is room, else in the calm part of
  // her last shot, else in its upper part; white with a soft shadow, an ink where her picture is bright.
  const nom = word("nom");
  const NAME = mark("name", Math.max(0, D - 66));
  let name = null;
  if (nom && frame >= NAME) {
    const thing = zoneOf(kl, NAME);
    // Right above it, like a sign on its lintel.
    const room = thing.h < H ? thing.y - 16 - 110 : 0;
    const fallback = { x: 140, y: 150, w: 800, h: 200 };
    const spot = room >= 140 ? { x: 140, y: Math.round(thing.y - 16 - Math.min(150, room)), w: 800, h: Math.round(Math.min(150, room)) } : ClearBox(list[kl], Math.max(NAME, list[kl].from), BOX, { aspect: 4, min: 420, max: 900, prefer: "top", pad: 24, fallback }) || fallback;
    const y = Math.round(within(spot.y, 100, H * 0.75 - 220));
    const tall = Math.round(within(spot.h, 140, 200));
    const light = LightUnder(list[kl], frame, BOX, { x: 140, y, w: 800, h: tall });
    const bright = light && light.mean > 0.6;
    const a = within((frame - NAME) / 9, 0, 1);
    name = h(FitText, { key: "name-" + nom, style: { position: "absolute", left: 140, top: y, width: 800, height: tall, opacity: a, filter: "blur(" + ((1 - a) * 8).toFixed(1) + "px)" },
      innerStyle: { fontFamily: "'" + brand.displayFont + "', 'Inter Tight', sans-serif", fontWeight: 700, fontSize: 140, lineHeight: 1, letterSpacing: "0.03em", textTransform: "uppercase", color: bright ? "#1c1a17" : "#ffffff", textShadow: bright ? "0 2px 18px rgba(255,255,255,0.55)" : "0 3px 22px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.5)", textAlign: "center", textWrap: "balance" } }, nom);
  }
  return h(AbsoluteFill, null, real, mirrors, name);
}`;

export const vitraux: EffectPiece = {
  key: "vitraux",
  version: 1,
  name: "Le kaléidoscope",
  how: "des miroirs posés sur son image, qui n'inventent rien : sur son plan de face, des miroirs verticaux s'ouvrent dès ses premières images et glissent sans arrêt, sa chose se dédouble et se recompose en motifs symétriques, le reste de l'image vrai autour (ou une rosace qui s'ouvre et tourne en son milieu) ; sur ses plans suivants, les miroirs continuent ; puis tout se referme sur sa vraie image et le montage reprend.",
  needs: "un plan fixe et bien de face de sa porte, sa devanture, sa vitrine, une étagère ou un présentoir (ou une photo bien droite), sans personne qui passe devant ; pour la rosace, ce qui est rond ou vu d'en haut (des fleurs, une assiette, un gâteau).",
  lays: "sur un à trois de ses plans fixes de face, de 2,5 à 8 s : sa chose la plus graphique d'abord ; les miroirs s'ouvrent dès sa première image et se referment sur sa dernière, sur sa vraie image",
  shots: [1, 3],
  seconds: [2.5, 8],
  require: { files: 1, shot: { still: true } },
  texts: [
    {
      slot: "nom",
      want: "facultatif : son nom ou ce qu'on voit (« Notre vitrine »), en capitales au-dessus de sa chose quand les miroirs se referment ; deux à quatre mots, seulement quand l'effet a besoin de mots",
      max: 22,
      required: false,
    },
  ],
  objects: [
    {
      slot: "devanture",
      shot: 0,
      want: "la chose graphique de ce plan où se posent les miroirs : sa porte, sa devanture, sa vitrine, une étagère, son présentoir (« front door », « shop front », « shop window », « bookshelf », « display case », « flower display ») ; « none » quand elle remplit déjà presque toute l'image (les miroirs la prennent toute)",
    },
  ],
  settings: [
    {
      name: "figure",
      want: "la figure des miroirs",
      choices: [
        { value: "battants", says: "des miroirs verticaux qui glissent : sa chose reste debout, se dédouble et se recompose, comme les battants de l'original" },
        { value: "rosace", says: "une rosace de huit miroirs au milieu de sa chose, qui s'ouvre, tourne et se referme, comme un vitrail" },
      ],
    },
  ],
  timeline: vitrauxTimeline,
  code: CODE,
};

