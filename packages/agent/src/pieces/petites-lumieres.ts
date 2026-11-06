import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Petites lumières », the effect (docs/fiches/petites-lumieres.md, effects 1, 2 and 5; its whole Reel is
// skills/petites-lumieres.ts, version 3): over one or two still shots of her place, only her lights move, on the beat.
// On its first shot, her light (a lamp, a lantern, her sign, a neon: named by its filler) is dimmed off, lit four images on
// its first beat, off while the music stops for a beat (or two), then three blinks of four images (two off between) as it
// comes back, and held lit to the end of its shot; on its second, her windows (« every window », or what she has several
// of that can light) fill with her colour in six waves from the bottom, lit to its end. Kept from its skill: the light's
// look (its own picture brighter, a glow of its highlights when it already shines in her picture, a lamp's warm light in
// its shape and a halo when it is off there; nothing named: her own highlights bloom on the same beats), its blinks'
// four images on and two off, its waves' offsets after the cut and their order (the lowest first; a window already lit in
// her picture flashed and brightened, never covered), the original's red
// (or a window's warm light, or her colour), and her name lit like a neon, the last light. Its music stopped dead after
// the opening flash and back on a whole beat of the Reel with the blinks, as its skill's (its first stop). Left out: its
// sun behind her roofs (her sky is not always under it), its last shot's column going off, its 16:9 band (an effect
// plays in the Reel's own frame), its ending card.

/** Its waves after its second shot's cut (beats): its skill's (three close ones, two, one), squeezed into a shorter shot. */
const WAVES = [0.092, 0.277, 0.553, 1.383, 1.568, 2.582];
/** A blink: four images on, two off (the original's, every six images). */
const BLINK = 4;
const EVERY = 6;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Its marks over a span (frames from its start): its light's spans on its first shot (the flash on its first beat, the
 * three blinks just before the music comes back on a whole beat, two beats later when there is room, else one, then held
 * to its shot's cut), its second shot's waves, her name's moment; the music's stop between the flash and the blinks.
 */
export function petitesLumieresTimeline({ frames, bpm, shots }: PieceTimelineInput): PieceTimeline {
  const B = (60 / bpm) * REEL_FPS;
  const first = shots[0] ?? { from: 0, frames };
  const endA = Math.max(2, Math.min(frames, first.from + first.frames));
  // Its beats counted from its first shot's cut (which falls on one): the first at its start or after.
  const b0 = Math.max(0, first.from + Math.ceil(-first.from / B - 1e-6) * B);
  // The music back two beats after it, or one, as long as the blinks and a little of its held light fit before the cut.
  const back = [2, 1].map((k) => b0 + k * B).find((f) => f + 3 * EVERY + 8 <= endA);
  const s = back !== undefined ? Math.round(back - 0.1 * B) : Math.max(b0 + BLINK + 2, Math.round(endA * 0.35));
  const raw: [number, number][] = [
    [b0 + 1, b0 + 1 + BLINK],
    ...[0, 1, 2].map((k): [number, number] => [s + k * EVERY, s + k * EVERY + BLINK]),
    [s + 3 * EVERY, endA],
  ];
  const spans = raw
    .map(([a, b]): [number, number] => [Math.round(Math.min(a, endA - 1)), Math.round(Math.min(b, endA))])
    .filter(([a, b], k, all) => b > a && (k === 0 || a >= all[k - 1]![1]));
  const marks: Record<string, number> = {};
  spans.forEach(([a, b], k) => {
    marks[`lamp_${k}_on`] = a;
    marks[`lamp_${k}_off`] = b;
  });
  // Its second shot's waves, at its skill's offsets after the cut, squeezed into the shot when it is shorter.
  const second = shots[1];
  if (second) {
    const from = Math.max(0, second.from);
    const end = Math.min(frames, second.from + second.frames);
    const squeeze = Math.min(1, Math.max(0, end - from - 2) / (WAVES[WAVES.length - 1]! * B));
    WAVES.forEach((b, k) => (marks[`wave_${k}`] = Math.round(Math.min(end - 1, from + b * B * squeeze))));
  }
  // Her name lit with its last shot's first light that holds: its first wave, else its held light.
  marks.name = second ? marks.wave_0! : (spans.at(-1)?.[0] ?? 0);
  // The music stops dead after the flash, back with the blinks on a whole beat of the Reel.
  const stop = b0 + Math.round(0.44 * B);
  const music = back !== undefined && back - stop >= 6 ? { pauses: [{ from: round3(stop / REEL_FPS), to: round3(back / REEL_FPS) }] } : undefined;
  return { marks, ...(music ? { music } : {}) };
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
  const list = shots || [];
  // Its shots: those the engine counts under it, else those playing during it.
  const given = String((texts && texts.mine) || "").split(",").map((x) => Number(x)).filter((i) => Number.isInteger(i) && i >= 0 && i < list.length);
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  if (!mine.length) return null;
  const k0 = mine[0];
  const k1 = mine.length > 1 ? mine[1] : -1;
  const kl = mine[mine.length - 1];
  const cur = mine.reduce((k, i) => (list[i].from <= frame ? i : k), k0);
  const BOX = { left: 0, top: 0, width: W, height: H };
  const full = { position: "absolute", left: 0, top: 0, width: W, height: H };

  // Its colours: the original's red, a window's warm light, or hers when vivid enough to shine.
  const vivid = (c) => {
    const x = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
    if (!x) return null;
    const v = parseInt(x[1], 16);
    const rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    const l = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    return l > 0.08 && l < 0.85 && Math.max(...rgb) - Math.min(...rgb) > 60 ? rgb : null;
  };
  const mode = setting("couleur", "rouge");
  const hers = mode === "sienne" ? vivid(brand.accent) : null;
  const warm = mode === "chaude";
  const WIN = hers ? "rgb(" + hers.join(",") + ")" : warm ? "#ffc56e" : "#b4201a";
  const GLOW = hers || (warm ? [255, 176, 92] : [255, 42, 36]);
  const TUBE = hers ? "rgb(" + hers.map((c) => Math.round(c + (255 - c) * 0.72)).join(",") + ")" : warm ? "#fff3df" : "#ffe1dc";
  // Her shot as the montage plays it, under its lights (so the layer always holds a picture, even with nothing to light).
  const layers = [h(Footage, { key: "film", shot: cur, style: full })];
  // What already shines in her picture, bloomed (nothing named to light): only when something does shine there (its
  // brightest tenth well above its mean); a grey front, a dull room: nothing.
  const shines = (k) => { const l = LightUnder(list[k], frame, BOX, null); return !l || (l.high > 0.55 && l.high > l.mean + 0.2); };
  const bloom = (k, a) => (shines(k) ? h("div", { key: "bloom", style: { ...full, mixBlendMode: "screen", opacity: a, filter: "brightness(1.15) contrast(2.4) blur(" + Math.max(6, Math.round(H * 0.012)) + "px)" } }, h(Footage, { shot: k, style: full })) : null);

  // 1. Its first shot: her light dimmed off, lit on its spans (its first beat, three blinks, held). Lit: its own picture
  // brighter, a glow of its highlights when it already shines in her picture, else a lamp's warm light in its shape,
  // strongest in its middle, and a halo; nothing named or found: her own highlights bloom on the same beats.
  const LAMP = [0, 1, 2, 3, 4].map((k) => [mark("lamp_" + k + "_on", NaN), mark("lamp_" + k + "_off", NaN)]).filter((s) => s[1] > s[0]);
  const lampOn = cur === k0 && LAMP.some((s) => frame >= s[0] && frame < s[1]);
  if (cur === k0) {
    const b = SubjectBox(list[k0], frame, BOX, "@lumiere");
    const light = () => h(Subject, { shot: k0, object: "@lumiere", style: full });
    if (b && lampOn) {
      const seen = LightUnder(list[k0], frame, BOX, b);
      const x0 = Math.max(0, b.x - b.w);
      const y0 = Math.max(0, b.y - b.h);
      const around = LightUnder(list[k0], frame, BOX, { x: x0, y: y0, w: Math.min(W, b.x + 2 * b.w) - x0, h: Math.min(H, b.y + 2 * b.h) - y0 });
      // Already shining in her picture: bright, and brighter than what is round it (a lamp off against a white sky is not).
      const shines = seen && seen.high > 0.6 && (!around || seen.high > around.mean + 0.2);
      const blur = Math.max(6, Math.round(Math.max(b.w, b.h) * 0.16));
      const core = "radial-gradient(ellipse " + Math.round(b.w * 0.75 + 8) + "px " + Math.round(b.h * 0.75 + 8) + "px at " + Math.round(b.x + b.w / 2) + "px " + Math.round(b.y + b.h / 2) + "px, #000 0%, #000 40%, rgba(0,0,0,0.3) 100%)";
      layers.push(h("div", { key: "own", style: { ...full, filter: "brightness(1.35) saturate(1.15)" } }, light()));
      if (shines) layers.push(h("div", { key: "shine", style: { ...full, mixBlendMode: "screen", opacity: 0.9, filter: "contrast(2.2) brightness(1.25) blur(" + blur + "px)" } }, light()));
      else layers.push(
        h("div", { key: "fill", style: { ...full, mixBlendMode: "screen", opacity: 0.92, maskImage: core, WebkitMaskImage: core } }, h(Subject, { shot: k0, object: "@lumiere", style: full, fill: "#ffe2a2" })),
        h("div", { key: "halo", style: { ...full, mixBlendMode: "screen", opacity: 0.55, filter: "blur(" + blur + "px)" } }, h(Subject, { shot: k0, object: "@lumiere", style: full, fill: "#ffbf5c" })));
    } else if (b) layers.push(h("div", { key: "dim", style: { ...full, filter: "brightness(0.42) saturate(0.7)" } }, light()));
    else if (lampOn) layers.push(bloom(k0, 0.85));
  }

  // 2. Its second shot: her windows filled with her colour in six waves, the lowest first (ranked on the shot's first
  // image), lit to its end; shown only through their boxes. Nothing named: her highlights twinkle on each wave.
  if (k1 >= 0 && cur === k1) {
    const WAVES = [0, 1, 2, 3, 4, 5].map((k) => mark("wave_" + k, NaN)).filter(Number.isFinite);
    const ref = SubjectParts(list[k1], Math.max(0, list[k1].from), BOX, "@fenetres", 6);
    const now = SubjectParts(list[k1], frame, BOX, "@fenetres", 6);
    const order = ref.map((p, i) => ({ p, box: now[i] || p })).filter((q) => q.box.w > 2 && q.box.h > 2).sort((a, b) => b.p.y + b.p.h - (a.p.y + a.p.h) || a.p.x - b.p.x);
    const rank = (g) => (order.length >= WAVES.length ? Math.floor((g * WAVES.length) / order.length) : g);
    const lit = WAVES.length ? order.map((q, g) => ({ box: q.box, at: WAVES[Math.min(WAVES.length - 1, rank(g))] })).filter((q) => frame >= q.at) : [];
    const pad = Math.max(2, Math.round(H * 0.003));
    const clip = (boxes) => "path('" + boxes.map((b) => "M" + Math.round(b.x - pad) + " " + Math.round(b.y - pad) + "h" + Math.round(b.w + 2 * pad) + "v" + Math.round(b.h + 2 * pad) + "h" + -Math.round(b.w + 2 * pad) + "Z").join(" ") + "')";
    const draw = () => h(Subject, { shot: k1, object: "@fenetres", style: full, fill: WIN });
    // A window already lit in her picture (a shop window at night, her room seen through it: far brighter than her shot)
    // is never covered: a warm white flash on its first image and half as bright two more, then its own picture brighter
    // under her colour laid in multiply (her room still seen through it, tinted).
    const base = LightUnder(list[k1], frame, BOX, null);
    const alight = (b) => { const l = base && LightUnder(list[k1], frame, BOX, b); return Boolean(l && l.mean > 0.36 && l.mean > base.mean + 0.2); };
    const dark = lit.filter((q) => !alight(q.box)).map((q) => q.box);
    const shine = lit.filter((q) => alight(q.box));
    const flash = shine.filter((q) => frame - q.at < 3).map((q) => q.box);
    const burst = shine.some((q) => frame - q.at < 1) ? 0.9 : 0.45;
    if (dark.length) layers.push(h("div", { key: "windows", style: { ...full, clipPath: clip(dark) } }, draw(), warm || hers ? h("div", { style: { ...full, mixBlendMode: "screen", opacity: 0.6, filter: "blur(" + Math.max(3, Math.round(H * 0.004)) + "px)" } }, draw()) : null));
    if (shine.length) layers.push(h("div", { key: "windows-own", style: { ...full, clipPath: clip(shine.map((q) => q.box)) } }, h("div", { style: { ...full, filter: "brightness(1.3) saturate(1.2)" } }, h(Subject, { shot: k1, object: "@fenetres", style: full })), h("div", { style: { ...full, mixBlendMode: "multiply", opacity: 0.85 } }, draw())));
    if (flash.length) layers.push(h("div", { key: "windows-flash", style: { ...full, clipPath: clip(flash), mixBlendMode: "screen", opacity: burst } }, h("div", { style: { ...full, backgroundColor: "#fff6dc" } })));
    if (!order.length && WAVES.some((f) => frame >= f && frame < f + 3)) layers.push(bloom(k1, 0.6));
  }

  // 3. Her name lit like a neon (a tube catching: off, on, almost off, on, half, on) in the calm part of its last shot,
  // with its first light that holds, to its end.
  const nom = word("nom");
  const NAME = mark("name", Math.max(0, D - 45));
  const NEON = [0, 1, 0.3, 1, 0.55];
  const on = nom && frame >= NAME ? (frame - NAME < NEON.length ? NEON[frame - NAME] : 1) : 0;
  let name = null;
  if (on > 0) {
    const keep = (x) => String(x || "").replace(/(\d) (?=\d)/g, "$1 ");
    const chars = Array.from(keep(nom)).length;
    const NS = Math.min(150, Math.round(3200 / Math.max(8, chars)));
    const NH = Math.round(NS * 1.3);
    const fallback = { x: 140, y: Math.round(H * 0.12), w: 800, h: NH };
    const spot = ClearBox(list[kl], Math.max(NAME, list[kl].from), BOX, { aspect: 800 / NH, min: { w: 440, h: Math.round(NH * 0.55) }, max: { w: 800, h: NH }, prefer: "top", fallback }) || fallback;
    const size = Math.round(NS * Math.min(1, spot.h / NH));
    const glow = "0 0 " + Math.max(2, Math.round(size * 0.03)) + "px rgba(" + GLOW.join(",") + ",0.95), 0 0 " + Math.round(size * 0.12) + "px rgba(" + GLOW.join(",") + ",0.75), 0 0 " + Math.round(size * 0.3) + "px rgba(" + GLOW.join(",") + ",0.45)";
    name = h(FitText, { key: "name-" + keep(nom), style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(Math.min(spot.h, NH)) }, innerStyle: { fontFamily: "'" + brand.displayFont + "', 'Instrument Serif', 'Georgia', serif", fontWeight: 400, fontSynthesis: "none", fontSize: size, lineHeight: 1.05, letterSpacing: "0.01em", color: TUBE, whiteSpace: "nowrap", textAlign: "center", justifyContent: "center", textShadow: glow, opacity: on } }, keep(nom));
  }
  return h(AbsoluteFill, null, ...layers, name);
}`;

export const petitesLumieres: EffectPiece = {
  key: "petites-lumieres",
  // 2: her windows already lit in her picture (her shop windows at night) never covered with a flat colour, flashed and
  // brightened as its second example lights what already shines (Tristan's Procope bench, 6 November).
  version: 2,
  name: "Petites lumières",
  how: "sur une image immobile de son lieu, seule sa lumière bouge : sa lampe, son enseigne ou un néon s'allume quatre images sur le temps, s'éteint quand la musique s'arrête, clignote trois fois quand elle revient puis tient allumée ; sur l'image suivante, s'il y en a une, ses fenêtres se remplissent de rouge par vagues du bas vers le haut ; son nom peut s'allumer comme un néon, puis le montage reprend.",
  needs: "une photo ou une vidéo fixe de son lieu le soir avec une lumière de près (une lampe, une lanterne, une enseigne, un néon) ; pour la suite, une façade avec des fenêtres.",
  lays: "sur un ou deux de ses plans fixes, de 2,5 à 7 s : le premier où sa lumière clignote puis tient (deux à quatre secondes), le second où ses fenêtres s'allument",
  shots: [1, 2],
  seconds: [2.5, 7],
  require: { files: 1, shot: { still: true } },
  texts: [
    {
      slot: "nom",
      want: "facultatif : son nom (ou un mot court de son lieu) qui s'allume comme un néon dans la partie calme de son dernier plan et reste allumé ; une ligne, seulement quand l'effet a besoin de mots",
      max: 22,
      required: false,
    },
  ],
  objects: [
    {
      slot: "lumiere",
      shot: 0,
      want: "la lumière de ce plan, la plus petite chose qui éclaire : la tête d'un lampadaire, une lanterne, une applique, un abat-jour, une suspension, son enseigne lumineuse, un néon, une guirlande (« street lamp head », « lantern », « wall lamp », « neon sign », « string lights ») ; « none » si aucune ne s'y voit",
    },
    {
      slot: "fenetres",
      shot: 1,
      want: "ses fenêtres dans ce plan, chacune à part (« every window »), ou ce qu'il a plusieurs fois et qui peut s'allumer : ses lampes, ses ampoules, ses bougies (« every lamp », « every light bulb ») ; « none » sinon",
    },
  ],
  settings: [
    {
      name: "couleur",
      want: "la couleur de ses fenêtres allumées et de son nom en néon",
      choices: [
        { value: "rouge", says: "le rouge de l'original : des fenêtres rouges, un néon rouge" },
        { value: "chaude", says: "la lumière chaude d'une fenêtre allumée, un néon blanc chaud" },
        { value: "sienne", says: "sa couleur à elle (celle de sa charte ; le rouge si elle est trop pâle ou trop sombre pour briller)" },
      ],
    },
  ],
  timeline: petitesLumieresTimeline,
  code: CODE,
};
