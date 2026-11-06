import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Ta devanture en kaléidoscope », written on its original's fiche (docs/fiches/vitraux.md: measured image by image at
// 30 i/s, each zone's distance from the real door and from the image before, close-ups of its fanlight and its leaves
// every six images, its sound by bands; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire
// l'image »). One still shot, phone on a tripod, no cut: the big wooden door of an old building, straight on in its stone
// arch, which re-forms at every image (an AI video: its leaves doubling into three or four narrower ones sliced in
// vertical bands, its glass panes in new symmetric patterns, its fanlight's spindles turning half a turn), the stone
// around it in place, then back to the real door for the loop; over a soft house loop at 123,4 BPM (a kick on every
// beat, the first at 0,345 s), cut dead at 9,00 s. Every landmark below is in beats of that grid from the Reel's start:
//   0 – 3,21     the real picture two images, then the change starts and slows into its full figure (half of it at
//                0,43 s, 90 % at 1,23 s);
//   3,21 – 15,21 its thing re-forms all along, continuously (never on the beat: measured at every phase of it);
//   15,21 – 17,51 back to the real picture, slowly then faster (half of it at 8,20 s);
//   17,51 – 18,51 the real picture, its last image like its first: the loop.
// Here on her thing, filmed straight on (her door, her front, her window, a shelf, a display: named by the filler, else
// her whole picture), with mirrors laid on her real image, which invent nothing (the original's door re-made by an AI is
// not done: docs/outils-video.md). Its « kaléidoscope » (the default since v2): eight mirrored wedges round her thing's
// middle, each the same cone of her picture taken along her thing (one in two mirrored: no seam), in a circle that opens
// from its middle until it fills her thing (fast then slower), the whole figure turning 11,25 degrees a beat as the
// original's fanlight while its cone slides along her thing and comes closer and farther on slow swells, so it re-forms
// at every image and never comes back the same; then it closes back to her real picture for the loop. Its « rosace »: the
// same, held in a round window in her thing's middle, the rest real around it. Its « battants » (v1's default): parallel
// vertical mirrors whose spacing and place slide all along, her thing upright, doubling into narrower copies, as the
// original's leaves. v1's battants on a bookshop's front seen from across the street, at the production bench (6
// November), were « très moyen » (Tristan): two or three wide strips of the same front, its name reversed on its sign,
// the bicycles and a passer-by doubled, barely an effect, and nothing else for 9 s; a kaleidoscope's wedges are small
// enough that her sign's letters become ornament, its cone takes only her thing, and it changes at every image. The
// mirrors stay inside her thing's outline when it was found, the rest of her picture real around it, as the original's
// stone. Its words: none in the original; her name (optional) when the mirrors start to close, a small line under it,
// set above her thing when there is room, else in the calm part of her picture, its colour from the light of what is
// under it (her cone, while the mirrors are there); her ending card in their place after. A longer Reel she asks for
// adds a verse: one more of her things, in its mirrors, eight beats. Her photo stays still (only the mirrors move), her
// video plays. Vertical full frame as the original, a horizontal file cropped on her thing (Tristan, 6 November:
// vertical Reels by default; v1 laid a horizontal one whole in a band when her thing did not fit), whole in a 16:9 band
// on black only on her word.

