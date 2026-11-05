import type { EffectPiece, PieceTimeline } from "../pieces.ts";

// « Éventail de bandes », the effect (docs/fiches/eventail.md, effects 1 to 4; its whole Reel is skills/eventail.ts):
// its opening and its drop, laid over one shot of hers with a centre and lines going out of it (a table or a dish seen
// from above, a ceiling, an aisle in perspective). On a deep ground of colour (her own dark colour when it is a colour,
// else the original's bordeaux; its grain, its sides darker), a small square at the heart of that shot, a window onto
// it, then a band a beat, each set at once, all windows onto that one shot at its place, in the original's order (a
// line through the middle in two halves, the other, then the upright one, their ends cut square around the square: a
// hexagon of the ground), the shot playing under them, in the original's black and white with blue blacks and whites
// never blown; on the seventh beat the whole shot at once, at the same place and size, a thin frame of the ground laid
// over it; then her next shots, if the editor gave any, in the same black and white in the frame, and the montage
// takes over. Its star sits on the heart its filler named in that shot (found small), else where its lines run to (its
// vanishing point, read before the render), else the middle, pulled within an eighth of it. A shorter span plays it on
// the half beats (or the quarters), so the whole shot always lands on the music's grid with a beat or more to show.
// Full frame (its star turned a quarter) or, on her word, in 16:9 on black as the original; her shots in colour on her
// word. Its optional title is a small white line in her title face at the top, over the ground, while the star opens
// (the original's signature, moved from its black to its ground). Its music (v2), as its skill's: through a small
// speaker until the whole shot, a hit of it on each step (the square and each band, on whole beats), silent after each
// one; all of it, open, on the whole shot: the drop. On half or quarter beats, its speaker only (a silence ending off
// the beat would move her music off the cuts). It leaves the rest of its Reel: its split screen, its two-beat shots and
// their echo, its signature and red line on the blue black, its ending card.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  // Its shots: those that play during it, in order; the first one is its star's.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return null;
  const first = mine[0];
  const cur = mine.reduce((k, i) => (shots[i].from <= frame ? i : k), first);
  const BEAT = Math.max(4, mark("beat", 18));
  // Its star (frames from its start, its timeline's marks): the square at once, a band on each of six steps, the whole
  // shot on the seventh.
  const WHOLE = Math.max(7, Math.round(mark("whole", 7 * BEAT)));
  const TIMES = Array.from({ length: 6 }, (_, k) => Math.round(mark("band_" + k, ((k + 1) * WHOLE) / 7)));

  // Its frame: the whole vertical frame, its star turned a quarter; or, on her word, horizontal 16:9 on black as the
  // original. Every size below is a share of the frame's short side.
  const wide = setting("format", "vertical") === "horizontal";
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const S = Math.min(bw, bh);
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const full = { position: "absolute", left: 0, top: 0, width: bw, height: bh };

  // Its ground: her own dark colour when it is a deep colour (or her main colour when it is one), else the original's
  // bordeaux; the bordeaux or her main colour on her word.
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); return m ? parseInt(m[1], 16) : null; };
  const channels = (v) => [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  const sat = (v) => { const c = channels(v); const max = Math.max(...c); const min = Math.min(...c); const l = (max + min) / 2; return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)); };
  const lum = (v) => { const c = channels(v); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const css = (v) => "#" + v.toString(16).padStart(6, "0");
  const deep = (v) => v !== null && sat(v) >= 0.5 && lum(v) < 0.2;
  const dark = hex(brand.palette && brand.palette.dark);
  const accent = hex(brand.accent);
  const fond = setting("fond", "auto");
  const BORDEAUX = "#440a0b";
  const GROUND = fond === "accent" && accent !== null ? css(accent) : fond === "bordeaux" ? BORDEAUX : deep(dark) ? css(dark) : deep(accent) ? css(accent) : BORDEAUX;
  const NIGHT = "#03090d";
  // The ground darker toward its sides, as the original's (a quarter darker at its left edge, a sixth at its right).
  const sides = h("div", { key: "sides", style: { ...full, background: "linear-gradient(90deg, rgba(0,0,0,0.25), rgba(0,0,0,0.25) 8%, rgba(0,0,0,0.1) 17%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.13) 75%, rgba(0,0,0,0.17))" } });

  // Her picture graded as the original's: black and white, its blacks no darker than the blue black (laid in lighten),
  // its whites no brighter than #e8e9ea (in darken); in her colours on her word.
  const COLOUR = setting("couleur", "noir_et_blanc") === "couleur";
  const BW = COLOUR ? "none" : "grayscale(1) brightness(1.08) contrast(1.22)";
  const picture = (child) => COLOUR
    ? h("div", { style: { ...full, overflow: "hidden" } }, child)
    : h("div", { style: { ...full, overflow: "hidden", isolation: "isolate" } }, child,
        h("div", { style: { ...full, backgroundColor: NIGHT, mixBlendMode: "lighten" } }),
        h("div", { style: { ...full, backgroundColor: "#e8e9ea", mixBlendMode: "darken" } }));

  // Its centre: the heart its filler named in that shot (a pendant lamp, a plate, the door at the end of the aisle),
  // found at its first image and small; else where the lines of the shot run to; else the middle, where she films it;
  // pulled within an eighth of the frame's middle.
  const found = SubjectBox(shots[first], 0, laid, "@coeur");
  const heart = found && found.w < bw / 3 && found.h < bh / 3 ? { x: found.x + found.w / 2, y: found.y + found.h / 2 } : null;
  const point = heart || VanishingPoint(shots[first], 0, laid, { least: 0.3, fallback: null });
  const pull = (v, mid, room) => Math.max(mid - room, Math.min(mid + room, v));
  const cx = point ? pull(point.x, bw / 2, bw / 8) : bw / 2;
  const cy = point ? pull(point.y, bh / 2, bh / 8) : bh / 2;

  // 1. Its star of windows onto that one shot, at its place and size (the picture kit's WindowStar: its square 9,4 %
  // of the short side, its diagonals 36° from the horizontal, 54° turned upright, 14 % wide, ending 13,5 % from the
  // centre, its straight ones 15,5 % wide, ending 11,5 % from it), the shot playing under them.
  const star = frame < WHOLE
    ? h(WindowStar, { key: "star", box: { x: 0, y: 0, w: bw, h: bh }, center: { x: cx, y: cy }, upright: !wide, at: 0, times: TIMES },
        picture(h(Footage, { shot: first, style: { ...full, filter: BW } })))
    : null;
  // 2. The whole shot at once on the seventh step, at the same place and size, a thin frame of the ground laid over it
  // to its end (the original's 14 px a side and 12 above and below, of 720 × 406), her next shots in it at their cuts.
  const FX = Math.round((wide ? 0.0345 : 0.0296) * S);
  const FY = Math.round((wide ? 0.0296 : 0.0345) * S);
  const framed = { ...full, clipPath: "inset(" + FY + "px " + FX + "px)" };
  const film = frame >= WHOLE
    ? h("div", { key: "film", style: framed }, picture(h(Footage, { shot: cur, style: { ...full, filter: BW } })))
    : null;

  // Its optional title: a small white line in her title face, on the ground at the top while the star opens (above its
  // band in the black, in 16:9), a second and a little more at least; a tight dark edge so it reads over a band too.
  const title = word("titre");
  const display = "'" + brand.displayFont + "', 'Instrument Serif', Georgia, serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0").replace(/ (\d+(?:er|e))\b/g, "\u00a0$1");
  const titleTop = wide ? Math.max(90, by - 150) : 200;
  const titled = title && frame < Math.max(WHOLE, 36)
    ? h(FitText, { key: "titre", style: { position: "absolute", left: 190, top: titleTop, width: 700, height: 120 }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: 58, lineHeight: 1.12, color: "#ffffff", textAlign: "center", whiteSpace: "nowrap", textShadow: "0 0 2px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.45)" } }, keep(title))
    : null;

  const box = h("div", { key: "box", style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden" } },
    h(Paper, { color: GROUND, grain: 0.25, shade: 0 }, sides, star, film));
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, box, titled);
}`;

/** Its whole shot is held this long at least after it lands (frames), before her next shot or the montage takes over. */
const HOLD = 24;

/**
 * Its star for a span: the frames its six bands land on, and the whole shot's. The original's on the beats (its square
 * on the first, a band on each of the next six, the whole shot on the seventh, held two beats at least) when its first
 * shot under it lasts that long; on the half beats, then the quarters, when it is shorter, the whole shot still held a
 * beat (or 0,8 s) at least; shorter still, its seven steps squeezed before that hold.
 */
/** How much of each step its music plays before falling silent to the next one (its skill's 0,56 beat, the original's hit). */
const MUSIC_HIT = 0.56;

export function starFrames(room: number, beat: number): { bands: number[]; whole: number } {
  for (const step of [1, 0.5, 0.25]) {
    const s = step * beat;
    if (7 * s + Math.max(2 * s, HOLD) <= room + 0.5) return { bands: [1, 2, 3, 4, 5, 6].map((k) => Math.round(k * s)), whole: Math.round(7 * s) };
  }
  const whole = Math.max(7, Math.round(room - HOLD));
  return { bands: [1, 2, 3, 4, 5, 6].map((k) => Math.round((k * whole) / 7)), whole };
}

export const eventail: EffectPiece = {
  key: "eventail",
  version: 2,
  name: "Éventail de bandes",
  how: "sur un fond de couleur profonde (sa couleur foncée, sinon le bordeaux de l'original), un petit carré au cœur de son plan, puis une bande par temps, posée d'un coup, toutes des fenêtres sur ce même plan en noir et blanc, en étoile autour du carré ; au septième temps le plan entier apparaît d'un coup, dans un fin cadre de la couleur du fond ; puis ses plans suivants dans le même cadre, et le montage reprend.",
  needs: "un plan avec un centre et des lignes qui en partent, filmé téléphone posé : une table, une assiette ou une pizza vue d'en haut, un plafond ou une suspension vus d'en bas, une allée ou un couloir en perspective ; son cœur au milieu de l'image.",
  lays: "sur ce plan-là en premier, tenu 3 à 6 s (l'étoile s'ouvre sur lui, puis il apparaît en entier), puis 0 à 2 de ses plans d'un ou deux temps",
  shots: [1, 3],
  seconds: [3, 8],
  require: { files: 1, shot: { still: true } },
  texts: [
    {
      slot: "titre",
      want: "facultatif : une petite ligne en blanc, en haut, pendant que l'étoile s'ouvre, comme une signature : son nom, ou ce qu'on va voir (une forme comme « Studio Ciel », « Un samedi à l'atelier »)",
      max: 24,
      required: false,
    },
  ],
  objects: [
    {
      slot: "coeur",
      shot: 0,
      want: "le petit élément au cœur de son plan, là où ses lignes se rejoignent, que le petit carré du milieu cadre : la suspension du plafond, une assiette, une tasse, le centre d'une pizza, un bouquet, la porte au bout de l'allée, la personne au centre ; « none » quand rien n'y est au centre (l'étoile se pose alors là où ses lignes se rejoignent, sinon au milieu)",
    },
  ],
  settings: [
    {
      name: "fond",
      want: "la couleur du fond de l'étoile et du cadre",
      choices: [
        { value: "auto", says: "sa couleur foncée à elle quand c'en est une vraie (celle de sa charte), sinon le bordeaux de l'original" },
        { value: "bordeaux", says: "le bordeaux profond de l'original" },
        { value: "accent", says: "sa couleur principale, en aplat vif" },
      ],
    },
    {
      name: "couleur",
      want: "ses plans",
      choices: [
        { value: "noir_et_blanc", says: "en noir et blanc aux noirs bleutés, comme l'original" },
        { value: "couleur", says: "dans leurs couleurs" },
      ],
    },
    {
      name: "format",
      want: "le format de l'effet",
      choices: [
        { value: "vertical", says: "plein écran, l'étoile tournée d'un quart" },
        { value: "horizontal", says: "en 16:9 sur du noir, comme l'original" },
      ],
    },
  ],
  timeline({ frames, bpm, shots }): PieceTimeline {
    const beat = (60 / bpm) * 30;
    // Its star on its first shot under it, to that shot's end (or its own).
    const room = shots.length ? Math.min(frames, shots[0]!.from + shots[0]!.frames) : frames;
    const { bands, whole } = starFrames(room, beat);
    // Through a small speaker until the whole shot; on whole beats, a hit of it on each step, silent after each one.
    const seconds = (f: number) => Math.round((f / 30) * 1000) / 1000;
    const steps = [0, ...bands, whole];
    const onBeats = Math.abs((bands[0] ?? 0) - beat) <= 0.5;
    const pauses = onBeats
      ? steps.slice(0, -1).flatMap((f, k) => {
          const next = steps[k + 1]!;
          const from = f + MUSIC_HIT * (next - f);
          return next - from >= 2 ? [{ from: seconds(from), to: seconds(next) }] : [];
        })
      : [];
    return {
      marks: { whole, ...Object.fromEntries(bands.map((f, k) => [`band_${k}`, f])) },
      music: { ...(pauses.length ? { pauses } : {}), filters: [{ kind: "radio", from: 0, to: seconds(whole) }] },
    };
  },
  code: CODE,
};