const BPM = 123.4;
/** Its first beat (the first kick), 0,345 s in, in beats from the Reel's start. */
const FIRST = 0.71;
/** The change starts on its third image (0,07 s), its figure whole on beat 2,5. */
const OPEN = 0.144;
const FULL = FIRST + 2.5;
/** Back to the real picture from beat 14,5 to 16,8. */
const CLOSE = FIRST + 14.5;
const REAL = FIRST + 16.8;
/** Its length, 9,00 s (its sound cut there, for the loop). */
const LENGTH = 18.51;
/** Her name, when it has one, from beat 12 (the mirrors still turning, then closing under it). */
const NAME = FIRST + 12;
/** A verse (one more of her things, for a longer Reel she asks for): eight beats, its cut on the bar of beat 8. */
const VERSE = 8;
const CUT = FIRST + 8;
/** The rosace turns as the original's fanlight: half a turn in about 16 beats. */
const TURN = 11.25;
/** The engine's ending card: the Reel's last 1,6 s. */
const END_CARD = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  const n = shots.length;
  const endAt = end ? end.from : durationInFrames + 1;
  const BEAT = Math.max(4, mark("beat", 14.59));
  const FIRST = mark("first", 10);
  const OPEN = Math.max(0, mark("open_from", 2));
  const FULL = Math.max(OPEN + 1, mark("full", 47));
  const CLOSE = Math.max(FULL, mark("close", 222));
  const REAL = Math.max(CLOSE + 1, mark("real", 255));
  const TURN = mark("turn", 11.25);
  const figure = setting("figure", "kaleidoscope");
  const format = setting("format", "auto");
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";

  // 1. How strong its mirrors are at a frame (0: her real picture; 1: its whole figure): from its third image, fast then
  // slower (half of it at 0,43 s in the original), held, then back slowly then faster (half of it at 8,20 s), then real.
  const force = (f) => {
    if (f <= OPEN) return 0;
    if (f < FULL) { const p = (f - OPEN) / (FULL - OPEN); return 1 - Math.pow(1 - p, 3); }
    if (f < CLOSE) return 1;
    if (f < REAL) { const p = (f - CLOSE) / (REAL - CLOSE); return 1 - p * p; }
    return 0;
  };
  const k = force(frame);
  const playing = (f) => { let c = 0; for (let i = 0; i < n; i++) if (shots[i].from <= f) c = i; return c; };
  const cur = n ? playing(frame) : -1;

  // 2. Her thing in her first shot (« @devanture »: her door, her front, her window, a shelf), read in the box her shot is
  // drawn in, smoothed over seven images; the mirrors inside it, her picture real around it. Not found, too small or
  // the whole picture already: the mirrors take her whole picture.
  const thingIn = (f, box) => {
    let x = 0, y = 0, w = 0, hh = 0, c = 0;
    for (let d = -3; d <= 3; d++) {
      const b = SubjectBox(shots[0], f + d, box, "@devanture");
      if (b && b.w > 0 && b.h > 0) { x += b.x; y += b.y; w += b.w; hh += b.h; c++; }
    }
    return c ? { x: x / c, y: y / c, w: w / c, h: hh / c } : null;
  };

  // 3. Its frame: vertical full frame (Tristan, 6 November: vertical Reels by default), her horizontal file cropped on her
  // thing (else on its own middle); whole on black in a 16:9 band only on her word.
  const FRAME = { left: 0, top: 0, width, height };
  const BAND = { left: 0, top: Math.round((height - (width * 9) / 16) / 2), width, height: Math.round((width * 9) / 16) };
  const boxes = React.useMemo(() => shots.map((s, i) => {
    const aspect = Number(s.aspect) || 0.5625;
    if (format === "horizontal") return BAND;
    if (aspect <= 1.15) return FRAME;
    const wide = { left: 0, top: 0, width: Math.round(height * aspect), height };
    const seen = i === 0 ? thingIn(s.from + Math.round(s.durationInFrames / 2), wide) : null;
    if (seen) return { ...wide, left: Math.round(within(width / 2 - (seen.x + seen.w / 2), width - wide.width, 0)) };
    return FRAME;
  }), [n, format, width, height]);

  // Where the mirrors are at a frame of a shot: her thing (its box; its outline to clip them to when it is whole in
  // the picture, a closed path) or her whole picture.
  const zoneOf = (i, f, box) => {
    const L = Math.max(0, box.left), T = Math.max(0, box.top), R = Math.min(width, box.left + box.width), B = Math.min(height, box.top + box.height);
    if (i === 0) {
      const o = thingIn(f, box);
      if (o && o.w >= (R - L) * 0.3 && o.h >= (B - T) * 0.2 && (o.w < (R - L) * 0.97 || o.h < (B - T) * 0.97)) {
        const x0 = Math.max(L, o.x), x1 = Math.min(R, o.x + o.w);
        const y0 = Math.max(T, o.y), y1 = Math.min(B, o.y + o.h);
        const path = SubjectOutline(shots[0], f, box, "@devanture");
        const closed = typeof path === "string" && / Z\s*$/.test(path) && path.split("M").length === 2;
        if (x1 - x0 > 60 && y1 - y0 > 60) return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, path: closed ? path : null };
      }
    }
    return { x: L, y: T, w: R - L, h: B - T, path: null };
  };
  const copy = (i, box, transform, origin) => h("div", { style: { position: "absolute", left: 0, top: 0, width, height, transform, transformOrigin: origin } }, h(Footage, { shot: i, style: box }));

  // 4a. Its battants (the original's leaves and panes): parallel vertical mirrors over her thing, their spacing (as many
  // copies of it as fit across: 1 is her real picture, from 1,8 to 3,4 at full) and their place (a share of its width)
  // sliding all along on two slow swells of 8 and 6 beats, so it never comes back the same; upright, the ground down.
  // Strip j shows the same window of her picture, straight when j is even, mirrored when odd: no seam at a mirror line.
  const battants = (i, f, box, z, s) => {
    const b = (f - FIRST) / BEAT;
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
      const odd = Math.abs(j) % 2 === 1;
      const move = odd ? "translateX(" + (2 * cx + j * P + off).toFixed(2) + "px) scaleX(-1)" : "translateX(" + (j * P - off).toFixed(2) + "px)";
      strips.push(h("div", { key: "b" + j, style: { position: "absolute", left: L, top: Math.floor(z.y), width: R - L, height: Math.ceil(z.h), overflow: "hidden" } },
        h("div", { style: { position: "absolute", left: -L, top: -Math.floor(z.y), width, height } }, copy(i, box, move, "0 0"))));
    }
    return h("div", { key: "battants", style: { position: "absolute", left: 0, top: 0, width, height, ...(z.path ? { clipPath: "path('" + z.path + "')" } : {}) } }, strips);
  };

  // 4b. Its kaleidoscope (the default) and its rosace: eight wedges of 45 degrees round her thing's middle, each the same
  // cone of her picture, one in two mirrored (so they join without a seam). The cone starts on her thing's long axis
  // (below its middle for an upright thing, pointing up; left of it for a wide one, pointing right) and never leaves her
  // thing: as close as it must be for that (x 1,1 for her whole upright picture), and closer on a slow swell of 16 beats,
  // sliding along her thing (12 beats) and a little across it (18); the whole figure turns 11,25 degrees a beat, as the
  // original's fanlight. So it re-forms at every image and never comes back the same. In a circle that opens from its
  // middle with its force until it fills her thing (the rosace: inscribed in it, the rest real around), and closes back.
  const cone = (f, z, round) => {
    const b = (f - FIRST) / BEAT;
    const tall = z.h >= z.w;
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    const L0 = (tall ? z.h : z.w) / 2, Q0 = (tall ? z.w : z.h) / 2;
    const back = 0.3 - 0.2 * Math.sin((2 * Math.PI * b) / 12);
    const side = 0.12 * Math.sin((2 * Math.PI * b) / 18 + 0.8);
    const sx = tall ? cx + side * Q0 : cx - back * L0;
    const sy = tall ? cy + back * L0 : cy + side * Q0;
    const need = round ? Math.min(z.w, z.h) / 2 : Math.hypot(z.w / 2, z.h / 2) + 2;
    const reach = Math.min(L0 * (1 + back) - 4, (Q0 * (1 - Math.abs(side)) - 4) / Math.sin(Math.PI / 8));
    const M = (need / Math.max(40, reach)) * (1.25 + 0.25 * Math.sin((2 * Math.PI * b) / 16 - Math.PI / 2));
    return { cx, cy, sx, sy, M, need, beta: tall ? 0 : 90, turn: TURN * b, reach: need / M, tall };
  };
  // When her name comes in, the kaleidoscope draws back into its rosace in half a beat (her picture real again round it,
  // her name on it), then closes as before.
  const named = reelTexts.find((t) => t.role === "hook");
  const rose = (f, z) => {
    if (!named || f < named.from) return 0;
    const p = within((f - named.from) / (BEAT / 2), 0, 1);
    return p * p * (3 - 2 * p);
  };
  const kaleido = (i, f, box, z, s, round) => {
    const c = cone(f, z, round);
    const inscribed = Math.min(z.w, z.h) / 2;
    const R = Math.max(1, (round ? c.need : c.need + (inscribed - c.need) * rose(f, z)) * s);
    const far = 1.6 * c.need;
    const at = (a) => (c.cx + far * Math.sin((a * Math.PI) / 180)).toFixed(1) + "px " + (c.cy - far * Math.cos((a * Math.PI) / 180)).toFixed(1) + "px";
    const wedges = [];
    for (let j = 0; j < 8; j++) {
      const a = c.turn + j * 45 + 22.5;
      const move = "translate(" + c.cx.toFixed(1) + "px, " + c.cy.toFixed(1) + "px) rotate(" + a.toFixed(2) + "deg)" + (j % 2 ? " scaleX(-1)" : "") + " scale(" + c.M.toFixed(4) + ") rotate(" + -c.beta + "deg) translate(" + (-c.sx).toFixed(1) + "px, " + (-c.sy).toFixed(1) + "px)";
      wedges.push(h("div", { key: "k" + j, style: { position: "absolute", left: 0, top: 0, width, height, clipPath: "polygon(" + c.cx.toFixed(1) + "px " + c.cy.toFixed(1) + "px, " + at(a - 23.1) + ", " + at(a) + ", " + at(a + 23.1) + ")" } }, copy(i, box, move, "0 0")));
    }
    const iris = h("div", { key: "iris", style: { position: "absolute", left: 0, top: 0, width, height, clipPath: "circle(" + R.toFixed(1) + "px at " + c.cx.toFixed(1) + "px " + c.cy.toFixed(1) + "px)" } }, wedges);
    const clip = z.path ? "path('" + z.path + "')" : "inset(" + Math.round(z.y) + "px " + Math.round(width - z.x - z.w) + "px " + Math.round(height - z.y - z.h) + "px " + Math.round(z.x) + "px)";
    return h("div", { key: round ? "rosace" : "kaleidoscope", style: { position: "absolute", left: 0, top: 0, width, height, clipPath: clip } }, iris);
  };

  const box = cur >= 0 ? boxes[cur] : FRAME;
  const real = cur >= 0 ? h(Footage, { key: "real", shot: cur, style: box }) : null;
  const zone = cur >= 0 ? zoneOf(cur, frame, box) : null;
  const mirrors = cur >= 0 && k > 0.002 ? (figure === "battants" ? battants(cur, frame, box, zone, k) : kaleido(cur, frame, box, zone, k, figure === "rosace")) : null;

  // 5. Her words (none in the original): her name from beat 12, the mirrors closing under it, a small line in spaced
  // capitals under it, both centred on the frame; her ending card in their place after. Over her picture left real
  // above her thing when there is room (a sign over a door), else in the calm part of her last picture (its sky first,
  // else a plain wall), else in its upper part; each white with a soft shadow, an ink where what is under it is bright:
  // her picture, or, over her kaleidoscope, the cone of her picture it is made of, read when her name comes in.
  const hook = reelTexts.find((t) => t.role === "hook");
  const line = reelTexts.find((t) => t.role === "caption");
  const card = end && frame >= endAt;
  const showing = (t) => t && frame >= t.from && frame < Math.min(t.to, endAt);
  const title = card ? end.title : showing(hook) ? hook.text : "";
  const sub = card ? end.subtitle || "" : showing(line) ? line.text : "";
  const last = n ? n - 1 : 0;
  const lastBox = n ? boxes[last] : FRAME;
  const top0 = Math.max(110, lastBox.top + 40);
  const fallback = { x: 140, y: top0, w: 800, h: 210 };
  const from = hook ? hook.from : end ? endAt : durationInFrames;
  const place = React.useMemo(() => {
    const thing = n ? zoneOf(last, from, lastBox) : null;
    // Right above it, like a sign on its lintel: its line just over it, her name over its line.
    // (Above its rosace for a kaleidoscope: it draws back into it when her name comes in.)
    const roof = thing && figure !== "battants" ? thing.y + thing.h / 2 - Math.min(thing.w, thing.h) / 2 : thing ? thing.y : 0;
    const room = thing && (thing.h < lastBox.height || figure !== "battants") ? roof - 16 - top0 : 0;
    if (room >= 220) {
      const tall = Math.min(230, room - 90);
      return { x: 140, y: Math.round(roof - 16 - 90 - tall), w: 800, h: Math.round(tall) };
    }
    const c = n ? ClearBox(shots[last], from, lastBox, { aspect: 3.6, min: 420, max: 900, prefer: "top", pad: 24, fallback }) : null;
    const p = c || fallback;
    const w = Math.min(800, Math.max(420, p.w));
    const y = within(p.y, 100, height * 0.75 - 300);
    return { x: Math.round(width / 2 - w / 2), y: Math.round(y), w: Math.round(w), h: Math.round(Math.min(220, Math.max(150, p.h))) };
  }, [n, from, last]);
  const lineTop = place.y + place.h + 14;
  const lastZone = React.useMemo(() => (n ? zoneOf(last, from, lastBox) : null), [n, from, last]);
  const inkOn = (b) => {
    const z = lastZone;
    // Over its rosace (where it draws back to once her name is in): the light of the cone it is made of.
    const r = z ? Math.min(z.w, z.h) / 2 : 0;
    const over = figure !== "battants" && z && force(from) > 0.3 && b.x < z.x + z.w / 2 + r && b.x + b.w > z.x + z.w / 2 - r && b.y < z.y + z.h / 2 + r && b.y + b.h > z.y + z.h / 2 - r;
    const c = over ? cone(from, z, figure === "rosace") : null;
    const q = c ? c.reach * Math.sin(Math.PI / 8) : 0;
    const under = c ? (c.tall ? { x: c.sx - q, y: c.sy - c.reach, w: 2 * q, h: c.reach } : { x: c.sx, y: c.sy - q, w: c.reach, h: 2 * q }) : b;
    const light = n ? LightUnder(shots[last], c ? from : frame, lastBox, under) : null;
    const bright = light && light.mean > 0.6;
    return { color: bright ? "#1c1a17" : "#ffffff", textShadow: bright ? "0 2px 18px rgba(255,255,255,0.55)" : "0 2px 5px rgba(0,0,0,0.55), 0 4px 34px rgba(0,0,0,0.6)" };
  };
  const shownAt = card ? endAt : hook ? hook.from : endAt;
  const appear = (delay) => within((frame - shownAt - delay) / 9, 0, 1);
  const words = [];
  if (title) {
    const a = appear(0);
    words.push(h(FitText, { key: "t-" + title, style: { position: "absolute", left: place.x, top: place.y, width: place.w, height: place.h, opacity: a, filter: "blur(" + ((1 - a) * 8).toFixed(1) + "px)" },
      innerStyle: { fontFamily: display, fontWeight: 700, fontSize: 150, lineHeight: 1, letterSpacing: "0.03em", textTransform: "uppercase", ...inkOn({ x: place.x, y: place.y, w: place.w, h: place.h }), textAlign: "center", textWrap: "balance" } }, title));
  }
  if (sub) {
    const a = appear(6);
    words.push(h(FitText, { key: "s-" + sub, style: { position: "absolute", left: 140, top: lineTop, width: 800, height: 76, opacity: a },
      innerStyle: { fontFamily: body, fontWeight: 500, fontSize: 48, lineHeight: 1.1, letterSpacing: "0.12em", textTransform: "uppercase", ...inkOn({ x: 140, y: lineTop, w: 800, h: 76 }), textAlign: "center", whiteSpace: "nowrap" } },
      h("span", { "data-fauve-accent": "" }, sub)));
  }
  // Any other text of the Reel (none in its slots): a plain line under hers, so nothing she wrote is lost.
  const others = reelTexts.filter((t) => t !== hook && t !== line && frame >= t.from && frame < Math.min(t.to, endAt));
  others.forEach((t, i) => words.push(h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, top: place.y + place.h + 110 + i * 100, width: 800, height: 90 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 52, ...inkOn({ x: 140, y: place.y + place.h + 110 + i * 100, w: 800, h: 90 }), textAlign: "center" } }, t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, real, mirrors, words);
}`;

export const vitraux: MontageSkill = {
  key: "vitraux",
  version: 2,
  bpm: BPM,
  shots: [1, 1],
  files: [1, 3],
  // A verse a shot: one more of her things in its mirrors, eight beats each, for a longer Reel she asks for.
  long: 3,
  how: "Un seul plan fixe de sa chose la plus graphique, filmée bien droite et de face (sa porte, sa devanture, sa vitrine, une étagère, son présentoir) : sa vraie image deux images, puis un vrai kaléidoscope de huit miroirs posé sur elle, qui s'ouvre en cercle depuis son milieu jusqu'à la remplir, tourne lentement et se recompose à chaque image (des rosaces de ses propres couleurs, ses lettres devenues des motifs), le reste de l'image vrai autour ; puis il se referme et sa vraie image revient pour boucler. Son nom facultatif pendant qu'il se referme. En vertical plein écran, sa vidéo horizontale recadrée sur sa chose.",
  end: true,
  texts: [
    {
      slot: "nom",
      role: "hook",
      want: "facultatif : son nom, ou le mot de son nom qui la distingue (« Farine » pour « Maison Farine »), ou ce qu'on voit (« Notre vitrine », « La porte du 12 »), écrit en capitales au-dessus de sa chose quand les miroirs se referment ; deux à quatre mots, jamais une phrase",
      max: 22,
      required: false,
    },
    {
      slot: "ligne",
      role: "caption",
      want: "facultatif : une petite ligne en capitales espacées sous son nom : ce qu'elle fait en deux à quatre mots (« boulangerie de quartier », « fleurs de saison »), ou son adresse, son quartier ou ses horaires quand on les connaît (« 12 rue des Martyrs », « ouvert dès 8 h ») ; quatre mots au plus, rien d'inventé",
      max: 26,
      required: false,
    },
  ],
  settings: [
    {
      name: "figure",
      want: "la figure des miroirs : un kaléidoscope qui remplit sa chose, une rosace ronde au milieu, le reste vrai autour, ou des battants qui glissent (sa chose reste debout et se dédouble)",
      choices: [
        { value: "kaleidoscope", says: "un kaléidoscope de huit miroirs qui s'ouvre en cercle depuis le milieu de sa chose jusqu'à la remplir, tourne et se recompose à chaque image, puis se referme" },
        { value: "rosace", says: "le même kaléidoscope dans une rosace ronde au milieu de sa chose, le reste de sa chose vrai autour : un vitrail de ses couleurs (fleurs, tissus, gâteaux, assiettes vues d'en haut)" },
        { value: "battants", says: "des miroirs verticaux qui glissent : sa chose reste debout, se dédouble en copies plus étroites et se recompose, comme les battants de l'original" },
      ],
    },
    {
      name: "format",
      want: "le format : vertical plein écran, ou sa vidéo horizontale entière dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "vertical plein écran comme l'original, sa vidéo horizontale recadrée sur sa chose" },
        { value: "horizontal", says: "sa vidéo entière dans une bande 16:9 sur du noir, les miroirs dans la bande" },
      ],
    },
  ],
  objects: [
    {
      slot: "devanture",
      shot: 0,
      want: "la chose graphique de son plan où se posent les miroirs, en deux à quatre mots : sa porte, sa devanture, sa vitrine, une étagère, son présentoir, son comptoir (« front door », « shop front », « shop window », « bookshelf », « display case », « flower display ») ; la partie la plus riche quand son plan la montre de loin (« shop window » plutôt que « shop front » quand la rue est devant) ; vide quand elle remplit déjà presque toute l'image (les miroirs la prennent toute)",
    },
  ],
  timeline(n, { end, bpm: tempo }) {
    // At another tempo (a longer Reel, or a music's own): every landmark counted in beats follows it.
    const bpm = tempo ?? BPM;
    const beat = 60 / bpm;
    const verses = Math.max(0, n - 1);
    const more = verses * VERSE;
    // With an ending card, its time after the original's length, whole beats (the engine's 1,6 s at least).
    const card = end ? Math.ceil((END_CARD + 0.05) / beat) : 0;
    const total = LENGTH + more + card;
    // Its one shot; a verse cut on the bar of beat 8, the next every eight beats, the last one to the end.
    const edges = [0, ...Array.from({ length: verses }, (_, j) => CUT + VERSE * j), total];
    const spans = beatSpans(bpm, edges.slice(1).map((e, i) => e - edges[i]!));
    const duration = spans.at(-1)!.end;
    const at = (beats: number) => round3(beats * beat);
    const shown = round(end ? duration - END_CARD : duration);
    const length = (s: { start: number; end: number }) => String(round(s.end - s.start)).replace(".", ",");
    return {
      duration,
      shots: spans.map((s, i) => ({
        ...s,
        want:
          i === 0
            ? `sa chose la plus graphique, filmée bien droite et de face, téléphone posé, sans personne qui passe devant (sa porte ou sa devanture dans son encadrement, sa vitrine, une étagère bien rangée, son présentoir, ses tissus, ses livres, un bouquet de face), plutôt de près et pleine de détails et de couleurs (une vitrine pleine, des rangées, des motifs) que de loin avec la rue, des voitures ou des vélos devant ; sinon son plan le plus fixe et le plus droit de son lieu ou de ses produits, ou une photo bien droite ; ${length(s)} s de vidéo, ou une photo (un kaléidoscope de ses miroirs se pose dessus, elle reste immobile)`
            : `une autre de ses choses graphiques, filmée de face et fixe (une autre vitrine, une étagère, un présentoir, un détail plein de lignes), ${length(s)} s, ou une photo : elle arrive coupée sur le temps, déjà dans les miroirs`,
      })),
      // Her name from beat 12 (the mirrors still turning, then closing under it), her line with it, to the end or the card.
      texts: { nom: { from: at(NAME + more), to: shown }, ligne: { from: at(NAME + more), to: shown } },
      marks: {
        beat: round3((beat * 30)),
        first: toFrame(at(FIRST)),
        open_from: toFrame(at(OPEN)),
        full: toFrame(at(FULL)),
        close: toFrame(at(CLOSE + more)),
        real: toFrame(at(REAL + more)),
        turn: TURN,
      },
      // Its soft house loop, its first beat on 0,345 s, played through and cut dead at the end for the loop.
      music: { downbeat: at(FIRST), end: { at: duration, fade: 0.012 } },
    };
  },
  code: CODE,
};
